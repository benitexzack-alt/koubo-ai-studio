import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT, CONTROL, OUTPUT, hashFile, readJson} from './runner-core.mjs';

const read = p => readJson(path.join(ROOT, p));
const bind = p => ({path: p, absolutePath: path.join(ROOT, p), sha256: hashFile(path.join(ROOT, p))});
const write = (p, value) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const qa = read(`${OUTPUT}/qa/candidate-machine-qa.v1.json`);
const comparison = read(`${OUTPUT}/qa/protected-media-comparison.v1.json`);
const rendering = read(`${OUTPUT}/render/receipt.json`);
const permission = read(`${CONTROL}/permission.v1.json`);
const original = read('edit/20260906_lanzhou_ai_services/07_预览与质检/candidate-preview-r1/candidate-delivery.v1.json');
const video = bind(`${OUTPUT}/render/with-sfx-960x540.mp4`);
assert.equal(qa.video.sha256, video.sha256);
assert.deepEqual(Object.entries(qa.checks).filter(([,v]) => !v).map(([k]) => k), ['truePeakHeadroom']);
assert.equal(comparison.status, 'requires-review');
assert(comparison.comparisons.every(c => c.audio.pass));
assert.equal(comparison.newVideo.sha256, video.sha256);
assert.equal(rendering.status, 'candidate-generated-pending-human-review');
assert.equal(rendering.outputs[0].sha256, video.sha256);
assert.equal(rendering.inputDriftCheck, 'unchanged');
assert.equal(rendering.knowledge.status, 'context-valid');
assert.equal(permission.formalEnabled, false);
assert.equal(original.transcriptQuestions.length, 13);

const references = {
  request: `${CONTROL}/request.v3.json`, permission: `${CONTROL}/permission.v1.json`,
  codeReview: `${CONTROL}/independent-review.v3.json`, context: `${CONTROL}/context/context-binding.v3.json`,
  renderStarted: `${OUTPUT}/render/started.json`, renderReceipt: `${OUTPUT}/render/receipt.json`,
  machineQA: `${OUTPUT}/qa/candidate-machine-qa.v1.json`, protectedMedia: `${OUTPUT}/qa/protected-media-comparison.v1.json`,
  fullDecode: `${OUTPUT}/qa/full-decode.command.json`, signalScan: `${OUTPUT}/qa/signal-scan.command.json`,
  riskFrames: `${OUTPUT}/keyframe-visual-review.v1.json`,
  audioPlan: `${CONTROL}/sfx-plan.v1.json`, audioAudit: `${CONTROL}/audio-audit.recommendations.json`,
  visualPlan: 'remotion/src/lanzhou-services-v91-candidate-r2/visual-plan.v1.json',
  selection: 'edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r2/output-selection.derived.v2.json',
  officialLayout: 'edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r2/evidence-layout-plan.v1.json',
  spoken: 'edit/20260906_lanzhou_ai_services/09_实录与字幕/canonical-spoken.v1.json',
  bilingual: 'edit/20260906_lanzhou_ai_services/09_实录与字幕/actual-bilingual.v1.json',
  transcriptReview: 'edit/20260906_lanzhou_ai_services/09_实录与字幕/transcription-review.v1.json',
  stagingFailure: `${OUTPUT}/render-staging-failed-20260908T002744/failed.json`,
  audioFinishPlanReview: `${CONTROL}/independent-audio-finish-review.v1.json`,
  audioFinishBlocked: `${OUTPUT}/audio-finish/context-before.stdout.txt`,
  audioFinishBlockedCommand: `${OUTPUT}/audio-finish/context-before.command.json`,
};
const evidence = Object.fromEntries(Object.entries(references).map(([key, p]) => [key, bind(p)]));
const protectedVisualReview = {
  reviewer: 'parent-r2-visual-public-runner', reviewedAt: new Date().toISOString(),
  outputSha256: video.sha256,
  scope: 'P03/P04/P05各首中尾共9对两版同帧图，另含P04第5575帧；不冒充全区间逐帧人工复核。',
  evidence: ['P03-r1-r2-start-middle-end.png','P04-r1-r2-start-middle-end.png','P05-r1-r2-start-middle-end.png',
    'P04-r1-r2-frame5575.png'].map(n => bind(`${OUTPUT}/qa/${n}`)),
  observation: '实际查看的物件、标签、构图、动作阶段和字幕未见内容变化，P03遮牌等已知源缺陷仍在。',
  causeInference: '有损编码可能受前序画面改变影响，尚未证明是全部数值差异的唯一原因。',
  identicalPixelsClaimed: false, originalSsimScreeningUnchanged: true,
};
write(`${OUTPUT}/qa/protected-visual-review.v1.json`, protectedVisualReview);
evidence.protectedVisualReview = bind(`${OUTPUT}/qa/protected-visual-review.v1.json`);
const receipt = {
  schemaVersion: 'lanzhou-services-candidate-delivery/v1', generatedAt: new Date().toISOString(),
  episodeId: permission.episodeId, revisionId: permission.revisionId, status: 'technical-review-required',
  watchableForFeedback: true, allTechnicalChecksPassed: false,
  video: {...qa.video, ...video}, evidence, machineChecks: qa.checks,
  outputChanges: ['工信部正式原文放大排版、分行进入和关键词高亮，原文截图另列溯源。',
    '左上语义动效字号放大、主次分级、重点暖黄和辅助白/青。',
    '26个重点卡点重新选择9种既有音效，增强开头包容与支持的听觉提示。'],
  timeline: original.timeline, paperUses: qa.paperUses, acceptedSourceExceptions: permission.acceptedPaperExceptions,
  protectedOutputComparison: comparison.comparisons, exceptionInheritance: 'forbidden',
  protectedVisualReview,
  audio: {...qa.sourceAudio, loudnessLUFS: qa.loudnessLUFS, truePeakDbFS: qa.truePeakDbFS,
    additionalCueCount: qa.attachedSfx.count, distinctCueFiles: qa.attachedSfx.distinctFiles,
    userAudibilityConfirmed: false, outstanding: original.audio.outstanding},
  shotcraft: {appliedInstances: 15, catalogTotal: 157, candidateRenderers: 5,
    currentChange: '基于已选实例调整本条显示属性，未伪称重新匹配或新增卡片能力。',
    reusableAcceptedExperiencePromoted: false},
  transcriptAuthority: 'recorded-audio', preshootScriptRole: 'comparison-only',
  transcriptQuestions: original.transcriptQuestions,
  limitations: ['机器解码、全区间信号对照和静帧检查不能替代正常速度完整观看及人耳听感。',
    '当前AAC真峰值-0.9dBFS，相对内部<=-1dBFS预留线高0.1dB；并非削波，但技术目标尚未闭合。',
    '计划整体衰减0.3dB的音频收尾被context-before阻断，未调用音频封装，未生成带有该衰减的新视频。',
    'P03/P04/P05的两版SSIM低于新增保守筛查线0.995；首中尾视觉对照未见内容变化，原筛查不改判为逐帧像素相同。',
    '五段纸艺源缺陷仅本条已接受；P03原生音量偏轻的既有待核事项保留。',
    '13项原有字幕识别疑点未擅自修改，详见第一版逐项清单和本回执。',
    '少量长句的逗号或短尾独立成行，文字完整，作为非阻断排版观察保留。',
    '知识上下文仅证明本次执行时有效；本轮收工后新执行仍需重新校验。'],
  entireVideoEarListeningPerformed: false, userPreviewApproved: false,
  formalEnabled: false, productionEligible: false, publishAuthorized: false,
  priorCandidatePreserved: true, newImageOrVideoGeneration: false,
  nextGate: '先可观看本小样反馈视觉与声音；独立解决知识上下文失效及真峰值收尾后复检，用户明确确认前不得正式成片。',
};
const checklistPath = `${OUTPUT}/第二版小样观看说明.md`;
const lines = [
  '# 在兰州，把企业AI服务做下去：第二版有声小样', '',
  '状态：完整有声小样可观看反馈，仍有音频技术收尾；不是正式成片，未公开发布。', '',
  `[打开第二版完整有声小样](${video.absolutePath})`, '',
  `时长：279.766667秒；960×540，30fps，8393帧；${qa.video.videoCodec}/${qa.video.audioCodec}，实际像素格式${qa.video.pixFmt}。`, '',
  '## 本次重点', '',
  '- 开头00:00—00:02.30：包容和支持的大字与两次重点音效。',
  '- 01:17.87—01:27.13：工信部正式条款的原文放大、逐行展开、扎根用户现场高亮。',
  '- 全片左上语义信息的字号、主次色差及26处重点音效。',
  '- 新闻、原片和五段纸艺不重做、不删改；原有纸艺瑕疵仅按本条确认保留。', '',
  `完整解码通过，未检出黑场/长冻结/长静音；响度${qa.loudnessLUFS} LUFS，真峰值${qa.truePeakDbFS} dBFS。`,
  '真峰值较内部-1dBFS目标高0.1dB，拟做的0.3dB整体音量收尾尚被知识上下文校验阻断，没有执行，也没有冒充技术全通过。',
  '新闻和五段纸艺的两版区间音频PCM相等；部分纸艺SSIM未达保守筛查线，首中尾视觉对照未见内容变化，原记录全部保留。', '',
  '原有13项实录识别疑点与第3段纸艺源声偏轻仍保留，未拿拍摄前文稿改字幕。',
  `[原有逐项字幕核对清单](${path.join(ROOT, 'edit/20260906_lanzhou_ai_services/07_预览与质检/candidate-preview-r1/小样观看与核对清单.md')})`, '',
  '完整证据、哈希和已知例外见同目录candidate-delivery.v1.json。', '',
];
fs.writeFileSync(path.join(ROOT, checklistPath), lines.join('\n'), {flag: 'wx'});
receipt.reviewChecklist = bind(checklistPath);
write(`${OUTPUT}/candidate-delivery.v1.json`, receipt);
console.log(JSON.stringify({status: receipt.status, video, receipt: bind(`${OUTPUT}/candidate-delivery.v1.json`),
  checklist: receipt.reviewChecklist, formalEnabled: false}, null, 2));
