import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  collectProductionBoundFilesV2,
  computeProductionCompositionBindingV2,
  computeProductionJobSnapshotSha256V2,
  stableJsonSha256ForProductionGateV2,
} from '../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {assertNoRetiredGeneratedStyle} from '../../../tools/generated-style-policy.mjs';

export const BASE='edit/20260917_ai_efficiency_sharing';
export const CONTROL=`${BASE}/00_工程控制`;
export const EDIT=`${BASE}/06_剪辑工程`;
export const JOB=`${EDIT}/production-formal.with-sfx.r2.json`;
export const MANIFEST=`${CONTROL}/formal-manifest.with-sfx.r2.json`;
export const ROUTE='employee-ai-efficiency-scoped-formal-r2';
export const TASK='task-20260917T164028Z-f297dcc8';
export const APPROVAL_QUOTE='好的。目前现在我们把这个版本锁死，作为我们未来以后最基础的版本。你看一下这个如何去做，不管是什么时候打开这个口播自动化任务，都以这个作为最低参考标准好的，然后继续出成片。';
export const PREVIEW='edit/20260917_ai_efficiency_sharing/07_预览与质检/员工AI增效分配_返修R2_观看版_有附加音效_v3.mp4';
export const PREVIEW_SHA='919914918e1633f3083c49f887bc1fc524f8e2b760cda374f50b33920a0c52c7';
const SELF='tools/scoped-direct-export-core.mjs';
const SHA=/^[a-f0-9]{64}$/u;
const hash=x=>createHash('sha256').update(x).digest('hex');
const same=(a,b)=>stableJsonSha256ForProductionGateV2(a)===stableJsonSha256ForProductionGateV2(b);
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const requireThat=(ok,code,message)=>{if(!ok)fail(code,message);};
export const isEmployeeAIEfficiencyFormalR2=job=>job?.productionGate?.route===ROUTE;

const inside=(root,p)=>{
  requireThat(typeof p==='string'&&p&&!isAbsolute(p),'EAF2_PATH','路径必须是项目相对路径');
  const absolute=resolve(root,p),rel=relative(root,absolute);
  requireThat(rel===p&&!rel.startsWith(`..${sep}`),'EAF2_PATH','路径不能逃逸项目目录');
  let cursor=root;
  for(const part of rel.split(sep)){cursor=resolve(cursor,part);requireThat(existsSync(cursor)&&!lstatSync(cursor).isSymbolicLink(),'EAF2_PATH','禁止符号链接路径');}
  requireThat(lstatSync(absolute).isFile()&&realpathSync(absolute)===absolute,'EAF2_PATH','输入必须是普通文件');
  return absolute;
};
const readJson=(root,p)=>JSON.parse(readFileSync(inside(root,p),'utf8'));
const bound=(root,ref)=>{requireThat(SHA.test(ref?.sha256??''),'EAF2_SHA','输入缺少有效哈希');const bytes=readFileSync(inside(root,ref.path));requireThat(hash(bytes)===ref.sha256,'EAF2_SHA',`输入内容变化：${ref.path}`);return bytes;};

export function collectEmployeeFormalR2Bindings({projectRoot,job}){
  const copy=structuredClone(job);
  copy.inputs.fingerprintPaths=copy.inputs.fingerprintPaths.filter(p=>![SELF,MANIFEST].includes(p));
  return {jobSnapshotSha256:computeProductionJobSnapshotSha256V2(job),
    boundFiles:collectProductionBoundFilesV2({projectRoot,job:copy}).filter(x=>![SELF,MANIFEST].includes(x.path)),
    compositionBinding:computeProductionCompositionBindingV2(job,{projectRoot})};
}

export function assertEmployeeAIEfficiencyFormalR2({projectRoot,job,jobPath=null,command,pin}){
  const root=resolve(projectRoot),gate=job.productionGate;
  requireThat(['direct-remotion-render','formal','formal-audio','qa','release-validation'].includes(command),'EAF2_COMMAND','仅限本期正式渲染与质检');
  requireThat(jobPath===null||(isAbsolute(jobPath)?relative(root,jobPath):jobPath)===JOB,'EAF2_SCOPE','正式任务路径不匹配');
  requireThat(same(readJson(root,JOB),job),'EAF2_JOB_DISK','调用任务与磁盘不一致');
  requireThat(gate?.schema==='director-production-entry-binding/v2'&&gate.route===ROUTE&&gate.state==='scoped-formal-authorized-r2'&&
    gate.revisionId==='ai-efficiency-sharing-v8-r2'&&gate.formalEnabled===true&&gate.userPreviewApproved===true&&
    job.formal?.enabled===true&&job.experiment?.userPreviewApproved===true&&job.finalReview?.fullWatchConfirmed===false&&job.publishAuthorized===false,
    'EAF2_STATE','正式授权状态不匹配');
  requireThat(gate.scopedDirectExport?.path===MANIFEST&&gate.scopedDirectExport?.sha256===pin&&SHA.test(pin??''),'EAF2_PIN','正式清单摘要不匹配');
  const manifest=JSON.parse(bound(root,gate.scopedDirectExport));
  requireThat(manifest.schema==='employee-ai-efficiency-formal-manifest/v2'&&manifest.route===ROUTE&&manifest.jobPath===JOB,'EAF2_MANIFEST','正式清单不匹配');
  const current=collectEmployeeFormalR2Bindings({projectRoot:root,job});
  requireThat(same(current,manifest.binding),'EAF2_BINDING_DRIFT','正式输入或代码发生漂移');
  const files=new Map(current.boundFiles.map(x=>[x.path,x]));
  const authority=JSON.parse(bound(root,manifest.authorization));
  requireThat(authority.userQuote===APPROVAL_QUOTE&&authority.userPreviewApproved===true&&authority.formalEnabled===true&&authority.fullWatchConfirmed===false&&authority.publishAuthorized===false,'EAF2_AUTHORITY','用户正式授权字段不匹配');
  const evidence=authority.evidence;
  const evidenceText=bound(root,evidence).toString('utf8').trim();
  const event=JSON.parse(evidenceText);
  const quote=event.payload?.content?.filter(x=>['input_text','text'].includes(x.type)).map(x=>x.text).join('\n');
  requireThat(event.type==='response_item'&&event.payload?.role==='user'&&quote?.trim()===APPROVAL_QUOTE,'EAF2_AUTHORITY','授权证据必须来自当前真实用户原文');
  for(const ref of [manifest.authorization,evidence,authority.preview])requireThat(files.has(ref.path)||ref.path===PREVIEW,'EAF2_UNBOUND',`关键输入未绑定：${ref.path}`);
  requireThat(authority.preview.path===PREVIEW&&authority.preview.sha256===PREVIEW_SHA&&hash(readFileSync(inside(root,PREVIEW)))===PREVIEW_SHA,'EAF2_PREVIEW','正式片必须绑定已确认v3字号预览');
  const runtime=readJson(root,'remotion/src/employee-ai-efficiency-v8-r2/runtime-plan.v2.json');
  requireThat(runtime.durationInFrames===4669&&runtime.layers.length===19&&runtime.sfxCues.length===11&&runtime.motion.baseScale===1.012,'EAF2_RUNTIME','R2运行计划不匹配');
  const profile=readJson(root,'workflow/active-production-profile.v1.json');
  requireThat(profile.profileVersion==='V8'&&job.productionProfile?.id===profile.profileId&&job.productionProfile?.version===profile.profileVersion,'EAF2_PROFILE','必须沿用当前V8生产档案');
  requireThat(job.remotion?.entry==='src/employee-ai-efficiency-v8-r2/index.tsx'&&job.remotion?.compositionWithSfx==='EmployeeAIEfficiencyV8-R2-Full-WithSfx'&&job.remotion?.compositionWithoutSfx==='EmployeeAIEfficiencyV8-R2-Full-NoSfx'&&job.remotion?.durationSeconds===4669/30,'EAF2_COMPOSITION','必须使用R2全片构图');
  requireThat(job.director?.taskId===TASK&&job.director?.phase==='post-shoot'&&job.director?.profileVersion==='9.1.0','EAF2_DIRECTOR','导演交接不匹配');
  requireThat(job.inputs.visualPlan===`${EDIT}/本期视听安排.r2.json`&&job.inputs.timingRebind===`${EDIT}/postshoot-edit-plan.v1.json`,'EAF2_TIMELINE','实录重绑方案不匹配');
  requireThat(job.formal.rawOutput&&job.formal.finalOutput&&job.formal.rawOutput!==job.formal.finalOutput,'EAF2_OUTPUT','正式原始与最终输出必须分离');
  requireThat(job.preview?.enabled===false&&job.preview?.output===null&&job.preview?.ranges?.length===0,'EAF2_PREVIEW_STATE','正式job不能把预览伪装成正式输出');
  const registry=readJson(root,'workflow/director-production-freeze-registry.v2.json');
  requireThat(!registry.blockedJobFiles.some(x=>x.jobId===job.jobId),'EAF2_FROZEN','冻结任务不能进入正式渲染');
  const spoken=spawnSync(process.execPath,[resolve(root,'tools/check-spoken-source-policy.mjs'),...['transcript','bilingualCaptions','spokenSourcePolicy'].map(k=>resolve(root,job.inputs[k]))],{cwd:root,encoding:'utf8'});
  requireThat(spoken.status===0,'EAF2_SPOKEN',`实录字幕校验失败：${spoken.stderr||spoken.stdout}`);
  assertNoRetiredGeneratedStyle({value:{job,manifest},operation:ROUTE,projectRoot:root,documentPaths:[JOB,MANIFEST]});
  return {ok:true,status:'formal-entry-director-bound',route:ROUTE,manifestPath:MANIFEST,manifestSha256:pin,episodeId:'20260917_ai_efficiency_sharing',jobId:job.jobId,revisionId:gate.revisionId,userPreviewApproved:true,fullWatchConfirmed:false,publishAuthorized:false,...current};
}
