import fs from 'node:fs';import {createHash} from 'node:crypto';
const dir='edit/20260919_ai_training_methods/07_预览与质检/录屏小样R1';
const read=n=>JSON.parse(fs.readFileSync(`${dir}/${n}`));const save=(n,v)=>fs.writeFileSync(`${dir}/${n}`,JSON.stringify(v,null,2)+'\n');
const request=read('request.json');request.revisionId='screen-local-preview-r3';
request.beats[1].frames.endFrameExclusive=219;request.beats[1].evidence.rect={x:10,y:110,width:1510,height:92};request.beats[2].frames.startFrame=219;
const captions=read('captions.json');for(const b of request.beats)b.quote=captions.filter(c=>c.startMs<b.frames.endFrameExclusive/30*1000&&c.endMs>b.frames.startFrame/30*1000).map(c=>c.zh).join('');
save('request-r3.json',request);
const intake=read('intake.json');const p='remotion/public/media/ai-training-screen-r1/question-v4.mp4';intake.derived[1]={path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')};
intake.questionCrop={sourceStart:13.5,duration:2.5,x:726,y:526,width:1000,height:54,reason:'独立审查确认13.5秒后静稳，仅保留完整问题3标题；旧裁切保留但不消费，不冻结或循环'};save('intake.json',intake);
