import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(root,'../../../../..');
const input=path.join(project,'edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r1');
const source=path.join(project,'remotion/src/lanzhou-services-v91-candidate-r1');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const data=read(path.join(input,'data.v1.json'));
const visual=read(path.join(source,'visual-plan.v1.json'));
const selection=read(path.join(input,'output-selection.derived.v2.json'));
const manifest=read(path.join(input,'final-consumption.v2.json'));
const checks=[];
const check=(name,ok,detail)=>checks.push({name,ok,detail});
for(const key of ['data','captions','selection','request','rawMatchReceipt','derivedValidation']){
  const asset=manifest[key];check(`manifest-${key}-hash`,sha(path.resolve(project,asset.path))===asset.sha256,asset.path);
}
for(const key of ['data','shotcraftSelection']){
  const asset=visual[key];check(`visual-${key}-hash`,sha(path.resolve(project,asset.path))===asset.sha256,asset.path);
}
const selected=selection.beats.filter(b=>b.decision==='apply');
check('effect-count',selected.length===15 && visual.effects.length===15,{selected:selected.length,consumed:visual.effects.length});
for(const beat of selected){
  const effect=visual.effects.find(e=>e.id===beat.beatId);
  check(`${beat.beatId}-contract`,Boolean(effect)&&effect.effectId===beat.effectId&&effect.from===beat.frames.startFrame&&effect.to===beat.frames.endFrameExclusive&&isDeepStrictEqual(effect.region,beat.region)&&isDeepStrictEqual(effect.props,beat.componentProps),beat.beatId);
  if(beat.effectId==='keyword-reveal')check(`${beat.beatId}-explicit-keyword-frames`,isDeepStrictEqual(effect.words,beat.componentProps.items.map(x=>x.text))&&isDeepStrictEqual(effect.wordFrames,beat.componentProps.items.map(x=>x.atFrame)),effect.wordFrames);
}
check('timeline-length',data.timeline.durationInFrames===8393&&visual.canvas.durationInFrames===8393&&data.timeline.sourceDurationInFrames===8149&&data.timeline.insertion.durationInFrames===244,data.timeline.insertion);
const overlap=(a,b)=>a.from<b.to&&b.from<a.to;
const exclusions=[{id:'news',from:69,to:313},...data.papers.map(p=>({id:p.id,from:p.outputStartFrame,to:p.outputEndFrameExclusive}))];
const clashes=[...visual.semantic,...visual.effects].flatMap(s=>exclusions.filter(p=>overlap(s,p)).map(p=>({visual:s.id,excluded:p.id})));
check('ordinary-effects-outside-news-and-paper',clashes.length===0,clashes);
const audioClashes=visual.sfx.flatMap(s=>exclusions.filter(p=>s.frame>=p.from&&s.frame<p.to).map(p=>({cue:s.id,excluded:p.id})));
check('sfx-starts-outside-news-and-paper',audioClashes.length===0,audioClashes);
check('asr-uncertainty-preserved',data.exceptions.transcription.uncertain.length===13&&data.exceptions.transcription.humanListeningPerformed===false&&data.exceptions.transcription.userAudioReviewConfirmed===false,{count:data.exceptions.transcription.uncertain.length});
check('candidate-only',data.formalAllowed===false&&visual.formal===false&&manifest.formalAllowed===false,{data:data.formalAllowed,visual:visual.formal,manifest:manifest.formalAllowed});
const generated=path.join(source,'ShotcraftEffects.generated.tsx');
const upstream=path.join(project,'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx');
check('shotcraft-local-copy-byte-identical',sha(generated)===sha(upstream),{generatedSha256:sha(generated),localOriginalSha256:sha(upstream)});
const report={schemaVersion:'candidate-independent-consumption-check/v1',checkedAt:new Date().toISOString(),status:checks.every(c=>c.ok)?'static-consumption-checks-passed-not-render-approval':'findings',checks,
  scope:'本worker独立结构化比对输入哈希、选择消费、纸艺排他窗口及候选边界。不是父任务9项visualtests的代称；没有渲染或试听。',
  formalEnabled:false,allow:false,fullRunnerClosureReviewed:false};
fs.writeFileSync(path.join(root,'independent-consumption-check.v1.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.length,failures:checks.filter(c=>!c.ok)},null,2));
process.exitCode=checks.every(c=>c.ok)?0:1;
