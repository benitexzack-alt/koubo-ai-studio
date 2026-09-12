import {createHash, randomUUID} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {validateDirectorCuesV2File} from './director-cues-v2-core.mjs';

export const DIRECTOR_CUES_V2_APPROVAL_SCHEMA = 'koubo-director-cues-user-approval/v2';
export const DIRECTOR_CUES_V2_HANDOFF_SCHEMA = 'koubo-director-cues-v2-handoff/v1';
export const ROUTE_PROMPT_HANDOFF_SCHEMA = 'koubo-director-route-prompt-handoff/v1';
export const REAL_EVIDENCE_HANDOFF_SCHEMA = 'koubo-director-real-evidence-handoff/v1';
export const SHOTCRAFT_OPPORTUNITY_HANDOFF_SCHEMA = 'koubo-director-shotcraft-opportunity-handoff/v1';
export const DIRECTOR_CUES_V2_HANDOFF_RECEIPT_SCHEMA = 'koubo-director-cues-v2-handoff-validation-receipt/v1';

const SOURCE_ROUTES = Object.freeze([
  'speaker',
  'real-evidence',
  'ai-generated-video',
  'paper-editorial',
]);

const OUTPUT_FILES = Object.freeze({
  realEvidence: 'real-evidence-handoff.v1.json',
  aiFirstFrame: 'ai-generated-video.first-frame-handoff.v1.json',
  aiVideo: 'ai-generated-video.image-to-video-handoff.v1.json',
  paperFirstFrame: 'paper-editorial.first-frame-handoff.v1.json',
  paperVideo: 'paper-editorial.image-to-video-handoff.v1.json',
  shotcraft: 'shotcraft-opportunities.handoff.v1.json',
  master: 'director-cues-v2-handoff.v1.json',
  receipt: 'director-cues-v2-handoff-validation-receipt.v1.json',
});

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isSha256 = (value) => /^[a-f0-9]{64}$/.test(String(value ?? ''));
const hasExplicitTimezone = (value) => /T.*(?:Z|[+-]\d{2}:\d{2})$/u.test(String(value ?? ''));
const clone = (value) => structuredClone(value);

function failUnless(condition, code) {
  if (!condition) throw new Error(code);
}

function normalizedProjectRoot(projectRoot) {
  const root = realpathSync(path.resolve(projectRoot));
  failUnless(statSync(root).isDirectory(), 'DIRECTOR_V2_HANDOFF_PROJECT_ROOT_INVALID');
  return root;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveExistingFile(root, declaredPath, code) {
  failUnless(text(declaredPath), `${code}_PATH_REQUIRED`);
  const candidate = path.isAbsolute(declaredPath)
    ? path.normalize(declaredPath)
    : path.resolve(root, declaredPath);
  failUnless(isInside(root, candidate), `${code}_OUTSIDE_PROJECT`);
  failUnless(existsSync(candidate), `${code}_MISSING`);
  const resolved = realpathSync(candidate);
  failUnless(isInside(root, resolved), `${code}_OUTSIDE_PROJECT`);
  failUnless(statSync(resolved).isFile(), `${code}_NOT_FILE`);
  return resolved;
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function binding(root, filePath, bytes = readFileSync(filePath)) {
  return {path: relativePath(root, filePath), sha256: sha256(bytes)};
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseJsonBytes(bytes, code) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${code}_JSON_INVALID`);
  }
}

function approvalErrors({approval, approvalPath, cues, cuesPath, cuesSha256, root}) {
  const errors = [];
  const add = (condition, code) => { if (!condition) errors.push(code); };
  add(approval?.schemaVersion === DIRECTOR_CUES_V2_APPROVAL_SCHEMA, 'APPROVAL_SCHEMA_INVALID');
  add(approval?.status === 'approved', 'APPROVAL_STATUS_INVALID');
  add(approval?.approved === true, 'APPROVAL_NOT_APPROVED');
  add(approval?.taskId === cues?.taskId, 'APPROVAL_TASK_MISMATCH');
  add(text(approval?.revisionId), 'APPROVAL_REVISION_ID_REQUIRED');
  add(text(approval?.userQuote), 'APPROVAL_USER_QUOTE_REQUIRED');
  add(
    text(approval?.approvedAt) && hasExplicitTimezone(approval.approvedAt) && Number.isFinite(Date.parse(approval.approvedAt)),
    'APPROVAL_TIME_INVALID',
  );
  add(Array.isArray(approval?.exceptions) && approval.exceptions.length === 0, 'APPROVAL_EXCEPTIONS_UNRESOLVED');
  const declared = approval?.bindings?.directorCues;
  add(declared && typeof declared === 'object', 'APPROVAL_CUES_BINDING_REQUIRED');
  add(isSha256(declared?.sha256) && declared.sha256 === cuesSha256, 'APPROVAL_CUES_SHA_MISMATCH');
  if (text(declared?.path)) {
    try {
      const boundPath = resolveExistingFile(root, declared.path, 'APPROVAL_CUES_BINDING');
      add(boundPath === cuesPath, 'APPROVAL_CUES_PATH_MISMATCH');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'APPROVAL_CUES_BINDING_INVALID');
    }
  } else {
    errors.push('APPROVAL_CUES_PATH_REQUIRED');
  }
  add(approvalPath !== cuesPath, 'APPROVAL_FILE_MUST_BE_SEPARATE');
  return errors;
}

function validateProfile(profile) {
  const errors = [];
  const add = (condition, code) => { if (!condition) errors.push(code); };
  add(profile?.schemaVersion === 'koubo-active-director-profile/v1', 'PROFILE_SCHEMA_INVALID');
  add(/^\d+\.\d+\.\d+$/.test(String(profile?.profileVersion ?? '')), 'PROFILE_VERSION_INVALID');
  add(profile?.scopeBoundary?.directorPlanningOutput === 'koubo-director-cues/v2', 'PROFILE_DIRECTOR_OUTPUT_INVALID');
  add(profile?.scopeBoundary?.appliesToDirectorPlanning === false, 'PROFILE_DIRECTOR_SCOPE_INVALID');
  add(profile?.scopeBoundary?.appliesAfter === 'user-approved-director-cues', 'PROFILE_APPLIES_AFTER_INVALID');
  add(profile?.scopeBoundary?.userApprovalRequiredBeforeDownstream === true, 'PROFILE_APPROVAL_GATE_MISSING');

  const routeMap = profile?.routingPolicy?.directorCueRouteMap;
  add(routeMap && typeof routeMap === 'object' && !Array.isArray(routeMap), 'PROFILE_ROUTE_MAP_REQUIRED');
  const keys = routeMap && typeof routeMap === 'object' ? Object.keys(routeMap) : [];
  add(JSON.stringify(keys.sort()) === JSON.stringify([...SOURCE_ROUTES].sort()), 'PROFILE_ROUTE_MAP_KEYS_INVALID');
  const downstreamClasses = profile?.routingPolicy?.mainVisualClasses;
  add(Array.isArray(downstreamClasses) && downstreamClasses.length > 0, 'PROFILE_MAIN_VISUAL_CLASSES_INVALID');
  for (const route of SOURCE_ROUTES) {
    add(text(routeMap?.[route]) && downstreamClasses?.includes(routeMap[route]), `PROFILE_ROUTE_TARGET_INVALID:${route}`);
  }
  add(new Set(SOURCE_ROUTES.map((route) => routeMap?.[route])).size === SOURCE_ROUTES.length, 'PROFILE_ROUTE_TARGETS_NOT_ONE_TO_ONE');
  add(routeMap?.['ai-generated-video'] === 'generated-video', 'PROFILE_AI_ROUTE_COMPATIBILITY_INVALID');
  add(routeMap?.speaker === 'speaker', 'PROFILE_SPEAKER_ROUTE_COMPATIBILITY_INVALID');
  add(routeMap?.['real-evidence'] === 'real-evidence', 'PROFILE_REAL_ROUTE_COMPATIBILITY_INVALID');
  add(routeMap?.['paper-editorial'] === 'paper-editorial', 'PROFILE_PAPER_ROUTE_COMPATIBILITY_INVALID');
  return errors;
}

function validateCuesLocalPaths({cues, root}) {
  const errors = [];
  const inspect = (declaredPath, code) => {
    try {
      resolveExistingFile(root, declaredPath, code);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${code}_INVALID`);
    }
  };
  inspect(cues?.inputScript?.path, 'DIRECTOR_V2_HANDOFF_SCRIPT');
  for (const [styleName, style] of Object.entries(cues?.styleLocks ?? {})) {
    for (const [index, reference] of (style?.referenceImages ?? []).entries()) {
      inspect(reference?.path, `DIRECTOR_V2_HANDOFF_STYLE_REFERENCE:${styleName}:${index}`);
    }
  }
  for (const item of cues?.routePlans?.realMaterials?.items ?? []) {
    if (item?.sourceBinding !== null && item?.sourceBinding !== undefined) {
      inspect(item.sourceBinding.path, `DIRECTOR_V2_HANDOFF_REAL_SOURCE:${item?.id ?? 'unknown'}`);
    }
  }
  return errors;
}

function commonManifest({schemaVersion, cues, approval, source, route, downstreamRoute, status, reason}) {
  return {
    schemaVersion,
    taskId: cues.taskId,
    revisionId: approval.revisionId,
    status,
    sourceRoute: route,
    downstreamRoute,
    notRequiredReason: reason,
    source,
    executionScope: 'local-handoff-only',
    externalActionsAuthorized: false,
    generationStarted: false,
  };
}

function pairSha(item) {
  return sha256(`${item.id}\u0000${item.firstFramePrompt}\u0000${item.videoPrompt}`);
}

function buildPromptManifest({cues, approval, source, route, downstreamRoute, routePackage, promptKind, styleLock}) {
  const items = routePackage.items.map((item) => {
    const base = {
      id: item.id,
      beatId: item.beatId,
      startAnchorText: item.startAnchorText,
      endAnchorText: item.endAnchorText,
      timingStatus: item.timingStatus,
      durationSeconds: item.durationSeconds,
      pairId: `${item.id}-prompt-pair-v1`,
      pairSha256: pairSha(item),
      prompt: promptKind === 'first-frame' ? item.firstFramePrompt : item.videoPrompt,
      promptSha256: sha256(promptKind === 'first-frame' ? item.firstFramePrompt : item.videoPrompt),
      negativePrompt: clone(item.negativePrompt),
    };
    if (promptKind === 'image-to-video') base.primaryAction = item.primaryAction;
    if (route === 'ai-generated-video') {
      return {
        ...base,
        purpose: item.purpose,
        representationPolicy: item.representationPolicy,
        evidenceEligible: item.evidenceEligible,
        disclosureRequired: item.disclosureRequired,
        realEntityReenactmentForbidden: item.realEntityReenactmentForbidden,
        visualIntent: item.visualIntent,
      };
    }
    return {
      ...base,
      reason: item.reason,
      visualRole: item.visualRole,
      visualMetaphor: item.visualMetaphor,
      composition: item.composition,
      textPlan: clone(item.textPlan),
      referenceImageIds: clone(item.referenceImageIds),
    };
  });
  return {
    ...commonManifest({
      schemaVersion: ROUTE_PROMPT_HANDOFF_SCHEMA,
      cues,
      approval,
      source,
      route,
      downstreamRoute,
      status: routePackage.status,
      reason: routePackage.notRequiredReason,
    }),
    promptKind,
    promptIsolation: promptKind === 'first-frame'
      ? {containsVideoPromptBodies: false, consumer: 'first-frame-stage'}
      : {containsFirstFramePromptBodies: false, consumer: 'video-generation-stage'},
    styleLock: styleLock === null ? null : clone(styleLock),
    itemCount: items.length,
    items,
  };
}

function buildRealManifest({cues, approval, source, routePackage, downstreamRoute}) {
  const items = routePackage.items.map((item) => ({
    id: item.id,
    beatId: item.beatId,
    startAnchorText: item.startAnchorText,
    endAnchorText: item.endAnchorText,
    timingStatus: item.timingStatus,
    assetType: item.assetType,
    usageRole: item.usageRole,
    materialRequest: item.materialRequest,
    reason: item.reason,
    evidenceStatus: item.evidenceStatus,
    usableInProduction: item.usableInProduction,
    sourceBinding: item.sourceBinding === null ? null : clone(item.sourceBinding),
    fallbackIfUnavailable: item.fallbackIfUnavailable,
    generatedSubstituteAllowed: false,
  }));
  return {
    ...commonManifest({
      schemaVersion: REAL_EVIDENCE_HANDOFF_SCHEMA,
      cues,
      approval,
      source,
      route: 'real-evidence',
      downstreamRoute,
      status: routePackage.status,
      reason: routePackage.notRequiredReason,
    }),
    promptGenerationAllowed: false,
    itemCount: items.length,
    items,
  };
}

function buildShotcraftManifest({cues, approval, source, downstreamRouteMap}) {
  const items = cues.shotcraftOpportunities.map((item) => ({
    id: item.id,
    beatId: item.beatId,
    sourceBaseVisualRoute: item.baseVisualRoute,
    downstreamBaseVisualRoute: downstreamRouteMap[item.baseVisualRoute],
    intent: item.intent,
    reason: item.reason,
    status: item.status,
    catalogScope: item.catalogScope,
  }));
  return {
    schemaVersion: SHOTCRAFT_OPPORTUNITY_HANDOFF_SCHEMA,
    taskId: cues.taskId,
    revisionId: approval.revisionId,
    status: items.length > 0 ? 'opportunity-only' : 'not-required',
    notRequiredReason: items.length > 0 ? null : '导演表未标记拍后 Shotcraft 机会；拍后仍可按项目规则扫描适用 beat。',
    source,
    executionScope: 'post-shoot-opportunity-only',
    selectionAuthorized: false,
    selectedCardCount: 0,
    itemCount: items.length,
    items,
  };
}

function containsForbiddenKey(value, pattern) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsForbiddenKey(item, pattern));
  return Object.entries(value).some(([key, child]) => pattern.test(key) || containsForbiddenKey(child, pattern));
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validArtifactBinding(value) {
  return value && typeof value === 'object' && text(value.path) && !path.isAbsolute(value.path) && isSha256(value.sha256);
}

function validatePromptPairManifests({still, video, route, errors}) {
  const add = (condition, code) => { if (!condition) errors.push(code); };
  const stillItems = Array.isArray(still?.items) ? still.items : [];
  const videoItems = Array.isArray(video?.items) ? video.items : [];
  add(stillItems.length === videoItems.length, `HANDOFF_PROMPT_PAIR_COUNT_MISMATCH:${route}`);
  add(jsonEqual(still?.styleLock, video?.styleLock), `HANDOFF_STYLE_LOCK_MISMATCH:${route}`);
  add(
    still?.promptIsolation?.containsVideoPromptBodies === false && still?.promptIsolation?.consumer === 'first-frame-stage',
    `HANDOFF_FIRSTFRAME_ISOLATION_INVALID:${route}`,
  );
  add(
    video?.promptIsolation?.containsFirstFramePromptBodies === false && video?.promptIsolation?.consumer === 'video-generation-stage',
    `HANDOFF_VIDEO_ISOLATION_INVALID:${route}`,
  );
  for (let index = 0; index < Math.max(stillItems.length, videoItems.length); index += 1) {
    const stillItem = stillItems[index];
    const videoItem = videoItems[index];
    const id = stillItem?.id ?? videoItem?.id ?? String(index);
    add(
      stillItem?.id === videoItem?.id && stillItem?.beatId === videoItem?.beatId &&
        stillItem?.pairId === videoItem?.pairId && stillItem?.pairSha256 === videoItem?.pairSha256,
      `HANDOFF_PROMPT_PAIR_IDENTITY_MISMATCH:${route}:${id}`,
    );
    add(text(stillItem?.prompt) && sha256(stillItem.prompt) === stillItem?.promptSha256, `HANDOFF_FIRSTFRAME_PROMPT_SHA_MISMATCH:${route}:${id}`);
    add(text(videoItem?.prompt) && sha256(videoItem.prompt) === videoItem?.promptSha256, `HANDOFF_VIDEO_PROMPT_SHA_MISMATCH:${route}:${id}`);
    add(
      text(stillItem?.id) && stillItem?.pairSha256 === sha256(`${stillItem.id}\u0000${stillItem.prompt}\u0000${videoItem?.prompt}`),
      `HANDOFF_PROMPT_PAIR_SHA_MISMATCH:${route}:${id}`,
    );
    add(!Object.hasOwn(stillItem ?? {}, 'primaryAction'), `HANDOFF_VIDEO_FIELDS_LEAKED_TO_FIRSTFRAME:${route}:${id}`);
    add(text(videoItem?.primaryAction), `HANDOFF_VIDEO_PRIMARY_ACTION_REQUIRED:${route}:${id}`);
  }
}

export function validateDirectorCuesV2HandoffDocuments(documents, {requireArtifactBindings = true} = {}) {
  const errors = [];
  const add = (condition, code) => { if (!condition) errors.push(code); };
  const {realEvidence, aiFirstFrame, aiVideo, paperFirstFrame, paperVideo, shotcraft, master} = documents;
  add(master?.schemaVersion === DIRECTOR_CUES_V2_HANDOFF_SCHEMA, 'HANDOFF_MASTER_SCHEMA_INVALID');
  add(master?.status === 'local-handoff-ready' && master?.executionScope === 'local-handoff-only', 'HANDOFF_MASTER_STATUS_INVALID');
  add(realEvidence?.schemaVersion === REAL_EVIDENCE_HANDOFF_SCHEMA, 'HANDOFF_REAL_SCHEMA_INVALID');
  for (const manifest of [aiFirstFrame, aiVideo, paperFirstFrame, paperVideo]) {
    add(manifest?.schemaVersion === ROUTE_PROMPT_HANDOFF_SCHEMA, 'HANDOFF_PROMPT_SCHEMA_INVALID');
  }
  add(shotcraft?.schemaVersion === SHOTCRAFT_OPPORTUNITY_HANDOFF_SCHEMA, 'HANDOFF_SHOTCRAFT_SCHEMA_INVALID');
  add(
    realEvidence?.sourceRoute === 'real-evidence' && aiFirstFrame?.sourceRoute === 'ai-generated-video' &&
      aiVideo?.sourceRoute === 'ai-generated-video' && paperFirstFrame?.sourceRoute === 'paper-editorial' &&
      paperVideo?.sourceRoute === 'paper-editorial',
    'HANDOFF_ROUTE_IDENTITY_INVALID',
  );
  add(aiFirstFrame?.promptKind === 'first-frame' && paperFirstFrame?.promptKind === 'first-frame', 'HANDOFF_FIRSTFRAME_KIND_INVALID');
  add(aiVideo?.promptKind === 'image-to-video' && paperVideo?.promptKind === 'image-to-video', 'HANDOFF_VIDEO_KIND_INVALID');
  add(!containsForbiddenKey(realEvidence?.items, /prompt/i), 'HANDOFF_REAL_PROMPT_FORBIDDEN');
  add(realEvidence?.promptGenerationAllowed === false, 'HANDOFF_REAL_PROMPT_GENERATION_FORBIDDEN');
  add(Array.isArray(realEvidence?.items) && realEvidence.items.every((item) => item.generatedSubstituteAllowed === false), 'HANDOFF_REAL_GENERATED_SUBSTITUTE_FORBIDDEN');
  add(
    shotcraft?.executionScope === 'post-shoot-opportunity-only' && shotcraft?.selectionAuthorized === false &&
      shotcraft?.selectedCardCount === 0,
    'HANDOFF_SHOTCRAFT_SELECTION_FORBIDDEN',
  );
  add(!containsForbiddenKey(shotcraft?.items, /cardId|effectId|presetId|componentId/i), 'HANDOFF_SHOTCRAFT_PRESELECTION_FORBIDDEN');
  add(
    master?.externalActionsAuthorized === false && master?.generationAuthorized === false &&
      master?.remotionAuthorized === false && master?.publicationAuthorized === false,
    'HANDOFF_EXTERNAL_AUTHORIZATION_FORBIDDEN',
  );
  add(master?.branches?.realEvidence && master?.branches?.aiGeneratedVideo && master?.branches?.paperEditorial, 'HANDOFF_THREE_BRANCHES_REQUIRED');
  for (const manifest of [realEvidence, aiFirstFrame, aiVideo, paperFirstFrame, paperVideo]) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    add(Array.isArray(manifest?.items) && manifest?.itemCount === items.length, `HANDOFF_ITEM_COUNT_INVALID:${manifest?.sourceRoute ?? 'unknown'}:${manifest?.promptKind ?? 'materials'}`);
    const expected = items.length > 0 ? 'planned' : 'not-required';
    add(manifest?.status === expected, `HANDOFF_BRANCH_STATUS_INVALID:${manifest?.sourceRoute ?? 'unknown'}:${manifest?.promptKind ?? 'materials'}`);
    add(expected !== 'not-required' || text(manifest?.notRequiredReason), `HANDOFF_NOT_REQUIRED_REASON_MISSING:${manifest?.sourceRoute ?? 'unknown'}`);
    add(expected !== 'planned' || manifest?.notRequiredReason === null, `HANDOFF_PLANNED_REASON_MUST_BE_NULL:${manifest?.sourceRoute ?? 'unknown'}`);
    add(
      manifest?.executionScope === 'local-handoff-only' && manifest?.externalActionsAuthorized === false &&
        manifest?.generationStarted === false,
      `HANDOFF_BRANCH_EXECUTION_GATE_INVALID:${manifest?.sourceRoute ?? 'unknown'}:${manifest?.promptKind ?? 'materials'}`,
    );
    add(manifest?.taskId === master?.taskId && manifest?.revisionId === master?.revisionId, `HANDOFF_BRANCH_IDENTITY_MISMATCH:${manifest?.sourceRoute ?? 'unknown'}`);
    add(jsonEqual(manifest?.source, master?.source), `HANDOFF_BRANCH_SOURCE_MISMATCH:${manifest?.sourceRoute ?? 'unknown'}`);
  }
  const routeMappings = Array.isArray(master?.routeMappings) ? master.routeMappings : [];
  add(routeMappings.length === SOURCE_ROUTES.length, 'HANDOFF_ROUTE_MAPPING_COUNT_INVALID');
  const mapping = new Map();
  for (const entry of routeMappings) {
    add(SOURCE_ROUTES.includes(entry?.sourceRoute) && !mapping.has(entry.sourceRoute), `HANDOFF_ROUTE_MAPPING_SOURCE_INVALID:${entry?.sourceRoute ?? 'unknown'}`);
    add(text(entry?.downstreamRoute) && Number.isInteger(entry?.beatCount) && entry.beatCount >= 0, `HANDOFF_ROUTE_MAPPING_TARGET_INVALID:${entry?.sourceRoute ?? 'unknown'}`);
    mapping.set(entry?.sourceRoute, entry?.downstreamRoute);
  }
  for (const route of SOURCE_ROUTES) add(mapping.has(route), `HANDOFF_ROUTE_MAPPING_MISSING:${route}`);
  add(realEvidence?.downstreamRoute === mapping.get('real-evidence'), 'HANDOFF_REAL_DOWNSTREAM_ROUTE_MISMATCH');
  add(aiFirstFrame?.downstreamRoute === mapping.get('ai-generated-video') && aiVideo?.downstreamRoute === mapping.get('ai-generated-video'), 'HANDOFF_AI_DOWNSTREAM_ROUTE_MISMATCH');
  add(paperFirstFrame?.downstreamRoute === mapping.get('paper-editorial') && paperVideo?.downstreamRoute === mapping.get('paper-editorial'), 'HANDOFF_PAPER_DOWNSTREAM_ROUTE_MISMATCH');
  add(
    master?.branches?.realEvidence?.sourceRoute === 'real-evidence' &&
      master?.branches?.realEvidence?.downstreamRoute === mapping.get('real-evidence') &&
      master?.branches?.realEvidence?.status === realEvidence?.status,
    'HANDOFF_REAL_BRANCH_MISMATCH',
  );
  add(
    master?.branches?.aiGeneratedVideo?.sourceRoute === 'ai-generated-video' &&
      master?.branches?.aiGeneratedVideo?.downstreamRoute === mapping.get('ai-generated-video') &&
      master?.branches?.aiGeneratedVideo?.status === aiFirstFrame?.status && aiFirstFrame?.status === aiVideo?.status,
    'HANDOFF_AI_BRANCH_MISMATCH',
  );
  add(
    master?.branches?.paperEditorial?.sourceRoute === 'paper-editorial' &&
      master?.branches?.paperEditorial?.downstreamRoute === mapping.get('paper-editorial') &&
      master?.branches?.paperEditorial?.status === paperFirstFrame?.status && paperFirstFrame?.status === paperVideo?.status,
    'HANDOFF_PAPER_BRANCH_MISMATCH',
  );
  validatePromptPairManifests({still: aiFirstFrame, video: aiVideo, route: 'ai-generated-video', errors});
  validatePromptPairManifests({still: paperFirstFrame, video: paperVideo, route: 'paper-editorial', errors});
  add(
    (aiFirstFrame?.items ?? []).every((item) => item.purpose === 'illustration-only' && item.evidenceEligible === false) &&
      (aiVideo?.items ?? []).every((item) => item.purpose === 'illustration-only' && item.evidenceEligible === false),
    'HANDOFF_AI_EVIDENCE_BOUNDARY_INVALID',
  );
  const shotcraftItems = Array.isArray(shotcraft?.items) ? shotcraft.items : [];
  add(shotcraft?.itemCount === shotcraftItems.length, 'HANDOFF_SHOTCRAFT_ITEM_COUNT_INVALID');
  add(
    shotcraft?.status === (shotcraftItems.length > 0 ? 'opportunity-only' : 'not-required'),
    'HANDOFF_SHOTCRAFT_STATUS_INVALID',
  );
  add(shotcraft?.taskId === master?.taskId && shotcraft?.revisionId === master?.revisionId && jsonEqual(shotcraft?.source, master?.source), 'HANDOFF_SHOTCRAFT_IDENTITY_MISMATCH');
  for (const item of shotcraftItems) {
    add(['speaker', 'real-evidence'].includes(item?.sourceBaseVisualRoute), `HANDOFF_SHOTCRAFT_SOURCE_ROUTE_INVALID:${item?.id ?? 'unknown'}`);
    add(item?.downstreamBaseVisualRoute === mapping.get(item?.sourceBaseVisualRoute), `HANDOFF_SHOTCRAFT_DOWNSTREAM_ROUTE_MISMATCH:${item?.id ?? 'unknown'}`);
    add(item?.status === 'opportunity-only-post-shoot-selection-pending', `HANDOFF_SHOTCRAFT_ITEM_STATUS_INVALID:${item?.id ?? 'unknown'}`);
  }
  if (requireArtifactBindings) {
    const artifacts = master?.artifacts ?? {};
    const expectedArtifactKeys = ['realEvidence', 'aiFirstFrame', 'aiVideo', 'paperFirstFrame', 'paperVideo', 'shotcraft'];
    add(jsonEqual(Object.keys(artifacts).sort(), [...expectedArtifactKeys].sort()), 'HANDOFF_ARTIFACT_KEYS_INVALID');
    for (const key of expectedArtifactKeys) add(validArtifactBinding(artifacts[key]), `HANDOFF_ARTIFACT_BINDING_INVALID:${key}`);
    add(jsonEqual(master?.branches?.realEvidence?.manifest, artifacts.realEvidence), 'HANDOFF_REAL_ARTIFACT_REF_MISMATCH');
    add(jsonEqual(master?.branches?.aiGeneratedVideo?.firstFrameManifest, artifacts.aiFirstFrame), 'HANDOFF_AI_FIRSTFRAME_ARTIFACT_REF_MISMATCH');
    add(jsonEqual(master?.branches?.aiGeneratedVideo?.imageToVideoManifest, artifacts.aiVideo), 'HANDOFF_AI_VIDEO_ARTIFACT_REF_MISMATCH');
    add(jsonEqual(master?.branches?.paperEditorial?.firstFrameManifest, artifacts.paperFirstFrame), 'HANDOFF_PAPER_FIRSTFRAME_ARTIFACT_REF_MISMATCH');
    add(jsonEqual(master?.branches?.paperEditorial?.imageToVideoManifest, artifacts.paperVideo), 'HANDOFF_PAPER_VIDEO_ARTIFACT_REF_MISMATCH');
    add(jsonEqual(master?.shotcraft?.manifest, artifacts.shotcraft), 'HANDOFF_SHOTCRAFT_ARTIFACT_REF_MISMATCH');
  }
  return {ok: errors.length === 0, errors};
}

export function buildDirectorCuesV2HandoffDocuments({cues, approval, profile, source}) {
  const routeMap = profile.routingPolicy.directorCueRouteMap;
  const realPackage = cues.routePlans.realMaterials;
  const aiPackage = cues.routePlans.aiGeneratedVideos;
  const paperPackage = cues.routePlans.paperEditorials;
  const realEvidence = buildRealManifest({
    cues, approval, source, routePackage: realPackage, downstreamRoute: routeMap['real-evidence'],
  });
  const aiFirstFrame = buildPromptManifest({
    cues, approval, source, route: 'ai-generated-video', downstreamRoute: routeMap['ai-generated-video'],
    routePackage: aiPackage, promptKind: 'first-frame', styleLock: cues.styleLocks.aiGeneratedVideo,
  });
  const aiVideo = buildPromptManifest({
    cues, approval, source, route: 'ai-generated-video', downstreamRoute: routeMap['ai-generated-video'],
    routePackage: aiPackage, promptKind: 'image-to-video', styleLock: cues.styleLocks.aiGeneratedVideo,
  });
  const paperFirstFrame = buildPromptManifest({
    cues, approval, source, route: 'paper-editorial', downstreamRoute: routeMap['paper-editorial'],
    routePackage: paperPackage, promptKind: 'first-frame', styleLock: cues.styleLocks.paperEditorial,
  });
  const paperVideo = buildPromptManifest({
    cues, approval, source, route: 'paper-editorial', downstreamRoute: routeMap['paper-editorial'],
    routePackage: paperPackage, promptKind: 'image-to-video', styleLock: cues.styleLocks.paperEditorial,
  });
  const shotcraft = buildShotcraftManifest({cues, approval, source, downstreamRouteMap: routeMap});
  const routeCounts = Object.fromEntries(SOURCE_ROUTES.map((route) => [
    route,
    cues.semanticBeats.filter((beat) => beat.primaryRoute === route).length,
  ]));
  const master = {
    schemaVersion: DIRECTOR_CUES_V2_HANDOFF_SCHEMA,
    taskId: cues.taskId,
    revisionId: approval.revisionId,
    status: 'local-handoff-ready',
    executionScope: 'local-handoff-only',
    source,
    profileVersion: profile.profileVersion,
    routeMappings: SOURCE_ROUTES.map((sourceRoute) => ({
      sourceRoute,
      downstreamRoute: routeMap[sourceRoute],
      beatCount: routeCounts[sourceRoute],
    })),
    speakerBeatIds: cues.semanticBeats.filter((beat) => beat.primaryRoute === 'speaker').map((beat) => beat.id),
    branches: {
      realEvidence: {sourceRoute: 'real-evidence', downstreamRoute: routeMap['real-evidence'], status: realPackage.status},
      aiGeneratedVideo: {sourceRoute: 'ai-generated-video', downstreamRoute: routeMap['ai-generated-video'], status: aiPackage.status},
      paperEditorial: {sourceRoute: 'paper-editorial', downstreamRoute: routeMap['paper-editorial'], status: paperPackage.status},
    },
    shotcraft: {
      status: shotcraft.status,
      opportunityCount: shotcraft.itemCount,
      selectionStage: 'post-shoot-edit-release',
      selectionAuthorized: false,
    },
    externalActionsAuthorized: false,
    generationAuthorized: false,
    remotionAuthorized: false,
    publicationAuthorized: false,
  };
  const documents = {realEvidence, aiFirstFrame, aiVideo, paperFirstFrame, paperVideo, shotcraft, master};
  const validation = validateDirectorCuesV2HandoffDocuments(documents, {requireArtifactBindings: false});
  failUnless(validation.ok, `DIRECTOR_V2_HANDOFF_DOCUMENTS_INVALID:${validation.errors.join('|')}`);
  return documents;
}

function attachArtifactBindings(master, artifacts) {
  master.artifacts = artifacts;
  master.branches.realEvidence.manifest = artifacts.realEvidence;
  master.branches.aiGeneratedVideo.firstFrameManifest = artifacts.aiFirstFrame;
  master.branches.aiGeneratedVideo.imageToVideoManifest = artifacts.aiVideo;
  master.branches.paperEditorial.firstFrameManifest = artifacts.paperFirstFrame;
  master.branches.paperEditorial.imageToVideoManifest = artifacts.paperVideo;
  master.shotcraft.manifest = artifacts.shotcraft;
}

function expectedActiveProfilePath(root) {
  return path.join(root, 'workflow', 'active-director-profile.v1.json');
}

function readBindingFromDisk({root, declared, code, requiredParent = null}) {
  failUnless(validArtifactBinding(declared), `${code}_BINDING_INVALID`);
  const filePath = resolveExistingFile(root, declared.path, code);
  if (requiredParent) failUnless(path.dirname(filePath) === requiredParent, `${code}_OUTSIDE_HANDOFF_DIRECTORY`);
  const bytes = readFileSync(filePath);
  failUnless(sha256(bytes) === declared.sha256, `${code}_SHA_MISMATCH`);
  return {filePath, bytes, doc: parseJsonBytes(bytes, code)};
}

function buildValidationReceipt({master, masterBinding}) {
  return {
    schemaVersion: DIRECTOR_CUES_V2_HANDOFF_RECEIPT_SCHEMA,
    taskId: master.taskId,
    revisionId: master.revisionId,
    status: 'validated-local-handoff',
    skillExecuted: true,
    validatorExecuted: true,
    source: clone(master.source),
    handoffMaster: masterBinding,
    artifacts: clone(master.artifacts),
    externalActionsAuthorized: false,
    generationAuthorized: false,
  };
}

export function validateDirectorCuesV2HandoffDirectory({projectRoot, outputDir: outputArg}) {
  try {
    const root = normalizedProjectRoot(projectRoot);
    failUnless(text(outputArg), 'DIRECTOR_V2_HANDOFF_VALIDATE_OUTPUT_REQUIRED');
    const outputDir = path.isAbsolute(outputArg) ? path.normalize(outputArg) : path.resolve(root, outputArg);
    failUnless(isInside(root, outputDir) && existsSync(outputDir), 'DIRECTOR_V2_HANDOFF_VALIDATE_DIRECTORY_INVALID');
    const resolvedOutputDir = realpathSync(outputDir);
    failUnless(isInside(root, resolvedOutputDir) && statSync(resolvedOutputDir).isDirectory(), 'DIRECTOR_V2_HANDOFF_VALIDATE_DIRECTORY_INVALID');
    const expectedFiles = Object.values(OUTPUT_FILES).sort();
    failUnless(jsonEqual(readdirSync(resolvedOutputDir).sort(), expectedFiles), 'DIRECTOR_V2_HANDOFF_DIRECTORY_FILE_SET_INVALID');

    const masterPath = path.join(resolvedOutputDir, OUTPUT_FILES.master);
    const receiptPath = path.join(resolvedOutputDir, OUTPUT_FILES.receipt);
    const masterBytes = readFileSync(masterPath);
    const receiptBytes = readFileSync(receiptPath);
    const master = parseJsonBytes(masterBytes, 'DIRECTOR_V2_HANDOFF_MASTER');
    const receipt = parseJsonBytes(receiptBytes, 'DIRECTOR_V2_HANDOFF_RECEIPT');
    const expectedArtifactPaths = {
      realEvidence: OUTPUT_FILES.realEvidence,
      aiFirstFrame: OUTPUT_FILES.aiFirstFrame,
      aiVideo: OUTPUT_FILES.aiVideo,
      paperFirstFrame: OUTPUT_FILES.paperFirstFrame,
      paperVideo: OUTPUT_FILES.paperVideo,
      shotcraft: OUTPUT_FILES.shotcraft,
    };
    const loaded = {};
    for (const [key, fileName] of Object.entries(expectedArtifactPaths)) {
      const declared = master?.artifacts?.[key];
      const expectedPath = relativePath(root, path.join(resolvedOutputDir, fileName));
      failUnless(declared?.path === expectedPath, `DIRECTOR_V2_HANDOFF_ARTIFACT_PATH_MISMATCH:${key}`);
      loaded[key] = readBindingFromDisk({
        root,
        declared,
        code: `DIRECTOR_V2_HANDOFF_ARTIFACT:${key}`,
        requiredParent: resolvedOutputDir,
      });
    }
    const documents = {
      realEvidence: loaded.realEvidence.doc,
      aiFirstFrame: loaded.aiFirstFrame.doc,
      aiVideo: loaded.aiVideo.doc,
      paperFirstFrame: loaded.paperFirstFrame.doc,
      paperVideo: loaded.paperVideo.doc,
      shotcraft: loaded.shotcraft.doc,
      master,
    };
    const structural = validateDirectorCuesV2HandoffDocuments(documents);
    failUnless(structural.ok, `DIRECTOR_V2_HANDOFF_DOCUMENTS_INVALID:${structural.errors.join('|')}`);

    const cuesFile = readBindingFromDisk({root, declared: master.source?.directorCues, code: 'DIRECTOR_V2_HANDOFF_SOURCE_CUES'});
    const approvalFile = readBindingFromDisk({root, declared: master.source?.userApproval, code: 'DIRECTOR_V2_HANDOFF_SOURCE_APPROVAL'});
    const profileFile = readBindingFromDisk({root, declared: master.source?.activeDirectorProfile, code: 'DIRECTOR_V2_HANDOFF_SOURCE_PROFILE'});
    failUnless(profileFile.filePath === realpathSync(expectedActiveProfilePath(root)), 'DIRECTOR_V2_HANDOFF_ACTIVE_PROFILE_PATH_INVALID');
    const cues = cuesFile.doc;
    const approval = approvalFile.doc;
    const profile = profileFile.doc;
    const cuesValidation = validateDirectorCuesV2File({inputPath: cuesFile.filePath, projectRoot: root});
    failUnless(cuesValidation.ok, `DIRECTOR_V2_HANDOFF_SOURCE_CUES_INVALID:${cuesValidation.errors.join('|')}`);
    const localPathIssues = validateCuesLocalPaths({cues, root});
    failUnless(localPathIssues.length === 0, `DIRECTOR_V2_HANDOFF_SOURCE_PATH_INVALID:${localPathIssues.join('|')}`);
    const approvalIssues = approvalErrors({
      approval,
      approvalPath: approvalFile.filePath,
      cues,
      cuesPath: cuesFile.filePath,
      cuesSha256: cuesFile.doc ? master.source.directorCues.sha256 : '',
      root,
    });
    failUnless(approvalIssues.length === 0, `DIRECTOR_V2_HANDOFF_SOURCE_APPROVAL_INVALID:${approvalIssues.join('|')}`);
    const profileIssues = validateProfile(profile);
    failUnless(profileIssues.length === 0, `DIRECTOR_V2_HANDOFF_SOURCE_PROFILE_INVALID:${profileIssues.join('|')}`);

    const expectedDocuments = buildDirectorCuesV2HandoffDocuments({cues, approval, profile, source: master.source});
    attachArtifactBindings(expectedDocuments.master, master.artifacts);
    for (const key of ['realEvidence', 'aiFirstFrame', 'aiVideo', 'paperFirstFrame', 'paperVideo', 'shotcraft', 'master']) {
      failUnless(jsonEqual(documents[key], expectedDocuments[key]), `DIRECTOR_V2_HANDOFF_REBUILD_MISMATCH:${key}`);
    }
    const masterBinding = binding(root, masterPath, masterBytes);
    const expectedReceipt = buildValidationReceipt({master, masterBinding});
    failUnless(jsonEqual(receipt, expectedReceipt), 'DIRECTOR_V2_HANDOFF_RECEIPT_INVALID');
    return {
      ok: true,
      errors: [],
      outputDir: resolvedOutputDir,
      masterPath,
      masterSha256: masterBinding.sha256,
      receiptPath,
      receiptSha256: sha256(receiptBytes),
    };
  } catch (error) {
    return {ok: false, errors: [error instanceof Error ? error.message : String(error)]};
  }
}

export function finalizeDirectorCuesV2HandoffDirectory({temporaryDir, outputDir, validateFinal}) {
  failUnless(text(temporaryDir) && text(outputDir), 'DIRECTOR_V2_HANDOFF_FINALIZE_PATH_REQUIRED');
  failUnless(typeof validateFinal === 'function', 'DIRECTOR_V2_HANDOFF_FINAL_VALIDATOR_REQUIRED');
  renameSync(temporaryDir, outputDir);
  let validation;
  try {
    validation = validateFinal(outputDir);
  } catch (error) {
    validation = {ok: false, errors: [error instanceof Error ? error.message : String(error)]};
  }
  if (validation?.ok === true) return validation;

  const parent = path.dirname(outputDir);
  const quarantinePath = path.join(
    parent,
    `.${path.basename(outputDir)}.invalid-${process.pid}-${randomUUID()}`,
  );
  let isolatedAt = null;
  try {
    renameSync(outputDir, quarantinePath);
    isolatedAt = quarantinePath;
  } catch {
    if (existsSync(outputDir)) rmSync(outputDir, {recursive: true, force: false});
  }
  failUnless(!existsSync(outputDir), 'DIRECTOR_V2_HANDOFF_INVALID_OUTPUT_CLEANUP_FAILED');
  const issues = Array.isArray(validation?.errors) ? validation.errors.join('|') : 'FINAL_VALIDATION_FAILED';
  throw new Error(
    `DIRECTOR_V2_HANDOFF_DISK_VALIDATION_FAILED:${issues}:${isolatedAt ? `QUARANTINED_AT=${isolatedAt}` : 'INVALID_PACKAGE_REMOVED'}`,
  );
}

export function buildDirectorCuesV2Handoff({projectRoot, cues: cuesArg, approval: approvalArg, profile: profileArg, outputDir: outputArg}) {
  const root = normalizedProjectRoot(projectRoot);
  failUnless(text(outputArg), 'DIRECTOR_V2_HANDOFF_OUTPUT_REQUIRED');
  const cuesPath = resolveExistingFile(root, cuesArg, 'DIRECTOR_V2_HANDOFF_CUES');
  const approvalPath = resolveExistingFile(root, approvalArg, 'DIRECTOR_V2_HANDOFF_APPROVAL');
  const profilePath = resolveExistingFile(root, profileArg, 'DIRECTOR_V2_HANDOFF_PROFILE');
  failUnless(
    existsSync(expectedActiveProfilePath(root)) && profilePath === realpathSync(expectedActiveProfilePath(root)),
    'DIRECTOR_V2_HANDOFF_ACTIVE_PROFILE_PATH_INVALID',
  );
  const outputDir = path.isAbsolute(outputArg) ? path.normalize(outputArg) : path.resolve(root, outputArg);
  failUnless(isInside(root, outputDir) && outputDir !== root, 'DIRECTOR_V2_HANDOFF_OUTPUT_OUTSIDE_PROJECT');
  failUnless(!existsSync(outputDir), 'DIRECTOR_V2_HANDOFF_OUTPUT_ALREADY_EXISTS');
  failUnless(existsSync(path.dirname(outputDir)), 'DIRECTOR_V2_HANDOFF_OUTPUT_PARENT_MISSING');
  const outputParent = realpathSync(path.dirname(outputDir));
  failUnless(isInside(root, outputParent), 'DIRECTOR_V2_HANDOFF_OUTPUT_PARENT_OUTSIDE_PROJECT');

  const cuesValidation = validateDirectorCuesV2File({inputPath: cuesPath, projectRoot: root});
  failUnless(cuesValidation.ok, `DIRECTOR_V2_HANDOFF_CUES_INVALID:${cuesValidation.errors.join('|')}`);
  const cuesBytes = readFileSync(cuesPath);
  const approvalBytes = readFileSync(approvalPath);
  const profileBytes = readFileSync(profilePath);
  const cues = parseJsonBytes(cuesBytes, 'DIRECTOR_V2_HANDOFF_CUES');
  const approval = parseJsonBytes(approvalBytes, 'DIRECTOR_V2_HANDOFF_APPROVAL');
  const profile = parseJsonBytes(profileBytes, 'DIRECTOR_V2_HANDOFF_PROFILE');
  const cuesSha256 = sha256(cuesBytes);
  const approvalIssues = approvalErrors({approval, approvalPath, cues, cuesPath, cuesSha256, root});
  failUnless(approvalIssues.length === 0, `DIRECTOR_V2_HANDOFF_APPROVAL_INVALID:${approvalIssues.join('|')}`);
  const profileIssues = validateProfile(profile);
  failUnless(profileIssues.length === 0, `DIRECTOR_V2_HANDOFF_PROFILE_INVALID:${profileIssues.join('|')}`);
  const localPathIssues = validateCuesLocalPaths({cues, root});
  failUnless(localPathIssues.length === 0, `DIRECTOR_V2_HANDOFF_SOURCE_PATH_INVALID:${localPathIssues.join('|')}`);

  const source = {
    directorCues: binding(root, cuesPath, cuesBytes),
    userApproval: binding(root, approvalPath, approvalBytes),
    activeDirectorProfile: binding(root, profilePath, profileBytes),
  };
  const documents = buildDirectorCuesV2HandoffDocuments({cues, approval, profile, source});
  const documentBytes = Object.fromEntries(Object.entries(documents).map(([key, value]) => [key, jsonBytes(value)]));
  const artifactBindings = {
    realEvidence: {path: `${relativePath(root, outputDir)}/${OUTPUT_FILES.realEvidence}`, sha256: sha256(documentBytes.realEvidence)},
    aiFirstFrame: {path: `${relativePath(root, outputDir)}/${OUTPUT_FILES.aiFirstFrame}`, sha256: sha256(documentBytes.aiFirstFrame)},
    aiVideo: {path: `${relativePath(root, outputDir)}/${OUTPUT_FILES.aiVideo}`, sha256: sha256(documentBytes.aiVideo)},
    paperFirstFrame: {path: `${relativePath(root, outputDir)}/${OUTPUT_FILES.paperFirstFrame}`, sha256: sha256(documentBytes.paperFirstFrame)},
    paperVideo: {path: `${relativePath(root, outputDir)}/${OUTPUT_FILES.paperVideo}`, sha256: sha256(documentBytes.paperVideo)},
    shotcraft: {path: `${relativePath(root, outputDir)}/${OUTPUT_FILES.shotcraft}`, sha256: sha256(documentBytes.shotcraft)},
  };
  attachArtifactBindings(documents.master, artifactBindings);
  const finalDocumentValidation = validateDirectorCuesV2HandoffDocuments(documents);
  failUnless(finalDocumentValidation.ok, `DIRECTOR_V2_HANDOFF_DOCUMENTS_INVALID:${finalDocumentValidation.errors.join('|')}`);
  documentBytes.master = jsonBytes(documents.master);
  const masterBinding = {
    path: `${relativePath(root, outputDir)}/${OUTPUT_FILES.master}`,
    sha256: sha256(documentBytes.master),
  };
  const receipt = buildValidationReceipt({master: documents.master, masterBinding});
  documentBytes.receipt = jsonBytes(receipt);

  failUnless(sha256(readFileSync(cuesPath)) === source.directorCues.sha256, 'DIRECTOR_V2_HANDOFF_CUES_CHANGED_DURING_BUILD');
  failUnless(sha256(readFileSync(approvalPath)) === source.userApproval.sha256, 'DIRECTOR_V2_HANDOFF_APPROVAL_CHANGED_DURING_BUILD');
  failUnless(sha256(readFileSync(profilePath)) === source.activeDirectorProfile.sha256, 'DIRECTOR_V2_HANDOFF_PROFILE_CHANGED_DURING_BUILD');
  const finalCuesValidation = validateDirectorCuesV2File({inputPath: cuesPath, projectRoot: root});
  failUnless(finalCuesValidation.ok, `DIRECTOR_V2_HANDOFF_CUES_CHANGED_DURING_BUILD:${finalCuesValidation.errors.join('|')}`);
  const temporaryDir = path.join(outputParent, `.${path.basename(outputDir)}.tmp-${process.pid}-${randomUUID()}`);
  try {
    mkdirSync(temporaryDir, {recursive: false, mode: 0o700});
    for (const [key, fileName] of Object.entries(OUTPUT_FILES)) {
      if (key === 'receipt') continue;
      writeFileSync(path.join(temporaryDir, fileName), documentBytes[key], {flag: 'wx', mode: 0o600});
    }
    for (const [key, fileName] of Object.entries(OUTPUT_FILES)) {
      if (key === 'receipt') continue;
      const diskBytes = readFileSync(path.join(temporaryDir, fileName));
      failUnless(diskBytes.equals(documentBytes[key]), `DIRECTOR_V2_HANDOFF_TEMPORARY_FILE_MISMATCH:${key}`);
    }
    const temporaryDocuments = {
      realEvidence: parseJsonBytes(readFileSync(path.join(temporaryDir, OUTPUT_FILES.realEvidence)), 'DIRECTOR_V2_HANDOFF_TEMP_REAL'),
      aiFirstFrame: parseJsonBytes(readFileSync(path.join(temporaryDir, OUTPUT_FILES.aiFirstFrame)), 'DIRECTOR_V2_HANDOFF_TEMP_AI_FIRSTFRAME'),
      aiVideo: parseJsonBytes(readFileSync(path.join(temporaryDir, OUTPUT_FILES.aiVideo)), 'DIRECTOR_V2_HANDOFF_TEMP_AI_VIDEO'),
      paperFirstFrame: parseJsonBytes(readFileSync(path.join(temporaryDir, OUTPUT_FILES.paperFirstFrame)), 'DIRECTOR_V2_HANDOFF_TEMP_PAPER_FIRSTFRAME'),
      paperVideo: parseJsonBytes(readFileSync(path.join(temporaryDir, OUTPUT_FILES.paperVideo)), 'DIRECTOR_V2_HANDOFF_TEMP_PAPER_VIDEO'),
      shotcraft: parseJsonBytes(readFileSync(path.join(temporaryDir, OUTPUT_FILES.shotcraft)), 'DIRECTOR_V2_HANDOFF_TEMP_SHOTCRAFT'),
      master: parseJsonBytes(readFileSync(path.join(temporaryDir, OUTPUT_FILES.master)), 'DIRECTOR_V2_HANDOFF_TEMP_MASTER'),
    };
    const temporaryValidation = validateDirectorCuesV2HandoffDocuments(temporaryDocuments);
    failUnless(temporaryValidation.ok, `DIRECTOR_V2_HANDOFF_TEMPORARY_VALIDATION_FAILED:${temporaryValidation.errors.join('|')}`);
    writeFileSync(path.join(temporaryDir, OUTPUT_FILES.receipt), documentBytes.receipt, {flag: 'wx', mode: 0o600});
    failUnless(
      readFileSync(path.join(temporaryDir, OUTPUT_FILES.receipt)).equals(documentBytes.receipt),
      'DIRECTOR_V2_HANDOFF_TEMPORARY_RECEIPT_MISMATCH',
    );
    failUnless(!existsSync(outputDir), 'DIRECTOR_V2_HANDOFF_OUTPUT_ALREADY_EXISTS');
    const diskValidation = finalizeDirectorCuesV2HandoffDirectory({
      temporaryDir,
      outputDir,
      validateFinal: (finalOutputDir) => validateDirectorCuesV2HandoffDirectory({
        projectRoot: root,
        outputDir: finalOutputDir,
      }),
    });
    return {
      ok: true,
      outputDir,
      masterPath: path.join(outputDir, OUTPUT_FILES.master),
      masterSha256: diskValidation.masterSha256,
      receiptPath: path.join(outputDir, OUTPUT_FILES.receipt),
      receiptSha256: diskValidation.receiptSha256,
      artifacts: artifactBindings,
    };
  } catch (error) {
    if (existsSync(temporaryDir)) rmSync(temporaryDir, {recursive: true, force: false});
    throw error;
  }
}
