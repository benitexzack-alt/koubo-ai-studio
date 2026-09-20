import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const base='edit/20260919_ai_training_methods/07_预览与质检/录屏小样R1';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(args)=>{const r=spawnSync('ffmpeg',['-hide_banner','-nostats','-n',...args],{encoding:'utf8',maxBuffer:8e6});if(r.status!==0)throw Error(r.stderr);return r.stderr;};
const job=JSON.parse(fs.readFileSync(`${base}/preview-job.json`));
const review=JSON.parse(fs.readFileSync(`${base}/independent-review.json`));
if(review.jobSha256!==sha(`${base}/preview-job.json`)||review.status!=='approved-for-local-preview')throw Error('审查绑定失效');
for(const b of job.bindings)if(sha(b.path)!==b.sha256)throw Error(`输入变化:${b.path}`);
const raw='remotion/public/media/ai-training-screen-r1/voice.wav';
const norm=`${base}/voice-normalized.wav`;
run(['-i',raw,'-af','loudnorm=I=-17:TP=-2:LRA=11:measured_I=-26.18:measured_TP=-9.14:measured_LRA=3.30:measured_thresh=-36.88:offset=0.34:linear=false','-ar','48000','-c:a','pcm_s24le',norm]);
const files=['无附加音效.mp4','有附加音效.mp4'];
// 观看文件在下一章节“第六”前结束；画面工程保留尾部0.3秒，不覆盖。
run(['-i',`${base}/picture-only.mp4`,'-i',norm,'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t','42','-movflags','+faststart',`${base}/${files[0]}`]);
const args=['-i',`${base}/picture-only.mp4`,'-i',norm];for(const s of job.sfx)args.push('-i',s.path);
const filter=job.sfx.map((s,i)=>`[${i+2}:a]aresample=48000,volume=${s.gain},adelay=${Math.round(s.atFrame/30*48000)}S:all=1[s${i}]`).join(';')+';[1:a][s0][s1][s2]amix=inputs=4:normalize=0:duration=first,alimiter=limit=0.8414:level=false:latency=true[a]';
run([...args,'-filter_complex',filter,'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t','42','-movflags','+faststart',`${base}/${files[1]}`]);
const outputs=[];
for(const n of files){
 const p=`${base}/${n}`;
 const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p],{encoding:'utf8'});if(probe.status!==0)throw Error(probe.stderr);
 const decode=run(['-v','error','-i',p,'-f','null','-']);if(decode.trim())throw Error(`解码告警:${decode}`);
 const qa=run(['-i',p,'-af','loudnorm=I=-17:TP=-2:LRA=11:print_format=json','-vf','blackdetect=d=0.15:pix_th=0.10','-f','null','-']);fs.writeFileSync(`${base}/${n}.qa.log`,qa);
 const match=qa.match(/\{\s*"input_i"[\s\S]*?\}/);const loudness=match?JSON.parse(match[0]):null;
 const hash=spawnSync('ffmpeg',['-v','error','-i',p,'-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-'],{encoding:'utf8'});if(hash.status!==0)throw Error(hash.stderr);
 outputs.push({path:p,sha256:sha(p),specification:JSON.parse(probe.stdout),decodedWithoutErrors:true,videoStreamHash:hash.stdout.trim(),loudness,blackDetected:/black_start:/.test(qa)});
}
if(outputs[0].videoStreamHash!==outputs[1].videoStreamHash)throw Error('双版本画面不同');
const selection=JSON.parse(fs.readFileSync(`${base}/selection-r3.json`));const picked=selection.beats.filter(b=>b.decision==='apply');
for(const out of outputs){
 const receipt={schemaVersion:'koubo-shotcraft-application-receipt/v1',taskId:selection.taskId,revisionId:selection.revisionId,selection:{path:`${base}/selection-r3.json`,sha256:sha(`${base}/selection-r3.json`)},output:{path:out.path,sha256:out.sha256},applications:picked.map(b=>({beatId:b.beatId,effectId:b.effectId,frames:b.frames,component:{name:'EvidenceScan',path:'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',sha256:sha('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx')},outputSha256:out.sha256,finalWorking:true}))};
 fs.writeFileSync(`${out.path}.application.json`,JSON.stringify(receipt,null,2)+'\n');
}
fs.writeFileSync(`${base}/media-qa.json`,JSON.stringify({status:'technical-checks-complete-user-review-required',sameVideoStream:true,sourceRangeSeconds:[128.2,170.2],tailTrimSeconds:0.3,tailTrimReason:'小样在下一个方法前结束；原片和画面工程不变',outputs,userAudibilityConfirmed:false,userPreviewApproved:false,formalEnabled:false,publishAuthorized:false},null,2)+'\n');
console.log(outputs.map(o=>({path:o.path,seconds:o.specification.format.duration,loudness:o.loudness,black:o.blackDetected})));
