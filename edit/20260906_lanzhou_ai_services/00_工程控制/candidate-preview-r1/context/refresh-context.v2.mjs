import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(root, '../../../../..');
const kb = '/Users/pc/Documents/个人知识库';
const cli = path.join(kb, '04_Claude Code日常操作/scripts/opc_rag.py');
const taskId = 'opc-task-20260907-lanzhou-candidate-preview-r1-context-v2';
const contextPath = path.join(kb, '.opc-rag/tasks', taskId, 'context.json');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const previousBindingPath = path.join(root, 'context-binding.v1.json');
const previousBinding = read(previousBindingPath);
const previousBindingSha256 = hash(previousBindingPath);
assert.equal(hash(previousBinding.contextPath), previousBinding.sha256, 'v1 context history changed');
assert.equal(fs.existsSync(path.dirname(contextPath)), false, 'v2 task already exists');

const oldReceiptPath = path.join(root, 'read-receipts.v1.json');
const receipt = read(oldReceiptPath);
const checkedAt = new Date().toISOString();
const checked = receipt.receipts.map(e => {
  const currentSha256 = hash(e.path);
  assert.equal(currentSha256, e.sha256, `changed receipt source: ${e.path}`);
  for (const state of ['retrieved', 'read', 'applied']) assert.equal(e[state], true, `${state}: ${e.path}`);
  assert(e.read_scope && e.application_note && e.read_completed_at);
  return {path: e.path, sha256: currentSha256, unchanged: true, originalReadAt: e.read_completed_at, readScope: e.read_scope};
});
write(path.join(root, 'receipt-revalidation.v2.json'), {
  schemaVersion: 'candidate-context-receipt-revalidation/v1', checkedAt,
  previousBinding, previousBindingSha256, previousReceiptSha256: hash(oldReceiptPath),
  changedExamples: ['06_每日复盘/2026-09-07.md'],
  indexCommandReceipt: path.join(root, '2026-09-07T15-28-43-163Z.index.command.json'),
  mode: 'reuse-actual-read-scope-after-current-sha-verification', checked,
  newFullReadClaim: false, dailyWritePerformed: false, formalEnabled: false,
});
write(path.join(root, 'read-receipts.v2.json'), {
  ...receipt, taskId, generatedAt: checkedAt,
  previousReceipt: {path: oldReceiptPath, sha256: hash(oldReceiptPath)},
  renewalNote: '原有材料当前SHA全部未变，保留实际读取时间、范围及应用说明；此次仅复核文件身份，不宣称重新全文读取或原速听验。',
});
write(path.join(root, 'requirements.v2.json'), {...read(path.join(root, 'requirements.v1.json')), taskId});

function run(action, tail) {
  const args = [cli, '--pretty', action, ...tail];
  const prefix = path.join(root, `${new Date().toISOString().replace(/[:.]/g, '-')}.${action}.v2`);
  const result = spawnSync('python3', args, {
    cwd: project,
    env: {...process.env, PYTHONDONTWRITEBYTECODE: '1', KOUBO_ACCOUNT_PREFLIGHT_OUTPUT_ROOT: path.join(root, 'account-feedback-v2')},
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  fs.writeFileSync(prefix + '.stdout.txt', result.stdout ?? '', {flag: 'wx'});
  fs.writeFileSync(prefix + '.stderr.txt', result.stderr ?? '', {flag: 'wx'});
  write(prefix + '.command.json', {
    schemaVersion: 'candidate-context-cli-command/v1', endedAt: new Date().toISOString(),
    command: ['python3', ...args], exitCode: result.status, signal: result.signal,
    error: result.error?.message ?? null, stdout: prefix + '.stdout.txt', stderr: prefix + '.stderr.txt',
  });
  let output;
  try { output = JSON.parse(result.stdout); write(prefix + '.result.json', output); } catch {}
  console.log(JSON.stringify({action, exitCode: result.status, status: output?.status, gate: output?.gate, commandReceipt: prefix + '.command.json'}));
  assert.equal(result.status, 0, `official ${action} failed; see ${prefix}`);
  assert(output, `official ${action} returned no JSON`);
  return {output, path: prefix + '.result.json'};
}

const started = run('start', [
  '--project', '口播', '--task',
  '20260906_lanzhou_ai_services 候选知识上下文v2：仅因每日复盘索引更新而续绑既有真实读取回执；本地全长有声低清小样，五段既有纸艺缺陷已接受、不重生不增费、13项ASR仍待核，formal=false；等待request.v3与独立代码闭包复核，不冒用导演原task或正式job。',
  '--cwd', project, '--task-id', taskId, '--important',
  '--requirements-file', path.join(root, 'requirements.v2.json'),
  '--receipt-file', path.join(root, 'read-receipts.v2.json'),
]);
assert.equal(started.output.status, 'context-ready');
const validated = run('validate-context', ['--context', contextPath]);
assert.equal(validated.output.status, 'context-valid');
assert.equal(validated.output.gate.formal_execution_allowed, true);
const ctx = read(contextPath);
assert.equal(ctx.task.id, taskId);
assert.equal(ctx.task.important, true);
assert.equal(ctx.status, 'context-ready');
assert.equal(ctx.gate.formal_execution_allowed, true);
assert.notEqual(taskId, 'task-20260906T154937Z-69f6ebf8');
const entries = Object.values(ctx.receipt_groups).flatMap(g => g.entries);
for (const e of entries) {
  assert.equal(hash(e.resolved_path), e.sha256, e.path);
  for (const state of ['retrieved', 'read', 'applied']) assert.equal(e.states[state], true, e.path);
}
const materials = ctx.receipt_groups.task_original_materials.entries;
for (const p of [
  'remotion/src/lanzhou-services-v91-candidate-r1/index.tsx',
  'remotion/src/lanzhou-services-v91-candidate-r1/visual-plan.v1.json',
  'edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r1/data.v1.json',
]) assert(materials.some(e => e.resolved_path === path.join(project, p)), p);
const permission = read(path.join(root, '../permission.v1.json'));
for (const key of ['formalEnabled', 'productionEligible', 'publishAuthorized', 'userPreviewApproved']) assert.equal(permission[key], false, key);
assert.equal(hash(previousBindingPath), previousBindingSha256, 'v1 binding changed');
assert.equal(hash(previousBinding.contextPath), previousBinding.sha256, 'v1 context changed');
const binding = {taskId, contextPath, sha256: hash(contextPath)};
write(path.join(root, 'context-binding.v2.json'), binding);
write(path.join(root, 'context-integrity.v2.json'), {
  schemaVersion: 'candidate-context-integrity/v1', checkedAt: new Date().toISOString(),
  status: 'verified-knowledge-context-only', binding, previousBinding,
  startResult: started.path, validationResult: validated.path,
  important: true, entryCount: entries.length, distinctReceiptCount: checked.length,
  allCurrentInputHashesMatch: true, coreEntryAndImportJsonPresent: true,
  formalEnabled: false, productionEligible: false, publishAuthorized: false,
  userPreviewApproved: false, allow: false, codeReviewStatus: 'awaiting-request-v3-binding',
  readScopeReceipt: path.join(root, 'read-receipts.v2.json'),
  scopeDecision: path.join(root, 'scope-decision.v1.json'),
  boundary: '仅知识检索技术门就绪，尚未针对request.v3独立复核，不授权formal渲染，不宣称ASR或源片语义已通过。',
});
console.log(JSON.stringify({status: 'context-v2-bound', binding, entryCount: entries.length}, null, 2));
