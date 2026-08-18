import React from 'react';
import {
  V72ProductionShell,
  type V72CustomScene,
  type V72ProductionConfig,
  type V72ProductionScene,
  type V72SfxCue,
} from './components/V72ProductionShell';
import {
  V8Closing,
  V8ComparisonBars,
  V8DirectStatement,
  V8HeroDefinition,
  V8MediaStage,
  V8NodeMap,
  V8ProcessRail,
  V8QuestionList,
  V8StatusStack,
  type V8SemanticLayer,
} from './components/V8SemanticStage';
import sfxContract from './data/OrdinaryAiAigcV80.sfx.v1.json';
import visualPlan from './data/OrdinaryAiAigcV80.visual-plan.v1.json';

const fps = 30;
const durationSeconds = 793.32;
const f = (seconds: number) => Math.round(seconds * fps);

export const ORDINARY_AI_AIGC_V80_DURATION_IN_FRAMES = f(durationSeconds);

type PlanLayer = V8SemanticLayer & {
  background: 'talk' | 'opaque';
  visualEvent: {id: string; enterAt: number; primary: boolean};
};

const layers = visualPlan.layers as unknown as PlanLayer[];
const scenes: V72ProductionScene[] = layers.map((layer) => ({
  id: layer.id,
  start: layer.start,
  end: layer.end,
  kind: 'custom',
  customKey: layer.params.component,
  data: layer as unknown as Record<string, unknown>,
  background: layer.background,
}));

const sfxCues: V72SfxCue[] = sfxContract.cues.map((cue) => ({
  id: cue.id,
  time: cue.start,
  file: cue.source.split('/').at(-1) ?? cue.id,
  src: cue.source.replace(/^remotion\/public\//, ''),
  volume: cue.volume,
}));

const config: V72ProductionConfig = {
  durationSeconds,
  sourceVideo: 'media/ordinary-ai-aigc-20260818/main-30fps.mp4',
  captionsSrc: 'data/ordinary_ai_aigc_20260818.bilingual.v2.json',
  captionVariant: 'transparent-v8',
  captionMode: 'bilingual',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.024) saturate(1.012) brightness(0.998)',
  sourceOverlay: 'linear-gradient(90deg, rgba(2,7,12,0.16) 0%, rgba(2,7,12,0.035) 38%, rgba(2,7,12,0.006) 100%)',
  motion: {
    cuts: [...layers.map((layer) => layer.start), durationSeconds],
    baseScale: 1.008,
    peakScales: [1.03, 1.024, 1.033, 1.026, 1.031, 1.025, 1.028, 1.024],
    peakX: [-6, 5, -5, 4, -5, 5, -4, 4],
    peakY: [-2, -1, -2, -1, -2, -1, -2, -1],
    transformOrigin: '56% 42%',
  },
  scenes,
  sfxCues,
};

const renderCustomScene = (scene: V72CustomScene) => {
  const layer = scene.data as unknown as PlanLayer;
  switch (scene.customKey) {
    case 'comparison':
      return <V8ComparisonBars layer={layer} />;
    case 'flow':
      return <V8ProcessRail layer={layer} />;
    case 'layer-map':
      return <V8NodeMap layer={layer} />;
    case 'question-grid':
      return <V8QuestionList layer={layer} />;
    case 'status':
      return <V8StatusStack layer={layer} />;
    case 'generated-media':
      return <V8MediaStage layer={layer} />;
    case 'definition':
      return <V8HeroDefinition layer={layer} />;
    case 'closing':
      return <V8Closing layer={layer} />;
    case 'statement':
    default:
      return <V8DirectStatement layer={layer} />;
  }
};

const OrdinaryAiAigcV80Talk16x9: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
  />
);

export const OrdinaryAiAigcV80Talk16x9WithSfx: React.FC = () => (
  <OrdinaryAiAigcV80Talk16x9 soundEnabled />
);

export const OrdinaryAiAigcV80Talk16x9NoSfx: React.FC = () => (
  <OrdinaryAiAigcV80Talk16x9 soundEnabled={false} />
);
