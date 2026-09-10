import {existsSync, realpathSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSceneIdentity, validatePaperMeaningReview} from '../../koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {evidenceOutcomeIssues} from '../../koubo-remotion-director/scripts/incident-evidence-core.mjs';
import {renderMotionFirstFrame, renderMotionPrompt} from '../../koubo-remotion-director/scripts/paper-motion-contract.mjs';
import {readJson, resolveInside, sha256File, sha256Json, sha256Text} from './firstframe-batch-core.mjs';

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizeOcr = (value) => String(value ?? '').normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '');
const requireThat = (condition, code) => { if (!condition) throw new Error(code); };
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

export function validateIncidentHandoff({projectRoot, job, manifest, receipt, acceptance, scope, dynamicAcceptancePath, sceneId: requestedSceneId, preparationAuthorization}) {
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
  const firstFrames = job.sourceManifest ? readBound(projectRoot, job.sourceManifest, 'SOURCE_MANIFEST') : null;
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
  requireThat(sourcePlan.schemaVersion === 'koubo-director-preproduction-plan/v1' &&
    firstFrames.schemaVersion === 'koubo-paper-first-frame-prompt-manifest/v1' &&
    manifest.schemaVersion === 'koubo-runninghub-image-to-video-prompt-manifest/v1', 'RUNNINGHUB_SOURCE_SCHEMA_INVALID');
  requireThat(/^[a-f0-9]{64}$/.test(sourcePlan.provenance?.scriptSha256 ?? ''), 'RUNNINGHUB_SOURCE_SCRIPT_SHA_REQUIRED');
  requireThat(['batch', 'first-trial', 'canvas-preparation'].includes(scope), 'RUNNINGHUB_HANDOFF_SCOPE_INVALID');
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
  let selectedIds = scope === 'first-trial' ? [requestedSceneId ?? ids[0]] : ids;
  const contracts = new Map();

  identities.forEach((identity, index) => {
    const scene = jobs.get(identity.sceneId);
    const frame = frames.get(identity.sceneId);
    const motion = motions.get(identity.sceneId);
    const source = sourcePlan.paperScenes[index];
    const meaningReview = readBound(projectRoot, source.motionContract?.semanticReview, 'PAPER_SEMANTIC_REVIEW_FILE_OR_SHA_INVALID');
    rejectFailure(meaningReview);
    const reviewed = validatePaperMeaningReview({projectRoot,
      request: {taskId: sourcePlan.taskId, revisionId: sourcePlan.revisionId,
        inputScript: {sha256: sourcePlan.provenance?.scriptSha256}},
      beat: {id: source.beatId, paperScene: source, spokenLine: source.spokenLine},
    });
    requireThat(reviewed.ok, `RUNNINGHUB_${reviewed.errors.join(':')}`);
    requireThat(source.motionContract?.schemaVersion === 'koubo-paper-motion-contract/v1' &&
      source.prompt?.firstFrame === renderMotionFirstFrame(source) && source.prompt?.motion === renderMotionPrompt(source),
    `RUNNINGHUB_SOURCE_PROMPT_NOT_COMPILED:${identity.sceneId}`);
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
    requireThat(source.motionContract && typeof source.motionContract === 'object' && !Array.isArray(source.motionContract) &&
      Object.keys(source.motionContract).length > 0 && motion.motionContractSha256 === sha256Json(source.motionContract),
    `RUNNINGHUB_MOTION_CONTRACT_SHA_MISMATCH:${identity.sceneId}`);
    requireThat(motion.dynamicValidation?.requiredBeforeBatch === true &&
      motion.dynamicValidation?.staticApprovalIsNotDynamicApproval === true &&
      motion.dynamicValidation?.automaticRetryAllowed === false &&
      sha256Json(motion.dynamicValidation) === sha256Json(source.motionContract.dynamicValidation),
    `RUNNINGHUB_DYNAMIC_POLICY_INVALID:${identity.sceneId}`);
    requireThat(Number.isFinite(motion.durationSeconds) && motion.durationSeconds > 0 && motion.durationSeconds === source.durationSeconds,
      `RUNNINGHUB_DURATION_PLAN_MISMATCH:${identity.sceneId}`);
    contracts.set(identity.sceneId, motion.motionContractSha256);
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
  const fullAssetSetSha256 = sha256Json(assets);
  let dynamicValidation = {status: 'pending', acceptedMechanismSha256s: []};
  const alreadyAccepted = new Map();
  if (scope === 'batch') requireThat(dynamicAcceptancePath, 'RUNNINGHUB_DYNAMIC_ACCEPTANCE_REQUIRED');
  if (dynamicAcceptancePath) {
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
    sourceSceneIds: ids, alreadyAcceptedScenes: [...alreadyAccepted.values()], remainingSceneIds: selectedIds,
    dynamicValidation, batchDynamicallyAccepted: false, paidGenerationAllowed: false,
    automaticRetryAllowed: false, formalEnabled: false, publicationEnabled: false,
  }};
}
