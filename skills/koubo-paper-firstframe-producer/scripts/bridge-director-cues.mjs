#!/usr/bin/env node

import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {
  buildFirstFramePromptManifest,
  buildRunningHubPromptManifest,
  sha256Json,
} from '../../koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {
  DIRECTOR_CUES_SCHEMA,
  validateDirectorCuesFile,
} from '../../koubo-remotion-director/scripts/director-cues-core.mjs';
import {
  isInside,
  parseArgs,
  readJson,
  sha256File,
  validateManifest,
  writeNewJson,
} from './firstframe-batch-core.mjs';

const ACCEPTANCE_SCHEMA = 'koubo-director-cues-user-acceptance/v1';
const SOURCE_PLAN_SCHEMA = 'koubo-director-cues-source-plan/v1';
const SAMPLE_SCOPE = 'one-representative-firstframe';
const SAMPLE_POLICY = 'one-representative-scene';

const text = (value) => typeof value === 'string' && value.trim().length > 0;

const provisionalQuad = (index, count) => {
  const width = Math.min(0.2, 0.72 / Math.max(count, 1));
  const gap = count === 1 ? 0 : (0.72 - width * count) / (count - 1);
  const x = 0.14 + index * (width + gap);
  return [
    [x, 0.12],
    [x + width, 0.12],
    [x + width, 0.2],
    [x, 0.2],
  ];
};

const buildTextPlan = (cue) => cue.textPlan.map((entry, index) => ({
  nodeId: `${cue.id}-N${index + 1}`,
  text: entry.text,
  surfaceDescription: entry.surface,
  groupId: `${cue.id}-G${index + 1}`,
  surfaceId: `${cue.id}-S${index + 1}`,
  embeddingMode: 'first-frame-baked',
  motionConstraint: 'rigid-surface',
  ocrRequired: true,
  anchorQuad: provisionalQuad(index, cue.textPlan.length),
  anchorQuadStatus: 'provisional-placeholder-actual-calibration-required',
}));

const artifact = (filePath) => ({path: filePath, sha256: sha256File(filePath)});

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args['project-root'] || !args.cues || !args.acceptance || !args['output-dir']) {
    throw new Error('CUE_NATIVE_BRIDGE_ARGUMENTS_REQUIRED');
  }

  const projectRoot = path.resolve(args['project-root']);
  const cuesPath = path.resolve(projectRoot, args.cues);
  const acceptancePath = path.resolve(projectRoot, args.acceptance);
  const outputDir = path.resolve(projectRoot, args['output-dir']);
  if (![cuesPath, acceptancePath, outputDir].every((target) => isInside(projectRoot, target))) {
    throw new Error('CUE_NATIVE_BRIDGE_PATH_OUTSIDE_PROJECT');
  }

  const directorValidation = validateDirectorCuesFile({inputPath: cuesPath, projectRoot});
  if (!directorValidation.ok) {
    throw new Error(`CUE_NATIVE_DIRECTOR_CUES_INVALID:${directorValidation.errors.join('|')}`);
  }

  const cues = readJson(cuesPath);
  const acceptance = readJson(acceptancePath);
  const cuesSha256 = sha256File(cuesPath);
  const acceptanceErrors = [];
  if (acceptance.schemaVersion !== ACCEPTANCE_SCHEMA) acceptanceErrors.push('ACCEPTANCE_SCHEMA_INVALID');
  if (acceptance.taskId !== cues.taskId) acceptanceErrors.push('ACCEPTANCE_TASK_MISMATCH');
  if (acceptance.status !== 'approved-for-one-representative-firstframe') {
    acceptanceErrors.push('ACCEPTANCE_STATUS_INVALID');
  }
  if (acceptance.approved !== true) acceptanceErrors.push('ACCEPTANCE_NOT_APPROVED');
  if (acceptance.scope !== SAMPLE_SCOPE) acceptanceErrors.push('ACCEPTANCE_SCOPE_INVALID');
  if (acceptance.cuesSha256 !== cuesSha256) acceptanceErrors.push('ACCEPTANCE_CUES_SHA_MISMATCH');
  if (!text(acceptance.selectedSceneId) || !cues.inserts.some((cue) => cue.id === acceptance.selectedSceneId)) {
    acceptanceErrors.push('ACCEPTANCE_SELECTED_SCENE_UNKNOWN');
  }
  if (!text(acceptance.requestId)) acceptanceErrors.push('ACCEPTANCE_REQUEST_ID_REQUIRED');
  if (!text(acceptance.revisionId)) acceptanceErrors.push('ACCEPTANCE_REVISION_ID_REQUIRED');
  if (!text(acceptance.userConfirmationText)) acceptanceErrors.push('ACCEPTANCE_CONFIRMATION_TEXT_REQUIRED');
  if (!text(acceptance.acceptedAt)) acceptanceErrors.push('ACCEPTANCE_TIME_REQUIRED');
  if (acceptanceErrors.length) {
    throw new Error(`CUE_NATIVE_ACCEPTANCE_INVALID:${acceptanceErrors.join('|')}`);
  }

  const sourcePlan = {
    schemaVersion: SOURCE_PLAN_SCHEMA,
    sourceDirectorSchema: DIRECTOR_CUES_SCHEMA,
    taskId: cues.taskId,
    requestId: acceptance.requestId,
    revisionId: acceptance.revisionId,
    phase: 'pre-shoot',
    status: 'validated-provisional-previsualization',
    formalEligible: false,
    samplePolicy: SAMPLE_POLICY,
    selectedSceneId: acceptance.selectedSceneId,
    policy: {incidentPreventionVersion: '1'},
    sourceDirectorCues: {path: cuesPath, sha256: cuesSha256},
    userAcceptance: {path: acceptancePath, sha256: sha256File(acceptancePath)},
    calibrationPolicy: {
      plannedAnchorQuadsAreProvisional: true,
      actualGeneratedPaperSurfaceCalibrationRequired: true,
      provisionalAnchorsExcludedFromGenerationPrompts: true,
    },
    paperScenes: cues.inserts.map((cue) => ({
      beatId: cue.id,
      title: cue.reason,
      spokenLine: cue.scriptQuote,
      durationSeconds: cue.durationSeconds,
      visualRole: cue.visualRole,
      visualMetaphor: cue.visualMetaphor,
      composition: cue.composition,
      primaryAction: cue.primaryAction,
      prompt: {
        firstFrame: cue.firstFramePrompt,
        motion: cue.videoPrompt,
      },
      textPlan: buildTextPlan(cue),
      screenTextPlan: [],
      negativePrompt: structuredClone(cue.negativePrompt),
      referenceImageIds: structuredClone(cue.referenceImageIds),
    })),
  };

  const firstFrameManifest = {
    ...buildFirstFramePromptManifest(sourcePlan),
    sourceDirectorSchema: DIRECTOR_CUES_SCHEMA,
    samplePolicy: SAMPLE_POLICY,
    selectedSceneId: acceptance.selectedSceneId,
  };
  const runningHubManifest = {
    ...buildRunningHubPromptManifest(sourcePlan),
    sourceDirectorSchema: DIRECTOR_CUES_SCHEMA,
    samplePolicy: SAMPLE_POLICY,
    selectedSceneId: acceptance.selectedSceneId,
    submissionAllowed: false,
  };
  const manifestErrors = validateManifest(firstFrameManifest);
  if (manifestErrors.length > 0) {
    throw new Error(`CUE_NATIVE_FIRSTFRAME_MANIFEST_INVALID:${manifestErrors.join('|')}`);
  }

  // Only after every input and binding has passed validation may a new revision
  // directory be created. Existing output is deliberately never overwritten.
  mkdirSync(outputDir, {recursive: false, mode: 0o700});
  const sourcePlanPath = path.join(outputDir, 'director-cue-native-source-plan.v1.json');
  const firstFrameManifestPath = path.join(outputDir, 'first-frame-prompts.v1.json');
  const runningHubManifestPath = path.join(outputDir, 'runninghub-image-to-video-prompts.v1.json');
  const directorReceiptPath = path.join(outputDir, 'director-validation-receipt.v1.json');
  writeNewJson(sourcePlanPath, sourcePlan);
  writeNewJson(firstFrameManifestPath, firstFrameManifest);
  writeNewJson(runningHubManifestPath, runningHubManifest);

  const receipt = {
    schemaVersion: 'koubo-director-validation-receipt/v1',
    taskId: cues.taskId,
    requestId: acceptance.requestId,
    revisionId: acceptance.revisionId,
    status: 'validated-provisional-previsualization',
    skillExecuted: true,
    validatorExecuted: true,
    sourceDirectorSchema: DIRECTOR_CUES_SCHEMA,
    samplePolicy: SAMPLE_POLICY,
    selectedSceneId: acceptance.selectedSceneId,
    policy: {incidentPreventionVersion: '1'},
    sourcePlanCanonicalSha256: sha256Json(sourcePlan),
    artifacts: {
      directorCues: {path: cuesPath, sha256: cuesSha256},
      userAcceptance: artifact(acceptancePath),
      sourcePlan: artifact(sourcePlanPath),
      firstFramePromptManifest: artifact(firstFrameManifestPath),
      runningHubPromptManifest: artifact(runningHubManifestPath),
    },
  };
  writeNewJson(directorReceiptPath, receipt);

  console.log(JSON.stringify({
    ok: true,
    outputDir,
    selectedSceneId: acceptance.selectedSceneId,
    sourcePlanPath,
    firstFrameManifestPath,
    runningHubManifestPath,
    directorReceiptPath,
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
