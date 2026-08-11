#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const testRootRelative = `work/.production-command-gate-test-${process.pid}`;
const testRoot = path.join(projectRoot, testRootRelative);
const validator = 'tools/validate-production-command-gate.mjs';

const writeJob = (name, value) => {
  const relativePath = `${testRootRelative}/${name}.json`;
  writeFileSync(
    path.join(projectRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
  return relativePath;
};
const run = (jobPath, command) =>
  spawnSync(process.execPath, [validator, jobPath, command], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
const output = (result) => `${result.stdout ?? ''}${result.stderr ?? ''}`;
const assertPasses = (label, result) => {
  if (result.status !== 0) throw new Error(`${label}应通过：\n${output(result)}`);
};
const assertFailsWith = (label, result, expected) => {
  if (result.status === 0) throw new Error(`${label}应失败，但通过了。`);
  if (!output(result).includes(expected)) {
    throw new Error(`${label}缺少错误“${expected}”：\n${output(result)}`);
  }
};

mkdirSync(testRoot, {recursive: true});
try {
  const locked = writeJob('locked', {
    formal: {enabled: false, blockedReason: '等待用户确认预览。'},
  });
  assertFailsWith('锁定时正式渲染', run(locked, 'formal'), '禁止执行 formal');
  assertFailsWith('锁定时正式音频处理', run(locked, 'formal-audio'), '禁止执行 formal-audio');
  assertFailsWith('锁定时全流程', run(locked, 'all'), '禁止执行 all');
  assertPasses('锁定时预览', run(locked, 'preview'));

  const unlocked = writeJob('unlocked', {formal: {enabled: true}});
  assertPasses('明确解锁后正式渲染', run(unlocked, 'formal'));

  console.log('生产命令门禁回归通过：5/5。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
