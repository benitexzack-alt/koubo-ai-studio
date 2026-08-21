#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const formalWriteCommands = new Set(['formal', 'formal-audio', 'all']);
const contextRequiredCommands = new Set([
  'fingerprint',
  'preview',
  'risk-frames',
  'audio-preflight',
  'formal-audio',
  'prepare',
  'formal',
  'qa',
  'regression',
  'all',
]);

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

const resolveInside = (root, relativePath, label) => {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    fail(`${label}必须是非空相对路径。`);
  }
  if (path.isAbsolute(relativePath)) {
    fail(`${label}禁止使用绝对路径。`);
  }
  const resolved = path.resolve(root, relativePath);
  const rootPrefix = `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootPrefix)) {
    fail(`${label}逃逸受控目录：${relativePath}`);
  }
  return resolved;
};

const validateKnowledgeContext = () => {
  if (!contextRequiredCommands.has(command)) return;
  const binding = job.knowledgeContext;
  if (!binding || typeof binding !== 'object') {
    fail(`执行 ${command} 前必须绑定 knowledgeContext。`);
  }
  if (typeof binding.taskId !== 'string' || !binding.taskId.trim()) {
    fail('knowledgeContext.taskId 缺失。');
  }
  const personalKb = path.resolve(
    process.env.KOUBO_PERSONAL_KB?.trim() || path.join(projectRoot, '..', '个人知识库'),
  );
  const taskRoot = path.join(personalKb, '.opc-rag', 'tasks');
  const contextPath = resolveInside(taskRoot, binding.contextPath, 'knowledgeContext.contextPath');
  if (!existsSync(contextPath)) {
    fail(`任务上下文不存在：${binding.contextPath}`);
  }
  let context;
  try {
    context = JSON.parse(readFileSync(contextPath, 'utf8'));
  } catch (error) {
    fail(`任务上下文不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
  if (context.task?.id !== binding.taskId) {
    fail(`任务上下文ID不匹配：任务要求 ${binding.taskId}，实际 ${context.task?.id ?? '缺失'}。`);
  }
  if (context.task?.important !== true) {
    fail('生产任务上下文必须标记 important=true。');
  }
  if (path.resolve(context.project_route?.project_root ?? '') !== projectRoot) {
    fail('任务上下文绑定的主项目不是当前口播项目。');
  }
  const materialEntries = context.receipt_groups?.task_original_materials?.entries;
  const jobIsBound =
    Array.isArray(materialEntries) &&
    materialEntries.some((item) => path.resolve(item?.resolved_path ?? '') === jobPath);
  if (!jobIsBound) {
    fail('当前生产任务文件未进入 task_original_materials 读取与应用回执。');
  }

  const ragScript = path.join(
    personalKb,
    '04_Claude Code日常操作',
    'scripts',
    'opc_rag.py',
  );
  if (!existsSync(ragScript)) {
    fail(`个人知识库 RAG 复检脚本不存在：${ragScript}`);
  }
  const validation = spawnSync(
    process.env.PYTHON ?? 'python3',
    [ragScript, 'validate-context', '--context', contextPath],
    {cwd: personalKb, encoding: 'utf8'},
  );
  const validationOutput = `${validation.stdout ?? ''}${validation.stderr ?? ''}`.trim();
  if (validation.status !== 0) {
    fail(`任务上下文复检未通过：${validationOutput || `退出码 ${validation.status}`}`);
  }
  let result;
  try {
    result = JSON.parse(validation.stdout);
  } catch (error) {
    fail(`任务上下文复检未返回有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
  if (result.status !== 'context-valid' || result.gate?.formal_execution_allowed !== true) {
    fail(`任务上下文复检状态不是 context-valid：${result.status ?? '缺失'}`);
  }
};

validateKnowledgeContext();

if (formalWriteCommands.has(command) && job.formal?.enabled !== true) {
  const reason = job.formal?.blockedReason?.trim() || '尚未获得用户正式渲染批准。';
  fail(
    `formal.enabled 不是 true，禁止执行 ${command}。\n` +
      `当前原因：${reason}\n` +
      '只有用户确认同画面动态预览后，才能在任务文件中显式解锁。',
  );
}

console.log(`生产命令门禁通过：${command}`);
