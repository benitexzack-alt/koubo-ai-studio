export const R10_FPS = 30;
export const R10_DURATION_IN_FRAMES = 1737;
export const R10_SOURCE_TRIM_BEFORE = 1200;
export const R10_MIN_COMPLEX_ASSEMBLY_BEATS = 5;

export type R10RendererId =
  | 'ContrastLedgerR10'
  | 'OwnerQuestionArchiveR10'
  | 'PaperBusinessPipelineR10'
  | 'VisibilityBridgeR10';

export type R10Action = {
  id: string;
  startFrame: number;
  endFrameExclusive: number;
  sound: null | {
    role: string;
    source: string;
    bindTo: string;
    offsetFrames: number;
    frame: number;
  };
};

export type R10PaperObjectGroup = {
  id: string;
  labelZh: string;
};

export type R10PaperSemanticNode = {
  nodeId: string;
  objectGroupId: string;
  labelZh: string;
  captionId: string;
};

export type R10PaperRuntimeProps = {
  actionLabelsZh: Record<string, string>;
  assemblyBeatIds: string[];
  depthLayers: number;
  objectGroups: R10PaperObjectGroup[];
  semanticNodes: R10PaperSemanticNode[];
};

export type R10Event = {
  id: string;
  beatId: string;
  category: string;
  component: R10RendererId;
  props: Record<string, unknown>;
  firstVisibleFrame: number;
  firstReadableFrame: number;
  semanticSettleFrame: number;
  actionEndFrame: number;
  endFrameExclusive: number;
  actions: R10Action[];
};

export type R10SoundCue = {
  id: string;
  eventId: string;
  actionId: string | null;
  frame: number;
  role: string;
  source: string;
  bindTo: string;
  offsetFrames: number;
  previewStartFrame: number;
  previewEndFrameExclusive: number;
};

export type R10RuntimeTimeline = {
  schemaVersion: number;
  compiler: string;
  timelineId: string;
  videoId: string;
  fps: number;
  durationFrames: number;
  sourceGraph: Array<{role: string; path: string; sha256: string}>;
  sourceGraphSha: string;
  sourceGraphSha256: string;
  events: R10Event[];
  soundCues: R10SoundCue[];
  timelineSha256: string;
};

const rendererByBeat = {
  B05: 'ContrastLedgerR10',
  B06: 'OwnerQuestionArchiveR10',
  B07: 'PaperBusinessPipelineR10',
  B08: 'VisibilityBridgeR10',
} as const satisfies Record<string, R10RendererId>;

const sha256Hex = (message: string) => {
  const bytes = new TextEncoder().encode(message);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  const rotateRight = (value: number, count: number) => (
    (value >>> count) | (value << (32 - count))
  );

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  return [...state].map((value) => value.toString(16).padStart(8, '0')).join('');
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record).sort().map((key) => [key, stableValue(record[key])]),
    );
  }
  return value;
};

const stableJsonSha256 = (value: unknown) => sha256Hex(JSON.stringify(stableValue(value)));

const isFrame = (value: unknown) => Number.isInteger(value);
const isSha = (value: unknown): value is string => (
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
);
const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

export const getR10PaperRuntimeProps = (event: R10Event): R10PaperRuntimeProps => {
  if (event.beatId.toUpperCase() !== 'B07') {
    throw new Error(`R10_RUNTIME_PAPER_PROPS_WRONG_BEAT:${event.beatId}`);
  }
  const props = asRecord(event.props);
  const objectGroups = props?.objectGroups;
  const semanticNodes = props?.semanticNodes;
  const assemblyBeatIds = props?.assemblyBeatIds;
  const actionLabelsZh = asRecord(props?.actionLabelsZh);
  const depthLayers = props?.depthLayers;
  if (
    !Array.isArray(objectGroups)
    || objectGroups.length < 5
    || objectGroups.length > 6
    || !Array.isArray(semanticNodes)
    || semanticNodes.length < 9
    || semanticNodes.length > 13
    || !Array.isArray(assemblyBeatIds)
    || assemblyBeatIds.length < R10_MIN_COMPLEX_ASSEMBLY_BEATS
    || assemblyBeatIds.length > 7
    || !actionLabelsZh
    || !Number.isInteger(depthLayers)
    || (depthLayers as number) < 3
  ) {
    throw new Error('R10_RUNTIME_B07_STRUCTURE_INVALID');
  }

  const groupIds = new Set<string>();
  const groups = objectGroups.map((candidate) => {
    const group = asRecord(candidate);
    if (!group || !isNonEmptyString(group.id) || !isNonEmptyString(group.labelZh)) {
      throw new Error('R10_RUNTIME_B07_OBJECT_GROUP_INVALID');
    }
    if (groupIds.has(group.id)) {
      throw new Error(`R10_RUNTIME_B07_OBJECT_GROUP_DUPLICATE:${group.id}`);
    }
    groupIds.add(group.id);
    return {id: group.id, labelZh: group.labelZh};
  });

  const nodeIds = new Set<string>();
  const nodes = semanticNodes.map((candidate) => {
    const node = asRecord(candidate);
    if (
      !node
      || !isNonEmptyString(node.nodeId)
      || !isNonEmptyString(node.objectGroupId)
      || !isNonEmptyString(node.labelZh)
      || !isNonEmptyString(node.captionId)
    ) {
      throw new Error('R10_RUNTIME_B07_SEMANTIC_NODE_INVALID');
    }
    if (nodeIds.has(node.nodeId)) {
      throw new Error(`R10_RUNTIME_B07_SEMANTIC_NODE_DUPLICATE:${node.nodeId}`);
    }
    if (!groupIds.has(node.objectGroupId)) {
      throw new Error(`R10_RUNTIME_B07_NODE_GROUP_MISSING:${node.nodeId}:${node.objectGroupId}`);
    }
    nodeIds.add(node.nodeId);
    return {
      nodeId: node.nodeId,
      objectGroupId: node.objectGroupId,
      labelZh: node.labelZh,
      captionId: node.captionId,
    };
  });

  const beatIds = assemblyBeatIds.map((beatId) => {
    if (!isNonEmptyString(beatId)) throw new Error('R10_RUNTIME_B07_ASSEMBLY_BEAT_INVALID');
    return beatId;
  });
  if (new Set(beatIds).size !== beatIds.length) {
    throw new Error('R10_RUNTIME_B07_ASSEMBLY_BEAT_DUPLICATE');
  }
  if (
    beatIds.length !== event.actions.length
    || beatIds.some((beatId, index) => beatId !== event.actions[index]?.id)
  ) {
    throw new Error('R10_RUNTIME_B07_ASSEMBLY_ACTION_DRIFT');
  }
  for (const beatId of beatIds) {
    if (!isNonEmptyString(actionLabelsZh[beatId])) {
      throw new Error(`R10_RUNTIME_B07_ACTION_LABEL_MISSING:${beatId}`);
    }
  }

  const paperStructure = asRecord(props?.paperStructure);
  if (
    !paperStructure
    || stableJsonSha256(paperStructure.objectGroups) !== stableJsonSha256(objectGroups)
    || stableJsonSha256(paperStructure.semanticNodes) !== stableJsonSha256(semanticNodes)
    || stableJsonSha256(paperStructure.assemblyBeatIds) !== stableJsonSha256(assemblyBeatIds)
    || paperStructure.depthLayers !== depthLayers
  ) {
    throw new Error('R10_RUNTIME_B07_PAPER_STRUCTURE_DRIFT');
  }

  return {
    actionLabelsZh: actionLabelsZh as Record<string, string>,
    assemblyBeatIds: beatIds,
    depthLayers: depthLayers as number,
    objectGroups: groups,
    semanticNodes: nodes,
  };
};

const assertAction = (event: R10Event, action: R10Action) => {
  if (
    !action.id
    || !isFrame(action.startFrame)
    || !isFrame(action.endFrameExclusive)
    || action.startFrame < event.firstVisibleFrame
    || action.endFrameExclusive <= action.startFrame
    || action.endFrameExclusive > event.actionEndFrame + 1
  ) {
    throw new Error(`R10_RUNTIME_ACTION_RANGE_INVALID:${event.id}:${action.id}`);
  }
};

export const assertR10RuntimeTimeline = (input: unknown): R10RuntimeTimeline => {
  const timeline = input as R10RuntimeTimeline;
  if (
    !timeline
    || timeline.schemaVersion !== 1
    || timeline.fps !== R10_FPS
    || timeline.durationFrames !== R10_DURATION_IN_FRAMES
    || !Array.isArray(timeline.events)
    || !Array.isArray(timeline.soundCues)
    || !isSha(timeline.timelineSha256)
    || !isSha(timeline.sourceGraphSha256)
    || timeline.sourceGraphSha !== timeline.sourceGraphSha256
  ) {
    throw new Error('R10_RUNTIME_TIMELINE_CONTRACT_INVALID');
  }

  const {timelineSha256, ...runtimeTimeline} = timeline;
  if (stableJsonSha256(runtimeTimeline) !== timelineSha256) {
    throw new Error('R10_RUNTIME_TIMELINE_SHA_MISMATCH');
  }
  if (stableJsonSha256(timeline.sourceGraph) !== timeline.sourceGraphSha256) {
    throw new Error('R10_RUNTIME_SOURCE_GRAPH_SHA_MISMATCH');
  }

  if (timeline.events.length !== Object.keys(rendererByBeat).length) {
    throw new Error('R10_RUNTIME_EVENT_COUNT_INVALID');
  }
  const eventIds = new Set<string>();
  for (const event of timeline.events) {
    const beatId = event.beatId.toUpperCase();
    const expectedRenderer = rendererByBeat[beatId as keyof typeof rendererByBeat];
    if (!expectedRenderer || event.component !== expectedRenderer) {
      throw new Error(`R10_RUNTIME_COMPONENT_MISMATCH:${event.beatId}:${event.component}`);
    }
    if (eventIds.has(event.id)) throw new Error(`R10_RUNTIME_EVENT_ID_DUPLICATE:${event.id}`);
    eventIds.add(event.id);
    if (
      !isFrame(event.firstVisibleFrame)
      || !isFrame(event.firstReadableFrame)
      || !isFrame(event.semanticSettleFrame)
      || !isFrame(event.actionEndFrame)
      || !isFrame(event.endFrameExclusive)
      || event.firstVisibleFrame < 0
      || event.firstVisibleFrame > event.firstReadableFrame
      || event.firstReadableFrame > event.semanticSettleFrame
      || event.semanticSettleFrame > event.actionEndFrame
      || event.actionEndFrame >= event.endFrameExclusive
      || event.endFrameExclusive > R10_DURATION_IN_FRAMES
    ) {
      throw new Error(`R10_RUNTIME_EVENT_RANGE_INVALID:${event.id}`);
    }
    if (!Array.isArray(event.actions)) throw new Error(`R10_RUNTIME_ACTIONS_INVALID:${event.id}`);
    const actionIds = new Set<string>();
    let previousEnd = event.firstVisibleFrame;
    for (const action of event.actions) {
      assertAction(event, action);
      if (actionIds.has(action.id)) throw new Error(`R10_RUNTIME_ACTION_ID_DUPLICATE:${event.id}:${action.id}`);
      if (action.startFrame < previousEnd) throw new Error(`R10_RUNTIME_ACTION_OVERLAP:${event.id}:${action.id}`);
      actionIds.add(action.id);
      previousEnd = action.endFrameExclusive;
    }
    if (beatId === 'B07') {
      if (event.actions.length < 6) throw new Error('R10_RUNTIME_B07_ACTIONS_INCOMPLETE');
      if (event.endFrameExclusive - event.actionEndFrame < R10_FPS) {
        throw new Error('R10_RUNTIME_B07_FINAL_HOLD_TOO_SHORT');
      }
      if (event.actions.slice(0, 6).some((action) => action.sound === null)) {
        throw new Error('R10_RUNTIME_B07_ACTION_SOUND_MISSING');
      }
      getR10PaperRuntimeProps(event);
    }
  }

  const cueIds = new Set<string>();
  for (const cue of timeline.soundCues) {
    if (
      !cue.id
      || cueIds.has(cue.id)
      || !eventIds.has(cue.eventId)
      || !isFrame(cue.frame)
      || cue.frame < 0
      || cue.frame >= R10_DURATION_IN_FRAMES
      || !/^sfx\/[a-z0-9][a-z0-9._-]*\.wav$/i.test(cue.source)
    ) {
      throw new Error(`R10_RUNTIME_SOUND_CUE_INVALID:${cue.id}`);
    }
    cueIds.add(cue.id);
  }

  return timeline;
};
