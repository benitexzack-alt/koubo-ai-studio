import assert from 'node:assert/strict';

import {
  DirectorR10TimelineError,
  compileDirectorR10Timeline,
  evaluateDirectorR10PreviewCoverage,
} from './director-r10-timeline-core.mjs';

const clone = (value) => structuredClone(value);
const sha = (character) => character.repeat(64);

const paperStopMotionProfile = {
  id: 'paper-stop-motion-v1',
  version: '1',
  category: 'paper-editorial',
  requiredActionFields: [
    'targetGroupIds',
    'operation',
    'motionWindowFrames',
    'landedOffsetFrames',
    'relationStartOffsetFrames',
    'relationEndOffsetFrames',
  ],
  motionWindowFrames: {min: 16, max: 24},
  landedOffsetFrames: {min: 1, max: 9},
  relationOffsets: {
    requireStartAtOrAfterLanding: true,
    requireEndAfterStart: true,
    requireEndAtOrBeforeMotionEnd: true,
  },
  allowedOperations: ['fold-stack', 'sort-slots', 'draft-review', 'lock-board'],
};

const paperEvent = {
  id: 'paper-definition',
  beatId: 'beat-definition',
  category: 'paper-editorial',
  previewRequired: true,
  semanticBinding: {
    spokenStartFrame: 300,
    claimFrame: 305,
    emphasisFrame: 315,
    spokenEndFrame: 360,
    wordIds: ['word-2', 'word-1'],
    captionIds: ['caption-1'],
  },
  visual: {
    component: 'PaperDefinitionR10',
    props: {title: '具体任务'},
    timing: {
      firstVisible: {ref: 'spokenStart', offsetFrames: -6},
      firstReadable: {ref: 'claim', offsetFrames: -9},
      semanticSettle: {ref: 'claim', offsetFrames: 3},
      actionEnd: {ref: 'spokenEnd', offsetFrames: -3},
      endExclusive: {ref: 'spokenEnd', offsetFrames: 6},
    },
  },
  sound: {
    role: 'paper-action',
    bindTo: 'semanticSettle',
    offsetFrames: 1,
    source: 'audio/paper-action.wav',
  },
};

const processEvent = {
  id: 'process-four-step',
  beatId: 'beat-process',
  category: 'progressive-process',
  previewRequired: true,
  semanticBinding: {
    spokenStartFrame: 600,
    claimFrame: 606,
    emphasisFrame: 620,
    spokenEndFrame: 690,
    wordIds: ['word-3'],
    captionIds: ['caption-2'],
  },
  visual: {
    component: 'FourStepProcessR10',
    props: {steps: ['一', '二', '三', '四']},
    timing: {
      firstVisible: {ref: 'spokenStart', offsetFrames: -4},
      firstReadable: {ref: 'claim', offsetFrames: -6},
      semanticSettle: {ref: 'emphasis', offsetFrames: 0},
      actionEnd: {ref: 'spokenEnd', offsetFrames: -2},
      endExclusive: {ref: 'spokenEnd', offsetFrames: 5},
    },
  },
  sound: {
    role: 'node-connect',
    bindTo: 'actionEnd',
    offsetFrames: 0,
    source: 'audio/node-connect.wav',
  },
};

const baseDefinition = {
  schemaVersion: 1,
  timelineId: 'r10-pilot',
  videoId: 'LANZHOU_R10_PILOT',
  fps: 30,
  durationFrames: 900,
  sourceGraph: [
    {role: 'spoken-timeline', path: 'edit/spoken.json', sha256: sha('a')},
    {role: 'director-postshoot', path: 'edit/director.json', sha256: sha('b')},
  ],
  policy: {
    maxReadableLeadMs: 300,
    maxSfxOffsetFrames: 2,
  },
  events: [processEvent, paperEvent],
};

const expectCode = (code, callback) => {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof DirectorR10TimelineError);
    assert.equal(error.code, code);
    return true;
  });
};

const compiled = compileDirectorR10Timeline(baseDefinition);
assert.equal(compiled.schemaVersion, 1);
assert.equal(compiled.events[0].id, 'paper-definition');
assert.equal(compiled.events[0].firstVisibleFrame, 294);
assert.equal(compiled.events[0].firstReadableFrame, 296);
assert.equal(compiled.events[0].semanticSettleFrame, 308);
assert.equal(compiled.events[0].actionEndFrame, 357);
assert.equal(compiled.events[0].endFrameExclusive, 366);
assert.equal(compiled.events[0].sound.frame, 309);
assert.equal(compiled.events[0].sound.volume, 0.3);
assert.deepEqual(compiled.events[0].actions, []);
assert.equal(compiled.soundCues.length, 2);
assert.ok(
  compiled.soundCues.every((cue) => cue.volume === 0.3),
  '缺省音效增益必须在编译阶段固化为0.3',
);
assert.deepEqual(compiled.events[0].semanticBinding.wordIds, ['word-1', 'word-2']);
assert.match(compiled.sourceGraphSha256, /^[a-f0-9]{64}$/u);
assert.equal(compiled.sourceGraphSha, compiled.sourceGraphSha256);
assert.match(compiled.timelineSha256, /^[a-f0-9]{64}$/u);

const reordered = clone(baseDefinition);
reordered.events.reverse();
reordered.sourceGraph.reverse();
assert.deepEqual(
  compileDirectorR10Timeline(reordered),
  compiled,
  '输入数组顺序不应改变运行时结果或哈希',
);

const changedSource = clone(baseDefinition);
changedSource.sourceGraph[0].sha256 = sha('c');
const changedSourceCompiled = compileDirectorR10Timeline(changedSource);
assert.notEqual(changedSourceCompiled.sourceGraphSha256, compiled.sourceGraphSha256);
assert.notEqual(changedSourceCompiled.timelineSha256, compiled.timelineSha256);

for (const forbiddenKey of ['startSeconds', 'endSeconds', 'previewCoverage']) {
  const invalid = clone(baseDefinition);
  invalid.events[0].visual[forbiddenKey] = forbiddenKey === 'previewCoverage' ? ['hook'] : 1;
  expectCode('R10_FORBIDDEN_AUTHORED_TIMING', () => compileDirectorR10Timeline(invalid));
}

const topLevelLabels = clone(baseDefinition);
topLevelLabels.previewCoverage = ['paper-editorial', 'progressive-process'];
expectCode('R10_FORBIDDEN_PREVIEW_CLAIM', () => compileDirectorR10Timeline(topLevelLabels));

const tooEarly = clone(baseDefinition);
tooEarly.events[1].visual.timing.firstReadable = {ref: 'claim', offsetFrames: -10};
expectCode('R10_READABLE_LEAD_EXCEEDED', () => compileDirectorR10Timeline(tooEarly));

const relaxedReadablePolicy = clone(baseDefinition);
relaxedReadablePolicy.policy.maxReadableLeadMs = 301;
expectCode('R10_POLICY_HARD_LIMIT_EXCEEDED', () =>
  compileDirectorR10Timeline(relaxedReadablePolicy),
);

const relaxedSfxPolicy = clone(baseDefinition);
relaxedSfxPolicy.policy.maxSfxOffsetFrames = 3;
expectCode('R10_POLICY_HARD_LIMIT_EXCEEDED', () =>
  compileDirectorR10Timeline(relaxedSfxPolicy),
);

const previewOptOutEvent = clone(baseDefinition);
previewOptOutEvent.events[1].previewRequired = false;
expectCode('R10_PREVIEW_OPTOUT_FORBIDDEN', () =>
  compileDirectorR10Timeline(previewOptOutEvent),
);

const unstableEventId = clone(baseDefinition);
unstableEventId.events[1].id = '纸艺事件 1';
expectCode('R10_EVENT_ID_INVALID', () => compileDirectorR10Timeline(unstableEventId));

const unstableBeatId = clone(baseDefinition);
unstableBeatId.events[1].beatId = 'Beat Definition';
expectCode('R10_BEAT_ID_INVALID', () => compileDirectorR10Timeline(unstableBeatId));

const invalidOrder = clone(baseDefinition);
invalidOrder.events[1].visual.timing.semanticSettle = {ref: 'claim', offsetFrames: -10};
expectCode('R10_TIMING_ORDER_INVALID', () => compileDirectorR10Timeline(invalidOrder));

const absoluteSfx = clone(baseDefinition);
absoluteSfx.events[1].sound.frame = 309;
expectCode('R10_SFX_ABSOLUTE_TIMING_FORBIDDEN', () => compileDirectorR10Timeline(absoluteSfx));

const absoluteEventTiming = clone(baseDefinition);
absoluteEventTiming.events[1].enterAt = 10;
expectCode('R10_FORBIDDEN_AUTHORED_TIMING', () =>
  compileDirectorR10Timeline(absoluteEventTiming),
);

const legacyEventRange = clone(baseDefinition);
legacyEventRange.events[1].start = 9.8;
legacyEventRange.events[1].end = 12.2;
expectCode('R10_FORBIDDEN_AUTHORED_TIMING', () =>
  compileDirectorR10Timeline(legacyEventRange),
);

const detachedSfx = clone(baseDefinition);
detachedSfx.events[1].sound.bindTo = 'spokenStart';
expectCode('R10_SFX_BINDING_INVALID', () => compileDirectorR10Timeline(detachedSfx));

const excessiveSfxOffset = clone(baseDefinition);
excessiveSfxOffset.events[1].sound.offsetFrames = 3;
expectCode('R10_SFX_OFFSET_EXCEEDED', () => compileDirectorR10Timeline(excessiveSfxOffset));

const belowMinimumSfxVolume = clone(baseDefinition);
belowMinimumSfxVolume.events[1].sound.volume = 0.19;
expectCode('R10_SFX_VOLUME_INVALID', () =>
  compileDirectorR10Timeline(belowMinimumSfxVolume),
);

const acceptedSfxVolumeBoundaries = clone(baseDefinition);
acceptedSfxVolumeBoundaries.events[0].sound.volume = 0.2;
acceptedSfxVolumeBoundaries.events[1].sound.volume = 0.55;
const acceptedSfxVolumeTimeline = compileDirectorR10Timeline(
  acceptedSfxVolumeBoundaries,
);
assert.deepEqual(
  acceptedSfxVolumeTimeline.soundCues.map((cue) => cue.volume),
  [0.55, 0.2],
  '音效增益边界值应被编译进运行时线索',
);

const firstWindowOnly = evaluateDirectorR10PreviewCoverage({
  timeline: compiled,
  previewRanges: [
    {id: 'paper-window', startFrame: 290, endFrameExclusive: 370, withSfx: true},
  ],
  requiredCategories: ['paper-editorial', 'progressive-process'],
});
assert.equal(firstWindowOnly.complete, false);
assert.deepEqual(firstWindowOnly.coveredCategories, ['paper-editorial']);
assert.deepEqual(firstWindowOnly.missingCategories, ['progressive-process']);
assert.deepEqual(firstWindowOnly.missingEventIds, ['process-four-step']);
assert.deepEqual(firstWindowOnly.missingSfxRoles, ['node-connect']);
assert.deepEqual(firstWindowOnly.missingComparisonEventIds, [
  'paper-definition',
  'process-four-step',
]);

const visualsWithoutSound = evaluateDirectorR10PreviewCoverage({
  timeline: compiled,
  previewRanges: [
    {id: 'paper-muted', startFrame: 290, endFrameExclusive: 370, withSfx: false},
    {id: 'process-muted', startFrame: 590, endFrameExclusive: 700, withSfx: false},
  ],
  requiredCategories: ['paper-editorial', 'progressive-process'],
});
assert.deepEqual(visualsWithoutSound.missingEventIds, []);
assert.deepEqual(visualsWithoutSound.missingSfxRoles, ['node-connect', 'paper-action']);
assert.deepEqual(visualsWithoutSound.missingComparisonEventIds, [
  'paper-definition',
  'process-four-step',
]);
assert.equal(visualsWithoutSound.complete, false);

const fourActionPaperEvent = clone(paperEvent);
fourActionPaperEvent.id = 'paper-four-action';
fourActionPaperEvent.beatId = 'beat-paper-four-action';
fourActionPaperEvent.motionProfile = clone(paperStopMotionProfile);
fourActionPaperEvent.semanticBinding.spokenEndFrame = 400;
fourActionPaperEvent.semanticBinding.namedAnchors = {
  'fold-1-start': {
    frame: 300,
    wordIds: ['word-fold-1'],
    captionIds: [],
    timingPrecision: 'word-aligned',
  },
  'fold-2-start': {
    frame: 324,
    wordIds: ['word-fold-2'],
    captionIds: ['caption-fold-2'],
    timingPrecision: 'word-aligned',
  },
  'fold-3-start': {
    frame: 348,
    wordIds: ['word-fold-3'],
    captionIds: [],
    timingPrecision: 'word-aligned',
  },
  'fold-4-start': {
    frame: 372,
    wordIds: ['word-fold-4'],
    captionIds: [],
    timingPrecision: 'word-aligned',
  },
  'fold-4-end': {
    frame: 396,
    wordIds: [],
    captionIds: ['caption-fold-4-end'],
    timingPrecision: 'caption-aligned',
  },
};
fourActionPaperEvent.sound = {
  role: 'paper-entry',
  bindTo: 'firstVisible',
  offsetFrames: 0,
  source: 'audio/paper-entry.wav',
};
fourActionPaperEvent.actions = [
  {
    id: 'fold-1',
    targetGroupIds: ['g-input'],
    operation: 'fold-stack',
    motionWindowFrames: 18,
    landedOffsetFrames: 9,
    relationStartOffsetFrames: 9,
    relationEndOffsetFrames: 16,
    timing: {
      start: {ref: 'fold-1-start', offsetFrames: 0},
      endExclusive: {ref: 'fold-2-start', offsetFrames: 0},
    },
    sound: {
      role: 'paper-fold',
      bindTo: 'semanticSettle',
      offsetFrames: 0,
      source: 'audio/paper-fold-1.wav',
    },
  },
  {
    id: 'fold-2',
    targetGroupIds: ['g-sort'],
    operation: 'sort-slots',
    motionWindowFrames: 18,
    landedOffsetFrames: 9,
    relationStartOffsetFrames: 9,
    relationEndOffsetFrames: 16,
    timing: {
      start: {ref: 'fold-2-start', offsetFrames: 0},
      endExclusive: {ref: 'fold-3-start', offsetFrames: 0},
    },
    sound: {
      role: 'paper-fold',
      bindTo: 'end',
      offsetFrames: 0,
      source: 'audio/paper-fold-2.wav',
    },
  },
  {
    id: 'fold-3',
    targetGroupIds: ['g-draft', 'g-review'],
    operation: 'draft-review',
    motionWindowFrames: 24,
    landedOffsetFrames: 9,
    relationStartOffsetFrames: 9,
    relationEndOffsetFrames: 22,
    timing: {
      start: {ref: 'fold-3-start', offsetFrames: 0},
      endExclusive: {ref: 'fold-4-start', offsetFrames: 0},
    },
    sound: {
      role: 'paper-slide',
      bindTo: 'start',
      offsetFrames: 1,
      source: 'audio/paper-slide.wav',
    },
  },
  {
    id: 'fold-4',
    targetGroupIds: ['g-lock'],
    operation: 'lock-board',
    motionWindowFrames: 18,
    landedOffsetFrames: 9,
    relationStartOffsetFrames: 9,
    relationEndOffsetFrames: 16,
    timing: {
      start: {ref: 'fold-4-start', offsetFrames: 0},
      endExclusive: {ref: 'fold-4-end', offsetFrames: 0},
    },
    sound: {
      role: 'paper-lock',
      bindTo: 'start',
      offsetFrames: 1,
      source: 'audio/paper-lock.wav',
    },
  },
];

const fourActionDefinition = {
  ...clone(baseDefinition),
  timelineId: 'r10-four-action-paper',
  events: [fourActionPaperEvent],
};
const fourActionCompiled = compileDirectorR10Timeline(fourActionDefinition);
assert.equal(fourActionCompiled.events[0].actions.length, 4);
assert.equal(
  Object.keys(fourActionCompiled.events[0].semanticBinding.namedAnchors).length,
  5,
);
assert.equal(
  fourActionCompiled.events[0].actions[0].timingBindings.start.sourceEvidence
    .timingPrecision,
  'word-aligned',
);
assert.equal(
  fourActionCompiled.events[0].actions[0].timingBindings.start.sourceEvidence
    .anchorFrame,
  300,
);
assert.ok(
  fourActionCompiled.events[0].actions.every((action) => action.soundRequired),
  'paper-editorial的动作必须默认要求独立音效，无需作者手填soundRequired',
);
assert.deepEqual(
  fourActionCompiled.events[0].actions.map((action) => action.id),
  ['fold-1', 'fold-2', 'fold-3', 'fold-4'],
);
assert.equal(fourActionCompiled.events[0].motionProfile.id, 'paper-stop-motion-v1');
assert.deepEqual(
  fourActionCompiled.events[0].actions.map((action) => ({
    id: action.id,
    targetGroupIds: action.targetGroupIds,
    operation: action.operation,
    landedFrame: action.landedFrame,
    motionEndFrameExclusive: action.motionEndFrameExclusive,
    relationStartFrame: action.relationStartFrame,
    relationEndFrameExclusive: action.relationEndFrameExclusive,
  })),
  [
    {
      id: 'fold-1',
      targetGroupIds: ['g-input'],
      operation: 'fold-stack',
      landedFrame: 309,
      motionEndFrameExclusive: 318,
      relationStartFrame: 309,
      relationEndFrameExclusive: 316,
    },
    {
      id: 'fold-2',
      targetGroupIds: ['g-sort'],
      operation: 'sort-slots',
      landedFrame: 333,
      motionEndFrameExclusive: 342,
      relationStartFrame: 333,
      relationEndFrameExclusive: 340,
    },
    {
      id: 'fold-3',
      targetGroupIds: ['g-draft', 'g-review'],
      operation: 'draft-review',
      landedFrame: 357,
      motionEndFrameExclusive: 372,
      relationStartFrame: 357,
      relationEndFrameExclusive: 370,
    },
    {
      id: 'fold-4',
      targetGroupIds: ['g-lock'],
      operation: 'lock-board',
      landedFrame: 381,
      motionEndFrameExclusive: 390,
      relationStartFrame: 381,
      relationEndFrameExclusive: 388,
    },
  ],
  '动作窗口必须从语义起点编译为独立绝对帧，不得沿用整段语义区间作为动画时长',
);
assert.equal(fourActionCompiled.soundCues.length, 5);
assert.deepEqual(
  fourActionCompiled.soundCues
    .filter((cue) => cue.actionId !== null)
    .map((cue) => [cue.actionId, cue.frame, cue.role]),
  [
    ['fold-1', 308, 'paper-fold'],
    ['fold-2', 347, 'paper-fold'],
    ['fold-3', 349, 'paper-slide'],
    ['fold-4', 373, 'paper-lock'],
  ],
  '四段动作必须分别保留可审计音效点，不能折叠为一个入口声',
);

const reversedActions = clone(fourActionDefinition);
reversedActions.events[0].actions.reverse();
reversedActions.events[0].semanticBinding.namedAnchors = Object.fromEntries(
  Object.entries(reversedActions.events[0].semanticBinding.namedAnchors).reverse(),
);
assert.deepEqual(
  compileDirectorR10Timeline(reversedActions),
  fourActionCompiled,
  '动作输入顺序不应改变运行时排序或哈希',
);

const missingActionSound = clone(fourActionDefinition);
delete missingActionSound.events[0].actions[3].sound;
expectCode('R10_ACTION_SOUND_REQUIRED', () =>
  compileDirectorR10Timeline(missingActionSound),
);

const missingMotionField = clone(fourActionDefinition);
delete missingMotionField.events[0].actions[0].motionWindowFrames;
expectCode('R10_ACTION_MOTION_CONTRACT_INVALID', () =>
  compileDirectorR10Timeline(missingMotionField),
);

const excessiveMotionWindow = clone(fourActionDefinition);
excessiveMotionWindow.events[0].actions[0].motionWindowFrames = 25;
expectCode('R10_ACTION_MOTION_WINDOW_INVALID', () =>
  compileDirectorR10Timeline(excessiveMotionWindow),
);

const excessiveLandedOffset = clone(fourActionDefinition);
excessiveLandedOffset.events[0].actions[0].landedOffsetFrames = 10;
expectCode('R10_ACTION_LANDED_OFFSET_INVALID', () =>
  compileDirectorR10Timeline(excessiveLandedOffset),
);

const attemptedPaperSoundBypass = clone(fourActionDefinition);
attemptedPaperSoundBypass.events[0].actions[3].soundRequired = false;
delete attemptedPaperSoundBypass.events[0].actions[3].sound;
expectCode('R10_ACTION_SOUND_REQUIRED', () =>
  compileDirectorR10Timeline(attemptedPaperSoundBypass),
);

const attemptedPreviewOptOut = clone(fourActionDefinition);
attemptedPreviewOptOut.events[0].actions[3].sound.previewRequired = false;
expectCode(
  'R10_SFX_PREVIEW_OPTOUT_FORBIDDEN',
  () => compileDirectorR10Timeline(attemptedPreviewOptOut),
);

const aboveMaximumActionSfxVolume = clone(fourActionDefinition);
aboveMaximumActionSfxVolume.events[0].actions[3].sound.volume = 0.56;
expectCode('R10_SFX_VOLUME_INVALID', () =>
  compileDirectorR10Timeline(aboveMaximumActionSfxVolume),
);

const overlappingActions = clone(fourActionDefinition);
overlappingActions.events[0].actions[1].timing.start = {
  ref: 'claim',
  offsetFrames: 4,
};
expectCode('R10_ACTION_ORDER_INVALID', () =>
  compileDirectorR10Timeline(overlappingActions),
);

const nonPaperOptionalAction = clone(baseDefinition);
nonPaperOptionalAction.events[0].actions = [
  {
    id: 'optional-highlight',
    timing: {
      start: {ref: 'claim', offsetFrames: 0},
      endExclusive: {ref: 'emphasis', offsetFrames: 0},
    },
  },
];
const nonPaperOptionalCompiled = compileDirectorR10Timeline(nonPaperOptionalAction);
assert.equal(nonPaperOptionalCompiled.events[1].actions[0].soundRequired, false);
assert.equal(nonPaperOptionalCompiled.events[1].actions[0].sound, null);

const noSemanticEvidence = clone(baseDefinition);
noSemanticEvidence.events[0].semanticBinding.wordIds = [];
noSemanticEvidence.events[0].semanticBinding.captionIds = [];
expectCode('R10_SEMANTIC_EVIDENCE_REQUIRED', () =>
  compileDirectorR10Timeline(noSemanticEvidence),
);

const namedAnchorWithoutEvidence = clone(fourActionDefinition);
namedAnchorWithoutEvidence.events[0].semanticBinding.namedAnchors['fold-2-start'] = {
  frame: 310,
  wordIds: [],
  captionIds: [],
  timingPrecision: 'word-aligned',
};
expectCode('R10_NAMED_ANCHOR_EVIDENCE_REQUIRED', () =>
  compileDirectorR10Timeline(namedAnchorWithoutEvidence),
);

const namedAnchorWithoutPrecision = clone(fourActionDefinition);
namedAnchorWithoutPrecision.events[0].semanticBinding.namedAnchors['fold-2-start']
  .timingPrecision = '';
expectCode('R10_NAMED_ANCHOR_PRECISION_REQUIRED', () =>
  compileDirectorR10Timeline(namedAnchorWithoutPrecision),
);

const reservedNamedAnchor = clone(fourActionDefinition);
reservedNamedAnchor.events[0].semanticBinding.namedAnchors.spokenStart = {
  frame: 300,
  wordIds: ['word-reserved'],
  captionIds: [],
  timingPrecision: 'word-aligned',
};
expectCode('R10_NAMED_ANCHOR_NAME_INVALID', () =>
  compileDirectorR10Timeline(reservedNamedAnchor),
);

const unstableNamedAnchor = clone(fourActionDefinition);
unstableNamedAnchor.events[0].semanticBinding.namedAnchors['临时点1'] = {
  frame: 320,
  wordIds: ['word-unstable'],
  captionIds: [],
  timingPrecision: 'word-aligned',
};
expectCode('R10_NAMED_ANCHOR_NAME_INVALID', () =>
  compileDirectorR10Timeline(unstableNamedAnchor),
);

const fourActionMutedCoverage = evaluateDirectorR10PreviewCoverage({
  timeline: fourActionCompiled,
  previewRanges: [
    {id: 'four-action-muted', startFrame: 290, endFrameExclusive: 410, withSfx: false},
  ],
  requiredCategories: ['paper-editorial'],
});
assert.equal(fourActionMutedCoverage.complete, false);
assert.deepEqual(fourActionMutedCoverage.missingEventIds, []);
assert.deepEqual(fourActionMutedCoverage.missingSfxCueIds, [
  'paper-four-action:event',
  'paper-four-action:fold-1',
  'paper-four-action:fold-2',
  'paper-four-action:fold-3',
  'paper-four-action:fold-4',
]);
assert.deepEqual(fourActionMutedCoverage.missingComparisonEventIds, [
  'paper-four-action',
]);

const fourActionAudibleOnlyCoverage = evaluateDirectorR10PreviewCoverage({
  timeline: fourActionCompiled,
  previewRanges: [
    {id: 'four-action-audible', startFrame: 290, endFrameExclusive: 410, withSfx: true},
  ],
  requiredCategories: ['paper-editorial'],
});
assert.equal(fourActionAudibleOnlyCoverage.complete, false);
assert.deepEqual(fourActionAudibleOnlyCoverage.missingSfxCueIds, []);
assert.deepEqual(fourActionAudibleOnlyCoverage.missingComparisonEventIds, [
  'paper-four-action',
]);

const fourActionMismatchedPair = evaluateDirectorR10PreviewCoverage({
  timeline: fourActionCompiled,
  previewRanges: [
    {id: 'four-action-audible', startFrame: 290, endFrameExclusive: 410, withSfx: true},
    {id: 'four-action-muted-shifted', startFrame: 291, endFrameExclusive: 410, withSfx: false},
  ],
  requiredCategories: ['paper-editorial'],
});
assert.deepEqual(fourActionMismatchedPair.missingComparisonEventIds, [
  'paper-four-action',
]);
assert.equal(fourActionMismatchedPair.complete, false);

const fourActionCoverage = evaluateDirectorR10PreviewCoverage({
  timeline: fourActionCompiled,
  previewRanges: [
    {id: 'four-action-audible', startFrame: 290, endFrameExclusive: 410, withSfx: true},
    {id: 'four-action-muted', startFrame: 290, endFrameExclusive: 410, withSfx: false},
  ],
  requiredCategories: ['paper-editorial'],
});
assert.equal(fourActionCoverage.complete, true);
assert.deepEqual(fourActionCoverage.requiredComparisonEventIds, ['paper-four-action']);
assert.deepEqual(fourActionCoverage.coveredComparisonEventIds, ['paper-four-action']);
assert.deepEqual(fourActionCoverage.missingComparisonEventIds, []);

const tamperedRuntime = clone(fourActionCompiled);
tamperedRuntime.soundCues = tamperedRuntime.soundCues.filter(
  (cue) => cue.actionId !== 'fold-4',
);
expectCode('R10_TIMELINE_SHA_MISMATCH', () =>
  evaluateDirectorR10PreviewCoverage({
    timeline: tamperedRuntime,
    previewRanges: [
      {id: 'tampered-audible', startFrame: 290, endFrameExclusive: 370, withSfx: true},
    ],
    requiredCategories: ['paper-editorial'],
  }),
);

expectCode('R10_FORBIDDEN_PREVIEW_CLAIM', () =>
  evaluateDirectorR10PreviewCoverage({
    timeline: compiled,
    previewRanges: [
      {
        id: 'dishonest-window',
        startFrame: 290,
        endFrameExclusive: 370,
        withSfx: true,
        coveredCategories: ['progressive-process'],
      },
    ],
    requiredCategories: ['paper-editorial', 'progressive-process'],
  }),
);

const allWindows = evaluateDirectorR10PreviewCoverage({
  timeline: compiled,
  previewRanges: [
    {id: 'paper-window', startFrame: 290, endFrameExclusive: 370, withSfx: true},
    {id: 'paper-window-muted', startFrame: 290, endFrameExclusive: 370, withSfx: false},
    {id: 'process-window', startFrame: 590, endFrameExclusive: 700, withSfx: true},
    {id: 'process-window-muted', startFrame: 590, endFrameExclusive: 700, withSfx: false},
  ],
  requiredCategories: ['paper-editorial', 'progressive-process'],
});
assert.equal(allWindows.complete, true);
assert.deepEqual(allWindows.missingCategories, []);
assert.deepEqual(allWindows.missingEventIds, []);
assert.deepEqual(allWindows.missingSfxRoles, []);
assert.deepEqual(allWindows.missingComparisonEventIds, []);
assert.match(allWindows.coverageSha256, /^[a-f0-9]{64}$/u);

const reorderedRanges = evaluateDirectorR10PreviewCoverage({
  timeline: compiled,
  previewRanges: [
    {id: 'process-window-muted', startFrame: 590, endFrameExclusive: 700, withSfx: false},
    {id: 'process-window', startFrame: 590, endFrameExclusive: 700, withSfx: true},
    {id: 'paper-window-muted', startFrame: 290, endFrameExclusive: 370, withSfx: false},
    {id: 'paper-window', startFrame: 290, endFrameExclusive: 370, withSfx: true},
  ],
  requiredCategories: ['progressive-process', 'paper-editorial'],
});
assert.deepEqual(reorderedRanges, allWindows);

console.log('director-r10-timeline tests passed');
