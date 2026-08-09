import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(
  projectRoot,
  'edit/20260810_ai_cognitive_position/transcripts/AI_COGNITIVE_POSITION_20260810_talk01.timing-source.v1.json',
);
const transcriptDirectory = path.join(
  projectRoot,
  'edit/20260810_ai_cognitive_position/transcripts',
);
const cleanedPath = path.join(
  transcriptDirectory,
  'AI_COGNITIVE_POSITION_20260810_talk01.cleaned.v1.json',
);
const textPath = path.join(
  transcriptDirectory,
  'AI_COGNITIVE_POSITION_20260810_talk01.cleaned.v1.txt',
);
const comparisonPath = path.join(
  transcriptDirectory,
  'AI_COGNITIVE_POSITION_20260810_talk01.script-comparison.v1.json',
);
const bilingualPath = path.join(
  projectRoot,
  'remotion/public/data/AI_COGNITIVE_POSITION_20260810_talk01.bilingual.v1.json',
);
const visualPlanEditPath = path.join(
  projectRoot,
  'edit/20260810_ai_cognitive_position/visual-plan_AI_COGNITIVE_POSITION_20260810_talk01_v1.json',
);
const visualPlanRemotionPath = path.join(
  projectRoot,
  'remotion/src/data/AICognitivePositionV73.visual-plan.v1.json',
);
const sfxEditPath = path.join(
  projectRoot,
  'edit/20260810_ai_cognitive_position/sfx-cue-sheet_AI_COGNITIVE_POSITION_20260810_talk01_v1.json',
);
const sfxRemotionPath = path.join(
  projectRoot,
  'remotion/src/data/AICognitivePositionV73.sfx.v1.json',
);

const durationSeconds = 305.968005;
const durationMs = Math.round(durationSeconds * 1000);

// 字幕以真实原声为准。用户已明确接受三处口语变化，不用字幕改写原声。
const pages = [
  ['千万别再只会单纯地用AI搜索答案了。', 'Stop using AI only to search for answers.', ['AI', '搜索答案']],
  ['90%的普通人，都搞错了第四次工业革命的核心。', 'Ninety percent of ordinary people miss the core of the fourth industrial revolution.', ['90%', '第四次工业革命']],
  ['一味地跟风用AI、玩AI，最后只会被AI淘汰。', 'Following the AI trend without a position may leave you behind.', ['跟风用AI', '被AI淘汰']],
  ['前三次工业革命，普通人最先拿到的，', 'In the first three industrial revolutions, ordinary people first received', ['前三次工业革命']],
  ['大多数是生产线做出来的产品。', 'products made by production lines.', ['生产线', '产品']],
  ['但这一次，有件事可能变了。', 'This time, something may be different.', ['可能变了']],
  ['普通人拿到的，不只是一件新的AI产品，', 'Ordinary people may receive more than a new AI product.', ['不只', 'AI产品']],
  ['而是一条可以装进电脑和手机里的“认知生产线”。', 'They may gain a cognitive production line inside a computer or phone.', ['认知生产线']],
  ['所以先别问AI会替代谁，', 'So do not begin by asking whom AI will replace.', ['别先问', '替代谁']],
  ['先问一个更重要的问题：', 'Ask a more important question first:', ['更重要的问题']],
  ['AI在第四次工业革命里站在哪一层？', 'What layer does AI occupy in this industrial revolution?', ['AI', '哪一层']],
  ['我们普通人又该把自己的建设在哪一层？', 'And where should ordinary people build their own position?', ['普通人', '自己的位置']],
  ['第四次工业革命不只等于AI。', 'The fourth industrial revolution is not only AI.', ['不只等于AI']],
  ['但在这轮技术变化里，AI最重要的作用，', 'Yet in this wave, one of AI\'s most important roles', ['AI', '最重要的作用']],
  ['是把一部分过去只有团队和组织才能完成的认知工作，', 'is turning some cognitive work once limited to teams and organizations', ['团队和组织', '认知工作']],
  ['变成个人也可以调用的能力。', 'into capabilities an individual can call on.', ['个人', '调用']],
  ['我最近看到一个特别准确的说法，', 'I recently saw a particularly apt phrase:', ['准确的说法']],
  ['叫“文明级认知能力”。', 'civilization-scale cognitive capability.', ['文明级认知能力']],
  ['不是说问AI几句话，', 'It does not mean asking AI a few questions', ['不是', '问AI']],
  ['就突然拥有了整个文明的智慧。', 'suddenly gives you all of civilization\'s wisdom.', ['突然拥有', '文明智慧']],
  ['真正改变的是，过去一个人很难接触、读完、比较的知识和案例，', 'The change is that knowledge and cases once hard to access, read, and compare', ['接触', '读完', '比较']],
  ['现在变得更容易被个人调用。', 'are now easier for an individual to use.', ['个人调用']],
  ['AI就站在这一层：通用认知生产力。', 'AI stands at this layer: general cognitive productivity.', ['通用认知生产力']],
  ['再往上，才是现实世界。', 'Above that lies the real world.', ['现实世界']],
  ['谁真的有问题？', 'Who truly has a problem?', ['真实问题']],
  ['哪条信息现在还成立？', 'Which information is still valid now?', ['仍然成立']],
  ['同一个方法换到另一群人身上，需要改变什么？', 'What must change when the same method meets a different group?', ['人群适配']],
  ['最后有没有人愿意使用、接受，甚至付费？', 'Will anyone use it, accept it, or even pay?', ['使用', '接受', '付费']],
  ['这些问题，大模型没法替你一次性回答。', 'A large model cannot answer all of these for you at once.', ['没法一次回答']],
  ['因为模型能读到很多人的过去，', 'A model can read the past of many people,', ['很多人的过去']],
  ['却不知道你面前这个人今天为什么犹豫。', 'but it does not know why this person hesitates today.', ['今天为什么犹豫']],
  ['它能生成十套答案，但不能替任何一套答案承担结果。', 'It can generate ten answers, but it bears the outcome of none of them.', ['十套答案', '不承担结果']],
  ['所以普通人真正应该站的位置，', 'The position ordinary people should occupy', ['普通人的位置']],
  ['不是在模型下面当一个答案消费者，', 'is not below the model as an answer consumer,', ['答案消费者']],
  ['也不是站在模型上面，假装自己什么都懂。', 'nor above it pretending to know everything.', ['假装都懂']],
  ['而是站在AI和现实之间。', 'It is between AI and reality.', ['AI', '现实之间']],
  ['AI负责扩大你能看见的世界。', 'AI expands the world you can see.', ['AI负责', '扩大世界']],
  ['你负责把知识变成具体判断，', 'You turn knowledge into specific judgments,', ['你负责', '具体判断']],
  ['再把这些判断推进真实反馈。', 'then move those judgments into real feedback.', ['真实反馈']],
  ['这个位置怎么建立？', 'How do you build this position?', ['怎么建立']],
  ['第一个，调用权。', 'First: the right to call on knowledge.', ['调用权']],
  ['别只收一个结论。', 'Do not accept only one conclusion.', ['不只收结论']],
  ['让AI帮你找到原文、案例和反对意见。', 'Use AI to find original sources, cases, and opposing views.', ['原文', '案例', '反对意见']],
  ['你先得真正见过这个世界有哪些做法，', 'You must first see what approaches actually exist', ['真正见过']],
  ['才谈得上选哪一条。', 'before choosing one.', ['选择']],
  ['第二个，解释权。', 'Second: the right to explain.', ['解释权']],
  ['每看到一条内容，先逼自己回答：', 'For every piece of content, make yourself answer:', ['先回答']],
  ['它到底讲了什么？为什么成立？', 'What does it actually say, and why does it hold?', ['讲了什么', '为什么成立']],
  ['解决了谁的问题？', 'Whose problem does it solve?', ['解决谁']],
  ['又会在什么条件下失效？', 'Under what conditions does it fail?', ['何时失效']],
  ['写不出来，其实不丢人。', 'It is not shameful if you cannot write the answers yet.', ['写不出来']],
  ['那只是说明，这条信息还没有变成你的知识。', 'It only means the information has not become your knowledge.', ['你的知识']],
  ['第三个，转化权。', 'Third: the right to transform.', ['转化权']],
  ['很多所谓“最高层的赚钱方法”，未必是什么神秘答案。', 'Many so-called top-tier money methods are not mysterious answers.', ['赚钱方法', '不是神秘答案']],
  ['它更可能是一套在他们那里反复用过的判断过程。', 'They are more likely repeatable judgment processes.', ['判断过程']],
  ['一边有已经验证过的常识，', 'On one side are ideas already tested,', ['已验证常识']],
  ['另一边有人正在为同一个问题反复交学费。', 'while others keep paying to relearn the same lesson.', ['反复交学费']],
  ['你和我其实就是站在中间，', 'You and I stand in the middle,', ['站在中间']],
  ['用AI拆清条件、翻译逻辑、重新适配。', 'using AI to unpack conditions, translate logic, and adapt it again.', ['拆条件', '翻译逻辑', '重新适配']],
  ['你交付的不是一段搬来的话，', 'What you deliver is not borrowed wording,', ['不是搬来的话']],
  ['而是一条更省时间、更少试错的决策路径。', 'but a decision path with less time and fewer mistakes.', ['决策路径', '更少试错']],
  ['第四个，校准权。', 'Fourth: the right to calibrate.', ['校准权']],
  ['把最小版本拿出来。', 'Put out the smallest workable version.', ['最小版本']],
  ['有人听得懂、有人反对、有人不愿意用，', 'Some understand it, some object, and some refuse to use it.', ['听得懂', '反对', '不愿用']],
  ['这些都不是噪音。', 'None of that is noise.', ['不是噪音']],
  ['它们其实在真正地告诉我们：', 'They are telling us something real:', ['真实反馈']],
  ['我们的理解和真实世界，究竟差在哪里。', 'where our understanding differs from reality.', ['理解', '真实世界']],
  ['我们的大脑本来就是一台推测机器。', 'The human brain is itself a prediction machine.', ['推测机器']],
  ['AI不会自动把它校准。', 'AI does not automatically calibrate it.', ['不会自动校准']],
  ['恰恰相反，一个被现实校准过的判断，', 'On the contrary, a judgment calibrated by reality', ['现实校准']],
  ['经过AI包装以后，只会更快、更完整，也更像真的。', 'can become faster, more complete, and more convincing after AI packaging.', ['更快', '更完整', '更像真的']],
  ['所以这次工业革命，普通人真正得到的，', 'What ordinary people truly gain from this industrial revolution', ['普通人得到']],
  ['不是一个保证逆袭的按钮。', 'is not a button that guarantees a reversal of fortune.', ['不是逆袭按钮']],
  ['我们得到的，是调用认知生产力的资格。', 'It is the qualification to call on cognitive productivity.', ['调用资格']],
  ['但自己的位置，', 'But your own position', ['自己的位置']],
  ['还得靠解释、转化、判断和反馈，一点点建设。', 'must be built through explanation, transformation, judgment, and feedback.', ['解释', '转化', '判断', '反馈']],
  ['AI站在通用认知生产力这一层。', 'AI stands at the general cognitive productivity layer.', ['AI', '通用认知生产力']],
  ['普通人最值得站住的，是它通往真实需求和真实结果的最后一段。', 'The layer ordinary people should hold is the final mile to real needs and real outcomes.', ['普通人', '真实需求', '真实结果']],
  ['这次别只做一个使用AI的人。', 'This time, do not merely be someone who uses AI.', ['别只使用AI']],
  ['试着把那个能把AI能力真正送到现实里的人。', 'Try to be the person who brings AI capability into reality.', ['送到现实']],
  ['我是超哥，我在兰州AI创业。', 'I am Chao, building an AI venture in Lanzhou.', ['超哥', '兰州AI创业']],
].map(([zh, en, highlights]) => ({zh, en, highlights}));

const normalizeCharacters = (text) =>
  [...String(text)]
    .filter((character) => /[\p{L}\p{N}]/u.test(character))
    .map((character) => character.toLowerCase());

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rawWords = Array.isArray(raw.words) ? raw.words : [];
const rawUnits = rawWords.flatMap((word, wordIndex) => {
  const characters = normalizeCharacters(word.text ?? '');
  if (characters.length === 0) return [];
  const startMs = Number(word.start ?? 0) * 1000;
  const endMs = Math.max(startMs + 20, Number(word.end ?? word.start ?? 0) * 1000);
  return characters.map((character, characterIndex) => ({
    text: character,
    startMs: startMs + ((endMs - startMs) * characterIndex) / characters.length,
    endMs: startMs + ((endMs - startMs) * (characterIndex + 1)) / characters.length,
    confidence: Number.isFinite(Number(word.logprob))
      ? Math.exp(Number(word.logprob))
      : Number.isFinite(Number(word.confidence))
        ? Number(word.confidence)
        : null,
    wordIndex,
  }));
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
      wordIndex: null,
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
    raw_word_index: unit.wordIndex,
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
    highlights: page.highlights ?? [],
  });
  pageStartMs = pageEndMs;
}

const sourceNormalized = rawUnits.map((unit) => unit.text).join('');
const timeForAnchor = (anchor) => {
  const normalized = normalizeCharacters(anchor).join('');
  const startIndex = sourceNormalized.indexOf(normalized);
  if (startIndex < 0) {
    throw new Error(`找不到时间锚点：${anchor}`);
  }
  const endIndex = startIndex + normalized.length - 1;
  return {
    start: rawUnits[startIndex].startMs / 1000,
    end: rawUnits[endIndex].endMs / 1000,
  };
};

const sfx = {
  cardA: ['soft-card-pop', 'soft-card-pop-a.wav', 0.13],
  cardB: ['soft-card-pop', 'soft-card-pop-b.wav', 0.13],
  line: ['line-connect', 'line-connect-a.wav', 0.12],
  tickA: ['list-tick', 'list-tick-a.wav', 0.11],
  tickB: ['list-tick', 'list-tick-b.wav', 0.11],
  chapter: ['chapter-sweep', 'chapter-sweep-a.wav', 0.15],
  mediaA: ['media-whoosh', 'media-whoosh-a.wav', 0.16],
  mediaB: ['media-whoosh', 'media-whoosh-b.wav', 0.16],
  paper: ['evidence-paper', 'evidence-paper-a.wav', 0.12],
  settle: ['number-settle', 'number-settle-a.wav', 0.14],
  cta: ['cta-confirm', 'cta-confirm-a.wav', 0.15],
};

const eventDefinitions = [
  {anchor: '千万别再只会', component: 'statement', title: '别只做答案消费者', detail: '会搜索答案，不等于能把AI送进现实。', items: ['搜索', '判断', '行动'], sfx: sfx.chapter},
  {anchor: '一味地跟风用AI', component: 'comparison', title: '跟风使用 ≠ 建立位置', detail: '开场比例只按原声呈现，不包装成统计证据。', items: ['跟风玩工具', '建立自己的位置'], sfx: sfx.cardA},
  {anchor: '前三次工业革命', component: 'timeline', title: '前三次：先拿到产品', detail: '普通人通常先接触生产线制造出来的商品。', items: ['生产线', '规模制造', '大众产品'], sfx: sfx.line},
  {anchor: '但这一次有件事可能变了', component: 'comparison', title: '这一次，入口可能变了', detail: '从“拿到一件产品”走向“调用一条认知生产线”。', items: ['AI产品', '认知生产线'], sfx: sfx.cardB},
  {anchor: '而是一条可以装进电脑和手机里', component: 'generated-broll', title: '认知生产线进入个人设备', detail: '知识、案例与工具开始被个人直接调用。', src: 'media/ai-cognitive-position-20260810/S01_认知生产线进入个人设备_16x9.mp4', requestId: 'S01', sfx: sfx.mediaA, opaque: true},
  {anchor: '先问一个更重要的问题', component: 'statement', title: '先问位置，不先问替代', detail: '技术会替代谁，不如先看自己站在哪一层。', items: ['AI在哪一层', '普通人在哪一层'], sfx: sfx.paper},
  {anchor: 'AI在第四次工业革命里站在哪一层', component: 'layer-map', title: '两层位置图', detail: 'AI提供通用认知能力，普通人连接真实需求与结果。', items: ['AI：通用认知生产力', '普通人：现实最后一段'], sfx: sfx.settle},
  {anchor: '第四次工业革命不只等于AI', component: 'statement', title: '第四次工业革命 ≠ 只有AI', detail: '这里聚焦AI在整轮技术变化中的认知作用。', items: ['技术变化', '认知能力'], sfx: sfx.cardA},
  {anchor: '过去只有团队和组织', component: 'flow', title: '团队能力 → 个人可调用', detail: '一部分认知工作开始从组织能力下放到个人。', items: ['团队与组织', 'AI能力入口', '个人调用'], sfx: sfx.line},
  {anchor: '文明级认知能力', component: 'definition', title: '文明级认知能力', detail: '这是本条视频采用的观点表达，不是官方技术分级。', items: ['知识', '案例', '比较', '调用'], sfx: sfx.chapter},
  {anchor: '不是说问AI几句话', component: 'comparison', title: '不是“问几句就全懂”', detail: '能力入口变宽，不代表判断自动正确。', items: ['突然拥有智慧', '扩大可调用范围'], sfx: sfx.cardB},
  {anchor: '过去一个人很难接触读完比较', component: 'flow', title: '接触 → 读完 → 比较 → 调用', detail: '过去难以完成的知识处理，开始更容易被个人发起。', items: ['接触', '读完', '比较', '调用'], sfx: sfx.line},
  {anchor: '通用认知生产力', component: 'definition', title: 'AI站在这一层', detail: '通用认知生产力：扩展个人可调用的知识与方法。', items: ['通用', '认知', '生产力'], sfx: sfx.settle},
  {anchor: '再往上才是现实世界', component: 'question-grid', title: '再往上，才是现实世界', detail: '四个问题决定知识能否落地。', items: ['谁真有问题', '信息仍成立吗', '换人群怎么改', '谁使用并付费'], sfx: sfx.tickA},
  {anchor: '这些问题大模型没法替你', component: 'statement', title: '大模型不能一次替你回答', detail: '现实条件会变化，结果必须由现场反馈确认。', items: ['条件变化', '现场验证'], sfx: sfx.cardA},
  {anchor: '模型能读到很多人的过去', component: 'comparison', title: '读得到过去，看不到今天的犹豫', detail: '公开知识很丰富，眼前人的真实顾虑却不在模型里。', items: ['很多人的过去', '这个人的今天'], sfx: sfx.cardB},
  {anchor: '它能生成十套答案', component: 'comparison', title: '能生成十套，不承担一套', detail: '模型负责生成，人必须为选择和结果负责。', items: ['生成答案', '承担结果'], sfx: sfx.settle},
  {anchor: '不是在模型下面当一个答案消费者', component: 'layer-map', title: '不在模型下，也不装在模型上', detail: '真正可建立的位置，在AI能力与现实反馈之间。', items: ['答案消费者', '假装全懂', '现实连接者'], sfx: sfx.chapter},
  {anchor: '站在AI和现实之间', component: 'generated-broll', title: '站在AI和现实之间', detail: '一边调用知识，一边走进真实场景。', src: 'media/ai-cognitive-position-20260810/S02_AI与现实之间_16x9.mp4', requestId: 'S02', sfx: sfx.mediaB, opaque: true},
  {anchor: '你负责把知识变成具体判断', component: 'comparison', title: 'AI负责扩大，你负责落地', detail: '把知识变成判断，再把判断推进真实反馈。', items: ['AI：扩大世界', '你：判断与反馈'], sfx: sfx.line},
  {anchor: '这个位置怎么建立', component: 'four-rights', title: '四项权利，建立自己的位置', detail: '调用权、解释权、转化权、校准权。', items: ['调用权', '解释权', '转化权', '校准权'], sfx: sfx.chapter},
  {anchor: '第一个调用权', component: 'call-demo', title: '调用权：不要只收一个结论', detail: '从一个问题同时展开原文、案例和反对意见。', items: ['原文', '真实案例', '反对意见'], sfx: sfx.paper, opaque: true},
  {anchor: '第二个解释权', component: 'question-grid', title: '解释权：先回答四个问题', detail: '写不出来，说明信息还没有变成你的知识。', items: ['讲了什么', '为什么成立', '解决谁', '何时失效'], sfx: sfx.tickB},
  {anchor: '写不出来其实不丢人', component: 'statement', title: '写不出来，不丢人', detail: '这只说明信息还没有变成你自己的知识。', items: ['信息', '解释', '个人知识'], sfx: sfx.cardB},
  {anchor: '第三个转化权', component: 'definition', title: '转化权', detail: '真正有价值的不是神秘答案，而是可适配的判断过程。', items: ['判断过程', '条件边界'], sfx: sfx.cardA},
  {anchor: '判断过程', component: 'flow', title: '价值藏在判断过程里', detail: '不是搬运结论，而是看清它怎样被反复验证和使用。', items: ['结论', '条件', '判断过程'], sfx: sfx.line},
  {anchor: '反复交学费', component: 'comparison', title: '一边是常识，一边在重复试错', detail: '转化的价值，是把已验证常识适配到眼前问题。', items: ['已验证常识', '重复交学费'], sfx: sfx.cardA},
  {anchor: '用AI拆清条件翻译逻辑重新适配', component: 'flow', title: '拆条件 → 翻译逻辑 → 重新适配', detail: '把通用常识变成更省时间、更少试错的决策路径。', items: ['拆条件', '翻译', '适配', '决策路径'], sfx: sfx.line},
  {anchor: '第四个校准权', component: 'feedback-loop', title: '校准权：最小版本先出去', detail: '反馈不是噪音，它在标出理解与现实的距离。', items: ['最小版本', '真实反馈', '修改', '再测试'], sfx: sfx.chapter},
  {anchor: '有人听得懂有人反对有人不愿意用', component: 'three-feedbacks', title: '听得懂 / 反对 / 不愿用', detail: '本段字幕忠实呈现原声，不替换成锁定稿措辞。', items: ['理解', '反对', '拒绝使用'], sfx: sfx.tickA},
  {anchor: '大脑本来就是一台推测机器', component: 'statement', title: '大脑会推测，AI不会自动校准', detail: '没有现实反馈，完整表达也可能只是更像真的。', items: ['推测', '校准'], sfx: sfx.cardB},
  {anchor: '经过AI包装以后', component: 'generated-broll', title: 'AI会放大表达，不替你验真', detail: '画面是AI生成概念演示，不作为事实或效果证据。', src: 'media/ai-cognitive-position-20260810/S03_未经校准的判断被放大_16x9.mp4', requestId: 'S03', sfx: sfx.mediaA, opaque: true},
  {anchor: '我们得到的是调用认知生产力', component: 'definition', title: '得到的是调用资格', detail: '不是保证逆袭的按钮，位置仍要靠行动与反馈建设。', items: ['解释', '转化', '判断', '反馈'], sfx: sfx.settle},
  {anchor: 'AI站在通用认知生产力这一层', component: 'layer-map', title: 'AI在通用层，人在最后一段', detail: '普通人最值得占住的，是通往真实需求和结果的连接。', items: ['通用认知生产力', '真实需求', '真实结果'], sfx: sfx.line},
  {anchor: '试着把那个能把AI能力真正送到现实里的人', component: 'generated-broll', title: '把AI能力真正送到现实里', detail: '从能力调用走向真实场景、真实使用与真实结果。', src: 'media/ai-cognitive-position-20260810/S04_把AI能力送到现实_16x9.mp4', requestId: 'S04', sfx: sfx.mediaB, opaque: true},
  {anchor: '我是超哥我在兰州AI创业', component: 'closing', title: '超哥AI创业记', detail: '我在兰州AI创业', items: ['AI能力', '真实场景', '持续验证'], sfx: sfx.cta},
];

const timedEvents = eventDefinitions
  .map((definition, index) => ({
    ...definition,
    index,
    start: Math.max(0, timeForAnchor(definition.anchor).start - 0.06),
  }))
  .sort((left, right) => left.start - right.start)
  .map((event, index, events) => {
    const nextStart = events[index + 1]?.start ?? durationSeconds;
    const preferredDuration = event.src ? 6.05 : 11.2;
    return {
      ...event,
      end: Math.min(durationSeconds, nextStart - 0.06, event.start + preferredDuration),
    };
  });

const eventId = (index) => `cog-v${String(index + 1).padStart(3, '0')}`;
const cueId = (index) => `cog-sfx-${String(index + 1).padStart(3, '0')}`;
const visualLayers = timedEvents.map((event, index) => {
  const [role, filename] = event.sfx;
  const id = eventId(index);
  const fullScreen = Boolean(event.opaque);
  return {
    id: `cognitive-${String(index + 1).padStart(2, '0')}-${event.component}`,
    start: Number(event.start.toFixed(3)),
    end: Number(event.end.toFixed(3)),
    spokenLine: event.anchor,
    purpose: event.component === 'call-demo' ? 'replace-missing-real-screen-recording' : 'semantic-emphasis',
    kind: fullScreen ? 'full-screen-asset' : 'transparent-semantic-information',
    variant: event.component,
    titleOwner: true,
    overlapGroup: id,
    zone: fullScreen ? 'full-screen' : 'left-safe',
    title: event.title,
    detail: event.detail,
    items: event.items ?? [],
    asset: {
      sourceType: event.src ? 'user-generated-ai-video' : 'remotion-component',
      source: event.src
        ? `remotion/public/${event.src}`
        : `AICognitivePositionV73/${event.component}`,
    },
    assetDecision: {
      class: event.src ? 'generated-video' : 'remotion-information',
      producer: event.src ? 'user' : 'codex-remotion',
      requestId: event.src ? event.requestId : event.component === 'call-demo' ? 'R02-degraded-explicitly' : null,
      fallback: 'speaker-plus-information',
    },
    visualEvent: {id, enterAt: Number(event.start.toFixed(3)), primary: true},
    sound: {
      policy: 'required',
      role,
      cueId: cueId(index),
      offsetFrames: 0,
      maxSyncErrorFrames: 2,
    },
    params: {
      component: event.component,
      title: event.title,
      detail: event.detail,
      items: event.items ?? [],
      src: event.src,
      disclosure:
        event.src
          ? 'AI生成·概念画面'
          : event.component === 'call-demo'
            ? '流程演示·非真实平台录屏'
            : undefined,
    },
    checks: {
      avoidFace: !fullScreen,
      avoidHands: !fullScreen,
      avoidSubtitle: true,
      needsFrameReview: true,
      continuousReviewIntervalSeconds: fullScreen ? null : 0.5,
      reviewAt: Number(((event.start + event.end) / 2).toFixed(3)),
    },
  };
});

const visualPlan = {
  schemaVersion: 3,
  experiment: {id: 'v73-media-sfx-speed', status: 'ready-for-next-video-validation'},
  videoId: 'AI_COGNITIVE_POSITION_20260810_talk01',
  videoTitle: 'AI在第四次工业革命里站哪一层',
  sourceVideo: 'source/20260810_ai_cognitive_position/R01_AI第四次工业革命_口播原片.MOV',
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: ['v72-user-verified-20260730', 'v73-transparent-events-and-sfx'],
  target: {aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin'},
  style: {
    brandLine: '超哥AI创业记',
    palette: {ink: '#F7FAFF', cyan: '#62D8FF', yellow: '#FFD23F', green: '#67D8A0', orange: '#FF7A45'},
    motion: {enter: 'spring', exit: 'fade', avoidLinearEasing: true},
  },
  safeAreas: {
    subtitle: {x: 300, y: 820, width: 1320, height: 190},
    face: {x: 820, y: 105, width: 620, height: 675},
    hands: {x: 660, y: 520, width: 900, height: 430},
  },
  previewCoverage: ['hook', 'complex-overlay', 'full-screen-asset', 'missing-recording-replacement', 'cta', 'all-new-sfx-roles'],
  layers: visualLayers,
};

const cues = timedEvents.map((event, index) => {
  const [role, filename, volume] = event.sfx;
  return {
    id: cueId(index),
    visualEventId: eventId(index),
    role,
    start: Number(event.start.toFixed(3)),
    end: Number((event.start + 0.8).toFixed(3)),
    source: `remotion/public/audio/koubo-sfx-v3-candidates/${filename}`,
    license: 'Mixkit Free License；详见assets/sfx/koubo-sfx-v3-candidates/manifest.json',
    volume,
    voiceDuckDb: 0,
    previewCovered: false,
    formalReviewed: false,
    userAudibilityConfirmed: false,
  };
});

const sfxCueSheet = {
  schemaVersion: 2,
  videoId: 'AI_COGNITIVE_POSITION_20260810_talk01',
  version: 'v1',
  experimentId: 'v73-cognitive-position-full-coverage',
  cues,
  coverageReview: {
    primaryVisualEventCount: visualLayers.length,
    coveredPrimaryVisualEventCount: cues.length,
    coveragePercent: 100,
    maxSyncErrorFrames: 2,
    machineStatus: 'passed',
    userAudibilityConfirmed: false,
    notes: `${visualLayers.length}个主视觉事件全部通过同一visualEventId绑定本地音效；正式听感待用户预览确认。`,
  },
};

const transcriptText = pages.map((page) => page.zh).join('');
const cleaned = {
  schema_version: 1,
  source: path.relative(projectRoot, rawPath),
  method: 'ElevenLabs Scribe v2词级转写 + 用户锁定稿对照 + 真实口语差异保留 + 全局字符时间映射',
  language: 'zh',
  duration_seconds: durationSeconds,
  text: transcriptText,
  words,
  pages: bilingual,
  correction_policy: '字幕跟随真实原声；修正可由上下文确认的ASR错字，但不把三处已接受的口语差异伪装成锁定稿。',
};

const comparison = {
  schema_version: 1,
  source_video: 'source/20260810_ai_cognitive_position/R01_AI第四次工业革命_口播原片.MOV',
  approved_script: 'notes/2026-08-10-AI第四次工业革命普通人位置-用户最终确认原稿-v1.md',
  user_decision: '不纠正，就按这个继续',
  policy: '完整保留真实原声，字幕按实际口播校正；视觉层不掩盖语义变化。',
  accepted_semantic_variants: [
    {locked: '有人听不懂', spoken: '有人听得懂'},
    {locked: '一个没被现实校准过的判断', spoken: '一个被现实校准过的判断'},
    {locked: '试着做那个能把AI的能力真正送到现实里的人', spoken: '试着把那个能把AI能力真正送到现实里的人'},
  ],
  omitted_core_sections: [],
  repeated_full_sections: [],
  ending_complete: true,
  retake_or_cut_required: false,
};

for (const [targetPath, value] of [
  [cleanedPath, cleaned],
  [bilingualPath, bilingual],
  [comparisonPath, comparison],
  [visualPlanEditPath, visualPlan],
  [visualPlanRemotionPath, visualPlan],
  [sfxEditPath, sfxCueSheet],
  [sfxRemotionPath, sfxCueSheet],
]) {
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
fs.mkdirSync(path.dirname(textPath), {recursive: true});
fs.writeFileSync(textPath, `${transcriptText}\n`, 'utf8');

console.log(`原始词级单元：${rawUnits.length}`);
console.log(`字幕校正字符：${words.length}`);
console.log(`中英字幕页：${bilingual.length}`);
console.log(`全局编辑距离：${distance.at(-1).at(-1)}`);
console.log(`主视觉与音效事件：${visualLayers.length}`);
console.log(`首个事件：${visualLayers[0].start}s`);
console.log(`末个事件：${visualLayers.at(-1).start}s`);
