import {createHash} from 'node:crypto';
import {existsSync, readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';

export const V9_PRODUCTION_STATE_SCHEMA = 'koubo-v9-production-state/v1';

export const V9_STAGES = Object.freeze([
  'script-confirmed',
  'director-prompt-packs-ready',
  'generation-handoff-ready',
  'asset-intake-passed',
  'postshoot-rebound',
  'candidate-preview-rendered',
  'candidate-preview-user-approved',
  'formal-rendered',
  'release-package-ready',
]);

const REQUIRED_ARTIFACTS = Object.freeze({
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
  'asset-intake-passed': [
    'talkingHeadSource',
    'requiredAssetsManifest',
    'assetIntakeReceipt',
  ],
  'postshoot-rebound': [
    'spokenSourceBinding',
    'postshootRebindReceipt',
    'shotcraftSelectionPlan',
  ],
  'candidate-preview-rendered': [
    'candidatePreview',
    'candidateQaReceipt',
    'shotcraftApplicationReceipt',
  ],
  'candidate-preview-user-approved': ['candidateUserAcceptance'],
  'formal-rendered': ['formalVideo', 'formalQaReceipt'],
  'release-package-ready': ['releaseRecord', 'releasePackageReceipt'],
});

const V91_REQUIRED_ARTIFACTS = Object.freeze({
  'postshoot-rebound': [
    'shotcraftAutoMatchRequest',
    'shotcraftAutoMatchReceipt',
    'shotcraftExperienceLookupReceipt',
  ],
  'candidate-preview-user-approved': ['shotcraftExperienceWriteReceipt'],
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isSha256 = (value) => /^[a-f0-9]{64}$/.test(String(value ?? ''));

const isArtifactBinding = (binding) =>
  Boolean(
    binding &&
      typeof binding === 'object' &&
      typeof binding.path === 'string' &&
      binding.path.trim() &&
      !path.isAbsolute(binding.path) &&
      isSha256(binding.sha256),
  );

function verifyArtifactBinding({binding, projectRoot, key, stage, errors}) {
  if (!isArtifactBinding(binding)) {
    errors.push(`V9_ARTIFACT_BINDING_INVALID:${stage}:${key}`);
    return;
  }
  if (!projectRoot) return;

  const root = realpathSync(projectRoot);
  const candidate = path.resolve(root, binding.path);
  if (!existsSync(candidate)) {
    errors.push(`V9_ARTIFACT_MISSING:${stage}:${key}`);
    return;
  }
  const resolved = realpathSync(candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    errors.push(`V9_ARTIFACT_OUTSIDE_PROJECT:${stage}:${key}`);
    return;
  }
  if (sha256(readFileSync(resolved)) !== binding.sha256) {
    errors.push(`V9_ARTIFACT_SHA_MISMATCH:${stage}:${key}`);
  }
}

export function validateV9ProductionState({state, projectRoot = null, verifyFiles = false}) {
  const errors = [];
  const fail = (condition, code) => {
    if (!condition) errors.push(code);
  };

  fail(state?.schemaVersion === V9_PRODUCTION_STATE_SCHEMA, 'V9_STATE_SCHEMA_INVALID');
  fail(state?.directorProfile?.profileId === 'paper-editorial-director-v9', 'V9_PROFILE_ID_INVALID');
  fail(['9.0.0', '9.1.0'].includes(state?.directorProfile?.profileVersion), 'V9_PROFILE_VERSION_INVALID');
  fail(typeof state?.taskId === 'string' && state.taskId.trim(), 'V9_TASK_ID_REQUIRED');
  fail(typeof state?.revisionId === 'string' && state.revisionId.trim(), 'V9_REVISION_ID_REQUIRED');
  const history = Array.isArray(state?.stageHistory) ? state.stageHistory : [];
  fail(history.length > 0, 'V9_STAGE_HISTORY_EMPTY');
  fail(history.length <= V9_STAGES.length, 'V9_STAGE_HISTORY_TOO_LONG');

  history.forEach((record, index) => {
    const expectedStage = V9_STAGES[index];
    if (record?.stage !== expectedStage) {
      errors.push(`V9_STAGE_ORDER_INVALID:${index}:${record?.stage ?? 'missing'}:${expectedStage}`);
      return;
    }
    if (typeof record.completedAt !== 'string' || !record.completedAt.trim()) {
      errors.push(`V9_STAGE_COMPLETION_TIME_REQUIRED:${record.stage}`);
    }
    const artifacts = record.artifacts ?? {};
    const required = [
      ...(REQUIRED_ARTIFACTS[record.stage] ?? []),
      ...(state?.directorProfile?.profileVersion === '9.1.0' ? (V91_REQUIRED_ARTIFACTS[record.stage] ?? []) : []),
    ];
    for (const key of required) {
      verifyArtifactBinding({
        binding: artifacts[key],
        projectRoot: verifyFiles ? projectRoot : null,
        key,
        stage: record.stage,
        errors,
      });
    }
  });

  const currentStage = history.at(-1)?.stage ?? null;
  fail(state?.currentStage === currentStage, 'V9_CURRENT_STAGE_HISTORY_MISMATCH');

  const completed = new Set(history.map((record) => record.stage));
  const previewApproved = completed.has('candidate-preview-user-approved');
  const formalRendered = completed.has('formal-rendered');
  const releaseReady = completed.has('release-package-ready');
  const expectedStatus = releaseReady
    ? 'ready-for-user-review'
    : formalRendered
      ? 'formal-candidate-ready'
      : previewApproved
        ? 'formal-authorized'
        : 'candidate-preview-required';
  fail(state?.status === expectedStatus, `V9_STATE_STATUS_INVALID:${expectedStatus}`);
  const gates = state?.gates ?? {};

  fail(gates.publicationEnabled === false, 'V9_PUBLICATION_MUST_REMAIN_DISABLED');
  fail(
    gates.externalActionsRequireExplicitAuthorization === true,
    'V9_EXTERNAL_ACTION_AUTHORIZATION_GATE_MISSING',
  );
  if (!previewApproved && gates.formalEnabled !== false) {
    errors.push('V9_FORMAL_ENABLED_BEFORE_PREVIEW_ACCEPTANCE');
  }
  if (previewApproved && gates.formalEnabled !== true) {
    errors.push('V9_PREVIEW_ACCEPTED_WITHOUT_FORMAL_GATE');
  }
  if (!formalRendered && gates.releasePackageEnabled !== false) {
    errors.push('V9_RELEASE_ENABLED_BEFORE_FORMAL_RENDER');
  }
  if (formalRendered && gates.releasePackageEnabled !== true) {
    errors.push('V9_FORMAL_RENDERED_WITHOUT_RELEASE_GATE');
  }

  fail(
    state?.spokenSourcePolicy?.subtitleAuthority === 'actual-recording',
    'V9_ACTUAL_RECORDING_NOT_SUBTITLE_AUTHORITY',
  );
  fail(
    state?.spokenSourcePolicy?.preShootScriptRoleAfterRecording === 'comparison-only',
    'V9_SCRIPT_ROLE_AFTER_RECORDING_INVALID',
  );
  for (const exclusion of [
    'old189SecondChainExcluded',
    'retiredPaperV1Excluded',
    'failedDirectorMastersExcluded',
    'supersededRevisionReuseForbidden',
  ]) {
    fail(state?.exclusions?.[exclusion] === true, `V9_EXCLUSION_MISSING:${exclusion}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    currentStage,
    completedStageCount: history.length,
    nextStage: V9_STAGES[history.length] ?? null,
    formalEnabled: gates.formalEnabled === true,
    releasePackageEnabled: gates.releasePackageEnabled === true,
  };
}
