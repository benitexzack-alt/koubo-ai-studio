#!/usr/bin/env node

import {
  createHash,
} from 'node:crypto';
import {
  closeSync,
  existsSync,
  openSync,
  lstatSync,
  mkdtempSync,
  readSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const directorSkillRoot = path.resolve(path.dirname(scriptPath), '..');
const defaultRepoRoot = path.resolve(directorSkillRoot, '../..');
const authoritativePlanValidatorPath = path.join(
  directorSkillRoot,
  'scripts/validate-director-output.mjs',
);
const authoritativePlanCompilerPath = path.join(
  directorSkillRoot,
  'scripts/compile-director-plan.mjs',
);

const EXACT = Object.freeze({
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 900,
  durationSeconds: 30,
  sampleRate: 48000,
  channels: 2,
  samplesPerChannel: 1440000,
  pcmCodec: 'pcm_s24le',
  pcmBytesPerSample: 3,
  aacCodec: 'aac',
  aacProfile: 'LC',
  aacTimeBase: '1/48000',
  aacFrameSamples: 1024,
  aacAlignmentPrerollSamples: 768,
  aacEncoderPostrollSamples: 4096,
  maxAacPaddingSamples: 1024,
  maxAacPaddingPeakDbfs: -80,
  noSfxSpokenCorrelationMin: 0.999,
  withSfxNoSfxVoiceCorrelationMin: 0.99,
  spokenGainMin: 0.97,
  spokenGainMax: 1.03,
  spokenRmsRatioMin: 0.97,
  spokenRmsRatioMax: 1.03,
  spokenDcOffsetMax: 0.0005,
  spokenResidualToReferenceRmsMax: 0.03,
  effectiveEnergyBlockFrames: 960,
  effectiveEnergyThresholdDbfs: -50,
  spokenMinimumRmsDbfs: -45,
  spokenMinimumActiveBlockRatio: 0.15,
  spokenMinimumActiveBlocks: 150,
  outsideSfxDifferenceRmsMaxDbfs: -70,
  maximumAllowedSfxWindowRatio: 0.35,
  minimumOutsideSfxFrameRatio: 0.60,
  outsideSfxMinimumActiveBlockRatio: 0.10,
  outsideSfxMinimumActiveBlocks: 100,
  sfxEnvelopeAbsoluteThresholdDbfs: -70,
  sfxEnvelopePeakRelativeThresholdDb: -60,
  maximumSingleCueEffectiveDurationSeconds: 2,
  cueMinimumExpectedRmsDbfs: -45,
  cueMinimumRetainedRatio: 1,
  cueMinimumObservedToExpectedRmsRatio: 0.90,
  cueMaximumObservedToExpectedRmsRatio: 1.10,
  cueWaveformCorrelationMin: 0.99,
  cueWaveformGainMin: 0.90,
  cueWaveformGainMax: 1.10,
  cueWaveformResidualToReferenceRmsMax: 0.10,
  expectedSfxPcmCorrelationMin: 0.999999,
  expectedSfxPcmGainMin: 0.99999,
  expectedSfxPcmGainMax: 1.00001,
  expectedSfxPcmRmsRatioMin: 0.99999,
  expectedSfxPcmRmsRatioMax: 1.00001,
  expectedSfxPcmDcOffsetMax: 0.000001,
  expectedSfxPcmResidualToReferenceRmsMax: 0.00002,
  expectedSfxAacCorrelationMin: 0.995,
  expectedSfxAacGainMin: 0.97,
  expectedSfxAacGainMax: 1.03,
  expectedSfxAacRmsRatioMin: 0.97,
  expectedSfxAacRmsRatioMax: 1.03,
  expectedSfxAacDcOffsetMax: 0.0005,
  expectedSfxAacResidualToReferenceRmsMax: 0.08,
  declaredTailMarkerCorrelationMin: 0.98,
  declaredTailMarkerRmsRatioMin: 0.85,
  declaredTailMarkerRmsRatioMax: 1.15,
  pcmSpokenCorrelationMin: 0.99999999,
  pcmSpokenGainTolerance: 0.00001,
  pcmSpokenRmsRatioTolerance: 0.00001,
  pcmSpokenDcOffsetMax: 0.000001,
  pcmSpokenResidualToReferenceRmsMax: 0.00001,
  reportSilenceFloorDbfs: -300,
  correlationMaxDelaySamples: 64,
  correlationSearchStrideFrames: 257,
  sfxWindowCodecGuardSamples: 2048,
  freezeSeconds: 1.5,
});

const SHA256_RE = /^[a-f0-9]{64}$/;
const FORMAL_PLAN_SCHEMA = 'koubo-director-output/v1';
const SYNTHETIC_PLAN_SCHEMA = 'koubo-director-ab-synthetic-fixture/v1';
const FREEZE_QA_SCHEMA = 'koubo-director-freeze-qa/v2';
const FREEZE_DETECTOR = Object.freeze({
  filter: 'freezedetect',
  noiseDb: -60,
  durationSeconds: EXACT.freezeSeconds,
  ffmpegFilter: `freezedetect=noise=-60dB:d=${EXACT.freezeSeconds}`,
});
const LOCAL_MOTION = Object.freeze({
  poseCount: 3,
  poseHoldFrames: 3,
  durationFrames: 9,
  maximumRegionAreaRatio: 0.35,
  maximumPlanGapFramesExclusive: 45,
  significantLumaDelta: 5,
  minimumChangedPixels: 64,
  minimumChangedRatio: 0.001,
  minimumCoherentRatio: 0.55,
  maximumStableChangedPixels: 64,
  maximumHoldChangedPixels: 128,
  maximumHoldChangedRatio: 0.01,
  minimumPoseToAuthorityPsnrDb: 55,
  minimumPoseIdentityCosine: 0.94,
  minimumPoseIdentityGain: 0.80,
  maximumPoseIdentityGain: 1.20,
  maximumPoseIdentityResidualRatio: 0.35,
  minimumPoseIdentityRecall: 0.80,
  minimumIdentityDiscriminativePixels: 64,
  maximumIdentityMaskedMae: 12,
  minimumIdentityCandidateMaeMargin: 1,
  minimumAuthorityAssetPsnrDb: 32,
});
const CHAIN_KEYS = Object.freeze([
  'authorityTranscriptSha256',
  'chainSha256',
  'fileBindingsSha256',
  'planPayloadSha256',
  'referenceSha256',
  'requestCanonicalSha256',
  'schemaVersion',
  'styleSha256',
]);

const stableError = (code, detail = '') => {
  const error = new Error(`${code}${detail ? `:${detail}` : ''}`);
  error.code = code;
  return error;
};

const invariant = (condition, code, detail = '') => {
  if (!condition) throw stableError(code, detail);
};

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value) => Number.isFinite(Number(value));
const closeTo = (actual, expected, tolerance = 0.001) =>
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance;

const exactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');

const uniqueBy = (items, predicate) => items.filter(predicate);

const exactVisualBinding = (bindings, role, id, code) => {
  const matches = uniqueBy(bindings, (binding) => binding?.role === role && binding?.id === id);
  invariant(matches.length === 1, code, `${role}:${id}:${matches.length}`);
  return matches[0];
};

const validateBoundVisualAsset = ({assetId, assetsById, bindings, allowedRoles}) => {
  const asset = assetsById.get(assetId);
  invariant(asset && allowedRoles.includes(asset.role), 'DIRECTOR_AB_FREEZE_ASSET_ROLE_INVALID', assetId);
  invariant(typeof asset.path === 'string' && path.isAbsolute(asset.path), 'DIRECTOR_AB_FREEZE_ASSET_PATH_INVALID', assetId);
  invariant(typeof asset.staticFileName === 'string' && path.basename(asset.staticFileName) === asset.staticFileName, 'DIRECTOR_AB_FREEZE_ASSET_PUBLIC_NAME_INVALID', assetId);
  invariant(SHA256_RE.test(asset.sha256), 'DIRECTOR_AB_FREEZE_ASSET_SHA_INVALID', assetId);
  const sourceBinding = exactVisualBinding(bindings, 'visual-state', assetId, 'DIRECTOR_AB_FREEZE_SOURCE_BINDING_INVALID');
  invariant(sourceBinding.path === asset.path && sourceBinding.sha256 === asset.sha256, 'DIRECTOR_AB_FREEZE_SOURCE_BINDING_DRIFT', assetId);
  const publicBinding = exactVisualBinding(bindings, 'public-media', `public-visual-state-${assetId}`, 'DIRECTOR_AB_FREEZE_PUBLIC_BINDING_INVALID');
  invariant(path.basename(publicBinding.path) === asset.staticFileName && publicBinding.sha256 === asset.sha256, 'DIRECTOR_AB_FREEZE_PUBLIC_BINDING_DRIFT', assetId);
  requireAbsoluteRegularFile(asset.path, 'DIRECTOR_AB_FREEZE_ASSET_FILE_INVALID');
  requireAbsoluteRegularFile(publicBinding.path, 'DIRECTOR_AB_FREEZE_PUBLIC_FILE_INVALID');
  invariant(sha256File(asset.path) === asset.sha256, 'DIRECTOR_AB_FREEZE_ASSET_SHA_MISMATCH', assetId);
  invariant(sha256File(publicBinding.path) === asset.sha256, 'DIRECTOR_AB_FREEZE_PUBLIC_SHA_MISMATCH', assetId);
  return {
    id: assetId,
    role: asset.role,
    sourcePath: asset.path,
    publicPath: publicBinding.path,
    sha256: asset.sha256,
  };
};

export const validateFreezeClassificationPlan = (plan) => {
  if (plan.schemaVersion === SYNTHETIC_PLAN_SCHEMA) {
    return {
      schema: FREEZE_QA_SCHEMA,
      syntheticTestOnly: true,
      width: EXACT.width,
      height: EXACT.height,
      fps: EXACT.fps,
      durationSeconds: EXACT.durationSeconds,
      scenes: (plan.scenes ?? []).map((scene) => ({
        id: scene.id,
        type: scene.type,
        method: scene.stateReveal?.method ?? null,
        start: Number(scene.start),
        end: Number(scene.end),
        eligible: false,
        events: [],
      })),
      boundAssets: [],
    };
  }
  invariant(Array.isArray(plan.scenes) && plan.scenes.length > 0, 'DIRECTOR_AB_FREEZE_SCENES_INVALID');
  invariant(Array.isArray(plan.media?.visualStateAssets), 'DIRECTOR_AB_FREEZE_VISUAL_ASSETS_INVALID');
  invariant(Array.isArray(plan.provenance?.fileBindings), 'DIRECTOR_AB_FREEZE_BINDINGS_INVALID');
  const assetsById = new Map();
  for (const asset of plan.media.visualStateAssets) {
    invariant(isRecord(asset) && typeof asset.id === 'string' && !assetsById.has(asset.id), 'DIRECTOR_AB_FREEZE_ASSET_ID_INVALID', asset?.id);
    assetsById.set(asset.id, asset);
  }
  const boundAssets = new Map();
  const bindAsset = (assetId, allowedRoles) => {
    const existing = boundAssets.get(assetId);
    if (existing) {
      invariant(allowedRoles.includes(existing.role), 'DIRECTOR_AB_FREEZE_ASSET_ROLE_INVALID', assetId);
      return existing;
    }
    const bound = validateBoundVisualAsset({
      assetId,
      assetsById,
      bindings: plan.provenance.fileBindings,
      allowedRoles,
    });
    boundAssets.set(assetId, bound);
    return bound;
  };
  const scenes = plan.scenes.map((scene) => {
    invariant(isRecord(scene) && typeof scene.id === 'string' && finite(scene.start) && finite(scene.end), 'DIRECTOR_AB_FREEZE_SCENE_INVALID', scene?.id);
    const start = Number(scene.start);
    const end = Number(scene.end);
    invariant(start >= 0 && end > start && end <= EXACT.durationSeconds, 'DIRECTOR_AB_FREEZE_SCENE_WINDOW_INVALID', scene.id);
    const method = scene.stateReveal?.method ?? null;
    const eligible = scene.type === 'complex-explanation' && method === 'progressive-local-assembly';
    if (!eligible) return {id: scene.id, type: scene.type, method, start, end, eligible, events: []};
    const reveal = scene.stateReveal;
    invariant(Array.isArray(reveal.states) && reveal.states.length >= 2, 'DIRECTOR_AB_FREEZE_STATES_INVALID', scene.id);
    invariant(Array.isArray(reveal.transitions) && reveal.transitions.length === reveal.states.length - 1, 'DIRECTOR_AB_FREEZE_TRANSITIONS_INVALID', scene.id);
    invariant(isRecord(reveal.audit), 'DIRECTOR_AB_FREEZE_AUDIT_INVALID', scene.id);
    const audit = reveal.audit;
    invariant(Number.isInteger(audit.maximumUnchangedFrames) && audit.maximumUnchangedFrames >= 0 && audit.maximumUnchangedFrames < LOCAL_MOTION.maximumPlanGapFramesExclusive, 'DIRECTOR_AB_FREEZE_PLAN_GAP_INVALID', `${scene.id}:${audit.maximumUnchangedFrames}`);
    const sceneStartFrame = Math.round(start * EXACT.fps);
    const sceneEndFrame = Math.round(end * EXACT.fps);
    invariant(Number.isInteger(audit.windowStartFrame) && audit.windowStartFrame === sceneStartFrame, 'DIRECTOR_AB_FREEZE_AUDIT_START_INVALID', scene.id);
    invariant(Number.isInteger(audit.windowEndFrame) && audit.windowEndFrame > sceneStartFrame && audit.windowEndFrame < sceneEndFrame, 'DIRECTOR_AB_FREEZE_AUDIT_END_INVALID', scene.id);
    const states = reveal.states;
    const stateIds = new Set();
    const events = [];
    states.forEach((state, index) => {
      invariant(isRecord(state) && typeof state.id === 'string' && !stateIds.has(state.id), 'DIRECTOR_AB_FREEZE_STATE_ID_INVALID', state?.id);
      stateIds.add(state.id);
      invariant(Number.isInteger(state.atFrame) && state.atFrame >= sceneStartFrame && state.atFrame < sceneEndFrame, 'DIRECTOR_AB_FREEZE_STATE_FRAME_INVALID', `${scene.id}:${state.id}`);
      bindAsset(state.assetId, ['base-state', 'revealed-state']);
      if (index === 0) {
        invariant(exactKeys(state.localMotion, ['model']) && state.localMotion.model === 'neutral/v1', 'DIRECTOR_AB_FREEZE_INITIAL_MOTION_INVALID', state.id);
        invariant(state.atFrame === sceneStartFrame, 'DIRECTOR_AB_FREEZE_INITIAL_STATE_FRAME_INVALID', state.id);
        return;
      }
      const previous = states[index - 1];
      invariant(state.atFrame - previous.atFrame >= LOCAL_MOTION.durationFrames + 1, 'DIRECTOR_AB_FREEZE_POSE_PREROLL_INVALID', state.id);
      invariant(exactKeys(state.localMotion, ['model', 'region', 'poseAssetIds']) && state.localMotion.model === 'authored-local-stop-motion/v1', 'DIRECTOR_AB_FREEZE_LOCAL_MOTION_INVALID', state.id);
      const region = state.localMotion.region;
      invariant(exactKeys(region, ['x', 'y', 'width', 'height']), 'DIRECTOR_AB_FREEZE_REGION_INVALID', state.id);
      const {x, y, width, height} = region;
      const area = width * height;
      invariant(Number.isInteger(x) && x >= 0 && Number.isInteger(y) && y >= 0 && Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0 && x + width <= EXACT.width && y + height <= EXACT.height && area / (EXACT.width * EXACT.height) <= LOCAL_MOTION.maximumRegionAreaRatio, 'DIRECTOR_AB_FREEZE_REGION_INVALID', `${state.id}:${x},${y},${width},${height}`);
      invariant(Array.isArray(state.localMotion.poseAssetIds) && state.localMotion.poseAssetIds.length === LOCAL_MOTION.poseCount && new Set(state.localMotion.poseAssetIds).size === LOCAL_MOTION.poseCount, 'DIRECTOR_AB_FREEZE_POSE_ASSETS_INVALID', state.id);
      state.localMotion.poseAssetIds.forEach((poseAssetId, poseIndex) => {
        bindAsset(poseAssetId, ['motion-pose']);
        events.push({
          id: `${state.id}:pose-${poseIndex + 1}`,
          sceneId: scene.id,
          stateId: state.id,
          assetId: poseAssetId,
          baseAssetId: previous.assetId,
          targetAssetId: state.assetId,
          kind: 'authored-pose',
          poseIndex,
          frame: state.atFrame - LOCAL_MOTION.durationFrames + poseIndex * LOCAL_MOTION.poseHoldFrames,
          holdFrames: LOCAL_MOTION.poseHoldFrames,
          region: {...region, area},
        });
      });
      events.push({
        id: `${state.id}:authority-state`,
        sceneId: scene.id,
        stateId: state.id,
        assetId: state.assetId,
        baseAssetId: previous.assetId,
        targetAssetId: state.assetId,
        kind: 'authority-state',
        poseIndex: null,
        frame: state.atFrame,
        holdFrames: null,
        region: {...region, area},
      });
      const transition = reveal.transitions[index - 1];
      invariant(isRecord(transition) && transition.fromStateId === previous.id && transition.toStateId === state.id && transition.kind === 'visible-discrete-assembly' && transition.swapFrame === state.atFrame, 'DIRECTOR_AB_FREEZE_TRANSITION_DRIFT', `${scene.id}:${state.id}`);
    });
    const auditStates = states.filter((state) => state.atFrame >= sceneStartFrame && state.atFrame <= audit.windowEndFrame);
    const auditPoints = [sceneStartFrame, ...auditStates.slice(1).map((state) => state.atFrame), audit.windowEndFrame];
    const computedMaximumGap = Math.max(
      ...auditPoints.slice(1).map((frame, index) => frame - auditPoints[index]),
      ...states.slice(1).map((state, index) => state.atFrame - states[index].atFrame),
    );
    invariant(audit.firstChangeFrame === auditStates[1]?.atFrame && audit.namedEntityStateCount === new Set(auditStates.map((state) => state.entityStateId)).size && audit.maximumUnchangedFrames === computedMaximumGap, 'DIRECTOR_AB_FREEZE_AUDIT_DRIFT', scene.id);
    return {
      id: scene.id,
      type: scene.type,
      method,
      start,
      end,
      startFrame: sceneStartFrame,
      endFrame: sceneEndFrame,
      explainStart: audit.windowStartFrame / EXACT.fps,
      explainEnd: audit.windowEndFrame / EXACT.fps,
      eligible,
      maximumUnchangedFrames: audit.maximumUnchangedFrames,
      events,
    };
  });
  return {
    schema: FREEZE_QA_SCHEMA,
    syntheticTestOnly: false,
    width: EXACT.width,
    height: EXACT.height,
    fps: EXACT.fps,
    durationSeconds: EXACT.durationSeconds,
    scenes,
    boundAssets: [...boundAssets.values()],
  };
};

const dbfs = (linear) => linear === 0 ? EXACT.reportSilenceFloorDbfs : 20 * Math.log10(linear);

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};

export const stableStringify = (value) => JSON.stringify(canonicalize(value));
export const sha256Text = (value) => createHash('sha256').update(value).digest('hex');

const sha256Buffer = (buffer) => createHash('sha256').update(buffer).digest('hex');
export const sha256File = (filePath) => {
  const hash = createHash('sha256');
  const descriptor = openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest('hex');
};

const CLI_ARGUMENT_ORDER = Object.freeze([
  'plan',
  'visual-master',
  'output-dir',
  'ffmpeg',
  'ffprobe',
  'receipt',
]);

export const parseDirectorAbCliArgs = (argv) => {
  invariant(
    Array.isArray(argv) && argv.length === CLI_ARGUMENT_ORDER.length * 2,
    'DIRECTOR_AB_ARGUMENT_COUNT_INVALID',
    argv?.length,
  );
  const parsed = {};
  for (let index = 0; index < CLI_ARGUMENT_ORDER.length; index += 1) {
    const key = CLI_ARGUMENT_ORDER[index];
    const token = argv[index * 2];
    invariant(token === `--${key}`, 'DIRECTOR_AB_ARGUMENT_ORDER_INVALID', `${index}:${token}`);
    const value = argv[(index * 2) + 1];
    invariant(value !== undefined && !value.startsWith('--'), 'DIRECTOR_AB_ARGUMENT_VALUE_MISSING', key);
    parsed[key] = value;
  }
  return parsed;
};

const SUPERVISOR_ANCHOR_ENV_KEYS = Object.freeze([
  'KOUBO_DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA256',
  'KOUBO_DIRECTOR_SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256',
]);

export const buildDirectorSubprocessEnv = ({executable, sourceEnv = process.env}) => {
  const env = {
    PATH: path.dirname(executable),
    LANG: 'C',
    LC_ALL: 'C',
  };
  for (const key of SUPERVISOR_ANCHOR_ENV_KEYS) {
    const value = sourceEnv?.[key];
    if (typeof value === 'string' && value.length > 0) env[key] = value;
  }
  return env;
};

export const runDirectorRestrictedSubprocess = (
  executable,
  args,
  {captureStdout = false, allowFailure = false, sourceEnv = process.env, cwd} = {},
) => {
  const result = spawnSync(executable, args, {
    encoding: captureStdout ? null : 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    env: buildDirectorSubprocessEnv({executable, sourceEnv}),
    ...(cwd === undefined ? {} : {cwd}),
    stdio: captureStdout ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  });
  if (!allowFailure && result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr ?? '');
    throw stableError('DIRECTOR_AB_SUBPROCESS_FAILED', `${path.basename(executable)}:${result.status}:${stderr.trim().slice(-1200)}`);
  }
  return result;
};

const run = runDirectorRestrictedSubprocess;

const requireAbsoluteRegularFile = (filePath, code) => {
  invariant(typeof filePath === 'string' && path.isAbsolute(filePath), code, 'not-absolute');
  invariant(existsSync(filePath), code, 'missing');
  const stat = lstatSync(filePath);
  invariant(stat.isFile() && !stat.isSymbolicLink(), code, 'not-regular-file');
  return filePath;
};

const requireTool = (filePath, label) => {
  invariant(typeof filePath === 'string' && path.isAbsolute(filePath), 'DIRECTOR_AB_TOOL_INVALID', `${label}:not-absolute`);
  requireAbsoluteRegularFile(realpathSync(filePath), 'DIRECTOR_AB_TOOL_INVALID');
  return {
    id: label,
    declaredPath: filePath,
    realPath: realpathSync(filePath),
    sha256: sha256File(realpathSync(filePath)),
  };
};

const probe = (ffprobe, filePath) => {
  const result = run(ffprobe, [
    '-v', 'error',
    '-show_entries',
    'format=filename,start_time,duration,size:stream=index,codec_type,codec_name,profile,width,height,r_frame_rate,avg_frame_rate,time_base,start_pts,start_time,duration,duration_ts,nb_frames,sample_rate,channels',
    '-of', 'json',
    filePath,
  ], {captureStdout: true});
  try {
    return JSON.parse(result.stdout.toString('utf8'));
  } catch {
    throw stableError('DIRECTOR_AB_FFPROBE_JSON_INVALID', filePath);
  }
};

const probeFirstPacket = (ffprobe, filePath, streamSelector) => {
  const result = run(ffprobe, [
    '-v', 'error',
    '-select_streams', streamSelector,
    '-show_packets',
    '-show_entries', 'packet=pts,pts_time,dts,dts_time,duration,duration_time,flags:packet_side_data=side_data_type,skip_samples,discard_padding',
    '-read_intervals', '%+#1',
    '-of', 'json',
    filePath,
  ], {captureStdout: true});
  let parsed;
  try {
    parsed = JSON.parse(result.stdout.toString('utf8'));
  } catch {
    throw stableError('DIRECTOR_AB_FFPROBE_PACKET_JSON_INVALID', `${filePath}:${streamSelector}`);
  }
  invariant(Array.isArray(parsed.packets) && parsed.packets.length === 1, 'DIRECTOR_AB_FIRST_PACKET_MISSING', `${filePath}:${streamSelector}`);
  return parsed.packets[0];
};

const oneStream = (probeResult, type, code) => {
  const streams = (probeResult.streams ?? []).filter((stream) => stream.codec_type === type);
  invariant(streams.length === 1, code, `${type}:${streams.length}`);
  return streams[0];
};

const rational = (value) => {
  const [numerator, denominator] = String(value).split('/').map(Number);
  return denominator ? numerator / denominator : Number(value);
};

const packetSkipSamples = (packet) => {
  const skip = (packet?.side_data_list ?? []).find((item) => item.side_data_type === 'Skip Samples');
  if (!skip) return {present: false, samples: 0};
  invariant(Number.isInteger(Number(skip.skip_samples)) && Number(skip.skip_samples) >= 0, 'DIRECTOR_AB_AUDIO_SKIP_SAMPLES_INVALID', skip.skip_samples);
  invariant(Number.isInteger(Number(skip.discard_padding ?? 0)) && Number(skip.discard_padding ?? 0) >= 0, 'DIRECTOR_AB_AUDIO_DISCARD_PADDING_INVALID', skip.discard_padding);
  return {present: true, samples: Number(skip.skip_samples)};
};

export const validateTimelineMetrics = ({media, videoFirstPacket, audioFirstPacket}) => {
  const video = oneStream(media, 'video', 'DIRECTOR_AB_TIMELINE_VIDEO_STREAM_INVALID');
  const audio = audioFirstPacket
    ? oneStream(media, 'audio', 'DIRECTOR_AB_TIMELINE_AUDIO_STREAM_INVALID')
    : null;
  const videoTickSeconds = rational(video.time_base);
  invariant(Number.isFinite(videoTickSeconds) && videoTickSeconds > 0, 'DIRECTOR_AB_VIDEO_TIME_BASE_INVALID', video.time_base);
  invariant(Math.abs(Number(media.format?.start_time)) <= 1 / EXACT.sampleRate, 'DIRECTOR_AB_CONTAINER_START_TIME_INVALID', media.format?.start_time);
  invariant(Math.abs(Number(video.start_pts)) <= 1, 'DIRECTOR_AB_VIDEO_STREAM_START_PTS_INVALID', video.start_pts);
  invariant(Math.abs(Number(video.start_time)) <= videoTickSeconds, 'DIRECTOR_AB_VIDEO_STREAM_START_TIME_INVALID', video.start_time);
  invariant(Number.isFinite(Number(videoFirstPacket?.pts)), 'DIRECTOR_AB_VIDEO_FIRST_PACKET_PTS_MISSING');
  invariant(Math.abs(Number(videoFirstPacket.pts)) <= 1, 'DIRECTOR_AB_VIDEO_FIRST_PACKET_PTS_INVALID', videoFirstPacket.pts);
  const result = {
    containerStartTimeSeconds: Number(media.format?.start_time),
    video: {
      timeBase: video.time_base,
      streamStartPts: Number(video.start_pts),
      streamStartTimeSeconds: Number(video.start_time),
      firstPacketPts: Number(videoFirstPacket.pts),
      firstPacketPtsTimeSeconds: Number(videoFirstPacket.pts_time),
      maximumStartErrorTicks: 1,
    },
  };
  if (!audio) return result;
  invariant(audio.time_base === EXACT.aacTimeBase, 'DIRECTOR_AB_AUDIO_TIME_BASE_INVALID', audio.time_base);
  invariant(Math.abs(Number(audio.start_pts)) <= 1, 'DIRECTOR_AB_AUDIO_STREAM_START_PTS_INVALID', audio.start_pts);
  invariant(Math.abs(Number(audio.start_time)) <= 1 / EXACT.sampleRate, 'DIRECTOR_AB_AUDIO_STREAM_START_TIME_INVALID', audio.start_time);
  invariant(Number.isFinite(Number(audioFirstPacket?.pts)), 'DIRECTOR_AB_AUDIO_FIRST_PACKET_PTS_MISSING');
  const skip = packetSkipSamples(audioFirstPacket);
  const skipSamples = skip.samples;
  invariant(Number(audioFirstPacket.pts) >= 0 || skip.present, 'DIRECTOR_AB_AUDIO_NEGATIVE_FIRST_PACKET_WITHOUT_SKIP_SAMPLES', audioFirstPacket.pts);
  const effectiveFirstSample = Number(audioFirstPacket.pts) + skipSamples;
  invariant(
    Math.abs(effectiveFirstSample) <= 1,
    'DIRECTOR_AB_AUDIO_EFFECTIVE_FIRST_SAMPLE_INVALID',
    `${audioFirstPacket.pts}:${skipSamples}:${effectiveFirstSample}`,
  );
  result.audio = {
    timeBase: audio.time_base,
    streamStartPts: Number(audio.start_pts),
    streamStartTimeSeconds: Number(audio.start_time),
    firstPacketPts: Number(audioFirstPacket.pts),
    firstPacketPtsTimeSeconds: Number(audioFirstPacket.pts_time),
    firstPacketSkipSideDataPresent: skip.present,
    firstPacketSkipSamples: skipSamples,
    effectiveFirstSample,
    maximumStartErrorSamples: 1,
  };
  return result;
};

export const validateDeliveryTimeline = (ffprobe, filePath) => {
  const media = probe(ffprobe, filePath);
  return validateTimelineMetrics({
    media,
    videoFirstPacket: probeFirstPacket(ffprobe, filePath, 'v:0'),
    audioFirstPacket: probeFirstPacket(ffprobe, filePath, 'a:0'),
  });
};

const validateVisualMaster = (ffprobe, filePath, expectedPath) => {
  invariant(
    path.normalize(filePath) === path.normalize(expectedPath),
    'DIRECTOR_AB_VISUAL_MASTER_PLAN_PATH_MISMATCH',
    `${filePath}:${expectedPath}`,
  );
  const media = probe(ffprobe, filePath);
  const video = oneStream(media, 'video', 'DIRECTOR_AB_VISUAL_MASTER_VIDEO_STREAM_INVALID');
  const audioStreams = (media.streams ?? []).filter((stream) => stream.codec_type === 'audio');
  invariant(audioStreams.length === 0, 'DIRECTOR_AB_VISUAL_MASTER_NOT_MUTED');
  invariant(video.codec_name === 'h264', 'DIRECTOR_AB_VISUAL_MASTER_CODEC_INVALID', video.codec_name);
  invariant(Number(video.width) === EXACT.width && Number(video.height) === EXACT.height, 'DIRECTOR_AB_VISUAL_MASTER_DIMENSIONS_INVALID');
  invariant(closeTo(rational(video.avg_frame_rate || video.r_frame_rate), EXACT.fps, 1e-9), 'DIRECTOR_AB_VISUAL_MASTER_FPS_INVALID');
  invariant(Number(video.nb_frames) === EXACT.frames, 'DIRECTOR_AB_VISUAL_MASTER_FRAME_COUNT_INVALID', video.nb_frames);
  invariant(closeTo(Number(video.duration), EXACT.durationSeconds, rational(video.time_base)), 'DIRECTOR_AB_VISUAL_MASTER_DURATION_INVALID', video.duration);
  invariant(closeTo(Number(media.format?.duration), EXACT.durationSeconds, rational(video.time_base)), 'DIRECTOR_AB_VISUAL_MASTER_CONTAINER_DURATION_INVALID', media.format?.duration);
  const timeline = validateTimelineMetrics({
    media,
    videoFirstPacket: probeFirstPacket(ffprobe, filePath, 'v:0'),
  });
  return {media, timeline};
};

const canonicalExistingFile = (filePath, code) => {
  invariant(typeof filePath === 'string' && path.isAbsolute(filePath), code, 'not-absolute');
  invariant(existsSync(filePath), code, 'missing');
  const canonicalPath = realpathSync(filePath);
  const stat = lstatSync(canonicalPath);
  invariant(stat.isFile() && !stat.isSymbolicLink(), code, 'not-regular-file');
  return canonicalPath;
};

const canonicalExistingDirectory = (directoryPath, code) => {
  invariant(typeof directoryPath === 'string' && path.isAbsolute(directoryPath), code, 'not-absolute');
  invariant(existsSync(directoryPath), code, 'missing');
  invariant(lstatSync(directoryPath).isDirectory(), code, 'not-directory');
  return realpathSync(directoryPath);
};

const canonicalFuturePath = (filePath, code) => {
  invariant(typeof filePath === 'string' && path.isAbsolute(filePath), code, 'not-absolute');
  return path.resolve(filePath);
};

const canonicalTemporaryRegularFile = (filePath, code) => {
  invariant(typeof filePath === 'string' && path.isAbsolute(filePath), code, 'not-absolute');
  invariant(existsSync(filePath), code, 'missing');
  const lexicalStat = lstatSync(filePath);
  invariant(lexicalStat.isFile() && !lexicalStat.isSymbolicLink(), code, 'not-regular-file');
  const canonicalPath = realpathSync(filePath);
  const temporaryRoot = `${realpathSync(os.tmpdir())}${path.sep}`;
  invariant(canonicalPath.startsWith(temporaryRoot), code, 'outside-system-temporary-directory');
  return canonicalPath;
};

const canonicalTemporaryDirectory = (directoryPath, code) => {
  invariant(typeof directoryPath === 'string' && path.isAbsolute(directoryPath), code, 'not-absolute');
  invariant(existsSync(directoryPath), code, 'missing');
  const lexicalStat = lstatSync(directoryPath);
  invariant(lexicalStat.isDirectory() && !lexicalStat.isSymbolicLink(), code, 'not-directory');
  const canonicalPath = realpathSync(directoryPath);
  const temporaryRoot = `${realpathSync(os.tmpdir())}${path.sep}`;
  invariant(canonicalPath.startsWith(temporaryRoot), code, 'outside-system-temporary-directory');
  return canonicalPath;
};

const runtimeBinding = (plan, id) => {
  const matches = (plan.provenance?.fileBindings ?? []).filter(
    (item) => item?.role === 'runtime' && item?.id === id,
  );
  invariant(matches.length === 1, 'DIRECTOR_AB_FORMAL_RUNTIME_BINDING_INVALID', `${id}:${matches.length}`);
  const [binding] = matches;
  invariant(SHA256_RE.test(binding.sha256), 'DIRECTOR_AB_FORMAL_RUNTIME_BINDING_SHA_INVALID', id);
  return binding;
};

const validateRuntimeInvocationFile = ({plan, id, plannedPath, actualPath}) => {
  const plannedCanonical = canonicalExistingFile(
    plannedPath,
    'DIRECTOR_AB_FORMAL_COMMAND_FILE_INVALID',
  );
  const actualCanonical = canonicalExistingFile(
    actualPath,
    'DIRECTOR_AB_FORMAL_INVOCATION_FILE_INVALID',
  );
  invariant(
    plannedCanonical === actualCanonical,
    'DIRECTOR_AB_FORMAL_INVOCATION_FILE_MISMATCH',
    `${id}:${plannedCanonical}:${actualCanonical}`,
  );
  const binding = runtimeBinding(plan, id);
  const bindingCanonical = canonicalExistingFile(
    binding.path,
    'DIRECTOR_AB_FORMAL_RUNTIME_BINDING_FILE_INVALID',
  );
  invariant(
    bindingCanonical === plannedCanonical,
    'DIRECTOR_AB_FORMAL_RUNTIME_BINDING_PATH_MISMATCH',
    `${id}:${bindingCanonical}:${plannedCanonical}`,
  );
  const actualSha256 = sha256File(actualCanonical);
  invariant(
    actualSha256 === binding.sha256,
    'DIRECTOR_AB_FORMAL_RUNTIME_BINDING_SHA_MISMATCH',
    id,
  );
  return {
    id,
    plannedPath,
    canonicalPath: actualCanonical,
    sha256: actualSha256,
  };
};

export const validateFormalInvocationBinding = ({
  plan,
  planPath,
  visualMasterPath,
  outputDirectory,
  receiptPath,
  ffmpegPath,
  ffprobePath,
  historicalV5WithPath,
  historicalV5NoPath,
  currentNodePath = process.execPath,
  currentScriptPath = scriptPath,
  currentCwd = process.cwd(),
}) => {
  invariant(
    historicalV5WithPath === undefined && historicalV5NoPath === undefined,
    'DIRECTOR_AB_FORMAL_UNBOUND_OPTION_FORBIDDEN',
    'historical-v5',
  );
  const commands = (plan.commands ?? []).filter((command) => command?.id === 'package-and-qa-ab');
  invariant(commands.length === 1, 'DIRECTOR_AB_FORMAL_PACKAGE_COMMAND_INVALID', commands.length);
  const [command] = commands;
  invariant(
    Array.isArray(command.argv) && command.argv.length === 14,
    'DIRECTOR_AB_FORMAL_PACKAGE_COMMAND_ARGV_INVALID',
    command.argv?.length,
  );
  const expectedFlags = [
    '--plan',
    '--visual-master',
    '--output-dir',
    '--ffmpeg',
    '--ffprobe',
    '--receipt',
  ];
  for (let index = 0; index < expectedFlags.length; index += 1) {
    invariant(
      command.argv[2 + (index * 2)] === expectedFlags[index],
      'DIRECTOR_AB_FORMAL_PACKAGE_COMMAND_ARGV_INVALID',
      `${index}:${command.argv[2 + (index * 2)]}`,
    );
  }

  const actualCwd = canonicalExistingDirectory(currentCwd, 'DIRECTOR_AB_FORMAL_INVOCATION_CWD_INVALID');
  const plannedCwd = canonicalExistingDirectory(command.cwd, 'DIRECTOR_AB_FORMAL_COMMAND_CWD_INVALID');
  invariant(
    actualCwd === plannedCwd,
    'DIRECTOR_AB_FORMAL_INVOCATION_CWD_MISMATCH',
    `${plannedCwd}:${actualCwd}`,
  );

  const runtime = {
    nodeBinary: validateRuntimeInvocationFile({
      plan,
      id: 'node-binary',
      plannedPath: command.argv[0],
      actualPath: currentNodePath,
    }),
    packager: validateRuntimeInvocationFile({
      plan,
      id: 'ab-packager',
      plannedPath: command.argv[1],
      actualPath: currentScriptPath,
    }),
    ffmpeg: validateRuntimeInvocationFile({
      plan,
      id: 'ffmpeg-binary',
      plannedPath: command.argv[9],
      actualPath: ffmpegPath,
    }),
    ffprobe: validateRuntimeInvocationFile({
      plan,
      id: 'ffprobe-binary',
      plannedPath: command.argv[11],
      actualPath: ffprobePath,
    }),
  };

  for (const [label, plannedPath, actualPath] of [
    ['plan', command.argv[3], planPath],
    ['visual-master', command.argv[5], visualMasterPath],
  ]) {
    const plannedCanonical = canonicalExistingFile(plannedPath, 'DIRECTOR_AB_FORMAL_COMMAND_INPUT_INVALID');
    const actualCanonical = canonicalExistingFile(actualPath, 'DIRECTOR_AB_FORMAL_INVOCATION_INPUT_INVALID');
    invariant(
      plannedCanonical === actualCanonical,
      'DIRECTOR_AB_FORMAL_INVOCATION_INPUT_MISMATCH',
      `${label}:${plannedCanonical}:${actualCanonical}`,
    );
  }
  for (const [label, plannedPath, actualPath] of [
    ['output-dir', command.argv[7], outputDirectory],
    ['receipt', command.argv[13], receiptPath],
  ]) {
    const plannedCanonical = canonicalFuturePath(plannedPath, 'DIRECTOR_AB_FORMAL_COMMAND_OUTPUT_INVALID');
    const actualCanonical = canonicalFuturePath(actualPath, 'DIRECTOR_AB_FORMAL_INVOCATION_OUTPUT_INVALID');
    invariant(
      plannedCanonical === actualCanonical,
      'DIRECTOR_AB_FORMAL_INVOCATION_OUTPUT_MISMATCH',
      `${label}:${plannedCanonical}:${actualCanonical}`,
    );
  }

  return {
    commandId: command.id,
    cwd: actualCwd,
    argv: [...command.argv],
    runtime,
    invocationMatchesCompilerBoundCommand: true,
  };
};

const validateFormalPlanOnlyTestInvocation = ({plan, planPath}) => {
  invariant(plan.executionMode === 'plan-only', 'DIRECTOR_AB_FORMAL_TEST_PLAN_MODE_INVALID', plan.executionMode);
  const canonicalPlanPath = canonicalTemporaryRegularFile(
    planPath,
    'DIRECTOR_AB_FORMAL_TEST_PATH_FORBIDDEN',
  );
  const requestPath = plan.provenance?.requestPath;
  const canonicalRequestPath = canonicalTemporaryRegularFile(
    requestPath,
    'DIRECTOR_AB_FORMAL_TEST_PATH_FORBIDDEN',
  );
  invariant(
    path.dirname(canonicalPlanPath) === path.dirname(canonicalRequestPath),
    'DIRECTOR_AB_FORMAL_TEST_PATH_FORBIDDEN',
    'plan-request-directory-mismatch',
  );
  invariant(
    canonicalRequestPath === requestPath,
    'DIRECTOR_AB_FORMAL_TEST_REQUEST_PATH_MISMATCH',
  );

  invariant(
    Array.isArray(plan.commands) && plan.commands.length === 1,
    'DIRECTOR_AB_FORMAL_TEST_COMMAND_INVALID',
    plan.commands?.length,
  );
  const [command] = plan.commands;
  invariant(command?.id === 'validate-plan', 'DIRECTOR_AB_FORMAL_TEST_COMMAND_INVALID', command?.id);
  const commandCwd = canonicalTemporaryDirectory(
    command.cwd,
    'DIRECTOR_AB_FORMAL_TEST_COMMAND_CWD_INVALID',
  );
  const expectedArgv = [
    process.execPath,
    authoritativePlanValidatorPath,
    '--plan', canonicalPlanPath,
    '--request', canonicalRequestPath,
    '--repo-root', defaultRepoRoot,
  ];
  invariant(
    Array.isArray(command.argv) && stableStringify(command.argv) === stableStringify(expectedArgv),
    'DIRECTOR_AB_FORMAL_TEST_COMMAND_INVALID',
    stableStringify(command.argv),
  );

  const runtime = {
    nodeBinary: validateRuntimeInvocationFile({
      plan,
      id: 'node-binary',
      plannedPath: command.argv[0],
      actualPath: process.execPath,
    }),
    validator: validateRuntimeInvocationFile({
      plan,
      id: 'validator',
      plannedPath: command.argv[1],
      actualPath: authoritativePlanValidatorPath,
    }),
  };
  const compilerBindings = (plan.provenance?.fileBindings ?? []).filter(
    (item) => item?.role === 'compiler' && item?.id === 'compile-director-plan',
  );
  invariant(
    compilerBindings.length === 1,
    'DIRECTOR_AB_FORMAL_TEST_COMPILER_BINDING_INVALID',
    compilerBindings.length,
  );
  const [compilerBinding] = compilerBindings;
  const compilerCanonicalPath = canonicalExistingFile(
    compilerBinding.path,
    'DIRECTOR_AB_FORMAL_TEST_COMPILER_BINDING_INVALID',
  );
  invariant(
    compilerCanonicalPath === canonicalExistingFile(
      authoritativePlanCompilerPath,
      'DIRECTOR_AB_FORMAL_TEST_COMPILER_BINDING_INVALID',
    ),
    'DIRECTOR_AB_FORMAL_TEST_COMPILER_BINDING_INVALID',
    'path-mismatch',
  );
  const compilerSha256 = sha256File(compilerCanonicalPath);
  invariant(
    SHA256_RE.test(compilerBinding.sha256) && compilerBinding.sha256 === compilerSha256,
    'DIRECTOR_AB_FORMAL_TEST_COMPILER_BINDING_INVALID',
    'sha-mismatch',
  );

  return {
    commandId: command.id,
    cwd: commandCwd,
    argv: [...command.argv],
    runtime,
    compiler: {
      canonicalPath: compilerCanonicalPath,
      sha256: compilerSha256,
    },
    invocationMatchesCompilerBoundCommand: true,
    isolatedPlanOnlyTest: true,
  };
};

const runAuthoritativePlanValidation = (
  plan,
  planPath,
  invocation,
  {planOnlyTest = false, subprocessSourceEnv = process.env} = {},
) => {
  invariant(plan.schemaVersion === FORMAL_PLAN_SCHEMA, 'DIRECTOR_AB_FORMAL_PLAN_SCHEMA_INVALID', plan.schemaVersion);
  const expectedInvocation = planOnlyTest
    ? validateFormalPlanOnlyTestInvocation({plan, planPath})
    : validateFormalInvocationBinding({plan, planPath, ...invocation});
  requireAbsoluteRegularFile(authoritativePlanValidatorPath, 'DIRECTOR_AB_AUTHORITATIVE_PLAN_VALIDATOR_INVALID');
  const validatorSha256 = sha256File(authoritativePlanValidatorPath);
  const requestPath = plan.provenance?.requestPath;
  requireAbsoluteRegularFile(requestPath, 'DIRECTOR_AB_PLAN_REQUEST_FILE_INVALID');
  const requestBytes = readFileSync(requestPath);
  const requestFileSha256 = sha256Buffer(requestBytes);
  const request = JSON.parse(requestBytes.toString('utf8'));
  invariant(
    sha256Text(stableStringify(request)) === plan.provenance.requestCanonicalSha256,
    'DIRECTOR_AB_PLAN_REQUEST_CANONICAL_SHA_MISMATCH',
  );
  const validation = run(process.execPath, [
    authoritativePlanValidatorPath,
    '--plan', planPath,
    '--request', requestPath,
    '--repo-root', defaultRepoRoot,
  ], {
    captureStdout: true,
    allowFailure: true,
    sourceEnv: subprocessSourceEnv,
    cwd: expectedInvocation.cwd,
  });
  const stderr = Buffer.isBuffer(validation.stderr)
    ? validation.stderr.toString('utf8')
    : String(validation.stderr ?? '');
  invariant(
    validation.status === 0,
    'DIRECTOR_AB_AUTHORITATIVE_PLAN_VALIDATION_FAILED',
    `${validation.status}:${stderr.trim().slice(-1200)}`,
  );
  let result;
  try {
    result = JSON.parse(validation.stdout.toString('utf8'));
  } catch {
    throw stableError('DIRECTOR_AB_AUTHORITATIVE_PLAN_RECEIPT_INVALID');
  }
  invariant(result?.ok === true && result.chainSha256 === plan.chain.chainSha256, 'DIRECTOR_AB_AUTHORITATIVE_PLAN_RECEIPT_MISMATCH');
  invariant(
    sha256File(authoritativePlanValidatorPath) === validatorSha256,
    'DIRECTOR_AB_AUTHORITATIVE_PLAN_VALIDATOR_CHANGED_DURING_VALIDATION',
  );
  return {
    mode: 'formal-schema-live-bindings-and-request-recompile',
    requestPath,
    requestFileSha256,
    requestCanonicalSha256: plan.provenance.requestCanonicalSha256,
    validatorPath: authoritativePlanValidatorPath,
    validatorSha256,
    result,
    expectedInvocation,
  };
};

export const validateFormalPlanOnlyRecompilePathForTest = (input) => {
  invariant(
    exactKeys(input, ['planPath', 'requestPath', 'sourceEnv']),
    'DIRECTOR_AB_FORMAL_TEST_OPTIONS_INVALID',
    isRecord(input) ? Object.keys(input).sort().join(',') : 'not-object',
  );
  const {planPath, requestPath, sourceEnv} = input;
  invariant(isRecord(sourceEnv), 'DIRECTOR_AB_FORMAL_TEST_ENV_INVALID');
  const sourceEnvKeys = Object.keys(sourceEnv);
  invariant(
    sourceEnvKeys.every((key) => SUPERVISOR_ANCHOR_ENV_KEYS.includes(key)),
    'DIRECTOR_AB_FORMAL_TEST_ENV_KEY_FORBIDDEN',
    sourceEnvKeys.filter((key) => !SUPERVISOR_ANCHOR_ENV_KEYS.includes(key)).join(','),
  );
  const canonicalPlanPath = canonicalTemporaryRegularFile(
    planPath,
    'DIRECTOR_AB_FORMAL_TEST_PATH_FORBIDDEN',
  );
  const canonicalRequestPath = canonicalTemporaryRegularFile(
    requestPath,
    'DIRECTOR_AB_FORMAL_TEST_PATH_FORBIDDEN',
  );
  invariant(
    path.dirname(canonicalPlanPath) === path.dirname(canonicalRequestPath),
    'DIRECTOR_AB_FORMAL_TEST_PATH_FORBIDDEN',
    'plan-request-directory-mismatch',
  );
  const plan = JSON.parse(readFileSync(canonicalPlanPath, 'utf8'));
  invariant(plan.schemaVersion === FORMAL_PLAN_SCHEMA, 'DIRECTOR_AB_FORMAL_PLAN_SCHEMA_INVALID', plan.schemaVersion);
  invariant(plan.executionMode === 'plan-only', 'DIRECTOR_AB_FORMAL_TEST_PLAN_MODE_INVALID', plan.executionMode);
  invariant(
    plan.provenance?.requestPath === canonicalRequestPath,
    'DIRECTOR_AB_FORMAL_TEST_REQUEST_PATH_MISMATCH',
  );
  return runAuthoritativePlanValidation(
    plan,
    canonicalPlanPath,
    undefined,
    {planOnlyTest: true, subprocessSourceEnv: sourceEnv},
  );
};

const validateSyntheticFixturePermission = (plan, planPath, allowSyntheticFixtureForTest) => {
  invariant(allowSyntheticFixtureForTest === true, 'DIRECTOR_AB_SYNTHETIC_FIXTURE_FORBIDDEN');
  const temporaryRoot = `${realpathSync(os.tmpdir())}${path.sep}`;
  invariant(realpathSync(planPath).startsWith(temporaryRoot), 'DIRECTOR_AB_SYNTHETIC_FIXTURE_PATH_FORBIDDEN', planPath);
  const requestPath = plan.provenance?.requestPath;
  requireAbsoluteRegularFile(requestPath, 'DIRECTOR_AB_PLAN_REQUEST_FILE_INVALID');
  const requestBytes = readFileSync(requestPath);
  const requestFileSha256 = sha256Buffer(requestBytes);
  const request = JSON.parse(requestBytes.toString('utf8'));
  invariant(
    sha256Text(stableStringify(request)) === plan.provenance.requestCanonicalSha256,
    'DIRECTOR_AB_PLAN_REQUEST_CANONICAL_SHA_MISMATCH',
  );
  return {
    mode: 'synthetic-test-only-no-production-authority',
    requestPath,
    requestFileSha256,
    requestCanonicalSha256: plan.provenance.requestCanonicalSha256,
  };
};

const validatePlanIntegrity = (plan, {planPath, allowSyntheticFixtureForTest, invocation}) => {
  invariant(isRecord(plan.provenance), 'DIRECTOR_AB_PLAN_PROVENANCE_MISSING');
  invariant(isRecord(plan.chain), 'DIRECTOR_AB_PLAN_CHAIN_MISSING');
  invariant(exactKeys(plan.chain, CHAIN_KEYS), 'DIRECTOR_AB_PLAN_CHAIN_KEYS_INVALID', Object.keys(plan.chain).sort().join(','));
  invariant(plan.chain.schemaVersion === 'koubo-director-chain/v1', 'DIRECTOR_AB_PLAN_CHAIN_SCHEMA_INVALID');
  for (const key of [
    'requestCanonicalSha256',
    'styleSha256',
    'referenceSha256',
    'authorityTranscriptSha256',
    'fileBindingsSha256',
    'planPayloadSha256',
    'chainSha256',
  ]) invariant(SHA256_RE.test(plan.chain[key]), 'DIRECTOR_AB_PLAN_CHAIN_SHA_INVALID', key);

  const planWithoutChain = structuredClone(plan);
  delete planWithoutChain.chain;
  invariant(
    sha256Text(stableStringify(planWithoutChain)) === plan.chain.planPayloadSha256,
    'DIRECTOR_AB_PLAN_PAYLOAD_SHA_MISMATCH',
  );
  const chainBase = {...plan.chain};
  delete chainBase.chainSha256;
  invariant(
    sha256Text(stableStringify(chainBase)) === plan.chain.chainSha256,
    'DIRECTOR_AB_PLAN_CHAIN_SHA_MISMATCH',
  );
  for (const [chainKey, provenanceKey] of [
    ['requestCanonicalSha256', 'requestCanonicalSha256'],
    ['styleSha256', 'styleSha256'],
    ['referenceSha256', 'referenceSha256'],
    ['authorityTranscriptSha256', 'authorityTranscriptSha256'],
    ['fileBindingsSha256', 'fileBindingsSha256'],
  ]) {
    invariant(
      plan.chain[chainKey] === plan.provenance[provenanceKey],
      'DIRECTOR_AB_PLAN_CHAIN_PROVENANCE_MISMATCH',
      chainKey,
    );
  }

  invariant(Array.isArray(plan.provenance.fileBindings) && plan.provenance.fileBindings.length > 0, 'DIRECTOR_AB_PLAN_FILE_BINDINGS_MISSING');
  const sortedBindings = [...plan.provenance.fileBindings].sort((left, right) =>
    `${left.role}\0${left.id}\0${left.path}`.localeCompare(`${right.role}\0${right.id}\0${right.path}`));
  invariant(stableStringify(sortedBindings) === stableStringify(plan.provenance.fileBindings), 'DIRECTOR_AB_PLAN_FILE_BINDINGS_ORDER_INVALID');
  invariant(
    sha256Text(stableStringify(sortedBindings)) === plan.provenance.fileBindingsSha256,
    'DIRECTOR_AB_PLAN_FILE_BINDINGS_SHA_MISMATCH',
  );
  for (const binding of sortedBindings) {
    invariant(isRecord(binding) && typeof binding.role === 'string' && typeof binding.id === 'string', 'DIRECTOR_AB_PLAN_FILE_BINDING_INVALID');
    invariant(path.isAbsolute(binding.path) && existsSync(binding.path), 'DIRECTOR_AB_PLAN_BOUND_FILE_INVALID', `${binding.role}:${binding.id}`);
    invariant(SHA256_RE.test(binding.sha256), 'DIRECTOR_AB_PLAN_BOUND_FILE_SHA_INVALID', `${binding.role}:${binding.id}`);
    invariant(sha256File(binding.path) === binding.sha256, 'DIRECTOR_AB_PLAN_BOUND_FILE_SHA_MISMATCH', `${binding.role}:${binding.id}`);
  }
  const bindsLiveFile = (file) => sortedBindings.some((binding) =>
    path.normalize(binding.path) === path.normalize(file.path) && binding.sha256 === file.sha256);
  invariant(bindsLiveFile(plan.media?.spoken ?? {}), 'DIRECTOR_AB_PLAN_SPOKEN_BINDING_MISSING');
  for (const file of plan.media?.sfx ?? []) {
    invariant(bindsLiveFile(file), 'DIRECTOR_AB_PLAN_SFX_BINDING_MISSING', file.id);
  }
  let authoritativeValidation;
  if (plan.schemaVersion === SYNTHETIC_PLAN_SCHEMA) {
    authoritativeValidation = validateSyntheticFixturePermission(plan, planPath, allowSyntheticFixtureForTest);
  } else {
    authoritativeValidation = runAuthoritativePlanValidation(plan, planPath, invocation);
  }
  return {
    chainSha256: plan.chain.chainSha256,
    planPayloadSha256: plan.chain.planPayloadSha256,
    fileBindingsSha256: plan.provenance.fileBindingsSha256,
    fileBindingCount: sortedBindings.length,
    fileBindings: sortedBindings.map((binding) => ({...binding})),
    authoritativeValidation,
  };
};

const validatePlan = (
  plan,
  planPath,
  {allowSyntheticFixtureForTest = false, invocation} = {},
) => {
  invariant(isRecord(plan), 'DIRECTOR_AB_PLAN_INVALID');
  invariant(plan.executionMode === 'renderable', 'DIRECTOR_AB_PLAN_NOT_RENDERABLE');
  const integrity = validatePlanIntegrity(plan, {
    planPath,
    allowSyntheticFixtureForTest,
    invocation,
  });
  const render = plan.render;
  invariant(isRecord(render), 'DIRECTOR_AB_PLAN_RENDER_MISSING');
  invariant(Number(render.width) === EXACT.width && Number(render.height) === EXACT.height, 'DIRECTOR_AB_PLAN_DIMENSIONS_INVALID');
  invariant(Number(render.fps) === EXACT.fps, 'DIRECTOR_AB_PLAN_FPS_INVALID');
  invariant(Number(render.durationInFrames) === EXACT.frames, 'DIRECTOR_AB_PLAN_FRAME_COUNT_INVALID');
  invariant(Number(render.durationSeconds) === EXACT.durationSeconds, 'DIRECTOR_AB_PLAN_DURATION_INVALID');
  const visualMaster = plan.samplePlan?.outputs?.visualMaster;
  invariant(typeof visualMaster === 'string' && path.isAbsolute(visualMaster), 'DIRECTOR_AB_PLAN_VISUAL_MASTER_OUTPUT_INVALID');
  const spoken = plan.media?.spoken;
  invariant(isRecord(spoken), 'DIRECTOR_AB_PLAN_SPOKEN_MISSING');
  requireAbsoluteRegularFile(spoken.path, 'DIRECTOR_AB_SPOKEN_FILE_INVALID');
  invariant(sha256File(spoken.path) === spoken.sha256, 'DIRECTOR_AB_SPOKEN_SHA_MISMATCH');
  invariant(finite(spoken.sourceIn) && finite(spoken.sourceOut), 'DIRECTOR_AB_SPOKEN_WINDOW_INVALID');
  invariant(Number(spoken.sourceIn) >= 0, 'DIRECTOR_AB_SPOKEN_SOURCE_IN_NEGATIVE', spoken.sourceIn);
  invariant(closeTo(Number(spoken.sourceOut) - Number(spoken.sourceIn), EXACT.durationSeconds, 1e-6), 'DIRECTOR_AB_SPOKEN_WINDOW_NOT_EXACT30');
  const sfx = plan.media?.sfx;
  invariant(Array.isArray(sfx) && sfx.length > 0, 'DIRECTOR_AB_SFX_MISSING');
  const sfxIds = new Set();
  const cueIds = new Set();
  let cueCount = 0;
  for (const file of sfx) {
    invariant(isRecord(file) && typeof file.id === 'string' && file.id.length > 0, 'DIRECTOR_AB_SFX_FILE_INVALID');
    invariant(!sfxIds.has(file.id), 'DIRECTOR_AB_SFX_FILE_ID_DUPLICATE', file.id);
    sfxIds.add(file.id);
    requireAbsoluteRegularFile(file.path, 'DIRECTOR_AB_SFX_PATH_INVALID');
    invariant(sha256File(file.path) === file.sha256, 'DIRECTOR_AB_SFX_SHA_MISMATCH', file.id);
    invariant(Array.isArray(file.cues) && file.cues.length > 0, 'DIRECTOR_AB_SFX_CUES_MISSING', file.id);
    for (const cue of file.cues) {
      invariant(isRecord(cue) && typeof cue.id === 'string' && cue.id.length > 0, 'DIRECTOR_AB_SFX_CUE_INVALID', file.id);
      invariant(!cueIds.has(cue.id), 'DIRECTOR_AB_SFX_CUE_DUPLICATE', cue.id);
      cueIds.add(cue.id);
      invariant(finite(cue.atSeconds) && Number(cue.atSeconds) >= 0 && Number(cue.atSeconds) < EXACT.durationSeconds, 'DIRECTOR_AB_SFX_CUE_TIME_INVALID', cue.id);
      invariant(finite(cue.volume) && Number(cue.volume) > 0 && Number(cue.volume) <= 1, 'DIRECTOR_AB_SFX_CUE_VOLUME_INVALID', cue.id);
      cueCount += 1;
    }
  }
  invariant(cueCount > 0, 'DIRECTOR_AB_SFX_CUES_EMPTY');
  const freezeClassification = validateFreezeClassificationPlan(plan);
  return {planPath, spoken, sfx, cueCount, visualMaster, chainSha256: plan.chain.chainSha256, integrity, freezeClassification};
};

const buildPcmFilter = ({spoken, sfx}) => {
  const parts = [
    `[0:a:0]atrim=start=${Number(spoken.sourceIn)}:end=${Number(spoken.sourceOut)},asetpts=PTS-STARTPTS,aresample=${EXACT.sampleRate}:async=0:first_pts=0,aformat=sample_fmts=fltp:sample_rates=${EXACT.sampleRate}:channel_layouts=stereo,atrim=end_sample=${EXACT.samplesPerChannel},asplit=2[spoken_no][spoken_mix]`,
  ];
  const cueLabels = [];
  sfx.forEach((file, fileIndex) => {
    const inputIndex = fileIndex + 1;
    const base = `sfx${fileIndex}`;
    if (file.cues.length === 1) {
      parts.push(`[${inputIndex}:a:0]aresample=${EXACT.sampleRate}:async=0:first_pts=0,aformat=sample_fmts=fltp:sample_rates=${EXACT.sampleRate}:channel_layouts=stereo,asetpts=PTS-STARTPTS[${base}_0]`);
    } else {
      const splitLabels = file.cues.map((_, cueIndex) => `[${base}_${cueIndex}]`).join('');
      parts.push(`[${inputIndex}:a:0]aresample=${EXACT.sampleRate}:async=0:first_pts=0,aformat=sample_fmts=fltp:sample_rates=${EXACT.sampleRate}:channel_layouts=stereo,asetpts=PTS-STARTPTS,asplit=${file.cues.length}${splitLabels}`);
    }
    file.cues.forEach((cue, cueIndex) => {
      const outputLabel = `cue_${fileIndex}_${cueIndex}`;
      const delaySamples = Math.round(Number(cue.atSeconds) * EXACT.sampleRate);
      parts.push(`[${base}_${cueIndex}]volume=${Number(cue.volume)},adelay=${delaySamples}S:all=1[${outputLabel}]`);
      cueLabels.push(`[${outputLabel}]`);
    });
  });
  parts.push(`[spoken_mix]${cueLabels.join('')}amix=inputs=${cueLabels.length + 1}:duration=first:dropout_transition=0:normalize=0,atrim=end_sample=${EXACT.samplesPerChannel},asetpts=N/SR/TB[with]`);
  parts.push(`[spoken_no]atrim=end_sample=${EXACT.samplesPerChannel},asetpts=N/SR/TB[no]`);
  return parts.join(';');
};

const generatePcmTracks = ({ffmpeg, planInfo, withSfxPath, noSfxPath}) => {
  const args = ['-nostdin', '-hide_banner', '-v', 'error', '-n', '-i', planInfo.spoken.path];
  for (const file of planInfo.sfx) args.push('-i', file.path);
  args.push(
    '-filter_complex', buildPcmFilter(planInfo),
    '-map', '[with]', '-c:a', EXACT.pcmCodec, '-ar', String(EXACT.sampleRate), '-ac', String(EXACT.channels), withSfxPath,
    '-map', '[no]', '-c:a', EXACT.pcmCodec, '-ar', String(EXACT.sampleRate), '-ac', String(EXACT.channels), noSfxPath,
  );
  run(ffmpeg, args);
  return args;
};

const decodedPcm = (ffmpeg, filePath, format = 's24le') => run(ffmpeg, [
  '-nostdin', '-hide_banner', '-v', 'error',
  '-i', filePath,
  '-map', '0:a:0',
  '-ac', String(EXACT.channels),
  '-ar', String(EXACT.sampleRate),
  '-f', format,
  'pipe:1',
], {captureStdout: true}).stdout;

const float32FromBuffer = (buffer) => {
  invariant(buffer.length % 4 === 0, 'DIRECTOR_AB_AUDIO_FLOAT32_LENGTH_INVALID', buffer.length);
  const copy = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Float32Array(copy);
};

const decodedFloat32 = (ffmpeg, filePath, {audioFilter} = {}) => {
  const args = [
    '-nostdin', '-hide_banner', '-v', 'error',
    '-i', filePath,
    '-map', '0:a:0',
  ];
  if (audioFilter) args.push('-af', audioFilter);
  args.push(
    '-ac', String(EXACT.channels),
    '-ar', String(EXACT.sampleRate),
    '-f', 'f32le', 'pipe:1',
  );
  return float32FromBuffer(run(ffmpeg, args, {captureStdout: true}).stdout);
};

const audioFrames = (samples, channels, code = 'DIRECTOR_AB_AUDIO_SAMPLE_LAYOUT_INVALID') => {
  invariant(ArrayBuffer.isView(samples) && Number.isInteger(channels) && channels > 0, code);
  invariant(samples.length % channels === 0, code, `${samples.length}:${channels}`);
  return samples.length / channels;
};

const pearsonAtOffset = ({reference, candidate, channels, candidateOffsetFrames, strideFrames, includeMask}) => {
  const referenceFrames = audioFrames(reference, channels);
  const candidateFrames = audioFrames(candidate, channels);
  const referenceStart = Math.max(0, -candidateOffsetFrames);
  const candidateStart = Math.max(0, candidateOffsetFrames);
  const availableFrames = Math.min(referenceFrames - referenceStart, candidateFrames - candidateStart);
  let count = 0;
  let meanReference = 0;
  let meanCandidate = 0;
  let referenceM2 = 0;
  let candidateM2 = 0;
  let covariance = 0;
  let referenceSumSquares = 0;
  let candidateSumSquares = 0;
  for (let relativeFrame = 0; relativeFrame < availableFrames; relativeFrame += strideFrames) {
    const referenceFrame = referenceStart + relativeFrame;
    const candidateFrame = candidateStart + relativeFrame;
    if (includeMask && includeMask[referenceFrame] !== 1) continue;
    for (let channel = 0; channel < channels; channel += 1) {
      const referenceValue = Number(reference[(referenceFrame * channels) + channel]);
      const candidateValue = Number(candidate[(candidateFrame * channels) + channel]);
      referenceSumSquares += referenceValue * referenceValue;
      candidateSumSquares += candidateValue * candidateValue;
      count += 1;
      const referenceDelta = referenceValue - meanReference;
      meanReference += referenceDelta / count;
      const candidateDelta = candidateValue - meanCandidate;
      meanCandidate += candidateDelta / count;
      referenceM2 += referenceDelta * (referenceValue - meanReference);
      candidateM2 += candidateDelta * (candidateValue - meanCandidate);
      covariance += referenceDelta * (candidateValue - meanCandidate);
    }
  }
  invariant(count >= 4 && referenceM2 > 0 && candidateM2 > 0, 'DIRECTOR_AB_AUDIO_CORRELATION_UNDEFINED', count);
  const correlation = covariance / Math.sqrt(referenceM2 * candidateM2);
  const gain = covariance / referenceM2;
  const referenceRms = Math.sqrt(referenceSumSquares / count);
  const candidateRms = Math.sqrt(candidateSumSquares / count);
  const residualSumSquares = Math.max(0, candidateM2 - ((covariance * covariance) / referenceM2));
  const residualRms = Math.sqrt(residualSumSquares / count);
  return {
    correlation,
    gain,
    offset: meanCandidate - (gain * meanReference),
    referenceRms,
    referenceRmsDbfs: dbfs(referenceRms),
    candidateRms,
    candidateRmsDbfs: dbfs(candidateRms),
    rmsRatio: candidateRms / referenceRms,
    residualRmsAfterGainAndDcFit: residualRms,
    residualToReferenceRmsRatio: residualRms / referenceRms,
    comparedInterleavedSamples: count,
    comparedFrames: count / channels,
    candidateOffsetSamples: candidateOffsetFrames,
  };
};

export const measureAlignedPearson = ({
  reference,
  candidate,
  channels = EXACT.channels,
  maxDelaySamples = EXACT.correlationMaxDelaySamples,
  searchStrideFrames = EXACT.correlationSearchStrideFrames,
  includeMask,
}) => {
  const referenceFrames = audioFrames(reference, channels);
  const candidateFrames = audioFrames(candidate, channels);
  invariant(referenceFrames > maxDelaySamples && candidateFrames > maxDelaySamples, 'DIRECTOR_AB_AUDIO_CORRELATION_INPUT_TOO_SHORT');
  if (includeMask) invariant(includeMask.length >= referenceFrames, 'DIRECTOR_AB_AUDIO_INCLUDE_MASK_INVALID');
  let best = null;
  for (let candidateOffsetFrames = -maxDelaySamples; candidateOffsetFrames <= maxDelaySamples; candidateOffsetFrames += 1) {
    const sampled = pearsonAtOffset({
      reference,
      candidate,
      channels,
      candidateOffsetFrames,
      strideFrames: searchStrideFrames,
      includeMask,
    });
    if (
      best === null
      || sampled.correlation > best.correlation
      || (sampled.correlation === best.correlation && Math.abs(candidateOffsetFrames) < Math.abs(best.candidateOffsetSamples))
    ) best = sampled;
  }
  return pearsonAtOffset({
    reference,
    candidate,
    channels,
    candidateOffsetFrames: best.candidateOffsetSamples,
    strideFrames: 1,
    includeMask,
  });
};

export const validateCorrelationGate = (measurement, minimum, code) => {
  invariant(isRecord(measurement) && Number.isFinite(measurement.correlation), code, 'not-finite');
  invariant(measurement.correlation >= minimum, code, measurement.correlation);
  return {...measurement, minimum, passed: true};
};

export const validateSpokenFidelityGate = (measurement, {
  correlationMinimum = EXACT.noSfxSpokenCorrelationMin,
  codePrefix = 'DIRECTOR_AB_NO_SFX_SPOKEN',
} = {}) => {
  invariant(isRecord(measurement) && Number.isFinite(measurement.correlation), `${codePrefix}_CORRELATION_FAILED`, 'not-finite');
  invariant(measurement.correlation >= correlationMinimum, `${codePrefix}_CORRELATION_FAILED`, measurement.correlation);
  invariant(measurement.referenceRmsDbfs >= EXACT.spokenMinimumRmsDbfs, `${codePrefix}_REFERENCE_ENERGY_TOO_LOW`, measurement.referenceRmsDbfs);
  invariant(measurement.gain >= EXACT.spokenGainMin && measurement.gain <= EXACT.spokenGainMax, `${codePrefix}_GAIN_FAILED`, measurement.gain);
  invariant(measurement.rmsRatio >= EXACT.spokenRmsRatioMin && measurement.rmsRatio <= EXACT.spokenRmsRatioMax, `${codePrefix}_RMS_RATIO_FAILED`, measurement.rmsRatio);
  invariant(Math.abs(measurement.offset) <= EXACT.spokenDcOffsetMax, `${codePrefix}_DC_OFFSET_FAILED`, measurement.offset);
  invariant(measurement.residualToReferenceRmsRatio <= EXACT.spokenResidualToReferenceRmsMax, `${codePrefix}_RESIDUAL_FAILED`, measurement.residualToReferenceRmsRatio);
  return {
    ...measurement,
    thresholds: {
      correlationMinimum,
      referenceRmsDbfsMinimum: EXACT.spokenMinimumRmsDbfs,
      gainMinimum: EXACT.spokenGainMin,
      gainMaximum: EXACT.spokenGainMax,
      rmsRatioMinimum: EXACT.spokenRmsRatioMin,
      rmsRatioMaximum: EXACT.spokenRmsRatioMax,
      dcOffsetAbsoluteMaximum: EXACT.spokenDcOffsetMax,
      residualToReferenceRmsMaximum: EXACT.spokenResidualToReferenceRmsMax,
    },
    passed: true,
  };
};

export const measureEffectiveSignalCoverage = ({samples, channels = EXACT.channels, includeMask}) => {
  const totalFrames = audioFrames(samples, channels);
  if (includeMask) invariant(includeMask.length >= totalFrames, 'DIRECTOR_AB_AUDIO_COVERAGE_MASK_INVALID');
  const blockFrames = EXACT.effectiveEnergyBlockFrames;
  let eligibleBlocks = 0;
  let activeBlocks = 0;
  let includedFrames = 0;
  const blockRmsDbfs = [];
  for (let blockStart = 0; blockStart < totalFrames; blockStart += blockFrames) {
    const blockEnd = Math.min(totalFrames, blockStart + blockFrames);
    let blockIncludedFrames = 0;
    let sumSquares = 0;
    let sampleCount = 0;
    for (let frame = blockStart; frame < blockEnd; frame += 1) {
      if (includeMask && includeMask[frame] !== 1) continue;
      blockIncludedFrames += 1;
      includedFrames += 1;
      for (let channel = 0; channel < channels; channel += 1) {
        const value = Number(samples[(frame * channels) + channel]);
        sumSquares += value * value;
        sampleCount += 1;
      }
    }
    if (blockIncludedFrames < Math.ceil((blockEnd - blockStart) / 2) || sampleCount === 0) continue;
    eligibleBlocks += 1;
    const level = dbfs(Math.sqrt(sumSquares / sampleCount));
    blockRmsDbfs.push(level);
    if (level >= EXACT.effectiveEnergyThresholdDbfs) activeBlocks += 1;
  }
  return {
    totalFrames,
    includedFrames,
    includedFrameRatio: includedFrames / totalFrames,
    blockFrames,
    blockMilliseconds: (blockFrames / EXACT.sampleRate) * 1000,
    activeThresholdDbfs: EXACT.effectiveEnergyThresholdDbfs,
    eligibleBlocks,
    activeBlocks,
    activeBlockRatio: eligibleBlocks === 0 ? 0 : activeBlocks / eligibleBlocks,
    minimumBlockRmsDbfs: blockRmsDbfs.length === 0 ? null : Math.min(...blockRmsDbfs),
    maximumBlockRmsDbfs: blockRmsDbfs.length === 0 ? null : Math.max(...blockRmsDbfs),
  };
};

export const validateCoverageGate = (coverage, {
  minimumActiveBlocks = EXACT.spokenMinimumActiveBlocks,
  minimumActiveBlockRatio = EXACT.spokenMinimumActiveBlockRatio,
  minimumIncludedFrameRatio = 1,
  codePrefix = 'DIRECTOR_AB_SPOKEN_SOURCE',
} = {}) => {
  invariant(coverage.includedFrameRatio >= minimumIncludedFrameRatio, `${codePrefix}_INCLUDED_FRAME_RATIO_FAILED`, coverage.includedFrameRatio);
  invariant(coverage.activeBlocks >= minimumActiveBlocks, `${codePrefix}_ACTIVE_BLOCKS_FAILED`, coverage.activeBlocks);
  invariant(coverage.activeBlockRatio >= minimumActiveBlockRatio, `${codePrefix}_ACTIVE_RATIO_FAILED`, coverage.activeBlockRatio);
  return {
    ...coverage,
    thresholds: {minimumActiveBlocks, minimumActiveBlockRatio, minimumIncludedFrameRatio},
    passed: true,
  };
};

const mergeSampleWindows = (windows, totalFrames = EXACT.samplesPerChannel) => {
  const normalized = windows
    .map((window) => ({
      startSample: Math.max(0, Math.min(totalFrames, Math.floor(Number(window.startSample)))),
      endSampleExclusive: Math.max(0, Math.min(totalFrames, Math.ceil(Number(window.endSampleExclusive)))),
    }))
    .filter((window) => window.endSampleExclusive > window.startSample)
    .sort((left, right) => left.startSample - right.startSample);
  const merged = [];
  for (const window of normalized) {
    const previous = merged.at(-1);
    if (previous && window.startSample <= previous.endSampleExclusive) {
      previous.endSampleExclusive = Math.max(previous.endSampleExclusive, window.endSampleExclusive);
    } else {
      merged.push({...window});
    }
  }
  return merged;
};

const outsideWindowMask = (totalFrames, windows) => {
  const mask = new Uint8Array(totalFrames);
  mask.fill(1);
  for (const window of mergeSampleWindows(windows, totalFrames)) {
    mask.fill(0, window.startSample, window.endSampleExclusive);
  }
  return mask;
};

export const measureOutsideWindowDifference = ({withSfx, noSfx, allowedWindows, channels = EXACT.channels}) => {
  const withFrames = audioFrames(withSfx, channels);
  const noFrames = audioFrames(noSfx, channels);
  const totalFrames = Math.min(withFrames, noFrames, EXACT.samplesPerChannel);
  const mask = outsideWindowMask(totalFrames, allowedWindows);
  let sumSquares = 0;
  let count = 0;
  for (let frame = 0; frame < totalFrames; frame += 1) {
    if (mask[frame] !== 1) continue;
    for (let channel = 0; channel < channels; channel += 1) {
      const difference = Number(withSfx[(frame * channels) + channel]) - Number(noSfx[(frame * channels) + channel]);
      sumSquares += difference * difference;
      count += 1;
    }
  }
  invariant(count > 0, 'DIRECTOR_AB_SFX_OUTSIDE_WINDOW_EMPTY');
  const rms = Math.sqrt(sumSquares / count);
  return {
    rms,
    rmsDbfs: dbfs(rms),
    comparedInterleavedSamples: count,
    comparedFrames: count / channels,
    allowedWindows: mergeSampleWindows(allowedWindows, totalFrames),
    includeMask: mask,
  };
};

export const validateOutsideWindowDifferenceGate = (measurement, maximumDbfs = EXACT.outsideSfxDifferenceRmsMaxDbfs) => {
  invariant(isRecord(measurement) && Number(measurement.rmsDbfs) < maximumDbfs, 'DIRECTOR_AB_SFX_OUTSIDE_WINDOW_RMS_FAILED', measurement?.rmsDbfs);
  return {...measurement, maximumDbfs, passed: true};
};

export const validateAacStreamContract = (audio) => {
  invariant(audio?.codec_name === EXACT.aacCodec, 'DIRECTOR_AB_DELIVERY_AUDIO_CODEC_INVALID', audio?.codec_name);
  invariant(audio?.profile === EXACT.aacProfile, 'DIRECTOR_AB_DELIVERY_AUDIO_PROFILE_INVALID', audio?.profile);
  invariant(Number(audio?.sample_rate) === EXACT.sampleRate, 'DIRECTOR_AB_DELIVERY_AUDIO_SAMPLE_RATE_INVALID', audio?.sample_rate);
  invariant(Number(audio?.channels) === EXACT.channels, 'DIRECTOR_AB_DELIVERY_AUDIO_CHANNELS_INVALID', audio?.channels);
  invariant(audio?.time_base === EXACT.aacTimeBase, 'DIRECTOR_AB_DELIVERY_AUDIO_TIME_BASE_INVALID', audio?.time_base);
  return {
    codecName: audio.codec_name,
    profile: audio.profile,
    sampleRate: Number(audio.sample_rate),
    channels: Number(audio.channels),
    timeBase: audio.time_base,
  };
};

export const validateDecodedAudioTailMetrics = ({decodedSamplesPerChannel, codecPaddingPeakDbfs}) => {
  invariant(Number.isInteger(decodedSamplesPerChannel), 'DIRECTOR_AB_DELIVERY_AUDIO_DECODE_SAMPLE_COUNT_INVALID', decodedSamplesPerChannel);
  invariant(decodedSamplesPerChannel >= EXACT.samplesPerChannel, 'DIRECTOR_AB_DELIVERY_AUDIO_DECODE_TOO_SHORT', decodedSamplesPerChannel);
  const codecPaddingSamplesOutsideDeclaredDuration = decodedSamplesPerChannel - EXACT.samplesPerChannel;
  invariant(codecPaddingSamplesOutsideDeclaredDuration <= EXACT.maxAacPaddingSamples, 'DIRECTOR_AB_DELIVERY_AUDIO_TAIL_TOO_LONG', codecPaddingSamplesOutsideDeclaredDuration);
  invariant(codecPaddingPeakDbfs <= EXACT.maxAacPaddingPeakDbfs, 'DIRECTOR_AB_DELIVERY_AUDIO_TAIL_NOT_SILENT', codecPaddingPeakDbfs);
  return {
    decodedSamplesPerChannel,
    codecPaddingSamplesOutsideDeclaredDuration,
    codecPaddingPeakDbfs,
    declaredDurationSamplesPerChannel: EXACT.samplesPerChannel,
    maximumPaddingSamples: EXACT.maxAacPaddingSamples,
    maximumPaddingPeakDbfs: EXACT.maxAacPaddingPeakDbfs,
    gate: 'decoded-aac-not-shorter-than-declared-and-at-most-one-silent-aac-frame-of-padding',
  };
};

const validatePcmTrack = (ffmpeg, ffprobe, filePath) => {
  const media = probe(ffprobe, filePath);
  const audio = oneStream(media, 'audio', 'DIRECTOR_AB_PCM_AUDIO_STREAM_INVALID');
  invariant(audio.codec_name === EXACT.pcmCodec, 'DIRECTOR_AB_PCM_CODEC_INVALID', audio.codec_name);
  invariant(Number(audio.sample_rate) === EXACT.sampleRate && Number(audio.channels) === EXACT.channels, 'DIRECTOR_AB_PCM_FORMAT_INVALID');
  invariant(Number(audio.duration_ts) === EXACT.samplesPerChannel, 'DIRECTOR_AB_PCM_SAMPLE_COUNT_INVALID', audio.duration_ts);
  invariant(closeTo(Number(audio.duration), EXACT.durationSeconds, 1e-9), 'DIRECTOR_AB_PCM_DURATION_INVALID', audio.duration);
  const decoded = decodedPcm(ffmpeg, filePath);
  const expectedBytes = EXACT.samplesPerChannel * EXACT.channels * EXACT.pcmBytesPerSample;
  invariant(decoded.length === expectedBytes, 'DIRECTOR_AB_PCM_DECODED_LENGTH_INVALID', decoded.length);
  return {
    path: filePath,
    sha256: sha256File(filePath),
    decodedPcmSha256: sha256Buffer(decoded),
    sampleRate: Number(audio.sample_rate),
    channels: Number(audio.channels),
    samplesPerChannel: Number(audio.duration_ts),
    durationSeconds: Number(audio.duration),
  };
};

const encodeAlignedAac = ({ffmpeg, pcmPath, outputPath}) => {
  invariant(
    (EXACT.samplesPerChannel + EXACT.aacAlignmentPrerollSamples) % EXACT.aacFrameSamples === 0,
    'DIRECTOR_AB_AAC_ALIGNMENT_CONTRACT_INVALID',
  );
  const args = [
    '-nostdin', '-hide_banner', '-v', 'error', '-n',
    '-i', pcmPath,
    '-map', '0:a:0',
    '-c:a', 'aac',
    '-profile:a', 'aac_low',
    '-b:a', '320k',
    '-ar', String(EXACT.sampleRate),
    '-ac', String(EXACT.channels),
    '-af', `adelay=${EXACT.aacAlignmentPrerollSamples}S:all=1,apad=pad_len=${EXACT.aacEncoderPostrollSamples},asetpts=N/SR/TB`,
    '-movflags', '+faststart',
    outputPath,
  ];
  run(ffmpeg, args);
  return args;
};

const mux = ({ffmpeg, visualMaster, alignedAacPath, outputPath}) => {
  const args = [
    '-nostdin', '-hide_banner', '-v', 'error', '-n',
    '-i', visualMaster,
    '-ss', String(EXACT.aacAlignmentPrerollSamples / EXACT.sampleRate),
    '-i', alignedAacPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-frames:v', String(EXACT.frames),
    '-t', String(EXACT.durationSeconds),
    '-movflags', '+faststart',
    outputPath,
  ];
  run(ffmpeg, args);
  return args;
};

const fullDecode = (ffmpeg, filePath) => {
  const result = run(ffmpeg, ['-nostdin', '-hide_banner', '-v', 'error', '-i', filePath, '-map', '0', '-f', 'null', '-'], {allowFailure: true});
  invariant(result.status === 0, 'DIRECTOR_AB_FULL_DECODE_FAILED', filePath);
  return result.status;
};

const h264ElementarySha = (ffmpeg, filePath) => {
  const result = run(ffmpeg, [
    '-nostdin', '-hide_banner', '-v', 'error',
    '-i', filePath,
    '-map', '0:v:0', '-an',
    '-c:v', 'copy',
    '-bsf:v', 'h264_mp4toannexb',
    '-f', 'h264', 'pipe:1',
  ], {captureStdout: true});
  return sha256Buffer(result.stdout);
};

const frameMd5 = (ffmpeg, filePath) => {
  const result = run(ffmpeg, [
    '-nostdin', '-hide_banner', '-v', 'error',
    '-i', filePath,
    '-map', '0:v:0', '-an',
    '-f', 'framemd5', 'pipe:1',
  ], {captureStdout: true});
  const lines = result.stdout.toString('utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
  const hashes = lines.map((line) => line.split(',').at(-1).trim());
  invariant(hashes.length === EXACT.frames, 'DIRECTOR_AB_FRAMEMD5_FRAME_COUNT_INVALID', `${filePath}:${hashes.length}`);
  return {hashes, manifestSha256: sha256Buffer(Buffer.from(`${hashes.join('\n')}\n`))};
};

const validateDelivery = (ffmpeg, ffprobe, filePath) => {
  const media = probe(ffprobe, filePath);
  const video = oneStream(media, 'video', 'DIRECTOR_AB_DELIVERY_VIDEO_STREAM_INVALID');
  const audio = oneStream(media, 'audio', 'DIRECTOR_AB_DELIVERY_AUDIO_STREAM_INVALID');
  invariant(video.codec_name === 'h264', 'DIRECTOR_AB_DELIVERY_VIDEO_CODEC_INVALID');
  invariant(Number(video.width) === EXACT.width && Number(video.height) === EXACT.height, 'DIRECTOR_AB_DELIVERY_DIMENSIONS_INVALID');
  invariant(closeTo(rational(video.avg_frame_rate || video.r_frame_rate), EXACT.fps, 1e-9), 'DIRECTOR_AB_DELIVERY_FPS_INVALID');
  invariant(Number(video.nb_frames) === EXACT.frames, 'DIRECTOR_AB_DELIVERY_FRAME_COUNT_INVALID', video.nb_frames);
  invariant(closeTo(Number(video.duration), EXACT.durationSeconds, rational(video.time_base)), 'DIRECTOR_AB_DELIVERY_VIDEO_DURATION_INVALID');
  const audioContract = validateAacStreamContract(audio);
  invariant(Number(audio.duration_ts) === EXACT.samplesPerChannel, 'DIRECTOR_AB_DELIVERY_AUDIO_TIMELINE_INVALID', audio.duration_ts);
  invariant(closeTo(Number(audio.duration), EXACT.durationSeconds, 1 / EXACT.sampleRate), 'DIRECTOR_AB_DELIVERY_AUDIO_DURATION_INVALID');
  invariant(closeTo(Number(media.format?.duration), EXACT.durationSeconds, 1 / EXACT.sampleRate), 'DIRECTOR_AB_DELIVERY_CONTAINER_DURATION_INVALID', media.format?.duration);
  const timeline = validateTimelineMetrics({
    media,
    videoFirstPacket: probeFirstPacket(ffprobe, filePath, 'v:0'),
    audioFirstPacket: probeFirstPacket(ffprobe, filePath, 'a:0'),
  });
  fullDecode(ffmpeg, filePath);
  return {media, audioContract, timeline};
};

const decodedAudioTail = (ffmpeg, filePath) => {
  const pcm = decodedFloat32(ffmpeg, filePath);
  const decodedFrames = audioFrames(pcm, EXACT.channels, 'DIRECTOR_AB_DELIVERY_PCM_LENGTH_INVALID');
  let peak = 0;
  for (let index = EXACT.samplesPerChannel * EXACT.channels; index < pcm.length; index += 1) {
    peak = Math.max(peak, Math.abs(Number(pcm[index])));
  }
  return validateDecodedAudioTailMetrics({
    decodedSamplesPerChannel: decodedFrames,
    codecPaddingPeakDbfs: dbfs(peak),
  });
};

export const measureSfxEffectiveEnvelope = (samples, channels = EXACT.channels) => {
  const frames = audioFrames(samples, channels);
  let peak = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      peak = Math.max(peak, Math.abs(Number(samples[(frame * channels) + channel])));
    }
  }
  invariant(peak > 0, 'DIRECTOR_AB_SFX_SOURCE_SILENT');
  const absoluteThreshold = 10 ** (EXACT.sfxEnvelopeAbsoluteThresholdDbfs / 20);
  const relativeThreshold = peak * (10 ** (EXACT.sfxEnvelopePeakRelativeThresholdDb / 20));
  const threshold = Math.max(absoluteThreshold, relativeThreshold);
  let activeStartSample = -1;
  let activeEndSampleExclusive = -1;
  for (let frame = 0; frame < frames; frame += 1) {
    let framePeak = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      framePeak = Math.max(framePeak, Math.abs(Number(samples[(frame * channels) + channel])));
    }
    if (framePeak >= threshold) {
      if (activeStartSample === -1) activeStartSample = frame;
      activeEndSampleExclusive = frame + 1;
    }
  }
  invariant(activeStartSample >= 0 && activeEndSampleExclusive > activeStartSample, 'DIRECTOR_AB_SFX_EFFECTIVE_ENVELOPE_EMPTY');
  const activeSamples = activeEndSampleExclusive - activeStartSample;
  invariant(
    activeSamples <= EXACT.maximumSingleCueEffectiveDurationSeconds * EXACT.sampleRate,
    'DIRECTOR_AB_SFX_EFFECTIVE_DURATION_TOO_LONG',
    activeSamples,
  );
  return {
    decodedSamplesPerChannel: frames,
    activeStartSample,
    activeEndSampleExclusive,
    activeSamples,
    activeDurationSeconds: activeSamples / EXACT.sampleRate,
    peak,
    peakDbfs: dbfs(peak),
    threshold,
    thresholdDbfs: dbfs(threshold),
    absoluteThresholdDbfs: EXACT.sfxEnvelopeAbsoluteThresholdDbfs,
    peakRelativeThresholdDb: EXACT.sfxEnvelopePeakRelativeThresholdDb,
    maximumActiveDurationSeconds: EXACT.maximumSingleCueEffectiveDurationSeconds,
  };
};

const validateSfxSources = (ffmpeg, sfx) => {
  const byId = new Map();
  const receipt = [];
  for (const file of sfx) {
    const samples = decodedFloat32(ffmpeg, file.path, {
      audioFilter: [
        `aresample=${EXACT.sampleRate}:async=0:first_pts=0`,
        `aformat=sample_fmts=fltp:sample_rates=${EXACT.sampleRate}:channel_layouts=stereo`,
        'asetpts=PTS-STARTPTS',
      ].join(','),
    });
    const decodedSamplesPerChannel = audioFrames(samples, EXACT.channels);
    invariant(decodedSamplesPerChannel > 0, 'DIRECTOR_AB_SFX_DECODE_EMPTY', file.id);
    let sumSquares = 0;
    for (const value of samples) sumSquares += Number(value) * Number(value);
    const rms = Math.sqrt(sumSquares / samples.length);
    invariant(rms > 0, 'DIRECTOR_AB_SFX_SOURCE_SILENT', file.id);
    const envelope = measureSfxEffectiveEnvelope(samples);
    const item = {id: file.id, samples, decodedSamplesPerChannel, rms, rmsDbfs: dbfs(rms), envelope};
    byId.set(file.id, item);
    receipt.push({
      id: file.id,
      decodedSamplesPerChannel,
      durationSeconds: decodedSamplesPerChannel / EXACT.sampleRate,
      rms,
      rmsDbfs: dbfs(rms),
      effectiveEnvelope: envelope,
    });
  }
  return {byId, receipt};
};

const sfxEnvelope = (source) => source.envelope ?? measureSfxEffectiveEnvelope(source.samples);

export const buildExpectedSfxMix = ({planInfo, sfxSourceQa}) => {
  const samples = new Float32Array(EXACT.samplesPerChannel * EXACT.channels);
  const cues = [];
  for (const file of planInfo.sfx) {
    const source = sfxSourceQa.byId.get(file.id);
    invariant(source, 'DIRECTOR_AB_SFX_DECODE_RECEIPT_MISSING', file.id);
    const envelope = sfxEnvelope(source);
    for (const cue of file.cues) {
      const startSample = Math.round(Number(cue.atSeconds) * EXACT.sampleRate);
      const retainedSamples = Math.min(source.decodedSamplesPerChannel, EXACT.samplesPerChannel - startSample);
      const retainedRatio = retainedSamples / source.decodedSamplesPerChannel;
      invariant(retainedSamples > 0, 'DIRECTOR_AB_SFX_CUE_NO_RETAINED_SAMPLES', cue.id);
      invariant(
        retainedRatio >= EXACT.cueMinimumRetainedRatio,
        'DIRECTOR_AB_SFX_CUE_TRUNCATED',
        `${cue.id}:${retainedRatio}`,
      );
      for (let frame = 0; frame < source.decodedSamplesPerChannel; frame += 1) {
        for (let channel = 0; channel < EXACT.channels; channel += 1) {
          const sourceIndex = (frame * EXACT.channels) + channel;
          const targetIndex = ((startSample + frame) * EXACT.channels) + channel;
          samples[targetIndex] += Number(source.samples[sourceIndex]) * Number(cue.volume);
        }
      }
      cues.push({
        id: cue.id,
        sourceId: file.id,
        atSeconds: Number(cue.atSeconds),
        volume: Number(cue.volume),
        startSample,
        endSampleExclusive: startSample + source.decodedSamplesPerChannel,
        decodedSourceSamples: source.decodedSamplesPerChannel,
        retainedSamples,
        retainedRatio,
        effectiveStartSample: startSample + envelope.activeStartSample,
        effectiveEndSampleExclusive: startSample + envelope.activeEndSampleExclusive,
        sourceActiveStartSample: envelope.activeStartSample,
        sourceActiveEndSampleExclusive: envelope.activeEndSampleExclusive,
        sourceActiveSamples: envelope.activeSamples,
      });
    }
  }
  return {samples, cues};
};

const buildAllowedSfxWindows = (sfx, sfxSourceQa, expectedSfx) => {
  const windows = [];
  const sources = [];
  for (const file of sfx) {
    const decoded = sfxSourceQa.byId.get(file.id);
    invariant(decoded, 'DIRECTOR_AB_SFX_DECODE_RECEIPT_MISSING', file.id);
    sources.push({
      id: file.id,
      decodedSamplesPerChannel: decoded.decodedSamplesPerChannel,
      durationSeconds: decoded.decodedSamplesPerChannel / EXACT.sampleRate,
      effectiveEnvelope: sfxEnvelope(decoded),
    });
    for (const cue of file.cues) {
      const contract = expectedSfx.cues.find((item) => item.id === cue.id);
      invariant(contract, 'DIRECTOR_AB_SFX_EXPECTED_CUE_MISSING', cue.id);
      windows.push({
        cueId: cue.id,
        sourceId: file.id,
        cueStartSample: contract.startSample,
        cueEndSampleExclusive: contract.endSampleExclusive,
        effectiveCueStartSample: contract.effectiveStartSample,
        effectiveCueEndSampleExclusive: contract.effectiveEndSampleExclusive,
        startSample: contract.effectiveStartSample - EXACT.sfxWindowCodecGuardSamples,
        endSampleExclusive: contract.effectiveEndSampleExclusive + EXACT.sfxWindowCodecGuardSamples,
      });
    }
  }
  return {
    sourceDurations: sources,
    codecGuardSamplesEachSide: EXACT.sfxWindowCodecGuardSamples,
    windows,
    mergedWindows: mergeSampleWindows(windows),
  };
};

export const validateSfxWindowCoverage = (mergedWindows, totalFrames = EXACT.samplesPerChannel) => {
  const allowedSamples = mergeSampleWindows(mergedWindows, totalFrames).reduce(
    (total, window) => total + (window.endSampleExclusive - window.startSample),
    0,
  );
  const allowedWindowRatio = allowedSamples / totalFrames;
  const outsideFrameRatio = 1 - allowedWindowRatio;
  invariant(allowedWindowRatio <= EXACT.maximumAllowedSfxWindowRatio, 'DIRECTOR_AB_SFX_ALLOWED_WINDOWS_TOO_BROAD', allowedWindowRatio);
  invariant(outsideFrameRatio >= EXACT.minimumOutsideSfxFrameRatio, 'DIRECTOR_AB_SFX_OUTSIDE_FRAMES_INSUFFICIENT', outsideFrameRatio);
  return {
    allowedSamples,
    allowedWindowRatio,
    outsideFrameRatio,
    maximumAllowedWindowRatio: EXACT.maximumAllowedSfxWindowRatio,
    minimumOutsideFrameRatio: EXACT.minimumOutsideSfxFrameRatio,
    passed: true,
  };
};

const interleavedRms = (samples, startFrame, endFrameExclusive, channels = EXACT.channels) => {
  invariant(endFrameExclusive > startFrame, 'DIRECTOR_AB_AUDIO_RMS_RANGE_EMPTY');
  let sumSquares = 0;
  let count = 0;
  for (let frame = startFrame; frame < endFrameExclusive; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const value = Number(samples[(frame * channels) + channel]);
      sumSquares += value * value;
      count += 1;
    }
  }
  return Math.sqrt(sumSquares / count);
};

const subtractInterleaved = (left, right) => {
  invariant(left.length === right.length, 'DIRECTOR_AB_AUDIO_DIFFERENCE_LENGTH_MISMATCH');
  const difference = new Float32Array(left.length);
  for (let index = 0; index < left.length; index += 1) difference[index] = Number(left[index]) - Number(right[index]);
  return difference;
};

const validateExpectedSfxMeasurement = (measurement, {
  mode,
  correlationMinimum,
  gainMinimum,
  gainMaximum,
  rmsRatioMinimum,
  rmsRatioMaximum,
  dcOffsetMaximum,
  residualMaximum,
  codePrefix,
}) => {
  invariant(measurement.correlation >= correlationMinimum, `${codePrefix}_CORRELATION_FAILED`, measurement.correlation);
  invariant(measurement.gain >= gainMinimum && measurement.gain <= gainMaximum, `${codePrefix}_GAIN_FAILED`, measurement.gain);
  invariant(measurement.rmsRatio >= rmsRatioMinimum && measurement.rmsRatio <= rmsRatioMaximum, `${codePrefix}_RMS_RATIO_FAILED`, measurement.rmsRatio);
  invariant(Math.abs(measurement.offset) <= dcOffsetMaximum, `${codePrefix}_DC_OFFSET_FAILED`, measurement.offset);
  invariant(measurement.residualToReferenceRmsRatio <= residualMaximum, `${codePrefix}_RESIDUAL_FAILED`, measurement.residualToReferenceRmsRatio);
  return {
    ...measurement,
    mode,
    thresholds: {
      correlationMinimum,
      gainMinimum,
      gainMaximum,
      rmsRatioMinimum,
      rmsRatioMaximum,
      dcOffsetAbsoluteMaximum: dcOffsetMaximum,
      residualToReferenceRmsMaximum: residualMaximum,
    },
    passed: true,
  };
};

const effectiveCueMask = (cues) => {
  const mask = new Uint8Array(EXACT.samplesPerChannel);
  for (const cue of cues) mask.fill(1, cue.effectiveStartSample, cue.effectiveEndSampleExclusive);
  return mask;
};

export const validateExpectedSfxPcmIdentity = ({expectedSfx, withSfx, noSfx}) => {
  const observedDifference = subtractInterleaved(withSfx, noSfx);
  const measurement = measureAlignedPearson({
    reference: expectedSfx.samples,
    candidate: observedDifference,
    maxDelaySamples: 0,
    searchStrideFrames: 1,
  });
  return validateExpectedSfxMeasurement(measurement, {
    mode: '24-bit-pcm-total-sfx-mix-identity',
    correlationMinimum: EXACT.expectedSfxPcmCorrelationMin,
    gainMinimum: EXACT.expectedSfxPcmGainMin,
    gainMaximum: EXACT.expectedSfxPcmGainMax,
    rmsRatioMinimum: EXACT.expectedSfxPcmRmsRatioMin,
    rmsRatioMaximum: EXACT.expectedSfxPcmRmsRatioMax,
    dcOffsetMaximum: EXACT.expectedSfxPcmDcOffsetMax,
    residualMaximum: EXACT.expectedSfxPcmResidualToReferenceRmsMax,
    codePrefix: 'DIRECTOR_AB_EXPECTED_SFX_PCM',
  });
};

export const validateExpectedSfxAacIdentity = ({expectedSfx, withSfx, noSfx}) => {
  const observedDifference = subtractInterleaved(withSfx, noSfx);
  const measurement = measureAlignedPearson({
    reference: expectedSfx.samples,
    candidate: observedDifference,
    maxDelaySamples: 0,
    searchStrideFrames: 1,
    includeMask: effectiveCueMask(expectedSfx.cues),
  });
  return validateExpectedSfxMeasurement(measurement, {
    mode: 'aac-lc-320k-total-sfx-mix-identity-inside-effective-envelopes',
    correlationMinimum: EXACT.expectedSfxAacCorrelationMin,
    gainMinimum: EXACT.expectedSfxAacGainMin,
    gainMaximum: EXACT.expectedSfxAacGainMax,
    rmsRatioMinimum: EXACT.expectedSfxAacRmsRatioMin,
    rmsRatioMaximum: EXACT.expectedSfxAacRmsRatioMax,
    dcOffsetMaximum: EXACT.expectedSfxAacDcOffsetMax,
    residualMaximum: EXACT.expectedSfxAacResidualToReferenceRmsMax,
    codePrefix: 'DIRECTOR_AB_EXPECTED_SFX_AAC',
  });
};

export const validateCueEnergyQa = ({planInfo, sfxSourceQa, expectedSfx, withSfx, noSfx}) => {
  const expected = expectedSfx ?? buildExpectedSfxMix({planInfo, sfxSourceQa});
  const observedDifference = subtractInterleaved(withSfx, noSfx);
  const cues = [];
  for (const file of planInfo.sfx) {
    const source = sfxSourceQa.byId.get(file.id);
    for (const cue of file.cues) {
      const contract = expected.cues.find((item) => item.id === cue.id);
      invariant(contract, 'DIRECTOR_AB_SFX_EXPECTED_CUE_MISSING', cue.id);
      const activeStart = contract.sourceActiveStartSample;
      const activeEnd = contract.sourceActiveEndSampleExclusive;
      const sourceRms = interleavedRms(source.samples, activeStart, activeEnd);
      const expectedRms = sourceRms * Number(cue.volume);
      invariant(dbfs(expectedRms) >= EXACT.cueMinimumExpectedRmsDbfs, 'DIRECTOR_AB_SFX_CUE_EXPECTED_ENERGY_TOO_LOW', `${cue.id}:${dbfs(expectedRms)}`);
      const cueReference = new Float32Array(contract.sourceActiveSamples * EXACT.channels);
      const cueCandidate = new Float32Array(contract.sourceActiveSamples * EXACT.channels);
      for (let sourceFrame = activeStart; sourceFrame < activeEnd; sourceFrame += 1) {
        const relativeFrame = sourceFrame - activeStart;
        const targetFrame = contract.startSample + sourceFrame;
        for (let channel = 0; channel < EXACT.channels; channel += 1) {
          const cueIndex = (relativeFrame * EXACT.channels) + channel;
          const sourceIndex = (sourceFrame * EXACT.channels) + channel;
          const targetIndex = (targetFrame * EXACT.channels) + channel;
          const contribution = Number(source.samples[sourceIndex]) * Number(cue.volume);
          cueReference[cueIndex] = contribution;
          cueCandidate[cueIndex] = observedDifference[targetIndex]
            - Number(expected.samples[targetIndex])
            + contribution;
        }
      }
      const observedRms = interleavedRms(cueCandidate, 0, contract.sourceActiveSamples);
      const observedToExpectedRmsRatio = observedRms / expectedRms;
      invariant(
        observedToExpectedRmsRatio >= EXACT.cueMinimumObservedToExpectedRmsRatio,
        'DIRECTOR_AB_SFX_CUE_OBSERVED_ENERGY_TOO_LOW',
        `${cue.id}:${observedToExpectedRmsRatio}`,
      );
      const waveform = measureAlignedPearson({
        reference: cueReference,
        candidate: cueCandidate,
        maxDelaySamples: 0,
        searchStrideFrames: 1,
      });
      invariant(
        observedToExpectedRmsRatio <= EXACT.cueMaximumObservedToExpectedRmsRatio,
        'DIRECTOR_AB_SFX_CUE_OBSERVED_ENERGY_TOO_HIGH',
        `${cue.id}:${observedToExpectedRmsRatio}`,
      );
      invariant(waveform.correlation >= EXACT.cueWaveformCorrelationMin, 'DIRECTOR_AB_SFX_CUE_WAVEFORM_CORRELATION_FAILED', `${cue.id}:${waveform.correlation}`);
      invariant(waveform.gain >= EXACT.cueWaveformGainMin && waveform.gain <= EXACT.cueWaveformGainMax, 'DIRECTOR_AB_SFX_CUE_WAVEFORM_GAIN_FAILED', `${cue.id}:${waveform.gain}`);
      invariant(waveform.residualToReferenceRmsRatio <= EXACT.cueWaveformResidualToReferenceRmsMax, 'DIRECTOR_AB_SFX_CUE_WAVEFORM_RESIDUAL_FAILED', `${cue.id}:${waveform.residualToReferenceRmsRatio}`);
      cues.push({
        id: cue.id,
        sourceId: file.id,
        atSeconds: Number(cue.atSeconds),
        startSample: contract.startSample,
        decodedSourceSamples: contract.decodedSourceSamples,
        retainedSamples: contract.retainedSamples,
        retainedRatio: contract.retainedRatio,
        effectiveStartSample: contract.effectiveStartSample,
        effectiveEndSampleExclusive: contract.effectiveEndSampleExclusive,
        effectiveSamples: contract.sourceActiveSamples,
        expectedRms,
        expectedRmsDbfs: dbfs(expectedRms),
        observedDifferenceRms: observedRms,
        observedDifferenceRmsDbfs: dbfs(observedRms),
        observedToExpectedRmsRatio,
        waveform,
        thresholds: {
          minimumExpectedRmsDbfs: EXACT.cueMinimumExpectedRmsDbfs,
          minimumRetainedRatio: EXACT.cueMinimumRetainedRatio,
          minimumObservedToExpectedRmsRatio: EXACT.cueMinimumObservedToExpectedRmsRatio,
          maximumObservedToExpectedRmsRatio: EXACT.cueMaximumObservedToExpectedRmsRatio,
          waveformCorrelationMinimum: EXACT.cueWaveformCorrelationMin,
          waveformGainMinimum: EXACT.cueWaveformGainMin,
          waveformGainMaximum: EXACT.cueWaveformGainMax,
          waveformResidualToReferenceRmsMaximum: EXACT.cueWaveformResidualToReferenceRmsMax,
        },
        passed: true,
      });
    }
  }
  return cues;
};

const spokenReferenceFloat32 = (ffmpeg, spoken) => decodedFloat32(ffmpeg, spoken.path, {
  audioFilter: [
    `atrim=start=${Number(spoken.sourceIn)}:end=${Number(spoken.sourceOut)}`,
    'asetpts=PTS-STARTPTS',
    `aresample=${EXACT.sampleRate}:async=0:first_pts=0`,
    `aformat=sample_fmts=fltp:sample_rates=${EXACT.sampleRate}:channel_layouts=stereo`,
    'asetpts=N/SR/TB',
  ].join(','),
});

const validateSpokenSourcePreflight = (ffmpeg, spoken) => {
  const reference = spokenReferenceFloat32(ffmpeg, spoken);
  const samplesPerChannel = audioFrames(reference, EXACT.channels);
  invariant(samplesPerChannel === EXACT.samplesPerChannel, 'DIRECTOR_AB_SPOKEN_SOURCE_COVERAGE_INCOMPLETE', samplesPerChannel);
  const coverage = validateCoverageGate(measureEffectiveSignalCoverage({samples: reference}));
  let sumSquares = 0;
  for (const value of reference) sumSquares += Number(value) * Number(value);
  const rms = Math.sqrt(sumSquares / reference.length);
  invariant(dbfs(rms) >= EXACT.spokenMinimumRmsDbfs, 'DIRECTOR_AB_SPOKEN_SOURCE_ENERGY_TOO_LOW', dbfs(rms));
  return {
    reference,
    receipt: {
      sourceIn: Number(spoken.sourceIn),
      sourceOut: Number(spoken.sourceOut),
      decodedSamplesPerChannel: samplesPerChannel,
      sampleRate: EXACT.sampleRate,
      channels: EXACT.channels,
      rms,
      rmsDbfs: dbfs(rms),
      coverage,
      paddingUsed: false,
    },
  };
};

const validateNoSfxPcmPreservation = (ffmpeg, noPcmPath, spokenSourceQa) => {
  const pcm = decodedFloat32(ffmpeg, noPcmPath);
  invariant(audioFrames(pcm, EXACT.channels) === EXACT.samplesPerChannel, 'DIRECTOR_AB_NO_SFX_PCM_SOURCE_SAMPLE_COUNT_MISMATCH');
  const measurement = measureAlignedPearson({
    reference: spokenSourceQa.reference,
    candidate: pcm,
    maxDelaySamples: 0,
    searchStrideFrames: 1,
  });
  invariant(measurement.correlation >= EXACT.pcmSpokenCorrelationMin, 'DIRECTOR_AB_NO_SFX_PCM_SOURCE_CORRELATION_FAILED', measurement.correlation);
  invariant(Math.abs(measurement.gain - 1) <= EXACT.pcmSpokenGainTolerance, 'DIRECTOR_AB_NO_SFX_PCM_SOURCE_GAIN_FAILED', measurement.gain);
  invariant(Math.abs(measurement.rmsRatio - 1) <= EXACT.pcmSpokenRmsRatioTolerance, 'DIRECTOR_AB_NO_SFX_PCM_SOURCE_RMS_RATIO_FAILED', measurement.rmsRatio);
  invariant(Math.abs(measurement.offset) <= EXACT.pcmSpokenDcOffsetMax, 'DIRECTOR_AB_NO_SFX_PCM_SOURCE_DC_OFFSET_FAILED', measurement.offset);
  invariant(
    measurement.residualToReferenceRmsRatio <= EXACT.pcmSpokenResidualToReferenceRmsMax,
    'DIRECTOR_AB_NO_SFX_PCM_SOURCE_RESIDUAL_FAILED',
    measurement.residualToReferenceRmsRatio,
  );
  const tailStart = (EXACT.samplesPerChannel - EXACT.aacFrameSamples) * EXACT.channels;
  let tailMaximumAbsoluteDifference = 0;
  for (let index = tailStart; index < pcm.length; index += 1) {
    tailMaximumAbsoluteDifference = Math.max(
      tailMaximumAbsoluteDifference,
      Math.abs(Number(pcm[index]) - Number(spokenSourceQa.reference[index])),
    );
  }
  invariant(tailMaximumAbsoluteDifference <= EXACT.pcmSpokenDcOffsetMax, 'DIRECTOR_AB_NO_SFX_PCM_DECLARED_TAIL_DIFFERENCE_FAILED', tailMaximumAbsoluteDifference);
  return {
    ...measurement,
    declaredTail: {
      samplesPerChannel: EXACT.aacFrameSamples,
      maximumAbsoluteDifference: tailMaximumAbsoluteDifference,
      maximumAllowedAbsoluteDifference: EXACT.pcmSpokenDcOffsetMax,
      passed: true,
    },
    thresholds: {
      correlationMinimum: EXACT.pcmSpokenCorrelationMin,
      gainAbsoluteToleranceFromUnity: EXACT.pcmSpokenGainTolerance,
      rmsRatioAbsoluteToleranceFromUnity: EXACT.pcmSpokenRmsRatioTolerance,
      dcOffsetAbsoluteMaximum: EXACT.pcmSpokenDcOffsetMax,
      residualToReferenceRmsMaximum: EXACT.pcmSpokenResidualToReferenceRmsMax,
    },
    passed: true,
  };
};

const audioSimilarityQa = ({ffmpeg, planInfo, spokenSourceQa, sfxSourceQa, expectedSfx, withDelivery, noDelivery}) => {
  const spokenReference = spokenSourceQa.reference;
  const withSfx = decodedFloat32(ffmpeg, withDelivery);
  const noSfx = decodedFloat32(ffmpeg, noDelivery);
  invariant(audioFrames(withSfx, EXACT.channels) >= EXACT.samplesPerChannel, 'DIRECTOR_AB_WITH_SFX_DECODE_TOO_SHORT');
  invariant(audioFrames(noSfx, EXACT.channels) >= EXACT.samplesPerChannel, 'DIRECTOR_AB_NO_SFX_DECODE_TOO_SHORT');
  const noSfxDeclared = noSfx.subarray(0, EXACT.samplesPerChannel * EXACT.channels);
  const withSfxDeclared = withSfx.subarray(0, EXACT.samplesPerChannel * EXACT.channels);
  const noSfxSpoken = validateSpokenFidelityGate(measureAlignedPearson({
    reference: spokenReference,
    candidate: noSfxDeclared,
    maxDelaySamples: EXACT.correlationMaxDelaySamples,
  }));
  const allowedSfx = buildAllowedSfxWindows(planInfo.sfx, sfxSourceQa, expectedSfx);
  Object.assign(allowedSfx, validateSfxWindowCoverage(allowedSfx.mergedWindows));
  const outsideDifference = validateOutsideWindowDifferenceGate(measureOutsideWindowDifference({
    withSfx: withSfxDeclared,
    noSfx: noSfxDeclared,
    allowedWindows: allowedSfx.mergedWindows,
  }));
  const outsideVoiceCoverage = validateCoverageGate(measureEffectiveSignalCoverage({
    samples: noSfxDeclared,
    includeMask: outsideDifference.includeMask,
  }), {
    minimumActiveBlocks: EXACT.outsideSfxMinimumActiveBlocks,
    minimumActiveBlockRatio: EXACT.outsideSfxMinimumActiveBlockRatio,
    minimumIncludedFrameRatio: EXACT.minimumOutsideSfxFrameRatio,
    codePrefix: 'DIRECTOR_AB_OUTSIDE_SFX_VOICE',
  });
  const voiceCorrelation = validateSpokenFidelityGate(measureAlignedPearson({
    reference: noSfxDeclared,
    candidate: withSfxDeclared,
    maxDelaySamples: 0,
    searchStrideFrames: 1,
    includeMask: outsideDifference.includeMask,
  }), {
    correlationMinimum: EXACT.withSfxNoSfxVoiceCorrelationMin,
    codePrefix: 'DIRECTOR_AB_WITH_SFX_VOICE',
  });
  const expectedSfxAacIdentity = validateExpectedSfxAacIdentity({
    expectedSfx,
    withSfx: withSfxDeclared,
    noSfx: noSfxDeclared,
  });
  const cueEnergy = validateCueEnergyQa({
    planInfo,
    sfxSourceQa,
    expectedSfx,
    withSfx: withSfxDeclared,
    noSfx: noSfxDeclared,
  });
  const tailStart = EXACT.samplesPerChannel - EXACT.aacFrameSamples;
  const tailReference = spokenReference.subarray(tailStart * EXACT.channels);
  const tailCandidate = noSfxDeclared.subarray(tailStart * EXACT.channels);
  const tailReferenceRms = interleavedRms(tailReference, 0, EXACT.aacFrameSamples);
  let declaredTailPreservation = {
    status: 'not-energy-qualified',
    referenceRmsDbfs: dbfs(tailReferenceRms),
    qualifyingThresholdDbfs: EXACT.spokenMinimumRmsDbfs,
  };
  if (dbfs(tailReferenceRms) >= EXACT.spokenMinimumRmsDbfs) {
    const measurement = measureAlignedPearson({
      reference: tailReference,
      candidate: tailCandidate,
      maxDelaySamples: 0,
      searchStrideFrames: 1,
    });
    invariant(measurement.correlation >= EXACT.declaredTailMarkerCorrelationMin, 'DIRECTOR_AB_DECLARED_TAIL_CORRELATION_FAILED', measurement.correlation);
    invariant(
      measurement.rmsRatio >= EXACT.declaredTailMarkerRmsRatioMin && measurement.rmsRatio <= EXACT.declaredTailMarkerRmsRatioMax,
      'DIRECTOR_AB_DECLARED_TAIL_RMS_RATIO_FAILED',
      measurement.rmsRatio,
    );
    declaredTailPreservation = {
      status: 'energy-qualified-and-passed',
      ...measurement,
      thresholds: {
        correlationMinimum: EXACT.declaredTailMarkerCorrelationMin,
        rmsRatioMinimum: EXACT.declaredTailMarkerRmsRatioMin,
        rmsRatioMaximum: EXACT.declaredTailMarkerRmsRatioMax,
      },
    };
  }
  delete outsideDifference.includeMask;
  return {
    noSfxAgainstAuthoritativeSpoken: noSfxSpoken,
    withSfxAgainstNoSfxVoiceOutsideAllowedSfx: voiceCorrelation,
    outsideAllowedSfxDifference: outsideDifference,
    outsideAllowedSfxVoiceCoverage: outsideVoiceCoverage,
    allowedSfxWindows: allowedSfx,
    expectedSfxAacIdentity,
    cueEnergy,
    declaredTailPreservation,
  };
};

export const parseFreezeDetectLog = (log, {durationSeconds = EXACT.durationSeconds} = {}) => {
  invariant(typeof log === 'string' && finite(durationSeconds) && Number(durationSeconds) > 0, 'DIRECTOR_AB_FREEZE_LOG_INPUT_INVALID');
  const streamDuration = Number(durationSeconds);
  const timestampTolerance = 0.000001;
  const validateHitBounds = (hit) => {
    invariant(hit.start <= streamDuration + timestampTolerance && hit.end <= streamDuration + timestampTolerance, 'DIRECTOR_AB_FREEZE_LOG_BOUNDS_INVALID', `${hit.start}:${hit.end}/${streamDuration}`);
    invariant(hit.duration + timestampTolerance >= FREEZE_DETECTOR.durationSeconds, 'DIRECTOR_AB_FREEZE_LOG_HIT_BELOW_DETECTOR_THRESHOLD', hit.duration);
  };
  const tokenPattern = /freeze_(start|duration|end):\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g;
  const hits = [];
  let active = null;
  let lastClosed = null;
  let lastEnd = 0;
  for (const match of log.matchAll(tokenPattern)) {
    const kind = match[1];
    const value = Number(match[2]);
    invariant(Number.isFinite(value) && value >= 0, 'DIRECTOR_AB_FREEZE_LOG_VALUE_INVALID', `${kind}:${match[2]}`);
    if (kind === 'start') {
      invariant(active === null, 'DIRECTOR_AB_FREEZE_LOG_ORDER_INVALID', 'start-while-active');
      invariant(value >= lastEnd, 'DIRECTOR_AB_FREEZE_LOG_ORDER_INVALID', 'start-before-previous-end');
      invariant(value <= streamDuration + timestampTolerance, 'DIRECTOR_AB_FREEZE_LOG_BOUNDS_INVALID', `start:${value}/${streamDuration}`);
      active = {start: value, declaredDuration: null};
      lastClosed = null;
      continue;
    }
    if (kind === 'duration') {
      if (active) {
        invariant(active.declaredDuration === null, 'DIRECTOR_AB_FREEZE_LOG_ORDER_INVALID', 'duplicate-duration');
        active.declaredDuration = value;
      } else {
        invariant(lastClosed && lastClosed.declaredDuration === null, 'DIRECTOR_AB_FREEZE_LOG_ORDER_INVALID', 'duration-without-hit');
        lastClosed.declaredDuration = value;
        invariant(closeTo(lastClosed.duration, value, 2 / EXACT.fps), 'DIRECTOR_AB_FREEZE_LOG_DURATION_DRIFT', `${lastClosed.duration}:${value}`);
      }
      continue;
    }
    invariant(active !== null, 'DIRECTOR_AB_FREEZE_LOG_ORDER_INVALID', 'end-without-start');
    invariant(value >= active.start, 'DIRECTOR_AB_FREEZE_LOG_ORDER_INVALID', 'end-before-start');
    const hit = {
      start: active.start,
      end: value,
      duration: value - active.start,
      closedBy: 'freeze_end',
      declaredDuration: active.declaredDuration,
    };
    if (hit.declaredDuration !== null) {
      invariant(closeTo(hit.duration, hit.declaredDuration, 2 / EXACT.fps), 'DIRECTOR_AB_FREEZE_LOG_DURATION_DRIFT', `${hit.duration}:${hit.declaredDuration}`);
    }
    validateHitBounds(hit);
    hits.push(hit);
    lastEnd = hit.end;
    lastClosed = hit;
    active = null;
  }
  if (active) {
    invariant(streamDuration >= active.start, 'DIRECTOR_AB_FREEZE_LOG_EOF_INVALID', active.start);
    const hit = {
      start: active.start,
      end: streamDuration,
      duration: streamDuration - active.start,
      closedBy: 'eof',
      declaredDuration: active.declaredDuration,
    };
    if (hit.declaredDuration !== null) {
      invariant(closeTo(hit.duration, hit.declaredDuration, 2 / EXACT.fps), 'DIRECTOR_AB_FREEZE_LOG_DURATION_DRIFT', `${hit.duration}:${hit.declaredDuration}`);
    }
    validateHitBounds(hit);
    hits.push(hit);
  }
  return hits.map(({declaredDuration: _declaredDuration, ...hit}) => hit);
};

const splitFreezeHitsByScene = (rawHits, contract) => {
  const boundaries = [...new Set(contract.scenes.flatMap((scene) => [
    scene.start,
    scene.end,
    ...(scene.eligible ? [scene.explainStart, scene.explainEnd] : []),
  ]))].sort((a, b) => a - b);
  return rawHits.flatMap((rawHit, rawHitIndex) => {
    const cuts = [rawHit.start, ...boundaries.filter((boundary) => boundary > rawHit.start && boundary < rawHit.end), rawHit.end];
    return cuts.slice(0, -1).map((start, index) => {
      const end = cuts[index + 1];
      const midpoint = start + (end - start) / 2;
      const scene = contract.scenes.find((candidate) => midpoint >= candidate.start && midpoint < candidate.end);
      return {
        rawHitIndex,
        start,
        end,
        duration: end - start,
        sceneId: scene?.id ?? null,
        sceneType: scene?.type ?? null,
        stateRevealMethod: scene?.method ?? null,
        eligiblePlanSegment: scene?.eligible === true && midpoint >= scene.explainStart && midpoint < scene.explainEnd,
      };
    });
  });
};

const FREEZE_EVENT_EPSILON_SECONDS = 1e-9;
const frameStrictlyInsideSegment = (frame, segment, fps) => {
  const seconds = frame / fps;
  return seconds > segment.start + FREEZE_EVENT_EPSILON_SECONDS && seconds < segment.end - FREEZE_EVENT_EPSILON_SECONDS;
};

export const planFreezeEvidenceWork = ({rawHits, contract}) => {
  invariant(Array.isArray(rawHits) && isRecord(contract) && Array.isArray(contract.scenes) && finite(contract.fps), 'DIRECTOR_AB_FREEZE_WORK_INPUT_INVALID');
  const segments = splitFreezeHitsByScene(rawHits, contract);
  const assignments = [];
  segments.forEach((segment, segmentIndex) => {
    const scene = contract.scenes.find((candidate) => candidate.id === segment.sceneId);
    if (!scene || !segment.eligiblePlanSegment) return;
    for (const event of scene.events) {
      const transitionEligible = frameStrictlyInsideSegment(event.frame, segment, contract.fps);
      const auditedHoldDestinationFrames = event.kind === 'authored-pose'
        ? Array.from({length: event.holdFrames - 1}, (_unused, offset) => event.frame + offset + 1)
          .filter((frame) => frameStrictlyInsideSegment(frame, segment, contract.fps))
        : [];
      if (!transitionEligible && auditedHoldDestinationFrames.length === 0) continue;
      const requiredFrames = new Set();
      if (transitionEligible) requiredFrames.add(event.frame - 1).add(event.frame);
      for (const destinationFrame of auditedHoldDestinationFrames) requiredFrames.add(destinationFrame - 1).add(destinationFrame);
      assignments.push({
        segmentIndex,
        rawHitIndex: segment.rawHitIndex,
        sceneId: scene.id,
        stateId: event.stateId,
        event,
        transitionEligible,
        auditedHoldDestinationFrames,
        requiredFrames: [...requiredFrames].sort((left, right) => left - right),
      });
    }
  });
  const jobsByKey = new Map();
  for (const assignment of assignments) {
    const key = `${assignment.rawHitIndex}\0${assignment.sceneId}\0${assignment.stateId}`;
    let job = jobsByKey.get(key);
    if (!job) {
      job = {
        id: key,
        rawHitIndex: assignment.rawHitIndex,
        sceneId: assignment.sceneId,
        stateId: assignment.stateId,
        assignments: [],
        requiredFrames: [],
      };
      jobsByKey.set(key, job);
    }
    job.assignments.push(assignment);
    job.requiredFrames.push(...assignment.requiredFrames);
  }
  const jobs = [...jobsByKey.values()].map((job) => {
    const scene = contract.scenes.find((candidate) => candidate.id === job.sceneId);
    const authority = scene?.events.find((event) => event.stateId === job.stateId && event.kind === 'authority-state');
    invariant(authority, 'DIRECTOR_AB_FREEZE_BOUND_EVENT_SET_INVALID', `${job.sceneId}:${job.stateId}`);
    const requiredFrames = [...new Set(job.requiredFrames)].sort((left, right) => left - right);
    invariant(requiredFrames.length <= 11 && requiredFrames.every((frame) => frame >= authority.frame - 10 && frame <= authority.frame), 'DIRECTOR_AB_FREEZE_STATE_FRAME_WINDOW_INVALID', `${job.sceneId}:${job.stateId}:${requiredFrames.join(',')}`);
    return {...job, requiredFrames};
  });
  const decodedFullFrameRgbBytesPerFrame = Number(contract.width) * Number(contract.height) * 3;
  const maximumPlanRegionAreaPixels = Math.max(0, ...contract.scenes.flatMap((scene) => scene.events ?? []).map((event) => Number(event.region?.area ?? 0)));
  const maximumRetainedDecodedFullFrameRgbBytes = 11 * decodedFullFrameRgbBytesPerFrame;
  const maximumPerStateRoiWorkingBufferBytes = 28 * maximumPlanRegionAreaPixels;
  return {
    segments,
    assignments,
    jobs,
    resourceBounds: {
      model: 'per-raw-hit-scene-state/v1',
      maxFramesPerStateJob: 11,
      decodedFullFrameRgbBytesPerFrameFormula: 'contract.width*contract.height*3',
      decodedFullFrameRgbBytesPerFrame,
      maximumRetainedDecodedFullFrameRgbBytesFormula: 'maxFramesPerStateJob*decodedFullFrameRgbBytesPerFrame',
      maximumRetainedDecodedFullFrameRgbBytes,
      maximumPlanRegionAreaPixels,
      maximumPerStateRoiWorkingBufferBytesFormula: '28*maximumPlanRegionAreaPixels',
      maximumPerStateRoiWorkingBufferBytes,
      maximumTheoreticalApplicationBufferBytesFormula: 'maximumRetainedDecodedFullFrameRgbBytes+(28*maximumPlanRegionAreaPixels)',
      maximumTheoreticalApplicationBufferBytes: maximumRetainedDecodedFullFrameRgbBytes + maximumPerStateRoiWorkingBufferBytes,
      maximumTheoreticalApplicationBufferBytesScope: 'node-buffer-payloads-retained-by-one-state-evidence-job;excludes-v8-object-overhead-and-ffmpeg-subprocess-memory',
      crossStateFrameCacheAllowed: false,
    },
  };
};

const decodeSelectedRgbFrames = (ffmpeg, filePath, frames, width, height) => {
  const ordered = [...new Set(frames)].sort((left, right) => left - right);
  if (ordered.length === 0) return new Map();
  invariant(ordered.every((frame) => Number.isInteger(frame) && frame >= 0 && frame < EXACT.frames), 'DIRECTOR_AB_FREEZE_SAMPLE_FRAME_INVALID');
  const frameBytes = width * height * 3;
  const decoded = new Map();
  const maximumFramesPerDecode = 11;
  for (let offset = 0; offset < ordered.length; offset += maximumFramesPerDecode) {
    const batch = ordered.slice(offset, offset + maximumFramesPerDecode);
    const select = batch.map((frame) => `eq(n\\,${frame})`).join('+');
    const result = run(ffmpeg, [
      '-nostdin', '-hide_banner', '-v', 'error',
      '-i', filePath,
      '-map', '0:v:0', '-an',
      '-vf', `format=rgb24,select=${select}`,
      '-frames:v', String(batch.length),
      '-fps_mode', 'passthrough',
      '-pix_fmt', 'rgb24',
      '-f', 'rawvideo',
      'pipe:1',
    ], {captureStdout: true});
    invariant(result.stdout.length === batch.length * frameBytes, 'DIRECTOR_AB_FREEZE_SAMPLE_DECODE_LENGTH_INVALID', `${result.stdout.length}:${batch.length * frameBytes}`);
    batch.forEach((frame, index) => decoded.set(
      frame,
      result.stdout.subarray(index * frameBytes, (index + 1) * frameBytes),
    ));
  }
  return decoded;
};

export const measureFreezeFrameDifference = ({before, after, width, height, region}) => {
  invariant(Buffer.isBuffer(before) && Buffer.isBuffer(after) && before.length === width * height * 3 && after.length === width * height * 3, 'DIRECTOR_AB_FREEZE_FRAME_BUFFER_INVALID');
  const mask = new Uint8Array(region.area);
  let roiChangedPixels = 0;
  let outsideChangedPixels = 0;
  let maximumLumaDelta = 0;
  let squaredError = 0;
  let roiSquaredError = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = y * width + x;
      const offset = pixelOffset * 3;
      const redDelta = Math.abs(before[offset] - after[offset]);
      const greenDelta = Math.abs(before[offset + 1] - after[offset + 1]);
      const blueDelta = Math.abs(before[offset + 2] - after[offset + 2]);
      const delta = Math.max(redDelta, greenDelta, blueDelta);
      squaredError += redDelta ** 2 + greenDelta ** 2 + blueDelta ** 2;
      if (x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height) {
        roiSquaredError += redDelta ** 2 + greenDelta ** 2 + blueDelta ** 2;
      }
      if (delta > maximumLumaDelta) maximumLumaDelta = delta;
      if (delta <= LOCAL_MOTION.significantLumaDelta) continue;
      if (x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height) {
        roiChangedPixels += 1;
        mask[(y - region.y) * region.width + (x - region.x)] = 1;
      } else {
        outsideChangedPixels += 1;
      }
    }
  }
  let coherentRoiChangedPixels = 0;
  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      const offset = y * region.width + x;
      if (!mask[offset]) continue;
      if ((x > 0 && mask[offset - 1]) || (x + 1 < region.width && mask[offset + 1]) || (y > 0 && mask[offset - region.width]) || (y + 1 < region.height && mask[offset + region.width])) coherentRoiChangedPixels += 1;
    }
  }
  const minimumChangedPixels = Math.max(LOCAL_MOTION.minimumChangedPixels, Math.ceil(region.area * LOCAL_MOTION.minimumChangedRatio));
  const outsideAllowance = LOCAL_MOTION.maximumStableChangedPixels;
  const meanSquaredError = squaredError / (width * height * 3);
  const roiMeanSquaredError = roiSquaredError / (region.area * 3);
  return {
    roiChangedPixels,
    coherentRoiChangedPixels,
    coherentRatio: roiChangedPixels === 0 ? 0 : coherentRoiChangedPixels / roiChangedPixels,
    outsideChangedPixels,
    totalChangedPixels: roiChangedPixels + outsideChangedPixels,
    maximumLumaDelta,
    globalPsnrDb: meanSquaredError === 0 ? null : 10 * Math.log10((255 ** 2) / meanSquaredError),
    roiPsnrDb: roiMeanSquaredError === 0 ? null : 10 * Math.log10((255 ** 2) / roiMeanSquaredError),
    thresholds: {
      significantLumaDeltaExclusive: LOCAL_MOTION.significantLumaDelta,
      minimumChangedPixels,
      minimumCoherentRatio: LOCAL_MOTION.minimumCoherentRatio,
      maximumOutsideChangedPixels: outsideAllowance,
    },
  };
};

const cropRgbFrame = (frame, frameWidth, region) => {
  invariant(Buffer.isBuffer(frame) && frame.length % 3 === 0, 'DIRECTOR_AB_FREEZE_FRAME_BUFFER_INVALID');
  const cropped = Buffer.allocUnsafe(region.area * 3);
  for (let y = 0; y < region.height; y += 1) {
    const sourceStart = ((region.y + y) * frameWidth + region.x) * 3;
    frame.copy(cropped, y * region.width * 3, sourceStart, sourceStart + region.width * 3);
  }
  return cropped;
};

const psnrRgb = (left, right) => {
  invariant(Buffer.isBuffer(left) && Buffer.isBuffer(right) && left.length === right.length && left.length > 0, 'DIRECTOR_AB_FREEZE_IDENTITY_BUFFER_INVALID');
  let squaredError = 0;
  for (let index = 0; index < left.length; index += 1) squaredError += (left[index] - right[index]) ** 2;
  if (squaredError === 0) return null;
  return 10 * Math.log10((255 ** 2) / (squaredError / left.length));
};

const shiftedTransitionIdentity = ({actualBefore, actualAfter, expectedBefore, expectedAfter, width, height, shiftX, shiftY}) => {
  let dot = 0;
  let expectedEnergy = 0;
  let actualEnergy = 0;
  let expectedSignificantPixels = 0;
  let actualSignificantPixels = 0;
  let overlappingSignificantPixels = 0;
  for (let y = 0; y < height; y += 1) {
    const actualY = y + shiftY;
    if (actualY < 0 || actualY >= height) continue;
    for (let x = 0; x < width; x += 1) {
      const actualX = x + shiftX;
      if (actualX < 0 || actualX >= width) continue;
      const expectedOffset = (y * width + x) * 3;
      const actualOffset = (actualY * width + actualX) * 3;
      let expectedSignificant = false;
      let actualSignificant = false;
      for (let channel = 0; channel < 3; channel += 1) {
        const expectedDelta = expectedAfter[expectedOffset + channel] - expectedBefore[expectedOffset + channel];
        const actualDelta = actualAfter[actualOffset + channel] - actualBefore[actualOffset + channel];
        dot += expectedDelta * actualDelta;
        expectedEnergy += expectedDelta ** 2;
        actualEnergy += actualDelta ** 2;
        if (Math.abs(expectedDelta) > LOCAL_MOTION.significantLumaDelta) expectedSignificant = true;
        if (Math.abs(actualDelta) > LOCAL_MOTION.significantLumaDelta) actualSignificant = true;
      }
      if (expectedSignificant) expectedSignificantPixels += 1;
      if (actualSignificant) actualSignificantPixels += 1;
      if (expectedSignificant && actualSignificant) overlappingSignificantPixels += 1;
    }
  }
  if (expectedEnergy === 0 || actualEnergy === 0) {
    return {
      shiftX,
      shiftY,
      cosine: 0,
      gain: 0,
      residualRatio: null,
      expectedSignificantPixels,
      actualSignificantPixels,
      precision: 0,
      recall: 0,
    };
  }
  const gain = dot / expectedEnergy;
  const residualEnergy = Math.max(0, actualEnergy - (2 * gain * dot) + ((gain ** 2) * expectedEnergy));
  return {
    shiftX,
    shiftY,
    cosine: dot / Math.sqrt(expectedEnergy * actualEnergy),
    gain,
    residualRatio: Math.sqrt(residualEnergy / expectedEnergy),
    expectedSignificantPixels,
    actualSignificantPixels,
    precision: actualSignificantPixels === 0 ? 0 : overlappingSignificantPixels / actualSignificantPixels,
    recall: expectedSignificantPixels === 0 ? 0 : overlappingSignificantPixels / expectedSignificantPixels,
  };
};

export const measureBoundPoseIdentity = ({actualBefore, actualAfter, expectedBefore, expectedAfter, width, height}) => {
  invariant([actualBefore, actualAfter, expectedBefore, expectedAfter].every((buffer) => Buffer.isBuffer(buffer) && buffer.length === width * height * 3), 'DIRECTOR_AB_FREEZE_IDENTITY_BUFFER_INVALID');
  const candidates = [];
  for (let shiftY = -1; shiftY <= 1; shiftY += 1) {
    for (let shiftX = -1; shiftX <= 1; shiftX += 1) {
      candidates.push(shiftedTransitionIdentity({actualBefore, actualAfter, expectedBefore, expectedAfter, width, height, shiftX, shiftY}));
    }
  }
  return candidates.sort((left, right) => right.cosine - left.cosine)[0];
};

const bestShiftedFramePsnr = ({actual, expected, width, height}) => {
  let best = {psnrDb: -Infinity, shiftX: 0, shiftY: 0};
  for (let shiftY = -1; shiftY <= 1; shiftY += 1) {
    for (let shiftX = -1; shiftX <= 1; shiftX += 1) {
      let squaredError = 0;
      let sampleCount = 0;
      for (let y = 0; y < height; y += 1) {
        const actualY = y + shiftY;
        if (actualY < 0 || actualY >= height) continue;
        for (let x = 0; x < width; x += 1) {
          const actualX = x + shiftX;
          if (actualX < 0 || actualX >= width) continue;
          const expectedOffset = (y * width + x) * 3;
          const actualOffset = (actualY * width + actualX) * 3;
          for (let channel = 0; channel < 3; channel += 1) {
            squaredError += (actual[actualOffset + channel] - expected[expectedOffset + channel]) ** 2;
            sampleCount += 1;
          }
        }
      }
      const psnrDb = squaredError === 0 ? Infinity : 10 * Math.log10((255 ** 2) / (squaredError / sampleCount));
      if (psnrDb > best.psnrDb) best = {psnrDb, shiftX, shiftY};
    }
  }
  return {...best, psnrDb: Number.isFinite(best.psnrDb) ? best.psnrDb : null};
};

const measureBoundFrameCandidateIdentity = ({actual, candidates, expectedCandidateId, width, height}) => {
  invariant(Buffer.isBuffer(actual) && actual.length === width * height * 3, 'DIRECTOR_AB_FREEZE_IDENTITY_BUFFER_INVALID');
  invariant(Array.isArray(candidates) && candidates.length >= 2, 'DIRECTOR_AB_FREEZE_IDENTITY_CANDIDATES_INVALID');
  invariant(candidates.every((candidate) => typeof candidate.id === 'string' && Buffer.isBuffer(candidate.frame) && candidate.frame.length === actual.length), 'DIRECTOR_AB_FREEZE_IDENTITY_CANDIDATES_INVALID');
  invariant(new Set(candidates.map((candidate) => candidate.id)).size === candidates.length && candidates.some((candidate) => candidate.id === expectedCandidateId), 'DIRECTOR_AB_FREEZE_IDENTITY_CANDIDATES_INVALID');
  const mask = new Uint8Array(width * height);
  let discriminativePixels = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 3;
    let discriminative = false;
    for (let channel = 0; channel < 3; channel += 1) {
      let minimum = 255;
      let maximum = 0;
      for (const candidate of candidates) {
        const value = candidate.frame[offset + channel];
        if (value < minimum) minimum = value;
        if (value > maximum) maximum = value;
      }
      if (maximum - minimum > LOCAL_MOTION.significantLumaDelta) {
        discriminative = true;
        break;
      }
    }
    if (discriminative) {
      mask[pixel] = 1;
      discriminativePixels += 1;
    }
  }
  const candidateMetrics = candidates.map((candidate) => {
    let best = {mae: Infinity, psnrDb: -Infinity, shiftX: 0, shiftY: 0, comparedPixels: 0};
    for (let shiftY = -1; shiftY <= 1; shiftY += 1) {
      for (let shiftX = -1; shiftX <= 1; shiftX += 1) {
        let absoluteError = 0;
        let squaredError = 0;
        let sampleCount = 0;
        let comparedPixels = 0;
        for (let y = 0; y < height; y += 1) {
          const actualY = y + shiftY;
          if (actualY < 0 || actualY >= height) continue;
          for (let x = 0; x < width; x += 1) {
            if (!mask[y * width + x]) continue;
            const actualX = x + shiftX;
            if (actualX < 0 || actualX >= width) continue;
            const expectedOffset = (y * width + x) * 3;
            const actualOffset = (actualY * width + actualX) * 3;
            for (let channel = 0; channel < 3; channel += 1) {
              const delta = actual[actualOffset + channel] - candidate.frame[expectedOffset + channel];
              absoluteError += Math.abs(delta);
              squaredError += delta ** 2;
              sampleCount += 1;
            }
            comparedPixels += 1;
          }
        }
        const mae = sampleCount === 0 ? Infinity : absoluteError / sampleCount;
        const psnrDb = squaredError === 0 && sampleCount > 0 ? Infinity : sampleCount === 0 ? -Infinity : 10 * Math.log10((255 ** 2) / (squaredError / sampleCount));
        if (mae < best.mae || (mae === best.mae && psnrDb > best.psnrDb)) best = {mae, psnrDb, shiftX, shiftY, comparedPixels};
      }
    }
    return {id: candidate.id, ...best};
  }).sort((left, right) => left.mae - right.mae || left.id.localeCompare(right.id));
  const expected = candidateMetrics.find((candidate) => candidate.id === expectedCandidateId);
  const bestOther = candidateMetrics.find((candidate) => candidate.id !== expectedCandidateId);
  return {
    expectedCandidateId,
    bestCandidateId: candidateMetrics[0]?.id ?? null,
    discriminativePixels,
    expectedMae: Number.isFinite(expected?.mae) ? expected.mae : null,
    expectedPsnrDb: Number.isFinite(expected?.psnrDb) ? expected.psnrDb : null,
    candidateMaeMargin: expected && bestOther && Number.isFinite(bestOther.mae - expected.mae) ? bestOther.mae - expected.mae : null,
    expectedShiftX: expected?.shiftX ?? null,
    expectedShiftY: expected?.shiftY ?? null,
    candidateMetrics: candidateMetrics.map((candidate) => ({
      ...candidate,
      mae: Number.isFinite(candidate.mae) ? candidate.mae : null,
      psnrDb: Number.isFinite(candidate.psnrDb) ? candidate.psnrDb : null,
    })),
  };
};

const maximumHoldChangedPixelsForRegion = (region) => Math.min(
  LOCAL_MOTION.maximumHoldChangedPixels,
  Math.ceil(region.area * LOCAL_MOTION.maximumHoldChangedRatio),
);

const measureExpectedPoseFrameIdentity = ({actual, expectedIdentity, width, height}) => {
  const fullRoi = bestShiftedFramePsnr({
    actual,
    expected: expectedIdentity.expectedAfter,
    width,
    height,
  });
  const frame = measureBoundFrameCandidateIdentity({
    actual,
    candidates: expectedIdentity.candidates,
    expectedCandidateId: expectedIdentity.expectedCandidateId,
    width,
    height,
  });
  const passed = (fullRoi.psnrDb === null || fullRoi.psnrDb >= LOCAL_MOTION.minimumAuthorityAssetPsnrDb)
    && frame.discriminativePixels >= LOCAL_MOTION.minimumIdentityDiscriminativePixels
    && frame.bestCandidateId === frame.expectedCandidateId
    && frame.expectedMae !== null
    && frame.expectedMae <= LOCAL_MOTION.maximumIdentityMaskedMae
    && frame.candidateMaeMargin !== null
    && frame.candidateMaeMargin >= LOCAL_MOTION.minimumIdentityCandidateMaeMargin;
  return {fullRoi, frame, passed};
};

const eventMeasurement = ({assignment, frames, width, height, expectedIdentity}) => {
  const {event, transitionEligible, auditedHoldDestinationFrames} = assignment;
  const isAuthorityMatch = event.kind === 'authority-state';
  const expectedPoseIdentity = expectedIdentity?.kind === 'authored-pose' ? expectedIdentity : null;
  const expectedAuthorityIdentity = expectedIdentity?.kind === 'authority-state' ? expectedIdentity : null;
  let transition = null;
  let authorityPsnrPassed = null;
  let transitionPassed = null;
  let contentIdentity = null;
  let contentIdentityPassed = null;
  const poseFrameIdentities = new Map();
  const boundTargetIdentityPassed = !expectedPoseIdentity
    ? false
    : expectedPoseIdentity.pose3ToTargetAssetPsnrDb === null || expectedPoseIdentity.pose3ToTargetAssetPsnrDb >= LOCAL_MOTION.minimumPoseToAuthorityPsnrDb;
  if (transitionEligible) {
    transition = measureFreezeFrameDifference({
      before: frames.get(event.frame - 1),
      after: frames.get(event.frame),
      width,
      height,
      region: event.region,
    });
    if (expectedPoseIdentity) {
      const actualBefore = cropRgbFrame(frames.get(event.frame - 1), width, event.region);
      const actualAfter = cropRgbFrame(frames.get(event.frame), width, event.region);
      const transitionIdentity = measureBoundPoseIdentity({
        actualBefore,
        actualAfter,
        expectedBefore: expectedPoseIdentity.expectedBefore,
        expectedAfter: expectedPoseIdentity.expectedAfter,
        width: event.region.width,
        height: event.region.height,
      });
      const eventFrameIdentity = {
        frameNumber: event.frame,
        ...measureExpectedPoseFrameIdentity({
          actual: actualAfter,
          expectedIdentity: expectedPoseIdentity,
          width: event.region.width,
          height: event.region.height,
        }),
      };
      poseFrameIdentities.set(event.frame, eventFrameIdentity);
      contentIdentity = {
        transition: transitionIdentity,
        fullRoi: eventFrameIdentity.fullRoi,
        frame: eventFrameIdentity.frame,
        poseFrameSequence: [],
        pose3ToTargetAssetPsnrDb: expectedPoseIdentity.pose3ToTargetAssetPsnrDb,
        boundAssetEvidence: expectedPoseIdentity.boundAssetEvidence ?? null,
      };
      contentIdentityPassed = transitionIdentity.cosine >= LOCAL_MOTION.minimumPoseIdentityCosine
        && transitionIdentity.gain >= LOCAL_MOTION.minimumPoseIdentityGain
        && transitionIdentity.gain <= LOCAL_MOTION.maximumPoseIdentityGain
        && transitionIdentity.residualRatio !== null
        && transitionIdentity.residualRatio <= LOCAL_MOTION.maximumPoseIdentityResidualRatio
        && transitionIdentity.recall >= LOCAL_MOTION.minimumPoseIdentityRecall
        && eventFrameIdentity.passed
        && boundTargetIdentityPassed;
    } else if (expectedAuthorityIdentity) {
      const actualAuthority = cropRgbFrame(frames.get(event.frame), width, event.region);
      const frameIdentity = measureBoundFrameCandidateIdentity({
        actual: actualAuthority,
        candidates: expectedAuthorityIdentity.candidates,
        expectedCandidateId: expectedAuthorityIdentity.expectedCandidateId,
        width: event.region.width,
        height: event.region.height,
      });
      contentIdentity = {
        ...bestShiftedFramePsnr({actual: actualAuthority, expected: expectedAuthorityIdentity.expectedFrame, width: event.region.width, height: event.region.height}),
        frame: frameIdentity,
        pose3ToTargetAssetPsnrDb: expectedAuthorityIdentity.pose3ToTargetAssetPsnrDb,
        boundAssetEvidence: expectedAuthorityIdentity.boundAssetEvidence ?? null,
      };
      contentIdentityPassed = (contentIdentity.psnrDb === null || contentIdentity.psnrDb >= LOCAL_MOTION.minimumAuthorityAssetPsnrDb)
        && frameIdentity.discriminativePixels >= LOCAL_MOTION.minimumIdentityDiscriminativePixels
        && frameIdentity.bestCandidateId === frameIdentity.expectedCandidateId
        && frameIdentity.expectedMae !== null
        && frameIdentity.expectedMae <= LOCAL_MOTION.maximumIdentityMaskedMae
        && frameIdentity.candidateMaeMargin !== null
        && frameIdentity.candidateMaeMargin >= LOCAL_MOTION.minimumIdentityCandidateMaeMargin
        && (contentIdentity.pose3ToTargetAssetPsnrDb === null || contentIdentity.pose3ToTargetAssetPsnrDb >= LOCAL_MOTION.minimumPoseToAuthorityPsnrDb);
    }
    authorityPsnrPassed = isAuthorityMatch
      ? transition.roiPsnrDb === null || transition.roiPsnrDb >= LOCAL_MOTION.minimumPoseToAuthorityPsnrDb
      : null;
    transitionPassed = isAuthorityMatch
      ? transition.roiChangedPixels <= LOCAL_MOTION.maximumStableChangedPixels && transition.outsideChangedPixels <= transition.thresholds.maximumOutsideChangedPixels && authorityPsnrPassed && contentIdentityPassed === true
      : transition.roiChangedPixels >= transition.thresholds.minimumChangedPixels && transition.coherentRoiChangedPixels >= transition.thresholds.minimumChangedPixels && transition.coherentRatio >= transition.thresholds.minimumCoherentRatio && transition.outsideChangedPixels <= transition.thresholds.maximumOutsideChangedPixels && contentIdentityPassed === true;
  }
  if (expectedPoseIdentity) {
    for (const destinationFrame of auditedHoldDestinationFrames) {
      if (poseFrameIdentities.has(destinationFrame)) continue;
      poseFrameIdentities.set(destinationFrame, {
        frameNumber: destinationFrame,
        ...measureExpectedPoseFrameIdentity({
          actual: cropRgbFrame(frames.get(destinationFrame), width, event.region),
          expectedIdentity: expectedPoseIdentity,
          width: event.region.width,
          height: event.region.height,
        }),
      });
    }
    if (!contentIdentity) {
      contentIdentity = {
        transition: null,
        fullRoi: null,
        frame: null,
        poseFrameSequence: [],
        pose3ToTargetAssetPsnrDb: expectedPoseIdentity.pose3ToTargetAssetPsnrDb,
        boundAssetEvidence: expectedPoseIdentity.boundAssetEvidence ?? null,
      };
    }
    contentIdentity.poseFrameSequence = [...poseFrameIdentities.values()].sort((left, right) => left.frameNumber - right.frameNumber);
  }
  const holds = event.kind === 'authored-pose' ? auditedHoldDestinationFrames.map((destinationFrame) => {
    const measurement = measureFreezeFrameDifference({
      before: frames.get(destinationFrame - 1),
      after: frames.get(destinationFrame),
      width,
      height,
      region: event.region,
    });
    const maximumHoldChangedPixels = maximumHoldChangedPixelsForRegion(event.region);
    const toFrameContentIdentity = poseFrameIdentities.get(destinationFrame);
    const motionPassed = measurement.roiChangedPixels <= maximumHoldChangedPixels && measurement.outsideChangedPixels <= LOCAL_MOTION.maximumStableChangedPixels;
    const holdContentIdentityPassed = toFrameContentIdentity?.passed === true && boundTargetIdentityPassed;
    return {
      fromFrame: destinationFrame - 1,
      toFrame: destinationFrame,
      roiChangedPixels: measurement.roiChangedPixels,
      outsideChangedPixels: measurement.outsideChangedPixels,
      totalChangedPixels: measurement.totalChangedPixels,
      maximumHoldChangedPixels,
      maximumHoldChangedPixelsFormula: `min(${LOCAL_MOTION.maximumHoldChangedPixels},ceil(region.area*${LOCAL_MOTION.maximumHoldChangedRatio}))`,
      maximumOutsideChangedPixels: LOCAL_MOTION.maximumStableChangedPixels,
      toFrameContentIdentity,
      motionPassed,
      contentIdentityPassed: holdContentIdentityPassed,
      passed: motionPassed && holdContentIdentityPassed,
    };
  }) : [];
  const failureCodes = [];
  if (transitionEligible && isAuthorityMatch) {
    if (transition.roiChangedPixels > LOCAL_MOTION.maximumStableChangedPixels) failureCodes.push('pose3-to-authority-not-stable');
    if (transition.outsideChangedPixels > transition.thresholds.maximumOutsideChangedPixels) failureCodes.push('change-outside-declared-roi');
    if (!authorityPsnrPassed) failureCodes.push('pose3-to-authority-psnr-too-low');
    if (!expectedAuthorityIdentity) failureCodes.push('bound-asset-content-evidence-missing');
    else if (!contentIdentityPassed) failureCodes.push('authority-asset-identity-mismatch');
  } else if (transitionEligible) {
    if (transition.roiChangedPixels < transition.thresholds.minimumChangedPixels) failureCodes.push('planned-roi-change-missing');
    if (transition.coherentRoiChangedPixels < transition.thresholds.minimumChangedPixels || transition.coherentRatio < transition.thresholds.minimumCoherentRatio) failureCodes.push('random-or-incoherent-micro-change');
    if (transition.outsideChangedPixels > transition.thresholds.maximumOutsideChangedPixels) failureCodes.push('change-outside-declared-roi');
    if (!expectedPoseIdentity) failureCodes.push('bound-asset-content-evidence-missing');
    else if (!contentIdentityPassed) {
      failureCodes.push('pose-asset-identity-mismatch');
      if (!boundTargetIdentityPassed) failureCodes.push('authority-asset-identity-mismatch');
    }
  } else if (holds.length > 0 && !expectedPoseIdentity) {
    failureCodes.push('bound-asset-content-evidence-missing');
  }
  if (holds.some((hold) => !hold.motionPassed)) failureCodes.push('pose-hold-timing-drift');
  if (holds.some((hold) => hold.outsideChangedPixels > hold.maximumOutsideChangedPixels)) failureCodes.push('pose-hold-outside-declared-roi');
  if (holds.some((hold) => !hold.contentIdentityPassed)) failureCodes.push('pose-hold-asset-identity-mismatch');
  return {
    eventId: event.id,
    stateId: event.stateId,
    assetId: event.assetId,
    kind: event.kind,
    poseIndex: event.poseIndex,
    eventFrame: event.frame,
    region: event.region,
    transitionEligible,
    auditedHoldDestinationFrames,
    transition,
    transitionPassed,
    contentIdentity,
    contentIdentityThresholds: isAuthorityMatch ? {
      minimumActualAuthorityPsnrDb: LOCAL_MOTION.minimumAuthorityAssetPsnrDb,
      minimumPose3ToTargetAssetPsnrDb: LOCAL_MOTION.minimumPoseToAuthorityPsnrDb,
      minimumDiscriminativePixels: LOCAL_MOTION.minimumIdentityDiscriminativePixels,
      maximumMaskedMae: LOCAL_MOTION.maximumIdentityMaskedMae,
      minimumCandidateMaeMargin: LOCAL_MOTION.minimumIdentityCandidateMaeMargin,
      maximumShiftPixels: 1,
    } : {
      minimumCosine: LOCAL_MOTION.minimumPoseIdentityCosine,
      minimumGain: LOCAL_MOTION.minimumPoseIdentityGain,
      maximumGain: LOCAL_MOTION.maximumPoseIdentityGain,
      maximumResidualRatio: LOCAL_MOTION.maximumPoseIdentityResidualRatio,
      minimumRecall: LOCAL_MOTION.minimumPoseIdentityRecall,
      minimumActualPosePsnrDb: LOCAL_MOTION.minimumAuthorityAssetPsnrDb,
      minimumDiscriminativePixels: LOCAL_MOTION.minimumIdentityDiscriminativePixels,
      maximumMaskedMae: LOCAL_MOTION.maximumIdentityMaskedMae,
      minimumCandidateMaeMargin: LOCAL_MOTION.minimumIdentityCandidateMaeMargin,
      minimumPose3ToTargetAssetPsnrDb: LOCAL_MOTION.minimumPoseToAuthorityPsnrDb,
      maximumShiftPixels: 1,
    },
    authorityMatchThresholds: isAuthorityMatch ? {
      maximumChangedPixels: LOCAL_MOTION.maximumStableChangedPixels,
      minimumPsnrDb: LOCAL_MOTION.minimumPoseToAuthorityPsnrDb,
    } : null,
    holds,
    passed: (transitionEligible ? transitionPassed === true : true) && holds.every((hold) => hold.passed),
    failureCodes,
  };
};

const createEventEvidenceStore = (work) => work.segments.map((_segment, segmentIndex) => ({
  assignments: work.assignments.filter((assignment) => assignment.segmentIndex === segmentIndex),
  evidenceByEventId: new Map(),
}));

const missingFrameEvidence = (assignment) => ({
  eventId: assignment.event.id,
  stateId: assignment.event.stateId,
  assetId: assignment.event.assetId,
  kind: assignment.event.kind,
  poseIndex: assignment.event.poseIndex,
  eventFrame: assignment.event.frame,
  region: assignment.event.region,
  transitionEligible: assignment.transitionEligible,
  auditedHoldDestinationFrames: assignment.auditedHoldDestinationFrames,
  transition: null,
  transitionPassed: null,
  contentIdentity: null,
  holds: [],
  passed: false,
  failureCodes: ['event-frame-evidence-missing'],
});

export const finalizeFreezeClassification = ({segments, contract, eventEvidenceBySegment}) => {
  invariant(Array.isArray(segments) && Array.isArray(eventEvidenceBySegment) && segments.length === eventEvidenceBySegment.length, 'DIRECTOR_AB_FREEZE_FINALIZE_INPUT_INVALID');
  const classifiedHits = segments.map((segment, segmentIndex) => {
    const scene = contract.scenes.find((candidate) => candidate.id === segment.sceneId);
    if (!scene || !segment.eligiblePlanSegment) {
      return {...segment, classification: 'unexplained', actualMaximumGapFrames: null, eventEvidence: [], failureCodes: ['scene-or-state-reveal-not-eligible']};
    }
    const store = eventEvidenceBySegment[segmentIndex];
    invariant(store && Array.isArray(store.assignments) && store.evidenceByEventId instanceof Map, 'DIRECTOR_AB_FREEZE_FINALIZE_STORE_INVALID', segmentIndex);
    if (store.assignments.length === 0) {
      return {...segment, classification: 'unexplained', actualMaximumGapFrames: null, eventEvidence: [], failureCodes: ['no-planned-local-motion-event']};
    }
    const evidence = store.assignments.map((assignment) => store.evidenceByEventId.get(assignment.event.id) ?? missingFrameEvidence(assignment));
    const passingFrames = evidence
      .filter((item) => item.passed && item.kind === 'authored-pose' && item.transitionEligible && item.transitionPassed)
      .map((item) => item.eventFrame)
      .sort((a, b) => a - b);
    const segmentStartFrame = Math.ceil(segment.start * contract.fps - 1e-9);
    const segmentEndFrame = Math.floor(segment.end * contract.fps + 1e-9);
    const gapPoints = [segmentStartFrame, ...passingFrames, segmentEndFrame];
    const actualMaximumGapFrames = Math.max(...gapPoints.slice(1).map((frame, index) => frame - gapPoints[index]));
    const failureCodes = [...new Set(evidence.flatMap((item) => item.failureCodes))];
    if (passingFrames.length === 0) failureCodes.push('no-verified-authored-pose-event');
    if (actualMaximumGapFrames > scene.maximumUnchangedFrames) failureCodes.push('actual-maximum-gap-exceeds-plan');
    return {
      ...segment,
      classification: failureCodes.length === 0 ? 'explained-planned-local-stop-motion' : 'unexplained',
      plannedMaximumGapFrames: scene.maximumUnchangedFrames,
      actualMaximumGapFrames,
      eventEvidence: evidence,
      failureCodes: [...new Set(failureCodes)],
    };
  });
  const failed = classifiedHits.filter((hit) => hit.classification === 'unexplained');
  return {
    classifiedHits,
    gateSummary: {
      passed: failed.length === 0,
      rawHitCount: new Set(segments.map((segment) => segment.rawHitIndex)).size,
      classifiedHitCount: classifiedHits.length,
      explainedHitCount: classifiedHits.length - failed.length,
      unexplainedHitCount: failed.length,
      failureCodes: [...new Set(failed.flatMap((hit) => hit.failureCodes))],
    },
  };
};

export const classifyFreezeHits = ({rawHits, contract, framesByNumber = new Map(), expectedIdentitiesByEvent = new Map()}) => {
  const work = planFreezeEvidenceWork({rawHits, contract});
  const eventEvidenceBySegment = createEventEvidenceStore(work);
  for (const assignment of work.assignments) {
    const evidence = assignment.requiredFrames.some((frame) => !framesByNumber.has(frame))
      ? missingFrameEvidence(assignment)
      : eventMeasurement({
        assignment,
        frames: framesByNumber,
        width: contract.width,
        height: contract.height,
        expectedIdentity: expectedIdentitiesByEvent.get(assignment.event.id),
      });
    eventEvidenceBySegment[assignment.segmentIndex].evidenceByEventId.set(assignment.event.id, evidence);
  }
  return finalizeFreezeClassification({segments: work.segments, contract, eventEvidenceBySegment});
};

export const executeFreezeEvidenceWork = ({
  work,
  contract,
  decodeFramesForJob,
  buildExpectedIdentitiesForJob,
}) => {
  invariant(isRecord(work) && Array.isArray(work.jobs) && typeof decodeFramesForJob === 'function' && typeof buildExpectedIdentitiesForJob === 'function', 'DIRECTOR_AB_FREEZE_STREAM_INPUT_INVALID');
  const eventEvidenceBySegment = createEventEvidenceStore(work);
  const maximumFramesPerStateJob = work.resourceBounds?.maxFramesPerStateJob ?? 11;
  const decodedFullFrameRgbBytesPerFrame = Number(contract.width) * Number(contract.height) * 3;
  const maximumPlanRegionAreaPixels = work.resourceBounds?.maximumPlanRegionAreaPixels
    ?? Math.max(0, ...contract.scenes.flatMap((scene) => scene.events ?? []).map((event) => Number(event.region?.area ?? 0)));
  const maximumRetainedDecodedFullFrameRgbBytes = work.resourceBounds?.maximumRetainedDecodedFullFrameRgbBytes
    ?? maximumFramesPerStateJob * decodedFullFrameRgbBytesPerFrame;
  const maximumPerStateRoiWorkingBufferBytes = work.resourceBounds?.maximumPerStateRoiWorkingBufferBytes
    ?? 28 * maximumPlanRegionAreaPixels;
  const diagnostics = {
    jobCount: work.jobs.length,
    completedJobCount: 0,
    totalDecodedRgbFrames: 0,
    peakRetainedRgbFrames: 0,
    maximumFramesPerStateJob,
    maximumRetainedDecodedFullFrameRgbBytes,
    maximumPlanRegionAreaPixels,
    maximumPerStateRoiWorkingBufferBytes,
    maximumPerStateRoiWorkingBufferBytesFormula: work.resourceBounds?.maximumPerStateRoiWorkingBufferBytesFormula ?? '28*maximumPlanRegionAreaPixels',
    maximumTheoreticalApplicationBufferBytes: work.resourceBounds?.maximumTheoreticalApplicationBufferBytes ?? maximumRetainedDecodedFullFrameRgbBytes + maximumPerStateRoiWorkingBufferBytes,
    maximumTheoreticalApplicationBufferBytesFormula: work.resourceBounds?.maximumTheoreticalApplicationBufferBytesFormula ?? 'maximumRetainedDecodedFullFrameRgbBytes+(28*maximumPlanRegionAreaPixels)',
    maximumTheoreticalApplicationBufferBytesScope: work.resourceBounds?.maximumTheoreticalApplicationBufferBytesScope ?? 'node-buffer-payloads-retained-by-one-state-evidence-job;excludes-v8-object-overhead-and-ffmpeg-subprocess-memory',
    jobBoundaryRetainedRgbFrames: [],
    assetDecodeCountsByJob: [],
  };
  try {
    for (const job of work.jobs) {
      let frames = null;
      let expectedIdentities = null;
      try {
        frames = decodeFramesForJob(job);
        const returnedFrames = frames instanceof Map ? [...frames.keys()].sort((left, right) => left - right) : [];
        invariant(
          frames instanceof Map
            && stableStringify(returnedFrames) === stableStringify(job.requiredFrames)
            && frames.size <= diagnostics.maximumFramesPerStateJob
            && [...frames.values()].every((frame) => Buffer.isBuffer(frame) && frame.length === Number(contract.width) * Number(contract.height) * 3),
          'DIRECTOR_AB_FREEZE_STREAM_FRAME_SET_INVALID',
          job.id,
        );
        diagnostics.totalDecodedRgbFrames += frames.size;
        diagnostics.peakRetainedRgbFrames = Math.max(diagnostics.peakRetainedRgbFrames, frames.size);
        const built = buildExpectedIdentitiesForJob(job);
        expectedIdentities = built instanceof Map ? built : built?.identities;
        invariant(expectedIdentities instanceof Map, 'DIRECTOR_AB_FREEZE_STREAM_IDENTITY_SET_INVALID', job.id);
        diagnostics.assetDecodeCountsByJob.push({jobId: job.id, ...(built?.assetDecodeCounts ?? {})});
        for (const assignment of job.assignments) {
          const evidence = eventMeasurement({
            assignment,
            frames,
            width: contract.width,
            height: contract.height,
            expectedIdentity: expectedIdentities.get(assignment.event.id),
          });
          eventEvidenceBySegment[assignment.segmentIndex].evidenceByEventId.set(assignment.event.id, evidence);
        }
        diagnostics.completedJobCount += 1;
      } finally {
        if (frames instanceof Map) frames.clear();
        if (expectedIdentities instanceof Map) expectedIdentities.clear();
        diagnostics.jobBoundaryRetainedRgbFrames.push(frames instanceof Map ? frames.size : 0);
      }
    }
  } catch (error) {
    error.freezeEvidenceStreamingDiagnostics = structuredClone(diagnostics);
    throw error;
  }
  return {eventEvidenceBySegment, diagnostics};
};

const decodeBoundImage = (ffmpeg, filePath, {pixelFormat, width, height, region}) => {
  const filters = [`format=${pixelFormat}`];
  if (region) filters.push(`crop=${region.width}:${region.height}:${region.x}:${region.y}`);
  const result = run(ffmpeg, [
    '-nostdin', '-hide_banner', '-v', 'error',
    '-i', filePath,
    '-frames:v', '1',
    '-vf', filters.join(','),
    '-pix_fmt', pixelFormat,
    '-f', 'rawvideo',
    'pipe:1',
  ], {captureStdout: true});
  const bytesPerPixel = pixelFormat === 'rgba' ? 4 : 3;
  invariant(result.stdout.length === width * height * bytesPerPixel, 'DIRECTOR_AB_FREEZE_BOUND_ASSET_DECODE_LENGTH_INVALID', `${filePath}:${result.stdout.length}/${width * height * bytesPerPixel}`);
  return result.stdout;
};

const alphaCompositePose = (baseRgb, poseRgba) => {
  invariant(Buffer.isBuffer(baseRgb) && Buffer.isBuffer(poseRgba) && poseRgba.length / 4 === baseRgb.length / 3, 'DIRECTOR_AB_FREEZE_BOUND_ASSET_COMPOSITE_INVALID');
  const composite = Buffer.allocUnsafe(baseRgb.length);
  for (let rgbOffset = 0, rgbaOffset = 0; rgbOffset < baseRgb.length; rgbOffset += 3, rgbaOffset += 4) {
    const alpha = poseRgba[rgbaOffset + 3] / 255;
    for (let channel = 0; channel < 3; channel += 1) {
      composite[rgbOffset + channel] = Math.round(poseRgba[rgbaOffset + channel] * alpha + baseRgb[rgbOffset + channel] * (1 - alpha));
    }
  }
  return composite;
};

export const buildExpectedIdentitiesForFreezeJob = ({contract, job, decodeBoundAsset}) => {
  invariant(typeof decodeBoundAsset === 'function' && Array.isArray(job?.assignments) && job.assignments.length > 0, 'DIRECTOR_AB_FREEZE_BOUND_JOB_INVALID', job?.id);
  const assetById = new Map(contract.boundAssets.map((asset) => [asset.id, asset]));
  const scene = contract.scenes.find((candidate) => candidate.id === job.sceneId);
  invariant(scene, 'DIRECTOR_AB_FREEZE_BOUND_EVENT_SET_INVALID', job.id);
  const stateEvents = scene.events.filter((event) => event.stateId === job.stateId);
  const poseEvents = stateEvents.filter((event) => event.kind === 'authored-pose').sort((left, right) => left.poseIndex - right.poseIndex);
  const authorityEvent = stateEvents.find((event) => event.kind === 'authority-state');
  invariant(poseEvents.length === LOCAL_MOTION.poseCount && authorityEvent, 'DIRECTOR_AB_FREEZE_BOUND_EVENT_SET_INVALID', job.id);
  const region = authorityEvent.region;
  const baseAsset = assetById.get(authorityEvent.baseAssetId);
  const targetAsset = assetById.get(authorityEvent.targetAssetId);
  invariant(baseAsset && targetAsset, 'DIRECTOR_AB_FREEZE_BOUND_STATE_ASSET_MISSING', job.id);
  const assetDecodeCounts = {base: 0, target: 0, poses: 0, total: 0};
  const decode = (kind, asset, options) => {
    const buffer = decodeBoundAsset({kind, asset, ...options});
    invariant(Buffer.isBuffer(buffer), 'DIRECTOR_AB_FREEZE_BOUND_ASSET_DECODE_INVALID', `${job.id}:${asset.id}`);
    assetDecodeCounts[kind === 'pose' ? 'poses' : kind] += 1;
    assetDecodeCounts.total += 1;
    return buffer;
  };
  const baseRgb = decode('base', baseAsset, {
    pixelFormat: 'rgb24',
    width: region.width,
    height: region.height,
    region,
  });
  const targetRgb = decode('target', targetAsset, {
    pixelFormat: 'rgb24',
    width: region.width,
    height: region.height,
    region,
  });
  const composites = poseEvents.map((event) => {
    const poseAsset = assetById.get(event.assetId);
    invariant(poseAsset?.role === 'motion-pose', 'DIRECTOR_AB_FREEZE_BOUND_POSE_ASSET_MISSING', event.assetId);
    const poseRgba = decode('pose', poseAsset, {
      pixelFormat: 'rgba',
      width: region.width,
      height: region.height,
      region: null,
    });
    return alphaCompositePose(baseRgb, poseRgba);
  });
  const pose3ToTargetAssetPsnrDb = psnrRgb(composites[2], targetRgb);
  const boundAssetEvidence = {
    base: {id: baseAsset.id, sha256: baseAsset.sha256},
    poses: poseEvents.map((event) => {
      const asset = assetById.get(event.assetId);
      return {id: asset.id, sha256: asset.sha256};
    }),
    target: {id: targetAsset.id, sha256: targetAsset.sha256},
  };
  const poseCandidates = [
    {id: baseAsset.id, frame: baseRgb},
    ...poseEvents.map((event, index) => ({id: event.assetId, frame: composites[index]})),
  ];
  const identities = new Map();
  poseEvents.forEach((event, index) => identities.set(event.id, {
    kind: 'authored-pose',
    expectedBefore: index === 0 ? baseRgb : composites[index - 1],
    expectedAfter: composites[index],
    candidates: poseCandidates,
    expectedCandidateId: event.assetId,
    pose3ToTargetAssetPsnrDb,
    boundAssetEvidence,
  }));
  identities.set(authorityEvent.id, {
    kind: 'authority-state',
    expectedFrame: targetRgb,
    candidates: [
      {id: baseAsset.id, frame: baseRgb},
      ...poseEvents.slice(0, -1).map((event, index) => ({id: event.assetId, frame: composites[index]})),
      {id: targetAsset.id, frame: targetRgb},
    ],
    expectedCandidateId: targetAsset.id,
    pose3ToTargetAssetPsnrDb,
    boundAssetEvidence,
  });
  return {identities, assetDecodeCounts};
};

export const scanVideo = (ffmpeg, filePath, freezeClassification) => {
  const scan = (filter) => run(ffmpeg, [
    '-nostdin', '-hide_banner', '-v', 'info',
    '-i', filePath,
    '-map', '0:v:0', '-an',
    '-vf', filter,
    '-f', 'null', '-',
  ], {allowFailure: true});
  const blackResult = scan('blackdetect=d=0.1:pic_th=0.98:pix_th=0.10');
  const whiteResult = scan('negate,blackdetect=d=0.1:pic_th=0.98:pix_th=0.10');
  const freezeResult = scan(FREEZE_DETECTOR.ffmpegFilter);
  invariant(blackResult.status === 0 && whiteResult.status === 0 && freezeResult.status === 0, 'DIRECTOR_AB_VIDEO_SCAN_FAILED');
  const stderr = (result) => String(result.stderr ?? '');
  const blackHits = [...stderr(blackResult).matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map((match) => ({start: Number(match[1]), end: Number(match[2]), duration: Number(match[3])}));
  const whiteHits = [...stderr(whiteResult).matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map((match) => ({start: Number(match[1]), end: Number(match[2]), duration: Number(match[3])}));
  const rawHits = parseFreezeDetectLog(stderr(freezeResult), {durationSeconds: freezeClassification.durationSeconds});
  invariant(blackHits.length === 0, 'DIRECTOR_AB_BLACK_FRAME_GATE_FAILED', blackHits.length);
  invariant(whiteHits.length === 0, 'DIRECTOR_AB_WHITE_FRAME_GATE_FAILED', whiteHits.length);
  const work = planFreezeEvidenceWork({rawHits, contract: freezeClassification});
  const streamed = executeFreezeEvidenceWork({
    work,
    contract: freezeClassification,
    decodeFramesForJob: (job) => decodeSelectedRgbFrames(ffmpeg, filePath, job.requiredFrames, freezeClassification.width, freezeClassification.height),
    buildExpectedIdentitiesForJob: (job) => buildExpectedIdentitiesForFreezeJob({
      contract: freezeClassification,
      job,
      decodeBoundAsset: ({asset, pixelFormat, width, height, region}) => decodeBoundImage(ffmpeg, asset.sourcePath, {pixelFormat, width, height, region}),
    }),
  });
  const classified = finalizeFreezeClassification({segments: work.segments, contract: freezeClassification, eventEvidenceBySegment: streamed.eventEvidenceBySegment});
  const {classifiedHits, gateSummary} = classified;
  const holdEvidence = classifiedHits.flatMap((hit) => hit.eventEvidence.flatMap((event) => event.holds ?? []));
  const poseIdentityEvidence = classifiedHits.flatMap((hit) => hit.eventEvidence.filter((event) => event.kind === 'authored-pose' && event.contentIdentity?.transition));
  const authorityIdentityEvidence = classifiedHits.flatMap((hit) => hit.eventEvidence.filter((event) => event.kind === 'authority-state' && event.contentIdentity));
  const observedMinimum = (values) => {
    const finiteValues = values.filter(Number.isFinite);
    return finiteValues.length === 0 ? null : Math.min(...finiteValues);
  };
  const observedMaximum = (values) => {
    const finiteValues = values.filter(Number.isFinite);
    return finiteValues.length === 0 ? null : Math.max(...finiteValues);
  };
  return {
    schema: FREEZE_QA_SCHEMA,
    detector: {
      ...FREEZE_DETECTOR,
      stderrSha256: sha256Text(stderr(freezeResult)),
      stderrSha256Scope: 'single-scan-run-only-not-cross-run-stable',
      rawHitSequenceSha256: sha256Text(stableStringify(rawHits)),
      rawHitSequenceSha256Scope: 'canonical-structured-hit-sequence-cross-run-anchor',
    },
    holdNoiseCalibration: {
      scope: 'pose-hold-only-not-pose-transition-or-authority',
      observedHoldMeasurementCount: holdEvidence.length,
      observedMaximumChangedPixelsInDeclaredRoi: Math.max(0, ...holdEvidence.map((hold) => hold.roiChangedPixels)),
      observedMaximumChangedPixelsOutsideDeclaredRoi: Math.max(0, ...holdEvidence.map((hold) => hold.outsideChangedPixels)),
      holdChangedPixelThreshold: {
        formula: `min(${LOCAL_MOTION.maximumHoldChangedPixels},ceil(region.area*${LOCAL_MOTION.maximumHoldChangedRatio}))`,
        absoluteCapPixels: LOCAL_MOTION.maximumHoldChangedPixels,
        regionAreaRatio: LOCAL_MOTION.maximumHoldChangedRatio,
        observedMinimumAppliedPixels: observedMinimum(holdEvidence.map((hold) => hold.maximumHoldChangedPixels)),
        observedMaximumAppliedPixels: observedMaximum(holdEvidence.map((hold) => hold.maximumHoldChangedPixels)),
      },
      maximumOutsideChangedPixels: LOCAL_MOTION.maximumStableChangedPixels,
      poseTransitionMinimumChangedPixels: LOCAL_MOTION.minimumChangedPixels,
      authorityMaximumChangedPixels: LOCAL_MOTION.maximumStableChangedPixels,
      holdFrameAssetIdentity: {
        observedMeasurementCount: holdEvidence.filter((hold) => hold.toFrameContentIdentity).length,
        observedMinimumFullRoiPsnrDb: observedMinimum(holdEvidence.map((hold) => hold.toFrameContentIdentity?.fullRoi?.psnrDb)),
        observedMaximumMaskedMae: observedMaximum(holdEvidence.map((hold) => hold.toFrameContentIdentity?.frame?.expectedMae)),
        observedMinimumCandidateMaeMargin: observedMinimum(holdEvidence.map((hold) => hold.toFrameContentIdentity?.frame?.candidateMaeMargin)),
        failedMeasurementCount: holdEvidence.filter((hold) => hold.contentIdentityPassed === false).length,
        thresholds: {
          minimumFullRoiPsnrDb: LOCAL_MOTION.minimumAuthorityAssetPsnrDb,
          minimumDiscriminativePixels: LOCAL_MOTION.minimumIdentityDiscriminativePixels,
          maximumMaskedMae: LOCAL_MOTION.maximumIdentityMaskedMae,
          minimumCandidateMaeMargin: LOCAL_MOTION.minimumIdentityCandidateMaeMargin,
          maximumShiftPixels: 1,
        },
      },
    },
    boundAssetIdentityCalibration: {
      observedPoseEventCount: poseIdentityEvidence.length,
      observedAuthorityEventCount: authorityIdentityEvidence.length,
      observedMinimumPoseTransitionCosine: observedMinimum(poseIdentityEvidence.map((event) => event.contentIdentity.transition.cosine)),
      observedMaximumPoseTransitionResidualRatio: observedMaximum(poseIdentityEvidence.map((event) => event.contentIdentity.transition.residualRatio)),
      observedMaximumPoseMaskedMae: observedMaximum(poseIdentityEvidence.map((event) => event.contentIdentity.frame.expectedMae)),
      observedMinimumPoseCandidateMaeMargin: observedMinimum(poseIdentityEvidence.map((event) => event.contentIdentity.frame.candidateMaeMargin)),
      observedMaximumAuthorityMaskedMae: observedMaximum(authorityIdentityEvidence.map((event) => event.contentIdentity.frame.expectedMae)),
      observedMinimumAuthorityCandidateMaeMargin: observedMinimum(authorityIdentityEvidence.map((event) => event.contentIdentity.frame.candidateMaeMargin)),
      thresholds: {
        minimumPoseTransitionCosine: LOCAL_MOTION.minimumPoseIdentityCosine,
        maximumPoseTransitionResidualRatio: LOCAL_MOTION.maximumPoseIdentityResidualRatio,
        minimumFullRoiPsnrDb: LOCAL_MOTION.minimumAuthorityAssetPsnrDb,
        minimumDiscriminativePixels: LOCAL_MOTION.minimumIdentityDiscriminativePixels,
        maximumMaskedMae: LOCAL_MOTION.maximumIdentityMaskedMae,
        minimumCandidateMaeMargin: LOCAL_MOTION.minimumIdentityCandidateMaeMargin,
        maximumShiftPixels: 1,
      },
    },
    blackHits,
    whiteHits,
    rawHits,
    classifiedHits,
    gateSummary,
    freezeStarts: rawHits.map((hit) => hit.start),
    freezeDurations: rawHits.map((hit) => hit.duration),
    thresholdSeconds: EXACT.freezeSeconds,
  };
};

export const compareAbFrames = (ffmpeg, withSfxPath, noSfxPath) => {
  const withFrames = frameMd5(ffmpeg, withSfxPath);
  const noFrames = frameMd5(ffmpeg, noSfxPath);
  let same = 0;
  let different = 0;
  for (let index = 0; index < EXACT.frames; index += 1) {
    if (withFrames.hashes[index] === noFrames.hashes[index]) same += 1;
    else different += 1;
  }
  return {
    same,
    different,
    total: EXACT.frames,
    withManifestSha256: withFrames.manifestSha256,
    noManifestSha256: noFrames.manifestSha256,
  };
};

const historicalV5Regression = (ffmpeg, withPath, noPath) => {
  if (!withPath && !noPath) return null;
  invariant(withPath && noPath, 'DIRECTOR_AB_V5_NEGATIVE_PAIR_INCOMPLETE');
  requireAbsoluteRegularFile(withPath, 'DIRECTOR_AB_V5_WITH_INVALID');
  requireAbsoluteRegularFile(noPath, 'DIRECTOR_AB_V5_NO_INVALID');
  const result = compareAbFrames(ffmpeg, withPath, noPath);
  invariant(result.same === 405 && result.different === 495, 'DIRECTOR_AB_V5_NEGATIVE_EXPECTATION_DRIFT', `${result.same}:${result.different}`);
  return {
    status: 'expected-no-go-confirmed',
    withSfx: {path: withPath, sha256: sha256File(withPath)},
    noSfx: {path: noPath, sha256: sha256File(noPath)},
    frameComparison: result,
  };
};

const currentControlPlaneSnapshot = (planInfo) => {
  const authoritativeValidation = planInfo.integrity.authoritativeValidation;
  return {
    request: {
      path: authoritativeValidation.requestPath,
      sha256: authoritativeValidation.requestFileSha256,
    },
    authoritativeValidator: {
      path: authoritativePlanValidatorPath,
      sha256: authoritativeValidation.validatorSha256 ?? sha256File(authoritativePlanValidatorPath),
    },
    nodeBinary: {
      path: realpathSync(process.execPath),
      sha256: sha256File(realpathSync(process.execPath)),
    },
    packager: {
      path: realpathSync(scriptPath),
      sha256: sha256File(realpathSync(scriptPath)),
    },
  };
};

const revalidateSnapshotFile = ({path: filePath, sha256}, code, label) => {
  invariant(
    typeof filePath === 'string' && path.isAbsolute(filePath) && existsSync(filePath),
    code,
    `${label}:missing`,
  );
  invariant(SHA256_RE.test(sha256), code, `${label}:expected-sha-invalid`);
  const actualSha256 = sha256File(filePath);
  invariant(actualSha256 === sha256, code, `${label}:${sha256}:${actualSha256}`);
  return {path: filePath, sha256: actualSha256};
};

export const revalidateDirectorInputSnapshot = ({
  planPath,
  visualMasterPath,
  initialInputSha256,
  planInfo,
  ffmpeg,
  ffprobe,
  controlPlaneSnapshot,
}) => {
  invariant(sha256File(planPath) === initialInputSha256.plan, 'DIRECTOR_AB_INPUT_CHANGED_DURING_QA', 'plan');
  invariant(sha256File(visualMasterPath) === initialInputSha256.visualMaster, 'DIRECTOR_AB_INPUT_CHANGED_DURING_QA', 'visual-master');
  invariant(sha256File(planInfo.spoken.path) === planInfo.spoken.sha256, 'DIRECTOR_AB_INPUT_CHANGED_DURING_QA', 'spoken');
  for (const file of planInfo.sfx) {
    invariant(sha256File(file.path) === file.sha256, 'DIRECTOR_AB_INPUT_CHANGED_DURING_QA', `sfx:${file.id}`);
  }
  invariant(sha256File(ffmpeg.realPath) === ffmpeg.sha256, 'DIRECTOR_AB_INPUT_CHANGED_DURING_QA', 'ffmpeg');
  invariant(sha256File(ffprobe.realPath) === ffprobe.sha256, 'DIRECTOR_AB_INPUT_CHANGED_DURING_QA', 'ffprobe');

  const bindings = planInfo.integrity.fileBindings;
  invariant(Array.isArray(bindings) && bindings.length > 0, 'DIRECTOR_AB_BOUND_INPUT_SNAPSHOT_MISSING');
  const revalidatedBindings = bindings.map((binding) => ({
    role: binding.role,
    id: binding.id,
    ...revalidateSnapshotFile(
      binding,
      'DIRECTOR_AB_BOUND_INPUT_CHANGED_DURING_QA',
      `${binding.role}:${binding.id}`,
    ),
  }));
  const revalidatedControlPlane = Object.fromEntries(
    Object.entries(controlPlaneSnapshot).map(([label, snapshot]) => [
      label,
      revalidateSnapshotFile(
        snapshot,
        'DIRECTOR_AB_CONTROL_PLANE_CHANGED_DURING_QA',
        label,
      ),
    ]),
  );
  return {
    planSha256: initialInputSha256.plan,
    visualMasterSha256: initialInputSha256.visualMaster,
    spokenSha256: planInfo.spoken.sha256,
    sfxSha256: planInfo.sfx.map((file) => ({id: file.id, sha256: file.sha256})),
    toolSha256: {ffmpeg: ffmpeg.sha256, ffprobe: ffprobe.sha256},
    fileBindingCount: revalidatedBindings.length,
    fileBindings: revalidatedBindings,
    controlPlane: revalidatedControlPlane,
    passed: true,
  };
};

const publishFreezeFailureTerminal = ({
  plan,
  planPath,
  planInfo,
  visualMasterPath,
  visualMasterQa,
  outputDirectory,
  receiptPath,
  initialInputSha256,
  ffmpeg,
  ffprobe,
  controlPlaneSnapshot,
  videoScan,
}) => {
  const firstRevalidation = revalidateDirectorInputSnapshot({
    planPath,
    visualMasterPath,
    initialInputSha256,
    planInfo,
    ffmpeg,
    ffprobe,
    controlPlaneSnapshot,
  });
  const outputParent = path.dirname(outputDirectory);
  const tempDirectory = mkdtempSync(path.join(outputParent, `.${path.basename(outputDirectory)}.freeze-failed-tmp-`));
  try {
    const syntheticTestOnly = plan.schemaVersion === SYNTHETIC_PLAN_SCHEMA;
    const receipt = {
      schema: 'koubo-director-exact30-ab-package-qa/v2',
      freezePolicySchema: FREEZE_QA_SCHEMA,
      status: syntheticTestOnly
        ? 'synthetic-technical-qa-failed-freeze-gate-test-only-terminal'
        : 'technical-qa-failed-freeze-gate-terminal',
      failureCode: 'DIRECTOR_AB_FREEZE_GATE_FAILED',
      productionEligible: false,
      automationFreezeMustRemain: true,
      automationHandoffAllowed: false,
      abOutputsPublished: false,
      exactContract: EXACT,
      tools: [ffmpeg, ffprobe],
      plan: {path: planPath, sha256: initialInputSha256.plan, ...planInfo.integrity},
      inputs: {
        visualMaster: {
          path: visualMasterPath,
          planDeclaredPath: planInfo.visualMaster,
          sha256: initialInputSha256.visualMaster,
          muted: true,
        },
        spoken: {path: planInfo.spoken.path, sha256: planInfo.spoken.sha256, sourceIn: planInfo.spoken.sourceIn, sourceOut: planInfo.spoken.sourceOut},
        sfx: planInfo.sfx.map((file) => ({id: file.id, path: file.path, sha256: file.sha256, cues: file.cues})),
      },
      outputs: {},
      qa: {
        fullDecode: {visualMaster: 0},
        deliveryTimeline: {visualMaster: visualMasterQa.timeline},
        videoScan,
        inputSnapshotRevalidatedBeforePublish: {
          ...firstRevalidation,
          validationPassesRequired: 2,
          secondPassImmediatelyBeforeAtomicPublish: true,
        },
      },
      remainingGates: ['freeze-gate-remediation', 'independent-media-qa', 'normal-speed-full-watch', 'user-acceptance'],
    };
    const tempReceiptPath = path.join(tempDirectory, path.basename(receiptPath));
    writeFileSync(tempReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx'});
    revalidateDirectorInputSnapshot({
      planPath,
      visualMasterPath,
      initialInputSha256,
      planInfo,
      ffmpeg,
      ffprobe,
      controlPlaneSnapshot,
    });
    invariant(!existsSync(outputDirectory), 'DIRECTOR_AB_OUTPUT_DIRECTORY_RACE');
    renameSync(tempDirectory, outputDirectory);
    return {...receipt, receiptPath, receiptSha256: sha256File(receiptPath)};
  } catch (error) {
    if (existsSync(tempDirectory)) rmSync(tempDirectory, {recursive: true, force: true});
    throw error;
  }
};

export const packageAndQaDirectorAb = ({
  planPath,
  visualMasterPath,
  outputDirectory,
  receiptPath,
  ffmpegPath,
  ffprobePath,
  historicalV5WithPath,
  historicalV5NoPath,
  allowSyntheticFixtureForTest = false,
}) => {
  requireAbsoluteRegularFile(planPath, 'DIRECTOR_AB_PLAN_FILE_INVALID');
  requireAbsoluteRegularFile(visualMasterPath, 'DIRECTOR_AB_VISUAL_MASTER_FILE_INVALID');
  invariant(path.isAbsolute(outputDirectory), 'DIRECTOR_AB_OUTPUT_DIRECTORY_NOT_ABSOLUTE');
  invariant(!existsSync(outputDirectory), 'DIRECTOR_AB_OUTPUT_DIRECTORY_EXISTS');
  invariant(path.isAbsolute(receiptPath) && path.dirname(receiptPath) === outputDirectory, 'DIRECTOR_AB_RECEIPT_PATH_INVALID');
  const outputParent = path.dirname(outputDirectory);
  invariant(existsSync(outputParent) && lstatSync(outputParent).isDirectory() && !lstatSync(outputParent).isSymbolicLink(), 'DIRECTOR_AB_OUTPUT_PARENT_INVALID');
  const initialInputSha256 = {
    plan: sha256File(planPath),
    visualMaster: sha256File(visualMasterPath),
  };
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const planInfo = validatePlan(plan, planPath, {
    allowSyntheticFixtureForTest,
    invocation: {
      visualMasterPath,
      outputDirectory,
      receiptPath,
      ffmpegPath,
      ffprobePath,
      historicalV5WithPath,
      historicalV5NoPath,
    },
  });
  const controlPlaneSnapshot = currentControlPlaneSnapshot(planInfo);
  const ffmpeg = requireTool(ffmpegPath, 'ffmpeg');
  const ffprobe = requireTool(ffprobePath, 'ffprobe');
  const visualMasterQa = validateVisualMaster(ffprobe.realPath, visualMasterPath, planInfo.visualMaster);
  fullDecode(ffmpeg.realPath, visualMasterPath);
  const scan = scanVideo(ffmpeg.realPath, visualMasterPath, planInfo.freezeClassification);
  if (!scan.gateSummary.passed) {
    const failureReceipt = publishFreezeFailureTerminal({
      plan,
      planPath,
      planInfo,
      visualMasterPath,
      visualMasterQa,
      outputDirectory,
      receiptPath,
      initialInputSha256,
      ffmpeg,
      ffprobe,
      controlPlaneSnapshot,
      videoScan: scan,
    });
    const error = stableError('DIRECTOR_AB_FREEZE_GATE_FAILED', `${scan.gateSummary.unexplainedHitCount}:${scan.gateSummary.failureCodes.join(',')}`);
    error.receiptPath = failureReceipt.receiptPath;
    error.receiptSha256 = failureReceipt.receiptSha256;
    error.videoScan = scan;
    throw error;
  }
  const spokenSourceQa = validateSpokenSourcePreflight(ffmpeg.realPath, planInfo.spoken);
  const sfxSourceQa = validateSfxSources(ffmpeg.realPath, planInfo.sfx);
  const expectedSfx = buildExpectedSfxMix({planInfo, sfxSourceQa});

  const tempDirectory = mkdtempSync(path.join(outputParent, `.${path.basename(outputDirectory)}.tmp-`));
  try {
    const withPcm = path.join(tempDirectory, 'with-sfx-48k-stereo-1440000.pcm.wav');
    const noPcm = path.join(tempDirectory, 'no-sfx-48k-stereo-1440000.pcm.wav');
    const withAlignedAac = path.join(tempDirectory, 'with-sfx-aac-lc-aligned.m4a');
    const noAlignedAac = path.join(tempDirectory, 'no-sfx-aac-lc-aligned.m4a');
    const withDelivery = path.join(tempDirectory, 'director-30s-with-sfx.mp4');
    const noDelivery = path.join(tempDirectory, 'director-30s-no-sfx.mp4');
    const pcmArgv = generatePcmTracks({ffmpeg: ffmpeg.realPath, planInfo, withSfxPath: withPcm, noSfxPath: noPcm});
    const withPcmQa = validatePcmTrack(ffmpeg.realPath, ffprobe.realPath, withPcm);
    const noPcmQa = validatePcmTrack(ffmpeg.realPath, ffprobe.realPath, noPcm);
    const noSfxPcmSourcePreservation = validateNoSfxPcmPreservation(ffmpeg.realPath, noPcm, spokenSourceQa);
    invariant(withPcmQa.decodedPcmSha256 !== noPcmQa.decodedPcmSha256, 'DIRECTOR_AB_AUDIO_TRACKS_IDENTICAL');
    const expectedSfxPcmIdentity = validateExpectedSfxPcmIdentity({
      expectedSfx,
      withSfx: decodedFloat32(ffmpeg.realPath, withPcm),
      noSfx: decodedFloat32(ffmpeg.realPath, noPcm),
    });
    const withAacArgv = encodeAlignedAac({ffmpeg: ffmpeg.realPath, pcmPath: withPcm, outputPath: withAlignedAac});
    const noAacArgv = encodeAlignedAac({ffmpeg: ffmpeg.realPath, pcmPath: noPcm, outputPath: noAlignedAac});
    const withMuxArgv = mux({ffmpeg: ffmpeg.realPath, visualMaster: visualMasterPath, alignedAacPath: withAlignedAac, outputPath: withDelivery});
    const noMuxArgv = mux({ffmpeg: ffmpeg.realPath, visualMaster: visualMasterPath, alignedAacPath: noAlignedAac, outputPath: noDelivery});
    const withDeliveryQa = validateDelivery(ffmpeg.realPath, ffprobe.realPath, withDelivery);
    const noDeliveryQa = validateDelivery(ffmpeg.realPath, ffprobe.realPath, noDelivery);

    const h264 = {
      visualMaster: h264ElementarySha(ffmpeg.realPath, visualMasterPath),
      withSfx: h264ElementarySha(ffmpeg.realPath, withDelivery),
      noSfx: h264ElementarySha(ffmpeg.realPath, noDelivery),
    };
    invariant(new Set(Object.values(h264)).size === 1, 'DIRECTOR_AB_H264_ELEMENTARY_STREAM_MISMATCH');
    const frameComparison = compareAbFrames(ffmpeg.realPath, withDelivery, noDelivery);
    invariant(frameComparison.same === EXACT.frames && frameComparison.different === 0, 'DIRECTOR_AB_DECODED_FRAME_MISMATCH', `${frameComparison.same}:${frameComparison.different}`);
    const audioTail = {
      withSfx: decodedAudioTail(ffmpeg.realPath, withDelivery),
      noSfx: decodedAudioTail(ffmpeg.realPath, noDelivery),
    };
    const audioSimilarity = audioSimilarityQa({
      ffmpeg: ffmpeg.realPath,
      planInfo,
      spokenSourceQa,
      sfxSourceQa,
      expectedSfx,
      withDelivery,
      noDelivery,
    });
    const historical = historicalV5Regression(ffmpeg.realPath, historicalV5WithPath, historicalV5NoPath);

    const finalWithPath = path.join(outputDirectory, path.basename(withDelivery));
    const finalNoPath = path.join(outputDirectory, path.basename(noDelivery));
    const finalWithPcmPath = path.join(outputDirectory, path.basename(withPcm));
    const finalNoPcmPath = path.join(outputDirectory, path.basename(noPcm));
    const finalWithAlignedAacPath = path.join(outputDirectory, path.basename(withAlignedAac));
    const finalNoAlignedAacPath = path.join(outputDirectory, path.basename(noAlignedAac));
    const inputSnapshotRevalidatedBeforeReceipt = revalidateDirectorInputSnapshot({
      planPath,
      visualMasterPath,
      initialInputSha256,
      planInfo,
      ffmpeg,
      ffprobe,
      controlPlaneSnapshot,
    });
    const syntheticTestOnly = plan.schemaVersion === SYNTHETIC_PLAN_SCHEMA;
    const receipt = {
      schema: 'koubo-director-exact30-ab-package-qa/v2',
      freezePolicySchema: FREEZE_QA_SCHEMA,
      status: syntheticTestOnly
        ? 'synthetic-technical-qa-passed-test-only'
        : 'technical-qa-passed-awaiting-independent-and-human-review',
      productionEligible: false,
      automationFreezeMustRemain: true,
      automationHandoffAllowed: false,
      abOutputsPublished: true,
      exactContract: EXACT,
      thresholdRationale: {
        pcmIdentity: '24-bit PCM quantization is bounded by unity gain/RMS within 1e-5 and fitted residual within 2e-5; any mix routing, cue, gain, or truncation change is rejected.',
        aacIdentity: 'AAC-LC at 320 kb/s is bounded by correlation 0.995, gain/RMS within 3 percent, DC within 0.0005, and fitted residual within 8 percent; the passing synthetic measurement is recorded for audit.',
        cueAudibility: 'Each cue must be at least -45 dBFS after declared volume, retain its full decoded source, and match its contribution after subtracting every other expected cue with correlation 0.99, gain/RMS within 10 percent, and residual within 10 percent.',
        timeline: 'Container and stream start are within one 48k audio sample or one video time-base tick; AAC priming is accepted only when first packet PTS plus skip_samples resolves to sample zero.',
      },
      tools: [ffmpeg, ffprobe],
      plan: {path: planPath, sha256: initialInputSha256.plan, ...planInfo.integrity},
      inputs: {
        visualMaster: {
          path: visualMasterPath,
          planDeclaredPath: planInfo.visualMaster,
          sha256: initialInputSha256.visualMaster,
          muted: true,
        },
        spoken: {path: planInfo.spoken.path, sha256: planInfo.spoken.sha256, sourceIn: planInfo.spoken.sourceIn, sourceOut: planInfo.spoken.sourceOut},
        sfx: planInfo.sfx.map((file) => ({id: file.id, path: file.path, sha256: file.sha256, cues: file.cues})),
      },
      outputs: {
        withSfxPcm: {...withPcmQa, path: finalWithPcmPath},
        noSfxPcm: {...noPcmQa, path: finalNoPcmPath},
        withSfxAlignedAac: {path: finalWithAlignedAacPath, sha256: sha256File(withAlignedAac), bytes: statSync(withAlignedAac).size},
        noSfxAlignedAac: {path: finalNoAlignedAacPath, sha256: sha256File(noAlignedAac), bytes: statSync(noAlignedAac).size},
        withSfx: {path: finalWithPath, sha256: sha256File(withDelivery), bytes: statSync(withDelivery).size},
        noSfx: {path: finalNoPath, sha256: sha256File(noDelivery), bytes: statSync(noDelivery).size},
      },
      qa: {
        fullDecode: {visualMaster: 0, withSfx: 0, noSfx: 0},
        h264ElementarySha256: h264,
        decodedFrameComparison: frameComparison,
        pcmTracksDifferent: true,
        noSfxPcmSourcePreservation,
        expectedSfxPcmIdentity,
        expectedSfxDefinition: {
          float32InterleavedSha256: sha256Buffer(Buffer.from(
            expectedSfx.samples.buffer,
            expectedSfx.samples.byteOffset,
            expectedSfx.samples.byteLength,
          )),
          cues: expectedSfx.cues,
        },
        sourcePreflight: {
          spoken: spokenSourceQa.receipt,
          sfx: sfxSourceQa.receipt,
        },
        deliveryAudioContract: {
          withSfx: withDeliveryQa.audioContract,
          noSfx: noDeliveryQa.audioContract,
        },
        deliveryTimeline: {
          visualMaster: visualMasterQa.timeline,
          withSfx: withDeliveryQa.timeline,
          noSfx: noDeliveryQa.timeline,
        },
        aacAlignment: {
          declaredSamplesPerChannelPreservedInPcm: EXACT.samplesPerChannel,
          declaredPcmTailSamplesRemoved: 0,
          encoderPrerollSamplesOutsideDeclaredInterval: EXACT.aacAlignmentPrerollSamples,
          encoderPostrollSamplesOutsideDeclaredInterval: EXACT.aacEncoderPostrollSamples,
          finalInputSeekSeconds: EXACT.aacAlignmentPrerollSamples / EXACT.sampleRate,
          alignmentFrameSamples: EXACT.aacFrameSamples,
          finalContainerDurationSeconds: EXACT.durationSeconds,
        },
        audioTail,
        audioSimilarity,
        videoScan: scan,
        historicalV5Negative: historical,
        inputSnapshotRevalidatedBeforePublish: {
          ...inputSnapshotRevalidatedBeforeReceipt,
          validationPassesRequired: 2,
          secondPassImmediatelyBeforeAtomicPublish: true,
        },
      },
      commands: {
        pcm: [ffmpeg.realPath, ...pcmArgv].map((value) => typeof value === 'string' && value.startsWith(`${tempDirectory}${path.sep}`) ? path.join(outputDirectory, path.relative(tempDirectory, value)) : value),
        withSfxAacEncode: [ffmpeg.realPath, ...withAacArgv].map((value) => typeof value === 'string' && value.startsWith(`${tempDirectory}${path.sep}`) ? path.join(outputDirectory, path.relative(tempDirectory, value)) : value),
        noSfxAacEncode: [ffmpeg.realPath, ...noAacArgv].map((value) => typeof value === 'string' && value.startsWith(`${tempDirectory}${path.sep}`) ? path.join(outputDirectory, path.relative(tempDirectory, value)) : value),
        withSfxMux: [ffmpeg.realPath, ...withMuxArgv].map((value) => typeof value === 'string' && value.startsWith(`${tempDirectory}${path.sep}`) ? path.join(outputDirectory, path.relative(tempDirectory, value)) : value),
        noSfxMux: [ffmpeg.realPath, ...noMuxArgv].map((value) => typeof value === 'string' && value.startsWith(`${tempDirectory}${path.sep}`) ? path.join(outputDirectory, path.relative(tempDirectory, value)) : value),
      },
      remainingGates: ['independent-media-qa', 'normal-speed-full-watch', 'user-acceptance'],
    };
    writeFileSync(path.join(tempDirectory, path.basename(receiptPath)), `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx'});
    revalidateDirectorInputSnapshot({
      planPath,
      visualMasterPath,
      initialInputSha256,
      planInfo,
      ffmpeg,
      ffprobe,
      controlPlaneSnapshot,
    });
    invariant(!existsSync(outputDirectory), 'DIRECTOR_AB_OUTPUT_DIRECTORY_RACE');
    renameSync(tempDirectory, outputDirectory);
    return {
      ...receipt,
      receiptPath,
      receiptSha256: sha256File(receiptPath),
    };
  } catch (error) {
    if (existsSync(tempDirectory)) rmSync(tempDirectory, {recursive: true, force: true});
    throw error;
  }
};

const main = () => {
  const args = parseDirectorAbCliArgs(process.argv.slice(2));
  const required = ['plan', 'visual-master', 'output-dir', 'receipt', 'ffmpeg', 'ffprobe'];
  for (const key of required) invariant(args[key], 'DIRECTOR_AB_ARGUMENT_REQUIRED', key);
  const result = packageAndQaDirectorAb({
    planPath: args.plan,
    visualMasterPath: args['visual-master'],
    outputDirectory: args['output-dir'],
    receiptPath: args.receipt,
    ffmpegPath: args.ffmpeg,
    ffprobePath: args.ffprobe,
    historicalV5WithPath: args['historical-v5-with'],
    historicalV5NoPath: args['historical-v5-no'],
  });
  process.stdout.write(`${JSON.stringify({status: result.status, receiptPath: result.receiptPath, receiptSha256: result.receiptSha256}, null, 2)}\n`);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      code: error?.code ?? 'DIRECTOR_AB_UNCLASSIFIED_FAILURE',
      message: String(error?.message ?? error),
      receiptPath: error?.receiptPath ?? null,
      receiptSha256: error?.receiptSha256 ?? null,
      automationFreezeMustRemain: true,
    })}\n`);
    process.exitCode = 1;
  }
}
