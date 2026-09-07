import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const out = import.meta.dirname;
const episode = path.resolve(out, '../..');
const repo = path.resolve(out, '../../../..');
const abs = (p) => path.isAbsolute(p) ? p : path.join(repo, p);
const read = (p) => JSON.parse(fs.readFileSync(abs(p), 'utf8'));
const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(abs(p))).digest('hex');
const bind = (p) => ({path: abs(p), sha256: hash(p)});
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const e = (p) => path.join(episode, p);
const sourceCaptions = read(e('09_实录与字幕/actual-bilingual.v1.json'));
const canonical = read(e('09_实录与字幕/canonical-spoken.v1.json'));
const review = read(e('09_实录与字幕/transcription-review.v1.json'));
const layoutPath = e('04_导演拆解/postshoot-preparation-r1/postshoot-layout-preparation.v1.json');
const layout = read(layoutPath);
const intakePath = e('00_工程控制/paper-asset-intake.v1.json');
const intake = read(intakePath);
const visualPath = e('07_预览与质检/paper-intake-r1/visual-review.json');
const visual = read(visualPath);
const taskId = 'task-20260906T154937Z-69f6ebf8';
assert.equal(layout.taskId, taskId);
assert.equal(intake.taskId, taskId);
assert.equal(review.uncertain.length, 13);
assert.equal(canonical.captions.length, sourceCaptions.captions.length);
const fps = 30;
const insertion = {sourceFrame: 69, outputStartFrame: 69, durationInFrames: 244, outputEndFrameExclusive: 313};
const shiftMs = insertion.durationInFrames * 1000 / fps;
const sourceBoundaryMs = insertion.sourceFrame * 1000 / fps;
const outputMs = (ms) => ms < sourceBoundaryMs ? ms : ms + shiftMs;
const outputFrame = (frame) => frame < insertion.sourceFrame ? frame : frame + insertion.durationInFrames;
const host = bind(layout.source.path);
assert.equal(host.sha256, layout.source.sha256);
const newsInfo = layout.sourceSegments.find((s) => s.id === 'U01-news');
const news = bind(newsInfo.source.path);
assert.equal(news.sha256, newsInfo.source.sha256);
const authorization = {
  source: '父任务本轮指令转述的用户决定，不伪称本子任务另行获得逐项听验或视觉验收',
  decision: '本条现有五纸片保留已披露缺陷，不重生不增费用；由父任务修复首次预览入口后出有声全长低清小样。',
  appliesOnlyToTaskId: taskId,
  reportedUserAcceptanceOfDisclosedDefects: true,
  allowedProduct: 'local-full-length-audible-low-resolution-candidate',
  formalAllowed: false, regenerationAllowed: false, additionalCostAllowed: false,
  currentWorkerRenderAllowed: false, commitAllowed: false,
  productionEntryRepairVerifiedHere: false,
  historicalIntakeNotRewritten: true,
};
const captions = sourceCaptions.captions.map((c, i) => {
  const original = canonical.captions[i];
  assert.equal(c.id, original.id);
  assert.equal(c.zh, original.zh);
  assert.equal(c.startMs, original.startMs);
  assert.equal(c.endMs, original.endMs);
  assert(!(c.startMs < sourceBoundaryMs && c.endMs > sourceBoundaryMs), `字幕跨插入点，需要显式分段: ${c.id}`);
  const offset = c.startMs >= sourceBoundaryMs ? shiftMs : 0;
  return {...c, sourceCaptionId: c.id, sourceStartMs: c.startMs, sourceEndMs: c.endMs,
    startMs: c.startMs + offset, endMs: c.endMs + offset,
    outputStartFrame: Math.round((c.startMs + offset) * fps / 1000),
    outputEndFrameExclusive: Math.round((c.endMs + offset) * fps / 1000),
    timeTransform: {kind: 'translation-only', offsetFrames: offset ? 244 : 0, offsetMs: offset},
  };
});
const words = canonical.words.map((w) => {
  assert(!(w.startMs < sourceBoundaryMs && w.endMs > sourceBoundaryMs), `词元跨插入点: ${w.id}`);
  const offset = w.startMs >= sourceBoundaryMs ? shiftMs : 0;
  return {...w, sourceStartMs: w.startMs, sourceEndMs: w.endMs, startMs: w.startMs + offset, endMs: w.endMs + offset,
    start: (w.startMs + offset) / 1000, end: (w.endMs + offset) / 1000,
    sourceTokenReferencesTimebase: 'unchanged-R01-source-time', timebase: 'candidate-output-time'};
});
const drafts = {P01: 111.7, P02: 128.7, P03: 143.64, P04: 173.7, P05: 215.92};
const defectExceptions = [];
const papers = intake.assets.map((asset) => {
  const media = bind(asset.path);
  assert.equal(media.sha256, asset.sha256, `${asset.sceneId}素材已变更`);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=index,codec_type,r_frame_rate,nb_frames,duration:format=duration', '-of', 'json', media.path], {encoding: 'utf8'});
  assert.equal(probe.status, 0, probe.stderr);
  const metadata = JSON.parse(probe.stdout);
  const video = metadata.streams.find((s) => s.codec_type === 'video');
  const [num, den] = video.r_frame_rate.split('/').map(Number);
  assert.equal(Number(video.nb_frames), asset.frame.frameCount);
  const nativeFrames = Number(video.nb_frames);
  const nativeSeconds = nativeFrames * den / num;
  const durationInFrames = Math.ceil(nativeFrames * den * fps / num);
  const sourceStartFrame = Math.round(drafts[asset.sceneId] * fps);
  const outputStartFrame = outputFrame(sourceStartFrame);
  const sourceStartMs = sourceStartFrame * 1000 / fps;
  const outputStartMs = outputStartFrame * 1000 / fps;
  const v = visual.mapping.find((m) => m.sceneId === asset.sceneId);
  const prior = layout.proposedPaperWindows.find((p) => p.sceneId === asset.sceneId);
  const exceptionIds = [];
  for (const risk of v.risks) {
    const samples = risk.timeSamples;
    const localStart = Math.min(...samples);
    const localEnd = Math.min(nativeSeconds, Math.max(...samples) + den / num);
    exceptionIds.push(risk.id);
    defectExceptions.push({id: risk.id, sceneId: asset.sceneId, sourcePath: media.path, sha256: media.sha256,
      sourceRisk: risk, evidence: bind(visualPath), evidencePointer: `mapping.${asset.sceneId}.risks.${risk.id}`,
      localObservedSamplesSeconds: samples,
      localReviewWindowSeconds: {start: localStart, endExclusive: localEnd},
      outputReviewWindow: {startMs: outputStartMs + localStart * 1000, endMs: outputStartMs + localEnd * 1000,
        startFrame: outputStartFrame + Math.floor(localStart * fps), endFrameExclusive: outputStartFrame + Math.ceil(localEnd * fps)},
      intervalPrecision: 'sampled-observation-envelope-not-exact-defect-onset-or-offset',
      disposition: 'disclosed-defect-retained-for-this-local-candidate-only',
      reportedAcceptedByParent: true, defectFixed: false, originalSeverity: risk.severity, formalSatisfied: false});
  }
  return {id: asset.sceneId, beatId: asset.beatId, publicPath: `${asset.sceneId}.mp4`, sourceStartFrame, outputStartFrame, durationInFrames,
    sourceEndFrameExclusive: sourceStartFrame + durationInFrames,
    outputEndFrameExclusive: outputStartFrame + durationInFrames,
    requestedSourceStartSeconds: drafts[asset.sceneId], sourceStartSeconds: sourceStartFrame / fps,
    sourceStartQuantizationErrorMs: sourceStartMs - drafts[asset.sceneId] * 1000,
    outputStartMs, outputEndMs: (outputStartFrame + durationInFrames) * 1000 / fps,
    sourcePath: media.path, sha256: media.sha256, sourceDurationSeconds: nativeSeconds,
    sourceContainerDurationSeconds: Number(metadata.format.duration), sourceVideoFrameCount: nativeFrames,
    sourceVideoFps: {numerator: num, denominator: den}, sourceInFrame: 0, sourceOutFrameExclusive: nativeFrames,
    playbackRate: 1, loop: false, freezeExtensionFrames: 0, trimRequested: false,
    frameCadencePolicy: '按原生PTS以1倍速采样到30fps；24转30的常规显示重采样不算额外冻帧，禁止tpad或末帧延长镜头。',
    outputSlotDurationSeconds: durationInFrames / fps,
    terminalFrameGridOverhangSeconds: durationInFrames / fps - nativeSeconds,
    firstFrameLabelsAlreadyVisible: true, labelPresentationMode: 'contextual-summary',
    firstReadableFrame: 0, wordActionWithin300msSatisfied: false, perWordLabelEntryClaimed: false,
    exactMechanismAsPlanned: false, sceneMeaning: v.object, observedActionSummary: v.change,
    contextBeatIds: prior.contextBeatIds, draftTimingPreserved: true,
    overlappingCaptionIds: captions.filter((c) => c.startMs < (outputStartFrame + durationInFrames) * 1000 / fps && c.endMs > outputStartMs).map((c) => c.id),
    exceptionIds, historicalAcceptance: asset.acceptance,
    candidateDisposition: 'retain-full-native-clip-with-disclosed-exceptions', formalEligible: false,
    machineProbe: metadata,
  };
});
papers.sort((a, b) => a.outputStartFrame - b.outputStartFrame);
for (let i = 1; i < papers.length; i++) assert(papers[i - 1].outputEndFrameExclusive <= papers[i].outputStartFrame);
const timeline = {
  fps, frameIntervalConvention: '[startFrame,endFrameExclusive)',
  sourceDurationInFrames: 8149, sourceDurationSeconds: 8149 / fps,
  durationInFrames: 8393, durationSeconds: 8393 / fps,
  hostSource: host, insertion, shiftAfterInsertionMs: shiftMs,
  hostTimeMapping: 'sourceFrame < 69: outputFrame=sourceFrame; sourceFrame >= 69: outputFrame=sourceFrame+244',
  captionTimeMapping: 'sourceMs < 2300: outputMs=sourceMs; sourceMs >= 2300: outputMs=sourceMs+244000/30',
  frameQuantization: '字幕毫秒先精确平移；需要整数帧时共用边界Math.round，最大半帧取整误差，不按字数分配。',
  segments: [
    {id: 'R01-opening', kind: 'host', sourcePath: host.path, sha256: host.sha256, sourceInFrame: 0, sourceOutFrameExclusive: 69, outputStartFrame: 0, outputEndFrameExclusive: 69, durationInFrames: 69, playbackRate: 1, audioOwner: 'R01'},
    {id: 'U01-news', kind: 'news-insert', sourcePath: news.path, sha256: news.sha256, sourceInFrame: 0, sourceOutFrameExclusive: 243, outputStartFrame: 69, outputEndFrameExclusive: 313, durationInFrames: 244,
      sourceVideoDurationSeconds: 8.1, sourceAudioDurationSeconds: 8.102993, preserveOriginalAudio: true, hostNarrationPaused: true, hostPictureInPicture: false,
      newsOnlyTailPadFrames: 1, padReason: '源视频243帧后保留音轨末尾2.993毫秒，新闻槽尾补1个显示帧；此例外不适用于纸片。',
      captionPolicy: '不生成新闻口播字幕，不将新闻文字伪装为本人实录；源内嵌文字仍随原视频保留。'},
    {id: 'R01-body', kind: 'host', sourcePath: host.path, sha256: host.sha256, sourceInFrame: 69, sourceOutFrameExclusive: 8149, outputStartFrame: 313, outputEndFrameExclusive: 8393, durationInFrames: 8080, playbackRate: 1, audioOwner: 'R01'},
  ],
  papersAreOverlaysNotExtraTimelineInsertions: true,
};
const omitted = layout.omittedFromRecording.find((b) => b.beatId === 'B23' || b.id === 'B23');
assert(omitted, '既有调查未记录B23缺席，不得自造');
const beatBindings = layout.beats.map((b) => ({...b, outputStartFrame: b.sourceStartFrame < 69 ? b.sourceStartFrame : b.sourceStartFrame + 244,
  outputEndFrameExclusive: b.sourceEndFrameExclusive <= 69 ? b.sourceEndFrameExclusive : b.sourceEndFrameExclusive + 244,
  bindingStatus: 'source-asr-layout-remapped-for-candidate-not-formal-postshoot-passed',
  actualCaptionIds: canonical.captions.filter((c) => c.startMs < b.sourceEndFrameExclusive * 1000 / fps && c.endMs > b.sourceStartFrame * 1000 / fps).map((c) => c.id),
}));
const data = {
  schemaVersion: 'koubo-candidate-preview-data/v1', taskId, revisionId: '20260907-lanzhou-ai-services-candidate-preview-r1',
  status: 'output-time-data-ready-with-disclosed-exceptions', formalAllowed: false, renderPerformed: false,
  authority: authorization, canvas: {width: 1920, height: 1080, fps, durationInFrames: 8393},
  inputs: {canonical: bind(e('09_实录与字幕/canonical-spoken.v1.json')), bilingual: bind(e('09_实录与字幕/actual-bilingual.v1.json')),
    transcriptionReview: bind(e('09_实录与字幕/transcription-review.v1.json')), sourceLayout: bind(layoutPath), paperIntake: bind(intakePath), visualReview: bind(visualPath),
    oldPreShootPlan: bind(e('04_导演拆解/v9.1-r2/director-preproduction-plan.v1.json'))},
  captions, words, papers, timeline, beatBindings,
  exceptions: {media: defectExceptions,
    transcription: {status: review.status, humanListeningPerformed: false, userAudioReviewConfirmed: false, formalAllowed: false,
      sourceUncertainUnchanged: true, uncertain: review.uncertain,
      outputRanges: review.uncertain.map((u) => ({id: u.id, sourceStartMs: u.startMs, sourceEndMs: u.endMs, startMs: outputMs(u.startMs), endMs: outputMs(u.endMs), captionIds: u.captionIds}))},
    recordedAbsence: [{...omitted, beatId: 'B23', status: 'recorded-absence', disposition: 'recorded-absence-not-editorial-deletion',
      sourceTimeRange: null, outputTimeRange: null, fabricatedCaptionAdded: false, oldPostshootPassedClaimed: false, evidence: bind(layoutPath)}],
    labelTiming: {mode: 'all-labels-visible-from-native-first-frame-contextual-summary', perWordEntryWithin300msPassed: false, contextualSummaryIsNotWordActionApproval: true},
  },
  honestRebinding: {status: 'candidate-only-output-time-rebinding', historicalR2TaskId: taskId, historicalPostshootPassed: false,
    outputTimeTransformVerifiedByGenerator: true, transcriptUncertaintiesUnchanged: true, noCaptionTextFromPreshoot: true,
    semanticMappingMode: 'contextual-summary-with-preserved-draft-starts', wordActionExactnessVerified: false,
    draftReviewNotes: [
      {paperId: 'P01', note: '111.7秒靠近B11结尾且进入B12，按上下文小结保留；知识库相关实录仍有U04，不宣称逐字精确触发。', adjustmentApplied: false},
      {paperId: 'P03', note: '143.64秒处开始培训段，纸片回顾前一段试用纠错更新，按contextual-summary登记。', adjustmentApplied: false},
      {paperId: 'P05', note: '215.92秒位于任务举例尾部并覆盖后面的业务改善段；更靠前呈现或更贴近流程，但本轮按既有draft不自行改时点。', adjustmentApplied: false},
    ]},
  shotcraftPaths: {request: path.join(out, 'output-match-request.v1.json'), selection: path.join(out, 'output-match-selection.v1.json'), receipt: path.join(out, 'output-match-receipt.v1.json'), validation: path.join(out, 'output-match-validation.v1.json')},
};
assert.equal(timeline.segments.reduce((sum, s) => sum + s.durationInFrames, 0), 8393);
assert.equal(captions.map((c) => c.zh).join(''), sourceCaptions.captions.map((c) => c.zh).join(''));
assert.equal(captions.map((c) => c.en).join(''), sourceCaptions.captions.map((c) => c.en).join(''));
assert.deepEqual(data.exceptions.transcription.uncertain, review.uncertain);
assert.equal(captions.at(-1).zh, '可以来找我。');
assert(!captions.some((c) => c.startMs < 313000 / fps && c.endMs > 69000 / fps));
write('data.v1.json', data);
write('captions.json', captions);
write('data-validation.v1.json', {status: 'machine-timeline-transform-verified-not-human-accepted', formalAllowed: false,
  data: bind(path.join(out, 'data.v1.json')), captions: captions.length, originalCaptionsUnchanged: true, sourceUncertainCount: review.uncertain.length,
  paperCount: papers.length, sourceFrames: 8149, insertedFrames: 244, outputFrames: 8393,
  noASRRun: true, noRender: true, originalFilesNotWritten: true, paperNativeMediaHashesVerified: true,
  paperFrameGrid: papers.map((p) => ({id: p.id, sourceStartFrame: p.sourceStartFrame, outputStartFrame: p.outputStartFrame, durationInFrames: p.durationInFrames, nativeSeconds: p.sourceDurationSeconds, freezeExtensionFrames: 0}))});
console.log(JSON.stringify({dataPath: path.join(out, 'data.v1.json'), captions: captions.length, papers: papers.map((p) => ({id: p.id, sourceStartFrame: p.sourceStartFrame, outputStartFrame: p.outputStartFrame, durationInFrames: p.durationInFrames})), durationInFrames: 8393, formalAllowed: false}, null, 2));
