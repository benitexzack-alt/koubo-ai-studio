import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, extname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(here, 'visual-plan.v2.json'), 'utf8'));
const sourceFiles = readdirSync(here)
  .filter((name) => ['.ts', '.tsx'].includes(extname(name)))
  .map((name) => ({name, source: readFileSync(join(here, name), 'utf8')}));
const joinedSource = sourceFiles.map(({source}) => source).join('\n');

assert.equal(plan.status, 'candidate', 'candidate must not self-promote');
assert.equal(plan.productionEligible, false, 'candidate must be blocked from production');
assert.equal(plan.approval.styleAcceptedByUser, false, 'human style acceptance must remain false');
assert.equal(plan.sourcePolicy.externalGeneration, false);
assert.equal(plan.sourcePolicy.paidProvider, false);
assert.equal(plan.sourcePolicy.externalAssets, false);
assert.equal(plan.sourcePolicy.deterministicRemotionOnly, true);

assert.equal(plan.video.width, 1920);
assert.equal(plan.video.height, 1080);
assert.equal(plan.video.fps, 30);
assert.equal(plan.video.durationInFrames, 810);
assert.equal(plan.video.durationSeconds, 27);
assert.equal(plan.worlds.length, 3, 'exactly three semantic worlds are required');

const purposeSet = new Set();
for (const world of plan.worlds) {
  assert.ok(world.semanticPurpose.length >= 18, `${world.id}: semantic purpose is too weak`);
  assert.ok(!purposeSet.has(world.semanticPurpose), `${world.id}: semantic purpose must be unique`);
  purposeSet.add(world.semanticPurpose);
  assert.ok(world.objectGroups.length >= 3 && world.objectGroups.length <= 6, `${world.id}: requires 3-6 object groups`);
  assert.ok(world.layers.length >= 3, `${world.id}: requires foreground/midground/background`);
  assert.ok(world.assemblySteps.length >= 4 && world.assemblySteps.length <= 7, `${world.id}: requires 4-7 assembly levels`);
  assert.ok(world.completedStateHoldFrames >= 45, `${world.id}: completed-state hold must be at least 1.5 seconds`);
}

for (const forbidden of plan.styleSystem.prohibitedCarryover) {
  assert.ok(!joinedSource.includes(forbidden), `source must not carry over rejected/reference-specific material: ${forbidden}`);
}

for (const {name, source} of sourceFiles) {
  assert.ok(!/Math\.random\s*\(/.test(source), `${name}: random motion is forbidden`);
  assert.ok(!/Date\.now\s*\(/.test(source), `${name}: wall-clock motion is forbidden`);
  assert.ok(!/animation(Name)?\s*:/.test(source), `${name}: CSS animation is forbidden`);
  assert.ok(!/transition\s*:/.test(source), `${name}: CSS transition is forbidden`);
  assert.ok(!/<(?:Audio|Video|OffthreadVideo|Img)\b/.test(source), `${name}: candidate must not embed media assets`);
  assert.ok(!/https?:\/\//.test(source), `${name}: candidate must not call external URLs`);
}

for (const requiredToken of ['useCurrentFrame', 'Sequence', 'PaperGrain', 'Halftone', 'MovingDot']) {
  assert.ok(joinedSource.includes(requiredToken), `required deterministic visual mechanism is missing: ${requiredToken}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      status: plan.status,
      productionEligible: plan.productionEligible,
      worlds: plan.worlds.map((world) => ({
        id: world.id,
        objectGroups: world.objectGroups.length,
        layers: world.layers.length,
        assemblySteps: world.assemblySteps.length,
        completedStateHoldFrames: world.completedStateHoldFrames,
      })),
      deterministicSourceFiles: sourceFiles.map(({name}) => name),
    },
    null,
    2,
  ),
);

