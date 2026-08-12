import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(
  projectRoot,
  'edit/20260812_ai_best_worst/transcripts/AI_BEST_WORST_20260812_talk01_whisper-small-v1.json',
);
const cleanedPath = path.join(
  projectRoot,
  'edit/20260812_ai_best_worst/transcripts/AI_BEST_WORST_20260812_talk01.cleaned.v1.json',
);
const bilingualPath = path.join(
  projectRoot,
  'remotion/public/data/AI_BEST_WORST_20260812_talk01.bilingual.v1.json',
);
const textPath = path.join(
  projectRoot,
  'edit/20260812_ai_best_worst/transcripts/AI_BEST_WORST_20260812_talk01.cleaned.v1.txt',
);
const comparisonPath = path.join(
  projectRoot,
  'edit/20260812_ai_best_worst/transcripts/AI_BEST_WORST_20260812_talk01.script-comparison.v1.json',
);

const durationMs = 525234;

const pages = [
  ['老话说，三十年河东，三十年河西。', 'As the old saying goes, fortune shifts from one side to the other.'],
  ['AI这一次，可能等不了三十年。', 'This time, AI may not wait thirty years.'],
  ['同样一套AI工具，', 'With the very same AI tools,'],
  ['有人用了之后自身价值被稀释，', 'some people see their value diluted,'],
  ['有人却借它把能力无限放大。', 'while others use them to amplify their abilities.'],
  ['从来不是会不会用工具的差距。', 'The difference is not whether you can use the tools.'],
  ['核心区别只有一点：', 'There is only one core distinction:'],
  ['是AI在支配你，还是你掌控AI。', 'does AI control you, or do you control AI?'],
  ['AI负责产出答案，', 'AI produces answers,'],
  ['谁负责判断、取舍、最终定夺，为结果负责？', 'but who judges, chooses, decides, and owns the result?'],
  ['咱们把最近这一周的工作都回想一下。', 'Think back over all the work we did this past week.'],
  ['写方案、回客户、整理资料、做报价，', 'Drafting plans, replying to clients, organizing files, quoting prices,'],
  ['还有选标题、剪视频，', 'choosing titles and editing videos,'],
  ['员工安排等等。', 'arranging staff, and more.'],
  ['AI做出一版方案后，你补了什么？', 'After AI produced a draft, what did you add?'],
  ['又做了哪些决定？最终采用了哪些？', 'What decisions did you make, and what did you finally use?'],
  ['这个问题咱们先放在脑子里，后面都会有答案。', 'Keep that question in mind. The answer will become clear.'],
  ['斯坦福经济学家布林约尔松，', 'Stanford economist Erik Brynjolfsson'],
  ['在一个访谈里讲过一个判断：', 'once made this observation in an interview:'],
  ['未来十年，AI可能带来最好的十年，', 'AI could bring the best decade ahead,'],
  ['也可能带来最坏的十年。', 'or it could bring the worst.'],
  ['这句话是不是听起来很矛盾？', 'Does that sound contradictory?'],
  ['技术创造了更多的价值，是一回事。', 'Technology creating more value is one matter.'],
  ['消费者得到更多便利，是一回事。', 'Consumers gaining more convenience is another.'],
  ['普通劳动者能不能分到更高的收入，', 'Whether ordinary workers receive higher incomes'],
  ['有没有议价能力，又是另外一回事。', 'and retain bargaining power is yet another.'],
  ['所以咱们普通人不能只问一句：', 'So ordinary people cannot ask only one question:'],
  ['AI会不会替代我？', 'Will AI replace me?'],
  ['更现实的问法是：', 'A more realistic question is:'],
  ['我正在做的这些任务，AI进来以后，', 'when AI enters the tasks I perform,'],
  ['是在增强我，还是把我拆成更便宜的一段执行？', 'does it augment me, or reduce me to cheaper execution?'],
  ['我先说个场景。就说客服，', 'Consider customer support as an example.'],
  ['很多标准问题：订单在哪里、怎么退款、规则怎么解释。', 'Many questions are standard: order status, refunds, and rules.'],
  ['企业如果只盯成本，', 'If a company focuses only on cost,'],
  ['就会想让机器回答更多问题，', 'it will want machines to answer more questions,'],
  ['人少一点，流程短一点。', 'with fewer people and shorter processes.'],
  ['这是一种用法。', 'That is one way to use AI.'],
  ['还有另外一种用法，', 'There is another way:'],
  ['是AI站在一线员工旁边给提示。', 'AI can stand beside frontline staff and offer guidance.'],
  ['这个客户可能卡在哪里，', 'Where might this customer be stuck?'],
  ['之前类似的问题怎么处理，哪些话不能说，', 'How were similar cases handled, and what should not be said?'],
  ['处理完以后，哪里要复盘。', 'Afterward, what should be reviewed?'],
  ['尤其是公司来新人，', 'This matters especially for new employees.'],
  ['原来要问老员工、翻资料、犯错再改。', 'They once had to ask veterans, search files, and learn from mistakes.'],
  ['现在AI把很多经验推到他面前之后，', 'Now AI can bring much of that experience to them,'],
  ['他可能会更快地接近熟手。', 'helping them approach experienced performance faster.'],
  ['前一种，是任务被机器拆走。', 'In the first model, machines take tasks away.'],
  ['后一种，是人的能力被放大。', 'In the second, human ability is amplified.'],
  ['布林约尔松讲过“图灵陷阱”。', 'Brynjolfsson has described the Turing Trap.'],
  ['对咱们普通人最有用的地方，', 'What matters most to ordinary people'],
  ['不是术语本身，而是它提醒我们：', 'is not the term itself, but its warning:'],
  ['当一个组织只追求让机器越来越像人，', 'when an organization only makes machines more human-like,'],
  ['目标很容易变成替代人。', 'its goal can easily become replacing people.'],
  ['当AI被设计成帮人看清问题、', 'When AI is designed to help people see problems clearly,'],
  ['检查错误、补足知识、复盘经验，', 'check errors, fill knowledge gaps, and review experience,'],
  ['人就还有成长的位置和空间。', 'people still have room to grow.'],
  ['所以以后看一家公司、一份工作，', 'So when evaluating a company or a job,'],
  ['不要只问它有没有用上AI。', 'do not ask only whether it uses AI.'],
  ['先问一句：AI进来以后，', 'Ask first: after AI arrives,'],
  ['人是学得更快了，还是只剩下更少的活了？', 'do people learn faster, or merely have less work left?'],
  ['如果企业只要短期效率，', 'If a company wants only short-term efficiency'],
  ['不保留训练、复核和带教，', 'and removes training, review, and mentorship,'],
  ['新人表面上变快了，', 'new employees may appear faster,'],
  ['可长期没有地方练自己的判断。', 'but lose the chance to develop judgment over time.'],
  ['这不是说资深的老员工没用了。', 'This does not mean experienced workers are useless.'],
  ['它支持的是低经验员工提升更明显。', 'The evidence shows larger gains for less experienced workers.'],
  ['至于练级台阶会不会被压缩，', 'Whether the learning ladder will be compressed'],
  ['这是结合就业结构延伸出来的风险判断。', 'is a risk inferred from the employment structure.'],
  ['真正要看的是：', 'What really matters is this:'],
  ['AI最先改变的往往不是职业名称，', 'AI often changes task order before job titles,'],
  ['而是职业里面的任务顺序。', 'rearranging the work inside a role.'],
  ['过去一个人先做基础执行，', 'A person once began with basic execution,'],
  ['再接触例外问题，最后慢慢承担判断。', 'then handled exceptions, and gradually took on judgment.'],
  ['现在很多基础执行都会被机器先拿走。', 'Now machines may take many basic tasks first.'],
  ['那新人拿什么来练？企业还愿不愿意带？', 'How will newcomers practice, and will firms still train them?'],
  ['这会影响未来几年很多人的位置。', 'This will shape many people’s positions in the coming years.'],
  ['斯坦福数字经济实验室有一项研究提到：', 'A Stanford Digital Economy Lab study reported that'],
  ['在美国的数据里，', 'in US data,'],
  ['二十二到二十五岁之间，', 'among people aged twenty-two to twenty-five,'],
  ['AI暴露度最高的一批职业里面，', 'in occupations with the highest AI exposure,'],
  ['早期劳动者就业相对下降大约百分之十六。', 'early-career employment fell by about sixteen percent relatively.'],
  ['它不是全球所有年轻人都少百分之十六，', 'This does not mean all young people worldwide fell sixteen percent,'],
  ['也不是所有的行业都这样。', 'nor does it apply to every industry.'],
  ['它限定的是美国、特定年龄段、', 'It is limited to the United States, a specific age group,'],
  ['AI暴露度高的职业。', 'and occupations with high AI exposure.'],
  ['它提醒的是，', 'What it warns us is that'],
  ['压力先会落在一种标准化、容易检查、', 'pressure may first hit standardized, easily checked'],
  ['企业又愿意直接自动化的入门执行上。', 'entry-level tasks that firms are willing to automate.'],
  ['所以别急着查哪个职业会消失。', 'Do not rush to search for which jobs will disappear.'],
  ['职业这个词太大了。', 'A job title is too broad.'],
  ['销售不是只会卖东西，设计师不是只会出图，', 'Sales is not only selling, and design is not only producing images.'],
  ['会计不是只会填表，老板也不是只会拍板。', 'Accounting is not only forms, and leadership is not only decisions.'],
  ['咱们要拆具体动作。', 'We need to break work into specific actions.'],
  ['哪些动作是AI能够很快先做一版？', 'Which actions can AI draft quickly?'],
  ['哪些动作必须知道行业背景？', 'Which require industry context?'],
  ['哪些动作要听懂真实的人？', 'Which require understanding real people?'],
  ['哪些动作最后要由你判断、解释和承担责任？', 'Which still require your judgment, explanation, and accountability?'],
  ['你的位置不在职业名称里，', 'Your position is not inside a job title,'],
  ['而是在这些任务里面。', 'but inside these tasks.'],
  ['还有很多老板会有另外一个困惑：', 'Many business owners have another question:'],
  ['AI现在这么强，', 'AI is already so powerful,'],
  ['为什么公司用了以后，好像也没有马上多赚钱？', 'so why do companies not immediately earn more after using it?'],
  ['这个可以用生产率J曲线去解释。', 'The productivity J-curve helps explain this.'],
  ['说简单一点，', 'Put simply,'],
  ['通用技术不是装上就能见效。', 'a general-purpose technology does not pay off upon installation.'],
  ['就像电力进工厂的时候，', 'When electricity entered factories,'],
  ['也不是把蒸汽机换成电机就完了。', 'it was not enough to swap a steam engine for a motor.'],
  ['工厂布局、生产流程、管理方式、人的技能，', 'Factory layout, production processes, management, and skills'],
  ['都得跟着改。', 'all had to change.'],
  ['AI也是一样。', 'AI works the same way.'],
  ['模型今天更新了，公司流程不会明天自动更新。', 'A model may update today, but company processes will not update tomorrow.'],
  ['员工开了会员，老板买了工具，', 'Employees buy subscriptions and owners buy tools,'],
  ['但客户怎么来、数据怎么流、', 'but how customers arrive and how data flows,'],
  ['谁复核、谁负责，错了谁去改，', 'who reviews, who is accountable, and who fixes errors,'],
  ['这些不变的话，AI很容易停在演示层。', 'if these remain unchanged, AI easily stays at the demo stage.'],
  ['所以未来几年，三件事可能会同时发生：', 'Over the next few years, three things may happen together:'],
  ['模型越来越强，', 'models keep getting stronger,'],
  ['企业还没有完全吃到效率，', 'companies still have not captured the full efficiency,'],
  ['一部分人的旧任务已经先被削弱。', 'while some people’s old tasks have already weakened.'],
  ['咱们在新闻里看到的是巨大繁荣，', 'The news shows us enormous prosperity,'],
  ['回到自己身上，', 'but in our own work,'],
  ['感受到的是报价变低、初稿变便宜，', 'we feel lower prices and cheaper first drafts,'],
  ['老板开始问：这个AI能不能先做你的工作？', 'and bosses ask whether AI can do your work first.'],
  ['作为消费者，我们确实越来越方便。', 'As consumers, we are certainly gaining convenience.'],
  ['搜索、翻译、写作、制图、表格，', 'Search, translation, writing, images, and spreadsheets'],
  ['很多东西以前要花钱、花时间，', 'once cost time and money,'],
  ['现在变便宜了，甚至免费。', 'but are now cheaper or even free.'],
  ['免费数字产品给消费者创造了福利，', 'Free digital products create consumer benefits.'],
  ['消费者更方便了，不等于劳动者更值钱。', 'More convenience does not mean workers become more valuable.'],
  ['技术创造的总价值，是一本账。', 'The total value technology creates is one ledger.'],
  ['消费者拿到的便利，是一本账。', 'The convenience consumers receive is another.'],
  ['劳动者能不能分到收入、有没有议价能力，', 'Whether workers share income and retain bargaining power'],
  ['是另外一本账。', 'is a third ledger.'],
  ['这就是“最好”和“最坏”', 'This is why the best and the worst'],
  ['可以同时发生的原因。', 'can happen at the same time.'],
  ['社会更方便了，', 'Society can become more convenient,'],
  ['不等于咱们出售的能力更稀缺了。', 'without the skills we sell becoming scarcer.'],
  ['那我们今天能做什么？', 'So what can we do today?'],
  ['从现在到未来几年，我觉得就做这三件事。', 'From now through the next few years, focus on three things.'],
  ['第一，保留你现在的真实领域。', 'First, retain a real field of practice.'],
  ['不要只做“会用AI的人”。', 'Do not become merely a person who can use AI.'],
  ['你要知道一个行业、一个客户、', 'Understand an industry, a customer,'],
  ['一类场景里面，真实的问题到底长什么样。', 'and what real problems look like in a specific setting.'],
  ['第二，就是留下可复用的资产。', 'Second, preserve reusable assets.'],
  ['每次用AI解决问题，', 'Whenever you solve a problem with AI,'],
  ['把流程、模板、案例、反馈，', 'keep the process, templates, cases, and feedback,'],
  ['还有失败记录，一定要留下来。', 'as well as the record of failure.'],
  ['AI让一次执行更便宜，', 'AI makes one execution cheaper,'],
  ['你要让一次经验能被下一次调用。', 'so make that experience reusable next time.'],
  ['第三，用真实的任务', 'Third, use real tasks'],
  ['持续去校准。', 'to keep calibrating.'],
  ['固定拿你手里现在干的事去试：', 'Repeatedly test the work already in your hands:'],
  ['哪里省时间，哪里出错，哪里还需要人，', 'where time is saved, where errors occur, and where people remain necessary,'],
  ['哪里必须由你来拍板。', 'and where you must make the final decision.'],
  ['所以我们现在就回到开头：', 'Now return to the opening:'],
  ['三十年河东，三十年河西。', 'fortune shifts from one side to the other.'],
  ['这一次，位置变化不需要三十年。', 'This time, positions will change in less than thirty years.'],
  ['但决定你位置的，', 'What determines your position'],
  ['也不是今天你装了哪个AI、用了哪些工具、', 'is not which AI you installed or which tools you used,'],
  ['背了哪个提示词。', 'nor which prompt you memorized.'],
  ['未来十年真正值得积累的是：', 'What is truly worth building over the next decade is this:'],
  ['你能不能看懂真实问题，', 'can you understand real problems,'],
  ['组织机器和工具，留下资产，', 'organize machines and tools, preserve assets,'],
  ['并对结果负责。', 'and take responsibility for results?'],
  ['AI会放大人的意图。', 'AI amplifies human intent.'],
  ['问题是，你的意图到底指向哪里？', 'The question is: where does your intent point?'],
  ['我是超哥，在兰州AI创业。', 'I am Chao, building an AI venture in Lanzhou.'],
].map(([zh, en]) => ({zh, en}));

const highlightKeywords = [
  '三十年', 'AI', '价值被稀释', '能力无限放大', '支配你', '掌控AI',
  '判断', '取舍', '结果负责', '最好的十年', '最坏的十年', '议价能力',
  '增强我', '便宜的执行', '客服', '成本', '复盘', '熟手', '图灵陷阱',
  '替代人', '成长', '复核', '带教', '低经验员工', '风险判断', '任务顺序',
  '16%', '百分之十六', '美国', '二十二到二十五岁', '标准化', '自动化',
  '行业背景', '真实的人', '承担责任', 'J曲线', '电力', '工厂布局', '生产流程',
  '演示层', '模型越来越强', '旧任务', '报价变低', '初稿变便宜', '消费者',
  '劳动者', '总价值', '真实领域', '可复用的资产', '校准', '真实问题',
  '组织机器和工具', '留下资产', '意图', '兰州AI创业',
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
  method: 'whisper.cpp small本机离线词级转写 + 用户锁定稿对照 + 实际口语变化校正 + 全局字符时间映射',
  language: 'zh',
  duration_seconds: durationMs / 1000,
  text: transcriptText,
  words,
  pages: bilingual,
  correction_policy: '只修正可由原声上下文和锁定稿共同确认的ASR错字；保留实际口语新增、顺序变化、自然连接词和完整结尾，不删除、压缩或重排原声。',
};

const comparison = {
  schema_version: 1,
  source_video:
    '/Users/pc/Desktop/口播素材/2026-08-12_AI在支配你还是你掌控AI/01_口播原片/R01_AI在支配你还是你掌控AI_口播原片.MOV',
  source_sha256: '7942825af44a009787e845e921e8f4dd8b2c1dd2e3ab68126b75d708cb0d94ab',
  approved_script: 'notes/2026-08-12-AI在支配你还是你掌控AI-用户最终录制稿-v1.md',
  policy: '正片全量保留真实原声；字幕按实际口播校正；研究结论继续保留地域、年龄、职业暴露度和相对变化边界。',
  observed_differences: [
    {
      type: 'work_list_spoken_variant',
      spoken: '最近这一周；还有选标题、剪视频、员工安排等等。',
      action: '按真实口语保留，不强行改回书面稿顺序。',
    },
    {
      type: 'action_bridge_spoken_variant',
      spoken: '从现在到未来几年，我觉得就做这三件事。',
      action: '保留自然连接词“我觉得”。',
    },
    {
      type: 'closing_spoken_addition',
      spoken: '也不是今天你装了哪个AI、用了哪些工具、背了哪个提示词。',
      action: '完整保留新增的“用了哪些工具”。',
    },
  ],
  asr_corrections: [
    '三十年河东，三十年河西', '产出答案', '为结果负责', '一版方案',
    '布林约尔松', '议价能力', '只盯成本', '复盘', '新人', '熟手',
    '图灵陷阱', '术语本身', '越来越像人', '复核和带教', '风险判断',
    '斯坦福数字经济实验室', '只会', '出图', '填表', '拍板', 'J曲线',
    '数据怎么流', '谁复核、谁负责', '不变', '巨大繁荣', '初稿',
    '可复用', '校准', '回到开头', '兰州AI创业',
  ],
  omitted_core_sections: [],
  repeated_full_sections: [],
  ending_complete: true,
  retake_or_cut_required: false,
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
console.log(`脚本差异：${comparisonPath}`);
