import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {
  isText,
  normalizeSpokenText,
  resolveDeclared,
  sha256File,
  sha256Json,
} from './preproduction-director-core.mjs';

export const POSTSHOOT_REQUEST_SCHEMA =
  'koubo-director-postshoot-rebind-request/v1';
export const POSTSHOOT_PLAN_SCHEMA = 'koubo-director-postshoot-rebind-plan/v1';

const push = (errors, condition, code) => {
  if (!condition) errors.push(code);
};

const asFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
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

// A substring has no word timestamp here: wait for its caption to finish instead of inventing one.
const conservativeTermTimeMs = (segments, terms) => Math.max(...terms.map(term =>
  Math.min(...segments.filter(segment => normalizedIncludes(segment.text, term)).map(segment =>
    normalizeSpokenText(segment.text) === normalizeSpokenText(term) ? segment.startMs : segment.endMs))));

const approvedPartialException = (exception, beatId) =>
  exception?.approved === true &&
  exception?.approvedBy === 'user' &&
  isText(exception?.approvedAt) &&
  isText(exception?.reason) &&
  (exception?.scope === beatId || exception?.scope === 'this-beat');

const safetyVersion = (value) => value?.policy?.incidentPreventionVersion ??
  (value?.policy == null ? value?.incidentPreventionVersion : undefined);

const evidenceIdentity = (request, beatId, target = 'beat') => ({
  taskId: request.taskId,
  requestId: request.requestId,
  revisionId: request.revisionId,
  beatId,
  target,
  recordedMediaSha256: request.recordedMedia?.sha256,
  spokenTimelineSha256: request.spokenTimeline?.sha256,
  preproductionPlanSha256: request.sourcePreproduction?.planSha256,
});

function readEvidence(reference, label, context) {
  const filePath = bindFile(context.projectRoot, reference?.path, reference?.sha256,
    label, context.errors);
  if (!filePath) return null;
  context.boundEvidence.push({path: filePath, sha256: reference.sha256});
  try { return JSON.parse(readFileSync(filePath, 'utf8')); }
  catch { context.errors.push(`${label}_JSON_INVALID`); return null; }
}

const matchesIdentity = (value, identity) => Object.entries(identity)
  .every(([key, expected]) => isText(expected) && value?.[key] === expected);

function validateScopedPartial(exception, beatId, target, context) {
  const {request, errors} = context;
  const label = `POSTSHOOT_PARTIAL_APPROVAL:${beatId}:${target}`;
  const identity = evidenceIdentity(request, beatId, target);
  const approval = readEvidence(exception?.approvalEvidence, label, context);
  push(errors, approvedPartialException(exception, beatId) && exception.scope === beatId &&
    Number.isFinite(Date.parse(exception.approvedAt)) && matchesIdentity(exception, identity),
  `${label}_SCOPE_INVALID`);
  push(errors, approval?.schemaVersion === 'koubo-postshoot-partial-approval/v1' &&
    matchesIdentity(approval, identity) && approval.approved === true &&
    approval.approvedBy === 'user' && approval.approvedAt === exception?.approvedAt &&
    isText(approval.approvalQuote), `${label}_RECEIPT_INVALID`);
  const source = approval?.sourceMessage;
  const sourcePath = bindFile(context.projectRoot, source?.path, source?.sha256,
    `${label}_SOURCE_MESSAGE`, errors);
  if (sourcePath) {
    context.boundEvidence.push({path: sourcePath, sha256: source.sha256});
    push(errors, isText(approval?.approvalQuote) &&
      readFileSync(sourcePath, 'utf8').includes(approval.approvalQuote),
    `${label}_QUOTE_NOT_IN_SOURCE`);
  }
}

function validateOmission(mapping, preBeat, timelineSegments, context) {
  const {errors, request} = context;
  const suffix = mapping.beatId;
  push(errors, mapping.reason === 'not-spoken', `POSTSHOOT_OMIT_REASON_INVALID:${suffix}`);
  const allowed = new Set(['beatId', 'order', 'disposition', 'reason', 'omissionEvidence']);
  push(errors, Object.keys(mapping).every(key => allowed.has(key)),
    `POSTSHOOT_OMIT_HAS_OUTPUT_FIELDS:${suffix}`);
  const evidence = readEvidence(mapping.omissionEvidence, `POSTSHOOT_OMIT_EVIDENCE:${suffix}`, context);
  push(errors, evidence?.schemaVersion === 'koubo-postshoot-omission-evidence/v1' &&
    matchesIdentity(evidence, evidenceIdentity(request, suffix)) &&
    evidence.reason === 'not-spoken' && isText(preBeat?.spokenLine) &&
    evidence.preproductionSpokenLine === preBeat?.spokenLine,
  `POSTSHOOT_OMIT_EVIDENCE_INVALID:${suffix}`);
  const review = evidence?.review;
  push(errors, isText(review?.reviewerId) && Number.isFinite(Date.parse(review?.reviewedAt)) &&
    review?.method === 'full-recording-and-transcript-review' &&
    Array.isArray(review.rangeMs) && review.rangeMs.length === 2 && review.rangeMs[0] === 0 &&
    review.rangeMs[1] === request.recordedMedia?.durationSeconds * 1000,
  `POSTSHOOT_OMIT_FULL_REVIEW_REQUIRED:${suffix}`);
  const assessments = Array.isArray(evidence?.captionAssessments) ? evidence.captionAssessments : [];
  push(errors, assessments.length === timelineSegments.length &&
    assessments.every((item, index) => item.captionId === timelineSegments[index]?.id &&
      item.text === timelineSegments[index]?.text && item.relation === 'not-this-beat' &&
      isText(item.reason)), `POSTSHOOT_OMIT_CAPTION_REVIEW_INCOMPLETE_OR_SPOKEN:${suffix}`);
  // Exact clauses found anywhere in the full recording cannot be omitted as "not spoken".
  const wholeSpokenText = timelineSegments.map(segment => segment.text).join('');
  const clauses = String(preBeat?.spokenLine ?? '').split(/[。！？；，,.!?;\n]+/u)
    .filter(clause => normalizeSpokenText(clause).length >= 4);
  push(errors, !normalizedIncludes(wholeSpokenText, preBeat?.spokenLine) &&
    !clauses.some(clause => normalizedIncludes(wholeSpokenText, clause)),
  `POSTSHOOT_OMIT_SPOKEN_CONTENT_DETECTED:${suffix}`);
}

const validateAlignment = ({errors, status, exception, beatId, suffix, context}) => {
  push(
    errors,
    ['exact', 'partial', 'mismatch'].includes(status),
    `POSTSHOOT_ALIGNMENT_STATUS_INVALID:${beatId}:${suffix}`,
  );
  push(errors, status !== 'mismatch', `POSTSHOOT_ALIGNMENT_MISMATCH:${beatId}:${suffix}`);
  if (status === 'partial') {
    if (context?.safe) {
      validateScopedPartial(exception, beatId, suffix, context);
      return;
    }
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

export function validatePostshootRebindRequest({request, projectRoot, allowLegacyRead = false}) {
  const errors = [];
  const version = safetyVersion(request);
  const safe = version === '1';
  const legacyReadOnly = allowLegacyRead && version === undefined;
  push(errors, safe || legacyReadOnly, 'POSTSHOOT_INCIDENT_PREVENTION_VERSION_REQUIRED');
  if (safe) {
    push(errors, isText(request.revisionId), 'POSTSHOOT_REVISION_ID_REQUIRED');
    push(errors, request.incidentPreventionVersion === undefined ||
      request.incidentPreventionVersion === '1', 'POSTSHOOT_INCIDENT_PREVENTION_VERSION_CONFLICT');
  }
  const context = {request, projectRoot, errors, safe, boundEvidence: []};
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
  if (safe) {
    push(errors, preValidation?.taskId === request.taskId &&
      preValidation?.artifacts?.request?.sha256 === request.sourcePreproduction?.requestSha256 &&
      preValidation?.artifacts?.plan?.sha256 === request.sourcePreproduction?.planSha256,
    'POSTSHOOT_PRE_VALIDATION_INPUT_BINDING_MISMATCH');
    push(errors, prePlan?.policy?.incidentPreventionVersion === '1',
      'POSTSHOOT_PRE_PLAN_SAFETY_VERSION_INVALID');
  } else if (legacyReadOnly) {
    push(errors, safetyVersion(prePlan) === undefined,
      'POSTSHOOT_SAFE_PLAN_CANNOT_USE_LEGACY_READ');
  }

  const timelineSegments = extractTimelineSegments(timelineText);
  push(errors, timelineSegments.length > 0, 'POSTSHOOT_TIMELINE_SEGMENTS_MISSING');
  const timelineById = new Map(timelineSegments.map((segment) => [segment.id, segment]));
  if (safe) {
    let rawSegments = [];
    try { rawSegments = firstSegmentArray(JSON.parse(timelineText)); } catch { /* Already reported above. */ }
    push(errors, rawSegments.length === timelineSegments.length &&
      timelineById.size === timelineSegments.length && timelineSegments.every((segment, index) =>
        segment.startMs >= 0 && segment.endMs <= request.recordedMedia?.durationSeconds * 1000 &&
        (index === 0 || segment.startMs >= timelineSegments[index - 1].startMs)),
    'POSTSHOOT_TIMELINE_FULL_COVERAGE_INVALID');
  }
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
    push(errors, mapping.order === index + 1, `POSTSHOOT_MAPPING_ORDER_INVALID:${mapping.beatId}`);
    const preBeat = preBeatById.get(mapping.beatId);
    if (safe) {
      push(errors, prePlan?.beats?.[index]?.id === mapping.beatId,
        `POSTSHOOT_MAPPING_PREPRODUCTION_ORDER_MISMATCH:${mapping.beatId}`);
      push(errors, ['keep', 'omit'].includes(mapping.disposition),
        `POSTSHOOT_DISPOSITION_REQUIRED:${mapping.beatId}`);
      if (mapping.disposition === 'omit') {
        validateOmission(mapping, preBeat, timelineSegments, context);
        return;
      }
      push(errors, mapping.omissionEvidence === undefined,
        `POSTSHOOT_KEEP_HAS_OMISSION_EVIDENCE:${mapping.beatId}`);
    }
    const contextualSummary = safe &&
      mapping.semanticTimingMode === 'contextual-summary-after-spoken-terms';
    if (safe) {
      push(errors, mapping.semanticTimingMode === undefined ||
        ['within-beat', 'contextual-summary-after-spoken-terms'].includes(mapping.semanticTimingMode),
      `POSTSHOOT_SEMANTIC_TIMING_MODE_INVALID:${mapping.beatId}`);
      if (contextualSummary) {
        const labels = preBeat?.paperScene?.textPlan ?? [];
        push(errors, labels.length > 0 && labels.every(item => item.embeddingMode === 'first-frame-baked') &&
          mapping.anchorEndMs <= mapping.startSeconds * 1000,
        `POSTSHOOT_CONTEXTUAL_SUMMARY_NOT_AFTER_SPEECH:${mapping.beatId}`);
      }
    }
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
      mapping.endSeconds <= request.recordedMedia?.durationSeconds,
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
    if (safe) {
      push(errors, new Set(mappingCaptionIds).size === mappingCaptionIds.length &&
        mappingCaptionIds.every((id, i) => i === 0 ||
          timelineSegments.findIndex(segment => segment.id === id) >
          timelineSegments.findIndex(segment => segment.id === mappingCaptionIds[i - 1])),
      `POSTSHOOT_CAPTION_ORDER_OR_DUPLICATE:${mapping.beatId}`);
    }
    push(
      errors,
      mappingSegments.length === mappingCaptionIds.length,
      `POSTSHOOT_CAPTION_ID_UNKNOWN:${mapping.beatId}`,
    );
    push(
      errors,
      Number.isFinite(mapping.anchorStartMs) &&
        mapping.anchorStartMs >= (contextualSummary ? 0 : mapping.startSeconds * 1_000),
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
    if (contextualSummary) {
      push(errors, mappingSegments.every(segment => segment.endMs <= mapping.startSeconds * 1000),
        `POSTSHOOT_CONTEXTUAL_SUMMARY_CAPTION_NOT_FINISHED:${mapping.beatId}`);
    }
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
      context,
    });

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
      const baked = safe && expectedText?.embeddingMode === 'first-frame-baked';
      if (safe) {
        push(errors, expectedText?.embeddingMode === 'first-frame-baked' &&
          expectedText.enterStageId === 'initial' && expectedText.persistence === 'initial-to-end' &&
          expectedText.firstReadableFrame === 0,
        `POSTSHOOT_NODE_INITIAL_LABEL_CONTRACT_REQUIRED:${mapping.beatId}:${suffix}`);
        if (baked) {
          push(errors, binding?.resolvedText === expectedText.text && binding?.firstReadableFrame === 0,
            `POSTSHOOT_BAKED_LABEL_MUST_MATCH_FRAME_ZERO:${mapping.beatId}:${suffix}`);
          if (expectedText.enterStageId === 'initial') {
            push(errors, expectedText.persistence === 'initial-to-end' && expectedText.firstReadableFrame === 0,
              `POSTSHOOT_INITIAL_LABEL_CONTRACT_INVALID:${mapping.beatId}:${suffix}`);
          }
        }
      }
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
      if (safe) {
        push(errors, new Set(captionIds).size === captionIds.length &&
          captionIds.every((id, i) => i === 0 ||
            mappingCaptionIds.indexOf(id) > mappingCaptionIds.indexOf(captionIds[i - 1])),
        `POSTSHOOT_NODE_CAPTION_ORDER_OR_DUPLICATE:${mapping.beatId}:${suffix}`);
      }
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
        const earliestByEvidence = safe ? conservativeTermTimeMs(segments, spokenTerms) : binding.anchorStartMs;
        const visualTime = safe ? mapping.startSeconds * 1000 +
          (binding.firstReadableFrame / timelineFps) * 1000 : binding.visualEnterMs;
        push(
          errors,
          Math.max(binding.anchorStartMs, earliestByEvidence) - visualTime <= 300,
          `POSTSHOOT_NODE_VISUAL_CLAIM_TOO_EARLY:${mapping.beatId}:${suffix}`,
        );
      }
      const firstReadableFrame = safe ? binding?.firstReadableFrame : binding?.labelEnterFrame;
      if (safe) {
        const frameInWindow = frame => Number.isInteger(frame) && frame >= 0 &&
          frame / timelineFps < mapping.endSeconds - mapping.startSeconds;
        push(errors, frameInWindow(firstReadableFrame) &&
          (binding.labelEnterFrame === undefined || binding.labelEnterFrame === firstReadableFrame),
        `POSTSHOOT_FIRST_READABLE_FRAME_INVALID:${mapping.beatId}:${suffix}`);
        const emphasisStageId = binding?.emphasisStageId ?? null;
        if (baked && emphasisStageId === null) {
          push(errors, binding.stageActionFrame == null && binding.emphasisFrame == null &&
            expectedText?.emphasisStageId == null,
          `POSTSHOOT_STATIC_LABEL_HAS_UNBOUND_ACTION:${mapping.beatId}:${suffix}`);
        } else if (baked) {
          push(errors, isText(emphasisStageId) && emphasisStageId !== 'initial' &&
            preBeat?.paperScene?.stages?.some(stage => stage.id === emphasisStageId) &&
            (expectedText?.emphasisStageId == null || expectedText.emphasisStageId === emphasisStageId) &&
            frameInWindow(binding.stageActionFrame) && frameInWindow(binding.emphasisFrame) &&
            Math.abs(binding.stageActionFrame - binding.emphasisFrame) <= 3,
          `POSTSHOOT_EMPHASIS_ACTION_BINDING_INVALID:${mapping.beatId}:${suffix}`);
        } else {
          push(errors, frameInWindow(binding.stageActionFrame) &&
            Math.abs(binding.stageActionFrame - firstReadableFrame) <= 3,
          `POSTSHOOT_NODE_STAGE_OFFSET_EXCEEDED:${mapping.beatId}:${suffix}`);
        }
      } else {
        push(errors, Number.isInteger(binding?.stageActionFrame) &&
          Number.isInteger(firstReadableFrame) &&
          Math.abs(binding.stageActionFrame - firstReadableFrame) <= 3,
        `POSTSHOOT_NODE_STAGE_OFFSET_EXCEEDED:${mapping.beatId}:${suffix}`);
      }
      if (
        Number.isFinite(binding?.visualEnterMs) &&
        Number.isInteger(firstReadableFrame) &&
        Number.isFinite(timelineFps)
      ) {
        const expectedVisualEnterMs =
          mapping.startSeconds * 1_000 + (firstReadableFrame / timelineFps) * 1_000;
        push(
          errors,
          Math.abs(binding.visualEnterMs - expectedVisualEnterMs) <= (safe ? 1 : 1_000 / timelineFps),
          `POSTSHOOT_NODE_VISUAL_FRAME_TIME_MISMATCH:${mapping.beatId}:${suffix}`,
        );
      }
      validateAlignment({
        errors,
        status: binding?.alignmentStatus,
        exception: binding?.partialException,
        beatId: mapping.beatId,
        suffix,
        context,
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
    projectRoot: path.resolve(projectRoot),
    incidentPreventionVersion: safe ? '1' : null,
    legacyReadOnly,
    requestSha256: sha256Json(request),
    boundInputs: [
      {path: preRequestPath, sha256: request.sourcePreproduction?.requestSha256},
      {path: prePlanPath, sha256: request.sourcePreproduction?.planSha256},
      {path: preValidationPath, sha256: request.sourcePreproduction?.validationReceiptSha256},
      {path: recordedMediaPath, sha256: request.recordedMedia?.sha256},
      {path: spokenTimelinePath, sha256: request.spokenTimeline?.sha256},
      ...context.boundEvidence,
    ],
  };
}

export function compilePostshootRebindPlan({request, requestPath, validation}) {
  if (!validation?.ok || validation.incidentPreventionVersion !== '1' || validation.legacyReadOnly ||
    validation.requestSha256 !== sha256Json(request) ||
    !isText(validation.projectRoot) ||
    sha256Json(JSON.parse(readFileSync(requestPath, 'utf8'))) !== sha256Json(request)) {
    throw new Error('POSTSHOOT_COMPILE_REQUIRES_CURRENT_SAFE_VALIDATION');
  }
  const current = validatePostshootRebindRequest({request, projectRoot: validation.projectRoot});
  if (!current.ok) throw new Error('POSTSHOOT_COMPILE_REQUIRES_CURRENT_SAFE_VALIDATION');
  const mappingByBeatId = new Map(request.mappings.map((mapping) => [mapping.beatId, mapping]));
  const reboundBeats = current.prePlan.beats.filter(beat =>
    mappingByBeatId.get(beat.id)?.disposition === 'keep').map((beat) => {
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
                firstReadableFrame: binding.firstReadableFrame,
                labelEnterFrame: binding.firstReadableFrame,
                stageActionFrame: binding.stageActionFrame ?? null,
                emphasisStageId: binding.emphasisStageId ?? null,
                emphasisFrame: binding.emphasisFrame ?? null,
                semanticClaimNotBeforeMs: conservativeTermTimeMs(
                  current.timelineSegments.filter(segment => binding.actualCaptionIds.includes(segment.id)),
                  binding.actualSpokenTerms),
                timingEvidence: 'caption-exact-or-caption-end-conservative',
                alignmentStatus: binding.alignmentStatus,
                ...(binding.partialException ? {partialException: binding.partialException} : {}),
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
      semanticTimingMode: mapping.semanticTimingMode ?? 'within-beat',
      ...(mapping.partialException ? {partialException: mapping.partialException} : {}),
    };
  });
  return {
    schemaVersion: POSTSHOOT_PLAN_SCHEMA,
    requestId: request.requestId,
    taskId: request.taskId,
    revisionId: request.revisionId,
    policy: {incidentPreventionVersion: '1'},
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
    beatDispositions: request.mappings.map(mapping => ({
      beatId: mapping.beatId,
      order: mapping.order,
      disposition: mapping.disposition,
      ...(mapping.disposition === 'omit' ? {
        reason: mapping.reason,
        omissionEvidence: mapping.omissionEvidence,
      } : {}),
    })),
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

export function validatePostshootRebindPlan({request, requestPath, validation, plan}) {
  try {
    const expected = compilePostshootRebindPlan({request, requestPath, validation});
    const serializedExpected = JSON.parse(JSON.stringify(expected));
    const serializedPlan = JSON.parse(JSON.stringify(plan));
    const errors = sha256Json(serializedExpected) === sha256Json(serializedPlan)
      ? [] : ['POSTSHOOT_PLAN_DERIVATION_MISMATCH'];
    return {ok: errors.length === 0, errors};
  } catch (error) {
    return {ok: false, errors: [error instanceof Error ? error.message : String(error)]};
  }
}
