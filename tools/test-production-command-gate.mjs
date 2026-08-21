#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const testRootRelative = `work/.production-command-gate-test-${process.pid}`;
const testRoot = path.join(projectRoot, testRootRelative);
const validator = 'tools/validate-production-command-gate.mjs';
const personalKb = path.join(testRoot, '个人知识库');
const taskRoot = path.join(personalKb, '.opc-rag', 'tasks');
const ragScript = path.join(
  personalKb,
  '04_Claude Code日常操作',
  'scripts',
  'opc_rag.py',
);

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
    env: {...process.env, KOUBO_PERSONAL_KB: personalKb},
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

const writeContext = (name, jobPath, overrides = {}) => {
  const taskId = `task-${name}`;
  const relativePath = `${name}/context.json`;
  const contextPath = path.join(taskRoot, relativePath);
  mkdirSync(path.dirname(contextPath), {recursive: true});
  writeFileSync(
    contextPath,
    `${JSON.stringify(
      {
        schema_version: 'opc-task-context/1.0',
        status: 'context-ready',
        task: {id: taskId, important: true},
        project_route: {project_root: projectRoot},
        receipt_groups: {
          task_original_materials: {
            status: 'complete',
            entries: [{resolved_path: path.join(projectRoot, jobPath)}],
          },
        },
        gate: {formal_execution_allowed: true},
        ...overrides,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return {taskId, contextPath: relativePath};
};

mkdirSync(testRoot, {recursive: true});
try {
  mkdirSync(path.dirname(ragScript), {recursive: true});
  writeFileSync(
    ragScript,
    [
      'import json, pathlib, sys',
      "context_path = pathlib.Path(sys.argv[sys.argv.index('--context') + 1])",
      "context = json.loads(context_path.read_text(encoding='utf-8'))",
      "blocked = context.get('forceBlocked') is True",
      "result = {'status': 'blocked-context-stale' if blocked else 'context-valid', 'gate': {'formal_execution_allowed': not blocked}}",
      'print(json.dumps(result, ensure_ascii=False))',
      'raise SystemExit(1 if blocked else 0)',
      '',
    ].join('\n'),
    'utf8',
  );

  const missingContext = writeJob('missing-context', {formal: {enabled: false}});
  assertFailsWith(
    '缺少上下文时预览',
    run(missingContext, 'preview'),
    '必须绑定 knowledgeContext',
  );
  assertPasses('缺少上下文时只读体检', run(missingContext, 'doctor'));

  const locked = writeJob('locked', {
    formal: {enabled: false, blockedReason: '等待用户确认预览。'},
  });
  const lockedContext = writeContext('locked', locked);
  const lockedPayload = JSON.parse(
    readFileSync(path.join(projectRoot, locked), 'utf8'),
  );
  lockedPayload.knowledgeContext = lockedContext;
  writeFileSync(
    path.join(projectRoot, locked),
    `${JSON.stringify(lockedPayload, null, 2)}\n`,
    'utf8',
  );
  assertFailsWith('锁定时正式渲染', run(locked, 'formal'), '禁止执行 formal');
  assertFailsWith('锁定时正式音频处理', run(locked, 'formal-audio'), '禁止执行 formal-audio');
  assertFailsWith('锁定时全流程', run(locked, 'all'), '禁止执行 all');
  assertPasses('锁定时预览', run(locked, 'preview'));

  const unlocked = writeJob('unlocked', {formal: {enabled: true}});
  const unlockedContext = writeContext('unlocked', unlocked);
  const unlockedPayload = JSON.parse(
    readFileSync(path.join(projectRoot, unlocked), 'utf8'),
  );
  unlockedPayload.knowledgeContext = unlockedContext;
  writeFileSync(
    path.join(projectRoot, unlocked),
    `${JSON.stringify(unlockedPayload, null, 2)}\n`,
    'utf8',
  );
  assertPasses('明确解锁后正式渲染', run(unlocked, 'formal'));

  const stale = writeJob('stale', {formal: {enabled: true}});
  const staleContext = writeContext('stale', stale, {forceBlocked: true});
  const stalePayload = JSON.parse(readFileSync(path.join(projectRoot, stale), 'utf8'));
  stalePayload.knowledgeContext = staleContext;
  writeFileSync(
    path.join(projectRoot, stale),
    `${JSON.stringify(stalePayload, null, 2)}\n`,
    'utf8',
  );
  assertFailsWith('过期上下文正式渲染', run(stale, 'formal'), 'blocked-context-stale');

  console.log('生产命令门禁回归通过：8/8。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
