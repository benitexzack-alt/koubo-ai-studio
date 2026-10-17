// 本期内部预览的真实输入适配。保留原件，不渲染、不签名、不写未来验收。
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {paperMediaTools} from '../../../../skills/koubo-remotion-director/scripts/paper-asset-intake-media.mjs';

const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, '../../../..');
const base = resolve(root, 'edit/20261017_small_business_ai_agility');
const pub = resolve(base, '05_剪辑工程/public');
const identity = {episodeId:'small-business-ai-agility-20261017',taskId:'SMALL_BUSINESS_AI_AGILITY_20261017',revisionId:'small-business-ai-agility-v9-video-candidate-r2-20261017'};
const jobId = '20261017_small_business_ai_agility_v9_candidate';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const ref = p => ({path:relative(root, p),sha256:sha(p)});
const write = (name, body) => {const p=resolve(out,name);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,JSON.stringify(body,null,2)+'\n',{flag:'wx'});return p;};
const now = () => new Date().toISOString();
const normal = x => x.replace(/[\s，。！？、；：…“”‘’「」『』（）()"'!?;:,]/gu,'');
assert(!existsSync(resolve(out,'production-job.first-candidate.v1.json')), '本期输入已有job，禁止重建覆盖');
const runtimePath=resolve(base,'05_剪辑工程/runtime-plan.v1.json');
const runtime=read(runtimePath);
assert.deepEqual(runtime,read(resolve(root,'remotion/src/small-business-ai-agility-20261017/runtime-plan.snapshot.json')));
const source=resolve(base,'01_素材投放区/01_口播原片/copy_FDA786EB-B266-4B5A-9CDA-757475BAC1C6.MOV');
const srtPath=resolve(base,'04_实录与字幕/用户提供_10月17日_原始.srt');
const canonicalPath=resolve(base,'04_实录与字幕/canonical-spoken.final-candidate.v1.json');
const layoutPath=resolve(base,'04_实录与字幕/captions.bilingual.final-candidate.v1.json');
const changesPath=resolve(base,'04_实录与字幕/captions.layout-change.v1.json');
const canonical=read(canonicalPath),layout=read(layoutPath),changes=read(changesPath);
assert.equal(sha(srtPath),'fafd2f37e99c27f9e0c8baeb7e4bfefcb123a04cfc02a0b89efc84c2b1048e45');
assert.equal(canonical.segments.length,81);assert.equal(layout.pages.length,78);
const segments=layout.pages.map((page,i)=>{
  const ids=page.id.split('_');
  const originals=ids.map(id=>canonical.segments.find(s=>s.id===id));
  assert(originals.every(Boolean));
  const text=originals.map(s=>s.text).join('');
  assert.equal(normal(text),normal(page.zh));
  assert.equal(page.start,originals[0].start);assert.equal(page.end,originals.at(-1).end);
  assert.equal(normal(runtime.captions[i].chinese),normal(text));
  assert.equal(runtime.captions[i].english,page.en);
  assert.equal(runtime.captions[i].from,Math.round(page.start*30));
  assert.equal(runtime.captions[i].to,Math.round(page.end*30));
  return {id:page.id,start:page.start,end:page.end,text,originalSourceSegmentIds:ids};
});
assert.deepEqual(segments.flatMap(s=>s.originalSourceSegmentIds),canonical.segments.map(s=>s.id));
assert.equal(segments.map(s=>s.text).join(''),canonical.segments.map(s=>s.text).join(''));
assert.deepEqual(changes.changes.filter(c=>c.type==='merge-cross-word-pages').map(c=>c.resultPageId),['S023_S024','S073_S074','S080_S081']);
const raw78=write('实录原文分页派生视图.v1.json',{
  schemaVersion:'derived-user-srt-pagination-view/v1',isOriginalAsr:false,
  sourceType:'derived-user-srt-pagination-view',source:ref(srtPath),canonicalSourceRecord:ref(canonicalPath),
  layoutChanges:ref(changesPath),layout:ref(layoutPath),segments,
  noWordsChanged:true,noWordsRemoved:true,noOrderChanged:true,fullAudioHumanReview:false,
  note:'此文件是原81段的78组画面分页视图，不是原始ASR；原文逐字串联，句号只在显示层。'
});
const spoken=write('实录正文分页候选.v1.json',{
  ...identity,canonicalSource:'recorded-audio',scriptRole:'comparison-only',
  sourceType:'derived-user-srt-pagination-view',isOriginalAsr:false,rawSource:relative(root,raw78),rawSha256:sha(raw78),
  originalSource:ref(canonicalPath),sourceSrt:ref(srtPath),segments,
  fullAudioHumanReview:false,subtitleUserConfirmed:false
});
const oldRebindPath=resolve(base,'05_剪辑工程/实录导演重绑.v1.json');
const oldRebind=read(oldRebindPath);
const semanticBeats=oldRebind.beats.map(beat=>{
  const mapped=segments.filter(s=>s.originalSourceSegmentIds.some(id=>beat.srtIds.includes(id)));
  assert.deepEqual(mapped.flatMap(s=>s.originalSourceSegmentIds),beat.srtIds);
  assert.equal(normal(mapped.map(s=>s.text).join('')),normal(beat.quote));
  return {beatId:beat.beatId,mainVisual:beat.mainVisual,sourceSegmentIds:mapped.map(s=>s.id),
    originalSourceSegmentIds:beat.srtIds,rawSpokenText:mapped.map(s=>s.text).join(''),
    sourceSpeechPreserved:true,scriptRole:'comparison-only',start:beat.start,end:beat.end,purpose:beat.purpose};
});
assert.deepEqual(semanticBeats.flatMap(b=>b.sourceSegmentIds),segments.map(s=>s.id));
const rebind=write('实录分页重绑.v1.json',{
  ...identity,canonicalSource:'recorded-audio',scriptRole:'comparison-only',fps:30,durationInFrames:4126,
  originalRebind:ref(oldRebindPath),spokenTimeline:ref(spoken),semanticBeats,
  sourceSpeechPreserved:true,fullAudioHumanReview:false,paperVideoWindow:runtime.mediaSlots[0].window
});
const paperSource=resolve(base,'01_素材投放区/04_纸艺视频/P01_用户提供_8秒.mp4');
assert.equal(sha(paperSource),'d4a4a213bcad26e7708ac7dbd7028dca37162c94773228cd9b0a10e57b1ad03a');
assert.equal(sha(runtimePath),'a7a6a0fd39e93828671ee0326b65ec541787853040de46ee62cc70791c917581');
const chatPath=resolve(out,'本轮视频候选导出请求.v1.json');
assert.equal(read(chatPath).quotedUserMessage,'好了，这个已经做好了，赶紧抓紧去剪成片');
const scope=write('用户预览范围.v1.json',{
  schemaVersion:'episode-native-v2-review-authorization/v1',...identity,
  scope:{reviewOnly:true,preserveAllOriginalSpeech:true,useExistingPaperVideos:true,
    allowPendingReviewInCandidate:true,formalAuthorized:false,publishAuthorized:false},
  quotedUserMessage:'好了，这个已经做好了，赶紧抓紧去剪成片',sourceMessage:ref(chatPath),recordedAt:now(),
  humanFullWatchConfirmed:false,dynamicAccepted:false,audioAccepted:false
});
const cuesPath=resolve(base,'03_导演规划/director-cues.v2.json'),cues=read(cuesPath);
const facts=write('事实待决.v1.json',{
  schemaVersion:'episode-native-v2-fact-review-snapshot/v1',...identity,
  sourceDirector:ref(cuesPath),decisionItems:cues.factChecks.map(f=>({id:f.id,issue:f.sourceRequirement,beatId:f.beatId,status:'pending'})),
  factsResolved:false,formalAuthorized:false,publishAuthorized:false
});
const provenance=write('本期来源绑定.v1.json',{
  schemaVersion:'episode-native-v2-source-provenance/v1',...identity,
  userScope:ref(scope),source:ref(source),sourceSrt:ref(srtPath),submittedVideo:ref(paperSource),paperIntegration:ref(resolve(base,'06_预览与质检/纸艺接入/纸艺接入记录.v1.json')),
  runtimePlan:ref(runtimePath),soundPlan:ref(resolve(base,'05_剪辑工程/声音候选与瞬态.v1.json')),
  humanAccepted:false,rightsClearedForPublication:false,createdAt:now()
});
const tools=paperMediaTools(['ffmpeg','ffprobe']);
const run=(tool,args)=>{const r=spawnSync(tool.path,args,{encoding:'utf8',timeout:600000,maxBuffer:12*1024*1024});assert.equal(r.status,0,r.stderr||String(r.error));return r;};
const pcm=p=>run(tools.ffmpeg,['-nostdin','-v','error','-xerror','-i',p,'-map','0:a:0','-c:a','pcm_s16le','-f','hash','-hash','sha256','-']).stdout.trim();
const voice=resolve(pub,runtime.voice.src),sourcePcm=pcm(source),voicePcm=pcm(voice);assert.equal(sourcePcm,voicePcm);
const preservation=write('完整原声保全.v1.json',{
  source:relative(root,source),preparedAudio:relative(root,voice),equal:true,noTrimming:true,noSpeedChange:true,
  originalStartSeconds:0,preparedStartSeconds:0,sourceDecodedPcmHash:sourcePcm,preparedDecodedPcmHash:voicePcm,
  tool:tools.ffmpeg,checkedAt:now(),humanListeningPerformed:false
});
const assets=[];
function add(id,kind,original,render,type){
  if(assets.some(a=>a.renderAsset.path===relative(root,render)))return;
  const before=sha(render);let media={type},decodeReceipt=null;
  if(type==='audio'||type==='video'){
    const pr=JSON.parse(run(tools.ffprobe,['-v','error','-show_streams','-show_format','-of','json',render]).stdout);
    const stream=pr.streams.find(s=>s.codec_type===type);assert(stream);
    media.durationSeconds=Number(stream.duration??pr.format.duration);
    if(type==='video'){const[n,d]=stream.avg_frame_rate.split('/').map(Number);media={...media,fps:n/d,width:stream.width,height:stream.height};}
    const argv=['-nostdin','-v','error','-xerror','-i',render,'-map',type==='video'?'0:v:0':'0:a:0',...(type==='video'?['-map','0:a?']:[]),'-f','null','-'];
    const result=run(tools.ffmpeg,argv);assert.equal(sha(render),before);
    decodeReceipt=ref(write(`完整解码/${id}.json`,{source:ref(render),command:[tools.ffmpeg.path,...argv],exitCode:result.status,
      fullDecode:true,tool:tools.ffmpeg,stderr:result.stderr,checkedAt:now(),humanListeningPerformed:false}));
  }else if(type==='image'){run(tools.ffmpeg,['-nostdin','-v','error','-xerror','-i',render,'-frames:v','1','-f','null','-']);}
  assets.push({id,kind,source:ref(original),renderAsset:ref(render),sourceReceipt:ref(provenance),media,decodeReceipt,reviewAccepted:false});
  console.log('已实测解码/绑定',id,type);
}
add('recorded-source','recorded-source',source,source,'video');
add('host','host',source,resolve(pub,runtime.host.src),'video');
add('voice','voice',source,voice,'audio');
add('P01','paper',paperSource,resolve(pub,runtime.mediaSlots[0].asset.src),'video');
add('P01-native-audio','paper-native-audio',paperSource,resolve(pub,runtime.mediaSlots[0].asset.nativeAudio.src),'audio');
for(const [name,src]of Object.entries(runtime.fonts))add(`font-${name}`,'font',resolve(pub,src),resolve(pub,src),'font');
const sound=read(resolve(base,'05_剪辑工程/声音候选与瞬态.v1.json'));
for(const cue of runtime.sfx){const origin=sound.cues.find(c=>c.id===cue.id);assert(origin);assert.equal(sha(resolve(root,origin.source)),sha(resolve(pub,cue.src)));add(cue.id,'sfx',resolve(root,origin.source),resolve(pub,cue.src),'audio');}
const intake=write('原生素材入库候选.v1.json',{
  schemaVersion:'episode-native-v2-media-intake/v1',...identity,source:ref(source),renderProxy:ref(resolve(pub,runtime.host.src)),
  sourcePreservationReceipt:ref(preservation),assets,createdAt:now(),humanFullWatchConfirmed:false,formalAuthorized:false,publishAuthorized:false
});
const artifacts={directorCues:ref(cuesPath),runtimePlan:ref(runtimePath),spokenTimeline:ref(spoken),postshootRebind:ref(rebind),mediaIntake:ref(intake),factReview:ref(facts),userScope:ref(scope)};
const input=write('first-candidate-input.v1.json',{
  schema:'director-first-candidate-input/v1',inputFormat:'director-cues-v2-surface-bound',state:'inputs-ready-for-first-candidate',...identity,jobId,
  executionGroupId:'codex-small-business-ai-agility-video-candidate-r2',authorizedUserId:'current-chat-human-user',
  identityScopeNote:'仅为当前聊天人类用户的作用域标识，不是外部实名身份或独立签名。',
  profile:ref(resolve(root,'workflow/active-director-profile.v1.json')),
  style:ref(resolve(root,'workflow/style-library/paper-super-individual-20260829-v1.json')),artifacts,
  policy:{incidentPreventionVersion:'1'},productionEligible:false,formal:{enabled:false},candidateAccepted:false,
  userPreviewApproved:false,fullWatchConfirmed:false,publishAuthorized:false,candidate:null,candidateAcceptance:null,technicalQa:null,handoff:null
});
write('production-job.first-candidate.v1.json',{
  schemaVersion:1,jobId,videoId:identity.episodeId,title:'小公司AI组织灵敏性_纸艺视频完整观看候选',productionState:'input-prepared-awaiting-controlled-preflight',productionEligible:false,
  productionProfile:{id:'v9-semantic-direction-sfx',version:'V9'},baseline:{path:'workflow/production-baseline.v1.json'},
  experiment:{id:'v8-semantic-continuity-sfx',status:'candidate-preview-required',userPreviewApproved:false},
  knowledgeContext:{taskId:'small-business-ai-agility-video-candidate-r2-20261017',contextPath:'small-business-ai-agility-video-candidate-r2-20261017/context.json'},
  inputs:{source:relative(root,source),renderProxy:relative(root,resolve(pub,runtime.host.src))},
  remotion:{root:'remotion',entry:'src/small-business-ai-agility-20261017/index.tsx',publicDir:relative(root,pub),
    compositionWithSfx:'SmallBusinessAiAgility20261017-WithSfx',compositionWithoutSfx:'SmallBusinessAiAgility20261017-NoSfx',width:1920,height:1080,fps:30,durationSeconds:4126/30},
  director:{required:true,taskId:identity.taskId,profileId:'paper-editorial-director-v9',profileVersion:'9.1.0',phase:'post-shoot',paperRequired:true,fallback:'blocked',artifacts,inputFormat:'director-cues-v2-surface-bound'},
  productionGate:{schema:'director-production-entry-binding/v2',revisionId:identity.revisionId,state:'first-candidate-preview-required',productionEligible:false,userPreviewApproved:false,formalEnabled:false,
    firstCandidateInput:ref(input),firstCandidateAuthorization:null,freezeReceipt:null,previewAuthorizationMode:'small-business-ai-agility-current-chat-review/v1',localChatPreviewAuthorization:null},
  preview:{output:relative(root,resolve(out,'小公司AI_V9视频候选R2_1080p_有音效.mp4')),renderSettings:{concurrency:1,timeoutInMilliseconds:120000,scale:1}},
  formal:{enabled:false},publishAuthorized:false,preparationNote:'仅本期用户提供8秒纸艺并要求继续剪辑的聊天授权；完整1080p观看候选，保留原声和实录字幕，不等于全片验收或发布。'
});
write('输入适配实测.v1.json',{checkedAt:now(),originalSrt:ref(srtPath),sourceCount:81,paginationCount:78,
  exactTextConcatenation:true,allSourceSegmentsCoveredInOrder:true,semanticBeatCount:28,
  originalAudioDecodedPcmPreserved:true,assets:assets.length,renderInvoked:false,formalAccepted:false});
console.log('本期真实输入已准备，未渲染。');

const fullJob=read(resolve(out,'production-job.first-candidate.v1.json'));
const noSfx=structuredClone(fullJob);
noSfx.title='小公司AI_V9视频候选R2_前35秒无附加音效对照';
noSfx.preview.output=relative(root,resolve(out,'小公司AI_V9视频候选R2_前35秒720p_无附加音效.mp4'));
noSfx.preview.renderSettings={concurrency:1,timeoutInMilliseconds:120000,scale:2/3,frames:{start:0,end:1049}};
write('production-job.no-sfx-first35s.v1.json',noSfx);
write('渲染后核对计划.v1.json',{
  state:'pending-render',renderInvoked:false,
  originalSpeechMustRemain:true,addedSfxContrast:'NoSfx仅去附加音效，保留本条真实口播。',
  postRenderAudioChecks:{windows:5,measureActualLag:true,assumePreviousLag:false,
    historicalR1Observation:'R1曾测得AAC固定+42.6875ms，仅为本次测量线索，不能套用。',
    correctiveCopy:'若本次实测需时间戳对齐，仅生成无损观看副本，保留受控原件。'},
  humanFullWatchConfirmed:false,formalAuthorized:false,publishAuthorized:false
});
