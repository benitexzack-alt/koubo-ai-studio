#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
  chmodSync,
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
} from '../scripts/preproduction-director-core.mjs';

const testRoot = mkdtempSync(path.join(os.tmpdir(), 'koubo-firstframe-bake-test-'));
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(skillRoot, 'scripts/bake-firstframe-text.mjs');

const run = (binary, args, options = {}) =>
  spawnSync(binary, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

try {
  const sourcePath = path.join(testRoot, 'source.png');
  const outputPath = path.join(testRoot, 'baked.png');
  const receiptPath = path.join(testRoot, 'receipt.json');
  const requestPath = path.join(testRoot, 'request.json');
  const imageResult = run('magick', [
    '-size',
    '1280x720',
    'xc:#10243A',
    '-fill',
    '#E8D6AF',
    '-draw',
    'polygon 256,216 1049,245 998,468 205,432',
    sourcePath,
  ]);
  assert.equal(imageResult.status, 0, imageResult.stderr);

  const labels = [
    {
      nodeId: 'N1',
      text: '平台分发',
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
      anchorQuad: [[0.2, 0.3], [0.82, 0.34], [0.78, 0.65], [0.16, 0.6]],
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
  const calibrationPath = path.join(testRoot, 'calibration.json');
  const calibration = {
    schemaVersion: 'koubo-paper-firstframe-anchor-calibration/v1',
    sceneId: 'P01',
    status: 'passed',
    sourceImage: {path: sourcePath, sha256: sha256File(sourcePath)},
    labels: [{nodeId: 'N1', anchorQuad: labels[0].anchorQuad, placementChecked: true}],
  };
  writeFileSync(calibrationPath, `${JSON.stringify(calibration, null, 2)}\n`);
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
        anchorCalibrationRequired: true,
        anchorCalibration: {path: calibrationPath, sha256: sha256File(calibrationPath)},
        calibratedAnchors: [{nodeId: 'N1', anchorQuad: labels[0].anchorQuad}],
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
  assert.equal(
    receipt.scenes[0].ocr[0].preprocessing.mode,
    'inverse-perspective-dual-ocr-v1',
  );
  assert.deepEqual(
    receipt.scenes[0].ocr[0].preprocessing.rectifiedSize,
    {width: 1000, height: 240},
  );
  assert.equal(receipt.scenes[0].ocr[0].preprocessing.language, 'chi_sim');
  assert.ok(['tesseract', 'apple-vision'].includes(
    receipt.scenes[0].ocr[0].preprocessing.selectedEngine,
  ));
  assert.equal(
    receipt.scenes[0].ocr[0].preprocessing.recognitionPolicy,
    'tesseract-then-apple-vision-exact-match-v1',
  );
  assert.ok(receipt.scenes[0].ocr[0].preprocessing.selectedVariantId);
  assert.ok(receipt.scenes[0].ocr[0].preprocessing.typographyAttempts.length >= 1);
  assert.ok(receipt.scenes[0].ocr[0].rendering.pointSize);
  assert.equal(receipt.scenes[0].outputImage.sha256, sha256File(outputPath));
  assert.equal(receipt.scenes[0].ocr[0].evaluationStage, 'final-composite');
  assert.equal(receipt.scenes[0].ocr[0].inputImageSha256, sha256File(outputPath));
  assert.ok(receipt.scenes[0].ocr[0].preprocessing.finalImageAttempts.length >= 1);
  assert.equal(receipt.scenes[0].anchorCalibration.sha256, sha256File(calibrationPath));

  if (process.platform === 'darwin') {
    const mockBinPath = path.join(testRoot, 'mock-bin');
    mkdirSync(mockBinPath);
    const mockTesseractPath = path.join(mockBinPath, 'tesseract');
    writeFileSync(mockTesseractPath, '#!/bin/sh\nprintf "错误\\n"\n');
    chmodSync(mockTesseractPath, 0o755);
    const visionOutputPath = path.join(testRoot, 'vision-baked.png');
    const visionReceiptPath = path.join(testRoot, 'vision-receipt.json');
    const visionRequestPath = path.join(testRoot, 'vision-request.json');
    const visionRequest = structuredClone(request);
    visionRequest.receiptPath = visionReceiptPath;
    visionRequest.scenes[0].outputImage.path = visionOutputPath;
    writeFileSync(visionRequestPath, `${JSON.stringify(visionRequest, null, 2)}\n`);
    const visionFallback = run(
      process.execPath,
      [scriptPath, '--request', visionRequestPath, '--repo-root', testRoot],
      {env: {...process.env, PATH: `${mockBinPath}:${process.env.PATH}`}},
    );
    assert.equal(visionFallback.status, 0, visionFallback.stderr);
    const visionReceipt = JSON.parse(readFileSync(visionReceiptPath, 'utf8'));
    assert.equal(visionReceipt.scenes[0].ocr[0].matched, true);
    assert.equal(
      visionReceipt.scenes[0].ocr[0].preprocessing.selectedEngine,
      'apple-vision',
    );
    assert.equal(visionReceipt.scenes[0].ocr[0].evaluationStage, 'final-composite');
    assert.equal(visionReceipt.scenes[0].ocr[0].inputImageSha256, sha256File(visionOutputPath));
  }

  const multiSourcePath = path.join(testRoot, 'multi-source.png');
  const multiImage = run('magick', ['-size', '1280x720', 'xc:#E8D6AF', multiSourcePath]);
  assert.equal(multiImage.status, 0, multiImage.stderr);
  for (const fixture of [
    {
      id: 'separate',
      quads: [
        [[0.1, 0.1], [0.9, 0.1], [0.9, 0.38], [0.1, 0.38]],
        [[0.1, 0.6], [0.9, 0.6], [0.9, 0.88], [0.1, 0.88]],
      ],
    },
    {
      id: 'overlap',
      quads: [
        [[0.1, 0.3], [0.9, 0.3], [0.9, 0.62], [0.1, 0.62]],
        [[0.6, 0.3], [1, 0.3], [1, 0.62], [0.6, 0.62]],
      ],
    },
  ]) {
    const multiLabels = ['平台', '需求'].map((text, index) => ({
      ...structuredClone(labels[0]),
      nodeId: `N${index + 1}`,
      text,
      anchorQuad: fixture.quads[index],
    }));
    const multiScene = {...sourceScene, textPlan: multiLabels};
    const multiIdentity = buildSceneIdentity(multiScene, 0);
    const multiPlanPath = path.join(testRoot, `${fixture.id}-plan.json`);
    writeFileSync(multiPlanPath, JSON.stringify({...sourcePlan, paperScenes: [multiScene]}));
    const multiCalibrationPath = path.join(testRoot, `${fixture.id}-calibration.json`);
    writeFileSync(multiCalibrationPath, JSON.stringify({
      ...calibration,
      sourceImage: {path: multiSourcePath, sha256: sha256File(multiSourcePath)},
      labels: multiLabels.map(({nodeId, anchorQuad}) => ({nodeId, anchorQuad, placementChecked: true})),
    }));
    const multiRequest = structuredClone(request);
    multiRequest.sourcePlan = {path: multiPlanPath, sha256: sha256File(multiPlanPath)};
    multiRequest.receiptPath = path.join(testRoot, `${fixture.id}-receipt.json`);
    Object.assign(multiRequest.scenes[0], {
      pairId: multiIdentity.pairId,
      pairSha256: multiIdentity.pairSha256,
      textPlanSha256: multiIdentity.textPlanSha256,
      labelsSha256: sha256Json(multiLabels),
      labels: multiLabels,
      sourceImage: {path: multiSourcePath, sha256: sha256File(multiSourcePath)},
      outputImage: {path: path.join(testRoot, `${fixture.id}-baked.png`)},
      anchorCalibration: {path: multiCalibrationPath, sha256: sha256File(multiCalibrationPath)},
      calibratedAnchors: multiLabels.map(({nodeId, anchorQuad}) => ({nodeId, anchorQuad})),
    });
    const multiRequestPath = path.join(testRoot, `${fixture.id}-request.json`);
    writeFileSync(multiRequestPath, JSON.stringify(multiRequest));
    const result = run(process.execPath, [scriptPath, '--request', multiRequestPath, '--repo-root', testRoot]);
    if (fixture.id === 'overlap') {
      assert.notEqual(result.status, 0, 'Later labels must not inherit an earlier OCR pass');
      assert.match(result.stderr, /TEXT_BAKE_OCR_MISMATCH:P01:N1:final-composite/u);
      assert.equal(existsSync(multiRequest.receiptPath), false);
      assert.equal(existsSync(multiRequest.scenes[0].outputImage.path), false);
    } else {
      assert.equal(result.status, 0, result.stderr);
      const multiReceipt = JSON.parse(readFileSync(multiRequest.receiptPath, 'utf8'));
      assert.equal(multiReceipt.scenes[0].ocr.length, 2);
      for (const item of multiReceipt.scenes[0].ocr) {
        assert.equal(item.matched, true);
        assert.equal(item.evaluationStage, 'final-composite');
        assert.equal(item.inputImageSha256, sha256File(multiRequest.scenes[0].outputImage.path));
      }
    }
  }

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

  const calibrationMismatchPath = path.join(testRoot, 'request-calibration-mismatch.json');
  const calibrationMismatch = structuredClone(request);
  calibrationMismatch.receiptPath = path.join(testRoot, 'receipt-calibration-mismatch.json');
  calibrationMismatch.scenes[0].outputImage.path = path.join(testRoot, 'calibration-mismatch.png');
  calibrationMismatch.scenes[0].calibratedAnchors[0].anchorQuad = [
    [0.1, 0.2], [0.9, 0.2], [0.9, 0.7], [0.1, 0.7],
  ];
  writeFileSync(
    calibrationMismatchPath,
    `${JSON.stringify(calibrationMismatch, null, 2)}\n`,
  );
  const calibrationNegative = run(process.execPath, [
    scriptPath,
    '--request',
    calibrationMismatchPath,
    '--repo-root',
    testRoot,
  ]);
  assert.notEqual(calibrationNegative.status, 0);
  assert.match(calibrationNegative.stderr, /TEXT_BAKE_ANCHOR_CALIBRATION_BINDING_INVALID/u);
  assert.equal(existsSync(calibrationMismatch.scenes[0].outputImage.path), false);

  console.log(
    JSON.stringify({
      ok: true,
      deterministicTextBaked: true,
      chineseOcrMatched: true,
      appleVisionFallbackMatched: process.platform === 'darwin',
      sourceTextPlanBound: true,
      sourceShaMismatchRejected: true,
      calibrationMismatchRejected: true,
      finalCompositeOcrBound: true,
      separateLabelsPassed: true,
      laterLabelContaminationRejected: true,
    }),
  );
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
