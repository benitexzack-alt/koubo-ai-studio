import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'renew-context.v1.mjs');
const files = () => fs.readdirSync(here).sort();
const run = mode => spawnSync(process.execPath, [script, mode], {encoding: 'utf8'});

test('只读检查不写文件，不把准备态误报为已绑定', () => {
  const before = files();
  const result = run('--check');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.officialStartPerformed, false);
  assert.equal(report.validationPerformed, false);
  assert.equal(report.contextBinding, null);
  assert.equal(report.formalEnabled, false);
  assert.deepEqual(files(), before);
});

test('冻结通知缺失时在official start之前拒绝，且不写尝试回执', () => {
  assert.equal(fs.existsSync(path.join(here, 'input-freeze.v1.json')), false, '此测试只适用冻结前');
  const before = files();
  const result = run('--start-after-freeze');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /input-freeze\.v1\.json/);
  assert.deepEqual(files(), before);
  assert.equal(fs.existsSync(path.join(here, 'start-attempt.v1.json')), false);
});

test('复用条目保留旧时间，不把本轮哈希检查时间冒充阅读时间', () => {
  const result = run('--check');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const previous = JSON.parse(fs.readFileSync(path.resolve(here, '../../candidate-preview-r1/context/read-receipts.v3.json')));
  for (const item of report.reused) {
    const old = previous.receipts.find(r => r.sha256 === item.sha256);
    assert(old);
    assert.equal(item.read_completed_at, old.read_completed_at);
  }
});
