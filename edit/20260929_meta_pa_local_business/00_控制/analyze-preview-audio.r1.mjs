import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

// 本期只读QA。只写本脚本所有权内的检查报告，不改任何混音、源片、组件。
const root=process.cwd();
const episode='edit/20260929_meta_pa_local_business';
const publicDir='remotion/public/media/meta-pa-local-business-r1/audio';
const out=`${episode}/10_剪辑准备/声音/qa`;
const args=process.argv.slice(2), value=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:null;
const revision=value('--revision')??'r3';
if(!/^r[0-9]+$/u.test(revision))throw new Error('检查修订号必须为r加数字');
const mix=value('--mix')??`${publicDir}/final-mix.${revision}.wav`;
const base=value('--base')??`${publicDir}/base-mix.wav`;
const voice=value('--voice')??`${publicDir}/voice-normalized.wav`;
const planFile=value('--plan')??`${episode}/10_剪辑准备/声音/逐动作音效与原生声音.${revision}.json`;
const video=value('--video')??`${episode}/10_剪辑准备/完整视听小样R1/完整视听小样R1.mp4`;
const rate=48000, channels=2;
fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const binding=p=>({path:p,sha256:hash(p),bytes:fs.statSync(p).size});
const write=(name,body)=>fs.writeFileSync(`${out}/${name}`,JSON.stringify(body,null,2)+'\n');
const run=(bin,argv,options={})=>{
  const r=spawnSync(bin,argv,{encoding:'utf8',maxBuffer:20e6,...options});
  if(r.status!==0)throw new Error(`${bin}检查失败:${r.stderr?.toString()?.slice(-3000)??r.error}`);
  return r;
};
const probe=file=>JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]).stdout);
const duration=file=>Number(probe(file).format.duration);
const pcm=file=>{
  const r=run('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-ar',String(rate),'-ac',String(channels),'-c:a','pcm_f32le','-f','f32le','pipe:1'],{encoding:null,maxBuffer:300e6});
  const buffer=r.stdout;
  return new Float32Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/4);
};
const db=x=>x>0?20*Math.log10(x):null;
const rounded=x=>Number.isFinite(x)?Number(x.toFixed(5)):x;
function stats(a,b,start,end){
  const first=Math.max(0,Math.round(start*rate)*channels),last=Math.min(a.length,b?.length??a.length,Math.round(end*rate)*channels);
  let sum=0,reference=0,peak=0,referencePeak=0,nonzero=0;
  for(let i=first;i<last;i++){
    const ref=b?.[i]??0,delta=a[i]-ref;
    sum+=delta*delta;reference+=ref*ref;peak=Math.max(peak,Math.abs(delta));referencePeak=Math.max(referencePeak,Math.abs(ref));
    if(Math.abs(delta)>1e-6)nonzero++;
  }
  const count=Math.max(1,last-first),rms=Math.sqrt(sum/count),refRms=Math.sqrt(reference/count);
  return {sampleValues:last-first,rms:rounded(rms),rmsDbfs:rounded(db(rms)),samplePeak:rounded(peak),samplePeakDbfs:rounded(db(peak)),referenceRmsDbfs:rounded(db(refRms)),referencePeakDbfs:rounded(db(referencePeak)),differenceToReferenceRmsDb:rounded(refRms>0?db(rms/refRms):null),nonzeroSampleValuesAbove1e6:nonzero};
}
function union(ranges){
  const sorted=ranges.map(([a,b])=>[Math.max(0,a),b]).sort((a,b)=>a[0]-b[0]),result=[];
  for(const range of sorted){const last=result.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else result.push([...range]);}
  return result;
}
function outsideStats(a,b,ranges){
  const sorted=union(ranges).map(([start,end])=>[Math.floor(start*rate)*channels,Math.ceil(end*rate)*channels]);
  const length=Math.min(a.length,b.length);let rangeIndex=0,sum=0,peak=0,count=0,changed=0;
  for(let i=0;i<length;i++){
    while(sorted[rangeIndex]&&i>=sorted[rangeIndex][1])rangeIndex++;
    if(sorted[rangeIndex]&&i>=sorted[rangeIndex][0]&&i<sorted[rangeIndex][1]){i=sorted[rangeIndex][1]-1;continue;}
    const x=a[i]-b[i];sum+=x*x;peak=Math.max(peak,Math.abs(x));count++;if(Math.abs(x)>1e-6)changed++;
  }
  return {samplesCompared:count,maxDifference:peak,rmsDifference:Math.sqrt(sum/Math.max(1,count)),changedSamplesAbove1e6:changed,passedSampleTolerance:peak<=1e-6,excludedWindowsSeconds:union(ranges),meaning:'只证明添加音轨之外样本未改变；不证明机器转写正确或人耳可听'};
}
function loudness(file){
  const log=run('ffmpeg',['-hide_banner','-nostats','-i',file,'-af','loudnorm=I=-17.5:TP=-2:LRA=9:print_format=json','-f','null','-']).stderr;
  const m=log.match(/\{\s*"input_i"[\s\S]*?\}/u);
  if(!m)throw new Error('未取得响度和真峰扫描结果');
  const measured=JSON.parse(m[0]);
  return {integratedLufs:Number(measured.input_i),truePeakDbtp:Number(measured.input_tp),loudnessRangeLu:Number(measured.input_lra),thresholdLufs:Number(measured.input_thresh),method:'FFmpeg loudnorm 输入测量；输出滤镜只到null，不修改被测文件'};
}

const audioOutput=`${out}/audio-sample-qa.${revision}.json`;
const missing=[mix,base,voice,planFile].filter(p=>!fs.existsSync(p));
if(missing.length){console.log(JSON.stringify({status:`待${revision}音频输入`,missing},null,2));process.exit(0);}
const inputs={mix:binding(mix),base:binding(base),voice:binding(voice),plan:binding(planFile)};
let audio=fs.existsSync(audioOutput)?read(audioOutput):null;
const cached=audio&&Object.entries(inputs).every(([key,item])=>audio.inputs?.[key]?.sha256===item.sha256);
if(!cached){
  const plan=read(planFile),probes={mix:probe(mix),base:probe(base),voice:probe(voice)};
  if(Number(probes.mix.format.duration)<409.4)throw new Error(`${revision}混音可能仍在写入，暂不读取未完整文件`);
  const samples={mix:pcm(mix),base:pcm(base),voice:pcm(voice)};
  const checkedDuration=Math.min(samples.mix.length,samples.base.length,samples.voice.length)/(rate*channels);
  const events=plan.events.map(e=>{
    const start=e.frame/30,end=Math.min(checkedDuration,start+(e.durationSeconds??.4)+.10);
    const s=stats(samples.mix,samples.base,start,end);
    const neighboring=plan.events.filter(other=>other.id!==e.id&&other.frame/30<end&&other.frame/30+(other.durationSeconds??.4)>start).map(other=>other.id);
    return {id:e.id,beatId:e.beatId??null,role:e.role,priority:e.priority,startSeconds:start,endSeconds:end,source:{path:e.source,sha256:e.sha256,hashConfirmed:hash(e.source)===e.sha256,volume:e.volume,license:e.license,licenseReference:e.licenseReference},...s,presentDifference:s.nonzeroSampleValuesAbove1e6>0,overlappingEventIds:neighboring,isolatedPresenceProof:neighboring.length===0,possibleLowLevel:s.differenceToReferenceRmsDb!=null&&s.differenceToReferenceRmsDb<-30};
  });
  const native=plan.native.map(n=>{
    const start=n.frame/30,end=start+n.duration,s=stats(samples.base,samples.voice,start,end);
    return {id:n.id,startSeconds:start,endSeconds:end,gain:n.gain,source:binding(n.source),...s,notUniformlyMuted:s.nonzeroSampleValuesAbove1e6>0,meaning:'原生声音在对应窗口参与了混音；不替代试听语音/音乐/动作声是否合适'};
  });
  const sfxRanges=plan.events.map(e=>[e.frame/30-.15,e.frame/30+(e.durationSeconds??.4)+.20]);
  const nativeRanges=plan.native.map(n=>[n.frame/30-.15,n.frame/30+n.duration+.20]);
  const baselineOutside=outsideStats(samples.base,samples.voice,nativeRanges);
  const finalOutside=outsideStats(samples.mix,samples.base,sfxRanges);
  const sourceUse=new Map();
  for(const e of plan.events){const arr=sourceUse.get(e.sha256)??[];arr.push(e);sourceUse.set(e.sha256,arr);}
  const repetitionViolations=[];
  for(const [sha,list]of sourceUse){if(list.length>3)repetitionViolations.push({sha256:sha,kind:'单一源超过3次',count:list.length});for(let i=1;i<list.length;i++)if(list[i].frame/30-list[i-1].frame/30<25)repetitionViolations.push({sha256:sha,kind:'同一源25秒内重复',ids:[list[i-1].id,list[i].id],seconds:list[i].frame/30-list[i-1].frame/30});}
  for(let i=1;i<plan.events.length;i++)if(plan.events[i].sha256===plan.events[i-1].sha256)repetitionViolations.push({kind:'相邻事件重复音色',ids:[plan.events[i-1].id,plan.events[i].id]});
  const loudnessResults={mix:loudness(mix),base:loudness(base),voice:loudness(voice)};
  const hook=events.find(e=>e.role==='hook-accent');
  const technicalErrors=[];
  if(events.some(e=>!e.presentDifference))technicalErrors.push('存在事件窗未检测到附加音效样本差分');
  if(events.some(e=>!e.source.hashConfirmed))technicalErrors.push('音效源哈希发生变化');
  if(native.some(n=>!n.notUniformlyMuted))technicalErrors.push('存在原生声音窗无基线差分');
  if(!baselineOutside.passedSampleTolerance)technicalErrors.push('原生窗口外的原声样本发生改变，需要检查延迟/处理');
  if(!finalOutside.passedSampleTolerance)technicalErrors.push('附加音效窗口外的基线样本发生改变，需要检查延迟/处理');
  if(loudnessResults.mix.truePeakDbtp>-1)technicalErrors.push('混音真峰高于-1 dBTP安全线');
  if(repetitionViolations.length)technicalErrors.push('音色重复规则未通过');
  const warnings=[];
  if(loudnessResults.mix.integratedLufs<-21||loudnessResults.mix.integratedLufs>-14)warnings.push('总响度不在本期候选口播观察区间-21至-14 LUFS，需正常音量试听');
  if(events.some(e=>e.possibleLowLevel))warnings.push('部分音点差分能量比基线低30 dB以上；机器证明有轨，不等于正常音量可感知');
  if(events.some(e=>e.overlappingEventIds.length))warnings.push('部分音点与其他音点重叠，窗口差分不能单独证明每个源的可感知程度');
  audio={schemaVersion:'koubo-audio-sample-qa/v1',revision,status:technicalErrors.length?'technical-failed':'technical-checks-passed-listening-pending',inputs,probes,pcm:{sampleRate:rate,channels,durationSeconds:checkedDuration,sampleValues:Object.fromEntries(Object.entries(samples).map(([k,a])=>[k,a.length]))},loudness:loudnessResults,hook,events,native,baselineVoiceOutsideNativeWindows:baselineOutside,finalBaseOutsideSfxWindows:finalOutside,repetition:{distinctSoundSources:sourceUse.size,violations:repetitionViolations},technicalErrors,warnings,userAudibilityConfirmed:false,humanListeningPerformed:false};
  write(`audio-sample-qa.${revision}.json`,audio);
  console.log(JSON.stringify({status:audio.status,soundEvents:events.length,presentEvents:events.filter(e=>e.presentDifference).length,nativeClips:native.length,nativeDifferenceWindows:native.filter(n=>n.notUniformlyMuted).length,loudness:audio.loudness.mix,hook,technicalErrors,warnings},null,2));
}else console.log(JSON.stringify({status:'音频QA哈希未变，复用本次扫描',report:audioOutput}));

if(args.includes('--audio-only')){console.log(JSON.stringify({status:'本次仅音频检查，未启动MP4检查或渲染',revision}));process.exit(audio.technicalErrors.length?1:0);}
if(!fs.existsSync(video)){console.log(JSON.stringify({status:'音频已核对，完整MP4待输出',expectedVideo:video}));process.exit(audio.technicalErrors.length?1:0);}
const vp=probe(video),videoStream=vp.streams.find(s=>s.codec_type==='video'),audioStream=vp.streams.find(s=>s.codec_type==='audio');
const decode=run('ffmpeg',['-hide_banner','-v','error','-xerror','-i',video,'-map','0:v:0','-map','0:a:0','-f','null','-']);
const videoDuration=Number(videoStream?.duration??vp.format.duration),audioDuration=Number(audioStream?.duration??vp.format.duration),videoErrors=[];
if(!videoStream||!audioStream)videoErrors.push('完整小样缺少视频或音频流');
if(audioStream?.codec_name!=='aac')videoErrors.push('小样音频不是AAC');
if(Number(audioStream?.sample_rate)!==rate)videoErrors.push('小样音频采样率不是48 kHz');
if(Math.abs(videoDuration-audioDuration)>.08)videoErrors.push('视频和音频时长差超过80毫秒');
if(Math.abs(Number(vp.format.duration)-audio.pcm.durationSeconds)>.10)videoErrors.push('容器时长与本期完整混音不一致');
const videoReport={schemaVersion:'koubo-preview-container-qa/v1',status:videoErrors.length?'technical-failed':'full-decode-and-aac-check-passed-user-review-pending',video:binding(video),audioQa:binding(audioOutput),streams:vp.streams,format:vp.format,durations:{videoSeconds:videoDuration,audioSeconds:audioDuration,audioVideoDifferenceSeconds:Math.abs(videoDuration-audioDuration),mixSeconds:audio.pcm.durationSeconds},decode:{complete:true,exitCode:0,stderr:decode.stderr},technicalErrors:videoErrors,userAudibilityConfirmed:false,fullHumanViewingPerformed:false};
write('preview-container-qa.r1.json',videoReport);
console.log(JSON.stringify({status:videoReport.status,video:videoReport.video,durations:videoReport.durations,technicalErrors:videoErrors},null,2));
if(audio.technicalErrors.length||videoErrors.length)process.exit(1);
