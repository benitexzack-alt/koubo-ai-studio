#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  JOB_SCHEMA,
  TEXT_BAKE_RECEIPT_SCHEMA,
  sha256File,
  sha256Json,
} from '../scripts/firstframe-batch-core.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = path.join(skillRoot, 'scripts');
const cuesPath = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/03_导演拆解/director-core-regression-r1/director-cues.v1.json',
);
const read = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));
const save = (filePath, value) => writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
const run = (name, args) => spawnSync(process.execPath, [path.join(scripts, name), ...args], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

function cueSetSha256(sourcePlan, manifest) {
  return sha256Json({
    schemaVersion: 'koubo-cue-native-motion-set/v1',
    sourcePlanCanonicalSha256: sha256Json(sourcePlan),
    scenes: manifest.scenes.map((scene) => ({
      sceneId: scene.sceneId,
      pairSha256: scene.pairSha256,
      imageToVideoPromptSha256: scene.imageToVideoPromptSha256,
      durationSeconds: scene.durationSeconds,
    })),
  });
}

function buildFixture(t, {allScenes = false} = {}) {
  const root = mkdtempSync(path.join(projectRoot, '.tmp-cue-native-runninghub-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const bridgeDir = path.join(root, 'bridge-r1');
  const bridgeAcceptancePath = path.join(root, 'bridge-acceptance.json');
  const cues = read(cuesPath);
  save(bridgeAcceptancePath, {
    schemaVersion: 'koubo-director-cues-user-acceptance/v1',
    taskId: cues.taskId,
    requestId: 'cue-native-runninghub-offline-test',
    revisionId: 'cue-native-runninghub-offline-r1',
    status: 'approved-for-one-representative-firstframe',
    approved: true,
    scope: 'one-representative-firstframe',
    selectedSceneId: 'P02',
    cuesSha256: sha256File(cuesPath),
    userConfirmationText: '离线测试夹具：只批准生成一张代表首帧。',
    acceptedAt: '2026-09-12T00:00:00Z',
  });
  const bridged = run('bridge-director-cues.mjs', [
    '--project-root', projectRoot,
    '--cues', cuesPath,
    '--acceptance', bridgeAcceptancePath,
    '--output-dir', bridgeDir,
  ]);
  assert.equal(bridged.status, 0, bridged.stderr);
  const firstFramePath = path.join(bridgeDir, 'first-frame-prompts.v1.json');
  const manifestPath = path.join(bridgeDir, 'runninghub-image-to-video-prompts.v1.json');
  const directorReceiptPath = path.join(bridgeDir, 'director-validation-receipt.v1.json');
  const sourcePlanPath = path.join(bridgeDir, 'director-cue-native-source-plan.v1.json');
  const prepared = run('prepare-firstframe-batch.mjs', [
    '--project-root', projectRoot,
    '--manifest', firstFramePath,
    '--director-receipt', directorReceiptPath,
    '--sample', 'P02',
  ]);
  assert.equal(prepared.status, 0, prepared.stderr);

  const jobPath = path.join(bridgeDir, 'first-frame-batch.v1.json');
  const job = read(jobPath);
  const sourcePlan = read(sourcePlanPath);
  const manifest = read(manifestPath);
  assert.equal(job.schemaVersion, JOB_SCHEMA);
  const sceneIds = allScenes ? job.scenes.map((scene) => scene.sceneId) : ['P02'];
  const receiptScenes = sceneIds.map((sceneId) => {
    const scene = job.scenes.find((item) => item.sceneId === sceneId);
    writeFileSync(scene.deterministicTextBake.outputPath, `cue-native-text-baked-${sceneId}`);
    const imageSha256 = sha256File(scene.deterministicTextBake.outputPath);
    return {
      sceneId,
      pairId: scene.pairId,
      pairSha256: scene.pairSha256,
      textPlanSha256: scene.textPlanSha256,
      labelsSha256: scene.deterministicTextBake.labelsSha256,
      outputImage: {path: scene.deterministicTextBake.outputPath, sha256: imageSha256},
      ocr: scene.deterministicTextBake.labels.map((label) => ({
        nodeId: label.nodeId,
        expected: label.text,
        recognized: label.text,
        matched: true,
        evaluationStage: 'final-composite',
        inputImageSha256: imageSha256,
      })),
    };
  });
  const selectedJobScene = job.scenes.find((scene) => scene.sceneId === 'P02');
  writeFileSync(selectedJobScene.outputPath, 'cue-native-raw-P02');
  const rawImageSha256 = sha256File(selectedJobScene.outputPath);
  const rawReviewPath = path.join(job.output.qaRoot, 'P02.visual-review.v1.json');
  save(rawReviewPath, {
    schemaVersion: 'koubo-paper-firstframe-visual-review/v1',
    sceneId: 'P02',
    imageSha256: rawImageSha256,
    status: 'passed',
    criteria: Object.fromEntries([
      'semanticMatch',
      'paperMaterial',
      'depthAndContact',
      'cleanTextAndBrand',
      'compositionAndReadability',
      'videoReadiness',
    ].map((key) => [key, 'passed'])),
    notes: '离线结构夹具，只验证授权绑定，不冒充真实视觉验收。',
  });
  selectedJobScene.result = {
    imagePath: selectedJobScene.outputPath,
    imageSha256: rawImageSha256,
    visualReview: {path: rawReviewPath},
  };
  const buildReceipt = (scenes) => ({
    schemaVersion: TEXT_BAKE_RECEIPT_SCHEMA,
    taskId: job.taskId,
    status: 'deterministic-first-frame-text-baked-and-ocr-passed',
    sourcePlan: {path: sourcePlanPath, sha256: sha256File(sourcePlanPath)},
    scenes,
  });
  const sampleReceiptPath = path.join(bridgeDir, 'sample-bake-receipt.json');
  save(sampleReceiptPath, buildReceipt(receiptScenes.filter((scene) => scene.sceneId === 'P02')));
  const textBakeReceipts = [{
    phase: 'sample',
    receipt: {path: sampleReceiptPath, sha256: sha256File(sampleReceiptPath)},
    sceneIds: ['P02'],
  }];
  if (allScenes) {
    const fullReceiptPath = path.join(bridgeDir, 'full-bake-receipt.json');
    save(fullReceiptPath, buildReceipt(receiptScenes));
    textBakeReceipts.push({
      phase: 'full',
      receipt: {path: fullReceiptPath, sha256: sha256File(fullReceiptPath)},
      sceneIds,
    });
  }
  job.status = 'candidate-text-baked-firstframes-awaiting-user-review';
  job.textBakeReceipts = textBakeReceipts;
  save(jobPath, job);

  const assets = receiptScenes.map((scene) => ({sceneId: scene.sceneId, ...scene.outputImage}));
  const writeStaticAcceptance = (approvedSceneIds, name = 'static-acceptance.json') => {
    const acceptedAssets = assets.filter((asset) => approvedSceneIds.includes(asset.sceneId));
    const acceptancePath = path.join(root, name);
    save(acceptancePath, {
      approved: true,
      status: 'approved-for-runninghub-manual',
      taskId: job.taskId,
      requestId: job.requestId,
      revisionId: job.revisionId,
      scope: 'text-baked-first-frames',
      sceneIds: approvedSceneIds,
      assets: acceptedAssets,
      assetSetSha256: sha256Json(acceptedAssets),
      userQuote: '离线测试夹具：已看过带字首帧，批准建立手工交接包。',
      approvedAt: '2026-09-12T01:00:00Z',
    });
    return acceptancePath;
  };
  const authorizeFullBatch = () => {
    const selectedAsset = assets.find((asset) => asset.sceneId === 'P02');
    const sampleAcceptancePath = path.join(bridgeDir, 'sample-user-acceptance.json');
    save(sampleAcceptancePath, {
      schemaVersion: 'koubo-paper-firstframe-sample-user-acceptance/v1',
      status: 'approved-for-cue-native-full-batch',
      approved: true,
      scope: 'cue-native-text-baked-representative-firstframe',
      taskId: job.taskId,
      requestId: job.requestId,
      revisionId: job.revisionId,
      selectedSceneId: 'P02',
      sourceManifest: structuredClone(job.sourceManifest),
      textBakedSample: structuredClone(selectedAsset),
      userQuote: '离线测试夹具：已看过 P02 带字样图，批准后续整批准备。',
      approvedAt: '2026-09-12T00:30:00Z',
    });
    const result = run('authorize-firstframe-full-batch.mjs', [
      '--project-root', projectRoot,
      '--job', jobPath,
      '--acceptance', sampleAcceptancePath,
    ]);
    assert.equal(result.status, 0, result.stderr);
    Object.assign(job, read(jobPath));
    return sampleAcceptancePath;
  };
  const runPack = ({
    acceptancePath,
    scope = 'first-trial',
    sceneId = 'P02',
    dynamicPath,
    outputName = 'ready.json',
  } = {}) => {
    const args = [
      '--project-root', projectRoot,
      '--job', jobPath,
      '--runninghub-manifest', manifestPath,
      '--user-acceptance', acceptancePath,
      '--handoff-scope', scope,
      '--output', path.join(root, outputName),
    ];
    if (scope === 'first-trial' && sceneId) args.push('--scene-id', sceneId);
    if (dynamicPath) args.push('--dynamic-acceptance', dynamicPath);
    const result = run('build-runninghub-ready-pack.mjs', args);
    return {result, pack: result.status === 0 ? read(JSON.parse(result.stdout).outputPath) : null};
  };
  return {
    root,
    cues,
    job,
    jobPath,
    manifest,
    manifestPath,
    sourcePlan,
    sourcePlanPath,
    bridgeAcceptancePath,
    assets,
    receiptScenes,
    authorizeFullBatch,
    writeStaticAcceptance,
    runPack,
  };
}

test('cue-native 可在带字样图显式验收后生成单镜手工试片包', (t) => {
  const fixture = buildFixture(t);
  fixture.authorizeFullBatch();
  const acceptancePath = fixture.writeStaticAcceptance(['P02']);
  const {result, pack} = fixture.runPack({acceptancePath});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(pack.status, 'ready-for-runninghub-first-trial-manual');
  assert.equal(pack.sceneCount, 1);
  assert.equal(pack.scenes[0].sceneId, 'P02');
  assert.equal(pack.scenes[0].imageToVideoPrompt, fixture.cues.inserts[1].videoPrompt);
  assert.equal(pack.scenes[0].allowedMotion[0], 'exact-cue-prompt-actions-only');
  assert.equal(Object.hasOwn(pack.scenes[0], 'motionContractSha256'), false);
  assert.equal(pack.compatibilityMode, 'cue-native-no-legacy-motion-contract');
  assert.equal(pack.codexSubmissionAllowed, false);
  assert.equal(pack.externalSubmissionAuthorized, false);
  assert.equal(pack.paidGenerationAllowed, false);
});

test('cue-native 不允许用“只生一张样图”的旧确认冒充带字图交接验收', (t) => {
  const fixture = buildFixture(t);
  const {result, pack} = fixture.runPack({
    acceptancePath: fixture.bridgeAcceptancePath,
    outputName: 'must-not-exist.json',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TEXT_BAKED_USER_ACCEPTANCE_INVALID/);
  assert.equal(pack, null);
});

test('cue-native 单镜试片必须严格使用已确认的代表镜头', (t) => {
  const fixture = buildFixture(t, {allScenes: true});
  fixture.authorizeFullBatch();
  const acceptancePath = fixture.writeStaticAcceptance(['P03']);
  const {result, pack} = fixture.runPack({
    acceptancePath,
    sceneId: 'P03',
    outputName: 'must-not-exist.json',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CUE_NATIVE_TRIAL_MUST_USE_SELECTED_SCENE/);
  assert.equal(pack, null);
});

test('cue-native 签名链不允许后加伪造的旧 V9 动作合同', (t) => {
  const fixture = buildFixture(t);
  fixture.authorizeFullBatch();
  const firstFrames = read(path.join(path.dirname(fixture.manifestPath), 'first-frame-prompts.v1.json'));
  firstFrames.scenes[1].motionContract = {schemaVersion: 'koubo-paper-motion-contract/v1'};
  save(path.join(path.dirname(fixture.manifestPath), 'first-frame-prompts.v1.json'), firstFrames);
  fixture.job.sourceManifest.sha256 = sha256File(fixture.job.sourceManifest.path);
  save(fixture.jobPath, fixture.job);
  const acceptancePath = fixture.writeStaticAcceptance(['P02']);
  const {result, pack} = fixture.runPack({acceptancePath, outputName: 'must-not-exist.json'});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FIRSTFRAME_ROUTE_LOCK_MANIFEST_BINDING_MISMATCH|CUE_NATIVE_FIRSTFRAME_MANIFEST_BINDING_MISMATCH|CUE_NATIVE_DIRECTOR_RECEIPT_SHA_MISMATCH/);
  assert.equal(pack, null);
});

test('cue-native 批次交接必须有绑定当前 cue 集的代表动态验收', (t) => {
  const fixture = buildFixture(t, {allScenes: true});
  fixture.authorizeFullBatch();
  const remainingIds = fixture.job.scenes.map((scene) => scene.sceneId).filter((sceneId) => sceneId !== 'P02');
  const acceptancePath = fixture.writeStaticAcceptance(remainingIds);
  const blocked = fixture.runPack({acceptancePath, scope: 'batch', outputName: 'blocked.json'});
  assert.notEqual(blocked.result.status, 0);
  assert.match(blocked.result.stderr, /CUE_NATIVE_DYNAMIC_ACCEPTANCE_REQUIRED/);
  assert.equal(blocked.pack, null);

  const representative = fixture.receiptScenes.find((scene) => scene.sceneId === 'P02');
  const motion = fixture.manifest.scenes.find((scene) => scene.sceneId === 'P02');
  const videoPath = path.join(fixture.root, 'P02-approved-trial.mp4');
  writeFileSync(videoPath, 'cue-native-offline-dynamic-video-fixture');
  const dynamicPath = path.join(fixture.root, 'dynamic-acceptance.json');
  const representativeAsset = {sceneId: 'P02', ...representative.outputImage};
  save(dynamicPath, {
    schemaVersion: 'koubo-cue-native-representative-dynamic-acceptance/v1',
    taskId: fixture.job.taskId,
    requestId: fixture.job.requestId,
    revisionId: fixture.job.revisionId,
    status: 'representative-cue-set-approved',
    approved: true,
    scope: 'current-cue-set-after-representative-trial',
    batchHandoffApproved: true,
    externalSubmissionAuthorized: false,
    paidGenerationAuthorized: false,
    sourcePlan: {path: fixture.sourcePlanPath, sha256: sha256File(fixture.sourcePlanPath)},
    sampleUserAcceptanceReceipt: structuredClone(fixture.job.sampleUserAcceptanceReceipt),
    cueSetSha256: cueSetSha256(fixture.sourcePlan, fixture.manifest),
    assetSetSha256: sha256Json([representativeAsset]),
    userQuote: '离线测试夹具：已看完代表试片，批准当前 cue 集进入手工批次交接。',
    approvedAt: '2026-09-12T02:00:00Z',
    representatives: [{
      sceneId: 'P02',
      inputFirstFrame: representative.outputImage,
      pairSha256: representative.pairSha256,
      imageToVideoPromptSha256: motion.imageToVideoPromptSha256,
      video: {path: videoPath, sha256: sha256File(videoPath)},
      approved: true,
      userQuote: '离线测试夹具：正常速度静音可理解，且与口播语义一致。',
      approvedAt: '2026-09-12T02:00:00Z',
      checks: {
        normalSpeedSilentMeaningCorrect: true,
        spokenMeaningConsistent: true,
        labelsReadableThroughout: true,
      },
    }],
  });
  const ready = fixture.runPack({acceptancePath, scope: 'batch', dynamicPath, outputName: 'batch-ready.json'});
  assert.equal(ready.result.status, 0, ready.result.stderr);
  assert.equal(ready.pack.sceneCount, 4);
  assert.deepEqual(ready.pack.scenes.map((scene) => scene.sceneId), remainingIds);
  assert.equal(ready.pack.alreadyAcceptedScenes[0].sceneId, 'P02');
  assert.equal(ready.pack.dynamicValidation.status, 'representative-cue-set-accepted');
  assert.equal(ready.pack.externalSubmissionAuthorized, false);
});

test('cue-native 不允许用手改布尔值冒充整批用户验收', (t) => {
  const fixture = buildFixture(t, {allScenes: true});
  fixture.job.fullBatchAuthorized = true;
  save(fixture.jobPath, fixture.job);
  const remainingIds = fixture.job.scenes.map((scene) => scene.sceneId).filter((sceneId) => sceneId !== 'P02');
  const acceptancePath = fixture.writeStaticAcceptance(remainingIds);
  const {result, pack} = fixture.runPack({
    acceptancePath,
    scope: 'batch',
    outputName: 'must-not-exist.json',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CUE_NATIVE_SAMPLE_ACCEPTANCE_INVALID|CUE_NATIVE_FULL_BATCH_ACCEPTANCE_INVALID/);
  assert.equal(pack, null);
});

test('cue-native 批次动态验收不得夹带外部提交或付费授权', (t) => {
  const fixture = buildFixture(t, {allScenes: true});
  fixture.authorizeFullBatch();
  const remainingIds = fixture.job.scenes.map((scene) => scene.sceneId).filter((sceneId) => sceneId !== 'P02');
  const acceptancePath = fixture.writeStaticAcceptance(remainingIds);
  const dynamicPath = path.join(fixture.root, 'unsafe-dynamic-acceptance.json');
  save(dynamicPath, {
    schemaVersion: 'koubo-cue-native-representative-dynamic-acceptance/v1',
    taskId: fixture.job.taskId,
    requestId: fixture.job.requestId,
    revisionId: fixture.job.revisionId,
    status: 'representative-cue-set-approved',
    approved: true,
    scope: 'current-cue-set-after-representative-trial',
    batchHandoffApproved: true,
    externalSubmissionAuthorized: true,
    paidGenerationAuthorized: false,
    sourcePlan: {path: fixture.sourcePlanPath, sha256: sha256File(fixture.sourcePlanPath)},
    sampleUserAcceptanceReceipt: structuredClone(fixture.job.sampleUserAcceptanceReceipt),
    cueSetSha256: cueSetSha256(fixture.sourcePlan, fixture.manifest),
    userQuote: '这是越权的离线负例。',
    approvedAt: '2026-09-12T02:00:00Z',
    representatives: [{sceneId: 'P02'}],
  });
  const {result, pack} = fixture.runPack({
    acceptancePath,
    scope: 'batch',
    dynamicPath,
    outputName: 'must-not-exist.json',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CUE_NATIVE_DYNAMIC_ACCEPTANCE_INVALID/);
  assert.equal(pack, null);
});

test('cue-native 固定路线锁在两个 RunningHub 出口均拒绝整套替换为旧 V9 任务', (t) => {
  const fixture = buildFixture(t);
  const historicalV9JobPath = path.join(
    projectRoot,
    'edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4/first-frame-final-preparation-r1/first-frame-batch.v1.json',
  );
  save(fixture.jobPath, read(historicalV9JobPath));

  const acceptancePath = fixture.writeStaticAcceptance(['P02']);
  const ready = fixture.runPack({
    acceptancePath,
    outputName: 'ready-must-not-exist.json',
  });
  assert.notEqual(ready.result.status, 0);
  assert.match(ready.result.stderr, /FIRSTFRAME_ROUTE_LOCK_IDENTITY_MISMATCH/);
  assert.equal(ready.pack, null);

  const canvasOutputPath = path.join(fixture.root, 'canvas-must-not-exist.json');
  const canvas = run('build-runninghub-canvas-preparation-pack.mjs', [
    '--project-root', projectRoot,
    '--job', fixture.jobPath,
    '--runninghub-manifest', fixture.manifestPath,
    '--authorization', fixture.bridgeAcceptancePath,
    '--output', canvasOutputPath,
  ]);
  assert.notEqual(canvas.status, 0);
  assert.match(canvas.stderr, /FIRSTFRAME_ROUTE_LOCK_IDENTITY_MISMATCH/);
});
