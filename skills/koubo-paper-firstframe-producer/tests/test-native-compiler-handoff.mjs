import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createNativePreproductionFixture, repositoryRoot, runDirectorCli} from '../../koubo-remotion-director/tests/fixtures/v9-native-preproduction.mjs';
import {sha256File, sha256Json} from '../../koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {buildDirectorCuesV2Handoff} from '../../koubo-remotion-director/scripts/director-cues-v2-handoff-core.mjs';
import {readAuthoritativeSourceManifest} from '../scripts/firstframe-batch-core.mjs';

test('真实compiler到prepare、baker及P01/P02 ready CLI完整离线回归', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'koubo-native-handoff-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const fixture = createNativePreproductionFixture(root, {twoScenes: true});
  const originals = Object.fromEntries(Object.entries(fixture.artifacts).map(([key, binding]) => [key, sha256File(path.join(root, binding.path))]));
  const run = (script, args) => {
    const result = spawnSync(process.execPath, [path.join(repositoryRoot,
      'skills/koubo-paper-firstframe-producer/scripts', script), '--project-root', root, ...args],
    {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
    return JSON.parse(result.stdout);
  };
  const prepared = run('prepare-firstframe-batch.mjs', ['--manifest', fixture.request.outputs.firstFramePromptManifestPath,
    '--director-receipt', fixture.request.outputs.validationReceiptPath, '--sample', 'P01']);
  const job = JSON.parse(readFileSync(prepared.jobPath));
  assert.equal(job.policy.incidentPreventionVersion, '1');
  assert.equal(job.revisionId, fixture.request.revisionId);
  // Only input image/review fixtures are synthetic; all compiler, prepare and OCR receipts are native outputs.
  for (const scene of job.scenes) {
    const created = spawnSync('magick', ['-size', '1920x1080', 'xc:#F5F5F5', scene.outputPath], {encoding: 'utf8'});
    assert.equal(created.status, 0, created.stderr);
    const raw = {path: scene.outputPath, sha256: sha256File(scene.outputPath)};
    const review = path.join(job.output.qaRoot, `${scene.sceneId}.visual-review.v1.json`);
    const physical = scene.physicalContract;
    // Synthetic observations exercise schema transport only. They are never
    // persisted as a real episode's image or user acceptance evidence.
    const physicalObservations = physical ? {imageSha256: raw.sha256, physicalContractSha256: scene.physicalContractSha256,
      inventory: physical.inventory.map((item) => ({partId: item.partId, observedQuantity: item.quantity,
        observedGroupIds: physical.stations.filter((station) => station.initialPartIds.includes(item.partId)).map((station) => station.groupId),
        imageBoxes: Array.from({length: item.quantity}, () => [0.1, 0.4, 0.1, 0.1]), notes: '纯结构输送夹具，非真实视觉观察'})),
      stations: physical.stations.map((station) => ({groupId: station.groupId, observedPartIds: station.initialPartIds,
        imageBox: [0.1, 0.4, 0.1, 0.1], notes: '纯结构工位夹具'})),
      transfers: physical.transfers.map((transfer) => ({actionId: transfer.actionId, imageBox: [0.1, 0.4, 0.6, 0.1],
        checks: {continuousSupport: 'passed', compatibleHeight: 'passed', noBlockingEdges: 'passed', openingFitsPart: 'passed'}, notes: '纯结构路径夹具'})),
      fixedLabels: scene.deterministicTextBake.labels.map((label) => ({nodeId: label.nodeId,
        imageBox: [0.1, 0.2, 0.1, 0.1], independentStandObserved: true, notes: '纯结构固定牌夹具'}))} : undefined;
    writeFileSync(review, JSON.stringify({schemaVersion: 'koubo-paper-firstframe-visual-review/v1',
      sceneId: scene.sceneId, imageSha256: raw.sha256, status: 'passed', fixtureOnly: true,
      criteria: Object.fromEntries(['semanticMatch', 'paperMaterial', 'depthAndContact', 'cleanTextAndBrand',
        'compositionAndReadability', 'videoReadiness'].map((key) => [key, 'passed'])),
      notes: '离线合成输入夹具，只验证原生编译及OCR链路，不构成真实首帧视觉通过。', physicalObservations}));
    writeFileSync(scene.deterministicTextBake.calibrationPath, JSON.stringify({
      schemaVersion: 'koubo-paper-firstframe-anchor-calibration/v1', sceneId: scene.sceneId, status: 'passed', sourceImage: raw,
      labels: scene.deterministicTextBake.labels.map((label) => ({nodeId: label.nodeId, anchorQuad: label.anchorQuad, placementChecked: true})),
    }));
    scene.result = {imagePath: raw.path, imageSha256: raw.sha256, visualReview: {path: review}};
  }
  // This fixture exercises the full-batch path, so model that authorization
  // explicitly instead of relying on the freshly prepared sample-only state.
  job.fullBatchAuthorized = true;
  job.status = 'full-generation-authorized';
  writeFileSync(prepared.jobPath, JSON.stringify(job));
  symlinkSync(path.join(repositoryRoot, 'skills'), path.join(root, 'skills'), 'dir');
  run('bake-firstframe-batch.mjs', ['--job', prepared.jobPath, '--source-plan', fixture.request.outputs.planPath,
    '--font', path.join(os.homedir(), 'Library/Fonts/NotoSansCJKsc-Bold.otf'), '--phase', 'full']);
  const updated = JSON.parse(readFileSync(prepared.jobPath));
  const postBakeAuthority = readAuthoritativeSourceManifest(updated, prepared.jobPath);
  assert.equal(postBakeAuthority.manifest.taskId, updated.taskId);
  assert.equal(postBakeAuthority.routeLock.route, 'v9');
  const receiptBinding = updated.textBakeReceipts.at(-1).receipt;
  const receipt = JSON.parse(readFileSync(receiptBinding.path));
  const receiptSha = sha256File(receiptBinding.path);
  assert.equal(receipt.scenes.length, 2);
  let nodes = 0;
  let handoffPath;
  for (const baked of receipt.scenes) {
    for (const row of baked.ocr) {
      assert.equal(row.matched, true);
      assert.equal(row.evaluationStage, 'final-composite');
      assert.equal(row.inputImageSha256, baked.outputImage.sha256);
      nodes++;
    }
    const assets = [{sceneId: baked.sceneId, ...baked.outputImage}].map(({sceneId, path, sha256}) => ({sceneId, path, sha256}));
    const acceptance = path.join(root, `${baked.sceneId}.acceptance.json`);
    writeFileSync(acceptance, JSON.stringify({approved: true, status: 'approved-for-runninghub-manual',
      taskId: updated.taskId, requestId: updated.requestId, revisionId: updated.revisionId,
      scope: 'text-baked-first-frames', sceneIds: [baked.sceneId], assets, assetSetSha256: sha256Json(assets),
      userQuote: '离线输入夹具，不构成现实用户授权。', approvedAt: '2026-09-08T10:00:00+08:00'}));
    const ready = run('build-runninghub-ready-pack.mjs', ['--job', prepared.jobPath,
      '--runninghub-manifest', fixture.request.outputs.runningHubPromptManifestPath,
      '--user-acceptance', acceptance, '--handoff-scope', 'first-trial', '--scene-id', baked.sceneId]);
    const pack = JSON.parse(readFileSync(ready.outputPath));
    handoffPath = ready.outputPath;
    assert.equal(pack.sceneCount, 1);
    assert.equal(pack.scenes[0].sceneId, baked.sceneId);
    assert.equal(pack.paidGenerationAllowed, false);
    assert.equal(pack.batchDynamicallyAccepted, false);
  }
  assert.ok(nodes > 0);
  assert.equal(sha256File(receiptBinding.path), receiptSha);
  for (const [key, binding] of Object.entries(fixture.artifacts)) assert.equal(sha256File(path.join(root, binding.path)), originals[key]);
  const oldOnly = runDirectorCli('build-v9-preproduction-state.mjs', root, ['--request', 'request.json',
    '--script-confirmation', 'confirmation.json', '--handoff-pack', handoffPath, '--output', 'legacy-only-state.json']);
  assert.notEqual(oldOnly.status, 0);
  assert.match(oldOnly.stderr, /V9_DIRECTOR_V2_HANDOFF_REQUIRED/);

  const scriptText = readFileSync(path.join(root, fixture.artifacts.script.path), 'utf8');
  const cuesPath = path.join(root, 'offline-director-cues-v2.json');
  const cues = {
    schemaVersion: 'koubo-director-cues/v2',
    taskId: fixture.request.taskId,
    status: 'ready-for-user-review',
    executionScope: 'director-only',
    handoffGate: {status: 'blocked-awaiting-user-approval', downstreamAllowed: false},
    inputScript: {...fixture.artifacts.script, authority: 'user-confirmed-script'},
    routingPolicy: {
      selectionBasis: 'semantic-need-not-fixed-cadence', speakerIsFallback: true,
      generatedInsertMinimum: 0, paperInsertMinimum: 0, fixedCadenceForbidden: true,
      generatedVisualCannotServeAsEvidence: true, shotcraftSelectionStage: 'post-shoot-edit-release',
      shotcraftEligibleRoutes: ['speaker', 'real-evidence'],
      shotcraftForbiddenInsideRoutes: ['paper-editorial', 'ai-generated-video'],
    },
    styleLocks: {aiGeneratedVideo: null, paperEditorial: null},
    selectionSummary: {
      mainPoint: '离线夹具只验证 v2 handoff 是当前生成入口。',
      argumentFlow: ['完整脚本保留真人，不制造测试素材'],
      routeCounts: {speaker: 1, 'real-evidence': 0, 'ai-generated-video': 0, 'paper-editorial': 0, shotcraftOpportunity: 0},
      routeRationales: {
        speaker: '离线夹具保留真人承接全文。',
        'real-evidence': '本测试不执行真实素材分路。',
        'ai-generated-video': '本测试不执行 AI 视频分路。',
        'paper-editorial': '本测试不执行纸艺分路。',
      },
      visualRhythmReason: '该夹具只验证交接门，不作真实导演判断。',
      protectedSpeakerBeatIds: ['B01'],
    },
    semanticBeats: [{
      id: 'B01', order: 1, scriptQuote: scriptText, rhetoricalRole: 'offline-handoff-fixture',
      claimClass: 'presenter-expression', requiresRealEvidence: false, primaryRoute: 'speaker',
      routeCueId: null, decisionReason: '测试只验证 v2 权威入口。', viewerGain: 'presenter-trust',
    }],
    routePlans: {
      realMaterials: {status: 'not-required', notRequiredReason: '离线测试不执行真实素材分路。', items: []},
      aiGeneratedVideos: {status: 'not-required', notRequiredReason: '离线测试不执行 AI 视频分路。', items: []},
      paperEditorials: {status: 'not-required', notRequiredReason: '离线测试不执行纸艺分路。', items: []},
    },
    shotcraftOpportunities: [],
    rhythmAudit: {basis: 'semantic-runs-not-seconds', fixedCadenceForbidden: true,
      longSpeakerRunsReviewed: true, runs: [{fromBeatId: 'B01', toBeatId: 'B01', risk: 'low',
        decision: 'keep-presenter', reason: '离线夹具不作真实节奏判断。', mitigationRefs: []}]},
  };
  writeFileSync(cuesPath, `${JSON.stringify(cues, null, 2)}\n`);
  const approvalPath = path.join(root, 'offline-director-cues-approval-v2.json');
  writeFileSync(approvalPath, `${JSON.stringify({
    schemaVersion: 'koubo-director-cues-user-approval/v2', status: 'approved',
    taskId: fixture.request.taskId, revisionId: fixture.request.revisionId,
    bindings: {directorCues: {path: path.relative(root, cuesPath), sha256: sha256File(cuesPath)}},
    approved: true, userQuote: '离线结构测试批准，不构成现实用户授权。',
    approvedAt: '2026-09-08T10:02:00+08:00', exceptions: [],
  }, null, 2)}\n`);
  const profilePath = path.join(root, 'workflow/active-director-profile.v1.json');
  mkdirSync(path.dirname(profilePath), {recursive: true});
  writeFileSync(profilePath, readFileSync(path.join(repositoryRoot, 'workflow/active-director-profile.v1.json')));
  const v2Handoff = buildDirectorCuesV2Handoff({
    projectRoot: root,
    cues: path.relative(root, cuesPath),
    approval: path.relative(root, approvalPath),
    profile: path.relative(root, profilePath),
    outputDir: 'offline-director-v2-handoff',
  });
  const builtState = runDirectorCli('build-v9-preproduction-state.mjs', root, ['--request', 'request.json',
    '--script-confirmation', 'confirmation.json', '--director-v2-handoff', path.relative(root, v2Handoff.masterPath),
    '--output', 'handoff-state.json']);
  assert.equal(builtState.status, 0, builtState.stderr);
  const state = JSON.parse(readFileSync(path.join(root, 'handoff-state.json')));
  assert.equal(state.currentStage, 'generation-handoff-ready');
  const checkedState = runDirectorCli('validate-v9-production-state.mjs', root, ['--state', 'handoff-state.json']);
  assert.equal(checkedState.status, 0, checkedState.stderr || checkedState.stdout);
  assert.equal(JSON.parse(checkedState.stdout).formalEnabled, false);
  const tampered = JSON.parse(readFileSync(handoffPath));
  tampered.scenes[0].imageToVideoPrompt += '\n替换后的错误动作';
  writeFileSync(path.join(root, 'tampered-pack.json'), JSON.stringify(tampered));
  const tamperedState = structuredClone(state);
  tamperedState.stageHistory[2].artifacts.generationInventory = {path: 'tampered-pack.json',
    sha256: sha256File(path.join(root, 'tampered-pack.json'))};
  writeFileSync(path.join(root, 'tampered-state.json'), JSON.stringify(tamperedState));
  const rejectedState = runDirectorCli('validate-v9-production-state.mjs', root, ['--state', 'tampered-state.json']);
  assert.notEqual(rejectedState.status, 0);
  assert.match(rejectedState.stdout, /DIRECT_V2_GENERATION_INVENTORY_MISMATCH/);
  assert.equal(JSON.parse(rejectedState.stdout).nextStage, null);
  const wrongReceiptState = structuredClone(state);
  wrongReceiptState.stageHistory[2].artifacts.generationOwnershipReceipt = fixture.artifacts.directorValidation;
  writeFileSync(path.join(root, 'wrong-receipt-state.json'), JSON.stringify(wrongReceiptState));
  const wrongReceipt = runDirectorCli('validate-v9-production-state.mjs', root, ['--state', 'wrong-receipt-state.json']);
  assert.notEqual(wrongReceipt.status, 0);
  assert.match(wrongReceipt.stdout, /DIRECT_V2_GENERATION_OWNERSHIP_MISMATCH/);
  for (const [key, binding] of Object.entries(fixture.artifacts)) assert.equal(sha256File(path.join(root, binding.path)), originals[key]);
  assert.equal(sha256File(receiptBinding.path), receiptSha);
  const reviewPath = fixture.request.beats[0].paperScene.motionContract.semanticReview.path;
  const review = JSON.parse(readFileSync(reviewPath));
  writeFileSync(reviewPath, JSON.stringify({...review, sourceQuote: '被换掉的原话'}));
  const rejected = spawnSync(process.execPath, [path.join(repositoryRoot,
    'skills/koubo-paper-firstframe-producer/scripts/build-runninghub-ready-pack.mjs'),
  '--project-root', root, '--job', prepared.jobPath, '--runninghub-manifest', fixture.request.outputs.runningHubPromptManifestPath,
  '--user-acceptance', path.join(root, 'P01.acceptance.json'), '--handoff-scope', 'first-trial', '--scene-id', 'P01',
  '--output', path.join(root, 'must-not-be-issued.json')], {encoding: 'utf8'});
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /PAPER_SEMANTIC_REVIEW_FILE_OR_SHA_INVALID/);
  console.log(JSON.stringify({nativeCompiler: true, nativePrepare: true, nativeBakeOcrNodes: nodes,
    nativeReadyScenes: ['P01', 'P02'], nativeV9Stage: state.currentStage,
    signedOriginalsUnchanged: true, semanticReviewDriftRejected: true, externalGeneration: false}));
});
