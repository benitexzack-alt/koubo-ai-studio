import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base='edit/20260919_ai_training_methods/07_预览与质检';
const old=`${base}/录屏小样R1`,dir=`${base}/录屏小样R2`;
const pub='remotion/public/media/ai-training-screen-r2';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(name,obj)=>fs.writeFileSync(`${dir}/${name}`,JSON.stringify(obj,null,2)+'\n',{flag:'wx'});
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(`${pub}/fonts`,{recursive:true});
for(const name of ['intake.json','selection-r3.json','match-receipt-r3.json','experience-lookup-r3.json','request-r3.json'])fs.copyFileSync(`${old}/${name}`,`${dir}/${name}`,fs.constants.COPYFILE_EXCL);
for(const name of ['host.mp4','question-v4.mp4','archive.mp4'])fs.copyFileSync(`remotion/public/media/ai-training-screen-r1/${name}`,`${pub}/${name}`,fs.constants.COPYFILE_EXCL);
fs.copyFileSync('remotion/public/fonts/STHeiti-Medium.ttc',`${pub}/fonts/STHeiti-Medium.ttc`,fs.constants.COPYFILE_EXCL);
const original=JSON.parse(fs.readFileSync(`${old}/captions.json`));
const captions=[];
for(let i=0;i<original.length;i++){
 const c={...original[i]};
 if(c.zh==='第五'){c.zh+=original[i+1].zh+original[i+2].zh;c.en='Fifth: a strict mirror of your progress.';c.endMs=original[i+2].endMs;i+=2;}
 else if(c.zh==='AI'){c.zh+=original[i+1].zh;c.en='AI compares your earlier and later work to distinguish';c.endMs=original[i+1].endMs;i++;}
 captions.push(c);
}
if(captions.map(c=>c.zh).join('')!==original.map(c=>c.zh).join(''))throw Error('实录字词被改写');
write('captions.json',captions);fs.copyFileSync(`${dir}/captions.json`,`${pub}/captions.json`,fs.constants.COPYFILE_EXCL);
write('authorization.json',{authority:'user-explicit-current-conversation',userQuote:'现在按照这个重新再出一个小样',approvedScope:'只改主讲语义动效、字幕、电子运镜；两段录屏动效及左下角真人小窗不变；沿用原声音效',formalEnabled:false,publishAuthorized:false,userPreviewApproved:false});
const oldCode=fs.readFileSync('remotion/src/ai-training-screen-r1/index.tsx','utf8'),newCode=fs.readFileSync('remotion/src/ai-training-screen-r2/index.tsx','utf8');
const screen=s=>s.slice(s.indexOf('const Screen:'),s.indexOf('\n};',s.indexOf('const Screen:'))+3);
if(screen(oldCode)!==screen(newCode))throw Error('已确认的录屏组件发生变更');
write('change-audit.json',{status:'candidate-not-human-accepted',scope:['语义动效','字幕样式和分页','语义电子运镜'],screenComponentUnchanged:true,screenFrames:[[144,219],[680,804]],sourceAudioUnchanged:true,subtitleChineseConcatenationUnchanged:true,captionChanges:['第五/严苛/进度镜像合并为同一页','AI与后续对比句合并，避免闪单词','透明V8字幕，去厚黑底，保留同窗中英字幕'],subtitleUncertainties:['原识别的停止不前、直接点名仍按实录候选保留，未用拍前稿静默替换；待用户听辨'],baseline:'2026-09-18 R2 v3',camera:{baseScale:1.012,peakScales:[1.065,1.075,1.07,1.08],peakX:[-12,14,-16,12],peakY:[2,3,2,3],transformOrigin:'53% 38%'},audioInputs:['有附加音效.mp4','无附加音效.mp4'].map(n=>({path:`${old}/${n}`,sha256:sha(`${old}/${n}`)}))});
console.log('R2局部输入已准备；录屏组件逐字一致，字幕字词序列一致。');
