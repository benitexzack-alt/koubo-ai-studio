#!/usr/bin/env node

import {createHash, randomUUID} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  DIRECTOR_CUES_V2_APPROVAL_SCHEMA,
  DIRECTOR_CUES_V2_HANDOFF_RECEIPT_SCHEMA,
  DIRECTOR_CUES_V2_HANDOFF_SCHEMA,
  ROUTE_PROMPT_HANDOFF_SCHEMA,
} from '../../koubo-remotion-director/scripts/director-cues-v2-handoff-core.mjs';
import {sha256Json} from '../../koubo-remotion-director/scripts/preproduction-director-core.mjs';

export const DIRECTOR_CUES_V2_FIRSTFRAME_BRIDGE_SCHEMA =
  'koubo-director-cues-v2-firstframe-bridge/v1';
export const DIRECTOR_CUES_V2_FIRSTFRAME_BRIDGE_RECEIPT_SCHEMA =
  'koubo-director-cues-v2-firstframe-bridge-receipt/v1';
export const FIRSTFRAME_PROMPT_MANIFEST_SCHEMA =
  'koubo-paper-first-frame-prompt-manifest/v1';
export const DIRECTOR_CUES_V2_SCHEMA = 'koubo-director-cues/v2';

const OUTPUT_FILES = Object.freeze({
  manifest: 'first-frame-prompts.v1.json',
  receipt: 'director-cues-v2-firstframe-bridge-receipt.v1.json',
});

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isSha256 = (value) => /^[a-f0-9]{64}$/u.test(String(value ?? ''));
const jsonEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function requireThat(condition, code) {
  if (!condition) throw new Error(code);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    requireThat(token.startsWith('--'), `DIRECTOR_V2_FIRSTFRAME_BRIDGE_UNKNOWN_ARGUMENT:${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    requireThat(value && !value.startsWith('--'), `DIRECTOR_V2_FIRSTFRAME_BRIDGE_ARGUMENT_VALUE_MISSING:${name}`);
    result[name] = value;
    index += 1;
  }
  return result;
}

function normalizeProjectRoot(projectRoot) {
  requireThat(text(projectRoot), 'DIRECTOR_V2_FIRSTFRAME_BRIDGE_PROJECT_ROOT_REQUIRED');
  const root = realpathSync(path.resolve(projectRoot));
  requireThat(statSync(root).isDirectory(), 'DIRECTOR_V2_FIRSTFRAME_BRIDGE_PROJECT_ROOT_INVALID');
  return root;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveExistingFile(root, declaredPath, code) {
  requireThat(text(declaredPath), `${code}_PATH_REQUIRED`);
  const candidate = path.isAbsolute(declaredPath)
    ? path.normalize(declaredPath)
    : path.resolve(root, declaredPath);
  requireThat(existsSync(candidate), `${code}_MISSING_OR_OUTSIDE_PROJECT`);
  const filePath = realpathSync(candidate);
  requireThat(isInside(root, filePath) && statSync(filePath).isFile(), `${code}_NOT_PROJECT_FILE`);
  return filePath;
}

function binding(filePath, bytes = readFileSync(filePath)) {
  return {path: path.resolve(filePath), sha256: sha256(bytes)};
}

function parseJson(bytes, code) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${code}_JSON_INVALID`);
  }
}

function readInputFile(root, declaredPath, code) {
  const filePath = resolveExistingFile(root, declaredPath, code);
  const bytes = readFileSync(filePath);
  return {filePath, bytes, document: parseJson(bytes, code), binding: binding(filePath, bytes)};
}

function readDeclaredBinding(root, declared, code) {
  requireThat(
    declared && typeof declared === 'object' && text(declared.path) && isSha256(declared.sha256),
    `${code}_BINDING_INVALID`,
  );
  const file = readInputFile(root, declared.path, code);
  requireThat(file.binding.sha256 === declared.sha256, `${code}_SHA_MISMATCH`);
  return file;
}

function sameBoundFile(root, declared, actual, code) {
  const bound = readDeclaredBinding(root, declared, code);
  requireThat(
    bound.filePath === actual.filePath && bound.binding.sha256 === actual.binding.sha256,
    `${code}_PATH_OR_SHA_MISMATCH`,
  );
}

function containsForbiddenVideoKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenVideoKey);
  return Object.entries(value).some(([key, child]) =>
    /^(?:primaryAction|videoPrompt|imageToVideoPrompt|motionPrompt|imageToVideoPromptSha256)$/iu.test(key) ||
    containsForbiddenVideoKey(child));
}

function provisionalQuad(index, count) {
  const width = Math.min(0.2, 0.72 / Math.max(count, 1));
  const gap = count === 1 ? 0 : (0.72 - width * count) / (count - 1);
  const x = 0.14 + index * (width + gap);
  return [
    [x, 0.12],
    [x + width, 0.12],
    [x + width, 0.2],
    [x, 0.2],
  ];
}

function buildLabels(item) {
  requireThat(Array.isArray(item.textPlan) && item.textPlan.length > 0,
    `DIRECTOR_V2_FIRSTFRAME_BRIDGE_TEXT_PLAN_EMPTY:${item.id}`);
  return item.textPlan.map((entry, index) => {
    requireThat(text(entry?.text) && [...entry.text].length <= 8,
      `DIRECTOR_V2_FIRSTFRAME_BRIDGE_LABEL_TEXT_INVALID:${item.id}:${index + 1}`);
    requireThat(text(entry?.surface),
      `DIRECTOR_V2_FIRSTFRAME_BRIDGE_LABEL_SURFACE_INVALID:${item.id}:${index + 1}`);
    return {
      nodeId: `${item.id}-N${index + 1}`,
      text: entry.text,
      surfaceDescription: entry.surface,
      groupId: `${item.id}-G${index + 1}`,
      surfaceId: `${item.id}-S${index + 1}`,
      embeddingMode: 'first-frame-baked',
      motionConstraint: 'rigid-surface',
      ocrRequired: true,
      anchorQuad: provisionalQuad(index, item.textPlan.length),
      anchorQuadStatus: 'provisional-placeholder-actual-calibration-required',
    };
  });
}

function buildProductionScene(item, cueItem, semanticBeat) {
  const labels = buildLabels(item);
  const textPlanSha256 = sha256Json({textPlan: labels, screenTextPlan: []});
  const outputFileName = `${item.id}_${item.beatId}_first-frame.png`;
  const bakedOutputFileName = `${item.id}_${item.beatId}_first-frame-text-baked.png`;
  return {
    sceneId: item.id,
    pairId: item.pairId,
    pairSha256: item.pairSha256,
    beatId: item.beatId,
    title: item.reason,
    spokenLine: semanticBeat.scriptQuote,
    aspectRatio: '16:9',
    outputFileName,
    firstFramePrompt: item.prompt,
    firstFramePromptSha256: item.promptSha256,
    textPlanSha256,
    generatedReadableTextAllowed: false,
    modelGeneratedReadableTextAllowed: false,
    deterministicTextBake: {
      enabled: true,
      sourceImageFileName: outputFileName,
      outputImageFileName: bakedOutputFileName,
      textPlanSha256,
      labelsSha256: sha256Json(labels),
      labels,
      ocrRequired: true,
      anchorCalibrationRequired: true,
      plannedAnchorQuadsAreProvisional: true,
      calibratedAnchorField: 'calibratedAnchorQuad',
    },
    postProductionTextOverlay: structuredClone(labels),
    sourceHandoffItem: {
      id: item.id,
      beatId: item.beatId,
      pairId: item.pairId,
      pairSha256: item.pairSha256,
      promptSha256: item.promptSha256,
    },
    sourceCueFirstFramePromptSha256: sha256(cueItem.firstFramePrompt),
  };
}

function validateOfficialFirstFrameBranch({root, masterFile, handoffReceiptFile, paperFile}) {
  const master = masterFile.document;
  const receipt = handoffReceiptFile.document;
  const paper = paperFile.document;

  requireThat(master?.schemaVersion === DIRECTOR_CUES_V2_HANDOFF_SCHEMA,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_MASTER_SCHEMA_INVALID');
  requireThat(master.status === 'local-handoff-ready' && master.executionScope === 'local-handoff-only',
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_MASTER_STATUS_INVALID');
  requireThat(
    master.externalActionsAuthorized === false && master.generationAuthorized === false &&
      master.remotionAuthorized === false && master.publicationAuthorized === false,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_MASTER_AUTHORIZATION_INVALID',
  );
  requireThat(receipt?.schemaVersion === DIRECTOR_CUES_V2_HANDOFF_RECEIPT_SCHEMA,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_HANDOFF_RECEIPT_SCHEMA_INVALID');
  requireThat(
    receipt.status === 'validated-local-handoff' && receipt.skillExecuted === true &&
      receipt.validatorExecuted === true && receipt.externalActionsAuthorized === false &&
      receipt.generationAuthorized === false,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_HANDOFF_RECEIPT_STATUS_INVALID',
  );
  requireThat(
    receipt.taskId === master.taskId && receipt.revisionId === master.revisionId,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_HANDOFF_RECEIPT_IDENTITY_MISMATCH',
  );
  sameBoundFile(root, receipt.handoffMaster, masterFile,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_RECEIPT_MASTER');
  requireThat(jsonEqual(receipt.source, master.source),
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_RECEIPT_SOURCE_MISMATCH');
  requireThat(jsonEqual(receipt.artifacts, master.artifacts),
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_RECEIPT_ARTIFACTS_MISMATCH');

  sameBoundFile(root, master.artifacts?.paperFirstFrame, paperFile,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_MASTER_PAPER_FIRSTFRAME');
  requireThat(
    jsonEqual(master.branches?.paperEditorial?.firstFrameManifest, master.artifacts.paperFirstFrame) &&
      master.branches.paperEditorial.sourceRoute === 'paper-editorial' &&
      master.branches.paperEditorial.downstreamRoute === 'paper-editorial' &&
      master.branches.paperEditorial.status === 'planned',
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_MASTER_PAPER_BRANCH_INVALID',
  );
  requireThat(
    paper?.schemaVersion === ROUTE_PROMPT_HANDOFF_SCHEMA && paper.status === 'planned' &&
      paper.sourceRoute === 'paper-editorial' && paper.downstreamRoute === 'paper-editorial' &&
      paper.promptKind === 'first-frame' &&
      paper.promptIsolation?.containsVideoPromptBodies === false &&
      paper.promptIsolation?.consumer === 'first-frame-stage' &&
      paper.executionScope === 'local-handoff-only' && paper.externalActionsAuthorized === false &&
      paper.generationStarted === false,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_PAPER_HANDOFF_INVALID',
  );
  requireThat(
    paper.taskId === master.taskId && paper.revisionId === master.revisionId &&
      jsonEqual(paper.source, master.source),
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_PAPER_IDENTITY_MISMATCH',
  );
  requireThat(
    Array.isArray(paper.items) && paper.items.length > 0 && paper.itemCount === paper.items.length,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_PAPER_ITEMS_INVALID',
  );
  requireThat(!containsForbiddenVideoKey(paper),
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_VIDEO_FIELD_LEAK');

  const cuesFile = readDeclaredBinding(root, master.source?.directorCues,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_SOURCE_CUES');
  const approvalFile = readDeclaredBinding(root, master.source?.userApproval,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_SOURCE_APPROVAL');
  readDeclaredBinding(root, master.source?.activeDirectorProfile,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_SOURCE_PROFILE');
  const cues = cuesFile.document;
  const approval = approvalFile.document;
  requireThat(cues?.schemaVersion === DIRECTOR_CUES_V2_SCHEMA && cues.taskId === master.taskId,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_SOURCE_CUES_INVALID');
  requireThat(
    approval?.schemaVersion === DIRECTOR_CUES_V2_APPROVAL_SCHEMA && approval.status === 'approved' &&
      approval.approved === true && approval.taskId === master.taskId &&
      approval.revisionId === master.revisionId && Array.isArray(approval.exceptions) &&
      approval.exceptions.length === 0,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_SOURCE_APPROVAL_INVALID',
  );
  sameBoundFile(root, approval.bindings?.directorCues, cuesFile,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_APPROVAL_CUES');

  const cueItems = cues.routePlans?.paperEditorials?.items;
  requireThat(
    cues.routePlans?.paperEditorials?.status === 'planned' && Array.isArray(cueItems) &&
      cueItems.length === paper.items.length,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_SOURCE_PAPER_PLAN_INVALID',
  );
  const semanticBeats = new Map((cues.semanticBeats ?? []).map((beat) => [beat.id, beat]));
  const seenIds = new Set();
  const seenPairs = new Set();
  paper.items.forEach((item, index) => {
    const cueItem = cueItems[index];
    requireThat(
      text(item?.id) && /^P\d{2,}$/u.test(item.id) && !seenIds.has(item.id) &&
        text(item.pairId) && !seenPairs.has(item.pairId) && isSha256(item.pairSha256),
      `DIRECTOR_V2_FIRSTFRAME_BRIDGE_ITEM_IDENTITY_INVALID:${item?.id ?? index}`,
    );
    seenIds.add(item.id);
    seenPairs.add(item.pairId);
    requireThat(
      cueItem?.id === item.id && cueItem.beatId === item.beatId &&
        item.pairId === `${item.id}-prompt-pair-v1` &&
        item.prompt === cueItem.firstFramePrompt && item.promptSha256 === sha256(item.prompt) &&
        jsonEqual(item.textPlan, cueItem.textPlan) &&
        jsonEqual(item.negativePrompt, cueItem.negativePrompt) &&
        semanticBeats.has(item.beatId),
      `DIRECTOR_V2_FIRSTFRAME_BRIDGE_ITEM_CONTENT_MISMATCH:${item.id}`,
    );
  });

  return {master, receipt, paper, cues, approval, cuesFile, approvalFile, semanticBeats};
}

function buildBridgeDocuments({root, masterFile, handoffReceiptFile, paperFile, selectedSceneId, outputDir, bridgedAt}) {
  const upstream = validateOfficialFirstFrameBranch({root, masterFile, handoffReceiptFile, paperFile});
  requireThat(text(selectedSceneId), 'DIRECTOR_V2_FIRSTFRAME_BRIDGE_SELECTED_SCENE_REQUIRED');
  requireThat(upstream.paper.items.some((item) => item.id === selectedSceneId),
    `DIRECTOR_V2_FIRSTFRAME_BRIDGE_SELECTED_SCENE_UNKNOWN:${selectedSceneId}`);

  const requestId = `v2-paper-firstframe:${upstream.master.taskId}:${upstream.master.revisionId}`;
  const sourceDirectorCues = binding(upstream.cuesFile.filePath, upstream.cuesFile.bytes);
  const sourceUserApproval = binding(upstream.approvalFile.filePath, upstream.approvalFile.bytes);
  const sourceDirectorV2HandoffMaster = binding(masterFile.filePath, masterFile.bytes);
  const sourceDirectorV2HandoffValidationReceipt = binding(
    handoffReceiptFile.filePath,
    handoffReceiptFile.bytes,
  );
  const sourcePaperFirstFrameHandoff = binding(paperFile.filePath, paperFile.bytes);
  const cueById = new Map(upstream.cues.routePlans.paperEditorials.items.map((item) => [item.id, item]));
  const manifest = {
    schemaVersion: FIRSTFRAME_PROMPT_MANIFEST_SCHEMA,
    sourceDirectorSchema: DIRECTOR_CUES_V2_SCHEMA,
    sourceBridgeSchema: DIRECTOR_CUES_V2_FIRSTFRAME_BRIDGE_SCHEMA,
    requestId,
    taskId: upstream.master.taskId,
    revisionId: upstream.master.revisionId,
    phase: 'pre-shoot',
    status: 'automation-input-ready',
    consumer: 'first-frame-image-automation',
    samplePolicy: 'one-representative-scene',
    selectedSceneId,
    promptRole: 'raw-paper-scene-before-deterministic-text-bake',
    finalDeliverableRole: 'text-baked-first-frame-for-runninghub',
    generatedReadableTextAllowed: false,
    modelGeneratedReadableTextAllowed: false,
    deterministicTextMayBeBakedIntoFirstFrame: true,
    policy: {incidentPreventionVersion: '1'},
    calibrationPolicy: {
      plannedAnchorQuadsAreProvisional: true,
      actualGeneratedPaperSurfaceCalibrationRequired: true,
      provisionalAnchorsExcludedFromGenerationPrompts: true,
    },
    sourceDirectorCues,
    sourceUserApproval,
    sourceDirectorV2HandoffMaster,
    sourceDirectorV2HandoffValidationReceipt,
    sourcePaperFirstFrameHandoff,
    sourceHandoffCanonicalSha256: sha256Json(upstream.paper),
    sceneCount: upstream.paper.items.length,
    scenes: upstream.paper.items.map((item) => buildProductionScene(
      item,
      cueById.get(item.id),
      upstream.semanticBeats.get(item.beatId),
    )),
  };
  requireThat(!containsForbiddenVideoKey(manifest),
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_VIDEO_FIELD_LEAK');

  const manifestPath = path.join(outputDir, OUTPUT_FILES.manifest);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const receipt = {
    schemaVersion: DIRECTOR_CUES_V2_FIRSTFRAME_BRIDGE_RECEIPT_SCHEMA,
    sourceDirectorSchema: DIRECTOR_CUES_V2_SCHEMA,
    sourceBridgeSchema: DIRECTOR_CUES_V2_FIRSTFRAME_BRIDGE_SCHEMA,
    taskId: manifest.taskId,
    requestId,
    revisionId: manifest.revisionId,
    status: 'validated-v2-native-firstframe-input',
    skillExecuted: true,
    validatorExecuted: true,
    samplePolicy: manifest.samplePolicy,
    selectedSceneId,
    policy: structuredClone(manifest.policy),
    promptIsolation: {
      containsImageToVideoPromptBodies: false,
      imageToVideoChildRead: false,
      consumer: 'first-frame-stage',
    },
    artifacts: {
      directorCues: sourceDirectorCues,
      userApproval: sourceUserApproval,
      directorV2HandoffMaster: sourceDirectorV2HandoffMaster,
      directorV2HandoffValidationReceipt: sourceDirectorV2HandoffValidationReceipt,
      paperFirstFrameHandoff: sourcePaperFirstFrameHandoff,
      firstFramePromptManifest: {path: manifestPath, sha256: sha256(manifestBytes)},
    },
    externalActionsAuthorized: false,
    generationAuthorized: false,
    bridgedAt,
  };
  requireThat(!containsForbiddenVideoKey(receipt),
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_RECEIPT_VIDEO_FIELD_LEAK');
  return {manifest, manifestBytes, receipt};
}

function resolveOutputDirectory(root, outputArg, {mustNotExist}) {
  requireThat(text(outputArg), 'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_REQUIRED');
  const candidate = path.isAbsolute(outputArg) ? path.normalize(outputArg) : path.resolve(root, outputArg);
  const candidateParent = path.dirname(candidate);
  requireThat(existsSync(candidateParent), 'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_PARENT_MISSING');
  const outputParent = realpathSync(candidateParent);
  requireThat(isInside(root, outputParent),
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_PARENT_OUTSIDE_PROJECT');
  const outputDir = path.join(outputParent, path.basename(candidate));
  requireThat(isInside(root, outputDir) && outputDir !== root,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_OUTSIDE_PROJECT');
  if (mustNotExist) requireThat(!existsSync(outputDir), 'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_ALREADY_EXISTS');
  if (existsSync(outputDir)) {
    const canonicalOutput = realpathSync(outputDir);
    requireThat(isInside(root, canonicalOutput) && canonicalOutput !== root,
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_OUTSIDE_PROJECT');
    return canonicalOutput;
  }
  return outputDir;
}

export function validateDirectorCuesV2FirstFrameBridgeDirectory({projectRoot, outputDir: outputArg}) {
  try {
    const root = normalizeProjectRoot(projectRoot);
    const outputDir = resolveOutputDirectory(root, outputArg, {mustNotExist: false});
    requireThat(existsSync(outputDir) && statSync(outputDir).isDirectory(),
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_DIRECTORY_MISSING');
    requireThat(
      jsonEqual(readdirSync(outputDir).sort(), Object.values(OUTPUT_FILES).sort()),
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_FILE_SET_INVALID',
    );
    const manifestFile = readInputFile(root, path.join(outputDir, OUTPUT_FILES.manifest),
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_MANIFEST');
    const receiptFile = readInputFile(root, path.join(outputDir, OUTPUT_FILES.receipt),
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_RECEIPT');
    const receipt = receiptFile.document;
    requireThat(
      receipt?.schemaVersion === DIRECTOR_CUES_V2_FIRSTFRAME_BRIDGE_RECEIPT_SCHEMA &&
        receipt.status === 'validated-v2-native-firstframe-input',
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_RECEIPT_INVALID',
    );
    sameBoundFile(root, receipt.artifacts?.firstFramePromptManifest, manifestFile,
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_MANIFEST_BINDING');
    const masterFile = readDeclaredBinding(root, receipt.artifacts?.directorV2HandoffMaster,
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_SOURCE_MASTER');
    const handoffReceiptFile = readDeclaredBinding(
      root,
      receipt.artifacts?.directorV2HandoffValidationReceipt,
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_SOURCE_RECEIPT',
    );
    const paperFile = readDeclaredBinding(root, receipt.artifacts?.paperFirstFrameHandoff,
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_SOURCE_PAPER');
    const expected = buildBridgeDocuments({
      root,
      masterFile,
      handoffReceiptFile,
      paperFile,
      selectedSceneId: receipt.selectedSceneId,
      outputDir,
      bridgedAt: receipt.bridgedAt,
    });
    requireThat(jsonEqual(manifestFile.document, expected.manifest),
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_MANIFEST_REBUILD_MISMATCH');
    requireThat(jsonEqual(receipt, expected.receipt),
      'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_RECEIPT_REBUILD_MISMATCH');
    return {
      ok: true,
      errors: [],
      outputDir,
      manifestPath: manifestFile.filePath,
      manifestSha256: manifestFile.binding.sha256,
      receiptPath: receiptFile.filePath,
      receiptSha256: receiptFile.binding.sha256,
      selectedSceneId: receipt.selectedSceneId,
      sceneCount: manifestFile.document.sceneCount,
    };
  } catch (error) {
    return {ok: false, errors: [error instanceof Error ? error.message : String(error)]};
  }
}

export function buildDirectorCuesV2FirstFrameBridge({
  projectRoot,
  master,
  handoffReceipt,
  paperFirstFrame,
  selectedScene,
  outputDir: outputArg,
}) {
  const root = normalizeProjectRoot(projectRoot);
  const outputDir = resolveOutputDirectory(root, outputArg, {mustNotExist: true});
  const masterFile = readInputFile(root, master, 'DIRECTOR_V2_FIRSTFRAME_BRIDGE_MASTER');
  const handoffReceiptFile = readInputFile(
    root,
    handoffReceipt,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_HANDOFF_RECEIPT',
  );
  const paperFile = readInputFile(
    root,
    paperFirstFrame,
    'DIRECTOR_V2_FIRSTFRAME_BRIDGE_PAPER_FIRSTFRAME',
  );
  const documents = buildBridgeDocuments({
    root,
    masterFile,
    handoffReceiptFile,
    paperFile,
    selectedSceneId: selectedScene,
    outputDir,
    bridgedAt: new Date().toISOString(),
  });
  const temporaryDir = path.join(
    path.dirname(outputDir),
    `.${path.basename(outputDir)}.tmp-${process.pid}-${randomUUID()}`,
  );
  try {
    mkdirSync(temporaryDir, {recursive: false, mode: 0o700});
    writeFileSync(path.join(temporaryDir, OUTPUT_FILES.manifest), documents.manifestBytes,
      {flag: 'wx', mode: 0o600});
    writeFileSync(
      path.join(temporaryDir, OUTPUT_FILES.receipt),
      `${JSON.stringify(documents.receipt, null, 2)}\n`,
      {encoding: 'utf8', flag: 'wx', mode: 0o600},
    );
    requireThat(!existsSync(outputDir), 'DIRECTOR_V2_FIRSTFRAME_BRIDGE_OUTPUT_ALREADY_EXISTS');
    renameSync(temporaryDir, outputDir);
    const validation = validateDirectorCuesV2FirstFrameBridgeDirectory({projectRoot: root, outputDir});
    if (!validation.ok) {
      const quarantine = path.join(
        path.dirname(outputDir),
        `.${path.basename(outputDir)}.invalid-${process.pid}-${randomUUID()}`,
      );
      renameSync(outputDir, quarantine);
      throw new Error(
        `DIRECTOR_V2_FIRSTFRAME_BRIDGE_FINAL_VALIDATION_FAILED:${validation.errors.join('|')}:QUARANTINED_AT=${quarantine}`,
      );
    }
    return validation;
  } catch (error) {
    if (existsSync(temporaryDir)) rmSync(temporaryDir, {recursive: true, force: false});
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    for (const required of [
      'project-root',
      'master',
      'handoff-receipt',
      'paper-firstframe',
      'selected-scene',
      'output-dir',
    ]) {
      requireThat(args[required], `DIRECTOR_V2_FIRSTFRAME_BRIDGE_ARGUMENT_REQUIRED:${required}`);
    }
    const result = buildDirectorCuesV2FirstFrameBridge({
      projectRoot: args['project-root'],
      master: args.master,
      handoffReceipt: args['handoff-receipt'],
      paperFirstFrame: args['paper-firstframe'],
      selectedScene: args['selected-scene'],
      outputDir: args['output-dir'],
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
