import {createHash} from 'node:crypto';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../../..');
const edlPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/06_剪辑工程/edl.salon-highlight.v1.json',
);
const captionsPath = resolve(
  projectRoot,
  'remotion/public-salon-20260920/data/captions.machine-candidate.v1.json',
);
const outputDirectory = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/03_导演拆解/director-v2-r1',
);
const transcriptPath = resolve(outputDirectory, 'actual-spoken-edit.v1.txt');
const cuesPath = resolve(outputDirectory, 'director-cues.v2.json');
const reviewPath = resolve(outputDirectory, '导演表_待确认.v1.md');

const edl = JSON.parse(readFileSync(edlPath, 'utf8'));
const captions = JSON.parse(readFileSync(captionsPath, 'utf8'));

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const projectRelative = (absolutePath) => absolutePath.slice(projectRoot.length + 1);
const beatId = (index) => `B${String(index + 1).padStart(2, '0')}`;
const factId = (index) => `F${String(index + 1).padStart(2, '0')}`;

const groups = edl.cuts.map((cut, index) => {
  const startMs = Math.round(cut.timelineStart * 1000);
  const endMs = Math.round(cut.timelineEnd * 1000);
  const items = captions.filter((cue) => {
    const midpoint = (cue.startMs + cue.endMs) / 2;
    return midpoint >= startMs && midpoint < endMs;
  });
  if (items.length === 0) {
    throw new Error(`剪辑段没有字幕：${cut.id}`);
  }
  return {
    cut,
    id: beatId(index),
    factCheckId: factId(index),
    scriptQuote: items.map((cue) => cue.text).join(''),
  };
});

const transcriptText = `${groups.map((group) => group.scriptQuote).join('\n')}\n`;
mkdirSync(outputDirectory, {recursive: true});
writeFileSync(transcriptPath, transcriptText, 'utf8');

const shotcraftBeatIndexes = [0, 1, 2, 3, 5, 7, 8, 11, 13, 15, 18, 20];
const shotcraftOpportunities = shotcraftBeatIndexes.map((index, order) => ({
  id: `SO${String(order + 1).padStart(2, '0')}`,
  beatId: beatId(index),
  baseVisualRoute: 'speaker',
  intent: order % 3 === 0 ? 'keyword-emphasis' : order % 3 === 1 ? 'list-reveal' : 'transition-carry',
  reason: '结合实际人物位置、字幕安全区和本段主题，在剪辑阶段选择克制的语义信息层或转场承接；不预选特效卡号。',
  status: 'opportunity-only-post-shoot-selection-pending',
  catalogScope: 'full-current-catalog',
}));

const cues = {
  schemaVersion: 'koubo-director-cues/v2',
  taskId: 'task-20260921T151516Z-3596a9d6',
  status: 'ready-for-user-review',
  executionScope: 'director-only',
  handoffGate: {
    status: 'blocked-awaiting-user-approval',
    downstreamAllowed: false,
  },
  inputScript: {
    path: projectRelative(transcriptPath),
    sha256: sha256(transcriptText),
    authority: 'actual-spoken-transcript',
  },
  routingPolicy: {
    selectionBasis: 'semantic-need-not-fixed-cadence',
    speakerIsFallback: true,
    generatedInsertMinimum: 0,
    paperInsertMinimum: 0,
    fixedCadenceForbidden: true,
    generatedVisualCannotServeAsEvidence: true,
    factVerificationSeparatedFromPrimaryVisual: true,
    constructedVisualPriority: ['paper-editorial', 'ai-generated-video'],
    aiGeneratedVideoUseCondition: 'concrete-human-or-environment-scene-paper-unnatural',
    shotcraftSelectionStage: 'post-shoot-edit-release',
    shotcraftEligibleRoutes: ['speaker', 'real-evidence'],
    shotcraftForbiddenInsideRoutes: ['paper-editorial', 'ai-generated-video'],
  },
  styleLocks: {
    aiGeneratedVideo: null,
    paperEditorial: null,
  },
  selectionSummary: {
    mainPoint: '用一场兰州本地线下沙龙，把办沙龙的原因、老徐的账号实践和五位参与者的真实经验，收束成一条可理解、可继续行动的现场精华片。',
    argumentFlow: [
      '主持人说明为什么要把真实问题带到线下，并承诺每月持续举办',
      '老徐用账号数据说明内容效率、流量和成交之间的真实卡点',
      '四位参与者分别给出学生创新、企业服务、超级个体和企业数据实践',
      '主持人回到资源连接、共同交付和每月继续见',
    ],
    routeCounts: {
      speaker: groups.length,
      'real-evidence': 0,
      'ai-generated-video': 0,
      'paper-editorial': 0,
      shotcraftOpportunity: shotcraftOpportunities.length,
    },
    routeRationales: {
      speaker: '全部主要观点来自现场发言，人物、语气和停顿构成可信度；介绍卡、用户图片和Remotion语义层只作二级说明，不替代现场真人与实录。',
      'real-evidence': '会议记录和思维导图仅作流程导航，用户提供的说明图不承担事实证明；本片没有必须切走真人才能成立的外部证据画面。',
      'ai-generated-video': '用户已经提供足够的主题说明图，本期不新增AI情景视频，避免扩大制作范围和稀释现场感。',
      'paper-editorial': '本期以现场纪实和Remotion信息层为主，不新增纸艺视频；抽象关系用克制的二维语义动效解释。',
    },
    visualRhythmReason: '按主持人开场、老徐核心案例、四位嘉宾重点与主持人收束组织节奏。六张用户图片只在原话直接对应时短暂进入；人物卡只在首次出场出现；数字和流程动效不覆盖人脸与字幕。',
    protectedSpeakerBeatIds: groups.filter((group) => group.cut.protected).map((group) => group.id),
  },
  semanticBeats: groups.map((group, index) => ({
    id: group.id,
    order: index + 1,
    scriptQuote: group.scriptQuote,
    rhetoricalRole: group.cut.purpose,
    claimClass: 'factual-claim',
    requiresFactCheck: true,
    factCheckId: group.factCheckId,
    primaryRoute: 'speaker',
    routeCueId: null,
    decisionReason: group.cut.protected
      ? '用户明确要求保留该段关键内容；以现场人物和原声为主体，信息层只辅助理解。'
      : '该段只保留一个能够独立理解的实践重点；以本人现场表达为主体，避免用说明画面制造额外事实。',
    viewerGain: 'presenter-trust',
  })),
  factChecks: groups.map((group) => ({
    id: group.factCheckId,
    beatId: group.id,
    sourceRequirement: '以当前现场录音核对实际说法；涉及账号数据、比赛名次、法律边界、客户或企业结果时不得由会议记录补写，无法从实录确认则删改或保留为发言者现场自述。',
    owner: 'user-private-source',
    onScreenTreatment: 'not-required',
    fallbackIfUnverified: 'remove-or-rewrite-claim',
  })),
  routePlans: {
    realMaterials: {
      status: 'not-required',
      notRequiredReason: '用户提供的会议摘要、思维导图和主题插图只作二级说明或导航，不承担事实证明；当前主要观点保留现场真人。',
      items: [],
    },
    aiGeneratedVideos: {
      status: 'not-required',
      notRequiredReason: '现有现场画面和用户提供图片已经覆盖主题，不新增AI情景视频。',
      items: [],
    },
    paperEditorials: {
      status: 'not-required',
      notRequiredReason: '本期使用Remotion语义信息层解释关系和数据，不新增纸艺视频。',
      items: [],
    },
  },
  shotcraftOpportunities,
  rhythmAudit: {
    basis: 'semantic-runs-not-seconds',
    fixedCadenceForbidden: true,
    longSpeakerRunsReviewed: true,
    runs: [
      {
        fromBeatId: groups[0].id,
        toBeatId: groups.at(-1).id,
        risk: 'high',
        decision: 'shotcraft-opportunity',
        reason: '全片以现场真人为主，若连续保持同一机位会形成明显疲劳；使用已提供图片、首次出场介绍卡、数字关系图和轻量数字运镜分段，但不按固定秒数机械切换。',
        mitigationRefs: shotcraftOpportunities.map((item) => item.id),
      },
    ],
  },
};

writeFileSync(cuesPath, `${JSON.stringify(cues, null, 2)}\n`, 'utf8');

const rows = groups.map((group, index) => {
  const start = group.cut.timelineStart.toFixed(2);
  const end = group.cut.timelineEnd.toFixed(2);
  const protection = group.cut.protected ? '用户重点保留' : '导演精选';
  return `| ${index + 1} | ${start}–${end} | ${group.cut.speaker} | ${group.cut.purpose} | ${protection} |`;
});
const review = `# 兰州 AI 沙龙导演表 v2｜待确认\n\n` +
  `> 状态：\`ready-for-user-review\`。当前只完成导演规划与剪辑结构，Remotion 候选渲染仍被用户确认门禁锁定。\n\n` +
  `## 总体判断\n\n` +
  `- 成片时长：08:28.22。\n` +
  `- 主线：为什么办沙龙 → 老徐账号数据与成交卡点 → 四位参与者的实践重点 → 每月继续办。\n` +
  `- 主画面：21 个语义段全部以现场真人和实录为主体。\n` +
  `- 二级画面：6 张用户提供图片、5 张嘉宾介绍卡、数字与流程动效；不新增 AI 情景视频或纸艺视频。\n` +
  `- 事实边界：图片不作证据；会议记录只作姓名和流程导航；字幕以实录为准。\n\n` +
  `## 全文语义段\n\n` +
  `| # | 成片时间（秒） | 讲者 | 保留内容 | 决策 |\n|---:|---:|---|---|---|\n` +
  `${rows.join('\n')}\n\n` +
  `## 下游范围\n\n` +
  `用户确认本表后，只进入一段 78–123 秒的同画面有音效 / 无音效候选预览；正式 8 分 28 秒渲染继续等待候选预览验收和全片字幕听校。\n`;
writeFileSync(reviewPath, review, 'utf8');

process.stdout.write(
  `${JSON.stringify({
    transcript: projectRelative(transcriptPath),
    transcriptSha256: cues.inputScript.sha256,
    cues: projectRelative(cuesPath),
    review: projectRelative(reviewPath),
    beatCount: groups.length,
    shotcraftOpportunityCount: shotcraftOpportunities.length,
  }, null, 2)}\n`,
);
