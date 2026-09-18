import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {BASE,CONTROL,JOB,MANIFEST,OUTPUT,ROUTE,QUOTE,collectEmployeeFormalBindings} from './formal-adapter.v1.mjs';
const root=path.resolve(import.meta.dirname,'../../..');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.resolve(root,p))).digest('hex');
const ref=p=>({path:p,sha256:hash(p)});
const write=(p,value)=>fs.writeFileSync(path.resolve(root,p),JSON.stringify(value,null,2)+'\n');
const transcript='/Users/pc/.codex/sessions/2026/09/17/rollout-2026-09-17T10-36-29-01a0b03a-0bab-7bc1-b850-67496af647cd.jsonl';
const events=fs.readFileSync(transcript,'utf8').split('\n');
const index=events.findIndex(line=>{try{const e=JSON.parse(line);return e.type==='response_item'&&e.payload.role==='user'&&
  e.payload.content.filter(x=>['input_text','text'].includes(x.type)).map(x=>x.text).join('\n').trim()===QUOTE;}catch{return false;}});
if(index<0)throw new Error('缺少本对话真实正式批准');
const evidence=`${CONTROL}/正式成片批准.user.jsonl`;
fs.writeFileSync(path.join(root,evidence),events[index]+'\n');
const preview=read(`${BASE}/07_预览与质检/预览验收包.v1.json`);
const previewReceipts=[...preview.renderReceipts,
  `${BASE}/07_预览与质检/preview-with-sfx.mastering-receipt.v2.json`,
  `${BASE}/07_预览与质检/preview-no-sfx.mastering-receipt.v2.json`].map(ref);
const authority=`${CONTROL}/正式成片批准.v1.json`;
write(authority,{schema:'employee-ai-efficiency-formal-approval/v1',userQuote:QUOTE,
  evidence:{...ref(evidence),source:transcript,line:index+1},preview:ref(preview.files[0].path),previewReceipts,
  userPreviewApproved:true,formalEnabled:true,fullWatchConfirmed:false,publishAuthorized:false,coverAspectRatio:'4:3',
  scope:'沿用已确认V9.1导演、V8工程、实录字幕、六段素材和既有音效，输出正式候选与4:3提示词及发布包。'});
const job=read(`${BASE}/06_剪辑工程/production-preview.with-sfx.v1.json`);
job.jobId='20260917-ai-efficiency-sharing-v8-r1-formal';
job.productionState='ready-for-formal-render';
job.experiment={...job.experiment,userPreviewApproved:true,status:'preview-approved-formal-authorized'};
job.formal={enabled:true,rawOutput:OUTPUT};
job.blockers=[];
job.remotion={...job.remotion,durationSeconds:4669/30,
  compositionWithSfx:'EmployeeAIEfficiencyV8-Full-WithSfx',compositionWithoutSfx:'EmployeeAIEfficiencyV8-Full-NoSfx'};
job.preview={...job.preview,output:preview.files[0].path};
job.productionGate={schema:'director-production-entry-binding/v2',route:ROUTE,state:'scoped-formal-authorized',
  revisionId:'ai-efficiency-sharing-v8-r1',formalEnabled:true,userPreviewApproved:true,scopedDirectExport:{path:MANIFEST,sha256:'0'.repeat(64)}};
job.inputs.fingerprintPaths=[...new Set([...job.inputs.fingerprintPaths.filter(p=>!p.includes('/preview-manifest.')),
  `${CONTROL}/preview-manifest.with-sfx.v1.json`,`${BASE}/06_剪辑工程/production-preview.with-sfx.v1.json`,
  authority,evidence,...previewReceipts.map(x=>x.path),preview.files[0].path,`${CONTROL}/formal-adapter.v1.mjs`,
  `${CONTROL}/build-formal-binding.v1.mjs`,MANIFEST])];
write(JOB,job);
write(MANIFEST,{schema:'employee-ai-efficiency-formal-manifest/v1',route:ROUTE,jobId:job.jobId,jobPath:JOB,
  authorization:ref(authority),output:OUTPUT,binding:collectEmployeeFormalBindings({projectRoot:root,job}),
  userPreviewApproved:true,fullWatchConfirmed:false,publishAuthorized:false});
const pin=hash(MANIFEST);job.productionGate.scopedDirectExport.sha256=pin;write(JOB,job);
const core=path.join(root,'tools/scoped-direct-export-core.mjs');
fs.writeFileSync(core,fs.readFileSync(core,'utf8').replace(/export const EMPLOYEE_AI_FORMAL_PIN = '[a-f0-9]*';/,
  `export const EMPLOYEE_AI_FORMAL_PIN = '${pin}';`));
fs.mkdirSync(path.join(root,BASE,'08_正式成片'),{recursive:true});
fs.mkdirSync(path.join(root,BASE,'09_发布包'),{recursive:true});
console.log(JSON.stringify({status:'formal-bound',userEventLine:index+1,pin,job:JOB,fullWatchConfirmed:false}));
