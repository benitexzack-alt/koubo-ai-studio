import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const repo=path.resolve(import.meta.dirname,'../../../..');
const base='edit/20260906_lanzhou_ai_services';
const output=path.join(repo,base,'07_预览与质检/candidate-preview-r1');
const video=path.join(output,'render/with-sfx-960x540.mp4');
const qa=path.join(output,'qa');
assert(fs.existsSync(video),'没有候选视频，不生成QA');
assert(!fs.existsSync(qa),'QA已存在，不覆盖');
fs.mkdirSync(qa);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(name,obj)=>fs.writeFileSync(path.join(qa,name),`${JSON.stringify(obj,null,2)}\n`,{flag:'wx'});
function run(name,tool,args){
  const start=Date.now();const r=spawnSync(tool,args,{encoding:'utf8',maxBuffer:64*1024*1024,timeout:600000});
  fs.writeFileSync(path.join(qa,`${name}.stdout.txt`),r.stdout??'',{flag:'wx'});
  fs.writeFileSync(path.join(qa,`${name}.stderr.txt`),r.stderr??'',{flag:'wx'});
  const result={tool,args,exitCode:r.status,elapsedMs:Date.now()-start,error:r.error?.message??null};
  write(`${name}.command.json`,result);return {...result,stdout:r.stdout??'',stderr:r.stderr??''};
}
const probe=run('probe','/opt/homebrew/bin/ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',video]);
const media=JSON.parse(probe.stdout);write('media.json',media);
const v=media.streams.find(s=>s.codec_type==='video'),a=media.streams.find(s=>s.codec_type==='audio');
const decode=run('full-decode','/opt/homebrew/bin/ffmpeg',['-hide_banner','-v','error','-xerror','-i',video,'-map','0:v:0','-map','0:a:0','-f','null','-']);
const scan=run('signal-scan','/opt/homebrew/bin/ffmpeg',['-hide_banner','-nostats','-i',video,
  '-vf','blackdetect=d=0.2:pix_th=0.1,freezedetect=n=-50dB:d=2',
  '-af','silencedetect=noise=-50dB:d=2,ebur128=peak=true','-f','null','-']);
const blacks=[...scan.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map(m=>({start:+m[1],end:+m[2],duration:+m[3]}));
const silence=[...scan.stderr.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map(m=>({end:+m[1],duration:+m[2]}));
const freezes=[...scan.stderr.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_duration: ([\d.]+)[\s\S]*?freeze_end: ([\d.]+)/g)].map(m=>({start:+m[1],duration:+m[2],end:+m[3]}));
const tail=scan.stderr.slice(scan.stderr.lastIndexOf('Summary:'));
const loudness=Number(tail.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
const truePeak=Number(tail.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
const data=JSON.parse(fs.readFileSync(path.join(repo,base,'04_导演拆解/candidate-preview-r1/data.v1.json')));
const plan=JSON.parse(fs.readFileSync(path.join(repo,'remotion/src/lanzhou-services-v91-candidate-r1/visual-plan.v1.json')));
const permittedHolds=[{from:69/30,to:313/30,reason:'完整新闻资料画面原生停留'},...plan.official.map(o=>({from:o.from/30,to:o.to/30,reason:'官方文档阅读停留'}))];
for(const f of freezes)f.explanation=permittedHolds.find(h=>f.start>=h.from-.15&&f.end<=h.to+.15)?.reason??'需要逐帧复核，未自动豁免';
const checks={probeExit:probe.exitCode===0,decodeExit:decode.exitCode===0,signalScanExit:scan.exitCode===0,
  frames:Number(v?.nb_read_frames)===8393,width:v?.width===960,height:v?.height===540,
  fps:v?.r_frame_rate==='30/1',duration:Math.abs(Number(v?.duration)-8393/30)<.04,
  codec:v?.codec_name==='h264',audio:a?.codec_name==='aac'&&a?.channels===2,
  noBlackIntervals:blacks.length===0,noLongGlobalSilence:silence.length===0,
  noUnexplainedFreeze:freezes.every(f=>!f.explanation.startsWith('需要')),
  loudnessMeasured:Number.isFinite(loudness),truePeakMeasured:Number.isFinite(truePeak),noClipping:Number.isFinite(truePeak)&&truePeak<=0};
write('candidate-machine-qa.v1.json',{schemaVersion:'lanzhou-services-candidate-machine-qa/v1',
  status:Object.values(checks).every(Boolean)?'technical-checks-passed-user-review-required':'technical-review-required',
  video:{path:video,sha256:sha(video),bytes:fs.statSync(video).size,duration:v?.duration,width:v?.width,height:v?.height,fps:v?.r_frame_rate,frames:v?.nb_read_frames,pixFmt:v?.pix_fmt,colorRange:v?.color_range,videoCodec:v?.codec_name,audioCodec:a?.codec_name,channels:a?.channels},
  checks,blacks,silence,freezes,loudnessLUFS:loudness,truePeakDbFS:truePeak,
  paperUses:data.papers.map(p=>({id:p.id,sha256:p.sha256,from:p.outputStartFrame/30,to:(p.outputStartFrame+p.durationInFrames)/30,gain:.1,nativeAudioPreservedByComposition:true,earListeningPerformed:false})),
  sourceAudio:{hostGain:1,newsGain:.62,additionalSfxGain:.13,newsHostOverlap:false},
  unresolvedTranscriptItems:13,sourcePaperExceptions:'用户仅本条接受，原始质量失败记录保留',
  entireVideoEarListeningPerformed:false,userPreviewApproved:false,formalEnabled:false,publishAuthorized:false});
console.log(JSON.stringify({qa,video,sha256:sha(video),checks,loudness,truePeak,freezes,blacks,silence},null,2));
