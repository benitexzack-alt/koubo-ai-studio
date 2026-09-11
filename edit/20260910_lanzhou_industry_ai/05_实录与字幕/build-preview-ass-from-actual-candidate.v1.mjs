import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(here, 'host_whisper_small_raw_v1.json');
const reviewPath = path.join(here, 'transcription-review.v1.json');
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(here, '../06_预览与质检/直接剪辑候选_r1/字幕候选_实录ASR_待听校.ass');

const expectedHashes = new Map([
  [rawPath, '27a28f5c5b735f4e9b8fde74ac4fa877e771435579a83b0ac6593b064b6c909b'],
  [reviewPath, '204753ed7298ffc39363500601505ae755aee23a32c4f6956e0f34ed40afe498'],
]);

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const readLockedJson = async (filePath) => {
  const bytes = await fs.readFile(filePath);
  const actual = sha256(bytes);
  const expected = expectedHashes.get(filePath);
  if (actual !== expected) {
    throw new Error(`输入哈希不匹配：${filePath}\nexpected=${expected}\nactual=${actual}`);
  }
  return JSON.parse(bytes.toString('utf8'));
};

const raw = await readLockedJson(rawPath);
const review = await readLockedJson(reviewPath);

const corrections = review.corrections.map(({from, to}) => ({from, to}));

const applyCorrections = (source) => {
  let text = source.trim().replaceAll(/\s+/g, '');
  for (const {from, to} of corrections) text = text.replaceAll(from, to);
  return text;
};

const assTime = (milliseconds) => {
  const centiseconds = Math.max(0, Math.round(milliseconds / 10));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const cs = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
};

const escapeAss = (text) => text
  .replaceAll('\\', '＼')
  .replaceAll('{', '｛')
  .replaceAll('}', '｝');

const wrapSubtitle = (source, maxChars = 18) => {
  const text = escapeAss(source);
  if (text.length <= maxChars) return text;
  const target = Math.ceil(text.length / 2);
  const punctuation = new Set(['，', '。', '、', '；', '：', '？', '！']);
  let split = -1;
  for (let distance = 0; distance <= 6; distance += 1) {
    for (const candidate of [target - distance, target + distance]) {
      if (candidate > 0 && candidate < text.length && punctuation.has(text[candidate - 1])) {
        split = candidate;
        break;
      }
    }
    if (split !== -1) break;
  }
  if (split === -1) split = Math.min(maxChars, target);
  return `${text.slice(0, split)}\\N${text.slice(split)}`;
};

const segments = raw.transcription.map((segment) => ({
  startMs: segment.offsets.from,
  endMs: segment.offsets.to,
  text: applyCorrections(segment.text),
}));

if (segments.length !== 96) {
  throw new Error(`预期96个实录ASR分段，实际${segments.length}`);
}

const durationMs = Math.max(...segments.map(({endMs}) => endMs));
const header = `[Script Info]
Title: 兰州产业AI直接剪辑候选字幕
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,PingFang SC,38,&H00FFFFFF,&H00FFFFFF,&HAA000000,&H78000000,-1,0,0,0,100,100,0,0,1,3,0,2,52,52,48,1
Style: Gate,PingFang SC,20,&H0036D8FF,&H0036D8FF,&HAA000000,&H50000000,-1,0,0,0,100,100,0,0,1,2,0,9,24,24,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

const events = [
  `Dialogue: 1,0:00:00.00,${assTime(durationMs)},Gate,,0,0,0,,候选剪辑｜字幕待听校`,
  ...segments.map(({startMs, endMs, text}) =>
    `Dialogue: 2,${assTime(startMs)},${assTime(endMs)},Default,,0,0,0,,${wrapSubtitle(text)}`,
  ),
];

await fs.mkdir(path.dirname(outputPath), {recursive: true});
await fs.writeFile(outputPath, `${header}\n${events.join('\n')}\n`, 'utf8');

console.log(JSON.stringify({
  status: 'preview-subtitle-candidate-written',
  outputPath,
  outputSha256: sha256(await fs.readFile(outputPath)),
  segmentCount: segments.length,
  correctionsApplied: corrections.length,
  humanAudioReviewRequired: true,
  formalAllowed: false,
}, null, 2));
