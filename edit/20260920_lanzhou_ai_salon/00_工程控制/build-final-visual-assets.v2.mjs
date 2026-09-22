import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../../..');
const outputs = {
  editPlan: resolve(projectRoot, 'edit/20260920_lanzhou_ai_salon/06_剪辑工程/visual-plan.v2.json'),
  editSfx: resolve(projectRoot, 'edit/20260920_lanzhou_ai_salon/06_剪辑工程/sfx-cues.v2.json'),
  remotionPlan: resolve(projectRoot, 'remotion/src/salon-20260920/visual-plan.v2.json'),
  remotionSfx: resolve(projectRoot, 'remotion/src/salon-20260920/sfx-cues.v2.json'),
};

const sceneSpecs = [
  {
    id: 'salon-r2-001-opening', start: 0, end: 5.5,
    component: 'image-editorial', kind: 'full-screen-asset', role: 'media', sfxFile: 'v3-media-whoosh-a.wav',
    title: '兰州AI实践者共创沙龙', detail: '第一期 · 把兰州真正用AI做事的人聚到一起',
    imageSrc: 'images/1.png', fit: 'cover', position: '50% 50%', spokenLine: '本次沙龙开场',
  },
  {
    id: 'salon-r2-002-why', start: 8.333, end: 14.6,
    component: 'statement', role: 'keyword', sfxFile: 'v1-keyword-tick.wav',
    title: '我们为什么办这场沙龙？', detail: '从一个真实问题开始，把线上答案带回现实验证。',
    items: ['真实问题', '线下连接', '共同解决'], spokenLine: '为什么要做这个沙龙',
  },
  {
    id: 'salon-r2-003-why-image', start: 14.713, end: 25.753,
    component: 'image-editorial', kind: 'full-screen-asset', role: 'media', sfxFile: 'remotion-ui-switch.wav',
    title: 'AI正在改变工作和生活', detail: '学AI、用AI、做企业，都要回到一个具体问题。',
    imageSrc: 'images/why-salon.png', fit: 'contain', position: '50% 50%', spokenLine: 'AI正在影响并改变生活工作',
  },
  {
    id: 'salon-r2-004-affected', start: 28.893, end: 42.693, primary: false,
    component: 'layer-map', title: '改变正在发生', detail: 'OPC创业、企业经营和个人业务，都在被AI重新组织。',
    items: ['OPC创业', '企业经营', '个人业务'], spokenLine: 'OPC创业、企业主和自身业务都在被AI改变',
  },
  {
    id: 'salon-r2-005-reality-gap', start: 47.393, end: 61.4,
    component: 'comparison', role: 'comparison', sfxFile: 'v1-node-connect.wav',
    title: 'AI给出线索，现实补齐条件', detail: '反复询问能找到方向，现场经验才能检验答案。',
    items: ['向AI询问和交流', '回到现实经验验证'], spokenLine: '现实经验和AI最终给出的答案不一致',
  },
  {
    id: 'salon-r2-006-summary-image', start: 61.573, end: 68.693, primary: false,
    component: 'image-editorial', kind: 'full-screen-asset', role: 'evidence', sfxFile: 'v1-camera-shutter.wav',
    title: '本次讨论的主线', detail: 'AI会议记录整理 · 只作议程和观点导航',
    imageSrc: 'images/meeting-summary.jpg', fit: 'contain', position: '50% 18%', spokenLine: '现实问题与AI答案存在差异',
  },
  {
    id: 'salon-r2-007-local-network', start: 71.753, end: 81.9,
    component: 'layer-map', role: 'node', sfxFile: 'waic-node-connect.wav',
    title: '从兰州本地开始连接', detail: '会用AI的人、想用AI的人，围绕同一个现实问题见面。',
    items: ['AI实践者', '企业经营者', '本地创业者'], spokenLine: '甘肃兰州本地会用AI和想用AI的人',
  },
  {
    id: 'salon-r2-008-monthly-image', start: 82.033, end: 89.033,
    component: 'image-editorial', kind: 'full-screen-asset', role: 'media', sfxFile: 'v1-camera-shutter.wav',
    title: '接下来，我们每个月见一次', detail: '把问题挖出来，把能落地的事一起做出来。',
    imageSrc: 'images/monthly-meet.png', fit: 'contain', position: '50% 50%', spokenLine: '每个月组织一次把问题挖出来解决',
  },
  {
    id: 'salon-r2-009-resources', start: 89.033, end: 98.95, primary: false,
    component: 'flow', title: 'AI是工具，问题来自现实', detail: '把身边的资源组织起来，让工具服务真实问题。',
    items: ['现实资源', 'AI工具', '解决问题'], spokenLine: '利用AI工具解决现实世界的问题',
  },
  {
    id: 'salon-r2-010-spring-image', start: 98.95, end: 108.033,
    component: 'image-editorial', kind: 'full-screen-asset', role: 'media', sfxFile: 'v3-media-whoosh-a.wav',
    title: '春天已经来了', detail: '一朵花可以种在花园里，但它一定开放在春天里。',
    imageSrc: 'images/spring-flower.png', fit: 'cover', position: '50% 50%', spokenLine: '一朵花一定开放在春天里',
  },

  {
    id: 'salon-r2-011-laoxu-card', start: 108.1, end: 116.0,
    component: 'speaker-intro', role: 'keyword', sfxFile: 'v3-list-tick-a.wav',
    title: '老徐', detail: '医保内容账号实践者', items: ['账号运营', '流量数据', '变现卡点'], spokenLine: '我有一个自媒体账号老徐聊医保',
  },
  {
    id: 'salon-r2-012-laoxu-background', start: 121.42, end: 135.813, primary: false,
    component: 'metric-stack', role: 'number', sfxFile: 'v2-number-affirmation.wav',
    title: '二十年医保经验', detail: '账号从长期行业实践出发。',
    items: ['医保飞检', '基金监管', '合规'], spokenLine: '医保做了二十年',
  },
  {
    id: 'salon-r2-013-laoxu-origin', start: 139.37, end: 161.89, primary: false,
    component: 'timeline', title: '从一次出差开始', detail: '朋友反复问医保政策，于是把回答做成口播视频。',
    items: ['新疆出差', '朋友提问', '公开口播'], spokenLine: '给一个人说不如用自媒体给大家都说',
  },
  {
    id: 'salon-r2-014-laoxu-efficiency', start: 162.79, end: 183.75,
    component: 'metric-stack', role: 'number', sfxFile: 'v2-number-affirmation.wav',
    title: '四十分钟', detail: '熟悉流程以后，从写文案、剪辑到发布的现场自述。',
    items: ['起初：一天甚至两天', '现在：约四十分钟'], spokenLine: '写文案剪辑到发布四十分钟之内搞定',
  },
  {
    id: 'salon-r2-015-laoxu-data', start: 190.97, end: 216.99,
    component: 'metric-stack', role: 'number', sfxFile: 'v1-camera-shutter.wav',
    title: '账号播放数据', detail: '均为发言者现场自述，不外推为稳定收益。',
    items: ['抖音最高：一千多万', '视频号：一百多万', '另有八十多万播放'], spokenLine: '抖音最高一千多万，视频号一百多万八十多万',
  },
  {
    id: 'salon-r2-016-laoxu-bottleneck', start: 216.99, end: 237.41,
    component: 'flow', role: 'line', sfxFile: 'v1-node-connect.wav',
    title: '流量不是终点', detail: '真正卡住的是公域流量进入私域之后，怎么形成成交。',
    items: ['公域流量', '进入私域', '形成成交'], spokenLine: '公域流量转化到私域里面怎么成交',
  },
  {
    id: 'salon-r2-017-laoxu-reality', start: 237.41, end: 249.8, primary: false,
    component: 'question-grid', title: '最后的20%，要在实践里走通', detail: '挂课、留资都有标准答案，真正执行时仍会遇到阻力。',
    items: ['课程怎么设计？', '私域怎么承接？', '成交怎么闭环？'], spokenLine: '网上会有很多答案但是实际走的过程中走不通',
  },
  {
    id: 'salon-r2-018-mindmap', start: 250.0, end: 258.1,
    component: 'image-editorial', kind: 'full-screen-asset', role: 'media', sfxFile: 'v3-media-whoosh-a.wav',
    title: '从一个案例，进入一组现场实践', detail: 'AI会议思维导图 · 聚焦参会者的真实问题与经验',
    imageSrc: 'images/mindmap.png', fit: 'cover', position: '50% 48%', panY: true, spokenLine: '希望在沙龙里面解决这个问题',
  },

  {
    id: 'salon-r2-019-wei-card', start: 258.467, end: 266.0,
    component: 'speaker-intro', role: 'keyword', sfxFile: 'v1-keyword-tick.wav',
    title: '魏元甲', detail: '学生AI创新实践者', items: ['AI教学系统', '创意大赛', '自主探索'], spokenLine: '给父母做AI教学系统',
  },
  {
    id: 'salon-r2-020-wei-system', start: 266.0, end: 285.12, primary: false,
    component: 'definition', title: 'AI教学系统 Demo', detail: '从父母的教师工作出发，先做一个可以演示的平台。',
    items: [], spokenLine: '做了一个AI整个教学系统的平台',
  },
  {
    id: 'salon-r2-021-wei-result', start: 286.34, end: 300.85,
    component: 'metric-stack', role: 'number', sfxFile: 'v3-list-tick-a.wav',
    title: '一次学生实践', detail: '报名人数和名次均按发言者现场自述呈现。',
    items: ['报名：三万七千多人', '全国前两千'], spokenLine: '三万七千多人报名，全国前两千的名次',
  },

  {
    id: 'salon-r2-022-huang-card', start: 300.867, end: 308.6,
    component: 'speaker-intro', role: 'keyword', sfxFile: 'waic-node-connect.wav',
    title: '黄鹏飞', detail: '企业 AI 服务实践者', items: ['需求连接', '销售与交付'], spokenLine: '我是在观望，我是在看落地怎么落地',
  },
  {
    id: 'salon-r2-023-huang-bridge', start: 308.6, end: 328.71, primary: false,
    component: 'layer-map', title: '连接需求、销售与交付', detail: '把技术能力、业务员和中小企业客户接到一条链路上。',
    items: ['技术能力', '业务沟通', '交付落地'], spokenLine: '我就是中间的桥梁，沟通和交付由我们来干',
  },
  {
    id: 'salon-r2-024-huang-need', start: 328.87, end: 343.29,
    component: 'comparison', role: 'comparison', sfxFile: 'remotion-ui-switch.wav',
    title: '先问企业最需要什么', detail: '能力只有进入具体业务问题，才可能形成价值。',
    items: ['AI能做什么', '企业要解决什么'], spokenLine: '不是能做什么，而是中小企业最需要什么',
  },

  {
    id: 'salon-r2-025-li-card', start: 343.5, end: 351.0,
    component: 'speaker-intro', role: 'keyword', sfxFile: 'v2-number-affirmation.wav',
    title: '李女士', detail: '超级个体认知分享者', items: ['知识付费', '边界意识', '真实结果'], spokenLine: '知识付费是公司的未来方向',
  },
  {
    id: 'salon-r2-026-li-boundary', start: 352.66, end: 371.28, primary: false,
    component: 'question-grid', title: '知识付费先守边界', detail: '这是发言者的现场观点，不升级为法律结论。',
    items: ['内容能否公开？', '有没有越过边界？', '承诺是否有证据？'], spokenLine: '知识付费有明确严格的法律界限',
  },
  {
    id: 'salon-r2-027-li-proof', start: 371.28, end: 386.42,
    component: 'flow', role: 'line', sfxFile: 'v3-list-tick-a.wav',
    title: '先把自己做成', detail: '先会做、拿到真实结果，再谈带别人做。',
    items: ['自己会做', '真实变现', '再带别人'], spokenLine: '自己会做并变现后才能带着别人去做',
  },

  {
    id: 'salon-r2-028-hong-card', start: 386.5, end: 394.0,
    component: 'speaker-intro', role: 'keyword', sfxFile: 'v1-camera-shutter.wav',
    title: '洪岩', detail: '飞书生态企业服务实践者', items: ['企业协同', '数据沉淀', 'AI上下文'], spokenLine: '飞书生态伙伴西北区负责人洪岩',
  },
  {
    id: 'salon-r2-029-hong-context', start: 408.53, end: 424.75, primary: false,
    component: 'definition', title: '企业数据，才是AI的上下文', detail: '想让Agent给出更精准的结果，先要有企业自己的高价值信息。',
    items: [], spokenLine: '要精准的结果就得有企业的数据和高价值信息',
  },
  {
    id: 'salon-r2-030-hong-sources', start: 424.75, end: 443.91,
    component: 'source-branches', role: 'node', sfxFile: 'waic-node-connect.wav',
    title: '把组织记忆沉淀下来', detail: '聊天、文档、会议和业务流程共同构成可调用的企业上下文。',
    items: ['聊天与文档', '会议与日程', '多维表格与流程'], spokenLine: '聊天文档会议日程和业务流程都是沉淀的数据',
  },
  {
    id: 'salon-r2-031-hong-vertical', start: 443.93, end: 467.37, primary: false,
    component: 'layer-map', title: '懂业务的人会更值钱', detail: '行业经验、知识库和真实数据，决定垂直服务的深度。',
    items: ['行业经验', '高价值知识库', '真实数据'], spokenLine: '在熟悉的行业结合经验知识和数据做深耕',
  },

  {
    id: 'salon-r2-032-ge-card', start: 467.567, end: 475.5,
    component: 'speaker-intro', role: 'keyword', sfxFile: 'v1-keyword-tick.wav',
    title: '葛永鹏', detail: '西部奥体体育', items: ['传统行业', '现场学习', '开始行动'], spokenLine: '我是葛永鹏，昨天才报的活动',
  },
  {
    id: 'salon-r2-033-ge-awaken', start: 475.5, end: 494.39, primary: false,
    component: 'comparison', title: '看见差距，也看见行动', detail: '从传统行业走进现场，才发现兰州已经有人开始实践。',
    items: ['过去：行业里打转', '现场：有人已经行动'], spokenLine: '结果才发现我们落后了这么多',
  },
  {
    id: 'salon-r2-034-ge-learning', start: 494.39, end: 509.79, primary: false,
    component: 'statement', title: '把陌生变成一次学习', detail: '看到别人轻车熟路，也明确了下一步要持续来听、来学。',
    items: ['建立连接', '持续学习'], spokenLine: '希望以后有机会多来听多来学习',
  },

  {
    id: 'salon-r2-035-han-card', start: 510.833, end: 518.8,
    component: 'speaker-intro', role: 'keyword', sfxFile: 'remotion-ui-switch.wav',
    title: '韩志鑫', detail: '大四学生', items: ['计算机本科', 'AI自学', '短视频实践'], spokenLine: '我叫韩志鑫，本科是学计算机的',
  },
  {
    id: 'salon-r2-036-han-judgment', start: 521.15, end: 534.83,
    component: 'statement', role: 'keyword', sfxFile: 'v2-number-affirmation.wav',
    title: 'AI再强，人的判断也很重要', detail: '生成一百篇文案不等于知道哪一篇真正好。',
    items: ['AI生成', '人的判断'], spokenLine: 'AI再强，人的判断也是特别重要的',
  },
  {
    id: 'salon-r2-037-han-tools', start: 534.83, end: 548.37, primary: false,
    component: 'flow', title: '工具正在进入设计流程', detail: '用GPT Image Tool做效果图和矢量图，再由人判断结果是否可用。',
    items: ['效果图', '矢量图', '人工判断'], spokenLine: '用GPT的Image Tool出效果图和矢量图',
  },

  {
    id: 'salon-r2-038-close-resources', start: 549.23, end: 566.13, primary: false,
    component: 'layer-map', title: '组织别人组织不到的资源', detail: '每个月让不同的人和不同的能力持续进入现场。',
    items: ['不同的人', '不同的资源', '持续组织'], spokenLine: '最大的核心竞争力是组织到别人组织不到的资源',
  },
  {
    id: 'salon-r2-039-close-together', start: 566.13, end: 582.91, primary: false,
    component: 'statement', title: '大家都好，你自然不会差', detail: '同一个行业里一起做，把个人成长放进共同实践。',
    items: ['同行共创', '彼此增益'], spokenLine: '当大家都好的时候你自然不会差',
  },
  {
    id: 'salon-r2-040-close-project', start: 582.91, end: 596.79, primary: false,
    component: 'flow', title: '有项目，就一起扑上去干', detail: '共享资源、整合能力，完成一次真实交付再复盘。',
    items: ['资源共享', '能力整合', '共同交付'], spokenLine: '有一个项目大家有能力一块扑上去干',
  },
  {
    id: 'salon-r2-041-close-final', start: 596.79, end: 613.766667,
    component: 'statement', role: 'keyword', sfxFile: 'v1-node-connect.wav',
    title: '接下来，继续做下去', detail: '第一次是起点。每个月见一次，把能落地的事一起做出来。',
    items: ['持续组织', '持续行动'], spokenLine: '这是第一次，我会坚持继续做下去',
  },
];

const sfxVolumeByRole = {
  keyword: 0.25,
  media: 0.2,
  evidence: 0.2,
  line: 0.21,
  number: 0.22,
  node: 0.2,
  comparison: 0.2,
};

let primaryIndex = 0;
const layers = sceneSpecs.map((scene, index) => {
  const primary = scene.primary !== false;
  const cueId = primary ? `salon-r2-sfx-${String(++primaryIndex).padStart(3, '0')}` : null;
  const source = scene.imageSrc
    ? `remotion/public-salon-20260920/${scene.imageSrc}`
    : `SalonHighlight/${scene.component}`;
  return {
    id: scene.id,
    start: scene.start,
    end: scene.end,
    spokenLine: scene.spokenLine,
    purpose: scene.imageSrc ? 'editorial-illustration' : 'semantic-emphasis',
    kind: primary ? (scene.kind ?? 'transparent-semantic-information') : 'ambient-overlay',
    variant: scene.component,
    titleOwner: true,
    overlapGroup: scene.id,
    zone: scene.imageSrc ? 'full-screen' : 'left-safe',
    title: scene.title,
    detail: scene.detail,
    items: scene.items ?? [],
    asset: {
      sourceType: scene.imageSrc ? 'user-provided-editorial-image' : 'remotion-component',
      source,
    },
    assetDecision: {
      class: scene.imageSrc ? 'real-evidence' : 'remotion-information',
      producer: scene.imageSrc ? 'user' : 'codex-remotion',
      requestId: null,
      fallback: 'speaker-plus-information',
      evidenceUse: scene.imageSrc ? 'illustration-or-navigation-only' : 'semantic-explanation',
    },
    visualEvent: {
      id: `salon-r2-v${String(index + 1).padStart(3, '0')}`,
      enterAt: scene.start,
      primary,
    },
    sound: primary
      ? {policy: 'required', role: scene.role, cueId, offsetFrames: 0, maxSyncErrorFrames: 2}
      : {policy: 'none', role: 'ambient', cueId: null, offsetFrames: 0, maxSyncErrorFrames: 2, reason: '连续语义层保持静默，避免提示音干扰现场发言。'},
    params: {
      component: scene.component,
      title: scene.title,
      detail: scene.detail,
      items: scene.items ?? [],
      imageSrc: scene.imageSrc,
      fit: scene.fit,
      position: scene.position,
      panY: scene.panY ?? false,
      disclosure: scene.imageSrc ? '用户提供 · 辅助说明画面' : undefined,
    },
    checks: {
      avoidFace: !scene.imageSrc,
      avoidHands: !scene.imageSrc,
      avoidSubtitle: true,
      needsFrameReview: true,
      continuousReviewIntervalSeconds: 0.5,
      reviewAt: Number(((scene.start + scene.end) / 2).toFixed(3)),
    },
    background: scene.imageSrc ? 'opaque' : 'talk',
    presentation: {
      renderMode: scene.imageSrc ? 'media-fullscreen' : 'speaker-overlay',
      semanticFamily: scene.imageSrc ? 'editorial-image' : scene.component,
      coverageRatio: scene.imageSrc ? 1 : 0.36,
      progressiveReveal: true,
    },
  };
});

const sceneById = new Map(sceneSpecs.map((scene) => [scene.id, scene]));
const cues = layers
  .filter((layer) => layer.visualEvent.primary)
  .map((layer) => {
    const scene = sceneById.get(layer.id);
    if (!scene?.sfxFile) throw new Error(`主视觉 ${layer.id} 缺少音效文件。`);
    return {
      id: layer.sound.cueId,
      visualEventId: layer.visualEvent.id,
      role: layer.sound.role,
      start: layer.start,
      end: Number((layer.start + 1.25).toFixed(3)),
      source: `remotion/public-salon-20260920/audio/sfx/${scene.sfxFile}`,
      license: scene.sfxFile.startsWith('v1-') || scene.sfxFile.startsWith('remotion-')
        ? 'CC0'
        : 'Mixkit Free License',
      licenseReference: 'assets/sfx/koubo-sfx-v8/manifest.json',
      volume: sfxVolumeByRole[layer.sound.role] ?? 0.2,
      voiceDuckDb: 0,
      previewCovered: false,
      formalReviewed: false,
      userAudibilityConfirmed: false,
    };
  });

if (cues.length < 20 || cues.length > 30) {
  throw new Error(`音效数量必须控制在20—30条，当前为 ${cues.length} 条。`);
}

const plan = {
  schemaVersion: 4,
  experiment: {id: 'v8-semantic-continuity-sfx', status: 'candidate-preview-required'},
  videoId: 'LANZHOU_AI_SALON_20260920_FINAL_R2',
  videoTitle: '兰州AI实践者共创沙龙·第一期',
  sourceVideo: 'edit/20260920_lanzhou_ai_salon/01_原始素材/copy_63E2AF15-FCCC-4042-A5F1-7616B6D8BA30.MOV',
  transcript: 'edit/20260920_lanzhou_ai_salon/05_实录与字幕/canonical-transcript.final-source.v2.json',
  bilingualCaptions: 'remotion/public-salon-20260920/data/captions.final-source.bilingual.v2.json',
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: [
    'v8-user-confirmed-default-20260811',
    'v8-speaker-first-continuous-semantics',
    'salon-user-provided-editorial-images',
  ],
  target: {aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin'},
  previewCoverage: [
    'hook', 'complex-overlay', 'full-screen-asset', 'cta', 'speaker-overlay',
    'media-fullscreen', 'progressive-process', 'source-evidence', 'hero-emphasis', 'sfx-ab',
  ],
  editPolicy: '完整保留用户指定最终源的18413帧和原始语序；实录音频是字幕与语义包装的唯一正文，不做额外删改或重排。',
  identityPolicy: {
    source: 'user-corrected-final',
    locked: [
      '黄鹏飞｜企业 AI 服务实践者｜需求连接 / 销售与交付',
      '葛永鹏｜西部奥体体育',
      '韩志鑫｜大四学生',
    ],
  },
  assetCoverage: {
    usableUserImages: 6,
    assignedUserImages: 6,
    allRequiredClaimsCovered: true,
    assigned: [
      'images/1.png',
      'images/why-salon.png',
      'images/monthly-meet.png',
      'images/spring-flower.png',
      'images/meeting-summary.jpg',
      'images/mindmap.png',
    ],
    note: '六张用户图片全部用于开场、主题解释、流程导航或转场，不承担人物身份、数字、法律或效果证明。',
  },
  speakerCards: [
    {name: '老徐', start: 108.1, title: '医保内容账号实践者'},
    {name: '魏元甲', start: 258.467, title: '学生AI创新实践者'},
    {name: '黄鹏飞', start: 300.867, title: '企业 AI 服务实践者', topics: ['需求连接', '销售与交付']},
    {name: '李女士', start: 343.5, title: '超级个体认知分享者'},
    {name: '洪岩', start: 386.5, title: '飞书生态企业服务实践者'},
    {name: '葛永鹏', start: 467.567, title: '西部奥体体育'},
    {name: '韩志鑫', start: 510.833, title: '大四学生'},
  ],
  sourceTiming: {durationSeconds: 613.766667, frameCount: 18413, fps: 30},
  layers,
};

const sfx = {
  schemaVersion: 3,
  videoId: plan.videoId,
  version: 'v2-final-source-candidate',
  experimentId: 'v8-semantic-continuity-sfx',
  normalizedPack: 'assets/sfx/koubo-sfx-v8/manifest.json',
  densityPolicy: '只在六张主题图片、七位嘉宾出场和关键语义转折处发声；其余连续语义层保持静默。',
  cues,
};

for (const [path, value] of [
  [outputs.editPlan, plan],
  [outputs.remotionPlan, plan],
  [outputs.editSfx, sfx],
  [outputs.remotionSfx, sfx],
]) {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

process.stdout.write(`已生成最终源视觉计划：${layers.length} 层，${cues.length} 条克制音效，6张用户图片，7位嘉宾介绍卡。\n`);
