import assert from 'node:assert/strict';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {
  DIRECTOR_V2_FULL_PREVIEW_AUTHORIZATION_SCHEMA,
  REVIEW_SCHEMA,
  TEXT_BAKE_RECEIPT_SCHEMA,
  isFullBatchAuthorized,
  sha256File,
  sha256Json,
  sha256Text,
  validateManifest,
  validateSampleSceneIds,
} from '../scripts/firstframe-batch-core.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = Object.fromEntries([
  'prepare-firstframe-batch.mjs',
  'record-firstframe-result.mjs',
  'build-firstframe-contact-sheet.mjs',
  'validate-firstframe-batch.mjs',
  'authorize-director-v2-full-preview-batch.mjs',
].map((name) => [name, path.join(skillRoot, 'scripts', name)]));
const writeJson = (filePath, value) =>
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));
const binding = (filePath) => ({path: filePath, sha256: sha256File(filePath)});
const run = (name, args) =>
  spawnSync(process.execPath, [scripts[name], ...args], {encoding: 'utf8'});

function makeSourceScene(id, beatId, text) {
  const firstFramePrompt = `16:9摄影级纸艺微缩场景，${text}，三层空间，固定空白纸牌，画面无可读文字。`;
  const pairId = `${id}-prompt-pair-v1`;
  const pairSha256 = sha256Text(`${id}\u0000${firstFramePrompt}\u0000${id}-video`);
  return {
    handoff: {
      id,
      beatId,
      pairId,
      pairSha256,
      prompt: firstFramePrompt,
      promptSha256: sha256Text(firstFramePrompt),
    },
    scene: {
      sceneId: id,
      pairId,
      pairSha256,
      beatId,
      title: `${id}测试镜头`,
      aspectRatio: '16:9',
      outputFileName: `${id}_${beatId}_first-frame.png`,
      firstFramePrompt,
      firstFramePromptSha256: sha256Text(firstFramePrompt),
      textPlanSha256: sha256Json({id, text}),
      generatedReadableTextAllowed: false,
      deterministicTextBake: {
        enabled: true,
        sourceImageFileName: `${id}_${beatId}_first-frame.png`,
        outputImageFileName: `${id}_${beatId}_first-frame-text-baked.png`,
        textPlanSha256: sha256Json({id, text}),
        labelsSha256: sha256Json([{nodeId: `${id}-N1`, text}]),
        labels: [{nodeId: `${id}-N1`, text}],
        ocrRequired: true,
        anchorCalibrationRequired: true,
      },
    },
  };
}

function createSignedBridgeFixture(root) {
  const bridgeRoot = path.join(root, 'firstframe-bridge');
  const upstreamRoot = path.join(root, 'official-handoff');
  mkdirSync(bridgeRoot, {recursive: true});
  mkdirSync(upstreamRoot, {recursive: true});
  const taskId = 'director-v2-full-preview-test';
  const revisionId = 'r1';
  const requestId = `v2-paper-firstframe:${taskId}:${revisionId}`;
  const p01 = makeSourceScene('P01', 'B01', '成本');
  const p04 = makeSourceScene('P04', 'B04', '意图匹配');

  const cuesPath = path.join(root, 'director-cues.v2.json');
  writeJson(cuesPath, {schemaVersion: 'koubo-director-cues/v2', taskId});
  const approvalPath = path.join(root, 'approval.v2.json');
  writeJson(approvalPath, {
    schemaVersion: 'koubo-director-cues-user-approval/v2',
    status: 'approved',
    approved: true,
    taskId,
    revisionId,
  });
  const paperPath = path.join(upstreamRoot, 'paper-editorial.first-frame-handoff.v1.json');
  writeJson(paperPath, {
    schemaVersion: 'koubo-director-route-prompt-handoff/v1',
    status: 'planned',
    sourceRoute: 'paper-editorial',
    promptKind: 'first-frame',
    taskId,
    revisionId,
    itemCount: 2,
    items: [p01.handoff, p04.handoff],
  });
  const masterPath = path.join(upstreamRoot, 'director-cues-v2-handoff.v1.json');
  writeJson(masterPath, {
    schemaVersion: 'koubo-director-cues-v2-handoff/v1',
    status: 'local-handoff-ready',
    taskId,
    revisionId,
    artifacts: {paperFirstFrame: binding(paperPath)},
  });
  const handoffReceiptPath = path.join(
    upstreamRoot,
    'director-cues-v2-handoff-validation-receipt.v1.json',
  );
  writeJson(handoffReceiptPath, {
    schemaVersion: 'koubo-director-cues-v2-handoff-validation-receipt/v1',
    status: 'validated-local-handoff',
    skillExecuted: true,
    validatorExecuted: true,
    taskId,
    revisionId,
    handoffMaster: binding(masterPath),
    artifacts: {paperFirstFrame: binding(paperPath)},
  });
  const manifestPath = path.join(bridgeRoot, 'first-frame-prompts.v1.json');
  const manifest = {
    schemaVersion: 'koubo-paper-first-frame-prompt-manifest/v1',
    sourceDirectorSchema: 'koubo-director-cues/v2',
    sourceBridgeSchema: 'koubo-director-cues-v2-firstframe-bridge/v1',
    taskId,
    requestId,
    revisionId,
    status: 'automation-input-ready',
    consumer: 'first-frame-image-automation',
    samplePolicy: 'one-representative-scene',
    selectedSceneId: 'P04',
    policy: {incidentPreventionVersion: '1'},
    generatedReadableTextAllowed: false,
    sourceDirectorCues: binding(cuesPath),
    sourceUserApproval: binding(approvalPath),
    sourceDirectorV2HandoffMaster: binding(masterPath),
    sourceDirectorV2HandoffValidationReceipt: binding(handoffReceiptPath),
    sourcePaperFirstFrameHandoff: binding(paperPath),
    sceneCount: 2,
    scenes: [p01.scene, p04.scene],
  };
  writeJson(manifestPath, manifest);
  const bridgeReceiptPath = path.join(
    bridgeRoot,
    'director-cues-v2-firstframe-bridge-receipt.v1.json',
  );
  writeJson(bridgeReceiptPath, {
    schemaVersion: 'koubo-director-cues-v2-firstframe-bridge-receipt/v1',
    sourceDirectorSchema: 'koubo-director-cues/v2',
    sourceBridgeSchema: 'koubo-director-cues-v2-firstframe-bridge/v1',
    taskId,
    requestId,
    revisionId,
    status: 'validated-v2-native-firstframe-input',
    skillExecuted: true,
    validatorExecuted: true,
    samplePolicy: 'one-representative-scene',
    selectedSceneId: 'P04',
    policy: {incidentPreventionVersion: '1'},
    artifacts: {
      directorCues: binding(cuesPath),
      userApproval: binding(approvalPath),
      directorV2HandoffMaster: binding(masterPath),
      directorV2HandoffValidationReceipt: binding(handoffReceiptPath),
      paperFirstFrameHandoff: binding(paperPath),
      firstFramePromptManifest: binding(manifestPath),
    },
  });
  return {bridgeRoot, manifestPath, bridgeReceiptPath, manifest};
}

function writePng(filePath) {
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=beige:s=160x90:d=0.04',
    '-frames:v', '1', '-update', '1', filePath,
  ], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
}

test('director v2 paper route gates the full local preview on P04 machine artifacts', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'director-v2-full-preview-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const fixture = createSignedBridgeFixture(root);
  assert.deepEqual(validateManifest(fixture.manifest), []);
  assert.deepEqual(validateSampleSceneIds(fixture.manifest, ['P04']), []);
  assert.match(
    validateSampleSceneIds(fixture.manifest, ['P01']).join('|'),
    /DIRECTOR_V2_SAMPLE_SCENE_MISMATCH/u,
  );

  const prepared = run('prepare-firstframe-batch.mjs', [
    '--project-root', root,
    '--manifest', fixture.manifestPath,
    '--director-receipt', fixture.bridgeReceiptPath,
    '--sample', 'P04',
  ]);
  assert.equal(prepared.status, 0, prepared.stderr);
  const jobPath = path.join(fixture.bridgeRoot, 'first-frame-batch.v1.json');
  let job = readJson(jobPath);
  const routeLock = readJson(path.join(fixture.bridgeRoot, 'first-frame-route-lock.v1.json'));
  assert.equal(job.sourceDirectorSchema, 'koubo-director-cues/v2');
  assert.equal(job.sourceBridgeSchema, 'koubo-director-cues-v2-firstframe-bridge/v1');
  assert.deepEqual(job.sampleSceneIds, ['P04']);
  assert.equal(routeLock.route, 'director-v2-paper');
  assert.equal(routeLock.sourceBridgeSchema, job.sourceBridgeSchema);

  const selected = job.scenes.find((scene) => scene.sceneId === 'P04');
  writePng(selected.outputPath);
  const executionPromptPath = path.join(job.output.qaRoot, 'P04.execution-prompt.txt');
  writeFileSync(executionPromptPath, `执行质量锁\n${selected.firstFramePrompt}\n`);
  const recorded = run('record-firstframe-result.mjs', [
    '--job', jobPath,
    '--scene', 'P04',
    '--image', selected.outputPath,
    '--execution-prompt-file', executionPromptPath,
    '--tool', 'image_gen',
  ]);
  assert.equal(recorded.status, 0, recorded.stderr);
  job = readJson(jobPath);
  const selectedRecorded = job.scenes.find((scene) => scene.sceneId === 'P04');
  const reviewPath = path.join(job.output.qaRoot, 'P04.visual-review.v1.json');
  writeJson(reviewPath, {
    schemaVersion: REVIEW_SCHEMA,
    sceneId: 'P04',
    imageSha256: selectedRecorded.result.imageSha256,
    status: 'passed',
    criteria: {
      semanticMatch: 'passed',
      paperMaterial: 'passed',
      depthAndContact: 'passed',
      cleanTextAndBrand: 'passed',
      compositionAndReadability: 'passed',
      videoReadiness: 'passed',
    },
    notes: '离线像素夹具：仅验证签名和状态机，不代表真实视觉通过。',
  });
  const contact = run('build-firstframe-contact-sheet.mjs', [
    '--job', jobPath,
    '--phase', 'sample',
  ]);
  assert.equal(contact.status, 0, contact.stderr);
  const validated = run('validate-firstframe-batch.mjs', [
    '--job', jobPath,
    '--phase', 'sample',
  ]);
  assert.equal(validated.status, 0, validated.stderr);
  const validationOutput = JSON.parse(validated.stdout);
  assert.equal(
    validationOutput.status,
    'representative-still-machine-review-passed-awaiting-full-preview-authorization',
  );

  copyFileSync(selectedRecorded.result.imagePath, selectedRecorded.deterministicTextBake.outputPath);
  const bakedSha256 = sha256File(selectedRecorded.deterministicTextBake.outputPath);
  const bakeReceiptPath = path.join(job.output.qaRoot, 'sample-text-bake-receipt.v1.json');
  writeJson(bakeReceiptPath, {
    schemaVersion: TEXT_BAKE_RECEIPT_SCHEMA,
    status: 'deterministic-first-frame-text-baked-and-ocr-passed',
    taskId: job.taskId,
    sourceDirectorSchema: 'koubo-director-cues/v2',
    sourceFirstFrameManifest: job.sourceManifest,
    scenes: [{
      sceneId: 'P04',
      pairId: selectedRecorded.pairId,
      pairSha256: selectedRecorded.pairSha256,
      textPlanSha256: selectedRecorded.textPlanSha256,
      labelsSha256: selectedRecorded.deterministicTextBake.labelsSha256,
      outputImage: {
        path: selectedRecorded.deterministicTextBake.outputPath,
        sha256: bakedSha256,
      },
      ocr: selectedRecorded.deterministicTextBake.labels.map((label) => ({
        nodeId: label.nodeId,
        expected: label.text,
        recognized: label.text,
        matched: true,
        evaluationStage: 'final-composite',
        inputImageSha256: bakedSha256,
      })),
    }],
  });
  job = readJson(jobPath);
  job.textBakeReceipts = [{
    phase: 'sample',
    receipt: binding(bakeReceiptPath),
    sceneIds: ['P04'],
  }];
  job.status = 'candidate-text-baked-firstframes-awaiting-user-review';
  writeJson(jobPath, job);

  const authorizationPath = path.join(fixture.bridgeRoot, 'director-v2-full-preview-authorization.v1.json');
  const authorization = {
    schemaVersion: DIRECTOR_V2_FULL_PREVIEW_AUTHORIZATION_SCHEMA,
    status: 'authorized-for-director-v2-local-full-preview',
    authorized: true,
    scope: 'director-v2-paper-firstframes-local-preview-only',
    authorizationMode: 'after-representative-machine-pass',
    taskId: job.taskId,
    requestId: job.requestId,
    revisionId: job.revisionId,
    selectedSceneId: 'P04',
    userQuote: '先代表图机器验收后继续整批预览。',
    authorizedAt: '2026-09-12T20:30:00-06:00',
    userVisualAcceptance: 'pending',
    externalSubmissionAuthorized: false,
    runningHubSubmissionAuthorized: false,
    videoGenerationAuthorized: false,
    paidGenerationAuthorized: false,
    sourceManifest: job.sourceManifest,
    representativeRawImage: {
      path: selectedRecorded.result.imagePath,
      sha256: selectedRecorded.result.imageSha256,
    },
    representativeRawVisualReview: binding(reviewPath),
    sampleValidationReceipt: binding(validationOutput.receiptPath),
    representativeTextBakedImage: {
      path: selectedRecorded.deterministicTextBake.outputPath,
      sha256: bakedSha256,
    },
    sampleTextBakeReceipt: binding(bakeReceiptPath),
  };
  writeJson(authorizationPath, authorization);

  const beforeAuthorization = readJson(jobPath);
  beforeAuthorization.fullBatchAuthorized = true;
  beforeAuthorization.status = 'full-preview-generation-authorized';
  writeJson(jobPath, beforeAuthorization);
  const p01 = beforeAuthorization.scenes.find((scene) => scene.sceneId === 'P01');
  const denied = run('record-firstframe-result.mjs', [
    '--job', jobPath,
    '--scene', 'P01',
    '--image', p01.outputPath,
    '--execution-prompt-file', path.join(beforeAuthorization.output.qaRoot, 'P01.execution-prompt.txt'),
    '--tool', 'image_gen',
  ]);
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /FIRSTFRAME_SCENE_NOT_AUTHORIZED:P01/u);
  job = readJson(jobPath);
  job.fullBatchAuthorized = false;
  job.status = 'candidate-text-baked-firstframes-awaiting-user-review';
  writeJson(jobPath, job);

  const invalidBoundaryPath = path.join(fixture.bridgeRoot, 'invalid-full-preview-authorization.v1.json');
  writeJson(invalidBoundaryPath, {...authorization, userVisualAcceptance: 'approved'});
  const invalidBoundary = run('authorize-director-v2-full-preview-batch.mjs', [
    '--project-root', root,
    '--job', jobPath,
    '--authorization', invalidBoundaryPath,
  ]);
  assert.notEqual(invalidBoundary.status, 0);
  assert.match(invalidBoundary.stderr, /DIRECTOR_V2_FULL_PREVIEW_EXTERNAL_BOUNDARY_INVALID/u);

  const authorized = run('authorize-director-v2-full-preview-batch.mjs', [
    '--project-root', root,
    '--job', jobPath,
    '--authorization', authorizationPath,
  ]);
  assert.equal(authorized.status, 0, authorized.stderr);
  job = readJson(jobPath);
  assert.equal(job.status, 'full-preview-generation-authorized');
  assert.equal(job.fullBatchAuthorized, true);
  assert.equal(isFullBatchAuthorized(job, fixture.manifest), true);

  writePng(p01.outputPath);
  const p01PromptPath = path.join(job.output.qaRoot, 'P01.execution-prompt.txt');
  writeFileSync(p01PromptPath, `${p01.firstFramePrompt}\n`);
  const fullRecord = run('record-firstframe-result.mjs', [
    '--job', jobPath,
    '--scene', 'P01',
    '--image', p01.outputPath,
    '--execution-prompt-file', p01PromptPath,
    '--tool', 'image_gen',
  ]);
  assert.equal(fullRecord.status, 0, fullRecord.stderr);
});
