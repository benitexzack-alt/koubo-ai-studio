import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const dir='edit/20260929_meta_pa_local_business/10_剪辑准备/动效';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const bind=file=>({path:file,sha256:hash(file)});
const read=file=>JSON.parse(fs.readFileSync(file));
const write=(file,body)=>fs.writeFileSync(file,JSON.stringify(body,null,2)+'\n');
const plan=read(`${dir}/continuous-semantic-plan.r1.json`);
const request=read(`${dir}/shotcraft-auto-match-request.r1.json`);
const initial=read(`${dir}/shotcraft-selection.r1.json`);
const safeSet=new Set(['B02','B14','B32','B40']);
const rejected=[];
for(const b of request.beats){
  const earlier=initial.beats.find(s=>s.beatId===b.beatId);
  if(earlier?.decision==='apply'&&!safeSet.has(b.beatId)){
    const reason=earlier.effectId==='paper-tape-pin'?'本镜没有需要固定的第二张真实图卡，已有真人或真实视窗；不能为了调用纸胶带制造假素材卡':earlier.effectId==='line-carry'?'本段需完整保留多节点条件与分工；两端标签会丢掉中间关键关系，已由V8连续导轨承担': '定义只需PA及个人AI助理两级信息；整句马克笔会把小区域变成字幕板，已由V8直接关键词承担';
    b.keyPhrases=[];b.existingVisualSufficiency='high';b.purpose=reason;
    rejected.push({beatId:b.beatId,effectId:earlier.effectId,reason,preserveExistingV8:true});
  }
}
const requestFile=`${dir}/shotcraft-auto-match-request.r2.json`;
request.revisionId='meta-pa-preview-r1-wordbound';
write(requestFile,request);
const rawSelection=`${dir}/shotcraft-catalog-selection.r2.json`;
const rawReceipt=`${dir}/shotcraft-catalog-match-receipt.r2.json`;
const lookup=`${dir}/shotcraft-experience-lookup.r2.json`;
const cmd=spawnSync(process.execPath,['skills/koubo-shotcraft-library/scripts/match-director-effects.mjs','--request',requestFile,'--selection',rawSelection,'--receipt',rawReceipt,'--lookup',lookup,'--repo-root','.'],{encoding:'utf8'});
if(cmd.status!==0)throw new Error(cmd.stderr||cmd.stdout);
const selection=read(rawSelection),rebindings=[];
for(const b of selection.beats.filter(s=>s.decision==='apply')){
  if(!safeSet.has(b.beatId)||b.effectId!=='keyword-reveal')throw new Error(`本期需要重新核查未计划安全候选:${b.beatId}:${b.effectId}`);
  const layer=plan.layers.find(l=>l.beatId===b.beatId), times=[layer.start,...layer.params.itemFrames.map(f=>layer.start+f/30)].slice(0,b.texts.length);
  const old=structuredClone(b.componentProps);
  b.componentProps.items=b.texts.map((text,i)=>({text,atFrame:Math.max(0,Math.round(times[i]*30)-b.frames.startFrame)}));
  rebindings.push({beatId:b.beatId,effectId:b.effectId,originalComponentProps:old,actualComponentProps:b.componentProps,reason:'匹配器只负责选卡，均分时间不是实录入点；本期确定性适配器保留卡、文字、区域、帧窗，仅从规范实录重绑节点出现帧'});
}
const selectionFile=`${dir}/shotcraft-selection.r2.json`;
write(selectionFile,selection);
const timingFile=`${dir}/shotcraft-word-timing-binding.r2.json`;
write(timingFile,{schemaVersion:'koubo-shotcraft-spoken-timing-binding/v1',taskId:request.taskId,revisionId:request.revisionId,catalogRequest:bind(requestFile),catalogSelection:bind(rawSelection),catalogReceipt:bind(rawReceipt),canonicalSpokenSource:plan.inputs.transcript,continuousPlan:bind(`${dir}/continuous-semantic-plan.r1.json`),finalSelection:bind(selectionFile),rejectedInitialSuggestions:rejected,rebindings,sharedMatcherModified:false,status:'candidate-ready-not-user-accepted'});
const receipt=read(rawReceipt);
receipt.selection=bind(selectionFile);
receipt.postshootTimingBinding=bind(timingFile);
receipt.catalogMatchReceipt=bind(rawReceipt);
write(`${dir}/shotcraft-auto-match-receipt.r2.json`,receipt);
const finalCheck=spawnSync(process.execPath,['skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs',selectionFile,'.'],{encoding:'utf8'});
if(finalCheck.status!==0)throw new Error(finalCheck.stderr||finalCheck.stdout);
console.log(JSON.stringify({status:'本期选卡与实录节点重绑结构检查通过',cards:receipt.summary.analyzedCardCount,actualVisualWindows:selection.beats.length,applyCount:selection.beats.filter(b=>b.decision==='apply').length,rejectedUnsafeInitialSuggestions:rejected.length,reboundTimingObjects:rebindings.length,selection:selectionFile,receipt:`${dir}/shotcraft-auto-match-receipt.r2.json`,binding:timingFile},null,2));
