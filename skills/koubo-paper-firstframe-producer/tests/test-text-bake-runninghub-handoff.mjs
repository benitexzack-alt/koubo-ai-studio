#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
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
  buildFirstFramePromptManifest,
  buildRunningHubPromptManifest,
  sha256File,
  sha256Json,
} from '../../koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {
  JOB_SCHEMA,
  REVIEW_SCHEMA,
  RUNNINGHUB_READY_PACK_SCHEMA,
  TEXT_BAKE_CALIBRATION_SCHEMA,
  TEXT_BAKE_RECEIPT_SCHEMA,
  sha256Text,
} from '../scripts/firstframe-batch-core.mjs';
import {bindSemanticReview} from '../../koubo-remotion-director/tests/fixtures/paper-motion-request.mjs';
import {renderMotionFirstFrame, renderMotionPrompt} from '../../koubo-remotion-director/scripts/paper-motion-contract.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
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

test('旧本地中文烘焙与真实OCR集成夹具', {skip: process.env.KOUBO_SKIP_MEDIA_FIXTURE === '1'}, () => {
const testRoot = mkdtempSync(path.join(repoRoot, '.tmp-firstframe-handoff-'));
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
    criteria: Object.fromEntries(['semanticMatch', 'paperMaterial', 'depthAndContact', 'cleanTextAndBrand',
      'compositionAndReadability', 'videoReadiness'].map((key) => [key, 'passed'])),
    notes: '离线合成图片夹具，用于验证文字烘焙与OCR，不作真实画面验收。',
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

  writeFileSync(
    path.join(qaRoot, 'full-text-bake-request.failed-v1.json'),
    `${JSON.stringify({status: 'historical-failure'})}\n`,
  );
  writeFileSync(
    path.join(qaRoot, 'full-text-bake-request.failed-v2.json'),
    `${JSON.stringify({status: 'historical-failure'})}\n`,
  );

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
  assert.equal(updatedJob.status, 'text-baked-firstframes-awaiting-user-review');
  assert.equal(updatedJob.textBakeReceipts.length, 1);
  assert.match(updatedJob.textBakeReceipts[0].request.path, /request\.v3\.json$/u);
  assert.match(updatedJob.textBakeReceipts[0].receipt.path, /receipt\.v3\.json$/u);
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
    '--project-root', testRoot,
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
});

function incidentFixture(t) {
  const root = mkdtempSync(path.join(repoRoot, '.tmp-firstframe-incident-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const file = (name) => path.join(root, name);
  const save = (name, value) => {
    writeFileSync(file(name), JSON.stringify(value));
    return {path: file(name), sha256: sha256File(file(name))};
  };
  const plan = {
    schemaVersion: 'koubo-director-preproduction-plan/v1',
    taskId: 'incident-test', requestId: 'incident-request', revisionId: 'r1',
    policy: {incidentPreventionVersion: '1'},
    provenance: {scriptSha256: sha256Text('synthetic-script')},
    paperScenes: [1, 2].map((index) => ({
      beatId: `B0${index}`, durationSeconds: 6,
      spokenLine: '隔离测试原话',
      motionContract: {
        schemaVersion: 'koubo-paper-motion-contract/v1',
        mechanism: 'rigid-split', allowedActions: ['rigid-slide'],
        dynamicValidation: {requiredBeforeBatch: true, staticApprovalIsNotDynamicApproval: true, automaticRetryAllowed: false},
      },
      prompt: {firstFrame: `无字纸艺${index}`, motion: `纸片刚性平移${index}`},
      textPlan: ['有效资料', '无效资料'].map((text, node) => ({
        nodeId: `N${node + 1}`, text, embeddingMode: 'first-frame-baked', ocrRequired: true,
      })), screenTextPlan: [],
    })),
  };
  plan.paperScenes.forEach((scene) => {
    scene.prompt.firstFrame = renderMotionFirstFrame(scene);
    scene.prompt.motion = renderMotionPrompt(scene);
  });
  const bindReviews = () => plan.paperScenes.forEach((scene, index) => bindSemanticReview({
    taskId: plan.taskId, revisionId: plan.revisionId, inputScript: {sha256: plan.provenance.scriptSha256},
    beats: [{id: scene.beatId, spokenLine: scene.spokenLine, paperScene: scene}],
  }, file(`synthetic-review-${index}`)));
  bindReviews();
  // This unit fixture models byte-identical contracts; real per-beat reviews ordinarily make them distinct.
  plan.paperScenes[1].beatId = plan.paperScenes[0].beatId;
  plan.paperScenes[1].motionContract.semanticReview = plan.paperScenes[0].motionContract.semanticReview;
  const sourcePlan = save('plan.json', plan);
  const firstFrames = buildFirstFramePromptManifest(plan);
  const manifest = buildRunningHubPromptManifest(plan);
  firstFrames.policy = {incidentPreventionVersion: '1'};
  manifest.policy = {incidentPreventionVersion: '1'};
  manifest.scenes.forEach((scene, index) => {
    scene.motionContractSha256 = sha256Json(plan.paperScenes[index].motionContract);
    scene.dynamicValidation = {requiredBeforeBatch: true, staticApprovalIsNotDynamicApproval: true, automaticRetryAllowed: false};
  });
  const job = {
    schemaVersion: JOB_SCHEMA, taskId: plan.taskId, requestId: plan.requestId, revisionId: plan.revisionId,
    policy: {incidentPreventionVersion: '1'},
    status: 'text-baked-firstframes-awaiting-user-review',
    sourceManifest: save('firstframes.json', firstFrames),
    output: {handoffRoot: root}, sampleSceneIds: ['P01'],
    scenes: plan.paperScenes.map((scene, index) => {
      const identity = buildSceneIdentity(scene, index);
      const imagePath = file(`${identity.sceneId}.png`);
      writeFileSync(imagePath, `local-image-hash-fixture-${index}`);
      return {
        sceneId: identity.sceneId, beatId: scene.beatId, pairId: identity.pairId,
        pairSha256: identity.pairSha256, textPlanSha256: identity.textPlanSha256,
        deterministicTextBake: {
          enabled: true, labels: scene.textPlan, labelsSha256: sha256Json(scene.textPlan), outputPath: imagePath,
        },
      };
    }),
  };
  const receipt = {
    schemaVersion: TEXT_BAKE_RECEIPT_SCHEMA, taskId: plan.taskId,
    status: 'deterministic-first-frame-text-baked-and-ocr-passed', sourcePlan,
    scenes: job.scenes.map((scene) => ({
      sceneId: scene.sceneId, pairId: scene.pairId, pairSha256: scene.pairSha256,
      textPlanSha256: scene.textPlanSha256, labelsSha256: scene.deterministicTextBake.labelsSha256,
      outputImage: {path: scene.deterministicTextBake.outputPath, sha256: sha256File(scene.deterministicTextBake.outputPath)},
      ocr: scene.deterministicTextBake.labels.map((label) => ({
        nodeId: label.nodeId, expected: label.text, recognized: label.text, matched: true,
        evaluationStage: 'final-composite', inputImageSha256: sha256File(scene.deterministicTextBake.outputPath),
      })),
    })),
  };
  const assets = receipt.scenes.map((scene) => ({sceneId: scene.sceneId, ...scene.outputImage}));
  const acceptance = {
    approved: true, status: 'approved-for-runninghub-manual', taskId: plan.taskId,
    requestId: plan.requestId, revisionId: plan.revisionId,
    scope: 'text-baked-first-frames', sceneIds: ['P02'],
    assets: structuredClone(assets.slice(1)), assetSetSha256: sha256Json(assets.slice(1)),
    userQuote: '已逐图核对，批准这一组带字首帧。', approvedAt: '2026-09-08T09:00:00+08:00',
  };
  writeFileSync(file('trial.mp4'), 'local-dynamic-video-hash-fixture');
  const dynamic = {
    schemaVersion: 'koubo-paper-representative-dynamic-acceptance/v1',
    taskId: plan.taskId, requestId: plan.requestId, revisionId: plan.revisionId,
    status: 'representative-dynamics-approved', approved: true,
    sourcePlan, assetSetSha256: sha256Json(assets),
    representatives: [{
      sceneId: 'P01', inputFirstFrame: assets[0],
      pairSha256: job.scenes[0].pairSha256,
      imageToVideoPromptSha256: manifest.scenes[0].imageToVideoPromptSha256,
      motionContractSha256: manifest.scenes[0].motionContractSha256,
      video: {path: file('trial.mp4'), sha256: sha256File(file('trial.mp4'))},
      approved: true, userQuote: '正常速度静音能看懂分流，配合实录一致，文字持续可读。',
      approvedAt: '2026-09-08T09:30:00+08:00',
      checks: {normalSpeedSilentMeaningCorrect: true, spokenMeaningConsistent: true, labelsReadableThroughout: true},
    }],
  };
  const runPack = ({scope = 'batch', withDynamic = true, phase = 'full', sceneId} = {}) => {
    job.textBakeReceipts = [{phase, receipt: save('bake-receipt.json', receipt)}];
    save('job.json', job);
    save('motion.json', manifest);
    save('acceptance.json', acceptance);
    const args = ['--project-root', root, '--job', file('job.json'),
      '--runninghub-manifest', file('motion.json'), '--user-acceptance', file('acceptance.json'),
      '--handoff-scope', scope];
    if (sceneId) args.push('--scene-id', sceneId);
    if (withDynamic) {
      save('dynamic.json', dynamic);
      args.push('--dynamic-acceptance', file('dynamic.json'));
    }
    const result = run(readyPackScript, args);
    const pack = result.status === 0 ? JSON.parse(readFileSync(JSON.parse(result.stdout).outputPath)) : null;
    return {result, pack};
  };
  const approveSceneIds = (sceneIds) => {
    acceptance.sceneIds = sceneIds;
    acceptance.assets = assets.filter((asset) => sceneIds.includes(asset.sceneId));
    acceptance.assetSetSha256 = sha256Json(acceptance.assets);
  };
  const refreshPlanReviews = () => {
    bindReviews();
    receipt.sourcePlan = save('plan.json', plan);
    Object.assign(firstFrames, buildFirstFramePromptManifest(plan));
    Object.assign(manifest, buildRunningHubPromptManifest(plan));
    job.sourceManifest = save('firstframes.json', firstFrames);
    dynamic.sourcePlan = receipt.sourcePlan;
    dynamic.representatives[0].motionContractSha256 = manifest.scenes[0].motionContractSha256;
  };
  return {job, plan, manifest, firstFrames, receipt, acceptance, dynamic, file, save, runPack, approveSceneIds, refreshPlanReviews};
}

for (const [name, mutate, expected] of [
  ['改提示词不改摘要', (f) => { f.manifest.scenes[0].imageToVideoPrompt += '作废也入库'; }, 'PROMPT_SHA_MISMATCH'],
  ['改提示词并重算自身摘要', (f) => { f.manifest.scenes[0].imageToVideoPrompt += '另一个动作'; f.manifest.scenes[0].imageToVideoPromptSha256 = sha256Text(f.manifest.scenes[0].imageToVideoPrompt); }, 'PAIR_PLAN_MISMATCH'],
  ['源计划漂移', (f) => { f.plan.paperScenes[0].prompt.motion += '改变'; f.save('plan.json', f.plan); }, 'SOURCE_PLAN_SHA_MISMATCH'],
  ['伪造配对摘要', (f) => { f.manifest.scenes[0].pairSha256 = f.receipt.scenes[0].pairSha256 = 'a'.repeat(64); }, 'PAIR_PLAN_MISMATCH'],
  ['文字计划摘要漂移', (f) => { f.manifest.scenes[0].inputFirstFrameTextPlanSha256 = 'a'.repeat(64); }, 'PAIR_PLAN_MISMATCH'],
  ['空识别数组', (f) => { f.receipt.scenes[0].ocr = []; }, 'OCR_COVERAGE_INVALID'],
  ['识别漏节点', (f) => { f.receipt.scenes[0].ocr.pop(); }, 'OCR_COVERAGE_INVALID'],
  ['同节点重复冒充覆盖', (f) => { f.receipt.scenes[0].ocr[1] = {...f.receipt.scenes[0].ocr[0]}; }, 'OCR_COVERAGE_INVALID'],
  ['空识别文本但声称匹配', (f) => { f.receipt.scenes[0].ocr[0].recognized = ''; }, 'OCR_EVIDENCE_INVALID'],
  ['识别来自旧图', (f) => { f.receipt.scenes[0].ocr[0].inputImageSha256 = 'a'.repeat(64); }, 'OCR_EVIDENCE_INVALID'],
  ['仅镜头编号批准', (f) => { delete f.acceptance.assets; delete f.acceptance.assetSetSha256; }, 'ACCEPTANCE_ASSETS_INVALID'],
  ['批准后换图并更新机器回执', (f) => {
    writeFileSync(f.file('P02.png'), 'changed-after-user-approval');
    f.receipt.scenes[1].outputImage.sha256 = sha256File(f.file('P02.png'));
    f.receipt.scenes[1].ocr.forEach((item) => { item.inputImageSha256 = sha256File(f.file('P02.png')); });
  }, 'ACCEPTANCE_ASSETS_INVALID'],
  ['识别镜头重复', (f) => { f.receipt.scenes.push(structuredClone(f.receipt.scenes[0])); }, 'SCENE_SET_INVALID'],
  ['动态视频漂移', (f) => { writeFileSync(f.file('trial.mp4'), 'new-video'); }, 'DYNAMIC_VIDEO_SHA_MISMATCH'],
  ['动态回执错版本', (f) => { f.dynamic.revisionId = 'old'; }, 'DYNAMIC_ACCEPTANCE_INVALID'],
  ['动态回执保留例外', (f) => { f.dynamic.representatives[0].exceptions = [{status: 'known-exception-user-accepted'}]; }, 'EXCEPTION_NOT_SUCCESS'],
  ['未知强化策略', (f) => { f.job.policy.incidentPreventionVersion = '2'; }, 'POLICY_VERSION_INVALID'],
  ['移除上游清单策略', (f) => { delete f.manifest.policy; }, 'UPSTREAM_POLICY_REQUIRED'],
  ['动作合同摘要漂移', (f) => { f.manifest.scenes[0].motionContractSha256 = 'a'.repeat(64); }, 'MOTION_CONTRACT_SHA_MISMATCH'],
  ['静态批准冒充动态通过', (f) => { f.manifest.scenes[0].dynamicValidation.staticApprovalIsNotDynamicApproval = false; }, 'DYNAMIC_POLICY_INVALID'],
  ['首帧提示词改动未重算摘要', (f) => { f.firstFrames.scenes[0].firstFramePrompt += '改变'; f.job.sourceManifest = f.save('firstframes.json', f.firstFrames); }, 'PROMPT_SHA_MISMATCH'],
  ['清单规范化计划摘要漂移', (f) => { f.manifest.sourcePlanCanonicalSha256 = 'a'.repeat(64); }, 'SOURCE_PLAN_CANONICAL_SHA_MISMATCH'],
  ['烘焙节点与计划不一致', (f) => { f.job.scenes[0].deterministicTextBake.labels[0].text = '另一段文字'; }, 'PAIR_PLAN_MISMATCH'],
  ['外部机构审查文件漂移', (f) => {
    const reference = f.plan.paperScenes[0].motionContract.semanticReview;
    const review = JSON.parse(readFileSync(reference.path));
    review.sourceQuote = '漂移后的另一句';
    writeFileSync(reference.path, JSON.stringify(review));
  }, 'PAPER_SEMANTIC_REVIEW_FILE_OR_SHA_INVALID'],
  ['首帧清单跨版本', (f) => {
    f.firstFrames.revisionId = 'old'; f.job.sourceManifest = f.save('firstframes.json', f.firstFrames);
  }, 'SOURCE_IDENTITY_INVALID'],
  ['动作清单跨版本', (f) => { f.manifest.revisionId = 'old'; }, 'SOURCE_IDENTITY_INVALID'],
]) {
  test(`强化交接拒绝${name}`, (t) => {
    const fixture = incidentFixture(t);
    mutate(fixture);
    const {result, pack} = fixture.runPack();
    assert.notEqual(result.status, 0, '不应输出可交接包');
    assert.ok(result.stderr.includes(expected), result.stderr);
    assert.equal(pack, null);
  });
}

test('未验收代表性新机构时禁止全批交接', (t) => {
  const fixture = incidentFixture(t);
  const {result, pack} = fixture.runPack({withDynamic: false});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DYNAMIC_ACCEPTANCE_REQUIRED/);
  assert.equal(pack, null);
});

test('移除job自身策略不能绕过上游动态门', (t) => {
  const fixture = incidentFixture(t);
  delete fixture.job.policy;
  const {result} = fixture.runPack({withDynamic: false});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DYNAMIC_ACCEPTANCE_REQUIRED/);
});

test('实际项目档案强制策略时移除所有输入flag仍不能降级签发', (t) => {
  const fixture = incidentFixture(t);
  mkdirSync(fixture.file('workflow'));
  fixture.save('workflow/active-director-profile.v1.json', {incidentPreventionPolicy: {requiredForNewPreproduction: true}});
  for (const item of [fixture.job, fixture.plan, fixture.firstFrames, fixture.manifest]) delete item.policy;
  fixture.receipt.sourcePlan = fixture.save('plan.json', fixture.plan);
  fixture.firstFrames.sourcePlanCanonicalSha256 = fixture.manifest.sourcePlanCanonicalSha256 = sha256Json(fixture.plan);
  fixture.job.sourceManifest = fixture.save('firstframes.json', fixture.firstFrames);
  fixture.approveSceneIds(['P01', 'P02']);
  const {result} = fixture.runPack({withDynamic: false});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /UPSTREAM_POLICY_REQUIRED/);
});

test('允许仅交接首条试片，不声称动态通过且不能付费生成', (t) => {
  const fixture = incidentFixture(t);
  fixture.approveSceneIds(['P01']);
  const {result, pack} = fixture.runPack({scope: 'first-trial', withDynamic: false});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(pack.sceneCount, 1);
  assert.equal(pack.scenes[0].sceneId, 'P01');
  assert.equal(pack.status, 'ready-for-runninghub-first-trial-manual');
  assert.equal(pack.dynamicValidation.status, 'pending');
  assert.equal(pack.batchDynamicallyAccepted, false);
  assert.equal(pack.paidGenerationAllowed, false);
  assert.equal(pack.codexSubmissionAllowed, false);
});

test('当前图片集合与代表性动态验收齐备才可全批交接，但仍非全批动态成功', (t) => {
  const fixture = incidentFixture(t);
  const {result, pack} = fixture.runPack();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(pack.sceneCount, 1);
  assert.equal(pack.scenes[0].sceneId, 'P02');
  assert.equal(pack.alreadyAcceptedScenes[0].sceneId, 'P01');
  assert.equal(pack.alreadyAcceptedScenes[0].disposition, 'reuse-accepted-source');
  assert.equal(pack.alreadyAcceptedScenes[0].regenerationAllowed, false);
  assert.equal(pack.dynamicValidation.status, 'representative-mechanisms-accepted');
  assert.equal(pack.batchDynamicallyAccepted, false);
  assert.equal(pack.paidGenerationAllowed, false);
  assert.equal(pack.formalEnabled, false);
  assert.equal(pack.publicationEnabled, false);
});

test('本期固定负例视频SHA不得成为动态验收成功证据', (t) => {
  const registry = JSON.parse(readFileSync(new URL('../../koubo-remotion-director/references/paper-motion-incident-registry.v1.json', import.meta.url)));
  for (const incident of registry.incidents) {
    const fixture = incidentFixture(t);
    fixture.dynamic.representatives[0].video.sha256 = incident.videoSha256;
    const {result, pack} = fixture.runPack();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DYNAMIC_NEGATIVE_INCIDENT_SOURCE_FORBIDDEN/);
    assert.equal(pack, null);
  }
});

test('不同动作合同不能借用首条机构的动态验收', (t) => {
  const fixture = incidentFixture(t);
  fixture.plan.paperScenes[1].motionContract.allowedActions.push('drawer-push');
  fixture.refreshPlanReviews();
  const {result} = fixture.runPack();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DYNAMIC_MECHANISM_COVERAGE_MISSING/);
});

test('首条试片只需要本条sample烘焙回执，不要求剩余图片已生成', (t) => {
  const fixture = incidentFixture(t);
  fixture.receipt.scenes = fixture.receipt.scenes.slice(0, 1);
  fixture.approveSceneIds(['P01']);
  rmSync(fixture.file('P02.png'));
  const {result, pack} = fixture.runPack({scope: 'first-trial', withDynamic: false, phase: 'sample'});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(pack.sceneCount, 1);
  assert.equal(pack.paidGenerationAllowed, false);
});

test('旧纯哈希夹具仍可读取交接，不伪称动态已验收', (t) => {
  const fixture = incidentFixture(t);
  for (const doc of [fixture.plan, fixture.job, fixture.firstFrames, fixture.manifest]) delete doc.policy;
  fixture.receipt.sourcePlan = fixture.save('plan.json', fixture.plan);
  fixture.job.sourceManifest = fixture.save('firstframes.json', fixture.firstFrames);
  fixture.approveSceneIds(['P01', 'P02']);
  const {result, pack} = fixture.runPack({withDynamic: false});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(pack.status, 'ready-for-runninghub-manual');
  assert.notEqual(pack.batchDynamicallyAccepted, true);
});

test('可显式交接P02单镜试验，首镜不是唯一允许入口', (t) => {
  const fixture = incidentFixture(t);
  fixture.approveSceneIds(['P02']);
  const {result, pack} = fixture.runPack({scope: 'first-trial', sceneId: 'P02', withDynamic: false});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(pack.scenes[0].sceneId, 'P02');
});

test('已有P01验收时仍可试P02，但不得再次交接已通过的P01', (t) => {
  const fixture = incidentFixture(t);
  fixture.dynamic.assetSetSha256 = sha256Json([{sceneId: 'P01', ...fixture.receipt.scenes[0].outputImage}]);
  fixture.approveSceneIds(['P01']);
  const blocked = fixture.runPack({scope: 'first-trial', sceneId: 'P01'});
  assert.notEqual(blocked.result.status, 0);
  assert.match(blocked.result.stderr, /DYNAMIC_TRIAL_ALREADY_ACCEPTED/);
  fixture.approveSceneIds(['P02']);
  const next = fixture.runPack({scope: 'first-trial', sceneId: 'P02'});
  assert.equal(next.result.status, 0, next.result.stderr);
  assert.deepEqual(next.pack.remainingSceneIds, ['P02']);
  assert.equal(next.pack.alreadyAcceptedScenes[0].sceneId, 'P01');
});

test('动态索引自身的已接纳例外不能被子验收掩盖', (t) => {
  const fixture = incidentFixture(t);
  const record = fixture.save('P01.accepted.json', fixture.dynamic);
  Object.keys(fixture.dynamic).forEach((key) => delete fixture.dynamic[key]);
  Object.assign(fixture.dynamic, {schemaVersion: 'koubo-paper-dynamic-acceptance-index/v1', acceptances: [record],
    exceptions: [{status: 'known-exception-user-accepted'}]});
  const {result} = fixture.runPack();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EXCEPTION_NOT_SUCCESS/);
});

test('源计划反写首帧且重算全链摘要仍不能绕过canonical prompt', (t) => {
  const fixture = incidentFixture(t);
  fixture.plan.paperScenes[1].prompt.firstFrame += '\n作废资料全部进入知识库';
  fixture.refreshPlanReviews();
  const identity = buildSceneIdentity(fixture.plan.paperScenes[1], 1);
  fixture.job.scenes[1].pairSha256 = fixture.receipt.scenes[1].pairSha256 = identity.pairSha256;
  const {result} = fixture.runPack({scope: 'first-trial', withDynamic: false, sceneId: 'P02'});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SOURCE_PROMPT_NOT_COMPILED/);
});

test('独立trial验收索引可闭合不同动作合同，整批不再生成已通过代表片', (t) => {
  const fixture = incidentFixture(t);
  fixture.plan.paperScenes[1].motionContract.allowedActions.push('drawer-push');
  fixture.refreshPlanReviews();
  const records = fixture.receipt.scenes.map((baked, index) => {
    const dynamic = structuredClone(fixture.dynamic);
    dynamic.sourcePlan = fixture.receipt.sourcePlan;
    dynamic.assetSetSha256 = sha256Json([{sceneId: baked.sceneId, ...baked.outputImage}]);
    const sample = dynamic.representatives[0];
    Object.assign(sample, {sceneId: baked.sceneId, inputFirstFrame: baked.outputImage,
      pairSha256: baked.pairSha256, imageToVideoPromptSha256: fixture.manifest.scenes[index].imageToVideoPromptSha256,
      motionContractSha256: fixture.manifest.scenes[index].motionContractSha256});
    return fixture.save(`${baked.sceneId}.accepted.json`, dynamic);
  });
  Object.keys(fixture.dynamic).forEach((key) => delete fixture.dynamic[key]);
  Object.assign(fixture.dynamic, {schemaVersion: 'koubo-paper-dynamic-acceptance-index/v1', acceptances: records});
  const {result, pack} = fixture.runPack();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(pack.sceneCount, 0);
  assert.equal(pack.status, 'no-generation-required');
  assert.equal(pack.alreadyAcceptedScenes.length, 2);
  assert.equal(pack.paidGenerationAllowed, false);
});

function canvasFixture(t) {
  const f = incidentFixture(t);
  f.job.output.qaRoot = path.dirname(f.file('job.json'));
  f.job.scenes.forEach((scene) => {
    scene.result = {imagePath: scene.deterministicTextBake.outputPath,
      imageSha256: sha256File(scene.deterministicTextBake.outputPath)};
    f.save(`${scene.sceneId}.visual-review.v1.json`, {schemaVersion: REVIEW_SCHEMA,
      sceneId: scene.sceneId, imageSha256: scene.result.imageSha256, status: 'passed',
      criteria: Object.fromEntries(['semanticMatch', 'paperMaterial', 'depthAndContact', 'cleanTextAndBrand',
        'compositionAndReadability', 'videoReadiness'].map((key) => [key, 'passed'])),
      notes: '离线哈希夹具，不是实际用户或视觉验收。'});
    f.save(`${scene.sceneId}.text-baked-visual-review.v1.json`, {
      schemaVersion: 'koubo-paper-text-baked-visual-review/v1', sceneId: scene.sceneId,
      imageSha256: scene.result.imageSha256, status: 'passed',
      criteria: Object.fromEntries(['actualSurfaceCalibration', 'exactChineseText', 'paperSurfacePlacement',
        'noExtraText', 'rigidMotionReady'].map((key) => [key, 'passed'])), notes: '离线成品观察夹具'});
  });
  const authorization = {schemaVersion: 'koubo-canvas-preparation-authorization/v1',
    status: 'authorized-for-canvas-preparation', taskId: f.job.taskId, requestId: f.job.requestId,
    revisionId: f.job.revisionId, sourceManifest: f.job.sourceManifest,
    sceneIds: f.job.scenes.map((scene) => scene.sceneId), userAcceptance: 'pending',
    uploadAllowed: true, canvasConfigurationAllowed: true, submissionAllowed: false, paidGenerationAllowed: false,
    userQuote: '测试夹具：准备画布，生成前等我，不构成真实授权', recordedAt: '2026-09-10T12:00:00+08:00'};
  const runCanvas = () => {
    const motion = f.save('motion.json', f.manifest);
    f.job.directorValidationReceipt = f.save('director-validation.json', {
      skillExecuted: true, validatorExecuted: true, status: 'validated-provisional-previsualization', revisionId: f.job.revisionId,
      artifacts: {firstFramePromptManifest: f.job.sourceManifest, runningHubPromptManifest: motion}});
    f.job.textBakeReceipts = [{phase: 'full', receipt: f.save('bake-receipt.json', f.receipt)}];
    f.save('job.json', f.job); f.save('authorization.json', authorization);
    const script = path.resolve(path.dirname(readyPackScript), 'build-runninghub-canvas-preparation-pack.mjs');
    const result = run(script, ['--project-root', path.dirname(f.file('job.json')), '--job', f.file('job.json'),
      '--runninghub-manifest', f.file('motion.json'), '--authorization', f.file('authorization.json')]);
    return {result, pack: result.status === 0 ? JSON.parse(readFileSync(JSON.parse(result.stdout).outputPath)) : null};
  };
  return {...f, authorization, runCanvas};
}

test('仅准备画布包不要求提前伪造用户看图或动态验收，且不具备生成权限', (t) => {
  const f = canvasFixture(t), {result, pack} = f.runCanvas();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(pack.schemaVersion, 'koubo-runninghub-canvas-preparation-pack/v1');
  assert.equal(pack.sceneCount, 2);
  assert.equal(pack.scenes.every((scene) => scene.aspectRatio === '16:9'), true);
  assert.equal(pack.userAcceptance, 'pending');
  assert.equal(pack.scenes.every((scene) => scene.dynamicValidation === 'pending' && scene.submissionAllowed === false), true);
  for (const key of ['taskSubmitted', 'videoGenerated', 'codexSubmissionAllowed', 'paidGenerationAllowed', 'formalEnabled', 'publicationEnabled']) {
    assert.equal(pack[key], false);
  }
});
for (const [name, mutate, expected] of [
  ['没有上传授权', (f) => {f.authorization.uploadAllowed = false;}, 'AUTHORIZATION_INVALID'],
  ['扩大成付费授权', (f) => {f.authorization.paidGenerationAllowed = true;}, 'AUTHORIZATION_INVALID'],
  ['伪造用户已验收', (f) => {f.authorization.userAcceptance = 'approved';}, 'AUTHORIZATION_INVALID'],
  ['授权旧修订', (f) => {f.authorization.revisionId = 'old';}, 'AUTHORIZATION_INVALID'],
  ['缺少原图逐项QA', (f) => {f.save('P01.visual-review.v1.json', {status: 'passed'});}, 'RAW_REVIEW_INVALID'],
  ['最终文字不在纸面', (f) => {
    const p = f.file('P01.text-baked-visual-review.v1.json'); const r = JSON.parse(readFileSync(p));
    r.criteria.paperSurfacePlacement = 'failed'; f.save('P01.text-baked-visual-review.v1.json', r);
  }, 'FINAL_REVIEW_INVALID'],
  ['OCR空识别', (f) => {f.receipt.scenes[0].ocr[0].recognized = '';}, 'OCR_EVIDENCE_INVALID'],
]) {
  test(`画布准备拒绝${name}`, (t) => {
    const f = canvasFixture(t); mutate(f); const {result, pack} = f.runCanvas();
    assert.notEqual(result.status, 0); assert.ok(result.stderr.includes(expected), result.stderr); assert.equal(pack, null);
  });
}
