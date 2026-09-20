import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),base='edit/20260919_ai_training_methods';
const code='remotion/src/ai-training-final-r1',pub='remotion/public-ai-training-final-r1';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const ff=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-nostats','-n',...args],{encoding:'utf8',maxBuffer:20e6});if(r.status!==0)throw Error(r.stderr);return r.stderr;};
const copy=(src,dst)=>{fs.mkdirSync(path.dirname(dst),{recursive:true});if(fs.existsSync(dst)){if(hash(src)!==hash(dst))throw Error(`已有不同文件:${dst}`);}else fs.copyFileSync(src,dst);};
const F=t=>Math.round(t*30);
const layer=(id,start,end,title,items=[],itemTimes=[],detail='',detailTime=start,component='direct',label='')=>({id,start,end,title,detail,items,params:{component,label,itemFrames:itemTimes.map(t=>F(t)-F(start)),detailFrame:F(detailTime)-F(start)}});
const layers=[
 layer('hook',.12,5.06,'最扎心的真相',[],[],'没人会毫不保留地教你',2.44),
 layer('workplace',5.06,11.08,'教你三分',[],[],'留你七分',7.25),
 layer('industry',11.08,15.36,'核心干货',[],[],'套路永远比真话多',13.78),
 layer('selective',17.74,24.38,'选择性教学',['皮毛','底层'],[21.36,22.92]),
 layer('ai-exception',26.76,37.16,'唯独AI例外',['毫不保留','无限次数','不带私心'],[31.66,32.5,33.7],'不收情绪',34.72),
 layer('eight-methods',37.9,44.48,'八大AI训练方法'),
 layer('chapter-one',47.62,50.66,'真实错误模拟器',[],[],'',47.62,'direct','第一'),
 layer('scenario',53.1,60.04,'业务问题',['实战场景','故意设置陷阱'],[55.86,58.22],'',53.1,'process'),
 layer('guided',64,69.34,'AI不直接纠正',[],[],'引导你自己找漏洞',65.96),
 layer('judgement',76.96,80.32,'不是背答案',[],[],'是练判断力',78.3),
 layer('chapter-two',80.98,84.66,'困惑破解者',[],[],'',80.98,'direct','第二'),
 layer('analogy',86.62,92.26,'生活类比',[],[],'核心的钥匙句',89.25),
 layer('understanding',98.92,102.78,'避免似懂非懂',[],[],'看懂了，但不会落地',100.6),
 layer('chapter-three',103.26,105.42,'定制学习路径',[],[],'',103.26,'direct','第三'),
 layer('inputs',105.42,110.08,'给AI输入',['目标','现有基础','每周可投入的时间'],[105.7,107.36,108.3],'',105.42,'process'),
 layer('adjust',118.74,124.58,'一旦跟不上',[],[],'立即动态调整计划',119.66),
 layer('chapter-four',124.58,126.02,'隐藏漏洞检测器',[],[],'',124.58,'direct','第四'),
 layer('blind-spots',136.94,147.28,'看着会',['一上手就废','知识短板'],[137.74,143.27],'浅尝辄止',146.04),
 layer('chapter-five',148.3,150.8666666667,'严苛进度镜像',[],[],'',148.3,'direct','第五'),
 layer('compare-work',161.58,163.74,'对比前后产出',['反复犯同一个老错误'],[161.62],'',161.58,'process'),
 layer('measurable-progress',165.98,170.22,'只夸奖可以量化的进步',[],[],'不做虚假鼓励',168.7466666667),
 layer('chapter-six',170.22,173.28,'最坏情景教练',[],[],'',170.22,'direct','第六'),
 layer('pressure',173.28,178.06,'高压突发场景',[],[],'不给任何参考资料',175.4),
 layer('review-risk',184.64,192.02,'复盘薄弱环节',[],[],'提前演练风险',190.18),
 layer('chapter-seven',192.02,196.12,'思维捷径检查员',[],[],'',192.02,'direct','第七'),
 layer('thinking',199.38,202.54,'回溯思考全过程'),
 layer('shortcuts',202.54,207.7,'靠猜',['靠模板','死记硬背'],[204.82,205.72]),
 layer('mastery',214.28,217.1,'真正掌握',[],[],'杜绝碰运气',215.46),
 layer('chapter-eight',217.1,220.38,'反向教学模拟器',[],[],'',217.1,'direct','第八'),
 layer('reverse-teaching',221.3,225.58,'AI当小白学生',[],[],'你来当老师',223.12),
 layer('ask-explain',225.58,231.9,'一说专业术语',['AI立刻追问','要案例','要通俗解释'],[228.2,229.68,230.5],'',225.58,'process'),
 layer('deduction',233.88,244.68,'顺着你的错误推导',['荒谬结果','理解的误区','把事情讲明白'],[237.02,239.36,242.16],'',233.88,'process'),
 layer('ultimate',245.76,253.74,'终极大招',[],[],'不会只用单一的一个AI工具',250.18),
 layer('collaboration',255.52,259.12,'多AI分工协作'),
 layer('roles',259.12,269.68,'分工协作',['1号AI：错误模拟器','2号AI：漏洞检测器'],[259.12,264.94],'',259.12,'process'),
 layer('refine',278.54,282.68,'层层打磨',[],[],'筛选出来最优答案',279.86),
 layer('discipline',283.82,292.38,'最高级的自律',['学不会','学不透','学不全'],[287.9,289.2,290.28],'',283.82,'direct'),
 layer('strength',292.38,296.16,'安身立命的硬实力'),
 layer('prompts',300.02,302.28,'完整提示词',[],[],'评论区置顶',300.96),
];
const insertions=[
 ['P01',69.34,76.6],['P02',92.26,98.8266666667],['P03',110.08,117.3466666667],
 ['P04',126.02,132.8],['P05',155,161.58],['G01',178.06,184.64],
 ['P06',207.7,214.28],['P07',269.68,277.68],
].map(([id,start,end])=>({id,startFrame:F(start),endFrameExclusive:F(end),src:`media/${id}.mp4`,sourceStartSeconds:0,route:id==='G01'?'ai-generated-video':'paper-editorial',audio:'muted'}));
const screens=[{id:'screen-question',kind:'question',startFrame:3990,endFrameExclusive:4065},{id:'screen-archive',kind:'archive',startFrame:4526,endFrameExclusive:4650}];
const motionEvents=[];
for(const l of layers){
 motionEvents.push({id:`${l.id}:enter`,frame:F(l.start),kind:l.params.label?'chapter':l.id==='hook'?'hook':'card',text:l.title});
 l.items.forEach((text,i)=>{const frame=F(l.start)+l.params.itemFrames[i];if(frame>F(l.start)+5)motionEvents.push({id:`${l.id}:item:${i}`,frame,kind:'node',text});});
 if(l.detail&&l.params.detailFrame>5)motionEvents.push({id:`${l.id}:detail`,frame:F(l.start)+l.params.detailFrame,kind:'emphasis',text:l.detail});
}
for(const c of [...insertions,...screens])motionEvents.push({id:`${c.id}:enter`,frame:c.startFrame,kind:'media',text:c.id});
motionEvents.push({id:'screen-question:scan-lock',frame:4038,kind:'evidence',text:'深挖底层的问题'});
motionEvents.sort((a,b)=>a.frame-b.frame);
const manifest=JSON.parse(fs.readFileSync('assets/sfx/koubo-sfx-v8/manifest.json'));
const pools={
 hook:['waic-thesis-impact'],
 chapter:['v3-chapter-sweep-a','v2-section-sweep','waic-section-whoosh','v1-section-air'],
 card:['v3-soft-card-pop-b','v1-card-reveal','waic-card-pop','v3-soft-card-pop-a','v2-card-slide'],
 node:['v3-list-tick-a','v1-node-connect','v3-list-tick-b','v2-keyword-select','v1-keyword-tick','waic-node-connect','v2-node-select','v3-line-connect-a','v1-ui-click','v2-ui-click','remotion-ui-switch'],
 emphasis:['v3-number-settle-a','v1-confirm-soft','v2-number-affirmation','v3-cta-confirm-a','v2-evidence-shutter','v1-camera-shutter'],
 media:['v3-media-whoosh-a','v3-evidence-paper-a','v2-zoom-out','v3-media-whoosh-b','remotion-whoosh','remotion-page-turn'],
 evidence:['v3-list-tick-b','v2-evidence-shutter','v1-keyword-tick'],
};
const usage=new Map(),last=new Map();let previous='';
const sfxCues=motionEvents.map(e=>{
 const suitable=id=>{const item=manifest.items.find(x=>x.id===id);return item&&item.outputSha256!==previous&&(usage.get(item.outputSha256)||0)<3&&e.frame-(last.get(item.outputSha256)??-1e6)>=750;};
 const id=pools[e.kind].find(suitable)??[...new Set(Object.values(pools).flat())].find(suitable);
 if(!id)throw Error(`没有可用轮换音效:${e.id}`);
 const item=manifest.items.find(x=>x.id===id);usage.set(item.outputSha256,(usage.get(item.outputSha256)||0)+1);last.set(item.outputSha256,e.frame);previous=item.outputSha256;
 if(hash(item.output)!==item.outputSha256)throw Error(`音效来源变化:${id}`);
 return {eventId:e.id,frame:e.frame,file:`audio/sfx/${id}.wav`,source:item.output,sha256:item.outputSha256,volume:e.kind==='hook'?.5:e.kind==='node'?.34:e.kind==='chapter'?.46:.42,durationSeconds:item.durationSeconds};
});
for(const l of layers)for(const c of [...insertions,...screens])if(F(l.start)<c.endFrameExclusive&&F(l.end)>c.startFrame)throw Error(`叠层与主素材冲突:${l.id}/${c.id}`);
const plan={schema:'ai-training-final-runtime/v1',fps:30,durationInFrames:9155,width:1920,height:1080,sourceVideo:'media/host.mp4',captionsSrc:'captions.json',mix:'audio/final-mix.wav',semanticScale:1.15,layers,insertions,screens,motionEvents,sfxCues,originalVoice:{continuous:true,startFrame:0,endFrameExclusive:9155,speed:1,deletedRanges:[]},userRequestedEveryMotionHasSfx:true,ordinarySubtitleSfx:false,finalWatchConfirmed:false};
json(`${code}/runtime-plan.r1.json`,plan);
json(`${base}/06_剪辑工程/动效音效逐项对应.r1.json`,{motionCount:motionEvents.length,sfxCount:sfxCues.length,missing:[],events:motionEvents.map(e=>({...e,cue:sfxCues.find(s=>s.eventId===e.id)})),note:'每个语义入场、延时子节点、重点说明和媒体切换均有对应音效；同帧一起出现的文字共用主音效；字幕及持续运镜不逐帧配声。'});
fs.mkdirSync(`${code}/vendor`,{recursive:true});
const presenter='skills/koubo-remotion-director/assets/remotion-presenter-media/PresenterMediaStage.tsx';
fs.writeFileSync(`${code}/vendor/PresenterMediaStage.tsx`,fs.readFileSync(presenter,'utf8').replace('../../references/platform-safe-areas.v1.json','./platform-safe-areas.v1.json'));
copy('skills/koubo-remotion-director/references/platform-safe-areas.v1.json',`${code}/vendor/platform-safe-areas.v1.json`);
copy('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',`${code}/vendor/ShotcraftEffects.tsx`);
copy('skills/koubo-shotcraft-library/upstream/LICENSE',`${code}/vendor/LICENSE`);
json(`${code}/vendor/provenance.json`,{presenter:{source:presenter,sha256:hash(presenter),modification:'仅相对导入位置调整'},shotcraft:{source:'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',sha256:hash('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx'),modification:'无'}});
for(const d of ['media','audio','audio/sfx','fonts'])fs.mkdirSync(`${pub}/${d}`,{recursive:true});
copy('remotion/public/fonts/STHeiti-Medium.ttc',`${pub}/fonts/STHeiti-Medium.ttc`);
for(const name of ['question-v4.mp4','archive.mp4'])copy(`remotion/public/media/ai-training-screen-r2/${name}`,`${pub}/media/${name}`);
for(const cue of sfxCues)copy(cue.source,`${pub}/${cue.file}`);
const source=`${base}/01_素材投放区/01_口播原片/copy_8757A6D8-5512-41B6-AE11-BA9F629D6616.MOV`;
if(process.argv.includes('--media')){
 if(!fs.existsSync(`${pub}/media/host.mp4`))ff(['-i',source,'-map','0:v:0','-an','-vf','fps=30,setsar=1','-c:v','h264_videotoolbox','-b:v','24M','-pix_fmt','yuv420p','-movflags','+faststart',`${pub}/media/host.mp4`]);
 if(!fs.existsSync(`${pub}/audio/original.wav`))ff(['-i',source,'-map','0:a:0','-vn','-ar','48000','-ac','2','-c:a','pcm_s24le',`${pub}/audio/original.wav`]);
 const names={P01:'视频_3.mp4',P02:'视频_6.mp4',P03:'视频_2.mp4',P04:'视频_4.mp4',P05:'视频_5.mp4',P06:'视频.mp4',P07:'视频_7.mp4',G01:'视频 (17).mp4'};
 for(const [id,name]of Object.entries(names))copy(`${base}/01_素材投放区/${id==='G01'?'03_AI情景视频':'04_纸艺视频'}/${name}`,`${pub}/media/${id}.mp4`);
}
if(process.argv.includes('--audio')){
 const voice=`${pub}/audio/voice-normalized.wav`;
 if(!fs.existsSync(voice)){
  const log=ff(['-i',`${pub}/audio/original.wav`,'-af','loudnorm=I=-17:TP=-2:LRA=11:print_format=json','-f','null','-']);
  const m=JSON.parse(log.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);json(`${base}/07_预览与质检/全片声音R1/原声响度.json`,m);
  ff(['-i',`${pub}/audio/original.wav`,'-af',`loudnorm=I=-17:TP=-2:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,'-ar','48000','-c:a','pcm_s24le',voice]);
 }
 const args=['-i',voice];for(const s of sfxCues)args.push('-i',`${pub}/${s.file}`);
 const filters=sfxCues.map((s,i)=>`[${i+1}:a]aresample=48000,volume=${s.volume},adelay=${s.frame*1600}S:all=1[s${i}]`);
 filters.push(`[0:a]${sfxCues.map((_,i)=>`[s${i}]`).join('')}amix=inputs=${sfxCues.length+1}:normalize=0:duration=first,alimiter=limit=0.8414:level=false:latency=true[a]`);
 if(!fs.existsSync(`${pub}/audio/final-mix.wav`))ff([...args,'-filter_complex',filters.join(';'),'-map','[a]','-ar','48000','-c:a','pcm_s24le',`${pub}/audio/final-mix.wav`]);
}
console.log(JSON.stringify({status:'本期运行计划已准备',layers:layers.length,motionEvents:motionEvents.length,sfx:sfxCues.length,insertions:insertions.length}));
