import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const videoId = 'AI_LEVELS_20260820_talk01';
const title = '会用AI，不等于AI替你把工作做完了';
const durationSeconds = 468.64;
const sourceVideo = 'source/20260820_ai_levels/R01_六层AI能力地图_口播原片.MOV';
const transcript =
  'edit/20260820_ai_levels/transcripts/AI_LEVELS_20260820_talk01.cleaned.v1.json';
const bilingual =
  'remotion/public/data/AI_LEVELS_20260820_talk01.bilingual.v1.json';
const runtimeRoot = 'remotion/src/ai-levels-v8-production';
const runtimePlanPath = `${runtimeRoot}/AILevelsV80.visual-plan.v1.json`;
const runtimeSfxPath = `${runtimeRoot}/AILevelsV80.sfx.v1.json`;
const visualPlanPath =
  'edit/20260820_ai_levels/visual-plan_AI_LEVELS_20260820_talk01_v8.json';
const sfxCuePath =
  'edit/20260820_ai_levels/sfx-cue-sheet_AI_LEVELS_20260820_talk01_v8.json';
const jobPath = 'workflow/jobs/20260820_ai_levels_v80.production.json';
const mediaRoot = 'remotion/public/media/ai-levels-20260820';

const approvalAtArgument = process.argv.find((value) =>
  value.startsWith('--preview-approved-at='),
);
const approvalEvidenceArgument = process.argv.find((value) =>
  value.startsWith('--approval-evidence='),
);
const approvalAt = approvalAtArgument?.split('=').slice(1).join('=') || null;
const approvalEvidence =
  approvalEvidenceArgument?.split('=').slice(1).join('=') || null;
const previewApproved = Boolean(approvalAt && approvalEvidence);
const previewStart = 0;
const previewEnd = 45;

const commonChecks = {
  avoidFace: true,
  avoidHands: true,
  avoidSubtitle: true,
  needsFrameReview: true,
  continuousReviewIntervalSeconds: 0.5,
};

const base = ({
  id,
  start,
  end,
  spokenLine,
  component,
  title: layerTitle,
  detail,
  items = [],
  family,
  role,
  tone = 'cyan',
  assetClass = 'remotion-information',
  producer = 'codex-remotion',
  sourceType = 'remotion-component',
  source = null,
  requestId = null,
  renderMode = 'speaker-overlay',
  background = 'talk',
  disclosure = undefined,
  badge = undefined,
}) => {
  const toStaticPath = (value) =>
    typeof value === 'string'
      ? value.replace(/^remotion\/public\//, '')
      : value;
  return {
    id,
    start,
    end,
    spokenLine,
    purpose:
      assetClass === 'generated-video'
        ? 'concept-illustration'
        : 'semantic-emphasis',
    kind:
      renderMode === 'media-fullscreen'
        ? 'full-screen-asset'
        : 'transparent-semantic-information',
    titleOwner: true,
    overlapGroup: id,
    zone: renderMode === 'media-fullscreen' ? 'full-screen' : 'right-safe',
    title: layerTitle,
    detail,
    items,
    asset: {sourceType, ...(source ? {source} : {})},
    assetDecision: {
      class: assetClass,
      producer,
      requestId,
      fallback:
        renderMode === 'media-fullscreen'
          ? 'speaker-plus-information'
          : 'speaker-overlay',
    },
    visualEvent: {id: `${id}-event`, enterAt: start, primary: true},
    sound: {
      policy: 'required',
      role,
      cueId: `${id}-sfx`,
      offsetFrames: 0,
      maxSyncErrorFrames: 2,
    },
    params: {
      component,
      title: layerTitle,
      detail,
      items,
      tone,
      ...(source ? {src: toStaticPath(source)} : {}),
      ...(disclosure ? {disclosure} : {}),
      ...(badge ? {badge} : {}),
    },
    checks: {
      ...commonChecks,
      reviewAt: Math.min(
        end - 0.2,
        start + Math.min(2.5, (end - start) * 0.35),
      ),
    },
    background,
    presentation: {
      renderMode,
      semanticFamily: family,
      coverageRatio: renderMode === 'media-fullscreen' ? 1 : 0.396,
      progressiveReveal: true,
    },
  };
};

const layers = [
  base({
    id: 'levels-001-hook', start: 0, end: 7.2,
    spokenLine: '客户回得着急，你让AI帮你写一段回复，它写得挺快。',
    component: 'definition', title: 'AI写得快', detail: '不等于后面的工作已经做完。',
    items: ['回复', '方案', '资料'], family: 'hero-definition', role: 'keyword', tone: 'amber',
  }),
  base({
    id: 'levels-002-answer-media', start: 7.2, end: 14.5,
    spokenLine: '关掉对话框以后，资料、表格、客户回复仍要自己接。',
    component: 'generated-media', title: '答案出来了，工作还在后面', detail: '情景示意：聊天框只完成了第一棒。',
    family: 'generated-media', role: 'media', assetClass: 'generated-video', producer: 'user',
    sourceType: 'user-generated-video', source: `${mediaRoot}/S01-answer-work-remains.mp4`, requestId: 'S01',
    renderMode: 'media-fullscreen', background: 'opaque',
    disclosure: 'AI生成 · 情景示意', badge: '非真实业务录屏',
  }),
  base({
    id: 'levels-003-first-step', start: 14.5, end: 23,
    spokenLine: 'AI只是把最开始那一下做掉了。',
    component: 'statement', title: 'AI做了第一下', detail: '查、填、发、复核与兜底仍由人完成。',
    items: ['生成', '执行', '复核'], family: 'direct-statement', role: 'keyword', tone: 'amber',
  }),
  base({
    id: 'levels-004-question', start: 23, end: 28.8,
    spokenLine: '豆包、DeepSeek、Kimi、千问都会用，算不算会用AI？',
    component: 'question-grid', title: '会用工具 = 会用AI？', detail: '先看AI替你干到哪一步。',
    items: ['答案停在哪', '后面谁来接', '出错谁负责'], family: 'question-list', role: 'list', tone: 'amber',
  }),
  base({
    id: 'levels-005-overview', start: 28.8, end: 38.2,
    spokenLine: '今天把用AI分为六个段位。',
    component: 'ai-overview', title: 'AI工作接力地图', detail: '从答案到系统经营。',
    family: 'level-overview', role: 'chapter',
  }),
  base({
    id: 'levels-006-overview-logic', start: 38.2, end: 51.28,
    spokenLine: '看每次用完AI，后面还有多少工作由你一段一段接着干。',
    component: 'flow', title: '答案 → 任务 → 流程 → 系统', detail: '段位看的是工作推进深度，不是工具多少。',
    items: ['答案', '交付物', '稳定接力', '责任闭环'], family: 'process-rail', role: 'node', tone: 'green',
  }),
  base({
    id: 'levels-007-qa-card', start: 51.28, end: 60,
    spokenLine: '第一层：问答。', component: 'ai-qa', title: '第一层：问答',
    detail: '人提问，AI给参考答案。', family: 'level-qa', role: 'chapter',
  }),
  base({
    id: 'levels-008-qa-tools', start: 60, end: 73.12,
    spokenLine: '豆包、DeepSeek、Kimi、千问，主要先解决问答。',
    component: 'question-grid', title: '问一句，答一句', detail: '改文案、查思路、想标题，先离开空白页。',
    items: ['豆包', 'DeepSeek', 'Kimi', '千问'], family: 'question-list', role: 'list',
  }),
  base({
    id: 'levels-009-qa-boundary', start: 73.12, end: 83.76,
    spokenLine: '边界很清楚：答案停在聊天框里。',
    component: 'statement', title: '边界：答案停在聊天框', detail: '修改、发送、对象和结果责任仍由你接住。',
    items: ['修改', '发送', '兜底'], family: 'direct-statement', role: 'keyword', tone: 'red',
  }),
  base({
    id: 'levels-010-qa-agent', start: 83.76, end: 95.12,
    spokenLine: '别因为会提几个问题，就觉得已经用上Agent。',
    component: 'status', title: '反应快的助手', detail: '还不是能独立交付和负责的Agent。',
    items: ['能给参考', '不能自行验收', '责任仍在人'], family: 'status-stack', role: 'comparison', tone: 'amber',
  }),
  base({
    id: 'levels-011-task-card', start: 95.12, end: 108,
    spokenLine: '第二层就是任务：有资料、有要求、有交付物。',
    component: 'ai-task', title: '第二层：任务', detail: '从参考答案走向可验收交付物。',
    family: 'level-task', role: 'chapter',
  }),
  base({
    id: 'levels-012-task-examples', start: 108, end: 125.84,
    spokenLine: '咨询变跟进表，会议记录变简报，资料变固定格式文档。',
    component: 'question-grid', title: '任务必须有交付物', detail: '先把一件具体办公任务往前推。',
    items: ['客户跟进表', '老板简报', '固定格式文档'], family: 'question-list', role: 'list',
  }),
  base({
    id: 'levels-013-task-tools', start: 125.84, end: 148.48,
    spokenLine: 'Kimi文档、飞书表格、千问办公、WorkBuddy都能从这一层进。',
    component: 'status', title: '资料 + 目标 + 交付', detail: '重点不是提示词多花，而是把活说清楚。',
    items: ['给什么资料', '做成什么样', '哪里不能错'], family: 'status-stack', role: 'keyword', tone: 'green',
  }),
  base({
    id: 'levels-014-task-acceptance', start: 148.48, end: 162.16,
    spokenLine: '给它什么资料、做成什么样、哪几步不能错。',
    component: 'flow', title: '任务交付三件事', detail: '资料、标准与不可错项。',
    items: ['输入资料', '目标格式', '错误红线'], family: 'process-rail', role: 'node', tone: 'green',
  }),
  base({
    id: 'levels-015-task-responsibility', start: 162.16, end: 183.28,
    spokenLine: '名字、数字、结论还是得你看，最后交付责任仍在你手上。',
    component: 'statement', title: '能下载文件 ≠ 任务完成', detail: 'AI搭毛坯，人做最终验收。',
    items: ['名字', '数字', '结论'], family: 'direct-statement', role: 'comparison', tone: 'red',
  }),
  base({
    id: 'levels-016-flow-card', start: 183.28, end: 196.08,
    spokenLine: '第三层才是流程，因为有些事情每天都在重复。',
    component: 'ai-flow', title: '第三层：流程', detail: '把重复动作串成稳定接力。',
    family: 'level-flow', role: 'chapter',
  }),
  base({
    id: 'levels-017-flow-media', start: 196.08, end: 203.52,
    spokenLine: '手动复制、粘贴、转发，人很快就烦，也容易漏。',
    component: 'generated-media', title: '重复搬运 → 可控流程', detail: '情景示意：把高频搬运改成可暂停的接力。',
    family: 'generated-media', role: 'media', assetClass: 'generated-video', producer: 'user',
    sourceType: 'user-generated-video', source: `${mediaRoot}/S02-manual-to-flow.mp4`, requestId: 'S02',
    renderMode: 'media-fullscreen', background: 'opaque', disclosure: 'AI生成 · 情景示意', badge: '非真实业务录屏',
  }),
  base({
    id: 'levels-018-flow-example', start: 203.52, end: 218.16,
    spokenLine: '表单进来后分类、写入表格、提醒负责人，需要人看就停下。',
    component: 'flow', title: '表单进入 → 分类 → 表格 → 提醒', detail: '需要人工确认的节点必须能停。',
    items: ['表单进入', '内容分类', '写入表格', '人工确认'], family: 'process-rail', role: 'node', tone: 'green',
  }),
  base({
    id: 'levels-019-flow-boundary', start: 218.16, end: 240.72,
    spokenLine: '客户回复、订单、钱、敏感资料自动外发前，要想好权限、确认和停机。',
    component: 'question-grid', title: '流程越往外连，越不能图省事', detail: '谁有权限、谁确认、跑错了谁来停。',
    items: ['权限', '人工确认', '暂停开关', '责任记录'], family: 'question-list', role: 'list', tone: 'red',
  }),
  base({
    id: 'levels-020-assemble-card', start: 240.72, end: 255.92,
    spokenLine: '第四层是组装：读本地文件、改网站、接接口。',
    component: 'ai-assemble', title: '第四层：组装', detail: '把AI接进电脑和真实工作区。',
    family: 'level-assemble', role: 'chapter',
  }),
  base({
    id: 'levels-021-assemble-tools', start: 255.92, end: 277.12,
    spokenLine: 'Codex、Claude Code、Cursor和Agent Harness常见在这一层。',
    component: 'layer-map', title: '工具 + 工作区 + 任务协同', detail: '已经不只是聊天框。',
    items: ['本地文件', '网站', '接口', '运行命令'], family: 'layer-map', role: 'node',
  }),
  base({
    id: 'levels-022-assemble-threshold', start: 277.12, end: 291.52,
    spokenLine: '文件、环境、接口、权限和报错，都是新的门槛。',
    component: 'question-grid', title: '新的门槛从这里出现', detail: '每一个都需要真实配置和排错。',
    items: ['文件在哪', '环境怎么配', '接口怎么接', '报错怎么查'], family: 'question-list', role: 'list', tone: 'amber',
  }),
  base({
    id: 'levels-023-assemble-real', start: 291.52, end: 314.48,
    spokenLine: '看着像一句话做出来，真跑起来往往一个报错接一个报错。',
    component: 'statement', title: '不是提示词比赛', detail: '看它改了什么，也看结果是否真的跑通。',
    items: ['检查改动', '运行验证', '定位报错'], family: 'direct-statement', role: 'comparison', tone: 'red',
  }),
  base({
    id: 'levels-024-open-card', start: 314.48, end: 328.24,
    spokenLine: '第五层：开源改造。', component: 'ai-open-source', title: '第五层：开源改造',
    detail: '下载只是开始，维护才是后半程。', family: 'level-open-source', role: 'chapter',
  }),
  base({
    id: 'levels-025-open-process', start: 328.24, end: 348.4,
    spokenLine: '拉下代码，配合Git、Docker去安装、部署和修改。',
    component: 'flow', title: '拉取 → 安装 → 部署 → 修改', detail: '项目跑起来以后，维护工作才真正开始。',
    items: ['拉取代码', '安装依赖', '部署运行', '修改适配'], family: 'process-rail', role: 'node',
  }),
  base({
    id: 'levels-026-open-maintenance', start: 348.4, end: 359.28,
    spokenLine: '真正看的是能不能接住后续维护，而不是会不会点星。',
    component: 'status', title: '下载成功 ≠ 拥有产品', detail: '更新、漏洞、数据和故障恢复不会自己消失。',
    items: ['持续更新', '漏洞修补', '备份恢复'], family: 'status-stack', role: 'keyword', tone: 'amber',
  }),
  base({
    id: 'levels-027-system-card', start: 359.28, end: 375.92,
    spokenLine: '第六层叫系统经营，没有什么第六层神器。',
    component: 'ai-system', title: '第六层：系统经营', detail: '一套东西一起工作，也要有人负责。',
    family: 'level-system', role: 'chapter',
  }),
  base({
    id: 'levels-028-system-stack', start: 375.92, end: 391.52,
    spokenLine: '模型、流程、知识库、版本部署、权限、日志、备份和人工审核一起工作。',
    component: 'layer-map', title: '企业AI是一套责任系统', detail: '工具只是组成部分，治理决定能不能长期跑。',
    items: ['模型 / API', '流程与知识库', '版本与部署', '权限与审核'], family: 'layer-map', role: 'node',
  }),
  base({
    id: 'levels-029-system-questions', start: 391.52, end: 398.32,
    spokenLine: '资料谁维护？哪些人能看？AI说错了谁接住？',
    component: 'question-grid', title: '系统经营先问责任', detail: '模型选择反而不是最难的。',
    items: ['谁维护', '谁能看', '谁接错', '谁恢复'], family: 'question-list', role: 'list', tone: 'red',
  }),
  base({
    id: 'levels-030-system-media', start: 398.32, end: 405.62,
    spokenLine: '哪一步出了问题，能不能找到记录，把它恢复回来？',
    component: 'generated-media', title: '告警出现，人工接管', detail: '情景示意：系统必须留有追踪、暂停和恢复能力。',
    family: 'generated-media', role: 'media', assetClass: 'generated-video', producer: 'user',
    sourceType: 'user-generated-video', source: `${mediaRoot}/S03-alert-human-takeover.mp4`, requestId: 'S03',
    renderMode: 'media-fullscreen', background: 'opaque', disclosure: 'AI生成 · 情景示意', badge: '非真实业务录屏',
  }),
  base({
    id: 'levels-031-system-boundary', start: 405.62, end: 421.84,
    spokenLine: '工具堆在一起，不等于系统能在真实业务里跑下去。',
    component: 'status', title: '接了知识库 ≠ 完成AI转型', detail: '有人使用、有人维护、有人复核，才叫系统。',
    items: ['真实使用', '持续维护', '错误兜底'], family: 'status-stack', role: 'comparison', tone: 'red',
  }),
  base({
    id: 'levels-032-closing-card', start: 421.84, end: 435.6,
    spokenLine: '看到这，来说说你现在在哪一层。',
    component: 'ai-closing', title: '你现在在哪一层？', detail: '从最费时、最容易错的那一步反查。',
    family: 'level-closing', role: 'chapter',
  }),
  base({
    id: 'levels-033-next-step', start: 435.6, end: 452.72,
    spokenLine: '整理资料先学第二层，重复搬运看第三层，接文件接口再碰第四层以后。',
    component: 'question-grid', title: '按卡点选择下一层', detail: '不需要一上来把六层全部学完。',
    items: ['资料整理 → 任务', '重复搬运 → 流程', '文件接口 → 组装'], family: 'question-list', role: 'list', tone: 'green',
  }),
  base({
    id: 'levels-034-cta', start: 452.72, end: 468.64,
    spokenLine: '先看AI替你干到哪儿，再决定你准备在哪儿接住。',
    component: 'closing', title: '先看AI已经替你干到哪儿', detail: '我是超哥，在兰州AI创业。',
    items: ['留下你的困惑', '按真实任务往前走'], family: 'closing', role: 'cta', tone: 'green',
  }),
];

const sfxSources = [
  'v1-keyword-tick.wav', 'v3-media-whoosh-a.wav', 'v2-keyword-select.wav',
  'v3-list-tick-a.wav', 'v3-chapter-sweep-a.wav', 'v3-line-connect-a.wav',
  'v2-section-sweep.wav', 'v1-card-reveal.wav', 'v1-confirm-soft.wav',
  'v2-number-affirmation.wav', 'v1-section-air.wav', 'v2-card-slide.wav',
  'v3-soft-card-pop-a.wav', 'v1-node-connect.wav', 'v2-evidence-shutter.wav',
  'waic-section-whoosh.wav', 'v3-media-whoosh-b.wav', 'waic-node-connect.wav',
  'v3-list-tick-b.wav', 'remotion-page-turn.wav', 'v2-node-select.wav',
  'v2-ui-click.wav', 'waic-thesis-impact.wav', 'remotion-whoosh.wav',
  'v3-line-connect-a.wav', 'v3-soft-card-pop-b.wav', 'v2-section-sweep.wav',
  'v1-node-connect.wav', 'v1-ui-click.wav', 'waic-card-pop.wav',
  'v2-number-affirmation.wav', 'v3-chapter-sweep-a.wav', 'remotion-ui-switch.wav',
  'v3-cta-confirm-a.wav',
];

const cues = layers.map((layer, index) => ({
  id: layer.sound.cueId,
  visualEventId: layer.visualEvent.id,
  role: layer.sound.role,
  start: layer.start,
  end: layer.start + 0.4,
  source: `remotion/public/audio/koubo-sfx-v8/${sfxSources[index]}`,
  license: 'V8本地音效审核清单已登记',
  licenseReference: 'assets/sfx/koubo-sfx-v8/manifest.json',
  volume: [0.28, 0.3, 0.26, 0.29][index % 4],
  voiceDuckDb: 0,
  previewCovered: layer.start >= previewStart && layer.start <= previewEnd,
  formalReviewed: false,
  userAudibilityConfirmed:
    previewApproved && layer.start >= previewStart && layer.start <= previewEnd,
}));

const plan = {
  schemaVersion: 4,
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: previewApproved
      ? 'candidate-preview-approved'
      : 'candidate-preview-required',
  },
  videoId,
  videoTitle: title,
  sourceVideo,
  transcript,
  bilingualCaptions: bilingual,
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: [
    'v8-user-confirmed-default-20260812',
    'v8-speaker-first-continuous-semantics',
    'ai-levels-six-card-system-user-approved',
  ],
  target: {
    aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin',
  },
  previewCoverage: [
    'hook', 'complex-overlay', 'full-screen-asset', 'cta',
    'speaker-overlay', 'media-fullscreen', 'progressive-process',
    'source-evidence', 'hero-emphasis', 'sfx-ab',
  ],
  editPolicy:
    '完整保留真人口播，不删减、不重排；三条用户生成AI视频按语义静音插入并标注情景示意；六张参考图仅用于理解版式，严禁进入任何成片媒体入口。',
  assetCoverage: {
    usableOriginalVideoItems: 1,
    assignedOriginalVideoItems: 1,
    generatedVideoItems: 3,
    assignedGeneratedVideoItems: 3,
    referenceImageItems: 6,
    referenceImageItemsAssignedToVideo: 0,
    allRequiredClaimsCovered: true,
    note: '真人原片为主画面；三条AI视频仅作情景示意；参考图完全排除。',
  },
  layers,
};

const sfx = {
  schemaVersion: 3,
  videoId,
  version: 'ai-levels-v8-preview-1',
  experimentId: 'v8-semantic-continuity-sfx',
  normalizedPack: 'assets/sfx/koubo-sfx-v8/manifest.json',
  cues,
};

const job = {
  schemaVersion: 1,
  jobId: '20260820-ai-levels-v80',
  videoId,
  title,
  purpose:
    '完整保留本人六层AI能力地图口播，用V8连续语义动效、六层工具卡、三条AI情景视频、双语字幕、数字运镜与本地审核音效完成正式包装。',
  productionState: 'ready-for-production',
  productionProfile: {id: 'v8-semantic-continuity-sfx', version: 'V8'},
  contentApproval: {
    userScriptApproved: true,
    userApprovedAt: '2026-08-20T00:00:00+08:00',
    evidence: '用户明确确认最终文稿并提供完整真人口播原片与三条AI生成视频。',
  },
  knowledgeContext: {
    taskId: 'task-20260822T081246Z-096b5d7b',
    contextPath: 'task-20260822T081246Z-096b5d7b/context.json',
  },
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: previewApproved
      ? 'candidate-preview-approved'
      : 'candidate-preview-required',
    userPreviewApproved: previewApproved,
    userPreviewApprovedAt: approvalAt,
    userPreviewApprovalEvidence: approvalEvidence,
    revisionReason:
      '首次为本条建立真实原片V8候选；六张参考图仅供版式理解，已在计划、资产入口和代码路径三处排除。',
    primaryVisualEventCount: layers.length,
    sfxCoveragePercent: 100,
    previewAuditionRoles: ['keyword', 'media', 'list', 'chapter', 'node'],
  },
  baseline: {
    path: 'workflow/production-baseline.v1.json',
    id: 'koubo-formal-16x9-v1',
    revision: 'V7.2-20260730',
  },
  inputs: {
    source: sourceVideo,
    renderProxy: `${mediaRoot}/main-30fps.mp4`,
    visualPlan: visualPlanPath,
    bilingualCaptions: bilingual,
    captions: bilingual,
    sfxCueSheet: sfxCuePath,
    sfxManifest: 'assets/sfx/koubo-sfx-v8/manifest.json',
    userAssetExecutionSheet:
      '/Users/pc/Desktop/口播素材/2026-08-20_AI六层能力地图/03_执行说明/素材执行单-v1.md',
    fingerprintPaths: [
      sourceVideo,
      `${mediaRoot}/main-30fps.mp4`,
      `${mediaRoot}/S01-answer-work-remains.mp4`,
      `${mediaRoot}/S02-manual-to-flow.mp4`,
      `${mediaRoot}/S03-alert-human-takeover.mp4`,
      transcript,
      bilingual,
      visualPlanPath,
      sfxCuePath,
      runtimePlanPath,
      runtimeSfxPath,
      `${runtimeRoot}/AILevelsV80Talk16x9.tsx`,
      `${runtimeRoot}/index.tsx`,
      'remotion/src/ai-levels-v8/AILevelsV8CardPreview16x9.tsx',
      'remotion/src/components/V8SemanticStage.tsx',
      'remotion/src/components/V72ProductionShell.tsx',
      'remotion/public/audio/koubo-sfx-v8',
    ],
  },
  remotion: {
    root: 'remotion',
    entry: 'src/ai-levels-v8-production/index.tsx',
    compositionWithSfx: 'AILevels16x9-V80-WithSfx',
    compositionWithoutSfx: 'AILevels16x9-V80-NoSfx',
    durationSeconds,
    fps: 30,
    width: 1920,
    height: 1080,
    concurrency: 4,
  },
  preview: {
    enabled: true,
    withSfxOnly: false,
    scale: 0.5,
    crf: 22,
    ranges: [
      {id: 'ai-levels-hook-overview-45s', startSeconds: previewStart, endSeconds: previewEnd},
    ],
    output:
      'work/production-runs/20260820-ai-levels-v80/preview45/with-sfx.mp4',
    renderWithoutSfxComparison: true,
  },
  riskFrames: {
    enabled: true,
    source: 'visual-plan-reviewAt',
    fullResolution: true,
    outputDirectory:
      'work/production-runs/20260820-ai-levels-v80/preview45/risk-frames',
  },
  audioPreflight: {
    enabled: true,
    source: 'preview',
    integratedLoudnessTargetLufs: -16,
    truePeakMaxDbtp: -1.5,
    preferredTruePeakDbtp: -1.8,
  },
  formal: {
    enabled: previewApproved,
    composition: 'with-sfx',
    blockedReason: previewApproved
      ? null
      : '等待用户观看同画面45秒V8有音效/无音效预览并确认。',
    crf: 18,
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioBitrate: '192k',
    rawOutput:
      'work/production-runs/20260820-ai-levels-v80/formal/formal-raw.mp4',
    finalOutput:
      'outputs/AI六层能力地图_16x9_V80_有音效_候选成片_v1.mp4',
    loudness: {
      enabled: true,
      integratedLoudnessTargetLufs: -16,
      loudnessRangeTargetLu: 11,
      truePeakTargetDbtp: -2.2,
    },
  },
  cache: {
    enabled: true,
    directory: 'work/production-cache',
    reuseOnlyOnExactFingerprint: true,
  },
  reports: {
    runManifest:
      'work/production-runs/20260820-ai-levels-v80/run-manifest.json',
    timingReport:
      'work/production-runs/20260820-ai-levels-v80/timing-report.json',
    regressionReport:
      'work/production-runs/20260820-ai-levels-v80/regression-report.json',
  },
};

for (const [file, value] of [
  [visualPlanPath, plan],
  [runtimePlanPath, plan],
  [sfxCuePath, sfx],
  [runtimeSfxPath, sfx],
  [jobPath, job],
]) {
  const absolute = path.resolve(root, file);
  fs.mkdirSync(path.dirname(absolute), {recursive: true});
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

console.log(
  JSON.stringify(
    {
      videoId,
      layers: layers.length,
      cues: cues.length,
      previewApproved,
      jobPath,
      visualPlanPath,
      sfxCuePath,
      referenceImagesAssigned: 0,
    },
    null,
    2,
  ),
);
