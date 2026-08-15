import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(
  projectRoot,
  'edit/20260815_ai_delivery_filter/transcripts/AI_DELIVERY_FILTER_20260815_talk01_whisper-small-v1.json',
);
const cleanedPath = path.join(
  projectRoot,
  'edit/20260815_ai_delivery_filter/transcripts/AI_DELIVERY_FILTER_20260815_talk01.cleaned.v1.json',
);
const bilingualPath = path.join(
  projectRoot,
  'remotion/public/data/AI_DELIVERY_FILTER_20260815_talk01.bilingual.v1.json',
);
const textPath = path.join(
  projectRoot,
  'edit/20260815_ai_delivery_filter/transcripts/AI_DELIVERY_FILTER_20260815_talk01.cleaned.v1.txt',
);
const comparisonPath = path.join(
  projectRoot,
  'edit/20260815_ai_delivery_filter/transcripts/AI_DELIVERY_FILTER_20260815_talk01.script-comparison.v1.json',
);

const durationMs = 332333;

const pages = [
  ['现在AI圈最魔幻的事，', 'The strangest thing in AI right now'],
  ['不是工具更新得有多快。', 'is not how fast the tools change.'],
  ['是你会刷到一种很奇怪的感觉：', 'It is the strange pattern you keep seeing:'],
  ['一群没有做过生意的人，', 'people who have never run a business'],
  ['在教做生意的人怎么用AI赚钱。', 'teaching owners how to make money with AI.'],
  ['一群没有带过团队的人，', 'People who have never led a team'],
  ['在教老板怎么用AI管理团队。', 'teaching bosses how to manage one with AI.'],
  ['还有一些自己手里的项目还都没有完成，', 'Some have not even finished their own projects,'],
  ['还都没有跑通，', 'let alone made them work,'],
  ['就已经开始讲三个月翻身、半年复制、自动成交。', 'yet already promise turnarounds, replication, and automatic sales.'],
  ['老板们看到这儿啊，', 'When business owners see this,'],
  ['也别批判这些人配不配讲AI。', 'do not start by judging who deserves to teach AI.'],
  ['而是他们说的这套东西，', 'Ask whether what they describe'],
  ['如果放进咱们自己的生意里面，', 'can be brought into your own business'],
  ['到底能不能交付。', 'and actually delivered.'],
  ['你就想一下对方讲的：', 'Think about the claims you hear:'],
  ['AI可以帮你做短视频，', 'AI can make short videos,'],
  ['帮你自动回复客户，', 'automatically reply to customers,'],
  ['帮你管销售，', 'manage sales,'],
  ['帮你把私域跑起来。', 'and run your private traffic.'],
  ['每一句好像都没有错。', 'Every sentence sounds plausible.'],
  ['但是你把这套方案拉回自己的店里，', 'But bring the plan back into your own store'],
  ['问题马上就变了。', 'and the questions immediately change.'],
  ['你的客户从哪里进来？', 'Where do your customers come from?'],
  ['咨询的问题散在哪些地方？', 'Where are their inquiries scattered?'],
  ['员工哪句话经常会答错？', 'Which questions do staff often answer incorrectly?'],
  ['成交失败，是客户没有看懂，', 'When a sale fails, did the customer not understand,'],
  ['还是价格没有谈拢，', 'did the price negotiation fail,'],
  ['还是后面的服务接不住？', 'or could the service not support the deal?'],
  ['如果这些问题都没有问清楚的话，', 'If none of these questions is clarified'],
  ['只给你演示一个工具界面，', 'and you only see a tool interface,'],
  ['那它可能解决的不是你的生意上的问题。', 'it may not be solving your business problem.'],
  ['它只是一个工具动作。', 'It is merely a tool action.'],
  ['这个工具动作可以学，', 'You can learn that action,'],
  ['但别把工具动作当作一个经营的建议。', 'but do not mistake it for business advice.'],
  ['所以我现在看AI赚钱课，', 'So when I look at AI money-making courses'],
  ['或者看AI服务方案，', 'or AI service proposals,'],
  ['先看第一件事：', 'I first check one thing:'],
  ['它有没有把一个真实的问题，', 'has it translated a real problem'],
  ['翻译成可交付的任务？', 'into a deliverable task?'],
  ['什么是可交付？', 'What does deliverable mean?'],
  ['不是一句“我帮你降本增效”，', 'Not simply saying, “I will cut costs and raise efficiency.”'],
  ['而是你给它什么资料，', 'It means what material you provide,'],
  ['它处理哪一步，', 'which step it handles,'],
  ['最后交回来什么东西，', 'what it returns,'],
  ['老板拿什么验收。', 'and how the owner accepts the result.'],
  ['比如客户咨询很乱，', 'If customer inquiries are chaotic,'],
  ['那交付就不能只叫“AI客服系统”。', 'the deliverable cannot just be called an AI support system.'],
  ['你至少要说清楚：', 'At minimum, explain clearly:'],
  ['把哪些咨询整理出来，', 'which inquiries are collected,'],
  ['分成哪些类型，', 'how they are categorized,'],
  ['哪些客户要跟进，', 'which customers require follow-up,'],
  ['哪些话术要人工确认，', 'which replies need human confirmation,'],
  ['哪一类问题不能让AI自动回复。', 'and which questions AI must never answer automatically.'],
  ['说到这个程度，', 'Only at this level of detail'],
  ['老板才知道自己买的不是一个概念，', 'does the owner know they are buying more than a concept,'],
  ['而是一段能验收的工作。', 'but a piece of work that can be accepted.'],
  ['第二件事，看有没有人愿意付出成本。', 'Second: will anyone pay a real cost?'],
  ['这里的成本，', 'That cost'],
  ['不一定一开始就是大钱。', 'does not have to be a large payment at first.'],
  ['也可能是老板们愿意拿出资料，', 'It may be an owner providing materials,'],
  ['愿意让员工配合，', 'asking staff to cooperate,'],
  ['愿意给一段试用的时间，', 'allowing a trial period,'],
  ['愿意为一个明确的结果付一笔小预算。', 'or paying a small budget for a clear result.'],
  ['很多AI内容看起来很火，', 'A lot of AI content looks popular,'],
  ['其实只验证了一件事：', 'but it proves only one thing:'],
  ['大家愿意看热闹。', 'people enjoy the spectacle.'],
  ['点赞，不等于客户愿意付钱。', 'A like does not mean a customer will pay.'],
  ['收藏，不等于老板愿意拿业务来试。', 'A save does not mean an owner will test it in business.'],
  ['免费帮忙，也不等于需求真的成立。', 'Free help does not prove real demand either.'],
  ['一个问题只有让对方愿意付出成本，', 'Only when someone is willing to bear a cost'],
  ['才说明它在现实里有重量。', 'does the problem carry weight in reality.'],
  ['第三件事，', 'Third:'],
  ['看它能不能从一次服务里面沉淀出共性。', 'can one service reveal reusable patterns?'],
  ['这一点很容易被忽略。', 'This is easily overlooked.'],
  ['一个老板觉得有用，', 'One owner finding it useful'],
  ['不代表它就是产品。', 'does not make it a product.'],
  ['一个案例跑通，', 'One successful case'],
  ['不代表下一个行业也能复制。', 'does not prove it can transfer to another industry.'],
  ['真正有价值的部分，', 'The truly valuable part'],
  ['往往是你做了几次以后发现：', 'often appears after doing the work several times:'],
  ['每个老板都会问哪几类问题？', 'Which questions does every owner ask?'],
  ['每次开工前都缺哪几份资料？', 'Which materials are always missing before work begins?'],
  ['哪些环节必须人来确认？', 'Which steps require human confirmation?'],
  ['哪些输出可以做成模板？', 'Which outputs can become templates?'],
  ['哪些错误一出现，', 'Which errors, once they appear,'],
  ['就说明这个方案该停下来重做？', 'mean the plan should stop and be rebuilt?'],
  ['这些共性沉下来，', 'Once those patterns are preserved,'],
  ['AI才可能从一次演示变成一项服务。', 'AI can move from a demo to a service.'],
  ['否则它就像一个会变魔术的页面，', 'Otherwise it is only a page performing a magic trick:'],
  ['当场看着很厉害，', 'impressive in the room,'],
  ['回到公司却没人会用。', 'but unusable back at the company.'],
  ['第四件事，', 'Fourth:'],
  ['也是老板们最关心的事：', 'the issue owners care about most:'],
  ['出错了以后怎么办？', 'what happens when it goes wrong?'],
  ['AI自动回复说错话，谁检查？', 'Who checks an incorrect AI reply?'],
  ['销售跟着AI话术乱承诺，谁来兜底？', 'Who owns a promise made from a bad AI sales script?'],
  ['员工用了一个新的流程，', 'If staff use a new process'],
  ['反而把原来的协作打乱了，', 'and disrupt the old collaboration,'],
  ['那么这个谁来复盘？', 'who reviews what happened?'],
  ['花了钱以后没有效果，', 'If money is spent without results,'],
  ['是继续加钱，还是换工具，', 'do you spend more, switch tools,'],
  ['还是停下来查原因？', 'or stop and investigate?'],
  ['很多课程最愿意讲“开始”，', 'Many courses love to discuss starting'],
  ['最不愿意讲“失败”。', 'and avoid discussing failure.'],
  ['但对老板来说，', 'But for an owner,'],
  ['不讲失败的处理方案，就是半截方案。', 'a plan without failure handling is only half a plan.'],
  ['因为咱们在真实的生意里面，', 'In real business,'],
  ['最贵的从来不是买工具的那一刻。', 'the most expensive moment is not buying the tool.'],
  ['最贵的是买完以后没人用，', 'It is buying it and having nobody use it,'],
  ['用错了没人管，', 'nobody managing errors,'],
  ['管不了还要继续加钱。', 'and spending more when it cannot be managed.'],
  ['所以我不是说反对AI课，', 'I am not against AI courses,'],
  ['也不是说反对AI服务。', 'nor against AI services.'],
  ['我反对的是那些把AI演示包装成的生意答案。', 'I oppose packaging an AI demo as a business answer.'],
  ['真正靠谱的人，', 'A reliable person'],
  ['不一定一上来就说自己多成功。', 'does not have to begin by claiming success.'],
  ['他反而会把话说得更具体：', 'They will speak more concretely:'],
  ['这件事适合谁，不适合谁。', 'who this fits and who it does not.'],
  ['开始前要准备什么。', 'What must be prepared before starting.'],
  ['中间哪一步必须人工确认。', 'Which step requires human confirmation.'],
  ['最后用什么结果去验收。', 'Which result will be used for acceptance.'],
  ['如果效果不好，', 'If the outcome is poor,'],
  ['先查哪几个原因。', 'which causes should be checked first.'],
  ['这种话听起来没有那么刺激，', 'This may sound less exciting,'],
  ['但是对老板真的有用。', 'but it is genuinely useful to an owner.'],
  ['因为生意不是短视频里的金句。', 'Business is not a catchy line in a short video.'],
  ['生意是有人付成本，', 'Business means someone bears a cost,'],
  ['有人交结果，', 'someone delivers a result,'],
  ['有人使用，', 'someone uses it,'],
  ['有人负责。', 'and someone is accountable.'],
  ['AI进来以后也不能跳过这些东西。', 'AI cannot skip any of these steps.'],
  ['它可以让某些环节变快，', 'It can speed up certain steps,'],
  ['可以让试错成本变低，', 'lower the cost of experimentation,'],
  ['可以让一个小团队先做以前做不起的动作。', 'and let a small team attempt work it once could not afford.'],
  ['但它不能把一个没有需求的项目变成好生意。', 'But it cannot turn a project without demand into a good business.'],
  ['也不能把一个没有交付经验的人，', 'Nor can it turn someone without delivery experience'],
  ['变成老板的商业顾问。', 'into a business adviser.'],
  ['AI圈不缺热闹。', 'The AI world has no shortage of spectacle.'],
  ['普通老板真正缺的是，', 'What ordinary owners truly lack'],
  ['一把能把热闹筛掉的尺子。', 'is a ruler that filters out the noise.'],
  ['我是超哥，在兰州AI创业。', 'I am Chao, building an AI venture in Lanzhou.'],
].map(([zh, en]) => ({zh, en}));

const highlightKeywords = [
  'AI圈最魔幻的事', '没有做过生意', '没有带过团队', '能不能交付',
  '工具动作', '经营的建议', '真实的问题', '可交付的任务', '降本增效',
  '老板拿什么验收', 'AI客服系统', '人工确认', '能验收的工作',
  '付出成本', '看热闹', '愿意付钱', '现实里有重量', '沉淀出共性',
  '不代表它就是产品', '停下来重做', '一次演示', '一项服务',
  '没人会用', '出错了以后怎么办', '谁检查', '谁来兜底', '谁来复盘',
  '半截方案', '没人用', '没人管', 'AI演示', '生意答案', '适合谁',
  '人工确认', '结果去验收', '有人付成本', '有人交结果', '有人使用',
  '有人负责', '试错成本', '没有需求', '交付经验', '商业顾问',
  '筛掉的尺子', '兰州AI创业',
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
  method: 'whisper.cpp small本机离线词级转写 + 用户锁定稿对照 + 实际口语机械校正 + 全局字符时间映射',
  language: 'zh',
  duration_seconds: durationMs / 1000,
  text: transcriptText,
  words,
  pages: bilingual,
  correction_policy: '只修正可由原声上下文和锁定稿共同确认的ASR错字；保留实际口语新增、顺序变化、自然连接词和完整结尾，不删除、压缩或重排原声。',
};

const comparison = {
  schema_version: 1,
  source_video: 'source/20260815_ai_delivery_filter/R01_AI圈最魔幻的事_口播原片.MOV',
  source_sha256: '129cc9538890dfc90324a82f86455065799442fce8b1652b0bec23af6ebbf664',
  approved_script: 'notes/2026-08-15-AI圈最魔幻的事-用户最终执行稿-v2.md',
  policy: '正片全量保留真实原声；字幕按实际口播校正；不删除、压缩、重排或伪造客户案例。',
  observed_differences: [
    {
      type: 'opening_spoken_addition',
      spoken: '还有一些自己手里的项目还都没有完成，还都没有跑通。',
      action: '保留真实口语新增的“还都没有完成”。',
    },
    {
      type: 'audience_spoken_variant',
      spoken: '老板们看到这儿啊；放进咱们自己的生意里面。',
      action: '保留自然口语称呼和连接词。',
    },
    {
      type: 'fourth_gate_spoken_variant',
      spoken: '也是老板们最关心的事；那么这个谁来复盘。',
      action: '按原声保留，不强制改回书面稿。',
    },
    {
      type: 'closing_spoken_variant',
      spoken: '我反对的是那些把AI演示包装成的生意答案；最后用什么结果去验收。',
      action: '保留实际口语中的限定词和“去”。',
    },
  ],
  asr_corrections: [
    '教做生意的人', '教老板', '答错', '价格没有谈拢', '工具界面',
    '客户咨询', '大钱', '试用的时间', '案例跑通', '问哪几类问题',
    '开工前', '缺哪几份资料', '一次演示', '适合谁', '试错成本',
    '做不起的动作', '交付经验', '筛掉的尺子', '我是超哥',
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
