import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';

import {
  GeneratedVideoPlanV2Error,
  RUNNINGHUB_H3_PRODUCT_ROUTE,
  APPROVED_STILL_UPLOAD_RECEIPT_SCHEMA,
  assertNoRetiredGeneratedContentShaV2,
  assertFileReferenceV2,
  assertGeneratedVideoPlanV2Operation,
  assertIsoTimestampV2,
  assertSafeIdV2,
  generatedVideoProjectRootV2,
  readBoundProjectJsonV2,
  stableJsonSha256V2,
} from './generated-video-plan-v2-core.mjs';
import {validateDirectorExternalMessageAnchorV2} from '../skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs';

export const RUNNINGHUB_H3_V2_REQUEST_SCHEMA = 'runninghub-h3-v2-request/v2';
export const RUNNINGHUB_PAID_AUTHORIZATION_SCHEMA = 'runninghub-paid-authorization/v2';
export const RUNNINGHUB_USER_AUTHORIZATION_EVIDENCE_SCHEMA = 'runninghub-user-authorization-evidence/v2';
export const RUNNINGHUB_H3_V2_QUOTE_RECEIPT_SCHEMA = 'runninghub-h3-v2-quote-receipt/v2';
export const RUNNINGHUB_H3_V2_TASK_RECEIPT_SCHEMA = 'runninghub-h3-v2-task-receipt/v2';
export const RUNNINGHUB_H3_V2_QUERY_RECEIPT_SCHEMA = 'runninghub-h3-v2-query-receipt/v2';
export const RUNNINGHUB_H3_V2_RESULT_RECEIPT_SCHEMA = 'runninghub-h3-v2-result-receipt/v2';
export const RUNNINGHUB_H3_V2_DOWNLOAD_RECEIPT_SCHEMA = 'runninghub-h3-v2-download-receipt/v2';
export const RUNNINGHUB_NETWORK_AUTHORIZATION_SCHEMA = 'runninghub-network-authorization/v2';
export const RUNNINGHUB_H3_V2_LEDGER_SCHEMA = 'runninghub-h3-v2-consumption-ledger/v2';
export const RUNNINGHUB_H3_V2_FIXED_LEDGER_PATH =
  'work/generated-video-v2/runninghub-h3-v2-consumption-ledger.json';
export const RUNNINGHUB_PROVIDER_TRANSPORT_TRUST_STATE =
  'blocked-no-provider-transport-attestation';

export const RUNNINGHUB_BASE_URL = 'https://www.runninghub.cn';
export const RUNNINGHUB_H3_V2_SUBMIT_PATH = `/openapi/v2${RUNNINGHUB_H3_PRODUCT_ROUTE}`;
export const RUNNINGHUB_H3_V2_QUOTE_PATH = `/openapi/v2/price-preview${RUNNINGHUB_H3_PRODUCT_ROUTE}`;
export const RUNNINGHUB_H3_V2_QUERY_PATH = '/openapi/v2/query';
export const RUNNINGHUB_MEDIA_UPLOAD_PATH = '/openapi/v2/media/upload/binary';

const SHA256_RE = /^[a-f0-9]{64}$/u;
const CNY_EPSILON = 0.000001;
const ALLOWED_OPERATIONS = new Set([
  'sample-quote',
  'sample-run',
  'production-quote',
  'production-run',
]);
const REQUEST_PAYLOAD_KEYS = Object.freeze([
  'aigc_watermark',
  'duration',
  'imageUrls',
  'prompt',
  'ratio',
  'resolution',
]);

const fail = (code, message, details = null) => {
  throw new GeneratedVideoPlanV2Error(code, message, details);
};
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const sha256Text = (value) => createHash('sha256').update(value).digest('hex');
const sameMoney = (left, right) => Math.abs(Number(left) - Number(right)) <= CNY_EPSILON;
const trustedNow = () => new Date();
const VIDEO_OUTPUT_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);
const videoOutputType = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/^\./u, '');
  return VIDEO_OUTPUT_EXTENSIONS.has(normalized);
};

const assertSha = (value, code, label) => {
  if (!SHA256_RE.test(String(value ?? ''))) fail(code, `${label}必须是小写 64 位 SHA-256。`);
};

const assertOperation = (operation) => {
  if (!ALLOWED_OPERATIONS.has(operation)) {
    fail('PAID_OPERATION_INVALID', 'operation 只能是 sample-quote/sample-run/production-quote/production-run。');
  }
  return operation.startsWith('sample-') ? 'style-sample' : 'production';
};

export const assertRunningHubTrustedTransportAvailableV2 = () => {
  fail(
    'RUNNINGHUB_TRUSTED_TRANSPORT_UNAVAILABLE',
    '尚未安装可独立验证的 RunningHub provider transport 实现与签名证明；禁止使用任意注入 transport 联网。',
  );
};

const assertFutureExpiry = (expiresAt, now, code, label) => {
  assertIsoTimestampV2(expiresAt, code, label);
  if (Date.parse(expiresAt) <= now.getTime()) fail(code, `${label}已过期。`);
};

const resolveProjectTarget = (pathValue, label, {mustExist = false} = {}) => {
  if (!isText(pathValue)) fail('PROJECT_TARGET_PATH_REQUIRED', `${label}路径不能为空。`);
  const absolute = isAbsolute(pathValue) ? resolve(pathValue) : resolve(generatedVideoProjectRootV2, pathValue);
  const relation = relative(generatedVideoProjectRootV2, absolute);
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    fail('PROJECT_TARGET_OUTSIDE', `${label}必须位于口播项目内。`);
  }
  let cursor = generatedVideoProjectRootV2;
  for (const segment of relation.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      fail('PROJECT_TARGET_SYMLINK', `${label}路径不得经过符号链接。`);
    }
  }
  if (mustExist && !existsSync(absolute)) fail('PROJECT_TARGET_MISSING', `${label}不存在。`);
  return absolute;
};

const normalizeProviderUrl = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail('RUNNINGHUB_URL_INVALID', 'RunningHub 请求 URL 无效。');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.runninghub.cn') {
    fail('RUNNINGHUB_URL_INVALID', 'RunningHub 请求必须使用 https://www.runninghub.cn。');
  }
  return parsed.toString();
};

const normalizeAssetUrl = (url) => {
  let parsed;
  try { parsed = new URL(url); } catch { fail('RUNNINGHUB_ASSET_URL_INVALID', '结果资产 URL 无效。'); }
  if (parsed.protocol !== 'https:' || !/(^|\.)(runninghub\.cn|myqcloud\.com)$/iu.test(parsed.hostname)) {
    fail('RUNNINGHUB_ASSET_URL_INVALID', '结果资产 URL 必须是 RunningHub 或腾讯 COS HTTPS 域名。');
  }
  return parsed.toString();
};

const redactTransportFailure = (operation) => {
  const error = new GeneratedVideoPlanV2Error(
    'RUNNINGHUB_TRANSPORT_FAILED',
    `RunningHub ${operation} 传输失败；已隐去密钥与上游原始异常。`,
  );
  error.redacted = true;
  return error;
};

const invokeTransport = async ({transport, apiKey, url, body, multipart, method = 'POST', operation, assetUrl = false, requiresApiKey = true}) => {
  if (typeof transport !== 'function') {
    fail('EXPLICIT_TRANSPORT_REQUIRED', '未注入显式 transport；适配器禁止默认联网。');
  }
  if (requiresApiKey && !isText(apiKey)) fail('RUNNINGHUB_API_KEY_REQUIRED', '联网调用需要调用方显式传入 API Key。');
  try {
    return await transport({
      method,
      url: assetUrl ? normalizeAssetUrl(url) : normalizeProviderUrl(url),
      headers: {
        ...(requiresApiKey ? {authorization: `Bearer ${apiKey}`} : {}),
        ...(multipart ? {} : {'content-type': 'application/json'}),
      },
      ...(body === undefined ? {} : {body}),
      ...(multipart ? {multipart} : {}),
    });
  } catch {
    throw redactTransportFailure(operation);
  }
};

const expectedBinding = ({context, compilation, operation}) => ({
  operation,
  planId: context.plan.planId,
  planDefinitionSha256: context.planDefinitionSha256,
  styleSha256: context.styleSha256,
  shotId: compilation.shot.id,
  requestDefinitionSha256: compilation.requestDefinitionSha256,
  payloadSha256: compilation.payloadSha256,
  approvedStillSha256: context.shotEvidence.get(compilation.shot.id).still.sha256,
  approvedStillUploadReceiptSha256:
    context.shotEvidence.get(compilation.shot.id).uploadReceipt.sha256,
});

const assertBinding = (actual, expected, code, label) => {
  if (!isRecord(actual)) fail(code, `${label}缺少请求绑定。`);
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) fail(code, `${label}.${key}未绑定当前请求。`);
  }
};

export const readRunningHubUserAuthorizationEvidenceV2 = (reference, expected, authorization) => {
  const evidence = readBoundProjectJsonV2(reference, {
    label: '用户付费授权原始证据',
    pathCode: 'USER_AUTHORIZATION_EVIDENCE_REQUIRED',
    shaCode: 'USER_AUTHORIZATION_EVIDENCE_SHA_MISMATCH',
    jsonCode: 'USER_AUTHORIZATION_EVIDENCE_JSON_INVALID',
  });
  const body = evidence.body;
  if (body.schema !== RUNNINGHUB_USER_AUTHORIZATION_EVIDENCE_SCHEMA) {
    fail('USER_AUTHORIZATION_EVIDENCE_SCHEMA_INVALID', '用户授权证据 schema 不正确。');
  }
  if (
    body.decision !== 'approved-exact-paid-call' ||
    body.evidenceScope !== 'external-user-message' ||
    body.reviewerKind !== 'user' ||
    !isText(body.reviewerId) ||
    !isText(body.issuerGroupId) ||
    body.issuerGroupId === authorization.executionGroupId ||
    !isText(body.sourceThreadId) ||
    !isText(body.sourceMessageId) ||
    !isText(body.explicitAuthorizationQuote) ||
    body.messageSha256 !== sha256Text(body.explicitAuthorizationQuote) ||
    body.authorizationId !== authorization.authorizationId ||
    body.nonce !== authorization.nonce ||
    body.operation !== expected.operation ||
    body.currency !== 'CNY' ||
    !sameMoney(body.exactCostCny, authorization.exactCostCny) ||
    Number(body.exactCostCny) <= 0 ||
    body.expiresAt !== authorization.expiresAt ||
    stableJsonSha256V2(body.requestBinding) !== stableJsonSha256V2(expected)
  ) {
    fail('USER_AUTHORIZATION_EVIDENCE_BINDING_INVALID', '用户授权证据必须来自非执行组的外部用户消息，并绑定原话、消息、nonce、请求与精确金额。');
  }
  const externalAnchor = validateDirectorExternalMessageAnchorV2({
    ...body,
    explicitAcceptanceQuote: body.explicitAuthorizationQuote,
    sourceMessageSha256: body.messageSha256,
  }, 'runninghub-paid-authorization');
  if (!externalAnchor.ok) {
    fail('USER_AUTHORIZATION_EXTERNAL_ANCHOR_INVALID', '用户付费授权未绑定独立外部消息锚点，执行器自造 thread/message/issuer 无效。', {reason: externalAnchor.reason});
  }
  const anchor = externalAnchor.entry;
  if (
    anchor.authorizationId !== authorization.authorizationId ||
    anchor.nonce !== authorization.nonce ||
    anchor.operation !== expected.operation ||
    anchor.currency !== 'CNY' ||
    !sameMoney(anchor.exactCostCny, authorization.exactCostCny) ||
    anchor.requestBindingSha256 !== stableJsonSha256V2(expected) ||
    anchor.expiresAt !== authorization.expiresAt
  ) {
    fail('USER_AUTHORIZATION_EXTERNAL_ANCHOR_BINDING_INVALID', '独立外部锚点未绑定 authorizationId、nonce、operation、金额、请求与有效期。');
  }
  assertIsoTimestampV2(body.approvedAt, 'USER_AUTHORIZATION_EVIDENCE_TIME_INVALID', 'approvedAt');
  return evidence;
};

export const validateRunningHubPaidAuthorizationEnvelopeV2 = ({authorization, expectedBinding, operation, now = trustedNow()}) => {
  const auth = authorization;
  if (auth?.schema !== RUNNINGHUB_PAID_AUTHORIZATION_SCHEMA) {
    fail('PAID_AUTHORIZATION_SCHEMA_INVALID', '付费授权 schema 不正确。');
  }
  assertSafeIdV2(auth.authorizationId, 'PAID_AUTHORIZATION_ID_INVALID', 'authorizationId');
  assertSafeIdV2(auth.nonce, 'PAID_AUTHORIZATION_NONCE_INVALID', 'nonce');
  if (
    auth.decision !== 'approved-exact-paid-call' ||
    auth.allowNetwork !== true ||
    auth.allowPaid !== true ||
    auth.maxSubmissions !== 1 ||
    !isText(auth.executionGroupId) ||
    auth.operation !== operation ||
    auth.currency !== 'CNY' ||
    !Number.isFinite(Number(auth.exactCostCny)) ||
    Number(auth.exactCostCny) <= 0
  ) {
    fail('PAID_AUTHORIZATION_CONTENT_INVALID', '付费授权必须允许单次联网/付费，并绑定精确正数 CNY 金额。');
  }
  assertIsoTimestampV2(auth.approvedAt, 'PAID_AUTHORIZATION_TIME_INVALID', 'approvedAt');
  assertFutureExpiry(auth.expiresAt, now, 'PAID_AUTHORIZATION_EXPIRED', 'expiresAt');
  assertBinding(auth.requestBinding, expectedBinding, 'PAID_AUTHORIZATION_BINDING_INVALID', '付费授权');
  if (Object.hasOwn(auth, 'ledgerPath')) {
    fail('PAID_AUTHORIZATION_LEDGER_PATH_FORBIDDEN', '调用方不得自选消费账本；适配器固定使用项目级单一账本。');
  }
  if (operation.endsWith('-run') && (!isText(auth.quoteReceiptSha256) || !isText(auth.quoteReceiptId))) {
    fail('RUN_AUTHORIZATION_QUOTE_BINDING_REQUIRED', 'run 授权必须绑定报价回执 SHA 与 quoteReceiptId。');
  }
  if (operation.endsWith('-run')) assertSha(auth.quoteReceiptSha256, 'RUN_AUTHORIZATION_QUOTE_SHA_INVALID', 'quoteReceiptSha256');
  return auth;
};

const readPaidAuthorization = ({authorizationRef, context, compilation, operation, now}) => {
  const operationMode = assertOperation(operation);
  assertGeneratedVideoPlanV2Operation(
    context,
    operationMode,
    operationMode === 'production'
      ? operation.endsWith('-quote')
        ? 'generated-video-production-quote'
        : 'generated-video-production-run'
      : null,
  );
  const reference = readBoundProjectJsonV2(authorizationRef, {
    label: 'RunningHub 单次付费授权',
    pathCode: 'PAID_AUTHORIZATION_REQUIRED',
    shaCode: 'PAID_AUTHORIZATION_SHA_MISMATCH',
    jsonCode: 'PAID_AUTHORIZATION_JSON_INVALID',
  });
  const auth = reference.body;
  const expected = expectedBinding({context, compilation, operation});
  validateRunningHubPaidAuthorizationEnvelopeV2({authorization: auth, expectedBinding: expected, operation, now});
  const userEvidence = readRunningHubUserAuthorizationEvidenceV2(auth.userEvidence, expected, auth);
  return {reference, auth, expected, userEvidence, operationMode};
};

export const compileRunningHubH3V2Shot = ({context, shotId}) => {
  const shot = context?.plan?.shots?.find((item) => item.id === shotId);
  if (!shot) fail('SHOT_NOT_FOUND', `找不到镜头：${shotId}`);
  const evidence = context.shotEvidence.get(shotId);
  const imageUrl = evidence?.uploadReceipt?.receipt?.imageUrl;
  if (!isText(imageUrl)) fail('APPROVED_IMAGE_URL_REQUIRED', '镜头缺少已批准静帧上传 URL。');
  const payload = {
    prompt: shot.prompt,
    duration: shot.durationSeconds,
    resolution: context.plan.provider.resolution,
    ratio: context.plan.provider.aspectRatio,
    imageUrls: [imageUrl],
    aigc_watermark: context.plan.provider.aigcWatermark,
  };
  assertRunningHubH3V2Payload(payload, {approvedImageUrl: imageUrl});
  const payloadSha256 = stableJsonSha256V2(payload);
  const requestDefinition = {
    schema: RUNNINGHUB_H3_V2_REQUEST_SCHEMA,
    provider: 'RunningHub',
    method: 'POST',
    productRoute: RUNNINGHUB_H3_PRODUCT_ROUTE,
    submitPath: RUNNINGHUB_H3_V2_SUBMIT_PATH,
    quotePath: RUNNINGHUB_H3_V2_QUOTE_PATH,
    payload,
    payloadSha256,
    bindings: {
      planId: context.plan.planId,
      planDefinitionSha256: context.planDefinitionSha256,
      styleSha256: context.styleSha256,
      shotId,
      approvedStillSha256: evidence.still.sha256,
      approvedStillApprovalReceiptSha256: evidence.still.approval.sha256,
      approvedStillUploadReceiptSha256: evidence.uploadReceipt.sha256,
    },
  };
  const requestDefinitionSha256 = stableJsonSha256V2(requestDefinition);
  return {shot, payload, payloadSha256, requestDefinition, requestDefinitionSha256};
};

export const validateRunningHubH3V2RequestDefinition = ({context, shotId, requestDefinition}) => {
  const expected = compileRunningHubH3V2Shot({context, shotId});
  if (
    !isRecord(requestDefinition) ||
    requestDefinition.schema !== RUNNINGHUB_H3_V2_REQUEST_SCHEMA ||
    stableJsonSha256V2(requestDefinition) !== expected.requestDefinitionSha256
  ) {
    fail('H3_REQUEST_DEFINITION_MISMATCH', 'H3 request definition 未绑定当前计划、批准静帧与唯一官方 payload。');
  }
  assertRunningHubH3V2Payload(requestDefinition.payload, {
    approvedImageUrl: context.shotEvidence.get(shotId).uploadReceipt.receipt.imageUrl,
  });
  return requestDefinition;
};

export const assertRunningHubH3V2Payload = (payload, {approvedImageUrl} = {}) => {
  if (!isRecord(payload)) fail('H3_PAYLOAD_INVALID', 'H3 payload 必须是对象。');
  const keys = Object.keys(payload).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...REQUEST_PAYLOAD_KEYS])) {
    fail('H3_PAYLOAD_FIELDS_INVALID', 'H3 payload 字段不得缺失或增加旁路字段。');
  }
  if (!isText(payload.prompt)) fail('H3_PROMPT_REQUIRED', 'H3 prompt 不能为空。');
  if (!Number.isInteger(payload.duration) || payload.duration < 5 || payload.duration > 15) {
    fail('H3_DURATION_INVALID', 'H3 时长必须是 5—15 秒整数。');
  }
  if (payload.resolution !== '2K' || payload.ratio !== '16:9' || payload.aigc_watermark !== false) {
    fail('H3_PROVIDER_FIELDS_INVALID', 'H3 请求必须锁定 2K、16:9 与无水印请求。');
  }
  if (!Array.isArray(payload.imageUrls) || payload.imageUrls.length !== 1 || payload.imageUrls[0] !== approvedImageUrl) {
    fail('H3_IMAGE_URLS_INVALID', 'H3 payload 只能携带当前唯一批准静帧 imageUrls。');
  }
  let parsed;
  try { parsed = new URL(payload.imageUrls[0]); } catch { fail('H3_IMAGE_URLS_INVALID', 'imageUrls 不是有效 URL。'); }
  if (parsed.protocol !== 'https:' || !/(^|\.)(runninghub\.cn|myqcloud\.com)$/iu.test(parsed.hostname)) {
    fail('H3_IMAGE_URLS_INVALID', 'imageUrls 必须来自已绑定上传回执的 RunningHub/腾讯 COS HTTPS 地址。');
  }
  return payload;
};

const OFFICIAL_PRICE_RESPONSE_KEYS = Object.freeze([
  'currency', 'errorCode', 'errorMessage', 'estimatedPrice', 'freeLimit',
  'freeLimitCount', 'isFreeThisCall', 'priceText', 'priceTextEn', 'remainingFreeLimitCount',
]);

export const validateRunningHubH3V2PriceProviderResponse = (response) => {
  if (!isRecord(response) || JSON.stringify(Object.keys(response).sort()) !== JSON.stringify([...OFFICIAL_PRICE_RESPONSE_KEYS].sort())) {
    fail('QUOTE_PROVIDER_RESPONSE_INVALID', '报价响应必须严格使用官方 estimatedPrice/currency/freeLimit 字段，不得自造 quoteId/exactCostCny/时间字段。');
  }
  if (
    Number(response.errorCode) !== 0 ||
    typeof response.errorMessage !== 'string' ||
    response.currency !== 'CNY' ||
    !Number.isFinite(Number(response.estimatedPrice)) ||
    Number(response.estimatedPrice) <= 0 ||
    !isText(response.priceText) ||
    !(response.priceTextEn === null || isText(response.priceTextEn)) ||
    !Number.isFinite(Number(response.freeLimit)) ||
    !Number.isFinite(Number(response.freeLimitCount)) ||
    !Number.isFinite(Number(response.remainingFreeLimitCount)) ||
    typeof response.isFreeThisCall !== 'boolean'
  ) {
    fail('QUOTE_PROVIDER_RESPONSE_INVALID', '官方报价响应字段值无效。');
  }
  return response;
};

export const validateRunningHubH3V2QuoteReceipt = ({
  receipt,
  expectedRequestBinding,
  expectedCostCny = null,
  now = new Date(),
}) => {
  if (receipt?.schema !== RUNNINGHUB_H3_V2_QUOTE_RECEIPT_SCHEMA || receipt?.provider !== 'RunningHub') {
    fail('QUOTE_RECEIPT_SCHEMA_INVALID', '报价回执 schema/provider 不正确。');
  }
  if (!isRecord(receipt.providerResponse) || stableJsonSha256V2(receipt.providerResponse) !== receipt.providerResponseSha256) {
    fail('QUOTE_PROVIDER_RESPONSE_SHA_MISMATCH', '报价回执未绑定原始提供商响应。');
  }
  validateRunningHubH3V2PriceProviderResponse(receipt.providerResponse);
  if (
    receipt.operation !== expectedRequestBinding?.operation ||
    receipt.estimatedPriceCny !== Number(receipt.providerResponse.estimatedPrice) ||
    receipt.currency !== 'CNY' ||
    !isText(receipt.quoteReceiptId) ||
    !isText(receipt.recordedAt) || Number.isNaN(Date.parse(receipt.recordedAt)) ||
    !isText(receipt.validUntil) || Date.parse(receipt.validUntil) <= now.getTime() ||
    (expectedCostCny !== null && !sameMoney(receipt.estimatedPriceCny, expectedCostCny))
  ) {
    fail('QUOTE_RECEIPT_BINDING_INVALID', '报价回执金额、时间、有效期或原始响应绑定不一致。');
  }
  if (expectedRequestBinding) {
    assertBinding(receipt.requestBinding, expectedRequestBinding, 'QUOTE_RECEIPT_REQUEST_MISMATCH', '报价回执');
  }
  assertSha(receipt.authorization?.sha256, 'QUOTE_RECEIPT_AUTHORIZATION_SHA_INVALID', 'authorization.sha256');
  if (!isText(receipt.authorization?.authorizationId) || !isText(receipt.authorization?.nonce)) {
    fail('QUOTE_RECEIPT_AUTHORIZATION_BINDING_INVALID', '报价回执必须绑定报价授权 authorizationId 与 nonce。');
  }
  return receipt;
};

export const quoteRunningHubH3V2Shot = async ({
  context,
  shotId,
  operation,
  authorizationRef,
  apiKey,
  transport,
}) => {
  const now = trustedNow();
  if (!operation?.endsWith('-quote')) fail('QUOTE_OPERATION_INVALID', 'quote 只允许 sample-quote 或 production-quote。');
  const compilation = compileRunningHubH3V2Shot({context, shotId});
  const operationMode = assertOperation(operation);
  assertGeneratedVideoPlanV2Operation(
    context,
    operationMode,
    operationMode === 'production' ? 'generated-video-production-quote' : null,
  );
  assertApprovedStillUploadChainForPaidCall({context, compilation, now});
  const authorization = readPaidAuthorization({authorizationRef, context, compilation, operation, now});
  assertRunningHubTrustedTransportAvailableV2();
  const response = await invokeTransport({
    transport,
    apiKey,
    url: `${RUNNINGHUB_BASE_URL}${RUNNINGHUB_H3_V2_QUOTE_PATH}`,
    body: compilation.payload,
    operation: 'quote',
  });
  validateRunningHubH3V2PriceProviderResponse(response);
  if (!sameMoney(response.estimatedPrice, authorization.auth.exactCostCny)) {
    fail('QUOTE_AMOUNT_NOT_AUTHORIZED', '实时报价与用户授权的精确金额不一致。');
  }
  const providerResponseSha256 = stableJsonSha256V2(response);
  const recordedAt = now.toISOString();
  return {
    schema: RUNNINGHUB_H3_V2_QUOTE_RECEIPT_SCHEMA,
    provider: 'RunningHub',
    operation,
    quoteReceiptId: `quote-${providerResponseSha256.slice(0, 20)}`,
    estimatedPriceCny: Number(response.estimatedPrice),
    currency: 'CNY',
    recordedAt,
    validUntil: authorization.auth.expiresAt,
    providerResponse: response,
    providerResponseSha256,
    authorization: {
      path: authorization.reference.relativePath,
      sha256: authorization.reference.sha256,
      authorizationId: authorization.auth.authorizationId,
      nonce: authorization.auth.nonce,
    },
    requestBinding: authorization.expected,
  };
};

const readQuoteReceipt = ({quoteReceiptRef, expected, runAuth, now}) => {
  const bound = readBoundProjectJsonV2(quoteReceiptRef, {
    label: 'RunningHub 真实报价回执',
    pathCode: 'QUOTE_RECEIPT_REQUIRED',
    shaCode: 'QUOTE_RECEIPT_SHA_MISMATCH',
    jsonCode: 'QUOTE_RECEIPT_JSON_INVALID',
  });
  const receipt = bound.body;
  const quoteOperation = expected.operation === 'sample-run' ? 'sample-quote' : 'production-quote';
  validateRunningHubH3V2QuoteReceipt({
    receipt,
    expectedRequestBinding: {...expected, operation: quoteOperation},
    expectedCostCny: runAuth.exactCostCny,
    now,
  });
  return {bound, receipt};
};

const writeJsonAtomically = (target, value) => {
  mkdirSync(dirname(target), {recursive: true});
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  renameSync(temporary, target);
};

const readLedger = (ledgerPath) => {
  if (!existsSync(ledgerPath)) return {schema: RUNNINGHUB_H3_V2_LEDGER_SCHEMA, entries: []};
  let ledger;
  try { ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')); } catch { fail('PAID_LEDGER_INVALID', '付费消费账本不是有效 JSON。'); }
  if (ledger.schema !== RUNNINGHUB_H3_V2_LEDGER_SCHEMA || !Array.isArray(ledger.entries)) {
    fail('PAID_LEDGER_INVALID', '付费消费账本 schema 不正确。');
  }
  return ledger;
};

const reserveAuthorization = ({authorization, quote, now}) => {
  const ledgerPath = resolveProjectTarget(RUNNINGHUB_H3_V2_FIXED_LEDGER_PATH, '固定付费消费账本');
  mkdirSync(dirname(ledgerPath), {recursive: true});
  const lockPath = `${ledgerPath}.lock`;
  let descriptor;
  try {
    descriptor = openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') fail('PAID_LEDGER_CONCURRENT_OR_RECOVERY_REQUIRED', '项目级付费账本正被占用或存在未裁决恢复锁，禁止并发提交。');
    fail('PAID_LEDGER_LOCK_FAILED', '无法建立付费授权原子锁。');
  }
  closeSync(descriptor);
  try {
    const ledger = readLedger(ledgerPath);
    const duplicate = ledger.entries.find((entry) =>
      entry.authorizationId === authorization.auth.authorizationId ||
      entry.nonce === authorization.auth.nonce ||
      entry.quoteReceiptId === quote.receipt.quoteReceiptId ||
      entry.quoteReceiptSha256 === quote.bound.sha256 ||
      (
        entry.requestDefinitionSha256 === authorization.expected.requestDefinitionSha256
      ),
    );
    if (duplicate) {
      fail('PAID_AUTHORIZATION_ALREADY_CONSUMED', '同一 authorizationId、nonce、报价或请求已有消费/不确定回执，禁止跨 ID 重放。');
    }
    const entry = {
      authorizationId: authorization.auth.authorizationId,
      nonce: authorization.auth.nonce,
      authorizationSha256: authorization.reference.sha256,
      quoteReceiptSha256: quote.bound.sha256,
      quoteReceiptId: quote.receipt.quoteReceiptId,
      estimatedPriceCny: quote.receipt.estimatedPriceCny,
      currency: 'CNY',
      operation: authorization.auth.operation,
      requestDefinitionSha256: authorization.expected.requestDefinitionSha256,
      state: 'reserved',
      reservedAt: now.toISOString(),
    };
    ledger.entries.push(entry);
    writeJsonAtomically(ledgerPath, ledger);
    return {ledgerPath, lockPath, ledger, entry};
  } catch (error) {
    if (existsSync(lockPath)) unlinkSync(lockPath);
    throw error;
  }
};

const settleReservation = (reservation, state, patch = {}) => {
  const ledger = readLedger(reservation.ledgerPath);
  const entry = ledger.entries.find((item) =>
    item.authorizationId === reservation.entry.authorizationId &&
    item.nonce === reservation.entry.nonce,
  );
  if (!entry || entry.state !== 'reserved') fail('PAID_LEDGER_RESERVATION_LOST', '付费消费预留记录丢失或被篡改。');
  Object.assign(entry, patch, {state});
  writeJsonAtomically(reservation.ledgerPath, ledger);
  if (existsSync(reservation.lockPath)) unlinkSync(reservation.lockPath);
  return entry;
};

export const validateRunningHubH3V2SubmitProviderResponse = (response) => {
  const allowedKeys = new Set(['taskId', 'status', 'errorCode', 'errorMessage', 'results', 'clientId', 'promptTips']);
  if (
    !isRecord(response) ||
    Object.keys(response).some((key) => !allowedKeys.has(key)) ||
    !isText(response.taskId) ||
    !isText(response.status) ||
    !['QUEUED', 'RUNNING', 'SUCCESS'].includes(response.status) ||
    !Object.hasOwn(response, 'errorCode') ||
    !Object.hasOwn(response, 'errorMessage') ||
    Object.hasOwn(response, 'provider')
  ) {
    fail('RUN_PROVIDER_RESPONSE_INVALID', '提交响应必须使用官方 taskId/status/errorCode/errorMessage 生成任务形状，不得要求自造 provider。');
  }
  return response;
};

export const runRunningHubH3V2Shot = async ({
  context,
  shotId,
  operation,
  authorizationRef,
  quoteReceiptRef,
  apiKey,
  transport,
}) => {
  const now = trustedNow();
  if (!operation?.endsWith('-run')) fail('RUN_OPERATION_INVALID', 'run 只允许 sample-run 或 production-run。');
  const compilation = compileRunningHubH3V2Shot({context, shotId});
  const operationMode = assertOperation(operation);
  assertGeneratedVideoPlanV2Operation(
    context,
    operationMode,
    operationMode === 'production' ? 'generated-video-production-run' : null,
  );
  assertApprovedStillUploadChainForPaidCall({context, compilation, now});
  const authorization = readPaidAuthorization({authorizationRef, context, compilation, operation, now});
  const quote = readQuoteReceipt({quoteReceiptRef, expected: authorization.expected, runAuth: authorization.auth, now});
  if (
    authorization.auth.quoteReceiptSha256 !== quote.bound.sha256 ||
    authorization.auth.quoteReceiptId !== quote.receipt.quoteReceiptId
  ) {
    fail('RUN_AUTHORIZATION_QUOTE_BINDING_INVALID', 'run 授权必须显式绑定当前真实报价回执 SHA 与 quoteReceiptId。');
  }
  assertRunningHubTrustedTransportAvailableV2();
  const reservation = reserveAuthorization({authorization, quote, now});
  let response;
  try {
    response = await invokeTransport({
      transport,
      apiKey,
      url: `${RUNNINGHUB_BASE_URL}${RUNNINGHUB_H3_V2_SUBMIT_PATH}`,
      body: compilation.payload,
      operation: 'run',
    });
  } catch (error) {
    settleReservation(reservation, 'uncertain', {failedAt: new Date().toISOString(), failureCode: error?.code ?? 'RUNNINGHUB_TRANSPORT_FAILED'});
    throw error;
  }
  try {
    validateRunningHubH3V2SubmitProviderResponse(response);
  } catch (error) {
    settleReservation(reservation, 'uncertain', {failedAt: new Date().toISOString(), failureCode: 'RUN_PROVIDER_RESPONSE_INVALID'});
    throw error;
  }
  const providerResponseSha256 = stableJsonSha256V2(response);
  settleReservation(reservation, 'submitted', {
    submittedAt: new Date().toISOString(),
    taskId: response.taskId,
    providerResponseSha256,
  });
  return createRunningHubH3V2TaskReceipt({
    context,
    compilation,
    operation,
    authorization,
    quote,
    response,
    providerResponseSha256,
  });
};

export const createRunningHubH3V2TaskReceipt = ({
  context,
  compilation,
  operation,
  authorization,
  quote,
  response,
  providerResponseSha256 = stableJsonSha256V2(response),
}) => ({
  schema: RUNNINGHUB_H3_V2_TASK_RECEIPT_SCHEMA,
  provider: 'RunningHub',
  operation,
  taskId: response.taskId,
  providerResponse: response,
  providerResponseSha256,
  requestBinding: expectedBinding({context, compilation, operation}),
  authorization: {
    path: authorization.reference.relativePath,
    sha256: authorization.reference.sha256,
    authorizationId: authorization.auth.authorizationId,
    nonce: authorization.auth.nonce,
  },
    quoteReceipt: {
      path: quote.bound.relativePath,
      sha256: quote.bound.sha256,
      quoteReceiptId: quote.receipt.quoteReceiptId,
      estimatedPriceCny: quote.receipt.estimatedPriceCny,
    currency: 'CNY',
  },
});

export const validateRunningHubH3V2TaskReceipt = ({context, compilation, receipt}) => {
  if (receipt?.schema !== RUNNINGHUB_H3_V2_TASK_RECEIPT_SCHEMA || receipt?.provider !== 'RunningHub') {
    fail('TASK_RECEIPT_SCHEMA_INVALID', '任务回执 schema/provider 不正确。');
  }
  if (!['sample-run', 'production-run'].includes(receipt.operation)) {
    fail('TASK_RECEIPT_OPERATION_INVALID', '任务回执 operation 只能是 sample-run 或 production-run。');
  }
  if (!isText(receipt.taskId) || !isRecord(receipt.providerResponse) || receipt.providerResponse.taskId !== receipt.taskId) {
    fail('TASK_RECEIPT_PROVIDER_BINDING_INVALID', '任务回执未绑定原始 taskId 响应。');
  }
  validateRunningHubH3V2SubmitProviderResponse(receipt.providerResponse);
  if (stableJsonSha256V2(receipt.providerResponse) !== receipt.providerResponseSha256) {
    fail('TASK_RECEIPT_PROVIDER_SHA_MISMATCH', '任务回执原始响应 SHA 不一致。');
  }
  assertBinding(
    receipt.requestBinding,
    expectedBinding({context, compilation, operation: receipt.operation}),
    'TASK_RECEIPT_REQUEST_MISMATCH',
    '任务回执',
  );
  assertSha(receipt.authorization?.sha256, 'TASK_RECEIPT_AUTHORIZATION_SHA_INVALID', 'authorization.sha256');
  assertSha(receipt.quoteReceipt?.sha256, 'TASK_RECEIPT_QUOTE_SHA_INVALID', 'quoteReceipt.sha256');
  return receipt;
};

const readNetworkAuthorization = ({reference, operation, binding, now}) => {
  const bound = readBoundProjectJsonV2(reference, {
    label: `RunningHub ${operation} 外部联网授权`,
    pathCode: 'NETWORK_AUTHORIZATION_REQUIRED',
    shaCode: 'NETWORK_AUTHORIZATION_SHA_MISMATCH',
    jsonCode: 'NETWORK_AUTHORIZATION_JSON_INVALID',
  });
  const body = bound.body;
  if (
    body.schema !== RUNNINGHUB_NETWORK_AUTHORIZATION_SCHEMA ||
    body.evidenceScope !== 'external-user-message' ||
    body.decision !== 'approved-network-call' ||
    body.operation !== operation ||
    !isText(body.authorizationId) ||
    !isText(body.nonce) ||
    !isText(body.executionGroupId) ||
    !isText(body.issuerGroupId) ||
    body.issuerGroupId === body.executionGroupId ||
    !isText(body.sourceThreadId) ||
    !isText(body.sourceMessageId) ||
    !isText(body.explicitAuthorizationQuote) ||
    body.sourceMessageSha256 !== sha256Text(body.explicitAuthorizationQuote) ||
    stableJsonSha256V2(body.binding) !== stableJsonSha256V2(binding)
  ) {
    fail('NETWORK_AUTHORIZATION_CONTENT_INVALID', `${operation} 必须绑定非执行组的外部用户消息授权与当前请求。`);
  }
  assertSafeIdV2(body.authorizationId, 'NETWORK_AUTHORIZATION_ID_INVALID', 'authorizationId');
  assertSafeIdV2(body.nonce, 'NETWORK_AUTHORIZATION_NONCE_INVALID', 'nonce');
  assertFutureExpiry(body.expiresAt, now, 'NETWORK_AUTHORIZATION_EXPIRED', 'expiresAt');
  const externalAnchor = validateDirectorExternalMessageAnchorV2({
    ...body,
    explicitAcceptanceQuote: body.explicitAuthorizationQuote,
  }, 'runninghub-network-authorization');
  if (!externalAnchor.ok) {
    fail('NETWORK_AUTHORIZATION_EXTERNAL_ANCHOR_INVALID', `${operation} 授权未绑定独立外部消息锚点，执行器自造 thread/message/issuer 无效。`, {reason: externalAnchor.reason});
  }
  const anchor = externalAnchor.entry;
  if (
    anchor.authorizationId !== body.authorizationId ||
    anchor.nonce !== body.nonce ||
    anchor.operation !== operation ||
    anchor.bindingSha256 !== stableJsonSha256V2(binding) ||
    anchor.expiresAt !== body.expiresAt
  ) {
    fail('NETWORK_AUTHORIZATION_EXTERNAL_ANCHOR_BINDING_INVALID', `${operation} 独立外部锚点未绑定 authorizationId、nonce、operation、请求与有效期。`);
  }
  return {bound, body};
};

export const validateApprovedStillUploadProviderResponseV1 = (response) => {
  const data = response?.data;
  if (
    !isRecord(response) ||
    JSON.stringify(Object.keys(response).sort()) !== JSON.stringify(['code', 'data', 'message']) ||
    response.code !== 0 ||
    response.message !== 'success' ||
    !isRecord(data) ||
    JSON.stringify(Object.keys(data).sort()) !== JSON.stringify(['download_url', 'fileName', 'size', 'type']) ||
    data.type !== 'image' ||
    !isText(data.fileName) ||
    !Number.isFinite(Number(data.size)) ||
    Number(data.size) <= 0
  ) {
    fail('UPLOAD_PROVIDER_RESPONSE_INVALID', '上传响应必须严格符合 code/message/data.type/download_url/fileName/size 官方形状。');
  }
  normalizeAssetUrl(data.download_url);
  return response;
};

export const validateApprovedStillUploadReceiptV1 = ({
  receipt,
  planId = null,
  shotId = null,
  source = null,
}) => {
  if (receipt?.schema !== APPROVED_STILL_UPLOAD_RECEIPT_SCHEMA || receipt?.provider !== 'RunningHub') {
    fail('UPLOAD_RECEIPT_SCHEMA_INVALID', '上传回执 schema/provider 不正确。');
  }
  assertSafeIdV2(receipt.receiptId, 'UPLOAD_RECEIPT_ID_INVALID', 'receiptId');
  assertIsoTimestampV2(receipt.uploadedAt, 'UPLOAD_RECEIPT_TIME_INVALID', 'uploadedAt');
  validateApprovedStillUploadProviderResponseV1(receipt.providerResponse);
  if (
    stableJsonSha256V2(receipt.providerResponse) !== receipt.providerResponseSha256 ||
    receipt.imageUrl !== receipt.providerResponse.data.download_url ||
    (planId !== null && receipt.planId !== planId) ||
    (shotId !== null && receipt.shotId !== shotId)
  ) {
    fail('UPLOAD_RECEIPT_PROVIDER_BINDING_INVALID', '上传回执未绑定当前计划、镜头与官方原始响应 SHA。');
  }
  normalizeAssetUrl(receipt.imageUrl);
  assertSha(receipt.sourceSha256, 'UPLOAD_RECEIPT_SOURCE_SHA_INVALID', 'sourceSha256');
  assertSha(receipt.authorization?.sha256, 'UPLOAD_RECEIPT_AUTHORIZATION_SHA_INVALID', 'authorization.sha256');
  if (!isText(receipt.authorization?.path) || !isText(receipt.authorization?.authorizationId)) {
    fail('UPLOAD_RECEIPT_AUTHORIZATION_BINDING_INVALID', '上传回执必须绑定联网授权路径、SHA 与 authorizationId。');
  }
  assertSha(receipt.transportBindingSha256, 'UPLOAD_RECEIPT_TRANSPORT_BINDING_SHA_INVALID', 'transportBindingSha256');
  if (source && (
    receipt.sourcePath !== source.path ||
    receipt.sourceSha256 !== source.sha256 ||
    receipt.sourceDimensions?.width !== source.width ||
    receipt.sourceDimensions?.height !== source.height
  )) {
    fail('UPLOAD_RECEIPT_SOURCE_BINDING_INVALID', '上传回执未绑定批准静帧路径、SHA 与实测尺寸。');
  }
  return receipt;
};

export const computeApprovedStillUploadTransportBindingSha256V1 = ({receipt, authorizationSha256}) => stableJsonSha256V2({
  method: 'POST',
  endpoint: `${RUNNINGHUB_BASE_URL}${RUNNINGHUB_MEDIA_UPLOAD_PATH}`,
  planId: receipt.planId,
  shotId: receipt.shotId,
  sourcePath: receipt.sourcePath,
  sourceSha256: receipt.sourceSha256,
  sourceDimensions: receipt.sourceDimensions,
  authorizationSha256,
  providerResponseSha256: receipt.providerResponseSha256,
  imageUrl: receipt.imageUrl,
});

const assertApprovedStillUploadChainForPaidCall = ({context, compilation, now}) => {
  const evidence = context.shotEvidence.get(compilation.shot.id);
  const receipt = evidence.uploadReceipt.receipt;
  const source = {
    path: evidence.still.relativePath,
    sha256: evidence.still.sha256,
    width: evidence.still.width,
    height: evidence.still.height,
  };
  validateApprovedStillUploadReceiptV1({
    receipt,
    planId: context.plan.planId,
    shotId: compilation.shot.id,
    source,
  });
  if (Number(receipt.providerResponse.data.size) !== readFileSync(evidence.still.absolutePath).length) {
    fail('UPLOAD_RECEIPT_PROVIDER_SIZE_MISMATCH', '上传回执 provider size 与批准静帧真实字节数不一致。');
  }
  const binding = {
    planId: context.plan.planId,
    shotId: compilation.shot.id,
    sourcePath: source.path,
    sourceSha256: source.sha256,
    sourceDimensions: {width: source.width, height: source.height},
  };
  const authorization = readNetworkAuthorization({
    reference: receipt.authorization,
    operation: 'still-upload',
    binding,
    now,
  });
  if (
    receipt.authorization.authorizationId !== authorization.body.authorizationId ||
    receipt.receiptId !== `upload-${authorization.body.authorizationId}` ||
    receipt.transportBindingSha256 !== computeApprovedStillUploadTransportBindingSha256V1({
      receipt,
      authorizationSha256: authorization.bound.sha256,
    })
  ) {
    fail('UPLOAD_RECEIPT_TRANSPORT_CHAIN_INVALID', '付费请求前上传回执必须绑定 plan/shot、外部授权与唯一上传 transport 证据。');
  }
  return {receipt, authorization};
};

export const uploadApprovedStillRunningHubV2 = async ({
  planId,
  shotId,
  still,
  sourceDimensions,
  networkAuthorizationRef,
  apiKey,
  transport,
}) => {
  const now = trustedNow();
  assertSafeIdV2(planId, 'UPLOAD_PLAN_ID_INVALID', 'planId');
  assertSafeIdV2(shotId, 'UPLOAD_SHOT_ID_INVALID', 'shotId');
  const file = assertFileReferenceV2(still, {label: '待上传批准静帧', pathCode: 'UPLOAD_STILL_REQUIRED', shaCode: 'UPLOAD_STILL_SHA_MISMATCH'});
  if (!Number.isInteger(sourceDimensions?.width) || !Number.isInteger(sourceDimensions?.height) || sourceDimensions.width <= 0 || sourceDimensions.height <= 0) {
    fail('UPLOAD_SOURCE_DIMENSIONS_INVALID', '上传必须绑定批准静帧尺寸。');
  }
  const binding = {planId, shotId, sourcePath: file.relativePath, sourceSha256: file.sha256, sourceDimensions};
  const authorization = readNetworkAuthorization({reference: networkAuthorizationRef, operation: 'still-upload', binding, now});
  assertRunningHubTrustedTransportAvailableV2();
  const response = await invokeTransport({
    transport,
    apiKey,
    url: `${RUNNINGHUB_BASE_URL}${RUNNINGHUB_MEDIA_UPLOAD_PATH}`,
    multipart: {fieldName: 'file', filePath: file.absolutePath, fileSha256: file.sha256},
    operation: 'upload',
  });
  validateApprovedStillUploadProviderResponseV1(response);
  if (Number(response.data.size) !== readFileSync(file.absolutePath).length) {
    fail('UPLOAD_PROVIDER_SIZE_MISMATCH', '上传响应 size 与本地批准静帧字节数不一致。');
  }
  const providerResponseSha256 = stableJsonSha256V2(response);
  const receipt = {
    schema: APPROVED_STILL_UPLOAD_RECEIPT_SCHEMA,
    receiptId: `upload-${authorization.body.authorizationId}`,
    provider: 'RunningHub',
    planId,
    shotId,
    sourcePath: file.relativePath,
    sourceSha256: file.sha256,
    sourceDimensions,
    imageUrl: response.data.download_url,
    uploadedAt: now.toISOString(),
    providerResponse: response,
    providerResponseSha256,
    authorization: {
      path: authorization.bound.relativePath,
      sha256: authorization.bound.sha256,
      authorizationId: authorization.body.authorizationId,
    },
  };
  receipt.transportBindingSha256 = computeApprovedStillUploadTransportBindingSha256V1({
    receipt,
    authorizationSha256: authorization.bound.sha256,
  });
  return receipt;
};

const readTaskReceipt = ({reference, context, compilation}) => {
  const bound = readBoundProjectJsonV2(reference, {
    label: 'RunningHub H3 task 回执',
    pathCode: 'TASK_RECEIPT_REQUIRED',
    shaCode: 'TASK_RECEIPT_SHA_MISMATCH',
    jsonCode: 'TASK_RECEIPT_JSON_INVALID',
  });
  validateRunningHubH3V2TaskReceipt({context, compilation, receipt: bound.body});
  return {bound, receipt: bound.body};
};

export const validateRunningHubH3V2QueryProviderResponse = (response, taskId) => {
  const allowedKeys = new Set(['taskId', 'status', 'errorCode', 'errorMessage', 'results', 'clientId', 'promptTips']);
  if (
    !isRecord(response) ||
    Object.keys(response).some((key) => !allowedKeys.has(key)) ||
    response.taskId !== taskId ||
    !['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED'].includes(response.status) ||
    !Object.hasOwn(response, 'errorCode') ||
    !Object.hasOwn(response, 'errorMessage')
  ) {
    fail('QUERY_PROVIDER_RESPONSE_INVALID', 'query 响应必须符合 taskId/status/errorCode/errorMessage/results/clientId/promptTips 官方形状。');
  }
  if (response.status === 'SUCCESS') {
    if (!Array.isArray(response.results) || !response.results.length || response.results.some((item) => !isRecord(item) || !isText(item.url) || !isText(item.outputType))) {
      fail('QUERY_SUCCESS_RESULTS_INVALID', 'SUCCESS query 必须返回非空 results[url,outputType]。');
    }
    for (const item of response.results) normalizeAssetUrl(item.url);
  }
  return response;
};

export const queryRunningHubH3V2Task = async ({
  context,
  shotId,
  taskReceiptRef,
  networkAuthorizationRef,
  apiKey,
  transport,
}) => {
  const now = trustedNow();
  const compilation = compileRunningHubH3V2Shot({context, shotId});
  const task = readTaskReceipt({reference: taskReceiptRef, context, compilation});
  const operationMode = task.receipt.operation === 'production-run' ? 'production' : 'style-sample';
  assertGeneratedVideoPlanV2Operation(
    context,
    operationMode,
    operationMode === 'production' ? 'generated-video-production-query' : null,
  );
  const binding = {
    planId: context.plan.planId,
    shotId,
    taskId: task.receipt.taskId,
    taskReceiptSha256: task.bound.sha256,
    requestBodySha256: stableJsonSha256V2({taskId: task.receipt.taskId}),
  };
  const authorization = readNetworkAuthorization({reference: networkAuthorizationRef, operation: 'task-query', binding, now});
  assertRunningHubTrustedTransportAvailableV2();
  const response = await invokeTransport({
    transport,
    apiKey,
    url: `${RUNNINGHUB_BASE_URL}${RUNNINGHUB_H3_V2_QUERY_PATH}`,
    body: {taskId: task.receipt.taskId},
    operation: 'query',
  });
  validateRunningHubH3V2QueryProviderResponse(response, task.receipt.taskId);
  return {
    schema: RUNNINGHUB_H3_V2_QUERY_RECEIPT_SCHEMA,
    provider: 'RunningHub',
    operation: task.receipt.operation,
    taskId: task.receipt.taskId,
    queriedAt: now.toISOString(),
    taskReceipt: {path: task.bound.relativePath, sha256: task.bound.sha256},
    providerResponse: response,
    providerResponseSha256: stableJsonSha256V2(response),
    requestBody: {taskId: task.receipt.taskId},
    requestBodySha256: stableJsonSha256V2({taskId: task.receipt.taskId}),
    authorization: {path: authorization.bound.relativePath, sha256: authorization.bound.sha256},
  };
};

export const validateRunningHubH3V2QueryReceipt = ({
  receipt,
  taskReceipt,
  taskReceiptSha256,
}) => {
  if (
    receipt?.schema !== RUNNINGHUB_H3_V2_QUERY_RECEIPT_SCHEMA ||
    receipt?.provider !== 'RunningHub' ||
    !isRecord(taskReceipt) ||
    receipt.operation !== taskReceipt.operation ||
    receipt.taskId !== taskReceipt.taskId ||
    receipt.taskReceipt?.sha256 !== taskReceiptSha256 ||
    stableJsonSha256V2(receipt.providerResponse) !== receipt.providerResponseSha256 ||
    stableJsonSha256V2(receipt.requestBody) !== receipt.requestBodySha256 ||
    JSON.stringify(receipt.requestBody) !== JSON.stringify({taskId: taskReceipt.taskId}) ||
    !isText(receipt.queriedAt) || Number.isNaN(Date.parse(receipt.queriedAt))
  ) {
    fail('QUERY_RECEIPT_BINDING_INVALID', 'query 回执未绑定当前 task、唯一 query body、时间与官方响应 SHA。');
  }
  validateRunningHubH3V2QueryProviderResponse(receipt.providerResponse, taskReceipt.taskId);
  return receipt;
};

export const createRunningHubH3V2ResultReceipt = ({context, shotId, taskReceiptRef, queryReceiptRef}) => {
  const compilation = compileRunningHubH3V2Shot({context, shotId});
  const task = readTaskReceipt({reference: taskReceiptRef, context, compilation});
  const query = readBoundProjectJsonV2(queryReceiptRef, {
    label: 'RunningHub H3 query 回执',
    pathCode: 'QUERY_RECEIPT_REQUIRED',
    shaCode: 'QUERY_RECEIPT_SHA_MISMATCH',
    jsonCode: 'QUERY_RECEIPT_JSON_INVALID',
  });
  const body = query.body;
  validateRunningHubH3V2QueryReceipt({receipt: body, taskReceipt: task.receipt, taskReceiptSha256: task.bound.sha256});
  if (body.providerResponse.status !== 'SUCCESS') fail('QUERY_RESULT_NOT_READY', 'query 尚未 SUCCESS，不能生成 result 回执。');
  const videoResults = body.providerResponse.results.filter((item) => videoOutputType(item.outputType));
  if (videoResults.length !== 1) fail('QUERY_VIDEO_RESULT_NOT_UNIQUE', 'SUCCESS 结果必须有且仅有一个视频输出。');
  const result = videoResults[0];
  return {
    schema: RUNNINGHUB_H3_V2_RESULT_RECEIPT_SCHEMA,
    provider: 'RunningHub',
    operation: task.receipt.operation,
    taskId: task.receipt.taskId,
    taskReceipt: {path: task.bound.relativePath, sha256: task.bound.sha256},
    queryReceipt: {path: query.relativePath, sha256: query.sha256},
    resultUrl: normalizeAssetUrl(result.url),
    outputType: result.outputType,
    resultBindingSha256: stableJsonSha256V2({taskReceiptSha256: task.bound.sha256, queryReceiptSha256: query.sha256, taskId: task.receipt.taskId, result}),
  };
};

export const validateRunningHubH3V2ResultReceipt = ({
  receipt,
  taskReceipt,
  taskReceiptSha256,
  queryReceipt,
  queryReceiptSha256,
}) => {
  validateRunningHubH3V2QueryReceipt({receipt: queryReceipt, taskReceipt, taskReceiptSha256});
  if (queryReceipt.providerResponse.status !== 'SUCCESS') {
    fail('QUERY_RESULT_NOT_READY', 'query 尚未 SUCCESS，不能验证 result 回执。');
  }
  const videoResults = queryReceipt.providerResponse.results.filter((item) => videoOutputType(item.outputType));
  if (videoResults.length !== 1) fail('QUERY_VIDEO_RESULT_NOT_UNIQUE', 'SUCCESS 结果必须有且仅有一个视频输出。');
  const result = videoResults[0];
  const expectedBindingSha256 = stableJsonSha256V2({
    taskReceiptSha256,
    queryReceiptSha256,
    taskId: taskReceipt.taskId,
    result,
  });
  if (
    receipt?.schema !== RUNNINGHUB_H3_V2_RESULT_RECEIPT_SCHEMA ||
    receipt?.provider !== 'RunningHub' ||
    receipt.operation !== taskReceipt.operation ||
    receipt.taskId !== taskReceipt.taskId ||
    receipt.taskReceipt?.sha256 !== taskReceiptSha256 ||
    receipt.queryReceipt?.sha256 !== queryReceiptSha256 ||
    receipt.resultUrl !== result.url ||
    receipt.outputType !== result.outputType ||
    receipt.resultBindingSha256 !== expectedBindingSha256
  ) {
    fail('RESULT_RECEIPT_BINDING_INVALID', 'result 回执未唯一绑定 task/query/官方视频结果。');
  }
  normalizeAssetUrl(receipt.resultUrl);
  return receipt;
};

export const inspectRunningHubDownloadedMp4BufferV2 = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) {
    fail('DOWNLOAD_BODY_INVALID', '下载响应没有真实二进制媒体。');
  }
  const probeResult = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=format_name,duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', 'pipe:0'],
    {input: buffer, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024},
  );
  if (probeResult.status !== 0) fail('DOWNLOAD_MP4_CONTAINER_INVALID', '下载响应不是 ffprobe 可识别的真实 MP4 容器。');
  let probe;
  try { probe = JSON.parse(probeResult.stdout); }
  catch { fail('DOWNLOAD_MP4_CONTAINER_INVALID', '下载媒体 ffprobe JSON 无法解析。'); }
  const formats = String(probe.format?.format_name ?? '').split(',');
  const videoStreams = (probe.streams ?? []).filter((stream) => stream.codec_type === 'video');
  if (!formats.some((name) => name === 'mp4' || name === 'mov') || videoStreams.length !== 1 || !(Number(probe.format?.duration) > 0)) {
    fail('DOWNLOAD_MP4_CONTAINER_INVALID', '下载媒体必须是含唯一视频流且正时长的 MP4。');
  }
  const decodeResult = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', 'pipe:0', '-map', '0:v:0', '-f', 'null', '-'],
    {input: buffer, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024},
  );
  if (decodeResult.status !== 0) fail('DOWNLOAD_MP4_FULL_DECODE_FAILED', '下载媒体未通过视频流全解码。');
  const video = videoStreams[0];
  return {
    formatName: String(probe.format.format_name),
    durationSeconds: Number(probe.format.duration),
    width: Number(video.width),
    height: Number(video.height),
    frameRate: String(video.r_frame_rate ?? ''),
    videoStreamCount: videoStreams.length,
    fullDecodePassed: true,
    outputBytes: buffer.length,
    outputSha256: createHash('sha256').update(buffer).digest('hex'),
  };
};

export const validateRunningHubH3V2DownloadReceipt = ({
  receipt,
  resultReceipt,
  resultReceiptSha256,
  taskReceipt,
  taskReceiptSha256,
  queryReceipt,
  queryReceiptSha256,
  checkFile = true,
}) => {
  validateRunningHubH3V2ResultReceipt({
    receipt: resultReceipt,
    taskReceipt,
    taskReceiptSha256,
    queryReceipt,
    queryReceiptSha256,
  });
  if (
    receipt?.schema !== RUNNINGHUB_H3_V2_DOWNLOAD_RECEIPT_SCHEMA ||
    receipt?.provider !== 'RunningHub' ||
    receipt.taskId !== resultReceipt?.taskId ||
    receipt.operation !== resultReceipt?.operation ||
    receipt.resultReceipt?.sha256 !== resultReceiptSha256 ||
    receipt.queryReceipt?.sha256 !== queryReceiptSha256 ||
    receipt.queryReceipt?.path !== resultReceipt?.queryReceipt?.path ||
    receipt.remoteUrl !== resultReceipt?.resultUrl ||
    !Number.isInteger(receipt.outputBytes) || receipt.outputBytes <= 0 ||
    !['video/mp4', 'application/mp4', 'application/octet-stream'].includes(receipt.contentType) ||
    !isRecord(receipt.mediaVerification) ||
    receipt.mediaVerification.fullDecodePassed !== true ||
    receipt.mediaVerification.outputSha256 !== receipt.outputSha256 ||
    receipt.mediaVerification.outputBytes !== receipt.outputBytes ||
    !isText(receipt.downloadedAt) || Number.isNaN(Date.parse(receipt.downloadedAt))
  ) {
    fail('DOWNLOAD_RECEIPT_BINDING_INVALID', '下载回执未绑定 result、远程 URL、字节数与时间。');
  }
  assertSha(receipt.outputSha256, 'DOWNLOAD_RECEIPT_OUTPUT_SHA_INVALID', 'outputSha256');
  assertSha(receipt.authorization?.sha256, 'DOWNLOAD_RECEIPT_AUTHORIZATION_SHA_INVALID', 'authorization.sha256');
  normalizeAssetUrl(receipt.remoteUrl);
  if (checkFile) {
    const output = assertFileReferenceV2(
      {path: receipt.outputPath, sha256: receipt.outputSha256},
      {label: '下载成片', pathCode: 'DOWNLOAD_OUTPUT_MISSING', shaCode: 'DOWNLOAD_OUTPUT_SHA_MISMATCH'},
    );
    const bytes = readFileSync(output.absolutePath);
    if (bytes.length !== receipt.outputBytes) {
      fail('DOWNLOAD_OUTPUT_BYTES_MISMATCH', '下载回执 outputBytes 与真实文件不一致。');
    }
    const media = inspectRunningHubDownloadedMp4BufferV2(bytes);
    if (
      media.outputSha256 !== receipt.outputSha256 ||
      stableJsonSha256V2(media) !== stableJsonSha256V2(receipt.mediaVerification)
    ) {
      fail('DOWNLOAD_MEDIA_VERIFICATION_MISMATCH', '下载回执未绑定真实 MP4 全解码与哈希检查。');
    }
  }
  return receipt;
};

export const downloadRunningHubH3V2Result = async ({
  context,
  shotId,
  resultReceiptRef,
  outputPath,
  networkAuthorizationRef,
  transport,
}) => {
  const now = trustedNow();
  const result = readBoundProjectJsonV2(resultReceiptRef, {
    label: 'RunningHub H3 result 回执',
    pathCode: 'RESULT_RECEIPT_REQUIRED',
    shaCode: 'RESULT_RECEIPT_SHA_MISMATCH',
    jsonCode: 'RESULT_RECEIPT_JSON_INVALID',
  });
  const body = result.body;
  if (
    body.schema !== RUNNINGHUB_H3_V2_RESULT_RECEIPT_SCHEMA ||
    !isText(body.taskId) ||
    !isText(body.outputType) ||
    !isText(body.resultBindingSha256) ||
    !isText(body.taskReceipt?.path) || !isText(body.taskReceipt?.sha256) ||
    !isText(body.queryReceipt?.path) || !isText(body.queryReceipt?.sha256)
  ) {
    fail('RESULT_RECEIPT_CONTENT_INVALID', 'result 回执 schema/task/output/binding 不完整。');
  }
  const compilation = compileRunningHubH3V2Shot({context, shotId});
  const task = readTaskReceipt({reference: body.taskReceipt, context, compilation});
  if (task.receipt.taskId !== body.taskId || task.receipt.operation !== body.operation) {
    fail('RESULT_TASK_RECEIPT_BINDING_INVALID', 'result 回执未绑定当前 task operation。');
  }
  const query = readBoundProjectJsonV2(body.queryReceipt, {
    label: 'RunningHub H3 query 回执',
    pathCode: 'QUERY_RECEIPT_REQUIRED',
    shaCode: 'QUERY_RECEIPT_SHA_MISMATCH',
    jsonCode: 'QUERY_RECEIPT_JSON_INVALID',
  });
  validateRunningHubH3V2ResultReceipt({
    receipt: body,
    taskReceipt: task.receipt,
    taskReceiptSha256: task.bound.sha256,
    queryReceipt: query.body,
    queryReceiptSha256: query.sha256,
  });
  const operationMode = task.receipt.operation === 'production-run' ? 'production' : 'style-sample';
  assertGeneratedVideoPlanV2Operation(
    context,
    operationMode,
    operationMode === 'production' ? 'generated-video-production-download' : null,
  );
  const url = normalizeAssetUrl(body.resultUrl);
  const absolute = resolveProjectTarget(outputPath, '下载输出');
  if (existsSync(absolute)) fail('DOWNLOAD_OUTPUT_ALREADY_EXISTS', '下载输出已存在，禁止发起网络请求或覆盖。');
  const binding = {
    taskId: body.taskId,
    planId: context.plan.planId,
    shotId,
    taskReceiptSha256: task.bound.sha256,
    queryReceiptSha256: query.sha256,
    resultReceiptSha256: result.sha256,
    resultBindingSha256: body.resultBindingSha256,
    remoteUrl: url,
    outputPath: relative(generatedVideoProjectRootV2, absolute).split(sep).join('/'),
  };
  const authorization = readNetworkAuthorization({reference: networkAuthorizationRef, operation: 'result-download', binding, now});
  assertRunningHubTrustedTransportAvailableV2();
  const response = await invokeTransport({
    transport,
    url,
    method: 'GET',
    operation: 'download',
    assetUrl: true,
    requiresApiKey: false,
  });
  const buffer = response?.body;
  const contentType = String(response?.contentType ?? response?.headers?.['content-type'] ?? response?.headers?.get?.('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!['video/mp4', 'application/mp4', 'application/octet-stream'].includes(contentType)) {
    fail('DOWNLOAD_CONTENT_TYPE_INVALID', '下载响应 Content-Type 必须是 MP4 或通用二进制媒体。');
  }
  const mediaVerification = inspectRunningHubDownloadedMp4BufferV2(buffer);
  assertNoRetiredGeneratedContentShaV2([mediaVerification.outputSha256], 'RunningHub H3 下载结果');
  mkdirSync(dirname(absolute), {recursive: true});
  const temporary = `${absolute}.part-${mediaVerification.outputSha256.slice(0, 16)}`;
  let descriptor;
  try {
    descriptor = openSync(temporary, 'wx', 0o600);
    writeFileSync(descriptor, buffer);
    closeSync(descriptor);
    descriptor = undefined;
    if (existsSync(absolute)) fail('DOWNLOAD_OUTPUT_ALREADY_EXISTS', '下载输出已存在，禁止覆盖。');
    renameSync(temporary, absolute);
  } catch (error) {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch {}
    }
    if (existsSync(temporary)) {
      try { unlinkSync(temporary); } catch {}
    }
    if (error?.code === 'EEXIST') fail('DOWNLOAD_OUTPUT_ALREADY_EXISTS', '下载输出或临时目标已存在，禁止覆盖。');
    if (error instanceof GeneratedVideoPlanV2Error) throw error;
    fail('DOWNLOAD_WRITE_FAILED', '下载输出原子写入失败。');
  }
  return {
    schema: RUNNINGHUB_H3_V2_DOWNLOAD_RECEIPT_SCHEMA,
    provider: 'RunningHub',
    operation: body.operation,
    taskId: body.taskId,
    queryReceipt: {path: query.relativePath, sha256: query.sha256},
    resultReceipt: {path: result.relativePath, sha256: result.sha256},
    remoteUrl: url,
    outputPath: relative(generatedVideoProjectRootV2, absolute).split(sep).join('/'),
    outputSha256: mediaVerification.outputSha256,
    outputBytes: buffer.length,
    contentType,
    mediaVerification,
    downloadedAt: now.toISOString(),
    authorization: {path: authorization.bound.relativePath, sha256: authorization.bound.sha256},
  };
};
