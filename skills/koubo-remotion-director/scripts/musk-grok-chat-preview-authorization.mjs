import {resolve} from 'node:path';
import {stableJsonSha256} from './director-contract-v2-core.mjs';
import {NATIVE_V2_INPUT_FORMAT} from './native-v2-first-candidate-input.mjs';

// 2026-10-16 本期明确授权：不是通用候选或独立签名的失败回退。
export const MUSK_GROK_CHAT_PREVIEW_MODE = 'musk-grok-current-chat-review/v1';
export const MUSK_GROK_CHAT_SOURCE = Object.freeze({
  path: 'edit/20261016_musk_grok_business_ai/05_后期工程/本期候选输入/本轮内部预览用户原话.v1.json',
  sha256: '81c80095470c85f22e7ed7871882110c77826a2028ad33ee994f7c60a4c67f7f',
});
export const MUSK_GROK_CHAT_R2_SOURCE = Object.freeze({
  path: 'edit/20261016_musk_grok_business_ai/07_小样修改R2/本轮用户修改原话.v1.json',
  sha256: 'aebacb06193cd1dc3c2a3e1dd8ecd72178426f37b4299a7ee678ee45044f9572',
});
const episodeIdentity = Object.freeze({
  episodeId: 'musk-grok-business-ai-20261016',
  taskId: '20261016_musk_grok_business_ai_director_v2',
  jobId: '20261016_musk_grok_business_ai_v9_candidate',
});
const r1Revision = 'musk-grok-business-ai-v9-preview-r1-20261016';
const r2Revision = 'musk-grok-business-ai-v9-preview-r2-20261016';
const question = '是否允许再修复这处内部预览入口：直接采用你在本聊天中的明确授权，导出仅供你观看的 V9 小样；原声、素材、字幕检查照常，正式成片验收和发布门禁保持不变？需要单独确认，是因为现有代码还要求本机未配置的独立签名，这超出了刚才“带字纸艺兼容”的修改范围。';
const answer = '允许，仅修复内部预览入口并出小样';
const r2Request = '20秒到35秒的话，我们全部用他的这个宣传视频。然后还是把我放在左下角，主要是把这些内容讲一下，尤其是他车吸在上面，很多这些画面你根据语义去判断一下，逐帧去匹配一下。然后其次呢，就是这个MJ要用的是这个配图。其余的暂时没有什么问题，抓紧去改一下。主要还是以他的这个汽车的主要画面为主，不要一直由我来讲，把我放在左下角，以他的车为主。然后再就是我们的那几个纸质的，两个纸质的视频在出现的时候还是一样，把我放到左下角进行一个丝滑的切换，不要把我直接去掉。';
const requireValue = (condition, code) => {
  if (!condition) throw Object.assign(new Error(`本期聊天预览授权拒绝：${code}`), {code});
};

export function validateMuskGrokChatPreviewAuthorization({projectRoot, job, input, binding, command, readBoundJson}) {
  const gate = job.productionGate;
  requireValue(command === 'direct-remotion-preview' &&
    gate.previewAuthorizationMode === MUSK_GROK_CHAT_PREVIEW_MODE &&
    input.inputFormat === NATIVE_V2_INPUT_FORMAT && job.director?.inputFormat === NATIVE_V2_INPUT_FORMAT,
    'MGCP_COMMAND_OR_FORMAT_FORBIDDEN');
  requireValue([r1Revision, r2Revision].includes(gate.revisionId), 'MGCP_EPISODE_IDENTITY_MISMATCH');
  const identity = {...episodeIdentity, revisionId: gate.revisionId};
  const expectedSource = gate.revisionId === r1Revision ? MUSK_GROK_CHAT_SOURCE : MUSK_GROK_CHAT_R2_SOURCE;
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
  requireValue(resolve(projectRoot, source.path) === resolve(projectRoot, expectedSource.path) &&
    source.sha256 === expectedSource.sha256, 'MGCP_CURRENT_CHAT_REFERENCE_REQUIRED');
  if (gate.revisionId === r1Revision) {
    requireValue(source.body.schemaVersion === 'episode-local-chat-source-record/v1' &&
      source.body.episodeId === identity.episodeId && source.body.question === question && source.body.userReply === answer &&
      source.body.source?.kind === 'current-chat-human-reply-relayed-by-parent-agent' &&
      source.body.source?.platformMessageId === null && source.body.source?.platformMessageIdInvented === false &&
      source.body.authorizationType === 'local-chat-authorization' && source.body.isIndependentSignature === false &&
      ['fullWatchConfirmed', 'candidateAccepted', 'formalAuthorized', 'publishAuthorized'].every(key => source.body[key] === false),
      'MGCP_CHAT_SCOPE_INVALID');
  } else {
    // R2 是用户直接要求的三处改片；保留原始消息结构，不伪造问答或独立签名。
    requireValue(source.body.schemaVersion === 'user-request-record/v1' &&
      source.body.source === 'current-human-chat-message' && source.body.verbatimUserMessage === r2Request &&
      source.body.attachment?.sha256 === '27e1c5efc5068255cbbbf87d184688013fa5b27da86207aa2f3670a11d9d98a2' &&
      source.body.scope === '本期内部V9小样R2局部修订；原声字幕及其余内容沿用；不授权公开发布',
      'MGCP_CHAT_SCOPE_INVALID');
  }
  return {authorizationSha256: authorization.sha256, sourceMessageSha256: source.sha256,
    authorizationMethod: 'current-chat-verbatim', independentSignature: false};
}
