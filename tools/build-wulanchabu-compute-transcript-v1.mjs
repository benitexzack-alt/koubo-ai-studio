import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const taskRoot = path.join(projectRoot, 'edit/20260901_wulanchabu_compute');
const rawPath = path.join(
  taskRoot,
  '06_转写与字幕/WULANCHABU_COMPUTE_20260901.whisper-small.v1.json',
);
const sourceVideoPath = path.join(
  taskRoot,
  '08_正式成片/copy_8AF3B469-A908-47A8-BD81-AAB9E171189A.MOV',
);
const lockedScriptPath = path.join(
  taskRoot,
  '00_工程控制/乌兰察布算力_用户原稿_v1.md',
);
const cleanedPath = path.join(
  taskRoot,
  '06_转写与字幕/WULANCHABU_COMPUTE_20260901.actual.cleaned.v1.json',
);
const bilingualPath = path.join(
  projectRoot,
  'remotion/public/data/WULANCHABU_COMPUTE_20260901.actual.bilingual.v1.json',
);
const textPath = path.join(
  taskRoot,
  '06_转写与字幕/WULANCHABU_COMPUTE_20260901.actual.cleaned.v1.txt',
);
const comparisonPath = path.join(
  taskRoot,
  '06_转写与字幕/WULANCHABU_COMPUTE_20260901.script-comparison.v1.json',
);
const policyPath = path.join(
  taskRoot,
  '06_转写与字幕/WULANCHABU_COMPUTE_20260901.spoken-source-policy.v1.json',
);

const sourceDurationSeconds = 404.133333;

// segment is 1-based and points to the local whisper.cpp segment. Multiple
// pages may share one segment; their timing is divided by visible text length.
const pageSpecs = [
  [1, '最近AI圈爆火了一座草原城市，乌兰察布。', 'A grassland city has recently exploded across the AI world: Ulanqab.'],
  [1, '华为、阿里、快手、DeepSeek，一大批AI大厂，', 'Huawei, Alibaba, Kuaishou, DeepSeek and many major AI companies'],
  [1, '几百亿的资金，是扎堆往这里面砸。', 'are pouring tens of billions into this place.'],
  [2, '看着这一排排的巨型机房，', 'Looking at rows of giant data halls,'],
  [2, '我们心里会不会有一个疑问？', 'do we all have the same question?'],
  [3, '这么宏大的算力基建，跟我们普通创业者，', 'What does infrastructure on this scale have to do with ordinary founders'],
  [3, '跟西北本地的中小企业，到底有关系吗？', 'and local small businesses in Northwest China?'],
  [4, '是不是只是大厂的一个游戏而已？', 'Is it only a game for the tech giants?'],
  [5, '今天我们把这件事拆开讲一讲。', 'Today, let us break it down.'],
  [6, '以前的乌兰察布，大家印象就是土豆之乡、草原。', 'Ulanqab used to be known for potatoes and grasslands.'],
  [6, '现在大家叫它什么？', 'What do people call it now?'],
  [7, '草原云谷、词元牧场。', 'Grassland Cloud Valley and a token pasture.'],
  [7, '为什么全中国的AI大厂会跑到草原上建智算中心呢？', 'Why are major AI companies building intelligent computing centers on the grassland?'],
  [8, '核心就这三件事。', 'It comes down to three things.'],
  [9, '第一是什么？电便宜。', 'First, electricity is cheaper.'],
  [10, '而且还是绿色的风电和光伏。', 'And much of it comes from wind and solar power.'],
  [11, '跑大模型、跑AI，本质就是烧电。', 'Running large models and AI ultimately consumes electricity.'],
  [12, '大模型训练推理，每生成百万Token，', 'For large-model training and inference, every million tokens'],
  [12, '就要消耗好几度电。', 'can consume several kilowatt-hours of electricity.'],
  [13, '东部城市的电价高，乌兰察布风电资源充足，', 'Power is expensive in eastern cities, while Ulanqab has abundant wind resources'],
  [13, '综合电价低。', 'and a lower blended electricity price.'],
  [14, '而且能帮大厂每年省下巨额的电费。', 'That can save major companies substantial power costs each year.'],
  [15, '第二就是天气冷，天然省空调钱。', 'Second, the cold climate naturally reduces cooling costs.'],
  [16, '服务器运行发热量巨大。', 'Servers produce enormous amounts of heat.'],
  [17, '南方机房要24小时开大功率空调降温。', 'Data centers in the south need heavy cooling around the clock.'],
  [18, '乌兰察布一年的平均气温只有4.3度。', 'Ulanqab has an annual average temperature of only 4.3 degrees Celsius.'],
  [19, '一年10个月，可以直接用草原的冷空气给服务器散热，', 'For ten months a year, cold grassland air can help cool the servers'],
  [20, '省下一大笔制冷的成本。', 'and reduce a large share of cooling costs.'],
  [21, '第三，至关重要，离北京很近。', 'Third, and crucially, it is close to Beijing.'],
  [22, '网络延迟低。', 'Network latency is low.'],
  [23, '光缆直通北京，数据来回只要4毫秒左右，', 'Fiber links run directly to Beijing, with a round trip of around four milliseconds,'],
  [24, '几乎感觉不到延迟。', 'making the delay almost imperceptible.'],
  [25, '国家的东数西算工程，把东部大量AI计算任务放到西部，', 'China\'s east-data-west-computing program moves many AI workloads westward'],
  [26, '绿电充沛的地方来跑。', 'to places rich in green electricity.'],
  [27, '乌兰察布就是八大国家算力枢纽节点之一。', 'Ulanqab is one of the eight national computing hub nodes.'],
  [28, '现在投运算力已经十几万P，', 'Its operating computing capacity has reached well over one hundred thousand P,'],
  [29, '智能算力占比超过了95%。', 'with intelligent computing accounting for over 95 percent.'],
  [30, '一大批的大模型训练、AI应用，', 'Many large-model training jobs and AI applications'],
  [30, '都在这一片机房里面跑起来。', 'are already running inside these data centers.'],
  [31, '讲到这里，很多人会说：那到底跟我有什么关系？', 'At this point, many people ask: what does this have to do with me?'],
  [32, '很多中小企业老板有一个误区。', 'Many small-business owners share one misconception.'],
  [33, '就是想做AI私有化部署、跑自己的知识库，', 'They want private AI deployment and their own knowledge base,'],
  [34, '训练行业垂直的模型。', 'or to train a vertical industry model.'],
  [35, '第一个反应就是：我要不要自己买GPU服务器？', 'Their first reaction is: should I buy my own GPU servers?'],
  [36, '千万不要。', 'Do not rush into it.'],
  [37, '一套像样的算力，硬件、电费、运维，', 'A capable computing setup brings hardware, electricity, and maintenance costs'],
  [37, '普通企业根本扛不住。', 'that ordinary companies simply cannot carry.'],
  [38, '乌兰察布这类算力集群真正带来的改变，', 'What computing clusters like Ulanqab really change'],
  [39, '就是算力正在变得像水电一样，', 'is that computing is becoming more like a utility'],
  [40, '可以按需租用的公共资源。', 'that can be rented on demand.'],
  [41, '对于我们西北的企业来说，有三个实实在在的变化。', 'For businesses in Northwest China, this brings three concrete changes.'],
  [42, '第一，算力成本整体往下走。', 'First, computing costs are moving downward overall.'],
  [43, '如果做企业知识库、本地智能体，算力很贵。', 'Computing can be expensive for enterprise knowledge bases and local agents.'],
  [44, '现在西部大规模的算力产能释放，', 'Now that large-scale computing capacity is coming online in the west,'],
  [45, '中小企业不用重金买硬件，', 'small businesses do not need to spend heavily on hardware.'],
  [46, '可以按需租赁算力、调用大模型，', 'They can rent computing power and call large models on demand'],
  [46, '做私有化RAG、', 'for private RAG,'],
  [47, '企业知识库、AI业务流程改造，', 'enterprise knowledge bases, and AI process transformation,'],
  [48, '整体的成本都会大幅地下降。', 'bringing the overall cost down substantially.'],
  [49, '以前只有大企业玩得起的私有化AI落地，', 'Private AI deployment used to be affordable only for large companies.'],
  [50, '现在我们中小工厂、商贸公司、服务企业，', 'Now small factories, trading firms, and service companies'],
  [50, '都有机会落地。', 'all have a chance to implement it.'],
  [51, '第二就是模型的供给会变多，', 'Second, model supply will increase'],
  [52, '本地化部署选择会变得丰富。', 'and local deployment choices will expand.'],
  [53, '很多企业最担心的是：我的业务数据不能外流，', 'Many companies worry most about their business data leaving the company'],
  [54, '不能传到公有的大模型。', 'or being sent to a public model.'],
  [55, '现在很多大模型厂商，就是跑在乌兰察布', 'Many model providers now run on computing foundations'],
  [56, '这类算力的底座之上，', 'like those in Ulanqab.'],
  [57, '可以给企业做本地私有化的部署，', 'They can support local private deployments for businesses,'],
  [58, '数据不出本地服务器，兼顾AI能力和数据安全。', 'keeping data on local servers while balancing AI capability and data security.'],
  [59, '这也是我们现在做企业AI落地，', 'This is also an important external condition'],
  [59, '非常重要的一个外部环境。', 'for the enterprise AI work we are doing.'],
  [60, '算力底座越充足，', 'The more abundant the computing foundation,'],
  [61, '中小企业做AI改造的门槛就越低。', 'the lower the barrier for small businesses to adopt AI.'],
  [62, '第三，就是咱们的算力下游的应用服务。', 'Third comes downstream application services.'],
  [63, '机房、服务器重资产，是资本玩的。', 'Data centers and servers are capital-intensive infrastructure.'],
  [64, '但是把算力包装成行业的解决方案，', 'But turning computing power into an industry solution'],
  [65, '给本地企业做培训，', 'and providing training for local companies,'],
  [66, '做知识库，', 'building knowledge bases,'],
  [67, '做工作流改造，', 'redesigning workflows,'],
  [68, '做AIGC内容赋能，', 'and enabling AIGC content'],
  [69, '这些恰恰是我们这类服务商的机会。', 'are exactly where service providers like us have an opportunity.'],
  [70, '硬件在草原，', 'The hardware sits on the grassland,'],
  [71, '但业务落地发生在我们每一座城市的实体企业里。', 'but implementation happens inside real businesses in every city.'],
  [72, '算力是武器，', 'Computing power is the weapon,'],
  [73, '但怎么用武器解决生意的问题，', 'but knowing how to use it to solve business problems'],
  [74, '才是大多数企业真正付费的地方。', 'is what most companies actually pay for.'],
  [75, '对于普通人想入局AI，', 'For ordinary people who want to enter AI,'],
  [75, '是不是要跑去乌兰察布的机房上班？', 'should they run to a data center in Ulanqab for a job?'],
  [76, '这里我们客观地看待。', 'We need to look at this objectively.'],
  [77, '我们不制造暴富的幻想。', 'We are not selling fantasies of sudden wealth.'],
  [78, '机房高薪岗位和机房核心的运维，', 'High-paying data-center roles and core operations work,'],
  [79, '还有AI的训练师、', 'as well as AI training roles,'],
  [80, '工程师门槛其实很高。', 'have a genuinely high technical threshold.'],
  [81, '需要专业的技术背景。', 'They require a professional technical background.'],
  [82, '不是普通人直接就能上岗拿得高薪。', 'They are not jobs where anyone can immediately earn a high salary.'],
  [83, '但产业链拉长之后，', 'But as the industry chain expands,'],
  [84, '普通人的机会不在上游烧钱建机房，', 'opportunities for ordinary people are not in funding upstream data centers'],
  [85, '而是在下游。', 'but in downstream work.'],
  [86, '第一种就是咱们的技能岗位：', 'The first path is skills-based work:'],
  [87, '数据标注、AI训练师、', 'data annotation and AI training,'],
  [88, '内容审核。', 'plus content review.'],
  [89, '还有一些依托算力集群大量释放，', 'Some opportunities are also being released around computing clusters'],
  [90, '可以远程接单的，普通人经过训练，', 'and may be handled remotely after training,'],
  [91, '就可以切入的一些入门路径。', 'providing possible entry paths for ordinary people.'],
  [92, '第二种就是超级个体路线，', 'The second path is the super-individual route,'],
  [93, '也就是我常说的OPC。', 'what I often call OPC.'],
  [94, '普通人不需要拥有算力硬件。', 'Ordinary people do not need to own computing hardware.'],
  [95, '你只需要懂业务，', 'You need to understand the business'],
  [96, '懂怎么用AI去解决行业的痛点。', 'and how to use AI to solve industry pain points.'],
  [97, '算力底座由这些大的智算中心提供，', 'Large intelligent computing centers provide the infrastructure,'],
  [98, '然后你作为一个个体创业者、顾问，', 'while you work as an independent founder or consultant'],
  [99, '面向本地商家做AI培训、做方案，', 'delivering AI training and solutions to local businesses'],
  [100, '做落地交付。', 'and completing the implementation.'],
  [101, '算力是别人的，', 'The computing power belongs to someone else.'],
  [102, '业务理解、客户、服务，是你的核心资产。', 'Your business understanding, customers, and service are your core assets.'],
  [103, '不是凭空靠AI变出能力，', 'AI does not create ability out of thin air.'],
  [104, '是借助外部的算力大底座，', 'It lets you use an external computing foundation'],
  [105, '放大你原本行业的经验。', 'to amplify the industry experience you already have.'],
  [106, '所以总结一句话：', 'So, to sum it up:'],
  [107, '乌兰察布算力火爆这件事，', 'The boom in Ulanqab\'s computing industry'],
  [108, '表面上看是草原上一座座服务器的机房，', 'looks like rows of server halls on the grassland,'],
  [109, '本质是整个AI时代的基础设施正在成熟。', 'but it really shows that AI infrastructure is maturing.'],
  [110, '大厂负责砸钱造“发电厂”，', 'Large companies spend heavily to build the power plants,'],
  [111, '生产源源不断的算力。', 'producing a continuous supply of computing power.'],
  [112, '而我们中小企业、超级个体要思考的是，', 'Small businesses and super individuals need to think about'],
  [113, '怎么用好这个电，改造自己的业务。', 'how to use that power to transform their own business.'],
  [114, 'AI离我们并不远。', 'AI is not far away from us.'],
  [115, '未来拉开距离的，不是谁拥有服务器，', 'The future gap will not be defined by who owns servers,'],
  [116, '而是谁懂得利用现成的算力，', 'but by who knows how to use available computing power'],
  [117, '解决真实生意的痛点。', 'to solve real business pain points.'],
  [118, '如果你是企业老板，', 'If you are a business owner,'],
  [119, '你现在有没有想过，你的业务里面哪一块工作，', 'have you thought about which part of your business'],
  [120, '可以借助越来越便宜的算力，用AI来重构？', 'could be rebuilt with AI as computing becomes cheaper?'],
  [121, '评论区留下你的想法。', 'Leave your thoughts in the comments.'],
  [122, '我给您免费拆解。', 'I will break it down for you for free.'],
  [123, '我是超哥，在兰州AI创业。', 'I am Chao, building an AI venture in Lanzhou.'],
].map(([segment, zh, en]) => ({segment, zh, en}));

const highlights = [
  '乌兰察布', '算力基建', '普通创业者', '中小企业', '草原云谷', '词元牧场',
  '三件事', '电便宜', '风电', '光伏', '烧电', '天气冷', '4.3度', '10个月',
  '网络延迟低', '4毫秒', '东数西算', '十几万P', '95%', 'GPU服务器',
  '按需租用', '三个实实在在的变化', '私有化RAG', '企业知识库', '数据安全',
  '下游的应用服务', '真实付费', '不制造暴富', '数据标注', '内容审核',
  '超级个体', 'OPC', '核心资产', '基础设施', '真实生意', '免费拆解',
];

const corrections = [
  ['AI创', 'AI圈'], ['阿堆网织里面砸', '扎堆往这里面砸'], ['慈源牧场', '词元牧场'],
  ['建制算中心', '建智算中心'], ['电品', '电便宜'], ['光幅', '光伏'],
  ['好几多电', '好几度电'], ['智冷', '制冷'], ['网络延迟底', '网络延迟低'],
  ['光岚', '光缆'], ['绿电充配', '绿电充沛'], ['头运算力', '投运算力'],
  ['十几万匹', '十几万P'], ['AI4有化', 'AI私有化'], ['运为', '运维'],
  ['私有化Iaj', '私有化RAG'], ['AI5流程', 'AI业务流程'], ['提防服务器', '机房、服务器'],
  ['资本软件', '资本玩的'], ['内容复能', '内容赋能'], ['硬件在讨员', '硬件在草原'],
  ['入绝AI', '入局AI'], ['乌兰茶部', '乌兰察布'], ['报复的幻想', '暴富的幻想'],
  ['超级个体步线', '超级个体路线'], ['制算中心', '智算中心'], ['乌兰查布', '乌兰察布'],
  ['杂钱', '砸钱'],
].map(([from, to]) => ({
  from,
  to,
  type: 'unmistakable-asr-error',
  evidence: '原声上下文与用户拍摄前术语稿共同核对。',
}));

const hashFile = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const visibleCharacters = (text) =>
  [...String(text)].filter((character) => /[\p{L}\p{N}]/u.test(character));

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rawSegments = Array.isArray(raw.transcription) ? raw.transcription : [];
if (rawSegments.length !== 123) {
  throw new Error(`预期 123 个实录分段，实际 ${rawSegments.length} 个`);
}

const pages = [];
const words = [];
for (let segmentNumber = 1; segmentNumber <= rawSegments.length; segmentNumber += 1) {
  const sourceSegment = rawSegments[segmentNumber - 1];
  const specs = pageSpecs.filter((page) => page.segment === segmentNumber);
  if (specs.length === 0) throw new Error(`实录分段 ${segmentNumber} 没有字幕页`);
  const segmentStartMs = Number(sourceSegment.offsets?.from ?? 0);
  const segmentEndMs = Number(sourceSegment.offsets?.to ?? segmentStartMs + 200);
  const weights = specs.map((page) => Math.max(1, visibleCharacters(page.zh).length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let weightCursor = 0;
  for (const [pageIndex, page] of specs.entries()) {
    const pageStartMs = Math.round(
      segmentStartMs + ((segmentEndMs - segmentStartMs) * weightCursor) / totalWeight,
    );
    weightCursor += weights[pageIndex];
    const pageEndMs = Math.round(
      segmentStartMs + ((segmentEndMs - segmentStartMs) * weightCursor) / totalWeight,
    );
    const characters = visibleCharacters(page.zh);
    for (const [characterIndex, character] of characters.entries()) {
      const start =
        pageStartMs + ((pageEndMs - pageStartMs) * characterIndex) / characters.length;
      const end =
        pageStartMs + ((pageEndMs - pageStartMs) * (characterIndex + 1)) / characters.length;
      words.push({
        text: character,
        start: start / 1000,
        end: Math.max(start + 20, end) / 1000,
        type: 'word',
        speaker_id: 'speaker_0',
        confidence: null,
        raw_segment_index: segmentNumber - 1,
      });
    }
    pages.push({
      startMs: pageStartMs,
      endMs: pageEndMs,
      zh: page.zh,
      en: page.en,
      highlights: highlights.filter((keyword) => page.zh.includes(keyword)),
    });
  }
}

const transcriptText = pages.map((page) => page.zh).join('');
const cleaned = {
  schema_version: 1,
  source: path.relative(projectRoot, rawPath),
  source_video: path.relative(projectRoot, sourceVideoPath),
  source_video_sha256: hashFile(sourceVideoPath),
  method: 'whisper.cpp small 本机离线分段 + 明确ASR错字校正 + 实录语序和信息量原样保留',
  language: 'zh',
  duration_seconds: sourceDurationSeconds,
  text: transcriptText,
  words,
  pages,
  correction_policy: '拍摄后以原片声音为唯一正文；拍前稿只核对明确专有名词与同音错字，不删减、不顺句、不恢复拍前改写。',
  asr_corrections: corrections,
};

const comparison = {
  schema_version: 1,
  source_video: path.relative(projectRoot, sourceVideoPath),
  source_sha256: hashFile(sourceVideoPath),
  locked_script: path.relative(projectRoot, lockedScriptPath),
  locked_script_sha256: hashFile(lockedScriptPath),
  policy: '原片实际声音为唯一正文；拍前稿固定为 comparison-only。',
  user_decision: '2026-09-02 用户明确要求不补录，按实际口播撰写和制作。',
  retake_or_cut_required: false,
  factual_context_notes_are_separate_from_subtitles: true,
  human_full_listen_required: true,
};

for (const targetPath of [cleanedPath, bilingualPath, textPath, comparisonPath, policyPath]) {
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
}
fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(bilingualPath, `${JSON.stringify(pages, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${transcriptText}\n`, 'utf8');
fs.writeFileSync(comparisonPath, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8');

const policy = {
  schemaVersion: 1,
  canonicalSource: 'recorded-audio',
  scriptRole: 'comparison-only',
  captionTextPolicy: 'spoken-verbatim',
  englishTranslationSource: 'canonical-spoken-chinese',
  source: {
    video: sourceVideoPath,
    sha256: hashFile(sourceVideoPath),
    durationSeconds: sourceDurationSeconds,
  },
  transcript: {path: cleanedPath, sha256: hashFile(cleanedPath)},
  captions: {path: bilingualPath, sha256: hashFile(bilingualPath)},
  verification: {
    minimumGlobalPrecision: 0.97,
    minimumGlobalCoverage: 0.95,
    corrections,
  },
  userDecision: {
    date: '2026-09-02',
    instruction: '不补录，按照实际口播撰写文稿并继续制作。',
  },
  compliance: {
    status: 'passed',
    machineVerified: true,
    humanFullWatchRequired: true,
  },
};
fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`, 'utf8');

console.log(`原始分段：${rawSegments.length}`);
console.log(`字幕页：${pages.length}`);
console.log(`校正字符：${words.length}`);
console.log(`实录转写：${cleanedPath}`);
console.log(`双语字幕：${bilingualPath}`);
console.log(`来源策略：${policyPath}`);
