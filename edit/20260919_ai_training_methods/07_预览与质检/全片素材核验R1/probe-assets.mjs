import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve('edit/20260919_ai_training_methods');
const out=path.join(root,'07_预览与质检/全片素材核验R1');
const inputs=[['G01','03_AI情景视频/视频 (17).mp4'],...['视频.mp4','视频_2.mp4','视频_3.mp4','视频_4.mp4','视频_5.mp4','视频_6.mp4','视频_7.mp4'].map((f,i)=>[`paper-file-${i+1}`,`04_纸艺视频/${f}`])];
const rows=[];
for(const [key,rel] of inputs){
 const file=path.join(root,'01_素材投放区',rel);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file],{encoding:'utf8'}));
 const v=probe.streams.find(s=>s.codec_type==='video');
 const duration=Number(probe.format.duration);
 const times=[0,duration/2,Math.max(0,duration-.2)];
 const frames=times.map((t,i)=>{
  const p=path.join(out,`${key}-${i}.jpg`);
  execFileSync('ffmpeg',['-v','error','-nostdin','-ss',String(t),'-i',file,'-frames:v','1','-vf','scale=640:-2','-y',p]);
  return {timeSeconds:t,path:p};
 });
 let decodeError=null;
 try{execFileSync('ffmpeg',['-v','error','-nostdin','-i',file,'-map','0:v:0','-f','null','-'],{encoding:'utf8',stdio:['ignore','ignore','pipe']});}catch(e){decodeError=String(e.stderr);}
 rows.push({key,path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),durationSeconds:duration,width:v.width,height:v.height,frameRate:v.avg_frame_rate,codec:v.codec_name,audioStreams:probe.streams.filter(s=>s.codec_type==='audio').map(s=>({codec:s.codec_name,sampleRate:s.sample_rate,channels:s.channels})),decoded:decodeError===null,decodeError,frames});
}
fs.writeFileSync(path.join(out,'probe-results.json'),JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows.map(({frames,...r})=>r),null,2));
