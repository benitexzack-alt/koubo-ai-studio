#!/usr/bin/env node

import {existsSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {
  JOB_SCHEMA,
  REVIEW_SCHEMA,
  parseArgs,
  readJson,
  requiredSceneIds,
  sha256File,
  writeNewJson,
} from './firstframe-batch-core.mjs';

const criteriaNames = [
  'semanticMatch',
  'paperMaterial',
  'depthAndContact',
  'cleanTextAndBrand',
  'compositionAndReadability',
  'videoReadiness',
];

try {
  const args = parseArgs(process.argv.slice(2));
  const jobPath = path.resolve(args.job);
  const job = readJson(jobPath);
  if (job.schemaVersion !== JOB_SCHEMA) throw new Error('FIRSTFRAME_JOB_SCHEMA_INVALID');
  if (sha256File(job.sourceManifest.path) !== job.sourceManifest.sha256) {
    throw new Error('SOURCE_MANIFEST_SHA_MISMATCH');
  }
  if (
    !job.directorValidationReceipt?.path ||
    sha256File(job.directorValidationReceipt.path) !== job.directorValidationReceipt.sha256
  ) {
    throw new Error('DIRECTOR_RECEIPT_SHA_MISMATCH');
  }
  const sceneIds = requiredSceneIds(job, args.phase);
  const checks = [];
  const errors = [];
  sceneIds.forEach((sceneId) => {
    const scene = job.scenes.find((item) => item.sceneId === sceneId);
    if (!scene?.result) { errors.push(`RESULT_MISSING:${sceneId}`); return; }
    const imagePath = scene.result.imagePath;
    if (!existsSync(imagePath)) { errors.push(`IMAGE_MISSING:${sceneId}`); return; }
    if (sha256File(imagePath) !== scene.result.imageSha256) errors.push(`IMAGE_SHA_MISMATCH:${sceneId}`);
    if (statSync(imagePath).size !== scene.result.bytes) errors.push(`IMAGE_BYTES_MISMATCH:${sceneId}`);
    if (
      !scene.result.executionPrompt?.path ||
      !existsSync(scene.result.executionPrompt.path) ||
      sha256File(scene.result.executionPrompt.path) !== scene.result.executionPrompt.sha256
    ) {
      errors.push(`EXECUTION_PROMPT_RECORD_INVALID:${sceneId}`);
    } else if (!readFileSync(scene.result.executionPrompt.path, 'utf8').includes(scene.firstFramePrompt)) {
      errors.push(`EXECUTION_PROMPT_SOURCE_MISSING:${sceneId}`);
    }
    const ratio = scene.result.width / scene.result.height;
    if (Math.abs(ratio - 16 / 9) > 0.04) errors.push(`IMAGE_ASPECT_RATIO_INVALID:${sceneId}`);
    const reviewPath = path.join(job.output.qaRoot, `${sceneId}.visual-review.v1.json`);
    if (!existsSync(reviewPath)) { errors.push(`VISUAL_REVIEW_MISSING:${sceneId}`); return; }
    const review = readJson(reviewPath);
    if (review.schemaVersion !== REVIEW_SCHEMA || review.sceneId !== sceneId) errors.push(`VISUAL_REVIEW_SCHEMA_INVALID:${sceneId}`);
    if (review.imageSha256 !== scene.result.imageSha256) errors.push(`VISUAL_REVIEW_IMAGE_SHA_MISMATCH:${sceneId}`);
    if (review.status !== 'passed') errors.push(`VISUAL_REVIEW_NOT_PASSED:${sceneId}`);
    criteriaNames.forEach((name) => {
      if (review.criteria?.[name] !== 'passed') errors.push(`VISUAL_CRITERION_FAILED:${sceneId}:${name}`);
    });
    checks.push({sceneId, imagePath, imageSha256: scene.result.imageSha256, reviewPath});
  });
  const receipt = {
    schemaVersion: 'koubo-paper-firstframe-batch-validation/v1',
    taskId: job.taskId,
    requestId: job.requestId,
    phase: args.phase,
    status: errors.length === 0
      ? args.phase === 'sample' ? 'candidate-stills-awaiting-user-review' : 'batch-awaiting-user-review'
      : 'revision-required',
    machineAndAgentReviewPassed: errors.length === 0,
    userAccepted: false,
    job: {path: jobPath, sha256: sha256File(jobPath)},
    checks,
    errors,
    generatedAt: new Date().toISOString(),
  };
  let version = 1;
  let receiptPath = path.join(job.output.qaRoot, `${args.phase}-validation-receipt.v${version}.json`);
  while (existsSync(receiptPath)) {
    version += 1;
    receiptPath = path.join(job.output.qaRoot, `${args.phase}-validation-receipt.v${version}.json`);
  }
  writeNewJson(receiptPath, receipt);
  console.log(JSON.stringify({ok: errors.length === 0, receiptPath, status: receipt.status, errors}));
  if (errors.length) process.exit(2);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
