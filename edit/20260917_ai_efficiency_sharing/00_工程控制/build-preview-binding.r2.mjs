import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {BASE,CONTROL,EDIT,ROUTE,TASK,jobPathFor,manifestPathFor,collectEmployeePreviewBindings} from './preview-adapter.r2.mjs';
import {SCOPED_DIRECT_EXPORT_GATE_FILES} from '../../../tools/scoped-direct-export-core.mjs';
import {validateRepairVisual} from './validate-repair-visual.r2.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.resolve(root,p))).digest('hex');
const ref=p=>({path:p,sha256:hash(p)});
const write=(p,j)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(j,null,2)+'\n');};
const runtimePath='remotion/src/employee-ai-efficiency-v8-r2/runtime-plan.v2.json';
const runtime=read(runtimePath),original=read('remotion/src/employee-ai-efficiency-v8-r1/runtime-plan.v1.json');
const selection=read(`${EDIT}/shotcraft-selection.r2-refined.json`);
console.log(validateRepairVisual(runtime,original,selection));
const rollout='/Users/pc/.codex/sessions/2026/09/17/rollout-2026-09-17T10-36-29-01a0b03a-0bab-7bc1-b850-67496af647cd.jsonl';
const event=fs.readFileSync(rollout,'utf8').split('\n').map((line,index)=>({line,index:index+1})).filter(x=>x.line).find(x=>{
  const e=JSON.parse(x.line);return e.type==='response_item'&&e.payload?.role==='user'&&e.payload.content?.filter(t=>['input_text','text'].includes(t.type)).map(t=>t.text).join('\n').trim()==='确认返修';
});
if(!event)throw new Error('未找到真实返修授权');
const ep=`${CONTROL}/返修预览批准.user.r2.jsonl`;
fs.writeFileSync(path.join(root,ep),event.line+'\n');
const ap=`${CONTROL}/返修预览批准.r2.json`;
write(ap,{userQuote:'确认返修',evidence:ref(ep),source:{path:rollout,line:event.index},
  previewAuthorized:true,previewAccepted:false,formalEnabled:false,publishAuthorized:false,independentSignature:false,
  scope:'用户批准已落盘的返修范围，恢复既有语义动效和电子运镜，先出代表预览；保留旧正式候选和原输入。',
  diagnosis:ref(`${BASE}/07_预览与质检/动效与运镜缺失诊断_20260918.md`)});
const postshoot=read(`${EDIT}/postshoot-edit-plan.v1.json`);
const fontEvent=fs.readFileSync(rollout,'utf8').split('\n').map((line,index)=>({line,index:index+1})).filter(x=>x.line).find(x=>{
  const e=JSON.parse(x.line);return e.type==='response_item'&&e.payload?.role==='user'&&e.payload.content?.some(t=>t.text?.startsWith('渲染效果没有问题，现在最主要的就是这个字稍微有点小'));
});
if(!fontEvent)throw new Error('未找到字号调整的用户原始反馈');
const fontEvidence=`${CONTROL}/字号调整反馈.user.r2.jsonl`,fontFeedback=`${CONTROL}/字号调整反馈.r2.json`;
fs.writeFileSync(path.join(root,fontEvidence),fontEvent.line+'\n');
write(fontFeedback,{evidence:ref(fontEvidence),source:{path:rollout,line:fontEvent.index},
  acceptedPreview:{path:`${BASE}/07_预览与质检/员工AI增效分配_返修R2_观看版_有附加音效_v2.mp4`,sha256:'a618c4a4853c51c5666e5150848581300e3002e37c498221a5f60fbee39b482a'},
  effectsAccepted:true,requestedChange:'放大大标题下的说明、对照和节点文字，按人物与字幕保护区调整尺寸和间距。',
  fontRevisionAccepted:false,formalEnabled:false,publishAuthorized:false});
const pins={};
for(const variant of ['with-sfx','no-sfx']){
  const job=read(`${EDIT}/production-preview.${variant}.v1.json`);
  const jp=jobPathFor(variant),mp=manifestPathFor(variant);
  job.jobId=`20260917-ai-efficiency-sharing-v8-r2-${variant}`;
  job.productionState='ready-for-candidate-preview';
  job.inputs.visualPlan=`${EDIT}/本期视听安排.r2.json`;
  job.experiment={id:'v8-semantic-continuity-sfx',status:'candidate-preview-required',userPreviewApproved:false};
  job.remotion.entry='src/employee-ai-efficiency-v8-r2/index.tsx';
  job.remotion.compositionWithSfx='EmployeeAIEfficiencyV8-R2-Preview-WithSfx';
  job.remotion.compositionWithoutSfx='EmployeeAIEfficiencyV8-R2-Preview-NoSfx';
  job.remotion.durationSeconds=runtime.previewDurationInFrames/30;
  job.preview={enabled:true,output:`${BASE}/07_预览与质检/员工AI增效分配_返修R2_代表预览_${variant==='with-sfx'?'有附加音效':'仅原声'}_v3.mp4`,ranges:runtime.previewRanges,renderWithoutSfxComparison:true};
  job.formal={enabled:false,rawOutput:null,blockedReason:'返修动态预览待用户验收'};
  job.finalReview={fullWatchConfirmed:false,reviewOutcome:'pending'};
  job.knowledgeContext={taskId:'task-20260918T094342Z-3af59d43',contextPath:'task-20260918T094342Z-3af59d43/context.json'};
  job.blockers=['返修预览待用户确认，正式重渲染关闭'];
  job.publishAuthorized=false;
  job.productionGate={schema:'director-production-entry-binding/v2',route:ROUTE,state:'scoped-preview-authorized',revisionId:'ai-efficiency-sharing-v8-r2',formalEnabled:false,userPreviewApproved:false,scopedDirectExport:{path:mp,sha256:'0'.repeat(64)}};
  job.inputs.fingerprintPaths=[...new Set([
    ...Object.values(job.inputs).filter(x=>typeof x==='string'),...Object.values(job.director.artifacts).map(x=>x.path),
    ...postshoot.insertions.map(x=>x.original.path),...SCOPED_DIRECT_EXPORT_GATE_FILES,
    `${CONTROL}/preview-adapter.r2.mjs`,`${CONTROL}/validate-repair-visual.r2.mjs`,`${CONTROL}/build-preview-binding.r2.mjs`,
    ap,ep,fontFeedback,fontEvidence,`${BASE}/05_实录与字幕/听辨确认.v1.json`,`${EDIT}/shotcraft-selection.r2-refined.json`,
    `${EDIT}/shotcraft-auto-match-request.r2.json`,`${EDIT}/shotcraft-auto-match-receipt.r2-refined.json`,
    `${EDIT}/组件来源.r2.json`,'remotion/src/employee-ai-efficiency-v8-r1/runtime-plan.v1.json',
    `${BASE}/07_预览与质检/素材核验/media-probes.v1.json`,mp,
  ])];
  write(jp,job);
  const manifest={schema:'employee-ai-efficiency-repair-preview-manifest/v2',route:ROUTE,episodeId:'20260917_ai_efficiency_sharing',
    jobId:job.jobId,jobPath:jp,authorization:ref(ap),binding:collectEmployeePreviewBindings({projectRoot:root,job}),output:job.preview.output,
    constraints:{previewOnly:true,fullWatchConfirmed:false,publishAuthorized:false,independentSignature:false},
    preservation:'返修独立版本；既有口播、字幕、六段素材和音效输入不变。'};
  write(mp,manifest);pins[variant]=hash(mp);job.productionGate.scopedDirectExport.sha256=pins[variant];write(jp,job);
}
const core=path.join(root,'tools/scoped-direct-export-core.mjs');
const source=fs.readFileSync(core,'utf8'),pattern=/export const EMPLOYEE_AI_REPAIR_PINS = Object\.freeze\(\{[\s\S]*?\}\);/;
if(!pattern.test(source))throw new Error('缺少返修固定摘要位置');
fs.writeFileSync(core,source.replace(pattern,`export const EMPLOYEE_AI_REPAIR_PINS = Object.freeze(${JSON.stringify(pins,null,2)});`));
console.log(JSON.stringify({status:'repair-preview-bound',pins,formalEnabled:false}));
