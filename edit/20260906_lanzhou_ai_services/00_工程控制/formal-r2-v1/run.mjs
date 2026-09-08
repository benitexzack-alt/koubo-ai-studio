import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {ROOT,CONTROL,OUTPUT,FINAL,ORIGINAL,PREVIEW,PUBLIC,hashFile,readJson,verifyJob,knowledge,runLog,write,cleanEnvironment} from './formal-core.mjs';
import {sandboxProfile} from '../candidate-preview-r2/runner-core.mjs';
const here=path.join(ROOT,CONTROL),out=path.join(ROOT,OUTPUT);
assert.equal(process.argv.length,2);
const jobPath=path.join(here,'job.v2.json'),job=readJson(jobPath),jobSha=hashFile(jobPath);
const context=readJson(path.join(here,'context-v2/binding.v1.json'));
verifyJob(job);
const review=readJson(path.join(here,'independent-formal-review.v1.json'));
assert.equal(review.jobSha256,jobSha);assert.equal(review.decision,'allow-scoped-formal');
assert.notEqual(review.reviewerId,'019f3383-706c-78f3-9dbe-6c6b20affb59');
assert.equal(review.p0,0);assert.equal(review.p1,0);
assert(!fs.existsSync(out));assert(!fs.existsSync(path.join(ROOT,FINAL)));
fs.mkdirSync(out,{recursive:true});
write(path.join(out,'knowledge-before.json'),knowledge(context));
write(path.join(out,'started.json'),{at:new Date().toISOString(),jobSha256:jobSha,reviewSha256:hashFile(path.join(here,'independent-formal-review.v1.json')),context,formalEnabled:true,publishAuthorized:false});
const ffmpeg=fs.realpathSync('/opt/homebrew/bin/ffmpeg');
const audio=path.join(out,'mix-minus-0.3dB.m4a');
runLog('audio-finish',ffmpeg,['-hide_banner','-nostdin','-n','-i',path.join(ROOT,PREVIEW),'-map','0:a:0','-vn','-af',job.audio.filter,'-c:a','aac','-b:a','320k','-movflags','+faststart',audio]);
const scan=runLog('audio-check',ffmpeg,['-hide_banner','-nostats','-i',audio,'-af','ebur128=peak=true','-f','null','-']);
const tail=scan.stderr.slice(scan.stderr.lastIndexOf('Summary:'));
const peak=Number(tail.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
assert(Number.isFinite(peak)&&peak<=-1,`最终AAC峰值余量未通过：${peak}`);
write(path.join(out,'audio-finish-receipt.json'),{source:PREVIEW,sourceSha256:job.audio.inputSha256,filter:job.audio.filter,output:audio,sha256:hashFile(audio),truePeakDbFS:peak,trimmed:false,remixed:false});
const runtimeRoot=path.join(here,'runtime');fs.mkdirSync(runtimeRoot,{recursive:true});
const scratch=fs.mkdtempSync(path.join(runtimeRoot,'run-'));
for(const n of ['home','tmp','project'])fs.mkdirSync(path.join(scratch,n));
const stage=path.join(scratch,'project');
const staged=[];
for(const n of [...job.imports,...job.publicFiles,'remotion/package.json','remotion/tsconfig.json']) {
  const source=n===`${PUBLIC}/R01.mp4`?ORIGINAL:n;
  const target=path.join(stage,n);fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(path.join(ROOT,source),target,fs.constants.COPYFILE_EXCL|fs.constants.COPYFILE_FICLONE);
  const sha=hashFile(target);assert.equal(sha,hashFile(path.join(ROOT,source)));staged.push({target:n,source,sha256:sha});
}
write(path.join(out,'staged-inputs.json'),staged);
const worker=path.join(here,'worker.mjs');const secretProbe=path.join(runtimeRoot,'non-secret-probe.txt');fs.writeFileSync(secretProbe,'non-secret fixture',{flag:'wx'});
const profile=sandboxProfile({scratch,outputDir:out,readFiles:[process.execPath,worker,path.join(ROOT,'remotion/package.json')]});
const net=runLog('network-probe','/usr/bin/sandbox-exec',['-p',profile,process.execPath,path.join(ROOT,'edit/20260906_lanzhou_ai_services/00_工程控制/candidate-preview-r2/runtime/network-probe.mjs'),secretProbe]);
assert(Object.values(JSON.parse(net.stdout)).every(v=>v===true));
const descriptor=path.join(scratch,'job.json');write(descriptor,{stage,output:path.join(out,'video-only.mp4')});
verifyJob(job);write(path.join(out,'knowledge-before-render.json'),knowledge(context));
await new Promise((resolve,reject)=>{
  const child=spawn('/usr/bin/sandbox-exec',['-p',profile,process.execPath,worker,descriptor],{cwd:path.join(stage,'remotion'),env:cleanEnvironment(scratch),stdio:['ignore','inherit','inherit']});
  const stop=()=>child.kill('SIGTERM');process.once('SIGINT',stop);process.once('SIGTERM',stop);
  child.once('error',reject);child.once('close',code=>{process.off('SIGINT',stop);process.off('SIGTERM',stop);code===0?resolve():reject(new Error(`渲染退出${code}`));});
});
verifyJob(job);assert.equal(hashFile(jobPath),jobSha);write(path.join(out,'knowledge-after-render.json'),knowledge(context));
runLog('final-mux',ffmpeg,['-hide_banner','-nostdin','-n','-i',path.join(out,'video-only.mp4'),'-i',audio,'-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',path.join(ROOT,FINAL)]);
write(path.join(out,'render-receipt.json'),{status:'formal-rendered-pending-qa',at:new Date().toISOString(),formalEnabled:true,publishAuthorized:false,jobSha256:jobSha,
  finalOutput:FINAL,sha256:hashFile(path.join(ROOT,FINAL)),sourceVideo:ORIGINAL,sourceVideoSha256:job.source.sha256,audioSource:PREVIEW,
  audioFilter:job.audio.filter,sourceComponentsUnchanged:true,allHostFramesPreserved:8149,totalOutputFrames:8393,knowledgeContext:context});
console.log(JSON.stringify({status:'正式输出完成，待全片质检',path:path.join(ROOT,FINAL),sha256:hashFile(path.join(ROOT,FINAL))}));
