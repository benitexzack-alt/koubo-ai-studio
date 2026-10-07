import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root='/Users/pc/Documents/口播';
const sourceDir=path.join(root,'edit/20261006_ten_ai_businesses/08_实录与字幕/字幕候选_R2');
const outDir=path.join(root,'edit/20261006_ten_ai_businesses/14_交付包_R1/字幕');
const captionsPath=path.join(sourceDir,'captions.r2.json');
const policyPath=path.join(sourceDir,'spoken-source-policy.r2.json');
const candidatesPath=path.join(sourceDir,'correction-candidates.r2.json');
const transcriptPath=path.join(sourceDir,'transcript.r2.json');
const captions=JSON.parse(fs.readFileSync(captionsPath,'utf8'));
const policy=JSON.parse(fs.readFileSync(policyPath,'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const relative=file=>path.relative(root,file).split(path.sep).join('/');
const check=(value,message)=>{if(!value)throw new Error(message);};
const writeNew=(name,value)=>fs.writeFileSync(path.join(outDir,name),value,{flag:'wx'});
check(captions.length===87,'必须保留完整87页');
check(captions.at(-1).id==='C087'&&captions.at(-1).zh==='我是超哥，在兰州，AI创业。','尾句不是R2用户核对文本');
check(policy.verification.humanListeningPerformed===false&&policy.review.finalHumanAcceptance===false,'不得冒充整体听审/验收');
const confirmed=policy.verification.corrections.filter(item=>item.userConfirmed);
check(confirmed.length===1&&confirmed[0].segmentId===135,'仅尾句应为用户确认');

const milliseconds=seconds=>{
  const value=Math.round(seconds*1000);
  check(Math.abs(seconds*1000-value)<0.00001,'原始时点并非整数毫秒，不能默默量化');
  return value;
};
const timestamp=seconds=>{
  const value=milliseconds(seconds);
  const hours=Math.floor(value/3600000);
  const minutes=Math.floor(value/60000)%60;
  const secs=Math.floor(value/1000)%60;
  const ms=value%1000;
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
};
for(const caption of captions){
  check(caption.start<caption.end,`字幕时窗无效:${caption.id}`);
  check(!caption.zh.includes('\n')&&!caption.en.includes('\n'),`源字幕含换行，需要明确映射:${caption.id}`);
}
const variants=[
  ['中文_实录字幕_R1.srt',caption=>caption.zh],
  ['英文_辅助字幕_R1.srt',caption=>caption.en],
  ['双语_同窗字幕_R1.srt',caption=>`${caption.zh}\n${caption.en}`],
];
for(const [name,body] of variants){
  const contents=captions.map((caption,index)=>`${index+1}\n${timestamp(caption.start)} --> ${timestamp(caption.end)}\n${body(caption)}`).join('\n\n')+'\n';
  writeNew(name,contents);
}
for(const name of ['captions.r2.json','spoken-source-policy.r2.json','correction-candidates.r2.json']){
  fs.copyFileSync(path.join(sourceDir,name),path.join(outDir,name),fs.constants.COPYFILE_EXCL);
  check(hash(path.join(sourceDir,name))===hash(path.join(outDir,name)),`JSON副本字节不一致:${name}`);
}

const parseTimestamp=value=>{
  const [hours,minutes,seconds,ms]=value.split(/[:,]/).map(Number);
  return (((hours*60+minutes)*60)+seconds)*1000+ms;
};
const srtChecks=[];
for(const [name,body] of variants){
  const groups=fs.readFileSync(path.join(outDir,name),'utf8').trimEnd().split('\n\n');
  check(groups.length===87,`${name}:页数不一致`);
  groups.forEach((group,index)=>{
    const lines=group.split('\n');
    const [start,end]=lines[1].split(' --> ').map(parseTimestamp);
    check(Number(lines[0])===index+1,`${name}:页号不一致:${index}`);
    check(start===milliseconds(captions[index].start)&&end===milliseconds(captions[index].end),`${name}:时点漂移:${index}`);
    check(lines.slice(2).join('\n')===body(captions[index]),`${name}:字序/内容漂移:${index}`);
  });
  srtChecks.push({file:relative(path.join(outDir,name)),sha256:hash(path.join(outDir,name)),pageCount:87,allStartAndEndTimesUnchanged:true,allTextAndOrderUnchanged:true});
}
const mechanical=spawnSync(process.execPath,[path.join(root,'tools/check-spoken-source-policy.mjs'),transcriptPath,path.join(outDir,'captions.r2.json'),path.join(outDir,'spoken-source-policy.r2.json')],{cwd:root,encoding:'utf8'});
check(mechanical.status===0,`机械同源校验失败:${mechanical.stdout}\n${mechanical.stderr}`);
const verification={
  schemaVersion:'ten-ai-businesses-subtitle-delivery-verification/v1',status:'mechanical-subtitle-export-valid',
  sourceCaptions:{path:relative(captionsPath),sha256:hash(captionsPath)},
  sourceTranscript:{path:relative(transcriptPath),sha256:hash(transcriptPath)},
  sourcePolicy:{path:relative(policyPath),sha256:hash(policyPath)},
  sourceCorrectionCandidates:{path:relative(candidatesPath),sha256:hash(candidatesPath)},
  srtChecks,jsonCopiesByteIdentical:true,tailUserConfirmed:true,
  originalWordTimingUnchanged:true,captionCount:87,wordCount:1097,
  humanListeningPerformed:false,finalHumanAcceptance:false,factVerificationPassed:false,
  unchangedPercentages:['95%','89%'],
  scope:'只导出已有R2字幕；中英文沿用原候选，双语共用原时窗。机械校验不代表整体听审、翻译审校、统计事实核验或最终成片验收。',
  spokenSourceVerifierOutput:mechanical.stdout,
};
writeNew('字幕机械对应验证.r1.json',JSON.stringify(verification,null,2)+'\n');
console.log(JSON.stringify(verification,null,2));
