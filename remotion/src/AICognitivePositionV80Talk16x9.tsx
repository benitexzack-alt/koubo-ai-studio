import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  V72ProductionShell,
  type V72CustomScene,
  type V72ProductionConfig,
  type V72ProductionScene,
  type V72SfxCue,
} from './components/V72ProductionShell';
import {
  V8ChapterAnchor,
  V8Closing,
  V8ComparisonBars,
  V8DirectStatement,
  V8HeroDefinition,
  V8MediaStage,
  V8NodeMap,
  V8ProcessRail,
  V8QuestionList,
  V8RightsRail,
  V8SourceBranches,
  V8StatusStack,
  type V8SemanticLayer,
} from './components/V8SemanticStage';
import sfxContract from './data/AICognitivePositionV80.sfx.v1.json';
import visualPlan from './data/AICognitivePositionV80.visual-plan.v1.json';

const fps = 30;
const durationSeconds = 305.968005;
const f = (seconds: number) => Math.round(seconds * fps);

export const AI_COGNITIVE_POSITION_V80_DURATION_IN_FRAMES = f(durationSeconds);

type PlanLayer = V8SemanticLayer & {
  background: 'talk' | 'opaque';
  visualEvent: {id: string; enterAt: number; primary: boolean};
  presentation: {
    renderMode: 'speaker-overlay' | 'media-fullscreen';
    semanticFamily: string;
    coverageRatio: number;
    progressiveReveal: boolean;
  };
};

const layers = visualPlan.layers as PlanLayer[];
const scenes: V72ProductionScene[] = layers.map((layer) => ({
  id: layer.id,
  start: layer.start,
  end: layer.end,
  kind: 'custom',
  customKey: layer.params.component,
  data: layer as unknown as Record<string, unknown>,
  background: layer.params.component === 'generated-broll' ? 'opaque' : 'talk',
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
  sourceVideo: 'media/ai-cognitive-position-20260810/main-30fps.mp4',
  captionsSrc: 'data/AI_COGNITIVE_POSITION_20260810_talk01.bilingual.v1.json',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.025) saturate(1.01) brightness(0.995)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.15) 0%, rgba(2,7,12,0.025) 43%, rgba(2,7,12,0.01) 100%)',
  motion: {
    cuts: [
      0,
      13.28,
      34,
      65.16,
      88.7,
      104.44,
      123.72,
      146.64,
      165.34,
      188.64,
      203.92,
      230.18,
      249.62,
      272.7,
      284.34,
      303.88,
    ],
    baseScale: 1.012,
    peakScales: [1.055, 1.048, 1.058, 1.05, 1.054],
    peakX: [-8, 6, -5, 7, -6],
    peakY: [-3, -2, -1, -3, -2],
    transformOrigin: '57% 42%',
  },
  scenes,
  sfxCues,
};

const renderCustomScene = (scene: V72CustomScene) => {
  const layer = scene.data as unknown as PlanLayer;
  switch (scene.customKey) {
    case 'comparison':
      return <V8ComparisonBars layer={layer} />;
    case 'timeline':
    case 'flow':
      return <V8ProcessRail layer={layer} />;
    case 'layer-map':
    case 'feedback-loop':
      return <V8NodeMap layer={layer} />;
    case 'question-grid':
      return <V8QuestionList layer={layer} />;
    case 'four-rights':
      return <V8RightsRail layer={layer} />;
    case 'source-branches':
      return <V8SourceBranches layer={layer} />;
    case 'three-feedbacks':
      return <V8StatusStack layer={layer} />;
    case 'generated-broll':
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

const PersistentChapter: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  return <V8ChapterAnchor timeSeconds={frame / compositionFps} />;
};

const AICognitivePositionV80Talk16x9: React.FC<{soundEnabled: boolean}> = ({
  soundEnabled,
}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
    persistentOverlay={<PersistentChapter />}
  />
);

export const AICognitivePositionV80Talk16x9WithSfx: React.FC = () => (
  <AICognitivePositionV80Talk16x9 soundEnabled />
);

export const AICognitivePositionV80Talk16x9NoSfx: React.FC = () => (
  <AICognitivePositionV80Talk16x9 soundEnabled={false} />
);
