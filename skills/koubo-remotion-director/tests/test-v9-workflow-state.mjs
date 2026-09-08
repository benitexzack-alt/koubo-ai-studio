import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createNativePreproductionFixture, runDirectorCli} from './fixtures/v9-native-preproduction.mjs';
import {
  V9_STAGES,
  validateV9ProductionState,
} from '../scripts/v9-workflow-state-core.mjs';

const sha = 'a'.repeat(64);
const binding = (name) => ({path: `evidence/${name}.json`, sha256: sha});

const requiredArtifacts = {
  'script-confirmed': ['script', 'scriptUserConfirmation'],
  'director-prompt-packs-ready': [
    'directorRequest',
    'directorPlan',
    'directorValidation',
    'firstFramePromptManifest',
    'imageToVideoPromptManifest',
    'aiVideoPromptManifest',
  ],
  'generation-handoff-ready': ['generationInventory', 'generationOwnershipReceipt'],
  'asset-intake-passed': ['talkingHeadSource', 'requiredAssetsManifest', 'assetIntakeReceipt'],
  'postshoot-rebound': [
    'spokenSourceBinding',
    'postshootRebindReceipt',
    'shotcraftSelectionPlan',
    'shotcraftAutoMatchRequest',
    'shotcraftAutoMatchReceipt',
    'shotcraftExperienceLookupReceipt',
  ],
  'candidate-preview-rendered': [
    'candidatePreview',
    'candidateQaReceipt',
    'shotcraftApplicationReceipt',
  ],
  'candidate-preview-user-approved': [
    'candidateUserAcceptance',
    'shotcraftExperienceWriteReceipt',
  ],
  'formal-rendered': ['formalVideo', 'formalQaReceipt'],
  'release-package-ready': ['releaseRecord', 'releasePackageReceipt'],
};

function buildState(stageCount, gateOverrides = {}) {
  const stageHistory = V9_STAGES.slice(0, stageCount).map((stage) => ({
    stage,
    completedAt: '2026-09-05T02:30:00+08:00',
    artifacts: Object.fromEntries(
      requiredArtifacts[stage].map((name) => [name, binding(`${stage}-${name}`)]),
    ),
  }));
  const completed = new Set(stageHistory.map((item) => item.stage));
  const previewApproved = completed.has('candidate-preview-user-approved');
  const formalRendered = completed.has('formal-rendered');
  const releaseReady = completed.has('release-package-ready');
  return {
    schemaVersion: 'koubo-v9-production-state/v1',
    taskId: 'task-v9-test',
    revisionId: 'candidate-v9-r1',
    status: releaseReady
      ? 'ready-for-user-review'
      : formalRendered
        ? 'formal-candidate-ready'
        : previewApproved
          ? 'formal-authorized'
          : 'candidate-preview-required',
    directorProfile: {profileId: 'paper-editorial-director-v9', profileVersion: '9.1.0'},
    currentStage: stageHistory.at(-1).stage,
    stageHistory,
    gates: {
      formalEnabled: previewApproved,
      releasePackageEnabled: formalRendered,
      publicationEnabled: false,
      externalActionsRequireExplicitAuthorization: true,
      ...gateOverrides,
    },
    spokenSourcePolicy: {
      subtitleAuthority: 'actual-recording',
      preShootScriptRoleAfterRecording: 'comparison-only',
    },
    exclusions: {
      old189SecondChainExcluded: true,
      retiredPaperV1Excluded: true,
      failedDirectorMastersExcluded: true,
      supersededRevisionReuseForbidden: true,
    },
  };
}

test('V9 accepts the script-confirmed start state', () => {
  const result = validateV9ProductionState({state: buildState(1)});
  assert.equal(result.ok, true);
  assert.equal(result.nextStage, 'director-prompt-packs-ready');
  assert.equal(result.formalEnabled, false);
});

test('V9.1 requires automatic matching and experience lookup at postshoot rebound', () => {
  const state = buildState(5);
  delete state.stageHistory[4].artifacts.shotcraftAutoMatchReceipt;
  const result = validateV9ProductionState({state});
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_ARTIFACT_BINDING_INVALID:postshoot-rebound:shotcraftAutoMatchReceipt'));
});

test('V9.1 requires the accepted preview to be written into the experience ledger', () => {
  const state = buildState(7);
  delete state.stageHistory[6].artifacts.shotcraftExperienceWriteReceipt;
  const result = validateV9ProductionState({state});
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_ARTIFACT_BINDING_INVALID:candidate-preview-user-approved:shotcraftExperienceWriteReceipt'));
});

test('V9 rejects skipped or reordered stages', () => {
  const state = buildState(3);
  state.stageHistory[1].stage = 'asset-intake-passed';
  const result = validateV9ProductionState({state});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith('V9_STAGE_ORDER_INVALID')));
});

test('V9 rejects formal enablement before the user accepts the candidate preview', () => {
  const result = validateV9ProductionState({
    state: buildState(6, {formalEnabled: true}),
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_FORMAL_ENABLED_BEFORE_PREVIEW_ACCEPTANCE'));
});

test('V9 rejects a missing director prompt pack', () => {
  const state = buildState(2);
  delete state.stageHistory[1].artifacts.aiVideoPromptManifest;
  const result = validateV9ProductionState({state});
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes(
      'V9_ARTIFACT_BINDING_INVALID:director-prompt-packs-ready:aiVideoPromptManifest',
    ),
  );
});

test('V9 accepts the complete release-package state while publication stays disabled', () => {
  const result = validateV9ProductionState({state: buildState(V9_STAGES.length)});
  assert.equal(result.ok, true);
  assert.equal(result.nextStage, null);
  assert.equal(result.formalEnabled, false);
  assert.equal(result.releasePackageEnabled, false);
});

const receiptTypes = {
  scriptUserConfirmation: ['koubo-pre-shoot-user-confirmation/v1', 'approved'],
  directorRequest: ['koubo-director-preproduction-request/v1', 'ready-for-validation'],
  directorPlan: ['koubo-director-preproduction-plan/v1', 'provisional-previsualization'],
  directorValidation: ['koubo-director-validation-receipt/v1', 'validated-provisional-previsualization'],
  firstFramePromptManifest: ['koubo-paper-first-frame-prompt-manifest/v1', 'automation-input-ready'],
  imageToVideoPromptManifest: ['koubo-runninghub-image-to-video-prompt-manifest/v1', 'awaiting-text-baked-firstframes'],
  aiVideoPromptManifest: ['koubo-ai-generated-video-prompt-manifest/v1', 'not-required'],
  generationInventory: ['koubo-generation-inventory/v1', 'handoff-ready'],
  generationOwnershipReceipt: ['koubo-generation-ownership-receipt/v1', 'ownership-confirmed'],
  requiredAssetsManifest: ['koubo-required-assets-manifest/v1', 'ready-for-intake'],
  assetIntakeReceipt: ['koubo-paper-generated-asset-intake-receipt/v1', 'validated-candidate-assets-ready-for-preview'],
  spokenSourceBinding: ['koubo-spoken-source-binding/v1', 'validated'],
  postshootRebindReceipt: ['koubo-director-postshoot-validation-receipt/v1', 'validated-candidate-preview-required'],
  shotcraftSelectionPlan: ['koubo-shotcraft-director-selection/v1', 'selection-ready'],
  shotcraftAutoMatchRequest: ['koubo-shotcraft-auto-match-request/v1', 'ready-for-validation'],
  shotcraftAutoMatchReceipt: ['koubo-shotcraft-auto-match-receipt/v1', 'candidate-match-ready'],
  shotcraftExperienceLookupReceipt: ['koubo-shotcraft-experience-lookup-receipt/v1', 'lookup-complete'],
  candidateQaReceipt: ['koubo-candidate-qa-receipt/v1', 'passed'],
  shotcraftApplicationReceipt: ['koubo-shotcraft-application-receipt/v1', 'passed'],
  candidateUserAcceptance: ['koubo-candidate-user-acceptance/v1', 'approved'],
  shotcraftExperienceWriteReceipt: ['koubo-shotcraft-experience-write-receipt/v1', 'experience-recorded'],
  formalQaReceipt: ['koubo-formal-qa-receipt/v1', 'passed'],
  releaseRecord: ['koubo-release-record/v1', 'ready-for-user-review'],
  releasePackageReceipt: ['koubo-release-package-receipt/v1', 'passed'],
};
const hashFile = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function strictFixture(t, stageCount = 9) {
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'v9-state-incident-'));
  t.after(() => rmSync(projectRoot, {recursive: true, force: true}));
  const state = buildState(stageCount);
  state.policy = {incidentPreventionVersion: '1'};
  const documents = {};
  const bindings = {};
  const persist = (key) => {
    writeFileSync(path.join(projectRoot, bindings[key].path), JSON.stringify(documents[key]));
    bindings[key].sha256 = hashFile(path.join(projectRoot, bindings[key].path));
  };
  if (stageCount >= 2) {
    const native = createNativePreproductionFixture(projectRoot);
    Object.assign(state, {taskId: native.state.taskId, revisionId: native.state.revisionId,
      preproductionRequestId: native.state.preproductionRequestId});
    state.stageHistory.splice(0, 2, ...native.state.stageHistory);
    for (const [key, binding] of Object.entries(native.artifacts)) {
      bindings[key] = binding;
      if (key !== 'script') documents[key] = JSON.parse(readFileSync(path.join(projectRoot, binding.path)));
    }
  }
  for (const record of state.stageHistory) {
    for (const key of requiredArtifacts[record.stage]) {
      if (bindings[key]) continue;
      const previous = structuredClone(bindings);
      bindings[key] = record.artifacts[key] = {path: `${key}.json`, sha256: sha};
      if (receiptTypes[key]) {
        const [schemaVersion, status] = receiptTypes[key];
        documents[key] = {
          schemaVersion, status, taskId: state.taskId, revisionId: state.revisionId,
          bindings: previous, approved: true, userQuote: '已核对当前候选，批准本版本。',
          approvedAt: '2026-09-08T09:00:00+08:00', formalAuthorized: true,
          skillExecuted: true, items: [], exceptions: [],
        };
      } else {
        documents[key] = 'local-media-or-script-fixture';
      }
      persist(key);
    }
  }
  return {state, projectRoot, documents, bindings, persist,
    validate: () => validateV9ProductionState({state, projectRoot, verifyFiles: true})};
}

test('强化模板必须硬开启事故预防策略', () => {
  const template = JSON.parse(readFileSync(new URL('../templates/v9-production-state.v1.json', import.meta.url)));
  assert.equal(template.policy?.incidentPreventionVersion, '1');
});

test('原生AI清单不能删除已传播的强化策略再重算外层哈希', (t) => {
  const fixture = strictFixture(t, 2);
  delete fixture.documents.aiVideoPromptManifest.policy;
  fixture.persist('aiVideoPromptManifest');
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('NATIVE_POLICY_REQUIRED')));
});

test('强化状态支持完整的当前版本证据链，发布仍关闭', (t) => {
  const fixture = strictFixture(t);
  assert.deepEqual(fixture.validate().errors, []);
});

for (const [name, change, expected] of [
  ['失败回执', (doc) => { doc.status = 'failed'; }, 'CONTENT_STATUS_INVALID'],
  ['错类型', (doc) => { doc.schemaVersion = 'koubo-formal-qa-receipt/v1'; }, 'CONTENT_SCHEMA_INVALID'],
  ['跨任务', (doc) => { doc.taskId = 'other-task'; }, 'CONTENT_TASK_MISMATCH'],
  ['旧版本', (doc) => { doc.revisionId = 'old-revision'; }, 'CONTENT_REVISION_MISMATCH'],
  ['空绑定', (doc) => { doc.bindings = {}; }, 'CONTENT_BINDING_MISMATCH'],
  ['错脚本哈希', (doc) => { doc.bindings.script.sha256 = 'b'.repeat(64); }, 'CONTENT_BINDING_MISMATCH'],
  ['错脚本路径', (doc) => { doc.bindings.script.path = 'elsewhere.json'; }, 'CONTENT_BINDING_MISMATCH'],
  ['批准布尔值缺失', (doc) => { delete doc.approved; }, 'USER_APPROVAL_REQUIRED'],
  ['例外伪装成功', (doc) => { doc.exceptions = [{status: 'known-exception-user-accepted'}]; }, 'EXCEPTION_NOT_SUCCESS'],
  ['失败结果伪装成功', (doc) => { doc.ok = false; }, 'CONTENT_FAILURE'],
]) {
  test(`强化状态拒绝${name}，即使文件哈希重新算对`, (t) => {
    const fixture = strictFixture(t, 1);
    change(fixture.documents.scriptUserConfirmation);
    fixture.persist('scriptUserConfirmation');
    const result = fixture.validate();
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes(expected)), result.errors.join('\n'));
    assert.equal(result.nextStage, null);
    assert.equal(result.formalEnabled, false);
  });
}

test('强化状态不能跳过内部文件检查或省略项目根目录', () => {
  const state = buildState(7);
  state.policy = {incidentPreventionVersion: '1'};
  for (const options of [{}, {verifyFiles: true}, {verifyFiles: false, projectRoot: '/tmp'}]) {
    const result = validateV9ProductionState({state, ...options});
    assert.equal(result.ok, false);
    assert.equal(result.formalEnabled, false);
    assert.equal(result.nextStage, null);
  }
});

test('未知策略版本不能静默降级旧夹具模式', () => {
  const state = buildState(1);
  state.policy = {incidentPreventionVersion: '2'};
  assert.equal(validateV9ProductionState({state}).ok, false);
});

test('每一种结构化产物均拒绝错类型或失败状态', (t) => {
  const fixture = strictFixture(t);
  for (const key of Object.keys(receiptTypes)) {
    for (const field of ['schemaVersion', 'status']) {
      if (key === 'scriptUserConfirmation' && field === 'status') continue;
      const original = fixture.documents[key][field];
      fixture.documents[key][field] = field === 'status' ? 'failed' : 'wrong-type/v1';
      fixture.persist(key);
      const result = fixture.validate();
      assert.equal(result.ok, false, `${key}:${field}`);
      const errorType = field === 'status' ? 'CONTENT_STATUS_INVALID' : 'CONTENT_SCHEMA_INVALID';
      assert.ok(result.errors.some((error) => error.includes(errorType) && error.endsWith(`:${key}`)), result.errors.join('\n'));
      assert.equal(result.formalEnabled, false);
      assert.equal(result.releasePackageEnabled, false);
      fixture.documents[key][field] = original;
      fixture.persist(key);
    }
  }
});

test('用户保留例外不能写为可复用成功经验', (t) => {
  const fixture = strictFixture(t, 7);
  fixture.documents.shotcraftExperienceWriteReceipt.entries = [{exceptionApplied: true, status: 'reusable-pattern'}];
  fixture.persist('shotcraftExperienceWriteReceipt');
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('EXCEPTION_NOT_SUCCESS')));
  assert.equal(result.formalEnabled, false);
});

test('候选批准不自动等于正式授权', (t) => {
  const fixture = strictFixture(t, 7);
  fixture.documents.candidateUserAcceptance.formalAuthorized = false;
  fixture.persist('candidateUserAcceptance');
  assert.equal(fixture.validate().formalEnabled, false);
  assert.equal(fixture.validate().ok, false);
});

test('状态本身去掉策略不能把带强化策略的上游回执降级为旧读', (t) => {
  const fixture = strictFixture(t, 1);
  delete fixture.state.policy;
  fixture.documents.scriptUserConfirmation.policy = {incidentPreventionVersion: '1'};
  fixture.persist('scriptUserConfirmation');
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith('V9_INCIDENT_POLICY_REQUIRED')));
  assert.equal(result.stageAdvanceAllowed, false);
});

test('旧纯夹具只读兼容不等于内容校验或推进权限', () => {
  const result = validateV9ProductionState({state: buildState(9)});
  assert.equal(result.ok, true);
  assert.equal(result.validationMode, 'legacy-read-only');
  assert.equal(result.contentVerified, false);
  assert.equal(result.stageAdvanceAllowed, false);
});

test('当前真实编译器及独立校验器原件可进入V9状态，不补写通用envelope', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'v9-native-roundtrip-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const fixture = createNativePreproductionFixture(root);
  const originals = Object.fromEntries(Object.entries(fixture.artifacts).map(([key, binding]) => [key, hashFile(path.join(root, binding.path))]));
  const plan = fixture.read(path.join(root, fixture.artifacts.directorPlan.path));
  const firstFrame = fixture.read(path.join(root, fixture.artifacts.firstFramePromptManifest.path));
  assert.equal(plan.revisionId, fixture.request.revisionId);
  assert.equal(firstFrame.bindings, undefined);
  assert.equal(fixture.read(path.join(root, fixture.artifacts.directorCompileReceipt.path)).skillExecuted, false);
  const result = validateV9ProductionState({state: fixture.state, projectRoot: root, verifyFiles: true});
  assert.deepEqual(result.errors, []);
  assert.equal(result.stageAdvanceAllowed, true);
  assert.equal(result.nextStage, 'generation-handoff-ready');
  assert.equal(result.formalEnabled, false);
  const generated = runDirectorCli('build-v9-preproduction-state.mjs', root,
    ['--request', 'request.json', '--script-confirmation', 'confirmation.json', '--output', 'state.json']);
  assert.equal(generated.status, 0, generated.stderr);
  const checked = runDirectorCli('validate-v9-production-state.mjs', root, ['--state', 'state.json']);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  for (const [key, binding] of Object.entries(fixture.artifacts)) {
    assert.equal(hashFile(path.join(root, binding.path)), originals[key]);
  }
  const reviewPath = fixture.request.beats[0].paperScene.motionContract.semanticReview.path;
  const review = fixture.read(reviewPath);
  writeFileSync(reviewPath, JSON.stringify({...review, sourceQuote: '被换掉的原话'}));
  const drifted = validateV9ProductionState({state: fixture.state, projectRoot: root, verifyFiles: true});
  assert.equal(drifted.ok, false);
  assert.equal(drifted.nextStage, null);
  assert.ok(drifted.errors.some((error) => error.includes('PAPER_SEMANTIC_REVIEW_FILE_OR_SHA_INVALID')));
});
