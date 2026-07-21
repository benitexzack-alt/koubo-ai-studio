import fs from 'node:fs';

const [transcriptPath, captionsPath] = process.argv.slice(2);

if (!transcriptPath || !captionsPath) {
  console.error(
    '用法：node tools/check-verbatim-caption-sync.mjs <词级转写.json> <双语字幕.json>',
  );
  process.exit(1);
}

const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
const captions = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));

const punctuation = /[\s，。？！、：；,.?!:;"“”'‘’（）()《》【】\[\]·—-]/g;
const corrections = [
  ['这次设计是在帮', '设计师是在帮'],
  ['其实设计是帮', '其实设计师是帮'],
  ['设计的', '设计师的'],
  ['300瓶', '300平'],
  ['500瓶', '500平'],
  ['茶几风', '侘寂风'],
  ['佛西米亚', '波西米亚'],
  ['猛书', '小红书'],
  ['巨像化', '具象化'],
  ['让它去画面出来', '让它还原出来'],
  ['进一身画', '进一步深化'],
  ['搭载', '搭建'],
  ['冻一下', '东一下'],
  ['吸一下', '西一下'],
  ['劈一下', '拼一下'],
  ['文字新的', '文字性的'],
  ['真实新的去展示', '真实地去展示'],
  ['真实新的', '真实性的'],
  ['电影好', '店也好'],
  ['有个猛一个空间', '做成某一个空间'],
  ['不能周围是', '不能作为'],
  ['其中风格', '几种风格'],
  ['比较防撞板', '比如防撞板'],
];

const normalize = (value) => {
  let text = String(value ?? '').replace(punctuation, '').toLowerCase();
  for (const [from, to] of corrections) {
    text = text.replaceAll(from, to);
  }
  return text;
};

const words = Array.isArray(transcript.words)
  ? transcript.words.filter(
      (word) => word.type === 'word' && String(word.text ?? '').trim(),
    )
  : [];

if (words.length === 0) {
  throw new Error('词级转写中没有可用的 words 数组');
}

const audioTextInWindow = (startMs, endMs) => {
  const start = startMs / 1000;
  const end = endMs / 1000;
  return words
    .filter((word) => {
      const midpoint = (Number(word.start) + Number(word.end)) / 2;
      return midpoint >= start && midpoint < end;
    })
    .map((word) => word.text)
    .join('');
};

const lcsLength = (leftValue, rightValue) => {
  const left = [...normalize(leftValue)];
  const right = [...normalize(rightValue)];
  const dp = Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    let previous = 0;
    for (let j = 1; j <= right.length; j += 1) {
      const current = dp[j];
      dp[j] =
        left[i - 1] === right[j - 1]
          ? previous + 1
          : Math.max(dp[j], dp[j - 1]);
      previous = current;
    }
  }

  return dp[right.length];
};

const thresholds = {
  precision: 0.76,
  coverage: 0.34,
  maxDurationMs: 6000,
  maxChineseChars: 34,
};

const failures = [];
const warnings = [];
const metrics = [];

captions.forEach((caption, index) => {
  const audioText = audioTextInWindow(caption.startMs, caption.endMs);
  const captionText = normalize(caption.zh);
  const audioNormalized = normalize(audioText);
  const matched = lcsLength(caption.zh, audioText);
  const precision = captionText.length === 0 ? 0 : matched / captionText.length;
  const coverage = audioNormalized.length === 0 ? 0 : matched / audioNormalized.length;
  const durationMs = caption.endMs - caption.startMs;
  const previous = captions[index - 1];
  const reasons = [];

  if (!caption.zh || !caption.en) reasons.push('缺少中英文字幕');
  if (caption.endMs <= caption.startMs) reasons.push('时间区间无效');
  if (previous && caption.startMs < previous.endMs) reasons.push('与上一页重叠');
  if ([...caption.zh].length > thresholds.maxChineseChars) reasons.push('中文过长');
  if (durationMs > thresholds.maxDurationMs) reasons.push('单页停留过长');
  if (precision < thresholds.precision) reasons.push('字幕贴合度不足');
  if (coverage < thresholds.coverage) reasons.push('音轨覆盖度不足');

  const row = {
    page: index + 1,
    startMs: caption.startMs,
    endMs: caption.endMs,
    precision,
    coverage,
    caption: caption.zh,
    audioText,
    reasons,
  };
  metrics.push(row);

  if (reasons.length > 0) {
    failures.push(row);
  } else if (precision < 0.84 || coverage < 0.44) {
    warnings.push(row);
  }
});

const average = (key) =>
  metrics.reduce((sum, item) => sum + item[key], 0) / Math.max(metrics.length, 1);

for (const item of failures) {
  console.error(
    `FAIL ${String(item.page).padStart(2, '0')} ${(item.startMs / 1000).toFixed(2)}-${(
      item.endMs / 1000
    ).toFixed(2)} precision=${item.precision.toFixed(2)} coverage=${item.coverage.toFixed(
      2,
    )} 原因=${item.reasons.join('、')}\n  字幕：${item.caption}\n  音轨：${item.audioText}`,
  );
}

for (const item of warnings) {
  console.log(
    `WARN ${String(item.page).padStart(2, '0')} precision=${item.precision.toFixed(
      2,
    )} coverage=${item.coverage.toFixed(2)} 字幕="${item.caption}" 音轨="${item.audioText}"`,
  );
}

console.log(
  `字幕页=${metrics.length} 平均贴合度=${average('precision').toFixed(3)} 平均覆盖度=${average(
    'coverage',
  ).toFixed(3)} 失败=${failures.length} 警告=${warnings.length}`,
);

if (failures.length > 0) {
  process.exit(1);
}

console.log('逐页逐字字幕同步检查通过');
