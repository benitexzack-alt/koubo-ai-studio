#!/usr/bin/env node

import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  analyzeDecodedFramesV2,
  decodeVideoFullyV2,
  probeVideoFrameTimelineV2,
  probeVideoV2,
  runFfmpegDetectorsV2,
} from './video-quality-metrics-v2.mjs';
import {
  assertFileReferenceV2,
  assertGeneratedVideoPlanV2ProductionEligible,
  generatedVideoProjectRootV2,
  loadGeneratedVideoPlanV2,
  readBoundProjectJsonV2,
  resolveProjectFileV2,
  stableJsonSha256V2,
} from './generated-video-plan-v2-core.mjs';
import {assertNoRetiredGeneratedStyle} from './generated-style-policy.mjs';
import {
  RUNNINGHUB_H3_V2_DOWNLOAD_RECEIPT_SCHEMA,
  RUNNINGHUB_H3_V2_QUERY_RECEIPT_SCHEMA,
  RUNNINGHUB_H3_V2_REQUEST_SCHEMA,
  RUNNINGHUB_H3_V2_RESULT_RECEIPT_SCHEMA,
  RUNNINGHUB_H3_V2_TASK_RECEIPT_SCHEMA,
  RUNNINGHUB_NETWORK_AUTHORIZATION_SCHEMA,
  RUNNINGHUB_PAID_AUTHORIZATION_SCHEMA,
  RUNNINGHUB_USER_AUTHORIZATION_EVIDENCE_SCHEMA,
  compileRunningHubH3V2Shot,
  computeApprovedStillUploadTransportBindingSha256V1,
  validateApprovedStillUploadReceiptV1,
  validateRunningHubH3V2DownloadReceipt,
  validateRunningHubH3V2QueryReceipt,
  validateRunningHubH3V2RequestDefinition,
  validateRunningHubH3V2ResultReceipt,
  validateRunningHubH3V2TaskReceipt,
} from './runninghub-generated-video-v2-adapter.mjs';
import {validateDirectorExternalMessageAnchorV2} from '../skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs';
import {
  assertProductionEntryPreflightV2,
  computeProductionCompositionBindingV2,
  stableJsonSha256ForProductionGateV2,
} from '../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';

export const GENERATED_VIDEO_V2_QA_REQUEST_SCHEMA = 'generated-video-v2-qa-request/v2';
export const GENERATED_VIDEO_V2_QA_RECEIPT_SCHEMA = 'generated-video-v2-qa-receipt/v2';
export const RUNNINGHUB_H3_V2_TRANSPORT_ATTESTATION_SCHEMA = 'runninghub-h3-v2-transport-attestation/v1';
export const GENERATED_VIDEO_V2_REFERENCE_BASELINE_RECEIPT_SCHEMA = 'generated-video-v2-reference-baseline-receipt/v1';
const REFERENCE_MOTION_ALGORITHM_ID_V2 = 'video-quality-metrics-v2/analyzeDecodedFramesV2@160x90-rgb24-full-frame-v1';
const REFERENCE_MOTION_BASELINE_RECEIPT_SHA256_V2 = '83a4160d362b91054b214ad142a2d8a21ca65efac55f4627b6358270b7a2b67e';
export const LOCKED_REFERENCE_MOTION_BASELINE_V2 = Object.freeze({
  schemaVersion: GENERATED_VIDEO_V2_REFERENCE_BASELINE_RECEIPT_SCHEMA,
  receiptId: 'paper-editorial-reference-f172d6dc-qa-rgb-mad-v1',
  evidenceScope: 'controlled-offline-reference-baseline',
  referenceMedia: Object.freeze({
    logicalId: 'paper-editorial-primary-reference',
    sha256: 'f172d6dc4831ce51bdecfe1359b1187666cad23c098c402edfc6836e3e553949',
    bytes: 27112016,
    decodedFrameCount: 3304,
  }),
  algorithm: Object.freeze({
    id: REFERENCE_MOTION_ALGORITHM_ID_V2,
    implementationPath: 'tools/video-quality-metrics-v2.mjs',
    implementationSha256: '0a1ee1327fc963957cc7f1330d17b7e246ede7e350216025b316f0f86dd819bd',
    decoder: 'ffmpeg decoded frames scaled before metric calculation',
    scale: '160x90',
    pixelFormat: 'rgb24',
    frameScope: 'full decoded frame; first-frame MAD=0 is included',
    madPrev: 'mean absolute decoded RGB-channel difference from previous frame',
    percentile: 'floor((n-1)*p), no interpolation',
  }),
  measurements: Object.freeze({
    entropyMean: 6.747083563,
    edgeStrengthMean: 9.675752279,
    meanMadRgb: 3.073518294,
    p90MadRgb: 8.413611111,
  }),
  receiptSha256: REFERENCE_MOTION_BASELINE_RECEIPT_SHA256_V2,
  boundary: '该回执与 knowledge/23 的锁定审计算法不同，严禁混用数值。动态指标只筛掉明显低于参考的候选；不能用无意义抖动追数，也不能代替纸材、空间、装配因果和人工视觉验收。',
});
const REFERENCE_MOTION_MATERIAL_GAP_RATIO_V2 = 0.5;

const projectRoot = generatedVideoProjectRootV2;
const PAPER_EDITORIAL_STYLE_ID = 'koubo-paper-editorial-assembly-v2';
const REJECTED_ACCIDENT_OUTPUT_SHA256 = '3ba5cef4e0c5ae26e2f70d27c8799cea5d736498d85dcbd00dba2050125e5488';
const PRODUCTION_QA_COMMAND = 'generated-video-production-qa';
const PRODUCTION_QA_ENTRYPOINT = 'tools/qa-generated-video-v2.mjs';
const QA_FREEZE_CLOSURE_REQUIRED_PATHS = Object.freeze([
  'tools/generated-video-plan-v2-core.mjs',
  'tools/runninghub-generated-video-v2-adapter.mjs',
  'tools/qa-generated-video-v2.mjs',
  'tools/video-quality-metrics-v2.mjs',
  'tools/generated-style-policy.mjs',
  'skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs',
  'skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs',
]);

export class GeneratedVideoV2QaError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'GeneratedVideoV2QaError';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = null) => {
  throw new GeneratedVideoV2QaError(code, message, details);
};
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const sameNumber = (left, right) => Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.abs(Number(left) - Number(right)) <= 1e-9;
const sha256Buffer = (value) => createHash('sha256').update(value).digest('hex');
export const sha256FileForQaV2 = (filePath) => sha256Buffer(readFileSync(filePath));
const relativeProjectPath = (filePath) => path.relative(projectRoot, filePath).split(path.sep).join('/');

const referenceMotionBaselineReceiptDefinitionV2 = (receipt) => ({
  schemaVersion: receipt?.schemaVersion,
  receiptId: receipt?.receiptId,
  evidenceScope: receipt?.evidenceScope,
  referenceMedia: {
    logicalId: receipt?.referenceMedia?.logicalId,
    sha256: receipt?.referenceMedia?.sha256,
    bytes: receipt?.referenceMedia?.bytes,
    decodedFrameCount: receipt?.referenceMedia?.decodedFrameCount,
  },
  algorithm: {
    id: receipt?.algorithm?.id,
    implementationPath: receipt?.algorithm?.implementationPath,
    implementationSha256: receipt?.algorithm?.implementationSha256,
    decoder: receipt?.algorithm?.decoder,
    scale: receipt?.algorithm?.scale,
    pixelFormat: receipt?.algorithm?.pixelFormat,
    frameScope: receipt?.algorithm?.frameScope,
    madPrev: receipt?.algorithm?.madPrev,
    percentile: receipt?.algorithm?.percentile,
  },
  measurements: {
    entropyMean: receipt?.measurements?.entropyMean,
    edgeStrengthMean: receipt?.measurements?.edgeStrengthMean,
    meanMadRgb: receipt?.measurements?.meanMadRgb,
    p90MadRgb: receipt?.measurements?.p90MadRgb,
  },
  boundary: receipt?.boundary,
});

export const validateReferenceMotionBaselineReceiptV2 = (receipt = LOCKED_REFERENCE_MOTION_BASELINE_V2) => {
  if (!isObject(receipt) || receipt.schemaVersion !== GENERATED_VIDEO_V2_REFERENCE_BASELINE_RECEIPT_SCHEMA) {
    fail('REFERENCE_BASELINE_SCHEMA_INVALID', `参考动态基线必须使用 ${GENERATED_VIDEO_V2_REFERENCE_BASELINE_RECEIPT_SCHEMA}。`);
  }
  if (receipt.algorithm?.id !== REFERENCE_MOTION_ALGORITHM_ID_V2) {
    fail('REFERENCE_BASELINE_ALGORITHM_MISMATCH', '参考动态基线不属于 QA v2 的同版本逐帧算法，禁止混用锁定审计链数值。');
  }
  if (receipt.algorithm?.implementationPath !== 'tools/video-quality-metrics-v2.mjs') {
    fail('REFERENCE_BASELINE_IMPLEMENTATION_PATH_MISMATCH', '参考动态基线未绑定 QA v2 指标实现路径。');
  }
  const definitionSha256 = stableJsonSha256V2(referenceMotionBaselineReceiptDefinitionV2(receipt));
  if (
    receipt.receiptSha256 !== REFERENCE_MOTION_BASELINE_RECEIPT_SHA256_V2 ||
    definitionSha256 !== REFERENCE_MOTION_BASELINE_RECEIPT_SHA256_V2
  ) {
    fail('REFERENCE_BASELINE_RECEIPT_SHA_MISMATCH', '参考动态基线回执内容或数值已漂移。', {
      expectedSha256: REFERENCE_MOTION_BASELINE_RECEIPT_SHA256_V2,
      declaredSha256: receipt.receiptSha256 ?? null,
      actualSha256: definitionSha256,
    });
  }
  const implementationPath = resolveProjectFileV2(receipt.algorithm.implementationPath, '参考动态算法实现');
  const implementationSha256 = sha256FileForQaV2(implementationPath);
  if (implementationSha256 !== receipt.algorithm.implementationSha256) {
    fail('REFERENCE_BASELINE_IMPLEMENTATION_SHA_MISMATCH', '参考动态基线绑定的指标实现已改变，必须用新实现重算参考片。', {
      expectedSha256: receipt.algorithm.implementationSha256,
      actualSha256: implementationSha256,
    });
  }
  return {
    ...referenceMotionBaselineReceiptDefinitionV2(receipt),
    receiptSha256: definitionSha256,
    verifiedImplementation: {
      path: receipt.algorithm.implementationPath,
      sha256: implementationSha256,
    },
  };
};

const resolveProjectTarget = (targetPath, label) => {
  if (!isText(targetPath)) fail('QA_TARGET_REQUIRED', `${label}路径不能为空。`);
  const absolutePath = path.isAbsolute(targetPath) ? path.resolve(targetPath) : path.resolve(projectRoot, targetPath);
  const relation = path.relative(projectRoot, absolutePath);
  if (!relation || relation === '..' || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) {
    fail('QA_TARGET_OUTSIDE_PROJECT', `${label}必须位于口播项目内。`);
  }
  let cursor = projectRoot;
  for (const segment of relation.split(path.sep).filter(Boolean)) {
    cursor = path.resolve(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      fail('QA_TARGET_SYMLINK_FORBIDDEN', `${label}路径不得经过符号链接。`);
    }
  }
  return absolutePath;
};

const readBoundJson = (reference, label, codePrefix) => readBoundProjectJsonV2(reference, {
  label,
  pathCode: `${codePrefix}_REQUIRED`,
  shaCode: `${codePrefix}_SHA_MISMATCH`,
  jsonCode: `${codePrefix}_JSON_INVALID`,
});

const assertSameReference = (left, right, label) => {
  if (!isObject(left) || !isObject(right) || left.sha256 !== right.sha256) {
    fail('QA_PRODUCTION_BINDING_MISMATCH', `${label} SHA-256 与生产门不一致。`);
  }
  const leftFile = assertFileReferenceV2(left, {label, pathCode: 'QA_PRODUCTION_BINDING_REQUIRED', shaCode: 'QA_PRODUCTION_BINDING_SHA_MISMATCH'});
  const rightFile = assertFileReferenceV2(right, {label, pathCode: 'QA_PRODUCTION_BINDING_REQUIRED', shaCode: 'QA_PRODUCTION_BINDING_SHA_MISMATCH'});
  if (leftFile.absolutePath !== rightFile.absolutePath) {
    fail('QA_PRODUCTION_BINDING_MISMATCH', `${label}路径与生产门不一致。`);
  }
  return leftFile;
};

const atomicWriteJson = (filePath, value) => {
  mkdirSync(path.dirname(filePath), {recursive: true});
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  renameSync(temporary, filePath);
};

const runTool = (binary, args, code, label) => {
  const result = spawnSync(binary, args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
  if (result.error || result.status !== 0) {
    fail(code, `${label}失败。`, {exitCode: result.status, reason: result.error?.message ?? null, stderr: String(result.stderr ?? '').slice(-2000)});
  }
  return result;
};

const normalizeOcrText = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLocaleUpperCase('zh-CN')
  .replace(/[\p{White_Space}\p{Punctuation}\p{Symbol}]+/gu, '');

const runOcr = ({videoPath, expectedTextList, artifactsDirectory, ffmpegBin, tesseractBin, sampleIntervalSeconds}) => {
  const languages = runTool(tesseractBin, ['--list-langs'], 'TESSERACT_UNAVAILABLE', 'Tesseract 语言探测').stdout;
  const available = new Set(String(languages).split(/\s+/u).filter(Boolean));
  if (!available.has('chi_sim') || !available.has('eng')) fail('OCR_LANGUAGE_UNAVAILABLE', '机器 OCR 必须同时具备 chi_sim 与 eng。');
  const ocrDirectory = path.join(artifactsDirectory, 'ocr');
  mkdirSync(ocrDirectory, {recursive: true});
  const pattern = path.join(ocrDirectory, 'frame-%06d.png');
  runTool(ffmpegBin, [
    '-hide_banner', '-nostdin', '-nostats', '-v', 'error', '-i', videoPath,
    '-map', '0:v:0', '-an', '-vf', `fps=1/${sampleIntervalSeconds},scale=1280:-2`, '-fps_mode', 'vfr', pattern,
  ], 'OCR_FRAME_EXTRACTION_FAILED', 'OCR 固定间隔抽帧');
  const frames = readdirSync(ocrDirectory).filter((name) => /^frame-\d+\.png$/u.test(name)).sort();
  if (frames.length === 0) fail('OCR_FRAME_EXTRACTION_EMPTY', 'OCR 未抽到视频帧。');
  const samples = frames.map((name, index) => {
    const framePath = path.join(ocrDirectory, name);
    const result = runTool(tesseractBin, [framePath, 'stdout', '-l', 'chi_sim+eng', '--psm', '11'], 'OCR_EXECUTION_FAILED', `OCR ${name}`);
    return {
      framePath: relativeProjectPath(framePath),
      frameSha256: sha256FileForQaV2(framePath),
      timeSeconds: index * sampleIntervalSeconds,
      text: result.stdout.trim(),
      normalizedText: normalizeOcrText(result.stdout),
    };
  });
  const expected = expectedTextList.map((item) => ({...item, normalizedText: normalizeOcrText(item.text)}));
  const missing = expected.filter((item) => {
    const aggregate = samples.filter((sample) => sample.timeSeconds >= item.startSeconds - 1e-6 && sample.timeSeconds <= item.endSeconds + 1e-6)
      .map((sample) => sample.normalizedText).join('');
    return !item.normalizedText || !aggregate.includes(item.normalizedText);
  }).map((item) => item.text);
  return {
    status: expected.length === 0 ? 'machine-ocr-navigation-only-no-planned-text' : missing.length === 0 ? 'machine-ocr-matched-in-declared-time-windows' : 'machine-ocr-missing-text',
    engine: 'tesseract',
    language: 'chi_sim+eng',
    sampleIntervalSeconds,
    expected,
    missing,
    samples,
    boundary: '机器 OCR 只是字幕、Logo、伪 UI 导航证据；语义与版权仍需人工审查。',
  };
};

const profileThresholds = (style) => {
  if (style?.id !== PAPER_EDITORIAL_STYLE_ID || style?.productionEligible !== true || !isObject(style.machineQa)) {
    fail('STYLE_PRODUCTION_PROFILE_INVALID', '只允许已晋级的纸媒叙事 v2 风格派生 QA 阈值。');
  }
  const minimumEntropy = Number(style.machineQa.minimumSequenceMedianGrayscaleEntropyBits);
  const minimumEdge = Number(style.machineQa.minimumSequenceMedianEdgeStrength);
  const maximumDuplicateHold = Number(style.machineQa.maximumUndeclaredDuplicateHoldSeconds);
  const minimumAssemblyBeats = Number(style.motionGrammar?.complexShotAssemblyBeats?.min);
  if (!Number.isFinite(minimumEntropy) || minimumEntropy <= 0 || !Number.isFinite(minimumEdge) || minimumEdge <= 0 ||
      !Number.isFinite(maximumDuplicateHold) || maximumDuplicateHold <= 0 || maximumDuplicateHold > 0.5 ||
      !Number.isInteger(minimumAssemblyBeats) || minimumAssemblyBeats < 4) {
    fail('STYLE_QUALITY_PROFILE_INVALID', '已晋级风格卡的机器 QA 下限缺失或过宽。');
  }
  return Object.freeze({
    maxBlackRunSeconds: 0.2,
    maxWhiteRunSeconds: 0.2,
    maxFreezeRunSeconds: 1.5,
    maxExactDuplicateRunSeconds: maximumDuplicateHold,
    maxRepeatedFrameRatio: 0.05,
    freezeMadThreshold: 0.05,
    minimumMedianEntropy: minimumEntropy,
    minimumMedianEdgeStrength: minimumEdge,
    minimumBoundaryCount: minimumAssemblyBeats - 1,
    boundaryMadThreshold: 8,
    boundaryNmsSeconds: 0.5,
    boundaryToleranceSeconds: 0.35,
    ocrSampleIntervalSeconds: 1,
    durationToleranceSeconds: 0.2,
    frameCountTolerance: 1,
  });
};

export const LOCKED_DIAGNOSTIC_THRESHOLDS_V2 = Object.freeze({
  maxBlackRunSeconds: 0.2,
  maxWhiteRunSeconds: 0.2,
  maxFreezeRunSeconds: 1.5,
  maxExactDuplicateRunSeconds: 0.2,
  maxRepeatedFrameRatio: 0.05,
  freezeMadThreshold: 0.05,
  minimumMedianEntropy: 6.5,
  minimumMedianEdgeStrength: 5.8,
  minimumBoundaryCount: 3,
  boundaryMadThreshold: 8,
  boundaryNmsSeconds: 0.5,
  boundaryToleranceSeconds: 0.35,
  ocrSampleIntervalSeconds: 1,
  durationToleranceSeconds: 0.2,
  frameCountTolerance: 1,
});

const validateExpectations = (expectations, {durationSeconds = null} = {}) => {
  if (!isObject(expectations)) fail('QA_EXPECTATIONS_REQUIRED', 'expectations 缺失。');
  if (expectations.expectedAudioTracks !== 0) fail('QA_AUDIO_EXPECTATION_INVALID', '图片驱动的 H3 插片必须锁定为 0 条音轨。');
  const expectedDurationSeconds = Number(expectations.expectedDurationSeconds);
  const width = Number(expectations.width);
  const height = Number(expectations.height);
  const fps = Number(expectations.fps);
  if (!Number.isFinite(expectedDurationSeconds) || expectedDurationSeconds <= 0 ||
      (durationSeconds !== null && Math.abs(expectedDurationSeconds - durationSeconds) > 1e-9) ||
      !Number.isInteger(width) || width < 1920 || !Number.isInteger(height) || height < 1080 ||
      Math.abs(width / height - 16 / 9) > 0.01 || !Number.isFinite(fps) || fps < 24 || fps > 60) {
    fail('QA_MEDIA_EXPECTATION_INVALID', '媒体合同必须绑定镜头时长、至少 1920×1080、16:9 与 24—60fps。');
  }
  const expectedTextList = expectations.expectedTextList;
  if (!Array.isArray(expectedTextList) || expectedTextList.some((item) => !isObject(item) || !isText(item.text) ||
      !Number.isFinite(Number(item.startSeconds)) || !Number.isFinite(Number(item.endSeconds)) ||
      Number(item.startSeconds) < 0 || Number(item.endSeconds) <= Number(item.startSeconds) || Number(item.endSeconds) > expectedDurationSeconds)) {
    fail('QA_TEXT_EXPECTATION_INVALID', 'expectedTextList 必须是完整时窗对象数组，无计划文字时为空数组。');
  }
  const expectedBoundariesSeconds = expectations.expectedBoundariesSeconds;
  if (!Array.isArray(expectedBoundariesSeconds) || expectedBoundariesSeconds.length < 3 ||
      expectedBoundariesSeconds.some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) >= expectedDurationSeconds)) {
    fail('QA_BOUNDARY_EXPECTATION_REQUIRED', '每镜必须绑定至少 3 个可见装配/转场边界。');
  }
  return {
    expectedAudioTracks: 0,
    expectedDurationSeconds,
    width,
    height,
    fps,
    expectedTextList: expectedTextList.map((item) => ({text: item.text, startSeconds: Number(item.startSeconds), endSeconds: Number(item.endSeconds)})),
    expectedBoundariesSeconds: expectedBoundariesSeconds.map(Number),
  };
};

const referenceSummary = (bound) => ({path: bound.relativePath, sha256: bound.sha256});

const assertExternalAnchor = (body, kind, code) => {
  const result = validateDirectorExternalMessageAnchorV2(body, kind);
  if (!result.ok) fail(code, '回执未绑定独立监督维护的外部消息锚点。', {reason: result.reason});
  return result;
};

const validateNetworkAuthorization = ({reference, operation, binding, label}) => {
  const authorization = readBoundJson(reference, label, 'H3_NETWORK_AUTHORIZATION');
  const body = authorization.body;
  if (
    body.schema !== RUNNINGHUB_NETWORK_AUTHORIZATION_SCHEMA ||
    body.evidenceScope !== 'external-user-message' ||
    body.decision !== 'approved-network-call' ||
    body.operation !== operation ||
    !isText(body.authorizationId) ||
    !isText(body.nonce) ||
    !isText(body.executionGroupId) ||
    !isText(body.issuerGroupId) ||
    body.executionGroupId === body.issuerGroupId ||
    !isText(body.sourceThreadId) ||
    !isText(body.sourceMessageId) ||
    !isText(body.explicitAuthorizationQuote) ||
    !isText(body.expiresAt) || Number.isNaN(Date.parse(body.expiresAt)) ||
    body.sourceMessageSha256 !== sha256Buffer(body.explicitAuthorizationQuote) ||
    stableJsonSha256V2(body.binding) !== stableJsonSha256V2(binding)
  ) {
    fail('H3_NETWORK_AUTHORIZATION_CONTENT_INVALID', `${label}未绑定当前操作、真实请求与外部原话。`);
  }
  const external = assertExternalAnchor(body, 'runninghub-network-authorization', 'H3_NETWORK_AUTHORIZATION_EXTERNAL_ANCHOR_INVALID');
  if (
    external.entry.authorizationId !== body.authorizationId ||
    external.entry.nonce !== body.nonce ||
    external.entry.operation !== operation ||
    external.entry.bindingSha256 !== stableJsonSha256V2(binding) ||
    external.entry.expiresAt !== body.expiresAt
  ) {
    fail('H3_NETWORK_AUTHORIZATION_EXTERNAL_ANCHOR_BINDING_INVALID', `${label}的外部锚点未绑定 authorizationId、nonce、operation、请求与有效期。`);
  }
  return authorization;
};

const validatePaidTaskAuthorization = ({reference, taskBody}) => {
  const authorization = readBoundJson(reference, 'H3 task 付费授权', 'H3_PAID_AUTHORIZATION');
  const body = authorization.body;
  if (
    body.schema !== RUNNINGHUB_PAID_AUTHORIZATION_SCHEMA ||
    body.decision !== 'approved-exact-paid-call' ||
    body.allowNetwork !== true || body.allowPaid !== true || body.maxSubmissions !== 1 ||
    body.operation !== taskBody.operation || body.currency !== 'CNY' ||
    !isText(body.authorizationId) || !isText(body.nonce) || !isText(body.executionGroupId) ||
    !isText(body.approvedAt) || Number.isNaN(Date.parse(body.approvedAt)) ||
    !isText(body.expiresAt) || Number.isNaN(Date.parse(body.expiresAt)) ||
    Date.parse(body.expiresAt) <= Date.parse(body.approvedAt) ||
    !Number.isFinite(Number(body.exactCostCny)) || Number(body.exactCostCny) <= 0 ||
    stableJsonSha256V2(body.requestBinding) !== stableJsonSha256V2(taskBody.requestBinding) ||
    body.quoteReceiptSha256 !== taskBody.quoteReceipt?.sha256 ||
    body.quoteReceiptId !== taskBody.quoteReceipt?.quoteReceiptId ||
    taskBody.authorization?.authorizationId !== body.authorizationId ||
    taskBody.authorization?.nonce !== body.nonce
  ) {
    fail('H3_PAID_AUTHORIZATION_CONTENT_INVALID', 'task 付费授权未绑定当前 production-run 请求与精确金额。');
  }
  const evidence = readBoundJson(body.userEvidence, 'H3 task 用户授权原始证据', 'H3_USER_AUTHORIZATION_EVIDENCE');
  const source = evidence.body;
  if (
    source.schema !== RUNNINGHUB_USER_AUTHORIZATION_EVIDENCE_SCHEMA ||
    source.evidenceScope !== 'external-user-message' ||
    source.decision !== 'approved-exact-paid-call' ||
    source.reviewerKind !== 'user' ||
    !isText(source.reviewerId) ||
    !isText(source.issuerGroupId) || source.issuerGroupId === body.executionGroupId ||
    source.operation !== body.operation ||
    source.authorizationId !== body.authorizationId || source.nonce !== body.nonce ||
    source.currency !== body.currency || !sameNumber(source.exactCostCny, body.exactCostCny) ||
    source.expiresAt !== body.expiresAt ||
    stableJsonSha256V2(source.requestBinding) !== stableJsonSha256V2(body.requestBinding) ||
    !isText(source.approvedAt) || Number.isNaN(Date.parse(source.approvedAt)) ||
    !isText(source.explicitAuthorizationQuote) || source.messageSha256 !== sha256Buffer(source.explicitAuthorizationQuote)
  ) {
    fail('H3_USER_AUTHORIZATION_EVIDENCE_INVALID', '付费授权原始证据未绑定 task/金额/外部原话。');
  }
  const external = assertExternalAnchor({
    ...source,
    explicitAcceptanceQuote: source.explicitAuthorizationQuote,
    sourceMessageSha256: source.messageSha256,
  }, 'runninghub-paid-authorization', 'H3_PAID_AUTHORIZATION_EXTERNAL_ANCHOR_INVALID');
  if (
    external.entry.authorizationId !== body.authorizationId ||
    external.entry.nonce !== body.nonce ||
    external.entry.operation !== body.operation ||
    external.entry.currency !== 'CNY' ||
    !sameNumber(external.entry.exactCostCny, body.exactCostCny) ||
    external.entry.requestBindingSha256 !== stableJsonSha256V2(body.requestBinding) ||
    external.entry.expiresAt !== body.expiresAt
  ) {
    fail('H3_PAID_AUTHORIZATION_EXTERNAL_ANCHOR_BINDING_INVALID', '付费授权外部锚点未绑定 authorizationId、nonce、operation、金额、请求与有效期。');
  }
  return {authorization, evidence};
};

const validateTransportAttestation = ({reference, binding}) => {
  const attestation = readBoundJson(reference, 'H3 真实 transport 独立监督回执', 'H3_TRANSPORT_ATTESTATION');
  const body = attestation.body;
  if (
    body.schema !== RUNNINGHUB_H3_V2_TRANSPORT_ATTESTATION_SCHEMA ||
    body.evidenceScope !== 'real-e2e' ||
    body.decision !== 'accepted-authentic-provider-transport' ||
    body.reviewerKind !== 'independent-supervisor' ||
    !isText(body.executionGroupId) ||
    !isText(body.issuerGroupId) ||
    body.executionGroupId === body.issuerGroupId ||
    !isText(body.sourceThreadId) ||
    !isText(body.sourceMessageId) ||
    !isText(body.explicitAcceptanceQuote) ||
    body.sourceMessageSha256 !== sha256Buffer(body.explicitAcceptanceQuote) ||
    stableJsonSha256V2(body.transportBinding) !== stableJsonSha256V2(binding)
  ) {
    fail('H3_TRANSPORT_ATTESTATION_CONTENT_INVALID', 'transport 回执必须由非执行组监督者绑定当前 upload/request/task/query/result/download 与成片。');
  }
  assertExternalAnchor(body, 'runninghub-h3-transport-attestation', 'H3_TRANSPORT_ATTESTATION_EXTERNAL_ANCHOR_INVALID');
  return attestation;
};

const validateRunningHubEvidenceChainInternal = ({context, shotId, evidence, videoPath, videoSha256}, {requireExternalAuthorizations}) => {
  if (!isObject(evidence)) fail('EVIDENCE_REQUIRED', 'RunningHub 产物必须绑定完整离线证据链。');
  for (const field of ['approvedStill', 'uploadReceipt', 'requestDefinition', 'taskReceipt', 'queryReceipt', 'resultReceipt', 'downloadReceipt']) {
    if (!isObject(evidence[field])) fail('EVIDENCE_CHAIN_INCOMPLETE', `证据链缺少 ${field}。`);
  }
  const shot = context?.plan?.shots?.find((item) => item.id === shotId);
  const shotEvidence = context?.shotEvidence?.get(shotId);
  if (!shot || !shotEvidence) fail('QA_SHOT_NOT_FOUND', `计划中不存在镜头 ${String(shotId)}。`);

  const approved = assertFileReferenceV2(evidence.approvedStill, {label: '用户批准完成态静帧', pathCode: 'APPROVED_STILL_REQUIRED', shaCode: 'APPROVED_STILL_SHA_MISMATCH'});
  if (approved.absolutePath !== shotEvidence.still.absolutePath || approved.sha256 !== shotEvidence.still.sha256) {
    fail('APPROVED_STILL_PLAN_BINDING_MISMATCH', 'QA 静帧不是当前 plan/shot 批准的静帧。');
  }
  const upload = readBoundJson(evidence.uploadReceipt, '静帧上传回执', 'UPLOAD_RECEIPT');
  if (upload.absolutePath !== shotEvidence.uploadReceipt.absolutePath || upload.sha256 !== shotEvidence.uploadReceipt.sha256) {
    fail('UPLOAD_RECEIPT_PLAN_BINDING_MISMATCH', 'QA 上传回执不属于当前 plan/shot。');
  }
  validateApprovedStillUploadReceiptV1({
    receipt: upload.body,
    planId: context.plan.planId,
    shotId,
    source: {path: approved.relativePath, sha256: approved.sha256, width: shotEvidence.still.width, height: shotEvidence.still.height},
  });
  if (upload.body.transportBindingSha256 !== computeApprovedStillUploadTransportBindingSha256V1({
    receipt: upload.body,
    authorizationSha256: upload.body.authorization.sha256,
  })) {
    fail('H3_UPLOAD_TRANSPORT_BINDING_MISMATCH', '上传回执未绑定 endpoint、plan/shot、批准静帧、外部授权与原始响应。');
  }
  if (requireExternalAuthorizations) {
    const uploadAuthorization = validateNetworkAuthorization({
      reference: upload.body.authorization,
      operation: 'still-upload',
      binding: {
        planId: context.plan.planId,
        shotId,
        sourcePath: approved.relativePath,
        sourceSha256: approved.sha256,
        sourceDimensions: {width: shotEvidence.still.width, height: shotEvidence.still.height},
      },
      label: 'H3 静帧上传外部联网授权',
    });
    if (upload.body.authorization.authorizationId !== uploadAuthorization.body.authorizationId) {
      fail('H3_UPLOAD_AUTHORIZATION_ID_MISMATCH', '上传回执 authorizationId 未绑定当前外部联网授权。');
    }
  }

  const compilation = compileRunningHubH3V2Shot({context, shotId});
  const request = readBoundJson(evidence.requestDefinition, 'H3 请求定义', 'H3_REQUEST');
  if (request.body.schema !== RUNNINGHUB_H3_V2_REQUEST_SCHEMA) fail('H3_REQUEST_SCHEMA_INVALID', '不接受旧 H3 wrapper/imageUrl/durationSeconds 协议。');
  validateRunningHubH3V2RequestDefinition({context, shotId, requestDefinition: request.body});

  const task = readBoundJson(evidence.taskReceipt, 'H3 task 回执', 'H3_TASK_RECEIPT');
  if (task.body.schema !== RUNNINGHUB_H3_V2_TASK_RECEIPT_SCHEMA || task.body.operation !== 'production-run') {
    fail('H3_TASK_NOT_PRODUCTION_RUN', 'QA 晋级证据只接受 production-run task 回执。');
  }
  validateRunningHubH3V2TaskReceipt({context, compilation, receipt: task.body});
  for (const [label, reference] of [['H3 task 付费授权', task.body.authorization], ['H3 task 报价回执', task.body.quoteReceipt]]) {
    assertFileReferenceV2(reference, {label, pathCode: 'H3_TASK_SUPPORTING_RECEIPT_REQUIRED', shaCode: 'H3_TASK_SUPPORTING_RECEIPT_SHA_MISMATCH'});
  }
  if (requireExternalAuthorizations) {
    validatePaidTaskAuthorization({reference: task.body.authorization, taskBody: task.body});
  }
  const query = readBoundJson(evidence.queryReceipt, 'H3 query 回执', 'H3_QUERY_RECEIPT');
  if (query.body.schema !== RUNNINGHUB_H3_V2_QUERY_RECEIPT_SCHEMA) fail('H3_QUERY_RECEIPT_SCHEMA_INVALID', 'H3 query 回执 schema 不正确。');
  validateRunningHubH3V2QueryReceipt({receipt: query.body, taskReceipt: task.body, taskReceiptSha256: task.sha256});
  assertFileReferenceV2(query.body.authorization, {
    label: 'H3 query 外部联网授权',
    pathCode: 'H3_QUERY_AUTHORIZATION_REQUIRED',
    shaCode: 'H3_QUERY_AUTHORIZATION_SHA_MISMATCH',
  });
  if (requireExternalAuthorizations) {
    validateNetworkAuthorization({
      reference: query.body.authorization,
      operation: 'task-query',
      binding: {
        planId: context.plan.planId,
        shotId,
        taskId: task.body.taskId,
        taskReceiptSha256: task.sha256,
        requestBodySha256: query.body.requestBodySha256,
      },
      label: 'H3 query 外部联网授权',
    });
  }
  if (query.body.providerResponse?.status !== 'SUCCESS') fail('H3_QUERY_NOT_SUCCESS', 'query 必须是 SUCCESS 才能进入 QA。');
  const mp4Results = query.body.providerResponse.results.filter((item) => String(item.outputType).toLowerCase() === 'mp4');
  if (mp4Results.length !== 1 || query.body.providerResponse.results.length !== 1) {
    fail('H3_QUERY_MP4_RESULT_NOT_UNIQUE', 'QA 只接受官方 outputType=mp4 且唯一的视频结果。');
  }

  const result = readBoundJson(evidence.resultReceipt, 'H3 result 回执', 'H3_RESULT_RECEIPT');
  if (result.body.schema !== RUNNINGHUB_H3_V2_RESULT_RECEIPT_SCHEMA) fail('H3_RESULT_RECEIPT_SCHEMA_INVALID', 'H3 result 回执 schema 不正确。');
  validateRunningHubH3V2ResultReceipt({receipt: result.body, taskReceipt: task.body, taskReceiptSha256: task.sha256, queryReceipt: query.body, queryReceiptSha256: query.sha256});

  const download = readBoundJson(evidence.downloadReceipt, 'H3 download 回执', 'H3_DOWNLOAD_RECEIPT');
  if (download.body.schema !== RUNNINGHUB_H3_V2_DOWNLOAD_RECEIPT_SCHEMA) fail('H3_DOWNLOAD_RECEIPT_SCHEMA_INVALID', 'H3 download 回执 schema 不正确。');
  validateRunningHubH3V2DownloadReceipt({
    receipt: download.body,
    resultReceipt: result.body,
    resultReceiptSha256: result.sha256,
    taskReceipt: task.body,
    taskReceiptSha256: task.sha256,
    queryReceipt: query.body,
    queryReceiptSha256: query.sha256,
    checkFile: true,
  });
  assertFileReferenceV2(download.body.authorization, {
    label: 'H3 download 外部联网授权',
    pathCode: 'H3_DOWNLOAD_AUTHORIZATION_REQUIRED',
    shaCode: 'H3_DOWNLOAD_AUTHORIZATION_SHA_MISMATCH',
  });
  if (requireExternalAuthorizations) {
    validateNetworkAuthorization({
      reference: download.body.authorization,
      operation: 'result-download',
      binding: {
        taskId: result.body.taskId,
        planId: context.plan.planId,
        shotId,
        taskReceiptSha256: task.sha256,
        queryReceiptSha256: query.sha256,
        resultReceiptSha256: result.sha256,
        resultBindingSha256: result.body.resultBindingSha256,
        remoteUrl: result.body.resultUrl,
        outputPath: download.body.outputPath,
      },
      label: 'H3 download 外部联网授权',
    });
  }
  const downloaded = assertFileReferenceV2({path: download.body.outputPath, sha256: download.body.outputSha256}, {
    label: 'H3 下载成片', pathCode: 'H3_DOWNLOAD_OUTPUT_REQUIRED', shaCode: 'H3_DOWNLOAD_OUTPUT_SHA_MISMATCH',
  });
  if (downloaded.absolutePath !== videoPath || download.body.outputSha256 !== videoSha256 || download.body.outputBytes !== readFileSync(videoPath).length) {
    fail('H3_DOWNLOAD_CURRENT_VIDEO_MISMATCH', 'download 回执的路径、SHA、字节必须同时等于当前 QA 视频。');
  }
  const transportBinding = {
    planId: context.plan.planId,
    shotId,
    approvedStillSha256: approved.sha256,
    uploadReceiptSha256: upload.sha256,
    requestDefinitionSha256: request.sha256,
    taskReceiptSha256: task.sha256,
    queryReceiptSha256: query.sha256,
    resultReceiptSha256: result.sha256,
    downloadReceiptSha256: download.sha256,
    outputSha256: videoSha256,
    outputBytes: readFileSync(videoPath).length,
  };
  const transportAttestation = requireExternalAuthorizations
    ? validateTransportAttestation({reference: evidence.transportAttestation, binding: transportBinding})
    : null;
  return {
    status: requireExternalAuthorizations
      ? 'provider-chain-externally-attested-awaiting-machine-qa'
      : 'provider-receipt-shapes-validated-diagnostic-only',
    technicalQaPassed: false,
    promotionEligibleEvidence: false,
    transportAuthenticity: requireExternalAuthorizations ? 'independent-supervision-anchor-validated' : 'unverified-structure-only',
    requestedDurationSeconds: compilation.payload.duration,
    bindings: {
      approvedStill: {path: approved.relativePath, sha256: approved.sha256},
      uploadReceipt: referenceSummary(upload),
      requestDefinition: referenceSummary(request),
      taskReceipt: referenceSummary(task),
      queryReceipt: referenceSummary(query),
      resultReceipt: referenceSummary(result),
      downloadReceipt: referenceSummary(download),
      transportAttestation: transportAttestation ? referenceSummary(transportAttestation) : null,
      transportBindingSha256: stableJsonSha256V2(transportBinding),
      requestDefinitionSha256: compilation.requestDefinitionSha256,
      payloadSha256: compilation.payloadSha256,
      taskIdSha256: sha256Buffer(task.body.taskId),
      outputSha256: videoSha256,
    },
  };
};

export const validateOfficialRunningHubProviderReceiptShapesV2 = (options) =>
  validateRunningHubEvidenceChainInternal(options, {requireExternalAuthorizations: false});

export const validateOfficialRunningHubEvidenceChainV2 = (options) =>
  validateRunningHubEvidenceChainInternal(options, {requireExternalAuthorizations: true});

const assertQaFreezeClosure = (preflight) => {
  const closure = Array.isArray(preflight?.gateClosureFiles) ? preflight.gateClosureFiles : [];
  const required = QA_FREEZE_CLOSURE_REQUIRED_PATHS.map((requiredPath) => {
    const entry = closure.find((item) => item?.path === requiredPath);
    if (!entry) fail('QA_FREEZE_CLOSURE_INCOMPLETE', `生产冻结闭包未绑定 ${requiredPath}。`);
    const actual = assertFileReferenceV2(
      {path: requiredPath, sha256: entry.sha256},
      {label: `QA 冻结闭包 ${requiredPath}`, pathCode: 'QA_FREEZE_CLOSURE_FILE_REQUIRED', shaCode: 'QA_FREEZE_CLOSURE_SHA_MISMATCH'},
    );
    return {path: actual.relativePath, sha256: actual.sha256};
  });
  return {files: required, sha256: stableJsonSha256V2(required)};
};

const validateProductionBinding = ({request, context, videoFile, videoSha256}) => {
  const binding = request.productionBinding;
  if (!isObject(binding)) fail('QA_PRODUCTION_BINDING_REQUIRED', 'productionBinding 缺失。');
  const job = readBoundJson(binding.job, '生产 job', 'QA_JOB');
  if (job.body.inputs?.generatedVideoPlan !== context.plan.planPath) fail('QA_JOB_PLAN_BINDING_MISMATCH', '生产 job.inputs.generatedVideoPlan 未绑定当前 plan。');
  const preflight = assertProductionEntryPreflightV2({projectRoot, jobPath: job.absolutePath, job: job.body, command: PRODUCTION_QA_COMMAND, entrypoint: PRODUCTION_QA_ENTRYPOINT});
  const qaFreezeClosure = assertQaFreezeClosure(preflight);
  const gate = job.body.productionGate;
  const director = assertSameReference(binding.directorContract, gate.directorContract, '导演合同');
  const handoff = assertSameReference(binding.handoffReceipt, gate.handoffReceipt, '导演交接回执');
  const freeze = assertSameReference(binding.freezeReceipt, gate.freezeReceipt, '冻结/解冻回执');
  const expectedCompositionPath = `${String(job.body.remotion?.root ?? '').replace(/\/$/u, '')}/${String(job.body.remotion?.entry ?? '').replace(/^\//u, '')}`;
  const composition = assertFileReferenceV2(binding.composition, {label: 'Remotion composition 入口', pathCode: 'QA_COMPOSITION_BINDING_REQUIRED', shaCode: 'QA_COMPOSITION_BINDING_SHA_MISMATCH'});
  if (resolveProjectFileV2(expectedCompositionPath, 'Remotion composition 入口') !== composition.absolutePath) fail('QA_COMPOSITION_BINDING_MISMATCH', 'QA composition 未绑定当前 job.remotion.entry。');
  const compositionBindingSha256 = stableJsonSha256ForProductionGateV2(computeProductionCompositionBindingV2(job.body));
  const expected = {
    jobFileSha256: job.sha256,
    jobSnapshotSha256: preflight.jobSnapshotSha256,
    directorContractSha256: director.sha256,
    handoffReceiptSha256: handoff.sha256,
    handoffBindingSha256: preflight.handoffBindingSha256,
    freezeReceiptSha256: freeze.sha256,
    boundFilesSha256: preflight.boundFilesSha256,
    gateClosureSha256: preflight.gateClosureSha256,
    qaFreezeClosureSha256: qaFreezeClosure.sha256,
    planFileSha256: context.planFileSha256,
    planDefinitionSha256: context.planDefinitionSha256,
    styleSha256: context.styleSha256,
    compositionSha256: composition.sha256,
    compositionBindingSha256,
    mediaSha256: videoSha256,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (binding[field] !== value) fail('QA_PRODUCTION_BINDING_MISMATCH', `productionBinding.${field} 未绑定当前真实文件。`);
  }
  const qaBindingPayload = {...expected, shotId: request.shotId, videoPath: videoFile.relativePath};
  const qaBindingSha256 = stableJsonSha256V2(qaBindingPayload);
  if (binding.qaBindingSha256 !== qaBindingSha256) fail('QA_BINDING_SHA_MISMATCH', 'qaBindingSha256 未绑定 job/director/handoff/freeze/plan/composition/media。');
  return {preflight, qaFreezeClosure, qaBindingPayload, qaBindingSha256};
};

const preflightPromotionRequest = (request, requestPath) => {
  if (!isObject(request) || request.schemaVersion !== GENERATED_VIDEO_V2_QA_REQUEST_SCHEMA) fail('QA_REQUEST_SCHEMA_INVALID', `schemaVersion 必须为 ${GENERATED_VIDEO_V2_QA_REQUEST_SCHEMA}。`);
  if (request.provenance?.kind !== 'runninghub-h3-output' || request.intent !== 'promotion-evidence') fail('QA_PROMOTION_INTENT_REQUIRED', 'QA v2 只处理 RunningHub H3 production promotion-evidence。');
  if (request.thresholds !== undefined) fail('QA_THRESHOLD_OVERRIDE_FORBIDDEN', 'QA 阈值只能从已晋级风格卡派生，请求不得重写。');
  const videoFile = assertFileReferenceV2(request.video, {label: '当前 QA 视频', pathCode: 'QA_REQUEST_VIDEO_REQUIRED', shaCode: 'VIDEO_SHA256_MISMATCH'});
  const videoSha256 = videoFile.sha256;
  if (videoSha256 === REJECTED_ACCIDENT_OUTPUT_SHA256) fail('RETIRED_REJECTED_OUTPUT_SHA', '当前 QA 视频命中事故否决成片 SHA-256。');
  assertNoRetiredGeneratedStyle({value: {request, video: videoFile.relativePath}, operation: 'generated-video-production-qa', location: '$.qaV2', projectRoot, documentPaths: [videoFile.absolutePath]});
  const planFile = assertFileReferenceV2(request.plan, {label: 'generated-video-plan/v2', pathCode: 'QA_PLAN_REQUIRED', shaCode: 'QA_PLAN_SHA_MISMATCH'});
  const context = loadGeneratedVideoPlanV2(planFile.absolutePath);
  if (context.planFileSha256 !== planFile.sha256) fail('QA_PLAN_SHA_MISMATCH', 'QA plan SHA 与真实 plan 不一致。');
  assertGeneratedVideoPlanV2ProductionEligible(context);
  const shot = context.plan.shots.find((item) => item.id === request.shotId);
  if (!shot) fail('QA_SHOT_NOT_FOUND', `plan 中不存在镜头 ${String(request.shotId)}。`);
  const expectations = validateExpectations(request.expectations, {durationSeconds: shot.durationSeconds});
  const thresholds = profileThresholds(context.style);
  if (expectations.expectedBoundariesSeconds.length < thresholds.minimumBoundaryCount) fail('QA_BOUNDARY_EXPECTATION_REQUIRED', '计划边界数低于风格卡装配步数下限。');
  const production = validateProductionBinding({request, context, videoFile, videoSha256});
  const evidence = validateOfficialRunningHubEvidenceChainV2({context, shotId: request.shotId, evidence: request.evidence, videoPath: videoFile.absolutePath, videoSha256});
  if (evidence.requestedDurationSeconds !== expectations.expectedDurationSeconds) fail('H3_REQUEST_EXPECTED_DURATION_MISMATCH', 'QA 时长必须同时等于 plan shot 与 H3 request duration。');
  return {requestPath, context, shot, videoFile, videoSha256, expectations, thresholds, production, evidence};
};

const longestDuration = (runs) => runs.reduce((maximum, run) => Math.max(maximum, run.durationSeconds), 0);
const qaFailure = (code, message, details = null) => ({code, message, details});
const compareReferenceMotion = (madSummary) => {
  const baseline = validateReferenceMotionBaselineReceiptV2();
  const meanRatio = Number(madSummary.mean) / baseline.measurements.meanMadRgb;
  const p90Ratio = Number(madSummary.p90) / baseline.measurements.p90MadRgb;
  return {
    algorithm: baseline.algorithm,
    candidate: {meanMadRgb: Number(madSummary.mean), p90MadRgb: Number(madSummary.p90)},
    reference: {
      receiptId: baseline.receiptId,
      receiptSha256: baseline.receiptSha256,
      evidenceScope: baseline.evidenceScope,
      media: baseline.referenceMedia,
      algorithm: baseline.algorithm,
      verifiedImplementation: baseline.verifiedImplementation,
      entropyMean: baseline.measurements.entropyMean,
      edgeStrengthMean: baseline.measurements.edgeStrengthMean,
      meanMadRgb: baseline.measurements.meanMadRgb,
      p90MadRgb: baseline.measurements.p90MadRgb,
    },
    ratios: {mean: meanRatio, p90: p90Ratio},
    materialGapRatio: REFERENCE_MOTION_MATERIAL_GAP_RATIO_V2,
    materiallyBelowReference:
      meanRatio < REFERENCE_MOTION_MATERIAL_GAP_RATIO_V2 ||
      p90Ratio < REFERENCE_MOTION_MATERIAL_GAP_RATIO_V2,
    boundary: baseline.boundary,
  };
};
const writeFrameMetricsCsv = (filePath, rows) => {
  const lines = ['frame,time_s,luma_mean,entropy,edge_strength,mad_prev,frame_sha256', ...rows.map((row) => [
    row.frame, row.timeSeconds.toFixed(6), row.lumaMean.toFixed(9), row.entropy.toFixed(9), row.edgeStrength.toFixed(9), row.madPrev.toFixed(9), row.frameSha256,
  ].join(','))];
  writeFileSync(filePath, `${lines.join('\n')}\n`);
};
const humanReviewChecklist = ({machineQaPassed = false} = {}) => ({
  status: machineQaPassed ? 'pending-human-review' : 'blocked-not-requested',
  userReviewEligible: machineQaPassed,
  machineDecisionProhibited: true,
  items: [
    {id: 'logo-and-brand-boundary', decision: machineQaPassed ? 'pending' : 'blocked'},
    {id: 'fake-ui-and-misleading-evidence', decision: machineQaPassed ? 'pending' : 'blocked'},
    {id: 'action-causality', decision: machineQaPassed ? 'pending' : 'blocked'},
    {id: 'object-consistency', decision: machineQaPassed ? 'pending' : 'blocked'},
    {id: 'normal-speed-full-watch', decision: machineQaPassed ? 'pending' : 'blocked'},
  ],
  boundary: machineQaPassed
    ? '机器通过不等于风格通过，必须正常速度完整观看。'
    : '机器门未过时不占用用户风格验收，先返工。',
});

const analyzeMedia = async ({videoPath, expectations, thresholds, artifactsDirectory, ffmpegBin, ffprobeBin, tesseractBin}) => {
  if (existsSync(artifactsDirectory) && readdirSync(artifactsDirectory).length > 0) fail('ARTIFACTS_NOT_EMPTY', `QA 产物目录必须为空：${artifactsDirectory}`);
  mkdirSync(artifactsDirectory, {recursive: true});
  const probe = probeVideoV2({videoPath, ffprobeBin});
  atomicWriteJson(path.join(artifactsDirectory, 'ffprobe.json'), probe.raw);
  const frameTimeline = probeVideoFrameTimelineV2({videoPath, ffprobeBin});
  atomicWriteJson(path.join(artifactsDirectory, 'frame-timeline.json'), frameTimeline);
  const decode = decodeVideoFullyV2({videoPath, ffmpegBin});
  const metrics = await analyzeDecodedFramesV2({videoPath, fps: probe.fps, ffmpegBin, freezeMadThreshold: thresholds.freezeMadThreshold, boundaryMadThreshold: thresholds.boundaryMadThreshold, boundaryNmsSeconds: thresholds.boundaryNmsSeconds});
  const detector = runFfmpegDetectorsV2({videoPath, ffmpegBin, blackMinimumSeconds: Math.max(0.05, thresholds.maxBlackRunSeconds), freezeMinimumSeconds: Math.max(0.1, thresholds.maxFreezeRunSeconds)});
  const referenceMotionComparison = compareReferenceMotion(metrics.summary.madPrev);
  writeFrameMetricsCsv(path.join(artifactsDirectory, 'frame-metrics.csv'), metrics.rows);
  atomicWriteJson(path.join(artifactsDirectory, 'ffmpeg-detectors.json'), detector);
  const ocr = runOcr({videoPath, expectedTextList: expectations.expectedTextList, artifactsDirectory, ffmpegBin, tesseractBin, sampleIntervalSeconds: thresholds.ocrSampleIntervalSeconds});
  atomicWriteJson(path.join(artifactsDirectory, 'ocr-results.json'), ocr);

  const errors = [];
  if (probe.audioStreamCount !== expectations.expectedAudioTracks) errors.push(qaFailure('AUDIO_TRACK_COUNT_MISMATCH', '实际音轨数与锁定期望不一致。'));
  if (Math.abs(probe.durationSeconds - expectations.expectedDurationSeconds) > thresholds.durationToleranceSeconds) errors.push(qaFailure('VIDEO_DURATION_MISMATCH', '视频实际时长与 plan/H3 请求不一致。'));
  if (probe.width !== expectations.width) errors.push(qaFailure('VIDEO_WIDTH_MISMATCH', '视频宽度不一致。'));
  if (probe.height !== expectations.height) errors.push(qaFailure('VIDEO_HEIGHT_MISMATCH', '视频高度不一致。'));
  if (Math.abs(probe.fps - expectations.fps) > 0.01) errors.push(qaFailure('VIDEO_FPS_MISMATCH', '视频帧率不一致。'));
  if (!frameTimeline.monotonic) errors.push(qaFailure('VIDEO_PTS_NON_MONOTONIC', '逐帧 PTS 不严格单调。'));
  const expectedFrameCount = Math.round(expectations.expectedDurationSeconds * expectations.fps);
  if (metrics.frameCount !== frameTimeline.frameCount) errors.push(qaFailure('DECODE_FRAME_COVERAGE_MISMATCH', '逐帧解码数与 PTS 时间轴不一致。'));
  if (probe.declaredFrameCount !== null && metrics.frameCount !== probe.declaredFrameCount) errors.push(qaFailure('DECLARED_FRAME_COVERAGE_MISMATCH', '逐帧解码数与 nb_frames 不一致。'));
  if (Math.abs(metrics.frameCount - expectedFrameCount) > thresholds.frameCountTolerance) errors.push(qaFailure('EXPECTED_FRAME_COUNT_MISMATCH', '逐帧数与时长×帧率不一致。'));
  if (longestDuration(metrics.blackRuns) > thresholds.maxBlackRunSeconds) errors.push(qaFailure('BLACK_RUN_EXCEEDED', '检测到超限黑场。'));
  if (longestDuration(metrics.whiteRuns) > thresholds.maxWhiteRunSeconds) errors.push(qaFailure('WHITE_RUN_EXCEEDED', '检测到超限白场。'));
  if (longestDuration(metrics.freezeRuns) > thresholds.maxFreezeRunSeconds) errors.push(qaFailure('FREEZE_RUN_EXCEEDED', '检测到超限冻结。'));
  if (longestDuration(metrics.exactDuplicateRuns) > thresholds.maxExactDuplicateRunSeconds) errors.push(qaFailure('EXACT_DUPLICATE_RUN_EXCEEDED', '连续精确重复帧超限。'));
  const repeatedFrameRatio = metrics.exactFrameHashes.repeatedFrameCount / metrics.frameCount;
  if (repeatedFrameRatio > thresholds.maxRepeatedFrameRatio) errors.push(qaFailure('NONCONTIGUOUS_REPEAT_RATIO_EXCEEDED', '非连续重复帧比例超限。'));
  if (metrics.summary.entropy.median < thresholds.minimumMedianEntropy) errors.push(qaFailure('ENTROPY_TOO_LOW', '灰度熵中位数低于风格下限。'));
  if (metrics.summary.edgeStrength.median < thresholds.minimumMedianEdgeStrength) errors.push(qaFailure('EDGE_STRENGTH_TOO_LOW', '边缘强度中位数低于风格下限。'));
  if (referenceMotionComparison.materiallyBelowReference) {
    errors.push(qaFailure('REFERENCE_MOTION_MATERIAL_GAP', '同算法 mean/P90 RGB MAD 与参考片存在明显动态差距，只能保持 blocked。', referenceMotionComparison));
  }
  if (metrics.boundaries.length < thresholds.minimumBoundaryCount) errors.push(qaFailure('BOUNDARY_COUNT_TOO_LOW', '实测边界数低于装配下限。'));
  const missingBoundaries = expectations.expectedBoundariesSeconds.filter((expected) => !metrics.boundaries.some((boundary) => Math.abs(boundary.timeSeconds - expected) <= thresholds.boundaryToleranceSeconds));
  if (missingBoundaries.length) errors.push(qaFailure('EXPECTED_BOUNDARY_MISSING', '计划边界未在容差内检出。', {missingBoundaries}));
  if (ocr.missing.length) errors.push(qaFailure('OCR_EXPECTED_TEXT_MISSING', 'OCR 未在时窗内识别全部计划文字。', {missing: ocr.missing}));
  const artifactNames = ['ffprobe.json', 'frame-timeline.json', 'frame-metrics.csv', 'ffmpeg-detectors.json', 'ocr-results.json'];
  return {
    errors,
    checks: {
      ffprobe: {status: 'passed', exitCode: 0},
      fullDecode: decode,
      frameCoverage: {
        status: frameTimeline.monotonic && metrics.frameCount === frameTimeline.frameCount &&
          (probe.declaredFrameCount === null || metrics.frameCount === probe.declaredFrameCount) &&
          Math.abs(metrics.frameCount - expectedFrameCount) <= thresholds.frameCountTolerance ? 'passed' : 'failed',
        decodedFrames: metrics.frameCount,
        declaredFrames: probe.declaredFrameCount,
        timelineFrames: frameTimeline.frameCount,
        expectedFrames: expectedFrameCount,
        ptsMonotonic: frameTimeline.monotonic,
      },
      ffmpegDetectors: detector,
      ocr,
    },
    probe,
    metrics: {
      algorithm: metrics.algorithm,
      frameCount: metrics.frameCount,
      summary: metrics.summary,
      referenceMotionComparison,
      blackRuns: metrics.blackRuns,
      whiteRuns: metrics.whiteRuns,
      freezeRuns: metrics.freezeRuns,
      exactDuplicateRuns: metrics.exactDuplicateRuns,
      exactFrameHashes: metrics.exactFrameHashes,
      boundaries: metrics.boundaries,
    },
    artifacts: artifactNames.map((name) => {
      const filePath = path.join(artifactsDirectory, name);
      return {name, path: relativeProjectPath(filePath), sha256: sha256FileForQaV2(filePath)};
    }),
  };
};

export const runLockedMediaDiagnosticsForGeneratedVideoV2 = async ({videoPath, expectations, ffmpegBin = 'ffmpeg', ffprobeBin = 'ffprobe', tesseractBin = 'tesseract'}) => {
  const video = resolveProjectFileV2(videoPath, '诊断视频');
  const validatedExpectations = validateExpectations(expectations);
  const artifactRoot = mkdtempSync(path.join(tmpdir(), 'koubo-generated-video-v2-diagnostic-'));
  try {
    const media = await analyzeMedia({videoPath: video, expectations: validatedExpectations, thresholds: LOCKED_DIAGNOSTIC_THRESHOLDS_V2, artifactsDirectory: artifactRoot, ffmpegBin, ffprobeBin, tesseractBin});
    const transientArtifacts = media.artifacts.map(({name, sha256}) => ({name, sha256, storage: 'transient-removed'}));
    const ocr = {
      ...media.checks.ocr,
      samples: media.checks.ocr.samples.map(({framePath: _framePath, ...sample}) => ({...sample, storage: 'transient-frame-removed'})),
    };
    return {
      ...media,
      checks: {...media.checks, ocr},
      artifacts: transientArtifacts,
      status: media.errors.length ? 'diagnostic-failed' : 'diagnostic-passed',
      technicalQaPassed: false,
      promotionEligibleEvidence: false,
      userReviewEligible: false,
      styleReviewDisposition: media.metrics.referenceMotionComparison.materiallyBelowReference
        ? 'candidate-blocked-reference-motion-gap'
        : 'diagnostic-only-not-a-style-candidate',
      persisted: false,
      boundary: '此函数只用于 read-only 媒体算法回归；临时 OCR/指标文件返回前已删除，永远不产生晋级证据。',
    };
  } finally {
    rmSync(artifactRoot, {recursive: true, force: true});
  }
};

const normalizeError = (error) => ({code: error?.code ?? 'UNEXPECTED', message: error instanceof Error ? error.message : String(error), details: error?.details ?? null});

export const runGeneratedVideoV2Qa = async ({requestPath, outputPath, artifactsDirectory = null, ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg', ffprobeBin = process.env.FFPROBE_BIN || 'ffprobe', tesseractBin = process.env.TESSERACT_BIN || 'tesseract'}) => {
  const startedAt = new Date().toISOString();
  let validated;
  let absoluteRequestPath;
  let absoluteOutputPath;
  let artifactRoot;
  try {
    absoluteRequestPath = resolveProjectFileV2(requestPath, 'v2 QA 请求');
    const request = JSON.parse(readFileSync(absoluteRequestPath, 'utf8'));
    validated = preflightPromotionRequest(request, absoluteRequestPath);
    absoluteOutputPath = resolveProjectTarget(outputPath, 'QA 回执');
    artifactRoot = resolveProjectTarget(artifactsDirectory ?? path.join(path.dirname(absoluteOutputPath), `qa-artifacts-${validated.videoSha256.slice(0, 12)}`), 'QA 产物目录');
    if (existsSync(absoluteOutputPath)) fail('QA_OUTPUT_ALREADY_EXISTS', 'QA 回执已存在，禁止覆盖。');
    if (existsSync(artifactRoot) && readdirSync(artifactRoot).length > 0) fail('ARTIFACTS_NOT_EMPTY', 'QA 产物目录必须为空。');
  } catch (error) {
    return {
      exitCode: 1,
      persisted: false,
      receipt: null,
      error: normalizeError(error),
      outputPath: outputPath ?? null,
      artifactsDirectory: artifactsDirectory ?? null,
      boundary: '生产资格/证据/退役门在任何 QA 产物或回执写入前失败；未创建伪失败回执。',
    };
  }
  try {
    const media = await analyzeMedia({videoPath: validated.videoFile.absolutePath, expectations: validated.expectations, thresholds: validated.thresholds, artifactsDirectory: artifactRoot, ffmpegBin, ffprobeBin, tesseractBin});
    const passed = media.errors.length === 0;
    const receipt = {
      schemaVersion: GENERATED_VIDEO_V2_QA_RECEIPT_SCHEMA,
      status: passed ? 'machine-passed-awaiting-human-review' : 'machine-failed',
      technicalQaPassed: passed,
      promotionEligibleEvidence: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      request: {path: relativeProjectPath(absoluteRequestPath), sha256: sha256FileForQaV2(absoluteRequestPath)},
      plan: {path: relativeProjectPath(validated.context.planPath), sha256: validated.context.planFileSha256, definitionSha256: validated.context.planDefinitionSha256, executionMode: validated.context.plan.executionMode, shotId: validated.shot.id},
      style: {path: relativeProjectPath(validated.context.stylePath), sha256: validated.context.styleSha256, productionEligible: validated.context.style.productionEligible},
      video: {path: validated.videoFile.relativePath, sha256: validated.videoSha256},
      productionBinding: {qaBindingPayload: validated.production.qaBindingPayload, qaBindingSha256: validated.production.qaBindingSha256, preflight: validated.production.preflight},
      providerEvidence: validated.evidence,
      expectations: validated.expectations,
      thresholds: validated.thresholds,
      ...media,
      humanReview: humanReviewChecklist({machineQaPassed: passed}),
      boundary: passed
        ? '只完成生产链绑定后的机器 QA；仍必须正常速度完整观看，不得自动标记 verified/promoted/production-ready。'
        : '机器 QA 未通过，technicalQaPassed=false，promotionEligibleEvidence 恒为 false。',
    };
    atomicWriteJson(absoluteOutputPath, receipt);
    return {exitCode: passed ? 0 : 1, persisted: true, receipt, error: null};
  } catch (error) {
    const receipt = {
      schemaVersion: GENERATED_VIDEO_V2_QA_RECEIPT_SCHEMA,
      status: 'machine-failed',
      technicalQaPassed: false,
      promotionEligibleEvidence: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      request: {path: relativeProjectPath(absoluteRequestPath), sha256: sha256FileForQaV2(absoluteRequestPath)},
      video: {path: validated.videoFile.relativePath, sha256: validated.videoSha256},
      errors: [normalizeError(error)],
      humanReview: humanReviewChecklist({machineQaPassed: false}),
      boundary: '生产资格预检已通过，但媒体 QA 执行失败；不得晋级。',
    };
    atomicWriteJson(absoluteOutputPath, receipt);
    return {exitCode: 1, persisted: true, receipt, error: receipt.errors[0]};
  }
};

const parseArguments = (argv) => {
  const result = {requestPath: null, outputPath: null, artifactsDirectory: null};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--request') result.requestPath = argv[++index];
    else if (argument === '--output') result.outputPath = argv[++index];
    else if (argument === '--artifacts') result.artifactsDirectory = argv[++index];
    else if (argument === '--help') result.help = true;
    else fail('CLI_ARGUMENT_UNKNOWN', `未知参数：${argument}`);
  }
  return result;
};
const usage = () => [
  '用法：',
  '  node tools/qa-generated-video-v2.mjs --request <QA请求.json> --output <QA回执.json> [--artifacts <空目录>]',
  '',
  '退出码：0=机器QA通过且等待人工验收；1=QA失败；2=命令参数错误。',
  '资格/证据/退役预检失败时不写任何回执或产物；本脚本不联网。',
].join('\n');

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  let args;
  try {
    args = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`[${error.code ?? 'CLI_ARGUMENT_INVALID'}] ${error.message}`);
    console.error(usage());
    process.exitCode = 2;
  }
  if (args?.help) console.log(usage());
  else if (args && (!isText(args.requestPath) || !isText(args.outputPath))) {
    console.error('[CLI_ARGUMENT_REQUIRED] --request 与 --output 均为必填。');
    console.error(usage());
    process.exitCode = 2;
  } else if (args) {
    const result = await runGeneratedVideoV2Qa(args);
    if (result.error) console.error(`[${result.error.code}] ${result.error.message}`);
    else console.log(JSON.stringify({status: result.receipt.status, receipt: relativeProjectPath(resolveProjectTarget(args.outputPath, 'QA 回执'))}));
    process.exitCode = result.exitCode;
  }
}
