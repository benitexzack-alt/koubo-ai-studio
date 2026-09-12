#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, rmSync} from 'node:fs';
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
  assertR10CueAudibilityAudit,
  assertR10CompositionMetadata,
  assertR10OutputProbe,
  assertR10PairedAudioHashes,
  assertR10PairedVisualHashes,
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

const decodeMonoFloatAudio = ({inputPath, startSeconds, durationSeconds}) => {
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
    String(DIRECTOR_R10_DIAGNOSTIC_CONTRACT.speechAuditSampleRate),
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
  });
  const noSfx = decodeMonoFloatAudio({
    inputPath: noSfxOutput.absolutePath,
    startSeconds: 0,
    durationSeconds,
  });
  const sampleRate = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.speechAuditSampleRate;
  const sampleCount = Math.min(withSfx.length, noSfx.length);
  const audits = cues.map((cue) => {
    const startSeconds = Math.max(
      0,
      cue.frame / DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps - 0.1,
    );
    const endSeconds = Math.min(durationSeconds, startSeconds + 0.9);
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
      windowStartSeconds: startSeconds,
      windowEndSeconds: endSeconds,
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

const renderPair = async ({manifest, target, onContext}) => {
  const context = await openRenderContext(manifest);
  onContext(context);
  const compositionById = new Map(
    context.compositions.map((composition) => [composition.id, composition]),
  );
  for (const output of target.outputs) {
    const composition = compositionById.get(output.compositionId);
    if (!composition) {
      throw new DirectorR10DiagnosticRenderError(
        'R10_DIAGNOSTIC_COMPOSITION_PAIR_INCOMPLETE',
        `渲染上下文缺少 ${output.compositionId}。`,
      );
    }
    let lastReportedPercent = -1;
    await context.renderMedia({
      serveUrl: context.serveUrl,
      composition,
      codec: 'h264',
      outputLocation: output.absolutePath,
      frameRange: [0, DIRECTOR_R10_DIAGNOSTIC_CONTRACT.durationInFrames - 1],
      crf: 17,
      pixelFormat: 'yuv420p',
      audioCodec: 'aac',
      audioBitrate: '192k',
      x264Preset: 'slow',
      concurrency: 2,
      puppeteerInstance: context.browser,
      overwrite: false,
      logLevel: 'error',
      onProgress: ({progress}) => {
        const percent = Math.floor(progress * 100);
        if (percent !== lastReportedPercent && percent % 20 === 0) {
          process.stdout.write(
            `\r${output.compositionId} ${String(percent).padStart(3, ' ')}%`,
          );
          lastReportedPercent = percent;
        }
      },
    });
    process.stdout.write(`\r${output.compositionId} 100%\n`);
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
  try {
    await renderPair({
      manifest,
      target,
      onContext: (context) => {
        renderContext = context;
      },
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
    const visualPairAudit = assertR10PairedVisualHashes(outputs);
    const audioPairAudit = assertR10PairedAudioHashes(outputs);
    const speechPreservationAudit = auditRecordedSpeechPreservation({
      manifest,
      target,
    });
    const cueAudibilityAudit = auditRuntimeCueAudibility({manifest, target});
    await assertOutputsStillStable(target, outputs, '音频质量审计');
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
      preflightReceipt: {
        fileName: path.basename(target.preflightReceiptPath),
        sha256: preflightFile.sha256,
        bytes: preflightFile.bytes,
        integritySealSha256: preflight.integritySealSha256,
      },
      inputsBeforeRender: snapshotForReceipt(inputsPreRender),
      postFailureIntegrity,
      outputs,
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
