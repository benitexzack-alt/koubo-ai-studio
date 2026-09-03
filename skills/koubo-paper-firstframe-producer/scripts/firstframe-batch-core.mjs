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

export const sha256Buffer = (buffer) =>
  createHash('sha256').update(buffer).digest('hex');
export const sha256File = (filePath) => sha256Buffer(readFileSync(filePath));
export const sha256Text = (value) => sha256Buffer(Buffer.from(value, 'utf8'));

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
  if (manifest.schemaVersion !== MANIFEST_SCHEMA) errors.push('MANIFEST_SCHEMA_INVALID');
  if (manifest.status !== 'automation-input-ready') errors.push('MANIFEST_STATUS_INVALID');
  if (manifest.consumer !== 'first-frame-image-automation') errors.push('MANIFEST_CONSUMER_INVALID');
  if (manifest.generatedReadableTextAllowed !== false) errors.push('GENERATED_TEXT_NOT_BLOCKED');
  if (!Array.isArray(manifest.scenes) || manifest.scenes.length === 0) {
    errors.push('MANIFEST_SCENES_EMPTY');
    return errors;
  }
  if (manifest.sceneCount !== manifest.scenes.length) errors.push('SCENE_COUNT_MISMATCH');

  const sceneIds = new Set();
  const pairIds = new Set();
  const outputNames = new Set();
  const bakedOutputNames = new Set();
  manifest.scenes.forEach((scene, index) => {
    const suffix = scene.sceneId || String(index);
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
  });
  return errors;
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
