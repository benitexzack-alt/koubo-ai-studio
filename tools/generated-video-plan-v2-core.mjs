import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, lstatSync, readFileSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {assertNoRetiredGeneratedStyle} from './generated-style-policy.mjs';
import {validateDirectorContractV2} from '../skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs';
import {assertProductionEntryPreflightV2} from '../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';

export const GENERATED_VIDEO_PLAN_V2_SCHEMA = 'generated-video-plan/v2';
export const APPROVED_STILL_APPROVAL_SCHEMA = 'approved-still-user-approval/v2';
export const APPROVED_STILL_UPLOAD_RECEIPT_SCHEMA = 'approved-still-upload-receipt/v1';
export const RUNNINGHUB_H3_PRODUCT_ROUTE = '/minimax/hailuo-h3/multimodal-to-video';
export const generatedVideoProjectRootV2 = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const RUNNINGHUB_ASSET_HOST_PATTERN = /(^|\.)(runninghub\.cn|myqcloud\.com)$/iu;
const RETIRED_EVIDENCE_MANIFEST =
  'knowledge/evidence/paper-editorial-reference-audit-20260824/retired-v1-failure-manifest.json';
const EXTRA_RETIRED_CONTENT_SHA256 = new Set([
  'a243aa778d5b010086db34d276822bcc9d53f7a66919db589da59ef021c5d752',
  '80d80620f98487ad09aa1a9e7d3f9379f8c153d00c7cea2e76f98ca245cc5ab8',
]);

export class GeneratedVideoPlanV2Error extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'GeneratedVideoPlanV2Error';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = null) => {
  throw new GeneratedVideoPlanV2Error(code, message, details);
};
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;
const sha256Buffer = (value) => createHash('sha256').update(value).digest('hex');

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort((a, b) => a.localeCompare(b)).map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
};

export const stableJsonSha256V2 = (value) => sha256Buffer(JSON.stringify(stableValue(value)));
const normalizeProjectRelative = (absolutePath) =>
  relative(generatedVideoProjectRootV2, absolutePath).split(sep).join('/');

export const assertSha256V2 = (value, code, label) => {
  if (!SHA256_PATTERN.test(String(value ?? ''))) fail(code, `${label}必须是小写 64 位 SHA-256。`);
};
export const assertSafeIdV2 = (value, code, label) => {
  if (!SAFE_ID_PATTERN.test(String(value ?? ''))) {
    fail(code, `${label}只能使用字母、数字、点、下划线和连字符。`);
  }
};
export const assertIsoTimestampV2 = (value, code, label) => {
  if (!isText(value) || Number.isNaN(Date.parse(value))) fail(code, `${label}必须是有效 ISO 时间。`);
};

export const resolveProjectFileV2 = (filePath, label = '项目文件') => {
  if (!isText(filePath)) fail('PROJECT_PATH_REQUIRED', `${label}路径不能为空。`);
  const absolutePath = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(generatedVideoProjectRootV2, filePath);
  const relation = relative(generatedVideoProjectRootV2, absolutePath);
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    fail('PROJECT_PATH_OUTSIDE', `${label}必须位于口播项目内：${filePath}`);
  }
  let cursor = generatedVideoProjectRootV2;
  for (const segment of relation.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      fail('PROJECT_PATH_SYMLINK', `${label}路径不得经过符号链接：${filePath}`);
    }
  }
  if (!existsSync(absolutePath)) fail('PROJECT_FILE_MISSING', `${label}不存在：${filePath}`);
  if (!lstatSync(absolutePath).isFile()) fail('PROJECT_FILE_NOT_REGULAR', `${label}必须是普通文件。`);
  return absolutePath;
};

export const sha256ProjectFileV2 = (filePath, label = '项目文件') =>
  sha256Buffer(readFileSync(resolveProjectFileV2(filePath, label)));

export const assertFileReferenceV2 = (
  reference,
  {label, pathCode = 'FILE_REFERENCE_REQUIRED', shaCode = 'FILE_REFERENCE_SHA_MISMATCH'},
) => {
  if (!isObject(reference) || !isText(reference.path)) fail(pathCode, `${label}缺少项目内路径。`);
  assertSha256V2(reference.sha256, shaCode, `${label}.sha256`);
  const absolutePath = resolveProjectFileV2(reference.path, label);
  const actualSha256 = sha256Buffer(readFileSync(absolutePath));
  if (actualSha256 !== reference.sha256) fail(shaCode, `${label} SHA-256 与真实文件不一致。`);
  return {absolutePath, relativePath: normalizeProjectRelative(absolutePath), sha256: actualSha256};
};

export const readBoundProjectJsonV2 = (reference, options) => {
  const file = assertFileReferenceV2(reference, options);
  let body;
  try {
    body = JSON.parse(readFileSync(file.absolutePath, 'utf8'));
  } catch (error) {
    fail(options.jsonCode ?? 'JSON_INVALID', `${options.label}不是有效 JSON。`, {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  return {...file, body};
};

const pngDimensions = (buffer) => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(signature) && buffer.subarray(12, 16).toString('ascii') === 'IHDR') {
    return {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), format: 'png'};
  }
  return null;
};
const jpegDimensions = (buffer) => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 1 >= buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (sof.has(marker) && length >= 7) {
      return {width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3), format: 'jpeg'};
    }
    offset += length;
  }
  return null;
};

const readImageDimensions = (filePath) => {
  const buffer = readFileSync(resolveProjectFileV2(filePath, '用户批准完成态静帧'));
  const result = pngDimensions(buffer) ?? jpegDimensions(buffer);
  if (!result || !isPositiveInteger(result.width) || !isPositiveInteger(result.height)) {
    fail('STILL_IMAGE_UNSUPPORTED', '用户批准完成态静帧必须是可读取尺寸的 PNG 或 JPEG。');
  }
  return result;
};

export const assertRealMp4VideoV2 = (reference, label = '动态样片', ffprobeBin = 'ffprobe') => {
  const file = assertFileReferenceV2(reference, {
    label,
    pathCode: 'DYNAMIC_SAMPLE_REQUIRED',
    shaCode: 'DYNAMIC_SAMPLE_SHA_MISMATCH',
  });
  const result = spawnSync(
    ffprobeBin,
    ['-v', 'error', '-show_entries', 'format=format_name,duration:stream=codec_type', '-of', 'json', file.absolutePath],
    {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']},
  );
  if (result.status !== 0) fail('DYNAMIC_SAMPLE_MEDIA_INVALID', `${label}不是可解码 MP4。`);
  let probe;
  try { probe = JSON.parse(result.stdout); } catch { fail('DYNAMIC_SAMPLE_MEDIA_INVALID', `${label} ffprobe 回执无效。`); }
  const formats = String(probe.format?.format_name ?? '').split(',');
  const videoCount = (probe.streams ?? []).filter((stream) => stream.codec_type === 'video').length;
  if (!formats.some((name) => name === 'mp4' || name === 'mov') || videoCount !== 1 || !(Number(probe.format?.duration) > 0)) {
    fail('DYNAMIC_SAMPLE_MEDIA_INVALID', `${label}必须是含唯一视频流的真实 MP4。`);
  }
  return {...file, durationSeconds: Number(probe.format.duration)};
};

const readRetiredContentHashes = () => {
  const hashes = new Set(EXTRA_RETIRED_CONTENT_SHA256);
  const manifestPath = resolve(generatedVideoProjectRootV2, RETIRED_EVIDENCE_MANIFEST);
  if (!existsSync(manifestPath)) return hashes;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (SHA256_PATTERN.test(manifest.styleCardBeforeRetirement?.sha256 ?? '')) hashes.add(manifest.styleCardBeforeRetirement.sha256);
    for (const item of manifest.failedProductionEvidence ?? []) {
      if (item.kind === 'failed-generated-video' && SHA256_PATTERN.test(item.sha256 ?? '')) hashes.add(item.sha256);
    }
  } catch {
    fail('RETIRED_EVIDENCE_MANIFEST_INVALID', '退役内容证据清单不是有效 JSON。');
  }
  return hashes;
};

export const assertNoRetiredGeneratedContentShaV2 = (hashes, label = 'generated-video/v2') => {
  const retired = readRetiredContentHashes();
  const hit = hashes.find((hash) => retired.has(hash));
  if (hit) fail('RETIRED_GENERATED_CONTENT_SHA', `${label}命中退役内容 SHA-256：${hit}`);
};

const assertApprovedStill = (plan, shot, index) => {
  const still = shot.approvedStill;
  if (!isObject(still)) fail('APPROVED_STILL_REQUIRED', `shots[${index}].approvedStill 缺失。`);
  const file = assertFileReferenceV2(still, {
    label: '用户批准完成态静帧',
    pathCode: 'APPROVED_STILL_REQUIRED',
    shaCode: 'APPROVED_STILL_SHA_MISMATCH',
  });
  const dimensions = readImageDimensions(still.path);
  if (still.width !== dimensions.width || still.height !== dimensions.height) {
    fail('APPROVED_STILL_DIMENSIONS_MISMATCH', '批准静帧声明尺寸与真实图片不一致。');
  }
  const approval = readBoundProjectJsonV2(still.approvalReceipt, {
    label: '完成态静帧用户批准回执',
    pathCode: 'STILL_APPROVAL_RECEIPT_REQUIRED',
    shaCode: 'STILL_APPROVAL_RECEIPT_SHA_MISMATCH',
    jsonCode: 'STILL_APPROVAL_RECEIPT_JSON_INVALID',
  });
  const body = approval.body;
  if (body.schema !== APPROVED_STILL_APPROVAL_SCHEMA) fail('STILL_APPROVAL_SCHEMA_INVALID', '静帧批准回执 schema 不正确。');
  if (
    body.decision !== 'approved-completed-state-still' ||
    body.reviewerKind !== 'user' || !isText(body.reviewer) ||
    !isText(body.reviewedAt) || Number.isNaN(Date.parse(body.reviewedAt)) ||
    body.planId !== plan.planId || body.shotId !== shot.id ||
    resolveProjectFileV2(body.stillPath, '批准回执静帧') !== file.absolutePath ||
    body.stillSha256 !== file.sha256
  ) {
    fail('STILL_APPROVAL_BINDING_INVALID', '静帧批准回执未绑定当前计划、镜头、路径、SHA、用户与时间。');
  }
  return {...file, ...dimensions, approval};
};

const runningHubUrl = (value) => {
  let url;
  try { url = new URL(value); } catch { return null; }
  return url.protocol === 'https:' && RUNNINGHUB_ASSET_HOST_PATTERN.test(url.hostname) ? url : null;
};

const assertUploadReceipt = (shot, index, stillEvidence, usedReceiptIds) => {
  const upload = readBoundProjectJsonV2(shot.uploadReceipt, {
    label: '静帧上传回执',
    pathCode: 'UPLOAD_RECEIPT_REQUIRED',
    shaCode: 'UPLOAD_RECEIPT_SHA_MISMATCH',
    jsonCode: 'UPLOAD_RECEIPT_JSON_INVALID',
  });
  const receipt = upload.body;
  if (receipt.schema !== APPROVED_STILL_UPLOAD_RECEIPT_SCHEMA) fail('UPLOAD_RECEIPT_SCHEMA_INVALID', '上传回执 schema 不正确。');
  if (receipt.provider !== 'RunningHub') fail('UPLOAD_RECEIPT_PROVIDER_INVALID', '上传回执 provider 必须是 RunningHub。');
  assertSafeIdV2(receipt.receiptId, 'UPLOAD_RECEIPT_ID_INVALID', `shots[${index}].uploadReceipt.receiptId`);
  if (usedReceiptIds.has(receipt.receiptId)) fail('UPLOAD_RECEIPT_ID_DUPLICATED', `上传回执 ID 重复：${receipt.receiptId}`);
  usedReceiptIds.add(receipt.receiptId);
  assertIsoTimestampV2(receipt.uploadedAt, 'UPLOAD_RECEIPT_TIME_INVALID', 'uploadedAt');
  if (!isText(receipt.authorization?.path)) fail('UPLOAD_RECEIPT_AUTHORIZATION_PATH_REQUIRED', '上传回执必须绑定项目内联网授权文件。');
  assertSha256V2(receipt.authorization?.sha256, 'UPLOAD_RECEIPT_AUTHORIZATION_SHA_INVALID', '上传授权 SHA-256');
  assertSafeIdV2(receipt.authorization?.authorizationId, 'UPLOAD_RECEIPT_AUTHORIZATION_ID_INVALID', '上传授权 authorizationId');
  assertSha256V2(receipt.transportBindingSha256, 'UPLOAD_RECEIPT_TRANSPORT_BINDING_SHA_INVALID', '上传 transportBindingSha256');
  if (!runningHubUrl(receipt.imageUrl)) fail('UPLOAD_RECEIPT_IMAGE_URL_INVALID', 'imageUrl 必须是 RunningHub 或真实上传回执返回的腾讯 COS HTTPS 域名。');
  if (
    !isObject(receipt.providerResponse) ||
    receipt.providerResponse.code !== 0 ||
    receipt.providerResponse.message !== 'success' ||
    receipt.providerResponse.data?.type !== 'image' ||
    receipt.providerResponse.data?.download_url !== receipt.imageUrl ||
    !isText(receipt.providerResponse.data?.fileName) ||
    !Number.isFinite(Number(receipt.providerResponse.data?.size)) ||
    Number(receipt.providerResponse.data.size) <= 0 ||
    stableJsonSha256V2(receipt.providerResponse) !== receipt.providerResponseSha256
  ) {
    fail('UPLOAD_RECEIPT_PROVIDER_RESPONSE_INVALID', '上传回执必须绑定官方 code/message/data.download_url 原始响应与稳定 SHA。');
  }
  if (
    resolveProjectFileV2(receipt.sourcePath, '上传源静帧') !== stillEvidence.absolutePath ||
    receipt.sourceSha256 !== stillEvidence.sha256 ||
    receipt.sourceDimensions?.width !== stillEvidence.width ||
    receipt.sourceDimensions?.height !== stillEvidence.height
  ) {
    fail('UPLOAD_RECEIPT_SOURCE_BINDING_INVALID', '上传回执未绑定当前批准静帧路径、SHA 与尺寸。');
  }
  return {...upload, receipt};
};

const directorFileAbsolute = (contractFile, pathValue) =>
  isAbsolute(pathValue) ? resolve(pathValue) : resolve(dirname(contractFile), pathValue);

const assertSameDirectorReference = (planReference, directorReference, contractFile, label, {mp4 = false} = {}) => {
  const planFile = mp4
    ? assertRealMp4VideoV2(planReference, label)
    : assertFileReferenceV2(planReference, {label, pathCode: `${label}_REQUIRED`, shaCode: `${label}_SHA_MISMATCH`});
  if (!isObject(directorReference) || !isText(directorReference.path) || directorReference.sha256 !== planFile.sha256) {
    fail('PRODUCTION_DIRECTOR_REFERENCE_MISMATCH', `${label}与导演合同声明不一致。`);
  }
  if (resolve(directorFileAbsolute(contractFile, directorReference.path)) !== planFile.absolutePath) {
    fail('PRODUCTION_DIRECTOR_REFERENCE_MISMATCH', `${label}路径与导演合同声明不一致。`);
  }
  return planFile;
};

const assertProductionEligibility = (plan) => {
  const eligibility = plan.productionEligibility;
  if (!isObject(eligibility)) fail('PRODUCTION_ELIGIBILITY_REQUIRED', 'productionEligibility 缺失。');
  if (plan.executionMode === 'style-sample') {
    if (eligibility.productionEligible !== false || eligibility.state !== 'candidate-blocked') {
      fail('SAMPLE_ELIGIBILITY_INVALID', 'style-sample 必须保持 candidate-blocked、productionEligible=false。');
    }
    if (plan.shots?.length !== 1) fail('SAMPLE_SINGLE_SHOT_REQUIRED', 'style-sample 只能包含一镜。');
    return {productionEligible: false, executionMode: 'style-sample', directorContract: null};
  }
  if (plan.executionMode !== 'production') fail('EXECUTION_MODE_INVALID', 'executionMode 只能是 style-sample 或 production。');
  if (eligibility.productionEligible !== true || eligibility.state !== 'automation-handoff-eligible') {
    fail('PRODUCTION_ELIGIBILITY_INVALID', 'production 必须绑定 automation-handoff-eligible。');
  }
  const contractFile = readBoundProjectJsonV2(eligibility.directorContract, {
    label: 'director-contract/v2',
    pathCode: 'DIRECTOR_CONTRACT_REQUIRED',
    shaCode: 'DIRECTOR_CONTRACT_SHA_MISMATCH',
    jsonCode: 'DIRECTOR_CONTRACT_JSON_INVALID',
  });
  const directorResult = validateDirectorContractV2(contractFile.body, {
    rootDir: dirname(contractFile.absolutePath),
    checkFiles: true,
  });
  if (!directorResult.ok) {
    fail('DIRECTOR_CONTRACT_INVALID', 'director-contract/v2 未通过真实文件与状态机校验。', {errors: directorResult.errors});
  }
  if (
    contractFile.body.evidenceScope !== 'real-e2e' ||
    contractFile.body.lifecycle?.state !== 'automation-handoff-eligible' ||
    contractFile.body.productionEligible !== true ||
    contractFile.body.formal?.enabled !== false
  ) {
    fail('DIRECTOR_HANDOFF_STATE_INVALID', '导演合同必须是 real-e2e、automation-handoff-eligible，且 formal 仍锁定。');
  }
  const lifecycle = contractFile.body.lifecycle;
  const previewA = contractFile.body.previewAB?.variants?.find((item) => item.id === 'A-with-sfx');
  const previewB = contractFile.body.previewAB?.variants?.find((item) => item.id === 'B-without-sfx');
  const dynamicSample = assertSameDirectorReference(
    eligibility.dynamicSample,
    lifecycle.candidate?.media,
    contractFile.absolutePath,
    'DYNAMIC_SAMPLE',
    {mp4: true},
  );
  assertSameDirectorReference(eligibility.technicalQaReceipt, lifecycle.candidate?.technicalQaReceipt, contractFile.absolutePath, 'TECHNICAL_QA_RECEIPT');
  assertSameDirectorReference(eligibility.humanReviewReceipt, lifecycle.styleAcceptance?.humanReviewReceipt, contractFile.absolutePath, 'HUMAN_REVIEW_RECEIPT');
  assertSameDirectorReference(eligibility.withSfx, previewA, contractFile.absolutePath, 'WITH_SFX_PREVIEW', {mp4: true});
  assertSameDirectorReference(eligibility.withoutSfx, previewB, contractFile.absolutePath, 'WITHOUT_SFX_PREVIEW', {mp4: true});
  const handoff = assertSameDirectorReference(eligibility.handoffReceipt, lifecycle.handoff?.receipt, contractFile.absolutePath, 'HANDOFF_RECEIPT');
  if (eligibility.handoffBindingSha256 !== lifecycle.handoff?.bindingSha256) {
    fail('HANDOFF_BINDING_SHA_MISMATCH', '计划 handoffBindingSha256 与导演合同不一致。');
  }
  const productionJob = readBoundProjectJsonV2(eligibility.productionJob, {
    label: '生产 job',
    pathCode: 'PRODUCTION_JOB_REQUIRED',
    shaCode: 'PRODUCTION_JOB_SHA_MISMATCH',
    jsonCode: 'PRODUCTION_JOB_JSON_INVALID',
  });
  return {productionEligible: true, executionMode: 'production', directorContract: contractFile, dynamicSample, handoff, productionJob};
};

export const generatedVideoPlanV2Definition = (plan) => ({
  schema: plan.schema,
  schemaVersion: plan.schemaVersion,
  executionMode: plan.executionMode,
  planId: plan.planId,
  videoId: plan.videoId,
  planPath: plan.planPath,
  styleReference: plan.styleReference,
  provider: plan.provider,
  productionEligibility: plan.productionEligibility,
  shots: (plan.shots ?? []).map((shot) => ({
    id: shot.id,
    spokenAnchor: shot.spokenAnchor,
    prompt: shot.prompt,
    durationSeconds: shot.durationSeconds,
    approvedStill: shot.approvedStill,
    uploadReceipt: shot.uploadReceipt,
  })),
});
export const generatedVideoPlanV2DefinitionSha256 = (plan) => stableJsonSha256V2(generatedVideoPlanV2Definition(plan));

const assertProvider = (provider) => {
  const expected = {
    platform: 'RunningHub',
    model: 'MiniMax-H3',
    modelRoute: RUNNINGHUB_H3_PRODUCT_ROUTE,
    resolution: '2K',
    aspectRatio: '16:9',
    aigcWatermark: false,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (provider?.[field] !== value) fail('PROVIDER_ROUTE_INVALID', `provider.${field} 必须为 ${String(value)}。`);
  }
  if (provider.durationSeconds?.min !== 5 || provider.durationSeconds?.max !== 15) {
    fail('PROVIDER_DURATION_INVALID', 'provider.durationSeconds 必须锁定 5—15 秒。');
  }
};

export const loadGeneratedVideoPlanV2 = (planFilePath, explicitStylePath = null) => {
  const planAbsolute = resolveProjectFileV2(planFilePath, 'generated-video-plan/v2');
  const planFile = readBoundProjectJsonV2(
    {path: normalizeProjectRelative(planAbsolute), sha256: sha256Buffer(readFileSync(planAbsolute))},
    {label: 'generated-video-plan/v2', pathCode: 'PLAN_REQUIRED', shaCode: 'PLAN_SHA_MISMATCH'},
  );
  const plan = planFile.body;
  if (plan.schema !== GENERATED_VIDEO_PLAN_V2_SCHEMA || plan.schemaVersion !== GENERATED_VIDEO_PLAN_V2_SCHEMA) {
    fail('SCHEMA_INVALID', `schema/schemaVersion 必须为 ${GENERATED_VIDEO_PLAN_V2_SCHEMA}。`);
  }
  assertSafeIdV2(plan.planId, 'PLAN_ID_INVALID', 'planId');
  assertSafeIdV2(plan.videoId, 'VIDEO_ID_INVALID', 'videoId');
  if (resolveProjectFileV2(plan.planPath, '计划内部路径') !== planFile.absolutePath) fail('PLAN_PATH_MISMATCH', 'plan.planPath 与实际读取路径不一致。');
  const stylePath = explicitStylePath ?? plan.styleReference?.path;
  const styleAbsolute = resolveProjectFileV2(stylePath, 'v2 风格卡');
  const styleFile = readBoundProjectJsonV2(
    {path: normalizeProjectRelative(styleAbsolute), sha256: sha256Buffer(readFileSync(styleAbsolute))},
    {label: 'v2 风格卡', pathCode: 'STYLE_REQUIRED', shaCode: 'STYLE_SHA_MISMATCH'},
  );
  if (plan.styleReference?.id !== styleFile.body.id) fail('STYLE_ID_MISMATCH', 'styleReference.id 与风格卡 id 不一致。');
  if (plan.styleReference?.sha256 !== styleFile.sha256) fail('STYLE_SHA_MISMATCH', 'styleReference.sha256 与风格卡真实文件不一致。');
  if (resolveProjectFileV2(plan.styleReference?.path, 'styleReference.path') !== styleFile.absolutePath) fail('STYLE_PATH_MISMATCH', '风格卡路径不一致。');
  assertNoRetiredGeneratedStyle({
    value: {plan, style: styleFile.body},
    operation: 'generated-video-v2-load',
    location: '$.generatedVideoV2',
    additionalStrings: [planFile.relativePath, styleFile.relativePath],
  });
  assertNoRetiredGeneratedContentShaV2([styleFile.sha256], 'v2 风格卡');
  assertProvider(plan.provider);
  const eligibility = assertProductionEligibility(plan);
  if (plan.executionMode === 'production' && styleFile.body.productionEligible !== true) {
    fail('STYLE_PRODUCTION_NOT_ELIGIBLE', 'production 模式要求风格卡 productionEligible=true。');
  }

  const shots = Array.isArray(plan.shots) ? plan.shots : [];
  if (!shots.length) fail('SHOTS_REQUIRED', 'shots 至少包含一镜。');
  if (plan.executionMode === 'style-sample' && shots.length !== 1) fail('SAMPLE_SINGLE_SHOT_REQUIRED', 'style-sample 只能包含一镜。');
  const shotEvidence = new Map();
  const ids = new Set();
  const receiptIds = new Set();
  for (const [index, shot] of shots.entries()) {
    assertSafeIdV2(shot.id, 'SHOT_ID_INVALID', `shots[${index}].id`);
    if (ids.has(shot.id)) fail('SHOT_ID_DUPLICATED', `镜头 id 重复：${shot.id}`);
    ids.add(shot.id);
    if (!isText(shot.prompt)) fail('SHOT_PROMPT_REQUIRED', `shots[${index}].prompt 不能为空。`);
    if (!Number.isInteger(shot.durationSeconds) || shot.durationSeconds < 5 || shot.durationSeconds > 15) {
      fail('SHOT_DURATION_INVALID', `shots[${index}].durationSeconds 必须是 5—15 秒整数。`);
    }
    if (!isText(shot.spokenAnchor?.text)) fail('SPOKEN_ANCHOR_REQUIRED', `shots[${index}].spokenAnchor.text 不能为空。`);
    const still = assertApprovedStill(plan, shot, index);
    const uploadReceipt = assertUploadReceipt(shot, index, still, receiptIds);
    assertNoRetiredGeneratedContentShaV2([still.sha256], `镜头 ${shot.id}`);
    shotEvidence.set(shot.id, {still, uploadReceipt});
  }
  if (eligibility.dynamicSample) assertNoRetiredGeneratedContentShaV2([eligibility.dynamicSample.sha256], 'production 动态样片');

  return {
    plan,
    style: styleFile.body,
    planPath: planFile.absolutePath,
    planFileSha256: planFile.sha256,
    planDefinitionSha256: generatedVideoPlanV2DefinitionSha256(plan),
    stylePath: styleFile.absolutePath,
    styleSha256: styleFile.sha256,
    eligibility,
    shotEvidence,
  };
};

export const assertGeneratedVideoPlanV2Operation = (context, operationMode, productionCommand = null) => {
  if (operationMode === 'style-sample') {
    if (context?.plan?.executionMode !== 'style-sample' || context?.plan?.shots?.length !== 1 || context?.eligibility?.productionEligible !== false) {
      fail('SAMPLE_OPERATION_NOT_ELIGIBLE', 'sample quote/run 只允许单镜 style-sample 候选。');
    }
    return context;
  }
  if (operationMode !== 'production') fail('OPERATION_MODE_INVALID', 'operationMode 只能是 style-sample 或 production。');
  if (
    context?.plan?.executionMode !== 'production' || context?.eligibility?.productionEligible !== true ||
    context?.style?.productionEligible !== true || !context?.eligibility?.directorContract
  ) {
    fail('PRODUCTION_NOT_ELIGIBLE', 'production quote/run 必须绑定完整 real-e2e 导演合同交接。');
  }
  const expectedPlanPath = context.eligibility.productionJob.body?.inputs?.generatedVideoPlan;
  if (!isText(expectedPlanPath) || resolveProjectFileV2(expectedPlanPath, '生产 job generatedVideoPlan') !== context.planPath) {
    fail('PRODUCTION_JOB_PLAN_BINDING_MISMATCH', '生产 job 必须在 inputs.generatedVideoPlan 绑定当前 v2 plan 文件。');
  }
  if (!isText(productionCommand)) {
    fail('PRODUCTION_ENTRY_COMMAND_REQUIRED', 'production 操作必须声明具体冻结命令。');
  }
  try {
    assertProductionEntryPreflightV2({
      projectRoot: generatedVideoProjectRootV2,
      jobPath: context.eligibility.productionJob.absolutePath,
      job: context.eligibility.productionJob.body,
      command: productionCommand,
      entrypoint: 'tools/generated-video-plan-v2-core.mjs',
    });
  } catch (error) {
    fail(error?.code ?? 'PRODUCTION_ENTRY_PREFLIGHT_FAILED', error instanceof Error ? error.message : String(error), error?.details ?? null);
  }
  return context;
};

export const assertGeneratedVideoPlanV2ProductionEligible = (context) =>
  assertGeneratedVideoPlanV2Operation(context, 'production', 'generated-video-production-quote');

export const validateGeneratedVideoPlanV2 = (
  planFilePath,
  {stylePath = null, requiredOperationMode = null, productionCommand = 'generated-video-production-quote'} = {},
) => {
  try {
    const context = loadGeneratedVideoPlanV2(planFilePath, stylePath);
    if (requiredOperationMode) assertGeneratedVideoPlanV2Operation(context, requiredOperationMode, requiredOperationMode === 'production' ? productionCommand : null);
    return {ok: true, context, errors: []};
  } catch (error) {
    return {
      ok: false,
      context: null,
      errors: [{code: error?.code ?? 'UNEXPECTED', message: error instanceof Error ? error.message : String(error), details: error?.details ?? null}],
    };
  }
};
