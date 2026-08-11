#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const testRootRelative = `work/.active-profile-test-${process.pid}`;
const testRoot = path.join(projectRoot, testRootRelative);
const validator = 'tools/validate-active-production-profile.mjs';

const writeJob = (name, value) => {
  const relativePath = `${testRootRelative}/${name}.json`;
  writeFileSync(
    path.join(projectRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
  return relativePath;
};
const run = (jobPath, command = 'doctor') =>
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

const v8Job = {
  schemaVersion: 1,
  videoId: 'NEW_VIDEO',
  productionProfile: {id: 'v8-semantic-continuity-sfx', version: 'V8'},
  experiment: {id: 'v8-semantic-continuity-sfx'},
  baseline: {id: 'koubo-formal-16x9-v1', revision: 'V7.2-20260730'},
};

mkdirSync(testRoot, {recursive: true});
try {
  assertPasses('V8默认任务', run(writeJob('v8', v8Job)));

  const silentV72 = {
    ...v8Job,
    productionProfile: {id: 'v72', version: 'V7.2'},
    experiment: undefined,
  };
  assertFailsWith(
    '静默回退V7.2',
    run(writeJob('silent-v72', silentV72)),
    '没有完整的用户明确降级批准',
  );

  const approvedV72 = {
    ...silentV72,
    profileDowngrade: {
      approved: true,
      approvedBy: 'user',
      approvedAt: '2026-08-11T10:00:00+08:00',
      reason: '本条仅做锁定旧版对照。',
      scope: '单条视频 NEW_VIDEO',
    },
  };
  assertPasses('用户明确批准降级', run(writeJob('approved-v72', approvedV72)));

  const historical = {
    schemaVersion: 1,
    videoId: 'CYCLE_ASSETS_20260730_talk01',
    baseline: {id: 'koubo-formal-16x9-v1', revision: 'V7.2-20260730'},
  };
  const historicalPath = writeJob('historical', historical);
  assertPasses('锁定母版回归', run(historicalPath, 'regression'));
  assertFailsWith(
    '锁定母版不得用于普通生产',
    run(historicalPath, 'formal'),
    '没有完整的用户明确降级批准',
  );

  const fakeHistorical = {...historical, videoId: 'OTHER_OLD_VIDEO'};
  assertFailsWith(
    '其他旧视频不得冒充母版回归',
    run(writeJob('fake-historical', fakeHistorical), 'regression'),
    '没有完整的用户明确降级批准',
  );

  console.log('当前生产档案回归通过：6/6。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
