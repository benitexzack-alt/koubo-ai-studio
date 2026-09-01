import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

export const PREPRODUCTION_REQUEST_SCHEMA =
  'koubo-director-preproduction-request/v1';
export const PREPRODUCTION_PLAN_SCHEMA = 'koubo-director-preproduction-plan/v1';
export const DIRECTOR_ROUTE_LOCK_SCHEMA = 'koubo-director-route-lock/v1';

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
    if (isText(node.id)) {
      push(errors, !nodeIds.has(node.id), `PAPER_NODE_ID_DUPLICATE:${beat.id}:${node.id}`);
      nodeIds.add(node.id);
    }
  }

  const stageIds = new Set();
  stages.forEach((stage, index) => {
    push(errors, isText(stage.id), `PAPER_STAGE_ID_MISSING:${beat.id}:${index}`);
    push(errors, stage.order === index + 1, `PAPER_STAGE_ORDER_INVALID:${beat.id}:${index}`);
    push(errors, isText(stage.action), `PAPER_STAGE_ACTION_MISSING:${beat.id}:${index}`);
    push(errors, isText(stage.subject), `PAPER_STAGE_SUBJECT_MISSING:${beat.id}:${index}`);
    push(errors, isText(stage.sfxRole), `PAPER_STAGE_SFX_MISSING:${beat.id}:${index}`);
    if (isText(stage.id)) stageIds.add(stage.id);
  });

  const textByNode = new Map();
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
      stageIds.has(item.enterStageId),
      `PAPER_TEXT_STAGE_UNKNOWN:${beat.id}:${item.nodeId}`,
    );
    push(errors, isText(item.position), `PAPER_TEXT_POSITION_MISSING:${beat.id}:${item.nodeId}`);
    if (isText(item.nodeId)) textByNode.set(item.nodeId, item.text);
  }
  for (const node of nodes) {
    push(
      errors,
      textByNode.get(node.id) === node.label,
      `PAPER_TEXT_NODE_LABEL_MISMATCH:${beat.id}:${node.id}`,
    );
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
    request.policy?.textStrategy === 'remotion-deterministic-overlay',
    'PREPRODUCTION_TEXT_STRATEGY_INVALID',
  );
  push(
    errors,
    request.policy?.generatedReadableTextAllowed === false,
    'PREPRODUCTION_GENERATED_TEXT_NOT_BLOCKED',
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

  const outputPaths = Object.values(request.outputs ?? {});
  push(errors, outputPaths.length === 5, 'PREPRODUCTION_OUTPUT_PATHS_INCOMPLETE');
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
    push(errors, isText(decision.producer), `BEAT_VISUAL_PRODUCER_MISSING:${beat.id}`);
    push(errors, decision.fallback === 'blocked', `BEAT_FALLBACK_NOT_BLOCKED:${beat.id}`);

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
      otherBeatCount: request.beats.length - paperBeats.length - realEvidenceBeats.length,
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
    lines.push(`- 首帧提示词：${scene.prompt.firstFrame}`);
    lines.push(`- 动态提示词：${scene.prompt.motion}`);
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
    });
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}
