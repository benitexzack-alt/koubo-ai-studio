import fs from 'node:fs';

const [transcriptPath, captionsPath, thresholdArg] = process.argv.slice(2);
const threshold = Number(thresholdArg ?? 0.62);

if (!transcriptPath || !captionsPath) {
  console.error(
    'Usage: node tools/check-bilingual-caption-sync.mjs <final-audio-transcript.json> <bilingual-captions.json> [threshold]',
  );
  process.exit(1);
}

const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
const captions = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));

const punctuation = /[\s，。？！、：；,.?!:;"“”'‘’]/g;
const normalize = (text) => String(text ?? '').replace(punctuation, '').toLowerCase();

const words = Array.isArray(transcript.words)
  ? transcript.words.filter((word) => word.type === 'word' && String(word.text ?? '').trim())
  : [];

const audioTextInWindow = (startMs, endMs, padMs = 100) => {
  const start = (startMs - padMs) / 1000;
  const end = (endMs + padMs) / 1000;
  return words
    .filter((word) => Number(word.end) >= start && Number(word.start) <= end)
    .map((word) => word.text)
    .join('');
};

const lcs = (a, b) => {
  const left = [...normalize(a)];
  const right = [...normalize(b)];
  const dp = Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    let prev = 0;
    for (let j = 1; j <= right.length; j += 1) {
      const tmp = dp[j];
      dp[j] = left[i - 1] === right[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }

  return dp[right.length];
};

const score = (captionText, audioText) => {
  const left = normalize(captionText);
  const right = normalize(audioText);
  if (!left && !right) {
    return 1;
  }
  return lcs(left, right) / Math.max(left.length, right.length);
};

const failures = [];
let minScore = 1;

captions.forEach((caption, index) => {
  const audioText = audioTextInWindow(caption.startMs, caption.endMs);
  const currentScore = score(caption.zh, audioText);
  minScore = Math.min(minScore, currentScore);

  console.log(
    `${String(index + 1).padStart(2, '0')} ${(caption.startMs / 1000).toFixed(2)}-${(
      caption.endMs / 1000
    ).toFixed(2)} score=${currentScore.toFixed(2)} 字幕="${caption.zh}" 音轨="${audioText}"`,
  );

  if (currentScore < threshold) {
    failures.push({index: index + 1, score: currentScore, caption: caption.zh, audioText});
  }
});

console.log(`minScore=${minScore.toFixed(2)} threshold=${threshold.toFixed(2)}`);

if (failures.length > 0) {
  console.error(`caption sync check failed: ${failures.length} page(s) below threshold`);
  process.exit(1);
}

console.log('caption sync check passed');
