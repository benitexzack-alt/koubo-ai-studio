import fs from 'node:fs';
import path from 'node:path';

const outputPath =
  process.argv[2] ??
  'remotion/public/data/TWO_LEDGER_20260722_talk01_16x9.bilingual.v1.json';

const specs = [
  [1420, 5620, '这两天，我在几个AI群里转发了我的视频。', 'These past two days, I shared my videos in several AI groups.', ['AI群', '视频']],
  [5620, 11040, '有群友问了我一句：你才150个粉丝，', 'Someone in a group asked me: You only have 150 followers.', ['150个粉丝']],
  [11040, 13220, '怎么变现？', 'How are you going to monetize?', ['怎么变现']],
  [13220, 18200, '说实话，这句话也不难回答，因为结果就摆在这儿。', 'Honestly, that question is not hard to answer. The result is right here.', ['结果']],
  [18200, 23220, '粉丝不多，我也没有能证明稳定变现的结果。', 'I do not have many followers or a stable monetization result to prove.', ['稳定变现']],
  [23860, 29250, '没有结果的时候，你用什么判断自己该继续还是该停？', 'When there is no result yet, how do you decide whether to continue or stop?', ['继续', '停']],
  [31060, 34460, '很多人学AI，工具装了一堆，课听了一堆。', 'Many people learn AI, install many tools, and take many courses.', ['学AI', '工具', '课程']],
  [34460, 37840, '项目也做了，视频也发了，可客户没来。', 'They build projects and post videos, but no clients arrive.', ['客户没来']],
  [37840, 39060, '钱没挣到，数据也不好。', 'They make no money, and the numbers look poor.', ['钱', '数据']],
  [39900, 43180, '这个时候，人最容易走两个极端。', 'At this point, people often go to one of two extremes.', ['两个极端']],
  [43960, 45970, '要么被别人的一句话劝退，', 'Either they quit after one comment,', ['一句话劝退']],
  [46660, 50020, '或者用“坚持就会成功”安慰自己。', 'or comfort themselves by saying persistence guarantees success.', ['坚持就会成功']],
  [51220, 56680, '我觉得这两种判断都不够。150个粉丝只能说明', 'I do not think either judgment is enough. 150 followers only means', ['都不够', '150个粉丝']],
  [56680, 60700, '我现在还没有拿到流量结果，不能证明方向一定错，', 'I have not achieved a traffic result yet. It does not prove the direction is wrong,', ['流量结果', '方向一定错']],
  [60820, 62280, '也不能证明方向一定对。', 'and it does not prove the direction is right.', ['方向一定对']],
  [63080, 67040, '真正要看的是：每天做完一件事，到底留下了什么。', 'What matters is what remains after you finish something each day.', ['留下了什么']],
  [67880, 72120, '我现在会给自己留两本账。第一本，结果账。', 'I now keep two ledgers. The first is the results ledger.', ['两本账', '结果账']],
  [72120, 74940, '视频有多少人看，有没有人收藏。', 'How many watched, and did anyone save it?', ['观看', '收藏']],
  [75560, 77960, '有没有真实咨询。', 'Did any real inquiries come in?', ['真实咨询']],
  [78620, 81760, '做一个AI方案，有没有人愿意试。', 'For an AI proposal, is anyone willing to try it?', ['AI方案', '愿意试']],
  [81760, 83700, '谁来验收，有没有人愿意付费。', 'Who will validate it, and is anyone willing to pay?', ['验收', '付费']],
  [84500, 86600, '这本账很现实，不能躲。', 'This ledger is practical. You cannot avoid it.', ['不能躲']],
  [87340, 91700, '第二本账，是资产账：今天遇到了什么真实问题？', 'The second is the asset ledger: What real problem did I face today?', ['资产账', '真实问题']],
  [91700, 94880, '我是怎么判断的？做了什么？', 'How did I judge it, and what did I do?', ['判断', '做了什么']],
  [94880, 99220, '哪里失败了？最后留下什么下次还能用的东西？', 'Where did I fail, and what remains that I can use next time?', ['失败', '下次还能用']],
  [99940, 104180, '我把每天看到的参考视频，', 'I put the reference videos I see each day,', ['参考视频']],
  [104540, 106620, '真实项目里的交流、做错的判断', 'real project conversations, and wrong judgments', ['项目交流', '错误判断']],
  [106620, 111260, '和复盘，陆续放进自己的知识库。', 'along with reviews into my personal knowledge base.', ['复盘', '知识库']],
  [111620, 117180, '下次写口播、做方案、再去见企业时，AI调用的', 'Next time I write, design a proposal, or meet a business, AI can retrieve', ['AI调用']],
  [117180, 121860, '不只是通用答案，还有我做过、错过、改过的记录。', 'not only generic answers, but records of what I did, missed, and changed.', ['做过', '错过', '改过']],
  [122680, 126040, '过去，这些东西可能只是一堆笔记。', 'In the past, these might have been only a pile of notes.', ['一堆笔记']],
  [127320, 132240, '现在，当AI能检索、结合、重新调用它们时，', 'Now, when AI can retrieve, combine, and reuse them,', ['检索', '结合', '重新调用']],
  [133360, 138460, '它们就有机会在选题、方案和交付里被一次次放大。', 'they can be amplified across topics, proposals, and delivery.', ['选题', '方案', '交付']],
  [138460, 139780, '这才是我理解的数字资产。', 'That is what I mean by digital assets.', ['数字资产']],
  [140740, 144560, '但这里要说清楚：不是你发过一条视频，', 'But let me be clear: posting a video does not mean', ['说清楚']],
  [144560, 146480, '存过一份文档，它就自动值钱。', 'or saving a document does not make it valuable automatically.', ['自动值钱']],
  [147640, 152240, '虚假的、重复的、没有来源的、存完再也不用的东西，', 'False, repeated, unsourced, and never-reused material', ['虚假', '重复', '没有来源', '不再用']],
  [152240, 154300, '堆得再多，也是数字垃圾。', 'is still digital waste, no matter how much you collect.', ['数字垃圾']],
  [154740, 160640, '真正可能产生复利的是四样东西：', 'Four things may genuinely compound over time:', ['产生复利', '四样东西']],
  [160640, 164480, '一个真实问题、你自己的判断、一段行动过程，', 'a real problem, your own judgment, and an action process,', ['真实问题', '自己的判断', '行动过程']],
  [164480, 166120, '一个结果或者失败。', 'plus a result or a failure.', ['结果', '失败']],
  [167500, 173440, '真实才有价值，能找到才能调用，反复用才会变成资产。', 'Truth creates value. Retrieval enables use. Reuse turns it into an asset.', ['真实', '能找到', '反复用']],
  [174120, 178400, '所以落地不是做一个自己觉得很牛的AI产品，', 'Execution is not building an AI product that only you think is impressive,', ['落地', 'AI产品']],
  [178400, 180380, '然后等合伙人、等投资人来发现你。', 'then waiting for a partner or investor to discover you.', ['合伙人', '投资人']],
  [181380, 186940, '你得自己走进场景，找人验证：方案有没有人用？', 'You must enter the real setting and validate whether anyone uses the proposal.', ['走进场景', '找人验证']],
  [186940, 188220, '为什么？', 'Why or why not?', ['为什么']],
  [188220, 191860, '数据拿不到，卡在哪里？谁不愿意验收？', 'If data is unavailable, where is it blocked? Who will not validate it?', ['数据', '卡在哪里', '验收']],
  [191860, 197140, '哪一步只是你自己觉得好？哪怕最后没有成交，', 'Which step only looks good to you? Even if no deal closes,', ['自己觉得好', '没有成交']],
  [197140, 201660, '只要拿到一个真实拒绝原因，改掉一次错误判断，', 'a real rejection reason and one corrected judgment still matter.', ['拒绝原因', '错误判断']],
  [201660, 205280, '也比在群里讨论十次“AI落地”更值钱。', 'That is worth more than discussing AI execution ten times in a group.', ['AI落地', '更值钱']],
  [206540, 210400, '《道德经》里有句话：“明道若昧，进道若退。”', 'The Tao Te Ching says: A clear way may seem obscure; progress may seem like retreat.', ['明道若昧', '进道若退']],
  [211560, 215620, '真正往上走的时候，体感有时确实像在后退。', 'When you truly move upward, it can sometimes feel like moving backward.', ['往上走', '像在后退']],
  [216660, 221300, '因为你开始承认：学会工具，不等于有人付钱。', 'You begin to admit that learning a tool does not mean someone will pay.', ['学会工具', '有人付钱']],
  [221300, 226220, '做出产品，不等于市场需要；发了视频，也不等于有流量。', 'Building a product does not prove demand; posting a video does not ensure traffic.', ['市场需要', '有流量']],
  [226540, 231540, '这当然会让人怀疑自己。但怀疑不是坏事。', 'This can make you doubt yourself. But doubt is not a bad thing.', ['怀疑不是坏事']],
  [231540, 235920, '只要它变成一次检查、一次调整、下一次行动，', 'If it becomes one check, one adjustment, and the next action,', ['检查', '调整', '行动']],
  [235920, 236620, '它就是反馈。', 'then it becomes feedback.', ['反馈']],
  [237600, 242360, '最怕的是一边怀疑，一边什么都不做。', 'The real danger is doubting while doing nothing.', ['什么都不做']],
  [242360, 246700, '或者每天重复昨天，还把它叫坚持。', 'Or repeating yesterday every day and calling it persistence.', ['重复昨天', '坚持']],
  [247080, 252400, '150个粉丝不值得炫耀，也没必要因此否定自己。', '150 followers are nothing to boast about, but no reason to deny yourself.', ['150个粉丝', '否定自己']],
  [252400, 253660, '它只是今天的一组数字。', 'It is only a number today.', ['今天的数字']],
  [254200, 259600, '到了AI时代，我判断，真正会越来越值钱的是', 'In the AI era, I believe what will grow more valuable is', ['AI时代', '越来越值钱']],
  [259600, 263600, '的那一部分：你真实而连续的个人上下文。', 'that missing part: your real and continuous personal context.', ['个人上下文']],
  [264520, 269000, '你做过什么，怎么判断，为什么改，又在哪里失败？', 'What did you do, how did you judge, why did you change, and where did you fail?', ['做过什么', '怎么判断', '为什么改', '哪里失败']],
  [269000, 273980, '这些东西积累得越真实、越清楚、越能重新调用，', 'The more truthful, clear, and reusable these records become,', ['真实', '清楚', '重新调用']],
  [273980, 277340, '你和别人之间的差异才会越来越具体。', 'the more concrete your difference from others becomes.', ['差异', '越来越具体']],
  [277820, 283300, '今天就开始建你的知识库。别用一句坚持骗自己，', 'Start building your knowledge base today. Do not fool yourself with persistence,', ['建知识库', '坚持']],
  [284060, 287820, '也别让一句“你才150个粉丝”把你劝退。', 'and do not let the words only 150 followers make you quit.', ['150个粉丝', '劝退']],
  [288740, 291160, '我是超哥，我在兰州AI创业。', 'I am Chao, building an AI venture in Lanzhou.', ['超哥', '兰州AI创业']],
];

const pages = specs.map(([startMs, endMs, zh, en, highlights = []], index) => ({
  startMs,
  endMs,
  zh,
  en,
  highlights,
  index: index + 1,
}));

for (let index = 0; index < pages.length; index += 1) {
  const page = pages[index];
  const previous = pages[index - 1];
  if (!page.zh || !page.en || page.endMs <= page.startMs) {
    throw new Error(`第 ${index + 1} 页内容或时间无效`);
  }
  if ([...page.zh].length > 34) {
    throw new Error(`第 ${index + 1} 页中文超过 34 字：${page.zh}`);
  }
  if (previous && page.startMs < previous.endMs) {
    throw new Error(`第 ${index + 1} 页与上一页时间重叠`);
  }
}

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(
    pages.map(({index: _index, ...page}) => page),
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`已生成 ${pages.length} 页逐词双语字幕：${outputPath}`);
