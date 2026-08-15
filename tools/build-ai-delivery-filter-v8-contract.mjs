import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const videoId = 'AI_DELIVERY_FILTER_20260815_talk01';
const durationSeconds = 332.333;
const experimentId = 'v8-semantic-continuity-sfx';
const previewStart = 0;
const previewEnd = 45;
const editRoot = 'edit/20260815_ai_delivery_filter';
const mediaRoot = 'remotion/public/media/ai-delivery-filter-20260815';
const sourceVideo =
  'source/20260815_ai_delivery_filter/R01_AI圈最魔幻的事_口播原片.MOV';
const talkProxy = `${mediaRoot}/main-30fps.mp4`;
const captions =
  'remotion/public/data/AI_DELIVERY_FILTER_20260815_talk01.bilingual.v1.json';
const transcript =
  `${editRoot}/transcripts/AI_DELIVERY_FILTER_20260815_talk01.cleaned.v1.json`;
const runtimePlan =
  'remotion/src/data/AIDeliveryFilterV80.visual-plan.v1.json';
const runtimeSfx = 'remotion/src/data/AIDeliveryFilterV80.sfx.v1.json';
const editPlan =
  `${editRoot}/visual-plan_AI_DELIVERY_FILTER_20260815_talk01_v8.json`;
const editSfx =
  `${editRoot}/sfx-cue-sheet_AI_DELIVERY_FILTER_20260815_talk01_v8.json`;
const jobPath =
  'workflow/jobs/20260815_ai_delivery_filter_v80.production.json';

const media = {
  hypeStoreGap: `${mediaRoot}/S01-ai-hype-store-gap.mp4`,
  inquiryFragmentation: `${mediaRoot}/S02-inquiry-fragmentation.mp4`,
  demoNoAdoption: `${mediaRoot}/S03-demo-no-adoption.mp4`,
};

const sceneSpecs = [
  {start: 0.03, end: 6.94, component: 'definition', family: 'hero-definition', role: 'chapter', title: 'AI圈最魔幻的事', detail: '不是工具更新有多快，而是谁在教谁做生意。', items: []},
  {start: 6.94, end: 15.75, component: 'question-grid', family: 'role-question-list', role: 'list', title: '三类反常角色', detail: '话说得很满，但自己的现实经验未必跟得上。', items: ['没做过生意 → 教赚钱', '没带过团队 → 教管理', '项目没跑通 → 教自动成交']},
  {start: 15.75, end: 23.61, component: 'status', family: 'promise-stack', role: 'keyword', title: '项目还没跑通', detail: '承诺却已经跑在了前面。', items: ['三个月翻身', '半年复制', '自动成交']},
  {start: 23.61, end: 32.2, component: 'statement', family: 'source-boundary', role: 'evidence', title: '先别争论“配不配讲”', detail: '把它放回你的真实生意，看最后能不能交付。', items: ['不评判人设', '只检查交付', '回到现实场景']},
  {start: 32.2, end: 36.79, component: 'comparison', family: 'decision-comparison', role: 'comparison', title: '判断问题只有一个', detail: '放进你的生意里，到底能不能交付？', items: ['听起来很厉害', '现实里能交付']},
  {start: 36.79, end: 44.68, component: 'generated-media', family: 'annotated-media', role: 'media', title: '工具能做很多动作', detail: '短视频、客户回复、销售和私域，每句都像是对的。', items: [], src: media.hypeStoreGap, disclosure: 'AI生成 · 情景示意', badge: '场景演绎 · 不作真实案例证据', requestId: '20260815-AI-DELIVERY-S01'},
  {start: 44.68, end: 52.23, component: 'statement', family: 'direct-statement', role: 'keyword', title: '每句都像没错', detail: '可一回到真实门店，问题马上就变了。', items: ['概念正确', '生意未必成立']},
  {start: 52.23, end: 60.26, component: 'generated-media', family: 'fragmented-media', role: 'media', title: '客户咨询散在哪里', detail: '入口、问题和错误回复没有理清，工具就接不住真正的生意。', items: [], src: media.inquiryFragmentation, disclosure: 'AI生成 · 情景示意', badge: '场景演绎 · 不作真实案例证据', requestId: '20260815-AI-DELIVERY-S02'},
  {start: 60.26, end: 66.58, component: 'question-grid', family: 'failure-question-list', role: 'list', title: '成交为什么失败', detail: '三个原因对应三种完全不同的解法。', items: ['客户没看懂', '价格没谈拢', '后续服务接不住']},
  {start: 66.58, end: 75.75, component: 'layer-map', family: 'business-question-map', role: 'node', title: '演示工具之前，先问清四件事', detail: '不把问题说清，就不能把动作当成解法。', items: ['客户从哪来', '咨询散在哪', '哪句经常答错', '成交卡在哪']},
  {start: 75.75, end: 84.45, component: 'definition', family: 'hero-definition-alt', role: 'keyword', title: '工具动作 ≠ 经营建议', detail: '动作可以学，但不能把它直接包装成生意答案。', items: []},
  {start: 84.45, end: 93.76, component: 'definition', family: 'chapter-definition', role: 'chapter', title: '01 · 可交付', detail: '先看真实问题能不能翻译成可验收的任务。', items: []},
  {start: 93.76, end: 106, component: 'flow', family: 'delivery-process', role: 'line', title: '可交付要说清四件事', detail: '“降本增效”不是交付物，只是一句概念。', items: ['给什么资料', '处理哪一步', '交回什么', '老板怎么验收']},
  {start: 106, end: 121.69, component: 'layer-map', family: 'service-node-map', role: 'node', title: 'AI客服系统不能只剩一个名字', detail: '真正的交付要把咨询、跟进、人工确认和禁止自动回复连起来。', items: ['咨询分类', '客户跟进', '人工确认', '禁止自动回复']},
  {start: 121.69, end: 127.7, component: 'statement', family: 'confirmation-statement', role: 'confirm', title: '买的不是概念', detail: '而是一段能看懂、能使用、能验收的工作。', items: ['看得懂', '用得上', '验得了']},
  {start: 127.7, end: 134.69, component: 'definition', family: 'chapter-definition-alt', role: 'chapter', title: '02 · 付出成本', detail: '真实需求一定会让对方愿意拿出某种成本。', items: []},
  {start: 134.69, end: 145.6, component: 'question-grid', family: 'cost-question-list', role: 'list', title: '现实成本不只是钱', detail: '只要对方真愿意配合，问题就开始有了现实重量。', items: ['拿出真实资料', '让员工配合', '给一段试用时间', '为结果付小预算']},
  {start: 145.6, end: 152.64, component: 'statement', family: 'direct-statement-alt', role: 'keyword', title: '内容很火，只验证一件事', detail: '大家愿意看热闹，不等于愿意把业务拿来试。', items: []},
  {start: 152.64, end: 161.41, component: 'comparison', family: 'reality-comparison', role: 'comparison', title: '热闹 ≠ 需求成立', detail: '三组数据都只是线索，不是付费证据。', items: ['点赞 ≠ 客户付钱', '收藏 ≠ 老板试用', '免费帮忙 ≠ 真需求']},
  {start: 161.41, end: 168.68, component: 'statement', family: 'confirmation-statement-alt', role: 'confirm', title: '愿意付出成本', detail: '才说明这个问题在现实世界里有重量。', items: []},
  {start: 168.68, end: 175.69, component: 'definition', family: 'chapter-definition', role: 'chapter', title: '03 · 沉出共性', detail: '一次服务之后，有没有留下下次还能用的部分。', items: []},
  {start: 175.69, end: 184.47, component: 'comparison', family: 'product-comparison', role: 'comparison', title: '一次有效 ≠ 产品可复制', detail: '个别老板觉得有用，不能直接推到下一个行业。', items: ['一个老板觉得有用', '一个案例跑通', '下个行业能复制？']},
  {start: 184.47, end: 198.27, component: 'question-grid', family: 'commonality-question-list', role: 'list', title: '真正值钱的是共性', detail: '多做几次，才知道什么能复用，什么必须人来判断。', items: ['每个老板都问什么', '开工前总缺什么', '哪些环节必须确认', '哪些输出能做模板']},
  {start: 198.27, end: 202.66, component: 'status', family: 'stop-rule-stack', role: 'keyword', title: '错误一出现', detail: '就要知道什么时候停下来重做，而不是继续放大。', items: ['发现错误', '停止放大', '重做方案']},
  {start: 202.66, end: 208.15, component: 'flow', family: 'service-process', role: 'line', title: '一次演示怎样变成服务', detail: '把共性留下来，再用多次验证证明它能被复用。', items: ['共性沉淀', '多次验证', '模板复用', '形成服务']},
  {start: 208.15, end: 215.8, component: 'generated-media', family: 'adoption-media', role: 'media', title: '演示很厉害，回公司却没人会用', detail: '没有沉出共性的工具，很容易停在当场表演。', items: [], src: media.demoNoAdoption, disclosure: 'AI生成 · 情景示意', badge: '场景演绎 · 不作真实案例证据', requestId: '20260815-AI-DELIVERY-S03'},
  {start: 215.8, end: 221.26, component: 'definition', family: 'chapter-definition-alt', role: 'chapter', title: '04 · 失败处理', detail: '老板最该关心的，是出错以后谁来接住。', items: []},
  {start: 221.26, end: 234.31, component: 'layer-map', family: 'responsibility-node-map', role: 'node', title: '出错以后，责任落到谁', detail: '自动回复、销售话术和新流程都必须有人检查和兜底。', items: ['谁检查', '谁兜底', '谁复盘', '谁负责']},
  {start: 234.31, end: 240.68, component: 'status', family: 'decision-stack', role: 'comparison', title: '花了钱却没效果', detail: '不是继续加钱这一个选项，先判断问题到底在哪里。', items: ['继续加钱', '换工具', '停下查原因']},
  {start: 240.68, end: 249.35, component: 'comparison', family: 'plan-comparison', role: 'comparison', title: '只讲开始 ≠ 完整方案', detail: '不讲失败处理，对老板来说就只是半截方案。', items: ['讲怎么开始', '避开失败', '补上失败处理']},
  {start: 249.35, end: 260.59, component: 'statement', family: 'cost-statement', role: 'keyword', title: '最贵的不是买工具', detail: '是买完没人用，用错没人管，管不了还继续加钱。', items: ['没人用', '没人管', '继续加钱']},
  {start: 260.59, end: 269.49, component: 'definition', family: 'hero-definition', role: 'keyword', title: 'AI演示 ≠ 生意答案', detail: '反对的不是AI课和AI服务，而是把一次演示包装成完整生意。', items: []},
  {start: 269.49, end: 281.27, component: 'question-grid', family: 'fit-question-list', role: 'list', title: '靠谱方案先说清三件事', detail: '不是谁都适合，也不是打开工具就能开始。', items: ['这件事适合谁', '不适合谁', '开始前要准备什么']},
  {start: 281.27, end: 290.36, component: 'question-grid', family: 'delivery-question-list', role: 'list', title: '交付过程还要说清', detail: '把人工确认、验收和失败查因连在一起。', items: ['哪一步必须人工确认', '最后用什么结果验收', '效果不好先查什么']},
  {start: 290.36, end: 297.56, component: 'statement', family: 'useful-statement', role: 'confirm', title: '听起来没那么刺激', detail: '但它对老板有用，因为每一步都能被检查。', items: []},
  {start: 297.56, end: 303.1, component: 'flow', family: 'business-process', role: 'line', title: '生意的四个位置', detail: 'AI进来以后，也不能跳过任何一个。', items: ['有人付成本', '有人交结果', '有人真使用', '有人负责']},
  {start: 303.1, end: 314.35, component: 'status', family: 'capability-stack', role: 'confirm', title: 'AI能帮你做什么', detail: '它能加快环节、降低试错，让小团队先做过去做不起的动作。', items: ['环节更快', '试错更低', '小团队先做']},
  {start: 314.35, end: 323.44, component: 'comparison', family: 'boundary-comparison', role: 'comparison', title: 'AI不能替你跨过两件事', detail: '工具不能凭空创造需求，也不能替代真实交付经验。', items: ['没有需求 → 不是好生意', '没有交付经验 → 不是商业顾问']},
  {start: 323.44, end: 329.34, component: 'definition', family: 'filter-definition', role: 'confirm', title: 'AI圈不缺热闹', detail: '普通老板真正缺的，是一把能把热闹筛掉的尺子。', items: []},
  {start: 329.34, end: 332.333, component: 'closing', family: 'closing-signature', role: 'confirm', title: '我是超哥', detail: '在兰州AI创业', items: []},
];

const coverageByFamily = Object.fromEntries(
  sceneSpecs.map((scene) => [
    scene.family,
    scene.component === 'generated-media'
      ? 1
      : scene.component === 'layer-map'
        ? 0.4
        : scene.component === 'question-grid' || scene.component === 'flow'
          ? 0.38
          : scene.component === 'comparison' || scene.component === 'status'
            ? 0.36
            : scene.component === 'closing'
              ? 0.27
              : 0.31,
  ]),
);

const roleFiles = {
  chapter: [
    'v3-chapter-sweep-a.wav',
    'v2-section-sweep.wav',
    'v1-section-air.wav',
    'waic-section-whoosh.wav',
  ],
  list: [
    'v3-list-tick-a.wav',
    'v3-list-tick-b.wav',
    'remotion-mouse-click.wav',
    'v1-ui-click.wav',
  ],
  keyword: [
    'v1-keyword-tick.wav',
    'v2-keyword-select.wav',
    'v3-soft-card-pop-a.wav',
    'v3-soft-card-pop-b.wav',
    'waic-card-pop.wav',
  ],
  comparison: [
    'remotion-ui-switch.wav',
    'v3-number-settle-a.wav',
    'waic-thesis-impact.wav',
    'v2-number-affirmation.wav',
  ],
  evidence: [
    'v3-evidence-paper-a.wav',
    'v2-evidence-shutter.wav',
    'v1-camera-shutter.wav',
    'remotion-page-turn.wav',
  ],
  media: [
    'v3-media-whoosh-a.wav',
    'v3-media-whoosh-b.wav',
    'remotion-whoosh.wav',
    'v2-zoom-out.wav',
  ],
  line: [
    'v3-line-connect-a.wav',
    'v2-card-slide.wav',
    'v1-card-reveal.wav',
  ],
  node: [
    'v2-node-select.wav',
    'waic-node-connect.wav',
    'v1-node-connect.wav',
  ],
  confirm: [
    'v1-confirm-soft.wav',
    'v3-cta-confirm-a.wav',
    'v2-ui-click.wav',
  ],
};

const volumeByRole = {
  chapter: 0.28,
  list: 0.3,
  keyword: 0.3,
  comparison: 0.3,
  evidence: 0.28,
  media: 0.24,
  line: 0.27,
  node: 0.27,
  confirm: 0.28,
};

const manifest = JSON.parse(
  readFileSync(path.join(root, 'assets/sfx/koubo-sfx-v8/manifest.json'), 'utf8'),
);
const manifestByOutput = new Map(
  manifest.items.map((item) => [item.output, item]),
);
const sourceUse = new Map();
const sourceCount = new Map();

const reserveSource = (source, start) => {
  const prior = sourceUse.get(source) ?? [];
  if (prior.some((time) => Math.abs(start - time) < 25)) {
    throw new Error(`${source}在${start.toFixed(2)}秒违反25秒复用规则。`);
  }
  if ((sourceCount.get(source) ?? 0) >= 3) {
    throw new Error(`${source}全片使用将超过3次。`);
  }
  prior.push(start);
  sourceUse.set(source, prior);
  sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
  return source;
};

const pickSource = (role, start) => {
  const candidates = roleFiles[role].map(
    (file) => `remotion/public/audio/koubo-sfx-v8/${file}`,
  );
  const source = candidates
    .filter((candidate) =>
      (sourceUse.get(candidate) ?? []).every(
        (time) => Math.abs(start - time) >= 25,
      ),
    )
    .filter((candidate) => (sourceCount.get(candidate) ?? 0) < 3)
    .sort((left, right) => {
      const countDiff =
        (sourceCount.get(left) ?? 0) - (sourceCount.get(right) ?? 0);
      const leftLast = Math.max(...(sourceUse.get(left) ?? [-Infinity]));
      const rightLast = Math.max(...(sourceUse.get(right) ?? [-Infinity]));
      return countDiff || leftLast - rightLast;
    })[0];
  if (!source) {
    throw new Error(`${role}在${start.toFixed(2)}秒没有合规音效。`);
  }
  return reserveSource(source, start);
};

const layers = sceneSpecs.map((scene, index) => {
  const generatedMedia = Boolean(scene.src);
  const order = String(index + 1).padStart(3, '0');
  const eventId = `delivery8-v${order}`;
  const cueId = `delivery8-sfx-${order}`;
  return {
    id: `delivery-${order}-${scene.component}`,
    start: scene.start,
    end: scene.end,
    spokenLine: scene.title,
    purpose: generatedMedia
      ? 'generated-scene-explanation'
      : 'semantic-emphasis',
    kind: generatedMedia
      ? 'full-screen-asset'
      : 'transparent-semantic-information',
    variant: scene.component,
    titleOwner: true,
    overlapGroup: `delivery-v${order}`,
    zone: generatedMedia ? 'full-screen' : 'left-safe',
    title: scene.title,
    detail: scene.detail,
    items: scene.items,
    asset: {
      sourceType: generatedMedia
        ? 'user-generated-ai-video'
        : 'remotion-component',
      source: scene.src ?? `AIDeliveryFilterV80/${scene.family}`,
    },
    assetDecision: {
      class: generatedMedia ? 'generated-video' : 'remotion-information',
      producer: generatedMedia ? 'user' : 'codex-remotion',
      requestId: generatedMedia ? scene.requestId : null,
      fallback: 'speaker-plus-information',
    },
    visualEvent: {id: eventId, enterAt: scene.start, primary: true},
    sound: {
      policy: 'required',
      role: scene.role,
      cueId,
      offsetFrames: 0,
      maxSyncErrorFrames: 2,
    },
    params: {
      component: scene.component,
      title: scene.title,
      detail: scene.detail,
      items: scene.items,
      ...(scene.src
        ? {src: scene.src.replace(/^remotion\/public\//, '')}
        : {}),
      ...(scene.disclosure ? {disclosure: scene.disclosure} : {}),
      ...(scene.badge ? {badge: scene.badge} : {}),
    },
    checks: {
      avoidFace: !generatedMedia,
      avoidHands: !generatedMedia,
      avoidSubtitle: true,
      needsFrameReview: true,
      continuousReviewIntervalSeconds: generatedMedia ? null : 0.5,
      reviewAt: Number(((scene.start + scene.end) / 2).toFixed(2)),
    },
    background: generatedMedia ? 'opaque' : 'talk',
    presentation: {
      renderMode: generatedMedia ? 'media-fullscreen' : 'speaker-overlay',
      semanticFamily: scene.family,
      coverageRatio: coverageByFamily[scene.family],
      progressiveReveal: true,
    },
  };
});

const cues = layers.map((layer) => {
  const source = pickSource(layer.sound.role, layer.visualEvent.enterAt);
  const item = manifestByOutput.get(source);
  if (
    !item ||
    item.eligibleForSfx !== true ||
    item.contentKind !== 'sound-effect'
  ) {
    throw new Error(`音效未进入审核白名单：${source}`);
  }
  return {
    id: layer.sound.cueId,
    visualEventId: layer.visualEvent.id,
    role: layer.sound.role,
    start: layer.visualEvent.enterAt,
    end:
      layer.visualEvent.enterAt + Math.min(1.4, item.durationSeconds),
    source,
    license: item.license,
    licenseReference: item.licenseReference,
    volume: volumeByRole[layer.sound.role],
    voiceDuckDb: 0,
    previewCovered:
      layer.visualEvent.enterAt >= previewStart &&
      layer.visualEvent.enterAt <= previewEnd,
    formalReviewed: false,
    userAudibilityConfirmed: false,
  };
});

const plan = {
  schemaVersion: 4,
  experiment: {id: experimentId, status: 'candidate-preview-required'},
  videoId,
  videoTitle: 'AI演示不等于生意答案',
  sourceVideo,
  transcript,
  bilingualCaptions: captions,
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: [
    'v8-user-confirmed-default-20260812',
    'v8-speaker-first-continuous-semantics',
    'v8-generated-video-fullscreen-with-disclosure',
  ],
  target: {
    aspect: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    platform: 'douyin',
  },
  previewCoverage: [
    'hook',
    'complex-overlay',
    'cta',
    'full-screen-asset',
    'speaker-overlay',
    'media-fullscreen',
    'progressive-process',
    'source-evidence',
    'hero-emphasis',
    'sfx-ab',
  ],
  editPolicy:
    '完整保留用户原口播，不删字、不重排；三条AI情景视频只在对应语义段全屏覆盖且静音，始终保留原口播音轨。Remotion只做人物左侧透明信息动效，不使用全屏说明页。',
  assetCoverage: {
    usableOriginalVideoItems: 1,
    assignedOriginalVideoItems: 1,
    generatedVideoItems: 3,
    assignedGeneratedVideoItems: 3,
    generatedStillItems: 0,
    allRequiredClaimsCovered: true,
    note: '三条用户生成AI视频均已绑定到对应语义节点，只作情景演绎，不作真实案例证据。',
  },
  layers,
};

const cueSheet = {
  schemaVersion: 3,
  videoId,
  version: 'v8-ai-delivery-filter-preview-1',
  experimentId,
  normalizedPack: 'assets/sfx/koubo-sfx-v8/manifest.json',
  cues,
  coverageReview: {
    primaryVisualEventCount: layers.length,
    coveredPrimaryVisualEventCount: cues.length,
    coveragePercent: 100,
    maxSyncErrorFrames: 2,
    machineStatus: 'pending-validator',
    userAudibilityConfirmed: false,
    confirmationScope: null,
  },
};

const job = {
  schemaVersion: 1,
  jobId: '20260815-ai-delivery-filter-v80',
  videoId,
  title: 'AI演示不等于生意答案',
  purpose:
    '完整保留本人口播，以V8连续语义动效和三段AI情景视频，建立判断AI服务能否真正交付的四把尺子。',
  productionState: 'ready-for-production',
  productionProfile: {id: experimentId, version: 'V8'},
  contentApproval: {
    userScriptApproved: true,
    userApprovedAt: '2026-08-15T00:00:00+08:00',
    evidence:
      '用户提供最终口播原文，随后上传完整真人口播并明确要求出成片；本条录音构成真人朗读证据。',
  },
  experiment: {
    id: experimentId,
    status: 'candidate-preview-required',
    userPreviewApproved: false,
    userPreviewApprovedAt: null,
    userPreviewApprovalEvidence: null,
    revisionReason:
      '首次按已确认素材生成本条V8同画面有声和无声动态预览。',
    primaryVisualEventCount: layers.length,
    sfxCoveragePercent: 100,
    previewAuditionRoles: [
      'chapter',
      'list',
      'keyword',
      'evidence',
      'comparison',
      'media',
    ],
  },
  baseline: {
    path: 'workflow/production-baseline.v1.json',
    id: 'koubo-formal-16x9-v1',
    revision: 'V7.2-20260730',
  },
  inputs: {
    source: sourceVideo,
    renderProxy: talkProxy,
    visualPlan: editPlan,
    bilingualCaptions: captions,
    sfxCueSheet: editSfx,
    sfxManifest: 'assets/sfx/koubo-sfx-v8/manifest.json',
    fingerprintPaths: [
      sourceVideo,
      talkProxy,
      media.hypeStoreGap,
      media.inquiryFragmentation,
      media.demoNoAdoption,
      transcript,
      captions,
      'remotion/src/Root.tsx',
      'remotion/src/AIDeliveryFilterV80Talk16x9.tsx',
      'remotion/src/components/V8SemanticStage.tsx',
      'remotion/src/components/V72ProductionShell.tsx',
      runtimePlan,
      runtimeSfx,
      editPlan,
      editSfx,
      'remotion/public/audio/koubo-sfx-v8',
      'assets/sfx/koubo-sfx-v8/manifest.json',
    ],
  },
  remotion: {
    root: 'remotion',
    entry: 'src/index.ts',
    compositionWithSfx: 'AIDeliveryFilter16x9-V80-WithSfx',
    compositionWithoutSfx: 'AIDeliveryFilter16x9-V80-NoSfx',
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
      {
        id: 'v8-hook-delivery-filter-first-45-seconds',
        startSeconds: previewStart,
        endSeconds: previewEnd,
      },
    ],
    output:
      'work/production-runs/20260815-ai-delivery-filter-v80/preview45/with-sfx.mp4',
    renderWithoutSfxComparison: true,
  },
  riskFrames: {
    enabled: true,
    source: 'visual-plan-reviewAt',
    fullResolution: true,
    outputDirectory:
      'work/production-runs/20260815-ai-delivery-filter-v80/preview45/risk-frames',
  },
  audioPreflight: {
    enabled: true,
    source: 'preview',
    integratedLoudnessTargetLufs: -16,
    truePeakMaxDbtp: -1.5,
    preferredTruePeakDbtp: -1.8,
  },
  formal: {
    enabled: false,
    composition: 'with-sfx',
    blockedReason:
      '等待用户确认本条45秒同画面有声和无声预览。',
    crf: 18,
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioBitrate: '192k',
    rawOutput:
      'work/production-runs/20260815-ai-delivery-filter-v80/formal/formal-raw.mp4',
    finalOutput:
      'outputs/AI演示不等于生意答案_16x9_V80_有音效_候选成片_v1.mp4',
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
      'work/production-runs/20260815-ai-delivery-filter-v80/run-manifest.json',
    timingReport:
      'work/production-runs/20260815-ai-delivery-filter-v80/timing-report.json',
    regressionReport:
      'work/production-runs/20260815-ai-delivery-filter-v80/regression-report.json',
  },
};

for (const [target, value] of [
  [runtimePlan, plan],
  [runtimeSfx, cueSheet],
  [editPlan, plan],
  [editSfx, cueSheet],
  [jobPath, job],
]) {
  const absolute = path.join(root, target);
  mkdirSync(path.dirname(absolute), {recursive: true});
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(target);
}

console.log(`V8视觉事件：${layers.length}`);
console.log(`V8音效点：${cues.length}`);
console.log(`实际音效文件：${new Set(cues.map((cue) => cue.source)).size}`);
