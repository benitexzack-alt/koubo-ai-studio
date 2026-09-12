import {createHash} from 'node:crypto';
import {existsSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';

export const MANIFEST_SCHEMA = 'koubo-paper-first-frame-prompt-manifest/v1';
export const JOB_SCHEMA = 'koubo-paper-firstframe-batch/v1';
export const REVIEW_SCHEMA = 'koubo-paper-firstframe-visual-review/v1';
export const TEXT_BAKE_CALIBRATION_SCHEMA =
  'koubo-paper-firstframe-anchor-calibration/v1';
export const TEXT_BAKE_RECEIPT_SCHEMA =
  'koubo-paper-firstframe-text-bake-receipt/v1';
export const RUNNINGHUB_READY_PACK_SCHEMA =
  'koubo-paper-runninghub-ready-pack/v1';
export const CUE_NATIVE_DIRECTOR_SCHEMA = 'koubo-director-cues/v1';
export const CUE_NATIVE_SAMPLE_ACCEPTANCE_SCHEMA =
  'koubo-paper-firstframe-sample-user-acceptance/v1';
export const FIRSTFRAME_ROUTE_LOCK_SCHEMA =
  'koubo-paper-firstframe-route-lock/v1';
export const FIRSTFRAME_ROUTE_LOCK_FILE_NAME = 'first-frame-route-lock.v1.json';
export const FIRSTFRAME_ROUTE_LOCK_STATUS = 'locked-at-firstframe-batch-prepare';

// Some historical persisted jobs and integration fixtures omit the boolean
// and use an explicit full/post-full status as their gate. Keep that narrow
// compatibility; every cue-native job must carry the boolean authorization.
const LEGACY_FULL_BATCH_AUTHORIZED_STATUSES = new Set([
  'full-generation-authorized',
  'batch-awaiting-user-review',
  'text-baked-firstframes-awaiting-user-review',
  'ready-for-runninghub-manual',
]);

export const RAW_VISUAL_CRITERIA = [
  'semanticMatch', 'paperMaterial', 'depthAndContact', 'cleanTextAndBrand',
  'compositionAndReadability', 'videoReadiness',
];

// A status flag must not hide failed or missing individual checks. Both the
// batch validator and the writer call this same gate before using an image.
export function validateRawVisualReview(scene, review, {sourceScene, policy} = {}) {
  const errors = [];
  const id = scene.sceneId;
  if (review?.schemaVersion !== REVIEW_SCHEMA || review.sceneId !== id) {
    errors.push(`VISUAL_REVIEW_SCHEMA_INVALID:${id}`);
  }
  if (review?.imageSha256 !== scene.result?.imageSha256) {
    errors.push(`VISUAL_REVIEW_IMAGE_SHA_MISMATCH:${id}`);
  }
  if (review?.status !== 'passed') errors.push(`VISUAL_REVIEW_NOT_PASSED:${id}`);
  for (const name of RAW_VISUAL_CRITERIA) {
    if (review?.criteria?.[name] !== 'passed') {
      errors.push(`VISUAL_CRITERION_FAILED:${id}:${name}`);
    }
  }
  if (typeof review?.notes !== 'string' || !review.notes.trim()) {
    errors.push(`VISUAL_OBSERVATIONS_MISSING:${id}`);
  }
  if (scene.physicalContract || scene.physicalContractSha256) {
    errors.push(...validatePhysicalObservations(scene, review));
  }
  if (sourceScene?.physicalContract || policy?.physicalContinuityVersion === '1') {
    if (!sourceScene?.physicalContract || !scene.physicalContract ||
      sha256Json(sourceScene.physicalContract) !== scene.physicalContractSha256 ||
      sourceScene.physicalContractSha256 !== scene.physicalContractSha256) {
      errors.push(`PHYSICAL_SOURCE_BINDING_INVALID:${id}`);
    }
  }
  return errors;
}

export function validatePhysicalObservations(scene, review) {
  const errors = [], id = scene.sceneId, contract = scene.physicalContract;
  const observation = review?.physicalObservations;
  const check = (value, code) => { if (!value) errors.push(`${code}:${id}`); };
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  const box = (value) => Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) &&
    value[0] >= 0 && value[1] >= 0 && value[2] > 0 && value[3] > 0 &&
    value[0] + value[2] <= 1.000001 && value[1] + value[3] <= 1.000001;
  const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b) &&
    new Set(a).size === a.length && a.length === b.length && a.every((key) => b.includes(key));
  check(contract?.schemaVersion === 'koubo-paper-physical-contract/v1' &&
    sha256Json(contract) === scene.physicalContractSha256, 'PHYSICAL_CONTRACT_BINDING_INVALID');
  check(observation?.imageSha256 === scene.result?.imageSha256 &&
    observation?.physicalContractSha256 === scene.physicalContractSha256, 'PHYSICAL_OBSERVATION_BINDING_INVALID');
  if (!contract || !observation) return errors;
  const expectedInventory = contract.inventory ?? [], actualInventory = observation.inventory ?? [];
  check(sameSet(actualInventory.map((row) => row.partId), expectedInventory.map((row) => row.partId)), 'PHYSICAL_INVENTORY_COVERAGE_INVALID');
  for (const expected of expectedInventory) {
    const actual = actualInventory.find((row) => row.partId === expected.partId);
    const initialGroups = (contract.stations ?? []).filter((station) => station.initialPartIds.includes(expected.partId)).map((station) => station.groupId);
    check(actual?.observedQuantity === expected.quantity &&
      sameSet(actual?.observedGroupIds, initialGroups) && actual?.imageBoxes?.length === expected.quantity &&
      actual.imageBoxes.every(box) && text(actual?.notes), `PHYSICAL_INVENTORY_MISMATCH:${expected.partId}`);
  }
  const stations = observation.stations ?? [];
  check(sameSet(stations.map((row) => row.groupId), (contract.stations ?? []).map((row) => row.groupId)), 'PHYSICAL_STATION_COVERAGE_INVALID');
  for (const expected of contract.stations ?? []) {
    const actual = stations.find((row) => row.groupId === expected.groupId);
    check(sameSet(actual?.observedPartIds, expected.initialPartIds) && box(actual?.imageBox) && text(actual?.notes),
      `PHYSICAL_STATION_OCCUPANCY_MISMATCH:${expected.groupId}`);
  }
  const transfers = observation.transfers ?? [];
  check(sameSet(transfers.map((row) => row.actionId), (contract.transfers ?? []).map((row) => row.actionId)), 'PHYSICAL_ROUTE_COVERAGE_INVALID');
  for (const expected of contract.transfers ?? []) {
    const actual = transfers.find((row) => row.actionId === expected.actionId);
    check(box(actual?.imageBox) && text(actual?.notes) &&
      ['continuousSupport', 'compatibleHeight', 'noBlockingEdges', 'openingFitsPart'].every((key) => actual?.checks?.[key] === 'passed'),
    `PHYSICAL_ROUTE_NOT_PASSED:${expected.actionId}`);
  }
  const labels = observation.fixedLabels ?? [];
  check(sameSet(labels.map((row) => row.nodeId), (scene.deterministicTextBake?.labels ?? []).map((row) => row.nodeId)) &&
    labels.every((row) => box(row.imageBox) && row.independentStandObserved === true && text(row.notes)), 'PHYSICAL_FIXED_LABELS_INVALID');
  return errors;
}

export const sha256Buffer = (buffer) =>
  createHash('sha256').update(buffer).digest('hex');
export const sha256File = (filePath) => sha256Buffer(readFileSync(filePath));
export const sha256Text = (value) => sha256Buffer(Buffer.from(value, 'utf8'));

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

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function resolveInside(root, value, label) {
  const result = path.isAbsolute(value) ? path.normalize(value) : path.resolve(root, value);
  if (!isInside(root, result)) throw new Error(`${label}_OUTSIDE_PROJECT:${result}`);
  return result;
}

export function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`UNKNOWN_ARGUMENT:${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`ARGUMENT_VALUE_MISSING:${name}`);
    values[name] = value;
    index += 1;
  }
  return values;
}

export function writeNewJson(filePath, value) {
  if (existsSync(filePath)) throw new Error(`OUTPUT_ALREADY_EXISTS:${filePath}`);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
}

export function replaceJson(filePath, value) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  renameSync(temporaryPath, filePath);
}

export function validateManifest(manifest) {
  const errors = [];
  if (manifest.sourceDirectorSchema !== undefined &&
    manifest.sourceDirectorSchema !== CUE_NATIVE_DIRECTOR_SCHEMA) {
    errors.push('SOURCE_DIRECTOR_SCHEMA_INVALID');
  }
  if (manifest.samplePolicy !== undefined &&
    !['one-representative-scene', 'legacy-three-representative-scenes'].includes(manifest.samplePolicy)) {
    errors.push('SAMPLE_POLICY_INVALID');
  }
  if (manifest.samplePolicy === 'one-representative-scene' &&
    manifest.sourceDirectorSchema !== CUE_NATIVE_DIRECTOR_SCHEMA &&
    manifest.v9ContractEnabled !== true) {
    errors.push('ONE_REPRESENTATIVE_SAMPLE_SOURCE_INVALID');
  }
  if (manifest.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA &&
    manifest.samplePolicy !== 'one-representative-scene') {
    errors.push('CUE_NATIVE_SAMPLE_POLICY_INVALID');
  }
  if (manifest.policy?.incidentPreventionVersion !== undefined) {
    if (manifest.policy.incidentPreventionVersion !== '1') errors.push('INCIDENT_POLICY_VERSION_INVALID');
    if (typeof manifest.revisionId !== 'string' || !manifest.revisionId.trim()) errors.push('INCIDENT_REVISION_ID_REQUIRED');
  }
  if (manifest.policy?.physicalContinuityVersion !== undefined && manifest.policy.physicalContinuityVersion !== '1') {
    errors.push('PHYSICAL_POLICY_VERSION_INVALID');
  }
  if (manifest.schemaVersion !== MANIFEST_SCHEMA) errors.push('MANIFEST_SCHEMA_INVALID');
  if (manifest.status !== 'automation-input-ready') errors.push('MANIFEST_STATUS_INVALID');
  if (manifest.consumer !== 'first-frame-image-automation') errors.push('MANIFEST_CONSUMER_INVALID');
  if (manifest.generatedReadableTextAllowed !== false) errors.push('GENERATED_TEXT_NOT_BLOCKED');
  if (!Array.isArray(manifest.scenes) || manifest.scenes.length === 0) {
    errors.push('MANIFEST_SCENES_EMPTY');
    return errors;
  }
  if (manifest.sceneCount !== manifest.scenes.length) errors.push('SCENE_COUNT_MISMATCH');

  if (manifest.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA) {
    if (typeof manifest.selectedSceneId !== 'string' || !manifest.selectedSceneId.trim()) {
      errors.push('CUE_NATIVE_SELECTED_SCENE_REQUIRED');
    } else if (!manifest.scenes.some((scene) => scene.sceneId === manifest.selectedSceneId)) {
      errors.push(`CUE_NATIVE_SELECTED_SCENE_UNKNOWN:${manifest.selectedSceneId}`);
    }
  }

  const sceneIds = new Set();
  const pairIds = new Set();
  const outputNames = new Set();
  const bakedOutputNames = new Set();
  const v9ContractEnabled = manifest.v9ContractEnabled === true;
  manifest.scenes.forEach((scene, index) => {
    const suffix = scene.sceneId || String(index);
    if (manifest.policy?.physicalContinuityVersion === '1' || scene.physicalContract) {
      if (scene.physicalContract?.schemaVersion !== 'koubo-paper-physical-contract/v1' ||
        sha256Json(scene.physicalContract) !== scene.physicalContractSha256 ||
        !scene.motionContract?.physicalContract || sha256Json(scene.motionContract) !== scene.motionContractSha256 ||
        sha256Json(scene.motionContract.physicalContract) !== scene.physicalContractSha256) {
        errors.push(`PHYSICAL_CONTRACT_BINDING_INVALID:${suffix}`);
      }
    }
    if (!/^P\d{2,}$/.test(scene.sceneId ?? '')) errors.push(`SCENE_ID_INVALID:${suffix}`);
    if (sceneIds.has(scene.sceneId)) errors.push(`SCENE_ID_DUPLICATE:${suffix}`);
    sceneIds.add(scene.sceneId);
    if (typeof scene.pairId !== 'string' || !scene.pairId) errors.push(`PAIR_ID_MISSING:${suffix}`);
    if (pairIds.has(scene.pairId)) errors.push(`PAIR_ID_DUPLICATE:${suffix}`);
    pairIds.add(scene.pairId);
    if (scene.aspectRatio !== '16:9') errors.push(`ASPECT_RATIO_INVALID:${suffix}`);
    if (typeof scene.firstFramePrompt !== 'string' || !scene.firstFramePrompt.trim()) {
      errors.push(`PROMPT_MISSING:${suffix}`);
    } else if (sha256Text(scene.firstFramePrompt) !== scene.firstFramePromptSha256) {
      errors.push(`PROMPT_SHA_MISMATCH:${suffix}`);
    }
    if (Object.hasOwn(scene, 'imageToVideoPrompt')) errors.push(`VIDEO_PROMPT_LEAK:${suffix}`);
    if (scene.generatedReadableTextAllowed !== false) errors.push(`SCENE_TEXT_NOT_BLOCKED:${suffix}`);
    if (typeof scene.outputFileName !== 'string' || path.basename(scene.outputFileName) !== scene.outputFileName) {
      errors.push(`OUTPUT_FILE_NAME_INVALID:${suffix}`);
    }
    if (outputNames.has(scene.outputFileName)) errors.push(`OUTPUT_FILE_NAME_DUPLICATE:${suffix}`);
    outputNames.add(scene.outputFileName);
    const bake = scene.deterministicTextBake;
    if (!bake || bake.enabled !== true) errors.push(`TEXT_BAKE_PLAN_MISSING:${suffix}`);
    if (bake?.sourceImageFileName !== scene.outputFileName) {
      errors.push(`TEXT_BAKE_SOURCE_NAME_MISMATCH:${suffix}`);
    }
    if (
      typeof bake?.outputImageFileName !== 'string' ||
      path.basename(bake.outputImageFileName) !== bake.outputImageFileName ||
      bake.outputImageFileName === scene.outputFileName
    ) {
      errors.push(`TEXT_BAKE_OUTPUT_FILE_NAME_INVALID:${suffix}`);
    } else if (bakedOutputNames.has(bake.outputImageFileName)) {
      errors.push(`TEXT_BAKE_OUTPUT_FILE_NAME_DUPLICATE:${suffix}`);
    } else {
      bakedOutputNames.add(bake.outputImageFileName);
    }
    if (bake?.anchorCalibrationRequired !== true) {
      errors.push(`TEXT_BAKE_ANCHOR_CALIBRATION_NOT_REQUIRED:${suffix}`);
    }
    if (bake?.ocrRequired !== true) errors.push(`TEXT_BAKE_OCR_NOT_REQUIRED:${suffix}`);
    if (!Array.isArray(bake?.labels) || bake.labels.length === 0) {
      errors.push(`TEXT_BAKE_LABELS_EMPTY:${suffix}`);
    }
    if (v9ContractEnabled) {
      const layout = scene.layoutContract;
      if (!layout || typeof layout !== 'object') {
        errors.push(`V9_LAYOUT_CONTRACT_MISSING:${suffix}`);
      } else {
        if (sha256Json(layout) !== scene.layoutContractSha256) {
          errors.push(`V9_LAYOUT_CONTRACT_SHA_MISMATCH:${suffix}`);
        }
        if (
          layout.coordinateSpace !== 'normalized-0-to-1' ||
          layout.generatedDecorationPolicy !== 'forbidden' ||
          layout.layoutInterpretation?.objectGroupBoxes !== 'broad-composition-zones' ||
          layout.layoutInterpretation?.paperLabelSurfaceBoxes !== 'reserved-placement-zones' ||
          layout.layoutInterpretation?.exactPixelMatchRequired !== false ||
          layout.layoutInterpretation?.contentAndSubtitleContainmentIsHard !== true ||
          !Array.isArray(layout.objectGroupBoxes) ||
          layout.objectGroupBoxes.length === 0 ||
          !Array.isArray(layout.paperLabelSurfaceBoxes) ||
          layout.paperLabelSurfaceBoxes.length !== bake.labels.length
        ) {
          errors.push(`V9_LAYOUT_CONTRACT_INVALID:${suffix}`);
        }
        for (const label of bake.labels ?? []) {
          const bindings = layout.paperLabelSurfaceBoxes?.filter(
            (entry) =>
              entry?.nodeId === label.nodeId &&
              entry?.groupId === label.groupId &&
              entry?.surfaceId === label.surfaceId,
          ) ?? [];
          if (bindings.length !== 1) {
            errors.push(`V9_LABEL_LAYOUT_BINDING_INVALID:${suffix}:${label.nodeId ?? 'unknown'}`);
          }
        }
      }
      if (
        !scene.firstFramePrompt.includes('V9布局合同') ||
        !scene.firstFramePrompt.includes('字幕保留区') ||
        !scene.firstFramePrompt.includes('generatedDecorationPolicy=forbidden')
      ) {
        errors.push(`V9_LAYOUT_PROMPT_CLAUSE_MISSING:${suffix}`);
      }
    } else if (Object.hasOwn(scene, 'layoutContract') || Object.hasOwn(scene, 'layoutContractSha256')) {
      errors.push(`V9_LAYOUT_WITHOUT_MANIFEST_MARKER:${suffix}`);
    }
  });
  return errors;
}

export function validateSampleSceneIds(manifest, sampleSceneIds) {
  const errors = [];
  const oneRepresentative = manifest.samplePolicy === 'one-representative-scene' ||
    manifest.v9ContractEnabled === true;
  const requiredCount = oneRepresentative ? 1 : 3;
  if (
    sampleSceneIds.length !== requiredCount ||
    new Set(sampleSceneIds).size !== requiredCount
  ) {
    errors.push(
      oneRepresentative
        ? (manifest.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA
            ? 'CUE_NATIVE_SAMPLE_MUST_CONTAIN_ONE_UNIQUE_SCENE_ID'
            : 'V9_SAMPLE_MUST_CONTAIN_ONE_UNIQUE_SCENE_ID')
        : 'LEGACY_SAMPLE_MUST_CONTAIN_THREE_UNIQUE_SCENE_IDS',
    );
    return errors;
  }
  const knownSceneIds = new Set(manifest.scenes.map((scene) => scene.sceneId));
  sampleSceneIds.forEach((sceneId) => {
    if (!knownSceneIds.has(sceneId)) errors.push(`SAMPLE_SCENE_UNKNOWN:${sceneId}`);
  });
  if (
    manifest.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA &&
    sampleSceneIds.length === 1 &&
    sampleSceneIds[0] !== manifest.selectedSceneId
  ) {
    errors.push(
      `CUE_NATIVE_SAMPLE_SCENE_MISMATCH:expected=${manifest.selectedSceneId}:actual=${sampleSceneIds[0]}`,
    );
  }
  return errors;
}

export function validateCueNativeJobSampleBinding(job, manifest) {
  if (manifest?.sourceDirectorSchema !== CUE_NATIVE_DIRECTOR_SCHEMA) return [];
  const errors = [];
  if (job.sourceDirectorSchema !== CUE_NATIVE_DIRECTOR_SCHEMA) {
    errors.push('CUE_NATIVE_JOB_SOURCE_SCHEMA_MISMATCH');
  }
  errors.push(...validateSampleSceneIds(manifest, job.sampleSceneIds ?? []));
  return errors;
}

const normalizedBinding = (binding) => ({
  path: path.resolve(binding.path),
  sha256: binding.sha256,
});

const sameBinding = (left, right) =>
  left && right &&
  typeof left.path === 'string' &&
  typeof right.path === 'string' &&
  path.resolve(left.path) === path.resolve(right.path) &&
  left.sha256 === right.sha256;

export function firstFrameOutputRoots(jobPath) {
  const handoffRoot = path.dirname(path.resolve(jobPath));
  const imageRoot = path.join(handoffRoot, 'first-frames');
  const bakedImageRoot = path.join(handoffRoot, 'text-baked-first-frames');
  const qaRoot = path.join(handoffRoot, 'first-frame-qa');
  const calibrationRoot = path.join(qaRoot, 'anchor-calibrations');
  return {handoffRoot, imageRoot, bakedImageRoot, qaRoot, calibrationRoot};
}

export function preparedFirstFrameScenes(manifest, sampleSceneIds, jobPath) {
  const {imageRoot, bakedImageRoot, calibrationRoot} = firstFrameOutputRoots(jobPath);
  return manifest.scenes.map((scene) => JSON.parse(JSON.stringify({
    sceneId: scene.sceneId,
    pairId: scene.pairId,
    pairSha256: scene.pairSha256,
    beatId: scene.beatId,
    title: scene.title,
    aspectRatio: scene.aspectRatio,
    outputFileName: scene.outputFileName,
    outputPath: path.join(imageRoot, scene.outputFileName),
    firstFramePrompt: scene.firstFramePrompt,
    firstFramePromptSha256: scene.firstFramePromptSha256,
    textPlanSha256: scene.textPlanSha256,
    deterministicTextBake: {
      ...structuredClone(scene.deterministicTextBake),
      outputPath: path.join(
        bakedImageRoot,
        scene.deterministicTextBake.outputImageFileName,
      ),
      calibrationPath: path.join(calibrationRoot, `${scene.sceneId}.v1.json`),
    },
    ...(manifest.v9ContractEnabled === true
      ? {
          v9ContractEnabled: true,
          layoutContract: structuredClone(scene.layoutContract),
          layoutContractSha256: scene.layoutContractSha256,
        }
      : {}),
    selectedForSample: sampleSceneIds.includes(scene.sceneId),
    result: null,
    ...(scene.physicalContract ? {
      physicalContract: structuredClone(scene.physicalContract),
      physicalContractSha256: scene.physicalContractSha256,
      motionContract: structuredClone(scene.motionContract),
      motionContractSha256: scene.motionContractSha256,
    } : {}),
  })));
}

const withoutSceneResult = (scene) => {
  const snapshot = structuredClone(scene);
  delete snapshot.result;
  return snapshot;
};

export function preparedFirstFrameJobStaticContract({
  manifest,
  sampleSceneIds,
  jobPath,
  sourceManifest,
  directorValidationReceipt,
}) {
  return {
    schemaVersion: JOB_SCHEMA,
    taskId: manifest.taskId,
    requestId: manifest.requestId,
    ...(manifest.revisionId !== undefined ? {revisionId: manifest.revisionId} : {}),
    ...(manifest.policy !== undefined ? {policy: structuredClone(manifest.policy)} : {}),
    generationMode: 'image_gen-one-call-per-scene',
    maximumConcurrency: 2,
    automaticRetryAllowed: false,
    samplePolicy: manifest.samplePolicy ?? (manifest.v9ContractEnabled === true
      ? 'one-representative-scene'
      : 'legacy-three-representative-scenes'),
    ...(manifest.sourceDirectorSchema !== undefined
      ? {sourceDirectorSchema: manifest.sourceDirectorSchema}
      : {}),
    generatedReadableTextAllowed: false,
    sourceManifest: normalizedBinding(sourceManifest),
    directorValidationReceipt: normalizedBinding(directorValidationReceipt),
    output: firstFrameOutputRoots(jobPath),
    sampleSceneIds: structuredClone(sampleSceneIds),
    scenes: preparedFirstFrameScenes(manifest, sampleSceneIds, jobPath)
      .map(withoutSceneResult),
  };
}

const currentJobStaticContract = (job) => {
  const snapshot = {};
  for (const key of [
    'schemaVersion',
    'taskId',
    'requestId',
    'revisionId',
    'policy',
    'generationMode',
    'maximumConcurrency',
    'automaticRetryAllowed',
    'samplePolicy',
    'sourceDirectorSchema',
    'generatedReadableTextAllowed',
    'sourceManifest',
    'directorValidationReceipt',
    'output',
    'sampleSceneIds',
  ]) {
    if (Object.hasOwn(job, key)) snapshot[key] = structuredClone(job[key]);
  }
  snapshot.scenes = Array.isArray(job.scenes)
    ? job.scenes.map(withoutSceneResult)
    : job.scenes;
  return snapshot;
};

export function createFirstFrameRouteLock({
  manifest,
  sampleSceneIds,
  jobPath,
  sourceManifest,
  directorValidationReceipt,
  createdAt,
}) {
  const staticContract = preparedFirstFrameJobStaticContract({
    manifest,
    sampleSceneIds,
    jobPath,
    sourceManifest,
    directorValidationReceipt,
  });
  const cueNative = manifest.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA;
  const jobPathResolved = path.resolve(jobPath);
  const preparedSceneSnapshotSha256 = sha256Json(staticContract.scenes);
  return {
    schemaVersion: FIRSTFRAME_ROUTE_LOCK_SCHEMA,
    status: FIRSTFRAME_ROUTE_LOCK_STATUS,
    route: cueNative ? 'cue-native' : manifest.v9ContractEnabled === true ? 'v9' : 'legacy',
    cueNative,
    taskId: manifest.taskId,
    requestId: manifest.requestId,
    ...(manifest.revisionId !== undefined ? {revisionId: manifest.revisionId} : {}),
    sourceDirectorSchema: manifest.sourceDirectorSchema ?? null,
    selectedSceneId: manifest.selectedSceneId ?? null,
    samplePolicy: staticContract.samplePolicy,
    sampleSceneIds: structuredClone(sampleSceneIds),
    sourceManifest: normalizedBinding(sourceManifest),
    directorValidationReceipt: normalizedBinding(directorValidationReceipt),
    jobPath: jobPathResolved,
    handoffRoot: path.dirname(jobPathResolved),
    jobFileName: path.basename(jobPath),
    preparedSceneSnapshotSha256,
    jobStaticContractSha256: sha256Json(staticContract),
    createdAt,
  };
}

function readFixedFirstFrameRouteLock(job, jobPath) {
  if (!jobPath) return {routeLock: null, routeLockPath: null};
  const routeLockPath = path.join(
    path.dirname(path.resolve(jobPath)),
    FIRSTFRAME_ROUTE_LOCK_FILE_NAME,
  );
  if (!existsSync(routeLockPath)) return {routeLock: null, routeLockPath};
  let routeLock;
  try {
    routeLock = readJson(routeLockPath);
  } catch {
    throw new Error('FIRSTFRAME_ROUTE_LOCK_JSON_INVALID');
  }
  if (
    routeLock.schemaVersion !== FIRSTFRAME_ROUTE_LOCK_SCHEMA ||
    routeLock.status !== FIRSTFRAME_ROUTE_LOCK_STATUS ||
    !['cue-native', 'v9', 'legacy'].includes(routeLock.route) ||
    typeof routeLock.cueNative !== 'boolean' ||
    routeLock.jobPath !== path.resolve(jobPath) ||
    routeLock.handoffRoot !== path.dirname(path.resolve(jobPath)) ||
    routeLock.jobFileName !== path.basename(jobPath) ||
    typeof routeLock.preparedSceneSnapshotSha256 !== 'string' ||
    typeof routeLock.jobStaticContractSha256 !== 'string'
  ) {
    throw new Error('FIRSTFRAME_ROUTE_LOCK_INVALID');
  }
  if (
    routeLock.taskId !== job.taskId ||
    routeLock.requestId !== job.requestId ||
    (Object.hasOwn(routeLock, 'revisionId') || Object.hasOwn(job, 'revisionId')) &&
      routeLock.revisionId !== job.revisionId
  ) {
    throw new Error('FIRSTFRAME_ROUTE_LOCK_IDENTITY_MISMATCH');
  }
  if (!sameBinding(routeLock.sourceManifest, job.sourceManifest)) {
    throw new Error('FIRSTFRAME_ROUTE_LOCK_MANIFEST_BINDING_MISMATCH');
  }
  if (!sameBinding(routeLock.directorValidationReceipt, job.directorValidationReceipt)) {
    throw new Error('FIRSTFRAME_ROUTE_LOCK_RECEIPT_BINDING_MISMATCH');
  }
  return {routeLock, routeLockPath};
}

export function assertPreparedFirstFrameJobStaticContract({
  job,
  jobPath,
  manifest,
  routeLock,
}) {
  const expected = preparedFirstFrameJobStaticContract({
    manifest,
    sampleSceneIds: routeLock.sampleSceneIds,
    jobPath,
    sourceManifest: routeLock.sourceManifest,
    directorValidationReceipt: routeLock.directorValidationReceipt,
  });
  const actual = currentJobStaticContract(job);
  if (
    sha256Json(expected.scenes) !== routeLock.preparedSceneSnapshotSha256 ||
    sha256Json(actual.scenes) !== routeLock.preparedSceneSnapshotSha256
  ) {
    const expectedScenes = expected.scenes ?? [];
    const actualScenes = actual.scenes ?? [];
    const sceneId = expectedScenes.find((scene, index) =>
      sha256Json(scene) !== sha256Json(actualScenes[index]),
    )?.sceneId ?? (expectedScenes.length !== actualScenes.length ? 'scene-count' : 'unknown');
    throw new Error(`FIRSTFRAME_JOB_SCENE_SNAPSHOT_MISMATCH:${sceneId}`);
  }
  if (
    sha256Json(expected) !== routeLock.jobStaticContractSha256 ||
    sha256Json(actual) !== routeLock.jobStaticContractSha256
  ) {
    throw new Error('FIRSTFRAME_JOB_STATIC_CONTRACT_MISMATCH');
  }
}

export function readSignedSourceManifestChain(
  job,
  {allowGrandfatheredManifestPathAlias = false} = {},
) {
  const sourceBinding = job?.sourceManifest;
  if (
    !sourceBinding ||
    typeof sourceBinding.path !== 'string' ||
    !sourceBinding.path.trim() ||
    typeof sourceBinding.sha256 !== 'string' ||
    !sourceBinding.sha256.trim() ||
    !existsSync(sourceBinding.path) ||
    sha256File(sourceBinding.path) !== sourceBinding.sha256
  ) {
    throw new Error('SOURCE_MANIFEST_BINDING_INVALID');
  }

  const receiptBinding = job?.directorValidationReceipt;
  if (
    !receiptBinding ||
    typeof receiptBinding.path !== 'string' ||
    !receiptBinding.path.trim() ||
    typeof receiptBinding.sha256 !== 'string' ||
    !receiptBinding.sha256.trim() ||
    !existsSync(receiptBinding.path) ||
    sha256File(receiptBinding.path) !== receiptBinding.sha256
  ) {
    throw new Error('DIRECTOR_RECEIPT_BINDING_INVALID');
  }

  const directorReceipt = readJson(receiptBinding.path);
  if (
    directorReceipt.schemaVersion !== 'koubo-director-validation-receipt/v1' ||
    directorReceipt.status !== 'validated-provisional-previsualization' ||
    directorReceipt.skillExecuted !== true ||
    directorReceipt.validatorExecuted !== true
  ) {
    throw new Error('DIRECTOR_RECEIPT_STATUS_INVALID');
  }
  if (
    typeof job.taskId !== 'string' ||
    !job.taskId.trim() ||
    typeof job.requestId !== 'string' ||
    !job.requestId.trim() ||
    directorReceipt.taskId !== job.taskId ||
    directorReceipt.requestId !== job.requestId
  ) {
    throw new Error('DIRECTOR_RECEIPT_IDENTITY_MISMATCH');
  }
  const revisionIdentityPresent =
    Object.hasOwn(job, 'revisionId') || Object.hasOwn(directorReceipt, 'revisionId');
  if (
    revisionIdentityPresent &&
    (
      typeof job.revisionId !== 'string' ||
      !job.revisionId.trim() ||
      directorReceipt.revisionId !== job.revisionId
    )
  ) {
    throw new Error('DIRECTOR_RECEIPT_REVISION_MISMATCH');
  }

  const manifest = readJson(sourceBinding.path);
  const signedManifest = directorReceipt.artifacts?.firstFramePromptManifest;
  if (
    !signedManifest ||
    typeof signedManifest.path !== 'string' ||
    !signedManifest.path.trim() ||
    typeof signedManifest.sha256 !== 'string' ||
    !signedManifest.sha256.trim() ||
    signedManifest.sha256 !== sourceBinding.sha256
  ) {
    throw new Error('DIRECTOR_RECEIPT_MANIFEST_BINDING_MISMATCH');
  }
  const manifestPathMatches =
    path.resolve(signedManifest.path) === path.resolve(sourceBinding.path);
  const grandfatheredPathAliasValid =
    allowGrandfatheredManifestPathAlias === true &&
    manifest.sourceDirectorSchema !== CUE_NATIVE_DIRECTOR_SCHEMA &&
    !manifestPathMatches &&
    existsSync(signedManifest.path) &&
    sha256File(signedManifest.path) === signedManifest.sha256;
  if (!manifestPathMatches && !grandfatheredPathAliasValid) {
    throw new Error('DIRECTOR_RECEIPT_MANIFEST_BINDING_MISMATCH');
  }

  if (manifest.taskId !== job.taskId || manifest.requestId !== job.requestId) {
    throw new Error('SOURCE_MANIFEST_IDENTITY_MISMATCH');
  }
  if (
    Object.hasOwn(manifest, 'revisionId') || Object.hasOwn(job, 'revisionId') ||
    Object.hasOwn(directorReceipt, 'revisionId')
  ) {
    if (
      typeof manifest.revisionId !== 'string' ||
      !manifest.revisionId.trim() ||
      manifest.revisionId !== job.revisionId ||
      directorReceipt.revisionId !== job.revisionId
    ) {
      throw new Error('SOURCE_MANIFEST_REVISION_MISMATCH');
    }
  }
  return {
    manifest,
    directorReceipt,
    manifestPathAliasUsed: grandfatheredPathAliasValid,
  };
}

export function readAuthoritativeSourceManifest(job, jobPath) {
  const {routeLock, routeLockPath} = readFixedFirstFrameRouteLock(job, jobPath);
  const {manifest, directorReceipt, manifestPathAliasUsed} =
    readSignedSourceManifestChain(job, {
      allowGrandfatheredManifestPathAlias: !routeLock,
    });
  if (!routeLock) {
    if (manifest.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA) {
      throw new Error('CUE_NATIVE_FIRSTFRAME_ROUTE_LOCK_REQUIRED');
    }
    return {
      manifest,
      directorReceipt,
      routeLock: null,
      routeLockPath,
      manifestPathAliasUsed,
    };
  }
  if (
    routeLock.cueNative !==
      (manifest.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA) ||
    routeLock.route !== (manifest.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA
      ? 'cue-native'
      : manifest.v9ContractEnabled === true ? 'v9' : 'legacy') ||
    routeLock.sourceDirectorSchema !== (manifest.sourceDirectorSchema ?? null) ||
    routeLock.selectedSceneId !== (manifest.selectedSceneId ?? null) ||
    routeLock.samplePolicy !== (manifest.samplePolicy ?? (manifest.v9ContractEnabled === true
      ? 'one-representative-scene'
      : 'legacy-three-representative-scenes')) ||
    !Array.isArray(routeLock.sampleSceneIds) ||
    validateSampleSceneIds(manifest, routeLock.sampleSceneIds).length > 0
  ) {
    throw new Error('FIRSTFRAME_ROUTE_LOCK_SOURCE_CONTRACT_MISMATCH');
  }
  assertPreparedFirstFrameJobStaticContract({job, jobPath, manifest, routeLock});
  return {
    manifest,
    directorReceipt,
    routeLock,
    routeLockPath,
    manifestPathAliasUsed: false,
  };
}

export function validateCueNativeSampleAcceptanceBinding(job, manifest) {
  const cueNative =
    job?.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA ||
    manifest?.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA;
  if (!cueNative) return [];

  const errors = [];
  if (manifest?.sourceDirectorSchema !== CUE_NATIVE_DIRECTOR_SCHEMA) {
    errors.push('CUE_NATIVE_SOURCE_MANIFEST_REQUIRED');
    return errors;
  }
  errors.push(...validateCueNativeJobSampleBinding(job, manifest));

  const binding = job.sampleUserAcceptanceReceipt;
  if (
    !binding ||
    typeof binding.path !== 'string' ||
    !binding.path.trim() ||
    typeof binding.sha256 !== 'string' ||
    !binding.sha256.trim()
  ) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_BINDING_REQUIRED');
    return errors;
  }
  const acceptancePath = path.resolve(binding.path);
  if (!job.output?.handoffRoot || !isInside(job.output.handoffRoot, acceptancePath)) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_OUTSIDE_HANDOFF');
    return errors;
  }
  if (!existsSync(acceptancePath)) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_FILE_MISSING');
    return errors;
  }
  if (sha256File(acceptancePath) !== binding.sha256) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_SHA_MISMATCH');
    return errors;
  }

  let acceptance;
  try {
    acceptance = readJson(acceptancePath);
  } catch {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_JSON_INVALID');
    return errors;
  }
  const selectedSceneId = manifest.selectedSceneId;
  const selectedScene = job.scenes?.find((scene) => scene.sceneId === selectedSceneId);
  const sample = acceptance.textBakedSample;
  const authorizationCompatibleStatuses = new Set([
    'candidate-text-baked-firstframes-awaiting-user-review',
    'full-generation-authorized',
    'batch-awaiting-user-review',
    'text-baked-firstframes-awaiting-user-review',
  ]);
  if (!authorizationCompatibleStatuses.has(job.status)) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_JOB_STATUS_INVALID');
  }
  if (acceptance.schemaVersion !== CUE_NATIVE_SAMPLE_ACCEPTANCE_SCHEMA) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_SCHEMA_INVALID');
  }
  if (
    acceptance.status !== 'approved-for-cue-native-full-batch' ||
    acceptance.approved !== true ||
    acceptance.scope !== 'cue-native-text-baked-representative-firstframe'
  ) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_STATUS_INVALID');
  }
  if (
    acceptance.taskId !== job.taskId ||
    acceptance.requestId !== job.requestId ||
    acceptance.revisionId !== job.revisionId
  ) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_IDENTITY_MISMATCH');
  }
  if (acceptance.selectedSceneId !== selectedSceneId) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_SCENE_MISMATCH');
  }
  if (
    typeof acceptance.userQuote !== 'string' ||
    !acceptance.userQuote.trim() ||
    typeof acceptance.approvedAt !== 'string' ||
    !acceptance.approvedAt.trim() ||
    !Number.isFinite(Date.parse(acceptance.approvedAt))
  ) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_USER_EVIDENCE_INVALID');
  }
  if (
    acceptance.sourceManifest?.path !== job.sourceManifest?.path ||
    acceptance.sourceManifest?.sha256 !== job.sourceManifest?.sha256 ||
    !existsSync(job.sourceManifest?.path ?? '') ||
    sha256File(job.sourceManifest.path) !== job.sourceManifest.sha256
  ) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_SOURCE_MANIFEST_INVALID');
  }
  if (
    !selectedScene ||
    sample?.sceneId !== selectedSceneId ||
    typeof sample?.path !== 'string' ||
    path.resolve(sample.path) !== path.resolve(selectedScene?.deterministicTextBake?.outputPath ?? '') ||
    typeof sample?.sha256 !== 'string' ||
    !existsSync(sample?.path ?? '') ||
    sha256File(sample.path) !== sample.sha256
  ) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_TEXT_BAKED_ASSET_INVALID');
  }

  const rawResult = selectedScene?.result;
  const rawReviewPath = rawResult?.visualReview?.path ??
    (job.output?.qaRoot ? path.join(job.output.qaRoot, `${selectedSceneId}.visual-review.v1.json`) : '');
  if (
    !rawResult?.imagePath ||
    !rawResult?.imageSha256 ||
    !existsSync(rawResult.imagePath) ||
    sha256File(rawResult.imagePath) !== rawResult.imageSha256 ||
    !rawReviewPath ||
    !existsSync(rawReviewPath)
  ) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_RAW_RESULT_INVALID');
  } else {
    const rawReview = readJson(rawReviewPath);
    const rawReviewErrors = validateRawVisualReview(selectedScene, rawReview, {
      sourceScene: manifest.scenes?.find((scene) => scene.sceneId === selectedSceneId),
      policy: manifest.policy,
    });
    if (rawReviewErrors.length) {
      errors.push(`CUE_NATIVE_SAMPLE_ACCEPTANCE_RAW_REVIEW_INVALID:${rawReviewErrors.join(',')}`);
    }
  }

  const sampleBakeRecords = (job.textBakeReceipts ?? []).filter(
    (record) => record.phase === 'sample' &&
      Array.isArray(record.sceneIds) &&
      record.sceneIds.length === 1 &&
      record.sceneIds[0] === selectedSceneId,
  );
  const latestSampleBake = sampleBakeRecords.at(-1);
  if (
    !latestSampleBake?.receipt?.path ||
    !latestSampleBake.receipt.sha256 ||
    !isInside(job.output?.handoffRoot ?? '', latestSampleBake.receipt.path) ||
    !existsSync(latestSampleBake.receipt.path) ||
    sha256File(latestSampleBake.receipt.path) !== latestSampleBake.receipt.sha256
  ) {
    errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_TEXT_BAKE_RECEIPT_BINDING_INVALID');
  } else {
    const bakeReceipt = readJson(latestSampleBake.receipt.path);
    const bakedScene = bakeReceipt.scenes?.find((scene) => scene.sceneId === selectedSceneId);
    const expectedNodeIds = selectedScene?.deterministicTextBake?.labels?.map((label) => label.nodeId) ?? [];
    const ocrNodeIds = bakedScene?.ocr?.map((entry) => entry.nodeId) ?? [];
    if (
      bakeReceipt.schemaVersion !== TEXT_BAKE_RECEIPT_SCHEMA ||
      bakeReceipt.status !== 'deterministic-first-frame-text-baked-and-ocr-passed' ||
      bakeReceipt.taskId !== job.taskId ||
      bakeReceipt.scenes?.length !== 1 ||
      !bakedScene ||
      bakedScene.pairId !== selectedScene?.pairId ||
      bakedScene.pairSha256 !== selectedScene?.pairSha256 ||
      bakedScene.textPlanSha256 !== selectedScene?.textPlanSha256 ||
      bakedScene.labelsSha256 !== selectedScene?.deterministicTextBake?.labelsSha256 ||
      bakedScene.outputImage?.path !== sample?.path ||
      bakedScene.outputImage?.sha256 !== sample?.sha256 ||
      ocrNodeIds.length !== expectedNodeIds.length ||
      new Set(ocrNodeIds).size !== expectedNodeIds.length ||
      !expectedNodeIds.every((nodeId) => ocrNodeIds.includes(nodeId)) ||
      (bakedScene?.ocr ?? []).some((entry) =>
        entry.matched !== true ||
        entry.expected !== entry.recognized ||
        entry.evaluationStage !== 'final-composite' ||
        entry.inputImageSha256 !== sample?.sha256
      )
    ) {
      errors.push('CUE_NATIVE_SAMPLE_ACCEPTANCE_TEXT_BAKE_RECEIPT_INVALID');
    }
  }
  return errors;
}

export function isFullBatchAuthorized(job, manifest) {
  const cueNative =
    job.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA ||
    manifest?.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA;
  if (cueNative) {
    return job.fullBatchAuthorized === true &&
      validateCueNativeSampleAcceptanceBinding(job, manifest).length === 0;
  }
  if (job.fullBatchAuthorized === true) return true;
  if (Object.hasOwn(job, 'fullBatchAuthorized')) return false;
  return LEGACY_FULL_BATCH_AUTHORIZED_STATUSES.has(job.status);
}

export function assertFullBatchAuthorized(job, operation, manifest) {
  const cueNative =
    job.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA ||
    manifest?.sourceDirectorSchema === CUE_NATIVE_DIRECTOR_SCHEMA;
  if (cueNative && job.fullBatchAuthorized === true) {
    const errors = validateCueNativeSampleAcceptanceBinding(job, manifest);
    if (errors.length) {
      throw new Error(`CUE_NATIVE_FULL_BATCH_ACCEPTANCE_INVALID:${operation}:${errors.join('|')}`);
    }
  }
  if (!isFullBatchAuthorized(job, manifest)) {
    throw new Error(`FULL_BATCH_NOT_AUTHORIZED:${operation}`);
  }
}

export function imageDimensions(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && buffer.length >= 24) {
    return {format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {format: 'jpeg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7)};
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  throw new Error(`IMAGE_FORMAT_UNSUPPORTED:${filePath}`);
}

export function requiredSceneIds(job, phase) {
  if (phase === 'sample') return job.sampleSceneIds;
  if (phase === 'full') return job.scenes.map((scene) => scene.sceneId);
  throw new Error(`PHASE_INVALID:${phase}`);
}
