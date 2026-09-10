import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File, validatePreproductionRequest, validatePromptHandoffManifests} from '../../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {validatePaperProjectionContract} from '../../../../skills/koubo-remotion-director/scripts/paper-projection-contract.mjs';
import {walkRegularFiles, packageSha256} from '../../../../tools/director-skill-lock-core.mjs';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../../..');
const read = (p) => JSON.parse(readFileSync(path.resolve(root, p), 'utf8'));
const tests = [
  'koubo-remotion-director/tests/test-paper-projection-contract.mjs',
  'koubo-remotion-director/tests/test-paper-physical-contract.mjs',
  'koubo-remotion-director/tests/test-paper-motion-contract.mjs',
  'koubo-remotion-director/tests/test-preproduction-director-contract.mjs',
  'koubo-remotion-director/tests/test-postshoot-incident-prevention.mjs',
  'koubo-remotion-director/tests/test-postshoot-rebind-contract.mjs',
  'koubo-remotion-director/tests/test-paper-asset-intake-incident.mjs',
  'koubo-remotion-director/tests/test-v9-workflow-state.mjs',
  'koubo-remotion-director/tests/test-firstframe-text-bake.mjs',
  'koubo-paper-firstframe-producer/tests/test-raw-visual-review.mjs',
  'koubo-paper-firstframe-producer/tests/test-firstframe-batch.mjs',
  'koubo-paper-firstframe-producer/tests/test-native-compiler-handoff.mjs',
  'koubo-paper-firstframe-producer/tests/test-text-bake-runninghub-handoff.mjs',
].map((p) => `skills/${p}`);
const packages = () => ['koubo-remotion-director', 'koubo-paper-firstframe-producer', 'koubo-runninghub-video-batch'].map((name) => {
  const entries = walkRegularFiles(path.join(root, 'skills', name));
  return {path: `skills/${name}`, packageSha256: packageSha256(entries), entries};
});
const before = packages();
const startedAt = new Date().toISOString();
const command = [process.execPath, '--test', '--test-reporter=spec', '--test-concurrency=2', ...tests];
const result = spawnSync(command[0], command.slice(1), {cwd: root, encoding: 'utf8', timeout: 600000, maxBuffer: 20 * 1024 * 1024});
const request = read(path.join(output, 'director-request.v1.json'));
const old = read(path.resolve(output, '../paper-v9.1-r3/director-request.v1.json'));
const profile = read('workflow/active-director-profile.v1.json');
const current = validatePreproductionRequest({request, projectRoot: root, profile});
const plan = read(request.outputs.planPath);
const handoff = {plan, firstFrameManifest: read(request.outputs.firstFramePromptManifestPath),
  runningHubManifest: read(request.outputs.runningHubPromptManifestPath), aiGeneratedVideoManifest: read(request.outputs.aiGeneratedVideoPromptManifestPath)};
const actualCases = [];
const check = (name, run) => {try {run(); actualCases.push({name, passed: true});} catch (error) {actualCases.push({name, passed: false, error: error.message});}};
check('当前r4请求与三清单通过', () => {assert.deepEqual(current.errors, []); assert.deepEqual(validatePromptHandoffManifests(handoff).errors, []);});
for (const id of ['B04', 'B10']) {
  check(`${id}旧动作框与新投影联验被拒绝`, () => {
    const previous = structuredClone(old.beats.find((b) => b.id === id));
    previous.paperScene.motionContract.projectionContract = request.beats.find((b) => b.id === id).paperScene.motionContract.projectionContract;
    assert.equal(validatePaperProjectionContract({scene: previous.paperScene, beat: previous}).filter((e) => e.includes('ACTION_RECT_MISMATCH')).length, 2);
  });
  check(`${id}删除投影不可绕过请求入口`, () => {
    const missing = structuredClone(request); delete missing.beats.find((b) => b.id === id).paperScene.motionContract.projectionContract;
    assert(validatePreproductionRequest({request: missing, projectRoot: root, profile}).errors.includes(`PAPER_PROJECTION_REQUIRED:${id}`));
  });
  check(`${id}删除投影不可绕过清单入口`, () => {
    const modified = structuredClone(handoff); delete modified.plan.paperScenes.find((s) => s.beatId === id).motionContract.projectionContract;
    assert(validatePromptHandoffManifests(modified).errors.includes(`PAPER_PROJECTION_REQUIRED:${id}`));
  });
}
check('六镜动作与原话不变，只有两镜材料和派生投影变化', () => {
  assert.deepEqual(request.beats.map((b) => b.spokenLine), old.beats.map((b) => b.spokenLine));
  for (const b of request.beats.filter((b) => b.paperScene)) {
    const a = structuredClone(b.paperScene);
    const previous = structuredClone(old.beats.find((o) => o.id === b.id).paperScene);
    delete a.motionContract.semanticReview; delete previous.motionContract.semanticReview;
    assert.deepEqual(a.motionContract.physicalContract, previous.motionContract.physicalContract);
    if (['B04', 'B10'].includes(b.id)) {
      a.objectGroups.forEach((g, i) => {g.material = previous.objectGroups[i].material;});
      delete a.motionContract.projectionContract;
      a.motionContract.actions.forEach((action, i) => {action.sweptRect = previous.motionContract.actions[i].sweptRect;});
      a.prompt = previous.prompt;
    }
    assert.deepEqual(a, previous);
  }
});
check('规划底台和完整支承/动作范围在安全区内，后架不入动作区', () => {
  for (const d of read(path.join(output, 'projection-derivation.v1.json')).scenes) {
    const g = d.referenceGuide;
    const contained = (r, safe) => r.x >= safe.x && r.y >= safe.y && r.x + r.width <= safe.x + safe.width + 1e-8 && r.y + r.height <= safe.y + safe.height + 1e-8;
    assert(contained(g.functionalBaseFullOutline, g.contentSafeRect));
    for (const r of [...g.actionRects, ...g.supportRects]) assert(contained(r.rect, g.contentSafeRect));
    const firstY = Math.min(...g.actionRects.map((r) => r.rect.y));
    assert.equal(firstY - g.rearStaticMaximumY, 24);
    assert.equal(g.initialParts.length, 2);
    assert(g.initialParts.every((p) => p.pose === 'already-flat-at-first-frame'));
    assert.equal(g.exactPixelMatchRequired, false);
    assert.equal(g.actualGeometryCalibrated, false);
  }
});
check('P03咨询第二路方向向左，首帧折页已平放', () => {
  const b = request.beats.find((b) => b.id === 'B10');
  const p = b.paperScene.motionContract.physicalContract;
  assert.equal(p.docks.find((d) => d.id === 'A2-from').xMm, 400);
  assert.equal(p.docks.find((d) => d.id === 'A2-to').xMm, 250);
  assert(b.paperScene.prompt.firstFrame.includes('从首帧起已经平放'));
  assert(b.paperScene.motionContract.actions.every((a) => a.operation === 'slide'));
});
check('清单投影覆盖范围篡改必须拒绝', () => {
  const modified = structuredClone(handoff); modified.firstFrameManifest.policy.projectionRequiredBeatIds = [];
  assert(validatePromptHandoffManifests(modified).errors.includes('PROMPT_PHYSICAL_POLICY_MISMATCH'));
});
check('旧r3签发文件及P02三张图像保持不变', () => {
  const snapshot = read(path.join(output, 'r3-immutable-signed-inputs.v1.json'));
  for (const f of [...snapshot.files, ...snapshot.preservedP02Images]) assert.equal(sha256File(path.join(root, f.path)), f.sha256, f.path);
});
const after = packages();
const sourceStable = JSON.stringify(before) === JSON.stringify(after);
const receipt = {schemaVersion: 'koubo-local-contract-regression/v1', startedAt, completedAt: new Date().toISOString(), command,
  exitCode: result.status === 0 && sourceStable && actualCases.every((c) => c.passed) ? 0 : 1,
  processExitCode: result.status, sourcePackages: after, sourceStableDuringRun: sourceStable,
  stdout: result.stdout, stderr: result.stderr, error: result.error?.message ?? null,
  tests: tests.map((p) => ({path: p, sha256: sha256File(path.join(root, p))})), actualCases,
  scope: '本地导演、上下游合同及本条r4真实计划回归；夹具媒体不等于本期实际图片或动态通过',
  episodeImagesGenerated: 0, episodeVideosGenerated: 0, externalCalls: false, formalAuthorized: false};
const file = path.join(output, receipt.exitCode === 0 ? 'regression-receipt.v1.json' : `regression-failed-${Date.now()}.json`);
writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx'});
console.log(JSON.stringify({exitCode: receipt.exitCode, receipt: file, actualCases, tail: result.stdout.slice(-2500), stderr: result.stderr}));
process.exitCode = receipt.exitCode;
