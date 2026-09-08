import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {ROOT, KB, hashFile, readJson, digest, checked, ENTRY, PUBLIC, BROWSER, BINARIES, collectRuntime, cleanEnvironment} from '../candidate-preview-r2/runner-core.mjs';
import {validateKnowledge} from '../candidate-preview-r2/runner.mjs';

export {ROOT, KB, hashFile, readJson, digest, checked, ENTRY, PUBLIC, BROWSER, BINARIES, collectRuntime, cleanEnvironment};
export const CONTROL = 'edit/20260906_lanzhou_ai_services/00_工程控制/formal-r2-v1';
export const OUTPUT = 'edit/20260906_lanzhou_ai_services/07_预览与质检/formal-r2-v1';
export const FINAL = 'outputs/在兰州把企业AI服务做下去_V9.1_R2_音效修订_1080P正式候选.mp4';
export const PREVIEW = 'edit/20260906_lanzhou_ai_services/07_预览与质检/candidate-preview-r2/render/with-sfx-960x540.mp4';
export const ORIGINAL = 'edit/20260906_lanzhou_ai_services/02_原片/copy_3257E7D6-476D-4668-93F2-0CA1BD79F373.MOV';
export const PREVIEW_SHA = '92cc6930a509a7e9ec498230d03e0c4e1b9bb99db400798caa8dd985afc9dc6a';
export const ORIGINAL_SHA = '9e220b1e93a5eb49759827faf5a47aaef71ca030f674c6c8b549c9e0e159c07b';
export const USER_QUOTE = '其他都没有问题，现在就是音效，抓紧把音效改完之后直接出成片。';
export const FFMPEG = '/opt/homebrew/Cellar/ffmpeg/8.1.2_1/bin/ffmpeg';
export const FFMPEG_SHA = '329fa7360b28a067a0cd7281474bb18cd868932d5173646a674466bcb56d6e93';
export function verifyFfmpeg(file=FFMPEG, hasher=hashFile) {
  assert.equal(file,FFMPEG,'非绑定音频处理器');
  assert.equal(hasher(file),FFMPEG_SHA,'音频处理器字节发生变化');
  return file;
}
export const MEDIA = Object.freeze({width:1920,height:1080,fps:30,frames:8393,scale:1,muted:true,crf:16,imageFormat:'png',colorSpace:'bt709',pixelFormat:'yuv420p'});
export const AUDIO = Object.freeze({input:PREVIEW,inputSha256:PREVIEW_SHA,filter:'volume=-0.3dB:precision=double',codec:'aac',bitrate:'320k',trim:false,resample:false,relativeMixChanged:false});
export const write = (file, value) => {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});};
export function verifyJob(job) {
  assert.equal(job.schema,'lanzhou-r2-formal-scoped/v1');
  assert.equal(job.episodeId,'20260906_lanzhou_ai_services');
  assert.equal(job.formalEnabled,true);
  assert.equal(job.publishAuthorized,false);
  assert.equal(job.externalActionsAllowed,false);
  assert.equal(job.entry,ENTRY); assert.equal(job.publicDir,PUBLIC); assert.equal(job.finalOutput,FINAL);
  assert.deepEqual(job.render,MEDIA); assert.deepEqual(job.audio,AUDIO);
  assert.equal(job.authorization.quote,USER_QUOTE);
  assert.equal(job.authorization.sourceTimestamp,'2026-09-08T03:11:09.437Z');
  assert.equal(job.source.path,ORIGINAL); assert.equal(job.source.sha256,ORIGINAL_SHA);
  assert.equal(hashFile(checked(ROOT,ORIGINAL)),ORIGINAL_SHA);
  assert.equal(hashFile(checked(ROOT,PREVIEW)),PREVIEW_SHA);
  assert.equal(job.runtimeSha256,collectRuntime().sha256);
  assert.deepEqual(job.ffmpeg,{path:FFMPEG,sha256:FFMPEG_SHA}); verifyFfmpeg();
  assert(job.bindings.length>30 && new Set(job.bindings.map(b=>b.path)).size===job.bindings.length);
  for(const b of job.bindings) assert.equal(hashFile(checked(ROOT,b.path)),b.sha256,b.path);
  assert(job.acceptedPaperExceptions.length===5);
  assert.equal(job.currentSharedPostshootValidatorPassed,false);
  assert.equal(job.scope,'current-episode-user-approved-local-formal-only');
}
export function knowledge(context) {
  return validateKnowledge({request:{knowledgeContext:context}},collectRuntime());
}
export function runLog(label, exe, args, dir=path.join(ROOT,OUTPUT), timeout=600000) {
  if(path.basename(exe)==='ffmpeg')verifyFfmpeg(exe);
  fs.mkdirSync(dir,{recursive:true});
  const r=spawnSync(exe,args,{cwd:ROOT,encoding:'utf8',timeout,maxBuffer:64*1024*1024,env:cleanEnvironment(dir)});
  for(const k of ['stdout','stderr']) fs.writeFileSync(path.join(dir,`${label}.${k}.txt`),r[k]??'',{flag:'wx'});
  write(path.join(dir,`${label}.command.json`),{exe,args,exitCode:r.status,error:r.error?.message??null,at:new Date().toISOString()});
  assert.equal(r.status,0,`${label}: ${r.stderr?.slice(-2000)}`);
  return r;
}
