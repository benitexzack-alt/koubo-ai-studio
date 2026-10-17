// 只准备本期24—47秒已授权候选；调用前由主Agent确认组件/声音冻结。
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..');
const r2=resolve(root,'edit/20261017_small_business_ai_agility/06_预览与质检/视频候选R2');
const sample=resolve(root,'remotion/src/small-business-ai-agility-r3-sample');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const ref=p=>({path:relative(root,p),sha256:createHash('sha256').update(readFileSync(p)).digest('hex')});
const write=(name,body)=>{const p=resolve(out,name);writeFileSync(p,JSON.stringify(body,null,2)+'\n',{flag:'wx'});return p;};
assert(process.argv.includes('--component-frozen'),'必须由主Agent确认组件和声音冻结后执行');
assert(!existsSync(resolve(out,'production-job.sample.v1.json')),'已有job，禁止覆盖');
const revisionId='small-business-ai-agility-v9-motion-sample-r3-20261017';
const identity={episodeId:'small-business-ai-agility-20261017',taskId:'SMALL_BUSINESS_AI_AGILITY_20261017',revisionId};
const baseline=read(resolve(root,'edit/20261017_small_business_ai_agility/05_剪辑工程/runtime-plan.v1.json'));
const runtimePath=resolve(sample,'sample-plan.snapshot.json'),runtime=read(runtimePath);
for(const key of ['width','height','fps','durationInFrames','host','voice','captions','mediaSlots','fonts'])assert.deepEqual(runtime[key],baseline[key],`本样片不得改动${key}`);
const priorInput=read(resolve(r2,'first-candidate-input.v1.json'));
const priorJob=read(resolve(r2,'production-job.first-candidate.v1.json'));
const priorIntake=read(resolve(root,priorInput.artifacts.mediaIntake.path));
const available=new Set(priorIntake.assets.map(a=>a.renderAsset.path));
for(const sfx of runtime.sfx)assert(available.has(relative(root,resolve(root,priorJob.remotion.publicDir,sfx.src))),'新增音效源须先由root提供实际来源入库');
const request=resolve(out,'本轮局部动效小样授权原话.v1.json');
assert.equal(read(request).quotedUserMessage,'好的，抓紧开始。');
const scope=write('用户局部预览范围.v1.json',{
 schemaVersion:'episode-native-v2-review-authorization/v1',...identity,
 scope:{reviewOnly:true,preserveAllOriginalSpeech:true,useExistingPaperVideos:true,allowPendingReviewInCandidate:true,formalAuthorized:false,publishAuthorized:false},
 quotedUserMessage:'好的，抓紧开始。',sourceMessage:ref(request),recordedAt:new Date().toISOString(),
 sourceRange:{startFrame:720,endFrameInclusive:1409,startSeconds:24,endSecondsExclusive:47},
 audioScope:'源完整保留，仅导出24—47秒；不得对原声删改、拉速或重排。',
 paperScope:'沿用完整时间轴中已入库纸艺以维持源合同，本局部时窗不包含纸艺。',
 humanFullWatchConfirmed:false,dynamicAccepted:false,audioAccepted:false
});
const intake=write('既有来源复用候选.v1.json',{...priorIntake,...identity,
 reusedFrom:priorInput.artifacts.mediaIntake,reusedAt:new Date().toISOString(),
 reuseBoundary:'媒体字节、来源与已有完整解码记录复用；不伪称本轮新增人审，受控入口会再次实测。'});
const artifacts={...priorInput.artifacts,runtimePlan:ref(runtimePath),mediaIntake:ref(intake),userScope:ref(scope)};
const input=write('first-candidate-input.v1.json',{...priorInput,...identity,
 executionGroupId:'codex-small-business-ai-agility-motion-sample-r3',artifacts});
const job={...priorJob,title:'小公司AI_24至47秒_字号与连续关系对照R3',
 knowledgeContext:{taskId:'small-business-ai-agility-motion-sample-r3-20261017',contextPath:'small-business-ai-agility-motion-sample-r3-20261017/context.json'},
 remotion:{...priorJob.remotion,entry:'src/small-business-ai-agility-r3-sample/index.tsx',
 compositionWithSfx:'SmallBusinessAgilityR3Sample-WithSfx',compositionWithoutSfx:'SmallBusinessAgilityR3Sample-NoSfx'},
 director:{...priorJob.director,artifacts},
 productionGate:{...priorJob.productionGate,revisionId,firstCandidateInput:ref(input),localChatPreviewAuthorization:null},
 preview:{output:'edit/20261017_small_business_ai_agility/08_动效优化小样R3/小公司AI_24-47秒_动效优化R3_1080p_有音效.mp4',
 renderSettings:{concurrency:1,timeoutInMilliseconds:120000,scale:1,frames:{start:720,end:1409}}},
 preparationNote:'本轮用户接受24—47秒局部修改对照提案；仅23秒内部观看，未授权整片应用、全局V9升级或发布。'};
write('production-job.sample.v1.json',job);
write('输入适配检查.v1.json',{checkedAt:new Date().toISOString(),runtime:ref(runtimePath),baseline:priorInput.artifacts.runtimePlan,
 originalMediaCaptionsVoiceFontsPaperUnchanged:true,sourceDurationFrames:4126,previewFrames:690,
 sourceFrameRange:{start:720,end:1409},sourceVoiceGainUnchanged:true,mediaEvidenceReusedFrom:priorInput.artifacts.mediaIntake,
 originalSourceSpeechPreserved:true,technicalDecodeRerunByControlledPreflight:true,humanListeningPerformed:false,renderInvoked:false});
write('组件冻结清单.v1.json',{frozenAt:new Date().toISOString(),files:['index.tsx','Composition.tsx','sample-plan.snapshot.json','sample-cues.v1.json','tsconfig.json'].map(n=>ref(resolve(sample,n))),
 frozenFor:'本期R3仅24—47秒预览；执行前仍需受控闭包复核',renderInvoked:false});
console.log(JSON.stringify({prepared:true,job:ref(resolve(out,'production-job.sample.v1.json')),renderInvoked:false}));
