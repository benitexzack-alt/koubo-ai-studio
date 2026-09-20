import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {createHash} from 'node:crypto';
import {BASE,CONTROL,JOB,MANIFEST,RUNTIME,ROUTE,PUBLIC,SOURCE,PREVIEW,PREVIEW_SHA,QUOTES,collectAITrainingFormalR1Bindings} from './formal-adapter.r1.mjs';
import {SCOPED_DIRECT_EXPORT_GATE_FILES} from '../../../tools/scoped-direct-export-core.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const taskId=process.argv[2];
if(!/^task-[a-zA-Z0-9-]+$/u.test(taskId??''))throw Error('用法：node build-formal-binding.r1.mjs <本期RAG任务ID> [额外需要绑定的项目相对文件...]');
const abs=p=>path.resolve(root,p);
const hash=p=>createHash('sha256').update(fs.readFileSync(abs(p))).digest('hex');
const ref=p=>({path:p,sha256:hash(p)});
const write=(p,v)=>{fs.mkdirSync(path.dirname(abs(p)),{recursive:true});fs.writeFileSync(abs(p),JSON.stringify(v,null,2)+'\n');};
const rollout='/Users/pc/.codex/sessions/2026/09/11/rollout-2026-09-11T19-21-27-01a09033-794b-7dc2-a53d-19afbccec54e.jsonl';
const events=new Map();let lineNumber=0;
for await(const line of readline.createInterface({input:fs.createReadStream(rollout)})){
 lineNumber++;if(!line||line.length>100000)continue;
 const event=JSON.parse(line);if(event.type!=='response_item'||event.payload?.role!=='user')continue;
 const text=event.payload.content?.filter(x=>['input_text','text'].includes(x.type)).map(x=>x.text).join('\n').trim();
 if(QUOTES.includes(text))events.set(text,{line,lineNumber});
}
if(events.size!==QUOTES.length)throw Error('缺少本任务直接正式导出/原声字幕音效要求的真实用户消息');
const evidence=QUOTES.map((q,i)=>{
 const e=events.get(q),p=`${CONTROL}/formal-authorization.r1.user-${i+1}.jsonl`;
 fs.writeFileSync(abs(p),e.line+'\n');return {...ref(p),source:rollout,line:e.lineNumber};
});
const authorization=`${CONTROL}/formal-authorization.r1.json`;
write(authorization,{schema:'ai-training-methods-formal-authorization/v1',userQuotes:QUOTES,evidence,
 preview:{path:PREVIEW,sha256:PREVIEW_SHA},previewScope:'42-second-representative-section',previewApproved:true,skipAdditionalPreview:true,formalEnabled:true,fullWatchConfirmed:false,publishAuthorized:false,
 scope:'保留本期完整原声和实录字幕；放大左侧语义动效卡；每一个实际Remotion动效同步音效；沿用已认可的录屏与左下角小窗；直接导出正式候选，不追加样片。',
 latestDecision:'用户明确保留原视频说法，不添加未授权内容免责声明；最终全片观看与发布授权仍未发生。'});
const capBase=`${BASE}/05_实录与字幕`;
const runtime=JSON.parse(fs.readFileSync(abs(RUNTIME),'utf8'));
const transcript=`${capBase}/final-r1-actual-transcript.json`,captions=`${capBase}/final-r1-bilingual-captions.json`,policy=`${capBase}/final-r1-spoken-source-policy.json`;
const originalPaths=[];
const walk=p=>{for(const e of fs.readdirSync(abs(p),{withFileTypes:true})){if(e.name.startsWith('.'))continue;const child=`${p}/${e.name}`;if(e.isDirectory())walk(child);else if(e.isFile())originalPaths.push(child);else throw Error(`素材不允许符号链接：${child}`);}};
walk(`${BASE}/01_素材投放区`);
const paths=[SOURCE,transcript,captions,policy,`${capBase}/final-r1-correction-log.json`,`${capBase}/final-r1-local-recheck.json`,RUNTIME,authorization,...evidence.map(x=>x.path),PREVIEW,...originalPaths,
 `${CONTROL}/formal-adapter.r1.mjs`,`${CONTROL}/build-formal-binding.r1.mjs`,`${CONTROL}/prepare-final.r1.mjs`,`${BASE}/03_导演拆解/director-cues.v2.json`,
 'assets/sfx/koubo-sfx-v8/manifest.json',...runtime.sfxCues.map(c=>c.source),`${BASE}/06_剪辑工程/动效音效逐项对应.r1.json`,
 'remotion/src/ai-training-final-r1/vendor/provenance.json','remotion/src/ai-training-final-r1/vendor/LICENSE',
 'skills/koubo-remotion-director/assets/remotion-presenter-media/PresenterMediaStage.tsx','skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx','skills/koubo-remotion-director/references/platform-safe-areas.v1.json',
 `${BASE}/07_预览与质检/录屏小样R2/selection-r3.json`,`${BASE}/07_预览与质检/录屏小样R2/match-receipt-r3.json`,
 ...SCOPED_DIRECT_EXPORT_GATE_FILES,...process.argv.slice(3)];
const job={schemaVersion:1,jobId:'20260919-ai-training-methods-v8-final-r1',videoId:'20260919_ai_training_methods',title:'AI八种训练方法',productionState:'ready-for-production',
 productionProfile:{id:'v8-semantic-continuity-sfx',version:'V8'},
 experiment:{id:'v8-semantic-continuity-sfx',userPreviewApproved:true,previewScope:'42-second-representative-section',status:'approved-section-with-explicit-full-direct-export'},
 inputs:{source:SOURCE,renderProxy:`${PUBLIC}/media/host.mp4`,transcript,bilingualCaptions:captions,captions,spokenSourcePolicy:policy,visualPlan:RUNTIME,sfxCueSheet:RUNTIME,sfxManifest:'assets/sfx/koubo-sfx-v8/manifest.json',timingRebind:RUNTIME,fingerprintPaths:[...new Set(paths)]},
 remotion:{root:'remotion',entry:'src/ai-training-final-r1/index.tsx',publicDir:PUBLIC,compositionWithSfx:'AITrainingV8-Final-WithSfx',compositionWithoutSfx:null,fps:30,width:1920,height:1080,durationSeconds:9155/30,concurrency:2},
 preview:{enabled:false,output:null,ranges:[],renderWithoutSfxComparison:false},
 formal:{enabled:true,composition:'with-sfx',rawOutput:`${BASE}/08_正式成片/AI八种训练方法_R1_正式渲染原始.mp4`,finalOutput:`${BASE}/08_正式成片/AI八种训练方法_V8_R1_1080P_正式候选.mp4`,crf:18,pixelFormat:'yuv420p',audioBitrate:'320k'},
 finalReview:{fullWatchConfirmed:false,reviewOutcome:'pending'},publishAuthorized:false,
 knowledgeContext:{taskId,contextPath:`${taskId}/context.json`},
 director:{required:true,profileId:'paper-editorial-director-v9',profileVersion:'9.1.0',taskId:'20260919_ai_training_methods',phase:'post-shoot',postshootEvidence:'actual-spoken-timeline',skillPackageAccepted:false},
 productionGate:{schema:'director-production-entry-binding/v2',route:ROUTE,state:'scoped-formal-authorized-r1',revisionId:'ai-training-methods-v8-final-r1',formalEnabled:true,userPreviewApproved:true,scopedDirectExport:{path:MANIFEST,sha256:'0'.repeat(64)}},
 riskFrames:{enabled:true,fullResolution:true,outputDirectory:`${BASE}/07_预览与质检/正式R1/frames`,entries:[0,27,48,70,95,113,126,134,143,151,160,169,180,209,239,271,303].map(time=>({time}))},
 reports:{runManifest:`${BASE}/07_预览与质检/正式R1/run-manifest.json`,timingReport:`${BASE}/07_预览与质检/正式R1/timing.json`,regressionReport:`${BASE}/07_预览与质检/正式R1/regression.json`},blockers:[]};
write(JOB,job);
const manifest={schema:'ai-training-methods-formal-manifest/v1',route:ROUTE,episodeId:'20260919_ai_training_methods',jobId:job.jobId,jobPath:JOB,authorization:ref(authorization),binding:collectAITrainingFormalR1Bindings({projectRoot:root,job}),fullWatchConfirmed:false,publishAuthorized:false};
write(MANIFEST,manifest);const pin=hash(MANIFEST);job.productionGate.scopedDirectExport.sha256=pin;write(JOB,job);
fs.mkdirSync(abs(`${BASE}/08_正式成片`),{recursive:true});
console.log(JSON.stringify({status:'formal-inputs-bound-pin-update-required',job:JOB,manifest:MANIFEST,pin,action:'用apply_patch仅更新 tools/scoped-direct-export-core.mjs 的 AI_TRAINING_FORMAL_R1_PIN；主代理实际读取最终job后建立当前RAG读回执，再运行原生预检。',taskId,evidenceLines:evidence.map(x=>x.line)},null,2));
