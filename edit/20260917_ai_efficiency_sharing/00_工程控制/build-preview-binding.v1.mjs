import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {BASE,CONTROL,EDIT,ROUTE,TASK,jobPathFor,manifestPathFor,collectEmployeePreviewBindings} from './preview-adapter.v1.mjs';
import {SCOPED_DIRECT_EXPORT_GATE_FILES} from '../../../tools/scoped-direct-export-core.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const ref=p=>({path:p,sha256:hash(p)});
const write=(p,j)=>fs.writeFileSync(path.join(root,p),JSON.stringify(j,null,2)+'\n');
const approval=read(`${CONTROL}/本期渲染批准.v1.json`);
if(!approval.previewAuthorized) throw new Error('缺少本期用户批准');
const plan=read(`${EDIT}/postshoot-edit-plan.v1.json`);
const artifacts={cues:`${BASE}/03_导演拆解/director-cues.v2.json`,approval:`${CONTROL}/用户剪辑授权.v1.json`,
  handoff:`${BASE}/03_导演拆解/edit-release-handoff-r1/director-cues-v2-handoff.v1.json`,
  validation:`${BASE}/03_导演拆解/edit-release-handoff-r1/director-cues-v2-handoff-validation-receipt.v1.json`,
  postshoot:`${EDIT}/postshoot-edit-plan.v1.json`};
const pins={};
for(const variant of ['with-sfx','no-sfx']){
  const jp=jobPathFor(variant),mp=manifestPathFor(variant),job=read(jp);
  job.productionState='ready-for-candidate-preview';
  job.experiment.status='candidate-preview-required';
  job.director={required:true,profileId:'paper-editorial-director-v9',profileVersion:'9.1.0',taskId:TASK,
    phase:'post-shoot',paperRequired:true,fallback:'blocked',artifacts:Object.fromEntries(Object.entries(artifacts).map(([k,p])=>[k,ref(p)]))};
  job.blockers=['本期预览待用户观看，正式渲染保持关闭'];
  job.productionGate={schema:'director-production-entry-binding/v2',route:ROUTE,state:'scoped-preview-authorized',
    revisionId:'ai-efficiency-sharing-v8-r1',formalEnabled:false,userPreviewApproved:false,
    scopedDirectExport:{path:mp,sha256:'0'.repeat(64)}};
  job.inputs.fingerprintPaths=[...new Set([
    ...Object.values(job.inputs).filter(x=>typeof x==='string'),...Object.values(artifacts),
    ...plan.insertions.map(x=>x.original.path),...SCOPED_DIRECT_EXPORT_GATE_FILES,
    `${CONTROL}/preview-adapter.v1.mjs`,`${CONTROL}/build-preview-binding.v1.mjs`,
    `${CONTROL}/本期渲染批准.v1.json`,approval.evidence.path,
    `${BASE}/05_实录与字幕/听辨确认.v1.json`,`${EDIT}/shotcraft-selection.v2.json`,
    `${EDIT}/shotcraft-auto-match-request.v1.json`,`${EDIT}/shotcraft-auto-match-receipt.v2.json`,
    `${BASE}/07_预览与质检/素材核验/media-probes.v1.json`,
    `${BASE}/07_预览与质检/字幕结构检查.v1.json`,mp,
  ])];
  write(jp,job);
  const binding=collectEmployeePreviewBindings({projectRoot:root,job});
  const manifest={schema:'employee-ai-efficiency-preview-manifest/v1',route:ROUTE,episodeId:'20260917_ai_efficiency_sharing',
    jobId:job.jobId,jobPath:jp,authorization:ref(`${CONTROL}/本期渲染批准.v1.json`),binding,output:job.preview.output,
    constraints:{previewOnly:true,fullWatchConfirmed:false,publishAuthorized:false,independentSignature:false},
    preservation:'沿用已确认V9.1导演、V8基线、本期既有画面字幕动效音效；不新增视觉设计。'};
  write(mp,manifest);pins[variant]=hash(mp);job.productionGate.scopedDirectExport.sha256=pins[variant];write(jp,job);
}
const pinPath=path.join(root,'tools/scoped-direct-export-core.mjs');
const source=fs.readFileSync(pinPath,'utf8');
const pattern=/export const EMPLOYEE_AI_PREVIEW_PINS = Object\.freeze\(\{[\s\S]*?\}\);/;
if(!pattern.test(source)) throw new Error('本期固定摘要位置不存在');
fs.writeFileSync(pinPath,source.replace(pattern,`export const EMPLOYEE_AI_PREVIEW_PINS = Object.freeze({\n  'with-sfx': '${pins['with-sfx']}',\n  'no-sfx': '${pins['no-sfx']}',\n});`));
console.log(JSON.stringify({status:'preview-inputs-bound',pins,formalEnabled:false,visualPlanModified:false}));
