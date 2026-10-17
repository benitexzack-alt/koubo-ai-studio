// 本轮明确授权的V9全长有音效候选；旧R2/R3源与记录只读保留。
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..');
const r2=resolve(root,'edit/20261017_small_business_ai_agility/06_预览与质检/视频候选R2');
const component=resolve(root,'remotion/src/small-business-ai-agility-r4-final');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const ref=p=>({path:relative(root,p),sha256:createHash('sha256').update(readFileSync(p)).digest('hex')});
const write=(name,body)=>{const p=resolve(out,name);writeFileSync(p,JSON.stringify(body,null,2)+'\n',{flag:'wx'});return p;};
assert(process.argv.includes('--component-frozen'),'须等root确认视觉声音冻结后执行');
assert(!existsSync(resolve(out,'production-job.full-candidate.v1.json')),'已有R4 job，不覆盖');
const revisionId='small-business-ai-agility-v9-motion-full-candidate-r4-20261017';
const identity={episodeId:'small-business-ai-agility-20261017',taskId:'SMALL_BUSINESS_AI_AGILITY_20261017',revisionId};
const oldInput=read(resolve(r2,'first-candidate-input.v1.json')),oldJob=read(resolve(r2,'production-job.first-candidate.v1.json'));
const baseline=read(resolve(root,oldInput.artifacts.runtimePlan.path));
const runtimePath=resolve(component,'sample-plan.snapshot.json'),runtime=read(runtimePath);
for(const key of ['width','height','fps','durationInFrames','assetPrefix','host','voice','captions','mediaSlots','fonts','cameraWindows','avoidanceWindows'])assert.deepEqual(runtime[key],baseline[key],`R4不得改动${key}`);
const previousIntake=read(resolve(root,oldInput.artifacts.mediaIntake.path));
const supplementalPath=resolve(out,'补充声材入库.v1.json'),supplemental=read(supplementalPath);
assert.deepEqual(supplemental.assets.map(a=>a.id).sort(),['r4-sfx-v2-zoom-out','r4-sfx-v3-line-connect-a','r4-sfx-v3-number-settle-a']);
const assets=[...previousIntake.assets,...supplemental.assets];
const available=new Set(assets.map(a=>a.renderAsset.path));
for(const cue of runtime.sfx)assert(available.has(relative(root,resolve(root,oldJob.remotion.publicDir,cue.src))),'新增声素材需先提供真实来源，不能伪造入库');
const source=resolve(out,'本轮整片与发布包导出授权原话.v1.json'),request=read(source);
assert.equal(ref(resolve(root,request.sampleAcceptance.video.path)).sha256,request.sampleAcceptance.video.sha256);
assert.equal(request.sampleAcceptance.video.sha256,'66f176248d2fbfc41445fa8eb56451a5d04e0f0d07333e6bea3a6bc8d60d1155');
const scope=write('用户整片候选范围.v1.json',{schemaVersion:'episode-native-v2-review-authorization/v1',...identity,
 scope:{reviewOnly:true,preserveAllOriginalSpeech:true,useExistingPaperVideos:true,allowPendingReviewInCandidate:true,formalAuthorized:false,publishAuthorized:false},
 quotedUserMessage:request.quotedUserMessage,sourceMessage:ref(source),recordedAt:new Date().toISOString(),
 acceptedSample:request.sampleAcceptance,newFullEpisodeAcceptance:false,humanFullWatchConfirmed:false,dynamicAccepted:false,audioAccepted:false,
 scopeNote:'用户批准R3修订小样并要求有音效整片及封面发布包；新全片尚未完整观看验收，不代表外部发布。'});
const intake=write('既有来源复用候选.v1.json',{...previousIntake,...identity,assets,supplementalIntake:ref(supplementalPath),reusedFrom:oldInput.artifacts.mediaIntake,reusedAt:new Date().toISOString(),
 reuseBoundary:'源媒体、字幕、纸艺、声音素材既有字节与来源复用；本轮闭包绑定真实重测媒体，未补造历史或整片人审。'});
const artifacts={...oldInput.artifacts,runtimePlan:ref(runtimePath),mediaIntake:ref(intake),userScope:ref(scope)};
const input=write('first-candidate-input.v1.json',{...oldInput,...identity,executionGroupId:'codex-small-business-ai-agility-motion-full-r4',artifacts});
const job={...oldJob,title:'小公司AI落地_V9_R4_全长有音效观看候选',
 knowledgeContext:{taskId:'small-business-ai-agility-motion-full-r4-20261017',contextPath:'small-business-ai-agility-motion-full-r4-20261017/context.json'},
 remotion:{...oldJob.remotion,entry:'src/small-business-ai-agility-r4-final/index.tsx',compositionWithSfx:'SmallBusinessAgilityR4Final-WithSfx',compositionWithoutSfx:'SmallBusinessAgilityR4Final-NoSfx'},
 director:{...oldJob.director,artifacts},productionGate:{...oldJob.productionGate,revisionId,firstCandidateInput:ref(input),localChatPreviewAuthorization:null},
 preview:{output:'edit/20261017_small_business_ai_agility/09_动效优化正片R4/小公司AI落地_V9_R4_1080p_有音效_受控原件.mp4',
 renderSettings:{concurrency:1,timeoutInMilliseconds:120000,scale:1}},
 preparationNote:'沿最新当前聊天授权，将已认可23秒视觉方向应用完整观看候选并配齐声音；小样验收仅绑定原23秒文件，新全片不预先标记验收或发布。'};
write('production-job.full-candidate.v1.json',job);
write('输入适配检查.v1.json',{checkedAt:new Date().toISOString(),runtime:ref(runtimePath),sourceBaseline:oldInput.artifacts.runtimePlan,
 originalMediaCaptionsVoiceFontsPaperCameraUnchanged:true,sourceDurationFrames:4126,outputDurationFrames:4126,
 sampleAcceptanceVideo:ref(resolve(root,request.sampleAcceptance.video.path)),sampleAcceptanceScope:'23-second-sample-only',
 oldMediaIntake:oldInput.artifacts.mediaIntake,originalSourceSpeechPreserved:true,
 attachedSfxCount:runtime.sfx.length,humanFullWatchConfirmed:false,renderInvoked:false});
write('组件冻结清单.v1.json',{frozenAt:new Date().toISOString(),files:['index.tsx','Composition.tsx','sample-plan.snapshot.json','full-cues.v1.json','tsconfig.json'].map(n=>ref(resolve(component,n))),
 frozenFor:'本期R4全长有音效候选，受控入口执行前后再次复检',renderInvoked:false});
console.log(JSON.stringify({prepared:true,job:ref(resolve(out,'production-job.full-candidate.v1.json')),renderInvoked:false}));
