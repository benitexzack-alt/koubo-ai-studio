import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const editRoot = path.join(root, 'edit/ordinary_ai_aigc_20260818');
const editRootRelative = 'edit/ordinary_ai_aigc_20260818';
const videoId = 'ORDINARY_AI_AIGC_20260818_talk01';
const title = '普通人学AI，先问自己为什么学';
const sourceVideo = 'source/20260818_ordinary_ai_aigc/R01_普通人学AI与AIGC漫剧入门_口播原片.MOV';
const transcript = 'edit/transcripts/ordinary-ai-aigc-20260818/ordinary-ai-aigc-20260818.cleaned.v1.json';
const bilingual = 'remotion/public/data/ordinary_ai_aigc_20260818.bilingual.v1.json';
const visualPlanPath = `${editRootRelative}/visual-plan_ORDINARY_AI_AIGC_20260818_talk01_v8.json`;
const sfxCuePath = `${editRootRelative}/sfx-cue-sheet_ORDINARY_AI_AIGC_20260818_talk01_v8.json`;
const runtimePlanPath = 'remotion/src/data/OrdinaryAiAigcV80.visual-plan.v1.json';
const runtimeSfxPath = 'remotion/src/data/OrdinaryAiAigcV80.sfx.v1.json';
const jobPath = 'workflow/jobs/20260818_ordinary_ai_aigc_v80.production.json';

const mediaRoot = 'remotion/public/media/ordinary-ai-aigc-20260818';
const userSheet = '/Users/pc/Desktop/口播素材/2026-08-17_普通人学AI与AIGC漫剧入门/05_执行说明/口播素材包与用户素材执行单-v1.md';
const commonChecks = {avoidFace: true, avoidHands: true, avoidSubtitle: true, needsFrameReview: true, continuousReviewIntervalSeconds: 0.5};
const base = ({id, start, end, spokenLine, component, title: layerTitle, detail, items = [], family, assetClass = 'remotion-information', producer = 'codex-remotion', sourceType = 'remotion-component', source = null, requestId = null, renderMode = 'speaker-overlay', background = 'talk', role, tone = 'cyan', mediaClips = undefined, disclosure = undefined, badge = undefined}) => {
  const toStaticPath = (value) => typeof value === 'string' ? value.replace(/^remotion\/public\//, '') : value;
  return ({
  id, start, end, spokenLine, purpose: assetClass === 'generated-video' ? 'concept-illustration' : 'semantic-emphasis', kind: renderMode === 'media-fullscreen' ? 'full-screen-asset' : 'transparent-semantic-information', titleOwner: true, overlapGroup: id, zone: renderMode === 'media-fullscreen' ? 'full-screen' : 'left-safe', title: layerTitle, detail, items,
  asset: {sourceType, ...(source ? {source} : {})},
  assetDecision: {class: assetClass, producer, requestId, fallback: renderMode === 'media-fullscreen' ? 'speaker-plus-information' : 'speaker-overlay'},
  visualEvent: {id: `${id}-event`, enterAt: start, primary: true},
  sound: {policy: 'required', role, cueId: `${id}-sfx`, offsetFrames: 0, maxSyncErrorFrames: 2},
  params: {component, title: layerTitle, detail, items, tone, ...(mediaClips ? {mediaClips: mediaClips.map((clip) => ({...clip, src: toStaticPath(clip.src)}))} : {}), ...(source ? {src: toStaticPath(source)} : {}), ...(disclosure ? {disclosure} : {}), ...(badge ? {badge} : {})},
  checks: {...commonChecks, reviewAt: Math.min(end - 0.2, start + Math.min(2.5, (end - start) * 0.35))},
  background, presentation: {renderMode, semanticFamily: family, coverageRatio: renderMode === 'media-fullscreen' ? 1 : 0.34, progressiveReveal: true},
  });
};

const layers = [
  base({id: 'ordinary-001-hook', start: 0.4, end: 14.5, spokenLine: '我也想学AI，到底怎么从AI里面赚到钱？', component: 'definition', title: '先问：你为什么学AI？', detail: '工作问题、内容创意，还是被焦虑推着走？', items: ['解决工作', '做漫剧', '没有目标'], family: 'hero-definition', role: 'chapter', tone: 'amber'}),
  base({id: 'ordinary-002-three-starts', start: 14.5, end: 29.0, spokenLine: '这三种情况，都叫我想学AI，但起点完全不是一回事。', component: 'question-grid', title: '三种“我想学AI”', detail: '起点不同，第一步也不同。', items: ['手上工作忙不过来', '手里有明确创意', '只是焦虑还没有目标'], family: 'question-list', role: 'list', tone: 'amber'}),
  base({id: 'ordinary-003-early-media', start: 29.0, end: 44.0, spokenLine: '一条是用AI改善现有工作，另一条是用AI做动漫、漫剧和AIGC内容。', component: 'generated-media', title: 'AI可以进入两条真实路径', detail: '改善现有工作，或者做一个能看懂的小样片。', family: 'generated-media', assetClass: 'real-evidence', producer: 'user', sourceType: 'user-recorded-scene', source: `${mediaRoot}/behind-scenes/IMG_2292.mp4`, renderMode: 'media-fullscreen', background: 'opaque', role: 'media', mediaClips: [{src: `${mediaRoot}/behind-scenes/IMG_2292.mp4`, durationSeconds: 12.5}, {src: `${mediaRoot}/behind-scenes/IMG_2293.mp4`, durationSeconds: 2.5}], disclosure: '本人工作与拍摄现场 · 真实素材', badge: '真实过程 · 不作市场证据'}),
  base({id: 'ordinary-004-work-entry', start: 44.0, end: 64.0, spokenLine: '有具体工作问题，就从一项真实任务开始。', component: 'statement', title: '先说工作这一条', detail: '基础不是背工具，而是把一项真实任务跑成闭环。', items: ['问题', '输入与判断', '交付与验收'], family: 'direct-statement', role: 'keyword'}),
  base({id: 'ordinary-005-work-scene', start: 64.0, end: 99.0, spokenLine: '手上的工作已经忙不过来了，想解决一个具体的能力短板。', component: 'generated-media', title: '从真实工作场景开始', detail: '先让AI参与一个你每天都在做、而且能验收的动作。', family: 'generated-media', assetClass: 'real-evidence', producer: 'user', sourceType: 'user-recorded-scene', source: `${mediaRoot}/behind-scenes/IMG_2295.mp4`, renderMode: 'media-fullscreen', background: 'opaque', role: 'media', mediaClips: [{src: `${mediaRoot}/behind-scenes/IMG_2295.mp4`, durationSeconds: 11.1}, {src: `${mediaRoot}/behind-scenes/IMG_2294.mp4`, durationSeconds: 3.7}], disclosure: '本人工作台与拍摄现场 · 真实素材', badge: '真实过程 · 不作效果承诺'}),
  base({id: 'ordinary-006-adoption-data', start: 99.0, end: 149.0, spokenLine: '接触AI的人已经很多了，但会问问题，和让AI稳定参与一项真实工作，中间还有一段距离。', component: 'comparison', title: '6.02亿 / 42.8%', detail: '接触AI的人很多，不等于AI已经进入真实工作。', items: ['生成式人工智能用户规模', '普及率', '回答问题占80.9%'], family: 'comparison-bars', role: 'comparison', tone: 'amber'}),
  base({id: 'ordinary-007-five-things', start: 149.0, end: 188.0, spokenLine: '咋们先要学会五件事。', component: 'question-grid', title: '普通人先学五件事', detail: '第五件：把错误沉淀成模板、清单或固定动作。', items: ['问题是什么', '输入、判断、交付', '资料能不能上传', '什么算做对、谁验收'], family: 'question-list', role: 'list', tone: 'amber'}),
  base({id: 'ordinary-008-minimum-loop', start: 188.0, end: 235.0, spokenLine: '这就形成了一个最小闭环：原始输入，AI第一版，人工检查，交付结果，记录错误。', component: 'flow', title: '原始输入 → AI第一版 → 人工检查 → 交付', detail: '重复到标准稳定，再考虑模板、技能、智能体、自动化或代码。', items: ['原始输入', 'AI第一版', '人工检查', '交付结果'], family: 'process-rail', role: 'node'}),
  base({id: 'ordinary-009-market-exists', start: 235.0, end: 313.0, spokenLine: '这确实是一个值得研究的市场，但市场大，不等于个人做了就能赚钱。', component: 'statement', title: '市场存在，不等于个人必然赚钱', detail: '用户、企业、作品和产业链都存在，但创意仍要通过样片验证。', items: ['用户', '企业', '作品', '产业链'], family: 'direct-statement', role: 'keyword'}),
  base({id: 'ordinary-010-aigc-sample', start: 313.0, end: 345.0, spokenLine: '漫剧的最低交付，不是几张好看的图，而是一个能看懂的样片。', component: 'generated-media', title: '从漂亮图片到完整样片', detail: '一句话故事、角色设定、六到十二个镜头、声音、剪辑，完成一个完整动作。', family: 'generated-media', assetClass: 'generated-video', producer: 'user', sourceType: 'user-generated-video', source: `${mediaRoot}/aigc/视频_3.mp4`, requestId: 'S02', renderMode: 'media-fullscreen', background: 'opaque', role: 'media', mediaClips: [{src: `${mediaRoot}/aigc/视频_3.mp4`, durationSeconds: 8.0}, {src: `${mediaRoot}/aigc/视频_4.mp4`, durationSeconds: 8.0}, {src: `${mediaRoot}/aigc/视频.mp4`, durationSeconds: 8.0}, {src: `${mediaRoot}/aigc/视频_2.mp4`, durationSeconds: 8.0}], disclosure: '用户原创AIGC概念画面 · 不作市场证据', badge: '原创样片示例 · 不代表平台效果'}),
  base({id: 'ordinary-011-sample-standard', start: 345.0, end: 361.5, spokenLine: '通过标准也很简单：观众能不能看懂，人物能不能大体保持。', component: 'status', title: '样片先过五个标准', detail: '看懂、保持、接上、听清、记账。', items: ['看得懂', '人物大体保持', '镜头接得上', '声音听得清'], family: 'status-stack', role: 'keyword'}),
  base({id: 'ordinary-012-price-20', start: 361.5, end: 375.5, spokenLine: 'Seedance 2.0选择4K、5秒、无音频、16比9，一次生成页面显示9.15元。', component: 'generated-media', title: 'Seedance 2.0：4K / 5秒 / 9.15元', detail: 'RunningHub页面示例；原图只作本次价格证据。', family: 'evidence-media', assetClass: 'real-evidence', producer: 'user', sourceType: 'user-provided-price-evidence', source: `${mediaRoot}/evidence/E01.mp4`, renderMode: 'media-fullscreen', background: 'opaque', role: 'evidence', disclosure: 'RunningHub用户实测价格证据 · 原图放大展示', badge: '本次页面示例 · 价格可能随页面和账户变化'}),
  base({id: 'ordinary-013-cost-20', start: 375.5, end: 405.8, spokenLine: '20秒拆成4个5秒镜头，一次成功理想情况下，视频模型调用费等于36.60元。', component: 'comparison', title: '20秒：4 × 9.15 = 36.60元', detail: '这是一次生成成功的理想单轮成本，不包含图片、声音和返工。', items: ['4个5秒镜头', '单轮理想情况', '不含后期与失败返工'], family: 'comparison-bars', role: 'comparison', tone: 'amber'}),
  base({id: 'ordinary-014-cost-retry', start: 405.8, end: 422.4, spokenLine: '每个镜头平均生成4轮，视频模型费等于146.40元。', component: 'statement', title: '返工一来，成本立刻变', detail: '4个镜头 × 4轮 × 9.15元 = 146.40元。', items: ['一次成功 ≠ 一次交付', '记录生成次数', '先设预算上限'], family: 'direct-statement', role: 'keyword', tone: 'amber'}),
  base({id: 'ordinary-015-price-25', start: 422.4, end: 451.9, spokenLine: 'Seedance 2.5是另一套模型和价格体系，4K、30秒，一次生成75.60元。', component: 'generated-media', title: 'Seedance 2.5：4K / 30秒 / 75.60元', detail: '2.0和2.5分开核算，不把两套价格体系混成一个单价。', family: 'evidence-media', assetClass: 'real-evidence', producer: 'user', sourceType: 'user-provided-price-evidence', source: `${mediaRoot}/evidence/E03.mp4`, renderMode: 'media-fullscreen', background: 'opaque', role: 'evidence', disclosure: 'RunningHub用户实测价格证据 · 原图放大展示', badge: 'Seedance 2.5 · 另一套价格体系'}),
  base({id: 'ordinary-016-cost-long', start: 451.9, end: 480.0, spokenLine: '60秒样片约439.20元，3分钟试播集约1317.60元。', component: 'comparison', title: '60秒：439.20元｜3分钟：1317.60元', detail: '只计算Seedance 2.0视频模型调用费，不含图片、声音、剪辑、版权、审核和人工时间。', items: ['12个5秒镜头 × 4轮', '36个5秒镜头 × 4轮', '真正超预算的常是返工'], family: 'comparison-bars', role: 'comparison', tone: 'amber'}),
  base({id: 'ordinary-017-aigc-hero', start: 480.0, end: 508.8, spokenLine: '如果你本身懂导演思维、镜头和节奏，你的优势就不只是会不会点生成按钮。', component: 'generated-media', title: '懂导演思维，试错方向就不同', detail: '角色什么时候出现、镜头怎么切、观众几秒看懂，都会影响返工次数。', family: 'generated-media', assetClass: 'generated-video', producer: 'user', sourceType: 'user-generated-video', source: `${mediaRoot}/aigc/A03_8月12日_4K导出_20秒.mp4`, requestId: 'S03', renderMode: 'media-fullscreen', background: 'opaque', role: 'media', mediaClips: [{src: `${mediaRoot}/aigc/A03_8月12日_4K导出_20秒.mp4`, durationSeconds: 20.2}], disclosure: '用户原创AIGC样片 · 不作商业结果证据', badge: '导演思维与镜头判断'}),
  base({id: 'ordinary-018-four-paths', start: 508.8, end: 563.0, spokenLine: '普通人进入这个市场，大致有四条路。', component: 'layer-map', title: '普通人进入市场的四条路', detail: '先用小样片验证，再决定投入方式。', items: ['自己在家做样片', '借助工作室', '组一个小团队', '找平台、扶持或资方'], family: 'layer-map', role: 'node'}),
  base({id: 'ordinary-019-home-studio', start: 563.0, end: 598.0, spokenLine: '自己在家做样片，或者借助工作室。', component: 'question-grid', title: '自己做，还是借助工作室？', detail: '交付秒数、镜头数、修改轮次、资产归属和商用边界都要问清楚。', items: ['自己做：预算可控', '工作室：买样片先验证', '角色资产归谁', '素材能不能商用'], family: 'question-list', role: 'list'}),
  base({id: 'ordinary-020-team-fund', start: 598.0, end: 684.4, spokenLine: '组一个小团队，或者去找平台、扶持或者资方。', component: 'status', title: '团队与资方，都要先看交付', detail: '好想法只是起点，还要有故事、样片、预算、版权、团队和发行计划。', items: ['创意与编剧', '导演与分镜', '角色与视觉资产', '生成、剪辑、声音、合规'], family: 'status-stack', role: 'keyword'}),
  base({id: 'ordinary-021-boundaries', start: 684.4, end: 723.6, spokenLine: '还有两道边界要提前记住。', component: 'question-grid', title: '两道不能跳过的边界', detail: '微短剧公开传播与AI生成合成内容，都要按要求核验和标识。', items: ['许可证、备案、审核、责任主体', '生成合成内容标识', '小说、角色、肖像、音乐、字体的授权'], family: 'question-list', role: 'list', tone: 'amber'}),
  base({id: 'ordinary-022-final-loop', start: 723.6, end: 760.6, spokenLine: '如果想改善工作，就先完成一项真实任务的小闭环。', component: 'flow', title: '先选结果，再做小样', detail: '记录生成次数、模型费用、人工时间、返工问题和版权边界。', items: ['选结果', '做小样', '记录成本', '扩大投入前再验证'], family: 'process-rail', role: 'node', tone: 'green'}),
  base({id: 'ordinary-023-closing', start: 760.6, end: 793.32, spokenLine: '先验证创意和协作，再决定要不要烧更大的钱。', component: 'closing', title: '先把问题说清楚', detail: '我是超哥，在兰州AI创业。', items: ['工作闭环', '30—60秒样片', '再决定投入'], family: 'closing', role: 'cta', tone: 'green'}),
];

const sources = [
  'v3-chapter-sweep-a.wav', 'v3-list-tick-a.wav', 'v3-media-whoosh-a.wav', 'v1-keyword-tick.wav', 'v3-media-whoosh-b.wav', 'v2-number-affirmation.wav', 'v2-node-select.wav', 'v3-line-connect-a.wav', 'v3-soft-card-pop-a.wav', 'v2-evidence-shutter.wav', 'remotion-ui-switch.wav', 'v3-evidence-paper-a.wav', 'v2-section-sweep.wav', 'v1-card-reveal.wav', 'v3-list-tick-b.wav', 'v3-number-settle-a.wav', 'v1-node-connect.wav', 'v2-card-slide.wav', 'v2-keyword-select.wav', 'v1-confirm-soft.wav', 'v1-ui-click.wav', 'v1-section-air.wav', 'v3-cta-confirm-a.wav'];
const roles = layers.map((layer) => layer.sound.role);
const cues = layers.map((layer, index) => ({
  id: layer.sound.cueId,
  visualEventId: layer.visualEvent.id,
  role: roles[index],
  start: layer.start,
  end: layer.start + 0.35,
  source: `remotion/public/audio/koubo-sfx-v8/${sources[index]}`,
  license: 'V8本地音效审核清单已登记',
  licenseReference: 'assets/sfx/koubo-sfx-v8/manifest.json',
  volume: index % 3 === 0 ? 0.28 : 0.3,
  voiceDuckDb: 0,
  previewCovered: layer.start <= 45,
  formalReviewed: false,
  userAudibilityConfirmed: false,
}));

const plan = {
  schemaVersion: 4,
  experiment: {id: 'v8-semantic-continuity-sfx', status: 'candidate-preview-required'},
  videoId, videoTitle: title, sourceVideo, transcript, bilingualCaptions: bilingual, baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: ['v8-user-confirmed-default-20260812', 'v8-speaker-first-continuous-semantics', 'v8-generated-video-fullscreen-with-disclosure'],
  target: {aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin'},
  previewCoverage: ['hook', 'complex-overlay', 'cta', 'full-screen-asset', 'speaker-overlay', 'media-fullscreen', 'progressive-process', 'source-evidence', 'hero-emphasis', 'sfx-ab'],
  editPolicy: '完整保留真人口播原片；新增现场和AIGC画面只在对应语义段使用，原口播音轨始终保留；RunningHub价格证据按2.0与2.5分别展示，原图只读，信息卡只做确定性标注。',
  assetCoverage: {usableOriginalVideoItems: 1, assignedOriginalVideoItems: 1, generatedVideoItems: 8, assignedGeneratedVideoItems: 8, generatedStillItems: 8, allRequiredClaimsCovered: true, note: '真人原片为主画面；用户补入的现场、原创AIGC视频和价格证据按用途绑定。'},
  layers,
};
const sfx = {schemaVersion: 3, videoId, version: 'ordinary-ai-aigc-v8-preview-1', experimentId: 'v8-semantic-continuity-sfx', normalizedPack: 'assets/sfx/koubo-sfx-v8/manifest.json', cues};
const job = {
  schemaVersion: 1, jobId: '20260818-ordinary-ai-aigc-v80', videoId, title, purpose: '完整保留本人口播，用V8连续语义动效、真实工作现场、原创AIGC画面和分开的RunningHub价格证据，讲清普通人学AI与进入AIGC漫剧的第一步。', productionState: 'ready-for-production', productionProfile: {id: 'v8-semantic-continuity-sfx', version: 'V8'},
  contentApproval: {userScriptApproved: true, userApprovedAt: '2026-08-18T00:00:00+08:00', evidence: '用户此前明确锁定最终口播稿，本次提供完整真人口播原片并要求准备正式正片。'},
  experiment: {id: 'v8-semantic-continuity-sfx', status: 'candidate-preview-required', userPreviewApproved: false, userPreviewApprovedAt: null, userPreviewApprovalEvidence: null, revisionReason: '首次为本条建立V8候选预览；真人录音与锁定稿存在一处实录增补，已按原片保留并登记。', primaryVisualEventCount: layers.length, sfxCoveragePercent: 100, previewAuditionRoles: ['chapter', 'list', 'media']},
  baseline: {path: 'workflow/production-baseline.v1.json', id: 'koubo-formal-16x9-v1', revision: 'V7.2-20260730'},
  inputs: {source: sourceVideo, renderProxy: 'remotion/public/media/ordinary-ai-aigc-20260818/main-30fps.mp4', visualPlan: visualPlanPath, bilingualCaptions: bilingual, captions: 'remotion/public/data/ordinary_ai_aigc_20260818.captions.v1.json', sfxCueSheet: sfxCuePath, sfxManifest: 'assets/sfx/koubo-sfx-v8/manifest.json', userAssetExecutionSheet: userSheet, fingerprintPaths: [sourceVideo, 'remotion/public/media/ordinary-ai-aigc-20260818/main-30fps.mp4', transcript, bilingual, 'remotion/public/data/ordinary_ai_aigc_20260818.captions.v1.json', visualPlanPath, sfxCuePath, runtimePlanPath, runtimeSfxPath, 'remotion/src/OrdinaryAiAigcV80Talk16x9.tsx', 'remotion/src/components/V8SemanticStage.tsx', 'remotion/src/components/V72ProductionShell.tsx', 'remotion/src/Root.tsx', 'remotion/public/audio/koubo-sfx-v8']},
  remotion: {root: 'remotion', entry: 'src/index.ts', compositionWithSfx: 'OrdinaryAiAigc16x9-V80-WithSfx', compositionWithoutSfx: 'OrdinaryAiAigc16x9-V80-NoSfx', durationSeconds: 793.32, fps: 30, width: 1920, height: 1080, concurrency: 4},
  preview: {enabled: true, withSfxOnly: false, scale: 0.5, crf: 22, ranges: [{id: 'ordinary-ai-aigc-hook-and-media-45s', startSeconds: 0, endSeconds: 45}], output: 'work/production-runs/20260818-ordinary-ai-aigc-v80/preview45/with-sfx.mp4', renderWithoutSfxComparison: true},
  riskFrames: {enabled: true, source: 'visual-plan-reviewAt', fullResolution: true, outputDirectory: 'work/production-runs/20260818-ordinary-ai-aigc-v80/preview45/risk-frames'},
  audioPreflight: {enabled: true, source: 'preview', integratedLoudnessTargetLufs: -16, truePeakMaxDbtp: -1.5, preferredTruePeakDbtp: -1.8},
  formal: {enabled: false, composition: 'with-sfx', blockedReason: '等待用户观看同画面30—45秒V8预览并确认有音效/无音效版本。', crf: 18, pixelFormat: 'yuv420p', audioCodec: 'aac', audioBitrate: '192k', rawOutput: 'work/production-runs/20260818-ordinary-ai-aigc-v80/formal/formal-raw.mp4', finalOutput: 'outputs/普通人学AI与AIGC漫剧入门_16x9_V80_有音效_候选成片_v1.mp4', loudness: {enabled: true, integratedLoudnessTargetLufs: -16, loudnessRangeTargetLu: 11, truePeakTargetDbtp: -2.2}},
  cache: {enabled: true, directory: 'work/production-cache', reuseOnlyOnExactFingerprint: true},
  reports: {runManifest: 'work/production-runs/20260818-ordinary-ai-aigc-v80/run-manifest.json', timingReport: 'work/production-runs/20260818-ordinary-ai-aigc-v80/timing-report.json', regressionReport: 'work/production-runs/20260818-ordinary-ai-aigc-v80/regression-report.json'},
};

for (const [file, value] of [[visualPlanPath, plan], [runtimePlanPath, plan], [sfxCuePath, sfx], [runtimeSfxPath, sfx], [jobPath, job]]) {
  const absolute = path.resolve(root, file);
  fs.mkdirSync(path.dirname(absolute), {recursive: true});
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify({videoId, layers: layers.length, cues: cues.length, jobPath, visualPlanPath, sfxCuePath}, null, 2));
