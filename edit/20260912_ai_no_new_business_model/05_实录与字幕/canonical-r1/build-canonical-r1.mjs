import {createHash} from 'node:crypto';
import {readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const outputDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(outputDir, '../../../..');
const episodeRoot = path.resolve(outputDir, '../..');
const taskId = 'task-20260913T123722Z-11da90de';
const createdAt = new Date().toISOString();

const sourcePaths = {
  recordedMedia: path.join(episodeRoot, '01_素材投放区/01_口播原片/copy_00131113-A43E-48CD-B158-AB0CDE2EF8DC 2.MOV'),
  audio: path.join(episodeRoot, '05_实录与字幕/host_16k_mono.wav'),
  large: path.join(episodeRoot, '05_实录与字幕/asr-large-v3-turbo-r1/host.mlx-whisper-large-v3-turbo.full.raw.json'),
  small: path.join(episodeRoot, '05_实录与字幕/asr-whispercpp-small-r1/host.whisper-small.full.raw.json'),
  script: path.join(episodeRoot, '00_文稿与控制/用户确认原稿.txt'),
  director: path.join(episodeRoot, '03_导演拆解/director-core-r3/director-cues.v3.json'),
};

const outputPaths = {
  timeline: path.join(outputDir, 'spoken-timeline.candidate.v1.json'),
  bilingual: path.join(outputDir, 'actual-spoken.bilingual.candidate.v1.json'),
  review: path.join(outputDir, 'transcription-review.v1.json'),
  policy: path.join(outputDir, 'spoken-source-policy.v1.json'),
};

const focusPaths = {
  adQuote: path.join(outputDir, 'focus-ad-quote.whisper-base.json'),
  misunderstanding: path.join(outputDir, 'focus-misunderstanding.whisper-base.json'),
  connectionCost: path.join(outputDir, 'focus-connection-cost.whisper-base.json'),
  signoff: path.join(outputDir, 'focus-signoff.whisper-base.json'),
};

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const sha256 = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');
const fileRecord = async (file) => ({
  path: file,
  projectRelativePath: path.relative(projectRoot, file),
  sha256: await sha256(file),
  bytes: (await stat(file)).size,
});
const ms = (seconds) => Math.round(seconds * 1000);

const [largeRaw, smallRaw, director, ...focusRaw] = await Promise.all([
  readJson(sourcePaths.large),
  readJson(sourcePaths.small),
  readJson(sourcePaths.director),
  ...Object.values(focusPaths).map(readJson),
]);

const beatSpecs = [
  ['B01', 0, 0, 'AI并没有发明新的商业模式。', 'high', []],
  ['B02', 1, 5, '我们正处在一个被宏大叙事包围的时代，打开任何一篇AI相关的文章，几乎都在谈论“颠覆范式”“重构产业”“开启新时代”。', 'medium', []],
  ['B03', 6, 7, '这些词听起来令人兴奋，但它们掩盖了一个极其朴素的真相。', 'medium', ['U01']],
  ['B04', 8, 10, '因为AI并没有发明任何新的商业模式，它只是在做一件极其古老的事情，把成本和效率推到极致。', 'high', []],
  ['B05', 11, 12, '先看看过去二十年，真正称得上新商业模式的东西是什么。', 'high', []],
  ['B06', 13, 21, '移动互联网带来了按需经济，Uber和滴滴让闲置的车辆变成了可交易的运力，Airbnb让空置的房间变成了酒店，它们创造了一种新的供给方式。SaaS让软件从买断变成了订阅，企业不再一次性投入巨额的资金部署系统，它们改变了软件的交付和付费方式。社交电商则让每个人都能成为分销节点，信任关系变成了交易渠道。', 'medium', ['U02']],
  ['B07', 22, 24, '这些创新有一个共同特征，它们改变了“谁在提供”和“怎么付费”这两个关键问题。', 'high', []],
  ['B08', 25, 25, '那当下的AI又做了什么？', 'high', []],
  ['B09', 26, 28, '它没有创造新的供给形态，没有发明新的交易方式，也没有重构价值链上参与者的角色分工。', 'high', []],
  ['B10', 29, 32, '那么它只是在既有的框架里，把原来需要一个人干两个小时的事情，变成机器干两分钟，把原来需要反复试错才能找到的客户变成了精准到个位数的定向投放。', 'high', []],
  ['B11', 33, 36, '这并非是贬低AI的价值，恰恰相反，这种“只改变效率”的变革，历史上每一次都塑造了新的秩序。', 'medium', ['U03']],
  ['B12', 37, 40, '集装箱没有发明航运，没有发明港口，也没有改变船的动力系统。它只是把散装货物装进了一个标准化的铁盒子里。', 'high', []],
  ['B13', 41, 42, '让装卸的效率提升了数十倍，让运输成本降低了90%以上。', 'high', []],
  ['B14', 43, 46, '但是这个只改变效率和成本的发明，彻底重塑了全球贸易的版图。它让制造业从发达国家转移到发展中国家，让深圳的小渔村变成了世界工厂，让全球供应链成为可能。', 'high', []],
  ['B15', 47, 50, '航运还是那个航运，港口还是那个港口，但成本结构的变化带来了整个经济地理的重现。AI此刻正在做的事情，和当年的集装箱如出一辙。', 'low', ['U04']],
  ['B16', 51, 60, '以电商广告投放为例。传统模式下，一个商家想找潜在客户，需要先设想一个目标人群的画像，然后向平台购买对应的流量包，再根据转化的数据反复调整。这个流程充满了浪费，行业里有一句话，叫“我知道我的广告有一半浪费了，但我不知道浪费在哪一半。”', 'high', []],
  ['B17', 61, 62, 'AI介入后，投放逻辑从“人工假设”变成了“机器推理”。', 'high', []],
  ['B18', 63, 71, '系统直接理解商品的使用场景，反向寻找意图匹配的用户，不再完全依赖商家输入的关键词和人群标签。比如一个卖助眠枕头的商家，不需要告诉系统“我的客户是失眠人群”，系统自己就能通过搜索“半夜总醒”“睡醒脖子疼”等行为信号找到这些人。', 'medium', []],
  ['B19', 72, 77, '这个变化带来的效率提升是惊人的。一个商家可以覆盖的人群边界被大幅扩宽，过去因为“搜不到”而被浪费的流量被重新计划。广告还是那个广告，投放还是那个投放，但每一次的曝光和点击背后，水分的含量被大幅地挤压。', 'medium', ['U05']],
  ['B20', 78, 79, '再把视角拉远一点，看一下知识工作领域。', 'high', []],
  ['B21', 80, 82, '一家咨询公司为一个客户做市场进入策略，传统做法是派一个团队飞过去，花几周的时间访谈、调研、分析，产出一份几百页的报告。', 'high', []],
  ['B22', 83, 83, '收费从几十万到上百万美元不等。', 'high', []],
  ['B23', 84, 89, 'AI介入之后，一个经过专业调校的模型可以在几个小时内完成行业扫描、竞品分析、消费者的洞察，生成一份结构完整、逻辑自洽的报告初稿。', 'medium', ['U06']],
  ['B24', 90, 91, '咨询顾问的角色从“信息采集和分析者”变成了“策略判断和交付把控者”。', 'medium', ['U07']],
  ['B25', 92, 94, '咨询还是那个咨询，但交付的效率提升了一个量级，人力成本大幅下降。', 'high', []],
  ['B26', 95, 98, '以前从“客户有需求”到“客户交付成果”之间，有一长串的信息搬运和模式化的分析工作。这部分不产生策略价值，但必须有人做。', 'high', []],
  ['B27', 99, 100, 'AI接手了这一段，把顾问的精力释放到真正需要人类判断的内部。', 'low', ['U08']],
  ['B28', 101, 103, '这里可能有人会问，如果AI只是改变了效率和成本，那它最终会让所有行业变成卷价格的“红海”吗？', 'high', []],
  ['B29', 104, 108, '这个担忧呢，是来自一个常见的一个误解。集装箱并没有让所有的港口收费趋同，但让那些能处理更大吞吐量的港口获得了绝对优势。', 'medium', []],
  ['B30', 109, 112, 'AI也一样，当连接成本趋近于零，企业之间的竞争就会从“谁更擅长找到客户”变成“谁更擅长理解客户”。', 'medium', []],
  ['B31', 113, 115, '这就是效率革命的特征，它让所有人都能低价获得同一种能力，于是把“做得更好”的要求推到了一个新的维度。', 'high', []],
  ['B32', 116, 122, '那些担心被AI取代的人，和指望靠AI一夜暴富的人，其实犯了同一个错误。他们都在期待一个全新的秩序从天而降，而事实上，旧的秩序只是在被重新打磨。水还是水，不过是流得更快。', 'medium', []],
  ['B33', 123, 124, '至于水流本身，它从来不会在意谁在游泳。', 'high', []],
  ['B34', 125, 127, '我是超哥，在兰州，也在创业。', 'low', ['U09']],
];

const segmentText = [
  ['AI并没有发明新的商业模式', 'AI did not invent a new business model.'],
  ['我们正处在一个被宏大叙事包围的时代', 'We are living in an age surrounded by grand narratives.'],
  ['打开任何一篇AI相关的文章', 'Open almost any article about AI,'],
  ['几乎都在谈论“颠覆范式”', 'and it is likely talking about paradigm disruption,'],
  ['“重构产业”', 'industry restructuring,'],
  ['“开启新时代”', 'or ushering in a new era.'],
  ['这些词听起来令人兴奋', 'These words sound exciting,'],
  ['但它们掩盖了一个极其朴素的真相', 'but they conceal an extremely simple truth.'],
  ['因为AI并没有发明任何新的商业模式', 'Because AI did not invent any new business model.'],
  ['它只是在做一件极其古老的事情', 'It is simply doing something extremely old:'],
  ['把成本和效率推到极致', 'pushing cost and efficiency to their limits.'],
  ['先看看过去二十年', 'First, look back at the past twenty years.'],
  ['真正称得上新商业模式的东西是什么', 'What truly counted as a new business model?'],
  ['移动互联网带来了按需经济', 'Mobile internet brought the on-demand economy.'],
  ['Uber和滴滴让闲置的车辆变成了可交易的运力', 'Uber and Didi turned idle vehicles into tradable transport capacity.'],
  ['Airbnb让空置的房间变成了酒店', 'Airbnb turned empty rooms into hotels.'],
  ['它们创造了一种新的供给方式', 'They created a new way to supply services.'],
  ['SaaS让软件从买断变成了订阅', 'SaaS changed software from a one-time purchase to a subscription.'],
  ['企业不再一次性投入巨额的资金部署系统', 'Companies no longer made a huge upfront investment to deploy systems.'],
  ['它们改变了软件的交付和付费方式', 'They changed how software was delivered and paid for.'],
  ['社交电商则让每个人都能成为分销节点', 'Social commerce lets everyone become a distribution node.'],
  ['信任关系变成了交易渠道', 'Trust relationships became transaction channels.'],
  ['这些创新有一个共同特征', 'These innovations share one feature.'],
  ['它们改变了“谁在提供”和“怎么付费”', 'They changed who provides and how people pay.'],
  ['这两个关键问题', 'Those are the two key questions.'],
  ['那当下的AI又做了什么', 'So what has AI done today?'],
  ['它没有创造新的供给形态', 'It has not created a new form of supply.'],
  ['没有发明新的交易方式', 'It has not invented a new way to transact.'],
  ['也没有重构价值链上参与者的角色分工', 'Nor has it redefined participants’ roles in the value chain.'],
  ['那么它只是在既有的框架里，把原来需要一个人干两个小时的事情', 'So within the existing framework, work that took one person two hours'],
  ['变成机器', 'is handed to a machine'],
  ['干两分钟', 'to do in two minutes.'],
  ['把原来需要反复试错才能找到的客户，变成了精准到个位数的定向投放', 'Customers once found through repeated trial and error become single-digit precision targets.'],
  ['这并非是贬低AI的价值', 'This does not belittle the value of AI.'],
  ['恰恰相反', 'Quite the opposite.'],
  ['这种“只改变效率”的变革', 'This kind of change that only alters efficiency'],
  ['历史上每一次都塑造了新的秩序', 'has shaped a new order every time in history.'],
  ['集装箱没有发明航运', 'The container did not invent shipping.'],
  ['没有发明港口', 'It did not invent ports,'],
  ['也没有改变船的动力系统', 'or change how ships are powered.'],
  ['它只是把散装货物装进了一个标准化的铁盒子里', 'It simply put loose cargo into a standardized iron box.'],
  ['让装卸的效率提升了数十倍', 'Loading and unloading became dozens of times more efficient.'],
  ['让运输成本降低了90%以上', 'Transport costs fell by more than 90 percent.'],
  ['但是这个只改变效率和成本的发明，彻底重塑了全球贸易的版图', 'But this invention, changing only efficiency and cost, reshaped global trade.'],
  ['它让制造业从发达国家转移到发展中国家', 'It moved manufacturing from developed to developing countries.'],
  ['让深圳的小渔村变成了世界工厂', 'It turned Shenzhen’s small fishing village into the world’s factory.'],
  ['让全球供应链成为可能', 'It made global supply chains possible.'],
  ['航运还是那个航运', 'Shipping was still shipping.'],
  ['港口还是那个港口', 'Ports were still ports.'],
  ['但成本结构的变化带来了整个经济地理的重现', 'But the change in cost structure caused economic geography to re-emerge.'],
  ['AI此刻正在做的事情，和当年的集装箱如出一辙', 'What AI is doing now is just like what the container did then.'],
  ['以电商广告投放为例', 'Take e-commerce advertising.'],
  ['传统模式下', 'Under the traditional model,'],
  ['一个商家想找潜在客户', 'a merchant wants to find potential customers.'],
  ['需要先设想一个目标人群的画像', 'They first imagine a target audience profile,'],
  ['然后向平台购买对应的流量包', 'then buy the corresponding traffic package,'],
  ['再根据转化的数据反复调整', 'and repeatedly adjust using conversion data.'],
  ['这个流程充满了浪费', 'This process is full of waste.'],
  ['行业里有一句话，叫', 'There is a line in the industry that goes:'],
  ['“我知道我的广告有一半浪费了”', 'I know half of my advertising is wasted,'],
  ['“但我不知道浪费在哪一半”', 'but I do not know which half.'],
  ['AI介入后', 'After AI enters,'],
  ['投放逻辑从“人工假设”变成了“机器推理”', 'the logic shifts from human assumptions to machine reasoning.'],
  ['系统直接理解商品的使用场景', 'The system directly understands the product’s use cases,'],
  ['反向寻找意图匹配的用户', 'and searches backward for users with matching intent.'],
  ['不再完全依赖商家输入的关键词和人群标签', 'It no longer relies entirely on merchant-entered keywords and audience labels.'],
  ['比如一个卖助眠枕头的商家', 'For example, consider a merchant selling sleep pillows.'],
  ['不需要告诉系统', 'They do not need to tell the system,'],
  ['“我的客户是失眠人群”', 'My customers are people with insomnia.'],
  ['系统自己就能通过搜索“半夜总醒”', 'The system can use searches like waking up at night,'],
  ['“睡醒脖子疼”等行为信号', 'or waking with neck pain as behavioral signals,'],
  ['找到这些人', 'and find those people.'],
  ['这个变化带来的效率提升是惊人的', 'The efficiency gain from this change is remarkable.'],
  ['一个商家可以覆盖的人群边界被大幅扩宽', 'A merchant can greatly expand the audience they reach.'],
  ['过去因为“搜不到”而被浪费的流量被重新计划', 'Traffic once wasted because it could not be found is replanned.'],
  ['广告还是那个广告，投放还是那个投放', 'Advertising is still advertising, and placement is still placement.'],
  ['但每一次的曝光和点击背后', 'But behind every impression and click,'],
  ['水分的含量被大幅地挤压', 'the waste is squeezed out substantially.'],
  ['再把视角拉远一点', 'Now pull the view back a little.'],
  ['看一下知识工作领域', 'Look at the field of knowledge work.'],
  ['一家咨询公司为一个客户做市场进入策略', 'A consulting firm develops a market-entry strategy for a client.'],
  ['传统做法是派一个团队飞过去，花几周的时间', 'Traditionally, a team flies there and spends several weeks,'],
  ['访谈、调研、分析，产出一份几百页的报告', 'interviewing, researching, analyzing, and producing a report hundreds of pages long.'],
  ['收费从几十万到上百万美元不等', 'Fees range from hundreds of thousands to over a million dollars.'],
  ['AI介入之后', 'After AI enters,'],
  ['一个经过专业调校的模型', 'a professionally tuned model'],
  ['可以在几个小时内完成行业扫描', 'can complete an industry scan in a few hours,'],
  ['竞品分析', 'competitive analysis,'],
  ['消费者的洞察', 'and consumer insight,'],
  ['生成一份结构完整、逻辑自洽的报告初稿', 'then generate a structurally complete and coherent first draft.'],
  ['咨询顾问的角色', 'The consultant’s role'],
  ['从“信息采集和分析者”变成了“策略判断和交付把控者”', 'changes from information collector and analyst to strategy judge and delivery controller.'],
  ['咨询还是那个咨询', 'Consulting is still consulting,'],
  ['但交付的效率提升了一个量级', 'but delivery efficiency rises by an order of magnitude,'],
  ['人力成本大幅下降', 'and labor costs fall sharply.'],
  ['以前从“客户有需求”到“客户交付成果”之间', 'Previously, between a client having a need and a client delivering a result,'],
  ['有一长串的信息搬运和模式化的分析工作', 'there was a long chain of information handling and formulaic analysis.'],
  ['这部分不产生策略价值', 'This part creates no strategic value,'],
  ['但必须有人做', 'but someone has to do it.'],
  ['AI接手了这一段', 'AI takes over this section,'],
  ['把顾问的精力释放到真正需要人类判断的内部', 'freeing the consultant’s energy inside the work that truly needs human judgment.'],
  ['这里可能有人会问', 'Someone may ask here:'],
  ['如果AI只是改变了效率和成本', 'if AI only changes efficiency and cost,'],
  ['那它最终会让所有行业变成卷价格的“红海”吗', 'will it eventually turn every industry into a price-war red ocean?'],
  ['这个担忧呢', 'This concern'],
  ['是来自一个常见的一个误解', 'comes from a common misunderstanding.'],
  ['集装箱并没有让所有的港口收费趋同', 'Containers did not make every port charge the same,'],
  ['但让那些能处理更大吞吐量的港口', 'but ports able to handle more throughput'],
  ['获得了绝对优势', 'gained an absolute advantage.'],
  ['AI也一样', 'AI is the same.'],
  ['当连接成本趋近于零', 'When connection costs approach zero,'],
  ['企业之间的竞争就会从“谁更擅长找到客户”', 'competition shifts away from who is better at finding customers'],
  ['变成“谁更擅长理解客户”', 'toward who is better at understanding them.'],
  ['这就是效率革命的特征', 'This is the hallmark of an efficiency revolution.'],
  ['它让所有人都能低价获得同一种能力', 'It lets everyone obtain the same capability cheaply,'],
  ['于是把“做得更好”的要求推到了一个新的维度', 'so the demand to do it better moves to a new dimension.'],
  ['那些担心被AI取代的人', 'People worried about being replaced by AI'],
  ['和指望靠AI一夜暴富的人', 'and people hoping to get rich overnight with AI'],
  ['其实犯了同一个错误', 'are making the same mistake.'],
  ['他们都在期待一个全新的秩序从天而降', 'They are both waiting for a whole new order to fall from the sky.'],
  ['而事实上，旧的秩序只是在被重新打磨', 'In fact, the old order is merely being polished again.'],
  ['水还是水', 'Water is still water.'],
  ['不过是流得更快', 'It just flows faster.'],
  ['至于水流本身', 'As for the current itself,'],
  ['它从来不会在意谁在游泳', 'it never cares who is swimming.'],
  ['我是超哥', 'I am Chao.'],
  ['在兰州', 'In Lanzhou,'],
  ['也在创业', 'also building a business.'],
];

if (segmentText.length !== 128) {
  throw new Error(`segmentText 数量应为 128，实际为 ${segmentText.length}`);
}

const corrections = [
  ['C01', 'B06', '暗需经济', '按需经济', 'large 为近音错字；small 与用户确认原稿均指向“按需经济”。'],
  ['C02', 'B06', '可交易的运营', '可交易的运力', '行业语义与原稿指向“运力”；两模型均写成“运营”，待听校。'],
  ['C03', 'B06', '买段', '买断', '同音正字，与 SaaS 订阅对照语义一致。'],
  ['C04', 'B11', '贬值AI的价值', '贬低AI的价值', '原稿与固定搭配指向“贬低”；两模型均为“贬值”，待听校。'],
  ['C05', 'B15', 'AA', 'AI', '上下文、原稿与全片术语一致。'],
  ['C06', 'B15', '如出一转', '如出一辙', '固定成语正字；small 也是近音误识。'],
  ['C07', 'B18', '异象匹配', '意图匹配', '原稿与投放语义指向“意图匹配”；small 为“意向匹配”。'],
  ['C08', 'B18', '半页总形', '半夜总醒', '连续近音错字；small 为“半夜总行”，原稿与失眠语境指向“半夜总醒”。'],
  ['C09', 'B23', '专业调效', '专业调校', 'small 与原稿均为“调校”。'],
  ['C10', 'B23', '报告出稿', '报告初稿', '同音正字候选；两模型都输出“出稿”，原稿为“初稿”，待听校。'],
  ['C11', 'B24', '交付把控上', '交付把控者', '原稿与句法对称指向“者”；small 为“把控制”，待听校。'],
  ['C12', 'B29', '常见的一个物件', '常见的一个误解', '近音正字；论证上下文与原稿均指向“误解”。'],
  ['C13', 'B29', '港口收费驱通', '港口收费趋同', '近音正字；small 为“去通”，原稿为“趋同”。'],
  ['C14', 'B30', '链接成本趋劲于零', '连接成本趋近于零', '连续同音或近音正字；与原稿语义一致。'],
  ['C15', 'B32', '一页报复', '一夜暴富', '连续近音错字；small 为“一样报复”，原稿与句意指向“一夜暴富”。'],
].map(([id, beatId, from, to, reason]) => ({
  id,
  beatId,
  from,
  to,
  confidence: new Set(['C02', 'C04', 'C10', 'C11']).has(id) ? 'medium' : 'high',
  status: 'candidate-not-human-verified',
  reason,
}));

const uncertainties = [
  ['U01', 'B03', '这些词听起来令人兴奋', ['这些词呢，听起来令人兴奋'], 'large 无“呢”，small 识别为“这些层呢”；保留 large 基线。'],
  ['U02', 'B06', '可交易的运力', ['可交易的运营'], '两模型均写“运营”，原稿和行业语义为“运力”；未经人工听辨。'],
  ['U03', 'B11', '贬低AI的价值', ['贬值AI的价值'], '两模型均为“贬值”，原稿为“贬低”；候选按语义正字，仍需听校。'],
  ['U04', 'B15', '经济地理的重现', ['经济地理的重写'], '两模型都输出“重现”，原稿为“重写”；不以原稿覆盖实录候选。'],
  ['U05', 'B19', '被浪费的流量被重新计划', ['被浪费的流量被重新激活'], '两模型均为“重新计划”，原稿为“重新激活”；保留实录识别候选。'],
  ['U06', 'B23', '生成一份结构完整、逻辑自洽的报告初稿', ['生成一份结构完整、逻辑自洽的报告出稿'], '两模型为“出稿”，原稿为“初稿”；同音正字未听校。'],
  ['U07', 'B24', '交付把控者', ['交付把控上', '交付把控制'], 'large 与 small 均未稳定识出末字；原稿与句法支持“者”。'],
  ['U08', 'B27', '真正需要人类判断的内部', ['真正需要人类判断的那部分'], 'large 为“内部”，small 为“内部分”，原稿为“那部分”；保留 large 基线。'],
  ['U09', 'B34', '我是超哥，在兰州，也在创业', ['我是超哥，在兰州AI创业'], 'large 为“也在创业”，small 末句严重误识，原稿为“在兰州AI创业”；保留 large 候选。'],
].map(([id, beatId, retained, alternatives, reason]) => ({
  id,
  beatId,
  retained,
  alternatives,
  candidateConfidence: new Set(['U04', 'U05', 'U08', 'U09']).has(id) ? 'low' : 'medium',
  reason,
  status: 'needs-human-audio-review',
}));

const beatBySegment = new Map();
for (const spec of beatSpecs) {
  const [beatId, first, last] = spec;
  for (let index = first; index <= last; index += 1) beatBySegment.set(index, beatId);
}

const splitSegments = new Map([
  [29, [
    {startMs: 85980, endMs: 88580, zh: '那么它只是在既有的框架里', en: 'So it is simply operating within the existing framework.'},
    {startMs: 88580, endMs: 91820, zh: '把原来需要一个人干两个小时的事情', en: 'Work that used to take one person two hours'},
  ]],
  [32, [
    {startMs: 94120, endMs: 98000, zh: '把原来需要反复试错才能找到的客户', en: 'Customers once found only through repeated trial and error'},
    {startMs: 98000, endMs: 102760, zh: '变成了精准到个位数的定向投放', en: 'become single-digit precision targets.'},
  ]],
  [43, [
    {startMs: 128260, endMs: 131400, zh: '但是这个只改变效率和成本的发明', en: 'But this invention changed only efficiency and cost, '},
    {startMs: 131400, endMs: 133680, zh: '彻底重塑了全球贸易的版图', en: 'yet completely reshaped global trade.'},
  ]],
  [91, [
    {startMs: 277800, endMs: 281760, zh: '从“信息采集和分析者”变成了“策略判断”', en: 'changes from information collector and analyst to strategy judge'},
    {startMs: 281760, endMs: 283480, zh: '和“交付把控者”', en: 'and delivery controller.'},
  ]],
]);

const pageRecords = [];
for (const [index, segment] of largeRaw.segments.entries()) {
  const beatId = beatBySegment.get(index);
  if (!beatId) throw new Error(`未找到 segment ${index} 的 beat`);
  const uncertaintyIds = beatSpecs.find(([id]) => id === beatId)[5];
  const correctionIds = corrections.filter((item) => item.beatId === beatId).map((item) => item.id);
  const records = splitSegments.get(index) ?? [{
    startMs: ms(segment.start),
    endMs: ms(segment.end),
    zh: segmentText[index][0],
    en: segmentText[index][1],
  }];
  for (const record of records) {
    pageRecords.push({
      id: `cap-${beatId.toLowerCase()}-p${String(pageRecords.filter((item) => item.beatId === beatId).length + 1).padStart(2, '0')}`,
      beatId,
      sourceLargeSegmentIndex: index,
      startMs: record.startMs,
      endMs: record.endMs,
      zh: record.zh,
      en: record.en,
      authority: 'recorded-audio-candidate-from-local-asr',
      timingPrecision: splitSegments.has(index) ? 'large-v3-turbo-word-boundary' : 'large-v3-turbo-segment-boundary',
      humanListeningPerformed: false,
      reviewRequired: uncertaintyIds.length > 0 || correctionIds.length > 0,
      uncertaintyIds,
      correctionIds,
    });
  }
}

const source = {
  recordedMedia: {...await fileRecord(sourcePaths.recordedMedia), durationMs: 386750.998},
  audio: {...await fileRecord(sourcePaths.audio), durationMs: 386750.125},
  largeV3Turbo: await fileRecord(sourcePaths.large),
  whisperCppSmall: await fileRecord(sourcePaths.small),
  userConfirmedScript: await fileRecord(sourcePaths.script),
  directorCues: await fileRecord(sourcePaths.director),
};

const smallSegmentsForRange = (startMs, endMs) => smallRaw.transcription
  .map((segment, index) => ({
    index,
    startMs: segment.offsets.from,
    endMs: segment.offsets.to,
    text: segment.text,
  }))
  .filter((segment) => segment.endMs > startMs && segment.startMs < endMs);

const timelineBeats = beatSpecs.map(([beatId, first, last, actualChinese, confidence, uncertaintyIds], index) => {
  const directorBeat = director.semanticBeats[index];
  const largeSegments = largeRaw.segments.slice(first, last + 1).map((segment) => ({
    index: segment.id,
    startMs: ms(segment.start),
    endMs: ms(segment.end),
    text: segment.text,
    averageLogProbability: segment.avg_logprob,
  }));
  const startMs = largeSegments[0].startMs;
  const endMs = largeSegments.at(-1).endMs;
  const smallSegments = smallSegmentsForRange(startMs, endMs);
  const correctionIds = corrections.filter((item) => item.beatId === beatId).map((item) => item.id);
  return {
    id: `spoken-${beatId.toLowerCase()}`,
    beatId,
    originalDirectorBeatId: directorBeat.id,
    order: index + 1,
    route: directorBeat.primaryRoute,
    routeCueId: directorBeat.routeCueId ?? null,
    startMs,
    endMs,
    actualChinese,
    authority: 'recorded-audio-candidate-from-local-asr',
    confidence,
    humanListeningPerformed: false,
    reviewRequired: uncertaintyIds.length > 0 || correctionIds.length > 0,
    uncertaintyIds,
    correctionIds,
    sourceLargeSegmentIndices: largeSegments.map((item) => item.index),
    sourceSmallSegmentIndices: smallSegments.map((item) => item.index),
    comparisonOnly: {
      directorScriptQuote: directorBeat.scriptQuote,
      normalizedEqual: actualChinese.replace(/[\s\p{P}\p{S}]/gu, '') === directorBeat.scriptQuote.replace(/[\s\p{P}\p{S}]/gu, ''),
    },
    evidence: {
      largeV3Turbo: largeSegments,
      whisperCppSmall: smallSegments,
    },
  };
});

const timeline = {
  schemaVersion: 'koubo-authoritative-spoken-timeline-candidate/v1',
  taskId,
  episodeId: '20260912_ai_no_new_business_model',
  createdAt,
  status: 'needs-human-audio-review',
  formalAllowed: false,
  permittedUse: 'local-full-film-review-candidate-preparation-only',
  authority: 'recorded-audio',
  scriptRole: 'comparison-only',
  humanListeningPerformed: false,
  userAudioReviewConfirmed: false,
  source,
  captionTextPolicy: 'spoken-verbatim-candidate-with-explicit-asr-corrections-and-uncertainties',
  timelineFps: 30,
  beats: timelineBeats,
  preservedRecordedDifferences: [
    {beatId: 'B10', text: '那么', note: '原稿无此连接词，两模型都识别到。'},
    {beatId: 'B10', text: '两个小时', note: '原稿为“两小时”，实录明确多“个”。'},
    {beatId: 'B16', text: '这个流程', note: '原稿为“这个过程”，两模型都识别为“流程”。'},
    {beatId: 'B19', text: '每一次的曝光和点击背后', note: '原稿无“的”，实录候选保留。'},
    {beatId: 'B14', text: '让深圳的小渔村变成了世界工厂', note: '原稿为“让深圳从小渔村”，两模型一致支持实录差异。'},
    {beatId: 'B16', text: '行业里有一句话', note: '原稿为“一句老话”，实录未识别“老”。'},
    {beatId: 'B25', text: '提升了一个量级', note: '原稿为“一个数量级”，两模型均支持实录说法。'},
    {beatId: 'B26', text: '从客户有需求到客户交付成果之间', note: '原稿为“顾问交付成果”，两模型均识别为“客户交付成果”。'},
  ],
};

const bilingual = {
  schemaVersion: 'koubo-actual-spoken-bilingual-candidate/v1',
  taskId,
  episodeId: timeline.episodeId,
  createdAt,
  status: 'needs-human-audio-review',
  formalAllowed: false,
  permittedUse: timeline.permittedUse,
  authority: 'recorded-audio',
  chineseSource: 'spoken-timeline.candidate.v1.json',
  englishTranslationSource: 'canonical-spoken-chinese-candidate',
  scriptRole: 'comparison-only',
  humanListeningPerformed: false,
  mobileReadabilityPolicy: {
    maximumChineseCharactersPerPage: 22,
    timingOrder: 'strictly-non-overlapping',
    splitTimingBasis: 'large-v3-turbo-segment-or-word-boundaries',
  },
  pages: pageRecords,
};

const levelByBeat = new Map(beatSpecs.map(([id, , , , confidence]) => [id, confidence]));
const agreementLevel = (beatId) => {
  if (['B15', 'B27', 'B34'].includes(beatId)) return 'low';
  if (['B02', 'B03', 'B06', 'B11', 'B18', 'B23', 'B24', 'B29', 'B30', 'B32'].includes(beatId)) return 'medium';
  return 'high';
};
const beatComparisons = timelineBeats.map((beat) => ({
  beatId: beat.beatId,
  startMs: beat.startMs,
  endMs: beat.endMs,
  largeV3TurboText: beat.evidence.largeV3Turbo.map((item) => item.text).join(''),
  whisperCppSmallText: beat.evidence.whisperCppSmall.map((item) => item.text).join(''),
  crossModelAgreement: agreementLevel(beat.beatId),
  candidateConfidence: levelByBeat.get(beat.beatId),
  humanListeningPerformed: false,
  reviewRequired: beat.reviewRequired,
  correctionIds: beat.correctionIds,
  uncertaintyIds: beat.uncertaintyIds,
}));

const review = {
  schemaVersion: 'koubo-transcription-review/v1',
  taskId,
  episodeId: timeline.episodeId,
  createdAt,
  status: 'needs-human-audio-review',
  formalAllowed: false,
  permittedUse: timeline.permittedUse,
  authority: 'recorded-audio',
  scriptRole: 'comparison-only',
  humanListeningPerformed: false,
  userAudioReviewConfirmed: false,
  source,
  modelRoles: {
    baseline: 'mlx-whisper-large-v3-turbo-with-word-timestamps',
    comparison: 'whisper.cpp-small',
    note: '两者都是机器识别；一致不等于真人已听校。',
  },
  comparisonSummary: {
    totalBeats: beatComparisons.length,
    highAgreement: beatComparisons.filter((item) => item.crossModelAgreement === 'high').length,
    mediumAgreement: beatComparisons.filter((item) => item.crossModelAgreement === 'medium').length,
    lowAgreement: beatComparisons.filter((item) => item.crossModelAgreement === 'low').length,
  },
  focusedWhisperBaseChecks: await Promise.all([
    {
      id: 'FB01',
      focus: '广告名句是“广告”还是“广告费”',
      windowMs: [178500, 188500],
      sourcePath: focusPaths.adQuote,
      rawText: focusRaw[0].transcription.map((item) => item.text).join(''),
      finding: '局部 base、全量 small 与全量 large-v3-turbo 都识别为“我的广告有一半浪费了”，均未出现“费”。',
      conclusion: '候选字幕保留“广告”，不恢复原稿的“广告费”。',
      confidence: 'high-asr-consensus-not-human-verified',
    },
    {
      id: 'FB02',
      focus: '“常见的误解”',
      windowMs: [322000, 331000],
      sourcePath: focusPaths.misunderstanding,
      rawText: focusRaw[1].transcription.map((item) => item.text).join(''),
      finding: '三路机器识别均落到“物件”近音，但原稿、固定搭配与论证语义均指向“误解”。',
      conclusion: '候选字幕作高置信语义正字为“误解”，但仍标记为未人工听校的修正。',
      confidence: 'high-semantic-correction-not-human-verified',
    },
    {
      id: 'FB03',
      focus: '“连接成本趋近于零”',
      windowMs: [337000, 342000],
      sourcePath: focusPaths.connectionCost,
      rawText: focusRaw[2].transcription.map((item) => item.text).join(''),
      finding: '三路机器识别在同音字上写为“链接”，对“趋近”后一字均有近音误识。',
      conclusion: '按原稿、书面语境和固定搭配正字为“连接成本趋近于零”；口语的“连/链”同音无法仅凭声学区分。',
      confidence: 'high-orthographic-normalization-not-human-verified',
    },
    {
      id: 'FB04',
      focus: '片尾签名',
      windowMs: [382800, 386750],
      sourcePath: focusPaths.signoff,
      rawText: focusRaw[3].transcription.map((item) => item.text).join(''),
      finding: 'large-v3-turbo 为“我是超哥，在兰州，也在创业”；全量 small 与局部 base 均严重误识，原稿为“我是超哥，在兰州AI创业”。',
      conclusion: '没有足够的多模型支持可以锁定末句；保留 large 候选并强制人工听校。',
      confidence: 'low-needs-human-audio-review',
    },
  ].map(async (item) => ({...item, source: await fileRecord(item.sourcePath), sourcePath: undefined}))),
  beatComparisons,
  corrections,
  uncertainties,
  manualListeningGaps: [
    ...corrections.map((item) => ({
      type: 'candidate-correction',
      id: item.id,
      beatId: item.beatId,
      startMs: timelineBeats.find((beat) => beat.beatId === item.beatId).startMs,
      endMs: timelineBeats.find((beat) => beat.beatId === item.beatId).endMs,
      prompt: `请听辨“${item.from}”是否应正字为“${item.to}”。`,
    })),
    ...uncertainties.map((item) => ({
      type: 'unresolved-wording',
      id: item.id,
      beatId: item.beatId,
      startMs: timelineBeats.find((beat) => beat.beatId === item.beatId).startMs,
      endMs: timelineBeats.find((beat) => beat.beatId === item.beatId).endMs,
      retained: item.retained,
      alternatives: item.alternatives,
      prompt: '请以原片音频确认实际说法。',
    })),
  ],
  preservedRecordedDifferences: timeline.preservedRecordedDifferences,
  limitations: [
    '本轮只使用本地 large-v3-turbo 与 whisper.cpp small 交叉识别，没有进行人工听校。',
    '两模型属于同系列 ASR，两者一致仍不等于实际说法已由人确认。',
    '候选正字仅用于本地完整观看版的字幕准备；所有修正和不确定项在正式字幕前都必须听校。',
    '原稿只用来识别可能的同音错字和记录差异，没有用来把实际口语改回原稿。',
  ],
  nextGate: 'human-audio-review-before-formal-subtitles',
};

await writeFile(outputPaths.timeline, `${JSON.stringify(timeline, null, 2)}\n`);
await writeFile(outputPaths.bilingual, `${JSON.stringify(bilingual, null, 2)}\n`);
await writeFile(outputPaths.review, `${JSON.stringify(review, null, 2)}\n`);

const policy = {
  schemaVersion: 1,
  taskId,
  episodeId: timeline.episodeId,
  canonicalSource: 'recorded-audio',
  scriptRole: 'comparison-only',
  captionTextPolicy: 'spoken-verbatim-candidate-with-explicit-asr-corrections-and-uncertainties',
  englishTranslationSource: 'canonical-spoken-chinese-candidate',
  source: source.recordedMedia,
  canonical: await fileRecord(outputPaths.timeline),
  bilingual: await fileRecord(outputPaths.bilingual),
  captionPages: pageRecords.length,
  verification: {
    correctionCount: corrections.length,
    uncertaintyCount: uncertainties.length,
    correctionsHumanVerified: false,
    uncertaintiesHumanVerified: false,
    reviewRequiredPageCount: pageRecords.filter((page) => page.reviewRequired).length,
    review: await fileRecord(outputPaths.review),
    validator: {
      path: path.join(outputDir, 'validate-canonical-r1.mjs'),
      projectRelativePath: path.relative(projectRoot, path.join(outputDir, 'validate-canonical-r1.mjs')),
    },
  },
  compliance: {
    status: 'needs-human-audio-review',
    candidateStructureValidated: true,
    formalAllowed: false,
    humanListeningPerformed: false,
    userAudioReviewConfirmed: false,
    reason: `${corrections.length} 项候选正字与 ${uncertainties.length} 项不确定说法尚未通过原声听校；仅可用于本地完整观看候选片的字幕准备。`,
  },
};

await writeFile(outputPaths.policy, `${JSON.stringify(policy, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
  status: 'built-needs-validation-and-human-audio-review',
  beatCount: timelineBeats.length,
  pageCount: pageRecords.length,
  correctionCount: corrections.length,
  uncertaintyCount: uncertainties.length,
  outputs: Object.fromEntries(Object.entries(outputPaths).map(([key, value]) => [key, path.relative(projectRoot, value)])),
}, null, 2)}\n`);
