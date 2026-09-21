import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../../..');
const editPlanPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/06_剪辑工程/visual-plan.v1.json',
);
const editSfxPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/06_剪辑工程/sfx-cues.v1.json',
);
const srcPlanPath = resolve(
  projectRoot,
  'remotion/src/salon-20260920/visual-plan.v1.json',
);
const srcSfxPath = resolve(
  projectRoot,
  'remotion/src/salon-20260920/sfx-cues.v1.json',
);

const sceneSpecs = [
  {id:'salon-001-opening',start:0,end:5.2,component:'image-editorial',semanticFamily:'editorial-opening',kind:'full-screen-asset',role:'media',sfxFile:'v3-media-whoosh-a.wav',title:'兰州AI实践者共创沙龙',detail:'第一期 · 让真实问题在现场发生连接',imageSrc:'images/1.png',fit:'cover',position:'50% 50%',spokenLine:'为什么要做这场沙龙'},
  {id:'salon-002-why',start:5.2,end:13.8,component:'statement',kind:'transparent-semantic-information',role:'keyword',sfxFile:'v1-keyword-tick.wav',title:'我们为什么办这场沙龙？',detail:'AI正在改变工作与生活，真实问题需要回到现场。',items:['真实问题','线下连接','共同解决'],spokenLine:'为什么要做这个沙龙'},
  {id:'salon-003-why-image',start:18,end:25.8,component:'image-editorial',semanticFamily:'editorial-problem',kind:'full-screen-asset',role:'media',sfxFile:'remotion-ui-switch.wav',title:'把真实问题带到现场',detail:'学AI、用AI、做企业，都从一个具体问题开始。',imageSrc:'images/why-salon.png',fit:'contain',position:'50% 50%',spokenLine:'AI正在改变生活与工作'},
  {id:'salon-004-reality',start:44.5,end:58.5,component:'flow',kind:'transparent-semantic-information',role:'line',sfxFile:'v1-node-connect.wav',title:'答案要回到现实里验证',detail:'线上训练给出线索，线下经验补齐条件。',items:['遇到问题','线下碰面','一起拆解','现场验证'],spokenLine:'现实经验和AI答案不一致'},
  {id:'salon-005-summary',start:61.2,end:68.2,component:'image-editorial',semanticFamily:'editorial-summary',kind:'full-screen-asset',role:'evidence',sfxFile:'v1-camera-shutter.wav',title:'本次讨论的主线',detail:'AI会议记录整理 · 仅作流程导航',imageSrc:'images/meeting-summary.jpg',fit:'contain',position:'50% 18%',spokenLine:'办沙龙的初衷'},
  {id:'salon-006-monthly',start:78,end:85.8,component:'image-editorial',semanticFamily:'editorial-monthly',kind:'full-screen-asset',role:'media',sfxFile:'v3-media-whoosh-a.wav',title:'接下来，每个月见一次',detail:'真实问题定主题 · 实操方法 · 联合协作 · 本地资源',imageSrc:'images/monthly-meet.png',fit:'contain',position:'50% 50%',spokenLine:'每个月组织一次'},
  {id:'salon-006b-monthly-network',start:86.2,end:89.8,component:'layer-map',semanticFamily:'monthly-network',kind:'transparent-semantic-information',role:'node',primary:false,title:'每月一场，持续连接',detail:'让问题、能力和本地资源持续相遇。',items:['真实问题','实践者','本地资源'],spokenLine:'每个月组织一次'},
  {id:'salon-007-spring',start:90.54,end:99.9,component:'image-editorial',semanticFamily:'editorial-quote',kind:'full-screen-asset',role:'media',sfxFile:'remotion-ui-switch.wav',title:'春天已经来了',detail:'一朵花能开多大，取决于有没有站在春天里。',imageSrc:'images/spring-flower.png',fit:'cover',position:'50% 50%',spokenLine:'一朵花一定开放在春天里'},

  {id:'salon-008-laoxu-card',start:99.9,end:106.2,component:'speaker-intro',kind:'transparent-semantic-information',role:'keyword',sfxFile:'waic-node-connect.wav',title:'老徐',detail:'医保内容账号实践者',items:['账号运营','流量数据','变现卡点'],spokenLine:'老徐聊医保'},
  {id:'salon-009-laoxu-background',start:106.2,end:124.6,component:'statement',kind:'transparent-semantic-information',role:'evidence',sfxFile:'v1-camera-shutter.wav',title:'二十年医保经验',detail:'账号从真实行业问题开始，而不是从追热点开始。',items:['医保飞检','基金监管','合规'],spokenLine:'老徐账号与行业背景'},
  {id:'salon-010-laoxu-origin',start:128,end:144,component:'timeline',kind:'transparent-semantic-information',role:'line',sfxFile:'waic-node-connect.wav',title:'一个账号怎么开始',detail:'朋友反复提问，促成一次面向所有人的公开回答。',items:['新疆出差','朋友问政策','开始做口播'],spokenLine:'给一个人说不如给大家说'},
  {id:'salon-011-laoxu-efficiency',start:162,end:176.6,component:'metric-stack',kind:'transparent-semantic-information',role:'number',sfxFile:'v2-number-affirmation.wav',title:'四十分钟',detail:'从写文案、剪辑到发布',items:['起初一两天','熟悉后约40分钟'],spokenLine:'四十分钟内搞定'},
  {id:'salon-012-laoxu-data',start:180,end:198.4,component:'metric-stack',kind:'transparent-semantic-information',role:'number',sfxFile:'v3-list-tick-a.wav',title:'账号播放数据',detail:'现场实录原话 · 不外推粉丝量或稳定收益',items:['抖音最高：一千多万','视频号：一百多万、八十多万'],spokenLine:'抖音和视频号播放数据'},
  {id:'salon-013-laoxu-bottleneck',start:198.4,end:216.6,component:'flow',kind:'transparent-semantic-information',role:'line',sfxFile:'v1-node-connect.wav',title:'流量不是终点',detail:'真正卡住的是从关注到成交的最后一段。',items:['公域流量','转到私域','形成成交'],spokenLine:'公域转私域怎么成交'},
  {id:'salon-014-laoxu-question',start:217,end:241.6,component:'question-grid',kind:'transparent-semantic-information',role:'list',sfxFile:'v3-list-tick-a.wav',title:'最后两成怎么走通？',detail:'网上答案很多，现实交付仍需在现场验证。',items:['课程怎么设计？','私域怎么承接？','成交路径怎么缩短？'],spokenLine:'最后的20%卡在变现'},
  {id:'salon-015-mindmap',start:243,end:250.6,component:'image-editorial',semanticFamily:'editorial-mindmap',kind:'full-screen-asset',role:'media',sfxFile:'v3-media-whoosh-a.wav',title:'从一个案例，进入一组现场实践',detail:'AI会议记录整理 · 画面聚焦参会者案例分支',imageSrc:'images/mindmap.png',fit:'cover',position:'50% 46%',panY:true,spokenLine:'下一位分享者出场'},

  {id:'salon-016-wei-card',start:250.6,end:257.2,component:'speaker-intro',kind:'transparent-semantic-information',role:'keyword',sfxFile:'v1-keyword-tick.wav',title:'魏元甲',detail:'学生AI创新实践者',items:['AI教学系统','创意大赛','副业探索'],spokenLine:'魏元甲分享'},
  {id:'salon-017-wei-system',start:258,end:276,component:'definition',kind:'transparent-semantic-information',role:'keyword',primary:false,title:'AI教学系统 Demo',detail:'从父母的教师工作出发，先做一个可演示的平台。',items:[],spokenLine:'AI教学系统平台'},
  {id:'salon-018-wei-result',start:276,end:295.3,component:'metric-stack',kind:'transparent-semantic-information',role:'number',sfxFile:'v1-camera-shutter.wav',title:'一次学生实践',detail:'名次仅按现场自述呈现',items:['报名：三万七千多人','全国前两千','止步初赛'],spokenLine:'报名人数和比赛名次'},

  {id:'salon-019-huang-card',start:295.3,end:302,component:'speaker-intro',kind:'transparent-semantic-information',role:'keyword',sfxFile:'v2-number-affirmation.wav',title:'黄先生',detail:'企业AI服务实践者',items:['销售','企业需求','资源对接'],spokenLine:'黄先生分享'},
  {id:'salon-020-huang-bridge',start:302,end:323.3,component:'layer-map',kind:'transparent-semantic-information',role:'node',primary:false,title:'把技术和客户接起来',detail:'技术团队完成产品，销售与服务团队完成沟通和交付。',items:['技术方','业务员','中小微企业'],spokenLine:'连接技术方和中小微企业'},
  {id:'salon-021-huang-question',start:323.3,end:337.92,component:'comparison',kind:'transparent-semantic-information',role:'comparison',sfxFile:'remotion-ui-switch.wav',title:'先问企业需要什么',detail:'能力清单只有进入业务问题，才可能形成价值。',items:['AI能做什么','企业最需要什么'],spokenLine:'不是AI能做什么，而是企业需要什么'},

  {id:'salon-022-li-card',start:337.92,end:344.4,component:'speaker-intro',kind:'transparent-semantic-information',role:'keyword',sfxFile:'v1-keyword-tick.wav',title:'李女士',detail:'超级个体方向分享者',items:['知识付费边界','OPC创业','真实结果'],spokenLine:'李女士分享'},
  {id:'salon-023-li-boundary',start:344.4,end:365.72,component:'question-grid',kind:'transparent-semantic-information',role:'list',primary:false,title:'知识付费先守边界',detail:'这是发言者的现场观点，不升级为法律结论。',items:['内容能不能公开？','是否越过专业边界？','承诺有没有证据？'],spokenLine:'知识付费有严格法律界限'},
  {id:'salon-024-li-proof',start:365.72,end:381.04,component:'flow',kind:'transparent-semantic-information',role:'line',sfxFile:'v3-list-tick-a.wav',title:'先把自己做成',detail:'先会做、拿到真实结果，再谈带别人做。',items:['自己会做','真实变现','再带别人'],spokenLine:'自己会做并变现后再带别人'},

  {id:'salon-025-hong-card',start:381.04,end:387.4,component:'speaker-intro',kind:'transparent-semantic-information',role:'keyword',sfxFile:'waic-node-connect.wav',title:'洪岩',detail:'飞书生态企业服务实践者',items:['企业协同','数据沉淀','AI上下文'],spokenLine:'洪岩分享'},
  {id:'salon-026-hong-context',start:391.14,end:420,component:'source-branches',kind:'transparent-semantic-information',role:'node',sfxFile:'v2-number-affirmation.wav',title:'企业数据，才是AI的上下文',detail:'聊天、文档、会议和业务流程共同构成可调用的组织记忆。',items:['聊天与文档','会议与日程','多维表格与流程'],spokenLine:'企业数据和协同信息'},
  {id:'salon-027-hong-value',start:420,end:443.62,component:'statement',kind:'transparent-semantic-information',role:'keyword',primary:false,title:'懂业务的人会更值钱',detail:'行业经验、知识库和真实数据，决定垂直服务的深度。',items:['行业经验','知识库','真实数据'],spokenLine:'超级个体要在熟悉行业做深'},

  {id:'salon-028-closing-resources',start:443.62,end:470,component:'layer-map',kind:'transparent-semantic-information',role:'node',primary:false,title:'把分散的能力组织起来',detail:'每月相聚，围绕真实项目临时组队、共同交付。',items:['每月组织','资源共享','项目共创'],spokenLine:'组织到别人组织不到的资源'},
  {id:'salon-029-closing-loop',start:470,end:494.42,component:'flow',kind:'transparent-semantic-information',role:'line',primary:false,title:'共同完成一次真实交付',detail:'有项目就一起扑上去，做完复盘，再回到各自的实践。',items:['发现问题','资源整合','共同交付','带着结果回来'],spokenLine:'资源共享和资源整合'},
  {id:'salon-030-closing-image',start:494.42,end:508.22,component:'image-editorial',semanticFamily:'editorial-closing',kind:'full-screen-asset',role:'media',sfxFile:'v1-node-connect.wav',title:'接下来，我们每个月见一次',detail:'兰州AI实践者共创沙龙 · 从第一期继续往下做',imageSrc:'images/monthly-meet.png',fit:'cover',position:'50% 50%',spokenLine:'我会坚持继续做下去'}
];

const sfxVolumeByRole = {
  keyword: 0.27,
  media: 0.2,
  evidence: 0.22,
  line: 0.23,
  number: 0.24,
  list: 0.23,
  node: 0.22,
  comparison: 0.23,
};

const layers = sceneSpecs.map((scene, index) => {
  const cueId = `salon-sfx-${String(index + 1).padStart(3, '0')}`;
  const primary = scene.primary !== false;
  const source = scene.imageSrc
    ? `remotion/public-salon-20260920/${scene.imageSrc}`
    : `SalonHighlight/${scene.component}`;
  return {
    id: scene.id,
    start: scene.start,
    end: scene.end,
    spokenLine: scene.spokenLine,
    purpose: scene.imageSrc ? 'editorial-illustration' : 'semantic-emphasis',
    kind: primary ? scene.kind : 'ambient-overlay',
    variant: scene.component,
    titleOwner: true,
    overlapGroup: scene.id,
    zone: scene.imageSrc ? 'full-screen' : 'left-safe',
    title: scene.title,
    detail: scene.detail,
    items: scene.items ?? [],
    asset: {
      sourceType: scene.imageSrc
        ? 'user-provided-editorial-image'
        : 'remotion-component',
      source,
    },
    assetDecision: {
      class: scene.imageSrc ? 'real-evidence' : 'remotion-information',
      producer: scene.imageSrc ? 'user' : 'codex-remotion',
      requestId: null,
      fallback: 'speaker-plus-information',
      evidenceUse: scene.imageSrc ? 'illustration-or-navigation-only' : 'semantic-explanation',
    },
    visualEvent: {id: `salon-v${String(index + 1).padStart(3, '0')}`, enterAt: scene.start, primary},
    sound: {
      policy: primary ? 'required' : 'none',
      role: scene.role,
      cueId: primary ? cueId : null,
      offsetFrames: 0,
      maxSyncErrorFrames: 2,
      reason: primary ? undefined : '连续语义层保持静默，避免过密的卡片提示音。',
    },
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
      reviewAt: Number(((scene.start + scene.end) / 2).toFixed(2)),
    },
    background: scene.imageSrc ? 'opaque' : 'talk',
    presentation: {
      renderMode: scene.imageSrc ? 'media-fullscreen' : 'speaker-overlay',
      semanticFamily: scene.semanticFamily ?? scene.component,
      coverageRatio: scene.imageSrc ? 1 : 0.36,
      progressiveReveal: true,
    },
  };
});

const sceneById = new Map(sceneSpecs.map((scene) => [scene.id, scene]));
const cues = layers.filter((layer) => layer.visualEvent.primary).map((layer) => {
  const scene = sceneById.get(layer.id);
  const file = scene?.sfxFile;
  if (!file) throw new Error(`主视觉 ${layer.id} 缺少 sfxFile。`);
  const volume = sfxVolumeByRole[layer.sound.role] ?? 0.22;
  return {
    id: layer.sound.cueId,
    visualEventId: layer.visualEvent.id,
    role: layer.sound.role,
    start: layer.start,
    end: Number((layer.start + 1.4).toFixed(3)),
    source: `remotion/public-salon-20260920/audio/sfx/${file}`,
    license: file.startsWith('v1-') || file.startsWith('remotion-') ? 'CC0' : 'Mixkit Free License',
    licenseReference: 'assets/sfx/koubo-sfx-v8/manifest.json',
    volume,
    voiceDuckDb: 0,
    previewCovered: layer.start >= 78 && layer.start <= 123,
    formalReviewed: false,
    userAudibilityConfirmed: false,
  };
});

const plan = {
  schemaVersion: 4,
  experiment: {id:'v8-semantic-continuity-sfx',status:'candidate-preview-required'},
  videoId:'LANZHOU_AI_SALON_20260920_HIGHLIGHT',
  videoTitle:'兰州AI实践者共创沙龙·第一期',
  sourceVideo:'edit/20260920_lanzhou_ai_salon/01_原始素材/copy_7819D34A-CDF7-4608-890B-C4C73B77821E.MOV',
  transcript:'edit/20260920_lanzhou_ai_salon/05_实录与字幕/asr-refined',
  bilingualCaptions:null,
  baselineId:'koubo-formal-16x9-v1',
  styleReferenceIds:['v8-user-confirmed-default-20260811','v8-speaker-first-continuous-semantics','salon-user-provided-editorial-images'],
  target:{aspect:'16:9',width:1920,height:1080,fps:30,platform:'douyin'},
  previewCoverage:[
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
  editPolicy:'保留主持人开场与结尾核心、完整保护老徐账号数据主线，其他嘉宾各取一条完整论点；实录为字幕唯一正文。',
  assetCoverage:{usableUserImages:6,assignedUserImages:6,allRequiredClaimsCovered:true,note:'用户提供图片只作说明和流程导航，不作人物身份、数字或法律结论证据。'},
  layers,
};
const sfx = {
  schemaVersion:3,
  videoId:plan.videoId,
  version:'v1-salon-preview',
  experimentId:'v8-semantic-continuity-sfx',
  normalizedPack:'assets/sfx/koubo-sfx-v8/manifest.json',
  cues,
};

for (const [path, value] of [[editPlanPath, plan],[srcPlanPath, plan],[editSfxPath, sfx],[srcSfxPath, sfx]]) {
  mkdirSync(dirname(path), {recursive:true});
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
process.stdout.write(`已生成视觉计划 ${layers.length} 层、音效 ${cues.length} 条。\n`);
