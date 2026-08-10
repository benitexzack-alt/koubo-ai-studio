import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const previewApproved = args.includes('--preview-approved');
const approvedAtArgument = args.find((argument) =>
  argument.startsWith('--preview-approved-at='),
);
const userPreviewApprovedAt = approvedAtArgument?.slice(
  '--preview-approved-at='.length,
);
if (previewApproved && !userPreviewApprovedAt) {
  throw new Error('使用 --preview-approved 时必须同时提供 --preview-approved-at=<ISO时间>。');
}
const experimentStatus = previewApproved
  ? 'candidate-preview-approved'
  : 'candidate-preview-required';
const sourcePlanPath = path.join(
  projectRoot,
  'remotion/src/data/AICognitivePositionV73.visual-plan.v1.json',
);
const sfxManifestPath = path.join(
  projectRoot,
  'assets/sfx/koubo-sfx-v8/manifest.json',
);
const runtimePlanPath = path.join(
  projectRoot,
  'remotion/src/data/AICognitivePositionV80.visual-plan.v1.json',
);
const runtimeSfxPath = path.join(
  projectRoot,
  'remotion/src/data/AICognitivePositionV80.sfx.v1.json',
);
const editPlanPath = path.join(
  projectRoot,
  'edit/20260810_ai_cognitive_position/visual-plan_AI_COGNITIVE_POSITION_20260810_talk01_v8.json',
);
const editSfxPath = path.join(
  projectRoot,
  'edit/20260810_ai_cognitive_position/sfx-cue-sheet_AI_COGNITIVE_POSITION_20260810_talk01_v8.json',
);
const jobPath = path.join(
  projectRoot,
  'workflow/jobs/20260810_ai_cognitive_position_v80.production.json',
);

const sourcePlan = JSON.parse(readFileSync(sourcePlanPath, 'utf8'));
const sfxManifest = JSON.parse(readFileSync(sfxManifestPath, 'utf8'));
const manifestByOutput = new Map(
  sfxManifest.items.map((item) => [item.output, item]),
);

const semanticFamilyByComponent = {
  statement: 'direct-statement',
  comparison: 'comparison-bars',
  timeline: 'process-rail',
  flow: 'process-rail',
  'layer-map': 'activated-node-map',
  definition: 'hero-definition',
  'question-grid': 'question-list',
  'four-rights': 'rights-rail',
  'call-demo': 'source-branches',
  'feedback-loop': 'activated-node-map',
  'three-feedbacks': 'status-stack',
  'generated-broll': 'annotated-media',
  closing: 'closing-signature',
};
const roleByFamily = {
  'direct-statement': 'keyword',
  'comparison-bars': 'comparison',
  'process-rail': 'line',
  'activated-node-map': 'node',
  'hero-definition': 'number',
  'question-list': 'list',
  'rights-rail': 'chapter',
  'source-branches': 'evidence',
  'status-stack': 'correction',
  'annotated-media': 'media',
  'closing-signature': 'confirm',
};
const roleFiles = {
  keyword: [
    'v1-keyword-tick.wav',
    'v2-keyword-select.wav',
    'v3-soft-card-pop-a.wav',
    'v3-soft-card-pop-b.wav',
    'waic-card-pop.wav',
    'remotion-mouse-click.wav',
  ],
  comparison: [
    'remotion-ui-switch.wav',
    'v2-card-slide.wav',
    'v1-card-reveal.wav',
    'v1-ui-click.wav',
    'v2-ui-click.wav',
    'v3-list-tick-b.wav',
  ],
  line: [
    'v1-node-connect.wav',
    'v2-node-select.wav',
    'v3-line-connect-a.wav',
    'waic-node-connect.wav',
    'remotion-whoosh.wav',
  ],
  node: [
    'waic-node-connect.wav',
    'v3-line-connect-a.wav',
    'v2-node-select.wav',
    'v1-node-connect.wav',
    'remotion-ui-switch.wav',
  ],
  number: [
    'v2-number-affirmation.wav',
    'v3-number-settle-a.wav',
    'waic-thesis-impact.wav',
    'v1-keyword-tick.wav',
  ],
  list: [
    'v3-list-tick-a.wav',
    'v3-list-tick-b.wav',
    'v1-ui-click.wav',
    'v2-ui-click.wav',
  ],
  chapter: [
    'v1-section-air.wav',
    'v2-section-sweep.wav',
    'v3-chapter-sweep-a.wav',
    'waic-section-whoosh.wav',
  ],
  evidence: [
    'v1-camera-shutter.wav',
    'v2-evidence-shutter.wav',
    'v3-evidence-paper-a.wav',
    'remotion-page-turn.wav',
  ],
  media: [
    'v3-media-whoosh-a.wav',
    'v3-media-whoosh-b.wav',
    'remotion-whoosh.wav',
    'v2-zoom-out.wav',
    'waic-section-whoosh.wav',
  ],
  correction: [
    'remotion-ui-switch.wav',
    'v2-keyword-select.wav',
  ],
  confirm: [
    'v1-confirm-soft.wav',
    'v3-cta-confirm-a.wav',
    'remotion-mouse-click.wav',
    'waic-card-pop.wav',
  ],
};
const volumeByRole = {
  keyword: 0.34,
  comparison: 0.3,
  line: 0.28,
  node: 0.28,
  number: 0.3,
  list: 0.31,
  chapter: 0.24,
  evidence: 0.3,
  media: 0.24,
  correction: 0.3,
  confirm: 0.28,
};
const coverageByFamily = {
  'direct-statement': 0.28,
  'comparison-bars': 0.35,
  'process-rail': 0.38,
  'activated-node-map': 0.4,
  'hero-definition': 0.28,
  'question-list': 0.38,
  'rights-rail': 0.36,
  'source-branches': 0.41,
  'status-stack': 0.34,
  'annotated-media': 1,
  'closing-signature': 0.26,
};

const plan = {
  ...sourcePlan,
  schemaVersion: 4,
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: experimentStatus,
  },
  styleReferenceIds: [
    'v72-user-verified-20260730',
    'ref-a-frame-audit-20260810',
    'ref-b-frame-audit-20260810',
    'v8-speaker-first-continuous-semantics',
  ],
  previewCoverage: [
    'hook',
    'complex-overlay',
    'cta',
    'full-screen-asset',
    'speaker-overlay',
    'media-fullscreen',
    'progressive-process',
    'source-evidence',
    'hero-emphasis',
    'sfx-ab',
  ],
  layers: sourcePlan.layers.map((sourceLayer, index) => {
    const originalComponent = sourceLayer.params.component;
    const family = semanticFamilyByComponent[originalComponent];
    const media = family === 'annotated-media';
    const component = originalComponent === 'call-demo' ? 'source-branches' : originalComponent;
    const eventId = `cog8-v${String(index + 1).padStart(3, '0')}`;
    const cueId = `cog8-sfx-${String(index + 1).padStart(3, '0')}`;
    return {
      ...sourceLayer,
      kind: media ? 'full-screen-asset' : 'transparent-semantic-information',
      zone: media ? 'full-screen' : 'left-safe',
      background: media ? 'opaque' : 'talk',
      asset: {
        ...sourceLayer.asset,
        source:
          sourceLayer.assetDecision.class === 'remotion-information'
            ? `AICognitivePositionV80/${family}`
            : sourceLayer.asset.source,
      },
      visualEvent: {
        ...sourceLayer.visualEvent,
        id: eventId,
      },
      sound: {
        ...sourceLayer.sound,
        role: roleByFamily[family],
        cueId,
      },
      params: {
        ...sourceLayer.params,
        component,
      },
      presentation: {
        renderMode: media ? 'media-fullscreen' : 'speaker-overlay',
        semanticFamily: family,
        coverageRatio: coverageByFamily[family],
        progressiveReveal: true,
      },
      checks: {
        ...sourceLayer.checks,
        continuousReviewIntervalSeconds: media ? null : 0.5,
      },
    };
  }),
};

const lastUseBySource = new Map();
const useCountBySource = new Map();
const pickSource = (role, start) => {
  const candidates = roleFiles[role].map(
    (fileName) => `remotion/public/audio/koubo-sfx-v8/${fileName}`,
  );
  const available = candidates
    .filter((source) => start - (lastUseBySource.get(source) ?? -Infinity) >= 25)
    .filter((source) => (useCountBySource.get(source) ?? 0) < 3)
    .sort((left, right) => {
      const useDelta = (useCountBySource.get(left) ?? 0) - (useCountBySource.get(right) ?? 0);
      if (useDelta !== 0) return useDelta;
      return (lastUseBySource.get(left) ?? -Infinity) - (lastUseBySource.get(right) ?? -Infinity);
    });
  const source = available[0];
  if (!source) throw new Error(`${role} 在 ${start.toFixed(2)} 秒没有满足25秒间隔的音效。`);
  lastUseBySource.set(source, start);
  useCountBySource.set(source, (useCountBySource.get(source) ?? 0) + 1);
  return source;
};

const cues = plan.layers.map((layer) => {
  const role = layer.sound.role;
  const start = layer.visualEvent.enterAt + layer.sound.offsetFrames / plan.target.fps;
  const source = pickSource(role, start);
  const manifestItem = manifestByOutput.get(source);
  if (!manifestItem) throw new Error(`V8音效清单缺少：${source}`);
  return {
    id: layer.sound.cueId,
    visualEventId: layer.visualEvent.id,
    role,
    start,
    end: start + Math.min(1.4, manifestItem.durationSeconds),
    source,
    license: manifestItem.license,
    licenseReference: manifestItem.licenseReference,
    volume: volumeByRole[role],
    voiceDuckDb: 0,
    previewCovered: start >= 123.72 && start <= 168.72,
    formalReviewed: false,
    userAudibilityConfirmed: previewApproved && start >= 123.72 && start <= 168.72,
  };
});

const cueSheet = {
  schemaVersion: 3,
  videoId: plan.videoId,
  version: 'v8-candidate-1',
  experimentId: plan.experiment.id,
  normalizedPack: 'assets/sfx/koubo-sfx-v8/manifest.json',
  cues,
  coverageReview: {
    primaryVisualEventCount: plan.layers.length,
    coveredPrimaryVisualEventCount: cues.length,
    coveragePercent: 100,
    maxSyncErrorFrames: 2,
    machineStatus: 'pending-validator',
    userAudibilityConfirmed: previewApproved,
    confirmationScope: previewApproved
      ? 'representative-preview-only'
      : 'not-confirmed',
  },
};

const job = {
  schemaVersion: 1,
  jobId: '20260810-ai-cognitive-position-v80-candidate',
  videoId: plan.videoId,
  title: 'AI在第四次工业革命里站哪一层',
  purpose:
    '完整保留用户口播，以人物为默认主画面，用连续语义组件替代全屏Remotion说明页，并试听标准化本地音效。',
  productionState: 'ready-for-production',
  experiment: {
    id: plan.experiment.id,
    status: plan.experiment.status,
    userPreviewApproved: previewApproved,
    userPreviewApprovedAt: userPreviewApprovedAt ?? null,
    userMediaRequest: 'notes/2026-08-10-AI第四次工业革命普通人位置-素材与V7.3执行单-v1.md',
    primaryVisualEventCount: plan.layers.length,
    sfxCoveragePercent: 100,
    previewAuditionRoles: ['node', 'media', 'comparison', 'chapter', 'evidence', 'list'],
  },
  baseline: {
    path: 'workflow/production-baseline.v1.json',
    id: 'koubo-formal-16x9-v1',
    revision: 'V7.2-20260730',
  },
  inputs: {
    source: 'source/20260810_ai_cognitive_position/R01_AI第四次工业革命_口播原片.MOV',
    renderProxy: 'remotion/public/media/ai-cognitive-position-20260810/main-30fps.mp4',
    visualPlan: path.relative(projectRoot, editPlanPath),
    bilingualCaptions: 'remotion/public/data/AI_COGNITIVE_POSITION_20260810_talk01.bilingual.v1.json',
    sfxCueSheet: path.relative(projectRoot, editSfxPath),
    sfxManifest: 'assets/sfx/koubo-sfx-v8/manifest.json',
    fingerprintPaths: [
      'source/20260810_ai_cognitive_position/R01_AI第四次工业革命_口播原片.MOV',
      'remotion/public/media/ai-cognitive-position-20260810',
      'remotion/public/data/AI_COGNITIVE_POSITION_20260810_talk01.bilingual.v1.json',
      'remotion/src/AICognitivePositionV80Talk16x9.tsx',
      'remotion/src/components/V8SemanticStage.tsx',
      'remotion/src/components/V72ProductionShell.tsx',
      path.relative(projectRoot, runtimePlanPath),
      path.relative(projectRoot, runtimeSfxPath),
      path.relative(projectRoot, editPlanPath),
      path.relative(projectRoot, editSfxPath),
      'remotion/public/audio/koubo-sfx-v8',
      'assets/sfx/koubo-sfx-v8/manifest.json',
    ],
  },
  remotion: {
    root: 'remotion',
    entry: 'src/index.ts',
    compositionWithSfx: 'AICognitivePosition16x9-V80-WithSfx',
    compositionWithoutSfx: 'AICognitivePosition16x9-V80-NoSfx',
    durationSeconds: 305.968005,
    fps: 30,
    width: 1920,
    height: 1080,
    concurrency: 3,
  },
  preview: {
    enabled: true,
    withSfxOnly: false,
    scale: 0.5,
    crf: 22,
    ranges: [
      {
        id: 'v8-continuous-speaker-media-source-branches',
        startSeconds: 123.72,
        endSeconds: 168.72,
      },
    ],
    output: 'work/production-runs/20260810-ai-cognitive-position-v80/preview-with-sfx.mp4',
    renderWithoutSfxComparison: true,
  },
  riskFrames: {
    enabled: true,
    source: 'visual-plan-reviewAt',
    fullResolution: true,
    outputDirectory: 'work/production-runs/20260810-ai-cognitive-position-v80/risk-frames',
  },
  audioPreflight: {
    enabled: true,
    source: 'preview',
    integratedLoudnessTargetLufs: -16,
    truePeakMaxDbtp: -1.5,
    preferredTruePeakDbtp: -1.8,
  },
  formal: {
    enabled: previewApproved,
    composition: 'with-sfx',
    blockedReason: previewApproved
      ? null
      : '等待用户确认V8连续动态预览和有声/无声A/B。',
    crf: 18,
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioBitrate: '192k',
    rawOutput: 'work/production-runs/20260810-ai-cognitive-position-v80/formal-raw.mp4',
    finalOutput: 'outputs/AI第四次工业革命普通人位置_16x9_V80_候选成片_v1.mp4',
    loudness: {
      enabled: true,
      integratedLoudnessTargetLufs: -16,
      loudnessRangeTargetLu: 11,
      truePeakTargetDbtp: -2.2,
    },
  },
  cache: {
    enabled: true,
    directory: 'work/production-cache',
    reuseOnlyOnExactFingerprint: true,
  },
  reports: {
    runManifest: 'work/production-runs/20260810-ai-cognitive-position-v80/run-manifest.json',
    timingReport: 'work/production-runs/20260810-ai-cognitive-position-v80/timing-report.json',
    regressionReport: 'work/production-runs/20260810-ai-cognitive-position-v80/regression-report.json',
  },
};

for (const target of [runtimePlanPath, runtimeSfxPath, editPlanPath, editSfxPath, jobPath]) {
  mkdirSync(path.dirname(target), {recursive: true});
}
for (const target of [runtimePlanPath, editPlanPath]) {
  writeFileSync(target, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
}
for (const target of [runtimeSfxPath, editSfxPath]) {
  writeFileSync(target, `${JSON.stringify(cueSheet, null, 2)}\n`, 'utf8');
}
writeFileSync(jobPath, `${JSON.stringify(job, null, 2)}\n`, 'utf8');

console.log(`V8视觉事件：${plan.layers.length}`);
console.log(`V8音效点：${cues.length}`);
console.log(`实际音效文件：${new Set(cues.map((cue) => cue.source)).size}`);
console.log(path.relative(projectRoot, jobPath));
