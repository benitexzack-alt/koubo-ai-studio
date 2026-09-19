import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root = process.cwd();
const base = 'edit/20260919_ai_training_methods';
const out = `${base}/07_预览与质检/录屏动效验证/r2`;
fs.mkdirSync(out, {recursive:true});
const binding = p => ({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
const write = (name,value) => fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const raw = JSON.parse(fs.readFileSync(`${base}/05_实录与字幕/turbo.actual.raw.json`));
write('实录字幕_机器候选.v1.json',raw.segments.map(s=>({startMs:Math.round(s.start*1000),endMs:Math.round(s.end*1000),zh:s.text})));
const inputs = {
 registry:'skills/koubo-shotcraft-library/registry.v1.json',
 library:'skills/koubo-shotcraft-library/upstream/gallery/api/library.json',
 capabilityIndex:'skills/koubo-shotcraft-library/card-capability-index.v2.json',
 experienceLedger:'skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json',
 componentModule:'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',
 captions:`${out}/实录字幕_机器候选.v1.json`,
};
const make = (id,start,end,purpose,key,file)=>({
 beatId:id,mainVisual:'real-evidence',frames:{startFrame:Math.round(start*30),endFrameExclusive:Math.round(end*30)},
 quote:raw.segments.filter(s=>s.start<end&&s.end>start).map(s=>s.text).join(''),
 purpose,semanticIntents:['evidence','selection'],materialClass:'screen-recording',energy:'medium',existingVisualSufficiency:'low',keyPhrases:[key],
 region:{x:560,y:180,width:1080,height:400},
 evidence:{asset:binding(`${base}/01_素材投放区/02_用户录屏与演示/${file}`),rect:{x:20,y:100,width:1040,height:150},claimBoundary:purpose},
 protectedRegions:[{x:60,y:624,width:384,height:216},{x:0,y:900,width:1920,height:180}],
});
write('自动匹配请求.v1.json',{
 schemaVersion:'koubo-shotcraft-auto-match-request/v1',taskId:'task-20260919T154314Z-cfc689b4',revisionId:'ai-training-screen-effects-r2',
 directorProfile:{profileId:'paper-editorial-director-v9',profileVersion:'9.1.0'},subtitleAuthority:'actual-recording',
 ...Object.fromEntries(Object.entries(inputs).map(([k,p])=>[k,binding(p)])),
 canvas:{width:1920,height:1080,fps:30,durationInFrames:9155},
 beats:[
 make('screen-question',132,139.26,'将实际反问对话中的一个问题聚焦展示；只说明AI追问，不证明学会技能，不冒充反向教学。','深挖底层的问题','录屏2026-09-19 22.41.37.mov'),
 make('screen-archive',150.86,155,'聚焦驾驶舱内实际可见的内容库与存档；不把账号数据当成作业对比或能力提升证据。','全部存档','录屏2026-09-19 22.38.45.mov'),
 ],
});
console.log(out);
