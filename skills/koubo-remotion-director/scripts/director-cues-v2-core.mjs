import {createHash} from 'node:crypto';
import {existsSync, readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';

export const DIRECTOR_CUES_V2_SCHEMA = 'koubo-director-cues/v2';

const ROUTES = new Set([
  'speaker',
  'real-evidence',
  'ai-generated-video',
  'paper-editorial',
]);
const REAL_ASSET_TYPES = new Set([
  'official-document',
  'official-interface',
  'screen-recording',
  'user-demo',
  'licensed-archive',
  'source-data',
  'real-person-action',
  'real-location',
]);
const REAL_USAGE_ROLES = new Set(['evidence', 'demonstration', 'context']);
const REAL_FALLBACKS = new Set([
  'keep-speaker',
  'remove-or-rewrite-claim',
  'block-production',
]);
const VISUAL_ROLES = new Set(['mechanism', 'process', 'relationship', 'comparison', 'metaphor']);
const SHOTCRAFT_INTENTS = new Set([
  'keyword-emphasis',
  'list-reveal',
  'evidence-focus',
  'screen-callout',
  'relationship-line',
  'pinning',
  'transition-carry',
]);
const RHYTHM_RISKS = new Set(['low', 'medium', 'high']);
const RHYTHM_DECISIONS = new Set([
  'keep-presenter',
  'shotcraft-opportunity',
  'rewrite-shorter',
]);
const CLAIM_CLASSES = new Set([
  'presenter-expression',
  'factual-claim',
  'real-operation',
  'generic-illustration',
  'abstract-explanation',
]);
const SCRIPT_AUTHORITIES = new Set(['user-confirmed-script', 'actual-spoken-transcript']);
const TECHNICAL_PROMPT_TERMS = [
  '毫米', '归一化坐标', '布局合同', '碰撞', 'OCR', 'sha256',
  'generatedDecorationPolicy', 'sweptRect', 'projectionContract',
  'x=', 'y=', 'width=', 'height=',
];
const FIRST_FRAME_MOTION_WORDS = [
  '随后', '然后', '逐渐', '最终', '接着', '滑入', '飞入', '移入',
  '旋转', '展开', '折叠', '变成', '汇聚', '推镜', '拉镜', '镜头移动',
];
const VIDEO_SEQUENCE_WORDS = [
  '随后', '然后', '接着', '继而', '再把', '再将', '同时', '与此同时',
  '第一步', '第二步',
];
const GENERATED_SYMBOL_TERMS = [
  '问号', '纸币', '金币', '人民币', '印章', '对号', '勾选', '图表', '清单',
];
const FORBIDDEN_SHOTCRAFT_FIELDS = ['cardId', 'effectId', 'presetId', 'componentId'];
const BEAT_FIELDS = new Set([
  'id', 'order', 'scriptQuote', 'rhetoricalRole', 'claimClass', 'requiresRealEvidence',
  'primaryRoute', 'routeCueId', 'decisionReason', 'viewerGain',
]);
const REAL_ITEM_FIELDS = new Set([
  'id', 'beatId', 'startAnchorText', 'endAnchorText', 'timingStatus', 'assetType',
  'usageRole', 'materialRequest', 'reason', 'evidenceStatus', 'usableInProduction',
  'sourceBinding', 'fallbackIfUnavailable', 'generatedSubstituteAllowed',
]);
const REAL_BINDING_FIELDS = new Set([
  'path', 'sha256', 'provenance', 'rightsStatus', 'reviewedBy', 'reviewedAt',
]);
const REAL_RIGHTS_STATUSES = new Set(['user-owned', 'official-public-source', 'licensed-for-use']);
const SHOTCRAFT_FIELDS = new Set([
  'id', 'beatId', 'baseVisualRoute', 'intent', 'reason', 'status', 'catalogScope',
]);
const REAL_ASSET_EXTENSIONS = Object.freeze({
  'official-document': new Set(['.pdf', '.html', '.htm', '.png', '.jpg', '.jpeg', '.webp']),
  'official-interface': new Set(['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov', '.mkv', '.webm']),
  'screen-recording': new Set(['.mp4', '.mov', '.mkv', '.webm']),
  'user-demo': new Set(['.mp4', '.mov', '.mkv', '.webm']),
  'licensed-archive': new Set(['.mp4', '.mov', '.mkv', '.webm']),
  'source-data': new Set(['.json', '.csv', '.xlsx', '.xls', '.pdf', '.html', '.htm', '.png', '.jpg', '.jpeg']),
  'real-person-action': new Set(['.mp4', '.mov', '.mkv', '.webm']),
  'real-location': new Set(['.mp4', '.mov', '.mkv', '.webm', '.png', '.jpg', '.jpeg', '.webp']),
});

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const list = (value) => Array.isArray(value) ? value : [];
const characters = (value) => Array.from(String(value ?? '').trim()).length;
const normalized = (value) => String(value ?? '').replace(/\s+/gu, '');
const semanticKey = (value) => String(value ?? '').replace(/[\s\p{P}\p{S}]+/gu, '');
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function push(errors, condition, code) {
  if (!condition) errors.push(code);
}

function validateAllowedKeys(value, allowed, errors, codePrefix) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    push(errors, allowed.has(key), `${codePrefix}_FIELD_FORBIDDEN:${key}`);
  }
}

function validTextList(value, minimum, maximum) {
  return list(value).length >= minimum && list(value).length <= maximum && list(value).every(text);
}

function resolveFile(projectRoot, declaredPath) {
  if (!text(declaredPath)) return null;
  const candidate = path.isAbsolute(declaredPath)
    ? path.normalize(declaredPath)
    : path.resolve(projectRoot, declaredPath);
  const relative = path.relative(path.resolve(projectRoot), candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if (!existsSync(candidate)) return candidate;
  try {
    const realRoot = realpathSync(projectRoot);
    const realCandidate = realpathSync(candidate);
    const realRelative = path.relative(realRoot, realCandidate);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) return null;
  } catch {
    return null;
  }
  return candidate;
}

function checkSha(filePath, expected) {
  return existsSync(filePath) && /^[a-f0-9]{64}$/.test(String(expected ?? '')) &&
    sha256(readFileSync(filePath)) === expected;
}

function validPngReference(filePath) {
  if (!existsSync(filePath) || path.extname(filePath).toLowerCase() !== '.png') return false;
  const bytes = readFileSync(filePath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) return false;
  if (bytes.subarray(12, 16).toString('ascii') !== 'IHDR') return false;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const ratio = width / height;
  return width >= 720 && height >= 405 && ratio >= 1.3 && ratio <= 2.1;
}

function validateReferences(references, projectRoot, errors, codePrefix, {required}) {
  push(errors, Array.isArray(references), `${codePrefix}_REFERENCES_INVALID`);
  if (required) push(errors, list(references).length > 0, `${codePrefix}_REFERENCE_REQUIRED`);
  const ids = new Set();
  for (const reference of list(references)) {
    const id = reference?.id ?? 'unknown';
    push(errors, text(reference?.id) && !ids.has(reference.id), `${codePrefix}_REFERENCE_ID_INVALID:${id}`);
    if (text(reference?.id)) ids.add(reference.id);
    push(errors, reference?.usage === 'style-mechanism-only', `${codePrefix}_REFERENCE_USAGE_INVALID:${id}`);
    const filePath = resolveFile(projectRoot, reference?.path);
    push(errors, filePath && checkSha(filePath, reference?.sha256), `${codePrefix}_REFERENCE_BINDING_INVALID:${id}`);
    push(errors, filePath && validPngReference(filePath), `${codePrefix}_REFERENCE_MEDIA_INVALID:${id}`);
  }
  return ids;
}

function validateStyleLock(style, projectRoot, errors, codePrefix, {referencesRequired}) {
  push(errors, style && typeof style === 'object', `${codePrefix}_STYLE_REQUIRED`);
  if (!style || typeof style !== 'object') return new Set();
  push(errors, text(style.promptPrefix) && characters(style.promptPrefix) <= 220, `${codePrefix}_STYLE_PREFIX_INVALID`);
  push(errors, validTextList(style.mustKeep, 3, 8), `${codePrefix}_STYLE_KEEP_RULES_INVALID`);
  push(errors, validTextList(style.mustAvoid, 3, 8), `${codePrefix}_STYLE_AVOID_RULES_INVALID`);
  return validateReferences(style.referenceImages ?? [], projectRoot, errors, codePrefix, {
    required: referencesRequired,
  });
}

function validateRoutePackage(routePackage, errors, codePrefix) {
  push(errors, routePackage && typeof routePackage === 'object', `${codePrefix}_PACKAGE_REQUIRED`);
  if (!routePackage || typeof routePackage !== 'object') return [];
  const items = list(routePackage.items);
  push(errors, Array.isArray(routePackage.items), `${codePrefix}_ITEMS_INVALID`);
  const expectedStatus = items.length > 0 ? 'planned' : 'not-required';
  push(errors, routePackage.status === expectedStatus, `${codePrefix}_STATUS_INVALID`);
  if (items.length === 0) {
    push(errors, text(routePackage.notRequiredReason), `${codePrefix}_NOT_REQUIRED_REASON_MISSING`);
  } else {
    push(errors, routePackage.notRequiredReason === null, `${codePrefix}_PLANNED_REASON_MUST_BE_NULL`);
  }
  return items;
}

function validateAnchors(item, beat, errors, codePrefix) {
  const start = String(item?.startAnchorText ?? '');
  const end = String(item?.endAnchorText ?? '');
  const source = String(beat?.scriptQuote ?? '');
  const startOffset = source.indexOf(start);
  const endOffset = source.indexOf(end);
  push(errors, text(start) && startOffset >= 0, `${codePrefix}_START_ANCHOR_MISMATCH:${item?.id ?? 'unknown'}`);
  push(errors, text(end) && endOffset >= 0, `${codePrefix}_END_ANCHOR_MISMATCH:${item?.id ?? 'unknown'}`);
  push(errors, startOffset >= 0 && endOffset >= startOffset + start.length, `${codePrefix}_ANCHOR_ORDER_INVALID:${item?.id ?? 'unknown'}`);
  push(
    errors,
    item?.timingStatus === 'pre-shoot-text-anchor-only' || item?.timingStatus === 'post-shoot-audio-bound',
    `${codePrefix}_TIMING_STATUS_INVALID:${item?.id ?? 'unknown'}`,
  );
}

function validatePromptPair(item, style, errors, codePrefix, {paper = false, referenceIds = new Set()}) {
  const id = item?.id ?? 'unknown';
  const firstFrame = String(item?.firstFramePrompt ?? '').trim();
  const video = String(item?.videoPrompt ?? '').trim();
  push(errors, characters(firstFrame) >= 80 && characters(firstFrame) <= 700, `${codePrefix}_FIRST_FRAME_LENGTH_INVALID:${id}`);
  push(errors, characters(video) >= 40 && characters(video) <= 400, `${codePrefix}_VIDEO_LENGTH_INVALID:${id}`);
  push(errors, firstFrame.startsWith(style?.promptPrefix ?? '__missing__'), `${codePrefix}_STYLE_PREFIX_MISSING:${id}`);
  push(errors, video.startsWith('基于已确认首帧'), `${codePrefix}_VIDEO_NOT_BOUND_TO_FIRST_FRAME:${id}`);
  push(errors, text(item?.primaryAction) && video.includes(item.primaryAction), `${codePrefix}_PRIMARY_ACTION_INVALID:${id}`);
  push(errors, validTextList(item?.negativePrompt, 3, 8), `${codePrefix}_NEGATIVE_PROMPT_INVALID:${id}`);
  for (const word of TECHNICAL_PROMPT_TERMS) {
    push(errors, !firstFrame.includes(word) && !video.includes(word), `${codePrefix}_TECHNICAL_PROMPT_POLLUTION:${id}:${word}`);
  }
  for (const word of FIRST_FRAME_MOTION_WORDS) {
    push(errors, !firstFrame.includes(word), `${codePrefix}_FIRST_FRAME_CONTAINS_MOTION:${id}:${word}`);
  }
  for (const word of VIDEO_SEQUENCE_WORDS) {
    push(errors, !video.includes(word), `${codePrefix}_VIDEO_CONTAINS_SEQUENCE:${id}:${word}`);
  }
  if (!paper) return;
  const textPlan = list(item?.textPlan);
  push(
    errors,
    textPlan.length >= 1 && textPlan.length <= 4 && textPlan.every((entry) => (
      entry && typeof entry === 'object' && text(entry.text) && characters(entry.text) <= 8 &&
      text(entry.surface) && characters(entry.surface) <= 24
    )),
    `${codePrefix}_TEXT_PLAN_INVALID:${id}`,
  );
  push(errors, new Set(textPlan.map((entry) => semanticKey(entry?.text))).size === textPlan.length, `${codePrefix}_TEXT_PLAN_LABEL_INVALID:${id}`);
  push(errors, new Set(textPlan.map((entry) => semanticKey(entry?.surface))).size === textPlan.length, `${codePrefix}_TEXT_PLAN_SURFACE_DUPLICATED:${id}`);
  for (const entry of textPlan) {
    push(errors, firstFrame.includes(entry.surface), `${codePrefix}_TEXT_PLAN_SURFACE_INVALID:${id}`);
    push(errors, !firstFrame.includes(entry.text), `${codePrefix}_TEXT_LEAKED_TO_FIRST_FRAME:${id}:${entry.text}`);
  }
  push(
    errors,
    list(item?.referenceImageIds).length > 0 && item.referenceImageIds.every((refId) => referenceIds.has(refId)),
    `${codePrefix}_REFERENCE_ID_UNKNOWN:${id}`,
  );
  for (const word of GENERATED_SYMBOL_TERMS) {
    push(errors, !firstFrame.includes(word), `${codePrefix}_FIRST_FRAME_SYMBOL_RISK:${id}:${word}`);
  }
}

function speakerRuns(beats) {
  const runs = [];
  let start = null;
  for (let index = 0; index <= beats.length; index += 1) {
    const beat = beats[index];
    if (beat?.primaryRoute === 'speaker') {
      if (start === null) start = index;
      continue;
    }
    if (start !== null && index - start >= 1) {
      runs.push({fromBeatId: beats[start].id, toBeatId: beats[index - 1].id});
    }
    start = null;
  }
  return runs;
}

export function validateDirectorCuesV2({cues, projectRoot, scriptText}) {
  const errors = [];
  push(errors, cues?.schemaVersion === DIRECTOR_CUES_V2_SCHEMA, 'DIRECTOR_V2_SCHEMA_INVALID');
  push(errors, text(cues?.taskId), 'DIRECTOR_V2_TASK_ID_REQUIRED');
  push(errors, cues?.status === 'ready-for-user-review', 'DIRECTOR_V2_STATUS_INVALID');
  push(errors, cues?.executionScope === 'director-only', 'DIRECTOR_V2_EXECUTION_SCOPE_INVALID');
  push(
    errors,
    cues?.handoffGate?.status === 'blocked-awaiting-user-approval' &&
      cues?.handoffGate?.downstreamAllowed === false,
    'DIRECTOR_V2_HANDOFF_GATE_INVALID',
  );
  push(errors, SCRIPT_AUTHORITIES.has(cues?.inputScript?.authority), 'DIRECTOR_V2_SCRIPT_AUTHORITY_INVALID');

  const source = String(scriptText ?? '');
  push(errors, text(source), 'DIRECTOR_V2_SCRIPT_EMPTY');

  const policy = cues?.routingPolicy ?? {};
  push(errors, policy.selectionBasis === 'semantic-need-not-fixed-cadence', 'DIRECTOR_V2_SELECTION_BASIS_INVALID');
  push(errors, policy.speakerIsFallback === true, 'DIRECTOR_V2_SPEAKER_FALLBACK_REQUIRED');
  push(errors, policy.generatedInsertMinimum === 0 && policy.paperInsertMinimum === 0, 'DIRECTOR_V2_GENERATED_QUOTA_FORBIDDEN');
  push(errors, policy.fixedCadenceForbidden === true, 'DIRECTOR_V2_FIXED_CADENCE_FORBIDDEN');
  push(errors, policy.generatedVisualCannotServeAsEvidence === true, 'DIRECTOR_V2_GENERATED_EVIDENCE_FORBIDDEN');
  push(errors, policy.shotcraftSelectionStage === 'post-shoot-edit-release', 'DIRECTOR_V2_SHOTCRAFT_STAGE_INVALID');
  push(
    errors,
    JSON.stringify(policy.shotcraftEligibleRoutes) === JSON.stringify(['speaker', 'real-evidence']) &&
      JSON.stringify(policy.shotcraftForbiddenInsideRoutes) === JSON.stringify(['paper-editorial', 'ai-generated-video']),
    'DIRECTOR_V2_SHOTCRAFT_ROUTE_BOUNDARY_INVALID',
  );
  for (const key of ['targetCadenceSeconds', 'minimumInsertCount', 'minInsertCount']) {
    push(errors, !Object.hasOwn(policy, key), `DIRECTOR_V2_MECHANICAL_POLICY_FORBIDDEN:${key}`);
  }

  const summary = cues?.selectionSummary ?? {};
  push(errors, text(summary.mainPoint), 'DIRECTOR_V2_MAIN_POINT_REQUIRED');
  push(errors, list(summary.argumentFlow).length >= 1 && summary.argumentFlow.every(text), 'DIRECTOR_V2_ARGUMENT_FLOW_INVALID');
  push(errors, text(summary.visualRhythmReason), 'DIRECTOR_V2_VISUAL_RHYTHM_REASON_REQUIRED');
  const rationales = summary.routeRationales ?? {};
  for (const route of ROUTES) {
    push(errors, text(rationales[route]), `DIRECTOR_V2_ROUTE_RATIONALE_REQUIRED:${route}`);
  }

  const beats = list(cues?.semanticBeats);
  push(errors, beats.length > 0, 'DIRECTOR_V2_SEMANTIC_BEATS_REQUIRED');
  const beatById = new Map();
  const routeCounts = {speaker: 0, 'real-evidence': 0, 'ai-generated-video': 0, 'paper-editorial': 0};
  let cursor = 0;
  const beatIds = new Set();
  for (const [index, beat] of beats.entries()) {
    const id = beat?.id ?? `index-${index}`;
    validateAllowedKeys(beat, BEAT_FIELDS, errors, `DIRECTOR_V2_BEAT:${id}`);
    push(errors, /^B\d{2,3}$/.test(id) && !beatIds.has(id), `DIRECTOR_V2_BEAT_ID_INVALID:${id}`);
    beatIds.add(id);
    beatById.set(id, beat);
    push(errors, beat?.order === index + 1, `DIRECTOR_V2_BEAT_ORDER_INVALID:${id}`);
    const quote = String(beat?.scriptQuote ?? '');
    const offset = source.indexOf(quote, cursor);
    push(errors, text(quote) && offset >= 0, `DIRECTOR_V2_BEAT_QUOTE_MISMATCH:${id}`);
    if (offset >= 0) cursor = offset + quote.length;
    push(errors, ROUTES.has(beat?.primaryRoute), `DIRECTOR_V2_ROUTE_INVALID:${id}`);
    if (ROUTES.has(beat?.primaryRoute)) routeCounts[beat.primaryRoute] += 1;
    push(errors, text(beat?.rhetoricalRole), `DIRECTOR_V2_RHETORICAL_ROLE_REQUIRED:${id}`);
    push(errors, CLAIM_CLASSES.has(beat?.claimClass), `DIRECTOR_V2_CLAIM_CLASS_INVALID:${id}`);
    push(errors, typeof beat?.requiresRealEvidence === 'boolean', `DIRECTOR_V2_REAL_EVIDENCE_FLAG_REQUIRED:${id}`);
    if (['factual-claim', 'real-operation'].includes(beat?.claimClass)) {
      push(errors, beat?.requiresRealEvidence === true, `DIRECTOR_V2_FACTUAL_EVIDENCE_REQUIRED:${id}`);
    }
    if (beat?.requiresRealEvidence === true) {
      push(errors, beat?.primaryRoute === 'real-evidence', `DIRECTOR_V2_EVIDENCE_ROUTE_REQUIRED:${id}`);
    }
    push(errors, text(beat?.decisionReason), `DIRECTOR_V2_DECISION_REASON_REQUIRED:${id}`);
    push(errors, text(beat?.viewerGain), `DIRECTOR_V2_VIEWER_GAIN_REQUIRED:${id}`);
    if (beat?.primaryRoute === 'speaker') {
      push(errors, beat?.routeCueId === null, `DIRECTOR_V2_SPEAKER_CUE_FORBIDDEN:${id}`);
    } else {
      push(errors, text(beat?.routeCueId), `DIRECTOR_V2_ROUTE_CUE_REQUIRED:${id}`);
    }
    if (beat?.primaryRoute === 'real-evidence') {
      push(errors, ['factual-claim', 'real-operation'].includes(beat?.claimClass) && beat?.requiresRealEvidence === true, `DIRECTOR_V2_REAL_BEAT_CLASS_INVALID:${id}`);
    }
    if (beat?.primaryRoute === 'ai-generated-video') {
      push(errors, beat?.claimClass === 'generic-illustration' && beat?.requiresRealEvidence === false, `DIRECTOR_V2_AI_BEAT_CLASS_INVALID:${id}`);
    }
    if (beat?.primaryRoute === 'paper-editorial') {
      push(errors, beat?.claimClass === 'abstract-explanation' && beat?.requiresRealEvidence === false, `DIRECTOR_V2_PAPER_BEAT_CLASS_INVALID:${id}`);
    }
  }
  push(errors, normalized(beats.map((beat) => beat?.scriptQuote ?? '').join('')) === normalized(source), 'DIRECTOR_V2_SEMANTIC_COVERAGE_INCOMPLETE');

  const declaredCounts = summary.routeCounts ?? {};
  for (const route of ROUTES) {
    push(errors, declaredCounts[route] === routeCounts[route], `DIRECTOR_V2_ROUTE_COUNT_MISMATCH:${route}`);
  }

  const routePlans = cues?.routePlans ?? {};
  const realItems = validateRoutePackage(routePlans.realMaterials, errors, 'DIRECTOR_V2_REAL');
  const aiItems = validateRoutePackage(routePlans.aiGeneratedVideos, errors, 'DIRECTOR_V2_AI');
  const paperItems = validateRoutePackage(routePlans.paperEditorials, errors, 'DIRECTOR_V2_PAPER');
  const allCueIds = new Set();
  const cueById = new Map();
  const registerCue = (item, pattern, route, codePrefix) => {
    const id = item?.id ?? 'unknown';
    push(errors, pattern.test(id) && !allCueIds.has(id), `${codePrefix}_ID_INVALID:${id}`);
    if (text(id)) {
      allCueIds.add(id);
      cueById.set(id, {item, route});
    }
    const beat = beatById.get(item?.beatId);
    push(errors, Boolean(beat), `${codePrefix}_BEAT_UNKNOWN:${id}`);
    push(errors, beat?.primaryRoute === route && beat?.routeCueId === id, `${codePrefix}_BEAT_ROUTE_MISMATCH:${id}`);
    if (beat) validateAnchors(item, beat, errors, codePrefix);
    return beat;
  };

  for (const item of realItems) {
    validateAllowedKeys(item, REAL_ITEM_FIELDS, errors, `DIRECTOR_V2_REAL:${item?.id ?? 'unknown'}`);
    const beat = registerCue(item, /^R\d{2,3}$/, 'real-evidence', 'DIRECTOR_V2_REAL');
    push(errors, REAL_ASSET_TYPES.has(item?.assetType), `DIRECTOR_V2_REAL_ASSET_TYPE_INVALID:${item?.id ?? 'unknown'}`);
    push(errors, REAL_USAGE_ROLES.has(item?.usageRole), `DIRECTOR_V2_REAL_USAGE_ROLE_INVALID:${item?.id ?? 'unknown'}`);
    push(errors, text(item?.materialRequest), `DIRECTOR_V2_REAL_REQUEST_REQUIRED:${item?.id ?? 'unknown'}`);
    push(errors, text(item?.reason), `DIRECTOR_V2_REAL_REASON_REQUIRED:${item?.id ?? 'unknown'}`);
    push(errors, REAL_FALLBACKS.has(item?.fallbackIfUnavailable), `DIRECTOR_V2_REAL_FALLBACK_INVALID:${item?.id ?? 'unknown'}`);
    push(errors, item?.generatedSubstituteAllowed === false, `DIRECTOR_V2_REAL_GENERATED_SUBSTITUTE_FORBIDDEN:${item?.id ?? 'unknown'}`);
    push(errors, !Object.hasOwn(item ?? {}, 'firstFramePrompt') && !Object.hasOwn(item ?? {}, 'videoPrompt'), `DIRECTOR_V2_REAL_GENERATION_FIELD_FORBIDDEN:${item?.id ?? 'unknown'}`);
    if (item?.evidenceStatus === 'candidate-unbound') {
      push(errors, item?.usableInProduction === false && item?.sourceBinding === null, `DIRECTOR_V2_REAL_UNBOUND_STATE_INVALID:${item?.id ?? 'unknown'}`);
      push(
        errors,
        item?.fallbackIfUnavailable !== 'keep-speaker',
        `DIRECTOR_V2_REAL_EVIDENCE_FALLBACK_TOO_WEAK:${item?.id ?? 'unknown'}`,
      );
    } else if (item?.evidenceStatus === 'bound-verified') {
      const filePath = resolveFile(projectRoot, item?.sourceBinding?.path);
      validateAllowedKeys(item?.sourceBinding, REAL_BINDING_FIELDS, errors, `DIRECTOR_V2_REAL_BINDING:${item?.id ?? 'unknown'}`);
      push(
        errors,
        item?.usableInProduction === true && filePath && checkSha(filePath, item?.sourceBinding?.sha256) &&
          REAL_ASSET_EXTENSIONS[item?.assetType]?.has(path.extname(filePath).toLowerCase()) &&
          text(item?.sourceBinding?.provenance) &&
          REAL_RIGHTS_STATUSES.has(item?.sourceBinding?.rightsStatus) &&
          item?.sourceBinding?.reviewedBy === 'human' &&
          text(item?.sourceBinding?.reviewedAt) && Number.isFinite(Date.parse(item.sourceBinding.reviewedAt)),
        `DIRECTOR_V2_REAL_BINDING_REQUIRED:${item?.id ?? 'unknown'}`,
      );
    } else {
      errors.push(`DIRECTOR_V2_REAL_EVIDENCE_STATUS_INVALID:${item?.id ?? 'unknown'}`);
    }
    push(errors, beat?.viewerGain === 'proof' || beat?.viewerGain === 'show-operation' || beat?.viewerGain === 'context', `DIRECTOR_V2_REAL_VIEWER_GAIN_INVALID:${item?.id ?? 'unknown'}`);
  }

  const aiStyle = cues?.styleLocks?.aiGeneratedVideo ?? null;
  if (aiItems.length > 0) {
    validateStyleLock(aiStyle, projectRoot, errors, 'DIRECTOR_V2_AI', {referencesRequired: false});
  } else {
    push(errors, aiStyle === null, 'DIRECTOR_V2_AI_UNUSED_STYLE_MUST_BE_NULL');
  }
  for (const item of aiItems) {
    const beat = registerCue(item, /^G\d{2,3}$/, 'ai-generated-video', 'DIRECTOR_V2_AI');
    push(errors, item?.purpose === 'illustration-only', `DIRECTOR_V2_AI_PURPOSE_INVALID:${item?.id ?? 'unknown'}`);
    push(errors, item?.representationPolicy === 'synthetic-not-evidence', `DIRECTOR_V2_AI_REPRESENTATION_INVALID:${item?.id ?? 'unknown'}`);
    push(errors, item?.evidenceEligible === false, `DIRECTOR_V2_AI_EVIDENCE_ROLE_INVALID:${item?.id ?? 'unknown'}`);
    push(errors, item?.disclosureRequired === true, `DIRECTOR_V2_AI_DISCLOSURE_REQUIRED:${item?.id ?? 'unknown'}`);
    push(errors, item?.realEntityReenactmentForbidden === true, `DIRECTOR_V2_AI_REAL_ENTITY_REENACTMENT_FORBIDDEN:${item?.id ?? 'unknown'}`);
    push(errors, item?.mode === 'image-to-video', `DIRECTOR_V2_AI_MODE_INVALID:${item?.id ?? 'unknown'}`);
    push(errors, Number.isFinite(item?.durationSeconds) && item.durationSeconds >= 2 && item.durationSeconds <= 8, `DIRECTOR_V2_AI_DURATION_INVALID:${item?.id ?? 'unknown'}`);
    push(errors, text(item?.visualIntent), `DIRECTOR_V2_AI_VISUAL_INTENT_REQUIRED:${item?.id ?? 'unknown'}`);
    push(errors, beat?.viewerGain === 'make-scene-concrete', `DIRECTOR_V2_AI_VIEWER_GAIN_INVALID:${item?.id ?? 'unknown'}`);
    validatePromptPair(item, aiStyle, errors, 'DIRECTOR_V2_AI', {paper: false});
  }

  const paperStyle = cues?.styleLocks?.paperEditorial ?? null;
  let paperReferenceIds = new Set();
  if (paperItems.length > 0) {
    paperReferenceIds = validateStyleLock(paperStyle, projectRoot, errors, 'DIRECTOR_V2_PAPER', {referencesRequired: true});
    push(errors, paperStyle?.textPolicy === 'generated-base-image-then-deterministic-chinese', 'DIRECTOR_V2_PAPER_TEXT_POLICY_INVALID');
  } else {
    push(errors, paperStyle === null, 'DIRECTOR_V2_PAPER_UNUSED_STYLE_MUST_BE_NULL');
  }
  const metaphors = new Set();
  const compositions = new Set();
  for (const item of paperItems) {
    const beat = registerCue(item, /^P\d{2,3}$/, 'paper-editorial', 'DIRECTOR_V2_PAPER');
    push(errors, Number.isFinite(item?.durationSeconds) && item.durationSeconds >= 2 && item.durationSeconds <= 8, `DIRECTOR_V2_PAPER_DURATION_INVALID:${item?.id ?? 'unknown'}`);
    push(errors, text(item?.reason), `DIRECTOR_V2_PAPER_REASON_REQUIRED:${item?.id ?? 'unknown'}`);
    push(errors, VISUAL_ROLES.has(item?.visualRole), `DIRECTOR_V2_PAPER_VISUAL_ROLE_INVALID:${item?.id ?? 'unknown'}`);
    push(errors, text(item?.visualMetaphor) && !metaphors.has(semanticKey(item.visualMetaphor)), `DIRECTOR_V2_PAPER_METAPHOR_NOT_UNIQUE:${item?.id ?? 'unknown'}`);
    metaphors.add(semanticKey(item?.visualMetaphor));
    push(errors, text(item?.composition) && !compositions.has(semanticKey(item.composition)), `DIRECTOR_V2_PAPER_COMPOSITION_NOT_UNIQUE:${item?.id ?? 'unknown'}`);
    compositions.add(semanticKey(item?.composition));
    push(errors, beat?.viewerGain === 'explain-mechanism', `DIRECTOR_V2_PAPER_VIEWER_GAIN_INVALID:${item?.id ?? 'unknown'}`);
    validatePromptPair(item, paperStyle, errors, 'DIRECTOR_V2_PAPER', {paper: true, referenceIds: paperReferenceIds});
  }

  const referencedCueIds = new Set();
  for (const beat of beats) {
    if (beat?.primaryRoute === 'speaker') continue;
    const registered = cueById.get(beat?.routeCueId);
    push(errors, registered?.route === beat?.primaryRoute, `DIRECTOR_V2_ROUTE_CUE_UNKNOWN:${beat?.id ?? 'unknown'}`);
    push(errors, !referencedCueIds.has(beat?.routeCueId), `DIRECTOR_V2_ROUTE_CUE_REUSED:${beat?.routeCueId ?? 'unknown'}`);
    referencedCueIds.add(beat?.routeCueId);
  }
  for (const cueId of allCueIds) {
    push(errors, referencedCueIds.has(cueId), `DIRECTOR_V2_ORPHAN_ROUTE_CUE:${cueId}`);
  }
  push(errors, realItems.length === routeCounts['real-evidence'], 'DIRECTOR_V2_REAL_COUNT_MISMATCH');
  push(errors, aiItems.length === routeCounts['ai-generated-video'], 'DIRECTOR_V2_AI_COUNT_MISMATCH');
  push(errors, paperItems.length === routeCounts['paper-editorial'], 'DIRECTOR_V2_PAPER_COUNT_MISMATCH');

  const protectedIds = list(summary.protectedSpeakerBeatIds);
  push(errors, Array.isArray(summary.protectedSpeakerBeatIds) && new Set(protectedIds).size === protectedIds.length, 'DIRECTOR_V2_PROTECTED_SPEAKER_IDS_INVALID');
  for (const id of protectedIds) {
    push(errors, beatById.get(id)?.primaryRoute === 'speaker', `DIRECTOR_V2_PROTECTED_SPEAKER_ROUTE_INVALID:${id}`);
  }

  const opportunities = list(cues?.shotcraftOpportunities);
  push(errors, Array.isArray(cues?.shotcraftOpportunities), 'DIRECTOR_V2_SHOTCRAFT_LIST_INVALID');
  push(errors, summary?.routeCounts?.shotcraftOpportunity === opportunities.length, 'DIRECTOR_V2_SHOTCRAFT_COUNT_MISMATCH');
  const opportunityIds = new Set();
  const opportunityById = new Map();
  for (const opportunity of opportunities) {
    const id = opportunity?.id ?? 'unknown';
    validateAllowedKeys(opportunity, SHOTCRAFT_FIELDS, errors, `DIRECTOR_V2_SHOTCRAFT:${id}`);
    push(errors, /^SO\d{2,3}$/.test(id) && !opportunityIds.has(id), `DIRECTOR_V2_SHOTCRAFT_ID_INVALID:${id}`);
    opportunityIds.add(id);
    opportunityById.set(id, opportunity);
    const beat = beatById.get(opportunity?.beatId);
    push(errors, beat?.primaryRoute === opportunity?.baseVisualRoute && ['speaker', 'real-evidence'].includes(opportunity?.baseVisualRoute), `DIRECTOR_V2_SHOTCRAFT_BEAT_ROUTE_INVALID:${id}`);
    push(errors, SHOTCRAFT_INTENTS.has(opportunity?.intent), `DIRECTOR_V2_SHOTCRAFT_INTENT_INVALID:${id}`);
    push(errors, text(opportunity?.reason), `DIRECTOR_V2_SHOTCRAFT_REASON_REQUIRED:${id}`);
    push(errors, opportunity?.status === 'opportunity-only-post-shoot-selection-pending', `DIRECTOR_V2_SHOTCRAFT_STATUS_INVALID:${id}`);
    push(errors, opportunity?.catalogScope === 'full-current-catalog', `DIRECTOR_V2_SHOTCRAFT_CATALOG_SCOPE_INVALID:${id}`);
    for (const key of FORBIDDEN_SHOTCRAFT_FIELDS) {
      push(errors, !Object.hasOwn(opportunity ?? {}, key), `DIRECTOR_V2_SHOTCRAFT_PRESELECT_FORBIDDEN:${id}:${key}`);
    }
  }

  const audit = cues?.rhythmAudit ?? {};
  push(errors, audit.basis === 'semantic-runs-not-seconds', 'DIRECTOR_V2_RHYTHM_BASIS_INVALID');
  push(errors, audit.fixedCadenceForbidden === true && audit.longSpeakerRunsReviewed === true, 'DIRECTOR_V2_RHYTHM_POLICY_INVALID');
  const requiredRuns = speakerRuns(beats);
  const declaredRuns = list(audit.runs);
  push(errors, Array.isArray(audit.runs), 'DIRECTOR_V2_RHYTHM_RUNS_INVALID');
  const requiredRunKeys = new Set(requiredRuns.map((run) => `${run.fromBeatId}:${run.toBeatId}`));
  const declaredRunKeys = new Set();
  const beatIndexById = new Map(beats.map((beat, index) => [beat.id, index]));
  for (const run of declaredRuns) {
    const key = `${run?.fromBeatId}:${run?.toBeatId}`;
    push(errors, requiredRunKeys.has(key) && !declaredRunKeys.has(key), `DIRECTOR_V2_RHYTHM_RUN_INVALID:${key}`);
    declaredRunKeys.add(key);
    push(errors, RHYTHM_RISKS.has(run?.risk), `DIRECTOR_V2_RHYTHM_RISK_INVALID:${key}`);
    push(errors, RHYTHM_DECISIONS.has(run?.decision), `DIRECTOR_V2_RHYTHM_DECISION_INVALID:${key}`);
    push(errors, text(run?.reason), `DIRECTOR_V2_RHYTHM_REASON_REQUIRED:${key}`);
    push(errors, Array.isArray(run?.mitigationRefs), `DIRECTOR_V2_RHYTHM_REFS_INVALID:${key}`);
    for (const ref of list(run?.mitigationRefs)) {
      push(errors, allCueIds.has(ref) || opportunityIds.has(ref), `DIRECTOR_V2_RHYTHM_REF_UNKNOWN:${key}:${ref}`);
    }
    if (run?.decision === 'shotcraft-opportunity') {
      const start = beatIndexById.get(run?.fromBeatId);
      const end = beatIndexById.get(run?.toBeatId);
      push(errors, list(run?.mitigationRefs).length > 0, `DIRECTOR_V2_RHYTHM_SHOTCRAFT_REF_REQUIRED:${key}`);
      for (const ref of list(run?.mitigationRefs)) {
        const opportunity = opportunityById.get(ref);
        const opportunityBeatIndex = beatIndexById.get(opportunity?.beatId);
        push(
          errors,
          opportunity?.baseVisualRoute === 'speaker' &&
            Number.isInteger(start) && Number.isInteger(end) &&
            Number.isInteger(opportunityBeatIndex) && opportunityBeatIndex >= start && opportunityBeatIndex <= end,
          `DIRECTOR_V2_RHYTHM_SHOTCRAFT_REF_OUTSIDE_RUN:${key}:${ref}`,
        );
      }
    } else {
      push(errors, list(run?.mitigationRefs).length === 0, `DIRECTOR_V2_RHYTHM_UNUSED_REF_FORBIDDEN:${key}`);
    }
  }
  for (const key of requiredRunKeys) {
    push(errors, declaredRunKeys.has(key), `DIRECTOR_V2_RHYTHM_RUN_UNREVIEWED:${key}`);
  }
  return {ok: errors.length === 0, errors};
}

export function validateDirectorCuesV2File({inputPath, projectRoot}) {
  const cues = JSON.parse(readFileSync(inputPath, 'utf8'));
  const scriptPath = resolveFile(projectRoot, cues?.inputScript?.path);
  if (!scriptPath || !existsSync(scriptPath)) {
    return {ok: false, errors: ['DIRECTOR_V2_SCRIPT_FILE_MISSING']};
  }
  if (!checkSha(scriptPath, cues?.inputScript?.sha256)) {
    return {ok: false, errors: ['DIRECTOR_V2_SCRIPT_SHA_MISMATCH']};
  }
  return validateDirectorCuesV2({
    cues,
    projectRoot,
    scriptText: readFileSync(scriptPath, 'utf8'),
  });
}
