#!/usr/bin/env node
// 只读授权边界测试；固定原话来自本期记录，绑定值为测试数据，不执行生产。
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MUSK_GROK_CHAT_PREVIEW_MODE, MUSK_GROK_CHAT_SOURCE, MUSK_GROK_CHAT_R2_SOURCE, MUSK_GROK_CHAT_R3_SOURCE,
  validateMuskGrokChatPreviewAuthorization} from '../scripts/musk-grok-chat-preview-authorization.mjs';
import {NATIVE_V2_INPUT_FORMAT} from '../scripts/native-v2-first-candidate-input.mjs';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'musk-grok-chat-boundary-')));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const put = (path, body) => {
  const file = resolve(root, path); mkdirSync(dirname(file), {recursive: true});
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(`${JSON.stringify(body, null, 2)}\n`);
  writeFileSync(file, bytes); return {path, sha256: digest(bytes)};
};
const readBoundJson = (projectRoot, reference) => {
  assert.ok(reference?.path && /^[a-f0-9]{64}$/u.test(reference.sha256), '真实引用必需');
  const bytes = readFileSync(resolve(projectRoot, reference.path));
  assert.equal(digest(bytes), reference.sha256, '引用字节漂移');
  return {...reference, body: JSON.parse(bytes)};
};
const identity = {episodeId: 'musk-grok-business-ai-20261016', taskId: '20261016_musk_grok_business_ai_director_v2',
  jobId: '20261016_musk_grok_business_ai_v9_candidate', revisionId: 'musk-grok-business-ai-v9-preview-r1-20261016'};
const r2Revision = 'musk-grok-business-ai-v9-preview-r2-20261016';
const r3Revision = 'musk-grok-business-ai-v9-full-candidate-r3-20261016';
let command, job, input, binding, authorization;
const save = () => {job.productionGate.localChatPreviewAuthorization = put('authorization.json', authorization);};
const check = () => validateMuskGrokChatPreviewAuthorization({projectRoot: root, job, input, binding, command, readBoundJson});
function reset(revisionId = identity.revisionId) {
  const currentIdentity = {...identity, revisionId};
  command = 'direct-remotion-preview';
  input = {...currentIdentity, inputFormat: NATIVE_V2_INPUT_FORMAT, authorizedUserId: 'boundary-test-user', executionGroupId: 'boundary-test-execution'};
  binding = {...currentIdentity, firstCandidateInputSha256: '1'.repeat(64), jobSnapshotSha256: '2'.repeat(64),
    boundFiles: [{path: 'synthetic.mp4', sha256: '3'.repeat(64), bytes: 1}], gateClosureSha256: '4'.repeat(64)};
  job = {videoId: identity.episodeId, jobId: identity.jobId,
    director: {taskId: identity.taskId, inputFormat: NATIVE_V2_INPUT_FORMAT},
    productionGate: {revisionId, previewAuthorizationMode: MUSK_GROK_CHAT_PREVIEW_MODE,
      firstCandidateAuthorization: null, freezeReceipt: null}};
  authorization = {...currentIdentity, schema: 'episode-local-chat-preview-authorization/v1',
    authorizationMethod: 'current-chat-verbatim', decision: 'allow-episode-internal-review-preview', role: 'user',
    authorizedUserId: input.authorizedUserId, executionGroupId: input.executionGroupId, recordedAt: new Date().toISOString(),
    allowedCommands: ['direct-remotion-preview'],
    sourceMessages: {...(revisionId === r3Revision ? MUSK_GROK_CHAT_R3_SOURCE :
      revisionId === r2Revision ? MUSK_GROK_CHAT_R2_SOURCE : MUSK_GROK_CHAT_SOURCE)}, binding: structuredClone(binding),
    independentSignature: false, humanAcceptancePerformed: false, productionEligible: false, formalEnabled: false,
    candidateAccepted: false, userPreviewApproved: false, fullWatchConfirmed: false, publishAuthorized: false};
  save();
}
let passed = 0;
const reject = (name, mutate, code, revisionId) => {
  reset(revisionId); mutate(); save();
  assert.throws(check, error => code ? error.code === code : true, name);
  passed++; console.log(`通过：${name}`);
};
try {
  const source = readFileSync(resolve(repo, MUSK_GROK_CHAT_SOURCE.path));
  assert.equal(digest(source), MUSK_GROK_CHAT_SOURCE.sha256);
  put(MUSK_GROK_CHAT_SOURCE.path, source);
  reset(); assert.equal(check().independentSignature, false); passed++;
  for (const forbidden of ['preview', 'formal', 'direct-remotion-render', 'release-validation', 'all']) {
    reject(`不准扩展命令 ${forbidden}`, () => {command = forbidden;}, 'MGCP_COMMAND_OR_FORMAT_FORBIDDEN');
  }
  reject('不能改成下一期', () => {job.videoId = 'another-episode';}, 'MGCP_EPISODE_IDENTITY_MISMATCH');
  reject('不能用于另一修订', () => {job.productionGate.revisionId = 'r2';}, 'MGCP_EPISODE_IDENTITY_MISMATCH');
  reject('不能用于旧输入格式', () => {input.inputFormat = 'legacy';}, 'MGCP_COMMAND_OR_FORMAT_FORBIDDEN');
  reject('不能把未知授权模式作为回退', () => {job.productionGate.previewAuthorizationMode = 'fallback';}, 'MGCP_COMMAND_OR_FORMAT_FORBIDDEN');
  reject('不能自称独立签署', () => {authorization.independentSignature = true;}, 'MGCP_FUTURE_ACCEPTANCE_FORBIDDEN');
  for (const flag of ['humanAcceptancePerformed', 'productionEligible', 'formalEnabled', 'candidateAccepted',
    'userPreviewApproved', 'fullWatchConfirmed', 'publishAuthorized']) {
    reject(`不能提前置真 ${flag}`, () => {authorization[flag] = true;}, 'MGCP_FUTURE_ACCEPTANCE_FORBIDDEN');
  }
  reject('job也不能标为已观看', () => {job.fullWatchConfirmed = true;}, 'MGCP_FUTURE_ACCEPTANCE_FORBIDDEN');
  reject('不能混用监督签名槽', () => {job.productionGate.freezeReceipt = {path: 'fake.json', sha256: '0'.repeat(64)};}, 'MGCP_INDEPENDENT_SIGNATURE_MUST_NOT_BE_IMPERSONATED');
  reject('输入改变必须重绑', () => {binding.firstCandidateInputSha256 = '5'.repeat(64);}, 'MGCP_INPUT_OR_CODE_BINDING_CHANGED');
  reject('代码闭包改变必须重绑', () => {binding.gateClosureSha256 = '5'.repeat(64);}, 'MGCP_INPUT_OR_CODE_BINDING_CHANGED');
  reject('素材改变必须重绑', () => {binding.boundFiles[0].sha256 = '5'.repeat(64);}, 'MGCP_INPUT_OR_CODE_BINDING_CHANGED');
  reject('必须绑定真实原话文件', () => {authorization.sourceMessages = null;});
  reject('原话SHA不能自填', () => {authorization.sourceMessages.sha256 = '0'.repeat(64);});
  reject('复制原话到任意位置也不能授权', () => {
    authorization.sourceMessages = put('other.json', source);
  }, 'MGCP_CURRENT_CHAT_REFERENCE_REQUIRED');
  reject('不能夹带正式命令', () => {authorization.allowedCommands.push('direct-remotion-render');}, 'MGCP_COMMAND_SCOPE_INVALID');
  reset(); save(); job.productionGate.localChatPreviewAuthorization = null; assert.throws(check); passed++;
  const r2Source = readFileSync(resolve(repo, MUSK_GROK_CHAT_R2_SOURCE.path));
  assert.equal(digest(r2Source), MUSK_GROK_CHAT_R2_SOURCE.sha256);
  put(MUSK_GROK_CHAT_R2_SOURCE.path, r2Source);
  reset(r2Revision); assert.equal(check().sourceMessageSha256, MUSK_GROK_CHAT_R2_SOURCE.sha256); passed++;
  reject('R2必须使用本轮改片原话', () => {authorization.sourceMessages = {...MUSK_GROK_CHAT_SOURCE};},
    'MGCP_CURRENT_CHAT_REFERENCE_REQUIRED', r2Revision);
  reject('R1不得反用R2原话', () => {authorization.sourceMessages = {...MUSK_GROK_CHAT_R2_SOURCE};},
    'MGCP_CURRENT_CHAT_REFERENCE_REQUIRED');
  reject('不能对齐全部字段后扩展R3', () => {
    const revision = 'musk-grok-business-ai-v9-preview-r3-20261016';
    job.productionGate.revisionId = revision; input.revisionId = revision;
    binding.revisionId = revision; authorization.revisionId = revision; authorization.binding = structuredClone(binding);
  }, 'MGCP_EPISODE_IDENTITY_MISMATCH', r2Revision);
  reject('R2不能对齐全部字段后改job', () => {
    for (const object of [job, input, binding, authorization]) object.jobId = 'other-job';
    authorization.binding = structuredClone(binding);
  }, 'MGCP_EPISODE_IDENTITY_MISMATCH', r2Revision);
  reject('R2原话复制到其他位置不能放行', () => {authorization.sourceMessages = put('copied-r2.json', r2Source);},
    'MGCP_CURRENT_CHAT_REFERENCE_REQUIRED', r2Revision);
  reject('R2改写原话并自填新哈希不能放行', () => {
    const altered = JSON.parse(r2Source); altered.verbatimUserMessage = '公开发布';
    authorization.sourceMessages = put(MUSK_GROK_CHAT_R2_SOURCE.path, altered);
  }, 'MGCP_CURRENT_CHAT_REFERENCE_REQUIRED', r2Revision);
  put(MUSK_GROK_CHAT_R2_SOURCE.path, r2Source);
  reject('R2素材变更后必须重新绑定', () => {binding.boundFiles[0].sha256 = '8'.repeat(64);},
    'MGCP_INPUT_OR_CODE_BINDING_CHANGED', r2Revision);
  for (const forbidden of ['formal', 'direct-remotion-render', 'release-validation']) {
    reject(`R2不准扩展命令 ${forbidden}`, () => {command = forbidden;}, 'MGCP_COMMAND_OR_FORMAT_FORBIDDEN', r2Revision);
  }
  for (const flag of ['independentSignature', 'humanAcceptancePerformed', 'productionEligible', 'formalEnabled',
    'candidateAccepted', 'userPreviewApproved', 'fullWatchConfirmed', 'publishAuthorized']) {
    reject(`R2不能提前置真 ${flag}`, () => {authorization[flag] = true;}, 'MGCP_FUTURE_ACCEPTANCE_FORBIDDEN', r2Revision);
  }
  const r3Source = readFileSync(resolve(repo, MUSK_GROK_CHAT_R3_SOURCE.path));
  assert.equal(digest(r3Source), MUSK_GROK_CHAT_R3_SOURCE.sha256); put(MUSK_GROK_CHAT_R3_SOURCE.path, r3Source);
  reset(r3Revision); assert.equal(check().sourceMessageSha256, MUSK_GROK_CHAT_R3_SOURCE.sha256); passed++;
  reject('R3不得复用R2改片原话', () => {authorization.sourceMessages = {...MUSK_GROK_CHAT_R2_SOURCE};},
    'MGCP_CURRENT_CHAT_REFERENCE_REQUIRED', r3Revision);
  reject('R2不得反用R3正片原话', () => {authorization.sourceMessages = {...MUSK_GROK_CHAT_R3_SOURCE};},
    'MGCP_CURRENT_CHAT_REFERENCE_REQUIRED', r2Revision);
  reject('R3原话不得复制到任意位置', () => {authorization.sourceMessages = put('copied-r3.json', r3Source);},
    'MGCP_CURRENT_CHAT_REFERENCE_REQUIRED', r3Revision);
  reject('R3不得扩展下一修订', () => {
    const revision = 'musk-grok-business-ai-v9-full-candidate-r4-20261016';
    job.productionGate.revisionId = revision; input.revisionId = revision;
    binding.revisionId = revision; authorization.revisionId = revision; authorization.binding = structuredClone(binding);
  }, 'MGCP_EPISODE_IDENTITY_MISMATCH', r3Revision);
  for (const forbidden of ['formal', 'direct-remotion-render', 'release-validation']) {
    reject(`R3不得升级成正式验收命令 ${forbidden}`, () => {command = forbidden;}, 'MGCP_COMMAND_OR_FORMAT_FORBIDDEN', r3Revision);
  }
  for (const flag of ['independentSignature', 'humanAcceptancePerformed', 'productionEligible', 'formalEnabled',
    'candidateAccepted', 'userPreviewApproved', 'fullWatchConfirmed', 'publishAuthorized']) {
    reject(`R3正片分辨率不等于 ${flag}`, () => {authorization[flag] = true;}, 'MGCP_FUTURE_ACCEPTANCE_FORBIDDEN', r3Revision);
  }
  reject('R3正文变更必须重绑', () => {binding.firstCandidateInputSha256 = '9'.repeat(64);},
    'MGCP_INPUT_OR_CODE_BINDING_CHANGED', r3Revision);
  console.log(JSON.stringify({ok: true, passed, productionRenderInvoked: false, independentSignatureCreated: false}));
} finally {rmSync(root, {recursive: true, force: true});}
