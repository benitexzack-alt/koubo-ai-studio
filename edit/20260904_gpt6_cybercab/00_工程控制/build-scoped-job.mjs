import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
import {SCOPED_DIRECT_EXPORT as S, SCOPED_DIRECT_EXPORT_GATE_FILES, SCOPED_PRESHOOT_ARTIFACTS, collectScopedDirectExportBindings} from '../../../tools/scoped-direct-export-core.mjs';

const root=process.cwd(), episode='edit/20260904_gpt6_cybercab';
const control=`${episode}/00_工程控制`, post=`${episode}/04_导演拆解/postshoot-manual-r1`;
const captions=`${episode}/07_实录与字幕/turbo-review-r2/actual-bilingual.v1.json`;
const transcript=`${episode}/07_实录与字幕/turbo-review-r2/canonical-transcript.v1.json`;
const policy=`${control}/spoken-source-policy.v1.json`;
const hash=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const ref=p=>({path:p,sha256:hash(p)});
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');};

// Preserve exact, existing user events, not a reconstructed authorization narrative.
const rollout='/Users/pc/.codex/sessions/2026/07/06/rollout-2026-07-06T02-21-19-019f3383-706c-78f3-9dbe-6c6b20affb59.jsonl';
const wanted=['再不用给我出预览了，直接给我出成片，时间已经来不及了。','那就抓紧修复呀，赶紧出片呀。'];
const events=[];
let sourceLine=0;
const sourceOffset=Math.max(0,fs.statSync(rollout).size-100*1024*1024);
for await(const raw of createInterface({input:fs.createReadStream(rollout,{start:sourceOffset}),crlfDelay:Infinity})) {
  sourceLine++;
  if(sourceOffset&&sourceLine===1)continue;
  if(!raw.includes('user_message')||!wanted.some(q=>raw.includes(q)))continue;
  const data=JSON.parse(raw);
  if(data.type==='event_msg'&&data.payload?.type==='user_message')events.push({raw,line:sourceLine,data});
}
const found=wanted.map(quote=>{
  const e=events.findLast(e=>e.data.type==='event_msg'&&e.data.payload?.type==='user_message'&&e.data.payload.message.trim()===quote);
  if(!e)throw Error('Actual user event not found: '+quote);return {...e,quote:e.data.payload.message};
});
const evidence=`${control}/direct-export-user-events.jsonl`;
fs.writeFileSync(evidence,found.map(e=>e.raw).join('\n')+'\n');
write(`${control}/direct-export-user-events.provenance.json`,{sourceRollout:rollout,extraction:'verbatim-original-jsonl-lines',sourceReadByteOffset:sourceOffset,messages:found.map((e,i)=>({lineWithinTail:e.line,excerptLine:i+1,quote:e.quote})),independentSignature:false});

const inPlan=read(`${episode}/04_导演拆解/剪后261秒_素材与镜头对位.v3.json`);
const compiled=read('remotion/src/gpt6-cybercab-v8-r1/candidate-plan.v1.json');
const generatedVideos=inPlan.paperSlots.map(p=>({...ref(`${episode}/${p.asset.path}`),provenance:'user-generated-manual-import'}));
const source=`${episode}/01_口播原片/R01_口播原片.MOV`;
const proxy=`${episode}/11_指定句剪除_r1/01_口播原片_仅剪除没有人负责_r1.mp4`;
const visualPlan=`${episode}/04_导演拆解/visual-plan.formal-r1.json`;
const sfx=`${episode}/04_导演拆解/sfx-cues.formal-r1.json`;
const postRequest=`${post}/manual-postshoot-request.v1.json`,postPlan=`${post}/manual-postshoot-plan.v1.json`,postReceipt=`${post}/manual-postshoot-validation.v1.json`;
write(postRequest,{schema:'koubo-manual-postshoot-request/v1',taskId:S.directorTaskId,phase:'post-shoot',provenance:'user-generated-manual-import',
  request:'用户六段已生成素材按实录重绑；仅去除没有人负责；跳过单独预览直接正式候选',
  recordedMedia:ref(source),cutMedia:ref(proxy),transcript:ref(transcript),bilingualCaptions:ref(captions),
  durationFrames:7830,fps:30,scriptRole:'comparison-only',generatedVideos,
  preproduction:Object.fromEntries(Object.entries(SCOPED_PRESHOOT_ARTIFACTS).map(([k,p])=>[k,ref(p)]))});
const actual=read(captions);
write(postPlan,{schema:'koubo-manual-postshoot-plan/v1',taskId:S.directorTaskId,phase:'post-shoot',status:'manual-import-bound',
  request:ref(postRequest),spokenAuthority:'recorded-audio',scriptRole:'comparison-only',skillExecuted:false,
  automatedDirectorReproductionClaimed:false,userPreviewApproved:false,generatedVideos,
  mappings:inPlan.paperSlots.map(p=>({id:p.id,source:ref(`${episode}/${p.asset.path}`),startFrame:p.outputStartFrame,endFrameExclusive:p.outputEndFrameExclusive,
    actualSpokenLine:actual.filter(c=>c.startMs<p.outputEndFrameExclusive/30*1000&&c.endMs>p.outputStartFrame/30*1000).map(c=>c.zh).join(''),
    purpose:p.purpose,visibleSourceLabels:p.labels,playbackRate:1,visualTreatment:'full-frame-source-no-extra-semantic-cards',
    sourceAudio:compiled.mediaAudio.find(a=>a.id===p.id),alignment:'manual-semantic-window',
    limitation:'标签烘焙在用户源片中，按整段实录语义对齐，不声称每个生成动作与每个字逐帧同步。'})),
  evidenceMappings:inPlan.broll,allSceneCoverage:compiled.scenes.map(s=>({id:s.id,start:s.start,end:s.end,kind:s.kind})),
  sourceAudioHumanAuditionCompleted:false,fullWatchConfirmed:false});
const artifacts={...Object.fromEntries(Object.entries(SCOPED_PRESHOOT_ARTIFACTS).map(([k,p])=>[k,ref(p)])),postshootRequest:ref(postRequest),postshootPlan:ref(postPlan)};
write(postReceipt,{schema:'koubo-scoped-manual-postshoot/v1',taskId:S.directorTaskId,episodeId:S.episodeId,jobId:S.jobId,revisionId:S.revisionId,
  phase:'post-shoot',status:'manual-import-bound',provenance:'user-generated-manual-import',skillExecuted:false,skillPackageAccepted:false,userPreviewApproved:false,
  spokenAuthority:'recorded-audio',scriptRole:'comparison-only',bindings:{...artifacts,source:ref(source),transcript:ref(transcript),bilingualCaptions:ref(captions),
    spokenSourcePolicy:ref(policy),visualPlan:ref(visualPlan),compositionEntry:ref(S.entry)},generatedVideos});
artifacts.postshootValidation=ref(postReceipt);
const publicDir='remotion/public-gpt6-cybercab-v8-r1';
fs.mkdirSync(`${publicDir}/data`,{recursive:true});fs.copyFileSync(captions,`${publicDir}/data/actual-bilingual.v1.json`);
const fingerprintPaths=[...new Set([S.manifestPath,...SCOPED_DIRECT_EXPORT_GATE_FILES,evidence,...Object.values(artifacts).map(r=>r.path),
  source,proxy,transcript,captions,policy,visualPlan,sfx,...generatedVideos.map(r=>r.path),
  `${episode}/11_指定句剪除_r1/cut-edl.v1.json`,`${episode}/04_导演拆解/剪后261秒_素材与镜头对位.v3.json`,
  'remotion/src/gpt6-cybercab-v8-r1',publicDir,'assets/sfx/koubo-sfx-v8/manifest.json'])];
const job={schemaVersion:1,jobId:S.jobId,videoId:S.episodeId,title:'GPT-6 Astra与Cybercab：从技术到生意',
  purpose:'按真实口播包装，保留六段纸艺与真实演示，唯一删除没有人负责。',productionState:'ready-for-production',
  productionProfile:{id:'v8-semantic-continuity-sfx',version:'V8'},contentApproval:{userScriptApproved:true,evidence:ref(evidence)},
  finalReview:{fullWatchConfirmed:false,reviewOutcome:'pending'},experiment:{id:'v8-semantic-continuity-sfx',status:S.state,userPreviewApproved:false,
    primaryVisualEventCount:compiled.scenes.length,sfxCoveragePercent:100},
  baseline:{path:'workflow/production-baseline.v1.json',id:'koubo-formal-16x9-v1',revision:'V7.2-20260730'},
  inputs:{source,renderProxy:proxy,visualPlan,transcript,captions,bilingualCaptions:captions,spokenSourcePolicy:policy,sfxCueSheet:sfx,sfxManifest:'assets/sfx/koubo-sfx-v8/manifest.json',fingerprintPaths},
  remotion:{root:'remotion',entry:'src/gpt6-cybercab-v8-r1/index.tsx',publicDir,compositionWithSfx:S.composition,compositionWithoutSfx:'GPT6CybercabV8R1NoSfx',durationSeconds:261,fps:30,width:1920,height:1080,concurrency:4},
  preview:{enabled:false,ranges:[],output:null,renderWithoutSfxComparison:false},
  riskFrames:{enabled:true,source:'formal-output-extraction',fullResolution:true,outputDirectory:`${episode}/08_预览与质检/formal-r1/frames`},
  audioPreflight:{enabled:false,source:'formal',integratedLoudnessTargetLufs:-16,truePeakMaxDbtp:-1.5,preferredTruePeakDbtp:-2.2},
  formal:{enabled:true,composition:'with-sfx',blockedReason:null,crf:16,pixelFormat:'yuv420p',audioCodec:'aac',audioBitrate:'320k',
    rawOutput:`${episode}/09_正式成片/GPT6与Cybercab_V8_正式渲染原始音轨_v1.mp4`,finalOutput:`${episode}/09_正式成片/GPT6与Cybercab_V8_有音效_正式候选_v1.mp4`,
    loudness:{enabled:true,integratedLoudnessTargetLufs:-16,loudnessRangeTargetLu:11,truePeakTargetDbtp:-2.2}},
  cache:{enabled:true,directory:'work/production-cache/gpt6-cybercab-v8-r1'},
  reports:{runManifest:`${episode}/08_预览与质检/formal-r1/run-manifest.json`,timingReport:`${episode}/08_预览与质检/formal-r1/timings.json`,regressionReport:`${episode}/08_预览与质检/formal-r1/regression.json`},
  knowledgeContext:{taskId:'task-20260904T162325Z-b0d0dc6b',contextPath:'task-20260904T162325Z-b0d0dc6b/context.json'},
  director:{required:true,profileId:'paper-editorial-director-v3',profileVersion:'3.2.0',paperRequired:true,fallback:'blocked',taskId:S.directorTaskId,phase:'post-shoot',artifacts},
  productionGate:{schema:'director-production-entry-binding/v2',route:S.route,state:S.state,revisionId:S.revisionId,formalEnabled:true,userPreviewApproved:false,scopedDirectExport:{path:S.manifestPath,sha256:'0'.repeat(64)}}};
write(S.jobPath,job);
const bindings=collectScopedDirectExportBindings({projectRoot:root,job});
write(S.manifestPath,{schema:S.schema,route:S.route,episodeId:S.episodeId,jobId:S.jobId,revisionId:S.revisionId,jobPath:S.jobPath,...bindings,
  authorization:{kind:'verified-user-direct-export',evidence:ref(evidence),format:'codex-rollout-jsonl',directExportMessage:{line:2,quote:found[1].quote},skipPreviewMessage:{line:1,quote:found[0].quote},independentSignature:false},
  media:Object.fromEntries(['source','renderProxy','transcript','bilingualCaptions','spokenSourcePolicy'].map(k=>[k,ref(job.inputs[k])])),generatedVideos,
  outputs:{rawOutput:job.formal.rawOutput,finalOutput:job.formal.finalOutput},allowedCommands:['doctor','fingerprint','risk-frames','formal','formal-audio','qa','release-validation'],
  constraints:{previewApproved:false,fullWatchConfirmed:false,publishAuthorized:false,providerCallsAllowed:false}});
job.productionGate.scopedDirectExport.sha256=hash(S.manifestPath);write(S.jobPath,job);
console.log(JSON.stringify({job:S.jobPath,manifest:S.manifestPath,sha256:hash(S.manifestPath),formalOutput:job.formal.finalOutput},null,2));
