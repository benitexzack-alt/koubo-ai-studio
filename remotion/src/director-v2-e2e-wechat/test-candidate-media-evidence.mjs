#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(THIS_DIR, 'candidate-media-evidence.mjs');
const EXPECTED_TEST_IDS = [
  'fixture-only-locked-contract-caption-visual-shape',
  'receipt-missing-clip-rejected',
  'receipt-extra-clip-rejected',
  'receipt-duplicate-clip-rejected',
  'receipt-reordered-clip-rejected',
  'contract-missing-store-entry-rejected',
  'screen-playback-rate-over-1p25-rejected',
  'screen-source-range-query-tamper-rejected',
  'screen-source-range-answerRecommendations-tamper-rejected',
  'screen-source-range-mapApp-tamper-rejected',
  'screen-source-range-storeEntryJump-tamper-rejected',
  'screen-source-range-storeMenu-tamper-rejected',
  'talking-head-source-range-tamper-rejected',
  'mutable-still-acceptance-state-in-input-contract-rejected',
  'missing-output-proof-window-check-rejected',
  'frame-940-automatic-ocr-rejected',
  'closing-status-strip-overlap-box-model-rejected',
  'closing-status-strip-clipped-text-rejected',
  'input-evidence-receipt-mutable-acceptance-rejected',
  'caption-gap-rejected',
  'caption-missing-cue-rejected',
  'caption-rewrite-rejected',
  'caption-reordered-rejected',
  'fixture-only-declared-static-media-binding-shape',
  'spoken-path-not-publicdir-plus-static-name-rejected',
  'runtime-missing-store-entry-rejected',
  'runtime-unregistered-numeric-trim-rejected',
  'runtime-missing-talking-head-rejected',
  'fixture-only-runtime-action-closing-and-boundary-shape',
  'closing-frame-1286-first-allowance-tamper-rejected',
  'store-jump-visual-sfx-frame-tamper-rejected',
  'closing-status-strip-returned-inside-card-rejected',
  'condition-boundary-shared-geometry-tamper-rejected',
  'action-boundary-shared-geometry-tamper-rejected',
  'fixture-only-representative-ffmpeg-no-overwrite-shape',
  'concurrent-media-evidence-build-rejected',
  'dangling-media-evidence-path-rejected',
  'existing-representative-output-rejected',
  'direct-build-cli-before-io-blocked',
  'direct-validate-cli-before-io-blocked',
];

const fail = (message) => {
  throw new Error(message);
};

const result = spawnSync(process.execPath, [SCRIPT, 'selftest'], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});

if (result.status !== 0) {
  fail(`candidate-media selftest exited ${result.status}: ${result.stderr}`);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  fail(`candidate-media selftest did not emit JSON: ${error.message}`);
}

const actualIds = report.tests?.map((test) => test.id) ?? [];
if (report.ok !== true || report.count !== EXPECTED_TEST_IDS.length) {
  fail(`candidate-media test count/status mismatch: ${JSON.stringify({ok: report.ok, count: report.count})}`);
}
if (JSON.stringify(actualIds) !== JSON.stringify(EXPECTED_TEST_IDS)) {
  fail(`candidate-media test IDs differ: ${JSON.stringify(actualIds)}`);
}
if (!report.tests.every((test) => test.passed === true)) {
  fail('candidate-media test report contains a failed or skipped test');
}

process.stdout.write(
  `${JSON.stringify({ok: true, suite: 'candidate-media-evidence-independent', count: actualIds.length, tests: report.tests}, null, 2)}\n`,
);
