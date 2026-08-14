import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const videoId = 'TRAINING_CAMP_EP2_20260814_talk01';
const durationSeconds = 365.833333;
const experimentId = 'v8-semantic-continuity-sfx';
const previewStart = 0;
const previewEnd = 41;
const mediaRoot = 'remotion/public/media/training-camp-ep2';
const sourceVideo = 'source/20260814_training_camp_ep2/TRAINING_CAMP_EP2_talk01_16x9.MOV';
const talkProxy = `${mediaRoot}/talk/talk01.mp4`;
const captions = 'remotion/public/data/TRAINING_CAMP_EP2_talk01.bilingual.v1.json';
const cleanedTranscript = 'edit/transcripts/20260814_training_camp_ep2/TRAINING_CAMP_EP2_talk01.cleaned.v1.json';
const runtimePlan = 'remotion/src/data/TrainingCampEpisode2V80.visual-plan.v1.json';
const runtimeSfx = 'remotion/src/data/TrainingCampEpisode2V80.sfx.v1.json';
const editPlan = 'edit/20260814_training_camp_episode2/visual-plan_TRAINING_CAMP_EP2_v8.json';
const editSfx = 'edit/20260814_training_camp_episode2/sfx-cue-sheet_TRAINING_CAMP_EP2_v8.json';
const jobPath = 'workflow/jobs/20260814_training_camp_episode2_v80.production.json';
const media = (group, name) => `${mediaRoot}/${group}/${name}.mp4`;

const sceneSpecs = [
  {start: 0, end: 4, component: 'statement', family: 'direct-statement', role: 'keyword', title: '国产AI芯片追到哪一步', detail: '从真实产品、服务器和应用生态来判断。', items: ['国产AI芯片', '英伟达']},
  {start: 4, end: 10.5, component: 'real-media', family: 'annotated-media', role: 'media', title: '训练营最后一天', detail: '把第一集留下的问题，用五天课程和两次参访来回答。', clips: [{src: media('training', 'B01'), durationSeconds: 6.5}], disclosure: '创业能力提升训练营 · 现场资料', badge: '真实现场 · 辅助画面', mediaScale: 1.03},
  {start: 10.5, end: 19, component: 'real-media', family: 'annotated-media', role: 'media', title: '第一站 · 兰州市信创产业园', detail: '参访甘肃省信创适配基地和制造测试现场。', clips: [{src: media('manufacturing', 'A01'), durationSeconds: 4}, {src: media('manufacturing', 'A13'), durationSeconds: 4.5}], disclosure: '兰州信创产业园 · 现场实拍', badge: '企业参访 · 真实素材', mediaScale: 1.02},
  {start: 19, end: 27, component: 'real-media', family: 'chip-evidence-media', role: 'media', title: '海光DCU对标A100', detail: '现场讲解口径约八成；具体结果随型号、任务和软件环境变化。', clips: [{src: media('manufacturing', 'A04'), durationSeconds: 4}, {src: media('manufacturing', 'A05'), durationSeconds: 4}], disclosure: '海光芯片 · 现场实拍', badge: '现场讲解口径 · 非统一跑分', mediaScale: 1.04},
  {start: 27, end: 35, component: 'definition', family: 'hero-definition', role: 'number', title: '约八成', detail: '重点不只是一个数，而是国产算力已经进入真实产品和应用场景。', items: []},
  {start: 35, end: 44, component: 'flow', family: 'process-rail', role: 'line', title: '竞争已经进入全链条', detail: '从芯片一直走到企业最终能够使用。', items: ['芯片', '整机制造', '软件生态', '行业交付']},
  {start: 44, end: 52, component: 'real-media', family: 'annotated-media', role: 'media', title: '海光生态与产品矩阵', detail: '芯片能力需要整机、软件和伙伴生态共同接住。', clips: [{src: media('manufacturing', 'A02'), durationSeconds: 4}, {src: media('manufacturing', 'A08'), durationSeconds: 4}], disclosure: '海光生态展示 · 现场实拍', badge: '真实展示 · 不外推全部合作', mediaScale: 1.03},
  {start: 52, end: 62, component: 'real-media', family: 'annotated-media', role: 'media', title: '兰州本地已经有产业入口', detail: '服务器产线、适配中心和数据园区已经出现。', clips: [{src: media('manufacturing', 'A03'), durationSeconds: 5}, {src: media('manufacturing', 'A10'), durationSeconds: 5}], disclosure: '海光产业生态适配中心 · 现场实拍', badge: '现场名称 · 不扩大授权关系', mediaScale: 1.03},
  {start: 62, end: 70, component: 'question-grid', family: 'question-list', role: 'list', title: '为什么还串不成项目', detail: '产业能力不会自动变成一家企业能用的结果。', items: ['芯片有了', '产线有了', '数据园区有了', '谁把它们接起来？']},
  {start: 70, end: 81, component: 'definition', family: 'hero-definition', role: 'keyword', title: '责任链条', detail: '这是五天训练带走的核心答案。', items: []},
  {start: 81, end: 92, component: 'layer-map', family: 'activated-node-map', role: 'node', title: '五个责任节点', detail: '每一项都必须有人接住。', items: ['业务翻译', '数据边界', '流程验证', '验收交付', '长期维护']},
  {start: 92, end: 103.8, component: 'real-media', family: 'annotated-media', role: 'media', title: '服务器不是装完就结束', detail: '制造与测试是一整套连续交付流程。', clips: [{src: media('manufacturing', 'A06'), durationSeconds: 5.8}, {src: media('manufacturing', 'A07'), durationSeconds: 6}], disclosure: '服务器制造测试区 · 现场实拍', badge: '工序展示 · 不代表满产', mediaScale: 1.02},
  {start: 103.8, end: 107.6, component: 'real-media', family: 'annotated-media', role: 'media', title: '适配还要落到系统上', detail: '驱动、系统和软件都要经过真实环境验证。', clips: [{src: media('manufacturing', 'A09'), durationSeconds: 3.8}], disclosure: '国产工作站演示 · 现场实拍', badge: '现场演示 · 不代表全部兼容', mediaScale: 1.02},
  {start: 107.6, end: 116, component: 'flow', family: 'process-rail', role: 'line', title: '服务器交付六道关', detail: '芯片装进机箱只是第一步。', items: ['装配', '前测', '老化', '复检', '系统安装', '包装入库']},
  {start: 116, end: 134, component: 'real-media', family: 'annotated-media', role: 'evidence', title: '第二站 · 永新国信数据要素产业园', detail: '看数据如何从资料变成可用、可追溯的生产资料。', clips: [{src: media('data-park', 'D01'), durationSeconds: 6}, {src: media('data-park', 'D02'), durationSeconds: 5}, {src: media('data-park', 'D03'), durationSeconds: 7}], disclosure: '永新国信数据要素产业园 · 现场实拍', badge: '真实园区 · 新增素材', mediaScale: 1.02},
  {start: 134, end: 147, component: 'real-media', family: 'annotated-media', role: 'media', title: '数据要素不是直接“喂给AI”', detail: '采集、授权、评估、安全和追溯缺一不可。', clips: [{src: media('data-park', 'D04'), durationSeconds: 4}, {src: media('data-park', 'D05'), durationSeconds: 4}, {src: media('data-park', 'D06'), durationSeconds: 5}], disclosure: '数据流转讲解 · 现场实拍', badge: '真实讲解 · 不展示敏感数据', mediaScale: 1.02},
  {start: 147, end: 160, component: 'question-grid', family: 'question-list', role: 'list', title: '企业资料能不能直接用', detail: '先回答版本、权限、脱敏和退回机制。', items: ['哪个版本有效？', '谁有权查看？', '哪些能进模型？', '错误怎么退回？']},
  {start: 160, end: 178, component: 'layer-map', family: 'activated-node-map', role: 'node', title: '完整责任链', detail: '服务器再强、模型再新，也不能替代这些责任。', items: ['业务场景', '数据权限', '流程接入', '错误接管', '结果验收']},
  {start: 178, end: 193, component: 'real-media', family: 'annotated-media', role: 'media', title: '课程其实在追问同一件事', detail: '知识、权利、流程和市场需求必须放进一个项目里。', clips: [{src: media('training', 'B02'), durationSeconds: 7}, {src: media('training', 'B03'), durationSeconds: 8}], disclosure: '训练营课程 · 现场实拍', badge: '课程环境 · 辅助画面', mediaScale: 1.04},
  {start: 193, end: 206, component: 'source-branches', family: 'source-branches', role: 'evidence', title: '四门课，四个共同问题', detail: '它们最终都要落到一家企业的责任链里。', items: ['知识库：拿什么做', '知识产权：有没有权做', 'AI落地：做进哪段业务', '营销AIGC：谁真正需要']},
  {start: 206, end: 218, component: 'question-grid', family: 'question-list', role: 'list', title: '项目先回答四问', detail: '不是先争论用哪个工具。', items: ['拿什么做？', '有没有权做？', '做进哪段业务？', '最后谁验收？']},
  {start: 218, end: 231, component: 'comparison', family: 'comparison-bars', role: 'comparison', title: '企业和服务方各有责任', detail: '需求、资料、流程和验收不能互相推给对方。', items: ['企业：问题与合格标准', '服务方：流程与可检验结果']},
  {start: 231, end: 246, component: 'flow', family: 'process-rail', role: 'line', title: '先做一个小范围验证', detail: '再把系统、人员和合作方逐步串起来。', items: ['业务需求', '小范围数据', '可检查结果', '系统与人员']},
  {start: 246, end: 261, component: 'real-media', family: 'annotated-media', role: 'media', title: '专业部分必须有人承担', detail: '迁移、适配、合规和运维要交给能测试、能售后的团队。', clips: [{src: media('manufacturing', 'A11'), durationSeconds: 7.2}, {src: media('manufacturing', 'A12'), durationSeconds: 7}], disclosure: '服务与参访现场 · 真实素材', badge: '协作证据 · 授权另行核验', mediaScale: 1.02},
  {start: 261, end: 270, component: 'statement', family: 'direct-statement', role: 'keyword', title: '协作不等于责任悬空', detail: '每一次交接，都要有具体的人把责任接住。', items: ['责任接力', '明确到人']},
  {start: 270, end: 291, component: 'question-grid', family: 'question-list', role: 'list', title: '给项目写一条责任链', detail: '把五个责任人真正写出来。', items: ['业务结果：谁提出', '数据权限：谁批准', 'AI流程：谁搭建', '系统出错：谁接管', '验收维护：谁负责']},
  {start: 291, end: 298, component: 'definition', family: 'hero-definition', role: 'number', title: '“到时候再说”', detail: '只要还有一格这样写，项目就没有真正准备好。', items: []},
  {start: 298, end: 311, component: 'flow', family: 'process-rail', role: 'line', title: '第一集的答案', detail: 'AI进入企业后，四件事必须完整连在一起。', items: ['场景', '数据', '流程', '责任']},
  {start: 311, end: 320, component: 'layer-map', family: 'activated-node-map', role: 'node', title: '兰州已经出现真实产业入口', detail: '前面的真实现场共同支撑这一判断，不重复播放同一镜头。', items: ['国产芯片生态', '制造测试', '数据服务', '落地培训']},
  {start: 320, end: 334, component: 'flow', family: 'process-rail', role: 'line', title: '我继续做的事', detail: '先陪本地企业把一项工作捋清楚。', items: ['业务问题', '资料边界', '流程标准', '验收条件']},
  {start: 334, end: 343, component: 'statement', family: 'direct-statement', role: 'keyword', title: '先交付一个小结果', detail: '专业适配和长期运维，再与能负责的团队协作。', items: ['能落地', '能检查']},
  {start: 343, end: 365.833333, component: 'closing', family: 'closing-signature', role: 'confirm', title: '你最缺哪个责任人', detail: '把空着的那一格留在评论区，后面用真实项目继续拆解。', items: []},
];

const coverageByFamily = {'direct-statement': 0.28, 'comparison-bars': 0.35, 'process-rail': 0.38, 'activated-node-map': 0.4, 'hero-definition': 0.28, 'question-list': 0.38, 'source-branches': 0.41, 'annotated-media': 1, 'chip-evidence-media': 1, 'closing-signature': 0.26};
const roleFiles = {
  keyword: ['v1-keyword-tick.wav', 'v2-keyword-select.wav', 'v3-soft-card-pop-a.wav', 'v3-soft-card-pop-b.wav', 'waic-card-pop.wav'],
  comparison: ['remotion-ui-switch.wav', 'v2-card-slide.wav', 'v1-card-reveal.wav', 'v1-ui-click.wav'],
  line: ['v1-node-connect.wav', 'v2-node-select.wav', 'v3-line-connect-a.wav', 'waic-node-connect.wav', 'remotion-whoosh.wav'],
  node: ['waic-node-connect.wav', 'v3-line-connect-a.wav', 'v2-node-select.wav', 'v1-node-connect.wav'],
  number: ['v2-number-affirmation.wav', 'v3-number-settle-a.wav', 'waic-thesis-impact.wav'],
  list: ['v3-list-tick-a.wav', 'v3-list-tick-b.wav', 'v1-ui-click.wav', 'v2-ui-click.wav'],
  evidence: ['v1-camera-shutter.wav', 'v2-evidence-shutter.wav', 'v3-evidence-paper-a.wav', 'remotion-page-turn.wav'],
  media: ['v3-media-whoosh-a.wav', 'v3-media-whoosh-b.wav', 'remotion-whoosh.wav', 'v2-zoom-out.wav', 'waic-section-whoosh.wav'],
  confirm: ['v1-confirm-soft.wav', 'v3-cta-confirm-a.wav', 'remotion-mouse-click.wav'],
};
const volumeByRole = {keyword: 0.34, comparison: 0.3, line: 0.28, node: 0.28, number: 0.3, list: 0.31, evidence: 0.3, media: 0.24, confirm: 0.28};
const manifest = JSON.parse(readFileSync(path.join(root, 'assets/sfx/koubo-sfx-v8/manifest.json'), 'utf8'));
const manifestByOutput = new Map(manifest.items.map((item) => [item.output, item]));
const sourceUse = new Map();
const sourceCount = new Map();
const pickSource = (role, start) => {
  const candidates = roleFiles[role].map((file) => `remotion/public/audio/koubo-sfx-v8/${file}`);
  const source = candidates
    .filter((candidate) => start - (sourceUse.get(candidate) ?? -Infinity) >= 25)
    .filter((candidate) => (sourceCount.get(candidate) ?? 0) < 3)
    .sort((left, right) => ((sourceCount.get(left) ?? 0) - (sourceCount.get(right) ?? 0)) || ((sourceUse.get(left) ?? -Infinity) - (sourceUse.get(right) ?? -Infinity)))[0];
  if (!source) throw new Error(`${role}在${start.toFixed(2)}秒没有合规音效。`);
  sourceUse.set(source, start);
  sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
  return source;
};

const layers = sceneSpecs.map((scene, index) => {
  const mediaLayer = Boolean(scene.clips?.length);
  const order = String(index + 1).padStart(3, '0');
  const eventId = `camp2-v${order}`;
  const cueId = `camp2-sfx-${order}`;
  const primaryMediaSource = scene.clips?.[0]?.src;
  return {
    id: `camp2-${order}-${scene.component}`,
    start: scene.start,
    end: scene.end,
    spokenLine: scene.title,
    purpose: mediaLayer ? 'real-scene-evidence' : 'semantic-emphasis',
    kind: mediaLayer ? 'full-screen-asset' : 'transparent-semantic-information',
    variant: scene.component,
    titleOwner: true,
    overlapGroup: `camp2-v${order}`,
    zone: mediaLayer ? 'full-screen' : 'left-safe',
    title: scene.title,
    detail: scene.detail,
    items: scene.items ?? [],
    asset: mediaLayer ? {sourceType: 'user-owned-real-video', source: primaryMediaSource} : {sourceType: 'remotion-component', source: `TrainingCampEpisode2V80/${scene.family}`},
    assetDecision: mediaLayer ? {class: 'real-evidence', producer: 'existing', requestId: null, fallback: 'speaker-plus-information'} : {class: 'remotion-information', producer: 'codex-remotion', requestId: null, fallback: 'speaker-plus-information'},
    visualEvent: {id: eventId, enterAt: scene.start, primary: true},
    sound: {policy: 'required', role: scene.role, cueId, offsetFrames: 0, maxSyncErrorFrames: 2},
    params: {
      component: scene.component,
      title: scene.title,
      detail: scene.detail,
      items: scene.items ?? [],
      ...(scene.clips ? {mediaClips: scene.clips.map((clip) => ({...clip, src: clip.src.replace(/^remotion\/public\//, '')}))} : {}),
      ...(scene.disclosure ? {disclosure: scene.disclosure} : {}),
      ...(scene.badge ? {badge: scene.badge} : {}),
      ...(scene.mediaScale ? {mediaScale: scene.mediaScale} : {}),
    },
    checks: {avoidFace: !mediaLayer, avoidHands: !mediaLayer, avoidSubtitle: true, needsFrameReview: true, continuousReviewIntervalSeconds: mediaLayer ? null : 0.5, reviewAt: Number(((scene.start + scene.end) / 2).toFixed(2))},
    background: mediaLayer ? 'opaque' : 'talk',
    presentation: {renderMode: mediaLayer ? 'media-fullscreen' : 'speaker-overlay', semanticFamily: scene.family, coverageRatio: coverageByFamily[scene.family], progressiveReveal: true},
  };
});

const plan = {
  schemaVersion: 4,
  experiment: {id: experimentId, status: 'candidate-preview-required'},
  videoId,
  videoTitle: '国产AI芯片，现在到底追到英伟达哪一步了？',
  sourceVideo,
  transcript: cleanedTranscript,
  bilingualCaptions: captions,
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: ['v8-user-confirmed-default-20260811', 'v8-speaker-first-continuous-semantics', 'training-camp-episode2-user-approved-real-media'],
  target: {aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin'},
  previewCoverage: ['hook', 'complex-overlay', 'cta', 'full-screen-asset', 'speaker-overlay', 'media-fullscreen', 'progressive-process', 'source-evidence', 'hero-emphasis', 'sfx-ab'],
  editPolicy: '用户确认全部候选视频并提供一条连续正式口播；完整保留365.8秒口播，不删句、不重排。现场视频只作短时辅助，全部静音，不循环顶替不同语义。',
  assetCoverage: {approvedOriginalVideoItems: 22, assignedOriginalVideoItems: 22, generatedVideoItems: 0, generatedStillItems: 0, allRequiredClaimsCovered: true, note: '13段信创制造、3段训练营、6段永新国信数据要素产业园素材均为用户提供或已确认真实素材；无需AI视频或生图。'},
  layers,
};

const cues = layers.map((layer) => {
  const source = pickSource(layer.sound.role, layer.visualEvent.enterAt);
  const item = manifestByOutput.get(source);
  if (!item || item.eligibleForSfx !== true) throw new Error(`音效未获准：${source}`);
  return {id: layer.sound.cueId, visualEventId: layer.visualEvent.id, role: layer.sound.role, start: layer.visualEvent.enterAt, end: layer.visualEvent.enterAt + Math.min(1.4, item.durationSeconds), source, license: item.license, licenseReference: item.licenseReference, volume: volumeByRole[layer.sound.role], voiceDuckDb: 0, previewCovered: layer.visualEvent.enterAt >= previewStart && layer.visualEvent.enterAt <= previewEnd, formalReviewed: false, userAudibilityConfirmed: false};
});
const cueSheet = {schemaVersion: 3, videoId, version: 'v8-training-camp-episode2-preview-1', experimentId, normalizedPack: 'assets/sfx/koubo-sfx-v8/manifest.json', cues, coverageReview: {primaryVisualEventCount: layers.length, coveredPrimaryVisualEventCount: cues.length, coveragePercent: 100, maxSyncErrorFrames: 2, machineStatus: 'pending-validator', userAudibilityConfirmed: false, confirmationScope: null}};

const job = {
  schemaVersion: 1,
  jobId: '20260814-training-camp-episode2-v80',
  videoId,
  title: '国产AI芯片，现在到底追到英伟达哪一步了？',
  purpose: '以本人完整口播为主，用信创制造、海光生态、永新国信数据要素产业园和训练营实拍解释企业AI项目为什么需要完整责任链。',
  productionState: 'ready-for-production',
  productionProfile: {id: experimentId, version: 'V8'},
  contentApproval: {userScriptApproved: true, userApprovedAt: '2026-08-14T19:20:00+08:00', evidence: '用户提供最终口播原文，随后上传完整真人口播并明确要求开始出成片；本条录音本身构成真人朗读证据。'},
  experiment: {id: experimentId, status: 'candidate-preview-required', userPreviewApproved: false, userPreviewApprovedAt: null, userPreviewApprovalEvidence: null, revisionReason: '首次按已确认素材生成本条V8同画面有声/无声动态预览。', primaryVisualEventCount: layers.length, sfxCoveragePercent: 100, previewAuditionRoles: ['keyword', 'media', 'number', 'line']},
  baseline: {path: 'workflow/production-baseline.v1.json', id: 'koubo-formal-16x9-v1', revision: 'V7.2-20260730'},
  inputs: {source: sourceVideo, renderProxy: talkProxy, visualPlan: editPlan, bilingualCaptions: captions, sfxCueSheet: editSfx, sfxManifest: 'assets/sfx/koubo-sfx-v8/manifest.json', fingerprintPaths: [sourceVideo, talkProxy, `${mediaRoot}/manufacturing`, `${mediaRoot}/data-park`, `${mediaRoot}/training`, cleanedTranscript, captions, 'remotion/src/Root.tsx', 'remotion/src/TrainingCampEpisode2V80Talk16x9.tsx', 'remotion/src/components/V8SemanticStage.tsx', 'remotion/src/components/V72ProductionShell.tsx', runtimePlan, runtimeSfx, editPlan, editSfx, 'remotion/public/audio/koubo-sfx-v8', 'assets/sfx/koubo-sfx-v8/manifest.json']},
  remotion: {root: 'remotion', entry: 'src/index.ts', compositionWithSfx: 'TrainingCampEpisode2-16x9-V80-WithSfx', compositionWithoutSfx: 'TrainingCampEpisode2-16x9-V80-NoSfx', durationSeconds, fps: 30, width: 1920, height: 1080, concurrency: 3},
  preview: {enabled: true, withSfxOnly: false, scale: 0.5, crf: 22, ranges: [{id: 'v8-hook-chip-industry-chain', startSeconds: previewStart, endSeconds: previewEnd}], output: 'work/production-runs/20260814-training-camp-episode2-v80/preview/preview-with-sfx.mp4', renderWithoutSfxComparison: true},
  riskFrames: {enabled: true, source: 'visual-plan-reviewAt', fullResolution: true, outputDirectory: 'work/production-runs/20260814-training-camp-episode2-v80/preview/risk-frames'},
  audioPreflight: {enabled: true, source: 'preview', integratedLoudnessTargetLufs: -16, truePeakMaxDbtp: -1.5, preferredTruePeakDbtp: -1.8},
  formal: {enabled: false, composition: 'with-sfx', blockedReason: '等待用户确认同画面V8动态预览的字幕、素材比例、运镜和音效听感。', crf: 18, pixelFormat: 'yuv420p', audioCodec: 'aac', audioBitrate: '192k', rawOutput: 'work/production-runs/20260814-training-camp-episode2-v80/formal/formal-raw.mp4', finalOutput: 'outputs/20260814_training_camp_episode2/国产AI芯片追到英伟达哪一步_16x9_V80_正式成片_v1.mp4', loudness: {enabled: true, integratedLoudnessTargetLufs: -16, loudnessRangeTargetLu: 11, truePeakTargetDbtp: -2.2}},
  cache: {enabled: true, directory: 'work/production-cache', reuseOnlyOnExactFingerprint: true},
  reports: {runManifest: 'work/production-runs/20260814-training-camp-episode2-v80/run-manifest.json', timingReport: 'work/production-runs/20260814-training-camp-episode2-v80/timing-report.json', regressionReport: 'work/production-runs/20260814-training-camp-episode2-v80/regression-report.json'},
};

for (const [target, value] of [[runtimePlan, plan], [runtimeSfx, cueSheet], [editPlan, plan], [editSfx, cueSheet], [jobPath, job]]) {
  const absolute = path.join(root, target);
  mkdirSync(path.dirname(absolute), {recursive: true});
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
  console.log(target);
}
console.log(`events=${layers.length} cues=${cues.length} sfx=${new Set(cues.map((cue) => cue.source)).size}`);
