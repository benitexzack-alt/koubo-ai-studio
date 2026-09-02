#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildSceneIdentity,
  sha256File,
  sha256Json,
} from '../scripts/preproduction-director-core.mjs';

const testRoot = mkdtempSync(path.join(os.tmpdir(), 'koubo-firstframe-bake-test-'));
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(skillRoot, 'scripts/bake-firstframe-text.mjs');

const run = (binary, args) =>
  spawnSync(binary, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

try {
  const sourcePath = path.join(testRoot, 'source.png');
  const outputPath = path.join(testRoot, 'baked.png');
  const receiptPath = path.join(testRoot, 'receipt.json');
  const requestPath = path.join(testRoot, 'request.json');
  const imageResult = run('magick', ['-size', '1280x720', 'xc:#E8D6AF', sourcePath]);
  assert.equal(imageResult.status, 0, imageResult.stderr);

  const labels = [
    {
      nodeId: 'N1',
      text: '人工',
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
      anchorQuad: [[0.2, 0.3], [0.8, 0.3], [0.8, 0.62], [0.2, 0.62]],
      ocrRequired: true,
    },
  ];
  const sourceScene = {
    beatId: 'B01',
    prompt: {firstFrame: '确定性首帧', motion: '纸片轻微运动'},
    textPlan: labels,
    screenTextPlan: [],
  };
  const sourcePlanPath = path.join(testRoot, 'source-plan.json');
  const sourcePlan = {taskId: 'firstframe-bake-test', paperScenes: [sourceScene]};
  writeFileSync(sourcePlanPath, `${JSON.stringify(sourcePlan, null, 2)}\n`);
  const identity = buildSceneIdentity(sourceScene, 0);
  const request = {
    schemaVersion: 'koubo-paper-firstframe-text-bake-request/v1',
    taskId: 'firstframe-bake-test',
    sourcePlan: {path: sourcePlanPath, sha256: sha256File(sourcePlanPath)},
    fontPath: path.join(os.homedir(), 'Library/Fonts/NotoSansCJKsc-Bold.otf'),
    receiptPath,
    scenes: [
      {
        sceneId: 'P01',
        pairId: identity.pairId,
        pairSha256: identity.pairSha256,
        textPlanSha256: identity.textPlanSha256,
        labelsSha256: sha256Json(labels),
        sourceImage: {path: sourcePath, sha256: sha256File(sourcePath)},
        outputImage: {path: outputPath},
        labels,
      },
    ],
  };
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const positive = run(process.execPath, [
    scriptPath,
    '--request',
    requestPath,
    '--repo-root',
    testRoot,
  ]);
  assert.equal(positive.status, 0, positive.stderr);
  assert.equal(existsSync(outputPath), true);
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.status, 'deterministic-first-frame-text-baked-and-ocr-passed');
  assert.equal(receipt.scenes[0].ocr[0].matched, true);
  assert.equal(receipt.scenes[0].outputImage.sha256, sha256File(outputPath));

  const rejectedRequestPath = path.join(testRoot, 'request-rejected.json');
  const rejected = structuredClone(request);
  rejected.receiptPath = path.join(testRoot, 'receipt-rejected.json');
  rejected.scenes[0].outputImage.path = path.join(testRoot, 'rejected.png');
  rejected.scenes[0].sourceImage.sha256 = '0'.repeat(64);
  writeFileSync(rejectedRequestPath, `${JSON.stringify(rejected, null, 2)}\n`);
  const negative = run(process.execPath, [
    scriptPath,
    '--request',
    rejectedRequestPath,
    '--repo-root',
    testRoot,
  ]);
  assert.notEqual(negative.status, 0);
  assert.match(negative.stderr, /TEXT_BAKE_SOURCE_SHA_MISMATCH/u);
  assert.equal(existsSync(rejected.scenes[0].outputImage.path), false);

  console.log(
    JSON.stringify({
      ok: true,
      deterministicTextBaked: true,
      chineseOcrMatched: true,
      sourceTextPlanBound: true,
      sourceShaMismatchRejected: true,
    }),
  );
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
