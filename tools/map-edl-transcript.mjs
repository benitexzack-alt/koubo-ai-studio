import fs from 'node:fs';
import path from 'node:path';

const [transcriptPath, edlPath, outputPath] = process.argv.slice(2);

if (!transcriptPath || !edlPath || !outputPath) {
  console.error('用法：node tools/map-edl-transcript.mjs <源转写.json> <edl.json> <输出转写.json>');
  process.exit(1);
}

const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
const edl = JSON.parse(fs.readFileSync(edlPath, 'utf8'));
const sourceWords = Array.isArray(transcript.words) ? transcript.words : [];
const words = [];
let offset = 0;

for (const range of edl.ranges ?? []) {
  const start = Number(range.start);
  const end = Number(range.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error(`EDL 区间无效：${JSON.stringify(range)}`);
  }

  for (const word of sourceWords) {
    const wordStart = Number(word.start);
    const wordEnd = Number(word.end ?? word.start);
    if (!Number.isFinite(wordStart) || !Number.isFinite(wordEnd)) {
      continue;
    }
    const center = (wordStart + wordEnd) / 2;
    if (center < start || center > end) {
      continue;
    }
    words.push({
      ...word,
      start: offset + Math.max(0, wordStart - start),
      end: offset + Math.min(end - start, wordEnd - start),
    });
  }

  offset += end - start;
}

const output = {
  ...transcript,
  sourceTranscript: transcriptPath,
  sourceEdl: edlPath,
  duration: offset,
  words,
};

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`已映射 ${words.length} 个词，输出时长 ${offset.toFixed(3)} 秒：${outputPath}`);
