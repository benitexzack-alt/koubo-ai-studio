import fs from 'node:fs';
import path from 'node:path';

const [rawPath, transcriptOut, captionsOut, timelineOut, textOut] = process.argv.slice(2);

if (!rawPath || !transcriptOut || !captionsOut || !timelineOut || !textOut) {
  console.error(
    '用法：node tools/build-waic-v6-timeline.mjs <raw.json> <final-transcript.json> <captions.json> <timeline.json> <transcript.txt>',
  );
  process.exit(1);
}

const fps = 30;
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const sourceWords = (Array.isArray(raw.words) ? raw.words : [])
  .filter((word) => word?.type === 'word' && String(word.text ?? '').trim())
  .map((word) => ({...word, text: String(word.text)}));

const source = {
  factualErrorStart: 153.62,
  factualErrorEnd: 153.76,
  correctionBorrowStart: 111.05,
  correctionBorrowEnd: 111.74,
  duplicateStart: 274.72,
  duplicateEnd: 278.48,
  end: 359.70,
};

const segments = [
  {id: 'main-a', sourceStart: 0, sourceEnd: source.factualErrorStart, kind: 'main'},
  {
    id: 'borrow-not-equal',
    sourceStart: source.correctionBorrowStart,
    sourceEnd: source.correctionBorrowEnd,
    outputDuration: 1,
    wordOffset: 0.03,
    kind: 'borrowed-self-audio',
    note: '用本人后文原声“不等于”修正事实口误；该段由NEOWISE证据页遮盖口型。',
  },
  {
    id: 'main-b',
    sourceStart: source.factualErrorEnd,
    sourceEnd: source.duplicateStart,
    kind: 'main',
  },
  {
    id: 'main-c',
    sourceStart: source.duplicateEnd,
    sourceEnd: source.end,
    kind: 'main',
    note: '删除前一遍重复句，保留第二遍完整表达。',
  },
];

let outputCursor = 0;
for (const segment of segments) {
  segment.outputStart = outputCursor;
  segment.outputEnd =
    outputCursor + (segment.outputDuration ?? segment.sourceEnd - segment.sourceStart);
  segment.duration = segment.outputEnd - segment.outputStart;
  segment.sourceStartFrame = Math.round(segment.sourceStart * fps);
  outputCursor = segment.outputEnd;
}

const totalOutputFrames = Math.round(outputCursor * fps);
let frameCursor = 0;
segments.forEach((segment, index) => {
  segment.fromFrame = frameCursor;
  segment.durationInFrames =
    index === segments.length - 1
      ? totalOutputFrames - frameCursor
      : Math.round(segment.duration * fps);
  frameCursor += segment.durationInFrames;
});

const finalWords = [];
for (const segment of segments) {
  const words = sourceWords.filter(
    (word) => Number(word.start) >= segment.sourceStart && Number(word.start) < segment.sourceEnd,
  );

  for (const word of words) {
    const start =
      segment.outputStart + (segment.wordOffset ?? 0) + (Number(word.start) - segment.sourceStart);
    const end =
      segment.outputStart +
      (segment.wordOffset ?? 0) +
      (Number(word.end ?? word.start) - segment.sourceStart);
    finalWords.push({
      ...word,
      start: Number(start.toFixed(3)),
      end: Number(Math.max(start + 0.01, end).toFixed(3)),
      source_start: word.start,
      source_end: word.end,
      edit_segment: segment.id,
      editorial_correction: segment.kind === 'borrowed-self-audio',
    });
  }
}

const replaceSequence = (from, replacement) => {
  for (let index = 0; index <= finalWords.length - from.length; index += 1) {
    if (!from.every((text, offset) => finalWords[index + offset]?.text === text)) continue;
    const first = finalWords[index];
    const last = finalWords[index + from.length - 1];
    const next = {
      ...first,
      text: replacement,
      end: last.end,
      source_end: last.source_end,
      corrected: true,
    };
    finalWords.splice(index, from.length, next);
    return true;
  }
  return false;
};

const requiredCorrections = [
  {from: ['鸟', '歪', '子'], to: 'NEOWISE'},
  {from: ['马', '泰', '奥', '帕', '兹'], to: '马泰奥·帕兹'},
];
for (const item of requiredCorrections) {
  if (!replaceSequence(item.from, item.to)) {
    throw new Error(`未找到待校正序列：${item.from.join('')}`);
  }
}

for (let index = 0; index < finalWords.length; index += 1) {
  const word = finalWords[index];
  const match = String(word.text).match(/^([。？！])AI$/u);
  if (match) {
    const midpoint = Math.max(word.start + 0.01, word.end - 0.22);
    finalWords.splice(
      index,
      1,
      {...word, text: match[1], end: midpoint, corrected: true},
      {...word, text: 'AI', start: midpoint, corrected: true},
    );
    index += 1;
  }
}

for (let index = 0; index < finalWords.length - 3; index += 1) {
  if (
    finalWords[index].text === '例' &&
    finalWords[index + 1].text === '子' &&
    finalWords[index + 2].text === '一' &&
    finalWords[index + 3].text === '名'
  ) {
    finalWords[index + 1].text = '子：';
    finalWords[index + 1].corrected = true;
  }
}

const pazIndex = finalWords.findIndex((word) => word.text === '马泰奥·帕兹');
if (pazIndex >= 0) {
  finalWords[pazIndex].text = '马泰奥·帕兹，';
  finalWords[pazIndex].corrected = true;
}

const punctuation = /[，。？！；：,.?!;:]/u;
const terminal = /[。？！?!]/u;
const captions = [];
let page = [];

const visibleLength = (words) =>
  words.map((word) => word.text).join('').replace(/[，。？！；：、,.?!;:\s]/gu, '').length;

const flush = () => {
  if (page.length === 0) return;
  const zh = page.map((word) => word.text).join('');
  captions.push({
    startMs: Math.max(0, Math.round(page[0].start * 1000) - 70),
    endMs: Math.round(page[page.length - 1].end * 1000) + 120,
    zh,
    highlights: [],
  });
  page = [];
};

for (const word of finalWords) {
  page.push(word);
  const text = String(word.text);
  const length = visibleLength(page);
  const shouldBreak =
    terminal.test(text) ||
    (punctuation.test(text) && length >= 10);
  if (shouldBreak) flush();
}
flush();

for (let index = 0; index < captions.length; index += 1) {
  const meaningful = captions[index].zh.replace(/[，。？！；：、,.?!;:\s]/gu, '').length;
  if (meaningful >= 4 || index === 0) continue;
  const previous = captions[index - 1];
  if (previous && previous.zh.length + captions[index].zh.length <= 31) {
    previous.zh += captions[index].zh;
    previous.endMs = captions[index].endMs;
    captions.splice(index, 1);
    index -= 1;
  }
}

for (let index = 0; index < captions.length - 1; index += 1) {
  captions[index].endMs = Math.min(captions[index].endMs, captions[index + 1].startMs - 20);
}

const highlightRules = [
  '一万篇地质论文',
  '一条地震波',
  '普通人的工作',
  '机器坏掉之前',
  '叶色、土壤和天气',
  '现场数据',
  '王坚',
  'NEOWISE',
  '潜在新目标',
  '不等于',
  '人工复核',
  '智慧药房',
  '协助',
  '不是把人删除',
  '看什么',
  '什么算异常',
  '能不能信',
  '回到现场',
];

for (const caption of captions) {
  caption.highlights = highlightRules.filter((rule) => caption.zh.includes(rule));
}

const transcriptText = finalWords.map((word) => word.text).join('');
const finalTranscript = {
  ...raw,
  text: transcriptText,
  words: finalWords,
  edit: {
    fps,
    durationSeconds: Number(outputCursor.toFixed(3)),
    durationInFrames: totalOutputFrames,
    segments,
    corrections: [
      '153.62秒处原声把“不等于”说成“是”，使用同一原片111.05—111.74秒本人原声修正，并在前后补静音保持1秒时间窗。',
      '274.72—278.48秒为重复句，删除第一遍，保留第二遍完整表达。',
      '字幕机械校正专名：NEOWISE、马泰奥·帕兹。',
    ],
  },
};

const timeline = {
  schemaVersion: 1,
  videoId: 'WAIC_20260718_talk01_v6',
  fps,
  sourceDurationSeconds: source.end,
  outputDurationSeconds: Number(outputCursor.toFixed(3)),
  outputDurationInFrames: totalOutputFrames,
  segments,
};

for (const target of [transcriptOut, captionsOut, timelineOut, textOut]) {
  fs.mkdirSync(path.dirname(target), {recursive: true});
}

fs.writeFileSync(transcriptOut, `${JSON.stringify(finalTranscript, null, 2)}\n`, 'utf8');
fs.writeFileSync(captionsOut, `${JSON.stringify(captions, null, 2)}\n`, 'utf8');
fs.writeFileSync(timelineOut, `${JSON.stringify(timeline, null, 2)}\n`, 'utf8');
fs.writeFileSync(textOut, `${transcriptText}\n`, 'utf8');

console.log(`成片时长：${timeline.outputDurationSeconds.toFixed(3)} 秒 / ${timeline.outputDurationInFrames} 帧`);
console.log(`最终词级条目：${finalWords.length}`);
console.log(`中文字幕页：${captions.length}`);
console.log(`事实口误修正：${transcriptText.includes('潜在新目标不等于一百五十万个已经逐个确认的新天体') ? '已命中' : '未命中'}`);
console.log(`重复句计数：${(transcriptText.match(/真正干过这一行的人，不是在AI之外/g) ?? []).length}`);
