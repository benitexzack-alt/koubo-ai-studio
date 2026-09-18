import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {BASE,CONTROL,EDIT,JOB,MANIFEST,ROUTE,APPROVAL_QUOTE,PREVIEW,PREVIEW_SHA,TASK,collectEmployeeFormalR2Bindings} from './formal-adapter.r2.mjs';
import {SCOPED_DIRECT_EXPORT_GATE_FILES} from '../../../tools/scoped-direct-export-core.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.resolve(root,p))).digest('hex');
const ref=p=>({path:p,sha256:hash(p)});
const write=(p,value)=>{fs.mkdirSync(path.dirname(path.resolve(root,p)),{recursive:true});fs.writeFileSync(path.resolve(root,p),JSON.stringify(value,null,2)+'\n');};
const rollout='/Users/pc/.codex/sessions/2026/09/17/rollout-2026-09-17T10-36-29-01a0b03a-0bab-7bc1-b850-67496af647cd.jsonl';
const event=fs.readFileSync(rollout,'utf8').split('\n').map((line,index)=>({line,index:index+1})).filter(x=>x.line).find(x=>{try{const e=JSON.parse(x.line);return e.type==='response_item'&&e.payload?.role==='user'&&e.payload.content?.filter(v=>['input_text','text'].includes(v.type)).map(v=>v.text).join('\n').trim()===APPROVAL_QUOTE;}catch{return false;}});
if(!event)throw new Error('未找到当前正式成片与基线确认的真实用户原文');
const evidence=`${CONTROL}/正式成片批准.r2.user.jsonl`;
fs.writeFileSync(path.resolve(root,evidence),event.line+'\n');
const authority=`${CONTROL}/正式成片批准.r2.json`;
write(authority,{schema:'employee-ai-efficiency-formal-approval/v2',userQuote:APPROVAL_QUOTE,evidence:{...ref(evidence),source:rollout,line:event.index},
  preview:{path:PREVIEW,sha256:PREVIEW_SHA},userPreviewApproved:true,formalEnabled:true,fullWatchConfirmed:false,publishAuthorized:false,coverAspectRatio:'4:3',
  scope:'锁定R2 v3为未来口播自动化最低参考标准，并继续输出本期V8正式候选；保留全片观看和公开发布门禁。'});
const old=read(`${EDIT}/production-formal.with-sfx.v1.json`);
const preview=read(`${EDIT}/production-preview.with-sfx.r2.json`);
const job={...old,...preview};
job.jobId='20260917-ai-efficiency-sharing-v8-r2-formal';
job.productionState='ready-for-production';
job.productionProfile={id:'v8-semantic-continuity-sfx',version:'V8'};
job.experiment={id:'v8-semantic-continuity-sfx',userPreviewApproved:true,status:'preview-approved-formal-authorized-r2'};
job.inputs={...preview.inputs,renderProxy:'remotion/public-employee-ai-efficiency-v8-r1/media/host.MOV',
  fingerprintPaths:[...new Set([...preview.inputs.fingerprintPaths,authority,evidence,PREVIEW,
    `${BASE}/07_预览与质检/repair-r2-v3/with-sfx.master-receipt.json`,`${BASE}/07_预览与质检/repair-r2-v3/no-sfx.master-receipt.json`,
    `${CONTROL}/formal-adapter.r2.mjs`,`${CONTROL}/build-formal-binding.r2.mjs`,MANIFEST,'remotion/src/employee-ai-efficiency-v8-r2/index.tsx',
    'remotion/src/employee-ai-efficiency-v8-r2/runtime-plan.v2.json',...SCOPED_DIRECT_EXPORT_GATE_FILES]) ]};
job.remotion={...preview.remotion,compositionWithSfx:'EmployeeAIEfficiencyV8-R2-Full-WithSfx',compositionWithoutSfx:'EmployeeAIEfficiencyV8-R2-Full-NoSfx',durationSeconds:4669/30,concurrency:2};
job.preview={enabled:false,output:null,ranges:[],renderWithoutSfxComparison:false};
job.formal={...old.formal,enabled:true,composition:'with-sfx',rawOutput:`${BASE}/08_正式成片/员工AI增效分配_R2_正式渲染原始_v1.mp4`,finalOutput:`${BASE}/08_正式成片/员工AI增效分配_R2_V8_1080P_正式候选_v1.mp4`,crf:18,pixelFormat:'yuv420p',audioBitrate:'320k'};
job.finalReview={fullWatchConfirmed:false,reviewOutcome:'pending'};
job.knowledgeContext={taskId:'task-20260918T020544Z-31f85b17',contextPath:'task-20260918T020544Z-31f85b17/context.json'};
job.riskFrames={enabled:true,fullResolution:true,outputDirectory:`${BASE}/07_预览与质检/formal-r2/frames`,entries:[{time:0},{time:7},{time:24},{time:47},{time:83},{time:107},{time:131.6},{time:141},{time:152}]};
job.reports={runManifest:`${BASE}/07_预览与质检/formal-r2/formal-run-manifest.v1.json`,timingReport:`${BASE}/07_预览与质检/formal-r2/formal-timing.v1.json`,regressionReport:`${BASE}/07_预览与质检/formal-r2/formal-regression.v1.json`};
job.productionGate={schema:'director-production-entry-binding/v2',route:ROUTE,state:'scoped-formal-authorized-r2',revisionId:'ai-efficiency-sharing-v8-r2',formalEnabled:true,userPreviewApproved:true,scopedDirectExport:{path:MANIFEST,sha256:'0'.repeat(64)}};
job.blockers=[];job.publishAuthorized=false;
job.director={...preview.director,taskId:TASK};
write(JOB,job);
const manifest={schema:'employee-ai-efficiency-formal-manifest/v2',route:ROUTE,episodeId:'20260917_ai_efficiency_sharing',jobId:job.jobId,jobPath:JOB,
  authorization:ref(authority),output:{rawOutput:job.formal.rawOutput,finalOutput:job.formal.finalOutput},binding:collectEmployeeFormalR2Bindings({projectRoot:root,job}),
  userPreviewApproved:true,fullWatchConfirmed:false,publishAuthorized:false,preservation:'R2 v3字号、V8语义动效与电子运镜已锁定；正式片只扩展时长，不改变已确认视听安排。'};
write(MANIFEST,manifest);
const pin=hash(MANIFEST);job.productionGate.scopedDirectExport.sha256=pin;write(JOB,job);
const core=path.resolve(root,'tools/scoped-direct-export-core.mjs');
const source=fs.readFileSync(core,'utf8');
const marker="export const EMPLOYEE_AI_FORMAL_R2_PIN = '";
const replaced=source.replace(/export const EMPLOYEE_AI_FORMAL_R2_PIN = '[a-f0-9]*';/u,`${marker}${pin}';`);
if(replaced===source)throw new Error('缺少R2正式固定摘要位置');
fs.writeFileSync(core,replaced);
console.log(JSON.stringify({status:'formal-r2-bound',job:JOB,manifest:MANIFEST,pin,userEventLine:event.index,formalEnabled:true}));
