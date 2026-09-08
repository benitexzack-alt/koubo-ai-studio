#!/usr/bin/env node

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePaperAssetIntake} from './paper-asset-intake-core.mjs';
import {resolveDeclared, sha256File} from './preproduction-director-core.mjs';
import {verifyPaperSourceFrames} from './paper-asset-intake-media.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProjectRoot = path.resolve(skillRoot, '../..');
const values = {};
for (let index = 2; index < process.argv.length; index += 1) {
  if (!process.argv[index].startsWith('--')) continue;
  values[process.argv[index].slice(2)] = process.argv[index + 1];
  index += 1;
}

const projectRoot = path.resolve(values['repo-root'] ?? defaultProjectRoot);
const requestPath = resolveDeclared(projectRoot, values.request);
try {
  if (!requestPath || !existsSync(requestPath)) throw new Error('PAPER_ASSET_REQUEST_MISSING');
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));
  const requestSha256 = sha256File(requestPath);
  const validation = validatePaperAssetIntake({
    request,
    requestPath,
    projectRoot,
    requireContactSheet: true,
  });
  if (!validation.ok) throw new Error(`PAPER_ASSET_INTAKE_INVALID:${validation.errors.join('|')}`);
  const receiptPath = resolveDeclared(projectRoot, request.outputs.validationReceiptPath);
  if (!receiptPath || existsSync(receiptPath)) throw new Error('PAPER_ASSET_RECEIPT_PATH_INVALID');
  const sourceVerification = [];
  if (validation.incidentPreventionVersion === '1') {
    for (const asset of validation.orderedAssets) {
      const mediaQa = JSON.parse(readFileSync(resolveDeclared(projectRoot, asset.mediaQaReceipt.path), 'utf8'));
      sourceVerification.push({sceneId: asset.sceneId, ...verifyPaperSourceFrames({
        videoPath: resolveDeclared(projectRoot, asset.productionCandidate.path), videoSha256: asset.productionCandidate.sha256,
        frames: asset.evidenceFrames.map(frame => ({...frame, path: resolveDeclared(projectRoot, frame.path)})), expectedMedia: mediaQa,
      })});
    }
    const after = validatePaperAssetIntake({request, requestPath, projectRoot, requireContactSheet: true});
    if (!after.ok) throw new Error(`PAPER_ASSET_CHANGED_DURING_SOURCE_VERIFICATION:${after.errors.join('|')}`);
  }
  if (sha256File(requestPath) !== requestSha256) throw new Error('PAPER_ASSET_REQUEST_CHANGED_DURING_VERIFICATION');
  const receipt = {
    schemaVersion: 'koubo-paper-generated-asset-intake-receipt/v1',
    taskId: request.taskId,
    status: 'validated-candidate-assets-ready-for-preview',
    formalEligible: false,
    request: {path: requestPath, sha256: requestSha256},
    sourcePlan: {path: validation.planPath, sha256: request.sourcePlan.sha256},
    assetSetSha256: validation.assetSetSha256,
    ...(validation.incidentPreventionVersion === '1' ? {
      policy: {incidentPreventionVersion: '1'},
      revisionId: validation.revisionId,
      incidentRegistry: validation.incidentRegistry,
      dynamicEvidence: validation.dynamicEvidence,
      sourceVerification,
      evidenceBoundary: 'bound-sampled-evidence-only-not-full-frame-or-user-acceptance',
    } : {}),
    contactSheet: {
      manifestPath: validation.contactSheetManifestPath,
      manifestSha256: sha256File(validation.contactSheetManifestPath),
      image: validation.contactSheetManifest.image,
      ...(validation.incidentPreventionVersion === '1' ? {pages: validation.contactSheetManifest.pages} : {}),
    },
    gates: {
      sourceIdentityBound: true,
      canonicalSceneNamesBound: true,
      firstMiddleLastFramesBound: true,
      silentViewRetellingPassed: true,
      inputActionOutputPassed: true,
      textOcrAndDriftPassed: true,
      crossSceneSwapRejected: true,
      contactSheetBuiltFromBoundAssets: true,
      ...(validation.incidentPreventionVersion === '1' ? {
        actionBoundaryAndHighRiskSamplingBound: true,
        everyActiveNodeAtEverySampleBound: true,
        semanticAndSilentReviewArtifactsBound: true,
        knownNegativeSourceReuseRejected: true,
        actualProbeFullDecodeAndSourceFramePixelsVerified: true,
      } : {}),
    },
  };
  mkdirSync(path.dirname(receiptPath), {recursive: true});
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(JSON.stringify({ok: true, receiptPath, assetCount: validation.orderedAssets.length}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
