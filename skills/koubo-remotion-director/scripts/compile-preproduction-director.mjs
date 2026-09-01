#!/usr/bin/env node

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildFirstFramePromptManifest,
  buildRouteLock,
  buildRunningHubPromptManifest,
  compilePreproductionPlan,
  renderAssetSheet,
  renderRunningHubPromptSheet,
  resolveDeclared,
  sha256File,
  sha256Json,
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

function writeNew(filePath, content) {
  if (existsSync(filePath)) throw new Error(`PREPRODUCTION_OUTPUT_ALREADY_EXISTS:${filePath}`);
  mkdirSync(path.dirname(filePath), {recursive: true});
  writeFileSync(filePath, content, {encoding: 'utf8', flag: 'wx', mode: 0o600});
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
  const profilePath = resolveDeclared(projectRoot, request.directorProfile.path);
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const stylePath = resolveDeclared(projectRoot, profile.style.path);
  const style = JSON.parse(readFileSync(stylePath, 'utf8'));
  const validation = validatePreproductionRequest({request, projectRoot, profile});
  if (!validation.ok) {
    throw new Error(`PREPRODUCTION_REQUEST_INVALID:${validation.errors.join('|')}`);
  }

  const plan = compilePreproductionPlan({request, requestPath, profile, style});
  const routeLock = buildRouteLock({request, requestPath, profile, style, plan});
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
  const compileReceiptPath = resolveDeclared(projectRoot, request.outputs.compileReceiptPath);
  const firstFramePromptManifest = buildFirstFramePromptManifest(plan);
  const runningHubPromptManifest = buildRunningHubPromptManifest(plan);

  writeNew(routeLockPath, `${JSON.stringify(routeLock, null, 2)}\n`);
  writeNew(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  writeNew(assetSheetPath, renderAssetSheet(plan));
  writeNew(
    firstFramePromptManifestPath,
    `${JSON.stringify(firstFramePromptManifest, null, 2)}\n`,
  );
  writeNew(
    runningHubPromptManifestPath,
    `${JSON.stringify(runningHubPromptManifest, null, 2)}\n`,
  );
  writeNew(
    runningHubPromptSheetPath,
    renderRunningHubPromptSheet(plan, runningHubPromptManifest),
  );

  const receipt = {
    schemaVersion: 'koubo-director-compile-receipt/v1',
    requestId: request.requestId,
    taskId: request.taskId,
    phase: 'pre-shoot',
    compilerExecuted: true,
    skillExecuted: false,
    skillExecutionBoundary: '需等独立验证器通过后才能记录 skillExecuted=true',
    command: {
      cwd: projectRoot,
      argv: process.argv.slice(1),
    },
    request: {path: requestPath, sha256: sha256File(requestPath)},
    routeLock: {path: routeLockPath, sha256: sha256File(routeLockPath)},
    plan: {path: planPath, sha256: sha256File(planPath), canonicalSha256: sha256Json(plan)},
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
    formalEligible: false,
    postShootRebindRequired: true,
  };
  writeNew(compileReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(
    JSON.stringify({
      ok: true,
      planPath,
      routeLockPath,
      assetSheetPath,
      firstFramePromptManifestPath,
      runningHubPromptManifestPath,
      runningHubPromptSheetPath,
      compileReceiptPath,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
