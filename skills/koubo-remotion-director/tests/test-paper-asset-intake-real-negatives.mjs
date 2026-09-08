#!/usr/bin/env node
// Read-only regression adapter for existing failed media; never generates or approves media.
import assert from 'node:assert/strict';
import {existsSync, readFileSync, mkdtempSync, symlinkSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256File} from '../scripts/preproduction-director-core.mjs';
import {validatePaperFrameOcr, validatePaperIncidentRegistryAssets, requiredPaperIntakeFrames} from '../scripts/paper-asset-intake-incident.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const episode = path.join(projectRoot, 'edit/20260906_lanzhou_ai_services');
const root = path.join(episode, '07_预览与质检/paper-intake-r1');
const intakePath = path.join(episode, '00_工程控制/paper-asset-intake.v1.json');
if (!existsSync(intakePath)) {
  console.log(JSON.stringify({skipped: true, reason: 'local historical evidence unavailable', actualMediaAccepted: false}));
} else {
  const json = p => JSON.parse(readFileSync(p, 'utf8'));
  const intake = json(intakePath);
  const manifest = json(path.join(root, 'evidence-manifest-r2.json'));
  const indexed = new Map(manifest.entries.map(entry => [entry.path, entry.sha256]));
  const verified = new Set();
  const verify = p => {assert.equal(sha256File(p), indexed.get(p), `Historical evidence hash mismatch: ${p}`); verified.add(p); return {path: p, sha256: indexed.get(p)};};
  const ocrPath = path.join(root, 'label-ocr-results.json');
  const ocrRef = verify(ocrPath);
  const ocr = json(ocrPath);
  assert.equal(sha256File(intake.sourcePlan.path), intake.sourcePlan.sha256);
  const visualReview = verify(path.join(root, 'visual-review.json'));
  const results = [];
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'paper-intake-negative-alias-'));
  try {
    for (const [sceneId, indices] of [['P03', [96, 120]], ['P05', [48, 60]]]) {
      const asset = intake.assets.find(a => a.sceneId === sceneId);
      assert.equal(sha256File(asset.generatedVideo.path), asset.generatedVideo.sha256);
      const history = ocr.find(a => a.sceneId === sceneId);
      assert.equal(history.sourceSha256, asset.generatedVideo.sha256);
      const samplesPath = path.join(root, asset.assetId, 'samples.json');
      verify(samplesPath);
      const samples = json(samplesPath);
      const allNodes = history.samples[0].results.map(n => ({nodeId: n.nodeId, text: n.expected,
        enterStageId: 'initial', firstReadableFrame: 0, persistence: 'initial-to-end'}));
      // Adapter adds binding fields in memory only; it does not rewrite or promote old OCR.
      const scene = {textPlan: allNodes, stages: [{id: 'risk'}], motionContract: {actions: [{id: 'risk', stageId: 'risk',
        startSeconds: indices[0] / 24, endSeconds: indices[1] / 24}]}};
      const sampling = requiredPaperIntakeFrames(scene, {frameCount: asset.frame.frameCount, fpsNumerator: 24, fpsDenominator: 1});
      assert.deepEqual(sampling.errors, []);
      for (const frameIndex of indices) {
        assert.ok(sampling.frameIndices.includes(frameIndex));
        const old = history.samples.find(s => s.frameIndex === frameIndex);
        const sample = samples.find(s => s.frameIndex === frameIndex);
        const frame = {...verify(sample.path), frameIndex};
        const receipt = {schemaVersion: 'koubo-paper-frame-ocr/v1', sceneId, frameIndex,
          videoSha256: asset.generatedVideo.sha256, planSha256: intake.sourcePlan.sha256, imageSha256: frame.sha256,
          engine: {name: 'historical-tesseract-chi_sim-psm7-readonly-adapter', version: 'historical'},
          results: old.results.map(n => ({nodeId: n.nodeId, expected: n.expected, recognized: n.recognized,
            visibility: 'visible-readable', raw: {...verify(n.rawTsv), format: 'tesseract-tsv'}}))};
        const errors = validatePaperFrameOcr({receipt, scene, frame, videoSha256: asset.generatedVideo.sha256,
          planSha256: intake.sourcePlan.sha256, sceneId, projectRoot, fps: 24});
        const failedNode = sceneId === 'P03' ? 'N2' : 'N1';
        assert.ok(errors.includes(`OCR_NODE_NOT_EXACT_OR_VISIBLE:${failedNode}`), JSON.stringify(errors));
        results.push({sceneId, frameIndex, seconds: frameIndex / 24, videoSha256: asset.generatedVideo.sha256,
          image: frame, ocr: ocrRef, observedRecognized: old.results.find(n => n.nodeId === failedNode).recognized,
          rejected: true, errors});
      }
      const alias = path.join(temporary, `${sceneId}-renamed-success.mp4`);
      symlinkSync(asset.generatedVideo.path, alias);
      const registry = validatePaperIncidentRegistryAssets({projectRoot,
        assets: [{sceneId, generatedVideo: {path: alias, sha256: '0'.repeat(64)}, productionCandidate: {path: alias, sha256: asset.generatedVideo.sha256}}]});
      assert.equal(registry.errors.filter(e => e.includes('NEGATIVECASE_NOT_REUSABLE')).length, 2);
    }
    console.log(JSON.stringify({ok: true, evidenceClass: 'existing-real-failure-readonly',
      verifiedHistoricalFiles: verified.size, realFailedFramesRejected: results.length, renamedSourceChecks: 4,
      visualReview, results, actualMediaAccepted: false,
      limitation: 'OCR mismatch rejects acceptance; it alone does not prove occlusion/disappearance. No rerender or fresh OCR was performed.'}, null, 2));
  } finally {rmSync(temporary, {recursive: true, force: true});}
}
