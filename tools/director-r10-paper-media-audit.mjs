#!/usr/bin/env node

import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  LOCKED_DIAGNOSTIC_THRESHOLDS_V2,
  runLockedMediaDiagnosticsForGeneratedVideoV2,
  sha256FileForQaV2,
} from './qa-generated-video-v2.mjs';
import {probeVideoV2} from './video-quality-metrics-v2.mjs';

export const DIRECTOR_R10_PAPER_MEDIA_AUDIT_SCHEMA = 'director-r10-paper-media-audit/v2';
export const DIRECTOR_R10_PAIR_MOTION_GAP_RATIO = 0.5;
export const DIRECTOR_R10_ACTION_BOUNDARY_TOLERANCE_SECONDS = 0.35;

const MOTION_ERROR_CODES = new Set([
  'REFERENCE_MOTION_MATERIAL_GAP',
  'BOUNDARY_COUNT_TOO_LOW',
]);
const PLANNED_EXPECTATION_ERROR_CODES = new Set([
  'EXPECTED_BOUNDARY_MISSING',
  'OCR_EXPECTED_TEXT_MISSING',
]);
const AUDIO_PROTOCOL_ERROR_CODES = new Set([
  'AUDIO_TRACK_COUNT_MISMATCH',
]);

export class DirectorR10PaperMediaAuditError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'DirectorR10PaperMediaAuditError';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = null) => {
  throw new DirectorR10PaperMediaAuditError(code, message, details);
};

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const finiteNumber = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number)) fail('R10_MEDIA_METRIC_INVALID', `${label}必须是有限数值。`);
  return number;
};
const ratio = (current, reference, label) => {
  if (reference <= 0) fail('R10_REFERENCE_MOTION_INVALID', `${label}参考值必须大于 0。`);
  return current / reference;
};

const normalizeError = (error) => ({
  code: String(error?.code ?? 'UNKNOWN'),
  message: String(error?.message ?? ''),
  details: error?.details ?? null,
});

export const buildDirectorR10PlannedActionAudit = ({
  runtime,
  eventId,
  toleranceSeconds = DIRECTOR_R10_ACTION_BOUNDARY_TOLERANCE_SECONDS,
} = {}) => {
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    fail('R10_PLANNED_RUNTIME_INVALID', '动作审计必须提供 R10 运行时时间轴对象。');
  }
  const fps = finiteNumber(runtime.fps, 'runtime.fps');
  if (fps <= 0 || !Array.isArray(runtime.events)) {
    fail('R10_PLANNED_RUNTIME_INVALID', 'R10 运行时时间轴缺少有效 fps 或 events。');
  }
  if (!isText(eventId)) fail('R10_PLANNED_EVENT_ID_REQUIRED', '动作审计必须提供 eventId。');
  const event = runtime.events.find((candidate) => candidate?.id === eventId);
  if (!event) fail('R10_PLANNED_EVENT_NOT_FOUND', `运行时时间轴中没有事件：${eventId}。`);
  if (
    !Number.isInteger(event.firstVisibleFrame)
    || !Number.isInteger(event.endFrameExclusive)
    || event.endFrameExclusive <= event.firstVisibleFrame
    || !Array.isArray(event.actions)
    || event.actions.length === 0
  ) {
    fail('R10_PLANNED_EVENT_INVALID', `事件${eventId}缺少有效可见范围或动作。`);
  }
  const tolerance = finiteNumber(toleranceSeconds, 'toleranceSeconds');
  if (tolerance <= 0 || tolerance > 1) {
    fail('R10_PLANNED_TOLERANCE_INVALID', '动作边界容差必须大于 0 且不超过 1 秒。');
  }
  const actions = event.actions.map((action, index) => {
    const id = String(action?.id ?? '').trim();
    if (!id || !Number.isInteger(action?.startFrame)) {
      fail('R10_PLANNED_ACTION_INVALID', `事件${eventId}的动作${index + 1}缺少 id 或 startFrame。`);
    }
    const frame = action.startFrame - event.firstVisibleFrame;
    if (frame < 0 || action.startFrame >= event.endFrameExclusive) {
      fail('R10_PLANNED_ACTION_INVALID', `事件${eventId}的动作${id}不在场景范围内。`);
    }
    return {id, frame, timeSeconds: frame / fps};
  });
  if (new Set(actions.map(({id}) => id)).size !== actions.length) {
    fail('R10_PLANNED_ACTION_INVALID', `事件${eventId}的动作 id 不得重复。`);
  }
  return {
    eventId,
    beatId: String(event.beatId ?? ''),
    fps,
    sceneStartFrame: event.firstVisibleFrame,
    sceneEndFrameExclusive: event.endFrameExclusive,
    expectedDurationSeconds: (event.endFrameExclusive - event.firstVisibleFrame) / fps,
    toleranceSeconds: tolerance,
    actions,
  };
};

const evaluatePlannedActionGate = ({plannedActionAudit, current}) => {
  if (plannedActionAudit == null) {
    return {
      required: false,
      passed: null,
      matchedCount: 0,
      requiredCount: 0,
      missingActionIds: [],
      matches: [],
      boundary: '未绑定运行时时间轴时只执行成对动态诊断；R10纸艺正式回归必须绑定六个动作锚点。',
    };
  }
  if (
    !Array.isArray(plannedActionAudit.actions)
    || plannedActionAudit.actions.length === 0
    || !Number.isFinite(plannedActionAudit.expectedDurationSeconds)
  ) {
    fail('R10_PLANNED_ACTION_AUDIT_INVALID', 'plannedActionAudit 缺少动作或场景时长。');
  }
  const toleranceSeconds = finiteNumber(
    plannedActionAudit.toleranceSeconds,
    'plannedActionAudit.toleranceSeconds',
  );
  const unused = new Set(current.assemblyBoundaries.map((_, index) => index));
  const matches = plannedActionAudit.actions.map((action) => {
    let bestIndex = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const index of unused) {
      const deltaSeconds = Math.abs(
        current.assemblyBoundaries[index].timeSeconds - action.timeSeconds,
      );
      if (deltaSeconds <= toleranceSeconds && deltaSeconds < bestDelta) {
        bestIndex = index;
        bestDelta = deltaSeconds;
      }
    }
    if (bestIndex === null) {
      return {id: action.id, expectedTimeSeconds: action.timeSeconds, matched: false};
    }
    unused.delete(bestIndex);
    const boundary = current.assemblyBoundaries[bestIndex];
    return {
      id: action.id,
      expectedTimeSeconds: action.timeSeconds,
      matched: true,
      detectedTimeSeconds: boundary.timeSeconds,
      deltaSeconds: boundary.timeSeconds - action.timeSeconds,
      scoreMadRgb: boundary.scoreMadRgb,
    };
  });
  const missingActionIds = matches.filter(({matched}) => !matched).map(({id}) => id);
  const durationToleranceSeconds = 1 / finiteNumber(plannedActionAudit.fps ?? current.fps, 'plannedActionAudit.fps');
  const durationDeltaSeconds = current.durationSeconds - plannedActionAudit.expectedDurationSeconds;
  const durationPassed = Math.abs(durationDeltaSeconds) <= durationToleranceSeconds + 1e-9;
  return {
    required: true,
    passed: missingActionIds.length === 0 && durationPassed,
    matchedCount: matches.length - missingActionIds.length,
    requiredCount: matches.length,
    missingActionIds,
    matches,
    durationPassed,
    expectedDurationSeconds: plannedActionAudit.expectedDurationSeconds,
    actualDurationSeconds: current.durationSeconds,
    durationDeltaSeconds,
    toleranceSeconds,
    boundary: '六个实录动作必须各自在锚点前后350毫秒内形成独立可检测边界；同一机器边界不得重复认领。',
  };
};

export const classifyDirectorR10SourceDiagnosticErrors = (errors = []) => {
  if (!Array.isArray(errors)) fail('R10_SOURCE_ERRORS_INVALID', '源诊断 errors 必须是数组。');
  const result = {
    audioProtocol: [],
    motionSignals: [],
    plannedExpectations: [],
    otherMediaProtocol: [],
  };
  for (const rawError of errors) {
    const error = normalizeError(rawError);
    if (AUDIO_PROTOCOL_ERROR_CODES.has(error.code)) result.audioProtocol.push(error);
    else if (MOTION_ERROR_CODES.has(error.code)) result.motionSignals.push(error);
    else if (PLANNED_EXPECTATION_ERROR_CODES.has(error.code)) result.plannedExpectations.push(error);
    else result.otherMediaProtocol.push(error);
  }
  return {
    ...result,
    audioMismatchExcludedFromPairMotionDecision: result.audioProtocol.some((error) => error.code === 'AUDIO_TRACK_COUNT_MISMATCH'),
    boundary: '分类只用于把原 H3 媒体协议错误与 R10 成对动态证据分开；AAC 音轨不参与本工具的动态结论。',
  };
};

const extractSignal = (diagnostic, label) => {
  const probe = diagnostic?.probe;
  const metrics = diagnostic?.metrics;
  if (!probe || !metrics?.summary || !Array.isArray(metrics.boundaries)) {
    fail('R10_SOURCE_DIAGNOSTIC_INVALID', `${label}缺少 probe、summary 或 boundaries。`);
  }
  const entropy = {
    mean: finiteNumber(metrics.summary.entropy?.mean, `${label}.entropy.mean`),
    median: finiteNumber(metrics.summary.entropy?.median, `${label}.entropy.median`),
  };
  const edgeStrength = {
    mean: finiteNumber(metrics.summary.edgeStrength?.mean, `${label}.edgeStrength.mean`),
    median: finiteNumber(metrics.summary.edgeStrength?.median, `${label}.edgeStrength.median`),
  };
  const madRgb = {
    mean: finiteNumber(metrics.summary.madPrev?.mean, `${label}.madPrev.mean`),
    p90: finiteNumber(metrics.summary.madPrev?.p90, `${label}.madPrev.p90`),
  };
  return {
    durationSeconds: finiteNumber(probe.durationSeconds, `${label}.durationSeconds`),
    fps: finiteNumber(probe.fps, `${label}.fps`),
    width: finiteNumber(probe.width, `${label}.width`),
    height: finiteNumber(probe.height, `${label}.height`),
    audioStreamCount: finiteNumber(probe.audioStreamCount, `${label}.audioStreamCount`),
    decodedFrameCount: finiteNumber(metrics.frameCount, `${label}.frameCount`),
    entropy,
    edgeStrength,
    madRgb,
    assemblyBoundaryCount: metrics.boundaries.length,
    assemblyBoundaries: metrics.boundaries.map((boundary) => ({
      frame: finiteNumber(boundary.frame, `${label}.boundary.frame`),
      timeSeconds: finiteNumber(boundary.timeSeconds, `${label}.boundary.timeSeconds`),
      scoreMadRgb: finiteNumber(boundary.scoreMadRgb, `${label}.boundary.scoreMadRgb`),
    })),
    sourceDiagnosticStatus: String(diagnostic.status ?? 'unknown'),
    sourceDiagnosticErrors: classifyDirectorR10SourceDiagnosticErrors(diagnostic.errors ?? []),
  };
};

export const summarizeDirectorR10PaperMediaAudit = ({
  currentDiagnostic,
  referenceDiagnostic,
  currentFile = null,
  referenceFile = null,
  plannedActionAudit = null,
  motionGapRatio = DIRECTOR_R10_PAIR_MOTION_GAP_RATIO,
} = {}) => {
  const threshold = finiteNumber(motionGapRatio, 'motionGapRatio');
  if (threshold <= 0 || threshold > 1) fail('R10_MOTION_GAP_RATIO_INVALID', 'motionGapRatio 必须大于 0 且不大于 1。');
  const current = extractSignal(currentDiagnostic, 'current');
  const reference = extractSignal(referenceDiagnostic, 'reference');
  const meanMadRatio = ratio(current.madRgb.mean, reference.madRgb.mean, 'mean MAD');
  const p90MadRatio = ratio(current.madRgb.p90, reference.madRgb.p90, 'P90 MAD');
  const motionMaterialGap = meanMadRatio < threshold || p90MadRatio < threshold;
  const noAssemblyBoundary = current.assemblyBoundaryCount === 0;
  const staticTextureThresholdPassed =
    current.entropy.median >= LOCKED_DIAGNOSTIC_THRESHOLDS_V2.minimumMedianEntropy &&
    current.edgeStrength.median >= LOCKED_DIAGNOSTIC_THRESHOLDS_V2.minimumMedianEdgeStrength;
  const plannedActionGate = evaluatePlannedActionGate({plannedActionAudit, current});
  const motionFails = motionMaterialGap || noAssemblyBoundary || plannedActionGate.passed === false;
  const staticLooksAcceptableButMotionFails = staticTextureThresholdPassed && motionFails;

  return {
    schemaVersion: DIRECTOR_R10_PAPER_MEDIA_AUDIT_SCHEMA,
    evidenceScope: 'machine-dynamic-evidence-only',
    media: {
      current: {...(currentFile ?? {}), ...current},
      reference: {...(referenceFile ?? {}), ...reference},
    },
    comparison: {
      currentToReference: {
        meanMadRatio,
        p90MadRatio,
      },
      motionGapRatioThreshold: threshold,
      entropyMedianDelta: current.entropy.median - reference.entropy.median,
      edgeStrengthMedianDelta: current.edgeStrength.median - reference.edgeStrength.median,
      assemblyBoundaryCountDelta: current.assemblyBoundaryCount - reference.assemblyBoundaryCount,
    },
    staticTextureGate: {
      passed: staticTextureThresholdPassed,
      currentEntropyMedian: current.entropy.median,
      minimumEntropyMedian: LOCKED_DIAGNOSTIC_THRESHOLDS_V2.minimumMedianEntropy,
      currentEdgeStrengthMedian: current.edgeStrength.median,
      minimumEdgeStrengthMedian: LOCKED_DIAGNOSTIC_THRESHOLDS_V2.minimumMedianEdgeStrength,
      boundary: '这只表示静帧纹理超过锁定机器下限，不表示画面、纸材或审美合格。',
    },
    plannedActionGate,
    findings: {
      motionMaterialGap,
      noAssemblyBoundary,
      staticLooksAcceptableButMotionFails,
    },
    decision: {
      status: motionFails ? 'blocked-machine-motion-evidence' : 'diagnostic-only-awaiting-human-review',
      technicalQaPassed: false,
      productionEligible: false,
      aestheticApproval: 'not-evaluated',
      humanNormalSpeedReviewRequired: true,
    },
    boundary: '本结果只证明同算法下的动作量、变化峰值和装配边界差异；不得声称审美合格或正式候选合格，仍需独立人工按正常速度完整验收。',
  };
};

const diagnosticExpectationsFromProbe = (probe) => ({
  expectedAudioTracks: 0,
  expectedDurationSeconds: probe.durationSeconds,
  width: probe.width,
  height: probe.height,
  fps: probe.fps,
  expectedTextList: [],
  // runLockedMediaDiagnosticsForGeneratedVideoV2 源自 H3 门禁，必须收到三个计划边界。
  // R10 不用这三个占位点作结论，只比较算法实测的 boundaries。
  expectedBoundariesSeconds: [0.2, 0.5, 0.8].map((fraction) => probe.durationSeconds * fraction),
});

const runOne = async ({videoPath, ffmpegBin, ffprobeBin, tesseractBin}) => {
  const absolutePath = path.resolve(videoPath);
  const probe = probeVideoV2({videoPath: absolutePath, ffprobeBin});
  const diagnostic = await runLockedMediaDiagnosticsForGeneratedVideoV2({
    videoPath: absolutePath,
    expectations: diagnosticExpectationsFromProbe(probe),
    ffmpegBin,
    ffprobeBin,
    tesseractBin,
  });
  return {
    diagnostic,
    file: {
      path: absolutePath,
      sha256: sha256FileForQaV2(absolutePath),
    },
  };
};

export const runDirectorR10PaperMediaAudit = async ({
  currentPath,
  referencePath,
  runtimePath = null,
  eventId = null,
  ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg',
  ffprobeBin = process.env.FFPROBE_BIN || 'ffprobe',
  tesseractBin = process.env.TESSERACT_BIN || 'tesseract',
} = {}) => {
  if (!isText(currentPath) || !isText(referencePath)) {
    fail('R10_MEDIA_PATH_REQUIRED', 'currentPath 与 referencePath 均为必填项。');
  }
  const [current, reference] = await Promise.all([
    runOne({videoPath: currentPath, ffmpegBin, ffprobeBin, tesseractBin}),
    runOne({videoPath: referencePath, ffmpegBin, ffprobeBin, tesseractBin}),
  ]);
  let plannedActionAudit = null;
  let runtimeFile = null;
  if (runtimePath !== null || eventId !== null) {
    if (!isText(runtimePath) || !isText(eventId)) {
      fail('R10_RUNTIME_BINDING_INCOMPLETE', '--runtime 与 --event-id 必须同时提供。');
    }
    const absoluteRuntimePath = path.resolve(runtimePath);
    let runtime;
    try {
      runtime = JSON.parse(readFileSync(absoluteRuntimePath, 'utf8'));
    } catch (error) {
      fail('R10_RUNTIME_READ_FAILED', `无法读取动作审计时间轴：${absoluteRuntimePath}`, {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    plannedActionAudit = buildDirectorR10PlannedActionAudit({runtime, eventId});
    runtimeFile = {
      path: absoluteRuntimePath,
      sha256: sha256FileForQaV2(absoluteRuntimePath),
    };
  }
  return summarizeDirectorR10PaperMediaAudit({
    currentDiagnostic: current.diagnostic,
    referenceDiagnostic: reference.diagnostic,
    currentFile: current.file,
    referenceFile: reference.file,
    plannedActionAudit: plannedActionAudit === null
      ? null
      : {...plannedActionAudit, runtimeFile},
  });
};

const parseArguments = (argv) => {
  const result = {currentPath: null, referencePath: null, runtimePath: null, eventId: null};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--current') result.currentPath = argv[++index];
    else if (argument === '--reference') result.referencePath = argv[++index];
    else if (argument === '--runtime') result.runtimePath = argv[++index];
    else if (argument === '--event-id') result.eventId = argv[++index];
    else if (argument === '--ffmpeg') result.ffmpegBin = argv[++index];
    else if (argument === '--ffprobe') result.ffprobeBin = argv[++index];
    else if (argument === '--tesseract') result.tesseractBin = argv[++index];
    else if (argument === '--help') result.help = true;
    else fail('R10_CLI_ARGUMENT_UNKNOWN', `未知参数：${argument}`);
  }
  return result;
};

const usage = () => [
  '用法：',
  '  node tools/director-r10-paper-media-audit.mjs --current <当前片.mp4> --reference <参考片.mp4> [--runtime <时间轴.json> --event-id <事件ID>]',
  '',
  '可选：--runtime 与 --event-id 绑定六个实录动作锚点；--ffmpeg、--ffprobe、--tesseract 指定工具路径。',
  '该命令只读、不写回执；诊断成功时退出码为 0，“动态不足”是诊断结果而非命令失败。',
].join('\n');

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  let args;
  try {
    args = parseArguments(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
    } else if (!isText(args.currentPath) || !isText(args.referencePath)) {
      fail('R10_CLI_ARGUMENT_REQUIRED', '--current 与 --reference 均为必填项。');
    } else {
      const result = await runDirectorR10PaperMediaAudit(args);
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(`[${error?.code ?? 'R10_MEDIA_AUDIT_FAILED'}] ${error instanceof Error ? error.message : String(error)}`);
    console.error(usage());
    process.exitCode = 2;
  }
}
