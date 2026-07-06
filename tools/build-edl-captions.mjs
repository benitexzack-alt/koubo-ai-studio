import fs from 'node:fs/promises';
import path from 'node:path';

const [transcriptPath, edlPath, captionsOut, englishOut] = process.argv.slice(2);

if (!transcriptPath || !edlPath || !captionsOut) {
  console.error('用法：node tools/build-edl-captions.mjs 转写.json edl.json 输出captions.json [输出英文captions.json]');
  process.exit(1);
}

const transcript = JSON.parse(await fs.readFile(transcriptPath, 'utf8'));
const edl = JSON.parse(await fs.readFile(edlPath, 'utf8'));
const words = Array.isArray(transcript.words) ? transcript.words : [];
const ranges = Array.isArray(edl.ranges) ? edl.ranges : [];

const replacements = new Map([
  ['繁', '反'],
  ['繁代办清单', '反待办清单'],
]);

const cleanText = (text) => replacements.get(text) ?? text;

const captions = [];
let offset = 0;

for (const range of ranges) {
  const start = Number(range.start);
  const end = Number(range.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    continue;
  }

  for (const word of words) {
    if (!word || word.type === 'spacing') {
      continue;
    }

    const wordStart = Number(word.start);
    const wordEnd = Number(word.end ?? word.start);
    const text = cleanText(String(word.text ?? '').trim());
    if (!text || !Number.isFinite(wordStart) || !Number.isFinite(wordEnd)) {
      continue;
    }

    const center = (wordStart + wordEnd) / 2;
    if (center < start || center > end) {
      continue;
    }

    const mappedStart = Math.max(0, offset + (Math.max(wordStart, start) - start));
    const mappedEnd = Math.max(mappedStart + 0.06, offset + (Math.min(wordEnd, end) - start));
    captions.push({
      text,
      startMs: Math.round(mappedStart * 1000),
      endMs: Math.round(mappedEnd * 1000),
      timestampMs: Math.round(mappedStart * 1000),
      confidence: typeof word.logprob === 'number' ? Math.max(0, Math.min(1, 1 + word.logprob)) : null,
    });
  }

  offset += end - start;
}

const englishByBeat = {
  HOOK_QUESTION: 'What should small businesses do first with AI?',
  HOOK_ANSWER: 'Find one repeated task first.',
  HOOK: 'First, do not buy a system. Find one repeated task.',
  PROBLEM: 'Using AI only in chat does not change how the business runs.',
  OLD_AI: 'Old AI was more like a chatbot.',
  NEW_AI: 'Now it can complete a workflow for you.',
  EXAMPLES: 'Marketing, customer service, replies, and follow-ups can all be assisted.',
  SAFETY_RULE: 'AI does the work. People guard the gate.',
  ANTI_TODO: 'Make an anti-to-do list.',
  ONE_TASK: 'Pick only one task and prepare the business materials.',
  THREE_METRICS: 'Track time saved, fewer missed follow-ups, and whether small tweaks work.',
  ROOT_CAUSE: 'When AI fails, the company information is often not ready.',
  CTA_CLOSE: 'Do not chase hype first. Save one person half an hour first.',
};

const englishCaptions = [];
offset = 0;
for (const range of ranges) {
  const duration = Number(range.end) - Number(range.start);
  const text = englishByBeat[range.beat];
  if (text && Number.isFinite(duration) && duration > 0) {
    englishCaptions.push({
      text,
      startMs: Math.round((offset + 0.2) * 1000),
      endMs: Math.round((offset + duration - 0.2) * 1000),
    });
  }
  offset += duration;
}

await fs.mkdir(path.dirname(captionsOut), {recursive: true});
await fs.writeFile(captionsOut, `${JSON.stringify(captions, null, 2)}\n`, 'utf8');
console.log(`已生成输出时间轴中文 captions：${captions.length} 条 -> ${captionsOut}`);

if (englishOut) {
  await fs.mkdir(path.dirname(englishOut), {recursive: true});
  await fs.writeFile(englishOut, `${JSON.stringify(englishCaptions, null, 2)}\n`, 'utf8');
  console.log(`已生成输出时间轴英文 captions：${englishCaptions.length} 条 -> ${englishOut}`);
}
