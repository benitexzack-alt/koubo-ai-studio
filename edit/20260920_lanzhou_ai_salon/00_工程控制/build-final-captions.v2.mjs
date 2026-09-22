import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import {dirname, resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../../..');
const asrRoot = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/05_实录与字幕/asr-final-v2',
);
const outputPath = resolve(
  projectRoot,
  'remotion/public-salon-20260920/data/captions.final-source.zh.v2.json',
);
const transcriptPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/05_实录与字幕/canonical-transcript.final-source.v2.json',
);
const reviewPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/05_实录与字幕/caption-review.final-source.v2.json',
);
const policyPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/05_实录与字幕/spoken-source-policy.v2.json',
);

const correctionSpecs = [
  ['插楼', '沙龙', '上下文与small/large交叉结果均指向活动“沙龙”。'],
  ['杀龙', '沙龙', '上下文与small/large交叉结果均指向活动“沙龙”。'],
  ['沙楼', '沙龙', '上下文与small/large交叉结果均指向活动“沙龙”。'],
  ['兰土', '兰州', '活动地点与用户提供会议资料确认。'],
  ['南州', '兰州', '活动地点与用户提供会议资料确认。'],
  ['享用AI', '想用AI', '语义和多模型交叉结果确认。'],
  ['总之一次', '组织一次', '主持人上下文为每月线下组织活动。'],
  ['讯法', '询问', '主持人语义为通过AI自我询问和交流。'],
  ['AIEA', 'AI', '清晰技术术语误识别。'],
  ['AEA', 'AI', '清晰技术术语误识别。'],
  ['AI追踪给出的答案', 'AI最终给出的答案', 'small与分段large交叉核对。'],
  ['充值在花园里', '种植在花园里', '花朵比喻的多模型与上下文交叉核对。'],
  ['注射在花园里', '种植在花园里', '花朵比喻的多模型与上下文交叉核对。'],
  ['开放在春天一朵', '开放在春天里', '同一句花朵比喻的上下文校正。'],
  ['老虚聊医保', '老徐聊医保', '账号名由实录上下文与会议导图共同确认。'],
  ['医保肺减', '医保飞检', '行业术语经small/large与旧源复核。'],
  ['医保肺检', '医保飞检', '行业术语经small/large与旧源复核。'],
  ['也算是投入', '也算是头部', '多模型与上下文交叉核对。'],
  ['发布到剪辑到发布', '写文案、剪辑到发布', '句内ASR重复，旧源逐词结果支持。'],
  ['一天所以就是两天', '一天甚至两天', '多模型与旧源逐词结果交叉核对。'],
  ['游人有余', '游刃有余', '固定成语且声学结果一致。'],
  ['公寓的流量', '公域的流量', '变现上下文与多模型结果一致。'],
  ['4亿里面', '私域里面', '公域转私域为清晰行业术语。'],
  ['挂课，留资', '挂课、留资', '变现语境和响度归一后声学结果更支持“留资”。'],
  ['全国前2000的名字', '全国前两千的名次', '比赛语义与多模型结果一致。'],
  ['去做就自己能行', '去做自己的事情', 'small与旧源逐词结果一致。'],
  ['中间的潮流', '中间的桥梁', '客户连接与交付上下文确认。'],
  ['没有采好', '没有踩好', '法律红线上下文中的同音字误识别。'],
  ['采量', '踩雷', '法律红线上下文中的同音字误识别。'],
  ['飞夫T0伙伴', '飞书生态伙伴', '飞书主题、会议导图与后文术语交叉核对。'],
  ['飞夫替领伙伴', '飞书生态伙伴', '飞书主题、会议导图与后文术语交叉核对。'],
  ['其有其的', '所在机构', '机构全称听辨不清，保留其后可确认的“西北区负责人”信息。'],
  ['红颜', '洪岩', '会议导图提供姓名，发音相符。'],
  ['南中', '兰州', '活动地点与画面确认。'],
  ['听企图这样的活动', '听说有这样的活动', '上下文为刷到兰州OPC活动后到场。'],
  ['非常非常精彩', '非常非常精准', '句意为AI输出是否符合需要。'],
  ['高价的一些信息', '高价值的一些信息', '句法与后文“高价值数据”交叉核对。'],
  ['高价的一些情绪', '高价值的一些信息', '句法与后文“高价值数据”交叉核对。'],
  ['呈现在这个分数上', '沉淀在飞书上', '飞书企业数据语境与多模型交叉核对。'],
  ['之前分数的一些用户', '之前飞书的一些用户', '飞书企业数据语境确认。'],
  ['分数', '飞书', '本段持续讨论飞书，模型将“飞书”系统性误识别为“分数”。'],
  ['agent办公室', 'Agent办公', '飞书企业AI办公语境确认。'],
  ['多位表', '多维表格', '飞书产品术语确认。'],
  ['多月表', '多维表格', '飞书产品术语确认。'],
  ['成这样的流程', '沉淀下来的', '上下文为聊天、文档与流程数据沉淀。'],
  ['不懂一个人计划', '不懂你的业务', '前后句为代码能力和业务理解的对照。'],
  ['不懂表达的', '不懂你的业务', '前后句为代码能力和业务理解的对照。'],
  ['驱动这样的超级个体', '徐总这样的超级个体', '现场称呼与画面人物确认。'],
  ['虚众这样的超级个体', '徐总这样的超级个体', '现场称呼与画面人物确认。'],
  ['高价值的知识口', '高价值的知识库', '企业知识与数据语境确认。'],
  ['高价值的指数库', '高价值的知识库', '企业知识与数据语境确认。'],
  ['自己熟悉的行为', '自己熟悉的行业', '垂直行业语境确认。'],
  ['专家对你做支持的行为', '专家对你做支持的行业', '垂直行业语境确认。'],
  ['这个村里面我们做事', '这个垂直领域里做深耕', '飞书嘉宾结论的上下文复核。'],
  ['这些村里面我们做生意', '这个垂直领域里做深耕', '飞书嘉宾结论的上下文复核。'],
  ['吴易鲁', '葛永鹏', '用户明确更正姓名；低响度自报音节相符。'],
  ['吴亦中', '葛永鹏', '用户明确更正姓名；低响度自报音节相符。'],
  ['我一中', '葛永鹏', '用户明确更正姓名；低响度自报音节相符。'],
  ['去拼合看', '去听和看', '该句前文为带着耳朵和眼睛，语义清晰。'],
  ['汽车输入', '轻车熟路', 'small/large声学结果与上下文交叉核对。'],
  ['轻车输入', '轻车熟路', 'small/large声学结果与上下文交叉核对。'],
  ['我教了韩志欣', '我叫韩志鑫', '响度归一后small/large/whisper.cpp及用户姓名一致。'],
  ['本头是学计算机的', '本科是学计算机的', '多模型交叉核对。'],
  ['EI这些东西', 'AI这些东西', '清晰技术术语误识别。'],
  ['AI在强', 'AI再强', '句法和上下文确认。'],
  ['GP的Image Tool', 'GPT的Image Tool', '产品术语与多模型提示词复核。'],
  ['GP的ImageTool', 'GPT的Image Tool', '产品术语与多模型提示词复核。'],
  ['GPT的ImageTool', 'GPT的Image Tool', '恢复产品名中必要的英文空格。'],
  ['效果的头场', '效果图', '设计工作语境与多模型提示词复核。'],
  ['实量头', '矢量图', '设计工作语境与多模型提示词复核。'],
  ['不同的我们进来', '不同的资源进来', '主持人前后文为组织资源。'],
  ['超级的问题', '超级个体', '主持人整段主题为超级个体。'],
  ['自然不会长', '自然不会差', '上下文为共同成长与结果。'],
  ['铺上去干', '扑上去干', '口语固定表达与旧源结果交叉核对。'],
  ['感谢大家的盗牌', '感谢大家的到来', '结尾固定表达且small模型一致。'],
  ['40分钟', '四十分钟', '中文信息卡和字幕数字统一，数值不变。'],
  ['1000多万', '一千多万', '中文信息卡和字幕数字统一，数值不变。'],
  ['100多万', '一百多万', '中文信息卡和字幕数字统一，数值不变。'],
  ['80多万', '八十多万', '中文信息卡和字幕数字统一，数值不变。'],
  ['37000多人', '三万七千多人', '中文信息卡和字幕数字统一，数值不变。'],
  ['最終', '最终', '繁简体统一，不改变原话。'],
  ['變現', '变现', '繁简体统一，不改变原话。'],
  ['我們', '我们', '繁简体统一，不改变原话。'],
  ['已經', '已经', '繁简体统一，不改变原话。'],
  ['最後', '最后', '繁简体统一，不改变原话。'],
  ['問題', '问题', '繁简体统一，不改变原话。'],
  ['網上', '网上', '繁简体统一，不改变原话。'],
  ['掛課', '挂课', '繁简体统一，不改变原话。'],
  ['留資', '留资', '繁简体统一，不改变原话。'],
  ['種', '种', '繁简体统一，不改变原话。'],
  ['問', '问', '繁简体统一，不改变原话。'],
  ['會', '会', '繁简体统一，不改变原话。'],
  ['比較', '比较', '繁简体统一，不改变原话。'],
  ['實際', '实际', '繁简体统一，不改变原话。'],
  ['過程', '过程', '繁简体统一，不改变原话。'],
  ['這', '这', '繁简体统一，不改变原话。'],
  ['個', '个', '繁简体统一，不改变原话。'],
  ['東西', '东西', '繁简体统一，不改变原话。'],
  ['說', '说', '繁简体统一，不改变原话。'],
];

const replacementPairs = correctionSpecs.map(([from, to]) => [from, to]);
const punctuation = /[，。？！；：,.!?;:]$/u;
const visibleLength = (value) =>
  [...String(value).replace(/[，。？！；：,.!?;:\s]/gu, '')].length;
const normalizeText = (value) => {
  let text = String(value)
    .replace(/\s+/gu, '')
    .replace(/,/gu, '，')
    .replace(/!/gu, '！')
    .replace(/\?/gu, '？');
  for (const [from, to] of replacementPairs) text = text.replaceAll(from, to);
  return text;
};

const labelToSpeaker = (label) => {
  if (label.includes('host-opening')) return '主持人';
  if (label.includes('laoxu')) return '老徐';
  if (label.includes('ai-teaching')) return '魏元甲';
  if (label.includes('huang')) return '黄鹏飞';
  if (label.includes('knowledge-payment')) return '李女士';
  if (label.includes('hong')) return '洪岩';
  if (label.includes('ge-yongpeng')) return '葛永鹏';
  if (label.includes('han-zhixin')) return '韩志鑫';
  if (label.includes('host-ending')) return '主持人';
  return '现场发言者';
};

const files = readdirSync(asrRoot)
  .filter((name) => /^\d{2}-.+\.large-clean\.json$/u.test(name))
  .sort();
const words = [];
for (const file of files) {
  const document = JSON.parse(readFileSync(resolve(asrRoot, file), 'utf8'));
  const label = document.label;
  const speaker = labelToSpeaker(label);
  for (const segment of document.result?.segments ?? []) {
    for (const word of segment.words ?? []) {
      const start = Number(word.global_start ?? document.source_start + word.start);
      const end = Number(word.global_end ?? document.source_start + word.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < 8.333) continue;
      words.push({
        raw: String(word.word ?? ''),
        start,
        end: Math.max(end, start + 0.04),
        confidence: Number(word.probability ?? 0),
        label,
        speaker,
      });
    }
  }
}
words.sort((left, right) => left.start - right.start || left.end - right.end);

const protectedTerms = [
  '老徐聊医保',
  '医保飞检',
  '基金监管',
  '公域的流量',
  '转化到私域',
  '中小微企业',
  '知识付费',
  '飞书生态伙伴',
  '高价值的知识库',
  '多维表格',
  '轻车熟路',
  '西北师范大学',
  'GPT的Image Tool',
  '资源共享',
  '资源整合',
  'AI时代',
  '现实当中',
  '现实世界',
  '这些资源',
  '利用这个工具',
  '一朵花',
  '自媒体',
  '写文案',
  '四十分钟',
  '游刃有余',
  '一千多万',
  '一百多万',
  '八十多万',
  '三万七千多人',
  '全国前两千',
  '企业高价值的一些信息',
  '沉淀在飞书上',
  '徐总这样的超级个体',
  '高价值的知识库',
  '垂直领域里做深耕',
  'AI再强',
  '人的判断',
  '效果图',
  '矢量图',
  '同一个行业',
  '持续走下去',
];
const cutsProtectedTerm = (left, right) => {
  const joined = normalizeText(`${left}${right}`);
  const boundary = normalizeText(left).length;
  return protectedTerms.some((term) => {
    const at = joined.indexOf(term);
    return at >= 0 && at < boundary && at + term.length > boundary;
  });
};

const captions = [];
let group = [];
const flush = () => {
  if (!group.length) return;
  const rawText = group.map((word) => word.raw).join('');
  const text = normalizeText(rawText);
  if (text) {
    const startMs = Math.max(0, Math.round(group[0].start * 1000));
    const endMs = Math.max(startMs + 420, Math.round(group.at(-1).end * 1000));
    const confidence =
      group.reduce((sum, word) => sum + word.confidence, 0) / group.length;
    captions.push({
      startMs,
      endMs,
      text,
      speaker: group[0].speaker,
      sourceLabel: group[0].label,
      confidence: Number(confidence.toFixed(4)),
    });
  }
  group = [];
};

for (const word of words) {
  const sameSpeaker = !group.length || group[0].speaker === word.speaker;
  const candidate = normalizeText([...group, word].map((item) => item.raw).join(''));
  const gap = group.length ? word.start - group.at(-1).end : 0;
  const duration = group.length ? word.end - group[0].start : 0;
  if (
    group.length &&
    (!sameSpeaker || gap > 0.72 || visibleLength(candidate) > 19 || duration > 3.8) &&
    !cutsProtectedTerm(group.map((item) => item.raw).join(''), word.raw)
  ) {
    flush();
  }
  group.push(word);
  const current = normalizeText(group.map((item) => item.raw).join(''));
  if (punctuation.test(current) && visibleLength(current) >= 7) flush();
}
flush();

// 低响度葛永鹏段以用户姓名、更响度归一交叉识别和可确认语义重建。
// 时间仍严格沿用最终视频，不向字幕中补写“西部奥体体育”。
const geStartMs = 467567;
const geEndMs = 510833;
const geCues = [
  [467567, 470507, '我是葛永鹏啊，昨天看到这个活动的发起'],
  [470607, 473647, '昨天才报的，我们其实还在'],
  [473647, 477887, '传统的行业里面打转'],
  [478587, 482607, '所以今天我只是带着耳朵和眼睛去听和看'],
  [482887, 485487, '结果才发现我们落后了这么多'],
  [486127, 490867, '兰州这么多的人已经开始行动了，像徐总做得这么成功'],
  [490867, 494387, '对他来说，一个IP打造、获得流量那么方便'],
  [494387, 499967, '对他是轻车熟路，这是多少人现在想做做不到的事情'],
  [499967, 503767, '所以很感谢，得一会儿加一下超哥微信'],
  [503767, 509787, '希望以后有机会多来听、多来学习，谢谢'],
].map(([startMs, endMs, text]) => ({
  startMs,
  endMs,
  text,
  speaker: '葛永鹏',
  sourceLabel: '16-ge-yongpeng',
  confidence: 0.65,
}));
const withoutGe = captions.filter(
  (caption) => caption.endMs <= geStartMs || caption.startMs >= geEndMs,
);
captions.splice(0, captions.length, ...withoutGe, ...geCues);
captions.sort((left, right) => left.startMs - right.startMs);

const replaceSpeakerRange = (startMs, endMs, speaker, sourceLabel, cueRows) => {
  const remaining = captions.filter(
    (caption) => caption.endMs <= startMs || caption.startMs >= endMs,
  );
  const replacement = cueRows.map(([cueStartMs, cueEndMs, text, confidence = 0.82]) => ({
    startMs: cueStartMs,
    endMs: cueEndMs,
    text: normalizeText(text),
    speaker,
    sourceLabel,
    confidence,
  }));
  captions.splice(0, captions.length, ...remaining, ...replacement);
  captions.sort((left, right) => left.startMs - right.startMs);
};

// 全片经人工语义分页：只调整标点和分页，不改变实录信息量。
replaceSpeakerRange(8333, 108100, '主持人', '01-host-opening', [
  [8333, 10833, '首先就感谢大家今天的一个到来'],
  [10833, 14713, '这个就是作为我们为什么要做这个沙龙'],
  [14713, 18853, '首先最简单的，就是在AI这个时代下'],
  [18853, 25413, '我们所有的生活工作，已经被AI已经有所影响'],
  [25413, 27133, '而且不断地在被改变'],
  [27133, 28890, '在这个过程当中，我们'],
  [28890, 32373, '不管是现在所谓的这些OPC创业也好'],
  [32373, 35333, '还是咱们现在的企业主'],
  [35333, 38653, '或者是自身做的一些相关业务'],
  [38653, 41493, '它都在被AI不断地去改变'],
  [41493, 42693, '但是在这个过程当中呢'],
  [42693, 45853, '我们大家都遇到了很多的问题，这些问题'],
  [47393, 51273, '我们在没有和大多数人进行交流的时候'],
  [51273, 55453, '刚开始呢，大家都是在通过AI的不断的这个'],
  [55453, 57913, '自我的这种询问和交流'],
  [57913, 60093, '去找和破解这些问题'],
  [60093, 62013, '但是回归到我们现实当中'],
  [62013, 66353, '发现很多现实世界遇到的这些经验和这些问题呢'],
  [66353, 68853, '跟AI最终给出的答案都不一致'],
  [68853, 71753, '所以这也是我们办这个沙龙的一个初衷'],
  [71753, 74613, '就是作为在甘肃兰州本地来说'],
  [75913, 78853, '我们会用AI的和现在想用AI的这些人'],
  [78853, 79733, '遇到的这些问题'],
  [79733, 82613, '我们如何能够通过大家线下的这种碰面'],
  [82613, 85893, '每个月组织一次，来把这些问题挖出来'],
  [85893, 87713, '然后呢，大家去解决'],
  [87713, 89033, '再一个呢，就是说'],
  [89033, 92873, '把我们的这些身边的一些现实世界的一些资源'],
  [92873, 95333, '就是因为AI它毕竟是一个工具'],
  [95333, 98333, '我们要利用这个工具去解决我们现实世界的问题'],
  [98333, 102993, '我们比喻现在的AI时代，它就像春天一朵'],
  [102993, 105453, '那么一朵花可以种植在花园里'],
  [105453, 108033, '但它一定开放在春天里'],
]);

replaceSpeakerRange(108100, 258467, '老徐', '02-06-laoxu', [
  [108100, 110880, '我有一个自媒体账号，老徐聊医保'],
  [110880, 114040, '这个账号呢，我已经做了两年多'],
  [114680, 120480, '在这个医保飞检、基金监管和合规的这个'],
  [121420, 124860, '这个账号在全国呢，也算是头部'],
  [124860, 129700, '也给保险公司讲课，一节课是一万五'],
  [129700, 132640, '这个工作，我医保做了二十年'],
  [132733, 136253, '所以我从我自己做自媒体开始'],
  [136253, 139733, '我是2023年10月'],
  [139733, 142093, '也就差不多这个十天'],
  [142093, 145693, '我去新疆出差的时候，刚好在宾馆里面没有事'],
  [146393, 149113, '老有人，周围的朋友呢'],
  [149113, 152613, '老是问我一些医保的一些问题啊、政策'],
  [153153, 157173, '我说给一个人说，还不如用自媒体给大家都说'],
  [157173, 161733, '结果就开始做这个自媒体，很简单，就是口播视频'],
  [162793, 166293, '刚开始做的时候也非常痛苦'],
  [166293, 168413, '就是这个面子'],
  [168413, 171933, '做一条视频可能要一天，甚至两天'],
  [172613, 175533, '但是后面呢，慢慢越来越熟悉之后呢'],
  [175533, 180753, '现在可能我写文案、剪辑到发布'],
  [180753, 184733, '可能就是四十分钟之内就搞定了'],
  [184833, 187073, '你说让我现在做这个'],
  [187073, 190973, '我的视频做流量，我现在非常游刃有余'],
  [190973, 193433, '我知道哪一个流量能'],
  [194473, 199253, '播放量会有多少，说什么样的话题，播放量会有多少'],
  [200113, 203233, '我在抖音最高的一个播放量有一千多万'],
  [203233, 206633, '然后视频号呢，有一百多万、八十多万'],
  [206633, 210613, '然后我基本上发一个现在的视频，就是一般的播放量'],
  [210613, 216993, '就是基本上我都能、都能、都能掌握的，流量这个能清楚了'],
  [216993, 220793, '但是最后就卡到这个公域的流量'],
  [220793, 224373, '转化到私域里面怎么成交，卡到这上'],
  [224533, 226873, '但是最终呢，它这个东西'],
  [226873, 229713, '最终我们所说的要变现这个东西'],
  [229713, 234753, '就是走到，我可能已经走了80%了'],
  [234753, 238373, '最后的20%就卡到这种问题上'],
  [238373, 241333, '在网上你去问所有的一些'],
  [241333, 243053, '他说你要挂课、留资等'],
  [243053, 245033, '都会有很多的答案'],
  [245033, 247333, '但是实际走的过程中是走不通的'],
  [247833, 249653, '这也是我最近比较困惑的'],
  [250333, 252053, '希望在下次直播前'],
  [252053, 257773, '我能在这个沙龙里面看能不能解决我就这个问题'],
]);

replaceSpeakerRange(258467, 300867, '魏元甲', '07-09-ai-teaching', [
  [259587, 263167, '我做了一个什么东西呢？因为我的父母都是老师啊'],
  [263747, 266787, '我就是给他们做，这个肯定也有人做过'],
  [266787, 270207, '但是我那会儿也没有去参考别人，去做自己的事情'],
  [270207, 274647, '平时上学啊，去聊那些事情'],
  [274647, 277527, '我就做了一个类似于这个'],
  [279347, 281627, 'AI整个教学系统的一个平台'],
  [281627, 283727, '这个平台大概是怎么样的呢？我简单说'],
  [283900, 289700, '这个比赛呢，报名的数是三万七千多人'],
  [289767, 292567, '今年拿AI没做别的事'],
  [292567, 300847, '我只是在这个比赛上拿了一个全国前两千的名次'],
]);

replaceSpeakerRange(300867, 343500, '黄鹏飞', '10-11-huang', [
  [300867, 302470, '我是在观望，我是在看'],
  [302730, 305510, '但是的话，我是就像那个超哥讲的'],
  [305990, 307590, '这个落地怎么落地'],
  [307850, 310090, '我手里面有大量的中小企业'],
  [310210, 312130, '对不对？而且我手里有大量的业务员'],
  [312550, 315490, '我可以就是说，你们这一块，就像超哥那一块'],
  [315690, 319590, '小程序啊、网站啊，这一块你们弄得好'],
  [319770, 320850, '我就是中间的桥梁'],
  [321170, 324790, '你们跟客户之间的那种沟通也好'],
  [324790, 328710, '然后去交付也好，这一块是我们来干'],
  [328870, 332450, '有一点，我觉得大家有点误区'],
  [332450, 334990, '不是说，哎，能做什么'],
  [335130, 336450, '你看，能做这，能做到'],
  [336710, 340290, '而是作为中小企业，我自己本身最需要什么'],
  [340290, 343290, '就是说，这个东西能解决我什么样的问题'],
]);

replaceSpeakerRange(343500, 386500, '李女士', '12-knowledge-payment', [
  [343500, 347160, '比如说做这种，做这种就是知识付费'],
  [347440, 350760, '因为这个知识付费这一块，也是我们公司的未来'],
  [350760, 352180, '主要的一个方向'],
  [352660, 354360, '就是说做知识付费的这一块'],
  [354580, 360540, '它是有明确的、严格的法律界限规定的'],
  [360980, 364520, '那么我们如果说没有踩好'],
  [364800, 366740, '规避好在这个红线以内'],
  [367160, 371280, '比如说我们去做这个知识付费，我们就很容易踩雷'],
  [371280, 373980, '前提是什么？是不是我自己得会做'],
  [374460, 376760, '我自己得会做，而且我自己会做了以后'],
  [376760, 380440, '就是我自己实际的，我赚到钱了以后，我变现了以后'],
  [380440, 383440, '我才能够带着别人去做，那如果我自己都不会做的话'],
  [383440, 386420, '我来今天我带着你做，我觉得我很就很不负责任'],
]);

// 飞书段系统性存在品牌词误识别；按原声顺序保留全部可确认语义。
replaceSpeakerRange(386500, 467567, '洪岩', '13-15-hong', [
  [386500, 391500, '下午好，我是飞书生态伙伴，西北区负责人洪岩', 0.7],
  [392080, 396840, '非常感谢超哥，因为我是超哥的粉丝，今天是第一次见面'],
  [396840, 400800, '我偶尔刷视频，看到在兰州还有这样的OPC'],
  [400800, 403660, '介绍AI的一些工具'],
  [404000, 407980, '听说有这样的活动，确实也是挺好的'],
  [408533, 413333, '你想让你的Agent、让你的AI工具给你回答'],
  [413333, 416733, '提供非常精准或者你需要的结果'],
  [416733, 419513, '那你就得有企业的数据'],
  [419513, 424753, '得有企业高价值的一些信息，这些都可以沉淀在飞书上'],
  [424753, 427533, '现在好多之前飞书的用户'],
  [427533, 430273, '马上就能跨到Agent办公'],
  [430273, 432453, '因为他们之前不管是聊天记录'],
  [432453, 435293, '每个文档、群里的消息'],
  [435293, 439433, '不管是开的会、建的日程等等这一系列的'],
  [439433, 441933, '或者多维表格里的数据、业务流程'],
  [441933, 443913, '这些都是沉淀下来的'],
  [443933, 447373, '我们公司会写代码，但是不懂你的业务'],
  [447373, 451433, '所以像徐总这样的超级个体越来越值钱'],
  [451433, 455153, '因为你懂业务，有高价值的知识库、高价值的数据'],
  [455153, 457093, '我觉得这才是最重要的'],
  [457093, 460073, '接下来我们的OPC一定要在自己熟悉的行业'],
  [460073, 463333, '或者是你有专家对你做支持的行业'],
  [463333, 467373, '结合运营经验、好的知识和数据，在垂直领域里做深耕'],
]);

// 韩志鑫段的人名由三模型和用户信息共同确认；“大四学生”只进身份卡。
replaceSpeakerRange(510833, 549233, '韩志鑫', '17-han-zhixin', [
  [510833, 513133, '我叫韩志鑫，我是西北师范大学的'],
  [513133, 515153, '本科是学计算机的'],
  [516153, 519453, '但是我们学校里面从来不会教AI这些东西'],
  [519453, 521153, '就一直在折腾、一直在自己用'],
  [521153, 523573, '同时我自己也做短视频'],
  [523573, 526973, '我发现做短视频也会遇见一个问题'],
  [526973, 531153, '我觉得AI再强，人的判断也是特别重要的'],
  [531153, 534833, '你就让它写出一百篇文案来，你不知道哪个好，有啥用呢'],
  [534833, 536773, '我们还在做一些设计'],
  [536773, 540933, '就用GPT的Image Tool来出一些效果图'],
  [540933, 544093, '甚至现在都可以出矢量图，都完全可以'],
  [544093, 546353, '设计这个东西，我都感觉快要被干掉了'],
  [546353, 548373, '我向前辈学习，我还是比较年轻'],
]);

replaceSpeakerRange(467567, 510833, '葛永鹏', '16-ge-yongpeng', [
  [467567, 470507, '我是葛永鹏啊，昨天看到这个活动的发起'],
  [470607, 473647, '昨天才报的，我们其实还在'],
  [473647, 477887, '传统的行业里面打转'],
  [478587, 482607, '所以今天我只是带着耳朵和眼睛去听和看'],
  [482887, 485487, '结果才发现我们落后了这么多'],
  [486127, 488607, '兰州这么多的人已经开始行动了'],
  [488607, 490867, '像徐总做得这么成功'],
  [490867, 494387, '对他来说，一个IP打造、获得流量那么方便'],
  [494387, 496247, '对他是轻车熟路'],
  [496247, 499967, '这是多少人现在想做做不到的事情'],
  [499967, 503767, '所以很感谢，得一会儿加一下超哥微信'],
  [503767, 509787, '希望以后有机会多来听、多来学习，谢谢'],
]);

replaceSpeakerRange(549233, 613767, '主持人', '18-host-ending', [
  [549233, 552000, '我觉得最大的核心竞争力'],
  [552000, 554773, '就是你能组织到别人组织不到的资源，快速地变现'],
  [555153, 556313, '我觉得这就是超级个体'],
  [556313, 561053, '所以这也是我不断去组织这个会议的一个初衷'],
  [561053, 564773, '我会不断地每个月去组织不同的人、不同的资源进来'],
  [564773, 568013, '这样的话，我们团队会越来越大，团体会越强大'],
  [568013, 570333, '因为我自身认为一件事情就是'],
  [570333, 573793, '当你跟就在同一个行业里面'],
  [573793, 576193, '然后一块去做的时候，大家都好的时候'],
  [576193, 578233, '你自然不会差，自然不会差'],
  [578233, 581453, '不是说你自己一个超级个体要做得多强、多牛逼'],
  [581893, 586533, '我觉得超级个体一定是要做到资源共享、资源整合'],
  [586533, 589173, '有一个项目，大家有能力一块扑上去干'],
  [589593, 591533, '然后做完之后大家散，对吧'],
  [591533, 593433, '我觉得这是最牛逼的超级个体'],
  [593433, 597513, '这也就是希望我们未来能够持续走下去'],
  [597513, 599393, '持续组织的这样的一个动力'],
  [600013, 603573, '这个也是我们的第一次，也是我的第一次'],
  [603573, 606633, '所以说，我觉得这个起点非常好'],
  [606633, 610733, '我会坚持继续做下去，感谢大家的到来'],
]);

// 先消除连续字幕间由ASR重复造成的“写文案到写文案”。
for (let index = 0; index < captions.length - 1; index += 1) {
  const current = captions[index];
  const next = captions[index + 1];
  if (current.text.endsWith('写文案到') && next.text.startsWith('写文案、')) {
    current.text = current.text.slice(0, -5);
    next.text = `写文案、${next.text.slice('写文案、'.length)}`;
  }
}

// 修复两页之间被切开的常用词，保持语义词组完整。
const boundaryTerms = [
  '这个就是', 'AI这个时代', '现实当中', '现实世界', '不一致', '遇到',
  '挖出来', '资源', '利用', '一朵花', '自媒体', '二十年', '2023年10月',
  '新疆', '口播视频', '四十分钟', '游刃有余', '一千多万', '一百多万',
  '八十多万', '公域的流量', '私域里面', '三万七千多人', '全国前两千',
  '中小微企业', '知识付费', '高价值', '沉淀在飞书', '多维表格',
  '超级个体', '高价值的知识库', '西北师范大学', 'GPT的Image Tool',
  '效果图', '矢量图', '核心竞争力', '组织不到', '同一个行业', '持续走下去',
];
for (let index = 0; index < captions.length - 1; index += 1) {
  const left = captions[index];
  const right = captions[index + 1];
  if (left.speaker !== right.speaker || right.startMs - left.endMs > 950) continue;
  const joined = `${left.text}${right.text}`;
  for (const term of boundaryTerms) {
    const at = joined.indexOf(term);
    if (at < 0 || at >= left.text.length || at + term.length <= left.text.length) continue;
    const leftPartLength = left.text.length - at;
    const rightPartLength = term.length - leftPartLength;
    const moveLeftToRight = {
      left: left.text.slice(0, -leftPartLength),
      right: `${term}${right.text.slice(rightPartLength)}`,
    };
    const moveRightToLeft = {
      left: `${left.text}${right.text.slice(0, rightPartLength)}`,
      right: right.text.slice(rightPartLength),
    };
    const leftScore = Math.max(
      visibleLength(moveLeftToRight.left),
      visibleLength(moveLeftToRight.right),
    );
    const rightScore = Math.max(
      visibleLength(moveRightToLeft.left),
      visibleLength(moveRightToLeft.right),
    );
    const choice = leftScore <= rightScore ? moveLeftToRight : moveRightToLeft;
    if (choice.left && choice.right) {
      left.text = choice.left;
      right.text = choice.right;
    }
    break;
  }
}

// 合并孤立的单字或两字页，避免字幕出现“时 / 代”“频”等断裂。
for (let index = 0; index < captions.length; index += 1) {
  const caption = captions[index];
  if (visibleLength(caption.text) > 3) continue;
  const previous = captions[index - 1];
  const next = captions[index + 1];
  if (
    previous &&
    previous.speaker === caption.speaker &&
    visibleLength(`${previous.text}${caption.text}`) <= 22 &&
    caption.startMs - previous.endMs < 900
  ) {
    previous.text = normalizeText(`${previous.text}${caption.text}`);
    previous.endMs = caption.endMs;
    captions.splice(index, 1);
    index -= 1;
    continue;
  }
  if (
    next &&
    next.speaker === caption.speaker &&
    visibleLength(`${caption.text}${next.text}`) <= 22 &&
    next.startMs - caption.endMs < 900
  ) {
    next.text = normalizeText(`${caption.text}${next.text}`);
    next.startMs = caption.startMs;
    captions.splice(index, 1);
    index -= 1;
  }
}

for (let index = 0; index < captions.length - 1; index += 1) {
  if (captions[index].endMs > captions[index + 1].startMs) {
    captions[index].endMs = Math.max(
      captions[index].startMs + 380,
      captions[index + 1].startMs - 20,
    );
  }
}

const highlightTerms = [
  '兰州',
  '每个月',
  '现实世界',
  '老徐聊医保',
  '二十年',
  '四十分钟',
  '一千多万',
  '一百多万',
  '八十多万',
  '公域',
  '私域',
  '成交',
  '三万七千',
  '前两千',
  '中小微企业',
  '知识付费',
  '企业的数据',
  '知识库',
  '多维表格',
  '葛永鹏',
  '韩志鑫',
  '人的判断',
  '资源共享',
  '资源整合',
];
for (const caption of captions) {
  caption.highlights = highlightTerms.filter((term) => caption.text.includes(term));
}

const canonicalTranscript = {
  schemaVersion: 2,
  source: 'recorded-audio',
  sourceVideo:
    'edit/20260920_lanzhou_ai_salon/01_原始素材/copy_63E2AF15-FCCC-4042-A5F1-7616B6D8BA30.MOV',
  sourceSha256:
    '0bfdd6e411bbb6c97aeece55b55d0e68b63528367706cdf58c0f45f5c46617fd',
  timing: {fps: 30, frameCount: 18413, durationSeconds: 18413 / 30},
  words: captions.map((caption, index) => ({
    id: `spoken-${String(index + 1).padStart(3, '0')}`,
    startMs: caption.startMs,
    endMs: caption.endMs,
    text: caption.text,
    verbatim_text: caption.text,
    speaker: caption.speaker,
    sourceLabel: caption.sourceLabel,
  })),
};
const unresolved = [
  '00:00–00:08.333 现场声不清晰，按多模型结论不强配字幕。',
  '00:50–01:00 主持人“通过AI不断地自我……和交流”中间词声学不稳定。',
  '01:40.56–01:45.52 花朵比喻中的“种植”由上下文和交叉模型确认。',
  '02:12.73–02:22.30 老徐日期后的口语结构不清楚，候选不恢复为具体日期。',
  '03:29.52–03:34.80 保留large更倾向的“一般的播放量”。',
  '06:26.50–06:31.50 飞书嘉宾合作伙伴及公司全称不写入字幕或介绍卡。',
  '07:47.48–07:48.28 葛永鹏姓名以用户明确更正和低响度音节交叉绑定。',
  '08:05–08:14 葛永鹏一句末词声学不稳定，字幕只保留可确认语义。',
  '08:14–08:24 “轻车熟路”由上下文和多模型复核。',
  '09:01–09:05 韩志鑫设计段按“效果图、矢量图”交叉结果处理。',
];
const review = {
  schemaVersion: 2,
  status: 'cross-model-reviewed-candidate-pending-full-user-playback',
  subtitleAuthority: 'recorded-audio',
  asrModels: ['mlx-whisper-small', 'mlx-whisper-large-v3-turbo', 'whisper.cpp targeted rechecks'],
  output: 'remotion/public-salon-20260920/data/captions.final-source.zh.v2.json',
  cueCount: captions.length,
  corrections: correctionSpecs.map(([from, to, evidence]) => ({from, to, evidence})),
  unresolved,
  userProvidedCardFactsExcludedFromSpokenCaptions: [
    '黄鹏飞｜企业 AI 服务实践者｜需求连接 / 销售与交付',
    '葛永鹏｜西部奥体体育',
    '韩志鑫｜大四学生',
  ],
  candidateRenderAllowed: true,
  verifiedReleaseAllowed: false,
  createdAt: new Date().toISOString(),
};
const spokenSourcePolicy = {
  schemaVersion: 1,
  canonicalSource: 'recorded-audio',
  scriptRole: 'comparison-only',
  captionTextPolicy: 'spoken-verbatim',
  englishTranslationSource: 'canonical-spoken-chinese',
  compliance: {
    status: 'passed',
    scope: 'candidate-render-only',
    fullUserPlaybackStillRequired: true,
  },
  verification: {
    sourceSha256:
      '0bfdd6e411bbb6c97aeece55b55d0e68b63528367706cdf58c0f45f5c46617fd',
    corrections: correctionSpecs.map(([from, to, evidence]) => ({
      from,
      to,
      type: from.match(/[A-Za-z]/u) || to.match(/[A-Za-z]/u)
        ? 'proper-noun-spelling'
        : 'unmistakable-asr-error',
      evidence,
    })),
    minimumGlobalPrecision: 0.97,
    minimumGlobalCoverage: 0.95,
    reviewReport:
      'edit/20260920_lanzhou_ai_salon/05_实录与字幕/caption-review.final-source.v2.json',
  },
};

for (const path of [outputPath, transcriptPath, reviewPath, policyPath]) {
  mkdirSync(dirname(path), {recursive: true});
}
writeFileSync(outputPath, `${JSON.stringify(captions, null, 2)}\n`);
writeFileSync(transcriptPath, `${JSON.stringify(canonicalTranscript, null, 2)}\n`);
writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
writeFileSync(policyPath, `${JSON.stringify(spokenSourcePolicy, null, 2)}\n`);
process.stdout.write(`已生成 ${captions.length} 条新最终源中文字幕候选。\n`);
