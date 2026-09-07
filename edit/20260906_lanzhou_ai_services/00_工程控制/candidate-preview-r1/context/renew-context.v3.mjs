import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hashFile, readJson, ROOT, KB} from '../runner-core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const taskId = 'opc-task-20260907-lanzhou-candidate-preview-r1-context-v3';
const contextPath = path.join(KB, '.opc-rag/tasks', taskId, 'context.json');
const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const previousBinding = readJson(path.join(root, 'context-binding.v2.json'));
assert.equal(hashFile(previousBinding.contextPath), previousBinding.sha256);
assert.equal(fs.existsSync(path.dirname(contextPath)), false);
const receipts = readJson(path.join(root, 'read-receipts.v2.json'));
const checkedAt = new Date().toISOString();
assert.equal(receipts.receipts.length, 22);
for (const e of receipts.receipts) {
  assert.equal(hashFile(e.path), e.sha256, `changed source: ${e.path}`);
  assert(e.retrieved && e.read && e.applied && e.read_scope && e.application_note);
}
write('read-receipts.v3.json', {...receipts, taskId, generatedAt: checkedAt,
  previousReceipt: {path: path.join(root, 'read-receipts.v2.json'), sha256: hashFile(path.join(root, 'read-receipts.v2.json'))},
  renewalNote: '22份材料当前SHA全部未变，沿用真实读取时间、范围及应用说明。本轮只因daily索引代际变化续绑，不重读静态资料、不写daily、不变更runner。'});
write('requirements.v3.json', {...readJson(path.join(root, 'requirements.v2.json')), taskId});

function run(action, tail) {
  const args = [path.join(KB, '04_Claude Code日常操作/scripts/opc_rag.py'), '--pretty', action, ...tail];
  const prefix = `${new Date().toISOString().replace(/[:.]/g, '-')}.${action}.v3`;
  const result = spawnSync('python3', args, {cwd: ROOT,
    env: {...process.env, PYTHONDONTWRITEBYTECODE: '1', KOUBO_ACCOUNT_PREFLIGHT_OUTPUT_ROOT: path.join(root, 'account-feedback-v3')},
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
  fs.writeFileSync(path.join(root, prefix + '.stdout.txt'), result.stdout ?? '', {flag: 'wx'});
  fs.writeFileSync(path.join(root, prefix + '.stderr.txt'), result.stderr ?? '', {flag: 'wx'});
  write(prefix + '.command.json', {command: ['python3', ...args], exitCode: result.status,
    endedAt: new Date().toISOString(), error: result.error?.message ?? null});
  let output;
  try { output = JSON.parse(result.stdout); write(prefix + '.result.json', output); } catch {}
  console.log(JSON.stringify({action, exitCode: result.status, status: output?.status, resultPath: path.join(root, prefix + '.result.json')}));
  assert.equal(result.status, 0, `official ${action} failed: ${prefix}`);
  return {output, resultPath: path.join(root, prefix + '.result.json')};
}
const started = run('start', ['--project', '口播', '--task',
  '20260906_lanzhou_ai_services 候选context v3：仅因跨项目daily导致索引过期续绑。复用22份SHA未变的真实读取应用回执；既有v4 runtime和28静帧不重审。仅本地全长有声低清候选，五段纸艺已接受缺陷、13项ASR仍待核、formal=false。等待request.v5绑定，不冒用导演原task或正式job。',
  '--cwd', ROOT, '--task-id', taskId, '--important', '--requirements-file', path.join(root, 'requirements.v3.json'),
  '--receipt-file', path.join(root, 'read-receipts.v3.json')]);
assert.equal(started.output.status, 'context-ready');
const validation = run('validate-context', ['--context', contextPath]);
assert.equal(validation.output.status, 'context-valid');
assert.equal(validation.output.gate.formal_execution_allowed, true);
const ctx = readJson(contextPath);
assert.equal(ctx.task.id, taskId);
assert.equal(ctx.task.important, true);
assert.equal(ctx.status, 'context-ready');
assert.equal(ctx.gate.formal_execution_allowed, true);
const entries = Object.values(ctx.receipt_groups).flatMap(g => g.entries);
for (const e of entries) {
  assert.equal(hashFile(e.resolved_path), e.sha256, e.path);
  for (const state of ['retrieved', 'read', 'applied']) assert.equal(e.states[state], true, e.path);
}
assert.equal(hashFile(previousBinding.contextPath), previousBinding.sha256);
const binding = {taskId, contextPath, sha256: hashFile(contextPath)};
write('context-binding.v3.json', binding);
write('context-renewal.v3.json', {checkedAt, endedAt: new Date().toISOString(), status: 'context-valid', binding, previousBinding,
  sourceChangeReportedByParent: ['06_每日复盘/2026-09-07.md'], distinctReceiptsReused: 22,
  entryCount: entries.length, allReceiptHashesUnchanged: true, startResult: started.resultPath,
  validationResult: validation.resultPath, staticReviewRepeated: false, dailyWritten: false, runnerChanged: false,
  formalEnabled: false, productionEligible: false, publishAuthorized: false, independentReviewStatus: 'awaiting-request-v5-context-delta'});
console.log(JSON.stringify({status: 'context-v3-bound', binding}, null, 2));
