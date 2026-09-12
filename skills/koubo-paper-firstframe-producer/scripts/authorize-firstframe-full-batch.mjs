#!/usr/bin/env node

import {existsSync} from 'node:fs';
import path from 'node:path';
import {
  CUE_NATIVE_DIRECTOR_SCHEMA,
  JOB_SCHEMA,
  assertFullBatchAuthorized,
  parseArgs,
  readAuthoritativeSourceManifest,
  readJson,
  replaceJson,
  resolveInside,
  sha256File,
  validateCueNativeJobSampleBinding,
} from './firstframe-batch-core.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args['project-root'] || !args.job || !args.acceptance) {
    throw new Error('FULL_BATCH_AUTHORIZATION_ARGUMENTS_REQUIRED');
  }
  const projectRoot = path.resolve(args['project-root']);
  const jobPath = resolveInside(projectRoot, args.job, 'JOB');
  const acceptancePath = resolveInside(projectRoot, args.acceptance, 'SAMPLE_ACCEPTANCE');
  if (!existsSync(jobPath)) throw new Error('FIRSTFRAME_JOB_MISSING');
  if (!existsSync(acceptancePath)) throw new Error('SAMPLE_ACCEPTANCE_MISSING');

  const job = readJson(jobPath);
  if (job.schemaVersion !== JOB_SCHEMA) throw new Error('FIRSTFRAME_JOB_SCHEMA_INVALID');
  const {manifest: sourceManifest} = readAuthoritativeSourceManifest(job, jobPath);
  if (sourceManifest.sourceDirectorSchema !== CUE_NATIVE_DIRECTOR_SCHEMA) {
    throw new Error('FULL_BATCH_AUTHORIZATION_CUE_NATIVE_ONLY');
  }
  if (job.fullBatchAuthorized === true || job.sampleUserAcceptanceReceipt) {
    throw new Error('FULL_BATCH_AUTHORIZATION_ALREADY_RECORDED');
  }
  if (job.status !== 'candidate-text-baked-firstframes-awaiting-user-review') {
    throw new Error(`FULL_BATCH_AUTHORIZATION_JOB_STATUS_INVALID:${job.status}`);
  }
  const sampleBindingErrors = validateCueNativeJobSampleBinding(job, sourceManifest);
  if (sampleBindingErrors.length) {
    throw new Error(`CUE_NATIVE_SAMPLE_BINDING_INVALID:${sampleBindingErrors.join('|')}`);
  }

  const prospectiveJob = structuredClone(job);
  prospectiveJob.fullBatchAuthorized = true;
  prospectiveJob.sampleUserAcceptanceReceipt = {
    path: acceptancePath,
    sha256: sha256File(acceptancePath),
  };
  prospectiveJob.status = 'full-generation-authorized';
  assertFullBatchAuthorized(
    prospectiveJob,
    'REGISTER_CUE_NATIVE_FULL_BATCH',
    sourceManifest,
  );

  prospectiveJob.events ??= [];
  prospectiveJob.events.push({
    type: 'cue-native-full-batch-authorized-after-sample-user-acceptance',
    selectedSceneId: sourceManifest.selectedSceneId,
    sampleUserAcceptanceReceipt: structuredClone(prospectiveJob.sampleUserAcceptanceReceipt),
    at: new Date().toISOString(),
  });
  replaceJson(jobPath, prospectiveJob);
  console.log(JSON.stringify({
    ok: true,
    status: prospectiveJob.status,
    jobPath,
    selectedSceneId: sourceManifest.selectedSceneId,
    sampleUserAcceptanceReceipt: prospectiveJob.sampleUserAcceptanceReceipt,
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
