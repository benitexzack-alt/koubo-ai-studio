import {createHash} from 'node:crypto';

export const DIRECTOR_R10_TIMELINE_SCHEMA_VERSION = 1;

export const DIRECTOR_R10_DEFAULT_POLICY = Object.freeze({
  maxReadableLeadMs: 300,
  maxSfxOffsetFrames: 2,
});

export const DIRECTOR_R10_SFX_VOLUME_RANGE = Object.freeze({
  default: 0.3,
  min: 0.2,
  max: 0.55,
});

const SEMANTIC_REFS = Object.freeze([
  'spokenStart',
  'claim',
  'emphasis',
  'spokenEnd',
]);
const VISUAL_ANCHORS = Object.freeze([
  'firstVisible',
  'firstReadable',
  'semanticSettle',
  'actionEnd',
]);
const EVENT_FORBIDDEN_TIMING_KEYS = new Set([
  'startSeconds',
  'endSeconds',
  'enterAt',
  'startFrame',
  'endFrame',
  'endFrameExclusive',
  'firstVisibleFrame',
  'firstReadableFrame',
  'semanticSettleFrame',
  'actionEndFrame',
  'timeSeconds',
  'durationSeconds',
  'previewCoverage',
]);
const PREVIEW_FORBIDDEN_CLAIM_KEYS = new Set([
  'previewCoverage',
  'coveredCategories',
  'coveredEventIds',
  'coveredSfxRoles',
  'coverage',
]);
const SFX_ABSOLUTE_TIMING_KEYS = new Set([
  'frame',
  'startFrame',
  'endFrame',
  'time',
  'seconds',
  'startSeconds',
  'endSeconds',
  'enterAt',
]);
const ACTION_SOUND_ANCHORS = Object.freeze([
  'start',
  'end',
  ...VISUAL_ANCHORS,
]);

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isInteger = (value) => Number.isInteger(value);
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const sortedUniqueText = (values, label) => {
  if (!Array.isArray(values)) {
    throwR10('R10_TEXT_LIST_INVALID', `${label}必须是字符串数组。`);
  }
  const normalized = values.map((value) => {
    if (!isText(value)) {
      throwR10('R10_TEXT_LIST_INVALID', `${label}只能包含非空字符串。`);
    }
    return value.trim();
  });
  return [...new Set(normalized)].sort(compareText);
};

export class DirectorR10TimelineError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}:${message}`);
    this.name = 'DirectorR10TimelineError';
    this.code = code;
    this.details = details;
  }
}

const throwR10 = (code, message, details) => {
  throw new DirectorR10TimelineError(code, message, details);
};

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareText)
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
};

export const stableJsonStringify = (value) => JSON.stringify(stableValue(value));

export const stableJsonSha256 = (value) =>
  createHash('sha256').update(stableJsonStringify(value)).digest('hex');

const findForbiddenKey = (value, forbiddenKeys, trail = '$') => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = findForbiddenKey(value[index], forbiddenKeys, `${trail}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) return {key, path: `${trail}.${key}`};
    const hit = findForbiddenKey(nested, forbiddenKeys, `${trail}.${key}`);
    if (hit) return hit;
  }
  return null;
};

const normalizeSourceGraph = (sourceGraph) => {
  if (!Array.isArray(sourceGraph) || sourceGraph.length === 0) {
    throwR10('R10_SOURCE_GRAPH_INVALID', 'sourceGraph必须至少绑定一个来源。');
  }
  const normalized = sourceGraph.map((source, index) => {
    if (!isRecord(source)) {
      throwR10('R10_SOURCE_GRAPH_INVALID', `sourceGraph[${index}]必须是对象。`);
    }
    const role = String(source.role ?? '').trim();
    const path = String(source.path ?? '').trim();
    const sha256 = String(source.sha256 ?? '').trim().toLowerCase();
    if (!role || !path || !/^[a-f0-9]{64}$/u.test(sha256)) {
      throwR10(
        'R10_SOURCE_GRAPH_INVALID',
        `sourceGraph[${index}]必须包含role、path和64位SHA-256。`,
      );
    }
    return {role, path, sha256};
  });
  normalized.sort(
    (left, right) =>
      compareText(left.role, right.role) || compareText(left.path, right.path),
  );
  const identities = normalized.map((source) => `${source.role}\u0000${source.path}`);
  if (new Set(identities).size !== identities.length) {
    throwR10('R10_SOURCE_GRAPH_DUPLICATE', 'sourceGraph中存在重复的role与path绑定。');
  }
  return normalized;
};

const normalizePolicy = (policy, fps) => {
  if (policy != null && !isRecord(policy)) {
    throwR10('R10_POLICY_INVALID', 'policy必须是对象。');
  }
  const maxReadableLeadMs =
    policy?.maxReadableLeadMs ?? DIRECTOR_R10_DEFAULT_POLICY.maxReadableLeadMs;
  const maxSfxOffsetFrames =
    policy?.maxSfxOffsetFrames ?? DIRECTOR_R10_DEFAULT_POLICY.maxSfxOffsetFrames;
  if (
    typeof maxReadableLeadMs !== 'number' ||
    !Number.isFinite(maxReadableLeadMs) ||
    maxReadableLeadMs < 0 ||
    !isInteger(maxSfxOffsetFrames) ||
    maxSfxOffsetFrames < 0
  ) {
    throwR10('R10_POLICY_INVALID', '语义提前毫秒数与音效偏移帧数必须为非负数。');
  }
  if (
    maxReadableLeadMs > DIRECTOR_R10_DEFAULT_POLICY.maxReadableLeadMs ||
    maxSfxOffsetFrames > DIRECTOR_R10_DEFAULT_POLICY.maxSfxOffsetFrames
  ) {
    throwR10(
      'R10_POLICY_HARD_LIMIT_EXCEEDED',
      `R10硬上限为可读语义最多提前${DIRECTOR_R10_DEFAULT_POLICY.maxReadableLeadMs}毫秒、音效最多偏移${DIRECTOR_R10_DEFAULT_POLICY.maxSfxOffsetFrames}帧，不得由任务定义放宽。`,
    );
  }
  return {
    maxReadableLeadMs,
    maxReadableLeadFrames: Math.floor((fps * maxReadableLeadMs) / 1000),
    maxSfxOffsetFrames,
  };
};

const normalizeSemanticBinding = (binding, eventId) => {
  if (!isRecord(binding)) {
    throwR10('R10_SEMANTIC_BINDING_INVALID', `事件${eventId}缺少semanticBinding。`);
  }
  const frameFields = [
    'spokenStartFrame',
    'claimFrame',
    'emphasisFrame',
    'spokenEndFrame',
  ];
  for (const field of frameFields) {
    if (!isInteger(binding[field]) || binding[field] < 0) {
      throwR10(
        'R10_SEMANTIC_BINDING_INVALID',
        `事件${eventId}的${field}必须是非负整数帧。`,
      );
    }
  }
  if (
    binding.spokenStartFrame > binding.claimFrame ||
    binding.claimFrame > binding.spokenEndFrame ||
    binding.spokenStartFrame > binding.emphasisFrame ||
    binding.emphasisFrame > binding.spokenEndFrame
  ) {
    throwR10(
      'R10_SEMANTIC_BINDING_ORDER_INVALID',
      `事件${eventId}的语音锚点顺序不合法。`,
    );
  }
  const wordIds = sortedUniqueText(binding.wordIds ?? [], `事件${eventId}.wordIds`);
  const captionIds = sortedUniqueText(
    binding.captionIds ?? [],
    `事件${eventId}.captionIds`,
  );
  if (wordIds.length === 0 && captionIds.length === 0) {
    throwR10(
      'R10_SEMANTIC_EVIDENCE_REQUIRED',
      `事件${eventId}必须绑定至少一个实录wordId或captionId。`,
    );
  }
  const rawNamedAnchors = binding.namedAnchors ?? {};
  if (!isRecord(rawNamedAnchors)) {
    throwR10(
      'R10_NAMED_ANCHOR_INVALID',
      `事件${eventId}的namedAnchors必须是以稳定名称为键的对象。`,
    );
  }
  const namedAnchors = Object.fromEntries(
    Object.entries(rawNamedAnchors)
      .sort(([left], [right]) => compareText(left, right))
      .map(([name, anchor]) => {
        if (!/^[a-z][a-z0-9-]*$/u.test(name) || SEMANTIC_REFS.includes(name)) {
          throwR10(
            'R10_NAMED_ANCHOR_NAME_INVALID',
            `事件${eventId}的命名锚点“${name}”必须使用稳定小写英文ID，且不得覆盖内置语义锚点。`,
          );
        }
        if (!isRecord(anchor) || !isInteger(anchor.frame)) {
          throwR10(
            'R10_NAMED_ANCHOR_INVALID',
            `事件${eventId}的命名锚点“${name}”必须包含整数frame。`,
          );
        }
        if (
          anchor.frame < binding.spokenStartFrame ||
          anchor.frame > binding.spokenEndFrame
        ) {
          throwR10(
            'R10_NAMED_ANCHOR_RANGE_INVALID',
            `事件${eventId}的命名锚点“${name}”必须落在实录语音范围内。`,
          );
        }
        const anchorWordIds = sortedUniqueText(
          anchor.wordIds ?? [],
          `事件${eventId}.namedAnchors.${name}.wordIds`,
        );
        const anchorCaptionIds = sortedUniqueText(
          anchor.captionIds ?? [],
          `事件${eventId}.namedAnchors.${name}.captionIds`,
        );
        if (anchorWordIds.length === 0 && anchorCaptionIds.length === 0) {
          throwR10(
            'R10_NAMED_ANCHOR_EVIDENCE_REQUIRED',
            `事件${eventId}的命名锚点“${name}”必须绑定实录wordId或captionId。`,
          );
        }
        const timingPrecision = String(anchor.timingPrecision ?? '').trim();
        if (!timingPrecision) {
          throwR10(
            'R10_NAMED_ANCHOR_PRECISION_REQUIRED',
            `事件${eventId}的命名锚点“${name}”必须记录timingPrecision。`,
          );
        }
        return [
          name,
          {
            frame: anchor.frame,
            wordIds: anchorWordIds,
            captionIds: anchorCaptionIds,
            timingPrecision,
          },
        ];
      }),
  );
  return {
    spokenStartFrame: binding.spokenStartFrame,
    claimFrame: binding.claimFrame,
    emphasisFrame: binding.emphasisFrame,
    spokenEndFrame: binding.spokenEndFrame,
    wordIds,
    captionIds,
    namedAnchors,
  };
};

const semanticAnchorsFor = (binding) => {
  const builtInAnchor = (frame) => ({
    frame,
    sourceEvidence: {
      sourceType: 'semantic-binding',
      anchorFrame: frame,
      wordIds: binding.wordIds,
      captionIds: binding.captionIds,
      timingPrecision: 'event-semantic-binding',
    },
  });
  const anchors = {
    spokenStart: builtInAnchor(binding.spokenStartFrame),
    claim: builtInAnchor(binding.claimFrame),
    emphasis: builtInAnchor(binding.emphasisFrame),
    spokenEnd: builtInAnchor(binding.spokenEndFrame),
  };
  for (const [name, anchor] of Object.entries(binding.namedAnchors)) {
    anchors[name] = {
      frame: anchor.frame,
      sourceEvidence: {
        sourceType: 'named-recorded-anchor',
        anchorFrame: anchor.frame,
        wordIds: anchor.wordIds,
        captionIds: anchor.captionIds,
        timingPrecision: anchor.timingPrecision,
      },
    };
  }
  return anchors;
};

const resolveRelativeAnchor = (descriptor, semanticAnchors, label) => {
  if (!isRecord(descriptor)) {
    throwR10('R10_RELATIVE_ANCHOR_INVALID', `${label}必须使用相对语义锚点。`);
  }
  const ref = String(descriptor.ref ?? '');
  const offsetFrames = descriptor.offsetFrames ?? 0;
  if (!Object.hasOwn(semanticAnchors, ref) || !isInteger(offsetFrames)) {
    throwR10(
      'R10_RELATIVE_ANCHOR_INVALID',
      `${label}必须绑定内置或命名实录语义锚点，并使用整数offsetFrames。`,
    );
  }
  return {
    binding: {
      ref,
      offsetFrames,
      sourceEvidence: semanticAnchors[ref].sourceEvidence,
    },
    frame: semanticAnchors[ref].frame + offsetFrames,
  };
};

const normalizeSfxVolume = (volume, label) => {
  const normalized = volume ?? DIRECTOR_R10_SFX_VOLUME_RANGE.default;
  if (
    typeof normalized !== 'number' ||
    !Number.isFinite(normalized) ||
    normalized < DIRECTOR_R10_SFX_VOLUME_RANGE.min ||
    normalized > DIRECTOR_R10_SFX_VOLUME_RANGE.max
  ) {
    throwR10(
      'R10_SFX_VOLUME_INVALID',
      `${label}.volume必须是${DIRECTOR_R10_SFX_VOLUME_RANGE.min}至${DIRECTOR_R10_SFX_VOLUME_RANGE.max}之间的有限数字。`,
    );
  }
  return normalized;
};

const normalizeSound = ({sound, anchors, policy, eventId}) => {
  if (sound == null) return null;
  if (!isRecord(sound)) {
    throwR10('R10_SFX_BINDING_INVALID', `事件${eventId}的sound必须是对象。`);
  }
  if (Object.hasOwn(sound, 'previewRequired')) {
    throwR10(
      'R10_SFX_PREVIEW_OPTOUT_FORBIDDEN',
      `事件${eventId}的已有音效不得自行退出试听覆盖。`,
    );
  }
  const absoluteHit = findForbiddenKey(sound, SFX_ABSOLUTE_TIMING_KEYS, '$.sound');
  if (absoluteHit) {
    throwR10(
      'R10_SFX_ABSOLUTE_TIMING_FORBIDDEN',
      `事件${eventId}的音效不得手填绝对时间：${absoluteHit.path}。`,
    );
  }
  const bindTo = String(sound.bindTo ?? '');
  const offsetFrames = sound.offsetFrames ?? 0;
  if (!VISUAL_ANCHORS.includes(bindTo) || !isInteger(offsetFrames)) {
    throwR10(
      'R10_SFX_BINDING_INVALID',
      `事件${eventId}的音效必须绑定已解析的视觉语义锚点。`,
    );
  }
  if (Math.abs(offsetFrames) > policy.maxSfxOffsetFrames) {
    throwR10(
      'R10_SFX_OFFSET_EXCEEDED',
      `事件${eventId}的音效偏移${offsetFrames}帧，超过上限${policy.maxSfxOffsetFrames}帧。`,
    );
  }
  const role = String(sound.role ?? '').trim();
  const source = String(sound.source ?? '').trim();
  if (!role || !source) {
    throwR10('R10_SFX_BINDING_INVALID', `事件${eventId}的音效必须包含role与source。`);
  }
  const frame = anchors[bindTo] + offsetFrames;
  if (frame < anchors.firstVisible || frame >= anchors.endExclusive) {
    throwR10('R10_SFX_RANGE_INVALID', `事件${eventId}的音效帧超出视觉事件范围。`);
  }
  return {
    role,
    source,
    volume: normalizeSfxVolume(sound.volume, `事件${eventId}.sound`),
    bindTo,
    offsetFrames,
    frame,
  };
};

const normalizeActionSound = ({
  sound,
  actionAnchors,
  visualAnchors,
  policy,
  eventId,
  actionId,
}) => {
  if (sound == null) return null;
  if (!isRecord(sound)) {
    throwR10(
      'R10_ACTION_SFX_BINDING_INVALID',
      `事件${eventId}动作${actionId}的sound必须是对象。`,
    );
  }
  if (Object.hasOwn(sound, 'previewRequired')) {
    throwR10(
      'R10_SFX_PREVIEW_OPTOUT_FORBIDDEN',
      `事件${eventId}动作${actionId}的已有音效不得自行退出试听覆盖。`,
    );
  }
  const absoluteHit = findForbiddenKey(
    sound,
    SFX_ABSOLUTE_TIMING_KEYS,
    `$.events.${eventId}.actions.${actionId}.sound`,
  );
  if (absoluteHit) {
    throwR10(
      'R10_SFX_ABSOLUTE_TIMING_FORBIDDEN',
      `事件${eventId}动作${actionId}的音效不得手填绝对时间：${absoluteHit.path}。`,
    );
  }
  const bindTo = String(sound.bindTo ?? '');
  const offsetFrames = sound.offsetFrames ?? 0;
  if (!ACTION_SOUND_ANCHORS.includes(bindTo) || !isInteger(offsetFrames)) {
    throwR10(
      'R10_ACTION_SFX_BINDING_INVALID',
      `事件${eventId}动作${actionId}的音效必须绑定动作start/end或视觉语义锚点。`,
    );
  }
  if (Math.abs(offsetFrames) > policy.maxSfxOffsetFrames) {
    throwR10(
      'R10_SFX_OFFSET_EXCEEDED',
      `事件${eventId}动作${actionId}的音效偏移${offsetFrames}帧，超过上限${policy.maxSfxOffsetFrames}帧。`,
    );
  }
  const role = String(sound.role ?? '').trim();
  const source = String(sound.source ?? '').trim();
  if (!role || !source) {
    throwR10(
      'R10_ACTION_SFX_BINDING_INVALID',
      `事件${eventId}动作${actionId}的音效必须包含role与source。`,
    );
  }
  const anchorFrame =
    bindTo === 'start'
      ? actionAnchors.start
      : bindTo === 'end'
        ? actionAnchors.endExclusive - 1
        : visualAnchors[bindTo];
  const frame = anchorFrame + offsetFrames;
  if (frame < actionAnchors.start || frame >= actionAnchors.endExclusive) {
    throwR10(
      'R10_ACTION_SFX_RANGE_INVALID',
      `事件${eventId}动作${actionId}的音效帧必须落在本动作范围内。`,
    );
  }
  return {
    role,
    source,
    volume: normalizeSfxVolume(
      sound.volume,
      `事件${eventId}.动作${actionId}.sound`,
    ),
    bindTo,
    offsetFrames,
    frame,
  };
};

const compileActions = ({
  actions,
  semanticAnchors,
  visualAnchors,
  policy,
  eventId,
  eventPreviewRequired,
  category,
}) => {
  if (actions == null) return [];
  if (!Array.isArray(actions)) {
    throwR10('R10_ACTION_INVALID', `事件${eventId}的actions必须是数组。`);
  }
  const paperActionSoundRequired =
    category === 'paper-editorial' && actions.length > 0;
  const compiledActions = actions.map((action, index) => {
    if (!isRecord(action)) {
      throwR10('R10_ACTION_INVALID', `事件${eventId}的actions[${index}]必须是对象。`);
    }
    const actionId = String(action.id ?? '').trim();
    if (!/^[a-z][a-z0-9-]*$/u.test(actionId)) {
      throwR10(
        'R10_ACTION_INVALID',
        `事件${eventId}的每个动作必须有稳定小写英文id。`,
      );
    }
    const absoluteSfxHit = findForbiddenKey(
      action.sound,
      SFX_ABSOLUTE_TIMING_KEYS,
      `$.events.${eventId}.actions.${actionId}.sound`,
    );
    if (absoluteSfxHit) {
      throwR10(
        'R10_SFX_ABSOLUTE_TIMING_FORBIDDEN',
        `事件${eventId}动作${actionId}的音效不得手填绝对时间：${absoluteSfxHit.path}。`,
      );
    }
    const forbiddenHit = findForbiddenKey(
      action,
      EVENT_FORBIDDEN_TIMING_KEYS,
      `$.events.${eventId}.actions.${actionId}`,
    );
    if (forbiddenHit) {
      throwR10(
        'R10_FORBIDDEN_AUTHORED_TIMING',
        `事件${eventId}动作${actionId}不得手填${forbiddenHit.key}。`,
      );
    }
    if (!isRecord(action.timing)) {
      throwR10('R10_ACTION_TIMING_INVALID', `事件${eventId}动作${actionId}缺少timing。`);
    }
    const start = resolveRelativeAnchor(
      action.timing.start,
      semanticAnchors,
      `事件${eventId}.actions.${actionId}.timing.start`,
    );
    const endExclusive = resolveRelativeAnchor(
      action.timing.endExclusive,
      semanticAnchors,
      `事件${eventId}.actions.${actionId}.timing.endExclusive`,
    );
    if (start.frame >= endExclusive.frame) {
      throwR10(
        'R10_ACTION_ORDER_INVALID',
        `事件${eventId}动作${actionId}必须满足start<endExclusive。`,
      );
    }
    if (
      start.frame < visualAnchors.firstVisible ||
      endExclusive.frame > visualAnchors.actionEnd + 1 ||
      endExclusive.frame > visualAnchors.endExclusive
    ) {
      throwR10(
        'R10_ACTION_RANGE_INVALID',
        `事件${eventId}动作${actionId}必须完整落在事件活动范围内。`,
      );
    }
    const soundRequired = paperActionSoundRequired || action.soundRequired === true;
    if (soundRequired && action.sound == null) {
      throwR10(
        'R10_ACTION_SOUND_REQUIRED',
        `事件${eventId}动作${actionId}声明了soundRequired，但没有独立动作音效。`,
      );
    }
    const actionAnchors = {
      start: start.frame,
      endExclusive: endExclusive.frame,
    };
    return {
      id: actionId,
      previewRequired: eventPreviewRequired,
      soundRequired,
      timingBindings: {
        start: start.binding,
        endExclusive: endExclusive.binding,
      },
      startFrame: start.frame,
      endFrameExclusive: endExclusive.frame,
      sound: normalizeActionSound({
        sound: action.sound,
        actionAnchors,
        visualAnchors,
        policy,
        eventId,
        actionId,
      }),
    };
  });
  compiledActions.sort(
    (left, right) => left.startFrame - right.startFrame || compareText(left.id, right.id),
  );
  const actionIds = compiledActions.map((action) => action.id);
  if (new Set(actionIds).size !== actionIds.length) {
    throwR10('R10_ACTION_ID_DUPLICATE', `事件${eventId}的动作id不得重复。`);
  }
  for (let index = 1; index < compiledActions.length; index += 1) {
    const previous = compiledActions[index - 1];
    const current = compiledActions[index];
    if (current.startFrame < previous.endFrameExclusive) {
      throwR10(
        'R10_ACTION_ORDER_INVALID',
        `事件${eventId}的动作${previous.id}与${current.id}发生重叠。`,
      );
    }
  }
  return compiledActions;
};

const compileEvent = ({event, fps, durationFrames, policy}) => {
  if (!isRecord(event)) {
    throwR10('R10_EVENT_INVALID', 'events只能包含对象。');
  }
  const eventId = String(event.id ?? '').trim();
  const beatId = String(event.beatId ?? '').trim();
  const category = String(event.category ?? '').trim();
  if (!/^[a-z][a-z0-9-]*$/u.test(eventId)) {
    throwR10('R10_EVENT_ID_INVALID', '每个事件id必须是稳定的小写英文ID。');
  }
  if (!/^[a-z][a-z0-9-]*$/u.test(beatId)) {
    throwR10('R10_BEAT_ID_INVALID', `事件${eventId}的beatId必须是稳定的小写英文ID。`);
  }
  if (!category) {
    throwR10('R10_EVENT_INVALID', `事件${eventId}必须包含category。`);
  }
  if (Object.hasOwn(event, 'previewRequired') && event.previewRequired !== true) {
    throwR10(
      'R10_PREVIEW_OPTOUT_FORBIDDEN',
      `事件${eventId}不得退出R10真实动态预览。`,
    );
  }

  const absoluteSfxHit = findForbiddenKey(
    event.sound,
    SFX_ABSOLUTE_TIMING_KEYS,
    `$.events.${eventId}.sound`,
  );
  if (absoluteSfxHit) {
    throwR10(
      'R10_SFX_ABSOLUTE_TIMING_FORBIDDEN',
      `事件${eventId}的音效不得手填绝对时间：${absoluteSfxHit.path}。`,
    );
  }
  for (const key of [
    'start',
    'end',
    'from',
    'to',
    'frame',
    'durationFrames',
    'durationInFrames',
  ]) {
    if (Object.hasOwn(event, key) || Object.hasOwn(event.visual ?? {}, key)) {
      throwR10(
        'R10_FORBIDDEN_AUTHORED_TIMING',
        `事件${eventId}不得使用旧式绝对时间字段${key}。`,
      );
    }
  }
  const forbiddenHit = findForbiddenKey(
    event,
    EVENT_FORBIDDEN_TIMING_KEYS,
    `$.events.${eventId}`,
  );
  if (forbiddenHit) {
    throwR10(
      'R10_FORBIDDEN_AUTHORED_TIMING',
      `事件${eventId}不得手填${forbiddenHit.key}：${forbiddenHit.path}。`,
    );
  }

  const semanticBinding = normalizeSemanticBinding(event.semanticBinding, eventId);
  const semanticAnchors = semanticAnchorsFor(semanticBinding);
  if (!isRecord(event.visual) || !isText(event.visual.component)) {
    throwR10('R10_VISUAL_INVALID', `事件${eventId}缺少visual.component。`);
  }
  const timing = event.visual.timing;
  if (!isRecord(timing)) {
    throwR10('R10_RELATIVE_ANCHOR_INVALID', `事件${eventId}缺少visual.timing。`);
  }
  const resolved = {};
  const timingBindings = {};
  for (const anchor of [...VISUAL_ANCHORS, 'endExclusive']) {
    const result = resolveRelativeAnchor(
      timing[anchor],
      semanticAnchors,
      `事件${eventId}.visual.timing.${anchor}`,
    );
    resolved[anchor] = result.frame;
    timingBindings[anchor] = result.binding;
  }

  if (
    !(
      resolved.firstVisible <= resolved.firstReadable &&
      resolved.firstReadable <= resolved.semanticSettle &&
      resolved.semanticSettle <= resolved.actionEnd &&
      resolved.actionEnd < resolved.endExclusive
    )
  ) {
    throwR10(
      'R10_TIMING_ORDER_INVALID',
      `事件${eventId}必须满足firstVisible<=firstReadable<=semanticSettle<=actionEnd<endExclusive。`,
      {resolved},
    );
  }
  if (resolved.firstVisible < 0 || resolved.endExclusive > durationFrames) {
    throwR10('R10_EVENT_RANGE_INVALID', `事件${eventId}超出成片帧范围。`, {resolved});
  }
  const readableLeadFrames = Math.max(
    0,
    semanticBinding.claimFrame - resolved.firstReadable,
  );
  if (readableLeadFrames > policy.maxReadableLeadFrames) {
    throwR10(
      'R10_READABLE_LEAD_EXCEEDED',
      `事件${eventId}的可读语义提前${readableLeadFrames}帧，超过${policy.maxReadableLeadFrames}帧。`,
    );
  }

  const anchors = {
    firstVisible: resolved.firstVisible,
    firstReadable: resolved.firstReadable,
    semanticSettle: resolved.semanticSettle,
    actionEnd: resolved.actionEnd,
    endExclusive: resolved.endExclusive,
  };
  const eventPreviewRequired = true;
  const actions = compileActions({
    actions: event.actions,
    semanticAnchors,
    visualAnchors: anchors,
    policy,
    eventId,
    eventPreviewRequired,
    category,
  });
  const sound = normalizeSound({sound: event.sound, anchors, policy, eventId});
  return {
    id: eventId,
    beatId,
    category,
    previewRequired: eventPreviewRequired,
    semanticBinding,
    component: event.visual.component.trim(),
    props: stableValue(event.visual.props ?? {}),
    timingBindings,
    firstVisibleFrame: resolved.firstVisible,
    firstReadableFrame: resolved.firstReadable,
    semanticSettleFrame: resolved.semanticSettle,
    actionEndFrame: resolved.actionEnd,
    endFrameExclusive: resolved.endExclusive,
    readableLeadFrames,
    sound,
    actions,
  };
};

const flattenSoundCues = (events) => {
  const cues = [];
  for (const event of events) {
    if (event.sound) {
      cues.push({
        id: `${event.id}:event`,
        eventId: event.id,
        actionId: null,
        frame: event.sound.frame,
        role: event.sound.role,
        source: event.sound.source,
        volume: event.sound.volume,
        bindTo: event.sound.bindTo,
        offsetFrames: event.sound.offsetFrames,
        previewRequired:
          event.previewRequired,
        previewStartFrame: event.firstVisibleFrame,
        previewEndFrameExclusive: event.actionEndFrame + 1,
      });
    }
    for (const action of event.actions) {
      if (!action.sound) continue;
      cues.push({
        id: `${event.id}:${action.id}`,
        eventId: event.id,
        actionId: action.id,
        frame: action.sound.frame,
        role: action.sound.role,
        source: action.sound.source,
        volume: action.sound.volume,
        bindTo: action.sound.bindTo,
        offsetFrames: action.sound.offsetFrames,
        previewRequired:
          action.previewRequired,
        previewStartFrame: action.startFrame,
        previewEndFrameExclusive: action.endFrameExclusive,
      });
    }
  }
  cues.sort(
    (left, right) =>
      left.frame - right.frame ||
      compareText(left.eventId, right.eventId) ||
      compareText(left.actionId ?? '', right.actionId ?? ''),
  );
  return cues;
};

export const compileDirectorR10Timeline = (definition) => {
  if (!isRecord(definition)) {
    throwR10('R10_DEFINITION_INVALID', 'R10时间轴定义必须是对象。');
  }
  if (Object.hasOwn(definition, 'previewCoverage')) {
    throwR10('R10_FORBIDDEN_PREVIEW_CLAIM', '不得在时间轴定义中手填previewCoverage。');
  }
  if (definition.schemaVersion !== DIRECTOR_R10_TIMELINE_SCHEMA_VERSION) {
    throwR10('R10_SCHEMA_INVALID', 'R10时间轴定义schemaVersion必须为1。');
  }
  const timelineId = String(definition.timelineId ?? '').trim();
  const videoId = String(definition.videoId ?? '').trim();
  const fps = definition.fps;
  const durationFrames = definition.durationFrames;
  if (!timelineId || !videoId || !isInteger(fps) || fps <= 0) {
    throwR10('R10_DEFINITION_INVALID', 'timelineId、videoId和正整数fps均为必填。');
  }
  if (!isInteger(durationFrames) || durationFrames <= 0) {
    throwR10('R10_DEFINITION_INVALID', 'durationFrames必须是正整数。');
  }
  if (!Array.isArray(definition.events) || definition.events.length === 0) {
    throwR10('R10_DEFINITION_INVALID', 'events必须至少包含一个语义事件。');
  }

  const sourceGraph = normalizeSourceGraph(definition.sourceGraph);
  const sourceGraphSha256 = stableJsonSha256(sourceGraph);
  const policy = normalizePolicy(definition.policy, fps);
  const events = definition.events.map((event) =>
    compileEvent({event, fps, durationFrames, policy}),
  );
  events.sort(
    (left, right) =>
      left.firstVisibleFrame - right.firstVisibleFrame || compareText(left.id, right.id),
  );
  const eventIds = events.map((event) => event.id);
  if (new Set(eventIds).size !== eventIds.length) {
    throwR10('R10_EVENT_ID_DUPLICATE', '事件id不得重复。');
  }

  const runtimeTimeline = {
    schemaVersion: DIRECTOR_R10_TIMELINE_SCHEMA_VERSION,
    compiler: 'director-r10-timeline-core/v1',
    timelineId,
    videoId,
    fps,
    durationFrames,
    policy,
    sourceGraph,
    sourceGraphSha: sourceGraphSha256,
    sourceGraphSha256,
    events,
    soundCues: flattenSoundCues(events),
  };
  return {
    ...runtimeTimeline,
    timelineSha256: stableJsonSha256(runtimeTimeline),
  };
};

export const assertDirectorR10TimelineIntegrity = (timeline) => {
  if (!isRecord(timeline) || !isText(timeline.timelineSha256)) {
    throwR10(
      'R10_RUNTIME_TIMELINE_INVALID',
      'timeline必须包含编译器生成的timelineSha256。',
    );
  }
  const {timelineSha256, ...runtimeTimeline} = timeline;
  const expectedTimelineSha256 = stableJsonSha256(runtimeTimeline);
  if (timelineSha256 !== expectedTimelineSha256) {
    throwR10(
      'R10_TIMELINE_SHA_MISMATCH',
      '运行时时间轴内容已改变，必须从来源图重新编译。',
      {expectedTimelineSha256, actualTimelineSha256: timelineSha256},
    );
  }
  const expectedSourceGraphSha256 = stableJsonSha256(timeline.sourceGraph);
  if (
    timeline.sourceGraphSha !== expectedSourceGraphSha256 ||
    timeline.sourceGraphSha256 !== expectedSourceGraphSha256
  ) {
    throwR10(
      'R10_SOURCE_GRAPH_SHA_MISMATCH',
      '运行时时间轴的来源图哈希与实际来源绑定不一致。',
    );
  }
  return {
    ok: true,
    timelineSha256,
    sourceGraphSha: expectedSourceGraphSha256,
  };
};

const normalizePreviewRanges = (previewRanges, durationFrames) => {
  if (!Array.isArray(previewRanges)) {
    throwR10('R10_PREVIEW_RANGE_INVALID', 'previewRanges必须是数组。');
  }
  const claimHit = findForbiddenKey(
    previewRanges,
    PREVIEW_FORBIDDEN_CLAIM_KEYS,
    '$.previewRanges',
  );
  if (claimHit) {
    throwR10(
      'R10_FORBIDDEN_PREVIEW_CLAIM',
      `预览范围不得手填覆盖结论：${claimHit.path}。`,
    );
  }
  const normalized = previewRanges.map((range, index) => {
    if (!isRecord(range)) {
      throwR10('R10_PREVIEW_RANGE_INVALID', `previewRanges[${index}]必须是对象。`);
    }
    const id = String(range.id ?? '').trim();
    if (
      !id ||
      !isInteger(range.startFrame) ||
      !isInteger(range.endFrameExclusive) ||
      range.startFrame < 0 ||
      range.startFrame >= range.endFrameExclusive ||
      range.endFrameExclusive > durationFrames ||
      typeof range.withSfx !== 'boolean'
    ) {
      throwR10(
        'R10_PREVIEW_RANGE_INVALID',
        `previewRanges[${index}]必须包含合法id、帧范围与withSfx布尔值。`,
      );
    }
    return {
      id,
      startFrame: range.startFrame,
      endFrameExclusive: range.endFrameExclusive,
      withSfx: range.withSfx,
    };
  });
  normalized.sort(
    (left, right) =>
      left.startFrame - right.startFrame ||
      left.endFrameExclusive - right.endFrameExclusive ||
      compareText(left.id, right.id),
  );
  if (new Set(normalized.map((range) => range.id)).size !== normalized.length) {
    throwR10('R10_PREVIEW_RANGE_INVALID', 'previewRanges的id不得重复。');
  }
  return normalized;
};

const rangeContainsEvent = (range, event) =>
  range.startFrame <= event.firstVisibleFrame &&
  range.endFrameExclusive > event.actionEndFrame;

export const evaluateDirectorR10PreviewCoverage = ({
  timeline,
  previewRanges,
  requiredCategories = [],
}) => {
  if (!isRecord(timeline) || !Array.isArray(timeline.events)) {
    throwR10('R10_RUNTIME_TIMELINE_INVALID', 'timeline必须是已编译的R10运行时时间轴。');
  }
  assertDirectorR10TimelineIntegrity(timeline);
  if (!Array.isArray(requiredCategories)) {
    throwR10('R10_TEXT_LIST_INVALID', 'requiredCategories必须是字符串数组。');
  }
  const ranges = normalizePreviewRanges(previewRanges, timeline.durationFrames);
  const previewRequiredEvents = timeline.events.filter(
    (event) => event.previewRequired !== false,
  );
  const normalizedRequiredCategories = sortedUniqueText(
    [
      ...requiredCategories,
      ...previewRequiredEvents.map((event) => event.category),
    ],
    'requiredCategories',
  );
  const coveredEventIds = previewRequiredEvents
    .filter((event) => ranges.some((range) => rangeContainsEvent(range, event)))
    .map((event) => event.id)
    .sort(compareText);
  const coveredEventIdSet = new Set(coveredEventIds);
  const coveredCategories = [...new Set(
    previewRequiredEvents
      .filter((event) => coveredEventIdSet.has(event.id))
      .map((event) => event.category),
  )].sort(compareText);
  const coveredCategorySet = new Set(coveredCategories);
  const missingCategories = normalizedRequiredCategories.filter(
    (category) => !coveredCategorySet.has(category),
  );
  const requiredEventIds = previewRequiredEvents
    .map((event) => event.id)
    .sort(compareText);
  const missingEventIds = requiredEventIds.filter((id) => !coveredEventIdSet.has(id));

  if (!Array.isArray(timeline.soundCues)) {
    throwR10(
      'R10_RUNTIME_TIMELINE_INVALID',
      'timeline缺少由编译器生成的soundCues审计表。',
    );
  }
  const requiredSfxCues = timeline.soundCues.filter(
    (cue) => cue.previewRequired !== false,
  );
  const requiredSfxCueIds = requiredSfxCues.map((cue) => cue.id).sort(compareText);
  const coveredSfxCueIds = requiredSfxCues
    .filter((cue) =>
      ranges.some(
        (range) =>
          range.withSfx &&
          range.startFrame <= cue.previewStartFrame &&
          range.endFrameExclusive >= cue.previewEndFrameExclusive &&
          cue.frame >= range.startFrame &&
          cue.frame < range.endFrameExclusive,
      ),
    )
    .map((cue) => cue.id)
    .sort(compareText);
  const coveredSfxCueIdSet = new Set(coveredSfxCueIds);
  const missingSfxCueIds = requiredSfxCueIds.filter(
    (id) => !coveredSfxCueIdSet.has(id),
  );
  const requiredSfxRoles = [...new Set(requiredSfxCues.map((cue) => cue.role))]
    .sort(compareText);
  const coveredSfxRoles = [...new Set(
    requiredSfxCues
      .filter((cue) => coveredSfxCueIdSet.has(cue.id))
      .map((cue) => cue.role),
  )].sort(compareText);
  const coveredSfxRoleSet = new Set(coveredSfxRoles);
  const missingSfxRoles = requiredSfxRoles.filter(
    (role) => !coveredSfxRoleSet.has(role),
  );
  const eventsWithSound = new Set(
    requiredSfxCues.map((cue) => cue.eventId),
  );
  const requiredComparisonEventIds = previewRequiredEvents
    .filter((event) => eventsWithSound.has(event.id))
    .map((event) => event.id)
    .sort(compareText);
  const coveredComparisonEventIds = previewRequiredEvents
    .filter((event) => {
      if (!eventsWithSound.has(event.id)) return false;
      const audibleRanges = ranges.filter(
        (range) => range.withSfx && rangeContainsEvent(range, event),
      );
      const mutedRanges = ranges.filter(
        (range) => !range.withSfx && rangeContainsEvent(range, event),
      );
      return audibleRanges.some((audible) =>
        mutedRanges.some(
          (muted) =>
            muted.startFrame === audible.startFrame &&
            muted.endFrameExclusive === audible.endFrameExclusive,
        ),
      );
    })
    .map((event) => event.id)
    .sort(compareText);
  const coveredComparisonEventIdSet = new Set(coveredComparisonEventIds);
  const missingComparisonEventIds = requiredComparisonEventIds.filter(
    (eventId) => !coveredComparisonEventIdSet.has(eventId),
  );

  const receipt = {
    schemaVersion: DIRECTOR_R10_TIMELINE_SCHEMA_VERSION,
    evaluator: 'director-r10-timeline-core/v1',
    timelineId: timeline.timelineId,
    videoId: timeline.videoId,
    fps: timeline.fps,
    timelineSha256: timeline.timelineSha256,
    ranges,
    requiredCategories: normalizedRequiredCategories,
    coveredCategories,
    missingCategories,
    requiredEventIds,
    coveredEventIds,
    missingEventIds,
    requiredSfxRoles,
    coveredSfxRoles,
    missingSfxRoles,
    requiredSfxCueIds,
    coveredSfxCueIds,
    missingSfxCueIds,
    requiredComparisonEventIds,
    coveredComparisonEventIds,
    missingComparisonEventIds,
    complete:
      missingCategories.length === 0 &&
      missingEventIds.length === 0 &&
      missingSfxRoles.length === 0 &&
      missingSfxCueIds.length === 0 &&
      missingComparisonEventIds.length === 0,
  };
  return {
    ...receipt,
    coverageSha256: stableJsonSha256(receipt),
  };
};
