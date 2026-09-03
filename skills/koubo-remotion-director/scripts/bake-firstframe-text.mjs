#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildSceneIdentity,
  isText,
  resolveDeclared,
  sha256File,
  sha256Json,
} from './preproduction-director-core.mjs';

const SCHEMA = 'koubo-paper-firstframe-text-bake-request/v1';
const CALIBRATION_SCHEMA = 'koubo-paper-firstframe-anchor-calibration/v1';
const LABEL_WIDTH = 1000;
const LABEL_HEIGHT = 240;
const OCR_SCALE_PERCENT = 400;
const OCR_BORDER_PIXELS = 160;
const TEXT_POINT_SIZE_CANDIDATES = [108, 120, 96, 132];
const OCR_VARIANTS = [
  {id: 'lanczos-t50', filter: 'Lanczos', thresholdPercent: 50},
  {id: 'box-t50', filter: 'Box', thresholdPercent: 50},
  {id: 'lanczos-t60', filter: 'Lanczos', thresholdPercent: 60},
  {id: 'box-t35', filter: 'Box', thresholdPercent: 35},
  {id: 'point-t55', filter: 'Point', thresholdPercent: 55},
];
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProjectRoot = path.resolve(skillRoot, '../..');
const visionOcrSourcePath = path.join(skillRoot, 'scripts/recognize-text-vision.swift');

const parseArgs = (argv) => {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    values[argv[index].slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
};

const run = (binary, args, code) => {
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${code}:${String(result.stderr ?? result.error?.message ?? '').trim()}`);
  }
  return String(result.stdout ?? '').trim();
};

const normalizeOcr = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]+/gu, '');

const validateQuad = (quad) =>
  Array.isArray(quad) &&
  quad.length === 4 &&
  quad.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      point.every((value) => Number.isFinite(value) && value >= 0 && value <= 1),
  );

const identify = (imagePath) => {
  const output = run('magick', ['identify', '-format', '%w %h', imagePath], 'TEXT_BAKE_IDENTIFY_FAILED');
  const [width, height] = output.split(/\s+/u).map(Number);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('TEXT_BAKE_IMAGE_DIMENSIONS_INVALID');
  }
  return {width, height};
};

const renderLabel = ({
  label,
  anchorQuad,
  canvas,
  fontPath,
  inputPath,
  outputPath,
  workRoot,
  index,
  pointSize,
}) => {
  const labelPath = path.join(workRoot, `label-${index}.png`);
  const warpedPath = path.join(workRoot, `warped-${index}.png`);
  const destination = anchorQuad.map(([x, y]) => [x * canvas.width, y * canvas.height]);
  const points = [
    [0, 0, ...destination[0]],
    [LABEL_WIDTH, 0, ...destination[1]],
    [LABEL_WIDTH, LABEL_HEIGHT, ...destination[2]],
    [0, LABEL_HEIGHT, ...destination[3]],
  ]
    .map((point) => `${point[0]},${point[1]} ${point[2]},${point[3]}`)
    .join(' ');

  run(
    'magick',
    [
      '-size',
      `${LABEL_WIDTH}x${LABEL_HEIGHT}`,
      'xc:none',
      '-font',
      fontPath,
      '-fill',
      '#14272D',
      '-gravity',
      'center',
      '-pointsize',
      String(pointSize),
      '-annotate',
      '0',
      label.text,
      labelPath,
    ],
    'TEXT_BAKE_LABEL_RENDER_FAILED',
  );
  run(
    'magick',
    [
      labelPath,
      '-alpha',
      'set',
      '-virtual-pixel',
      'transparent',
      '-define',
      `distort:viewport=${canvas.width}x${canvas.height}+0+0`,
      '-distort',
      'Perspective',
      points,
      warpedPath,
    ],
    'TEXT_BAKE_PERSPECTIVE_FAILED',
  );
  run('magick', [inputPath, warpedPath, '-composite', outputPath], 'TEXT_BAKE_COMPOSITE_FAILED');
};

const rectifyLabelForOcr = ({inputPath, anchorQuad, canvas, outputPath, variant}) => {
  const source = anchorQuad.map(([x, y]) => [x * canvas.width, y * canvas.height]);
  const destination = [
    [0, 0],
    [LABEL_WIDTH - 1, 0],
    [LABEL_WIDTH - 1, LABEL_HEIGHT - 1],
    [0, LABEL_HEIGHT - 1],
  ];
  const points = source
    .map(([sourceX, sourceY], index) => {
      const [destinationX, destinationY] = destination[index];
      return `${sourceX},${sourceY} ${destinationX},${destinationY}`;
    })
    .join(' ');

  run(
    'magick',
    [
      inputPath,
      '-alpha',
      'off',
      '-virtual-pixel',
      'white',
      '-filter',
      variant.filter,
      '-define',
      `distort:viewport=${LABEL_WIDTH}x${LABEL_HEIGHT}+0+0`,
      '-distort',
      'Perspective',
      points,
      '-colorspace',
      'Gray',
      '-resize',
      `${OCR_SCALE_PERCENT}%`,
      '-contrast-stretch',
      '1%x1%',
      '-threshold',
      `${variant.thresholdPercent}%`,
      '-bordercolor',
      'white',
      '-border',
      String(OCR_BORDER_PIXELS),
      outputPath,
    ],
    'TEXT_BAKE_OCR_RECTIFICATION_FAILED',
  );
};

const createVisionRecognizer = (workRoot) => {
  if (process.platform !== 'darwin' || !existsSync(visionOcrSourcePath)) return null;
  let binaryPath = null;
  return (imagePath) => {
    if (!binaryPath) {
      binaryPath = path.join(workRoot, 'recognize-text-vision');
      run(
        'swiftc',
        [visionOcrSourcePath, '-o', binaryPath],
        'TEXT_BAKE_VISION_OCR_COMPILE_FAILED',
      );
    }
    return run(binaryPath, [imagePath], 'TEXT_BAKE_VISION_OCR_FAILED');
  };
};

const recognizeLabel = ({
  inputPath,
  anchorQuad,
  canvas,
  workRoot,
  artifactPrefix,
  expectedText,
  visionRecognize,
}) => {
  const attempts = [];
  const rectifiedInputs = [];
  for (const variant of OCR_VARIANTS) {
    const ocrInputPath = path.join(workRoot, `${artifactPrefix}-${variant.id}.png`);
    rectifyLabelForOcr({
      inputPath,
      anchorQuad,
      canvas,
      outputPath: ocrInputPath,
      variant,
    });
    rectifiedInputs.push({variant, ocrInputPath});
    const text = run(
      'tesseract',
      [ocrInputPath, 'stdout', '-l', 'chi_sim', '--psm', '7'],
      'TEXT_BAKE_OCR_FAILED',
    );
    const attempt = {
      engine: 'tesseract',
      variantId: variant.id,
      filter: variant.filter,
      thresholdPercent: variant.thresholdPercent,
      recognized: text,
      normalized: normalizeOcr(text),
    };
    attempts.push(attempt);
    if (attempt.normalized === normalizeOcr(expectedText)) {
      return {matched: true, selectedAttempt: attempt, attempts};
    }
  }
  if (visionRecognize) {
    for (const {variant, ocrInputPath} of rectifiedInputs) {
      const text = visionRecognize(ocrInputPath);
      const attempt = {
        engine: 'apple-vision',
        variantId: `vision-${variant.id}`,
        sourceVariantId: variant.id,
        filter: variant.filter,
        thresholdPercent: variant.thresholdPercent,
        recognized: text,
        normalized: normalizeOcr(text),
      };
      attempts.push(attempt);
      if (attempt.normalized === normalizeOcr(expectedText)) {
        return {matched: true, selectedAttempt: attempt, attempts};
      }
    }
  }
  return {matched: false, selectedAttempt: null, attempts};
};

const args = parseArgs(process.argv.slice(2));
const projectRoot = path.resolve(args['repo-root'] ?? defaultProjectRoot);
const requestPath = resolveDeclared(projectRoot, args.request);
if (!requestPath || !existsSync(requestPath)) {
  console.error('TEXT_BAKE_REQUEST_MISSING');
  process.exit(1);
}

let workRoot;
try {
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));
  if (request.schemaVersion !== SCHEMA) throw new Error('TEXT_BAKE_SCHEMA_INVALID');
  if (!isText(request.taskId)) throw new Error('TEXT_BAKE_TASK_ID_MISSING');
  const sourcePlanPath = resolveDeclared(projectRoot, request.sourcePlan?.path);
  if (!sourcePlanPath || !existsSync(sourcePlanPath)) throw new Error('TEXT_BAKE_SOURCE_PLAN_MISSING');
  if (sha256File(sourcePlanPath) !== request.sourcePlan?.sha256) {
    throw new Error('TEXT_BAKE_SOURCE_PLAN_SHA_MISMATCH');
  }
  const sourcePlan = JSON.parse(readFileSync(sourcePlanPath, 'utf8'));
  if (sourcePlan.taskId !== request.taskId) throw new Error('TEXT_BAKE_SOURCE_PLAN_TASK_MISMATCH');
  const sourceScenes = Array.isArray(sourcePlan.paperScenes) ? sourcePlan.paperScenes : [];
  const sourceSceneById = new Map(
    sourceScenes.map((scene, index) => [buildSceneIdentity(scene, index).sceneId, {scene, index}]),
  );
  const fontPath = resolveDeclared(projectRoot, request.fontPath);
  if (!fontPath || !existsSync(fontPath)) throw new Error('TEXT_BAKE_FONT_MISSING');
  const receiptPath = resolveDeclared(projectRoot, request.receiptPath);
  if (!receiptPath || existsSync(receiptPath)) throw new Error('TEXT_BAKE_RECEIPT_PATH_INVALID');
  const scenes = Array.isArray(request.scenes) ? request.scenes : [];
  if (scenes.length === 0) throw new Error('TEXT_BAKE_SCENES_EMPTY');
  workRoot = mkdtempSync(path.join(os.tmpdir(), 'koubo-paper-text-bake-'));
  const visionRecognize = createVisionRecognizer(workRoot);
  const sceneReceipts = [];

  for (const scene of scenes) {
    if (!isText(scene.sceneId) || !isText(scene.pairId) || !isText(scene.pairSha256)) {
      throw new Error('TEXT_BAKE_SCENE_IDENTITY_INVALID');
    }
    const sourceEntry = sourceSceneById.get(scene.sceneId);
    if (!sourceEntry) throw new Error(`TEXT_BAKE_SOURCE_SCENE_MISSING:${scene.sceneId}`);
    const identity = buildSceneIdentity(sourceEntry.scene, sourceEntry.index);
    if (
      scene.pairId !== identity.pairId ||
      scene.pairSha256 !== identity.pairSha256 ||
      scene.textPlanSha256 !== identity.textPlanSha256
    ) {
      throw new Error(`TEXT_BAKE_SCENE_IDENTITY_MISMATCH:${scene.sceneId}`);
    }
    const sourcePath = resolveDeclared(projectRoot, scene.sourceImage?.path);
    const outputPath = resolveDeclared(projectRoot, scene.outputImage?.path);
    if (!sourcePath || !existsSync(sourcePath)) throw new Error(`TEXT_BAKE_SOURCE_MISSING:${scene.sceneId}`);
    if (sha256File(sourcePath) !== scene.sourceImage.sha256) {
      throw new Error(`TEXT_BAKE_SOURCE_SHA_MISMATCH:${scene.sceneId}`);
    }
    if (!outputPath || existsSync(outputPath)) throw new Error(`TEXT_BAKE_OUTPUT_PATH_INVALID:${scene.sceneId}`);
    const labels = Array.isArray(scene.labels) ? scene.labels : [];
    if (labels.length === 0) throw new Error(`TEXT_BAKE_LABELS_EMPTY:${scene.sceneId}`);
    for (const label of labels) {
      if (
        !isText(label.nodeId) ||
        !isText(label.text) ||
        [...label.text].length > 8 ||
        label.embeddingMode !== 'first-frame-baked' ||
        label.motionConstraint !== 'rigid-surface' ||
        label.ocrRequired !== true ||
        !validateQuad(label.anchorQuad)
      ) {
        throw new Error(`TEXT_BAKE_LABEL_INVALID:${scene.sceneId}:${label?.nodeId ?? 'unknown'}`);
      }
    }
    const expectedLabels = sourceEntry.scene.textPlan.filter(
      (item) => item.embeddingMode === 'first-frame-baked',
    );
    if (
      !isText(scene.textPlanSha256) ||
      sha256Json(labels) !== scene.labelsSha256 ||
      sha256Json(labels) !== sha256Json(expectedLabels)
    ) {
      throw new Error(`TEXT_BAKE_LABELS_SHA_MISMATCH:${scene.sceneId}`);
    }
    const calibratedAnchors = Array.isArray(scene.calibratedAnchors)
      ? scene.calibratedAnchors
      : [];
    if (scene.anchorCalibrationRequired === true) {
      const calibrationPath = resolveDeclared(projectRoot, scene.anchorCalibration?.path);
      if (
        !calibrationPath ||
        !scene.anchorCalibration?.sha256 ||
        !existsSync(calibrationPath) ||
        sha256File(calibrationPath) !== scene.anchorCalibration.sha256
      ) {
        throw new Error(`TEXT_BAKE_ANCHOR_CALIBRATION_INVALID:${scene.sceneId}`);
      }
      const calibration = JSON.parse(readFileSync(calibrationPath, 'utf8'));
      if (
        calibration.schemaVersion !== CALIBRATION_SCHEMA ||
        calibration.sceneId !== scene.sceneId ||
        calibration.status !== 'passed' ||
        resolveDeclared(projectRoot, calibration.sourceImage?.path) !== sourcePath ||
        calibration.sourceImage?.sha256 !== scene.sourceImage.sha256
      ) {
        throw new Error(`TEXT_BAKE_ANCHOR_CALIBRATION_CONTENT_INVALID:${scene.sceneId}`);
      }
      if (calibratedAnchors.length !== labels.length) {
        throw new Error(`TEXT_BAKE_CALIBRATED_ANCHOR_COUNT_INVALID:${scene.sceneId}`);
      }
      const calibrationLabels = Array.isArray(calibration.labels) ? calibration.labels : [];
      if (
        calibrationLabels.length !== calibratedAnchors.length ||
        calibrationLabels.some((item, index) => {
          const declared = calibratedAnchors[index];
          return item.nodeId !== declared?.nodeId ||
            item.placementChecked !== true ||
            !validateQuad(item.anchorQuad) ||
            JSON.stringify(item.anchorQuad) !== JSON.stringify(declared.anchorQuad);
        })
      ) {
        throw new Error(`TEXT_BAKE_ANCHOR_CALIBRATION_BINDING_INVALID:${scene.sceneId}`);
      }
    }
    const calibratedByNode = new Map(
      calibratedAnchors.map((item) => [item.nodeId, item.anchorQuad]),
    );
    const canvas = identify(sourcePath);
    let currentPath = sourcePath;
    const ocr = [];
    for (const [index, label] of labels.entries()) {
      const effectiveAnchorQuad = scene.anchorCalibrationRequired === true
        ? calibratedByNode.get(label.nodeId)
        : label.anchorQuad;
      if (!validateQuad(effectiveAnchorQuad)) {
        throw new Error(`TEXT_BAKE_EFFECTIVE_ANCHOR_INVALID:${scene.sceneId}:${label.nodeId}`);
      }
      const typographyAttempts = [];
      let selectedTypography = null;
      for (const pointSize of TEXT_POINT_SIZE_CANDIDATES) {
        const artifactPrefix = `${scene.sceneId}-${index}-ps${pointSize}`;
        const candidatePath = path.join(workRoot, `${artifactPrefix}.png`);
        renderLabel({
          label,
          anchorQuad: effectiveAnchorQuad,
          canvas,
          fontPath,
          inputPath: currentPath,
          outputPath: candidatePath,
          workRoot,
          index: artifactPrefix,
          pointSize,
        });
        const recognition = recognizeLabel({
          inputPath: candidatePath,
          anchorQuad: effectiveAnchorQuad,
          canvas,
          workRoot,
          artifactPrefix: `${artifactPrefix}-ocr`,
          expectedText: label.text,
          visionRecognize,
        });
        typographyAttempts.push({pointSize, ocrAttempts: recognition.attempts});
        if (recognition.matched) {
          selectedTypography = {
            pointSize,
            candidatePath,
            selectedOcrAttempt: recognition.selectedAttempt,
          };
          break;
        }
      }
      if (!selectedTypography) {
        throw new Error(
          `TEXT_BAKE_OCR_MISMATCH:${scene.sceneId}:${label.nodeId}:${typographyAttempts.map((typography) => `ps${typography.pointSize}[${typography.ocrAttempts.map((attempt) => `${attempt.variantId}=${attempt.normalized}`).join(',')}]`).join(';')}`,
        );
      }
      currentPath = selectedTypography.candidatePath;
      ocr.push({
        nodeId: label.nodeId,
        expected: label.text,
        recognized: selectedTypography.selectedOcrAttempt.recognized,
        matched: true,
        rendering: {
          fontPath,
          pointSize: selectedTypography.pointSize,
          pointSizeCandidates: TEXT_POINT_SIZE_CANDIDATES,
        },
        preprocessing: {
          mode: 'inverse-perspective-dual-ocr-v1',
          rectifiedSize: {width: LABEL_WIDTH, height: LABEL_HEIGHT},
          scalePercent: OCR_SCALE_PERCENT,
          borderPixels: OCR_BORDER_PIXELS,
          pageSegmentationMode: 7,
          language: 'chi_sim',
          selectedEngine: selectedTypography.selectedOcrAttempt.engine,
          recognitionPolicy: 'tesseract-then-apple-vision-exact-match-v1',
          selectedVariantId: selectedTypography.selectedOcrAttempt.variantId,
          typographyAttempts,
        },
      });
    }
    sceneReceipts.push({
      sceneId: scene.sceneId,
      pairId: scene.pairId,
      pairSha256: scene.pairSha256,
      textPlanSha256: scene.textPlanSha256,
      labelsSha256: scene.labelsSha256,
      anchorCalibration: scene.anchorCalibrationRequired === true
        ? scene.anchorCalibration
        : null,
      calibratedAnchors: scene.anchorCalibrationRequired === true
        ? calibratedAnchors
        : [],
      sourceImage: {path: sourcePath, sha256: scene.sourceImage.sha256, ...canvas},
      outputImage: {path: outputPath, sha256: sha256File(currentPath), ...canvas},
      ocr,
      stagedOutputPath: currentPath,
    });
  }

  for (const sceneReceipt of sceneReceipts) {
    mkdirSync(path.dirname(sceneReceipt.outputImage.path), {recursive: true});
    copyFileSync(
      sceneReceipt.stagedOutputPath,
      sceneReceipt.outputImage.path,
      constants.COPYFILE_EXCL,
    );
    if (sha256File(sceneReceipt.outputImage.path) !== sceneReceipt.outputImage.sha256) {
      throw new Error(`TEXT_BAKE_OUTPUT_SHA_MISMATCH:${sceneReceipt.sceneId}`);
    }
    delete sceneReceipt.stagedOutputPath;
  }

  const receipt = {
    schemaVersion: 'koubo-paper-firstframe-text-bake-receipt/v1',
    taskId: request.taskId,
    request: {path: requestPath, sha256: sha256File(requestPath)},
    status: 'deterministic-first-frame-text-baked-and-ocr-passed',
    modelGeneratedReadableTextAllowed: false,
    sourcePlan: {path: sourcePlanPath, sha256: request.sourcePlan.sha256},
    scenes: sceneReceipts,
  };
  mkdirSync(path.dirname(receiptPath), {recursive: true});
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(JSON.stringify({ok: true, receiptPath, sceneCount: sceneReceipts.length}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (workRoot) rmSync(workRoot, {recursive: true, force: true});
}
