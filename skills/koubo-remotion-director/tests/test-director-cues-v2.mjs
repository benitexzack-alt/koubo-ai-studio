import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDirectorCuesV2} from '../scripts/director-cues-v2-core.mjs';

const template = JSON.parse(readFileSync(new URL('../templates/director-cues.v2.json', import.meta.url), 'utf8'));
assert.equal(template.schemaVersion, 'koubo-director-cues/v2');
assert.equal(template.routingPolicy.generatedInsertMinimum, 0);
assert.equal(template.routingPolicy.paperInsertMinimum, 0);
assert.equal(template.routingPolicy.fixedCadenceForbidden, true);
assert.deepEqual(template.routingPolicy.shotcraftEligibleRoutes, ['speaker', 'real-evidence']);
assert.equal(template.styleLocks.aiGeneratedVideo, null);
assert.equal(template.styleLocks.paperEditorial, null);
assert.equal(template.routePlans.realMaterials.status, 'not-required');
assert.equal(template.routePlans.aiGeneratedVideos.status, 'not-required');
assert.equal(template.routePlans.paperEditorials.status, 'not-required');
assert.equal(template.shotcraftOpportunities.length, 0);

const root = mkdtempSync(path.join(os.tmpdir(), 'director-cues-v2-test-'));
const referenceSource = fileURLToPath(new URL('../../../refs/director-style/往期优质纸艺参考_工厂工具.png', import.meta.url));
const referenceBytes = readFileSync(referenceSource);
const referencePath = path.join(root, 'reference.png');
writeFileSync(referencePath, referenceBytes);
const hash = (value) => createHash('sha256').update(value).digest('hex');

const scriptText = '开场判断由我面对观众说。官方文件展示真实数据。一位普通店主在桌前查看结果。这个机制把输入压缩成结果。';
const aiPrefix = '写实编辑部纪实风格，暖中性自然光，真实办公空间，深蓝与暖白色调，16:9。';
const paperPrefix = '摄影级微缩纸艺定格，暖米色实体桌面，纤维卡纸、三层空间、真实接触阴影与柔和侧光，16:9。';

const mixed = {
  schemaVersion: 'koubo-director-cues/v2',
  taskId: 'director-v2-mixed',
  status: 'ready-for-user-review',
  executionScope: 'director-only',
  handoffGate: {status: 'blocked-awaiting-user-approval', downstreamAllowed: false},
  inputScript: {authority: 'user-confirmed-script'},
  routingPolicy: {
    selectionBasis: 'semantic-need-not-fixed-cadence',
    speakerIsFallback: true,
    generatedInsertMinimum: 0,
    paperInsertMinimum: 0,
    fixedCadenceForbidden: true,
    generatedVisualCannotServeAsEvidence: true,
    shotcraftSelectionStage: 'post-shoot-edit-release',
    shotcraftEligibleRoutes: ['speaker', 'real-evidence'],
    shotcraftForbiddenInsideRoutes: ['paper-editorial', 'ai-generated-video'],
  },
  styleLocks: {
    aiGeneratedVideo: {
      referenceImages: [],
      promptPrefix: aiPrefix,
      mustKeep: ['纪实摄影', '真实空间', '暖中性光'],
      mustAvoid: ['伪造证据', '真实品牌复刻', '模型可读文字'],
    },
    paperEditorial: {
      referenceImages: [{
        id: 'REF01', path: referencePath, sha256: hash(referenceBytes), usage: 'style-mechanism-only',
      }],
      promptPrefix: paperPrefix,
      textPolicy: 'generated-base-image-then-deterministic-chinese',
      mustKeep: ['真实纸纤维', '三层空间', '接触阴影'],
      mustAvoid: ['PPT卡片', '塑料3D', '模型生成文字'],
    },
  },
  selectionSummary: {
    mainPoint: '四种画面只在能带来明确新理解时使用。',
    argumentFlow: ['真人建立判断', '真实材料证明', '情景具体化', '纸艺解释机制'],
    routeCounts: {
      speaker: 1, 'real-evidence': 1, 'ai-generated-video': 1, 'paper-editorial': 1, shotcraftOpportunity: 1,
    },
    routeRationales: {
      speaker: '开场判断由本人建立信任。',
      'real-evidence': '数据只能由真实材料支撑。',
      'ai-generated-video': '通用店主场景可以用明确演绎具体化。',
      'paper-editorial': '抽象机制需要物理隐喻。',
    },
    visualRhythmReason: '四段分别承担信任、证明、情境和机制，不按秒数凑镜头。',
    protectedSpeakerBeatIds: ['B01'],
  },
  semanticBeats: [
    {id: 'B01', order: 1, scriptQuote: '开场判断由我面对观众说。', rhetoricalRole: 'hook', claimClass: 'presenter-expression', requiresRealEvidence: false, primaryRoute: 'speaker', routeCueId: null, decisionReason: '面部和语气是这句的主要信息。', viewerGain: 'presenter-trust'},
    {id: 'B02', order: 2, scriptQuote: '官方文件展示真实数据。', rhetoricalRole: 'evidence', claimClass: 'factual-claim', requiresRealEvidence: true, primaryRoute: 'real-evidence', routeCueId: 'R01', decisionReason: '该句要求可核验材料。', viewerGain: 'proof'},
    {id: 'B03', order: 3, scriptQuote: '一位普通店主在桌前查看结果。', rhetoricalRole: 'generic-scene', claimClass: 'generic-illustration', requiresRealEvidence: false, primaryRoute: 'ai-generated-video', routeCueId: 'G01', decisionReason: '这是无特定主体的通用情景。', viewerGain: 'make-scene-concrete'},
    {id: 'B04', order: 4, scriptQuote: '这个机制把输入压缩成结果。', rhetoricalRole: 'mechanism', claimClass: 'abstract-explanation', requiresRealEvidence: false, primaryRoute: 'paper-editorial', routeCueId: 'P01', decisionReason: '抽象变化需要可见物理隐喻。', viewerGain: 'explain-mechanism'},
  ],
  routePlans: {
    realMaterials: {
      status: 'planned', notRequiredReason: null, items: [{
        id: 'R01', beatId: 'B02', startAnchorText: '官方文件', endAnchorText: '真实数据', timingStatus: 'pre-shoot-text-anchor-only',
        assetType: 'official-document', usageRole: 'evidence', materialRequest: '带来源标识的官方文件截图。', reason: '让观众看到数据原文。',
        evidenceStatus: 'candidate-unbound', usableInProduction: false, sourceBinding: null,
        fallbackIfUnavailable: 'remove-or-rewrite-claim', generatedSubstituteAllowed: false,
      }],
    },
    aiGeneratedVideos: {
      status: 'planned', notRequiredReason: null, items: [{
        id: 'G01', beatId: 'B03', startAnchorText: '一位普通店主', endAnchorText: '查看结果', timingStatus: 'pre-shoot-text-anchor-only',
        purpose: 'illustration-only', representationPolicy: 'synthetic-not-evidence', evidenceEligible: false,
        disclosureRequired: true, realEntityReenactmentForbidden: true, mode: 'image-to-video', durationSeconds: 5,
        visualIntent: '让通用工作场景变得具体。', primaryAction: '店主低头查看桌上结果页',
        firstFramePrompt: `${aiPrefix}中景固定机位，一位无品牌特征的成年店主坐在真实工作桌前，桌上是无可读文字的结果页和普通文具，人物双手停在纸页两侧，背景有模糊货架，不出现真实公司、标志或官方界面。`,
        videoPrompt: '基于已确认首帧，店主低头查看桌上结果页，眼神从页面左侧移到右侧，机位保持稳定，结尾停在专注阅读状态，不新增人物、标志或文字。',
        negativePrompt: ['不生成可读文字', '不复刻真实公司或真实人物', '不把演绎画面伪装成证据'],
      }],
    },
    paperEditorials: {
      status: 'planned', notRequiredReason: null, items: [{
        id: 'P01', beatId: 'B04', startAnchorText: '这个机制', endAnchorText: '压缩成结果', timingStatus: 'pre-shoot-text-anchor-only', durationSeconds: 4,
        reason: '让输入到结果的压缩过程可见。', visualRole: 'mechanism',
        visualMetaphor: '长纸带经过压缩门成为短纸束', composition: '侧视单向压缩台', primaryAction: '长纸带穿过压缩门停在托盘',
        textPlan: [{text: '输入', surface: '前景固定空白纸牌'}, {text: '结果', surface: '后景固定空白纸牌'}],
        referenceImageIds: ['REF01'],
        firstFramePrompt: `${paperPrefix}侧视中景，前景是一条平放的长纸带，中景是有可见瓦楞层的纸质压缩门，后景是空托盘；前景固定空白纸牌与后景固定空白纸牌分别由独立支架固定，不遮挡主体，所有物件保持静止，画面不含可读文字。`,
        videoPrompt: '基于已确认首帧，长纸带穿过压缩门停在托盘，纸带经过门框后形成整齐短纸束，固定机位，两块空白纸牌与其他物件保持不动，不生成文字。',
        negativePrompt: ['不生成可读文字', '不重做场景', '不使用PPT卡片'],
      }],
    },
  },
  shotcraftOpportunities: [{
    id: 'SO01', beatId: 'B02', baseVisualRoute: 'real-evidence', intent: 'evidence-focus',
    reason: '后期可引导视线看到原文中的数据，实际卡片拍后再选。',
    status: 'opportunity-only-post-shoot-selection-pending', catalogScope: 'full-current-catalog',
  }],
  rhythmAudit: {basis: 'semantic-runs-not-seconds', fixedCadenceForbidden: true, longSpeakerRunsReviewed: true, runs: [{
    fromBeatId: 'B01', toBeatId: 'B01', risk: 'low', decision: 'keep-presenter',
    reason: '开场只有一句核心判断，真人直说更有信任感。', mitigationRefs: [],
  }]},
};

const validate = (value, source = scriptText) => validateDirectorCuesV2({cues: value, projectRoot: root, scriptText: source});
assert.equal(validate(mixed).ok, true, validate(mixed).errors.join('\n'));

const allSpeakerScript = '这是我的判断。这是我的边界。';
const allSpeaker = structuredClone(mixed);
allSpeaker.taskId = 'director-v2-all-speaker';
allSpeaker.styleLocks = {aiGeneratedVideo: null, paperEditorial: null};
allSpeaker.selectionSummary.routeCounts = {speaker: 2, 'real-evidence': 0, 'ai-generated-video': 0, 'paper-editorial': 0, shotcraftOpportunity: 0};
allSpeaker.selectionSummary.routeRationales['real-evidence'] = '全文没有需要展示或证明的外部对象。';
allSpeaker.selectionSummary.routeRationales['ai-generated-video'] = '情景演绎不会增加理解。';
allSpeaker.selectionSummary.routeRationales['paper-editorial'] = '全文没有需要可视化的机制。';
allSpeaker.selectionSummary.protectedSpeakerBeatIds = ['B01', 'B02'];
allSpeaker.semanticBeats = [
  {id: 'B01', order: 1, scriptQuote: '这是我的判断。', rhetoricalRole: 'judgment', claimClass: 'presenter-expression', requiresRealEvidence: false, primaryRoute: 'speaker', routeCueId: null, decisionReason: '本人判断由真人承接。', viewerGain: 'presenter-trust'},
  {id: 'B02', order: 2, scriptQuote: '这是我的边界。', rhetoricalRole: 'boundary', claimClass: 'presenter-expression', requiresRealEvidence: false, primaryRoute: 'speaker', routeCueId: null, decisionReason: '风险边界需要真人语气。', viewerGain: 'presenter-trust'},
];
allSpeaker.routePlans = {
  realMaterials: {status: 'not-required', notRequiredReason: '没有需要外部证据或演示的句子。', items: []},
  aiGeneratedVideos: {status: 'not-required', notRequiredReason: '生成情景不会增加理解。', items: []},
  paperEditorials: {status: 'not-required', notRequiredReason: '没有机制、流程或关系要解释。', items: []},
};
allSpeaker.shotcraftOpportunities = [];
allSpeaker.rhythmAudit.runs = [{
  fromBeatId: 'B01', toBeatId: 'B02', risk: 'low', decision: 'keep-presenter',
  reason: '两句都是本人立场，表演比换画面更重要。', mitigationRefs: [],
}];
assert.equal(validate(allSpeaker, allSpeakerScript).ok, true, validate(allSpeaker, allSpeakerScript).errors.join('\n'));

const speakerZero = structuredClone(mixed);
const speakerZeroScript = '官方文件展示真实数据。一位普通店主在桌前查看结果。这个机制把输入压缩成结果。';
speakerZero.taskId = 'director-v2-speaker-zero';
speakerZero.semanticBeats = speakerZero.semanticBeats.slice(1).map((beat, index) => ({
  ...beat,
  order: index + 1,
}));
speakerZero.selectionSummary.routeCounts.speaker = 0;
speakerZero.selectionSummary.protectedSpeakerBeatIds = [];
speakerZero.selectionSummary.routeRationales.speaker = '这份测试稿的三段都有更明确的非真人画面收益。';
speakerZero.rhythmAudit.runs = [];
assert.equal(
  validate(speakerZero, speakerZeroScript).ok,
  true,
  validate(speakerZero, speakerZeroScript).errors.join('\n'),
);

const fixedCadence = structuredClone(mixed);
fixedCadence.routingPolicy.targetCadenceSeconds = 5;
assert(validate(fixedCadence).errors.some((error) => error.includes('MECHANICAL_POLICY_FORBIDDEN')));

const aiAsEvidence = structuredClone(mixed);
aiAsEvidence.routePlans.aiGeneratedVideos.items[0].evidenceEligible = true;
assert(validate(aiAsEvidence).errors.some((error) => error.includes('AI_EVIDENCE_ROLE_INVALID')));

const factualClaimRoutedToAi = structuredClone(mixed);
factualClaimRoutedToAi.semanticBeats[2].claimClass = 'factual-claim';
factualClaimRoutedToAi.semanticBeats[2].requiresRealEvidence = true;
assert(validate(factualClaimRoutedToAi).errors.some((error) => error.includes('AI_BEAT_CLASS_INVALID')));

const factualClaimDisguisedAsSpeaker = structuredClone(mixed);
factualClaimDisguisedAsSpeaker.semanticBeats[0].claimClass = 'factual-claim';
assert(validate(factualClaimDisguisedAsSpeaker).errors.some((error) => error.includes('FACTUAL_EVIDENCE_REQUIRED')));

const evidenceFlaggedButKeptAsSpeaker = structuredClone(mixed);
evidenceFlaggedButKeptAsSpeaker.semanticBeats[0].requiresRealEvidence = true;
assert(validate(evidenceFlaggedButKeptAsSpeaker).errors.some((error) => error.includes('EVIDENCE_ROUTE_REQUIRED')));

const fakeBoundReal = structuredClone(mixed);
fakeBoundReal.routePlans.realMaterials.items[0].usableInProduction = true;
assert(validate(fakeBoundReal).errors.some((error) => error.includes('REAL_UNBOUND_STATE_INVALID')));

const realWithPrompt = structuredClone(mixed);
realWithPrompt.routePlans.realMaterials.items[0].firstFramePrompt = '伪提示词';
assert(validate(realWithPrompt).errors.some((error) => error.includes('REAL_GENERATION_FIELD_FORBIDDEN')));

const realWithAliasPrompt = structuredClone(mixed);
realWithAliasPrompt.routePlans.realMaterials.items[0].generationPrompt = '生成一个官方后台画面';
assert(validate(realWithAliasPrompt).errors.some((error) => error.includes('REAL:R01_FIELD_FORBIDDEN:generationPrompt')));

const weakEvidenceFallback = structuredClone(mixed);
weakEvidenceFallback.routePlans.realMaterials.items[0].fallbackIfUnavailable = 'keep-speaker';
assert(validate(weakEvidenceFallback).errors.some((error) => error.includes('REAL_EVIDENCE_FALLBACK_TOO_WEAK')));

const disguisedContextFallback = structuredClone(mixed);
disguisedContextFallback.routePlans.realMaterials.items[0].usageRole = 'context';
disguisedContextFallback.routePlans.realMaterials.items[0].fallbackIfUnavailable = 'keep-speaker';
assert(validate(disguisedContextFallback).errors.some((error) => error.includes('REAL_EVIDENCE_FALLBACK_TOO_WEAK')));

const fakeEvidencePath = path.join(root, 'fake-evidence.txt');
writeFileSync(fakeEvidencePath, '这不是可用的官方文件媒介。');
const fakeBoundEvidence = structuredClone(mixed);
Object.assign(fakeBoundEvidence.routePlans.realMaterials.items[0], {
  evidenceStatus: 'bound-verified',
  usableInProduction: true,
  sourceBinding: {
    path: fakeEvidencePath,
    sha256: hash(readFileSync(fakeEvidencePath)),
    provenance: '人工填写的来源描述',
    rightsStatus: 'official-public-source',
    reviewedBy: 'human',
    reviewedAt: '2026-09-12T12:00:00+08:00',
  },
});
assert(validate(fakeBoundEvidence).errors.some((error) => error.includes('REAL_BINDING_REQUIRED')));

const missingPaperStyle = structuredClone(mixed);
missingPaperStyle.styleLocks.paperEditorial = null;
assert(validate(missingPaperStyle).errors.some((error) => error.includes('PAPER_STYLE_REQUIRED')));

const preselectedShotcraft = structuredClone(mixed);
preselectedShotcraft.shotcraftOpportunities[0].effectId = 'some-effect';
assert(validate(preselectedShotcraft).errors.some((error) => error.includes('SHOTCRAFT_PRESELECT_FORBIDDEN')));

const nestedPreselectedShotcraft = structuredClone(mixed);
nestedPreselectedShotcraft.shotcraftOpportunities[0].selection = {cardId: 'card-123'};
assert(validate(nestedPreselectedShotcraft).errors.some((error) => error.includes('SHOTCRAFT:SO01_FIELD_FORBIDDEN:selection')));

const aliasedPreselectedShotcraft = structuredClone(mixed);
aliasedPreselectedShotcraft.shotcraftOpportunities[0].selectedEffectId = 'effect-123';
assert(validate(aliasedPreselectedShotcraft).errors.some((error) => error.includes('SHOTCRAFT:SO01_FIELD_FORBIDDEN:selectedEffectId')));

const uncovered = structuredClone(mixed);
uncovered.semanticBeats[2].scriptQuote = '一位普通店主查看结果。';
assert(validate(uncovered).errors.includes('DIRECTOR_V2_SEMANTIC_COVERAGE_INCOMPLETE'));

const missingRhythmAudit = structuredClone(allSpeaker);
missingRhythmAudit.rhythmAudit.runs = [];
assert(validate(missingRhythmAudit, allSpeakerScript).errors.some((error) => error.includes('RHYTHM_RUN_UNREVIEWED')));

const singleSpeakerScript = '这是一个被整段塞进单一节拍的真人口播内容，仍然必须明确记录节奏复核结论。';
const singleSpeakerWithoutAudit = structuredClone(allSpeaker);
singleSpeakerWithoutAudit.semanticBeats = [{
  ...singleSpeakerWithoutAudit.semanticBeats[0],
  scriptQuote: singleSpeakerScript,
}];
singleSpeakerWithoutAudit.selectionSummary.routeCounts.speaker = 1;
singleSpeakerWithoutAudit.selectionSummary.protectedSpeakerBeatIds = ['B01'];
singleSpeakerWithoutAudit.rhythmAudit.runs = [];
assert(validate(singleSpeakerWithoutAudit, singleSpeakerScript).errors.some((error) => error.includes('RHYTHM_RUN_UNREVIEWED')));

const shotcraftWithoutRunRef = structuredClone(allSpeaker);
shotcraftWithoutRunRef.rhythmAudit.runs[0].decision = 'shotcraft-opportunity';
assert(validate(shotcraftWithoutRunRef, allSpeakerScript).errors.some((error) => error.includes('RHYTHM_SHOTCRAFT_REF_REQUIRED')));

const sequencedVideo = structuredClone(mixed);
sequencedVideo.routePlans.aiGeneratedVideos.items[0].videoPrompt += ' 然后起身离开。';
assert(validate(sequencedVideo).errors.some((error) => error.includes('AI_VIDEO_CONTAINS_SEQUENCE')));

console.log('test-director-cues-v2: ok');
