import {readFileSync, realpathSync, statSync} from 'node:fs';
import path from 'node:path';
import {
  buildAiGeneratedVideoPromptManifest, buildFirstFramePromptManifest, buildRouteLock,
  buildRunningHubPromptManifest, compilePreproductionPlan, renderAssetSheet,
  renderAiGeneratedVideoPromptSheet, renderRunningHubPromptSheet, sha256File, sha256Json,
  validatePreproductionRequest, validatePromptHandoffManifests,
} from './preproduction-director-core.mjs';
import {evidenceOutcomeIssues} from './incident-evidence-core.mjs';

export const NATIVE_PREPRODUCTION_ARTIFACTS = Object.freeze({
  directorRequest: {schema: 'koubo-director-preproduction-request/v1', status: 'candidate-preview-required'},
  directorPlan: {schema: 'koubo-director-preproduction-plan/v1', status: 'provisional-previsualization', output: 'planPath'},
  directorValidation: {schema: 'koubo-director-validation-receipt/v1', status: 'validated-provisional-previsualization', output: 'validationReceiptPath'},
  firstFramePromptManifest: {schema: 'koubo-paper-first-frame-prompt-manifest/v1', status: 'automation-input-ready', output: 'firstFramePromptManifestPath'},
  imageToVideoPromptManifest: {schema: 'koubo-runninghub-image-to-video-prompt-manifest/v1', status: 'awaiting-text-baked-firstframes', output: 'runningHubPromptManifestPath'},
  aiVideoPromptManifest: {schema: 'koubo-ai-generated-video-prompt-manifest/v1', statuses: ['not-required', 'manual-execution-required'], output: 'aiGeneratedVideoPromptManifestPath'},
  directorRouteLock: {schema: 'koubo-director-route-lock/v1', output: 'routeLockPath'},
  directorCompileReceipt: {schema: 'koubo-director-compile-receipt/v1', output: 'compileReceiptPath'},
});

export function resolveNativeEvidence(root, declared) {
  if (typeof declared !== 'string' || !declared.trim()) throw new Error('NATIVE_EVIDENCE_PATH_REQUIRED');
  const resolvedRoot = realpathSync(root);
  const file = realpathSync(path.resolve(root, declared));
  if (!file.startsWith(`${resolvedRoot}${path.sep}`) || !statSync(file).isFile()) {
    throw new Error('NATIVE_EVIDENCE_OUTSIDE_PROJECT_OR_NOT_FILE');
  }
  return file;
}

export function validateNativePreproductionBundle({state, artifacts, projectRoot}) {
  const errors = [];
  const fail = (condition, code, key = 'directorRequest') => {
    if (!condition) errors.push(`V9_${code}:director-prompt-packs-ready:${key}`);
  };
  const docs = {};
  const files = {};
  const read = (declared) => JSON.parse(readFileSync(resolveNativeEvidence(projectRoot, declared), 'utf8'));
  const sameBinding = (declared, actual) => {
    try {
      return declared?.sha256 === actual?.sha256 &&
        resolveNativeEvidence(projectRoot, declared.path) === resolveNativeEvidence(projectRoot, actual.path) &&
        sha256File(resolveNativeEvidence(projectRoot, actual.path)) === actual.sha256;
    } catch { return false; }
  };
  for (const [key, contract] of Object.entries(NATIVE_PREPRODUCTION_ARTIFACTS)) {
    try {
      files[key] = resolveNativeEvidence(projectRoot, artifacts[key]?.path);
      fail(sha256File(files[key]) === artifacts[key].sha256, 'ARTIFACT_SHA_MISMATCH', key);
      const doc = docs[key] = read(artifacts[key].path);
      fail(doc?.schemaVersion === contract.schema, 'CONTENT_SCHEMA_INVALID', key);
      if (contract.status || contract.statuses) {
        fail((contract.statuses ?? [contract.status]).includes(doc?.status), 'CONTENT_STATUS_INVALID', key);
      }
      fail(doc?.taskId === state.taskId, 'CONTENT_TASK_MISMATCH', key);
      fail(typeof state.preproductionRequestId === 'string' && state.preproductionRequestId.trim() &&
        doc?.requestId === state.preproductionRequestId, 'NATIVE_REQUEST_REVISION_MISMATCH', key);
      fail(doc?.revisionId === state.revisionId, 'CONTENT_REVISION_MISMATCH', key);
      fail(doc?.phase === 'pre-shoot', 'NATIVE_PHASE_INVALID', key);
      fail(doc?.policy?.incidentPreventionVersion === '1', 'NATIVE_POLICY_REQUIRED', key);
      for (const issue of evidenceOutcomeIssues(doc)) fail(false, issue, key);
    } catch (error) { fail(false, `NATIVE_ARTIFACT_INVALID:${error.message}`, key); }
  }
  if (errors.length) return {ok: false, errors};
  const request = docs.directorRequest;
  const plan = docs.directorPlan;
  const compiled = docs.directorCompileReceipt;
  const validated = docs.directorValidation;
  try {
    fail(sameBinding(request.inputScript, artifacts.script), 'CONTENT_BINDING_MISMATCH:script');
    // Both the unchanged user confirmation and native producer identity must bind this revision.
    const confirmation = read(artifacts.scriptUserConfirmation.path);
    fail(confirmation.taskId === state.taskId && confirmation.revisionId === state.revisionId,
      'CONTENT_REVISION_MISMATCH', 'scriptUserConfirmation');
    const profile = read(request.directorProfile.path);
    const style = read(profile.style.path);
    const input = validatePreproductionRequest({request, projectRoot, profile});
    fail(input.ok, `NATIVE_REQUEST_INVALID:${input.errors.join('|')}`);
    fail(profile.profileId === state.directorProfile.profileId && profile.profileVersion === state.directorProfile.profileVersion,
      'NATIVE_PROFILE_MISMATCH');
    const requestPath = path.resolve(projectRoot, artifacts.directorRequest.path);
    const expectedPlan = compilePreproductionPlan({request, requestPath, profile, style});
    fail(sha256Json(expectedPlan) === sha256Json(plan), 'NATIVE_PLAN_RECOMPILE_MISMATCH', 'directorPlan');
    const expectedRoute = buildRouteLock({request, requestPath, profile, style, plan: expectedPlan});
    fail(sha256Json(expectedRoute) === sha256Json(docs.directorRouteLock), 'NATIVE_ROUTE_RECOMPILE_MISMATCH', 'directorRouteLock');
    const manifests = {
      firstFramePromptManifest: buildFirstFramePromptManifest(expectedPlan),
      imageToVideoPromptManifest: buildRunningHubPromptManifest(expectedPlan),
      aiVideoPromptManifest: buildAiGeneratedVideoPromptManifest(expectedPlan),
    };
    for (const [key, expected] of Object.entries(manifests)) {
      fail(sha256Json(expected) === sha256Json(docs[key]), 'NATIVE_MANIFEST_RECOMPILE_MISMATCH', key);
    }
    const handoff = validatePromptHandoffManifests({plan, firstFrameManifest: docs.firstFramePromptManifest,
      runningHubManifest: docs.imageToVideoPromptManifest, aiGeneratedVideoManifest: docs.aiVideoPromptManifest});
    fail(handoff.ok, `NATIVE_HANDOFF_INVALID:${handoff.errors.join('|')}`);
    for (const [key, contract] of Object.entries(NATIVE_PREPRODUCTION_ARTIFACTS)) {
      if (contract.output) fail(resolveNativeEvidence(projectRoot, request.outputs[contract.output]) === files[key],
        'NATIVE_REQUEST_OUTPUT_MISMATCH', key);
    }
    const originalBindings = {
      request: artifacts.directorRequest, routeLock: artifacts.directorRouteLock, plan: artifacts.directorPlan,
      firstFramePromptManifest: artifacts.firstFramePromptManifest,
      runningHubPromptManifest: artifacts.imageToVideoPromptManifest,
      aiGeneratedVideoPromptManifest: artifacts.aiVideoPromptManifest,
    };
    for (const [name, expected] of Object.entries(originalBindings)) {
      fail(sameBinding(compiled[name], expected), `CONTENT_BINDING_MISMATCH:${name}`, 'directorCompileReceipt');
      fail(sameBinding(validated.artifacts?.[name], expected), `CONTENT_BINDING_MISMATCH:${name}`, 'directorValidation');
    }
    fail(sameBinding(validated.artifacts?.compileReceipt, artifacts.directorCompileReceipt),
      'CONTENT_BINDING_MISMATCH:compileReceipt', 'directorValidation');
    const sheets = {
      assetSheet: ['assetSheetPath', renderAssetSheet(plan)],
      runningHubPromptSheet: ['runningHubPromptSheetPath', renderRunningHubPromptSheet(plan, docs.imageToVideoPromptManifest)],
      aiGeneratedVideoPromptSheet: ['aiGeneratedVideoPromptSheetPath', renderAiGeneratedVideoPromptSheet(plan, docs.aiVideoPromptManifest)],
    };
    for (const [name, [output, content]] of Object.entries(sheets)) {
      const file = resolveNativeEvidence(projectRoot, request.outputs[output]);
      fail(readFileSync(file, 'utf8') === content, `NATIVE_SHEET_CONTENT_MISMATCH:${name}`);
      const expected = {path: file, sha256: sha256File(file)};
      fail(sameBinding(compiled[name], expected), `CONTENT_BINDING_MISMATCH:${name}`, 'directorCompileReceipt');
      fail(sameBinding(validated.artifacts?.[name], expected), `CONTENT_BINDING_MISMATCH:${name}`, 'directorValidation');
    }
    fail(compiled.compilerExecuted === true && compiled.skillExecuted === false && compiled.formalEligible === false &&
      compiled.postShootRebindRequired === true && compiled.plan?.canonicalSha256 === sha256Json(plan),
    'NATIVE_COMPILE_STATE_INVALID', 'directorCompileReceipt');
    fail(validated.skillExecuted === true && validated.compilerExecuted === true && validated.validatorExecuted === true &&
      validated.gates?.formalEligible === false && validated.gates?.postShootRebindRequired === true &&
      validated.gates?.promptPairsBoundOneToOne === true && validated.gates?.firstFrameAndImageToVideoPromptsSeparated === true,
    'NATIVE_VALIDATION_STATE_INVALID', 'directorValidation');
  } catch (error) { fail(false, `NATIVE_BUNDLE_INVALID:${error.message}`); }
  return {ok: errors.length === 0, errors};
}
