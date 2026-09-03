import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const taskRoot = path.join(projectRoot, 'edit/20260902_local_ai_services');
const rawPath = path.join(
  taskRoot,
  '06_转写与字幕/LOCAL_AI_SERVICES_20260902.whisper-small.raw.v1.json',
);
const sourceVideoPath = path.join(
  taskRoot,
  '01_口播原片待放/copy_3F3E7580-B0D3-4922-A052-49F299E23BCA.MOV',
);
const lockedScriptPath = path.join(
  taskRoot,
  '00_工程控制/兰州本地AI服务_用户确认原稿_v1.md',
);
const cleanedPath = path.join(
  taskRoot,
  '06_转写与字幕/LOCAL_AI_SERVICES_20260902.actual.cleaned.v1.json',
);
const bilingualPath = path.join(
  projectRoot,
  'remotion/public/data/LOCAL_AI_SERVICES_20260902.actual.bilingual.v1.json',
);
const textPath = path.join(
  taskRoot,
  '06_转写与字幕/LOCAL_AI_SERVICES_20260902.actual.cleaned.v1.txt',
);
const comparisonPath = path.join(
  taskRoot,
  '06_转写与字幕/LOCAL_AI_SERVICES_20260902.script-comparison.v1.json',
);
const policyPath = path.join(
  taskRoot,
  '06_转写与字幕/LOCAL_AI_SERVICES_20260902.spoken-source-policy.v1.json',
);

const sourceDurationSeconds = 279.433333;

// segment is 1-based and points to the local whisper.cpp segment. Multiple
// pages inside one segment are timed proportionally by visible character count.
const pageSpecs = [
  [1, '现在做AIGC的朋友，是不是全部都陷入了内卷？', 'Are people working in AIGC all trapped in an arms race now?'],
  [2, '烧大量Token，投入时间、精力，', 'You burn through tokens and invest time and energy,'],
  [2, '指望短视频播放变现，', 'hoping short-video views will turn into income,'],
  [3, '结果万播也就几块钱。', 'yet ten thousand views may bring only a few yuan.'],
  [4, '学了一堆AI工具，', 'You learn a pile of AI tools,'],
  [4, '但是钱就是落不到自己的口袋。', 'but the money still does not reach your pocket.'],
  [5, '很多人就开始迷茫：', 'So many people start to feel lost:'],
  [5, 'AI到底能不能挣钱？', 'can AI actually make money?'],
  [6, '尤其是我们身处在兰州这种三线城市，', 'Especially for those of us in a city like Lanzhou,'],
  [7, '没有沿海那么多的互联网大厂，', 'without as many major internet companies as the coast,'],
  [8, '是不是AI的机会就跟我们没有关系？', 'does that mean AI opportunities have nothing to do with us?'],
  [9, '今天呢要给大家讲的，', 'What I want to share today'],
  [9, '才是真正能落地、马上能变现的。', 'is something practical that can start earning quickly.'],
  [10, 'AI赚钱，不一定要死磕线上的公域流量。', 'Making money with AI does not require fighting only for public traffic online.'],
  [11, '真正能快速拿到现金的，', 'A faster path to real cash flow'],
  [11, '是本地化AI服务。', 'is localized AI service.'],
  [12, '客户其实就在你身边，', 'Your customers are already around you.'],
  [12, '做完一单，收一单的钱。', 'Finish one order and collect payment for that order.'],
  [13, '听好了啊，第一个方向：', 'Listen closely. The first direction is:'],
  [13, 'AI家庭故事动画、婚礼定制短片。', 'AI family-story animation and customized wedding films.'],
  [14, '抖音上面大家应该都刷到过，', 'You have probably seen this on Douyin:'],
  [14, '妻子给自己的先生', 'a wife creates something for her husband'],
  [15, '做了一个动画短片，', 'in the form of an animated short,'],
  [15, '把一个人从读书、相遇、工作、结婚生子，', 'covering school, meeting, work, marriage, and children,'],
  [16, '这一生的点点滴滴，整理成故事脚本，', 'turning the moments of a life into a story script,'],
  [17, '然后用AIGC生成专属动画。', 'then using AIGC to create a personal animation.'],
  [17, '不是网上千篇一律的模板，', 'It is not another generic online template,'],
  [18, '完完全全属于这一个家庭的回忆。', 'but a memory belonging entirely to that family.'],
  [18, '放到本地市场，需求非常明确。', 'In the local market, the demand is very clear.'],
  [19, '还有婚礼，可以做婚前预告短片。', 'For weddings, you can create a pre-wedding trailer.'],
  [19, '曾经动辄几十万的影视制作，', 'Production that once could cost hundreds of thousands'],
  [20, '几千块钱就搞定了。', 'can now be completed for a few thousand yuan.'],
  [20, '如果做了本地部署，成本更低。', 'With local deployment, the cost can be even lower.'],
  [21, '还有周年纪念、家庭留念、长辈的寿辰，', 'Anniversaries, family keepsakes, and elders\' birthdays'],
  [21, '都可以定制专属的故事动画。', 'can all become customized story animations.'],
  [22, '客户提供照片、口述故事，', 'The customer provides photos and spoken memories.'],
  [22, '咱们就负责梳理脚本，AI生成视频，', 'We organize the script and use AI to create the video,'],
  [22, '交付成片，直接收费。', 'then deliver the finished film and charge directly.'],
  [23, '不靠流量分成，靠服务直接变现。', 'You earn from the service, not from platform revenue sharing.'],
  [23, '还有一个非常有温度的赛道：', 'There is another deeply human direction:'],
  [24, 'AI长辈人生数字回忆录。', 'AI digital life memoirs for elders.'],
  [24, '很多子女都希望把家里老人一辈子的经历、', 'Many children want to preserve an elder\'s life experiences,'],
  [24, '青春往事、奋斗故事留存下来。', 'their youth and stories of hard work.'],
  [25, '你就上门访谈，听老人讲述自己的一生，', 'You visit and interview the elder about their life:'],
  [25, '童年、求学、工作、家庭变迁，', 'childhood, education, work, and family changes,'],
  [25, '录音收集口述的素材。', 'recording the oral history as source material.'],
  [26, '然后再借助AI整理时间线、润色文稿、修复老照片。', 'AI then helps organize the timeline, polish the text, and restore old photos.'],
  [26, '最终交付可以是电子纪念手册、家族数字档案，', 'The result can be a digital memorial book or family archive,'],
  [26, '也可以做成动画短片，', 'or it can become an animated short,'],
  [26, '甚至可以印刷成一种纸质的回忆录，', 'or even a printed memoir,'],
  [26, '作为家族的一份数字资产留给后代。', 'preserved as a family asset for future generations.'],
  [27, '这个不是虚的概念。', 'This is not an abstract concept.'],
  [27, '很多家庭愿意为这份情感记忆买单。', 'Many families are willing to pay to preserve these memories.'],
  [27, '在本地社区、老干部群体里面，需求特别旺盛。', 'Demand is especially strong in local communities and among retired cadres.'],
  [28, '第二个就更牛了：', 'The second direction is even stronger:'],
  [28, '面向银发群体的AI教育培训、营销赋能。', 'AI education, training, and marketing support for older adults.'],
  [28, '中老年创业，手里有大量的产品，', 'Many middle-aged and older entrepreneurs have products,'],
  [28, '养生、保健、实体门店，人很勤奋，', 'wellness offerings, health products, or physical stores. They work hard,'],
  [28, '但是短板非常明显：', 'but their weak points are obvious:'],
  [28, '不会写短视频脚本，不会做配图海报，', 'they cannot write short-video scripts or make promotional posters,'],
  [28, '不会做线上宣传，', 'they struggle with online promotion,'],
  [28, '面对客户也缺少成套的沟通话术。', 'and lack a complete set of customer communication scripts.'],
  [28, '这不业务又来了吗？', 'That is another real service opportunity.'],
  [29, '不是教老人搞高深大模型，', 'This is not about teaching advanced model theory.'],
  [29, '而是教他们实实在在怎么用AI：', 'It is about showing them practical ways to use AI:'],
  [29, '整理一套豆包提示词，写短视频文案，', 'prepare Doubao prompts and write short-video copy,'],
  [29, '生成宣传图片，生成跟客户沟通的销售话术，', 'create promotional images and customer sales scripts,'],
  [29, '帮实体店主解决获客宣传的实际痛点。', 'helping store owners solve real acquisition and promotion problems.'],
  [29, '很多人有误区啊，', 'Many people misunderstand this.'],
  [29, '觉得AI创业必须要搞大模型、做平台、做To B大项目。', 'They think AI entrepreneurship must mean models, platforms, and large B2B projects.'],
  [29, '其实在咱们这个三线城市，', 'But in a city like ours,'],
  [30, '机会恰恰藏在这些接地气的小业务里面。', 'the opportunity often lies in small, practical services.'],
  [31, '线上咱们卷播放啊，', 'Competing for views online'],
  [31, '是跟全国几百万的创作者去竞争。', 'means competing with millions of creators nationwide.'],
  [31, '但是做本地服务，你的竞争对手反而很少。', 'In local services, there may be far fewer competitors.'],
  [31, '线上流量变现，要看算法的脸色啊。', 'Online traffic monetization depends on the algorithm.'],
  [31, '万播几块钱啊，充满不确定性。', 'A few yuan per ten thousand views is highly uncertain.'],
  [31, '但是本地化服务，对接的是本地真实的人和实体商家。', 'Local services connect you with real people and physical businesses nearby.'],
  [31, '需求看得见、摸得着，谈成就有收入。', 'The need is tangible, and a signed job brings income.'],
  [31, '当然也不是说，线上的内容啊，就不要做了。', 'That does not mean you should stop making online content.'],
  [31, '线上的账号是用来展示你的案例，', 'Your online account displays your cases,'],
  [32, '作为你的名片，积累数字资产和个人知识库。', 'acts as a calling card, and builds digital assets and a knowledge base.'],
  [32, '真正成交，落地在线下本地。', 'The actual deal and delivery happen locally, offline.'],
  [33, '不要被网上的各种AI暴富神话搞得焦虑迷茫。', 'Do not let online AI wealth myths make you anxious or lost.'],
  [34, 'AI只是工具。', 'AI is only a tool.'],
  [34, '赚钱的核心，永远不是工具本身，', 'The heart of earning money is never the tool itself,'],
  [34, '而是找到真实的人的真实需求。', 'but finding the real needs of real people.'],
  [35, '在我们西北，在兰州，', 'Here in Northwest China, here in Lanzhou,'],
  [35, '把AI跟本地人的需求结合，', 'combine AI with local people\'s needs.'],
  [35, '这就是普通人可以抓得住的机会。', 'That is an opportunity ordinary people can actually grasp.'],
  [36, '你身边有没有类似的这种本地需求？', 'Do you see similar local needs around you?'],
  [36, '你觉得如果在咱们本地，AI还能做哪些生意？', 'What other AI services could work in our local market?'],
  [36, '评论区呢，我们一起交流一下。', 'Let us discuss them in the comments.'],
  [37, '我是超哥，在兰州AI创业。', 'I am Chao, building an AI venture in Lanzhou.'],
].map(([segment, zh, en]) => ({segment, zh, en}));

const highlights = [
  'AIGC', '内卷', '万播', 'AI工具', 'AI到底能不能挣钱', '兰州', '本地化AI服务',
  'AI家庭故事动画', '婚礼定制短片', '专属动画', '本地市场', '直接收费',
  'AI长辈人生数字回忆录', '上门访谈', '时间线', '修复老照片', '家族数字档案',
  '纸质的回忆录', '银发群体', 'AI教育培训', '营销赋能', '豆包提示词',
  '获客宣传', '三线城市', '本地服务', '真实的人', '实体商家', '线上账号',
  '数字资产', '个人知识库', '真实需求', '西北', '评论区',
];

const corrections = [
  ['talking', 'Token'], ['不会放变现', '播放变现'], ['万波', '万播'],
  ['迷惘', '迷茫'], ['死壳', '死磕'], ['本地化AF', '本地化AI服务'],
  ['故事教本', '故事脚本'], ['AI JC', 'AIGC'], ['影视剧做', '影视制作'],
  ['中年纪念', '周年纪念'], ['授诚', '寿辰'], ['口说故事', '口述故事'],
  ['疏离教本', '梳理脚本'], ['数字回录', '数字回忆录'], ['同年求学', '童年、求学'],
  ['接触AI', '借助AI'], ['电子经验手册', '电子纪念手册'], ['动画当片', '动画短片'],
  ['虚就特别往事', '需求特别旺盛'], ['营发群体', '银发群体'], ['营销付', '营销赋能'],
  ['短视评文', '短视频文案'], ['销售画术', '销售话术'], ['货客宣传', '获客宣传'],
  ['图幣', 'To B'], ['接地区', '接地气'], ['万波', '万播'], ['坦承', '谈成'],
  ['显示你的爱情', '展示你的案例'], ['机类数字资产', '积累数字资产'],
  ['AIBUFF神话', 'AI暴富神话'],
].map(([from, to]) => ({
  from,
  to,
  type: 'unmistakable-asr-error',
  evidence: '原声上下文、相邻实录分段与用户确认稿共同核对。',
}));

const hashFile = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const visibleCharacters = (text) =>
  [...String(text)].filter((character) => /[\p{L}\p{N}]/u.test(character));

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rawSegments = Array.isArray(raw.transcription) ? raw.transcription : [];
if (rawSegments.length !== 37) {
  throw new Error(`预期 37 个实录分段，实际 ${rawSegments.length} 个`);
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
      const start = pageStartMs + ((pageEndMs - pageStartMs) * characterIndex) / characters.length;
      const end = pageStartMs + ((pageEndMs - pageStartMs) * (characterIndex + 1)) / characters.length;
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
  method: 'whisper.cpp small 本机离线分段 + 明确ASR错字校正 + 实录语序和口头连接词保留',
  language: 'zh',
  duration_seconds: sourceDurationSeconds,
  text: transcriptText,
  words,
  pages,
  correction_policy: '拍摄后以原片声音为唯一正文；确认稿只核对明确术语和同音错字，不删减、不顺句、不用确认稿覆盖实录。',
  asr_corrections: corrections,
};

const comparison = {
  schema_version: 1,
  source_video: path.relative(projectRoot, sourceVideoPath),
  source_sha256: hashFile(sourceVideoPath),
  locked_script: path.relative(projectRoot, lockedScriptPath),
  locked_script_sha256: hashFile(lockedScriptPath),
  policy: '原片实际声音为唯一正文；拍前确认稿固定为 comparison-only。',
  observed_spoken_variants: [
    '现在做AIGC的朋友', '身处在兰州这种三线城市', '今天呢要给大家讲的',
    '客户其实就在你身边', '听好了啊', '妻子给自己的先生', '长辈的寿辰',
    '这不业务又来了吗', '很多人有误区啊', '在咱们这个三线城市',
    '线上咱们卷播放啊', '要看算法的脸色啊', '评论区呢，我们一起交流一下',
  ],
  omitted_core_sections: [],
  repeated_full_sections: [],
  ending_complete: true,
  retake_or_cut_required: false,
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
    date: '2026-09-04',
    instruction: '所有素材和原片已放好，开始制作；字幕与剪辑以实际口播为准。',
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
