import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {jobPathFor,manifestPathFor,CONTROL} from './preview-adapter.r2.mjs';
const projectRoot=path.resolve(import.meta.dirname,'../../..');
const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'koubo-employee-preview-')));
const read=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,j)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(j,null,2)+'\n');};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const variant='with-sfx',jp=jobPathFor(variant),mp=manifestPathFor(variant);
const original=JSON.parse(fs.readFileSync(path.join(projectRoot,mp)));
const copy=p=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.copyFileSync(path.join(projectRoot,p),path.join(root,p),fs.constants.COPYFILE_FICLONE);};
const copied=new Set();
const copyModule=p=>{
  if(copied.has(p))return;copied.add(p);copy(p);
  if(!p.endsWith('.mjs'))return;
  for(const match of fs.readFileSync(path.join(projectRoot,p),'utf8').matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)){
    if(match[1].startsWith('.'))copyModule(path.relative(projectRoot,path.resolve(projectRoot,path.dirname(p),match[1])));
  }
};
let cases=0;
try{
  const required=[...original.binding.boundFiles.map(x=>x.path),jp,mp,'workflow/director-production-freeze-registry.v2.json','tools/scoped-direct-export-core.mjs'];
  for(const p of new Set(required))copy(p);
  copyModule(`${CONTROL}/preview-adapter.r2.mjs`);
  const {assertEmployeeAIEfficiencyPreview,collectEmployeePreviewBindings}=await import(pathToFileURL(path.join(root,CONTROL,'preview-adapter.r2.mjs')));
  const registry=read('workflow/director-production-freeze-registry.v2.json');
  copy(registry.controlledRemotionCli.allowedRealpath);
  const link=path.join(root,registry.controlledRemotionCli.linkPath);
  fs.mkdirSync(path.dirname(link),{recursive:true});
  fs.symlinkSync(path.relative(path.dirname(link),path.join(root,registry.controlledRemotionCli.allowedRealpath)),link);
  let job=read(jp),manifest=read(mp),pins={};
  const refresh=()=>{
    write(jp,job);manifest.binding=collectEmployeePreviewBindings({projectRoot:root,job});write(mp,manifest);
    pins[variant]=hash(mp);job.productionGate.scopedDirectExport.sha256=pins[variant];write(jp,job);
  };
  const check=(command='direct-remotion-preview')=>assertEmployeeAIEfficiencyPreview({projectRoot:root,job,jobPath:jp,command,pins});
  refresh();assert.equal(check().ok,true);cases++;
  assert.throws(()=>check('direct-remotion-render'),{code:'EAP_COMMAND'});cases++;
  const baseJob=structuredClone(job);
  job.videoId='OTHER_EPISODE';assert.throws(()=>check(),{code:'EAP_SCOPE'});cases++;job=structuredClone(baseJob);
  job.experiment.userPreviewApproved=true;write(jp,job);assert.throws(()=>check(),{code:'EAP_FALSE_ACCEPTANCE'});cases++;job=structuredClone(baseJob);write(jp,job);
  job.productionGate.scopedDirectExport.sha256='0'.repeat(64);write(jp,job);assert.throws(()=>check(),{code:'EAP_PIN'});cases++;job=structuredClone(baseJob);write(jp,job);
  const captionsPath=job.inputs.bilingualCaptions,captions=fs.readFileSync(path.join(root,captionsPath));
  fs.appendFileSync(path.join(root,captionsPath),' ');assert.throws(()=>check(),{code:'EAP_BINDING_DRIFT'});cases++;fs.writeFileSync(path.join(root,captionsPath),captions);
  job.preview.output='outputs/其他期.mp4';refresh();assert.throws(()=>check(),{code:'EAP_OUTPUT'});cases++;job=structuredClone(baseJob);refresh();
  const approvalPath=`${CONTROL}/返修预览批准.r2.json`,approval=read(approvalPath),evidencePath=approval.evidence.path;
  const event=JSON.parse(fs.readFileSync(path.join(root,evidencePath),'utf8'));event.payload.role='assistant';
  write(evidencePath,event);approval.evidence.sha256=hash(evidencePath);write(approvalPath,approval);
  manifest.authorization.sha256=hash(approvalPath);refresh();assert.throws(()=>check(),{code:'EAP_USER_EVIDENCE'});cases++;
  console.log(JSON.stringify({ok:true,cases,scope:'本期预览正例及拒绝测试',rendererInvoked:false}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
