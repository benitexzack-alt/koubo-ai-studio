import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BASE,CONTROL,JOB,MANIFEST,RUNTIME,ROUTE,PUBLIC,SOURCE,PREVIEW,PREVIEW_SHA,QUOTES,collectIndustryAiNoAnxietyFormalR1Bindings} from './formal-adapter.r1.mjs';
import {SCOPED_DIRECT_EXPORT_GATE_FILES} from '../../../tools/scoped-direct-export-core.mjs';
const root=process.cwd(),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),ref=p=>({path:p,sha256:hash(p)});
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const taskId='task-20260929T180000Z-industry-final-r1';
const rollout='/Users/pc/.codex/sessions/2026/09/11/rollout-2026-09-11T19-21-27-01a09033-794b-7dc2-a53d-19afbccec54e.jsonl';
const events=new Map();let lineNumber=0;
for await(const line of readline.createInterface({input:fs.createReadStream(rollout)})){
 lineNumber++;if(!line||line.length>100000)continue;const event=JSON.parse(line);if(event.type!=='response_item'||event.payload?.role!=='user')continue;
 const text=event.payload.content?.filter(x=>['input_text','text'].includes(x.type)).map(x=>x.text).join('\n').trim();if(QUOTES.includes(text))events.set(text,{line,lineNumber});
}
assert.equal(events.size,QUOTES.length,'必须找到本任务真实用户正式授权，不可代写');
const evidence=QUOTES.map((q,i)=>{const e=events.get(q),p=`${CONTROL}/formal-authorization.r1.user-${i+1}.jsonl`;fs.writeFileSync(p,e.line+'\n');return {...ref(p),source:rollout,line:e.lineNumber};});
const authorization=`${CONTROL}/formal-authorization.r1.json`;
write(authorization,{schema:'industry-ai-no-anxiety-formal-authorization/v1',userQuotes:QUOTES,evidence,preview:{path:PREVIEW,sha256:PREVIEW_SHA},previewScope:'41-second-representative-section',previewApproved:true,skipAdditionalPreview:true,formalEnabled:true,fullWatchConfirmed:false,publishAuthorized:false,scope:'将已认可41秒样片延展为本期完整122.9秒正式候选；完整原声与实录字幕、5段已投放纸艺及其原生音、左下真人和独立字幕区、AOL更正、既有3处Shotcraft和7音效。不重写导演Skill，不重生成素材，不发布。'});
const cap=`${BASE}/06_实录与字幕`,transcript=`${cap}/正式实录.r1.json`,captions=`${cap}/实录双语字幕_候选.r1.json`,policy=`${cap}/spoken-source-policy.r1.json`;
const runtime=JSON.parse(fs.readFileSync(RUNTIME)),originalPaths=[];
const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){if(e.name.startsWith('.'))continue;const child=`${p}/${e.name}`;if(e.isDirectory())walk(child);else if(e.isFile())originalPaths.push(child);else throw Error(`素材不可是链接:${child}`);}};walk(`${BASE}/01_素材投放区`);
const paths=[SOURCE,transcript,captions,policy,`${cap}/实录逐词_候选.r1.json`,`${cap}/字幕核对记录.r1.json`,RUNTIME,authorization,...evidence.map(x=>x.path),PREVIEW,...originalPaths,`${CONTROL}/formal-adapter.r1.mjs`,`${CONTROL}/prepare-final.r1.mjs`,`${CONTROL}/build-formal-binding.r1.mjs`,`${BASE}/02_导演方案/director-cues.v2.json`,`${BASE}/04_Remotion准备/剪辑与声音落点.r1.json`,`${BASE}/04_Remotion准备/实录重绑时间线.r1.json`,`${BASE}/04_Remotion准备/动效选择.r1.json`,'assets/sfx/koubo-sfx-v8/manifest.json',...runtime.sfxCues.map(c=>c.source),'skills/koubo-remotion-director/assets/remotion-presenter-media/PresenterMediaStage.tsx','skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',...SCOPED_DIRECT_EXPORT_GATE_FILES,'tools/check-spoken-source-policy.mjs','workflow/active-production-profile.v1.json'];
const job={schemaVersion:1,jobId:'20260926-industry-ai-no-anxiety-v8-final-r1',videoId:'20260926_industry_ai_no_anxiety',title:'行业经验配AI',productionState:'ready-for-production',productionProfile:{id:'v8-semantic-continuity-sfx',version:'V8'},experiment:{id:'v8-semantic-continuity-sfx',userPreviewApproved:true,previewScope:'41-second-representative-section',status:'approved-section-with-explicit-full-direct-export'},
 inputs:{source:SOURCE,renderProxy:`${PUBLIC}/host.mp4`,transcript,bilingualCaptions:captions,captions,spokenSourcePolicy:policy,visualPlan:RUNTIME,sfxCueSheet:RUNTIME,sfxManifest:'assets/sfx/koubo-sfx-v8/manifest.json',timingRebind:`${BASE}/04_Remotion准备/实录重绑时间线.r1.json`,fingerprintPaths:[...new Set(paths)]},
 remotion:{root:'remotion',entry:'src/industry-ai-no-anxiety-final-r1/index.tsx',publicDir:PUBLIC,compositionWithSfx:'IndustryAiNoAnxietyFinalR1',compositionWithoutSfx:null,fps:30,width:1920,height:1080,durationSeconds:122.9,concurrency:3},preview:{enabled:false,output:null,ranges:[],renderWithoutSfxComparison:false},
 formal:{enabled:true,composition:'with-sfx',rawOutput:`${BASE}/08_正式成片/行业经验配AI_R1_正式渲染原始.mp4`,finalOutput:`${BASE}/08_正式成片/行业经验配AI_V8_R1_1080P_正式候选.mp4`,crf:18,pixelFormat:'yuv420p',audioBitrate:'256k'},finalReview:{fullWatchConfirmed:false,reviewOutcome:'pending'},publishAuthorized:false,
 knowledgeContext:{taskId,contextPath:`${taskId}/context.json`},director:{required:true,profileId:'paper-editorial-director-v9',profileVersion:'9.1.0',taskId:'20260926_industry_ai_no_anxiety',phase:'post-shoot',postshootEvidence:'actual-spoken-timeline',skillPackageAccepted:false},productionGate:{schema:'director-production-entry-binding/v2',route:ROUTE,state:'scoped-formal-authorized-r1',revisionId:'industry-ai-no-anxiety-v8-final-r1',formalEnabled:true,userPreviewApproved:true,scopedDirectExport:{path:MANIFEST,sha256:'0'.repeat(64)}},reports:{runManifest:`${BASE}/07_预览与质检/正式R1/run-manifest.json`},blockers:[]};
write(JOB,job);const manifest={schema:'industry-ai-no-anxiety-formal-manifest/v1',route:ROUTE,episodeId:job.videoId,jobId:job.jobId,jobPath:JOB,authorization:ref(authorization),binding:collectIndustryAiNoAnxietyFormalR1Bindings({projectRoot:root,job}),fullWatchConfirmed:false,publishAuthorized:false};
write(MANIFEST,manifest);const pin=hash(MANIFEST);job.productionGate.scopedDirectExport.sha256=pin;write(JOB,job);console.log(JSON.stringify({job:JOB,manifest:MANIFEST,pin,taskId,evidenceLines:evidence.map(e=>e.line)},null,2));
