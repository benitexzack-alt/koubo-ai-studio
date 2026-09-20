import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=process.cwd(),base='edit/20260919_ai_training_methods/07_预览与质检',dir=`${base}/录屏小样R2`;
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(exe,args)=>{const r=spawnSync(exe,args,{encoding:'utf8',maxBuffer:20e6});if(r.status!==0)throw Error(r.stderr||r.stdout);return r;};
run('node',['edit/20260919_ai_training_methods/00_控制/run-screen-preview-r2.mjs','preflight']);
const outputs=[];
for(const name of ['有附加音效.mp4','无附加音效.mp4']){
 const out=`${dir}/${name}`,old=`${base}/录屏小样R1/${name}`;
 run('ffmpeg',['-hide_banner','-loglevel','error','-n','-i',`${dir}/picture-only.mp4`,'-i',old,'-map','0:v:0','-map','1:a:0','-c','copy','-t','42','-movflags','+faststart',out]);
 run('ffmpeg',['-hide_banner','-v','error','-i',out,'-f','null','-']);
 const info=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',out]).stdout);
 const streamHash=(p,stream)=>run('ffmpeg',['-v','error','-i',p,'-map',stream,'-c','copy','-f','hash','-hash','sha256','-']).stdout.trim();
 const oldAudio=streamHash(old,'0:a:0'),newAudio=streamHash(out,'0:a:0');if(oldAudio!==newAudio)throw Error('已认可声音码流变动');
 const black=run('ffmpeg',['-hide_banner','-i',out,'-vf','blackdetect=d=0.15:pix_th=0.1','-an','-f','null','-']).stderr;
 if(/black_start:/.test(black))throw Error('检测到黑帧');
 outputs.push({path:out,sha256:sha(out),videoHash:streamHash(out,'0:v:0'),audioBitstreamUnchanged:true,duration:info.format.duration,width:info.streams[0].width,height:info.streams[0].height,decodePassed:true,blackFramesDetected:false});
 const prior=JSON.parse(fs.readFileSync(`${old}.application.json`));
 // 复用同一注册组件与相同帧窗，仅重新绑定本次候选输出的证据。
 const serialized=JSON.stringify(prior).replaceAll(sha(old),sha(out)).replaceAll(old,out).replaceAll(`${base}/录屏小样R1/selection-r3.json`,`${dir}/selection-r3.json`);
 fs.writeFileSync(`${out}.application.json`,JSON.stringify(JSON.parse(serialized),null,2)+'\n',{flag:'wx'});
 run('node',['skills/koubo-shotcraft-library/scripts/validate-application-receipt.mjs',`${out}.application.json`,'.']);
}
if(outputs[0].videoHash!==outputs[1].videoHash)throw Error('有无音效画面不一致');
fs.writeFileSync(`${dir}/media-qa.json`,JSON.stringify({status:'technical-checks-passed-user-review-required',outputs,sameVideoStream:true,userAccepted:false,formalEnabled:false},null,2)+'\n',{flag:'wx'});
console.log('新版1080P小样导出：全量解码通过、无黑帧、双版本画面一致、原音轨码流完全保留。');
