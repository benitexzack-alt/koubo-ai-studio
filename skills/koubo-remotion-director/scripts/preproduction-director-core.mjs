import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

export const PREPRODUCTION_REQUEST_SCHEMA =
  'koubo-director-preproduction-request/v1';
export const PREPRODUCTION_PLAN_SCHEMA = 'koubo-director-preproduction-plan/v1';
export const DIRECTOR_ROUTE_LOCK_SCHEMA = 'koubo-director-route-lock/v1';
export const FIRST_FRAME_PROMPT_MANIFEST_SCHEMA =
  'koubo-paper-first-frame-prompt-manifest/v1';
export const RUNNINGHUB_PROMPT_MANIFEST_SCHEMA =
  'koubo-runninghub-image-to-video-prompt-manifest/v1';

export const sha256Buffer = (buffer) =>
  createHash('sha256').update(buffer).digest('hex');
export const sha256File = (filePath) => sha256Buffer(readFileSync(filePath));

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sha256Json = (value) =>
  sha256Buffer(Buffer.from(stableStringify(value), 'utf8'));

export const isText = (value) => typeof value === 'string' && value.trim().length > 0;

export function resolveDeclared(projectRoot, declaredPath) {
  if (!isText(declaredPath)) return null;
  return path.isAbsolute(declaredPath)
    ? path.normalize(declaredPath)
    : path.resolve(projectRoot, declaredPath);
}

const punctuationPattern = /[\s\p{P}\p{S}]+/gu;
export const normalizeSpokenText = (value) =>
  String(value ?? '').replace(punctuationPattern, '').toLowerCase();

function push(errors, condition, code) {
  if (!condition) errors.push(code);
}

const PAPER_TEXT_EMBEDDING_MODES = new Set([
  'first-frame-baked',
  'tracked-paper-surface',
]);
const SCREEN_TEXT_ROLES = new Set(['screen-title', 'fact-source-caveat']);
const PAPER_MOTION_CONSTRAINTS = new Set(['rigid-surface', 'tracked-moving-surface']);
const MAIN_VISUAL_CLASSES = new Set([
  'speaker',
  'real-evidence',
  'generated-video',
  'paper-editorial',
]);
const REAL_MEDIA_PRESENTATION_MODES = new Set([
  'full-screen-real-media',
  'real-media-with-presenter-inset',
]);
const MATERIAL_AUDIO_MODES = new Set([
  'muted',
  'duck-under-narration',
  'feature-audio-window',
]);

function validateOverlayDecision(overlay, beat, errors) {
  if (overlay == null) return;
  push(
    errors,
    overlay.class === 'remotion-information',
    `BEAT_OVERLAY_CLASS_INVALID:${beat.id}`,
  );
  push(
    errors,
    overlay.producer === 'codex-remotion',
    `BEAT_OVERLAY_PRODUCER_INVALID:${beat.id}`,
  );
  push(
    errors,
    ['chapter-anchor', 'keyword', 'source', 'risk-caveat', 'cta'].includes(overlay.role),
    `BEAT_OVERLAY_ROLE_INVALID:${beat.id}`,
  );
  push(
    errors,
    !Array.isArray(overlay.items) || overlay.items.length <= 3,
    `BEAT_OVERLAY_ITEM_COUNT_INVALID:${beat.id}`,
  );
}

function validateRealMediaPresentation(presentation, beat, errors) {
  push(
    errors,
    presentation && typeof presentation === 'object',
    `REAL_MEDIA_PRESENTATION_MISSING:${beat.id}`,
  );
  if (!presentation || typeof presentation !== 'object') return;
  push(
    errors,
    REAL_MEDIA_PRESENTATION_MODES.has(presentation.mode),
    `REAL_MEDIA_PRESENTATION_MODE_INVALID:${beat.id}`,
  );
  push(
    errors,
    MATERIAL_AUDIO_MODES.has(presentation.materialAudioMode),
    `REAL_MEDIA_AUDIO_MODE_INVALID:${beat.id}`,
  );
  if (presentation.mode !== 'real-media-with-presenter-inset') return;
  push(
    errors,
    presentation.speakerIsExplainingThisAsset === true,
    `PRESENTER_INSET_EXPLANATION_BINDING_MISSING:${beat.id}`,
  );
  push(
    errors,
    presentation.minimumDurationSeconds >= 2.8,
    `PRESENTER_INSET_DURATION_INVALID:${beat.id}`,
  );
  push(
    errors,
    presentation.presenter?.source === 'authoritative-talk-source' &&
      presentation.presenter?.audioOwner === 'base-talk-only' &&
      presentation.presenter?.duplicateVideoMuted === true,
    `PRESENTER_INSET_AUDIO_OWNERSHIP_INVALID:${beat.id}`,
  );
  push(
    errors,
    presentation.presenter?.anchor === 'bottom-right' &&
      ['circle', 'rounded-rectangle'].includes(presentation.presenter?.shape),
    `PRESENTER_INSET_PLACEMENT_INVALID:${beat.id}`,
  );
  push(
    errors,
    Number.isInteger(presentation.transition?.enterFrames) &&
      presentation.transition.enterFrames >= 8 &&
      Number.isInteger(presentation.transition?.exitFrames) &&
      presentation.transition.exitFrames >= 8 &&
      presentation.transition.hardCutForbidden === true,
    `PRESENTER_INSET_TRANSITION_INVALID:${beat.id}`,
  );
  push(
    errors,
    presentation.captions?.overlapForbidden === true &&
      presentation.captions?.minimumGapPx >= 24,
    `PRESENTER_INSET_CAPTION_SAFETY_INVALID:${beat.id}`,
  );
}

function validateGeneratedVideoBrief(brief, beat, errors) {
  push(
    errors,
    brief && typeof brief === 'object',
    `GENERATED_VIDEO_BRIEF_MISSING:${beat.id}`,
  );
  if (!brief || typeof brief !== 'object') return;
  push(errors, brief.role === 'illustration-only', `GENERATED_VIDEO_ROLE_INVALID:${beat.id}`);
  push(errors, brief.presentationMode === 'full-screen', `GENERATED_VIDEO_MODE_INVALID:${beat.id}`);
  push(errors, brief.evidenceEligible === false, `GENERATED_VIDEO_EVIDENCE_ROLE_INVALID:${beat.id}`);
  push(errors, isText(brief.purpose), `GENERATED_VIDEO_PURPOSE_MISSING:${beat.id}`);
  push(errors, isText(brief.prompt), `GENERATED_VIDEO_PROMPT_MISSING:${beat.id}`);
  push(
    errors,
    brief.disclosureRequired === true,
    `GENERATED_VIDEO_DISCLOSURE_NOT_REQUIRED:${beat.id}`,
  );
}

const isNormalizedQuad = (quad) =>
  Array.isArray(quad) &&
  quad.length === 4 &&
  quad.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      point.every((value) => Number.isFinite(value) && value >= 0 && value <= 1),
  );

const containsSlashMerge = (value) => /[\/／]/u.test(String(value ?? ''));

const SYMBOL_CUE_RULES = [
  {cue: '问题票', replacement: '纯空白需求卡'},
  {cue: '问号牌', replacement: '纯空白提示卡'},
  {cue: '问号', replacement: '无图形无印记的空白纸片'},
  {cue: '编号卡', replacement: '靠颜色和位置区分的纯空白卡片'},
  {cue: '验收章', replacement: '无字确认压板'},
  {cue: '盖章', replacement: '使用无字确认压板完成机械锁定'},
  {cue: '勾选', replacement: '使用位置移动表示选择'},
  {cue: '打勾', replacement: '使用位置移动表示选择'},
  {cue: '警告牌', replacement: '纯色风险挡板'},
  {cue: '二维码', replacement: '纯空白入口卡'},
];

const SYMBOL_CUE_NEGATION_PATTERN =
  /(?:禁止|不得|不要|避免|不含|不出现|不生成|不使用|去除|排除)/gu;
const SYMBOL_CUE_NEGATION_BREAK_PATTERN =
  /(?:但|但是|仍|仍然|保留|改为|改用|使用|放置|加入|呈现)/u;
const SYMBOL_CUE_CLAUSE_BOUNDARIES = ['。', '；', ';', '.', '!', '！', '?', '？', '\n'];

function cueIsOnlyProhibited(value, cueIndex) {
  const prefix = String(value).slice(0, cueIndex);
  const clauseStart = Math.max(
    ...SYMBOL_CUE_CLAUSE_BOUNDARIES.map((boundary) => prefix.lastIndexOf(boundary)),
  );
  const clausePrefix = prefix.slice(clauseStart + 1);
  const matches = [...clausePrefix.matchAll(SYMBOL_CUE_NEGATION_PATTERN)];
  if (matches.length === 0) return false;
  const last = matches.at(-1);
  const afterNegation = clausePrefix.slice((last.index ?? 0) + last[0].length);
  return !SYMBOL_CUE_NEGATION_BREAK_PATTERN.test(afterNegation);
}

function findPositiveSymbolCues(value) {
  if (!isText(value)) return [];
  const source = String(value);
  return SYMBOL_CUE_RULES.filter(({cue}) => {
    let index = source.indexOf(cue);
    while (index >= 0) {
      if (!cueIsOnlyProhibited(source, index)) return true;
      index = source.indexOf(cue, index + cue.length);
    }
    return false;
  });
}

function surfaceBindsGroup(surfaceId, groupId) {
  if (!isText(surfaceId) || !isText(groupId)) return false;
  return (
    surfaceId === groupId ||
    surfaceId.startsWith(`${groupId}-`) ||
    surfaceId.startsWith(`${groupId}_`)
  );
}

function validateSymbolCueConflicts(scene, beat, errors) {
  if (scene.prompt?.generatedReadableTextAllowed !== false) return;
  const objectGroups = Array.isArray(scene.objectGroups) ? scene.objectGroups : [];
  const stages = Array.isArray(scene.stages) ? scene.stages : [];
  const fields = [
    ...objectGroups.map((group) => ({
      field: `objectGroups.${group.id ?? 'unknown'}.material`,
      value: group.material,
    })),
    ...stages.map((stage) => ({
      field: `stages.${stage.id ?? 'unknown'}.action`,
      value: stage.action,
    })),
    {field: 'prompt.firstFrame', value: scene.prompt?.firstFrame},
    {field: 'prompt.motion', value: scene.prompt?.motion},
  ];
  for (const {field, value} of fields) {
    for (const {cue, replacement} of findPositiveSymbolCues(value)) {
      errors.push(
        `SYMBOL_CUE_CONFLICT:${beat.id}:${field}:${cue}:USE_${replacement}`,
      );
    }
  }
}

function validatePaperScene(scene, beat, errors) {
  push(errors, scene && typeof scene === 'object', `PAPER_SCENE_MISSING:${beat.id}`);
  if (!scene || typeof scene !== 'object') return;
  push(
    errors,
    ['complex-explanation', 'mechanical-causality', 'occluded-state-reveal'].includes(
      scene.archetype,
    ),
    `PAPER_SCENE_ARCHETYPE_INVALID:${beat.id}`,
  );
  push(errors, isText(scene.title), `PAPER_SCENE_TITLE_MISSING:${beat.id}`);
  push(
    errors,
    Number.isFinite(scene.durationSeconds) && scene.durationSeconds >= 3 && scene.durationSeconds <= 12,
    `PAPER_SCENE_DURATION_INVALID:${beat.id}`,
  );

  const objectGroups = Array.isArray(scene.objectGroups) ? scene.objectGroups : [];
  const nodes = Array.isArray(scene.nodes) ? scene.nodes : [];
  const stages = Array.isArray(scene.stages) ? scene.stages : [];
  const textPlan = Array.isArray(scene.textPlan) ? scene.textPlan : [];
  const screenTextPlan = Array.isArray(scene.screenTextPlan) ? scene.screenTextPlan : [];
  const minimumGroups = scene.archetype === 'complex-explanation' ? 5 : 3;
  const minimumNodes = scene.archetype === 'complex-explanation' ? 9 : 3;

  push(
    errors,
    objectGroups.length >= minimumGroups && objectGroups.length <= 6,
    `PAPER_OBJECT_GROUP_COUNT_INVALID:${beat.id}`,
  );
  push(
    errors,
    nodes.length >= minimumNodes && nodes.length <= 13,
    `PAPER_NODE_COUNT_INVALID:${beat.id}`,
  );
  push(
    errors,
    stages.length >= 4 && stages.length <= 7,
    `PAPER_STAGE_COUNT_INVALID:${beat.id}`,
  );

  const ids = new Set();
  for (const group of objectGroups) {
    push(errors, isText(group.id), `PAPER_GROUP_ID_MISSING:${beat.id}`);
    push(errors, isText(group.name), `PAPER_GROUP_NAME_MISSING:${beat.id}`);
    push(errors, isText(group.material), `PAPER_GROUP_MATERIAL_MISSING:${beat.id}`);
    push(
      errors,
      Number.isInteger(group.depth) && group.depth >= 1 && group.depth <= 5,
      `PAPER_GROUP_DEPTH_INVALID:${beat.id}:${group.id ?? 'unknown'}`,
    );
    if (isText(group.id)) {
      push(errors, !ids.has(group.id), `PAPER_ID_DUPLICATE:${beat.id}:${group.id}`);
      ids.add(group.id);
    }
  }
  const depthCount = new Set(objectGroups.map((group) => group.depth)).size;
  push(errors, depthCount >= 3, `PAPER_DEPTH_LAYER_COUNT_INVALID:${beat.id}`);

  const nodeIds = new Set();
  const nodeById = new Map();
  for (const node of nodes) {
    push(errors, isText(node.id), `PAPER_NODE_ID_MISSING:${beat.id}`);
    push(errors, isText(node.label), `PAPER_NODE_LABEL_MISSING:${beat.id}:${node.id ?? 'unknown'}`);
    push(
      errors,
      [...String(node.label ?? '')].length <= 8,
      `PAPER_NODE_LABEL_TOO_LONG:${beat.id}:${node.id ?? 'unknown'}`,
    );
    push(
      errors,
      ids.has(node.groupId),
      `PAPER_NODE_GROUP_UNKNOWN:${beat.id}:${node.id ?? 'unknown'}`,
    );
    push(
      errors,
      ['paper-label', 'visual-only'].includes(node.textVisibility),
      `PAPER_NODE_TEXT_VISIBILITY_INVALID:${beat.id}:${node.id ?? 'unknown'}`,
    );
    if (isText(node.id)) {
      push(errors, !nodeIds.has(node.id), `PAPER_NODE_ID_DUPLICATE:${beat.id}:${node.id}`);
      nodeIds.add(node.id);
      nodeById.set(node.id, node);
    }
  }

  const stageIds = new Set();
  const stageById = new Map();
  const landingStageIdsByNode = new Map();
  stages.forEach((stage, index) => {
    push(errors, isText(stage.id), `PAPER_STAGE_ID_MISSING:${beat.id}:${index}`);
    push(errors, stage.order === index + 1, `PAPER_STAGE_ORDER_INVALID:${beat.id}:${index}`);
    push(errors, isText(stage.action), `PAPER_STAGE_ACTION_MISSING:${beat.id}:${index}`);
    push(errors, isText(stage.subject), `PAPER_STAGE_SUBJECT_MISSING:${beat.id}:${index}`);
    push(errors, isText(stage.sfxRole), `PAPER_STAGE_SFX_MISSING:${beat.id}:${index}`);
    if (isText(stage.id)) {
      stageIds.add(stage.id);
      stageById.set(stage.id, stage);
    }
    for (const nodeId of Array.isArray(stage.landingNodeIds) ? stage.landingNodeIds : []) {
      const landingStages = landingStageIdsByNode.get(nodeId) ?? [];
      landingStages.push(stage.id);
      landingStageIdsByNode.set(nodeId, landingStages);
    }
  });

  push(
    errors,
    scene.readableTextPolicy?.silentTruncationForbidden === true,
    `PAPER_TEXT_SILENT_TRUNCATION_NOT_BLOCKED:${beat.id}`,
  );
  push(
    errors,
    scene.readableTextPolicy?.slashMergeForbidden === true,
    `PAPER_TEXT_SLASH_MERGE_NOT_BLOCKED:${beat.id}`,
  );
  push(
    errors,
    Number.isInteger(scene.readableTextPolicy?.maximumSimultaneousLabels) &&
      scene.readableTextPolicy.maximumSimultaneousLabels >= 1 &&
      scene.readableTextPolicy.maximumSimultaneousLabels <= 4,
    `PAPER_TEXT_SIMULTANEOUS_LIMIT_INVALID:${beat.id}`,
  );

  const requiredTextNodeIds = new Set(
    nodes.filter((node) => node.textVisibility === 'paper-label').map((node) => node.id),
  );
  const minimumReadableLabels = scene.archetype === 'complex-explanation' ? 4 : 3;
  push(
    errors,
    requiredTextNodeIds.size >= minimumReadableLabels && requiredTextNodeIds.size <= 6,
    `PAPER_READABLE_NODE_COUNT_INVALID:${beat.id}`,
  );

  const textByNode = new Map();
  const textItemsByNode = new Map();
  const usedSurfaceIds = new Set();
  for (const item of textPlan) {
    push(errors, nodeIds.has(item.nodeId), `PAPER_TEXT_NODE_UNKNOWN:${beat.id}:${item.nodeId}`);
    push(errors, isText(item.text), `PAPER_TEXT_EMPTY:${beat.id}:${item.nodeId}`);
    push(
      errors,
      [...String(item.text ?? '')].length <= 8,
      `PAPER_TEXT_TOO_LONG:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      !containsSlashMerge(item.text),
      `PAPER_TEXT_SLASH_MERGE_FORBIDDEN:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      stageIds.has(item.enterStageId),
      `PAPER_TEXT_STAGE_UNKNOWN:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      item.role === 'diegetic-node-label',
      `PAPER_TEXT_ROLE_INVALID:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      item.groupId === nodeById.get(item.nodeId)?.groupId,
      `PAPER_TEXT_GROUP_BINDING_MISMATCH:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      isText(item.surfaceId),
      `PAPER_TEXT_SURFACE_MISSING:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      surfaceBindsGroup(item.surfaceId, item.groupId),
      `LABEL_OBJECT_BINDING_AMBIGUOUS:${beat.id}:${item.nodeId}:SURFACE_GROUP_MISMATCH`,
    );
    if (isText(item.surfaceId)) {
      push(
        errors,
        !usedSurfaceIds.has(item.surfaceId),
        `LABEL_OBJECT_BINDING_AMBIGUOUS:${beat.id}:${item.nodeId}:SURFACE_NOT_UNIQUE`,
      );
      usedSurfaceIds.add(item.surfaceId);
    }
    push(
      errors,
      isNormalizedQuad(item.anchorQuad),
      `PAPER_TEXT_ANCHOR_QUAD_INVALID:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      Number.isInteger(item.maxChars) &&
        item.maxChars >= [...String(item.text ?? '')].length &&
        item.maxChars <= 8,
      `PAPER_TEXT_MAX_CHARS_INVALID:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      isText(item.persistence),
      `PAPER_TEXT_PERSISTENCE_MISSING:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      isText(item.occlusionOwner),
      `PAPER_TEXT_OCCLUSION_OWNER_MISSING:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      item.ocrRequired === true,
      `PAPER_TEXT_OCR_NOT_REQUIRED:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      PAPER_MOTION_CONSTRAINTS.has(item.motionConstraint),
      `PAPER_TEXT_MOTION_CONSTRAINT_INVALID:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      PAPER_TEXT_EMBEDDING_MODES.has(item.embeddingMode),
      `PAPER_TEXT_EMBEDDING_MODE_INVALID:${beat.id}:${item.nodeId}`,
    );
    push(
      errors,
      Number.isInteger(item.stageOffsetFrames) && Math.abs(item.stageOffsetFrames) <= 3,
      `PAPER_TEXT_STAGE_OFFSET_INVALID:${beat.id}:${item.nodeId}`,
    );
    const enterStage = stageById.get(item.enterStageId);
    push(
      errors,
      enterStage?.subject === item.groupId,
      `LABEL_OBJECT_BINDING_AMBIGUOUS:${beat.id}:${item.nodeId}:STAGE_GROUP_MISMATCH`,
    );
    push(
      errors,
      Array.isArray(enterStage?.landingNodeIds) && enterStage.landingNodeIds.includes(item.nodeId),
      `LABEL_OBJECT_BINDING_AMBIGUOUS:${beat.id}:${item.nodeId}:ENTER_STAGE_NOT_LANDING_STAGE`,
    );
    push(
      errors,
      isText(item.persistence) && item.persistence.startsWith(`${item.enterStageId}-`),
      `LABEL_OBJECT_BINDING_AMBIGUOUS:${beat.id}:${item.nodeId}:PERSISTENCE_STAGE_MISMATCH`,
    );
    if (item.embeddingMode === 'first-frame-baked') {
      push(
        errors,
        item.motionConstraint === 'rigid-surface',
        `PAPER_FIRST_FRAME_BAKED_REQUIRES_RIGID_SURFACE:${beat.id}:${item.nodeId}`,
      );
    }
    if (item.embeddingMode === 'tracked-paper-surface') {
      push(
        errors,
        item.trackingKeyframesRequired === true,
        `PAPER_TRACKED_TEXT_KEYFRAMES_NOT_REQUIRED:${beat.id}:${item.nodeId}`,
      );
    }
    if (isText(item.nodeId)) {
      const items = textItemsByNode.get(item.nodeId) ?? [];
      items.push(item);
      textItemsByNode.set(item.nodeId, items);
      push(
        errors,
        !textByNode.has(item.nodeId),
        `PAPER_TEXT_NODE_DUPLICATE:${beat.id}:${item.nodeId}`,
      );
      textByNode.set(item.nodeId, item.text);
    }
  }
  for (const node of nodes) {
    if (node.textVisibility === 'paper-label') {
      push(
        errors,
        textByNode.get(node.id) === node.label,
        `PAPER_TEXT_NODE_LABEL_MISMATCH:${beat.id}:${node.id}`,
      );
      const boundItems = textItemsByNode.get(node.id) ?? [];
      const landingStages = landingStageIdsByNode.get(node.id) ?? [];
      push(
        errors,
        boundItems.length === 1,
        `LABEL_OBJECT_BINDING_AMBIGUOUS:${beat.id}:${node.id}:TEXT_BINDING_COUNT`,
      );
      push(
        errors,
        landingStages.length === 1 && landingStages[0] === boundItems[0]?.enterStageId,
        `LABEL_OBJECT_BINDING_AMBIGUOUS:${beat.id}:${node.id}:LANDING_STAGE_COUNT_OR_BINDING`,
      );
    } else {
      push(
        errors,
        !textByNode.has(node.id),
        `PAPER_VISUAL_ONLY_NODE_HAS_TEXT:${beat.id}:${node.id}`,
      );
    }
  }

  if (objectGroups.length > requiredTextNodeIds.size) {
    const actuallyUnlabeledGroupIds = objectGroups
      .filter(
        (group) =>
          !nodes.some(
            (node) =>
              node.textVisibility === 'paper-label' && node.groupId === group.id,
          ),
      )
      .map((group) => group.id)
      .sort();
    const declaredUnlabeledGroups = Array.isArray(
      scene.labelBindingPolicy?.unlabeledObjectGroups,
    )
      ? scene.labelBindingPolicy.unlabeledObjectGroups
      : [];
    const declaredGroupIds = declaredUnlabeledGroups
      .map((item) => item?.groupId)
      .filter(isText)
      .sort();
    const declarationsAreValid = declaredUnlabeledGroups.every(
      (item) =>
        item &&
        ids.has(item.groupId) &&
        isText(item.reason) &&
        !nodes.some(
          (node) =>
            node.textVisibility === 'paper-label' && node.groupId === item.groupId,
        ),
    );
    const declarationSetMatches =
      declaredGroupIds.length === actuallyUnlabeledGroupIds.length &&
      declaredGroupIds.every(
        (groupId, index) => groupId === actuallyUnlabeledGroupIds[index],
      );
    push(
      errors,
      declarationsAreValid && declarationSetMatches,
      `LABEL_OBJECT_BINDING_AMBIGUOUS:${beat.id}:UNLABELED_GROUPS_UNDECLARED_OR_MISMATCHED`,
    );
  }

  for (const item of screenTextPlan) {
    push(
      errors,
      SCREEN_TEXT_ROLES.has(item.role),
      `PAPER_SCREEN_TEXT_ROLE_INVALID:${beat.id}`,
    );
    push(
      errors,
      item.embeddingMode === 'screen-overlay',
      `PAPER_SCREEN_TEXT_MODE_INVALID:${beat.id}:${item.role ?? 'unknown'}`,
    );
    push(errors, isText(item.text), `PAPER_SCREEN_TEXT_EMPTY:${beat.id}:${item.role ?? 'unknown'}`);
  }

  push(
    errors,
    isText(scene.prompt?.firstFrame),
    `PAPER_FIRST_FRAME_PROMPT_MISSING:${beat.id}`,
  );
  push(
    errors,
    isText(scene.prompt?.motion),
    `PAPER_MOTION_PROMPT_MISSING:${beat.id}`,
  );
  push(
    errors,
    scene.prompt?.generatedReadableTextAllowed === false,
    `PAPER_PROMPT_GENERATED_TEXT_NOT_BLOCKED:${beat.id}`,
  );
  validateSymbolCueConflicts(scene, beat, errors);
}

export function validatePreproductionRequest({request, projectRoot, profile}) {
  const errors = [];
  push(errors, request.schemaVersion === PREPRODUCTION_REQUEST_SCHEMA, 'PREPRODUCTION_SCHEMA_INVALID');
  push(errors, isText(request.requestId), 'PREPRODUCTION_REQUEST_ID_MISSING');
  push(errors, isText(request.taskId), 'PREPRODUCTION_TASK_ID_MISSING');
  push(errors, request.phase === 'pre-shoot', 'PREPRODUCTION_PHASE_INVALID');
  push(
    errors,
    request.status === 'candidate-preview-required',
    'PREPRODUCTION_STATUS_INVALID',
  );
  push(
    errors,
    request.inputScript?.authority === 'user-confirmed-script',
    'PREPRODUCTION_SCRIPT_AUTHORITY_INVALID',
  );
  push(
    errors,
    request.inputScript?.role === 'provisional-authority',
    'PREPRODUCTION_SCRIPT_ROLE_INVALID',
  );
  push(
    errors,
    request.directorProfile?.profileId === profile.profileId &&
      request.directorProfile?.profileVersion === profile.profileVersion,
    'PREPRODUCTION_PROFILE_MISMATCH',
  );
  push(errors, request.policy?.branch === 'paper-editorial', 'PREPRODUCTION_BRANCH_INVALID');
  push(errors, request.policy?.fallback === 'blocked', 'PREPRODUCTION_FALLBACK_NOT_BLOCKED');
  push(
    errors,
    request.policy?.textStrategy === 'deterministic-first-frame-text-v3.2',
    'PREPRODUCTION_TEXT_STRATEGY_INVALID',
  );
  push(
    errors,
    request.policy?.generatedReadableTextAllowed === false,
    'PREPRODUCTION_GENERATED_TEXT_NOT_BLOCKED',
  );
  push(
    errors,
    request.policy?.modelGeneratedReadableTextAllowed === false,
    'PREPRODUCTION_MODEL_GENERATED_TEXT_NOT_BLOCKED',
  );
  push(
    errors,
    request.policy?.deterministicTextMayBeBakedIntoFirstFrame === true,
    'PREPRODUCTION_FIRST_FRAME_TEXT_BAKE_NOT_ALLOWED',
  );
  push(
    errors,
    request.policy?.defaultPaperTextMode === 'first-frame-baked',
    'PREPRODUCTION_DEFAULT_PAPER_TEXT_MODE_INVALID',
  );
  push(
    errors,
    request.policy?.actualImageAnchorCalibrationRequired === true,
    'PREPRODUCTION_ACTUAL_IMAGE_ANCHOR_CALIBRATION_NOT_REQUIRED',
  );
  push(
    errors,
    request.policy?.runningHubRequiresTextBakeReceipt === true,
    'PREPRODUCTION_RUNNINGHUB_TEXT_BAKE_RECEIPT_NOT_REQUIRED',
  );
  push(
    errors,
    request.policy?.paperNodeScreenOverlayAllowed === false,
    'PREPRODUCTION_PAPER_NODE_SCREEN_OVERLAY_ALLOWED',
  );
  push(
    errors,
    request.policy?.postShootRebindRequired === true,
    'PREPRODUCTION_POSTSHOOT_REBIND_NOT_REQUIRED',
  );

  const scriptPath = resolveDeclared(projectRoot, request.inputScript?.path);
  let scriptText = '';
  if (!scriptPath || !existsSync(scriptPath)) {
    errors.push('PREPRODUCTION_SCRIPT_FILE_MISSING');
  } else {
    scriptText = readFileSync(scriptPath, 'utf8');
    if (sha256File(scriptPath) !== request.inputScript.sha256) {
      errors.push('PREPRODUCTION_SCRIPT_SHA_MISMATCH');
    }
  }

  const requiredOutputKeys = [
    'routeLockPath',
    'planPath',
    'assetSheetPath',
    'firstFramePromptManifestPath',
    'runningHubPromptManifestPath',
    'runningHubPromptSheetPath',
    'compileReceiptPath',
    'validationReceiptPath',
  ];
  const outputKeys = Object.keys(request.outputs ?? {});
  const outputPaths = requiredOutputKeys.map((key) => request.outputs?.[key]);
  push(
    errors,
    requiredOutputKeys.every((key) => isText(request.outputs?.[key])),
    'PREPRODUCTION_OUTPUT_PATHS_INCOMPLETE',
  );
  push(
    errors,
    outputKeys.length === requiredOutputKeys.length &&
      outputKeys.every((key) => requiredOutputKeys.includes(key)),
    'PREPRODUCTION_OUTPUT_PATHS_UNEXPECTED',
  );
  outputPaths.forEach((outputPath, index) =>
    push(errors, isText(outputPath), `PREPRODUCTION_OUTPUT_PATH_MISSING:${index}`),
  );
  const normalizedOutputs = outputPaths
    .filter(isText)
    .map((outputPath) => resolveDeclared(projectRoot, outputPath));
  push(
    errors,
    new Set(normalizedOutputs).size === normalizedOutputs.length,
    'PREPRODUCTION_OUTPUT_PATHS_NOT_UNIQUE',
  );

  const beats = Array.isArray(request.beats) ? request.beats : [];
  push(errors, beats.length > 0, 'PREPRODUCTION_BEATS_EMPTY');
  const beatIds = new Set();
  const normalizedScript = normalizeSpokenText(scriptText);
  const paperRequiredKinds = new Set(profile.routingPolicy?.paperRequiredKinds ?? []);
  beats.forEach((beat, index) => {
    push(errors, isText(beat.id), `BEAT_ID_MISSING:${index}`);
    push(errors, beat.order === index + 1, `BEAT_ORDER_INVALID:${beat.id ?? index}`);
    if (isText(beat.id)) {
      push(errors, !beatIds.has(beat.id), `BEAT_ID_DUPLICATE:${beat.id}`);
      beatIds.add(beat.id);
    }
    push(errors, isText(beat.spokenLine), `BEAT_SPOKEN_LINE_MISSING:${beat.id}`);
    push(errors, isText(beat.coreMeaning), `BEAT_CORE_MEANING_MISSING:${beat.id}`);
    push(errors, isText(beat.kind), `BEAT_KIND_MISSING:${beat.id}`);
    if (normalizedScript && isText(beat.spokenLine)) {
      push(
        errors,
        normalizedScript.includes(normalizeSpokenText(beat.spokenLine)),
        `BEAT_SPOKEN_LINE_NOT_IN_SCRIPT:${beat.id}`,
      );
    }
    const decision = beat.visualDecision ?? {};
    push(errors, isText(decision.class), `BEAT_VISUAL_CLASS_MISSING:${beat.id}`);
    push(
      errors,
      MAIN_VISUAL_CLASSES.has(decision.class),
      `BEAT_VISUAL_CLASS_INVALID:${beat.id}`,
    );
    push(errors, isText(decision.producer), `BEAT_VISUAL_PRODUCER_MISSING:${beat.id}`);
    push(errors, decision.fallback === 'blocked', `BEAT_FALLBACK_NOT_BLOCKED:${beat.id}`);
    validateOverlayDecision(beat.overlayDecision, beat, errors);

    if (paperRequiredKinds.has(beat.kind)) {
      push(
        errors,
        decision.class === 'paper-editorial',
        `PAPER_REQUIRED_BEAT_UNFULFILLED:${beat.id}`,
      );
      push(
        errors,
        decision.class !== 'remotion-information',
        `GENERIC_CARD_CANNOT_SATISFY_PAPER_BEAT:${beat.id}`,
      );
      validatePaperScene(beat.paperScene, beat, errors);
    }
    if (decision.class === 'real-evidence') {
      push(
        errors,
        Array.isArray(beat.evidenceRefs) && beat.evidenceRefs.length > 0,
        `REAL_EVIDENCE_REFERENCE_MISSING:${beat.id}`,
      );
      validateRealMediaPresentation(beat.presentation, beat, errors);
    }
    if (decision.class === 'generated-video') {
      validateGeneratedVideoBrief(beat.generatedVideoBrief, beat, errors);
    }
  });

  return {ok: errors.length === 0, errors, scriptPath, scriptText};
}

export function compilePreproductionPlan({request, requestPath, profile, style}) {
  const paperBeats = request.beats.filter(
    (beat) => beat.visualDecision?.class === 'paper-editorial',
  );
  const realEvidenceBeats = request.beats.filter(
    (beat) => beat.visualDecision?.class === 'real-evidence',
  );
  const presenterInsetBeats = realEvidenceBeats.filter(
    (beat) => beat.presentation?.mode === 'real-media-with-presenter-inset',
  );
  const generatedVideoBeats = request.beats.filter(
    (beat) => beat.visualDecision?.class === 'generated-video',
  );
  const speakerBeats = request.beats.filter(
    (beat) => beat.visualDecision?.class === 'speaker',
  );
  return {
    schemaVersion: PREPRODUCTION_PLAN_SCHEMA,
    requestId: request.requestId,
    taskId: request.taskId,
    phase: 'pre-shoot',
    status: 'provisional-previsualization',
    formalEligible: false,
    postShootRebindRequired: true,
    provenance: {
      requestPath,
      requestSha256: sha256File(requestPath),
      scriptPath: request.inputScript.path,
      scriptSha256: request.inputScript.sha256,
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      styleId: style.styleId,
      acceptedDynamicAnchorSha256: style.acceptedDynamicAnchor.sha256,
    },
    routeSummary: {
      totalBeats: request.beats.length,
      paperBeatCount: paperBeats.length,
      realEvidenceBeatCount: realEvidenceBeats.length,
      presenterInsetBeatCount: presenterInsetBeats.length,
      generatedVideoBeatCount: generatedVideoBeats.length,
      speakerBeatCount: speakerBeats.length,
      otherBeatCount:
        request.beats.length - paperBeats.length - realEvidenceBeats.length -
        generatedVideoBeats.length - speakerBeats.length,
      fallback: 'blocked',
      genericInformationCardCanSatisfyPaperBeat: false,
    },
    beats: request.beats,
    paperScenes: paperBeats.map((beat) => ({
      beatId: beat.id,
      spokenLine: beat.spokenLine,
      coreMeaning: beat.coreMeaning,
      ...beat.paperScene,
    })),
    realEvidenceAssignments: realEvidenceBeats.map((beat) => ({
      beatId: beat.id,
      spokenLine: beat.spokenLine,
      evidenceRefs: beat.evidenceRefs,
      presentation: beat.presentation,
      overlayDecision: beat.overlayDecision ?? null,
    })),
    generatedVideoAssignments: generatedVideoBeats.map((beat) => ({
      beatId: beat.id,
      spokenLine: beat.spokenLine,
      coreMeaning: beat.coreMeaning,
      generatedVideoBrief: beat.generatedVideoBrief,
    })),
    nextGate: 'completion-stills-and-local-candidate-preview',
  };
}

export function buildRouteLock({request, requestPath, profile, style, plan}) {
  return {
    schemaVersion: DIRECTOR_ROUTE_LOCK_SCHEMA,
    requestId: request.requestId,
    taskId: request.taskId,
    phase: 'pre-shoot',
    branch: 'paper-editorial',
    fallback: 'blocked',
    genericInformationCardCanSatisfyPaperBeat: false,
    requestPath,
    requestSha256: sha256File(requestPath),
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    styleId: style.styleId,
    paperBeatIds: plan.paperScenes.map((scene) => scene.beatId),
    realEvidenceBeatIds: plan.realEvidenceAssignments.map((item) => item.beatId),
    presenterInsetBeatIds: plan.realEvidenceAssignments
      .filter((item) => item.presentation?.mode === 'real-media-with-presenter-inset')
      .map((item) => item.beatId),
    generatedVideoBeatIds: plan.generatedVideoAssignments.map((item) => item.beatId),
    formalEligible: false,
    postShootRebindRequired: true,
  };
}

export function renderAssetSheet(plan) {
  const lines = [
    `# ${plan.taskId} 纸艺导演素材执行单`,
    '',
    '> 状态：预拍候选。拍摄后必须根据实录重新对齐时间和节点文字，不可直接当作正式成片计划。',
    '',
  ];
  plan.paperScenes.forEach((scene, index) => {
    lines.push(`## P${String(index + 1).padStart(2, '0')} ${scene.title}`);
    lines.push('');
    lines.push(`- 对应口播：${scene.spokenLine}`);
    lines.push(`- 核心含义：${scene.coreMeaning}`);
    lines.push(`- 镜头类型：${scene.archetype}`);
    lines.push(`- 建议时长：${scene.durationSeconds}秒`);
    lines.push(`- 节点文字：${scene.nodes.map((node) => node.label).join(' / ')}`);
    lines.push(
      `- 首帧基础图：${buildSceneIdentity(scene, index).firstFrameOutputFileName}（自动化内部中间文件，模型不负责写中文）`,
    );
    lines.push(
      `- 最终带字首帧：${buildSceneIdentity(scene, index).bakedFirstFrameOutputFileName}（本地确定性写字并通过OCR后，才可送入RunningHub）`,
    );
    lines.push('- 图生视频交付：提示词只在独立 RunningHub 清单中');
    lines.push('- 装配步骤：');
    scene.stages.forEach((stage) => {
      lines.push(`  ${stage.order}. ${stage.action}；音效：${stage.sfxRole}`);
    });
    lines.push('');
  });
  if (plan.realEvidenceAssignments.length > 0) {
    lines.push('## 真实素材对位');
    lines.push('');
    plan.realEvidenceAssignments.forEach((item) => {
      lines.push(`- ${item.beatId}：${item.spokenLine}`);
      lines.push(`  素材：${item.evidenceRefs.join(' / ')}`);
      lines.push(`  呈现：${item.presentation.mode}`);
      lines.push(`  素材原声：${item.presentation.materialAudioMode}`);
    });
    lines.push('');
  }
  if (plan.generatedVideoAssignments.length > 0) {
    lines.push('## AI生成视频（仅作情景演绎）');
    lines.push('');
    plan.generatedVideoAssignments.forEach((item) => {
      lines.push(`- ${item.beatId}：${item.spokenLine}`);
      lines.push(`  用途：${item.generatedVideoBrief.purpose}`);
      lines.push(`  画面：全屏；证据资格：无；需要AI内容声明：是`);
      lines.push(`  提示词：${item.generatedVideoBrief.prompt}`);
    });
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

export function buildSceneIdentity(scene, index) {
  const sceneId = `P${String(index + 1).padStart(2, '0')}`;
  const pairId = `${sceneId}-${scene.beatId}`;
  const firstFrameOutputFileName = `${sceneId}_${scene.beatId}_first-frame.png`;
  const bakedFirstFrameOutputFileName = `${sceneId}_${scene.beatId}_first-frame-text-baked.png`;
  const firstFramePromptSha256 = sha256Buffer(
    Buffer.from(scene.prompt.firstFrame, 'utf8'),
  );
  const imageToVideoPromptSha256 = sha256Buffer(
    Buffer.from(scene.prompt.motion, 'utf8'),
  );
  const textPlanSha256 = sha256Json({
    textPlan: scene.textPlan,
    screenTextPlan: scene.screenTextPlan ?? [],
  });
  const hasFirstFrameBakedText = scene.textPlan.some(
    (item) => item.embeddingMode === 'first-frame-baked',
  );
  const pairSha256 = sha256Json({
    pairId,
    firstFramePromptSha256,
    imageToVideoPromptSha256,
    textPlanSha256,
  });
  return {
    sceneId,
    pairId,
    firstFrameOutputFileName,
    bakedFirstFrameOutputFileName,
    runningHubInputFileName: hasFirstFrameBakedText
      ? bakedFirstFrameOutputFileName
      : firstFrameOutputFileName,
    firstFramePromptSha256,
    imageToVideoPromptSha256,
    textPlanSha256,
    hasFirstFrameBakedText,
    pairSha256,
  };
}

const buildTextOverlayPlan = (scene) =>
  scene.textPlan.map((item) => ({
    ...item,
  }));

const buildFirstFrameBakePlan = (scene, identity) => {
  const labels = buildTextOverlayPlan(scene).filter(
    (item) => item.embeddingMode === 'first-frame-baked',
  );
  return {
    enabled: identity.hasFirstFrameBakedText,
    sourceImageFileName: identity.firstFrameOutputFileName,
    outputImageFileName: identity.bakedFirstFrameOutputFileName,
    textPlanSha256: identity.textPlanSha256,
    labelsSha256: sha256Json(labels),
    labels,
    ocrRequired: identity.hasFirstFrameBakedText,
    anchorCalibrationRequired: identity.hasFirstFrameBakedText,
    plannedAnchorQuadsAreProvisional: identity.hasFirstFrameBakedText,
    calibratedAnchorField: 'calibratedAnchorQuad',
  };
};

export function buildFirstFramePromptManifest(plan) {
  return {
    schemaVersion: FIRST_FRAME_PROMPT_MANIFEST_SCHEMA,
    requestId: plan.requestId,
    taskId: plan.taskId,
    phase: 'pre-shoot',
    status: 'automation-input-ready',
    consumer: 'first-frame-image-automation',
    promptRole: 'raw-paper-scene-before-deterministic-text-bake',
    finalDeliverableRole: 'text-baked-first-frame-for-runninghub',
    generatedReadableTextAllowed: false,
    modelGeneratedReadableTextAllowed: false,
    deterministicTextMayBeBakedIntoFirstFrame: true,
    sourcePlanCanonicalSha256: sha256Json(plan),
    sceneCount: plan.paperScenes.length,
    scenes: plan.paperScenes.map((scene, index) => {
      const identity = buildSceneIdentity(scene, index);
      return {
        sceneId: identity.sceneId,
        pairId: identity.pairId,
        beatId: scene.beatId,
        title: scene.title,
        spokenLine: scene.spokenLine,
        aspectRatio: '16:9',
        outputFileName: identity.firstFrameOutputFileName,
        firstFramePrompt: scene.prompt.firstFrame,
        firstFramePromptSha256: identity.firstFramePromptSha256,
        textPlanSha256: identity.textPlanSha256,
        pairSha256: identity.pairSha256,
        generatedReadableTextAllowed: false,
        modelGeneratedReadableTextAllowed: false,
        deterministicTextBake: buildFirstFrameBakePlan(scene, identity),
        postProductionTextOverlay: buildTextOverlayPlan(scene),
      };
    }),
  };
}

export function buildRunningHubPromptManifest(plan) {
  return {
    schemaVersion: RUNNINGHUB_PROMPT_MANIFEST_SCHEMA,
    requestId: plan.requestId,
    taskId: plan.taskId,
    phase: 'pre-shoot',
    status: 'awaiting-text-baked-firstframes',
    consumer: 'runninghub-manual-image-to-video',
    generationMode: 'image-to-video',
    executionOwner: 'user-manual',
    codexExternalSubmissionAllowed: false,
    submissionBlockedUntil: [
      'raw-first-frame-visual-review-passed',
      'actual-paper-surface-anchor-calibration-passed',
      'deterministic-text-bake-receipt-passed',
      'text-baked-first-frame-ocr-passed',
      'runninghub-ready-pack-issued',
    ],
    sourcePlanCanonicalSha256: sha256Json(plan),
    sceneCount: plan.paperScenes.length,
    scenes: plan.paperScenes.map((scene, index) => {
      const identity = buildSceneIdentity(scene, index);
      return {
        sceneId: identity.sceneId,
        pairId: identity.pairId,
        beatId: scene.beatId,
        title: scene.title,
        spokenLine: scene.spokenLine,
        inputFirstFrameFileName: identity.runningHubInputFileName,
        inputFirstFramePromptSha256: identity.firstFramePromptSha256,
        inputFirstFrameTextPlanSha256: identity.textPlanSha256,
        durationSeconds: scene.durationSeconds,
        imageToVideoPrompt: scene.prompt.motion,
        imageToVideoPromptSha256: identity.imageToVideoPromptSha256,
        pairSha256: identity.pairSha256,
        generatedReadableTextAllowed: false,
        modelGeneratedReadableTextAllowed: false,
        inputContainsDeterministicBakedText: identity.hasFirstFrameBakedText,
        handoffState: 'awaiting-text-baked-firstframe-and-ocr',
        postProductionTextOverlay: buildTextOverlayPlan(scene),
      };
    }),
  };
}

export function validatePromptHandoffManifests({
  plan,
  firstFrameManifest,
  runningHubManifest,
}) {
  const errors = [];
  push(
    errors,
    firstFrameManifest?.schemaVersion === FIRST_FRAME_PROMPT_MANIFEST_SCHEMA,
    'FIRST_FRAME_PROMPT_MANIFEST_SCHEMA_INVALID',
  );
  push(
    errors,
    runningHubManifest?.schemaVersion === RUNNINGHUB_PROMPT_MANIFEST_SCHEMA,
    'RUNNINGHUB_PROMPT_MANIFEST_SCHEMA_INVALID',
  );
  push(
    errors,
    runningHubManifest?.status === 'awaiting-text-baked-firstframes',
    'RUNNINGHUB_PROMPT_MANIFEST_PREMATURELY_READY',
  );
  const firstFrameScenes = Array.isArray(firstFrameManifest?.scenes)
    ? firstFrameManifest.scenes
    : [];
  const runningHubScenes = Array.isArray(runningHubManifest?.scenes)
    ? runningHubManifest.scenes
    : [];
  push(
    errors,
    firstFrameScenes.length === plan.paperScenes.length,
    'FIRST_FRAME_PROMPT_SCENE_COUNT_MISMATCH',
  );
  push(
    errors,
    runningHubScenes.length === plan.paperScenes.length,
    'RUNNINGHUB_PROMPT_SCENE_COUNT_MISMATCH',
  );
  plan.paperScenes.forEach((scene, index) => {
    const identity = buildSceneIdentity(scene, index);
    const firstFrame = firstFrameScenes[index] ?? {};
    const runningHub = runningHubScenes[index] ?? {};
    const suffix = identity.sceneId;
    push(errors, firstFrame.sceneId === identity.sceneId, `FIRST_FRAME_SCENE_ID_MISMATCH:${suffix}`);
    push(errors, runningHub.sceneId === identity.sceneId, `RUNNINGHUB_SCENE_ID_MISMATCH:${suffix}`);
    push(errors, firstFrame.pairId === identity.pairId, `FIRST_FRAME_PAIR_ID_MISMATCH:${suffix}`);
    push(errors, runningHub.pairId === identity.pairId, `RUNNINGHUB_PAIR_ID_MISMATCH:${suffix}`);
    push(
      errors,
      firstFrame.pairSha256 === identity.pairSha256 &&
        runningHub.pairSha256 === identity.pairSha256,
      `PROMPT_PAIR_SHA_MISMATCH:${suffix}`,
    );
    push(
      errors,
      firstFrame.firstFramePrompt === scene.prompt.firstFrame &&
        firstFrame.firstFramePromptSha256 === identity.firstFramePromptSha256,
      `FIRST_FRAME_PROMPT_MISMATCH:${suffix}`,
    );
    push(
      errors,
      runningHub.imageToVideoPrompt === scene.prompt.motion &&
        runningHub.imageToVideoPromptSha256 === identity.imageToVideoPromptSha256,
      `RUNNINGHUB_PROMPT_MISMATCH:${suffix}`,
    );
    push(
      errors,
      runningHub.inputFirstFrameFileName === identity.runningHubInputFileName &&
        runningHub.inputFirstFramePromptSha256 === identity.firstFramePromptSha256 &&
        runningHub.inputFirstFrameTextPlanSha256 === identity.textPlanSha256,
      `RUNNINGHUB_FIRST_FRAME_BINDING_MISMATCH:${suffix}`,
    );
    push(
      errors,
      firstFrame.textPlanSha256 === identity.textPlanSha256 &&
        firstFrame.deterministicTextBake?.textPlanSha256 === identity.textPlanSha256,
      `FIRST_FRAME_TEXT_PLAN_BINDING_MISMATCH:${suffix}`,
    );
    push(
      errors,
      firstFrame.deterministicTextBake?.enabled === identity.hasFirstFrameBakedText &&
        runningHub.inputContainsDeterministicBakedText === identity.hasFirstFrameBakedText,
      `FIRST_FRAME_TEXT_BAKE_MODE_MISMATCH:${suffix}`,
    );
    push(
      errors,
      firstFrame.deterministicTextBake?.anchorCalibrationRequired ===
          identity.hasFirstFrameBakedText &&
        runningHub.handoffState === 'awaiting-text-baked-firstframe-and-ocr',
      `FIRST_FRAME_TEXT_BAKE_GATE_MISMATCH:${suffix}`,
    );
    push(
      errors,
      !Object.hasOwn(firstFrame, 'imageToVideoPrompt'),
      `FIRST_FRAME_MANIFEST_CONTAINS_VIDEO_PROMPT:${suffix}`,
    );
    push(
      errors,
      !Object.hasOwn(runningHub, 'firstFramePrompt'),
      `RUNNINGHUB_MANIFEST_CONTAINS_FIRST_FRAME_PROMPT:${suffix}`,
    );
  });
  return {ok: errors.length === 0, errors};
}

export function renderRunningHubPromptSheet(plan, runningHubManifest) {
  const lines = [
    `# ${plan.taskId} RunningHub 图生视频提示词`,
    '',
    '> 本文件只包含图生视频动作提示词，不包含首帧生图提示词。请按同一 P 编号选择对应首帧图片。',
    '> 当前状态不是可提交状态。只有 runninghub-ready-pack.v1.json 生成后，才可把其中已通过OCR的带字首帧交给 RunningHub。',
    '> 生成模型不得自由改写中文；带字纸片只允许刚性滑入、平移、小角度旋转、抽屉推出与拼图扣合。',
    '',
  ];
  runningHubManifest.scenes.forEach((scene) => {
    lines.push(`## ${scene.sceneId} ${scene.title}`);
    lines.push('');
    lines.push(`- 配对编号：${scene.pairId}`);
    lines.push(`- 输入首帧：${scene.inputFirstFrameFileName}`);
    lines.push(`- 建议时长：${scene.durationSeconds}秒`);
    lines.push(`- 当前门禁：${scene.handoffState}`);
    lines.push(
      `- 文字模式：${scene.inputContainsDeterministicBakedText ? '输入首帧已确定性带字；RunningHub只做刚性纸片动作' : 'Remotion 纸面跟踪'}`,
    );
    lines.push(
      `- 精确节点：${scene.postProductionTextOverlay.map((item) => `${item.text}（${item.embeddingMode}）`).join(' / ')}`,
    );
    lines.push('- 图生视频提示词（RunningHub）：');
    lines.push('');
    lines.push('```text');
    lines.push(scene.imageToVideoPrompt);
    lines.push('```');
    lines.push('');
  });
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}
