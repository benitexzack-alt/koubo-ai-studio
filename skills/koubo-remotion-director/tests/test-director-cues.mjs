import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateDirectorCues} from '../scripts/director-cues-core.mjs';

const template = JSON.parse(readFileSync(new URL('../templates/director-cues.v1.json', import.meta.url), 'utf8'));
assert.equal(template.selectionSummary.insertCount, template.inserts.length);
assert.equal(template.executionScope, 'director-only');
assert.equal(template.handoffGate.downstreamAllowed, false);
assert(template.selectionSummary.argumentFlow.length >= 1);
assert(Array.isArray(template.selectionSummary.realEvidenceSuggestions));
assert(template.styleLock.mustKeep.length >= 4);
assert(template.styleLock.mustAvoid.length >= 3);
assert(template.inserts.every((insert) => insert.textPlan.length >= 1));

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const root = mkdtempSync(path.join(os.tmpdir(), 'director-cues-test-'));
const referenceBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAtAAAAGVCAIAAABYSFGJAAAACXBIWXMAAAABAAAAAQBPJcTWAAAG2klEQVR4nO3WQQkAIADAQAX7BzSHAUwxBLlLsOfmOXsAAJTW6wAA4H+GAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgJzhAAByhgMAyBkOACBnOACAnOEAAHKGAwDIGQ4AIGc4AICc4QAAcoYDAMgZDgAgZzgAgNwFI7gJFFm72+YAAAAASUVORK5CYII=',
  'base64',
);
const referencePath = path.join(root, 'reference.png');
writeFileSync(referencePath, referenceBytes);

const scriptText = '开场判断留给真人。官方材料展示事实。这里解释一个流程。最后由真人说明边界。';
const prefix = '摄影级微缩纸艺定格，暖米色实体桌面，真实纸纤维、卡纸厚度、三层空间与柔和侧光，16:9。';
const good = {
  schemaVersion: 'koubo-director-cues/v1',
  taskId: 'director-cues-test',
  status: 'ready-for-user-review',
  executionScope: 'director-only',
  handoffGate: {
    status: 'blocked-awaiting-user-approval',
    downstreamAllowed: false,
  },
  inputScript: {authority: 'user-confirmed-script'},
  styleLock: {
    referenceImages: [{
      id: 'REF01',
      path: referencePath,
      sha256: sha256(referenceBytes),
      usage: 'style-mechanism-only',
    }],
    promptPrefix: prefix,
    textPolicy: 'generated-base-image-then-deterministic-chinese',
    mustKeep: ['实体桌面', '纸纤维', '三层空间', '真实接触阴影'],
    mustAvoid: ['PPT卡片', '塑料3D', '模型生成文字'],
  },
  selectionSummary: {
    mainPoint: '说明一条流程，并保留开场和边界给真人。',
    argumentFlow: ['真人提出判断', '纸艺解释流程', '真人说明边界'],
    realEvidenceSuggestions: [{
      scriptQuote: '官方材料展示事实。',
      assetType: 'official-evidence',
      reason: '事实主张优先使用可核验的官方材料。',
    }],
    insertCount: 1,
    densityReason: '只有流程段能增加视觉理解。',
    protectedSpeakerSections: ['开场判断留给真人', '最后由真人说明边界'],
  },
  inserts: [{
    id: 'P01',
    order: 1,
    scriptQuote: '这里解释一个流程。',
    startAnchorText: '这里解释',
    endAnchorText: '一个流程',
    timingStatus: 'pre-shoot-text-anchor-only',
    durationSeconds: 4,
    reason: '让观众看清输入如何成为结果。',
    visualRole: 'process',
    route: 'paper-editorial',
    visualMetaphor: '纸带穿过校准门进入成品托盘',
    composition: '侧视单线流程',
    primaryAction: '纸带平稳穿过校准门',
    textPlan: [
      {text: '输入', surface: '前景固定空白纸牌A'},
      {text: '校准', surface: '中景固定空白纸牌B'},
      {text: '结果', surface: '后景固定空白纸牌C'},
    ],
    referenceImageIds: ['REF01'],
    firstFramePrompt: `${prefix}俯拍略带侧视，前景是一卷待处理纸带，中景是带刻度但无文字的纸质门框，后景是空的成品托盘；前景固定空白纸牌A、中景固定空白纸牌B、后景固定空白纸牌C彼此分离，保留真实接触阴影，画面静止。`,
    videoPrompt: '基于已确认首帧，纸带平稳穿过校准门并落入成品托盘；机位保持稳定，结束时纸带整齐停在托盘内，不新增物件、不改材质、不生成文字。',
    negativePrompt: ['不生成可读文字', '不重做场景', '不使用PPT卡片'],
  }],
};

const validate = (value) => validateDirectorCues({cues: value, projectRoot: root, scriptText});
assert.equal(validate(good).ok, true);

const missingArgumentFlow = structuredClone(good);
missingArgumentFlow.selectionSummary.argumentFlow = [];
assert(validate(missingArgumentFlow).errors.includes('DIRECTOR_CUES_ARGUMENT_FLOW_INVALID'));

const downstreamUnlocked = structuredClone(good);
downstreamUnlocked.handoffGate.downstreamAllowed = true;
assert(validate(downstreamUnlocked).errors.includes('DIRECTOR_CUES_HANDOFF_GATE_INVALID'));

const wrongExecutionScope = structuredClone(good);
wrongExecutionScope.executionScope = 'firstframe';
assert(validate(wrongExecutionScope).errors.includes('DIRECTOR_CUES_EXECUTION_SCOPE_INVALID'));

const generatedAsEvidence = structuredClone(good);
generatedAsEvidence.selectionSummary.realEvidenceSuggestions[0].assetType = 'paper-editorial';
assert(validate(generatedAsEvidence).errors.includes('DIRECTOR_CUES_REAL_EVIDENCE_TYPE_INVALID'));

const polluted = structuredClone(good);
polluted.inserts[0].firstFramePrompt += ' 物件宽20毫米，x=0.2。';
assert(validate(polluted).errors.some((error) => error.includes('TECHNICAL_PROMPT_POLLUTION')));

const motionInFirstFrame = structuredClone(good);
motionInFirstFrame.inserts[0].firstFramePrompt += ' 随后纸带滑入托盘。';
assert(validate(motionInFirstFrame).errors.some((error) => error.includes('FIRST_FRAME_CONTAINS_MOTION')));

const unknownReference = structuredClone(good);
unknownReference.inserts[0].referenceImageIds = ['REF99'];
assert(validate(unknownReference).errors.some((error) => error.includes('REFERENCE_ID_UNKNOWN')));

const wrongQuote = structuredClone(good);
wrongQuote.inserts[0].scriptQuote = '文稿里没有这一句。';
assert(validate(wrongQuote).errors.some((error) => error.includes('SCRIPT_QUOTE_MISMATCH')));

const missingStyle = structuredClone(good);
missingStyle.inserts[0].firstFramePrompt = missingStyle.inserts[0].firstFramePrompt.slice(prefix.length);
assert(validate(missingStyle).errors.some((error) => error.includes('STYLE_PREFIX_MISSING')));

const emptyRules = structuredClone(good);
emptyRules.styleLock.mustKeep = ['', '', '', ''];
assert(validate(emptyRules).errors.some((error) => error.includes('STYLE_KEEP_RULES_INVALID')));

const wrongAnchorOrder = structuredClone(good);
wrongAnchorOrder.inserts[0].startAnchorText = '一个流程';
wrongAnchorOrder.inserts[0].endAnchorText = '这里解释';
assert(validate(wrongAnchorOrder).errors.some((error) => error.includes('ANCHOR_ORDER_INVALID')));

const wrongRoute = structuredClone(good);
wrongRoute.inserts[0].route = 'real-evidence';
assert(validate(wrongRoute).errors.some((error) => error.includes('ROUTE_INVALID')));

const multiAction = structuredClone(good);
multiAction.inserts[0].videoPrompt += ' 同时托盘转向另一侧。';
assert(validate(multiAction).errors.some((error) => error.includes('VIDEO_CONTAINS_SEQUENCE')));

const textPlanWithoutSurface = structuredClone(good);
textPlanWithoutSurface.inserts[0].textPlan = ['输入'];
assert(validate(textPlanWithoutSurface).errors.some((error) => error.includes('TEXT_PLAN_INVALID')));

const textPlanUnknownSurface = structuredClone(good);
textPlanUnknownSurface.inserts[0].textPlan[0].surface = '画面里不存在的纸牌';
assert(validate(textPlanUnknownSurface).errors.some((error) => error.includes('TEXT_PLAN_SURFACE_INVALID')));

const textLeakedToFirstFrame = structuredClone(good);
textLeakedToFirstFrame.inserts[0].firstFramePrompt += ' 第一张纸牌写着输入。';
assert(validate(textLeakedToFirstFrame).errors.some((error) => error.includes('TEXT_LEAKED_TO_FIRST_FRAME')));

const emptyProtectedSpeaker = structuredClone(good);
emptyProtectedSpeaker.selectionSummary.protectedSpeakerSections = [];
assert(validate(emptyProtectedSpeaker).errors.some((error) => error.includes('PROTECTED_SPEAKER_SECTIONS_INVALID')));

const overlappingProtectedSpeaker = structuredClone(good);
overlappingProtectedSpeaker.selectionSummary.protectedSpeakerSections.push('这里解释一个流程');
assert(validate(overlappingProtectedSpeaker).errors.some((error) => error.includes('PROTECTED_SPEAKER_OVERLAP')));

const denseWindow = structuredClone(good);
denseWindow.inserts[0].scriptQuote = scriptText;
denseWindow.inserts[0].startAnchorText = '开场判断';
denseWindow.inserts[0].endAnchorText = '说明边界';
denseWindow.inserts[0].durationSeconds = 2;
assert(validate(denseWindow).errors.some((error) => error.includes('SPEECH_WINDOW_TOO_DENSE')));

const symbolRisk = structuredClone(good);
symbolRisk.inserts[0].firstFramePrompt += ' 前景放一枚问号。';
assert(validate(symbolRisk).errors.some((error) => error.includes('FIRST_FRAME_SYMBOL_RISK')));

const fakeReference = structuredClone(good);
const fakeBytes = Buffer.from('not-a-real-png');
const fakePath = path.join(root, 'fake.png');
writeFileSync(fakePath, fakeBytes);
fakeReference.styleLock.referenceImages[0].path = fakePath;
fakeReference.styleLock.referenceImages[0].sha256 = sha256(fakeBytes);
assert(validate(fakeReference).errors.some((error) => error.includes('REFERENCE_MEDIA_INVALID')));

const wrongOrder = structuredClone(good);
wrongOrder.selectionSummary.insertCount = 2;
wrongOrder.inserts.push({
  ...structuredClone(good.inserts[0]),
  id: 'P02',
  order: 2,
  scriptQuote: '开场判断留给真人。',
  startAnchorText: '开场判断',
  endAnchorText: '留给真人',
  visualMetaphor: '纸页在桌面上组成方向箭头',
  composition: '俯拍环形构图',
});
assert(validate(wrongOrder).errors.some((error) => error.includes('SCRIPT_ORDER_INVALID')));

console.log('test-director-cues: ok');
