import React from 'react';
import {
  V72ProductionShell,
  type V72CustomScene,
  type V72ProductionConfig,
  type V72ProductionScene,
  type V72SfxCue,
} from '../components/V72ProductionShell';
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
} from '../components/V8SemanticStage';
import {
  AssembleScene,
  ClosingScene,
  FlowScene,
  OpenSourceScene,
  OverviewScene,
  QaScene,
  SystemScene,
  TaskScene,
} from '../ai-levels-v8/AILevelsV8CardPreview16x9';
import sfxContract from './AILevelsV80.sfx.v1.json';
import visualPlan from './AILevelsV80.visual-plan.v1.json';

const fps = 30;
const durationSeconds = 468.64;
const f = (seconds: number) => Math.round(seconds * fps);

export const AI_LEVELS_V80_DURATION_IN_FRAMES = f(durationSeconds);

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
  sourceVideo: 'media/ai-levels-20260820/main-30fps.mp4',
  captionsSrc: 'data/AI_LEVELS_20260820_talk01.bilingual.v1.json',
  captionVariant: 'transparent-v8',
  captionMode: 'bilingual',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.025) saturate(1.012) brightness(0.998)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.08) 0%, rgba(2,7,12,0.008) 52%, rgba(2,7,12,0.09) 100%)',
  motion: {
    cuts: [...layers.map((layer) => layer.start), durationSeconds],
    baseScale: 1.008,
    peakScales: [1.028, 1.022, 1.032, 1.024, 1.03, 1.023, 1.027, 1.021],
    peakX: [-5, 4, -4, 3, -5, 4, -3, 3],
    peakY: [-2, -1, -2, -1, -2, -1, -2, -1],
    transformOrigin: '50% 43%',
  },
  scenes,
  sfxCues,
};

const detailLeftSafe = (node: React.ReactNode) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      transform: 'translateX(22px) scale(0.98)',
      transformOrigin: 'top left',
      pointerEvents: 'none',
    }}
  >
    {node}
  </div>
);

const panelLeftSafe = (node: React.ReactNode) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      transform: 'translateX(-1044px)',
      pointerEvents: 'none',
    }}
  >
    {node}
  </div>
);

const renderCustomScene = (scene: V72CustomScene) => {
  const layer = scene.data as unknown as PlanLayer;
  switch (scene.customKey) {
    case 'ai-overview':
      return panelLeftSafe(<OverviewScene />);
    case 'ai-qa':
      return panelLeftSafe(<QaScene />);
    case 'ai-task':
      return panelLeftSafe(<TaskScene />);
    case 'ai-flow':
      return panelLeftSafe(<FlowScene />);
    case 'ai-assemble':
      return panelLeftSafe(<AssembleScene />);
    case 'ai-open-source':
      return panelLeftSafe(<OpenSourceScene />);
    case 'ai-system':
      return panelLeftSafe(<SystemScene />);
    case 'ai-closing':
      return panelLeftSafe(<ClosingScene />);
    case 'generated-media':
      return <V8MediaStage layer={layer} />;
    case 'comparison':
      return detailLeftSafe(<V8ComparisonBars layer={layer} />);
    case 'flow':
      return detailLeftSafe(<V8ProcessRail layer={layer} />);
    case 'layer-map':
      return detailLeftSafe(<V8NodeMap layer={layer} />);
    case 'question-grid':
      return detailLeftSafe(<V8QuestionList layer={layer} />);
    case 'status':
      return detailLeftSafe(<V8StatusStack layer={layer} />);
    case 'definition':
      return detailLeftSafe(<V8HeroDefinition layer={layer} />);
    case 'closing':
      return detailLeftSafe(<V8Closing layer={layer} />);
    case 'statement':
    default:
      return detailLeftSafe(<V8DirectStatement layer={layer} />);
  }
};

const AILevelsV80Talk16x9: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
  />
);

export const AILevelsV80Talk16x9WithSfx: React.FC = () => (
  <AILevelsV80Talk16x9 soundEnabled />
);

export const AILevelsV80Talk16x9NoSfx: React.FC = () => (
  <AILevelsV80Talk16x9 soundEnabled={false} />
);
