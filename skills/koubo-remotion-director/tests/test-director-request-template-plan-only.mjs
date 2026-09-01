#!/usr/bin/env node

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  DIRECTOR_RUNTIME_COMMON_FILES,
  DIRECTOR_RUNTIME_FILE_CONTRACT_ID,
  DIRECTOR_RUNTIME_RENDERABLE_FILES,
} from '../assets/remotion-paper-editorial/style.ts';
import {
  DIRECTOR_COMPILER_RELATIVE_PATH,
  REQUEST_ISOLATION_REGISTRY_SHA256_ENV,
  REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH,
  REQUEST_SCHEMA,
  SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
  SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
  compileDirectorPlan,
} from '../scripts/compile-director-plan.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(testDirectory, '..');
const templatePath = path.join(skillRoot, 'templates/director-request.v1.json');
const outputSchemaPath = path.join(skillRoot, 'templates/director-output.v1.schema.json');
const template = JSON.parse(readFileSync(templatePath, 'utf8'));
const outputSchema = JSON.parse(readFileSync(outputSchemaPath, 'utf8'));

assert.equal(template.schemaVersion, REQUEST_SCHEMA);
assert.equal(template.status, 'candidate');
assert.equal(template.productionEligible, false);
assert.equal(template.templateOnly, true);
assert.equal(template.execution.mode, 'plan-only');
assert.equal(template.execution.runtimeContractId, DIRECTOR_RUNTIME_FILE_CONTRACT_ID);

const expectedAnchorPaths = {
  compiler: DIRECTOR_COMPILER_RELATIVE_PATH,
  requestIsolationRegistry: REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH,
  supervisorAcceptanceRegistry: SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
};
assert.deepEqual(
  Object.keys(template.execution.integrityAnchors).sort(),
  Object.keys(expectedAnchorPaths).sort(),
  'template must declare exactly the three current integrity anchors',
);
for (const [id, expectedPath] of Object.entries(expectedAnchorPaths)) {
  const anchor = template.execution.integrityAnchors[id];
  assert.deepEqual(Object.keys(anchor).sort(), ['path', 'sha256']);
  assert.equal(anchor.path, expectedPath);
  assert.match(anchor.sha256, /^<CURRENT_[A-Z0-9_]+_SHA256>$/);
}

const runtimeBindings = template.execution.runtimeFiles;
const expectedRuntimeIds = DIRECTOR_RUNTIME_COMMON_FILES.map(({id}) => id);
assert.equal(runtimeBindings.length, 16);
assert.deepEqual(runtimeBindings.map(({id}) => id), expectedRuntimeIds);
assert.equal(new Set(expectedRuntimeIds).size, expectedRuntimeIds.length);

for (const definition of DIRECTOR_RUNTIME_COMMON_FILES) {
  const binding = runtimeBindings.find(({id}) => id === definition.id);
  const expectedPath = 'executionField' in definition
    ? template.execution[definition.executionField]
    : definition.path;
  assert.equal(binding.path, expectedPath, `runtime path drifted: ${definition.id}`);
  assert.match(binding.sha256, /^<CURRENT_[A-Z0-9_]+_SHA256>$/);
}

const renderOnlyRuntimeIds = new Set(
  DIRECTOR_RUNTIME_RENDERABLE_FILES.map(({id}) => id),
);
assert.equal(
  runtimeBindings.some(({id}) => renderOnlyRuntimeIds.has(id) || id.startsWith('public-')),
  false,
  'plan-only template must not bind render-only or public media runtime files',
);
for (const field of ['remotionCli', 'browserExecutable', 'ffmpegBinary', 'ffprobeBinary']) {
  assert.equal(
    Object.hasOwn(template.execution, field),
    false,
    `plan-only template must not declare render-only execution field: ${field}`,
  );
}
assert.equal(Object.hasOwn(template, 'commands'), false);
assert.equal(Object.hasOwn(template.execution, 'commands'), false);

const absolutePathPlaceholders = [
  template.projectRoot,
  template.reference.path,
  template.authority.transcriptPath,
  ...template.authority.receipts.map(({path: receiptPath}) => receiptPath),
  template.render.publicDir,
  template.media.spoken.path,
  template.media.spoken.authoritativeOriginal.path,
  ...template.media.sfx.map(({path: sfxPath}) => sfxPath),
  ...template.media.visualStateAssets.map(({path: assetPath}) => assetPath),
  template.execution.nodeBinary,
];
for (const placeholder of absolutePathPlaceholders) {
  assert.match(placeholder, /^<ABSOLUTE_[A-Z0-9_]+>$/);
}
const serializedTemplate = JSON.stringify(template);
assert.doesNotMatch(serializedTemplate, /\/Users\/|\/home\/|[A-Za-z]:\\\\Users\\\\/);
assert.doesNotMatch(serializedTemplate, /chrome-headless-shell\/(?:mac|linux|win)-/);

const planOnlyBranch = outputSchema.allOf.find(
  (branch) => branch?.if?.properties?.executionMode?.const === 'plan-only',
);
assert.ok(planOnlyBranch, 'current output contract must define a plan-only branch');
assert.equal(
  planOnlyBranch.then.properties.samplePlan.properties.outputs.type,
  'null',
  'plan-only output contract must forbid render output paths',
);
const planOnlyCommands = planOnlyBranch.then.properties.commands;
assert.equal(planOnlyCommands.minItems, 1);
assert.equal(planOnlyCommands.maxItems, 1);
assert.equal(planOnlyCommands.items, false);
assert.equal(planOnlyCommands.prefixItems.length, 1);
assert.equal(planOnlyCommands.prefixItems[0].properties.id.const, 'validate-plan');
assert.equal(
  /^(?:render-|render-still-|package-and-qa)/.test(
    planOnlyCommands.prefixItems[0].properties.id.const,
  ),
  false,
  'plan-only command contract must not claim render, still, or package authorization',
);

const argumentValue = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
};
const realRequestArgument = argumentValue('--real-request');
let realInputCompiled = false;
if (realRequestArgument) {
  const realRequestPath = path.resolve(realRequestArgument);
  const realRequest = JSON.parse(readFileSync(realRequestPath, 'utf8'));
  const repoRoot = path.resolve(argumentValue('--repo-root') ?? realRequest.projectRoot);
  assert.equal(realRequest.execution.mode, template.execution.mode);
  assert.deepEqual(
    realRequest.execution.runtimeFiles.map(({id}) => id),
    expectedRuntimeIds,
    'real plan-only request must implement the template runtime contract',
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(realRequest.execution.integrityAnchors).map(([id, value]) => [
        id,
        value.path,
      ]),
    ),
    expectedAnchorPaths,
    'real plan-only request must implement the template integrity-anchor paths',
  );
  for (const field of ['ffmpegBinary', 'ffprobeBinary']) {
    assert.equal(Object.hasOwn(realRequest.execution, field), false);
  }

  const environmentUpdates = {
    [REQUEST_ISOLATION_REGISTRY_SHA256_ENV]:
      realRequest.execution.integrityAnchors.requestIsolationRegistry.sha256,
    [SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV]:
      realRequest.execution.integrityAnchors.supervisorAcceptanceRegistry.sha256,
  };
  const previousEnvironment = Object.fromEntries(
    Object.keys(environmentUpdates).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, environmentUpdates);
  try {
    const plan = compileDirectorPlan(realRequest, {
      repoRoot,
      requestPath: realRequestPath,
      outputPath: path.join(tmpdir(), `director-template-plan-only-${process.pid}.json`),
    });
    assert.equal(plan.executionMode, 'plan-only');
    assert.deepEqual(plan.commands.map(({id}) => id), ['validate-plan']);
    assert.equal(plan.samplePlan.outputs, null);
    assert.equal(
      plan.commands.some(({id}) =>
        id.startsWith('render-') || id.startsWith('render-still-') || id === 'package-and-qa-ab'),
      false,
    );
    realInputCompiled = true;
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  templatePath,
  executionMode: template.execution.mode,
  runtimeCount: runtimeBindings.length,
  integrityAnchorIds: Object.keys(expectedAnchorPaths),
  allowedCommandIds: ['validate-plan'],
  renderOutputs: null,
  realInputCompiled,
})}\n`);
