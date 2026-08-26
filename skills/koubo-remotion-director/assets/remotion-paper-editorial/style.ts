export const PAPER_EDITORIAL = {
  colors: {
    desk: '#17272B',
    deskWarm: '#25363A',
    paper: '#F1E5C8',
    paperLight: '#FFF8E7',
    kraft: '#B99058',
    blue: '#275C73',
    cyan: '#4C948E',
    red: '#B84935',
    yellow: '#D7A52A',
    ink: '#14272D',
    inkSoft: '#375057',
    brass: '#A9792D',
    shadow: 'rgba(4, 12, 15, 0.42)',
  },
  font:
    'Inter, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif',
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

export type PaperMaterial =
  | 'uncoated'
  | 'kraft'
  | 'blueprint'
  | 'photo'
  | 'film'
  | 'metal';

export type DirectorCaption = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export type DirectorObjectGroup = {
  id: string;
  label: string;
  kind?: string;
  material?: PaperMaterial | string;
  visualPrimitive: string;
  visualRole: string;
  color?: string;
  nodeIds?: string[];
  nodes?: Array<{id: string; label?: string}>;
};

export type DirectorNode = {
  id: string;
  label?: string;
  role?: string;
  visualRole?: string;
  groupId: string;
};

export type DirectorAssemblyStage = {
  id: string;
  atSeconds: number;
  action: string;
  targetIds: string[];
};

export type DirectorVisualStateAsset = {
  id: string;
  path: string;
  staticFileName: string;
  sha256: string;
  role: 'base-state' | 'revealed-state' | 'occluder' | 'motion-pose';
};

export type DirectorLocalMotionRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DirectorProgressiveLocalMotion =
  | {model: 'neutral/v1'}
  | {
      model: 'authored-local-stop-motion/v1';
      region: DirectorLocalMotionRegion;
      poseAssetIds: [string, string, string];
    };

export type DirectorFullyOccludedStateReveal = {
  method: 'fully-occluded-hard-cut';
  occluderAssetId: string;
  states: Array<{
    id: string;
    assetId: string;
    stageId: string;
    atFrame: number;
  }>;
  transitions: Array<{
    id: string;
    fromStateId: string;
    toStateId: string;
    closeStartFrame: number;
    fullyOccludedFromFrame: number;
    swapFrame: number;
    firstRevealFrame: number;
    revealCompleteFrame: number;
  }>;
};

export type DirectorProgressiveLocalAssemblyStateReveal = {
  method: 'progressive-local-assembly';
  audit: {
    windowStartFrame: number;
    windowEndFrame: number;
    firstChangeFrame: number;
    namedEntityStateCount: number;
    maximumUnchangedFrames: number;
  };
  states: Array<{
    id: string;
    assetId: string;
    stageId: string;
    atFrame: number;
    entityStateId: string;
    changedEntityIds: string[];
    localMotion: DirectorProgressiveLocalMotion;
  }>;
  transitions: Array<{
    id: string;
    fromStateId: string;
    toStateId: string;
    kind: 'visible-discrete-assembly';
    swapFrame: number;
  }>;
};

export type DirectorStateReveal =
  | DirectorFullyOccludedStateReveal
  | DirectorProgressiveLocalAssemblyStateReveal;

export type DirectorScene = {
  id: string;
  type: 'complex-explanation' | 'mechanical-causality' | 'occluded-state-reveal';
  start: number;
  end: number;
  spokenLine: string;
  cognitiveIncrement: string;
  camera?: string;
  layers?: number | unknown[];
  assemblyStages?: DirectorAssemblyStage[];
  objectGroups?: DirectorObjectGroup[];
  nodes?: DirectorNode[];
  relations?: Array<{from: string; to: string}>;
  screenPlacements?: Array<{
    id: string;
    clipIds: string[];
    parentGroupId: string;
    visibleFrom: number;
    visibleTo: number;
  }>;
  mechanism?: {inputNodeId: string; actionNodeId: string; outputNodeIds: string[]};
  stateReveal?: DirectorStateReveal;
  completion: DirectorCompletionWindow;
};

export type DirectorCompletionWindow = {
  model: 'paper-editorial-animation-completion/v1';
  requiredStageIds: string[];
  actualCompletionFrame: number;
  lockEndExclusiveFrame: number;
  availableSettledFrames: number;
  minimumLockFrames: number;
  criticalContributorIds: string[];
};

export type DirectorMedia = {
  spoken?: {
    staticFileName: string;
    sha256?: string;
    sourceIn: number;
    sourceOut: number;
    outputIn?: number;
    outputOut?: number;
    volume?: number;
  };
  screenClips?: Array<{
    id: string;
    staticFileName: string;
    sourceIn: number;
    sourceOut: number;
    representativeTime?: number;
    semanticClaim?: string;
    outputIn: number;
    outputOut: number;
    trimBeforeFrame: number;
    trimAfterFrame: number;
    outputInFrame: number;
    outputOutFrame: number;
    playbackRate: number;
    placementId: string;
  }>;
  screenExcludedRanges?: Array<{sourceIn: number; sourceOut: number; reason: string}>;
  sfx?: Array<{
    id: string;
    path: string;
    staticFileName: string;
    sha256: string;
    cues: Array<{id: string; atSeconds: number; volume: number}>;
  }>;
  visualStateAssets?: DirectorVisualStateAsset[];
};

export type DirectorPlan = {
  schemaVersion?: string;
  project?: {id?: string; title?: string};
  title?: string;
  executionMode?: 'renderable' | 'plan-only';
  render: {
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    durationInFrames: number;
    publicDir?: string;
  };
  media?: DirectorMedia;
  captions?: DirectorCaption[];
  scenes: DirectorScene[];
  stillPlan?: Array<{
    id: string;
    frame: number;
    sceneId: string;
    purpose?: string;
    requiredStageIds: string[];
    minimumSettledFrames: number;
    completion: DirectorCompletionWindow;
  }>;
  samplePlan?: Record<string, unknown>;
  chain?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
};

export type DirectorCompletionLockContext = {
  executionMode?: 'renderable' | 'plan-only' | string;
  durationSeconds?: number;
  requestPath?: string;
  fileBindings?: unknown;
  visualStateAssets?: unknown;
};

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const secondsToFrames = (seconds: number, fps: number) =>
  Math.round(seconds * fps);

export type PhotographicStopMotionCamera = {
  step: number;
  holdFrames: number;
  scale: number;
  translateX: number;
  translateY: number;
};

export const photographicStopMotionCamera = (
  localFrame: number,
  fps: number,
): PhotographicStopMotionCamera => {
  if (!Number.isInteger(localFrame) || localFrame < 0 || !Number.isFinite(fps) || fps <= 0) {
    return directorModelError('DIRECTOR_STOP_MOTION_CAMERA_INPUT_INVALID');
  }
  const holdFrames = Math.max(1, Math.round(fps * 0.8));
  const step = Math.min(12, Math.floor(localFrame / holdFrames));
  const handmadeOffset = [0, 0.35, -0.2, 0.15][step % 4];
  return {
    step,
    holdFrames,
    scale: 1.012 + step * 0.001,
    translateX: -step * 1.1 + handmadeOffset,
    translateY: -step * 0.45 - handmadeOffset * 0.5,
  };
};

export const DIRECTOR_AUTHORED_LOCAL_STOP_MOTION = Object.freeze({
  poseHoldFrames: 3,
  poseCount: 3,
  durationFrames: 9,
} as const);

export type DirectorAuthoredLocalStopMotionFrameState = {
  stateId: string;
  stateAssetId: string;
  baseStateAssetId: string;
  phase: 'neutral' | 'authored-pose';
  poseAssetId: string | null;
  region: DirectorLocalMotionRegion | null;
  poseIndex: 0 | 1 | 2 | null;
};

export const DIRECTOR_ANIMATION_FRAMES = Object.freeze({
  paperPiece: 17,
  paperPin: 17,
  paperPinDelay: 3,
  twine: 18,
  twineDelay: 8,
  nodeTag: 8,
  conveyorReveal: 18,
  conveyorDelay: 3,
  mechanicalAction: 22,
  decisionStamp: 10,
});

export const DIRECTOR_VISUAL_PRIMITIVES = Object.freeze([
  'request-tray',
  'film-reel',
  'comment-magnifier',
  'folded-map',
  'friend-bubble',
  'convergence-tray',
  'timeline-strip',
  'tool-ticket',
  'cut-paper-track',
  'lever-track',
  'control-rig',
  'responsibility-base',
  'answer-tickets',
  'locator-press',
  'screen-proof-strip',
  'path-base',
  'control-lever',
  'decision-stamp',
  'paper-shutter',
] as const);

export const DIRECTOR_VISUAL_ROLES = Object.freeze([
  'action',
  'causal-input',
  'causal-support',
  'choice',
  'constraint',
  'context',
  'context-axis',
  'context-input',
  'control-choice',
  'decision-stamp',
  'evidence',
  'evidence-output',
  'human-decision-output',
  'input',
  'map-proof',
  'mechanism',
  'menu-proof',
  'negative-branch',
  'outcome',
  'positive-branch',
  'result',
  'result-convergence',
  'result-foundation',
  'risk',
  'shared-input',
  'single-causal-action',
  'source-channel',
  'support',
  'transition-occluder',
] as const);

export const DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES = Object.freeze({
  complex: Object.freeze([
    'request-tray',
    'film-reel',
    'comment-magnifier',
    'folded-map',
    'friend-bubble',
    'convergence-tray',
    'timeline-strip',
    'tool-ticket',
    'cut-paper-track',
    'lever-track',
    'control-rig',
    'responsibility-base',
  ]),
  mechanicalInput: Object.freeze(['answer-tickets']),
  mechanicalAction: Object.freeze(['locator-press', 'control-lever']),
  mechanicalOutput: Object.freeze(['screen-proof-strip', 'decision-stamp']),
  mechanicalSupport: Object.freeze(['path-base', 'responsibility-base']),
  occludedInput: Object.freeze(['answer-tickets']),
  occludedOccluder: Object.freeze(['paper-shutter']),
  occludedOutput: Object.freeze(['screen-proof-strip']),
  occludedSupport: Object.freeze(['path-base', 'responsibility-base']),
} as const);

export const DIRECTOR_VISUAL_ROLE_CAPABILITIES = Object.freeze({
  complex: Object.freeze([
    'context-axis',
    'context-input',
    'control-choice',
    'negative-branch',
    'positive-branch',
    'result-convergence',
    'result-foundation',
    'shared-input',
    'source-channel',
  ]),
  mechanicalInput: Object.freeze(['causal-input']),
  mechanicalAction: Object.freeze(['single-causal-action']),
  mechanicalOutput: Object.freeze(['evidence-output', 'human-decision-output']),
  mechanicalSupport: Object.freeze(['causal-support']),
  occludedInput: Object.freeze(['causal-input']),
  occludedOccluder: Object.freeze(['transition-occluder']),
  occludedOutput: Object.freeze(['evidence-output']),
  occludedSupport: Object.freeze(['causal-support']),
} as const);

export const DIRECTOR_RUNTIME_FILE_CONTRACT_ID = 'koubo-director-runtime-files/v1';

export const DIRECTOR_RUNTIME_COMMON_FILES = Object.freeze([
  {id: 'entry', path: 'skills/koubo-remotion-director/assets/remotion-paper-editorial/entry.tsx'},
  {id: 'composition', path: 'skills/koubo-remotion-director/assets/remotion-paper-editorial/DirectorComposition.tsx'},
  {id: 'primitives', path: 'skills/koubo-remotion-director/assets/remotion-paper-editorial/PaperPrimitives.tsx'},
  {id: 'render-style', path: 'skills/koubo-remotion-director/assets/remotion-paper-editorial/style.ts'},
  {id: 'output-schema', path: 'skills/koubo-remotion-director/templates/director-output.v1.schema.json'},
  {id: 'validator', path: 'skills/koubo-remotion-director/scripts/validate-director-output.mjs'},
  {id: 'node-binary', executionField: 'nodeBinary'},
  {id: 'remotion-package', path: 'remotion/package.json'},
  {id: 'remotion-lock', path: 'remotion/package-lock.json'},
  {id: 'schema-validator-engine', path: 'skills/koubo-remotion-director/assets/schema-validator-engine.mjs'},
  {id: 'remotion-offthread-video', path: 'remotion/node_modules/remotion/dist/cjs/video/OffthreadVideo.js'},
  {id: 'remotion-offthread-video-rendering', path: 'remotion/node_modules/remotion/dist/cjs/video/OffthreadVideoForRendering.js'},
  {id: 'remotion-get-current-time', path: 'remotion/node_modules/remotion/dist/cjs/video/get-current-time.js'},
  {id: 'remotion-sequence', path: 'remotion/node_modules/remotion/dist/cjs/Sequence.js'},
  {id: 'remotion-cli-index', path: 'remotion/node_modules/@remotion/cli/dist/index.js'},
  {id: 'remotion-cli-package', path: 'remotion/node_modules/@remotion/cli/package.json'},
] as const);

export const DIRECTOR_RUNTIME_RENDERABLE_FILES = Object.freeze([
  {id: 'remotion-cli', executionField: 'remotionCli'},
  {id: 'chrome-headless-shell', executionField: 'browserExecutable'},
  {id: 'ab-packager', path: 'skills/koubo-remotion-director/scripts/package-and-qa-director-ab.mjs'},
  {id: 'ffmpeg-binary', executionField: 'ffmpegBinary'},
  {id: 'ffprobe-binary', executionField: 'ffprobeBinary'},
] as const);

const DIRECTOR_VISUAL_PRIMITIVE_SET = new Set<string>(DIRECTOR_VISUAL_PRIMITIVES);
const DIRECTOR_VISUAL_ROLE_SET = new Set<string>(DIRECTOR_VISUAL_ROLES);
const DIRECTOR_VISUAL_PRIMITIVE_CAPABILITY_SETS = Object.fromEntries(
  Object.entries(DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES).map(([key, values]) => [key, new Set<string>(values)]),
) as Record<keyof typeof DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES, Set<string>>;
const DIRECTOR_VISUAL_ROLE_CAPABILITY_SETS = Object.fromEntries(
  Object.entries(DIRECTOR_VISUAL_ROLE_CAPABILITIES).map(([key, values]) => [key, new Set<string>(values)]),
) as Record<keyof typeof DIRECTOR_VISUAL_ROLE_CAPABILITIES, Set<string>>;

export const COMPLEX_ROLE_PATTERNS = Object.freeze([
  ['context-input', 'source-channel', 'source-channel', 'source-channel', 'source-channel', 'result-convergence'],
  ['context-axis', 'shared-input', 'negative-branch', 'positive-branch', 'control-choice'],
] as const);

export type DirectorStageEvent = {
  id: string;
  frame: number;
  action: string;
  targetIds: string[];
};

export const sceneStageEvents = (
  scene: DirectorScene,
  fps: number,
): DirectorStageEvent[] =>
  (scene.assemblyStages ?? []).map((stage) => ({
    id: stage.id,
    frame: secondsToFrames(stage.atSeconds, fps) - secondsToFrames(scene.start, fps),
    action: stage.action,
    targetIds: [...stage.targetIds],
  }));

const directorModelError = (code: string, detail?: string): never => {
  const error = new Error(`${code}${detail ? `:${detail}` : ''}`);
  (error as Error & {code?: string}).code = code;
  throw error;
};

const stageForTarget = (scene: DirectorScene, targetId: string) =>
  (scene.assemblyStages ?? []).find((stage) => stage.targetIds.includes(targetId));

const triggerForGroup = (
  scene: DirectorScene,
  group: DirectorObjectGroup,
  fps: number,
) => {
  const direct = stageForTarget(scene, group.id);
  if (direct) return {stageId: direct.id, frame: secondsToFrames(direct.atSeconds, fps)};
  const nodeStages = (group.nodeIds ?? [])
    .map((id) => stageForTarget(scene, id))
    .filter((stage): stage is DirectorAssemblyStage => Boolean(stage))
    .sort((left, right) => left.atSeconds - right.atSeconds);
  if (!nodeStages[0]) return directorModelError('DIRECTOR_RUNTIME_STAGE_MISSING', group.id);
  return {stageId: nodeStages[0].id, frame: secondsToFrames(nodeStages[0].atSeconds, fps)};
};

const triggerForNode = (scene: DirectorScene, node: DirectorNode, fps: number) => {
  const direct = stageForTarget(scene, node.id);
  if (direct) return {stageId: direct.id, frame: secondsToFrames(direct.atSeconds, fps)};
  const group = (scene.objectGroups ?? []).find((item) => item.id === node.groupId);
  if (!group) return directorModelError('DIRECTOR_RUNTIME_NODE_GROUP_MISSING', node.id);
  return triggerForGroup(scene, group, fps);
};

export const assertComplexVisualRoleOrder = (scene: DirectorScene) => {
  const roles = (scene.objectGroups ?? []).map((group) => group.visualRole);
  const accepted = COMPLEX_ROLE_PATTERNS.some(
    (pattern) =>
      pattern.length === roles.length &&
      pattern.every((role, index) => roles[index] === role),
  );
  if (!accepted) {
    return directorModelError(
      'DIRECTOR_COMPLEX_VISUAL_ROLE_ORDER_INVALID',
      `${scene.id}:${roles.join('>')}`,
    );
  }
  return roles;
};

export const assertMechanicalVisualSlots = (scene: DirectorScene) => {
  if (scene.type !== 'mechanical-causality') {
    return directorModelError('DIRECTOR_RUNTIME_SCENE_TYPE_INVALID', scene.type);
  }
  const groups = scene.objectGroups ?? [];
  const count = (role: string) => groups.filter((group) => group.visualRole === role).length;
  if (
    count('causal-input') !== 1 ||
    count('single-causal-action') !== 1 ||
    groups.filter((group) =>
      group.visualRole === 'evidence-output' || group.visualRole === 'human-decision-output'
    ).length !== 1 ||
    count('causal-support') !== 1 ||
    groups.length !== 4
  ) {
    return directorModelError('DIRECTOR_RUNTIME_MECHANICAL_SLOT_INVALID', scene.id);
  }
  return groups;
};

export const assertOccludedStateRevealSlots = (scene: DirectorScene) => {
  if (scene.type !== 'occluded-state-reveal') {
    return directorModelError('DIRECTOR_RUNTIME_SCENE_TYPE_INVALID', scene.type);
  }
  const groups = scene.objectGroups ?? [];
  const count = (role: string) => groups.filter((group) => group.visualRole === role).length;
  if (
    count('causal-input') !== 1 ||
    count('transition-occluder') !== 1 ||
    count('evidence-output') !== 1 ||
    count('causal-support') !== 1 ||
    groups.length !== 4
  ) {
    return directorModelError('DIRECTOR_RUNTIME_OCCLUDED_REVEAL_SLOT_INVALID', scene.id);
  }
  return groups;
};

export const assertDirectorVisualCapabilitySlots = (scene: DirectorScene) => {
  const groups = scene.objectGroups ?? [];
  if (scene.type === 'complex-explanation') {
    for (const group of groups) {
      if (!DIRECTOR_VISUAL_PRIMITIVE_CAPABILITY_SETS.complex.has(group.visualPrimitive)) {
        return directorModelError('DIRECTOR_RENDER_PLAN_VISUAL_PRIMITIVE_SLOT_INVALID', `${scene.id}:${group.id}`);
      }
      if (!DIRECTOR_VISUAL_ROLE_CAPABILITY_SETS.complex.has(group.visualRole)) {
        return directorModelError('DIRECTOR_RENDER_PLAN_VISUAL_ROLE_SLOT_INVALID', `${scene.id}:${group.id}`);
      }
    }
    assertComplexVisualRoleOrder(scene);
    return groups;
  }

  if (scene.type === 'occluded-state-reveal') {
    assertOccludedStateRevealSlots(scene);
    const capabilitiesByRole = new Map<string, keyof typeof DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES>([
      ['causal-input', 'occludedInput'],
      ['transition-occluder', 'occludedOccluder'],
      ['evidence-output', 'occludedOutput'],
      ['causal-support', 'occludedSupport'],
    ]);
    for (const group of groups) {
      const capability = capabilitiesByRole.get(group.visualRole);
      if (!capability) {
        return directorModelError('DIRECTOR_RENDER_PLAN_VISUAL_ROLE_SLOT_INVALID', `${scene.id}:${group.id}`);
      }
      if (!DIRECTOR_VISUAL_PRIMITIVE_CAPABILITY_SETS[capability].has(group.visualPrimitive)) {
        return directorModelError('DIRECTOR_RENDER_PLAN_VISUAL_PRIMITIVE_SLOT_INVALID', `${scene.id}:${group.id}`);
      }
      if (!DIRECTOR_VISUAL_ROLE_CAPABILITY_SETS[capability].has(group.visualRole)) {
        return directorModelError('DIRECTOR_RENDER_PLAN_VISUAL_ROLE_SLOT_INVALID', `${scene.id}:${group.id}`);
      }
    }
    return groups;
  }

  if (scene.type !== 'mechanical-causality') {
    return directorModelError('DIRECTOR_RUNTIME_SCENE_TYPE_INVALID', String(scene.type));
  }
  assertMechanicalVisualSlots(scene);
  const capabilitiesByRole = new Map<string, keyof typeof DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES>([
    ['causal-input', 'mechanicalInput'],
    ['single-causal-action', 'mechanicalAction'],
    ['evidence-output', 'mechanicalOutput'],
    ['human-decision-output', 'mechanicalOutput'],
    ['causal-support', 'mechanicalSupport'],
  ]);
  for (const group of groups) {
    const capability = capabilitiesByRole.get(group.visualRole);
    if (!capability) {
      return directorModelError('DIRECTOR_RENDER_PLAN_VISUAL_ROLE_SLOT_INVALID', `${scene.id}:${group.id}`);
    }
    if (!DIRECTOR_VISUAL_PRIMITIVE_CAPABILITY_SETS[capability].has(group.visualPrimitive)) {
      return directorModelError('DIRECTOR_RENDER_PLAN_VISUAL_PRIMITIVE_SLOT_INVALID', `${scene.id}:${group.id}`);
    }
    if (!DIRECTOR_VISUAL_ROLE_CAPABILITY_SETS[capability].has(group.visualRole)) {
      return directorModelError('DIRECTOR_RENDER_PLAN_VISUAL_ROLE_SLOT_INVALID', `${scene.id}:${group.id}`);
    }
  }
  return groups;
};

export const complexLayoutSlotForGroup = (scene: DirectorScene, groupId: string) => {
  assertComplexVisualRoleOrder(scene);
  const index = (scene.objectGroups ?? []).findIndex((group) => group.id === groupId);
  if (index < 0) return directorModelError('DIRECTOR_RUNTIME_COMPLEX_LAYOUT_MISSING', `${scene.id}:${groupId}`);
  return (scene.objectGroups ?? []).length === 5 && index === 4 ? 5 : index;
};

type AnimationContributor = {
  id: string;
  completeFrame: number;
  stageIds: string[];
};

const relationEndpointTrigger = (scene: DirectorScene, endpointId: string, fps: number) => {
  const node = (scene.nodes ?? []).find((item) => item.id === endpointId);
  if (node) return triggerForNode(scene, node, fps);
  const group = (scene.objectGroups ?? []).find((item) => item.id === endpointId);
  if (group) return triggerForGroup(scene, group, fps);
  return directorModelError('DIRECTOR_RUNTIME_RELATION_ENDPOINT_UNKNOWN', `${scene.id}:${endpointId}`);
};

const unique = <T,>(items: T[]) => [...new Set(items)];

export type OccludedStateFrameState = {
  stateAssetId: string;
  stateId: string;
  phase: 'clear' | 'closing' | 'occluded' | 'opening';
  transition: DirectorFullyOccludedStateReveal['transitions'][number] | null;
};

const assertFullyOccludedStateRevealSchedule = (scene: DirectorScene, fps: number) => {
  const reveal = scene.stateReveal;
  if (!reveal || reveal.method !== 'fully-occluded-hard-cut') {
    return directorModelError('DIRECTOR_STATE_REVEAL_REQUIRED', scene.id);
  }
  if (!Number.isInteger(fps) || fps <= 0) {
    return directorModelError('DIRECTOR_STATE_REVEAL_FPS_INVALID', scene.id);
  }
  const sceneStartFrame = secondsToFrames(scene.start, fps);
  const sceneEndFrame = secondsToFrames(scene.end, fps);
  const stages = new Map((scene.assemblyStages ?? []).map((stage) => [stage.id, stage]));
  if (
    !isNonEmptyString(reveal.occluderAssetId) ||
    !Array.isArray(reveal.states) || reveal.states.length < 2 ||
    !Array.isArray(reveal.transitions) || reveal.transitions.length !== reveal.states.length - 1
  ) return directorModelError('DIRECTOR_STATE_REVEAL_SHAPE_INVALID', scene.id);
  const stateIds = new Set<string>();
  reveal.states.forEach((state, index) => {
    if (
      !isNonEmptyString(state.id) || stateIds.has(state.id) ||
      !isNonEmptyString(state.assetId) || !isNonEmptyString(state.stageId) ||
      !Number.isInteger(state.atFrame) ||
      !stages.has(state.stageId) ||
      state.atFrame !== secondsToFrames(stages.get(state.stageId)!.atSeconds, fps) ||
      state.atFrame < sceneStartFrame || state.atFrame >= sceneEndFrame ||
      (index === 0 && state.atFrame !== sceneStartFrame) ||
      (index > 0 && state.atFrame <= reveal.states[index - 1].atFrame)
    ) return directorModelError('DIRECTOR_STATE_REVEAL_STATE_INVALID', `${scene.id}:${state.id}`);
    stateIds.add(state.id);
  });
  reveal.transitions.forEach((transition, index) => {
    const from = reveal.states[index];
    const to = reveal.states[index + 1];
    if (
      !isNonEmptyString(transition.id) ||
      transition.fromStateId !== from.id || transition.toStateId !== to.id ||
      !Number.isInteger(transition.closeStartFrame) ||
      !Number.isInteger(transition.fullyOccludedFromFrame) ||
      !Number.isInteger(transition.swapFrame) ||
      !Number.isInteger(transition.firstRevealFrame) ||
      !Number.isInteger(transition.revealCompleteFrame) ||
      transition.swapFrame !== to.atFrame ||
      transition.closeStartFrame < sceneStartFrame ||
      !(transition.closeStartFrame < transition.fullyOccludedFromFrame) ||
      !(transition.fullyOccludedFromFrame <= transition.swapFrame) ||
      !(transition.swapFrame < transition.firstRevealFrame) ||
      !(transition.firstRevealFrame < transition.revealCompleteFrame) ||
      transition.revealCompleteFrame >= sceneEndFrame ||
      (index > 0 && transition.closeStartFrame <= reveal.transitions[index - 1].revealCompleteFrame)
    ) return directorModelError('DIRECTOR_STATE_REVEAL_TRANSITION_INVALID', `${scene.id}:${transition.id}`);
  });
  if ((scene.assemblyStages ?? []).some((stage) => stage.action === 'mechanical-action')) {
    return directorModelError('DIRECTOR_STATE_REVEAL_MECHANICAL_CLAIM_FORBIDDEN', scene.id);
  }
  return reveal;
};

export const assertProgressiveLocalAssemblySchedule = (
  scene: DirectorScene,
  fps: number,
) => {
  const reveal = scene.stateReveal;
  if (!reveal || reveal.method !== 'progressive-local-assembly') {
    return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_REQUIRED', scene.id);
  }
  if (scene.type !== 'complex-explanation') {
    return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_SCENE_TYPE_INVALID', scene.id);
  }
  if (fps !== 30) {
    return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_FPS_INVALID', scene.id);
  }
  if ('occluderAssetId' in reveal) {
    return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_FULL_FRAME_OCCLUDER_FORBIDDEN', scene.id);
  }
  const sceneStartFrame = secondsToFrames(scene.start, fps);
  const sceneEndFrame = secondsToFrames(scene.end, fps);
  const auditWindowEndFrame = sceneStartFrame + 278;
  if (auditWindowEndFrame >= sceneEndFrame) {
    return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_AUDIT_WINDOW_OUTSIDE_SCENE', scene.id);
  }
  if (
    !Array.isArray(reveal.states) || reveal.states.length < 4 ||
    !Array.isArray(reveal.transitions) || reveal.transitions.length !== reveal.states.length - 1
  ) return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_SHAPE_INVALID', scene.id);

  const stages = new Map((scene.assemblyStages ?? []).map((stage) => [stage.id, stage]));
  const knownTargets = new Set([
    ...(scene.objectGroups ?? []).map((group) => group.id),
    ...(scene.nodes ?? []).map((node) => node.id),
  ]);
  const stateIds = new Set<string>();
  const entityStateIds = new Set<string>();
  const poseAssetIds = new Set<string>();
  reveal.states.forEach((state, index) => {
    const stage = stages.get(state.stageId);
    if (
      !isNonEmptyString(state.id) || stateIds.has(state.id) ||
      !isNonEmptyString(state.assetId) || !isNonEmptyString(state.stageId) ||
      !isNonEmptyString(state.entityStateId) || entityStateIds.has(state.entityStateId) ||
      !Array.isArray(state.changedEntityIds) || state.changedEntityIds.length === 0 ||
      new Set(state.changedEntityIds).size !== state.changedEntityIds.length ||
      state.changedEntityIds.some((id) => !isNonEmptyString(id) || !knownTargets.has(id)) ||
      !Number.isInteger(state.atFrame) || !stage ||
      state.atFrame !== secondsToFrames(stage.atSeconds, fps) ||
      state.changedEntityIds.some((id) => !stage.targetIds.includes(id)) ||
      state.atFrame < sceneStartFrame || state.atFrame >= sceneEndFrame ||
      (index === 0 && state.atFrame !== sceneStartFrame) ||
      (index > 0 && state.atFrame <= reveal.states[index - 1].atFrame)
    ) return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_STATE_INVALID', `${scene.id}:${state.id}`);
    const localMotion = state.localMotion as unknown;
    if (!isRecord(localMotion) || !isNonEmptyString(localMotion.model)) {
      return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_LOCAL_MOTION_REQUIRED', `${scene.id}:${state.id}`);
    }
    if (index === 0) {
      if (
        localMotion.model !== 'neutral/v1' ||
        Object.keys(localMotion).length !== 1
      ) return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_NEUTRAL_MOTION_INVALID', `${scene.id}:${state.id}`);
    } else {
      if (
        localMotion.model !== 'authored-local-stop-motion/v1' ||
        Object.keys(localMotion).length !== 3 ||
        !Object.prototype.hasOwnProperty.call(localMotion, 'region') ||
        !Object.prototype.hasOwnProperty.call(localMotion, 'poseAssetIds') ||
        !Array.isArray(localMotion.poseAssetIds) ||
        localMotion.poseAssetIds.length !== DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.poseCount ||
        new Set(localMotion.poseAssetIds).size !== DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.poseCount ||
        localMotion.poseAssetIds.some((id) =>
          !isNonEmptyString(id) || id === state.assetId || poseAssetIds.has(id))
      ) return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_MOTION_INVALID', `${scene.id}:${state.id}`);
      const region = localMotion.region;
      if (
        !isRecord(region) ||
        Object.keys(region).length !== 4 ||
        !['x', 'y', 'width', 'height'].every((key) => Object.prototype.hasOwnProperty.call(region, key)) ||
        !Number.isInteger(region.x) || !Number.isInteger(region.y) ||
        !Number.isInteger(region.width) || !Number.isInteger(region.height) ||
        Number(region.x) < 0 || Number(region.y) < 0 ||
        Number(region.width) <= 0 || Number(region.height) <= 0 ||
        Number(region.x) + Number(region.width) > PAPER_EDITORIAL.width ||
        Number(region.y) + Number(region.height) > PAPER_EDITORIAL.height
      ) return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_LOCAL_REGION_INVALID', `${scene.id}:${state.id}`);
      if (
        state.atFrame - reveal.states[index - 1].atFrame <=
          DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.durationFrames
      ) return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_PREROLL_INSUFFICIENT', `${scene.id}:${state.id}`);
      localMotion.poseAssetIds.forEach((id) => poseAssetIds.add(id));
    }
    stateIds.add(state.id);
    entityStateIds.add(state.entityStateId);
  });

  reveal.transitions.forEach((transition, index) => {
    const from = reveal.states[index];
    const to = reveal.states[index + 1];
    if (
      !isNonEmptyString(transition.id) ||
      transition.fromStateId !== from.id || transition.toStateId !== to.id ||
      transition.kind !== 'visible-discrete-assembly' ||
      !Number.isInteger(transition.swapFrame) || transition.swapFrame !== to.atFrame
    ) return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_TRANSITION_INVALID', `${scene.id}:${transition.id}`);
  });

  const statesInAuditWindow = reveal.states.filter(
    (state) => state.atFrame >= sceneStartFrame && state.atFrame <= auditWindowEndFrame,
  );
  if (statesInAuditWindow.length < 4) {
    return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_NAMED_STATES_INSUFFICIENT', scene.id);
  }
  const firstChangeFrame = statesInAuditWindow[1]?.atFrame;
  if (!Number.isInteger(firstChangeFrame) || firstChangeFrame - sceneStartFrame > 30) {
    return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_FIRST_CHANGE_LATE', scene.id);
  }
  const auditPoints = [
    sceneStartFrame,
    ...statesInAuditWindow.slice(1).map((state) => state.atFrame),
    auditWindowEndFrame,
  ];
  const maximumUnchangedFrames = Math.max(
    ...auditPoints.slice(1).map((frame, index) => frame - auditPoints[index]),
    ...reveal.states.slice(1).map(
      (state, index) => state.atFrame - reveal.states[index].atFrame,
    ),
  );
  if (maximumUnchangedFrames > 45) {
    return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_UNCHANGED_GAP_EXCEEDED', scene.id);
  }
  const expectedAudit = {
    windowStartFrame: sceneStartFrame,
    windowEndFrame: auditWindowEndFrame,
    firstChangeFrame,
    namedEntityStateCount: new Set(statesInAuditWindow.map((state) => state.entityStateId)).size,
    maximumUnchangedFrames,
  };
  if (
    !isRecord(reveal.audit) ||
    Object.entries(expectedAudit).some(([key, value]) => reveal.audit[key as keyof typeof expectedAudit] !== value)
  ) return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_AUDIT_MISMATCH', scene.id);
  if ((scene.assemblyStages ?? []).some((stage) => stage.action === 'mechanical-action')) {
    return directorModelError('DIRECTOR_STATE_REVEAL_MECHANICAL_CLAIM_FORBIDDEN', scene.id);
  }
  return reveal;
};

export const authoredLocalStopMotionFrameState = (
  scene: DirectorScene,
  globalFrame: number,
  fps: number,
  forceNeutral = false,
): DirectorAuthoredLocalStopMotionFrameState => {
  const sceneStartFrame = secondsToFrames(scene.start, fps);
  const sceneEndFrame = secondsToFrames(scene.end, fps);
  if (
    !Number.isInteger(globalFrame) ||
    globalFrame < sceneStartFrame ||
    globalFrame >= sceneEndFrame ||
    typeof forceNeutral !== 'boolean'
  ) {
    return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_FRAME_INPUT_INVALID', scene.id);
  }
  const reveal = assertProgressiveLocalAssemblySchedule(scene, fps);
  let stateIndex = 0;
  reveal.states.forEach((candidate, index) => {
    if (globalFrame >= candidate.atFrame) stateIndex = index;
  });
  const state = reveal.states[stateIndex];
  const neutral = (): DirectorAuthoredLocalStopMotionFrameState => ({
    stateId: state.id,
    stateAssetId: state.assetId,
    baseStateAssetId: state.assetId,
    phase: 'neutral',
    poseAssetId: null,
    region: null,
    poseIndex: null,
  });
  if (forceNeutral) return neutral();
  const targetState = reveal.states[stateIndex + 1];
  if (!targetState || targetState.localMotion.model === 'neutral/v1') return neutral();
  const prerollStart = targetState.atFrame - DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.durationFrames;
  if (globalFrame < prerollStart) return neutral();
  const poseIndex = Math.floor(
    (globalFrame - prerollStart) / DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.poseHoldFrames,
  ) as 0 | 1 | 2;
  if (poseIndex < 0 || poseIndex >= DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.poseCount) {
    return directorModelError('DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_POSE_FRAME_INVALID', `${scene.id}:${targetState.id}`);
  }
  return {
    stateId: targetState.id,
    stateAssetId: targetState.assetId,
    baseStateAssetId: state.assetId,
    phase: 'authored-pose',
    poseAssetId: targetState.localMotion.poseAssetIds[poseIndex],
    region: {...targetState.localMotion.region},
    poseIndex,
  };
};

export const assertStateRevealSchedule = (scene: DirectorScene, fps: number) => {
  if (!scene.stateReveal) {
    return directorModelError('DIRECTOR_STATE_REVEAL_REQUIRED', scene.id);
  }
  if (scene.stateReveal.method === 'fully-occluded-hard-cut') {
    return assertFullyOccludedStateRevealSchedule(scene, fps);
  }
  if (scene.stateReveal.method === 'progressive-local-assembly') {
    return assertProgressiveLocalAssemblySchedule(scene, fps);
  }
  return directorModelError(
    'DIRECTOR_STATE_REVEAL_METHOD_INVALID',
    `${scene.id}:${String((scene.stateReveal as {method?: unknown}).method)}`,
  );
};

export const occludedStateFrameState = (
  scene: DirectorScene,
  globalFrame: number,
  fps: number,
): OccludedStateFrameState => {
  const reveal = assertStateRevealSchedule(scene, fps);
  const state = [...reveal.states]
    .reverse()
    .find((candidate) => globalFrame >= candidate.atFrame) ?? reveal.states[0];
  if (reveal.method === 'progressive-local-assembly') {
    return {stateAssetId: state.assetId, stateId: state.id, phase: 'clear', transition: null};
  }
  const transition = reveal.transitions.find(
    (candidate) => globalFrame >= candidate.closeStartFrame && globalFrame <= candidate.revealCompleteFrame,
  ) ?? null;
  let phase: OccludedStateFrameState['phase'] = 'clear';
  if (transition) {
    if (globalFrame < transition.fullyOccludedFromFrame) phase = 'closing';
    else if (globalFrame < transition.firstRevealFrame) phase = 'occluded';
    else phase = 'opening';
  }
  return {stateAssetId: state.assetId, stateId: state.id, phase, transition};
};

const complexAnimationContributors = (
  scene: DirectorScene,
  fps: number,
): AnimationContributor[] => {
  assertComplexVisualRoleOrder(scene);
  const groups = scene.objectGroups ?? [];
  const contributors: AnimationContributor[] = [];
  groups.forEach((group, index) => {
    const trigger = triggerForGroup(scene, group, fps);
    contributors.push({
      id: `paper:${group.id}`,
      completeFrame: trigger.frame + DIRECTOR_ANIMATION_FRAMES.paperPiece,
      stageIds: [trigger.stageId],
    });
    if (index > 0) {
      contributors.push({
        id: `pin:${group.id}`,
        completeFrame:
          trigger.frame +
          DIRECTOR_ANIMATION_FRAMES.paperPinDelay +
          DIRECTOR_ANIMATION_FRAMES.paperPin,
        stageIds: [trigger.stageId],
      });
    }
  });
  for (const node of scene.nodes ?? []) {
    const trigger = triggerForNode(scene, node, fps);
    contributors.push({
      id: `node-tag:${node.id}`,
      completeFrame: trigger.frame + DIRECTOR_ANIMATION_FRAMES.nodeTag,
      stageIds: [trigger.stageId],
    });
  }
  for (const relation of scene.relations ?? []) {
    const from = relationEndpointTrigger(scene, relation.from, fps);
    const to = relationEndpointTrigger(scene, relation.to, fps);
    contributors.push({
      id: `relation:${relation.from}->${relation.to}`,
      completeFrame:
        Math.max(from.frame, to.frame) +
        DIRECTOR_ANIMATION_FRAMES.twineDelay +
        DIRECTOR_ANIMATION_FRAMES.twine,
      stageIds: unique([from.stageId, to.stageId]),
    });
  }
  return contributors;
};

type MechanicalAnchor = {x: number; y: number};

export type MechanicalRelationRenderEdge = DirectorRelationEdge & {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  enterFrame: number;
  completeFrame: number;
  dependencyStageIds: string[];
};

const mechanicalEndpointAnchor = (
  scene: DirectorScene,
  endpointId: string,
): MechanicalAnchor => {
  if (!scene.mechanism) return directorModelError('DIRECTOR_RUNTIME_MECHANISM_CORE_MISSING', scene.id);
  const {inputNodeId, actionNodeId, outputNodeIds} = scene.mechanism;
  if (endpointId === inputNodeId) return {x: 560, y: 520};
  if (endpointId === actionNodeId) return {x: 1128, y: 520};
  const outputIndex = outputNodeIds.indexOf(endpointId);
  if (outputIndex >= 0) {
    const spread = outputNodeIds.length === 1 ? 0 : (outputIndex / (outputNodeIds.length - 1) - 0.5) * 220;
    return {x: 1290, y: 520 + spread};
  }
  const group = (scene.objectGroups ?? []).find((item) => item.id === endpointId);
  if (group?.nodeIds?.includes(inputNodeId)) return {x: 560, y: 520};
  if (group?.nodeIds?.includes(actionNodeId)) return {x: 1128, y: 520};
  if (group?.nodeIds?.some((id) => outputNodeIds.includes(id))) return {x: 1290, y: 520};
  if (group?.visualRole === 'causal-support') return {x: 960, y: 785};
  return directorModelError('DIRECTOR_RUNTIME_MECHANICAL_RELATION_ANCHOR_UNKNOWN', `${scene.id}:${endpointId}`);
};

export const mechanicalRelationRenderEdges = (
  scene: DirectorScene,
  fps: number,
): MechanicalRelationRenderEdge[] => {
  if (scene.type !== 'mechanical-causality') {
    return directorModelError('DIRECTOR_RUNTIME_SCENE_TYPE_INVALID', scene.type);
  }
  return sceneRelationEdges(scene).map((edge) => {
    const fromTrigger = relationEndpointTrigger(scene, edge.from, fps);
    const toTrigger = relationEndpointTrigger(scene, edge.to, fps);
    const fromAnchor = mechanicalEndpointAnchor(scene, edge.from);
    const toAnchor = mechanicalEndpointAnchor(scene, edge.to);
    const enterFrame =
      Math.max(fromTrigger.frame, toTrigger.frame) -
      secondsToFrames(scene.start, fps) +
      DIRECTOR_ANIMATION_FRAMES.twineDelay;
    return {
      ...edge,
      x1: fromAnchor.x,
      y1: fromAnchor.y,
      x2: toAnchor.x,
      y2: toAnchor.y,
      enterFrame,
      completeFrame:
        secondsToFrames(scene.start, fps) + enterFrame + DIRECTOR_ANIMATION_FRAMES.twine,
      dependencyStageIds: unique([fromTrigger.stageId, toTrigger.stageId]),
    };
  });
};

const mechanicalAnimationContributors = (
  scene: DirectorScene,
  fps: number,
): AnimationContributor[] => {
  if (!scene.mechanism) return directorModelError('DIRECTOR_RUNTIME_MECHANISM_CORE_MISSING', scene.id);
  const groups = scene.objectGroups ?? [];
  const inputNode = (scene.nodes ?? []).find((node) => node.id === scene.mechanism?.inputNodeId);
  const actionNode = (scene.nodes ?? []).find((node) => node.id === scene.mechanism?.actionNodeId);
  if (!inputNode || !actionNode) return directorModelError('DIRECTOR_RUNTIME_MECHANISM_CORE_MISSING', scene.id);
  const inputTrigger = triggerForNode(scene, inputNode, fps);
  const actionTrigger = triggerForNode(scene, actionNode, fps);
  const contributors: AnimationContributor[] = [
    {
      id: 'mechanical:input-paper',
      completeFrame: inputTrigger.frame + DIRECTOR_ANIMATION_FRAMES.paperPiece,
      stageIds: [inputTrigger.stageId],
    },
    {
      id: 'mechanical:conveyor-action',
      completeFrame: actionTrigger.frame + DIRECTOR_ANIMATION_FRAMES.mechanicalAction,
      stageIds: unique([inputTrigger.stageId, actionTrigger.stageId]),
    },
    {
      id: 'mechanical:action-paper',
      completeFrame:
        Math.max(inputTrigger.frame + 5, actionTrigger.frame - 20) +
        DIRECTOR_ANIMATION_FRAMES.paperPiece,
      stageIds: unique([inputTrigger.stageId, actionTrigger.stageId]),
    },
    {
      id: 'mechanical:action-motion',
      completeFrame: actionTrigger.frame + DIRECTOR_ANIMATION_FRAMES.mechanicalAction,
      stageIds: [actionTrigger.stageId],
    },
    {
      id: 'mechanical:action-pin',
      completeFrame: actionTrigger.frame + DIRECTOR_ANIMATION_FRAMES.paperPin,
      stageIds: [actionTrigger.stageId],
    },
  ];
  const outputGroup = groups.find((group) =>
    group.nodeIds?.some((id) => scene.mechanism?.outputNodeIds.includes(id)),
  );
  if (!outputGroup) return directorModelError('DIRECTOR_RUNTIME_MECHANISM_OUTPUT_MISSING', scene.id);
  const outputTriggers = scene.mechanism.outputNodeIds.map((id) => {
    const node = (scene.nodes ?? []).find((item) => item.id === id);
    if (!node) return directorModelError('DIRECTOR_RUNTIME_MECHANISM_OUTPUT_MISSING', id);
    return {id, ...triggerForNode(scene, node, fps)};
  });
  if (outputGroup.visualPrimitive === 'decision-stamp') {
    const first = outputTriggers[0];
    contributors.push({
      id: 'mechanical:decision-paper',
      completeFrame:
        Math.max(actionTrigger.frame + 4, first.frame - 8) +
        DIRECTOR_ANIMATION_FRAMES.paperPiece,
      stageIds: unique([actionTrigger.stageId, first.stageId]),
    });
    for (const output of outputTriggers) {
      contributors.push({
        id: `mechanical:stamp:${output.id}`,
        completeFrame: output.frame + DIRECTOR_ANIMATION_FRAMES.decisionStamp,
        stageIds: [output.stageId],
      });
    }
  } else if (outputGroup.visualPrimitive === 'screen-proof-strip') {
    for (const output of outputTriggers) {
      contributors.push({
        id: `mechanical:screen-proof:${output.id}`,
        completeFrame: output.frame,
        stageIds: [output.stageId],
      });
    }
  }
  const supportGroup = groups.find((group) => group.visualRole === 'causal-support');
  if (!supportGroup) return directorModelError('DIRECTOR_RUNTIME_SUPPORT_GROUP_COUNT_INVALID', scene.id);
  const supportTrigger = triggerForGroup(scene, supportGroup, fps);
  contributors.push({
    id: `mechanical:support-paper:${supportGroup.id}`,
    completeFrame: supportTrigger.frame + DIRECTOR_ANIMATION_FRAMES.paperPiece,
    stageIds: [supportTrigger.stageId],
  });
  for (const node of (scene.nodes ?? []).filter((item) => item.groupId === supportGroup.id)) {
    const trigger = triggerForNode(scene, node, fps);
    contributors.push({
      id: `mechanical:support-node:${node.id}`,
      completeFrame: trigger.frame + DIRECTOR_ANIMATION_FRAMES.nodeTag,
      stageIds: [trigger.stageId],
    });
  }
  for (const edge of mechanicalRelationRenderEdges(scene, fps)) {
    contributors.push({
      id: `mechanical:relation:${edge.from}->${edge.to}`,
      completeFrame: edge.completeFrame,
      stageIds: edge.dependencyStageIds,
    });
  }
  return contributors;
};

const stateRevealAnimationContributors = (
  scene: DirectorScene,
  fps: number,
): AnimationContributor[] => {
  const reveal = assertStateRevealSchedule(scene, fps);
  return reveal.states.map((state, index) => ({
    id: `state-reveal:${state.id}`,
    completeFrame:
      index === 0 || reveal.method === 'progressive-local-assembly'
        ? state.atFrame
        : reveal.transitions[index - 1].revealCompleteFrame,
    stageIds: [state.stageId],
  }));
};

export const sceneCompletionWindow = (
  scene: DirectorScene,
  fps: number,
  requiredStageIds: string[],
  minimumLockFrames = fps,
): DirectorCompletionWindow => {
  if (!Number.isInteger(fps) || fps <= 0) return directorModelError('DIRECTOR_COMPLETION_FPS_INVALID');
  if (
    !Number.isInteger(minimumLockFrames) ||
    minimumLockFrames <= 0 ||
    minimumLockFrames > fps
  ) return directorModelError('DIRECTOR_COMPLETION_MINIMUM_LOCK_INVALID', scene.id);
  const stages = scene.assemblyStages ?? [];
  if (requiredStageIds.length === 0 || requiredStageIds.length > stages.length) {
    return directorModelError('DIRECTOR_COMPLETION_REQUIRED_STAGES_INVALID', scene.id);
  }
  requiredStageIds.forEach((stageId, index) => {
    if (stages[index]?.id !== stageId) {
      return directorModelError('DIRECTOR_COMPLETION_STAGE_PREFIX_INVALID', `${scene.id}:${stageId}`);
    }
  });
  const required = new Set(requiredStageIds);
  const contributors = (
    scene.stateReveal
      ? stateRevealAnimationContributors(scene, fps)
      : scene.type === 'complex-explanation'
        ? complexAnimationContributors(scene, fps)
        : scene.type === 'mechanical-causality'
          ? mechanicalAnimationContributors(scene, fps)
          : directorModelError('DIRECTOR_RUNTIME_SCENE_TYPE_INVALID', String(scene.type))
  ).filter((item) => item.stageIds.every((stageId) => required.has(stageId)));
  if (contributors.length === 0) return directorModelError('DIRECTOR_COMPLETION_CONTRIBUTORS_EMPTY', scene.id);
  const actualCompletionFrame = Math.max(...contributors.map((item) => item.completeFrame));
  const nextStage = stages[requiredStageIds.length];
  const lockEndExclusiveFrame = nextStage
    ? secondsToFrames(nextStage.atSeconds, fps)
    : secondsToFrames(scene.end, fps);
  const availableSettledFrames = lockEndExclusiveFrame - actualCompletionFrame;
  return {
    model: 'paper-editorial-animation-completion/v1',
    requiredStageIds: [...requiredStageIds],
    actualCompletionFrame,
    lockEndExclusiveFrame,
    availableSettledFrames,
    minimumLockFrames,
    criticalContributorIds: contributors
      .filter((item) => item.completeFrame === actualCompletionFrame)
      .map((item) => item.id)
      .sort(),
  };
};

export const stageFrameForTarget = (
  scene: DirectorScene,
  targetId: string,
  fps: number,
): number | null => {
  const event = sceneStageEvents(scene, fps).find((stage) =>
    stage.targetIds.includes(targetId),
  );
  return event?.frame ?? null;
};

export const groupEnterFrame = (
  scene: DirectorScene,
  group: DirectorObjectGroup,
  fps: number,
): number => {
  const direct = stageFrameForTarget(scene, group.id, fps);
  if (direct !== null) return direct;
  const nodeFrames = (group.nodeIds ?? [])
    .map((id) => stageFrameForTarget(scene, id, fps))
    .filter((frame): frame is number => frame !== null);
  if (nodeFrames.length === 0) {
    throw new Error(`DIRECTOR_RUNTIME_STAGE_MISSING:${group.id}`);
  }
  return Math.min(...nodeFrames);
};

export const nodeEnterFrame = (
  scene: DirectorScene,
  node: DirectorNode,
  fps: number,
): number =>
  stageFrameForTarget(scene, node.id, fps) ??
  stageFrameForTarget(scene, node.groupId, fps) ??
  (() => {
    throw new Error(`DIRECTOR_RUNTIME_STAGE_MISSING:${node.id}`);
  })();

export type DirectorSfxRenderCue = {
  key: string;
  staticFileName: string;
  frame: number;
  volume: number;
};

export const expandSfxCues = (
  sfx: NonNullable<DirectorMedia['sfx']>,
  fps: number,
): DirectorSfxRenderCue[] =>
  sfx.flatMap((file) =>
    file.cues.map((cue) => ({
      key: `${file.id}:${cue.id}`,
      staticFileName: file.staticFileName,
      frame: Math.max(0, secondsToFrames(cue.atSeconds, fps)),
      volume: cue.volume,
    })),
  );

export const screenClipRenderTiming = (
  clip: NonNullable<DirectorMedia['screenClips']>[number],
  fps: number,
) => {
  const trimBeforeFrame = secondsToFrames(clip.sourceIn, fps);
  const trimAfterFrame = secondsToFrames(clip.sourceOut, fps);
  const outputInFrame = secondsToFrames(clip.outputIn, fps);
  const outputOutFrame = secondsToFrames(clip.outputOut, fps);
  const playbackRate =
    (trimAfterFrame - trimBeforeFrame) / (outputOutFrame - outputInFrame);
  return {
    trimBeforeFrame,
    trimAfterFrame,
    outputInFrame,
    outputOutFrame,
    playbackRate,
  };
};

export type ScreenClipFrameState = {
  visible: boolean;
  outputFrame: number;
  outputOffset: number;
  sourceFrame: number;
  sourceTime: number;
  excluded: boolean;
};

export const screenClipFrameState = (
  clip: NonNullable<DirectorMedia['screenClips']>[number],
  outputFrame: number,
  excludedRanges: NonNullable<DirectorMedia['screenExcludedRanges']>,
  fps: number,
): ScreenClipFrameState => {
  const outputOffset = outputFrame - clip.outputInFrame;
  const visible = outputOffset >= 0 && outputOffset < clip.outputOutFrame - clip.outputInFrame;
  const sourceFrame = clip.trimBeforeFrame + outputOffset * clip.playbackRate;
  const sourceTime = sourceFrame / fps;
  return {
    visible,
    outputFrame,
    outputOffset,
    sourceFrame,
    sourceTime,
    excluded: excludedRanges.some(
      (range) => sourceTime >= range.sourceIn && sourceTime < range.sourceOut,
    ),
  };
};

export const validateScreenClipFrameLifecycle = (
  clip: NonNullable<DirectorMedia['screenClips']>[number],
  excludedRanges: NonNullable<DirectorMedia['screenExcludedRanges']>,
  fps: number,
) => {
  const duration = clip.outputOutFrame - clip.outputInFrame;
  const sourceDuration = clip.trimAfterFrame - clip.trimBeforeFrame;
  if (!Number.isInteger(duration) || duration <= 0 || sourceDuration <= 0) {
    return directorModelError('DIRECTOR_SCREEN_FRAME_RANGE_INVALID', clip.id);
  }
  const expectedRate = sourceDuration / duration;
  if (!Number.isFinite(clip.playbackRate) || Math.abs(clip.playbackRate - expectedRate) > 1e-12) {
    return directorModelError('DIRECTOR_OUTPUT_SCREEN_PLAYBACK_RATE_INVALID', clip.id);
  }
  for (let offset = 0; offset < duration; offset += 1) {
    const state = screenClipFrameState(
      clip,
      clip.outputInFrame + offset,
      excludedRanges,
      fps,
    );
    if (
      !state.visible ||
      state.sourceFrame < clip.trimBeforeFrame ||
      state.sourceFrame >= clip.trimAfterFrame ||
      state.excluded
    ) {
      return directorModelError('DIRECTOR_SCREEN_FRAME_LIFECYCLE_INVALID', `${clip.id}:${offset}`);
    }
  }
  const terminal = screenClipFrameState(
    clip,
    clip.outputOutFrame,
    excludedRanges,
    fps,
  );
  if (terminal.visible || Math.abs(terminal.sourceFrame - clip.trimAfterFrame) > 1e-9) {
    return directorModelError('DIRECTOR_SCREEN_TERMINAL_FRAME_INVALID', clip.id);
  }
  return {durationInFrames: duration, playbackRate: expectedRate, terminal};
};

export type DirectorRelationEdge = {
  from: string;
  to: string;
  fromGroupId: string;
  toGroupId: string;
};

export const sceneRelationEdges = (scene: DirectorScene): DirectorRelationEdge[] => {
  const groups = scene.objectGroups ?? [];
  const groupIds = new Set(groups.map((group) => group.id));
  const nodeGroupIds = new Map((scene.nodes ?? []).map((node) => [node.id, node.groupId]));
  const resolveGroupId = (endpointId: string) => {
    if (groupIds.has(endpointId)) return endpointId;
    const groupId = nodeGroupIds.get(endpointId);
    if (!groupId || !groupIds.has(groupId)) {
      throw new Error(`DIRECTOR_RUNTIME_RELATION_ENDPOINT_UNKNOWN:${scene.id}:${endpointId}`);
    }
    return groupId;
  };
  const seen = new Set<string>();
  return (scene.relations ?? []).map((relation) => {
    if (relation.from === relation.to) {
      return directorModelError('DIRECTOR_RENDER_PLAN_RELATION_SELF_LOOP_FORBIDDEN', `${scene.id}:${relation.from}`);
    }
    const key = `${relation.from}\0${relation.to}`;
    if (seen.has(key)) {
      return directorModelError('DIRECTOR_RENDER_PLAN_RELATION_DUPLICATE', `${scene.id}:${relation.from}->${relation.to}`);
    }
    seen.add(key);
    return {
      from: relation.from,
      to: relation.to,
      fromGroupId: resolveGroupId(relation.from),
      toGroupId: resolveGroupId(relation.to),
    };
  });
};

export type ComplexRelationRenderEdge = DirectorRelationEdge & {
  fromSlot: number;
  toSlot: number;
  enterFrame: number;
};

export const complexRelationRenderEdges = (
  scene: DirectorScene,
  fps: number,
): ComplexRelationRenderEdge[] => {
  if (scene.type !== 'complex-explanation') {
    return directorModelError('DIRECTOR_RUNTIME_SCENE_TYPE_INVALID', scene.type);
  }
  assertComplexVisualRoleOrder(scene);
  const groups = scene.objectGroups ?? [];
  return sceneRelationEdges(scene).map((edge) => {
    const fromGroup = groups.find((group) => group.id === edge.fromGroupId);
    const toGroup = groups.find((group) => group.id === edge.toGroupId);
    if (!fromGroup || !toGroup) {
      return directorModelError(
        'DIRECTOR_RUNTIME_RELATION_ENDPOINT_UNKNOWN',
        `${scene.id}:${edge.from}->${edge.to}`,
      );
    }
    return {
      ...edge,
      fromSlot: complexLayoutSlotForGroup(scene, fromGroup.id),
      toSlot: complexLayoutSlotForGroup(scene, toGroup.id),
      enterFrame:
        Math.max(groupEnterFrame(scene, fromGroup, fps), groupEnterFrame(scene, toGroup, fps)) +
        DIRECTOR_ANIMATION_FRAMES.twineDelay,
    };
  });
};

const renderPlanError = (code: string, detail?: string): never =>
  directorModelError(code, detail);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);

const isAbsoluteFilesystemPath = (value: unknown): value is string =>
  isNonEmptyString(value) && (value.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(value));

const isSafeStaticFileName = (value: unknown): value is string =>
  isNonEmptyString(value) &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/') &&
  !value.includes('\\');

export const SUPERVISOR_A_COMPLETION_LOCK_MINIMUM_FRAMES = 10;
export const SUPERVISOR_A_COMPLETION_TERMINAL_FRAME = 463;
export const SUPERVISOR_A_COMPLETION_END_EXCLUSIVE_FRAME = 473;
export const SUPERVISOR_A_COMPLETION_TERMINAL_STATE_SHA256 =
  '1b99b7c02f026038ca63f85596b56cb93b4ffcd532b0848175a3cd3bd020a290';

const SUPERVISOR_A_COMPLETION_ACCEPTANCE_BINDINGS = Object.freeze([
  [
    'authority-receipt',
    'supervisor-a-independent-acceptance',
    'supervisor-a-independent-acceptance.v1.json',
    'b5c7fca2fc0e368e34b80dc0f3684ec71674b934850a5f8b7ea0a88ad537a0bc',
  ],
  [
    'supervisor-independent-review',
    'supervisor-a-independent-acceptance-machine',
    'supervisor-a-independent-machine-review.v1.json',
    '26cf40a6ad66b9ab3203e02421d74545f76f9ef8fb49d435ed3a8a6260314a83',
  ],
  [
    'supervisor-independent-review',
    'supervisor-a-independent-acceptance-visual',
    'supervisor-a-independent-visual-review.v1.json',
    '4721a223be6813d1680e370dad4d1c5e43e85f85bc053e029b08dcd4e4e492af',
  ],
] as const);

const SUPERVISOR_A_COMPLETION_FRAMES = Object.freeze([
  0, 12, 24, 60, 96, 126, 165, 204, 243, 285, 318, 351, 376, 414, 432, 450, 463,
]);

const normalizedPortablePath = (value: string) => value.replace(/\\/gu, '/');

const portableDirectoryName = (value: string) => {
  const normalized = normalizedPortablePath(value);
  const separator = normalized.lastIndexOf('/');
  return separator > 0 ? normalized.slice(0, separator) : '';
};

const portableBaseName = (value: string) => {
  const normalized = normalizedPortablePath(value);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
};

const exactCompletionBinding = (
  bindings: unknown[],
  role: string,
  id: string,
): Record<string, unknown> | null => {
  const matches = bindings.filter((binding) =>
    isRecord(binding) && binding.role === role && binding.id === id);
  return matches.length === 1 ? matches[0] as Record<string, unknown> : null;
};

const hasExactSupervisorACompletionAcceptanceBindings = (
  context: DirectorCompletionLockContext,
) => {
  if (
    context.executionMode !== 'renderable' ||
    context.durationSeconds !== 30 ||
    !isNonEmptyString(context.requestPath) ||
    !Array.isArray(context.fileBindings)
  ) return false;
  const requestDirectory = portableDirectoryName(context.requestPath);
  if (!requestDirectory) return false;
  for (const [role, id, fileName, sha256] of SUPERVISOR_A_COMPLETION_ACCEPTANCE_BINDINGS) {
    const binding = exactCompletionBinding(context.fileBindings, role, id);
    if (
      !binding ||
      !isNonEmptyString(binding.path) ||
      binding.sha256 !== sha256 ||
      normalizedPortablePath(binding.path) !== `${requestDirectory}/${fileName}`
    ) return false;
  }
  const registryActual = exactCompletionBinding(
    context.fileBindings,
    'supervisor-acceptance-anchor-registry-integrity',
    'actual',
  );
  const registryExpected = exactCompletionBinding(
    context.fileBindings,
    'supervisor-acceptance-anchor-registry-integrity',
    'external-expected',
  );
  return Boolean(
    registryActual &&
    registryExpected &&
    isNonEmptyString(registryActual.path) &&
    isSha256(registryActual.sha256) &&
    portableBaseName(registryActual.path) === 'supervisor-acceptance-anchor-registry.v1.json' &&
    registryExpected.path === registryActual.path &&
    registryExpected.sha256 === registryActual.sha256
  );
};

const isCanonicalSupervisorASceneCompletion = (
  scene: DirectorScene,
  fps: number,
  requiredStageIds: string[],
  context: DirectorCompletionLockContext,
) => {
  if (
    fps !== 30 ||
    scene.id !== 'complex-search-workbench' ||
    scene.type !== 'complex-explanation' ||
    Math.abs(scene.start * fps) > 1e-9 ||
    Math.abs(scene.end * fps - SUPERVISOR_A_COMPLETION_END_EXCLUSIVE_FRAME) > 1e-9 ||
    scene.stateReveal?.method !== 'progressive-local-assembly' ||
    !hasExactSupervisorACompletionAcceptanceBindings(context)
  ) return false;
  const expectedStageIds = SUPERVISOR_A_COMPLETION_FRAMES.map(
    (_, index) => `a-stage-a${String(index).padStart(2, '0')}`,
  );
  if (
    !Array.isArray(scene.assemblyStages) ||
    scene.assemblyStages.length !== expectedStageIds.length ||
    requiredStageIds.length !== expectedStageIds.length ||
    requiredStageIds.some((stageId, index) => stageId !== expectedStageIds[index]) ||
    scene.assemblyStages.some((stage, index) => stage.id !== expectedStageIds[index]) ||
    scene.stateReveal.states.length !== SUPERVISOR_A_COMPLETION_FRAMES.length
  ) return false;
  const statesMatch = scene.stateReveal.states.every((state, index) => {
    const suffix = String(index).padStart(2, '0');
    return (
      state.id === `a-state-a${suffix}` &&
      state.stageId === `a-stage-a${suffix}` &&
      state.atFrame === SUPERVISOR_A_COMPLETION_FRAMES[index] &&
      state.assetId === (index === 16 ? 'a-cost-complete' : `a-progressive-a${suffix}`)
    );
  });
  if (!statesMatch) return false;
  const visualStateAssets = Array.isArray(context.visualStateAssets)
    ? context.visualStateAssets
    : [];
  const terminalAssets = visualStateAssets.filter((asset) =>
    isRecord(asset) && asset.id === 'a-cost-complete');
  if (terminalAssets.length !== 1) return false;
  const terminalAsset = terminalAssets[0] as Record<string, unknown>;
  const terminalBinding = exactCompletionBinding(
    context.fileBindings as unknown[],
    'visual-state',
    'a-cost-complete',
  );
  return Boolean(
    terminalBinding &&
    terminalAsset.role === 'revealed-state' &&
    terminalAsset.sha256 === SUPERVISOR_A_COMPLETION_TERMINAL_STATE_SHA256 &&
    terminalBinding.sha256 === terminalAsset.sha256 &&
    terminalBinding.path === terminalAsset.path
  );
};

export const sceneCompletionMinimumLockFrames = (
  scene: DirectorScene,
  fps: number,
  requiredStageIds: string[],
  context: DirectorCompletionLockContext = {},
) => isCanonicalSupervisorASceneCompletion(scene, fps, requiredStageIds, context)
  ? SUPERVISOR_A_COMPLETION_LOCK_MINIMUM_FRAMES
  : fps;

export const lockedSceneCompletionWindow = (
  scene: DirectorScene,
  fps: number,
  requiredStageIds: string[],
  context: DirectorCompletionLockContext = {},
) => {
  const minimumLockFrames = sceneCompletionMinimumLockFrames(
    scene,
    fps,
    requiredStageIds,
    context,
  );
  const completion = sceneCompletionWindow(
    scene,
    fps,
    requiredStageIds,
    minimumLockFrames,
  );
  if (completion.availableSettledFrames < minimumLockFrames) {
    return directorModelError('DIRECTOR_SCENE_COMPLETION_LOCK_INSUFFICIENT', scene.id);
  }
  return completion;
};

const completionWindowMatches = (
  actual: unknown,
  expected: DirectorCompletionWindow,
) => {
  if (!isRecord(actual)) return false;
  return (
    actual.model === expected.model &&
    Array.isArray(actual.requiredStageIds) &&
    actual.requiredStageIds.length === expected.requiredStageIds.length &&
    actual.requiredStageIds.every((id, index) => id === expected.requiredStageIds[index]) &&
    actual.actualCompletionFrame === expected.actualCompletionFrame &&
    actual.lockEndExclusiveFrame === expected.lockEndExclusiveFrame &&
    actual.availableSettledFrames === expected.availableSettledFrames &&
    actual.minimumLockFrames === expected.minimumLockFrames &&
    Array.isArray(actual.criticalContributorIds) &&
    actual.criticalContributorIds.length === expected.criticalContributorIds.length &&
    actual.criticalContributorIds.every((id, index) => id === expected.criticalContributorIds[index])
  );
};

const validateTimeline = (
  items: unknown[],
  durationSeconds: number,
  code: string,
) => {
  let cursor = 0;
  for (const value of items) {
    if (
      !isRecord(value) ||
      !isFiniteNumber(value.start) ||
      !isFiniteNumber(value.end) ||
      Math.abs(value.start - cursor) > 1e-3 ||
      value.end <= value.start
    ) return renderPlanError(code);
    cursor = value.end;
  }
  if (Math.abs(cursor - durationSeconds) > 1e-3) return renderPlanError(code);
};

export const validateDirectorPlanStructure = (input: unknown): DirectorPlan => {
  const candidate =
    input && typeof input === 'object' && 'plan' in input
      ? (input as {plan?: unknown}).plan
      : input;
  if (!isRecord(candidate)) {
    return renderPlanError('DIRECTOR_RENDER_PLAN_REQUIRED');
  }
  const plan = candidate as unknown as DirectorPlan;
  const completionLockContext: DirectorCompletionLockContext = {
    executionMode: isNonEmptyString(candidate.executionMode)
      ? candidate.executionMode
      : undefined,
    durationSeconds: isRecord(candidate.render) && isFiniteNumber(candidate.render.durationSeconds)
      ? candidate.render.durationSeconds
      : undefined,
    requestPath: isRecord(candidate.provenance) && isNonEmptyString(candidate.provenance.requestPath)
      ? candidate.provenance.requestPath
      : undefined,
    fileBindings: isRecord(candidate.provenance)
      ? candidate.provenance.fileBindings
      : undefined,
    visualStateAssets: isRecord(candidate.media)
      ? candidate.media.visualStateAssets
      : undefined,
  };
  if (
    candidate.schemaVersion !== 'koubo-director-output/v1' ||
    !isNonEmptyString(candidate.requestId) ||
    candidate.status !== 'candidate-awaiting-visible-review' ||
    candidate.productionEligible !== false ||
    (candidate.executionMode !== 'renderable' && candidate.executionMode !== 'plan-only')
  ) return renderPlanError('DIRECTOR_RENDER_PLAN_HEADER_INVALID');
  if (
    !isRecord(candidate.render) ||
    !Number.isInteger(candidate.render.width) || Number(candidate.render.width) <= 0 ||
    !Number.isInteger(candidate.render.height) || Number(candidate.render.height) <= 0 ||
    !Number.isInteger(candidate.render.fps) || Number(candidate.render.fps) <= 0 ||
    !isFiniteNumber(candidate.render.durationSeconds) || candidate.render.durationSeconds <= 0 ||
    !Number.isInteger(candidate.render.durationInFrames) || Number(candidate.render.durationInFrames) <= 0 ||
    candidate.render.durationInFrames !== Math.round(candidate.render.durationSeconds * candidate.render.fps) ||
    !isAbsoluteFilesystemPath(candidate.render.publicDir)
  ) {
    return renderPlanError(
      isRecord(candidate.render) &&
        isNonEmptyString(candidate.render.publicDir) &&
        !isAbsoluteFilesystemPath(candidate.render.publicDir)
        ? 'DIRECTOR_PUBLIC_DIR_NOT_ABSOLUTE'
        : 'DIRECTOR_RENDER_PLAN_RENDER_REQUIRED',
    );
  }
  if (candidate.executionMode === 'renderable' && Math.abs(Number(candidate.render.durationSeconds) - 30) > 1e-6) {
    return renderPlanError('DIRECTOR_RENDERABLE_DURATION_NOT_EXACT_30');
  }
  if (
    !Array.isArray(candidate.scenes) ||
    candidate.scenes.length === 0 ||
    candidate.scenes.some((scene) =>
      !isRecord(scene) ||
      !isNonEmptyString(scene.id) ||
      (scene.type !== 'complex-explanation' && scene.type !== 'mechanical-causality' && scene.type !== 'occluded-state-reveal') ||
      !isFiniteNumber(scene.start) ||
      !isFiniteNumber(scene.end) ||
      scene.start < 0 ||
      scene.end <= scene.start ||
      !isNonEmptyString(scene.spokenLine) ||
      !isNonEmptyString(scene.cognitiveIncrement) ||
      !isNonEmptyString(scene.camera) ||
      !Number.isInteger(scene.layers) || Number(scene.layers) < 3 ||
      !Array.isArray(scene.assemblyStages) || scene.assemblyStages.length < 3 ||
      !Array.isArray(scene.objectGroups) || scene.objectGroups.length < 3 ||
      !Array.isArray(scene.nodes) || scene.nodes.length < 3 ||
      !Array.isArray(scene.relations) || scene.relations.length === 0 ||
      !Array.isArray(scene.screenPlacements))
  ) {
    return renderPlanError('DIRECTOR_RENDER_PLAN_SCENES_REQUIRED');
  }
  validateTimeline(candidate.scenes, candidate.render.durationSeconds, 'DIRECTOR_RENDER_PLAN_SCENES_REQUIRED');
  for (const value of candidate.scenes) {
    const scene = value as unknown as DirectorScene;
    if ((scene.assemblyStages ?? []).some((stage) =>
      !isNonEmptyString(stage.id) ||
      !isFiniteNumber(stage.atSeconds) ||
      stage.atSeconds < scene.start ||
      stage.atSeconds >= scene.end ||
      !isNonEmptyString(stage.action) ||
      !Array.isArray(stage.targetIds) ||
      stage.targetIds.length === 0 ||
      stage.targetIds.some((id) => !isNonEmptyString(id)))) {
      return renderPlanError('DIRECTOR_RENDER_PLAN_SCENE_STAGE_INVALID', scene.id);
    }
    if ((scene.objectGroups ?? []).some((group) =>
      !isNonEmptyString(group.id) ||
      !isNonEmptyString(group.label) ||
      !isNonEmptyString(group.material) ||
      !isNonEmptyString(group.visualPrimitive) ||
      !DIRECTOR_VISUAL_PRIMITIVE_SET.has(group.visualPrimitive) ||
      !isNonEmptyString(group.visualRole) ||
      !DIRECTOR_VISUAL_ROLE_SET.has(group.visualRole) ||
      !Array.isArray(group.nodeIds) || group.nodeIds.length === 0 ||
      group.nodeIds.some((id) => !isNonEmptyString(id)) ||
      !isRecord((group as unknown as Record<string, unknown>).metadata))) {
      return renderPlanError('DIRECTOR_RENDER_PLAN_SCENE_GROUP_INVALID', scene.id);
    }
    if ((scene.nodes ?? []).some((node) =>
      !isNonEmptyString(node.id) ||
      !isNonEmptyString(node.label) ||
      !isNonEmptyString(node.role) ||
      !isNonEmptyString(node.visualRole) ||
      !DIRECTOR_VISUAL_ROLE_SET.has(node.visualRole) ||
      !isNonEmptyString(node.groupId) ||
      !isRecord((node as unknown as Record<string, unknown>).metadata))) {
      return renderPlanError('DIRECTOR_RENDER_PLAN_SCENE_NODE_INVALID', scene.id);
    }
    if ((scene.relations ?? []).some((relation) =>
      !isNonEmptyString(relation.from) || !isNonEmptyString(relation.to))) {
      return renderPlanError('DIRECTOR_RENDER_PLAN_RELATION_INVALID', scene.id);
    }
    if ((scene.screenPlacements ?? []).some((placement) =>
      !isNonEmptyString(placement.id) ||
      !Array.isArray(placement.clipIds) || placement.clipIds.length === 0 ||
      placement.clipIds.some((id) => !isNonEmptyString(id)) ||
      !isNonEmptyString(placement.parentGroupId) ||
      !isFiniteNumber(placement.visibleFrom) ||
      !isFiniteNumber(placement.visibleTo) ||
      placement.visibleFrom < scene.start ||
      placement.visibleTo > scene.end ||
      placement.visibleTo <= placement.visibleFrom)) {
      return renderPlanError('DIRECTOR_RENDER_PLAN_SCREEN_PLACEMENT_INVALID', scene.id);
    }
    assertDirectorVisualCapabilitySlots(scene);
    if (scene.type === 'mechanical-causality') {
      if (
        !isRecord(scene.mechanism) ||
        !isNonEmptyString(scene.mechanism.inputNodeId) ||
        !isNonEmptyString(scene.mechanism.actionNodeId) ||
        !Array.isArray(scene.mechanism.outputNodeIds) ||
        scene.mechanism.outputNodeIds.length === 0 ||
        scene.mechanism.outputNodeIds.some((id) => !isNonEmptyString(id))
      ) {
        return renderPlanError('DIRECTOR_RENDER_PLAN_MECHANISM_REQUIRED', scene.id);
      }
      if (scene.stateReveal) {
        return renderPlanError('DIRECTOR_RENDER_PLAN_STATE_REVEAL_FORBIDDEN', scene.id);
      }
    } else if (scene.type === 'occluded-state-reveal') {
      if (scene.mechanism) {
        return renderPlanError('DIRECTOR_RENDER_PLAN_MECHANISM_FORBIDDEN', scene.id);
      }
      assertStateRevealSchedule(scene, plan.render.fps);
    } else if (scene.stateReveal) {
      assertStateRevealSchedule(scene, plan.render.fps);
    }
    sceneRelationEdges(scene);
    const allStageIds = (scene.assemblyStages ?? []).map((stage) => stage.id);
    const expectedCompletion = lockedSceneCompletionWindow(
      scene,
      plan.render.fps,
      allStageIds,
      completionLockContext,
    );
    if (!completionWindowMatches(scene.completion, expectedCompletion)) {
      return renderPlanError('DIRECTOR_RENDER_PLAN_SCENE_COMPLETION_INVALID', scene.id);
    }
  }
  const media = candidate.media;
  const spoken = isRecord(media) ? media.spoken : null;
  if (
    !isRecord(spoken) ||
    !isNonEmptyString(spoken.staticFileName) ||
    !isFiniteNumber(spoken.sourceIn) ||
    !isFiniteNumber(spoken.sourceOut) ||
    spoken.sourceIn < 0 ||
    spoken.sourceOut <= spoken.sourceIn ||
    !isNonEmptyString(spoken.path) ||
    !isSha256(spoken.sha256) ||
    !isRecord(spoken.authoritativeOriginal) ||
    !isNonEmptyString(spoken.authoritativeOriginal.path) ||
    !isSha256(spoken.authoritativeOriginal.sha256) ||
    Math.abs(spoken.sourceOut - spoken.sourceIn - candidate.render.durationSeconds) > 1e-3
  ) {
    return renderPlanError('DIRECTOR_RENDER_PLAN_MEDIA_SPOKEN_REQUIRED');
  }
  if (
    !isRecord(media) ||
    !Array.isArray(media.screenClips) ||
    !Array.isArray(media.screenExcludedRanges) ||
    !Array.isArray(media.sfx) ||
    (media.visualStateAssets !== undefined && !Array.isArray(media.visualStateAssets))
  ) return renderPlanError('DIRECTOR_RENDER_PLAN_MEDIA_REQUIRED');

  const visualStateAssets = Array.isArray(media.visualStateAssets)
    ? media.visualStateAssets
    : [];
  const visualStateAssetIds = new Set<string>();
  for (const asset of visualStateAssets) {
    if (
      !isRecord(asset) ||
      !isNonEmptyString(asset.id) || visualStateAssetIds.has(asset.id) ||
      !isAbsoluteFilesystemPath(asset.path) ||
      !isSafeStaticFileName(asset.staticFileName) ||
      !isSha256(asset.sha256) ||
      !['base-state', 'revealed-state', 'occluder', 'motion-pose'].includes(String(asset.role))
    ) return renderPlanError('DIRECTOR_RENDER_PLAN_VISUAL_STATE_ASSET_INVALID');
    visualStateAssetIds.add(asset.id);
  }
  for (const scene of candidate.scenes as unknown as DirectorScene[]) {
    if (!scene.stateReveal) continue;
    const reveal = assertStateRevealSchedule(scene, plan.render.fps);
    if (reveal.method === 'fully-occluded-hard-cut') {
      const occluder = visualStateAssets.find((asset) => asset.id === reveal.occluderAssetId);
      if (!occluder || occluder.role !== 'occluder') {
        return renderPlanError('DIRECTOR_RENDER_PLAN_OCCLUDER_ASSET_MISSING', scene.id);
      }
    }
    for (const state of reveal.states) {
      const asset = visualStateAssets.find((candidateAsset) => candidateAsset.id === state.assetId);
      if (!asset || !['base-state', 'revealed-state'].includes(asset.role)) {
        return renderPlanError('DIRECTOR_RENDER_PLAN_STATE_ASSET_MISSING', `${scene.id}:${state.assetId}`);
      }
      if (reveal.method === 'progressive-local-assembly') {
        const localMotion = (
          state as DirectorProgressiveLocalAssemblyStateReveal['states'][number]
        ).localMotion;
        if (localMotion.model !== 'authored-local-stop-motion/v1') continue;
        for (const poseAssetId of localMotion.poseAssetIds) {
          const poseAsset = visualStateAssets.find(
            (candidateAsset) => candidateAsset.id === poseAssetId,
          );
          if (!poseAsset || poseAsset.role !== 'motion-pose') {
            return renderPlanError(
              'DIRECTOR_RENDER_PLAN_MOTION_POSE_ASSET_MISSING',
              `${scene.id}:${poseAssetId}`,
            );
          }
        }
      }
    }
  }
  for (const value of media.screenExcludedRanges) {
    if (!isRecord(value) || !isFiniteNumber(value.sourceIn) || !isFiniteNumber(value.sourceOut) || value.sourceOut <= value.sourceIn || !isNonEmptyString(value.reason)) {
      return renderPlanError('DIRECTOR_RENDER_PLAN_SCREEN_EXCLUDED_RANGE_INVALID');
    }
  }
  for (const value of media.screenClips) {
    if (
      !isRecord(value) ||
      !isNonEmptyString(value.id) ||
      !isNonEmptyString(value.path) ||
      !isNonEmptyString(value.staticFileName) ||
      !isSha256(value.sha256) ||
      !isNonEmptyString(value.semanticClaim) ||
      !isFiniteNumber(value.sourceIn) ||
      !isFiniteNumber(value.sourceOut) ||
      !isFiniteNumber(value.outputIn) ||
      !isFiniteNumber(value.outputOut) ||
      !Number.isInteger(value.trimBeforeFrame) ||
      !Number.isInteger(value.trimAfterFrame) ||
      !Number.isInteger(value.outputInFrame) ||
      !Number.isInteger(value.outputOutFrame) ||
      !isFiniteNumber(value.playbackRate) ||
      !isNonEmptyString(value.placementId)
    ) return renderPlanError('DIRECTOR_RENDER_PLAN_SCREEN_CLIP_INVALID');
    validateScreenClipFrameLifecycle(
      value as unknown as NonNullable<DirectorMedia['screenClips']>[number],
      media.screenExcludedRanges as NonNullable<DirectorMedia['screenExcludedRanges']>,
      plan.render.fps,
    );
  }
  if (plan.executionMode === 'renderable' && media.sfx.length === 0) {
    return renderPlanError('DIRECTOR_RENDER_PLAN_SFX_REQUIRED');
  }
  const sfxIds = new Set<string>();
  const cueIds = new Set<string>();
  for (const value of media.sfx) {
    if (
      !isRecord(value) ||
      !isNonEmptyString(value.id) ||
      sfxIds.has(value.id) ||
      !isAbsoluteFilesystemPath(value.path) ||
      !isSafeStaticFileName(value.staticFileName) ||
      !isSha256(value.sha256) ||
      !Array.isArray(value.cues) ||
      value.cues.length === 0
    ) return renderPlanError('DIRECTOR_RENDER_PLAN_SFX_INVALID');
    sfxIds.add(value.id);
    for (const cue of value.cues) {
      if (
        !isRecord(cue) ||
        !isNonEmptyString(cue.id) ||
        cueIds.has(cue.id) ||
        !isFiniteNumber(cue.atSeconds) ||
        cue.atSeconds < 0 ||
        cue.atSeconds >= plan.render.durationSeconds ||
        !isFiniteNumber(cue.volume) ||
        cue.volume < 0 ||
        cue.volume > 1
      ) return renderPlanError('DIRECTOR_RENDER_PLAN_SFX_INVALID', value.id);
      cueIds.add(cue.id);
    }
  }
  if (
    !Array.isArray(candidate.captions) ||
    candidate.captions.length === 0 ||
    candidate.captions.some((caption) =>
      !isRecord(caption) ||
      !isNonEmptyString(caption.id) ||
      !isNonEmptyString(caption.text) ||
      !isFiniteNumber(caption.start) ||
      !isFiniteNumber(caption.end) ||
      caption.start < 0 ||
      caption.end <= caption.start)
  ) {
    return renderPlanError('DIRECTOR_RENDER_PLAN_CAPTIONS_REQUIRED');
  }
  validateTimeline(candidate.captions, candidate.render.durationSeconds, 'DIRECTOR_RENDER_PLAN_CAPTIONS_REQUIRED');
  if (!Array.isArray(candidate.stillPlan) || candidate.stillPlan.length < 3) {
    return renderPlanError('DIRECTOR_RENDER_PLAN_STILLS_REQUIRED');
  }
  for (const value of candidate.stillPlan) {
    if (
      !isRecord(value) ||
      !isNonEmptyString(value.id) ||
      !Number.isInteger(value.frame) ||
      !isNonEmptyString(value.sceneId) ||
      !isNonEmptyString(value.purpose) ||
      !Array.isArray(value.referenceFrameIds) ||
      value.referenceFrameIds.some((id) => !isNonEmptyString(id)) ||
      !Array.isArray(value.requiredStageIds) ||
      value.requiredStageIds.length === 0 ||
      !Number.isInteger(value.minimumSettledFrames)
    ) return renderPlanError('DIRECTOR_RENDER_PLAN_STILLS_REQUIRED');
    const scene = plan.scenes.find((item) => item.id === value.sceneId);
    if (!scene) return renderPlanError('DIRECTOR_RENDER_PLAN_STILL_SCENE_UNKNOWN', value.id);
    const requiredMinimumSettledFrames = sceneCompletionMinimumLockFrames(
      scene,
      plan.render.fps,
      value.requiredStageIds as string[],
      completionLockContext,
    );
    if (value.minimumSettledFrames < requiredMinimumSettledFrames) {
      return renderPlanError('DIRECTOR_RENDER_PLAN_STILLS_REQUIRED');
    }
    const expected = lockedSceneCompletionWindow(
      scene,
      plan.render.fps,
      value.requiredStageIds as string[],
      completionLockContext,
    );
    if (!completionWindowMatches(value.completion, expected)) {
      return renderPlanError('DIRECTOR_RENDER_PLAN_STILL_COMPLETION_INVALID', value.id);
    }
    if (
      expected.availableSettledFrames < value.minimumSettledFrames ||
      value.frame < expected.actualCompletionFrame ||
      value.frame >= expected.lockEndExclusiveFrame
    ) return renderPlanError('DIRECTOR_RENDER_PLAN_STILL_NOT_SETTLED', value.id);
  }
  if (!isRecord(candidate.samplePlan) || !isNonEmptyString(candidate.samplePlan.withSfxComposition) || !isNonEmptyString(candidate.samplePlan.noSfxComposition) || !isNonEmptyString(candidate.samplePlan.stillComposition)) {
    return renderPlanError('DIRECTOR_RENDER_PLAN_SAMPLE_PLAN_REQUIRED');
  }
  if (plan.executionMode === 'plan-only') {
    if (candidate.samplePlan.outputs !== null) return renderPlanError('DIRECTOR_RENDER_PLAN_PLAN_ONLY_OUTPUTS_FORBIDDEN');
    if (
      !Array.isArray(candidate.commands) ||
      candidate.commands.length !== 1 ||
      !isRecord(candidate.commands[0]) ||
      candidate.commands[0].id !== 'validate-plan'
    ) return renderPlanError('DIRECTOR_RENDER_PLAN_PLAN_ONLY_COMMANDS_FORBIDDEN');
  } else {
    if (
      !isRecord(candidate.samplePlan.outputs) ||
      !isNonEmptyString(candidate.samplePlan.outputs.visualMaster) ||
      !isNonEmptyString(candidate.samplePlan.outputs.withSfx) ||
      !isNonEmptyString(candidate.samplePlan.outputs.noSfx) ||
      !isNonEmptyString(candidate.samplePlan.outputs.abQaReceipt) ||
      !isNonEmptyString(candidate.samplePlan.outputs.stillDirectory) ||
      !isNonEmptyString(candidate.samplePlan.outputs.contactSheet)
    ) return renderPlanError('DIRECTOR_RENDER_PLAN_RENDERABLE_OUTPUTS_REQUIRED');
  }
  if (
    !Array.isArray(candidate.commands) ||
    candidate.commands.length === 0 ||
    candidate.commands.some((command) =>
      !isRecord(command) ||
      !isNonEmptyString(command.id) ||
      !isNonEmptyString(command.cwd) ||
      !Array.isArray(command.argv) ||
      command.argv.length < 2 ||
      command.argv.some((part) => !isNonEmptyString(part)))
  ) {
    return renderPlanError('DIRECTOR_RENDER_PLAN_COMMANDS_REQUIRED');
  }
  if (plan.executionMode === 'renderable') {
    const commandIds = new Set(
      (candidate.commands as Array<{id: string}>).map((command) => command.id),
    );
    if (
      !commandIds.has('render-visual-master') ||
      !commandIds.has('package-and-qa-ab') ||
      commandIds.has('render-with-sfx') ||
      commandIds.has('render-no-sfx') ||
      !isRecord(candidate.samplePlan.outputs) ||
      !isNonEmptyString(candidate.samplePlan.outputs.visualMaster) ||
      !isNonEmptyString(candidate.samplePlan.outputs.abQaReceipt)
    ) return renderPlanError('DIRECTOR_RENDER_PLAN_SINGLE_VISUAL_MASTER_TOPOLOGY_INVALID');
    const visualMasterCommand = (candidate.commands as Array<Record<string, unknown>>)
      .find((command) => command.id === 'render-visual-master');
    if (
      !visualMasterCommand ||
      !Array.isArray(visualMasterCommand.argv) ||
      !visualMasterCommand.argv.includes('--muted')
    ) return renderPlanError('DIRECTOR_RENDER_PLAN_VISUAL_MASTER_NOT_MUTED');
  }
  if (
    !isRecord(candidate.chain) ||
    candidate.chain.schemaVersion !== 'koubo-director-chain/v1' ||
    ['requestCanonicalSha256', 'styleSha256', 'referenceSha256', 'authorityTranscriptSha256', 'fileBindingsSha256', 'planPayloadSha256', 'chainSha256']
      .some((key) => !isSha256(candidate.chain[key]))
  ) {
    return renderPlanError('DIRECTOR_RENDER_PLAN_CHAIN_REQUIRED');
  }
  if (
    !isRecord(candidate.provenance) ||
    !isNonEmptyString(candidate.provenance.requestPath) ||
    !isRecord(candidate.provenance.authorityWindowBinding) ||
    !Array.isArray(candidate.provenance.fileBindings) ||
    candidate.provenance.fileBindings.length === 0 ||
    candidate.provenance.fileBindings.some((binding) =>
      !isRecord(binding) ||
      !isNonEmptyString(binding.role) ||
      !isNonEmptyString(binding.id) ||
      !isNonEmptyString(binding.path) ||
      !isSha256(binding.sha256)) ||
    ['requestCanonicalSha256', 'referenceSha256', 'styleSha256', 'authorityTranscriptSha256', 'fileBindingsSha256']
      .some((key) => !isSha256(candidate.provenance[key]))
  ) {
    return renderPlanError('DIRECTOR_RENDER_PLAN_PROVENANCE_REQUIRED');
  }
  return plan;
};

export const validateDirectorRenderPlanInput = (input: unknown): DirectorPlan => {
  const plan = validateDirectorPlanStructure(input);
  if (plan.executionMode !== 'renderable') {
    return renderPlanError('DIRECTOR_RENDER_PLAN_MODE_FORBIDDEN', String(plan.executionMode));
  }
  return plan;
};

export const pickSceneLabel = (scene: DirectorScene, fallback: string) =>
  scene.objectGroups?.find((group) => group.label?.trim())?.label ?? fallback;
