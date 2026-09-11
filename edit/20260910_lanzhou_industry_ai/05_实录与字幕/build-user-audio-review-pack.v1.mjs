import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const productionRoot = path.resolve(dir, '..');
const sourceMedia = path.join(
  productionRoot,
  '01_原始口播/copy_B71E2E7B-29AC-4653-AC9C-9D4A3C3D3AB6.MOV',
);
const smallPath = path.join(dir, 'host_whisper_small_raw_v1.json');
const timelinePath = path.join(dir, 'spoken-timeline.candidate.v1.json');
const outputRoot = path.join(dir, '人工听校包_r1');
const clipsRoot = path.join(outputRoot, 'clips');
const labelsRoot = path.join(outputRoot, 'labels');
const fontPath = '/System/Library/Fonts/STHeiti Light.ttc';
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const expectedHashes = {
  sourceMedia: 'f5469a24278c333c00b4517c853958954a09cce8772a86231197e1966647d98f',
  small: '27a28f5c5b735f4e9b8fde74ac4fa877e771435579a83b0ac6593b064b6c909b',
  timeline: 'be4a59f697cabd520c0219cef782cc7d779fdd129ab2c8633aad9e202ebeefa2',
};
assert.equal(sha256(sourceMedia), expectedHashes.sourceMedia, '真人原视频发生变化');
assert.equal(sha256(smallPath), expectedHashes.small, 'small ASR 输入发生变化');
assert.equal(sha256(timelinePath), expectedHashes.timeline, '实录候选时间轴发生变化');
assert(fs.existsSync(fontPath), '本地中文字体缺失');

const small = JSON.parse(fs.readFileSync(smallPath, 'utf8'));
const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
const captionByBeat = new Map(timeline.captions.map((caption) => [caption.beatId, caption]));

const targets = [
  ['R01', 'B01', '创业封口', '创业风口', '创业封口'],
  ['R02', 'B02', '将为打击', '降维打击', '将为打击'],
  ['R03', 'B02', '技能服务', '既能服务', '技能服务'],
  ['R04', 'B04', '学AI了就要', '学AI了就要', '学AI就要／学AI就得'],
  ['R05', 'B04', '权扔掉', '全扔掉', '权扔掉'],
  ['R06', 'B04', '用程', '用场', '用程'],
  ['R07', 'B05', '咱们就帮本地的老板做内容来说', '咱们就帮本地的老板做内容来说', '咱们就拿帮本地的老板做内容来说'],
  ['R08', 'B07', '规律理顺', '归类理顺', '规律理顺'],
  ['R09', 'B07', '合对', '核对', '合对'],
  ['R10', 'B08', '静国店', '进过店', '静国店／静过电'],
  ['R11', 'B09', '追着报', '追着爆', '追着报'],
  ['R12', 'B10', '这即使', '这既是', '这即使'],
  ['R13', 'B10', '也是懂这个行业的人留出', '也是懂这个行业的人留出', '也给懂这个行业的人留出'],
  ['R14', 'B11', '外地同好', '外地同行', '外地同好'],
  ['R15', 'B12', '远程街要不', '远程接业务', '远程街要不'],
  ['R16', 'B17', '教什么东西', '交什么东西', '教什么东西'],
  ['R17', 'B18', '老板自己也能是', '老板自己也能试', '老板自己也能是'],
  ['R18', 'B18', '比他自己是', '比他自己试', '比他自己是'],
  ['R19', 'B20', '有个交付', '有个交付', '有过交付'],
  ['R20', 'B20', '生意已经做完了', '生意已经做完了', '生意已经做稳了／生意已经做到了'],
  ['R21', 'B21', '你有工作就先在熟悉的业务里面', '你有工作就先在熟悉的业务里面', '你有工作就像在熟悉的业务里面／业务里练'],
  ['R22', 'B21', '交集给老板', '着急给老板', '交集给老板'],
].map(([id, beatId, rawNeedle, candidate, alternatives]) => ({
  id,
  beatId,
  rawNeedle,
  candidate,
  alternatives,
}));

const tokenWindow = (target) => {
  const caption = captionByBeat.get(target.beatId);
  assert(caption, `${target.id} 未找到 ${target.beatId}`);
  const tokens = caption.sourceSmallSegmentIndices.flatMap((segmentIndex) =>
    small.transcription[segmentIndex].tokens.filter((token) => !String(token.text).startsWith('[_')),
  );
  let joined = '';
  const spans = tokens.map((token) => {
    const from = joined.length;
    joined += token.text;
    return {token, from, to: joined.length};
  });
  const needleFrom = joined.indexOf(target.rawNeedle);
  assert(needleFrom >= 0, `${target.id} 找不到原始识别串：${target.rawNeedle}`);
  const needleTo = needleFrom + target.rawNeedle.length;
  const hit = spans.filter((span) => span.to > needleFrom && span.from < needleTo);
  assert(hit.length > 0, `${target.id} 没有命中 token`);
  let startMs = Math.max(caption.startMs, hit[0].token.offsets.from - 700);
  let endMs = Math.min(caption.endMs, hit.at(-1).token.offsets.to + 900);
  if (endMs - startMs < 2400) {
    const extra = 2400 - (endMs - startMs);
    startMs = Math.max(caption.startMs, startMs - Math.floor(extra / 2));
    endMs = Math.min(caption.endMs, endMs + Math.ceil(extra / 2));
  }
  return {caption, startMs, endMs};
};

fs.mkdirSync(clipsRoot, {recursive: true});
fs.mkdirSync(labelsRoot, {recursive: true});
const rendered = [];
for (const target of targets) {
  const {caption, startMs, endMs} = tokenWindow(target);
  const durationMs = endMs - startMs;
  const fileName = `${target.id}_${target.beatId}_候选-${target.candidate.replace(/[／/]/gu, '-')}.mp4`;
  const outputPath = path.join(clipsRoot, fileName);
  assert(!fs.existsSync(outputPath), `听校片段已存在：${outputPath}`);
  const labelPath = path.join(labelsRoot, `${target.id}_${target.beatId}.png`);
  const labelResult = spawnSync(
    'magick',
    [
      '-size', '1280x720', 'xc:none',
      '-fill', '#0b1726e6', '-draw', 'roundrectangle 24,24 1256,126 18,18',
      '-font', fontPath, '-gravity', 'NorthWest',
      '-pointsize', '30', '-fill', '#ffffff', '-annotate', '+48+42',
      `${target.id} ${target.beatId}｜候选：${target.candidate}`,
      '-pointsize', '24', '-fill', '#d9e4ef', '-annotate', '+48+84',
      `对照：${target.alternatives}`,
      labelPath,
    ],
    {stdio: 'inherit'},
  );
  assert.equal(labelResult.status, 0, `${target.id} 听校标签生成失败`);
  const filter = '[0:v]scale=1280:720:flags=lanczos,fps=30[base];[base][1:v]overlay=0:0,format=yuv420p[outv]';
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', (startMs / 1000).toFixed(3),
      '-i', sourceMedia,
      '-loop', '1', '-i', labelPath,
      '-t', (durationMs / 1000).toFixed(3),
      '-filter_complex', filter,
      '-map', '[outv]', '-map', '0:a:0',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2',
      '-movflags', '+faststart',
      outputPath,
    ],
    {stdio: 'inherit'},
  );
  assert.equal(result.status, 0, `${target.id} 听校片段渲染失败`);
  rendered.push({
    ...target,
    captionId: caption.id,
    sourceRangeMs: [startMs, endMs],
    durationMs,
    path: outputPath,
    sha256: sha256(outputPath),
    label: {path: labelPath, sha256: sha256(labelPath)},
  });
}

const concatPath = path.join(outputRoot, 'concat-list.txt');
fs.writeFileSync(
  concatPath,
  `${rendered.map((item) => `file '${item.path.replaceAll("'", "'\\''")}'`).join('\n')}\n`,
  {encoding: 'utf8', flag: 'wx', mode: 0o600},
);
const reelPath = path.join(outputRoot, '实录待听校_22处_本地候选_v1.mp4');
const concatResult = spawnSync(
  'ffmpeg',
  ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', '-movflags', '+faststart', reelPath],
  {stdio: 'inherit'},
);
assert.equal(concatResult.status, 0, '听校合辑拼接失败');

const manifest = {
  schemaVersion: 'koubo-user-audio-review-pack/v1',
  createdAt: new Date().toISOString(),
  status: 'needs-user-audio-review',
  formalAllowed: false,
  authority: 'recorded-media-local-excerpts',
  sourceMedia: {path: sourceMedia, sha256: sha256(sourceMedia)},
  spokenTimeline: {path: timelinePath, sha256: sha256(timelinePath)},
  itemCount: rendered.length,
  items: rendered,
  reel: {path: reelPath, sha256: sha256(reelPath)},
  userDecisionRequired: '逐项确认候选文字，或指出听到的实际说法。',
};
const manifestPath = path.join(outputRoot, '听校清单.v1.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});
console.log(JSON.stringify({ok: true, reelPath, reelSha256: sha256(reelPath), manifestPath, itemCount: rendered.length}, null, 2));
