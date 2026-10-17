import {resolve} from 'node:path';
import {stableJsonSha256} from './director-contract-v2-core.mjs';
import {NATIVE_V2_INPUT_FORMAT} from './native-v2-first-candidate-input.mjs';

// 仅对应本期真实问答和本次修订，不是缺少独立签名时的通用回退。
export const AGILITY_CHAT_PREVIEW_MODE = 'small-business-ai-agility-current-chat-review/v1';
export const AGILITY_CHAT_PREVIEW_ROUTE = 'small-business-ai-agility-current-chat-review';
export const AGILITY_CHAT_SOURCE = Object.freeze({
  path: 'edit/20261017_small_business_ai_agility/00_控制/本轮静图预览兼容授权原话.v1.json',
  sha256: '9dbb0cf19d3b1b4147e248a3ad90dcb9b4926942983367f6651b49306663e9b5',
});
export const AGILITY_VIDEO_R2_SOURCE = Object.freeze({
  path: 'edit/20261017_small_business_ai_agility/06_预览与质检/视频候选R2/本轮视频候选导出请求.v1.json',
  sha256: '9f034ddd652092c83416014548c27adccb6b4b8167417b5ffa2b014c667f74ef',
});
export const AGILITY_VIDEO_R2_REVISION = 'small-business-ai-agility-v9-video-candidate-r2-20261017';
export const AGILITY_MOTION_R3_REVISION = 'small-business-ai-agility-v9-motion-sample-r3-20261017';
export const AGILITY_MOTION_R3_SOURCE = Object.freeze({
  path: 'edit/20261017_small_business_ai_agility/08_动效优化小样R3/控制/本轮局部动效小样授权原话.v1.json',
  sha256: '25741223905c41545628f2081fa3fd9387f1f994dd531e32c518c206ebb7c464',
});
export const AGILITY_MOTION_R4_REVISION = 'small-business-ai-agility-v9-motion-full-candidate-r4-20261017';
export const AGILITY_MOTION_R4_SOURCE = Object.freeze({
  path: 'edit/20261017_small_business_ai_agility/09_动效优化正片R4/控制/本轮整片与发布包导出授权原话.v1.json',
  sha256: '79bbede24d7d6ce424c6a8b50ffe8a370962de13ae5d06c4dc98b437f74422b6',
});
const identity = Object.freeze({
  episodeId: 'small-business-ai-agility-20261017',
  taskId: 'SMALL_BUSINESS_AI_AGILITY_20261017',
  jobId: '20261017_small_business_ai_agility_v9_candidate',
  revisionId: 'small-business-ai-agility-v9-static-preview-r1-20261017',
});
const question = '本期组件能用静图，但受控导出程序仍只接受纸艺视频，聊天预览授权也被限定在上一期。是否允许我只修复这两处本期兼容，导出供你观看的预览？原声、字幕、其他镜头与发布门禁保持不变，不上传、不付费。';
const answer = '允许，只修本期兼容并导出预览';
const futureFlags = ['independentSignature', 'humanAcceptancePerformed', 'productionEligible', 'formalEnabled',
  'candidateAccepted', 'userPreviewApproved', 'fullWatchConfirmed', 'publishAuthorized'];
const requireValue = (condition, code) => {
  if (!condition) throw Object.assign(new Error(`本期静图聊天预览授权拒绝：${code}`), {code});
};

export function validateAgilityChatPreviewAuthorization({projectRoot, job, input, binding, command, readBoundJson}) {
  const gate = job.productionGate;
  const videoR2 = gate.revisionId === AGILITY_VIDEO_R2_REVISION;
  const motionR3 = gate.revisionId === AGILITY_MOTION_R3_REVISION;
  const motionR4 = gate.revisionId === AGILITY_MOTION_R4_REVISION;
  const expectedIdentity = motionR4 ? {...identity, revisionId: AGILITY_MOTION_R4_REVISION} : motionR3 ? {...identity, revisionId: AGILITY_MOTION_R3_REVISION} :
    videoR2 ? {...identity, revisionId: AGILITY_VIDEO_R2_REVISION} : identity;
  const expectedSource = motionR4 ? AGILITY_MOTION_R4_SOURCE : motionR3 ? AGILITY_MOTION_R3_SOURCE : videoR2 ? AGILITY_VIDEO_R2_SOURCE : AGILITY_CHAT_SOURCE;
  requireValue(command === 'direct-remotion-preview' && gate.previewAuthorizationMode === AGILITY_CHAT_PREVIEW_MODE &&
    input.inputFormat === NATIVE_V2_INPUT_FORMAT && job.director?.inputFormat === NATIVE_V2_INPUT_FORMAT,
  'AGCP_COMMAND_OR_FORMAT_FORBIDDEN');
  for (const [key, value] of Object.entries(expectedIdentity)) {
    requireValue(input[key] === value && binding[key] === value, 'AGCP_EPISODE_IDENTITY_MISMATCH');
  }
  requireValue(job.videoId === identity.episodeId && job.jobId === identity.jobId &&
    job.director.taskId === identity.taskId && gate.revisionId === expectedIdentity.revisionId,
  'AGCP_EPISODE_IDENTITY_MISMATCH');
  requireValue(gate.firstCandidateAuthorization === null && gate.freezeReceipt === null,
    'AGCP_INDEPENDENT_SIGNATURE_MUST_NOT_BE_IMPERSONATED');
  for (const object of [job, gate, job.experiment ?? {}]) {
    for (const key of futureFlags) requireValue(object[key] === undefined || object[key] === false,
      'AGCP_FUTURE_ACCEPTANCE_FORBIDDEN');
  }
  const authorization = readBoundJson(projectRoot, gate.localChatPreviewAuthorization, '本期静图聊天预览授权');
  const body = authorization.body;
  requireValue(body.schema === 'episode-local-chat-preview-authorization/v1' &&
    body.authorizationMethod === 'current-chat-verbatim' && body.decision === 'allow-episode-internal-review-preview' &&
    body.role === 'user' && body.authorizedUserId === input.authorizedUserId &&
    body.executionGroupId === input.executionGroupId && Number.isFinite(Date.parse(body.recordedAt)),
  'AGCP_AUTHORIZATION_SCHEMA_INVALID');
  for (const [key, value] of Object.entries(expectedIdentity)) requireValue(body[key] === value, 'AGCP_EPISODE_IDENTITY_MISMATCH');
  requireValue(JSON.stringify(body.allowedCommands) === JSON.stringify(['direct-remotion-preview']),
    'AGCP_COMMAND_SCOPE_INVALID');
  for (const key of futureFlags) requireValue(body[key] === false, 'AGCP_FUTURE_ACCEPTANCE_FORBIDDEN');
  requireValue(stableJsonSha256(body.binding) === stableJsonSha256(binding), 'AGCP_INPUT_OR_CODE_BINDING_CHANGED');
  const source = readBoundJson(projectRoot, body.sourceMessages, '本轮静图兼容真实问答');
  requireValue(resolve(projectRoot, source.path) === resolve(projectRoot, expectedSource.path) &&
    source.sha256 === expectedSource.sha256, 'AGCP_CURRENT_CHAT_REFERENCE_REQUIRED');
  const record = source.body;
  if (motionR4) {
    requireValue(record.schemaVersion === 'episode-motion-full-candidate-user-request/v1' &&
      Object.entries(expectedIdentity).every(([key, value]) => record[key] === value) &&
      record.quotedUserMessage === '好的，没问题。然后音效记着都配上就可以了，抓紧导出。然后还有提示词，封面提示词和这个发布包文案，快点。' &&
      record.source?.kind === 'current-chat-human-message-relayed-by-parent-agent' &&
      record.source?.platformMessageId === null && record.source?.platformMessageIdInvented === false &&
      record.requestedOutput === 'full-resolution-sound-enabled-candidate-and-publication-package-for-user-review' &&
      record.sampleAcceptance?.accepted === true && record.sampleAcceptance.scope === '23-second-R3-repaired-viewing-sample-only' &&
      record.sampleAcceptance.video?.sha256 === '66f176248d2fbfc41445fa8eb56451a5d04e0f0d07333e6bea3a6bc8d60d1155' &&
      record.sampleAcceptance.fullEpisodeAcceptanceImplied === false &&
      record.authorizationType === 'local-chat-authorization' && record.isIndependentSignature === false &&
      ['humanAcceptancePerformed', 'fullWatchConfirmed', 'candidateAccepted', 'factsVerified', 'formalAuthorized',
        'publishAuthorized', 'externalUploadAuthorized', 'paymentAuthorized'].every(key => record[key] === false),
    'AGCP_CHAT_SCOPE_INVALID');
    const settings = job.preview?.renderSettings;
    requireValue(job.remotion?.root === 'remotion' &&
      job.remotion.entry === 'src/small-business-ai-agility-r4-final/index.tsx' &&
      job.remotion.publicDir === 'edit/20261017_small_business_ai_agility/05_剪辑工程/public' &&
      job.remotion.compositionWithSfx === 'SmallBusinessAgilityR4Final-WithSfx' &&
      job.remotion.compositionWithoutSfx === 'SmallBusinessAgilityR4Final-NoSfx' &&
      job.remotion.width === 1920 && job.remotion.height === 1080 && job.remotion.fps === 30 &&
      job.remotion.durationSeconds === 4126 / 30 && settings && Object.keys(settings).length === 3 &&
      settings.concurrency === 1 && settings.timeoutInMilliseconds === 120000 && settings.scale === 1 &&
      job.formal?.enabled === false && resolve(projectRoot, job.preview.output ?? '') === resolve(projectRoot,
        'edit/20261017_small_business_ai_agility/09_动效优化正片R4/小公司AI落地_V9_R4_1080p_有音效_受控原件.mp4'),
    'AGCP_R4_FULL_CANDIDATE_REQUIRED');
    return {authorizationSha256: authorization.sha256, sourceMessageSha256: source.sha256,
      authorizationMethod: 'current-chat-verbatim', independentSignature: false};
  }
  if (motionR3) {
    requireValue(record.schemaVersion === 'episode-motion-sample-user-request/v1' &&
      Object.entries(expectedIdentity).every(([key, value]) => record[key] === value) &&
      record.quotedUserMessage === '好的，抓紧开始。' &&
      record.quotedPrecedingProposal === '建议先把24—47秒做成约23秒的修改对照，验证字号、排版和节奏，再应用到整片。' &&
      record.source?.kind === 'current-chat-human-message-relayed-by-parent-agent' &&
      record.source?.platformMessageId === null && record.source?.platformMessageIdInvented === false &&
      record.requestedOutput === '23-second-motion-layout-review-sample' &&
      record.sourceFrameRange?.start === 720 && record.sourceFrameRange?.end === 1409 && record.sourceFps === 30 &&
      record.authorizationType === 'local-chat-authorization' && record.isIndependentSignature === false &&
      ['humanAcceptancePerformed', 'fullWatchConfirmed', 'candidateAccepted', 'factsVerified', 'formalAuthorized',
        'publishAuthorized', 'externalUploadAuthorized', 'paymentAuthorized'].every(key => record[key] === false),
    'AGCP_CHAT_SCOPE_INVALID');
    const settings = job.preview?.renderSettings;
    requireValue(job.remotion?.root === 'remotion' &&
      job.remotion.entry === 'src/small-business-ai-agility-r3-sample/index.tsx' &&
      job.remotion.publicDir === 'edit/20261017_small_business_ai_agility/05_剪辑工程/public' &&
      job.remotion.compositionWithSfx === 'SmallBusinessAgilityR3Sample-WithSfx' &&
      job.remotion.compositionWithoutSfx === 'SmallBusinessAgilityR3Sample-NoSfx' &&
      job.remotion.width === 1920 && job.remotion.height === 1080 && job.remotion.fps === 30 &&
      job.remotion.durationSeconds === 4126 / 30 &&
      settings?.concurrency === 1 && settings.timeoutInMilliseconds === 120000 && settings.scale === 1 &&
      settings.frames?.start === 720 && settings.frames?.end === 1409 &&
      job.formal?.enabled === false &&
      ['小公司AI_24-47秒_动效优化R3_1080p_有音效.mp4',
        '小公司AI_24-47秒_动效优化R3_1080p_有音效_修订1.mp4'].some(name =>
        resolve(projectRoot, job.preview.output ?? '') === resolve(projectRoot,
          'edit/20261017_small_business_ai_agility/08_动效优化小样R3', name)),
    'AGCP_R3_SAMPLE_RANGE_REQUIRED');
    return {authorizationSha256: authorization.sha256, sourceMessageSha256: source.sha256,
      authorizationMethod: 'current-chat-verbatim', independentSignature: false};
  }
  if (videoR2) {
    requireValue(record.schemaVersion === 'episode-video-candidate-user-request/v1' &&
      Object.entries(expectedIdentity).every(([key, value]) => record[key] === value) &&
      record.quotedUserMessage === '好了，这个已经做好了，赶紧抓紧去剪成片' &&
      record.source?.kind === 'current-chat-human-message-relayed-by-parent-agent' &&
      record.source?.platformMessageId === null && record.source?.platformMessageIdInvented === false &&
      record.requestedOutput === 'full-resolution-candidate-for-user-review' &&
      record.authorizationType === 'local-chat-authorization' && record.isIndependentSignature === false &&
      record.userProvidedPaperVideo?.sha256 === 'd4a4a213bcad26e7708ac7dbd7028dca37162c94773228cd9b0a10e57b1ad03a' &&
      ['humanAcceptancePerformed', 'fullWatchConfirmed', 'candidateAccepted', 'factsVerified', 'formalAuthorized',
        'publishAuthorized', 'externalUploadAuthorized', 'paymentAuthorized'].every(key => record[key] === false),
    'AGCP_CHAT_SCOPE_INVALID');
    const intake = readBoundJson(projectRoot, input.artifacts?.mediaIntake, '本期R2纸艺到件来源');
    const papers = intake.body.assets?.filter(item => item.kind === 'paper') ?? [];
    requireValue(papers.length === 1 && papers[0].source?.sha256 === record.userProvidedPaperVideo.sha256 &&
      papers[0].media?.type === 'video', 'AGCP_R2_PAPER_SOURCE_REQUIRED');
    return {authorizationSha256: authorization.sha256, sourceMessageSha256: source.sha256,
      authorizationMethod: 'current-chat-verbatim', independentSignature: false};
  }
  requireValue(record.schemaVersion === 'episode-local-chat-source-record/v1' &&
    Object.entries(identity).every(([key, value]) => record[key] === value) &&
    record.question === question && record.userReply === answer &&
    record.source?.kind === 'current-chat-human-reply' && record.source?.transport === 'request_user_input_async' &&
    record.source?.platformMessageId === null && record.source?.platformMessageIdInvented === false &&
    record.authorizationType === 'local-chat-authorization' && record.isIndependentSignature === false &&
    ['humanAcceptancePerformed', 'fullWatchConfirmed', 'candidateAccepted', 'formalAuthorized', 'publishAuthorized',
      'externalUploadAuthorized', 'paymentAuthorized'].every(key => record[key] === false), 'AGCP_CHAT_SCOPE_INVALID');
  return {authorizationSha256: authorization.sha256, sourceMessageSha256: source.sha256,
    authorizationMethod: 'current-chat-verbatim', independentSignature: false};
}
