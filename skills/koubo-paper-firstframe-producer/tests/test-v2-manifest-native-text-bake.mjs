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
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  sha256File,
  sha256Json,
} from '../../koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {
  RAW_VISUAL_CRITERIA,
  sha256Text,
} from '../scripts/firstframe-batch-core.mjs';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const bakerPath = path.join(
  repositoryRoot,
  'skills/koubo-remotion-director/scripts/bake-firstframe-text.mjs',
);
const batchBakerPath = path.join(
  repositoryRoot,
  'skills/koubo-paper-firstframe-producer/scripts/bake-firstframe-batch.mjs',
);
const prepareBatchPath = path.join(
  repositoryRoot,
  'skills/koubo-paper-firstframe-producer/scripts/prepare-firstframe-batch.mjs',
);
const fontPath = path.join(os.homedir(), 'Library/Fonts/NotoSansCJKsc-Regular.otf');

const save = (filePath, value) => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
};

const runBaker = (root, requestPath) => spawnSync(
  process.execPath,
  [bakerPath, '--request', requestPath, '--repo-root', root],
  {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024},
);

const createFixture = (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'koubo-v2-manifest-text-bake-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const sourceImagePath = path.join(root, 'P01_B04_first-frame.png');
  const image = spawnSync(
    'magick',
    ['-size', '1920x1080', 'xc:#F4EAD8', sourceImagePath],
    {encoding: 'utf8'},
  );
  assert.equal(image.status, 0, image.stderr);
  const sourceImage = {path: sourceImagePath, sha256: sha256File(sourceImagePath)};
  const anchorQuad = [[0.2, 0.3], [0.8, 0.3], [0.8, 0.5], [0.2, 0.5]];
  const labels = [{
    nodeId: 'P01-N1',
    text: '成本',
    surfaceDescription: '左前固定空白纸牌',
    groupId: 'P01-G1',
    surfaceId: 'P01-S1',
    embeddingMode: 'first-frame-baked',
    motionConstraint: 'rigid-surface',
    ocrRequired: true,
    anchorQuad,
    anchorQuadStatus: 'provisional-placeholder-actual-calibration-required',
  }];
  const identity = {
    pairId: 'P01-prompt-pair-v1',
    pairSha256: sha256Json({source: 'v2-pair'}),
    textPlanSha256: sha256Json({textPlan: labels, screenTextPlan: []}),
    labelsSha256: sha256Json(labels),
  };
  const manifestPath = save(path.join(root, 'first-frame-prompts.v1.json'), {
    schemaVersion: 'koubo-paper-first-frame-prompt-manifest/v1',
    sourceDirectorSchema: 'koubo-director-cues/v2',
    taskId: 'v2-manifest-native-text-bake-task',
    status: 'automation-input-ready',
    consumer: 'first-frame-image-automation',
    sceneCount: 1,
    scenes: [{
      sceneId: 'P01',
      ...identity,
      deterministicTextBake: {
        enabled: true,
        labelsSha256: identity.labelsSha256,
        labels,
        anchorCalibrationRequired: true,
        ocrRequired: true,
      },
    }],
  });
  const calibrationPath = save(path.join(root, 'P01.calibration.json'), {
    schemaVersion: 'koubo-paper-firstframe-anchor-calibration/v1',
    sceneId: 'P01',
    status: 'passed',
    sourceImage,
    labels: [{nodeId: 'P01-N1', anchorQuad, placementChecked: true}],
  });
  return {root, sourceImage, labels, identity, manifestPath, calibrationPath, anchorQuad};
};

const buildRequest = (fixture, suffix, overrides = {}) => {
  const outputPath = path.join(fixture.root, `P01-text-baked-${suffix}.png`);
  const receiptPath = path.join(fixture.root, `receipt-${suffix}.json`);
  const request = {
    schemaVersion: 'koubo-paper-firstframe-text-bake-request/v1',
    taskId: 'v2-manifest-native-text-bake-task',
    sourceDirectorSchema: 'koubo-director-cues/v2',
    sourceFirstFrameManifest: {
      path: fixture.manifestPath,
      sha256: sha256File(fixture.manifestPath),
    },
    // A v2 request must never consult a legacy source plan, even if a stale
    // field is present on a caller-created request.
    sourcePlan: {path: path.join(fixture.root, 'must-not-be-read.json'), sha256: '0'.repeat(64)},
    fontPath,
    receiptPath,
    scenes: [{
      sceneId: 'P01',
      pairId: fixture.identity.pairId,
      pairSha256: fixture.identity.pairSha256,
      textPlanSha256: fixture.identity.textPlanSha256,
      labelsSha256: fixture.identity.labelsSha256,
      sourceImage: fixture.sourceImage,
      outputImage: {path: outputPath},
      labels: fixture.labels,
      anchorCalibrationRequired: true,
      anchorCalibration: {
        path: fixture.calibrationPath,
        sha256: sha256File(fixture.calibrationPath),
      },
      calibratedAnchors: [{nodeId: 'P01-N1', anchorQuad: fixture.anchorQuad}],
      ...overrides,
    }],
  };
  const requestPath = save(path.join(fixture.root, `request-${suffix}.json`), request);
  return {requestPath, receiptPath, outputPath};
};

test('v2 manifest-native 烘焙不读 source plan 并保留最终合成图 OCR 回执', (t) => {
  assert.equal(existsSync(fontPath), true, `missing test font: ${fontPath}`);
  const fixture = createFixture(t);
  const run = buildRequest(fixture, 'ok');
  const result = runBaker(fixture.root, run.requestPath);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(run.outputPath), true);
  const receipt = JSON.parse(readFileSync(run.receiptPath, 'utf8'));
  assert.equal(receipt.status, 'deterministic-first-frame-text-baked-and-ocr-passed');
  assert.equal(receipt.sourceDirectorSchema, 'koubo-director-cues/v2');
  assert.deepEqual(receipt.sourceFirstFrameManifest, {
    path: fixture.manifestPath,
    sha256: sha256File(fixture.manifestPath),
  });
  assert.equal(Object.hasOwn(receipt, 'sourcePlan'), false);
  assert.equal(receipt.scenes[0].pairId, fixture.identity.pairId);
  assert.equal(receipt.scenes[0].pairSha256, fixture.identity.pairSha256);
  assert.equal(receipt.scenes[0].textPlanSha256, fixture.identity.textPlanSha256);
  assert.equal(receipt.scenes[0].labelsSha256, fixture.identity.labelsSha256);
  assert.equal(receipt.scenes[0].ocr[0].matched, true);
  assert.equal(receipt.scenes[0].ocr[0].evaluationStage, 'final-composite');
  assert.equal(
    receipt.scenes[0].ocr[0].inputImageSha256,
    receipt.scenes[0].outputImage.sha256,
  );
});

test('v2 manifest-native 逐项拒绝 scene 的 pair/text/labels 身份漂移', (t) => {
  const fixture = createFixture(t);
  const cases = [
    ['pair-id', {pairId: 'P01-tampered-pair'}],
    ['pair-sha', {pairSha256: '1'.repeat(64)}],
    ['text-plan-sha', {textPlanSha256: '2'.repeat(64)}],
    ['labels-sha', {labelsSha256: '3'.repeat(64)}],
  ];
  for (const [suffix, overrides] of cases) {
    const run = buildRequest(fixture, suffix, overrides);
    const result = runBaker(fixture.root, run.requestPath);
    assert.notEqual(result.status, 0, suffix);
    assert.match(result.stderr, /TEXT_BAKE_V2_MANIFEST_SCENE_IDENTITY_MISMATCH:P01/u);
    assert.equal(existsSync(run.outputPath), false);
    assert.equal(existsSync(run.receiptPath), false);
  }
});

test('v2 批处理入口无 source plan 完成 manifest-native 烘焙与 OCR', (t) => {
  assert.equal(existsSync(fontPath), true, `missing test font: ${fontPath}`);
  const root = mkdtempSync(path.join(repositoryRoot, '.tmp-v2-batch-text-bake-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const taskId = 'v2-batch-manifest-native-text-bake-task';
  const requestId = 'v2-paper-firstframe:test:r1';
  const revisionId = 'r1';
  const sceneId = 'P01';
  const pairId = 'P01-prompt-pair-v1';
  const pairSha256 = sha256Json({source: 'v2-batch-pair'});
  const anchorQuad = [[0.2, 0.3], [0.8, 0.3], [0.8, 0.5], [0.2, 0.5]];
  const labels = [{
    nodeId: 'P01-N1',
    text: '成本',
    surfaceDescription: '左前固定空白纸牌',
    groupId: 'P01-G1',
    surfaceId: 'P01-S1',
    embeddingMode: 'first-frame-baked',
    motionConstraint: 'rigid-surface',
    ocrRequired: true,
    anchorQuad,
    anchorQuadStatus: 'provisional-placeholder-actual-calibration-required',
  }];
  const labelsSha256 = sha256Json(labels);
  const textPlanSha256 = sha256Json({textPlan: labels, screenTextPlan: []});
  const firstFramePrompt = '纸艺首帧离线批处理夹具，画面不生成可读文字。';
  const outputFileName = 'P01_B01_first-frame.png';
  const bakedOutputFileName = 'P01_B01_first-frame-text-baked.png';
  const bind = (filePath) => ({path: filePath, sha256: sha256File(filePath)});

  const cuesPath = save(path.join(root, 'director-cues.v2.json'), {
    schemaVersion: 'koubo-director-cues/v2', taskId,
  });
  const approvalPath = save(path.join(root, 'approval.v2.json'), {
    schemaVersion: 'koubo-director-cues-user-approval/v2',
    status: 'approved', approved: true, taskId, revisionId,
  });
  const paperPath = save(path.join(root, 'paper-firstframe.json'), {
    schemaVersion: 'koubo-director-route-prompt-handoff/v1',
    status: 'planned', sourceRoute: 'paper-editorial', promptKind: 'first-frame',
    taskId, revisionId,
    items: [{
      id: sceneId,
      beatId: 'B01',
      pairId,
      pairSha256,
      prompt: firstFramePrompt,
      promptSha256: sha256Text(firstFramePrompt),
    }],
  });
  const masterPath = save(path.join(root, 'handoff-master.json'), {
    schemaVersion: 'koubo-director-cues-v2-handoff/v1',
    status: 'local-handoff-ready', taskId, revisionId,
    artifacts: {paperFirstFrame: bind(paperPath)},
  });
  const handoffReceiptPath = save(path.join(root, 'handoff-receipt.json'), {
    schemaVersion: 'koubo-director-cues-v2-handoff-validation-receipt/v1',
    status: 'validated-local-handoff', skillExecuted: true, validatorExecuted: true,
    taskId, revisionId,
    handoffMaster: bind(masterPath),
    artifacts: {paperFirstFrame: bind(paperPath)},
  });
  const manifestPath = save(path.join(root, 'first-frame-prompts.v1.json'), {
    schemaVersion: 'koubo-paper-first-frame-prompt-manifest/v1',
    sourceDirectorSchema: 'koubo-director-cues/v2',
    sourceBridgeSchema: 'koubo-director-cues-v2-firstframe-bridge/v1',
    taskId, requestId, revisionId,
    status: 'automation-input-ready',
    consumer: 'first-frame-image-automation',
    samplePolicy: 'one-representative-scene',
    selectedSceneId: sceneId,
    generatedReadableTextAllowed: false,
    policy: {incidentPreventionVersion: '1'},
    sourceDirectorCues: bind(cuesPath),
    sourceUserApproval: bind(approvalPath),
    sourceDirectorV2HandoffMaster: bind(masterPath),
    sourceDirectorV2HandoffValidationReceipt: bind(handoffReceiptPath),
    sourcePaperFirstFrameHandoff: bind(paperPath),
    sceneCount: 1,
    scenes: [{
      sceneId,
      pairId,
      pairSha256,
      beatId: 'B01',
      title: '成本纸牌',
      aspectRatio: '16:9',
      outputFileName,
      firstFramePrompt,
      firstFramePromptSha256: sha256Text(firstFramePrompt),
      textPlanSha256,
      generatedReadableTextAllowed: false,
      deterministicTextBake: {
        enabled: true,
        sourceImageFileName: outputFileName,
        outputImageFileName: bakedOutputFileName,
        labelsSha256,
        labels,
        anchorCalibrationRequired: true,
        ocrRequired: true,
      },
    }],
  });
  const bridgeReceiptPath = save(path.join(root, 'bridge-receipt.v1.json'), {
    schemaVersion: 'koubo-director-cues-v2-firstframe-bridge-receipt/v1',
    status: 'validated-v2-native-firstframe-input',
    skillExecuted: true,
    validatorExecuted: true,
    sourceDirectorSchema: 'koubo-director-cues/v2',
    sourceBridgeSchema: 'koubo-director-cues-v2-firstframe-bridge/v1',
    taskId, requestId, revisionId,
    samplePolicy: 'one-representative-scene',
    selectedSceneId: sceneId,
    policy: {incidentPreventionVersion: '1'},
    artifacts: {
      directorCues: bind(cuesPath),
      userApproval: bind(approvalPath),
      directorV2HandoffMaster: bind(masterPath),
      directorV2HandoffValidationReceipt: bind(handoffReceiptPath),
      paperFirstFrameHandoff: bind(paperPath),
      firstFramePromptManifest: bind(manifestPath),
    },
  });

  const prepared = spawnSync(process.execPath, [
    prepareBatchPath,
    '--project-root', repositoryRoot,
    '--manifest', manifestPath,
    '--director-receipt', bridgeReceiptPath,
    '--sample', sceneId,
  ], {encoding: 'utf8'});
  assert.equal(prepared.status, 0, prepared.stderr);
  const jobPath = path.join(root, 'first-frame-batch.v1.json');
  const job = JSON.parse(readFileSync(jobPath, 'utf8'));
  assert.equal(job.sourceBridgeSchema, 'koubo-director-cues-v2-firstframe-bridge/v1');
  const scene = job.scenes[0];
  mkdirSync(path.dirname(scene.outputPath), {recursive: true});
  const image = spawnSync(
    'magick',
    ['-size', '1920x1080', 'xc:#F4EAD8', scene.outputPath],
    {encoding: 'utf8'},
  );
  assert.equal(image.status, 0, image.stderr);
  const imageSha256 = sha256File(scene.outputPath);
  const reviewPath = save(path.join(job.output.qaRoot, `${sceneId}.visual-review.v1.json`), {
    schemaVersion: 'koubo-paper-firstframe-visual-review/v1',
    sceneId,
    imageSha256,
    status: 'passed',
    notes: '离线批处理入口回归夹具，不作真实视觉验收。',
    criteria: Object.fromEntries(RAW_VISUAL_CRITERIA.map((key) => [key, 'passed'])),
  });
  const calibrationPath = scene.deterministicTextBake.calibrationPath;
  save(calibrationPath, {
    schemaVersion: 'koubo-paper-firstframe-anchor-calibration/v1',
    sceneId,
    status: 'passed',
    sourceImage: {path: scene.outputPath, sha256: imageSha256},
    labels: [{nodeId: 'P01-N1', anchorQuad, placementChecked: true}],
  });
  scene.result = {
    imagePath: scene.outputPath,
    imageSha256,
    visualReview: {path: reviewPath},
  };
  writeFileSync(jobPath, `${JSON.stringify(job, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    batchBakerPath,
    '--project-root', repositoryRoot,
    '--job', jobPath,
    '--font', fontPath,
    '--phase', 'sample',
  ], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  assert.equal(result.status, 0, result.stderr);
  const completedJob = JSON.parse(readFileSync(jobPath, 'utf8'));
  const bakeRecord = completedJob.textBakeReceipts.at(-1);
  const request = JSON.parse(readFileSync(bakeRecord.request.path, 'utf8'));
  const receipt = JSON.parse(readFileSync(bakeRecord.receipt.path, 'utf8'));
  assert.equal(Object.hasOwn(request, 'sourcePlan'), false);
  assert.deepEqual(request.sourceFirstFrameManifest, bind(manifestPath));
  assert.equal(Object.hasOwn(receipt, 'sourcePlan'), false);
  assert.deepEqual(receipt.sourceFirstFrameManifest, bind(manifestPath));
  assert.equal(receipt.scenes[0].ocr[0].matched, true);
  assert.equal(completedJob.status, 'candidate-text-baked-firstframes-awaiting-user-review');
});
