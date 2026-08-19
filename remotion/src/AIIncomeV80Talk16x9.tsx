import React from 'react';
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
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
import sfxContract from './data/AIIncomeV80.sfx.v1.json';
import visualPlan from './data/AIIncomeV80.visual-plan.v1.json';

const fps = 30;
const durationSeconds = 365.6;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const AI_INCOME_V80_DURATION_IN_FRAMES = f(durationSeconds);
export const AI_INCOME_V80_PREVIEW_45S_DURATION_IN_FRAMES = f(45);

type EvidenceClip = {
  src: string;
  label: string;
  note: string;
};

type PlanLayer = V8SemanticLayer & {
  background: 'talk' | 'opaque';
  visualEvent: {id: string; enterAt: number; primary: boolean};
  params: V8SemanticLayer['params'] & {
    evidenceClips?: EvidenceClip[];
  };
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
  sourceVideo: 'media/ai-income-20260819/main-30fps.mp4',
  captionsSrc: 'data/AI_INCOME_20260819_talk01.bilingual.v1.json',
  captionVariant: 'transparent-v8',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.025) saturate(1.018) brightness(0.998)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.17) 0%, rgba(2,7,12,0.035) 42%, rgba(2,7,12,0.006) 100%)',
  motion: {
    cuts: [...layers.map((layer) => layer.start), durationSeconds],
    baseScale: 1.008,
    peakScales: [1.03, 1.025, 1.034, 1.027, 1.032, 1.026],
    peakX: [-6, 5, -5, 4, -4, 5],
    peakY: [-2, -1, -2, -1, -2, -1],
    transformOrigin: '68% 43%',
  },
  scenes,
  sfxCues,
};

const EvidenceCarousel: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps, durationInFrames} = useVideoConfig();
  const clips = layer.params.evidenceClips ?? [];
  if (clips.length === 0) return null;
  const slotFrames = Math.max(1, durationInFrames / clips.length);
  const activeIndex = Math.min(
    clips.length - 1,
    Math.floor(frame / slotFrames),
  );
  const localFrame = frame - activeIndex * slotFrames;
  const reveal = spring({
    frame: localFrame,
    fps: compositionFps,
    config: {damping: 22, stiffness: 182, mass: 0.84},
  });
  const sceneOpacity = Math.min(
    interpolate(frame, [0, 8], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(8, durationInFrames - 8), durationInFrames],
      [1, 0],
      clamp,
    ),
  );
  const clip = clips[activeIndex];

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 118,
        width: 760,
        height: 770,
        color: '#F8FAFD',
        fontFamily,
        textShadow: '0 4px 19px rgba(0,0,0,0.96)',
        opacity: sceneOpacity,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#68DAFF',
          fontSize: 17,
          fontWeight: 950,
        }}
      >
        <span
          style={{
            width: 26,
            height: 3,
            background: '#68DAFF',
            boxShadow: '0 0 13px rgba(104,218,255,0.7)',
          }}
        />
        真实投入记录
      </div>
      <div
        style={{
          marginTop: 13,
          width: 730,
          fontSize: 38,
          lineHeight: 1.08,
          fontWeight: 950,
        }}
      >
        {layer.title}
      </div>
      <div
        style={{
          marginTop: 12,
          width: 720,
          color: 'rgba(248,250,253,0.76)',
          fontSize: 19,
          lineHeight: 1.25,
          fontWeight: 800,
        }}
      >
        {layer.detail}
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: 18,
          width: 720,
          height: 490,
          overflow: 'hidden',
          borderRadius: 6,
          border: '1px solid rgba(104,218,255,0.42)',
          background: 'rgba(3,10,16,0.56)',
          boxShadow: '0 16px 46px rgba(0,0,0,0.34)',
          transform: `translateX(${interpolate(reveal, [0, 1], [-18, 0])}px) scale(${interpolate(reveal, [0, 1], [0.985, 1])})`,
          opacity: reveal,
        }}
      >
        <Img
          key={clip.src}
          src={staticFile(clip.src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            background: '#071018',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            minHeight: 72,
            padding: '10px 16px',
            boxSizing: 'border-box',
            background:
              'linear-gradient(180deg, rgba(2,7,12,0.02), rgba(2,7,12,0.92) 34%)',
          }}
        >
          <div style={{fontSize: 22, fontWeight: 950}}>{clip.label}</div>
          <div
            style={{
              marginTop: 4,
              color: '#FFC45E',
              fontSize: 17,
              fontWeight: 900,
            }}
          >
            {clip.note}
          </div>
        </div>
      </div>
      <div style={{display: 'flex', gap: 8, marginTop: 12}}>
        {clips.map((item, index) => (
          <span
            key={item.src}
            style={{
              width: index === activeIndex ? 34 : 12,
              height: 4,
              background:
                index === activeIndex ? '#68DAFF' : 'rgba(255,255,255,0.24)',
              transition: 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
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
    case 'evidence-carousel':
      return <EvidenceCarousel layer={layer} />;
    case 'definition':
      return <V8HeroDefinition layer={layer} />;
    case 'closing':
      return <V8Closing layer={layer} />;
    case 'statement':
    default:
      return <V8DirectStatement layer={layer} />;
  }
};

const IncomeChapter: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  const chapters = [
    {start: 0, index: '01', title: '真实答案'},
    {start: 32, index: '02', title: '两条路径'},
    {start: 64.4, index: '03', title: '真实投入'},
    {start: 118.6, index: '04', title: '现有工作'},
    {start: 190.6, index: '05', title: '全职之前'},
    {start: 267.6, index: '06', title: '真实验证'},
    {start: 339.6, index: '07', title: '第九回'},
  ];
  const chapter =
    [...chapters].reverse().find((item) => seconds >= item.start) ?? chapters[0];
  const reveal = interpolate(seconds - chapter.start, [0, 0.32], [0, 1], clamp);

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

const AIIncomeV80Talk16x9: React.FC<{soundEnabled: boolean}> = ({
  soundEnabled,
}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
    persistentOverlay={<IncomeChapter />}
  />
);

export const AIIncomeV80Talk16x9WithSfx: React.FC = () => (
  <AIIncomeV80Talk16x9 soundEnabled />
);

export const AIIncomeV80Talk16x9NoSfx: React.FC = () => (
  <AIIncomeV80Talk16x9 soundEnabled={false} />
);
