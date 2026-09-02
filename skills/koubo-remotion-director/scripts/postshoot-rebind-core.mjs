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

const asFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const timestampToMs = (value) => {
  if (!isText(value)) return null;
  const match = String(value).match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/u);
  if (!match) return null;
  const [, hours, minutes, seconds, milliseconds] = match;
  return (
    Number(hours) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000 +
    Number(milliseconds)
  );
};

const segmentTimeMs = (segment, side) => {
  const camel = side === 'start' ? 'startMs' : 'endMs';
  const offset = side === 'start' ? 'from' : 'to';
  const directMs = asFiniteNumber(segment?.[camel]);
  if (directMs !== null) return directMs;
  const offsetMs = asFiniteNumber(segment?.offsets?.[offset]);
  if (offsetMs !== null) return offsetMs;
  const seconds = asFiniteNumber(segment?.[side]);
  if (seconds !== null) return seconds * 1_000;
  return timestampToMs(segment?.timestamps?.[offset]);
};

const firstSegmentArray = (body) => {
  if (Array.isArray(body)) return body;
  for (const candidate of [
    body?.transcription,
    body?.captions,
    body?.segments,
    body?.items,
    body?.result?.transcription,
    body?.result?.captions,
    body?.result?.segments,
  ]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

export function extractTimelineSegments(timelineText) {
  let body;
  try {
    body = JSON.parse(timelineText);
  } catch {
    return [];
  }
  return firstSegmentArray(body)
    .map((segment, index) => {
      const startMs = segmentTimeMs(segment, 'start');
      const endMs = segmentTimeMs(segment, 'end');
      const text = segment?.text ?? segment?.content ?? segment?.caption;
      const explicitId = segment?.id ?? segment?.captionId ?? segment?.segmentId;
      return {
        id: isText(explicitId) ? explicitId : `T${String(index + 1).padStart(4, '0')}`,
        startMs,
        endMs,
        text: isText(text) ? String(text) : '',
      };
    })
    .filter(
      (segment) =>
        Number.isFinite(segment.startMs) &&
        Number.isFinite(segment.endMs) &&
        segment.endMs > segment.startMs &&
        isText(segment.text),
    );
}

const normalizedIncludes = (container, expected) => {
  const normalizedContainer = normalizeSpokenText(container);
  const normalizedExpected = normalizeSpokenText(expected);
  return normalizedExpected.length > 0 && normalizedContainer.includes(normalizedExpected);
};

const intervalOverlaps = (segment, startMs, endMs) =>
  segment.startMs < endMs && segment.endMs > startMs;

const approvedPartialException = (exception, beatId) =>
  exception?.approved === true &&
  exception?.approvedBy === 'user' &&
  isText(exception?.approvedAt) &&
  isText(exception?.reason) &&
  (exception?.scope === beatId || exception?.scope === 'this-beat');

const validateAlignment = ({errors, status, exception, beatId, suffix}) => {
  push(
    errors,
    ['exact', 'partial', 'mismatch'].includes(status),
    `POSTSHOOT_ALIGNMENT_STATUS_INVALID:${beatId}:${suffix}`,
  );
  push(errors, status !== 'mismatch', `POSTSHOOT_ALIGNMENT_MISMATCH:${beatId}:${suffix}`);
  if (status === 'partial') {
    push(
      errors,
      approvedPartialException(exception, beatId),
      `POSTSHOOT_PARTIAL_EXCEPTION_REQUIRED:${beatId}:${suffix}`,
    );
  }
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

  const timelineSegments = extractTimelineSegments(timelineText);
  push(errors, timelineSegments.length > 0, 'POSTSHOOT_TIMELINE_SEGMENTS_MISSING');
  const timelineById = new Map(timelineSegments.map((segment) => [segment.id, segment]));
  const timelineFps = Number(request.timelineFps ?? 30);
  push(
    errors,
    Number.isInteger(timelineFps) && timelineFps >= 24 && timelineFps <= 60,
    'POSTSHOOT_TIMELINE_FPS_INVALID',
  );

  const mappings = Array.isArray(request.mappings) ? request.mappings : [];
  const expectedBeatIds = new Set((prePlan?.beats ?? []).map((beat) => beat.id));
  const preBeatById = new Map((prePlan?.beats ?? []).map((beat) => [beat.id, beat]));
  const mappedBeatIds = new Set();
  let previousEnd = 0;
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
    const mappingCaptionIds = Array.isArray(mapping.actualCaptionIds)
      ? mapping.actualCaptionIds
      : [];
    push(
      errors,
      mappingCaptionIds.length > 0 && mappingCaptionIds.every(isText),
      `POSTSHOOT_CAPTION_IDS_MISSING:${mapping.beatId}`,
    );
    const mappingSegments = mappingCaptionIds
      .map((captionId) => timelineById.get(captionId))
      .filter(Boolean);
    push(
      errors,
      mappingSegments.length === mappingCaptionIds.length,
      `POSTSHOOT_CAPTION_ID_UNKNOWN:${mapping.beatId}`,
    );
    push(
      errors,
      Number.isFinite(mapping.anchorStartMs) &&
        mapping.anchorStartMs >= mapping.startSeconds * 1_000,
      `POSTSHOOT_ANCHOR_START_INVALID:${mapping.beatId}`,
    );
    push(
      errors,
      Number.isFinite(mapping.anchorEndMs) &&
        mapping.anchorEndMs > mapping.anchorStartMs &&
        mapping.anchorEndMs <= mapping.endSeconds * 1_000,
      `POSTSHOOT_ANCHOR_END_INVALID:${mapping.beatId}`,
    );
    if (Number.isFinite(mapping.anchorStartMs) && Number.isFinite(mapping.anchorEndMs)) {
      push(
        errors,
        mappingSegments.every((segment) =>
          intervalOverlaps(segment, mapping.anchorStartMs, mapping.anchorEndMs),
        ),
        `POSTSHOOT_CAPTION_OUTSIDE_ANCHOR:${mapping.beatId}`,
      );
    }
    const mappingWindowText = mappingSegments.map((segment) => segment.text).join('');
    if (isText(mapping.actualSpokenLine)) {
      push(
        errors,
        normalizedIncludes(mappingWindowText, mapping.actualSpokenLine),
        `POSTSHOOT_ACTUAL_LINE_NOT_IN_DECLARED_WINDOW:${mapping.beatId}`,
      );
    }
    push(
      errors,
      isText(mapping.semanticAnchorText) &&
        normalizedIncludes(mappingWindowText, mapping.semanticAnchorText),
      `POSTSHOOT_SEMANTIC_ANCHOR_NOT_IN_DECLARED_WINDOW:${mapping.beatId}`,
    );
    validateAlignment({
      errors,
      status: mapping.alignmentStatus,
      exception: mapping.partialException,
      beatId: mapping.beatId,
      suffix: 'beat',
    });

    const preBeat = preBeatById.get(mapping.beatId);
    const expectedTextPlan = Array.isArray(preBeat?.paperScene?.textPlan)
      ? preBeat.paperScene.textPlan
      : [];
    const expectedTextByNode = new Map(
      expectedTextPlan.map((item) => [item.nodeId, item]),
    );
    const nodeTextBindings = Array.isArray(mapping.nodeTextBindings)
      ? mapping.nodeTextBindings
      : [];
    const boundNodeIds = new Set();
    nodeTextBindings.forEach((binding) => {
      const suffix = binding?.nodeId ?? 'unknown';
      const expectedText = expectedTextByNode.get(binding?.nodeId);
      push(
        errors,
        Boolean(expectedText),
        `POSTSHOOT_NODE_BINDING_UNKNOWN:${mapping.beatId}:${suffix}`,
      );
      push(
        errors,
        !boundNodeIds.has(binding?.nodeId),
        `POSTSHOOT_NODE_BINDING_DUPLICATE:${mapping.beatId}:${suffix}`,
      );
      if (isText(binding?.nodeId)) boundNodeIds.add(binding.nodeId);
      push(
        errors,
        isText(binding?.resolvedText) && [...String(binding.resolvedText)].length <= 8,
        `POSTSHOOT_NODE_RESOLVED_TEXT_INVALID:${mapping.beatId}:${suffix}`,
      );
      push(
        errors,
        binding?.enterStageId === expectedText?.enterStageId,
        `POSTSHOOT_NODE_STAGE_BINDING_MISMATCH:${mapping.beatId}:${suffix}`,
      );

      const captionIds = Array.isArray(binding?.actualCaptionIds)
        ? binding.actualCaptionIds
        : [];
      const segments = captionIds.map((captionId) => timelineById.get(captionId)).filter(Boolean);
      push(
        errors,
        captionIds.length > 0 && segments.length === captionIds.length,
        `POSTSHOOT_NODE_CAPTION_BINDING_INVALID:${mapping.beatId}:${suffix}`,
      );
      push(
        errors,
        captionIds.every((captionId) => mappingCaptionIds.includes(captionId)),
        `POSTSHOOT_NODE_CAPTION_OUTSIDE_BEAT:${mapping.beatId}:${suffix}`,
      );
      const nodeWindowText = segments.map((segment) => segment.text).join('');
      const spokenTerms = Array.isArray(binding?.actualSpokenTerms)
        ? binding.actualSpokenTerms
        : [];
      push(
        errors,
        spokenTerms.length > 0 && spokenTerms.every(isText),
        `POSTSHOOT_NODE_SPOKEN_TERMS_MISSING:${mapping.beatId}:${suffix}`,
      );
      push(
        errors,
        spokenTerms.every((term) => normalizedIncludes(nodeWindowText, term)),
        `POSTSHOOT_NODE_TERM_NOT_IN_DECLARED_WINDOW:${mapping.beatId}:${suffix}`,
      );
      push(
        errors,
        spokenTerms.some((term) =>
          normalizedIncludes(term, binding?.resolvedText) ||
          normalizedIncludes(binding?.resolvedText, term),
        ),
        `POSTSHOOT_NODE_TEXT_NOT_DERIVED_FROM_SPEECH:${mapping.beatId}:${suffix}`,
      );
      push(
        errors,
        Number.isFinite(binding?.anchorStartMs) &&
          Number.isFinite(binding?.anchorEndMs) &&
          binding.anchorStartMs >= mapping.anchorStartMs &&
          binding.anchorEndMs <= mapping.anchorEndMs &&
          binding.anchorEndMs > binding.anchorStartMs,
        `POSTSHOOT_NODE_ANCHOR_INVALID:${mapping.beatId}:${suffix}`,
      );
      if (Number.isFinite(binding?.anchorStartMs) && Number.isFinite(binding?.anchorEndMs)) {
        push(
          errors,
          segments.every((segment) =>
            intervalOverlaps(segment, binding.anchorStartMs, binding.anchorEndMs),
          ),
          `POSTSHOOT_NODE_CAPTION_OUTSIDE_ANCHOR:${mapping.beatId}:${suffix}`,
        );
      }
      push(
        errors,
        Number.isFinite(binding?.visualEnterMs) &&
          binding.visualEnterMs >= mapping.startSeconds * 1_000 &&
          binding.visualEnterMs <= mapping.endSeconds * 1_000,
        `POSTSHOOT_NODE_VISUAL_ENTER_INVALID:${mapping.beatId}:${suffix}`,
      );
      if (Number.isFinite(binding?.anchorStartMs) && Number.isFinite(binding?.visualEnterMs)) {
        push(
          errors,
          binding.anchorStartMs - binding.visualEnterMs <= 300,
          `POSTSHOOT_NODE_VISUAL_CLAIM_TOO_EARLY:${mapping.beatId}:${suffix}`,
        );
      }
      push(
        errors,
        Number.isInteger(binding?.stageActionFrame) &&
          Number.isInteger(binding?.labelEnterFrame) &&
          Math.abs(binding.stageActionFrame - binding.labelEnterFrame) <= 3,
        `POSTSHOOT_NODE_STAGE_OFFSET_EXCEEDED:${mapping.beatId}:${suffix}`,
      );
      if (
        Number.isFinite(binding?.visualEnterMs) &&
        Number.isInteger(binding?.labelEnterFrame) &&
        Number.isFinite(timelineFps)
      ) {
        const expectedVisualEnterMs =
          mapping.startSeconds * 1_000 + (binding.labelEnterFrame / timelineFps) * 1_000;
        push(
          errors,
          Math.abs(binding.visualEnterMs - expectedVisualEnterMs) <= 1_000 / timelineFps,
          `POSTSHOOT_NODE_VISUAL_FRAME_TIME_MISMATCH:${mapping.beatId}:${suffix}`,
        );
      }
      validateAlignment({
        errors,
        status: binding?.alignmentStatus,
        exception: binding?.partialException,
        beatId: mapping.beatId,
        suffix,
      });
    });
    for (const nodeId of expectedTextByNode.keys()) {
      push(
        errors,
        boundNodeIds.has(nodeId),
        `POSTSHOOT_NODE_BINDING_MISSING:${mapping.beatId}:${nodeId}`,
      );
    }
    push(
      errors,
      nodeTextBindings.length === expectedTextByNode.size,
      `POSTSHOOT_NODE_BINDING_COVERAGE_INVALID:${mapping.beatId}`,
    );
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
    timelineSegments,
    timelineFps,
  };
}

export function compilePostshootRebindPlan({request, requestPath, validation}) {
  const mappingByBeatId = new Map(request.mappings.map((mapping) => [mapping.beatId, mapping]));
  const reboundBeats = validation.prePlan.beats.map((beat) => {
    const mapping = mappingByBeatId.get(beat.id);
    const bindingByNodeId = new Map(
      mapping.nodeTextBindings.map((binding) => [binding.nodeId, binding]),
    );
    const reboundPaperScene = beat.paperScene
      ? {
          ...beat.paperScene,
          textPlan: beat.paperScene.textPlan.map((item) => {
            const binding = bindingByNodeId.get(item.nodeId);
            return {
              ...item,
              text: binding.resolvedText,
              postshootBinding: {
                actualCaptionIds: binding.actualCaptionIds,
                actualSpokenTerms: binding.actualSpokenTerms,
                anchorStartMs: binding.anchorStartMs,
                anchorEndMs: binding.anchorEndMs,
                visualEnterMs: binding.visualEnterMs,
                stageActionFrame: binding.stageActionFrame,
                labelEnterFrame: binding.labelEnterFrame,
                alignmentStatus: binding.alignmentStatus,
              },
            };
          }),
        }
      : beat.paperScene;
    return {
      ...beat,
      paperScene: reboundPaperScene,
      provisionalSpokenLine: beat.spokenLine,
      spokenLine: mapping.actualSpokenLine,
      startSeconds: mapping.startSeconds,
      endSeconds: mapping.endSeconds,
      actualCaptionIds: mapping.actualCaptionIds,
      anchorStartMs: mapping.anchorStartMs,
      anchorEndMs: mapping.anchorEndMs,
      semanticAnchorText: mapping.semanticAnchorText,
      alignmentStatus: mapping.alignmentStatus,
      nodeTextBindings: mapping.nodeTextBindings,
      textDecision: mapping.textDecision,
      visualDecisionAfterRecording: mapping.visualDecision,
    };
  });
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
    beats: reboundBeats,
    paperScenes: reboundBeats
      .filter((beat) => beat.paperScene)
      .map((beat) => ({
        beatId: beat.id,
        spokenLine: beat.spokenLine,
        coreMeaning: beat.coreMeaning,
        ...beat.paperScene,
      })),
    nextGate: 'current-task-withsfx-nosfx-preview-and-user-acceptance',
  };
}
