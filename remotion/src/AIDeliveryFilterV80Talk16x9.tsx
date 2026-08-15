import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
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
import sfxContract from './data/AIDeliveryFilterV80.sfx.v1.json';
import visualPlan from './data/AIDeliveryFilterV80.visual-plan.v1.json';

const fps = 30;
const durationSeconds = 332.333;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const AI_DELIVERY_FILTER_V80_DURATION_IN_FRAMES = f(durationSeconds);

type PlanLayer = Omit<V8SemanticLayer, 'params'> & {
  params: V8SemanticLayer['params'];
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
  sourceVideo: 'media/ai-delivery-filter-20260815/main-30fps.mp4',
  captionsSrc:
    'data/AI_DELIVERY_FILTER_20260815_talk01.bilingual.v1.json',
  captionVariant: 'transparent-v8',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.024) saturate(1.012) brightness(0.998)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.17) 0%, rgba(2,7,12,0.038) 38%, rgba(2,7,12,0.006) 100%)',
  motion: {
    cuts: [...layers.map((layer) => layer.start), durationSeconds],
    baseScale: 1.008,
    peakScales: [1.03, 1.024, 1.033, 1.026, 1.031, 1.025],
    peakX: [-6, 5, -5, 4, -5, 5],
    peakY: [-2, -1, -2, -1, -2, -1],
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

const AIDeliveryFilterChapter: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  if (seconds < 84.45) return null;

  const chapters = [
    {start: 84.45, index: '01', title: '可交付'},
    {start: 127.7, index: '02', title: '付出成本'},
    {start: 168.68, index: '03', title: '沉出共性'},
    {start: 215.8, index: '04', title: '失败处理'},
    {start: 260.59, index: '05', title: '生意答案'},
  ];
  const chapter =
    [...chapters].reverse().find((item) => seconds >= item.start) ??
    chapters[0];
  const reveal = interpolate(
    seconds - chapter.start,
    [0, 0.32],
    [0, 1],
    clamp,
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 70,
        zIndex: 215,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: '#F8FAFD',
        fontFamily,
        textShadow: '0 3px 15px rgba(0,0,0,0.96)',
        opacity: reveal,
      }}
    >
      <span style={{color: '#68DAFF', fontSize: 28, fontWeight: 950}}>
        {chapter.index}
      </span>
      <span
        style={{
          width: 34,
          height: 2,
          background: '#68DAFF',
          transform: `scaleX(${reveal})`,
          transformOrigin: 'left center',
        }}
      />
      <span style={{fontSize: 19, fontWeight: 900}}>{chapter.title}</span>
    </div>
  );
};

const AIDeliveryFilterV80Talk16x9: React.FC<{soundEnabled: boolean}> = ({
  soundEnabled,
}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
    persistentOverlay={<AIDeliveryFilterChapter />}
  />
);

export const AIDeliveryFilterV80Talk16x9WithSfx: React.FC = () => (
  <AIDeliveryFilterV80Talk16x9 soundEnabled />
);

export const AIDeliveryFilterV80Talk16x9NoSfx: React.FC = () => (
  <AIDeliveryFilterV80Talk16x9 soundEnabled={false} />
);
