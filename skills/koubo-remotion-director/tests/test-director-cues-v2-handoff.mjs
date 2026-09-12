import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildDirectorCuesV2Handoff,
  finalizeDirectorCuesV2HandoffDirectory,
  validateDirectorCuesV2HandoffDocuments,
  validateDirectorCuesV2HandoffDirectory,
} from '../scripts/director-cues-v2-handoff-core.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'director-cues-v2-handoff-'));
const digest = (value) => createHash('sha256').update(value).digest('hex');
const writeJson = (filePath, value) => writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const referenceBytes = Buffer.alloc(24);
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(referenceBytes, 0);
Buffer.from('IHDR').copy(referenceBytes, 12);
referenceBytes.writeUInt32BE(1920, 16);
referenceBytes.writeUInt32BE(1080, 20);
writeFileSync(path.join(root, 'paper-reference.png'), referenceBytes);

const aiPrefix = '写实编辑部纪实风格，暖中性自然光，真实工作空间，深蓝与暖白色调，横版构图。';
const paperPrefix = '摄影级微缩纸艺定格，暖米色实体桌面，纤维卡纸与瓦楞纸形成三层空间，真实接触阴影，横版构图。';
const mixedScript = '官方文件显示真实数据。普通店主在桌前查看结果。这个机制把输入压成结果。';
writeFileSync(path.join(root, 'script.txt'), mixedScript);

const mixedCues = {
  schemaVersion: 'koubo-director-cues/v2',
  taskId: 'handoff-mixed-task',
  status: 'ready-for-user-review',
  executionScope: 'director-only',
  handoffGate: {status: 'blocked-awaiting-user-approval', downstreamAllowed: false},
  inputScript: {path: 'script.txt', sha256: digest(Buffer.from(mixedScript)), authority: 'user-confirmed-script'},
  routingPolicy: {
    selectionBasis: 'semantic-need-not-fixed-cadence', speakerIsFallback: true,
    generatedInsertMinimum: 0, paperInsertMinimum: 0, fixedCadenceForbidden: true,
    generatedVisualCannotServeAsEvidence: true, shotcraftSelectionStage: 'post-shoot-edit-release',
    shotcraftEligibleRoutes: ['speaker', 'real-evidence'],
    shotcraftForbiddenInsideRoutes: ['paper-editorial', 'ai-generated-video'],
  },
  styleLocks: {
    aiGeneratedVideo: {
      referenceImages: [], promptPrefix: aiPrefix,
      mustKeep: ['纪实摄影', '真实空间', '暖中性光'],
      mustAvoid: ['伪造证据', '真实品牌复刻', '模型可读文字'],
    },
    paperEditorial: {
      referenceImages: [{id: 'REF01', path: 'paper-reference.png', sha256: digest(referenceBytes), usage: 'style-mechanism-only'}],
      promptPrefix: paperPrefix,
      textPolicy: 'generated-base-image-then-deterministic-chinese',
      mustKeep: ['真实纸纤维', '三层空间', '接触阴影'],
      mustAvoid: ['PPT卡片', '塑料质感', '模型生成文字'],
    },
  },
  selectionSummary: {
    mainPoint: '不同语义只使用能增加理解的画面。',
    argumentFlow: ['真实材料证明', '通用情景具体化', '纸艺解释机制'],
    routeCounts: {speaker: 0, 'real-evidence': 1, 'ai-generated-video': 1, 'paper-editorial': 1, shotcraftOpportunity: 1},
    routeRationales: {
      speaker: '这份测试输入的三个句子都有更明确的画面任务。',
      'real-evidence': '数据必须由真实材料支撑。',
      'ai-generated-video': '通用店主场景用演绎增加具体性。',
      'paper-editorial': '抽象压缩机制用物理隐喻解释。',
    },
    visualRhythmReason: '三段分别承担证明、情景和机制，不按秒数凑镜头。',
    protectedSpeakerBeatIds: [],
  },
  semanticBeats: [
    {id: 'B01', order: 1, scriptQuote: '官方文件显示真实数据。', rhetoricalRole: 'evidence', claimClass: 'factual-claim', requiresRealEvidence: true, primaryRoute: 'real-evidence', routeCueId: 'R01', decisionReason: '必须展示可核验来源。', viewerGain: 'proof'},
    {id: 'B02', order: 2, scriptQuote: '普通店主在桌前查看结果。', rhetoricalRole: 'generic-scene', claimClass: 'generic-illustration', requiresRealEvidence: false, primaryRoute: 'ai-generated-video', routeCueId: 'G01', decisionReason: '没有特定真实主体，情景演绎可增加具体性。', viewerGain: 'make-scene-concrete'},
    {id: 'B03', order: 3, scriptQuote: '这个机制把输入压成结果。', rhetoricalRole: 'mechanism', claimClass: 'abstract-explanation', requiresRealEvidence: false, primaryRoute: 'paper-editorial', routeCueId: 'P01', decisionReason: '抽象机制需要可见隐喻。', viewerGain: 'explain-mechanism'},
  ],
  routePlans: {
    realMaterials: {status: 'planned', notRequiredReason: null, items: [{
      id: 'R01', beatId: 'B01', startAnchorText: '官方文件', endAnchorText: '真实数据', timingStatus: 'pre-shoot-text-anchor-only',
      assetType: 'official-document', usageRole: 'evidence', materialRequest: '带来源标识的官方文件截图。', reason: '让观众看到原文。',
      evidenceStatus: 'candidate-unbound', usableInProduction: false, sourceBinding: null,
      fallbackIfUnavailable: 'remove-or-rewrite-claim', generatedSubstituteAllowed: false,
    }]},
    aiGeneratedVideos: {status: 'planned', notRequiredReason: null, items: [{
      id: 'G01', beatId: 'B02', startAnchorText: '普通店主', endAnchorText: '查看结果', timingStatus: 'pre-shoot-text-anchor-only',
      purpose: 'illustration-only', representationPolicy: 'synthetic-not-evidence', evidenceEligible: false,
      disclosureRequired: true, realEntityReenactmentForbidden: true, mode: 'image-to-video', durationSeconds: 4,
      visualIntent: '让通用工作场景具体可见。', primaryAction: '店主低头查看桌上结果页',
      firstFramePrompt: `${aiPrefix}中景固定机位，一位无品牌特征的成年店主坐在普通木桌前，桌上放着没有可读文字的结果页和常见文具，人物双手停在纸页两侧，背景货架轻微虚化，不出现真实公司、标志、官方界面或特定产品。`,
      videoPrompt: '基于已确认首帧，店主低头查看桌上结果页，视线缓慢从页面左侧移到右侧，固定机位，结尾停在专注阅读状态，不新增人物、标志或文字。',
      negativePrompt: ['不生成可读文字', '不复刻真实品牌', '不把演绎画面伪装成证据'],
    }]},
    paperEditorials: {status: 'planned', notRequiredReason: null, items: [{
      id: 'P01', beatId: 'B03', startAnchorText: '这个机制', endAnchorText: '压成结果', timingStatus: 'pre-shoot-text-anchor-only',
      durationSeconds: 4, reason: '让输入到结果的压缩关系可见。', visualRole: 'mechanism',
      visualMetaphor: '长纸带经过窄门成为短纸束', composition: '侧视单向压缩工作台',
      primaryAction: '长纸带穿过窄门停在托盘',
      textPlan: [{text: '输入端', surface: '前景纸牌甲'}, {text: '结果端', surface: '后景纸牌乙'}],
      referenceImageIds: ['REF01'],
      firstFramePrompt: `${paperPrefix}侧视中景，前景是一条平放的长纸带，中景是一座有清晰瓦楞层的窄门，后景是空托盘；前景纸牌甲与后景纸牌乙各自由独立支架固定，不遮挡主体，所有物件保持静止，画面没有可读文字。`,
      videoPrompt: '基于已确认首帧，长纸带穿过窄门停在托盘，经过门框的纸带成为整齐短纸束，固定机位，两块固定纸牌与其他物件保持不动，不生成文字。',
      negativePrompt: ['不生成可读文字', '不重做场景', '不使用PPT卡片'],
    }]},
  },
  shotcraftOpportunities: [{
    id: 'SO01', beatId: 'B01', baseVisualRoute: 'real-evidence', intent: 'evidence-focus',
    reason: '拍后可聚焦文件原文，具体卡片到剪辑阶段再选。',
    status: 'opportunity-only-post-shoot-selection-pending', catalogScope: 'full-current-catalog',
  }],
  rhythmAudit: {basis: 'semantic-runs-not-seconds', fixedCadenceForbidden: true, longSpeakerRunsReviewed: true, runs: []},
};

const profile = {
  schemaVersion: 'koubo-active-director-profile/v1',
  profileVersion: '9.1.1',
  scopeBoundary: {
    directorPlanningOutput: 'koubo-director-cues/v2', appliesAfter: 'user-approved-director-cues',
    appliesToDirectorPlanning: false, userApprovalRequiredBeforeDownstream: true,
  },
  routingPolicy: {
    mainVisualClasses: ['speaker', 'real-evidence', 'generated-video', 'paper-editorial'],
    directorCueRouteMap: {
      speaker: 'speaker', 'real-evidence': 'real-evidence',
      'ai-generated-video': 'generated-video', 'paper-editorial': 'paper-editorial',
    },
  },
};

writeJson(path.join(root, 'cues.json'), mixedCues);
mkdirSync(path.join(root, 'workflow'));
writeJson(path.join(root, 'workflow', 'active-director-profile.v1.json'), profile);
const cuesHash = digest(readFileSync(path.join(root, 'cues.json')));
const approval = {
  schemaVersion: 'koubo-director-cues-user-approval/v2', status: 'approved',
  taskId: mixedCues.taskId, revisionId: 'r1',
  bindings: {directorCues: {path: 'cues.json', sha256: cuesHash}},
  approved: true, userQuote: '我确认这份完整导演表，可以建立本地交接包。',
  approvedAt: '2026-09-12T12:00:00+08:00', exceptions: [],
};
writeJson(path.join(root, 'approval.json'), approval);

const built = buildDirectorCuesV2Handoff({
  projectRoot: root, cues: 'cues.json', approval: 'approval.json', profile: 'workflow/active-director-profile.v1.json', outputDir: 'handoff-r1',
});
assert.equal(built.ok, true);
const master = readJson(built.masterPath);
const mapping = Object.fromEntries(master.routeMappings.map((item) => [item.sourceRoute, item.downstreamRoute]));
assert.equal(mapping['ai-generated-video'], 'generated-video');
assert.equal(master.branches.realEvidence.status, 'planned');
assert.equal(master.externalActionsAuthorized, false);
for (const artifact of Object.values(master.artifacts)) {
  const artifactPath = path.join(root, artifact.path);
  assert.equal(existsSync(artifactPath), true);
  assert.equal(digest(readFileSync(artifactPath)), artifact.sha256);
}
assert.deepEqual(master.branches.realEvidence.manifest, master.artifacts.realEvidence);
assert.deepEqual(master.branches.aiGeneratedVideo.firstFrameManifest, master.artifacts.aiFirstFrame);
assert.deepEqual(master.branches.aiGeneratedVideo.imageToVideoManifest, master.artifacts.aiVideo);
assert.deepEqual(master.branches.paperEditorial.firstFrameManifest, master.artifacts.paperFirstFrame);
assert.deepEqual(master.branches.paperEditorial.imageToVideoManifest, master.artifacts.paperVideo);
assert.equal(digest(readFileSync(built.masterPath)), built.masterSha256);
assert.equal(validateDirectorCuesV2HandoffDirectory({projectRoot: root, outputDir: 'handoff-r1'}).ok, true);
const receipt = readJson(built.receiptPath);
assert.equal(receipt.handoffMaster.sha256, built.masterSha256);
assert.equal(receipt.status, 'validated-local-handoff');

const aiStill = readJson(path.join(root, 'handoff-r1', 'ai-generated-video.first-frame-handoff.v1.json'));
const aiVideo = readJson(path.join(root, 'handoff-r1', 'ai-generated-video.image-to-video-handoff.v1.json'));
const paperStill = readJson(path.join(root, 'handoff-r1', 'paper-editorial.first-frame-handoff.v1.json'));
const paperVideo = readJson(path.join(root, 'handoff-r1', 'paper-editorial.image-to-video-handoff.v1.json'));
assert.equal(aiStill.items[0].prompt, mixedCues.routePlans.aiGeneratedVideos.items[0].firstFramePrompt);
assert.equal(aiVideo.items[0].prompt, mixedCues.routePlans.aiGeneratedVideos.items[0].videoPrompt);
assert.equal(paperStill.items[0].prompt, mixedCues.routePlans.paperEditorials.items[0].firstFramePrompt);
assert.equal(paperVideo.items[0].prompt, mixedCues.routePlans.paperEditorials.items[0].videoPrompt);
assert.equal(Object.hasOwn(aiStill.items[0], 'primaryAction'), false);
assert.equal(aiVideo.items[0].primaryAction, mixedCues.routePlans.aiGeneratedVideos.items[0].primaryAction);
assert.equal(aiStill.items[0].pairSha256, aiVideo.items[0].pairSha256);
assert.equal(paperStill.items[0].pairSha256, paperVideo.items[0].pairSha256);

const real = readJson(path.join(root, 'handoff-r1', 'real-evidence-handoff.v1.json'));
assert.equal(JSON.stringify(real.items).toLowerCase().includes('prompt'), false);
assert.equal(real.items[0].generatedSubstituteAllowed, false);
const shotcraft = readJson(path.join(root, 'handoff-r1', 'shotcraft-opportunities.handoff.v1.json'));
assert.equal(shotcraft.status, 'opportunity-only');
assert.equal(shotcraft.selectionAuthorized, false);
assert.equal(validateDirectorCuesV2HandoffDocuments({realEvidence: real, aiFirstFrame: aiStill, aiVideo, paperFirstFrame: paperStill, paperVideo, shotcraft, master}).ok, true);

const trustedDocuments = {realEvidence: real, aiFirstFrame: aiStill, aiVideo, paperFirstFrame: paperStill, paperVideo, shotcraft, master};
const swappedRoutes = structuredClone(trustedDocuments);
[swappedRoutes.aiFirstFrame, swappedRoutes.paperFirstFrame] = [swappedRoutes.paperFirstFrame, swappedRoutes.aiFirstFrame];
assert.equal(validateDirectorCuesV2HandoffDocuments(swappedRoutes).ok, false);
const falseEmpty = structuredClone(trustedDocuments);
falseEmpty.aiFirstFrame.status = 'not-required';
falseEmpty.aiFirstFrame.notRequiredReason = '伪造为空分路';
assert.equal(validateDirectorCuesV2HandoffDocuments(falseEmpty).ok, false);
const unsafeChild = structuredClone(trustedDocuments);
unsafeChild.paperVideo.externalActionsAuthorized = true;
unsafeChild.paperVideo.generationStarted = true;
assert.equal(validateDirectorCuesV2HandoffDocuments(unsafeChild).ok, false);
const unsafeReal = structuredClone(trustedDocuments);
unsafeReal.realEvidence.promptGenerationAllowed = true;
assert.equal(validateDirectorCuesV2HandoffDocuments(unsafeReal).ok, false);
const fakeArtifacts = structuredClone(trustedDocuments);
fakeArtifacts.master.artifacts.aiVideo.sha256 = '0'.repeat(64);
assert.equal(validateDirectorCuesV2HandoffDocuments(fakeArtifacts).ok, false);

assert.throws(() => buildDirectorCuesV2Handoff({
  projectRoot: root, cues: 'cues.json', approval: 'approval.json', profile: 'workflow/active-director-profile.v1.json', outputDir: 'handoff-r1',
}), /OUTPUT_ALREADY_EXISTS/);

const unapproved = {...approval, approved: false, status: 'pending'};
writeJson(path.join(root, 'approval-pending.json'), unapproved);
assert.throws(() => buildDirectorCuesV2Handoff({
  projectRoot: root, cues: 'cues.json', approval: 'approval-pending.json', profile: 'workflow/active-director-profile.v1.json', outputDir: 'handoff-pending',
}), /APPROVAL_NOT_APPROVED/);
assert.equal(existsSync(path.join(root, 'handoff-pending')), false);

const wrongSha = structuredClone(approval);
wrongSha.bindings.directorCues.sha256 = '0'.repeat(64);
writeJson(path.join(root, 'approval-wrong-sha.json'), wrongSha);
assert.throws(() => buildDirectorCuesV2Handoff({
  projectRoot: root, cues: 'cues.json', approval: 'approval-wrong-sha.json', profile: 'workflow/active-director-profile.v1.json', outputDir: 'handoff-wrong-sha',
}), /APPROVAL_CUES_SHA_MISMATCH/);
assert.equal(existsSync(path.join(root, 'handoff-wrong-sha')), false);

writeJson(path.join(root, 'profile-copy.json'), profile);
assert.throws(() => buildDirectorCuesV2Handoff({
  projectRoot: root, cues: 'cues.json', approval: 'approval.json', profile: 'profile-copy.json', outputDir: 'handoff-fake-profile',
}), /ACTIVE_PROFILE_PATH_INVALID/);
assert.equal(existsSync(path.join(root, 'handoff-fake-profile')), false);

const speakerScript = '这两句由我面对观众说。这里保留我的判断。';
writeFileSync(path.join(root, 'speaker-script.txt'), speakerScript);
const speakerCues = structuredClone(mixedCues);
speakerCues.taskId = 'handoff-speaker-task';
speakerCues.inputScript = {path: 'speaker-script.txt', sha256: digest(Buffer.from(speakerScript)), authority: 'user-confirmed-script'};
speakerCues.styleLocks = {aiGeneratedVideo: null, paperEditorial: null};
speakerCues.selectionSummary.routeCounts = {speaker: 2, 'real-evidence': 0, 'ai-generated-video': 0, 'paper-editorial': 0, shotcraftOpportunity: 0};
speakerCues.selectionSummary.routeRationales = {
  speaker: '两句都需要本人表情和语气。', 'real-evidence': '没有外部对象需要证明。',
  'ai-generated-video': '通用情景不会增加理解。', 'paper-editorial': '没有机制需要物理隐喻。',
};
speakerCues.selectionSummary.protectedSpeakerBeatIds = ['B01', 'B02'];
speakerCues.semanticBeats = [
  {id: 'B01', order: 1, scriptQuote: '这两句由我面对观众说。', rhetoricalRole: 'judgment', claimClass: 'presenter-expression', requiresRealEvidence: false, primaryRoute: 'speaker', routeCueId: null, decisionReason: '本人表情和语气有信息。', viewerGain: 'presenter-trust'},
  {id: 'B02', order: 2, scriptQuote: '这里保留我的判断。', rhetoricalRole: 'boundary', claimClass: 'presenter-expression', requiresRealEvidence: false, primaryRoute: 'speaker', routeCueId: null, decisionReason: '判断应由本人承接。', viewerGain: 'presenter-trust'},
];
speakerCues.routePlans = {
  realMaterials: {status: 'not-required', notRequiredReason: '全文没有需要证明或演示的真实对象。', items: []},
  aiGeneratedVideos: {status: 'not-required', notRequiredReason: 'AI 情景不会增加具体性。', items: []},
  paperEditorials: {status: 'not-required', notRequiredReason: '全文没有抽象机制需要解释。', items: []},
};
speakerCues.shotcraftOpportunities = [];
speakerCues.rhythmAudit.runs = [{
  fromBeatId: 'B01', toBeatId: 'B02', risk: 'low', decision: 'keep-presenter',
  reason: '连续两句很短且需要本人判断。', mitigationRefs: [],
}];
writeJson(path.join(root, 'speaker-cues.json'), speakerCues);
const speakerApproval = {
  ...approval,
  taskId: speakerCues.taskId,
  revisionId: 'r2',
  bindings: {directorCues: {path: 'speaker-cues.json', sha256: digest(readFileSync(path.join(root, 'speaker-cues.json')))}},
};
writeJson(path.join(root, 'speaker-approval.json'), speakerApproval);
buildDirectorCuesV2Handoff({
  projectRoot: root, cues: 'speaker-cues.json', approval: 'speaker-approval.json', profile: 'workflow/active-director-profile.v1.json', outputDir: 'handoff-speaker',
});
for (const fileName of [
  'ai-generated-video.first-frame-handoff.v1.json',
  'ai-generated-video.image-to-video-handoff.v1.json',
  'paper-editorial.first-frame-handoff.v1.json',
  'paper-editorial.image-to-video-handoff.v1.json',
]) {
  const manifest = readJson(path.join(root, 'handoff-speaker', fileName));
  assert.equal(manifest.status, 'not-required');
  assert.equal(manifest.itemCount, 0);
  assert.deepEqual(manifest.items, []);
  assert.equal(manifest.generationStarted, false);
}

const outsideText = readFileSync('/etc/hosts', 'utf8');
const outsideCues = structuredClone(speakerCues);
outsideCues.taskId = 'handoff-outside-task';
outsideCues.inputScript = {path: '/etc/hosts', sha256: digest(Buffer.from(outsideText)), authority: 'user-confirmed-script'};
outsideCues.selectionSummary.routeCounts.speaker = 1;
outsideCues.selectionSummary.protectedSpeakerBeatIds = ['B01'];
outsideCues.semanticBeats = [{
  id: 'B01', order: 1, scriptQuote: outsideText, rhetoricalRole: 'judgment', claimClass: 'presenter-expression',
  requiresRealEvidence: false, primaryRoute: 'speaker', routeCueId: null,
  decisionReason: '仅用于验证项目外路径会被交接门拒绝。', viewerGain: 'presenter-trust',
}];
outsideCues.rhythmAudit.runs = [{
  fromBeatId: 'B01', toBeatId: 'B01', risk: 'low', decision: 'keep-presenter',
  reason: '仅用于路径门测试。', mitigationRefs: [],
}];
writeJson(path.join(root, 'outside-cues.json'), outsideCues);
const outsideApproval = {
  ...approval,
  taskId: outsideCues.taskId,
  revisionId: 'r3',
  bindings: {directorCues: {path: 'outside-cues.json', sha256: digest(readFileSync(path.join(root, 'outside-cues.json')))}},
};
writeJson(path.join(root, 'outside-approval.json'), outsideApproval);
assert.throws(() => buildDirectorCuesV2Handoff({
  projectRoot: root,
  cues: 'outside-cues.json',
  approval: 'outside-approval.json',
  profile: 'workflow/active-director-profile.v1.json',
  outputDir: 'handoff-outside',
}), /DIRECTOR_V2_(?:HANDOFF_SCRIPT_OUTSIDE_PROJECT|HANDOFF_CUES_INVALID:DIRECTOR_V2_SCRIPT_FILE_MISSING)/);
assert.equal(existsSync(path.join(root, 'handoff-outside')), false);

const tamperedAiVideoPath = path.join(root, 'handoff-r1', 'ai-generated-video.image-to-video-handoff.v1.json');
const tamperedAiVideo = readJson(tamperedAiVideoPath);
tamperedAiVideo.externalActionsAuthorized = true;
writeJson(tamperedAiVideoPath, tamperedAiVideo);
const tamperedDiskResult = validateDirectorCuesV2HandoffDirectory({projectRoot: root, outputDir: 'handoff-r1'});
assert.equal(tamperedDiskResult.ok, false);
assert(tamperedDiskResult.errors.some((error) => error.includes('SHA_MISMATCH')));

const forcedTemporaryDir = path.join(root, '.forced-final-validation.tmp');
const forcedOutputDir = path.join(root, 'forced-final-validation');
mkdirSync(forcedTemporaryDir);
writeFileSync(path.join(forcedTemporaryDir, 'complete-package-marker.txt'), '完整但强制复验失败');
assert.throws(() => finalizeDirectorCuesV2HandoffDirectory({
  temporaryDir: forcedTemporaryDir,
  outputDir: forcedOutputDir,
  validateFinal: () => ({ok: false, errors: ['FORCED_FINAL_VALIDATION_FAILURE']}),
}), /FORCED_FINAL_VALIDATION_FAILURE:QUARANTINED_AT=/);
assert.equal(existsSync(forcedOutputDir), false);
const quarantineNames = readdirSync(root).filter((name) => name.startsWith('.forced-final-validation.invalid-'));
assert.equal(quarantineNames.length, 1);
assert.equal(
  readFileSync(path.join(root, quarantineNames[0], 'complete-package-marker.txt'), 'utf8'),
  '完整但强制复验失败',
);

console.log('test-director-cues-v2-handoff: ok');
