// 本期输入封装，不渲染，不解锁正式生产；隔离小样仍待用户明确同意。
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {collectRemotionRuntimeGraphV2} from '../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
const root=process.cwd(),base='edit/20260929_meta_pa_local_business',pub='remotion/public/media/meta-pa-local-business-r1',dir=`${base}/10_剪辑准备/完整视听小样R1`;
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n');
fs.mkdirSync(dir,{recursive:true});
const runtime='remotion/src/meta-pa-local-business-r1/runtime';fs.mkdirSync(runtime,{recursive:true});
const mirrors=[['03_导演拆解/实录候选时间锚点.r1.json','anchors.r1.json'],['10_剪辑准备/动效/shotcraft-selection.r2.json','shotcraft-selection.r2.json']].map(([p,n])=>[`${base}/${p}`,`${runtime}/${n}`]);
mirrors.push(['skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',`${runtime}/ShotcraftEffects.tsx`],['skills/koubo-shotcraft-library/upstream/LICENSE',`${runtime}/LICENSE`]);
for(const [source,target]of mirrors){if(fs.existsSync(target)){if(sha(target)!==sha(source))throw Error(`运行镜像变化:${target}`);}else fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);}
json(`${dir}/运行镜像回执.r1.json`,{scope:'仅本期Remotion根目录内同哈希镜像，不修改上游或共享代码',files:mirrors.map(([source,target])=>({source,target,sha256:sha(source),identical:sha(source)===sha(target)}))});
const captions=`${base}/10_剪辑准备/字幕/meta-pa.actual.bilingual.r1.json`;
if(fs.existsSync(`${pub}/captions.json`)){if(sha(`${pub}/captions.json`)!==sha(captions))throw Error('不覆盖不同字幕');}
else fs.copyFileSync(captions,`${pub}/captions.json`,fs.constants.COPYFILE_EXCL);
const job={schema:'meta-pa-isolated-review-preview/v1',videoId:'meta-pa-local-business-20260929',jobId:'meta-pa-review-r1',revisionId:'meta-pa-preview-r1',durationInFrames:12286,fps:30,width:1920,height:1080,formalEnabled:false,productionEligible:false,publishAuthorized:false,userPreviewApproved:false,fullWatchConfirmed:false,subtitleAuthority:'actual-recording',knowledgeContext:{taskId:'task-20260930T112613Z-56827b79',contextPath:'task-20260930T112613Z-56827b79/context.json'},remotion:{root:'remotion',entry:'src/meta-pa-local-business-r1/index.tsx',publicDir:pub,compositionId:'MetaPALocalBusinessPreviewR1'},outputs:{directory:dir,fullPreview:`${dir}/完整视听小样R1.mp4`},originalVoice:{source:`${base}/01_素材投放区/01_口播原片/copy_1C64A779-C1E2-417C-A440-6474D8A3C04B.MOV`,allSpeechPreserved:true,speed:1,deletedRanges:[]},sound:{mix:`${pub}/audio/final-mix.r3.wav`,base:`${pub}/audio/base-mix.wav`,plan:`${base}/10_剪辑准备/声音/逐动作音效与原生声音.r3.json`},shotcraftSelection:`${base}/10_剪辑准备/动效/shotcraft-selection.r2.json`,captions,spokenPolicy:`${base}/10_剪辑准备/字幕/meta-pa.spoken-source-policy.r1.json`,gateLimitation:'现行V2通用入口仍要求legacy纸艺合同。本文件是待明确授权的隔离小样输入，不登记为V2正式生产结果。',reviewPoints:['P01筛选结果未清晰分流到候选托盘','275.96秒录取/录定、350.38秒接线/接下待原声听审','动效可读性、字物同动和音效听感仍须正常速度完整观看']};
const files=new Set(collectRemotionRuntimeGraphV2({projectRoot:root,job}).map(x=>x.path));
const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=`${p}/${e.name}`;if(e.isSymbolicLink())throw Error('绑定中禁止符号链接');if(e.isDirectory())walk(q);else files.add(q);}};
walk(pub);
for(const p of [job.originalVoice.source,job.captions,job.spokenPolicy,job.sound.plan,job.shotcraftSelection,`${base}/03_导演拆解/director-cues.v2.json`,`${base}/03_导演拆解/实录候选时间锚点.r1.json`,`${base}/10_剪辑准备/素材验收/素材规格与完整解码回执.r1.json`,`${base}/10_剪辑准备/公开视窗/公开资料实际视窗回执.r2.json`,`${base}/10_剪辑准备/动效/shotcraft-auto-match-receipt.r2.json`,`${base}/10_剪辑准备/动效/shotcraft-word-timing-binding.r2.json`,'tools/knowledge-context-production-gate.mjs',`${base}/00_控制/run-preview.r1.mjs`,...mirrors.flat()])files.add(p);
job.bindings=[...files].sort().map(p=>({path:p,sha256:sha(path.resolve(root,p))}));
json(`${dir}/preview-job.json`,job);
const sound=read(job.sound.plan),selection=read(job.shotcraftSelection),semantic=read('remotion/src/meta-pa-local-business-r1/semantic/semantic-plan.r1.json');
json(`${dir}/本期准备回执.r1.json`,{jobSha256:sha(`${dir}/preview-job.json`),durationSeconds:job.durationInFrames/30,selectedShotcraft:selection.beats.filter(b=>b.decision==='apply').length,continuousObjects:semantic.layers.filter(l=>!selection.beats.some(b=>b.decision==='apply'&&b.beatId===l.beatId)).length,soundEvents:sound.events.length,nativeAudioClips:sound.native.length,status:'inputs-bound-isolated-preview-authorization-pending',rendered:false,formalEnabled:false,publishAuthorized:false});
console.log(JSON.stringify({status:'本期输入已封装，未渲染；隔离小样仍待用户同意',boundFiles:job.bindings.length}));
