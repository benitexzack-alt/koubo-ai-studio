import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = '/Users/pc/Documents/口播';
const oldDir = 'edit/20261006_ten_ai_businesses/12_Shotcraft实录扫描';
const newDir = 'edit/20261006_ten_ai_businesses/12_Shotcraft实录扫描_R2';
const oldCaption = 'edit/20261006_ten_ai_businesses/08_实录与字幕/字幕候选_R1/captions.r1.json';
const newCaption = 'edit/20261006_ten_ai_businesses/08_实录与字幕/字幕候选_R2/captions.r2.json';
const newTranscript = 'edit/20261006_ten_ai_businesses/08_实录与字幕/字幕候选_R2/transcript.r2.json';
const oldTranscript = 'edit/20261006_ten_ai_businesses/08_实录与字幕/字幕候选_R1/transcript.r1.json';
const policyPath = 'edit/20261006_ten_ai_businesses/08_实录与字幕/字幕候选_R2/spoken-source-policy.r2.json';
const abs = file => path.join(root,file);
const read = file => JSON.parse(fs.readFileSync(abs(file),'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(abs(file))).digest('hex');
const binding = file => ({path:file,sha256:sha(file)});
const write = (file, body) => fs.writeFileSync(abs(file),JSON.stringify(body,null,2)+'\n',{flag:'wx'});
const check = (value,message) => {if(!value)throw new Error(message);};
const equal = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const run = args => {
  const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});
  check(result.status===0,`子校验失败：${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
};

const old = read(oldCaption);
const current = read(newCaption);
const oldWords = read(oldTranscript).words;
const transcript = read(newTranscript);
const policy = read(policyPath);
check(current.length===87 && old.length===87,'字幕条数不符');
check(transcript.words.length===1097 && oldWords.length===1097,'词数不符');
const changedCaptionIds=current.filter((item,index)=>!equal(item,old[index])).map(item=>item.id);
check(equal(changedCaptionIds,['C087']),'非尾句字幕出现变动');
check(current.at(-1).zh==='我是超哥，在兰州，AI创业。','尾句不符用户核对');
check(current.at(-1).en==="I'm Chao Ge, starting an AI business in Lanzhou.",'尾句英文不符');
const wordChanges=[];
transcript.words.forEach((word,index)=>{
  const previous=oldWords[index];
  for(const key of ['start','end','segmentId','segmentWordIndex','sourceWordIndex','raw_text','word'])check(word[key]===previous[key],`原词索引/时间漂移 ${index}:${key}`);
  if(word.text!==previous.text)wordChanges.push(index);
});
check(equal(wordChanges,[1094,1095,1096]),'尾句之外存在词级变动');
check(current[6].zh.includes('95%') && current[20].zh.includes('89%'),'两个百分比必须保留');
const userConfirmed=policy.verification.corrections.filter(item=>item.userConfirmed);
check(userConfirmed.length===1 && userConfirmed[0].segmentId===135,'仅尾句允许用户确认');
check(policy.verification.humanListeningPerformed===false && policy.review.finalHumanAcceptance===false,'不得声明整体听审/验收');
const spokenOutput=run(['tools/check-spoken-source-policy.mjs',newTranscript,newCaption,policyPath]);

const oldSnapshot=read(`${oldDir}/实录字幕扫描快照.r1.json`);
const snapshot={...oldSnapshot,
  sourceCaptions:binding(newCaption),
  reviewStatus:'candidate-tail-user-confirmed-only',
  notes:[
    '仅将R2字幕候选start/end秒转换为startMs/endMs毫秒；其中文、英文和顺序逐项保持。',
    '相对于R1唯一内容差异为C087尾句，用户本轮明确核对AI创业；其余疑词仍为原候选，未整体听审。',
  ],
  currentUserConfirmation:policy.currentUserConfirmation,
  captions:current.map(({id,start,end,zh,en})=>({id,startMs:start*1000,endMs:end*1000,zh,en})),
};
write(`${newDir}/实录字幕扫描快照.r2.json`,snapshot);
const request=read(`${oldDir}/auto-match-request.r1.json`);
request.revisionId='ten-ai-businesses-shotcraft-scan-r2';
request.captions=binding(`${newDir}/实录字幕扫描快照.r2.json`);
request.provenance.captionCandidate=binding(newCaption);
request.provenance.previousScanRequest=binding(`${oldDir}/auto-match-request.r1.json`);
request.provenance.captionReviewStatus='candidate-tail-user-confirmed-only';
request.provenance.currentUserConfirmation=policy.currentUserConfirmation;
request.provenance.changedCaptionIds=changedCaptionIds;
request.provenance.runtimeAtScan=binding('remotion/src/ten-ai-businesses-final-r1/runtime-plan.r1.json');
const runtime=read(request.provenance.runtimeAtScan.path);
const projection={opening:runtime.opening,motions:runtime.motions,cameras:runtime.cameras,paperClips:runtime.paperClips};
request.provenance.visualProjectionSha256=crypto.createHash('sha256').update(JSON.stringify(projection)).digest('hex');
request.provenance.visualProjectionScope=['opening','motions','cameras','paperClips'];
request.provenance.visualProjectionNote='只读取本期当前布局形成哈希，未修改任何runtime或全局动效；本次字幕尾句重绑不增删镜头或效果。';
const byId=new Map(current.map(item=>[item.id,item]));
request.beats.forEach(beat=>{
  beat.quote=beat.sourceCaptionIds.map(id=>byId.get(id).zh).join('');
  beat.purpose=beat.purpose.replace('末句识别疑词待用户确认','末句AI创业已经用户本轮核对，整体字幕仍待听审');
});
check(request.beats.at(-1).quote===current.at(-1).zh,'C087未映射至尾beat');
const oldRequest=read(`${oldDir}/auto-match-request.r1.json`);
request.beats.forEach((beat,index)=>{
  for(const key of ['beatId','mainVisual','frames','semanticIntents','existingMotionIds','region','protectedRegions'])check(equal(beat[key],oldRequest.beats[index][key]),`导演布局变化:${beat.beatId}:${key}`);
});
write(`${newDir}/auto-match-request.r2.json`,request);
const matcherOutput=run(['skills/koubo-shotcraft-library/scripts/match-director-effects.mjs',
  '--request',`${newDir}/auto-match-request.r2.json`,
  '--selection',`${newDir}/director-selection.r2.json`,
  '--receipt',`${newDir}/auto-match-receipt.r2.json`,
  '--lookup',`${newDir}/experience-lookup-receipt.r2.json`,
  '--repo-root',root]);
const receipt=read(`${newDir}/auto-match-receipt.r2.json`);
check(receipt.summary.analyzedCardCount===157,'未覆盖当前157卡');
const selection=read(`${newDir}/director-selection.r2.json`);
const automaticApplies=selection.beats.filter(beat=>beat.decision==='apply').map(beat=>beat.beatId);
check(equal(automaticApplies,['T019','T050']),'自动候选变化需人工重新裁决，本脚本不自动采用');
const execution=read(`${oldDir}/director-execution-selection.r1.json`);
execution.revisionId='ten-ai-businesses-shotcraft-execution-selection-r2';
execution.captions=request.captions;
execution.automaticSelection=binding(`${newDir}/director-selection.r2.json`);
execution.autoMatchReceipt=binding(`${newDir}/auto-match-receipt.r2.json`);
execution.reviewState.tailUserConfirmed=true;
execution.beats.forEach(beat=>{beat.reason=beat.reason.replace('末句识别疑词待用户确认','末句AI创业已经用户本轮核对，整体字幕仍待听审');});
check(execution.beats.length===54 && execution.beats.every(beat=>beat.decision==='not-needed'),'不得新增应用');
write(`${newDir}/director-execution-selection.r2.json`,execution);
const decision=read(`${oldDir}/director-decision.r1.json`);
decision.sourceRequest=binding(`${newDir}/auto-match-request.r2.json`);
decision.automaticSelection=execution.automaticSelection;
decision.automaticReceipt=execution.autoMatchReceipt;
decision.automaticSummary=receipt.summary;
decision.scopeNotes=decision.scopeNotes.map(note=>note.replace('最后C087识别疑词仍待用户确认，扫描未改成拍前文稿。','最后C087仅按用户本轮明确核对修正AI创业；并非按拍前文稿恢复，其余识别候选保持原样。'));
decision.currentUserConfirmation=policy.currentUserConfirmation;
write(`${newDir}/director-decision.r2.json`,decision);
const autoValidation=JSON.parse(run(['skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs',`${newDir}/director-selection.r2.json`,root]));
const executionValidation=JSON.parse(run(['skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs',`${newDir}/director-execution-selection.r2.json`,root]));
const gaps=request.beats.flatMap((beat,index)=>index&&beat.frames.startFrame!==request.beats[index-1].frames.endFrameExclusive?[beat.beatId]:[]);
const coveredCaptions=new Set(request.beats.flatMap(beat=>beat.sourceCaptionIds));
const coveredSegments=new Set(request.beats.flatMap(beat=>beat.sourceRawSegmentIds));
const verification={
  schemaVersion:'ten-ai-businesses-shotcraft-scan-verification/v1',status:'scan-structure-valid',
  automaticSelectionValidation:autoValidation,executionSelectionValidation:executionValidation,
  timelineAndInputs:{status:'scan-structure-valid',checks:{
    complete8534Frames:request.beats[0].frames.startFrame===0&&request.beats.at(-1).frames.endFrameExclusive===8534,
    gapOrOverlapCount:gaps.length,candidateCaptionCoverage:coveredCaptions.size===87,rawAsrCoverage:coveredSegments.size===136,
    rawSegmentCount:136,captionCount:87,captionTextUnchangedRelativeToR2:true,
    currentAll157Cards:receipt.summary.analyzedCardCount===157,
    eligibleScanCount:request.beats.filter(beat=>beat.mainVisual==='speaker'||beat.mainVisual==='real-evidence').length,
    paperExcludedCount:request.beats.filter(beat=>beat.mainVisual==='paper-editorial').length,
    automaticApplyCount:automaticApplies.length,automaticNotNeededCount:selection.beats.length-automaticApplies.length,
    changedCaptionIds,changedWordIndices:wordChanges,sourceWordTimingUnchanged:true,tailUserConfirmed:true,
    allOtherUserConfirmed:false,normalSpeedVisualReview:false,normalSpeedListeningReview:false,formalApprovalGranted:false,
  }},
  currentUserConfirmation:policy.currentUserConfirmation,
  checksScope:'结构、哈希、完整时间覆盖、全库匹配与唯一尾句修正；不代表听审、看片、事实核验或成片放行。',
  spokenSourceVerifierOutput:spokenOutput,
  matcherOutput:JSON.parse(matcherOutput),
};
check(verification.timelineAndInputs.checks.complete8534Frames&&gaps.length===0&&coveredCaptions.size===87&&coveredSegments.size===136,'覆盖校验未通过');
write(`${newDir}/scan-structure-verification.r2.json`,verification);
console.log(JSON.stringify({status:'R2字幕和扫描结构校验通过',captionBinding:binding(newCaption),snapshotBinding:request.captions,
  changedCaptionIds,changedWordIndices:wordChanges,wordCount:1097,allTimingsUnchanged:true,
  analyzedCardCount:157,automaticApplyBeatIds:automaticApplies,newExecutionApplyCount:0,executionNotNeededCount:54,
  humanListeningPerformed:false,finalHumanAcceptance:false},null,2));
