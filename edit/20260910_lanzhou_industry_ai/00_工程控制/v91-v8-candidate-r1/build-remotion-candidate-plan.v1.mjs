#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const runtimePlanPath = path.join(
  projectRoot,
  'remotion/src/lanzhou-industry-ai-v91-candidate-r1/candidate-plan.v1.json',
);
const visualPlanPath = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/00_工程控制/v91-v8-candidate-r1/visual-plan.v1.json',
);
const sfxCuesPath = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/00_工程控制/v91-v8-candidate-r1/sfx-cues.v1.json',
);
const shotcraftCandidatePath = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/candidate-plan.v1.json',
);
const timingRebindPath = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/timing-rebind-user-direction.v1.json',
);
const controlBuilderPath = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/00_工程控制/v91-v8-candidate-r1/build-v8-control-assets.v1.mjs',
);
const runtimeBuilderPath = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/00_工程控制/v91-v8-candidate-r1/build-remotion-candidate-plan.v1.mjs',
);
const semanticStageSnapshotPath = path.join(
  projectRoot,
  'remotion/src/lanzhou-industry-ai-v91-candidate-r1/V8SemanticStageSnapshot.r2.tsx',
);
const captionsPath = path.join(
  projectRoot,
  'remotion/public-lanzhou-industry-ai-v91-r1/captions.json',
);

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));
const hashFile = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');
const relative = (filePath) =>
  path.relative(projectRoot, filePath).split(path.sep).join('/');

const template = readJson(runtimePlanPath);
const visualPlan = readJson(visualPlanPath);
const sfxCueSheet = readJson(sfxCuesPath);
const shotcraftCandidate = readJson(shotcraftCandidatePath);
const timingRebind = readJson(timingRebindPath);
const captions = readJson(captionsPath);

if (
  visualPlan.layers?.length !== 27 ||
  sfxCueSheet.cues?.length !== 27 ||
  captions.length !== 96 ||
  timingRebind.revisionId !== '20260911-animation-rebind-r2'
) {
  throw new Error('V9.1 / V8 动画重定时控制面数量或修订号不匹配。');
}

const templateSemanticById = new Map(
  template.semanticLayers.map((layer) => [layer.id, layer]),
);
const semanticLayers = visualPlan.layers
  .filter((layer) => layer.kind !== 'full-screen-asset')
  .map((layer) => {
    const previous = templateSemanticById.get(layer.id);
    if (!previous?.component) {
      throw new Error(`缺少 ${layer.id} 的Remotion语义组件绑定。`);
    }
    return {
      id: layer.id,
      beatId: layer.beatId,
      startSeconds: layer.start,
      endSeconds: layer.end,
      component: previous.component,
      controlComponent: layer.params.component,
      semanticFamily: layer.presentation.semanticFamily,
      coverageRatio: layer.presentation.coverageRatio,
      title: layer.title,
      detail: layer.detail,
      items: layer.items ?? [],
    };
  });

const paperClips = visualPlan.layers
  .filter((layer) => layer.kind === 'full-screen-asset')
  .map((layer) => ({
    id: layer.id,
    beatId: layer.beatId,
    asset: layer.params.src,
    startSeconds: layer.start,
    durationSeconds: Number((layer.end - layer.start).toFixed(3)),
    controlEndSeconds: layer.end,
    muteAssetAudio: layer.presentation.muteAssetAudio === true,
    keepCanonicalVoice: layer.presentation.keepCanonicalVoice === true,
  }));

const controlLayerByCueId = new Map(
  visualPlan.layers.map((layer) => [layer.sound.cueId, layer]),
);
const sfxCues = sfxCueSheet.cues.map((cue) => {
  const layer = controlLayerByCueId.get(cue.id);
  if (!layer) throw new Error(`音效 ${cue.id} 缺少主视觉绑定。`);
  return {
    id: cue.id,
    controlLayerId: layer.id,
    visualEventId: cue.visualEventId,
    role: cue.role,
    time: cue.start,
    src: cue.renderSource,
    volume: cue.volume,
  };
});

const sourceBinding = (filePath) => ({
  path: relative(filePath),
  sha256: hashFile(filePath),
});

const runtimePlan = {
  ...template,
  revisionId: '20260911-lanzhou-industry-ai-v91-v8-candidate-animation-r2',
  status: 'candidate-preview-required',
  formalAllowed: false,
  controlSources: {
    visualPlan: sourceBinding(visualPlanPath),
    sfxCues: sourceBinding(sfxCuesPath),
    shotcraftCandidate: sourceBinding(shotcraftCandidatePath),
    timingRebind: sourceBinding(timingRebindPath),
    controlBuilder: sourceBinding(controlBuilderPath),
    runtimeBuilder: sourceBinding(runtimeBuilderPath),
    semanticStageSnapshot: sourceBinding(semanticStageSnapshotPath),
  },
  controlCounts: {
    mainVisuals: visualPlan.layers.length,
    semanticLayers: semanticLayers.length,
    paperClips: paperClips.length,
    sfxCues: sfxCues.length,
    captionPages: captions.length,
  },
  timingRuntime: {
    revisionId: visualPlan.timingRevision.id,
    semanticPrerollFrames: visualPlan.timingRevision.semanticPrerollFrames,
    paperFadeFrames: visualPlan.timingRevision.paperFadeFrames,
  },
  speakerOnlyWindows: visualPlan.speakerOnlyWindows ?? [],
  paperClips,
  semanticLayers,
  effects: template.effects,
  sfxCues,
};

if (
  runtimePlan.effects?.length !== 1 ||
  runtimePlan.effects[0]?.beatId !== 'B21' ||
  runtimePlan.effects[0]?.frames?.startFrame !== 9090 ||
  runtimePlan.effects[0]?.frames?.endFrameExclusive !== 9330 ||
  shotcraftCandidate.shotcraft?.candidateEffects?.[0]?.beatId !== 'B21'
) {
  throw new Error('B21 LineCarry候选合同发生漂移，停止生成。');
}

writeFileSync(runtimePlanPath, `${JSON.stringify(runtimePlan, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      revisionId: runtimePlan.revisionId,
      semanticLayers: semanticLayers.length,
      paperClips: paperClips.length,
      speakerOnlyWindows: runtimePlan.speakerOnlyWindows.length,
      sfxCues: sfxCues.length,
      captionPages: captions.length,
      timingRuntime: runtimePlan.timingRuntime,
    },
    null,
    2,
  ),
);
