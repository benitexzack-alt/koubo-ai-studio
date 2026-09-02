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
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProjectRoot = path.resolve(skillRoot, '../..');

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

const cropBounds = (quad, width, height) => {
  const xs = quad.map((point) => point[0] * width);
  const ys = quad.map((point) => point[1] * height);
  const left = Math.max(0, Math.floor(Math.min(...xs)) - 12);
  const top = Math.max(0, Math.floor(Math.min(...ys)) - 12);
  const right = Math.min(width, Math.ceil(Math.max(...xs)) + 12);
  const bottom = Math.min(height, Math.ceil(Math.max(...ys)) + 12);
  return {left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top)};
};

const renderLabel = ({label, canvas, fontPath, inputPath, outputPath, workRoot, index}) => {
  const labelWidth = 1000;
  const labelHeight = 240;
  const labelPath = path.join(workRoot, `label-${index}.png`);
  const warpedPath = path.join(workRoot, `warped-${index}.png`);
  const destination = label.anchorQuad.map(([x, y]) => [x * canvas.width, y * canvas.height]);
  const points = [
    [0, 0, ...destination[0]],
    [labelWidth, 0, ...destination[1]],
    [labelWidth, labelHeight, ...destination[2]],
    [0, labelHeight, ...destination[3]],
  ]
    .map((point) => `${point[0]},${point[1]} ${point[2]},${point[3]}`)
    .join(' ');

  run(
    'magick',
    [
      '-size',
      `${labelWidth}x${labelHeight}`,
      'xc:none',
      '-font',
      fontPath,
      '-fill',
      '#14272D',
      '-gravity',
      'center',
      '-pointsize',
      '108',
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
    const canvas = identify(sourcePath);
    let currentPath = sourcePath;
    labels.forEach((label, index) => {
      const nextPath = path.join(workRoot, `${scene.sceneId}-${index}.png`);
      renderLabel({
        label,
        canvas,
        fontPath,
        inputPath: currentPath,
        outputPath: nextPath,
        workRoot,
        index: `${scene.sceneId}-${index}`,
      });
      currentPath = nextPath;
    });
    const ocr = [];
    for (const [index, label] of labels.entries()) {
      const bounds = cropBounds(label.anchorQuad, canvas.width, canvas.height);
      const cropPath = path.join(workRoot, `${scene.sceneId}-ocr-${index}.png`);
      run(
        'magick',
        [
          currentPath,
          '-crop',
          `${bounds.width}x${bounds.height}+${bounds.left}+${bounds.top}`,
          '+repage',
          '-resize',
          '200%',
          cropPath,
        ],
        'TEXT_BAKE_OCR_CROP_FAILED',
      );
      const text = run(
        'tesseract',
        [cropPath, 'stdout', '-l', 'chi_sim+eng', '--psm', '7'],
        'TEXT_BAKE_OCR_FAILED',
      );
      const matched = normalizeOcr(text).includes(normalizeOcr(label.text));
      if (!matched) {
        throw new Error(
          `TEXT_BAKE_OCR_MISMATCH:${scene.sceneId}:${label.nodeId}:${normalizeOcr(text)}`,
        );
      }
      ocr.push({nodeId: label.nodeId, expected: label.text, recognized: text, matched});
    }
    sceneReceipts.push({
      sceneId: scene.sceneId,
      pairId: scene.pairId,
      pairSha256: scene.pairSha256,
      textPlanSha256: scene.textPlanSha256,
      labelsSha256: scene.labelsSha256,
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
