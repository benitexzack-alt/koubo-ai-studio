import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const base='edit/20260919_ai_training_methods';
const directory=`${base}/06_剪辑工程`;
const runtimePath='remotion/src/ai-training-final-r1/runtime-plan.r1.json';
const captionPath=`${base}/05_实录与字幕/final-r1-bilingual-captions.json`;
const previousRequestPath=`${base}/07_预览与质检/录屏小样R2/request-r3.json`;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const bind=p=>({path:p,sha256:sha(p)});
const runtime=read(runtimePath),captions=read(captionPath),previous=read(previousRequestPath);
const run=(file,args)=>{
  const result=spawnSync(process.execPath,[file,...args],{cwd:root,encoding:'utf8'});
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.stderr)process.stderr.write(result.stderr);
  if(result.status!==0)throw Error(`本期Shotcraft检查失败:${file}`);
};
const paths={request:`${directory}/shotcraft-final-request.r1.json`,selection:`${directory}/shotcraft-final-selection.r1.json`,receipt:`${directory}/shotcraft-final-match-receipt.r1.json`,lookup:`${directory}/shotcraft-final-experience-lookup.r1.json`,coverage:`${directory}/shotcraft-final-coverage.r1.json`};
for(const value of Object.values(paths))if(fs.existsSync(value))throw Error(`输出已存在，不覆盖:${value}`);
const overlappingQuote=(start,end)=>captions.filter(c=>c.startMs<end/runtime.fps*1000&&c.endMs>start/runtime.fps*1000).map(c=>c.zh).join('');
const special=[...runtime.insertions.map(s=>({...s,mainVisual:s.route==='ai-generated-video'?'generated-video':s.route})),...runtime.screens.map(s=>({...s,mainVisual:'real-evidence'}))].sort((a,b)=>a.startFrame-b.startFrame);
const timeline=[];
let cursor=0,number=0;
for(const visual of special){
  if(visual.startFrame<cursor)throw Error(`主画面重叠:${visual.id}`);
  if(visual.startFrame>cursor)timeline.push({id:`speaker-${String(++number).padStart(2,'0')}`,mainVisual:'speaker',startFrame:cursor,endFrameExclusive:visual.startFrame});
  timeline.push(visual);
  cursor=visual.endFrameExclusive;
}
if(cursor<runtime.durationInFrames)timeline.push({id:`speaker-${String(++number).padStart(2,'0')}`,mainVisual:'speaker',startFrame:cursor,endFrameExclusive:runtime.durationInFrames});
const beats=timeline.map(visual=>{
  const frames={startFrame:visual.startFrame,endFrameExclusive:visual.endFrameExclusive};
  const quote=overlappingQuote(visual.startFrame,visual.endFrameExclusive);
  if(!quote)throw Error(`当前帧窗无实录依据:${visual.id}`);
  if(visual.id==='screen-question'){
    const accepted=structuredClone(previous.beats.find(b=>b.beatId===visual.id));
    if(frames.startFrame!==accepted.frames.startFrame+3846||frames.endFrameExclusive!==accepted.frames.endFrameExclusive+3846)throw Error('已认可框选窗偏移失配');
    accepted.frames=frames;
    if(!quote.includes(accepted.quote))throw Error('已认可框选文字与当前实录不符');
    return accepted;
  }
  if(visual.id==='screen-archive')return{
    beatId:visual.id,mainVisual:visual.mainVisual,frames,quote,
    purpose:'驾驶舱实录已裁切为独立视窗，左下角同步保留真人且字幕分区；现有聚焦足以展示实际存档界面，不新增信息层，不声称证明学习进步。',
    semanticIntents:[],materialClass:'screen-recording',energy:'medium',existingVisualSufficiency:'high',
    region:{x:560,y:180,width:1080,height:400},protectedRegions:[{x:64,y:600,width:278,height:278},{x:0,y:900,width:1920,height:180}],
  };
  if(visual.mainVisual==='speaker')return{
    beatId:visual.id,mainVisual:visual.mainVisual,frames,quote,
    purpose:'完整保留本段真实口播；既有V8连续语义层和电子运镜已承担关键词呈现与关注点引导，不重复叠加第二套解释卡。',
    semanticIntents:[],materialClass:'talking-head',energy:'medium',existingVisualSufficiency:'high',
    region:{x:60,y:120,width:400,height:160},protectedRegions:[{x:530,y:0,width:1390,height:900},{x:0,y:900,width:1920,height:180}],
  };
  return{
    beatId:visual.id,mainVisual:visual.mainVisual,frames,quote,semanticIntents:[],existingVisualSufficiency:'high',
    materialClass:visual.mainVisual==='paper-editorial'?'paper-video':'generated-video',
    purpose:visual.mainVisual==='paper-editorial'?'现有纸艺视频完整承担该段解释与物件动画，内部禁止添加Shotcraft。':'现有AI情景视频完整演绎客户临时需求变动与现场回应，内部禁止添加Shotcraft。',
  };
});
const request={
  schemaVersion:'koubo-shotcraft-auto-match-request/v1',taskId:previous.taskId,revisionId:'ai-training-final-r1',directorProfile:previous.directorProfile,subtitleAuthority:'actual-recording',
  ...Object.fromEntries(['registry','library','capabilityIndex','experienceLedger','componentModule'].map(key=>[key,bind(previous[key].path)])),
  captions:bind(captionPath),canvas:{width:runtime.width,height:runtime.height,fps:runtime.fps,durationInFrames:runtime.durationInFrames},beats,
};
fs.writeFileSync(paths.request,JSON.stringify(request,null,2)+'\n',{flag:'wx'});
run('skills/koubo-shotcraft-library/scripts/match-director-effects.mjs',['--request',paths.request,'--selection',paths.selection,'--receipt',paths.receipt,'--lookup',paths.lookup,'--repo-root','.']);
run('skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs',[paths.selection,'.']);
const selection=read(paths.selection),receipt=read(paths.receipt),applied=selection.beats.filter(b=>b.decision==='apply');
if(applied.length!==1||applied[0].beatId!=='screen-question'||applied[0].effectId!=='evidence-scan')throw Error('自动结果出现新应用，必须停止而非手工改写选择');
if(receipt.summary.analyzedCardCount!==157)throw Error('未完成当前157卡全库匹配');
const covered=timeline.reduce((sum,b)=>sum+b.endFrameExclusive-b.startFrame,0);
if(covered!==runtime.durationInFrames||timeline[0].startFrame!==0||timeline.at(-1).endFrameExclusive!==runtime.durationInFrames)throw Error('全片主画面未完整覆盖');
for(let i=1;i<timeline.length;i++)if(timeline[i-1].endFrameExclusive!==timeline[i].startFrame)throw Error('主画面存在缝隙');
fs.writeFileSync(paths.coverage,JSON.stringify({
  schemaVersion:'ai-training-shotcraft-full-timeline-coverage/v1',runtime:bind(runtimePath),captions:bind(captionPath),request:bind(paths.request),selection:bind(paths.selection),receipt:bind(paths.receipt),lookup:bind(paths.lookup),
  durationInFrames:runtime.durationInFrames,coveredFrames:covered,uncoveredFrames:0,overlappingFrames:0,totalBeats:beats.length,
  counts:Object.fromEntries(['speaker','real-evidence','paper-editorial','generated-video'].map(route=>[route,beats.filter(b=>b.mainVisual===route).length])),
  actualMatcherExecuted:true,selectionValidatorExecuted:true,analyzedCardCount:receipt.summary.analyzedCardCount,
  applicationIntents:applied.map(b=>({beatId:b.beatId,effectId:b.effectId,frames:b.frames,component:'EvidenceScan'})),
  constraints:{newShotcraftApplications:false,generatedAndPaperShotcraftForbidden:true,approvedScreenEvidenceMovedByFrames:3846,noSharedCatalogOrExperienceWrites:true},
  finalApplicationReceiptPending:true,finalWatchConfirmed:false,
},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'全片自动匹配与时间轴覆盖检查通过',paths,beatCount:beats.length,apply:applied.map(b=>b.beatId)},null,2));
