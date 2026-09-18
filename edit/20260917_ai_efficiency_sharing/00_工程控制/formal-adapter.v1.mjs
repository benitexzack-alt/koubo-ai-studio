import {createHash} from 'node:crypto';
import {readFileSync, lstatSync, realpathSync} from 'node:fs';
import {resolve, relative, isAbsolute, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {collectProductionBoundFilesV2, computeProductionCompositionBindingV2,
  computeProductionJobSnapshotSha256V2, stableJsonSha256ForProductionGateV2}
  from '../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';

export const BASE='edit/20260917_ai_efficiency_sharing';
export const CONTROL=`${BASE}/00_工程控制`;
export const JOB=`${BASE}/06_剪辑工程/production-formal.with-sfx.v1.json`;
export const MANIFEST=`${CONTROL}/formal-manifest.with-sfx.v1.json`;
export const OUTPUT=`${BASE}/08_正式成片/员工AI增效分配_正式渲染原始_v1.mp4`;
export const ROUTE='employee-ai-efficiency-scoped-formal';
export const QUOTE='好的，可以，没问题。按照这个版本出正式的成片，还有4:3的提示词和完整的发布包。';
const SELF='tools/scoped-direct-export-core.mjs';
const PREVIEW_PIN='201c0a97c196a3d11580387d880e58e4d08f936c5d8305ca9229ba25c31a4fd5';
const hash=x=>createHash('sha256').update(x).digest('hex');
const same=(a,b)=>stableJsonSha256ForProductionGateV2(a)===stableJsonSha256ForProductionGateV2(b);
const check=(ok,code,message)=>{if(!ok)throw Object.assign(new Error(message),{code});};
const file=(root,p)=>{
  check(typeof p==='string'&&!isAbsolute(p)&&relative(root,resolve(root,p))===p,'EAF_PATH','路径必须固定在本项目内');
  let cursor=root;
  for(const part of p.split(sep)){cursor=resolve(cursor,part);check(!lstatSync(cursor).isSymbolicLink(),'EAF_PATH','不能经过符号链接');}
  check(lstatSync(cursor).isFile()&&realpathSync(cursor)===cursor,'EAF_PATH','输入须为普通文件');
  return readFileSync(cursor);
};
const read=(root,p)=>JSON.parse(file(root,p));
const bound=(root,ref)=>{const bytes=file(root,ref.path);check(hash(bytes)===ref.sha256,'EAF_SHA',`内容变化：${ref.path}`);return bytes;};
export const isEmployeeAIEfficiencyFormal=job=>job?.productionGate?.route===ROUTE;
export function collectEmployeeFormalBindings({projectRoot,job}){
  const copy=structuredClone(job);
  copy.inputs.fingerprintPaths=copy.inputs.fingerprintPaths.filter(p=>![SELF,MANIFEST].includes(p));
  return {jobSnapshotSha256:computeProductionJobSnapshotSha256V2(job),
    boundFiles:collectProductionBoundFilesV2({projectRoot,job:copy}).filter(x=>![SELF,MANIFEST].includes(x.path)),
    compositionBinding:computeProductionCompositionBindingV2(job,{projectRoot})};
}
export function assertEmployeeAIEfficiencyFormal({projectRoot,job,jobPath=null,command,pin}){
  const root=resolve(projectRoot),gate=job.productionGate;
  check(['direct-remotion-render','release-validation','qa'].includes(command),'EAF_COMMAND','仅限本期正式渲染与质检');
  check(job.jobId==='20260917-ai-efficiency-sharing-v8-r1-formal'&&job.videoId==='AI_EFFICIENCY_SHARING_20260917'&&
    (jobPath===null||(isAbsolute(jobPath)?relative(root,jobPath):jobPath)===JOB),'EAF_SCOPE','正式任务范围不符');
  check(same(read(root,JOB),job),'EAF_JOB_DISK','调用任务与磁盘不一致');
  check(gate.route===ROUTE&&gate.state==='scoped-formal-authorized'&&gate.revisionId==='ai-efficiency-sharing-v8-r1'&&
    gate.formalEnabled===true&&gate.userPreviewApproved===true&&job.formal.enabled===true&&job.experiment.userPreviewApproved===true&&
    job.finalReview.fullWatchConfirmed===false&&job.publishAuthorized===false,'EAF_STATE','正式授权不能冒充全片观看或发布授权');
  check(gate.scopedDirectExport.path===MANIFEST&&gate.scopedDirectExport.sha256===pin,'EAF_PIN','正式清单未固定');
  const manifest=JSON.parse(bound(root,gate.scopedDirectExport));
  check(manifest.schema==='employee-ai-efficiency-formal-manifest/v1'&&manifest.jobPath===JOB&&manifest.route===ROUTE,'EAF_MANIFEST','正式清单范围不符');
  const current=collectEmployeeFormalBindings({projectRoot:root,job});
  check(same(current,manifest.binding),'EAF_BINDING_DRIFT','正式输入或执行代码漂移');
  const files=new Map(current.boundFiles.map(x=>[x.path,x]));
  const requireBound=ref=>{check(files.get(ref.path)?.sha256===ref.sha256,'EAF_UNBOUND',`关键输入未绑定：${ref.path}`);return bound(root,ref);};
  const approval=JSON.parse(requireBound(manifest.authorization));
  const event=JSON.parse(requireBound(approval.evidence).toString('utf8').trim());
  const quote=event.payload?.content?.filter(x=>['input_text','text'].includes(x.type)).map(x=>x.text).join('\n');
  check(event.type==='response_item'&&event.payload.role==='user'&&quote?.trim()===QUOTE&&approval.userQuote===QUOTE&&
    approval.userPreviewApproved===true&&approval.formalEnabled===true&&approval.coverAspectRatio==='4:3'&&
    approval.fullWatchConfirmed===false&&approval.publishAuthorized===false,'EAF_AUTHORITY','必须绑定真实用户确认与4:3要求');
  check(approval.preview.sha256==='710c22554c9e8e82412f8733b29b10c32136a106ef094f4a860a8cdaaed1ed4f','EAF_PREVIEW','确认预览不匹配');
  requireBound(approval.preview);
  for(const ref of approval.previewReceipts)requireBound(ref);
  const old=JSON.parse(bound(root,{path:`${CONTROL}/preview-manifest.with-sfx.v1.json`,sha256:PREVIEW_PIN}));
  // 只允许本次正式入口接线变化；逐个锁住预览的素材、字幕、构图、运行计划和导演资料。
  const allowedGateChanges=new Set([SELF,'tools/director-production-binding-core.mjs',
    'skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs']);
  for(const ref of old.binding.boundFiles){if(!allowedGateChanges.has(ref.path))requireBound(ref);}
  const previewJob=read(root,`${BASE}/06_剪辑工程/production-preview.with-sfx.v1.json`);
  check(same(job.director,previewJob.director)&&same(job.productionProfile,previewJob.productionProfile),'EAF_DIRECTOR','沿用原导演和V8档案');
  const expectedRemotion={...previewJob.remotion,durationSeconds:4669/30,
    compositionWithSfx:'EmployeeAIEfficiencyV8-Full-WithSfx',compositionWithoutSfx:'EmployeeAIEfficiencyV8-Full-NoSfx'};
  check(same(job.remotion,expectedRemotion)&&job.formal.rawOutput===OUTPUT&&manifest.output===OUTPUT,'EAF_COMPOSITION','仅允许已确认工程的完整片');
  const registry=read(root,'workflow/director-production-freeze-registry.v2.json');
  check(!registry.blockedJobFiles.some(x=>x.jobId===job.jobId)&&current.boundFiles.every(x=>!registry.retiredOutputSha256.includes(x.sha256)),
    'EAF_FROZEN','禁止冻结任务或退役素材');
  const spoken=spawnSync(process.execPath,[resolve(root,'tools/check-spoken-source-policy.mjs'),
    ...['transcript','bilingualCaptions','spokenSourcePolicy'].map(k=>resolve(root,job.inputs[k]))],{cwd:root,encoding:'utf8'});
  check(spoken.status===0,'EAF_SPOKEN','实录字幕校验失败');
  const directorBinding={ok:true,status:'formal-entry-director-bound',command,taskId:job.director.taskId,paperSceneCount:4,
    spokenAuthority:'recorded-audio',postshootEvidence:'manual-import-bound',skillPackageAccepted:false,userPreviewApproved:true};
  return {ok:true,route:ROUTE,manifestPath:MANIFEST,manifestSha256:pin,episodeId:'20260917_ai_efficiency_sharing',jobId:job.jobId,
    revisionId:gate.revisionId,directorBinding,userPreviewApproved:true,fullWatchConfirmed:false,publishAuthorized:false,...current};
}
