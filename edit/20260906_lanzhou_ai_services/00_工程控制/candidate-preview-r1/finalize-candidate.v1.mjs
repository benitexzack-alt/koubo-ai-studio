import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const repo = path.resolve(import.meta.dirname, '../../../..');
const episode = 'edit/20260906_lanzhou_ai_services';
const control = `${episode}/00_工程控制/candidate-preview-r1`;
const director = `${episode}/04_导演拆解/candidate-preview-r1`;
const output = `${episode}/07_预览与质检/candidate-preview-r1`;
const read = (p) => JSON.parse(fs.readFileSync(path.join(repo, p), 'utf8'));
async function bind(p) {
  const h = crypto.createHash('sha256');
  for await (const b of fs.createReadStream(path.join(repo, p))) h.update(b);
  return {path: p, sha256: h.digest('hex')};
}
const write = (p, text) => fs.writeFileSync(path.join(repo, p), text, {flag: 'wx'});
const json = (p, value) => write(p, JSON.stringify(value, null, 2) + '\n');
const timestamp = (ms) => {
  const seconds = ms / 1000;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
};

const permission = read(`${control}/permission.v1.json`);
const qa = read(`${output}/qa/candidate-machine-qa.v1.json`);
const recovery = read(`${control}/independent-recovery-review.v1.json`);
const application = read(`${director}/application-receipt.v1.json`);
const applicationValidation = read(`${director}/application-validation.v1.json`);
const transcript = read(`${episode}/09_实录与字幕/transcription-review.v1.json`);
const video = await bind(`${output}/render/with-sfx-960x540.mp4`);
assert.equal(video.sha256, '9d6342ac4456f362406e3b0b4da00eeeb09812265fae02cf203d01740e69d2e4');
assert.equal(recovery.decision, 'allow-existing-artifact-as-candidate');
assert.equal(recovery.artifact.sha256, video.sha256);
assert.equal(qa.video.sha256, video.sha256);
assert(Object.values(qa.checks).every((value) => value === true));
assert.equal(application.output.sha256, video.sha256);
assert.equal(applicationValidation.exitCode, 0);
assert.equal(application.applications.length, 15);
assert(application.applications.every((item) => item.finalWorking));
assert.equal(permission.formalEnabled, false);
assert.equal(transcript.uncertain.length, 13);

const paths = {
  permission: `${control}/permission.v1.json`,
  request: `${control}/request.v5.json`,
  context: `${control}/context/context-binding.v3.json`,
  originalStarted: `${output}/render/started.json`,
  originalFailure: `${output}/render/failed.json`,
  recovery: `${control}/independent-recovery-review.v1.json`,
  audioRecovery: `${control}/independent-recovery-audio-addendum.v1.json`,
  machineQA: `${output}/qa/candidate-machine-qa.v1.json`,
  mediaProbe: `${output}/qa/media.json`,
  fullDecodeCommand: `${output}/qa/full-decode.command.json`,
  fullDecodeStderr: `${output}/qa/full-decode.stderr.txt`,
  signalScan: `${output}/qa/signal-scan.stderr.txt`,
  audioRegression: `${output}/qa/paper-audio-regression.v2.json`,
  keyframes: `${output}/keyframe-visual-review.v1.json`,
  extraKeyframes: `${director}/extra-shotcraft-visual-qa.v1.json`,
  application: `${director}/application-receipt.v1.json`,
  applicationValidation: `${director}/application-validation.v1.json`,
  spoken: `${episode}/09_实录与字幕/canonical-spoken.v1.json`,
  bilingual: `${episode}/09_实录与字幕/actual-bilingual.v1.json`,
  transcriptReview: `${episode}/09_实录与字幕/transcription-review.v1.json`,
  composition: 'remotion/src/lanzhou-services-v91-candidate-r1/LanzhouServicesCandidate.tsx',
};
const bindings = {};
for (const [key, value] of Object.entries(paths)) bindings[key] = await bind(value);
const audioReview = {id: 'P2-P03-AUDIO', status: 'awaiting-user-listening',
  outputSeconds: [151.766667, 159.766667], gainConfigured: 0.1,
  sourceRelativeToHostDb: -44.5418,
  note: 'P03源声偏轻，回归数值不足确认可闻性，不据此断言缺失。另四段仅数值检出，不是人耳试听通过。'};
const questions = transcript.uncertain.map((item) => ({
  id: item.id, sourceStartMs: item.startMs, sourceEndMs: item.endMs,
  outputStartMs: item.startMs + 244 / 30 * 1000,
  outputEndMs: item.endMs + 244 / 30 * 1000,
  retained: item.retained, alternatives: item.alternatives, reason: item.reason,
  status: 'awaiting-user-audio-review',
}));
const receipt = {
  schemaVersion: 'lanzhou-services-candidate-delivery/v1',
  episodeId: '20260906_lanzhou_ai_services', revisionId: permission.revisionId,
  generatedAt: new Date().toISOString(), status: 'ready-for-user-review',
  video: {...video, absolutePath: path.join(repo, video.path), ...recovery.artifact},
  evidence: bindings, machineChecks: qa.checks,
  originalRunnerExitCode: 1, originalFailurePreserved: true,
  recoveryDisposition: recovery.decision, rerenderedForProbeFailure: false,
  timeline: {hostFrames: 8149, newsFrames: 244, newsFrom: 69, newsToExclusive: 313,
    totalFrames: 8393, sourceHostContentDeleted: false},
  paperUses: qa.paperUses, acceptedSourceExceptions: permission.acceptedPaperExceptions,
  exceptionInheritance: 'forbidden',
  audio: {...qa.sourceAudio, loudnessLUFS: qa.loudnessLUFS, truePeakDbFS: qa.truePeakDbFS,
    audioVideoDurationDifferenceSeconds: 0.062666, outstanding: [audioReview],
    decodedWaveformOffsetMs: 42.3, waveformOffsetIsNotProvenLipSyncDefect: true},
  shotcraft: {libraryCardsSearched: 157, appliedInstances: 15,
    appliedEffectTypes: [...new Set(application.applications.map((item) => item.effectId))],
    evidenceScope: '父任务9项与子任务6项关键帧抽查，非全片逐帧动态或人耳验收',
    reusableAcceptedExperiencePromoted: false},
  transcriptAuthority: 'recorded-audio', preshootScriptRole: 'comparison-only',
  transcriptQuestions: questions,
  limitations: ['官方长段落低清小字较小，未宣称手机阅读全部通过。',
    '纸艺五项源片缺陷仅本条用户例外接受，不改历史失败结论。',
    '全片机器解码和信号扫描不替代正常速度完整观看及音频内容核对。',
    '当前知识上下文仅证明本次执行时有效，未来执行须重新校验。'],
  entireVideoEarListeningPerformed: false, userPreviewApproved: false,
  formalEnabled: false, productionEligible: false, publishAuthorized: false,
  nextGate: '用户完整观看小样并核对字幕与声音；未经单独确认不得正式渲染或发布。',
};
const checklist = [
  '# 本条小样观看与核对清单', '',
  '状态：有声低清小样已生成，待完整观看；不是正式成片或发布包。', '',
  `小样：[打开4分39.77秒有声小样](${path.join(repo, video.path)})`, '',
  '开头顺序：本人首句 → 8.1秒新闻完整原声 → 返回本人继续讲解。5段原有纸艺完整保留，没有重新生成。', '',
  '技术检查：960×540、30帧/秒、8393帧、AAC双声道；完整解码通过，未检测到黑场、异常长冻结、长静音或削波。实际像素格式为yuvj420p，全范围。', '',
  '## 先看这几处', '',
  '- 00:02.30—00:10.43：新闻插入和返回本人是否自然，新闻音量是否合适。',
  '- 02:31.77—02:39.77：第3段纸艺原声较轻，需实际试听；其余四段数值检出也不替代听感确认。',
  '- 五段原动画的既有瑕疵按本条决定保留，未伪报修复。新动效只用于真人/证据画面。',
  '- 正常速度看完字幕、人物安全区、纸艺与口播衔接后，再决定是否进入正式片。', '',
  '## 实录字幕待核对', '',
  '以下是识别分歧，不是已认定口误，也不是要求重录。时间均为本小样时间；以听到的原声为准，不以拍摄前稿件替换。', '',
  '| 编号 | 小样时间 | 当前候选 | 其他识别或待核说法 |',
  '|---|---|---|---|',
  ...questions.sort((a,b) => a.outputStartMs-b.outputStartMs).map((item) =>
    `| ${item.id} | ${timestamp(item.outputStartMs)}—${timestamp(item.outputEndMs)} | ${item.retained} | ${item.alternatives.join('；')} |`),
  '', '完整机器、来源和例外证据见同目录 candidate-delivery.v1.json。正式渲染、发布包晋级与公开发布均未授权。', '',
].join('\n');
write(`${output}/小样观看与核对清单.md`, checklist);
receipt.reviewChecklist = await bind(`${output}/小样观看与核对清单.md`);
json(`${output}/candidate-delivery.v1.json`, receipt);
console.log(JSON.stringify({status: receipt.status, video, receipt: await bind(`${output}/candidate-delivery.v1.json`),
  checklist: receipt.reviewChecklist, formalEnabled: false}, null, 2));
