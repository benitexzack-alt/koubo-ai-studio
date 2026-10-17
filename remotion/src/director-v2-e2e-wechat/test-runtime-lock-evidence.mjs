#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'runtime-lock-evidence.mjs');
const EXPECTED = [
  'fixture-only-independent-signed-runtime-lock-shape',
  'snapshot-recursive-writable-directory-rejected',
  'runtime-lock-complete-forgery-rejected',
  'snapshot-swap-in-before-restore-rejected',
  'runtime-snapshot-env-presence-rejected',
  'fixture-only-minimal-path-no-proxy-shape',
  'runtime-path-tamper-rejected',
  'runtime-proxy-environment-rejected',
  'direct-runtime-lock-path-override-before-io-blocked',
  'direct-runtime-lock-validate-before-io-blocked',
];
const result = spawnSync(process.execPath, [SCRIPT, 'selftest'], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
if (result.status !== 0) throw new Error(`runtime-lock selftest exited ${result.status}: ${result.stderr}`);
const report = JSON.parse(result.stdout);
const ids = report.tests?.map((item) => item.id) ?? [];
if (report.ok !== true || report.count !== EXPECTED.length || JSON.stringify(ids) !== JSON.stringify(EXPECTED)) {
  throw new Error(`runtime-lock selftest manifest mismatch: ${JSON.stringify({ok: report.ok, count: report.count, ids})}`);
}
if (!report.tests.every((item) => item.passed === true)) throw new Error('runtime-lock selftest contains failed/skipped cases');
process.stdout.write(`${JSON.stringify({ok: true, suite: 'runtime-lock-independent', count: ids.length, tests: report.tests}, null, 2)}\n`);
