import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOT, KB, hashFile, readJson} from '../runner-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const taskId = 'opc-task-20260908-lanzhou-candidate-preview-r2-context-v2';
const contextPath = path.join(KB, '.opc-rag/tasks', taskId, 'context.json');
const official = path.join(KB, '04_Claude Code日常操作/scripts/opc_rag.py');
const wrapper = path.resolve(here, '../runtime/knowledge-readonly.py');
const write = (name, value) => fs.writeFileSync(path.join(here, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const previousBinding = readJson(path.join(here, 'context-binding.v1.json'));
const diagnosis = readJson(path.join(here, 'index-stale-diagnosis.v2.json'));
const pins = [
  ...readJson(path.join(here, 'start-attempt.v1.json')).pins,
  [path.join(here, 'requirements.v1.json'), '26902caf95df8eef78721dac1848456ee0ce73988fcb93d07c6b903bc2240198'],
  [path.join(here, 'read-receipts.v1.json'), 'de5c51806047589f2014a72c92ed27b32290d6daa2b660af714ef2f83d6d90ad'],
  [previousBinding.contextPath, previousBinding.sha256],
];
for (const [file, sha] of pins) assert.equal(hashFile(file), sha, file);
assert.equal(fs.existsSync(path.dirname(contextPath)), false);
assert.equal(fs.existsSync(path.resolve(here, '../../../07_预览与质检/candidate-preview-r2/render')), false);
const old = readJson(path.join(here, 'read-receipts.v1.json'));
assert.equal(old.receipts.length, 24);
for (const receipt of old.receipts) {
  assert.equal(hashFile(receipt.path), receipt.sha256, receipt.path);
  assert(receipt.retrieved && receipt.read && receipt.applied && receipt.read_scope && receipt.application_note);
}
for (const changed of diagnosis.changedFiles) assert.equal(hashFile(changed.path), changed.sha256, '诊断后又有并发改写');
write('start-attempt.v2.json', {taskId, startedAt: new Date().toISOString(), previousBinding,
  cause: diagnosis.changedFiles, noExplicitIndexCommand: true, noAutomaticRetry: true});
write('requirements.v2.json', {...readJson(path.join(here, 'requirements.v1.json')), taskId});
write('read-receipts.v2.json', {...old, taskId, generatedAt: new Date().toISOString(),
  previousReceipt: {path: path.join(here, 'read-receipts.v1.json'), sha256: hashFile(path.join(here, 'read-receipts.v1.json'))},
  renewalNote: '24份任务输入SHA全部未变，继承v1真实读取时间、范围与应用；仅因知识库新增自动日结恢复索引代际，不重读历史或写知识正文。',
  receipts: old.receipts.map(r => ({...r, read_evidence: '仅在当前SHA与v1完全一致时继承原真实读取；本次不声称重新阅读全文。',
    renewal_source: {receipt: path.join(here, 'read-receipts.v1.json'), path: r.path, sha256: r.sha256}}))});

function run(label, args) {
  const startedAt = new Date().toISOString();
  const result = spawnSync('python3', args, {cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: {...process.env, PYTHONDONTWRITEBYTECODE: '1', KOUBO_ACCOUNT_PREFLIGHT_OUTPUT_ROOT: path.join(here, 'account-feedback-v2')}});
  for (const field of ['stdout', 'stderr']) fs.writeFileSync(path.join(here, `${label}.${field}.txt`), result[field] ?? '', {flag: 'wx'});
  write(`${label}.command.json`, {command: ['python3', ...args], startedAt, endedAt: new Date().toISOString(),
    exitCode: result.status, signal: result.signal, error: result.error?.message ?? null});
  let output;
  try {output = JSON.parse(result.stdout); write(`${label}.result.json`, output);} catch {}
  console.log(JSON.stringify({action: label, exitCode: result.status, status: output?.status}));
  assert.equal(result.status, 0, `官方出口非0，保留结果并停止: ${label}`);
  assert(output);
  return output;
}
const started = run('start.v2', [official, '--pretty', 'start', '--project', '口播', '--task',
  '20260906_lanzhou_ai_services R2低清context v2：仅因外部新增06_每日复盘/2026-09-08.md导致索引stale续绑。24份本条输入当前SHA未变，复用真实读取；62静帧已生成，等待新request的delta审核。不得重审历史、修改知识正文或工具；formal=false，原声、五段纸艺本条例外及13项ASR待核不变。',
  '--cwd', ROOT, '--task-id', taskId, '--important', '--requirements-file', path.join(here, 'requirements.v2.json'),
  '--receipt-file', path.join(here, 'read-receipts.v2.json')]);
assert.equal(started.status, 'context-ready');
const binding = {taskId, contextPath, sha256: hashFile(contextPath)};
const validation = run('validate-context.v2', [wrapper, '--context', contextPath, '--context-sha256', binding.sha256]);
assert.equal(validation.status, 'context-valid');
assert.equal(validation.gate.formal_execution_allowed, true);
assert.deepEqual(validation.problems, []);
const context = readJson(contextPath);
assert.equal(context.task.id, taskId);
assert.equal(context.task.important, true);
assert.equal(context.status, 'context-ready');
assert.equal(hashFile(contextPath), binding.sha256);
for (const [file, sha] of pins) assert.equal(hashFile(file), sha, file);
for (const receipt of old.receipts) assert.equal(hashFile(receipt.path), receipt.sha256, receipt.path);
for (const changed of diagnosis.changedFiles) assert.equal(hashFile(changed.path), changed.sha256, '恢复期间又有并发改写');
write('context-binding.v2.json', binding);
write('context-result.v2.json', {status: validation.status, binding, previousBinding, checkedAt: new Date().toISOString(),
  startExitCode: 0, validateExitCode: 0, validationResult: path.join(here, 'validate-context.v2.result.json'),
  validatorWrapper: {path: wrapper, sha256: hashFile(wrapper)}, reusedCount: 24, newTaskMaterialReadCount: 0,
  changedIndexSources: diagnosis.changedFiles, indexFreshness: context.index_freshness,
  v1Unchanged: true, toolsUnchanged: true, formalEnabled: false, productionEligible: false,
  publishAuthorized: false, independentReviewStatus: 'awaiting-parent-request-v2-delta'});
console.log(JSON.stringify({status: 'context-valid', binding, formalEnabled: false}, null, 2));
