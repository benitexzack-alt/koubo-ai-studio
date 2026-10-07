import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root='/Users/pc/Documents/口播';
const out=path.join(root,'edit/20261006_ten_ai_businesses/13_成片质检/实际成片抽帧_R1');
const movie=path.join(root,'edit/20261006_ten_ai_businesses/08_正式成片/10个AI生意_V8_R1_1080P_完整候选.mp4');
const planPath=path.join(root,'edit/20261006_ten_ai_businesses/13_成片质检/风险帧计划.r1.json');
const check=(value,message)=>{if(!value)throw new Error(message);};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const relative=file=>path.relative(root,file).split(path.sep).join('/');
const run=(command,args)=>{
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  check(result.status===0,`${command}失败：${result.stderr}`);
  return result.stdout;
};
const writeNew=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});

check(process.argv.includes('--render-complete'),'等待主代理确认实际成片渲染成功。只有确认后才使用--render-complete运行，禁止读取正在输出的半文件。');
check(fs.existsSync(movie)&&fs.statSync(movie).isFile(),'实际成片尚不存在');
const beforeStat=fs.statSync(movie);
const movieSha=sha(movie);
const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
check(plan.riskFrames.length===35,'风险帧计划必须完整35项');
check(plan.separateOpeningAudit.from===132&&plan.separateOpeningAudit.toExclusive===294,'开场窗不符132至293');
const probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',movie]));
const video=probe.streams.find(stream=>stream.codec_type==='video');
check(video&&video.width===1920&&video.height===1080,'实际成片不是1920×1080');
const [fpsN,fpsD]=video.avg_frame_rate.split('/').map(Number);
check(fpsN/fpsD===30,'实际成片不是30fps');
check(Number(video.nb_frames)===8534,'成片元数据帧数不是8534，必须先复核渲染结果');
const openingFrames=Array.from({length:162},(_,index)=>132+index);
const indices=[...new Set([...openingFrames,...plan.riskFrames.map(item=>item.frame)])].sort((a,b)=>a-b);
check(indices.length===194,'开场和风险帧联合去重后应为194帧');
check(indices.every(index=>Number.isInteger(index)&&index>=0&&index<8534),'帧号越界');
const framesDir=path.join(out,'原尺寸PNG');
const projectionPath=path.join(out,'实际抽帧输入.r1.json');
const resumeContacts=process.argv.includes('--resume-contacts');
let frameRecords;
if(resumeContacts){
  check(fs.existsSync(projectionPath),'不存在已完成解码的输入记录，不能恢复联系表');
  const existing=JSON.parse(fs.readFileSync(projectionPath,'utf8'));
  check(existing.movie.sha256===movieSha&&existing.movie.sizeBytes===beforeStat.size,'待恢复记录不是当前完整成片');
  check(existing.riskPlan.sha256===sha(planPath),'风险帧计划发生变化');
  frameRecords=existing.uniqueFrames;
  check(frameRecords.length===194&&frameRecords.every((item,index)=>item.frame===indices[index]&&item.sha256===sha(path.join(root,item.path))),'已保存实际PNG不完整或哈希变化');
}else{
  check(!fs.existsSync(framesDir),'原尺寸PNG输出目录已存在；本脚本不覆盖已有质检证据');
  fs.mkdirSync(framesDir);
  const riskOnly=plan.riskFrames.map(item=>item.frame).filter(index=>index<132||index>=294);
  const select=`select=between(n\\,132\\,293)+${riskOnly.map(index=>`eq(n\\,${index})`).join('+')}`;

  // 单次实际MP4视频解码；没有读取旧遮罩/Pillow诊断图，也不修改源媒体。
  run('ffmpeg',['-v','error','-i',movie,'-map','0:v:0','-an','-vf',select,'-fps_mode','vfr','-compression_level','2','-start_number','0',path.join(framesDir,'selected_%06d.png')]);
  const selected=fs.readdirSync(framesDir).filter(name=>/^selected_\d{6}\.png$/.test(name)).sort();
  check(selected.length===indices.length,`实际解码选中${selected.length}帧，预期${indices.length}`);
  frameRecords=indices.map((frame,index)=>{
    const target=path.join(framesDir,`F${String(frame).padStart(6,'0')}.png`);
    fs.renameSync(path.join(framesDir,selected[index]),target);
    return {frame,timeSeconds:frame/30,path:relative(target),sha256:sha(target),width:1920,height:1080,zeroBasedFrame:true};
  });
}
const recordsByFrame=new Map(frameRecords.map(record=>[record.frame,record]));
const projection={
  movie:{path:relative(movie),sha256:movieSha,sizeBytes:beforeStat.size,video},
  riskPlan:{path:relative(planPath),sha256:sha(planPath)},
  opening:openingFrames.map(frame=>({...recordsByFrame.get(frame),localFrame:frame-132,knownRisk:plan.separateOpeningAudit.knownGlobalRiskFrames.includes(frame)})),
  risk:plan.riskFrames.map(item=>({...item,...recordsByFrame.get(item.frame)})),
  uniqueFrames:frameRecords,
};
if(!resumeContacts)writeNew(projectionPath,projection);
const contacts=JSON.parse(run('python3',[path.join(out,'build-actual-contact.r1.py'),projectionPath,out,root]));
const afterStat=fs.statSync(movie);
check(afterStat.size===beforeStat.size&&afterStat.mtimeMs===beforeStat.mtimeMs&&sha(movie)===movieSha,'成片在抽帧过程中发生变化；不能认定为同一输出');
const currentFiles={
  runtime:path.join(root,'remotion/src/ten-ai-businesses-final-r1/runtime-plan.r1.json'),
  composition:path.join(root,'remotion/src/ten-ai-businesses-final-r1/Composition.tsx'),
};
const verification={
  schemaVersion:'ten-ai-businesses-actual-movie-frame-extraction/v1',
  status:'actual-movie-frames-extracted',sourceMovie:projection.movie,riskPlan:projection.riskPlan,
  frameConvention:'30fps、零起算帧号；每帧时间为frame/30秒',
  decoding:{source:'actual-complete-rendered-mp4',ffmpegVideoDecodeCount:1,oldDiagnosticImagesUsed:false,allSourcePixelsPreservedInOriginalPng:true,contactsResumedWithoutVideoRedecode:resumeContacts},
  currentSourceSnapshots:Object.fromEntries(Object.entries(currentFiles).map(([key,file])=>[key,{path:relative(file),sha256:sha(file)}])),
  uniquePngCount:frameRecords.length,riskFrameCount:35,openingFrameCount:162,openingGlobalStart:132,openingGlobalEndInclusive:293,
  openingAll162Retained:projection.opening.length===162&&projection.opening.every((item,index)=>item.frame===132+index),
  sourceMovieUnchangedDuringExtraction:true,frameRecords,riskFrames:projection.risk,openingFrames:projection.opening,contacts,
  acceptance:{renderedFramesHumanReviewed:false,normalSpeedPlaybackReviewed:false,humanListeningPerformed:false,userAcceptance:false},
  scope:'只证明实际成片选定画面已解码保存和同源绑定；联系表是这些实际帧的缩略排版，不是原尺寸图，不代表逐帧视觉、正常速度声画或最终人审通过。',
};
writeNew(path.join(out,'实际成片抽帧回执.r1.json'),verification);
console.log(JSON.stringify({status:verification.status,movieSha256:movieSha,uniquePngCount:194,riskFrameCount:35,openingFrameCount:162,contactCount:contacts.length,frameStart:132,frameEndInclusive:293,humanListeningPerformed:false,userAcceptance:false},null,2));
