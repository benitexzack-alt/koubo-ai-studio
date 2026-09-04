import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const write = (p, content) => {
  const full = path.join(root, p);
  fs.mkdirSync(path.dirname(full), {recursive: true});
  fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n', {flag: 'wx'});
};
const edlPath = '11_指定句剪除_r1/cut-edl.v1.json';
const rawPath = '07_实录与字幕/R01.whisper-small.raw.v1.json';
const edl = read(edlPath);
const raw = read(rawPath);
const before = edl.remove.startFrameInclusive / edl.fps;
const after = edl.remove.endFrameExclusive / edl.fps;
const delta = (edl.remove.endFrameExclusive - edl.remove.startFrameInclusive) / edl.fps;
const sourceEnd = edl.sourceFrames / edl.fps;
const mapTime = (s) => s <= before ? s : s >= after ? s - delta : before;
const frame = (s) => Math.round(s * edl.fps);
const changes = [];
const cues = raw.transcription.map((s, index) => {
  let start = s.offsets.from / 1000;
  let end = s.offsets.to / 1000;
  let text = s.text;
  if (start < after && end > before) {
    assert.equal(text, '没有人驾驶、没有人干预、没有人负责');
    text = '没有人驾驶、没有人干预';
    end = before;
    changes.push({index, before: s.text, after: text, reason: '仅同步已授权且实际剪除的原声短语', evidence: edlPath});
  }
  if (end > sourceEnd) {
    changes.push({index, reason: 'ASR尾段时间超过原片，机械收至媒体结尾；正文不改，仍待复听', previousEnd: end, boundedEnd: sourceEnd});
    end = sourceEnd;
  }
  assert(end > start);
  return {id: `C${String(index + 1).padStart(3, '0')}`, sourceAsrIndex: index,
    sourceStart: start, sourceEnd: end, startFrame: frame(mapTime(start)), endFrameExclusive: frame(mapTime(end)), text,
    reviewStatus: 'unreviewed-asr-not-final-subtitle'};
});
assert.equal(cues.length, raw.transcription.length);
assert(cues.every((c, i) => c.startFrame >= 0 && c.endFrameExclusive <= edl.expectedOutputFrames && c.endFrameExclusive > c.startFrame && (!i || c.startFrame >= cues[i - 1].endFrameExclusive)));
assert(!cues.some(c => c.text.includes('没有人负责')));
const timecode = (f) => {
  const ms = Math.round(f * 1000 / edl.fps);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const captionPath = '07_实录与字幕/剪后261秒_实录ASR待复听.v1.json';
write(captionPath, {schemaVersion: 'local-edit-caption-draft/v1', status: 'timing-rebound-transcript-review-required', authority: 'R01-recorded-audio', scriptRole: 'comparison-only',
  originalVideoSha256: edl.sourceSha256, editedVideoSha256: '5cc1564f54abff9171ba705c11c94f08f52dc7964bb39eddaaa8185b99b00be6',
  edl: {path: edlPath, sha256: sha(edlPath)}, raw: {path: rawPath, sha256: sha(rawPath)}, fps: 30, durationFrames: 7830, changes, cues,
  humanListeningCompleted: false, englishTranslated: false, formalEligible: false});
write('07_实录与字幕/剪后261秒_实录ASR待复听.srt', cues.map((c, i) => `${i + 1}\n${timecode(c.startFrame)} --> ${timecode(c.endFrameExclusive)}\n${c.text}\n`).join('\n'));

const definitions = [
  ['P01', 33.3666666667, 40.3666666667, 7, '从问答到电脑、浏览器和业务软件', ['一问一答', '电脑', '浏览器', '业务软件']],
  ['P02', 46.8333333333, 54.8333333333, 8, '软件操作、搜集、检查后交付', ['业务任务', '操作软件', '排查问题', '交付结果']],
  ['P03', 102.8666666667, 109.8666666667, 7, '传统驾驶中的四种人的职责', ['人开车', '人判断', '人负责', '人决策']],
  ['P04', 136.5333333333, 143.5333333333, 7, '软件商业工作与现实执行的独立对照', ['软件系统', '商业工作', '现实世界', '执行身体']],
  ['P05', 206.7, 213.7, 7, '重复任务与人的决策判断服务经营', ['决策', '判断', '服务', '经营']],
  ['P06', 237.8666666667, 243.8666666667, 6, '四类具体服务工作，不展示承诺结果', ['营销策划', '视觉设计', 'SOP搭建', '数据复盘']],
];
const paperSlots = definitions.map(([id, start, end, seconds, purpose, labels]) => ({id, purpose, labels,
  expectedAsset: `06_用户生成视频/${id}.mp4`, sourceStart: start, sourceEnd: end,
  outputStartFrame: frame(mapTime(start)), outputEndFrameExclusive: frame(mapTime(end)), requestedDurationSeconds: seconds,
  currentStatus: 'awaiting-user-generated-video', speed: 1, freezeExtensionAllowed: false,
  timingBasis: 'raw-asr-coarse-provisional-needs-actual-audio-and-asset-review', sourceTextCueIds: cues.filter(c => c.sourceStart < end && c.sourceEnd > start).map(c => c.id),
  layout: 'full-frame-source-with-brand-progress-captions-only', labelOverlayAllowed: false}));
assert(paperSlots.every(p => p.outputEndFrameExclusive - p.outputStartFrame === p.requestedDurationSeconds * 30));

const receipt = read('00_工程控制/preparation-receipt.v1.json');
const referenceAssets = receipt.assets.filter(a => a.id !== 'R01');
const selections = [
  ['U01', 33.64, 43.96, 27.64, 33.36, '电脑操作与Blender演示', 'U01官方来源补充.md'],
  ['U01', 43.96, 56.84, 54.84, 61.08, '雨衣提案演示，配视觉方案话题', 'U01官方来源补充.md'],
  ['T01', 0, 13, 81.24, 94.24, '车辆外观、登车与座舱；仅官方宣传，不冒充今日路测', '事实核验与待裁决.md'],
  ['T01', 18, 26, 119.08, 127.08, '真实车辆行驶与乘坐画面，不绘制虚构FSD架构', '事实核验与待裁决.md'],
  ['U01', 130.96, 140.20, 190.64, 197.16, '修改雨衣提案背景等软件操作，不当作自动获客证明', 'U01官方来源补充.md'],
];
const broll = selections.map(([assetId, start, end, voiceStart, voiceEnd, purpose, evidence], i) => ({id: `B${i + 1}`, assetId,
  sourceIn: start, sourceOut: end, sourceDurationAvailable: end - start,
  outputStartFrame: frame(mapTime(voiceStart)), outputEndFrameExclusive: frame(mapTime(voiceEnd)),
  purpose, evidence: `03_事实与来源核验/${evidence}`, speed: 1,
  status: 'provisional-source-selection-not-final-cut', sourceInOutNeedsPlaybackReview: true,
  layout: 'aspect-preserved-evidence-stage-with-presenter-lower-right-only-if-unobscured',
  sourceCaptionPolicy: assetId === 'U01' ? '保留内嵌字幕，独立字幕带与人物不得覆盖原字；实际排版待风险帧' : '保持2:1画幅，留边不能拉伸车身',
  sourceAudioPolicy: assetId === 'U01' ? '源声保留在代理，混音增益尚未决定，不得盖住口播' : '源文件无音轨，不伪造现场声音'}));
const layers = [...paperSlots.map(p => ({id: p.id, start: p.outputStartFrame, end: p.outputEndFrameExclusive, type: 'paper'})), ...broll.map(b => ({id: b.id, start: b.outputStartFrame, end: b.outputEndFrameExclusive, type: 'evidence'}))].sort((a, b) => a.start - b.start);
layers.forEach((x, i) => assert(x.start >= 0 && x.end <= 7830 && (!i || x.start >= layers[i - 1].end), `视觉区间重叠:${x.id}`));
const coverage = [];
let cursor = 0;
for (const x of layers) {
  if (cursor < x.start) coverage.push({id: `TALK-${coverage.length + 1}`, start: cursor, end: x.start, type: 'presenter-v8'});
  coverage.push(x); cursor = x.end;
}
if (cursor < 7830) coverage.push({id: 'TALK-END', start: cursor, end: 7830, type: 'presenter-v8'});
assert.equal(coverage.reduce((sum, x) => sum + x.end - x.start, 0), 7830);
const plan = {schemaVersion: 'local-edit-preparation-plan/v1', status: 'assets-and-transcript-review-required', root,
  fps: 30, durationFrames: 7830, durationSeconds: 261, sourceEdl: {path: edlPath, sha256: sha(edlPath)},
  authority: 'R01-recorded-audio-after-only-authorized-cut', captionDraft: {path: captionPath, sha256: sha(captionPath)},
  formalEnabled: false, paperSlots, broll, coverage,
  rules: ['全片原声为主，除指定句不擅自剪掉其他内容', '真人段使用稳定V8，不改共享组件', '纸艺段不叠陌生语义卡，不遮原生纸面文字', '新动效只在真人段或证据说明区小范围测试，不覆盖视频本体', '缺素材不得用末帧冻结或退役纸艺填充'],
  knownLimits: ['94条ASR仍待逐句复听，不是最终中英字幕', '纸艺6段尚未交回，时间点仅粗定位', '官方来源与时间说明不能替代转载和内嵌翻译权利核对', '其他实录绝对化表述待裁决，不用字幕偷改', '未渲染样片或正式片']};
write('04_导演拆解/剪后261秒_素材与镜头对位.v1.json', plan);
write('04_导演拆解/剪后261秒_剪辑准备表.md', `# 剪后261秒剪辑准备表\n\n本轮只同步已授权删句后的时间；以下镜头点位是实录ASR粗定位，待素材和逐句复听确认，不是锁定成片。全片7830帧，30帧/秒；所有时段均已检查不重叠。\n\n## 六段纸艺\n\n|编号|剪后进入|剪后退出|内容|\n|---|---|---|---|\n${paperSlots.map(p => `|${p.id}|${timecode(p.outputStartFrame)}|${timecode(p.outputEndFrameExclusive)}|${p.purpose}|`).join('\n')}\n\n## 已有演示与车辆素材\n\n|素材|源片候选范围（秒）|剪后讲解范围|用途|\n|---|---|---|---|\n${broll.map(b => `|${b.assetId}|${b.sourceIn.toFixed(2)}–${b.sourceOut.toFixed(2)}|${timecode(b.outputStartFrame)}–${timecode(b.outputEndFrameExclusive)}|${b.purpose}|`).join('\n')}\n\n候选范围是供剪辑选择的素材，不强行铺满，不拉速，不循环。U01已有内嵌中英字幕，需要独立字幕带；Tesla T01为2:1，必须保持比例。T02为2024素材，留作备选，本轮主结构不需要它，采用时必须标历史年份。\n\n## 剩余真人段\n\n原声连续，除指定句不删除其他话。所有没有插片的区间已归入真人V8讲解层，共同覆盖261秒；不是空白等待动画。纸艺视频不能被V8信息卡盖住。新动效仅安排在真人或来源说明区域，先看风险帧，不能借测试更换整条风格。\n\n## 字幕\n\n剪后字幕草案已生成在「07_实录与字幕」，保留原始ASR用词并明确标记待复听。仅删除已剪去的短语、按28帧删句重算后半时间、收紧超出原片末尾的最后一句；没有把拍摄稿覆盖上去。英文尚未生成，须从复听后的中文翻译。\n`);

const proxies = [];
for (const a of referenceAssets) {
  assert.equal(sha(a.file), a.sha256, `素材哈希变化:${a.id}`);
  const rel = `08_预览与质检/剪辑代理/${a.id}_960w_源声保留.mp4`;
  const destination = path.join(root, rel);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  const args = ['-hide_banner', '-nostdin', '-v', 'error', '-n', '-i', path.join(root, a.file), '-map', '0:v:0', '-map', '0:a?', '-vf', 'scale=960:-2,setsar=1', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', destination];
  const encode = spawnSync('ffmpeg', args, {encoding: 'utf8'});
  assert.equal(encode.status, 0, encode.stderr);
  const decode = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', destination, '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-'], {encoding: 'utf8'});
  assert.equal(decode.status, 0, decode.stderr);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', destination], {encoding: 'utf8'});
  assert.equal(probe.status, 0, probe.stderr);
  const media = JSON.parse(probe.stdout);
  const video = media.streams.find(s => s.codec_type === 'video');
  const audio = media.streams.filter(s => s.codec_type === 'audio');
  assert.equal(video.width, 960);
  assert.equal(video.width / video.height, a.video.width / a.video.height);
  assert.equal(audio.length, a.audio.length);
  assert(Math.abs(Number(media.format.duration) - a.durationSeconds) < 0.15);
  proxies.push({assetId: a.id, file: rel, sha256: sha(rel), source: {path: a.file, sha256: a.sha256}, sourceAspectPreserved: true,
    sourceAudioTrackRetained: a.audio.length > 0, sourceHasNoAudio: a.audio.length === 0,
    fullDecodeExitCode: decode.status, video, duration: media.format.duration, audio});
  console.log(`代理完成:${a.id}`);
}
write('08_预览与质检/剪辑代理/代理质检回执.v1.json', {status: 'local-proxy-decode-passed-not-final-video', at: new Date().toISOString(), proxies});
write('00_工程控制/manual-preparation-check.v1.json', {status: 'local-preparation-checked', at: new Date().toISOString(), formalEnabled: false,
  editedFrames: 7830, durationSeconds: 261, captionCount: cues.length, allCaptionTimesBounded: true, removedPhraseAbsent: true, transcriptHumanReviewed: false,
  visualCoverageFrames: 7830, visualOverlaps: 0, paperSlots: paperSlots.length, generatedPaperVideos: 0, proxiesFullDecodePassed: proxies.length,
  artifacts: [captionPath, '07_实录与字幕/剪后261秒_实录ASR待复听.srt', '04_导演拆解/剪后261秒_素材与镜头对位.v1.json', '04_导演拆解/剪后261秒_剪辑准备表.md', '04_导演拆解/手工生成_01_六段带字首帧提示词.md', '04_导演拆解/手工生成_02_六段图生视频提示词.md', '08_预览与质检/剪辑代理/代理质检回执.v1.json'].map(p => ({path: p, sha256: sha(p)}))});
console.log('剪后时间轴、素材代理和待复听字幕检查通过；不是正式生产验收。');
