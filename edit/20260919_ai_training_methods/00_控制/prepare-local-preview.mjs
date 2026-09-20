import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),base='edit/20260919_ai_training_methods';
const dir=`${base}/07_预览与质检/录屏小样R1`,pub='remotion/public/media/ai-training-screen-r1';
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(pub,{recursive:true});
const run=(exe,args)=>{const r=spawnSync(exe,args,{stdio:'inherit'});if(r.status!==0)throw Error(`${exe}:${r.status}`);};
const binding=p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
const write=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n',{flag:'wx'});
const sources={host:`${base}/01_素材投放区/01_口播原片/copy_8757A6D8-5512-41B6-AE11-BA9F629D6616.MOV`,question:`${base}/01_素材投放区/02_用户录屏与演示/录屏2026-09-19 22.41.37.mov`,archive:`${base}/01_素材投放区/02_用户录屏与演示/录屏2026-09-19 22.38.45.mov`};
const ff=(src,start,duration,filter,out,audio=false)=>run('ffmpeg',['-hide_banner','-loglevel','error','-n','-ss',String(start),'-i',src,'-t',String(duration),'-vf',filter,'-r','30','-c:v','libx264','-preset','fast','-crf','18',...(audio?['-c:a','aac','-b:a','192k']:['-an']),'-movflags','+faststart',out]);
ff(sources.host,128.2,42.3,'scale=1920:1080',`${pub}/host.mp4`,true);
ff(sources.question,13.25,6,'crop=1470:150:750:770,scale=1510:-2,pad=1920:1080:360:340:color=0x101619',`${pub}/question.mp4`);
ff(sources.archive,27,4.133333,'crop=1160:570:600:235,scale=1300:-2,pad=1920:1080:440:140:color=0x101619',`${pub}/archive.mp4`);
run('ffmpeg',['-hide_banner','-loglevel','error','-n','-ss','128.2','-i',sources.host,'-t','42.3','-vn','-ar','48000','-c:a','pcm_s24le',`${pub}/voice.wav`]);
const raw=JSON.parse(fs.readFileSync(`${base}/05_实录与字幕/turbo.actual.raw.json`));
const en=['When you feel you have learned a skill,','give it to AI.','AI asks five probing questions','targeting blind spots where','you seem to know it, but cannot apply it.','If your answer stays on the surface,','it points out gaps in your knowledge','and where you have only scratched the surface.','Fifth:','a strict','progress mirror.','Archive every assignment and plan.','AI','compares your earlier and later work,','distinguishing real improvement','from repeating the same old mistake.','If you stop moving forward,','it points that out.','It only praises measurable progress,','without false encouragement.'];
const segments=raw.segments.filter(s=>s.start>=128.2&&s.start<170.22);
if(segments.length!==en.length)throw Error(`字幕数量变动:${segments.length}`);
const captions=segments.map((s,i)=>({startMs:Math.max(0,Math.round((s.start-128.2)*1000)),endMs:Math.round((s.end-128.2)*1000),zh:s.text.replace('浅长遮止','浅尝辄止'),en:en[i]}));
write(`${dir}/captions.json`,captions);
write(`${dir}/authorization.json`,{authority:'user-explicit-current-conversation',userQuote:'同意继续',approvedScope:'本期约40秒两段真实录屏独立动效验证；不改导演Skill、共享V8、旧期授权或正式开关',createdAt:new Date().toISOString(),formalEnabled:false,publishAuthorized:false,userPreviewApproved:false});
write(`${dir}/intake.json`,{sources:Object.fromEntries(Object.entries(sources).map(([k,p])=>[k,binding(p)])),sourceRangeSeconds:[128.2,170.5],durationFrames:1269,fps:30,derived:[`${pub}/host.mp4`,`${pub}/question.mp4`,`${pub}/archive.mp4`,`${pub}/voice.wav`].map(binding),captionCorrections:[{from:'浅长遮止',to:'浅尝辄止',basis:'两份离线ASR同音错词和固定词语校正；未按文稿补写；待用户听审'}],humanListeningPerformed:false});
const prior=JSON.parse(fs.readFileSync(`${base}/07_预览与质检/录屏动效验证/r2/自动匹配请求.v1.json`));
const quote=(s,e)=>captions.filter(c=>c.startMs<e/30*1000&&c.endMs>s/30*1000).map(c=>c.zh).join('');
const protectedRegions=[{x:64,y:600,width:278,height:278},{x:0,y:900,width:1920,height:180}];
const beats=[
 {beatId:'speaker-opening',mainVisual:'speaker',frames:{startFrame:0,endFrameExclusive:144},purpose:'完整保留实录表演，不增加重复解释',semanticIntents:[],existingVisualSufficiency:'high',materialClass:'talking-head'},
 {...prior.beats[0],frames:{startFrame:144,endFrameExclusive:324},region:{x:350,y:230,width:1540,height:360},evidence:{asset:binding(sources.question),rect:{x:10,y:112,width:1510,height:60},claimBoundary:'只显示实际反问中的核验问题，不证明技能提升；不冒充反向教学'},protectedRegions},
 {beatId:'speaker-gap',mainVisual:'speaker',frames:{startFrame:324,endFrameExclusive:680},purpose:'完整保留实录表演，不增加重复解释',semanticIntents:[],existingVisualSufficiency:'high',materialClass:'talking-head'},
 {...prior.beats[1],frames:{startFrame:680,endFrameExclusive:804},protectedRegions},
 {beatId:'speaker-ending',mainVisual:'speaker',frames:{startFrame:804,endFrameExclusive:1269},purpose:'完整保留实录表演，不增加重复解释',semanticIntents:[],existingVisualSufficiency:'high',materialClass:'talking-head'},
].map(b=>({...b,quote:quote(b.frames.startFrame,b.frames.endFrameExclusive),region:b.region??{x:60,y:120,width:400,height:160},protectedRegions:b.protectedRegions??[{x:530,y:0,width:1390,height:900},{x:0,y:900,width:1920,height:180}]}));
write(`${dir}/request.json`,{...prior,revisionId:'screen-local-preview-r1',canvas:{width:1920,height:1080,fps:30,durationInFrames:1269},captions:binding(`${dir}/captions.json`),beats});
console.log(dir);
