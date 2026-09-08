import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// R1 renew-context.v3 flow, restricted to one official start and one readonly validation.
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../../../..');
const KB = path.join(path.dirname(ROOT), '个人知识库');
const control = path.dirname(here);
const prior = path.resolve(control, '../candidate-preview-r1/context');
const taskId = 'opc-task-20260908-lanzhou-candidate-preview-r2-context-v1';
const contextPath = path.join(KB, '.opc-rag/tasks', taskId, 'context.json');
const source = path.join(ROOT, 'remotion/src/lanzhou-services-v91-candidate-r2');
const director = path.join(ROOT, 'edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r2');
const absolute = name => path.resolve(ROOT, name);
const hash = name => crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex');
const read = name => JSON.parse(fs.readFileSync(name, 'utf8'));
const write = (name, data) => fs.writeFileSync(path.join(here, name), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
const wrapper = path.join(control, 'runtime/knowledge-readonly.py');
const official = path.join(KB, '04_Claude Code日常操作/scripts/opc_rag.py');
const pins = [
  [path.join(prior, 'requirements.v3.json'), '041c29d19dd415dfdfd2b6b9465729f9c6f9e321a0ed09d220b45a2bf3b08a0f'],
  [path.join(prior, 'read-receipts.v3.json'), '08882cb05e95427f29aba54f15cd8f81e62c51e7fbd94ca864638df27ec4e91e'],
  [path.join(prior, 'renew-context.v3.mjs'), '05edb2138c16cdca76ef6c1a14bb82dd89a33d92964a181c84a91bf7d84cc113'],
  [wrapper, 'ada2954b863b5fd0e68b6780ead581c5e837147825e95cfe55c30456e499a115'],
  [official, 'f1cd0dc75c7b19f67e2354f77697f698f5f49fee9d84a2424c5587aa8eb28987'],
  [path.join(path.dirname(official), 'opc_rag_config.json'), 'e1b15782e0541e9656ddac9fe2c2a9bcbb9b0cc35b5a648bdd73f20da87c9a19'],
];
const mode = process.argv[2];
assert(['--prepare', '--check', '--start-after-freeze'].includes(mode), '仅允许准备、只读检查或冻结后启动');
assert.equal(process.argv.length, 3);
for (const [name, sha] of pins) assert.equal(hash(name), sha, `复用基础发生变化: ${name}`);
const previous = read(path.join(prior, 'context-binding.v3.json'));
assert.equal(hash(previous.contextPath), previous.sha256, 'R1历史context变化');
const requirements = {...read(path.join(prior, 'requirements.v3.json')), taskId};
const groups = requirements.required_receipt_groups;
groups.latest_update = [path.join(control, 'permission.v1.json')];
groups.task_original_materials = [
  ...groups.latest_update,
  ...['index.tsx', 'LanzhouServicesCandidate.tsx', 'ShotcraftEffects.generated.tsx', 'tsconfig.json', 'visual-plan.v1.json'].map(n => path.join(source, n)),
  absolute('edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r1/data.v1.json'),
  ...['output-selection.derived.v2.json', 'evidence-layout-plan.v1.json'].map(n => path.join(director, n)),
  path.join(control, 'sfx-plan.v1.json'), path.join(control, 'public-assets.v1.json'),
];
const old = read(path.join(prior, 'read-receipts.v3.json'));
const fresh = read(path.join(here, 'read-observations.v1.json')).observations;
const receipts = [];
const pending = [];
for (const name of [...new Set(Object.values(groups).flat())]) {
  if (!fs.existsSync(name)) {pending.push({path: name, reason: '尚未生成'}); continue;}
  const sha256 = hash(name);
  const observation = [...fresh].reverse().find(e => absolute(e.path) === name && e.sha256 === sha256);
  if (observation) {
    assert(observation.read_scope && observation.application_note && Number.isFinite(Date.parse(observation.read_completed_at)));
    receipts.push({...observation, path: name, read_status: 'read', retrieval_source: 'explicit-local-incremental-read',
      retrieved: true, read: true, applied: true, application_status: 'applied',
      read_evidence: '本续接worker实际工具输出读取；只声明read_scope所列范围，非全文监听或动态验收。'});
    continue;
  }
  const priorPath = ['ShotcraftEffects.generated.tsx', 'tsconfig.json'].includes(path.basename(name))
    ? name.replace('lanzhou-services-v91-candidate-r2/', 'lanzhou-services-v91-candidate-r1/') : name;
  const inherited = old.receipts.find(e => e.path === priorPath && e.sha256 === sha256 && hash(e.path) === sha256);
  if (!inherited) {pending.push({path: name, sha256, reason: '新增或变化输入尚无匹配SHA的实际读取'}); continue;}
  assert(inherited.retrieved && inherited.read && inherited.applied && inherited.read_scope && inherited.application_note);
  receipts.push({...inherited, path: name, retrieval_source: 'sha-unchanged-prior-read-reuse',
    read_evidence: '沿用R1 v3回执的真实读取时间与范围；本轮仅核对SHA，未声称重新阅读全文。',
    reused_from: {receipt: path.join(prior, 'read-receipts.v3.json'), path: inherited.path, sha256},
    application_note: inherited.application_note + ' 本轮只在相同字节下继承该应用边界，R2输入及权限另行绑定。'});
}
const preparation = {taskId, status: pending.length ? 'awaiting-frozen-input-reads' : 'reads-ready-awaiting-freeze',
  checkedAt: new Date().toISOString(), requiredFiles: [...new Set(Object.values(groups).flat())],
  reused: receipts.filter(r => r.reused_from).map(r => ({path: r.path, sha256: r.sha256, read_completed_at: r.read_completed_at})),
  incremental: receipts.filter(r => !r.reused_from).map(r => ({path: r.path, sha256: r.sha256, read_completed_at: r.read_completed_at})),
  pending, officialStartPerformed: false, validationPerformed: false, contextBinding: null,
  formalEnabled: false, productionEligible: false, publishAuthorized: false};
if (mode !== '--start-after-freeze') {
  if (mode === '--prepare') {
    write('requirements.prepared.v1.json', requirements);
    write('preparation.v1.json', preparation);
  }
  console.log(JSON.stringify(preparation, null, 2));
} else {
  const frozen = read(path.join(here, 'input-freeze.v1.json'));
  assert.equal(frozen.parentConfirmedFrozen, true, '必须收到父任务明确冻结通知');
  assert.equal(frozen.compileAndTestsPassed, true);
  assert.equal(frozen.formalEnabled, false);
  assert(frozen.evidence?.trim() && Number.isFinite(Date.parse(frozen.receivedAt)));
  assert.equal(pending.length, 0, JSON.stringify(pending));
  assert.equal(fs.existsSync(path.dirname(contextPath)), false, '不覆盖历史context，不自动重试');
  const permission = read(path.join(control, 'permission.v1.json'));
  assert.equal(permission.scope.publicDir, 'remotion/public/lanzhou-services-candidate-r2');
  for (const field of ['formalEnabled', 'productionEligible', 'publishAuthorized', 'userPreviewApproved']) assert.equal(permission[field], false);
  const sfx = read(path.join(control, 'sfx-plan.v1.json'));
  assert.deepEqual(sfx.sourceAudioGains, {host: 1, news: 0.62, paper: 0.1});
  assert.equal(sfx.cues.length, 26);
  assert(sfx.cues.every(cue => cue.gain >= 0.26 && cue.gain <= 0.36));
  const publicAssets = read(path.join(control, 'public-assets.v1.json'));
  assert.equal(publicAssets.bindings.length, 22);
  assert.equal(publicAssets.publicDir, permission.scope.publicDir);
  write('start-attempt.v1.json', {taskId, startedAt: new Date().toISOString(), frozen, pins, noExplicitIndexCommand: true});
  write('requirements.v1.json', requirements);
  write('read-receipts.v1.json', {schemaVersion: old.schemaVersion, taskId, generatedAt: new Date().toISOString(), receipts,
    previousReceipt: {path: path.join(prior, 'read-receipts.v3.json'), sha256: hash(path.join(prior, 'read-receipts.v3.json'))}});
  function run(label, args) {
    const startedAt = new Date().toISOString();
    const result = spawnSync('python3', args, {cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
      env: {...process.env, PYTHONDONTWRITEBYTECODE: '1', KOUBO_ACCOUNT_PREFLIGHT_OUTPUT_ROOT: path.join(here, 'account-feedback-v1')}});
    for (const field of ['stdout', 'stderr']) fs.writeFileSync(path.join(here, `${label}.${field}.txt`), result[field] ?? '', {flag: 'wx'});
    write(`${label}.command.json`, {command: ['python3', ...args], startedAt, endedAt: new Date().toISOString(),
      exitCode: result.status, signal: result.signal, error: result.error?.message ?? null});
    let output;
    try {output = JSON.parse(result.stdout); write(`${label}.result.json`, output);} catch {}
    console.log(JSON.stringify({action: label, exitCode: result.status, status: output?.status}));
    assert.equal(result.status, 0, `真实出口非0，保留证据并停止: ${label}`);
    assert(output, `未得到官方JSON: ${label}`);
    return output;
  }
  const start = run('start.v1', [official, '--pretty', 'start', '--project', '口播', '--task',
    '20260906_lanzhou_ai_services R2低清候选：只修R1官方文件/左上文字大小及音效。R1未变SHA读取复用，R2增量实读；完整实录保留，五段纸艺本条例外及13项ASR待核不变。formal=false，不渲染、不发布、不写日结；等待父request独立复核。',
    '--cwd', ROOT, '--task-id', taskId, '--important', '--requirements-file', path.join(here, 'requirements.v1.json'),
    '--receipt-file', path.join(here, 'read-receipts.v1.json')]);
  assert.equal(start.status, 'context-ready');
  const binding = {taskId, contextPath, sha256: hash(contextPath)};
  const validation = run('validate-context.v1', [wrapper, '--context', contextPath, '--context-sha256', binding.sha256]);
  assert.equal(validation.status, 'context-valid');
  assert.equal(validation.gate.formal_execution_allowed, true);
  const context = read(contextPath);
  assert.equal(context.task.id, taskId);
  assert.equal(context.task.important, true);
  assert.equal(context.status, 'context-ready');
  assert.equal(hash(contextPath), binding.sha256);
  for (const receipt of receipts) assert.equal(hash(receipt.path), receipt.sha256, `启动期间输入变化: ${receipt.path}`);
  for (const [name, sha] of pins) assert.equal(hash(name), sha);
  assert.equal(hash(previous.contextPath), previous.sha256);
  write('context-binding.v1.json', binding);
  write('context-result.v1.json', {status: validation.status, binding, startExitCode: 0, validateExitCode: 0,
    validationResult: path.join(here, 'validate-context.v1.result.json'), validatorWrapper: {path: wrapper, sha256: hash(wrapper)},
    reusedCount: preparation.reused.length, incrementalCount: preparation.incremental.length,
    officialGateAllowsExecution: true, formalEnabled: false, productionEligible: false, publishAuthorized: false,
    independentReviewStatus: 'awaiting-parent-request-snapshot', indexFreshness: context.index_freshness});
  console.log(JSON.stringify({status: 'context-valid', binding, formalEnabled: false}, null, 2));
}
