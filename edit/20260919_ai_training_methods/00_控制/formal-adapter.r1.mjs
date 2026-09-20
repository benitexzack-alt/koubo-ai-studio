import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync} from 'node:fs';
import {isAbsolute,relative,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {collectProductionBoundFilesV2,computeProductionCompositionBindingV2,computeProductionJobSnapshotSha256V2,stableJsonSha256ForProductionGateV2} from '../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {assertNoRetiredGeneratedStyle} from '../../../tools/generated-style-policy.mjs';

export const BASE='edit/20260919_ai_training_methods';
export const CONTROL=`${BASE}/00_控制`;
export const JOB=`${BASE}/06_剪辑工程/production-formal.r1.json`;
export const MANIFEST=`${CONTROL}/formal-manifest.r1.json`;
export const RUNTIME='remotion/src/ai-training-final-r1/runtime-plan.r1.json';
export const ROUTE='ai-training-methods-scoped-formal-r1';
export const PUBLIC='remotion/public-ai-training-final-r1';
export const SOURCE=`${BASE}/01_素材投放区/01_口播原片/copy_8757A6D8-5512-41B6-AE11-BA9F629D6616.MOV`;
export const SOURCE_SHA='9356cc470c6628560dff1035afcc6edcbc820f85d21f31cb2d46c54e0650899a';
export const PREVIEW=`${BASE}/07_预览与质检/录屏小样R2/有附加音效.mp4`;
export const PREVIEW_SHA='155b387c33cc309c0638d2faa7ed7cb8a464e4325dde8998ee6e360d149b9ae4';
export const QUOTES=[
 '嗯，再就是音效啊，把这些音效重点音效都加上，然后这个左边的motion的这个动效卡可以再放大一点，有点小，其他都没有问题。然后按这个修改完之后，直接出成片，再不需要出样片',
 '保留原声，所有按照原视频的文字导出。重点还是音效问题，每一个RemoShow的动效，把音效都加上。',
];
export const SELF='tools/scoped-direct-export-core.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const same=(a,b)=>stableJsonSha256ForProductionGateV2(a)===stableJsonSha256ForProductionGateV2(b);
const assert=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'AITF1_BINDING'});};
const inside=(root,p)=>{
 assert(typeof p==='string'&&p&&!isAbsolute(p),'绑定路径必须为项目相对路径');
 const absolute=resolve(root,p),rel=relative(root,absolute);
 assert(rel===p&&!rel.startsWith(`..${sep}`),'路径不得逃逸项目');
 let cursor=root;for(const part of rel.split(sep)){cursor=resolve(cursor,part);assert(existsSync(cursor)&&!lstatSync(cursor).isSymbolicLink(),`路径不存在或是符号链接：${p}`);}
 assert(lstatSync(absolute).isFile()&&realpathSync(absolute)===absolute,`绑定必须是普通文件：${p}`);return absolute;
};
const read=(root,p)=>JSON.parse(readFileSync(inside(root,p),'utf8'));
const bound=(root,ref)=>{assert(/^[a-f0-9]{64}$/u.test(ref?.sha256??''),'绑定摘要无效');const bytes=readFileSync(inside(root,ref.path));assert(hash(bytes)===ref.sha256,`文件已改变：${ref.path}`);return bytes;};
export const isAITrainingFormalR1=job=>job?.productionGate?.route===ROUTE;
export function collectAITrainingFormalR1Bindings({projectRoot,job}){
 const copy=structuredClone(job);copy.inputs.fingerprintPaths=copy.inputs.fingerprintPaths.filter(p=>![SELF,MANIFEST].includes(p));
 return {jobSnapshotSha256:computeProductionJobSnapshotSha256V2(job),boundFiles:collectProductionBoundFilesV2({projectRoot,job:copy}).filter(x=>![SELF,MANIFEST].includes(x.path)),compositionBinding:computeProductionCompositionBindingV2(job,{projectRoot})};
}
export function assertAITrainingFormalR1({projectRoot,job,jobPath=null,command,pin}){
 const root=resolve(projectRoot),gate=job.productionGate;
 assert(['direct-remotion-render','formal','formal-audio','qa','release-validation'].includes(command),'本期入口仅允许正式输出及质检');
 assert(jobPath===null||(isAbsolute(jobPath)?relative(root,jobPath):jobPath)===JOB,'不是本期固定任务');
 assert(same(read(root,JOB),job),'任务与磁盘不一致');
 assert(job.jobId==='20260919-ai-training-methods-v8-final-r1'&&job.videoId==='20260919_ai_training_methods','任务身份不一致');
 assert(gate.schema==='director-production-entry-binding/v2'&&gate.route===ROUTE&&gate.state==='scoped-formal-authorized-r1'&&gate.revisionId==='ai-training-methods-v8-final-r1'&&gate.formalEnabled===true&&gate.userPreviewApproved===true,'正式授权字段不一致');
 assert(job.formal?.enabled===true&&job.finalReview?.fullWatchConfirmed===false&&job.publishAuthorized===false,'禁止把候选成片标为全片已确认或已授权发布');
 assert(gate.scopedDirectExport?.path===MANIFEST&&gate.scopedDirectExport?.sha256===pin&&/^[a-f0-9]{64}$/u.test(pin??''),'本期固定清单摘要不一致');
 const manifest=JSON.parse(bound(root,gate.scopedDirectExport));
 assert(manifest.schema==='ai-training-methods-formal-manifest/v1'&&manifest.route===ROUTE&&manifest.jobPath===JOB,'正式清单身份不一致');
 const current=collectAITrainingFormalR1Bindings({projectRoot:root,job});
 assert(same(current,manifest.binding),'媒体、字幕、声音、运行代码或正式任务发生漂移，必须重新绑定');
 const files=new Map(current.boundFiles.map(x=>[x.path,x]));
 const auth=JSON.parse(bound(root,manifest.authorization));
 assert(auth.previewScope==='42-second-representative-section'&&auth.previewApproved===true&&auth.skipAdditionalPreview===true&&auth.formalEnabled===true&&auth.fullWatchConfirmed===false&&auth.publishAuthorized===false,'实际用户授权范围不一致');
 assert(same(auth.userQuotes,QUOTES)&&auth.evidence.length===QUOTES.length,'用户原话不一致');
 for(const [i,ref] of auth.evidence.entries()){
   assert(files.has(ref.path),'授权证据没有进入哈希闭包');const event=JSON.parse(bound(root,ref).toString('utf8'));
   const text=event.payload?.content?.filter(x=>['input_text','text'].includes(x.type)).map(x=>x.text).join('\n').trim();
   assert(event.type==='response_item'&&event.payload?.role==='user'&&text===QUOTES[i],'授权必须来自本任务真实用户消息');
 }
 assert(auth.preview.path===PREVIEW&&auth.preview.sha256===PREVIEW_SHA&&hash(readFileSync(inside(root,PREVIEW)))===PREVIEW_SHA,'认可的R2小样发生变化');
 assert(job.inputs.source===SOURCE&&files.get(SOURCE)?.sha256===SOURCE_SHA,'正式原片不一致');
 assert(job.remotion?.entry==='src/ai-training-final-r1/index.tsx'&&job.remotion?.publicDir===PUBLIC&&job.remotion?.compositionWithSfx==='AITrainingV8-Final-WithSfx'&&job.remotion?.durationSeconds===9155/30&&job.remotion?.fps===30&&job.remotion?.width===1920&&job.remotion?.height===1080,'正式片必须覆盖完整9155帧');
 const runtime=read(root,RUNTIME);
 assert(runtime.durationInFrames===9155&&Array.isArray(runtime.motionEvents)&&runtime.motionEvents.length>0&&Array.isArray(runtime.sfxCues),'缺少完整动效与逐项音效计划');
 const ids=runtime.motionEvents.map(x=>x.id);assert(new Set(ids).size===ids.length,'动效事件编号重复');
 for(const event of runtime.motionEvents){const cues=runtime.sfxCues.filter(x=>x.eventId===event.id);assert(cues.length>=1,`动效缺少音效：${event.id}`);for(const cue of cues)assert(Number.isInteger(cue.frame)&&cue.frame>=0&&cue.frame<9155&&Math.abs(cue.frame-event.frame)<=2&&Number.isFinite(cue.volume)&&cue.volume>0&&cue.volume<=1,`音效未对齐动效或音量无效：${event.id}`);}
 for(const cue of runtime.sfxCues){
   assert(ids.includes(cue.eventId),`音效没有对应动效：${cue.eventId}`);
   assert(typeof cue.file==='string'&&/^audio\/sfx\/[a-zA-Z0-9_-]+\.wav$/u.test(cue.file),'本期音效只能使用audio/sfx内的wav文件');
   assert(/^[a-f0-9]{64}$/u.test(cue.sha256??'')&&files.get(`${PUBLIC}/${cue.file}`)?.sha256===cue.sha256&&files.get(cue.source)?.sha256===cue.sha256,`音效源/渲染副本未绑定或内容不同：${cue.file}`);
 }
 assert(same(runtime.originalVoice,{continuous:true,startFrame:0,endFrameExclusive:9155,speed:1,deletedRanges:[]})&&runtime.mix==='audio/final-mix.wav'&&runtime.semanticScale===1.15,'原声完整保留或放大参数不匹配');
 assert(files.has(`${PUBLIC}/audio/final-mix.wav`)&&files.has(`${PUBLIC}/audio/original.wav`),'缺少原声或完整混音');
 const profile=read(root,'workflow/active-production-profile.v1.json');assert(profile.profileVersion==='V8'&&job.productionProfile?.id===profile.profileId&&job.productionProfile?.version==='V8','必须使用V8基线');
 assert(job.preview?.enabled===false&&job.preview?.output===null&&job.preview?.ranges?.length===0,'不能把小样冒充正式片');
 assert(job.formal.rawOutput===`${BASE}/08_正式成片/AI八种训练方法_R1_正式渲染原始.mp4`&&job.formal.finalOutput===`${BASE}/08_正式成片/AI八种训练方法_V8_R1_1080P_正式候选.mp4`,'正式输出必须限定本期且原始与最终分离');
 const registry=read(root,'workflow/director-production-freeze-registry.v2.json');assert(!registry.blockedJobFiles.some(x=>x.jobId===job.jobId),'已冻结任务不可渲染');
 const spoken=spawnSync(process.execPath,[resolve(root,'tools/check-spoken-source-policy.mjs'),...['transcript','bilingualCaptions','spokenSourcePolicy'].map(k=>resolve(root,job.inputs[k]))],{cwd:root,encoding:'utf8'});assert(spoken.status===0,`实录字幕检查失败：${spoken.stderr||spoken.stdout}`);
 assertNoRetiredGeneratedStyle({value:{job,manifest},operation:ROUTE,projectRoot:root,documentPaths:[JOB,MANIFEST]});
 return {ok:true,status:'formal-entry-director-bound',route:ROUTE,manifestPath:MANIFEST,manifestSha256:pin,episodeId:'20260919_ai_training_methods',jobId:job.jobId,revisionId:gate.revisionId,userPreviewApproved:true,fullWatchConfirmed:false,publishAuthorized:false,...current,directorBinding:{ok:true,status:'single-episode-authorized-manual-import-bound',postshootEvidence:'actual-spoken-timeline',skillPackageAccepted:false,userPreviewApproved:true,previewScope:'42-second-representative-section',skipAdditionalPreview:true,fullWatchConfirmed:false,publishAuthorized:false}};
}
