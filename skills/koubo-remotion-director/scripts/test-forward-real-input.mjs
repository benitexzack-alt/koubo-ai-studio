#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {
  CONTROLLED_VISUAL_PRIMITIVES,
  compileDirectorPlan,
  sha256File,
  sha256Text,
  stableStringify,
} from './compile-director-plan.mjs';
import {
  validateDirectorOutput,
  validateDirectorOutputSchemaContract,
} from './validate-director-output.mjs';
import {
  assertOccludedStateRevealSlots,
  assertProgressiveLocalAssemblySchedule,
  assertStateRevealSchedule,
  authoredLocalStopMotionFrameState,
  complexRelationRenderEdges,
  DIRECTOR_AUTHORED_LOCAL_STOP_MOTION,
  expandSfxCues,
  groupEnterFrame,
  lockedSceneCompletionWindow,
  mechanicalRelationRenderEdges,
  nodeEnterFrame,
  occludedStateFrameState,
  photographicStopMotionCamera,
  sceneCompletionWindow,
  sceneCompletionMinimumLockFrames,
  sceneRelationEdges,
  sceneStageEvents,
  screenClipFrameState,
  screenClipRenderTiming,
  validateDirectorPlanStructure,
  validateDirectorRenderPlanInput,
  validateScreenClipFrameLifecycle,
} from '../assets/remotion-paper-editorial/style.ts';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), '../../..');

const OWNED_SOURCE_PATHS = [
  'skills/koubo-remotion-director/scripts/compile-director-plan.mjs',
  'skills/koubo-remotion-director/scripts/validate-director-output.mjs',
  'skills/koubo-remotion-director/scripts/package-and-qa-director-ab.mjs',
  'skills/koubo-remotion-director/assets/remotion-paper-editorial/entry.tsx',
  'skills/koubo-remotion-director/assets/remotion-paper-editorial/DirectorComposition.tsx',
  'skills/koubo-remotion-director/assets/remotion-paper-editorial/PaperPrimitives.tsx',
  'skills/koubo-remotion-director/assets/remotion-paper-editorial/style.ts',
  'skills/koubo-remotion-director/assets/schema-validator-engine.mjs',
  'skills/koubo-remotion-director/templates/director-output.v1.schema.json',
  'remotion/node_modules/remotion/dist/cjs/video/OffthreadVideo.js',
  'remotion/node_modules/remotion/dist/cjs/video/OffthreadVideoForRendering.js',
  'remotion/node_modules/remotion/dist/cjs/video/get-current-time.js',
  'remotion/node_modules/remotion/dist/cjs/Sequence.js',
  'remotion/node_modules/@remotion/cli/dist/index.js',
];

const DEFAULT_WECHAT_REQUEST =
  'work/director-paper-editorial/20260824-wechat-real-input/director-skill-recovery/dynamic-gate-01/director-request.exact30-authored-motion-ab-freeze-scope-sfx-energy-fix.json';
const DEFAULT_AI_REQUEST =
  'work/director-paper-editorial/20260824-ai-control-forward-only/director-request.integrated-forward.current-anchors-plan-only.json';

let requestFixtureSequence = 0;

function completionLockContext(plan) {
  return {
    executionMode: plan.executionMode,
    durationSeconds: plan.render.durationSeconds,
    requestPath: plan.provenance?.requestPath,
    fileBindings: plan.provenance?.fileBindings,
    visualStateAssets: plan.media?.visualStateAssets,
  };
}

function parseCli(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    assert.ok(argv[index + 1], `FORWARD_TEST_ARGUMENT_VALUE_MISSING:${token}`);
    values[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

function resolveFromRepo(repoRoot, declaredPath) {
  return path.isAbsolute(declaredPath)
    ? path.normalize(declaredPath)
    : path.resolve(repoRoot, declaredPath);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function snapshotSources(repoRoot) {
  return Object.fromEntries(
    OWNED_SOURCE_PATHS.map((relativePath) => [
      relativePath,
      sha256File(path.resolve(repoRoot, relativePath)),
    ]),
  );
}

function compileOptions(repoRoot, requestPath, request) {
  return {
    repoRoot,
    requestPath,
    outputPath: resolveFromRepo(repoRoot, request.execution.outputPlanPath),
  };
}

function compileAndValidate(repoRoot, requestPath, request) {
  const options = compileOptions(repoRoot, requestPath, request);
  const plan = compileDirectorPlan(request, options);
  const validation = validateDirectorOutput(plan, {
    request,
    repoRoot,
    requestPath,
    outputPath: options.outputPath,
  });
  assert.equal(validation.ok, true);
  return {plan, validation};
}

function compileSelfContainedPlanOnlyFixture(
  repoRoot,
  candidateRequest,
  planOnlyExecutionTemplate = candidateRequest,
) {
  const request = structuredClone(candidateRequest);
  request.execution = structuredClone(planOnlyExecutionTemplate.execution);
  assert.equal(
    request.execution?.mode,
    'plan-only',
    'FORWARD_TEST_TEMPORARY_REQUEST_MUST_BE_PLAN_ONLY',
  );
  const temporaryRoot = mkdtempSync(
    path.join(tmpdir(), 'koubo-director-forward-request-'),
  );
  try {
    requestFixtureSequence += 1;
    const requestPath = path.join(temporaryRoot, 'candidate-request.json');
    const outputPath = path.join(temporaryRoot, 'candidate-plan-never-published.json');
    request.requestId = `forward-test-plan-only-${requestFixtureSequence}`;
    request.execution.requestPath = requestPath;
    request.execution.outputPlanPath = outputPath;
    request.render.outputDirectory = path.join(
      temporaryRoot,
      'render-never-created',
    );
    writeFileSync(requestPath, `${stableStringify(request)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    return compileDirectorPlan(request, {
      repoRoot,
      requestPath,
      outputPath,
    });
  } finally {
    rmSync(temporaryRoot, {recursive: true, force: true});
  }
}

function compileSelfContainedRenderableFixture(repoRoot, candidateRequest) {
  assert.equal(
    candidateRequest.execution?.mode,
    'renderable',
    'FORWARD_TEST_TEMPORARY_REQUEST_MUST_BE_RENDERABLE',
  );
  const temporaryRoot = mkdtempSync(
    path.join(tmpdir(), 'koubo-director-forward-renderable-request-'),
  );
  try {
    requestFixtureSequence += 1;
    const request = structuredClone(candidateRequest);
    const requestPath = path.join(temporaryRoot, 'candidate-request.json');
    const outputPath = path.join(temporaryRoot, 'candidate-plan-never-published.json');
    request.requestId = `forward-test-renderable-${requestFixtureSequence}`;
    request.execution.requestPath = requestPath;
    request.execution.outputPlanPath = outputPath;
    request.render.outputDirectory = path.join(
      temporaryRoot,
      'render-never-created',
    );
    writeFileSync(requestPath, `${stableStringify(request)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    return compileDirectorPlan(request, {
      repoRoot,
      requestPath,
      outputPath,
    });
  } finally {
    rmSync(temporaryRoot, {recursive: true, force: true});
  }
}

function declaredOwnedSourcePaths(repoRoot, request) {
  const declared = new Set();
  for (const runtimeFile of request.execution?.runtimeFiles ?? []) {
    declared.add(resolveFromRepo(repoRoot, runtimeFile.path));
  }
  for (const anchor of Object.values(request.execution?.integrityAnchors ?? {})) {
    if (anchor?.path) declared.add(resolveFromRepo(repoRoot, anchor.path));
  }
  return declared;
}

function assertPlanBindsOwnedSources(repoRoot, plan, request, sourceSnapshot) {
  const bindingsByPath = new Map(
    plan.provenance.fileBindings.map((binding) => [path.normalize(binding.path), binding]),
  );
  const declaredSources = declaredOwnedSourcePaths(repoRoot, request);
  for (const [relativePath, expectedSha256] of Object.entries(sourceSnapshot)) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    const binding = bindingsByPath.get(absolutePath);
    if (!declaredSources.has(absolutePath)) {
      assert.equal(
        binding,
        undefined,
        `FORWARD_TEST_UNDECLARED_SOURCE_BOUND:${relativePath}`,
      );
      continue;
    }
    assert.ok(binding, `FORWARD_TEST_SOURCE_BINDING_MISSING:${relativePath}`);
    assert.equal(
      binding.sha256,
      expectedSha256,
      `FORWARD_TEST_SOURCE_BINDING_SHA_MISMATCH:${relativePath}`,
    );
  }
}

function expectDirectorError(operation, expectedCode) {
  let caught;
  try {
    operation();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `FORWARD_TEST_EXPECTED_ERROR_NOT_THROWN:${expectedCode}`);
  assert.equal(caught.code, expectedCode, `FORWARD_TEST_UNEXPECTED_ERROR:${caught.message}`);
  return caught.code;
}

function captureDirectorRejection(operation, label) {
  let caught;
  try {
    operation();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `FORWARD_TEST_EXPECTED_REJECTION_NOT_THROWN:${label}`);
  assert.ok(
    typeof caught.code === 'string' && caught.code.startsWith('DIRECTOR_'),
    `FORWARD_TEST_REJECTION_CODE_INVALID:${label}:${caught.message}`,
  );
  return caught.code;
}

function createOutputSchemaValidator(repoRoot) {
  const schemaPath = path.resolve(
    repoRoot,
    'skills/koubo-remotion-director/templates/director-output.v1.schema.json',
  );
  const enginePath = path.resolve(
    repoRoot,
    'skills/koubo-remotion-director/assets/schema-validator-engine.mjs',
  );
  const validateSchema = (plan) => {
    try {
      validateDirectorOutputSchemaContract(plan, {repoRoot});
      validateSchema.errors = [];
      return true;
    } catch (error) {
      validateSchema.errors = [{
        instancePath: '',
        keyword: error.code ?? 'DIRECTOR_OUTPUT_SCHEMA_CONTRACT_FAILED',
      }];
      return false;
    }
  };
  validateSchema.errors = [];
  return {enginePath, schemaPath, validateSchema};
}

function assertSharedOutputNegativeMatrix({
  plan,
  request,
  repoRoot,
  requestPath,
  validateSchema,
}) {
  assert.equal(validateSchema(plan), true, 'FORWARD_TEST_SCHEMA_REJECTED_REAL_WECHAT_PLAN');
  const outputPath = compileOptions(repoRoot, requestPath, request).outputPath;
  const cases = [
    ['cognitive-increment', (candidate) => { candidate.scenes[0].cognitiveIncrement = ''; }],
    ['spoken-line', (candidate) => { candidate.scenes[0].spokenLine = ''; }],
    ['camera', (candidate) => { candidate.scenes[0].camera = ''; }],
    ['layers', (candidate) => { candidate.scenes[0].layers = 2; }],
    ['object-group-visual-role', (candidate) => {
      candidate.scenes[0].objectGroups[0].visualRole = 'unregistered-output-role';
    }],
    ['sfx-static-file-name', (candidate) => {
      candidate.media.sfx[0].staticFileName = '';
    }],
    ['sfx-cue-id', (candidate) => { candidate.media.sfx[0].cues[0].id = ''; }],
    ['sfx-cue-at-seconds', (candidate) => {
      candidate.media.sfx[0].cues[0].atSeconds = 31;
    }],
    ['sfx-cue-volume', (candidate) => { candidate.media.sfx[0].cues[0].volume = 1.01; }],
    ['still-plan', (candidate) => { candidate.stillPlan = []; }],
    ['chain', (candidate) => { candidate.chain = {}; }],
    ['provenance', (candidate) => { candidate.provenance = {}; }],
    ['render', (candidate) => { candidate.render.width = 0; }],
    ['unknown-scene-type', (candidate) => {
      candidate.scenes[0].type = 'unregistered-scene-type';
    }],
  ];
  const results = {};
  for (const [id, mutate] of cases) {
    const candidate = structuredClone(plan);
    mutate(candidate);
    const formalValidatorCode = captureDirectorRejection(
      () =>
        validateDirectorOutput(candidate, {
          request,
          repoRoot,
          requestPath,
          outputPath,
        }),
      `formal-validator:${id}`,
    );
    const schemaAccepted = validateSchema(candidate);
    const schemaErrors = structuredClone(validateSchema.errors ?? []).map((error) => ({
      instancePath: error.instancePath,
      keyword: error.keyword,
    }));
    assert.equal(schemaAccepted, false, `FORWARD_TEST_SCHEMA_ACCEPTED_INVALID_OUTPUT:${id}`);
    assert.ok(schemaErrors.length > 0, `FORWARD_TEST_SCHEMA_ERROR_MISSING:${id}`);
    const renderHelperCode = captureDirectorRejection(
      () => validateDirectorRenderPlanInput(candidate),
      `render-helper:${id}`,
    );
    results[id] = {
      formalValidatorCode,
      schemaRejected: true,
      schemaErrors,
      renderHelperCode,
    };
  }
  return results;
}

function assertCompilerRequestNegativeMatrix(
  repoRoot,
  requestPath,
  request,
  planOnlyExecutionTemplate,
  planOnlyExecutionTemplatePath,
) {
  const cases = [
    ['cognitive-increment', (candidate) => {
      candidate.semanticBeats[0].cognitiveIncrement = '';
    }, 'DIRECTOR_REQUEST_STRING_INVALID'],
    ['spoken-line', (candidate) => {
      candidate.semanticBeats[0].spokenLine = '';
    }, 'DIRECTOR_REQUEST_STRING_INVALID'],
    ['camera', (candidate) => {
      candidate.semanticBeats[0].visualization.camera = '';
    }, 'DIRECTOR_REQUEST_STRING_INVALID'],
    ['layers', (candidate) => {
      candidate.semanticBeats[0].visualization.layers = 2;
    }, 'DIRECTOR_SCENE_LAYERS_INSUFFICIENT'],
    ['object-group-visual-role', (candidate) => {
      candidate.semanticBeats[0].visualization.objectGroups[0].visualRole =
        'unregistered-request-role';
    }, 'DIRECTOR_VISUAL_ROLE_UNKNOWN'],
    ['sfx-static-file-name', (candidate) => {
      candidate.media.sfx[0].staticFileName = '';
    }, 'DIRECTOR_RENDER_PLAN_SFX_INVALID'],
    ['sfx-cue-id', (candidate) => {
      candidate.media.sfx[0].cues[0].id = '';
    }, 'DIRECTOR_REQUEST_STRING_INVALID'],
    ['sfx-cue-at-seconds', (candidate) => {
      candidate.media.sfx[0].cues[0].atSeconds = 31;
    }, 'DIRECTOR_RENDER_PLAN_SFX_INVALID'],
    ['sfx-cue-volume', (candidate) => {
      candidate.media.sfx[0].cues[0].volume = 1.01;
    }, 'DIRECTOR_RENDER_PLAN_SFX_INVALID'],
    ['stills', (candidate) => {
      candidate.stills = [];
    }, 'DIRECTOR_STILL_PLAN_INSUFFICIENT'],
    ['render', (candidate) => {
      candidate.render.width = 0;
    }, 'DIRECTOR_RENDER_WIDTH_INVALID'],
    ['unknown-scene-kind', (candidate) => {
      candidate.semanticBeats[0].kind = 'unregistered-scene-kind';
    }, 'DIRECTOR_SCENE_KIND_UNKNOWN'],
  ];
  const results = {};
  for (const [id, mutate, expectedCode] of cases) {
    const candidate = structuredClone(planOnlyExecutionTemplate);
    if (id.startsWith('sfx-')) {
      candidate.media.sfx = structuredClone(request.media.sfx);
    }
    mutate(candidate);
    results[id] = expectDirectorError(
      () => compileSelfContainedPlanOnlyFixture(repoRoot, candidate),
      expectedCode,
    );
  }
  const renderableExecutionCases = {};
  for (const [id, mutate, expectedCode] of [
    ['missing-ffmpeg-binary', (candidate) => {
      delete candidate.execution.ffmpegBinary;
    }, 'DIRECTOR_REQUEST_STRING_INVALID'],
    ['relative-ffprobe-binary', (candidate) => {
      candidate.execution.ffprobeBinary = 'bin/ffprobe';
    }, 'DIRECTOR_EXECUTION_MEDIA_TOOL_PATH_NOT_ABSOLUTE'],
  ]) {
    const candidate = structuredClone(request);
    mutate(candidate);
    renderableExecutionCases[id] = expectDirectorError(
      () => compileSelfContainedRenderableFixture(repoRoot, candidate),
      expectedCode,
    );
  }
  const immutableCandidate = structuredClone(request);
  immutableCandidate.semanticBeats[0].cognitiveIncrement = '';
  const immutableRequestCode = expectDirectorError(
    () => compileDirectorPlan(
      immutableCandidate,
      compileOptions(repoRoot, requestPath, immutableCandidate),
    ),
    'DIRECTOR_REQUEST_ACTUAL_CONTENT_MISMATCH',
  );
  const immutablePlanOnlyCandidate = structuredClone(planOnlyExecutionTemplate);
  immutablePlanOnlyCandidate.semanticBeats[0].cognitiveIncrement = '';
  const immutablePlanOnlyRequestCode = expectDirectorError(
    () => compileDirectorPlan(
      immutablePlanOnlyCandidate,
      compileOptions(
        repoRoot,
        planOnlyExecutionTemplatePath,
        immutablePlanOnlyCandidate,
      ),
    ),
    'DIRECTOR_REQUEST_ACTUAL_CONTENT_MISMATCH',
  );
  return {
    cases: results,
    renderableExecutionCases,
    immutableRequestCode,
    immutablePlanOnlyRequestCode,
    outputOnlyFields: {
      chain: 'compiler-generated-output-only',
      provenance: 'compiler-generated-output-only',
    },
  };
}

function assertContractFixFourLayerNegativeMatrix({
  plan,
  request,
  planOnlyExecutionTemplate,
  repoRoot,
  requestPath,
  validateSchema,
}) {
  const outputPath = compileOptions(repoRoot, requestPath, request).outputPath;
  const cases = [
    ['complex-wrong-slot-primitive', (candidate) => {
      candidate.semanticBeats[0].visualization.objectGroups[0].visualPrimitive =
        'answer-tickets';
    }, (candidate) => {
      candidate.scenes[0].objectGroups[0].visualPrimitive = 'answer-tickets';
    }, 'DIRECTOR_VISUAL_PRIMITIVE_SLOT_INVALID'],
    ['complex-wrong-slot-role', (candidate) => {
      candidate.semanticBeats[0].visualization.objectGroups[0].visualRole =
        'causal-input';
    }, (candidate) => {
      candidate.scenes[0].objectGroups[0].visualRole = 'causal-input';
    }, 'DIRECTOR_VISUAL_ROLE_SLOT_INVALID'],
    ['relation-self-loop', (candidate) => {
      const relation = candidate.semanticBeats[0].visualization.relations[0];
      relation.to = relation.from;
    }, (candidate) => {
      const relation = candidate.scenes[0].relations[0];
      relation.to = relation.from;
    }, 'DIRECTOR_RELATION_SELF_LOOP_FORBIDDEN'],
    ['sfx-duplicate-cue-id', (candidate) => {
      candidate.media.sfx[1].cues[0].id = candidate.media.sfx[0].cues[0].id;
    }, (candidate) => {
      candidate.media.sfx[1].cues[0].id = candidate.media.sfx[0].cues[0].id;
    }, 'DIRECTOR_RENDER_PLAN_SFX_INVALID'],
    ['sfx-static-file-traversal', (candidate) => {
      candidate.media.sfx[0].staticFileName = '../escape.wav';
    }, (candidate) => {
      candidate.media.sfx[0].staticFileName = '../escape.wav';
    }, 'DIRECTOR_RENDER_PLAN_SFX_INVALID'],
    ['sfx-cue-at-duration', (candidate) => {
      candidate.media.sfx[0].cues[0].atSeconds = candidate.render.durationSeconds;
    }, (candidate) => {
      candidate.media.sfx[0].cues[0].atSeconds = candidate.render.durationSeconds;
    }, 'DIRECTOR_RENDER_PLAN_SFX_INVALID'],
    ['relative-public-dir', (candidate) => {
      candidate.render.publicDir = 'relative-public';
    }, (candidate) => {
      candidate.render.publicDir = 'relative-public';
    }, 'DIRECTOR_PUBLIC_DIR_NOT_ABSOLUTE'],
    ['renderable-sfx-missing', (candidate) => {
      delete candidate.media.sfx;
    }, (candidate) => {
      delete candidate.media.sfx;
    }, 'DIRECTOR_RENDER_PLAN_SFX_REQUIRED', true],
    ['renderable-sfx-empty', (candidate) => {
      candidate.media.sfx = [];
    }, (candidate) => {
      candidate.media.sfx = [];
    }, 'DIRECTOR_RENDER_PLAN_SFX_REQUIRED', true],
  ];
  const results = {};
  for (const [
    id,
    mutateRequest,
    mutatePlan,
    expectedCompilerCode,
    renderableOnly = false,
  ] of cases) {
    const invalidRequest = structuredClone(request);
    mutateRequest(invalidRequest);
    const compilerCode = expectDirectorError(
      () => renderableOnly
        ? compileSelfContainedRenderableFixture(repoRoot, invalidRequest)
        : compileSelfContainedPlanOnlyFixture(
          repoRoot,
          invalidRequest,
          planOnlyExecutionTemplate,
        ),
      expectedCompilerCode,
    );

    const invalidPlan = structuredClone(plan);
    mutatePlan(invalidPlan);
    const sharedStructureCode = captureDirectorRejection(
      () => validateDirectorPlanStructure(invalidPlan),
      `contract-fix:shared-structure:${id}`,
    );
    const schemaAccepted = validateSchema(invalidPlan);
    assert.equal(
      schemaAccepted,
      false,
      `FORWARD_TEST_CONTRACT_FIX_SCHEMA_ACCEPTED:${id}`,
    );
    const schemaErrors = structuredClone(validateSchema.errors ?? []);
    assert.ok(schemaErrors.length > 0, `FORWARD_TEST_CONTRACT_FIX_SCHEMA_ERROR_MISSING:${id}`);
    const formalValidatorCode = captureDirectorRejection(
      () =>
        validateDirectorOutput(invalidPlan, {
          request,
          repoRoot,
          requestPath,
          outputPath,
        }),
      `contract-fix:formal-validator:${id}`,
    );
    const renderHelperCode = captureDirectorRejection(
      () => validateDirectorRenderPlanInput(invalidPlan),
      `contract-fix:render-helper:${id}`,
    );
    results[id] = {
      compilerCode,
      sharedStructureCode,
      schemaRejected: true,
      formalValidatorCode,
      renderHelperCode,
    };
  }
  return results;
}

function assertRuntimeContractNegativeMatrix({
  wechatPlan,
  aiPlan,
  wechatRequest,
  aiRequest,
  repoRoot,
}) {
  const wechatRuntime = wechatPlan.provenance.fileBindings.filter(
    (binding) => binding.role === 'runtime',
  );
  const aiRuntime = aiPlan.provenance.fileBindings.filter(
    (binding) => binding.role === 'runtime',
  );
  const expectedWechatRuntimeIds = wechatRequest.execution.runtimeFiles
    .map((binding) => binding.id)
    .sort();
  const expectedAiRuntimeIds = aiRequest.execution.runtimeFiles
    .map((binding) => binding.id)
    .sort();
  const requiredAiRuntimeIds = [
    'composition',
    'entry',
    'node-binary',
    'output-schema',
    'primitives',
    'remotion-cli-index',
    'remotion-cli-package',
    'remotion-get-current-time',
    'remotion-lock',
    'remotion-offthread-video',
    'remotion-offthread-video-rendering',
    'remotion-package',
    'remotion-sequence',
    'render-style',
    'schema-validator-engine',
    'validator',
  ].sort();
  const forbiddenPlanOnlyRuntimeIds = [
    'remotion-cli',
    'chrome-headless-shell',
    'ab-packager',
    'ffmpeg-binary',
    'ffprobe-binary',
  ];
  assert.equal(
    wechatRuntime.length,
    expectedWechatRuntimeIds.length,
    'FORWARD_TEST_RENDERABLE_RUNTIME_COUNT_INVALID',
  );
  assert.equal(
    aiRuntime.length,
    expectedAiRuntimeIds.length,
    'FORWARD_TEST_PLAN_ONLY_RUNTIME_COUNT_INVALID',
  );
  assert.equal(
    new Set(wechatRuntime.map((binding) => binding.id)).size,
    expectedWechatRuntimeIds.length,
    'FORWARD_TEST_RENDERABLE_RUNTIME_IDS_NOT_UNIQUE',
  );
  assert.equal(
    new Set(aiRuntime.map((binding) => binding.id)).size,
    expectedAiRuntimeIds.length,
    'FORWARD_TEST_PLAN_ONLY_RUNTIME_IDS_NOT_UNIQUE',
  );
  assert.deepEqual(
    wechatRuntime.map((binding) => binding.id).sort(),
    expectedWechatRuntimeIds,
    'FORWARD_TEST_RENDERABLE_RUNTIME_IDS_NOT_REQUEST_DRIVEN',
  );
  assert.deepEqual(
    aiRuntime.map((binding) => binding.id).sort(),
    expectedAiRuntimeIds,
    'FORWARD_TEST_PLAN_ONLY_RUNTIME_IDS_NOT_REQUEST_DRIVEN',
  );
  assert.deepEqual(
    expectedAiRuntimeIds,
    requiredAiRuntimeIds,
    'FORWARD_TEST_PLAN_ONLY_RUNTIME_SET_DRIFT',
  );
  assert.equal(
    forbiddenPlanOnlyRuntimeIds.some((id) => expectedAiRuntimeIds.includes(id)),
    false,
    'FORWARD_TEST_PLAN_ONLY_RENDER_RUNTIME_FORBIDDEN',
  );
  assert.equal(
    aiRequest.execution.ffmpegBinary,
    undefined,
    'FORWARD_TEST_PLAN_ONLY_FFMPEG_BINARY_FORBIDDEN',
  );
  assert.equal(
    aiRequest.execution.ffprobeBinary,
    undefined,
    'FORWARD_TEST_PLAN_ONLY_FFPROBE_BINARY_FORBIDDEN',
  );
  for (const runtimeId of ['ab-packager', 'ffmpeg-binary', 'ffprobe-binary']) {
    assert.ok(
      expectedWechatRuntimeIds.includes(runtimeId),
      `FORWARD_TEST_AB_RUNTIME_BINDING_MISSING:${runtimeId}`,
    );
    assert.ok(
      wechatRuntime.some((binding) => binding.id === runtimeId),
      `FORWARD_TEST_AB_RUNTIME_PROVENANCE_MISSING:${runtimeId}`,
    );
  }
  assert.equal(
    aiRuntime.some((binding) => binding.id.startsWith('public-')),
    false,
    'FORWARD_TEST_PLAN_ONLY_PUBLIC_RUNTIME_FORBIDDEN',
  );

  const entry = aiRequest.execution.runtimeFiles.find((item) => item.id === 'entry');
  const composition = aiRequest.execution.runtimeFiles.find(
    (item) => item.id === 'composition',
  );
  assert.ok(entry && composition, 'FORWARD_TEST_RUNTIME_FIXTURE_BINDINGS_MISSING');
  const cases = [
    ['missing-required-id', (candidate) => {
      candidate.execution.runtimeFiles = candidate.execution.runtimeFiles.filter(
        (item) => item.id !== 'entry',
      );
    }, 'DIRECTOR_RUNTIME_BINDING_COUNT_INVALID'],
    ['duplicate-id', (candidate) => {
      candidate.execution.runtimeFiles.push(structuredClone(entry));
    }, 'DIRECTOR_RUNTIME_BINDING_DUPLICATE'],
    ['wrong-path', (candidate) => {
      const target = candidate.execution.runtimeFiles.find((item) => item.id === 'entry');
      target.path = composition.path;
      target.sha256 = composition.sha256;
    }, 'DIRECTOR_RUNTIME_BINDING_PATH_INVALID'],
    ['wrong-sha', (candidate) => {
      candidate.execution.runtimeFiles.find((item) => item.id === 'entry').sha256 =
        '0'.repeat(64);
    }, 'DIRECTOR_INPUT_SHA_MISMATCH'],
  ];
  const results = {};
  for (const [id, mutate, expectedCode] of cases) {
    const invalidRequest = structuredClone(aiRequest);
    mutate(invalidRequest);
    const compilerCode = expectDirectorError(
      () => compileSelfContainedPlanOnlyFixture(repoRoot, invalidRequest),
      expectedCode,
    );
    results[id] = {compilerCode};
  }
  return {
    counts: {
      renderable: wechatRuntime.length,
      renderableExpected: expectedWechatRuntimeIds.length,
      planOnly: aiRuntime.length,
      planOnlyExpected: expectedAiRuntimeIds.length,
    },
    cases: results,
  };
}

function assertPlanOnlyCommandBoundary({
  wechatPlan,
  aiPlan,
  aiRequest,
  repoRoot,
  aiRequestPath,
  validateSchema,
}) {
  const renderableCommandIds = wechatPlan.commands.map((command) => command.id);
  const planOnlyCommandIds = aiPlan.commands.map((command) => command.id);
  assert.deepEqual(
    renderableCommandIds,
    [
      'validate-plan',
      'render-visual-master',
      'package-and-qa-ab',
      ...wechatPlan.stillPlan.map((still) => `render-still-${still.id}`),
    ],
    'FORWARD_TEST_RENDERABLE_COMMAND_SET_INVALID_AT_EMIT_BOUNDARY',
  );
  assert.deepEqual(
    planOnlyCommandIds,
    ['validate-plan'],
    'FORWARD_TEST_PLAN_ONLY_COMPILER_COMMAND_SET_INVALID',
  );
  const planOnlyValidateCommand = aiPlan.commands[0];
  assert.equal(
    planOnlyValidateCommand.argv.some((argument) =>
      [
        'render',
        'still',
        '--visual-master',
        '--output-dir',
        '--ffmpeg',
        '--ffprobe',
      ].includes(argument)),
    false,
    'FORWARD_TEST_PLAN_ONLY_VALIDATE_COMMAND_CONTAINS_RENDER_ARGUMENT',
  );
  const invalidPlan = structuredClone(aiPlan);
  invalidPlan.commands = [{...invalidPlan.commands[0], id: 'render-with-sfx'}];
  const sharedStructureCode = captureDirectorRejection(
    () => validateDirectorPlanStructure(invalidPlan),
    'plan-only-bad-command:shared-structure',
  );
  assert.equal(
    validateSchema(invalidPlan),
    false,
    'FORWARD_TEST_PLAN_ONLY_BAD_COMMAND_SCHEMA_ACCEPTED',
  );
  const formalValidatorCode = captureDirectorRejection(
    () =>
      validateDirectorOutput(invalidPlan, {
        request: aiRequest,
        repoRoot,
        requestPath: aiRequestPath,
        outputPath: compileOptions(repoRoot, aiRequestPath, aiRequest).outputPath,
      }),
    'plan-only-bad-command:formal-validator',
  );
  const renderHelperCode = captureDirectorRejection(
    () => validateDirectorRenderPlanInput(invalidPlan),
    'plan-only-bad-command:render-helper',
  );
  return {
    renderableCompilerGeneratedCommandIds: renderableCommandIds,
    planOnlyCompilerGeneratedCommandIds: planOnlyCommandIds,
    badCommand: {
      sharedStructureCode,
      schemaRejected: true,
      formalValidatorCode,
      renderHelperCode,
    },
    emitPolicy: {
      renderable: 'not-invoked-forward-test-is-compile-only',
      planOnly: 'not-invoked-no-render-command-exists',
    },
  };
}

function primitiveSet(plan) {
  return [...new Set(
    plan.scenes.flatMap((scene) =>
      (scene.objectGroups ?? []).map((group) => group.visualPrimitive),
    ),
  )].sort();
}

function stageEventFrames(plan) {
  return Object.fromEntries(
    plan.scenes.flatMap((scene) =>
      sceneStageEvents(scene, plan.render.fps).map((event) => [
        `${scene.id}:${event.id}`,
        event.frame,
      ]),
    ),
  );
}

function halfOpenRangesOverlap(left, right) {
  return left.sourceIn < right.sourceOut && left.sourceOut > right.sourceIn;
}

function findScene(plan, sceneId) {
  const scene = plan.scenes.find((candidate) => candidate.id === sceneId);
  assert.ok(scene, `FORWARD_TEST_SCENE_MISSING:${sceneId}`);
  return scene;
}

function assertStateRevealAssetBindings(plan, scene) {
  const assetsById = new Map(
    (plan.media.visualStateAssets ?? []).map((asset) => [asset.id, asset]),
  );
  const reveal = assertStateRevealSchedule(scene, plan.render.fps);
  if (reveal.method === 'fully-occluded-hard-cut') {
    const occluder = assetsById.get(reveal.occluderAssetId);
    assert.equal(
      occluder?.role,
      'occluder',
      `FORWARD_TEST_STATE_REVEAL_OCCLUDER_ASSET_INVALID:${scene.id}`,
    );
  }
  for (const [index, state] of reveal.states.entries()) {
    const asset = assetsById.get(state.assetId);
    assert.ok(asset, `FORWARD_TEST_STATE_REVEAL_STATE_ASSET_MISSING:${scene.id}:${state.id}`);
    assert.equal(
      asset.role,
      index === 0 ? 'base-state' : 'revealed-state',
      `FORWARD_TEST_STATE_REVEAL_STATE_ASSET_ROLE_INVALID:${scene.id}:${state.id}`,
    );
  }
  return reveal;
}

function assertStateRevealFrameTiming(plan, scene, requestBeat) {
  const reveal = assertStateRevealAssetBindings(plan, scene);
  const requestedReveal = requestBeat?.visualization?.stateReveal;
  assert.ok(requestedReveal, `FORWARD_TEST_REQUEST_STATE_REVEAL_MISSING:${scene.id}`);
  assert.equal(
    requestedReveal.states.length,
    reveal.states.length,
    `FORWARD_TEST_STATE_REVEAL_STATE_COUNT_MISMATCH:${scene.id}`,
  );
  for (const [index, state] of reveal.states.entries()) {
    const requestedState = requestedReveal.states[index];
    assert.equal(state.id, requestedState.id);
    assert.equal(state.assetId, requestedState.assetId);
    assert.equal(state.stageId, requestedState.stageId);
    assert.equal(
      state.atFrame,
      Math.round(requestedState.atSeconds * plan.render.fps),
      `FORWARD_TEST_STATE_REVEAL_FRAME_NOT_REQUEST_DRIVEN:${scene.id}:${state.id}`,
    );
    if (reveal.method === 'progressive-local-assembly') {
      assert.equal(
        state.entityStateId,
        requestedState.entityStateId,
        `FORWARD_TEST_PROGRESSIVE_ENTITY_STATE_NOT_REQUEST_DRIVEN:${scene.id}:${state.id}`,
      );
      assert.deepEqual(
        state.changedEntityIds,
        requestedState.changedEntityIds,
        `FORWARD_TEST_PROGRESSIVE_CHANGED_ENTITIES_NOT_REQUEST_DRIVEN:${scene.id}:${state.id}`,
      );
    }
  }
  if (reveal.method === 'progressive-local-assembly') {
    assert.equal(requestedReveal.method, 'progressive-local-assembly');
    assertProgressiveLocalAssemblySchedule(scene, plan.render.fps);
    assert.ok(
      reveal.transitions.every(
        (transition) => transition.kind === 'visible-discrete-assembly',
      ),
      `FORWARD_TEST_PROGRESSIVE_TRANSITION_KIND_INVALID:${scene.id}`,
    );
  }
  if (reveal.method === 'fully-occluded-hard-cut') for (const transition of reveal.transitions) {
    const fromState = reveal.states.find((state) => state.id === transition.fromStateId);
    const toState = reveal.states.find((state) => state.id === transition.toStateId);
    assert.ok(fromState && toState, `FORWARD_TEST_STATE_REVEAL_TRANSITION_ENDPOINT_MISSING:${scene.id}`);
    assert.deepEqual(
      {
        stateId: occludedStateFrameState(
          scene,
          transition.fullyOccludedFromFrame,
          plan.render.fps,
        ).stateId,
        phase: occludedStateFrameState(
          scene,
          transition.fullyOccludedFromFrame,
          plan.render.fps,
        ).phase,
      },
      {stateId: fromState.id, phase: 'occluded'},
      `FORWARD_TEST_STATE_REVEAL_NOT_OCCLUDED_BEFORE_SWAP:${scene.id}:${transition.id}`,
    );
    assert.deepEqual(
      {
        stateId: occludedStateFrameState(
          scene,
          transition.swapFrame,
          plan.render.fps,
        ).stateId,
        phase: occludedStateFrameState(
          scene,
          transition.swapFrame,
          plan.render.fps,
        ).phase,
      },
      {stateId: toState.id, phase: 'occluded'},
      `FORWARD_TEST_STATE_REVEAL_SWAP_NOT_HIDDEN:${scene.id}:${transition.id}`,
    );
    assert.equal(
      occludedStateFrameState(
        scene,
        transition.firstRevealFrame,
        plan.render.fps,
      ).phase,
      'opening',
      `FORWARD_TEST_STATE_REVEAL_OPENING_FRAME_INVALID:${scene.id}:${transition.id}`,
    );
  }
  const expectedCompletion = lockedSceneCompletionWindow(
    scene,
    plan.render.fps,
    scene.assemblyStages.map((stage) => stage.id),
    completionLockContext(plan),
  );
  assert.deepEqual(
    scene.completion,
    expectedCompletion,
    `FORWARD_TEST_STATE_REVEAL_COMPLETION_MODEL_MISMATCH:${scene.id}`,
  );
  const renderedStateCompletion = Math.max(
    reveal.states[0].atFrame,
    ...(reveal.method === 'fully-occluded-hard-cut'
      ? reveal.transitions.map((transition) => transition.revealCompleteFrame)
      : reveal.states.map((state) => state.atFrame)),
  );
  assert.equal(
    expectedCompletion.actualCompletionFrame,
    renderedStateCompletion,
    `FORWARD_TEST_STATE_REVEAL_COMPLETION_NOT_RENDER_STRATEGY_BOUND:${scene.id}`,
  );
  assert.ok(
    expectedCompletion.availableSettledFrames >= expectedCompletion.minimumLockFrames,
    `FORWARD_TEST_STATE_REVEAL_COMPLETION_LOCK_INSUFFICIENT:${scene.id}`,
  );
  return {
    sceneId: scene.id,
    sceneType: scene.type,
    stateCount: reveal.states.length,
    transitionCount: reveal.transitions.length,
    actualCompletionFrame: expectedCompletion.actualCompletionFrame,
    availableSettledFrames: expectedCompletion.availableSettledFrames,
  };
}

function assertOccludedStateRevealContract(wechatPlan, wechatRequest, rendererSource) {
  const requestBeatsById = new Map(
    wechatRequest.semanticBeats.map((beat) => [beat.id, beat]),
  );
  const photographicScenes = wechatPlan.scenes.filter((scene) => scene.stateReveal);
  const complexPhotographicScenes = photographicScenes.filter(
    (scene) => scene.type === 'complex-explanation',
  );
  const occludedScenes = photographicScenes.filter(
    (scene) => scene.type === 'occluded-state-reveal',
  );
  assert.ok(
    complexPhotographicScenes.length >= 1,
    'FORWARD_TEST_COMPLEX_STATE_REVEAL_SCENE_MISSING',
  );
  assert.ok(
    occludedScenes.length >= 2,
    'FORWARD_TEST_OCCLUDED_STATE_REVEAL_SCENES_INSUFFICIENT',
  );
  const sceneResults = [];
  for (const scene of photographicScenes) {
    assert.equal(
      scene.mechanism,
      undefined,
      `FORWARD_TEST_STATE_REVEAL_MECHANISM_CLAIM_FORBIDDEN:${scene.id}`,
    );
    assert.equal(
      scene.assemblyStages.some((stage) => stage.action === 'mechanical-action'),
      false,
      `FORWARD_TEST_STATE_REVEAL_MECHANICAL_STAGE_FORBIDDEN:${scene.id}`,
    );
    if (scene.type === 'occluded-state-reveal') {
      assert.doesNotThrow(() => assertOccludedStateRevealSlots(scene));
    }
    sceneResults.push(
      assertStateRevealFrameTiming(
        wechatPlan,
        scene,
        requestBeatsById.get(scene.id),
      ),
    );
  }

  const stateDispatchIndex = rendererSource.indexOf('if (scene.stateReveal)');
  const complexDispatchIndex = rendererSource.indexOf(
    "else if (scene.type === 'complex-explanation')",
  );
  assert.ok(
    stateDispatchIndex >= 0 && complexDispatchIndex > stateDispatchIndex,
    'FORWARD_TEST_COMPLEX_STATE_REVEAL_RENDER_STRATEGY_NOT_EXPLICIT',
  );
  assert.ok(
    rendererSource.includes('<PhotographicStateRevealScene') &&
      rendererSource.includes('scene={scene}') &&
      rendererSource.includes('plan={resolvedPlan}') &&
      rendererSource.includes('forceNeutralLocalMotion={forceNeutralLocalMotion}'),
    'FORWARD_TEST_STATE_REVEAL_RENDERER_DISPATCH_MISSING',
  );
  const cameraFrame0 = photographicStopMotionCamera(0, wechatPlan.render.fps);
  const cameraBeforeStep = photographicStopMotionCamera(
    cameraFrame0.holdFrames - 1,
    wechatPlan.render.fps,
  );
  const cameraAtStep = photographicStopMotionCamera(
    cameraFrame0.holdFrames,
    wechatPlan.render.fps,
  );
  assert.deepEqual(
    cameraBeforeStep,
    cameraFrame0,
    'FORWARD_TEST_STOP_MOTION_CAMERA_HOLD_NOT_DISCRETE',
  );
  assert.notDeepEqual(
    cameraAtStep,
    cameraFrame0,
    'FORWARD_TEST_STOP_MOTION_CAMERA_STEP_MISSING',
  );
  assert.ok(
    cameraAtStep.scale > cameraFrame0.scale && cameraAtStep.scale <= 1.024,
    'FORWARD_TEST_STOP_MOTION_CAMERA_PUSH_OUT_OF_RANGE',
  );
  assert.ok(
    rendererSource.includes('photographicStopMotionCamera(localFrame, fps)'),
    'FORWARD_TEST_STOP_MOTION_CAMERA_RENDER_BINDING_MISSING',
  );
  return {
    photographicSceneCount: photographicScenes.length,
    complexPhotographicSceneCount: complexPhotographicScenes.length,
    occludedSceneCount: occludedScenes.length,
    scenes: sceneResults,
    mechanicalClaimAllowed: false,
    stopMotionCamera: {
      model: 'quantized-photographic-micro-push',
      holdFrames: cameraFrame0.holdFrames,
      start: cameraFrame0,
      firstStep: cameraAtStep,
    },
  };
}

function assertOccludedStateRevealNegativeMatrix({
  plan,
  request,
  planOnlyExecutionTemplate,
  repoRoot,
}) {
  const beatIndex = request.semanticBeats.findIndex(
    (beat) => beat.kind === 'occluded-state-reveal',
  );
  const sceneIndex = plan.scenes.findIndex(
    (scene) => scene.type === 'occluded-state-reveal',
  );
  assert.ok(beatIndex >= 0 && sceneIndex >= 0, 'FORWARD_TEST_OCCLUDED_FIXTURE_MISSING');
  const results = {};

  const wrongSlot = structuredClone(request);
  wrongSlot.semanticBeats[beatIndex].visualization.output.visualRole =
    'human-decision-output';
  results.wrongSlotRole = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(
      repoRoot,
      wrongSlot,
      planOnlyExecutionTemplate,
    ),
    'DIRECTOR_VISUAL_ROLE_SLOT_INVALID',
  );

  const stageTimeMismatch = structuredClone(request);
  stageTimeMismatch.semanticBeats[beatIndex].visualization.stateReveal.states[1]
    .atSeconds += 0.1;
  results.stageTimeMismatch = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(
      repoRoot,
      stageTimeMismatch,
      planOnlyExecutionTemplate,
    ),
    'DIRECTOR_STATE_REVEAL_STAGE_TIME_MISMATCH',
  );

  const mechanicalClaim = structuredClone(request);
  mechanicalClaim.semanticBeats[beatIndex].visualization.assemblyStages[0].action =
    'mechanical-action';
  results.mechanicalActionClaim = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(
      repoRoot,
      mechanicalClaim,
      planOnlyExecutionTemplate,
    ),
    'DIRECTOR_STATE_REVEAL_MECHANICAL_CLAIM_FORBIDDEN',
  );

  const mechanismPlan = structuredClone(plan);
  mechanismPlan.scenes[sceneIndex].mechanism = {
    inputNodeId: mechanismPlan.scenes[sceneIndex].nodes[0].id,
    actionNodeId: mechanismPlan.scenes[sceneIndex].nodes[1].id,
    outputNodeIds: [mechanismPlan.scenes[sceneIndex].nodes[2].id],
  };
  results.mechanismObjectClaim = expectDirectorError(
    () => validateDirectorPlanStructure(mechanismPlan),
    'DIRECTOR_RENDER_PLAN_MECHANISM_FORBIDDEN',
  );

  const transitionPlan = structuredClone(plan);
  transitionPlan.scenes[sceneIndex].stateReveal.transitions[0].swapFrame += 1;
  results.transitionFrameMismatch = expectDirectorError(
    () => validateDirectorPlanStructure(transitionPlan),
    'DIRECTOR_STATE_REVEAL_TRANSITION_INVALID',
  );

  const missingStateAssetPlan = structuredClone(plan);
  const missingStateAssetId = missingStateAssetPlan.scenes[sceneIndex]
    .stateReveal.states.at(-1).assetId;
  missingStateAssetPlan.media.visualStateAssets =
    missingStateAssetPlan.media.visualStateAssets.filter(
      (asset) => asset.id !== missingStateAssetId,
    );
  results.missingStateAsset = expectDirectorError(
    () => validateDirectorPlanStructure(missingStateAssetPlan),
    'DIRECTOR_RENDER_PLAN_STATE_ASSET_MISSING',
  );

  const stateAssetRolePlan = structuredClone(plan);
  const stateAssetId = stateAssetRolePlan.scenes[sceneIndex].stateReveal.states[0].assetId;
  stateAssetRolePlan.media.visualStateAssets.find(
    (asset) => asset.id === stateAssetId,
  ).role = 'occluder';
  results.stateAssetRole = expectDirectorError(
    () => validateDirectorPlanStructure(stateAssetRolePlan),
    'DIRECTOR_RENDER_PLAN_STATE_ASSET_MISSING',
  );
  return results;
}

export function assertProgressiveLocalAssemblyContract(rendererSource) {
  const fps = 30;
  const stateFrames = [0, 30, 60, 90, 120, 150, 180, 210, 240, 278];
  const targetIds = [
    'input-ticket',
    'route-video',
    'route-comment',
    'route-map',
    'route-friend',
    'return-ticket-video',
    'return-ticket-comment',
    'return-ticket-map',
    'return-ticket-friend',
    'cost-ticket',
  ];
  const states = stateFrames.map((atFrame, index) => ({
    id: `a-state-${index}`,
    assetId: `a-state-asset-${index}`,
    stageId: `a-stage-${index}`,
    atFrame,
    entityStateId: `a-entity-state-${index}`,
    changedEntityIds: [targetIds[index]],
    localMotion: index === 0
      ? {model: 'neutral/v1'}
      : {
          model: 'authored-local-stop-motion/v1',
          region: {x: 100 + index * 20, y: 120 + index * 10, width: 160, height: 96},
          poseAssetIds: [0, 1, 2].map((poseIndex) =>
            `a-motion-pose-${index}-${poseIndex}`),
        },
  }));
  const scene = {
    id: 'progressive-a-contract-fixture',
    type: 'complex-explanation',
    start: 0,
    end: 10.3,
    spokenLine: '四路人工搜索逐步汇总成时间成本。',
    cognitiveIncrement: '从首秒起逐步呈现真实纸艺实体状态。',
    camera: 'locked-photographic-workbench',
    layers: 4,
    objectGroups: targetIds.map((id) => ({
      id,
      label: id,
      visualPrimitive: 'tool-ticket',
      visualRole: 'source-channel',
      nodeIds: [],
    })),
    nodes: [],
    relations: [],
    screenPlacements: [],
    assemblyStages: stateFrames.map((atFrame, index) => ({
      id: `a-stage-${index}`,
      atSeconds: atFrame / fps,
      action: 'visible-discrete-assembly',
      targetIds: [targetIds[index]],
    })),
    stateReveal: {
      method: 'progressive-local-assembly',
      audit: {
        windowStartFrame: 0,
        windowEndFrame: 278,
        firstChangeFrame: 30,
        namedEntityStateCount: stateFrames.length,
        maximumUnchangedFrames: 38,
      },
      states,
      transitions: states.slice(1).map((state, index) => ({
        id: `${states[index].id}-to-${state.id}`,
        fromStateId: states[index].id,
        toStateId: state.id,
        kind: 'visible-discrete-assembly',
        swapFrame: state.atFrame,
      })),
    },
  };
  const reveal = assertProgressiveLocalAssemblySchedule(scene, fps);
  assert.equal(reveal.audit.firstChangeFrame, 30);
  assert.equal(reveal.audit.namedEntityStateCount, 10);
  assert.equal(reveal.audit.maximumUnchangedFrames, 38);
  assert.deepEqual(
    occludedStateFrameState(scene, 29, fps),
    {
      stateAssetId: 'a-state-asset-0',
      stateId: 'a-state-0',
      phase: 'clear',
      transition: null,
    },
    'FORWARD_TEST_PROGRESSIVE_STATE_BEFORE_SWAP_INVALID',
  );
  assert.deepEqual(
    occludedStateFrameState(scene, 30, fps),
    {
      stateAssetId: 'a-state-asset-1',
      stateId: 'a-state-1',
      phase: 'clear',
      transition: null,
    },
    'FORWARD_TEST_PROGRESSIVE_STATE_AT_SWAP_INVALID',
  );
  const authorityBeforePreroll = authoredLocalStopMotionFrameState(scene, 20, fps);
  const authoredPose0Frame0 = authoredLocalStopMotionFrameState(scene, 21, fps);
  const authoredPose0Frame2 = authoredLocalStopMotionFrameState(scene, 23, fps);
  const authoredPose1Frame3 = authoredLocalStopMotionFrameState(scene, 24, fps);
  const authoredPose2Frame6 = authoredLocalStopMotionFrameState(scene, 27, fps);
  const authorityAtFrame = authoredLocalStopMotionFrameState(scene, 30, fps);
  assert.equal(DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.poseHoldFrames, 3);
  assert.equal(DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.poseCount, 3);
  assert.equal(DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.durationFrames, 9);
  assert.deepEqual(authoredPose0Frame0, authoredPose0Frame2);
  assert.deepEqual(
    {
      stateId: authoredPose0Frame0.stateId,
      stateAssetId: authoredPose0Frame0.stateAssetId,
      baseStateAssetId: authoredPose0Frame0.baseStateAssetId,
      phase: authoredPose0Frame0.phase,
      poseAssetId: authoredPose0Frame0.poseAssetId,
      poseIndex: authoredPose0Frame0.poseIndex,
    },
    {
      stateId: 'a-state-1',
      stateAssetId: 'a-state-asset-1',
      baseStateAssetId: 'a-state-asset-0',
      phase: 'authored-pose',
      poseAssetId: 'a-motion-pose-1-0',
      poseIndex: 0,
    },
  );
  assert.equal(authoredPose1Frame3.poseIndex, 1);
  assert.equal(authoredPose2Frame6.poseIndex, 2);
  assert.deepEqual(
    authorityAtFrame,
    {
      stateId: 'a-state-1',
      stateAssetId: 'a-state-asset-1',
      baseStateAssetId: 'a-state-asset-1',
      phase: 'neutral',
      poseAssetId: null,
      region: null,
      poseIndex: null,
    },
  );
  assert.deepEqual(
    authoredLocalStopMotionFrameState(scene, 21, fps, true),
    authorityBeforePreroll,
    'FORWARD_TEST_PROGRESSIVE_STILL_MUST_FORCE_NEUTRAL',
  );
  assert.equal(
    authoredLocalStopMotionFrameState(scene, 269, fps).poseAssetId,
    'a-motion-pose-9-0',
    'FORWARD_TEST_PROGRESSIVE_TERMINAL_PREROLL_MISSING',
  );
  assert.equal(
    authoredLocalStopMotionFrameState(scene, 278, fps).phase,
    'neutral',
    'FORWARD_TEST_PROGRESSIVE_TERMINAL_AUTHORITY_FRAME_NOT_NEUTRAL',
  );
  const completion = sceneCompletionWindow(
    scene,
    fps,
    scene.assemblyStages.map((stage) => stage.id),
  );
  assert.equal(completion.actualCompletionFrame, 278);
  assert.equal(completion.availableSettledFrames, 31);

  const results = {};
  const missingLocalMotion = structuredClone(scene);
  delete missingLocalMotion.stateReveal.states[1].localMotion;
  results.missingLocalMotion = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(missingLocalMotion, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_LOCAL_MOTION_REQUIRED',
  );

  const firstStateArrival = structuredClone(scene);
  firstStateArrival.stateReveal.states[0].localMotion = structuredClone(
    firstStateArrival.stateReveal.states[1].localMotion,
  );
  results.firstStateArrival = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(firstStateArrival, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_NEUTRAL_MOTION_INVALID',
  );

  const invalidRegion = structuredClone(scene);
  invalidRegion.stateReveal.states[1].localMotion.region.width = 2000;
  results.invalidRegion = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(invalidRegion, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_LOCAL_REGION_INVALID',
  );

  const wrongPoseCount = structuredClone(scene);
  wrongPoseCount.stateReveal.states[1].localMotion.poseAssetIds.pop();
  results.wrongPoseCount = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(wrongPoseCount, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_MOTION_INVALID',
  );

  const duplicateMotionAsset = structuredClone(scene);
  duplicateMotionAsset.stateReveal.states[2].localMotion.poseAssetIds[0] =
    duplicateMotionAsset.stateReveal.states[1].localMotion.poseAssetIds[0];
  results.duplicateMotionAsset = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(duplicateMotionAsset, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_MOTION_INVALID',
  );

  const extraMotionField = structuredClone(scene);
  extraMotionField.stateReveal.states[1].localMotion.transition = 'forbidden';
  results.extraMotionField = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(extraMotionField, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_MOTION_INVALID',
  );

  const insufficientPreroll = structuredClone(scene);
  insufficientPreroll.stateReveal.states[1].atFrame = 9;
  insufficientPreroll.stateReveal.transitions[0].swapFrame = 9;
  insufficientPreroll.assemblyStages[1].atSeconds = 9 / fps;
  results.insufficientPreroll = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(insufficientPreroll, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUTHORED_PREROLL_INSUFFICIENT',
  );

  const firstChangeLate = structuredClone(scene);
  firstChangeLate.stateReveal.states[1].atFrame = 31;
  firstChangeLate.stateReveal.transitions[0].swapFrame = 31;
  firstChangeLate.assemblyStages[1].atSeconds = 31 / fps;
  firstChangeLate.stateReveal.audit.firstChangeFrame = 31;
  results.firstChangeLate = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(firstChangeLate, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_FIRST_CHANGE_LATE',
  );

  const unchangedGap = structuredClone(scene);
  unchangedGap.stateReveal.states[2].atFrame = 76;
  unchangedGap.stateReveal.transitions[1].swapFrame = 76;
  unchangedGap.assemblyStages[2].atSeconds = 76 / fps;
  unchangedGap.stateReveal.audit.maximumUnchangedFrames = 46;
  results.unchangedGap = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(unchangedGap, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_UNCHANGED_GAP_EXCEEDED',
  );

  const insufficientNamedStates = structuredClone(scene);
  insufficientNamedStates.stateReveal.states = [
    insufficientNamedStates.stateReveal.states[0],
    insufficientNamedStates.stateReveal.states[1],
    insufficientNamedStates.stateReveal.states[2],
    {
      ...insufficientNamedStates.stateReveal.states[3],
      atFrame: 300,
    },
  ];
  insufficientNamedStates.assemblyStages = [
    ...insufficientNamedStates.assemblyStages.slice(0, 3),
    {
      ...insufficientNamedStates.assemblyStages[3],
      atSeconds: 10,
    },
  ];
  insufficientNamedStates.stateReveal.transitions = [
    ...insufficientNamedStates.stateReveal.transitions.slice(0, 2),
    {
      ...insufficientNamedStates.stateReveal.transitions[2],
      swapFrame: 300,
    },
  ];
  results.insufficientNamedStates = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(insufficientNamedStates, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_NAMED_STATES_INSUFFICIENT',
  );

  const fullFrameOccluder = structuredClone(scene);
  fullFrameOccluder.stateReveal.occluderAssetId = 'global-shutter';
  results.fullFrameOccluder = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(fullFrameOccluder, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_FULL_FRAME_OCCLUDER_FORBIDDEN',
  );

  const wrongTransitionKind = structuredClone(scene);
  wrongTransitionKind.stateReveal.transitions[0].kind = 'fully-occluded-hard-cut';
  results.wrongTransitionKind = expectDirectorError(
    () => assertProgressiveLocalAssemblySchedule(wrongTransitionKind, fps),
    'DIRECTOR_PROGRESSIVE_ASSEMBLY_TRANSITION_INVALID',
  );

  const unknownMethod = structuredClone(scene);
  unknownMethod.stateReveal.method = 'unknown-assembly-mode';
  results.unknownMethod = expectDirectorError(
    () => assertStateRevealSchedule(unknownMethod, fps),
    'DIRECTOR_STATE_REVEAL_METHOD_INVALID',
  );

  const progressiveBranchStart = rendererSource.indexOf('if (progressiveLocalAssembly)');
  const progressiveBranchEnd = rendererSource.indexOf(
    'const camera = photographicStopMotionCamera',
    progressiveBranchStart,
  );
  assert.ok(
    progressiveBranchStart >= 0 && progressiveBranchEnd > progressiveBranchStart,
    'FORWARD_TEST_PROGRESSIVE_RENDERER_BRANCH_MISSING',
  );
  const progressiveBranch = rendererSource.slice(progressiveBranchStart, progressiveBranchEnd);
  assert.ok(
    progressiveBranch.includes('staticFile(baseStateAsset.staticFileName)') &&
      progressiveBranch.includes('staticFile(poseAsset.staticFileName)') &&
      progressiveBranch.includes('progressiveFrameState.region') &&
      progressiveBranch.includes('progressiveFrameState.poseIndex'),
    'FORWARD_TEST_PROGRESSIVE_RENDERER_AUTHORED_MOTION_POSE_MISSING',
  );
  for (const forbidden of ['photographicStopMotionCamera', 'occluderAsset', 'transition']) {
    assert.equal(
      progressiveBranch.includes(forbidden),
      false,
      `FORWARD_TEST_PROGRESSIVE_RENDERER_GLOBAL_EFFECT_FORBIDDEN:${forbidden}`,
    );
  }
  assert.equal(
    progressiveBranch.includes('interpolate(') ||
      progressiveBranch.includes('translate3d(') ||
      progressiveBranch.includes('transform:'),
    false,
    'FORWARD_TEST_PROGRESSIVE_RENDERER_RUNTIME_TRANSFORM_FORBIDDEN',
  );
  return {
    method: reveal.method,
    firstChangeFrame: reveal.audit.firstChangeFrame,
    namedEntityStateCount: reveal.audit.namedEntityStateCount,
    maximumUnchangedFrames: reveal.audit.maximumUnchangedFrames,
    authoredLocalStopMotion: {
      model: 'authored-local-stop-motion/v1',
      poseHoldFrames: DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.poseHoldFrames,
      poseCount: DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.poseCount,
      durationFrames: DIRECTOR_AUTHORED_LOCAL_STOP_MOTION.durationFrames,
    },
    completion,
    negatives: results,
  };
}

function assertRelationsBoundAndDifferent(wechatPlan, aiPlan) {
  for (const plan of [wechatPlan, aiPlan]) {
    for (const scene of plan.scenes) {
      const endpointIds = new Set([
        ...scene.objectGroups.map((group) => group.id),
        ...scene.nodes.map((node) => node.id),
      ]);
      assert.ok(scene.relations.length > 0, `FORWARD_TEST_RELATIONS_EMPTY:${scene.id}`);
      for (const relation of scene.relations) {
        assert.ok(
          endpointIds.has(relation.from),
          `FORWARD_TEST_RELATION_FROM_UNKNOWN:${scene.id}:${relation.from}`,
        );
        assert.ok(
          endpointIds.has(relation.to),
          `FORWARD_TEST_RELATION_TO_UNKNOWN:${scene.id}:${relation.to}`,
        );
      }
      const renderedEdges = scene.stateReveal
        ? sceneRelationEdges(scene)
        : scene.type === 'complex-explanation'
          ? complexRelationRenderEdges(scene, plan.render.fps)
          : mechanicalRelationRenderEdges(scene, plan.render.fps);
      assert.deepEqual(
        renderedEdges.map(({from, to}) => ({from, to})),
        scene.relations.map(({from, to}) => ({from, to})),
        `FORWARD_TEST_RENDER_RELATIONS_NOT_PLAN_DRIVEN:${scene.id}`,
      );
    }
  }
  assert.notDeepEqual(
    wechatPlan.scenes.map((scene) => scene.relations),
    aiPlan.scenes.map((scene) => scene.relations),
    'FORWARD_TEST_RELATIONS_DID_NOT_CHANGE_WITH_INPUT',
  );
}

function assertScreenClipContract(wechatPlan, wechatRequest, rendererSource) {
  const requestScreen = wechatRequest.media.screen;
  if (!requestScreen) {
    assert.deepEqual(
      wechatPlan.media.screenClips,
      [],
      'FORWARD_TEST_UNDECLARED_SCREEN_CLIPS_EMITTED',
    );
    assert.deepEqual(
      wechatPlan.media.screenExcludedRanges,
      [],
      'FORWARD_TEST_UNDECLARED_SCREEN_EXCLUSIONS_EMITTED',
    );
    assert.equal(
      wechatPlan.scenes.every(
        (scene) => Array.isArray(scene.screenPlacements) && scene.screenPlacements.length === 0,
      ),
      true,
      'FORWARD_TEST_UNDECLARED_SCREEN_PLACEMENTS_EMITTED',
    );
    assert.equal(
      wechatPlan.provenance.fileBindings.some(
        (binding) => binding.id === 'public-screen' || binding.role === 'screen-proxy',
      ),
      false,
      'FORWARD_TEST_UNDECLARED_SCREEN_RUNTIME_BINDING_EMITTED',
    );
    const photographicStart = rendererSource.indexOf(
      'const PhotographicStateRevealScene',
    );
    const photographicEnd = rendererSource.indexOf(
      'const CaptionTrack',
      photographicStart,
    );
    assert.ok(
      photographicStart >= 0 && photographicEnd > photographicStart,
      'FORWARD_TEST_PHOTOGRAPHIC_STATE_RENDERER_MISSING',
    );
    const photographicSource = rendererSource.slice(
      photographicStart,
      photographicEnd,
    );
    for (const forbiddenFragment of [
      'screenPlacements',
      'screenClips',
      'OffthreadVideo',
    ]) {
      assert.equal(
        photographicSource.includes(forbiddenFragment),
        false,
        `FORWARD_TEST_UNDECLARED_SCREEN_CONSUMPTION_CLAIMED:${forbiddenFragment}`,
      );
    }
    return {
      mode: 'not-declared-by-request',
      requestClipCount: 0,
      runtimeClipCount: 0,
      runtimeScreenBindingCount: 0,
      consumptionClaimed: false,
    };
  }
  assert.deepEqual(
    wechatPlan.media.screenExcludedRanges,
    requestScreen.excludedRanges,
    'FORWARD_TEST_SCREEN_EXCLUDED_RANGES_NOT_PRESERVED',
  );
  const clipsById = new Map(wechatPlan.media.screenClips.map((clip) => [clip.id, clip]));
  const requestClipsById = new Map(requestScreen.clips.map((clip) => [clip.id, clip]));
  assert.equal(clipsById.size, requestClipsById.size, 'FORWARD_TEST_SCREEN_CLIP_COUNT_MISMATCH');

  for (const [clipId, requestClip] of requestClipsById) {
    const clip = clipsById.get(clipId);
    assert.ok(clip, `FORWARD_TEST_SCREEN_CLIP_MISSING:${clipId}`);
    assert.deepEqual(
      screenClipRenderTiming(clip, wechatPlan.render.fps),
      {
        trimBeforeFrame: clip.trimBeforeFrame,
        trimAfterFrame: clip.trimAfterFrame,
        outputInFrame: clip.outputInFrame,
        outputOutFrame: clip.outputOutFrame,
        playbackRate: clip.playbackRate,
      },
      `FORWARD_TEST_SCREEN_RENDER_TIMING_HELPER_MISMATCH:${clipId}`,
    );
    for (const excludedRange of wechatPlan.media.screenExcludedRanges) {
      assert.equal(
        halfOpenRangesOverlap(clip, excludedRange),
        false,
        `FORWARD_TEST_SCREEN_CLIP_EXCLUDED_OVERLAP:${clipId}`,
      );
    }
    assert.equal(clip.trimBeforeFrame, Math.round(requestClip.sourceIn * wechatPlan.render.fps));
    assert.equal(clip.trimAfterFrame, Math.round(requestClip.sourceOut * wechatPlan.render.fps));
    assert.equal(clip.outputInFrame, Math.round(requestClip.outputIn * wechatPlan.render.fps));
    assert.equal(clip.outputOutFrame, Math.round(requestClip.outputOut * wechatPlan.render.fps));
    const expectedPlaybackRate =
      (clip.trimAfterFrame - clip.trimBeforeFrame) /
      (clip.outputOutFrame - clip.outputInFrame);
    assert.ok(
      Math.abs(clip.playbackRate - expectedPlaybackRate) <= 1e-12,
      `FORWARD_TEST_SCREEN_PLAYBACK_RATE_MISMATCH:${clipId}`,
    );
    assert.ok(clip.placementId, `FORWARD_TEST_SCREEN_PLACEMENT_ID_MISSING:${clipId}`);
    const ownerScene = wechatPlan.scenes.find((scene) =>
      scene.screenPlacements?.some((placement) => placement.id === clip.placementId),
    );
    assert.ok(ownerScene, `FORWARD_TEST_SCREEN_PLACEMENT_PARENT_MISSING:${clipId}`);
    const placement = ownerScene.screenPlacements.find(
      (candidate) => candidate.id === clip.placementId,
    );
    assert.ok(
      placement.clipIds.includes(clip.id),
      `FORWARD_TEST_SCREEN_PLACEMENT_CLIP_NOT_BOUND:${clipId}`,
    );
    assert.ok(
      placement.visibleFrom <= clip.outputIn && placement.visibleTo >= clip.outputOut,
      `FORWARD_TEST_SCREEN_PLACEMENT_COVERAGE_INCOMPLETE:${clipId}`,
    );
    assert.ok(
      ownerScene.objectGroups.some((group) => group.id === placement.parentGroupId),
      `FORWARD_TEST_SCREEN_PLACEMENT_GROUP_UNKNOWN:${clipId}`,
    );
  }

  const expectedFrameContracts = {
    storeEntryJump: {
      trimBeforeFrame: 3894,
      trimAfterFrame: 3930,
      outputInFrame: 562,
      outputOutFrame: 636,
      playbackRate: 36 / 74,
    },
    storeMenu: {
      trimBeforeFrame: 4260,
      trimAfterFrame: 4395,
      outputInFrame: 636,
      outputOutFrame: 780,
      playbackRate: 135 / 144,
    },
  };
  for (const [clipId, expected] of Object.entries(expectedFrameContracts)) {
    const clip = clipsById.get(clipId);
    assert.ok(clip, `FORWARD_TEST_REQUIRED_SCREEN_CLIP_MISSING:${clipId}`);
    for (const key of ['trimBeforeFrame', 'trimAfterFrame', 'outputInFrame', 'outputOutFrame']) {
      assert.equal(clip[key], expected[key], `FORWARD_TEST_SCREEN_FRAME_MISMATCH:${clipId}:${key}`);
    }
    assert.ok(
      Math.abs(clip.playbackRate - expected.playbackRate) <= 1e-12,
      `FORWARD_TEST_SCREEN_RATE_MISMATCH:${clipId}`,
    );
    const lastOutputFrameOffset = clip.outputOutFrame - clip.outputInFrame - 1;
    const lastReadSourceFrame = clip.trimBeforeFrame + lastOutputFrameOffset * clip.playbackRate;
    assert.ok(
      lastReadSourceFrame < clip.trimAfterFrame,
      `FORWARD_TEST_SCREEN_LAST_FRAME_READS_PAST_SOURCE_OUT:${clipId}`,
    );
  }

  for (const fragment of [
    'trimBefore={clip.trimBeforeFrame}',
    'playbackRate={clip.playbackRate}',
    'durationInFrames={clip.outputOutFrame - clip.outputInFrame}',
    'scene.screenPlacements',
    'screenPlacement.visibleFrom',
    'screenPlacement.visibleTo',
    'screenPlacement.clipIds',
    'premountFor={17}',
    'enterFrame={-17}',
  ]) {
    assert.ok(
      rendererSource.includes(fragment),
      `FORWARD_TEST_RENDERER_SCREEN_RANGE_BINDING_MISSING:${fragment}`,
    );
  }
  return {
    mode: 'declared-and-frame-bound',
    requestClipCount: requestScreen.clips.length,
    runtimeClipCount: wechatPlan.media.screenClips.length,
    runtimeScreenBindingCount: wechatPlan.provenance.fileBindings.filter(
      (binding) => binding.id === 'public-screen' || binding.role === 'screen-proxy',
    ).length,
    consumptionClaimed: true,
  };
}

function assertScreenClipFrameLifecycle(wechatPlan, rendererSource) {
  const clips = wechatPlan.media.screenClips;
  const excludedRanges = wechatPlan.media.screenExcludedRanges;
  const fps = wechatPlan.render.fps;
  if (clips.length === 0) {
    assert.deepEqual(excludedRanges, [], 'FORWARD_TEST_EMPTY_SCREEN_EXCLUSIONS_REQUIRED');
    assert.equal(
      wechatPlan.scenes.every((scene) => scene.screenPlacements.length === 0),
      true,
      'FORWARD_TEST_EMPTY_SCREEN_PLACEMENTS_REQUIRED',
    );
    return {
      mode: 'zero-clips-verified',
      checkedFrames: 0,
      clipCount: 0,
    };
  }

  for (const clip of clips) {
    const lifecycle = validateScreenClipFrameLifecycle(clip, excludedRanges, fps);
    assert.equal(
      lifecycle.durationInFrames,
      clip.outputOutFrame - clip.outputInFrame,
      `FORWARD_TEST_SCREEN_LIFECYCLE_DURATION_MISMATCH:${clip.id}`,
    );
    assert.equal(
      lifecycle.playbackRate,
      clip.playbackRate,
      `FORWARD_TEST_SCREEN_LIFECYCLE_RATE_MISMATCH:${clip.id}`,
    );
    for (
      let outputFrame = clip.outputInFrame;
      outputFrame < clip.outputOutFrame;
      outputFrame += 1
    ) {
      const state = screenClipFrameState(clip, outputFrame, excludedRanges, fps);
      assert.equal(state.visible, true, `FORWARD_TEST_SCREEN_FRAME_NOT_VISIBLE:${clip.id}:${outputFrame}`);
      assert.equal(state.excluded, false, `FORWARD_TEST_SCREEN_FRAME_EXCLUDED:${clip.id}:${outputFrame}`);
      assert.ok(
        state.sourceFrame >= clip.trimBeforeFrame && state.sourceFrame < clip.trimAfterFrame,
        `FORWARD_TEST_SCREEN_FRAME_SOURCE_OUT_OF_RANGE:${clip.id}:${outputFrame}`,
      );
    }
    const terminal = screenClipFrameState(
      clip,
      clip.outputOutFrame,
      excludedRanges,
      fps,
    );
    assert.equal(terminal.visible, false, `FORWARD_TEST_SCREEN_TERMINAL_VISIBLE:${clip.id}`);
    assert.ok(
      Math.abs(terminal.sourceFrame - clip.trimAfterFrame) <= 1e-9,
      `FORWARD_TEST_SCREEN_TERMINAL_NOT_SOURCE_OUT:${clip.id}`,
    );
  }

  const storeMenu = clips.find((clip) => clip.id === 'storeMenu');
  assert.ok(storeMenu, 'FORWARD_TEST_STORE_MENU_CLIP_REQUIRED');
  const frame774 = screenClipFrameState(storeMenu, 774, excludedRanges, fps);
  assert.deepEqual(
    {
      visible: frame774.visible,
      outputOffset: frame774.outputOffset,
      sourceFrame: frame774.sourceFrame,
      excluded: frame774.excluded,
    },
    {
      visible: true,
      outputOffset: 138,
      sourceFrame: 4389.375,
      excluded: false,
    },
    'FORWARD_TEST_STORE_MENU_FRAME_774_INVALID',
  );

  const offthreadVideoTags = rendererSource.match(/<OffthreadVideo[\s\S]*?\/>/gu) ?? [];
  assert.equal(offthreadVideoTags.length, 2, 'FORWARD_TEST_SCREEN_OFFTHREAD_VIDEO_COUNT_INVALID');
  for (const [index, tag] of offthreadVideoTags.entries()) {
    assert.ok(tag.includes('trimBefore={clip.trimBeforeFrame}'), `FORWARD_TEST_SCREEN_TRIM_BEFORE_MISSING:${index}`);
    assert.ok(tag.includes('playbackRate={clip.playbackRate}'), `FORWARD_TEST_SCREEN_PLAYBACK_RATE_MISSING:${index}`);
    assert.equal(/\btrimAfter\s*=/u.test(tag), false, `FORWARD_TEST_OFFTHREAD_VIDEO_TRIM_AFTER_UNSUPPORTED:${index}`);
    assert.equal(/\bendAt\s*=/u.test(tag), false, `FORWARD_TEST_OFFTHREAD_VIDEO_END_AT_UNSUPPORTED:${index}`);
  }
  assert.ok(
    rendererSource.includes(
      '<Sequence from={fromFrame} durationInFrames={clip.outputOutFrame - clip.outputInFrame}',
    ),
    'FORWARD_TEST_SCREEN_SEQUENCE_DURATION_NOT_BOUND',
  );
  return {
    mode: 'frame-lifecycle-verified',
    checkedFrames: clips.reduce(
      (total, clip) => total + clip.outputOutFrame - clip.outputInFrame,
      0,
    ),
    clipCount: clips.length,
  };
}

function assertStillCompletion(plan, request) {
  assert.equal(plan.stillPlan.length, request.stills.length, 'FORWARD_TEST_STILL_COUNT_MISMATCH');
  for (const still of plan.stillPlan) {
    const requestedStill = request.stills.find((candidate) => candidate.id === still.id);
    assert.ok(requestedStill, `FORWARD_TEST_STILL_REQUEST_MISSING:${still.id}`);
    const scene = findScene(plan, still.sceneId);
    const sceneStartFrame = Math.round(scene.start * plan.render.fps);
    const sceneEndFrame = Math.round(scene.end * plan.render.fps);
    assert.ok(
      still.frame >= sceneStartFrame && still.frame < sceneEndFrame,
      `FORWARD_TEST_STILL_OUTSIDE_DECLARED_SCENE:${still.id}`,
    );
    assert.deepEqual(still.requiredStageIds, requestedStill.requiredStageIds);
    assert.equal(still.minimumSettledFrames, requestedStill.minimumSettledFrames);
    const requiredMinimumSettledFrames = sceneCompletionMinimumLockFrames(
      scene,
      plan.render.fps,
      still.requiredStageIds,
      completionLockContext(plan),
    );
    assert.ok(
      Number.isInteger(still.minimumSettledFrames) &&
        still.minimumSettledFrames >= requiredMinimumSettledFrames,
      `FORWARD_TEST_STILL_SETTLED_FRAMES_INSUFFICIENT:${still.id}`,
    );
    const expectedCompletion = lockedSceneCompletionWindow(
      scene,
      plan.render.fps,
      still.requiredStageIds,
      completionLockContext(plan),
    );
    assert.deepEqual(
      still.completion,
      expectedCompletion,
      `FORWARD_TEST_STILL_COMPLETION_MODEL_MISMATCH:${still.id}`,
    );
    assert.ok(
      still.frame >= expectedCompletion.actualCompletionFrame &&
        still.frame < expectedCompletion.lockEndExclusiveFrame &&
        expectedCompletion.availableSettledFrames >= still.minimumSettledFrames,
      `FORWARD_TEST_STILL_NOT_SETTLED:${still.id}`,
    );
  }
}

function assertCompletionWindowNegativeCases(repoRoot, request, plan) {
  const fps = plan.render.fps;
  const complexSceneIndex = plan.scenes.findIndex(
    (scene) => scene.type === 'complex-explanation',
  );
  assert.ok(complexSceneIndex >= 0, 'FORWARD_TEST_COMPLEX_SCENE_REQUIRED');

  const pinIncompletePlan = structuredClone(plan);
  const pinScene = pinIncompletePlan.scenes[complexSceneIndex];
  const firstGroup = pinScene.objectGroups[0];
  const thirdGroup = pinScene.objectGroups[2];
  assert.ok(firstGroup && thirdGroup, 'FORWARD_TEST_PIN_SCENE_GROUPS_MISSING');
  pinScene.relations = [{from: firstGroup.id, to: thirdGroup.id}];
  pinScene.completion = lockedSceneCompletionWindow(
    pinScene,
    fps,
    pinScene.assemblyStages.map((stage) => stage.id),
    completionLockContext(pinIncompletePlan),
  );
  const pinStill = pinIncompletePlan.stillPlan.find(
    (still) => still.sceneId === pinScene.id,
  );
  assert.ok(pinStill, 'FORWARD_TEST_PIN_STILL_MISSING');
  pinStill.requiredStageIds = pinScene.assemblyStages.slice(0, 2).map((stage) => stage.id);
  pinStill.minimumSettledFrames = fps;
  pinStill.completion = lockedSceneCompletionWindow(
    pinScene,
    fps,
    pinStill.requiredStageIds,
    completionLockContext(pinIncompletePlan),
  );
  assert.ok(
    pinStill.completion.criticalContributorIds.some((id) => id.startsWith('pin:')),
    'FORWARD_TEST_PIN_NOT_CRITICAL_CONTRIBUTOR',
  );
  pinStill.frame = pinStill.completion.actualCompletionFrame - 1;
  const pinIncompleteCode = expectDirectorError(
    () => validateDirectorPlanStructure(pinIncompletePlan),
    'DIRECTOR_RENDER_PLAN_STILL_NOT_SETTLED',
  );

  const twineIncompletePlan = structuredClone(plan);
  const twineScene = twineIncompletePlan.scenes[complexSceneIndex];
  const twineFirstGroup = twineScene.objectGroups[0];
  const twineLastGroup = twineScene.objectGroups.at(-1);
  assert.ok(twineFirstGroup && twineLastGroup, 'FORWARD_TEST_TWINE_SCENE_GROUPS_MISSING');
  twineScene.relations = [{from: twineLastGroup.id, to: twineFirstGroup.id}];
  twineScene.completion = lockedSceneCompletionWindow(
    twineScene,
    fps,
    twineScene.assemblyStages.map((stage) => stage.id),
    completionLockContext(twineIncompletePlan),
  );
  const twineStill = twineIncompletePlan.stillPlan.find(
    (still) => still.sceneId === twineScene.id,
  );
  assert.ok(twineStill, 'FORWARD_TEST_TWINE_STILL_MISSING');
  twineStill.requiredStageIds = twineScene.assemblyStages.map((stage) => stage.id);
  twineStill.minimumSettledFrames = fps;
  twineStill.completion = lockedSceneCompletionWindow(
    twineScene,
    fps,
    twineStill.requiredStageIds,
    completionLockContext(twineIncompletePlan),
  );
  assert.ok(
    twineStill.completion.criticalContributorIds.some((id) => id.startsWith('relation:')),
    'FORWARD_TEST_TWINE_NOT_CRITICAL_CONTRIBUTOR',
  );
  twineStill.frame = twineStill.completion.actualCompletionFrame - 1;
  const twineIncompleteCode = expectDirectorError(
    () => validateDirectorPlanStructure(twineIncompletePlan),
    'DIRECTOR_RENDER_PLAN_STILL_NOT_SETTLED',
  );

  const twentyNineSettledFramesRequest = structuredClone(request);
  const ordinaryStill = twentyNineSettledFramesRequest.stills.find((still) => {
    const scene = plan.scenes.find((candidate) => candidate.id === still.sceneId);
    return scene && sceneCompletionMinimumLockFrames(
      scene,
      fps,
      still.requiredStageIds,
      completionLockContext(plan),
    ) === fps;
  });
  assert.ok(ordinaryStill, 'FORWARD_TEST_ORDINARY_THIRTY_FRAME_STILL_REQUIRED');
  ordinaryStill.minimumSettledFrames = fps - 1;
  const twentyNineSettledFramesCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(
      repoRoot,
      twentyNineSettledFramesRequest,
    ),
    'DIRECTOR_STILL_SETTLED_FRAMES_INSUFFICIENT',
  );

  return {
    pinIncomplete: pinIncompleteCode,
    twineIncomplete: twineIncompleteCode,
    twentyNineSettledFrames: twentyNineSettledFramesCode,
  };
}

function assertMechanicalRelationsDriveRenderGeometry(plan) {
  const scene = plan.scenes.find((candidate) => candidate.type === 'mechanical-causality');
  assert.ok(scene?.mechanism, 'FORWARD_TEST_MECHANICAL_SCENE_REQUIRED');
  const originalEdges = mechanicalRelationRenderEdges(scene, plan.render.fps);
  assert.ok(originalEdges.length >= 2, 'FORWARD_TEST_MECHANICAL_RELATIONS_INSUFFICIENT');

  const changedScene = structuredClone(scene);
  changedScene.relations[0] = {
    from: changedScene.mechanism.inputNodeId,
    to: changedScene.mechanism.outputNodeIds[0],
  };
  const changedEdges = mechanicalRelationRenderEdges(changedScene, plan.render.fps);
  assert.notDeepEqual(
    changedEdges.map(({from, to}) => ({from, to})),
    originalEdges.map(({from, to}) => ({from, to})),
    'FORWARD_TEST_MECHANICAL_RELATION_EDGE_DID_NOT_CHANGE',
  );
  assert.notDeepEqual(
    {
      x1: changedEdges[0].x1,
      y1: changedEdges[0].y1,
      x2: changedEdges[0].x2,
      y2: changedEdges[0].y2,
    },
    {
      x1: originalEdges[0].x1,
      y1: originalEdges[0].y1,
      x2: originalEdges[0].x2,
      y2: originalEdges[0].y2,
    },
    'FORWARD_TEST_MECHANICAL_RELATION_COORDINATES_DID_NOT_CHANGE',
  );
  return {
    original: originalEdges[0],
    changed: changedEdges[0],
  };
}

function assertRenderInputFailures(plan) {
  assert.doesNotThrow(() => validateDirectorRenderPlanInput(plan));
  assert.doesNotThrow(() => validateDirectorRenderPlanInput({plan}));
  const cases = [
    ['missing-plan-wrapper', () => {}, 'DIRECTOR_RENDER_PLAN_REQUIRED', {plan: null}],
    ['empty-scenes', (candidate) => { candidate.scenes = []; }, 'DIRECTOR_RENDER_PLAN_SCENES_REQUIRED'],
    ['malformed-scene', (candidate) => { candidate.scenes = [{}]; }, 'DIRECTOR_RENDER_PLAN_SCENES_REQUIRED'],
    ['missing-media', (candidate) => { delete candidate.media; }, 'DIRECTOR_SCENE_COMPLETION_LOCK_INSUFFICIENT'],
    ['missing-spoken', (candidate) => { delete candidate.media.spoken; }, 'DIRECTOR_RENDER_PLAN_MEDIA_SPOKEN_REQUIRED'],
    ['malformed-spoken', (candidate) => { candidate.media.spoken = {staticFileName: ''}; }, 'DIRECTOR_RENDER_PLAN_MEDIA_SPOKEN_REQUIRED'],
    ['missing-captions', (candidate) => { delete candidate.captions; }, 'DIRECTOR_RENDER_PLAN_CAPTIONS_REQUIRED'],
    ['malformed-caption', (candidate) => { candidate.captions = [{}]; }, 'DIRECTOR_RENDER_PLAN_CAPTIONS_REQUIRED'],
    ['missing-render', (candidate) => { delete candidate.render; }, 'DIRECTOR_RENDER_PLAN_RENDER_REQUIRED'],
    ['malformed-render', (candidate) => { candidate.render.width = 0; }, 'DIRECTOR_RENDER_PLAN_RENDER_REQUIRED'],
    ['missing-chain', (candidate) => { delete candidate.chain; }, 'DIRECTOR_RENDER_PLAN_CHAIN_REQUIRED'],
    ['malformed-chain', (candidate) => { candidate.chain = {}; }, 'DIRECTOR_RENDER_PLAN_CHAIN_REQUIRED'],
    ['missing-provenance', (candidate) => { delete candidate.provenance; }, 'DIRECTOR_SCENE_COMPLETION_LOCK_INSUFFICIENT'],
    ['malformed-provenance', (candidate) => { candidate.provenance = {}; }, 'DIRECTOR_SCENE_COMPLETION_LOCK_INSUFFICIENT'],
    ['legacy-two-render-topology', (candidate) => {
      candidate.commands = candidate.commands.map((command) => {
        if (command.id === 'render-visual-master') return {...command, id: 'render-with-sfx'};
        if (command.id === 'package-and-qa-ab') return {...command, id: 'render-no-sfx'};
        return command;
      });
    }, 'DIRECTOR_RENDER_PLAN_SINGLE_VISUAL_MASTER_TOPOLOGY_INVALID'],
  ];
  const result = {};
  for (const [id, mutate, expectedCode, seed] of cases) {
    const candidate = structuredClone(seed ?? plan);
    mutate(candidate);
    result[id] = expectDirectorError(
      () => validateDirectorRenderPlanInput(candidate),
      expectedCode,
    );
  }
  return result;
}

function assertExecutionModes(wechatPlan, aiPlan, wechatRequest, aiRequest) {
  assert.doesNotThrow(() => validateDirectorPlanStructure(wechatPlan));
  assert.doesNotThrow(() => validateDirectorPlanStructure(aiPlan));
  assert.doesNotThrow(() => validateDirectorRenderPlanInput(wechatPlan));
  assert.equal(wechatRequest.execution.mode, 'renderable');
  assert.equal(wechatPlan.executionMode, 'renderable');
  assert.equal(
    wechatPlan.commands.length,
    3 + wechatPlan.stillPlan.length,
    'FORWARD_TEST_RENDERABLE_COMMAND_COUNT_INVALID',
  );
  assert.deepEqual(
    wechatPlan.commands.map((command) => command.id),
    [
      'validate-plan',
      'render-visual-master',
      'package-and-qa-ab',
      ...wechatPlan.stillPlan.map((still) => `render-still-${still.id}`),
    ],
    'FORWARD_TEST_RENDERABLE_COMMAND_SET_INVALID',
  );
  const visualMasterCommand = wechatPlan.commands.find(
    (command) => command.id === 'render-visual-master',
  );
  const packageCommand = wechatPlan.commands.find(
    (command) => command.id === 'package-and-qa-ab',
  );
  assert.ok(
    visualMasterCommand?.argv.includes('--muted'),
    'FORWARD_TEST_VISUAL_MASTER_NOT_MUTED',
  );
  assert.equal(
    visualMasterCommand.argv.includes(wechatPlan.samplePlan.outputs.withSfx),
    false,
    'FORWARD_TEST_VISUAL_MASTER_WRITES_DELIVERY_OUTPUT',
  );
  assert.ok(
    visualMasterCommand.argv.includes(wechatPlan.samplePlan.outputs.visualMaster),
    'FORWARD_TEST_VISUAL_MASTER_OUTPUT_NOT_BOUND',
  );
  const abDeliveryDirectory = path.dirname(wechatPlan.samplePlan.outputs.withSfx);
  assert.equal(
    path.dirname(wechatPlan.samplePlan.outputs.noSfx),
    abDeliveryDirectory,
    'FORWARD_TEST_AB_DELIVERY_DIRECTORIES_DIVERGE',
  );
  assert.equal(
    path.dirname(wechatPlan.samplePlan.outputs.abQaReceipt),
    abDeliveryDirectory,
    'FORWARD_TEST_AB_RECEIPT_OUTSIDE_DELIVERY_DIRECTORY',
  );
  assert.notEqual(
    path.dirname(wechatPlan.samplePlan.outputs.visualMaster),
    abDeliveryDirectory,
    'FORWARD_TEST_AB_DELIVERY_DIRECTORY_PREEXISTS_AFTER_MASTER_RENDER',
  );
  assert.equal(
    path.basename(wechatPlan.samplePlan.outputs.withSfx),
    'director-30s-with-sfx.mp4',
    'FORWARD_TEST_WITH_SFX_DELIVERY_NAME_MISMATCH',
  );
  assert.equal(
    path.basename(wechatPlan.samplePlan.outputs.noSfx),
    'director-30s-no-sfx.mp4',
    'FORWARD_TEST_NO_SFX_DELIVERY_NAME_MISMATCH',
  );
  for (const flag of [
    '--plan',
    '--visual-master',
    '--output-dir',
    '--ffmpeg',
    '--ffprobe',
    '--receipt',
  ]) {
    assert.ok(
      packageCommand?.argv.includes(flag),
      `FORWARD_TEST_AB_PACKAGER_ARGUMENT_MISSING:${flag}`,
    );
  }
  assert.equal(
    packageCommand.argv[packageCommand.argv.indexOf('--output-dir') + 1],
    abDeliveryDirectory,
    'FORWARD_TEST_AB_PACKAGER_OUTPUT_DIRECTORY_NOT_ISOLATED',
  );
  assert.equal(
    packageCommand.argv[packageCommand.argv.indexOf('--ffmpeg') + 1],
    wechatRequest.execution.ffmpegBinary,
    'FORWARD_TEST_AB_PACKAGER_FFMPEG_NOT_REQUEST_BOUND',
  );
  assert.equal(
    packageCommand.argv[packageCommand.argv.indexOf('--ffprobe') + 1],
    wechatRequest.execution.ffprobeBinary,
    'FORWARD_TEST_AB_PACKAGER_FFPROBE_NOT_REQUEST_BOUND',
  );

  assert.equal(aiRequest.execution.mode, 'plan-only');
  assert.equal(aiPlan.executionMode, 'plan-only');
  assert.equal(
    aiPlan.commands.some((command) => command.id.startsWith('render-')),
    false,
    'FORWARD_TEST_PLAN_ONLY_RENDER_COMMAND_FORBIDDEN',
  );
  assert.equal(
    aiPlan.commands.every((command) => command.id === 'validate-plan'),
    true,
    'FORWARD_TEST_PLAN_ONLY_NONVALIDATION_COMMAND_FORBIDDEN',
  );
  assert.ok(
    aiPlan.commands.length <= 1,
    'FORWARD_TEST_PLAN_ONLY_COMMAND_COUNT_INVALID',
  );
  assert.equal(
    aiPlan.samplePlan.outputs,
    null,
    'FORWARD_TEST_PLAN_ONLY_RENDER_OUTPUTS_FORBIDDEN',
  );
  return expectDirectorError(
    () => validateDirectorRenderPlanInput(aiPlan),
    'DIRECTOR_RENDER_PLAN_MODE_FORBIDDEN',
  );
}

function assertMechanicalSlots(plan) {
  const mechanicalScenes = plan.scenes.filter(
    (scene) => scene.type === 'mechanical-causality',
  );
  assert.ok(mechanicalScenes.length > 0, 'FORWARD_TEST_MECHANICAL_SCENE_MISSING');
  for (const scene of mechanicalScenes) {
    const groupsByRole = new Map(scene.objectGroups.map((group) => [group.visualRole, group]));
    assert.ok(groupsByRole.has('causal-input'), `FORWARD_TEST_MECHANICAL_INPUT_SLOT_MISSING:${scene.id}`);
    assert.ok(groupsByRole.has('single-causal-action'), `FORWARD_TEST_MECHANICAL_ACTION_SLOT_MISSING:${scene.id}`);
    assert.equal(
      scene.objectGroups.filter((group) =>
        ['evidence-output', 'human-decision-output'].includes(group.visualRole),
      ).length,
      1,
      `FORWARD_TEST_MECHANICAL_OUTPUT_SLOT_INVALID:${scene.id}`,
    );
    assert.equal(
      scene.objectGroups.filter((group) => group.visualRole === 'causal-support').length,
      1,
      `FORWARD_TEST_SUPPORT_GROUP_COUNT_INVALID:${scene.id}`,
    );
  }
}

function assertRendererUsesPlan(rendererSource, entrySource, wechatPlan, aiPlan) {
  const requiredRendererFragments = [
    'nodeEnterFrame(scene, node, fps)',
    'groupEnterFrame(scene, group, fps)',
    '<PrimitiveContent primitive={group.visualPrimitive}',
    "actionGroup.visualPrimitive === 'control-lever'",
    "outputGroup.visualPrimitive === 'decision-stamp'",
    'DIRECTOR_RUNTIME_VISUAL_PRIMITIVE_UNKNOWN',
    'expandSfxCues(plan.media?.sfx ?? [], fps)',
    'staticFile(cue.staticFileName)',
    'volume={cue.volume}',
  ];
  for (const fragment of requiredRendererFragments) {
    assert.ok(
      rendererSource.includes(fragment),
      `FORWARD_TEST_RENDERER_CONTRACT_MISSING:${fragment}`,
    );
  }
  const rendererDispatchedPrimitives = new Set(
    [wechatPlan, aiPlan].flatMap((plan) =>
      plan.scenes
        .filter((scene) => !scene.stateReveal)
        .flatMap((scene) =>
          (scene.objectGroups ?? []).map((group) => group.visualPrimitive),
        ),
    ),
  );
  for (const primitive of rendererDispatchedPrimitives) {
    assert.ok(
      CONTROLLED_VISUAL_PRIMITIVES.has(primitive),
      `FORWARD_TEST_PLAN_PRIMITIVE_NOT_CONTROLLED:${primitive}`,
    );
    assert.ok(
      rendererSource.includes(`'${primitive}'`),
      `FORWARD_TEST_RENDERER_PRIMITIVE_MISSING:${primitive}`,
    );
  }

  assert.ok(
    entrySource.includes(
      '<DirectorComposition plan={validateDirectorRenderPlanInput(input)} withSfx />',
    ),
    'FORWARD_TEST_WITH_SFX_VISUAL_COMPONENT_NOT_SHARED',
  );
  assert.ok(
    entrySource.includes('validateDirectorRenderPlanInput(input)') &&
      entrySource.includes('withSfx={false}'),
    'FORWARD_TEST_NO_SFX_VISUAL_COMPONENT_NOT_SHARED',
  );
  assert.ok(
    entrySource.includes('const Still: React.FC<DirectorInput>') &&
      entrySource.includes('forceNeutralLocalMotion') &&
      entrySource.includes('component={Still}'),
    'FORWARD_TEST_STILL_LOCAL_MOTION_NOT_FORCED_NEUTRAL',
  );
  const supportPrimitiveStart = rendererSource.indexOf('const SupportPrimitive');
  const supportPrimitiveEnd = rendererSource.indexOf(
    'const MechanicalCausalityScene',
    supportPrimitiveStart,
  );
  assert.ok(
    supportPrimitiveStart >= 0 && supportPrimitiveEnd > supportPrimitiveStart,
    'FORWARD_TEST_SUPPORT_PRIMITIVE_COMPONENT_MISSING',
  );
  const supportPrimitiveSource = rendererSource.slice(
    supportPrimitiveStart,
    supportPrimitiveEnd,
  );
  assert.ok(
    supportPrimitiveSource.includes("if (primitive === 'path-base')") &&
      supportPrimitiveSource.includes("if (primitive === 'responsibility-base')") &&
      supportPrimitiveSource.includes("transform: 'skewX(-18deg)'") &&
      supportPrimitiveSource.includes('border: `7px double ${colors.red}`') &&
      rendererSource.includes(
        '<SupportPrimitive primitive={supportGroup.visualPrimitive}',
      ),
    'FORWARD_TEST_SUPPORT_PRIMITIVE_DISPATCH_MISSING',
  );
  assert.ok(
    supportPrimitiveSource.includes(
      'throw new Error(`DIRECTOR_RUNTIME_VISUAL_PRIMITIVE_UNKNOWN:${primitive}`)',
    ),
    'FORWARD_TEST_SUPPORT_UNKNOWN_PRIMITIVE_NOT_REJECTED',
  );

  assert.ok(
    entrySource.includes('validateDirectorRenderPlanInput'),
    'FORWARD_TEST_ENTRY_MISSING_PLAN_REJECTION',
  );
  assert.equal(
    entrySource.includes('DEFAULT_PLAN'),
    false,
    'FORWARD_TEST_ENTRY_DEFAULT_PLAN_FALLBACK_FORBIDDEN',
  );
  assert.equal(
    entrySource.includes('defaultProps='),
    false,
    'FORWARD_TEST_ENTRY_DEFAULT_PROPS_FORBIDDEN',
  );
  assert.equal(
    (entrySource.match(/calculateMetadata=\{metadata\}/g) ?? []).length,
    3,
    'FORWARD_TEST_ENTRY_ALL_COMPOSITIONS_MUST_VALIDATE_PLAN',
  );
  for (const compositionId of [
    'PaperEditorialDirector-Sample-WithSfx',
    'PaperEditorialDirector-Sample-NoSfx',
    'PaperEditorialDirector-Still',
  ]) {
    assert.ok(
      entrySource.includes(`id="${compositionId}"`),
      `FORWARD_TEST_ENTRY_COMPOSITION_MISSING:${compositionId}`,
    );
  }
}

function main() {
  const args = parseCli(process.argv.slice(2));
  const repoRoot = path.resolve(args['repo-root'] ?? defaultRepoRoot);
  const wechatRequestPath = resolveFromRepo(
    repoRoot,
    args['wechat-request'] ?? DEFAULT_WECHAT_REQUEST,
  );
  const aiRequestPath = resolveFromRepo(
    repoRoot,
    args['ai-request'] ?? DEFAULT_AI_REQUEST,
  );
  const missingDefaultFixtures = [wechatRequestPath, aiRequestPath].filter(
    (requestPath) => !existsSync(requestPath),
  );
  if (
    missingDefaultFixtures.length > 0 &&
    args['wechat-request'] == null &&
    args['ai-request'] == null
  ) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        skipped: true,
        reason: 'external-real-input-fixtures-missing',
        missing: missingDefaultFixtures,
        instruction:
          'Pass --wechat-request and --ai-request to run the historical external forward regression.',
      })}\n`,
    );
    return;
  }
  const beforeSources = snapshotSources(repoRoot);
  const wechatRequest = readJson(wechatRequestPath);
  const aiRequest = readJson(aiRequestPath);

  const {plan: wechatPlan, validation: wechatValidation} = compileAndValidate(
    repoRoot,
    wechatRequestPath,
    wechatRequest,
  );
  const {plan: aiPlan, validation: aiValidation} = compileAndValidate(
    repoRoot,
    aiRequestPath,
    aiRequest,
  );
  assertPlanBindsOwnedSources(repoRoot, wechatPlan, wechatRequest, beforeSources);
  assertPlanBindsOwnedSources(repoRoot, aiPlan, aiRequest, beforeSources);
  const {enginePath, schemaPath, validateSchema} = createOutputSchemaValidator(repoRoot);
  const compilerRequestNegativeMatrix = assertCompilerRequestNegativeMatrix(
    repoRoot,
    wechatRequestPath,
    wechatRequest,
    aiRequest,
    aiRequestPath,
  );
  const sharedOutputNegativeMatrix = assertSharedOutputNegativeMatrix({
    plan: wechatPlan,
    request: wechatRequest,
    repoRoot,
    requestPath: wechatRequestPath,
    validateSchema,
  });
  const contractFixFourLayerNegativeMatrix =
    assertContractFixFourLayerNegativeMatrix({
      plan: wechatPlan,
      request: wechatRequest,
      planOnlyExecutionTemplate: aiRequest,
      repoRoot,
      requestPath: wechatRequestPath,
      validateSchema,
    });
  const runtimeContractNegativeMatrix = assertRuntimeContractNegativeMatrix({
    wechatPlan,
    aiPlan,
    wechatRequest,
    aiRequest,
    repoRoot,
  });
  const planOnlyCommandBoundary = assertPlanOnlyCommandBoundary({
    wechatPlan,
    aiPlan,
    aiRequest,
    repoRoot,
    aiRequestPath,
    validateSchema,
  });

  assert.notEqual(
    wechatPlan.chain.requestCanonicalSha256,
    aiPlan.chain.requestCanonicalSha256,
    'FORWARD_TEST_REQUEST_HASHES_IDENTICAL',
  );
  assert.notEqual(
    wechatPlan.chain.planPayloadSha256,
    aiPlan.chain.planPayloadSha256,
    'FORWARD_TEST_PLAN_HASHES_IDENTICAL',
  );

  const wechatPrimitives = primitiveSet(wechatPlan);
  const aiPrimitives = primitiveSet(aiPlan);
  assert.notDeepEqual(
    wechatPrimitives,
    aiPrimitives,
    'FORWARD_TEST_PRIMITIVE_SELECTION_DID_NOT_CHANGE',
  );
  for (const primitive of [
    'timeline-strip',
    'tool-ticket',
    'cut-paper-track',
    'lever-track',
    'control-rig',
    'responsibility-base',
    'control-lever',
    'decision-stamp',
  ]) {
    assert.ok(aiPrimitives.includes(primitive), `FORWARD_TEST_AI_PRIMITIVE_MISSING:${primitive}`);
  }
  for (const primitive of [
    'answer-tickets',
    'paper-shutter',
    'screen-proof-strip',
  ]) {
    assert.ok(
      wechatPrimitives.includes(primitive),
      `FORWARD_TEST_WECHAT_PRIMITIVE_MISSING:${primitive}`,
    );
  }

  const planOnlyRenderCode = assertExecutionModes(
    wechatPlan,
    aiPlan,
    wechatRequest,
    aiRequest,
  );
  assertMechanicalSlots(aiPlan);
  assertStillCompletion(wechatPlan, wechatRequest);
  assertStillCompletion(aiPlan, aiRequest);
  const completionNegativeCodes = assertCompletionWindowNegativeCases(
    repoRoot,
    aiRequest,
    aiPlan,
  );

  const shiftedRequest = structuredClone(aiRequest);
  const shiftedStage = shiftedRequest.semanticBeats[0].visualization.assemblyStages[1];
  const shiftedStageKey = `${shiftedRequest.semanticBeats[0].id}:${shiftedStage.id}`;
  const originalAtSeconds = shiftedStage.atSeconds;
  shiftedStage.atSeconds = Number((shiftedStage.atSeconds + 0.27).toFixed(3));
  const shiftedPlan = compileSelfContainedPlanOnlyFixture(repoRoot, shiftedRequest);
  const originalEventFrames = stageEventFrames(aiPlan);
  const shiftedEventFrames = stageEventFrames(shiftedPlan);
  assert.notEqual(
    originalEventFrames[shiftedStageKey],
    shiftedEventFrames[shiftedStageKey],
    'FORWARD_TEST_STAGE_EVENT_FRAME_DID_NOT_MOVE',
  );
  for (const [eventKey, originalFrame] of Object.entries(originalEventFrames)) {
    if (eventKey === shiftedStageKey) continue;
    assert.equal(
      shiftedEventFrames[eventKey],
      originalFrame,
      `FORWARD_TEST_UNRELATED_STAGE_MOVED:${eventKey}`,
    );
  }
  const originalShiftedScene = aiPlan.scenes.find(
    (scene) => scene.id === shiftedRequest.semanticBeats[0].id,
  );
  const changedShiftedScene = shiftedPlan.scenes.find(
    (scene) => scene.id === shiftedRequest.semanticBeats[0].id,
  );
  assert.ok(originalShiftedScene && changedShiftedScene);
  const shiftedGroupId = shiftedStage.targetIds[0];
  const shiftedNodeId = shiftedStage.targetIds[1];
  const originalShiftedGroup = originalShiftedScene.objectGroups.find(
    (group) => group.id === shiftedGroupId,
  );
  const changedShiftedGroup = changedShiftedScene.objectGroups.find(
    (group) => group.id === shiftedGroupId,
  );
  const originalShiftedNode = originalShiftedScene.nodes.find(
    (node) => node.id === shiftedNodeId,
  );
  const changedShiftedNode = changedShiftedScene.nodes.find(
    (node) => node.id === shiftedNodeId,
  );
  assert.ok(
    originalShiftedGroup &&
      changedShiftedGroup &&
      originalShiftedNode &&
      changedShiftedNode,
    'FORWARD_TEST_SHIFT_TARGETS_MISSING',
  );
  const originalGroupEnterFrame = groupEnterFrame(
    originalShiftedScene,
    originalShiftedGroup,
    aiPlan.render.fps,
  );
  const shiftedGroupEnterFrame = groupEnterFrame(
    changedShiftedScene,
    changedShiftedGroup,
    shiftedPlan.render.fps,
  );
  const originalNodeEnterFrame = nodeEnterFrame(
    originalShiftedScene,
    originalShiftedNode,
    aiPlan.render.fps,
  );
  const shiftedNodeEnterFrame = nodeEnterFrame(
    changedShiftedScene,
    changedShiftedNode,
    shiftedPlan.render.fps,
  );
  assert.notEqual(
    originalGroupEnterFrame,
    shiftedGroupEnterFrame,
    'FORWARD_TEST_RENDER_GROUP_FRAME_DID_NOT_MOVE',
  );
  assert.notEqual(
    originalNodeEnterFrame,
    shiftedNodeEnterFrame,
    'FORWARD_TEST_RENDER_NODE_FRAME_DID_NOT_MOVE',
  );

  const wrongWindowRequest = structuredClone(wechatRequest);
  wrongWindowRequest.authority.timelineWindow.start += 5;
  wrongWindowRequest.authority.timelineWindow.end += 5;
  wrongWindowRequest.media.spoken.sourceIn += 5;
  wrongWindowRequest.media.spoken.sourceOut += 5;
  const wrongWindowCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(
      repoRoot,
      wrongWindowRequest,
      aiRequest,
    ),
    'DIRECTOR_CAPTIONS_AUTHORITY_WINDOW_TEXT_MISMATCH',
  );

  const unknownPrimitiveRequest = structuredClone(aiRequest);
  unknownPrimitiveRequest.semanticBeats[1].visualization.supportGroups[0].visualPrimitive =
    'unknown-support-fallback';
  const unknownPrimitiveCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, unknownPrimitiveRequest),
    'DIRECTOR_VISUAL_PRIMITIVE_UNKNOWN',
  );

  const wrongSlotPrimitiveRequest = structuredClone(aiRequest);
  wrongSlotPrimitiveRequest.semanticBeats[1].visualization.supportGroups[0].visualPrimitive =
    'film-reel';
  const wrongSlotPrimitiveCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, wrongSlotPrimitiveRequest),
    'DIRECTOR_VISUAL_PRIMITIVE_SLOT_INVALID',
  );

  const wrongVisualRoleRequest = structuredClone(aiRequest);
  wrongVisualRoleRequest.semanticBeats[0].visualization.objectGroups[0].visualRole =
    'wechat-fixed-fallback-role';
  const wrongVisualRoleCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, wrongVisualRoleRequest),
    'DIRECTOR_VISUAL_ROLE_UNKNOWN',
  );

  const wrongComplexSlotRoleRequest = structuredClone(aiRequest);
  wrongComplexSlotRoleRequest.semanticBeats[0].visualization.objectGroups[0].visualRole =
    'causal-input';
  const wrongComplexSlotRoleCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, wrongComplexSlotRoleRequest),
    'DIRECTOR_VISUAL_ROLE_SLOT_INVALID',
  );

  const reorderedComplexRolesRequest = structuredClone(aiRequest);
  const reorderedGroups =
    reorderedComplexRolesRequest.semanticBeats[0].visualization.objectGroups;
  [reorderedGroups[0], reorderedGroups[1]] = [reorderedGroups[1], reorderedGroups[0]];
  const reorderedComplexRolesCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, reorderedComplexRolesRequest),
    'DIRECTOR_COMPLEX_VISUAL_ROLE_ORDER_INVALID',
  );

  const unknownSceneKindRequest = structuredClone(aiRequest);
  unknownSceneKindRequest.semanticBeats[0].kind = 'unregistered-scene-kind';
  const unknownSceneKindCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, unknownSceneKindRequest),
    'DIRECTOR_SCENE_KIND_UNKNOWN',
  );
  const unknownSceneTypePlan = structuredClone(aiPlan);
  unknownSceneTypePlan.scenes[0].type = 'unregistered-scene-type';
  const unknownSceneTypeCode = expectDirectorError(
    () => validateDirectorPlanStructure(unknownSceneTypePlan),
    'DIRECTOR_RENDER_PLAN_SCENES_REQUIRED',
  );

  const wrongMechanicalSlotRoleRequest = structuredClone(aiRequest);
  wrongMechanicalSlotRoleRequest.semanticBeats[1].visualization.outputVisualRole =
    'source-channel';
  const wrongMechanicalSlotRoleCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, wrongMechanicalSlotRoleRequest),
    'DIRECTOR_VISUAL_ROLE_SLOT_INVALID',
  );

  const duplicateSupportGroupRequest = structuredClone(aiRequest);
  const clonedSupportGroup = structuredClone(
    duplicateSupportGroupRequest.semanticBeats[1].visualization.supportGroups[0],
  );
  clonedSupportGroup.id = 'unexpected-second-support';
  clonedSupportGroup.items = clonedSupportGroup.items.map((item) => ({
    ...item,
    id: `unexpected-${item.id}`,
  }));
  duplicateSupportGroupRequest.semanticBeats[1].visualization.supportGroups.push(
    clonedSupportGroup,
  );
  const duplicateSupportGroupCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, duplicateSupportGroupRequest),
    'DIRECTOR_SUPPORT_GROUP_COUNT_INVALID',
  );

  const relationEndpointRequest = structuredClone(aiRequest);
  relationEndpointRequest.semanticBeats[0].visualization.relations[0].to =
    'unregistered-relation-endpoint';
  const relationEndpointCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, relationEndpointRequest),
    'DIRECTOR_RELATION_ENDPOINT_UNKNOWN',
  );

  const screenRequestNegativeCodes = {};
  if (wechatRequest.media.screen) {
    const excludedOverlapRequest = structuredClone(wechatRequest);
    excludedOverlapRequest.media.screen.clips.find(
      (clip) => clip.id === 'storeEntryJump',
    ).sourceOut = 132.1;
    screenRequestNegativeCodes.storeEntryExcludedOverlap = expectDirectorError(
      () => compileSelfContainedPlanOnlyFixture(
        repoRoot,
        excludedOverlapRequest,
        aiRequest,
      ),
      'DIRECTOR_SCREEN_CLIP_EXCLUDED_OVERLAP',
    );

    const excludedMenuOverlapRequest = structuredClone(wechatRequest);
    excludedMenuOverlapRequest.media.screen.clips.find(
      (clip) => clip.id === 'storeMenu',
    ).sourceIn = 141.9;
    screenRequestNegativeCodes.storeMenuExcludedOverlap = expectDirectorError(
      () => compileSelfContainedPlanOnlyFixture(
        repoRoot,
        excludedMenuOverlapRequest,
        aiRequest,
      ),
      'DIRECTOR_SCREEN_CLIP_EXCLUDED_OVERLAP',
    );

    const outOfBoundsPlaybackRequest = structuredClone(wechatRequest);
    outOfBoundsPlaybackRequest.media.screen.clips.find(
      (clip) => clip.id === 'storeEntryJump',
    ).outputOut = 19.45;
    screenRequestNegativeCodes.screenPlaybackRateOutOfBounds = expectDirectorError(
      () => compileSelfContainedPlanOnlyFixture(
        repoRoot,
        outOfBoundsPlaybackRequest,
        aiRequest,
      ),
      'DIRECTOR_SCREEN_PLAYBACK_RATE_OUT_OF_BOUNDS',
    );
  } else {
    assert.equal(
      wechatRequest.media.screen ?? null,
      null,
      'FORWARD_TEST_SCREEN_PROPERTY_MUST_BE_NULL_OR_ABSENT',
    );
    assert.equal(wechatPlan.media.screenClips.length, 0, 'FORWARD_TEST_SCREEN_CLIPS_MUST_BE_EMPTY');
    assert.equal(wechatPlan.media.screenExcludedRanges.length, 0, 'FORWARD_TEST_SCREEN_EXCLUDED_RANGES_MUST_BE_EMPTY');
  }

  const unknownStillStageRequest = structuredClone(aiRequest);
  unknownStillStageRequest.stills[0].requiredStageIds.push('unknown-stage');
  const unknownStillStageCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, unknownStillStageRequest),
    'DIRECTOR_COMPLETION_STAGE_PREFIX_INVALID',
  );

  const insufficientSettledFramesRequest = structuredClone(aiRequest);
  insufficientSettledFramesRequest.stills[0].minimumSettledFrames = 16;
  const insufficientSettledFramesCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(
      repoRoot,
      insufficientSettledFramesRequest,
    ),
    'DIRECTOR_STILL_SETTLED_FRAMES_INSUFFICIENT',
  );

  const unsettledStillRequest = structuredClone(aiRequest);
  const unsettledStill = unsettledStillRequest.stills[0];
  const unsettledScene = aiPlan.scenes.find(
    (beat) => beat.id === unsettledStill.sceneId,
  );
  const unsettledCompletion = sceneCompletionWindow(
    unsettledScene,
    aiPlan.render.fps,
    unsettledStill.requiredStageIds,
  );
  unsettledStill.atSeconds =
    (unsettledCompletion.actualCompletionFrame - 1) / aiPlan.render.fps;
  const unsettledStillCode = expectDirectorError(
    () => compileSelfContainedPlanOnlyFixture(repoRoot, unsettledStillRequest),
    'DIRECTOR_STILL_NOT_SETTLED',
  );

  const outOfRangeSfxPlan = structuredClone(wechatPlan);
  outOfRangeSfxPlan.media.sfx[0].cues[0].atSeconds =
    wechatRequest.render.durationSeconds;
  const outOfRangeSfxCode = expectDirectorError(
    () => validateDirectorPlanStructure(outOfRangeSfxPlan),
    'DIRECTOR_RENDER_PLAN_SFX_INVALID',
  );

  const invalidSfxVolumePlan = structuredClone(wechatPlan);
  invalidSfxVolumePlan.media.sfx[0].cues[0].volume = 1.01;
  const invalidSfxVolumeCode = expectDirectorError(
    () => validateDirectorPlanStructure(invalidSfxVolumePlan),
    'DIRECTOR_RENDER_PLAN_SFX_INVALID',
  );

  const malformedSfxPlan = structuredClone(wechatPlan);
  malformedSfxPlan.media.sfx[0].cues = [];
  const malformedSfxCode = expectDirectorError(
    () => validateDirectorPlanStructure(malformedSfxPlan),
    'DIRECTOR_RENDER_PLAN_SFX_INVALID',
  );

  const sfxCues = expandSfxCues(wechatPlan.media.sfx ?? [], wechatPlan.render.fps);
  const requestedCueCount = wechatRequest.media.sfx.reduce(
    (total, file) => total + file.cues.length,
    0,
  );
  assert.equal(sfxCues.length, requestedCueCount, 'FORWARD_TEST_SFX_CUE_COUNT_MISMATCH');
  for (const expandedCue of sfxCues) {
    const [fileId, cueId] = expandedCue.key.split(':');
    const requestFile = wechatRequest.media.sfx.find((file) => file.id === fileId);
    const requestCue = requestFile?.cues.find((cue) => cue.id === cueId);
    assert.ok(requestFile && requestCue, `FORWARD_TEST_SFX_CUE_UNKNOWN:${expandedCue.key}`);
    assert.equal(expandedCue.staticFileName, requestFile.staticFileName);
    assert.equal(expandedCue.frame, Math.round(requestCue.atSeconds * wechatPlan.render.fps));
    assert.equal(expandedCue.volume, requestCue.volume);
  }

  const rendererSource = readFileSync(
    path.resolve(
      repoRoot,
      'skills/koubo-remotion-director/assets/remotion-paper-editorial/DirectorComposition.tsx',
    ),
    'utf8',
  );
  const entrySource = readFileSync(
    path.resolve(
      repoRoot,
      'skills/koubo-remotion-director/assets/remotion-paper-editorial/entry.tsx',
    ),
    'utf8',
  );
  assertRendererUsesPlan(rendererSource, entrySource, wechatPlan, aiPlan);
  assertRelationsBoundAndDifferent(wechatPlan, aiPlan);
  const occludedStateRevealContract = assertOccludedStateRevealContract(
    wechatPlan,
    wechatRequest,
    rendererSource,
  );
  const progressiveLocalAssemblyContract =
    assertProgressiveLocalAssemblyContract(rendererSource);
  const occludedStateRevealNegativeMatrix = assertOccludedStateRevealNegativeMatrix({
    plan: wechatPlan,
    request: wechatRequest,
    planOnlyExecutionTemplate: aiRequest,
    repoRoot,
  });
  const screenContract = assertScreenClipContract(
    wechatPlan,
    wechatRequest,
    rendererSource,
  );
  const screenLifecycle = assertScreenClipFrameLifecycle(
    wechatPlan,
    rendererSource,
  );
  const mechanicalRelationGeometry = assertMechanicalRelationsDriveRenderGeometry(aiPlan);
  const renderInputNegativeCodes = assertRenderInputFailures(wechatPlan);

  const screenOutputNegativeCodes = {};
  if (wechatPlan.media.screenClips.length > 0) {
    const placementCoveragePlan = structuredClone(wechatPlan);
    const answerClip = placementCoveragePlan.media.screenClips.find(
      (clip) => clip.id === 'answerRecommendations',
    );
    const answerScene = placementCoveragePlan.scenes.find((scene) =>
      scene.screenPlacements?.some((placement) => placement.id === answerClip.placementId),
    );
    const answerPlacement = answerScene.screenPlacements.find(
      (placement) => placement.id === answerClip.placementId,
    );
    answerPlacement.visibleFrom = answerClip.outputIn + 0.1;
    screenOutputNegativeCodes.placementCoverageIncomplete = expectDirectorError(
      () =>
        validateDirectorOutput(placementCoveragePlan, {
          request: wechatRequest,
          repoRoot,
          requestPath: wechatRequestPath,
          outputPath: compileOptions(repoRoot, wechatRequestPath, wechatRequest).outputPath,
        }),
      'DIRECTOR_OUTPUT_SCREEN_PLACEMENT_COVERAGE_INCOMPLETE',
    );

    const playbackRatePlan = structuredClone(wechatPlan);
    playbackRatePlan.media.screenClips.find(
      (clip) => clip.id === 'storeMenu',
    ).playbackRate = 1;
    screenOutputNegativeCodes.screenPlaybackRateTampered = expectDirectorError(
      () =>
        validateDirectorOutput(playbackRatePlan, {
          request: wechatRequest,
          repoRoot,
          requestPath: wechatRequestPath,
          outputPath: compileOptions(repoRoot, wechatRequestPath, wechatRequest).outputPath,
        }),
      'DIRECTOR_OUTPUT_SCREEN_PLAYBACK_RATE_INVALID',
    );
  } else {
    assert.equal(
      screenContract.mode,
      'not-declared-by-request',
      'FORWARD_TEST_ZERO_SCREEN_CONTRACT_MODE_INVALID',
    );
    assert.equal(
      screenLifecycle.mode,
      'zero-clips-verified',
      'FORWARD_TEST_ZERO_SCREEN_LIFECYCLE_MODE_INVALID',
    );
  }

  const afterSources = snapshotSources(repoRoot);
  assert.deepEqual(afterSources, beforeSources, 'FORWARD_TEST_SOURCE_CHANGED_DURING_RUN');

  const result = {
    ok: true,
    sourceSnapshotSha256: sha256Text(stableStringify(afterSources)),
    sources: afterSources,
    forwardRuns: {
      wechat: {
        requestId: wechatPlan.requestId,
        chainSha256: wechatPlan.chain.chainSha256,
        sceneCount: wechatValidation.sceneCount,
        primitives: wechatPrimitives,
      },
      aiControl: {
        requestId: aiPlan.requestId,
        chainSha256: aiPlan.chain.chainSha256,
        sceneCount: aiValidation.sceneCount,
        primitives: aiPrimitives,
      },
    },
    sharedNegativeMatrices: {
      schema: {
        path: schemaPath,
        sha256: sha256File(schemaPath),
        engine: 'ajv-2020',
        enginePath,
        engineSha256: sha256File(enginePath),
      },
      compilerRequestMatrix: compilerRequestNegativeMatrix,
      outputMatrix: sharedOutputNegativeMatrix,
      contractFixFourLayerMatrix: contractFixFourLayerNegativeMatrix,
      runtimeContractMatrix: runtimeContractNegativeMatrix,
      planOnlyCommandBoundary,
      occludedStateReveal: occludedStateRevealNegativeMatrix,
      progressiveLocalAssembly: progressiveLocalAssemblyContract.negatives,
    },
    dataDrivenTiming: {
      stageId: shiftedStage.id,
      originalAtSeconds,
      shiftedAtSeconds: shiftedStage.atSeconds,
      originalFrame: originalEventFrames[shiftedStageKey],
      shiftedFrame: shiftedEventFrames[shiftedStageKey],
      originalGroupEnterFrame,
      shiftedGroupEnterFrame,
      originalNodeEnterFrame,
      shiftedNodeEnterFrame,
    },
    negativeTests: {
      wrongAuthorityWindow: wrongWindowCode,
      unknownSupportVisualPrimitive: unknownPrimitiveCode,
      wrongSlotVisualPrimitive: wrongSlotPrimitiveCode,
      wrongVisualRole: wrongVisualRoleCode,
      wrongComplexSlotVisualRole: wrongComplexSlotRoleCode,
      reorderedComplexVisualRoles: reorderedComplexRolesCode,
      wrongMechanicalSlotVisualRole: wrongMechanicalSlotRoleCode,
      unknownSceneKind: unknownSceneKindCode,
      unknownSceneType: unknownSceneTypeCode,
      duplicateSupportGroup: duplicateSupportGroupCode,
      unknownRelationEndpoint: relationEndpointCode,
      screenRequestContract: screenRequestNegativeCodes,
      unknownStillRequiredStage: unknownStillStageCode,
      insufficientStillSettledFrames: insufficientSettledFramesCode,
      stillBeforeRequiredStageSettled: unsettledStillCode,
      sfxCueOutOfRange: outOfRangeSfxCode,
      sfxVolumeInvalid: invalidSfxVolumeCode,
      sfxMalformed: malformedSfxCode,
      screenOutputContract: screenOutputNegativeCodes,
      planOnlyRenderForbidden: planOnlyRenderCode,
      completionWindow: completionNegativeCodes,
      renderInput: renderInputNegativeCodes,
    },
    sfx: {
      fileCount: wechatPlan.media.sfx.length,
      cueCount: sfxCues.length,
      cues: sfxCues,
    },
    screenBoundary: {
      contract: screenContract,
      lifecycle: screenLifecycle,
      excludedRanges: wechatPlan.media.screenExcludedRanges,
      clips: wechatPlan.media.screenClips.map((clip) => ({
        id: clip.id,
        trimBeforeFrame: clip.trimBeforeFrame,
        trimAfterFrame: clip.trimAfterFrame,
        outputInFrame: clip.outputInFrame,
        outputOutFrame: clip.outputOutFrame,
        playbackRate: clip.playbackRate,
        placementId: clip.placementId,
      })),
    },
    settledStills: {
      wechat: wechatPlan.stillPlan.map((still) => ({
        id: still.id,
        frame: still.frame,
        requiredStageIds: still.requiredStageIds,
        minimumSettledFrames: still.minimumSettledFrames,
        completion: still.completion,
      })),
      aiControl: aiPlan.stillPlan.map((still) => ({
        id: still.id,
        frame: still.frame,
        requiredStageIds: still.requiredStageIds,
        minimumSettledFrames: still.minimumSettledFrames,
        completion: still.completion,
      })),
    },
    relationBindings: {
      wechat: wechatPlan.scenes.map((scene) => ({id: scene.id, relations: scene.relations})),
      aiControl: aiPlan.scenes.map((scene) => ({id: scene.id, relations: scene.relations})),
      mechanicalMutation: mechanicalRelationGeometry,
    },
    occludedStateReveal: occludedStateRevealContract,
    progressiveLocalAssembly: progressiveLocalAssemblyContract,
    rendererStructure: {
      stagesUseAtSeconds: true,
      visualPrimitiveDispatchIsPlanDriven: true,
      supportPrimitiveDispatchIsPlanDriven: true,
      sfxUsesNestedCues: true,
      abUsesSharedVisualComposition: true,
      missingPlanFallbackForbidden: true,
      screenSourceOutAndPlaybackRateBound:
        screenContract.mode === 'declared-and-frame-bound',
      screenLifecycleCheckedFrameByFrame:
        screenLifecycle.mode === 'frame-lifecycle-verified',
      zeroScreenClipContractVerified:
        screenLifecycle.mode === 'zero-clips-verified',
      screenConsumptionClaimed: screenContract.consumptionClaimed,
      relationsAreContractBound: true,
      photographicStateRelationsClaimedAsRendered: false,
      mechanicalRelationCoordinatesArePlanDriven: true,
      stillsRequireSettledStages: true,
      stillCompletionIncludesPinAndTwine: true,
    },
    executionModes: {
      wechat: {
        mode: wechatPlan.executionMode,
        commandIds: wechatPlan.commands.map((command) => command.id),
      },
      aiControl: {
        mode: aiPlan.executionMode,
        commandIds: aiPlan.commands.map((command) => command.id),
        hasRenderOutputs: aiPlan.samplePlan?.outputs != null,
      },
    },
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.code ?? 'FORWARD_REAL_INPUT_TEST_FAILED'}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
