#!/usr/bin/env node

import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  LOCKED_DIAGNOSTIC_THRESHOLDS_V2,
  runLockedMediaDiagnosticsForGeneratedVideoV2,
  sha256FileForQaV2,
} from './qa-generated-video-v2.mjs';
import {probeVideoV2} from './video-quality-metrics-v2.mjs';

export const DIRECTOR_R10_PAPER_MEDIA_AUDIT_SCHEMA = 'director-r10-paper-media-audit/v1';
export const DIRECTOR_R10_PAIR_MOTION_GAP_RATIO = 0.5;

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
  const motionFails = motionMaterialGap || noAssemblyBoundary;
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
  return summarizeDirectorR10PaperMediaAudit({
    currentDiagnostic: current.diagnostic,
    referenceDiagnostic: reference.diagnostic,
    currentFile: current.file,
    referenceFile: reference.file,
  });
};

const parseArguments = (argv) => {
  const result = {currentPath: null, referencePath: null};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--current') result.currentPath = argv[++index];
    else if (argument === '--reference') result.referencePath = argv[++index];
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
  '  node tools/director-r10-paper-media-audit.mjs --current <当前片.mp4> --reference <参考片.mp4>',
  '',
  '可选：--ffmpeg <路径> --ffprobe <路径> --tesseract <路径>',
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
