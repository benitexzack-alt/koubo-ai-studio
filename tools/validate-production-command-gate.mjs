#!/usr/bin/env node

import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const formalWriteCommands = new Set(['formal', 'formal-audio', 'all']);

const fail = (message) => {
  console.error(`生产命令门禁失败：${message}`);
  process.exit(1);
};

const [jobArgument, command] = process.argv.slice(2);
if (!jobArgument || !command) {
  fail('用法：node tools/validate-production-command-gate.mjs <production-job.json> <command>');
}

const jobPath = path.resolve(projectRoot, jobArgument);
const rootPrefix = `${projectRoot}${path.sep}`;
if (jobPath !== projectRoot && !jobPath.startsWith(rootPrefix)) {
  fail(`任务文件逃逸项目目录：${jobArgument}`);
}
if (!existsSync(jobPath)) {
  fail(`任务文件不存在：${jobArgument}`);
}

let job;
try {
  job = JSON.parse(readFileSync(jobPath, 'utf8'));
} catch (error) {
  fail(`任务文件不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
}

if (formalWriteCommands.has(command) && job.formal?.enabled !== true) {
  const reason = job.formal?.blockedReason?.trim() || '尚未获得用户正式渲染批准。';
  fail(
    `formal.enabled 不是 true，禁止执行 ${command}。\n` +
      `当前原因：${reason}\n` +
      '只有用户确认同画面动态预览后，才能在任务文件中显式解锁。',
  );
}

console.log(`生产命令门禁通过：${command}`);
