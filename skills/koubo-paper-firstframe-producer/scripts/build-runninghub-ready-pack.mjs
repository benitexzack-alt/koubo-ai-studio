#!/usr/bin/env node

import {existsSync, statSync} from 'node:fs';
import path from 'node:path';
import {
  JOB_SCHEMA,
  RUNNINGHUB_READY_PACK_SCHEMA,
  TEXT_BAKE_RECEIPT_SCHEMA,
  parseArgs,
  readJson,
  resolveInside,
  sha256File,
  writeNewJson,
} from './firstframe-batch-core.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args['project-root']);
  const jobPath = resolveInside(projectRoot, args.job, 'JOB');
  const runningHubManifestPath = resolveInside(
    projectRoot,
    args['runninghub-manifest'],
    'RUNNINGHUB_MANIFEST',
  );
  const acceptancePath = resolveInside(
    projectRoot,
    args['user-acceptance'],
    'USER_ACCEPTANCE',
  );
  const job = readJson(jobPath);
  const manifest = readJson(runningHubManifestPath);
  const acceptance = readJson(acceptancePath);
  if (job.schemaVersion !== JOB_SCHEMA) throw new Error('FIRSTFRAME_JOB_SCHEMA_INVALID');
  if (manifest.status !== 'awaiting-text-baked-firstframes') {
    throw new Error('RUNNINGHUB_MANIFEST_STATE_INVALID');
  }
  if (
    acceptance.approved !== true ||
    acceptance.status !== 'approved-for-runninghub-manual' ||
    acceptance.taskId !== job.taskId ||
    acceptance.requestId !== job.requestId ||
    acceptance.scope !== 'text-baked-first-frames'
  ) {
    throw new Error('TEXT_BAKED_USER_ACCEPTANCE_INVALID');
  }
  const fullReceiptRecord = job.textBakeReceipts?.find((item) => item.phase === 'full');
  if (!fullReceiptRecord || !existsSync(fullReceiptRecord.receipt.path)) {
    throw new Error('FULL_TEXT_BAKE_RECEIPT_MISSING');
  }
  if (sha256File(fullReceiptRecord.receipt.path) !== fullReceiptRecord.receipt.sha256) {
    throw new Error('FULL_TEXT_BAKE_RECEIPT_SHA_MISMATCH');
  }
  const receipt = readJson(fullReceiptRecord.receipt.path);
  if (
    receipt.schemaVersion !== TEXT_BAKE_RECEIPT_SCHEMA ||
    receipt.status !== 'deterministic-first-frame-text-baked-and-ocr-passed'
  ) {
    throw new Error('FULL_TEXT_BAKE_RECEIPT_INVALID');
  }
  const approvedSceneIds = acceptance.sceneIds ?? [];
  const receiptByScene = new Map(receipt.scenes.map((scene) => [scene.sceneId, scene]));
  const manifestByScene = new Map(manifest.scenes.map((scene) => [scene.sceneId, scene]));
  if (
    approvedSceneIds.length !== job.scenes.length ||
    approvedSceneIds.some((sceneId, index) => sceneId !== job.scenes[index].sceneId)
  ) {
    throw new Error('TEXT_BAKED_USER_ACCEPTANCE_SCENES_INVALID');
  }

  const scenes = job.scenes.map((scene) => {
    const baked = receiptByScene.get(scene.sceneId);
    const motion = manifestByScene.get(scene.sceneId);
    if (!baked || !motion) throw new Error(`RUNNINGHUB_SCENE_BINDING_MISSING:${scene.sceneId}`);
    if (
      baked.pairId !== motion.pairId ||
      baked.pairSha256 !== motion.pairSha256 ||
      baked.outputImage.path !== scene.deterministicTextBake.outputPath ||
      !existsSync(baked.outputImage.path) ||
      sha256File(baked.outputImage.path) !== baked.outputImage.sha256 ||
      baked.ocr.some((item) => item.matched !== true)
    ) {
      throw new Error(`RUNNINGHUB_SCENE_BINDING_INVALID:${scene.sceneId}`);
    }
    return {
      sceneId: scene.sceneId,
      pairId: motion.pairId,
      pairSha256: motion.pairSha256,
      inputFirstFrame: {
        path: baked.outputImage.path,
        fileName: path.basename(baked.outputImage.path),
        sha256: baked.outputImage.sha256,
        bytes: statSync(baked.outputImage.path).size,
      },
      imageToVideoPrompt: motion.imageToVideoPrompt,
      imageToVideoPromptSha256: motion.imageToVideoPromptSha256,
      durationSeconds: motion.durationSeconds,
      textPlanSha256: motion.inputFirstFrameTextPlanSha256,
      textOcrPassed: true,
      allowedMotion: [
        'rigid-slide',
        'rigid-translate',
        'small-angle-rotate',
        'drawer-push',
        'rigid-puzzle-lock',
      ],
      forbiddenMotion: [
        'fold-text-card',
        'bend-text-card',
        'curl-text-card',
        'stretch-text-card',
        'flip-text-card',
        'rewrite-text',
      ],
    };
  });
  const outputPath = path.join(job.output.handoffRoot, 'runninghub-ready-pack.v1.json');
  writeNewJson(outputPath, {
    schemaVersion: RUNNINGHUB_READY_PACK_SCHEMA,
    taskId: job.taskId,
    requestId: job.requestId,
    status: 'ready-for-runninghub-manual',
    externalSubmissionOwner: 'user',
    codexSubmissionAllowed: false,
    sourceJob: {path: jobPath, sha256: sha256File(jobPath)},
    sourceRunningHubManifest: {
      path: runningHubManifestPath,
      sha256: sha256File(runningHubManifestPath),
    },
    textBakeReceipt: fullReceiptRecord.receipt,
    userAcceptance: {path: acceptancePath, sha256: sha256File(acceptancePath)},
    sceneCount: scenes.length,
    scenes,
  });
  console.log(JSON.stringify({ok: true, outputPath, sceneCount: scenes.length}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
