#!/usr/bin/env node

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  validatePostshootRebindRequest,
  validatePostshootRebindPlan,
} from './postshoot-rebind-core.mjs';
import {resolveDeclared, sha256File} from './preproduction-director-core.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProjectRoot = path.resolve(skillRoot, '../..');
const values = {};
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token.startsWith('--')) continue;
  values[token.slice(2)] = process.argv[index + 1];
  index += 1;
}

const projectRoot = path.resolve(values['repo-root'] ?? defaultProjectRoot);
const requestPath = resolveDeclared(projectRoot, values.request);
if (!requestPath || !existsSync(requestPath)) {
  console.error('POSTSHOOT_REQUEST_FILE_MISSING');
  process.exit(1);
}

try {
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));
  const validation = validatePostshootRebindRequest({request, projectRoot});
  if (!validation.ok) {
    throw new Error(`POSTSHOOT_REQUEST_INVALID:${validation.errors.join('|')}`);
  }
  const planPath = resolveDeclared(projectRoot, request.outputs.rebindPlanPath);
  const receiptPath = resolveDeclared(projectRoot, request.outputs.validationReceiptPath);
  if (!existsSync(planPath)) throw new Error(`POSTSHOOT_PLAN_MISSING:${planPath}`);
  if (existsSync(receiptPath)) throw new Error(`POSTSHOOT_RECEIPT_ALREADY_EXISTS:${receiptPath}`);
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const planValidation = validatePostshootRebindPlan({request, requestPath, validation, plan});
  if (!planValidation.ok) {
    throw new Error(`POSTSHOOT_PLAN_INVALID:${planValidation.errors.join('|')}`);
  }

  const receipt = {
    schemaVersion: 'koubo-director-postshoot-validation-receipt/v1',
    requestId: request.requestId,
    taskId: request.taskId,
    revisionId: request.revisionId,
    policy: {incidentPreventionVersion: '1'},
    phase: 'post-shoot',
    status: 'validated-candidate-preview-required',
    skillExecuted: true,
    spokenAuthority: 'recorded-audio',
    scriptRole: 'comparison-only',
    artifacts: {
      request: {path: requestPath, sha256: sha256File(requestPath)},
      rebindPlan: {path: planPath, sha256: sha256File(planPath)},
      recordedMedia: {
        path: validation.recordedMediaPath,
        sha256: sha256File(validation.recordedMediaPath),
      },
      spokenTimeline: {
        path: validation.spokenTimelinePath,
        sha256: sha256File(validation.spokenTimelinePath),
      },
      scopedEvidence: validation.boundInputs.slice(5),
    },
    gates: {
      allPreproductionBeatsMapped: true,
      allKeptBeatsMatchDerivedPlan: true,
      omittedBeatsRemainInDispositionLedgerOnly: true,
      omissionRequiresFullRecordingReviewEvidence: true,
      recordedSpeechBound: true,
      deterministicNodeTextReconfirmed: true,
      declaredCaptionWindowsBound: true,
      exactSpokenTermsBoundPerNode: true,
      visualClaimLeadAtMost300Ms: true,
      firstReadableFrameIsIndependentOfAction: true,
      movingLabelAndEmphasisOffsetAtMost3Frames: true,
      initialStaticLabelsDoNotRequireFakeActions: true,
      mismatchRejectedAndPartialRequiresUserException: true,
      partialExceptionBoundToCurrentRevisionAndSource: true,
      renderedAssetTimingVerified: false,
      postshootPaperScenesReadyForAssetBinding: true,
      formalAssetIntakeRequired: true,
      formalEligible: false,
      nextGate: 'current-task-withsfx-nosfx-preview-and-user-acceptance',
    },
  };
  mkdirSync(path.dirname(receiptPath), {recursive: true});
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(JSON.stringify({ok: true, receiptPath, beatCount: plan.beats.length}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
