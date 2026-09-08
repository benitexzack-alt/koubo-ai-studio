import {readFileSync} from 'node:fs';
import {sha256File, sha256Json} from './preproduction-director-core.mjs';
import {resolveNativeEvidence} from './v9-native-preproduction-core.mjs';
import {evidenceOutcomeIssues} from './incident-evidence-core.mjs';
import {validateIncidentHandoff} from '../../koubo-paper-firstframe-producer/scripts/runninghub-handoff-incident-core.mjs';
import {JOB_SCHEMA, RUNNINGHUB_READY_PACK_SCHEMA, TEXT_BAKE_RECEIPT_SCHEMA} from '../../koubo-paper-firstframe-producer/scripts/firstframe-batch-core.mjs';

export const NATIVE_HANDOFF_FORMAT = 'runninghub-ready-pack-v1';
export const NATIVE_HANDOFF_KEYS = ['generationInventory', 'generationOwnershipReceipt'];

export function validateNativeGenerationHandoff({state, artifacts, projectRoot}) {
  const errors = [];
  const requireThat = (condition, code) => { if (!condition) throw new Error(code); };
  const sameBinding = (left, right) => left?.sha256 === right?.sha256 &&
    resolveNativeEvidence(projectRoot, left.path) === resolveNativeEvidence(projectRoot, right.path);
  const read = (binding) => {
    const file = resolveNativeEvidence(projectRoot, binding?.path);
    requireThat(sha256File(file) === binding.sha256, 'SOURCE_SHA_MISMATCH');
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    requireThat(evidenceOutcomeIssues(doc).length === 0, 'SOURCE_FAILURE_OR_EXCEPTION');
    return doc;
  };
  try {
    const pack = read(artifacts.generationInventory);
    requireThat(pack.schemaVersion === RUNNINGHUB_READY_PACK_SCHEMA &&
      pack.taskId === state.taskId && pack.revisionId === state.revisionId &&
      pack.requestId === state.preproductionRequestId && pack.policy?.incidentPreventionVersion === '1', 'PACK_IDENTITY_INVALID');
    requireThat(pack.codexSubmissionAllowed === false && pack.paidGenerationAllowed === false &&
      pack.formalEnabled === false && pack.publicationEnabled === false &&
      pack.batchDynamicallyAccepted === false && pack.externalSubmissionOwner === 'user', 'PACK_AUTHORIZATION_INVALID');
    requireThat(sameBinding(pack.sourceRunningHubManifest, artifacts.imageToVideoPromptManifest) &&
      sameBinding(pack.userAcceptance, artifacts.generationOwnershipReceipt), 'PACK_STATE_BINDING_MISMATCH');
    const manifest = read(pack.sourceRunningHubManifest);
    const job = read(pack.sourceJob);
    const receipt = read(pack.textBakeReceipt);
    const acceptance = read(pack.userAcceptance);
    requireThat(job.schemaVersion === JOB_SCHEMA && sameBinding(job.sourceManifest, artifacts.firstFramePromptManifest) &&
      sameBinding(receipt.sourcePlan, artifacts.directorPlan) &&
      job.textBakeReceipts?.some((item) => sameBinding(item.receipt, pack.textBakeReceipt)), 'JOB_STATE_BINDING_MISMATCH');
    requireThat(receipt.schemaVersion === TEXT_BAKE_RECEIPT_SCHEMA &&
      receipt.status === 'deterministic-first-frame-text-baked-and-ocr-passed', 'BAKE_RECEIPT_INVALID');
    requireThat(acceptance.approved === true && acceptance.status === 'approved-for-runninghub-manual' &&
      acceptance.taskId === state.taskId && acceptance.requestId === state.preproductionRequestId &&
      acceptance.scope === 'text-baked-first-frames', 'USER_ACCEPTANCE_INVALID');
    if (pack.dynamicValidation?.acceptance) read(pack.dynamicValidation.acceptance);
    const trial = pack.handoffScope === 'first-trial';
    requireThat(Array.isArray(pack.scenes) && (!trial || pack.scenes.length === 1), 'PACK_SCENES_INVALID');
    // Revalidate the same immutable inputs used by the ready CLI, without reissuing a pack.
    const checked = validateIncidentHandoff({projectRoot, job, manifest, receipt, acceptance,
      scope: pack.handoffScope, sceneId: trial ? pack.scenes[0]?.sceneId : undefined,
      dynamicAcceptancePath: pack.dynamicValidation?.acceptance?.path});
    requireThat(checked && Object.entries(checked.metadata).every(([key, value]) =>
      sha256Json(pack[key]) === sha256Json(value)), 'PACK_METADATA_MISMATCH');
    requireThat(pack.sceneCount === checked.selectedIds.length && pack.scenes.length === checked.selectedIds.length &&
      (!pack.scenes.length || sha256Json(acceptance.sceneIds) === sha256Json(checked.selectedIds)), 'PACK_SCENE_SET_MISMATCH');
    requireThat(pack.status === (!pack.scenes.length ? 'no-generation-required' : trial
      ? 'ready-for-runninghub-first-trial-manual' : 'ready-for-runninghub-manual'), 'PACK_STATUS_INVALID');
    pack.scenes.forEach((scene, index) => {
      const expected = manifest.scenes.find((item) => item.sceneId === checked.selectedIds[index]);
      const image = checked.assets[index];
      requireThat(scene.sceneId === checked.selectedIds[index] && sameBinding(scene.inputFirstFrame, image) &&
        scene.pairId === expected.pairId && scene.pairSha256 === expected.pairSha256 &&
        scene.imageToVideoPrompt === expected.imageToVideoPrompt && scene.imageToVideoPromptSha256 === expected.imageToVideoPromptSha256 &&
        scene.motionContractSha256 === expected.motionContractSha256 && scene.durationSeconds === expected.durationSeconds &&
        scene.textPlanSha256 === expected.inputFirstFrameTextPlanSha256 && scene.textOcrPassed === true &&
        sha256Json(scene.dynamicValidation) === sha256Json(expected.dynamicValidation), 'PACK_SCENE_CONTENT_MISMATCH');
    });
  } catch (error) { errors.push(`V9_NATIVE_HANDOFF_INVALID:${error.message}`); }
  return {ok: errors.length === 0, errors};
}
