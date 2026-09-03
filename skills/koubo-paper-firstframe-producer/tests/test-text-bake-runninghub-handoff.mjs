#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildSceneIdentity,
  sha256File,
  sha256Json,
} from '../../koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {
  JOB_SCHEMA,
  REVIEW_SCHEMA,
  RUNNINGHUB_READY_PACK_SCHEMA,
  TEXT_BAKE_CALIBRATION_SCHEMA,
  sha256Text,
} from '../scripts/firstframe-batch-core.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const testRoot = mkdtempSync(path.join(repoRoot, '.tmp-firstframe-handoff-'));
const bakeBatchScript = path.join(
  repoRoot,
  'skills/koubo-paper-firstframe-producer/scripts/bake-firstframe-batch.mjs',
);
const readyPackScript = path.join(
  repoRoot,
  'skills/koubo-paper-firstframe-producer/scripts/build-runninghub-ready-pack.mjs',
);
const fontPath = path.join(os.homedir(), 'Library/Fonts/NotoSansCJKsc-Bold.otf');

const run = (script, args) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

try {
  const imageRoot = path.join(testRoot, 'first-frames');
  const bakedImageRoot = path.join(testRoot, 'text-baked-first-frames');
  const qaRoot = path.join(testRoot, 'first-frame-qa');
  const calibrationRoot = path.join(qaRoot, 'anchor-calibrations');
  mkdirSync(imageRoot, {recursive: true});
  mkdirSync(bakedImageRoot, {recursive: true});
  mkdirSync(calibrationRoot, {recursive: true});

  const rawImagePath = path.join(imageRoot, 'P01_B01_first-frame.png');
  const imageResult = spawnSync(
    'magick',
    ['-size', '1280x720', 'xc:#E8D6AF', rawImagePath],
    {encoding: 'utf8'},
  );
  assert.equal(imageResult.status, 0, imageResult.stderr);

  const labels = [{
    nodeId: 'N1',
    text: '真实需求',
    groupId: 'G1',
    surfaceId: 'surface-1',
    enterStageId: 'S1',
    role: 'diegetic-node-label',
    maxChars: 8,
    persistence: 'through-scene',
    occlusionOwner: 'paper-layer-1',
    embeddingMode: 'first-frame-baked',
    motionConstraint: 'rigid-surface',
    stageOffsetFrames: 0,
    anchorQuad: [[0.18, 0.3], [0.82, 0.3], [0.82, 0.62], [0.18, 0.62]],
    ocrRequired: true,
  }];
  const sourceScene = {
    beatId: 'B01',
    prompt: {firstFrame: '无字纸艺基础图', motion: '带字纸牌刚性滑入'},
    textPlan: labels,
    screenTextPlan: [],
  };
  const sourcePlanPath = path.join(testRoot, 'director-preproduction-plan.v1.json');
  writeFileSync(
    sourcePlanPath,
    `${JSON.stringify({taskId: 'handoff-test', paperScenes: [sourceScene]}, null, 2)}\n`,
  );
  const identity = buildSceneIdentity(sourceScene, 0);

  const sourceManifestPath = path.join(testRoot, 'first-frame-prompts.v1.json');
  writeFileSync(sourceManifestPath, `${JSON.stringify({test: true}, null, 2)}\n`);
  const reviewPath = path.join(qaRoot, 'P01.visual-review.v1.json');
  writeFileSync(reviewPath, `${JSON.stringify({
    schemaVersion: REVIEW_SCHEMA,
    sceneId: 'P01',
    imageSha256: sha256File(rawImagePath),
    status: 'passed',
  }, null, 2)}\n`);
  const calibrationPath = path.join(calibrationRoot, 'P01.v1.json');
  writeFileSync(calibrationPath, `${JSON.stringify({
    schemaVersion: TEXT_BAKE_CALIBRATION_SCHEMA,
    sceneId: 'P01',
    status: 'passed',
    sourceImage: {path: rawImagePath, sha256: sha256File(rawImagePath)},
    labels: [{nodeId: 'N1', anchorQuad: labels[0].anchorQuad, placementChecked: true}],
  }, null, 2)}\n`);

  const jobPath = path.join(testRoot, 'first-frame-batch.v1.json');
  const bakedImagePath = path.join(bakedImageRoot, 'P01_B01_first-frame-text-baked.png');
  writeFileSync(jobPath, `${JSON.stringify({
    schemaVersion: JOB_SCHEMA,
    taskId: 'handoff-test',
    requestId: 'handoff-test-request',
    status: 'full-generation-authorized',
    sourceManifest: {path: sourceManifestPath, sha256: sha256File(sourceManifestPath)},
    output: {handoffRoot: testRoot, imageRoot, bakedImageRoot, qaRoot, calibrationRoot},
    sampleSceneIds: ['P01'],
    scenes: [{
      sceneId: 'P01',
      pairId: identity.pairId,
      pairSha256: identity.pairSha256,
      beatId: 'B01',
      textPlanSha256: identity.textPlanSha256,
      result: {
        imagePath: rawImagePath,
        imageSha256: sha256File(rawImagePath),
        visualReview: {path: reviewPath},
      },
      deterministicTextBake: {
        enabled: true,
        anchorCalibrationRequired: true,
        labels,
        labelsSha256: sha256Json(labels),
        outputPath: bakedImagePath,
        calibrationPath,
      },
    }],
    events: [],
  }, null, 2)}\n`);

  const bake = run(bakeBatchScript, [
    '--project-root', repoRoot,
    '--job', jobPath,
    '--source-plan', sourcePlanPath,
    '--font', fontPath,
    '--phase', 'full',
  ]);
  assert.equal(bake.status, 0, bake.stderr);
  assert.equal(existsSync(bakedImagePath), true);
  const updatedJob = JSON.parse(readFileSync(jobPath, 'utf8'));
  assert.equal(updatedJob.textBakeReceipts.length, 1);
  const bakeReceipt = JSON.parse(
    readFileSync(updatedJob.textBakeReceipts[0].receipt.path, 'utf8'),
  );
  assert.equal(bakeReceipt.scenes[0].ocr[0].matched, true);

  const motionPrompt = '首帧中文保持不变，带字纸牌只做刚性滑入。';
  const runningHubManifestPath = path.join(
    testRoot,
    'runninghub-image-to-video-prompts.v1.json',
  );
  writeFileSync(runningHubManifestPath, `${JSON.stringify({
    status: 'awaiting-text-baked-firstframes',
    scenes: [{
      sceneId: 'P01',
      pairId: identity.pairId,
      pairSha256: identity.pairSha256,
      inputFirstFrameTextPlanSha256: identity.textPlanSha256,
      imageToVideoPrompt: motionPrompt,
      imageToVideoPromptSha256: sha256Text(motionPrompt),
      durationSeconds: 6,
    }],
  }, null, 2)}\n`);
  const acceptancePath = path.join(testRoot, 'user-acceptance.v1.json');
  writeFileSync(acceptancePath, `${JSON.stringify({
    approved: true,
    status: 'approved-for-runninghub-manual',
    taskId: 'handoff-test',
    requestId: 'handoff-test-request',
    scope: 'text-baked-first-frames',
    sceneIds: ['P01'],
  }, null, 2)}\n`);

  const ready = run(readyPackScript, [
    '--project-root', repoRoot,
    '--job', jobPath,
    '--runninghub-manifest', runningHubManifestPath,
    '--user-acceptance', acceptancePath,
  ]);
  assert.equal(ready.status, 0, ready.stderr);
  const readyPackPath = path.join(testRoot, 'runninghub-ready-pack.v1.json');
  const readyPack = JSON.parse(readFileSync(readyPackPath, 'utf8'));
  assert.equal(readyPack.schemaVersion, RUNNINGHUB_READY_PACK_SCHEMA);
  assert.equal(readyPack.status, 'ready-for-runninghub-manual');
  assert.equal(readyPack.scenes[0].inputFirstFrame.sha256, sha256File(bakedImagePath));
  assert.equal(readyPack.scenes[0].textOcrPassed, true);
  assert.ok(readyPack.scenes[0].forbiddenMotion.includes('rewrite-text'));

  console.log(JSON.stringify({
    ok: true,
    rawImageReviewed: true,
    actualImageAnchorCalibrationBound: true,
    deterministicChineseTextBaked: true,
    chineseOcrMatched: true,
    runningHubReadyPackIssued: true,
  }));
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
