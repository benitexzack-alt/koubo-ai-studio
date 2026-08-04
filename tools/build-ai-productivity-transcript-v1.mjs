import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(
  projectRoot,
  'edit/20260804_ai_productivity/transcripts/AI_PRODUCTIVITY_20260804_talk01_whisper-small-v1.json',
);
const cleanedPath = path.join(
  projectRoot,
  'edit/20260804_ai_productivity/transcripts/AI_PRODUCTIVITY_20260804_talk01.cleaned.v1.json',
);
const bilingualPath = path.join(
  projectRoot,
  'remotion/public/data/AI_PRODUCTIVITY_20260804_talk01.bilingual.v1.json',
);
const textPath = path.join(
  projectRoot,
  'edit/20260804_ai_productivity/transcripts/AI_PRODUCTIVITY_20260804_talk01.cleaned.v1.txt',
);
const comparisonPath = path.join(
  projectRoot,
  'edit/20260804_ai_productivity/transcripts/AI_PRODUCTIVITY_20260804_talk01.script-comparison.v1.json',
);

const pages = [
  ['不知道大家有没有发现一件特别反常的事：', 'Have you noticed something rather unusual?', ['特别反常']],
  ['现在人人拿着AI，效率暴涨。', 'Everyone has AI, and efficiency is soaring.', ['AI', '效率暴涨']],
  ['可绝大多数人的利润、订单，并没有跟着水涨船高。', 'Yet for most people, profits and orders have not risen with it.', ['利润', '订单']],
  ['以前做一份方案，大半天时间。', 'A proposal used to take most of a day.', ['大半天']],
  ['现在打开AI，十分钟就直接给到三版。', 'Now AI can deliver three versions in ten minutes.', ['十分钟', '三版']],
  ['整理一张数据表，过去来回折腾两个小时，', 'A data table once took two hours of back-and-forth work.', ['两个小时']],
  ['现在几句话就能生成结果。', 'Now a few sentences can produce the result.', ['几句话']],
  ['所有人都感觉自己，', 'Everyone feels that they', ['自己']],
  ['现在做事变快了。', 'are now working faster.', ['现在', '变快了']],
  ['可一到月底算账，订单没增多，利润没上涨，', 'But at month-end, orders have not increased and profits have not risen,', ['月底算账', '订单', '利润']],
  ['项目整体交付周期，也没有明显缩短。', 'and the total delivery cycle has not clearly shortened.', ['交付周期']],
  ['ChatGPT上线快四年了。', 'ChatGPT has been available for nearly four years.', ['快四年']],
  ['个人工作效率肉眼可见地提速，', 'Individual work has visibly sped up,', ['个人效率']],
  ['为什么企业、整个社会的生产力，', 'so why has productivity across firms and society', ['生产力']],
  ['没有迎来大家预想中的大爆发？', 'not seen the surge people expected?', ['大爆发']],
  ['这里不是说AI完全没有拉动生产率。', 'This does not mean AI has had no productivity effect.', ['不是完全没有']],
  ['2022年底ChatGPT问世到现在，', 'Since ChatGPT arrived at the end of 2022,', ['2022年底']],
  ['美国官方劳动生产率依旧保持正向增长。', 'official US labor productivity has still grown.', ['正向增长']],
  ['真正巨大的反差在这里：', 'The real contrast is this:', ['反差']],
  ['办公室几乎人人在用AI，', 'AI is nearly everywhere in offices,', ['办公室', 'AI']],
  ['宏观层面却迟迟看不到期待的生产力跃迁。', 'yet the expected macro productivity leap is still absent.', ['宏观层面']],
  ['有一份针对5179名客服人员的调研：', 'One study examined 5,179 customer-support agents.', ['5179名']],
  ['接入AI助手之后，', 'After an AI assistant was introduced,', ['AI助手']],
  ['单人每小时处理问题数量平均提升14%。', 'issues handled per worker-hour rose by 14% on average.', ['14%']],
  ['但另一组宏观测算显示，', 'But another macro estimate suggests', ['宏观测算']],
  ['未来十年AI带来的全社会，', 'that across society over the next ten years,', ['未来十年', '全社会']],
  ['全要素生产率提升幅度依旧偏温和。', 'AI-driven total factor productivity gains may remain modest.', ['全要素生产率', '偏温和']],
  ['岗位上的效率明显提升，', 'Efficiency rises clearly at the job level,', ['岗位效率']],
  ['整个商业体系转化速度却十分缓慢。', 'while conversion across the business system remains slow.', ['转化缓慢']],
  ['到底是哪里卡住了？', 'So where is it getting stuck?', ['哪里卡住']],
  ['我最近研究了很多这方面的文章，', 'I recently studied many articles on this question,', ['研究']],
  ['最后把这些问题拆成四道门槛。', 'and distilled the problem into four gates.', ['四道门槛']],
  ['第一道门槛：单一任务效率，不等于整条流程效率。', 'Gate one: task efficiency is not end-to-end process efficiency.', ['第一道门', '流程效率']],
  ['什么意思呢？', 'What does that mean?', []],
  ['AI十分钟写好方案，批量产出报价、生成文案。', 'AI can draft proposals, quotes, and copy in minutes.', ['十分钟', '批量产出']],
  ['但是客户资料分散在不同的聊天内容当中，', 'But customer information is scattered across chats,', ['客户资料分散']],
  ['审批来回等待，库存、交付、售后体系没有打通。', 'while approvals, inventory, delivery, and support remain disconnected.', ['审批', '交付', '售后']],
  ['这只是其中一个环节提速。', 'Only one part of the chain has accelerated.', ['一个环节']],
  ['原来的瓶颈不会消失，', 'The original bottleneck does not disappear.', ['瓶颈']],
  ['只是转移到下一个节点继续堵塞。', 'It simply moves to the next node.', ['下一个节点']],
  ['所以不要只盯着AI帮你省下的几十分钟，', 'Do not focus only on the minutes AI saves.', ['几十分钟']],
  ['要看整个业务链条有没有真正缩短。', 'Check whether the entire business chain is shorter.', ['整个业务链条']],
  ['第二道门槛：供给快速增加，', 'Gate two: supply can grow rapidly,', ['第二道门', '供给']],
  ['不等于真实需求同步上涨。', 'without real demand rising with it.', ['真实需求']],
  ['以前一天最多产出三张设计图，', 'A designer might once have produced three images a day.', ['三张']],
  ['借助AI，一天三十张甚至三百张都不难。', 'With AI, thirty or even three hundred is possible.', ['三十张', '三百张']],
  ['但是客户的需求不会因为生产速度变快，', 'But customer demand does not grow simply because output is faster,', ['客户需求']],
  ['凭空扩大一百倍。', 'or multiply a hundredfold from nowhere.', ['一百倍']],
  ['当所有人都能低成本批量产出方案、图片、文案，', 'When everyone can cheaply mass-produce plans, images, and copy,', ['低成本', '批量产出']],
  ['市场最先出现的不是价值爆发，', 'the first market outcome is not necessarily a value boom,', ['不是价值爆发']],
  ['而是严重同质化，价格持续内卷下跌。', 'but sameness and downward price pressure.', ['同质化', '价格']],
  ['产出越多，越要想明白一件事：', 'The more you produce, the clearer one question must become:', ['产出越多']],
  ['你做出来的东西到底解决了谁的痛点？', 'Whose pain does your output actually solve?', ['谁的痛点']],
  ['谁会持续使用？', 'Who will keep using it?', ['持续使用']],
  ['谁愿意为最终结果付费？', 'Who will pay for the final result?', ['付费']],
  ['第三道门槛：单纯降低成本，', 'Gate three: lowering cost alone', ['第三道门', '降低成本']],
  ['不等于创造全新价值。', 'is not the same as creating new value.', ['新价值']],
  ['很多企业用AI，目标只有一个：', 'Many firms use AI with only one goal:', ['目标']],
  ['节省工时、精简人手。', 'save labor hours and reduce staffing.', ['节省工时']],
  ['降本当然有用，', 'Cost reduction is useful,', ['降本']],
  ['但这只是优化旧模式，算不上生产力革命。', 'but it only optimizes the old model; it is not a productivity revolution.', ['旧模式']],
  ['节省下来的时间，能不能孵化新服务？', 'Can the saved time incubate a new service?', ['新服务']],
  ['承接更多原本服务不了的客户？', 'Can it serve customers who were previously unreachable?', ['新客户']],
  ['能不能提升交付质量，创造新的收入来源？', 'Can it improve delivery and create new revenue?', ['交付质量', '新收入']],
  ['只有跨过这一关，', 'Only after crossing this gate', ['跨过这一关']],
  ['AI才不只是加速旧工作，', 'does AI do more than speed up old work,', ['加速旧工作']],
  ['而是打开一个全新的增长空间。', 'and open genuinely new room for growth.', ['增长空间']],
  ['第四道门槛：技术产生收益，不等于所有人都能分到收益。', 'Gate four: technical gains do not mean everyone shares the benefits.', ['第四道门', '技术收益', '分到收益']],
  ['大企业手握自有数据、完整业务流程、充足预算，', 'Large firms hold proprietary data, complete processes, and budgets,', ['自有数据', '完整流程']],
  ['可以把AI深度嵌入整套系统。', 'allowing them to embed AI across the system.', ['深度嵌入']],
  ['中小企业、普通人，', 'Small businesses and ordinary people', ['中小企业']],
  ['大多数只能使用通用版本和工具。', 'mostly rely on general-purpose tools.', ['通用工具']],
  ['很多员工的直观感受，', 'For many workers, the immediate feeling', ['员工感受']],
  ['不是工作变轻松，', 'is not that work becomes easier,', ['不是变轻松']],
  ['而是相同时间里需要产出更多内容。', 'but that more output is expected in the same time.', ['更多内容']],
  ['技术创造收益，和收益如何分配，', 'Creating gains and distributing them', ['创造收益', '如何分配']],
  ['是两件独立的事情。', 'are two separate questions.', ['两件事']],
  ['企业、员工、客户，', 'The firm, the employee, and the customer:', ['企业', '员工', '客户']],
  ['这笔账不算清楚，效率越高，人的压力反而越大。', 'if this account is unclear, higher efficiency can mean more pressure.', ['这笔账', '压力']],
  ['我之前聊过进场资格、验收证据，', 'I previously discussed access to real contexts and acceptance evidence.', ['进场资格', '验收证据']],
  ['刚好可以对应到这里。', 'They map directly onto this problem.', ['对应']],
  ['你必须走进真实业务流程，', 'You must enter the real workflow', ['真实流程']],
  ['找到真正的瓶颈，', 'and find its real bottleneck,', ['真正瓶颈']],
  ['同时让最终使用者来验收成果。', 'then let the final user accept the result.', ['最终使用者', '验收']],
  ['不能拿一段流畅的AI演示，', 'A smooth AI demo cannot be used', ['AI演示']],
  ['假装生产力已经提升。', 'to pretend productivity has already improved.', ['假装提升']],
  ['在这里，我并不是否定AI的价值，', 'I am not denying the value of AI,', ['不否定AI']],
  ['也不是说这场生产力革命失败了。', 'nor saying this productivity revolution has failed.', ['没有失败']],
  ['更加客观的结论是：', 'A more objective conclusion is this:', ['客观结论']],
  ['前半场，我们把强大的工具交到每个人手里；', 'In the first half, powerful tools reached everyone.', ['前半场']],
  ['后半场，改造流程、发掘真实需求、创造新价值，', 'In the second half, we must redesign processes, find real demand, and create value,', ['后半场', '真实需求']],
  ['设计收益分配规则，才刚刚开始。', 'while designing how benefits are shared has only begun.', ['分配规则']],
  ['真正的机会，恰恰在后半场。', 'The real opportunity lies in the second half.', ['真正的机会']],
  ['普通人不用和大企业比拼算力、自研模型，', 'Ordinary people need not compete with large firms on compute or models.', ['不用拼算力']],
  ['但你可以深耕一个行业，贴近真实需求，', 'You can go deep in one industry and stay close to real needs,', ['深耕行业', '真实需求']],
  ['更早把AI的作用从“帮我加快干活”，', 'and move AI beyond “help me work faster”', ['加快干活']],
  ['升级成“帮这件事创造全新价值”。', 'toward “help this work create new value.”', ['全新价值']],
  ['现在，拿出咱们最常使用AI完成的一项工作，', 'Now take one task you often complete with AI,', ['一项工作']],
  ['然后问自己四个问题。', 'and ask yourself four questions.', ['四个问题']],
  ['第一，AI提速了哪一步？', 'First, which step did AI accelerate?', ['第一']],
  ['整条业务流程跟着缩短了吗？', 'Did the whole process become shorter?', ['整条流程']],
  ['第二，产出变多之后，', 'Second, after output increased,', ['第二']],
  ['谁真正需要、持续使用，并且愿意付费？', 'who truly needs it, keeps using it, and will pay?', ['需要', '使用', '付费']],
  ['第三，节省出来的时间，', 'Third, did the time saved', ['第三']],
  ['有没有转化成新服务、新客户和新收入？', 'turn into new services, customers, or revenue?', ['新服务', '新客户', '新收入']],
  ['第四，最终产生的收益，', 'Fourth, from the benefits created,', ['第四']],
  ['企业、员工、客户分别得到了什么？', 'what did the firm, employee, and customer each receive?', ['企业', '员工', '客户']],
  ['如果只能回答第一个问题，', 'If you can answer only the first question,', ['只能回答第一']],
  ['那么你拥有的只是AI效率，', 'you have AI efficiency,', ['AI效率']],
  ['而不是完整的AI生产力。', 'not complete AI productivity.', ['AI生产力']],
  ['这说明效率和价值中间，', 'This means efficiency and value', ['效率', '价值']],
  ['有一段巨大空白。', 'are still separated by a large gap.', ['巨大空白']],
  ['这正是未来几年，', 'Over the next few years, this gap', ['未来几年']],
  ['普通人、本地实体商家，', 'for ordinary people and local businesses,', ['普通人', '本地实体']],
  ['尤其是OPC项目最大的机会。', 'especially OPC projects, is the largest opportunity.', ['OPC', '机会']],
  ['现在用AI做事的时候，', 'When you work with AI today,', ['现在']],
  ['你卡在这四道门槛里的哪一道？', 'which of these four gates is blocking you?', ['哪一道']],
  ['评论区聊一聊。', 'Tell me in the comments.', ['评论区']],
  ['我是超哥，在兰州AI创业。', 'I am Chao, building an AI venture in Lanzhou.', ['超哥', '兰州AI创业']],
].map(([zh, en, highlights]) => ({zh, en, highlights}));

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
  const nextStart =
    end < mapped.length && mapped[end]
      ? mapped[end].startMs
      : Number(rawSegments.at(-1)?.offsets?.to ?? 413533);
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
      ? 413533
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
  method: 'whisper.cpp small本机离线词级转写 + 用户确认稿对照 + 实际口语变化校正 + 全局字符时间映射',
  language: 'zh',
  duration_seconds: 413.533333,
  text: transcriptText,
  words,
  pages: bilingual,
  correction_policy: '只修正可由原声上下文和确认稿共同确认的ASR错字；保留实际口语新增、顺序变化和结尾，不删除、压缩或重排原声。',
};

const comparison = {
  schema_version: 1,
  source_video: 'source/20260804_ai_productivity/AI_PRODUCTIVITY_20260804_talk01_16x9.MOV',
  approved_script: 'notes/2026-08-04-AI效率不等于完整AI生产力-用户最终确认稿-v2.md',
  policy: '正片全量保留真实原声，字幕按实际口播校正；用户观察不升级为统计结论。',
  observed_differences: [
    {
      type: 'natural_research_bridge_added',
      spoken: '我最近研究了很多这方面的文章，最后把这些问题拆成四道门槛。',
      action: '完整保留，并作为四道门总览的入场锚点。',
    },
    {
      type: 'workflow_example_spoken_variant',
      spoken: '客户资料分散在不同的聊天内容当中。',
      action: '按真实口语上字幕，不强行替换成书面稿中的微信聊天框。',
    },
    {
      type: 'closing_spoken_variant',
      spoken: '评论区聊一聊，我是超哥，在兰州AI创业。',
      action: '完整保留为真实结尾。',
    },
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
