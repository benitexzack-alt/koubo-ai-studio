import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {assertScopedDirectExport} from '../../../tools/scoped-direct-export-core.mjs';
const root=process.cwd(),base='edit/20260919_ai_training_methods',qa=`${base}/07_预览与质检/正式R1`;
const read=p=>JSON.parse(fs.readFileSync(p));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const run=(exe,args)=>{const r=spawnSync(exe,args,{encoding:'utf8',maxBuffer:20e6});if(r.status!==0)throw Error(r.stderr||r.stdout);return r;};
const jobPath=`${base}/06_剪辑工程/production-formal.r1.json`,job=read(jobPath);
assertScopedDirectExport({projectRoot:root,job,jobPath,command:'qa'});
const context=run('python3',['/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py','validate-context','--context',`/Users/pc/Documents/个人知识库/.opc-rag/tasks/${job.knowledgeContext.contextPath}`]);
if(JSON.parse(context.stdout).gate?.formal_execution_allowed!==true)throw Error('任务上下文已失效');
const raw=job.formal.rawOutput,final=job.formal.finalOutput;
const receiptFile=fs.readdirSync(path.dirname(raw)).find(n=>n.startsWith(`.${path.basename(raw)}.production-receipt.`));
if(!receiptFile)throw Error('正式原片缺少受控渲染完成回执');
const receiptPath=path.join(path.dirname(raw),receiptFile),receipt=read(receiptPath);
if(receipt.output.sha256!==sha(raw))throw Error('正式画面与受控回执不符');
if(!fs.existsSync(final))fs.copyFileSync(raw,final,fs.constants.COPYFILE_EXCL);
const exactCopy=sha(final)===sha(raw);
const remuxPath=`${qa}/audio-remux-receipt.r1.json`;
if(!exactCopy){
 const remux=read(remuxPath);
 if(remux.source.sha256!==sha(raw)||remux.output.sha256!==sha(final)||remux.mix.sha256!==sha('remotion/public-ai-training-final-r1/audio/final-mix.wav')||!remux.videoBitstreamUnchanged)throw Error('音轨校准派生凭据不匹配');
 const vh=p=>run('ffmpeg',['-v','error','-i',p,'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).stdout.trim();
 if(vh(raw)!==vh(final))throw Error('受控视频码流发生变化');
}
const info=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',final]).stdout);
const v=info.streams.find(x=>x.codec_type==='video'),a=info.streams.find(x=>x.codec_type==='audio');
if(v.width!==1920||v.height!==1080||v.r_frame_rate!=='30/1'||Number(v.nb_frames)!==9155||v.codec_name!=='h264'||a?.codec_name!=='aac')throw Error('正式规格不符合1080P/30帧/9155帧H264AAC');
const log=run('ffmpeg',['-hide_banner','-nostats','-i',final,'-vf','blackdetect=d=0.15:pix_th=0.1','-af','loudnorm=I=-17:TP=-2:LRA=11:print_format=json,silencedetect=n=-45dB:d=1.5','-f','null','-']).stderr;
fs.mkdirSync(`${qa}/frames`,{recursive:true});fs.writeFileSync(`${qa}/decode-audio-black.log`,log);
const loudness=JSON.parse(log.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
const black=/black_start:/.test(log),silence=/silence_start:/.test(log),decodeErrors=/Error while decoding|Invalid data|corrupt decoded/i.test(log);
if(black||decodeErrors||Number(loudness.input_tp)>-.8)throw Error('黑帧、解码或真峰值检查未通过');
const times=[1,3.5,9,20,35,49,59,70.5,74,96,113,128,134.7,144,152,160,169,181,209,223,238,260,273,291,301,304];
for(const t of times){const out=`${qa}/frames/${String(t).replace('.','_')}.png`;if(!fs.existsSync(out))run('ffmpeg',['-v','error','-n','-ss',String(t),'-i',final,'-frames:v','1',out]);}
const require=createRequire(path.join(root,'remotion/package.json')),sharp=require('sharp');
for(let start=0;start<times.length;start+=9){
 const entries=times.slice(start,start+9),images=await Promise.all(entries.map(async(t,i)=>({input:await sharp(`${qa}/frames/${String(t).replace('.','_')}.png`).resize(640,360).toBuffer(),left:i%3*640,top:Math.floor(i/3)*360})));
 await sharp({create:{width:1920,height:Math.ceil(entries.length/3)*360,channels:3,background:'#101619'}}).composite(images).jpeg({quality:90}).toFile(`${qa}/contact-${start/9+1}.jpg`);
}
const selectionPath=`${base}/06_剪辑工程/shotcraft-final-selection.r1.json`,selection=read(selectionPath),outputSha=sha(final);
const application={schemaVersion:'koubo-shotcraft-application-receipt/v1',taskId:selection.taskId,revisionId:selection.revisionId,selection:{path:selectionPath,sha256:sha(selectionPath)},output:{path:final,sha256:outputSha},applications:selection.beats.filter(b=>b.decision==='apply').map(b=>({beatId:b.beatId,effectId:b.effectId,frames:b.frames,component:{name:'EvidenceScan',path:'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',sha256:sha('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx')},outputSha256:outputSha,finalWorking:true})),implementation:{path:'remotion/src/ai-training-final-r1/vendor/ShotcraftEffects.tsx',unchangedCopySha256:sha('remotion/src/ai-training-final-r1/vendor/ShotcraftEffects.tsx')}};
const applicationPath=`${qa}/shotcraft-application.r1.json`;write(applicationPath,application);
run('node',['skills/koubo-shotcraft-library/scripts/validate-application-receipt.mjs',applicationPath,'.']);
write(`${qa}/media-qa.r1.json`,{status:'technical-checks-passed-visual-review-pending',output:{path:final,sha256:outputSha,bytes:fs.statSync(final).size},sourceProductionReceipt:{path:receiptPath,sha256:sha(receiptPath)},deliveryIsExactCopyOfControlledRender:exactCopy,controlledVideoBitstreamUnchanged:true,audioRemuxReceipt:exactCopy?null:remuxPath,video:v,audio:a,durationSeconds:Number(info.format.duration),loudness,fullDecodePassed:!decodeErrors,blackFramesDetected:black,longSilenceDetected:silence,frames:times.map(time=>({time,path:`${qa}/frames/${String(time).replace('.','_')}.png`})),spokenSourcePolicy:job.inputs.spokenSourcePolicy,userFullWatchConfirmed:false,publishAuthorized:false});
console.log(JSON.stringify({status:'正式成片技术检查完成，待实际风险帧复核',output:final,seconds:info.format.duration,loudness,black,silence}));
