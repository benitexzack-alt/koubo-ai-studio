#!/usr/bin/env node

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv2020 from '../assets/schema-validator-engine.mjs';
import {
  DIRECTOR_COMPILER_RELATIVE_PATH,
  REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH,
  REQUEST_ISOLATION_REGISTRY_SHA256_ENV,
  SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
  SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
  compileDirectorPlan,
  revalidateExecutionIntegrityAnchors,
  sha256File,
  validateExecutionIntegrityAnchors,
} from '../scripts/compile-director-plan.mjs';

const testPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(testPath), '../../..');
const compilerPath = path.join(repoRoot, DIRECTOR_COMPILER_RELATIVE_PATH);
const requestIsolationRegistryPath = path.join(
  repoRoot,
  REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH,
);
const supervisorAcceptanceRegistryPath = path.join(
  repoRoot,
  SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
);
const requestIsolationRegistrySha256 = sha256File(requestIsolationRegistryPath);
const supervisorAcceptanceRegistrySha256 = sha256File(supervisorAcceptanceRegistryPath);
const originalRequestIsolationEnvironment =
  process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV];
const originalSupervisorAcceptanceEnvironment =
  process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV];

function expectCode(code, callback) {
  assert.throws(callback, (error) => error?.code === code, code);
}

function currentIntegrityAnchors() {
  return {
    compiler: {
      path: DIRECTOR_COMPILER_RELATIVE_PATH,
      sha256: sha256File(compilerPath),
    },
    requestIsolationRegistry: {
      path: REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH,
      sha256: requestIsolationRegistrySha256,
    },
    supervisorAcceptanceRegistry: {
      path: SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
      sha256: supervisorAcceptanceRegistrySha256,
    },
  };
}

function fixtureRequest() {
  return {
    projectRoot: repoRoot,
    requestId: 'integrity-anchor-negative-fixture',
    execution: {
      mode: 'plan-only',
      integrityAnchors: currentIntegrityAnchors(),
    },
  };
}

try {
  process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV] = requestIsolationRegistrySha256;
  process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV] =
    supervisorAcceptanceRegistrySha256;

  const request = fixtureRequest();
  const verified = validateExecutionIntegrityAnchors(request, {repoRoot});
  assert.deepEqual(verified, currentIntegrityAnchors());

  const compilerShaDrift = structuredClone(request);
  compilerShaDrift.execution.integrityAnchors.compiler.sha256 = '0'.repeat(64);
  expectCode('DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_COMPILER_SHA_MISMATCH', () =>
    compileDirectorPlan(compilerShaDrift, {repoRoot}));

  const compilerPathDrift = structuredClone(request);
  compilerPathDrift.execution.integrityAnchors.compiler.path =
    'skills/koubo-remotion-director/scripts/validate-director-output.mjs';
  expectCode('DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_COMPILER_PATH_INVALID', () =>
    compileDirectorPlan(compilerPathDrift, {repoRoot}));

  const requestRegistryPathDrift = structuredClone(request);
  requestRegistryPathDrift.execution.integrityAnchors.requestIsolationRegistry.path =
    SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH;
  expectCode(
    'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_REQUEST_ISOLATION_REGISTRY_PATH_INVALID',
    () => compileDirectorPlan(requestRegistryPathDrift, {repoRoot}),
  );

  process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV] = '0'.repeat(64);
  expectCode(
    'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_REQUEST_ISOLATION_REGISTRY_REQUEST_ENV_MISMATCH',
    () => compileDirectorPlan(request, {repoRoot}),
  );

  const requestAndEnvironmentWrong = structuredClone(request);
  requestAndEnvironmentWrong.execution.integrityAnchors.requestIsolationRegistry.sha256 =
    '0'.repeat(64);
  expectCode(
    'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_REQUEST_ISOLATION_REGISTRY_ENV_ACTUAL_MISMATCH',
    () => compileDirectorPlan(requestAndEnvironmentWrong, {repoRoot}),
  );
  process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV] = requestIsolationRegistrySha256;

  process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV] = 'f'.repeat(64);
  expectCode(
    'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_SUPERVISOR_ACCEPTANCE_REGISTRY_REQUEST_ENV_MISMATCH',
    () => compileDirectorPlan(request, {repoRoot}),
  );
  const supervisorRequestAndEnvironmentWrong = structuredClone(request);
  supervisorRequestAndEnvironmentWrong.execution.integrityAnchors
    .supervisorAcceptanceRegistry.sha256 = 'f'.repeat(64);
  expectCode(
    'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_SUPERVISOR_ACCEPTANCE_REGISTRY_ENV_ACTUAL_MISMATCH',
    () => compileDirectorPlan(supervisorRequestAndEnvironmentWrong, {repoRoot}),
  );
  process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV] =
    supervisorAcceptanceRegistrySha256;

  const extraOuterField = structuredClone(request);
  extraOuterField.execution.integrityAnchors.untrusted = {
    path: DIRECTOR_COMPILER_RELATIVE_PATH,
    sha256: sha256File(compilerPath),
  };
  expectCode('DIRECTOR_EXECUTION_INTEGRITY_ANCHORS_FIELDS_INVALID', () =>
    compileDirectorPlan(extraOuterField, {repoRoot}));

  const extraInnerField = structuredClone(request);
  extraInnerField.execution.integrityAnchors.compiler.role = 'compiler';
  expectCode('DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_COMPILER_FIELDS_INVALID', () =>
    compileDirectorPlan(extraInnerField, {repoRoot}));

  const driftedSnapshot = structuredClone(verified);
  driftedSnapshot.compiler.sha256 = 'a'.repeat(64);
  expectCode('DIRECTOR_EXECUTION_INTEGRITY_ANCHORS_DRIFT', () =>
    revalidateExecutionIntegrityAnchors(request, {
      repoRoot,
      expectedSnapshot: driftedSnapshot,
      phase: 'test-compile-lifecycle',
    }));

  const compilerSource = readFileSync(compilerPath, 'utf8');
  const publicationRevalidationStart = compilerSource.indexOf(
    'export function revalidateDirectorPlanPublicationInputs',
  );
  const requestCanonicalRevalidation = compilerSource.indexOf(
    'sha256Text(stableStringify(request)) === plan.provenance.requestCanonicalSha256',
    publicationRevalidationStart,
  );
  const anchorRevalidation = compilerSource.indexOf(
    'revalidateExecutionIntegrityAnchors(request',
    requestCanonicalRevalidation,
  );
  const bindingRevalidation = compilerSource.indexOf(
    'const fileBindings = revalidatePlanFileBindings(plan',
    anchorRevalidation,
  );
  const runtimeRevalidation = compilerSource.indexOf(
    'const runtimeBindings = validateRuntimeFileContract(request',
    bindingRevalidation,
  );
  const exactRuntimeSetRevalidation = compilerSource.indexOf(
    'stableStringify(planRuntimeBindings) === stableStringify(runtimeBindings)',
    runtimeRevalidation,
  );
  assert.ok(
    publicationRevalidationStart >= 0 &&
      requestCanonicalRevalidation > publicationRevalidationStart &&
      anchorRevalidation > requestCanonicalRevalidation &&
      bindingRevalidation > anchorRevalidation &&
      runtimeRevalidation > bindingRevalidation &&
      exactRuntimeSetRevalidation > runtimeRevalidation,
    'TRUST_ROOT_CANONICAL_BINDING_EXACT_RUNTIME_REVALIDATION_ORDER_INVALID',
  );

  const integrityCaptureStart = compilerSource.indexOf(
    'function captureExecutionIntegrityAnchorState',
  );
  const integritySnapshotRead = compilerSource.indexOf(
    'const fileSnapshot = readVerifiedFileSnapshot(absolutePath)',
    integrityCaptureStart,
  );
  const integritySnapshotSha = compilerSource.indexOf(
    'const actualSha256 = fileSnapshot.sha256',
    integritySnapshotRead,
  );
  const integritySnapshotStore = compilerSource.indexOf(
    'fileSnapshots[definition.id] = fileSnapshot',
    integritySnapshotSha,
  );
  assert.ok(
    integrityCaptureStart >= 0 && integritySnapshotRead > integrityCaptureStart &&
      integritySnapshotSha > integritySnapshotRead &&
      integritySnapshotStore > integritySnapshotSha,
    'TRUST_ROOT_REGISTRY_ENTRY_SNAPSHOT_CAPTURE_INVALID',
  );

  const requestRegistryGateStart = compilerSource.indexOf(
    'export function enforceRequestIsolation',
  );
  const requestRegistrySnapshot = compilerSource.indexOf(
    'const registrySnapshot = options.registrySnapshot ?? readVerifiedFileSnapshot(listPath)',
    requestRegistryGateStart,
  );
  const requestRegistrySnapshotSha = compilerSource.indexOf(
    'actualSha256: registrySnapshot.sha256',
    requestRegistrySnapshot,
  );
  const requestRegistrySnapshotParse = compilerSource.indexOf(
    "parseVerifiedJsonSnapshot(\n      registrySnapshot,\n      'DIRECTOR_REQUEST_ISOLATION_LIST_INVALID'",
    requestRegistrySnapshotSha,
  );
  assert.ok(
    requestRegistryGateStart >= 0 && requestRegistrySnapshot > requestRegistryGateStart &&
      requestRegistrySnapshotSha > requestRegistrySnapshot &&
      requestRegistrySnapshotParse > requestRegistrySnapshotSha,
    'TRUST_ROOT_REQUEST_REGISTRY_SNAPSHOT_REUSE_INVALID',
  );

  const supervisorRegistryGateStart = compilerSource.indexOf(
    'function validateSupervisorAIndependentAcceptanceGateCore',
  );
  const supervisorRegistrySnapshot = compilerSource.indexOf(
    'const registrySnapshot = acceptanceAnchorRegistrySnapshot ??',
    supervisorRegistryGateStart,
  );
  const supervisorRegistrySnapshotSha = compilerSource.indexOf(
    'const acceptanceAnchorRegistryActualSha256 = registrySnapshot.sha256',
    supervisorRegistrySnapshot,
  );
  const supervisorRegistrySnapshotParse = compilerSource.indexOf(
    "parseVerifiedJsonSnapshot(\n      registrySnapshot,\n      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_REGISTRY_JSON_INVALID'",
    supervisorRegistrySnapshotSha,
  );
  assert.ok(
    supervisorRegistryGateStart >= 0 &&
      supervisorRegistrySnapshot > supervisorRegistryGateStart &&
      supervisorRegistrySnapshotSha > supervisorRegistrySnapshot &&
      supervisorRegistrySnapshotParse > supervisorRegistrySnapshotSha,
    'TRUST_ROOT_SUPERVISOR_REGISTRY_SNAPSHOT_REUSE_INVALID',
  );

  const compileStart = compilerSource.indexOf('export function compileDirectorPlan');
  const entryValidation = compilerSource.indexOf(
    'captureExecutionIntegrityAnchorState(request, {repoRoot})',
    compileStart,
  );
  const isolationValidation = compilerSource.indexOf('enforceRequestIsolation(request', compileStart);
  const returnRevalidation = compilerSource.indexOf("phase: 'compile-return'", compileStart);
  const requestRegistrySnapshotUse = compilerSource.indexOf(
    'registrySnapshot: entryIntegrityState.fileSnapshots.requestIsolationRegistry',
    isolationValidation,
  );
  const supervisorRegistrySnapshotUse = compilerSource.indexOf(
    'entryIntegrityState.fileSnapshots.supervisorAcceptanceRegistry',
    requestRegistrySnapshotUse,
  );
  const planReturn = compilerSource.indexOf('return plan;', returnRevalidation);
  assert.ok(
    compileStart >= 0 && entryValidation > compileStart &&
      isolationValidation > entryValidation &&
      requestRegistrySnapshotUse > isolationValidation &&
      supervisorRegistrySnapshotUse > requestRegistrySnapshotUse &&
      returnRevalidation > supervisorRegistrySnapshotUse &&
      planReturn > returnRevalidation,
    'TRUST_ROOT_COMPILE_ENTRY_OR_RETURN_REVALIDATION_ORDER_INVALID',
  );
  const mainStart = compilerSource.indexOf('async function main()');
  const outputPublication = compilerSource.indexOf('publishDirectorPlanExclusive({', mainStart);
  const cliRevalidation = compilerSource.indexOf("'cli-pre-write'", outputPublication);
  const successWrite = compilerSource.indexOf('process.stdout.write', cliRevalidation);
  assert.ok(
    mainStart >= 0 && outputPublication > mainStart && cliRevalidation > outputPublication &&
      successWrite > cliRevalidation &&
      compilerSource.indexOf('writeFileSync(outputPath', mainStart) === -1,
    'TRUST_ROOT_CLI_PREWRITE_REVALIDATION_ORDER_INVALID',
  );

  const validatorSource = readFileSync(
    path.join(repoRoot, 'skills/koubo-remotion-director/scripts/validate-director-output.mjs'),
    'utf8',
  );
  const validatorStart = validatorSource.indexOf('export function validateDirectorOutput');
  assert.ok(
    validatorSource.indexOf('validateExecutionIntegrityAnchors(request, {repoRoot})', validatorStart) >
      validatorStart &&
      validatorSource.indexOf("phase: 'validator-return'", validatorStart) > validatorStart,
    'TRUST_ROOT_VALIDATOR_SELF_CHECK_MISSING',
  );

  const outputSchema = JSON.parse(readFileSync(
    path.join(repoRoot, 'skills/koubo-remotion-director/templates/director-output.v1.schema.json'),
    'utf8',
  ));
  const validateAnchorSchema = new Ajv2020({allErrors: true, strict: true}).compile({
    $schema: outputSchema.$schema,
    $defs: outputSchema.$defs,
    $ref: '#/$defs/executionIntegrityAnchors',
  });
  assert.equal(validateAnchorSchema(currentIntegrityAnchors()), true);
  assert.equal(validateAnchorSchema(extraOuterField.execution.integrityAnchors), false);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    trustRoot: 'request-env-fixed-file-three-way',
    canonicalBindingExactRuntimeOrder: true,
    registrySnapshotsCapturedOnceAndReusedAtBothConsumers: true,
    compileEntryAndReturnRevalidation: true,
    cliPreWriteRevalidation: true,
    validatorSelfCheck: true,
  })}\n`);
} finally {
  if (originalRequestIsolationEnvironment === undefined) {
    delete process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV];
  } else {
    process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV] =
      originalRequestIsolationEnvironment;
  }
  if (originalSupervisorAcceptanceEnvironment === undefined) {
    delete process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV];
  } else {
    process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV] =
      originalSupervisorAcceptanceEnvironment;
  }
}
