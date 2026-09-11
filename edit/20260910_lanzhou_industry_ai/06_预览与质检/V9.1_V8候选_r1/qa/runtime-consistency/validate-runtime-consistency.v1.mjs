#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const here = path.dirname(scriptPath);
const repoRoot = path.resolve(here, '../../../../../..');
const receiptPath = path.join(here, 'runtime-consistency-receipt.v1.json');
const commandTempDir = path.join(here, '.runtime-tmp');
const commandCacheDir = path.join(here, '.runtime-cache');

mkdirSync(commandTempDir, {recursive: true});
mkdirSync(commandCacheDir, {recursive: true});

const relative = (value) =>
  path.relative(repoRoot, value).split(path.sep).join('/');
const absolute = (value) => path.resolve(repoRoot, value);
const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
const nearlyEqual = (left, right, tolerance = 1e-6) =>
  Number.isFinite(left) &&
  Number.isFinite(right) &&
  Math.abs(left - right) <= tolerance;
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const overlaps = (left, right) =>
  left.startFrame < right.endFrameExclusive &&
  left.endFrameExclusive > right.startFrame;

const files = Object.freeze({
  activeDirectorProfile: 'workflow/active-director-profile.v1.json',
  activeProductionProfile: 'workflow/active-production-profile.v1.json',
  visualPlan:
    'edit/20260910_lanzhou_industry_ai/00_工程控制/v91-v8-candidate-r1/visual-plan.v1.json',
  sfxCueSheet:
    'edit/20260910_lanzhou_industry_ai/00_工程控制/v91-v8-candidate-r1/sfx-cues.v1.json',
  postshootPlan:
    'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/director-postshoot-rebind-plan.v1.json',
  shotcraftCandidate:
    'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/candidate-plan.v1.json',
  bilingualCandidate:
    'edit/20260910_lanzhou_industry_ai/05_实录与字幕/actual-spoken.bilingual.candidate.v1.json',
  publicCaptions:
    'remotion/public-lanzhou-industry-ai-v91-r1/captions.json',
  runtimeCandidatePlan:
    'remotion/src/lanzhou-industry-ai-v91-candidate-r1/candidate-plan.v1.json',
  runtimeComposition:
    'remotion/src/lanzhou-industry-ai-v91-candidate-r1/LanzhouIndustryAIV91CandidateR1.tsx',
  runtimeEntry:
    'remotion/src/lanzhou-industry-ai-v91-candidate-r1/index.tsx',
  productionShell: 'remotion/src/components/V72ProductionShell.tsx',
  bilingualOverlay:
    'remotion/src/components/AdaptiveBilingualCaptionOverlay.tsx',
  productionJob:
    'workflow/jobs/20260910_lanzhou_industry_ai_v91_v8_r1.production.json',
});

const readBoundJson = (relativePath) => {
  const resolved = absolute(relativePath);
  const bytes = readFileSync(resolved);
  return {
    body: JSON.parse(bytes.toString('utf8')),
    binding: {
      path: relativePath,
      sha256: sha256(bytes),
      bytes: bytes.length,
      modifiedAt: statSync(resolved).mtime.toISOString(),
    },
  };
};

const readBoundText = (relativePath) => {
  const resolved = absolute(relativePath);
  const bytes = readFileSync(resolved);
  return {
    body: bytes.toString('utf8'),
    binding: {
      path: relativePath,
      sha256: sha256(bytes),
      bytes: bytes.length,
      modifiedAt: statSync(resolved).mtime.toISOString(),
    },
  };
};

const documents = {
  activeDirectorProfile: readBoundJson(files.activeDirectorProfile),
  activeProductionProfile: readBoundJson(files.activeProductionProfile),
  visualPlan: readBoundJson(files.visualPlan),
  sfxCueSheet: readBoundJson(files.sfxCueSheet),
  postshootPlan: readBoundJson(files.postshootPlan),
  shotcraftCandidate: readBoundJson(files.shotcraftCandidate),
  bilingualCandidate: readBoundJson(files.bilingualCandidate),
  publicCaptions: readBoundJson(files.publicCaptions),
  runtimeCandidatePlan: readBoundJson(files.runtimeCandidatePlan),
  runtimeComposition: readBoundText(files.runtimeComposition),
  runtimeEntry: readBoundText(files.runtimeEntry),
  productionShell: readBoundText(files.productionShell),
  bilingualOverlay: readBoundText(files.bilingualOverlay),
  productionJob: readBoundJson(files.productionJob),
};

const checks = [];
const addCheck = (id, passed, expected, actual, evidence = []) => {
  checks.push({id, passed: Boolean(passed), expected, actual, evidence});
};

const activeDirector = documents.activeDirectorProfile.body;
const activeProduction = documents.activeProductionProfile.body;
const visualPlan = documents.visualPlan.body;
const sfxCueSheet = documents.sfxCueSheet.body;
const postshootPlan = documents.postshootPlan.body;
const shotcraftCandidate = documents.shotcraftCandidate.body;
const bilingualCandidate = documents.bilingualCandidate.body;
const publicCaptions = documents.publicCaptions.body;
const runtimePlan = documents.runtimeCandidatePlan.body;
const job = documents.productionJob.body;
const compositionSource = documents.runtimeComposition.body;
const entrySource = documents.runtimeEntry.body;
const shellSource = documents.productionShell.body;
const overlaySource = documents.bilingualOverlay.body;

addCheck(
  'active-profiles-v9.1-plus-v8',
  activeDirector.profileId === 'paper-editorial-director-v9' &&
    activeDirector.profileVersion === '9.1.0' &&
    activeProduction.profileId === 'v8-semantic-continuity-sfx' &&
    activeProduction.profileVersion === 'V8' &&
    visualPlan.directorProfile?.version === '9.1.0' &&
    visualPlan.productionProfile?.version === 'V8',
  {
    director: 'paper-editorial-director-v9@9.1.0',
    production: 'v8-semantic-continuity-sfx@V8',
  },
  {
    activeDirector: `${activeDirector.profileId}@${activeDirector.profileVersion}`,
    activeProduction: `${activeProduction.profileId}@${activeProduction.profileVersion}`,
    visualPlanDirector: `${visualPlan.directorProfile?.id}@${visualPlan.directorProfile?.version}`,
    visualPlanProduction: `${visualPlan.productionProfile?.id}@${visualPlan.productionProfile?.version}`,
  },
  [files.activeDirectorProfile, files.activeProductionProfile, files.visualPlan],
);

const controlLayers = Array.isArray(visualPlan.layers) ? visualPlan.layers : [];
const controlSemanticLayers = controlLayers.filter(
  (layer) => layer.kind !== 'full-screen-asset',
);
const controlPaperLayers = controlLayers.filter(
  (layer) => layer.kind === 'full-screen-asset',
);
const runtimeSemanticLayers = Array.isArray(runtimePlan.semanticLayers)
  ? runtimePlan.semanticLayers
  : [];
const runtimePaperClips = Array.isArray(runtimePlan.paperClips)
  ? runtimePlan.paperClips
  : [];

const controlPrimaryVisualIds = controlLayers
  .filter((layer) => layer.visualEvent?.primary === true)
  .map((layer) => layer.id);
const runtimePrimaryVisualIds = [
  ...runtimeSemanticLayers.map((layer) => layer.id),
  ...runtimePaperClips.map((clip) => clip.id),
].sort((left, right) =>
  controlPrimaryVisualIds.indexOf(left) - controlPrimaryVisualIds.indexOf(right),
);

const semanticMismatches = [];
for (const control of controlSemanticLayers) {
  const runtime = runtimeSemanticLayers.find((layer) => layer.id === control.id);
  if (!runtime) {
    semanticMismatches.push({id: control.id, reason: 'runtime-layer-missing'});
    continue;
  }
  const fieldsMatch =
    runtime.beatId === control.beatId &&
    nearlyEqual(runtime.startSeconds, control.start) &&
    nearlyEqual(runtime.endSeconds, control.end) &&
    runtime.controlComponent === control.params?.component &&
    runtime.semanticFamily === control.presentation?.semanticFamily &&
    nearlyEqual(runtime.coverageRatio, control.presentation?.coverageRatio) &&
    runtime.title === control.title &&
    runtime.detail === control.detail &&
    sameJson(runtime.items ?? [], control.items ?? []);
  if (!fieldsMatch) {
    semanticMismatches.push({
      id: control.id,
      reason: 'runtime-layer-drift',
      control: {
        beatId: control.beatId,
        startSeconds: control.start,
        endSeconds: control.end,
        component: control.params?.component,
        semanticFamily: control.presentation?.semanticFamily,
        coverageRatio: control.presentation?.coverageRatio,
        title: control.title,
        detail: control.detail,
        items: control.items ?? [],
      },
      runtime,
    });
  }
}

const paperMismatches = [];
for (const control of controlPaperLayers) {
  const runtime = runtimePaperClips.find((clip) => clip.id === control.id);
  if (!runtime) {
    paperMismatches.push({id: control.id, reason: 'runtime-paper-missing'});
    continue;
  }
  const fieldsMatch =
    runtime.beatId === control.beatId &&
    nearlyEqual(runtime.startSeconds, control.start) &&
    nearlyEqual(runtime.durationSeconds, control.end - control.start) &&
    nearlyEqual(runtime.controlEndSeconds, control.end) &&
    runtime.asset === control.params?.src &&
    runtime.muteAssetAudio === true &&
    runtime.keepCanonicalVoice === true;
  if (!fieldsMatch) {
    paperMismatches.push({
      id: control.id,
      reason: 'runtime-paper-drift',
      control: {
        beatId: control.beatId,
        startSeconds: control.start,
        endSeconds: control.end,
        asset: control.params?.src,
      },
      runtime,
    });
  }
}

addCheck(
  'control-main-visual-count-27',
  controlLayers.length === 27 &&
    controlPrimaryVisualIds.length === 27 &&
    new Set(controlPrimaryVisualIds).size === 27,
  {layers: 27, primaryVisualEvents: 27, uniqueIds: 27},
  {
    layers: controlLayers.length,
    primaryVisualEvents: controlPrimaryVisualIds.length,
    uniqueIds: new Set(controlPrimaryVisualIds).size,
  },
  [files.visualPlan],
);

addCheck(
  'runtime-consumes-all-27-control-visuals',
  runtimePlan.controlCounts?.mainVisuals === 27 &&
    runtimeSemanticLayers.length === 21 &&
    runtimePaperClips.length === 6 &&
    runtimePrimaryVisualIds.length === 27 &&
    sameJson(runtimePrimaryVisualIds, controlPrimaryVisualIds) &&
    semanticMismatches.length === 0 &&
    paperMismatches.length === 0,
  {
    semanticLayers: 21,
    paperClips: 6,
    totalControlVisualsConsumed: 27,
    idsAndWindowsMatch: true,
  },
  {
    declaredControlCount: runtimePlan.controlCounts?.mainVisuals ?? null,
    semanticLayers: runtimeSemanticLayers.length,
    paperClips: runtimePaperClips.length,
    totalControlVisualsConsumed: runtimePrimaryVisualIds.length,
    idsMatch: sameJson(runtimePrimaryVisualIds, controlPrimaryVisualIds),
    semanticMismatches,
    paperMismatches,
  },
  [files.visualPlan, files.runtimeCandidatePlan],
);

const expectedPaper = [
  {id: 'v91-005-p01-b04', beatId: 'B04', asset: 'P01.mp4', start: 40},
  {id: 'v91-009-p02-b07', beatId: 'B07', asset: 'P02.mp4', start: 85.6},
  {id: 'v91-013-p03-b10', beatId: 'B10', asset: 'P03.mp4', start: 136.7},
  {id: 'v91-015-p04-b11', beatId: 'B11', asset: 'P04.mp4', start: 147.7},
  {id: 'v91-020-p05-b15', beatId: 'B15', asset: 'P05.mp4', start: 217.7},
  {id: 'v91-022-p06-b17', beatId: 'B17', asset: 'P06.mp4', start: 244.7},
];
const paperEntryActual = runtimePaperClips.map((clip) => ({
  id: clip.id,
  beatId: clip.beatId,
  asset: clip.asset,
  start: clip.startSeconds,
}));
const postshootPaperBeatIds = Array.isArray(postshootPlan.paperScenes)
  ? postshootPlan.paperScenes.map((scene) => scene.beatId)
  : [];
addCheck(
  'v9.1-six-paper-entry-points',
  sameJson(paperEntryActual, expectedPaper) &&
    sameJson(postshootPaperBeatIds, expectedPaper.map((item) => item.beatId)) &&
    postshootPlan.phase === 'post-shoot' &&
    postshootPlan.spokenAuthority === 'recorded-audio' &&
    postshootPlan.scriptRole === 'comparison-only',
  expectedPaper,
  {
    runtime: paperEntryActual,
    postshootPaperBeatIds,
    phase: postshootPlan.phase,
    spokenAuthority: postshootPlan.spokenAuthority,
    scriptRole: postshootPlan.scriptRole,
  },
  [files.postshootPlan, files.visualPlan, files.runtimeCandidatePlan],
);

const controlCueById = new Map(
  (Array.isArray(sfxCueSheet.cues) ? sfxCueSheet.cues : []).map((cue) => [
    cue.id,
    cue,
  ]),
);
const controlLayerByCueId = new Map(
  controlLayers.map((layer) => [layer.sound?.cueId, layer]),
);
const runtimeSfxCues = Array.isArray(runtimePlan.sfxCues)
  ? runtimePlan.sfxCues
  : [];
const cueMismatches = [];
for (const runtime of runtimeSfxCues) {
  const controlCue = controlCueById.get(runtime.id);
  const controlLayer = controlLayerByCueId.get(runtime.id);
  if (!controlCue || !controlLayer) {
    cueMismatches.push({id: runtime.id, reason: 'control-binding-missing'});
    continue;
  }
  if (
    runtime.controlLayerId !== controlLayer.id ||
    runtime.visualEventId !== controlCue.visualEventId ||
    runtime.role !== controlCue.role ||
    !nearlyEqual(runtime.time, controlCue.start) ||
    runtime.src !== controlCue.renderSource ||
    !nearlyEqual(runtime.volume, controlCue.volume)
  ) {
    cueMismatches.push({
      id: runtime.id,
      reason: 'runtime-cue-drift',
      control: {
        controlLayerId: controlLayer.id,
        visualEventId: controlCue.visualEventId,
        role: controlCue.role,
        time: controlCue.start,
        src: controlCue.renderSource,
        volume: controlCue.volume,
      },
      runtime,
    });
  }
}

addCheck(
  'runtime-consumes-all-27-sfx-cues',
  sfxCueSheet.cues?.length === 27 &&
    runtimePlan.controlCounts?.sfxCues === 27 &&
    runtimeSfxCues.length === 27 &&
    new Set(runtimeSfxCues.map((cue) => cue.id)).size === 27 &&
    new Set(runtimeSfxCues.map((cue) => cue.controlLayerId)).size === 27 &&
    cueMismatches.length === 0,
  {controlCues: 27, runtimeCues: 27, uniqueVisualBindings: 27},
  {
    controlCues: sfxCueSheet.cues?.length ?? 0,
    declaredRuntimeCues: runtimePlan.controlCounts?.sfxCues ?? null,
    runtimeCues: runtimeSfxCues.length,
    uniqueCueIds: new Set(runtimeSfxCues.map((cue) => cue.id)).size,
    uniqueVisualBindings: new Set(
      runtimeSfxCues.map((cue) => cue.controlLayerId),
    ).size,
    mismatches: cueMismatches,
  },
  [files.sfxCueSheet, files.runtimeCandidatePlan],
);

const publicDir = absolute(job.remotion?.publicDir ?? '');
const sfxPathChecks = runtimeSfxCues.map((cue) => {
  const resolved = path.resolve(publicDir, cue.src ?? '');
  const safeRelativePath =
    typeof cue.src === 'string' &&
    cue.src.startsWith('sfx/') &&
    !path.isAbsolute(cue.src) &&
    !cue.src.split('/').includes('..') &&
    resolved.startsWith(`${publicDir}${path.sep}`);
  return {
    id: cue.id,
    src: cue.src,
    path: relative(resolved),
    safeRelativePath,
    exists: safeRelativePath && existsSync(resolved),
    bytes:
      safeRelativePath && existsSync(resolved) ? statSync(resolved).size : 0,
  };
});
const badSfxPaths = sfxPathChecks.filter(
  (item) => !item.safeRelativePath || !item.exists || item.bytes <= 0,
);
addCheck(
  'all-sfx-resolve-inside-independent-public-dir',
  relative(publicDir) === 'remotion/public-lanzhou-industry-ai-v91-r1' &&
    sfxPathChecks.length === 27 &&
    badSfxPaths.length === 0,
  {
    publicDir: 'remotion/public-lanzhou-industry-ai-v91-r1',
    resolvableSfxFiles: 27,
    traversalOrAbsolutePaths: 0,
  },
  {
    publicDir: relative(publicDir),
    checked: sfxPathChecks.length,
    failed: badSfxPaths,
  },
  [files.productionJob, files.runtimeCandidatePlan],
);

const sourceCaptions = Array.isArray(bilingualCandidate.captions)
  ? bilingualCandidate.captions
  : [];
const publicCaptionPages = Array.isArray(publicCaptions) ? publicCaptions : [];
const captionErrors = [];
for (let index = 0; index < publicCaptionPages.length; index += 1) {
  const page = publicCaptionPages[index];
  if (
    typeof page.zh !== 'string' ||
    !page.zh.trim() ||
    typeof page.en !== 'string' ||
    !page.en.trim() ||
    !Number.isFinite(page.startMs) ||
    !Number.isFinite(page.endMs) ||
    page.endMs <= page.startMs
  ) {
    captionErrors.push({index, id: page.id, reason: 'invalid-bilingual-page'});
  }
  if (index > 0 && page.startMs < publicCaptionPages[index - 1].endMs) {
    captionErrors.push({index, id: page.id, reason: 'caption-overlap'});
  }
}
addCheck(
  '96-page-same-window-bilingual-caption-track',
  bilingualCandidate.pageCount === 96 &&
    sourceCaptions.length === 96 &&
    publicCaptionPages.length === 96 &&
    sameJson(publicCaptionPages, sourceCaptions) &&
    captionErrors.length === 0 &&
    bilingualCandidate.englishTranslationSource ===
      'same-window-recorded-chinese-candidate' &&
    runtimePlan.controlCounts?.captionPages === 96 &&
    runtimePlan.captionsSrc === 'captions.json',
  {
    sourcePages: 96,
    runtimePages: 96,
    everyPageHasZhAndEnInOneWindow: true,
  },
  {
    declaredSourcePages: bilingualCandidate.pageCount,
    sourcePages: sourceCaptions.length,
    runtimePages: publicCaptionPages.length,
    exactCopy: sameJson(publicCaptionPages, sourceCaptions),
    translationSource: bilingualCandidate.englishTranslationSource,
    errors: captionErrors,
  },
  [files.bilingualCandidate, files.publicCaptions, files.runtimeCandidatePlan],
);

const sourceCandidateEffects =
  shotcraftCandidate.shotcraft?.candidateEffects ?? [];
const runtimeEffects = Array.isArray(runtimePlan.effects)
  ? runtimePlan.effects
  : [];
const effect = runtimeEffects[0];
const sourceEffect = sourceCandidateEffects[0];
addCheck(
  'b21-linecarry-is-the-only-shotcraft-candidate',
  shotcraftCandidate.shotcraft?.fullLibraryCoverage?.analyzedCardCount === 157 &&
    sourceCandidateEffects.length === 1 &&
    runtimeEffects.length === 1 &&
    effect?.beatId === 'B21' &&
    effect?.effectId === 'line-carry' &&
    effect?.sourceCard?.cardId === 'line-carry-transition' &&
    effect?.sourceCard?.component === 'LineCarry' &&
    effect?.mainVisual === 'speaker' &&
    effect?.frames?.startFrame === 9090 &&
    effect?.frames?.endFrameExclusive === 9330 &&
    effect?.decisionOrigin === 'human-director-candidate-override' &&
    effect?.candidateOnly === true &&
    sourceEffect?.beatId === effect?.beatId &&
    sourceEffect?.effectId === effect?.effectId &&
    sourceEffect?.component === effect?.sourceCard?.component,
  {
    analyzedCatalogCards: 157,
    runtimeCandidateEffects: 1,
    beatId: 'B21',
    effectId: 'line-carry',
    component: 'LineCarry',
    frames: {startFrame: 9090, endFrameExclusive: 9330},
  },
  {
    analyzedCatalogCards:
      shotcraftCandidate.shotcraft?.fullLibraryCoverage?.analyzedCardCount ??
      null,
    sourceCandidateEffects: sourceCandidateEffects.length,
    runtimeCandidateEffects: runtimeEffects.length,
    effect: effect ?? null,
  },
  [files.shotcraftCandidate, files.runtimeCandidatePlan],
);

const fps = runtimePlan.canvas?.fps ?? 30;
const paperFrameRanges = runtimePaperClips.map((clip) => ({
  id: clip.id,
  startFrame: Math.round(clip.startSeconds * fps),
  endFrameExclusive:
    Math.round(clip.startSeconds * fps) +
    Math.round(clip.durationSeconds * fps),
}));
const effectPaperOverlaps = runtimeEffects.flatMap((item) =>
  paperFrameRanges
    .filter((paper) => overlaps(item.frames, paper))
    .map((paper) => ({effectBeatId: item.beatId, paperId: paper.id})),
);
const b21ControlLayer = runtimeSemanticLayers.find(
  (layer) => layer.id === 'v91-026-b21-start-known',
);
const b21ExpectedSplit = {
  semanticStartFrame: Math.round((b21ControlLayer?.startSeconds ?? 0) * fps),
  semanticEndFrameExclusive: effect?.frames?.startFrame ?? null,
  shotcraftStartFrame: effect?.frames?.startFrame ?? null,
  shotcraftEndFrameExclusive: effect?.frames?.endFrameExclusive ?? null,
};
addCheck(
  'shotcraft-never-overlaps-paper-and-replaces-b21-tail-only',
  effectPaperOverlaps.length === 0 &&
    b21ExpectedSplit.semanticStartFrame === 8850 &&
    b21ExpectedSplit.semanticEndFrameExclusive === 9090 &&
    b21ExpectedSplit.shotcraftStartFrame === 9090 &&
    b21ExpectedSplit.shotcraftEndFrameExclusive === 9330,
  {
    paperOverlapCount: 0,
    b21SemanticSegment: {startFrame: 8850, endFrameExclusive: 9090},
    b21ShotcraftSegment: {startFrame: 9090, endFrameExclusive: 9330},
  },
  {paperOverlaps: effectPaperOverlaps, b21ExpectedSplit},
  [files.runtimeCandidatePlan, files.runtimeComposition],
);

const runtimeStaticRequirements = [
  {
    id: 'imports-runtime-candidate-plan',
    passed: compositionSource.includes(
      "import candidatePlanDocument from './candidate-plan.v1.json'",
    ),
  },
  {
    id: 'builds-paper-scenes-from-plan',
    passed: compositionSource.includes('...plan.paperClips.map<V72CustomScene>'),
  },
  {
    id: 'builds-semantic-scenes-from-plan',
    passed: compositionSource.includes('...semanticScenes.map<V72CustomScene>'),
  },
  {
    id: 'builds-shotcraft-scenes-from-plan',
    passed: compositionSource.includes('...renderableEffects.map<V72CustomScene>'),
  },
  {
    id: 'builds-sfx-from-plan',
    passed:
      compositionSource.includes(
        'const sfxCues: V72SfxCue[] = plan.sfxCues.map',
      ) && compositionSource.includes('sfxCues,'),
  },
  {
    id: 'bilingual-mode-enabled',
    passed: compositionSource.includes("captionMode: 'bilingual'"),
  },
  {
    id: 'paper-clips-muted',
    passed:
      compositionSource.includes('src={staticFile(clip.asset)}') &&
      compositionSource.includes('muted'),
  },
  {
    id: 'linecarry-render-branch-present',
    passed:
      compositionSource.includes("case 'line-carry':") &&
      compositionSource.includes('<LineCarry'),
  },
  {
    id: 'effect-ranges-subtracted-from-v8-layer',
    passed:
      compositionSource.includes('const subtractFrameRanges') &&
      compositionSource.includes(
        'return subtractFrameRanges(layerFrames, effectFrames)',
      ),
  },
  {
    id: 'production-shell-receives-runtime-config',
    passed: compositionSource.includes('<V72ProductionShell') &&
      compositionSource.includes('config={config}'),
  },
  {
    id: 'shell-renders-adaptive-bilingual-overlay',
    passed:
      shellSource.includes('<AdaptiveBilingualCaptionOverlay') &&
      shellSource.includes('captionsSrc={config.captionsSrc}'),
  },
  {
    id: 'overlay-renders-both-zh-and-en',
    passed:
      overlaySource.includes('{parts.map') &&
      overlaySource.includes('{current.en}'),
  },
  {
    id: 'with-and-without-sfx-compositions-registered',
    passed:
      entrySource.includes('LanzhouIndustryAIV91CandidateR1WithSfx') &&
      entrySource.includes('LanzhouIndustryAIV91CandidateR1NoSfx'),
  },
];
addCheck(
  'runtime-code-really-consumes-the-candidate-plan',
  runtimeStaticRequirements.every((item) => item.passed),
  {allRequiredRuntimeBindingsPresent: true},
  {
    bindings: runtimeStaticRequirements,
    failed: runtimeStaticRequirements
      .filter((item) => !item.passed)
      .map((item) => item.id),
  },
  [
    files.runtimeComposition,
    files.runtimeEntry,
    files.productionShell,
    files.bilingualOverlay,
  ],
);

const lockedSourceBindings = runtimePlan.controlSources ?? {};
const lockedSourceChecks = [
  {
    id: 'visualPlan',
    expectedPath: files.visualPlan,
    actual: lockedSourceBindings.visualPlan,
    sha256: documents.visualPlan.binding.sha256,
  },
  {
    id: 'sfxCues',
    expectedPath: files.sfxCueSheet,
    actual: lockedSourceBindings.sfxCues,
    sha256: documents.sfxCueSheet.binding.sha256,
  },
  {
    id: 'shotcraftCandidate',
    expectedPath: files.shotcraftCandidate,
    actual: lockedSourceBindings.shotcraftCandidate,
    sha256: documents.shotcraftCandidate.binding.sha256,
  },
].map((item) => ({
  id: item.id,
  passed:
    item.actual?.path === item.expectedPath &&
    item.actual?.sha256 === item.sha256,
  expectedPath: item.expectedPath,
  expectedSha256: item.sha256,
  actual: item.actual ?? null,
}));
addCheck(
  'runtime-plan-input-hashes-are-current',
  lockedSourceChecks.every((item) => item.passed),
  {allControlBindingsCurrent: true},
  {bindings: lockedSourceChecks},
  [files.runtimeCandidatePlan],
);

const formalLockState = {
  runtimePlanFormalAllowed: runtimePlan.formalAllowed,
  postshootFormalEligible: postshootPlan.formalEligible,
  shotcraftFormalRenderAllowed:
    shotcraftCandidate.gates?.formalRenderAllowed,
  captionsFormalAllowed: bilingualCandidate.formalAllowed,
  captionsUserAudioReviewConfirmed:
    bilingualCandidate.userAudioReviewConfirmed,
  jobFormalEnabled: job.formal?.enabled,
  jobProductionGateFormalEnabled: job.productionGate?.formalEnabled,
  jobUserPreviewApproved: job.experiment?.userPreviewApproved,
  jobFullWatchConfirmed: job.finalReview?.fullWatchConfirmed,
};
addCheck(
  'formal-lock-remains-false',
  Object.values(formalLockState).every((value) => value === false),
  Object.fromEntries(
    Object.keys(formalLockState).map((key) => [key, false]),
  ),
  formalLockState,
  [
    files.runtimeCandidatePlan,
    files.postshootPlan,
    files.shotcraftCandidate,
    files.bilingualCandidate,
    files.productionJob,
  ],
);

const runCommand = (id, executable, args, cwd) => {
  const startedAt = new Date().toISOString();
  const startedNs = process.hrtime.bigint();
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180_000,
    env: {
      ...process.env,
      TMPDIR: commandTempDir,
      XDG_CACHE_HOME: commandCacheDir,
    },
  });
  const elapsedMs = Number(process.hrtime.bigint() - startedNs) / 1_000_000;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  return {
    id,
    command: [executable, ...args],
    cwd: relative(cwd),
    startedAt,
    elapsedMs: Math.round(elapsedMs),
    passed: result.status === 0 && !result.error && !result.signal,
    exitCode: result.status,
    signal: result.signal ?? null,
    error: result.error?.message ?? null,
    stdout: stdout.slice(-12_000),
    stderr: stderr.slice(-12_000),
  };
};

const commandResults = [
  runCommand(
    'node-syntax-check',
    process.execPath,
    ['--check', scriptPath],
    repoRoot,
  ),
  runCommand(
    'typescript-noemit',
    path.join(repoRoot, 'remotion/node_modules/.bin/tsc'),
    [
      '--noEmit',
      '-p',
      'src/lanzhou-industry-ai-v91-candidate-r1/tsconfig.json',
    ],
    path.join(repoRoot, 'remotion'),
  ),
  runCommand(
    'remotion-compositions',
    path.join(repoRoot, 'remotion/node_modules/.bin/remotion'),
    [
      'compositions',
      'src/lanzhou-industry-ai-v91-candidate-r1/index.tsx',
      '--public-dir=public-lanzhou-industry-ai-v91-r1',
      '--bundle-cache=false',
      '--quiet',
    ],
    path.join(repoRoot, 'remotion'),
  ),
];

rmSync(commandTempDir, {recursive: true, force: true});
rmSync(commandCacheDir, {recursive: true, force: true});

const remotionCommand = commandResults.find(
  (item) => item.id === 'remotion-compositions',
);
const expectedCompositionIds = [
  'LanzhouIndustryAIV91CandidateR1WithSfx',
  'LanzhouIndustryAIV91CandidateR1NoSfx',
];
const compositionsFound = expectedCompositionIds.filter((id) =>
  `${remotionCommand?.stdout ?? ''}\n${remotionCommand?.stderr ?? ''}`.includes(
    id,
  ),
);
addCheck(
  'remotion-discovers-withsfx-and-nosfx-compositions',
  remotionCommand?.passed === true && compositionsFound.length === 2,
  {compositionIds: expectedCompositionIds},
  {
    commandPassed: remotionCommand?.passed ?? false,
    compositionIdsFound: compositionsFound,
  },
  [files.runtimeEntry, files.runtimeComposition],
);

const failedChecks = checks.filter((check) => !check.passed);
const failedCommands = commandResults.filter((command) => !command.passed);
const result = {
  schemaVersion: 'lanzhou-industry-ai-runtime-consistency-receipt/v1',
  status:
    failedChecks.length === 0 && failedCommands.length === 0
      ? 'passed-candidate-runtime-consistent-formal-still-locked'
      : 'blocked-runtime-inconsistency',
  validatedAt: new Date().toISOString(),
  scope: {
    project: '20260910_lanzhou_industry_ai',
    revision: runtimePlan.revisionId ?? null,
    purpose:
      '只读核验V9.1导演、V8控制面、Remotion运行时、同窗中英字幕、Shotcraft候选及正式锁；不渲染、不提交Git。',
  },
  summary: {
    activeDirector: `${activeDirector.profileId}@${activeDirector.profileVersion}`,
    activeProduction: `${activeProduction.profileId}@${activeProduction.profileVersion}`,
    v91PaperEntrySeconds: runtimePaperClips.map((clip) => clip.startSeconds),
    controlPrimaryVisualCount: controlLayers.length,
    runtimeSemanticLayerCount: runtimeSemanticLayers.length,
    runtimePaperClipCount: runtimePaperClips.length,
    runtimeSfxCueCount: runtimeSfxCues.length,
    runtimeBilingualCaptionPageCount: publicCaptionPages.length,
    runtimeShotcraftCandidateCount: runtimeEffects.length,
    runtimeShotcraftCandidate:
      effect == null
        ? null
        : {
            beatId: effect.beatId,
            effectId: effect.effectId,
            component: effect.sourceCard?.component,
            frames: effect.frames,
          },
    resolvedSfxFileCount: sfxPathChecks.length - badSfxPaths.length,
    formalLockState,
    failedCheckIds: failedChecks.map((check) => check.id),
    failedCommandIds: failedCommands.map((command) => command.id),
  },
  sourceBindings: Object.fromEntries(
    Object.entries(documents).map(([key, document]) => [key, document.binding]),
  ),
  checks,
  commands: commandResults,
  errors: [
    ...failedChecks.map((check) => ({
      type: 'consistency-check-failed',
      id: check.id,
      expected: check.expected,
      actual: check.actual,
    })),
    ...failedCommands.map((command) => ({
      type: 'command-failed',
      id: command.id,
      exitCode: command.exitCode,
      error: command.error,
      stderr: command.stderr,
    })),
  ],
  gates: {
    candidateRuntimeConsistent:
      failedChecks.length === 0 && failedCommands.length === 0,
    candidateRenderPermittedByThisReceipt:
      failedChecks.length === 0 && failedCommands.length === 0,
    formalRenderPermittedByThisReceipt: false,
    userAudioReviewStillRequired: true,
    userCandidatePlaybackAcceptanceStillRequired: true,
    publicationApproved: false,
  },
};

const receiptBytes = Buffer.from(`${JSON.stringify(result, null, 2)}\n`, 'utf8');
writeFileSync(receiptPath, receiptBytes);
console.log(
  JSON.stringify(
    {
      status: result.status,
      receipt: {
        path: relative(receiptPath),
        sha256: sha256(receiptBytes),
      },
      summary: result.summary,
    },
    null,
    2,
  ),
);

if (result.status !== 'passed-candidate-runtime-consistent-formal-still-locked') {
  process.exitCode = 1;
}
