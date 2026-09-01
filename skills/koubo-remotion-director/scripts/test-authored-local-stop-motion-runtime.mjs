#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  assertProgressiveLocalAssemblySchedule,
  authoredLocalStopMotionFrameState,
  DIRECTOR_AUTHORED_LOCAL_STOP_MOTION,
} from '../assets/remotion-paper-editorial/style.ts';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '../../..');
const fps = 30;
const stateFrames = [0, 30, 60, 90, 120, 150, 180, 210, 240, 278];
const targetIds = stateFrames.map((_, index) => `target-${index}`);
const states = stateFrames.map((atFrame, index) => ({
  id: `state-${index}`,
  assetId: `state-asset-${index}`,
  stageId: `stage-${index}`,
  atFrame,
  entityStateId: `entity-state-${index}`,
  changedEntityIds: [targetIds[index]],
  localMotion: index === 0
    ? {model: 'neutral/v1'}
    : {
        model: 'authored-local-stop-motion/v1',
        region: {x: 120 + index * 20, y: 160 + index * 10, width: 180, height: 110},
        poseAssetIds: [0, 1, 2].map((poseIndex) =>
          `motion-pose-${index}-${poseIndex}`),
      },
}));
const scene = {
  id: 'authored-local-stop-motion-runtime-fixture',
  type: 'complex-explanation',
  start: 0,
  end: 10.3,
  spokenLine: '纸艺件逐个落位。',
  cognitiveIncrement: '目标完成态之前播放预编排的局部停格姿态。',
  objectGroups: targetIds.map((id) => ({id})),
  nodes: [],
  assemblyStages: stateFrames.map((atFrame, index) => ({
    id: `stage-${index}`,
    atSeconds: atFrame / fps,
    action: 'visible-discrete-assembly',
    targetIds: [targetIds[index]],
  })),
  stateReveal: {
    method: 'progressive-local-assembly',
    audit: {
      windowStartFrame: 0,
      windowEndFrame: 278,
      firstChangeFrame: 30,
      namedEntityStateCount: 10,
      maximumUnchangedFrames: 38,
    },
    states,
    transitions: states.slice(1).map((state, index) => ({
      id: `transition-${index}`,
      fromStateId: states[index].id,
      toStateId: state.id,
      kind: 'visible-discrete-assembly',
      swapFrame: state.atFrame,
    })),
  },
};

const expectCode = (candidate, code) => {
  assert.throws(
    () => assertProgressiveLocalAssemblySchedule(candidate, fps),
    (error) => error?.code === code,
  );
};

assert.doesNotThrow(() => assertProgressiveLocalAssemblySchedule(scene, fps));
assert.deepEqual(DIRECTOR_AUTHORED_LOCAL_STOP_MOTION, {
  poseHoldFrames: 3,
  poseCount: 3,
  durationFrames: 9,
});

const authorityBeforePreroll = authoredLocalStopMotionFrameState(scene, 20, fps);
const pose0At0 = authoredLocalStopMotionFrameState(scene, 21, fps);
const pose0At2 = authoredLocalStopMotionFrameState(scene, 23, fps);
const pose1At3 = authoredLocalStopMotionFrameState(scene, 24, fps);
const pose2At6 = authoredLocalStopMotionFrameState(scene, 27, fps);
const pose2At8 = authoredLocalStopMotionFrameState(scene, 29, fps);
const authorityAtFrame = authoredLocalStopMotionFrameState(scene, 30, fps);
assert.equal(authorityBeforePreroll.phase, 'neutral');
assert.equal(authorityBeforePreroll.stateAssetId, 'state-asset-0');
assert.deepEqual(pose0At0, pose0At2);
assert.equal(pose0At0.phase, 'authored-pose');
assert.equal(pose0At0.baseStateAssetId, 'state-asset-0');
assert.equal(pose0At0.stateAssetId, 'state-asset-1');
assert.equal(pose0At0.poseAssetId, 'motion-pose-1-0');
assert.equal(pose0At0.poseIndex, 0);
assert.equal(pose1At3.poseAssetId, 'motion-pose-1-1');
assert.equal(pose1At3.poseIndex, 1);
assert.equal(pose2At6.poseAssetId, 'motion-pose-1-2');
assert.equal(pose2At8.poseIndex, 2);
assert.deepEqual(authorityAtFrame, {
  stateId: 'state-1',
  stateAssetId: 'state-asset-1',
  baseStateAssetId: 'state-asset-1',
  phase: 'neutral',
  poseAssetId: null,
  region: null,
  poseIndex: null,
});
assert.deepEqual(
  authoredLocalStopMotionFrameState(scene, 21, fps, true),
  authorityBeforePreroll,
  'still composition must show the current full authority state without a pose',
);

const terminalPose0 = authoredLocalStopMotionFrameState(scene, 269, fps);
const terminalAuthority = authoredLocalStopMotionFrameState(scene, 278, fps);
assert.equal(terminalPose0.poseAssetId, 'motion-pose-9-0');
assert.equal(terminalPose0.baseStateAssetId, 'state-asset-8');
assert.equal(terminalAuthority.phase, 'neutral');
assert.equal(terminalAuthority.stateAssetId, 'state-asset-9');

const missing = structuredClone(scene);
delete missing.stateReveal.states[1].localMotion;
expectCode(missing, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_LOCAL_MOTION_REQUIRED');

const firstAuthored = structuredClone(scene);
firstAuthored.stateReveal.states[0].localMotion = structuredClone(
  firstAuthored.stateReveal.states[1].localMotion,
);
expectCode(firstAuthored, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_NEUTRAL_MOTION_INVALID');

const terminalNeutral = structuredClone(scene);
terminalNeutral.stateReveal.states.at(-1).localMotion = {model: 'neutral/v1'};
expectCode(terminalNeutral, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_MOTION_INVALID');

const extraField = structuredClone(scene);
extraField.stateReveal.states[1].localMotion.transform = 'forbidden';
expectCode(extraField, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_MOTION_INVALID');

const invalidRegion = structuredClone(scene);
invalidRegion.stateReveal.states[1].localMotion.region.x = -1;
expectCode(invalidRegion, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_LOCAL_REGION_INVALID');

const wrongPoseCount = structuredClone(scene);
wrongPoseCount.stateReveal.states[1].localMotion.poseAssetIds.pop();
expectCode(wrongPoseCount, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_MOTION_INVALID');

const duplicatePoseWithinState = structuredClone(scene);
duplicatePoseWithinState.stateReveal.states[1].localMotion.poseAssetIds[2] =
  duplicatePoseWithinState.stateReveal.states[1].localMotion.poseAssetIds[0];
expectCode(duplicatePoseWithinState, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_MOTION_INVALID');

const duplicatePoseAcrossStates = structuredClone(scene);
duplicatePoseAcrossStates.stateReveal.states[2].localMotion.poseAssetIds[0] =
  duplicatePoseAcrossStates.stateReveal.states[1].localMotion.poseAssetIds[0];
expectCode(duplicatePoseAcrossStates, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_MOTION_INVALID');

const tooShort = structuredClone(scene);
tooShort.stateReveal.states[1].atFrame = 9;
tooShort.assemblyStages[1].atSeconds = 9 / fps;
tooShort.stateReveal.transitions[0].swapFrame = 9;
expectCode(tooShort, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_PREROLL_INSUFFICIENT');

const rendererPath = path.resolve(
  repoRoot,
  'skills/koubo-remotion-director/assets/remotion-paper-editorial/DirectorComposition.tsx',
);
const entryPath = path.resolve(
  repoRoot,
  'skills/koubo-remotion-director/assets/remotion-paper-editorial/entry.tsx',
);
const rendererSource = readFileSync(rendererPath, 'utf8');
const entrySource = readFileSync(entryPath, 'utf8');
const progressiveStart = rendererSource.indexOf('  if (progressiveLocalAssembly) {');
const progressiveEnd = rendererSource.indexOf(
  '  const camera = photographicStopMotionCamera(localFrame, fps);',
  progressiveStart,
);
assert.ok(progressiveStart >= 0 && progressiveEnd > progressiveStart);
const progressiveBranch = rendererSource.slice(progressiveStart, progressiveEnd);
assert.ok(progressiveBranch.includes('staticFile(baseStateAsset.staticFileName)'));
assert.ok(progressiveBranch.includes('staticFile(poseAsset.staticFileName)'));
assert.ok(progressiveBranch.includes("poseAsset.role !== 'motion-pose'"));
for (const forbidden of [
  'interpolate(',
  'translate3d(',
  'transform:',
  'transition:',
  'Math.random',
  'photographicStopMotionCamera',
]) {
  assert.equal(
    progressiveBranch.includes(forbidden),
    false,
    `authored local stop-motion branch contains forbidden runtime motion: ${forbidden}`,
  );
}

const bcStart = progressiveEnd;
const bcEnd = rendererSource.indexOf('\n};\n\nconst CaptionTrack', bcStart) + 3;
const bcBranchSha256 = createHash('sha256')
  .update(rendererSource.slice(bcStart, bcEnd))
  .digest('hex');
assert.equal(
  bcBranchSha256,
  'c940890fe66b5338402e491c7ee6da9e1d0c4dae1982cb7d26b38a18f5e53fa3',
  'B/C photographic occluder branch changed while implementing authored A poses',
);
assert.ok(entrySource.includes('const Still: React.FC<DirectorInput>'));
assert.ok(entrySource.includes('forceNeutralLocalMotion'));
assert.ok(entrySource.includes('component={Still}'));
assert.ok(
  rendererSource.indexOf('<CaptionTrack captions={resolvedPlan.captions ?? []} />') >
    rendererSource.indexOf('resolvedPlan.scenes.map'),
  'captions must remain at the root, outside scene pose placement',
);

console.log(JSON.stringify({
  ok: true,
  contract: 'authored-local-stop-motion/v1',
  poses: '3x3-frames-before-authority-atFrame',
  authorityAtFrameExact: true,
  terminalPreroll: true,
  stillNeutral: true,
  captionsRootStable: true,
  bcBranchSha256,
}, null, 2));
