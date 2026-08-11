#!/usr/bin/env node

import {existsSync, readFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const [jobArgument, command = 'doctor'] = process.argv.slice(2);

if (!jobArgument) {
  console.error(
    '用法：node tools/validate-active-production-profile.mjs <production-job.json> [command]',
  );
  process.exit(1);
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = resolve(projectRoot, 'workflow/active-production-profile.v1.json');
const toAbsolute = (filePath) =>
  isAbsolute(filePath) ? filePath : resolve(projectRoot, filePath);
const readJson = (filePath, label) => {
  const absolutePath = toAbsolute(filePath);
  if (!existsSync(absolutePath)) throw new Error(`${label}不存在：${filePath}`);
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
};
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

let job;
let profile;
try {
  job = readJson(jobArgument, '生产任务');
  profile = readJson(profilePath, '当前生产档案');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const errors = [];
const declaredProfile = job.productionProfile;
const matchesActive =
  declaredProfile?.id === profile.profileId &&
  declaredProfile?.version === profile.profileVersion;
const isLockedHistoricalRegression =
  command === 'regression' &&
  job.videoId === profile.historicalRollbackBaseline?.lockedReferenceVideoId &&
  job.baseline?.id === profile.historicalRollbackBaseline?.id &&
  job.baseline?.revision === profile.historicalRollbackBaseline?.revision;

if (profile.status !== 'active-default') {
  errors.push('当前生产档案不是 active-default，禁止继续生产。');
}

if (matchesActive) {
  if (job.experiment?.id !== profile.requirements?.experimentId) {
    errors.push(
      `任务虽声明 ${profile.profileVersion}，但 experiment.id 不是 ${profile.requirements?.experimentId}。`,
    );
  }
} else if (isLockedHistoricalRegression) {
  // 唯一自动豁免：对锁定的历史母版执行 regression，不得用于新视频生产。
} else {
  const approval = job.profileDowngrade;
  if (
    approval?.approved !== true ||
    approval?.approvedBy !== 'user' ||
    !isText(approval?.approvedAt) ||
    !isText(approval?.reason) ||
    !isText(approval?.scope)
  ) {
    errors.push(
      `当前默认生产档案是 ${profile.profileVersion}（${profile.profileId}）；任务没有匹配该档案，也没有完整的用户明确降级批准。`,
    );
  }
  if (!isText(declaredProfile?.id) || !isText(declaredProfile?.version)) {
    errors.push('降级任务仍必须声明 productionProfile.id 和 productionProfile.version。');
  }
}

if (errors.length) {
  console.error(`当前生产档案校验失败：\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const route = matchesActive
  ? `${profile.profileVersion} 默认档案`
  : isLockedHistoricalRegression
    ? 'V7.2 锁定母版回归豁免'
    : `用户明确批准的 ${declaredProfile.version} 降级`;
console.log(`当前生产档案校验通过：${route}。`);
