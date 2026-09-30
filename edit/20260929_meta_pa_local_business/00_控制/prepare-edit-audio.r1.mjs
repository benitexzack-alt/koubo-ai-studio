import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const base='edit/20260929_meta_pa_local_business',pub='remotion/public/media/meta-pa-local-business-r1',out=`${base}/10_剪辑准备/声音`;
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(`${pub}/audio/sfx`,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p)),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
const ff=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-nostats','-n',...args],{encoding:'utf8',maxBuffer:20e6});if(r.status!==0)throw Error(r.stderr);return r.stderr;};
const voice=`${pub}/audio/voice-normalized.wav`;
if(!fs.existsSync(voice)){
 const log=ff(['-i',`${pub}/audio/original.wav`,'-af','loudnorm=I=-17.5:TP=-2:LRA=9:print_format=json','-f','null','-']);
 const m=JSON.parse(log.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);json(`${out}/原声响度与处理.r1.json`,{...m,policy:'完整原声连续保留，不删词、不改速、不换配音；仅响度均衡和安全限峰'});
 ff(['-i',`${pub}/audio/original.wav`,'-af',`loudnorm=I=-17.5:TP=-2:LRA=9:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,'-ar','48000','-c:a','pcm_s24le',voice]);
}
const anchor=read(`${base}/03_导演拆解/实录候选时间锚点.r1.json`),selected=read(`${base}/10_剪辑准备/动效/shotcraft-selection.r2.json`).beats.filter(b=>b.decision==='apply');
const selectedIds=new Set(selected.map(b=>b.beatId));
const events=read(`${base}/10_剪辑准备/动效/semantic-sound-events.r1.json`).events.filter(e=>!selectedIds.has(e.beatId));
for(const b of selected)for(const [i,item]of b.componentProps.items.entries())events.push({id:`shotcraft:${b.beatId}:${i}`,beatId:b.beatId,actionId:`${b.effectId}:${i}`,startSeconds:(b.frames.startFrame+item.atFrame)/30,role:i===0?'path-enter':'node-confirm',priority:i===0?'medium':'light',visualAction:'RemoShow逐项呈现：按说到的实际词进入',text:item.text});
// 资料对象的状态变更也算主动作；字幕与持续数字运镜不逐帧配声。
events.push({id:'finance:scope',startSeconds:35.22,role:'evidence-detail',priority:'medium',visualAction:'财报广告占比切至官方日活口径'});
events.push({id:'browser:confirm',startSeconds:61.64,role:'node-confirm',priority:'medium',visualAction:'浏览器演示切到用户确认'});
const inserts=anchor.beats.filter(b=>b.routeCueId&&['paper-editorial','ai-generated-video'].includes(b.primaryRoute));
for(const b of inserts)events.push({id:`media:${b.routeCueId}`,startSeconds:b.insertStartSeconds,role:'media-enter',priority:'light',visualAction:'说明素材切入；保留其原生动作声'});
events.sort((a,b)=>a.startSeconds-b.startSeconds);
const manifest=read('assets/sfx/koubo-sfx-v8/manifest.json');
const pools={
 hook:['waic-thesis-impact','v3-number-settle-a'],
 path:['v3-chapter-sweep-a','v2-section-sweep','waic-section-whoosh','v1-section-air','v3-soft-card-pop-b','v2-card-slide'],
 node:['v3-list-tick-a','v1-node-connect','v3-list-tick-b','v2-keyword-select','v1-keyword-tick','waic-node-connect','v2-node-select','v3-line-connect-a','v1-ui-click','v2-ui-click','remotion-ui-switch'],
 keyword:['v3-number-settle-a','v1-confirm-soft','v2-number-affirmation','v3-cta-confirm-a','v2-evidence-shutter','v1-camera-shutter','v3-soft-card-pop-a','v1-card-reveal','waic-card-pop'],
 media:['v3-media-whoosh-a','v2-zoom-out','v3-media-whoosh-b','remotion-whoosh','remotion-page-turn'],
};
const count=new Map(),last=new Map();let previous='';
const cues=events.map(e=>{
 const category=e.role==='hook-accent'?'hook':e.role.includes('path')?'path':e.role.includes('node')||e.role.includes('detail')||e.priority==='light'&&e.role.includes('question')?'node':e.role.includes('evidence')||e.role.includes('media')?'media':'keyword';
 const eligible=id=>{const x=manifest.items.find(m=>m.id===id);return x?.eligibleForSfx&&x.outputSha256!==previous&&(count.get(x.outputSha256)||0)<3&&e.startSeconds-(last.get(x.outputSha256)??-1e6)>=25;};
 const id=pools[category].find(eligible)??[...new Set(Object.values(pools).flat())].find(eligible);if(!id)throw Error(`音色轮换不足:${e.id}`);
 const item=manifest.items.find(m=>m.id===id);if(hash(item.output)!==item.outputSha256)throw Error(`音效哈希变化:${id}`);
 previous=item.outputSha256;count.set(previous,(count.get(previous)||0)+1);last.set(previous,e.startSeconds);
 const file=`audio/sfx/${id}.wav`;if(!fs.existsSync(`${pub}/${file}`))fs.copyFileSync(item.output,`${pub}/${file}`,fs.constants.COPYFILE_EXCL);
 return {...e,frame:Math.round(e.startSeconds*30),file,source:item.output,sha256:item.outputSha256,license:item.license,licenseReference:item.licenseReference,volume:category==='hook'?.58:e.priority==='light'?.28:category==='path'?.44:.40,durationSeconds:item.durationSeconds};
});
const gains={P01:.4,P02:.4,P03:.65,P04:.48,P05:1.1,P06:.75,P07:.95,G01:2.3};
const native=inserts.map(b=>({id:b.routeCueId,source:`${pub}/media/${b.routeCueId}.mp4`,sourceSha256:hash(`${pub}/media/${b.routeCueId}.mp4`),frame:Math.round(b.insertStartSeconds*30),duration:b.insertDurationSeconds,gain:gains[b.routeCueId],filter:'轻压缩瞬态、安全限峰；分别配平，原生动作声不统一静音'}));
const plan={schema:'meta-pa-edit-audio/v1',events:cues,native,originalVoice:{continuous:true,speed:1,deletedRanges:[],source:`${pub}/audio/original.wav`,normalized:voice},ordinarySubtitleSfx:false,userAudibilityConfirmed:false,knownListeningLimit:'正常速度人耳试听待用户；机器响度/事件差分检查不冒充听感通过'};
json(`${out}/逐动作音效与原生声音.r3.json`,plan);
const mix=(output,includeSfx)=>{
 if(fs.existsSync(output))return;
 const inputs=[...native,...includeSfx?cues:[]],args=['-i',voice],filters=[];
 for(const [i,x]of inputs.entries()){
  args.push('-i',x.source);const index=i+1;
  const fx=x.id?.startsWith('P')||x.id==='G01'?`atrim=duration=${x.duration},asetpts=PTS-STARTPTS,acompressor=threshold=0.125:ratio=3:attack=1:release=80,volume=${x.gain},alimiter=limit=0.2512:level=false:latency=true,afade=t=in:d=0.025,afade=t=out:st=${x.duration-.05}:d=0.05`:`volume=${x.volume}`;
  filters.push(`[${index}:a]aresample=48000,${fx},adelay=${x.frame*1600}S:all=1[a${i}]`);
 }
 filters.push(`[0:a]${inputs.map((_,i)=>`[a${i}]`).join('')}amix=inputs=${inputs.length+1}:normalize=0:duration=first,alimiter=limit=0.8222:level=false:latency=true[a]`);
 ff([...args,'-filter_complex',filters.join(';'),'-map','[a]','-ar','48000','-ac','2','-c:a','pcm_s24le',output]);
};
mix(`${pub}/audio/base-mix.wav`,false);mix(`${pub}/audio/final-mix.r3.wav`,true);
json(`${out}/混音回执.r3.json`,{planSha256:hash(`${out}/逐动作音效与原生声音.r3.json`),selectionSha256:hash(`${base}/10_剪辑准备/动效/shotcraft-selection.r2.json`),withSfx:{path:`${pub}/audio/final-mix.r3.wav`,sha256:hash(`${pub}/audio/final-mix.r3.wav`)},withoutAdditionalSfx:{path:`${pub}/audio/base-mix.wav`,sha256:hash(`${pub}/audio/base-mix.wav`)},events:cues.length,nativeClips:native.length,originalSpeechPreserved:true,userAudibilityConfirmed:false});
console.log(JSON.stringify({soundEvents:cues.length,nativeClips:native.length,status:'混音已生成，待实际导出复检'}));
