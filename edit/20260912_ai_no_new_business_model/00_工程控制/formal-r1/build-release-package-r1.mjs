#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  createReadStream,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  assertProductionEntryPreflightV2,
  stableJsonSha256ForProductionGateV2,
} from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {
  RELEASE_PRODUCTION_GATE_SCHEMA,
  RELEASE_RISK_FRAME_RECEIPT_SCHEMA,
  validateReleaseProductionGateV2,
} from '../../../../tools/release-production-gate-v2.mjs';
import {resolveScopedDirectExportProfile} from '../../../../tools/scoped-direct-export-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const COMMAND = process.argv[2] ?? 'prepare';
const ALLOWED_COMMANDS = new Set(['prepare', 'finalize']);

const EPISODE_ID = '20260912_ai_no_new_business_model';
const JOB_ID = '20260912-ai-no-new-business-model-v8-r1';
const REVISION_ID = 'ai-no-new-business-model-v8-r1';
const JOB_PATH = 'workflow/jobs/20260912_ai_no_new_business_model_v8_r1.production.json';
const RELEASE_ID = '20260913_ai_no_new_business_model_v8_r1_v1';
const RELEASE_PATH = `workflow/releases/${RELEASE_ID}.json`;
const CONTROL = `edit/${EPISODE_ID}/00_工程控制/formal-r1`;
const PACKAGE =
  `edit/${EPISODE_ID}/09_发布包/2026-09-13_AI并没有发明新的商业模式_V8_R1`;
const COPY_PATH = `${PACKAGE}/发布包装.md`;
const STANDALONE_PROMPT_PATH = `${PACKAGE}/3比4真人截图合成封面提示词.md`;
const COPY_REVIEW_PATH = `${PACKAGE}/发布包装.copy-review.json`;
const COPY_VALIDATION_PATH = `${PACKAGE}/发布包装.validation.v1.json`;
const COVER_TEMPLATE_PATH = 'templates/10-超哥AI创业记_3比4系列封面提示词母版.md';
const PACKAGED_FORMAL_PATH =
  `${PACKAGE}/AI并没有发明新的商业模式_16x9_V8_R1_有音效_正式候选_v1.mp4`;
const PACKAGED_COVER_PATH = `${PACKAGE}/本条成片真人截图_180秒.png`;
const PACKAGED_QA_PATH = `${PACKAGE}/正式全片机器质检回执.v1.json`;
const PACKAGED_RISK_PATH = `${PACKAGE}/正式成片风险帧回执.v2.json`;
const PACKAGED_VISUAL_REVIEW_PATH = `${PACKAGE}/正式成片视觉复核回执.v1.json`;
const PACKAGED_RELEASE_PATH = `${PACKAGE}/发布记录.v1.json`;
const PACKAGE_MANIFEST_PATH = `${PACKAGE}/发布包清单.v1.json`;
const PACKAGE_INTEGRITY_PATH = `${PACKAGE}/发布包完整性校验回执.v1.json`;
const COVER_TIME_SECONDS = 180;
const SHA256_RE = /^[a-f0-9]{64}$/u;
const MEDIA_EXTENSION_RE = /\.(?:gif|jpe?g|mov|mp4|ogv|png|svg|webp)$/iu;
const REQUIRED_VISUAL_CHECKS = Object.freeze([
  'coverFrameShowsCurrentSpeaker',
  'coverFrameIsCleanSpeakerFrame',
  'coverFaceUnobscured',
  'coverFrameSuitableForCrop',
  'riskFramesReviewedAtNormalScale',
  'noBlackOrCorruptFrame',
  'noInternalProductionLabelsVisible',
  'publicEvidencePresenterPipLowerLeft',
  'publicEvidenceSubtitlesDoNotCoverContent',
  'aiAndPaperInsertsUnaltered',
]);

const fail = (code, message, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
};
const assert = (condition, code, message, details = null) => {
  if (!condition) fail(code, message, details);
};
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const normalizeRelative = (absolutePath) => relative(ROOT, absolutePath).split(sep).join('/');

function projectPath(pathValue, {mustExist = true} = {}) {
  assert(
    isText(pathValue) && !isAbsolute(pathValue) && !pathValue.includes('\\'),
    'RELEASE_PATH',
    `只接受项目相对路径：${String(pathValue)}`,
  );
  const absolutePath = resolve(ROOT, pathValue);
  const normalized = normalizeRelative(absolutePath);
  assert(
    normalized === pathValue && normalized !== '..' && !normalized.startsWith('../'),
    'RELEASE_PATH',
    `路径不规范或越界：${pathValue}`,
  );
  let cursor = ROOT;
  for (const segment of pathValue.split('/')) {
    cursor = resolve(cursor, segment);
    if (existsSync(cursor)) {
      assert(!lstatSync(cursor).isSymbolicLink(), 'RELEASE_SYMLINK', `禁止符号链接：${pathValue}`);
    }
  }
  if (mustExist) {
    assert(existsSync(absolutePath), 'RELEASE_FILE_MISSING', `缺少文件：${pathValue}`);
    assert(realpathSync(absolutePath) === absolutePath, 'RELEASE_REALPATH', `真实路径不一致：${pathValue}`);
  }
  return absolutePath;
}

function projectRelativeFromAny(pathValue, label) {
  assert(isText(pathValue), 'RELEASE_BOUND_PATH', `${label}路径为空。`);
  const absolutePath = isAbsolute(pathValue) ? resolve(pathValue) : resolve(ROOT, pathValue);
  const relativePath = normalizeRelative(absolutePath);
  assert(
    relativePath && relativePath !== '..' && !relativePath.startsWith('../') && !isAbsolute(relativePath),
    'RELEASE_BOUND_PATH',
    `${label}必须位于当前口播项目：${pathValue}`,
  );
  projectPath(relativePath);
  return relativePath;
}

async function hashFile(absolutePath) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absolutePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}

const snapshots = new Map();
async function bind(pathValue) {
  const absolutePath = projectPath(pathValue);
  const before = statSync(absolutePath);
  assert(before.isFile() && before.size > 0, 'RELEASE_REGULAR_FILE', `必须是非空普通文件：${pathValue}`);
  const cached = snapshots.get(pathValue);
  if (cached && cached.size === before.size && cached.mtimeMs === before.mtimeMs) return cached.reference;
  const sha256 = await hashFile(absolutePath);
  const after = statSync(absolutePath);
  assert(
    before.dev === after.dev && before.ino === after.ino && before.size === after.size &&
      before.mtimeMs === after.mtimeMs,
    'RELEASE_FILE_CHANGED',
    `计算哈希时文件发生变化：${pathValue}`,
  );
  const reference = {path: pathValue, sha256, bytes: after.size};
  snapshots.set(pathValue, {reference, size: after.size, mtimeMs: after.mtimeMs});
  return reference;
}

async function readJsonBound(pathValue) {
  const reference = await bind(pathValue);
  let body;
  try {
    body = JSON.parse(readFileSync(projectPath(pathValue), 'utf8'));
  } catch (error) {
    fail('RELEASE_JSON', `JSON 无法读取：${pathValue}；${error.message}`);
  }
  return {body, reference};
}

function run(command, args, {label, encoding = 'utf8', timeout = 7_200_000, maxBuffer = 64 * 1024 * 1024} = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding,
    timeout,
    maxBuffer,
  });
  if (result.error || result.status !== 0) {
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const details = (result.error?.message ?? stderr) || stdout || `退出码 ${result.status}`;
    fail('RELEASE_COMMAND', `${label ?? command}失败：${details}`);
  }
  return result;
}

function writeBytesOnce(pathValue, bytes) {
  const absolutePath = projectPath(pathValue, {mustExist: false});
  if (existsSync(absolutePath)) {
    const current = readFileSync(absolutePath);
    assert(
      current.equals(bytes),
      'RELEASE_REFUSE_OVERWRITE',
      `拒绝覆盖内容不同的既有证据：${pathValue}`,
    );
    return false;
  }
  mkdirSync(dirname(absolutePath), {recursive: true});
  writeFileSync(absolutePath, bytes, {flag: 'wx'});
  return true;
}

function writeJsonOnce(pathValue, value) {
  return writeBytesOnce(pathValue, Buffer.from(stableJson(value)));
}

function rawFrame(pathValue, atSeconds) {
  const result = run(
    'ffmpeg',
    [
      '-v', 'error',
      '-ss', Number(atSeconds).toFixed(6),
      '-i', projectPath(pathValue),
      '-map', '0:v:0',
      '-frames:v', '1',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgb24',
      'pipe:1',
    ],
    {label: `读取帧解码 ${pathValue}@${atSeconds}`, encoding: null, maxBuffer: 96 * 1024 * 1024},
  );
  assert(Buffer.isBuffer(result.stdout) && result.stdout.length > 0, 'RELEASE_FRAME', '帧像素为空。');
  return {sha256: sha256Bytes(result.stdout), bytes: result.stdout.length};
}

async function extractFrameOnce({source, atSeconds, output}) {
  const sourcePixels = rawFrame(source, atSeconds);
  const absoluteOutput = projectPath(output, {mustExist: false});
  if (!existsSync(absoluteOutput)) {
    mkdirSync(dirname(absoluteOutput), {recursive: true});
    const temporary = `${absoluteOutput}.tmp-${process.pid}${extname(absoluteOutput) || '.png'}`;
    try {
      run(
        'ffmpeg',
        [
          '-v', 'error', '-y',
          '-ss', Number(atSeconds).toFixed(6),
          '-i', projectPath(source),
          '-map', '0:v:0',
          '-frames:v', '1',
          '-pix_fmt', 'rgb24',
          temporary,
        ],
        {label: `抽取正式片帧 ${atSeconds.toFixed(3)}秒`},
      );
      renameSync(temporary, absoluteOutput);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  const imagePixels = rawFrame(output, 0);
  assert(
    sourcePixels.sha256 === imagePixels.sha256 && sourcePixels.bytes === imagePixels.bytes,
    'RELEASE_FRAME_PIXEL_MISMATCH',
    `静帧不是正式成片对应时点的同一像素：${output}`,
  );
  return {...(await bind(output)), pixelSha256: sourcePixels.sha256, pixelBytes: sourcePixels.bytes};
}

function probeFormal(pathValue) {
  const result = run(
    'ffprobe',
    [
      '-v', 'error',
      '-count_frames',
      '-show_streams',
      '-show_format',
      '-of', 'json',
      projectPath(pathValue),
    ],
    {label: '正式 MP4 ffprobe', maxBuffer: 16 * 1024 * 1024},
  );
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail('RELEASE_FFPROBE_JSON', `ffprobe 输出无法解析：${error.message}`);
  }
}

function assertProbe({probe, job, formal}) {
  const videos = probe.streams?.filter((stream) => stream.codec_type === 'video') ?? [];
  const audios = probe.streams?.filter((stream) => stream.codec_type === 'audio') ?? [];
  assert(videos.length === 1 && audios.length === 1 && probe.streams.length === 2,
    'RELEASE_STREAMS', '正式 MP4 必须且只能包含一条视频流和一条音频流。');
  const video = videos[0];
  const audio = audios[0];
  const duration = Number(probe.format?.duration);
  const expectedFrames = Math.round(job.remotion.durationSeconds * job.remotion.fps);
  assert(video.codec_name === 'h264', 'RELEASE_VIDEO_CODEC', `视频编码不是 H.264：${video.codec_name}`);
  assert(audio.codec_name === 'aac', 'RELEASE_AUDIO_CODEC', `音频编码不是 AAC：${audio.codec_name}`);
  assert(video.width === job.remotion.width && video.height === job.remotion.height,
    'RELEASE_DIMENSIONS', `正式片分辨率错误：${video.width}x${video.height}`);
  assert(video.avg_frame_rate === `${job.remotion.fps}/1`,
    'RELEASE_FPS', `正式片帧率错误：${video.avg_frame_rate}`);
  assert(Number(audio.sample_rate) === 48000 && Number(audio.channels) === 2,
    'RELEASE_AUDIO_STREAM', '正式片必须为 AAC 48kHz 双声道。');
  assert(Number.isFinite(duration) && Math.abs(duration - job.remotion.durationSeconds) <= 0.15,
    'RELEASE_DURATION', `正式片时长偏差：${duration}秒。`);
  assert(Number(video.nb_read_frames) === expectedFrames,
    'RELEASE_FRAME_COUNT', `正式片实际解码帧数 ${video.nb_read_frames}，预期 ${expectedFrames}。`);
  assert(Number(probe.format?.size) === formal.bytes,
    'RELEASE_PROBE_SIZE', 'ffprobe 容器字节数与正式文件不一致。');
  return {video, audio, duration, expectedFrames};
}

async function verifyRunFingerprint({job, runManifest, baseline}) {
  assert(
    Array.isArray(runManifest.fingerprintFiles) && runManifest.fingerprintFiles.length > 0 &&
      runManifest.fingerprintFileCount === runManifest.fingerprintFiles.length,
    'RELEASE_FINGERPRINT',
    '正式运行清单缺少完整输入指纹文件。',
  );
  assert(
    new Set(runManifest.fingerprintFiles.map((item) => item.path)).size ===
      runManifest.fingerprintFiles.length,
    'RELEASE_FINGERPRINT',
    '正式运行输入指纹存在重复路径。',
  );
  for (const entry of runManifest.fingerprintFiles) {
    assert(isText(entry.path) && SHA256_RE.test(String(entry.sha256 ?? '')),
      'RELEASE_FINGERPRINT', '输入指纹项缺少路径或 SHA-256。');
    const current = await bind(entry.path);
    assert(current.sha256 === entry.sha256 && current.bytes === Number(entry.sizeBytes),
      'RELEASE_FINGERPRINT_CHANGED', `正式运行后输入已变化：${entry.path}`);
  }
  const current = stableJsonSha256ForProductionGateV2({
    job,
    baselineRevision: baseline.baselineRevision,
    files: runManifest.fingerprintFiles,
  });
  assert(current === runManifest.fingerprint,
    'RELEASE_FINGERPRINT_CHANGED', '当前 job、基线或输入闭包与正式运行指纹不一致。');
}

async function loadFormalEvidence({fullDecode}) {
  const {body: job, reference: jobReference} = await readJsonBound(JOB_PATH);
  assert(job.jobId === JOB_ID && job.videoId === EPISODE_ID &&
      job.productionGate?.revisionId === REVISION_ID,
    'RELEASE_JOB_SCOPE', '不是本期固定正式生产 job。');
  const profile = resolveScopedDirectExportProfile({job, jobPath: JOB_PATH});
  assert(profile.episodeId === EPISODE_ID && profile.jobId === JOB_ID &&
      profile.revisionId === REVISION_ID,
    'RELEASE_PROFILE_SCOPE', 'scoped direct-export profile 没有精确绑定本期。');
  const {body: scopedManifest, reference: scopedManifestReference} =
    await readJsonBound(profile.manifestPath);

  let preflight;
  try {
    preflight = assertProductionEntryPreflightV2({
      projectRoot: ROOT,
      jobPath: projectPath(JOB_PATH),
      job,
      command: 'release-validation',
      entrypoint: 'tools/validate-release.mjs',
    });
  } catch (error) {
    fail(error?.code ?? 'RELEASE_PREFLIGHT', `正式生产门禁未通过：${error.message}`);
  }
  assert(preflight.route === profile.route && preflight.userPreviewApproved === false &&
      preflight.fullWatchConfirmed === false && preflight.publishAuthorized === false,
    'RELEASE_PREFLIGHT_STATE', '直出边界必须保持未预览确认、未完整观看、未授权发布。');
  assert(scopedManifestReference.sha256 === preflight.scopedDirectExportSha256 &&
      scopedManifest.authorization?.kind === 'verified-user-direct-export',
    'RELEASE_SCOPED_MANIFEST', '正式预检没有绑定当前固定直出清单及真实用户直出授权。');

  const {body: baseline, reference: baselineReference} = await readJsonBound(job.baseline.path);
  assert(baseline.baselineId === job.baseline.id && baseline.baselineRevision === job.baseline.revision,
    'RELEASE_BASELINE', '正式 job 与生产基线不一致。');
  const {body: visualPlan, reference: visualPlanReference} = await readJsonBound(job.inputs.visualPlan);
  const {body: runManifest, reference: runManifestReference} =
    await readJsonBound(job.reports.runManifest);
  assert(runManifest.schemaVersion === 1 && runManifest.jobId === JOB_ID &&
      runManifest.status === 'passed' && runManifest.dryRun === false &&
      ['formal', 'formal-audio'].includes(runManifest.command) && isText(runManifest.finishedAt) &&
      runManifest.formalQa?.status === 'passed' &&
      Array.isArray(runManifest.formalQa?.errors) && runManifest.formalQa.errors.length === 0,
    'RELEASE_FORMAL_RUN', '正式渲染、响度处理和机器 QA 尚未完整通过。');
  await verifyRunFingerprint({job, runManifest, baseline});

  const formal = await bind(job.formal.finalOutput);
  const raw = await bind(job.formal.rawOutput);
  assert(runManifest.formalQa.output === formal.path &&
      runManifest.formalQa.sha256 === formal.sha256 &&
      Number(runManifest.formalQa.sizeBytes) === formal.bytes,
    'RELEASE_FORMAL_BINDING', '正式 QA 没有绑定当前正式 MP4 的路径、哈希和字节数。');
  assert(Number(runManifest.formalQa.blackFrameCount) === 0,
    'RELEASE_BLACK_FRAME', '正式 QA 检测到黑帧。');
  assert(Math.abs(Number(runManifest.formalQa.integratedLoudnessLufs) - (-16)) <= 0.5,
    'RELEASE_LOUDNESS', `正式片响度不符合 -16±0.5 LUFS：${runManifest.formalQa.integratedLoudnessLufs}`);
  assert(Number(runManifest.formalQa.truePeakDbtp) <= -1.5,
    'RELEASE_TRUE_PEAK', `正式片真峰值超过 -1.5 dBTP：${runManifest.formalQa.truePeakDbtp}`);

  const stageReceipts = {};
  const stageRoot = `${dirname(job.reports.runManifest)}/stage-success`;
  for (const stageId of ['formal-render', 'formal-audio', 'formal-qa']) {
    const stagePath = `${stageRoot}/${JOB_ID}.${stageId}.json`;
    const {body, reference} = await readJsonBound(stagePath);
    assert(body.schemaVersion === 1 && body.status === 'passed' && body.jobId === JOB_ID &&
        body.stageId === stageId && body.fingerprint === runManifest.fingerprint &&
        Array.isArray(body.outputs) && body.outputs.length === 1,
      'RELEASE_STAGE_RECEIPT', `阶段成功回执无效：${stageId}`);
    const expected = stageId === 'formal-render' ? raw : formal;
    const output = body.outputs[0];
    assert(output.path === expected.path && output.sha256 === expected.sha256 &&
        Number(output.sizeBytes) === expected.bytes,
      'RELEASE_STAGE_OUTPUT', `阶段回执未绑定当前产物：${stageId}`);
    stageReceipts[stageId] = reference;
  }

  const probe = probeFormal(formal.path);
  const probeSummary = assertProbe({probe, job, formal});
  if (fullDecode) {
    run(
      'ffmpeg',
      ['-v', 'error', '-i', projectPath(formal.path), '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'],
      {label: '正式 MP4 完整音视频解码'},
    );
  }
  run(process.execPath, ['tools/validate-visual-plan.mjs', job.inputs.visualPlan], {
    label: '正式视觉计划校验',
  });

  return {
    job,
    jobReference,
    profile,
    scopedManifest,
    scopedManifestReference,
    preflight,
    baseline,
    baselineReference,
    visualPlan,
    visualPlanReference,
    runManifest,
    runManifestReference,
    stageReceipts,
    formal,
    raw,
    probe,
    probeSummary,
  };
}

function reviewFrameEntries({visualPlan, durationSeconds, fps, frameCount}) {
  const entries = [
    {id: 'hook', time: 1},
    ...(visualPlan.layers ?? []).map((layer) => ({
      id: String(layer.id ?? 'visual'),
      time: Number(layer.checks?.reviewAt),
    })),
    {id: 'cover-speaker-candidate', time: COVER_TIME_SECONDS},
    {id: 'cta', time: Math.max(0, durationSeconds - 1)},
  ];
  const byFrame = new Map();
  for (const entry of entries) {
    assert(Number.isFinite(entry.time) && entry.time >= 0 && entry.time <= durationSeconds,
      'RELEASE_REVIEW_TIME', `风险帧时点无效：${entry.id}=${entry.time}`);
    const frameIndex = Math.min(frameCount - 1, Math.max(0, Math.round(entry.time * fps)));
    const item = byFrame.get(frameIndex) ?? {frameIndex, ids: []};
    item.ids.push(entry.id);
    byFrame.set(frameIndex, item);
  }
  return [...byFrame.values()]
    .sort((left, right) => left.frameIndex - right.frameIndex)
    .map((item) => ({...item, atSeconds: item.frameIndex / fps}));
}

function assertCoverIsSpeakerByPlan({visualPlan, fps}) {
  const frame = Math.round(COVER_TIME_SECONDS * fps);
  const activeFullScreen = (visualPlan.actualRuntimeInventory ?? []).filter((item) =>
    Number(item.startFrame) <= frame && frame < Number(item.endFrameExclusive) &&
    ['image', 'video'].includes(String(item.kind ?? '')),
  );
  assert(activeFullScreen.length === 0, 'RELEASE_COVER_PLAN',
    `180秒仍处于全屏插片，不能作为真人封面候选：${activeFullScreen.map((item) => item.id).join('、')}`);
}

function createContactSheetOnce({frameDirectory, output, count}) {
  const absoluteOutput = projectPath(output, {mustExist: false});
  if (existsSync(absoluteOutput)) return;
  const rows = Math.ceil(count / 4);
  mkdirSync(dirname(absoluteOutput), {recursive: true});
  const temporary = `${absoluteOutput}.tmp-${process.pid}.jpg`;
  try {
    run(
      'ffmpeg',
      [
        '-v', 'error', '-y',
        '-framerate', '1',
        '-pattern_type', 'glob',
        '-i', `${projectPath(frameDirectory)}/*.png`,
        '-vf', `scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2:0x111827,tile=4x${rows}:padding=8:margin=8:color=0x111827`,
        '-frames:v', '1',
        '-q:v', '2',
        temporary,
      ],
      {label: '生成正式片风险帧联系表'},
    );
    renameSync(temporary, absoluteOutput);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

async function prepareRelease() {
  // All read-only production checks run before this function writes the first artifact.
  const evidence = await loadFormalEvidence({fullDecode: true});
  const artifactRoot = `${CONTROL}/release-artifacts/${evidence.formal.sha256}`;
  const frameDirectory = `${artifactRoot}/risk-frames`;
  const qaPath = `${artifactRoot}/formal-output-machine-qa.v1.json`;
  const riskPath = `${artifactRoot}/release-risk-frame-receipt.v2.json`;
  const contactPath = `${artifactRoot}/risk-frame-contact-sheet.jpg`;
  const coverCandidatePath = `${artifactRoot}/cover-candidate-180.000s.png`;
  const requestPath = `${artifactRoot}/final-output-visual-review.request.v1.json`;
  const reviewPath = `${artifactRoot}/final-output-visual-review.v1.json`;
  const preparationPath = `${artifactRoot}/release-preparation-receipt.v1.json`;
  const createdAt = evidence.runManifest.finishedAt;

  assertCoverIsSpeakerByPlan({visualPlan: evidence.visualPlan, fps: evidence.job.remotion.fps});
  const reviewEntries = reviewFrameEntries({
    visualPlan: evidence.visualPlan,
    durationSeconds: evidence.probeSummary.duration,
    fps: evidence.job.remotion.fps,
    frameCount: evidence.probeSummary.expectedFrames,
  });
  assert(reviewEntries.length >= Number(evidence.baseline.formalQa?.keyframeReview?.minimumCount ?? 8),
    'RELEASE_REVIEW_COUNT', '正式片风险帧数量低于生产基线。');

  const frames = [];
  for (const [index, entry] of reviewEntries.entries()) {
    const safeId = entry.ids.join('-').replaceAll(/[^A-Za-z0-9_-]/gu, '').slice(0, 80) || 'frame';
    const output = `${frameDirectory}/${String(index + 1).padStart(2, '0')}-${safeId}-${entry.frameIndex}.png`;
    const frame = await extractFrameOnce({
      source: evidence.formal.path,
      atSeconds: entry.atSeconds,
      output,
    });
    frames.push({
      ...frame,
      sceneId: entry.ids.join('+'),
      frameIndex: entry.frameIndex,
      atSeconds: entry.atSeconds,
      sourceVideoSha256: evidence.formal.sha256,
      pixelSha256: frame.pixelSha256,
    });
    delete frames.at(-1).pixelBytes;
  }
  const coverCandidate = await extractFrameOnce({
    source: evidence.formal.path,
    atSeconds: COVER_TIME_SECONDS,
    output: coverCandidatePath,
  });
  createContactSheetOnce({frameDirectory, output: contactPath, count: frames.length});
  const contactSheet = await bind(contactPath);

  const qaReceipt = {
    schemaVersion: 1,
    schema: 'koubo-formal-output-machine-qa/v1',
    episodeId: EPISODE_ID,
    jobId: JOB_ID,
    createdAt,
    status: 'passed-machine-technical-qa',
    scope: '正式 MP4 的受控运行、ffprobe、完整音视频解码、黑帧、响度和真峰值；不冒充人工视觉复核、完整观看或发布授权',
    output: evidence.formal,
    controlledRun: evidence.runManifestReference,
    stageReceipts: evidence.stageReceipts,
    productionPreflight: {
      route: evidence.preflight.route,
      jobSnapshotSha256: evidence.preflight.jobSnapshotSha256,
      directorContractSha256: evidence.preflight.directorContractSha256,
      handoffBindingSha256: evidence.preflight.handoffBindingSha256,
      freezeReceiptSha256: evidence.preflight.freezeReceiptSha256,
      scopedDirectExportSha256: evidence.preflight.scopedDirectExportSha256,
    },
    checks: {
      ffprobe: 'passed',
      fullVideoAndAudioDecode: 'passed',
      streamCount: 'passed-one-video-one-audio',
      h264Aac1920x1080At30Fps: 'passed',
      frameCount: evidence.probeSummary.expectedFrames,
      blackFrameIntervals: evidence.runManifest.formalQa.blackFrameCount,
      integratedLoudnessLufs: evidence.runManifest.formalQa.integratedLoudnessLufs,
      loudnessRangeLu: evidence.runManifest.formalQa.loudnessRangeLu,
      truePeakDbtp: evidence.runManifest.formalQa.truePeakDbtp,
    },
    actualProbe: evidence.probe,
    humanFullWatchConfirmed: false,
    published: false,
  };
  writeJsonOnce(qaPath, qaReceipt);
  const qaReference = await bind(qaPath);

  const riskReceipt = {
    schema: RELEASE_RISK_FRAME_RECEIPT_SCHEMA,
    createdAt,
    jobId: JOB_ID,
    evidenceScope: 'real-final-output',
    status: 'pixels-verified-awaiting-independent-visual-review',
    sourceVideo: {...evidence.formal, fps: evidence.job.remotion.fps},
    runManifest: evidence.runManifestReference,
    machineAudit: qaReference,
    frames,
    humanVisualReviewCompleted: false,
  };
  writeJsonOnce(riskPath, riskReceipt);
  const riskReference = await bind(riskPath);

  const reviewRequest = {
    schemaVersion: 'koubo-final-output-visual-review-request/v1',
    episodeId: EPISODE_ID,
    jobId: JOB_ID,
    createdAt,
    status: 'awaiting-independent-visual-review',
    sourceVideo: evidence.formal,
    machineQa: qaReference,
    riskFrameReceipt: riskReference,
    contactSheet,
    reviewedFrameCountRequired: frames.length,
    coverCandidate: {
      path: coverCandidate.path,
      sha256: coverCandidate.sha256,
      bytes: coverCandidate.bytes,
      sourceTimeSeconds: COVER_TIME_SECONDS,
      sourceVideoSha256: evidence.formal.sha256,
      pixelSha256: coverCandidate.pixelSha256,
      machinePlanCheck: 'speaker-window-no-full-screen-insert',
    },
    requiredChecks: REQUIRED_VISUAL_CHECKS,
    expectedReviewPath: reviewPath,
    hardBoundary: {
      scriptDoesNotApproveVisuals: true,
      userFullWatchConfirmed: false,
      publicReleaseAuthorized: false,
      note: '需由主任务实际查看180秒截图和正式风险帧联系表后另写复核回执；本构建器不会自行把待复核升级为通过。',
    },
  };
  writeJsonOnce(requestPath, reviewRequest);
  const requestReference = await bind(requestPath);

  writeJsonOnce(reviewPath, {
    schemaVersion: 'koubo-final-output-visual-review/v1',
    episodeId: EPISODE_ID,
    jobId: JOB_ID,
    status: 'awaiting-independent-visual-review',
    reviewedAt: null,
    reviewerType: null,
    userFullWatchConfirmed: false,
    userReviewClaimed: false,
    publicReleaseAuthorized: false,
    request: requestReference,
    sourceVideo: evidence.formal,
    riskFrameReceipt: riskReference,
    coverCandidate: {
      path: coverCandidate.path,
      sha256: coverCandidate.sha256,
      bytes: coverCandidate.bytes,
      sourceTimeSeconds: COVER_TIME_SECONDS,
      sourceVideoSha256: evidence.formal.sha256,
      pixelSha256: coverCandidate.pixelSha256,
    },
    reviewedFrameCount: 0,
    checks: Object.fromEntries(REQUIRED_VISUAL_CHECKS.map((key) => [key, false])),
    notes: '',
  });

  const preparationReceipt = {
    schemaVersion: 'koubo-release-preparation-receipt/v1',
    episodeId: EPISODE_ID,
    jobId: JOB_ID,
    createdAt,
    status: 'prepared-awaiting-independent-visual-review',
    formalOutput: evidence.formal,
    machineQa: qaReference,
    riskFrameReceipt: riskReference,
    visualReviewRequest: requestReference,
    expectedVisualReview: reviewPath,
    coverCandidate: {
      path: coverCandidate.path,
      sha256: coverCandidate.sha256,
      bytes: coverCandidate.bytes,
      pixelSha256: coverCandidate.pixelSha256,
      sourceTimeSeconds: COVER_TIME_SECONDS,
    },
    contactSheet,
    releaseRecordCreated: false,
    packageFinalized: false,
    fullWatchConfirmed: false,
    published: false,
  };
  writeJsonOnce(preparationPath, preparationReceipt);

  console.log(JSON.stringify({
    status: preparationReceipt.status,
    formalOutput: evidence.formal,
    machineQa: qaPath,
    riskFrameReceipt: riskPath,
    riskFrameCount: frames.length,
    coverCandidate: coverCandidatePath,
    contactSheet: contactPath,
    visualReviewRequest: requestPath,
    expectedVisualReview: reviewPath,
    nextCommand: `node ${CONTROL}/build-release-package-r1.mjs finalize`,
    releaseCreated: false,
  }, null, 2));
}

function markdownSection(text, heading) {
  const lines = text.split(/\r?\n/u);
  const starts = lines.flatMap((line, index) => line.trim() === `## ${heading}` ? [index] : []);
  assert(starts.length === 1, 'RELEASE_COPY_SECTION', `发布包装缺少唯一章节：${heading}`);
  const end = lines.findIndex((line, index) => index > starts[0] && line.startsWith('## '));
  const value = lines.slice(starts[0] + 1, end < 0 ? undefined : end).join('\n').trim();
  assert(isText(value), 'RELEASE_COPY_SECTION', `发布包装章节为空：${heading}`);
  return value;
}

async function loadCopyPackage(activeProfile) {
  const copyReference = await bind(COPY_PATH);
  const promptReference = await bind(STANDALONE_PROMPT_PATH);
  const {body: review, reference: reviewReference} = await readJsonBound(COPY_REVIEW_PATH);
  assert(review.status === 'passed', 'RELEASE_COPY_REVIEW_PENDING',
    `双 Skill 审稿尚未通过，当前状态=${review.status ?? 'missing'}；构建器不会自行升级。`);
  const reviewDraftPath = projectRelativeFromAny(review.draft?.path, 'copyReview.draft');
  assert(reviewDraftPath === COPY_PATH && review.draft?.sha256 === copyReference.sha256,
    'RELEASE_COPY_REVIEW_STALE', '双 Skill 审稿没有绑定当前发布包装及 SHA-256。');
  const reviewPromptPath = projectRelativeFromAny(review.cover_prompt?.path, 'copyReview.cover_prompt');
  assert(reviewPromptPath === STANDALONE_PROMPT_PATH &&
      review.cover_prompt?.sha256 === promptReference.sha256,
    'RELEASE_COPY_REVIEW_STALE', '双 Skill 审稿没有绑定当前独立封面提示词。');
  for (const [key, label] of [
    ['humanizer_zh', 'humanizer-zh'],
    ['humanize_koubo_script', 'humanize-koubo-script'],
  ]) {
    const skill = review.skills?.[key];
    assert(skill?.read === true && isText(skill.path) && SHA256_RE.test(String(skill.sha256 ?? '')),
      'RELEASE_COPY_SKILL', `双 Skill 审稿缺少已读取的 ${label}。`);
    const skillPath = isAbsolute(skill.path) ? resolve(skill.path) : resolve(ROOT, skill.path);
    assert(existsSync(skillPath) && statSync(skillPath).isFile(),
      'RELEASE_COPY_SKILL', `${label} 当前文件不存在。`);
    const currentSha = await hashFile(skillPath);
    assert(currentSha === skill.sha256, 'RELEASE_COPY_SKILL_STALE', `${label} 哈希已经变化。`);
  }
  assert(Number(review.scores?.fact_fidelity) === 10,
    'RELEASE_COPY_FACT_FIDELITY', '发布包装事实保真必须为 10/10。');

  const text = readFileSync(projectPath(COPY_PATH), 'utf8');
  const startMarker = '<!-- PUBLIC_COPY_START -->';
  const endMarker = '<!-- PUBLIC_COPY_END -->';
  assert(text.split(startMarker).length === 2 && text.split(endMarker).length === 2 &&
      text.indexOf(endMarker) > text.indexOf(startMarker),
    'RELEASE_COPY_MARKERS', '发布包装 PUBLIC_COPY 标记缺失或重复。');
  const publicCopy = text.slice(text.indexOf(startMarker) + startMarker.length, text.indexOf(endMarker));
  const primary = markdownSection(publicCopy, '主标题');
  const alternatives = markdownSection(publicCopy, '备选标题')
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) => {
      assert(line.startsWith(`${index + 1}. `), 'RELEASE_COPY_TITLES', '备选标题编号不连续。');
      return line.slice(line.indexOf(' ') + 1).trim();
    });
  const topics = markdownSection(publicCopy, '话题').split(/\s+/u).map((topic) => {
    assert(topic.startsWith('#') && topic.length > 1, 'RELEASE_COPY_TOPICS', `话题格式错误：${topic}`);
    return topic.slice(1);
  });
  assert(alternatives.length >= 2 && new Set([primary, ...alternatives]).size === 1 + alternatives.length,
    'RELEASE_COPY_TITLES', '主标题和两个备选标题必须完整且不重复。');
  assert(new Set(topics).size === topics.length, 'RELEASE_COPY_TOPICS', '发布话题不得重复。');
  const publishCopy = markdownSection(publicCopy, '抖音发布文案');
  assert(publishCopy.includes('本视频含AI生成画面'),
    'RELEASE_AI_DISCLOSURE', '发布文案必须保留本视频含 AI 生成画面的明确说明。');
  const standalonePrompt = readFileSync(projectPath(STANDALONE_PROMPT_PATH), 'utf8');
  for (const marker of activeProfile.requirements?.finalDeliveryPackage?.cover?.requiredPromptMarkers ?? []) {
    assert(text.includes(marker), 'RELEASE_COVER_MARKER', `封面提示词缺少固定标记：${marker}`);
    assert(standalonePrompt.includes(marker), 'RELEASE_COVER_MARKER',
      `独立封面提示词缺少固定标记：${marker}`);
  }
  return {
    copyReference,
    promptReference,
    review,
    reviewReference,
    titles: {primary, alternatives},
    douyin: {publishCopy, topics},
  };
}

function parseSpokenMetrics(output) {
  const match = String(output).match(/精确度=([0-9.]+)\s+覆盖度=([0-9.]+)/u);
  assert(match, 'RELEASE_SPOKEN_METRICS', '无法从实录来源校验结果读取精确度和覆盖度。');
  return {precision: Number(match[1]), coverage: Number(match[2])};
}

function parseCaptionMinimum(output) {
  const match = String(output).match(/minPrecision=([0-9.]+)/u);
  assert(match, 'RELEASE_CAPTION_METRICS', '无法从逐字字幕同步校验读取最低贴合度。');
  return Number(match[1]);
}

async function loadSpokenEvidence(job, baseline) {
  const {body: policy, reference: policyReference} = await readJsonBound(job.inputs.spokenSourcePolicy);
  assert(policy.compliance?.status === 'passed', 'RELEASE_SPOKEN_POLICY',
    '实录来源策略尚未达到 compliance.status=passed。');
  const spoken = run(process.execPath, [
    'tools/check-spoken-source-policy.mjs',
    job.inputs.transcript,
    job.inputs.bilingualCaptions,
    job.inputs.spokenSourcePolicy,
  ], {label: '实录来源严格校验'});
  const caption = run(process.execPath, [
    'tools/check-verbatim-caption-sync.mjs',
    job.inputs.transcript,
    job.inputs.bilingualCaptions,
  ], {label: '实录逐页逐字字幕同步校验'});
  const spokenMetrics = parseSpokenMetrics(spoken.stdout);
  const minimumScore = parseCaptionMinimum(caption.stdout);
  assert(minimumScore >= Number(baseline.captionPolicy?.minimumSyncScore ?? 0.74),
    'RELEASE_CAPTION_SCORE', '字幕窗口同步最低分低于正式基线。');
  return {policy, policyReference, spokenMetrics, minimumScore};
}

async function loadPreparedEvidence(formal) {
  const artifactRoot = `${CONTROL}/release-artifacts/${formal.sha256}`;
  const paths = {
    qa: `${artifactRoot}/formal-output-machine-qa.v1.json`,
    risk: `${artifactRoot}/release-risk-frame-receipt.v2.json`,
    contact: `${artifactRoot}/risk-frame-contact-sheet.jpg`,
    cover: `${artifactRoot}/cover-candidate-180.000s.png`,
    request: `${artifactRoot}/final-output-visual-review.request.v1.json`,
    review: `${artifactRoot}/final-output-visual-review.v1.json`,
    preparation: `${artifactRoot}/release-preparation-receipt.v1.json`,
    pendingRelease: `${artifactRoot}/release-record.pending.json`,
  };
  const {body: preparation, reference: preparationReference} = await readJsonBound(paths.preparation);
  const {body: qa, reference: qaReference} = await readJsonBound(paths.qa);
  const {body: risk, reference: riskReference} = await readJsonBound(paths.risk);
  const {body: request, reference: requestReference} = await readJsonBound(paths.request);
  const {body: review, reference: reviewReference} = await readJsonBound(paths.review);
  const coverReference = await bind(paths.cover);
  const contactReference = await bind(paths.contact);
  assert(preparation.status === 'prepared-awaiting-independent-visual-review' &&
      preparation.formalOutput?.sha256 === formal.sha256 &&
      preparation.machineQa?.sha256 === qaReference.sha256 &&
      preparation.riskFrameReceipt?.sha256 === riskReference.sha256 &&
      preparation.visualReviewRequest?.sha256 === requestReference.sha256,
    'RELEASE_PREPARATION_STALE', '发布准备回执未绑定当前正式片或当前证据。');
  assert(qa.status === 'passed-machine-technical-qa' && qa.output?.sha256 === formal.sha256 &&
      qa.checks?.ffprobe === 'passed' && qa.checks?.fullVideoAndAudioDecode === 'passed',
    'RELEASE_MACHINE_QA', '正式片独立机器 QA 尚未通过。');
  assert(risk.schema === RELEASE_RISK_FRAME_RECEIPT_SCHEMA &&
      risk.evidenceScope === 'real-final-output' && risk.sourceVideo?.sha256 === formal.sha256 &&
      Array.isArray(risk.frames) && risk.frames.length >= 8,
    'RELEASE_RISK_RECEIPT', '正式成片风险帧回执不完整。');
  assert(request.status === 'awaiting-independent-visual-review' &&
      request.sourceVideo?.sha256 === formal.sha256 &&
      request.coverCandidate?.sha256 === coverReference.sha256 &&
      request.riskFrameReceipt?.sha256 === riskReference.sha256 &&
      request.contactSheet?.sha256 === contactReference.sha256,
    'RELEASE_VISUAL_REQUEST', '视觉复核请求没有绑定当前正式片、封面候选和联系表。');
  assert(review.schemaVersion === 'koubo-final-output-visual-review/v1' &&
      review.episodeId === EPISODE_ID && review.jobId === JOB_ID && review.status === 'passed' &&
      review.reviewerType === 'codex-visual-inspection' && isText(review.reviewedAt) &&
      Number.isFinite(Date.parse(review.reviewedAt)) &&
      review.userFullWatchConfirmed === false && review.userReviewClaimed === false &&
      review.publicReleaseAuthorized === false,
    'RELEASE_VISUAL_REVIEW_PENDING', '独立视觉复核尚未通过，或错误声称了用户完整观看/发布授权。');
  assert(review.request?.path === requestReference.path && review.request?.sha256 === requestReference.sha256 &&
      review.sourceVideo?.path === formal.path && review.sourceVideo?.sha256 === formal.sha256 &&
      Number(review.sourceVideo?.bytes) === formal.bytes &&
      review.riskFrameReceipt?.path === riskReference.path &&
      review.riskFrameReceipt?.sha256 === riskReference.sha256 &&
      review.coverCandidate?.path === coverReference.path &&
      review.coverCandidate?.sha256 === coverReference.sha256 &&
      review.coverCandidate?.pixelSha256 === request.coverCandidate.pixelSha256 &&
      Number(review.coverCandidate?.sourceTimeSeconds) === COVER_TIME_SECONDS,
    'RELEASE_VISUAL_REVIEW_STALE', '独立视觉复核未精确绑定当前证据。');
  assert(Number(review.reviewedFrameCount) === risk.frames.length && isText(review.notes),
    'RELEASE_VISUAL_REVIEW_SCOPE', '视觉复核没有覆盖全部风险帧或缺少复核说明。');
  for (const key of REQUIRED_VISUAL_CHECKS) {
    assert(review.checks?.[key] === true, 'RELEASE_VISUAL_REVIEW_CHECK', `视觉复核未通过：${key}`);
  }
  const coverPixels = rawFrame(formal.path, COVER_TIME_SECONDS);
  const imagePixels = rawFrame(coverReference.path, 0);
  assert(coverPixels.sha256 === imagePixels.sha256 &&
      coverPixels.sha256 === request.coverCandidate.pixelSha256,
    'RELEASE_COVER_PIXELS', '180秒封面候选不再对应当前正式片像素。');
  return {
    paths,
    preparation,
    preparationReference,
    qa,
    qaReference,
    risk,
    riskReference,
    request,
    requestReference,
    review,
    reviewReference,
    coverReference,
    contactReference,
  };
}

function linkOnce(sourcePath, destinationPath, created) {
  const source = projectPath(sourcePath);
  const destination = projectPath(destinationPath, {mustExist: false});
  mkdirSync(dirname(destination), {recursive: true});
  if (existsSync(destination)) {
    const left = statSync(source);
    const right = statSync(destination);
    assert(left.dev === right.dev && left.ino === right.ino && left.size === right.size,
      'RELEASE_PACKAGE_COLLISION', `发布包已有不同文件，拒绝覆盖：${destinationPath}`);
    return;
  }
  linkSync(source, destination);
  created.push(destinationPath);
}

async function packageManifestItems(paths) {
  const items = [];
  for (const [role, pathValue] of paths) {
    const reference = await bind(pathValue);
    items.push({role, ...reference});
  }
  return items;
}

async function finalizeRelease() {
  assert(!existsSync(projectPath(RELEASE_PATH, {mustExist: false})),
    'RELEASE_ALREADY_EXISTS', `正式 release 已存在，拒绝覆盖：${RELEASE_PATH}`);
  const evidence = await loadFormalEvidence({fullDecode: false});
  const prepared = await loadPreparedEvidence(evidence.formal);
  const activeProfile = JSON.parse(readFileSync(projectPath('workflow/active-production-profile.v1.json'), 'utf8'));
  const copy = await loadCopyPackage(activeProfile);
  const spoken = await loadSpokenEvidence(evidence.job, evidence.baseline);

  const assets = [...new Set((evidence.visualPlan.layers ?? [])
    .map((layer) => layer.asset?.source)
    .filter((value) => isText(value) && MEDIA_EXTENSION_RE.test(value))
    .map((value) => projectRelativeFromAny(value, '视觉素材')))];
  assert(assets.length > 0, 'RELEASE_ASSETS', '正式视觉计划没有绑定可核验媒体素材。');
  for (const asset of assets) await bind(asset);

  const modules = [...new Set([
    ...(evidence.baseline.requiredModules ?? []),
    'v8-continuous-semantic-information-on-speaker-scenes',
    'paper-source-video-with-text-baked-firstframes',
    'ai-generated-video',
    'real-media-presenter-inset-lower-left',
    'real-media-subtitle-safe-viewport',
    'inserted-native-audio-preserved',
    'spoken-source-v1',
  ])];
  const release = {
    schemaVersion: 1,
    releaseId: RELEASE_ID,
    createdAt: prepared.review.reviewedAt,
    status: 'ready-for-user-review',
    videoId: EPISODE_ID,
    baselineId: evidence.baseline.baselineId,
    productionProfile: evidence.job.productionProfile,
    intent: {
      topic: 'AI没有凭空发明新的商业模式，核心变化更接近把既有流程的成本和效率推到新的水平。',
      serviceAudience: '关注AI创业、企业AI应用、商业模式与效率变化的普通创业者和本地企业经营者',
      oneConclusion: '看AI的实际影响，先看它怎样改变既有业务的成本结构、交付效率和客户理解能力。',
      cta: '结合自己的业务，分清哪些环节可以交给机器，哪些判断仍需人负责。',
      factBoundary: '核心标题是本条口播提出的判断；AI和纸艺画面只作说明，不承担事实证据；发布包装不复述尚未单独核验的量化主张。',
    },
    inputs: {
      sourceVideo: evidence.job.inputs.source,
      rawTranscript: evidence.job.inputs.transcript,
      transcript: evidence.job.inputs.transcript,
      bilingualCaptions: evidence.job.inputs.bilingualCaptions,
      spokenSourcePolicy: evidence.job.inputs.spokenSourcePolicy,
      visualPlan: evidence.job.inputs.visualPlan,
      assets,
    },
    production: {
      formalOutput: evidence.formal.path,
      rawOutput: evidence.raw.path,
      formalBackupWithoutAddedSfx: null,
      previewOutput: null,
      coverPrompt: COPY_PATH,
      soundEffectCueSheet: evidence.job.inputs.sfxCueSheet,
      modules,
      styleReferenceIds: ['v8-semantic-continuity-sfx', REVISION_ID],
      route: evidence.profile.route,
      revisionId: REVISION_ID,
    },
    productionGate: {
      schema: RELEASE_PRODUCTION_GATE_SCHEMA,
      route: evidence.profile.route,
      job: evidence.jobReference,
      jobSnapshotSha256: evidence.preflight.jobSnapshotSha256,
      scopedDirectExport: evidence.scopedManifestReference,
      scopedDirectExportSha256: evidence.preflight.scopedDirectExportSha256,
      directorContractSha256: evidence.preflight.directorContractSha256,
      handoffBindingSha256: evidence.preflight.handoffBindingSha256,
      freezeReceiptSha256: evidence.preflight.freezeReceiptSha256,
      runManifest: evidence.runManifestReference,
      runFingerprint: evidence.runManifest.fingerprint,
      stageReceipts: evidence.stageReceipts,
      formalOutput: evidence.formal,
      previewOutput: null,
      riskFrameReceipt: prepared.riskReference,
    },
    deliveryPackage: {
      status: 'ready-for-delivery',
      directory: PACKAGE,
      packagedFormalOutput: PACKAGED_FORMAL_PATH,
      releaseRecord: RELEASE_PATH,
      packagedReleaseRecord: PACKAGED_RELEASE_PATH,
      manifest: PACKAGE_MANIFEST_PATH,
      integrityReceipt: PACKAGE_INTEGRITY_PATH,
      cover: {
        aspectRatio: '3:4',
        recommendedFrame: PACKAGED_COVER_PATH,
        sourceVideo: evidence.formal.path,
        sourceVideoSha256: evidence.formal.sha256,
        sourceTimeSeconds: COVER_TIME_SECONDS,
        sourceType: 'current-final-video-real-frame',
        pixelSha256: prepared.request.coverCandidate.pixelSha256,
        prompt: COPY_PATH,
        standalonePrompt: STANDALONE_PROMPT_PATH,
        template: COVER_TEMPLATE_PATH,
        visualReview: prepared.reviewReference,
      },
      titles: copy.titles,
      douyin: copy.douyin,
      copyReview: COPY_REVIEW_PATH,
      qaReceipt: prepared.qaReference.path,
      riskFrameReceipt: prepared.riskReference.path,
      visualReviewReceipt: prepared.reviewReference.path,
    },
    qa: {
      technical: {
        status: 'passed',
        evidence: prepared.qaReference,
        fullDecode: true,
        width: evidence.probeSummary.video.width,
        height: evidence.probeSummary.video.height,
        fps: evidence.probeSummary.video.avg_frame_rate,
        videoCodec: evidence.probeSummary.video.codec_name,
        audioCodec: evidence.probeSummary.audio.codec_name,
        frameCount: evidence.probeSummary.expectedFrames,
        integratedLoudnessLufs: evidence.runManifest.formalQa.integratedLoudnessLufs,
        truePeakDbtp: evidence.runManifest.formalQa.truePeakDbtp,
      },
      captionSync: {
        status: 'passed',
        verifier: 'verbatim-v1',
        minimumScore: spoken.minimumScore,
        evidence: spoken.policyReference,
      },
      spokenSource: {
        status: 'passed',
        verifier: 'spoken-source-v1',
        precision: spoken.spokenMetrics.precision,
        coverage: spoken.spokenMetrics.coverage,
        evidence: spoken.policyReference,
      },
      visualPlan: {
        status: 'passed',
        evidence: evidence.visualPlanReference,
        finalOutputVisualReview: prepared.reviewReference,
      },
      keyframeReview: {
        status: 'passed',
        frames: prepared.risk.frames.map((frame) => Number(frame.atSeconds)),
        evidence: prepared.riskReference,
        visualReview: prepared.reviewReference,
        reviewedFrameCount: prepared.risk.frames.length,
      },
      cameraMotionReview: {
        status: 'passed-by-codex-visual-review',
        evidence: prepared.reviewReference,
      },
      soundEffectAudibility: {
        status: 'machine-verified-awaiting-user-full-watch',
        cueCount: evidence.visualPlan.layers?.length ?? null,
        integratedLoudnessLufs: evidence.runManifest.formalQa.integratedLoudnessLufs,
        truePeakDbtp: evidence.runManifest.formalQa.truePeakDbtp,
        userAudibilityConfirmed: false,
        fullVideoUserReviewPending: true,
      },
    },
    userReview: {
      previewApproved: false,
      directFinalAuthorized: true,
      formalRenderAuthorized: true,
      fullWatchConfirmed: false,
      reviewOutcome: 'formal-candidate-ready-for-user-review',
      authorizationKind: evidence.scopedManifest.authorization?.kind,
      authorizationEvidence: evidence.scopedManifest.authorization?.evidence ?? null,
      directExportMessage: evidence.scopedManifest.authorization?.directExportMessage ?? null,
      skipPreviewMessage: evidence.scopedManifest.authorization?.skipPreviewMessage ?? null,
      notes: '用户已明确要求正式 MP4 直出和完整发布包；本记录不冒充用户已经完整观看正式候选。',
    },
    upgradeDecisions: [
      {
        id: evidence.profile.route,
        decision: 'applied',
        reason: '本条按用户明确直出指令走固定 scoped 路由；不伪造预览确认、完整观看或发布授权。',
      },
      {
        id: 'public-media-presenter-inset-lower-left',
        decision: 'applied',
        reason: '公开素材画面沿用已确认的左下角真人小窗和独立字幕安全区。',
      },
      {
        id: 'formal-cover-current-video-frame',
        decision: 'applied',
        reason: '封面人物素材只使用本条正式片180秒真实截图，并经独立视觉复核。',
      },
    ],
    publish: {
      status: 'not-published',
      platform: '抖音',
      publishAuthorized: false,
      aiContentDisclosureRequired: true,
      materialRightsReviewRequired: true,
      publicReleasePerformed: false,
      externalUploadPerformed: false,
      performedBy: null,
      publicUrl: null,
      platformPublicationId: null,
      nextDecision: '用户完整观看正式候选后决定是否发布；发布当日复核素材权利和平台AI内容声明选项。',
    },
    evidence: {
      baseline: evidence.baselineReference,
      preparation: prepared.preparationReference,
      machineQa: prepared.qaReference,
      visualReview: prepared.reviewReference,
      copyReview: copy.reviewReference,
      spokenSourcePolicy: spoken.policyReference,
    },
    validation: {
      requiredCommand: `node tools/validate-release.mjs ${RELEASE_PATH}`,
      builderSuccessRequiresExitCodeZero: true,
      status: 'validated-after-atomic-install-see-package-integrity-receipt',
    },
  };

  const pendingBytes = Buffer.from(stableJson(release));
  writeBytesOnce(prepared.paths.pendingRelease, pendingBytes);
  const gate = validateReleaseProductionGateV2({
    projectRoot: ROOT,
    releasePath: projectPath(prepared.paths.pendingRelease),
    release,
  });
  assert(gate.ok, gate.code ?? 'RELEASE_PRODUCTION_GATE',
    `发布生产门未通过：${gate.message ?? 'unknown'}`, gate.details ?? null);
  assert(gate.route === evidence.profile.route && gate.formalOutputSha256 === evidence.formal.sha256,
    'RELEASE_PRODUCTION_GATE', '发布生产门没有绑定本期 scoped 路由和当前正式片。');

  const created = [];
  let releaseInstalled = false;
  try {
    linkOnce(evidence.formal.path, PACKAGED_FORMAL_PATH, created);
    linkOnce(prepared.coverReference.path, PACKAGED_COVER_PATH, created);
    linkOnce(prepared.qaReference.path, PACKAGED_QA_PATH, created);
    linkOnce(prepared.riskReference.path, PACKAGED_RISK_PATH, created);
    linkOnce(prepared.reviewReference.path, PACKAGED_VISUAL_REVIEW_PATH, created);

    renameSync(projectPath(prepared.paths.pendingRelease), projectPath(RELEASE_PATH, {mustExist: false}));
    created.push(RELEASE_PATH);
    releaseInstalled = true;
    linkOnce(RELEASE_PATH, PACKAGED_RELEASE_PATH, created);

    const manifestFiles = await packageManifestItems([
      ['formal-mp4', PACKAGED_FORMAL_PATH],
      ['current-video-real-person-frame', PACKAGED_COVER_PATH],
      ['publish-copy-and-cover-prompt', COPY_PATH],
      ['standalone-cover-prompt', STANDALONE_PROMPT_PATH],
      ['dual-skill-copy-review', COPY_REVIEW_PATH],
      ['formal-machine-qa', PACKAGED_QA_PATH],
      ['formal-risk-frame-receipt', PACKAGED_RISK_PATH],
      ['formal-visual-review', PACKAGED_VISUAL_REVIEW_PATH],
      ['canonical-release-record', PACKAGED_RELEASE_PATH],
    ]);
    const packageManifest = {
      schemaVersion: 1,
      packageId: `${RELEASE_ID}-package`,
      createdAt: prepared.review.reviewedAt,
      status: 'ready-for-user-review',
      packageRoot: PACKAGE,
      itemCount: manifestFiles.length,
      files: manifestFiles,
      deliveryState: {
        formalCandidateReady: true,
        releasePackageComplete: true,
        userFullWatchConfirmed: false,
        verified: false,
        published: false,
      },
    };
    if (writeJsonOnce(PACKAGE_MANIFEST_PATH, packageManifest)) {
      created.push(PACKAGE_MANIFEST_PATH);
    }
    const manifestReference = await bind(PACKAGE_MANIFEST_PATH);
    const releaseReference = await bind(RELEASE_PATH);
    const integrityDraft = {
      schemaVersion: 1,
      packageId: `${RELEASE_ID}-package`,
      validatedAt: new Date().toISOString(),
      status: 'validation-running',
      packageRoot: PACKAGE,
      manifest: manifestReference,
      checks: {
        allManifestFilesExist: true,
        allManifestHashesAndBytesMatch: true,
        packagedFormalIsHardlinkOfControlledFormal: true,
        packagedCoverIsHardlinkOfReviewedCurrentVideoFrame: true,
        packagedReleaseIsHardlinkOfCanonicalRelease: true,
        productionGate: gate.code,
        officialReleaseValidation: 'pending',
      },
      boundEvidence: {
        releaseRecord: releaseReference,
        formalOutput: evidence.formal,
        runManifest: evidence.runManifestReference,
        machineQa: prepared.qaReference,
        riskFrameReceipt: prepared.riskReference,
        visualReview: prepared.reviewReference,
        copyReview: copy.reviewReference,
      },
      remainingHumanGates: [
        '用户以正常速度完整观看正式有声候选片后，release才可升级为verified。',
        '公开发布前按当日客户端选项完成AI内容声明和素材权利复核。',
      ],
    };
    if (writeJsonOnce(PACKAGE_INTEGRITY_PATH, integrityDraft)) {
      created.push(PACKAGE_INTEGRITY_PATH);
    }

    const releaseValidation = run(
      process.execPath,
      ['tools/validate-release.mjs', RELEASE_PATH],
      {label: '官方完整 release 校验', timeout: 7_200_000, maxBuffer: 96 * 1024 * 1024},
    );
    const finalIntegrity = {
      ...integrityDraft,
      validatedAt: new Date().toISOString(),
      status: 'passed-ready-for-user-review',
      checks: {
        ...integrityDraft.checks,
        officialReleaseValidation: 'passed',
      },
      officialReleaseValidation: {
        command: `node tools/validate-release.mjs ${RELEASE_PATH}`,
        stdout: releaseValidation.stdout.trim(),
        exitCode: 0,
      },
    };
    writeFileSync(projectPath(PACKAGE_INTEGRITY_PATH), stableJson(finalIntegrity));

    console.log(JSON.stringify({
      status: 'ready-for-user-review',
      formalOutput: evidence.formal,
      packagedFormal: await bind(PACKAGED_FORMAL_PATH),
      coverFrame: await bind(PACKAGED_COVER_PATH),
      releaseRecord: await bind(RELEASE_PATH),
      packageManifest: await bind(PACKAGE_MANIFEST_PATH),
      integrityReceipt: await bind(PACKAGE_INTEGRITY_PATH),
      fullWatchConfirmed: false,
      publishStatus: 'not-published',
      validation: releaseValidation.stdout.trim(),
    }, null, 2));
  } catch (error) {
    for (const pathValue of created.reverse()) {
      if (existsSync(projectPath(pathValue, {mustExist: false}))) unlinkSync(projectPath(pathValue));
    }
    if (!releaseInstalled && existsSync(projectPath(prepared.paths.pendingRelease, {mustExist: false}))) {
      // Keep the bound pending record only when the production gate itself passed; it is not a release record.
    }
    throw error;
  }
}

async function main() {
  assert(ALLOWED_COMMANDS.has(COMMAND) && process.argv.length === 3,
    'RELEASE_USAGE',
    `用法：node ${CONTROL}/build-release-package-r1.mjs prepare|finalize`);
  if (COMMAND === 'prepare') await prepareRelease();
  else await finalizeRelease();
}

main().catch((error) => {
  console.error(`[${error.code ?? 'RELEASE_BUILD_BLOCKED'}] ${error.message}`);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exitCode = 1;
});
