#!/usr/bin/env node

import {existsSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {
  JOB_SCHEMA,
  imageDimensions,
  isInside,
  parseArgs,
  readJson,
  replaceJson,
  sha256File,
} from './firstframe-batch-core.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  const jobPath = path.resolve(args.job);
  const job = readJson(jobPath);
  if (job.schemaVersion !== JOB_SCHEMA) throw new Error('FIRSTFRAME_JOB_SCHEMA_INVALID');
  const scene = job.scenes.find((item) => item.sceneId === args.scene);
  if (!scene) throw new Error(`FIRSTFRAME_SCENE_UNKNOWN:${args.scene}`);
  const executionPromptPath = path.resolve(args['execution-prompt-file']);
  if (!isInside(job.output.qaRoot, executionPromptPath)) {
    throw new Error(`EXECUTION_PROMPT_OUTSIDE_QA_ROOT:${executionPromptPath}`);
  }
  if (!existsSync(executionPromptPath)) {
    throw new Error(`EXECUTION_PROMPT_FILE_MISSING:${executionPromptPath}`);
  }
  const executionPrompt = readFileSync(executionPromptPath, 'utf8');
  if (!executionPrompt.includes(scene.firstFramePrompt)) {
    throw new Error(`EXECUTION_PROMPT_SOURCE_MISSING:${args.scene}`);
  }
  const executionPromptRecord = {
    path: executionPromptPath,
    sha256: sha256File(executionPromptPath),
  };
  if (scene.result) {
    if (scene.result.executionPrompt) {
      throw new Error(`FIRSTFRAME_RESULT_ALREADY_RECORDED:${args.scene}`);
    }
    scene.result.executionPrompt = executionPromptRecord;
    job.events.push({type: 'execution-prompt-attached', sceneId: scene.sceneId, at: new Date().toISOString()});
    replaceJson(jobPath, job);
    console.log(JSON.stringify({ok: true, sceneId: scene.sceneId, executionPrompt: executionPromptRecord}));
    process.exit(0);
  }
  const imagePath = path.resolve(args.image);
  if (!isInside(job.output.imageRoot, imagePath)) throw new Error(`IMAGE_OUTSIDE_BATCH:${imagePath}`);
  if (imagePath !== path.resolve(scene.outputPath)) throw new Error(`IMAGE_PATH_MISMATCH:${imagePath}`);
  if (!existsSync(imagePath)) throw new Error(`IMAGE_FILE_MISSING:${imagePath}`);
  const dimensions = imageDimensions(imagePath);
  scene.result = {
    imagePath,
    imageSha256: sha256File(imagePath),
    bytes: statSync(imagePath).size,
    width: dimensions.width,
    height: dimensions.height,
    format: dimensions.format,
    tool: args.tool,
    executionPrompt: executionPromptRecord,
    recordedAt: new Date().toISOString(),
  };
  job.events.push({type: 'image-result-recorded', sceneId: scene.sceneId, at: new Date().toISOString()});
  replaceJson(jobPath, job);
  console.log(JSON.stringify({ok: true, sceneId: scene.sceneId, ...scene.result}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
