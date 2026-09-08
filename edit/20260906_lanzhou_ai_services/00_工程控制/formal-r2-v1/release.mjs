import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT,CONTROL,OUTPUT,FINAL,ORIGINAL,hashFile,readJson,write,runLog,verifyJob,knowledge} from './formal-core.mjs';

const episode=path.join(ROOT,'edit/20260906_lanzhou_ai_services');
const pack=path.join(episode,'08_发布包/formal-r2-v1');
const qaDir=path.join(ROOT,OUTPUT,'qa');
const record=file=>({path:file,sha256:hashFile(file),bytes:fs.statSync(file).size});
const jobPath=path.join(ROOT,CONTROL,'job.v2.json'),job=readJson(jobPath);
verifyJob(job);
const context=readJson(path.join(ROOT,CONTROL,'context-v2/binding.v1.json'));
const qa=readJson(path.join(qaDir,'machine-qa.v1.json'));
const visual=readJson(path.join(qaDir,'visual-review.v1.json'));
const video=path.join(ROOT,FINAL),videoSha=hashFile(video);
assert.equal(qa.video.sha256,videoSha);
assert(Object.values(qa.checks).every(Boolean));
assert.equal(visual.videoSha256,videoSha);
assert.equal(visual.p0,0);assert.equal(visual.p1,0);
assert.equal(visual.reviewedFrameCount,24);
const frame=Number(process.argv[2]);
assert([600,1600,6360].includes(frame),'封面只能使用已实际复核的本人画面');
const copyInputPath=path.join(pack,'copy_review.v2.json');
const copyInput=readJson(copyInputPath);
assert.equal(copyInput.status,'passed');assert.equal(copyInput.scores.fact_fidelity,10);
assert.equal(copyInput.draft.sha256,hashFile(copyInput.draft.path));
for(const s of Object.values(copyInput.skills))assert.equal(s.sha256,hashFile(s.path));
write(path.join(pack,'knowledge-before-release.v1.json'),knowledge(context));
const screenshot=path.join(pack,'推荐人物帧_本条正式成片.png');
runLog('cover-frame','/opt/homebrew/Cellar/ffmpeg/8.1.2_1/bin/ffmpeg',[
  '-v','error','-n','-ss',(frame/30).toFixed(9),'-i',video,'-frames:v','1','-update','1',screenshot],pack);
const screenshotSource={schemaVersion:1,video:record(video),screenshot:record(screenshot),frameIndex:frame,
  timeSeconds:frame/30,sourceKind:'this-formal-video-host-frame',notAiGenerated:true,fullFrameUnretouched:true,
  parentVisualReview:'人工智能实际查看最终抽帧，仅作为人物素材，不是已制作封面。',
  background:'本条实拍室内环境，浅色软包与靠枕、深色木饰面和暖色室内光；不表述为客户现场或企业办公室。'};
write(path.join(pack,'screenshot-source.v1.json'),screenshotSource);
const coverOld=path.join(pack,'cover-prompt.v1.txt');
const coverNew=path.join(pack,'cover-prompt.v2.txt');
const old=fs.readFileSync(coverOld,'utf8');
const bodyStart=old.indexOf('制作一张 **3:4');assert(bodyStart>0);
const oldBackground='本条正式成片截图中实际可见的原拍摄环境，待父任务绑定截图后确认；不另造客户现场、政府场景、企业后台或合作关系';
assert(old.includes(oldBackground));
fs.writeFileSync(coverNew,`唯一人物素材：${screenshot}\n来自本条正式成片：${video}\n提取时间：${(frame/30).toFixed(6)}秒，第${frame}帧（从0计数）。来源与哈希见screenshot-source.v1.json。只提供真实截图与合成提示词，本项目未生成封面。\n\n`+
  old.slice(bodyStart).replace(oldBackground,'本条真人截图中实际可见的原拍摄室内环境：浅色软包与靠枕、深色木饰面和暖色室内光；不另造客户现场、政府场景、企业后台或合作关系'),{flag:'wx'});
const copyReview=copyInput;
copyReview.revision=3;
copyReview.supersedes={...record(copyInputPath),history_preserved:true,reason:'从本条正式MP4绑定真实人物截图，不改可见发布文字。'};
copyReview.reviewed_at=new Date().toISOString();
copyReview.additional_reviewed_texts=[{...record(coverNew),use:'沿用原审查全文，只绑定真实人物来源、时间与实际室内环境；可见标题、结构文字未改变。'}];
copyReview.execution_order.push('v3从本条正式文件提取已复核人物帧，绑定真实来源与室内背景；复核可见标题和流程文字未变');
copyReview.fact_comparison_notes=copyReview.fact_comparison_notes.filter(n=>!n.includes('source待父任务绑定'));
copyReview.fact_comparison_notes.push('v3已绑定本条正式成片的未修饰截图；只更新制作来源和实际室内背景，未新增客户、政府或业务事实。');
copyReview.cover_binding={status:'source-bound-cover-not-generated',prompt:record(coverNew),source:screenshotSource,
  finalCoverImageUserReviewConfirmed:false};
copyReview.parent_binding_review={previousReview:record(path.join(pack,'copy_review.v2.json')),
  screenshotSource:record(path.join(pack,'screenshot-source.v1.json')),
  visibleWordsUnchanged:true,newBusinessFacts:false,sourceOnlyEditsReviewed:true,
  coverImageGenerated:false,userLanguageApproval:null,userFullFilmReviewConfirmed:false};
write(path.join(pack,'copy_review.v3.json'),copyReview);

const canonicalPath=path.join(episode,'09_实录与字幕/canonical-spoken.v1.json');
const bilingualPath=path.join(episode,'09_实录与字幕/actual-bilingual.v1.json');
const captionsPath=path.join(ROOT,'remotion/public/lanzhou-services-candidate-r2/captions.json');
const canonical=readJson(canonicalPath),bilingual=readJson(bilingualPath),captions=readJson(captionsPath);
assert.equal(captions.length,57);assert.equal(bilingual.captions.length,57);
for(const c of captions){
  const original=bilingual.captions.find(s=>s.id===c.sourceCaptionId);
  const spoken=canonical.captions.find(s=>s.id===c.sourceCaptionId);
  assert(original&&spoken);assert.equal(c.zh,spoken.zh);assert.equal(c.zh,original.zh);assert.equal(c.en,original.en);
  assert.equal(c.sourceStartMs,original.startMs);assert.equal(c.sourceEndMs,original.endMs);
  const shift=original.id==='c001'?0:244;
  assert.equal(c.timeTransform.offsetFrames,shift);assert.equal(c.timeTransform.kind,'translation-only');
}
const spoken={schemaVersion:1,canonicalSource:'recorded-audio',scriptRole:'comparison-only',captionTextPolicy:'spoken-verbatim',
  englishTranslationSource:'canonical-spoken-chinese',source:record(path.join(ROOT,ORIGINAL)),canonical:record(canonicalPath),
  bilingual:record(bilingualPath),renderedCaptions:record(captionsPath),captionPages:57,formalEqualsAcceptedR2:true,
  compliance:{status:'accepted-r2-unchanged-with-unresolved-asr',strictGlobalSpokenValidatorPassed:false,
    reason:'保持用户确认的R2字幕。13项历史ASR待听辨项未在本轮逐项解决，不能把结构一致性冒称声音逐字已人工核验。'},
  unresolvedReview:record(path.join(episode,'09_实录与字幕/transcription-review.v1.json')),unresolvedCount:13,
  postR2TextEdits:[],humanFullAudioReviewPerformedByAssistant:false};
write(path.join(pack,'spoken-source-policy.v1.json'),spoken);
const linked=path.join(pack,path.basename(video));assert(!fs.existsSync(linked));fs.linkSync(video,linked);
assert.equal(fs.statSync(linked).ino,fs.statSync(video).ino);assert.equal(hashFile(linked),videoSha);
const release={schemaVersion:1,releaseId:'20260908_lanzhou_ai_services_v91_r2_v1',episodeId:job.episodeId,
  status:'ready-for-user-review',createdAt:new Date().toISOString(),scope:job.scope,video:record(video),
  desktopEntry:'/Users/pc/Desktop/口播素材/2026-09-06_在兰州把企业AI服务做下去/08_发布包/formal-r2-v1',
  packageVideo:{...record(linked),samePhysicalFile:true,device:fs.statSync(video).dev,inode:fs.statSync(video).ino},
  productionJob:record(jobPath),renderReceipt:record(path.join(ROOT,OUTPUT,'render-receipt.json')),
  userAuthorization:record(path.join(ROOT,CONTROL,'user-authorization.evidence.json')),
  machineQa:record(path.join(qaDir,'machine-qa.v1.json')),independentVisualQa:record(path.join(qaDir,'visual-review.v1.json')),
  screenshotSource:record(path.join(pack,'screenshot-source.v1.json')),screenshot:record(screenshot),coverPrompt:record(coverNew),
  publishingText:record(path.join(pack,'publishing-copy.v1.txt')),copyReview:record(path.join(pack,'copy_review.v3.json')),
  spokenSource:record(path.join(pack,'spoken-source-policy.v1.json')),
  media:{width:qa.video.width,height:qa.video.height,fps:30,frames:qa.video.frames,duration:qa.video.duration,pixelFormat:qa.video.pixFmt,
    loudnessLUFS:qa.loudnessLUFS,truePeakDbFS:qa.truePeakDbFS},
  sfx:{count:26,relativeMixUnchangedFromR2:true,finalGainDb:-.3,hostVoiceRetained:true,newsNativeAudioRetained:true,paperCount:5,paperNativeAudioRetained:true},
  inheritedExceptions:job.acceptedPaperExceptions,unresolvedAsrCount:13,
  productionGates:{scopedFormalAuthorized:true,currentSharedPostshootValidatorPassed:false,
    genericV2FormalReleaseValidatorPassed:false,knowledgeContextValidAtExecution:true,fullFinalUserReviewConfirmed:false},
  fullPackageFilesPresent:true,userLanguageApprovalForNewPackaging:null,coverImageGenerated:false,
  publicPostingAuthorized:false,publiclyPublished:false,platformReviewOrRecommendationGuaranteed:false};
write(path.join(pack,'release.v1.json'),release);
const registry=path.join(ROOT,'workflow/releases/20260908_lanzhou_ai_services_v91_r2_v1.json');
write(registry,{schemaVersion:1,status:release.status,releaseId:release.releaseId,scope:release.scope,
  manifest:record(path.join(pack,'release.v1.json')),video:release.video,publiclyPublished:false});
fs.writeFileSync(path.join(pack,'先看这里_成片与发布说明.txt'),`在兰州，把企业AI服务做下去\n\n正式视频：${path.basename(video)}\n规格：1920×1080，30帧，4分39.767秒。\n\n本次保留你确认的画面、字幕、5段纸艺素材和原声；保留26处修订音效卡点，最终混音整体降低0.3分贝，实测响度${qa.loudnessLUFS} LUFS，真峰值${qa.truePeakDbFS} dBFS。\n\n发片所需文件：\n1. 上述MP4正式候选。\n2. 推荐人物帧_本条正式成片.png。\n3. cover-prompt.v2.txt：带本条真实人物来源的封面提示词。\n4. publishing-copy.v1.txt：主标题、两条备选、发布文案和话题。\n5. release.v1.json、质检文件与SHA256清单：本条交付证据。\n\n封面图片未自动生成，必须保持真实人物。发布文字的机器朗读检查仅为技术材料，不得插入成片。旧v1/v2审稿文件保留历史，以release.v1.json指向的版本为准。\n\n状态：正式候选与配套文件已准备，等待你完整观看最终文件；尚未公开发布。\n\n保留事项：本轮没有改动R2的13项历史ASR待听辨记录，也没有重做已同意保留的5段纸艺源片瑕疵；这些不是本轮新出现的问题，不把用户整体确认写成逐项人工核验。通用导演实录重绑门未通过，本条按单次直接授权隔离输出，不作为新片通用豁免。\n`,{flag:'wx'});
verifyJob(job);assert.equal(hashFile(video),videoSha);
write(path.join(pack,'knowledge-after-release.v1.json'),knowledge(context));
const include=fs.readdirSync(pack).filter(n=>/\.(json|txt|png|mp4)$/.test(n)&&!n.includes('.stdout.')&&!n.includes('.stderr.')).sort();
const artifacts=include.map(n=>record(path.join(pack,n)));
for(const item of artifacts)assert.equal(hashFile(item.path),item.sha256);
write(path.join(pack,'delivery-checksums.v1.json'),{schemaVersion:1,status:'files-and-bindings-verified',at:new Date().toISOString(),artifacts,
  finalStatus:'ready-for-user-review',notPublished:true});
console.log(JSON.stringify({video,sha256:videoSha,pack,releaseId:release.releaseId,status:release.status}));
