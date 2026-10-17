import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const taskRoot = path.join(projectRoot, 'edit/20260830_ai_product_ip');
const rawPath = path.join(
  taskRoot,
  '05_转写与字幕/AI_PRODUCT_IP_20260830_talk01_whisper-small-v1.json',
);
const sourceVideoPath = path.join(
  taskRoot,
  '01_原片待绑定/copy_DD0D2750-885D-49DB-9ECE-1FEDECDAC9A0.MOV',
);
const lockedScriptPath = path.join(
  taskRoot,
  '00_工程控制/AI产品与个人IP_用户锁定原稿_v1.md',
);
const cleanedPath = path.join(
  taskRoot,
  '05_转写与字幕/AI_PRODUCT_IP_20260830_talk01.actual.cleaned.v1.json',
);
const bilingualPath = path.join(
  projectRoot,
  'remotion/public/data/AI_PRODUCT_IP_20260830.actual.bilingual.v1.json',
);
const textPath = path.join(
  taskRoot,
  '05_转写与字幕/AI_PRODUCT_IP_20260830_talk01.actual.cleaned.v1.txt',
);
const comparisonPath = path.join(
  taskRoot,
  '05_转写与字幕/AI_PRODUCT_IP_20260830_talk01.script-comparison.v1.json',
);

const durationMs = 97_633;

const pages = [
  ['很多人搞错了！', 'A lot of people get this wrong.'],
  ['AI时代，做产品越来越简单，', 'In the AI era, building products keeps getting easier,'],
  ['但是能卖出去的人越来越少。', 'but fewer people can actually sell them.'],
  ['只要是会Vibe Coding，', 'Anyone who knows Vibe Coding'],
  ['谁手里没几个AI工具？', 'already has several AI tools.'],
  ['谁不会搭智能体、跑流程、做自动化？', 'Who cannot build agents, workflows, and automation now?'],
  ['GitHub一扒一堆，', 'GitHub is full of ready-made options.'],
  ['技术门槛已经彻底透明了。', 'The technical barrier has become transparent.'],
  ['AI把所有人的生产能力拉平了，', 'AI has levelled much of our production capacity,'],
  ['技术不再是稀缺资源。', 'so technology is no longer the scarce resource.'],
  ['那为什么很多人技术很强、产品很好，', 'Then why do technically strong people with good products'],
  ['就是变现难？', 'still struggle to monetize?'],
  ['因为现在缺的根本不是产品，', 'Because the real shortage is not products.'],
  ['缺的是信任、曝光、人设和持续交付。', 'It is trust, exposure, identity, and consistent delivery.'],
  ['你能做出来的AI产品，', 'Being able to build an AI product'],
  ['不代表客户敢买单。', 'does not mean a customer will pay for it.'],
  ['客户买的从来不是工具，', 'Customers are never really buying the tool.'],
  ['是你能不能帮他落地、帮他去省钱，', 'They buy whether you can implement it and save them money,'],
  ['能不能获客增收，', 'help them acquire customers and grow revenue,'],
  ['能不能帮他解决真实的问题。', 'and solve a real problem.'],
  ['当下普通人和技术创业者，', 'For ordinary people and technical founders today,'],
  ['唯一的长线赛道只有一个：', 'there is one long-term path:'],
  ['AI加个人IP。', 'AI plus a personal brand.'],
  ['既然能用AI做产品，', 'If you can use AI to build products,'],
  ['那就必须用AI先做自己。', 'you should first use AI to build yourself.'],
  ['你连自己的个人品牌、信任背书都搭建不起来，', 'If you cannot build your own brand and trust signals,'],
  ['AI产品根本没有溢价能力。', 'your AI product has no pricing power.'],
  ['未来AI行业的竞争根本不是工具的竞争，', 'Future competition in AI is not about tools.'],
  ['是商业认知的竞争。', 'It is about business understanding.'],
  ['工具人人可以复制，', 'Anyone can copy a tool,'],
  ['模板人人都可以下载。', 'and anyone can download a template.'],
  ['但对于行业的拆解，', 'But understanding an industry,'],
  ['对于老板的需求的洞察，', 'seeing what business owners truly need,'],
  ['和长期陪跑的落地服务，', 'and delivering long-term implementation support'],
  ['正是任何人复制不走的一个核心壁垒。', 'form a barrier that cannot be copied overnight.'],
  ['技术只是入门，', 'Technology is only the entry point.'],
  ['信任和落地服务才是AI创业的真正终局。', 'Trust and implementation service are the real endgame.'],
  ['听懂的点个关注，', 'Follow if this makes sense to you.'],
  ['我们一起做能落地、能变现的AI实干者。', 'Let us build practical AI work that can deliver and monetize.'],
  ['我是超哥，在兰州AI创业。', 'I am Chao, building an AI venture in Lanzhou.'],
].map(([zh, en]) => ({zh, en}));

const highlightKeywords = [
  '很多人搞错了',
  '做产品越来越简单',
  '卖出去的人越来越少',
  'Vibe Coding',
  'AI工具',
  '智能体',
  '自动化',
  'GitHub',
  '技术门槛',
  '稀缺资源',
  '变现难',
  '信任',
  '曝光',
  '人设',
  '持续交付',
  '客户敢买单',
  '落地',
  '省钱',
  '获客增收',
  '真实的问题',
  'AI加个人IP',
  '个人品牌',
  '信任背书',
  '溢价能力',
  '商业认知',
  '行业的拆解',
  '需求的洞察',
  '长期陪跑',
  '核心壁垒',
  '技术只是入门',
  '信任和落地服务',
  '兰州AI创业',
];

const hashFile = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const normalizeCharacters = (text) =>
  [...String(text)]
    .filter((character) => /[\p{L}\p{N}]/u.test(character))
    .map((character) => character.toLowerCase());

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rawSegments = Array.isArray(raw.transcription) ? raw.transcription : [];
const rawUnits = rawSegments.flatMap((segment, segmentIndex) => {
  const segmentStart = Number(segment.offsets?.from ?? 0);
  const segmentEnd = Number(segment.offsets?.to ?? segmentStart + 20);
  return (segment.tokens ?? []).flatMap((token) => {
    const rawText = String(token.text ?? '');
    if (!rawText || rawText.startsWith('[_')) return [];
    const characters = normalizeCharacters(rawText);
    if (characters.length === 0) return [];
    const tokenStart = Number(token.offsets?.from ?? segmentStart);
    const tokenEnd = Math.max(tokenStart + 20, Number(token.offsets?.to ?? segmentEnd));
    return characters.map((character, index) => ({
      text: character,
      startMs: tokenStart + ((tokenEnd - tokenStart) * index) / characters.length,
      endMs: tokenStart + ((tokenEnd - tokenStart) * (index + 1)) / characters.length,
      confidence: Number.isFinite(Number(token.p)) ? Number(token.p) : null,
      segmentIndex,
    }));
  });
});

const targetCharacters = pages.flatMap((page) => normalizeCharacters(page.zh));
const sourceCharacters = rawUnits.map((unit) => unit.text);
const rows = sourceCharacters.length + 1;
const columns = targetCharacters.length + 1;
const distance = Array.from({length: rows}, () => new Uint16Array(columns));
for (let row = 0; row < rows; row += 1) distance[row][0] = row;
for (let column = 0; column < columns; column += 1) distance[0][column] = column;
for (let row = 1; row < rows; row += 1) {
  for (let column = 1; column < columns; column += 1) {
    const substitution =
      distance[row - 1][column - 1] +
      (sourceCharacters[row - 1] === targetCharacters[column - 1] ? 0 : 1);
    distance[row][column] = Math.min(
      substitution,
      distance[row - 1][column] + 1,
      distance[row][column - 1] + 1,
    );
  }
}

const mapped = Array(targetCharacters.length).fill(null);
let row = sourceCharacters.length;
let column = targetCharacters.length;
while (row > 0 || column > 0) {
  if (
    row > 0 &&
    column > 0 &&
    distance[row][column] ===
      distance[row - 1][column - 1] +
        (sourceCharacters[row - 1] === targetCharacters[column - 1] ? 0 : 1)
  ) {
    mapped[column - 1] = rawUnits[row - 1];
    row -= 1;
    column -= 1;
  } else if (row > 0 && distance[row][column] === distance[row - 1][column] + 1) {
    row -= 1;
  } else {
    column -= 1;
  }
}

let cursor = 0;
while (cursor < mapped.length) {
  if (mapped[cursor]) {
    cursor += 1;
    continue;
  }
  const start = cursor;
  while (cursor < mapped.length && !mapped[cursor]) cursor += 1;
  const end = cursor;
  const previousEnd = start > 0 && mapped[start - 1] ? mapped[start - 1].endMs : 0;
  const nextStart = end < mapped.length && mapped[end] ? mapped[end].startMs : durationMs;
  const available = Math.max(20 * (end - start), nextStart - previousEnd);
  for (let index = start; index < end; index += 1) {
    const offset = index - start;
    mapped[index] = {
      text: targetCharacters[index],
      startMs: previousEnd + (available * offset) / Math.max(1, end - start),
      endMs: previousEnd + (available * (offset + 1)) / Math.max(1, end - start),
      confidence: null,
      segmentIndex: null,
    };
  }
}

let monotonicMs = 0;
const words = targetCharacters.map((text, index) => {
  const unit = mapped[index];
  const startMs = Math.max(monotonicMs, Math.round(unit.startMs));
  const endMs = Math.max(startMs + 20, Math.round(unit.endMs));
  monotonicMs = endMs;
  return {
    text,
    start: startMs / 1000,
    end: endMs / 1000,
    type: 'word',
    speaker_id: 'speaker_0',
    confidence: unit.confidence,
    raw_segment_index: unit.segmentIndex,
  };
});

const bilingual = [];
let characterCursor = 0;
let pageStartMs = Math.round(words[0]?.start * 1000) || 0;
for (const [pageIndex, page] of pages.entries()) {
  characterCursor += normalizeCharacters(page.zh).length;
  const finalWord = words[Math.max(0, characterCursor - 1)];
  const naturalEndMs = Math.round(finalWord.end * 1000);
  const pageEndMs =
    pageIndex === pages.length - 1
      ? durationMs
      : Math.max(pageStartMs + 180, naturalEndMs);
  bilingual.push({
    startMs: pageStartMs,
    endMs: pageEndMs,
    zh: page.zh,
    en: page.en,
    highlights: highlightKeywords.filter((keyword) => page.zh.includes(keyword)),
  });
  pageStartMs = pageEndMs;
}

const transcriptText = pages.map((page) => page.zh).join('');
const cleaned = {
  schema_version: 1,
  source: path.relative(projectRoot, rawPath),
  source_video: path.relative(projectRoot, sourceVideoPath),
  source_video_sha256: hashFile(sourceVideoPath),
  method:
    'whisper.cpp small本机离线词级转写 + 用户锁定稿仅作术语核对 + 实录口语保留 + 全局字符时间映射',
  language: 'zh',
  duration_seconds: durationMs / 1000,
  text: transcriptText,
  words,
  pages: bilingual,
  correction_policy:
    '只修正可由原声上下文和锁定稿共同确认的ASR同音与术语错误；保留实际口语中的“帮他去省钱”“普通人和技术创业者”“工具人人可以复制”等说法，不删除、压缩或重排原声。',
  asr_corrections: [
    {from: '外部coding', to: 'Vibe Coding', type: 'unmistakable-asr-error', basis: '锁定稿术语与上下文'},
    {from: '一巴一堆', to: '一扒一堆', type: 'unmistakable-asr-error', basis: '上下文和同音'},
    {from: '就是变现的', to: '就是变现难', type: 'unmistakable-asr-error', basis: '问句语义和原声上下文'},
    {from: '因为AI想做自己', to: '用AI先做自己', type: 'unmistakable-asr-error', basis: '锁定稿与前后句语义'},
    {from: '一家能力', to: '溢价能力', type: 'unmistakable-asr-error', basis: '商业语境和同音'},
    {from: '技术指示入门', to: '技术只是入门', type: 'unmistakable-asr-error', basis: '同音和句法'},
    {from: '真正中局', to: '真正终局', type: 'unmistakable-asr-error', basis: '锁定稿和同音'},
  ],
};

const comparison = {
  schema_version: 1,
  source_video: path.relative(projectRoot, sourceVideoPath),
  source_sha256: hashFile(sourceVideoPath),
  locked_script: path.relative(projectRoot, lockedScriptPath),
  locked_script_sha256: hashFile(lockedScriptPath),
  policy: '原片实际声音为唯一正文；锁定稿只用于术语与明显ASR错字核对。',
  observed_spoken_variants: [
    '帮他去省钱',
    '当下普通人和技术创业者',
    '工具人人可以复制',
    '模板人人都可以下载',
    '对于行业的拆解',
    '对于老板的需求的洞察',
    '正是任何人复制不走的一个核心壁垒',
  ],
  omitted_core_sections: [],
  repeated_full_sections: [],
  ending_complete: true,
  retake_or_cut_required: false,
  human_full_listen_required: true,
};

for (const targetPath of [cleanedPath, bilingualPath, textPath, comparisonPath]) {
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
}
fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(bilingualPath, `${JSON.stringify(bilingual, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${transcriptText}\n`, 'utf8');
fs.writeFileSync(comparisonPath, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8');

console.log(`原始分段：${rawSegments.length}`);
console.log(`校正字符：${words.length}`);
console.log(`双语字幕页：${bilingual.length}`);
console.log(`全局编辑距离：${distance.at(-1).at(-1)}`);
console.log(`校正转写：${cleanedPath}`);
console.log(`双语字幕：${bilingualPath}`);
