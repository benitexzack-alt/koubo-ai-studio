import assert from 'node:assert/strict';
import test from 'node:test';
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
  assert.equal(result.formalEnabled, true);
  assert.equal(result.releasePackageEnabled, true);
});
