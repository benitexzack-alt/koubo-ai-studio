import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createNativePreproductionFixture, repositoryRoot, runDirectorCli} from '../../koubo-remotion-director/tests/fixtures/v9-native-preproduction.mjs';
import {sha256File, sha256Json} from '../../koubo-remotion-director/scripts/preproduction-director-core.mjs';

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
    writeFileSync(review, JSON.stringify({schemaVersion: 'koubo-paper-firstframe-visual-review/v1',
      sceneId: scene.sceneId, imageSha256: raw.sha256, status: 'passed', fixtureOnly: true}));
    writeFileSync(scene.deterministicTextBake.calibrationPath, JSON.stringify({
      schemaVersion: 'koubo-paper-firstframe-anchor-calibration/v1', sceneId: scene.sceneId, status: 'passed', sourceImage: raw,
      labels: scene.deterministicTextBake.labels.map((label) => ({nodeId: label.nodeId, anchorQuad: label.anchorQuad, placementChecked: true})),
    }));
    scene.result = {imagePath: raw.path, imageSha256: raw.sha256, visualReview: {path: review}};
  }
  writeFileSync(prepared.jobPath, JSON.stringify(job));
  symlinkSync(path.join(repositoryRoot, 'skills'), path.join(root, 'skills'), 'dir');
  run('bake-firstframe-batch.mjs', ['--job', prepared.jobPath, '--source-plan', fixture.request.outputs.planPath,
    '--font', path.join(os.homedir(), 'Library/Fonts/NotoSansCJKsc-Bold.otf'), '--phase', 'full']);
  const updated = JSON.parse(readFileSync(prepared.jobPath));
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
  const builtState = runDirectorCli('build-v9-preproduction-state.mjs', root, ['--request', 'request.json',
    '--script-confirmation', 'confirmation.json', '--handoff-pack', handoffPath, '--output', 'handoff-state.json']);
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
  assert.match(rejectedState.stdout, /PACK_SCENE_CONTENT_MISMATCH/);
  assert.equal(JSON.parse(rejectedState.stdout).nextStage, null);
  const wrongReceiptState = structuredClone(state);
  wrongReceiptState.stageHistory[2].artifacts.generationOwnershipReceipt = fixture.artifacts.directorValidation;
  writeFileSync(path.join(root, 'wrong-receipt-state.json'), JSON.stringify(wrongReceiptState));
  const wrongReceipt = runDirectorCli('validate-v9-production-state.mjs', root, ['--state', 'wrong-receipt-state.json']);
  assert.notEqual(wrongReceipt.status, 0);
  assert.match(wrongReceipt.stdout, /PACK_STATE_BINDING_MISMATCH/);
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
