import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outPlan = path.join(
  root,
  'remotion/src/data/AIIncomeV80.visual-plan.v1.json',
);
const outSfx = path.join(root, 'remotion/src/data/AIIncomeV80.sfx.v1.json');
const outJob = path.join(
  root,
  'workflow/jobs/20260819_ai_income_v80.production.json',
);
const manifestPath = path.join(root, 'assets/sfx/koubo-sfx-v8/manifest.json');
const durationSeconds = 365.6;

const scene = (id, start, end, component, title, detail, items = [], params = {}) => ({
  id: `income-${String(id).padStart(3, '0')}-${component}`,
  start,
  end,
  spokenLine: title,
  purpose: component === 'generated-media' ? 'semantic-broll' : 'semantic-emphasis',
  kind:
    component === 'generated-media'
      ? 'full-screen-asset'
      : component === 'evidence-carousel'
        ? 'privacy-safe-evidence'
        : 'transparent-semantic-information',
  variant: component,
  titleOwner: true,
  overlapGroup: `income-v${String(id).padStart(3, '0')}`,
  zone: component === 'generated-media' ? 'full-frame' : 'left-safe',
  title,
  detail,
  items,
  asset: {
    sourceType:
      component === 'generated-media'
        ? 'user-generated-video'
        : component === 'evidence-carousel'
          ? 'privacy-safe-user-screenshot'
          : 'remotion-component',
    source:
      component === 'generated-media'
        ? `remotion/public/${params.src}`
        : params.src ?? `AIIncomeV80/${component}`,
  },
  assetDecision: {
    class:
      component === 'generated-media'
        ? 'generated-video'
        : component === 'evidence-carousel'
          ? 'real-evidence'
          : 'remotion-information',
    producer:
      component === 'generated-media'
        ? 'user'
        : component === 'evidence-carousel'
          ? 'existing'
          : 'codex-remotion',
    requestId:
      component === 'generated-media'
        ? `AI_INCOME-BROLL-${String(id).padStart(2, '0')}`
        : null,
    fallback: 'speaker-plus-information',
  },
  visualEvent: {
    id: `income8-v${String(id).padStart(3, '0')}`,
    enterAt: start,
    primary: true,
  },
  sound: {
    policy: 'required',
    role:
      component === 'generated-media'
        ? 'media'
        : component === 'evidence-carousel'
          ? 'evidence'
          : component === 'flow' || component === 'layer-map'
            ? 'line'
            : component === 'closing'
              ? 'cta'
              : 'keyword',
    cueId: `income8-sfx-${String(id).padStart(3, '0')}`,
    offsetFrames: 0,
    maxSyncErrorFrames: 2,
  },
  params: {component, title, detail, items, ...params},
  checks: {
    avoidFace: component !== 'generated-media',
    avoidHands: component !== 'generated-media',
    avoidSubtitle: true,
    needsFrameReview: true,
    continuousReviewIntervalSeconds: 0.5,
    reviewAt: Number(((start + end) / 2).toFixed(2)),
  },
  background: component === 'generated-media' ? 'opaque' : 'talk',
  presentation: {
    renderMode:
      component === 'generated-media' ? 'media-fullscreen' : 'speaker-overlay',
    semanticFamily: component,
    coverageRatio: component === 'generated-media' ? 1 : component === 'evidence-carousel' ? 0.43 : 0.34,
    progressiveReveal: true,
  },
});

const layers = [
  scene(1, 0, 6.4, 'definition', '学AI，能不能多挣一点钱？', '先说真实答案，不用热闹替代结果。'),
  scene(2, 6.4, 12.8, 'status', '上班以后，多一份收入？', '这是很多有工作的人最直接的期待。', ['工资就那样', '下班学AI', '想多一份收入']),
  scene(3, 12.8, 20.8, 'comparison', '暂时没上班，要不要换条路？', '同样是学AI，所承担的风险完全不同。', ['先找现实入口', '直接全职转行']),
  scene(4, 20.8, 32, 'comparison', '两个担心，来回摇摆', '一边怕错过，一边怕投入之后没有结果。', ['怕错过AI', '怕花钱花时间', '怕最后没结果']),
  scene(5, 32, 41.2, 'definition', 'AI值得学', '但不同处境，不能走同一条路。'),
  scene(6, 41.2, 57.4, 'flow', '先按处境选路径', '先把风险放在能承受的范围里。', ['有工作 → 放进现有工作验证', '准备谋生 → 算成本', '准备谋生 → 做作品', '准备谋生 → 看真实交付周期']),
  scene(7, 57.4, 68.3, 'statement', '这是凌晨3点熬出来的感受', '不是站在外面劝大家保守。', ['大量花费', '每天晚上', '周末投入']),
  scene(8, 68.3, 75, 'evidence-carousel', '证书、课程、会员，都是真实投入', '只展示能够公开的部分；隐私信息已排除。', ['培训证书', '付费会员'], {
    evidenceClips: [
      {src: 'media/ai-income-20260819/evidence/certificate_aigc_training_safe.jpg', label: 'AIGC培训记录', note: '只展示培训内容与盖章页'},
      {src: 'media/ai-income-20260819/evidence/paid_membership_safe.jpg', label: '付费会员记录', note: '真实会员页面'},
    ],
  }),
  scene(9, 75, 83, 'evidence-carousel', 'API、积分、工具使用，都在消耗', '充值价目表不算消费证据；Codex只作使用强度记录。', ['真实历史消耗', '积分流水', '使用强度'], {
    evidenceClips: [
      {src: 'media/ai-income-20260819/evidence/api_spend_pair_safe.jpg', label: '两笔API历史消耗', note: '$624.85 + $199.75'},
      {src: 'media/ai-income-20260819/evidence/deepseek_api_spend_safe.jpg', label: 'DeepSeek API', note: '消费金额 ¥183.87'},
      {src: 'media/ai-income-20260819/evidence/credits_usage_pair_safe.jpg', label: '积分与使用强度', note: '即梦积分流水；117.8亿 Token 不代表付费金额'},
    ],
  }),
  scene(10, 83, 96.6, 'flow', '项目在做，不等于路已跑通', '本段没有交付证明画面，不用替代素材冒充证据。', ['付费项目在做', '也有交付', '仍在接单', '不等于已经跑通']),
  scene(11, 96.6, 108.4, 'comparison', '投入和回报，还没成正比', '项目状态与稳定结果必须分开说。', ['项目在做', '路径跑顺', '投入回报成比例']),
  scene(12, 108.4, 118.6, 'flow', '所以我不劝你辞职干AI', '我自己也还在一段一段验证。', ['投入', '项目', '交付', '现实验证']),
  scene(13, 118.6, 133, 'definition', 'AI要先落到一件真事上', '快一点、清楚一点，最后还要能用。'),
  scene(14, 133, 138.4, 'statement', '先别急着叫自己AI从业者', '先用真实工作检验能力。', ['有工作', '先验证']),
  scene(15, 138.4, 145.4, 'generated-media', '从重复工作开始', '写材料、整理客户、做报表、做内容。', [], {
    src: 'media/ai-income-20260819/broll/S01_上班后AI处理重复工作_30fps.mp4',
    disclosure: 'AI生成 · 工作情景演绎',
    badge: '场景演绎 · 不作案例证据',
    mediaScale: 1.01,
  }),
  scene(16, 145.4, 153.6, 'question-grid', '先找那件反复在做的事', '不要先追求一套万能工作流。', ['写材料', '整理客户', '做报表', '做内容']),
  scene(17, 153.6, 163.6, 'layer-map', '免费额度也能开始验证', '先用起来，再决定要不要继续花钱。', ['豆包', 'DeepSeek', 'WorkBuddy', '小额会员']),
  scene(18, 163.6, 178.6, 'question-grid', '盯住三个结果', '不是让AI替你糊弄过去。', ['自己能不能看懂？', '交出去会不会出错？', '少绕了一圈吗？', '少返了几次工？']),
  scene(19, 178.6, 190.6, 'flow', '用顺之后，再谈副业', '先把AI变成工作能力的加分项。', ['真实任务', '工具用顺', '减少返工', '能力加分']),
  scene(20, 190.6, 197.6, 'generated-media', '全职进入，先算清楚', '你换的是一个还没被证明的机会。', [], {
    src: 'media/ai-income-20260819/broll/S02_全职转行前算清成本_30fps.mp4',
    disclosure: 'AI生成 · 转行准备情景',
    badge: '场景演绎 · 不作收益证据',
    mediaScale: 1.01,
  }),
  scene(21, 197.6, 205.6, 'question-grid', '会用工具，不等于机会成立', '全职选择要同时计算时间与现金成本。', ['会用一个工具', '承受时间成本', '承受现金成本', '机会仍待验证']),
  scene(22, 205.6, 213.6, 'status', '别只看别人爆火、接单', '短视频里的结果，不能替你承担风险。', ['一张图爆火', '一个短剧爆火', '一个月接多少单']),
  scene(23, 213.6, 226.6, 'question-grid', '全职之前，先问四个问题', '有一项答不上来，就先缩小投入。', ['能承受多久没收入？', '能拿出什么作品？', '手里有真实问题吗？', '有愿意反复验收的需求方吗？']),
  scene(24, 226.6, 235.6, 'status', '否则最后只剩这些', '工具越多，不代表离收入越近。', ['几个账号', '一堆会员', '没用完的积分']),
  scene(25, 235.6, 242.6, 'generated-media', 'AIGC不是点两下就挣钱', '做图、做视频、做漫剧，都要经历多轮制作与复核。', [], {
    src: 'media/ai-income-20260819/broll/S03_AIGC多轮制作与复核_30fps.mp4',
    disclosure: 'AI生成 · AIGC制作情景',
    badge: '概念画面 · 不作项目证明',
    mediaScale: 1.01,
  }),
  scene(26, 242.6, 250.6, 'question-grid', '越往深处，账越具体', '任何一项都可能带来返工。', ['投入成本', '作品质量', '素材权利', '内容规则']),
  scene(27, 250.6, 267.6, 'flow', '小白先做最小验证', '先证明它能把一件真事做好一点。', ['选一件真实事情', '做出最小结果', '现实检查', '再追加时间和钱']),
  scene(28, 267.6, 280.6, 'layer-map', '企业流程，不能乱动', '先走进业务，再判断AI放在哪一步。', ['愿意拿业务出来聊', '找到真实流程', 'AI能帮上忙的地方', '绝对不能乱动的地方']),
  scene(29, 280.6, 292.6, 'question-grid', '有人付费，也仍在验证', '真实进展和稳定结论，不是同一本账。', ['有人愿意付费', '有些仍在验证', '过程不快', '没有视频里那么轻松']),
  scene(30, 292.6, 303.6, 'status', '别被两种画面带偏', '既不因为暂时没大结果全盘否定，也不因一张收款图盲目下注。', ['没大结果 → AI没用', '晒收款图 → 马上冲', '两种都不是判断']),
  scene(31, 303.6, 321.6, 'flow', '收入要从真实价值长出来', '先把手里的工作做扎实。', ['真实工作', '做出东西', '解决问题', '别人愿意用']),
  scene(32, 321.6, 339.6, 'flow', '把热闹慢慢做成有用', '难处和结果都可以成为下一次判断的依据。', ['真实尝试', '说清难处', '留下结果', '共同讨论']),
  scene(33, 339.6, 345.6, 'definition', '第9回，也该生了', '创业九死一生，这次继续用现实验证。'),
  scene(34, 345.6, 352.6, 'generated-media', '先去岗位里实战', '有一技之长，就先让真实工作检验它。', [], {
    src: 'media/ai-income-20260819/broll/S04_先岗位实战再判断创业_30fps.mp4',
    disclosure: 'AI生成 · 求职与实战情景',
    badge: '场景演绎 · 不作就业承诺',
    mediaScale: 1.01,
  }),
  scene(35, 352.6, 358.6, 'flow', '不要轻易创业', '先去实战，把能力磨出来。', ['面试岗位', '进入实战', '磨练能力', '再判断创业']),
  scene(36, 358.6, 363.6, 'comparison', '试错交给我，经验再分享', '先跑真实过程，再谈可复制经验。', ['先试错', '被现实验收', '再分享经验']),
  scene(37, 363.6, 365.6, 'closing', '超哥AI创业记', '在兰州，把AI落到真实工作里。'),
];

const soundIds = [
  'v3-chapter-sweep-a', 'v3-list-tick-a', 'remotion-ui-switch', 'v3-line-connect-a',
  'v3-soft-card-pop-a', 'v2-card-slide', 'v1-keyword-tick', 'v3-evidence-paper-a',
  'v2-evidence-shutter', 'v1-card-reveal', 'v2-section-sweep', 'v1-node-connect',
  'v3-soft-card-pop-b', 'v3-media-whoosh-a', 'v3-list-tick-b', 'v2-node-select',
  'v1-confirm-soft', 'v2-keyword-select', 'v2-ui-click', 'v3-media-whoosh-b',
  'v1-section-air', 'remotion-page-turn', 'v2-zoom-out', 'v1-ui-click',
  'v3-cta-confirm-a', 'remotion-whoosh', 'remotion-mouse-click',
  'v3-chapter-sweep-a', 'v3-list-tick-a', 'remotion-ui-switch', 'v3-line-connect-a',
  'v3-soft-card-pop-a', 'v2-card-slide', 'v3-media-whoosh-a', 'v1-keyword-tick',
  'v2-section-sweep', 'v3-cta-confirm-a',
];

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const byId = new Map(manifest.items.map((item) => [item.id, item]));
const forbidden = /voice|speech|whisper|breath|shout|number-affirmation|thesis-impact/i;
const sourceUsage = new Map();
const cues = layers.map((layer, index) => {
  const soundId = soundIds[index];
  const item = byId.get(soundId);
  if (!item?.eligibleForSfx || forbidden.test(soundId)) {
    throw new Error(`音效不在安全白名单：${soundId}`);
  }
  const starts = sourceUsage.get(soundId) ?? [];
  if (starts.length >= 3) throw new Error(`同一音效使用超过3次：${soundId}`);
  if (starts.some((start) => Math.abs(start - layer.start) < 25)) {
    throw new Error(`同一音效间隔小于25秒：${soundId}`);
  }
  starts.push(layer.start);
  sourceUsage.set(soundId, starts);
  const role = layer.sound.role;
  const volume = role === 'media' ? 0.21 : role === 'evidence' ? 0.24 : role === 'cta' ? 0.25 : 0.27;
  return {
    id: layer.sound.cueId,
    visualEventId: layer.visualEvent.id,
    role,
    start: layer.start,
    end: Number((layer.start + item.durationSeconds).toFixed(6)),
    source: item.output,
    license: item.license,
    licenseReference: item.licenseReference,
    volume,
    voiceDuckDb: 0,
    previewCovered: layer.start < 45,
    formalReviewed: false,
    userAudibilityConfirmed: layer.start < 45,
    contentSafety: 'nonverbal-audited-source',
  };
});

for (let index = 0; index < layers.length; index += 1) {
  const current = layers[index];
  const expectedStart = index === 0 ? 0 : layers[index - 1].end;
  if (Math.abs(current.start - expectedStart) > 0.001) {
    throw new Error(`视觉层不连续：${current.id}`);
  }
  if (current.end <= current.start) throw new Error(`视觉层时长无效：${current.id}`);
  if (current.background === 'opaque' && current.params.component !== 'generated-media') {
    throw new Error(`禁止Remotion全屏说明页：${current.id}`);
  }
}
if (Math.abs(layers.at(-1).end - durationSeconds) > 0.001) {
  throw new Error('视觉层未覆盖完整原片');
}

const plan = {
  schemaVersion: 4,
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: 'candidate-preview-approved',
  },
  videoId: 'AI_INCOME_20260819_talk01',
  videoTitle: '学AI到底能不能多挣一点钱',
  sourceVideo: 'source/20260819_ai_income/R01_学AI能否多挣钱_口播原片.MOV',
  transcript: 'edit/20260819_ai_income/transcripts/AI_INCOME_20260819_talk01.cleaned.v1.json',
  bilingualCaptions: 'remotion/public/data/AI_INCOME_20260819_talk01.bilingual.v1.json',
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: [
    'v8-user-confirmed-default-20260812',
    'v8-speaker-first-continuous-semantics',
    'v8-transparent-evidence-and-generated-media',
  ],
  target: {aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin'},
  previewCoverage: [
    'hook',
    'complex-overlay',
    'full-screen-asset',
    'cta',
    'speaker-overlay',
    'media-fullscreen',
    'progressive-process',
    'source-evidence',
    'hero-emphasis',
    'sfx-ab',
  ],
  previewCoverageEvidence: {
    dynamicUserPreview: 'outputs/previews/学AI能否多挣钱_V8_45秒预览_有音效.mp4',
    sameFrameComparison: 'outputs/previews/学AI能否多挣钱_V8_45秒预览_无音效.mp4',
    fullTimelineRiskFrames: 'edit/20260819_ai_income/verify/formal/contact_every10s.jpg',
    generatedMediaRiskFrames: 'edit/20260819_ai_income/verify/v8_keyframes_contact.jpg',
    note: '用户动态试听覆盖首屏、复杂叠层与音效层级；全屏生成素材、证据卡和结尾由全分辨率风险帧及整片联系表覆盖，完整成片仍待用户正常速度观看验收。',
  },
  editPolicy: '完整保留真人原片，不删字、不重排；证据截图只展示真实可公开部分；无交付证据不制作交付证明；四段用户生成AI视频在对应语义段全屏静音覆盖，始终保留原口播音轨；Remotion只做人像左侧透明信息动效，不使用全屏说明页。',
  evidencePolicy: {
    deliveryEvidenceProvided: false,
    codexUsageIsPaymentEvidence: false,
    rechargePricingIsSpendEvidence: false,
    certificatePrivacyCropRequired: true,
  },
  assetCoverage: {
    usableOriginalVideoItems: 1,
    assignedOriginalVideoItems: 1,
    generatedVideoItems: 4,
    assignedGeneratedVideoItems: 4,
    privacySafeEvidenceItems: 7,
    assignedPrivacySafeEvidenceItems: 7,
  },
  layers,
};
const sfx = {
  schemaVersion: 3,
  videoId: plan.videoId,
  version: 'v8-ai-income-preview-1',
  experimentId: plan.experiment.id,
  normalizedPack: path.relative(root, manifestPath),
  forbiddenContent: ['human voice', 'speech', 'whisper', 'breathing', 'shout', 'voice-like affirmation'],
  cues,
};

const job = {
  schemaVersion: 1,
  jobId: '20260819-ai-income-v80',
  videoId: plan.videoId,
  title: plan.videoTitle,
  purpose: '完整保留用户真人口播，以V8连续语义动效、隐私安全投入证据和四段用户生成AI情景视频，说明不同处境学习AI的现实路径。',
  productionState: 'ready-for-user-review',
  productionProfile: {
    id: 'v8-semantic-continuity-sfx',
    version: 'V8',
  },
  contentApproval: {
    userScriptApproved: true,
    userApprovedAt: '2026-08-19T00:00:00+08:00',
    evidence: '用户提供最终定稿、随后上传完整真人口播并明确要求按该稿制作；真人原片构成当前语言与朗读证据。',
  },
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: 'candidate-preview-approved',
    userPreviewApproved: true,
    userPreviewApprovedAt: '2026-08-19T21:58:00+08:00',
    userPreviewApprovalEvidence: '用户明确回复“有音效版通过。”，批准沿用同一视觉、字幕、数字运镜与音效策略进入完整正式渲染。',
    revisionReason: '把用户已通过的45秒有音效预览扩展为全长正式候选片。',
    primaryVisualEventCount: layers.length,
    sfxCoveragePercent: 100,
    previewAuditionRoles: ['keyword', 'line'],
  },
  baseline: {
    path: 'workflow/production-baseline.v1.json',
    id: 'koubo-formal-16x9-v1',
    revision: 'V7.2-20260730',
  },
  inputs: {
    source: plan.sourceVideo,
    renderProxy: 'remotion/public/media/ai-income-20260819/main-30fps.mp4',
    visualPlan: path.relative(root, outPlan),
    bilingualCaptions: plan.bilingualCaptions,
    sfxCueSheet: path.relative(root, outSfx),
    sfxManifest: path.relative(root, manifestPath),
    fingerprintPaths: [
      plan.sourceVideo,
      'remotion/public/media/ai-income-20260819/main-30fps.mp4',
      plan.transcript,
      plan.bilingualCaptions,
      'remotion/src/AIIncomeV80Talk16x9.tsx',
      path.relative(root, outPlan),
      path.relative(root, outSfx),
      path.relative(root, manifestPath),
    ],
  },
  remotion: {
    root: 'remotion',
    entry: 'src/index.ts',
    compositionWithSfx: 'AIIncome16x9-V80-WithSfx',
    compositionWithoutSfx: 'AIIncome16x9-V80-NoSfx',
    durationSeconds,
    fps: 30,
    width: 1920,
    height: 1080,
    concurrency: 4,
  },
  preview: {
    enabled: true,
    withSfxOnly: false,
    scale: 2 / 3,
    crf: 22,
    ranges: [
      {
        id: 'v8-ai-income-first-45-seconds',
        startSeconds: 0,
        endSeconds: 45,
      },
    ],
    output: 'outputs/previews/学AI能否多挣钱_V8_45秒预览_有音效.mp4',
    renderWithoutSfxComparison: true,
  },
  riskFrames: {
    enabled: true,
    source: 'visual-plan-reviewAt-and-full-timeline-contact-sheet',
    fullResolution: true,
    outputDirectory: 'edit/20260819_ai_income/verify',
  },
  audioPreflight: {
    enabled: true,
    source: 'preview',
    integratedLoudnessTargetLufs: -16,
    truePeakMaxDbtp: -1.5,
    preferredTruePeakDbtp: -1.8,
  },
  formal: {
    enabled: true,
    composition: 'with-sfx',
    blockedReason: null,
    crf: 18,
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioBitrate: '192k',
    finalOutput: 'outputs/学AI到底能不能多挣一点钱_16x9_V8_有音效_正式成片_v2.mp4',
    loudness: {
      enabled: true,
      integratedLoudnessTargetLufs: -16,
      loudnessRangeTargetLu: 11,
      truePeakTargetDbtp: -2.2,
      measuredIntegratedLoudnessLufs: -16.1,
      measuredLoudnessRangeLu: 4.7,
      measuredTruePeakDbtp: -2.2,
      videoStreamCopiedWithoutReencode: true,
    },
  },
  reports: {
    formalProbe: 'edit/20260819_ai_income/verify/formal/ffprobe.json',
    formalBlackDetect: 'edit/20260819_ai_income/verify/formal/blackdetect.txt',
    formalSilenceDetect: 'edit/20260819_ai_income/verify/formal/silencedetect.txt',
    formalVolumeDetect: 'edit/20260819_ai_income/verify/formal/volumedetect.txt',
  },
};

for (const target of [outPlan, outSfx, outJob]) fs.mkdirSync(path.dirname(target), {recursive: true});
fs.writeFileSync(outPlan, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
fs.writeFileSync(outSfx, `${JSON.stringify(sfx, null, 2)}\n`, 'utf8');
fs.writeFileSync(outJob, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({layers: layers.length, cues: cues.length, durationSeconds, outPlan, outSfx, outJob}, null, 2));
