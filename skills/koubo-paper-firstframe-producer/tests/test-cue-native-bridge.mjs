#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  isFullBatchAuthorized,
  readAuthoritativeSourceManifest,
  sha256File,
  sha256Json,
  sha256Text,
  validateManifest,
  validateSampleSceneIds,
} from '../scripts/firstframe-batch-core.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scratch = mkdtempSync(path.join(projectRoot, '.tmp-cue-native-bridge-'));
const cuesPath = path.join(projectRoot, 'edit/20260910_lanzhou_industry_ai/03_导演拆解/director-core-regression-r1/director-cues.v1.json');
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bridgePath = path.join(skillRoot, 'scripts/bridge-director-cues.mjs');
const preparePath = path.join(skillRoot, 'scripts/prepare-firstframe-batch.mjs');
const recordPath = path.join(skillRoot, 'scripts/record-firstframe-result.mjs');
const bakePath = path.join(skillRoot, 'scripts/bake-firstframe-batch.mjs');
const validatePath = path.join(skillRoot, 'scripts/validate-firstframe-batch.mjs');
const contactSheetPath = path.join(skillRoot, 'scripts/build-firstframe-contact-sheet.mjs');
const authorizeFullBatchPath = path.join(skillRoot, 'scripts/authorize-firstframe-full-batch.mjs');
const migrateRouteLockPath = path.join(
  skillRoot,
  'scripts/migrate-cue-native-firstframe-route-lock.mjs',
);
const cues = JSON.parse(readFileSync(cuesPath, 'utf8'));
const baseAcceptance = {
  schemaVersion: 'koubo-director-cues-user-acceptance/v1',
  taskId: cues.taskId,
  requestId: 'cue-native-offline-test-r1',
  revisionId: 'offline-r1',
  status: 'approved-for-one-representative-firstframe',
  approved: true,
  scope: 'one-representative-firstframe',
  selectedSceneId: 'P02',
  cuesSha256: sha256File(cuesPath),
  userConfirmationText: '好的，继续验证。',
  acceptedAt: '2026-09-12T00:00:00Z',
};
const run = (script, args) => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8'});
const writeJson = (filePath, value) => writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

try {
  const acceptancePath = path.join(scratch, 'acceptance.json');
  const outputDir = path.join(scratch, 'bridge-r1');
  writeJson(acceptancePath, baseAcceptance);
  const result = run(bridgePath, ['--project-root', projectRoot, '--cues', cuesPath, '--acceptance', acceptancePath, '--output-dir', outputDir]);
  assert.equal(result.status, 0, result.stderr);

  const sourcePlan = JSON.parse(readFileSync(path.join(outputDir, 'director-cue-native-source-plan.v1.json')));
  const firstFrame = JSON.parse(readFileSync(path.join(outputDir, 'first-frame-prompts.v1.json')));
  const runningHub = JSON.parse(readFileSync(path.join(outputDir, 'runninghub-image-to-video-prompts.v1.json')));
  const receiptPath = path.join(outputDir, 'director-validation-receipt.v1.json');
  const receipt = JSON.parse(readFileSync(receiptPath));
  assert.equal(firstFrame.sourceDirectorSchema, 'koubo-director-cues/v1');
  assert.equal(firstFrame.samplePolicy, 'one-representative-scene');
  assert.equal(firstFrame.selectedSceneId, 'P02');
  assert.deepEqual(validateSampleSceneIds(firstFrame, ['P02']), []);
  assert.ok(validateSampleSceneIds(firstFrame, ['P01']).some(
    (error) => error.startsWith('CUE_NATIVE_SAMPLE_SCENE_MISMATCH:'),
  ));
  const missingSelectedScene = structuredClone(firstFrame);
  delete missingSelectedScene.selectedSceneId;
  assert.ok(validateManifest(missingSelectedScene).includes('CUE_NATIVE_SELECTED_SCENE_REQUIRED'));
  assert.equal(firstFrame.scenes[1].firstFramePrompt, cues.inserts[1].firstFramePrompt);
  assert.equal(sourcePlan.paperScenes[1].prompt.motion, cues.inserts[1].videoPrompt);
  assert.ok(firstFrame.scenes.every((scene) => !Object.hasOwn(scene, 'imageToVideoPrompt')));
  assert.ok(!JSON.stringify(firstFrame).includes(cues.inserts[1].videoPrompt));
  assert.equal(runningHub.scenes[1].imageToVideoPrompt, cues.inserts[1].videoPrompt);
  assert.equal(receipt.status, 'validated-provisional-previsualization');
  assert.equal(receipt.skillExecuted, true);
  assert.equal(receipt.validatorExecuted, true);
  assert.equal(receipt.policy.incidentPreventionVersion, '1');
  for (const binding of Object.values(receipt.artifacts)) assert.equal(binding.sha256, sha256File(binding.path));

  const prepared = run(preparePath, ['--project-root', projectRoot, '--manifest', path.join(outputDir, 'first-frame-prompts.v1.json'), '--director-receipt', receiptPath, '--sample', 'P02']);
  assert.equal(prepared.status, 0, prepared.stderr);
  const jobPath = path.join(outputDir, 'first-frame-batch.v1.json');
  const job = JSON.parse(readFileSync(jobPath));
  const routeLockPath = path.join(outputDir, 'first-frame-route-lock.v1.json');
  const routeLock = JSON.parse(readFileSync(routeLockPath));
  assert.equal(job.samplePolicy, 'one-representative-scene');
  assert.deepEqual(job.sampleSceneIds, ['P02']);
  assert.equal(job.fullBatchAuthorized, false);
  assert.equal(routeLock.schemaVersion, 'koubo-paper-firstframe-route-lock/v1');
  assert.equal(routeLock.route, 'cue-native');
  assert.equal(routeLock.cueNative, true);
  assert.equal(routeLock.jobPath, jobPath);
  assert.deepEqual(routeLock.sampleSceneIds, ['P02']);
  assert.equal(routeLock.sourceManifest.sha256, job.sourceManifest.sha256);

  const jobShaBeforeRouteLockMigration = sha256File(jobPath);
  rmSync(routeLockPath);
  const migrationArgs = [
    '--project-root', projectRoot,
    '--job', jobPath,
    '--expected-task-id', job.taskId,
    '--expected-request-id', job.requestId,
    '--expected-revision-id', job.revisionId,
    '--expected-selected-scene', 'P02',
    '--expected-manifest-sha256', job.sourceManifest.sha256,
    '--expected-director-receipt-sha256', job.directorValidationReceipt.sha256,
  ];
  const wrongMigrationSha = [...migrationArgs];
  wrongMigrationSha[wrongMigrationSha.indexOf('--expected-manifest-sha256') + 1] = '0'.repeat(64);
  const rejectedMigration = run(migrateRouteLockPath, wrongMigrationSha);
  assert.notEqual(rejectedMigration.status, 0);
  assert.match(rejectedMigration.stderr, /ROUTE_LOCK_MIGRATION_EXPECTED_SOURCE_SHA_MISMATCH/u);
  const migrated = run(migrateRouteLockPath, migrationArgs);
  assert.equal(migrated.status, 0, migrated.stderr);
  assert.equal(sha256File(jobPath), jobShaBeforeRouteLockMigration);
  const overwriteMigration = run(migrateRouteLockPath, migrationArgs);
  assert.notEqual(overwriteMigration.status, 0);
  assert.match(overwriteMigration.stderr, /OUTPUT_ALREADY_EXISTS/u);

  const wrongSample = run(preparePath, ['--project-root', projectRoot, '--manifest', path.join(outputDir, 'first-frame-prompts.v1.json'), '--director-receipt', receiptPath, '--sample', 'P01']);
  assert.notEqual(wrongSample.status, 0);
  assert.match(wrongSample.stderr, /CUE_NATIVE_SAMPLE_SCENE_MISMATCH/u);

  const sourceSchemaStrippedJob = structuredClone(job);
  delete sourceSchemaStrippedJob.sourceDirectorSchema;
  sourceSchemaStrippedJob.fullBatchAuthorized = true;
  sourceSchemaStrippedJob.status = 'full-generation-authorized';
  writeJson(jobPath, sourceSchemaStrippedJob);
  const sourceSchemaStrippedRecord = run(recordPath, [
    '--job', jobPath,
    '--scene', 'P03',
    '--image', sourceSchemaStrippedJob.scenes[2].outputPath,
    '--execution-prompt-file', path.join(sourceSchemaStrippedJob.output.qaRoot, 'P03.execution-prompt.txt'),
    '--tool', 'image_gen',
  ]);
  assert.notEqual(sourceSchemaStrippedRecord.status, 0);
  assert.match(sourceSchemaStrippedRecord.stderr, /FIRSTFRAME_JOB_STATIC_CONTRACT_MISMATCH/u);

  const sampleBindingDriftJob = structuredClone(sourceSchemaStrippedJob);
  sampleBindingDriftJob.sampleSceneIds = ['P03'];
  writeJson(jobPath, sampleBindingDriftJob);
  const sourceSchemaStrippedContact = run(contactSheetPath, [
    '--job', jobPath,
    '--phase', 'sample',
  ]);
  assert.notEqual(sourceSchemaStrippedContact.status, 0);
  assert.match(sourceSchemaStrippedContact.stderr, /FIRSTFRAME_JOB_STATIC_CONTRACT_MISMATCH/u);

  const sourceManifestDriftJob = structuredClone(job);
  sourceManifestDriftJob.sourceManifest.sha256 = '0'.repeat(64);
  writeJson(jobPath, sourceManifestDriftJob);
  const sourceManifestDriftRecord = run(recordPath, [
    '--job', jobPath,
    '--scene', 'P02',
    '--image', sourceManifestDriftJob.scenes[1].outputPath,
    '--execution-prompt-file', path.join(sourceManifestDriftJob.output.qaRoot, 'P02.execution-prompt.txt'),
    '--tool', 'image_gen',
  ]);
  assert.notEqual(sourceManifestDriftRecord.status, 0);
  assert.match(sourceManifestDriftRecord.stderr, /FIRSTFRAME_ROUTE_LOCK_MANIFEST_BINDING_MISMATCH/u);

  const oldV9ManifestPath = path.join(
    projectRoot,
    'edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4/first-frame-prompts.v1.json',
  );
  const oldV9PivotJob = structuredClone(job);
  oldV9PivotJob.sourceManifest = {
    path: oldV9ManifestPath,
    sha256: sha256File(oldV9ManifestPath),
  };
  delete oldV9PivotJob.sourceDirectorSchema;
  oldV9PivotJob.fullBatchAuthorized = true;
  oldV9PivotJob.status = 'full-generation-authorized';
  writeJson(jobPath, oldV9PivotJob);
  const pivotAttempts = [
    run(recordPath, [
      '--job', jobPath,
      '--scene', 'P03',
      '--image', oldV9PivotJob.scenes[2].outputPath,
      '--execution-prompt-file', path.join(oldV9PivotJob.output.qaRoot, 'P03.execution-prompt.txt'),
      '--tool', 'image_gen',
    ]),
    run(contactSheetPath, ['--job', jobPath, '--phase', 'sample']),
    run(bakePath, [
      '--project-root', projectRoot,
      '--job', jobPath,
      '--source-plan', path.join(outputDir, 'director-cue-native-source-plan.v1.json'),
      '--font', acceptancePath,
      '--phase', 'sample',
    ]),
    run(validatePath, ['--job', jobPath, '--phase', 'sample']),
    run(authorizeFullBatchPath, [
      '--project-root', projectRoot,
      '--job', jobPath,
      '--acceptance', acceptancePath,
    ]),
  ];
  for (const pivotAttempt of pivotAttempts) {
    assert.notEqual(pivotAttempt.status, 0);
    assert.match(pivotAttempt.stderr, /FIRSTFRAME_ROUTE_LOCK_MANIFEST_BINDING_MISMATCH/u);
  }

  const oldV9Dir = path.join(scratch, 'self-consistent-old-v9');
  mkdirSync(oldV9Dir, {recursive: true});
  const oldV9ManifestCopyPath = path.join(oldV9Dir, 'first-frame-prompts.v1.json');
  const oldV9ReceiptCopyPath = path.join(oldV9Dir, 'director-validation-receipt.v1.json');
  const oldV9Manifest = JSON.parse(readFileSync(oldV9ManifestPath));
  writeJson(oldV9ManifestCopyPath, oldV9Manifest);
  const oldV9ReceiptSourcePath = path.join(
    projectRoot,
    'edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4/validation-receipt.v1.json',
  );
  const oldV9Receipt = JSON.parse(readFileSync(oldV9ReceiptSourcePath));
  oldV9Receipt.artifacts.firstFramePromptManifest = {
    path: oldV9ManifestCopyPath,
    sha256: sha256File(oldV9ManifestCopyPath),
  };
  writeJson(oldV9ReceiptCopyPath, oldV9Receipt);
  const oldV9Prepared = run(preparePath, [
    '--project-root', projectRoot,
    '--manifest', oldV9ManifestCopyPath,
    '--director-receipt', oldV9ReceiptCopyPath,
    '--sample', 'P01',
  ]);
  assert.equal(oldV9Prepared.status, 0, oldV9Prepared.stderr);
  const wholeOldV9Replacement = JSON.parse(readFileSync(
    path.join(oldV9Dir, 'first-frame-batch.v1.json'),
  ));
  wholeOldV9Replacement.fullBatchAuthorized = true;
  wholeOldV9Replacement.status = 'full-generation-authorized';
  writeJson(jobPath, wholeOldV9Replacement);
  const wholeReplacementAttempts = [
    run(recordPath, [
      '--job', jobPath,
      '--scene', 'P03',
      '--image', wholeOldV9Replacement.scenes[2].outputPath,
      '--execution-prompt-file', path.join(wholeOldV9Replacement.output.qaRoot, 'P03.execution-prompt.txt'),
      '--tool', 'image_gen',
    ]),
    run(contactSheetPath, ['--job', jobPath, '--phase', 'sample']),
    run(bakePath, [
      '--project-root', projectRoot,
      '--job', jobPath,
      '--source-plan', path.join(outputDir, 'director-cue-native-source-plan.v1.json'),
      '--font', acceptancePath,
      '--phase', 'sample',
    ]),
    run(validatePath, ['--job', jobPath, '--phase', 'sample']),
    run(authorizeFullBatchPath, [
      '--project-root', projectRoot,
      '--job', jobPath,
      '--acceptance', acceptancePath,
    ]),
  ];
  for (const replacementAttempt of wholeReplacementAttempts) {
    assert.notEqual(replacementAttempt.status, 0);
    assert.match(replacementAttempt.stderr, /FIRSTFRAME_ROUTE_LOCK_IDENTITY_MISMATCH/u);
  }

  const promptDriftJob = structuredClone(job);
  const promptDriftScene = promptDriftJob.scenes.find((scene) => scene.sceneId === 'P02');
  promptDriftScene.firstFramePrompt += '\n伪造的本地提示词漂移';
  promptDriftScene.firstFramePromptSha256 = sha256Text(promptDriftScene.firstFramePrompt);
  writeJson(jobPath, promptDriftJob);
  const promptDriftAttempts = [
    run(recordPath, [
      '--job', jobPath,
      '--scene', 'P02',
      '--image', promptDriftScene.outputPath,
      '--execution-prompt-file', path.join(promptDriftJob.output.qaRoot, 'P02.execution-prompt.txt'),
      '--tool', 'image_gen',
    ]),
    run(contactSheetPath, ['--job', jobPath, '--phase', 'sample']),
    run(bakePath, [
      '--project-root', projectRoot,
      '--job', jobPath,
      '--source-plan', path.join(outputDir, 'director-cue-native-source-plan.v1.json'),
      '--font', acceptancePath,
      '--phase', 'sample',
    ]),
    run(validatePath, ['--job', jobPath, '--phase', 'sample']),
    run(authorizeFullBatchPath, [
      '--project-root', projectRoot,
      '--job', jobPath,
      '--acceptance', acceptancePath,
    ]),
  ];
  for (const promptDriftAttempt of promptDriftAttempts) {
    assert.notEqual(promptDriftAttempt.status, 0);
    assert.match(promptDriftAttempt.stderr, /FIRSTFRAME_JOB_SCENE_SNAPSHOT_MISMATCH:P02/u);
  }

  const sceneOrderDriftJob = structuredClone(job);
  [sceneOrderDriftJob.scenes[0], sceneOrderDriftJob.scenes[1]] =
    [sceneOrderDriftJob.scenes[1], sceneOrderDriftJob.scenes[0]];
  writeJson(jobPath, sceneOrderDriftJob);
  const sceneOrderDrift = run(contactSheetPath, [
    '--job', jobPath,
    '--phase', 'sample',
  ]);
  assert.notEqual(sceneOrderDrift.status, 0);
  assert.match(sceneOrderDrift.stderr, /FIRSTFRAME_JOB_SCENE_SNAPSHOT_MISMATCH:P01/u);

  for (const mutate of [
    (scene) => { scene.pairId = 'P02-forged-pair'; },
    (scene) => { scene.pairSha256 = '0'.repeat(64); },
    (scene) => { scene.textPlanSha256 = '1'.repeat(64); },
    (scene) => {
      scene.deterministicTextBake.labels[0].text += '漂移';
      scene.deterministicTextBake.labelsSha256 = sha256Json(
        scene.deterministicTextBake.labels,
      );
    },
    (scene) => { scene.outputPath = path.join(outputDir, 'forged-P02.png'); },
  ]) {
    const sceneContractDriftJob = structuredClone(job);
    mutate(sceneContractDriftJob.scenes.find((scene) => scene.sceneId === 'P02'));
    writeJson(jobPath, sceneContractDriftJob);
    const sceneContractDrift = run(contactSheetPath, [
      '--job', jobPath,
      '--phase', 'sample',
    ]);
    assert.notEqual(sceneContractDrift.status, 0);
    assert.match(sceneContractDrift.stderr, /FIRSTFRAME_JOB_SCENE_SNAPSHOT_MISMATCH:P02/u);
  }

  writeJson(jobPath, job);
  const runtimeOnlyChanges = structuredClone(job);
  runtimeOnlyChanges.status = 'candidate-stills-awaiting-user-review';
  runtimeOnlyChanges.events.push({type: 'offline-runtime-whitelist-test', at: '2026-09-12T00:00:00Z'});
  runtimeOnlyChanges.textBakeReceipts = [];
  runtimeOnlyChanges.scenes[1].result = {fixtureOnly: true};
  assert.doesNotThrow(() =>
    readAuthoritativeSourceManifest(runtimeOnlyChanges, jobPath),
  );

  const directorReceiptHashDriftJob = structuredClone(job);
  directorReceiptHashDriftJob.directorValidationReceipt.sha256 = '0'.repeat(64);
  writeJson(jobPath, directorReceiptHashDriftJob);
  const directorReceiptHashDrift = run(recordPath, [
    '--job', jobPath,
    '--scene', 'P02',
    '--image', directorReceiptHashDriftJob.scenes[1].outputPath,
    '--execution-prompt-file', path.join(directorReceiptHashDriftJob.output.qaRoot, 'P02.execution-prompt.txt'),
    '--tool', 'image_gen',
  ]);
  assert.notEqual(directorReceiptHashDrift.status, 0);
  assert.match(directorReceiptHashDrift.stderr, /FIRSTFRAME_ROUTE_LOCK_RECEIPT_BINDING_MISMATCH/u);

  for (const [field, value, errorCode] of [
    ['taskId', 'wrong-task', 'DIRECTOR_RECEIPT_IDENTITY_MISMATCH'],
    ['requestId', 'wrong-request', 'DIRECTOR_RECEIPT_IDENTITY_MISMATCH'],
    ['revisionId', 'wrong-revision', 'DIRECTOR_RECEIPT_REVISION_MISMATCH'],
  ]) {
    const changedReceipt = structuredClone(receipt);
    changedReceipt[field] = value;
    const changedReceiptPath = path.join(outputDir, `director-validation-${field}-drift.v1.json`);
    writeJson(changedReceiptPath, changedReceipt);
    const changedReceiptJob = structuredClone(job);
    changedReceiptJob.directorValidationReceipt = {
      path: changedReceiptPath,
      sha256: sha256File(changedReceiptPath),
    };
    writeJson(jobPath, changedReceiptJob);
    const changedIdentity = run(recordPath, [
      '--job', jobPath,
      '--scene', 'P02',
      '--image', changedReceiptJob.scenes[1].outputPath,
      '--execution-prompt-file', path.join(changedReceiptJob.output.qaRoot, 'P02.execution-prompt.txt'),
      '--tool', 'image_gen',
    ]);
    assert.notEqual(changedIdentity.status, 0);
    assert.match(changedIdentity.stderr, /FIRSTFRAME_ROUTE_LOCK_RECEIPT_BINDING_MISMATCH/u);
  }
  writeJson(jobPath, job);

  const unauthorizedRecord = run(recordPath, [
    '--job', jobPath,
    '--scene', 'P01',
    '--image', job.scenes[0].outputPath,
    '--execution-prompt-file', path.join(job.output.qaRoot, 'P01.execution-prompt.txt'),
    '--tool', 'image_gen',
  ]);
  assert.notEqual(unauthorizedRecord.status, 0);
  assert.match(unauthorizedRecord.stderr, /FIRSTFRAME_SCENE_NOT_AUTHORIZED:P01/u);

  const unauthorizedBake = run(bakePath, [
    '--project-root', projectRoot,
    '--job', jobPath,
    '--source-plan', path.join(outputDir, 'director-cue-native-source-plan.v1.json'),
    '--font', acceptancePath,
    '--phase', 'full',
  ]);
  assert.notEqual(unauthorizedBake.status, 0);
  assert.match(unauthorizedBake.stderr, /FULL_BATCH_NOT_AUTHORIZED:TEXT_BAKE_FULL/u);

  const unauthorizedValidation = run(validatePath, [
    '--job', jobPath,
    '--phase', 'full',
  ]);
  assert.notEqual(unauthorizedValidation.status, 0);
  assert.match(unauthorizedValidation.stderr, /FULL_BATCH_NOT_AUTHORIZED:BATCH_VALIDATION_FULL/u);

  const unauthorizedContactSheet = run(contactSheetPath, [
    '--job', jobPath,
    '--phase', 'full',
  ]);
  assert.notEqual(unauthorizedContactSheet.status, 0);
  assert.match(unauthorizedContactSheet.stderr, /FULL_BATCH_NOT_AUTHORIZED:CONTACT_SHEET_FULL/u);

  const candidateJob = structuredClone(job);
  const selectedScene = candidateJob.scenes.find((scene) => scene.sceneId === 'P02');
  writeFileSync(selectedScene.outputPath, 'synthetic-cue-native-raw-image');
  selectedScene.result = {
    imagePath: selectedScene.outputPath,
    imageSha256: sha256File(selectedScene.outputPath),
    recordedAt: '2026-09-12T00:01:00Z',
  };
  const rawReviewPath = path.join(candidateJob.output.qaRoot, 'P02.visual-review.v1.json');
  writeJson(rawReviewPath, {
    schemaVersion: 'koubo-paper-firstframe-visual-review/v1',
    sceneId: 'P02',
    imageSha256: selectedScene.result.imageSha256,
    status: 'passed',
    criteria: Object.fromEntries([
      'semanticMatch', 'paperMaterial', 'depthAndContact', 'cleanTextAndBrand',
      'compositionAndReadability', 'videoReadiness',
    ].map((criterion) => [criterion, 'passed'])),
    notes: '离线结构夹具，只验证授权哈希与状态门，不构成真实图像验收。',
  });

  const bakedImagePath = selectedScene.deterministicTextBake.outputPath;
  writeFileSync(bakedImagePath, 'synthetic-cue-native-text-baked-image');
  const bakedImageSha256 = sha256File(bakedImagePath);
  const sampleBakeReceiptPath = path.join(candidateJob.output.qaRoot, 'sample-text-bake-receipt.v1.json');
  const sampleBakeReceipt = {
    schemaVersion: 'koubo-paper-firstframe-text-bake-receipt/v1',
    taskId: candidateJob.taskId,
    status: 'deterministic-first-frame-text-baked-and-ocr-passed',
    scenes: [{
      sceneId: selectedScene.sceneId,
      pairId: selectedScene.pairId,
      pairSha256: selectedScene.pairSha256,
      textPlanSha256: selectedScene.textPlanSha256,
      labelsSha256: selectedScene.deterministicTextBake.labelsSha256,
      outputImage: {path: bakedImagePath, sha256: bakedImageSha256},
      ocr: selectedScene.deterministicTextBake.labels.map((label) => ({
        nodeId: label.nodeId,
        expected: label.text,
        recognized: label.text,
        matched: true,
        evaluationStage: 'final-composite',
        inputImageSha256: bakedImageSha256,
      })),
    }],
  };
  writeJson(sampleBakeReceiptPath, sampleBakeReceipt);
  candidateJob.textBakeReceipts = [{
    phase: 'sample',
    receipt: {path: sampleBakeReceiptPath, sha256: sha256File(sampleBakeReceiptPath)},
    sceneIds: ['P02'],
    recordedAt: '2026-09-12T00:02:00Z',
  }];
  candidateJob.status = 'candidate-text-baked-firstframes-awaiting-user-review';
  writeJson(jobPath, candidateJob);

  const handEditedJob = structuredClone(candidateJob);
  handEditedJob.fullBatchAuthorized = true;
  handEditedJob.status = 'full-generation-authorized';
  writeJson(jobPath, handEditedJob);
  const handEditedRecord = run(recordPath, [
    '--job', jobPath,
    '--scene', 'P01',
    '--image', handEditedJob.scenes[0].outputPath,
    '--execution-prompt-file', path.join(handEditedJob.output.qaRoot, 'P01.execution-prompt.txt'),
    '--tool', 'image_gen',
  ]);
  assert.notEqual(handEditedRecord.status, 0);
  assert.match(handEditedRecord.stderr, /FIRSTFRAME_SCENE_NOT_AUTHORIZED:P01/u);
  const handEditedBoolean = run(contactSheetPath, ['--job', jobPath, '--phase', 'full']);
  assert.notEqual(handEditedBoolean.status, 0);
  assert.match(handEditedBoolean.stderr, /CUE_NATIVE_SAMPLE_ACCEPTANCE_BINDING_REQUIRED/u);
  writeJson(jobPath, candidateJob);

  const sampleAcceptancePath = path.join(outputDir, 'sample-user-acceptance.v1.json');
  const sampleAcceptance = {
    schemaVersion: 'koubo-paper-firstframe-sample-user-acceptance/v1',
    status: 'approved-for-cue-native-full-batch',
    approved: true,
    scope: 'cue-native-text-baked-representative-firstframe',
    taskId: candidateJob.taskId,
    requestId: candidateJob.requestId,
    revisionId: candidateJob.revisionId,
    selectedSceneId: 'P02',
    userQuote: '离线测试夹具：已看过带字样图，同意余下首帧按同风格继续。',
    approvedAt: '2026-09-12T00:03:00Z',
    sourceManifest: structuredClone(candidateJob.sourceManifest),
    textBakedSample: {
      sceneId: 'P02',
      path: bakedImagePath,
      sha256: bakedImageSha256,
    },
  };
  writeJson(sampleAcceptancePath, sampleAcceptance);

  const failedRawReview = JSON.parse(readFileSync(rawReviewPath));
  failedRawReview.criteria.semanticMatch = 'failed';
  writeJson(rawReviewPath, failedRawReview);
  const failedRawAuthorization = run(authorizeFullBatchPath, [
    '--project-root', projectRoot,
    '--job', jobPath,
    '--acceptance', sampleAcceptancePath,
  ]);
  assert.notEqual(failedRawAuthorization.status, 0);
  assert.match(failedRawAuthorization.stderr, /CUE_NATIVE_SAMPLE_ACCEPTANCE_RAW_REVIEW_INVALID/u);
  failedRawReview.criteria.semanticMatch = 'passed';
  writeJson(rawReviewPath, failedRawReview);

  writeFileSync(sampleBakeReceiptPath, `${JSON.stringify(sampleBakeReceipt, null, 2)}\n `);
  const driftedReceiptAuthorization = run(authorizeFullBatchPath, [
    '--project-root', projectRoot,
    '--job', jobPath,
    '--acceptance', sampleAcceptancePath,
  ]);
  assert.notEqual(driftedReceiptAuthorization.status, 0);
  assert.match(driftedReceiptAuthorization.stderr, /CUE_NATIVE_SAMPLE_ACCEPTANCE_TEXT_BAKE_RECEIPT_BINDING_INVALID/u);
  writeJson(sampleBakeReceiptPath, sampleBakeReceipt);

  const failedOcrReceipt = structuredClone(sampleBakeReceipt);
  failedOcrReceipt.scenes[0].ocr[0].matched = false;
  writeJson(sampleBakeReceiptPath, failedOcrReceipt);
  const failedOcrJob = structuredClone(candidateJob);
  failedOcrJob.textBakeReceipts[0].receipt.sha256 = sha256File(sampleBakeReceiptPath);
  writeJson(jobPath, failedOcrJob);
  const failedOcrAuthorization = run(authorizeFullBatchPath, [
    '--project-root', projectRoot,
    '--job', jobPath,
    '--acceptance', sampleAcceptancePath,
  ]);
  assert.notEqual(failedOcrAuthorization.status, 0);
  assert.match(failedOcrAuthorization.stderr, /CUE_NATIVE_SAMPLE_ACCEPTANCE_TEXT_BAKE_RECEIPT_INVALID/u);

  writeJson(sampleBakeReceiptPath, sampleBakeReceipt);
  candidateJob.textBakeReceipts[0].receipt.sha256 = sha256File(sampleBakeReceiptPath);
  writeJson(jobPath, candidateJob);
  const authorized = run(authorizeFullBatchPath, [
    '--project-root', projectRoot,
    '--job', jobPath,
    '--acceptance', sampleAcceptancePath,
  ]);
  assert.equal(authorized.status, 0, authorized.stderr);
  const authorizedJob = JSON.parse(readFileSync(jobPath));
  assert.equal(authorizedJob.fullBatchAuthorized, true);
  assert.equal(authorizedJob.status, 'full-generation-authorized');
  assert.equal(authorizedJob.sampleUserAcceptanceReceipt.path, sampleAcceptancePath);
  assert.equal(authorizedJob.sampleUserAcceptanceReceipt.sha256, sha256File(sampleAcceptancePath));
  assert.equal(isFullBatchAuthorized(authorizedJob, firstFrame), true);

  sampleAcceptance.userQuote += '修改';
  writeJson(sampleAcceptancePath, sampleAcceptance);
  const acceptanceDrift = run(contactSheetPath, ['--job', jobPath, '--phase', 'full']);
  assert.notEqual(acceptanceDrift.status, 0);
  assert.match(acceptanceDrift.stderr, /CUE_NATIVE_SAMPLE_ACCEPTANCE_SHA_MISMATCH/u);

  // Historical jobs without the newer boolean keep their explicit status gate.
  assert.equal(isFullBatchAuthorized({status: 'full-generation-authorized'}), true);
  assert.equal(isFullBatchAuthorized({status: 'sample-generation-authorized'}), false);
  assert.equal(isFullBatchAuthorized({status: 'full-generation-authorized', fullBatchAuthorized: false}), false);
  assert.equal(isFullBatchAuthorized({
    status: 'full-generation-authorized',
    sourceDirectorSchema: 'koubo-director-cues/v1',
  }), false);

  for (const [name, mutate, errorCode] of [
    ['not-approved', (value) => { value.approved = false; }, 'ACCEPTANCE_NOT_APPROVED'],
    ['wrong-status', (value) => { value.status = 'pending'; }, 'ACCEPTANCE_STATUS_INVALID'],
    ['sha-drift', (value) => { value.cuesSha256 = '0'.repeat(64); }, 'ACCEPTANCE_CUES_SHA_MISMATCH'],
    ['unknown-scene', (value) => { value.selectedSceneId = 'P99'; }, 'ACCEPTANCE_SELECTED_SCENE_UNKNOWN'],
  ]) {
    const acceptance = structuredClone(baseAcceptance);
    mutate(acceptance);
    const invalidPath = path.join(scratch, `${name}.json`);
    writeJson(invalidPath, acceptance);
    const invalid = run(bridgePath, ['--project-root', projectRoot, '--cues', cuesPath, '--acceptance', invalidPath, '--output-dir', path.join(scratch, `bad-${name}`)]);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, new RegExp(errorCode));
  }
  console.log(JSON.stringify({ok: true, p02SingleSamplePrepared: true, selectedSceneLocked: true, independentRouteLockBound: true, sourceManifestAuthoritativeAtCriticalEntrypoints: true, directorReceiptChainBound: true, oldV9ManifestPivotRejected: true, wholeOldV9IdentityPairReplacementRejected: true, promptAndSceneSnapshotDriftRejected: true, fullBatchDeniedWithoutAuthorization: true, handEditedBooleanRejected: true, sampleAcceptanceAndOcrBound: true, contactSheetFullGateEnforced: true, legacyStatusCompatibilityRetained: true, promptsPreservedExactly: true, videoPromptIsolated: true, invalidAcceptanceRejected: true}));
} finally {
  rmSync(scratch, {recursive: true, force: true});
}
