#!/usr/bin/env node

import {existsSync} from 'node:fs';
import path from 'node:path';
import {
  CUE_NATIVE_DIRECTOR_SCHEMA,
  FIRSTFRAME_ROUTE_LOCK_FILE_NAME,
  JOB_SCHEMA,
  assertPreparedFirstFrameJobStaticContract,
  createFirstFrameRouteLock,
  parseArgs,
  readAuthoritativeSourceManifest,
  readJson,
  readSignedSourceManifestChain,
  resolveInside,
  validateCueNativeJobSampleBinding,
  validateManifest,
  writeNewJson,
} from './firstframe-batch-core.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  for (const name of [
    'project-root',
    'job',
    'expected-task-id',
    'expected-request-id',
    'expected-revision-id',
    'expected-selected-scene',
    'expected-manifest-sha256',
    'expected-director-receipt-sha256',
  ]) {
    if (!args[name]) throw new Error(`ROUTE_LOCK_MIGRATION_ARGUMENT_REQUIRED:${name}`);
  }

  const projectRoot = path.resolve(args['project-root']);
  const jobPath = resolveInside(projectRoot, args.job, 'JOB');
  const routeLockPath = path.join(
    path.dirname(jobPath),
    FIRSTFRAME_ROUTE_LOCK_FILE_NAME,
  );
  if (!existsSync(jobPath)) throw new Error('FIRSTFRAME_JOB_MISSING');
  if (existsSync(routeLockPath)) throw new Error(`OUTPUT_ALREADY_EXISTS:${routeLockPath}`);

  const job = readJson(jobPath);
  if (job.schemaVersion !== JOB_SCHEMA) throw new Error('FIRSTFRAME_JOB_SCHEMA_INVALID');
  if (
    job.taskId !== args['expected-task-id'] ||
    job.requestId !== args['expected-request-id'] ||
    job.revisionId !== args['expected-revision-id']
  ) {
    throw new Error('ROUTE_LOCK_MIGRATION_EXPECTED_IDENTITY_MISMATCH');
  }
  if (
    job.sourceManifest?.sha256 !== args['expected-manifest-sha256'] ||
    job.directorValidationReceipt?.sha256 !== args['expected-director-receipt-sha256']
  ) {
    throw new Error('ROUTE_LOCK_MIGRATION_EXPECTED_SOURCE_SHA_MISMATCH');
  }
  if (
    job.fullBatchAuthorized !== false ||
    job.sampleUserAcceptanceReceipt
  ) {
    throw new Error('ROUTE_LOCK_MIGRATION_REQUIRES_UNAUTHORIZED_CUE_NATIVE_JOB');
  }
  if (![
    'sample-generation-authorized',
    'candidate-stills-awaiting-user-review',
    'candidate-text-baked-firstframes-awaiting-user-review',
  ].includes(job.status)) {
    throw new Error(`ROUTE_LOCK_MIGRATION_JOB_STATUS_INVALID:${job.status}`);
  }

  const {manifest} = readSignedSourceManifestChain(job);
  const manifestErrors = validateManifest(manifest);
  if (manifestErrors.length) {
    throw new Error(`FIRSTFRAME_MANIFEST_INVALID:${manifestErrors.join('|')}`);
  }
  if (
    manifest.sourceDirectorSchema !== CUE_NATIVE_DIRECTOR_SCHEMA ||
    job.sourceDirectorSchema !== CUE_NATIVE_DIRECTOR_SCHEMA
  ) {
    throw new Error('ROUTE_LOCK_MIGRATION_CUE_NATIVE_ONLY');
  }
  if (manifest.selectedSceneId !== args['expected-selected-scene']) {
    throw new Error('ROUTE_LOCK_MIGRATION_EXPECTED_SELECTED_SCENE_MISMATCH');
  }
  const sampleErrors = validateCueNativeJobSampleBinding(job, manifest);
  if (sampleErrors.length) {
    throw new Error(`CUE_NATIVE_SAMPLE_BINDING_INVALID:${sampleErrors.join('|')}`);
  }

  const routeLock = createFirstFrameRouteLock({
    manifest,
    sampleSceneIds: job.sampleSceneIds,
    jobPath,
    sourceManifest: job.sourceManifest,
    directorValidationReceipt: job.directorValidationReceipt,
    createdAt: new Date().toISOString(),
  });
  assertPreparedFirstFrameJobStaticContract({job, jobPath, manifest, routeLock});
  writeNewJson(routeLockPath, routeLock);

  const verified = readAuthoritativeSourceManifest(job, jobPath);
  if (verified.routeLockPath !== routeLockPath || verified.routeLock?.cueNative !== true) {
    throw new Error('ROUTE_LOCK_MIGRATION_POSTWRITE_VERIFICATION_FAILED');
  }
  console.log(JSON.stringify({
    ok: true,
    status: 'cue-native-firstframe-route-locked',
    jobPath,
    routeLockPath,
    selectedSceneId: manifest.selectedSceneId,
    sourceManifestSha256: job.sourceManifest.sha256,
    directorValidationReceiptSha256: job.directorValidationReceipt.sha256,
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
