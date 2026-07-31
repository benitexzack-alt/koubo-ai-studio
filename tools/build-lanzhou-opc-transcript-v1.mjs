import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const rawPath =
  process.argv[2] ??
  path.join(
    projectRoot,
    'edit/20260731_lanzhou_opc/transcripts/LANZHOU_OPC_20260731_talk01_whisper-small-v1.json',
  );
const cleanedPath =
  process.argv[3] ??
  path.join(
    projectRoot,
    'edit/20260731_lanzhou_opc/transcripts/LANZHOU_OPC_20260731_talk01.cleaned.v1.json',
  );
const captionsPath =
  process.argv[4] ??
  path.join(
    projectRoot,
    'remotion/public/data/LANZHOU_OPC_20260731_talk01.captions.v1.json',
  );
const bilingualPath =
  process.argv[5] ??
  path.join(
    projectRoot,
    'remotion/public/data/LANZHOU_OPC_20260731_talk01.bilingual.v1.json',
  );
const textPath =
  process.argv[6] ??
  path.join(
    projectRoot,
    'edit/20260731_lanzhou_opc/transcripts/LANZHOU_OPC_20260731_talk01.cleaned.v1.txt',
  );
const reviewPath =
  process.argv[7] ??
  path.join(
    projectRoot,
    'edit/20260731_lanzhou_opc/transcripts/LANZHOU_OPC_20260731_talk01.script-comparison.v1.json',
  );

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rawSegments = Array.isArray(raw.transcription) ? raw.transcription : [];

// 每段严格对应本机 Whisper 的原声时间窗；只修正识别错误和标点，不删原声。
const correctedSegments = [
  '就在昨天，兰州举办了首届OPC技能交流大会。',
  '如果是兰州本地的朋友，想学AI，想做点跟AI有关的事，网上的信息其实很多。',
  '可真想参与进来，最容易卡在三个问题：去哪里实训，去哪里找同行，去哪里找创业支持。',
  '看到这场大会的现场内容，我感觉到一个很积极的变化。',
  '兰州的AI创业，正在从网上听概念，慢慢变成了一件在本地可以找到入口的事。',
  '现在大家经常讨论，AI真正的大爆发到底开始了没有？',
  '有人看模型，有人看算力，也有人看全世界到底有多少人在用AI。',
  '但对一个普通人来说，我更愿意看一件直接的事。',
  '你所在的城市，有没有地方让你真正学起来、动起手，找到可以一起做事的人？',
  '这次大会，把三个入口摆得更清楚了。',
  '第一个，是实训入口。',
  '太擎OPC实训基地在金城青年创业谷揭牌。',
  '大会现场还安排了智能体的实操。',
  '参训人员跟着流程搭建起了自己的智能体。',
  '这件事最积极的地方，不是大家又听懂了多少概念。',
  '而是AI开始从台上的演讲，走到了参训者手里的电脑和手机上。',
  '一次实操，至少能让人先看见它到底怎么整理资料、做内容、处理方案，自己动过手以后，再判断还缺什么。',
  '这条路就是比只在网上围观清楚得多。',
  '第二个，是协作入口。',
  'AI产学研联盟兰州分会也在金城青年创业谷揭牌。',
  '大会邀请了本地科技企业分享创业经验。',
  '甘肃省广告协会还组织会员企业代表到场。',
  '广告行业为什么会关注这件事情？',
  '因为文案、创意素材、方案整理、新媒体内容，这些工作已经能和AI发生很具体的连接。',
  '我看到的未来方向很具体，AI不会只停留在科技公司。',
  '它会继续进入广告、设计、制造、农业，还有更多的本地企业。',
  '真正懂行业的人和懂AI的人，会有越来越多一起做事的机会。',
  '第三个，是扶持入口。',
  '会上还发布了“OPC创业直通车”专项扶持计划。',
  '它面向创业者、职场从业者和中小微企业。',
  '内容包括政策扶持、技术赋能、实训指导和资源对接。',
  '扶持计划已经发布，但申请条件和后续的运行方式呢，',
  '马上也会提出一些细节。',
  '我先把它看作入口，不提前把入口说成结果。',
  '搭完一个智能体，也不等于已经拥有了一家真正能够经营的OPC。',
  '接下来要看的是公开的细则和真实的项目。',
  '但入口被摆在台面上，已经是一个值得关注的开始。',
  '有实训的地方，有可以连接行业的组织，也有正在公布的创业支持。',
  '对兰州普通人来说，AI不再是北上广深发生的新闻。',
  '你可以从本地开始寻找一个合适自己的位置。',
  '这三个入口，也让我重新理解了OPC。一人公司，不等于一个人关起门来什么都得扛。',
  '组织越轻，越需要外面的实训、同行的协作和一些资源的连接。',
  '刚开始，就先关注实训，把手动起来；有行业经验，就关注联盟和行业交流。',
  '看看自己的经验能和AI接在哪一步。',
  '已经有创业想法，就盯住扶持计划后面的公开细则，再决定自己适不适合参与。',
  '我觉得未来很可能是，公司越来越轻，一个人能调用的工具、伙伴和本地资源却会越来越多。',
  'AI也会一点点地进入本地培训、行业协作、创业服务和日常工作。',
  '当这些入口出现在自己的城市里，普通人就不用一直站在远处看。',
  '实训、协作、创业。',
  '这三个入口，你现在最需要哪一个？',
  '评论区告诉我。',
  '后面我会继续看，兰州这些AI入口，怎么从一场大会慢慢变成大家真正能够参与的一个机会。',
  '我是超哥，在兰州AI创业。',
];

const englishSegments = [
  'Yesterday, Lanzhou hosted its first OPC Skills Exchange Conference.',
  'If you are in Lanzhou and want to learn or work with AI, online information is everywhere.',
  'But three questions stop real participation: where to train, find peers, and find startup support?',
  'After seeing the conference materials, I felt a very positive shift.',
  'AI entrepreneurship in Lanzhou is moving from online concepts toward local access points.',
  'People often ask whether the real AI boom has begun.',
  'Some watch models, some compute, and others global AI adoption.',
  'But for ordinary people, I look at something more direct.',
  'Does your city offer a place to learn, practice, and meet people to work with?',
  'This conference made three access points clearer.',
  'First: training.',
  'The Taiqing OPC Training Base was unveiled at Jincheng Youth Entrepreneurship Valley.',
  'The conference also included hands-on AI agent practice.',
  'Participants followed the process and built their own agents.',
  'The positive part is not how many more concepts people understood.',
  'AI moved from stage talks into the computers and phones in participants’ hands.',
  'One practice session can show how it organizes information, creates content, and handles plans before you judge what is still missing.',
  'That path is much clearer than watching from the sidelines online.',
  'Second: collaboration.',
  'The Lanzhou branch of the AI Industry-Academia-Research Alliance was also unveiled there.',
  'Local technology companies shared their startup experience.',
  'The Gansu Advertising Association also brought member-company representatives.',
  'Why is the advertising industry paying attention?',
  'Copy, creative assets, plans, and new-media content can now connect with AI in concrete ways.',
  'The future direction I see is concrete: AI will not remain only in technology companies.',
  'It will reach advertising, design, manufacturing, agriculture, and more local businesses.',
  'Industry experts and AI practitioners will have more chances to work together.',
  'Third: support.',
  'The conference also launched the OPC Startup Express support program.',
  'It targets entrepreneurs, professionals, and small and medium-sized businesses.',
  'It covers policy, technology, training, and resource support.',
  'The plan has been announced, while application conditions and operating methods',
  'should be detailed further soon.',
  'I treat it as an access point, not as a guaranteed result.',
  'Building one agent does not mean you already have a sustainable OPC business.',
  'What matters next is the public detail and real projects.',
  'Putting the entry point on the table is already a start worth watching.',
  'There is training, industry connection, and startup support.',
  'For people in Lanzhou, AI is no longer just news from China’s largest cities.',
  'You can start locally and find a position that fits you.',
  'These three entry points changed how I see OPC. A one-person company does not mean carrying everything alone.',
  'Light organizations need outside training, peers, and resource connections.',
  'If you are starting, train and get hands-on. If you know an industry, follow alliances and industry exchanges.',
  'See where your experience can connect with AI.',
  'If you have a startup idea, watch the public details and decide if it fits.',
  'Companies may get lighter, while one person can call on more tools, partners, and local resources.',
  'AI will enter local training, collaboration, startup services, and daily work.',
  'With local entry points, ordinary people need not watch from afar.',
  'Training, collaboration, entrepreneurship.',
  'Which of these three do you need most right now?',
  'Tell me in the comments.',
  'I will keep watching how Lanzhou’s AI entry points turn from one conference into opportunities people can truly join.',
  'I am Chao, building an AI venture in Lanzhou.',
];

const highlights = {
  0: ['兰州', '首届OPC技能交流大会'],
  2: ['实训', '同行', '创业支持'],
  4: ['本地', '入口'],
  8: ['学起来', '动起手', '一起做事'],
  9: ['三个入口'],
  10: ['实训入口'],
  11: ['太擎OPC实训基地', '金城青年创业谷'],
  15: ['电脑', '手机'],
  18: ['协作入口'],
  19: ['AI产学研联盟兰州分会'],
  23: ['文案', '创意素材', '方案整理', '新媒体内容'],
  25: ['广告', '设计', '制造', '农业'],
  27: ['扶持入口'],
  28: ['OPC创业直通车'],
  30: ['政策扶持', '技术赋能', '实训指导', '资源对接'],
  33: ['入口', '结果'],
  37: ['实训', '连接行业', '创业支持'],
  40: ['一人公司'],
  42: ['先实训', '行业交流'],
  45: ['工具', '伙伴', '本地资源'],
  48: ['实训', '协作', '创业'],
  49: ['最需要哪一个'],
  52: ['超哥', '兰州AI创业'],
};

const captionPageOverrides = {
  1: [
    {zh: '如果是兰州本地的朋友，想学AI，', en: 'If you are in Lanzhou and want to learn AI,'},
    {zh: '想做点跟AI有关的事，网上的信息其实很多。', en: 'online information about working with AI is everywhere.'},
  ],
  2: [
    {zh: '可真想参与进来，最容易卡在三个问题：', en: 'But three questions stop real participation:'},
    {zh: '去哪里实训，去哪里找同行，去哪里找创业支持。', en: 'where to train, find peers, and find startup support?'},
  ],
  4: [
    {zh: '兰州的AI创业，正在从网上听概念，', en: 'AI entrepreneurship in Lanzhou is moving beyond online concepts,'},
    {zh: '慢慢变成了一件在本地可以找到入口的事。', en: 'toward access points people can find locally.'},
  ],
  6: [
    {zh: '有人看模型，有人看算力，', en: 'Some watch models and some compute,'},
    {zh: '也有人看全世界到底有多少人在用AI。', en: 'while others watch global AI adoption.'},
  ],
  8: [
    {zh: '你所在的城市，有没有地方让你真正学起来、动起手，', en: 'Does your city offer a place to learn and practice,'},
    {zh: '找到可以一起做事的人？', en: 'and meet people to work with?'},
  ],
  16: [
    {zh: '一次实操，至少能让人先看见它到底怎么整理资料、', en: 'One practice session can show how it organizes information,'},
    {zh: '做内容、处理方案，自己动过手以后，再判断还缺什么。', en: 'creates content and handles plans before you judge what is missing.'},
  ],
  23: [
    {zh: '因为文案、创意素材、方案整理、新媒体内容，', en: 'Copy, creative assets, plans, and new-media content'},
    {zh: '这些工作已经能和AI发生很具体的连接。', en: 'can now connect with AI in concrete ways.'},
  ],
  40: [
    {zh: '这三个入口，也让我重新理解了OPC。', en: 'These three entry points changed how I see OPC.'},
    {zh: '一人公司，不等于一个人关起门来什么都得扛。', en: 'A one-person company does not mean carrying everything alone.'},
  ],
  42: [
    {zh: '刚开始，就先关注实训，把手动起来；', en: 'If you are starting, train and get hands-on.'},
    {zh: '有行业经验，就关注联盟和行业交流。', en: 'If you know an industry, follow alliances and industry exchanges.'},
  ],
  44: [
    {zh: '已经有创业想法，就盯住扶持计划后面的公开细则，', en: 'If you have a startup idea, watch the public details,'},
    {zh: '再决定自己适不适合参与。', en: 'then decide whether it fits you.'},
  ],
  45: [
    {zh: '我觉得未来很可能是，公司越来越轻，', en: 'Companies may get lighter,'},
    {zh: '一个人能调用的工具、伙伴和本地资源却会越来越多。', en: 'while one person can call on more tools, partners, and local resources.'},
  ],
  51: [
    {zh: '后面我会继续看，兰州这些AI入口，', en: 'I will keep watching how Lanzhou’s AI entry points'},
    {zh: '怎么从一场大会慢慢变成大家真正能够参与的一个机会。', en: 'turn from one conference into opportunities people can truly join.'},
  ],
};

if (
  rawSegments.length !== correctedSegments.length ||
  rawSegments.length !== englishSegments.length
) {
  throw new Error(
    `段落数量不一致：raw=${rawSegments.length} zh=${correctedSegments.length} en=${englishSegments.length}`,
  );
}

const splitTokenCharacters = (segment) => {
  const units = [];
  for (const token of segment.tokens ?? []) {
    const tokenText = String(token.text ?? '');
    if (!tokenText || tokenText.startsWith('[_')) continue;
    const characters = [...tokenText.replace(/\s+/gu, '')];
    if (characters.length === 0) continue;
    const tokenStart = Number(token.offsets?.from ?? segment.offsets.from);
    const tokenEnd = Math.max(tokenStart + 20, Number(token.offsets?.to ?? tokenStart + 20));
    characters.forEach((character, index) => {
      units.push({
        text: character,
        start: tokenStart + ((tokenEnd - tokenStart) * index) / characters.length,
        end: tokenStart + ((tokenEnd - tokenStart) * (index + 1)) / characters.length,
        probability: Number.isFinite(Number(token.p)) ? Number(token.p) : null,
      });
    });
  }
  return units;
};

const alignCharacters = (rawUnits, correctedText, segmentStart, segmentEnd) => {
  const target = [...correctedText.replace(/\s+/gu, '')];
  const source = rawUnits.map((unit) => unit.text);
  const rows = source.length + 1;
  const columns = target.length + 1;
  const distance = Array.from({length: rows}, () => Array(columns).fill(0));
  for (let row = 0; row < rows; row += 1) distance[row][0] = row;
  for (let column = 0; column < columns; column += 1) distance[0][column] = column;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitution =
        distance[row - 1][column - 1] + (source[row - 1] === target[column - 1] ? 0 : 1);
      distance[row][column] = Math.min(
        substitution,
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
      );
    }
  }

  const mapped = Array(target.length).fill(null);
  let row = source.length;
  let column = target.length;
  while (row > 0 || column > 0) {
    if (
      row > 0 &&
      column > 0 &&
      distance[row][column] ===
        distance[row - 1][column - 1] + (source[row - 1] === target[column - 1] ? 0 : 1)
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
    const blockStart = cursor;
    while (cursor < mapped.length && !mapped[cursor]) cursor += 1;
    const blockEnd = cursor;
    const previousEnd =
      blockStart > 0 && mapped[blockStart - 1] ? mapped[blockStart - 1].end : segmentStart;
    const nextStart = blockEnd < mapped.length && mapped[blockEnd] ? mapped[blockEnd].start : segmentEnd;
    const available = Math.max(20 * (blockEnd - blockStart), nextStart - previousEnd);
    for (let index = blockStart; index < blockEnd; index += 1) {
      const offset = index - blockStart;
      mapped[index] = {
        text: target[index],
        start: previousEnd + (available * offset) / Math.max(1, blockEnd - blockStart),
        end: previousEnd + (available * (offset + 1)) / Math.max(1, blockEnd - blockStart),
        probability: null,
      };
    }
  }

  let monotonicStart = segmentStart;
  return target.map((text, index) => {
    const sourceUnit = mapped[index];
    const start = Math.max(monotonicStart, Math.min(segmentEnd, sourceUnit.start));
    const end = Math.max(start + 20, Math.min(segmentEnd, sourceUnit.end));
    monotonicStart = Math.min(segmentEnd, end);
    return {
      text,
      start: start / 1000,
      end: end / 1000,
      type: 'word',
      speaker_id: 'speaker_0',
      confidence: sourceUnit.probability,
      corrected: source[index] !== text,
      segment_index: null,
    };
  });
};

const words = [];
const segments = [];
const bilingual = [];

rawSegments.forEach((segment, segmentIndex) => {
  const startMs = Number(segment.offsets?.from ?? 0);
  const endMs = Number(segment.offsets?.to ?? startMs + 1);
  const correctedText = correctedSegments[segmentIndex];
  const alignedWords = alignCharacters(
    splitTokenCharacters(segment),
    correctedText,
    startMs,
    endMs,
  ).map((word) => ({...word, segment_index: segmentIndex}));

  words.push(...alignedWords);
  segments.push({
    index: segmentIndex,
    startMs,
    endMs,
    text: correctedText,
    raw_text: String(segment.text ?? ''),
  });

  const pageOverride = captionPageOverrides[segmentIndex];
  if (!pageOverride) {
    bilingual.push({
      startMs,
      endMs,
      zh: correctedText,
      en: englishSegments[segmentIndex],
      highlights: highlights[segmentIndex] ?? [],
    });
    return;
  }

  const reconstructed = pageOverride.map((page) => page.zh).join('');
  if (reconstructed !== correctedText) {
    throw new Error(
      `字幕拆页与校正文不一致：segment=${segmentIndex} expected=${correctedText} actual=${reconstructed}`,
    );
  }

  let characterCursor = 0;
  let pageStartMs = startMs;
  pageOverride.forEach((page, pageIndex) => {
    characterCursor += [...page.zh.replace(/\s+/gu, '')].length;
    const lastCharacter = alignedWords[Math.max(0, characterCursor - 1)];
    const pageEndMs =
      pageIndex === pageOverride.length - 1
        ? endMs
        : Math.max(pageStartMs + 120, Math.round(lastCharacter.end * 1000));
    bilingual.push({
      startMs: pageStartMs,
      endMs: pageEndMs,
      zh: page.zh,
      en: page.en,
      highlights: (highlights[segmentIndex] ?? []).filter((keyword) => page.zh.includes(keyword)),
    });
    pageStartMs = pageEndMs;
  });
});

const transcriptText = correctedSegments.join('');
const captions = words.map((word) => ({
  text: word.text,
  startMs: Math.round(word.start * 1000),
  endMs: Math.max(Math.round(word.start * 1000) + 20, Math.round(word.end * 1000)),
  timestampMs: Math.round(word.start * 1000),
  confidence: word.confidence,
}));

const cleaned = {
  schema_version: 1,
  source: path.relative(projectRoot, rawPath),
  method: 'whisper.cpp small 本机离线转写 + 用户确认稿和专有名词机械校正 + 字符级时间映射',
  language: 'zh',
  duration_seconds: 260.5,
  text: transcriptText,
  words,
  segments,
  correction_policy:
    '只修正可由原声上下文、用户确认稿和专有名词共同确认的识别错误；保留实际口语变化，不删除原声，不补入未口播段落。',
};

const comparison = {
  schema_version: 1,
  source_video: 'source/20260731_lanzhou_opc/LANZHOU_OPC_20260731_talk01_16x9.MOV',
  approved_script: 'notes/2026-07-31-兰州OPC大会三入口-超哥口播稿-v1.md',
  policy: '正片全量保留原声；字幕修复ASR错误，不删除、压缩、重排或重新配音。',
  observed_differences: [
    {
      type: 'opening_order_changed',
      spoken: '先说昨天兰州举办大会，再进入兰州观众的三个问题。',
      action: '保留实际口播顺序；大会事实更早出现，不改变三入口主张。',
    },
    {
      type: 'definition_omitted',
      spoken: '原声没有口播One-Person Company定义。',
      action: '字幕不补写；只在大会事实画面使用一张事实卡标注“OPC / One-Person Company / 一人公司”。',
    },
    {
      type: 'support_detail_spoken_variant',
      spoken: '申请条件和后续运行方式呢，马上也会提出一些细节。',
      action: '保留原声和如实字幕；同期视觉标注“具体细则以后续公开信息为准”，不承诺时间和结果。',
    },
    {
      type: 'closing_abbreviation',
      spoken: '实训、协作、创业。',
      action: '保留实际口播；视觉总览仍使用事实锁中的“实训、协作、扶持”三个入口。',
    },
  ],
  retake_or_cut_required: false,
};

for (const targetPath of [cleanedPath, captionsPath, bilingualPath, textPath, reviewPath]) {
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
}

fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(captionsPath, `${JSON.stringify(captions, null, 2)}\n`, 'utf8');
fs.writeFileSync(bilingualPath, `${JSON.stringify(bilingual, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${transcriptText}\n`, 'utf8');
fs.writeFileSync(reviewPath, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8');

console.log(`校正段落：${segments.length}`);
console.log(`词级条目：${words.length}`);
console.log(`双语字幕页：${bilingual.length}`);
console.log(`校正转写：${cleanedPath}`);
console.log(`脚本差异：${reviewPath}`);
