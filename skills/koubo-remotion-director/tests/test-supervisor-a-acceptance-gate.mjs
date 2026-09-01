#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import Ajv2020 from '../assets/schema-validator-engine.mjs';
import {
  DIRECTOR_COMPILER_RELATIVE_PATH,
  REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH,
  REQUEST_ISOLATION_REGISTRY_SHA256_ENV,
  SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
  SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
  SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID,
  SUPERVISOR_A_ACCEPTANCE_FILE_NAME,
  SUPERVISOR_A_ACCEPTANCE_ID,
  SUPERVISOR_A_ACCEPTANCE_KIND,
  SUPERVISOR_A_ACCEPTANCE_SCHEMA,
  SUPERVISOR_A_AUTHORITATIVE_FPS,
  SUPERVISOR_A_AUTHORITATIVE_FRAMES,
  SUPERVISOR_A_CORRECTED_TERMINAL_STATE_SHA256,
  SUPERVISOR_A_END_EXCLUSIVE_FRAME,
  SUPERVISOR_A_GATE_ID,
  SUPERVISOR_A_MACHINE_REVIEW_FILE_NAME,
  SUPERVISOR_A_REVIEW_SCHEMA,
  SUPERVISOR_A_STATIC_DIRECTION_AUTHORITY_SHA256,
  SUPERVISOR_A_VISUAL_REVIEW_FILE_NAME,
  enforceRequestIsolation,
  requestAStateBundleSha256,
  sha256File,
  validateSupervisorAIndependentAcceptanceGate,
  validateSupervisorAIndependentAcceptanceFixtureForTest,
} from '../scripts/compile-director-plan.mjs';
import {
  lockedSceneCompletionWindow,
  sceneCompletionMinimumLockFrames,
} from '../assets/remotion-paper-editorial/style.ts';

const testPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(testPath), '../../..');
const compilerPath = path.join(
  repoRoot,
  'skills/koubo-remotion-director/scripts/compile-director-plan.mjs',
);
const fixedIsolationRegistryPath = path.join(repoRoot, REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH);
const fixedAcceptanceRegistryPath = path.join(
  repoRoot,
  SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
);
const acceptanceEvidenceRoot = process.env.KOUBO_DIRECTOR_ACCEPTANCE_EVIDENCE_ROOT
  ? path.resolve(process.env.KOUBO_DIRECTOR_ACCEPTANCE_EVIDENCE_ROOT)
  : path.join(
      repoRoot,
      'work/director-paper-editorial/20260824-wechat-real-input/director-skill-recovery/dynamic-gate-01',
    );
const canonicalPackageRoot = path.join(
  acceptanceEvidenceRoot,
  'a-progressive-states-canonical',
);
const legacyRequestPath = path.join(
  acceptanceEvidenceRoot,
  'director-request.exact30.json',
);
const requiredAcceptanceEvidence = [
  path.join(canonicalPackageRoot, 'a-progressive-states.manifest.json'),
  legacyRequestPath,
];
if (requiredAcceptanceEvidence.some((filePath) => !existsSync(filePath))) {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    skipped: true,
    reason: 'external-immutable-acceptance-evidence-missing',
    requiredEnvironment: 'KOUBO_DIRECTOR_ACCEPTANCE_EVIDENCE_ROOT',
  })}\n`);
  process.exit(0);
}
const temporaryDirectory = mkdtempSync(
  path.join(realpathSync(tmpdir()), 'supervisor-a-acceptance-test-'),
);
const originalAcceptanceRegistryAnchor =
  process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV];
const canonicalManifest = JSON.parse(readFileSync(
  path.join(canonicalPackageRoot, 'a-progressive-states.manifest.json'),
  'utf8',
));

const fixturePngCrcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

function fixturePngCrc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = fixturePngCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function fixturePngChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(
    fixturePngCrc32(Buffer.concat([typeBytes, data])),
    8 + data.length,
  );
  return chunk;
}

function alphaPngIhdr(variant, width = 20, height = 20) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 5; y < 13; y += 1) {
    for (let x = 5; x < 13; x += 1) {
      const offset = (y * width + x) * 4;
      rgba[offset] = (20 + variant * 6) & 0xff;
      rgba[offset + 1] = (40 + variant * 10) & 0xff;
      rgba[offset + 2] = (60 + variant * 14) & 0xff;
      rgba[offset + 3] = 255;
    }
  }
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0;
    rgba.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    fixturePngChunk('IHDR', ihdr),
    fixturePngChunk('IDAT', deflateSync(scanlines, {level: 9})),
    fixturePngChunk('IEND'),
  ]);
}

function oracleCanonicalize(value) {
  if (Array.isArray(value)) return value.map(oracleCanonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, oracleCanonicalize(value[key])]),
    );
  }
  return value;
}

function oracleSha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function oracleStableStringify(value) {
  return JSON.stringify(oracleCanonicalize(value));
}

function oracleArtifactBundleSha256(input) {
  return oracleSha256Text(oracleStableStringify({
    schema: 'director-supervisor-a-artifact-bundle/v1',
    ...input,
  }));
}

const artifactBundleGoldenInput = Object.freeze({
  builderSha256: '0'.repeat(64),
  manifestSha256: '1'.repeat(64),
  generationReceiptSha256: '2'.repeat(64),
  authorityReceiptSha256: '3'.repeat(64),
  contactSheetSha256: '4'.repeat(64),
  stateTreeSha256: '5'.repeat(64),
  scheduleSha256: '6'.repeat(64),
  states: Array.from({length: 17}, (_, index) => ({
    id: `A${String(index).padStart(2, '0')}`,
    sha256: ((index + 7) % 16).toString(16).repeat(64),
  })),
});
const ARTIFACT_BUNDLE_GOLDEN_SHA256 =
  'e6e8aafc6035600dbae600977df24b40b521cb0caf4ee166773c2d740592b24d';

const writeJson = (filePath, value) => {
  mkdirSync(path.dirname(filePath), {recursive: true});
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const expectCode = (code, callback) => {
  assert.throws(callback, (error) => error.code === code, `expected ${code}`);
};

function makeReview(reviewRole, artifactBundleSha256) {
  return {
    schema: SUPERVISOR_A_REVIEW_SCHEMA,
    status: 'accepted-for-exact30-candidate',
    gateId: SUPERVISOR_A_GATE_ID,
    acceptanceId: SUPERVISOR_A_ACCEPTANCE_ID,
    artifactBundleSha256,
    reviewRole,
    decision: 'go',
    p0: 0,
    p1: 0,
  };
}

function withEnvironmentValue(name, value, callback) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return callback();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

function validateFixtureWithCurrentEnvironment(fixture) {
  return validateSupervisorAIndependentAcceptanceFixtureForTest({
    request: fixture.request,
    scenes: fixture.scenes,
    repoRoot: fixture.repoRoot,
    requestPath: fixture.requestPath,
    acceptanceAnchorRegistryPath: fixture.anchorRegistryPath,
  });
}

function validateFixture(fixture, expectedRegistrySha256 = sha256File(fixture.anchorRegistryPath)) {
  return withEnvironmentValue(
    SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
    expectedRegistrySha256,
    () => validateFixtureWithCurrentEnvironment(fixture),
  );
}

function replaceAnchorBindingPath(fixture, bindingName, replacementPath) {
  const registry = JSON.parse(readFileSync(fixture.anchorRegistryPath, 'utf8'));
  registry.entries[0][bindingName].path = replacementPath;
  writeJson(fixture.anchorRegistryPath, registry);
}

function buildFixture(label, options = {}) {
  const fixtureRoot = path.join(temporaryDirectory, label);
  const requestPath = path.join(fixtureRoot, 'director-request.exact30.json');
  const packageRoot = path.join(fixtureRoot, 'a-progressive-states-canonical');
  const statesRoot = path.join(packageRoot, 'states');
  mkdirSync(statesRoot, {recursive: true});

  const builderPath = path.join(packageRoot, 'build-a-progressive-states.mjs');
  const contactSheetPath = path.join(packageRoot, 'A-progressive-states-contact-sheet.png');
  copyFileSync(path.join(canonicalPackageRoot, 'build-a-progressive-states.mjs'), builderPath);
  copyFileSync(
    path.join(canonicalPackageRoot, 'A-progressive-states-contact-sheet.png'),
    contactSheetPath,
  );

  const frames = [...SUPERVISOR_A_AUTHORITATIVE_FRAMES];
  if (options.coordinatedFrameDrift) frames[1] = 13;
  const states = canonicalManifest.states.map((sourceState, index) => {
    const relativePath = sourceState.relativePath;
    const sourcePath = path.join(canonicalPackageRoot, relativePath);
    const destinationPath = path.join(packageRoot, relativePath);
    copyFileSync(sourcePath, destinationPath);
    return {
      id: `A${String(index).padStart(2, '0')}`,
      frame: frames[index],
      timeSeconds: Number((frames[index] / SUPERVISOR_A_AUTHORITATIVE_FPS).toFixed(6)),
      relativePath,
      bytes: statSync(destinationPath).size,
      sha256: sha256File(destinationPath),
    };
  });
  assert.equal(states.at(-1).sha256, SUPERVISOR_A_CORRECTED_TERMINAL_STATE_SHA256);

  const scheduleRecords = states.map(({id, frame, relativePath, bytes, sha256}) => ({
    id,
    frame,
    relativePath,
    bytes,
    sha256,
  }));
  const scheduleSha256 = oracleSha256Text(oracleStableStringify(scheduleRecords));
  const stateTreeDefinition = states
    .map((state) => `${state.relativePath}\t${state.bytes}\t${state.sha256}\n`)
    .join('');
  const stateTreeSha256 = oracleSha256Text(stateTreeDefinition);

  const manifestPath = path.join(packageRoot, 'a-progressive-states.manifest.json');
  const manifestStates = states.map((state) => ({...state}));
  if (options.manifestPathAlias) {
    manifestStates[0].file = path.basename(manifestStates[0].relativePath);
  }
  const manifest = {
    schema: 'paper-editorial-a-progressive-states/v1',
    status: 'candidate-assets-only',
    stateCount: 17,
    render: {
      fps: SUPERVISOR_A_AUTHORITATIVE_FPS,
      sceneEndExclusiveFrame: SUPERVISOR_A_END_EXCLUSIVE_FRAME,
    },
    contactSheet: {
      relativePath: path.basename(contactSheetPath),
      sha256: sha256File(contactSheetPath),
      bytes: statSync(contactSheetPath).size,
    },
    scheduleSha256,
    states: manifestStates,
  };
  if (options.manifestStateCountMissing) delete manifest.stateCount;
  if (options.manifestScheduleMissing) delete manifest.scheduleSha256;
  writeJson(manifestPath, manifest);

  const generationReceiptPath = path.join(packageRoot, 'a-progressive-states.receipt.json');
  const effectiveStateTreeSha256 = options.coordinatedStateTreeDrift
    ? '0'.repeat(64)
    : stateTreeSha256;
  const generationReceipt = {
    schema: 'paper-editorial-a-progressive-states-receipt/v1',
    status: 'candidate-assets-generated-no-video-render',
    stateCount: 17,
    builder: {
      relativePath: path.basename(builderPath),
      sha256: sha256File(builderPath),
    },
    manifest: {
      relativePath: path.basename(manifestPath),
      sha256: sha256File(manifestPath),
    },
    contactSheet: {...manifest.contactSheet},
    stateTree: {
      definition: 'relativePath<TAB>bytes<TAB>sha256<LF> in state order',
      sha256: effectiveStateTreeSha256,
    },
    stateTreeSha256: effectiveStateTreeSha256,
    scheduleSha256,
    prohibitedActionsObserved: {
      videoRendered: options.generationVideoRendered === true,
      externalNetworkUsed: options.generationExternalNetwork === true,
      paidServiceUsed: options.generationPaidService === true,
    },
    states: states.map((state) => ({...state})),
  };
  if (options.generationExtraProhibitedField) {
    generationReceipt.prohibitedActionsObserved.fullFrameShutterUsed = false;
  }
  if (options.generationScheduleMissing) delete generationReceipt.scheduleSha256;
  writeJson(generationReceiptPath, generationReceipt);

  const authorityReceiptPath = path.join(
    packageRoot,
    'a-progressive-states.authority-receipt.json',
  );
  const authorityReceipt = {
    schema: 'director-a-progressive-visual-state-package/v1',
    status: 'candidate-assets-awaiting-supervisor-independent-acceptance',
    stateCount: 17,
    productionEligible: options.authorityProductionEligible === true,
    automationHandoffAllowed: options.authorityHandoffAllowed === true,
    frozenInputs: {
      manifest: {path: manifestPath, sha256: sha256File(manifestPath)},
      generationReceipt: {
        path: generationReceiptPath,
        sha256: sha256File(generationReceiptPath),
      },
      builder: {path: builderPath, sha256: sha256File(builderPath)},
    },
    packageAssets: {
      contactSheet: {path: contactSheetPath, sha256: sha256File(contactSheetPath)},
    },
    terminalAuthorityCorrection: {
      staticDirectionAuthoritySha256: SUPERVISOR_A_STATIC_DIRECTION_AUTHORITY_SHA256,
      acceptedCandidateTerminalStateSha256: SUPERVISOR_A_CORRECTED_TERMINAL_STATE_SHA256,
      supervisorAcceptanceRegistryRequired: true,
      supervisorAcceptanceRegistryIssued: false,
      authorSelfApprovalAllowed: false,
    },
    stateTree: {
      definition: 'relativePath<TAB>bytes<TAB>sha256<LF> in state order',
      sha256: effectiveStateTreeSha256,
    },
    stateTreeSha256: effectiveStateTreeSha256,
    scheduleSha256,
    states: states.map(({id, frame, timeSeconds, relativePath, bytes, sha256}) => ({
      id,
      frame,
      timeSeconds,
      absolutePath: path.join(packageRoot, relativePath),
      bytes,
      sha256,
    })),
  };
  if (options.authorityStateCountMissing) delete authorityReceipt.stateCount;
  if (options.authorityScheduleMissing) delete authorityReceipt.scheduleSha256;
  if (options.authorityStateTimeMissing) delete authorityReceipt.states[0].timeSeconds;
  if (options.authorityStateBytesMissing) delete authorityReceipt.states[0].bytes;
  if (options.authorityExtraAuthorization) authorityReceipt.renderAllowed = true;
  writeJson(authorityReceiptPath, authorityReceipt);

  const artifactBundleInput = {
    builderSha256: sha256File(builderPath),
    manifestSha256: sha256File(manifestPath),
    generationReceiptSha256: sha256File(generationReceiptPath),
    authorityReceiptSha256: sha256File(authorityReceiptPath),
    contactSheetSha256: sha256File(contactSheetPath),
    stateTreeSha256: effectiveStateTreeSha256,
    scheduleSha256,
    states: states.map(({id, sha256}) => ({id, sha256})),
  };
  const artifactBundleSha256 = oracleArtifactBundleSha256(artifactBundleInput);

  const machineReviewPath = path.join(fixtureRoot, SUPERVISOR_A_MACHINE_REVIEW_FILE_NAME);
  const visualReviewPath = path.join(fixtureRoot, SUPERVISOR_A_VISUAL_REVIEW_FILE_NAME);
  const machineReview = makeReview('machine', artifactBundleSha256);
  const visualReview = makeReview('visual', artifactBundleSha256);
  if (options.reviewP1) machineReview.p1 = 1;
  if (options.reviewArtifactBundleDrift) machineReview.artifactBundleSha256 = 'e'.repeat(64);
  writeJson(machineReviewPath, machineReview);
  writeJson(visualReviewPath, visualReview);

  const acceptancePath = path.join(fixtureRoot, SUPERVISOR_A_ACCEPTANCE_FILE_NAME);
  const acceptanceStates = states.map(({id, frame, timeSeconds, relativePath, bytes, sha256}) => ({
    id,
    frame,
    timeSeconds,
    path: path.join(packageRoot, relativePath),
    bytes,
    sha256,
  }));
  if (options.acceptanceStatePathAlias) {
    acceptanceStates[0].path =
      `${packageRoot}/states/../states/${path.basename(states[0].relativePath)}`;
  }
  const operationalEffect = {
    exact30CompileAllowed: true,
    productionEligible: false,
    automationFreezeMustRemain: true,
    automationHandoffAllowed: false,
  };
  if (options.operationalExtraField) operationalEffect.renderAllowed = true;
  const acceptanceReceipt = {
    schema: SUPERVISOR_A_ACCEPTANCE_SCHEMA,
    status: 'accepted-for-exact30-candidate',
    gateId: SUPERVISOR_A_GATE_ID,
    acceptanceId: SUPERVISOR_A_ACCEPTANCE_ID,
    artifactBundleSha256: options.acceptanceArtifactBundleDrift
      ? 'd'.repeat(64)
      : artifactBundleSha256,
    stateCount: 17,
    fps: SUPERVISOR_A_AUTHORITATIVE_FPS,
    endExclusiveFrame: SUPERVISOR_A_END_EXCLUSIVE_FRAME,
    machineReview: {
      path: machineReviewPath,
      sha256: sha256File(machineReviewPath),
      decision: machineReview.decision,
      p0: machineReview.p0,
      p1: machineReview.p1,
    },
    visualReview: {
      path: visualReviewPath,
      sha256: sha256File(visualReviewPath),
      decision: visualReview.decision,
      p0: visualReview.p0,
      p1: visualReview.p1,
    },
    operationalEffect,
    terminalAuthorityCorrection: {
      scope: 'exact30-candidate-only',
      staticDirectionAuthoritySha256: SUPERVISOR_A_STATIC_DIRECTION_AUTHORITY_SHA256,
      acceptedCandidateTerminalStateId: 'A16',
      acceptedCandidateTerminalStateSha256: SUPERVISOR_A_CORRECTED_TERMINAL_STATE_SHA256,
      staticDirectionReceiptPreserved: true,
    },
    bindings: {
      builder: {path: builderPath, sha256: sha256File(builderPath)},
      manifest: {path: manifestPath, sha256: sha256File(manifestPath)},
      generationReceipt: {
        path: generationReceiptPath,
        sha256: sha256File(generationReceiptPath),
      },
      authorityReceipt: {
        path: authorityReceiptPath,
        sha256: sha256File(authorityReceiptPath),
      },
      contactSheet: {path: contactSheetPath, sha256: sha256File(contactSheetPath)},
      stateTreeSha256: effectiveStateTreeSha256,
      scheduleSha256: options.badScheduleSha256 ? 'f'.repeat(64) : scheduleSha256,
      states: acceptanceStates,
    },
  };
  if (options.acceptanceStateCountMissing) delete acceptanceReceipt.stateCount;
  writeJson(acceptancePath, acceptanceReceipt);

  const anchorRegistryPath = path.join(fixtureRoot, 'supervisor-acceptance-anchor-registry.v1.json');
  const anchorRegistry = {
    schemaVersion: 'koubo-director-supervisor-acceptance-anchor-registry/v1',
    taskId: 'supervisor-a-acceptance-test-registry',
    registryPolicy: {
      source: 'skill-fixed-registry',
      relativePath: SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
      externalSha256Env: SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
      failClosedOnMissingRegistry: true,
      failClosedOnMissingEntry: true,
    },
    entries: options.emptyAnchorRegistry ? [] : [{
      gateId: SUPERVISOR_A_GATE_ID,
      acceptanceId: SUPERVISOR_A_ACCEPTANCE_ID,
      status: 'active',
      receipt: {
        path: path.posix.basename(acceptancePath),
        sha256: sha256File(acceptancePath),
      },
      machineReview: {
        path: path.posix.basename(machineReviewPath),
        sha256: sha256File(machineReviewPath),
      },
      visualReview: {
        path: path.posix.basename(visualReviewPath),
        sha256: sha256File(visualReviewPath),
      },
    }],
  };
  writeJson(anchorRegistryPath, anchorRegistry);

  const assetIds = states.map((state, index) =>
    `a-progressive-a${String(index).padStart(2, '0')}`);
  const authorityBindings = states.map((state, index) => ({
    sceneId: 'complex-search-workbench',
    receiptStateId: state.id,
    visualStateAssetId: assetIds[index],
  }));
  const request = {
    execution: {mode: 'renderable', requestPath},
    render: {fps: SUPERVISOR_A_AUTHORITATIVE_FPS},
    authority: {
      receipts: [
        {
          id: 'scene-a-progressive-states-manifest',
          kind: 'visual-state-manifest',
          effect: 'evidence-only',
          path: manifestPath,
          sha256: sha256File(manifestPath),
        },
        {
          id: 'scene-a-progressive-states-generation-receipt',
          kind: 'visual-state-generation-receipt',
          effect: 'evidence-only',
          path: generationReceiptPath,
          sha256: sha256File(generationReceiptPath),
        },
        {
          id: 'scene-a-dynamic-states-receipt',
          kind: 'visual-state-package',
          effect: 'evidence-only',
          path: authorityReceiptPath,
          sha256: sha256File(authorityReceiptPath),
          bindings: authorityBindings,
        },
        {
          id: SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID,
          kind: SUPERVISOR_A_ACCEPTANCE_KIND,
          effect: 'required-gate',
          gateId: SUPERVISOR_A_GATE_ID,
          acceptanceId: SUPERVISOR_A_ACCEPTANCE_ID,
          path: acceptancePath,
          sha256: sha256File(acceptancePath),
        },
      ],
    },
    media: {
      visualStateAssets: states.map((state, index) => ({
        id: assetIds[index],
        path: path.join(packageRoot, state.relativePath),
        sha256: state.sha256,
      })),
    },
  };
  const scenes = [{
    id: 'complex-search-workbench',
    start: 0,
    end: (options.fractionalEndFrame ? 472.5 : SUPERVISOR_A_END_EXCLUSIVE_FRAME) /
      SUPERVISOR_A_AUTHORITATIVE_FPS,
    stateReveal: {
      method: 'progressive-local-assembly',
      states: states.map((state, index) => ({
        id: `request-${state.id}`,
        assetId: assetIds[index],
        atFrame: state.frame,
      })),
    },
  }];
  writeJson(requestPath, request);

  return {
    repoRoot: fixtureRoot,
    fixtureRoot,
    requestPath,
    request,
    scenes,
    anchorRegistryPath,
    acceptancePath,
    machineReviewPath,
    visualReviewPath,
    scheduleSha256,
    stateTreeSha256,
    artifactBundleSha256,
  };
}

function buildCanonicalACompletionScene() {
  const stageIds = SUPERVISOR_A_AUTHORITATIVE_FRAMES.map(
    (_, index) => `a-stage-a${String(index).padStart(2, '0')}`,
  );
  return {
    id: 'complex-search-workbench',
    type: 'complex-explanation',
    start: 0,
    end: SUPERVISOR_A_END_EXCLUSIVE_FRAME / SUPERVISOR_A_AUTHORITATIVE_FPS,
    objectGroups: SUPERVISOR_A_AUTHORITATIVE_FRAMES.map((_, index) => ({
      id: `canonical-a-target-${index}`,
    })),
    nodes: [],
    assemblyStages: SUPERVISOR_A_AUTHORITATIVE_FRAMES.map((frame, index) => ({
      id: stageIds[index],
      atSeconds: frame / SUPERVISOR_A_AUTHORITATIVE_FPS,
      action: `canonical-a-${index}`,
      targetIds: [`canonical-a-target-${index}`],
    })),
    stateReveal: {
      method: 'progressive-local-assembly',
      audit: {
        windowStartFrame: 0,
        windowEndFrame: 278,
        firstChangeFrame: 12,
        namedEntityStateCount: 9,
        maximumUnchangedFrames: 42,
      },
      states: SUPERVISOR_A_AUTHORITATIVE_FRAMES.map((frame, index) => ({
        id: `a-state-a${String(index).padStart(2, '0')}`,
        assetId: index === 16
          ? 'a-cost-complete'
          : `a-progressive-a${String(index).padStart(2, '0')}`,
        stageId: stageIds[index],
        atFrame: frame,
        entityStateId: `a-entity-a${String(index).padStart(2, '0')}`,
        changedEntityIds: [`canonical-a-target-${index}`],
        localMotion: index === 0
          ? {model: 'neutral/v1'}
          : {
            model: 'authored-local-stop-motion/v1',
            region: {x: 100 + index, y: 100 + index, width: 32, height: 24},
            poseAssetIds: [1, 2, 3].map(
              (pose) => `motion-pose-a${String(index).padStart(2, '0')}-${pose}`,
            ),
          },
      })),
      transitions: SUPERVISOR_A_AUTHORITATIVE_FRAMES.slice(1).map((frame, index) => ({
        id: `a-state-a${String(index).padStart(2, '0')}-to-a-state-a${String(index + 1).padStart(2, '0')}`,
        fromStateId: `a-state-a${String(index).padStart(2, '0')}`,
        toStateId: `a-state-a${String(index + 1).padStart(2, '0')}`,
        kind: 'visible-discrete-assembly',
        swapFrame: frame,
      })),
    },
  };
}

function buildAcceptedCompletionContext() {
  const fixedRegistry = JSON.parse(readFileSync(fixedAcceptanceRegistryPath, 'utf8'));
  const anchor = fixedRegistry.entries.find((entry) =>
    entry.gateId === SUPERVISOR_A_GATE_ID &&
      entry.acceptanceId === SUPERVISOR_A_ACCEPTANCE_ID);
  assert.ok(anchor, 'fixed supervisor A acceptance anchor missing');
  const acceptancePath = path.join(acceptanceEvidenceRoot, path.basename(anchor.receipt.path));
  const machineReviewPath = path.join(
    acceptanceEvidenceRoot,
    path.basename(anchor.machineReview.path),
  );
  const visualReviewPath = path.join(
    acceptanceEvidenceRoot,
    path.basename(anchor.visualReview.path),
  );
  const acceptance = JSON.parse(readFileSync(acceptancePath, 'utf8'));
  const terminalState = acceptance.bindings.states.at(-1);
  const fixedRegistrySha256 = sha256File(fixedAcceptanceRegistryPath);
  return {
    executionMode: 'renderable',
    durationSeconds: 30,
    requestPath: path.join(path.dirname(acceptancePath), 'director-request.exact30.json'),
    fileBindings: [
      {
        role: 'authority-receipt',
        id: SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID,
        path: acceptancePath,
        sha256: anchor.receipt.sha256,
      },
      {
        role: 'supervisor-independent-review',
        id: `${SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID}-machine`,
        path: machineReviewPath,
        sha256: anchor.machineReview.sha256,
      },
      {
        role: 'supervisor-independent-review',
        id: `${SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID}-visual`,
        path: visualReviewPath,
        sha256: anchor.visualReview.sha256,
      },
      {
        role: 'supervisor-acceptance-anchor-registry-integrity',
        id: 'actual',
        path: fixedAcceptanceRegistryPath,
        sha256: fixedRegistrySha256,
      },
      {
        role: 'supervisor-acceptance-anchor-registry-integrity',
        id: 'external-expected',
        path: fixedAcceptanceRegistryPath,
        sha256: fixedRegistrySha256,
      },
      {
        role: 'visual-state',
        id: 'a-cost-complete',
        path: terminalState.path,
        sha256: SUPERVISOR_A_CORRECTED_TERMINAL_STATE_SHA256,
      },
    ],
    visualStateAssets: [{
      id: 'a-cost-complete',
      path: terminalState.path,
      staticFileName: 'A16-f463-cost-card-final-position.png',
      sha256: SUPERVISOR_A_CORRECTED_TERMINAL_STATE_SHA256,
      role: 'revealed-state',
    }],
  };
}

try {
  assert.equal(
    oracleArtifactBundleSha256(artifactBundleGoldenInput),
    ARTIFACT_BUNDLE_GOLDEN_SHA256,
    'independent artifact bundle oracle drifted from its fixed golden value',
  );
  for (const field of [
    'builderSha256',
    'manifestSha256',
    'generationReceiptSha256',
    'authorityReceiptSha256',
    'contactSheetSha256',
    'stateTreeSha256',
    'scheduleSha256',
  ]) {
    assert.notEqual(
      oracleArtifactBundleSha256({
        ...artifactBundleGoldenInput,
        [field]: 'f'.repeat(64),
      }),
      ARTIFACT_BUNDLE_GOLDEN_SHA256,
      `${field} did not change the independent artifact bundle oracle`,
    );
  }
  const singleStateMutation = structuredClone(artifactBundleGoldenInput);
  singleStateMutation.states[8].sha256 = '0'.repeat(64);
  assert.notEqual(
    oracleArtifactBundleSha256(singleStateMutation),
    ARTIFACT_BUNDLE_GOLDEN_SHA256,
    'one changed state did not change the independent artifact bundle oracle',
  );

  const planOnlyRegistryRequestPath = path.join(
    temporaryDirectory,
    'plan-only-fixed-registry-gate',
    'director-request.plan-only.json',
  );
  const planOnlyRegistryRequest = {
    requestId: 'plan-only-fixed-registry-gate-test',
    execution: {mode: 'plan-only', requestPath: planOnlyRegistryRequestPath},
    authority: {receipts: []},
  };
  writeJson(planOnlyRegistryRequestPath, planOnlyRegistryRequest);
  expectCode('DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA_REQUIRED', () =>
    withEnvironmentValue(
      REQUEST_ISOLATION_REGISTRY_SHA256_ENV,
      undefined,
      () => enforceRequestIsolation(planOnlyRegistryRequest, {
        repoRoot,
        requestPath: planOnlyRegistryRequestPath,
      }),
    ));
  const planOnlyIsolation = withEnvironmentValue(
    REQUEST_ISOLATION_REGISTRY_SHA256_ENV,
    sha256File(fixedIsolationRegistryPath),
    () => enforceRequestIsolation(planOnlyRegistryRequest, {
      repoRoot,
      requestPath: planOnlyRegistryRequestPath,
    }),
  );
  assert.equal(planOnlyIsolation.checked, true);
  assert.equal(planOnlyIsolation.listExpectedSha256, sha256File(fixedIsolationRegistryPath));
  expectCode('DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REGISTRY_SHA_REQUIRED', () =>
    withEnvironmentValue(
      SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
      undefined,
      () => validateSupervisorAIndependentAcceptanceGate({
        request: planOnlyRegistryRequest,
        scenes: [],
        repoRoot,
        requestPath: planOnlyRegistryRequestPath,
      }),
    ));
  expectCode('DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REGISTRY_SHA_MISMATCH', () =>
    withEnvironmentValue(
      SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
      '0'.repeat(64),
      () => validateSupervisorAIndependentAcceptanceGate({
        request: planOnlyRegistryRequest,
        scenes: [],
        repoRoot,
        requestPath: planOnlyRegistryRequestPath,
      }),
    ));
  const planOnlyAcceptance = withEnvironmentValue(
    SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
    sha256File(fixedAcceptanceRegistryPath),
    () => validateSupervisorAIndependentAcceptanceGate({
      request: planOnlyRegistryRequest,
      scenes: [],
      repoRoot,
      requestPath: planOnlyRegistryRequestPath,
    }),
  );
  assert.equal(planOnlyAcceptance.required, false);
  assert.deepEqual(
    planOnlyAcceptance.verifiedBindings.map((binding) => binding.id).sort(),
    ['actual', 'external-expected'],
  );

  const acceptedFixture = buildFixture('accepted');
  const accepted = validateFixture(acceptedFixture);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.stateCount, 17);
  assert.equal(accepted.scheduleSha256, acceptedFixture.scheduleSha256);
  assert.equal(accepted.stateTreeSha256, acceptedFixture.stateTreeSha256);
  assert.equal(accepted.artifactBundleSha256, acceptedFixture.artifactBundleSha256);
  assert.equal(accepted.terminalAuthorityCorrection.scope, 'exact30-candidate-only');
  const acceptedRegistryIntegrityBindings = accepted.verifiedBindings.filter(
    (binding) => binding.role === 'supervisor-acceptance-anchor-registry-integrity',
  );
  assert.deepEqual(
    acceptedRegistryIntegrityBindings.map((binding) => binding.id).sort(),
    ['actual', 'external-expected'],
  );
  assert.ok(
    acceptedRegistryIntegrityBindings.every(
      (binding) => binding.sha256 === sha256File(acceptedFixture.anchorRegistryPath),
    ),
  );

  const portableRootA = buildFixture('portable-repo-root-a');
  const portableRootB = buildFixture('portable-repo-root-b');
  const portableRegistryA = JSON.parse(readFileSync(portableRootA.anchorRegistryPath, 'utf8'));
  const portableRegistryB = JSON.parse(readFileSync(portableRootB.anchorRegistryPath, 'utf8'));
  assert.deepEqual(
    ['receipt', 'machineReview', 'visualReview'].map(
      (bindingName) => portableRegistryA.entries[0][bindingName].path,
    ),
    ['receipt', 'machineReview', 'visualReview'].map(
      (bindingName) => portableRegistryB.entries[0][bindingName].path,
    ),
    'repository-relative evidence paths must remain stable after the repo root moves',
  );
  assert.ok(
    ['receipt', 'machineReview', 'visualReview'].every(
      (bindingName) =>
        !path.isAbsolute(portableRegistryA.entries[0][bindingName].path) &&
        !portableRegistryA.entries[0][bindingName].path.includes('\\'),
    ),
    'supervisor registry evidence paths must be repository-relative POSIX paths',
  );
  assert.equal(validateFixture(portableRootA).accepted, true);
  assert.equal(validateFixture(portableRootB).accepted, true);
  assert.notEqual(portableRootA.repoRoot, portableRootB.repoRoot);

  for (const [label, replacementPath] of [
    ['absolute', acceptedFixture.acceptancePath],
    ['backslash', `nested\\${SUPERVISOR_A_ACCEPTANCE_FILE_NAME}`],
    ['dot-segment', `./${SUPERVISOR_A_ACCEPTANCE_FILE_NAME}`],
    ['dotdot-segment', `nested/../${SUPERVISOR_A_ACCEPTANCE_FILE_NAME}`],
    ['outside-repo', `../${SUPERVISOR_A_ACCEPTANCE_FILE_NAME}`],
  ]) {
    const maliciousPathFixture = buildFixture(`registry-path-${label}`);
    replaceAnchorBindingPath(maliciousPathFixture, 'receipt', replacementPath);
    expectCode('DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_RELATIVE_PATH_INVALID', () =>
      validateFixture(maliciousPathFixture));
  }

  const aliasPathFixture = buildFixture('registry-path-symlink-alias');
  const acceptanceAliasPath = path.join(aliasPathFixture.fixtureRoot, 'acceptance-alias.json');
  symlinkSync(path.basename(aliasPathFixture.acceptancePath), acceptanceAliasPath);
  replaceAnchorBindingPath(aliasPathFixture, 'receipt', path.basename(acceptanceAliasPath));
  expectCode('DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_PATH_ALIAS_FORBIDDEN', () =>
    validateFixture(aliasPathFixture));

  const canonicalACompletionScene = buildCanonicalACompletionScene();
  const canonicalARequiredStageIds = canonicalACompletionScene.assemblyStages.map(
    (stage) => stage.id,
  );
  const acceptedCompletionContext = buildAcceptedCompletionContext();
  assert.equal(
    sceneCompletionMinimumLockFrames(
      canonicalACompletionScene,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      acceptedCompletionContext,
    ),
    10,
    'accepted canonical A must receive only the exact 10-frame completion-lock exception',
  );
  const canonicalACompletion = lockedSceneCompletionWindow(
    canonicalACompletionScene,
    SUPERVISOR_A_AUTHORITATIVE_FPS,
    canonicalARequiredStageIds,
    acceptedCompletionContext,
  );
  assert.deepEqual(
    {
      actualCompletionFrame: canonicalACompletion.actualCompletionFrame,
      lockEndExclusiveFrame: canonicalACompletion.lockEndExclusiveFrame,
      availableSettledFrames: canonicalACompletion.availableSettledFrames,
      minimumLockFrames: canonicalACompletion.minimumLockFrames,
    },
    {
      actualCompletionFrame: 463,
      lockEndExclusiveFrame: 473,
      availableSettledFrames: 10,
      minimumLockFrames: 10,
    },
  );

  const outputSchema = JSON.parse(readFileSync(
    path.join(
      repoRoot,
      'skills/koubo-remotion-director/templates/director-output.v1.schema.json',
    ),
    'utf8',
  ));
  const schemaValidator = new Ajv2020({allErrors: true, strict: true});
  const validateCompletionSchema = schemaValidator.compile({
    $schema: outputSchema.$schema,
    $defs: {completionWindow: outputSchema.$defs.completionWindow},
    $ref: '#/$defs/completionWindow',
  });
  const validateStillSchema = schemaValidator.compile({
    $schema: outputSchema.$schema,
    $defs: {
      completionWindow: outputSchema.$defs.completionWindow,
      still: outputSchema.$defs.still,
    },
    $ref: '#/$defs/still',
  });
  const canonicalACompletionSchemaValue = {
    model: 'paper-editorial-animation-completion/v1',
    requiredStageIds: [...canonicalARequiredStageIds],
    actualCompletionFrame: 463,
    lockEndExclusiveFrame: 473,
    availableSettledFrames: 10,
    minimumLockFrames: 10,
    criticalContributorIds: ['state-reveal:a-state-a16'],
  };
  assert.equal(validateCompletionSchema(canonicalACompletionSchemaValue), true);
  assert.equal(validateCompletionSchema({
    ...canonicalACompletionSchemaValue,
    availableSettledFrames: 9,
    minimumLockFrames: 9,
  }), false, 'schema must reject a 9-frame completion lock');
  assert.equal(validateCompletionSchema({
    ...canonicalACompletionSchemaValue,
    requiredStageIds: ['other-stage'],
    actualCompletionFrame: 1,
    lockEndExclusiveFrame: 30,
    availableSettledFrames: 29,
    minimumLockFrames: 29,
    criticalContributorIds: ['other-contributor'],
  }), false, 'schema must not turn 29 frames into a general exception');
  assert.equal(validateCompletionSchema({
    ...canonicalACompletionSchemaValue,
    requiredStageIds: ['other-stage'],
    actualCompletionFrame: 0,
    lockEndExclusiveFrame: 30,
    availableSettledFrames: 30,
    minimumLockFrames: 30,
    criticalContributorIds: ['other-contributor'],
  }), true, 'schema must preserve the ordinary 30-frame completion shape');
  const canonicalAStillSchemaValue = {
    id: 'a-complete',
    frame: 465,
    sceneId: 'complex-search-workbench',
    purpose: 'canonical A completion',
    referenceFrameIds: ['S01'],
    requiredStageIds: [...canonicalARequiredStageIds],
    minimumSettledFrames: 10,
    completion: canonicalACompletionSchemaValue,
  };
  assert.equal(validateStillSchema(canonicalAStillSchemaValue), true);
  assert.equal(validateStillSchema({
    ...canonicalAStillSchemaValue,
    minimumSettledFrames: 9,
  }), false, 'schema must reject a 9-frame still declaration');
  assert.equal(validateStillSchema({
    ...canonicalAStillSchemaValue,
    sceneId: 'other-scene',
  }), false, 'schema must reject the 10-frame shape on another scene');

  const missingAcceptanceContext = structuredClone(acceptedCompletionContext);
  missingAcceptanceContext.fileBindings = missingAcceptanceContext.fileBindings.filter(
    (binding) => !(
      binding.role === 'authority-receipt' &&
      binding.id === SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID
    ),
  );
  assert.equal(
    sceneCompletionMinimumLockFrames(
      canonicalACompletionScene,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      missingAcceptanceContext,
    ),
    SUPERVISOR_A_AUTHORITATIVE_FPS,
  );
  expectCode('DIRECTOR_SCENE_COMPLETION_LOCK_INSUFFICIENT', () =>
    lockedSceneCompletionWindow(
      canonicalACompletionScene,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      missingAcceptanceContext,
    ));

  const wrongAcceptanceShaContext = structuredClone(acceptedCompletionContext);
  wrongAcceptanceShaContext.fileBindings.find(
    (binding) =>
      binding.role === 'authority-receipt' &&
      binding.id === SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID,
  ).sha256 = '0'.repeat(64);
  assert.equal(
    sceneCompletionMinimumLockFrames(
      canonicalACompletionScene,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      wrongAcceptanceShaContext,
    ),
    SUPERVISOR_A_AUTHORITATIVE_FPS,
  );
  const wrongTerminalShaContext = structuredClone(acceptedCompletionContext);
  wrongTerminalShaContext.visualStateAssets[0].sha256 = '0'.repeat(64);
  wrongTerminalShaContext.fileBindings.find(
    (binding) => binding.role === 'visual-state' && binding.id === 'a-cost-complete',
  ).sha256 = '0'.repeat(64);
  assert.equal(
    sceneCompletionMinimumLockFrames(
      canonicalACompletionScene,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      wrongTerminalShaContext,
    ),
    SUPERVISOR_A_AUTHORITATIVE_FPS,
  );
  const planOnlyCompletionContext = {
    ...acceptedCompletionContext,
    executionMode: 'plan-only',
  };
  assert.equal(
    sceneCompletionMinimumLockFrames(
      canonicalACompletionScene,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      planOnlyCompletionContext,
    ),
    SUPERVISOR_A_AUTHORITATIVE_FPS,
  );

  const wrongScene = structuredClone(canonicalACompletionScene);
  wrongScene.id = 'not-canonical-a';
  assert.equal(
    sceneCompletionMinimumLockFrames(
      wrongScene,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      acceptedCompletionContext,
    ),
    SUPERVISOR_A_AUTHORITATIVE_FPS,
  );
  expectCode('DIRECTOR_SCENE_COMPLETION_LOCK_INSUFFICIENT', () =>
    lockedSceneCompletionWindow(
      wrongScene,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      acceptedCompletionContext,
    ));

  const wrongTerminalFrame = structuredClone(canonicalACompletionScene);
  wrongTerminalFrame.stateReveal.states.at(-1).atFrame = 464;
  wrongTerminalFrame.assemblyStages.at(-1).atSeconds =
    464 / SUPERVISOR_A_AUTHORITATIVE_FPS;
  wrongTerminalFrame.stateReveal.transitions.at(-1).swapFrame = 464;
  assert.equal(
    sceneCompletionMinimumLockFrames(
      wrongTerminalFrame,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      acceptedCompletionContext,
    ),
    SUPERVISOR_A_AUTHORITATIVE_FPS,
  );
  expectCode('DIRECTOR_SCENE_COMPLETION_LOCK_INSUFFICIENT', () =>
    lockedSceneCompletionWindow(
      wrongTerminalFrame,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      acceptedCompletionContext,
    ));

  const wrongMethod = structuredClone(canonicalACompletionScene);
  wrongMethod.stateReveal.method = 'fully-occluded-hard-cut';
  assert.equal(
    sceneCompletionMinimumLockFrames(
      wrongMethod,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      acceptedCompletionContext,
    ),
    SUPERVISOR_A_AUTHORITATIVE_FPS,
  );

  assert.ok(
    9 < sceneCompletionMinimumLockFrames(
      canonicalACompletionScene,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      acceptedCompletionContext,
    ),
    'a 9-frame declared still hold must remain below the accepted A minimum',
  );

  const otherTwentyNineFrameScene = structuredClone(canonicalACompletionScene);
  otherTwentyNineFrameScene.id = 'other-progressive-scene';
  otherTwentyNineFrameScene.end = 492 / SUPERVISOR_A_AUTHORITATIVE_FPS;
  expectCode('DIRECTOR_SCENE_COMPLETION_LOCK_INSUFFICIENT', () =>
    lockedSceneCompletionWindow(
      otherTwentyNineFrameScene,
      SUPERVISOR_A_AUTHORITATIVE_FPS,
      canonicalARequiredStageIds,
      acceptedCompletionContext,
    ));

  expectCode('DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REGISTRY_SHA_REQUIRED', () =>
    withEnvironmentValue(
      SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
      undefined,
      () => validateFixtureWithCurrentEnvironment(acceptedFixture),
    ));
  expectCode('DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REGISTRY_SHA_MISMATCH', () =>
    validateFixture(acceptedFixture, '0'.repeat(64)));
  const registryDriftFixture = buildFixture('registry-drift');
  const registryDriftExpectedSha256 = sha256File(registryDriftFixture.anchorRegistryPath);
  writeFileSync(
    registryDriftFixture.anchorRegistryPath,
    `${readFileSync(registryDriftFixture.anchorRegistryPath, 'utf8')} `,
  );
  expectCode('DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REGISTRY_SHA_MISMATCH', () =>
    validateFixture(registryDriftFixture, registryDriftExpectedSha256));

  const unregisteredFixture = buildFixture('unregistered', {emptyAnchorRegistry: true});
  expectCode('DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_NOT_REGISTERED', () =>
    validateFixture(unregisteredFixture));

  const reviewDriftFixture = buildFixture('review-drift');
  writeFileSync(
    reviewDriftFixture.machineReviewPath,
    `${readFileSync(reviewDriftFixture.machineReviewPath, 'utf8')} `,
  );
  expectCode('DIRECTOR_INPUT_SHA_MISMATCH', () =>
    validateFixture(reviewDriftFixture));

  const reviewMissingFixture = buildFixture('review-missing');
  rmSync(reviewMissingFixture.visualReviewPath);
  expectCode('DIRECTOR_INPUT_FILE_MISSING', () =>
    validateFixture(reviewMissingFixture));

  const acceptanceDriftFixture = buildFixture('acceptance-drift');
  writeFileSync(
    acceptanceDriftFixture.acceptancePath,
    `${readFileSync(acceptanceDriftFixture.acceptancePath, 'utf8')} `,
  );
  expectCode('DIRECTOR_INPUT_SHA_MISMATCH', () =>
    validateFixture(acceptanceDriftFixture));

  const swappedAnchorFixture = buildFixture('swapped-anchor-reviews');
  const swappedAnchorRegistry = JSON.parse(readFileSync(
    swappedAnchorFixture.anchorRegistryPath,
    'utf8',
  ));
  const originalMachineReview = swappedAnchorRegistry.entries[0].machineReview;
  swappedAnchorRegistry.entries[0].machineReview = swappedAnchorRegistry.entries[0].visualReview;
  swappedAnchorRegistry.entries[0].visualReview = originalMachineReview;
  writeJson(swappedAnchorFixture.anchorRegistryPath, swappedAnchorRegistry);
  expectCode('DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REVIEW_ANCHOR_MISMATCH', () =>
    validateFixture(swappedAnchorFixture));

  for (const [label, options, expectedCode] of [
    [
      'coordinated-frame-drift',
      {coordinatedFrameDrift: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_FRAME_MISMATCH',
    ],
    [
      'fractional-end-frame',
      {fractionalEndFrame: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REQUEST_SCHEDULE_HEADER_INVALID',
    ],
    [
      'acceptance-state-count-missing',
      {acceptanceStateCountMissing: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_FIELDS_INVALID',
    ],
    [
      'manifest-state-count-missing',
      {manifestStateCountMissing: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_MANIFEST_HEADER_INVALID',
    ],
    [
      'authority-state-count-missing',
      {authorityStateCountMissing: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_RECEIPT_HEADER_INVALID',
    ],
    [
      'manifest-schedule-missing',
      {manifestScheduleMissing: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_SCHEDULE_SHA_MISMATCH',
    ],
    [
      'generation-schedule-missing',
      {generationScheduleMissing: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_SCHEDULE_SHA_MISMATCH',
    ],
    [
      'authority-schedule-missing',
      {authorityScheduleMissing: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_SCHEDULE_SHA_MISMATCH',
    ],
    [
      'authority-state-time-missing',
      {authorityStateTimeMissing: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_TIME_MISMATCH',
    ],
    [
      'authority-state-bytes-missing',
      {authorityStateBytesMissing: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_BYTES_MISMATCH',
    ],
    [
      'manifest-path-alias',
      {manifestPathAlias: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PATH_ALIAS_FIELDS_FORBIDDEN',
    ],
    [
      'acceptance-path-alias',
      {acceptanceStatePathAlias: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ABSOLUTE_PATH_INVALID',
    ],
    [
      'generation-network',
      {generationExternalNetwork: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_PROHIBITED_ACTIONS_INVALID',
    ],
    [
      'generation-video',
      {generationVideoRendered: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_PROHIBITED_ACTIONS_INVALID',
    ],
    [
      'generation-paid',
      {generationPaidService: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_PROHIBITED_ACTIONS_INVALID',
    ],
    [
      'generation-extra-prohibited-field',
      {generationExtraProhibitedField: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_PROHIBITED_ACTIONS_FIELDS_INVALID',
    ],
    [
      'authority-production',
      {authorityProductionEligible: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_OPERATIONAL_STATE_INVALID',
    ],
    [
      'authority-handoff',
      {authorityHandoffAllowed: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_OPERATIONAL_STATE_INVALID',
    ],
    [
      'authority-extra-authorization',
      {authorityExtraAuthorization: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_OPERATIONAL_STATE_INVALID',
    ],
    [
      'operational-extra',
      {operationalExtraField: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_OPERATIONAL_EFFECT_FIELDS_INVALID',
    ],
    [
      'review-p1',
      {reviewP1: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REVIEW_NOT_GO',
    ],
    [
      'review-artifact-bundle-drift',
      {reviewArtifactBundleDrift: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ARTIFACT_BUNDLE_MISMATCH',
    ],
    [
      'acceptance-artifact-bundle-drift',
      {acceptanceArtifactBundleDrift: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ARTIFACT_BUNDLE_MISMATCH',
    ],
    [
      'schedule-drift',
      {badScheduleSha256: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_SCHEDULE_SHA_MISMATCH',
    ],
    [
      'state-tree-drift',
      {coordinatedStateTreeDrift: true},
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_TREE_MISMATCH',
    ],
  ]) {
    const fixture = buildFixture(label, options);
    expectCode(expectedCode, () => validateFixture(fixture));
  }

  const integrationFixture = buildFixture('compile-self-signed');
  const integrationRequestPath = path.join(
    integrationFixture.fixtureRoot,
    'director-request.canonical-self-signed.json',
  );
  const integrationRequest = JSON.parse(readFileSync(legacyRequestPath, 'utf8'));
  integrationRequest.requestId = 'wechat-paper-editorial-exact30-canonical-self-signed-cli-test';
  integrationRequest.execution.requestPath = integrationRequestPath;
  integrationRequest.execution.integrityAnchors = {
    compiler: {
      path: DIRECTOR_COMPILER_RELATIVE_PATH,
      sha256: sha256File(compilerPath),
    },
    requestIsolationRegistry: {
      path: REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH,
      sha256: sha256File(fixedIsolationRegistryPath),
    },
    supervisorAcceptanceRegistry: {
      path: SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
      sha256: sha256File(fixedAcceptanceRegistryPath),
    },
  };
  integrationRequest.semanticBeats[0].cognitiveIncrement += '。独立验收门集成负例';
  const integrationAVisual = integrationRequest.semanticBeats[0].visualization;
  const uniqueStageTargets = integrationAVisual.objectGroups.flatMap((group) => [
    group.id,
    ...group.items.map((item) => item.id),
  ]);
  assert.equal(uniqueStageTargets.length, integrationAVisual.assemblyStages.length);
  integrationAVisual.assemblyStages.forEach((stage, index) => {
    stage.targetIds = [uniqueStageTargets[index]];
    integrationAVisual.stateReveal.states[index].changedEntityIds = [uniqueStageTargets[index]];
    if (index === 0) {
      integrationAVisual.stateReveal.states[index].localMotion = {model: 'neutral/v1'};
      return;
    }
    integrationAVisual.stateReveal.states[index].localMotion = {
      model: 'authored-local-stop-motion/v1',
      region: {x: 100 + index, y: 100 + index, width: 20, height: 20},
      poseAssetIds: [1, 2, 3].map(
        (pose) => `integration-motion-pose-a${String(index).padStart(2, '0')}-${pose}`,
      ),
    };
  });
  integrationAVisual.assemblyStages[6].atSeconds = 5.5;
  integrationAVisual.stateReveal.states[6].atSeconds = 5.5;

  const integrationPublicDir = path.join(integrationFixture.fixtureRoot, 'public-media');
  const integrationMotionDir = path.join(integrationFixture.fixtureRoot, 'motion-poses');
  mkdirSync(integrationPublicDir, {recursive: true});
  mkdirSync(integrationMotionDir, {recursive: true});
  integrationRequest.render.publicDir = integrationPublicDir;
  for (let index = 1; index < integrationAVisual.stateReveal.states.length; index += 1) {
    const poseAssetIds = integrationAVisual.stateReveal.states[index].localMotion.poseAssetIds;
    for (const [poseIndex, assetId] of poseAssetIds.entries()) {
      const staticFileName = `${assetId}.png`;
      const motionPath = path.join(integrationMotionDir, staticFileName);
      writeFileSync(motionPath, alphaPngIhdr((index - 1) * 3 + poseIndex));
      const sha256 = sha256File(motionPath);
      integrationRequest.media.visualStateAssets.push({
        id: assetId,
        path: motionPath,
        staticFileName,
        sha256,
        role: 'motion-pose',
      });
    }
  }
  const publicMedia = [
    {
      id: 'public-spoken',
      sourcePath: integrationRequest.media.spoken.path,
      staticFileName: integrationRequest.media.spoken.staticFileName,
      sha256: integrationRequest.media.spoken.sha256,
    },
    ...(integrationRequest.media.screen ? [{
      id: 'public-screen',
      sourcePath: integrationRequest.media.screen.path,
      staticFileName: integrationRequest.media.screen.staticFileName,
      sha256: integrationRequest.media.screen.sha256,
    }] : []),
    ...(integrationRequest.media.sfx ?? []).map((asset) => ({
      id: `public-sfx-${asset.id}`,
      sourcePath: asset.path,
      staticFileName: asset.staticFileName,
      sha256: asset.sha256,
    })),
    ...integrationRequest.media.visualStateAssets.map((asset) => ({
      id: `public-visual-state-${asset.id}`,
      sourcePath: asset.path,
      staticFileName: asset.staticFileName,
      sha256: asset.sha256,
    })),
  ];
  const runtimeById = new Map(
    integrationRequest.execution.runtimeFiles.map((binding) => [binding.id, binding]),
  );
  for (const asset of publicMedia) {
    const publicPath = path.join(integrationPublicDir, asset.staticFileName);
    copyFileSync(asset.sourcePath, publicPath);
    const binding = runtimeById.get(asset.id);
    if (binding) {
      binding.path = publicPath;
      binding.sha256 = asset.sha256;
    } else {
      integrationRequest.execution.runtimeFiles.push({
        id: asset.id,
        path: publicPath,
        sha256: asset.sha256,
      });
    }
  }
  for (const runtimeFile of integrationRequest.execution.runtimeFiles) {
    const runtimePath = path.isAbsolute(runtimeFile.path)
      ? runtimeFile.path
      : path.join(repoRoot, runtimeFile.path);
    if (existsSync(runtimePath)) runtimeFile.sha256 = sha256File(runtimePath);
  }
  const sourcePaths = {
    'scene-a-progressive-states-manifest': path.join(
      canonicalPackageRoot,
      'a-progressive-states.manifest.json',
    ),
    'scene-a-progressive-states-generation-receipt': path.join(
      canonicalPackageRoot,
      'a-progressive-states.receipt.json',
    ),
    'scene-a-dynamic-states-receipt': path.join(
      canonicalPackageRoot,
      'a-progressive-states.authority-receipt.json',
    ),
  };
  for (const declaration of integrationRequest.authority.receipts) {
    const replacementPath = sourcePaths[declaration.id];
    if (!replacementPath) continue;
    declaration.path = replacementPath;
    declaration.sha256 = sha256File(replacementPath);
    if (declaration.id === 'scene-a-dynamic-states-receipt') {
      declaration.bindings = declaration.bindings.map((binding, index) => ({
        ...binding,
        receiptStateId: `A${String(index).padStart(2, '0')}`,
        visualStateAssetId: integrationAVisual.stateReveal.states[index].assetId,
      }));
    }
  }
  integrationRequest.authority.receipts.push({
    id: SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID,
    kind: SUPERVISOR_A_ACCEPTANCE_KIND,
    effect: 'required-gate',
    gateId: SUPERVISOR_A_GATE_ID,
    acceptanceId: SUPERVISOR_A_ACCEPTANCE_ID,
    path: integrationFixture.acceptancePath,
    sha256: sha256File(integrationFixture.acceptancePath),
  });
  const fixedIsolationRegistry = JSON.parse(readFileSync(fixedIsolationRegistryPath, 'utf8'));
  assert.notEqual(
    requestAStateBundleSha256(integrationRequest),
    fixedIsolationRegistry.entries[0].forbiddenBundleSha256,
    'integration request must use canonical logical IDs and new artifact hashes, not renamed IDs',
  );
  writeJson(integrationRequestPath, integrationRequest);
  const integrationOutputPath = path.join(integrationFixture.fixtureRoot, 'plan.json');
  const integrationCompile = spawnSync(process.execPath, [
    compilerPath,
    '--request', integrationRequestPath,
    '--output', integrationOutputPath,
    '--repo-root', repoRoot,
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      [REQUEST_ISOLATION_REGISTRY_SHA256_ENV]: sha256File(fixedIsolationRegistryPath),
      [SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV]: sha256File(fixedAcceptanceRegistryPath),
    },
  });
  assert.notEqual(integrationCompile.status, 0, 'self-signed request unexpectedly compiled');
  assert.match(
    integrationCompile.stderr,
    /DIRECTOR_SUPERVISOR_A_ACCEPTANCE_(ANCHOR_NOT_REGISTERED|DECLARATION_ANCHOR_MISMATCH)/,
  );
  assert.equal(existsSync(integrationOutputPath), false);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    acceptedFixturePassed: true,
    fixedFramesAndSchedulePassed: true,
    terminalCorrectionNarrowScopePassed: true,
    unregisteredSelfSignatureRejected: true,
    independentReviewMissingAndDriftRejected: true,
    pathAliasesRejected: true,
    operationalFreezeAndNoExternalActionsPassed: true,
    coordinatedSixPartyFrameDriftRejected: true,
    artifactBundleBoundAcrossMachineVisualAndAcceptance: true,
    artifactBundleIndependentOracleAndSensitivityPassed: true,
    externalAcceptanceRegistryIntegrityAnchorPassed: true,
    repositoryRelativeAcceptanceRegistryPassed: true,
    movedRepositoryRootResolutionPassed: true,
    maliciousRegistryRelativePathsRejected: true,
    planOnlyFixedRegistriesAndExternalAnchorsPassed: true,
    canonicalLogicalIdsUsedWithoutIntegrationPrefix: true,
    compileIntegrationNegativePassed: true,
    realFixedAnchorRegistryEntryRequiredForCliSuccess: true,
    exactAcceptedACompletionLockTenFramesPassed: true,
    missingAcceptanceWrongSceneFrameAndMethodRejected: true,
    nineFrameCompletionAndStillRejected: true,
    otherSceneTwentyNineFramesRejected: true,
    outputSchemaShortLockShapeNarrowlyBound: true,
  })}\n`);
} finally {
  if (originalAcceptanceRegistryAnchor === undefined) {
    delete process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV];
  } else {
    process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV] = originalAcceptanceRegistryAnchor;
  }
  rmSync(temporaryDirectory, {recursive: true, force: true});
}
