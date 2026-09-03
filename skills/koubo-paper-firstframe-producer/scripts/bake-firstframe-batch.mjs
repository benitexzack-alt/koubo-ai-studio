#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  JOB_SCHEMA,
  REVIEW_SCHEMA,
  TEXT_BAKE_CALIBRATION_SCHEMA,
  parseArgs,
  readJson,
  replaceJson,
  requiredSceneIds,
  resolveInside,
  sha256File,
  writeNewJson,
} from './firstframe-batch-core.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProjectRoot = path.resolve(skillRoot, '../..');

const isQuad = (quad) =>
  Array.isArray(quad) &&
  quad.length === 4 &&
  quad.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      point.every((value) => Number.isFinite(value) && value >= 0 && value <= 1),
  );

const nextArtifactVersion = (qaRoot, phase) => {
  const escapedPhase = phase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const patterns = [
    new RegExp(`^${escapedPhase}-text-bake-request\\.v(\\d+)\\.json$`, 'u'),
    new RegExp(`^${escapedPhase}-text-bake-request\\.failed-v(\\d+)\\.json$`, 'u'),
    new RegExp(`^${escapedPhase}-text-bake-receipt\\.v(\\d+)\\.json$`, 'u'),
  ];
  const usedVersions = readdirSync(qaRoot, {withFileTypes: true})
    .filter((entry) => entry.isFile())
    .flatMap((entry) => patterns.map((pattern) => entry.name.match(pattern)))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  return (usedVersions.length === 0 ? 0 : Math.max(...usedVersions)) + 1;
};

try {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args['project-root'] ?? defaultProjectRoot);
  const jobPath = resolveInside(projectRoot, args.job, 'JOB');
  const sourcePlanPath = resolveInside(projectRoot, args['source-plan'], 'SOURCE_PLAN');
  const job = readJson(jobPath);
  if (job.schemaVersion !== JOB_SCHEMA) throw new Error('FIRSTFRAME_JOB_SCHEMA_INVALID');
  if (!existsSync(sourcePlanPath)) throw new Error('SOURCE_PLAN_MISSING');
  if (sha256File(job.sourceManifest.path) !== job.sourceManifest.sha256) {
    throw new Error('SOURCE_MANIFEST_SHA_MISMATCH');
  }

  const phase = args.phase;
  const sceneIds = requiredSceneIds(job, phase);
  const fontPath = path.resolve(args.font);
  if (!existsSync(fontPath) || !statSync(fontPath).isFile()) {
    throw new Error(`TEXT_BAKE_FONT_MISSING:${fontPath}`);
  }
  const artifactVersion = nextArtifactVersion(job.output.qaRoot, phase);
  const requestPath = path.join(
    job.output.qaRoot,
    `${phase}-text-bake-request.v${artifactVersion}.json`,
  );
  const receiptPath = path.join(
    job.output.qaRoot,
    `${phase}-text-bake-receipt.v${artifactVersion}.json`,
  );

  const scenes = sceneIds.map((sceneId) => {
    const scene = job.scenes.find((item) => item.sceneId === sceneId);
    if (!scene?.result) throw new Error(`RAW_FIRST_FRAME_RESULT_MISSING:${sceneId}`);
    if (!existsSync(scene.result.imagePath)) throw new Error(`RAW_FIRST_FRAME_MISSING:${sceneId}`);
    if (sha256File(scene.result.imagePath) !== scene.result.imageSha256) {
      throw new Error(`RAW_FIRST_FRAME_SHA_MISMATCH:${sceneId}`);
    }
    const reviewPath = scene.result.visualReview?.path ??
      path.join(job.output.qaRoot, `${sceneId}.visual-review.v1.json`);
    if (!existsSync(reviewPath)) throw new Error(`RAW_VISUAL_REVIEW_MISSING:${sceneId}`);
    const review = readJson(reviewPath);
    if (
      review.schemaVersion !== REVIEW_SCHEMA ||
      review.sceneId !== sceneId ||
      review.imageSha256 !== scene.result.imageSha256 ||
      review.status !== 'passed'
    ) {
      throw new Error(`RAW_VISUAL_REVIEW_INVALID:${sceneId}`);
    }

    const bake = scene.deterministicTextBake;
    if (!bake?.enabled || bake.anchorCalibrationRequired !== true) {
      throw new Error(`TEXT_BAKE_PLAN_INVALID:${sceneId}`);
    }
    if (!existsSync(bake.calibrationPath)) {
      throw new Error(`ANCHOR_CALIBRATION_MISSING:${sceneId}`);
    }
    const calibration = readJson(bake.calibrationPath);
    if (
      calibration.schemaVersion !== TEXT_BAKE_CALIBRATION_SCHEMA ||
      calibration.sceneId !== sceneId ||
      calibration.status !== 'passed' ||
      calibration.sourceImage?.path !== scene.result.imagePath ||
      calibration.sourceImage?.sha256 !== scene.result.imageSha256
    ) {
      throw new Error(`ANCHOR_CALIBRATION_INVALID:${sceneId}`);
    }
    const expectedNodeIds = bake.labels.map((label) => label.nodeId);
    const calibratedNodeIds = calibration.labels?.map((label) => label.nodeId) ?? [];
    if (
      calibratedNodeIds.length !== expectedNodeIds.length ||
      calibratedNodeIds.some((nodeId, index) => nodeId !== expectedNodeIds[index]) ||
      calibration.labels.some(
        (label) => !isQuad(label.anchorQuad) || label.placementChecked !== true,
      )
    ) {
      throw new Error(`ANCHOR_CALIBRATION_LABELS_INVALID:${sceneId}`);
    }
    if (existsSync(bake.outputPath)) throw new Error(`TEXT_BAKED_OUTPUT_EXISTS:${sceneId}`);

    return {
      sceneId: scene.sceneId,
      pairId: scene.pairId,
      pairSha256: scene.pairSha256,
      textPlanSha256: scene.textPlanSha256,
      labelsSha256: bake.labelsSha256,
      sourceImage: {path: scene.result.imagePath, sha256: scene.result.imageSha256},
      outputImage: {path: bake.outputPath},
      labels: bake.labels,
      anchorCalibrationRequired: true,
      anchorCalibration: {
        path: bake.calibrationPath,
        sha256: sha256File(bake.calibrationPath),
      },
      calibratedAnchors: calibration.labels.map(({nodeId, anchorQuad}) => ({
        nodeId,
        anchorQuad,
      })),
    };
  });

  const request = {
    schemaVersion: 'koubo-paper-firstframe-text-bake-request/v1',
    artifactVersion,
    taskId: job.taskId,
    sourcePlan: {path: sourcePlanPath, sha256: sha256File(sourcePlanPath)},
    fontPath,
    receiptPath,
    scenes,
  };
  writeNewJson(requestPath, request);

  const bakerPath = path.resolve(
    projectRoot,
    'skills/koubo-remotion-director/scripts/bake-firstframe-text.mjs',
  );
  const result = spawnSync(
    process.execPath,
    [bakerPath, '--request', requestPath, '--repo-root', projectRoot],
    {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024},
  );
  if (result.error || result.status !== 0) {
    throw new Error(`TEXT_BAKE_EXECUTION_FAILED:${String(result.stderr ?? result.error?.message ?? '').trim()}`);
  }
  if (!existsSync(receiptPath)) throw new Error('TEXT_BAKE_RECEIPT_MISSING');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  if (
    receipt.status !== 'deterministic-first-frame-text-baked-and-ocr-passed' ||
    receipt.scenes?.length !== scenes.length
  ) {
    throw new Error('TEXT_BAKE_RECEIPT_INVALID');
  }
  job.textBakeReceipts ??= [];
  job.textBakeReceipts.push({
    phase,
    request: {path: requestPath, sha256: sha256File(requestPath)},
    receipt: {path: receiptPath, sha256: sha256File(receiptPath)},
    sceneIds,
    recordedAt: new Date().toISOString(),
  });
  job.status = phase === 'full'
    ? 'text-baked-firstframes-awaiting-user-review'
    : 'candidate-text-baked-firstframes-awaiting-user-review';
  job.events.push({type: 'deterministic-text-bake-passed', phase, sceneIds, at: new Date().toISOString()});
  replaceJson(jobPath, job);
  console.log(JSON.stringify({
    ok: true,
    phase,
    artifactVersion,
    requestPath,
    receiptPath,
    sceneCount: scenes.length,
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
