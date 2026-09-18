import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../../..');
const base = 'edit/20260917_ai_efficiency_sharing';
const work = `${base}/06_剪辑工程`;
const publicDir = 'remotion/public-employee-ai-efficiency-v8-r1';
const runtimeDir = 'remotion/src/employee-ai-efficiency-v8-r1';
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const ref = p => ({path: p, sha256: hash(p)});
const write = (p, value) => {
  fs.mkdirSync(path.dirname(path.join(root, p)), {recursive: true});
  fs.writeFileSync(path.join(root, p), JSON.stringify(value, null, 2) + '\n');
};
const copies = [];
const copy = (source, target) => {
  fs.mkdirSync(path.dirname(path.join(root, target)), {recursive: true});
  const sourceSha = hash(source);
  if (!fs.existsSync(path.join(root, target)) || hash(target) !== sourceSha) {
    fs.copyFileSync(path.join(root, source), path.join(root, target), fs.constants.COPYFILE_FICLONE);
  }
  if (hash(target) !== sourceSha) throw new Error(`素材复制校验失败：${target}`);
  copies.push({source, target, sha256: sourceSha});
};
const plan = read(`${work}/postshoot-edit-plan.v1.json`);
const policyPath = `${base}/05_实录与字幕/employee-ai-efficiency.spoken-source-policy.v1.json`;
const policy = read(policyPath);
const manifestPath = 'assets/sfx/koubo-sfx-v8/manifest.json';
const manifest = read(manifestPath);
const source = 'media/host.MOV';
copy(plan.source.path, `${publicDir}/${source}`);
for (const clip of plan.insertions) copy(clip.original.path, `${publicDir}/${clip.src}`);
copy('remotion/public/fonts/STHeiti-Medium.ttc', `${publicDir}/fonts/STHeiti-Medium.ttc`);
copy(plan.captions.path, `${publicDir}/data/captions.v1.json`);

// 只强调实录中的原词，不增加标题、事实或另造纸牌文字。
const callouts = [
  {id:'Q01',start:6.74,end:8.76,lines:['装不会'],fontSize:72,accent:'#FFBE55',quote:'全在集体装不会'},
  {id:'Q02',start:47.02,end:48.92,lines:['机制的问题'],fontSize:62,accent:'#62D8FF',quote:'这是机制的问题'},
  {id:'Q03',start:83.42,end:85.52,lines:['怎么分配'],fontSize:64,accent:'#FFBE55',quote:'到底怎么分配'},
  {id:'Q04',start:100.9,end:102.9,lines:['三个建议'],fontSize:62,accent:'#62D8FF',quote:'三个建议'},
  {id:'Q05',start:141.2,end:145.2,lines:['企业和员工','共赢的生产力'],fontSize:46,accent:'#FFBE55',quote:'企业和员工共赢的生产力'},
];
const soundSpecs = [
  ['S01',6.74,'waic-thesis-impact',0.34,'关键词','钩子中的装不会落点'],
  ['S02',449/30,'v3-media-whoosh-b',0.32,'媒体切换','会议场景切入'],
  ['S03',748/30,'v1-ui-click',0.30,'媒体切换','工具一开与工位镜头'],
  ['S04',47.02,'v3-soft-card-pop-b',0.34,'关键词','机制问题出现'],
  ['S05',1815/30,'v3-evidence-paper-a',0.30,'纸艺','加项目的文件入场'],
  ['S06',83.42,'v1-keyword-tick',0.42,'关键词','怎么分配的问句'],
  ['S07',100.9,'v1-section-air',0.38,'章节','三个建议'],
  ['S08',3218/30,'remotion-page-turn',0.38,'纸艺','工时与冗余场景'],
  ['S09',3417/30,'v1-node-connect',0.34,'连线','反哺团队场景'],
  ['S10',130.93,'v3-line-connect-a',0.28,'连线','统一流程连接完成前'],
  ['S11',141.2,'v1-confirm-soft',0.42,'确认','共赢的生产力'],
];
const cues = soundSpecs.map(([id,time,key,volume,role,purpose]) => {
  const item=manifest.items.find(x=>x.id===key);
  if (!item?.eligibleForSfx) throw new Error(`音效不可用：${key}`);
  if (hash(item.output)!==item.outputSha256) throw new Error(`音效哈希不一致：${key}`);
  const src=`audio/koubo-sfx-v8/${path.basename(item.output)}`;
  copy(item.output,`${publicDir}/${src}`);
  return {id,time,file:path.basename(item.output),src,volume,role,purpose,license:item.license,
    licenseReference:item.licenseReference,sha256:item.outputSha256,durationSeconds:item.durationSeconds,
    sourcePeakDbfs:item.outputPeakDbfs,estimatedScaledPeakDbfs:item.outputPeakDbfs+20*Math.log10(volume)};
});
let cursor=0;
const previewRanges=plan.previewRanges.map(x=>{
  const startFrame=Math.round(x.start*30),endFrame=Math.round(x.end*30);
  const item={...x,startFrame,endFrame,outputStartFrame:cursor,durationInFrames:endFrame-startFrame};
  cursor+=item.durationInFrames;return item;
});
const runtime={fps:30,width:1920,height:1080,durationInFrames:4669,sourceVideo:source,
  captionsSrc:'data/captions.v1.json',audioReviewComplete:policy.compliance.status==='passed',
  sourcePolicy:plan.sourcePolicy,insertions:plan.insertions,callouts,sfxCues:cues,
  previewRanges,previewDurationInFrames:cursor,
  motion:{cuts:[0,4.2,8.76,12.8,20.08,24.92,27.42,32.76,39.32,45.52,48.92,56.32,59.6,65.66,69.94,72.72,78.76,85.52,92.36,98.7,102.9,107.24,112.3,119.08,123.42,126.9,131.64,134,137.5,145.2,151.54],
    baseScale:1,peakScales:[1.018,1.025,1.014,1.022],peakX:[0,0,0,0],peakY:[0,0,0,0],transformOrigin:'53% 41%'}};
write(`${runtimeDir}/runtime-plan.v1.json`,runtime);
write(`${work}/音效安排.v1.json`,{schemaVersion:3,status:'candidate-awaiting-user-audition',manifest:ref(manifestPath),cues,userAudibilityConfirmed:false,
  note:'音量为待试听起点；源峰值缩放估算不等于人声混音后的实测响度。'});
write(`${work}/本期视听安排.v1.json`,{schemaVersion:4,productionProfile:{id:'v8-semantic-continuity-sfx',version:'V8'},
  sourceAuthority:'recorded-audio',speakerDefault:true,background:'talk',insertions:plan.insertions,
  callouts,informationRegion:plan.overlayRegion,protectedRegions:plan.protectedRegions,
  motion:runtime.motion,shotcraft:{selection:ref(`${work}/shotcraft-selection.v2.json`),applyCount:0},
  previewRanges,previewDurationInFrames:cursor,fullWatchConfirmed:false,
  dynamicAcceptance:'pending-render-and-user-review',factsVerified:false});
for (const variant of ['with-sfx','no-sfx']) {
  const output=`${base}/07_预览与质检/员工AI增效分配_代表预览_${variant==='with-sfx'?'有附加音效':'仅原声'}_v1.mp4`;
  const job={schemaVersion:1,jobId:`20260917-ai-efficiency-sharing-v8-r1-${variant}`,videoId:plan.videoId,
    title:'员工使用AI与增效分配',productionState:'blocked',productionProfile:{id:'v8-semantic-continuity-sfx',version:'V8'},
    experiment:{id:'v8-semantic-continuity-sfx',userPreviewApproved:false},
    inputs:{source:plan.source.path,transcript:`${base}/05_实录与字幕/employee-ai-efficiency.actual.cleaned.v1.json`,
      bilingualCaptions:plan.captions.path,captions:plan.captions.path,spokenSourcePolicy:policyPath,
      visualPlan:`${work}/本期视听安排.v1.json`,sfxCueSheet:`${work}/音效安排.v1.json`,
      sfxManifest:manifestPath,timingRebind:`${work}/postshoot-edit-plan.v1.json`},
    remotion:{root:'remotion',entry:'src/employee-ai-efficiency-v8-r1/index.tsx',publicDir,
      compositionWithSfx:'EmployeeAIEfficiencyV8-Preview-WithSfx',compositionWithoutSfx:'EmployeeAIEfficiencyV8-Preview-NoSfx',
      fps:30,width:1920,height:1080,durationSeconds:cursor/30},
    preview:{enabled:true,output,ranges:previewRanges,renderWithoutSfxComparison:true},
    formal:{enabled:false,rawOutput:null,blockedReason:'先确认代表预览，并满足当前生产入口；未授权跳过。'},
    finalReview:{fullWatchConfirmed:false,reviewOutcome:'pending'},
    knowledgeContext:{taskId:'task-20260918T020544Z-31f85b17',contextPath:'task-20260918T020544Z-31f85b17/context.json'},
    productionGate:{schema:'director-production-entry-binding/v2',revisionId:'ai-efficiency-sharing-v8-r1',
      state:'blocked-awaiting-native-v2-entry',directorContract:null,formalEnabled:false,userPreviewApproved:false},
    blockers:[...(runtime.audioReviewComplete?[]:['一句字幕等待用户听辨']),
      '本期已完成v2导演交接；当前预览入口仍要求旧生产合同与独立签名，尚无本期可用授权适配',
      '预览未生成，用户尚未观看；正式渲染保持关闭'],publishAuthorized:false};
  write(`${work}/production-preview.${variant}.v1.json`,job);
}
write(`${work}/本地素材绑定回执.v1.json`,{status:'local-copies-hash-verified',copies,
  originalMaterialsModified:false,previewProduced:false,formalProduced:false});
console.log(JSON.stringify({mediaCopies:copies.length,insertions:runtime.insertions.length,callouts:callouts.length,
  sfx:cues.length,previewSeconds:cursor/30,fullSeconds:4669/30,audioReviewComplete:runtime.audioReviewComplete}));
