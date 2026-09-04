import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const bind = (p) => ({path: p, sha256: hash(p)});
const write = (p, data) => fs.writeFileSync(path.join(root, p), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
const now = new Date().toISOString();
const previousPlan = '04_导演拆解/剪后261秒_素材与镜头对位.v1.json';
const reviewPath = '08_预览与质检/官方素材入出点复核/选段建议.v1.json';
const captionsPath = '07_实录与字幕/中英字幕准备稿_待复听.v2.json';
const plan = read(previousPlan);
const review = read(reviewPath);
const captions = read(captionsPath);
plan.schemaVersion = 'local-edit-preparation-plan/v2';
plan.previousPlan = bind(previousPlan);
plan.visualSelectionReview = bind(reviewPath);
plan.captionDraft = bind(captionsPath);
plan.deferredBroll = plan.broll.filter(s => ['B2', 'B5'].includes(s.id)).map(s => ({...s,
  status: 'not-in-current-placement-plan',
  reason: s.id === 'B2' ? '抽帧包含指令与加载页，不是完成视觉方案；原槽大部分讲数据与SOP，暂回真人。' : '原范围混入游戏和预订，缩短范围也不能覆盖SOP和数据语义；保留备选，暂回真人。',
  alternativeSourceCandidate: review.shots.find(r => r.id === s.id).recommendedRange,
}));
plan.broll = plan.broll.filter(s => !['B2', 'B5'].includes(s.id)).map(s => {
  const r = review.shots.find(r => r.id === s.id);
  return {...s, sourceIn: r.recommendedRange.in, sourceOut: r.recommendedRange.outExclusive,
    sourceDurationAvailable: r.durationSeconds, status: 'still-reviewed-continuous-playback-pending',
    observedObjects: r.observedObjects, notEstablished: r.notEstablished,
    layout: s.assetId === 'U01' ? 'full-aspect-evidence-with-external-caption-band-no-presenter-inset' : s.layout,
    freezeExtensionAllowed: false};
});
const inserts = [...plan.paperSlots.map(s => ({id: s.id, start: s.outputStartFrame, end: s.outputEndFrameExclusive, type: 'paper'})),
  ...plan.broll.map(s => ({id: s.id, start: s.outputStartFrame, end: s.outputEndFrameExclusive, type: 'evidence'}))].sort((a, b) => a.start - b.start);
plan.coverage = [];
let cursor = 0;
for (const s of inserts) {
  assert(s.start >= cursor && s.end > s.start && s.end <= plan.durationFrames);
  if (s.start > cursor) plan.coverage.push({id: `TALK-${cursor}`, start: cursor, end: s.start, type: 'presenter-v8'});
  plan.coverage.push(s);
  cursor = s.end;
}
if (cursor < plan.durationFrames) plan.coverage.push({id: 'TALK-END', start: cursor, end: plan.durationFrames, type: 'presenter-v8'});
assert.equal(plan.coverage.reduce((n, s) => n + s.end - s.start, 0), 7830);
assert.deepEqual(plan.paperSlots, read(previousPlan).paperSlots);
assert.equal(captions.captionsTotal, 94);
assert.equal(captions.englishDraftPages, 73);
assert.equal(captions.unresolvedPages, 21);
assert.equal(read('07_实录与字幕/spoken-source-policy.preparation.v2.json').compliance.status, 'pending-audio-review');
plan.knownLimits[0] = '94页字幕草案已有73页英文准备稿；21页疑点未猜译，全部仍待最终实录核对';
plan.preparationOnly = true;
plan.fullSpeedWatched = false;
const planPath = '04_导演拆解/剪后261秒_素材与镜头对位.v2.json';
write(planPath, plan);
write('04_导演拆解/剪辑准备更新.v2.md', '# 剪辑准备更新\n\n本轮只准备，不渲染。原v1保留，新v2仍为待素材及实录复核状态。\n\n- 指定句剪除后仍为261秒、7830帧，未新增内容删剪。\n- 六段纸艺槽位未改，等用户视频回传再绑定实际动作与时长。\n- B1缩至官方片33.64–39.373秒，避开片头和下个案例。\n- B2、B5原插入范围含加载、游戏等不相干画面，先移出配画计划，该段保留真人；素材原件未删除。\n- B3、B4只作为Tesla官方宣传配画，保持完整2:1，不作为今日路测、无制动系统或FSD机制证明。\n- U01带内嵌字幕和演示者，暂不硬叠右下真人；字幕需源画外独立区域，风险帧尚未验证。\n- 来源抽帧审查不等于连续播放、版权许可或事实验收。\n');
const audioPath = '08_预览与质检/口播响度检测_未混音.v1.json';
write(audioPath, {schemaVersion: 'source-audio-measurement/v1', measuredAt: now,
  input: bind('11_指定句剪除_r1/01_口播原片_仅剪除没有人负责_r1.mp4'),
  method: 'ffmpeg loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -', exitCode: 0,
  inputMeasurements: {integratedLUFS: -23.84, truePeakDBTP: -3.92, loudnessRangeLU: 6.4, thresholdLUFS: -34.7},
  analysisFilterOutput: {integratedLUFS: -16.31, truePeakDBTP: -1.5, loudnessRangeLU: 5.3, thresholdLUFS: -27.15, normalizationType: 'dynamic', targetOffset: 0.31},
  appliedToSource: false, renderedMix: false, humanListeningCompleted: false,
  status: 'measurement-only-mix-gain-unassigned',
  next: '纸艺视频到齐后保留原声，逐段测量并可回溯混音，检查人声清晰和真峰值；不继承其他期音量验收。'});
const receiptPath = '00_工程控制/parallel-preparation-receipt.v1.json';
write(receiptPath, {schemaVersion: 'parallel-local-preparation/v1', at: now,
  authority: '用户表示六段纸艺视频正在生成，要求继续其他准备',
  state: 'local-preparation-progress-assets-and-transcript-review-required',
  bindings: [bind(planPath), bind(captionsPath), bind(reviewPath), bind(audioPath), bind('07_实录与字幕/字幕专名修正与待听清单.v2.json')],
  checks: {durationSeconds: 261, frameCount: 7830, coverageContiguous: true, paperSlotsUnchanged: 6, activeBroll: 3, deferredBroll: 2, englishDraftPages: 73, unresolvedPages: 21, sourceAudioMeasured: true},
  userReportedVideoGenerationInProgress: true, receivedVideoCountVerified: null,
  humanListeningCompleted: false, fullSpeedVisualReviewCompleted: false,
  imageGenerationStarted: false, runningHubSubmitted: false, formalRendered: false, published: false});
console.log(JSON.stringify({receipt: receiptPath, sha256: hash(receiptPath), plan: planPath, coverage: 7830, readyForRender: false}));
