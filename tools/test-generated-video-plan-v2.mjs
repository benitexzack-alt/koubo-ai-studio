#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {
  APPROVED_STILL_APPROVAL_SCHEMA,
  APPROVED_STILL_UPLOAD_RECEIPT_SCHEMA,
  RUNNINGHUB_H3_PRODUCT_ROUTE,
  assertRealMp4VideoV2,
  loadGeneratedVideoPlanV2,
  stableJsonSha256V2,
} from './generated-video-plan-v2-core.mjs';
import {
  RUNNINGHUB_H3_V2_DOWNLOAD_RECEIPT_SCHEMA,
  RUNNINGHUB_H3_V2_FIXED_LEDGER_PATH,
  RUNNINGHUB_H3_V2_QUERY_PATH,
  RUNNINGHUB_H3_V2_QUERY_RECEIPT_SCHEMA,
  RUNNINGHUB_H3_V2_QUOTE_PATH,
  RUNNINGHUB_H3_V2_RESULT_RECEIPT_SCHEMA,
  RUNNINGHUB_H3_V2_SUBMIT_PATH,
  RUNNINGHUB_H3_V2_TASK_RECEIPT_SCHEMA,
  RUNNINGHUB_MEDIA_UPLOAD_PATH,
  RUNNINGHUB_NETWORK_AUTHORIZATION_SCHEMA,
  RUNNINGHUB_PROVIDER_TRANSPORT_TRUST_STATE,
  RUNNINGHUB_PAID_AUTHORIZATION_SCHEMA,
  RUNNINGHUB_USER_AUTHORIZATION_EVIDENCE_SCHEMA,
  assertRunningHubH3V2Payload,
  assertRunningHubTrustedTransportAvailableV2,
  compileRunningHubH3V2Shot,
  computeApprovedStillUploadTransportBindingSha256V1,
  createRunningHubH3V2ResultReceipt,
  downloadRunningHubH3V2Result,
  inspectRunningHubDownloadedMp4BufferV2,
  queryRunningHubH3V2Task,
  quoteRunningHubH3V2Shot,
  readRunningHubUserAuthorizationEvidenceV2,
  runRunningHubH3V2Shot,
  uploadApprovedStillRunningHubV2,
  validateApprovedStillUploadProviderResponseV1,
  validateApprovedStillUploadReceiptV1,
  validateRunningHubH3V2DownloadReceipt,
  validateRunningHubH3V2PriceProviderResponse,
  validateRunningHubPaidAuthorizationEnvelopeV2,
  validateRunningHubH3V2QueryProviderResponse,
  validateRunningHubH3V2QueryReceipt,
  validateRunningHubH3V2ResultReceipt,
  validateRunningHubH3V2SubmitProviderResponse,
  validateRunningHubH3V2TaskReceipt,
} from './runninghub-generated-video-v2-adapter.mjs';
import {createActualFixture as createDirectorFixture} from '../skills/koubo-remotion-director/scripts/test-director-contract-v2.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const protocolRecording = JSON.parse(readFileSync(resolve(
  projectRoot,
  'skills/koubo-remotion-director/fixtures/runninghub-h3-official-protocol-recording.v1.json',
), 'utf8'));
const temporaryRoot = mkdtempSync(join(projectRoot, 'edit', '.generated-video-v2-test-'));
const projectRelative = (path) => relative(projectRoot, path).split('\\').join('/');
const sha256Buffer = (value) => createHash('sha256').update(value).digest('hex');
const sha256File = (path) => sha256Buffer(readFileSync(path));
const sha256Text = (value) => sha256Buffer(value);
const clone = (value) => structuredClone(value);

const writeJson = (path, value) => {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return {path: projectRelative(path), sha256: sha256File(path)};
};
const writeBytes = (path, value) => {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, value);
  return {path: projectRelative(path), sha256: sha256File(path)};
};
const run = (command, args) => {
  const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})\n${result.stderr}\n${result.stdout}`);
  return result;
};
const expectCode = (fn, code) => assert.throws(fn, (error) => {
  assert.equal(error?.code, code, `期望 ${code}，实际 ${error?.code}`);
  return true;
});
const expectRejectCode = async (promise, code) => assert.rejects(promise, (error) => {
  assert.equal(error?.code, code, `期望 ${code}，实际 ${error?.code}`);
  return true;
});

const priceResponse = (amount = 3.1) => ({
  ...clone(protocolRecording.records.pricePreview.response),
  estimatedPrice: amount,
  priceText: `${amount}元`,
});

const makeStillEvidence = ({root, planId, shotId = 'G01', suffix = ''}) => {
  const stillPath = join(root, `approved${suffix}.png`);
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x9a7655:s=1920x1080', '-frames:v', '1', stillPath]);
  const still = {path: projectRelative(stillPath), sha256: sha256File(stillPath), width: 1920, height: 1080};
  const approval = writeJson(join(root, `still-approval${suffix}.json`), {
    schema: APPROVED_STILL_APPROVAL_SCHEMA,
    planId,
    shotId,
    stillPath: still.path,
    stillSha256: still.sha256,
    reviewerKind: 'user',
    reviewer: 'authorized-user',
    reviewedAt: '2026-08-24T08:00:00.000Z',
    decision: 'approved-completed-state-still',
  });
  still.approvalReceipt = approval;
  const imageUrl = `https://fixture.cos.ap-guangzhou.myqcloud.com/${planId}/${shotId}.png`;
  const providerResponse = {
    code: 0,
    message: 'success',
    data: {type: 'image', download_url: imageUrl, fileName: `${shotId}.png`, size: statSync(stillPath).size},
  };
  const uploadBinding = {
    planId,
    shotId,
    sourcePath: still.path,
    sourceSha256: still.sha256,
    sourceDimensions: {width: 1920, height: 1080},
  };
  const uploadAuthorization = makeNetworkAuthorization({
    root,
    operation: 'still-upload',
    binding: uploadBinding,
    id: `still-upload-${planId}-${shotId}${suffix || ''}`,
  });
  const uploadBody = {
    schema: APPROVED_STILL_UPLOAD_RECEIPT_SCHEMA,
    receiptId: `upload-still-upload-${planId}-${shotId}${suffix || ''}`,
    provider: 'RunningHub',
    planId,
    shotId,
    sourcePath: still.path,
    sourceSha256: still.sha256,
    sourceDimensions: {width: 1920, height: 1080},
    imageUrl,
    uploadedAt: '2026-08-24T08:05:00.000Z',
    providerResponse,
    providerResponseSha256: stableJsonSha256V2(providerResponse),
    authorization: {
      ...uploadAuthorization,
      authorizationId: `still-upload-${planId}-${shotId}${suffix || ''}`,
    },
  };
  uploadBody.transportBindingSha256 = computeApprovedStillUploadTransportBindingSha256V1({
    receipt: uploadBody,
    authorizationSha256: uploadAuthorization.sha256,
  });
  const upload = writeJson(join(root, `upload${suffix}.json`), uploadBody);
  return {still, upload, imageUrl, providerResponse, stillPath};
};

const provider = {
  platform: 'RunningHub',
  model: 'MiniMax-H3',
  modelRoute: RUNNINGHUB_H3_PRODUCT_ROUTE,
  resolution: '2K',
  aspectRatio: '16:9',
  durationSeconds: {min: 5, max: 15},
  aigcWatermark: false,
};

const makeSampleFixture = (name = 'sample') => {
  const root = join(temporaryRoot, name);
  mkdirSync(root, {recursive: true});
  const planId = `plan-${name}`;
  const stylePath = join(root, 'style.json');
  const style = {id: 'koubo-paper-editorial-assembly-v2-candidate', status: 'blocked-candidate', productionEligible: false};
  const styleRef = writeJson(stylePath, style);
  const evidence = makeStillEvidence({root, planId});
  const planPath = join(root, 'plan.json');
  const plan = {
    schema: 'generated-video-plan/v2',
    schemaVersion: 'generated-video-plan/v2',
    executionMode: 'style-sample',
    planId,
    videoId: `video-${name}`,
    planPath: projectRelative(planPath),
    styleReference: {id: style.id, ...styleRef},
    provider,
    productionEligibility: {productionEligible: false, state: 'candidate-blocked'},
    shots: [{
      id: 'G01', spokenAnchor: {text: '这些证据会被装配成一条可追溯的因果链。', startSeconds: 0, endSeconds: 6},
      prompt: '纸媒编辑装配风格，三层纸板顺序滑入，完成后定格一秒。', durationSeconds: 6,
      approvedStill: evidence.still,
      uploadReceipt: evidence.upload,
    }],
  };
  writeJson(planPath, plan);
  return {root, planPath, plan, evidence};
};

const requestBinding = ({context, compilation, operation}) => ({
  operation,
  planId: context.plan.planId,
  planDefinitionSha256: context.planDefinitionSha256,
  styleSha256: context.styleSha256,
  shotId: compilation.shot.id,
  requestDefinitionSha256: compilation.requestDefinitionSha256,
  payloadSha256: compilation.payloadSha256,
  approvedStillSha256: context.shotEvidence.get(compilation.shot.id).still.sha256,
  approvedStillUploadReceiptSha256: context.shotEvidence.get(compilation.shot.id).uploadReceipt.sha256,
});

let authCounter = 0;
const makePaidAuthorization = ({root, context, compilation, operation, amount = 3.1, quoteReceipt = null, mutate = null}) => {
  authCounter += 1;
  const authorizationId = `auth-${operation}-${authCounter}`;
  const nonce = `nonce-${operation}-${authCounter}`;
  const binding = requestBinding({context, compilation, operation});
  const quote = `我确认本次 ${operation} 精确金额 ${amount} 元，仅限当前请求单次使用。`;
  const evidence = writeJson(join(root, `evidence-${authorizationId}.json`), {
    schema: RUNNINGHUB_USER_AUTHORIZATION_EVIDENCE_SCHEMA,
    evidenceScope: 'external-user-message',
    decision: 'approved-exact-paid-call',
    reviewerKind: 'user',
    reviewerId: 'authorized-user',
    issuerGroupId: 'user-authorization-group',
    sourceThreadId: `thread-${authCounter}`,
    sourceMessageId: `message-${authCounter}`,
    explicitAuthorizationQuote: quote,
    messageSha256: sha256Text(quote),
    authorizationId,
    nonce,
    operation,
    currency: 'CNY',
    exactCostCny: amount,
    requestBinding: binding,
    approvedAt: '2026-08-24T08:10:00.000Z',
    expiresAt: '2099-08-24T09:00:00.000Z',
  });
  const body = {
    schema: RUNNINGHUB_PAID_AUTHORIZATION_SCHEMA,
    authorizationId,
    nonce,
    executionGroupId: 'adapter-execution-group',
    decision: 'approved-exact-paid-call',
    allowNetwork: true,
    allowPaid: true,
    maxSubmissions: 1,
    operation,
    currency: 'CNY',
    exactCostCny: amount,
    approvedAt: '2026-08-24T08:10:00.000Z',
    expiresAt: '2099-08-24T09:00:00.000Z',
    requestBinding: binding,
    userEvidence: evidence,
    ...(operation.endsWith('-run') && quoteReceipt ? {
      quoteReceiptSha256: quoteReceipt.sha256,
      quoteReceiptId: quoteReceipt.quoteReceiptId,
    } : {}),
  };
  if (mutate) mutate(body);
  return writeJson(join(root, `authorization-${authorizationId}.json`), body);
};

const makeNetworkAuthorization = ({root, operation, binding, id}) => {
  const quote = `我授权当前 ${operation} 单次联网操作。`;
  return writeJson(join(root, `network-${id}.json`), {
    schema: RUNNINGHUB_NETWORK_AUTHORIZATION_SCHEMA,
    evidenceScope: 'external-user-message',
    decision: 'approved-network-call',
    operation,
    authorizationId: id,
    nonce: `nonce-${id}`,
    executionGroupId: 'adapter-execution-group',
    issuerGroupId: 'user-authorization-group',
    sourceThreadId: `thread-${id}`,
    sourceMessageId: `message-${id}`,
    explicitAuthorizationQuote: quote,
    sourceMessageSha256: sha256Text(quote),
    binding,
    expiresAt: '2099-08-24T09:00:00.000Z',
  });
};

const tests = [];
const test = (name, fn) => tests.push({name, fn});
const now = new Date('2026-08-24T08:20:00.000Z');
const apiKey = 'fixture-secret-key-never-print';

const sample = makeSampleFixture('official-shape');
const context = loadGeneratedVideoPlanV2(sample.planPath);
const compilation = compileRunningHubH3V2Shot({context, shotId: 'G01'});

test('离线协议录制夹具逐段锁定官方 price/upload/submit/query/download 形状且不冒充真实 transport', () => {
  assert.equal(protocolRecording.notLiveProviderReceipt, true);
  assert.equal(protocolRecording.evidenceScope, 'offline-protocol-regression-only');
  assert.equal(protocolRecording.records.pricePreview.path, RUNNINGHUB_H3_V2_QUOTE_PATH);
  assert.equal(protocolRecording.records.submit.path, RUNNINGHUB_H3_V2_SUBMIT_PATH);
  assert.equal(protocolRecording.records.query.path, RUNNINGHUB_H3_V2_QUERY_PATH);
  assert.equal(protocolRecording.records.upload.path, RUNNINGHUB_MEDIA_UPLOAD_PATH);
  validateRunningHubH3V2PriceProviderResponse(protocolRecording.records.pricePreview.response);
  validateApprovedStillUploadProviderResponseV1(protocolRecording.records.upload.response);
  validateRunningHubH3V2SubmitProviderResponse(protocolRecording.records.submit.response);
  validateRunningHubH3V2QueryProviderResponse(
    protocolRecording.records.query.response,
    protocolRecording.records.query.request.taskId,
  );
  assert.equal(protocolRecording.records.query.response.results[0].outputType, 'mp4');
  assert.equal(protocolRecording.records.download.contentType, 'video/mp4');
});

test('真实 provider transport 尚无独立证明时保持硬阻断，离线 fixture 不得解锁', () => {
  assert.equal(RUNNINGHUB_PROVIDER_TRANSPORT_TRUST_STATE, 'blocked-no-provider-transport-attestation');
  expectCode(() => assertRunningHubTrustedTransportAvailableV2(), 'RUNNINGHUB_TRUSTED_TRANSPORT_UNAVAILABLE');
});

test('离线编译严格输出官方 H3 body，不夹带内部 envelope', () => {
  assert.deepEqual(Object.keys(compilation.payload).sort(), ['aigc_watermark', 'duration', 'imageUrls', 'prompt', 'ratio', 'resolution']);
  assert.deepEqual(compilation.payload.imageUrls, [sample.evidence.imageUrl]);
  assert.equal(compilation.requestDefinition.productRoute, '/minimax/hailuo-h3/multimodal-to-video');
  assert.equal(compilation.requestDefinition.submitPath, RUNNINGHUB_H3_V2_SUBMIT_PATH);
  assert.equal(compilation.requestDefinition.quotePath, RUNNINGHUB_H3_V2_QUOTE_PATH);
});

test('伪造 productRoute/quoteId/auth/nonce 顶层字段被稳定拒绝', () => {
  expectCode(() => assertRunningHubH3V2Payload({...compilation.payload, quoteId: 'fake'}, {approvedImageUrl: sample.evidence.imageUrl}), 'H3_PAYLOAD_FIELDS_INVALID');
});

test('腾讯 COS download_url 必须由官方上传响应和 SHA 绑定', () => {
  assert.match(sample.evidence.imageUrl, /myqcloud\.com/u);
  assert.equal(sample.evidence.providerResponse.data.download_url, sample.evidence.imageUrl);
  assert.equal(stableJsonSha256V2(sample.evidence.providerResponse), JSON.parse(readFileSync(resolve(projectRoot, sample.evidence.upload.path), 'utf8')).providerResponseSha256);
});

test('官方上传响应与统一 upload receipt 可离线严格校验', () => {
  validateApprovedStillUploadProviderResponseV1(sample.evidence.providerResponse);
  const receipt = JSON.parse(readFileSync(resolve(projectRoot, sample.evidence.upload.path), 'utf8'));
  validateApprovedStillUploadReceiptV1({
    receipt,
    planId: context.plan.planId,
    shotId: 'G01',
    source: {path: sample.evidence.still.path, sha256: sample.evidence.still.sha256, width: 1920, height: 1080},
  });
});

test('执行器自造上传联网授权在 transport 之前被外部锚点门拒绝', async () => {
  const binding = {planId: context.plan.planId, shotId: 'G01', sourcePath: sample.evidence.still.path, sourceSha256: sample.evidence.still.sha256, sourceDimensions: {width: 1920, height: 1080}};
  const authorization = makeNetworkAuthorization({root: sample.root, operation: 'still-upload', binding, id: 'upload-unanchored'});
  let calls = 0;
  await expectRejectCode(uploadApprovedStillRunningHubV2({planId: context.plan.planId, shotId: 'G01', still: sample.evidence.still, sourceDimensions: {width: 1920, height: 1080}, networkAuthorizationRef: authorization, apiKey, now, transport: async () => { calls += 1; return sample.evidence.providerResponse; }}), 'NETWORK_AUTHORIZATION_EXTERNAL_ANCHOR_INVALID');
  assert.equal(calls, 0);
});

test('生产 API 使用可信系统时钟，调用方回拨 now 不能复活过期上传授权', async () => {
  const binding = {planId: context.plan.planId, shotId: 'G01', sourcePath: sample.evidence.still.path, sourceSha256: sample.evidence.still.sha256, sourceDimensions: {width: 1920, height: 1080}};
  const original = makeNetworkAuthorization({root: sample.root, operation: 'still-upload', binding, id: 'upload-expired'});
  const body = JSON.parse(readFileSync(resolve(projectRoot, original.path), 'utf8'));
  body.expiresAt = '2020-01-01T00:00:00.000Z';
  const expired = writeJson(join(sample.root, 'network-upload-expired.json'), body);
  let calls = 0;
  await expectRejectCode(uploadApprovedStillRunningHubV2({
    planId: context.plan.planId,
    shotId: 'G01',
    still: sample.evidence.still,
    sourceDimensions: {width: 1920, height: 1080},
    networkAuthorizationRef: expired,
    apiKey,
    now: new Date('1900-01-01T00:00:00.000Z'),
    transport: async () => { calls += 1; return sample.evidence.providerResponse; },
  }), 'NETWORK_AUTHORIZATION_EXPIRED');
  assert.equal(calls, 0);
});

test('官方 price-preview 响应形状纯离线校验通过', () => {
  const recorded = priceResponse(3.1);
  assert.equal(recorded.errorMessage, '');
  assert.equal(recorded.priceTextEn, null);
  validateRunningHubH3V2PriceProviderResponse(recorded);
  expectCode(() => validateRunningHubH3V2PriceProviderResponse({quoteId: 'invented', exactCostCny: 3.1, currency: 'CNY'}), 'QUOTE_PROVIDER_RESPONSE_INVALID');
});

test('报价前必须先验证上传授权与 plan/shot/transport 链，伪上传锚点不进 transport', async () => {
  const auth = makePaidAuthorization({root: sample.root, context, compilation, operation: 'sample-quote'});
  let calls = 0;
  await expectRejectCode(quoteRunningHubH3V2Shot({context, shotId: 'G01', operation: 'sample-quote', authorizationRef: auth, apiKey, now, transport: async () => { calls += 1; return priceResponse(3.1); }}), 'NETWORK_AUTHORIZATION_EXTERNAL_ANCHOR_INVALID');
  assert.equal(calls, 0);
});

test('提交前同样先阻断伪上传链，固定账本与 transport 均保持零副作用', async () => {
  const auth = makePaidAuthorization({root: sample.root, context, compilation, operation: 'sample-run', mutate: (body) => {
    body.quoteReceiptSha256 = 'a'.repeat(64);
    body.quoteReceiptId = 'quote-unreached';
  }});
  const ledger = resolve(projectRoot, RUNNINGHUB_H3_V2_FIXED_LEDGER_PATH);
  const ledgerExistedBefore = existsSync(ledger);
  const ledgerBytesBefore = ledgerExistedBefore ? readFileSync(ledger) : null;
  let calls = 0;
  await expectRejectCode(runRunningHubH3V2Shot({
    context,
    shotId: 'G01',
    operation: 'sample-run',
    authorizationRef: auth,
    quoteReceiptRef: auth,
    apiKey,
    transport: async () => { calls += 1; return submitProviderResponse; },
  }), 'NETWORK_AUTHORIZATION_EXTERNAL_ANCHOR_INVALID');
  assert.equal(calls, 0);
  assert.equal(existsSync(ledger), ledgerExistedBefore);
  if (ledgerExistedBefore) assert.deepEqual(readFileSync(ledger), ledgerBytesBefore);
});

test('0 元或 confirmPaid 布尔值不能代替精确付费授权', () => {
  const auth = makePaidAuthorization({root: sample.root, context, compilation, operation: 'sample-quote', amount: 0, mutate: (body) => { body.confirmPaid = true; }});
  const body = JSON.parse(readFileSync(resolve(projectRoot, auth.path), 'utf8'));
  expectCode(() => validateRunningHubPaidAuthorizationEnvelopeV2({
    authorization: body,
    expectedBinding: requestBinding({context, compilation, operation: 'sample-quote'}),
    operation: 'sample-quote',
    now,
  }), 'PAID_AUTHORIZATION_CONTENT_INVALID');
});

test('调用方自选 ledgerPath 被拒，账本路径固定为项目级单一文件', () => {
  assert.equal(RUNNINGHUB_H3_V2_FIXED_LEDGER_PATH, 'work/generated-video-v2/runninghub-h3-v2-consumption-ledger.json');
  const authRef = makePaidAuthorization({root: sample.root, context, compilation, operation: 'sample-run', mutate: (body) => {
    body.quoteReceiptSha256 = 'a'.repeat(64);
    body.quoteReceiptId = 'quote-recorded';
    body.ledgerPath = projectRelative(join(sample.root, 'caller-selected-ledger.json'));
  }});
  const body = JSON.parse(readFileSync(resolve(projectRoot, authRef.path), 'utf8'));
  expectCode(() => validateRunningHubPaidAuthorizationEnvelopeV2({
    authorization: body,
    expectedBinding: requestBinding({context, compilation, operation: 'sample-run'}),
    operation: 'sample-run',
    now,
  }), 'PAID_AUTHORIZATION_LEDGER_PATH_FORBIDDEN');
});

test('执行组直接自签 issuerGroup 稳定拒绝', () => {
  const authRef = makePaidAuthorization({root: sample.root, context, compilation, operation: 'sample-quote'});
  const auth = JSON.parse(readFileSync(resolve(projectRoot, authRef.path), 'utf8'));
  const evidence = JSON.parse(readFileSync(resolve(projectRoot, auth.userEvidence.path), 'utf8'));
  evidence.issuerGroupId = auth.executionGroupId;
  auth.userEvidence = writeJson(join(sample.root, 'self-signed-evidence.json'), evidence);
  const bad = writeJson(join(sample.root, 'self-signed-auth.json'), auth);
  const badBody = JSON.parse(readFileSync(resolve(projectRoot, bad.path), 'utf8'));
  expectCode(() => readRunningHubUserAuthorizationEvidenceV2(
    badBody.userEvidence,
    requestBinding({context, compilation, operation: 'sample-quote'}),
    badBody,
  ), 'USER_AUTHORIZATION_EVIDENCE_BINDING_INVALID');
});

const submitProviderResponse = clone(protocolRecording.records.submit.response);
test('官方 submit 响应不需 provider，官方 body 仍只有六个 H3 字段', () => {
  validateRunningHubH3V2SubmitProviderResponse(submitProviderResponse);
  assert.deepEqual(Object.keys(compilation.payload).sort(), ['aigc_watermark', 'duration', 'imageUrls', 'prompt', 'ratio', 'resolution']);
});

const taskReceipt = {
  schema: RUNNINGHUB_H3_V2_TASK_RECEIPT_SCHEMA,
  provider: 'RunningHub',
  operation: 'sample-run',
  taskId: submitProviderResponse.taskId,
  providerResponse: submitProviderResponse,
  providerResponseSha256: stableJsonSha256V2(submitProviderResponse),
  requestBinding: requestBinding({context, compilation, operation: 'sample-run'}),
  authorization: {sha256: 'a'.repeat(64)},
  quoteReceipt: {sha256: 'b'.repeat(64)},
};
validateRunningHubH3V2TaskReceipt({context, compilation, receipt: taskReceipt});
const taskRef = writeJson(join(sample.root, 'recorded-task-receipt.json'), taskReceipt);
const queryProviderResponse = clone(protocolRecording.records.query.response);

test('官方 query 响应与 query/result receipts 可纯离线链式校验', () => {
  validateRunningHubH3V2QueryProviderResponse(queryProviderResponse, taskReceipt.taskId);
  const requestBody = {taskId: taskReceipt.taskId};
  const queryReceipt = {
    schema: RUNNINGHUB_H3_V2_QUERY_RECEIPT_SCHEMA, provider: 'RunningHub', operation: taskReceipt.operation, taskId: taskReceipt.taskId,
    queriedAt: now.toISOString(), taskReceipt: {path: taskRef.path, sha256: taskRef.sha256},
    providerResponse: queryProviderResponse, providerResponseSha256: stableJsonSha256V2(queryProviderResponse),
    requestBody, requestBodySha256: stableJsonSha256V2(requestBody), authorization: {sha256: 'c'.repeat(64)},
  };
  validateRunningHubH3V2QueryReceipt({receipt: queryReceipt, taskReceipt, taskReceiptSha256: taskRef.sha256});
  const queryRef = writeJson(join(sample.root, 'recorded-query-receipt.json'), queryReceipt);
  const resultReceipt = createRunningHubH3V2ResultReceipt({context, shotId: 'G01', taskReceiptRef: taskRef, queryReceiptRef: queryRef});
  validateRunningHubH3V2ResultReceipt({receipt: resultReceipt, taskReceipt, taskReceiptSha256: taskRef.sha256, queryReceipt, queryReceiptSha256: queryRef.sha256});
  sample.recordedResult = {
    receipt: resultReceipt,
    ref: writeJson(join(sample.root, 'recorded-result-receipt.json'), resultReceipt),
    queryReceipt,
    queryRef,
  };
});

test('query outputType 必须按官方文件扩展名识别，伪 video 标签不能冒充 mp4', () => {
  const response = clone(queryProviderResponse);
  response.results[0].outputType = 'video';
  const requestBody = {taskId: taskReceipt.taskId};
  const queryReceipt = {
    schema: RUNNINGHUB_H3_V2_QUERY_RECEIPT_SCHEMA,
    provider: 'RunningHub',
    operation: taskReceipt.operation,
    taskId: taskReceipt.taskId,
    queriedAt: now.toISOString(),
    taskReceipt: {path: taskRef.path, sha256: taskRef.sha256},
    providerResponse: response,
    providerResponseSha256: stableJsonSha256V2(response),
    requestBody,
    requestBodySha256: stableJsonSha256V2(requestBody),
    authorization: {sha256: 'c'.repeat(64)},
  };
  const queryRef = writeJson(join(sample.root, 'query-output-type-video.json'), queryReceipt);
  expectCode(() => createRunningHubH3V2ResultReceipt({
    context,
    shotId: 'G01',
    taskReceiptRef: taskRef,
    queryReceiptRef: queryRef,
  }), 'QUERY_VIDEO_RESULT_NOT_UNIQUE');
});

test('真实 MP4 下载回执可纯离线验证，伪联网授权在 transport 前被拒绝', async () => {
  const outputPath = join(sample.root, 'recorded-downloaded.mp4');
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=10', '-t', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', outputPath]);
  const result = sample.recordedResult;
  const mediaVerification = inspectRunningHubDownloadedMp4BufferV2(readFileSync(outputPath));
  const receipt = {
    schema: RUNNINGHUB_H3_V2_DOWNLOAD_RECEIPT_SCHEMA, provider: 'RunningHub', operation: result.receipt.operation, taskId: result.receipt.taskId,
    queryReceipt: {path: result.queryRef.path, sha256: result.queryRef.sha256},
    resultReceipt: {path: result.ref.path, sha256: result.ref.sha256}, remoteUrl: result.receipt.resultUrl,
    outputPath: projectRelative(outputPath), outputSha256: sha256File(outputPath), outputBytes: statSync(outputPath).size,
    contentType: 'video/mp4', mediaVerification,
    downloadedAt: now.toISOString(), authorization: {sha256: 'd'.repeat(64)},
  };
  validateRunningHubH3V2DownloadReceipt({
    receipt,
    resultReceipt: result.receipt,
    resultReceiptSha256: result.ref.sha256,
    taskReceipt,
    taskReceiptSha256: taskRef.sha256,
    queryReceipt: result.queryReceipt,
    queryReceiptSha256: result.queryRef.sha256,
    checkFile: true,
  });
  const blockedOutput = projectRelative(join(sample.root, 'network-must-not-write.mp4'));
  const binding = {
    taskId: result.receipt.taskId,
    planId: context.plan.planId,
    shotId: 'G01',
    taskReceiptSha256: taskRef.sha256,
    queryReceiptSha256: result.queryRef.sha256,
    resultReceiptSha256: result.ref.sha256,
    resultBindingSha256: result.receipt.resultBindingSha256,
    remoteUrl: result.receipt.resultUrl,
    outputPath: blockedOutput,
  };
  const authorization = makeNetworkAuthorization({root: sample.root, operation: 'result-download', binding, id: 'download-unanchored'});
  let calls = 0;
  await expectRejectCode(downloadRunningHubH3V2Result({context, shotId: 'G01', resultReceiptRef: result.ref, outputPath: blockedOutput, networkAuthorizationRef: authorization, now, transport: async () => { calls += 1; return readFileSync(outputPath); }}), 'NETWORK_AUTHORIZATION_EXTERNAL_ANCHOR_INVALID');
  assert.equal(calls, 0);
  assert.equal(existsSync(resolve(projectRoot, blockedOutput)), false);
});

test('ASCII 或伪容器在任何下载落盘前被真实 MP4 检查拒绝', () => {
  expectCode(() => inspectRunningHubDownloadedMp4BufferV2(Buffer.from('not-a-real-mp4-container'.repeat(8))), 'DOWNLOAD_MP4_CONTAINER_INVALID');
});

test('自造 query 联网授权不进 transport', async () => {
  const requestBody = {taskId: taskReceipt.taskId};
  const binding = {planId: context.plan.planId, shotId: 'G01', taskId: taskReceipt.taskId, taskReceiptSha256: taskRef.sha256, requestBodySha256: stableJsonSha256V2(requestBody)};
  const authorization = makeNetworkAuthorization({root: sample.root, operation: 'task-query', binding, id: 'query-unanchored'});
  let calls = 0;
  await expectRejectCode(queryRunningHubH3V2Task({context, shotId: 'G01', taskReceiptRef: taskRef, networkAuthorizationRef: authorization, apiKey, now, transport: async () => { calls += 1; return queryProviderResponse; }}), 'NETWORK_AUTHORIZATION_EXTERNAL_ANCHOR_INVALID');
  assert.equal(calls, 0);
});

let production;
test('无外部验收锚点的自造 productionEligible=true 必须拒绝', () => {
  const root = join(temporaryRoot, 'production');
  mkdirSync(root, {recursive: true});
  const directorRoot = join(root, 'director');
  mkdirSync(directorRoot, {recursive: true});
  const director = createDirectorFixture({rootOverride: directorRoot});
  const planId = 'plan-production';
  const style = {id: 'koubo-paper-editorial-assembly-v2-approved-test', status: 'user-approved', productionEligible: true};
  const styleRef = writeJson(join(root, 'style.json'), style);
  const evidence = makeStillEvidence({root, planId, suffix: '-production'});
  const planPath = join(root, 'plan.json');
  const ref = (item) => ({path: projectRelative(item.path), sha256: item.sha256});
  const contractRef = {path: projectRelative(director.contractPath), sha256: sha256File(director.contractPath)};
  const candidate = director.contract.lifecycle.candidate.media;
  const withSfx = director.contract.previewAB.variants.find((item) => item.id === 'A-with-sfx');
  const withoutSfx = director.contract.previewAB.variants.find((item) => item.id === 'B-without-sfx');
  const plan = {
    schema: 'generated-video-plan/v2', schemaVersion: 'generated-video-plan/v2', executionMode: 'production', planId, videoId: 'video-production',
    planPath: projectRelative(planPath), styleReference: {id: style.id, ...styleRef}, provider,
    productionEligibility: {
      productionEligible: true, state: 'automation-handoff-eligible', directorContract: contractRef,
      dynamicSample: ref(candidate),
      technicalQaReceipt: ref(director.contract.lifecycle.candidate.technicalQaReceipt),
      humanReviewReceipt: ref(director.contract.lifecycle.styleAcceptance.humanReviewReceipt),
      withSfx: ref(withSfx), withoutSfx: ref(withoutSfx),
      handoffReceipt: ref(director.contract.lifecycle.handoff.receipt),
      handoffBindingSha256: director.contract.lifecycle.handoff.bindingSha256,
    },
    shots: [{id: 'G01', spokenAnchor: {text: '产线仅在完整交接后解锁。', startSeconds: 0, endSeconds: 6}, prompt: '原创纸媒装配风格，因果链连续形成。', durationSeconds: 6, approvedStill: evidence.still, uploadReceipt: evidence.upload}],
  };
  writeJson(planPath, plan);
  production = {root, planPath, plan, director};
  expectCode(() => loadGeneratedVideoPlanV2(planPath), 'DIRECTOR_CONTRACT_INVALID');
});

test('ASCII 伪 mp4 即使改名也稳定拒绝', () => {
  const ascii = writeBytes(join(production.root, 'ascii-fake.mp4'), Buffer.from('not-an-mp4'));
  expectCode(() => assertRealMp4VideoV2(ascii, 'ASCII 伪媒体'), 'DYNAMIC_SAMPLE_MEDIA_INVALID');
});

test('style-sample 不能绕过 production operation', () => {
  const auth = makePaidAuthorization({root: sample.root, context, compilation, operation: 'production-quote'});
  return expectRejectCode(quoteRunningHubH3V2Shot({context, shotId: 'G01', operation: 'production-quote', authorizationRef: auth, apiKey, now, transport: async () => priceResponse(3.1)}), 'PRODUCTION_NOT_ELIGIBLE');
});

let failures = 0;
for (const {name, fn} of tests) {
  try {
    await fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    failures += 1;
    process.stderr.write(`FAIL ${name}\n${error.stack || error.message}\n`);
  }
}
rmSync(temporaryRoot, {recursive: true, force: true});
process.stdout.write(`RESULT ${tests.length - failures}/${tests.length} passed; skipped=0; networkCalls=0; providerEvidence=official-doc-shape-offline\n`);
process.exit(failures === 0 ? 0 : 1);
