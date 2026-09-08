#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const directorTests = [
  'test-paper-motion-contract', 'test-preproduction-director-contract',
  'test-postshoot-rebind-contract', 'test-postshoot-incident-prevention',
  'test-paper-asset-intake', 'test-paper-asset-intake-incident', 'test-paper-asset-intake-real-negatives',
  'test-paper-asset-intake-media', 'test-first-candidate-runtime-tool-closure',
  'test-v9-workflow-state', 'test-first-candidate-input-contract', 'test-first-candidate-producer-integration',
  'test-firstframe-text-bake', 'test-platform-safe-area', 'test-integrity-anchor-trust-root',
  'test-progressive-local-motion-contract', 'test-director-request-template-plan-only',
  'test-compiler-publication-state-machine', 'test-publication-consumer-gate',
  'test-request-isolation', 'test-supervisor-a-acceptance-gate',
];
const programs = [
  ...directorTests.map((name) => `skills/koubo-remotion-director/tests/${name}.mjs`),
  'skills/koubo-paper-firstframe-producer/tests/test-firstframe-batch.mjs',
  'skills/koubo-paper-firstframe-producer/tests/test-text-bake-runninghub-handoff.mjs',
  'skills/koubo-paper-firstframe-producer/tests/test-native-compiler-handoff.mjs',
  'skills/koubo-remotion-director/scripts/test-director-contract-v2.mjs',
  'skills/koubo-remotion-director/scripts/test-director-production-preflight-v2.mjs',
  'tools/test-active-director-profile.mjs',
  'tools/test-director-production-binding.mjs',
];
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 ? path.resolve(root, process.argv[outputIndex + 1] ?? '') : null;
if (output && existsSync(output)) throw new Error('回归回执已存在，不覆盖');
const results = [];
for (const program of programs) {
  const file = path.join(root, program);
  const started = Date.now();
  if (!existsSync(file)) {
    results.push({program, status: 'failed', reason: 'test-program-missing'});
    continue;
  }
  const before = hash(file);
  const env = {...process.env};
  delete env.KOUBO_SKIP_MEDIA_FIXTURE;
  const flags = program.endsWith('/test-first-candidate-input-contract.mjs') ? ['--experimental-vm-modules'] : [];
  const run = spawnSync(process.execPath, [...flags, file], {cwd: root, env, encoding: 'utf8', timeout: 240000, maxBuffer: 8 * 1024 * 1024});
  const stdout = run.stdout ?? '';
  const stderr = run.stderr ?? '';
  const skip = /"skipped"\s*:\s*true/u.test(stdout);
  const unchanged = hash(file) === before;
  const status = run.status === 0 && unchanged ? (skip ? 'skipped' : 'passed') : 'failed';
  results.push({program, sha256: before, status, exitCode: run.status, signal: run.signal,
    unchangedDuringRun: unchanged, durationMs: Date.now() - started, stdout, stderr,
    error: run.error?.message ?? null});
  console.log(JSON.stringify({program, status, exitCode: run.status}));
}
const counts = Object.fromEntries(['passed', 'failed', 'skipped'].map((status) => [status, results.filter((r) => r.status === status).length]));
const receipt = {
  schemaVersion: 'koubo-director-incident-local-regression/v1', generatedAt: new Date().toISOString(),
  status: counts.failed ? 'local-regression-failed' : counts.skipped ? 'local-regression-passed-with-skips' : 'local-regression-passed',
  counts, countingUnit: 'test-program-not-assertion', results,
  executionScope: 'local-tests-only-including-temporary-media-fixtures-and-readonly-incident-evidence',
  productionRendered: false, externalGenerationRequested: false, paidActionRequested: false,
  dynamicModelAcceptance: 'not-performed', formalAuthorized: false,
};
if (output) {
  mkdirSync(path.dirname(output), {recursive: true});
  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx'});
}
console.log(JSON.stringify({status: receipt.status, counts, output, sha256: output ? hash(output) : null}));
if (counts.failed) process.exitCode = 1;
