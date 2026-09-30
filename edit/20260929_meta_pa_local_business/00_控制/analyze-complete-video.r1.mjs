import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateKnowledgeContextForProductionV2} from '../../../tools/knowledge-context-production-gate.mjs';

// 本期只读质检：不渲染、不更改源片/混音、不安装工具或上传音频。
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
process.chdir(projectRoot);
const episode='edit/20260929_meta_pa_local_business';
const argv=process.argv.slice(2);
const option=flag=>argv.includes(flag)?argv[argv.indexOf(flag)+1]:null;
const video=option('--video')??`${episode}/12_正式成片/Meta个人AI助理与本地商家_V8_R1_1080P.mp4`;
const reference=option('--reference')??'remotion/public/media/meta-pa-local-business-r1/audio/final-mix.r3.wav';
const out=`${episode}/10_剪辑准备/完整成片质检`;
const output=`${out}/完整成片_技术质检.r1.json`;
const report=`${out}/完整成片_技术质检.r1.md`;
const jobPath=`${episode}/10_剪辑准备/完整视听小样R1/preview-job.json`;
const missing=[video,reference].filter(file=>!fs.existsSync(file));
if(missing.length){console.log(JSON.stringify({状态:'等待真实成片输入，未执行检查',缺少文件:missing},null,2));process.exit(0);}
const digest=file=>{
  const hash=crypto.createHash('sha256'),chunk=Buffer.allocUnsafe(1024*1024),fd=fs.openSync(file,'r');
  try{let count;while((count=fs.readSync(fd,chunk,0,chunk.length,null))>0)hash.update(chunk.subarray(0,count));}
  finally{fs.closeSync(fd);}
  return hash.digest('hex');
};
const bind=file=>({path:file,sha256:digest(file),bytes:fs.statSync(file).size});

// 绑定必须使用本期受控预览 job 的现行文件哈希，不能拿历史文件或空壳门禁冒充。
const job=JSON.parse(fs.readFileSync(jobPath,'utf8')),jobSha256=digest(jobPath);
if(path.resolve(job.outputs?.fullPreview??'')!==path.resolve(video))throw new Error('被检成片不是本期受控 job 绑定的完整候选输出');
if(path.resolve(job.sound?.mix??'')!==path.resolve(reference))throw new Error('被检 PCM 不是本期受控 job 绑定的混音');
if(!Array.isArray(job.bindings)||job.bindings.length===0)throw new Error('本期受控 job 缺少输入 bindings，停止成片检查');
const bindingFailures=[],bindingChecks=job.bindings.map(item=>{
  const absolute=path.resolve(projectRoot,String(item.path??'')),relative=path.relative(projectRoot,absolute);
  if(!item.path||path.isAbsolute(item.path)||relative==='..'||relative.startsWith(`..${path.sep}`)||!/^[a-f0-9]{64}$/u.test(item.sha256??'')){
    bindingFailures.push(`输入绑定格式或范围错误：${item.path??'缺少路径'}`);return {path:item.path??null,matched:false};
  }
  if(!fs.existsSync(absolute)||!fs.lstatSync(absolute).isFile()||fs.realpathSync(absolute)!==absolute){
    bindingFailures.push(`输入不存在、非普通文件或非规范路径：${item.path}`);return {path:item.path,matched:false};
  }
  const actualSha256=digest(absolute),matched=actualSha256===item.sha256;
  if(!matched)bindingFailures.push(`输入哈希变化：${item.path}`);
  return {path:item.path,expectedSha256:item.sha256,actualSha256,bytes:fs.statSync(absolute).size,matched};
});
if(bindingFailures.length)throw new Error(`受控输入校验失败，不执行成片 QA：\n${bindingFailures.join('\n')}`);
const requestedCommand='complete-candidate-qa';
const requestedProof=validateKnowledgeContextForProductionV2({projectRoot,jobPath,job,command:requestedCommand});
// 现行共享校验器未注册本期动作名时，只在本脚本内转为已注册的 qa 实际复检。
const contextProof=requestedProof.required===true?requestedProof:validateKnowledgeContextForProductionV2({projectRoot,jobPath,job,command:'qa'});
if(contextProof.required!==true||contextProof.validationStatus!=='context-valid'||contextProof.formalExecutionAllowed!==true||contextProof.jobReceiptSha256!==jobSha256)throw new Error('知识上下文没有对当前 job 完成实际复检，停止成片检查');
const videoBinding=bind(video),referenceBinding=bind(reference);
const run=(bin,args,options={})=>{
  const r=spawnSync(bin,args,{encoding:'utf8',maxBuffer:20e6,...options});
  if(r.status!==0)throw new Error(`${bin}检查未通过：${r.stderr?.toString()?.slice(-5000)??r.error}`);
  return r;
};
const probe=file=>JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]).stdout);
const ratio=text=>{const [n,d]=String(text).split('/').map(Number);return d?n/d:n;};
const vp=probe(video),rp=probe(reference);
const vs=vp.streams.find(s=>s.codec_type==='video'),as=vp.streams.find(s=>s.codec_type==='audio');
if(!vs||!as)throw new Error('真实成片必须同时包含视频和音频流；无声画面中间文件不登记为成片通过');
const fps=ratio(vs.avg_frame_rate),videoStart=Number(vs.start_time??0),audioStart=Number(as.start_time??0);
const videoDuration=Number(vs.duration??vp.format.duration),audioDuration=Number(as.duration??vp.format.duration),referenceDuration=Number(rp.format.duration);
const hardErrors=[],reviewFlags=[];
if(vs.width!==1920||vs.height!==1080)hardErrors.push(`画面规格不是1920×1080：${vs.width}×${vs.height}`);
if(Math.abs(fps-30)>1e-6)hardErrors.push(`帧率不是30fps：${fps}`);
if(vs.codec_name!=='h264')hardErrors.push(`视频编码不是H.264：${vs.codec_name}`);
if(as.codec_name!=='aac')hardErrors.push(`音频编码不是AAC：${as.codec_name}`);
if(Number(as.sample_rate)!==48000)hardErrors.push(`音频采样率不是48kHz：${as.sample_rate}`);
if(Number(as.channels)!==2)hardErrors.push(`音频不是双声道：${as.channels}`);
if(Math.abs(videoStart-audioStart)>1/30)hardErrors.push('视频和音频流起点差超过一帧');
if(Math.abs(videoDuration-audioDuration)>.08)hardErrors.push('视频和音频流时长差超过80毫秒');
if(Math.abs(Number(vp.format.duration)-referenceDuration)>.10)hardErrors.push('成片容器时长与完整r3混音相差超过100毫秒');

// 同一遍完整解码扫描黑帧与长静音，不对被测媒体做输出或变换保存。
const decodeArgs=['-hide_banner','-nostats','-v','info','-xerror','-i',video,'-map','0:v:0','-map','0:a:0','-vf','blackdetect=d=0.20:pic_th=0.98:pix_th=0.10','-af','silencedetect=noise=-50dB:d=2.0','-f','null','-'];
const decode=run('ffmpeg',decodeArgs);
const blackWindows=[...decode.stderr.matchAll(/black_start:([\d.e+-]+)\s+black_end:([\d.e+-]+)\s+black_duration:([\d.e+-]+)/gu)].map(m=>({startSeconds:Number(m[1]),endSeconds:Number(m[2]),durationSeconds:Number(m[3])}));
const silenceWindows=[];let openSilence=null;
for(const line of decode.stderr.split('\n')){
  const start=line.match(/silence_start:\s*([\d.e+-]+)/u),end=line.match(/silence_end:\s*([\d.e+-]+)\s*\|\s*silence_duration:\s*([\d.e+-]+)/u);
  if(start)openSilence=Number(start[1]);
  if(end){const endSeconds=Number(end[1]),durationSeconds=Number(end[2]);silenceWindows.push({startSeconds:openSilence??endSeconds-durationSeconds,endSeconds,durationSeconds});openSilence=null;}
}
if(openSilence!=null)silenceWindows.push({startSeconds:openSilence,endSeconds:audioDuration,durationSeconds:audioDuration-openSilence,endsAtAudioEnd:true});
if(blackWindows.length)reviewFlags.push('检测到至少0.20秒近全黑画面，需要判断是否为不期望的空窗');
if(silenceWindows.length)reviewFlags.push('检测到至少2秒低于-50dB的音频窗口，需要逐窗复核是否为原片本来存在的停顿');

// AAC是有损编码，不能要求样本差分为0。用多窗互相关检查相对r3 PCM是否新增时移。
const correlationRate=8000;
const pcm=file=>{
  const r=run('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-ar',String(correlationRate),'-ac','1','-c:a','pcm_f32le','-f','f32le','pipe:1'],{encoding:null,maxBuffer:80e6});
  return new Float32Array(r.stdout.buffer,r.stdout.byteOffset,r.stdout.byteLength/4);
};
const exportedPcm=pcm(video),referencePcm=pcm(reference),commonDuration=Math.min(exportedPcm.length,referencePcm.length)/correlationRate;
const windows=[{name:'开头及钩子',start:0.10,end:16},{name:'AI情景附近',start:66,end:80},{name:'报道与计划附近',start:193,end:207},{name:'后段预约断点',start:325,end:341},{name:'收尾与最后一句',start:394,end:Math.min(409.35,commonDuration)}];
function correlationWindow(window){
  const first=Math.ceil(window.start*correlationRate),last=Math.min(referencePcm.length,Math.floor(window.end*correlationRate));
  const maxLag=512,stride=8;let best={lagSamples:0,coefficient:-1};
  const coefficient=(lag,step)=>{
    let xx=0,yy=0,xy=0,n=0;
    for(let i=first;i<last;i+=step){const j=i+lag;if(j<0||j>=exportedPcm.length)continue;const x=referencePcm[i],y=exportedPcm[j];xx+=x*x;yy+=y*y;xy+=x*y;n++;}
    return {value:xx>1e-12&&yy>1e-12?xy/Math.sqrt(xx*yy):null,sampleCount:n,referenceRms:Math.sqrt(xx/Math.max(1,n))};
  };
  for(let lag=-maxLag;lag<=maxLag;lag++){
    const c=coefficient(lag,stride);if(c.value!=null&&c.value>best.coefficient)best={lagSamples:lag,coefficient:c.value};
  }
  const full=coefficient(best.lagSamples,1),zero=coefficient(0,1);
  return {name:window.name,startSeconds:window.start,endSeconds:window.end,bestLagSamples:best.lagSamples,bestLagMilliseconds:best.lagSamples/correlationRate*1000,correlationCoefficient:full.value,zeroLagCorrelationCoefficient:zero.value,samplesCompared:full.sampleCount,referenceRms:full.referenceRms,nearZeroOffset:Math.abs(best.lagSamples)<=2,signalAgreement:full.value!=null&&full.value>=.97};
}
const alignment=windows.map(correlationWindow);
if(alignment.some(w=>!w.nearZeroOffset))hardErrors.push('AAC相对r3 PCM存在超过0.25毫秒的最佳相关时移，需要复核编码首帧/裁切或时间轴');
if(alignment.some(w=>!w.signalAgreement))hardErrors.push('至少一个代表窗的AAC与r3 PCM相关系数低于0.97，需要复核混音版本或非预期改动');
if(commonDuration<409.35)hardErrors.push('成片或r3 PCM没有覆盖到本期完整收尾');
if(digest(jobPath)!==jobSha256||digest(video)!==videoBinding.sha256||digest(reference)!==referenceBinding.sha256)throw new Error('检查期间 job、成片或参考混音发生变化，不登记本次技术检查结果');
const result={
  schemaVersion:'koubo-complete-video-readonly-qa/v1',
  status:hardErrors.length?'技术检查未通过':reviewFlags.length?'技术规格与解码通过，存在画面或静音窗口待复核':'技术检查通过，等待用户完整观看',
  inputs:{video:videoBinding,referencePcm:referenceBinding},
  controlledJob:{path:jobPath,jobSha256,jobId:job.jobId,revisionId:job.revisionId,bindingCount:bindingChecks.length,allInputBindingsVerified:true,bindings:bindingChecks},
  knowledgeContextGate:{requestedCommand,requestedCommandRegistered:requestedProof.required===true,actualValidationCommand:contextProof.command,proof:contextProof,scope:'只证明本期知识上下文与受控输入现行哈希通过复检，不代表正式V2生产门或用户视听验收'},
  checkedAt:new Date().toISOString(),
  specification:{width:vs.width,height:vs.height,fps,videoCodec:vs.codec_name,audioCodec:as.codec_name,sampleRate:Number(as.sample_rate),channels:as.channels},
  timing:{videoStartSeconds:videoStart,audioStartSeconds:audioStart,startDifferenceSeconds:Math.abs(videoStart-audioStart),videoDurationSeconds:videoDuration,audioDurationSeconds:audioDuration,endDifferenceSeconds:Math.abs(videoStart+videoDuration-audioStart-audioDuration),audioVideoDurationDifferenceSeconds:Math.abs(videoDuration-audioDuration),containerDurationSeconds:Number(vp.format.duration),referenceDurationSeconds:referenceDuration,decodedAudioDurationSeconds:exportedPcm.length/correlationRate,decodedReferenceDurationSeconds:referencePcm.length/correlationRate},
  fullDecode:{completed:true,exitCode:0,ffmpegArgs:decodeArgs},
  blackFrameScan:{minimumSeconds:.20,blackPixelThreshold:.10,blackPictureRatio:.98,windows:blackWindows},
  longSilenceScan:{noiseThresholdDb:-50,minimumSeconds:2,windows:silenceWindows},
  aacAlignment:{method:'FFmpeg解码后同为8kHz单声道；5个代表窗，先稀疏搜索±64ms再全样本复核；AAC有损，相关不要求样本相等',lagConvention:'正数表示导出AAC的同一波形出现得更晚',allowedQuantizationDifferenceSamples:2,allowedQuantizationDifferenceMilliseconds:.25,windows:alignment,scope:'只证明导出音轨相对r3 PCM未出现新增时移；不证明原片本身的口型同步或语义入点已经人工观看'},
  hardErrors,reviewFlags,
  formalProductionV2Passed:false,formalReleaseVerified:false,humanListeningPerformed:false,fullHumanViewingPerformed:false,userAudibilityConfirmed:false,publicationApproved:false,
  acceptanceBoundary:'本报告是技术证据，不替代用户正常速度完整观看、音效听感、字幕逐字确认、实际声画与内容质量验收。',
};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(`${out}/完整成片_解码与扫描日志.r1.txt`,decode.stderr);
const fmt=x=>Number(x).toFixed(3),details=alignment.map(w=>`- ${w.name}：${fmt(w.startSeconds)}–${fmt(w.endSeconds)}秒，最佳位移${fmt(w.bestLagMilliseconds)}毫秒，相关系数${w.correlationCoefficient?.toFixed(6)??'无信号'}`).join('\n');
fs.writeFileSync(report,`# 本期完整成片技术质检\n\n状态：${result.status}。\n\n检查对象：${path.resolve(video)}\n\n- 规格：${vs.width}×${vs.height}，${fps}帧，${vs.codec_name} / ${as.codec_name}，${as.sample_rate}Hz，${as.channels}声道。\n- 全片解码：已完整执行，退出码0。\n- 声画时长差：${fmt(Math.abs(videoDuration-audioDuration)*1000)}毫秒。\n- 黑画面：${blackWindows.length}段；长静音：${silenceWindows.length}段。\n\n## AAC与本期r3混音对齐\n\n${details}\n\n## 未通过项与待复核项\n\n${[...hardErrors,...reviewFlags].map(x=>`- ${x}`).join('\n')||'无机器技术失败或异常窗口。'}\n\n## 验收边界\n\n未进行完整人工观看或人耳试听。技术检查不能替代字幕内容、动画入点、口型、素材真实性、手机听感以及用户验收；没有公开发布授权。\n`);
console.log(JSON.stringify({状态:result.status,报告:output,规格:result.specification,黑画面:blackWindows.length,长静音:silenceWindows.length,AAC代表窗:alignment.map(w=>({名称:w.name,位移毫秒:w.bestLagMilliseconds,相关系数:w.correlationCoefficient})),技术失败:hardErrors,待复核:reviewFlags},null,2));
if(hardErrors.length)process.exit(1);
