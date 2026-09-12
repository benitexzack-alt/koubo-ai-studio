import {existsSync, realpathSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSceneIdentity, validatePaperMeaningReview} from '../../koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {evidenceOutcomeIssues} from '../../koubo-remotion-director/scripts/incident-evidence-core.mjs';
import {renderMotionFirstFrame, renderMotionPrompt} from '../../koubo-remotion-director/scripts/paper-motion-contract.mjs';
import {
  DIRECTOR_CUES_SCHEMA,
  validateDirectorCuesFile,
} from '../../koubo-remotion-director/scripts/director-cues-core.mjs';
import {
  assertFullBatchAuthorized,
  readJson,
  resolveInside,
  sha256File,
  sha256Json,
  sha256Text,
  validateCueNativeSampleAcceptanceBinding,
  validateManifest,
} from './firstframe-batch-core.mjs';

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizeOcr = (value) => String(value ?? '').normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '');
const requireThat = (condition, code) => { if (!condition) throw new Error(code); };
const CUE_SOURCE_PLAN_SCHEMA = 'koubo-director-cues-source-plan/v1';
const CUE_DYNAMIC_ACCEPTANCE_SCHEMA = 'koubo-cue-native-representative-dynamic-acceptance/v1';
const CUE_SAMPLE_POLICY = 'one-representative-scene';
const rejectFailure = (value) => {
  const issues = evidenceOutcomeIssues(value);
  requireThat(issues.length === 0, `RUNNINGHUB_${issues.join(':')}`);
};

const incidentRegistryPath = fileURLToPath(new URL(
  '../../koubo-remotion-director/references/paper-motion-incident-registry.v1.json', import.meta.url,
));

function readIncidentRegistry() {
  requireThat(existsSync(incidentRegistryPath), 'RUNNINGHUB_INCIDENT_REGISTRY_MISSING');
  const registry = readJson(incidentRegistryPath);
  requireThat(registry.schemaVersion === 'koubo-paper-motion-incident-registry/v1' &&
    registry.policy === 'negative-regression-only-never-successful-reuse' &&
    Array.isArray(registry.incidents) && registry.incidents.length > 0 &&
    registry.incidents.every((item) => /^[a-f0-9]{64}$/.test(item?.videoSha256 ?? '') && item.reusableSuccess === false),
  'RUNNINGHUB_INCIDENT_REGISTRY_INVALID');
  return {hashes: new Set(registry.incidents.map((item) => item.videoSha256)),
    binding: {path: incidentRegistryPath, sha256: sha256File(incidentRegistryPath)}};
}

function checkedPath(root, value, label) {
  requireThat(isText(value), `${label}_PATH_REQUIRED`);
  const candidate = resolveInside(root, value, label);
  requireThat(existsSync(candidate), `${label}_MISSING`);
  const resolved = realpathSync(candidate);
  resolveInside(realpathSync(root), resolved, label);
  requireThat(statSync(resolved).isFile(), `${label}_NOT_FILE`);
  return candidate;
}

function readBound(root, binding, label) {
  const file = checkedPath(root, binding?.path, label);
  requireThat(sha256File(file) === binding.sha256, `${label}_SHA_MISMATCH`);
  return readJson(file);
}

function sameBinding(root, left, right, label) {
  requireThat(left?.sha256 === right?.sha256 && isText(left?.path) && isText(right?.path) &&
    resolveInside(root, left.path, label) === resolveInside(root, right.path, label),
  `${label}_BINDING_MISMATCH`);
}

function cueSetSha256({sourcePlan, manifest}) {
  return sha256Json({
    schemaVersion: 'koubo-cue-native-motion-set/v1',
    sourcePlanCanonicalSha256: sha256Json(sourcePlan),
    scenes: manifest.scenes.map((scene) => ({
      sceneId: scene.sceneId,
      pairSha256: scene.pairSha256,
      imageToVideoPromptSha256: scene.imageToVideoPromptSha256,
      durationSeconds: scene.durationSeconds,
    })),
  });
}

function validateCueNativeUpstream({
  projectRoot,
  job,
  manifest,
  receipt,
  sourcePlan,
  firstFrames,
  authoritativeDirectorReceipt,
}) {
  requireThat([job, manifest, sourcePlan, firstFrames].every(
    (item) => item?.sourceDirectorSchema === DIRECTOR_CUES_SCHEMA,
  ), 'RUNNINGHUB_CUE_NATIVE_SOURCE_SCHEMA_BINDING_INVALID');
  requireThat(sourcePlan.schemaVersion === CUE_SOURCE_PLAN_SCHEMA &&
    firstFrames.schemaVersion === 'koubo-paper-first-frame-prompt-manifest/v1' &&
    manifest.schemaVersion === 'koubo-runninghub-image-to-video-prompt-manifest/v1',
  'RUNNINGHUB_CUE_NATIVE_SOURCE_SCHEMA_INVALID');
  requireThat([job, manifest, sourcePlan, firstFrames].every(
    (item) => item.samplePolicy === CUE_SAMPLE_POLICY,
  ), 'RUNNINGHUB_CUE_NATIVE_SAMPLE_POLICY_INVALID');
  const firstFrameErrors = validateManifest(firstFrames);
  requireThat(firstFrameErrors.length === 0,
    `RUNNINGHUB_CUE_NATIVE_FIRSTFRAME_MANIFEST_INVALID:${firstFrameErrors.join(':')}`);
  requireThat(sourcePlan.status === 'validated-provisional-previsualization' &&
    sourcePlan.formalEligible === false && manifest.submissionAllowed === false &&
    manifest.codexExternalSubmissionAllowed === false &&
    manifest.status === 'awaiting-text-baked-firstframes' &&
    manifest.executionOwner === 'user-manual' && Array.isArray(manifest.scenes) &&
    manifest.scenes.every((scene) => scene.generatedReadableTextAllowed === false &&
      scene.modelGeneratedReadableTextAllowed === false),
  'RUNNINGHUB_CUE_NATIVE_AUTHORITY_BOUNDARY_INVALID');
  requireThat(sourcePlan.calibrationPolicy?.plannedAnchorQuadsAreProvisional === true &&
    sourcePlan.calibrationPolicy?.actualGeneratedPaperSurfaceCalibrationRequired === true &&
    sourcePlan.calibrationPolicy?.provisionalAnchorsExcludedFromGenerationPrompts === true,
  'RUNNINGHUB_CUE_NATIVE_CALIBRATION_POLICY_INVALID');

  const directorReceipt = authoritativeDirectorReceipt ?? readBound(
    projectRoot,
    job.directorValidationReceipt,
    'CUE_NATIVE_DIRECTOR_RECEIPT',
  );
  requireThat(directorReceipt.schemaVersion === 'koubo-director-validation-receipt/v1' &&
    directorReceipt.status === 'validated-provisional-previsualization' &&
    directorReceipt.skillExecuted === true && directorReceipt.validatorExecuted === true &&
    directorReceipt.sourceDirectorSchema === DIRECTOR_CUES_SCHEMA &&
    directorReceipt.samplePolicy === CUE_SAMPLE_POLICY &&
    directorReceipt.taskId === job.taskId && directorReceipt.requestId === job.requestId &&
    directorReceipt.revisionId === job.revisionId,
  'RUNNINGHUB_CUE_NATIVE_DIRECTOR_RECEIPT_INVALID');
  sameBinding(projectRoot, directorReceipt.artifacts?.sourcePlan, receipt.sourcePlan,
    'CUE_NATIVE_SOURCE_PLAN');
  sameBinding(projectRoot, directorReceipt.artifacts?.firstFramePromptManifest, job.sourceManifest,
    'CUE_NATIVE_FIRSTFRAME_MANIFEST');
  const boundSourcePlan = readBound(projectRoot, directorReceipt.artifacts?.sourcePlan,
    'CUE_NATIVE_SOURCE_PLAN');
  const boundFirstFrames = readBound(projectRoot, directorReceipt.artifacts?.firstFramePromptManifest,
    'CUE_NATIVE_FIRSTFRAME_MANIFEST');
  const boundManifest = readBound(projectRoot, directorReceipt.artifacts?.runningHubPromptManifest,
    'CUE_NATIVE_RUNNINGHUB_MANIFEST');
  requireThat(sha256Json(boundSourcePlan) === sha256Json(sourcePlan) &&
    sha256Json(boundFirstFrames) === sha256Json(firstFrames) &&
    sha256Json(boundManifest) === sha256Json(manifest) &&
    directorReceipt.sourcePlanCanonicalSha256 === sha256Json(sourcePlan),
  'RUNNINGHUB_CUE_NATIVE_SIGNED_ARTIFACT_MISMATCH');

  const cuesPath = checkedPath(
    projectRoot,
    directorReceipt.artifacts?.directorCues?.path,
    'CUE_NATIVE_DIRECTOR_CUES',
  );
  requireThat(sha256File(cuesPath) === directorReceipt.artifacts.directorCues.sha256,
    'RUNNINGHUB_CUE_NATIVE_DIRECTOR_CUES_SHA_MISMATCH');
  const cueValidation = validateDirectorCuesFile({inputPath: cuesPath, projectRoot});
  requireThat(cueValidation.ok, `RUNNINGHUB_CUE_NATIVE_DIRECTOR_CUES_INVALID:${cueValidation.errors.join(':')}`);
  const cues = readJson(cuesPath);
  const cueSceneIds = cues.inserts.map((cue) => cue.id);
  const sceneIdsMatch = (scenes, selector) => Array.isArray(scenes) &&
    sha256Json(scenes.map(selector)) === sha256Json(cueSceneIds);
  requireThat(sourcePlan.paperScenes?.length === cueSceneIds.length &&
    firstFrames.sceneCount === cueSceneIds.length && manifest.sceneCount === cueSceneIds.length &&
    job.scenes?.length === cueSceneIds.length &&
    sceneIdsMatch(sourcePlan.paperScenes, (scene) => scene.beatId) &&
    sceneIdsMatch(firstFrames.scenes, (scene) => scene.sceneId) &&
    sceneIdsMatch(manifest.scenes, (scene) => scene.sceneId) &&
    sceneIdsMatch(job.scenes, (scene) => scene.sceneId),
  'RUNNINGHUB_CUE_NATIVE_SCENE_ORDER_INVALID');
  const bridgeAcceptance = readBound(
    projectRoot,
    directorReceipt.artifacts?.userAcceptance,
    'CUE_NATIVE_BRIDGE_ACCEPTANCE',
  );
  requireThat(bridgeAcceptance.schemaVersion === 'koubo-director-cues-user-acceptance/v1' &&
    bridgeAcceptance.status === 'approved-for-one-representative-firstframe' &&
    bridgeAcceptance.approved === true && bridgeAcceptance.scope === 'one-representative-firstframe' &&
    bridgeAcceptance.taskId === cues.taskId && bridgeAcceptance.requestId === job.requestId &&
    bridgeAcceptance.revisionId === job.revisionId &&
    bridgeAcceptance.cuesSha256 === sha256File(cuesPath) &&
    bridgeAcceptance.selectedSceneId === sourcePlan.selectedSceneId &&
    directorReceipt.selectedSceneId === sourcePlan.selectedSceneId &&
    firstFrames.selectedSceneId === sourcePlan.selectedSceneId &&
    manifest.selectedSceneId === sourcePlan.selectedSceneId &&
    Array.isArray(job.sampleSceneIds) && job.sampleSceneIds.length === 1 &&
    job.sampleSceneIds[0] === sourcePlan.selectedSceneId,
  'RUNNINGHUB_CUE_NATIVE_BRIDGE_ACCEPTANCE_INVALID');
  sameBinding(projectRoot, sourcePlan.userAcceptance, directorReceipt.artifacts.userAcceptance,
    'CUE_NATIVE_BRIDGE_ACCEPTANCE');
  sameBinding(projectRoot, sourcePlan.sourceDirectorCues, directorReceipt.artifacts.directorCues,
    'CUE_NATIVE_DIRECTOR_CUES');

  requireThat(Array.isArray(sourcePlan.paperScenes), 'RUNNINGHUB_CUE_NATIVE_SCENE_SET_INVALID');
  sourcePlan.paperScenes.forEach((scene, index) => {
    const cue = cues.inserts[index];
    requireThat(scene.beatId === cue.id && scene.spokenLine === cue.scriptQuote &&
      scene.durationSeconds === cue.durationSeconds && scene.visualRole === cue.visualRole &&
      scene.visualMetaphor === cue.visualMetaphor && scene.composition === cue.composition &&
      scene.primaryAction === cue.primaryAction && scene.prompt?.firstFrame === cue.firstFramePrompt &&
      scene.prompt?.motion === cue.videoPrompt,
    `RUNNINGHUB_CUE_NATIVE_PROMPT_NOT_EXACT:${cue.id}`);
    requireThat(sha256Json(scene.textPlan.map((entry) => ({text: entry.text, surface: entry.surfaceDescription}))) ===
      sha256Json(cue.textPlan) && sha256Json(scene.negativePrompt) === sha256Json(cue.negativePrompt) &&
      sha256Json(scene.referenceImageIds) === sha256Json(cue.referenceImageIds),
    `RUNNINGHUB_CUE_NATIVE_PLAN_NOT_EXACT:${cue.id}`);
    requireThat(scene.motionContract === undefined && scene.physicalContract === undefined &&
      scene.motionContractSha256 === undefined && scene.physicalContractSha256 === undefined,
    `RUNNINGHUB_CUE_NATIVE_LEGACY_CONTRACT_FORBIDDEN:${cue.id}`);
  });
  return {
    selectedSceneId: sourcePlan.selectedSceneId,
    cueSetSha256: cueSetSha256({sourcePlan, manifest}),
  };
}

function sceneMap(scenes, expectedIds, label, subset = false) {
  requireThat(Array.isArray(scenes) && scenes.length > 0, `RUNNINGHUB_SCENE_SET_INVALID:${label}`);
  const ids = scenes.map((scene) => scene?.sceneId);
  requireThat(new Set(ids).size === ids.length && ids.every((id) => expectedIds.includes(id)) &&
    (subset || ids.length === expectedIds.length), `RUNNINGHUB_SCENE_SET_INVALID:${label}`);
  return new Map(scenes.map((scene) => [scene.sceneId, scene]));
}

function checkApprovalAssets({acceptance, assets, projectRoot}) {
  const normalize = (items) => items.map((item) => ({
    sceneId: item.sceneId,
    path: resolveInside(projectRoot, item.path, 'ACCEPTANCE_ASSET'),
    sha256: item.sha256,
  })).sort((a, b) => a.sceneId.localeCompare(b.sceneId));
  requireThat(Array.isArray(acceptance.assets) && acceptance.assets.length === assets.length &&
    acceptance.assets.every((item) => isText(item?.path) && isText(item?.sceneId)),
  'TEXT_BAKED_USER_ACCEPTANCE_ASSETS_INVALID');
  const expected = sha256Json(normalize(assets));
  requireThat(sha256Json(normalize(acceptance.assets)) === expected && acceptance.assetSetSha256 === expected,
    'TEXT_BAKED_USER_ACCEPTANCE_ASSETS_INVALID');
  requireThat(isText(acceptance.userQuote) && isText(acceptance.approvedAt) && Number.isFinite(Date.parse(acceptance.approvedAt)),
    'TEXT_BAKED_USER_ACCEPTANCE_INVALID');
  return expected;
}

function validateCueNativeDynamicAcceptance({
  projectRoot,
  dynamicAcceptancePath,
  job,
  receipt,
  cueContext,
  jobs,
  motions,
  firstFrames,
}) {
  const dynamicPath = checkedPath(projectRoot, dynamicAcceptancePath, 'CUE_NATIVE_DYNAMIC_ACCEPTANCE');
  const dynamic = readJson(dynamicPath);
  rejectFailure(dynamic);
  requireThat(dynamic.schemaVersion === CUE_DYNAMIC_ACCEPTANCE_SCHEMA &&
    dynamic.status === 'representative-cue-set-approved' && dynamic.approved === true &&
    dynamic.scope === 'current-cue-set-after-representative-trial' &&
    dynamic.batchHandoffApproved === true && dynamic.externalSubmissionAuthorized === false &&
    dynamic.paidGenerationAuthorized === false && dynamic.taskId === job.taskId &&
    dynamic.requestId === job.requestId && dynamic.revisionId === job.revisionId &&
    dynamic.cueSetSha256 === cueContext.cueSetSha256 &&
    dynamic.sourcePlan?.sha256 === receipt.sourcePlan.sha256 && isText(dynamic.sourcePlan?.path) &&
    resolveInside(projectRoot, dynamic.sourcePlan.path, 'CUE_NATIVE_DYNAMIC_SOURCE_PLAN') ===
      resolveInside(projectRoot, receipt.sourcePlan.path, 'SOURCE_PLAN') &&
    isText(dynamic.userQuote) && isText(dynamic.approvedAt) && Number.isFinite(Date.parse(dynamic.approvedAt)) &&
    Array.isArray(dynamic.representatives) && dynamic.representatives.length === 1 &&
    dynamic.representatives[0]?.sceneId === cueContext.selectedSceneId,
  'RUNNINGHUB_CUE_NATIVE_DYNAMIC_ACCEPTANCE_INVALID');
  sameBinding(projectRoot, dynamic.sampleUserAcceptanceReceipt,
    job.sampleUserAcceptanceReceipt, 'CUE_NATIVE_DYNAMIC_SAMPLE_ACCEPTANCE');
  const sampleAcceptanceErrors = validateCueNativeSampleAcceptanceBinding(job, firstFrames);
  requireThat(sampleAcceptanceErrors.length === 0,
    `RUNNINGHUB_CUE_NATIVE_SAMPLE_ACCEPTANCE_INVALID:${sampleAcceptanceErrors.join(':')}`);

  const negativeIncidents = readIncidentRegistry();
  const alreadyAccepted = new Map();
  const approvedAssets = [];
  for (const sample of dynamic.representatives) {
    const jobScene = jobs.get(sample.sceneId);
    const motion = motions.get(sample.sceneId);
    requireThat(jobScene && motion && !negativeIncidents.hashes.has(sample.video?.sha256),
      'RUNNINGHUB_CUE_NATIVE_DYNAMIC_ACCEPTANCE_INVALID');
    const imagePath = checkedPath(projectRoot, jobScene.deterministicTextBake.outputPath,
      'CUE_NATIVE_DYNAMIC_FIRSTFRAME');
    const asset = {sceneId: sample.sceneId, path: imagePath, sha256: sha256File(imagePath)};
    requireThat(sample.approved === true && isText(sample.userQuote) && isText(sample.approvedAt) &&
      Number.isFinite(Date.parse(sample.approvedAt)) && sample.pairSha256 === motion.pairSha256 &&
      sample.imageToVideoPromptSha256 === motion.imageToVideoPromptSha256 &&
      sample.motionContractSha256 === undefined && sample.inputFirstFrame?.sha256 === asset.sha256 &&
      isText(sample.inputFirstFrame?.path) &&
      resolveInside(projectRoot, sample.inputFirstFrame.path, 'CUE_NATIVE_DYNAMIC_FIRSTFRAME') === asset.path &&
      sample.checks?.normalSpeedSilentMeaningCorrect === true &&
      sample.checks?.spokenMeaningConsistent === true &&
      sample.checks?.labelsReadableThroughout === true,
    'RUNNINGHUB_CUE_NATIVE_DYNAMIC_ACCEPTANCE_INVALID');
    const videoPath = checkedPath(projectRoot, sample.video?.path, 'CUE_NATIVE_DYNAMIC_VIDEO');
    requireThat(sha256File(videoPath) === sample.video.sha256,
      'RUNNINGHUB_CUE_NATIVE_DYNAMIC_VIDEO_SHA_MISMATCH');
    alreadyAccepted.set(sample.sceneId, {
      sceneId: sample.sceneId,
      video: sample.video,
      inputFirstFrame: asset,
      acceptance: {path: dynamicPath, sha256: sha256File(dynamicPath)},
      disposition: 'reuse-accepted-source',
      regenerationAllowed: false,
    });
    approvedAssets.push(asset);
  }
  approvedAssets.sort((a, b) => a.sceneId.localeCompare(b.sceneId));
  requireThat(dynamic.assetSetSha256 === sha256Json(approvedAssets),
    'RUNNINGHUB_CUE_NATIVE_DYNAMIC_ACCEPTANCE_ASSETS_INVALID');
  return {
    alreadyAccepted,
    dynamicValidation: {
      status: 'representative-cue-set-accepted',
      acceptedCueSetSha256: cueContext.cueSetSha256,
      acceptance: {path: dynamicPath, sha256: sha256File(dynamicPath)},
      negativeIncidentRegistry: negativeIncidents.binding,
    },
  };
}

export function validateIncidentHandoff({
  projectRoot,
  job,
  manifest,
  receipt,
  acceptance,
  scope,
  dynamicAcceptancePath,
  sceneId: requestedSceneId,
  preparationAuthorization,
  authoritativeSourceManifest,
  authoritativeDirectorReceipt,
}) {
  const preparationOnly = scope === 'canvas-preparation';
  if (preparationOnly) {
    requireThat(!acceptance && !dynamicAcceptancePath && !requestedSceneId,
      'CANVAS_PREPARATION_MUST_NOT_CLAIM_ACCEPTANCE');
    requireThat(preparationAuthorization?.schemaVersion === 'koubo-canvas-preparation-authorization/v1' &&
      preparationAuthorization.status === 'authorized-for-canvas-preparation' &&
      preparationAuthorization.taskId === job.taskId && preparationAuthorization.requestId === job.requestId &&
      preparationAuthorization.revisionId === job.revisionId &&
      preparationAuthorization.sourceManifest?.path === job.sourceManifest?.path &&
      preparationAuthorization.sourceManifest?.sha256 === job.sourceManifest?.sha256 &&
      sha256Json(preparationAuthorization.sceneIds) === sha256Json(job.scenes.map((scene) => scene.sceneId)) &&
      preparationAuthorization.uploadAllowed === true && preparationAuthorization.canvasConfigurationAllowed === true &&
      preparationAuthorization.submissionAllowed === false && preparationAuthorization.paidGenerationAllowed === false &&
      preparationAuthorization.userAcceptance === 'pending' && isText(preparationAuthorization.userQuote) &&
      isText(preparationAuthorization.recordedAt) && Number.isFinite(Date.parse(preparationAuthorization.recordedAt)),
    'CANVAS_PREPARATION_AUTHORIZATION_INVALID');
  }
  // Read the upstream policy before choosing compatibility mode. Removing the job flag cannot downgrade it.
  const sourcePlan = receipt.sourcePlan ? readBound(projectRoot, receipt.sourcePlan, 'SOURCE_PLAN') : null;
  const firstFrames = authoritativeSourceManifest ??
    (job.sourceManifest ? readBound(projectRoot, job.sourceManifest, 'SOURCE_MANIFEST') : null);
  const versions = [job, manifest, firstFrames, sourcePlan].map((item) => item?.policy?.incidentPreventionVersion);
  requireThat(versions.every((version) => version === undefined || version === '1'), 'INCIDENT_POLICY_VERSION_INVALID');
  const profilePath = path.join(projectRoot, 'workflow/active-director-profile.v1.json');
  const profile = existsSync(profilePath) ? readJson(checkedPath(projectRoot, profilePath, 'DIRECTOR_PROFILE')) : null;
  const enabled = versions.includes('1') || profile?.incidentPreventionPolicy?.requiredForNewPreproduction === true;
  if (!enabled) {
    requireThat(scope === 'batch' && !dynamicAcceptancePath, 'INCIDENT_POLICY_REQUIRED_FOR_DYNAMIC_HANDOFF');
    return null;
  }
  requireThat([sourcePlan, firstFrames, manifest].every((item) => item?.policy?.incidentPreventionVersion === '1'),
    'INCIDENT_UPSTREAM_POLICY_REQUIRED');
  const declaredSourceSchemas = [job, manifest, firstFrames, sourcePlan]
    .map((item) => item?.sourceDirectorSchema)
    .filter((value) => value !== undefined);
  const cueNative = authoritativeSourceManifest
    ? firstFrames?.sourceDirectorSchema === DIRECTOR_CUES_SCHEMA
    : declaredSourceSchemas.includes(DIRECTOR_CUES_SCHEMA);
  requireThat(
    cueNative
      ? declaredSourceSchemas.every((value) => value === DIRECTOR_CUES_SCHEMA)
      : !declaredSourceSchemas.includes(DIRECTOR_CUES_SCHEMA),
    'RUNNINGHUB_CUE_NATIVE_SOURCE_SCHEMA_BINDING_INVALID');
  let cueContext = null;
  if (cueNative) {
    cueContext = validateCueNativeUpstream({
      projectRoot,
      job,
      manifest,
      receipt,
      sourcePlan,
      firstFrames,
      authoritativeDirectorReceipt,
    });
  } else {
    requireThat(sourcePlan.schemaVersion === 'koubo-director-preproduction-plan/v1' &&
      firstFrames.schemaVersion === 'koubo-paper-first-frame-prompt-manifest/v1' &&
      manifest.schemaVersion === 'koubo-runninghub-image-to-video-prompt-manifest/v1',
    'RUNNINGHUB_SOURCE_SCHEMA_INVALID');
    requireThat(/^[a-f0-9]{64}$/.test(sourcePlan.provenance?.scriptSha256 ?? ''),
      'RUNNINGHUB_SOURCE_SCRIPT_SHA_REQUIRED');
  }
  requireThat(['batch', 'first-trial', 'canvas-preparation'].includes(scope), 'RUNNINGHUB_HANDOFF_SCOPE_INVALID');
  if (cueNative) {
    const sampleAcceptanceErrors = validateCueNativeSampleAcceptanceBinding(job, firstFrames);
    requireThat(sampleAcceptanceErrors.length === 0,
      `RUNNINGHUB_CUE_NATIVE_SAMPLE_ACCEPTANCE_INVALID:${sampleAcceptanceErrors.join(':')}`);
    if (['batch', 'canvas-preparation'].includes(scope)) {
      assertFullBatchAuthorized(job, `RUNNINGHUB_${scope.toUpperCase()}`, firstFrames);
    }
  }
  requireThat(isText(job.taskId) && isText(job.requestId) && isText(job.revisionId) &&
    sourcePlan.taskId === job.taskId && sourcePlan.requestId === job.requestId &&
    sourcePlan.revisionId === job.revisionId && receipt.taskId === job.taskId &&
    (preparationOnly ? preparationAuthorization : acceptance)?.revisionId === job.revisionId &&
    [firstFrames, manifest].every((item) => item.taskId === job.taskId && item.requestId === job.requestId && item.revisionId === job.revisionId),
  'RUNNINGHUB_SOURCE_IDENTITY_INVALID');
  requireThat(firstFrames.status === 'automation-input-ready', 'RUNNINGHUB_FIRSTFRAME_MANIFEST_INVALID');
  for (const value of [job, sourcePlan, firstFrames, manifest, receipt, acceptance, preparationAuthorization]) rejectFailure(value);
  const planSha = sha256Json(sourcePlan);
  requireThat(firstFrames.sourcePlanCanonicalSha256 === planSha && manifest.sourcePlanCanonicalSha256 === planSha,
    'RUNNINGHUB_SOURCE_PLAN_CANONICAL_SHA_MISMATCH');
  requireThat(Array.isArray(sourcePlan.paperScenes) && sourcePlan.paperScenes.length > 0, 'RUNNINGHUB_SOURCE_SCENES_EMPTY');
  const identities = sourcePlan.paperScenes.map((scene, index) => buildSceneIdentity(scene, index, {
    v9ContractEnabled: sourcePlan.v9Contract?.enabled === true,
  }));
  const ids = identities.map((identity) => identity.sceneId);
  const jobs = sceneMap(job.scenes, ids, 'job');
  const frames = sceneMap(firstFrames.scenes, ids, 'first-frame-manifest');
  const motions = sceneMap(manifest.scenes, ids, 'motion-manifest');
  const baked = sceneMap(receipt.scenes, ids, 'text-bake-receipt', scope === 'first-trial');
  requireThat(!requestedSceneId || (scope === 'first-trial' && ids.includes(requestedSceneId)), 'RUNNINGHUB_TRIAL_SCENE_INVALID');
  if (cueNative && scope === 'first-trial') {
    requireThat(requestedSceneId === cueContext.selectedSceneId && receipt.scenes.length === 1 &&
      receipt.scenes[0]?.sceneId === cueContext.selectedSceneId,
    'RUNNINGHUB_CUE_NATIVE_TRIAL_MUST_USE_SELECTED_SCENE');
  }
  let selectedIds = scope === 'first-trial'
    ? [cueNative ? cueContext.selectedSceneId : (requestedSceneId ?? ids[0])]
    : ids;
  const contracts = new Map();

  identities.forEach((identity, index) => {
    const scene = jobs.get(identity.sceneId);
    const frame = frames.get(identity.sceneId);
    const motion = motions.get(identity.sceneId);
    const source = sourcePlan.paperScenes[index];
    requireThat(isText(frame.firstFramePrompt) && sha256Text(frame.firstFramePrompt) === frame.firstFramePromptSha256 &&
      isText(motion.imageToVideoPrompt) && sha256Text(motion.imageToVideoPrompt) === motion.imageToVideoPromptSha256,
    `RUNNINGHUB_PROMPT_SHA_MISMATCH:${identity.sceneId}`);
    requireThat([scene, frame, motion].every((item) => item.pairId === identity.pairId && item.pairSha256 === identity.pairSha256) &&
      frame.firstFramePromptSha256 === identity.firstFramePromptSha256 &&
      motion.inputFirstFramePromptSha256 === identity.firstFramePromptSha256 &&
      motion.imageToVideoPromptSha256 === identity.imageToVideoPromptSha256 &&
      motion.inputFirstFrameTextPlanSha256 === identity.textPlanSha256 &&
      [scene, frame].every((item) => item.textPlanSha256 === identity.textPlanSha256),
    `RUNNINGHUB_PAIR_PLAN_MISMATCH:${identity.sceneId}`);
    if (cueNative) {
      requireThat(frame.motionContract === undefined && frame.physicalContract === undefined &&
        motion.motionContractSha256 === undefined && motion.dynamicValidation === undefined,
      `RUNNINGHUB_CUE_NATIVE_LEGACY_CONTRACT_FORBIDDEN:${identity.sceneId}`);
    } else {
      const meaningReview = readBound(projectRoot, source.motionContract?.semanticReview,
        'PAPER_SEMANTIC_REVIEW_FILE_OR_SHA_INVALID');
      rejectFailure(meaningReview);
      const reviewed = validatePaperMeaningReview({projectRoot,
        request: {taskId: sourcePlan.taskId, revisionId: sourcePlan.revisionId,
          inputScript: {sha256: sourcePlan.provenance?.scriptSha256}},
        beat: {id: source.beatId, paperScene: source, spokenLine: source.spokenLine},
      });
      requireThat(reviewed.ok, `RUNNINGHUB_${reviewed.errors.join(':')}`);
      requireThat(source.motionContract?.schemaVersion === 'koubo-paper-motion-contract/v1' &&
        source.prompt?.firstFrame === renderMotionFirstFrame(source) &&
        source.prompt?.motion === renderMotionPrompt(source),
      `RUNNINGHUB_SOURCE_PROMPT_NOT_COMPILED:${identity.sceneId}`);
      requireThat(source.motionContract && typeof source.motionContract === 'object' &&
        !Array.isArray(source.motionContract) && Object.keys(source.motionContract).length > 0 &&
        motion.motionContractSha256 === sha256Json(source.motionContract),
      `RUNNINGHUB_MOTION_CONTRACT_SHA_MISMATCH:${identity.sceneId}`);
      requireThat(motion.dynamicValidation?.requiredBeforeBatch === true &&
        motion.dynamicValidation?.staticApprovalIsNotDynamicApproval === true &&
        motion.dynamicValidation?.automaticRetryAllowed === false &&
        sha256Json(motion.dynamicValidation) === sha256Json(source.motionContract.dynamicValidation),
      `RUNNINGHUB_DYNAMIC_POLICY_INVALID:${identity.sceneId}`);
      contracts.set(identity.sceneId, motion.motionContractSha256);
    }
    requireThat(Number.isFinite(motion.durationSeconds) && motion.durationSeconds > 0 && motion.durationSeconds === source.durationSeconds,
      `RUNNINGHUB_DURATION_PLAN_MISMATCH:${identity.sceneId}`);
  });

  const assets = selectedIds.map((sceneId) => {
    const scene = jobs.get(sceneId);
    const item = baked.get(sceneId);
    const index = ids.indexOf(sceneId);
    const identity = identities[index];
    const labels = sourcePlan.paperScenes[index].textPlan.filter((label) => label.embeddingMode === 'first-frame-baked');
    requireThat(item && item.pairId === identity.pairId && item.pairSha256 === identity.pairSha256 &&
      item.textPlanSha256 === identity.textPlanSha256 && scene.deterministicTextBake?.enabled === true &&
      sha256Json(scene.deterministicTextBake.labels) === sha256Json(labels) &&
      scene.deterministicTextBake.labelsSha256 === sha256Json(labels) && item.labelsSha256 === sha256Json(labels) &&
      sha256Json(frames.get(sceneId).deterministicTextBake?.labels) === sha256Json(labels) &&
      frames.get(sceneId).deterministicTextBake?.labelsSha256 === sha256Json(labels),
    `RUNNINGHUB_PAIR_PLAN_MISMATCH:${sceneId}`);
    const imagePath = checkedPath(projectRoot, item.outputImage?.path, 'TEXT_BAKED_IMAGE');
    requireThat(imagePath === resolveInside(projectRoot, scene.deterministicTextBake.outputPath, 'TEXT_BAKED_IMAGE') &&
      sha256File(imagePath) === item.outputImage.sha256, `RUNNINGHUB_IMAGE_SHA_MISMATCH:${sceneId}`);
    const nodeIds = labels.map((label) => label.nodeId);
    requireThat(nodeIds.length > 0 && nodeIds.every(isText) && new Set(nodeIds).size === nodeIds.length &&
      Array.isArray(item.ocr) && item.ocr.length === nodeIds.length &&
      new Set(item.ocr.map((row) => row?.nodeId)).size === nodeIds.length &&
      item.ocr.every((row) => nodeIds.includes(row?.nodeId)), `RUNNINGHUB_OCR_COVERAGE_INVALID:${sceneId}`);
    for (const label of labels) {
      const row = item.ocr.find((entry) => entry.nodeId === label.nodeId);
      requireThat(isText(label.text) && label.ocrRequired === true && row.matched === true && row.expected === label.text &&
        normalizeOcr(row.recognized).length > 0 && normalizeOcr(row.recognized) === normalizeOcr(label.text) &&
        row.evaluationStage === 'final-composite' && row.inputImageSha256 === item.outputImage.sha256,
      `RUNNINGHUB_OCR_EVIDENCE_INVALID:${sceneId}:${label.nodeId}`);
    }
    return {sceneId, path: imagePath, sha256: item.outputImage.sha256};
  });
  let dynamicValidation = {status: 'pending', acceptedMechanismSha256s: []};
  let alreadyAccepted = new Map();
  if (cueNative) {
    if (scope === 'batch') {
      requireThat(dynamicAcceptancePath, 'RUNNINGHUB_CUE_NATIVE_DYNAMIC_ACCEPTANCE_REQUIRED');
      const cueDynamic = validateCueNativeDynamicAcceptance({
        projectRoot,
        dynamicAcceptancePath,
        job,
        receipt,
        cueContext,
        jobs,
        motions,
        firstFrames,
      });
      alreadyAccepted = cueDynamic.alreadyAccepted;
      dynamicValidation = cueDynamic.dynamicValidation;
    } else {
      requireThat(!dynamicAcceptancePath, 'RUNNINGHUB_CUE_NATIVE_DYNAMIC_ACCEPTANCE_SCOPE_INVALID');
    }
  } else if (scope === 'batch') {
    requireThat(dynamicAcceptancePath, 'RUNNINGHUB_DYNAMIC_ACCEPTANCE_REQUIRED');
  }
  if (!cueNative && dynamicAcceptancePath) {
    const fullAssetSetSha256 = sha256Json(assets);
    const dynamicPath = checkedPath(projectRoot, dynamicAcceptancePath, 'DYNAMIC_ACCEPTANCE');
    const input = readJson(dynamicPath);
    rejectFailure(input);
    const records = input.schemaVersion === 'koubo-paper-dynamic-acceptance-index/v1'
      ? input.acceptances
      : [{path: dynamicPath, sha256: sha256File(dynamicPath)}];
    requireThat(Array.isArray(records) && records.length > 0, 'RUNNINGHUB_DYNAMIC_ACCEPTANCE_INVALID');
    const negativeIncidents = readIncidentRegistry();
    const covered = new Set();
    for (const record of records) {
      const dynamic = readBound(projectRoot, record, 'DYNAMIC_ACCEPTANCE');
      rejectFailure(dynamic);
      requireThat(dynamic.schemaVersion === 'koubo-paper-representative-dynamic-acceptance/v1' &&
      dynamic.status === 'representative-dynamics-approved' && dynamic.approved === true &&
      dynamic.taskId === job.taskId && dynamic.requestId === job.requestId && dynamic.revisionId === job.revisionId &&
      dynamic.sourcePlan?.sha256 === receipt.sourcePlan.sha256 &&
      isText(dynamic.sourcePlan?.path) &&
      resolveInside(projectRoot, dynamic.sourcePlan.path, 'DYNAMIC_SOURCE_PLAN') === resolveInside(projectRoot, receipt.sourcePlan.path, 'SOURCE_PLAN') &&
      Array.isArray(dynamic.representatives) && dynamic.representatives.length > 0,
    'RUNNINGHUB_DYNAMIC_ACCEPTANCE_INVALID');
    const approvedAssets = [];
    for (const sample of dynamic.representatives) {
      requireThat(!negativeIncidents.hashes.has(sample.video?.sha256), 'RUNNINGHUB_DYNAMIC_NEGATIVE_INCIDENT_SOURCE_FORBIDDEN');
      const jobScene = jobs.get(sample.sceneId);
      const motion = motions.get(sample.sceneId);
      requireThat(jobScene && !alreadyAccepted.has(sample.sceneId), 'RUNNINGHUB_DYNAMIC_ACCEPTANCE_INVALID');
      const imagePath = checkedPath(projectRoot, jobScene.deterministicTextBake.outputPath, 'DYNAMIC_FIRSTFRAME');
      const asset = {sceneId: sample.sceneId, path: imagePath, sha256: sha256File(imagePath)};
      requireThat(sample.approved === true &&
        isText(sample.userQuote) && isText(sample.approvedAt) && Number.isFinite(Date.parse(sample.approvedAt)) &&
        sample.pairSha256 === motion.pairSha256 && sample.imageToVideoPromptSha256 === motion.imageToVideoPromptSha256 &&
        sample.motionContractSha256 === contracts.get(sample.sceneId) &&
        sample.inputFirstFrame?.sha256 === asset.sha256 && isText(sample.inputFirstFrame?.path) &&
        resolveInside(projectRoot, sample.inputFirstFrame.path, 'DYNAMIC_FIRSTFRAME') === asset.path &&
        sample.checks?.normalSpeedSilentMeaningCorrect === true && sample.checks?.spokenMeaningConsistent === true &&
        sample.checks?.labelsReadableThroughout === true, 'RUNNINGHUB_DYNAMIC_ACCEPTANCE_INVALID');
      const videoPath = checkedPath(projectRoot, sample.video?.path, 'DYNAMIC_VIDEO');
      requireThat(sha256File(videoPath) === sample.video.sha256, 'RUNNINGHUB_DYNAMIC_VIDEO_SHA_MISMATCH');
      alreadyAccepted.set(sample.sceneId, {sceneId: sample.sceneId, video: sample.video,
        inputFirstFrame: asset, acceptance: record, disposition: 'reuse-accepted-source', regenerationAllowed: false});
      approvedAssets.push(asset);
      covered.add(contracts.get(sample.sceneId));
    }
    approvedAssets.sort((a, b) => a.sceneId.localeCompare(b.sceneId));
    requireThat(dynamic.assetSetSha256 === sha256Json(approvedAssets) ||
      (scope === 'batch' && dynamic.assetSetSha256 === fullAssetSetSha256), 'RUNNINGHUB_DYNAMIC_ACCEPTANCE_ASSETS_INVALID');
    }
    if (scope === 'batch') requireThat([...contracts.values()].every((hash) => covered.has(hash)), 'RUNNINGHUB_DYNAMIC_MECHANISM_COVERAGE_MISSING');
    if (scope === 'first-trial') requireThat(!alreadyAccepted.has(selectedIds[0]), 'RUNNINGHUB_DYNAMIC_TRIAL_ALREADY_ACCEPTED');
    dynamicValidation = {
      status: scope === 'batch' ? 'representative-mechanisms-accepted' : 'pending', acceptedMechanismSha256s: [...covered],
      acceptance: {path: dynamicPath, sha256: sha256File(dynamicPath)},
      negativeIncidentRegistry: negativeIncidents.binding,
    };
  }
  if (scope === 'batch') selectedIds = selectedIds.filter((sceneId) => !alreadyAccepted.has(sceneId));
  const selectedAssets = assets.filter((asset) => selectedIds.includes(asset.sceneId));
  const assetSetSha256 = preparationOnly ? sha256Json(selectedAssets)
    : selectedAssets.length ? checkApprovalAssets({acceptance, assets: selectedAssets, projectRoot}) : sha256Json([]);
  return {selectedIds, assets: selectedAssets, metadata: {
    policy: {incidentPreventionVersion: '1'}, revisionId: job.revisionId, handoffScope: scope,
    sourcePlan: receipt.sourcePlan, sourcePlanCanonicalSha256: planSha, assetSetSha256,
    ...(cueNative ? {
      compatibilityMode: 'cue-native-no-legacy-motion-contract',
      sourceDirectorSchema: DIRECTOR_CUES_SCHEMA,
      cueSetSha256: cueContext.cueSetSha256,
      legacyMotionContractPresent: false,
      externalSubmissionAuthorization: 'required-separately',
    } : {compatibilityMode: 'v9-motion-contract'}),
    sourceSceneIds: ids, alreadyAcceptedScenes: [...alreadyAccepted.values()], remainingSceneIds: selectedIds,
    dynamicValidation, batchDynamicallyAccepted: false, paidGenerationAllowed: false,
    automaticRetryAllowed: false, formalEnabled: false, publicationEnabled: false,
  }};
}
