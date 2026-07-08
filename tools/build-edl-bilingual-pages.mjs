import fs from 'node:fs';
import path from 'node:path';

const [edlPath, transcriptPath, outputPath] = process.argv.slice(2);

if (!edlPath || !transcriptPath || !outputPath) {
  console.error(
    'Usage: node tools/build-edl-bilingual-pages.mjs <edl.json> <transcript.json> <output.json>',
  );
  process.exit(1);
}

const edl = JSON.parse(fs.readFileSync(edlPath, 'utf8'));
const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

const strongPunctuation = /[。？！]/;
const softPunctuation = /[，、；：]/;
const punctuation = /[\s，。？！、：；,.?!:;"“”'‘’]/g;

const visibleLength = (text) => [...String(text).replace(punctuation, '')].length;

const textFixes = [
  [/不扮热点/g, '不蹭热点'],
  [/不搬热点/g, '不蹭热点'],
  [/风口成话/g, '风口神话'],
  [/我用的AI工具/g, '我用AI工具'],
  [/直讲/g, '只讲'],
];

const fixText = (text) => {
  let fixed = String(text).replace(/\s+/g, '');
  for (const [pattern, replacement] of textFixes) {
    fixed = fixed.replace(pattern, replacement);
  }
  return fixed;
};

const translations = new Map([
  ['甘肃开实体店的老板别再被AI忽悠了。', 'Gansu store owners, do not get fooled by AI hype.'],
  ['我是阿超，现在兰州重新创业，', 'I am Achao, restarting my business in Lanzhou.'],
  ['之前做过传统生意，也踩过不少坑，', 'I have done traditional business before and stepped into many traps.'],
  ['所以我看AI从来不聊那些玄乎的概念，', 'So when I look at AI, I do not talk about abstract concepts.'],
  [
    '我只关心一件事，AI到底能不能帮咱们本地的小微企业解决点真的问题？',
    'I only care about one thing: can AI solve real problems for local small businesses?',
  ],
  ['这个账号呢，我不蹭热点，不讲神话，', 'On this account, I do not chase trends or tell myths.'],
  ['我就把AI翻译成咱们老板听得懂、', 'I translate AI into something local owners can understand,'],
  ['用得上，能验证的小动作。', 'use, and verify through small actions.'],
  ['餐饮店怎么做短视频选题？', 'How can restaurants plan short-video topics?'],
  ['家具店怎么写客户话术？', 'How can furniture stores write customer scripts?'],
  ['工厂怎么用AI跟客户跟进？', 'How can factories use AI to follow up with customers?'],
  ['很多老板一听AI就觉得要买系统、', 'Many owners hear AI and immediately think they need systems,'],
  ['招技术，全公司改造。', 'engineers, and a company-wide rebuild.'],
  ['我给的建议呢，刚好相反，小企业用AI，', 'My advice is the opposite. For small businesses using AI,'],
  [
    '第一步真不是买系统，就找一个你每天都在重复又不想亲手做的小事，',
    'the first step is not buying a system. Find one repetitive task you do not want to do by hand.',
  ],
  ['回复客户信息、写朋友圈文案、', 'Replying to customers, writing Moments posts,'],
  ['整理报价、抄客户留言、整理发票截图，', 'organizing quotes, copying customer messages, or sorting invoice screenshots.'],
  ['就挑一件小事让AI先跑一周。', 'Pick one small task and let AI run it for a week.'],
  ['这一周呢，就看三件事：省没省时间？', 'During that week, watch three things: did it save time?'],
  ['漏没漏跟进？', 'Did it miss follow-ups?'],
  ['改一改能不能用？', 'Can it work after a few tweaks?'],
  ['行，咱们就接着优化。', 'If yes, keep optimizing.'],
  ['不行，也别怪AI。', 'If not, do not blame AI first.'],
  ['大概率是你给的资料太乱太少。', 'Most likely, your materials are too messy or too thin.'],
  [
    '接下来，我就从兰州出发，公开记录用AI服务本地企业的全过程。',
    'Next, starting from Lanzhou, I will publicly record the whole process of serving local businesses with AI.',
  ],
  ['做成了，我把方法讲透；做不成，', 'If it works, I will explain the method clearly. If it fails,'],
  ['我把坑说清楚。', 'I will explain the trap clearly.'],
  ['不承诺变现，不造风口神话。', 'No income promises. No manufactured hype story.'],
  [
    '就帮咱们老板把AI从概念落到实打实的业务里。',
    'I just help local owners move AI from concept into real business work.',
  ],
  ['先别追风口，先让AI帮你省下半小时。', 'Do not chase hype first. Let AI save you half an hour first.'],
  [
    '这条视频的文稿、字幕、剪辑也都是我用AI工具Codex辅助完成的。',
    'The script, captions, and editing of this video were also assisted by the AI tool Codex.',
  ],
  ['我不是只讲落地，我自己也先这么干，', 'I am not only talking about landing AI. I am doing it this way myself.'],
  ['这就是我在兰州做AI创业的第一步。', 'This is my first step in doing AI entrepreneurship in Lanzhou.'],
  ['想看我接下来怎么跑？', 'Want to see how I run it next?'],
  ['点个关注，咱们一起踩坑，一起落地。', 'Follow along. We will step into the traps and land this together.'],
]);

const keywordCandidates = [
  '实体店',
  'AI',
  '阿超',
  '兰州',
  '小微企业',
  '真问题',
  '不蹭热点',
  '小动作',
  '餐饮店',
  '家具店',
  '工厂',
  '买系统',
  '小事',
  '一周',
  '省没省时间',
  '漏没漏跟进',
  'AI创业',
  'Codex',
  '半小时',
  '关注',
  '一起落地',
];

const highlightsFor = (text) => keywordCandidates.filter((keyword) => text.includes(keyword)).slice(0, 3);

const words = Array.isArray(transcript.words)
  ? transcript.words.filter((word) => word.type === 'word' && String(word.text ?? '').trim())
  : [];

const mappedWords = [];
let segmentOffset = 0;

for (const range of edl.ranges ?? []) {
  const segmentStart = Number(range.start);
  const segmentEnd = Number(range.end);
  const segmentDuration = segmentEnd - segmentStart;

  for (const word of words) {
    const start = Number(word.start);
    const end = Number(word.end ?? word.start);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      continue;
    }
    if (end < segmentStart || start > segmentEnd) {
      continue;
    }

    const outStart = Math.max(0, Math.max(start, segmentStart) - segmentStart + segmentOffset);
    const outEnd = Math.max(outStart + 0.04, Math.min(end, segmentEnd) - segmentStart + segmentOffset);
    mappedWords.push({
      text: String(word.text),
      startMs: Math.round(outStart * 1000),
      endMs: Math.round(outEnd * 1000),
    });
  }

  segmentOffset += segmentDuration;
}

const pages = [];
let current = [];

const flush = () => {
  if (current.length === 0) {
    return;
  }
  const zh = fixText(current.map((word) => word.text).join(''));
  const en = translations.get(zh);
  if (!en) {
    throw new Error(`Missing English translation for caption page: ${zh}`);
  }
  pages.push({
    startMs: current[0].startMs,
    endMs: current[current.length - 1].endMs,
    zh,
    en,
    highlights: highlightsFor(zh),
  });
  current = [];
};

for (const word of mappedWords) {
  current.push(word);
  const joined = current.map((item) => item.text).join('');
  const len = visibleLength(joined);
  const text = word.text;
  if (strongPunctuation.test(text) || (softPunctuation.test(text) && len >= 12) || len >= 32) {
    flush();
  }
}

flush();

if (pages.length > 0) {
  pages[pages.length - 1].endMs = Math.max(pages[pages.length - 1].endMs, Math.round(segmentOffset * 1000));
}

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${JSON.stringify(pages, null, 2)}\n`);

console.log(`wrote ${pages.length} bilingual caption pages to ${outputPath}`);
console.log(`timeline duration from EDL: ${segmentOffset.toFixed(3)}s`);
