import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base='edit/20261011_enterprise_ai_organization';
const out=`${base}/10_动效匹配`;
const runtimePath='remotion/src/enterprise-ai-organization/runtime-plan.v1.json';
const plan=JSON.parse(fs.readFileSync(runtimePath,'utf8'));
const bind=path=>({path,sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')});
const write=(name,body)=>fs.writeFileSync(`${out}/${name}`,JSON.stringify(body,null,2)+'\n',{flag:'wx'});
if(!plan.captions.length) throw new Error('须先接入本期实录字幕');
const snapshot={schemaVersion:'enterprise-actual-caption-snapshot/v1',subtitleAuthority:'actual-recording',
  reviewStatus:'machine-crosschecked-user-review-pending',runtime:bind(runtimePath),
  captions:plan.captions.map(c=>({id:c.id,startMs:c.from/30*1000,endMs:c.to/30*1000,zh:c.chinese,en:c.english}))};
write('实录字幕扫描快照.v1.json',snapshot);
const boundaries=[...new Set([0,plan.durationInFrames,...plan.motions.flatMap(m=>[m.from,m.to]),
  ...plan.paperClips.flatMap(p=>[p.from,p.to])])].sort((a,b)=>a-b);
const beats=boundaries.slice(0,-1).map((from,i)=>{
  const to=boundaries[i+1];
  const paper=plan.paperClips.find(p=>from>=p.from&&to<=p.to);
  const motion=plan.motions.find(m=>from>=m.from&&to<=m.to);
  const captions=plan.captions.filter(c=>c.from<to&&c.to>from);
  const quote=captions.map(c=>c.chinese).join('') || plan.captions.reduce((best,c)=>Math.abs(c.from-from)<Math.abs(best.from-from)?c:best).chinese;
  const shared={beatId:`T${String(i+1).padStart(3,'0')}`,mainVisual:paper?'paper-editorial':'speaker',
    frames:{startFrame:from,endFrameExclusive:to},quote,keyPhrases:[],materialClass:'talking-head',
    energy:'medium',existingVisualSufficiency:'high',sourceCaptionIds:captions.map(c=>c.id),
    semanticIntents:paper?[]:motion?.kind==='comparison'?['comparison']:motion?.kind==='branches'?['hierarchy']:motion?.kind==='question'?['question']:motion?['emphasis','list']:['voice'],
    purpose:paper?`${paper.id}以纸艺物件动作解释本段关系，保留原生声音，禁止在素材内部另叠信息层。`:
      motion?`${motion.title}已由本期V8${motion.kind}局部语义层分步呈现，节点按实录入场；全库检索评估是否有新认知收益，不重复堆叠同一信息。`:
      '此窗保留本人表情、语气和衔接停顿；同窗实录字幕足以承接，没有新关系需要另盖一张卡。',
    existingVisualSufficiencyBasis:'已绑定当前实际布局；画面质量仍待真实合成核对，非人审结论。'};
  return paper?shared:{...shared,region:{x:48,y:96,width:636,height:414},
    protectedRegions:[{x:710,y:0,width:1000,height:890},{x:0,y:900,width:1920,height:180}],
    existingMotionIds:motion?[motion.id]:[]};
});
const paths={registry:'skills/koubo-shotcraft-library/registry.v1.json',library:'skills/koubo-shotcraft-library/upstream/gallery/api/library.json',
  capabilityIndex:'skills/koubo-shotcraft-library/card-capability-index.v2.json',
  experienceLedger:'skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json',
  componentModule:'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx'};
const request={schemaVersion:'koubo-shotcraft-auto-match-request/v1',taskId:'20261011-enterprise-ai-organization',revisionId:'enterprise-ai-v8-r1',
  directorProfile:{profileId:'paper-editorial-director-v9',profileVersion:'9.1.0'},subtitleAuthority:'actual-recording',
  ...Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,bind(p)])),captions:bind(`${out}/实录字幕扫描快照.v1.json`),
  canvas:{width:1920,height:1080,fps:30,durationInFrames:4385},beats};
write('auto-match-request.v1.json',request);
const result=spawnSync('node',['skills/koubo-shotcraft-library/scripts/match-director-effects.mjs',
  '--request',`${out}/auto-match-request.v1.json`,'--selection',`${out}/director-selection.v1.json`,
  '--receipt',`${out}/auto-match-receipt.v1.json`,'--lookup',`${out}/experience-lookup.v1.json`,'--repo-root','.'],{stdio:'inherit'});
process.exitCode=result.status;
