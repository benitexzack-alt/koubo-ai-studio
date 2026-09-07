import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const repo = path.resolve(import.meta.dirname, '../../..');
const episode = path.resolve(import.meta.dirname, '..');
const output = path.join(episode, '04_导演拆解/postshoot-preparation-r1');
fs.mkdirSync(output, {recursive: true});
const bind = relative => ({path: relative, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, relative))).digest('hex')});
const task = 'edit/20260906_lanzhou_ai_services';
const source = bind(`${task}/02_原片/copy_3257E7D6-476D-4668-93F2-0CA1BD79F373.MOV`);
const transcript = bind(`${task}/09_实录与字幕/host_whisper_small_raw_v1.json`);
const raw = JSON.parse(fs.readFileSync(path.join(repo, transcript.path))).transcription;
const fps = 30;
const sourceFrames = 8149;
const insertAtSourceFrame = 69;
// The source audio is 2.993 ms longer than its 243 video frames.
const insertFrames = 244;
const sourceToOutputFrame = f => f < insertAtSourceFrame ? f : f + insertFrames;
const ranges = [
  ['B01', 0, 2.3], ['B02', 2.3, 20.72], ['B03', 20.72, 25.82],
  ['B04', 25.82, 34.68], ['B05', 34.68, 49.72], ['B06', 49.72, 62.8],
  ['B07', 62.8, 69.48], ['B08', 69.48, 82.44], ['B09', 82.44, 86.72],
  ['B10', 86.72, 100.4], ['B11', 100.4, 112], ['B12', 112, 131.84],
  ['B13', 131.84, 143.64], ['B14', 143.64, 158.28], ['B15', 158.28, 165.08],
  ['B16', 165.08, 188.48], ['B17', 188.48, 194.68], ['B18', 194.68, 217.68],
  ['B19', 217.68, 232.8], ['B20', 232.8, 248.44], ['B21', 248.44, 262.52],
  ['B22', 262.52, sourceFrames / fps],
];
const beats = ranges.map(([id, start, end]) => ({
  id, sourceStartFrame: Math.round(start * fps), sourceEndFrameExclusive: Math.round(end * fps),
  outputStartFrame: sourceToOutputFrame(Math.round(start * fps)),
  outputEndFrameExclusive: id === 'B01' ? insertAtSourceFrame : sourceToOutputFrame(Math.round(end * fps)),
  asrSegmentIndexes: raw.flatMap((s, i) => s.offsets.from < end * 1000 && s.offsets.to > start * 1000 ? [i] : []),
  visualClass: id === 'B08' ? 'real-evidence' : 'speaker-with-v8',
  timingPrecision: 'segment-level-provisional-not-word-locked',
}));
beats.forEach((b, i) => assert.equal(b.sourceStartFrame, i ? beats[i - 1].sourceEndFrameExclusive : 0));
assert.equal(beats.reduce((n, b) => n + b.sourceEndFrameExclusive - b.sourceStartFrame, 0), sourceFrames);
const sourceSegments = [
  {id: 'R01-opening', source, sourceInFrame: 0, sourceOutFrameExclusive: 69, outputStartFrame: 0, durationFrames: 69},
  {id: 'U01-news', source: bind(`${task}/06_补充实拍素材/开头引用_v1/stodownload.MP4`), sourceInFrame: 0, sourceOutFrameExclusive: 243, outputStartFrame: 69, durationFrames: insertFrames, audioEndSeconds: 8.102993,
    endPadding: {frames: 1, purpose: '保留源音轨末尾2.993毫秒；仅一个尾帧，不用于延长纸艺或补时'}, preserveOriginalAudio: true, narrationPaused: true},
  {id: 'R01-body', source, sourceInFrame: 69, sourceOutFrameExclusive: sourceFrames, outputStartFrame: 69 + insertFrames, durationFrames: sourceFrames - 69},
];
assert.equal(sourceSegments.reduce((n, s) => n + s.durationFrames, 0), 8393);
const proposedPaperWindows = [
  {sceneId: 'P01', beatId: 'B11', earliestAfterTerm: '企业知识库', proposedSourceStart: 111.7, expectedSeconds: 8, contextBeatIds: ['B10', 'B11', 'B12']},
  {sceneId: 'P02', beatId: 'B12', earliestAfterTerm: '发给客户', proposedSourceStart: 128.7, expectedSeconds: 9, contextBeatIds: ['B12', 'B13']},
  {sceneId: 'P03', beatId: 'B13', earliestAfterTerm: '更新', proposedSourceStart: 143.64, expectedSeconds: 8, contextBeatIds: ['B13', 'B14']},
  {sceneId: 'P04', beatId: 'B16', earliestAfterTerm: '联系', proposedSourceStart: 173.7, expectedSeconds: 8, contextBeatIds: ['B15', 'B16']},
  {sceneId: 'P05', beatId: 'B18', earliestAfterTerm: '决定', proposedSourceStart: 215.92, expectedSeconds: 9, contextBeatIds: ['B18', 'B19']},
].map(s => ({...s, status: 'proposal-only-requires-canonical-transcript-and-material-semantics', speed: 1, freezeExtensionAllowed: false,
  firstFrameLabelsAlreadyVisible: true, reason: '作为紧邻讲解的机制小结；不得虚报标签逐步入场或把动作已落位当成首次显示文字。',
  timingGate: '先核对实录关键词和源片可见动作，若相邻语义窗口不够就重新裁决，不强插'}));
const plan = {
  schemaVersion: 'koubo-postshoot-layout-preparation/v1', status: 'blocked-before-render', at: new Date().toISOString(),
  taskId: 'task-20260906T154937Z-69f6ebf8', preparationId: '20260907-lanzhou-ai-services-postshoot-preparation-r1',
  source, transcript, transcriptStatus: 'local-asr-review-in-progress',
  preproductionPlan: bind(`${task}/04_导演拆解/v9.1-r2/director-preproduction-plan.v1.json`),
  fps, sourceFrames, outputFramesProposed: 8393, outputDurationSecondsProposed: 8393 / fps,
  sourceSegments, beats, proposedPaperWindows,
  omittedFromRecording: [{beatId: 'B23', reason: '本次原片到可以来找我结束，未说预拍稿最后一段；不补回、不同其他句重复绑定。', disposition: 'recorded-absence-not-editorial-deletion', userRerecordRequired: false}],
  opening: {plan: bind(`${task}/04_导演拆解/开头引用_v1/opening-insert-plan.v1.json`), hostInset: false, sourceTextNotHostTranscript: true, fullPortraitVisible: true, synchronizedTitleDetail: true},
  officialEvidence: {beatId: 'B08', sourceManifest: bind(`${task}/03_官方素材/official-source-manifest.v1.json`), presenterSlot1920: {width: 278, height: 278, right: 360, bottom: 202}, originalAudioOwner: 'R01-only', enterFrames: 16, exitFrames: 12},
  gates: {sourceMediaDecoded: true, paperMaterialGatePassed: false, transcriptFinal: false, postshootRebindPassed: false, shotcraftMatched: false, candidateRendered: false, formalEnabled: false, publicationEnabled: false},
  blockers: [
    {code: 'POSTSHOOT_ABSENT_BEAT_UNSUPPORTED', description: '现有重绑验证器不接受预拍B23未实录；不能伪造字幕或keep。'},
    {code: 'BAKED_LABEL_TIMING_UNREPRESENTABLE', description: '首帧全可见与物件后续动作必须分开验；现合同混用，不伪填进入帧。'},
    {code: 'FIRST_CANDIDATE_ENTRY_CYCLE', description: '现有生产V2预览要求已有经人验收的候选；未找到本条通用受控首次候选入口。'},
  ],
  repairAuthorization: 'requested-awaiting-user-response',
};
const destination = path.join(output, 'postshoot-layout-preparation.v1.json');
fs.writeFileSync(destination, `${JSON.stringify(plan, null, 2)}\n`, {flag: 'wx'});
console.log(JSON.stringify({destination, sourceFramesPreserved: sourceFrames, outputFramesProposed: 8393, omittedPreShootBeat: 'B23', status: plan.status}));
