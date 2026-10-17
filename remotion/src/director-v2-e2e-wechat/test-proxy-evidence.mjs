#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(THIS_DIR, 'proxy-evidence.mjs');
const BLOCK_CODE = 'CANDIDATE_PROXY_DIRECT_CLI_BLOCKED';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const tempRoot = mkdtempSync(resolve(tmpdir(), 'proxy-direct-cli-negative-'));
const tests = [];

try {
  for (const mode of ['build', 'validate']) {
    const receiptPath = resolve(tempRoot, `${mode}-receipt.json`);
    const evidenceDir = resolve(tempRoot, `${mode}-evidence`);
    const proxyPath = resolve(tempRoot, `${mode}-proxy.mp4`);
    const result = spawnSync(
      process.execPath,
      [
        SCRIPT,
        mode,
        '--proxy',
        proxyPath,
        '--receipt',
        receiptPath,
        '--evidence-dir',
        evidenceDir,
      ],
      {encoding: 'utf8', maxBuffer: 1024 * 1024},
    );
    assert(result.status !== 0, `Direct proxy ${mode} unexpectedly succeeded`);
    assert(result.stderr.includes(BLOCK_CODE), `Direct proxy ${mode} did not emit ${BLOCK_CODE}`);
    assert(!existsSync(proxyPath), `Direct proxy ${mode} created proxy output before blocking`);
    assert(!existsSync(receiptPath), `Direct proxy ${mode} created receipt before blocking`);
    assert(!existsSync(evidenceDir), `Direct proxy ${mode} created evidence directory before blocking`);
    tests.push({id: `direct-proxy-${mode}-before-io-blocked`, passed: true, exitCode: result.status});
  }
} finally {
  rmSync(tempRoot, {recursive: true, force: true});
}

process.stdout.write(`${JSON.stringify({ok: true, count: tests.length, tests}, null, 2)}\n`);
