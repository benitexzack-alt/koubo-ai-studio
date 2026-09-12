#!/usr/bin/env node

import assert from 'node:assert/strict';

import {
  DIRECTOR_R10_PAPER_MEDIA_AUDIT_SCHEMA,
  classifyDirectorR10SourceDiagnosticErrors,
  summarizeDirectorR10PaperMediaAudit,
} from './director-r10-paper-media-audit.mjs';

const diagnostic = ({
  durationSeconds = 8,
  fps = 24,
  width = 2560,
  height = 1440,
  audioStreamCount = 1,
  entropyMean = 6.9,
  entropyMedian = 6.9,
  edgeMean = 7.6,
  edgeMedian = 7.6,
  meanMad = 0.22,
  p90Mad = 0.35,
  boundaries = [],
  errors = [],
} = {}) => ({
  status: errors.length ? 'diagnostic-failed' : 'diagnostic-passed',
  probe: {durationSeconds, fps, width, height, audioStreamCount},
  metrics: {
    frameCount: Math.round(durationSeconds * fps),
    summary: {
      entropy: {mean: entropyMean, median: entropyMedian},
      edgeStrength: {mean: edgeMean, median: edgeMedian},
      madPrev: {mean: meanMad, p90: p90Mad},
    },
    boundaries: boundaries.map((timeSeconds, index) => ({
      frame: Math.round(timeSeconds * fps),
      timeSeconds,
      scoreMadRgb: 9 + index,
    })),
  },
  errors,
});

{
  const result = summarizeDirectorR10PaperMediaAudit({
    currentFile: {path: '/fixture/current.mp4', sha256: 'a'.repeat(64)},
    referenceFile: {path: '/fixture/reference.mp4', sha256: 'b'.repeat(64)},
    currentDiagnostic: diagnostic({
      entropyMean: 6.96,
      entropyMedian: 6.95,
      edgeMean: 7.7,
      edgeMedian: 7.65,
      meanMad: 0.2197,
      p90Mad: 0.3519,
      boundaries: [],
      errors: [
        {code: 'AUDIO_TRACK_COUNT_MISMATCH', message: '存在 AAC'},
        {code: 'REFERENCE_MOTION_MATERIAL_GAP', message: '动态差距'},
        {code: 'BOUNDARY_COUNT_TOO_LOW', message: '边界不足'},
        {code: 'EXPECTED_BOUNDARY_MISSING', message: '占位计划点未命中'},
      ],
    }),
    referenceDiagnostic: diagnostic({
      durationSeconds: 5.184,
      fps: 30,
      entropyMean: 7.08,
      entropyMedian: 7.07,
      edgeMean: 12.9,
      edgeMedian: 12.84,
      meanMad: 3.3028,
      p90Mad: 9.0747,
      boundaries: [1.1, 3.2],
    }),
  });

  assert.equal(result.schemaVersion, DIRECTOR_R10_PAPER_MEDIA_AUDIT_SCHEMA);
  assert.equal(result.media.current.sha256, 'a'.repeat(64));
  assert.equal(result.media.reference.sha256, 'b'.repeat(64));
  assert.equal(result.media.current.fps, 24);
  assert.equal(result.media.reference.durationSeconds, 5.184);
  assert.equal(result.media.current.entropy.median, 6.95);
  assert.equal(result.media.current.edgeStrength.median, 7.65);
  assert.equal(result.media.current.madRgb.mean, 0.2197);
  assert.equal(result.media.current.madRgb.p90, 0.3519);
  assert.equal(result.media.current.assemblyBoundaryCount, 0);
  assert.equal(result.media.reference.assemblyBoundaryCount, 2);
  assert.ok(Math.abs(result.comparison.currentToReference.meanMadRatio - (0.2197 / 3.3028)) < 1e-12);
  assert.ok(Math.abs(result.comparison.currentToReference.p90MadRatio - (0.3519 / 9.0747)) < 1e-12);
  assert.equal(result.findings.motionMaterialGap, true);
  assert.equal(result.findings.noAssemblyBoundary, true);
  assert.equal(result.findings.staticLooksAcceptableButMotionFails, true);
  assert.equal(result.decision.status, 'blocked-machine-motion-evidence');
  assert.equal(result.decision.productionEligible, false);
  assert.equal(result.decision.aestheticApproval, 'not-evaluated');
  assert.equal(result.media.current.sourceDiagnosticErrors.audioProtocol.length, 1);
  assert.equal(result.media.current.sourceDiagnosticErrors.motionSignals.length, 2);
  assert.equal(result.media.current.sourceDiagnosticErrors.plannedExpectations.length, 1);
  assert.equal(result.media.current.sourceDiagnosticErrors.audioMismatchExcludedFromPairMotionDecision, true);
}

{
  const result = summarizeDirectorR10PaperMediaAudit({
    currentDiagnostic: diagnostic({
      meanMad: 2,
      p90Mad: 5,
      boundaries: [1, 2, 3],
      errors: [{code: 'AUDIO_TRACK_COUNT_MISMATCH', message: '口播资产保留 AAC'}],
    }),
    referenceDiagnostic: diagnostic({
      meanMad: 3,
      p90Mad: 8,
      boundaries: [1, 2, 3],
      errors: [{code: 'AUDIO_TRACK_COUNT_MISMATCH', message: '参考资产保留 AAC'}],
    }),
  });
  assert.equal(result.findings.motionMaterialGap, false);
  assert.equal(result.findings.noAssemblyBoundary, false);
  assert.equal(result.findings.staticLooksAcceptableButMotionFails, false);
  assert.equal(result.decision.status, 'diagnostic-only-awaiting-human-review');
  assert.equal(result.decision.technicalQaPassed, false);
  assert.equal(result.decision.humanNormalSpeedReviewRequired, true);
  assert.equal(result.media.current.sourceDiagnosticErrors.audioMismatchExcludedFromPairMotionDecision, true);
}

{
  const result = summarizeDirectorR10PaperMediaAudit({
    currentDiagnostic: diagnostic({entropyMedian: 5.9, edgeMedian: 4.2, meanMad: 0.1, p90Mad: 0.2}),
    referenceDiagnostic: diagnostic({meanMad: 3, p90Mad: 8, boundaries: [1]}),
  });
  assert.equal(result.findings.motionMaterialGap, true);
  assert.equal(result.findings.noAssemblyBoundary, true);
  assert.equal(result.staticTextureGate.passed, false);
  assert.equal(result.findings.staticLooksAcceptableButMotionFails, false);
}

{
  const classified = classifyDirectorR10SourceDiagnosticErrors([
    {code: 'AUDIO_TRACK_COUNT_MISMATCH', message: 'audio'},
    {code: 'REFERENCE_MOTION_MATERIAL_GAP', message: 'motion'},
    {code: 'EXPECTED_BOUNDARY_MISSING', message: 'expectation'},
    {code: 'VIDEO_DURATION_MISMATCH', message: 'protocol'},
  ]);
  assert.deepEqual(classified.audioProtocol.map(({code}) => code), ['AUDIO_TRACK_COUNT_MISMATCH']);
  assert.deepEqual(classified.motionSignals.map(({code}) => code), ['REFERENCE_MOTION_MATERIAL_GAP']);
  assert.deepEqual(classified.plannedExpectations.map(({code}) => code), ['EXPECTED_BOUNDARY_MISSING']);
  assert.deepEqual(classified.otherMediaProtocol.map(({code}) => code), ['VIDEO_DURATION_MISMATCH']);
}

assert.throws(
  () => summarizeDirectorR10PaperMediaAudit({
    currentDiagnostic: diagnostic(),
    referenceDiagnostic: diagnostic({meanMad: 0, p90Mad: 0}),
  }),
  (error) => error?.code === 'R10_REFERENCE_MOTION_INVALID',
);

console.log('导演 R10 纸艺动态媒体诊断：通过');
