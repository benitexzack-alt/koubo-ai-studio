import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {assertScopedDirectExport} from '../../../tools/scoped-direct-export-core.mjs';
import {validateKnowledgeContextForProductionV2} from '../../../tools/knowledge-context-production-gate.mjs';
const root=process.cwd(),base='edit/20260926_industry_ai_no_anxiety',qa=`${base}/07_预览与质检/正式R1`,pub='remotion/public-industry-ai-no-anxiety-final-r1';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const run=(exe,args)=>{const r=spawnSync(exe,args,{encoding:'utf8',maxBuffer:20e6});assert.equal(r.status,0,r.stderr||r.stdout);return r;};
const jobPath=`${base}/04_Remotion准备/production-formal.r1.json`,job=read(jobPath);
// 已有受控渲染之后的派生封装与媒体诊断，不冒充固定run-v72入口。
const preflight={scope:'post-render-media-analysis',binding:assertScopedDirectExport({projectRoot:root,jobPath,job,command:'formal-audio'}),knowledgeContext:validateKnowledgeContextForProductionV2({projectRoot:root,jobPath:path.resolve(jobPath),job,command:'formal-audio'})};
write(`${qa}/preflight-qa.json`,preflight);
const raw=job.formal.rawOutput,final=job.formal.finalOutput;
const receiptName=fs.readdirSync(path.dirname(raw)).find(n=>n.startsWith(`.${path.basename(raw)}.production-receipt.`));assert(receiptName,'缺少受控渲染完成回执');
const receiptPath=path.join(path.dirname(raw),receiptName);assert.equal(read(receiptPath).output.sha256,sha(raw));
// 直接使用已绑定PCM混音封装，避免Remotion AAC再编码或引入延迟；画面码流不变。
run('ffmpeg',['-v','error','-n','-i',raw,'-i',`${pub}/audio/final-mix.wav`,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t','122.9','-movflags','+faststart',final]);
const videoHash=p=>run('ffmpeg',['-v','error','-i',p,'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).stdout.trim();
assert.equal(videoHash(raw),videoHash(final));
write(`${qa}/audio-remux-receipt.r1.json`,{source:{path:raw,sha256:sha(raw)},output:{path:final,sha256:sha(final)},mix:{path:`${pub}/audio/final-mix.wav`,sha256:sha(`${pub}/audio/final-mix.wav`)},videoBitstreamUnchanged:true,sourceProductionReceipt:{path:receiptPath,sha256:sha(receiptPath)}});
const info=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',final]).stdout),v=info.streams.find(s=>s.codec_type==='video'),a=info.streams.find(s=>s.codec_type==='audio');
assert.equal(v.width,1920);assert.equal(v.height,1080);assert.equal(v.r_frame_rate,'30/1');assert.equal(Number(v.nb_frames),3687);assert.equal(v.codec_name,'h264');assert.equal(a.codec_name,'aac');assert.equal(Number(v.start_time),0);assert.equal(Number(a.start_time),0);
const log=run('ffmpeg',['-hide_banner','-nostats','-i',final,'-vf','blackdetect=d=0.3:pix_th=0.1:pic_th=0.98','-af','ebur128=peak=true,silencedetect=n=-45dB:d=1.5','-f','null','-']).stderr;
fs.writeFileSync(`${qa}/decode-audio-black.log`,log,{flag:'wx'});
assert(!/Error while decoding|Invalid data|corrupt decoded|black_start:/i.test(log));
const summary=log.slice(log.lastIndexOf('Summary:')),integrated=Number(summary.match(/I:\s*(-?[\d.]+) LUFS/)[1]),peak=Number(summary.match(/Peak:\s*(-?[\d.]+) dBFS/)[1]);assert(peak<=-0.8);assert(integrated>-21&&integrated<-13);
const times=[1.5,4.3,16,22.8,28,32.5,40,45.6,48,51.8,53.5,54.2,56,58.5,60.6,66.5,73,77.6,81.5,86.8,89.5,96,101,106,112.8,116.5,118.8,121.7,122.7];fs.mkdirSync(`${qa}/frames`,{recursive:true});
for(const t of times)run('ffmpeg',['-v','error','-n','-ss',String(t),'-i',final,'-frames:v','1',`${qa}/frames/${String(t).replace('.','_')}.png`]);
const require=createRequire(path.join(root,'remotion/package.json')),sharp=require('sharp');
for(let start=0;start<times.length;start+=9){const entries=times.slice(start,start+9),images=await Promise.all(entries.map(async(t,i)=>({input:await sharp(`${qa}/frames/${String(t).replace('.','_')}.png`).resize(640,360).toBuffer(),left:i%3*640,top:Math.floor(i/3)*360})));await sharp({create:{width:1920,height:Math.ceil(entries.length/3)*360,channels:3,background:'#101619'}}).composite(images).jpeg({quality:92}).toFile(`${qa}/contact-${start/9+1}.jpg`);}
write(`${qa}/media-qa.r1.json`,{status:'technical-checks-passed-visual-review-pending',output:{path:final,sha256:sha(final),bytes:fs.statSync(final).size},sourceProductionReceipt:{path:receiptPath,sha256:sha(receiptPath)},controlledVideoBitstreamUnchanged:true,audioRemuxReceipt:`${qa}/audio-remux-receipt.r1.json`,video:v,audio:a,durationSeconds:Number(info.format.duration),loudness:{integratedLUFS:integrated,truePeakDbfs:peak},fullDecodePassed:true,blackFramesDetected:false,longSilenceDetected:/silence_start:/.test(log),frames:times.map(time=>({time,path:`${qa}/frames/${String(time).replace('.','_')}.png`})),spokenSourcePolicy:job.inputs.spokenSourcePolicy,userFullWatchConfirmed:false,publishAuthorized:false});
console.log(JSON.stringify({output:final,duration:info.format.duration,integrated,peak,frames:times.length,status:'技术检查完成，待风险帧复核'}));
