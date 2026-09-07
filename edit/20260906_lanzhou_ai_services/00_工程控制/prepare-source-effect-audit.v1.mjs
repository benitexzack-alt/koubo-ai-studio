import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const repo = path.resolve(import.meta.dirname, '../../..');
const task = 'edit/20260906_lanzhou_ai_services';
const output = `${task}/04_导演拆解/shotcraft-source-audit-r2`;
const read = relative => JSON.parse(fs.readFileSync(path.join(repo, relative), 'utf8'));
const bind = relative => ({path: relative, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, relative))).digest('hex')});
const captionsPath = `${task}/09_实录与字幕/canonical-spoken.v1.json`;
const captions = read(captionsPath);
const layout = read(`${task}/04_导演拆解/postshoot-preparation-r1/postshoot-layout-preparation.v1.json`);
const materialReceipt = read(`${task}/00_工程控制/paper-asset-intake.v1.json`);
const paperWindows = layout.proposedPaperWindows.map(p => ({
  sceneId: p.sceneId,
  startMs: p.proposedSourceStart * 1000,
  endMs: (p.proposedSourceStart + materialReceipt.assets.find(a => a.sceneId === p.sceneId).duration) * 1000,
  approved: false,
}));

// These are source-time search intentions, not frame-accurate application decisions.
const intentions = {
  c001: ['请求支持的开场重点', ['emphasis'], ['包容和支持']],
  c002: ['本人在兰州的服务方向', ['emphasis'], ['在兰州', '企业AI应用落地']],
  c009: ['购买新工具不能代表持续价值', ['correction'], ['看着新鲜']],
  c010: ['员工是否真正能用', ['emphasis'], ['到底能不能用']],
  c011: ['交付可靠性和后续负责人的两项检查', ['list'], ['靠不靠谱', '能不能找到人']],
  c013: ['老板没有时间追模型更新', ['emphasis'], ['哪有那么多的时间']],
  c014: ['工具更新和老板想尝试的现实', ['emphasis'], ['什么工具']],
  c015: ['把模型接到公司资料是具体工作', ['process'], ['把模型接到公司的资料里面']],
  c017: ['引用服务商培育通知的时间与主题', ['evidence'], ['工信部专门发了通知']],
  c018: ['原文核对服务商培育及扎根用户现场', ['evidence', 'selection'], ['扎根用户的现场']],
  c019: ['政策背景到本人服务举例的过渡，不作官方背书', ['emphasis'], ['一个方向']],
  c020: ['以实录中的外贸企业为例，不能改成原稿的商贸', ['reveal'], ['外贸', '产品资料']],
  c021: ['文件和聊天记录里的业务资料', ['list'], ['报价单', '售后规定', '文件和聊天记录']],
  c022: ['新老员工之间反复找资料', ['process'], ['新员工', '老员工']],
  c023: ['版本拿错的实际风险', ['emphasis'], ['拿错版本']],
  c024: ['有效和作废资料必须先分清', ['correction'], ['有效的资料', '作废的资料']],
  c028: ['价格交付售后承诺须人确认后才发客户', ['emphasis'], ['确定后再发给客户']],
  c034: ['培训效果看实际核对而不是术语', ['correction'], ['核对一个结果', '比记住几个新名词实在']],
  c035: ['从员工使用转到客户了解企业', ['reveal'], ['客户通过AI了解你的公司']],
  c036: ['企业对外信息准确性', ['emphasis'], ['准确的信息']],
  c037: ['服务范围和真实案例', ['list'], ['服务哪些地方', '真实的案例']],
  c040: ['是否推荐不能保证，须实际核查', ['correction', 'list'], ['会不会推荐', '实际查', '持续看']],
  c041: ['应用贴近日常生活，保持实录用词', ['emphasis'], ['日常生活']],
  c042: ['未来客户咨询整理的任务示例', ['process'], ['客户咨询', '整理一下']],
  c043: ['资料和权限接好是执行前提', ['emphasis'], ['资料和权限接好的情况下']],
  c048: ['小范围改善值得做与本地继续实践', ['conclusion'], ['这样的变化就值得做']],
  c049: ['本地面对面看业务', ['list'], ['面对面聊', '一起看业务']],
  c052: ['本人承认仍需学习和改进', ['emphasis'], ['学习和改进']],
  c053: ['邀请指出实际不准确和不适用的地方', ['list'], ['说的不准确', '实际情况不一样']],
  c054: ['欢迎基于真实问题交流', ['emphasis'], ['欢迎直接指出来']],
  c055: ['真实问题交流就是支持', ['emphasis'], ['很实在的支持']],
  c056: ['实录的企业信息整理需求，不扩写服务承诺', ['emphasis'], ['企业信息整理']],
  c057: ['保持简短自然收尾', ['conclusion'], ['可以来找我']],
};

const beats = [];
const coverage = [];
for (const caption of captions.captions) {
  const papers = paperWindows.filter(p => caption.startMs < p.endMs && caption.endMs > p.startMs);
  if (caption.reviewRequired || papers.length) {
    coverage.push({captionId: caption.id, status: caption.reviewRequired ? 'deferred-transcript-uncertainty' : 'deferred-paper-window', uncertainIds: caption.uncertainIds, sceneIds: papers.map(p => p.sceneId), reason: '先保留完整字幕页的保护范围；不把尚未验收的纸艺或待核字幕当作可落片动效。'});
    continue;
  }
  const intention = intentions[caption.id];
  assert(intention, `Missing reviewed search intention: ${caption.id}`);
  const [purpose, semanticIntents, keyPhrases] = intention;
  for (const keyword of keyPhrases) assert(caption.zh.includes(keyword), `${caption.id}: ${keyword}`);
  const official = caption.id === 'c017' || caption.id === 'c018';
  const region = official ? {x: 72, y: 160, width: 1080, height: 510} : {x: 60, y: 160, width: 660, height: 320};
  const protectedRegions = official
    ? [{x: 1282, y: 600, width: 278, height: 278}, {x: 0, y: 900, width: 1920, height: 180}, {x: 1600, y: 720, width: 320, height: 180}]
    : [{x: 820, y: 0, width: 1100, height: 890}, {x: 0, y: 900, width: 1920, height: 180}];
  const beat = {
    beatId: `source-${caption.id}`,
    mainVisual: official ? 'real-evidence' : 'speaker',
    frames: {startFrame: Math.round(caption.startMs * 30 / 1000), endFrameExclusive: Math.round(caption.endMs * 30 / 1000)},
    quote: caption.zh, purpose, semanticIntents, keyPhrases,
    materialClass: official ? 'document' : 'talking-head',
    energy: 'low', existingVisualSufficiency: official || ['c015', 'c019', 'c041', 'c057'].includes(caption.id) ? 'high' : 'medium',
    region, protectedRegions,
  };
  if (official) beat.evidence = {
    asset: bind(`${task}/03_官方素材/${caption.id === 'c017' ? 'O01_通知标题与日期.png' : 'O01_扎根用户现场_原文段落.png'}`),
    rect: {x: 12, y: 170, width: 1056, height: 150},
    claimBoundary: '工信厅科函〔2026〕414号的政策背景，不是对本人或公司的资质认定或推荐；与开头另一份包容支持政策分开。具体框选位置尚未渲染复核。',
  };
  beats.push(beat);
  coverage.push({captionId: caption.id, status: 'source-time-catalog-analysis', beatId: beat.beatId});
}

const request = {
  schemaVersion: 'koubo-shotcraft-auto-match-request/v1',
  taskId: 'task-20260906T154937Z-69f6ebf8',
  revisionId: '20260907-lanzhou-ai-services-source-match-audit-r2',
  directorProfile: {profileId: 'paper-editorial-director-v9', profileVersion: '9.1.0'},
  subtitleAuthority: 'actual-recording',
  registry: bind('skills/koubo-shotcraft-library/registry.v1.json'),
  library: bind('skills/koubo-shotcraft-library/upstream/gallery/api/library.json'),
  capabilityIndex: bind('skills/koubo-shotcraft-library/card-capability-index.v2.json'),
  experienceLedger: bind('skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json'),
  componentModule: bind('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx'),
  captions: bind(captionsPath),
  canvas: {width: 1920, height: 1080, fps: 30, durationInFrames: 8149},
  beats,
  preparationOnly: {
    status: 'source-time-analysis-not-final-selection',
    timebase: 'R01-original-without-news-insert',
    frameQuantization: '共同毫秒边界统一四舍五入到最近30fps帧，最大取整误差半帧；不得分别向外扩展造成相邻效果叠层。',
    supersedesFailedRequest: bind(`${task}/04_导演拆解/shotcraft-source-audit-r1/source-match-request.v1.json`),
    source: bind(`${task}/02_原片/copy_3257E7D6-476D-4668-93F2-0CA1BD79F373.MOV`),
    paperReview: bind(`${task}/00_工程控制/paper-asset-intake.v1.json`),
    fullTranscriptApproved: false, compositionConsumed: false, renderAllowed: false,
    paperWindows, captionCoverage: coverage,
    remaining: ['字幕疑点确认后重匹配', '纸艺处置后重排时间窗', '插入新闻后转换输出时基', '风险帧检查与词级落点复核', '正式生产门禁未开放'],
  },
};
assert.equal(coverage.length, captions.captions.length);
for (let i = 1; i < beats.length; i++) assert(beats[i - 1].frames.endFrameExclusive <= beats[i].frames.startFrame, 'Unexpected adjacent effect overlap');
fs.mkdirSync(path.join(repo, output), {recursive: true});
fs.writeFileSync(path.join(repo, output, 'source-match-request.v1.json'), `${JSON.stringify(request, null, 2)}\n`, {flag: 'wx'});
console.log(JSON.stringify({output, analyzedCaptions: beats.length, deferredCaptions: coverage.length - beats.length, status: request.preparationOnly.status}, null, 2));
