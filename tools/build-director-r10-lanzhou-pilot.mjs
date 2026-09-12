import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  assertDirectorR10TimelineIntegrity,
  compileDirectorR10Timeline,
} from './director-r10-timeline-core.mjs';

export const LANZHOU_R10_INTENT_PATH =
  'workflow/director-r10/lanzhou-window-r1.intent.json';
export const LANZHOU_R10_RUNTIME_PATH =
  'remotion/src/lanzhou-industry-ai-r10-pilot-r1/runtime-timeline.r10.json';
export const LANZHOU_R10_COMPILE_RECEIPT_PATH =
  'workflow/director-r10/lanzhou-window-r1.compile-receipt.json';

const ADAPTER_PATH = 'tools/build-director-r10-lanzhou-pilot.mjs';
const EXPECTED_FPS = 30;
const EXPECTED_LOCAL_SOURCE_OFFSET_FRAME = 1200;
const EXPECTED_DURATION_FRAMES = 1737;
const REQUIRED_BEAT_IDS = Object.freeze(['B05', 'B06', 'B07', 'B08']);
const REQUIRED_PAPER_MOTION_ACTION_FIELDS = Object.freeze([
  'targetGroupIds',
  'operation',
  'motionWindowFrames',
  'landedOffsetFrames',
  'relationStartOffsetFrames',
  'relationEndOffsetFrames',
]);
const GOVERNANCE_ROLES = new Set([
  'governance-account-strategy',
  'governance-public-fact-boundary',
  'governance-production-discipline',
  'governance-production-sop',
  'governance-compliance-evidence',
  'governance-script-style',
]);
const FORBIDDEN_INTENT_TIMING_KEYS = new Set([
  'startSeconds',
  'endSeconds',
  'durationSeconds',
  'timeSeconds',
  'enterAt',
  'frame',
  'startFrame',
  'endFrame',
  'durationFrames',
  'durationInFrames',
  'firstVisibleFrame',
  'firstReadableFrame',
  'semanticSettleFrame',
  'actionEndFrame',
  'endFrameExclusive',
  'previewCoverage',
]);

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareText)
      .map((key) => [key, stableValue(value[key])]),
  );
};
const stablePrettyJson = (value) => `${JSON.stringify(stableValue(value), null, 2)}\n`;
const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

export class LanzhouR10BuildError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}:${message}`);
    this.name = 'LanzhouR10BuildError';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => {
  throw new LanzhouR10BuildError(code, message, details);
};

const parseJson = (bytes, relativePath) => {
  try {
    return JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes));
  } catch (error) {
    fail('R10_LANZHOU_JSON_INVALID', `${relativePath}不是合法JSON。`, {
      cause: error.message,
    });
  }
};

const findForbiddenIntentTiming = (value, trail = '$') => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = findForbiddenIntentTiming(value[index], `${trail}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_INTENT_TIMING_KEYS.has(key) || /(?:Seconds|Milliseconds)$/u.test(key)) {
      return {key, path: `${trail}.${key}`};
    }
    const hit = findForbiddenIntentTiming(nested, `${trail}.${key}`);
    if (hit) return hit;
  }
  return null;
};

const normalizeProjectRelativePath = (relativePath, label) => {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    fail('R10_LANZHOU_PATH_INVALID', `${label}缺少项目相对路径。`);
  }
  const normalized = path.posix.normalize(relativePath.trim().replaceAll('\\', '/'));
  if (
    normalized === '.' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    fail('R10_LANZHOU_PATH_INVALID', `${label}必须是项目内相对路径。`, {
      relativePath,
    });
  }
  return normalized;
};

const readProjectFile = ({projectRoot, relativePath, readFile, encoding = 'utf8'}) => {
  const normalizedPath = normalizeProjectRelativePath(relativePath, relativePath);
  let bytes;
  try {
    bytes = encoding == null
      ? readFile(path.join(projectRoot, normalizedPath))
      : readFile(path.join(projectRoot, normalizedPath), encoding);
  } catch (error) {
    fail('R10_LANZHOU_SOURCE_READ_FAILED', `无法读取${normalizedPath}。`, {
      cause: error.message,
    });
  }
  const rawBytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), 'utf8');
  const text = rawBytes.toString('utf8');
  return {
    path: normalizedPath,
    text,
    bytes: rawBytes,
    sha256: sha256(rawBytes),
  };
};

const defaultGitTracked = (projectRoot, relativePath) => {
  const result = spawnSync(
    'git',
    ['ls-files', '--error-unmatch', '--', relativePath],
    {cwd: projectRoot, encoding: 'utf8'},
  );
  return result.status === 0;
};

const requirePinnedSources = ({intent, projectRoot, readFile}) => {
  if (!Array.isArray(intent.sourceBindings) || intent.sourceBindings.length === 0) {
    fail('R10_LANZHOU_SOURCE_BINDINGS_INVALID', 'intent.sourceBindings不得为空。');
  }
  const roles = new Set();
  const bindings = intent.sourceBindings.map((binding, index) => {
    if (!isRecord(binding)) {
      fail('R10_LANZHOU_SOURCE_BINDINGS_INVALID', `sourceBindings[${index}]必须是对象。`);
    }
    const role = String(binding.role ?? '').trim();
    if (!role || roles.has(role)) {
      fail('R10_LANZHOU_SOURCE_BINDINGS_INVALID', `来源角色${role || index}缺失或重复。`);
    }
    roles.add(role);
    const source = readProjectFile({
      projectRoot,
      relativePath: binding.path,
      readFile,
    });
    const pinnedSha = String(binding.sha256 ?? '').toLowerCase();
    if (!/^[a-f0-9]{64}$/u.test(pinnedSha) || source.sha256 !== pinnedSha) {
      fail(
        'R10_LANZHOU_SOURCE_SHA_MISMATCH',
        `${source.path}当前SHA-256与意图锁不一致，禁止编译。`,
        {role, expectedSha256: pinnedSha, actualSha256: source.sha256},
      );
    }
    return {
      role,
      path: source.path,
      sha256: source.sha256,
      application:
        typeof binding.application === 'string' ? binding.application.trim() : null,
      text: source.text,
    };
  });
  for (const role of [
    'actual-spoken-bilingual',
    'spoken-timeline',
    'legacy-postshoot-detection-only',
    'paper-style-candidate',
    'r10-component-registry',
    'r10-timeline-compiler',
    ...GOVERNANCE_ROLES,
  ]) {
    if (!roles.has(role)) {
      fail('R10_LANZHOU_SOURCE_BINDINGS_INVALID', `缺少必需来源角色${role}。`);
    }
  }
  return bindings;
};

const bindingByRole = (bindings, role) => {
  const binding = bindings.find((candidate) => candidate.role === role);
  if (!binding) fail('R10_LANZHOU_SOURCE_BINDINGS_INVALID', `缺少${role}。`);
  return binding;
};

const exactFrameFromMs = (ms, fps, label) => {
  if (!Number.isInteger(ms) || ms < 0 || (ms * fps) % 1000 !== 0) {
    fail(
      'R10_LANZHOU_CAPTION_BOUNDARY_NOT_FRAME_EXACT',
      `${label}不能在${fps}fps下精确落帧。`,
      {ms, fps},
    );
  }
  return (ms * fps) / 1000;
};

const validateBoundaryDescriptor = (descriptor, label) => {
  if (!isRecord(descriptor)) {
    fail('R10_LANZHOU_BOUNDARY_INVALID', `${label}必须引用captionId边界。`);
  }
  const keys = Object.keys(descriptor).sort(compareText);
  const allowed = new Set(['boundary', 'captionId', 'offsetFrames']);
  if (keys.some((key) => !allowed.has(key))) {
    fail('R10_LANZHOU_BOUNDARY_INVALID', `${label}只允许captionId、boundary和offsetFrames。`);
  }
  const captionId = String(descriptor.captionId ?? '').trim();
  const boundary = descriptor.boundary;
  const offsetFrames = descriptor.offsetFrames ?? 0;
  if (
    !/^cap-b\d{2}-p\d{2}$/u.test(captionId) ||
    !['start', 'end'].includes(boundary) ||
    !Number.isInteger(offsetFrames)
  ) {
    fail('R10_LANZHOU_BOUNDARY_INVALID', `${label}的字幕边界引用不合法。`);
  }
  return {captionId, boundary, offsetFrames};
};

const makeBoundaryResolver = ({captionsById, fps}) => (descriptor, label) => {
  const normalized = validateBoundaryDescriptor(descriptor, label);
  const caption = captionsById.get(normalized.captionId);
  if (!caption) {
    fail('R10_LANZHOU_CAPTION_NOT_FOUND', `${label}引用了不存在的${normalized.captionId}。`);
  }
  const ms = normalized.boundary === 'start' ? caption.startMs : caption.endMs;
  return exactFrameFromMs(ms, fps, label) + normalized.offsetFrames;
};

const selectCaptionSpan = ({captions, span, sourceBeatId}) => {
  const startId = validateBoundaryDescriptor(span?.start, 'captionSpan.start').captionId;
  const endId = validateBoundaryDescriptor(span?.end, 'captionSpan.end').captionId;
  const startIndex = captions.findIndex((caption) => caption.id === startId);
  const endIndex = captions.findIndex((caption) => caption.id === endId);
  if (startIndex < 0 || endIndex < startIndex) {
    fail('R10_LANZHOU_CAPTION_SPAN_INVALID', `${sourceBeatId}的captionSpan不连续。`);
  }
  const selected = captions.slice(startIndex, endIndex + 1);
  if (selected.some((caption) => caption.beatId !== sourceBeatId)) {
    fail('R10_LANZHOU_CAPTION_SPAN_INVALID', `${sourceBeatId}的captionSpan跨越了其他节拍。`);
  }
  return selected;
};

const validateRecordedAuthority = ({actual, spoken, spokenSha}) => {
  if (
    actual.canonicalSource !== 'recorded-audio' ||
    actual.formalAllowed !== false ||
    !Array.isArray(actual.captions)
  ) {
    fail('R10_LANZHOU_ACTUAL_AUTHORITY_INVALID', '实录双语字幕没有保持recorded-audio候选权威边界。');
  }
  if (
    spoken.formalAllowed !== false ||
    spoken.scriptRole !== 'comparison-only' ||
    !Array.isArray(spoken.captions)
  ) {
    fail('R10_LANZHOU_SPOKEN_AUTHORITY_INVALID', '聚合实录时间轴的候选边界不合法。');
  }
  if (actual.source?.aggregateSpokenTimeline?.sha256 !== spokenSha) {
    fail('R10_LANZHOU_SPOKEN_SOURCE_LINK_MISMATCH', '实录双语字幕未绑定当前聚合时间轴SHA。');
  }
  for (const beatId of REQUIRED_BEAT_IDS) {
    const granular = actual.captions.filter((caption) => caption.beatId === beatId);
    const aggregate = spoken.captions.find((caption) => caption.beatId === beatId);
    if (
      granular.length === 0 ||
      !aggregate ||
      aggregate.startMs !== granular[0].startMs ||
      aggregate.endMs !== granular.at(-1).endMs
    ) {
      fail('R10_LANZHOU_SPOKEN_AGGREGATE_MISMATCH', `${beatId}聚合边界与逐句实录不一致。`);
    }
  }
};

const validateComponentRegistry = (registry) => {
  if (
    registry.schemaVersion !== 'director-r10-component-registry/v1' ||
    registry.productionEligible !== false ||
    registry.publicDir !== 'remotion/public-lanzhou-industry-ai-v91-r1' ||
    registry.soundSourceContract?.runtimePrefix !== 'sfx/' ||
    registry.soundSourceContract?.canonicalTrackedAssetRoot !==
      'remotion/public/audio/koubo-sfx-v8/' ||
    registry.soundSourceContract?.publicCopyMustMatchCanonicalSha256 !== true ||
    !Array.isArray(registry.components) ||
    !Array.isArray(registry.motionProfiles)
  ) {
    fail('R10_LANZHOU_COMPONENT_REGISTRY_INVALID', 'R10组件注册表边界不合法。');
  }
  const componentMap = new Map();
  for (const component of registry.components) {
    if (
      typeof component.id !== 'string' ||
      typeof component.version !== 'string' ||
      typeof component.rendererId !== 'string' ||
      !isRecord(component.lifecycle)
    ) {
      fail('R10_LANZHOU_COMPONENT_REGISTRY_INVALID', '组件必须有稳定ID、版本、rendererId和生命周期。');
    }
    for (const anchor of ['firstVisible', 'firstReadable', 'semanticSettle', 'actionEnd']) {
      if (component.lifecycle[anchor] !== 'required') {
        fail('R10_LANZHOU_COMPONENT_REGISTRY_INVALID', `${component.id}缺少${anchor}生命周期合同。`);
      }
    }
    if (!Number.isInteger(component.lifecycle.finalHold?.minimumFrames)) {
      fail('R10_LANZHOU_COMPONENT_REGISTRY_INVALID', `${component.id}缺少finalHold合同。`);
    }
    componentMap.set(component.id, component);
  }
  const motionProfileMap = new Map();
  for (const profile of registry.motionProfiles) {
    const id = String(profile?.id ?? '').trim();
    const requiredActionFields = profile?.requiredActionFields;
    if (
      !/^[a-z][a-z0-9-]*$/u.test(id) ||
      motionProfileMap.has(id) ||
      typeof profile.version !== 'string' ||
      profile.category !== 'paper-editorial' ||
      !Array.isArray(requiredActionFields) ||
      !REQUIRED_PAPER_MOTION_ACTION_FIELDS.every((field) =>
        requiredActionFields.includes(field),
      ) ||
      !Number.isInteger(profile.motionWindowFrames?.min) ||
      !Number.isInteger(profile.motionWindowFrames?.max) ||
      profile.motionWindowFrames.min <= 0 ||
      profile.motionWindowFrames.max < profile.motionWindowFrames.min ||
      !Number.isInteger(profile.landedOffsetFrames?.min) ||
      !Number.isInteger(profile.landedOffsetFrames?.max) ||
      profile.landedOffsetFrames.min < 0 ||
      profile.landedOffsetFrames.max < profile.landedOffsetFrames.min ||
      profile.relationOffsets?.requireStartAtOrAfterLanding !== true ||
      profile.relationOffsets?.requireEndAfterStart !== true ||
      profile.relationOffsets?.requireEndAtOrBeforeMotionEnd !== true ||
      !Array.isArray(profile.allowedOperations) ||
      profile.allowedOperations.length === 0 ||
      profile.allowedOperations.some((operation) =>
        typeof operation !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(operation),
      ) ||
      new Set(profile.allowedOperations).size !== profile.allowedOperations.length
    ) {
      fail(
        'R10_LANZHOU_MOTION_PROFILE_INVALID',
        `动作档案${id || '<unknown>'}缺少可机器校验的独立动作窗口合同。`,
      );
    }
    motionProfileMap.set(id, stableValue(profile));
  }
  const paper = componentMap.get('paper-content-pipeline-r10');
  const target = paper?.structureTarget;
  const paperStructureTargetValid = Boolean(
    target?.objectGroups?.min === 5 &&
      target.objectGroups.max === 6 &&
      target.semanticNodes?.min === 9 &&
      target.semanticNodes.max === 13 &&
      target.minimumDepthLayers >= 3 &&
      target.assemblyBeats?.min === 5 &&
      target.assemblyBeats.max === 7,
  );
  if (!paperStructureTargetValid) {
    fail('R10_LANZHOU_COMPONENT_REGISTRY_INVALID', 'B07纸艺组件结构目标不符合R10试点合同。');
  }
  const paperMotionProfile = motionProfileMap.get('paper-stop-motion-v1');
  const paperMotionProfileValid = Boolean(
    paperMotionProfile &&
      paperMotionProfile.motionWindowFrames.min === 16 &&
      paperMotionProfile.motionWindowFrames.max === 24 &&
      paperMotionProfile.landedOffsetFrames.max === 9 &&
      Array.isArray(paper.motionProfileIds) &&
      paper.motionProfileIds.includes(paperMotionProfile.id),
  );
  if (!paperMotionProfileValid) {
    fail(
      'R10_LANZHOU_MOTION_PROFILE_INVALID',
      'B07纸艺组件必须显式绑定paper-stop-motion-v1的16至24帧独立动作窗口。',
    );
  }
  return {
    componentMap,
    motionProfileMap,
    paperStructureTargetValid,
    paperMotionProfileValid,
    publicDir: registry.publicDir,
    soundSourceContract: registry.soundSourceContract,
  };
};

const compilePaperMotionAuthoring = ({intentEvent, component, motionProfile, paperStructure}) => {
  const actions = intentEvent.actions ?? [];
  if (intentEvent.category !== 'paper-editorial') {
    if (intentEvent.motionProfileId != null) {
      fail(
        'R10_LANZHOU_MOTION_PROFILE_INVALID',
        `${intentEvent.id}非纸艺事件不得绑定纸艺动作档案。`,
      );
    }
    return {motionProfile: null, actions};
  }
  const profileId = String(intentEvent.motionProfileId ?? '').trim();
  if (
    !motionProfile ||
    motionProfile.id !== profileId ||
    !Array.isArray(component.motionProfileIds) ||
    !component.motionProfileIds.includes(profileId)
  ) {
    fail(
      'R10_LANZHOU_MOTION_PROFILE_INVALID',
      `${intentEvent.id}必须显式绑定当前组件注册的motionProfileId。`,
    );
  }
  if (!Array.isArray(actions) || actions.length !== paperStructure.assemblyBeatIds.length) {
    fail(
      'R10_LANZHOU_PAPER_MOTION_ACTION_INVALID',
      `${intentEvent.id}动作数必须与assemblyBeatIds一一对应。`,
    );
  }
  const groupIds = new Set(paperStructure.objectGroups.map((group) => group.id));
  const operations = new Set();
  const compiledActions = actions.map((action, index) => {
    const actionId = String(action?.id ?? '').trim();
    if (
      actionId !== paperStructure.assemblyBeatIds[index] ||
      REQUIRED_PAPER_MOTION_ACTION_FIELDS.some((field) => !Object.hasOwn(action ?? {}, field))
    ) {
      fail(
        'R10_LANZHOU_PAPER_MOTION_ACTION_INVALID',
        `${intentEvent.id}动作${actionId || index}缺少${profileId}合同字段或与assemblyBeat错位。`,
      );
    }
    if (
      !Array.isArray(action.targetGroupIds) ||
      action.targetGroupIds.length === 0 ||
      new Set(action.targetGroupIds).size !== action.targetGroupIds.length ||
      action.targetGroupIds.some((groupId) => !groupIds.has(groupId))
    ) {
      fail(
        'R10_LANZHOU_PAPER_MOTION_TARGET_INVALID',
        `${intentEvent.id}动作${actionId}引用了未注册或重复的纸艺物件组。`,
      );
    }
    if (
      !motionProfile.allowedOperations.includes(action.operation) ||
      operations.has(action.operation)
    ) {
      fail(
        'R10_LANZHOU_PAPER_MOTION_OPERATION_INVALID',
        `${intentEvent.id}动作${actionId}必须使用${profileId}中唯一注册的operation。`,
      );
    }
    operations.add(action.operation);
    if (
      !Number.isInteger(action.motionWindowFrames) ||
      action.motionWindowFrames < motionProfile.motionWindowFrames.min ||
      action.motionWindowFrames > motionProfile.motionWindowFrames.max ||
      !Number.isInteger(action.landedOffsetFrames) ||
      action.landedOffsetFrames < motionProfile.landedOffsetFrames.min ||
      action.landedOffsetFrames > motionProfile.landedOffsetFrames.max ||
      !Number.isInteger(action.relationStartOffsetFrames) ||
      !Number.isInteger(action.relationEndOffsetFrames) ||
      action.relationStartOffsetFrames < action.landedOffsetFrames ||
      action.relationEndOffsetFrames <= action.relationStartOffsetFrames ||
      action.relationEndOffsetFrames > action.motionWindowFrames
    ) {
      fail(
        'R10_LANZHOU_PAPER_MOTION_WINDOW_INVALID',
        `${intentEvent.id}动作${actionId}的独立动作、落定或关系线窗口不符合${profileId}。`,
      );
    }
    return action;
  });
  return {motionProfile, actions: compiledActions};
};

const auditLegacyPostshoot = ({postshoot, actualB07, r10ActionCount}) => {
  const beat = postshoot.beats?.find((candidate) => candidate.id === 'B07');
  const bindings = beat?.paperScene?.textPlan
    ?.map((item) => item.postshootBinding)
    .filter(Boolean) ?? [];
  const legacyActionCount = beat?.paperScene?.motionContract?.actions?.length ?? 0;
  const anchorStarts = bindings.map((binding) => binding.anchorStartMs);
  const anchorEnds = bindings.map((binding) => binding.anchorEndMs);
  const aggregateOnly =
    Array.isArray(beat?.actualCaptionIds) &&
    beat.actualCaptionIds.length === 1 &&
    beat.actualCaptionIds[0] === 'cap-b07';
  const tailFlattenDetected = Boolean(
    aggregateOnly &&
      anchorStarts.length > 0 &&
      anchorStarts.every((value) => value >= actualB07.at(-1).endMs - 300) &&
      anchorEnds.every((value) => value <= actualB07.at(-1).endMs),
  );
  if (!tailFlattenDetected || legacyActionCount !== 4) {
    fail('R10_LANZHOU_LEGACY_TAIL_AUDIT_FAILED', '未能重现B07旧后拍计划的尾部压扁证据。');
  }
  return {
    timingAuthorityUsed: false,
    tailFlattenDetected,
    detectedTailStartMs: Math.min(...anchorStarts),
    detectedTailEndMs: Math.max(...anchorEnds),
    actualB07StartMs: actualB07[0].startMs,
    actualB07EndMs: actualB07.at(-1).endMs,
    legacyAggregateCaptionIds: beat.actualCaptionIds,
    legacyB07GranularActionCount: legacyActionCount,
    r10B07ActionCount: r10ActionCount,
    rule: 'legacy-postshoot-read-for-tail-flatten-detection-only-never-timing-authority',
  };
};

const compilePaperStructure = ({intentEvent, selectedCaptions, component}) => {
  if (intentEvent.category !== 'paper-editorial') return null;
  const structure = intentEvent.paperStructure;
  const target = component.structureTarget;
  if (!isRecord(structure) || !target) {
    fail('R10_LANZHOU_PAPER_STRUCTURE_INVALID', `${intentEvent.id}缺少纸艺结构真源定义。`);
  }
  if (
    !Array.isArray(structure.objectGroups) ||
    structure.objectGroups.length < target.objectGroups.min ||
    structure.objectGroups.length > target.objectGroups.max ||
    !Array.isArray(structure.semanticNodes) ||
    structure.semanticNodes.length < target.semanticNodes.min ||
    structure.semanticNodes.length > target.semanticNodes.max ||
    !Number.isInteger(structure.depthLayers) ||
    structure.depthLayers < target.minimumDepthLayers ||
    !Array.isArray(structure.assemblyBeatIds) ||
    structure.assemblyBeatIds.length < target.assemblyBeats.min ||
    structure.assemblyBeatIds.length > target.assemblyBeats.max
  ) {
    fail(
      'R10_LANZHOU_PAPER_STRUCTURE_COUNT_INVALID',
      `${intentEvent.id}必须显式提供5至6个物件组、9至13个实录节点、至少3层空间和5至7个装配节拍。`,
    );
  }
  const stableIdPattern = /^[a-z][a-z0-9-]*$/u;
  const objectGroups = structure.objectGroups.map((group) => {
    const id = String(group?.id ?? '').trim();
    const labelZh = String(group?.labelZh ?? '').trim();
    if (!stableIdPattern.test(id) || !labelZh) {
      fail('R10_LANZHOU_PAPER_STRUCTURE_INVALID', '纸艺物件组必须有稳定小写英文ID和中文标签。');
    }
    return {id, labelZh};
  });
  if (new Set(objectGroups.map((group) => group.id)).size !== objectGroups.length) {
    fail('R10_LANZHOU_PAPER_STRUCTURE_INVALID', '纸艺物件组ID不得重复。');
  }
  const groupIds = new Set(objectGroups.map((group) => group.id));
  const selectedById = new Map(selectedCaptions.map((caption) => [caption.id, caption]));
  const semanticNodes = structure.semanticNodes.map((node) => {
    const nodeId = String(node?.nodeId ?? '').trim();
    const objectGroupId = String(node?.objectGroupId ?? '').trim();
    const labelZh = String(node?.labelZh ?? '').trim();
    const captionId = String(node?.captionId ?? '').trim();
    if (!stableIdPattern.test(nodeId) || !labelZh || !selectedById.has(captionId)) {
      fail(
        'R10_LANZHOU_PAPER_NODE_EVIDENCE_INVALID',
        `纸艺节点${nodeId || '<unknown>'}必须绑定当前事件的逐句实录captionId与非空中文。`,
      );
    }
    if (!groupIds.has(objectGroupId)) {
      fail(
        'R10_LANZHOU_PAPER_NODE_GROUP_INVALID',
        `纸艺节点${nodeId}引用了未注册物件组${objectGroupId}。`,
      );
    }
    if (!selectedById.get(captionId).zh.includes(labelZh)) {
      fail(
        'R10_LANZHOU_PAPER_NODE_EVIDENCE_INVALID',
        `纸艺节点${nodeId}文字不是${captionId}中可核对的实录片段。`,
      );
    }
    return {nodeId, objectGroupId, labelZh, captionId};
  });
  if (new Set(semanticNodes.map((node) => node.nodeId)).size !== semanticNodes.length) {
    fail('R10_LANZHOU_PAPER_STRUCTURE_INVALID', '纸艺语义节点ID不得重复。');
  }
  const actionIds = (intentEvent.actions ?? []).map((action) => action.id);
  if (
    structure.assemblyBeatIds.join('|') !== actionIds.join('|') ||
    new Set(structure.assemblyBeatIds).size !== structure.assemblyBeatIds.length
  ) {
    fail(
      'R10_LANZHOU_PAPER_ASSEMBLY_BEATS_INVALID',
      '纸艺装配节拍必须与六个实录动作一一对应，不得在渲染器中另行硬编。',
    );
  }
  return {
    objectGroups,
    semanticNodes,
    depthLayers: structure.depthLayers,
    assemblyBeatIds: [...structure.assemblyBeatIds],
  };
};

const buildCoreEvent = ({
  intentEvent,
  captions,
  resolveBoundary,
  localOffset,
  component,
  motionProfile,
}) => {
  if (!isRecord(intentEvent) || !/^B(?:05|06|07|08)$/u.test(intentEvent.sourceBeatId)) {
    fail('R10_LANZHOU_EVENT_INVALID', '意图事件必须绑定B05至B08实录节拍。');
  }
  const selected = selectCaptionSpan({
    captions,
    span: intentEvent.captionSpan,
    sourceBeatId: intentEvent.sourceBeatId,
  });
  const resolveLocal = (descriptor, label) =>
    resolveBoundary(descriptor, label) - localOffset;
  const semantic = {};
  for (const name of ['spokenStart', 'claim', 'emphasis', 'spokenEnd']) {
    semantic[name] = resolveLocal(
      intentEvent.semanticAnchors?.[name],
      `${intentEvent.id}.semanticAnchors.${name}`,
    );
  }
  const namedAnchors = Object.fromEntries(
    Object.entries(intentEvent.namedAnchors ?? {}).map(([name, descriptor]) => {
      const normalized = validateBoundaryDescriptor(
        descriptor,
        `${intentEvent.id}.namedAnchors.${name}`,
      );
      const sourceCaption = captions.find((caption) => caption.id === normalized.captionId);
      if (!sourceCaption || sourceCaption.beatId !== intentEvent.sourceBeatId) {
        fail('R10_LANZHOU_NAMED_ANCHOR_INVALID', `${name}没有绑定当前事件的实录分段。`);
      }
      return [
        name,
        {
          frame: resolveLocal(descriptor, `${intentEvent.id}.namedAnchors.${name}`),
          captionIds: [sourceCaption.id],
          wordIds: [],
          timingPrecision: sourceCaption.timingPrecision,
        },
      ];
    }),
  );
  const actionLabelsZh = Object.fromEntries(
    (intentEvent.actions ?? []).map((action) => [action.id, action.labelZh]),
  );
  const paperStructure = compilePaperStructure({
    intentEvent,
    selectedCaptions: selected,
    component,
  });
  const paperMotion = compilePaperMotionAuthoring({
    intentEvent,
    component,
    motionProfile,
    paperStructure,
  });
  return {
    id: intentEvent.id,
    beatId: intentEvent.beatId,
    category: intentEvent.category,
    motionProfile: paperMotion.motionProfile,
    semanticBinding: {
      spokenStartFrame: semantic.spokenStart,
      claimFrame: semantic.claim,
      emphasisFrame: semantic.emphasis,
      spokenEndFrame: semantic.spokenEnd,
      captionIds: selected.map((caption) => caption.id),
      wordIds: [],
      namedAnchors,
    },
    visual: {
      component: component.rendererId,
      props: {
        registryComponentId: component.id,
        componentVersion: component.version,
        rendererId: component.rendererId,
        lifecycleContractVersion: '1',
        lifecycle: component.lifecycle,
        structureTarget: component.structureTarget ?? null,
        motionProfileId: paperMotion.motionProfile?.id ?? null,
        paperStructure,
        objectGroups: paperStructure?.objectGroups ?? [],
        semanticNodes: paperStructure?.semanticNodes ?? [],
        depthLayers: paperStructure?.depthLayers ?? null,
        assemblyBeatIds: paperStructure?.assemblyBeatIds ?? [],
        sourceBeatId: intentEvent.sourceBeatId,
        sourceCaptions: selected.map(({id, zh, en}) => ({id, zh, en})),
        actionLabelsZh,
        evidenceAuthority: 'recorded-audio-candidate-from-local-asr',
        illustrationOnly: intentEvent.category === 'paper-editorial',
        productionEligible: false,
      },
      timing: intentEvent.visualTiming,
    },
    sound: intentEvent.sound ?? null,
    actions: paperMotion.actions.map((action) => ({
      id: action.id,
      soundRequired: intentEvent.category === 'paper-editorial' ? true : undefined,
      targetGroupIds: action.targetGroupIds,
      operation: action.operation,
      motionWindowFrames: action.motionWindowFrames,
      landedOffsetFrames: action.landedOffsetFrames,
      relationStartOffsetFrames: action.relationStartOffsetFrames,
      relationEndOffsetFrames: action.relationEndOffsetFrames,
      timing: {
        start: action.start,
        endExclusive: action.endExclusive,
      },
      sound: action.sound,
    })),
  };
};

const atomicallyWriteText = (targetPath, bytes) => {
  mkdirSync(path.dirname(targetPath), {recursive: true});
  const temporaryPath = `${targetPath}.tmp-${process.pid}`;
  try {
    writeFileSync(temporaryPath, bytes, {encoding: 'utf8', flag: 'wx'});
    renameSync(temporaryPath, targetPath);
  } catch (error) {
    fail('R10_LANZHOU_ATOMIC_WRITE_FAILED', `无法原子写入${targetPath}。`, {
      cause: error.message,
    });
  }
};

export const buildLanzhouR10Pilot = ({
  projectRoot = path.resolve(import.meta.dirname, '..'),
  readFile = readFileSync,
  gitTracked = defaultGitTracked,
} = {}) => {
  const intentSource = readProjectFile({
    projectRoot,
    relativePath: LANZHOU_R10_INTENT_PATH,
    readFile,
  });
  const intent = parseJson(intentSource.text, LANZHOU_R10_INTENT_PATH);
  const forbiddenTiming = findForbiddenIntentTiming(intent);
  if (forbiddenTiming) {
    fail(
      'R10_LANZHOU_INTENT_ABSOLUTE_TIMING_FORBIDDEN',
      `意图文件只能使用captionId边界与相对帧，不得出现${forbiddenTiming.path}。`,
    );
  }
  if (
    intent.schemaVersion !== 'director-r10-lanzhou-window-intent/v1' ||
    intent.status !== 'sidecar-pilot-intent' ||
    intent.productionEligible !== false ||
    intent.fps !== EXPECTED_FPS
  ) {
    fail('R10_LANZHOU_INTENT_INVALID', '兰州R10意图必须保持30fps非生产旁路边界。');
  }

  const sourceBindings = requirePinnedSources({
    intent,
    projectRoot,
    readFile,
  });
  const sourceJson = (role) => {
    const binding = bindingByRole(sourceBindings, role);
    return parseJson(binding.text, binding.path);
  };
  const actual = sourceJson('actual-spoken-bilingual');
  const spoken = sourceJson('spoken-timeline');
  const postshoot = sourceJson('legacy-postshoot-detection-only');
  const style = sourceJson('paper-style-candidate');
  const registry = sourceJson('r10-component-registry');
  validateRecordedAuthority({
    actual,
    spoken,
    spokenSha: bindingByRole(sourceBindings, 'spoken-timeline').sha256,
  });
  if (style.status !== 'blocked-candidate' || style.productionEligible !== false) {
    fail('R10_LANZHOU_STYLE_BOUNDARY_INVALID', '纸艺风格来源必须保持blocked-candidate与非生产边界。');
  }
  const {
    componentMap,
    motionProfileMap,
    paperStructureTargetValid,
    paperMotionProfileValid,
    publicDir,
    soundSourceContract,
  } = validateComponentRegistry(registry);

  const captions = actual.captions;
  const captionsById = new Map(captions.map((caption) => [caption.id, caption]));
  if (captionsById.size !== captions.length) {
    fail('R10_LANZHOU_CAPTION_ID_DUPLICATE', '实录字幕captionId不得重复。');
  }
  const resolveBoundary = makeBoundaryResolver({
    captionsById,
    fps: intent.fps,
  });
  const localSourceOffsetFrame = resolveBoundary(
    intent.sourceWindow?.start,
    'sourceWindow.start',
  );
  const sourceEndFrameExclusive = resolveBoundary(
    intent.sourceWindow?.end,
    'sourceWindow.end',
  );
  const durationFrames = sourceEndFrameExclusive - localSourceOffsetFrame;
  if (
    localSourceOffsetFrame !== EXPECTED_LOCAL_SOURCE_OFFSET_FRAME ||
    durationFrames !== EXPECTED_DURATION_FRAMES
  ) {
    fail(
      'R10_LANZHOU_SOURCE_WINDOW_MISMATCH',
      '实录窗口必须严格编译为源偏移1200帧、本地1737帧。',
      {localSourceOffsetFrame, durationFrames},
    );
  }

  if (!Array.isArray(intent.events) || intent.events.length !== 4) {
    fail('R10_LANZHOU_EVENT_INVALID', '试点意图必须且只能包含B05、B06、B07、B08四个事件。');
  }
  const eventBeatIds = intent.events.map((event) => event.sourceBeatId);
  if (eventBeatIds.join('|') !== REQUIRED_BEAT_IDS.join('|')) {
    fail('R10_LANZHOU_EVENT_INVALID', '试点事件顺序必须为B05至B08。');
  }
  const definitionEvents = intent.events.map((intentEvent) => {
    const component = componentMap.get(intentEvent.componentId);
    if (!component || component.category !== intentEvent.category) {
      fail('R10_LANZHOU_COMPONENT_NOT_REGISTERED', `${intentEvent.id}没有绑定同类型注册组件。`);
    }
    const motionProfile = intentEvent.motionProfileId == null
      ? null
      : motionProfileMap.get(String(intentEvent.motionProfileId).trim());
    return buildCoreEvent({
      intentEvent,
      captions,
      resolveBoundary,
      localOffset: localSourceOffsetFrame,
      component,
      motionProfile,
    });
  });

  const adapterSource = readProjectFile({
    projectRoot,
    relativePath: ADAPTER_PATH,
    readFile,
  });
  const referencedSounds = intent.events.flatMap((event) => [
    event.sound,
    ...(event.actions ?? []).map((action) => action.sound),
  ]).filter(Boolean);
  const uniqueSounds = new Map();
  for (const sound of referencedSounds) {
    const runtimeSource = String(sound.source ?? '');
    if (
      !runtimeSource.startsWith(soundSourceContract.runtimePrefix) ||
      path.posix.dirname(runtimeSource) !== 'sfx' ||
      !runtimeSource.endsWith('.wav')
    ) {
      fail(
        'R10_LANZHOU_SFX_RUNTIME_SOURCE_INVALID',
        `音效${runtimeSource || '<empty>'}必须显式绑定为当前publicDir下的sfx/*.wav。`,
      );
    }
    if (!isRecord(sound.sourceAsset)) {
      fail('R10_LANZHOU_SFX_SOURCE_ASSET_REQUIRED', `${runtimeSource}缺少已跟踪V8源音效绑定。`);
    }
    const canonicalPath = normalizeProjectRelativePath(
      sound.sourceAsset.path,
      `${runtimeSource}.sourceAsset.path`,
    );
    if (
      !canonicalPath.startsWith(soundSourceContract.canonicalTrackedAssetRoot) ||
      path.posix.basename(canonicalPath) !== path.posix.basename(runtimeSource)
    ) {
      fail('R10_LANZHOU_SFX_SOURCE_ASSET_INVALID', `${runtimeSource}与V8源音效文件名不一致。`);
    }
    const identity = `${runtimeSource}\u0000${canonicalPath}`;
    const declared = {
      runtimeSource,
      canonicalPath,
      canonicalSha256: String(sound.sourceAsset.sha256 ?? '').toLowerCase(),
    };
    const previous = uniqueSounds.get(identity);
    if (previous && previous.canonicalSha256 !== declared.canonicalSha256) {
      fail('R10_LANZHOU_SFX_SOURCE_SHA_MISMATCH', `${runtimeSource}重复绑定了不同源哈希。`);
    }
    uniqueSounds.set(identity, declared);
  }
  const sfxFiles = [...uniqueSounds.values()]
    .sort((left, right) => compareText(left.runtimeSource, right.runtimeSource))
    .map((declared) => {
      const canonical = readProjectFile({
        projectRoot,
        relativePath: declared.canonicalPath,
        readFile,
        encoding: null,
      });
      if (
        canonical.sha256 !== declared.canonicalSha256 ||
        !gitTracked(projectRoot, canonical.path)
      ) {
        fail(
          'R10_LANZHOU_SFX_SOURCE_SHA_MISMATCH',
          `${canonical.path}不是意图锁定的已跟踪V8音效。`,
          {
            expectedSha256: declared.canonicalSha256,
            actualSha256: canonical.sha256,
          },
        );
      }
      const publicPath = path.posix.join(publicDir, declared.runtimeSource);
      const publicCopy = readProjectFile({
        projectRoot,
        relativePath: publicPath,
        readFile,
        encoding: null,
      });
      if (publicCopy.sha256 !== canonical.sha256) {
        fail(
          'R10_LANZHOU_SFX_COPY_MISMATCH',
          `${publicPath}与已跟踪V8源音效字节不一致。`,
          {publicSha256: publicCopy.sha256, canonicalSha256: canonical.sha256},
        );
      }
      return {
        runtimeSource: declared.runtimeSource,
        publicDir,
        publicPath,
        path: publicPath,
        sha256: publicCopy.sha256,
        canonicalPath: canonical.path,
        canonicalSha256: canonical.sha256,
        gitTracked: true,
        canonicalGitTracked: true,
        byteIdentical: true,
      };
    });
  const sourceGraph = [
    ...sourceBindings.map(({role, path: sourcePath, sha256: sourceSha}) => ({
      role,
      path: sourcePath,
      sha256: sourceSha,
    })),
    {
      role: 'r10-lanzhou-intent',
      path: intentSource.path,
      sha256: intentSource.sha256,
    },
    {
      role: 'r10-lanzhou-adapter',
      path: adapterSource.path,
      sha256: adapterSource.sha256,
    },
    ...sfxFiles.flatMap((source) => [
      {
        role: 'runtime-sfx-file',
        path: source.publicPath,
        sha256: source.sha256,
      },
      {
        role: 'sfx-canonical-source',
        path: source.canonicalPath,
        sha256: source.canonicalSha256,
      },
    ]),
  ];

  const runtime = compileDirectorR10Timeline({
    schemaVersion: 1,
    timelineId: `${intent.intentId}-runtime`,
    videoId: intent.videoId,
    fps: intent.fps,
    durationFrames,
    policy: {maxReadableLeadMs: 300, maxSfxOffsetFrames: 2},
    sourceGraph,
    events: definitionEvents,
  });
  assertDirectorR10TimelineIntegrity(runtime);
  const b07 = runtime.events.find((event) => event.beatId === 'b07');
  if (
    !b07 ||
    Object.keys(b07.semanticBinding.namedAnchors).length !== 6 ||
    b07.actions.length !== 6 ||
    b07.endFrameExclusive - b07.actionEndFrame < 30
  ) {
    fail('R10_LANZHOU_B07_CONTRACT_INVALID', 'B07必须保持六段实录锚点、六动作与至少30帧完成态。');
  }
  const actualB07 = captions.filter((caption) => caption.beatId === 'B07');
  const legacyPostshootAudit = auditLegacyPostshoot({
    postshoot,
    actualB07,
    r10ActionCount: b07.actions.length,
  });
  const runtimeBytes = stablePrettyJson(runtime);
  const compilerBinding = bindingByRole(sourceBindings, 'r10-timeline-compiler');
  const governanceFiles = sourceBindings
    .filter((binding) => GOVERNANCE_ROLES.has(binding.role))
    .map(({role, path: sourcePath, sha256: sourceSha, application}) => {
      if (!application) {
        fail('R10_LANZHOU_GOVERNANCE_APPLICATION_MISSING', `${role}缺少对R10旁路的具体应用。`);
      }
      return {role, path: sourcePath, sha256: sourceSha, application};
    });
  const receipt = {
    schemaVersion: 'director-r10-lanzhou-compile-receipt/v1',
    intentId: intent.intentId,
    videoId: intent.videoId,
    status: 'compiled-sidecar-not-rendered',
    productionEligible: false,
    rendered: false,
    userDynamicAcceptanceRequired: true,
    localSourceOffsetFrame,
    sourceEndFrameExclusive,
    durationFrames,
    fps: intent.fps,
    runtime: {
      path: LANZHOU_R10_RUNTIME_PATH,
      sha256: sha256(runtimeBytes),
      timelineSha256: runtime.timelineSha256,
      sourceGraphSha: runtime.sourceGraphSha,
    },
    compiler: {
      path: compilerBinding.path,
      sha256: compilerBinding.sha256,
    },
    adapter: {
      path: adapterSource.path,
      sha256: adapterSource.sha256,
    },
    intent: {
      path: intentSource.path,
      sha256: intentSource.sha256,
      timingAuthority: 'caption-boundaries-plus-relative-frames-only',
    },
    sourceFiles: sourceBindings.map(({role, path: sourcePath, sha256: sourceSha}) => ({
      role,
      path: sourcePath,
      sha256: sourceSha,
    })),
    governanceFiles,
    sfxFiles,
    componentRegistryAudit: {
      path: bindingByRole(sourceBindings, 'r10-component-registry').path,
      sha256: bindingByRole(sourceBindings, 'r10-component-registry').sha256,
      lifecycleAnchorsPresent: true,
      paperStructureTargetValid,
      paperMotionProfileValid,
      publicDir,
      soundSourceContract,
    },
    styleAudit: {
      path: bindingByRole(sourceBindings, 'paper-style-candidate').path,
      sha256: bindingByRole(sourceBindings, 'paper-style-candidate').sha256,
      status: style.status,
      productionEligible: style.productionEligible,
      allowedEvidenceUse: style.scope?.allowedEvidenceUse,
    },
    recordedAuthorityAudit: {
      canonicalSource: actual.canonicalSource,
      actualStatus: actual.status,
      actualFormalAllowed: actual.formalAllowed,
      spokenStatus: spoken.status,
      spokenFormalAllowed: spoken.formalAllowed,
      scriptRole: spoken.scriptRole,
      humanListeningPerformed: spoken.humanListeningPerformed,
      userAudioReviewConfirmed: spoken.userAudioReviewConfirmed,
    },
    legacyPostshootAudit,
    limitations: [
      '当前仅完成旁路运行时时间轴编译，未渲染、未动态验收。',
      '实录双语字幕仍需用户听审，不得作为正式发布依据。',
      '旧P02和V9.1后拍计划只用于检出尾部压扁，其秒数不参与R10编译。',
    ],
  };
  const receiptBytes = stablePrettyJson(receipt);
  return {runtime, receipt, runtimeBytes, receiptBytes};
};

const checkGeneratedFile = ({projectRoot, relativePath, expectedBytes}) => {
  let actualBytes;
  try {
    actualBytes = readFileSync(path.join(projectRoot, relativePath), 'utf8');
  } catch (error) {
    fail('R10_LANZHOU_GENERATED_FILE_MISSING', `${relativePath}不存在，请先运行--write。`, {
      cause: error.message,
    });
  }
  if (actualBytes !== expectedBytes) {
    fail('R10_LANZHOU_GENERATED_FILE_DRIFT', `${relativePath}与当前来源编译结果不一致。`);
  }
};

export const runLanzhouR10BuilderCli = ({
  argv = process.argv.slice(2),
  projectRoot = path.resolve(import.meta.dirname, '..'),
} = {}) => {
  const mode = argv.length === 0 ? '--check' : argv[0];
  if (argv.length > 1 || !['--check', '--write'].includes(mode)) {
    fail('R10_LANZHOU_CLI_USAGE', '用法：node tools/build-director-r10-lanzhou-pilot.mjs [--check|--write]。');
  }
  const result = buildLanzhouR10Pilot({projectRoot});
  if (mode === '--write') {
    atomicallyWriteText(path.join(projectRoot, LANZHOU_R10_RUNTIME_PATH), result.runtimeBytes);
    atomicallyWriteText(
      path.join(projectRoot, LANZHOU_R10_COMPILE_RECEIPT_PATH),
      result.receiptBytes,
    );
    return {mode, status: 'written', ...result};
  }
  checkGeneratedFile({
    projectRoot,
    relativePath: LANZHOU_R10_RUNTIME_PATH,
    expectedBytes: result.runtimeBytes,
  });
  checkGeneratedFile({
    projectRoot,
    relativePath: LANZHOU_R10_COMPILE_RECEIPT_PATH,
    expectedBytes: result.receiptBytes,
  });
  return {mode, status: 'checked', ...result};
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runLanzhouR10BuilderCli();
    console.log(
      `${result.status}: ${LANZHOU_R10_RUNTIME_PATH} + ${LANZHOU_R10_COMPILE_RECEIPT_PATH}`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
