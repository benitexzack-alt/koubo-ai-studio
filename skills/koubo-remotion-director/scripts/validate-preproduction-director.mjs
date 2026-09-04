#!/usr/bin/env node

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  DIRECTOR_ROUTE_LOCK_SCHEMA,
  PREPRODUCTION_PLAN_SCHEMA,
  renderAiGeneratedVideoPromptSheet,
  resolveDeclared,
  sha256File,
  validatePromptHandoffManifests,
  validatePreproductionRequest,
} from './preproduction-director-core.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultProjectRoot = path.resolve(skillRoot, '../..');

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    values[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

const args = parseArgs(process.argv.slice(2));
const projectRoot = path.resolve(args['repo-root'] ?? defaultProjectRoot);
const requestPath = resolveDeclared(projectRoot, args.request);
if (!requestPath || !existsSync(requestPath)) {
  console.error('PREPRODUCTION_REQUEST_FILE_MISSING');
  process.exit(1);
}

try {
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));
  const profile = JSON.parse(
    readFileSync(resolveDeclared(projectRoot, request.directorProfile.path), 'utf8'),
  );
  const requestValidation = validatePreproductionRequest({request, projectRoot, profile});
  if (!requestValidation.ok) {
    throw new Error(`PREPRODUCTION_REQUEST_INVALID:${requestValidation.errors.join('|')}`);
  }
  const v9ContractEnabled = request.policy?.v9ContractEnabled === true;

  const planPath = resolveDeclared(projectRoot, request.outputs.planPath);
  const routeLockPath = resolveDeclared(projectRoot, request.outputs.routeLockPath);
  const assetSheetPath = resolveDeclared(projectRoot, request.outputs.assetSheetPath);
  const firstFramePromptManifestPath = resolveDeclared(
    projectRoot,
    request.outputs.firstFramePromptManifestPath,
  );
  const runningHubPromptManifestPath = resolveDeclared(
    projectRoot,
    request.outputs.runningHubPromptManifestPath,
  );
  const runningHubPromptSheetPath = resolveDeclared(
    projectRoot,
    request.outputs.runningHubPromptSheetPath,
  );
  const aiGeneratedVideoPromptManifestPath = v9ContractEnabled
    ? resolveDeclared(projectRoot, request.outputs.aiGeneratedVideoPromptManifestPath)
    : null;
  const aiGeneratedVideoPromptSheetPath = v9ContractEnabled
    ? resolveDeclared(projectRoot, request.outputs.aiGeneratedVideoPromptSheetPath)
    : null;
  const compileReceiptPath = resolveDeclared(projectRoot, request.outputs.compileReceiptPath);
  const validationReceiptPath = resolveDeclared(
    projectRoot,
    request.outputs.validationReceiptPath,
  );
  const requiredArtifactPaths = [
    planPath,
    routeLockPath,
    assetSheetPath,
    firstFramePromptManifestPath,
    runningHubPromptManifestPath,
    runningHubPromptSheetPath,
    compileReceiptPath,
    ...(v9ContractEnabled
      ? [aiGeneratedVideoPromptManifestPath, aiGeneratedVideoPromptSheetPath]
      : []),
  ];
  for (const requiredPath of requiredArtifactPaths) {
    if (!existsSync(requiredPath)) throw new Error(`PREPRODUCTION_ARTIFACT_MISSING:${requiredPath}`);
  }
  if (existsSync(validationReceiptPath)) {
    throw new Error(`PREPRODUCTION_VALIDATION_RECEIPT_ALREADY_EXISTS:${validationReceiptPath}`);
  }

  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const routeLock = JSON.parse(readFileSync(routeLockPath, 'utf8'));
  const compileReceipt = JSON.parse(readFileSync(compileReceiptPath, 'utf8'));
  const firstFramePromptManifest = JSON.parse(
    readFileSync(firstFramePromptManifestPath, 'utf8'),
  );
  const runningHubPromptManifest = JSON.parse(
    readFileSync(runningHubPromptManifestPath, 'utf8'),
  );
  const aiGeneratedVideoPromptManifest = v9ContractEnabled
    ? JSON.parse(readFileSync(aiGeneratedVideoPromptManifestPath, 'utf8'))
    : null;
  const errors = [];
  if (plan.schemaVersion !== PREPRODUCTION_PLAN_SCHEMA) errors.push('PLAN_SCHEMA_INVALID');
  if (routeLock.schemaVersion !== DIRECTOR_ROUTE_LOCK_SCHEMA) errors.push('ROUTE_LOCK_SCHEMA_INVALID');
  if (plan.requestId !== request.requestId || routeLock.requestId !== request.requestId) {
    errors.push('REQUEST_ID_BINDING_MISMATCH');
  }
  if (plan.status !== 'provisional-previsualization' || plan.formalEligible !== false) {
    errors.push('PLAN_STATE_INVALID');
  }
  if (v9ContractEnabled && plan.v9Contract?.enabled !== true) {
    errors.push('PLAN_V9_CONTRACT_MARKER_MISSING');
  }
  if (!v9ContractEnabled && Object.hasOwn(plan, 'v9Contract')) {
    errors.push('LEGACY_PLAN_CONTAINS_V9_CONTRACT_MARKER');
  }
  if (routeLock.branch !== 'paper-editorial' || routeLock.fallback !== 'blocked') {
    errors.push('ROUTE_LOCK_BRANCH_INVALID');
  }
  if (routeLock.genericInformationCardCanSatisfyPaperBeat !== false) {
    errors.push('ROUTE_LOCK_GENERIC_CARD_ALLOWED');
  }
  if (compileReceipt.compilerExecuted !== true || compileReceipt.skillExecuted !== false) {
    errors.push('COMPILE_RECEIPT_STATE_INVALID');
  }
  if (compileReceipt.request.sha256 !== sha256File(requestPath)) {
    errors.push('COMPILE_RECEIPT_REQUEST_SHA_MISMATCH');
  }
  if (compileReceipt.plan.sha256 !== sha256File(planPath)) {
    errors.push('COMPILE_RECEIPT_PLAN_SHA_MISMATCH');
  }
  if (compileReceipt.routeLock.sha256 !== sha256File(routeLockPath)) {
    errors.push('COMPILE_RECEIPT_ROUTE_SHA_MISMATCH');
  }
  if (compileReceipt.assetSheet.sha256 !== sha256File(assetSheetPath)) {
    errors.push('COMPILE_RECEIPT_ASSET_SHEET_SHA_MISMATCH');
  }
  if (
    compileReceipt.firstFramePromptManifest.sha256 !==
    sha256File(firstFramePromptManifestPath)
  ) {
    errors.push('COMPILE_RECEIPT_FIRST_FRAME_PROMPT_SHA_MISMATCH');
  }
  if (
    compileReceipt.runningHubPromptManifest.sha256 !==
    sha256File(runningHubPromptManifestPath)
  ) {
    errors.push('COMPILE_RECEIPT_RUNNINGHUB_PROMPT_SHA_MISMATCH');
  }
  if (
    compileReceipt.runningHubPromptSheet.sha256 !== sha256File(runningHubPromptSheetPath)
  ) {
    errors.push('COMPILE_RECEIPT_RUNNINGHUB_SHEET_SHA_MISMATCH');
  }
  if (v9ContractEnabled) {
    if (
      compileReceipt.aiGeneratedVideoPromptManifest?.sha256 !==
      sha256File(aiGeneratedVideoPromptManifestPath)
    ) {
      errors.push('COMPILE_RECEIPT_AI_VIDEO_PROMPT_SHA_MISMATCH');
    }
    if (
      compileReceipt.aiGeneratedVideoPromptSheet?.sha256 !==
      sha256File(aiGeneratedVideoPromptSheetPath)
    ) {
      errors.push('COMPILE_RECEIPT_AI_VIDEO_SHEET_SHA_MISMATCH');
    }
    if (
      readFileSync(aiGeneratedVideoPromptSheetPath, 'utf8') !==
      renderAiGeneratedVideoPromptSheet(plan, aiGeneratedVideoPromptManifest)
    ) {
      errors.push('AI_VIDEO_PROMPT_SHEET_CONTENT_MISMATCH');
    }
  }
  const handoffValidation = validatePromptHandoffManifests({
    plan,
    firstFrameManifest: firstFramePromptManifest,
    runningHubManifest: runningHubPromptManifest,
    aiGeneratedVideoManifest: aiGeneratedVideoPromptManifest,
  });
  errors.push(...handoffValidation.errors);
  if (plan.routeSummary.paperBeatCount !== routeLock.paperBeatIds.length) {
    errors.push('PAPER_BEAT_COUNT_MISMATCH');
  }
  if (plan.paperScenes.length === 0) errors.push('PAPER_SCENES_EMPTY');
  if (errors.length > 0) throw new Error(`PREPRODUCTION_VALIDATION_FAILED:${errors.join('|')}`);

  const receipt = {
    schemaVersion: 'koubo-director-validation-receipt/v1',
    requestId: request.requestId,
    taskId: request.taskId,
    phase: 'pre-shoot',
    status: 'validated-provisional-previsualization',
    skillRead: true,
    skillExecuted: true,
    compilerExecuted: true,
    validatorExecuted: true,
    artifacts: {
      request: {path: requestPath, sha256: sha256File(requestPath)},
      routeLock: {path: routeLockPath, sha256: sha256File(routeLockPath)},
      plan: {path: planPath, sha256: sha256File(planPath)},
      assetSheet: {path: assetSheetPath, sha256: sha256File(assetSheetPath)},
      firstFramePromptManifest: {
        path: firstFramePromptManifestPath,
        sha256: sha256File(firstFramePromptManifestPath),
      },
      runningHubPromptManifest: {
        path: runningHubPromptManifestPath,
        sha256: sha256File(runningHubPromptManifestPath),
      },
      runningHubPromptSheet: {
        path: runningHubPromptSheetPath,
        sha256: sha256File(runningHubPromptSheetPath),
      },
      ...(v9ContractEnabled
        ? {
            aiGeneratedVideoPromptManifest: {
              path: aiGeneratedVideoPromptManifestPath,
              sha256: sha256File(aiGeneratedVideoPromptManifestPath),
            },
            aiGeneratedVideoPromptSheet: {
              path: aiGeneratedVideoPromptSheetPath,
              sha256: sha256File(aiGeneratedVideoPromptSheetPath),
            },
          }
        : {}),
      compileReceipt: {path: compileReceiptPath, sha256: sha256File(compileReceiptPath)},
    },
    gates: {
      paperRequiredBeatsCovered: true,
      genericCardFallbackBlocked: true,
      deterministicNodeTextPresent: true,
      modelGeneratedReadableTextBlocked: true,
      paperNodeTextBoundToSurfaceAndStage: true,
      labelObjectBindingsUnambiguous: true,
      unlabeledObjectGroupsExplicitlyDeclared: true,
      symbolCueConflictsBlocked: true,
      movingSurfaceUsesTrackedRemotionText: true,
      rigidSurfaceFirstFrameBakeRequiresOcr: true,
      screenOverlayCannotSatisfyPaperNode: true,
      silentTextTruncationBlocked: true,
      firstFrameAndImageToVideoPromptsSeparated: true,
      promptPairsBoundOneToOne: true,
      ...(v9ContractEnabled
        ? {
            normalizedPaperLayoutContractsRequired: true,
            firstFrameNumericSafetyTermsRequired: true,
            aiGeneratedVideoPromptPackageSeparated: true,
          }
        : {}),
      postShootRebindRequired: true,
      formalAssetIntakeRequired: true,
      formalEligible: false,
    },
  };
  mkdirSync(path.dirname(validationReceiptPath), {recursive: true});
  writeFileSync(validationReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  console.log(JSON.stringify({ok: true, validationReceiptPath, paperSceneCount: plan.paperScenes.length}));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
