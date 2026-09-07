import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const dir = import.meta.dirname;
const repo = path.resolve(dir, '../../../..');
const base = 'edit/20260906_lanzhou_ai_services';
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(repo, p), 'utf8'));
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(repo, p))).digest('hex');
const bind = (p) => ({path: path.relative(repo, path.resolve(repo, p)), sha256: sha(p)});
const extractionPath = path.join(dir, 'extra-shotcraft-extraction.v1.json');
const extraction = read(extractionPath);
assert.equal(extraction.exitCode, 0);
assert.equal(extraction.images.length, 13);
assert.equal(extraction.video.sha256, '9d6342ac4456f362406e3b0b4da00eeeb09812265fae02cf203d01740e69d2e4');
assert.equal(sha(extraction.video.path), extraction.video.sha256);
for (const image of extraction.images) assert.equal(sha(image.path), image.sha256);
assert.equal(sha(extraction.selection.path), extraction.selection.sha256);
const selection = read(extraction.selection.path);
const data = read(path.join(dir, 'data.v1.json'));
const component = bind('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx');
const componentCopy = bind('remotion/src/lanzhou-services-v91-candidate-r1/ShotcraftEffects.generated.tsx');
assert.equal(component.sha256, componentCopy.sha256);
assert.equal(component.sha256, selection.derivation.component.sha256);
const parentPath = `${base}/07_预览与质检/candidate-preview-r1/keyframe-visual-review.v1.json`;
const parentReview = read(parentPath);
const parentBinding = bind(parentPath);
assert.equal(parentBinding.sha256, 'bc16ef6600beef127730951ddf7dbb944287459df70dfdb4da78f48130c97c56');

// 以下观察在本轮13次实际view_image图像读取之后填写，不由字数、代码或测试结果推导。
const observations = {
  'output-c022': {
    before: '3072帧左上可见青色“新员工”，第二行尚未出现；3140帧仍仅第一项可见，与第二项尚未到入场帧一致。',
    after: '3185帧左上两行“新员工”“老员工”完整可读，青色和白色区分明确；没有挡住右侧脸部，底部中英字幕完整可见。',
    limitation: '3140帧不能单独证明第二项已出现，因此另实看3185帧；本组证实前后两个状态，不称逐帧动态验收。',
    allPropsVisibleAtRepresentativeFrame: true,
  },
  'output-c035': {
    before: '5000帧marker处于低透明度入场，前文、青色关键词及后文已有对应字形。',
    after: '5055帧完整显示“对外还有一件事。客户通过AI了解你的公司时，”，关键词青色加黄色下划线，前文及末尾“时，”没有被省略。文字在左侧，未压住右侧脸部。',
    limitation: '末尾“时，”单独换到第三行，但仍可见，没有裁切；不据此要求重做。',
    allPropsVisibleAtRepresentativeFrame: true,
  },
  'output-c048': {
    before: '7123帧可见低透明度marker入场，所在区域与后帧一致，真人和底部字幕保持可见。',
    after: '7200帧“我觉得”“这样的变化就值得做”以及“。我愿意在兰州继续做下去，”均显示，关键词青色加下划线，整段仍在左侧，未挡脸或截断底部字幕。',
    limitation: '句号落到下一行开头，末尾“去，”另换一行；属于本帧可见换行，不是缺字，不新增修订条件。',
    allPropsVisibleAtRepresentativeFrame: true,
  },
  'output-c052': {
    before: '7706帧marker低透明度入场，脸部和手部动作位于文字右侧。',
    after: '7745帧完整显示“我还有需要学习和改进的地方。视频里哪句话”，关键词“学习和改进”青色加下划线，前后文保留；底部实录中英字幕完整。',
    limitation: '“地方”跨行显示为上一行末尾“地”和下一行“方”，没有裁字；不视为内容被修改。',
    allPropsVisibleAtRepresentativeFrame: true,
  },
  'output-c054': {
    before: '7909帧可见marker渐入字形，未盖住真人脸部。',
    after: '7970帧“欢迎直接指出来。”及后文“大家愿意把真实的问题拿出来聊，”完整显示，关键词高亮和下划线可见，左上文字与真人、底部双语字幕分离。',
    limitation: '只验证本组早帧与代表帧的可见状态，没有声称全段逐帧无任何遮挡。',
    allPropsVisibleAtRepresentativeFrame: true,
  },
  'output-c056': {
    before: '8204帧marker低透明度入场，前文保留实录“员工正在用AI，或者是”，未改成预拍稿说法。',
    after: '8260帧完整显示“员工正在用AI，或者是企业信息整理这方面的需求，”，关键词青色加下划线。最后“求，”另行仍完整可见；没有压住脸部，底部中英字幕可见且未截字。',
    limitation: '保留本条实录字幕原话及已有待核边界，不借视觉检查声称听验或改正文。',
    allPropsVisibleAtRepresentativeFrame: true,
  },
};
const applications = extraction.checks.map((check) => {
  const beat = selection.beats.find((b) => b.beatId === check.beatId);
  const frames = [...new Set([check.earlyFrame, check.requestedFrame, check.representativeFrame])];
  const evidence = frames.map((frame) => extraction.images.find((image) => image.frame === frame));
  assert(evidence.every(Boolean));
  const caption = data.captions.find((c) => c.id === beat.beatId.slice('output-'.length));
  const registry = read(selection.registry.path);
  const adapter = registry.effects.find((item) => item.id === beat.effectId);
  return {beatId: beat.beatId, effectId: beat.effectId, frames: beat.frames,
    component: {name: adapter.component, ...component}, actualComponentCopy: componentCopy,
    componentProps: beat.componentProps, outputSha256: extraction.video.sha256,
    sourceCaptionId: caption.id, expectedCaption: {zh: caption.zh, en: caption.en},
    imageInspection: 'actual-view_image-on-all-listed-full-resolution-images', evidence,
    observation: observations[beat.beatId], sampledVisualCheckPassed: true,
    addedFaceOcclusionObserved: false, addedTextClippingObserved: false, subtitleClippingObserved: false,
    sampledStatesMatchExpectedComponentProps: true, fullDynamicReviewPerformed: false,
    humanListeningPerformed: false, finalWorkingClaimDeferredToParentMergedReceipt: true};
});
assert.equal(applications.length, 6);
const parentFrames = [370, 1625, 2415, 2540, 2995, 5350, 6290, 7880, 8175];
const parentCoverage = parentFrames.map((frame) => {
  const beat = selection.beats.find((b) => b.decision === 'apply' && frame >= b.frames.startFrame && frame < b.frames.endFrameExclusive);
  assert(beat);
  const image = parentReview.images.find((item) => item.frame === frame);
  assert(image);
  assert.equal(sha(image.path), image.sha256);
  return {beatId: beat.beatId, effectId: beat.effectId, frame, evidence: image,
    attribution: '父任务报告已通过；该9项图像不冒称由本子任务重新实看。'};
});
assert.equal(new Set(parentCoverage.map((item) => item.beatId)).size, 9);
assert.equal(new Set([...parentCoverage, ...applications].map((item) => item.beatId)).size, 15);
const report = {schemaVersion: 'koubo-extra-shotcraft-visual-qa/v1', status: 'six-effects-sampled-visual-checks-passed-ready-for-parent-merge',
  reviewedAt: new Date().toISOString(), reviewer: 'assistant-actual-view_image-inspection-not-human-listening',
  video: extraction.video, machineQA: extraction.machineQA, extraction: bind(extractionPath),
  selection: extraction.selection, component, componentCopy, applications,
  summary: {independentlyInspectedEffectCount: 6, individuallyViewedImageCount: 13, additionalP0Count: 0, additionalP1Count: 0,
    sampledVisualFailures: 0, sourceCaptionContentChanged: false, originalVideoHashUnchanged: true},
  parentMerge: {parentVisualReview: parentBinding, parentReportedCoverage: parentCoverage,
    totalDistinctEffectCoverage: 15, coverageProvenance: '父任务9项stills检查 + 本子任务6项最终视频抽帧实看，不能描述成15项全由本子任务或真人逐帧检查。',
    readyForParentToMergeApplicationReceipt: true, applicationReceiptGeneratedByThisScript: false},
  originalRunner: {failure: bind(`${base}/07_预览与质检/candidate-preview-r1/render/failed.json`),
    successReceiptClaimed: false, recoveryEvidence: extraction.machineQA,
    note: '原runner后置bundled ffprobe动态库加载错误保留；本次抽帧依据父任务确认的独立完整媒体QA和固定视频SHA，不伪造原runner成功。'},
  limitations: ['只检查列明的早帧和代表帧，不是全片动态逐帧验收，也不是手机端完整阅读测试。',
    '字幕及纸片既有问题保持本条例外与13项待核；本次六项均为真人主画面效果，不把纸片缺陷升级为合格。',
    '没有人耳或模型音频感知听验，媒体QA中的响度/静音扫描不是内容听验。'],
  userPreviewApproved: false, formalAllowed: false, publicationApproved: false};
const out = path.join(dir, 'extra-shotcraft-visual-qa.v1.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({report: bind(out), summary: report.summary, readyForParentMerge: true}, null, 2));
