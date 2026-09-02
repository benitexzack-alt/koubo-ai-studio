#!/usr/bin/env node

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  POSTSHOOT_PLAN_SCHEMA,
  validatePostshootRebindRequest,
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
  const errors = [];
  if (plan.schemaVersion !== POSTSHOOT_PLAN_SCHEMA) errors.push('POSTSHOOT_PLAN_SCHEMA_INVALID');
  if (plan.requestId !== request.requestId || plan.taskId !== request.taskId) {
    errors.push('POSTSHOOT_PLAN_BINDING_MISMATCH');
  }
  if (plan.spokenAuthority !== 'recorded-audio' || plan.scriptRole !== 'comparison-only') {
    errors.push('POSTSHOOT_SPOKEN_AUTHORITY_INVALID');
  }
  if (plan.formalEligible !== false || plan.status !== 'candidate-preview-required') {
    errors.push('POSTSHOOT_PLAN_STATE_INVALID');
  }
  const planBeats = Array.isArray(plan.beats) ? plan.beats : [];
  if (planBeats.length !== request.mappings.length) errors.push('POSTSHOOT_PLAN_COVERAGE_INVALID');
  const paperBeats = planBeats.filter((beat) => beat.paperScene);
  const paperScenes = Array.isArray(plan.paperScenes) ? plan.paperScenes : [];
  if (paperScenes.length !== paperBeats.length) {
    errors.push('POSTSHOOT_PAPER_SCENE_EXPORT_COVERAGE_INVALID');
  }
  paperBeats.forEach((beat, index) => {
    const scene = paperScenes[index];
    if (
      scene?.beatId !== beat.id ||
      scene?.spokenLine !== beat.spokenLine ||
      !Array.isArray(scene?.textPlan) ||
      scene.textPlan.some((item) => !item.postshootBinding)
    ) {
      errors.push(`POSTSHOOT_PAPER_SCENE_EXPORT_INVALID:${beat.id}`);
    }
  });
  if (errors.length > 0) throw new Error(`POSTSHOOT_PLAN_INVALID:${errors.join('|')}`);

  const receipt = {
    schemaVersion: 'koubo-director-postshoot-validation-receipt/v1',
    requestId: request.requestId,
    taskId: request.taskId,
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
    },
    gates: {
      allPreproductionBeatsMapped: true,
      recordedSpeechBound: true,
      deterministicNodeTextReconfirmed: true,
      declaredCaptionWindowsBound: true,
      exactSpokenTermsBoundPerNode: true,
      visualClaimLeadAtMost300Ms: true,
      nodeLabelStageOffsetAtMost3Frames: true,
      mismatchRejectedAndPartialRequiresUserException: true,
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
