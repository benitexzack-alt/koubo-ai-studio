#!/usr/bin/env node

import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {
  assertGeneratedVideoPlanPathIsolation,
  generatedVideoEvidenceBinding,
  loadPlanAndStyle,
  sha256File,
  validateGeneratedVideoPlan,
} from './generated-video-plan-core.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sampleFractions = [0, 0.25, 0.5, 0.75, 1];
const checkNames = [
  'styleSignature',
  'singleAction',
  'identityStable',
  'shapeStable',
  'contactContinuous',
  'subtitleSafe',
  'noForbiddenElements',
];
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const toAbsolute = (filePath) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);

const assertQaDerivedPathSafe = (loaded, filePath, label) =>
  assertGeneratedVideoPlanPathIsolation({
    plan: loaded.plan,
    planPath: loaded.planPath,
    derivedPaths: [{label, path: filePath}],
  });

const atomicWriteJson = (
  filePath,
  value,
  {loaded = null, allowPlanWrite = false, label = 'QA JSON产物'} = {},
) => {
  const absolutePath = toAbsolute(filePath);
  if (loaded) {
    if (allowPlanWrite) {
      const protectedPlanPath = assertGeneratedVideoPlanPathIsolation({
        plan: loaded.plan,
        planPath: loaded.planPath,
      });
      if (absolutePath !== protectedPlanPath) {
        throw new Error(`${label}只允许写回当前生成视频拆镜计划。`);
      }
    } else {
      assertQaDerivedPathSafe(loaded, filePath, label);
    }
  }
  fs.mkdirSync(path.dirname(absolutePath), {recursive: true});
  const temporaryPath = `${absolutePath}.tmp-${process.pid}-${randomUUID()}`;
  const descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
  let descriptorClosed = false;
  let committed = false;
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptorClosed = true;
    fs.renameSync(temporaryPath, absolutePath);
    committed = true;
  } finally {
    if (!descriptorClosed) fs.closeSync(descriptor);
    if (!committed) fs.rmSync(temporaryPath, {force: true});
  }
};

const acquirePlanExecutionLock = (planPath) => {
  const absolutePlanPath = toAbsolute(planPath);
  const lockPath = `${absolutePlanPath}.execution.lock`;
  let descriptor;
  try {
    descriptor = fs.openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(
        `生成视频计划正在被另一进程执行或写入：${lockPath}；禁止并发QA写回`,
      );
    }
    throw error;
  }
  const opened = fs.fstatSync(descriptor);
  fs.writeFileSync(
    descriptor,
    `${JSON.stringify({pid: process.pid, acquiredAt: new Date().toISOString()})}\n`,
  );
  fs.fsyncSync(descriptor);
  return () => {
    try {
      fs.closeSync(descriptor);
    } finally {
      if (fs.existsSync(lockPath)) {
        const current = fs.lstatSync(lockPath);
        if (
          current.isFile() &&
          current.dev === opened.dev &&
          current.ino === opened.ino
        ) {
          fs.rmSync(lockPath, {force: true});
        }
      }
    }
  };
};

const createPlanCas = (loaded) => {
  const expectedSha256 = sha256File(loaded.planPath);
  return () => {
    if (sha256File(loaded.planPath) !== expectedSha256) {
      throw new Error(
        '生成视频计划在QA期间被其他进程修改；已停止QA写回，请重新加载当前计划',
      );
    }
  };
};

const runBinary = (binary, args, label) => {
  const result = spawnSync(binary, args, {encoding: 'utf8'});
  if (result.status !== 0) {
    throw new Error(`${label}失败：${result.stderr || result.stdout || '未知错误'}`);
  }
  return result.stdout;
};

const parseFrameRate = (value) => {
  const [numerator, denominator = '1'] = String(value ?? '').split('/').map(Number);
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? numerator / denominator
    : NaN;
};

export const probeGeneratedVideo = ({videoPath, ffprobeBin = 'ffprobe'}) => {
  const output = runBinary(
    ffprobeBin,
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,codec_name,avg_frame_rate:format=duration',
      '-of',
      'json',
      toAbsolute(videoPath),
    ],
    `ffprobe ${videoPath}`,
  );
  const parsed = JSON.parse(output);
  const stream = parsed.streams?.[0] ?? {};
  return {
    width: Number(stream.width),
    height: Number(stream.height),
    durationSeconds: Number(parsed.format?.duration),
    fps: Number(parseFrameRate(stream.avg_frame_rate).toFixed(3)),
    codec: String(stream.codec_name ?? ''),
  };
};

const extractContactSheet = ({
  shot,
  probe,
  contactSheetPath,
  frameDirectory,
  ffmpegBin,
  assertSafe,
}) => {
  assertSafe(frameDirectory, `镜头${shot.id}质检帧目录`);
  fs.rmSync(frameDirectory, {recursive: true, force: true});
  assertSafe(frameDirectory, `镜头${shot.id}质检帧目录`);
  fs.mkdirSync(frameDirectory, {recursive: true});
  const lastFrameMargin = Number.isFinite(probe.fps) && probe.fps > 0
    ? Math.max(0.05, 1 / probe.fps)
    : 0.1;
  const safeDuration = Math.max(probe.durationSeconds - lastFrameMargin, 0);
  const framePaths = [];
  for (const [index, fraction] of sampleFractions.entries()) {
    const seconds = Math.min(safeDuration, probe.durationSeconds * fraction);
    const framePath = path.join(
      frameDirectory,
      `${String(index).padStart(2, '0')}-${Math.round(fraction * 100)}.png`,
    );
    assertSafe(framePath, `镜头${shot.id}质检帧`);
    runBinary(
      ffmpegBin,
      [
        '-y',
        '-ss',
        seconds.toFixed(3),
        '-i',
        toAbsolute(shot.output.videoPath),
        '-frames:v',
        '1',
        '-vf',
        'scale=480:-2',
        framePath,
      ],
      `抽取镜头${shot.id}在${Math.round(fraction * 100)}%的质检帧`,
    );
    framePaths.push(framePath);
  }
  assertSafe(contactSheetPath, `镜头${shot.id}联系表`);
  fs.mkdirSync(path.dirname(toAbsolute(contactSheetPath)), {recursive: true});
  runBinary(
    ffmpegBin,
    [
      '-y',
      '-framerate',
      '1',
      '-pattern_type',
      'glob',
      '-i',
      path.join(frameDirectory, '*.png'),
      '-vf',
      'tile=5x1:padding=8:margin=8:color=#D0C3B3',
      '-pix_fmt',
      'yuvj420p',
      '-frames:v',
      '1',
      toAbsolute(contactSheetPath),
    ],
    `合成镜头${shot.id}联系表`,
  );
  return framePaths.map((framePath) => path.relative(projectRoot, framePath));
};

const buildGlobalContactSheet = ({
  shotSheets,
  outputPath,
  ffmpegBin,
  assertSafe,
}) => {
  assertSafe(outputPath, '全局生成插片联系表');
  if (shotSheets.length === 1) {
    fs.copyFileSync(toAbsolute(shotSheets[0]), toAbsolute(outputPath));
    return;
  }
  const args = ['-y'];
  for (const sheet of shotSheets) args.push('-i', toAbsolute(sheet));
  const inputs = shotSheets.map((_, index) => `[${index}:v]`).join('');
  args.push(
    '-filter_complex',
    `${inputs}vstack=inputs=${shotSheets.length}`,
    '-pix_fmt',
    'yuvj420p',
    '-frames:v',
    '1',
    toAbsolute(outputPath),
  );
  runBinary(ffmpegBin, args, '合成全局生成插片联系表');
};

const prepareGeneratedVideoQaLocked = ({
  planPath,
  ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg',
  ffprobeBin = process.env.FFPROBE_BIN || 'ffprobe',
  now = () => new Date().toISOString(),
  beforeQaMutation = null,
}) => {
  const loaded = loadPlanAndStyle(planPath);
  const assertPlanCurrent = createPlanCas(loaded);
  const planValidation = validateGeneratedVideoPlan(loaded.plan, loaded.style, {
    phase: 'plan',
  });
  if (!planValidation.ok) {
    throw new Error(
      `生成视频计划未通过 plan 门禁：\n${planValidation.errors
        .map((error) => `- [${error.code}] ${error.message}`)
        .join('\n')}`,
    );
  }
  if (!['downloaded', 'qa-review-required'].includes(loaded.plan.productionStatus)) {
    throw new Error('只有全部镜头已下载的计划才能准备视觉 QA');
  }
  const evidenceBinding = generatedVideoEvidenceBinding(
    loaded.plan,
    loaded.style,
  );
  const qaRoot = path.dirname(toAbsolute(loaded.plan.outputs.qaReportPath));
  if (typeof beforeQaMutation === 'function') beforeQaMutation(loaded.plan);
  assertPlanCurrent();
  const runtimeValidation = validateGeneratedVideoPlan(loaded.plan, loaded.style, {
    phase: 'plan',
  });
  if (!runtimeValidation.ok) {
    throw new Error(
      `QA写入前计划安全复核失败：\n${runtimeValidation.errors
        .map((error) => `- [${error.code}] ${error.message}`)
        .join('\n')}`,
    );
  }
  assertGeneratedVideoPlanPathIsolation({
    plan: loaded.plan,
    planPath: loaded.planPath,
    derivedPaths: [
      {label: 'QA运行目录', path: qaRoot},
      {label: '全局联系表', path: loaded.plan.outputs.contactSheetPath},
      {label: '全局QA报告', path: loaded.plan.outputs.qaReportPath},
    ],
  });
  const assertSafe = (filePath, label) =>
    assertQaDerivedPathSafe(loaded, filePath, label);
  const reports = [];
  const shotSheets = [];
  for (const shot of loaded.plan.shots) {
    if (!fs.existsSync(toAbsolute(shot.output.videoPath))) {
      throw new Error(`镜头${shot.id}本地视频不存在：${shot.output.videoPath}`);
    }
    const probe = probeGeneratedVideo({videoPath: shot.output.videoPath, ffprobeBin});
    const shotContactSheetPath = path.relative(
      projectRoot,
      path.join(qaRoot, `${shot.id}-contact-sheet.jpg`),
    );
    const shotReportPath = path.relative(
      projectRoot,
      path.join(qaRoot, `${shot.id}-qa.json`),
    );
    const frames = extractContactSheet({
      shot,
      probe,
      contactSheetPath: shotContactSheetPath,
      frameDirectory: path.join(qaRoot, 'frames', shot.id),
      ffmpegBin,
      assertSafe,
    });
    shot.output.probe = probe;
    shot.qa = {
      status: 'pending-visual-review',
      contactSheetPath: shotContactSheetPath,
      reportPath: shotReportPath,
      visualReview: {
        status: 'pending',
        reviewer: null,
        reviewerKind: null,
        reviewerModel: null,
        reviewerVersion: null,
        reviewedAt: null,
        contactSheetSha256: null,
      },
      sampleFractions,
      checks: Object.fromEntries(checkNames.map((name) => [name, false])),
    };
    const report = {
      schemaVersion: 'generated-video-shot-qa/v1',
      planId: loaded.plan.planId,
      shotId: shot.id,
      ...evidenceBinding,
      videoSha256: shot.output.sha256,
      preparedAt: now(),
      status: 'pending-visual-review',
      spokenAnchor: shot.spokenAnchor,
      causalChain: shot.causalChain,
      singleAction: shot.singleAction,
      continuity: shot.continuity,
      probe,
      sampleFractions,
      frames,
      contactSheetPath: shotContactSheetPath,
      contactSheetSha256: sha256File(shotContactSheetPath),
      requiredChecks: Object.fromEntries(checkNames.map((name) => [name, false])),
      visualReview: {
        status: 'pending',
        reviewer: null,
        reviewerKind: null,
        reviewerModel: null,
        reviewerVersion: null,
        reviewedAt: null,
        contactSheetSha256: null,
        observations: Object.fromEntries(checkNames.map((name) => [name, ''])),
        notes: '',
      },
      boundary: '逐镜视觉复核不替代最终成片的用户完整观看确认。',
    };
    atomicWriteJson(shotReportPath, report, {
      loaded,
      label: `镜头${shot.id} QA报告`,
    });
    reports.push(report);
    shotSheets.push(shotContactSheetPath);
  }
  fs.mkdirSync(path.dirname(toAbsolute(loaded.plan.outputs.contactSheetPath)), {
    recursive: true,
  });
  buildGlobalContactSheet({
    shotSheets,
    outputPath: loaded.plan.outputs.contactSheetPath,
    ffmpegBin,
    assertSafe,
  });
  const globalReport = {
    schemaVersion: 'generated-video-visual-review/v1',
    planId: loaded.plan.planId,
    ...evidenceBinding,
    preparedAt: now(),
    status: 'pending-visual-review',
    reviewer: null,
    reviewerKind: null,
    reviewerModel: null,
    reviewerVersion: null,
    reviewedAt: null,
    contactSheetPath: loaded.plan.outputs.contactSheetPath,
    contactSheetSha256: sha256File(loaded.plan.outputs.contactSheetPath),
    shots: reports.map((report) => ({
      id: report.shotId,
      decision: 'pending',
      checks: Object.fromEntries(checkNames.map((name) => [name, false])),
      observations: Object.fromEntries(checkNames.map((name) => [name, ''])),
      notes: '',
      videoSha256: report.videoSha256,
      contactSheetPath: report.contactSheetPath,
      contactSheetSha256: sha256File(report.contactSheetPath),
      reportPath: loaded.plan.shots.find((shot) => shot.id === report.shotId).qa
        .reportPath,
    })),
    boundary: '本报告由逐镜联系表复核使用，不替代最终成片的用户完整观看确认。',
  };
  atomicWriteJson(loaded.plan.outputs.qaReportPath, globalReport, {
    loaded,
    label: '全局QA报告',
  });
  loaded.plan.productionStatus = 'qa-review-required';
  assertPlanCurrent();
  atomicWriteJson(loaded.planPath, loaded.plan, {
    loaded,
    allowPlanWrite: true,
    label: '生成视频拆镜计划',
  });
  return globalReport;
};

export const prepareGeneratedVideoQa = (options) => {
  const releaseLock = acquirePlanExecutionLock(options.planPath);
  try {
    return prepareGeneratedVideoQaLocked(options);
  } finally {
    releaseLock();
  }
};

const applyGeneratedVideoVisualReviewLocked = ({planPath, reviewPath}) => {
  const loaded = loadPlanAndStyle(planPath);
  const assertPlanCurrent = createPlanCas(loaded);
  if (
    toAbsolute(reviewPath) !== toAbsolute(loaded.plan.outputs.qaReportPath)
  ) {
    throw new Error('视觉复核报告必须使用当前计划固定的 outputs.qaReportPath。');
  }
  assertQaDerivedPathSafe(loaded, reviewPath, '视觉复核报告');
  const review = JSON.parse(fs.readFileSync(toAbsolute(reviewPath), 'utf8'));
  const evidenceBinding = generatedVideoEvidenceBinding(
    loaded.plan,
    loaded.style,
  );
  const validReviewerKinds = new Set(['human', 'codex-vision', 'vision-model']);
  if (
    review.schemaVersion !== 'generated-video-visual-review/v1' ||
    review.planId !== loaded.plan.planId ||
    review.status !== 'passed' ||
    !isText(review.reviewer) ||
    !validReviewerKinds.has(review.reviewerKind) ||
    Number.isNaN(Date.parse(review.reviewedAt))
  ) {
    throw new Error(
      '视觉复核报告必须绑定当前planId，并记录passed、复核人、复核类型和有效时间',
    );
  }
  if (
    review.reviewerKind !== 'human' &&
    (!isText(review.reviewerModel) || !isText(review.reviewerVersion))
  ) {
    throw new Error('模型视觉复核必须记录reviewerModel和reviewerVersion');
  }
  for (const [field, expected] of Object.entries(evidenceBinding)) {
    if (review[field] !== expected) {
      throw new Error(`视觉复核报告未绑定当前${field}`);
    }
  }
  if (
    review.contactSheetPath !== loaded.plan.outputs.contactSheetPath ||
    review.contactSheetSha256 !== sha256File(loaded.plan.outputs.contactSheetPath)
  ) {
    throw new Error('视觉复核报告未绑定当前全局联系表');
  }
  const reviewByShot = new Map((review.shots ?? []).map((item) => [item.id, item]));
  for (const shot of loaded.plan.shots) {
    const item = reviewByShot.get(shot.id);
    if (!item || item.decision !== 'passed') {
      throw new Error(`镜头${shot.id}没有通过逐镜视觉复核`);
    }
    for (const check of checkNames) {
      if (item.checks?.[check] !== true) {
        throw new Error(`镜头${shot.id}视觉复核未通过：${check}`);
      }
      if (!isText(item.observations?.[check])) {
        throw new Error(`镜头${shot.id}视觉复核缺少逐项观察结论：${check}`);
      }
    }
    if (item.videoSha256 !== shot.output.sha256) {
      throw new Error(`镜头${shot.id}视觉复核报告未绑定当前视频`);
    }
    const contactSheetSha256 = sha256File(shot.qa.contactSheetPath);
    if (item.contactSheetSha256 !== contactSheetSha256) {
      throw new Error(`镜头${shot.id}视觉复核报告未绑定当前联系表`);
    }
    shot.qa.status = 'passed';
    shot.qa.checks = Object.fromEntries(checkNames.map((name) => [name, true]));
    shot.qa.visualReview = {
      status: 'passed',
      reviewer: review.reviewer,
      reviewerKind: review.reviewerKind,
      reviewerModel: review.reviewerModel ?? null,
      reviewerVersion: review.reviewerVersion ?? null,
      reviewedAt: review.reviewedAt,
      contactSheetSha256,
    };
    const shotReport = JSON.parse(
      fs.readFileSync(toAbsolute(shot.qa.reportPath), 'utf8'),
    );
    shotReport.status = 'passed';
    shotReport.requiredChecks = shot.qa.checks;
    shotReport.visualReview = {
      ...shot.qa.visualReview,
      observations: item.observations,
      notes: item.notes ?? '',
    };
    atomicWriteJson(shot.qa.reportPath, shotReport, {
      loaded,
      label: `镜头${shot.id} QA报告`,
    });
  }
  loaded.plan.productionStatus = 'qa-passed';
  atomicWriteJson(reviewPath, review, {loaded, label: '全局QA报告'});
  const materialized = validateGeneratedVideoPlan(loaded.plan, loaded.style, {
    phase: 'materialized',
  });
  if (!materialized.ok) {
    throw new Error(
      `视觉复核后仍未通过 materialized 门禁：\n${materialized.errors
        .map((error) => `- [${error.code}] ${error.message}`)
        .join('\n')}`,
    );
  }
  assertPlanCurrent();
  atomicWriteJson(loaded.planPath, loaded.plan, {
    loaded,
    allowPlanWrite: true,
    label: '生成视频拆镜计划',
  });
  return {planId: loaded.plan.planId, status: 'qa-passed'};
};

export const applyGeneratedVideoVisualReview = (options) => {
  const releaseLock = acquirePlanExecutionLock(options.planPath);
  try {
    return applyGeneratedVideoVisualReviewLocked(options);
  } finally {
    releaseLock();
  }
};

const optionValue = (args, name) => {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : null;
};

const main = () => {
  const args = process.argv.slice(2);
  const command = args[0];
  const planPath = optionValue(args, 'plan');
  if (!command || !planPath) {
    throw new Error(
      '用法：node tools/qa-generated-video-plan.mjs ' +
        '<prepare|apply-review> --plan <plan.json> [--review <qa-report.json>]',
    );
  }
  const result =
    command === 'prepare'
      ? prepareGeneratedVideoQa({planPath})
      : command === 'apply-review'
        ? applyGeneratedVideoVisualReview({
            planPath,
            reviewPath: optionValue(args, 'review'),
          })
        : (() => {
            throw new Error(`未知命令：${command}`);
          })();
  console.log(JSON.stringify(result, null, 2));
};

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
