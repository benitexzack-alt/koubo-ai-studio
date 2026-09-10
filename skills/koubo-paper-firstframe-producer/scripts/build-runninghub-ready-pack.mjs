#!/usr/bin/env node

import {existsSync, realpathSync, statSync} from 'node:fs';
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
import {validateIncidentHandoff} from './runninghub-handoff-incident-core.mjs';

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
  const scope = args['handoff-scope'] ?? 'batch';
  const fullReceiptRecord = job.textBakeReceipts?.findLast((item) =>
    item.phase === 'full' || (scope === 'first-trial' && item.phase === 'sample'));
  if (!fullReceiptRecord?.receipt?.path) {
    throw new Error('FULL_TEXT_BAKE_RECEIPT_MISSING');
  }
  const receiptPath = resolveInside(projectRoot, fullReceiptRecord.receipt.path, 'TEXT_BAKE_RECEIPT');
  if (!existsSync(receiptPath)) throw new Error('FULL_TEXT_BAKE_RECEIPT_MISSING');
  resolveInside(realpathSync(projectRoot), realpathSync(receiptPath), 'TEXT_BAKE_RECEIPT');
  if (sha256File(receiptPath) !== fullReceiptRecord.receipt.sha256) {
    throw new Error('FULL_TEXT_BAKE_RECEIPT_SHA_MISMATCH');
  }
  const receipt = readJson(receiptPath);
  if (
    receipt.schemaVersion !== TEXT_BAKE_RECEIPT_SCHEMA ||
    receipt.status !== 'deterministic-first-frame-text-baked-and-ocr-passed'
  ) {
    throw new Error('FULL_TEXT_BAKE_RECEIPT_INVALID');
  }
  const incident = validateIncidentHandoff({
    projectRoot, job, manifest, receipt, acceptance, scope,
    dynamicAcceptancePath: args['dynamic-acceptance'],
    sceneId: args['scene-id'],
  });
  const selectedScenes = incident
    ? incident.selectedIds.map((sceneId) => job.scenes.find((scene) => scene.sceneId === sceneId))
    : job.scenes;
  const approvedSceneIds = acceptance.sceneIds ?? [];
  const receiptByScene = new Map(receipt.scenes.map((scene) => [scene.sceneId, scene]));
  const manifestByScene = new Map(manifest.scenes.map((scene) => [scene.sceneId, scene]));
  if (
    selectedScenes.length > 0 && (approvedSceneIds.length !== selectedScenes.length ||
    approvedSceneIds.some((sceneId, index) => sceneId !== selectedScenes[index].sceneId))
  ) {
    throw new Error('TEXT_BAKED_USER_ACCEPTANCE_SCENES_INVALID');
  }

  const scenes = selectedScenes.map((scene) => {
    const baked = receiptByScene.get(scene.sceneId);
    const motion = manifestByScene.get(scene.sceneId);
    if (!baked || !motion) throw new Error(`RUNNINGHUB_SCENE_BINDING_MISSING:${scene.sceneId}`);
    const bakedImagePath = resolveInside(projectRoot, baked.outputImage.path, 'TEXT_BAKED_IMAGE');
    const plannedImagePath = resolveInside(projectRoot, scene.deterministicTextBake.outputPath, 'TEXT_BAKED_IMAGE');
    if (
      baked.pairId !== motion.pairId ||
      baked.pairSha256 !== motion.pairSha256 ||
      bakedImagePath !== plannedImagePath ||
      !existsSync(bakedImagePath) ||
      sha256File(bakedImagePath) !== baked.outputImage.sha256 ||
      !Array.isArray(baked.ocr) || baked.ocr.length === 0 ||
      baked.ocr.some((item) => item.matched !== true)
    ) {
      throw new Error(`RUNNINGHUB_SCENE_BINDING_INVALID:${scene.sceneId}`);
    }
    return {
      sceneId: scene.sceneId,
      pairId: motion.pairId,
      pairSha256: motion.pairSha256,
      inputFirstFrame: {
        path: bakedImagePath,
        fileName: path.basename(bakedImagePath),
        sha256: baked.outputImage.sha256,
        bytes: statSync(bakedImagePath).size,
      },
      imageToVideoPrompt: motion.imageToVideoPrompt,
      imageToVideoPromptSha256: motion.imageToVideoPromptSha256,
      durationSeconds: motion.durationSeconds,
      textPlanSha256: motion.inputFirstFrameTextPlanSha256,
      textOcrPassed: true,
      ...(incident ? {motionContractSha256: motion.motionContractSha256, dynamicValidation: motion.dynamicValidation} : {}),
      textLabelMotion: incident ? 'fixed-independent-stands' : 'rigid-surface',
      allowedMotion: incident ? ['blank-part-contract-actions-only'] : [
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
  const fileName = incident && scope === 'first-trial'
    ? `runninghub-ready-pack.${selectedScenes[0].sceneId}.first-trial.v1.json` : 'runninghub-ready-pack.v1.json';
  const outputPath = resolveInside(projectRoot, args.output ?? path.join(job.output.handoffRoot, fileName), 'OUTPUT');
  resolveInside(realpathSync(projectRoot), realpathSync(path.dirname(outputPath)), 'OUTPUT');
  writeNewJson(outputPath, {
    schemaVersion: RUNNINGHUB_READY_PACK_SCHEMA,
    taskId: job.taskId,
    requestId: job.requestId,
    status: incident && scenes.length === 0 ? 'no-generation-required'
      : incident && scope === 'first-trial' ? 'ready-for-runninghub-first-trial-manual' : 'ready-for-runninghub-manual',
    externalSubmissionOwner: 'user',
    codexSubmissionAllowed: false,
    paidGenerationAllowed: false,
    batchDynamicallyAccepted: false,
    formalEnabled: false,
    publicationEnabled: false,
    ...incident?.metadata,
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
