import fs from 'node:fs';

const [captionsPath, transcriptOutput, pagesOutput] = process.argv.slice(2);

if (!captionsPath || !transcriptOutput || !pagesOutput) {
  console.error(
    '用法：node tools/build-documentary-caption-pages.mjs <词级字幕.json> <输出转写.json> <输出分页字幕.json>',
  );
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(captionsPath, 'utf8')).filter(
  (item) => String(item.text ?? '').trim() && Number.isFinite(item.startMs) && Number.isFinite(item.endMs),
);

const words = source.map((item) => ({
  type: 'word',
  text: item.text,
  start: item.startMs / 1000,
  end: item.endMs / 1000,
  confidence: item.confidence ?? null,
}));

const pages = [];
let current = [];

const flush = () => {
  if (current.length === 0) return;
  pages.push({
    startMs: current[0].startMs,
    endMs: current.at(-1).endMs,
    zh: current.map((item) => item.text).join(''),
    en: '',
    highlights: [],
  });
  current = [];
};

for (const item of source) {
  const previous = current.at(-1);
  const gap = previous ? item.startMs - previous.endMs : 0;
  const text = current.map((entry) => entry.text).join('');
  const duration = current.length > 0 ? item.endMs - current[0].startMs : 0;
  const shouldBreakBefore =
    current.length > 0 &&
    ((gap > 600 && text.length >= 4) || text.length >= 18 || duration > 5500);

  if (shouldBreakBefore) flush();
  current.push(item);

  const pageText = current.map((entry) => entry.text).join('');
  if (pageText.length >= 8 && /[。！？?!]$/.test(pageText)) flush();
}

flush();

if (pages.length >= 2 && pages.at(-1).zh.length < 4) {
  const tail = pages.pop();
  const previous = pages.at(-1);
  previous.endMs = tail.endMs;
  previous.zh += tail.zh;
}

fs.writeFileSync(
  transcriptOutput,
  `${JSON.stringify({language_code: 'zh', words}, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(pagesOutput, `${JSON.stringify(pages, null, 2)}\n`, 'utf8');

console.log(`已生成 ${words.length} 个词级条目和 ${pages.length} 页中文字幕。`);
