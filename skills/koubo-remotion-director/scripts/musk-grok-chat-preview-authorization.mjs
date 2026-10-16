import {resolve} from 'node:path';
import {stableJsonSha256} from './director-contract-v2-core.mjs';
import {NATIVE_V2_INPUT_FORMAT} from './native-v2-first-candidate-input.mjs';

// 2026-10-16 本期明确授权：不是通用候选或独立签名的失败回退。
export const MUSK_GROK_CHAT_PREVIEW_MODE = 'musk-grok-current-chat-review/v1';
export const MUSK_GROK_CHAT_SOURCE = Object.freeze({
  path: 'edit/20261016_musk_grok_business_ai/05_后期工程/本期候选输入/本轮内部预览用户原话.v1.json',
  sha256: '81c80095470c85f22e7ed7871882110c77826a2028ad33ee994f7c60a4c67f7f',
});
const identity = Object.freeze({
  episodeId: 'musk-grok-business-ai-20261016',
  taskId: '20261016_musk_grok_business_ai_director_v2',
  jobId: '20261016_musk_grok_business_ai_v9_candidate',
  revisionId: 'musk-grok-business-ai-v9-preview-r1-20261016',
});
const question = '是否允许再修复这处内部预览入口：直接采用你在本聊天中的明确授权，导出仅供你观看的 V9 小样；原声、素材、字幕检查照常，正式成片验收和发布门禁保持不变？需要单独确认，是因为现有代码还要求本机未配置的独立签名，这超出了刚才“带字纸艺兼容”的修改范围。';
const answer = '允许，仅修复内部预览入口并出小样';
const requireValue = (condition, code) => {
  if (!condition) throw Object.assign(new Error(`本期聊天预览授权拒绝：${code}`), {code});
};

export function validateMuskGrokChatPreviewAuthorization({projectRoot, job, input, binding, command, readBoundJson}) {
  const gate = job.productionGate;
  requireValue(command === 'direct-remotion-preview' &&
    gate.previewAuthorizationMode === MUSK_GROK_CHAT_PREVIEW_MODE &&
    input.inputFormat === NATIVE_V2_INPUT_FORMAT && job.director?.inputFormat === NATIVE_V2_INPUT_FORMAT,
    'MGCP_COMMAND_OR_FORMAT_FORBIDDEN');
  for (const [key, value] of Object.entries(identity)) {
    requireValue(input[key] === value && binding[key] === value, 'MGCP_EPISODE_IDENTITY_MISMATCH');
  }
  requireValue(job.videoId === identity.episodeId && job.jobId === identity.jobId &&
    job.director.taskId === identity.taskId && gate.revisionId === identity.revisionId,
    'MGCP_EPISODE_IDENTITY_MISMATCH');
  requireValue(gate.firstCandidateAuthorization === null && gate.freezeReceipt === null,
    'MGCP_INDEPENDENT_SIGNATURE_MUST_NOT_BE_IMPERSONATED');
  for (const object of [job, gate, job.experiment ?? {}]) {
    for (const key of ['userPreviewApproved', 'fullWatchConfirmed', 'candidateAccepted', 'formalEnabled', 'publishAuthorized']) {
      requireValue(object[key] === undefined || object[key] === false, 'MGCP_FUTURE_ACCEPTANCE_FORBIDDEN');
    }
  }
  const authorization = readBoundJson(projectRoot, gate.localChatPreviewAuthorization, '本期聊天预览授权');
  const body = authorization.body;
  requireValue(body.schema === 'episode-local-chat-preview-authorization/v1' &&
    body.authorizationMethod === 'current-chat-verbatim' && body.decision === 'allow-episode-internal-review-preview' &&
    body.role === 'user' && body.authorizedUserId === input.authorizedUserId &&
    body.executionGroupId === input.executionGroupId && Number.isFinite(Date.parse(body.recordedAt)),
    'MGCP_AUTHORIZATION_SCHEMA_INVALID');
  for (const [key, value] of Object.entries(identity)) requireValue(body[key] === value, 'MGCP_EPISODE_IDENTITY_MISMATCH');
  requireValue(JSON.stringify(body.allowedCommands) === JSON.stringify(['direct-remotion-preview']),
    'MGCP_COMMAND_SCOPE_INVALID');
  for (const key of ['independentSignature', 'humanAcceptancePerformed', 'productionEligible', 'formalEnabled',
    'candidateAccepted', 'userPreviewApproved', 'fullWatchConfirmed', 'publishAuthorized']) {
    requireValue(body[key] === false, 'MGCP_FUTURE_ACCEPTANCE_FORBIDDEN');
  }
  requireValue(stableJsonSha256(body.binding) === stableJsonSha256(binding), 'MGCP_INPUT_OR_CODE_BINDING_CHANGED');
  const source = readBoundJson(projectRoot, body.sourceMessages, '本轮真实聊天原话');
  requireValue(resolve(projectRoot, source.path) === resolve(projectRoot, MUSK_GROK_CHAT_SOURCE.path) &&
    source.sha256 === MUSK_GROK_CHAT_SOURCE.sha256, 'MGCP_CURRENT_CHAT_REFERENCE_REQUIRED');
  requireValue(source.body.schemaVersion === 'episode-local-chat-source-record/v1' &&
    source.body.episodeId === identity.episodeId && source.body.question === question && source.body.userReply === answer &&
    source.body.source?.kind === 'current-chat-human-reply-relayed-by-parent-agent' &&
    source.body.source?.platformMessageId === null && source.body.source?.platformMessageIdInvented === false &&
    source.body.authorizationType === 'local-chat-authorization' && source.body.isIndependentSignature === false &&
    ['fullWatchConfirmed', 'candidateAccepted', 'formalAuthorized', 'publishAuthorized'].every(key => source.body[key] === false),
    'MGCP_CHAT_SCOPE_INVALID');
  return {authorizationSha256: authorization.sha256, sourceMessageSha256: source.sha256,
    authorizationMethod: 'current-chat-verbatim', independentSignature: false};
}
