#!/usr/bin/env node

import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import Ajv2020 from '../assets/schema-validator-engine.mjs';
import {
  assertComplexVisualRoleOrder,
  assertStateRevealSchedule,
  lockedSceneCompletionWindow,
  sceneCompletionMinimumLockFrames,
  validateDirectorPlanStructure,
  validateScreenClipFrameLifecycle,
} from '../assets/remotion-paper-editorial/style.ts';
import {
  OUTPUT_SCHEMA,
  CONTROLLED_VISUAL_PRIMITIVES,
  CONTROLLED_VISUAL_ROLES,
  VISUAL_PRIMITIVE_CAPABILITIES,
  VISUAL_ROLE_CAPABILITIES,
  compileDirectorPlan,
  consumeCommittedDirectorPlanSnapshot,
  readCommittedDirectorPlanSnapshot,
  revalidateCommittedDirectorPlanSnapshot,
  revalidateExecutionIntegrityAnchors,
  sha256File,
  sha256Text,
  stableStringify,
  validateExecutionIntegrityAnchors,
  validateMotionPoseAssetContract,
  validateRuntimeFileContract,
} from './compile-director-plan.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), '../../..');
const SHA256_RE = /^[a-f0-9]{64}$/;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const EPSILON = 1 / 1000;

function invariant(condition, code, detail) {
  if (!condition) {
    const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
    error.code = code;
    throw error;
  }
}

function parseCommittedDirectorPlanSnapshot(snapshot) {
  let plan;
  try {
    plan = JSON.parse(snapshot.bytes.toString('utf8'));
  } catch (error) {
    invariant(
      false,
      'DIRECTOR_OUTPUT_PUBLICATION_JSON_INVALID',
      `${snapshot.path}:${error.message}`,
    );
  }
  return {...snapshot, plan};
}

export function readCommittedDirectorOutputPlan(planPath) {
  return parseCommittedDirectorPlanSnapshot(
    readCommittedDirectorPlanSnapshot(planPath),
  );
}

export function consumeCommittedDirectorOutputPlan(
  planPath,
  consumer,
  {phase = 'validator-consumer-return'} = {},
) {
  invariant(typeof consumer === 'function', 'DIRECTOR_OUTPUT_CONSUMER_REQUIRED');
  return consumeCommittedDirectorPlanSnapshot(
    planPath,
    (snapshot) => consumer(parseCommittedDirectorPlanSnapshot(snapshot)),
    {phase},
  );
}

export function assertCommittedDirectorOutputPlan(plan, planPath) {
  const snapshot = readCommittedDirectorOutputPlan(planPath);
  invariant(
    stableStringify(snapshot.plan) === stableStringify(plan),
    'DIRECTOR_OUTPUT_PUBLICATION_PLAN_ARGUMENT_MISMATCH',
    planPath,
  );
  return snapshot;
}

export function revalidateCommittedDirectorOutputPlan(snapshot, {
  phase = 'validator-return',
} = {}) {
  return parseCommittedDirectorPlanSnapshot(
    revalidateCommittedDirectorPlanSnapshot(snapshot, {phase}),
  );
}

export function validateDirectorOutputSchemaContract(plan, options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? defaultRepoRoot);
  const schemaPath = path.resolve(
    repoRoot,
    'skills/koubo-remotion-director/templates/director-output.v1.schema.json',
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  let validateSchema;
  try {
    validateSchema = new Ajv2020({allErrors: true, strict: true}).compile(schema);
  } catch (error) {
    invariant(false, 'DIRECTOR_OUTPUT_SCHEMA_COMPILE_INVALID', error.message);
  }
  invariant(
    validateSchema(plan),
    'DIRECTOR_OUTPUT_SCHEMA_INVALID',
    JSON.stringify(validateSchema.errors ?? []),
  );
  validateDirectorPlanStructure(plan);
  return {ok: true, schemaPath};
}

function validateContinuous(items, duration, label) {
  invariant(Array.isArray(items) && items.length > 0, 'DIRECTOR_OUTPUT_TIMELINE_EMPTY', label);
  let cursor = 0;
  for (const item of items) {
    invariant(Number.isFinite(item.start) && Number.isFinite(item.end), 'DIRECTOR_OUTPUT_TIMELINE_NUMBER_INVALID', `${label}:${item.id}`);
    invariant(Math.abs(item.start - cursor) <= EPSILON, 'DIRECTOR_OUTPUT_TIMELINE_GAP_OR_OVERLAP', `${label}:${item.id}`);
    invariant(item.end > item.start, 'DIRECTOR_OUTPUT_TIMELINE_RANGE_INVALID', `${label}:${item.id}`);
    cursor = item.end;
  }
  invariant(Math.abs(cursor - duration) <= EPSILON, 'DIRECTOR_OUTPUT_TIMELINE_COVERAGE_INCOMPLETE', label);
}

function validateStageStructure(scene) {
  const knownTargets = new Set([
    ...scene.objectGroups.map((group) => group.id),
    ...scene.nodes.map((node) => node.id),
  ]);
  const seenTargets = new Set();
  for (let index = 0; index < scene.assemblyStages.length; index += 1) {
    const stage = scene.assemblyStages[index];
    invariant(Number.isFinite(stage.atSeconds) && stage.atSeconds >= scene.start && stage.atSeconds < scene.end, 'DIRECTOR_OUTPUT_STAGE_TIME_INVALID', `${scene.id}:${stage.id}`);
    invariant(Array.isArray(stage.targetIds) && stage.targetIds.length > 0, 'DIRECTOR_OUTPUT_STAGE_TARGETS_EMPTY', `${scene.id}:${stage.id}`);
    invariant(stage.targetIds.every((id) => knownTargets.has(id)), 'DIRECTOR_OUTPUT_STAGE_TARGET_UNKNOWN', `${scene.id}:${stage.id}`);
    for (const targetId of stage.targetIds) {
      invariant(!seenTargets.has(targetId), 'DIRECTOR_OUTPUT_STAGE_TARGET_REUSED', `${scene.id}:${targetId}`);
      seenTargets.add(targetId);
    }
    if (index > 0) {
      invariant(stage.atSeconds > scene.assemblyStages[index - 1].atSeconds + EPSILON, 'DIRECTOR_OUTPUT_STAGE_ORDER_INVALID', `${scene.id}:${stage.id}`);
    }
  }
  for (const group of scene.objectGroups) {
    invariant(
      scene.assemblyStages.some((stage) => stage.targetIds.includes(group.id) || group.nodeIds.some((id) => stage.targetIds.includes(id))),
      'DIRECTOR_OUTPUT_GROUP_STAGE_MISSING',
      `${scene.id}:${group.id}`,
    );
  }
}

function validateControlledVisuals(scene) {
  invariant(scene.objectGroups.every((group) => CONTROLLED_VISUAL_PRIMITIVES.has(group.visualPrimitive)), 'DIRECTOR_OUTPUT_VISUAL_PRIMITIVE_INVALID', scene.id);
  invariant(scene.objectGroups.every((group) => CONTROLLED_VISUAL_ROLES.has(group.visualRole)), 'DIRECTOR_OUTPUT_VISUAL_ROLE_INVALID', scene.id);
  invariant(scene.nodes.every((node) => CONTROLLED_VISUAL_ROLES.has(node.visualRole)), 'DIRECTOR_OUTPUT_VISUAL_ROLE_INVALID', scene.id);
}

function halfOpenRangesOverlap(left, right) {
  return left.sourceIn < right.sourceOut && left.sourceOut > right.sourceIn;
}

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function validateProgressiveLocalMotionContract(scene, plan, visualStateAssets) {
  const reveal = scene?.stateReveal;
  if (reveal?.method !== 'progressive-local-assembly') return {motionPoseIds: []};
  const sceneMotionPoseIds = new Set(
    reveal.states.slice(1).flatMap((state) => state.localMotion?.poseAssetIds ?? []),
  );
  return validateMotionPoseAssetContract({
    assets: visualStateAssets.filter(
      (asset) => asset.role !== 'motion-pose' || sceneMotionPoseIds.has(asset.id),
    ),
    scenes: [scene],
    render: plan?.render,
    resolveAssetPath: (assetPath) => assetPath,
  });
}

function validateCompletionWindow(actual, expected, code, detail) {
  invariant(actual && typeof actual === 'object' && !Array.isArray(actual), code, detail);
  invariant(stableStringify(actual) === stableStringify(expected), code, detail);
  invariant(
    Number.isInteger(expected.minimumLockFrames) &&
      expected.minimumLockFrames > 0 &&
      expected.availableSettledFrames >= expected.minimumLockFrames,
    'DIRECTOR_OUTPUT_COMPLETION_LOCK_INSUFFICIENT',
    detail,
  );
}

function validateRelations(scene) {
  const endpointIds = new Set([
    ...scene.objectGroups.map((group) => group.id),
    ...scene.nodes.map((node) => node.id),
  ]);
  invariant(Array.isArray(scene.relations) && scene.relations.length > 0, 'DIRECTOR_OUTPUT_RELATIONS_REQUIRED', scene.id);
  const seen = new Set();
  for (const relation of scene.relations) {
    invariant(endpointIds.has(relation.from) && endpointIds.has(relation.to), 'DIRECTOR_OUTPUT_RELATION_ENDPOINT_UNKNOWN', `${scene.id}:${relation.from}->${relation.to}`);
    invariant(relation.from !== relation.to, 'DIRECTOR_OUTPUT_RELATION_SELF_LOOP_FORBIDDEN', `${scene.id}:${relation.from}`);
    const key = `${relation.from}\0${relation.to}`;
    invariant(!seen.has(key), 'DIRECTOR_OUTPUT_RELATION_DUPLICATE', `${scene.id}:${relation.from}->${relation.to}`);
    seen.add(key);
  }
}

function validateScreenPlacements(plan) {
  const placements = plan.scenes.flatMap((scene) => (scene.screenPlacements ?? []).map((placement) => ({scene, placement})));
  const placementById = new Map();
  for (const {scene, placement} of placements) {
    invariant(!placementById.has(placement.id), 'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_ID_DUPLICATE', placement.id);
    invariant(Array.isArray(placement.clipIds) && placement.clipIds.length > 0, 'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_CLIPS_EMPTY', placement.id);
    invariant(new Set(placement.clipIds).size === placement.clipIds.length, 'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_CLIP_DUPLICATE', placement.id);
    invariant(scene.objectGroups.some((group) => group.id === placement.parentGroupId), 'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_PARENT_UNKNOWN', placement.id);
    invariant(placement.visibleFrom >= scene.start && placement.visibleTo <= scene.end && placement.visibleTo > placement.visibleFrom, 'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_RANGE_INVALID', placement.id);
    placementById.set(placement.id, {scene, placement});
  }
  for (const clip of plan.media.screenClips) {
    const bound = placementById.get(clip.placementId);
    invariant(bound, 'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_MISSING', clip.id);
    invariant(bound.placement.clipIds.includes(clip.id), 'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_CLIP_NOT_BOUND', clip.id);
    invariant(bound.placement.visibleFrom <= clip.outputIn && bound.placement.visibleTo >= clip.outputOut, 'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_COVERAGE_INCOMPLETE', clip.id);
  }
  const boundClipIds = placements.flatMap(({placement}) => placement.clipIds);
  invariant(boundClipIds.length === plan.media.screenClips.length && new Set(boundClipIds).size === boundClipIds.length, 'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_CLIP_SET_MISMATCH');
}

function validateShape(plan) {
  // This shared runtime validator accepts both renderable and plan-only plans.
  // Render permission remains a separate concern from structural validity.
  validateDirectorPlanStructure(plan);
  invariant(plan && typeof plan === 'object' && !Array.isArray(plan), 'DIRECTOR_OUTPUT_NOT_OBJECT');
  invariant(plan.schemaVersion === OUTPUT_SCHEMA, 'DIRECTOR_OUTPUT_SCHEMA_UNSUPPORTED');
  invariant(plan.status === 'candidate-awaiting-visible-review', 'DIRECTOR_OUTPUT_STATUS_INVALID');
  invariant(plan.productionEligible === false, 'DIRECTOR_OUTPUT_PRODUCTION_ELIGIBLE_FORBIDDEN');
  invariant(plan.executionMode === 'renderable' || plan.executionMode === 'plan-only', 'DIRECTOR_OUTPUT_EXECUTION_MODE_INVALID');
  invariant(Number.isInteger(plan.render?.fps) && plan.render.fps > 0, 'DIRECTOR_OUTPUT_FPS_INVALID');
  invariant(Number.isInteger(plan.render?.width) && Number.isInteger(plan.render?.height), 'DIRECTOR_OUTPUT_DIMENSIONS_INVALID');
  invariant(plan.render.durationSeconds >= 20 && plan.render.durationSeconds <= 30, 'DIRECTOR_OUTPUT_DURATION_INVALID');
  if (plan.executionMode === 'renderable') {
    invariant(Math.abs(plan.render.durationSeconds - 30) <= 1e-6, 'DIRECTOR_RENDERABLE_DURATION_NOT_EXACT_30');
  }
  invariant(plan.render.durationInFrames === Math.round(plan.render.durationSeconds * plan.render.fps), 'DIRECTOR_OUTPUT_FRAME_COUNT_MISMATCH');
  invariant(path.isAbsolute(plan.render.publicDir), 'DIRECTOR_OUTPUT_PUBLIC_DIR_NOT_ABSOLUTE');

  invariant(plan.media?.spoken && SHA256_RE.test(plan.media.spoken.sha256), 'DIRECTOR_OUTPUT_SPOKEN_INVALID');
  invariant(plan.media.spoken.sourceOut > plan.media.spoken.sourceIn, 'DIRECTOR_OUTPUT_SPOKEN_RANGE_INVALID');
  invariant(Array.isArray(plan.media.screenClips), 'DIRECTOR_OUTPUT_SCREEN_CLIPS_INVALID');
  invariant(Array.isArray(plan.media.screenExcludedRanges), 'DIRECTOR_OUTPUT_SCREEN_EXCLUDED_RANGES_INVALID');
  invariant(Array.isArray(plan.media.sfx), 'DIRECTOR_OUTPUT_SFX_INVALID');
  invariant(plan.media.visualStateAssets === undefined || Array.isArray(plan.media.visualStateAssets), 'DIRECTOR_OUTPUT_VISUAL_STATE_ASSETS_INVALID');
  const visualStateAssets = plan.media.visualStateAssets ?? [];
  const visualStateAssetIds = new Set();
  for (const asset of visualStateAssets) {
    invariant(hasExactKeys(asset, ['id', 'path', 'staticFileName', 'sha256', 'role']), 'DIRECTOR_OUTPUT_VISUAL_STATE_ASSET_FIELDS_INVALID', asset.id);
    invariant(typeof asset.id === 'string' && SAFE_ID_RE.test(asset.id), 'DIRECTOR_OUTPUT_VISUAL_STATE_ASSET_ID_INVALID', asset.id);
    invariant(!visualStateAssetIds.has(asset.id), 'DIRECTOR_OUTPUT_VISUAL_STATE_ASSET_ID_DUPLICATE', asset.id);
    visualStateAssetIds.add(asset.id);
    invariant(typeof asset.path === 'string' && path.isAbsolute(asset.path), 'DIRECTOR_OUTPUT_VISUAL_STATE_ASSET_PATH_INVALID', asset.id);
    invariant(typeof asset.staticFileName === 'string' && path.basename(asset.staticFileName) === asset.staticFileName, 'DIRECTOR_OUTPUT_VISUAL_STATE_ASSET_STATIC_FILE_INVALID', asset.id);
    invariant(SHA256_RE.test(asset.sha256), 'DIRECTOR_OUTPUT_VISUAL_STATE_ASSET_SHA_INVALID', asset.id);
    invariant(
      ['base-state', 'revealed-state', 'occluder', 'motion-pose'].includes(asset.role),
      'DIRECTOR_OUTPUT_VISUAL_STATE_ASSET_ROLE_INVALID',
      asset.id,
    );
  }
  for (const range of plan.media.screenExcludedRanges) {
    invariant(Number.isFinite(range.sourceIn) && Number.isFinite(range.sourceOut) && range.sourceOut > range.sourceIn, 'DIRECTOR_OUTPUT_SCREEN_EXCLUDED_RANGE_INVALID');
    invariant(typeof range.reason === 'string' && range.reason.trim().length > 0, 'DIRECTOR_OUTPUT_SCREEN_EXCLUDED_REASON_REQUIRED');
  }
  for (const clip of plan.media.screenClips) {
    invariant(hasExactKeys(clip, ['id', 'path', 'staticFileName', 'sha256', 'sourceIn', 'sourceOut', 'outputIn', 'outputOut', 'representativeTime', 'semanticClaim', 'trimBeforeFrame', 'trimAfterFrame', 'outputInFrame', 'outputOutFrame', 'playbackRate', 'placementId']), 'DIRECTOR_OUTPUT_SCREEN_CLIP_FIELDS_INVALID', clip.id);
    invariant(SAFE_ID_RE.test(clip.id), 'DIRECTOR_OUTPUT_SCREEN_CLIP_ID_INVALID', clip.id);
    invariant(typeof clip.path === 'string' && path.isAbsolute(clip.path), 'DIRECTOR_OUTPUT_SCREEN_PATH_INVALID', clip.id);
    invariant(typeof clip.staticFileName === 'string' && clip.staticFileName.trim().length > 0, 'DIRECTOR_OUTPUT_SCREEN_STATIC_FILE_INVALID', clip.id);
    invariant(clip.sourceOut > clip.sourceIn, 'DIRECTOR_OUTPUT_SCREEN_SOURCE_RANGE_INVALID', clip.id);
    invariant(clip.outputIn >= 0 && clip.outputOut <= plan.render.durationSeconds && clip.outputOut > clip.outputIn, 'DIRECTOR_OUTPUT_SCREEN_OUTPUT_RANGE_INVALID', clip.id);
    invariant(Number.isFinite(clip.representativeTime) && clip.representativeTime >= clip.sourceIn && clip.representativeTime < clip.sourceOut, 'DIRECTOR_OUTPUT_SCREEN_REPRESENTATIVE_TIME_INVALID', clip.id);
    invariant(SHA256_RE.test(clip.sha256), 'DIRECTOR_OUTPUT_SCREEN_SHA_INVALID', clip.id);
    invariant(!plan.media.screenExcludedRanges.some((range) => halfOpenRangesOverlap(clip, range)), 'DIRECTOR_OUTPUT_SCREEN_CLIP_EXCLUDED_OVERLAP', clip.id);
    const trimBeforeFrame = Math.round(clip.sourceIn * plan.render.fps);
    const trimAfterFrame = Math.round(clip.sourceOut * plan.render.fps);
    const outputInFrame = Math.round(clip.outputIn * plan.render.fps);
    const outputOutFrame = Math.round(clip.outputOut * plan.render.fps);
    invariant(clip.trimBeforeFrame === trimBeforeFrame && clip.trimAfterFrame === trimAfterFrame, 'DIRECTOR_OUTPUT_SCREEN_TRIM_FRAME_INVALID', clip.id);
    invariant(clip.outputInFrame === outputInFrame && clip.outputOutFrame === outputOutFrame, 'DIRECTOR_OUTPUT_SCREEN_OUTPUT_FRAME_INVALID', clip.id);
    const expectedPlaybackRate = (trimAfterFrame - trimBeforeFrame) / (outputOutFrame - outputInFrame);
    invariant(Number.isFinite(clip.playbackRate) && clip.playbackRate >= 0.45 && clip.playbackRate <= 1.25 && Math.abs(clip.playbackRate - expectedPlaybackRate) <= 1e-12, 'DIRECTOR_OUTPUT_SCREEN_PLAYBACK_RATE_INVALID', clip.id);
    invariant(typeof clip.placementId === 'string' && clip.placementId.length > 0, 'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_ID_INVALID', clip.id);
    validateScreenClipFrameLifecycle(clip, plan.media.screenExcludedRanges, plan.render.fps);
  }
  invariant(new Set(plan.media.screenClips.map((clip) => clip.id)).size === plan.media.screenClips.length, 'DIRECTOR_OUTPUT_SCREEN_CLIP_ID_DUPLICATE');
  const sfxIds = new Set();
  for (const item of plan.media.sfx) {
    invariant(hasExactKeys(item, ['id', 'path', 'staticFileName', 'sha256', 'cues']), 'DIRECTOR_OUTPUT_SFX_FIELDS_INVALID', item.id);
    invariant(typeof item.id === 'string' && SAFE_ID_RE.test(item.id), 'DIRECTOR_OUTPUT_SFX_ID_INVALID', item.id);
    invariant(!sfxIds.has(item.id), 'DIRECTOR_OUTPUT_SFX_ID_DUPLICATE', item.id);
    sfxIds.add(item.id);
    invariant(typeof item.path === 'string' && path.isAbsolute(item.path), 'DIRECTOR_OUTPUT_SFX_PATH_INVALID', item.id);
    invariant(typeof item.staticFileName === 'string' && item.staticFileName.trim().length > 0, 'DIRECTOR_OUTPUT_SFX_STATIC_FILE_INVALID', item.id);
    invariant(SHA256_RE.test(item.sha256), 'DIRECTOR_OUTPUT_SFX_SHA_INVALID', item.id);
    invariant(Array.isArray(item.cues) && item.cues.length > 0, 'DIRECTOR_OUTPUT_SFX_CUES_INVALID', item.id);
    const cueIds = new Set();
    for (const cue of item.cues) {
      invariant(hasExactKeys(cue, ['id', 'atSeconds', 'volume']), 'DIRECTOR_OUTPUT_SFX_CUE_FIELDS_INVALID', `${item.id}:${cue?.id}`);
      invariant(typeof cue.id === 'string' && SAFE_ID_RE.test(cue.id), 'DIRECTOR_OUTPUT_SFX_CUE_ID_INVALID', `${item.id}:${cue?.id}`);
      invariant(!cueIds.has(cue.id), 'DIRECTOR_OUTPUT_SFX_CUE_ID_DUPLICATE', `${item.id}:${cue.id}`);
      cueIds.add(cue.id);
      invariant(Number.isFinite(cue.atSeconds) && cue.atSeconds >= 0 && cue.atSeconds < plan.render.durationSeconds, 'DIRECTOR_OUTPUT_SFX_CUE_OUT_OF_RANGE', `${item.id}:${cue.id}`);
      invariant(Number.isFinite(cue.volume) && cue.volume >= 0 && cue.volume <= 1, 'DIRECTOR_OUTPUT_SFX_VOLUME_INVALID', `${item.id}:${cue.id}`);
    }
  }

  validateContinuous(plan.captions, plan.render.durationSeconds, 'captions');
  validateContinuous(plan.scenes, plan.render.durationSeconds, 'scenes');
  invariant(new Set(plan.captions.map((cue) => cue.id)).size === plan.captions.length, 'DIRECTOR_OUTPUT_CAPTION_ID_DUPLICATE');
  invariant(new Set(plan.scenes.map((scene) => scene.id)).size === plan.scenes.length, 'DIRECTOR_OUTPUT_SCENE_ID_DUPLICATE');

  const complexScenes = plan.scenes.filter((scene) => scene.type === 'complex-explanation');
  const mechanicalScenes = plan.scenes.filter((scene) => scene.type === 'mechanical-causality');
  const occludedScenes = plan.scenes.filter((scene) => scene.type === 'occluded-state-reveal');
  invariant(complexScenes.length >= 1, 'DIRECTOR_OUTPUT_COMPLEX_SCENE_MISSING');
  invariant(mechanicalScenes.length + occludedScenes.length >= 1, 'DIRECTOR_OUTPUT_CAUSAL_SCENE_MISSING');
  const motionPoseContract = validateMotionPoseAssetContract({
    assets: visualStateAssets,
    scenes: plan.scenes,
    render: plan.render,
    resolveAssetPath: (assetPath) => assetPath,
  });
  const consumedMotionPoseIds = new Set(motionPoseContract.motionPoseIds);
  for (const scene of complexScenes) {
    invariant(scene.objectGroups.length >= 5 && scene.objectGroups.length <= 6, 'DIRECTOR_OUTPUT_COMPLEX_GROUP_COUNT_INVALID', scene.id);
    invariant(scene.nodes.length >= 9 && scene.nodes.length <= 13, 'DIRECTOR_OUTPUT_COMPLEX_NODE_COUNT_INVALID', scene.id);
    invariant(scene.layers >= 3, 'DIRECTOR_OUTPUT_COMPLEX_LAYERS_INVALID', scene.id);
    invariant(scene.assemblyStages.length >= 5, 'DIRECTOR_OUTPUT_COMPLEX_STAGES_INVALID', scene.id);
    validateStageStructure(scene);
    validateControlledVisuals(scene);
    validateRelations(scene);
    assertComplexVisualRoleOrder(scene);
    invariant(scene.objectGroups.every((group) => VISUAL_PRIMITIVE_CAPABILITIES.complex.has(group.visualPrimitive)), 'DIRECTOR_OUTPUT_VISUAL_PRIMITIVE_SLOT_INVALID', scene.id);
    invariant(scene.objectGroups.every((group) => VISUAL_ROLE_CAPABILITIES.complex.has(group.visualRole)), 'DIRECTOR_OUTPUT_VISUAL_ROLE_SLOT_INVALID', scene.id);
    if (scene.stateReveal) {
      const reveal = assertStateRevealSchedule(scene, plan.render.fps);
      if (reveal.method === 'fully-occluded-hard-cut') {
        const occluder = visualStateAssets.find((asset) => asset.id === reveal.occluderAssetId);
        invariant(occluder?.role === 'occluder', 'DIRECTOR_OUTPUT_OCCLUDER_ASSET_MISSING', scene.id);
      }
      for (const state of reveal.states) {
        const asset = visualStateAssets.find((candidate) => candidate.id === state.assetId);
        invariant(
          asset && ['base-state', 'revealed-state'].includes(asset.role),
          'DIRECTOR_OUTPUT_STATE_ASSET_MISSING',
          `${scene.id}:${state.assetId}`,
        );
      }
    }
  }
  for (const scene of mechanicalScenes) {
    invariant(scene.layers >= 3, 'DIRECTOR_OUTPUT_MECHANICAL_LAYERS_INVALID', scene.id);
    invariant(scene.mechanism && scene.mechanism.inputNodeId && scene.mechanism.actionNodeId && scene.mechanism.outputNodeIds.length > 0, 'DIRECTOR_OUTPUT_MECHANISM_CORE_INVALID', scene.id);
    invariant(scene.assemblyStages.filter((stage) => stage.action === 'mechanical-action').length === 1, 'DIRECTOR_OUTPUT_MECHANICAL_ACTION_COUNT_INVALID', scene.id);
    const roles = new Map(scene.nodes.map((node) => [node.id, node.role]));
    invariant(roles.get(scene.mechanism.inputNodeId) === 'input', 'DIRECTOR_OUTPUT_MECHANISM_INPUT_INVALID', scene.id);
    invariant(roles.get(scene.mechanism.actionNodeId) === 'mechanical-action', 'DIRECTOR_OUTPUT_MECHANISM_ACTION_INVALID', scene.id);
    invariant(scene.mechanism.outputNodeIds.every((id) => roles.get(id) === 'output'), 'DIRECTOR_OUTPUT_MECHANISM_OUTPUT_INVALID', scene.id);
    validateStageStructure(scene);
    validateControlledVisuals(scene);
    validateRelations(scene);
    for (const nodeId of [scene.mechanism.inputNodeId, scene.mechanism.actionNodeId, ...scene.mechanism.outputNodeIds]) {
      invariant(scene.assemblyStages.some((stage) => stage.targetIds.includes(nodeId)), 'DIRECTOR_OUTPUT_MECHANISM_NODE_STAGE_MISSING', `${scene.id}:${nodeId}`);
    }
    const groupByNode = new Map(scene.objectGroups.flatMap((group) => group.nodeIds.map((id) => [id, group])));
    const inputGroup = groupByNode.get(scene.mechanism.inputNodeId);
    const actionGroup = groupByNode.get(scene.mechanism.actionNodeId);
    const outputGroup = groupByNode.get(scene.mechanism.outputNodeIds[0]);
    invariant(inputGroup && VISUAL_PRIMITIVE_CAPABILITIES.mechanicalInput.has(inputGroup.visualPrimitive), 'DIRECTOR_OUTPUT_VISUAL_PRIMITIVE_SLOT_INVALID', `${scene.id}:input`);
    invariant(actionGroup && VISUAL_PRIMITIVE_CAPABILITIES.mechanicalAction.has(actionGroup.visualPrimitive), 'DIRECTOR_OUTPUT_VISUAL_PRIMITIVE_SLOT_INVALID', `${scene.id}:action`);
    invariant(outputGroup && VISUAL_PRIMITIVE_CAPABILITIES.mechanicalOutput.has(outputGroup.visualPrimitive), 'DIRECTOR_OUTPUT_VISUAL_PRIMITIVE_SLOT_INVALID', `${scene.id}:output`);
    invariant(inputGroup && VISUAL_ROLE_CAPABILITIES.mechanicalInput.has(inputGroup.visualRole), 'DIRECTOR_OUTPUT_VISUAL_ROLE_SLOT_INVALID', `${scene.id}:input`);
    invariant(actionGroup && VISUAL_ROLE_CAPABILITIES.mechanicalAction.has(actionGroup.visualRole), 'DIRECTOR_OUTPUT_VISUAL_ROLE_SLOT_INVALID', `${scene.id}:action`);
    invariant(outputGroup && VISUAL_ROLE_CAPABILITIES.mechanicalOutput.has(outputGroup.visualRole), 'DIRECTOR_OUTPUT_VISUAL_ROLE_SLOT_INVALID', `${scene.id}:output`);
    const coreGroupIds = new Set([inputGroup.id, actionGroup.id, outputGroup.id]);
    const supportGroups = scene.objectGroups.filter((group) => !coreGroupIds.has(group.id));
    invariant(supportGroups.length === 1, 'DIRECTOR_OUTPUT_SUPPORT_GROUP_COUNT_INVALID', scene.id);
    invariant(supportGroups.every((group) => VISUAL_PRIMITIVE_CAPABILITIES.mechanicalSupport.has(group.visualPrimitive)), 'DIRECTOR_OUTPUT_VISUAL_PRIMITIVE_SLOT_INVALID', `${scene.id}:support`);
    invariant(supportGroups.every((group) => VISUAL_ROLE_CAPABILITIES.mechanicalSupport.has(group.visualRole)), 'DIRECTOR_OUTPUT_VISUAL_ROLE_SLOT_INVALID', `${scene.id}:support`);
    invariant(!scene.stateReveal, 'DIRECTOR_OUTPUT_STATE_REVEAL_FORBIDDEN', scene.id);
  }
  for (const scene of occludedScenes) {
    invariant(scene.layers >= 3, 'DIRECTOR_OUTPUT_OCCLUDED_LAYERS_INVALID', scene.id);
    invariant(!scene.mechanism, 'DIRECTOR_OUTPUT_OCCLUDED_MECHANISM_FORBIDDEN', scene.id);
    invariant(!scene.assemblyStages.some((stage) => stage.action === 'mechanical-action'), 'DIRECTOR_STATE_REVEAL_MECHANICAL_CLAIM_FORBIDDEN', scene.id);
    validateStageStructure(scene);
    validateControlledVisuals(scene);
    validateRelations(scene);
    const reveal = assertStateRevealSchedule(scene, plan.render.fps);
    invariant(reveal.method === 'fully-occluded-hard-cut', 'DIRECTOR_OUTPUT_OCCLUDED_METHOD_INVALID', scene.id);
    const occluder = visualStateAssets.find((asset) => asset.id === reveal.occluderAssetId);
    invariant(occluder?.role === 'occluder', 'DIRECTOR_OUTPUT_OCCLUDER_ASSET_MISSING', scene.id);
    for (const state of reveal.states) {
      const asset = visualStateAssets.find((candidate) => candidate.id === state.assetId);
      invariant(
        asset && ['base-state', 'revealed-state'].includes(asset.role),
        'DIRECTOR_OUTPUT_STATE_ASSET_MISSING',
        `${scene.id}:${state.assetId}`,
      );
    }
    const roles = scene.objectGroups.map((group) => group.visualRole);
    invariant(roles.filter((role) => role === 'causal-input').length === 1, 'DIRECTOR_OUTPUT_OCCLUDED_SLOT_INVALID', scene.id);
    invariant(roles.filter((role) => role === 'transition-occluder').length === 1, 'DIRECTOR_OUTPUT_OCCLUDED_SLOT_INVALID', scene.id);
    invariant(roles.filter((role) => role === 'evidence-output').length === 1, 'DIRECTOR_OUTPUT_OCCLUDED_SLOT_INVALID', scene.id);
    invariant(roles.filter((role) => role === 'causal-support').length === 1, 'DIRECTOR_OUTPUT_OCCLUDED_SLOT_INVALID', scene.id);
  }
  for (const asset of visualStateAssets.filter((candidate) => candidate.role === 'motion-pose')) {
    invariant(
      consumedMotionPoseIds.has(asset.id),
      'DIRECTOR_OUTPUT_PROGRESSIVE_LOCAL_MOTION_POSE_ASSET_UNUSED',
      asset.id,
    );
  }

  const completionLockContext = {
    executionMode: plan.executionMode,
    durationSeconds: plan.render.durationSeconds,
    requestPath: plan.provenance?.requestPath,
    fileBindings: plan.provenance?.fileBindings,
    visualStateAssets: plan.media?.visualStateAssets,
  };
  for (const scene of plan.scenes) {
    const allStageIds = scene.assemblyStages.map((stage) => stage.id);
    const expectedCompletion = lockedSceneCompletionWindow(
      scene,
      plan.render.fps,
      allStageIds,
      completionLockContext,
    );
    validateCompletionWindow(scene.completion, expectedCompletion, 'DIRECTOR_OUTPUT_SCENE_COMPLETION_INVALID', scene.id);
  }

  validateScreenPlacements(plan);

  invariant(Array.isArray(plan.stillPlan) && plan.stillPlan.length >= 3, 'DIRECTOR_OUTPUT_STILLS_INSUFFICIENT');
  for (const still of plan.stillPlan) {
    invariant(Number.isInteger(still.frame) && still.frame >= 0 && still.frame < plan.render.durationInFrames, 'DIRECTOR_OUTPUT_STILL_FRAME_INVALID', still.id);
    const scene = plan.scenes.find((item) => item.id === still.sceneId);
    invariant(scene, 'DIRECTOR_OUTPUT_STILL_SCENE_UNKNOWN', still.id);
    const sceneStartFrame = Math.round(scene.start * plan.render.fps);
    const sceneEndFrame = Math.round(scene.end * plan.render.fps);
    invariant(still.frame >= sceneStartFrame && still.frame < sceneEndFrame, 'DIRECTOR_OUTPUT_STILL_OUTSIDE_SCENE', still.id);
    invariant(Array.isArray(still.requiredStageIds) && still.requiredStageIds.length > 0 && new Set(still.requiredStageIds).size === still.requiredStageIds.length, 'DIRECTOR_OUTPUT_STILL_REQUIRED_STAGES_INVALID', still.id);
    const requiredMinimumSettledFrames = sceneCompletionMinimumLockFrames(
      scene,
      plan.render.fps,
      still.requiredStageIds,
      completionLockContext,
    );
    invariant(
      Number.isInteger(still.minimumSettledFrames) &&
        still.minimumSettledFrames >= requiredMinimumSettledFrames,
      'DIRECTOR_OUTPUT_STILL_SETTLED_FRAMES_INSUFFICIENT',
      still.id,
    );
    const expectedCompletion = lockedSceneCompletionWindow(
      scene,
      plan.render.fps,
      still.requiredStageIds,
      completionLockContext,
    );
    validateCompletionWindow(still.completion, expectedCompletion, 'DIRECTOR_OUTPUT_STILL_COMPLETION_INVALID', still.id);
    invariant(expectedCompletion.availableSettledFrames >= still.minimumSettledFrames, 'DIRECTOR_OUTPUT_STILL_SETTLED_FRAMES_INSUFFICIENT', still.id);
    invariant(still.frame >= expectedCompletion.actualCompletionFrame && still.frame < expectedCompletion.lockEndExclusiveFrame, 'DIRECTOR_OUTPUT_STILL_NOT_SETTLED', still.id);
  }
  invariant(plan.samplePlan?.withSfxComposition && plan.samplePlan?.noSfxComposition && plan.samplePlan?.stillComposition, 'DIRECTOR_OUTPUT_COMPOSITIONS_MISSING');
  invariant(plan.samplePlan.withSfxComposition !== plan.samplePlan.noSfxComposition, 'DIRECTOR_OUTPUT_AB_COMPOSITIONS_IDENTICAL');
  const expectedCommandCount = plan.executionMode === 'renderable' ? plan.stillPlan.length + 3 : 1;
  invariant(Array.isArray(plan.commands) && plan.commands.length === expectedCommandCount, 'DIRECTOR_OUTPUT_COMMAND_COUNT_INVALID');
  if (plan.executionMode === 'plan-only') {
    invariant(plan.samplePlan.outputs === null, 'DIRECTOR_OUTPUT_PLAN_ONLY_OUTPUTS_FORBIDDEN');
    invariant(plan.commands.every((command) => command.id === 'validate-plan'), 'DIRECTOR_OUTPUT_PLAN_ONLY_RENDER_COMMAND_FORBIDDEN');
  } else {
    invariant(plan.samplePlan.outputs && typeof plan.samplePlan.outputs === 'object', 'DIRECTOR_OUTPUT_RENDERABLE_OUTPUTS_REQUIRED');
  }
  invariant(new Set(plan.commands.map((command) => command.id)).size === plan.commands.length, 'DIRECTOR_OUTPUT_COMMAND_ID_DUPLICATE');
  for (const command of plan.commands) {
    invariant(path.isAbsolute(command.cwd), 'DIRECTOR_OUTPUT_COMMAND_CWD_NOT_ABSOLUTE', command.id);
    invariant(Array.isArray(command.argv) && command.argv.length >= 2 && command.argv.every((part) => typeof part === 'string' && part.length > 0), 'DIRECTOR_OUTPUT_COMMAND_ARGV_INVALID', command.id);
  }

  invariant(Array.isArray(plan.provenance?.fileBindings) && plan.provenance.fileBindings.length >= 6, 'DIRECTOR_OUTPUT_FILE_BINDINGS_MISSING');
  const authorityWindow = plan.provenance?.authorityWindowBinding;
  invariant(authorityWindow && typeof authorityWindow === 'object', 'DIRECTOR_OUTPUT_AUTHORITY_WINDOW_BINDING_MISSING');
  invariant(Number.isFinite(authorityWindow.start) && Number.isFinite(authorityWindow.end) && authorityWindow.end > authorityWindow.start, 'DIRECTOR_OUTPUT_AUTHORITY_WINDOW_RANGE_INVALID');
  invariant(Math.abs(authorityWindow.start - plan.media.spoken.sourceIn) <= EPSILON, 'DIRECTOR_OUTPUT_AUTHORITY_WINDOW_START_MISMATCH');
  invariant(Math.abs(authorityWindow.end - plan.media.spoken.sourceOut) <= EPSILON, 'DIRECTOR_OUTPUT_AUTHORITY_WINDOW_END_MISMATCH');
  invariant(Number.isFinite(authorityWindow.wordTimeToleranceSeconds) && authorityWindow.wordTimeToleranceSeconds >= 0 && authorityWindow.wordTimeToleranceSeconds <= 0.5, 'DIRECTOR_OUTPUT_AUTHORITY_WINDOW_TOLERANCE_INVALID');
  invariant(Number.isInteger(authorityWindow.wordCount) && authorityWindow.wordCount > 0, 'DIRECTOR_OUTPUT_AUTHORITY_WINDOW_WORD_COUNT_INVALID');
  invariant(SHA256_RE.test(authorityWindow.authorityWindowTextSha256), 'DIRECTOR_OUTPUT_AUTHORITY_WINDOW_TEXT_SHA_INVALID');
  invariant(plan.provenance.fileBindings.every((item) => SHA256_RE.test(item.sha256) && path.isAbsolute(item.path)), 'DIRECTOR_OUTPUT_FILE_BINDING_INVALID');
  invariant(plan.chain?.schemaVersion === 'koubo-director-chain/v1', 'DIRECTOR_OUTPUT_CHAIN_SCHEMA_INVALID');
  for (const key of ['requestCanonicalSha256', 'styleSha256', 'referenceSha256', 'authorityTranscriptSha256', 'fileBindingsSha256', 'planPayloadSha256', 'chainSha256']) {
    invariant(SHA256_RE.test(plan.chain[key]), 'DIRECTOR_OUTPUT_CHAIN_SHA_INVALID', key);
  }
}

function validateChain(plan) {
  const planWithoutChain = structuredClone(plan);
  delete planWithoutChain.chain;
  const actualPayloadSha256 = sha256Text(stableStringify(planWithoutChain));
  invariant(actualPayloadSha256 === plan.chain.planPayloadSha256, 'DIRECTOR_OUTPUT_PAYLOAD_SHA_MISMATCH');
  const chainBase = {...plan.chain};
  delete chainBase.chainSha256;
  invariant(sha256Text(stableStringify(chainBase)) === plan.chain.chainSha256, 'DIRECTOR_OUTPUT_CHAIN_SHA_MISMATCH');
  invariant(plan.chain.requestCanonicalSha256 === plan.provenance.requestCanonicalSha256, 'DIRECTOR_OUTPUT_CHAIN_REQUEST_MISMATCH');
  invariant(plan.chain.styleSha256 === plan.provenance.styleSha256, 'DIRECTOR_OUTPUT_CHAIN_STYLE_MISMATCH');
  invariant(plan.chain.referenceSha256 === plan.provenance.referenceSha256, 'DIRECTOR_OUTPUT_CHAIN_REFERENCE_MISMATCH');
  invariant(plan.chain.authorityTranscriptSha256 === plan.provenance.authorityTranscriptSha256, 'DIRECTOR_OUTPUT_CHAIN_TRANSCRIPT_MISMATCH');
  invariant(plan.chain.fileBindingsSha256 === plan.provenance.fileBindingsSha256, 'DIRECTOR_OUTPUT_CHAIN_BINDINGS_MISMATCH');
}

function validateLiveFileBindings(plan) {
  const sorted = [...plan.provenance.fileBindings].sort((a, b) => `${a.role}\0${a.id}\0${a.path}`.localeCompare(`${b.role}\0${b.id}\0${b.path}`));
  invariant(stableStringify(sorted) === stableStringify(plan.provenance.fileBindings), 'DIRECTOR_OUTPUT_FILE_BINDINGS_ORDER_INVALID');
  invariant(sha256Text(stableStringify(sorted)) === plan.provenance.fileBindingsSha256, 'DIRECTOR_OUTPUT_FILE_BINDINGS_SHA_MISMATCH');
  for (const binding of sorted) {
    invariant(existsSync(binding.path), 'DIRECTOR_OUTPUT_BOUND_FILE_MISSING', `${binding.role}:${binding.id}`);
    invariant(sha256File(binding.path) === binding.sha256, 'DIRECTOR_OUTPUT_BOUND_FILE_SHA_MISMATCH', `${binding.role}:${binding.id}`);
  }
}

export function validateDirectorOutput(plan, options = {}) {
  const request = options.request;
  invariant(request && typeof request === 'object', 'DIRECTOR_OUTPUT_REQUEST_REQUIRED');
  const repoRoot = path.resolve(options.repoRoot ?? request.projectRoot ?? defaultRepoRoot);
  const entryIntegrityAnchors = validateExecutionIntegrityAnchors(request, {repoRoot});
  invariant(
    stableStringify(plan?.provenance?.integrityAnchors) ===
      stableStringify(entryIntegrityAnchors),
    'DIRECTOR_OUTPUT_EXECUTION_INTEGRITY_ANCHORS_MISMATCH',
  );
  validateDirectorOutputSchemaContract(plan, {repoRoot});
  validateShape(plan);
  validateChain(plan);
  validateLiveFileBindings(plan);
  const expectedRuntimeBindings = validateRuntimeFileContract(request, {
    repoRoot,
    render: plan.render,
  });
  const planRuntimeBindings = plan.provenance.fileBindings
    .filter((binding) => binding.role === 'runtime')
    .sort((left, right) => `${left.id}\0${left.path}`.localeCompare(`${right.id}\0${right.path}`));
  invariant(
    stableStringify(planRuntimeBindings) === stableStringify(expectedRuntimeBindings),
    'DIRECTOR_OUTPUT_RUNTIME_BINDINGS_MISMATCH',
  );
  const requestPath = path.resolve(options.requestPath ?? plan.provenance.requestPath);
  const outputPath = path.resolve(options.outputPath ?? plan.commands.find((command) => command.id === 'validate-plan')?.argv.at(-3) ?? '');
  invariant(path.resolve(plan.provenance.requestPath) === requestPath, 'DIRECTOR_OUTPUT_REQUEST_PATH_MISMATCH');
  const expected = compileDirectorPlan(request, {repoRoot, requestPath, outputPath});
  invariant(stableStringify(expected) === stableStringify(plan), 'DIRECTOR_OUTPUT_RECOMPILE_MISMATCH');
  revalidateExecutionIntegrityAnchors(request, {
    repoRoot,
    expectedSnapshot: entryIntegrityAnchors,
    phase: 'validator-return',
  });
  return {
    ok: true,
    requestId: plan.requestId,
    chainSha256: plan.chain.chainSha256,
    sceneCount: plan.scenes.length,
    stillCount: plan.stillPlan.length,
    commandCount: plan.commands.length,
  };
}

function parseCli(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    values[argv[index].slice(2)] = argv[index + 1];
    index += 1;
  }
  invariant(values.plan && values.request, 'DIRECTOR_VALIDATE_USAGE', '--plan <json> --request <json> [--repo-root <path>]');
  return values;
}

async function main() {
  const args = parseCli(process.argv.slice(2));
  const repoRoot = path.resolve(args['repo-root'] ?? defaultRepoRoot);
  const planPath = path.resolve(repoRoot, args.plan);
  const requestPath = path.resolve(repoRoot, args.request);
  const consumption = consumeCommittedDirectorOutputPlan(planPath, ({plan}) => {
    const request = JSON.parse(readFileSync(requestPath, 'utf8'));
    return validateDirectorOutput(plan, {
      request,
      repoRoot,
      requestPath,
      outputPath: planPath,
    });
  }, {
    phase: 'validator-cli-return',
  });
  process.stdout.write(`${JSON.stringify({
    ...consumption.value,
    publicationState: 'committed-revalidated',
    recoveryValidationPerformed: true,
    publicationReceipt: consumption.snapshot.publicationReceipt,
  })}\n`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error.code ?? 'DIRECTOR_VALIDATE_FAILED'}: ${error.message}\n`);
    process.exitCode = 1;
  });
}
