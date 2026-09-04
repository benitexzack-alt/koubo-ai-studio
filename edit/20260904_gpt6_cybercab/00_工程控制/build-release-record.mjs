#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  createReadStream, existsSync, linkSync, lstatSync, readFileSync,
  readdirSync, unlinkSync, writeFileSync,
} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  assertProductionEntryPreflightV2, stableJsonSha256ForProductionGateV2,
} from '../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {
  validateReleaseProductionGateV2, RELEASE_PRODUCTION_GATE_SCHEMA,
  RELEASE_RISK_FRAME_RECEIPT_SCHEMA,
} from '../../../tools/release-production-gate-v2.mjs';
import {SCOPED_DIRECT_EXPORT as scope} from '../../../tools/scoped-direct-export-core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const base = 'edit/20260904_gpt6_cybercab';
const auditDirectory = `${base}/08_预览与质检/formal-r1/final-output-audit`;
const packageDirectory = `${base}/10_发布包`;
const releaseId = '20260905_gpt6_cybercab_v8_r1_v1';
const releasePath = `workflow/releases/${releaseId}.json`;
const pendingPath = `${releasePath}.pending`;
const riskReceiptPath = `${auditDirectory}/release-risk-frame-receipt.v2.json`;
const auditPath = `${auditDirectory}/正式成片机器质检回执.v1.json`;
const planPath = 'remotion/src/gpt6-cybercab-v8-r1/candidate-plan.v1.json';
const copyPath = `${packageDirectory}/发布包文字.v1.md`;
const copyReviewPath = `${packageDirectory}/发布包文字.copy_review.v1.json`;
const copyValidationPath = `${packageDirectory}/发布包文字.validation.v1.json`;
const coverPath = `${packageDirectory}/封面人物帧_正式片_0.000秒.png`;
const coverTime = 0;
const varianceOutputSha256 = '0bea66a552114f0b5272072435be631ce1c548b8f647aae87121dc34494c4372';
const shaPattern = /^[a-f0-9]{64}$/u;
const snapshots = new Map();
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');

function projectPath(value, mustExist = true) {
  assert(typeof value === 'string' && value.length > 0, '证据路径为空');
  const absolute = resolve(root, value);
  const rel = relative(root, absolute);
  assert(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `越界路径：${value}`);
  let cursor = root;
  for (const part of rel.split(sep)) {
    cursor = resolve(cursor, part);
    try {
      assert(!lstatSync(cursor).isSymbolicLink(), `禁止符号链接：${value}`);
    } catch (error) {
      if (error.code !== 'ENOENT' || mustExist) throw error;
    }
  }
  return absolute;
}

function sameStat(left, right) {
  return ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs'].every(key => left[key] === right[key]);
}

async function bind(value) {
  const absolute = projectPath(value);
  const path = relative(root, absolute).split(sep).join('/');
  const stat = lstatSync(absolute);
  assert(stat.isFile() && stat.size > 0, `证据不是非空普通文件：${path}`);
  if (snapshots.has(path)) {
    const cached = snapshots.get(path);
    assert(sameStat(cached.stat, stat), `取证过程中文件变化：${path}`);
    return cached.reference;
  }
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(absolute)) hash.update(chunk);
  assert(sameStat(stat, lstatSync(absolute)), `计算哈希时文件变化：${path}`);
  const reference = {path, sha256: hash.digest('hex'), bytes: stat.size};
  snapshots.set(path, {reference, stat});
  return reference;
}

async function readJson(value) {
  const reference = await bind(value);
  const bytes = readFileSync(projectPath(value));
  assert(hashBytes(bytes) === reference.sha256, `读取 JSON 时证据变化：${value}`);
  return {reference, body: JSON.parse(bytes.toString('utf8'))};
}

async function verifyReference(reference, expectedPath, sizeField = null) {
  assert(reference && shaPattern.test(reference.sha256), `缺少完整 SHA-256：${expectedPath}`);
  const actual = await bind(reference.path);
  assert(actual.path === expectedPath && actual.sha256 === reference.sha256, `证据路径或哈希不匹配：${expectedPath}`);
  if (sizeField) assert(actual.bytes === reference[sizeField], `证据字节数不匹配：${expectedPath}`);
  return actual;
}

// Use the same RGB24 decoding contract as release-production-gate/v2.
function pixels(path, atSeconds) {
  const result = spawnSync('ffmpeg', [
    '-v', 'error', '-ss', atSeconds.toFixed(6), '-i', projectPath(path),
    '-map', '0:v:0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
  ], {encoding: null, maxBuffer: 64 * 1024 * 1024, timeout: 120000});
  assert(result.status === 0 && Buffer.isBuffer(result.stdout) && result.stdout.length === 1920 * 1080 * 3,
    `无法解码完整分辨率像素：${path} @ ${atSeconds}；${result.error?.message ?? ''}`);
  return hashBytes(result.stdout);
}

function section(text, heading) {
  const lines = text.split(/\r?\n/u);
  const starts = lines.flatMap((line, index) => line === `## ${heading}` ? [index] : []);
  assert(starts.length === 1, `发布文字缺少唯一章节：${heading}`);
  const end = lines.findIndex((line, index) => index > starts[0] && line.startsWith('## '));
  const value = lines.slice(starts[0] + 1, end < 0 ? undefined : end).join('\n').trim();
  assert(value, `发布文字章节为空：${heading}`);
  return value;
}

export function validateKnownSpecVariance({audit, formalOutput, run, probe}) {
  const expectedErrors = ['视频规格不符合锁定版本', '时长偏差'];
  assert(audit.status === 'failed' && Array.isArray(audit.errors) && audit.errors.length === 2 &&
    expectedErrors.every(error => audit.errors.filter(value => value === error).length === 1),
  '只允许归档已知两项规格偏差，不能放行其他严格审计失败');
  assert(formalOutput.sha256 === varianceOutputSha256 && audit.output?.sha256 === varianceOutputSha256 &&
    run.formalQa?.sha256 === varianceOutputSha256 && audit.output.path === formalOutput.path &&
    run.formalQa.output === formalOutput.path && audit.output.sizeBytes === formalOutput.bytes &&
    run.formalQa.sizeBytes === formalOutput.bytes, '规格偏差仅绑定指定正式成片完整哈希及字节数');
  assert(run.status === 'passed' && run.formalQa.status === 'passed' &&
    Array.isArray(run.formalQa.errors) && run.formalQa.errors.length === 0 &&
    run.formalQa.blackFrameCount === 0 && audit.checks?.fullDecode === 'passed-by-controlled-runner' &&
    audit.checks.frameCount === 7830 && audit.checks.blackIntervals === 0 &&
    Array.isArray(audit.checks.signalEvents) && audit.checks.signalEvents.length === 0,
  '完整解码、黑场或信号检查存在其他异常，禁止按规格偏差归档');
  assert(Number.isFinite(run.formalQa.integratedLoudnessLufs) &&
    Math.abs(run.formalQa.integratedLoudnessLufs - (-16)) <= 0.5 &&
    Number.isFinite(run.formalQa.truePeakDbtp) && run.formalQa.truePeakDbtp <= -1.5,
  '主运行响度或真峰值未满足原门槛');
  assert(probe.streams?.length === 2 && probe.streams.filter(stream => stream.codec_type === 'video').length === 1 &&
    probe.streams.filter(stream => stream.codec_type === 'audio').length === 1, '实际媒体流数量或类型变化');
  const video = probe.streams.find(stream => stream.codec_type === 'video');
  const audio = probe.streams.find(stream => stream.codec_type === 'audio');
  const videoFields = {codec_type: 'video', codec_name: 'h264', profile: 'High', width: 1920, height: 1080,
    pix_fmt: 'yuvj420p', color_range: 'pc', color_space: 'bt470bg', r_frame_rate: '30/1', avg_frame_rate: '30/1'};
  const audioFields = {codec_type: 'audio', codec_name: 'aac', profile: 'LC', channels: 2, channel_layout: 'stereo'};
  for (const value of [audit.output.video, video]) {
    assert(value && Object.entries(videoFields).every(([key, expected]) => value[key] === expected) &&
      Number(value.duration) === 261 && Number(value.start_time) === 0 &&
      Number(value.nb_frames) === 7830 && Number(value.nb_read_frames) === 7830,
    '视频流不是已核实的 261 秒/7830 帧/H264 High/yuvj420p pc bt470bg');
  }
  for (const value of [audit.output.audio, audio]) {
    assert(value && Object.entries(audioFields).every(([key, expected]) => value[key] === expected) &&
      Number(value.sample_rate) === 48000 && Number(value.duration) === 261.1 && Number(value.start_time) === 0,
    '音频流不是已核实的 AAC LC/48kHz/双声道/261.100 秒');
  }
  assert(audit.output.durationSeconds === 261.1 && run.formalQa.durationSeconds === 261.1 &&
    Number(probe.format?.duration) === 261.1 && Number(probe.format?.size) === formalOutput.bytes,
  '容器时长或字节数不是已核实值');
  for (const key of ['codec_type', 'codec_name', 'width', 'height', 'pix_fmt', 'r_frame_rate', 'avg_frame_rate']) {
    assert(run.formalQa.video?.[key] === video[key], `主运行视频参数不一致：${key}`);
  }
  for (const key of ['codec_type', 'codec_name', 'sample_rate', 'channels']) {
    assert(run.formalQa.audio?.[key] === audio[key], `主运行音频参数不一致：${key}`);
  }
  return {status: 'awaiting-user-spec-confirmation', sourceStatus: audit.status,
    errors: [...audit.errors], formalOutputSha256: formalOutput.sha256,
    deviations: [
      {check: expectedErrors[0], expectedPixelFormat: 'yuv420p', actualPixelFormat: video.pix_fmt,
        colorRange: video.color_range, colorSpace: video.color_space},
      {check: expectedErrors[1], targetSeconds: 261, videoSeconds: Number(video.duration),
        audioSeconds: Number(audio.duration), containerSeconds: Number(probe.format.duration),
        strictToleranceSeconds: 0.1, controlledRunToleranceSeconds: 0.15},
    ], actualProbe: probe, userAccepted: false, releaseApproved: false};
}

function probeVarianceOutput(path) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format',
    '-of', 'json', projectPath(path)], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 600000});
  assert(result.status === 0 && !result.stderr?.trim(),
    `正式媒体重新探测或解码失败：${result.error?.message ?? result.stderr ?? ''}`);
  return JSON.parse(result.stdout);
}

async function main() {
  assert(process.argv.length === 2, '本脚本仅处理固定单条任务，不接受覆盖路径或放宽校验参数');
  for (const path of [releasePath, pendingPath, riskReceiptPath]) {
    assert(!existsSync(projectPath(path, false)), `拒绝覆盖已有记录：${path}`);
  }
  const {body: job, reference: jobReference} = await readJson(scope.jobPath);
  assert(job.jobId === scope.jobId && job.videoId === scope.episodeId &&
    job.productionGate?.revisionId === scope.revisionId && job.productionGate?.route === scope.route,
  '不是本条固定直出 job');
  const {body: run, reference: runReference} = await readJson(job.reports.runManifest);
  assert(run.schemaVersion === 1 && run.jobId === job.jobId && run.status === 'passed' &&
    run.dryRun === false && run.finishedAt && ['formal', 'formal-audio', 'qa'].includes(run.command) &&
    shaPattern.test(run.fingerprint) && run.formalQa?.status === 'passed' &&
    Array.isArray(run.formalQa.errors) && run.formalQa.errors.length === 0,
  '正式运行和正式 QA 尚未成功，禁止在渲染期间建立记录');
  const {body: baseline, reference: baselineReference} = await readJson(job.baseline.path);
  assert(baseline.baselineId === job.baseline.id, '基线身份不一致');
  assert(run.fingerprintFileCount === 105 && run.fingerprintFiles?.length === 105 &&
    new Set(run.fingerprintFiles.map(file => file.path)).size === 105, '正式运行的 105 项输入指纹不完整');
  for (const entry of run.fingerprintFiles) await verifyReference(entry, entry.path, 'sizeBytes');
  assert(stableJsonSha256ForProductionGateV2({job, baselineRevision: baseline.baselineRevision,
    files: run.fingerprintFiles}) === run.fingerprint, '当前 job 与完整输入指纹不一致');

  const preflight = assertProductionEntryPreflightV2({
    projectRoot: root, jobPath: projectPath(scope.jobPath), job,
    command: 'release-validation', entrypoint: 'tools/validate-release.mjs',
  });
  assert(preflight.route === scope.route && preflight.userPreviewApproved === false &&
    preflight.fullWatchConfirmed === false && preflight.publishAuthorized === false, '直出预检边界不一致');
  const {body: manifest, reference: manifestReference} = await readJson(scope.manifestPath);
  assert(manifestReference.sha256 === preflight.scopedDirectExportSha256, '固定直出清单与预检不一致');
  const authorizationReference = await verifyReference(manifest.authorization.evidence, manifest.authorization.evidence.path);
  const formalOutput = await verifyReference({path: run.formalQa.output, sha256: run.formalQa.sha256,
    sizeBytes: run.formalQa.sizeBytes}, job.formal.finalOutput, 'sizeBytes');
  const rawOutput = await bind(job.formal.rawOutput);

  const stageReceipts = {};
  for (const stageId of ['formal-render', 'formal-audio', 'formal-qa']) {
    const path = `${dirname(runReference.path)}/stage-success/${job.jobId}.${stageId}.json`;
    const {body, reference} = await readJson(path);
    assert(body.schemaVersion === 1 && body.status === 'passed' && body.jobId === job.jobId &&
      body.stageId === stageId && body.fingerprint === run.fingerprint && body.outputs?.length === 1,
    `阶段成功回执不完整：${stageId}`);
    await verifyReference(body.outputs[0], stageId === 'formal-render' ? rawOutput.path : formalOutput.path, 'sizeBytes');
    stageReceipts[stageId] = reference;
  }

  const {body: audit, reference: auditReference} = await readJson(auditPath);
  assert(audit.schemaVersion === 1 && audit.jobId === job.jobId &&
    ['machine-checked-awaiting-visual-review', 'failed'].includes(audit.status) && Array.isArray(audit.errors) &&
    audit.humanFullWatchConfirmed === false &&
    audit.humanAudioReviewCompleted === false && audit.published === false, '正式成片机器质检回执身份或状态无效');
  await verifyReference(audit.output, formalOutput.path, 'sizeBytes');
  await verifyReference(audit.controlledRender, runReference.path);
  assert(stableJsonSha256ForProductionGateV2(audit.controlledRender.result) ===
    stableJsonSha256ForProductionGateV2(run.formalQa), '质检回执引用的正式 QA 不是当前成功结果');
  const specVariance = audit.status === 'failed'
    ? validateKnownSpecVariance({audit, formalOutput, run, probe: probeVarianceOutput(formalOutput.path)})
    : null;
  if (!specVariance) assert(audit.errors.length === 0 && Math.abs(audit.output.durationSeconds - 261) <= 0.1,
    '严格审计没有通过，不得写成通过状态');
  assert(audit.checks?.fullDecode === 'passed-by-controlled-runner' && audit.checks.frameCount === 7830 &&
    audit.checks.paperCount === 6 && audit.checks.semanticContinuity === true &&
    audit.output.video?.width === 1920 && audit.output.video?.height === 1080 &&
    audit.output.video?.avg_frame_rate === '30/1',
  '正式成片规格或机器检查不完整');

  const {body: plan, reference: planReference} = await readJson(planPath);
  assert(plan.revision === scope.revisionId && plan.durationFrames === 7830 && plan.scenes?.length === 41 &&
    audit.frameEvidence?.length === 41, '缺少本版 41 段最终成片抽帧证据');
  const frames = [];
  for (const [index, scene] of plan.scenes.entries()) {
    const evidence = audit.frameEvidence[index];
    const frameIndex = Math.min(7829, Math.round((scene.start + Math.min(1, (scene.end - scene.start) / 2)) * 30));
    const atSeconds = frameIndex / 30;
    const expectedPath = `${auditDirectory}/frames/${String(index + 1).padStart(2, '0')}-${scene.id}-${frameIndex}.png`;
    assert(evidence.sceneId === scene.id && evidence.kind === scene.kind && evidence.frame === frameIndex &&
      Number.isFinite(evidence.timeSeconds) && Math.abs(evidence.timeSeconds - atSeconds) < 0.000001,
    `最终抽帧场景或时点不一致：${scene.id}`);
    const frameFile = await verifyReference(evidence, expectedPath);
    const pixelSha256 = pixels(formalOutput.path, atSeconds);
    assert(pixels(frameFile.path, 0) === pixelSha256, `抽帧不是正式成片当前像素：${scene.id}`);
    frames.push({...frameFile, sceneId: scene.id, frameIndex, atSeconds,
      sourceVideoSha256: formalOutput.sha256, pixelSha256});
  }

  const cover = {
    sourceVideo: formalOutput.path,
    sourceSha256: formalOutput.sha256,
    sourceType: 'current-final-video-real-frame',
    sourceTimeSeconds: coverTime,
  };
  const coverReference = await bind(coverPath);
  const coverPixelSha256 = pixels(formalOutput.path, coverTime);
  assert(pixels(coverPath, 0) === coverPixelSha256, '封面截图与正式片对应时刻像素不一致');

  const {body: review, reference: reviewReference} = await readJson(copyReviewPath);
  const {body: copyValidation, reference: copyValidationReference} = await readJson(copyValidationPath);
  assert(review.status === 'reviewed-text-only', '审稿状态已变化；本脚本不自行升级或改写审稿结论');
  const copyReference = await verifyReference(review.draft, copyPath);
  await verifyReference({path: copyValidation.draft_path, sha256: copyValidation.draft_sha256}, copyPath);
  await verifyReference({path: copyValidation.copy_review_path, sha256: copyValidation.copy_review_sha256}, copyReviewPath);
  assert(copyValidation.strict_copy_review_passed === false, '文字校验与待审边界不一致');
  const text = readFileSync(projectPath(copyPath), 'utf8');
  const startMarker = '<!-- PUBLIC_COPY_START -->';
  const endMarker = '<!-- PUBLIC_COPY_END -->';
  assert(text.split(startMarker).length === 2 && text.split(endMarker).length === 2 &&
    text.indexOf(endMarker) > text.indexOf(startMarker), '公开文字标记不完整或重复');
  const publicCopy = text.slice(text.indexOf(startMarker) + startMarker.length, text.indexOf(endMarker));
  const alternatives = section(publicCopy, '备选标题').split(/\r?\n/u).filter(line => line.trim()).map((line, index) => {
    assert(line.startsWith(`${index + 1}. `), '备选标题编号不一致');
    return line.slice(3).trim();
  });
  const topics = section(publicCopy, '话题').split(/\s+/u).map(topic => {
    assert(topic.startsWith('#') && topic.length > 1, '话题格式无效');
    return topic.slice(1);
  });
  const titles = {primary: section(publicCopy, '主标题'), alternatives};
  assert(alternatives.length === 2 && new Set([titles.primary, ...alternatives]).size === 3 &&
    topics.length > 0 && new Set(topics).size === topics.length, '标题或话题不完整');
  section(text, '3:4 真人截图合成封面提示词');

  const {body: policy, reference: policyReference} = await readJson(job.inputs.spokenSourcePolicy);
  assert(policy.knownLimitations?.some(item => item.id === 'C061-four-characters' &&
    item.status === 'awaiting-user-word-confirmation'), 'C061 待确认状态已变化，禁止沿用此待审记录');
  assert(stableJsonSha256ForProductionGateV2(policy.knownLimitations) ===
    stableJsonSha256ForProductionGateV2(audit.knownLimitations), '机器回执与当前字幕限制不一致');
  const inputPaths = {
    sourceVideo: job.inputs.source, renderProxy: job.inputs.renderProxy,
    transcript: job.inputs.transcript, bilingualCaptions: job.inputs.bilingualCaptions,
    spokenSourcePolicy: job.inputs.spokenSourcePolicy, visualPlan: job.inputs.visualPlan,
    sfxCueSheet: job.inputs.sfxCueSheet,
  };
  const inputBindings = {};
  for (const [key, path] of Object.entries(inputPaths)) inputBindings[key] = await bind(path);
  const assets = [...new Set(plan.scenes.filter(scene => scene.asset).map(scene =>
    `${job.remotion.publicDir}/${scene.asset}`))];
  const assetBindings = [];
  for (const asset of assets) assetBindings.push(await bind(asset));
  const packageFiles = [];
  for (const entry of readdirSync(projectPath(packageDirectory), {withFileTypes: true})) {
    assert(!entry.isSymbolicLink(), '发布包不得包含符号链接');
    if (entry.isFile()) packageFiles.push(await bind(`${packageDirectory}/${entry.name}`));
  }
  const template = 'templates/10-超哥AI创业记_3比4系列封面提示词母版.md';
  const templateReference = await bind(template);
  const doctor = run.stages?.find(stage => stage.name === '生产前置体检' && stage.status === 'passed');
  const blockers = [
    ...(specVariance ? [{id: 'strict-audit-spec-variance', evidence: auditReference, ...specVariance}] : []),
    {id: 'copy-review', status: review.status, evidence: reviewReference,
      details: copyValidation.strict_copy_review_errors},
    ...policy.knownLimitations,
    {id: 'final-visual-review', status: 'pending', evidence: auditReference},
    {id: 'human-audio-review', status: 'pending', evidence: auditReference},
    {id: 'user-full-watch', status: 'pending'},
    {id: 'publication-rights-and-facts', status: 'not-reviewed-by-this-script'},
  ];
  const now = new Date().toISOString();
  const riskReceipt = {
    schema: RELEASE_RISK_FRAME_RECEIPT_SCHEMA, createdAt: now, jobId: job.jobId,
    evidenceScope: 'real-final-output', status: 'pixels-verified-awaiting-visual-review',
    sourceVideo: {...formalOutput, fps: job.remotion.fps}, runManifest: runReference,
    machineAudit: auditReference, frames, humanVisualReviewCompleted: false,
  };
  const riskBytes = Buffer.from(`${JSON.stringify(riskReceipt, null, 2)}\n`);
  const riskReference = {path: riskReceiptPath, sha256: hashBytes(riskBytes), bytes: riskBytes.length};
  const release = {
    schemaVersion: 1, releaseId, createdAt: now, status: 'incomplete-delivery',
    videoId: job.videoId, baselineId: job.baseline.id, productionProfile: job.productionProfile,
    inputs: {...inputPaths, assets}, inputBindings, assetBindings,
    production: {
      formalOutput: formalOutput.path, rawOutput: rawOutput.path, previewOutput: null,
      coverPrompt: copyPath, soundEffectCueSheet: job.inputs.sfxCueSheet,
      modules: [...baseline.requiredModules, 'v8-continuous-semantic-information-on-speaker-scenes',
        'paper-source-video-with-text-baked-firstframes', 'real-media-presenter-inset',
        'inserted-native-audio-preserved', 'spoken-source-v1'],
      route: scope.route, revisionId: scope.revisionId,
    },
    productionGate: {
      schema: RELEASE_PRODUCTION_GATE_SCHEMA, route: scope.route, job: jobReference,
      jobSnapshotSha256: preflight.jobSnapshotSha256,
      scopedDirectExport: manifestReference, scopedDirectExportSha256: preflight.scopedDirectExportSha256,
      directorContractSha256: preflight.directorContractSha256,
      handoffBindingSha256: preflight.handoffBindingSha256, freezeReceiptSha256: preflight.freezeReceiptSha256,
      runManifest: runReference, runFingerprint: run.fingerprint, stageReceipts,
      formalOutput, previewOutput: null, riskFrameReceipt: riskReference,
    },
    deliveryPackage: {
      status: 'incomplete-delivery', directory: packageDirectory, releaseRecord: releasePath,
      cover: {
        aspectRatio: '3:4', recommendedFrame: coverReference.path, recommendedFrameSha256: coverReference.sha256,
        sourceVideo: formalOutput.path, sourceVideoSha256: formalOutput.sha256,
        sourceTimeSeconds: coverTime, sourceType: cover.sourceType, pixelSha256: coverPixelSha256,
        prompt: copyPath, promptSha256: copyReference.sha256, template, templateSha256: templateReference.sha256,
        visualReviewStatus: 'pending',
      },
      titles, douyin: {publishCopy: section(publicCopy, '发布文案'), topics},
      copyReview: copyReviewPath, copyReviewSha256: reviewReference.sha256, copyReviewStatus: review.status,
      copyValidation: copyValidationReference, qaReceipt: auditPath, qaReceiptSha256: auditReference.sha256,
      files: packageFiles, blockers,
    },
    qa: {
      technical: {status: specVariance ? 'checked-with-spec-variance' : run.formalQa.status,
        evidence: auditReference, strictAuditStatus: audit.status, strictAuditErrors: [...audit.errors],
        specVariance, controlledQa: run.formalQa},
      captionSync: {status: 'pending-user-confirmation', minimumScore: null,
        evidence: policyReference, unresolved: policy.knownLimitations},
      spokenSource: {status: 'passed', verifier: 'spoken-source-v1', evidence: policyReference,
        scope: '仅现有实录来源机器校验，不代表 C061 听辨或人工验收通过'},
      visualPlan: {status: doctor ? 'passed' : 'not-evidenced', evidence: runReference,
        stage: doctor ?? null, input: inputBindings.visualPlan, scope: '生产前置体检，不是最终画面验收'},
      keyframeReview: {status: 'pending-visual-review', frames: frames.map(frame => frame.atSeconds),
        evidence: riskReference, pixelProvenance: 'verified', humanVisualReviewCompleted: false},
      soundEffectAudibility: {status: 'pending-human-audio-review', userAudibilityConfirmed: false,
        machineEvidence: auditReference},
    },
    userReview: {
      directFinalAuthorized: true, formalRenderAuthorized: true, previewApproved: false,
      fullWatchConfirmed: false, transcriptMismatchAccepted: false, reviewOutcome: 'pending',
      authorizationKind: manifest.authorization.kind, authorizationEvidence: authorizationReference,
      directExportMessage: manifest.authorization.directExportMessage,
      skipPreviewMessage: manifest.authorization.skipPreviewMessage, independentSignature: false,
    },
    upgradeDecisions: [{id: scope.route, decision: 'applied', evidence: manifestReference,
      reason: '本条固定直出授权；不放宽历史冻结，不声称独立签名、预览或正式片人工验收'}],
    publish: {status: 'not-published', platform: '抖音', publishAuthorized: false,
      aiContentDisclosureRequired: true, materialRightsReviewRequired: true,
      publicReleasePerformed: false, externalUploadPerformed: false, publicUrl: null, platformPublicationId: null},
    evidence: {baseline: baselineReference, candidatePlan: planReference, machineAudit: auditReference,
      fingerprintFileCount: run.fingerprintFileCount, fingerprintFiles: run.fingerprintFiles,
      preflight, bindings: [...snapshots.values()].map(value => value.reference)},
    validation: {fullReleaseStatus: 'not-passed', expectedIncompleteItems: blockers,
      note: '生产证据门验证成功也不等于完整交付校验通过；本脚本不运行或伪造整包通过结果'},
  };

  for (const [path, snapshot] of snapshots) {
    assert(sameStat(snapshot.stat, lstatSync(projectPath(path))), `落盘前证据变化：${path}`);
  }
  // Validate a new pending record first; publish the record with an exclusive hard link.
  const created = [];
  let installed = false;
  let preserveFailedGate = false;
  try {
    writeFileSync(projectPath(riskReceiptPath, false), riskBytes, {flag: 'wx'});
    created.push(riskReceiptPath);
    writeFileSync(projectPath(pendingPath, false), `${JSON.stringify(release, null, 2)}\n`, {flag: 'wx'});
    created.push(pendingPath);
    const gate = validateReleaseProductionGateV2({projectRoot: root, releasePath: pendingPath, release});
    release.validation.productionGate = {...gate, status: gate.ok ? 'passed' : 'failed',
      evidenceScope: '生产证据门，不是严格规格审计或完整交付通过'};
    // The gate hashed the pending record before this result was appended.
    release.validation.productionGate.checkedRecordSha256 = gate.releaseSha256 ?? null;
    delete release.validation.productionGate.releaseSha256;
    writeFileSync(projectPath(pendingPath), `${JSON.stringify(release, null, 2)}\n`);
    if (!gate.ok) {
      preserveFailedGate = true;
      throw Object.assign(new Error(`发布生产门失败，保留 ${pendingPath} 及风险帧证据；不建立正式发布记录：${gate.message}`),
        {code: gate.code});
    }
    assert(gate.route === scope.route, '发布生产门未使用本条 scoped 路由');
    for (const [path, snapshot] of snapshots) {
      assert(sameStat(snapshot.stat, lstatSync(projectPath(path))), `发布生产门检查期间证据变化：${path}`);
    }
    linkSync(projectPath(pendingPath), projectPath(releasePath, false));
    installed = true;
    unlinkSync(projectPath(pendingPath));
    console.log(JSON.stringify({status: release.status, release: await bind(releasePath),
      riskFrameReceipt: riskReference, productionGate: gate.code, route: gate.route,
      technicalStatus: release.qa.technical.status, strictAuditStatus: audit.status, strictAuditErrors: audit.errors,
      fullReleaseValidation: 'not-passed', copyReviewStatus: review.status,
      unresolvedCaption: 'C061 [语音不清]', publishStatus: 'not-published'}, null, 2));
  } catch (error) {
    if (!installed && !preserveFailedGate) for (const path of created.reverse()) unlinkSync(projectPath(path));
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  console.error(`发布记录未建立或未完成：${error.code ?? 'RELEASE_BUILD_BLOCKED'}：${error.message}`);
  process.exitCode = 1;
});
