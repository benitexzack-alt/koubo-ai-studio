#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha256Text, validateManifest} from '../scripts/firstframe-batch-core.mjs';

const prompt = '16:9摄影级手作纸艺微缩场景，三层空间，无可读文字。';
const manifest = {
  schemaVersion: 'koubo-paper-first-frame-prompt-manifest/v1',
  requestId: 'request-1',
  taskId: 'task-1',
  status: 'automation-input-ready',
  consumer: 'first-frame-image-automation',
  generatedReadableTextAllowed: false,
  sceneCount: 1,
  scenes: [{
    sceneId: 'P01', pairId: 'P01-B01', pairSha256: 'a'.repeat(64), beatId: 'B01',
    title: '测试', aspectRatio: '16:9', outputFileName: 'P01_B01_first-frame.png',
    firstFramePrompt: prompt, firstFramePromptSha256: sha256Text(prompt),
    generatedReadableTextAllowed: false,
    deterministicTextBake: {
      enabled: true,
      sourceImageFileName: 'P01_B01_first-frame.png',
      outputImageFileName: 'P01_B01_first-frame-text-baked.png',
      textPlanSha256: 'b'.repeat(64),
      labelsSha256: 'c'.repeat(64),
      labels: [{nodeId: 'N1', text: '真实需求'}],
      ocrRequired: true,
      anchorCalibrationRequired: true,
    },
  }],
};

assert.deepEqual(validateManifest(manifest), []);
const videoLeak = structuredClone(manifest);
videoLeak.scenes[0].imageToVideoPrompt = '不应出现';
assert.ok(validateManifest(videoLeak).includes('VIDEO_PROMPT_LEAK:P01'));
const promptDrift = structuredClone(manifest);
promptDrift.scenes[0].firstFramePrompt += '漂移';
assert.ok(validateManifest(promptDrift).includes('PROMPT_SHA_MISMATCH:P01'));
const duplicate = structuredClone(manifest);
duplicate.scenes.push(structuredClone(duplicate.scenes[0]));
duplicate.sceneCount = 2;
assert.ok(validateManifest(duplicate).includes('SCENE_ID_DUPLICATE:P01'));
const noCalibrationGate = structuredClone(manifest);
noCalibrationGate.scenes[0].deterministicTextBake.anchorCalibrationRequired = false;
assert.ok(
  validateManifest(noCalibrationGate).includes('TEXT_BAKE_ANCHOR_CALIBRATION_NOT_REQUIRED:P01'),
);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'firstframe-test-'));
try {
  const filePath = path.join(temporaryRoot, 'manifest.json');
  writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.ok(filePath.startsWith(temporaryRoot));
} finally {
  rmSync(temporaryRoot, {recursive: true, force: true});
}

console.log(JSON.stringify({ok: true, manifestValidation: true, videoPromptLeakRejected: true, promptDriftRejected: true, duplicateSceneRejected: true, missingAnchorCalibrationGateRejected: true}));
