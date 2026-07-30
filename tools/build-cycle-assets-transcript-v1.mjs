import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const rawPath =
  process.argv[2] ??
  path.join(
    projectRoot,
    'edit/20260730_cycle_assets/transcripts/CYCLE_ASSETS_20260730_talk01_whisper-small-v1.json',
  );
const cleanedPath =
  process.argv[3] ??
  path.join(
    projectRoot,
    'edit/20260730_cycle_assets/transcripts/CYCLE_ASSETS_20260730_talk01.cleaned.v1.json',
  );
const captionsPath =
  process.argv[4] ??
  path.join(
    projectRoot,
    'remotion/public/data/CYCLE_ASSETS_20260730_talk01.captions.v1.json',
  );
const bilingualPath =
  process.argv[5] ??
  path.join(
    projectRoot,
    'remotion/public/data/CYCLE_ASSETS_20260730_talk01.bilingual.v1.json',
  );
const textPath =
  process.argv[6] ??
  path.join(
    projectRoot,
    'edit/20260730_cycle_assets/transcripts/CYCLE_ASSETS_20260730_talk01.cleaned.v1.txt',
  );
const reviewPath =
  process.argv[7] ??
  path.join(
    projectRoot,
    'edit/20260730_cycle_assets/transcripts/CYCLE_ASSETS_20260730_talk01.script-comparison.v1.json',
  );

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rawSegments = Array.isArray(raw.transcription) ? raw.transcription : [];

// Each entry is locked to the corresponding locally transcribed speech window.
// Corrections only repair ASR errors and punctuation; no spoken content is removed.
const correctedSegments = [
  'AI这轮热潮，如果有一天退下去，最后能留下什么？',
  '不是哪家公司会赢，而是今天砸进去的技术、钱和时间，最后会沉淀成什么？',
  '普通人又能从里面拿走什么？',
  '这当下的AI大爆发时代，真正能穿越周期的两类资产是什么？',
  '我们先回头看一下互联网泡沫。',
  '2000年前后的互联网投资热潮里，大量电信公司抢着铺光纤、建网络。',
  '后来泡沫破了，一批公司退出，很多线路也暂时没人用。',
  '美联储的一份研究提到，上世纪90年代，',
  '铺下的光纤后来一度有超过九成处于闲置状态。',
  '所以有了一个名字，叫“暗光纤”。',
  '但公司可以倒，估值可以掉，埋在地下的光纤不会跟着消失。',
  '光纤寿命很长。后来云服务、在线视频，',
  '移动互联网对带宽的需求继续增长。',
  '这些已经铺好的线路，至少不用重新再挖一遍。',
  '当年显得过剩的一部分建设，也就有机会被重新利用。',
  '这就是一个技术周期留下的第一层东西：底层基础设施。',
  '同一时期，个人电脑也在快速进入普通人的生活和工作当中。',
  '到了1997年，美国人口普查局已经把个人电脑',
  '称为工作、学校和家庭里的基础工具。',
  '而埋在地下的光纤，决定数字世界能跑多少东西。',
  '放在桌子上的电脑，决定了普通人怎么进入这个世界。',
  '查资料、写文档、上网、使用软件，慢慢变成了日常动作。',
  '所以互联网那一轮真正留下来的，不止是网络，还有一个大众入口，',
  '以及围绕这个入口形成的所有使用习惯。',
  '换句话说，有些泡沫破了，只剩下一地故事；',
  '但有些泡沫会把估值和热度打掉，',
  '却把真正建成的东西和已经形成的习惯留下来。',
  '那么把这套逻辑放到今天的AI上，会留下什么？',
  '第一层可能是芯片、算力中心、数据中心这些基础建设。',
  '现在围绕AI的投资确实在加速。以后会不会出现过剩，',
  '现在不能说死。但已经建下来的设施和积累下来的算力能力，',
  '不会因为某个热门名字消失就全部归零。',
  '之前提到过，咱们庆阳的一个算力中心，',
  '还有前段时间字节跳动46亿在咱们宁夏中卫又设立了两家新公司，',
  '主要是绿色算力、低碳数据中心。',
  '第二层，是大模型这个新的能力入口。',
  '以前你要学会一个软件，记住菜单、按钮和操作步骤，才能让电脑干活。',
  '现在写方案、整理资料、分析表格，越来越多的时候是先把目标用一句人话讲给AI，',
  '再让它拆步骤、找工具、给出初稿。',
  '这不代表电脑和软件消失了。真正发生变化的是，人过去要先学会机器的规则，',
  '现在机器开始学习怎么理解人的目标。',
  '所以我认为，两层资产是成立的一套观察框架。',
  '一层是算力底座，一层是大模型带来的能力入口。',
  '往咱们普通人这一层想一步，是什么？',
  '算力再便宜，大模型再强，它们最后也是很多人都能用的时代公共能力。',
  '同一个模型大家都能打开，',
  '为什么有人只能得到一份通用的答案，而有人却能拿它解决真实问题？',
  '差别不只在提示词，还在你手里有没有这两样东西。',
  '第一样，我把它叫进场资格。',
  '一个老板愿不愿意告诉你，客户到底在哪一步走了，团队为什么推不动，过去已经试过什么。',
  '一个设计师愿不愿意把还没成形的灵感、改废的版本、预算和顾虑拿出来。',
  '这些没整理过的一手情况，公开网络里没有，模型也不可能凭空知道。',
  '这个就是你真正进过现场，AI才有机会处理别人拿不到的上下文。',
  '第二样是验收证据。模型能生成页面、图片和方案，',
  '但它不知道这个页面有没有人真用，这张图能不能交付，这个方案到底解决了谁的问题。',
  '你得把结果拿回现场，知道哪里失败、为什么改、谁来检查，最后哪一步才算通过。',
  '这些做过、错过、改过、被确认过的过程留下来，下次再遇到相似问题，AI调出来的才是你自己的判断，',
  '不是网上人人都有的答案。',
  '我前一条讲过知识库。今天再往前说一步：知识库只是容器。真正值得装进去的，',
  '是你从真实现场拿到的上下文，和被现实检验过的行动证据。',
  '所以这一轮AI周期，时代可能留下两样东西：更强的算力底座，和更自然的能力入口。',
  '普通人也应该给自己留下两样东西：进入真实现场的资格，和经过真实验收的证据。',
  '看到这儿，我要你们自己列两张清单。',
  '第一张，哪些真实场景愿意向你打开？',
  '第二张，你手上哪些结果，已经被真正使用它的人验收过？',
  '如果两张都是空的，先别继续囤工具。',
  '模型会换，工具会换，热度也会换。',
  '可你真正进过什么现场，做过什么、错过什么、被谁验收过，',
  '这些才会让AI越用越像你，而不是让你越来越像所有人。',
  '关注我，我是超哥，在兰州AI创业。',
];

const englishSegments = [
  'If this AI boom fades one day, what will remain?',
  'The real question is not which company wins, but what all this technology, money, and time will leave behind.',
  'And what can ordinary people take from it?',
  'What two assets can truly outlast today’s AI boom?',
  'Let us first look back at the dot-com bubble.',
  'Around 2000, telecom companies raced to lay fiber and build networks.',
  'When the bubble burst, firms exited and many lines sat unused.',
  'A Federal Reserve study noted that fiber laid in the 1990s',
  'was later more than 90 percent idle at one point.',
  'It earned a name: dark fiber.',
  'Companies can fail and valuations can fall, but buried fiber does not disappear.',
  'Fiber lasts a long time. Later, cloud services and online video',
  'kept increasing demand for bandwidth.',
  'Those existing lines did not need to be dug from scratch again.',
  'Some infrastructure that once looked excessive could be reused.',
  'That is the first thing a technology cycle leaves behind: infrastructure.',
  'At the same time, personal computers entered ordinary life and work.',
  'By 1997, the U.S. Census Bureau had described personal computers',
  'as basic tools at work, school, and home.',
  'Underground fiber decided how much the digital world could carry.',
  'The computer on the desk decided how people entered that world.',
  'Research, documents, the web, and software became daily actions.',
  'The internet era left not only networks, but also a mass-market gateway',
  'and the habits formed around that gateway.',
  'Some bubbles burst and leave only stories.',
  'Others erase valuations and hype',
  'while leaving what was built and the habits people formed.',
  'Apply that logic to AI today. What might remain?',
  'The first layer may be chips, compute centers, and data centers.',
  'Investment around AI is accelerating. Whether it becomes excessive is uncertain.',
  'But facilities already built and compute capacity already accumulated',
  'do not vanish because a popular name disappears.',
  'We have previously discussed the compute capacity in Qingyang.',
  'More recently, ByteDance-related entities set up two companies in Zhongwei, Ningxia, with 4.6 billion yuan in registered capital.',
  'Their stated direction includes green computing and low-carbon data centers.',
  'The second layer is the large model as a new capability gateway.',
  'Before, you had to learn menus, buttons, and steps before software could work for you.',
  'Now, for plans, research, and spreadsheets, you can first state the goal to AI in plain language.',
  'Then let it break down the steps, find tools, and produce a draft.',
  'Computers and software are not disappearing. The real shift is that people once learned machine rules,',
  'while machines are now learning to understand human goals.',
  'That is why I see two durable layers in this cycle.',
  'One is the compute foundation; the other is the capability gateway created by large models.',
  'What does this mean for ordinary people?',
  'Cheaper compute and stronger models will eventually become public capabilities available to many.',
  'Everyone can open the same model.',
  'Why does one person get a generic answer while another solves a real problem?',
  'The difference is not only prompting. It is whether you hold two things.',
  'The first is what I call permission to enter the field.',
  'Will a business owner tell you where customers leave, why the team is stuck, and what has already been tried?',
  'Will a designer show unfinished ideas, rejected versions, budgets, and concerns?',
  'This unstructured first-hand context is not on the public web, and a model cannot invent it.',
  'Only after entering the real field can AI process context others do not have.',
  'The second is validation evidence. A model can generate pages, images, and plans,',
  'but it does not know whether they were used, deliverable, or solved a real problem.',
  'You must take results back to the field and learn what failed, why it changed, who checked it, and what passed.',
  'Keep the work, mistakes, revisions, and confirmations. Next time, AI can retrieve your judgment,',
  'not the same answer everyone can find online.',
  'I talked about knowledge bases before. Here is the next step: a knowledge base is only a container.',
  'What belongs inside is field context and action evidence tested by reality.',
  'This AI cycle may leave stronger compute foundations and a more natural capability gateway.',
  'Ordinary people should keep field access and evidence that has passed real validation.',
  'Now make two lists for yourself.',
  'First: which real situations are willing to open up to you?',
  'Second: which results in your hands were accepted by the people who actually used them?',
  'If both lists are empty, stop collecting more tools.',
  'Models will change, tools will change, and hype will change.',
  'But the fields you entered, what you did, what failed, and who validated it',
  'will make AI work more like you instead of making you look like everyone else.',
  'Follow me. I am Chao, building an AI venture in Lanzhou.',
];

const highlights = {
  0: ['AI', '留下什么'],
  1: ['技术', '钱', '时间'],
  3: ['穿越周期', '两类资产'],
  4: ['互联网泡沫'],
  5: ['铺光纤', '建网络'],
  8: ['超过九成', '闲置'],
  9: ['暗光纤'],
  15: ['底层基础设施'],
  16: ['个人电脑'],
  17: ['1997年'],
  22: ['网络', '大众入口'],
  23: ['使用习惯'],
  28: ['芯片', '算力中心', '数据中心'],
  32: ['庆阳', '算力中心'],
  33: ['46亿', '宁夏中卫', '两家新公司'],
  34: ['绿色算力', '低碳数据中心'],
  35: ['大模型', '能力入口'],
  37: ['一句人话', 'AI'],
  42: ['算力底座', '能力入口'],
  44: ['时代公共能力'],
  48: ['进场资格'],
  52: ['现场', '上下文'],
  53: ['验收证据'],
  56: ['做过', '错过', '改过', '确认过'],
  58: ['知识库', '容器'],
  60: ['算力底座', '能力入口'],
  61: ['进场资格', '验收证据'],
  62: ['两张清单'],
  65: ['别继续囤工具'],
  66: ['模型会换', '工具会换', '热度也会换'],
  68: ['AI越用越像你'],
  69: ['超哥', '兰州AI创业'],
};

const captionPageOverrides = {
  37: [
    {
      zh: '现在写方案、整理资料、分析表格，',
      en: 'Now, for plans, research, and spreadsheets,',
    },
    {
      zh: '越来越多的时候是先把目标用一句人话讲给AI，',
      en: 'you can first state the goal to AI in plain language.',
    },
  ],
  49: [
    {
      zh: '一个老板愿不愿意告诉你，客户到底在哪一步走了，',
      en: 'Will a business owner tell you where customers leave,',
    },
    {
      zh: '团队为什么推不动，过去已经试过什么。',
      en: 'why the team is stuck, and what has already been tried?',
    },
  ],
  54: [
    {
      zh: '但它不知道这个页面有没有人真用，这张图能不能交付，',
      en: 'But it does not know whether the page was used or the image was deliverable,',
    },
    {
      zh: '这个方案到底解决了谁的问题。',
      en: 'or whose real problem the plan actually solved.',
    },
  ],
  55: [
    {
      zh: '你得把结果拿回现场，知道哪里失败、为什么改、',
      en: 'Take the result back to the field and learn what failed and why it changed,',
    },
    {
      zh: '谁来检查，最后哪一步才算通过。',
      en: 'who checked it, and what finally counted as passing.',
    },
  ],
  56: [
    {
      zh: '这些做过、错过、改过、被确认过的过程留下来，',
      en: 'Keep the work, mistakes, revisions, and confirmations.',
    },
    {
      zh: '下次再遇到相似问题，AI调出来的才是你自己的判断，',
      en: 'Next time, AI can retrieve your own judgment,',
    },
  ],
  58: [
    {
      zh: '我前一条讲过知识库。今天再往前说一步：',
      en: 'I talked about knowledge bases before. Here is the next step:',
    },
    {
      zh: '知识库只是容器。真正值得装进去的，',
      en: 'a knowledge base is only a container. What belongs inside',
    },
  ],
  60: [
    {
      zh: '所以这一轮AI周期，时代可能留下两样东西：',
      en: 'This AI cycle may leave two things:',
    },
    {
      zh: '更强的算力底座，和更自然的能力入口。',
      en: 'stronger compute foundations and a more natural capability gateway.',
    },
  ],
  61: [
    {
      zh: '普通人也应该给自己留下两样东西：',
      en: 'Ordinary people should also keep two things:',
    },
    {
      zh: '进入真实现场的资格，和经过真实验收的证据。',
      en: 'field access and evidence that has passed real validation.',
    },
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
    if (!tokenText || tokenText.startsWith('[_')) {
      continue;
    }
    const characters = [...tokenText.replace(/\s+/gu, '')];
    if (characters.length === 0) {
      continue;
    }
    const tokenStart = Number(token.offsets?.from ?? segment.offsets.from);
    const tokenEnd = Math.max(
      tokenStart + 20,
      Number(token.offsets?.to ?? tokenStart + 20),
    );
    characters.forEach((character, index) => {
      units.push({
        text: character,
        start:
          tokenStart + ((tokenEnd - tokenStart) * index) / characters.length,
        end:
          tokenStart +
          ((tokenEnd - tokenStart) * (index + 1)) / characters.length,
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

  for (let row = 0; row < rows; row += 1) {
    distance[row][0] = row;
  }
  for (let column = 0; column < columns; column += 1) {
    distance[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitution =
        distance[row - 1][column - 1] +
        (source[row - 1] === target[column - 1] ? 0 : 1);
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
        distance[row - 1][column - 1] +
          (source[row - 1] === target[column - 1] ? 0 : 1)
    ) {
      mapped[column - 1] = rawUnits[row - 1];
      row -= 1;
      column -= 1;
    } else if (
      row > 0 &&
      distance[row][column] === distance[row - 1][column] + 1
    ) {
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
    while (cursor < mapped.length && !mapped[cursor]) {
      cursor += 1;
    }
    const blockEnd = cursor;
    const previousEnd =
      blockStart > 0 && mapped[blockStart - 1]
        ? mapped[blockStart - 1].end
        : segmentStart;
    const nextStart =
      blockEnd < mapped.length && mapped[blockEnd]
        ? mapped[blockEnd].start
        : segmentEnd;
    const available = Math.max(
      20 * (blockEnd - blockStart),
      nextStart - previousEnd,
    );
    for (let index = blockStart; index < blockEnd; index += 1) {
      const offset = index - blockStart;
      mapped[index] = {
        text: target[index],
        start:
          previousEnd +
          (available * offset) / Math.max(1, blockEnd - blockStart),
        end:
          previousEnd +
          (available * (offset + 1)) / Math.max(1, blockEnd - blockStart),
        probability: null,
      };
    }
  }

  let monotonicStart = segmentStart;
  return target.map((text, index) => {
    const sourceUnit = mapped[index];
    const start = Math.max(
      monotonicStart,
      Math.min(segmentEnd, sourceUnit.start),
    );
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
      highlights: (highlights[segmentIndex] ?? []).filter((keyword) =>
        page.zh.includes(keyword),
      ),
    });
    pageStartMs = pageEndMs;
  });
});

const transcriptText = correctedSegments.join('');
const captions = words.map((word) => ({
  text: word.text,
  startMs: Math.round(word.start * 1000),
  endMs: Math.max(
    Math.round(word.start * 1000) + 20,
    Math.round(word.end * 1000),
  ),
  timestampMs: Math.round(word.start * 1000),
  confidence: word.confidence,
}));

const cleaned = {
  schema_version: 1,
  source: path.relative(projectRoot, rawPath),
  method:
    'whisper.cpp small 本机离线转写 + 确认稿和专有名词机械校正 + 字符级时间映射',
  language: 'zh',
  duration_seconds: 378.75,
  text: transcriptText,
  words,
  segments,
  correction_policy:
    '只修正可由原声上下文、用户确认稿和专有名词共同确认的识别错误；不删除原声，不补入未口播段落。',
};

const comparison = {
  schema_version: 1,
  source_video:
    'source/20260730_cycle_assets/CYCLE_ASSETS_20260730_talk01_16x9.MOV',
  approved_script:
    'notes/2026-07-30-真正能穿越周期的两类资产-事实安全拍摄稿-v3.md',
  policy:
    '正片全量保留原声；字幕修复ASR错误，不删除、压缩、重排或重新配音。',
  observed_differences: [
    {
      type: 'spoken_wording_retained',
      section: '宁夏中卫',
      spoken:
        '还有前段时间字节跳动46亿在咱们宁夏中卫又设立了两家新公司，主要是绿色算力、低碳数据中心。',
      visual_support:
        '画面只显示“22亿元 + 24亿元注册资本”和中卫节点，不添加补录或纠错口播。',
      action: '按用户2026-07-30最新确认保留原声',
    },
    {
      type: 'natural_spoken_variants',
      section: '全片',
      action:
        '保留“放在桌子上的电脑”等自然口语表达；仅修复Whisper把光纤、暗光纤、美联储、上下文、验收证据等识别错的文字。',
    },
  ],
};

for (const targetPath of [
  cleanedPath,
  captionsPath,
  bilingualPath,
  textPath,
  reviewPath,
]) {
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
