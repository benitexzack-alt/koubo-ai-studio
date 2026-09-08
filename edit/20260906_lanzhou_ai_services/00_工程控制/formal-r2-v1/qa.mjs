import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {ROOT,CONTROL,OUTPUT,FINAL,PREVIEW,hashFile,readJson,write,runLog,knowledge,verifyJob,verifyFfmpeg,cleanEnvironment} from './formal-core.mjs';

const dir=path.join(ROOT,OUTPUT,'qa'),file=path.join(ROOT,FINAL),ffmpeg=fs.realpathSync('/opt/homebrew/bin/ffmpeg'),ffprobe=fs.realpathSync('/opt/homebrew/bin/ffprobe');
assert.equal(hashFile(ffprobe),'841ab2259a55e5c5e44c5851890867d48750ff1e7cfa92b5fbed91445a493128');
assert(!fs.existsSync(dir));fs.mkdirSync(dir,{recursive:true});
const job=readJson(path.join(ROOT,CONTROL,'job.v2.json'));verifyJob(job);
const jobSha=hashFile(path.join(ROOT,CONTROL,'job.v2.json'));
const renderReceipt=readJson(path.join(ROOT,OUTPUT,'render-receipt.json'));
const audioReceipt=readJson(path.join(ROOT,OUTPUT,'audio-finish-receipt.json'));
const initialSha=hashFile(file);
assert.equal(renderReceipt.jobSha256,jobSha);
assert.equal(renderReceipt.finalOutput,FINAL);
assert.equal(renderReceipt.sha256,initialSha);
assert.equal(audioReceipt.sourceSha256,job.audio.inputSha256);
assert.equal(audioReceipt.filter,job.audio.filter);
assert.equal(audioReceipt.output,path.join(ROOT,OUTPUT,'mix-minus-0.3dB.m4a'));
assert.equal(audioReceipt.sha256,hashFile(audioReceipt.output));
const binding=readJson(path.join(ROOT,CONTROL,'context-v2/binding.v1.json'));
write(path.join(dir,'knowledge-before.json'),knowledge(binding));
const run=(label,exe,args)=>runLog(label,exe,args,dir,1200000);
const media=JSON.parse(run('probe',ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]).stdout);
write(path.join(dir,'media.json'),media);
const v=media.streams.find(s=>s.codec_type==='video'),a=media.streams.find(s=>s.codec_type==='audio');
run('full-decode',ffmpeg,['-v','error','-xerror','-i',file,'-map','0:v:0','-map','0:a:0','-f','null','-']);
const scan=run('signal-scan',ffmpeg,['-hide_banner','-nostats','-i',file,'-vf','blackdetect=d=0.2:pix_th=0.1,freezedetect=n=-50dB:d=2',
  '-af','silencedetect=noise=-50dB:d=2,ebur128=peak=true','-f','null','-']);
const tail=scan.stderr.slice(scan.stderr.lastIndexOf('Summary:'));
const lufs=Number(tail.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]),tp=Number(tail.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
const events=scan.stderr.split('\n').filter(s=>/black_start|freeze_start|freeze_end|silence_start|silence_end/.test(s));
const pcm=(p)=>{
  verifyFfmpeg(ffmpeg);
  const r=spawnSync(ffmpeg,['-v','error','-i',p,'-map','0:a:0','-ac','1','-ar','8000','-c:a','pcm_f32le','-f','f32le','pipe:1'],{maxBuffer:64*1024*1024,timeout:120000,env:cleanEnvironment(dir)});
  assert.equal(r.status,0);return new Float32Array(r.stdout.buffer,r.stdout.byteOffset,r.stdout.length/4);
};
const before=pcm(path.join(ROOT,PREVIEW)),after=pcm(file);
const visual=readJson(path.join(ROOT,'remotion/src/lanzhou-services-v91-candidate-r2/visual-plan.v1.json'));
const data=readJson(path.join(ROOT,'edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r1/data.v1.json'));
const spans=[{id:'full-mix',start:0,end:8393/30},{id:'host',start:15,end:70},{id:'news',start:69/30,end:313/30},
  ...data.papers.map(p=>({id:p.id,start:p.outputStartFrame/30,end:(p.outputStartFrame+p.durationInFrames)/30})),
  ...visual.sfx.map(c=>({id:c.id,start:c.frame/30,end:(c.frame+c.durationInFrames)/30}))];
const amplitude=10**(-.3/20);
const gains=spans.map(s=>{
  let aa=0,bb=0,ab=0,err=0,n=0;
  for(let i=Math.floor(s.start*8000);i<Math.min(before.length,after.length,Math.ceil(s.end*8000));i++){
    const x=before[i],y=after[i];aa+=x*x;bb+=y*y;ab+=x*y;err+=(y-amplitude*x)**2;n++;
  }
  const rms=10*Math.log10(aa/n),gain=10*Math.log10(bb/aa),correlation=ab/Math.sqrt(aa*bb),residual=Math.sqrt(err/aa);
  return {...s,rmsDbFS:rms,gainDb:gain,correlation,normalizedResidual:residual,pass:rms< -55||Math.abs(gain+.3)<=.25&&correlation>=.99&&residual<=.06};
});
write(path.join(dir,'audio-window-delta.json'),{source:PREVIEW,target:FINAL,sourceSamples8k:before.length,targetSamples8k:after.length,alignmentOffsetSamples:0,gains,
  note:'8k单声道同时间窗全混音比较，不代替完整立体声听审，也不冒称已从混音分离每个声源；R2真人/新闻/纸艺/26卡点的原始绑定继承，并检测有声窗总混音未移时。'});
function packetHashes(p,selector,label){return run(label,ffprobe,['-v','error','-select_streams',selector,'-show_packets','-show_data_hash','sha256','-show_entries','packet=pts,dts,duration,size,data_hash','-of','json',p]).stdout;}
const videoPacketsRaw=JSON.parse(packetHashes(path.join(ROOT,OUTPUT,'video-only.mp4'),'v:0','video-raw-packets')).packets;
const videoPacketsFinal=JSON.parse(packetHashes(file,'v:0','video-final-packets')).packets;
assert.deepEqual(videoPacketsFinal,videoPacketsRaw,'封装不得改变任何已渲染视频包');
const audioPacketsMaster=JSON.parse(packetHashes(path.join(ROOT,OUTPUT,'mix-minus-0.3dB.m4a'),'a:0','audio-master-packets')).packets;
const audioPacketsFinal=JSON.parse(packetHashes(file,'a:0','audio-final-packets')).packets;
assert.deepEqual(audioPacketsFinal,audioPacketsMaster,'封装不得改变任何音频包或时间戳');
const checks={completeDecode:true,frames:Number(v.nb_read_frames)===8393,width:v.width===1920,height:v.height===1080,
  fps:v.r_frame_rate==='30/1',duration:Math.abs(Number(v.duration)-8393/30)<.001,videoCodec:v.codec_name==='h264',
  highProfile:v.profile==='High',pixelFormat:v.pix_fmt==='yuv420p',stereoAAC:a.codec_name==='aac'&&a.channels===2&&Number(a.sample_rate)===48000,
  truePeak:tp<=-1&&Number.isFinite(tp),loudness:lufs>=-18&&lufs<=-14,signalEventsEmpty:events.length===0,
  audioWindows:gains.every(g=>g.pass),audioSampleLength:Math.abs(before.length-after.length)<=Math.ceil(1024/6),
  videoPacketsUnchanged:true,audioPacketsUnchanged:true};
const reviewFrames=[52,160,600,1600,2400,2495,2582,...data.papers.flatMap(p=>[p.outputStartFrame+15,p.outputStartFrame+Math.floor(p.durationInFrames/2),p.outputStartFrame+p.durationInFrames-5]),6360,8390];
const frames=[];
for(const frame of reviewFrames){const p=path.join(dir,`frame-${String(frame).padStart(5,'0')}.png`);
  run(`frame-${frame}`,ffmpeg,['-v','error','-n','-ss',(frame/30).toFixed(9),'-i',file,'-frames:v','1','-update','1',p]);
  frames.push({frame,time:frame/30,path:p,sha256:hashFile(p),visualReview:'pending'});
}
verifyJob(job);write(path.join(dir,'knowledge-after.json'),knowledge(binding));
assert.equal(hashFile(file),initialSha,'质检期间成片字节不得改变');
assert.equal(hashFile(audioReceipt.output),audioReceipt.sha256);
write(path.join(dir,'machine-qa.v1.json'),{schema:'lanzhou-r2-formal-qa/v1',status:Object.values(checks).every(Boolean)?'machine-passed-pending-visual-review':'technical-review-required',
  at:new Date().toISOString(),video:{path:file,sha256:hashFile(file),bytes:fs.statSync(file).size,width:v.width,height:v.height,frames:Number(v.nb_read_frames),duration:Number(v.duration),pixFmt:v.pix_fmt,colorRange:v.color_range},
  checks,loudnessLUFS:lufs,truePeakDbFS:tp,signalEvents:events,riskFrames:frames,sfxCount:26,paperCount:5,unresolvedAsrCount:13,
  tools:{ffmpeg:{path:ffmpeg,sha256:hashFile(ffmpeg)},ffprobe:{path:ffprobe,sha256:hashFile(ffprobe)},qaScriptSha256:hashFile(new URL(import.meta.url))},
  productionBinding:{jobSha256:jobSha,renderReceiptSha256:hashFile(path.join(ROOT,OUTPUT,'render-receipt.json')),audioReceiptSha256:hashFile(path.join(ROOT,OUTPUT,'audio-finish-receipt.json')),unchangedDuringQa:true},
  currentSharedPostshootValidatorPassed:false,userFinalFullWatchConfirmed:false,publiclyPublished:false});
console.log(JSON.stringify({file,checks,lufs,tp,sha256:hashFile(file),riskFrameCount:frames.length}));
if(!Object.values(checks).every(Boolean))process.exitCode=1;
