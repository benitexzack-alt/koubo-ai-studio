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
const profile = read('workflow/active-director-profile.v1.json');
const current = validatePreproductionRequest({request, projectRoot: root, profile});
const plan = read(request.outputs.planPath);
const handoff = {plan, firstFrameManifest: read(request.outputs.firstFramePromptManifestPath),
  runningHubManifest: read(request.outputs.runningHubPromptManifestPath), aiGeneratedVideoManifest: read(request.outputs.aiGeneratedVideoPromptManifestPath)};
const actualCases = [];
const check = (name, run) => {try {run(); actualCases.push({name, passed: true});} catch (error) {actualCases.push({name, passed: false, error: error.message});}};
check('当前r3请求与三清单通过', () => {assert.deepEqual(current.errors, []); assert.deepEqual(validatePromptHandoffManifests(handoff).errors, []);});
check('r2的旧动作框与新投影联验被拒绝', () => {
  const old = read(path.resolve(output, '../paper-v9.1-r2/director-request.v1.json')).beats.find((b) => b.id === 'B07');
  old.paperScene.motionContract.projectionContract = request.beats.find((b) => b.id === 'B07').paperScene.motionContract.projectionContract;
  assert.equal(validatePaperProjectionContract({scene: old.paperScene, beat: old}).filter((e) => e.includes('ACTION_RECT_MISMATCH')).length, 4);
});
check('r3删P02投影合同不可绕过请求入口', () => {
  const missing = structuredClone(request); delete missing.beats.find((b) => b.id === 'B07').paperScene.motionContract.projectionContract;
  assert(validatePreproductionRequest({request: missing, projectRoot: root, profile}).errors.includes('PAPER_PROJECTION_REQUIRED:B07'));
});
check('r3计划删P02投影合同不可绕过清单入口', () => {
  const modified = structuredClone(handoff); delete modified.plan.paperScenes.find((s) => s.beatId === 'B07').motionContract.projectionContract;
  assert(validatePromptHandoffManifests(modified).errors.includes('PAPER_PROJECTION_REQUIRED:B07'));
});
check('清单投影覆盖范围被篡改必须拒绝', () => {
  const modified = structuredClone(handoff); modified.firstFrameManifest.policy.projectionRequiredBeatIds = [];
  assert(validatePromptHandoffManifests(modified).errors.includes('PROMPT_PHYSICAL_POLICY_MISMATCH'));
});
check('签发的r2证据保持不变', () => {
  for (const f of read(path.join(output, 'r2-immutable-signed-inputs.v1.json')).files) assert.equal(sha256File(path.join(root, f.path)), f.sha256, f.path);
});
const after = packages();
const sourceStable = JSON.stringify(before) === JSON.stringify(after);
const receipt = {schemaVersion: 'koubo-local-contract-regression/v1', startedAt, completedAt: new Date().toISOString(), command,
  exitCode: result.status === 0 && sourceStable && actualCases.every((c) => c.passed) ? 0 : 1,
  processExitCode: result.status, sourcePackages: after, sourceStableDuringRun: sourceStable,
  stdout: result.stdout, stderr: result.stderr, error: result.error?.message ?? null,
  tests: tests.map((p) => ({path: p, sha256: sha256File(path.join(root, p))})), actualCases,
  scope: '本地导演、上下游合同及本条r3真实计划回归；夹具媒体不等于本期实际图片或动态通过',
  episodeImagesGenerated: 0, episodeVideosGenerated: 0, externalCalls: false, formalAuthorized: false};
const file = path.join(output, receipt.exitCode === 0 ? 'regression-receipt.v1.json' : `regression-failed-${Date.now()}.json`);
writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx'});
console.log(JSON.stringify({exitCode: receipt.exitCode, receipt: file, actualCases, tail: result.stdout.slice(-2500), stderr: result.stderr}));
process.exitCode = receipt.exitCode;
