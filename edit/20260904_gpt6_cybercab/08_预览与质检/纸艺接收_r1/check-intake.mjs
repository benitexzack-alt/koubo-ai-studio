import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(out,'../..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const save=(n,s)=>fs.writeFileSync(path.join(out,n),s,{flag:'wx'});
const run=(cmd,args)=>spawnSync(cmd,args,{encoding:'utf8',maxBuffer:32*1024*1024,timeout:90000});
const planPath=path.join(root,'04_导演拆解/剪后261秒_素材与镜头对位.v2.json');
const plan=JSON.parse(fs.readFileSync(planPath));
const report={startedAt:new Date().toISOString(),planPath,planSha256:hash(planPath),method:'机器检查加静帧抽查；不是原速听看',fullSpeedWatched:false,audioListened:false,finalAccepted:false,slots:plan.paperSlots,references:[],assets:[]};
for(const s of plan.paperSlots){const p=path.join(root,`05_首帧图片/${s.id}.png`);report.references.push({id:s.id,path:p,sha256:hash(p)});}
for(let i=1;i<=6;i++){
 const file= i===1?'视频.mp4':`视频_${i}.mp4`;const p=path.join(root,'06_用户生成视频',file);const id=`F${i}`;
 const probeRun=run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p]);
 if(probeRun.status!==0)throw Error(probeRun.stderr);
 const probe=JSON.parse(probeRun.stdout);save(`${id}.ffprobe.json`,probeRun.stdout);
 const v=probe.streams.find(x=>x.codec_type==='video');const aud=probe.streams.filter(x=>x.codec_type==='audio');
 const dur=Number(v.duration??probe.format.duration);const [n,d]=v.avg_frame_rate.split('/').map(Number);const fps=n/d;
 const flags=['-hide_banner','-nostats','-v','info','-i',p,'-map','0:v:0','-vf','blackdetect=d=0.15:pix_th=0.10:pic_th=0.98,freezedetect=n=-50dB:d=0.5'];
 if(aud.length)flags.push('-map','0:a:0','-af','silencedetect=n=-50dB:d=0.3,ebur128=peak=true');
 flags.push('-f','null','-');
 const dec=run('ffmpeg',flags);save(`${id}.decode-signal.log`,dec.stderr);
 const interesting=dec.stderr.split('\n').filter(x=>/black_start|freeze_start|freeze_end|freeze_duration|silence_start|silence_end|silence_duration/.test(x));
 const loud=dec.stderr.slice(dec.stderr.lastIndexOf('Summary:'));
 const frameCount=Math.max(1,Math.ceil(dur*2));const rows=Math.ceil(frameCount/5);
 const contact=`${id}-contact-0.5s.jpg`;
 const c=run('ffmpeg',['-v','error','-n','-i',p,'-vf',`fps=2,scale=480:-2,tile=5x${rows}:nb_frames=${frameCount}:padding=2:margin=2`,'-frames:v','1','-q:v','2',path.join(out,contact)]);
 const frames=[];
 for(const [role,t] of [['first',0],['middle',dur/2],['last',Math.max(0,dur-1/fps)]]){
  const name=`${id}-${role}-${t.toFixed(3)}.jpg`;
  const x=run('ffmpeg',['-v','error','-n','-ss',String(t),'-i',p,'-frames:v','1','-vf','scale=1280:-2','-q:v','2',path.join(out,name)]);
  frames.push({role,requestedTimeSeconds:t,file:name,exitCode:x.status});
 }
 const last=frames.at(-1);const ocr=run('tesseract',[path.join(out,last.file),'stdout','-l','chi_sim+eng','--psm','11']);
 save(`${id}-last.ocr.txt`,ocr.stdout);save(`${id}-last.ocr.log`,ocr.stderr);
 const asset={fileId:id,file,path:p,sha256:hash(p),bytes:fs.statSync(p).size,durationSeconds:dur,width:v.width,height:v.height,fps,videoFrames:v.nb_frames,audio:aud,fullDecodeExitCode:dec.status,decodeError:dec.error?.message??null,signalThresholds:{blackMinimumSeconds:0.15,blackPixelLuma:0.1,blackPictureRatio:0.98,freezeNoiseDb:-50,freezeMinimumSeconds:0.5,silenceDb:-50,silenceMinimumSeconds:0.3},signalEvents:interesting,loudnessSummary:aud.length?loud:null,contactSheet:contact,contactExitCode:c.status,contactSampleIntervalSeconds:0.5,contactReadingOrder:'从左至右，再从上至下，约0、0.5、1.0秒递增；fps重采样非精确动作边界',frames,ocr:{engine:'tesseract chi_sim+eng psm11',exitCode:ocr.status,text:ocr.stdout,interpretation:'仅识别结果，不据识别遗漏认定错字'}};
 report.assets.push(asset);save(`${id}.machine.json`,JSON.stringify(asset,null,2)+'\n');
 console.log(JSON.stringify({fileId:id,file,durationSeconds:dur,size:[v.width,v.height],fps,audioTracks:aud.length,decode:dec.status,signalEvents:interesting,loudness:asset.loudnessSummary,ocr:ocr.stdout}));
}
report.finishedAt=new Date().toISOString();save('machine-intake.v1.json',JSON.stringify(report,null,2)+'\n');
