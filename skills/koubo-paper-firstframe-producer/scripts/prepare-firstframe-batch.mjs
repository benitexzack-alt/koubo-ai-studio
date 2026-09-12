#!/usr/bin/env node

import {existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {
  FIRSTFRAME_ROUTE_LOCK_FILE_NAME,
  JOB_SCHEMA,
  createFirstFrameRouteLock,
  firstFrameOutputRoots,
  parseArgs,
  preparedFirstFrameScenes,
  readJson,
  resolveInside,
  sha256File,
  validateManifest,
  validateSampleSceneIds,
  writeNewJson,
} from './firstframe-batch-core.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args['project-root']);
  const manifestPath = resolveInside(projectRoot, args.manifest, 'MANIFEST');
  const directorReceiptPath = resolveInside(
    projectRoot,
    args['director-receipt'],
    'DIRECTOR_RECEIPT',
  );
  const manifest = readJson(manifestPath);
  const directorReceipt = readJson(directorReceiptPath);
  const errors = validateManifest(manifest);
  if (manifest.policy?.physicalContinuityVersion === '1' && directorReceipt.policy?.physicalContinuityVersion !== '1') {
    errors.push('DIRECTOR_PHYSICAL_POLICY_MISMATCH');
  }
  if (manifest.policy?.incidentPreventionVersion === '1' &&
    (directorReceipt.policy?.incidentPreventionVersion !== '1' || directorReceipt.revisionId !== manifest.revisionId)) {
    errors.push('DIRECTOR_INCIDENT_IDENTITY_MISMATCH');
  }
  if (directorReceipt.schemaVersion !== 'koubo-director-validation-receipt/v1') {
    errors.push('DIRECTOR_RECEIPT_SCHEMA_INVALID');
  }
  if (directorReceipt.skillExecuted !== true || directorReceipt.validatorExecuted !== true) {
    errors.push('DIRECTOR_SKILL_NOT_EXECUTED');
  }
  if (directorReceipt.status !== 'validated-provisional-previsualization') {
    errors.push('DIRECTOR_RECEIPT_STATUS_INVALID');
  }
  if (
    directorReceipt.taskId !== manifest.taskId ||
    directorReceipt.requestId !== manifest.requestId
  ) {
    errors.push('DIRECTOR_RECEIPT_IDENTITY_MISMATCH');
  }
  if (
    Object.hasOwn(manifest, 'revisionId') ||
    Object.hasOwn(directorReceipt, 'revisionId')
  ) {
    if (
      typeof manifest.revisionId !== 'string' ||
      !manifest.revisionId.trim() ||
      directorReceipt.revisionId !== manifest.revisionId
    ) {
      errors.push('DIRECTOR_RECEIPT_REVISION_MISMATCH');
    }
  }
  if (
    path.resolve(directorReceipt.artifacts?.firstFramePromptManifest?.path ?? '') !==
      manifestPath ||
    directorReceipt.artifacts?.firstFramePromptManifest?.sha256 !== sha256File(manifestPath)
  ) {
    errors.push('DIRECTOR_MANIFEST_BINDING_MISMATCH');
  }
  if (errors.length) throw new Error(`FIRSTFRAME_MANIFEST_INVALID:${errors.join('|')}`);

  const sampleSceneIds = String(args.sample ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const sampleErrors = validateSampleSceneIds(manifest, sampleSceneIds);
  if (sampleErrors.length) throw new Error(`FIRSTFRAME_SAMPLE_INVALID:${sampleErrors.join('|')}`);

  const handoffRoot = path.dirname(manifestPath);
  const jobPath = path.join(handoffRoot, 'first-frame-batch.v1.json');
  const routeLockPath = path.join(handoffRoot, FIRSTFRAME_ROUTE_LOCK_FILE_NAME);
  if (existsSync(jobPath)) throw new Error(`OUTPUT_ALREADY_EXISTS:${jobPath}`);
  if (existsSync(routeLockPath)) throw new Error(`OUTPUT_ALREADY_EXISTS:${routeLockPath}`);
  const {imageRoot, bakedImageRoot, qaRoot, calibrationRoot} =
    firstFrameOutputRoots(jobPath);
  mkdirSync(imageRoot, {recursive: true});
  mkdirSync(bakedImageRoot, {recursive: true});
  mkdirSync(qaRoot, {recursive: true});
  mkdirSync(calibrationRoot, {recursive: true});

  const sourceManifest = {path: manifestPath, sha256: sha256File(manifestPath)};
  const directorValidationReceipt = {
    path: directorReceiptPath,
    sha256: sha256File(directorReceiptPath),
  };
  const preparedAt = new Date().toISOString();
  const job = {
    schemaVersion: JOB_SCHEMA,
    taskId: manifest.taskId,
    requestId: manifest.requestId,
    ...(manifest.revisionId !== undefined ? {revisionId: manifest.revisionId} : {}),
    ...(manifest.policy !== undefined ? {policy: structuredClone(manifest.policy)} : {}),
    status: 'sample-generation-authorized',
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
    sourceManifest,
    directorValidationReceipt,
    output: {handoffRoot, imageRoot, bakedImageRoot, qaRoot, calibrationRoot},
    sampleSceneIds,
    fullBatchAuthorized: false,
    scenes: preparedFirstFrameScenes(manifest, sampleSceneIds, jobPath),
    events: [{type: 'batch-prepared', at: preparedAt}],
  };
  const routeLock = createFirstFrameRouteLock({
    manifest,
    sampleSceneIds,
    jobPath,
    sourceManifest,
    directorValidationReceipt,
    createdAt: preparedAt,
  });
  writeNewJson(routeLockPath, routeLock);
  writeNewJson(jobPath, job);
  console.log(JSON.stringify({
    ok: true,
    jobPath,
    routeLockPath,
    imageRoot,
    qaRoot,
    sampleSceneIds,
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
