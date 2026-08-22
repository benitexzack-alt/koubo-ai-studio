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
  V8SourceBranches,
  type V8SemanticLayer,
} from './components/V8SemanticStage';
import sfxContract from './data/TrainingCampEpisode2V80.sfx.v1.json';
import visualPlan from './data/TrainingCampEpisode2V80.visual-plan.v1.json';

const fps = 30;
const durationSeconds = 365.833333;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const TRAINING_CAMP_EP2_V80_DURATION_IN_FRAMES = f(durationSeconds);

type PlanLayer = V8SemanticLayer & {
  background: 'talk' | 'opaque';
  visualEvent: {id: string; enterAt: number; primary: boolean};
};
const layers = visualPlan.layers as PlanLayer[];
const scenes: V72ProductionScene[] = layers.map((layer) => ({
  id: layer.id,
  start: layer.start,
  end: layer.end,
  kind: 'custom',
  customKey: layer.params.component,
  data: layer as unknown as Record<string, unknown>,
  background:
    layer.params.component === 'real-media' ||
    layer.params.component === 'generated-media'
      ? 'opaque'
      : 'talk',
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
  sourceVideo: 'media/training-camp-ep2/talk/talk01.mp4',
  captionsSrc: 'data/TRAINING_CAMP_EP2_talk01.bilingual.v1.json',
  captionVariant: 'transparent-v8',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.025) saturate(1.01) brightness(1.005)',
  sourceOverlay: 'linear-gradient(90deg, rgba(2,7,12,0.11) 0%, rgba(2,7,12,0.018) 46%, rgba(2,7,12,0.01) 100%)',
  motion: {
    cuts: layers.map((layer) => layer.start),
    baseScale: 1.012,
    peakScales: [1.052, 1.046, 1.055, 1.049, 1.053],
    peakX: [-8, 6, -5, 7, -6],
    peakY: [-2, -1, -2, -2, -1],
    transformOrigin: '63% 42%',
  },
  scenes,
  sfxCues,
};

export const renderCustomScene = (scene: V72CustomScene) => {
  const layer = scene.data as unknown as PlanLayer;
  switch (scene.customKey) {
    case 'comparison': return <V8ComparisonBars layer={layer} />;
    case 'timeline':
    case 'flow': return <V8ProcessRail layer={layer} />;
    case 'layer-map': return <V8NodeMap layer={layer} />;
    case 'question-grid': return <V8QuestionList layer={layer} />;
    case 'source-branches': return <V8SourceBranches layer={layer} />;
    case 'real-media':
    case 'generated-media': return <V8MediaStage layer={layer} />;
    case 'definition': return <V8HeroDefinition layer={layer} />;
    case 'closing': return <V8Closing layer={layer} />;
    case 'statement':
    default: return <V8DirectStatement layer={layer} />;
  }
};

const ChapterAnchor: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  const chapters = [
    {start: 0, index: '01', title: '国产算力走到哪一步'},
    {start: 70, index: '02', title: '责任链条'},
    {start: 92, index: '03', title: '服务器交付'},
    {start: 116, index: '04', title: '数据要素园'},
    {start: 178, index: '05', title: '四个共同问题'},
    {start: 261, index: '06', title: '五个责任人'},
    {start: 298, index: '07', title: '把作业交出来'},
  ];
  const chapter = [...chapters].reverse().find((item) => seconds >= item.start) ?? chapters[0];
  const reveal = interpolate(seconds - chapter.start, [0, 0.32], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', left: 54, top: 70, zIndex: 215, display: 'flex', alignItems: 'center', gap: 10, color: '#F8FAFD', fontFamily, textShadow: '0 3px 15px rgba(0,0,0,0.96)', opacity: reveal}}>
      <span style={{color: '#68DAFF', fontSize: 28, fontWeight: 950}}>{chapter.index}</span>
      <span style={{width: 34, height: 2, background: '#68DAFF', transform: `scaleX(${reveal})`, transformOrigin: 'left center'}} />
      <span style={{fontSize: 19, fontWeight: 900}}>{chapter.title}</span>
    </div>
  );
};

const TrainingCampEpisode2V80Talk16x9: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <V72ProductionShell config={config} soundEnabled={soundEnabled} renderCustomScene={renderCustomScene} persistentOverlay={<ChapterAnchor />} />
);

export const TrainingCampEpisode2V80Talk16x9WithSfx: React.FC = () => <TrainingCampEpisode2V80Talk16x9 soundEnabled />;
export const TrainingCampEpisode2V80Talk16x9NoSfx: React.FC = () => <TrainingCampEpisode2V80Talk16x9 soundEnabled={false} />;
