// 本期完整1080P待审候选输入封装；不冒充已通过用户终验或通用V2正式release。
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {collectRemotionRuntimeGraphV2} from '../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
const root=process.cwd(),base='edit/20260929_meta_pa_local_business',pub='remotion/public/media/meta-pa-local-business-r1',dir=`${base}/10_剪辑准备/完整视听小样R1`;
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
fs.mkdirSync(dir,{recursive:true});
const runtime='remotion/src/meta-pa-local-business-r1/runtime';fs.mkdirSync(runtime,{recursive:true});
const mirrors=[['03_导演拆解/实录候选时间锚点.r1.json','anchors.r1.json'],['10_剪辑准备/动效/shotcraft-selection.r3.json','shotcraft-selection.r3.json']].map(([p,n])=>[`${base}/${p}`,`${runtime}/${n}`]);
mirrors.push(['skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',`${runtime}/ShotcraftEffects.tsx`],['skills/koubo-shotcraft-library/upstream/LICENSE',`${runtime}/LICENSE`]);
for(const [source,target]of mirrors){if(fs.existsSync(target)){if(sha(target)!==sha(source))throw Error(`运行镜像变化:${target}`);}else fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);}
json(`${dir}/运行镜像回执.r1.json`,{scope:'仅本期Remotion根目录内同哈希镜像，不修改上游或共享代码',files:mirrors.map(([source,target])=>({source,target,sha256:sha(source),identical:sha(source)===sha(target)}))});
const captions=`${base}/10_剪辑准备/字幕/meta-pa.actual.bilingual.r2.json`;
if(fs.existsSync(`${pub}/captions.r2.json`)){if(sha(`${pub}/captions.r2.json`)!==sha(captions))throw Error('不覆盖不同字幕');}
else fs.copyFileSync(captions,`${pub}/captions.r2.json`,fs.constants.COPYFILE_EXCL);
const job={schema:'meta-pa-isolated-review-preview/v1',videoId:'meta-pa-local-business-20260929',jobId:'meta-pa-review-r1',revisionId:'meta-pa-complete-1080p-r1',durationInFrames:12286,fps:30,width:1920,height:1080,renderScale:1,formalEnabled:false,productionEligible:false,publishAuthorized:false,userPreviewApproved:false,fullWatchConfirmed:false,subtitleAuthority:'actual-recording',knowledgeContext:{taskId:'task-20260930T112613Z-56827b79',contextPath:'task-20260930T112613Z-56827b79/context.json'},remotion:{root:'remotion',entry:'src/meta-pa-local-business-r1/index.tsx',publicDir:pub,compositionId:'MetaPALocalBusinessPreviewR1'},outputs:{directory:dir,fullPreview:`${base}/12_正式成片/Meta个人AI助理与本地商家_V8_R1_1080P.mp4`},originalVoice:{source:`${base}/01_素材投放区/01_口播原片/copy_1C64A779-C1E2-417C-A440-6474D8A3C04B.MOV`,allSpeechPreserved:true,speed:1,deletedRanges:[]},sound:{mix:`${pub}/audio/final-mix.r3.wav`,base:`${pub}/audio/base-mix.wav`,plan:`${base}/10_剪辑准备/声音/逐动作音效与原生声音.r3.json`},shotcraftSelection:`${base}/10_剪辑准备/动效/shotcraft-selection.r3.json`,captions,spokenPolicy:`${base}/10_剪辑准备/字幕/meta-pa.spoken-source-policy.r2.json`,gateLimitation:'用户明确要求继续并交付完整成片；本期独立入口输出完整1080P待审候选，仍不冒充通用V2正式release、人审通过或公开发布。',reviewPoints:['P01筛选动作结果由用户正常速度终验','275.96秒录取/录定、350.38秒接线/接下待原声听审','动效可读性、字物同动和音效听感仍须正常速度完整观看']};
const files=new Set(collectRemotionRuntimeGraphV2({projectRoot:root,job}).map(x=>x.path));
const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=`${p}/${e.name}`;if(e.isSymbolicLink())throw Error('绑定中禁止符号链接');if(e.isDirectory())walk(q);else files.add(q);}};
walk(pub);
for(const p of [job.originalVoice.source,job.captions,job.spokenPolicy,job.sound.plan,job.shotcraftSelection,`${base}/03_导演拆解/director-cues.v2.json`,`${base}/03_导演拆解/实录候选时间锚点.r1.json`,`${base}/10_剪辑准备/素材验收/素材规格与完整解码回执.r1.json`,`${base}/10_剪辑准备/公开视窗/公开资料实际视窗回执.r2.json`,`${base}/10_剪辑准备/动效/shotcraft-auto-match-receipt.r3.json`,`${base}/10_剪辑准备/动效/shotcraft-word-timing-binding.r3.json`,'tools/knowledge-context-production-gate.mjs',`${base}/00_控制/run-preview.r1.mjs`,...mirrors.flat()])files.add(p);
job.bindings=[...files].sort().map(p=>({path:p,sha256:sha(path.resolve(root,p))}));
json(`${dir}/preview-job.json`,job);
const sound=read(job.sound.plan),selection=read(job.shotcraftSelection),semantic=read('remotion/src/meta-pa-local-business-r1/semantic/semantic-plan.r1.json');
json(`${dir}/本期准备回执.r1.json`,{jobSha256:sha(`${dir}/preview-job.json`),durationSeconds:job.durationInFrames/30,selectedShotcraft:selection.beats.filter(b=>b.decision==='apply').length,continuousObjects:semantic.layers.filter(l=>!selection.beats.some(b=>b.decision==='apply'&&b.beatId===l.beatId)).length,soundEvents:sound.events.length,nativeAudioClips:sound.native.length,status:'complete-1080p-candidate-inputs-bound',rendered:false,formalEnabled:false,publishAuthorized:false});
console.log(JSON.stringify({status:'本期完整1080P待审候选输入已封装',boundFiles:job.bindings.length}));
