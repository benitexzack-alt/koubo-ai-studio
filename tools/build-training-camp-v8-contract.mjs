import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const videoId = 'TRAINING_CAMP_20260811_talk01';
const durationSeconds = 279.4;
const experimentId = 'v8-semantic-continuity-sfx';
const previewStart = 119;
const previewEnd = 164;
const editRoot = 'edit/20260811_training_camp';
const mediaRoot = 'remotion/public/media/training-camp-20260811';
const sourceVideo =
  'source/20260811_training_camp/copy_B33B0DA5-B1F9-4F4F-A313-55AAF01A5424.MOV';
const talkProxy =
  `${mediaRoot}/talk/TRAINING_CAMP_20260811_talk01_corrected_16x9_h264.mp4`;
const captions =
  'remotion/public/data/TRAINING_CAMP_20260811_talk01.bilingual.v1.json';
const runtimePlan = 'remotion/src/data/TrainingCampV80.visual-plan.v1.json';
const runtimeSfx = 'remotion/src/data/TrainingCampV80.sfx.v1.json';
const editPlan = `${editRoot}/visual-plan_TRAINING_CAMP_20260811_talk01_v8.json`;
const editSfx = `${editRoot}/sfx-cue-sheet_TRAINING_CAMP_20260811_talk01_v8.json`;
const jobPath = 'workflow/jobs/20260811_training_camp_v80.production.json';
const broll = (name) => `${mediaRoot}/broll/${name}`;

const media = {
  classroom: broll('DJI_20260810090645_0004_D_1080p30_h264.mp4'),
  handbook: broll('IMG_2142_1080p30_h264.mp4'),
  opening: broll('DJI_20260810090332_0002_D_1080p30_h264.mp4'),
  aiClass: broll('IMG_5042_1080p30_h264.mp4'),
  xinchuang: broll('DJI_20260810095935_0022_D_1080p30_h264.mp4'),
  workshop: broll('DJI_20260810100121_0023_D_1080p30_h264.mp4'),
};

const sceneSpecs = [
  {start: 0.2, end: 4.2, component: 'statement', family: 'direct-statement', role: 'keyword', title: 'AI和信创，离你还远吗？', detail: '先从甘肃本地企业每天正在做的工作出发。', items: ['算力', '信创', '人工智能']},
  {start: 4.2, end: 10, component: 'real-media', family: 'annotated-media', role: 'media', title: '50名创业者和从业者', detail: '带着电脑坐进同一间教室，训练仍在进行。', items: [], src: media.classroom, disclosure: '兰州现场实拍 · 开营阶段', badge: '现场资料 · 辅助画面', mediaScale: 1.62, mediaTransformOrigin: '50% 0%'},
  {start: 10, end: 17, component: 'question-grid', family: 'question-list', role: 'list', title: '先把问题说清楚', detail: '工具之前，先找出工作中的真实卡点。', items: ['哪一步最费时间？', '资料放在哪里？', 'AI做错谁能看出来？']},
  {start: 17, end: 24, component: 'source-branches', family: 'source-branches', role: 'evidence', title: '一个问题，三处要说清', detail: '工作、资料和验收，缺一项都容易停在概念里。', items: ['工作步骤', '可用资料', '结果验收']},
  {start: 24, end: 29, component: 'flow', family: 'process-rail', role: 'line', title: '一天怎么练', detail: '这是课程安排，不提前说成全部完成。', items: ['早上听课', '下午动手', '晚上作业']},
  {start: 29, end: 41, component: 'real-media', family: 'annotated-media', role: 'media', title: '创业能力提升训练营', detail: '主题、时间与流程以现场资料为准。', items: [], src: media.handbook, disclosure: '现场资料 · 8月9日至15日', badge: '课程进行中 · 非结业复盘', mediaScale: 1.38, mediaTransformOrigin: 'center top'},
  {start: 41, end: 55, component: 'timeline', family: 'process-rail', role: 'line', title: '这条视频分两集', detail: '第一集记录开始，第二集再交真实结果。', items: ['开营与前期课程', '后续课程和研学', '结束后复盘验证']},
  {start: 55, end: 68, component: 'real-media', family: 'annotated-media', role: 'media', title: '实操 · 应用 · 协同', detail: '开营讲话反复强调把工具放进创业和工作。', items: [], src: media.opening, disclosure: '开营现场实拍 · 不补未核实身份', badge: '现场讲话 · 辅助证据', mediaScale: 1.45, mediaTransformOrigin: '48% 0%'},
  {start: 68, end: 78, component: 'definition', family: 'hero-definition', role: 'number', title: '算力是基础，不是结果', detail: '基础设施已经存在，但不会自动进入一家企业。', items: []},
  {start: 78, end: 87, component: 'flow', family: 'process-rail', role: 'line', title: '从算力走进企业', detail: '中间还需要把真实工作接到工具上。', items: ['听懂工作', '找到资料', '接入工具', '检查结果']},
  {start: 87, end: 97, component: 'layer-map', family: 'activated-node-map', role: 'node', title: '缺的不是一个按钮', detail: '企业的流程、资料、责任共同决定AI能不能用。', items: ['流程写清', '资料可用', '责任明确', '结果可复核']},
  {start: 97, end: 106, component: 'real-media', family: 'annotated-media', role: 'media', title: '不会提需求，是常见卡点', detail: '课堂观察只说明真实现象，不外推成行业统计。', items: [], src: media.aiClass, disclosure: 'AI课程现场实拍', badge: '课堂观察 · 非统计结论', mediaScale: 1.42, mediaTransformOrigin: '50% 0%'},
  {start: 106, end: 119, component: 'comparison', family: 'comparison-bars', role: 'comparison', title: '选工具之前，先补三件事', detail: '很多企业还没有走到“选哪个AI工具”这一步。', items: ['工作没写清', '资料散在人手里', '出错没人验收']},
  {start: 119, end: 129, component: 'real-media', family: 'annotated-media', role: 'media', title: '信创不只是换电脑', detail: '本段只解释工作范围，不承诺现成项目。', items: [], src: media.xinchuang, disclosure: '信创课程现场实拍', badge: '真实课程 · 课程进行中', mediaScale: 1.62, mediaTransformOrigin: '50% 0%'},
  {start: 129, end: 137, component: 'flow', family: 'process-rail', role: 'line', title: '信创会碰到什么', detail: '一项系统变化会带来连续的责任链。', items: ['应用开发', '系统迁移', '兼容适配', '数据安全']},
  {start: 137, end: 149, component: 'definition', family: 'hero-definition', role: 'number', title: '最后还要有人负责', detail: '运维、售后和结果责任不能只留在概念里。', items: []},
  {start: 149, end: 158, component: 'question-grid', family: 'question-list', role: 'list', title: '四问卡 · 前两问', detail: '拿自己的一项真实工作来对照。', items: ['哪一步最耗时间且每天重复？', '需要哪些资料，现在能拿出来吗？']},
  {start: 158, end: 174, component: 'question-grid', family: 'question-list', role: 'list', title: '四问卡 · 后两问', detail: '问清验收责任和国产化边界。', items: ['AI做错谁能看出来，谁负责？', '有国产系统、安全或适配要求吗？']},
  {start: 174, end: 188, component: 'flow', family: 'process-rail', role: 'line', title: '四个答案，分三条路', detail: '不是一上来都做AI项目。', items: ['先补数字化基础', '做一个小AI测试', '找专业团队配合']},
  {start: 188, end: 203, component: 'comparison', family: 'comparison-bars', role: 'comparison', title: '先判断，再行动', detail: '任务越清楚、资料越可用，测试成本越可控。', items: ['流程资料都不清楚', '任务明确且有人验收', '涉及迁移安全适配']},
  {start: 203, end: 217, component: 'real-media', family: 'annotated-media', role: 'media', title: '四问卡不替你找项目', detail: '它只帮助你少走一步错路；本段同时自然覆盖口误微剪。', items: [], src: media.workshop, disclosure: '训练现场实拍 · 四问自查', badge: '现场资料 · 辅助画面', mediaScale: 1.5, mediaTransformOrigin: '50% 0%'},
  {start: 217, end: 240, component: 'layer-map', family: 'activated-node-map', role: 'node', title: '我现在能做什么', detail: '不把自己包装成信创专家，从可复核的小结果开始。', items: ['把问题说清', '整理资料流程', '搭知识库或工作流', '交付可复核结果']},
  {start: 240, end: 247, component: 'statement', family: 'direct-statement', role: 'keyword', title: '专业适配，专业团队负责', detail: '我负责把需求讲明白，再和能承担责任的团队协作。', items: ['不硬扛', '讲清需求', '责任协同']},
  {start: 247, end: 254, component: 'definition', family: 'hero-definition', role: 'keyword', title: '现在不能急着下结论', detail: '课程和研学尚未全部结束，结果留到第二集验证。', items: []},
  {start: 254, end: 267, component: 'timeline', family: 'process-rail', role: 'line', title: '第二集拿结果交作业', detail: '只讲实际看到和能够验证的部分。', items: ['实际学到什么', '研学现场看到什么', '哪些能用', '哪些继续验证']},
  {start: 267, end: 279.4, component: 'closing', family: 'closing-signature', role: 'confirm', title: '拿一项工作过四问', detail: '最卡的是哪一步，留在评论区。', items: []},
];

const coverageByFamily = {
  'direct-statement': 0.28,
  'comparison-bars': 0.35,
  'process-rail': 0.38,
  'activated-node-map': 0.4,
  'hero-definition': 0.28,
  'question-list': 0.38,
  'source-branches': 0.41,
  'annotated-media': 1,
  'closing-signature': 0.26,
};
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
const manifest = JSON.parse(
  readFileSync(path.join(projectRoot, 'assets/sfx/koubo-sfx-v8/manifest.json'), 'utf8'),
);
const manifestByOutput = new Map(manifest.items.map((item) => [item.output, item]));
const sourceUse = new Map();
const sourceCount = new Map();
const pickSource = (role, start) => {
  const candidates = roleFiles[role].map(
    (file) => `remotion/public/audio/koubo-sfx-v8/${file}`,
  );
  const source = candidates
    .filter((candidate) => start - (sourceUse.get(candidate) ?? -Infinity) >= 25)
    .filter((candidate) => (sourceCount.get(candidate) ?? 0) < 3)
    .sort((left, right) => {
      const count = (sourceCount.get(left) ?? 0) - (sourceCount.get(right) ?? 0);
      return count || (sourceUse.get(left) ?? -Infinity) - (sourceUse.get(right) ?? -Infinity);
    })[0];
  if (!source) throw new Error(`${role}在${start.toFixed(2)}秒没有合规音效。`);
  sourceUse.set(source, start);
  sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
  return source;
};

const layers = sceneSpecs.map((scene, index) => {
  const mediaLayer = Boolean(scene.src);
  const order = String(index + 1).padStart(3, '0');
  const eventId = `camp8-v${order}`;
  const cueId = `camp8-sfx-${order}`;
  return {
    id: `camp-${order}-${scene.component}`,
    start: scene.start,
    end: scene.end,
    spokenLine: scene.title,
    purpose: mediaLayer ? 'real-scene-evidence' : 'semantic-emphasis',
    kind: mediaLayer ? 'full-screen-asset' : 'transparent-semantic-information',
    variant: scene.component,
    titleOwner: true,
    overlapGroup: `camp-v${order}`,
    zone: mediaLayer ? 'full-screen' : 'left-safe',
    title: scene.title,
    detail: scene.detail,
    items: scene.items,
    asset: mediaLayer
      ? {sourceType: 'user-owned-real-video', source: scene.src}
      : {sourceType: 'remotion-component', source: `TrainingCampV80/${scene.family}`},
    assetDecision: mediaLayer
      ? {class: 'real-evidence', producer: 'existing', requestId: null, fallback: 'speaker-plus-information'}
      : {class: 'remotion-information', producer: 'codex-remotion', requestId: null, fallback: 'speaker-plus-information'},
    visualEvent: {id: eventId, enterAt: scene.start, primary: true},
    sound: {policy: 'required', role: scene.role, cueId, offsetFrames: 0, maxSyncErrorFrames: 2},
    params: {
      component: scene.component,
      title: scene.title,
      detail: scene.detail,
      items: scene.items,
      ...(scene.src ? {src: scene.src.replace(/^remotion\/public\//, '')} : {}),
      ...(scene.disclosure ? {disclosure: scene.disclosure} : {}),
      ...(scene.badge ? {badge: scene.badge} : {}),
      ...(scene.privacyMasks ? {privacyMasks: scene.privacyMasks} : {}),
      ...(scene.mediaScale ? {mediaScale: scene.mediaScale} : {}),
      ...(scene.mediaTransformOrigin ? {mediaTransformOrigin: scene.mediaTransformOrigin} : {}),
    },
    checks: {
      avoidFace: !mediaLayer,
      avoidHands: !mediaLayer,
      avoidSubtitle: true,
      needsFrameReview: true,
      continuousReviewIntervalSeconds: mediaLayer ? null : 0.5,
      reviewAt: Number(((scene.start + scene.end) / 2).toFixed(2)),
    },
    background: mediaLayer ? 'opaque' : 'talk',
    presentation: {
      renderMode: mediaLayer ? 'media-fullscreen' : 'speaker-overlay',
      semanticFamily: scene.family,
      coverageRatio: coverageByFamily[scene.family],
      progressiveReveal: true,
    },
  };
});

const plan = {
  schemaVersion: 4,
  experiment: {id: experimentId, status: 'candidate-preview-required'},
  videoId,
  videoTitle: '在甘肃做企业，AI和信创离你到底有多远？',
  sourceVideo,
  transcript: `${editRoot}/transcripts/TRAINING_CAMP_20260811_talk01.cleaned.v1.json`,
  bilingualCaptions: captions,
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: ['v8-user-confirmed-default-20260811', 'v8-speaker-first-continuous-semantics', 'training-camp-user-owned-real-media'],
  target: {aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin'},
  previewCoverage: ['hook', 'complex-overlay', 'cta', 'full-screen-asset', 'speaker-overlay', 'media-fullscreen', 'progressive-process', 'source-evidence', 'hero-emphasis', 'sfx-ab'],
  editPolicy: '完整保留自然口播，只删除211.28至211.56秒口误中多说的一个“会”；203至217秒真实现场媒体覆盖微剪。渲染兼容副本已对可读姓名席卡做局部隐私模糊。',
  assetCoverage: {usableOriginalVideoItems: 11, assignedOriginalVideoItems: 6, generatedVideoItems: 0, generatedStillItems: 0, allRequiredClaimsCovered: true, note: '现有现场实拍足够，不需要额外生成AI视频或图片。'},
  layers,
};

const cues = layers.map((layer) => {
  const start = layer.visualEvent.enterAt;
  const source = pickSource(layer.sound.role, start);
  const item = manifestByOutput.get(source);
  if (!item || item.eligibleForSfx !== true) throw new Error(`音效未获准：${source}`);
  return {
    id: layer.sound.cueId,
    visualEventId: layer.visualEvent.id,
    role: layer.sound.role,
    start,
    end: start + Math.min(1.4, item.durationSeconds),
    source,
    license: item.license,
    licenseReference: item.licenseReference,
    volume: volumeByRole[layer.sound.role],
    voiceDuckDb: 0,
    previewCovered: start >= previewStart && start <= previewEnd,
    formalReviewed: false,
    userAudibilityConfirmed: false,
  };
});
const cueSheet = {
  schemaVersion: 3,
  videoId,
  version: 'v8-training-camp-preview-1',
  experimentId,
  normalizedPack: 'assets/sfx/koubo-sfx-v8/manifest.json',
  cues,
  coverageReview: {primaryVisualEventCount: layers.length, coveredPrimaryVisualEventCount: cues.length, coveragePercent: 100, maxSyncErrorFrames: 2, machineStatus: 'pending-validator', userAudibilityConfirmed: false, confirmationScope: 'not-confirmed'},
};

const job = {
  schemaVersion: 1,
  jobId: '20260811-training-camp-v80-preview',
  videoId,
  title: '在甘肃做企业，AI和信创离你到底有多远？',
  purpose: '以本人横屏口播为主，按V8连续语义规范使用训练营真实现场视频和四问分流卡；课程与研学结果留待第二集验证。',
  productionState: 'ready-for-production',
  productionProfile: {id: experimentId, version: 'V8'},
  experiment: {id: experimentId, status: 'candidate-preview-required', userPreviewApproved: false, userPreviewApprovedAt: null, primaryVisualEventCount: layers.length, sfxCoveragePercent: 100, previewAuditionRoles: ['media', 'line', 'number', 'list']},
  baseline: {path: 'workflow/production-baseline.v1.json', id: 'koubo-formal-16x9-v1', revision: 'V7.2-20260730'},
  inputs: {
    source: sourceVideo,
    renderProxy: talkProxy,
    visualPlan: editPlan,
    bilingualCaptions: captions,
    sfxCueSheet: editSfx,
    sfxManifest: 'assets/sfx/koubo-sfx-v8/manifest.json',
    fingerprintPaths: [sourceVideo, `${editRoot}/edl_TRAINING_CAMP_20260811_talk01_v1.json`, talkProxy, `${mediaRoot}/broll`, captions, 'remotion/src/Root.tsx', 'remotion/src/TrainingCampV80Talk16x9.tsx', 'remotion/src/components/V8SemanticStage.tsx', 'remotion/src/components/V72ProductionShell.tsx', runtimePlan, runtimeSfx, editPlan, editSfx, 'remotion/public/audio/koubo-sfx-v8', 'assets/sfx/koubo-sfx-v8/manifest.json'],
  },
  remotion: {root: 'remotion', entry: 'src/index.ts', compositionWithSfx: 'TrainingCamp16x9-V80-WithSfx', compositionWithoutSfx: 'TrainingCamp16x9-V80-NoSfx', durationSeconds, fps: 30, width: 1920, height: 1080, concurrency: 3},
  preview: {enabled: true, withSfxOnly: false, scale: 0.5, crf: 22, ranges: [{id: 'v8-continuous-xinchuang-four-questions', startSeconds: previewStart, endSeconds: previewEnd}], output: 'work/production-runs/20260811-training-camp-v80/preview-with-sfx.mp4', renderWithoutSfxComparison: true},
  riskFrames: {enabled: true, source: 'visual-plan-reviewAt', fullResolution: true, outputDirectory: 'work/production-runs/20260811-training-camp-v80/risk-frames'},
  audioPreflight: {enabled: true, source: 'preview', integratedLoudnessTargetLufs: -16, truePeakMaxDbtp: -1.5, preferredTruePeakDbtp: -1.8},
  formal: {enabled: false, composition: 'with-sfx', blockedReason: '等待用户确认V8同画面有声/无声动态预览。', crf: 18, pixelFormat: 'yuv420p', audioCodec: 'aac', audioBitrate: '192k', rawOutput: 'work/production-runs/20260811-training-camp-v80/formal-raw.mp4', finalOutput: 'outputs/创业能力提升训练营第一集_16x9_V80_正式成片_v1.mp4', loudness: {enabled: true, integratedLoudnessTargetLufs: -16, loudnessRangeTargetLu: 11, truePeakTargetDbtp: -2.2}},
  cache: {enabled: true, directory: 'work/production-cache', reuseOnlyOnExactFingerprint: true},
  reports: {runManifest: 'work/production-runs/20260811-training-camp-v80/run-manifest.json', timingReport: 'work/production-runs/20260811-training-camp-v80/timing-report.json', regressionReport: 'work/production-runs/20260811-training-camp-v80/regression-report.json'},
};

for (const [target, value] of [[runtimePlan, plan], [runtimeSfx, cueSheet], [editPlan, plan], [editSfx, cueSheet], [jobPath, job]]) {
  const absolute = path.join(projectRoot, target);
  mkdirSync(path.dirname(absolute), {recursive: true});
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(target);
}
console.log(`V8训练营视觉事件：${layers.length}`);
console.log(`V8训练营音效点：${cues.length}`);
console.log(`实际音效文件：${new Set(cues.map((cue) => cue.source)).size}`);
