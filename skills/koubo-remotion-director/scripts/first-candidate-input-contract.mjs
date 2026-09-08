import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, realpathSync} from 'node:fs';
import {extname, isAbsolute, relative, resolve, sep} from 'node:path';
import {
  buildRouteLock,
  compilePreproductionPlan,
  validatePreproductionRequest,
  validatePromptHandoffManifests,
  sha256Json,
} from './preproduction-director-core.mjs';
import {compilePostshootRebindPlan, validatePostshootRebindRequest} from './postshoot-rebind-core.mjs';
import {validatePaperAssetIntake} from './paper-asset-intake-core.mjs';
import {paperMediaTools} from './paper-asset-intake-media.mjs';

export const FIRST_CANDIDATE_INPUT_SCHEMA = 'director-first-candidate-input/v1';
export const FIRST_CANDIDATE_GATE_STATE = 'first-candidate-preview-required';
export const FIRST_CANDIDATE_AUTHORIZATION_SCHEMA = 'director-first-candidate-authorization/v1';
export const FIRST_CANDIDATE_COMMANDS = Object.freeze(['preview', 'direct-remotion-preview']);
const SHA = /^[a-f0-9]{64}$/u;
const MAX_INPUT_CLOSURE_FILES = 32768;
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (code, details) => {
  const error = new Error(`首次候选输入合同拒绝：${code}`);
  error.code = code;
  error.details = details;
  throw error;
};
const requireValue = (condition, code, details) => { if (!condition) fail(code, details); };
const same = (left, right) => sha256Json(left ?? null) === sha256Json(right ?? null);

export const FIRST_CANDIDATE_ARTIFACTS = Object.freeze([
  'preproductionRequest', 'routeLock', 'preproductionPlan', 'preproductionValidation',
  'postshootRequest', 'postshootPlan', 'postshootValidation', 'assetIntake', 'assetIntakeValidation',
]);

// Only existing input references are traversed. Output slots are not future evidence.
export function readFirstCandidateInputClosure({projectRoot, references}) {
  const files = new Map();
  const documents = new Map();
  const root = realpathSync(projectRoot);
  let runtimeTools;
  const readTool = (reference, expectedName) => {
    requireValue(record(reference) && text(reference.path) && SHA.test(reference.sha256), 'FCI_REFERENCE_INVALID');
    requireValue(Object.keys(reference).length === 2, 'FCI_RUNTIME_TOOL_FIELDS_INVALID');
    runtimeTools ??= paperMediaTools(['ffmpeg', 'ffprobe', 'magick', 'tesseract']);
    const match = Object.entries(runtimeTools).find(([name, tool]) =>
      (!expectedName || name === expectedName) && reference.path === tool.path && reference.sha256 === tool.sha256);
    requireValue(match, 'FCI_RUNTIME_TOOL_IDENTITY_MISMATCH');
    const [name, tool] = match;
    const stat = lstatSync(tool.path);
    requireValue(stat.isFile() && !stat.isSymbolicLink() && realpathSync(tool.path) === tool.path &&
      (stat.mode & 0o111) !== 0, 'FCI_RUNTIME_TOOL_INVALID');
    requireValue(createHash('sha256').update(readFileSync(tool.path)).digest('hex') === tool.sha256,
      'FCI_RUNTIME_TOOL_IDENTITY_MISMATCH');
    // Only the exact locally resolved media executable is an external dependency,
    // never a document whose own references may escape the project boundary.
    requireValue(files.size < MAX_INPUT_CLOSURE_FILES || files.has(tool.path), 'FCI_INPUT_CLOSURE_LIMIT');
    files.set(tool.path, {path: tool.path, sha256: tool.sha256, bytes: stat.size, role: 'runtime-tool', name});
  };
  const read = (reference) => {
    requireValue(record(reference) && text(reference.path) && SHA.test(reference.sha256), 'FCI_REFERENCE_INVALID');
    const absolutePath = resolve(root, reference.path);
    const rel = relative(root, absolutePath);
    requireValue(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'FCI_PATH_OUTSIDE');
    let cursor = root;
    for (const part of rel.split(sep)) {
      cursor = resolve(cursor, part);
      requireValue(!lstatSync(cursor).isSymbolicLink(), 'FCI_PATH_SYMLINK');
    }
    const stat = lstatSync(absolutePath);
    requireValue(stat.isFile() && realpathSync(absolutePath) === absolutePath, 'FCI_FILE_INVALID');
    const bytes = readFileSync(absolutePath);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    requireValue(sha256 === reference.sha256, 'FCI_INPUT_SHA_MISMATCH', {path: rel});
    if (files.has(absolutePath)) return documents.get(absolutePath);
    requireValue(files.size < MAX_INPUT_CLOSURE_FILES, 'FCI_INPUT_CLOSURE_LIMIT');
    files.set(absolutePath, {path: rel.split(sep).join('/'), sha256, bytes: stat.size});
    if (extname(absolutePath).toLowerCase() === '.json') {
      const body = JSON.parse(bytes.toString('utf8'));
      documents.set(absolutePath, {body, absolutePath, sha256});
      visit(body);
    }
    return documents.get(absolutePath);
  };
  const visit = (value) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!record(value)) return;
    if (Object.hasOwn(value, 'path') && Object.hasOwn(value, 'sha256')) read(value);
    for (const [key, item] of Object.entries(value)) {
      if (key === 'tool' && record(item) && Object.hasOwn(item, 'path') && Object.hasOwn(item, 'sha256')) {
        readTool(item);
        continue;
      }
      if (key === 'tools' && record(item)) {
        requireValue(Object.keys(item).length > 0 && Object.keys(item).every(name =>
          ['ffmpeg', 'ffprobe', 'magick', 'tesseract'].includes(name)), 'FCI_RUNTIME_TOOLS_CONTAINER_INVALID');
        for (const [name, tool] of Object.entries(item)) {
          requireValue(record(tool) && Object.hasOwn(tool, 'path') && Object.hasOwn(tool, 'sha256'),
            'FCI_RUNTIME_TOOLS_CONTAINER_INVALID');
          readTool(tool, name);
        }
        continue;
      }
      if (key.endsWith('Path') && Object.hasOwn(value, `${key.slice(0, -4)}Sha256`)) {
        read({path: item, sha256: value[`${key.slice(0, -4)}Sha256`]});
      }
      visit(item);
    }
  };
  references.forEach(read);
  return {
    files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path, 'zh-CN')),
    documents: [...documents.values()],
    document(reference) {
      requireValue(record(reference) && text(reference.path), 'FCI_JSON_DOCUMENT_REQUIRED');
      const found = documents.get(resolve(root, reference.path));
      requireValue(found, 'FCI_JSON_DOCUMENT_REQUIRED');
      return found;
    },
  };
}

export function assertFirstCandidateState({contract, job, command}) {
  const gate = job.productionGate;
  requireValue(contract?.schema === FIRST_CANDIDATE_INPUT_SCHEMA, 'FCI_SCHEMA_INVALID');
  requireValue(FIRST_CANDIDATE_COMMANDS.includes(command), 'FCI_COMMAND_FORBIDDEN');
  requireValue(
    contract.state === 'inputs-ready-for-first-candidate' &&
    contract.productionEligible === false && contract.formal?.enabled === false &&
    contract.candidateAccepted === false && contract.userPreviewApproved === false &&
    contract.fullWatchConfirmed === false && contract.publishAuthorized === false &&
    contract.candidate === null && contract.candidateAcceptance === null &&
    contract.technicalQa === null && contract.handoff === null &&
    job.productionEligible === false && job.formal?.enabled === false &&
    job.experiment?.status === 'candidate-preview-required' && job.experiment?.userPreviewApproved === false &&
    gate?.state === FIRST_CANDIDATE_GATE_STATE && gate.productionEligible === false &&
    gate.userPreviewApproved === false && gate.formalEnabled === false &&
    !gate.directorContract && !gate.handoffReceipt && !gate.formalAuthorization &&
    !job.director?.currentTaskUserAcceptance,
    'FCI_STATE_INVALID',
  );
  requireValue(
    text(contract.episodeId) && contract.episodeId === job.videoId &&
    contract.jobId === job.jobId && text(contract.taskId) && contract.taskId === job.director?.taskId &&
    text(contract.revisionId) && contract.revisionId === gate.revisionId &&
    text(contract.executionGroupId) && text(contract.authorizedUserId),
    'FCI_IDENTITY_MISMATCH',
  );
  requireValue(contract.policy?.incidentPreventionVersion === '1', 'FCI_INCIDENT_POLICY_REQUIRED');
}

export function validateFirstCandidateInputContract({projectRoot, contract, job, command}) {
  projectRoot = realpathSync(projectRoot);
  assertFirstCandidateState({contract, job, command});
  const refs = contract.artifacts;
  requireValue(record(refs) && FIRST_CANDIDATE_ARTIFACTS.every((key) => record(refs[key])), 'FCI_ARTIFACTS_REQUIRED');
  const closure = readFirstCandidateInputClosure({
    projectRoot,
    references: [...FIRST_CANDIDATE_ARTIFACTS.map((key) => refs[key]), contract.profile, contract.style],
  });
  const docs = Object.fromEntries(FIRST_CANDIDATE_ARTIFACTS.map((key) => [key, closure.document(refs[key])]));
  const bodies = Object.fromEntries(Object.entries(docs).map(([key, value]) => [key, value.body]));
  const pre = bodies.preproductionRequest;
  const prePlan = bodies.preproductionPlan;
  const post = bodies.postshootRequest;
  const postPlan = bodies.postshootPlan;
  const intake = bodies.assetIntake;
  for (const [key, value] of Object.entries(bodies)) {
    requireValue(value.taskId === contract.taskId, 'FCI_STAGE_TASK_MISMATCH', {artifact: key});
  }
  requireValue(text(pre.revisionId) && text(post.revisionId) && post.revisionId === contract.revisionId,
    'FCI_STAGE_REVISION_REQUIRED');
  for (const key of ['preproductionPlan', 'routeLock', 'preproductionValidation']) {
    requireValue(bodies[key].revisionId === pre.revisionId, 'FCI_PREPRODUCTION_REVISION_MISMATCH', {artifact: key});
  }
  for (const key of ['postshootPlan', 'postshootValidation', 'assetIntake', 'assetIntakeValidation']) {
    requireValue(bodies[key].revisionId === post.revisionId, 'FCI_POSTSHOOT_REVISION_MISMATCH', {artifact: key});
  }
  for (const [key, value] of Object.entries(bodies)) {
    requireValue(value.policy?.incidentPreventionVersion === '1', 'FCI_STAGE_POLICY_REQUIRED', {artifact: key});
  }
  const boundTo = (reference, target, code) => requireValue(
    record(reference) && resolve(projectRoot, reference.path ?? '') === docs[target].absolutePath &&
    reference.sha256 === docs[target].sha256, code,
  );
  for (const key of FIRST_CANDIDATE_ARTIFACTS.slice(0, 7)) {
    boundTo(job.director.artifacts?.[key], key, 'FCI_JOB_DIRECTOR_BINDING_MISMATCH');
  }
  const profile = closure.document(contract.profile).body;
  const style = closure.document(contract.style).body;
  requireValue(resolve(projectRoot, contract.profile.path) === resolve(projectRoot, 'workflow/active-director-profile.v1.json') &&
    resolve(projectRoot, pre.directorProfile?.path ?? '') === resolve(projectRoot, contract.profile.path) &&
    resolve(projectRoot, profile.style?.path ?? '') === resolve(projectRoot, contract.style.path), 'FCI_PROFILE_BINDING_MISMATCH');
  const stageCheck = (result, code) => requireValue(result?.ok === true, code, {errors: result?.errors});
  stageCheck(validatePreproductionRequest({request: pre, projectRoot, profile}), 'FCI_PREPRODUCTION_INVALID');
  const expectedPre = compilePreproductionPlan({request: pre, requestPath: docs.preproductionRequest.absolutePath, profile, style});
  requireValue(same(prePlan, expectedPre), 'FCI_PREPRODUCTION_PLAN_DIVERGENCE');
  requireValue(same(bodies.routeLock, buildRouteLock({request: pre, requestPath: docs.preproductionRequest.absolutePath, profile, style, plan: expectedPre})), 'FCI_ROUTE_DIVERGENCE');
  const preReceipt = bodies.preproductionValidation;
  requireValue(preReceipt.schemaVersion === 'koubo-director-validation-receipt/v1' &&
    preReceipt.status === 'validated-provisional-previsualization' && preReceipt.skillExecuted === true &&
    preReceipt.validatorExecuted === true && preReceipt.gates?.formalEligible === false &&
    preReceipt.requestId === pre.requestId, 'FCI_PREPRODUCTION_RECEIPT_INVALID');
  for (const [name, target] of [['request', 'preproductionRequest'], ['plan', 'preproductionPlan'], ['routeLock', 'routeLock']]) {
    boundTo(preReceipt.artifacts?.[name], target, 'FCI_PREPRODUCTION_RECEIPT_BINDING');
  }
  const compiled = closure.document(preReceipt.artifacts?.compileReceipt).body;
  requireValue(compiled.schemaVersion === 'koubo-director-compile-receipt/v1' &&
    compiled.taskId === pre.taskId && compiled.requestId === pre.requestId && compiled.revisionId === pre.revisionId &&
    compiled.policy?.incidentPreventionVersion === '1' && compiled.compilerExecuted === true &&
    compiled.skillExecuted === false && compiled.formalEligible === false, 'FCI_COMPILE_RECEIPT_INVALID');
  for (const [name, target] of [['request', 'preproductionRequest'], ['plan', 'preproductionPlan'], ['routeLock', 'routeLock']]) {
    boundTo(compiled[name], target, 'FCI_COMPILE_RECEIPT_BINDING');
  }
  const manifest = (name) => closure.document(preReceipt.artifacts?.[name]).body;
  stageCheck(validatePromptHandoffManifests({plan: prePlan,
    firstFrameManifest: manifest('firstFramePromptManifest'),
    runningHubManifest: manifest('runningHubPromptManifest'),
    aiGeneratedVideoManifest: pre.policy?.v9ContractEnabled ? manifest('aiGeneratedVideoPromptManifest') : null,
  }), 'FCI_PROMPT_HANDOFF_INVALID');
  for (const [pathKey, shaKey, target] of [
    ['requestPath', 'requestSha256', 'preproductionRequest'],
    ['planPath', 'planSha256', 'preproductionPlan'],
    ['validationReceiptPath', 'validationReceiptSha256', 'preproductionValidation'],
  ]) boundTo({path: post.sourcePreproduction?.[pathKey], sha256: post.sourcePreproduction?.[shaKey]}, target, 'FCI_POSTSHOOT_SOURCE_BINDING');
  const postResult = validatePostshootRebindRequest({request: post, projectRoot});
  stageCheck(postResult, 'FCI_POSTSHOOT_INVALID');
  requireValue(same(postPlan, compilePostshootRebindPlan({request: post, requestPath: docs.postshootRequest.absolutePath, validation: postResult})), 'FCI_POSTSHOOT_PLAN_DIVERGENCE');
  const postReceipt = bodies.postshootValidation;
  requireValue(postReceipt.schemaVersion === 'koubo-director-postshoot-validation-receipt/v1' &&
    postReceipt.status === 'validated-candidate-preview-required' && postReceipt.skillExecuted === true &&
    postReceipt.requestId === post.requestId && postReceipt.spokenAuthority === 'recorded-audio' &&
    postReceipt.scriptRole === 'comparison-only' && postReceipt.gates?.formalEligible === false,
    'FCI_POSTSHOOT_RECEIPT_INVALID');
  boundTo(postReceipt.artifacts?.request, 'postshootRequest', 'FCI_POSTSHOOT_RECEIPT_BINDING');
  boundTo(postReceipt.artifacts?.rebindPlan, 'postshootPlan', 'FCI_POSTSHOOT_RECEIPT_BINDING');
  for (const name of ['recordedMedia', 'spokenTimeline']) {
    requireValue(same(postReceipt.artifacts?.[name], post[name]) ||
      (postReceipt.artifacts?.[name]?.sha256 === post[name]?.sha256 &&
      resolve(projectRoot, postReceipt.artifacts?.[name]?.path ?? '') === resolve(projectRoot, post[name]?.path ?? '')),
    'FCI_SPOKEN_RECEIPT_BINDING');
  }
  requireValue(resolve(projectRoot, job.inputs?.source ?? '') === resolve(projectRoot, post.recordedMedia.path), 'FCI_JOB_RECORDED_SOURCE_MISMATCH');
  boundTo(intake.sourcePlan, 'postshootPlan', 'FCI_INTAKE_PLAN_BINDING');
  const intakeResult = validatePaperAssetIntake({request: intake, requestPath: docs.assetIntake.absolutePath, projectRoot, requireContactSheet: true});
  stageCheck(intakeResult, 'FCI_ASSET_INTAKE_INVALID');
  const intakeReceipt = bodies.assetIntakeValidation;
  requireValue(intakeReceipt.schemaVersion === 'koubo-paper-generated-asset-intake-receipt/v1' &&
    intakeReceipt.status === 'validated-candidate-assets-ready-for-preview' && intakeReceipt.formalEligible === false &&
    intakeReceipt.assetSetSha256 === intakeResult.assetSetSha256, 'FCI_INTAKE_RECEIPT_INVALID');
  boundTo(intakeReceipt.request, 'assetIntake', 'FCI_INTAKE_RECEIPT_BINDING');
  boundTo(intakeReceipt.sourcePlan, 'postshootPlan', 'FCI_INTAKE_RECEIPT_BINDING');
  const contact = closure.document({path: intakeReceipt.contactSheet?.manifestPath});
  requireValue(contact.absolutePath === resolve(projectRoot, intakeResult.contactSheetManifestPath ?? '') &&
    contact.sha256 === intakeReceipt.contactSheet.manifestSha256 && same(contact.body, intakeResult.contactSheetManifest) &&
    same(intakeReceipt.dynamicEvidence, intakeResult.dynamicEvidence) &&
    same(intakeReceipt.incidentRegistry, intakeResult.incidentRegistry), 'FCI_INTAKE_DERIVED_RECEIPT_MISMATCH');
  return {ok: true, productionEligible: false, formalEnabled: false, files: closure.files,
    documents: closure.documents, taskId: contract.taskId};
}

// A read-only producer adapter. It consumes existing compiler/validator outputs;
// it neither invents stage receipts nor creates authorization or acceptance.
export function buildFirstCandidateInputContract({
  projectRoot, job, assetIntake, assetIntakeValidation, executionGroupId, authorizedUserId,
}) {
  projectRoot = realpathSync(projectRoot);
  const bind = (path) => {
    requireValue(text(path), 'FCI_PRODUCER_PATH_REQUIRED');
    const absolute = resolve(projectRoot, path);
    const rel = relative(projectRoot, realpathSync(absolute));
    requireValue(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'FCI_PATH_OUTSIDE');
    const reference = {path: absolute, sha256: createHash('sha256').update(readFileSync(absolute)).digest('hex')};
    readFirstCandidateInputClosure({projectRoot, references: [reference]});
    return reference;
  };
  const profile = bind('workflow/active-director-profile.v1.json');
  const profileBody = JSON.parse(readFileSync(profile.path, 'utf8'));
  const contract = {
    schema: FIRST_CANDIDATE_INPUT_SCHEMA, state: 'inputs-ready-for-first-candidate',
    episodeId: job.videoId, jobId: job.jobId, taskId: job.director?.taskId,
    revisionId: job.productionGate?.revisionId, executionGroupId, authorizedUserId,
    policy: {incidentPreventionVersion: '1'}, productionEligible: false, formal: {enabled: false},
    candidateAccepted: false, userPreviewApproved: false, fullWatchConfirmed: false, publishAuthorized: false,
    candidate: null, candidateAcceptance: null, technicalQa: null, handoff: null,
    profile, style: bind(profileBody.style?.path),
    artifacts: Object.fromEntries(FIRST_CANDIDATE_ARTIFACTS.map((key) => [key,
      key === 'assetIntake' ? bind(assetIntake) : key === 'assetIntakeValidation' ? bind(assetIntakeValidation) :
        structuredClone(job.director?.artifacts?.[key]),
    ])),
  };
  const validation = validateFirstCandidateInputContract({projectRoot, contract, job, command: 'preview'});
  return {contract, validation};
}
