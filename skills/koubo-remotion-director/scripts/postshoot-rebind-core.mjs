import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {
  isText,
  normalizeSpokenText,
  resolveDeclared,
  sha256File,
} from './preproduction-director-core.mjs';

export const POSTSHOOT_REQUEST_SCHEMA =
  'koubo-director-postshoot-rebind-request/v1';
export const POSTSHOOT_PLAN_SCHEMA = 'koubo-director-postshoot-rebind-plan/v1';

const push = (errors, condition, code) => {
  if (!condition) errors.push(code);
};

const bindFile = (projectRoot, declaredPath, declaredSha, label, errors) => {
  const absolutePath = resolveDeclared(projectRoot, declaredPath);
  if (!absolutePath || !existsSync(absolutePath)) {
    errors.push(`${label}_MISSING`);
    return null;
  }
  if (sha256File(absolutePath) !== declaredSha) errors.push(`${label}_SHA_MISMATCH`);
  return absolutePath;
};

export function validatePostshootRebindRequest({request, projectRoot}) {
  const errors = [];
  push(errors, request.schemaVersion === POSTSHOOT_REQUEST_SCHEMA, 'POSTSHOOT_SCHEMA_INVALID');
  push(errors, isText(request.requestId), 'POSTSHOOT_REQUEST_ID_MISSING');
  push(errors, isText(request.taskId), 'POSTSHOOT_TASK_ID_MISSING');
  push(errors, request.phase === 'post-shoot', 'POSTSHOOT_PHASE_INVALID');

  const preRequestPath = bindFile(
    projectRoot,
    request.sourcePreproduction?.requestPath,
    request.sourcePreproduction?.requestSha256,
    'POSTSHOOT_PRE_REQUEST',
    errors,
  );
  const prePlanPath = bindFile(
    projectRoot,
    request.sourcePreproduction?.planPath,
    request.sourcePreproduction?.planSha256,
    'POSTSHOOT_PRE_PLAN',
    errors,
  );
  const preValidationPath = bindFile(
    projectRoot,
    request.sourcePreproduction?.validationReceiptPath,
    request.sourcePreproduction?.validationReceiptSha256,
    'POSTSHOOT_PRE_VALIDATION',
    errors,
  );
  const recordedMediaPath = bindFile(
    projectRoot,
    request.recordedMedia?.path,
    request.recordedMedia?.sha256,
    'POSTSHOOT_RECORDED_MEDIA',
    errors,
  );
  const spokenTimelinePath = bindFile(
    projectRoot,
    request.spokenTimeline?.path,
    request.spokenTimeline?.sha256,
    'POSTSHOOT_SPOKEN_TIMELINE',
    errors,
  );

  push(
    errors,
    Number.isFinite(request.recordedMedia?.durationSeconds) &&
      request.recordedMedia.durationSeconds > 0,
    'POSTSHOOT_MEDIA_DURATION_INVALID',
  );
  push(
    errors,
    request.spokenTimeline?.authority === 'recorded-audio',
    'POSTSHOOT_TIMELINE_AUTHORITY_INVALID',
  );
  push(
    errors,
    request.spokenTimeline?.scriptRole === 'comparison-only',
    'POSTSHOOT_SCRIPT_ROLE_INVALID',
  );

  let preRequest;
  let prePlan;
  let preValidation;
  let timelineText = '';
  try {
    if (preRequestPath) preRequest = JSON.parse(readFileSync(preRequestPath, 'utf8'));
    if (prePlanPath) prePlan = JSON.parse(readFileSync(prePlanPath, 'utf8'));
    if (preValidationPath) preValidation = JSON.parse(readFileSync(preValidationPath, 'utf8'));
    if (spokenTimelinePath) timelineText = readFileSync(spokenTimelinePath, 'utf8');
  } catch (error) {
    errors.push(`POSTSHOOT_BOUND_JSON_INVALID:${error instanceof Error ? error.message : String(error)}`);
  }

  push(errors, preRequest?.taskId === request.taskId, 'POSTSHOOT_PRE_REQUEST_TASK_MISMATCH');
  push(errors, prePlan?.taskId === request.taskId, 'POSTSHOOT_PRE_PLAN_TASK_MISMATCH');
  push(
    errors,
    preValidation?.skillExecuted === true &&
      preValidation?.status === 'validated-provisional-previsualization',
    'POSTSHOOT_PRE_VALIDATION_NOT_EXECUTED',
  );
  push(errors, prePlan?.formalEligible === false, 'POSTSHOOT_PRE_PLAN_FORMAL_STATE_INVALID');

  const mappings = Array.isArray(request.mappings) ? request.mappings : [];
  const expectedBeatIds = new Set((prePlan?.beats ?? []).map((beat) => beat.id));
  const mappedBeatIds = new Set();
  let previousEnd = 0;
  const normalizedTimeline = normalizeSpokenText(timelineText);
  mappings.forEach((mapping, index) => {
    push(errors, expectedBeatIds.has(mapping.beatId), `POSTSHOOT_MAPPING_BEAT_UNKNOWN:${mapping.beatId}`);
    push(errors, !mappedBeatIds.has(mapping.beatId), `POSTSHOOT_MAPPING_BEAT_DUPLICATE:${mapping.beatId}`);
    mappedBeatIds.add(mapping.beatId);
    push(
      errors,
      Number.isFinite(mapping.startSeconds) && mapping.startSeconds >= previousEnd,
      `POSTSHOOT_MAPPING_START_INVALID:${mapping.beatId}`,
    );
    push(
      errors,
      Number.isFinite(mapping.endSeconds) && mapping.endSeconds > mapping.startSeconds,
      `POSTSHOOT_MAPPING_END_INVALID:${mapping.beatId}`,
    );
    push(
      errors,
      mapping.endSeconds <= request.recordedMedia.durationSeconds,
      `POSTSHOOT_MAPPING_OUTSIDE_MEDIA:${mapping.beatId}`,
    );
    push(errors, isText(mapping.actualSpokenLine), `POSTSHOOT_ACTUAL_LINE_MISSING:${mapping.beatId}`);
    if (normalizedTimeline && isText(mapping.actualSpokenLine)) {
      push(
        errors,
        normalizedTimeline.includes(normalizeSpokenText(mapping.actualSpokenLine)),
        `POSTSHOOT_ACTUAL_LINE_NOT_IN_TIMELINE:${mapping.beatId}`,
      );
    }
    push(
      errors,
      mapping.textDecision === 'confirmed',
      `POSTSHOOT_NODE_TEXT_NOT_CONFIRMED:${mapping.beatId}`,
    );
    push(
      errors,
      mapping.visualDecision === 'keep',
      `POSTSHOOT_VISUAL_DECISION_NOT_KEEP:${mapping.beatId}`,
    );
    previousEnd = mapping.endSeconds;
    push(errors, mapping.order === index + 1, `POSTSHOOT_MAPPING_ORDER_INVALID:${mapping.beatId}`);
  });
  for (const beatId of expectedBeatIds) {
    push(errors, mappedBeatIds.has(beatId), `POSTSHOOT_MAPPING_BEAT_MISSING:${beatId}`);
  }
  push(
    errors,
    mappings.length === expectedBeatIds.size,
    'POSTSHOOT_MAPPING_COVERAGE_INCOMPLETE',
  );

  const outputPaths = [
    request.outputs?.rebindPlanPath,
    request.outputs?.validationReceiptPath,
  ];
  outputPaths.forEach((outputPath, index) =>
    push(errors, isText(outputPath), `POSTSHOOT_OUTPUT_PATH_MISSING:${index}`),
  );
  push(
    errors,
    new Set(outputPaths.filter(isText).map((item) => resolveDeclared(projectRoot, item))).size ===
      outputPaths.filter(isText).length,
    'POSTSHOOT_OUTPUT_PATHS_NOT_UNIQUE',
  );

  return {
    ok: errors.length === 0,
    errors,
    preRequest,
    prePlan,
    preValidation,
    recordedMediaPath,
    spokenTimelinePath,
  };
}

export function compilePostshootRebindPlan({request, requestPath, validation}) {
  const mappingByBeatId = new Map(request.mappings.map((mapping) => [mapping.beatId, mapping]));
  return {
    schemaVersion: POSTSHOOT_PLAN_SCHEMA,
    requestId: request.requestId,
    taskId: request.taskId,
    phase: 'post-shoot',
    status: 'candidate-preview-required',
    formalEligible: false,
    spokenAuthority: 'recorded-audio',
    scriptRole: 'comparison-only',
    provenance: {
      requestPath,
      requestSha256: sha256File(requestPath),
      preproductionPlanPath: request.sourcePreproduction.planPath,
      preproductionPlanSha256: request.sourcePreproduction.planSha256,
      recordedMediaPath: request.recordedMedia.path,
      recordedMediaSha256: request.recordedMedia.sha256,
      spokenTimelinePath: request.spokenTimeline.path,
      spokenTimelineSha256: request.spokenTimeline.sha256,
    },
    beats: validation.prePlan.beats.map((beat) => {
      const mapping = mappingByBeatId.get(beat.id);
      return {
        ...beat,
        provisionalSpokenLine: beat.spokenLine,
        spokenLine: mapping.actualSpokenLine,
        startSeconds: mapping.startSeconds,
        endSeconds: mapping.endSeconds,
        textDecision: mapping.textDecision,
        visualDecisionAfterRecording: mapping.visualDecision,
      };
    }),
    nextGate: 'current-task-withsfx-nosfx-preview-and-user-acceptance',
  };
}
