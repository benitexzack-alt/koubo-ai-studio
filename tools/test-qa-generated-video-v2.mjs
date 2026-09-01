#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {after, before, test} from 'node:test';

import {
  GENERATED_VIDEO_V2_QA_REQUEST_SCHEMA,
  LOCKED_REFERENCE_MOTION_BASELINE_V2,
  runGeneratedVideoV2Qa,
  runLockedMediaDiagnosticsForGeneratedVideoV2,
  sha256FileForQaV2,
  validateOfficialRunningHubEvidenceChainV2,
  validateOfficialRunningHubProviderReceiptShapesV2,
  validateReferenceMotionBaselineReceiptV2,
} from './qa-generated-video-v2.mjs';
import {
  RUNNINGHUB_H3_V2_DOWNLOAD_RECEIPT_SCHEMA,
  RUNNINGHUB_H3_V2_QUERY_RECEIPT_SCHEMA,
  RUNNINGHUB_H3_V2_RESULT_RECEIPT_SCHEMA,
  RUNNINGHUB_H3_V2_TASK_RECEIPT_SCHEMA,
  compileRunningHubH3V2Shot,
  computeApprovedStillUploadTransportBindingSha256V1,
} from './runninghub-generated-video-v2-adapter.mjs';
import {stableJsonSha256V2} from './generated-video-plan-v2-core.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const officialProtocolRecordingPath = path.join(
  projectRoot,
  'skills/koubo-remotion-director/fixtures/runninghub-h3-official-protocol-recording.v1.json',
);
const officialProtocolRecording = JSON.parse(readFileSync(officialProtocolRecordingPath, 'utf8'));
const testRoot = mkdtempSync(path.join(projectRoot, 'work', '.qa-generated-video-v2-test-'));
const qaScript = path.join(projectRoot, 'tools', 'qa-generated-video-v2.mjs');
const fontPath = existsSync('/System/Library/Fonts/Supplemental/Arial.ttf')
  ? '/System/Library/Fonts/Supplemental/Arial.ttf'
  : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const now = '2026-08-24T00:00:00.000Z';
let assets;
let originalFetch;
let networkCalls = 0;

const run = (binary, args, label) => {
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(result.status, 0, `${label}失败：${result.error?.message ?? result.stderr ?? result.stdout}`);
  return result;
};
const relative = (filePath) => path.relative(projectRoot, filePath).split(path.sep).join('/');
const writeJson = (filePath, value) => {
  mkdirSync(path.dirname(filePath), {recursive: true});
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return {path: relative(filePath), sha256: sha256FileForQaV2(filePath)};
};
const shaText = (value) => createHash('sha256').update(value).digest('hex');
const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));
const fullRef = (filePath) => ({path: relative(filePath), sha256: sha256FileForQaV2(filePath)});
const mediaVerificationFor = (filePath) => {
  const probeResult = run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=format_name,duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', filePath,
  ], '生成 download 媒体验证 fixture');
  const probe = JSON.parse(probeResult.stdout);
  const video = probe.streams.filter((stream) => stream.codec_type === 'video')[0];
  run('ffmpeg', ['-v', 'error', '-i', filePath, '-map', '0:v:0', '-f', 'null', '-'], '生成 download 全解码 fixture');
  return {
    formatName: String(probe.format.format_name),
    durationSeconds: Number(probe.format.duration),
    width: Number(video.width),
    height: Number(video.height),
    frameRate: String(video.r_frame_rate ?? ''),
    videoStreamCount: 1,
    fullDecodePassed: true,
    outputBytes: readFileSync(filePath).length,
    outputSha256: sha256FileForQaV2(filePath),
  };
};

const mediaExpectations = (overrides = {}) => ({
  expectedAudioTracks: 0,
  expectedDurationSeconds: 5,
  width: 1920,
  height: 1080,
  fps: 24,
  expectedTextList: [],
  expectedBoundariesSeconds: [1, 2, 3],
  ...overrides,
});

const createEvidenceContext = (suffix) => {
  const root = path.join(testRoot, 'provider-chain', suffix);
  mkdirSync(root, {recursive: true});
  const still = assets.approvedStill;
  const stillSha = sha256FileForQaV2(still);
  const planId = `evidence-plan-${suffix}`;
  const shotId = 'S01';
  const uploadResponse = structuredClone(officialProtocolRecording.records.upload.response);
  const imageUrl = uploadResponse.data.download_url;
  const uploadAuthorization = {
    path: relative(assets.supportingAuthorization),
    sha256: sha256FileForQaV2(assets.supportingAuthorization),
    authorizationId: `fixture-upload-auth-${suffix}`,
  };
  const uploadBody = {
    schema: 'approved-still-upload-receipt/v1',
    receiptId: `upload-${suffix}`,
    provider: 'RunningHub',
    planId,
    shotId,
    sourcePath: relative(still),
    sourceSha256: stillSha,
    sourceDimensions: {width: 640, height: 360},
    imageUrl,
    uploadedAt: now,
    providerResponse: uploadResponse,
    providerResponseSha256: stableJsonSha256V2(uploadResponse),
    authorization: uploadAuthorization,
  };
  uploadBody.transportBindingSha256 = computeApprovedStillUploadTransportBindingSha256V1({
    receipt: uploadBody,
    authorizationSha256: uploadAuthorization.sha256,
  });
  const uploadPath = path.join(root, 'upload.json');
  const uploadRef = writeJson(uploadPath, uploadBody);
  const context = {
    plan: {
      planId,
      executionMode: 'production',
      provider: {resolution: '2K', aspectRatio: '16:9', aigcWatermark: false},
      shots: [{id: shotId, prompt: '原创纸媒装配动画，因果连续。', durationSeconds: 5}],
    },
    planDefinitionSha256: '1'.repeat(64),
    styleSha256: '2'.repeat(64),
    shotEvidence: new Map([[
      shotId,
      {
        still: {absolutePath: still, relativePath: relative(still), sha256: stillSha, width: 640, height: 360, approval: {sha256: '3'.repeat(64)}},
        uploadReceipt: {absolutePath: uploadPath, relativePath: relative(uploadPath), sha256: uploadRef.sha256, receipt: uploadBody},
      },
    ]]),
  };
  return {root, context, planId, shotId, still, stillSha, uploadPath, uploadRef, uploadBody};
};

const buildEvidenceChain = (suffix) => {
  const fixture = createEvidenceContext(suffix);
  const compilation = compileRunningHubH3V2Shot({context: fixture.context, shotId: fixture.shotId});
  const requestPath = path.join(fixture.root, 'request.json');
  const requestRef = writeJson(requestPath, compilation.requestDefinition);
  const providerResponse = structuredClone(officialProtocolRecording.records.submit.response);
  const taskId = providerResponse.taskId;
  const taskBody = {
    schema: RUNNINGHUB_H3_V2_TASK_RECEIPT_SCHEMA,
    provider: 'RunningHub',
    operation: 'production-run',
    taskId,
    providerResponse,
    providerResponseSha256: stableJsonSha256V2(providerResponse),
    requestBinding: {
      operation: 'production-run',
      planId: fixture.planId,
      planDefinitionSha256: fixture.context.planDefinitionSha256,
      styleSha256: fixture.context.styleSha256,
      shotId: fixture.shotId,
      requestDefinitionSha256: compilation.requestDefinitionSha256,
      payloadSha256: compilation.payloadSha256,
      approvedStillSha256: fixture.stillSha,
      approvedStillUploadReceiptSha256: fixture.uploadRef.sha256,
    },
    authorization: fullRef(assets.supportingAuthorization),
    quoteReceipt: fullRef(assets.supportingQuote),
  };
  const taskPath = path.join(fixture.root, 'task.json');
  const taskRef = writeJson(taskPath, taskBody);
  const queryResponse = structuredClone(officialProtocolRecording.records.query.response);
  const resultUrl = queryResponse.results[0].url;
  const queryBody = {
    schema: RUNNINGHUB_H3_V2_QUERY_RECEIPT_SCHEMA,
    provider: 'RunningHub',
    operation: 'production-run',
    taskId,
    queriedAt: now,
    taskReceipt: taskRef,
    providerResponse: queryResponse,
    providerResponseSha256: stableJsonSha256V2(queryResponse),
    requestBody: {taskId},
    requestBodySha256: stableJsonSha256V2({taskId}),
    authorization: fullRef(assets.supportingAuthorization),
  };
  const queryPath = path.join(fixture.root, 'query.json');
  const queryRef = writeJson(queryPath, queryBody);
  const resultItem = queryResponse.results[0];
  const resultBody = {
    schema: RUNNINGHUB_H3_V2_RESULT_RECEIPT_SCHEMA,
    provider: 'RunningHub',
    operation: 'production-run',
    taskId,
    taskReceipt: taskRef,
    queryReceipt: queryRef,
    resultUrl,
    outputType: 'mp4',
    resultBindingSha256: stableJsonSha256V2({taskReceiptSha256: taskRef.sha256, queryReceiptSha256: queryRef.sha256, taskId, result: resultItem}),
  };
  const resultPath = path.join(fixture.root, 'result.json');
  const resultRef = writeJson(resultPath, resultBody);
  const videoPath = assets.validVideo;
  const downloadBody = {
    schema: RUNNINGHUB_H3_V2_DOWNLOAD_RECEIPT_SCHEMA,
    provider: 'RunningHub',
    operation: 'production-run',
    taskId,
    resultReceipt: resultRef,
    queryReceipt: queryRef,
    remoteUrl: resultUrl,
    outputPath: relative(videoPath),
    outputSha256: sha256FileForQaV2(videoPath),
    outputBytes: readFileSync(videoPath).length,
    contentType: officialProtocolRecording.records.download.contentType,
    mediaVerification: mediaVerificationFor(videoPath),
    downloadedAt: now,
    authorization: fullRef(assets.supportingAuthorization),
  };
  const downloadPath = path.join(fixture.root, 'download.json');
  const downloadRef = writeJson(downloadPath, downloadBody);
  const evidence = {
    approvedStill: fullRef(fixture.still),
    uploadReceipt: fixture.uploadRef,
    requestDefinition: requestRef,
    taskReceipt: taskRef,
    queryReceipt: queryRef,
    resultReceipt: resultRef,
    downloadReceipt: downloadRef,
  };
  return {
    ...fixture,
    compilation,
    requestPath,
    taskPath,
    queryPath,
    resultPath,
    downloadPath,
    requestRef,
    taskRef,
    queryRef,
    resultRef,
    downloadRef,
    evidence,
    videoPath,
  };
};

const chainOptions = (chain) => ({
  context: chain.context,
  shotId: chain.shotId,
  evidence: chain.evidence,
  videoPath: chain.videoPath,
  videoSha256: sha256FileForQaV2(chain.videoPath),
});
const validateChain = (chain) => validateOfficialRunningHubProviderReceiptShapesV2(chainOptions(chain));

const expectCode = (fn, expectedCodes) => {
  const accepted = new Set(Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes]);
  assert.throws(fn, (error) => accepted.has(error.code), `期望错误码：${[...accepted].join(',')}`);
};

const makeCandidatePlan = () => {
  const root = path.join(testRoot, 'candidate-plan');
  const planId = 'qa-blocked-candidate-plan';
  const shotId = 'S01';
  const still = assets.approvedStill;
  const stillSha = sha256FileForQaV2(still);
  const approvalPath = path.join(root, 'still-approval.json');
  const approvalRef = writeJson(approvalPath, {
    schema: 'approved-still-user-approval/v2',
    decision: 'approved-completed-state-still',
    reviewerKind: 'user',
    reviewer: 'fixture-structure-only',
    reviewedAt: now,
    planId,
    shotId,
    stillPath: relative(still),
    stillSha256: stillSha,
  });
  const imageUrl = 'https://fixture.cos.ap-guangzhou.myqcloud.com/candidate/still.png';
  const providerResponse = {code: 0, message: 'success', data: {type: 'image', download_url: imageUrl, fileName: 'still.png', size: readFileSync(still).length}};
  const uploadPath = path.join(root, 'upload.json');
  const candidateUploadAuthorization = {
    path: relative(assets.supportingAuthorization),
    sha256: sha256FileForQaV2(assets.supportingAuthorization),
    authorizationId: 'fixture-candidate-upload-auth',
  };
  const candidateUploadBody = {
    schema: 'approved-still-upload-receipt/v1',
    receiptId: 'candidate-upload-1',
    provider: 'RunningHub',
    planId,
    shotId,
    sourcePath: relative(still),
    sourceSha256: stillSha,
    sourceDimensions: {width: 640, height: 360},
    imageUrl,
    uploadedAt: now,
    providerResponse,
    providerResponseSha256: stableJsonSha256V2(providerResponse),
    authorization: candidateUploadAuthorization,
  };
  candidateUploadBody.transportBindingSha256 = computeApprovedStillUploadTransportBindingSha256V1({
    receipt: candidateUploadBody,
    authorizationSha256: candidateUploadAuthorization.sha256,
  });
  const uploadRef = writeJson(uploadPath, candidateUploadBody);
  const stylePath = path.join(projectRoot, 'workflow/style-library/koubo-paper-editorial-assembly-v2.candidate.json');
  const planPath = path.join(root, 'plan.json');
  const plan = {
    schema: 'generated-video-plan/v2',
    schemaVersion: 'generated-video-plan/v2',
    executionMode: 'style-sample',
    planId,
    videoId: 'qa-blocked-candidate-video',
    planPath: relative(planPath),
    styleReference: {id: 'koubo-paper-editorial-assembly-v2', path: relative(stylePath), sha256: sha256FileForQaV2(stylePath)},
    provider: {
      platform: 'RunningHub',
      model: 'MiniMax-H3',
      modelRoute: '/minimax/hailuo-h3/multimodal-to-video',
      resolution: '2K',
      aspectRatio: '16:9',
      aigcWatermark: false,
      durationSeconds: {min: 5, max: 15},
    },
    productionEligibility: {productionEligible: false, state: 'candidate-blocked'},
    shots: [{
      id: shotId,
      durationSeconds: 5,
      spokenAnchor: {text: '仅用于候选阻断回归。'},
      prompt: '原创纸媒装配动画。',
      approvedStill: {path: relative(still), sha256: stillSha, width: 640, height: 360, approvalReceipt: approvalRef},
      uploadReceipt: uploadRef,
    }],
  };
  const planRef = writeJson(planPath, plan);
  return {root, planPath, planRef, shotId};
};

const makeInvalidDirectorProductionPlan = () => {
  const root = path.join(testRoot, 'invalid-director-production-plan');
  const stylePath = path.join(root, 'claimed-production-style.json');
  const style = {id: 'koubo-paper-editorial-assembly-v2', status: 'claimed-production-without-evidence', productionEligible: true};
  const styleRef = writeJson(stylePath, style);
  const directorPath = path.join(root, 'invalid-director.json');
  const directorRef = writeJson(directorPath, {
    schemaVersion: 'director-contract/v2',
    contractId: 'invalid-director-no-external-receipts',
    evidenceScope: 'fixture-only',
    productionEligible: true,
    formal: {enabled: false},
    lifecycle: {state: 'automation-handoff-eligible'},
  });
  const planPath = path.join(root, 'plan.json');
  const plan = {
    schema: 'generated-video-plan/v2',
    schemaVersion: 'generated-video-plan/v2',
    executionMode: 'production',
    planId: 'invalid-director-production-plan',
    videoId: 'invalid-director-production-video',
    planPath: relative(planPath),
    styleReference: {id: style.id, ...styleRef},
    provider: {
      platform: 'RunningHub', model: 'MiniMax-H3',
      modelRoute: '/minimax/hailuo-h3/multimodal-to-video',
      resolution: '2K', aspectRatio: '16:9', aigcWatermark: false,
      durationSeconds: {min: 5, max: 15},
    },
    productionEligibility: {
      productionEligible: true,
      state: 'automation-handoff-eligible',
      directorContract: directorRef,
    },
    shots: [{id: 'S01', durationSeconds: 5}],
  };
  return {root, planPath, planRef: writeJson(planPath, plan), shotId: 'S01'};
};

const blockedQaRequest = (plan, videoPath) => ({
  schemaVersion: GENERATED_VIDEO_V2_QA_REQUEST_SCHEMA,
  intent: 'promotion-evidence',
  provenance: {kind: 'runninghub-h3-output'},
  plan: plan.planRef,
  shotId: plan.shotId,
  video: fullRef(videoPath),
  productionBinding: {},
  evidence: {},
  expectations: mediaExpectations(),
});

const runBlockedCase = async (name, request) => {
  const root = path.join(testRoot, 'blocked-cases', name);
  mkdirSync(root, {recursive: true});
  const requestPath = path.join(root, 'request.json');
  writeJson(requestPath, request);
  const outputPath = path.join(root, 'nonexistent-output', 'qa-receipt.json');
  const artifactsDirectory = path.join(root, 'nonexistent-artifacts');
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(artifactsDirectory), false);
  const result = await runGeneratedVideoV2Qa({requestPath, outputPath, artifactsDirectory});
  return {result, outputPath, artifactsDirectory};
};

before(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error('测试禁止联网');
  };
  const supportingAuthorization = path.join(testRoot, 'supporting-authorization.json');
  const supportingQuote = path.join(testRoot, 'supporting-quote.json');
  writeJson(supportingAuthorization, {schema: 'offline-transport-fixture-only', promotionEligible: false});
  writeJson(supportingQuote, {schema: 'offline-transport-fixture-only', promotionEligible: false});

  const approvedStill = path.join(testRoot, 'approved-still.png');
  run('magick', ['-size', '640x360', 'xc:#d8d0c0', '-font', fontPath, '-fill', '#171717', '-pointsize', '82', '-gravity', 'center', '-annotate', '+0-24', 'ALPHA', approvedStill], '生成批准静帧 fixture');

  const validVideo = path.join(testRoot, 'valid-dynamic-1920x1080-24fps.mp4');
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'life=size=320x180:rate=24:ratio=0.5:seed=42:mold=12:death_color=0x203050:life_color=0xf4d35e:mold_color=0x46acc2,noise=alls=70:allf=u,scale=1920:1080:flags=neighbor',
    '-t', '5', '-r', '24',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', '-y', validVideo,
  ], '生成高清动态诊断片');
  const blackVideo = path.join(testRoot, 'black-1920x1080-24fps.mp4');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:size=1920x1080:rate=24:duration=5', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-an', '-y', blackVideo], '生成黑场片');
  const freezeVideo = path.join(testRoot, 'freeze-1920x1080-24fps.mp4');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:size=1920x1080:rate=24:duration=5', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-an', '-y', freezeVideo], '生成冻结片');
  const whiteVideo = path.join(testRoot, 'white-1920x1080-24fps.mp4');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=white:size=1920x1080:rate=24:duration=5', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-an', '-y', whiteVideo], '生成白场片');
  const audioVideo = path.join(testRoot, 'unexpected-audio-1920x1080-24fps.mp4');
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', validVideo, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=5',
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y', audioVideo,
  ], '生成意外音轨片');
  const corruptVideo = path.join(testRoot, 'corrupt.mp4');
  const corrupt = Buffer.from(readFileSync(validVideo));
  const marker = corrupt.indexOf(Buffer.from('mdat'));
  assert.ok(marker > 0);
  for (let index = marker + 64; index < Math.min(corrupt.length, marker + 32768); index += 1) corrupt[index] ^= 0xff;
  writeFileSync(corruptVideo, corrupt);
  assets = {supportingAuthorization, supportingQuote, approvedStill, validVideo, blackVideo, whiteVideo, freezeVideo, audioVideo, corruptVideo};
});

after(() => {
  globalThis.fetch = originalFetch;
  assert.equal(networkCalls, 0, 'QA 及所有回归 fixture 必须 0 联网调用');
  process.stdout.write(`# QA_V2_AUDIT networkCalls=${networkCalls}; skipped=0; productionPositive=blocked-no-external-receipts\n`);
  rmSync(testRoot, {recursive: true, force: true});
});

test('官方字段形状的本地结构 fixture 只做纯校验，不冒充真实 transport 或晋级证据', () => {
  assert.equal(officialProtocolRecording.sourceKind, 'official-documentation-shape-transcription');
  assert.equal(officialProtocolRecording.notLiveProviderReceipt, true);
  assert.equal(officialProtocolRecording.evidenceScope, 'offline-protocol-regression-only');
  const chain = buildEvidenceChain('valid-chain');
  const result = validateChain(chain);
  assert.equal(result.status, 'provider-receipt-shapes-validated-diagnostic-only');
  assert.equal(result.technicalQaPassed, false);
  assert.equal(result.promotionEligibleEvidence, false);
  assert.equal(result.transportAuthenticity, 'unverified-structure-only');
  assert.equal(result.bindings.outputSha256, sha256FileForQaV2(assets.validVideo));
});

test('旧的 query outputType=video 不得冒充官方 mp4 结果', () => {
  const chain = buildEvidenceChain('legacy-query-output-type');
  const queryBody = readJson(chain.queryPath);
  queryBody.providerResponse.results[0].outputType = 'video';
  queryBody.providerResponseSha256 = stableJsonSha256V2(queryBody.providerResponse);
  chain.evidence.queryReceipt = writeJson(chain.queryPath, queryBody);
  expectCode(() => validateChain(chain), ['QUERY_VIDEO_RESULT_NOT_UNIQUE', 'H3_QUERY_MP4_RESULT_NOT_UNIQUE']);
});

test('伪 COS/provider 结构即使字段完整，也不得在无外部授权与 transport 监督锚点时进入 production', () => {
  const chain = buildEvidenceChain('external-authorization-required');
  expectCode(
    () => validateOfficialRunningHubEvidenceChainV2(chainOptions(chain)),
    ['H3_NETWORK_AUTHORIZATION_CONTENT_INVALID', 'H3_NETWORK_AUTHORIZATION_EXTERNAL_ANCHOR_INVALID'],
  );
});

test('批准静帧 SHA 错绑被拒绝', () => {
  const chain = buildEvidenceChain('still-mismatch');
  chain.evidence.approvedStill.sha256 = '0'.repeat(64);
  expectCode(() => validateChain(chain), 'APPROVED_STILL_SHA_MISMATCH');
});

test('上传回执错绑当前 plan/shot 被拒绝', () => {
  const chain = buildEvidenceChain('upload-mismatch');
  const body = readJson(chain.uploadPath);
  body.sourceSha256 = '0'.repeat(64);
  chain.evidence.uploadReceipt = writeJson(chain.uploadPath, body);
  expectCode(() => validateChain(chain), 'UPLOAD_RECEIPT_PLAN_BINDING_MISMATCH');
});

test('上传 transport binding 不得用任意合法 SHA 伪造', () => {
  const chain = buildEvidenceChain('upload-transport-binding-mismatch');
  const body = readJson(chain.uploadPath);
  body.transportBindingSha256 = '0'.repeat(64);
  const uploadRef = writeJson(chain.uploadPath, body);
  chain.evidence.uploadReceipt = uploadRef;
  chain.context.shotEvidence.get(chain.shotId).uploadReceipt.sha256 = uploadRef.sha256;
  chain.context.shotEvidence.get(chain.shotId).uploadReceipt.receipt = body;
  expectCode(() => validateChain(chain), 'H3_UPLOAD_TRANSPORT_BINDING_MISMATCH');
});

test('旧 H3 wrapper/imageUrl/durationSeconds 协议被拒绝', () => {
  const chain = buildEvidenceChain('legacy-request');
  const body = readJson(chain.requestPath);
  body.schema = 'runninghub-minimax-h3-multimodal-request/v2';
  body.payload = {prompt: 'legacy', imageUrl: body.payload.imageUrls[0], durationSeconds: 5, aspectRatio: '16:9'};
  chain.evidence.requestDefinition = writeJson(chain.requestPath, body);
  expectCode(() => validateChain(chain), 'H3_REQUEST_SCHEMA_INVALID');
});

test('task request binding 错绑被拒绝', () => {
  const chain = buildEvidenceChain('task-mismatch');
  const body = readJson(chain.taskPath);
  body.requestBinding.payloadSha256 = '0'.repeat(64);
  chain.evidence.taskReceipt = writeJson(chain.taskPath, body);
  expectCode(() => validateChain(chain), 'TASK_RECEIPT_REQUEST_MISMATCH');
});

test('query task/SHA 错绑被拒绝', () => {
  const chain = buildEvidenceChain('query-mismatch');
  const body = readJson(chain.queryPath);
  body.taskReceipt.sha256 = '0'.repeat(64);
  chain.evidence.queryReceipt = writeJson(chain.queryPath, body);
  expectCode(() => validateChain(chain), 'QUERY_RECEIPT_BINDING_INVALID');
});

test('result query 错绑被拒绝', () => {
  const chain = buildEvidenceChain('result-mismatch');
  const body = readJson(chain.resultPath);
  body.queryReceipt.sha256 = '0'.repeat(64);
  chain.evidence.resultReceipt = writeJson(chain.resultPath, body);
  expectCode(() => validateChain(chain), 'RESULT_RECEIPT_BINDING_INVALID');
});

test('download 路径/SHA/字节不是当前 QA 视频时被拒绝', () => {
  const chain = buildEvidenceChain('download-mismatch');
  const body = readJson(chain.downloadPath);
  body.outputSha256 = shaText('not-current-video');
  chain.evidence.downloadReceipt = writeJson(chain.downloadPath, body);
  expectCode(() => validateChain(chain), ['DOWNLOAD_RECEIPT_BINDING_INVALID', 'DOWNLOAD_OUTPUT_SHA_MISMATCH', 'H3_DOWNLOAD_OUTPUT_SHA_MISMATCH']);
});

test('download 回执错绑 query 时，必须通过 query→result→download 完整链拒绝', () => {
  const chain = buildEvidenceChain('download-query-mismatch');
  const body = readJson(chain.downloadPath);
  body.queryReceipt.sha256 = '0'.repeat(64);
  chain.evidence.downloadReceipt = writeJson(chain.downloadPath, body);
  expectCode(() => validateChain(chain), 'DOWNLOAD_RECEIPT_BINDING_INVALID');
});

test('blocked-candidate 在任何 output/artifacts 写入前 fail-closed', async () => {
  const plan = makeCandidatePlan();
  const {result, outputPath, artifactsDirectory} = await runBlockedCase('candidate-before-write', blockedQaRequest(plan, assets.validVideo));
  assert.equal(result.exitCode, 1);
  assert.equal(result.persisted, false);
  assert.equal(result.receipt, null);
  assert.ok(['PRODUCTION_NOT_ELIGIBLE', 'STYLE_PRODUCTION_NOT_ELIGIBLE'].includes(result.error.code), result.error.code);
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(path.dirname(outputPath)), false);
  assert.equal(existsSync(artifactsDirectory), false);
  process.stdout.write('# QA_ZERO_WRITE blockedCandidate outputExists=false outputParentExists=false artifactsExists=false\n');
});

test('资格预检失败时已存目标与产物字节也完全不变', async () => {
  const plan = makeCandidatePlan();
  const root = path.join(testRoot, 'blocked-cases', 'sentinel-unchanged');
  const requestPath = path.join(root, 'request.json');
  const outputPath = path.join(root, 'existing-output.json');
  const artifactsDirectory = path.join(root, 'existing-artifacts');
  writeJson(requestPath, blockedQaRequest(plan, assets.validVideo));
  mkdirSync(artifactsDirectory, {recursive: true});
  writeFileSync(outputPath, 'OUTPUT-SENTINEL-DO-NOT-CHANGE\n');
  const artifactSentinel = path.join(artifactsDirectory, 'sentinel.bin');
  writeFileSync(artifactSentinel, Buffer.from([0, 1, 2, 3, 4, 5]));
  const beforeOutput = sha256FileForQaV2(outputPath);
  const beforeArtifact = sha256FileForQaV2(artifactSentinel);
  const result = await runGeneratedVideoV2Qa({requestPath, outputPath, artifactsDirectory});
  assert.equal(result.persisted, false);
  assert.equal(sha256FileForQaV2(outputPath), beforeOutput);
  assert.equal(sha256FileForQaV2(artifactSentinel), beforeArtifact);
  process.stdout.write(`# QA_SENTINEL_UNCHANGED outputBefore=${beforeOutput} outputAfter=${sha256FileForQaV2(outputPath)} artifactBefore=${beforeArtifact} artifactAfter=${sha256FileForQaV2(artifactSentinel)}\n`);
});

test('本地原型/来源不明请求只能走 read-only diagnostic，不得进入生产 QA 写盘', async () => {
  const plan = makeCandidatePlan();
  const request = blockedQaRequest(plan, assets.validVideo);
  request.provenance.kind = 'local-deterministic-prototype';
  const {result, outputPath, artifactsDirectory} = await runBlockedCase('prototype-provenance', request);
  assert.equal(result.error.code, 'QA_PROMOTION_INTENT_REQUIRED');
  assert.equal(result.persisted, false);
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(artifactsDirectory), false);
});

test('伪称 production 但 director 无真实外部回执时在写入前拒绝', async () => {
  const plan = makeInvalidDirectorProductionPlan();
  const {result, outputPath, artifactsDirectory} = await runBlockedCase('invalid-director-before-write', blockedQaRequest(plan, assets.validVideo));
  assert.equal(result.error.code, 'DIRECTOR_CONTRACT_INVALID');
  assert.equal(result.persisted, false);
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(artifactsDirectory), false);
});

test('事故否决成片固定 SHA 在 plan/director 之前且写入前被拒绝', async () => {
  const rejected = path.join(projectRoot, 'work/production-runs/20260823-wechat-geo-aao-v80/rejected-output/微信AI_GEO_AAO_16x9_V80_已否决_禁止发布.mp4');
  assert.equal(sha256FileForQaV2(rejected), '3ba5cef4e0c5ae26e2f70d27c8799cea5d736498d85dcbd00dba2050125e5488');
  const plan = makeCandidatePlan();
  const {result, outputPath, artifactsDirectory} = await runBlockedCase('retired-output-before-write', blockedQaRequest(plan, rejected));
  assert.equal(result.error.code, 'RETIRED_REJECTED_OUTPUT_SHA');
  assert.equal(result.persisted, false);
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(artifactsDirectory), false);
});

test('参考动态基线回执绑定 QA 算法/实现/媒体 SHA，混用审计口径必拒', () => {
  const baseline = validateReferenceMotionBaselineReceiptV2();
  assert.equal(baseline.referenceMedia.sha256, 'f172d6dc4831ce51bdecfe1359b1187666cad23c098c402edfc6836e3e553949');
  assert.equal(baseline.referenceMedia.bytes, 27112016);
  assert.equal(baseline.referenceMedia.decodedFrameCount, 3304);
  assert.equal(baseline.algorithm.scale, '160x90');
  assert.equal(baseline.algorithm.pixelFormat, 'rgb24');
  assert.equal(baseline.measurements.entropyMean, 6.747083563);
  assert.equal(baseline.measurements.edgeStrengthMean, 9.675752279);
  assert.equal(baseline.measurements.meanMadRgb, 3.073518294);
  assert.equal(baseline.measurements.p90MadRgb, 8.413611111);
  assert.equal(baseline.verifiedImplementation.sha256, sha256FileForQaV2(path.join(projectRoot, 'tools/video-quality-metrics-v2.mjs')));

  const wrongAlgorithm = JSON.parse(JSON.stringify(LOCKED_REFERENCE_MOTION_BASELINE_V2));
  wrongAlgorithm.algorithm.id = 'reference-audit/s16-center-window-nearest-rank-v1';
  assert.throws(
    () => validateReferenceMotionBaselineReceiptV2(wrongAlgorithm),
    (error) => error.code === 'REFERENCE_BASELINE_ALGORITHM_MISMATCH',
  );

  const mixedAuditValues = JSON.parse(JSON.stringify(LOCKED_REFERENCE_MOTION_BASELINE_V2));
  mixedAuditValues.measurements.meanMadRgb = 3.339391;
  mixedAuditValues.measurements.p90MadRgb = 9.22805;
  const {receiptSha256: _oldReceiptSha256, ...mixedDefinition} = mixedAuditValues;
  mixedAuditValues.receiptSha256 = stableJsonSha256V2(mixedDefinition);
  assert.throws(
    () => validateReferenceMotionBaselineReceiptV2(mixedAuditValues),
    (error) => error.code === 'REFERENCE_BASELINE_RECEIPT_SHA_MISMATCH',
  );
});

test('确定性细胞结构动态技术 fixture 实测 ffprobe/全解码/帧数/PTS/熵/边缘/OCR/边界，且永不晋级', async () => {
  const durableArtifactTarget = path.join(testRoot, 'media-qa', 'valid');
  const result = await runLockedMediaDiagnosticsForGeneratedVideoV2({
    videoPath: relative(assets.validVideo),
    expectations: mediaExpectations(),
    artifactsDirectory: relative(durableArtifactTarget),
  });
  assert.equal(result.promotionEligibleEvidence, false);
  assert.equal(result.technicalQaPassed, false);
  assert.equal(result.status, 'diagnostic-passed', JSON.stringify({errors: result.errors, summary: result.metrics.summary, boundaries: result.metrics.boundaries}));
  assert.deepEqual(result.errors, []);
  assert.equal(result.userReviewEligible, false);
  assert.equal(result.styleReviewDisposition, 'diagnostic-only-not-a-style-candidate');
  assert.equal(result.probe.width, 1920);
  assert.equal(result.probe.height, 1080);
  assert.equal(result.probe.fps, 24);
  assert.equal(result.checks.fullDecode.status, 'passed');
  assert.equal(result.checks.frameCoverage.decodedFrames, 120);
  assert.ok(result.metrics.summary.entropy.median > 0);
  assert.ok(result.metrics.summary.edgeStrength.median > 0);
  assert.equal(result.metrics.referenceMotionComparison.reference.meanMadRgb, LOCKED_REFERENCE_MOTION_BASELINE_V2.measurements.meanMadRgb);
  assert.equal(result.metrics.referenceMotionComparison.reference.p90MadRgb, LOCKED_REFERENCE_MOTION_BASELINE_V2.measurements.p90MadRgb);
  assert.equal(result.metrics.referenceMotionComparison.reference.receiptSha256, LOCKED_REFERENCE_MOTION_BASELINE_V2.receiptSha256);
  assert.equal(result.metrics.referenceMotionComparison.reference.media.sha256, LOCKED_REFERENCE_MOTION_BASELINE_V2.referenceMedia.sha256);
  assert.equal(result.metrics.referenceMotionComparison.materiallyBelowReference, false);
  assert.ok(result.checks.ocr.samples.length > 0);
  assert.equal(result.persisted, false);
  assert.equal(existsSync(durableArtifactTarget), false);
  assert.ok(result.artifacts.every((artifact) => artifact.storage === 'transient-removed'));
  process.stdout.write(`# QA_MOTION_COMPARISON mean=${result.metrics.referenceMotionComparison.candidate.meanMadRgb.toFixed(6)} p90=${result.metrics.referenceMotionComparison.candidate.p90MadRgb.toFixed(6)} referenceMean=${LOCKED_REFERENCE_MOTION_BASELINE_V2.measurements.meanMadRgb.toFixed(6)} referenceP90=${LOCKED_REFERENCE_MOTION_BASELINE_V2.measurements.p90MadRgb.toFixed(6)} baselineReceipt=${LOCKED_REFERENCE_MOTION_BASELINE_V2.receiptSha256} blocked=${result.metrics.referenceMotionComparison.materiallyBelowReference}\n`);
});

test('黑场实测超限', async () => {
  const result = await runLockedMediaDiagnosticsForGeneratedVideoV2({videoPath: relative(assets.blackVideo), expectations: mediaExpectations(), artifactsDirectory: relative(path.join(testRoot, 'media-qa', 'black'))});
  assert.ok(result.errors.some((error) => error.code === 'BLACK_RUN_EXCEEDED'));
});

test('白场实测超限', async () => {
  const result = await runLockedMediaDiagnosticsForGeneratedVideoV2({videoPath: relative(assets.whiteVideo), expectations: mediaExpectations(), artifactsDirectory: relative(path.join(testRoot, 'media-qa', 'white'))});
  assert.ok(result.errors.some((error) => error.code === 'WHITE_RUN_EXCEEDED'));
});

test('冻结和连续重复帧实测超限', async () => {
  const result = await runLockedMediaDiagnosticsForGeneratedVideoV2({videoPath: relative(assets.freezeVideo), expectations: mediaExpectations(), artifactsDirectory: relative(path.join(testRoot, 'media-qa', 'freeze'))});
  const codes = new Set(result.errors.map((error) => error.code));
  assert.ok(codes.has('FREEZE_RUN_EXCEEDED'));
  assert.ok(codes.has('EXACT_DUPLICATE_RUN_EXCEEDED'));
  assert.ok(codes.has('REFERENCE_MOTION_MATERIAL_GAP'));
  assert.equal(result.metrics.referenceMotionComparison.materiallyBelowReference, true);
  assert.equal(result.userReviewEligible, false);
  assert.equal(result.styleReviewDisposition, 'candidate-blocked-reference-motion-gap');
});

test('计划为静音时意外音轨实测被拒绝', async () => {
  const result = await runLockedMediaDiagnosticsForGeneratedVideoV2({videoPath: relative(assets.audioVideo), expectations: mediaExpectations(), artifactsDirectory: relative(path.join(testRoot, 'media-qa', 'audio'))});
  assert.ok(result.errors.some((error) => error.code === 'AUDIO_TRACK_COUNT_MISMATCH'));
});

test('OCR 缺失时不得产生完整 QA 结论', async () => {
  await assert.rejects(
    runLockedMediaDiagnosticsForGeneratedVideoV2({videoPath: relative(assets.validVideo), expectations: mediaExpectations(), artifactsDirectory: relative(path.join(testRoot, 'media-qa', 'missing-ocr')), tesseractBin: path.join(testRoot, 'missing-tesseract')}),
    (error) => error.code === 'TESSERACT_UNAVAILABLE',
  );
});

test('损坏容器/码流被 ffprobe 或全解码阻断', async () => {
  await assert.rejects(
    runLockedMediaDiagnosticsForGeneratedVideoV2({videoPath: relative(assets.corruptVideo), expectations: mediaExpectations(), artifactsDirectory: relative(path.join(testRoot, 'media-qa', 'corrupt'))}),
    (error) => ['FFPROBE_FAILED', 'VIDEO_DECODE_FAILED', 'FRAME_ANALYSIS_FAILED', 'VIDEO_FRAME_PTS_MISSING'].includes(error.code),
  );
});

test('请求不得放宽风格卡阈值，且写入前拒绝', async () => {
  const plan = makeCandidatePlan();
  const request = blockedQaRequest(plan, assets.validVideo);
  request.thresholds = {minimumMedianEntropy: 0};
  const {result, outputPath, artifactsDirectory} = await runBlockedCase('threshold-override', request);
  assert.equal(result.error.code, 'QA_THRESHOLD_OVERRIDE_FORBIDDEN');
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(artifactsDirectory), false);
});

test('CLI 缺参稳定退出 2，不回显环境变量', () => {
  const result = spawnSync(process.execPath, [qaScript], {encoding: 'utf8', env: {...process.env, QA_V2_SECRET_SENTINEL: 'must-not-appear'}});
  assert.equal(result.status, 2);
  assert.match(result.stderr, /CLI_ARGUMENT_REQUIRED/u);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /must-not-appear/u);
});

test('当前无外部用户完整观看回执+独立监督回执，不存在可合法制造的 promotion 正例', async () => {
  const plan = makeCandidatePlan();
  const {result, outputPath, artifactsDirectory} = await runBlockedCase('no-external-receipts', blockedQaRequest(plan, assets.validVideo));
  assert.equal(result.persisted, false);
  assert.equal(result.receipt, null);
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(artifactsDirectory), false);
});

console.log(`QA v2 回归目录：${relative(testRoot)}；预期 networkCalls=0；skipped=0`);
