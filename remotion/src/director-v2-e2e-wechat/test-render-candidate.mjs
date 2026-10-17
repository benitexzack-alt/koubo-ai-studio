#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(THIS_DIR, 'render-candidate.mjs');
const EXPECTED_TEST_IDS = [
  'fixture-only-loopback-sandbox-profile-shape',
  'sandbox-external-deny-rule-removal-rejected',
  'production-action-without-system-runtime-lock-rejected',
  'unsigned-local-wrapper-receipt-write-rejected',
  'repository-public-key-cannot-validate-system-attestation',
  'fixture-only-candidate-media-build-command-shape',
  'candidate-media-build-receipt-required-before-preview-actions',
  'controlled-stills-receipt-required-before-external-acceptance',
  'direct-runtime-package-graph-missing-dependency-rejected',
  'fixture-only-locked-candidate-contract-shape',
  'video-render-before-still-acceptance-rejected',
  'fixture-only-remotion-overwrite-false-argument-shape',
  'fixture-only-remotion-bundle-cache-disabled-argument-shape',
  'fixture-only-remotion-browser-argument-shape',
  'contract-output-change-rejected',
  'contract-entry-change-rejected',
  'contract-composition-change-rejected',
  'contract-publicdir-change-rejected',
  'contract-screen-source-range-tamper-rejected',
  'contract-talking-head-source-range-tamper-rejected',
  'contract-closing-frame-gate-tamper-rejected',
  'absolute-output-path-rejected',
  'parent-escape-output-path-rejected',
  'symlink-output-parent-rejected',
  'dangling-output-symlink-rejected',
  'o_nofollow-exclusive-open-on-dangling-symlink-rejected',
  'existing-output-rejected',
  'fixture-only-cli-layout-shape',
  'cli-launcher-replacement-rejected',
  'cli-real-target-replacement-rejected',
  'runtime-dependency-missing-rejected',
  'runtime-dependency-content-replacement-rejected',
  'fixture-only-validator-command-sandbox-shape',
  'spawn-preflight-to-spawn-content-change-rejected',
  'existing-receipt-overwrite-rejected',
  'direct-output-without-wrapper-receipt-rejected',
  'forged-wrapper-receipt-rejected',
  'self-authored-envelope-without-external-trust-rejected',
  'repository-live-build-media-before-io-blocked',
  'repository-live-preflight-before-io-blocked',
  'repository-live-stills-before-io-blocked',
  'repository-live-render-before-io-blocked',
  'repository-live-validate-media-build-receipt-before-io-blocked',
  'repository-live-validate-stills-receipt-before-io-blocked',
  'repository-live-validate-render-receipt-before-io-blocked',
];

const fail = (message) => {
  throw new Error(message);
};

const result = spawnSync(process.execPath, [SCRIPT, 'selftest'], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

if (result.status !== 0) {
  fail(`candidate wrapper selftest exited ${result.status}: ${result.stderr}`);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  fail(`candidate wrapper selftest did not emit JSON: ${error.message}`);
}

const actualIds = report.tests?.map((test) => test.id) ?? [];
if (report.ok !== true || report.count !== EXPECTED_TEST_IDS.length) {
  fail(`candidate wrapper test count/status mismatch: ${JSON.stringify({ok: report.ok, count: report.count})}`);
}
if (JSON.stringify(actualIds) !== JSON.stringify(EXPECTED_TEST_IDS)) {
  fail(`candidate wrapper test IDs differ: ${JSON.stringify(actualIds)}`);
}
if (!report.tests.every((test) => test.passed === true)) {
  fail('candidate wrapper test report contains a failed or skipped test');
}

process.stdout.write(
  `${JSON.stringify({ok: true, suite: 'candidate-wrapper-independent', count: actualIds.length, tests: report.tests}, null, 2)}\n`,
);
