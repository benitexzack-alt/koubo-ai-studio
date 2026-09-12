#!/usr/bin/env node

// A preparation package is intentionally not a generation-ready package and
// cannot satisfy the V9 generation handoff or claim visual/dynamic acceptance.
import {realpathSync, statSync} from 'node:fs';
import path from 'node:path';
import {JOB_SCHEMA, TEXT_BAKE_RECEIPT_SCHEMA, parseArgs, readAuthoritativeSourceManifest,
  readJson, resolveInside, sha256File, validateRawVisualReview,
  writeNewJson} from './firstframe-batch-core.mjs';
import {validateIncidentHandoff} from './runninghub-handoff-incident-core.mjs';

const requireThat = (value, message) => { if (!value) throw new Error(message); };
try {
  const args = parseArgs(process.argv.slice(2));
  const root = realpathSync(args['project-root']);
  const checked = (value, label) => {
    const file = resolveInside(root, value, label);
    resolveInside(root, realpathSync(file), label);
    requireThat(statSync(file).isFile(), `${label}_NOT_FILE`);
    return file;
  };
  const bound = (binding, label) => {
    const file = checked(binding.path, label);
    requireThat(sha256File(file) === binding.sha256, `${label}_SHA_MISMATCH`);
    return readJson(file);
  };
  const jobPath = checked(args.job, 'JOB');
  const motionPath = checked(args['runninghub-manifest'], 'MOTION_MANIFEST');
  const authorizationPath = checked(args.authorization, 'AUTHORIZATION');
  const job = readJson(jobPath), manifest = readJson(motionPath), authorization = readJson(authorizationPath);
  requireThat(job.schemaVersion === JOB_SCHEMA && manifest.status === 'awaiting-text-baked-firstframes', 'CANVAS_INPUT_INVALID');
  const {
    manifest: sourceManifest,
    directorReceipt: director,
  } = readAuthoritativeSourceManifest(job, jobPath);
  requireThat(director.skillExecuted === true && director.validatorExecuted === true &&
    director.status === 'validated-provisional-previsualization' && director.revisionId === job.revisionId &&
    director.artifacts?.firstFramePromptManifest?.sha256 === job.sourceManifest?.sha256 &&
    director.artifacts?.runningHubPromptManifest?.sha256 === sha256File(motionPath), 'CANVAS_DIRECTOR_BINDING_INVALID');
  const record = job.textBakeReceipts?.findLast((item) => item.phase === 'full');
  requireThat(record?.receipt, 'CANVAS_FULL_BAKE_REQUIRED');
  const receipt = bound(record.receipt, 'TEXT_BAKE_RECEIPT');
  requireThat(receipt.schemaVersion === TEXT_BAKE_RECEIPT_SCHEMA &&
    receipt.status === 'deterministic-first-frame-text-baked-and-ocr-passed', 'CANVAS_BAKE_INVALID');
  const incident = validateIncidentHandoff({projectRoot: root, job, manifest, receipt,
    scope: 'canvas-preparation', preparationAuthorization: authorization,
    authoritativeSourceManifest: sourceManifest,
    authoritativeDirectorReceipt: director});
  requireThat(incident, 'CANVAS_INCIDENT_POLICY_REQUIRED');
  const scenes = job.scenes.map((scene) => {
    const sourceScene = sourceManifest.scenes?.find((item) => item.sceneId === scene.sceneId);
    const imagePath = checked(scene.result?.imagePath, 'RAW_IMAGE');
    requireThat(sha256File(imagePath) === scene.result.imageSha256, 'CANVAS_RAW_IMAGE_SHA_MISMATCH');
    const rawReviewPath = checked(scene.result.visualReview?.path ?? path.join(job.output.qaRoot, `${scene.sceneId}.visual-review.v1.json`), 'RAW_REVIEW');
    const errors = validateRawVisualReview(scene, readJson(rawReviewPath), {
      sourceScene, policy: sourceManifest.policy,
    });
    requireThat(errors.length === 0, `CANVAS_RAW_REVIEW_INVALID:${errors.join('|')}`);
    const baked = receipt.scenes.find((item) => item.sceneId === scene.sceneId);
    const finalReviewPath = checked(path.join(job.output.qaRoot, `${scene.sceneId}.text-baked-visual-review.v1.json`), 'FINAL_REVIEW');
    const finalReview = readJson(finalReviewPath);
    const criteria = ['actualSurfaceCalibration', 'exactChineseText', 'paperSurfacePlacement', 'noExtraText', 'rigidMotionReady'];
    requireThat(finalReview.schemaVersion === 'koubo-paper-text-baked-visual-review/v1' &&
      finalReview.sceneId === scene.sceneId && finalReview.imageSha256 === baked.outputImage.sha256 &&
      finalReview.status === 'passed' && criteria.every((key) => finalReview.criteria?.[key] === 'passed') &&
      typeof finalReview.notes === 'string' && finalReview.notes.trim(), `CANVAS_FINAL_REVIEW_INVALID:${scene.sceneId}`);
    const motion = manifest.scenes.find((item) => item.sceneId === scene.sceneId);
    requireThat(sourceScene?.aspectRatio === '16:9' &&
      (motion.aspectRatio === undefined || motion.aspectRatio === sourceScene.aspectRatio), `CANVAS_ASPECT_RATIO_INVALID:${scene.sceneId}`);
    return {sceneId: scene.sceneId, pairId: scene.pairId, pairSha256: scene.pairSha256,
      inputFirstFrame: {...baked.outputImage, fileName: path.basename(baked.outputImage.path), bytes: statSync(baked.outputImage.path).size},
      imageToVideoPrompt: motion.imageToVideoPrompt, imageToVideoPromptSha256: motion.imageToVideoPromptSha256,
      motionContractSha256: motion.motionContractSha256, durationSeconds: motion.durationSeconds,
      aspectRatio: sourceScene.aspectRatio, model: 'MiniMax H3', resolution: '2K',
      rawReview: {path: rawReviewPath, sha256: sha256File(rawReviewPath)},
      finalReview: {path: finalReviewPath, sha256: sha256File(finalReviewPath)},
      userAcceptance: 'pending', dynamicValidation: 'pending', submissionAllowed: false};
  });
  const output = resolveInside(root, args.output ?? path.join(job.output.handoffRoot, 'runninghub-canvas-preparation-pack.v1.json'), 'OUTPUT');
  resolveInside(root, realpathSync(path.dirname(output)), 'OUTPUT');
  writeNewJson(output, {schemaVersion: 'koubo-runninghub-canvas-preparation-pack/v1',
    status: 'canvas-preparation-only-awaiting-user-review', taskId: job.taskId, requestId: job.requestId,
    revisionId: job.revisionId, policy: job.policy, sourceJob: {path: jobPath, sha256: sha256File(jobPath)},
    sourceRunningHubManifest: {path: motionPath, sha256: sha256File(motionPath)},
    preparationAuthorization: {path: authorizationPath, sha256: sha256File(authorizationPath)},
    textBakeReceipt: record.receipt, assetSetSha256: incident.metadata.assetSetSha256,
    uploadAllowed: true, canvasConfigurationAllowed: true, userAcceptance: 'pending',
    taskSubmitted: false, videoGenerated: false, codexSubmissionAllowed: false, paidGenerationAllowed: false,
    batchDynamicallyAccepted: false, formalEnabled: false, publicationEnabled: false,
    sceneCount: scenes.length, scenes});
  console.log(JSON.stringify({ok: true, outputPath: output, sceneCount: scenes.length, taskSubmitted: false}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
