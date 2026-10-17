#!/usr/bin/env node
// 只测试本期授权与参数边界；临时数据不是生产证据，不执行渲染。
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {AGILITY_CHAT_PREVIEW_MODE, AGILITY_CHAT_PREVIEW_ROUTE, AGILITY_CHAT_SOURCE,
  validateAgilityChatPreviewAuthorization} from '../scripts/small-business-ai-agility-chat-preview-authorization.mjs';
import {buildControlledRemotionRenderArgsV2} from '../scripts/remotion-production-command-v2.mjs';
import {computeProductionGateClosureV2} from '../scripts/director-production-preflight-v2.mjs';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'agility-chat-boundary-')));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const put = (path, body) => {
  const file = resolve(root, path); mkdirSync(dirname(file), {recursive: true});
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(`${JSON.stringify(body, null, 2)}\n`);
  writeFileSync(file, bytes); return {path, sha256: digest(bytes)};
};
const readBoundJson = (projectRoot, reference) => {
  assert.ok(reference?.path && /^[a-f0-9]{64}$/u.test(reference.sha256));
  const bytes = readFileSync(resolve(projectRoot, reference.path));
  assert.equal(digest(bytes), reference.sha256);
  return {...reference, body: JSON.parse(bytes)};
};
const identity = {episodeId: 'small-business-ai-agility-20261017', taskId: 'SMALL_BUSINESS_AI_AGILITY_20261017',
  jobId: '20261017_small_business_ai_agility_v9_candidate', revisionId: 'small-business-ai-agility-v9-static-preview-r1-20261017'};
const inputFormat = 'director-cues-v2-surface-bound';
const flags = ['independentSignature', 'humanAcceptancePerformed', 'productionEligible', 'formalEnabled',
  'candidateAccepted', 'userPreviewApproved', 'fullWatchConfirmed', 'publishAuthorized'];
let command, job, input, binding, authorization, passed = 0;
const save = () => {job.productionGate.localChatPreviewAuthorization = put('authorization.json', authorization);};
const check = () => validateAgilityChatPreviewAuthorization({projectRoot: root, job, input, binding, command, readBoundJson});
function reset() {
  command = 'direct-remotion-preview';
  input = {...identity, inputFormat, authorizedUserId: 'boundary-test-user', executionGroupId: 'boundary-test-execution'};
  binding = {...identity, firstCandidateInputSha256: '1'.repeat(64), jobSnapshotSha256: '2'.repeat(64),
    boundFiles: [{path: 'synthetic.png', sha256: '3'.repeat(64), bytes: 1}], gateClosureSha256: '4'.repeat(64)};
  job = {videoId: identity.episodeId, jobId: identity.jobId, director: {taskId: identity.taskId, inputFormat},
    productionGate: {revisionId: identity.revisionId, previewAuthorizationMode: AGILITY_CHAT_PREVIEW_MODE,
      firstCandidateAuthorization: null, freezeReceipt: null}};
  authorization = {...identity, schema: 'episode-local-chat-preview-authorization/v1',
    authorizationMethod: 'current-chat-verbatim', decision: 'allow-episode-internal-review-preview', role: 'user',
    authorizedUserId: input.authorizedUserId, executionGroupId: input.executionGroupId, recordedAt: new Date().toISOString(),
    allowedCommands: ['direct-remotion-preview'], sourceMessages: {...AGILITY_CHAT_SOURCE}, binding: structuredClone(binding),
    ...Object.fromEntries(flags.map(key => [key, false]))};
  save();
}
const reject = (name, mutate, code) => {
  reset(); mutate(); save();
  assert.throws(check, error => code ? error.code === code : true, name); passed++;
};
try {
  const source = readFileSync(resolve(repo, AGILITY_CHAT_SOURCE.path));
  assert.equal(digest(source), AGILITY_CHAT_SOURCE.sha256); put(AGILITY_CHAT_SOURCE.path, source);
  reset(); assert.equal(check().independentSignature, false); passed++;
  for (const value of ['preview', 'formal', 'direct-remotion-render', 'release-validation', 'all']) {
    reject(`禁止越界命令 ${value}`, () => {command = value;}, 'AGCP_COMMAND_OR_FORMAT_FORBIDDEN');
  }
  reject('不接受上一期模式', () => {job.productionGate.previewAuthorizationMode = 'musk-grok-current-chat-review/v1';},
    'AGCP_COMMAND_OR_FORMAT_FORBIDDEN');
  reject('不接受其他输入格式', () => {input.inputFormat = 'legacy';}, 'AGCP_COMMAND_OR_FORMAT_FORBIDDEN');
  reject('不接受其他job', () => {job.jobId = 'other-job';}, 'AGCP_EPISODE_IDENTITY_MISMATCH');
  reject('不接受下一期', () => {job.videoId = 'another-episode';}, 'AGCP_EPISODE_IDENTITY_MISMATCH');
  for (const key of Object.keys(identity)) {
    reject(`对齐其他绑定也不能扩展 ${key}`, () => {
      input[key] = binding[key] = authorization[key] = 'out-of-scope'; authorization.binding = structuredClone(binding);
    }, 'AGCP_EPISODE_IDENTITY_MISMATCH');
  }
  for (const flag of flags) {
    reject(`授权不可提前验收 ${flag}`, () => {authorization[flag] = true;}, 'AGCP_FUTURE_ACCEPTANCE_FORBIDDEN');
    reject(`job不可提前验收 ${flag}`, () => {job[flag] = true;}, 'AGCP_FUTURE_ACCEPTANCE_FORBIDDEN');
  }
  for (const key of ['firstCandidateAuthorization', 'freezeReceipt']) {
    reject(`不可冒充独立签名 ${key}`, () => {job.productionGate[key] = {path: 'fake.json', sha256: '0'.repeat(64)};},
      'AGCP_INDEPENDENT_SIGNATURE_MUST_NOT_BE_IMPERSONATED');
  }
  for (const key of ['firstCandidateInputSha256', 'jobSnapshotSha256', 'gateClosureSha256']) {
    reject(`必须重绑 ${key}`, () => {binding[key] = '9'.repeat(64);}, 'AGCP_INPUT_OR_CODE_BINDING_CHANGED');
  }
  reject('素材更换必须重绑', () => {binding.boundFiles[0].sha256 = '8'.repeat(64);}, 'AGCP_INPUT_OR_CODE_BINDING_CHANGED');
  reject('只准预览命令', () => {authorization.allowedCommands.push('direct-remotion-render');}, 'AGCP_COMMAND_SCOPE_INVALID');
  reject('原话必须原位置', () => {authorization.sourceMessages = put('copied-source.json', source);}, 'AGCP_CURRENT_CHAT_REFERENCE_REQUIRED');
  reject('原话不能伪填哈希', () => {authorization.sourceMessages.sha256 = '0'.repeat(64);});
  reject('改写原话并自填哈希不算授权', () => {
    const altered = JSON.parse(source); altered.userReply = '公开发布';
    authorization.sourceMessages = put(AGILITY_CHAT_SOURCE.path, altered);
  }, 'AGCP_CURRENT_CHAT_REFERENCE_REQUIRED');
  put(AGILITY_CHAT_SOURCE.path, source);
  const closure = computeProductionGateClosureV2({projectRoot: repo});
  assert(closure.files.some(file => file.path === 'skills/koubo-remotion-director/scripts/small-business-ai-agility-chat-preview-authorization.mjs')); passed++;
  const base = {entryRelative: 'src/entry.tsx', composition: 'SmallBusinessAiAgility20261017-WithSfx',
    output: '/isolated/preview.mp4', publicDir: '/isolated/public'};
  const settings = {concurrency: 1, timeoutInMilliseconds: 120000, scale: 2 / 3};
  const context = {mode: 'preview', command: 'direct-remotion-preview', preflightRoute: AGILITY_CHAT_PREVIEW_ROUTE,
    episodeId: identity.episodeId, jobId: identity.jobId, revisionId: identity.revisionId, inputFormat,
    width: 1920, height: 1080, fps: 30, durationSeconds: 4126 / 30};
  const args = buildControlledRemotionRenderArgsV2({...base, renderContext: context, previewRenderSettings: settings});
  assert.deepEqual(args.slice(-3), ['--concurrency=1', '--timeout=120000', '--scale=0.6666666666666666']);
  assert.equal(args.some(arg => /^--(?:frames|fps|duration|props)(?:=|$)/u.test(arg)), false); passed++;
  for (const [key, value] of Object.entries({mode: 'formal', command: 'direct-remotion-render',
    preflightRoute: 'musk-grok-current-chat-review', episodeId: 'other-episode', jobId: 'other-job', revisionId: 'r2',
    inputFormat: 'legacy', width: 1280, height: 720, fps: 24, durationSeconds: 100})) {
    assert.throws(() => buildControlledRemotionRenderArgsV2({...base, previewRenderSettings: settings,
      renderContext: {...context, [key]: value}}), error => error.code === 'RRPV2_PREVIEW_SETTINGS_SCOPE_INVALID'); passed++;
  }
  for (const invalid of [null, [], {}, {...settings, concurrency: 2}, {...settings, timeoutInMilliseconds: 600000},
    {...settings, scale: 1}, {...settings, crf: 1}]) {
    assert.throws(() => buildControlledRemotionRenderArgsV2({...base, renderContext: context, previewRenderSettings: invalid}),
      error => error.code === 'RRPV2_PREVIEW_SETTINGS_INVALID'); passed++;
  }
  console.log(JSON.stringify({ok: true, passed, previewDimensions: [1280, 720], durationInFrames: 4126,
    productionRenderInvoked: false, independentSignatureCreated: false}));
} finally {rmSync(root, {recursive: true, force: true});}
