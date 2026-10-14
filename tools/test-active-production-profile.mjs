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

const v9Job = {
  schemaVersion: 1,
  videoId: 'NEW_VIDEO',
  productionProfile: {id: 'v9-semantic-direction-sfx', version: 'V9'},
  experiment: {id: 'v8-semantic-continuity-sfx'},
  baseline: {id: 'koubo-formal-16x9-v1', revision: 'V7.2-20260730'},
};

mkdirSync(testRoot, {recursive: true});
try {
  const v9Result = run(writeJob('v9', v9Job));
  assertPasses('V9默认任务沿用现有技术合同', v9Result);
  for (const required of ['词条成片主字60px、说明44px', '档案校验不代表参数已落片或听感通过', 'V9 新任务执行基准', '下一条完整实片仍待验证']) {
    if (!output(v9Result).includes(required)) {
      throw new Error(`V9新任务预检缺少下一条基准提示：${required}`);
    }
  }

  const silentV8 = {
    ...v9Job,
    productionProfile: {id: 'v8-semantic-continuity-sfx', version: 'V8'},
  };
  assertFailsWith(
    '新任务静默回退V8',
    run(writeJob('silent-v8', silentV8)),
    '没有完整的用户明确降级批准',
  );
  assertFailsWith(
    'V9不得声明未接入的技术合同',
    run(writeJob('wrong-experiment', {...v9Job, experiment: {id: 'unwired-v9-contract'}})),
    'experiment.id 不是 v8-semantic-continuity-sfx',
  );
  assertPasses(
    '用户单条明确批准V8降级',
    run(writeJob('approved-v8', {
      ...silentV8,
      profileDowngrade: {
        approved: true,
        approvedBy: 'user',
        approvedAt: '2026-10-14T10:00:00+08:00',
        reason: '仅用于此测试夹具的单条旧版对照。',
        scope: '单条视频 NEW_VIDEO',
      },
    })),
  );

  const silentV72 = {
    ...v9Job,
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

  console.log('当前生产档案回归通过：9/9。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
