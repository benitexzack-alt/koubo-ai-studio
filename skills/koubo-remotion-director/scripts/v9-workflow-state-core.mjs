import {createHash} from 'node:crypto';
import {existsSync, readFileSync, realpathSync, statSync} from 'node:fs';
import path from 'node:path';
import {evidenceOutcomeIssues} from './incident-evidence-core.mjs';
import {NATIVE_PREPRODUCTION_ARTIFACTS, validateNativePreproductionBundle} from './v9-native-preproduction-core.mjs';
import {NATIVE_HANDOFF_FORMAT, NATIVE_HANDOFF_KEYS, validateNativeGenerationHandoff} from './v9-native-handoff-core.mjs';

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

// Preproduction keeps native producer bindings; downstream receipts use their own content contracts.
export const V9_CONTENT_CONTRACTS = Object.freeze({
  scriptUserConfirmation: {schema: 'koubo-pre-shoot-user-confirmation/v1', statuses: ['approved'], binds: ['script'], approval: true},
  ...Object.fromEntries(Object.entries(NATIVE_PREPRODUCTION_ARTIFACTS).map(([key, contract]) =>
    [key, {...contract, native: true}])),
  generationInventory: {schema: 'koubo-generation-inventory/v1', statuses: ['handoff-ready'], binds: ['directorValidation', 'firstFramePromptManifest', 'imageToVideoPromptManifest', 'aiVideoPromptManifest']},
  generationOwnershipReceipt: {schema: 'koubo-generation-ownership-receipt/v1', statuses: ['ownership-confirmed'], binds: ['generationInventory']},
  requiredAssetsManifest: {schema: 'koubo-required-assets-manifest/v1', statuses: ['ready-for-intake'], binds: ['generationInventory', 'talkingHeadSource']},
  assetIntakeReceipt: {schema: 'koubo-paper-generated-asset-intake-receipt/v1', statuses: ['validated-candidate-assets-ready-for-preview'], binds: ['directorPlan', 'requiredAssetsManifest', 'talkingHeadSource']},
  spokenSourceBinding: {schema: 'koubo-spoken-source-binding/v1', statuses: ['validated'], binds: ['talkingHeadSource']},
  postshootRebindReceipt: {schema: 'koubo-director-postshoot-validation-receipt/v1', statuses: ['validated-candidate-preview-required'], binds: ['directorPlan', 'assetIntakeReceipt', 'spokenSourceBinding'], executed: true},
  shotcraftSelectionPlan: {schema: 'koubo-shotcraft-director-selection/v1', statuses: ['selection-ready'], binds: ['postshootRebindReceipt']},
  shotcraftAutoMatchRequest: {schema: 'koubo-shotcraft-auto-match-request/v1', statuses: ['ready-for-validation'], binds: ['postshootRebindReceipt']},
  shotcraftAutoMatchReceipt: {schema: 'koubo-shotcraft-auto-match-receipt/v1', statuses: ['candidate-match-ready'], binds: ['shotcraftAutoMatchRequest', 'shotcraftSelectionPlan']},
  shotcraftExperienceLookupReceipt: {schema: 'koubo-shotcraft-experience-lookup-receipt/v1', statuses: ['lookup-complete'], binds: ['shotcraftAutoMatchRequest']},
  candidateQaReceipt: {schema: 'koubo-candidate-qa-receipt/v1', statuses: ['passed'], binds: ['candidatePreview', 'postshootRebindReceipt']},
  shotcraftApplicationReceipt: {schema: 'koubo-shotcraft-application-receipt/v1', statuses: ['passed'], binds: ['candidatePreview', 'shotcraftSelectionPlan']},
  candidateUserAcceptance: {schema: 'koubo-candidate-user-acceptance/v1', statuses: ['approved'], binds: ['candidatePreview', 'candidateQaReceipt', 'shotcraftApplicationReceipt'], approval: true},
  shotcraftExperienceWriteReceipt: {schema: 'koubo-shotcraft-experience-write-receipt/v1', statuses: ['experience-recorded'], binds: ['candidateUserAcceptance', 'candidatePreview', 'shotcraftSelectionPlan', 'shotcraftApplicationReceipt']},
  formalQaReceipt: {schema: 'koubo-formal-qa-receipt/v1', statuses: ['passed'], binds: ['formalVideo', 'candidateUserAcceptance']},
  releaseRecord: {schema: 'koubo-release-record/v1', statuses: ['ready-for-user-review'], binds: ['formalVideo', 'formalQaReceipt']},
  releasePackageReceipt: {schema: 'koubo-release-package-receipt/v1', statuses: ['passed'], binds: ['releaseRecord', 'formalVideo', 'formalQaReceipt']},
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

  let root;
  try {
    root = realpathSync(projectRoot);
  } catch {
    errors.push(`V9_PROJECT_ROOT_INVALID:${stage}:${key}`);
    return;
  }
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
  if (!statSync(resolved).isFile()) {
    errors.push(`V9_ARTIFACT_NOT_FILE:${stage}:${key}`);
    return;
  }
  const bytes = readFileSync(resolved);
  if (sha256(bytes) !== binding.sha256) {
    errors.push(`V9_ARTIFACT_SHA_MISMATCH:${stage}:${key}`);
    return;
  }
  return bytes;
}

function verifyArtifactContent({bytes, state, key, stage, artifacts, errors, projectRoot}) {
  const contract = V9_CONTENT_CONTRACTS[key];
  if (!contract || !bytes) return;
  const fail = (condition, code) => { if (!condition) errors.push(`V9_${code}:${stage}:${key}`); };
  let doc;
  try {
    doc = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(false, 'CONTENT_JSON_INVALID');
    return;
  }
  if (key === 'scriptUserConfirmation' && doc?.authority === 'direct-user-message') {
    fail(doc.schemaVersion === contract.schema, 'CONTENT_SCHEMA_INVALID');
    fail(doc.status === undefined || contract.statuses.includes(doc.status), 'CONTENT_STATUS_INVALID');
    fail(doc.taskId === state.taskId, 'CONTENT_TASK_MISMATCH');
    fail(doc.revisionId === state.revisionId, 'CONTENT_REVISION_MISMATCH');
    fail(doc.approved === true && typeof doc.quote === 'string' && doc.quote.trim() &&
      typeof doc.recordedAt === 'string' && Number.isFinite(Date.parse(doc.recordedAt)), 'USER_APPROVAL_REQUIRED');
    const actual = artifacts.script;
    fail(doc.script && actual && doc.script.sha256 === actual.sha256 && typeof doc.script.path === 'string' &&
      path.resolve(projectRoot, doc.script.path) === path.resolve(projectRoot, actual.path), 'CONTENT_BINDING_MISMATCH:script');
    for (const issue of evidenceOutcomeIssues(doc)) fail(false, issue);
    return;
  }
  fail(doc?.schemaVersion === contract.schema, 'CONTENT_SCHEMA_INVALID');
  fail(contract.statuses.includes(doc?.status), 'CONTENT_STATUS_INVALID');
  fail(doc?.taskId === state.taskId, 'CONTENT_TASK_MISMATCH');
  fail(doc?.revisionId === state.revisionId, 'CONTENT_REVISION_MISMATCH');
  for (const dependency of new Set([...contract.binds, ...Object.keys(doc?.bindings ?? {})])) {
    const declared = doc?.bindings?.[dependency];
    const actual = artifacts[dependency];
    fail(isArtifactBinding(declared) && actual && declared.path === actual.path && declared.sha256 === actual.sha256,
      `CONTENT_BINDING_MISMATCH:${dependency}`);
  }
  for (const issue of evidenceOutcomeIssues(doc)) fail(false, issue);
  if (contract.executed) fail(doc?.skillExecuted === true, 'SKILL_EXECUTION_REQUIRED');
  if (contract.approval) {
    fail(doc?.approved === true && typeof doc.userQuote === 'string' && doc.userQuote.trim() &&
      typeof doc.approvedAt === 'string' && Number.isFinite(Date.parse(doc.approvedAt)), 'USER_APPROVAL_REQUIRED');
  }
  if (key === 'candidateUserAcceptance') fail(doc?.formalAuthorized === true, 'FORMAL_AUTHORIZATION_REQUIRED');
  if (key === 'aiVideoPromptManifest' && doc?.status === 'not-required') {
    fail(Array.isArray(doc.items) && doc.items.length === 0, 'NOT_REQUIRED_CONTENT_INVALID');
  }
}

export function validateV9ProductionState({state, projectRoot = null, verifyFiles = false}) {
  const errors = [];
  const fail = (condition, code) => {
    if (!condition) errors.push(code);
  };
  const policyVersion = state?.policy?.incidentPreventionVersion;
  const strict = policyVersion === '1';
  const nativeHandoff = state?.generationHandoffFormat === NATIVE_HANDOFF_FORMAT;
  fail(state?.generationHandoffFormat === undefined || nativeHandoff, 'V9_HANDOFF_FORMAT_INVALID');
  fail(policyVersion === undefined || strict, 'V9_INCIDENT_POLICY_VERSION_INVALID');
  if (strict) {
    fail(verifyFiles === true && typeof projectRoot === 'string' && projectRoot.trim(), 'V9_CONTENT_FILE_CHECK_REQUIRED');
    for (const issue of evidenceOutcomeIssues(state)) fail(false, `V9_${issue}`);
  }

  fail(state?.schemaVersion === V9_PRODUCTION_STATE_SCHEMA, 'V9_STATE_SCHEMA_INVALID');
  fail(state?.directorProfile?.profileId === 'paper-editorial-director-v9', 'V9_PROFILE_ID_INVALID');
  fail(['9.0.0', '9.1.0'].includes(state?.directorProfile?.profileVersion), 'V9_PROFILE_VERSION_INVALID');
  fail(typeof state?.taskId === 'string' && state.taskId.trim(), 'V9_TASK_ID_REQUIRED');
  fail(typeof state?.revisionId === 'string' && state.revisionId.trim(), 'V9_REVISION_ID_REQUIRED');
  const history = Array.isArray(state?.stageHistory) ? state.stageHistory : [];
  fail(history.length > 0, 'V9_STAGE_HISTORY_EMPTY');
  fail(history.length <= V9_STAGES.length, 'V9_STAGE_HISTORY_TOO_LONG');
  const allArtifacts = {};
  for (const record of history) {
    for (const [key, binding] of Object.entries(record?.artifacts ?? {})) {
      if (Object.hasOwn(allArtifacts, key)) errors.push(`V9_ARTIFACT_KEY_DUPLICATE:${key}`);
      allArtifacts[key] = binding;
    }
  }

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
      ...(strict && record.stage === 'director-prompt-packs-ready' ? ['directorRouteLock', 'directorCompileReceipt'] : []),
    ];
    for (const key of required) {
      const bytes = verifyArtifactBinding({
        binding: artifacts[key],
        projectRoot: verifyFiles ? projectRoot : null,
        key,
        stage: record.stage,
        errors,
      });
      if (strict && !Object.hasOwn(NATIVE_PREPRODUCTION_ARTIFACTS, key) && !(nativeHandoff && NATIVE_HANDOFF_KEYS.includes(key))) {
        verifyArtifactContent({bytes, state, key, stage: record.stage, artifacts: allArtifacts, errors, projectRoot});
      }
      if (!strict && bytes && V9_CONTENT_CONTRACTS[key]) {
        try {
          if (JSON.parse(bytes.toString('utf8'))?.policy?.incidentPreventionVersion !== undefined) {
            errors.push(`V9_INCIDENT_POLICY_REQUIRED:${record.stage}:${key}`);
          }
        } catch {
          // Legacy reads may contain untyped text. They never establish contentVerified.
        }
      }
    }
  });

  if (strict && verifyFiles === true && projectRoot && history.some((item) => item.stage === 'director-prompt-packs-ready')) {
    errors.push(...validateNativePreproductionBundle({state, artifacts: allArtifacts, projectRoot}).errors);
  }
  if (strict && nativeHandoff && verifyFiles === true && projectRoot && history.some((item) => item.stage === 'generation-handoff-ready')) {
    errors.push(...validateNativeGenerationHandoff({state, artifacts: allArtifacts, projectRoot}).errors);
  }

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
    nextStage: errors.length === 0 ? (V9_STAGES[history.length] ?? null) : null,
    formalEnabled: strict && errors.length === 0 && gates.formalEnabled === true,
    releasePackageEnabled: strict && errors.length === 0 && gates.releasePackageEnabled === true,
    contentVerified: strict && errors.length === 0,
    validationMode: strict ? 'incident-prevention-v1' : 'legacy-read-only',
    stageAdvanceAllowed: strict && errors.length === 0,
  };
}
