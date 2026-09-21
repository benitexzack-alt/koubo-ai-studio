import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../../..');
const edlPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/06_剪辑工程/edl.salon-highlight.v1.json',
);
const asrRoot = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/05_实录与字幕/asr-refined',
);
const outputPath = resolve(
  projectRoot,
  'remotion/public-salon-20260920/data/captions.machine-candidate.v1.json',
);
const reviewPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/05_实录与字幕/caption-review.machine-candidate.v1.json',
);

const edl = JSON.parse(readFileSync(edlPath, 'utf8'));
const sources = {
  host: {
    open: {base: 0, file: 'host_open_refined.json'},
    close: {base: 3160, file: 'host_close_refined.json'},
  },
  laoxu: {base: 198, file: 'laoxu_refined.json'},
  'wei-yuanjia': {base: 450, file: 'wei_refined.json'},
  huang: {base: 1070, file: 'huang_refined.json'},
  li: {base: 1900, file: 'li_refined.json'},
  'hong-yan': {base: 2475, file: 'hong_refined.json'},
};

const replacements = [
  [/AIA/gu, 'AI'],
  [/享用AI/gu, '想用AI'],
  [/注射在花园里/gu, '种植在花园里'],
  [/肺检/gu, '飞检'],
  [/医保肺检/gu, '医保飞检'],
  [/投入/gu, '头部'],
  [/也算是投入/gu, '也算是头部'],
  [/发布到剪辑到发布/gu, '写文案到剪辑到发布'],
  [/一天睡觉两天/gu, '一天甚至两天'],
  [/游人游余/gu, '游刃有余'],
  [/公寓的流量/gu, '公域的流量'],
  [/挂课游资/gu, '挂课、引流'],
  [/比较痛苦/gu, '比较困惑'],
  [/沙楼/gu, '沙龙'],
  [/我帮你参加了/gu, '我报名参加了'],
  [/前两千的名字/gu, '前两千的名次'],
  [/指不于出赛/gu, '止步于初赛'],
  [/中间的调量/gu, '中间的桥梁'],
  [/没有采好/gu, '没有踩好'],
  [/采雷/gu, '踩雷'],
  [/header工具/giu, 'AI工具'],
  [/高价的一些信息/gu, '高价值的一些信息'],
  [/呈建在这个分数上/gu, '沉淀在飞书上'],
  [/之前分数的一些用户/gu, '之前飞书的一些用户'],
  [/Iron的办公室/giu, 'AI办公'],
  [/多个表格/gu, '多维表格'],
  [/呈建的分数/gu, '沉淀在飞书'],
  [/高价值的指数库/gu, '高价值的知识库'],
  [/自己熟悉的行为/gu, '自己熟悉的行业'],
  [/专家对你做支持的行为/gu, '专家对你做支持的行业'],
  [/在这个村里我们做深刻/gu, '在这个垂直领域里做深耕'],
  [/超级的问题/gu, '超级个体'],
  [/不同的我们进来/gu, '不同的资源进来'],
  [/自然不会长/gu, '自然不会差'],
  [/铺上去干/gu, '扑上去干'],
  [/感谢大家的道路/gu, '感谢大家的到来'],
  [/红颜/gu, '洪岩'],
  [/從/gu, '从'],
  [/媒體/gu, '媒体'],
  [/課/gu, '课'],
  [/20年/gu, '二十年'],
  [/40分钟/gu, '四十分钟'],
  [/1000多万/gu, '一千多万'],
  [/100多万/gu, '一百多万'],
  [/80多万/gu, '八十多万'],
  [/37000多人/gu, '三万七千多人'],
];

const highRiskCorrections = [
  '医保飞检、头部定位与课程金额来自语音模型交叉听辨，仍须人工听审。',
  '老徐普通视频常态播放量一句听辨不稳定，当前候选保留原声并标记复核。',
  '洪岩的组织全称未进入候选；介绍卡只使用用户提供思维导图中的姓名与保守身份。',
  '所有字幕以实录为正文；会议导图只用于姓名和主题导航。',
];

const punctuation = /[，。？！；：,.!?;:]$/u;
const protectedTerms = [
  '医保飞检',
  '基金监管',
  '老徐聊医保',
  '公域的流量',
  '转化到私域',
  '三万七千多人',
  '中小微企业',
  '知识付费',
  '法律界限',
  '企业的数据',
  '高价值的知识库',
  '超级个体',
  '资源共享',
  '资源整合',
];
const visibleLength = (value) => [...value.replace(/[，。？！；：,.!?;:\s]/gu, '')].length;
const normalizeText = (value) => {
  let text = value
    .replace(/\s+/gu, '')
    .replace(/,/gu, '，')
    .replace(/!/gu, '！')
    .replace(/\?/gu, '？');
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  return text;
};
const cutsProtectedTerm = (left, right) => {
  const joined = normalizeText(`${left}${right}`);
  const boundary = normalizeText(left).length;
  return protectedTerms.some((term) => {
    const at = joined.indexOf(term);
    return at >= 0 && at < boundary && at + term.length > boundary;
  });
};

const transcriptCache = new Map();
const loadTranscript = (speaker, cutId) => {
  const source =
    speaker === 'host'
      ? cutId.startsWith('host-open')
        ? sources.host.open
        : sources.host.close
      : sources[speaker];
  if (!source) throw new Error(`没有转写源：${speaker}`);
  if (!transcriptCache.has(source.file)) {
    const raw = JSON.parse(readFileSync(resolve(asrRoot, source.file), 'utf8'));
    transcriptCache.set(source.file, {raw, base: source.base});
  }
  return transcriptCache.get(source.file);
};

const allCaptions = [];
for (const cut of edl.cuts) {
  const {raw, base} = loadTranscript(cut.speaker, cut.id);
  const words = raw.segments
    .flatMap((segment) => segment.words ?? [])
    .map((word) => ({
      text: String(word.word ?? ''),
      sourceStart: base + Number(word.start),
      sourceEnd: base + Number(word.end),
      confidence: Number(word.probability ?? 0),
    }))
    .filter(
      (word) =>
        word.sourceEnd > cut.sourceStart + 0.005 &&
        word.sourceStart < cut.sourceEnd - 0.005,
    )
    .map((word) => ({
      ...word,
      timelineStart: Math.max(
        cut.timelineStart,
        cut.timelineStart + word.sourceStart - cut.sourceStart,
      ),
      timelineEnd: Math.min(
        cut.timelineEnd,
        cut.timelineStart + word.sourceEnd - cut.sourceStart,
      ),
    }));

  let group = [];
  const flush = () => {
    if (!group.length) return;
    const rawText = group.map((word) => word.text).join('');
    const text = normalizeText(rawText);
    if (text) {
      const startMs = Math.round(group[0].timelineStart * 1000);
      const endMs = Math.max(
        startMs + 380,
        Math.round(group.at(-1).timelineEnd * 1000),
      );
      const confidence =
        group.reduce((sum, word) => sum + word.confidence, 0) / group.length;
      allCaptions.push({
        startMs,
        endMs,
        text,
        speaker: cut.speaker,
        cutId: cut.id,
        confidence: Number(confidence.toFixed(4)),
      });
    }
    group = [];
  };

  for (const word of words) {
    const candidate = normalizeText([...group, word].map((item) => item.text).join(''));
    const gap = group.length ? word.timelineStart - group.at(-1).timelineEnd : 0;
    const duration = group.length ? word.timelineEnd - group[0].timelineStart : 0;
    if (
      group.length &&
      (gap > 0.72 || visibleLength(candidate) > 18 || duration > 3.7) &&
      !cutsProtectedTerm(
        group.map((item) => item.text).join(''),
        word.text,
      )
    ) {
      flush();
    }
    group.push(word);
    const current = normalizeText(group.map((item) => item.text).join(''));
    if (punctuation.test(current) && visibleLength(current) >= 7) {
      flush();
    }
  }
  flush();
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
  '法律界限',
  '企业的数据',
  '知识库',
  '超级个体',
  '资源共享',
  '资源整合',
];
for (const caption of allCaptions) {
  caption.highlights = highlightTerms.filter((term) => caption.text.includes(term));
}

mkdirSync(dirname(outputPath), {recursive: true});
mkdirSync(dirname(reviewPath), {recursive: true});
writeFileSync(outputPath, `${JSON.stringify(allCaptions, null, 2)}\n`);
writeFileSync(
  reviewPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      status: 'machine-candidate-pending-human-listen-review',
      subtitleAuthority: 'recorded-audio',
      output: 'remotion/public-salon-20260920/data/captions.machine-candidate.v1.json',
      cueCount: allCaptions.length,
      replacements: replacements.map(([pattern, replacement]) => ({
        pattern: pattern.source,
        replacement,
      })),
      unresolved: highRiskCorrections,
      formalUseAllowed: false,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

process.stdout.write(
  `已生成 ${allCaptions.length} 条机器候选字幕；正式使用前仍须听审。\n`,
);
