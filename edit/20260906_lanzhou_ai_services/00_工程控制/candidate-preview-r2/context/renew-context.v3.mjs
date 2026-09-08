import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOT, KB, hashFile, readJson} from '../runner-core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const taskId = 'opc-task-20260908-lanzhou-candidate-preview-r2-context-v3';
const contextPath = path.join(KB, '.opc-rag/tasks', taskId, 'context.json');
const official = path.join(KB, '04_Claude Code日常操作/scripts/opc_rag.py');
const wrapper = path.resolve(here, '../runtime/knowledge-readonly.py');
const daily = path.join(KB, '06_每日复盘/2026-09-08.md');
const dailySha256 = '31210731bd3185c64d059152dabfbd698f3b2efdfd35efcb32eab9db7ff6a45b';
const statePath = '/Users/pc/.codex/automations/automation-4/state.json';
const write = (name, value) => fs.writeFileSync(path.join(here, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const previousBinding = readJson(path.join(here, 'context-binding.v2.json'));
const old = readJson(path.join(here, 'read-receipts.v2.json'));
const pins = [...readJson(path.join(here, 'start-attempt.v1.json')).pins,
  [path.join(here, 'read-receipts.v2.json'), '91eeb98b5d644f9f28d03b1d1474bff1dfed0bae7908708352d23cb7147d4fbe'],
  [path.join(here, 'requirements.v2.json'), '0da1c3eaa05a0fba29b351cc89cee71806726e4fd548fa71ded1d3632421ebb8'],
  [previousBinding.contextPath, previousBinding.sha256],
  [path.resolve(here, '../independent-review.v2.json'), '4f7f2a1f3a9bd8b631fffda3a731039dab5a1eb9f81b989698a3ef3fe081df62']];
const checkWindow = () => {
  const policy = readJson(statePath).dailyBookkeepingPolicy;
  assert.equal(policy.status, 'deferred-during-active-production-context');
  assert.equal(policy.skipDailyScan, true);
  assert.equal(policy.skipDailyAppend, true);
  assert.equal(policy.affectedRound, 'candidate-preview-r2');
  assert.equal(hashFile(daily), dailySha256, '稳定窗口内日结变化');
  return policy;
};
const policy = checkWindow();
for (const [file, sha] of pins) assert.equal(hashFile(file), sha, file);
assert(!fs.existsSync(path.dirname(contextPath)));
assert(!fs.existsSync(path.resolve(here, '../../../07_预览与质检/candidate-preview-r2/render')));
assert.equal(old.receipts.length, 24);
for (const r of old.receipts) {
  assert.equal(hashFile(r.path), r.sha256, r.path);
  assert(r.read_completed_at && r.read_scope && r.application_note && r.retrieved && r.read && r.applied);
}
write('start-attempt.v3.json', {taskId, startedAt: new Date().toISOString(), previousBinding, pins,
  stabilityWindow: {statePath, stateSha256: hashFile(statePath), dailyBookkeepingPolicy: policy,
    supervisorTaskId: '01a077b6-b740-7130-91a2-395b384af69a', attributionSource: '本轮用户提供监督确认，两次日结写入均其所为'},
  changedSource: {path: daily, sha256: dailySha256}, noExplicitIndexCommand: true, noAutomaticRetry: true});
write('requirements.v3.json', {...readJson(path.join(here, 'requirements.v2.json')), taskId});
write('read-receipts.v3.json', {...old, taskId, generatedAt: new Date().toISOString(),
  previousReceipt: {path: path.join(here, 'read-receipts.v2.json'), sha256: hashFile(path.join(here, 'read-receipts.v2.json'))},
  renewalNote: '并发写入已由监督暂停；24份任务输入SHA未变，继承原实际读取时间、范围和应用，不声称重新阅读全文。不重审代码、静帧或历史研究。'});
function run(label, args) {
  const startedAt = new Date().toISOString();
  const r = spawnSync('python3', args, {cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: {...process.env, PYTHONDONTWRITEBYTECODE: '1', KOUBO_ACCOUNT_PREFLIGHT_OUTPUT_ROOT: path.join(here, 'account-feedback-v3')}});
  for (const key of ['stdout', 'stderr']) fs.writeFileSync(path.join(here, `${label}.${key}.txt`), r[key] ?? '', {flag: 'wx'});
  write(`${label}.command.json`, {command: ['python3', ...args], startedAt, endedAt: new Date().toISOString(), exitCode: r.status, signal: r.signal, error: r.error?.message ?? null});
  let output;
  try {output = JSON.parse(r.stdout); write(`${label}.result.json`, output);} catch {}
  console.log(JSON.stringify({action: label, exitCode: r.status, status: output?.status}));
  assert.equal(r.status, 0, `失败即停止，不重跑：${label}`);
  assert(output);
  return output;
}
const started = run('start.v3', [official, '--pretty', 'start', '--project', '口播', '--task',
  '20260906_lanzhou_ai_services R2低清context v3续绑：监督已暂停日结写入，基于稳定窗口仅恢复索引和上下文。24项SHA未变继承原真实读取；代码、62静帧、26声卡已审，只做request代际delta。formal=false；13ASR疑点与5段本条源片例外不变，不写日结、不改工具或知识正文、不渲染。',
  '--cwd', ROOT, '--task-id', taskId, '--important', '--requirements-file', path.join(here, 'requirements.v3.json'), '--receipt-file', path.join(here, 'read-receipts.v3.json')]);
assert.equal(started.status, 'context-ready');
const binding = {taskId, contextPath, sha256: hashFile(contextPath)};
const validation = run('validate-context.v3', [wrapper, '--context', contextPath, '--context-sha256', binding.sha256]);
assert.equal(validation.status, 'context-valid');
assert.equal(validation.gate.formal_execution_allowed, true);
assert.deepEqual(validation.problems, []);
for (const [file, sha] of pins) assert.equal(hashFile(file), sha, file);
for (const r of old.receipts) assert.equal(hashFile(r.path), r.sha256, r.path);
checkWindow();
assert.equal(hashFile(contextPath), binding.sha256);
write('context-binding.v3.json', binding);
write('context-result.v3.json', {status: validation.status, checkedAt: new Date().toISOString(), binding, previousBinding,
  startExitCode: 0, validateExitCode: 0, problems: [], indexFreshness: readJson(contextPath).index_freshness,
  reusedCount: 24, newTaskMaterialReadCount: 0, stabilityWindowConfirmed: true, priorVersionsUnchanged: true,
  validatorWrapper: {path: wrapper, sha256: hashFile(wrapper)}, formalEnabled: false, productionEligible: false, publishAuthorized: false});
console.log(JSON.stringify({status: validation.status, binding, formalEnabled: false}));
