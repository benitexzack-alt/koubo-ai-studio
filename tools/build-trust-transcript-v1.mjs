import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const rawPath =
  process.argv[2] ??
  path.join(
    projectRoot,
    'edit/20260802_trust/transcripts/TRUST_20260802_talk01_whisper-small-v1.json',
  );
const cleanedPath =
  process.argv[3] ??
  path.join(
    projectRoot,
    'edit/20260802_trust/transcripts/TRUST_20260802_talk01.cleaned.v1.json',
  );
const bilingualPath =
  process.argv[4] ??
  path.join(
    projectRoot,
    'remotion/public/data/TRUST_20260802_talk01.bilingual.v1.json',
  );
const textPath =
  process.argv[5] ??
  path.join(
    projectRoot,
    'edit/20260802_trust/transcripts/TRUST_20260802_talk01.cleaned.v1.txt',
  );
const comparisonPath =
  process.argv[6] ??
  path.join(
    projectRoot,
    'edit/20260802_trust/transcripts/TRUST_20260802_talk01.script-comparison.v1.json',
  );

const pages = [
  {zh: '很多人拼命学AI，以为掌握工具就能赚到钱，', en: 'Many people study AI hard, believing tools will make them money.', highlights: ['AI', '掌握工具']},
  {zh: '但最后都会撞上同一堵墙。', en: 'But they eventually hit the same wall.', highlights: ['同一堵墙']},
  {zh: '一家实体店，用AI一口气做出了一堆海报和文案。', en: 'A physical store uses AI to produce piles of posters and copy.', highlights: ['实体店', '海报和文案']},
  {zh: '东西很快做出来，可发出去却没什么人看，', en: 'The content is made quickly, but almost nobody sees it.', highlights: ['很快做出来', '没什么人看']},
  {zh: '顾客也没什么反应。', en: 'Customers barely respond.', highlights: ['没什么反应']},
  {zh: '还有人想做OPC，用AI搭建了一个小程序和行业智能体。', en: 'Others build a mini app or industry agent as an OPC.', highlights: ['OPC', '小程序', '行业智能体']},
  {zh: '演示的时候流畅稳定，', en: 'The demo runs smoothly and reliably,', highlights: ['流畅稳定']},
  {zh: '可真正愿意落地使用的人寥寥无几。', en: 'yet very few people actually want to use it.', highlights: ['落地使用', '寥寥无几']},
  {zh: '没过多久，各大平台直接上线了同质化功能。', en: 'Soon, major platforms launch similar features.', highlights: ['同质化功能']},
  {zh: '这时候我们就要想清楚：', en: 'That forces us to ask:', highlights: ['想清楚']},
  {zh: '普通人在AI时代，真正属于我们自己的资产到底是什么？', en: 'What asset can ordinary people truly own in the AI era?', highlights: ['真正属于我们自己的资产']},
  {zh: '我先从创造开始讲。', en: 'Let us start with creation.', highlights: ['创造']},
  {zh: '过去拍一条视频，要设备、团队、后期。', en: 'Video once required equipment, a team, and post-production.', highlights: ['设备', '团队', '后期']},
  {zh: '后来有了智能手机的普及，普通人创作的成本大幅下降。', en: 'Smartphones then sharply lowered creation costs.', highlights: ['智能手机', '成本大幅下降']},
  {zh: '现在AI继续压低门槛，写文案、作图、剪辑视频、', en: 'Now AI lowers the bar for copy, images, and video editing,', highlights: ['AI', '压低门槛']},
  {zh: '编写基础程序，效率持续在提升。', en: 'and even basic coding, raising efficiency.', highlights: ['效率持续在提升']},
  {zh: '相关对照的实验也能够证明，', en: 'Controlled studies also provide evidence', highlights: ['对照实验']},
  {zh: 'AI可以加快部分任务的完成速度。', en: 'that AI can speed up some tasks.', highlights: ['部分任务', '加快']},
  {zh: '当然，它不能覆盖所有的工作。', en: 'Of course, it does not cover every kind of work.', highlights: ['不能覆盖所有的工作']},
  {zh: '但足以说明，AI正在持续压低创作环节的门槛。', en: 'But it clearly keeps lowering the barrier to creation.', highlights: ['创作环节的门槛']},
  {zh: '可是，创作成本降下来，', en: 'Yet lower creation costs', highlights: ['创作成本降下来']},
  {zh: '不代表分发的难题同步解决。', en: 'do not automatically solve distribution.', highlights: ['分发的难题']},
  {zh: '视频制作完成，发到平台，', en: 'A finished video still goes to a platform,', highlights: ['发到平台']},
  {zh: '还要经过算法排序、筛选、推送，', en: 'where it is ranked, filtered, and distributed,', highlights: ['排序', '筛选', '推送']},
  {zh: '最终还要吸引路人停下来观看。', en: 'and must still make a passerby stop and watch.', highlights: ['停下来观看']},
  {zh: '小程序开发出来，也要用户刚好存在对应的痛点，', en: 'A mini app also needs users with the right pain point,', highlights: ['对应的痛点']},
  {zh: '愿意点开、持续使用。', en: 'who are willing to open and keep using it.', highlights: ['点开', '持续使用']},
  {zh: '能做出来、能被看见、愿意使用，', en: 'Being made, being seen, and being used', highlights: ['做出来', '被看见', '愿意使用']},
  {zh: '是三个完全不同的大门。', en: 'are three completely different gates.', highlights: ['三个完全不同的大门']},
  {zh: '再往下讲就是复制。', en: 'Next comes copying.', highlights: ['复制']},
  {zh: '新工具刚兴起的时候，抢先掌握方法，', en: 'When a tool is new, learning it early', highlights: ['抢先掌握']},
  {zh: '确实能帮助普通人快速入场。', en: 'can help ordinary people enter quickly.', highlights: ['快速入场']},
  {zh: '别人还不懂，你先落地，', en: 'If you execute before others understand it,', highlights: ['你先落地']},
  {zh: '短暂的信息差，可以拿到第一波的变现机会。', en: 'a brief information gap can create an early opportunity.', highlights: ['信息差', '第一波']},
  {zh: '所以信息差本身没有对错，', en: 'The information gap itself is neither right nor wrong.', highlights: ['没有对错']},
  {zh: '它更像是一张早鸟入场券。', en: 'It is more like an early-bird ticket.', highlights: ['早鸟入场券']},
  {zh: '但是AI同时极大加速了复制传播。', en: 'But AI also accelerates copying and distribution.', highlights: ['复制传播']},
  {zh: '你的文案会被模仿，工作流会被拆解，', en: 'Your copy can be imitated and your workflow dismantled.', highlights: ['文案', '工作流']},
  {zh: '通用功能短时间内会涌现大量的同类竞品。', en: 'Generic features quickly attract many similar competitors.', highlights: ['通用功能', '同类竞品']},
  {zh: '信息快速扩散，教程随处可得，模板无限复用，', en: 'Information spreads, tutorials abound, and templates are reused.', highlights: ['快速扩散', '无限复用']},
  {zh: '短暂的领先优势，很快就会被抹平。', en: 'A temporary lead is quickly erased.', highlights: ['领先优势', '被抹平']},
  {zh: '这时候真正要思考的，不是这波红利还能赚多久，', en: 'The question is not how long the current bonus will last,', highlights: ['不是红利还能赚多久']},
  {zh: '而是红利窗口还在的时候，你到底沉淀下了什么。', en: 'but what you retain while the window is still open.', highlights: ['沉淀下了什么']},
  {zh: '普通人开发的很多中间层工具，', en: 'Many middle-layer tools built by ordinary people', highlights: ['中间层工具']},
  {zh: '一旦被市场验证具备价值，', en: 'may prove valuable in the market,', highlights: ['市场验证']},
  {zh: '大模型厂商、平台方很容易直接整合同类功能。', en: 'yet model makers and platforms can integrate similar functions.', highlights: ['直接整合']},
  {zh: '越是通用标准化的功能，越无法当成长久的壁垒。', en: 'The more generic and standard a feature is, the weaker its moat.', highlights: ['通用标准化', '长久的壁垒']},
  {zh: '一个按钮、一套话术，都可以被轻易复制。', en: 'A button or a script can be copied easily.', highlights: ['轻易复制']},
  {zh: '什么才是普通人在这个时代真正值得守住的东西？', en: 'So what is truly worth protecting in this era?', highlights: ['值得守住']},
  {zh: '答案是：信任。', en: 'The answer is trust.', highlights: ['信任']},
  {zh: '我们把信任和分发放在一起看。', en: 'We need to examine trust together with distribution.', highlights: ['信任', '分发']},
  {zh: '内容、产品越来越泛滥，平台负责筛选推送；', en: 'As content and products multiply, platforms filter and distribute.', highlights: ['筛选推送']},
  {zh: '创作者依靠平台，把作品送到用户面前。', en: 'Creators rely on platforms to reach users.', highlights: ['送到用户面前']},
  {zh: '这不代表算法天然偏爱真实，', en: 'That does not mean algorithms naturally favor authenticity,', highlights: ['不代表']},
  {zh: '更不是只要足够真实，就一定能拿到流量。', en: 'or that being authentic guarantees traffic.', highlights: ['不保证流量']},
  {zh: '更现实的问题是：当一个人点进你的内容，', en: 'The practical question is: when someone opens your content,', highlights: ['点进你的内容']},
  {zh: '你有没有足够完整的素材，支撑对方客观的判断？', en: 'do you have enough material for an objective judgment?', highlights: ['完整的素材', '客观判断']},
  {zh: '这里就要说到Build in Public。', en: 'This is where Build in Public matters.', highlights: ['Build in Public']},
  {zh: '它不是设计一个永远完美的人设，', en: 'It is not about designing a permanently perfect persona,', highlights: ['不是完美人设']},
  {zh: '也不是每天流水账式地分享私生活。', en: 'or posting a daily diary of private life.', highlights: ['不是流水账']},
  {zh: '它本质是持续公开一件真实的事：', en: 'It means continually sharing one real undertaking:', highlights: ['真实的事']},
  {zh: '需求从哪里来，你做了哪些尝试，', en: 'where the need came from and what you tried,', highlights: ['需求', '尝试']},
  {zh: '哪里失败出错，谁参与验证，', en: 'what failed and who helped verify it,', highlights: ['失败', '验证']},
  {zh: '后续又如何迭代优化。', en: 'and how you later improved it.', highlights: ['迭代优化']},
  {zh: '单次记录只是碎片，无数条相关记录串联在一起，', en: 'One record is only a fragment; many related records form a chain.', highlights: ['记录', '串联']},
  {zh: '最终形成属于你完整的个人历史。', en: 'Together they become your complete personal history.', highlights: ['完整的个人历史']},
  {zh: '讲到这里，我必须给“在场即信任”', en: 'Here, “presence equals trust”', highlights: ['在场即信任']},
  {zh: '加上一条关键边界：', en: 'needs one crucial boundary:', highlights: ['关键边界']},
  {zh: '持续在场，本身不等于信任。', en: 'Continued presence alone is not trust.', highlights: ['不等于信任']},
  {zh: '社交相关研究显示，并不是公开的信息越多，', en: 'Social research suggests that sharing more information', highlights: ['公开的信息越多']},
  {zh: '可信度就越高。', en: 'does not automatically increase credibility.', highlights: ['可信度']},
  {zh: '披露恰到好处，能够建立信任；', en: 'Appropriate disclosure can build trust,', highlights: ['恰到好处']},
  {zh: '不合时宜的过度袒露，反而会降低别人对你的评价。', en: 'while misplaced over-disclosure can reduce evaluations.', highlights: ['过度袒露', '降低评价']},
  {zh: '持续更新、持续露面，只是构建信任的原材料，', en: 'Regular updates and appearances are only raw material for trust,', highlights: ['原材料']},
  {zh: '绝非最终结果。', en: 'not the final result.', highlights: ['绝非最终结果']},
  {zh: '别人可以抄袭你的标题、模仿你的表达方式，', en: 'Others can copy your titles and imitate your expression,', highlights: ['抄袭', '模仿']},
  {zh: '做出功能相近的产品。', en: 'or build a product with similar features.', highlights: ['功能相近']},
  {zh: '但对手很难在短时间内补齐你全部历程：', en: 'But they cannot quickly reproduce your whole journey:', highlights: ['全部历程']},
  {zh: '你曾经解决过什么真实的难题，', en: 'the real problems you solved,', highlights: ['真实的难题']},
  {zh: '做过哪些关键性的判断，踩过哪些坑，', en: 'the judgments you made and the mistakes you survived,', highlights: ['关键性的判断', '踩过的坑']},
  {zh: '方案经过了多少客户的验证。', en: 'and how much customer validation your work received.', highlights: ['客户的验证']},
  {zh: '这也是为什么普通人需要同时吃透AI和自媒体。', en: 'That is why ordinary people need both AI and self-media.', highlights: ['AI', '自媒体']},
  {zh: 'AI帮你降低创作成本，', en: 'AI lowers creation costs.', highlights: ['降低创作成本']},
  {zh: '信息差给你一张早期入场门票；', en: 'An information gap gives you an early entry ticket.', highlights: ['早期入场门票']},
  {zh: '自媒体让你探索过程有机会被外界看到。', en: 'Self-media gives others a chance to see your exploration.', highlights: ['被外界看到']},
  {zh: '单纯的复制无法形成长期的竞争力，', en: 'Copying alone cannot create lasting competitiveness.', highlights: ['长期的竞争力']},
  {zh: '被看见，也不等于获取信任。', en: 'Being seen is not the same as earning trust.', highlights: ['不等于获取信任']},
  {zh: '真正值得长期沉淀的资产，', en: 'The asset worth accumulating over time', highlights: ['长期沉淀的资产']},
  {zh: '是一条扎根真实问题、可供外人核验、', en: 'is a timeline rooted in real problems and open to verification,', highlights: ['真实问题', '核验']},
  {zh: '敢于坦诚标注“这里尚未验证”的完整时间线。', en: 'one that honestly labels what remains unverified.', highlights: ['尚未验证', '完整时间线']},
  {zh: '它无法保证平台持续给你流量，', en: 'It cannot guarantee continued platform traffic,', highlights: ['无法保证流量']},
  {zh: '也不能确保客户一定会选择你。', en: 'or ensure that customers will choose you.', highlights: ['不能确保']},
  {zh: '但是当别人想要评估你、信任你的时候，', en: 'But when someone wants to evaluate and trust you,', highlights: ['评估你', '信任你']},
  {zh: '手里终于拥有了足够的证据。', en: 'they finally have enough evidence.', highlights: ['足够的证据']},
  {zh: '不用等到做出成绩再开始行动。', en: 'You do not need to wait for success before starting.', highlights: ['不用等']},
  {zh: '就拿你当下正在推进的项目，', en: 'Take the project you are working on now', highlights: ['当下的项目']},
  {zh: '借助AI开启你的记录之路。', en: 'and use AI to begin documenting it.', highlights: ['记录之路']},
  {zh: '别急着向所有人证明你已经成功。', en: 'Do not rush to prove that you have already succeeded.', highlights: ['别急着证明成功']},
  {zh: '先讲清楚你做过什么，', en: 'First explain what you have done,', highlights: ['做过什么']},
  {zh: '哪些方面值得验证，', en: 'what is worth validating,', highlights: ['值得验证']},
  {zh: '还有哪些方面依旧没有验证。', en: 'and what still remains unverified.', highlights: ['没有验证']},
  {zh: '如果你现在正在借助AI做项目，', en: 'If you are using AI on a project right now,', highlights: ['AI做项目']},
  {zh: '可以评论区聊聊，你目前最大的卡点是什么？', en: 'tell me in the comments: what is your biggest obstacle?', highlights: ['最大的卡点']},
  {zh: '关注我，我是超哥，在兰州AI创业。', en: 'Follow me. I am Chao, building an AI venture in Lanzhou.', highlights: ['超哥', '兰州AI创业']},
];

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
    const tokenEnd = Math.max(
      tokenStart + 20,
      Number(token.offsets?.to ?? segmentEnd),
    );
    return characters.map((character, index) => ({
      text: character,
      startMs:
        tokenStart + ((tokenEnd - tokenStart) * index) / characters.length,
      endMs:
        tokenStart +
        ((tokenEnd - tokenStart) * (index + 1)) / characters.length,
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
  const start = cursor;
  while (cursor < mapped.length && !mapped[cursor]) cursor += 1;
  const end = cursor;
  const previousEnd =
    start > 0 && mapped[start - 1] ? mapped[start - 1].endMs : 0;
  const nextStart =
    end < mapped.length && mapped[end]
      ? mapped[end].startMs
      : Number(rawSegments.at(-1)?.offsets?.to ?? 351700);
  const available = Math.max(20 * (end - start), nextStart - previousEnd);
  for (let index = start; index < end; index += 1) {
    const offset = index - start;
    mapped[index] = {
      text: targetCharacters[index],
      startMs: previousEnd + (available * offset) / Math.max(1, end - start),
      endMs:
        previousEnd + (available * (offset + 1)) / Math.max(1, end - start),
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
  const pageCharacterCount = normalizeCharacters(page.zh).length;
  characterCursor += pageCharacterCount;
  const finalWord = words[Math.max(0, characterCursor - 1)];
  const naturalEndMs = Math.round(finalWord.end * 1000);
  const pageEndMs =
    pageIndex === pages.length - 1
      ? Number(rawSegments.at(-1)?.offsets?.to ?? naturalEndMs)
      : Math.max(pageStartMs + 180, naturalEndMs);
  bilingual.push({
    startMs: pageStartMs,
    endMs: pageEndMs,
    zh: page.zh,
    en: page.en,
    highlights: page.highlights ?? [],
  });
  pageStartMs = pageEndMs;
}

const transcriptText = pages.map((page) => page.zh).join('');
const cleaned = {
  schema_version: 1,
  source: path.relative(projectRoot, rawPath),
  method:
    'whisper.cpp small 本机离线词级转写 + 用户确认稿对照 + 疑点分段复核 + 全局字符时间映射',
  language: 'zh',
  duration_seconds: 351.7,
  text: transcriptText,
  words,
  pages: bilingual,
  correction_policy:
    '修正可由原声上下文和用户确认稿共同确认的ASR错字；保留实际口语增删、结尾追加和措辞变化，不删除、压缩或重排原声。',
};

const comparison = {
  schema_version: 1,
  source_video:
    'source/20260802_trust/TRUST_20260802_talk01_16x9.MOV',
  approved_script:
    'notes/2026-08-02-AI时代普通人不可复制的资产是信任-用户最终确认稿-v2.md',
  policy:
    '正片全量保留原声；字幕按实际口播，研究和项目事实不升级，不补写未口播句子。',
  observed_differences: [
    {
      type: 'natural_opening_variants',
      spoken:
        '做出了一堆、搭建了一个小程序和行业智能体、真正属于我们自己的资产到底是什么。',
      action: '保留实际口语，语义与确认稿一致。',
    },
    {
      type: 'three_gates_spoken_variant',
      spoken: '能做出来、能被看见、愿意使用，是三个完全不同的大门。',
      action:
        '字幕和三门动画改成实际说法；上一句仍保留点开、持续使用，核心逻辑不变。',
    },
    {
      type: 'validation_action_spoken_variant',
      spoken: '哪些方面值得验证，还有哪些方面依旧没有验证。',
      action: '字幕和结尾行动卡按实际口播，不写成已经得到验证。',
    },
    {
      type: 'personal_closing_added',
      spoken: '关注我，我是超哥，在兰州AI创业。',
      action: '完整保留，作为原片真实结尾。',
    },
  ],
  omitted_core_sections: [],
  repeated_full_sections: [],
  ending_complete: true,
  retake_or_cut_required: false,
};

for (const targetPath of [
  cleanedPath,
  bilingualPath,
  textPath,
  comparisonPath,
]) {
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
}

fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(bilingualPath, `${JSON.stringify(bilingual, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${transcriptText}\n`, 'utf8');
fs.writeFileSync(
  comparisonPath,
  `${JSON.stringify(comparison, null, 2)}\n`,
  'utf8',
);

console.log(`原始分段：${rawSegments.length}`);
console.log(`校正字符：${words.length}`);
console.log(`双语字幕页：${bilingual.length}`);
console.log(`全局编辑距离：${distance.at(-1).at(-1)}`);
console.log(`校正转写：${cleanedPath}`);
console.log(`脚本差异：${comparisonPath}`);
