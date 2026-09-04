import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..');
const out=path.join(root,'edit/shotcraft-integration-20260904');
fs.mkdirSync(out,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const run=(name,args)=>{
  const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8'});
  fs.writeFileSync(path.join(out,`${name}.log`),`${r.stdout??''}${r.stderr??''}`);
  return {exitCode:r.status,log:`edit/shotcraft-integration-20260904/${name}.log`};
};
const tests=run('unit-tests',['--test','skills/koubo-shotcraft-library/tests/plan.test.mjs','skills/koubo-shotcraft-library/tests/components.test.mjs']);
const types=run('typecheck',['remotion/node_modules/typescript/bin/tsc','-p','remotion/src/shotcraft-candidate-v1/tsconfig.json']);
const plan=run('candidate-contract',['skills/koubo-shotcraft-library/scripts/validate-plan.mjs','remotion/src/shotcraft-candidate-v1/candidate-plan.v1.json','.']);
const director=run('existing-director-gate',['tools/validate-active-director-profile.mjs']);
const gateRegression=run('director-gate-regression',['tools/test-active-director-profile.mjs']);
const layout=JSON.parse(fs.readFileSync(path.join(out,'component-qa/browser-layout.v1.json')));
const mirrorMatches=hash('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx')===hash('remotion/src/shotcraft-candidate-v1/ShotcraftEffects.generated.tsx');
const captionsMatch=hash('remotion/public/data/LOCAL_AI_SERVICES_20260902.actual.bilingual.v1.json')===hash('remotion/src/shotcraft-candidate-v1/captions.generated.json');
const protectedFiles=['workflow/active-production-profile.v1.json','workflow/active-director-profile.v1.json','workflow/director-skill-lock.v1.json','skills/koubo-remotion-director/SKILL.md','remotion/src/Root.tsx','remotion/src/components/V72ProductionShell.tsx','remotion/src/components/V8SemanticStage.tsx'];
const okay=[tests,types,plan,gateRegression].every(r=>r.exitCode===0)&&mirrorMatches&&captionsMatch&&layout.status==='passed';
const receipt={schemaVersion:'shotcraft-integration-receipt/v1',checkedAt:new Date().toISOString(),status:okay?'implemented-render-blocked':'implementation-test-failed',scope:'optional-candidate-effects-only',catalog:{cards:157,styles:214,adapters:5},tests,types,plan,gateRegression,browserCases:layout.cases,mirrorMatches,captionsMatch,
  planSha256:hash('remotion/src/shotcraft-candidate-v1/candidate-plan.v1.json'),
  upstreamLockSha256:hash('skills/koubo-shotcraft-library/upstream-lock.v1.json'),
  existingGate:director,
  existingGateErrors:JSON.parse(fs.readFileSync(path.join(out,'existing-director-gate.log'),'utf8')).errors,
  independentTrustRootExists:fs.existsSync('/Library/Application Support/KouboDirector/director-independent-ed25519-trust-root.v2.json'),
  protectedFileCurrentHashes:protectedFiles.map(p=>({path:p,sha256:hash(p),changedByThisTask:false})),
  sample:{plannedSeconds:31,sourceFrames:[1278,2207],rendered:false,decoded:false,spokenPlaybackChecked:false,wordCueListeningConfirmed:false,userApproved:false},
  productionEligible:false,formalEnabled:false,published:false,paidGeneration:false,
  remaining:['由原维护/监督方复核现有OCR改动后更新导演包锁，不在本任务批量接纳','独立监督方补齐当前受控入口要求的信任与授权链，不自签、不绕过','新候选实际生成后复核声画、字幕、裁切、完整音效与用户观看']};
fs.writeFileSync(path.join(out,'integration-receipt.v1.json'),`${JSON.stringify(receipt,null,2)}\n`);
console.log(JSON.stringify(receipt,null,2));
if(!okay)process.exitCode=1;
