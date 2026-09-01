#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';

import {
  KNOWLEDGE_CONTEXT_REQUIRED_COMMANDS_V2,
  validateKnowledgeContextForProductionV2,
} from './knowledge-context-production-gate.mjs';
import {computeProductionGateClosureV2} from '../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const testRoot = resolve(projectRoot, `work/.knowledge-context-production-gate-${process.pid}`);
const personalKbRoot = join(testRoot, 'personal-kb');
const tasksRoot = join(personalKbRoot, '.opc-rag/tasks');
const ragScript = join(
  personalKbRoot,
  '04_Claude Code日常操作/scripts/opc_rag.py',
);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const writeJson = (filePath, value) => {
  mkdirSync(dirname(filePath), {recursive: true});
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const expectCode = (code, fn) => assert.throws(fn, (error) => {
  assert.equal(error.code, code);
  return true;
});

mkdirSync(tasksRoot, {recursive: true});
mkdirSync(dirname(ragScript), {recursive: true});
writeFileSync(ragScript, '# test fixture\n', 'utf8');

try {
  const registry = JSON.parse(
    readFileSync(join(projectRoot, 'workflow/director-production-freeze-registry.v2.json'), 'utf8'),
  );
  for (const command of registry.supportedCommands) {
    assert.equal(
      KNOWLEDGE_CONTEXT_REQUIRED_COMMANDS_V2.has(command),
      command !== 'doctor',
      `生产命令知识上下文覆盖不完整：${command}`,
    );
  }

  const taskId = 'task-knowledge-gate-valid';
  const contextRelativePath = `${taskId}/context.json`;
  const jobPath = join(testRoot, 'job.json');
  const job = {
    schemaVersion: 1,
    jobId: 'knowledge-gate-job',
    knowledgeContext: {taskId, contextPath: contextRelativePath},
  };
  writeJson(jobPath, job);
  const jobSha256 = sha256(readFileSync(jobPath));
  const contextPath = join(tasksRoot, contextRelativePath);
  const validContext = {
    schema_version: 'opc-task-context/1.0',
    status: 'context-ready',
    task: {id: taskId, important: true},
    project_route: {project_root: projectRoot},
    receipt_groups: {
      task_original_materials: {
        status: 'complete',
        entries: [{
          resolved_path: jobPath,
          sha256: jobSha256,
          states: {indexed: false, retrieved: true, read: true, applied: true},
          application_note: '已读取当前生产任务，并据此绑定正式生产入口。',
        }],
      },
    },
    gate: {formal_execution_allowed: true},
  };
  writeJson(contextPath, validContext);

  let runnerCalls = 0;
  const validRunner = (binary, args, options) => {
    runnerCalls += 1;
    assert.equal(binary, 'python3');
    assert.deepEqual(args, [ragScript, 'validate-context', '--context', contextPath]);
    assert.equal(options.cwd, personalKbRoot);
    return {
      status: 0,
      stdout: JSON.stringify({
        status: 'context-valid',
        gate: {formal_execution_allowed: true},
      }),
      stderr: '',
    };
  };
  const valid = validateKnowledgeContextForProductionV2({
    projectRoot,
    personalKbRoot,
    jobPath,
    job,
    command: 'direct-remotion-render',
    runner: validRunner,
    pythonBinary: 'python3',
  });
  assert.equal(valid.required, true);
  assert.equal(valid.taskId, taskId);
  assert.equal(valid.contextSha256, sha256(readFileSync(contextPath)));
  assert.equal(valid.jobReceiptSha256, jobSha256);
  assert.equal(runnerCalls, 1);

  const doctor = validateKnowledgeContextForProductionV2({
    projectRoot,
    personalKbRoot,
    jobPath,
    job: {},
    command: 'doctor',
    runner: () => {
      throw new Error('doctor 不应调用 RAG 复检');
    },
  });
  assert.deepEqual(doctor, {required: false, command: 'doctor'});

  expectCode('KCPG2_CONTEXT_REQUIRED', () =>
    validateKnowledgeContextForProductionV2({
      projectRoot,
      personalKbRoot,
      jobPath,
      job: {},
      command: 'release-validation',
      runner: validRunner,
    }));

  const unreadContext = structuredClone(validContext);
  unreadContext.receipt_groups.task_original_materials.entries[0].states.read = false;
  writeJson(contextPath, unreadContext);
  expectCode('KCPG2_JOB_READ_RECEIPT_INCOMPLETE', () =>
    validateKnowledgeContextForProductionV2({
      projectRoot,
      personalKbRoot,
      jobPath,
      job,
      command: 'preview',
      runner: validRunner,
    }));

  writeJson(contextPath, validContext);
  expectCode('KCPG2_CONTEXT_VALIDATION_FAILED', () =>
    validateKnowledgeContextForProductionV2({
      projectRoot,
      personalKbRoot,
      jobPath,
      job,
      command: 'formal',
      runner: () => ({
        status: 1,
        stdout: JSON.stringify({
          status: 'blocked-context-stale',
          gate: {formal_execution_allowed: false},
        }),
        stderr: '',
      }),
    }));

  expectCode('KCPG2_CONTEXT_PATH_OUTSIDE', () =>
    validateKnowledgeContextForProductionV2({
      projectRoot,
      personalKbRoot,
      jobPath,
      job: {...job, knowledgeContext: {taskId, contextPath: '../escape.json'}},
      command: 'preview',
      runner: validRunner,
    }));

  const preflightSource = readFileSync(
    join(projectRoot, 'skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs'),
    'utf8',
  );
  assert.match(preflightSource, /validateKnowledgeContextForProductionV2\s*\(/u);
  assert.match(preflightSource, /tools\/knowledge-context-production-gate\.mjs/u);
  assert.ok(
    computeProductionGateClosureV2({projectRoot}).files.some(
      (item) => item.path === 'tools/knowledge-context-production-gate.mjs',
    ),
    '知识上下文校验器必须进入生产门禁哈希闭包',
  );

  console.log('任务级知识上下文统一生产门禁回归通过。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
