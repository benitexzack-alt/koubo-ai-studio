#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  createReadStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const supportedCommands = new Set([
  'doctor',
  'fingerprint',
  'preview',
  'risk-frames',
  'audio-preflight',
  'formal-audio',
  'prepare',
  'formal',
  'qa',
  'regression',
  'all',
]);

const fail = (message) => {
  throw new Error(message);
};

const usage = () => {
  console.error(
    [
      '用法：',
      '  node tools/run-v72-production.mjs <production-job.json> <command> [--force] [--dry-run]',
      '',
      'command：',
      '  doctor          校验任务清单、基线、素材、视觉方案和锁定参考',
      '  fingerprint     计算本轮完整输入指纹',
      '  preview         渲染有音效动态预览并做响度预处理',
      '  risk-frames     按 visual-plan 的 reviewAt 渲染完整分辨率风险帧',
      '  audio-preflight 检查预览响度与真峰值',
      '  formal-audio   复用已有 formal-raw，只重做正式片响度与机器质检',
      '  prepare         doctor + preview + risk-frames + audio-preflight',
      '  formal          渲染 WithSfx 正式片并执行两遍响度处理',
      '  qa              检查正式片规格、完整解码、黑帧、响度和真峰值',
      '  regression      将正式片与锁定参考逐风险帧、逐音效点比较',
      '  all             执行全部阶段',
    ].join('\n'),
  );
};

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--')));
const [jobArgument, command] = positional;

if (!jobArgument || !command || !supportedCommands.has(command)) {
  usage();
  process.exit(1);
}

const force = flags.has('--force');
const dryRun = flags.has('--dry-run');

const resolveProjectPath = (relativePath, label, mustExist = false) => {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    fail(`${label} 必须是非空项目相对路径`);
  }
  if (path.isAbsolute(relativePath)) {
    fail(`${label} 禁止使用绝对路径：${relativePath}`);
  }
  const resolved = path.resolve(projectRoot, relativePath);
  const rootPrefix = `${projectRoot}${path.sep}`;
  if (resolved !== projectRoot && !resolved.startsWith(rootPrefix)) {
    fail(`${label} 逃逸项目目录：${relativePath}`);
  }
  if (mustExist && !existsSync(resolved)) {
    fail(`${label} 不存在：${relativePath}`);
  }
  return resolved;
};

const relativeToProject = (absolutePath) =>
  path.relative(projectRoot, absolutePath).split(path.sep).join('/');

const readJson = (absolutePath, label) => {
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    fail(`${label} 不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
};

const writeJsonAtomic = (absolutePath, value) => {
  mkdirSync(path.dirname(absolutePath), {recursive: true});
  const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporaryPath, absolutePath);
};

const runCommand = (binary, args, options = {}) => {
  if (dryRun && !options.runDuringDryRun) {
    console.log(`[预演] ${binary} ${args.join(' ')}`);
    return {status: 0, stdout: '', stderr: ''};
  }

  const result = spawnSync(binary, args, {
    cwd: options.cwd ?? projectRoot,
    env: {...process.env, ...(options.env ?? {})},
    encoding: options.binaryStdout ? null : 'utf8',
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    stdio: options.inherit ? 'inherit' : 'pipe',
  });
  if (result.error || result.status !== 0) {
    const details = [
      result.error?.message,
      typeof result.stdout === 'string' ? result.stdout.trim() : '',
      typeof result.stderr === 'string' ? result.stderr.trim() : '',
    ]
      .filter(Boolean)
      .join('\n');
    fail(
      `${options.label ?? binary} 失败，退出码 ${result.status ?? 'unknown'}${
        details ? `\n${details}` : ''
      }`,
    );
  }
  return result;
};

const hashFile = (absolutePath) =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absolutePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const collectFiles = (absolutePath) => {
  const metadata = lstatSync(absolutePath);
  if (metadata.isFile() || metadata.isSymbolicLink()) {
    return [absolutePath];
  }
  if (!metadata.isDirectory()) {
    return [];
  }

  return readdirSync(absolutePath, {withFileTypes: true})
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .flatMap((entry) => collectFiles(path.join(absolutePath, entry.name)));
};

const stableJson = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const hashText = (value) => createHash('sha256').update(value).digest('hex');

const jobPath = resolveProjectPath(jobArgument, '生产任务清单', true);
const job = readJson(jobPath, '生产任务清单');
const baselinePath = resolveProjectPath(job.baseline?.path, '生产基线', true);
const baseline = readJson(baselinePath, '生产基线');

const reportPaths = {
  runManifest: resolveProjectPath(job.reports?.runManifest, '运行清单路径'),
  timingReport: resolveProjectPath(job.reports?.timingReport, '计时报告路径'),
  regressionReport: resolveProjectPath(job.reports?.regressionReport, '回归报告路径'),
};

const runManifest = {
  schemaVersion: 1,
  jobId: job.jobId,
  command,
  dryRun,
  force,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  status: 'running',
  fingerprint: null,
  stages: [],
};

const persistRunReports = () => {
  if (dryRun) {
    return;
  }
  const reportFinishedAt = runManifest.finishedAt ?? new Date().toISOString();
  writeJsonAtomic(reportPaths.runManifest, runManifest);
  writeJsonAtomic(reportPaths.timingReport, {
    schemaVersion: 1,
    jobId: runManifest.jobId,
    command: runManifest.command,
    startedAt: runManifest.startedAt,
    finishedAt: runManifest.finishedAt,
    status: runManifest.status,
    totalDurationMs:
      Date.parse(reportFinishedAt) - Date.parse(runManifest.startedAt),
    cumulativeStageDurationMs: runManifest.stages.reduce(
      (sum, stage) => sum + (stage.durationMs ?? 0),
      0,
    ),
    stages: runManifest.stages.map(
      ({name, status, durationMs, cacheHit, startedAt, finishedAt}) => ({
        name,
        status,
        durationMs,
        cacheHit,
        startedAt,
        finishedAt,
      }),
    ),
  });
};

const withStage = async (name, action) => {
  const stage = {
    name,
    status: 'running',
    cacheHit: false,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
  };
  runManifest.stages.push(stage);
  const started = performance.now();
  console.log(`\n[开始] ${name}`);
  try {
    const result = await action(stage);
    stage.status = 'passed';
    return result;
  } catch (error) {
    stage.status = 'failed';
    stage.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    stage.durationMs = Math.round(performance.now() - started);
    stage.finishedAt = new Date().toISOString();
    console.log(
      `[${stage.status === 'passed' ? '通过' : '失败'}] ${name} ${(
        stage.durationMs / 1000
      ).toFixed(2)}秒${stage.cacheHit ? '（缓存命中）' : ''}`,
    );
    persistRunReports();
  }
};

const validateJob = () => {
  const errors = [];
  const requireText = (value, label) => {
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${label} 缺失`);
    }
  };

  if (job.schemaVersion !== 1) errors.push('只支持 schemaVersion=1');
  requireText(job.jobId, 'jobId');
  requireText(job.videoId, 'videoId');
  requireText(job.title, 'title');
  if (job.productionState !== 'ready-for-production') {
    errors.push('productionState 必须为 ready-for-production');
  }
  if (job.baseline?.id !== baseline.baselineId) {
    errors.push(
      `任务基线 ${job.baseline?.id} 与当前基线 ${baseline.baselineId} 不一致`,
    );
  }
  if (job.baseline?.revision !== baseline.baselineRevision) {
    errors.push(
      `任务修订 ${job.baseline?.revision} 与当前修订 ${baseline.baselineRevision} 不一致`,
    );
  }
  if (job.formal?.composition !== 'with-sfx') {
    errors.push('正式路由必须是 with-sfx');
  }
  if (!job.remotion?.compositionWithSfx) {
    errors.push('缺少 WithSfx Composition');
  }
  if (!(job.remotion?.fps > 0 && job.remotion?.durationSeconds > 0)) {
    errors.push('fps 或 durationSeconds 无效');
  }
  if (
    job.remotion?.width !== baseline.production?.width ||
    job.remotion?.height !== baseline.production?.height ||
    job.remotion?.fps !== baseline.production?.fps
  ) {
    errors.push('任务分辨率或帧率与当前生产基线不一致');
  }

  const requiredPaths = [
    ['原片', job.inputs?.source],
    ['渲染兼容副本', job.inputs?.renderProxy],
    ['视觉方案', job.inputs?.visualPlan],
    ['双语字幕', job.inputs?.bilingualCaptions],
    ['音效点位表', job.inputs?.sfxCueSheet],
    ['Remotion 根目录', job.remotion?.root],
  ];
  for (const [label, value] of requiredPaths) {
    try {
      resolveProjectPath(value, label, true);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (!Array.isArray(job.inputs?.fingerprintPaths) || !job.inputs.fingerprintPaths.length) {
    errors.push('fingerprintPaths 不能为空');
  } else {
    for (const fingerprintPath of job.inputs.fingerprintPaths) {
      try {
        resolveProjectPath(fingerprintPath, '输入指纹路径', true);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  for (const range of job.preview?.ranges ?? []) {
    if (
      !range.id ||
      !Number.isFinite(range.startSeconds) ||
      !Number.isFinite(range.endSeconds) ||
      range.startSeconds < 0 ||
      range.endSeconds <= range.startSeconds ||
      range.endSeconds > job.remotion.durationSeconds
    ) {
      errors.push(`预览区间无效：${JSON.stringify(range)}`);
    }
  }

  if (errors.length) {
    fail(`生产任务清单未通过：\n- ${errors.join('\n- ')}`);
  }
};

const readVisualPlan = () =>
  readJson(
    resolveProjectPath(job.inputs.visualPlan, '视觉方案', true),
    '视觉方案',
  );

const riskFrameEntries = () => {
  const plan = readVisualPlan();
  const grouped = new Map();
  for (const layer of plan.layers ?? []) {
    const time = Number(layer.checks?.reviewAt);
    if (!layer.checks?.needsFrameReview || !Number.isFinite(time)) {
      continue;
    }
    const key = time.toFixed(3);
    const current = grouped.get(key) ?? {time, layerIds: []};
    current.layerIds.push(layer.id);
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((a, b) => a.time - b.time);
};

const verifySfxSources = () => {
  const cueSheet = readJson(
    resolveProjectPath(job.inputs.sfxCueSheet, '音效点位表', true),
    '音效点位表',
  );
  if (!Array.isArray(cueSheet.cues) || cueSheet.cues.length === 0) {
    fail('音效点位表没有任何 cue');
  }
  const missing = cueSheet.cues
    .map((cue) => cue.source)
    .filter(Boolean)
    .filter((source) => !existsSync(resolveProjectPath(source, '音效文件')));
  if (missing.length) {
    fail(`音效文件缺失：${[...new Set(missing)].join('、')}`);
  }
  return cueSheet;
};

const verifyLockedReference = async () => {
  const reference = baseline.lockedReference;
  if (!reference || reference.status !== 'user-full-playback-approved') {
    fail('当前生产基线没有用户完整观看通过的 lockedReference');
  }

  const lockedArtifacts = [
    ['正式成片', reference.output],
    ['原片', reference.source],
    ['渲染兼容副本', reference.renderProxy],
    ['正式组件', reference.component],
    ['双语字幕', reference.bilingualCaptions],
    ['视觉方案', reference.visualPlan],
    ['音效点位表', reference.sfxCueSheet],
  ];
  for (const [label, artifact] of lockedArtifacts) {
    const absolutePath = resolveProjectPath(artifact?.path, `锁定${label}`, true);
    const actual = await hashFile(absolutePath);
    if (actual !== artifact.sha256) {
      fail(
        `锁定${label}已变化：${artifact.path}\n期望 ${artifact.sha256}\n实际 ${actual}`,
      );
    }
  }
};

const computeFingerprint = async () => {
  const requestedPaths = [
    relativeToProject(jobPath),
    relativeToProject(baselinePath),
    'workflow/active-production-profile.v1.json',
    'tools/validate-active-production-profile.mjs',
    'tools/validate-production-command-gate.mjs',
    relativeToProject(scriptPath),
    ...job.inputs.fingerprintPaths,
  ];
  const files = [
    ...new Set(
      requestedPaths.flatMap((entry) =>
        collectFiles(resolveProjectPath(entry, '指纹输入', true)),
      ),
    ),
  ].sort((a, b) =>
    relativeToProject(a).localeCompare(relativeToProject(b), 'zh-CN'),
  );

  const entries = [];
  for (const absolutePath of files) {
    const metadata = statSync(absolutePath);
    entries.push({
      path: relativeToProject(absolutePath),
      sizeBytes: metadata.size,
      sha256: await hashFile(absolutePath),
    });
  }

  const fingerprint = hashText(
    stableJson({
      job: JSON.parse(JSON.stringify(job)),
      baselineRevision: baseline.baselineRevision,
      files: entries,
    }),
  );
  return {fingerprint, entries};
};

const cacheRoot = resolveProjectPath(job.cache?.directory, '缓存目录');

const stageCachePath = (stageName, stageKey) =>
  path.join(cacheRoot, stageName, `${stageKey}.json`);

const outputSnapshot = async (absolutePaths) => {
  const snapshots = [];
  for (const absolutePath of absolutePaths) {
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      return null;
    }
    snapshots.push({
      path: relativeToProject(absolutePath),
      sizeBytes: statSync(absolutePath).size,
      sha256: await hashFile(absolutePath),
    });
  }
  return snapshots;
};

const tryStageCache = async (stageName, stageConfig, outputPaths, stage) => {
  if (!job.cache?.enabled || force) {
    return false;
  }
  const stageKey = hashText(
    stableJson({
      fingerprint: runManifest.fingerprint,
      stageName,
      stageConfig,
    }),
  );
  const cachePath = stageCachePath(stageName, stageKey);
  if (!existsSync(cachePath)) {
    return false;
  }
  const cache = readJson(cachePath, `${stageName} 缓存`);
  const current = await outputSnapshot(outputPaths);
  if (!current || stableJson(current) !== stableJson(cache.outputs)) {
    return false;
  }
  stage.cacheHit = true;
  return true;
};

const saveStageCache = async (stageName, stageConfig, outputPaths) => {
  if (!job.cache?.enabled || dryRun) {
    return;
  }
  const outputs = await outputSnapshot(outputPaths);
  if (!outputs) {
    fail(`${stageName} 无法写入缓存：输出文件不存在`);
  }
  const stageKey = hashText(
    stableJson({
      fingerprint: runManifest.fingerprint,
      stageName,
      stageConfig,
    }),
  );
  writeJsonAtomic(stageCachePath(stageName, stageKey), {
    schemaVersion: 1,
    jobId: job.jobId,
    fingerprint: runManifest.fingerprint,
    stageName,
    stageConfig,
    createdAt: new Date().toISOString(),
    outputs,
  });
};

let renderContext = null;

const openRenderContext = async () => {
  if (renderContext) {
    return renderContext;
  }
  if (dryRun) {
    renderContext = {
      serveUrl: '<dry-run-bundle>',
      browser: null,
      compositions: {},
      close: async () => {},
    };
    return renderContext;
  }

  const remotionRoot = resolveProjectPath(job.remotion.root, 'Remotion 根目录', true);
  const requireFromRemotion = createRequire(path.join(remotionRoot, 'package.json'));
  const {bundle} = requireFromRemotion('@remotion/bundler');
  const {openBrowser, renderMedia, renderStill, selectComposition} =
    requireFromRemotion('@remotion/renderer');
  const entryPoint = path.resolve(remotionRoot, job.remotion.entry);
  const publicDir = path.join(remotionRoot, 'public');

  const serveUrl = await withStage('Remotion打包', async () =>
    bundle({
      entryPoint,
      rootDir: remotionRoot,
      publicDir,
      symlinkPublicDir: true,
      enableCaching: true,
      onProgress: () => {},
    }),
  );
  const browser = await openBrowser('chrome', {
    chromeMode: 'headless-shell',
    logLevel: 'error',
  });
  const compositions = {};

  const getComposition = async (id) => {
    if (!compositions[id]) {
      compositions[id] = await selectComposition({
        serveUrl,
        id,
        inputProps: {},
        puppeteerInstance: browser,
        logLevel: 'error',
      });
    }
    return compositions[id];
  };

  const close = async () => {
    await browser.close({silent: true});
    const temporaryRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
    const resolvedBundle = path.resolve(serveUrl);
    if (
      resolvedBundle.startsWith(temporaryRoot) &&
      path.basename(resolvedBundle).startsWith('remotion-webpack-bundle-')
    ) {
      rmSync(resolvedBundle, {recursive: true, force: true});
    }
  };

  renderContext = {
    serveUrl,
    browser,
    renderMedia,
    renderStill,
    getComposition,
    close,
  };
  return renderContext;
};

const renderVideoRange = async ({
  compositionId,
  output,
  startSeconds,
  endSeconds,
  scale,
  crf,
}) => {
  if (dryRun) {
    console.log(
      `[预演] 渲染 ${compositionId} ${startSeconds.toFixed(2)}-${endSeconds.toFixed(
        2,
      )}秒 -> ${relativeToProject(output)}`,
    );
    return;
  }
  mkdirSync(path.dirname(output), {recursive: true});
  const context = await openRenderContext();
  const composition = await context.getComposition(compositionId);
  const fps = job.remotion.fps;
  const startFrame = Math.max(0, Math.round(startSeconds * fps));
  const endFrame = Math.min(
    composition.durationInFrames - 1,
    Math.max(startFrame, Math.ceil(endSeconds * fps) - 1),
  );
  let lastReported = -1;
  await context.renderMedia({
    serveUrl: context.serveUrl,
    composition,
    codec: 'h264',
    outputLocation: output,
    frameRange: [startFrame, endFrame],
    scale,
    crf,
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioBitrate: job.formal.audioBitrate ?? '192k',
    concurrency: job.remotion.concurrency ?? 3,
    puppeteerInstance: context.browser,
    overwrite: true,
    x264Preset: 'medium',
    logLevel: 'error',
    onProgress: ({progress}) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== lastReported && percent % 20 === 0) {
        process.stdout.write(`${percent}% `);
        lastReported = percent;
      }
    },
  });
  process.stdout.write('100%\n');
};

const concatVideos = (inputs, output) => {
  if (dryRun) {
    console.log(
      `[预演] 拼接 ${inputs.length} 个预览片段 -> ${relativeToProject(output)}`,
    );
    return;
  }
  mkdirSync(path.dirname(output), {recursive: true});
  const listPath = `${output}.concat.txt`;
  const escapeForConcat = (value) => value.replaceAll("'", "'\\''");
  writeFileSync(
    listPath,
    `${inputs.map((input) => `file '${escapeForConcat(input)}'`).join('\n')}\n`,
    'utf8',
  );
  try {
    runCommand(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-fflags',
        '+genpts',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-c',
        'copy',
        output,
      ],
      {label: '预览片段拼接'},
    );
  } finally {
    rmSync(listPath, {force: true});
  }
};

const parseLoudnormJson = (stderr) => {
  const matches = [...String(stderr).matchAll(/\{[\s\S]*?"target_offset"\s*:\s*"[^"]+"[\s\S]*?\}/g)];
  if (!matches.length) {
    fail('无法解析 FFmpeg loudnorm 测量结果');
  }
  const parsed = JSON.parse(matches.at(-1)[0]);
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, Number(value)]),
  );
};

const measureLoudness = (input, target) => {
  const result = runCommand(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      input,
      '-map',
      '0:a:0',
      '-af',
      `loudnorm=I=${target.integratedLoudnessTargetLufs}:LRA=${
        target.loudnessRangeTargetLu ?? 11
      }:TP=${target.truePeakTargetDbtp ?? target.preferredTruePeakDbtp}:print_format=json`,
      '-f',
      'null',
      '-',
    ],
    {label: '响度测量', maxBuffer: 16 * 1024 * 1024},
  );
  return parseLoudnormJson(result.stderr);
};

const normalizeLoudness = (input, output, target) => {
  if (dryRun) {
    console.log(
      `[预演] 两遍响度处理 ${relativeToProject(input)} -> ${relativeToProject(output)}`,
    );
    return null;
  }
  const measured = measureLoudness(input, target);
  mkdirSync(path.dirname(output), {recursive: true});
  const filter = [
    `loudnorm=I=${target.integratedLoudnessTargetLufs}`,
    `LRA=${target.loudnessRangeTargetLu ?? 11}`,
    `TP=${target.truePeakTargetDbtp ?? target.preferredTruePeakDbtp}`,
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true',
    'print_format=summary',
  ].join(':');
  runCommand(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      input,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0',
      '-c:v',
      'copy',
      '-af',
      filter,
      '-c:a',
      'aac',
      '-b:a',
      job.formal.audioBitrate ?? '192k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-movflags',
      '+faststart',
      output,
    ],
    {label: '正式响度处理'},
  );
  return measured;
};

const renderPreview = async () =>
  withStage('有音效动态预览', async (stage) => {
    const output = resolveProjectPath(job.preview.output, '预览输出');
    const comparisonOutput = job.preview.renderWithoutSfxComparison
      ? path.join(
          path.dirname(output),
          'audio-ab',
          'preview-without-sfx-matched-video.mp4',
        )
      : null;
    const outputs = comparisonOutput ? [output, comparisonOutput] : [output];
    const stageConfig = {
      composition: job.remotion.compositionWithSfx,
      comparisonComposition: comparisonOutput
        ? job.remotion.compositionWithoutSfx
        : null,
      ranges: job.preview.ranges,
      scale: job.preview.scale,
      crf: job.preview.crf,
      loudness: job.formal.loudness,
    };
    if (await tryStageCache('preview', stageConfig, outputs, stage)) {
      return output;
    }

    const renderVariant = async ({compositionId, destination, segmentName}) => {
      const rawOutput = `${destination}.raw.mp4`;
      const segmentDir = path.join(path.dirname(destination), segmentName);
      const segments = [];
      for (const [index, range] of job.preview.ranges.entries()) {
        const segment = path.join(
          segmentDir,
          `${String(index + 1).padStart(2, '0')}-${range.id}.mp4`,
        );
        await renderVideoRange({
          compositionId,
          output: segment,
          startSeconds: range.startSeconds,
          endSeconds: range.endSeconds,
          scale: job.preview.scale,
          crf: job.preview.crf,
        });
        segments.push(segment);
      }
      concatVideos(segments, rawOutput);
      normalizeLoudness(rawOutput, destination, {
        ...job.formal.loudness,
        truePeakTargetDbtp: job.audioPreflight.preferredTruePeakDbtp,
      });
      if (!dryRun) {
        rmSync(rawOutput, {force: true});
        rmSync(segmentDir, {recursive: true, force: true});
      }
    };

    await renderVariant({
      compositionId: job.remotion.compositionWithSfx,
      destination: output,
      segmentName: '.preview-segments',
    });
    if (comparisonOutput) {
      await renderVariant({
        compositionId: job.remotion.compositionWithoutSfx,
        destination: comparisonOutput,
        segmentName: '.preview-segments-no-sfx',
      });
      if (!dryRun) {
        const matchedOutput = `${comparisonOutput}.matched.mp4`;
        runCommand(
          'ffmpeg',
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-i',
            output,
            '-i',
            comparisonOutput,
            '-map',
            '0:v:0',
            '-map',
            '1:a:0',
            '-c',
            'copy',
            '-shortest',
            '-movflags',
            '+faststart',
            matchedOutput,
          ],
          {label: '音效A/B画面锁定'},
        );
        rmSync(comparisonOutput, {force: true});
        renameSync(matchedOutput, comparisonOutput);
      }
    }
    await saveStageCache('preview', stageConfig, outputs);
    return output;
  });

const renderRiskFrames = async () =>
  withStage('完整分辨率风险帧', async (stage) => {
    const entries = riskFrameEntries();
    const outputDirectory = resolveProjectPath(
      job.riskFrames.outputDirectory,
      '风险帧目录',
    );
    const outputs = entries.map((entry, index) => {
      const timestamp = entry.time.toFixed(2).replace('.', 'p');
      const ids = entry.layerIds.join('-').replaceAll(/[^A-Za-z0-9_-]/g, '');
      return path.join(
        outputDirectory,
        `${String(index + 1).padStart(2, '0')}-${timestamp}s-${ids}.png`,
      );
    });
    const stageConfig = {
      composition: job.remotion.compositionWithSfx,
      entries,
      scale: 1,
    };
    if (await tryStageCache('risk-frames', stageConfig, outputs, stage)) {
      return outputs;
    }
    if (dryRun) {
      for (const [index, entry] of entries.entries()) {
        console.log(
          `[预演] 风险帧 ${entry.time.toFixed(2)}秒 -> ${relativeToProject(
            outputs[index],
          )}`,
        );
      }
      return outputs;
    }

    mkdirSync(outputDirectory, {recursive: true});
    const context = await openRenderContext();
    const composition = await context.getComposition(
      job.remotion.compositionWithSfx,
    );
    for (const [index, entry] of entries.entries()) {
      const frame = Math.min(
        composition.durationInFrames - 1,
        Math.max(0, Math.round(entry.time * job.remotion.fps)),
      );
      await context.renderStill({
        serveUrl: context.serveUrl,
        composition,
        frame,
        output: outputs[index],
        imageFormat: 'png',
        scale: 1,
        puppeteerInstance: context.browser,
        overwrite: true,
        logLevel: 'error',
      });
      console.log(
        `  ${String(index + 1).padStart(2, '0')}/${outputs.length} ${entry.time.toFixed(
          2,
        )}秒`,
      );
    }
    await saveStageCache('risk-frames', stageConfig, outputs);
    return outputs;
  });

const runAudioPreflight = async () =>
  withStage('预览音频预检', async () => {
    if (dryRun) {
      console.log(
        `[预演] 测量 ${job.preview.output} 的响度、响度范围和真峰值`,
      );
      return null;
    }
    const preview = resolveProjectPath(job.preview.output, '预览输出', true);
    const measured = measureLoudness(preview, {
      integratedLoudnessTargetLufs:
        job.audioPreflight.integratedLoudnessTargetLufs,
      loudnessRangeTargetLu: job.formal.loudness.loudnessRangeTargetLu,
      truePeakTargetDbtp: job.audioPreflight.preferredTruePeakDbtp,
    });
    const loudnessDelta = Math.abs(
      measured.input_i - job.audioPreflight.integratedLoudnessTargetLufs,
    );
    if (loudnessDelta > 0.7) {
      fail(
        `预览响度偏差 ${loudnessDelta.toFixed(2)} LU，实际 ${measured.input_i} LUFS`,
      );
    }
    if (measured.input_tp > job.audioPreflight.truePeakMaxDbtp) {
      fail(
        `预览真峰值 ${measured.input_tp} dBTP 超过 ${job.audioPreflight.truePeakMaxDbtp} dBTP`,
      );
    }
    runManifest.audioPreflight = {
      integratedLoudnessLufs: measured.input_i,
      loudnessRangeLu: measured.input_lra,
      truePeakDbtp: measured.input_tp,
      result: 'pass',
    };
    return measured;
  });

const renderFormal = async () => {
  const rawOutput = resolveProjectPath(job.formal.rawOutput, '正式片原始输出');

  await withStage('WithSfx正式渲染', async (stage) => {
    const stageConfig = {
      composition: job.remotion.compositionWithSfx,
      durationSeconds: job.remotion.durationSeconds,
      scale: 1,
      crf: job.formal.crf,
      pixelFormat: job.formal.pixelFormat,
      concurrency: job.remotion.concurrency,
    };
    if (await tryStageCache('formal-render', stageConfig, [rawOutput], stage)) {
      return;
    }
    await renderVideoRange({
      compositionId: job.remotion.compositionWithSfx,
      output: rawOutput,
      startSeconds: 0,
      endSeconds: job.remotion.durationSeconds,
      scale: 1,
      crf: job.formal.crf,
    });
    await saveStageCache('formal-render', stageConfig, [rawOutput]);
  });

  return normalizeFormalAudio();
};

const normalizeFormalAudio = async () => {
  const rawOutput = resolveProjectPath(
    job.formal.rawOutput,
    '正式片原始输出',
    true,
  );
  const finalOutput = resolveProjectPath(job.formal.finalOutput, '正式片最终输出');

  await withStage('正式片两遍响度处理', async (stage) => {
    const stageConfig = {
      input: relativeToProject(rawOutput),
      loudness: job.formal.loudness,
      audioBitrate: job.formal.audioBitrate,
    };
    if (
      await tryStageCache('formal-loudness', stageConfig, [finalOutput], stage)
    ) {
      return;
    }
    normalizeLoudness(rawOutput, finalOutput, job.formal.loudness);
    await saveStageCache('formal-loudness', stageConfig, [finalOutput]);
  });

  return finalOutput;
};

const probeMedia = (input) => {
  const result = runCommand(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,pix_fmt,sample_rate,channels,bit_rate',
      '-of',
      'json',
      input,
    ],
    {label: '媒体规格检查'},
  );
  return JSON.parse(result.stdout);
};

const runFormalQa = async () =>
  withStage('正式片机器质检', async () => {
    const output = resolveProjectPath(job.formal.finalOutput, '正式片输出', true);
    const probe = probeMedia(output);
    const video = probe.streams.find((stream) => stream.codec_type === 'video');
    const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
    const durationSeconds = Number(probe.format.duration);
    const errors = [];

    if (video?.width !== job.remotion.width || video?.height !== job.remotion.height) {
      errors.push(`分辨率错误：${video?.width}x${video?.height}`);
    }
    if (video?.codec_name !== 'h264') errors.push(`视频编码错误：${video?.codec_name}`);
    if (video?.avg_frame_rate !== `${job.remotion.fps}/1`) {
      errors.push(`帧率错误：${video?.avg_frame_rate}`);
    }
    if (audio?.codec_name !== 'aac') errors.push(`音频编码错误：${audio?.codec_name}`);
    if (Number(audio?.sample_rate) !== 48000) {
      errors.push(`音频采样率错误：${audio?.sample_rate}`);
    }
    if (Math.abs(durationSeconds - job.remotion.durationSeconds) > 0.15) {
      errors.push(
        `时长偏差过大：${durationSeconds.toFixed(3)}秒，任务为${job.remotion.durationSeconds}秒`,
      );
    }

    runCommand(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-i', output, '-f', 'null', '-'],
      {label: '完整解码检查'},
    );
    const black = runCommand(
      'ffmpeg',
      [
        '-hide_banner',
        '-nostats',
        '-i',
        output,
        '-vf',
        'blackdetect=d=0.08:pic_th=0.999:pix_th=0.10',
        '-an',
        '-f',
        'null',
        '-',
      ],
      {label: '黑帧检查'},
    );
    const blackFrameCount = (black.stderr.match(/black_start:/g) ?? []).length;
    if (blackFrameCount > 0) errors.push(`检测到 ${blackFrameCount} 段黑帧`);

    const loudness = measureLoudness(output, job.formal.loudness);
    if (
      Math.abs(loudness.input_i - job.formal.loudness.integratedLoudnessTargetLufs) >
      0.5
    ) {
      errors.push(`正式片响度为 ${loudness.input_i} LUFS`);
    }
    if (loudness.input_tp > baseline.sfxPolicy.formalTargets.truePeakMaxDbtp) {
      errors.push(`正式片真峰值为 ${loudness.input_tp} dBTP`);
    }

    const qaReport = {
      schemaVersion: 1,
      jobId: job.jobId,
      output: relativeToProject(output),
      sha256: await hashFile(output),
      durationSeconds,
      sizeBytes: Number(probe.format.size),
      video,
      audio,
      blackFrameCount,
      integratedLoudnessLufs: loudness.input_i,
      loudnessRangeLu: loudness.input_lra,
      truePeakDbtp: loudness.input_tp,
      errors,
      status: errors.length ? 'failed' : 'passed',
    };
    runManifest.formalQa = qaReport;
    if (errors.length) {
      fail(`正式片机器质检未通过：\n- ${errors.join('\n- ')}`);
    }
    return qaReport;
  });

const compareFrameMetric = (reference, candidate, time, filterName, metricPattern) => {
  const result = runCommand(
    'ffmpeg',
    [
      '-hide_banner',
      '-ss',
      String(time),
      '-i',
      reference,
      '-ss',
      String(time),
      '-i',
      candidate,
      '-filter_complex',
      `[0:v][1:v]${filterName}`,
      '-frames:v',
      '1',
      '-an',
      '-f',
      'null',
      '-',
    ],
    {label: `${filterName.toUpperCase()} 帧比较`},
  );
  const match = result.stderr.match(metricPattern);
  if (!match) {
    fail(`无法解析 ${filterName.toUpperCase()} 比较结果`);
  }
  return match[1].toLowerCase() === 'inf'
    ? Number.POSITIVE_INFINITY
    : Number(match[1]);
};

const audioWindow = (input, start, duration = 0.8) =>
  runCommand(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      String(Math.max(0, start)),
      '-t',
      String(duration),
      '-i',
      input,
      '-map',
      '0:a:0',
      '-ac',
      '2',
      '-ar',
      '48000',
      '-f',
      's16le',
      '-',
    ],
    {
      label: '音效窗口解码',
      binaryStdout: true,
      maxBuffer: 4 * 1024 * 1024,
    },
  ).stdout;

const audioSimilarity = (leftBuffer, rightBuffer) => {
  const sampleCount = Math.min(
    Math.floor(leftBuffer.length / 2),
    Math.floor(rightBuffer.length / 2),
  );
  if (!sampleCount) {
    return {
      correlation: 0,
      normalizedRmse: Number.POSITIVE_INFINITY,
      rmsRatio: 0,
    };
  }
  let sumLeft = 0;
  let sumRight = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    sumLeft += leftBuffer.readInt16LE(index * 2);
    sumRight += rightBuffer.readInt16LE(index * 2);
  }
  const meanLeft = sumLeft / sampleCount;
  const meanRight = sumRight / sampleCount;
  let covariance = 0;
  let energyLeft = 0;
  let energyRight = 0;
  let squareError = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const left = leftBuffer.readInt16LE(index * 2) - meanLeft;
    const right = rightBuffer.readInt16LE(index * 2) - meanRight;
    covariance += left * right;
    energyLeft += left * left;
    energyRight += right * right;
    squareError += (left - right) ** 2;
  }
  const correlation =
    covariance / Math.max(1, Math.sqrt(energyLeft * energyRight));
  const normalizedRmse =
    Math.sqrt(squareError / sampleCount) /
    Math.max(1, Math.sqrt(energyLeft / sampleCount));
  const rmsRatio = Math.sqrt(energyRight / Math.max(1, energyLeft));
  return {correlation, normalizedRmse, rmsRatio};
};

const runRegression = async () =>
  withStage('锁定基线视听回归', async () => {
    const candidate = resolveProjectPath(job.formal.finalOutput, '回归候选', true);
    const reference = resolveProjectPath(
      job.qualityReference.output,
      '锁定参考成片',
      true,
    );
    const referenceHash = await hashFile(reference);
    if (referenceHash !== job.qualityReference.sha256) {
      fail('锁定参考成片哈希与任务清单不一致');
    }

    const referenceProbe = probeMedia(reference);
    const candidateProbe = probeMedia(candidate);
    const durationDelta = Math.abs(
      Number(referenceProbe.format.duration) - Number(candidateProbe.format.duration),
    );
    const frameResults = [];
    for (const entry of riskFrameEntries()) {
      const ssim = compareFrameMetric(
        reference,
        candidate,
        entry.time,
        'ssim',
        /All:([0-9.]+)/,
      );
      const psnr = compareFrameMetric(
        reference,
        candidate,
        entry.time,
        'psnr',
        /average:([0-9.]+|inf)/i,
      );
      frameResults.push({time: entry.time, layerIds: entry.layerIds, ssim, psnr});
    }

    const cueSheet = verifySfxSources();
    const audioResults = [];
    for (const cue of cueSheet.cues ?? []) {
      const start = Math.max(0, Number(cue.start) - 0.1);
      const similarity = audioSimilarity(
        audioWindow(reference, start),
        audioWindow(candidate, start),
      );
      audioResults.push({
        cueId: cue.id,
        time: cue.start,
        correlation: similarity.correlation,
        normalizedRmse: similarity.normalizedRmse,
        rmsRatio: similarity.rmsRatio,
      });
    }

    const referenceLoudness = measureLoudness(reference, job.formal.loudness);
    const candidateLoudness = measureLoudness(candidate, job.formal.loudness);
    const failures = [];
    if (durationDelta > job.qualityReference.durationToleranceSeconds) {
      failures.push(`时长差 ${durationDelta.toFixed(3)} 秒`);
    }
    for (const frame of frameResults) {
      if (frame.ssim < job.qualityReference.minimumFrameSsim) {
        failures.push(`${frame.time}秒 SSIM=${frame.ssim}`);
      }
      if (frame.psnr < job.qualityReference.minimumFramePsnrDb) {
        failures.push(`${frame.time}秒 PSNR=${frame.psnr}`);
      }
    }
    for (const cue of audioResults) {
      const minimumCorrelation =
        job.qualityReference.minimumAudioCorrelation ?? 0.985;
      const maximumNormalizedRmse =
        job.qualityReference.maximumAudioNormalizedRmse ?? 0.18;
      const minimumRmsRatio = job.qualityReference.minimumAudioRmsRatio ?? 0.9;
      const maximumRmsRatio = job.qualityReference.maximumAudioRmsRatio ?? 1.1;
      if (
        cue.correlation < minimumCorrelation ||
        cue.normalizedRmse > maximumNormalizedRmse ||
        cue.rmsRatio < minimumRmsRatio ||
        cue.rmsRatio > maximumRmsRatio
      ) {
        failures.push(
          `${cue.time}秒音效窗口 correlation=${cue.correlation.toFixed(
            4,
          )}, nRMSE=${cue.normalizedRmse.toFixed(
            4,
          )}, RMS ratio=${cue.rmsRatio.toFixed(4)}`,
        );
      }
    }
    const loudnessDelta = Math.abs(
      referenceLoudness.input_i - candidateLoudness.input_i,
    );
    const truePeakDelta = Math.abs(
      referenceLoudness.input_tp - candidateLoudness.input_tp,
    );
    if (loudnessDelta > job.qualityReference.maximumIntegratedLoudnessDeltaLu) {
      failures.push(`响度差 ${loudnessDelta.toFixed(2)} LU`);
    }
    if (truePeakDelta > job.qualityReference.maximumTruePeakDeltaDb) {
      failures.push(`真峰值差 ${truePeakDelta.toFixed(2)} dB`);
    }

    const report = {
      schemaVersion: 1,
      jobId: job.jobId,
      reference: {
        path: relativeToProject(reference),
        sha256: referenceHash,
        durationSeconds: Number(referenceProbe.format.duration),
        integratedLoudnessLufs: referenceLoudness.input_i,
        truePeakDbtp: referenceLoudness.input_tp,
      },
      candidate: {
        path: relativeToProject(candidate),
        sha256: await hashFile(candidate),
        durationSeconds: Number(candidateProbe.format.duration),
        integratedLoudnessLufs: candidateLoudness.input_i,
        truePeakDbtp: candidateLoudness.input_tp,
      },
      durationDeltaSeconds: durationDelta,
      frameResults,
      audioResults,
      loudnessDeltaLu: loudnessDelta,
      truePeakDeltaDb: truePeakDelta,
      failures,
      status: failures.length ? 'failed' : 'passed',
      createdAt: new Date().toISOString(),
    };
    if (!dryRun) {
      writeJsonAtomic(reportPaths.regressionReport, report);
    }
    runManifest.regression = report;
    if (failures.length) {
      fail(`锁定基线回归未通过：\n- ${failures.join('\n- ')}`);
    }
    return report;
  });

const doctor = async () =>
  withStage('生产前置体检', async () => {
    validateJob();
    runCommand(
      process.execPath,
      ['tools/validate-visual-plan.mjs', job.inputs.visualPlan],
      {label: '视觉方案校验', runDuringDryRun: true},
    );
    if (job.experiment?.id === 'v73-media-sfx-speed') {
      runCommand(
        process.execPath,
        [
          'tools/validate-v73-production-contract.mjs',
          relativeToProject(jobPath),
        ],
        {label: 'V7.3生产合同校验', runDuringDryRun: true},
      );
    }
    if (job.experiment?.id === 'v8-semantic-continuity-sfx') {
      runCommand(
        process.execPath,
        [
          'tools/validate-v8-production-contract.mjs',
          relativeToProject(jobPath),
        ],
        {label: 'V8生产合同校验', runDuringDryRun: true},
      );
    }
    const riskFrames = riskFrameEntries();
    if (riskFrames.length < baseline.formalQa.keyframeReview.minimumCount) {
      fail(
        `风险帧只有 ${riskFrames.length} 个，低于基线 ${baseline.formalQa.keyframeReview.minimumCount} 个`,
      );
    }
    const cueSheet = verifySfxSources();
    await verifyLockedReference();
    console.log(
      `体检通过：当前生产档案、历史锁定母版、${riskFrames.length}个风险帧、${cueSheet.cues.length}个音效点`,
    );
  });

const ensureFingerprint = async () => {
  if (runManifest.fingerprint) {
    return;
  }
  await withStage('完整输入指纹', async () => {
    const result = await computeFingerprint();
    runManifest.fingerprint = result.fingerprint;
    runManifest.fingerprintFileCount = result.entries.length;
    runManifest.fingerprintFiles = result.entries;
    console.log(
      `输入指纹：${result.fingerprint}（${result.entries.length}个文件）`,
    );
  });
};

const execute = async () => {
  validateJob();
  runCommand(
    process.execPath,
    [
      'tools/validate-production-command-gate.mjs',
      relativeToProject(jobPath),
      command,
    ],
    {label: '生产命令门禁校验', runDuringDryRun: true},
  );
  runCommand(
    process.execPath,
    [
      'tools/validate-active-production-profile.mjs',
      relativeToProject(jobPath),
      command,
    ],
    {label: '当前生产档案校验', runDuringDryRun: true},
  );

  const needsDoctor = new Set(['doctor', 'prepare', 'formal', 'all']);
  const needsFingerprint = command !== 'doctor' || command === 'all';

  if (needsDoctor.has(command)) {
    await doctor();
  }
  if (needsFingerprint) {
    await ensureFingerprint();
  }

  if (command === 'fingerprint') return;
  if (command === 'preview' || command === 'prepare' || command === 'all') {
    await renderPreview();
  }
  if (command === 'risk-frames' || command === 'prepare' || command === 'all') {
    await renderRiskFrames();
  }
  if (
    command === 'audio-preflight' ||
    command === 'prepare' ||
    command === 'all'
  ) {
    await runAudioPreflight();
  }
  if (command === 'formal' || command === 'all') {
    await renderFormal();
    await runFormalQa();
  }
  if (command === 'formal-audio') {
    await normalizeFormalAudio();
    await runFormalQa();
  }
  if (command === 'qa') {
    await runFormalQa();
  }
  if (command === 'regression' || command === 'all') {
    await runRegression();
  }
};

try {
  persistRunReports();
  await execute();
  runManifest.status = 'passed';
  runManifest.finishedAt = new Date().toISOString();
  persistRunReports();
  console.log(`\n生产流程命令通过：${command}`);
} catch (error) {
  runManifest.status = 'failed';
  runManifest.finishedAt = new Date().toISOString();
  runManifest.error = error instanceof Error ? error.message : String(error);
  persistRunReports();
  console.error(`\n生产流程命令失败：${runManifest.error}`);
  process.exitCode = 1;
} finally {
  if (renderContext) {
    await renderContext.close();
  }
}
