#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  sha256File,
  sha256Json,
  sha256Text,
  validateManifest,
  validateSampleSceneIds,
} from '../scripts/firstframe-batch-core.mjs';

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

const v9Manifest = structuredClone(manifest);
v9Manifest.v9ContractEnabled = true;
v9Manifest.scenes[0].deterministicTextBake.labels[0] = {
  nodeId: 'N1',
  text: '真实需求',
  groupId: 'G1',
  surfaceId: 'G1-label',
};
v9Manifest.scenes[0].layoutContract = {
  coordinateSpace: 'normalized-0-to-1',
  contentSafeRect: {x: 0.05, y: 0.05, width: 0.9, height: 0.7},
  subtitleReservedRect: {x: 0, y: 0.8, width: 1, height: 0.2},
  objectGroupBoxes: [{groupId: 'G1', box: {x: 0.1, y: 0.1, width: 0.5, height: 0.5}}],
  paperLabelSurfaceBoxes: [{
    nodeId: 'N1',
    groupId: 'G1',
    surfaceId: 'G1-label',
    box: {x: 0.2, y: 0.3, width: 0.2, height: 0.1},
  }],
  layoutInterpretation: {
    objectGroupBoxes: 'broad-composition-zones',
    paperLabelSurfaceBoxes: 'reserved-placement-zones',
    exactPixelMatchRequired: false,
    contentAndSubtitleContainmentIsHard: true,
  },
  generatedDecorationPolicy: 'forbidden',
};
v9Manifest.scenes[0].layoutContractSha256 = sha256Json(
  v9Manifest.scenes[0].layoutContract,
);
v9Manifest.scenes[0].firstFramePrompt = `${prompt}\nV9布局合同\n字幕保留区\ngeneratedDecorationPolicy=forbidden`;
v9Manifest.scenes[0].firstFramePromptSha256 = sha256Text(
  v9Manifest.scenes[0].firstFramePrompt,
);
assert.deepEqual(validateManifest(v9Manifest), []);
assert.deepEqual(validateSampleSceneIds(v9Manifest, ['P01']), []);
assert.ok(
  validateSampleSceneIds(v9Manifest, ['P01', 'P02', 'P03']).includes(
    'V9_SAMPLE_MUST_CONTAIN_ONE_UNIQUE_SCENE_ID',
  ),
);
assert.ok(
  validateSampleSceneIds(manifest, ['P01']).includes(
    'LEGACY_SAMPLE_MUST_CONTAIN_THREE_UNIQUE_SCENE_IDS',
  ),
);
const v9MissingLayout = structuredClone(v9Manifest);
delete v9MissingLayout.scenes[0].layoutContract;
assert.ok(validateManifest(v9MissingLayout).includes('V9_LAYOUT_CONTRACT_MISSING:P01'));
const v9LayoutDrift = structuredClone(v9Manifest);
v9LayoutDrift.scenes[0].layoutContract.objectGroupBoxes[0].box.x = 0.2;
assert.ok(validateManifest(v9LayoutDrift).includes('V9_LAYOUT_CONTRACT_SHA_MISMATCH:P01'));

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'firstframe-test-'));
try {
  const filePath = path.join(temporaryRoot, 'manifest.json');
  const receiptPath = path.join(temporaryRoot, 'director-validation.json');
  writeFileSync(filePath, `${JSON.stringify(v9Manifest, null, 2)}\n`);
  writeFileSync(receiptPath, `${JSON.stringify({
    schemaVersion: 'koubo-director-validation-receipt/v1',
    status: 'validated-provisional-previsualization',
    skillExecuted: true,
    validatorExecuted: true,
    artifacts: {firstFramePromptManifest: {sha256: sha256File(filePath)}},
  }, null, 2)}\n`);
  const prepareScriptPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../scripts/prepare-firstframe-batch.mjs',
  );
  const prepared = spawnSync(process.execPath, [
    prepareScriptPath,
    '--manifest',
    filePath,
    '--director-receipt',
    receiptPath,
    '--project-root',
    temporaryRoot,
    '--sample',
    'P01',
  ], {encoding: 'utf8'});
  assert.equal(prepared.status, 0, prepared.stderr);
  const job = JSON.parse(
    readFileSync(path.join(temporaryRoot, 'first-frame-batch.v1.json'), 'utf8'),
  );
  assert.equal(job.samplePolicy, 'one-representative-scene');
  assert.deepEqual(job.sampleSceneIds, ['P01']);
  assert.deepEqual(job.scenes[0].layoutContract, v9Manifest.scenes[0].layoutContract);
  assert.equal(
    job.scenes[0].layoutContractSha256,
    v9Manifest.scenes[0].layoutContractSha256,
  );
} finally {
  rmSync(temporaryRoot, {recursive: true, force: true});
}

console.log(JSON.stringify({ok: true, manifestValidation: true, videoPromptLeakRejected: true, promptDriftRejected: true, duplicateSceneRejected: true, missingAnchorCalibrationGateRejected: true, v9LayoutContractValidated: true, v9OneSceneSampleValidated: true, v9PrepareCliValidated: true}));
