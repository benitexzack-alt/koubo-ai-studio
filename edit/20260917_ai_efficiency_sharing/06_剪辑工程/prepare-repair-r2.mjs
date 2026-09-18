import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(import.meta.dirname,'../../..');
const base='edit/20260917_ai_efficiency_sharing';
const target='remotion/src/employee-ai-efficiency-v8-r2';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const write=(p,v)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');};
const old=read('remotion/src/employee-ai-efficiency-v8-r1/runtime-plan.v1.json');
const fps=30;
const layer=(id,start,end,component,title,items,times,detail='',detailAt=start,label='')=>({
  id,start,end,title,detail,items,
  params:{component,label,itemFrames:times.map(t=>Math.round((t-start)*fps)),detailFrame:Math.round((detailAt-start)*fps),equalBars:true},
});
const layers=[
  layer('L01',4.2,8.76,'comparison','真正会用AI的人',['会用AI','装不会'],[4.2,6.74],'',4.2,'职场默契'),
  layer('L02',8.76,12.8,'statement','表面上',[],[],'全靠手动',10.68,'职场默契'),
  layer('L03',20.1,24.8,'statement','可背地里',['Cursor','Codex'],[22.84,23.6],'',20.1,'职场默契'),
  layer('L04',29.44,32.26,'statement','继续潜水',[],[],'深藏功与名',30.5,'职场默契'),
  layer('L05',32.76,39.32,'comparison','心照不宣',['嘴上都说AI不行','私下偷偷提速'],[32.76,36.5],'',32.76,'职场默契'),
  layer('L06',45.52,48.92,'statement','不是人的问题',['机制的问题'],[47.02],'',45.52,'机制'),
  layer('L07',50.42,56.32,'statement','员工会用AI',[],[],'结果是什么？',53.84,'换个角度想'),
  layer('L08',56.32,59.6,'comparison','结果是什么？',['加薪吗？','减负吗？'],[56.32,57.35],'都不是',58.5,'换个角度想'),
  layer('L09',1970/30,69.94,'comparison','最后呢',['活越干越多','工资一分没涨'],[1970/30,67.65],'',1970/30,'换个角度想'),
  layer('L10',75.12,78.76,'process','从来不是',['把工具买回来','发个通知就完事了'],[75.12,76.6],'',75.12,'企业AI落地'),
  {...layer('L11',81.2,92.36,'node-map','效率提升之后',['新的工作量','分享增效的红利'],[85.52,88.34],'到底怎么分配？',83.42,'核心问题'),params:{
    component:'node-map',label:'核心问题',hubLabel:'时间和产能',hubFrame:37,itemFrames:[130,214],detailFrame:67,equalBars:true}},
  layer('L12',92.36,98.7,'comparison','AI',['压榨员工的新工具','组织降本增收的武器'],[92.36,95.52],'',92.36,'怎么分配'),
  layer('L13',100.9,102.9,'statement','三个建议',[],[],'',100.9,'想做AI的老板'),
  layer('L14',102.9,3218/30,'statement','别搞',[],[],'AI提效＝加量不加价',104.98,'第一'),
  layer('L15',119.08,122.94,'process','大家才有动力',['公开用','全力推'],[120.25,121.6],'',119.08,'反哺团队'),
  layer('L16',123.42,3794/30,'statement','个人偷偷用的AI能力',[],[],'',123.42,'第三'),
  layer('L17',134,137.5,'statement','AI落地',[],[],'不是谁的工具更先进',134.9,'AI落地'),
  layer('L18',137.5,145.2,'process','拼的是',['偷偷摸鱼的工具','共赢的生产力'],[138.4,141.2],'企业和员工',141.2,'AI落地'),
  layer('L19',151.54,154.98,'statement','关注超哥',[],[],'只讲AI落地的底层逻辑',152.65,'超哥AI创业记'),
];
const selectionPath=`${base}/06_剪辑工程/shotcraft-selection.r2-refined.json`;
if(fs.existsSync(path.join(root,selectionPath))){
  const selected=read(selectionPath).beats.filter(x=>x.decision==='apply');
  for(const item of selected){
    if(item.effectId!=='marker-underline'||!['B02','B11'].includes(item.beatId))throw new Error('新增选卡需先核对实际组件');
    const layer=layers.find(x=>x.id===(item.beatId==='B02'?'L01':'L06'));
    layer.params.marker={itemIndex:item.beatId==='B02'?1:0,startFrame:item.frames.startFrame-Math.round(layer.start*30),
      durationInFrames:item.frames.endFrameExclusive-item.frames.startFrame,...item.componentProps};
  }
}
const ranges=[
  {start:4.2,end:12.8,purpose:'钩子对照和语义运镜'},
  {start:43.62,end:49.4,purpose:'机制判断和推进回落'},
  {start:81.2,end:92.36,purpose:'持续分配关系图'},
  {start:123.42,end:134,purpose:'真人与既有纸艺衔接'},
  {start:137.5,end:145.2,purpose:'共同生产力的连续流程'},
];
let cursor=0;
const previewRanges=ranges.map(x=>{const startFrame=Math.round(x.start*fps),endFrame=Math.round(x.end*fps);const item={...x,startFrame,endFrame,outputStartFrame:cursor,durationInFrames:endFrame-startFrame};cursor+=item.durationInFrames;return item;});
const motion={cuts:[0,4.2,12.8,20.1,27.4333333333,32.76,39.32,45.52,50.42,56.32,60.5,1970/30,72.72,78.76,85.52,92.36,98.7,107.2666666667,112.3,119.08,123.42,131.6333333333,137.5,145.2,151.54],
  baseScale:1.012,peakScales:[1.065,1.075,1.07,1.08],peakX:[-12,14,-16,12],peakY:[2,3,2,3],transformOrigin:'53% 38%'};
const runtime={...old,layers,callouts:[],motion,previewRanges,previewDurationInFrames:cursor,revisionId:'ai-efficiency-sharing-v8-r2'};
write(`${target}/runtime-plan.v2.json`,runtime);
write(`${base}/06_剪辑工程/本期视听安排.r2.json`,{schemaVersion:4,productionProfile:{id:'v8-semantic-continuity-sfx',version:'V8'},
  revisionId:runtime.revisionId,sourceAuthority:'recorded-audio',speakerDefault:true,background:'talk',layers,motion,insertions:old.insertions,sfxCues:old.sfxCues,
  informationRegion:{x:78,y:128,width:510,height:380},protectedRegions:read(`${base}/06_剪辑工程/postshoot-edit-plan.v1.json`).protectedRegions,
  previewRanges,fullWatchConfirmed:false,formalEnabled:false,publishAuthorized:false,
  restoration:'从既有兰州产业AI的V8独立快照复用透明信息层，仅绑定本期文字、语义时点和保护区；原声、字幕与六段素材不变。'});

// 固化已提交历史组件，避免依赖共享工作区中未确认的改动。
const snapshot='remotion/src/lanzhou-industry-ai-v91-candidate-r1/V8SemanticStageSnapshot.r2.tsx';
const snapshotTarget=`${target}/V8SemanticStage.r2.tsx`;
if(!fs.existsSync(path.join(root,snapshotTarget)))fs.copyFileSync(path.join(root,snapshot),path.join(root,snapshotTarget));
write(`${base}/06_剪辑工程/组件来源.r2.json`,{source:{path:snapshot,sha256:sha(snapshot)},local:snapshotTarget,
  adaptation:'仅调整本期安全区、实录标签和节点时点，保留既有配色、字体与形态；不修改共享组件。'});
const request=read(`${base}/06_剪辑工程/shotcraft-auto-match-request.v1.json`);
request.revisionId='ai-efficiency-sharing-edit-release-r2';
for(const beat of request.beats){
  const restored=layers.filter(l=>Math.round(l.start*30)<beat.frames.endFrameExclusive&&Math.round(l.end*30)>beat.frames.startFrame);
  beat.existingVisualSufficiency='high';
  beat.purpose=restored.length?`既有V8 ${restored.map(l=>l.params.component).join('、')} 已表达本段；仅评估能增加理解且不重复的信息效果。`:'本段保留真人反问或判断，核对是否确有额外聚焦需要。';
  if(beat.beatId==='B02'||beat.beatId==='B11'){
    const hook=beat.beatId==='B02';
    beat.frames={startFrame:Math.round((hook?6.74:47.02)*30),endFrameExclusive:Math.round((hook?8.36:48.92)*30)};
    beat.quote=hook?'装不会':'机制的问题';
    beat.purpose='在既有V8信息层的同一关键词下划线，明确标出反差或纠正落点；不另起重复卡片。';
    beat.semanticIntents=hook?['emphasis']:['correction','emphasis'];
    beat.existingVisualSufficiency='medium';
  }
}
write(`${base}/06_剪辑工程/shotcraft-auto-match-request.r2.json`,request);
fs.copyFileSync(path.join(root,'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx'),path.join(root,target,'ShotcraftEffects.generated.tsx'));
console.log(JSON.stringify({layers:layers.length,previewFrames:cursor,previewSeconds:cursor/fps,motion,formalEnabled:false}));
