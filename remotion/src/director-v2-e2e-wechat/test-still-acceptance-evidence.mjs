#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'still-acceptance-evidence.mjs');
const expected = [
  'fixture-only-accepted-external-structure-shape',
  'missing-still-rejected',
  'reordered-stills-rejected',
  'wrong-still-sha-rejected',
  'self-review-rejected',
  'execution-group-self-sign-rejected',
  'non-accepted-decision-rejected',
  'manual-required-check-missing-rejected',
  'frame-940-manual-check-missing-rejected',
  'frame-30-proof-ocr-missing-rejected',
  'direct-still-acceptance-validate-before-io-blocked',
  'direct-still-acceptance-bypass-before-io-blocked',
  'fixture-only-independent-ed25519-signature-shape',
  'self-authored-or-wrong-key-signature-rejected',
];
const result = spawnSync(process.execPath, [script, 'selftest'], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
if (result.status !== 0) throw new Error(`still acceptance selftest exited ${result.status}: ${result.stderr}`);
const report = JSON.parse(result.stdout);
const ids = report.tests?.map((item) => item.id) ?? [];
if (report.ok !== true || report.count !== expected.length || JSON.stringify(ids) !== JSON.stringify(expected)) {
  throw new Error(`still acceptance tests missing/reordered: ${JSON.stringify({count: report.count, ids})}`);
}
if (!report.tests.every((item) => item.passed === true)) throw new Error('still acceptance tests contain failure/skip');
process.stdout.write(`${JSON.stringify({ok: true, suite: 'still-acceptance-independent', count: ids.length, tests: report.tests}, null, 2)}\n`);
