import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const write = (p, value) => fs.writeFileSync(path.join(root, p), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx'});
const now = new Date().toISOString();
const previousPath = '04_导演拆解/剪后261秒_素材与镜头对位.v2.json';
const intakePath = '08_预览与质检/纸艺接收_r1/asset-intake.v1.json';
const planPath = '04_导演拆解/剪后261秒_素材与镜头对位.v3.json';
const previous = read(previousPath);
const previousSha = hash(previousPath);
const intake = read(intakePath);
assert.equal(intake.assets.length, 6);
assert.equal(new Set(intake.assets.map((a) => a.mappedSlot)).size, 6);
const plan = structuredClone(previous);
plan.schemaVersion = 'local-edit-preparation-plan/v3';
plan.createdAt = now;
plan.previousPlan = {path: previousPath, sha256: previousSha};
plan.assetIntake = {path: intakePath, sha256: hash(intakePath)};
plan.status = 'assets-mapped-transcript-and-controlled-preview-entry-required';
plan.previewRendered = false;
plan.previewAuthorizedByUser = true;
plan.preparationOnly = true;
plan.formalEnabled = false;
plan.fullSpeedWatched = false;
const table = [];
for (const slot of plan.paperSlots) {
  const a = intake.assets.find((item) => item.mappedSlot === slot.id);
  assert.ok(a, `Missing ${slot.id}`);
  assert.equal(a.fullDecodeExitCode, 0);
  const rel = path.relative(root, a.path);
  assert.ok(!rel.startsWith('..') && !path.isAbsolute(rel));
  assert.equal(hash(rel), a.sha256, `Changed source: ${slot.id}`);
  assert.equal(a.width / a.height, 16 / 9);
  assert.equal(a.fps, 24);
  assert.ok(a.audio.length > 0);
  const audioDuration = Math.max(...a.audio.map((track) => Number(track.duration)));
  assert.ok(Number.isFinite(audioDuration) && audioDuration > 0);
  const oldEnd = slot.outputEndFrameExclusive;
  // A 24 fps source remains at 1x. Last output sample must be inside the source.
  if (slot.id === 'P02') slot.outputEndFrameExclusive = slot.outputStartFrame + Math.ceil(a.durationSeconds * plan.fps);
  if (slot.id === 'P05') slot.outputEndFrameExclusive = slot.outputStartFrame + 165;
  const frameCount = slot.outputEndFrameExclusive - slot.outputStartFrame;
  assert.ok((frameCount - 1) / plan.fps < a.durationSeconds);
  delete slot.expectedAsset;
  slot.asset = {path: rel, sha256: a.sha256, durationSeconds: a.durationSeconds, width: a.width, height: a.height, sourceFps: a.fps};
  slot.videoSourceInSeconds = 0;
  slot.videoSourceOutSeconds = Math.min(frameCount / plan.fps, a.durationSeconds);
  slot.lastOutputSampleSeconds = (frameCount - 1) / plan.fps;
  slot.currentStatus = 'decoded-and-sampled-visual-review-passed-full-speed-review-pending';
  slot.renderEligibility = false;
  slot.retime = 'normal-speed-frame-resampling-only';
  slot.renderedDurationSeconds = frameCount / plan.fps;
  slot.originalPlannedEndFrameExclusive = oldEnd;
  slot.durationAdjustment = slot.id === 'P02'
    ? '源片7.291667秒，覆盖219帧；最后采样7.266667秒仍在源内。余下21帧回真人，不冻结补足8秒。'
    : slot.id === 'P05'
      ? '画面使用前5.5秒，后段完成态回真人继续讲；不改口播，不把源片合理停留当作渲染故障。'
      : '沿用已规划画面时长，源声全长独立保留到真人段。';
  slot.audio = {
    sourcePath: rel, sourceSha256: a.sha256, sourceInSeconds: 0,
    sourceOutSeconds: audioDuration, outputStartFrame: slot.outputStartFrame,
    outputEndSeconds: slot.outputStartFrame / plan.fps + audioDuration,
    retainOriginalTrack: true, preserveFullSourceAudio: true,
    continueUnderPresenterWhenVisualEnds: true, gainApplied: false,
    mixState: 'measured-not-mixed', humanListeningCompleted: false,
    sourceMeasurement: a.loudnessSummary,
  };
  slot.sampleReview = {
    contactSheet: `08_预览与质检/纸艺接收_r1/${a.contactSheet}`,
    contactSheetSha256: hash(`08_预览与质检/纸艺接收_r1/${a.contactSheet}`),
    parentViewed: true, intervalSeconds: 0.5,
    readableLabelsObserved: [...slot.labels], confirmedTypoObserved: false,
    continuousMotionReviewCompleted: false,
    limitations: slot.id === 'P03' ? ['双方向盘是原图既有道具，不当作模型新增错误；仍需用户原速确认可理解性。'] : [],
  };
  table.push(`| ${slot.id} | ${path.basename(rel)} | ${(slot.outputStartFrame / 30).toFixed(3)}–${(slot.outputEndFrameExclusive / 30).toFixed(3)} | ${a.durationSeconds.toFixed(6)} |`);
}
const segments = [
  ...plan.paperSlots.map((s) => ({id: s.id, start: s.outputStartFrame, end: s.outputEndFrameExclusive, type: 'paper'})),
  ...plan.broll.map((s) => ({id: s.id, start: s.outputStartFrame, end: s.outputEndFrameExclusive, type: 'evidence'})),
].sort((a, b) => a.start - b.start);
plan.coverage = [];
let cursor = 0;
for (const segment of segments) {
  assert.ok(segment.start >= cursor && segment.end > segment.start);
  if (segment.start > cursor) plan.coverage.push({id: `TALK-${cursor}`, start: cursor, end: segment.start, type: 'presenter-v8'});
  plan.coverage.push(segment);
  cursor = segment.end;
}
if (cursor < plan.durationFrames) plan.coverage.push({id: 'TALK-END', start: cursor, end: plan.durationFrames, type: 'presenter-v8'});
assert.equal(plan.coverage.reduce((sum, x) => sum + x.end - x.start, 0), 7830);
plan.knownLimits = [
  '6段实际视频已全解码并查看0.5秒间隔联系表，未冒充原速观看或人耳复听。',
  '94页字幕准备稿仍有21页识别疑点，未用拍摄文稿替换实录。',
  '本机有更大模型缓存，但有限环境核查未找到mlx_whisper；没有进行新ASR推理。',
  '本条job、知识上下文、拍后重绑及独立监督交接尚未齐备；受控预览入口未就绪。',
  '其他实录绝对化表述与素材权利待审；仅授权删除的没有人负责一段被剪除。',
  '原声已检测未混音，P01 +0.1dBTP不能据此直接认定有可听削波，混音前须降增益并复核。',
  '未渲染预览、正式成片或发布。',
];
write(planPath, plan);
assert.equal(hash(previousPath), previousSha);
const receiptPath = '00_工程控制/six-paper-intake-preparation.v1.json';
const receipt = {
  schemaVersion: 'six-paper-intake-preparation/v1', createdAt: now,
  taskId: '20260904-gpt6-cybercab', status: plan.status,
  userAuthorization: '视频6个已放好，在文件夹里，抓紧。',
  plan: {path: planPath, sha256: hash(planPath)}, intake: plan.assetIntake,
  previousPlanUnchanged: true, sourceFilesUnchanged: true,
  paperAssets: plan.paperSlots.map((s) => ({id: s.id, ...s.asset})),
  checks: {uniqueMappingCount: 6, fullDecodePassed: 6, parentContactSheetsViewed: 6,
    allOriginalAudioPresent: true, sourceSampleBoundsPassed: true,
    continuousCoverageFrames: 7830, durationSeconds: 261,
    noSyntheticFreezeExtension: true, humanFullSpeedWatched: false, humanAudioReviewed: false},
  sourceReworkRequested: false, previewRendered: false, formalEnabled: false,
  published: false, controlledEntryModified: false, sharedComponentsModified: false,
  remaining: plan.knownLimits,
};
write(receiptPath, receipt);
write('04_导演拆解/素材接收与剪辑准备.v3.md', `# 六段素材已接收，未生成样片\n\n原文件不移动、不覆盖；以实际画面确定编号，不按下载序号盲排。\n\n| 镜头 | 实际文件 | 剪后画面时间（秒） | 源片时长（秒） |\n|---|---|---|---|\n${table.join('\n')}\n\n六段均为2560×1440、24帧、175帧，有音轨，完整解码通过。原声全长在计划中独立保留，画面先切回真人时声音可继续，不截音。未实际混音。\n\nP02使用219个30fps采样点，最后一个采样仍在源片内；不拉慢、不冻结补成8秒。P05画面在5.5秒完成态后回真人；源片末尾近静止不是文件损坏，不要求重新生成。\n\n其余来源入出点沿用v2，只有本条授权的一句删除。V8与新动效不遮纸面原字，正式与预览均未生成。\n\n## 真实待解决项\n\n${plan.knownLimits.map((x) => `- ${x}`).join('\n')}\n\n缺的是执行侧接入与字幕复核，不是用户再次确认开工。不得伪造独立签名、通过状态或用户验收。\n`);
console.log(JSON.stringify({plan: planPath, sha256: hash(planPath), receipt: receiptPath, receiptSha256: hash(receiptPath), status: plan.status}, null, 2));
