import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const episodeRoot = path.resolve(dir, '..');
const sourceMedia = path.join(
  episodeRoot,
  '01_素材投放区/01_口播原片/copy_00131113-A43E-48CD-B158-AB0CDE2EF8DC 2.MOV',
);
const transcriptionReview = path.join(dir, 'canonical-r1/transcription-review.v1.json');
const outputRoot = path.join(dir, 'review-pack-r1');
const clipsRoot = path.join(outputRoot, 'clips');
const labelsRoot = path.join(outputRoot, 'labels');
const fontPath = '/System/Library/Fonts/STHeiti Light.ttc';

const sha256 = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const expectedHashes = {
  sourceMedia: '33d211f6f4559c0a4358c2f2f931572d2807ea5f8bb2f5c6b73d14755a866567',
  transcriptionReview: '8da444c8e6798989550f4ade33b04d5d13fa7faeb1b438ab8697192481a690f7',
};

assert.equal(sha256(sourceMedia), expectedHashes.sourceMedia, '实录原片已变化');
assert.equal(
  sha256(transcriptionReview),
  expectedHashes.transcriptionReview,
  '实录候选听校记录已变化',
);
assert(fs.existsSync(fontPath), '本地中文字体缺失');
assert(!fs.existsSync(outputRoot), `听辨包已存在：${outputRoot}`);

const targets = [
  {
    id: 'U04',
    beatId: 'B15',
    startSeconds: 149.52,
    endSeconds: 154.92,
    candidates: ['经济地理的重现', '经济地理的重写'],
    shortLabel: '重现 / 重写',
  },
  {
    id: 'U05',
    beatId: 'B19',
    startSeconds: 227.62,
    endSeconds: 232.52,
    candidates: ['被浪费的流量被重新计划', '被浪费的流量被重新激活'],
    shortLabel: '重新计划 / 重新激活',
  },
  {
    id: 'U08',
    beatId: 'B27',
    startSeconds: 305.7,
    endSeconds: 310.48,
    candidates: ['真正需要人类判断的内部', '真正需要人类判断的那部分'],
    shortLabel: '内部 / 那部分',
  },
  {
    id: 'U09',
    beatId: 'B34',
    startSeconds: 385.44,
    endSeconds: 386.46,
    candidates: ['我是超哥，在兰州，也在创业', '我是超哥，在兰州AI创业'],
    shortLabel: '也在创业 / AI创业',
  },
].map((item) => ({
  ...item,
  durationSeconds: Number((item.endSeconds - item.startSeconds).toFixed(3)),
}));

const run = (command, args, failureMessage, options = {}) => {
  const result = spawnSync(command, args, {stdio: 'inherit', ...options});
  assert.equal(result.status, 0, failureMessage);
};

const probe = (file) => {
  const result = spawnSync(
    'ffprobe',
    [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,sample_rate,channels',
      '-of', 'json',
      file,
    ],
    {encoding: 'utf8'},
  );
  assert.equal(result.status, 0, `ffprobe 失败：${file}`);
  return JSON.parse(result.stdout);
};

const verifyMedia = (file, expectedDurationSeconds, toleranceSeconds) => {
  const metadata = probe(file);
  const durationSeconds = Number(metadata.format?.duration);
  assert(Number.isFinite(durationSeconds), `无法读取时长：${file}`);
  assert(
    Math.abs(durationSeconds - expectedDurationSeconds) <= toleranceSeconds,
    `${path.basename(file)} 时长异常：${durationSeconds}s，预期 ${expectedDurationSeconds}s`,
  );
  const streamTypes = new Set((metadata.streams ?? []).map((stream) => stream.codec_type));
  assert(streamTypes.has('video'), `缺少视频流：${file}`);
  assert(streamTypes.has('audio'), `缺少音频流：${file}`);
  run(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'null', '-'],
    `完整解码失败：${file}`,
  );
  return {durationSeconds, streams: metadata.streams};
};

fs.mkdirSync(clipsRoot, {recursive: true});
fs.mkdirSync(labelsRoot, {recursive: true});

const rendered = [];
for (const target of targets) {
  const safeLabel = target.shortLabel.replaceAll('/', '-').replaceAll(' ', '');
  const baseName = `${target.id}_${target.startSeconds.toFixed(3)}-${target.endSeconds.toFixed(3)}_${safeLabel}`;
  const labelPath = path.join(labelsRoot, `${baseName}.png`);
  const outputPath = path.join(clipsRoot, `${baseName}.mp4`);

  run(
    'magick',
    [
      '-size', '1280x720', 'xc:none',
      '-fill', '#0b1726e8', '-draw', 'roundrectangle 24,24 1256,150 18,18',
      '-font', fontPath, '-gravity', 'NorthWest',
      '-pointsize', '30', '-fill', '#ffffff', '-annotate', '+48+42',
      `${target.id} ${target.beatId}｜请以原片声音为准`,
      '-pointsize', '26', '-fill', '#d9e4ef', '-annotate', '+48+92',
      `候选：${target.shortLabel}`,
      labelPath,
    ],
    `${target.id} 中文标签生成失败`,
  );

  run(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', target.startSeconds.toFixed(3), '-i', sourceMedia,
      '-loop', '1', '-i', labelPath,
      '-t', target.durationSeconds.toFixed(3),
      '-filter_complex',
      '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,fps=30[base];[base][1:v]overlay=0:0,format=yuv420p[outv]',
      '-map', '[outv]', '-map', '0:a:0',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2',
      '-movflags', '+faststart',
      outputPath,
    ],
    `${target.id} 听辨片段生成失败`,
  );

  const verification = verifyMedia(outputPath, target.durationSeconds, 0.05);
  rendered.push({
    id: target.id,
    beatId: target.beatId,
    sourceRangeSeconds: [target.startSeconds, target.endSeconds],
    expectedDurationSeconds: target.durationSeconds,
    measuredDurationSeconds: verification.durationSeconds,
    candidates: target.candidates,
    reviewStatus: 'needs-user-audio-review',
    humanListeningPerformed: false,
    userAudioReviewConfirmed: false,
    file: {
      path: outputPath,
      sha256: sha256(outputPath),
      bytes: fs.statSync(outputPath).size,
    },
  });
}

const concatPath = path.join(outputRoot, 'concat-list.txt');
fs.writeFileSync(
  concatPath,
  `${rendered.map((item) => `file '${item.file.path.replaceAll("'", "'\\''")}'`).join('\n')}\n`,
  {encoding: 'utf8', flag: 'wx', mode: 0o600},
);

const reelPath = path.join(outputRoot, '实录待听辨_4处_r1.mp4');
run(
  'ffmpeg',
  [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-c', 'copy', '-movflags', '+faststart',
    reelPath,
  ],
  '听辨合辑拼接失败',
);
const expectedReelDuration = Number(
  targets.reduce((sum, item) => sum + item.durationSeconds, 0).toFixed(3),
);
const reelVerification = verifyMedia(reelPath, expectedReelDuration, 0.2);

const checklistPath = path.join(outputRoot, '听辨清单.md');
const checklistRows = targets.map((target, index) => {
  const clip = rendered[index];
  return [
    `### ${target.id}（${target.startSeconds.toFixed(3)}–${target.endSeconds.toFixed(3)} 秒）`,
    '',
    `- 片段：\`${path.basename(clip.file.path)}\``,
    `- 候选 A：${target.candidates[0]}`,
    `- 候选 B：${target.candidates[1]}`,
    '- 听辨结果：□ A　□ B　□ 都不是（请写出实际说法）',
    '',
  ].join('\n');
});
const checklist = [
  '# 《AI并没有发明新的商业模式》4 处实录听辨清单',
  '',
  '> 唯一判定依据是原片中实际说出的声音；拍摄前文稿和 ASR 只作候选对照。',
  '> 本包尚未经用户听辨，不代表字幕已确认，不解除正式直出门禁。',
  '',
  `合辑：\`${path.basename(reelPath)}\``,
  '',
  ...checklistRows,
].join('\n');
fs.writeFileSync(checklistPath, `${checklist}\n`, {encoding: 'utf8', flag: 'wx', mode: 0o600});

const manifest = {
  schemaVersion: 'koubo-user-audio-review-pack/v1',
  createdAt: new Date().toISOString(),
  episodeId: '20260912_ai_no_new_business_model',
  status: 'needs-user-audio-review',
  formalAllowed: false,
  humanListeningPerformed: false,
  userAudioReviewConfirmed: false,
  authority: 'recorded-media-local-excerpts',
  sourceMedia: {
    path: sourceMedia,
    sha256: sha256(sourceMedia),
    bytes: fs.statSync(sourceMedia).size,
  },
  transcriptionReview: {
    path: transcriptionReview,
    sha256: sha256(transcriptionReview),
  },
  itemCount: rendered.length,
  items: rendered,
  reel: {
    path: reelPath,
    expectedDurationSeconds: expectedReelDuration,
    measuredDurationSeconds: reelVerification.durationSeconds,
    sha256: sha256(reelPath),
    bytes: fs.statSync(reelPath).size,
  },
  checklist: {
    path: checklistPath,
    sha256: sha256(checklistPath),
  },
  userDecisionRequired: '请逐项确认听到的实际说法；未确认前保持原有门禁状态。',
};
const manifestPath = path.join(outputRoot, 'manifest.v1.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});

console.log(JSON.stringify({
  ok: true,
  outputRoot,
  itemCount: rendered.length,
  reel: manifest.reel,
  checklist: manifest.checklist,
  manifestPath,
  manifestSha256: sha256(manifestPath),
}, null, 2));
