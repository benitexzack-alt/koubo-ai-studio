import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File, validatePreproductionRequest} from '../../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {walkRegularFiles, packageSha256} from '../../../../tools/director-skill-lock-core.mjs';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../../..');
const tests = [
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
const command = [process.execPath, '--test', '--test-reporter=spec', '--test-concurrency=2', ...tests];
const packages = ['koubo-remotion-director', 'koubo-paper-firstframe-producer', 'koubo-runninghub-video-batch'];
const sourcePackages = () => packages.map((name) => {
  const entries = walkRegularFiles(path.join(root, 'skills', name));
  return {path: `skills/${name}`, packageSha256: packageSha256(entries), entries};
});
const before = sourcePackages();
const startedAt = new Date().toISOString();
const result = spawnSync(command[0], command.slice(1), {cwd: root, encoding: 'utf8', timeout: 600000, maxBuffer: 20 * 1024 * 1024});
const sourcePath = path.resolve(output, '../paper-v9.1-r1/director-request.v2.json');
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const profile = JSON.parse(readFileSync(path.join(root, 'workflow/active-director-profile.v1.json'), 'utf8'));
const oldAttempt = validatePreproductionRequest({request: source, profile, projectRoot: root});
const oldBlocked = !oldAttempt.ok && oldAttempt.errors.includes('PAPER_PHYSICAL_POLICY_REQUIRED') &&
  oldAttempt.errors.some((e) => e.startsWith('PAPER_PHYSICAL_CONTRACT_REQUIRED'));
const after = sourcePackages();
const sourceStable = JSON.stringify(before) === JSON.stringify(after);
const receipt = {schemaVersion: 'koubo-local-contract-regression/v1', startedAt, completedAt: new Date().toISOString(), command,
  exitCode: result.status === 0 && oldBlocked && sourceStable ? 0 : 1, processExitCode: result.status,
  sourcePackages: after, sourceStableDuringRun: sourceStable,
  stdout: result.stdout, stderr: result.stderr, error: result.error?.message ?? null,
  tests: tests.map((p) => ({path: p, sha256: sha256File(path.join(root, p))})),
  actualR1MissingContractRejected: {source: {path: path.relative(root, sourcePath), sha256: sha256File(sourcePath)},
    observedErrors: oldAttempt.errors, expectedBlockObserved: oldBlocked},
  scope: '当前本地导演合同及下游合成夹具联测；技术夹具图片与OCR不等于本期真实首帧生成或用户验收',
  episodeImagesGenerated: 0, episodeVideosGenerated: 0, externalCalls: false, formalAuthorized: false};
const file = path.join(output, receipt.exitCode === 0 ? 'regression-receipt.v2.json' : `regression-failed-${Date.now()}.json`);
writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx'});
console.log(JSON.stringify({exitCode: receipt.exitCode, receipt: file, tail: result.stdout.slice(-1800), stderr: result.stderr}));
process.exitCode = receipt.exitCode;
