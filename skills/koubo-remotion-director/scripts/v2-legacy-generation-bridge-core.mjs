import {createHash} from 'node:crypto';
import {existsSync, readFileSync, realpathSync, statSync} from 'node:fs';
import path from 'node:path';
import {validateDirectorCuesV2HandoffDirectory} from './director-cues-v2-handoff-core.mjs';

export const V2_LEGACY_GENERATION_BRIDGE_SCHEMA =
  'koubo-director-cues-v2-legacy-generation-bridge-receipt/v1';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isSha256 = (value) => /^[a-f0-9]{64}$/.test(String(value ?? ''));
const jsonEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function requireThat(condition, code) {
  if (!condition) throw new Error(code);
}

function normalizeRoot(projectRoot) {
  const root = realpathSync(path.resolve(projectRoot));
  requireThat(statSync(root).isDirectory(), 'V2_LEGACY_BRIDGE_PROJECT_ROOT_INVALID');
  return root;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function readBound(root, declared, code) {
  requireThat(
    declared && typeof declared.path === 'string' && declared.path.trim() && isSha256(declared.sha256),
    `${code}_BINDING_INVALID`,
  );
  const candidate = path.isAbsolute(declared.path)
    ? path.normalize(declared.path)
    : path.resolve(root, declared.path);
  requireThat(existsSync(candidate), `${code}_MISSING_OR_OUTSIDE_PROJECT`);
  const filePath = realpathSync(candidate);
  requireThat(isInside(root, filePath) && statSync(filePath).isFile(), `${code}_NOT_PROJECT_FILE`);
  const bytes = readFileSync(filePath);
  requireThat(sha256(bytes) === declared.sha256, `${code}_SHA_MISMATCH`);
  let document;
  try {
    document = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${code}_JSON_INVALID`);
  }
  return {
    binding: {path: relativePath(root, filePath), sha256: declared.sha256},
    filePath,
    document,
  };
}

function sameBinding(left, right) {
  return left?.path === right?.path && left?.sha256 === right?.sha256;
}

function indexUnique(items, field, code) {
  requireThat(Array.isArray(items), `${code}_ITEMS_INVALID`);
  const result = new Map();
  for (const item of items) {
    const key = item?.[field];
    requireThat(typeof key === 'string' && key.trim() && !result.has(key), `${code}_IDENTITY_INVALID`);
    result.set(key, item);
  }
  return result;
}

function verifyManifestIdentity(manifest, master, code) {
  requireThat(
    manifest?.taskId === master.taskId && manifest?.revisionId === master.revisionId,
    `${code}_TASK_OR_REVISION_MISMATCH`,
  );
}

function verifyPaperConversion({master, sourceFirstFrame, sourceVideo, legacyFirstFrame, legacyVideo, pack}) {
  verifyManifestIdentity(sourceFirstFrame, master, 'V2_LEGACY_BRIDGE_PAPER_FIRSTFRAME_SOURCE');
  verifyManifestIdentity(sourceVideo, master, 'V2_LEGACY_BRIDGE_PAPER_VIDEO_SOURCE');
  requireThat(
    sourceFirstFrame.sourceRoute === 'paper-editorial' && sourceFirstFrame.promptKind === 'first-frame' &&
      sourceVideo.sourceRoute === 'paper-editorial' && sourceVideo.promptKind === 'image-to-video',
    'V2_LEGACY_BRIDGE_PAPER_SOURCE_ROUTE_INVALID',
  );
  requireThat(
    legacyFirstFrame?.taskId === master.taskId && legacyFirstFrame?.revisionId === master.revisionId &&
      legacyVideo?.taskId === master.taskId && legacyVideo?.revisionId === master.revisionId,
    'V2_LEGACY_BRIDGE_PAPER_LEGACY_IDENTITY_MISMATCH',
  );
  const sourceStillByBeat = indexUnique(sourceFirstFrame.items, 'beatId', 'V2_LEGACY_BRIDGE_PAPER_SOURCE_STILL');
  const sourceVideoByBeat = indexUnique(sourceVideo.items, 'beatId', 'V2_LEGACY_BRIDGE_PAPER_SOURCE_VIDEO');
  const legacyStillByBeat = indexUnique(legacyFirstFrame?.scenes, 'beatId', 'V2_LEGACY_BRIDGE_PAPER_LEGACY_STILL');
  const legacyVideoByBeat = indexUnique(legacyVideo?.scenes, 'beatId', 'V2_LEGACY_BRIDGE_PAPER_LEGACY_VIDEO');
  requireThat(
    sourceFirstFrame.itemCount === sourceStillByBeat.size && sourceVideo.itemCount === sourceVideoByBeat.size &&
      legacyFirstFrame.sceneCount === legacyStillByBeat.size && legacyVideo.sceneCount === legacyVideoByBeat.size &&
      pack?.sceneCount === (pack?.scenes ?? []).length,
    'V2_LEGACY_BRIDGE_PAPER_DECLARED_COUNT_MISMATCH',
  );
  requireThat(
    sourceStillByBeat.size === sourceVideoByBeat.size && sourceStillByBeat.size === legacyStillByBeat.size &&
      sourceStillByBeat.size === legacyVideoByBeat.size,
    'V2_LEGACY_BRIDGE_PAPER_COUNT_MISMATCH',
  );
  const items = [];
  for (const sourceStill of sourceFirstFrame.items) {
    const sourceMotion = sourceVideoByBeat.get(sourceStill.beatId);
    const legacyStill = legacyStillByBeat.get(sourceStill.beatId);
    const legacyMotion = legacyVideoByBeat.get(sourceStill.beatId);
    requireThat(sourceMotion && legacyStill && legacyMotion, `V2_LEGACY_BRIDGE_PAPER_ITEM_MISSING:${sourceStill.id}`);
    requireThat(
      sourceStill.id === sourceMotion.id && sourceStill.id === legacyStill.sceneId &&
        sourceStill.id === legacyMotion.sceneId && sourceStill.pairId === sourceMotion.pairId &&
        sourceStill.pairSha256 === sourceMotion.pairSha256,
      `V2_LEGACY_BRIDGE_PAPER_ITEM_IDENTITY_MISMATCH:${sourceStill.id}`,
    );
    const firstFrameTransform = legacyStill.firstFramePrompt === sourceStill.prompt
      ? 'exact-copy'
      : legacyStill.firstFramePrompt?.startsWith(`${sourceStill.prompt}\n\n`)
        ? 'exact-source-prefix-plus-native-safety-appendix'
        : null;
    requireThat(firstFrameTransform, `V2_LEGACY_BRIDGE_PAPER_FIRSTFRAME_PROMPT_MISMATCH:${sourceStill.id}`);
    requireThat(
      sha256(String(legacyStill.firstFramePrompt)) === legacyStill.firstFramePromptSha256 &&
        legacyMotion.imageToVideoPrompt === sourceMotion.prompt &&
        sha256(String(legacyMotion.imageToVideoPrompt)) === legacyMotion.imageToVideoPromptSha256 &&
        legacyMotion.durationSeconds === sourceMotion.durationSeconds,
      `V2_LEGACY_BRIDGE_PAPER_PROMPT_OR_DURATION_MISMATCH:${sourceStill.id}`,
    );
    const sourceTexts = sourceStill.textPlan?.map((entry) => entry.text) ?? [];
    const legacyTexts = legacyStill.postProductionTextOverlay?.map((entry) => entry.text) ?? [];
    requireThat(jsonEqual(sourceTexts, legacyTexts), `V2_LEGACY_BRIDGE_PAPER_TEXT_PLAN_MISMATCH:${sourceStill.id}`);
    items.push({
      id: sourceStill.id,
      beatId: sourceStill.beatId,
      firstFrameTransform,
      sourceFirstFramePromptSha256: sourceStill.promptSha256,
      legacyFirstFramePromptSha256: legacyStill.firstFramePromptSha256,
      sourceImageToVideoPromptSha256: sourceMotion.promptSha256,
      legacyImageToVideoPromptSha256: legacyMotion.imageToVideoPromptSha256,
      includedInGenerationInventory: Array.isArray(pack?.scenes) &&
        pack.scenes.some((scene) => scene.sceneId === sourceStill.id),
    });
  }
  for (const scene of pack?.scenes ?? []) {
    const sourceMotion = sourceVideo.items.find((item) => item.id === scene.sceneId);
    requireThat(sourceMotion, `V2_LEGACY_BRIDGE_PACK_SCENE_NOT_IN_V2_PAPER:${scene?.sceneId ?? 'unknown'}`);
    requireThat(
      scene.imageToVideoPrompt === sourceMotion.prompt &&
        scene.imageToVideoPromptSha256 === sourceMotion.promptSha256 &&
        scene.durationSeconds === sourceMotion.durationSeconds,
      `V2_LEGACY_BRIDGE_PACK_SCENE_CONTENT_MISMATCH:${scene.sceneId}`,
    );
  }
  return {
    status: sourceFirstFrame.status,
    sourceItemCount: sourceFirstFrame.itemCount,
    legacyItemCount: legacyFirstFrame.sceneCount,
    inventorySceneCount: pack?.sceneCount,
    items,
  };
}

function verifyAiConversion({master, sourceFirstFrame, sourceVideo, legacy}) {
  verifyManifestIdentity(sourceFirstFrame, master, 'V2_LEGACY_BRIDGE_AI_FIRSTFRAME_SOURCE');
  verifyManifestIdentity(sourceVideo, master, 'V2_LEGACY_BRIDGE_AI_VIDEO_SOURCE');
  requireThat(
    sourceFirstFrame.sourceRoute === 'ai-generated-video' && sourceFirstFrame.promptKind === 'first-frame' &&
      sourceVideo.sourceRoute === 'ai-generated-video' && sourceVideo.promptKind === 'image-to-video',
    'V2_LEGACY_BRIDGE_AI_SOURCE_ROUTE_INVALID',
  );
  requireThat(
    legacy?.taskId === master.taskId && legacy?.revisionId === master.revisionId,
    'V2_LEGACY_BRIDGE_AI_LEGACY_IDENTITY_MISMATCH',
  );
  const sourceStillByBeat = indexUnique(sourceFirstFrame.items, 'beatId', 'V2_LEGACY_BRIDGE_AI_SOURCE_STILL');
  const sourceVideoByBeat = indexUnique(sourceVideo.items, 'beatId', 'V2_LEGACY_BRIDGE_AI_SOURCE_VIDEO');
  const legacyByBeat = indexUnique(legacy?.items, 'beatId', 'V2_LEGACY_BRIDGE_AI_LEGACY_VIDEO');
  requireThat(
    sourceFirstFrame.itemCount === sourceStillByBeat.size && sourceVideo.itemCount === sourceVideoByBeat.size &&
      legacy?.itemCount === legacyByBeat.size,
    'V2_LEGACY_BRIDGE_AI_DECLARED_COUNT_MISMATCH',
  );
  requireThat(
    sourceStillByBeat.size === sourceVideoByBeat.size && sourceStillByBeat.size === legacyByBeat.size,
    'V2_LEGACY_BRIDGE_AI_COUNT_MISMATCH',
  );
  const items = [];
  for (const sourceMotion of sourceVideo.items) {
    const sourceStill = sourceStillByBeat.get(sourceMotion.beatId);
    const legacyItem = legacyByBeat.get(sourceMotion.beatId);
    const legacyNegativePrompt = sourceMotion.negativePrompt.join('；');
    const sourceNegativePromptSha256 = sha256(JSON.stringify(sourceMotion.negativePrompt));
    const legacyNegativePromptSha256 = sha256(legacyNegativePrompt);
    requireThat(sourceStill && legacyItem, `V2_LEGACY_BRIDGE_AI_ITEM_MISSING:${sourceMotion.id}`);
    requireThat(
      sourceStill.id === sourceMotion.id && /^A\d{2,}$/u.test(String(legacyItem.sceneId ?? '')) &&
        sourceStill.pairId === sourceMotion.pairId && sourceStill.pairSha256 === sourceMotion.pairSha256,
      `V2_LEGACY_BRIDGE_AI_ITEM_IDENTITY_MISMATCH:${sourceMotion.id}`,
    );
    requireThat(
      legacyItem.mode === 'image-to-video' && legacyItem.prompt === sourceMotion.prompt &&
        sha256(String(legacyItem.prompt)) === legacyItem.promptSha256 &&
        legacyItem.negativePrompt === legacyNegativePrompt &&
        legacyItem.negativePromptSha256 === legacyNegativePromptSha256 &&
        legacyItem.durationSeconds === sourceMotion.durationSeconds &&
        legacyItem.purpose === sourceMotion.purpose && legacyItem.evidenceEligible === false &&
        legacyItem.disclosureRequired === true && legacyItem.manualExecutionRequired === true,
      `V2_LEGACY_BRIDGE_AI_CONTENT_MISMATCH:${sourceMotion.id}`,
    );
    items.push({
      sourceId: sourceMotion.id,
      legacySceneId: legacyItem.sceneId,
      beatId: sourceMotion.beatId,
      firstFrameSource: 'v2-child-direct',
      sourceFirstFramePromptSha256: sourceStill.promptSha256,
      videoTransform: 'exact-copy',
      sourceImageToVideoPromptSha256: sourceMotion.promptSha256,
      legacyImageToVideoPromptSha256: legacyItem.promptSha256,
      negativePromptTransform: 'join-fullwidth-semicolon-v1',
      sourceNegativePromptJsonSha256: sourceNegativePromptSha256,
      legacyNegativePromptSha256,
    });
  }
  return {
    status: sourceVideo.status,
    sourceItemCount: sourceVideo.itemCount,
    legacyItemCount: legacy.itemCount,
    items,
  };
}

export function buildV2LegacyGenerationBridgeReceipt({
  projectRoot,
  directorCuesHandoff,
  directorCuesHandoffValidationReceipt,
  generationInventory,
  generationOwnershipReceipt,
  firstFramePromptManifest,
  imageToVideoPromptManifest,
  aiVideoPromptManifest,
}) {
  const root = normalizeRoot(projectRoot);
  const masterFile = readBound(root, directorCuesHandoff, 'V2_LEGACY_BRIDGE_MASTER');
  const handoffValidation = validateDirectorCuesV2HandoffDirectory({
    projectRoot: root,
    outputDir: path.dirname(masterFile.filePath),
  });
  requireThat(handoffValidation.ok, `V2_LEGACY_BRIDGE_HANDOFF_INVALID:${handoffValidation.errors.join('|')}`);
  requireThat(
    handoffValidation.masterPath === masterFile.filePath && handoffValidation.masterSha256 === masterFile.binding.sha256,
    'V2_LEGACY_BRIDGE_MASTER_VALIDATION_MISMATCH',
  );
  const receiptFile = readBound(
    root,
    directorCuesHandoffValidationReceipt,
    'V2_LEGACY_BRIDGE_HANDOFF_RECEIPT',
  );
  requireThat(
    handoffValidation.receiptPath === receiptFile.filePath && handoffValidation.receiptSha256 === receiptFile.binding.sha256,
    'V2_LEGACY_BRIDGE_HANDOFF_RECEIPT_VALIDATION_MISMATCH',
  );
  const master = masterFile.document;
  const inventoryFile = readBound(root, generationInventory, 'V2_LEGACY_BRIDGE_GENERATION_INVENTORY');
  const ownershipFile = readBound(root, generationOwnershipReceipt, 'V2_LEGACY_BRIDGE_GENERATION_OWNERSHIP');
  const legacyFirstFrameFile = readBound(root, firstFramePromptManifest, 'V2_LEGACY_BRIDGE_LEGACY_FIRSTFRAME');
  const legacyVideoFile = readBound(root, imageToVideoPromptManifest, 'V2_LEGACY_BRIDGE_LEGACY_VIDEO');
  const legacyAiFile = readBound(root, aiVideoPromptManifest, 'V2_LEGACY_BRIDGE_LEGACY_AI');
  const v2Files = Object.fromEntries(Object.entries(master.artifacts).map(([key, declared]) => [
    key,
    readBound(root, declared, `V2_LEGACY_BRIDGE_V2_CHILD:${key}`),
  ]));
  const pack = inventoryFile.document;
  requireThat(
    pack?.taskId === master.taskId && pack?.revisionId === master.revisionId,
    'V2_LEGACY_BRIDGE_INVENTORY_IDENTITY_MISMATCH',
  );
  requireThat(
    sameBinding(
      readBound(root, pack.userAcceptance, 'V2_LEGACY_BRIDGE_PACK_ACCEPTANCE').binding,
      ownershipFile.binding,
    ),
    'V2_LEGACY_BRIDGE_INVENTORY_OWNERSHIP_MISMATCH',
  );
  requireThat(
    sameBinding(
      readBound(root, pack.sourceRunningHubManifest, 'V2_LEGACY_BRIDGE_PACK_VIDEO_MANIFEST').binding,
      legacyVideoFile.binding,
    ),
    'V2_LEGACY_BRIDGE_INVENTORY_VIDEO_MANIFEST_MISMATCH',
  );
  const jobFile = readBound(root, pack.sourceJob, 'V2_LEGACY_BRIDGE_PACK_JOB');
  requireThat(
    sameBinding(
      readBound(root, jobFile.document?.sourceManifest, 'V2_LEGACY_BRIDGE_JOB_FIRSTFRAME_MANIFEST').binding,
      legacyFirstFrameFile.binding,
    ),
    'V2_LEGACY_BRIDGE_INVENTORY_FIRSTFRAME_MANIFEST_MISMATCH',
  );
  const paper = verifyPaperConversion({
    master,
    sourceFirstFrame: v2Files.paperFirstFrame.document,
    sourceVideo: v2Files.paperVideo.document,
    legacyFirstFrame: legacyFirstFrameFile.document,
    legacyVideo: legacyVideoFile.document,
    pack,
  });
  const ai = verifyAiConversion({
    master,
    sourceFirstFrame: v2Files.aiFirstFrame.document,
    sourceVideo: v2Files.aiVideo.document,
    legacy: legacyAiFile.document,
  });
  return {
    schemaVersion: V2_LEGACY_GENERATION_BRIDGE_SCHEMA,
    status: 'validated-deterministic-v2-to-legacy-generation-bridge',
    taskId: master.taskId,
    revisionId: master.revisionId,
    policy: {incidentPreventionVersion: '1'},
    authority: 'director-cues-v2-handoff-master-and-six-bound-children',
    bindings: {
      directorCuesHandoff: masterFile.binding,
      directorCuesHandoffValidationReceipt: receiptFile.binding,
      generationInventory: inventoryFile.binding,
      generationOwnershipReceipt: ownershipFile.binding,
      firstFramePromptManifest: legacyFirstFrameFile.binding,
      imageToVideoPromptManifest: legacyVideoFile.binding,
      aiVideoPromptManifest: legacyAiFile.binding,
    },
    v2Artifacts: Object.fromEntries(Object.entries(v2Files).map(([key, file]) => [key, file.binding])),
    conversions: {paperEditorial: paper, aiGeneratedVideo: ai},
    realEvidenceAuthority: 'v2-child-direct',
    shotcraftAuthority: 'v2-child-post-shoot-opportunity-only',
    externalActionsAuthorized: false,
    externalVideoSubmissionAuthorized: false,
    bridgeCreatedAssets: false,
  };
}

export function validateV2LegacyGenerationBridgeReceipt(args) {
  try {
    const receiptFile = readBound(
      normalizeRoot(args.projectRoot),
      args.bridgeReceipt,
      'V2_LEGACY_BRIDGE_RECEIPT',
    );
    const expected = buildV2LegacyGenerationBridgeReceipt(args);
    requireThat(
      receiptFile.document?.schemaVersion === V2_LEGACY_GENERATION_BRIDGE_SCHEMA &&
        receiptFile.document?.status === 'validated-deterministic-v2-to-legacy-generation-bridge',
      'V2_LEGACY_BRIDGE_RECEIPT_TYPE_OR_STATUS_INVALID',
    );
    requireThat(jsonEqual(receiptFile.document, expected), 'V2_LEGACY_BRIDGE_RECEIPT_REBUILD_MISMATCH');
    return {ok: true, errors: [], receipt: receiptFile.binding};
  } catch (error) {
    return {ok: false, errors: [error instanceof Error ? error.message : String(error)]};
  }
}
