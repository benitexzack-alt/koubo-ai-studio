import {validateRepairVisual} from './validate-repair-visual.r2.mjs';
import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  collectProductionBoundFilesV2, computeProductionCompositionBindingV2,
  computeProductionJobSnapshotSha256V2, stableJsonSha256ForProductionGateV2,
} from '../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {assertNoRetiredGeneratedStyle} from '../../../tools/generated-style-policy.mjs';

export const BASE = 'edit/20260917_ai_efficiency_sharing';
export const CONTROL = `${BASE}/00_工程控制`;
export const EDIT = `${BASE}/06_剪辑工程`;
export const ROUTE = 'employee-ai-efficiency-repair-preview-r2';
export const TASK = 'task-20260917T164028Z-f297dcc8';
export const APPROVAL_QUOTE = '确认返修';
const SELF_PIN = 'tools/scoped-direct-export-core.mjs';
const SHA = /^[a-f0-9]{64}$/u;
const hash = x => createHash('sha256').update(x).digest('hex');
const same = (a,b) => stableJsonSha256ForProductionGateV2(a) === stableJsonSha256ForProductionGateV2(b);
const fail = (code,message) => {throw Object.assign(new Error(message),{code});};
const requireThat = (ok,code,message) => {if(!ok) fail(code,message);};
export const isEmployeeAIEfficiencyPreview = job => job?.productionGate?.route === ROUTE;
export const variantFor = job => {
  const variant=['with-sfx','no-sfx'].find(v=>job?.jobId===`20260917-ai-efficiency-sharing-v8-r2-${v}`);
  requireThat(variant && job.videoId==='AI_EFFICIENCY_SHARING_20260917','EAP_SCOPE','仅限已批准本期的两个预览任务');
  return variant;
};
export const manifestPathFor = variant => `${CONTROL}/preview-manifest.${variant}.r2.json`;
export const jobPathFor = variant => `${EDIT}/production-preview.${variant}.r2.json`;

const inside = (root,p) => {
  requireThat(typeof p==='string' && p && !isAbsolute(p),'EAP_PATH','路径必须位于本项目内');
  const absolute=resolve(root,p), rel=relative(root,absolute);
  requireThat(rel===p && !rel.startsWith(`..${sep}`),'EAP_PATH','路径不能逃逸本项目');
  let cursor=root;
  for(const part of rel.split(sep)){
    cursor=resolve(cursor,part);
    requireThat(existsSync(cursor) && !lstatSync(cursor).isSymbolicLink(),'EAP_PATH','文件路径缺失或经过符号链接');
  }
  requireThat(lstatSync(absolute).isFile() && realpathSync(absolute)===absolute,'EAP_PATH','输入必须是普通文件');
  return absolute;
};
const read = (root,p) => JSON.parse(readFileSync(inside(root,p),'utf8'));
const boundRead = (root,ref) => {
  requireThat(SHA.test(ref?.sha256??''),'EAP_SHA','输入未绑定有效哈希');
  const bytes=readFileSync(inside(root,ref.path));
  requireThat(hash(bytes)===ref.sha256,'EAP_SHA',`输入内容变化：${ref.path}`);
  return JSON.parse(bytes);
};

export function collectEmployeePreviewBindings({projectRoot,job}){
  const copy=structuredClone(job),manifestPath=manifestPathFor(variantFor(job));
  copy.inputs.fingerprintPaths=copy.inputs.fingerprintPaths.filter(p=>![SELF_PIN,manifestPath].includes(p));
  return {jobSnapshotSha256:computeProductionJobSnapshotSha256V2(job),
    boundFiles:collectProductionBoundFilesV2({projectRoot,job:copy}).filter(x=>![SELF_PIN,manifestPath].includes(x.path)),
    compositionBinding:computeProductionCompositionBindingV2(job,{projectRoot})};
}

export function assertEmployeeAIEfficiencyPreview({projectRoot,job,jobPath=null,command,pins}){
  const root=resolve(projectRoot),variant=variantFor(job),gate=job.productionGate;
  requireThat(command==='direct-remotion-preview','EAP_COMMAND','本次许可只进入本地预览；正式片须绑定观看确认');
  const expectedJob=jobPathFor(variant),expectedManifest=manifestPathFor(variant);
  requireThat(jobPath===null || (isAbsolute(jobPath)?relative(root,jobPath):jobPath)===expectedJob,'EAP_SCOPE','预览任务路径不匹配');
  requireThat(same(read(root,expectedJob),job),'EAP_JOB_DISK','调用任务与磁盘不一致');
  requireThat(gate.schema==='director-production-entry-binding/v2' && gate.route===ROUTE &&
    gate.state==='scoped-preview-authorized' && gate.revisionId==='ai-efficiency-sharing-v8-r2', 'EAP_GATE','本期预览路由不匹配');
  requireThat(job.formal.enabled===false && gate.formalEnabled===false && gate.userPreviewApproved===false &&
    job.experiment.userPreviewApproved===false && job.finalReview.fullWatchConfirmed===false && job.publishAuthorized===false,
    'EAP_FALSE_ACCEPTANCE','不得伪造预览、全片或发布验收');
  requireThat(!job.inputs.generatedVideoPlan && !job.director.currentTaskUserAcceptance &&
    ['directorContract','freezeReceipt','formalAuthorization'].every(k=>gate[k]==null), 'EAP_FALSE_ACCEPTANCE','不得冒充外部签名或调用生成服务');
  requireThat(gate.scopedDirectExport?.path===expectedManifest && gate.scopedDirectExport.sha256===pins[variant] && SHA.test(pins[variant]??''),
    'EAP_PIN','未绑定本期审计固定清单');
  const manifest=boundRead(root,gate.scopedDirectExport);
  requireThat(manifest.schema==='employee-ai-efficiency-repair-preview-manifest/v2' && manifest.route===ROUTE &&
    manifest.episodeId==='20260917_ai_efficiency_sharing' && manifest.jobId===job.jobId && manifest.jobPath===expectedJob,
    'EAP_MANIFEST','本期预览清单不匹配');
  const registry=read(root,'workflow/director-production-freeze-registry.v2.json');
  requireThat(!registry.blockedJobFiles.some(x=>x.jobId===job.jobId),'EAP_FROZEN','冻结任务不能进入本期预览');
  const current=collectEmployeePreviewBindings({projectRoot:root,job});
  requireThat(same(current,manifest.binding),'EAP_BINDING_DRIFT','输入、代码、字幕或任务发生变化，须重新绑定');
  const files=new Map(current.boundFiles.map(x=>[x.path,x]));
  const requireBound = p => requireThat(files.has(p),'EAP_UNBOUND',`关键输入未进入绑定：${p}`);
  const authority=boundRead(root,manifest.authorization);
  requireBound(manifest.authorization.path);requireBound(authority.evidence.path);
  const evidenceBytes=readFileSync(inside(root,authority.evidence.path));
  requireThat(hash(evidenceBytes)===authority.evidence.sha256,'EAP_USER_EVIDENCE','用户原文哈希变化');
  const event=JSON.parse(evidenceBytes.toString('utf8').trim());
  const quote=event?.payload?.content?.filter(x=>['input_text','text'].includes(x.type)).map(x=>x.text).join('\n');
  requireThat(event.type==='response_item' && event.payload.role==='user' && quote?.trim()===APPROVAL_QUOTE &&
    authority.userQuote===APPROVAL_QUOTE && authority.previewAuthorized===true && authority.previewAccepted===false &&
    authority.formalEnabled===false && authority.publishAuthorized===false && authority.independentSignature===false,
    'EAP_USER_EVIDENCE','授权必须来自本对话真实用户原文，且仅批准本期预览');

  const director=job.director,artifacts=director.artifacts;
  requireThat(director.taskId===TASK && director.required===true && director.phase==='post-shoot' &&
    director.profileVersion==='9.1.0' && director.fallback==='blocked','EAP_DIRECTOR','导演阶段或版本不匹配');
  const expected={cues:`${BASE}/03_导演拆解/director-cues.v2.json`,approval:`${CONTROL}/用户剪辑授权.v1.json`,
    handoff:`${BASE}/03_导演拆解/edit-release-handoff-r1/director-cues-v2-handoff.v1.json`,
    validation:`${BASE}/03_导演拆解/edit-release-handoff-r1/director-cues-v2-handoff-validation-receipt.v1.json`,
    postshoot:`${EDIT}/postshoot-edit-plan.v1.json`};
  const docs={};
  for(const [key,p] of Object.entries(expected)){
    requireThat(artifacts[key]?.path===p,'EAP_DIRECTOR','导演资料必须是本期原生交接');
    requireBound(p);docs[key]=boundRead(root,artifacts[key]);
  }
  const {cues,approval,handoff,validation,postshoot}=docs;
  requireThat(cues.taskId===TASK && cues.semanticBeats.length===30 && cues.schemaVersion==='koubo-director-cues/v2' &&
    approval.approved===true && same(approval.bindings.directorCues,artifacts.cues) &&
    handoff.taskId===TASK && same(handoff.source.directorCues,artifacts.cues) && same(handoff.source.userApproval,artifacts.approval) &&
    validation.status==='validated-local-handoff' && validation.skillExecuted===true &&
    same(validation.handoffMaster,artifacts.handoff) && same(validation.source.directorCues,artifacts.cues) &&
    same(validation.source.userApproval,artifacts.approval),'EAP_DIRECTOR','原生导演交接未同源绑定');
  boundRead(root,validation.source.activeDirectorProfile);
  const productionProfile=read(root,'workflow/active-production-profile.v1.json');
  requireThat(productionProfile.profileVersion==='V8' && job.productionProfile.version==='V8' &&
    job.productionProfile.id===productionProfile.profileId,'EAP_PROFILE','必须沿用当前V8生产基线');
  requireBound('workflow/active-director-profile.v1.json');requireBound('workflow/active-production-profile.v1.json');
  requireThat(postshoot.insertions.length===6 && postshoot.beats.length===30 && postshoot.durationInFrames===4669 &&
    same(postshoot.captions,files.get(job.inputs.bilingualCaptions) && {path:job.inputs.bilingualCaptions,sha256:files.get(job.inputs.bilingualCaptions).sha256}),
    'EAP_TIMELINE','实录重绑、字幕或六段插片不匹配');
  for(const clip of postshoot.insertions){
    requireBound(clip.original.path);
    requireThat(files.get(clip.original.path).sha256===clip.original.sha256 && clip.fullDecodePassed && clip.muted && !clip.loop && !clip.freeze && clip.playbackRate===1,
      'EAP_MEDIA','生成素材须使用已绑定原文件、静音且单次正常播放');
    requireThat(clip.sourceStartSeconds+(clip.endFrameExclusive-clip.startFrame)/30<=clip.sourceDurationSeconds+1/30,'EAP_MEDIA','插片超出原素材时长');
  }
  const runtime=read(root,'remotion/src/employee-ai-efficiency-v8-r2/runtime-plan.v2.json');
  requireThat(runtime.audioReviewComplete && runtime.previewDurationInFrames===1314 && runtime.durationInFrames===4669 &&
    same(runtime.insertions,postshoot.insertions) && runtime.layers.length===19 && runtime.sfxCues.length===11,
    'EAP_RUNTIME','运行工程必须沿用已确认视听安排');
  requireThat(job.remotion.root==='remotion' && job.remotion.entry==='src/employee-ai-efficiency-v8-r2/index.tsx' &&
    job.remotion.publicDir==='remotion/public-employee-ai-efficiency-v8-r1' && job.remotion.fps===30 &&
    job.remotion.width===1920 && job.remotion.height===1080 && job.remotion.durationSeconds===1314/30 &&
    job.remotion.compositionWithSfx==='EmployeeAIEfficiencyV8-R2-Preview-WithSfx' &&
    job.remotion.compositionWithoutSfx==='EmployeeAIEfficiencyV8-R2-Preview-NoSfx', 'EAP_COMPOSITION','预览构图与入口必须固定为本期工程');
  const output=`${BASE}/07_预览与质检/员工AI增效分配_返修R2_代表预览_${variant==='with-sfx'?'有附加音效':'仅原声'}_v2.mp4`;
  requireThat(job.preview.output===output && manifest.output===output && job.preview.renderWithoutSfxComparison===true &&
    same(job.preview.ranges,runtime.previewRanges),'EAP_OUTPUT','仅能输出本期同画面双版本预览');
  requireThat(!files.has(output),'EAP_OUTPUT','不得覆盖输入');
  const retired=new Set(registry.retiredOutputSha256);
  requireThat(current.boundFiles.every(x=>!retired.has(x.sha256)),'EAP_RETIRED','退役素材不能复用');
  assertNoRetiredGeneratedStyle({value:{job,manifest},operation:ROUTE,projectRoot:root,documentPaths:[expectedJob,expectedManifest]});
  const spoken=spawnSync(process.execPath,[resolve(root,'tools/check-spoken-source-policy.mjs'),
    ...['transcript','bilingualCaptions','spokenSourcePolicy'].map(k=>resolve(root,job.inputs[k]))],{cwd:root,encoding:'utf8'});
  requireThat(spoken.status===0,'EAP_SPOKEN',`实录字幕校验未通过：${spoken.stderr||spoken.stdout}`);
  const selection=read(root,`${EDIT}/shotcraft-selection.r2-refined.json`);
  requireBound(`${EDIT}/shotcraft-selection.r2-refined.json`);
  requireThat(selection.beats.length===24 && selection.beats.every(x=>['apply','not-needed'].includes(x.decision)) &&
    same(selection.captions,postshoot.captions),'EAP_SHOTCRAFT','本期Shotcraft必须与真实字幕及实际组件绑定');
  validateRepairVisual(runtime,read(root,'remotion/src/employee-ai-efficiency-v8-r1/runtime-plan.v1.json'),selection);
  const directorBinding={ok:true,status:'candidate-entry-director-bound',command,taskId:TASK,paperSceneCount:4,
    spokenAuthority:'recorded-audio',postshootEvidence:'manual-import-bound',skillPackageAccepted:false,userPreviewApproved:false};
  return {ok:true,route:ROUTE,manifestPath:expectedManifest,manifestSha256:gate.scopedDirectExport.sha256,
    episodeId:'20260917_ai_efficiency_sharing',jobId:job.jobId,revisionId:gate.revisionId,directorBinding,
    userPreviewApproved:false,fullWatchConfirmed:false,publishAuthorized:false,...current};
}
