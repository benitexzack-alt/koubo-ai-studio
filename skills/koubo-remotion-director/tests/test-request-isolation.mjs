#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  DIRECTOR_COMPILER_RELATIVE_PATH,
  REQUEST_ISOLATION_LIST_FILE_NAME,
  REQUEST_ISOLATION_LIST_SCHEMA,
  REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH,
  REQUEST_ISOLATION_REGISTRY_SHA256_ENV,
  SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
  SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
  compileDirectorPlan,
  enforceRequestIsolation,
  requestAStateBundleSha256,
  requestForbiddenReceiptSha256Values,
  requestSemanticSha256,
  sha256File,
  sha256Text,
  stableStringify,
} from '../scripts/compile-director-plan.mjs';

const testPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(testPath), '../../..');
const compilerPath = path.join(repoRoot, 'skills/koubo-remotion-director/scripts/compile-director-plan.mjs');
const registryPath = path.join(repoRoot, REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH);
const supervisorRegistryPath = path.join(
  repoRoot,
  SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
);
const acceptanceEvidenceRoot = process.env.KOUBO_DIRECTOR_ACCEPTANCE_EVIDENCE_ROOT
  ? path.resolve(process.env.KOUBO_DIRECTOR_ACCEPTANCE_EVIDENCE_ROOT)
  : path.join(
      repoRoot,
      'work/director-paper-editorial/20260824-wechat-real-input/director-skill-recovery/dynamic-gate-01',
    );
const exactRequestPath = path.join(
  acceptanceEvidenceRoot,
  'director-request.exact30.json',
);
if (!existsSync(exactRequestPath)) {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    skipped: true,
    reason: 'external-immutable-acceptance-evidence-missing',
    requiredEnvironment: 'KOUBO_DIRECTOR_ACCEPTANCE_EVIDENCE_ROOT',
  })}\n`);
  process.exit(0);
}
const exactRequestRaw = readFileSync(exactRequestPath, 'utf8');
const exactRequest = JSON.parse(exactRequestRaw);
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'director-request-isolation-test-'));
const originalRegistryAnchor = process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV];
const originalSupervisorRegistryAnchor =
  process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV];

const expectCode = (code, callback) => {
  assert.throws(callback, (error) => error.code === code, `expected ${code}`);
};

const writeRequest = (fileName, request) => {
  const requestPath = path.join(temporaryDirectory, fileName);
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  return requestPath;
};

const currentIntegrityAnchors = () => ({
  compiler: {
    path: DIRECTOR_COMPILER_RELATIVE_PATH,
    sha256: sha256File(compilerPath),
  },
  requestIsolationRegistry: {
    path: REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH,
    sha256: sha256File(registryPath),
  },
  supervisorAcceptanceRegistry: {
    path: SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
    sha256: sha256File(supervisorRegistryPath),
  },
});

try {
  process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV] = sha256File(registryPath);
  process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV] =
    sha256File(supervisorRegistryPath);
  assert.equal(registry.schemaVersion, REQUEST_ISOLATION_LIST_SCHEMA);
  assert.equal(registry.registryPolicy.relativePath, REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH);
  assert.equal(
    registry.registryPolicy.externalSha256Env,
    REQUEST_ISOLATION_REGISTRY_SHA256_ENV,
  );
  const isolatedEntry = registry.entries.find((entry) => entry.requestId === exactRequest.requestId);
  assert.ok(isolatedEntry, 'legacy isolated request was not migrated into the fixed registry');
  assert.equal(isolatedEntry.rawSha256, sha256File(exactRequestPath));
  assert.equal(isolatedEntry.canonicalSha256, sha256Text(stableStringify(exactRequest)));
  assert.equal(isolatedEntry.semanticSha256, requestSemanticSha256(exactRequest));
  assert.equal(isolatedEntry.forbiddenBundleSha256, requestAStateBundleSha256(exactRequest));
  assert.ok(
    isolatedEntry.forbiddenReceiptSha256.every((sha256) =>
      requestForbiddenReceiptSha256Values(exactRequest).includes(sha256)),
    'legacy forbidden receipt hashes are not reproducible from the rejected request',
  );

  const anchoredIsolatedRequest = structuredClone(exactRequest);
  const anchoredIsolatedRequestPath = path.join(
    temporaryDirectory,
    'anchored-isolated-request.json',
  );
  anchoredIsolatedRequest.execution.requestPath = anchoredIsolatedRequestPath;
  anchoredIsolatedRequest.execution.integrityAnchors = currentIntegrityAnchors();
  writeFileSync(
    anchoredIsolatedRequestPath,
    `${JSON.stringify(anchoredIsolatedRequest, null, 2)}\n`,
  );
  const isolatedOutputPath = path.join(temporaryDirectory, 'isolated-plan.json');
  const isolatedCompile = spawnSync(process.execPath, [
    compilerPath,
    '--request', anchoredIsolatedRequestPath,
    '--output', isolatedOutputPath,
    '--repo-root', repoRoot,
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      [REQUEST_ISOLATION_REGISTRY_SHA256_ENV]: sha256File(registryPath),
      [SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV]: sha256File(supervisorRegistryPath),
    },
  });
  assert.notEqual(isolatedCompile.status, 0, 'isolated request unexpectedly compiled');
  assert.match(isolatedCompile.stderr, /DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW/);
  assert.equal(existsSync(isolatedOutputPath), false, 'isolated request unexpectedly wrote a plan');

  const isolatedOverrideCompile = spawnSync(process.execPath, [
    compilerPath,
    '--request', anchoredIsolatedRequestPath,
    '--output', path.join(temporaryDirectory, 'isolated-override-plan.json'),
    '--repo-root', repoRoot,
    '--request-isolation-list', path.join(temporaryDirectory, 'attacker-controlled-list.json'),
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      [REQUEST_ISOLATION_REGISTRY_SHA256_ENV]: sha256File(registryPath),
      [SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV]: sha256File(supervisorRegistryPath),
    },
  });
  assert.notEqual(isolatedOverrideCompile.status, 0);
  assert.match(isolatedOverrideCompile.stderr, /DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW/);

  const byteCopyPath = path.join(temporaryDirectory, 'byte-copy-request.json');
  writeFileSync(byteCopyPath, exactRequestRaw);
  expectCode('DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW', () =>
    enforceRequestIsolation(exactRequest, {repoRoot, requestPath: byteCopyPath}));
  const rawOnlyRequest = {
    requestId: 'raw-only-different-request',
    execution: {mode: 'renderable', requestPath: byteCopyPath},
    authority: {receipts: []},
    semanticFixture: 'different-from-rejected-request',
  };
  expectCode('DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW', () =>
    enforceRequestIsolation(rawOnlyRequest, {repoRoot, requestPath: byteCopyPath}));
  expectCode('DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW', () =>
    enforceRequestIsolation(exactRequest, {repoRoot}));

  const requestIdOnlyMatch = {
    requestId: exactRequest.requestId,
    execution: {
      mode: 'renderable',
      requestPath: path.join(temporaryDirectory, 'request-id-only.json'),
    },
    authority: {receipts: []},
    semanticFixture: 'request-id-only',
  };
  const requestIdOnlyPath = writeRequest('request-id-only.json', requestIdOnlyMatch);
  assert.notEqual(requestSemanticSha256(requestIdOnlyMatch), isolatedEntry.semanticSha256);
  expectCode('DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW', () =>
    enforceRequestIsolation(requestIdOnlyMatch, {repoRoot, requestPath: requestIdOnlyPath}));

  const semanticOnlyMatch = {
    ...exactRequest,
    requestId: 'semantic-only-copy-with-new-request-id',
    execution: {...exactRequest.execution, requestPath: path.join(temporaryDirectory, 'semantic-only.json')},
    authority: {...exactRequest.authority, receipts: []},
  };
  const semanticOnlyPath = writeRequest('semantic-only.json', semanticOnlyMatch);
  assert.equal(requestSemanticSha256(semanticOnlyMatch), isolatedEntry.semanticSha256);
  expectCode('DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW', () =>
    enforceRequestIsolation(semanticOnlyMatch, {repoRoot, requestPath: semanticOnlyPath}));

  const unknownManagementNonceMatch = {
    ...exactRequest,
    requestId: 'unknown-management-nonce-copy',
    execution: {...exactRequest.execution, requestPath: path.join(temporaryDirectory, 'nonce.json')},
    compilerIgnoredNonce: 'this-must-not-change-semantic-identity',
    notes: {attempt: 2, owner: 'management-only'},
  };
  const unknownManagementNoncePath = writeRequest('nonce.json', unknownManagementNonceMatch);
  assert.equal(
    requestSemanticSha256(unknownManagementNonceMatch),
    isolatedEntry.semanticSha256,
    'unknown management fields unexpectedly changed semantic identity',
  );
  expectCode('DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW', () =>
    enforceRequestIsolation(unknownManagementNonceMatch, {
      repoRoot,
      requestPath: unknownManagementNoncePath,
    }));

  const forbiddenBundleOnlyMatch = structuredClone(exactRequest);
  forbiddenBundleOnlyMatch.requestId = 'forbidden-old-bundle-with-changed-request-id';
  forbiddenBundleOnlyMatch.execution.requestPath = path.join(
    temporaryDirectory,
    'forbidden-old-bundle.json',
  );
  forbiddenBundleOnlyMatch.semanticBeats[0].cognitiveIncrement += '。隔离整包回归测试修改';
  for (const receipt of forbiddenBundleOnlyMatch.authority.receipts) {
    if (['scene-a-dynamic-states-receipt', 'scene-a-progressive-states-manifest',
      'scene-a-progressive-states-generation-receipt'].includes(receipt.id)) {
      receipt.sha256 = sha256Text(`rewrapped-receipt:${receipt.id}`);
    }
  }
  const forbiddenBundlePath = writeRequest('forbidden-old-bundle.json', forbiddenBundleOnlyMatch);
  assert.notEqual(requestSemanticSha256(forbiddenBundleOnlyMatch), isolatedEntry.semanticSha256);
  assert.equal(
    requestAStateBundleSha256(forbiddenBundleOnlyMatch),
    isolatedEntry.forbiddenBundleSha256,
  );
  assert.equal(
    isolatedEntry.forbiddenReceiptSha256.some((sha256) =>
      requestForbiddenReceiptSha256Values(forbiddenBundleOnlyMatch).includes(sha256)),
    false,
  );
  expectCode('DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW', () =>
    enforceRequestIsolation(forbiddenBundleOnlyMatch, {repoRoot, requestPath: forbiddenBundlePath}));

  const oneStateChangedBundle = structuredClone(forbiddenBundleOnlyMatch);
  oneStateChangedBundle.requestId = 'one-state-changed-new-bundle';
  oneStateChangedBundle.execution.requestPath = path.join(
    temporaryDirectory,
    'one-state-changed-new-bundle.json',
  );
  oneStateChangedBundle.media.visualStateAssets.find(
    (asset) => asset.id === 'a-progressive-a08',
  ).sha256 = sha256Text('canonical-new-state-A08');
  const oneStateChangedBundlePath = writeRequest(
    'one-state-changed-new-bundle.json',
    oneStateChangedBundle,
  );
  assert.notEqual(
    requestAStateBundleSha256(oneStateChangedBundle),
    isolatedEntry.forbiddenBundleSha256,
  );
  assert.equal(
    enforceRequestIsolation(oneStateChangedBundle, {
      repoRoot,
      requestPath: oneStateChangedBundlePath,
    }).isolated,
    false,
  );

  const canonicalFrames = [
    0, 12, 24, 60, 96, 126, 165, 204, 243, 285, 318, 351, 376, 414, 432, 450, 463,
  ];
  const canonicalNewBundle = structuredClone(forbiddenBundleOnlyMatch);
  canonicalNewBundle.requestId = 'canonical-a00-a16-new-sha-bundle';
  canonicalNewBundle.execution.requestPath = path.join(
    temporaryDirectory,
    'canonical-a00-a16-new-sha-bundle.json',
  );
  canonicalNewBundle.execution.integrityAnchors = currentIntegrityAnchors();
  const canonicalAStates = canonicalNewBundle.semanticBeats[0].visualization.stateReveal.states;
  const canonicalAReceipt = canonicalNewBundle.authority.receipts.find(
    (receipt) => receipt.id === 'scene-a-dynamic-states-receipt',
  );
  for (let index = 0; index < 17; index += 1) {
    const stateId = `A${String(index).padStart(2, '0')}`;
    const visualStateAssetId = `a-progressive-a${String(index).padStart(2, '0')}`;
    const oldAssetId = canonicalAStates[index].assetId;
    const asset = canonicalNewBundle.media.visualStateAssets.find((item) => item.id === oldAssetId);
    asset.id = visualStateAssetId;
    asset.sha256 = sha256Text(`canonical-new-state:${stateId}`);
    canonicalAStates[index].assetId = visualStateAssetId;
    canonicalAStates[index].atSeconds = canonicalFrames[index] / 30;
    canonicalAReceipt.bindings[index] = {
      sceneId: 'complex-search-workbench',
      receiptStateId: stateId,
      visualStateAssetId,
    };
  }
  const canonicalNewBundlePath = writeRequest(
    'canonical-a00-a16-new-sha-bundle.json',
    canonicalNewBundle,
  );
  assert.notEqual(
    requestAStateBundleSha256(canonicalNewBundle),
    isolatedEntry.forbiddenBundleSha256,
  );
  assert.equal(
    enforceRequestIsolation(canonicalNewBundle, {
      repoRoot,
      requestPath: canonicalNewBundlePath,
    }).isolated,
    false,
  );
  const canonicalNewBundleCompile = spawnSync(process.execPath, [
    compilerPath,
    '--request', canonicalNewBundlePath,
    '--output', path.join(temporaryDirectory, 'canonical-new-bundle-plan.json'),
    '--repo-root', repoRoot,
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      [REQUEST_ISOLATION_REGISTRY_SHA256_ENV]: sha256File(registryPath),
      [SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV]: sha256File(supervisorRegistryPath),
    },
  });
  assert.notEqual(canonicalNewBundleCompile.status, 0);
  assert.doesNotMatch(
    canonicalNewBundleCompile.stderr,
    /DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW/,
    'canonical A00..A16 bundle with new asset hashes was falsely isolated by CLI',
  );

  const safeRequestPath = path.join(temporaryDirectory, 'safe-request.json');
  const safeRequest = {
    requestId: 'request-isolation-safe-fixture',
    execution: {
      mode: 'renderable',
      requestPath: safeRequestPath,
      integrityAnchors: currentIntegrityAnchors(),
    },
    authority: {receipts: []},
    semanticFixture: 'independent-new-request-content',
  };
  writeFileSync(safeRequestPath, `${JSON.stringify(safeRequest, null, 2)}\n`);
  writeFileSync(
    path.join(temporaryDirectory, REQUEST_ISOLATION_LIST_FILE_NAME),
    '{"schemaVersion":"attacker-controlled-unrelated-registry"}\n',
  );
  const safeResult = enforceRequestIsolation(safeRequest, {repoRoot, requestPath: safeRequestPath});
  assert.equal(safeResult.checked, true);
  assert.equal(safeResult.listPath, registryPath);
  assert.equal(safeResult.listSha256, sha256File(registryPath));
  assert.equal(safeResult.listExpectedSha256, sha256File(registryPath));
  assert.equal(safeResult.listActualSha256, sha256File(registryPath));

  delete process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV];
  expectCode('DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA_REQUIRED', () =>
    enforceRequestIsolation(safeRequest, {repoRoot, requestPath: safeRequestPath}));
  process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV] = '0'.repeat(64);
  expectCode('DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA_MISMATCH', () =>
    enforceRequestIsolation(safeRequest, {repoRoot, requestPath: safeRequestPath}));
  process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV] = sha256File(registryPath);

  expectCode('DIRECTOR_REQUEST_ISOLATION_REGISTRY_OVERRIDE_FORBIDDEN', () =>
    compileDirectorPlan(safeRequest, {
      repoRoot,
      requestPath: safeRequestPath,
      requestIsolationListPath: path.join(temporaryDirectory, REQUEST_ISOLATION_LIST_FILE_NAME),
    }));

  const mismatchedDeclaredPathRequest = {
    ...safeRequest,
    execution: {...safeRequest.execution, requestPath: path.join(temporaryDirectory, 'different-request.json')},
  };
  expectCode('DIRECTOR_REQUEST_ACTUAL_PATH_MISMATCH', () =>
    compileDirectorPlan(mismatchedDeclaredPathRequest, {repoRoot, requestPath: safeRequestPath}));

  expectCode('DIRECTOR_REQUEST_ACTUAL_FILE_MISSING', () =>
    enforceRequestIsolation(safeRequest, {
      repoRoot,
      requestPath: path.join(temporaryDirectory, 'missing-request.json'),
    }));

  expectCode('DIRECTOR_REQUEST_ACTUAL_PATH_REQUIRED', () =>
    enforceRequestIsolation({...safeRequest, execution: {mode: 'renderable'}}, {repoRoot}));

  const planOnlyNoPath = enforceRequestIsolation(
    {...safeRequest, execution: {mode: 'plan-only'}},
    {repoRoot},
  );
  assert.equal(planOnlyNoPath.checked, false);
  assert.equal(planOnlyNoPath.reason, 'request-path-unavailable');

  process.stdout.write(`${JSON.stringify({
    ok: true,
    isolatedExitCode: isolatedCompile.status,
    isolatedErrorCode: 'DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW',
    fixedRegistryPassed: true,
    rawCanonicalRequestIdSemanticBundleAndReceiptMatchPassed: true,
    canonicalA00ToA16NewShaBundleAllowedByFunctionAndCli: true,
    partialBundleDoesNotTriggerLegacyIsolation: true,
    externalRegistryIntegrityAnchorPassed: true,
    copiedDirectoryAndChangedRequestIdRejected: true,
    unrelatedSiblingRegistryIgnored: true,
    cliOverrideRejectedWithoutBypassingLegacyIsolation: true,
    actualRequestPathGatePassed: true,
  })}\n`);
} finally {
  if (originalRegistryAnchor === undefined) {
    delete process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV];
  } else {
    process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV] = originalRegistryAnchor;
  }
  if (originalSupervisorRegistryAnchor === undefined) {
    delete process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV];
  } else {
    process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV] =
      originalSupervisorRegistryAnchor;
  }
  rmSync(temporaryDirectory, {recursive: true, force: true});
}
