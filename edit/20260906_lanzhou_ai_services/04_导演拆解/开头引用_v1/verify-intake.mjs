import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {resolve, relative, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const own = dirname(fileURLToPath(import.meta.url));
const root = resolve(own, '../../../..');
const episode = resolve(root, 'edit/20260906_lanzhou_ai_services');
const qa = resolve(episode, '07_预览与质检/开头引用_v1');
const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const plan = load(resolve(own, 'opening-insert-plan.v1.json'));
for (const binding of [plan.baseDirectorPlan, plan.paperPromptsUnchanged, plan.source]) {
  assert.equal(hash(resolve(root, binding.path)), binding.sha256, binding.path);
}
assert.equal(hash(plan.source.originalPath), plan.source.sha256);
const oldManifestPath = resolve(episode, '00_工程控制/交付清单_SHA256.v3.json');
const old = load(oldManifestPath);
const readme = 'edit/20260906_lanzhou_ai_services/README_先看这里.md';
for (const file of old.files) {
  if (file.path !== readme) assert.equal(hash(resolve(root, file.path)), file.sha256, file.path);
}
const source = resolve(root, plan.source.path);
const run = (bin, args) => {
  const result = spawnSync(bin, args, {encoding: 'utf8', maxBuffer: 10 * 1024 * 1024});
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result;
};
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source]).stdout);
const video = probe.streams.find((stream) => stream.codec_type === 'video');
const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
assert.equal(video.width, 1080);
assert.equal(video.height, 1920);
assert.equal(video.nb_frames, '243');
assert.equal(video.avg_frame_rate, '30/1');
assert.equal(audio.channels, 2);
const decode = run('ffmpeg', ['-v', 'error', '-xerror', '-i', source, '-f', 'null', '-']);
assert.equal(decode.stderr.trim(), '');
const loudness = run('ffmpeg', ['-hide_banner', '-i', source, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-']);
writeFileSync(resolve(qa, '响度检测日志.txt'), loudness.stderr, {flag: 'wx'});
save(resolve(qa, 'ffprobe.v1.json'), probe);
const layout = plan.layoutCandidate;
assert.equal(layout.mainSource.width / layout.mainSource.height, video.width / video.height);
for (const box of [layout.mainSource, layout.synchronizedDetail.destination]) {
  assert(box.x >= 0 && box.y >= 0);
  assert(box.x + box.width <= layout.canvas.width && box.y + box.height <= layout.canvas.height);
}
const crop = layout.synchronizedDetail.sourceRect;
assert(crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= video.width && crop.y + crop.height <= video.height);
assert.equal(crop.width / crop.height, layout.synchronizedDetail.destination.width / layout.synchronizedDetail.destination.height);
const state = load(resolve(episode, '00_工程控制/v9-production-state.v1.json'));
assert.equal(state.gates.formalEnabled, false);
assert.equal(state.currentStage, 'director-prompt-packs-ready');
save(resolve(qa, '素材核验回执.v1.json'), {
  createdAt: new Date().toISOString(), taskId: plan.taskId, addendumId: plan.addendumId,
  status: 'source-technical-check-complete-awaiting-recorded-host',
  sourceSha256: plan.source.sha256, originalEqualsCopy: true,
  fullDecode: {exitCode: decode.status, stderr: decode.stderr},
  video: {width: video.width, height: video.height, frames: Number(video.nb_frames), fps: video.avg_frame_rate, seconds: Number(video.duration), codec: video.codec_name, pixelFormat: video.pix_fmt},
  audio: {codec: audio.codec_name, channels: audio.channels, seconds: Number(audio.duration), sampleRate: Number(audio.sample_rate), integratedLufs: -11.9, truePeakDbtp: -2.0},
  visualInspection: {method: '逐秒联系表与2.8秒全尺寸风险帧目视核对', nativeTextLegible: true, mainSourceUncropped: true, layoutStillOnly: true, realTimeFullWatchCompleted: false},
  speech: {method: '本机whisper.cpp small离线识别', transcriptAccepted: false, reason: '识别仅返回无可靠依据的CC字幕制作字样，不作为字幕或政策讲话证据', externalUpload: false},
  policy: {openingNoticeNumber: '工信厅企业〔2026〕31号', bodyB08NoticeNumber: '工信厅科函〔2026〕414号', separateSources: true, officialNoticeMetadataRead: true, officialAttachmentFullTextRead: false, phraseCrossCheckedWithXinhua: true},
  remaining: ['待真人原片定位B01/B02接缝', '待素材原声音频人工听审与混音接缝确认', '待转载和音乐授权核验', '待拍后Shotcraft匹配和实际应用校验', '待完整低清小样人工确认'],
  preservedBaseFiles: old.files.length - 1, paperPromptHashesUnchanged: true,
  formalEnabled: false, dynamicPreviewRendered: false, published: false,
});
const list = (directory) => readdirSync(directory, {withFileTypes: true}).flatMap((entry) => entry.isDirectory() ? list(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);
const files = [...new Set([...old.files.map((file) => resolve(root, file.path)), oldManifestPath, ...list(own), ...list(qa), source])];
const manifest = {
  ...old, createdAt: new Date().toISOString(), addendumId: plan.addendumId,
  supersedes: [...old.supersedes, '交付清单_SHA256.v3.json'],
  archiveNote: '只新增B01/B02之间的用户新闻插片及开头说明，更新README入口；原始23段、R1/R2合同、5镜提示词和生产状态全部校验不变。历史清单保留。',
  files: files.map((path) => ({path: relative(root, path), sha256: hash(path), bytes: readFileSync(path).length})),
};
const manifestPath = resolve(episode, '00_工程控制/交付清单_SHA256.v4.json');
save(manifestPath, manifest);
for (const file of manifest.files) assert.equal(hash(resolve(root, file.path)), file.sha256);
console.log(JSON.stringify({status: '技术与绑定核验通过，未渲染候选', files: manifest.files.length, manifest: relative(root, manifestPath), sha256: hash(manifestPath)}, null, 2));
