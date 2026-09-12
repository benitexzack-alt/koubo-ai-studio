#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, rmSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {
  DIRECTOR_R10_DIAGNOSTIC_CONTRACT,
  DirectorR10DiagnosticRenderError,
  assertDirectorR10DiagnosticManifest,
  assertDirectorR10SnapshotStable,
  assertKnowledgeContextDocument,
  assertKnowledgeContextValidation,
  assertR10B07SceneOnlyCompositionMetadata,
  assertR10B07SceneOnlyOutputProbe,
  assertR10CueAudibilityAudit,
  assertR10CompositionMetadata,
  assertR10OutputProbe,
  assertR10PairedAudioHashes,
  assertR10PairedVisualHashes,
  assertR10SingleVisualMasterDerivation,
  assertR10SpeechPreservationMetrics,
  captureDirectorR10InputSnapshot,
  captureExistingOutput,
  captureSecureFile,
  createDirectorR10OutputDirectory,
  resolveDirectorR10OutputTarget,
  snapshotForReceipt,
  stableJson,
  stableJsonSha256,
  writeJsonAtomic,
} from './director-r10-diagnostic-render-core.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const personalKbRoot = path.dirname(
  path.dirname(path.dirname(DIRECTOR_R10_DIAGNOSTIC_CONTRACT.ragValidatorPath)),
);

const usage = () => {
  console.error(
    '用法：node tools/run-director-r10-diagnostic-preview.mjs <项目内-manifest.json>',
  );
};

const errorRecord = (error) => ({
  name: error instanceof Error ? error.name : 'Error',
  code:
    error instanceof DirectorR10DiagnosticRenderError
      ? error.code
      : 'R10_DIAGNOSTIC_UNEXPECTED_ERROR',
  message: error instanceof Error ? error.message : String(error),
  details:
    error instanceof DirectorR10DiagnosticRenderError
      ? error.details
      : null,
});

const resolveManifestArgument = (argument) => {
  if (
    typeof argument !== 'string' ||
    !argument ||
    argument.includes('\0') ||
    argument.includes('\\') ||
    path.posix.isAbsolute(argument) ||
    path.posix.normalize(argument) !== argument ||
    argument === '.' ||
    argument === '..' ||
    argument.startsWith('../') ||
    argument.includes('/../')
  ) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_MANIFEST_PATH_INVALID',
      'manifest 必须是口播项目内规范相对路径。',
    );
  }
  const absolutePath = path.resolve(projectRoot, ...argument.split('/'));
  const relation = path.relative(projectRoot, absolutePath);
  if (
    !relation ||
    relation === '..' ||
    relation.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relation)
  ) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_MANIFEST_PATH_INVALID',
      'manifest 路径逃逸口播项目。',
    );
  }
  return absolutePath;
};

const readBoundManifest = async (manifestPath) => {
  const before = await captureSecureFile(manifestPath, {
    projectRoot,
    label: 'R10 诊断 manifest',
  });
  const source = readFileSync(manifestPath, 'utf8');
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  if (sourceSha256 !== before.sha256) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_MANIFEST_DRIFT',
      'manifest 在读取时发生哈希漂移。',
    );
  }
  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch (error) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_MANIFEST_JSON_INVALID',
      `manifest 不是有效 JSON：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const after = await captureSecureFile(manifestPath, {
    projectRoot,
    expectedSha256: before.sha256,
    label: 'R10 诊断 manifest',
  });
  const beforeComparable = {
    sha256: before.sha256,
    bytes: before.bytes,
    identity: before.identity,
  };
  const afterComparable = {
    sha256: after.sha256,
    bytes: after.bytes,
    identity: after.identity,
  };
  if (stableJson(beforeComparable) !== stableJson(afterComparable)) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_MANIFEST_DRIFT',
      'manifest 在读取前后发生文件身份漂移。',
    );
  }
  return {
    manifest,
    snapshot: beforeComparable,
  };
};

const recaptureManifest = async (manifestPath, initialSnapshot) => {
  const current = await captureSecureFile(manifestPath, {
    projectRoot,
    expectedSha256: initialSnapshot.sha256,
    label: 'R10 诊断 manifest',
  });
  const comparable = {
    sha256: current.sha256,
    bytes: current.bytes,
    identity: current.identity,
  };
  if (stableJson(comparable) !== stableJson(initialSnapshot)) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_MANIFEST_DRIFT',
      'manifest 在受控渲染前后发生漂移。',
    );
  }
  return comparable;
};

const captureValidator = async () => {
  const captured = await captureSecureFile(
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.ragValidatorPath,
    {
      projectRoot,
      label: 'opc_rag.py 校验器',
    },
  );
  return {
    path: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.ragValidatorPath,
    sha256: captured.sha256,
    bytes: captured.bytes,
    identity: captured.identity,
  };
};

const runKnowledgeContextValidation = () => {
  const result = spawnSync(
    '/usr/bin/python3',
    [
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.ragValidatorPath,
      'validate-context',
      '--context',
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.knowledgeContextPath,
    ],
    {
      cwd: personalKbRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0) {
    const details = [result.error?.message, result.stdout?.trim(), result.stderr?.trim()]
      .filter(Boolean)
      .join('\n');
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_CONTEXT_VALIDATION_FAILED',
      `opc_rag.py validate-context 失败：${details || `退出码 ${result.status}`}`,
    );
  }
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_CONTEXT_VALIDATION_OUTPUT_INVALID',
      `opc_rag.py 未返回有效 JSON：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return assertKnowledgeContextValidation(payload);
};

const readKnowledgeContextDocument = (manifest) => {
  const source = readFileSync(
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.knowledgeContextPath,
    'utf8',
  );
  const sha256 = createHash('sha256').update(source).digest('hex');
  if (sha256 !== manifest.knowledgeContext.sha256) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_CONTEXT_SHA256_MISMATCH',
      '知识上下文文档与 manifest 绑定哈希不一致。',
    );
  }
  let context;
  try {
    context = JSON.parse(source);
  } catch (error) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_CONTEXT_JSON_INVALID',
      `知识上下文文档不是有效 JSON：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return assertKnowledgeContextDocument(context, {projectRoot});
};

const assertValidatorStable = (before, after) => {
  if (stableJson(before) !== stableJson(after)) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_VALIDATOR_DRIFT',
      'opc_rag.py 校验器在受控渲染前后发生漂移。',
    );
  }
};

const probeOutput = (outputPath) => {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-count_frames',
      '-show_entries',
      'stream=index,codec_type,codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,duration,sample_rate,channels,channel_layout:format=duration,size',
      '-of',
      'json',
      outputPath,
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0) {
    const details = [result.error?.message, result.stdout?.trim(), result.stderr?.trim()]
      .filter(Boolean)
      .join('\n');
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_FFPROBE_FAILED',
      `ffprobe 失败：${details || `退出码 ${result.status}`}`,
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_FFPROBE_JSON_INVALID',
      `ffprobe 未返回有效 JSON：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const hashDecodedVideo = (outputPath) => {
  const result = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      outputPath,
      '-map',
      '0:v:0',
      '-an',
      '-c:v',
      'rawvideo',
      '-pix_fmt',
      'yuv420p',
      '-f',
      'hash',
      '-hash',
      'sha256',
      '-',
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0) {
    const details = [result.error?.message, result.stdout?.trim(), result.stderr?.trim()]
      .filter(Boolean)
      .join('\n');
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_DECODED_VIDEO_HASH_FAILED',
      `解码画面 SHA-256 计算失败：${details || `退出码 ${result.status}`}`,
    );
  }
  const match = /^SHA256=([a-f0-9]{64})\s*$/u.exec(result.stdout);
  if (!match) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_DECODED_VIDEO_HASH_INVALID',
      'ffmpeg 未返回规范解码画面 SHA-256。',
    );
  }
  return match[1];
};

const hashEncodedVideoPackets = (outputPath) => {
  const result = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      outputPath,
      '-map',
      '0:v:0',
      '-an',
      '-c:v',
      'copy',
      '-f',
      'hash',
      '-hash',
      'sha256',
      '-',
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0) {
    const details = [result.error?.message, result.stdout?.trim(), result.stderr?.trim()]
      .filter(Boolean)
      .join('\n');
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_ENCODED_VIDEO_HASH_FAILED',
      `编码画面包 SHA-256 计算失败：${details || `退出码 ${result.status}`}`,
    );
  }
  const match = /^SHA256=([a-f0-9]{64})\s*$/u.exec(result.stdout);
  if (!match) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_ENCODED_VIDEO_HASH_INVALID',
      'ffmpeg 未返回规范编码画面包 SHA-256。',
    );
  }
  return match[1];
};

const hashDecodedAudio = (outputPath) => {
  const result = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      outputPath,
      '-map',
      '0:a:0',
      '-vn',
      '-ac',
      '2',
      '-ar',
      '48000',
      '-f',
      'hash',
      '-hash',
      'sha256',
      '-',
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0) {
    const details = [result.error?.message, result.stdout?.trim(), result.stderr?.trim()]
      .filter(Boolean)
      .join('\n');
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_DECODED_AUDIO_HASH_FAILED',
      `解码音频 SHA-256 计算失败：${details || `退出码 ${result.status}`}`,
    );
  }
  const match = /^SHA256=([a-f0-9]{64})\s*$/u.exec(result.stdout);
  if (!match) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_DECODED_AUDIO_HASH_INVALID',
      'ffmpeg 未返回规范解码音频 SHA-256。',
    );
  }
  return match[1];
};

const hashFile = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');

const decodeMonoFloatAudio = ({
  inputPath,
  startSeconds,
  durationSeconds,
  sampleRate = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.speechAuditSampleRate,
}) => {
  const args = ['-v', 'error', '-i', inputPath];
  if (startSeconds > 0) args.push('-ss', startSeconds.toFixed(6));
  args.push(
    '-t',
    durationSeconds.toFixed(6),
    '-map',
    '0:a:0',
    '-vn',
    '-ac',
    '1',
    '-ar',
    String(sampleRate),
    '-c:a',
    'pcm_f32le',
    '-f',
    'f32le',
    '-',
  );
  const result = spawnSync('ffmpeg', args, {
    cwd: projectRoot,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    const details = [
      result.error?.message,
      Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8').trim() : null,
    ]
      .filter(Boolean)
      .join('\n');
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_SPEECH_DECODE_FAILED',
      `实录原声相关性审计解码失败：${details || `退出码 ${result.status}`}`,
    );
  }
  if (result.stdout.byteLength === 0 || result.stdout.byteLength % 4 !== 0) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_SPEECH_DECODE_INVALID',
      '实录原声相关性审计未得到有效 Float32 PCM。',
    );
  }
  return new Float32Array(
    result.stdout.buffer,
    result.stdout.byteOffset,
    result.stdout.byteLength / 4,
  );
};

const auditRecordedSpeechPreservation = ({manifest, target}) => {
  const sampleRate = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.speechAuditSampleRate;
  const searchWindowMs =
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.speechAuditSearchWindowMs;
  const searchSamples = Math.round((sampleRate * searchWindowMs) / 1000);
  const durationSeconds =
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.durationInFrames /
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps;
  const trimStartSeconds =
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.sourceTrimBeforeFrames /
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps;
  const sourcePath = path.join(
    projectRoot,
    manifest.remotion.publicDir,
    'R01.mp4',
  );
  const noSfxOutput = target.outputs.find(
    (output) => output.compositionId === 'LanzhouIndustryAIR10PilotR1NoSfx',
  );
  if (!noSfxOutput) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_NO_SFX_OUTPUT_MISSING',
      '缺少无附加音效片，无法审计实录原声保留。',
    );
  }
  const reference = decodeMonoFloatAudio({
    inputPath: sourcePath,
    startSeconds: trimStartSeconds - searchWindowMs / 1000,
    durationSeconds:
      durationSeconds +
      (searchWindowMs * 2) / 1000 +
      2 / sampleRate,
  });
  const candidateDecoded = decodeMonoFloatAudio({
    inputPath: noSfxOutput.absolutePath,
    startSeconds: 0,
    durationSeconds,
  });
  const expectedSamples = Math.round(durationSeconds * sampleRate);
  const comparedSamples = Math.min(expectedSamples, candidateDecoded.length);
  if (
    candidateDecoded.length < expectedSamples - 2 ||
    reference.length < comparedSamples + searchSamples * 2
  ) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_SPEECH_WINDOW_TRUNCATED',
      '实录原声相关性审计窗口短于完整视频窗。',
      {
        expectedSamples,
        candidateSamples: candidateDecoded.length,
        referenceSamples: reference.length,
      },
    );
  }
  let candidateSum = 0;
  let candidateSquareSum = 0;
  for (let index = 0; index < comparedSamples; index += 1) {
    const value = candidateDecoded[index];
    candidateSum += value;
    candidateSquareSum += value * value;
  }
  const candidateMean = candidateSum / comparedSamples;
  const candidateVariance =
    candidateSquareSum - comparedSamples * candidateMean * candidateMean;
  if (!(candidateVariance > 1e-12)) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_SPEECH_CANDIDATE_SILENT',
      '无附加音效片的音频能量不足，不能证明实录原声保留。',
    );
  }
  const prefix = new Float64Array(reference.length + 1);
  const prefixSquares = new Float64Array(reference.length + 1);
  for (let index = 0; index < reference.length; index += 1) {
    const value = reference[index];
    prefix[index + 1] = prefix[index] + value;
    prefixSquares[index + 1] = prefixSquares[index] + value * value;
  }
  let best = null;
  for (let offset = 0; offset <= searchSamples * 2; offset += 1) {
    let dot = 0;
    for (let index = 0; index < comparedSamples; index += 1) {
      dot += candidateDecoded[index] * reference[offset + index];
    }
    const referenceSum = prefix[offset + comparedSamples] - prefix[offset];
    const referenceSquareSum =
      prefixSquares[offset + comparedSamples] - prefixSquares[offset];
    const referenceMean = referenceSum / comparedSamples;
    const referenceVariance =
      referenceSquareSum - comparedSamples * referenceMean * referenceMean;
    if (!(referenceVariance > 1e-12)) continue;
    const covariance = dot - comparedSamples * candidateMean * referenceMean;
    const correlation = covariance / Math.sqrt(candidateVariance * referenceVariance);
    if (!best || correlation > best.correlation) {
      const candidateRms = Math.sqrt(candidateSquareSum / comparedSamples);
      const referenceRms = Math.sqrt(referenceSquareSum / comparedSamples);
      best = {
        correlation,
        offsetMs: (offset * 1000) / sampleRate - searchWindowMs,
        rmsDeltaDb: 20 * Math.log10(candidateRms / referenceRms),
        comparedSamples,
        sampleRate,
      };
    }
  }
  if (!best) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_SPEECH_CORRELATION_UNAVAILABLE',
      '未能计算实录原声相关性。',
    );
  }
  best.candidateDelayMs = -best.offsetMs;
  return assertR10SpeechPreservationMetrics(best);
};

const auditRuntimeCueAudibility = ({manifest, target}) => {
  const runtime = JSON.parse(
    readFileSync(
      path.join(projectRoot, DIRECTOR_R10_DIAGNOSTIC_CONTRACT.runtimeTimelinePath),
      'utf8',
    ),
  );
  const cues = runtime.soundCues;
  if (!Array.isArray(cues) || cues.length === 0) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_RUNTIME_CUES_UNAVAILABLE',
      'runtime 未提供逐 cue 音效差分审计所需的 soundCues。',
    );
  }
  const withSfxOutput = target.outputs.find(
    (output) => output.compositionId === 'LanzhouIndustryAIR10PilotR1WithSfx',
  );
  const noSfxOutput = target.outputs.find(
    (output) => output.compositionId === 'LanzhouIndustryAIR10PilotR1NoSfx',
  );
  if (!withSfxOutput || !noSfxOutput) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_AUDIO_PAIR_OUTPUT_MISSING',
      '缺少有/无附加音效诊断片，无法执行逐 cue 差分审计。',
    );
  }
  const durationSeconds =
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.durationInFrames /
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps;
  const withSfx = decodeMonoFloatAudio({
    inputPath: withSfxOutput.absolutePath,
    startSeconds: 0,
    durationSeconds,
    sampleRate: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.cueAuditSampleRate,
  });
  const noSfx = decodeMonoFloatAudio({
    inputPath: noSfxOutput.absolutePath,
    startSeconds: 0,
    durationSeconds,
    sampleRate: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.cueAuditSampleRate,
  });
  const sampleRate = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.cueAuditSampleRate;
  const sampleCount = Math.min(withSfx.length, noSfx.length);
  const audits = cues.map((cue) => {
    const cueOnsetSeconds = cue.frame / DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps;
    const startSeconds = Math.max(
      0,
      cueOnsetSeconds - DIRECTOR_R10_DIAGNOSTIC_CONTRACT.cueAuditLeadSeconds,
    );
    const endSeconds = Math.min(
      durationSeconds,
      startSeconds + DIRECTOR_R10_DIAGNOSTIC_CONTRACT.cueAuditWindowSeconds,
    );
    const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
    const endSample = Math.min(sampleCount, Math.ceil(endSeconds * sampleRate));
    let squareSum = 0;
    let peak = 0;
    for (let index = startSample; index < endSample; index += 1) {
      const difference = withSfx[index] - noSfx[index];
      squareSum += difference * difference;
      peak = Math.max(peak, Math.abs(difference));
    }
    const comparedSamples = endSample - startSample;
    const rms = comparedSamples > 0 ? Math.sqrt(squareSum / comparedSamples) : 0;
    return {
      cueId: cue.id,
      frame: cue.frame,
      role: cue.role,
      source: cue.source,
      cueOnsetSeconds,
      windowStartSeconds: startSeconds,
      windowEndSeconds: endSeconds,
      sampleRate,
      comparedSamples,
      differenceRmsDbfs: 20 * Math.log10(Math.max(rms, 1e-12)),
      differencePeakDbfs: 20 * Math.log10(Math.max(peak, 1e-12)),
    };
  });
  return assertR10CueAudibilityAudit(
    audits,
    cues.map((cue) => cue.id),
  );
};

const removeTemporaryBundle = (serveUrl) => {
  if (typeof serveUrl !== 'string') return;
  const temporaryRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
  const resolved = path.resolve(serveUrl);
  if (
    resolved.startsWith(temporaryRoot) &&
    path.basename(resolved).startsWith('remotion-webpack-bundle-')
  ) {
    rmSync(resolved, {recursive: true, force: true});
  }
};

const openRenderContext = async (manifest) => {
  const remotionRoot = path.resolve(projectRoot, manifest.remotion.root);
  const entryPoint = path.resolve(remotionRoot, manifest.remotion.entry);
  const publicDir = path.resolve(projectRoot, manifest.remotion.publicDir);
  const requireFromRemotion = createRequire(path.join(remotionRoot, 'package.json'));
  const {bundle} = requireFromRemotion('@remotion/bundler');
  const {openBrowser, renderMedia, selectComposition} =
    requireFromRemotion('@remotion/renderer');
  let serveUrl;
  let bundleDirectory;
  let browser;
  try {
    serveUrl = await bundle({
      entryPoint,
      rootDir: remotionRoot,
      publicDir,
      symlinkPublicDir: false,
      enableCaching: true,
      onProgress: () => {},
      onDirectoryCreated: (directory) => {
        bundleDirectory = directory;
      },
    });
    browser = await openBrowser('chrome', {
      chromeMode: 'headless-shell',
      logLevel: 'error',
    });
    const compositions = [];
    for (const compositionId of DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds) {
      const composition = await selectComposition({
        serveUrl,
        id: compositionId,
        inputProps: {},
        puppeteerInstance: browser,
        logLevel: 'error',
      });
      assertR10CompositionMetadata(composition);
      compositions.push(composition);
    }
    const b07SceneOnlyComposition = await selectComposition({
      serveUrl,
      id: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.b07SceneOnlyCompositionId,
      inputProps: {},
      puppeteerInstance: browser,
      logLevel: 'error',
    });
    assertR10B07SceneOnlyCompositionMetadata(b07SceneOnlyComposition);
    compositions.push(b07SceneOnlyComposition);
    return {
      serveUrl,
      browser,
      compositions,
      renderMedia,
      close: async () => {
        if (browser) await browser.close({silent: true});
        removeTemporaryBundle(serveUrl);
      },
    };
  } catch (error) {
    if (browser) await browser.close({silent: true}).catch(() => {});
    removeTemporaryBundle(serveUrl ?? bundleDirectory);
    throw error;
  }
};

const renderComposition = async ({
  context,
  composition,
  outputLocation,
  codec,
  progressLabel,
  includeAudio = true,
}) => {
  let lastReportedPercent = -1;
  const options = {
    serveUrl: context.serveUrl,
    composition,
    codec,
    outputLocation,
    frameRange: [0, composition.durationInFrames - 1],
    concurrency: 2,
    puppeteerInstance: context.browser,
    overwrite: false,
    muted: !includeAudio,
    logLevel: 'error',
    onProgress: ({progress}) => {
      const percent = Math.floor(progress * 100);
      if (percent !== lastReportedPercent && percent % 20 === 0) {
        process.stdout.write(
          `\r${progressLabel} ${String(percent).padStart(3, ' ')}%`,
        );
        lastReportedPercent = percent;
      }
    },
  };
  if (codec === 'h264') {
    Object.assign(options, {
      crf: 17,
      pixelFormat: 'yuv420p',
      audioCodec: includeAudio ? 'aac' : null,
      x264Preset: 'slow',
    });
  }
  if (includeAudio) options.audioBitrate = '192k';
  await context.renderMedia(options);
  process.stdout.write(`\r${progressLabel} 100%\n`);
};

const renderB07SceneOnly = async ({context, target}) => {
  const composition = context.compositions.find(
    (candidate) =>
      candidate.id ===
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.b07SceneOnlyCompositionId,
  );
  if (!composition) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_B07_SCENE_COMPOSITION_MISSING',
      '同一 Remotion bundle/browser 中缺少 B07 纯纸艺诊断 composition。',
    );
  }
  assertR10B07SceneOnlyCompositionMetadata(composition);
  await renderComposition({
    context,
    composition,
    outputLocation: target.b07SceneOnlyOutput.absolutePath,
    codec: 'h264',
    progressLabel: `${composition.id} QA 纯纸艺层`,
    includeAudio: false,
  });
};

const muxVisualMasterWithSfxAudio = ({
  visualMasterPath,
  sfxAudioPath,
  outputPath,
}) => {
  const result = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-nostdin',
      '-n',
      '-i',
      visualMasterPath,
      '-i',
      sfxAudioPath,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'copy',
      '-map_metadata',
      '0',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0) {
    const details = [result.error?.message, result.stdout?.trim(), result.stderr?.trim()]
      .filter(Boolean)
      .join('\n');
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_AUDIO_MUX_FAILED',
      `单画面母版音轨封装失败：${details || `退出码 ${result.status}`}`,
    );
  }
};

const removeTemporaryAudioSource = (directory) => {
  const temporaryRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
  const resolved = path.resolve(directory);
  if (
    !resolved.startsWith(temporaryRoot) ||
    !path.basename(resolved).startsWith('director-r10-audio-source-')
  ) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_TEMP_AUDIO_PATH_INVALID',
      '拒绝清理不受控的临时音频目录。',
    );
  }
  rmSync(resolved, {recursive: true, force: true});
};

const renderPair = async ({manifest, target, onContext}) => {
  const context = await openRenderContext(manifest);
  onContext(context);
  const compositionById = new Map(
    context.compositions.map((composition) => [composition.id, composition]),
  );
  const visualMasterOutput = target.outputs.find(
    (output) =>
      output.compositionId ===
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.visualMasterCompositionId,
  );
  const withSfxOutput = target.outputs.find(
    (output) =>
      output.compositionId ===
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.sfxAudioCompositionId,
  );
  const visualMasterComposition = compositionById.get(
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.visualMasterCompositionId,
  );
  const sfxAudioComposition = compositionById.get(
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.sfxAudioCompositionId,
  );
  if (
    !visualMasterOutput ||
    !withSfxOutput ||
    !visualMasterComposition ||
    !sfxAudioComposition
  ) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_COMPOSITION_PAIR_INCOMPLETE',
      '渲染上下文缺少固定画面母版或有音效音频 composition。',
    );
  }
  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), 'director-r10-audio-source-'),
  );
  const sfxAudioPath = path.join(temporaryDirectory, 'with-sfx-audio.m4a');
  try {
    await renderComposition({
      context,
      composition: sfxAudioComposition,
      outputLocation: sfxAudioPath,
      codec: 'aac',
      progressLabel: `${sfxAudioComposition.id} 音频母带`,
    });
    const sfxAudioStat = statSync(sfxAudioPath);
    if (!sfxAudioStat.isFile() || sfxAudioStat.size <= 0) {
      throw new DirectorR10DiagnosticRenderError(
        'R10_DIAGNOSTIC_SFX_AUDIO_SOURCE_INVALID',
        'Remotion 有音效音频母带缺失或为空。',
      );
    }
    const sourceAudioSha256 = hashFile(sfxAudioPath);
    const sourceAudioDecodedSha256 = hashDecodedAudio(sfxAudioPath);
    await renderComposition({
      context,
      composition: visualMasterComposition,
      outputLocation: visualMasterOutput.absolutePath,
      codec: 'h264',
      progressLabel: `${visualMasterComposition.id} 画面母版`,
    });
    const visualMasterBeforeMux = await captureExistingOutput(
      visualMasterOutput.absolutePath,
      {
        projectRoot,
        label: 'R10 无音效画面母版（封装前）',
      },
    );
    if (!visualMasterBeforeMux.exists || existsSync(withSfxOutput.absolutePath)) {
      throw new DirectorR10DiagnosticRenderError(
        'R10_DIAGNOSTIC_MUX_TARGET_STATE_INVALID',
        '画面母版缺失或有音效输出已存在，拒绝封装。',
      );
    }
    muxVisualMasterWithSfxAudio({
      visualMasterPath: visualMasterOutput.absolutePath,
      sfxAudioPath,
      outputPath: withSfxOutput.absolutePath,
    });
    const visualMasterAfterMux = await captureExistingOutput(
      visualMasterOutput.absolutePath,
      {
        projectRoot,
        label: 'R10 无音效画面母版（封装后）',
      },
    );
    if (
      !visualMasterAfterMux.exists ||
      stableJson({
        sha256: visualMasterBeforeMux.sha256,
        bytes: visualMasterBeforeMux.bytes,
        identity: visualMasterBeforeMux.identity,
      }) !==
        stableJson({
          sha256: visualMasterAfterMux.sha256,
          bytes: visualMasterAfterMux.bytes,
          identity: visualMasterAfterMux.identity,
        })
    ) {
      throw new DirectorR10DiagnosticRenderError(
        'R10_DIAGNOSTIC_VISUAL_MASTER_DRIFT_DURING_MUX',
        '音轨封装期间无音效画面母版发生漂移。',
      );
    }
    return {
      strategy: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.renderStrategy,
      visualMasterCompositionId:
        DIRECTOR_R10_DIAGNOSTIC_CONTRACT.visualMasterCompositionId,
      sfxAudioCompositionId:
        DIRECTOR_R10_DIAGNOSTIC_CONTRACT.sfxAudioCompositionId,
      sourceAudioSha256,
      sourceAudioDecodedSha256,
      sourceAudioBytes: sfxAudioStat.size,
      videoCodec: 'copy',
      audioCodec: 'copy',
    };
  } finally {
    removeTemporaryAudioSource(temporaryDirectory);
  }
};

const inspectOutputs = async (target, {strict}) => {
  const outputs = [];
  for (const output of target.outputs) {
    try {
      const file = await captureExistingOutput(output.absolutePath, {
        projectRoot,
        label: `诊断输出 ${output.compositionId}`,
      });
      if (!file.exists) {
        if (strict) {
          throw new DirectorR10DiagnosticRenderError(
            'R10_DIAGNOSTIC_OUTPUT_MISSING',
            `诊断输出缺失：${output.compositionId}`,
          );
        }
        outputs.push({
          compositionId: output.compositionId,
          fileName: output.fileName,
          exists: false,
        });
        continue;
      }
      const probe = probeOutput(output.absolutePath);
      const verifiedSpec = assertR10OutputProbe(probe, output.compositionId);
      const encodedVideoPacketSha256 = hashEncodedVideoPackets(output.absolutePath);
      const decodedVideoSha256 = hashDecodedVideo(output.absolutePath);
      const decodedAudioSha256 = hashDecodedAudio(output.absolutePath);
      const fileAfterInspection = await captureExistingOutput(output.absolutePath, {
        projectRoot,
        label: `诊断输出 ${output.compositionId}（检查后）`,
      });
      const beforeComparable = {
        sha256: file.sha256,
        bytes: file.bytes,
        identity: file.identity,
      };
      const afterComparable = {
        sha256: fileAfterInspection.sha256,
        bytes: fileAfterInspection.bytes,
        identity: fileAfterInspection.identity,
      };
      if (
        !fileAfterInspection.exists ||
        stableJson(beforeComparable) !== stableJson(afterComparable)
      ) {
        throw new DirectorR10DiagnosticRenderError(
          'R10_DIAGNOSTIC_OUTPUT_DRIFT_DURING_INSPECTION',
          `诊断输出在规格与解码检查期间发生漂移：${output.compositionId}`,
        );
      }
      outputs.push({
        compositionId: output.compositionId,
        fileName: output.fileName,
        ...file,
        probe,
        verifiedSpec,
        encodedVideoPacketSha256,
        decodedVideoSha256,
        decodedAudioSha256,
      });
    } catch (error) {
      if (strict) throw error;
      outputs.push({
        compositionId: output.compositionId,
        fileName: output.fileName,
        exists: existsSync(output.absolutePath),
        inspectionError: errorRecord(error),
      });
    }
  }
  return outputs;
};

const inspectB07SceneOnlyOutput = async (target, {strict}) => {
  const output = target.b07SceneOnlyOutput;
  try {
    const file = await captureExistingOutput(output.absolutePath, {
      projectRoot,
      label: 'B07 纯纸艺 QA 诊断输出',
    });
    if (!file.exists) {
      if (strict) {
        throw new DirectorR10DiagnosticRenderError(
          'R10_DIAGNOSTIC_B07_SCENE_OUTPUT_MISSING',
          'B07 纯纸艺 QA 诊断输出缺失。',
        );
      }
      return {
        status: 'diagnostic-output-missing-not-release',
        compositionId: output.compositionId,
        path: output.relativePath,
        fileName: output.fileName,
        exists: false,
        diagnosticOnly: true,
        releaseEligible: false,
      };
    }
    const probe = probeOutput(output.absolutePath);
    const verifiedSpec = assertR10B07SceneOnlyOutputProbe(probe);
    const decodedVideoSha256 = hashDecodedVideo(output.absolutePath);
    const fileAfterInspection = await captureExistingOutput(output.absolutePath, {
      projectRoot,
      label: 'B07 纯纸艺 QA 诊断输出（检查后）',
    });
    if (
      !fileAfterInspection.exists ||
      stableJson({
        sha256: file.sha256,
        bytes: file.bytes,
        identity: file.identity,
      }) !==
        stableJson({
          sha256: fileAfterInspection.sha256,
          bytes: fileAfterInspection.bytes,
          identity: fileAfterInspection.identity,
        })
    ) {
      throw new DirectorR10DiagnosticRenderError(
        'R10_DIAGNOSTIC_B07_SCENE_OUTPUT_DRIFT_DURING_INSPECTION',
        'B07 纯纸艺 QA 诊断输出在规格与解码检查期间发生漂移。',
      );
    }
    return {
      status: 'diagnostic-output-generated-not-release',
      compositionId: output.compositionId,
      path: output.relativePath,
      fileName: output.fileName,
      ...file,
      probe,
      verifiedSpec,
      decodedVideoSha256,
      diagnosticOnly: true,
      productionEligible: false,
      releaseEligible: false,
      pairComparisonMember: false,
    };
  } catch (error) {
    if (strict) throw error;
    return {
      status: 'diagnostic-output-failed-not-release',
      compositionId: output.compositionId,
      path: output.relativePath,
      fileName: output.fileName,
      exists: existsSync(output.absolutePath),
      diagnosticOnly: true,
      productionEligible: false,
      releaseEligible: false,
      pairComparisonMember: false,
      inspectionError: errorRecord(error),
    };
  }
};

const assertOutputsStillStable = async (target, outputs, label) => {
  for (const targetOutput of target.outputs) {
    const recorded = outputs.find(
      (output) => output.compositionId === targetOutput.compositionId,
    );
    const current = await captureExistingOutput(targetOutput.absolutePath, {
      projectRoot,
      label: `${label} ${targetOutput.compositionId}`,
    });
    if (
      !recorded?.exists ||
      !current.exists ||
      stableJson({
        sha256: recorded.sha256,
        bytes: recorded.bytes,
        identity: recorded.identity,
      }) !==
        stableJson({
          sha256: current.sha256,
          bytes: current.bytes,
          identity: current.identity,
        })
    ) {
      throw new DirectorR10DiagnosticRenderError(
        'R10_DIAGNOSTIC_OUTPUT_DRIFT_AFTER_INSPECTION',
        `${label}期间诊断输出发生漂移：${targetOutput.compositionId}`,
      );
    }
  }
};

const assertB07SceneOnlyOutputStillStable = async (target, recorded, label) => {
  const current = await captureExistingOutput(
    target.b07SceneOnlyOutput.absolutePath,
    {
      projectRoot,
      label: `${label} B07 纯纸艺 QA 诊断输出`,
    },
  );
  if (
    !recorded?.exists ||
    !current.exists ||
    stableJson({
      sha256: recorded.sha256,
      bytes: recorded.bytes,
      identity: recorded.identity,
    }) !==
      stableJson({
        sha256: current.sha256,
        bytes: current.bytes,
        identity: current.identity,
      })
  ) {
    throw new DirectorR10DiagnosticRenderError(
      'R10_DIAGNOSTIC_B07_SCENE_OUTPUT_DRIFT_AFTER_INSPECTION',
      `${label}期间 B07 纯纸艺 QA 诊断输出发生漂移。`,
    );
  }
};

export const runDirectorR10DiagnosticPreview = async (manifestArgument) => {
  const manifestPath = resolveManifestArgument(manifestArgument);
  const manifestBinding = await readBoundManifest(manifestPath);
  const {manifest} = manifestBinding;
  assertDirectorR10DiagnosticManifest(manifest, {projectRoot});
  const target = resolveDirectorR10OutputTarget(manifest, {projectRoot});

  const inputsInitial = await captureDirectorR10InputSnapshot(manifest, {projectRoot});
  const validatorInitial = await captureValidator();
  const contextDocument = readKnowledgeContextDocument(manifest);
  const contextValidation = runKnowledgeContextValidation();
  const inputsPreRender = await captureDirectorR10InputSnapshot(manifest, {projectRoot});
  assertDirectorR10SnapshotStable(
    inputsInitial,
    inputsPreRender,
    '知识上下文复检期间输入',
  );
  await recaptureManifest(manifestPath, manifestBinding.snapshot);
  const validatorPreRender = await captureValidator();
  assertValidatorStable(validatorInitial, validatorPreRender);

  createDirectorR10OutputDirectory(target, {projectRoot});
  const createdAt = new Date().toISOString();
  const preflight = {
    schemaVersion: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.preflightReceiptSchema,
    status: 'diagnostic-preflight-passed-not-release',
    createdAt,
    taskId: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.taskId,
    diagnosticOnly: true,
    productionEligible: false,
    releaseEligible: false,
    publishAuthorized: false,
    userNormalSpeedReviewRequired: true,
    releaseIntegration: 'forbidden',
    manifest: {
      path: path.relative(projectRoot, manifestPath).split(path.sep).join('/'),
      ...manifestBinding.snapshot,
    },
    knowledgeContext: {
      path: manifest.knowledgeContext.path,
      sha256: manifest.knowledgeContext.sha256,
      document: contextDocument,
      validation: contextValidation,
    },
    validator: validatorPreRender,
    remotion: manifest.remotion,
    renderStrategy: {
      id: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.renderStrategy,
      visualMasterCompositionId:
        DIRECTOR_R10_DIAGNOSTIC_CONTRACT.visualMasterCompositionId,
      sfxAudioCompositionId:
        DIRECTOR_R10_DIAGNOSTIC_CONTRACT.sfxAudioCompositionId,
      videoDerivation: 'single-render-stream-copy',
    },
    b07PaperSceneOnlyQa: {
      compositionId:
        DIRECTOR_R10_DIAGNOSTIC_CONTRACT.b07SceneOnlyCompositionId,
      width: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.width,
      height: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.height,
      fps: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps,
      durationInFrames:
        DIRECTOR_R10_DIAGNOSTIC_CONTRACT.b07SceneOnlyDurationInFrames,
      path: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.b07SceneOnlyOutputPath,
      audioExpected: false,
      diagnosticOnly: true,
      pairComparisonMember: false,
      productionEligible: false,
      releaseEligible: false,
    },
    output: {
      root: manifest.output.root,
      runDirectory: manifest.output.runDirectory,
      overwrite: false,
    },
    inputsInitial: snapshotForReceipt(inputsInitial),
    inputsPreRender: snapshotForReceipt(inputsPreRender),
  };
  preflight.integritySealSha256 = stableJsonSha256(preflight);
  writeJsonAtomic(target.preflightReceiptPath, preflight, {projectRoot});
  const preflightFile = await captureSecureFile(target.preflightReceiptPath, {
    projectRoot,
    label: 'R10 诊断 preflight 回执',
  });

  let renderContext = null;
  let renderDerivation = null;
  try {
    renderDerivation = await renderPair({
      manifest,
      target,
      onContext: (context) => {
        renderContext = context;
      },
    });
    await renderB07SceneOnly({
      context: renderContext,
      target,
    });
    const inputsAfterRender = await captureDirectorR10InputSnapshot(manifest, {
      projectRoot,
    });
    assertDirectorR10SnapshotStable(
      inputsPreRender,
      inputsAfterRender,
      '受控渲染期间输入',
    );
    const manifestAfterRender = await recaptureManifest(
      manifestPath,
      manifestBinding.snapshot,
    );
    const validatorAfterRender = await captureValidator();
    assertValidatorStable(validatorPreRender, validatorAfterRender);
    const outputs = await inspectOutputs(target, {strict: true});
    const b07PaperSceneOnlyQa = await inspectB07SceneOnlyOutput(target, {
      strict: true,
    });
    const visualPairAudit = assertR10PairedVisualHashes(outputs);
    const audioPairAudit = assertR10PairedAudioHashes(outputs);
    const renderDerivationAudit = assertR10SingleVisualMasterDerivation(
      renderDerivation,
      outputs,
    );
    const speechPreservationAudit = auditRecordedSpeechPreservation({
      manifest,
      target,
    });
    const cueAudibilityAudit = auditRuntimeCueAudibility({manifest, target});
    await assertOutputsStillStable(target, outputs, '音频质量审计');
    await assertB07SceneOnlyOutputStillStable(
      target,
      b07PaperSceneOnlyQa,
      '音频质量审计',
    );
    const inputsAfterInspection = await captureDirectorR10InputSnapshot(manifest, {
      projectRoot,
    });
    assertDirectorR10SnapshotStable(
      inputsPreRender,
      inputsAfterInspection,
      '输出检查期间输入',
    );
    const manifestAfterInspection = await recaptureManifest(
      manifestPath,
      manifestBinding.snapshot,
    );
    const validatorAfterInspection = await captureValidator();
    assertValidatorStable(validatorPreRender, validatorAfterInspection);
    const contextValidationAfterRender = runKnowledgeContextValidation();
    const result = {
      schemaVersion: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.resultReceiptSchema,
      status: 'diagnostic-render-succeeded-awaiting-user-review',
      createdAt,
      completedAt: new Date().toISOString(),
      taskId: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.taskId,
      diagnosticOnly: true,
      productionEligible: false,
      releaseEligible: false,
      publishAuthorized: false,
      userNormalSpeedReviewRequired: true,
      userNormalSpeedReviewCompleted: false,
      releaseIntegration: 'forbidden',
      preflightReceipt: {
        fileName: path.basename(target.preflightReceiptPath),
        sha256: preflightFile.sha256,
        bytes: preflightFile.bytes,
        integritySealSha256: preflight.integritySealSha256,
      },
      manifestBeforeRender: manifestBinding.snapshot,
      manifestAfterRender,
      manifestAfterInspection,
      validatorBeforeRender: validatorPreRender,
      validatorAfterRender,
      validatorAfterInspection,
      contextValidationBeforeRender: contextValidation,
      contextValidationAfterRender,
      inputsBeforeRender: snapshotForReceipt(inputsPreRender),
      inputsAfterRender: snapshotForReceipt(inputsAfterRender),
      inputsAfterInspection: snapshotForReceipt(inputsAfterInspection),
      outputs,
      b07PaperSceneOnlyQa,
      renderDerivationAudit,
      visualPairAudit,
      audioPairAudit,
      speechPreservationAudit,
      cueAudibilityAudit,
    };
    result.integritySealSha256 = stableJsonSha256(result);
    writeJsonAtomic(target.resultReceiptPath, result, {projectRoot});
    return {target, result};
  } catch (error) {
    let postFailureIntegrity;
    try {
      const inputsAfterFailure = await captureDirectorR10InputSnapshot(manifest, {
        projectRoot,
      });
      assertDirectorR10SnapshotStable(
        inputsPreRender,
        inputsAfterFailure,
        '诊断渲染失败后输入',
      );
      await recaptureManifest(manifestPath, manifestBinding.snapshot);
      const validatorAfterFailure = await captureValidator();
      assertValidatorStable(validatorPreRender, validatorAfterFailure);
      const contextValidationAfterFailure = runKnowledgeContextValidation();
      postFailureIntegrity = {
        status: 'stable',
        inputsAfterFailure: snapshotForReceipt(inputsAfterFailure),
        validatorAfterFailure,
        contextValidationAfterFailure,
      };
    } catch (integrityError) {
      postFailureIntegrity = {
        status: 'failed',
        error: errorRecord(integrityError),
      };
    }
    const outputs = await inspectOutputs(target, {strict: false});
    const b07PaperSceneOnlyQa = await inspectB07SceneOnlyOutput(target, {
      strict: false,
    });
    const failure = {
      schemaVersion: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.resultReceiptSchema,
      status: 'diagnostic-render-failed-not-release',
      createdAt,
      failedAt: new Date().toISOString(),
      taskId: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.taskId,
      diagnosticOnly: true,
      productionEligible: false,
      releaseEligible: false,
      publishAuthorized: false,
      userNormalSpeedReviewRequired: true,
      userNormalSpeedReviewCompleted: false,
      releaseIntegration: 'forbidden',
      error: errorRecord(error),
      renderStrategy: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.renderStrategy,
      renderDerivation,
      preflightReceipt: {
        fileName: path.basename(target.preflightReceiptPath),
        sha256: preflightFile.sha256,
        bytes: preflightFile.bytes,
        integritySealSha256: preflight.integritySealSha256,
      },
      inputsBeforeRender: snapshotForReceipt(inputsPreRender),
      postFailureIntegrity,
      outputs,
      b07PaperSceneOnlyQa,
    };
    failure.integritySealSha256 = stableJsonSha256(failure);
    writeJsonAtomic(target.resultReceiptPath, failure, {projectRoot});
    throw error;
  } finally {
    if (renderContext) await renderContext.close().catch(() => {});
  }
};

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0].startsWith('-')) {
    usage();
    process.exitCode = 1;
    return;
  }
  try {
    const {target, result} = await runDirectorR10DiagnosticPreview(args[0]);
    console.log(
      JSON.stringify(
        {
          status: result.status,
          diagnosticOnly: true,
          productionEligible: false,
          releaseEligible: false,
          userNormalSpeedReviewRequired: true,
          outputDirectory: path.relative(projectRoot, target.runPath).split(path.sep).join('/'),
          resultReceipt: path
            .relative(projectRoot, target.resultReceiptPath)
            .split(path.sep)
            .join('/'),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(JSON.stringify(errorRecord(error), null, 2));
    process.exitCode = 1;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await main();
}
