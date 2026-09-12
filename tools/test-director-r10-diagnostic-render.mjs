#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DIRECTOR_R10_DIAGNOSTIC_CONTRACT,
  assertR10CueAudibilityAudit,
  assertDirectorR10DiagnosticManifest,
  assertDirectorR10SnapshotStable,
  assertKnowledgeContextDocument,
  assertKnowledgeContextValidation,
  assertR10CompositionMetadata,
  assertR10OutputProbe,
  assertR10PairedAudioHashes,
  assertR10PairedVisualHashes,
  assertR10SingleVisualMasterDerivation,
  assertR10SpeechPreservationMetrics,
  captureDirectorR10InputSnapshot,
  resolveDirectorR10OutputTarget,
  stableJsonSha256,
} from './director-r10-diagnostic-render-core.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const testRoot = mkdtempSync(
  path.join(realpathSync(os.tmpdir()), 'director-r10-diagnostic-render-'),
);
const projectRoot = path.join(testRoot, 'project');
const contextPath = path.join(testRoot, 'personal-kb', '.opc-rag', 'tasks', 'r10', 'context.json');

const sha256File = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');

const writeFixture = (relativePath, contents) => {
  const absolutePath = path.join(projectRoot, ...relativePath.split('/'));
  mkdirSync(path.dirname(absolutePath), {recursive: true});
  writeFileSync(absolutePath, contents);
  return absolutePath;
};

const writeJsonFixture = (relativePath, value) =>
  writeFixture(relativePath, `${JSON.stringify(value, null, 2)}\n`);

const composition = (id) => ({
  id,
  width: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.width,
  height: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.height,
  fps: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.fps,
  durationInFrames: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.durationInFrames,
  outputFile: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.outputFiles[id],
});

const inputKind = (relativePath) => {
  if (relativePath.startsWith(`${DIRECTOR_R10_DIAGNOSTIC_CONTRACT.publicDir}/`)) {
    return 'media';
  }
  if (relativePath === 'remotion/package.json' || relativePath === 'remotion/package-lock.json') {
    return 'dependency';
  }
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/u.test(relativePath)) return 'code';
  return 'data';
};

const sourceGraphFixturePaths = [
  DIRECTOR_R10_DIAGNOSTIC_CONTRACT.actualSpokenBilingualPath,
  `${DIRECTOR_R10_DIAGNOSTIC_CONTRACT.publicDir}/sfx/paper.wav`,
];

const fixturePaths = [...new Set([
  ...DIRECTOR_R10_DIAGNOSTIC_CONTRACT.requiredProjectInputs,
  `${DIRECTOR_R10_DIAGNOSTIC_CONTRACT.pilotSourceDir}/index.tsx`,
  `${DIRECTOR_R10_DIAGNOSTIC_CONTRACT.pilotSourceDir}/Component.tsx`,
  DIRECTOR_R10_DIAGNOSTIC_CONTRACT.runtimeTimelinePath,
  `${DIRECTOR_R10_DIAGNOSTIC_CONTRACT.pilotSourceDir}/tsconfig.json`,
  `${DIRECTOR_R10_DIAGNOSTIC_CONTRACT.publicDir}/R01.mp4`,
  `${DIRECTOR_R10_DIAGNOSTIC_CONTRACT.publicDir}/fonts/STHeiti-Medium.ttc`,
  ...sourceGraphFixturePaths,
])];

const sealRuntime = (value) => {
  const {timelineSha256: _discardedTimelineSha256, ...source} = value;
  const sourceGraphSha256 = stableJsonSha256(value.sourceGraph);
  const unsigned = {
    ...source,
    sourceGraphSha: sourceGraphSha256,
    sourceGraphSha256,
  };
  return {
    ...unsigned,
    timelineSha256: stableJsonSha256(unsigned),
  };
};

const buildManifest = () => ({
  schemaVersion: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.manifestSchema,
  taskId: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.taskId,
  status: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.status,
  diagnosticOnly: true,
  productionEligible: false,
  releaseEligible: false,
  publishAuthorized: false,
  userNormalSpeedReviewRequired: true,
  knowledgeContext: {
    path: contextPath,
    sha256: sha256File(contextPath),
  },
  remotion: {
    root: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.remotionRoot,
    entry: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.entry,
    publicDir: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.publicDir,
    renderWindow: {
      startFrame: 0,
      endFrameExclusive: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.durationInFrames,
    },
    compositions: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds.map(composition),
  },
  inputs: [
    ...fixturePaths.map((relativePath, index) => ({
      id: `project-input-${String(index).padStart(2, '0')}`,
      kind: inputKind(relativePath),
      path: relativePath,
      sha256: sha256File(path.join(projectRoot, ...relativePath.split('/'))),
    })),
    {
      id: 'knowledge-context',
      kind: 'knowledge-context',
      path: contextPath,
      sha256: sha256File(contextPath),
    },
  ],
  output: {
    root: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.outputRoot,
    runDirectory: 'r10-diagnostic-test-r1',
  },
});

const expectCode = (code, fn) => {
  assert.throws(fn, (error) => {
    assert.equal(error.code, code);
    return true;
  });
};

const expectRejectCode = async (code, promiseFactory) => {
  await assert.rejects(promiseFactory, (error) => {
    assert.equal(error.code, code);
    return true;
  });
};

try {
  mkdirSync(path.dirname(contextPath), {recursive: true});
  writeFileSync(
    contextPath,
    `${JSON.stringify({
      status: 'context-ready',
      task: {id: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.taskId, important: true},
      project_route: {project_root: projectRoot},
      gate: {formal_execution_allowed: true},
    })}\n`,
  );
  for (const relativePath of fixturePaths) {
    if (
      relativePath === DIRECTOR_R10_DIAGNOSTIC_CONTRACT.runtimeTimelinePath ||
      relativePath === DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compileReceiptPath
    ) {
      continue;
    }
    if (relativePath.endsWith('.json')) {
      writeJsonFixture(relativePath, {fixture: relativePath});
    } else {
      writeFixture(relativePath, `fixture:${relativePath}\n`);
    }
  }
  const sourceGraph = sourceGraphFixturePaths.map((relativePath, index) => ({
    role: index === 0 ? 'actual-spoken-bilingual' : 'runtime-sfx-file',
    path: relativePath,
    sha256: sha256File(path.join(projectRoot, ...relativePath.split('/'))),
  }));
  const runtime = sealRuntime({
    schemaVersion: 1,
    compiler: 'director-r10-timeline-core/v1',
    timelineId: 'fixture-r10-runtime',
    videoId: 'fixture-r10-video',
    fps: 30,
    durationFrames: 1737,
    sourceGraph,
    events: [],
    soundCues: [{id: 'cue-paper', source: 'sfx/paper.wav'}],
  });
  const fixtureRuntimePath = writeJsonFixture(
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.runtimeTimelinePath,
    runtime,
  );
  writeJsonFixture(DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compileReceiptPath, {
    schemaVersion: 'director-r10-lanzhou-compile-receipt/v1',
    status: 'compiled-sidecar-not-rendered',
    productionEligible: false,
    rendered: false,
    userDynamicAcceptanceRequired: true,
    runtime: {
      path: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.runtimeTimelinePath,
      sha256: sha256File(fixtureRuntimePath),
      sourceGraphSha: runtime.sourceGraphSha256,
      timelineSha256: runtime.timelineSha256,
    },
  });

  const manifest = buildManifest();
  assert.equal(
    assertDirectorR10DiagnosticManifest(manifest, {projectRoot, knowledgeContextPath: contextPath}),
    manifest,
  );
  const firstSnapshot = await captureDirectorR10InputSnapshot(manifest, {
    projectRoot,
    knowledgeContextPath: contextPath,
  });
  const secondSnapshot = await captureDirectorR10InputSnapshot(manifest, {
    projectRoot,
    knowledgeContextPath: contextPath,
  });
  assert.doesNotThrow(() =>
    assertDirectorR10SnapshotStable(firstSnapshot, secondSnapshot, '有效输入'),
  );

  assert.deepEqual(
    assertKnowledgeContextDocument(
      {
        status: 'context-ready',
        task: {id: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.taskId, important: true},
        project_route: {project_root: projectRoot},
        gate: {formal_execution_allowed: true},
      },
      {projectRoot},
    ),
    {
      status: 'context-ready',
      taskId: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.taskId,
      important: true,
      projectRoot,
      formalExecutionAllowed: true,
    },
  );
  expectCode('R10_DIAGNOSTIC_CONTEXT_DOCUMENT_NOT_READY', () =>
    assertKnowledgeContextDocument(
      {
        status: 'context-ready',
        task: {id: 'task-wrong', important: true},
        project_route: {project_root: projectRoot},
        gate: {formal_execution_allowed: true},
      },
      {projectRoot},
    ),
  );

  assert.deepEqual(
    assertKnowledgeContextValidation({
      status: 'context-valid',
      gate: {formal_execution_allowed: true},
    }),
    {status: 'context-valid', formalExecutionAllowed: true},
  );
  expectCode('R10_DIAGNOSTIC_CONTEXT_NOT_VALID', () =>
    assertKnowledgeContextValidation({
      status: 'blocked-missing-project-context',
      gate: {formal_execution_allowed: false},
    }),
  );

  const escapedPath = structuredClone(manifest);
  escapedPath.inputs[0].path = '../escape.mjs';
  expectCode('R10_DIAGNOSTIC_INPUT_PATH_INVALID', () =>
    assertDirectorR10DiagnosticManifest(escapedPath, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );

  const oneComposition = structuredClone(manifest);
  oneComposition.remotion.compositions.pop();
  expectCode('R10_DIAGNOSTIC_COMPOSITION_PAIR_REQUIRED', () =>
    assertDirectorR10DiagnosticManifest(oneComposition, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );

  const formalField = structuredClone(manifest);
  formalField.formalOutput = 'outputs/formal.mp4';
  expectCode('R10_DIAGNOSTIC_MANIFEST_FIELDS_INVALID', () =>
    assertDirectorR10DiagnosticManifest(formalField, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );
  const publishField = structuredClone(manifest);
  publishField.publishAuthorized = true;
  expectCode('R10_DIAGNOSTIC_PUBLISH_FORBIDDEN', () =>
    assertDirectorR10DiagnosticManifest(publishField, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );
  const releaseField = structuredClone(manifest);
  releaseField.releaseEligible = true;
  expectCode('R10_DIAGNOSTIC_RELEASE_FORBIDDEN', () =>
    assertDirectorR10DiagnosticManifest(releaseField, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );

  const durationDrift = structuredClone(manifest);
  durationDrift.remotion.compositions[0].durationInFrames = 1736;
  expectCode('R10_DIAGNOSTIC_COMPOSITION_SPEC_DRIFT', () =>
    assertDirectorR10DiagnosticManifest(durationDrift, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );
  const selectedSpecDrift = composition(
    DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds[0],
  );
  selectedSpecDrift.width = 1280;
  expectCode('R10_DIAGNOSTIC_SELECTED_COMPOSITION_SPEC_DRIFT', () =>
    assertR10CompositionMetadata(selectedSpecDrift),
  );

  const validProbe = {
    streams: [
      {
        codec_type: 'video',
        codec_name: 'h264',
        width: 1920,
        height: 1080,
        pix_fmt: 'yuvj420p',
        avg_frame_rate: '30/1',
        nb_read_frames: '1737',
        duration: '57.900000',
      },
      {
        codec_type: 'audio',
        codec_name: 'aac',
        sample_rate: '48000',
        channels: 2,
        duration: '57.962667',
      },
    ],
    format: {duration: '57.962667', size: '1000'},
  };
  assert.equal(
    assertR10OutputProbe(
      validProbe,
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds[0],
    ).frames,
    1737,
  );
  const probeDrift = structuredClone(validProbe);
  probeDrift.streams[0].nb_read_frames = '1736';
  expectCode('R10_DIAGNOSTIC_OUTPUT_SPEC_DRIFT', () =>
    assertR10OutputProbe(
      probeDrift,
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds[0],
    ),
  );
  const invalidFrameRateProbe = structuredClone(validProbe);
  invalidFrameRateProbe.streams[0].avg_frame_rate = '0/0';
  expectCode('R10_DIAGNOSTIC_OUTPUT_SPEC_DRIFT', () =>
    assertR10OutputProbe(
      invalidFrameRateProbe,
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds[0],
    ),
  );
  const invalidPixelFormatProbe = structuredClone(validProbe);
  invalidPixelFormatProbe.streams[0].pix_fmt = 'yuv444p';
  expectCode('R10_DIAGNOSTIC_OUTPUT_SPEC_DRIFT', () =>
    assertR10OutputProbe(
      invalidPixelFormatProbe,
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds[0],
    ),
  );
  const invalidAudioCodecProbe = structuredClone(validProbe);
  invalidAudioCodecProbe.streams[1].codec_name = 'opus';
  expectCode('R10_DIAGNOSTIC_OUTPUT_SPEC_DRIFT', () =>
    assertR10OutputProbe(
      invalidAudioCodecProbe,
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds[0],
    ),
  );
  const truncatedAudioProbe = structuredClone(validProbe);
  truncatedAudioProbe.streams[1].duration = '0.100000';
  expectCode('R10_DIAGNOSTIC_OUTPUT_SPEC_DRIFT', () =>
    assertR10OutputProbe(
      truncatedAudioProbe,
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds[0],
    ),
  );
  const pairedVisualOutputs = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds.map(
    (compositionId) => ({
      compositionId,
      decodedVideoSha256: 'a'.repeat(64),
    }),
  );
  assert.equal(
    assertR10PairedVisualHashes(pairedVisualOutputs).status,
    'decoded-visual-streams-identical',
  );
  pairedVisualOutputs[1].decodedVideoSha256 = 'b'.repeat(64);
  expectCode('R10_DIAGNOSTIC_VISUAL_PAIR_MISMATCH', () =>
    assertR10PairedVisualHashes(pairedVisualOutputs),
  );
  const pairedAudioOutputs = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds.map(
    (compositionId, index) => ({
      compositionId,
      decodedAudioSha256: (index === 0 ? 'c' : 'd').repeat(64),
    }),
  );
  assert.equal(
    assertR10PairedAudioHashes(pairedAudioOutputs).status,
    'decoded-audio-streams-distinct',
  );
  pairedAudioOutputs[1].decodedAudioSha256 = pairedAudioOutputs[0].decodedAudioSha256;
  expectCode('R10_DIAGNOSTIC_AUDIO_PAIR_IDENTICAL', () =>
    assertR10PairedAudioHashes(pairedAudioOutputs),
  );
  const derivationOutputs = DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compositionIds.map(
    (compositionId, index) => ({
      compositionId,
      decodedAudioSha256: (index === 0 ? 'e' : 'f').repeat(64),
    }),
  );
  const validDerivation = {
    strategy: DIRECTOR_R10_DIAGNOSTIC_CONTRACT.renderStrategy,
    visualMasterCompositionId:
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.visualMasterCompositionId,
    sfxAudioCompositionId:
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.sfxAudioCompositionId,
    sourceAudioSha256: '9'.repeat(64),
    sourceAudioDecodedSha256: derivationOutputs[0].decodedAudioSha256,
    videoCodec: 'copy',
    audioCodec: 'copy',
  };
  assert.equal(
    assertR10SingleVisualMasterDerivation(validDerivation, derivationOutputs).status,
    'single-visual-master-audio-mux-provenance-passed',
  );
  expectCode('R10_DIAGNOSTIC_AUDIO_MUX_PROVENANCE_MISMATCH', () =>
    assertR10SingleVisualMasterDerivation(
      {...validDerivation, sourceAudioDecodedSha256: '1'.repeat(64)},
      derivationOutputs,
    ),
  );
  expectCode('R10_DIAGNOSTIC_RENDER_DERIVATION_INVALID', () =>
    assertR10SingleVisualMasterDerivation(
      {...validDerivation, strategy: 'two-independent-video-renders'},
      derivationOutputs,
    ),
  );
  const validSpeechMetrics = {
    correlation: 0.997,
    offsetMs: -42.5,
    rmsDeltaDb: -0.04,
    comparedSamples: 115800,
    sampleRate: 2000,
  };
  assert.equal(
    assertR10SpeechPreservationMetrics(validSpeechMetrics).status,
    'recorded-speech-correlation-passed',
  );
  expectCode('R10_DIAGNOSTIC_SPEECH_NOT_PRESERVED', () =>
    assertR10SpeechPreservationMetrics({
      ...validSpeechMetrics,
      correlation: 0.5,
    }),
  );
  expectCode('R10_DIAGNOSTIC_SPEECH_NOT_PRESERVED', () =>
    assertR10SpeechPreservationMetrics({
      ...validSpeechMetrics,
      rmsDeltaDb: 2,
    }),
  );
  const cueAudits = [
    {
      cueId: 'cue-a',
      differenceRmsDbfs: -32,
      differencePeakDbfs: -18,
      comparedSamples: 1800,
    },
    {
      cueId: 'cue-b',
      differenceRmsDbfs: -40,
      differencePeakDbfs: -24,
      comparedSamples: 1800,
    },
  ];
  assert.equal(
    assertR10CueAudibilityAudit(cueAudits, ['cue-a', 'cue-b']).status,
    'all-runtime-cues-have-detectable-difference',
  );
  expectCode('R10_DIAGNOSTIC_CUE_NOT_AUDIBLE', () =>
    assertR10CueAudibilityAudit(
      [cueAudits[0], {...cueAudits[1], differenceRmsDbfs: -80}],
      ['cue-a', 'cue-b'],
    ),
  );

  const target = resolveDirectorR10OutputTarget(manifest, {projectRoot});
  mkdirSync(target.runPath, {recursive: true});
  expectCode('R10_DIAGNOSTIC_OUTPUT_ALREADY_EXISTS', () =>
    resolveDirectorR10OutputTarget(manifest, {projectRoot}),
  );
  rmSync(target.runPath, {recursive: true, force: true});

  const mutatedSnapshot = structuredClone(firstSnapshot);
  mutatedSnapshot[0].sha256 = 'f'.repeat(64);
  expectCode('R10_DIAGNOSTIC_INPUT_DRIFT', () =>
    assertDirectorR10SnapshotStable(firstSnapshot, mutatedSnapshot, '渲染输入'),
  );
  const wrongHash = structuredClone(manifest);
  wrongHash.inputs[0].sha256 = '0'.repeat(64);
  await expectRejectCode('R10_DIAGNOSTIC_SHA256_MISMATCH', () =>
    captureDirectorR10InputSnapshot(wrongHash, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );

  const sourceVideoPath = path.join(
    projectRoot,
    ...`${DIRECTOR_R10_DIAGNOSTIC_CONTRACT.publicDir}/R01.mp4`.split('/'),
  );
  const sourceVideoBackup = `${sourceVideoPath}.real`;
  writeFileSync(sourceVideoBackup, readFileSync(sourceVideoPath));
  rmSync(sourceVideoPath);
  symlinkSync(sourceVideoBackup, sourceVideoPath);
  const symlinkManifest = structuredClone(manifest);
  const sourceVideoInput = symlinkManifest.inputs.find((input) =>
    input.path.endsWith('/R01.mp4'),
  );
  sourceVideoInput.sha256 = sha256File(sourceVideoBackup);
  await expectRejectCode('R10_DIAGNOSTIC_SYMLINK_FORBIDDEN', () =>
    captureDirectorR10InputSnapshot(symlinkManifest, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );
  rmSync(sourceVideoPath);
  writeFileSync(sourceVideoPath, readFileSync(sourceVideoBackup));
  rmSync(sourceVideoBackup);

  const runtimePath = path.join(
    projectRoot,
    ...DIRECTOR_R10_DIAGNOSTIC_CONTRACT.runtimeTimelinePath.split('/'),
  );
  const compileReceiptPath = path.join(
    projectRoot,
    ...DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compileReceiptPath.split('/'),
  );
  const validRuntimeSource = readFileSync(runtimePath, 'utf8');
  const validCompileReceiptSource = readFileSync(compileReceiptPath, 'utf8');
  const validRuntime = JSON.parse(validRuntimeSource);
  const validCompileReceipt = JSON.parse(validCompileReceiptSource);
  const bindMutatedRuntime = (runtimeDocument, mutateReceipt = null) => {
    writeJsonFixture(
      DIRECTOR_R10_DIAGNOSTIC_CONTRACT.runtimeTimelinePath,
      runtimeDocument,
    );
    const receipt = structuredClone(validCompileReceipt);
    receipt.runtime.sha256 = sha256File(runtimePath);
    receipt.runtime.sourceGraphSha = runtimeDocument.sourceGraphSha256;
    receipt.runtime.timelineSha256 = runtimeDocument.timelineSha256;
    if (mutateReceipt) mutateReceipt(receipt);
    writeJsonFixture(DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compileReceiptPath, receipt);
    const mutatedManifest = structuredClone(manifest);
    mutatedManifest.inputs.find(
      (input) => input.path === DIRECTOR_R10_DIAGNOSTIC_CONTRACT.runtimeTimelinePath,
    ).sha256 = sha256File(runtimePath);
    mutatedManifest.inputs.find(
      (input) => input.path === DIRECTOR_R10_DIAGNOSTIC_CONTRACT.compileReceiptPath,
    ).sha256 = sha256File(compileReceiptPath);
    return mutatedManifest;
  };
  const restoreRuntimeBinding = () => {
    writeFileSync(runtimePath, validRuntimeSource);
    writeFileSync(compileReceiptPath, validCompileReceiptSource);
  };

  const missingActualSpoken = structuredClone(manifest);
  missingActualSpoken.inputs = missingActualSpoken.inputs.filter(
    (input) => input.path !== DIRECTOR_R10_DIAGNOSTIC_CONTRACT.actualSpokenBilingualPath,
  );
  await expectRejectCode('R10_DIAGNOSTIC_SOURCE_GRAPH_INPUT_MISSING', () =>
    captureDirectorR10InputSnapshot(missingActualSpoken, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );

  const badSourceGraphEntry = sealRuntime({
    ...validRuntime,
    sourceGraph: validRuntime.sourceGraph.map((source) => (
      source.path === DIRECTOR_R10_DIAGNOSTIC_CONTRACT.actualSpokenBilingualPath
        ? {...source, sha256: 'f'.repeat(64)}
        : source
    )),
  });
  const sourceGraphEntryMismatch = bindMutatedRuntime(badSourceGraphEntry);
  await expectRejectCode('R10_DIAGNOSTIC_SOURCE_GRAPH_INPUT_SHA_MISMATCH', () =>
    captureDirectorR10InputSnapshot(sourceGraphEntryMismatch, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );
  restoreRuntimeBinding();

  const unsignedBadSourceGraphSeal = {
    ...validRuntime,
    sourceGraphSha: 'e'.repeat(64),
    sourceGraphSha256: 'e'.repeat(64),
  };
  delete unsignedBadSourceGraphSeal.timelineSha256;
  const badSourceGraphSeal = {
    ...unsignedBadSourceGraphSeal,
    timelineSha256: stableJsonSha256(unsignedBadSourceGraphSeal),
  };
  const sourceGraphSealMismatch = bindMutatedRuntime(badSourceGraphSeal);
  await expectRejectCode('R10_DIAGNOSTIC_RUNTIME_SOURCE_GRAPH_SHA_MISMATCH', () =>
    captureDirectorR10InputSnapshot(sourceGraphSealMismatch, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );
  restoreRuntimeBinding();

  const compileReceiptMismatch = bindMutatedRuntime(
    validRuntime,
    (receipt) => {
      receipt.runtime.sha256 = 'd'.repeat(64);
    },
  );
  await expectRejectCode('R10_DIAGNOSTIC_COMPILE_RECEIPT_RUNTIME_MISMATCH', () =>
    captureDirectorR10InputSnapshot(compileReceiptMismatch, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );
  restoreRuntimeBinding();

  const nonPublicRuntimeDocument = sealRuntime({
    ...validRuntime,
    soundCues: [{id: 'bad', source: 'remotion/public/audio/outside.wav'}],
  });
  const nonPublicRuntime = bindMutatedRuntime(nonPublicRuntimeDocument);
  await expectRejectCode('R10_DIAGNOSTIC_RUNTIME_SOUND_OUTSIDE_PUBLIC_SFX', () =>
    captureDirectorR10InputSnapshot(nonPublicRuntime, {
      projectRoot,
      knowledgeContextPath: contextPath,
    }),
  );
  restoreRuntimeBinding();

  const runnerSource = readFileSync(
    path.join(repositoryRoot, 'tools/run-director-r10-diagnostic-preview.mjs'),
    'utf8',
  );
  assert.match(runnerSource, /@remotion\/bundler/u);
  assert.match(runnerSource, /@remotion\/renderer/u);
  assert.match(runnerSource, /renderPair/u);
  assert.match(runnerSource, /codec:\s*'aac'/u);
  assert.match(runnerSource, /'-c:v',\s*'copy'/u);
  assert.match(runnerSource, /single-render-stream-copy/u);
  assert.match(runnerSource, /overwrite:\s*false/u);
  assert.doesNotMatch(runnerSource, /remotion\s+render/u);
  assert.doesNotMatch(runnerSource, /release-validation|run-v72-production/u);

  console.log('R10 隔离旁路诊断渲染入口回归通过。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
