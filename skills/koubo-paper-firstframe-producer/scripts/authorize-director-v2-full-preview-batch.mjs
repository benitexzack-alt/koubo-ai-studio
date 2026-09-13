#!/usr/bin/env node

import {existsSync} from 'node:fs';
import path from 'node:path';
import {
  DIRECTOR_V2_SCHEMA,
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
  if (!args['project-root'] || !args.job || !args.authorization) {
    throw new Error('DIRECTOR_V2_FULL_PREVIEW_AUTHORIZATION_ARGUMENTS_REQUIRED');
  }
  const projectRoot = path.resolve(args['project-root']);
  const jobPath = resolveInside(projectRoot, args.job, 'JOB');
  const authorizationPath = resolveInside(
    projectRoot,
    args.authorization,
    'FULL_PREVIEW_AUTHORIZATION',
  );
  if (!existsSync(jobPath)) throw new Error('FIRSTFRAME_JOB_MISSING');
  if (!existsSync(authorizationPath)) {
    throw new Error('DIRECTOR_V2_FULL_PREVIEW_AUTHORIZATION_MISSING');
  }

  const job = readJson(jobPath);
  if (job.schemaVersion !== JOB_SCHEMA) throw new Error('FIRSTFRAME_JOB_SCHEMA_INVALID');
  const {manifest: sourceManifest} = readAuthoritativeSourceManifest(job, jobPath);
  if (sourceManifest.sourceDirectorSchema !== DIRECTOR_V2_SCHEMA) {
    throw new Error('DIRECTOR_V2_FULL_PREVIEW_AUTHORIZATION_ROUTE_ONLY');
  }
  if (
    job.fullBatchAuthorized === true ||
    job.directorV2FullPreviewAuthorizationReceipt
  ) {
    throw new Error('DIRECTOR_V2_FULL_PREVIEW_AUTHORIZATION_ALREADY_RECORDED');
  }
  if (job.status !== 'candidate-text-baked-firstframes-awaiting-user-review') {
    throw new Error(`DIRECTOR_V2_FULL_PREVIEW_AUTHORIZATION_JOB_STATUS_INVALID:${job.status}`);
  }
  const sampleBindingErrors = validateCueNativeJobSampleBinding(job, sourceManifest);
  if (sampleBindingErrors.length) {
    throw new Error(`DIRECTOR_V2_SAMPLE_BINDING_INVALID:${sampleBindingErrors.join('|')}`);
  }

  const prospectiveJob = structuredClone(job);
  prospectiveJob.fullBatchAuthorized = true;
  prospectiveJob.directorV2FullPreviewAuthorizationReceipt = {
    path: authorizationPath,
    sha256: sha256File(authorizationPath),
  };
  prospectiveJob.status = 'full-preview-generation-authorized';
  assertFullBatchAuthorized(
    prospectiveJob,
    'REGISTER_DIRECTOR_V2_FULL_PREVIEW_BATCH',
    sourceManifest,
  );

  prospectiveJob.events ??= [];
  prospectiveJob.events.push({
    type: 'director-v2-full-preview-authorized-after-representative-machine-pass',
    selectedSceneId: sourceManifest.selectedSceneId,
    fullPreviewAuthorizationReceipt: structuredClone(
      prospectiveJob.directorV2FullPreviewAuthorizationReceipt,
    ),
    userVisualAcceptance: 'pending',
    externalSubmissionAuthorized: false,
    at: new Date().toISOString(),
  });
  replaceJson(jobPath, prospectiveJob);
  console.log(JSON.stringify({
    ok: true,
    status: prospectiveJob.status,
    jobPath,
    selectedSceneId: sourceManifest.selectedSceneId,
    fullPreviewAuthorizationReceipt:
      prospectiveJob.directorV2FullPreviewAuthorizationReceipt,
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
