#!/usr/bin/env node

import { constants } from 'node:fs';
import {
  access,
  lstat,
  mkdir,
  readlink,
  realpath,
  symlink,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const codexHome = process.env.CODEX_HOME?.trim()
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(os.homedir(), '.codex');
const skillsRoot = path.join(codexHome, 'skills');
const dryRun = process.argv.includes('--dry-run');

const skillNames = [
  'content-brain-gate',
  'humanize-koubo-script',
  'koubo-remotion-director',
];

const exists = async (target) => {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const inspectTarget = async (name) => {
  const source = path.join(projectRoot, 'skills', name);
  const target = path.join(skillsRoot, name);

  if (!(await exists(path.join(source, 'SKILL.md')))) {
    return { name, source, target, state: 'source-missing' };
  }

  let stat;
  try {
    stat = await lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { name, source, target, state: 'missing' };
    }
    throw error;
  }

  if (!stat.isSymbolicLink()) {
    return { name, source, target, state: 'conflict-existing' };
  }

  try {
    const [sourceReal, targetReal] = await Promise.all([
      realpath(source),
      realpath(target),
    ]);
    if (sourceReal === targetReal) {
      return { name, source, target, state: 'linked' };
    }
  } catch {
    // 断开的符号链接也属于冲突；安装器不会自动删除它。
  }

  return {
    name,
    source,
    target,
    state: 'conflict-symlink',
    linkValue: await readlink(target).catch(() => '无法读取'),
  };
};

const inspections = await Promise.all(skillNames.map(inspectTarget));
const blocking = inspections.filter(({ state }) =>
  ['source-missing', 'conflict-existing', 'conflict-symlink'].includes(state),
);

console.log(`项目根目录：${projectRoot}`);
console.log(`Codex Skill 目录：${skillsRoot}`);

for (const item of inspections) {
  const labels = {
    linked: '已正确链接，无需改动',
    missing: dryRun ? '缺失，正式执行时将创建' : '缺失，等待创建',
    'source-missing': '项目内源 Skill 不完整',
    'conflict-existing': '目标已存在且不是符号链接',
    'conflict-symlink': '目标链接指向其他位置',
  };
  console.log(`- ${item.name}：${labels[item.state]}`);
}

if (blocking.length > 0) {
  console.error('\n检测到同名 Skill 冲突。为保护现有配置，本次未做任何改动。');
  console.error('请先人工确认冲突来源；安装器不会覆盖、移动或删除已有内容。');
  process.exitCode = 2;
} else if (dryRun) {
  console.log('\n预检完成：未写入任何文件。');
} else {
  await mkdir(skillsRoot, { recursive: true });
  for (const item of inspections.filter(({ state }) => state === 'missing')) {
    await symlink(item.source, item.target, 'dir');
    console.log(`已创建：${item.target} -> ${item.source}`);
  }
  console.log('\n安装完成。已有正确链接保持不变。');
}
