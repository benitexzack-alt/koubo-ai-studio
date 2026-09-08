#!/usr/bin/env node
// Existing failure media only. Temporary diagnostic plans are engineering adapters.
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File} from '../scripts/preproduction-director-core.mjs';
import {probePaperVideo, paperMediaTools, verifyPaperSourceFrames} from '../scripts/paper-asset-intake-media.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const historical = path.join(project, 'edit/20260906_lanzhou_ai_services/00_工程控制/paper-asset-intake.v1.json');
if (!existsSync(historical)) {
  console.log(JSON.stringify({skipped: true, reason: 'local failure media unavailable', actualMediaAccepted: false}));
} else {
  const root = mkdtempSync(path.join(os.tmpdir(), 'paper-intake-real-media-negative-'));
  try {
    const intake = JSON.parse(readFileSync(historical));
    const sourcePlan = JSON.parse(readFileSync(intake.sourcePlan.path));
    const asset = intake.assets.find(item => item.sceneId === 'P05');
    const plan = structuredClone(sourcePlan);
    plan.phase = 'post-shoot'; plan.revisionId = 'negative-readonly-engineering-adapter';
    plan.policy = {incidentPreventionVersion: '1'};
    const scene = plan.paperScenes[4];
    const duration = asset.frame.frameCount / 24;
    scene.motionContract = {actions: scene.stages.map((stage, index) => ({id: `diagnostic-${index}`, stageId: stage.id,
      startSeconds: index * duration / scene.stages.length, endSeconds: (index + 1) * duration / scene.stages.length})),
    highRiskWindows: [{id: 'real-known-missing-label', startSeconds: 2, endSeconds: 2.5}]};
    scene.textPlan = scene.textPlan.map(node => ({...node, enterStageId: 'initial', firstReadableFrame: 0, persistence: 'initial-to-end'}));
    const planPath = path.join(root, 'diagnostic-adapter-plan.json');
    writeFileSync(planPath, JSON.stringify(plan));
    const collector = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/collect-paper-asset-intake-evidence.mjs');
    const args = ['--plan', planPath, '--scene-id', 'P05', '--video', asset.path];
    const rejected = spawnSync(process.execPath, [collector, ...args, '--out', path.join(root, 'must-not-exist')], {encoding: 'utf8', timeout: 120000});
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /NEGATIVECASE_NOT_REUSABLE/u);
    assert.equal(existsSync(path.join(root, 'must-not-exist')), false);
    const out = path.join(root, 'diagnostic-evidence');
    const collection = spawnSync(process.execPath, [collector, ...args, '--out', out, '--diagnose-known-negative'], {encoding: 'utf8', timeout: 240000});
    assert.equal(collection.status, 2, collection.stderr);
    const summary = JSON.parse(collection.stdout);
    const bundle = JSON.parse(readFileSync(summary.receipt.path));
    assert.equal(bundle.status, 'negative-regression-only-not-eligible');
    assert.ok(bundle.negativeCaseErrors.length > 0);
    assert.ok(bundle.ocrFailures.length > 0);
    const evidence = bundle.assetEvidence;
    const mediaQa = JSON.parse(readFileSync(evidence.mediaQaReceipt.path));
    assert.equal(mediaQa.fullDecodePassed, true);
    assert.equal(mediaQa.width, 2560); assert.equal(mediaQa.height, 1440);
    assert.equal(mediaQa.frameCount, 226); assert.equal(mediaQa.fpsNumerator, 24);
    assert.equal(JSON.parse(readFileSync(evidence.semanticReviewReceipt.path)).status, 'pending-review');
    assert.equal(JSON.parse(readFileSync(evidence.silentViewReviewReceipt.path)).reviewerId, null);
    const verified = verifyPaperSourceFrames({videoPath: evidence.productionCandidate.path,
      videoSha256: evidence.productionCandidate.sha256, frames: evidence.evidenceFrames, expectedMedia: mediaQa});
    assert.equal(verified.frames.length, evidence.evidenceFrames.length);
    const wrong = structuredClone(evidence.evidenceFrames.filter(frame => frame.frameIndex === 48));
    assert.equal(wrong.length, 1);
    const later = evidence.evidenceFrames.find(frame => frame.frameIndex === 60);
    wrong[0].path = later.path; wrong[0].sha256 = later.sha256;
    assert.throws(() => verifyPaperSourceFrames({videoPath: evidence.productionCandidate.path,
      videoSha256: evidence.productionCandidate.sha256, frames: wrong, expectedMedia: mediaQa}), /FRAME_PIXEL_MISMATCH:48/u);
    const p03 = intake.assets.find(item => item.sceneId === 'P03');
    const actualP03 = probePaperVideo(p03.path, paperMediaTools());
    assert.equal(actualP03.media.frameCount, 192);
    assert.equal(sha256File(asset.path), asset.sha256);
    assert.equal(sha256File(p03.path), p03.sha256);
    assert.equal(sha256File(intake.sourcePlan.path), intake.sourcePlan.sha256);
    console.log(JSON.stringify({ok: true, evidenceClass: 'real-existing-failure-media-readonly',
      actualProbeP03: actualP03.media, actualProbeP05: verified.media,
      realFullDecodePassed: true, sourcePixelFramesVerified: verified.frames.length,
      realOcrFailedSamples: bundle.ocrFailures.length, forgedFrame48UsingFrame60Rejected: true,
      knownNegativeNewIntakeRejectedBeforeOutput: true, diagnosticExitCode: collection.status,
      originalVideosAndPlanUnchanged: true, actualMediaAccepted: false, diagnosticOutputsTemporary: true}));
  } finally {rmSync(root, {recursive: true, force: true});}
}
