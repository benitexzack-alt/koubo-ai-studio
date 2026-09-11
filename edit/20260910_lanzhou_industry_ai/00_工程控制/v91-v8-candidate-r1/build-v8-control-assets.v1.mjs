#!/usr/bin/env node

import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const controlDir = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/00_工程控制/v91-v8-candidate-r1',
);
const bilingualSource = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/05_实录与字幕/actual-spoken.bilingual.candidate.v1.json',
);

const videoId = 'LANZHOU_INDUSTRY_AI_20260910_V91_R1';
const title = '留在兰州做企业AI：把熟悉行业做成真实服务';
const sourceVideo =
  'edit/20260910_lanzhou_industry_ai/01_原始口播/copy_B71E2E7B-29AC-4653-AC9C-9D4A3C3D3AB6.MOV';
const publicRoot = 'remotion/public-lanzhou-industry-ai-v91-r1';
const sfxRoot = 'remotion/public/audio/koubo-sfx-v8';

const info = ({
  id,
  beatId,
  start,
  end,
  title: layerTitle,
  detail,
  items = [],
  component,
  family,
  tone,
  role,
  sound,
  purpose = 'semantic-emphasis',
}) => ({
  id,
  beatId,
  start,
  end,
  spokenLine: detail,
  purpose,
  kind: 'transparent-semantic-information',
  titleOwner: true,
  overlapGroup: id,
  zone: 'left-safe',
  title: layerTitle,
  detail,
  items,
  asset: {sourceType: 'remotion-component'},
  assetDecision: {
    class: 'remotion-information',
    producer: 'codex-remotion',
    requestId: null,
    fallback: 'speaker-only',
  },
  visualEvent: {id: `${id}-event`, enterAt: start, primary: true},
  sound: {
    policy: 'required',
    role,
    cueId: `${id}-sfx`,
    offsetFrames: 0,
    maxSyncErrorFrames: 2,
  },
  params: {component, title: layerTitle, detail, items, tone},
  checks: {
    avoidFace: true,
    avoidHands: true,
    avoidSubtitle: true,
    faceSafeRect: {x: 0.36, y: 0.08, width: 0.55, height: 0.7},
    subtitleReservedRect: {x: 0.04, y: 0.78, width: 0.92, height: 0.2},
    needsFrameReview: true,
    continuousReviewIntervalSeconds: 0.5,
    reviewAt: Number(((start + end) / 2).toFixed(3)),
  },
  background: 'talk',
  presentation: {
    renderMode: 'speaker-overlay',
    semanticFamily: family,
    coverageRatio: 0.34,
    progressiveReveal: true,
  },
  _sfxSource: `${sfxRoot}/${sound}.wav`,
  _sfxRenderSource: `sfx/${sound}.wav`,
});

const paper = ({id, beatId, start, duration, clip, title: layerTitle, detail, role, sound}) => {
  const end = Number((start + duration).toFixed(3));
  return {
    id,
    beatId,
    start,
    end,
    spokenLine: detail,
    purpose: 'concept-illustration',
    kind: 'full-screen-asset',
    titleOwner: false,
    overlapGroup: id,
    zone: 'full-screen',
    title: layerTitle,
    detail,
    items: [],
    asset: {
      sourceType: 'user-generated-video',
      source: `${publicRoot}/${clip}.mp4`,
    },
    assetDecision: {
      class: 'generated-video',
      producer: 'user',
      requestId: `20260910-r4-${clip}-${beatId}`,
      evidenceUse: 'illustration-only',
      styleReferenceId: 'paper-editorial-director-v9.1',
      fallback: 'speaker-plus-information',
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
      component: 'generated-media',
      src: `${clip}.mp4`,
      disclosure: 'AI生成·纸艺概念演绎',
      badge: '用户提供成品｜原片口播持续',
      mediaScale: 1.01,
      renderTextOverlay: false,
    },
    checks: {
      avoidFace: true,
      avoidHands: true,
      avoidSubtitle: true,
      subtitleReservedRect: {x: 0.04, y: 0.78, width: 0.92, height: 0.2},
      needsFrameReview: true,
      continuousReviewIntervalSeconds: 0.5,
      reviewAt: Number((start + Math.min(2.5, duration / 2)).toFixed(3)),
    },
    background: 'opaque',
    presentation: {
      renderMode: 'media-fullscreen',
      semanticFamily: `paper-editorial-${clip.toLowerCase()}`,
      coverageRatio: 1,
      progressiveReveal: true,
      keepCanonicalVoice: true,
      muteAssetAudio: true,
      textOverlayPolicy: 'caption-only',
    },
    postshootBinding: {
      source: 'director-postshoot-rebind-plan.v1.json',
      enterAtMs: Math.round(start * 1000),
      clipDurationSeconds: duration,
      timingPolicy: 'actual-spoken-sentence-action-leading-user-directed',
      timingRevision: '20260911-animation-rebind-r2',
    },
    _sfxSource: `${sfxRoot}/${sound}.wav`,
    _sfxRenderSource: `sfx/${sound}.wav`,
  };
};

const layers = [
  info({id: 'v91-001-b01-hook', beatId: 'B01', start: 0, end: 3.2, title: '普通人的创业风口？', detail: '这是我的判断，不是结果承诺', component: 'definition', family: 'hero-definition', tone: 'amber', role: 'chapter', sound: 'v3-chapter-sweep-a'}),
  info({id: 'v91-002-b02-local-path', beatId: 'B02', start: 3.2, end: 14.3, title: '熟悉行业 + AI', detail: '先服务本地，再尝试外地业务', items: ['本地服务', '外地尝试'], component: 'comparison', family: 'two-path-comparison', tone: 'cyan', role: 'keyword', sound: 'v1-keyword-tick'}),
  info({id: 'v91-003-b03-difference', beatId: 'B03', start: 14.3, end: 24.5, title: '差别不会自动消失', detail: '经历和交付能力，仍决定你能做到哪一步', component: 'definition', family: 'capability-anchor', tone: 'white', role: 'number', sound: 'v3-number-settle-a'}),
  info({id: 'v91-004-b04-experience', beatId: 'B04', start: 24.5, end: 32.708, title: '别把原来的经验扔掉', detail: '销售、开店、行业经验，都可以变成对客户的了解', items: ['销售', '开过店', '客户的了解'], component: 'process', family: 'experience-process', tone: 'green', role: 'list', sound: 'v3-list-tick-a'}),
  paper({id: 'v91-005-p01-b04', beatId: 'B04', start: 32.708, duration: 7.292, clip: 'P01', title: '经验留下来', detail: '销售和开店经验，汇到对客户的了解', role: 'media', sound: 'v3-media-whoosh-a'}),
  info({id: 'v91-006-b05-generic-copy', beatId: 'B05', start: 40, end: 52.1, title: '“品质好、服务好”还不够', detail: '客户看完，仍然不知道为什么选你', component: 'definition', family: 'generic-vs-specific', tone: 'red', role: 'comparison', sound: 'v2-section-sweep'}),
  info({id: 'v91-007-b06-owner-answers', beatId: 'B06', start: 52.1, end: 66, title: '先收集老板真实的回答', detail: '价格为什么不一样，谁适合，哪些确实做不到', items: ['价格差异', '适合人群', '做不到的要求'], component: 'question-grid', family: 'question-grid', tone: 'amber', role: 'node', sound: 'v1-node-connect'}),
  info({id: 'v91-008-b07-organize', beatId: 'B07', start: 66, end: 77.6, title: '把回答整理成能拍的内容', detail: '收集 → AI归类理顺 → 改成文稿 → 老板核对', items: ['收集', '归类', '改稿', '核对'], component: 'process', family: 'four-step-process', tone: 'cyan', role: 'keyword', sound: 'v3-soft-card-pop-a'}),
  paper({id: 'v91-009-p02-b07', beatId: 'B07', start: 77.6, duration: 8, clip: 'P02', title: '老板核对后再讲出去', detail: 'AI承担整理和制作，生意的底子还是老板做过的事', role: 'media', sound: 'v2-keyword-select'}),
  info({id: 'v91-010-b08-findable', beatId: 'B08', start: 85.6, end: 97.9, title: '让没进过店的人也能看到', detail: '把原来只在店里讲的经验，变成可见的介绍', component: 'definition', family: 'visibility-bridge', tone: 'green', role: 'line', sound: 'v3-line-connect-a'}),
  info({id: 'v91-011-b09-trust', beatId: 'B09', start: 97.9, end: 114, title: '不是每条都要追着爆', detail: '先看懂产品，再看见你怎么处理问题，最后才有机会进入选择', items: ['看懂产品', '看见做法', '进入选择'], component: 'process', family: 'trust-ladder', tone: 'white', role: 'chapter', sound: 'v1-card-reveal'}),
  info({id: 'v91-012-b10-service-chance', beatId: 'B10', start: 114, end: 130.116, title: '把经验讲清楚，是一种服务机会', detail: '帮老板持续做成内容，但内容不能代替真实产品和服务', component: 'comparison', family: 'service-boundary', tone: 'amber', role: 'evidence', sound: 'v2-evidence-shutter'}),
  paper({id: 'v91-013-p03-b10', beatId: 'B10', start: 130.116, duration: 6.584, clip: 'P03', title: '内容接不住空生意', detail: '没有能交给客户的产品和服务，只发内容也接不住', role: 'media', sound: 'v3-media-whoosh-b'}),
  info({id: 'v91-014-b11-remote-gap', beatId: 'B11', start: 136.7, end: 141.116, title: '先能听懂行业问题', detail: '再把约定的工作做好，才有资格介绍服务', component: 'definition', family: 'capability-gate', tone: 'cyan', role: 'number', sound: 'v2-number-affirmation'}),
  paper({id: 'v91-015-p04-b11', beatId: 'B11', start: 141.116, duration: 6.584, clip: 'P04', title: '向外地介绍服务', detail: '介绍给同样需要整理客户问题、制作产品内容的同行', role: 'media', sound: 'v1-section-air'}),
  info({id: 'v91-016-b12-remote-real', beatId: 'B12', start: 147.7, end: 165, title: '远程业务早就有了', detail: 'AI增加的是整理和制作能力；信任还得靠作品和服务', component: 'comparison', family: 'old-new-boundary', tone: 'white', role: 'list', sound: 'v3-list-tick-b'}),
  info({id: 'v91-017-b13-location', beatId: 'B13', start: 165, end: 177, title: '别只问本地有多少岗位', detail: '还可以问：我会做的事，外地有没有人需要？', component: 'question-grid', family: 'question-pivot', tone: 'amber', role: 'keyword', sound: 'v2-node-select'}),
  info({id: 'v91-018-b14-runway', beatId: 'B14', start: 177, end: 199, title: '把低成本变成试错时间', detail: '少一些搬迁和生活开支，就能多留一点时间找客户、改作品、磨合服务', items: ['找客户', '改作品', '磨合服务'], component: 'process', family: 'runway-process', tone: 'green', role: 'comparison', sound: 'v2-card-slide'}),
  info({id: 'v91-019-b15-cost', beatId: 'B15', start: 199, end: 211.116, title: '这不是零成本创业', detail: '课程、会员、调用、做图、做视频都要花钱，不适合还得继续改', items: ['学习费用', '工具调用', '制作与返工'], component: 'evidence', family: 'cost-ledger', tone: 'red', role: 'evidence', sound: 'v1-camera-shutter'}),
  paper({id: 'v91-020-p05-b15', beatId: 'B15', start: 211.116, duration: 6.584, clip: 'P05', title: '钱花少一些，多试几次', detail: '少花钱不等于零成本，只是多一点试错空间', role: 'media', sound: 'v2-ui-click'}),
  info({id: 'v91-021-b17-scope', beatId: 'B17', start: 222, end: 238.116, title: '收服务费之前，先把边界讲清楚', detail: '做哪些工作、谁配合、交什么东西，客户用不上还要继续查问题', items: ['工作范围', '双方配合', '交付物'], component: 'checklist', family: 'scope-checklist', tone: 'cyan', role: 'chapter', sound: 'remotion-page-turn'}),
  paper({id: 'v91-022-p06-b17', beatId: 'B17', start: 238.116, duration: 6.584, clip: 'P06', title: '服务范围、协作和交付', detail: '不用通用方案敷衍真实问题', role: 'media', sound: 'remotion-ui-switch'}),
  info({id: 'v91-023-b18-more-work', beatId: 'B18', start: 244.7, end: 262, title: '只靠生成几段文字、几张图片，会越来越难', detail: '你得比老板自己试，多承担他没时间做、不会检查、无法持续的工作', component: 'comparison', family: 'value-gap', tone: 'amber', role: 'line', sound: 'v3-evidence-paper-a'}),
  info({id: 'v91-024-b19-onsite', beatId: 'B19', start: 262, end: 278, title: '本地的优势，是能到店里看', detail: '问清真实工作，才知道通用方案哪里用不了', component: 'evidence', family: 'onsite-evidence', tone: 'green', role: 'number', sound: 'v3-soft-card-pop-b'}),
  info({id: 'v91-025-b20-paid-project', beatId: 'B20', start: 278, end: 295, title: '有过交付，不等于生意已经做完', detail: '企业AI应用和GEO有过付费交付，后面还要看服务能不能做好、客户能不能继续用', component: 'process', family: 'delivery-loop', tone: 'white', role: 'keyword', sound: 'waic-node-connect'}),
  info({id: 'v91-026-b21-start-known', beatId: 'B21', start: 295, end: 311, title: '先从熟悉的业务开始', detail: '完全没接触过一个行业，就先去了解实际工作', component: 'definition', family: 'start-gate', tone: 'cyan', role: 'list', sound: 'v1-confirm-soft'}),
  info({id: 'v91-027-b22-closing', beatId: 'B22', start: 311, end: 336.28, title: '我选择留在兰州做这件事', detail: '把本地企业的问题弄明白，把自己能承担的工作做好', items: ['带着实际问题来聊', '能做哪一段当面说清'], component: 'closing', family: 'local-cta', tone: 'green', role: 'cta', sound: 'v3-cta-confirm-a'}),
];

const visualPlan = {
  schemaVersion: 4,
  experiment: {id: 'v8-semantic-continuity-sfx', status: 'candidate-preview-required'},
  directorProfile: {id: 'paper-editorial-director-v9', version: '9.1.0'},
  productionProfile: {id: 'v8-semantic-continuity-sfx', version: 'V8'},
  videoId,
  videoTitle: title,
  sourceVideo,
  transcript:
    'edit/20260910_lanzhou_industry_ai/05_实录与字幕/spoken-timeline.candidate.v1.json',
  bilingualCaptions:
    'edit/20260910_lanzhou_industry_ai/05_实录与字幕/actual-spoken.bilingual.candidate.v1.json',
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: [
    'v8-user-confirmed-default-20260812',
    'v8-speaker-first-continuous-semantics',
    'paper-editorial-director-v9.1',
  ],
  target: {aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin'},
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
    '完整保留真人口播；六条纸艺成品按对应实录整句的动作落点前置，全程1倍速、从素材第0帧播放、全部静音，始终使用R01录音为唯一口播音轨。',
  timingRevision: {
    id: '20260911-animation-rebind-r2',
    reason: '用户反馈所有动画入点偏迟，要求只修动画衔接后导出完整成片。',
    evidence:
      'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/timing-rebind-user-direction.v1.json',
    semanticPrerollFrames: 6,
    paperFadeFrames: 3,
  },
  speakerOnlyWindows: [
    {
      id: 'speaker-only-b16-question',
      startSeconds: 217.7,
      endSeconds: 222,
      reason: '保留“客户自己会用AI后还需要你做什么”的真人提问，不提前叠加下一段收费边界卡。',
    },
  ],
  safeAreas: {
    face: {x: 0.36, y: 0.08, width: 0.55, height: 0.7},
    informationOverlay: {x: 0.028, y: 0.13, width: 0.36, height: 0.58},
    bilingualCaption: {x: 0.04, y: 0.78, width: 0.92, height: 0.2},
  },
  assetCoverage: {
    recordedSpeakerItems: 1,
    assignedRecordedSpeakerItems: 1,
    userGeneratedPaperVideos: 6,
    assignedUserGeneratedPaperVideos: 6,
    canonicalVoicePreserved: true,
    paperAssetAudioMuted: true,
    allSixPaperClipsBound: true,
  },
  paperTimeMappings: layers
    .filter((layer) => layer.id.includes('-p0'))
    .map((layer) => ({
      layerId: layer.id,
      beatId: layer.beatId,
      source: layer.asset.source,
      renderSource: layer.params.src,
      startSeconds: layer.start,
      endSeconds: layer.end,
      muteAssetAudio: true,
      canonicalAudio: `${publicRoot}/R01.mp4`,
      binding: layer.postshootBinding,
    })),
  layers: layers.map(({_sfxSource, _sfxRenderSource, ...layer}) => layer),
};

const cues = layers.map((layer) => ({
  id: layer.sound.cueId,
  visualEventId: layer.visualEvent.id,
  role: layer.sound.role,
  start: layer.visualEvent.enterAt,
  end: Number((layer.visualEvent.enterAt + 0.35).toFixed(3)),
  source: layer._sfxSource,
  renderSource: layer._sfxRenderSource,
  license: '已进入V8本地音效审核清单',
  licenseReference: 'assets/sfx/koubo-sfx-v8/manifest.json',
  volume: ['media', 'chapter', 'cta'].includes(layer.sound.role) ? 0.3 : 0.26,
  voiceDuckDb: 0,
  previewCovered: layer.visualEvent.enterAt >= 0 && layer.visualEvent.enterAt <= 45,
  formalReviewed: false,
  userAudibilityConfirmed: false,
}));

const cueSheet = {
  schemaVersion: 3,
  videoId,
  version: 'lanzhou-industry-ai-v91-v8-candidate-r1',
  experimentId: 'v8-semantic-continuity-sfx',
  normalizedPack: 'assets/sfx/koubo-sfx-v8/manifest.json',
  cues,
  coverageReview: {
    primaryVisualEventCount: layers.length,
    coveredPrimaryVisualEventCount: cues.length,
    coveragePercent: 100,
    maxSyncErrorFrames: 2,
    sameFileRepeatWithin25Seconds: false,
    machineStatus: 'pending-validator',
    userAudibilityConfirmed: false,
    confirmationScope: null,
  },
};

const bilingual = JSON.parse(readFileSync(bilingualSource, 'utf8'));
if (!Array.isArray(bilingual.captions) || bilingual.captions.length === 0) {
  throw new Error('实录双语字幕没有 captions 数组。');
}

writeFileSync(
  path.join(controlDir, 'visual-plan.v1.json'),
  `${JSON.stringify(visualPlan, null, 2)}\n`,
);
writeFileSync(
  path.join(controlDir, 'sfx-cues.v1.json'),
  `${JSON.stringify(cueSheet, null, 2)}\n`,
);
writeFileSync(
  path.join(projectRoot, publicRoot, 'captions.json'),
  `${JSON.stringify(bilingual.captions, null, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      videoId,
      layers: visualPlan.layers.length,
      paperMappings: visualPlan.paperTimeMappings.length,
      cues: cueSheet.cues.length,
      captions: bilingual.captions.length,
      previewPrimaryEvents: layers.filter(
        (layer) => layer.visualEvent.enterAt >= 0 && layer.visualEvent.enterAt <= 45,
      ).length,
    },
    null,
    2,
  ),
);
