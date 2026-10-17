import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const plan=JSON.parse(readFileSync(join(here,'visual-plan.v3.json'),'utf8'));
const sfx=JSON.parse(readFileSync(join(here,'sfx-map.v3.json'),'utf8'));
const sourceFiles=readdirSync(here)
  .filter((name)=>['.ts','.tsx'].includes(extname(name)))
  .map((name)=>({name,source:readFileSync(join(here,name),'utf8')}));
const joined=sourceFiles.map(({source})=>source).join('\n');
const remotionRoot=resolve(here,'../../..');
const projectRoot=resolve(remotionRoot,'..');
const sha=(path)=>createHash('sha256').update(readFileSync(path)).digest('hex');

assert.equal(plan.status,'candidate-blocked-reference-minimum');
assert.equal(plan.productionEligible,false);
assert.equal(plan.approval.referenceMinimumAccepted,false);
assert.equal(plan.approval.machineQa,'passed-local-technical-only');
assert.equal(plan.approval.normalSpeedFullWatch,'pending');
assert.ok(plan.blockedAgainstReferenceMinimum.length>=5);
assert.equal(plan.video.durationInFrames,900);
assert.equal(plan.video.durationSeconds,30);
assert.equal(plan.worlds.length,3);
assert.equal(plan.longHoldRemediation.length,3);
assert.deepEqual(plan.worlds.map((world)=>world.cameraGrammar),[
  'macro-overhead',
  'oblique-evidence-wall',
  'low-angle-miniature-system',
]);

for(const world of plan.worlds){
  assert.ok(world.objectGroups.length>=3&&world.objectGroups.length<=6,`${world.id}: object groups must be 3-6`);
  assert.ok(world.layers.length>=3,`${world.id}: requires three spatial layers`);
  assert.ok(world.assemblySteps.length>=4&&world.assemblySteps.length<=7,`${world.id}: assembly must be 4-7 visible steps`);
  assert.ok(world.completedStateHoldFrames>=45,`${world.id}: completed state hold is too short`);
}

assert.equal(plan.transitions.length,2);
for(const transition of plan.transitions){
  assert.ok(transition.mechanism.includes('paper'));
  assert.ok(transition.mechanism.includes('semantic edge'));
  assert.ok(transition.durationFrames>=18&&transition.durationFrames<=24,'transition must be brief enough to avoid a blank rhythm break');
}

for(const required of ['perspective(','boxShadow','thickness','PaperFiberV3','HalftoneV3','PaperWipeV3','Audio','staticFile']){
  assert.ok(joined.includes(required),`missing V3 mechanism: ${required}`);
}
for(const forbidden of ['G01','G02','G03','G04','西北算格']){
  assert.ok(!joined.includes(forbidden),`forbidden carryover found: ${forbidden}`);
}
for(const {name,source} of sourceFiles){
  assert.ok(!/Math\.random\s*\(/.test(source),`${name}: random is forbidden`);
  assert.ok(!/Date\.now\s*\(/.test(source),`${name}: wall clock is forbidden`);
  assert.ok(!/animation(Name)?\s*:/.test(source),`${name}: CSS animation is forbidden`);
  assert.ok(!/transition\s*:/.test(source),`${name}: CSS transition is forbidden`);
  assert.ok(!/<(?:Img|Video|OffthreadVideo)\b/.test(source),`${name}: image/video assets are forbidden`);
  assert.ok(!/https?:\/\//.test(source),`${name}: external URLs are forbidden`);
}

assert.equal(sfx.status,'candidate-only-user-audition-required');
assert.equal(sfx.humanAudition,'pending');
assert.ok(sfx.previewGainRationale.includes('-51 LUFS'));
assert.equal(sfx.events.length,5,'V1 local guideline caps this 30s test at five semantic SFX events');
for(const event of sfx.events){
  const absolute=resolve(projectRoot,event.file);
  assert.ok(existsSync(absolute),`${event.id}: missing local SFX ${absolute}`);
  assert.equal(sha(absolute),event.sha256,`${event.id}: SFX hash mismatch`);
  assert.ok(event.semanticEvent.length>=24,`${event.id}: semantic binding is too weak`);
  assert.ok(event.volume>0&&event.volume<=1,`${event.id}: preview volume must remain bounded`);
}

const prior=plan.preservesPriorPrototype;
assert.ok(existsSync(prior.path),'V2 prototype must remain present');
assert.equal(sha(prior.path),prior.sha256,'V2 prototype was unexpectedly overwritten');

console.log(JSON.stringify({
  ok:true,
  status:plan.status,
  productionEligible:plan.productionEligible,
  cameraGrammars:plan.worlds.map((world)=>world.cameraGrammar),
  worlds:plan.worlds.map((world)=>({id:world.id,groups:world.objectGroups.length,layers:world.layers.length,steps:world.assemblySteps.length,hold:world.completedStateHoldFrames})),
  transitions:plan.transitions.length,
  sfxEvents:sfx.events.map((event)=>({id:event.id,file:event.file,sha256:event.sha256})),
  preservedV2Sha256:prior.sha256,
},null,2));
