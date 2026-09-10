import {renderPhysicalConstraints, validatePaperPhysicalContract} from './paper-physical-contract.mjs';
import {renderProjectionConstraints, validatePaperProjectionContract} from './paper-projection-contract.mjs';

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const list = (value) => Array.isArray(value) ? value : [];
const normalized = (value) => String(value ?? '').replace(/[\s\p{P}\p{S}]/gu, '');
const operations = new Set(['hold', 'slide', 'rotate-rigid', 'unfold', 'fold', 'insert', 'open', 'close', 'lock']);
const verbs = {hold: '保持静止', slide: '整体滑动', 'rotate-rigid': '小角度刚性转动', unfold: '展开', fold: '折合', insert: '卡入', open: '打开', close: '关闭', lock: '锁定'};
const rectValid = (r) => r && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(r[key])) &&
  r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x + r.width <= 1.000000001 && r.y + r.height <= 1.000000001;
const overlaps = (a, b) => Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
  Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
const contained = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width + 1e-9 &&
  b.y + b.height <= a.y + a.height + 1e-9;
const edgeKey = (edge) => `${edge.partId}:${edge.fromGroupId}:${edge.toGroupId}`;

export const PAPER_MOTION_SCHEMA = 'koubo-paper-motion-contract/v1';

export function paperMechanismSnapshot(scene) {
  const {semanticReview: _review, ...contract} = scene.motionContract ?? {};
  return {objectGroups: scene.objectGroups, nodes: scene.nodes, textPlan: scene.textPlan,
    layoutContract: scene.layoutContract, contract};
}

export function renderMotionFirstFrame(scene) {
  return [
    '摄影级微缩手作纸艺初态，16:9横屏，深蓝纸台、暖白纸牌、少量暖黄色强调，三层真实纸质空间、柔和侧光。固定机位，所有标签正面朝向观众。',
    ...list(scene.objectGroups).map((group) => `${group.id}为${group.name}，材料为${group.material}，位于第${group.depth}层。`),
    renderStillMechanismConstraints(scene),
    '严格保留标签牌数量与各自预留位置，牌面完全空白，后续由本地工具写字。只呈现动作开始前的状态，不提前摆出尚未发生的结果。',
    '不生成文字、字母、数字、图标或水印，不增加装饰物。',
  ].join('\n');
}

export function renderMotionAction(scene, action) {
  const parts = list(scene.motionContract?.parts);
  const name = parts.find((part) => part.id === action.partId)?.name ?? action.partId;
  const groupName = (id) => list(scene.objectGroups).find((group) => group.id === id)?.name ?? id;
  const route = action.fromGroupId === action.toGroupId ? `在${groupName(action.fromGroupId)}` :
    `从${groupName(action.fromGroupId)}移至${groupName(action.toGroupId)}`;
  return `${name}${route}，${verbs[action.operation] ?? action.operation}。`;
}

export function renderMotionPrompt(scene) {
  const contract = scene.motionContract;
  if (!contract) return '';
  const actions = list(contract.actions);
  const lines = [
    '以输入带字首帧为唯一基准，固定机位，保持真实微缩纸艺材质、构图、光照和物件身份。',
    '所有中文牌独立固定在非活动支架上，全程正面可读；只有下列指定的无字部件运动，其余物件保持静止。',
    renderPhysicalConstraints(scene),
    ...[renderProjectionConstraints(scene)].filter(Boolean),
    ...actions.map((action) => `${action.startSeconds}至${action.endSeconds}秒：${renderMotionAction(scene, action)}`),
  ];
  for (const edge of list(contract.forbiddenTransfers)) {
    const part = list(contract.parts).find((p) => p.id === edge.partId);
    const destination = list(scene.objectGroups).find((g) => g.id === edge.toGroupId);
    lines.push(`${part?.name ?? edge.partId}始终留在被允许的位置，与${destination?.name ?? edge.toGroupId}隔离。`);
  }
  for (const rule of list(contract.requiredPredecessors)) {
    const before = actions.find((action) => action.id === rule.beforeActionId);
    const after = actions.find((action) => action.id === rule.actionId);
    if (before && after) lines.push(`先完成“${renderMotionAction(scene, before)}”，才可开始“${renderMotionAction(scene, after)}”。`);
  }
  lines.push('所有运动走无字通道，避开中文牌和底部字幕预留区；不增加物件、不改字、不遮字、不翻动带字表面。');
  lines.push('动作间保持上一状态，动作结束后保持结果。只保留轻而清楚的原生纸张与卡合音效，无对白、口播或背景音乐。');
  return lines.join('\n');
}

export function renderStillMechanismConstraints(scene) {
  const contract = scene.motionContract;
  if (!contract) return '';
  const parts = list(contract.parts);
  const groups = list(scene.objectGroups);
  return [
    '机构初态约束：标签均为空白刚性牌，每张牌有独立不活动支架，与铰接、翻折和输送零件保持间隔。活动零件均无字。',
    renderPhysicalConstraints(scene),
    ...[renderProjectionConstraints(scene)].filter(Boolean),
    ...parts.filter((part) => part.kind === 'blank-part').map((part) => {
      const initial = list(contract.initialLocations).find((state) => state.partId === part.id);
      return `${part.name}初始位于${groups.find((group) => group.id === initial?.groupId)?.name ?? initial?.groupId}。`;
    }),
    ...list(contract.forbiddenTransfers).map((edge) =>
      `${parts.find((part) => part.id === edge.partId)?.name}所在路线与${groups.find((group) => group.id === edge.toGroupId)?.name}物理隔离，中间保留可见间隙，不设置相连纸路。`),
  ].join('\n');
}

// Validate typed transitions first; prompts are compiled from them, not a second free-form program.
export function validatePaperMotionContract({scene, beat, required = false, physicalRequired = required}) {
  const errors = [
    ...validatePaperPhysicalContract({scene, beat, required: physicalRequired}),
    ...validatePaperProjectionContract({scene, beat}),
  ];
  const fail = (ok, code) => {if (!ok) errors.push(`${code}:${beat.id}`);};
  const contract = scene?.motionContract;
  if (!contract) {
    fail(!required, 'PAPER_MOTION_CONTRACT_REQUIRED');
    return errors;
  }
  fail(contract.schemaVersion === PAPER_MOTION_SCHEMA, 'PAPER_MOTION_SCHEMA_INVALID');
  const meaning = contract.meaning ?? {};
  const quoteMatches = (quote) => text(quote) && normalized(quote).length > 0 &&
    normalized(beat.spokenLine).includes(normalized(quote));
  fail(quoteMatches(meaning.sourceQuote), 'PAPER_MEANING_SOURCE_QUOTE_MISMATCH');
  fail(text(meaning.viewerTakeaway) && list(meaning.excludedOutcomes).length > 0 &&
    meaning.excludedOutcomes.every(text), 'PAPER_MEANING_BOUNDARY_REQUIRED');
  fail(contract.dynamicValidation?.requiredBeforeBatch === true &&
    contract.dynamicValidation?.staticApprovalIsNotDynamicApproval === true &&
    contract.dynamicValidation?.automaticRetryAllowed === false, 'PAPER_DYNAMIC_PILOT_POLICY_REQUIRED');
  const groups = new Set(list(scene.objectGroups).map((group) => group.id));
  const labels = list(scene.textPlan);
  fail(labels.length <= scene.readableTextPolicy?.maximumSimultaneousLabels,
    'PAPER_INITIAL_LABELS_EXCEED_READABLE_LIMIT');
  for (const label of labels) fail(label.embeddingMode === 'first-frame-baked' &&
    label.enterStageId === 'initial' && label.persistence === 'initial-to-end' &&
    label.firstReadableFrame === 0, 'PAPER_FIXED_LABEL_VISIBILITY_REQUIRED');
  const parts = list(contract.parts);
  const partById = new Map();
  for (const part of parts) {
    fail(text(part.id) && !partById.has(part.id), 'PAPER_PART_ID_INVALID');
    partById.set(part.id, part);
    fail(text(part.name) && groups.has(part.groupId), 'PAPER_PART_GROUP_INVALID');
    fail(['label', 'blank-part'].includes(part.kind), 'PAPER_PART_KIND_INVALID');
    if (part.kind === 'label') {
      fail(part.mount === 'independent-fixed-stand', 'PAPER_LABEL_MOUNT_NOT_INDEPENDENT');
      const matches = labels.filter((label) => label.surfaceId === part.surfaceId && label.groupId === part.groupId);
      fail(matches.length === 1, 'PAPER_LABEL_PART_BINDING_INVALID');
    }
  }
  for (const label of labels) fail(parts.filter((part) => part.kind === 'label' &&
    part.surfaceId === label.surfaceId && part.groupId === label.groupId).length === 1,
  'PAPER_LABEL_PART_COVERAGE_INVALID');
  const blankParts = parts.filter((part) => part.kind === 'blank-part');
  fail(blankParts.length > 0, 'PAPER_MOVING_PART_REQUIRED');
  const locations = new Map();
  for (const state of list(contract.initialLocations)) {
    fail(partById.get(state.partId)?.kind === 'blank-part' && groups.has(state.groupId) &&
      !locations.has(state.partId), 'PAPER_INITIAL_STATE_INVALID');
    locations.set(state.partId, state.groupId);
  }
  fail(locations.size === blankParts.length, 'PAPER_INITIAL_STATE_COVERAGE_INVALID');
  const allowed = list(contract.allowedTransfers);
  const forbidden = list(contract.forbiddenTransfers);
  fail(Array.isArray(contract.allowedTransfers) && Array.isArray(contract.forbiddenTransfers), 'PAPER_TRANSFER_RULES_REQUIRED');
  for (const edge of [...allowed, ...forbidden]) {
    fail(partById.get(edge.partId)?.kind === 'blank-part' && groups.has(edge.fromGroupId) &&
      groups.has(edge.toGroupId), 'PAPER_TRANSFER_RULE_UNKNOWN_PART_OR_GROUP');
  }
  for (const edge of forbidden) fail(quoteMatches(edge.sourceQuote), 'PAPER_FORBIDDEN_RULE_SOURCE_MISMATCH');
  const checkForbiddenState = () => {
    for (const edge of forbidden) fail(locations.get(edge.partId) !== edge.toGroupId, 'PAPER_FORBIDDEN_STATE');
  };
  checkForbiddenState();
  const allowedKeys = new Set(allowed.map(edgeKey));
  const forbiddenKeys = new Set(forbidden.map(edgeKey));
  fail(![...allowedKeys].some((key) => forbiddenKeys.has(key)), 'PAPER_TRANSFER_RULE_CONTRADICTION');
  const actions = list(contract.actions);
  fail(actions.length >= 1 && actions.length <= 7, 'PAPER_MOTION_ACTION_COUNT_INVALID');
  const activeActions = actions.filter((action) => action.operation !== 'hold');
  fail(activeActions.length >= 1 && activeActions.length <= 4, 'PAPER_MOTION_COMPLEXITY_EXCEEDS_PILOT_LIMIT');
  const byId = new Map();
  const stageIds = new Set(list(scene.stages).map((stage) => stage.id));
  fail(stageIds.size === list(scene.stages).length, 'PAPER_ACTION_STAGE_DUPLICATE');
  let previousEnd = 0;
  for (const action of actions) {
    fail(text(action.id) && !byId.has(action.id), 'PAPER_ACTION_ID_INVALID');
    byId.set(action.id, action);
    fail(stageIds.has(action.stageId), 'PAPER_ACTION_STAGE_UNKNOWN');
    fail(operations.has(action.operation), 'PAPER_ACTION_OPERATION_INVALID');
    fail(Number.isFinite(action.startSeconds) && Number.isFinite(action.endSeconds) &&
      action.startSeconds >= previousEnd && action.endSeconds > action.startSeconds &&
      action.endSeconds <= scene.durationSeconds, 'PAPER_ACTION_TIME_INVALID');
    previousEnd = action.endSeconds;
    const part = partById.get(action.partId);
    fail(part?.kind === 'blank-part', 'PAPER_TEXT_SURFACE_ACTION_FORBIDDEN');
    fail(groups.has(action.fromGroupId) && groups.has(action.toGroupId), 'PAPER_ACTION_GROUP_UNKNOWN');
    fail(locations.get(action.partId) === action.fromGroupId, 'PAPER_ACTION_STATE_DISCONTINUITY');
    if (action.fromGroupId !== action.toGroupId) {
      fail(allowedKeys.has(edgeKey(action)), 'PAPER_TRANSFER_NOT_ALLOWED');
      // A forbidden destination stays forbidden even if an intermediate waypoint is inserted.
      fail(!forbidden.some((edge) => edge.partId === action.partId && edge.toGroupId === action.toGroupId),
        'PAPER_FORBIDDEN_TRANSFER');
    }
    locations.set(action.partId, action.toGroupId);
    checkForbiddenState();
    const zone = action.sweptRect;
    fail(rectValid(zone), 'PAPER_MOTION_ZONE_INVALID');
    if (rectValid(zone)) {
      const safe = scene.layoutContract?.contentSafeRect;
      const reserved = scene.layoutContract?.subtitleReservedRect;
      fail(rectValid(safe) && contained(safe, zone) && rectValid(reserved) && !overlaps(zone, reserved),
        'PAPER_MOTION_ZONE_UNSAFE');
      for (const label of list(scene.layoutContract?.paperLabelSurfaceBoxes)) {
        fail(rectValid(label.box) && !overlaps(zone, label.box), 'PAPER_MOTION_LABEL_COLLISION');
      }
    }
  }
  for (const stage of list(scene.stages)) {
    const owned = actions.filter((action) => action.stageId === stage.id);
    fail(owned.length === 1, 'PAPER_ACTION_STAGE_COVERAGE_INVALID');
    if (owned.length === 1) {
      fail(stage.subject === partById.get(owned[0].partId)?.groupId, 'PAPER_ACTION_SUBJECT_MISMATCH');
      fail(stage.action === renderMotionAction(scene, owned[0]), 'PAPER_STAGE_ACTION_NOT_COMPILED');
    }
  }
  const dependencies = list(contract.requiredPredecessors);
  fail(Array.isArray(contract.requiredPredecessors), 'PAPER_PRECONDITIONS_REQUIRED');
  for (const rule of dependencies) {
    const before = byId.get(rule.beforeActionId);
    const after = byId.get(rule.actionId);
    fail(quoteMatches(rule.sourceQuote), 'PAPER_PRECONDITION_SOURCE_MISMATCH');
    fail(before && after && before.id !== after.id && before.endSeconds <= after.startSeconds &&
      before.operation !== 'hold', 'PAPER_PRECONDITION_NOT_SATISFIED');
  }
  const final = list(contract.finalLocations);
  fail(final.length === blankParts.length && new Set(final.map((s) => s.partId)).size === blankParts.length,
    'PAPER_FINAL_STATE_COVERAGE_INVALID');
  for (const state of final) fail(partById.get(state.partId)?.kind === 'blank-part' &&
    groups.has(state.groupId) && locations.get(state.partId) === state.groupId, 'PAPER_FINAL_STATE_MISMATCH');
  for (const state of final) fail(!forbidden.some((edge) => edge.partId === state.partId && edge.toGroupId === state.groupId),
    'PAPER_FORBIDDEN_STATE');
  fail(scene.prompt?.firstFrame === renderMotionFirstFrame(scene), 'PAPER_FIRSTFRAME_PROMPT_NOT_COMPILED');
  fail(scene.prompt?.motion === renderMotionPrompt(scene), 'PAPER_MOTION_PROMPT_NOT_COMPILED');
  return errors;
}
