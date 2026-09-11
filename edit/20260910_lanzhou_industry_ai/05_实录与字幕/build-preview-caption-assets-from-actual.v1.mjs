import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(here, 'host_whisper_small_raw_v1.json');
const reviewPath = path.join(here, 'transcription-review.v1.json');
const outputRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(here, '../06_预览与质检/直接剪辑候选_r1/字幕图层');
const framesDir = path.join(outputRoot, 'frames');
const concatPath = path.join(outputRoot, 'caption-concat.ffconcat');
const watermarkPath = path.join(outputRoot, 'candidate-watermark.png');
const manifestPath = path.join(outputRoot, 'caption-assets-manifest.v1.json');
const fontPath = '/System/Library/Fonts/STHeiti Medium.ttc';

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

const wrapSubtitle = (source, maxChars = 18) => {
  if (source.length <= maxChars) return source;
  const target = Math.ceil(source.length / 2);
  const punctuation = new Set(['，', '。', '、', '；', '：', '？', '！']);
  let split = -1;
  for (let distance = 0; distance <= 6; distance += 1) {
    for (const candidate of [target - distance, target + distance]) {
      if (candidate > 0 && candidate < source.length && punctuation.has(source[candidate - 1])) {
        split = candidate;
        break;
      }
    }
    if (split !== -1) break;
  }
  if (split === -1) split = Math.min(maxChars, target);
  return `${source.slice(0, split)}\n${source.slice(split)}`;
};

const renderOutlinedText = (outputPath, text, {
  size,
  pointSize,
  color = 'white',
  strokeWidth = '5',
} = {}) => {
  const shared = [
    '-size', size,
    'xc:none',
    '-font', fontPath,
    '-pointsize', String(pointSize),
    '-gravity', 'center',
    '-interline-spacing', '9',
  ];
  execFileSync('magick', [
    ...shared,
    '-fill', 'black',
    '-stroke', 'black',
    '-strokewidth', strokeWidth,
    '-annotate', '+0+0', text,
    '-fill', color,
    '-stroke', 'none',
    '-annotate', '+0+0', text,
    '-depth', '8',
    outputPath,
  ], {stdio: 'inherit'});
};

const segments = raw.transcription.map((segment, index) => ({
  index,
  startMs: segment.offsets.from,
  endMs: segment.offsets.to,
  text: applyCorrections(segment.text),
}));

if (segments.length !== 96) {
  throw new Error(`预期96个实录ASR分段，实际${segments.length}`);
}
for (let index = 1; index < segments.length; index += 1) {
  if (segments[index].startMs !== segments[index - 1].endMs) {
    throw new Error(`字幕时间轴不连续：${index - 1} -> ${index}`);
  }
}

await fs.mkdir(framesDir, {recursive: true});

const concatLines = ['ffconcat version 1.0'];
const frames = [];
for (const segment of segments) {
  const fileName = `caption_${String(segment.index).padStart(3, '0')}.png`;
  const filePath = path.join(framesDir, fileName);
  renderOutlinedText(filePath, wrapSubtitle(segment.text), {
    size: '1150x130',
    pointSize: 40,
  });
  const durationSeconds = (segment.endMs - segment.startMs) / 1000;
  concatLines.push(`file 'frames/${fileName}'`);
  concatLines.push(`duration ${durationSeconds.toFixed(6)}`);
  frames.push({
    index: segment.index,
    file: `frames/${fileName}`,
    startMs: segment.startMs,
    endMs: segment.endMs,
    text: segment.text,
    sha256: sha256(await fs.readFile(filePath)),
  });
}

const blankPath = path.join(framesDir, 'caption_blank.png');
execFileSync('magick', ['-size', '1150x130', 'xc:none', '-depth', '8', blankPath], {
  stdio: 'inherit',
});
concatLines.push("file 'frames/caption_blank.png'");
concatLines.push('duration 0.366667');
concatLines.push("file 'frames/caption_blank.png'");
await fs.writeFile(concatPath, `${concatLines.join('\n')}\n`, 'utf8');

renderOutlinedText(watermarkPath, '候选剪辑｜字幕待听校', {
  size: '330x52',
  pointSize: 21,
  color: '#FFD836',
  strokeWidth: '4',
});

const manifest = {
  schema: 'koubo-preview-caption-assets/v1',
  status: 'candidate-assets-written',
  sourceAuthority: 'actual-recording-asr',
  rawTranscription: {
    path: rawPath,
    sha256: expectedHashes.get(rawPath),
  },
  transcriptionReview: {
    path: reviewPath,
    sha256: expectedHashes.get(reviewPath),
    correctionsApplied: corrections.length,
  },
  output: {
    concatPath,
    watermarkPath,
    frameCount: frames.length,
    timelineEndMs: 336366.667,
  },
  frames,
  humanAudioReviewRequired: true,
  formalAllowed: false,
};
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  status: manifest.status,
  manifestPath,
  concatPath,
  watermarkPath,
  frameCount: frames.length,
  correctionsApplied: corrections.length,
  humanAudioReviewRequired: true,
  formalAllowed: false,
}, null, 2));
