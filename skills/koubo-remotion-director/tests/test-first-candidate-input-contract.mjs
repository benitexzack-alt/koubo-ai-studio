#!/usr/bin/env node
// Synthetic orchestration tests: no video, real authorization, render, or installed key.
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {SourceTextModule, SyntheticModule} from 'node:vm';
import * as directorCore from '../scripts/director-contract-v2-core.mjs';
import * as preCore from '../scripts/preproduction-director-core.mjs';
import * as postCore from '../scripts/postshoot-rebind-core.mjs';
import * as intakeCore from '../scripts/paper-asset-intake-core.mjs';
import * as knowledgeCore from '../../../tools/knowledge-context-production-gate.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'synthetic-first-candidate-')));
const scriptDir = 'skills/koubo-remotion-director/scripts';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (path) => sha(readFileSync(resolve(root, path)));
const put = (path, value) => {
  const absolute = resolve(root, path);
  mkdirSync(dirname(absolute), {recursive: true});
  writeFileSync(absolute, typeof value === 'string' || Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`);
  return {path, sha256: hashFile(path)};
};
const loadJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const stable = directorCore.stableJsonSha256;
const testState = {failedStage: null, calls: [], anchors: new Map(), independent: true};
const syntheticResult = (stage) => {
  testState.calls.push(stage);
  return {ok: testState.failedStage !== stage, errors: ['synthetic-stage-failure'], assetSetSha256: sha('synthetic-assets')};
};
let expectedPre;
let expectedRoute;
let expectedPost;
let expectedIntake;
// Domain validators belong to parallel work. These doubles test their mandatory use,
// binding, denial propagation and deterministic output comparisons, not media quality.
const mocks = new Map([
  [`${scriptDir}/preproduction-director-core.mjs`, {...preCore,
    validatePreproductionRequest: () => syntheticResult('preproduction'),
    validatePromptHandoffManifests: () => syntheticResult('prompts'),
    compilePreproductionPlan: () => expectedPre,
    buildRouteLock: () => expectedRoute,
  }],
  [`${scriptDir}/postshoot-rebind-core.mjs`, {...postCore,
    validatePostshootRebindRequest: () => syntheticResult('postshoot'),
    compilePostshootRebindPlan: () => expectedPost,
  }],
  [`${scriptDir}/paper-asset-intake-core.mjs`, {...intakeCore,
    validatePaperAssetIntake: (args) => {
      assert.equal(args.requireContactSheet, true);
      return {...expectedIntake, ...syntheticResult('intake')};
    },
  }],
  ['tools/director-production-binding-core.mjs', {
    assertDirectorProductionBinding: (args) => {
      assert.equal(args.skipSkillLock, undefined);
      testState.calls.push('director-binding-with-lock');
      if (testState.failedStage === 'lock') throw Object.assign(new Error('synthetic lock drift'), {code: 'DIRECTOR_SKILL_LOCK_PACKAGE_SHA_MISMATCH'});
      return {ok: true, status: 'candidate-entry-director-bound'};
    },
  }],
  ['tools/knowledge-context-production-gate.mjs', {...knowledgeCore,
    validateKnowledgeContextForProductionV2: (args) => {
      testState.calls.push('knowledge');
      return knowledgeCore.validateKnowledgeContextForProductionV2({...args,
        personalKbRoot: resolve(root, 'synthetic-context-store'),
        runner: () => ({status: 0, stdout: JSON.stringify({status: 'context-valid', gate: {formal_execution_allowed: true}})}),
      });
    },
  }],
  [`${scriptDir}/director-contract-v2-core.mjs`, {...directorCore,
    validateDirectorExternalMessageAnchorV2: (receipt, kind) => {
      const anchor = testState.anchors.get(`${kind}:${receipt.sourceMessageId}`);
      if (!testState.independent || !anchor) return {ok: false, reason: 'synthetic: no independent anchor'};
      return directorCore.verifyDirectorExternalAnchorEntryV2({receipt, kind, ...anchor});
    },
  }],
]);
const modules = new Map();
async function moduleFor(relativePath) {
  if (modules.has(relativePath)) return modules.get(relativePath);
  let mod;
  if (relativePath === `${scriptDir}/director-production-preflight-v2.mjs` || relativePath === `${scriptDir}/first-candidate-input-contract.mjs`) {
    const source = readFileSync(resolve(repo, relativePath), 'utf8');
    put(relativePath, source);
    mod = new SourceTextModule(source, {
      identifier: resolve(root, relativePath),
      initializeImportMeta(meta) { meta.url = pathToFileURL(resolve(root, relativePath)).href; },
    });
  } else {
    const ns = mocks.get(relativePath) ?? await import(relativePath.startsWith('node:') ? relativePath : pathToFileURL(resolve(repo, relativePath)));
    mod = new SyntheticModule(Object.keys(ns), function () {
      for (const [key, value] of Object.entries(ns)) this.setExport(key, value);
    });
  }
  modules.set(relativePath, mod);
  return mod;
}
const main = await moduleFor(`${scriptDir}/director-production-preflight-v2.mjs`);
await main.link((specifier, importer) => moduleFor(specifier.startsWith('node:') ? specifier : relative(root, resolve(dirname(importer.identifier), specifier))));
await main.evaluate();
const gateApi = main.namespace;
const inputApi = modules.get(`${scriptDir}/first-candidate-input-contract.mjs`).namespace;
const policy = {incidentPreventionVersion: '1'};
const taskId = 'synthetic-director-task';
const revisionId = 'synthetic-first-r1';
let job;
let input;
let registry;
let user;
let supervisor;
let baseline;
const executed = [];
function test(name, fn) {
  fn();
  executed.push(name);
  console.log(`通过：${name}`);
}
function saveContext() {
  put('synthetic-context-store/04_Claude Code日常操作/scripts/opc_rag.py', '# synthetic: never executed\n');
  put('synthetic-context-store/.opc-rag/tasks/synthetic/context.json', {
    evidenceScope: 'synthetic', task: {id: 'synthetic-context', important: true}, status: 'context-ready',
    project_route: {project_root: root}, gate: {formal_execution_allowed: true},
    receipt_groups: {task_original_materials: {status: 'complete', entries: [{
      resolved_path: resolve(root, 'job.json'), sha256: hashFile('job.json'),
      states: {retrieved: true, read: true, applied: true}, application_note: 'synthetic unit test only',
    }]}},
  });
}
function saveJob() { put('job.json', job); saveContext(); }
function authorize(body, kind) {
  const receipt = {...body, explicitAcceptanceQuote: body.explicitAuthorizationQuote};
  const {publicKey, privateKey} = generateKeyPairSync('ed25519');
  const receiptBindingPayload = directorCore.buildDirectorExternalAnchorBindingPayloadV2(receipt, kind);
  const entry = {
    evidenceScope: 'synthetic', kind, status: 'accepted', decision: body.decision,
    revisionId: body.revisionId, expiresAt: body.expiresAt,
    sourceThreadId: receipt.sourceThreadId, sourceMessageId: receipt.sourceMessageId,
    sourceMessageSha256: receipt.sourceMessageSha256, issuerGroupId: receipt.issuerGroupId,
    explicitAcceptanceQuoteSha256: sha(receipt.explicitAcceptanceQuote),
    receiptBindingPayload, receiptBindingSha256: stable(receiptBindingPayload), signerKeyId: 'synthetic-ephemeral-key',
  };
  entry.signatureBase64 = sign(null, Buffer.from(directorCore.serializeDirectorExternalAnchorEntryForSignatureV2(entry)), privateKey).toString('base64');
  testState.anchors.set(`${kind}:${body.sourceMessageId}`, {entry, publicKey});
}
function approve() {
  job.productionGate.firstCandidateInput = put('input.json', input);
  const checked = inputApi.validateFirstCandidateInputContract({projectRoot: root, contract: input, job, command: 'preview'});
  const boundFiles = [...new Map([
    ...gateApi.collectProductionBoundFilesV2({projectRoot: root, job}), ...checked.files,
    ...['input.json', 'workflow/director-skill-lock.v1.json'].map((path) => ({path, sha256: hashFile(path), bytes: readFileSync(resolve(root, path)).length})),
  ].map((item) => [item.path, item])).values()].sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));
  const closure = gateApi.computeProductionGateClosureV2({projectRoot: root});
  const binding = {
    episodeId: input.episodeId, taskId, jobId: job.jobId, revisionId: input.revisionId,
    firstCandidateInputSha256: hashFile('input.json'), jobSnapshotSha256: gateApi.computeProductionJobSnapshotSha256V2(job),
    boundFiles, boundFilesSha256: stable(boundFiles), gateClosure: closure.files,
    gateClosureSha256: closure.sha256, compositionBinding: gateApi.computeProductionCompositionBindingV2(job, {projectRoot: root}),
    productionEligible: false, formalEnabled: false, candidateAccepted: false,
  };
  user = {
    schema: inputApi.FIRST_CANDIDATE_AUTHORIZATION_SCHEMA, role: 'user',
    evidenceScope: 'real-e2e', synthetic: true, // Only the isolated VM trusts this ephemeral test key.
    actorId: 'synthetic-user', authorizedUserId: 'synthetic-user',
    decision: 'approved-first-candidate-inputs', issuerGroupId: 'synthetic-user-group',
    sourceThreadId: 'synthetic-user-task', sourceMessageId: 'synthetic-user-message',
    explicitAuthorizationQuote: 'synthetic: allow only the first candidate from these inputs',
    reviewedAt: '2026-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z',
    revisionId: input.revisionId, allowedCommands: ['preview', 'direct-remotion-preview'], binding,
  };
  user.sourceMessageSha256 = sha(user.explicitAuthorizationQuote);
  authorize(user, 'director-first-candidate-input-authorization');
  job.productionGate.firstCandidateAuthorization = put('user.json', user);
  supervisor = {...structuredClone(user), role: 'supervisor', actorId: 'synthetic-supervisor',
    decision: 'approved-first-candidate-revision', issuerGroupId: 'synthetic-supervisor-group',
    sourceThreadId: 'synthetic-supervisor-task', sourceMessageId: 'synthetic-supervisor-message',
    userAuthorizationSha256: hashFile('user.json'),
  };
  authorize(supervisor, 'director-production-freeze-authorization');
  job.productionGate.freezeReceipt = put('supervisor.json', supervisor);
  saveJob();
}
const check = (command = 'preview', entrypoint = registry.entrypointByCommand[command]) => gateApi.validateProductionEntryPreflightV2({projectRoot: root, jobPath: resolve(root, 'job.json'), job, command, entrypoint});
const rejects = (code, command, entrypoint) => {
  const result = check(command, entrypoint);
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(result.code, code, JSON.stringify(result));
};
function reset() {
  for (const [path, bytes] of baseline) put(path, bytes);
  job = loadJson('job.json'); input = loadJson('input.json');
  user = loadJson('user.json'); supervisor = loadJson('supervisor.json');
  testState.failedStage = null; testState.independent = true;
  authorize(user, 'director-first-candidate-input-authorization');
  authorize(supervisor, 'director-production-freeze-authorization');
}

try {
  const preflightSource = readFileSync(resolve(repo, `${scriptDir}/director-production-preflight-v2.mjs`), 'utf8');
  const pathsText = preflightSource.match(/const GATE_CLOSURE_PATHS = Object.freeze\(\[([\s\S]*?)\]\);/u)[1];
  for (const [, path] of pathsText.matchAll(/'([^']+)'/gu)) put(path, readFileSync(resolve(repo, path), 'utf8'));
  put('remotion/node_modules/@remotion/cli/remotion-cli.js', '// synthetic: never executable\n');
  mkdirSync(resolve(root, 'remotion/node_modules/.bin'), {recursive: true});
  symlinkSync('../@remotion/cli/remotion-cli.js', resolve(root, 'remotion/node_modules/.bin/remotion'));
  registry = loadJson('workflow/director-production-freeze-registry.v2.json');
  registry.controlledRemotionCli.targetSha256 = hashFile('remotion/node_modules/@remotion/cli/remotion-cli.js');
  put('workflow/director-production-freeze-registry.v2.json', registry);
  const profile = put('workflow/active-director-profile.v1.json', {style: {path: 'style.json'}, skill: {lockPath: 'workflow/director-skill-lock.v1.json'}});
  put('workflow/director-skill-lock.v1.json', {evidenceScope: 'synthetic', neverProduction: true});
  const style = put('style.json', {evidenceScope: 'synthetic'});
  const recordedMedia = {...put('assets/talk.mp4', 'synthetic: not a video'), durationSeconds: 12};
  const spokenTimeline = {...put('assets/spoken.json', {synthetic: true, captions: []}), authority: 'recorded-audio', scriptRole: 'comparison-only'};
  const artifact = (name, body) => put(`inputs/${name}.json`, {taskId, revisionId, policy, ...body});
  const preproductionRequest = artifact('pre-request', {requestId: 'synthetic-pre', policy, directorProfile: {path: profile.path}});
  expectedPre = {taskId, revisionId, policy, status: 'provisional-previsualization', formalEligible: false};
  const preproductionPlan = put('inputs/pre-plan.json', expectedPre);
  expectedRoute = {taskId, revisionId, policy, branch: 'paper-editorial', fallback: 'blocked'};
  const routeLock = put('inputs/route.json', expectedRoute);
  const prompt = artifact('prompt', {policy});
  const compileReceipt = artifact('compile', {schemaVersion: 'koubo-director-compile-receipt/v1', requestId: 'synthetic-pre',
    compilerExecuted: true, skillExecuted: false, formalEligible: false, request: preproductionRequest, plan: preproductionPlan, routeLock});
  const preproductionValidation = artifact('pre-validation', {
    schemaVersion: 'koubo-director-validation-receipt/v1', requestId: 'synthetic-pre',
    status: 'validated-provisional-previsualization', skillExecuted: true, validatorExecuted: true, gates: {formalEligible: false},
    artifacts: {request: preproductionRequest, plan: preproductionPlan, routeLock, compileReceipt,
      firstFramePromptManifest: prompt, runningHubPromptManifest: prompt},
  });
  const postshootRequest = artifact('post-request', {
    requestId: 'synthetic-post', policy, recordedMedia, spokenTimeline,
    sourcePreproduction: {requestPath: preproductionRequest.path, requestSha256: preproductionRequest.sha256,
      planPath: preproductionPlan.path, planSha256: preproductionPlan.sha256,
      validationReceiptPath: preproductionValidation.path, validationReceiptSha256: preproductionValidation.sha256},
  });
  expectedPost = {taskId, revisionId, policy, status: 'candidate-preview-required', formalEligible: false, spokenAuthority: 'recorded-audio', scriptRole: 'comparison-only'};
  const postshootPlan = put('inputs/post-plan.json', expectedPost);
  const postshootValidation = artifact('post-validation', {
    schemaVersion: 'koubo-director-postshoot-validation-receipt/v1', requestId: 'synthetic-post',
    status: 'validated-candidate-preview-required', skillExecuted: true,
    spokenAuthority: 'recorded-audio', scriptRole: 'comparison-only', gates: {formalEligible: false},
    artifacts: {request: postshootRequest, rebindPlan: postshootPlan, recordedMedia, spokenTimeline},
  });
  const assetIntake = artifact('intake', {policy, sourcePlan: postshootPlan});
  const contact = artifact('contact', {request: assetIntake});
  expectedIntake = {contactSheetManifestPath: resolve(root, contact.path), contactSheetManifest: loadJson(contact.path)};
  const assetIntakeValidation = artifact('intake-validation', {
    schemaVersion: 'koubo-paper-generated-asset-intake-receipt/v1',
    status: 'validated-candidate-assets-ready-for-preview', formalEligible: false,
    assetSetSha256: sha('synthetic-assets'), request: assetIntake, sourcePlan: postshootPlan,
    contactSheet: {manifestPath: contact.path, manifestSha256: contact.sha256},
  });
  input = {schema: inputApi.FIRST_CANDIDATE_INPUT_SCHEMA, state: 'inputs-ready-for-first-candidate',
    episodeId: 'synthetic-episode', jobId: '20260908-synthetic-first-candidate', taskId, revisionId,
    executionGroupId: 'synthetic-executor', authorizedUserId: 'synthetic-user', policy,
    productionEligible: false, formal: {enabled: false}, candidateAccepted: false,
    userPreviewApproved: false, fullWatchConfirmed: false, publishAuthorized: false,
    candidate: null, candidateAcceptance: null, technicalQa: null, handoff: null, profile, style,
    artifacts: {preproductionRequest, routeLock, preproductionPlan, preproductionValidation,
      postshootRequest, postshootPlan, postshootValidation, assetIntake, assetIntakeValidation},
  };
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json']) put(`remotion/${name}`, {});
  put('remotion/entry.tsx', "export {value} from './child';\n");
  put('remotion/child.ts', 'export const value = 1;\n');
  put('remotion/public/synthetic.txt', 'synthetic public media');
  job = {jobId: input.jobId, videoId: input.episodeId, productionEligible: false,
    experiment: {status: 'candidate-preview-required', userPreviewApproved: false}, formal: {enabled: false},
    inputs: {source: recordedMedia.path, captions: spokenTimeline.path}, preview: {output: 'candidate/output.mp4'},
    director: {taskId, artifacts: {...input.artifacts}}, knowledgeContext: {taskId: 'synthetic-context', contextPath: 'synthetic/context.json'},
    remotion: {root: 'remotion', entry: 'entry.tsx', publicDir: 'remotion/public', compositionWithSfx: 'SyntheticWithSfx',
      compositionWithoutSfx: 'SyntheticNoSfx', durationSeconds: 12, fps: 30, width: 960, height: 540},
    productionGate: {schema: gateApi.DIRECTOR_PRODUCTION_ENTRY_BINDING_SCHEMA, revisionId,
      state: inputApi.FIRST_CANDIDATE_GATE_STATE, productionEligible: false, userPreviewApproved: false, formalEnabled: false},
  };
  approve();
  const {readdirSync} = await import('node:fs');
  baseline = readdirSync(root, {recursive: true, withFileTypes: true}).filter((item) => item.isFile())
    .map((item) => { const path = relative(root, resolve(item.parentPath, item.name)); return [path, readFileSync(resolve(root, path))]; });

  test('synthetic：无候选视频和未来验收时，V2首次许可链通过', () => {
    const result = check();
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.code, 'DPG2_FIRST_CANDIDATE_OK');
    for (const key of ['productionEligible', 'formalEnabled', 'candidateAccepted', 'userPreviewApproved', 'fullWatchConfirmed', 'publishAuthorized']) assert.equal(result[key], false);
    assert.equal(result.directorContractSha256, null);
    assert.equal(result.knowledgeContext.validationStatus, 'context-valid');
    for (const stage of ['preproduction', 'prompts', 'postshoot', 'intake', 'director-binding-with-lock', 'knowledge']) assert.ok(testState.calls.includes(stage));
    assert.equal(check('direct-remotion-preview').ok, true);
  });
  for (const key of ['productionEligible', 'candidateAccepted', 'userPreviewApproved', 'fullWatchConfirmed', 'publishAuthorized']) test(`禁止首候选提前晋级：${key}`, () => {
    reset(); input[key] = true; job.productionGate.firstCandidateInput = put('input.json', input); saveJob(); rejects('FCI_STATE_INVALID');
  });
  for (const key of ['candidate', 'candidateAcceptance', 'technicalQa', 'handoff']) test(`禁止未来证据：${key}`, () => {
    reset(); input[key] = {path: 'future.mp4', sha256: '0'.repeat(64)}; job.productionGate.firstCandidateInput = put('input.json', input); saveJob(); rejects('FCI_STATE_INVALID');
  });
  for (const command of ['formal', 'formal-audio', 'qa', 'regression', 'all', 'direct-remotion-render', 'release-validation', 'prepare', 'doctor']) test(`首次许可拒绝命令：${command}`, () => {
    reset(); rejects('FCI_COMMAND_FORBIDDEN', command);
  });
  test('命令入口仍由冻结注册表唯一指定', () => { reset(); rejects('DPG2_COMMAND_ENTRYPOINT_MISMATCH', 'preview', 'uncontrolled.mjs'); });
  for (const stage of ['preproduction', 'prompts', 'postshoot', 'intake', 'lock']) test(`上游失败不能仅靠passed回执推进：${stage}`, () => {
    reset(); testState.failedStage = stage;
    rejects({preproduction: 'FCI_PREPRODUCTION_INVALID', prompts: 'FCI_PROMPT_HANDOFF_INVALID', postshoot: 'FCI_POSTSHOOT_INVALID', intake: 'FCI_ASSET_INTAKE_INVALID', lock: 'DIRECTOR_SKILL_LOCK_PACKAGE_SHA_MISMATCH'}[stage]);
  });
  for (const key of ['episodeId', 'taskId', 'jobId', 'revisionId']) test(`跨身份合同拒绝：${key}`, () => {
    reset(); input[key] = 'synthetic-other'; job.productionGate.firstCandidateInput = put('input.json', input); saveJob(); rejects('FCI_IDENTITY_MISMATCH');
  });
  for (const key of ['preproductionRequest', 'preproductionPlan', 'postshootRequest', 'postshootPlan', 'assetIntake']) test(`强化策略不可剥离：${key}`, () => {
    reset(); const ref = input.artifacts[key]; const body = loadJson(ref.path); delete body.policy;
    const changed = put(ref.path, body);
    // Rebind every enclosing JSON to isolate policy validation from ordinary SHA drift.
    let old = ref.sha256;
    const updates = new Map([[ref.path, changed.sha256]]);
    for (let pass = 0; pass < 6; pass++) for (const [path] of baseline.filter(([path]) => path.startsWith('inputs/'))) {
      const value = loadJson(path);
      const visit = (x) => { if (!x || typeof x !== 'object') return;
        if (updates.has(x.path)) x.sha256 = updates.get(x.path);
        for (const [k, v] of Object.entries(x)) { if (k.endsWith('Path') && updates.has(v)) x[`${k.slice(0, -4)}Sha256`] = updates.get(v); visit(v); }
      };
      visit(value); updates.set(path, put(path, value).sha256);
    }
    for (const [name, binding] of Object.entries(input.artifacts)) {
      binding.sha256 = updates.get(binding.path) ?? binding.sha256;
      job.director.artifacts[name] = {...binding};
    }
    assert.notEqual(old, changed.sha256);
    job.productionGate.firstCandidateInput = put('input.json', input); saveJob(); rejects('FCI_STAGE_POLICY_REQUIRED');
  });
  for (const path of ['assets/talk.mp4', 'assets/spoken.json', 'inputs/prompt.json']) test(`传递输入漂移拒绝：${path}`, () => {
    reset(); put(path, 'synthetic drift'); rejects('FCI_INPUT_SHA_MISMATCH');
  });
  for (const path of ['remotion/child.ts', 'remotion/public/synthetic.txt', 'remotion/package-lock.json', `${scriptDir}/paper-motion-contract.mjs`]) test(`代码媒体与门禁闭包漂移拒绝：${path}`, () => {
    reset(); put(path, 'synthetic drift'); rejects('FCI_AUTHORIZATION_BINDING_MISMATCH');
  });
  test('缺少独立锚点时即便自造回执完整也拒绝', () => { reset(); testState.independent = false; rejects('FCI_USER_EXTERNAL_ANCHOR_INVALID'); });
  test('过期用户许可拒绝', () => {
    reset(); user.expiresAt = '2000-01-01T00:00:00Z'; job.productionGate.firstCandidateAuthorization = put('user.json', user); saveJob(); rejects('FCI_USER_EXTERNAL_EVIDENCE_INVALID');
  });
  test('执行组不能自签为用户', () => {
    reset(); user.issuerGroupId = input.executionGroupId; job.productionGate.firstCandidateAuthorization = put('user.json', user); saveJob(); rejects('FCI_USER_EXTERNAL_EVIDENCE_INVALID');
  });
  test('签名消息不可替换原话', () => {
    reset(); user.explicitAuthorizationQuote += ' changed'; user.sourceMessageSha256 = sha(user.explicitAuthorizationQuote);
    job.productionGate.firstCandidateAuthorization = put('user.json', user); saveJob(); rejects('FCI_USER_EXTERNAL_ANCHOR_INVALID');
  });
  test('许可不得夹带正式命令', () => {
    reset(); user.allowedCommands.push('formal'); job.productionGate.firstCandidateAuthorization = put('user.json', user); saveJob(); rejects('FCI_AUTHORIZATION_COMMAND_INVALID');
  });
  test('监督不得复用用户消息身份', () => {
    reset(); supervisor.sourceThreadId = user.sourceThreadId; supervisor.sourceMessageId = user.sourceMessageId;
    authorize(supervisor, 'director-production-freeze-authorization'); job.productionGate.freezeReceipt = put('supervisor.json', supervisor); saveJob(); rejects('FCI_SUPERVISION_NOT_INDEPENDENT');
  });
  test('监督必须绑定当前用户许可SHA', () => {
    reset(); supervisor.userAuthorizationSha256 = '0'.repeat(64); authorize(supervisor, 'director-production-freeze-authorization');
    job.productionGate.freezeReceipt = put('supervisor.json', supervisor); saveJob(); rejects('FCI_SUPERVISION_NOT_INDEPENDENT');
  });
  test('旧候选冻结许可不能冒充首次许可', () => {
    reset(); supervisor.schema = gateApi.DIRECTOR_PRODUCTION_FREEZE_RECEIPT_SCHEMA;
    job.productionGate.freezeReceipt = put('supervisor.json', supervisor); saveJob(); rejects('FCI_AUTHORIZATION_IDENTITY_INVALID');
  });
  test('伪造正式状态不能选择旧分支', () => {
    reset(); job.productionGate.state = 'candidate-preview-approved'; saveJob(); rejects('FCI_STATE_INVALID');
  });
  test('缺少知识上下文拒绝', () => { reset(); delete job.knowledgeContext; approve(); rejects('KCPG2_CONTEXT_REQUIRED'); });
  test('知识上下文当前job读取SHA不可过期', () => {
    reset(); const contextPath = 'synthetic-context-store/.opc-rag/tasks/synthetic/context.json'; const context = loadJson(contextPath);
    context.receipt_groups.task_original_materials.entries[0].sha256 = '0'.repeat(64); put(contextPath, context); rejects('KCPG2_JOB_READ_RECEIPT_SHA_MISMATCH');
  });
  test('冻结事故job即使有新分支标记也拒绝', () => {
    reset(); const value = structuredClone(registry); value.blockedJobFiles.push({jobId: job.jobId, jobFileSha256: hashFile('job.json'), reason: 'synthetic incident'});
    put('workflow/director-production-freeze-registry.v2.json', value); rejects('DPG2_FROZEN_JOB_REVISION');
  });
  test('189秒退役片同SHA改名依然拒绝（synthetic内容替身）', () => {
    reset(); const value = structuredClone(registry); value.retiredOutputSha256.push(hashFile('assets/talk.mp4'));
    put('workflow/director-production-freeze-registry.v2.json', value); rejects('FCI_RETIRED_OUTPUT');
  });
  test('旧退役风格不能通过首次候选入口', () => {
    reset(); job.inputs.fingerprintPaths = ['remotion/public/synthetic.txt']; put('remotion/public/synthetic.txt', 'koubo-paper-construct-v1');
    job.retiredStyle = 'koubo-paper-construct-v1'; saveJob(); rejects('RETIRED_GENERATED_STYLE');
  });
  test('输入路径逃逸拒绝', () => {
    reset(); input.artifacts.assetIntake.path = '../outside.json'; job.productionGate.firstCandidateInput = put('input.json', input); saveJob(); rejects('FCI_PATH_OUTSIDE');
  });
  test('输入符号链接拒绝', () => {
    reset(); symlinkSync('inputs/intake.json', resolve(root, 'alias.json')); input.artifacts.assetIntake.path = 'alias.json';
    job.productionGate.firstCandidateInput = put('input.json', input); saveJob(); rejects('FCI_PATH_SYMLINK');
  });
  test('首候选回执同样接受执行前后完整性复检', () => {
    reset(); const preflight = check(); assert.equal(preflight.ok, true);
    assert.equal(gateApi.assertProductionPreflightStillCurrentV2({preflight, projectRoot: root, jobPath: resolve(root, 'job.json'), job,
      command: 'preview', entrypoint: registry.entrypointByCommand.preview}).ok, true);
  });
  console.log(JSON.stringify({ok: true, evidenceScope: 'synthetic', tests: executed.length,
    realAuthorization: false, rendered: false, installedKey: false, productionEligible: false,
    domainValidatorDoubles: ['preproduction', 'prompts', 'postshoot', 'intake', 'director-package-lock'],
    knowledgeValidation: 'real local checks; synthetic external validator response',
  }));
} finally {
  rmSync(root, {recursive: true, force: true});
}
