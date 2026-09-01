#!/usr/bin/env node

import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {
  JOB_SCHEMA,
  parseArgs,
  readJson,
  resolveInside,
  sha256File,
  validateManifest,
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
    directorReceipt.artifacts?.firstFramePromptManifest?.sha256 !==
    sha256File(manifestPath)
  ) {
    errors.push('DIRECTOR_MANIFEST_SHA_MISMATCH');
  }
  if (errors.length) throw new Error(`FIRSTFRAME_MANIFEST_INVALID:${errors.join('|')}`);

  const sampleSceneIds = String(args.sample ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (sampleSceneIds.length !== 3 || new Set(sampleSceneIds).size !== 3) {
    throw new Error('SAMPLE_MUST_CONTAIN_THREE_UNIQUE_SCENE_IDS');
  }
  const knownSceneIds = new Set(manifest.scenes.map((scene) => scene.sceneId));
  sampleSceneIds.forEach((sceneId) => {
    if (!knownSceneIds.has(sceneId)) throw new Error(`SAMPLE_SCENE_UNKNOWN:${sceneId}`);
  });

  const handoffRoot = path.dirname(manifestPath);
  const imageRoot = path.join(handoffRoot, 'first-frames');
  const qaRoot = path.join(handoffRoot, 'first-frame-qa');
  const jobPath = path.join(handoffRoot, 'first-frame-batch.v1.json');
  mkdirSync(imageRoot, {recursive: true});
  mkdirSync(qaRoot, {recursive: true});

  const job = {
    schemaVersion: JOB_SCHEMA,
    taskId: manifest.taskId,
    requestId: manifest.requestId,
    status: 'sample-generation-authorized',
    generationMode: 'image_gen-one-call-per-scene',
    maximumConcurrency: 2,
    automaticRetryAllowed: false,
    generatedReadableTextAllowed: false,
    sourceManifest: {path: manifestPath, sha256: sha256File(manifestPath)},
    directorValidationReceipt: {
      path: directorReceiptPath,
      sha256: sha256File(directorReceiptPath),
    },
    output: {handoffRoot, imageRoot, qaRoot},
    sampleSceneIds,
    fullBatchAuthorized: false,
    scenes: manifest.scenes.map((scene) => ({
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
      selectedForSample: sampleSceneIds.includes(scene.sceneId),
      result: null,
    })),
    events: [{type: 'batch-prepared', at: new Date().toISOString()}],
  };
  writeNewJson(jobPath, job);
  console.log(JSON.stringify({ok: true, jobPath, imageRoot, qaRoot, sampleSceneIds}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
