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
import {
  V8BestWorstPrimitiveStage,
  type V8BestWorstPrimitive,
} from './components/V8BestWorstPrimitives';
import sfxContract from './data/AIBestWorstV80.sfx.v1.json';
import visualPlan from './data/AIBestWorstV80.visual-plan.v1.json';

const fps = 30;
const durationSeconds = 525.234;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const AI_BEST_WORST_V80_DURATION_IN_FRAMES = f(durationSeconds);

type AIBestWorstParams = V8SemanticLayer['params'] & {
  primitive?: V8BestWorstPrimitive;
  evidenceSrc?: string;
  evidenceLabel?: string;
};

type PlanLayer = Omit<V8SemanticLayer, 'params'> & {
  params: AIBestWorstParams;
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
  background: layer.params.component === 'generated-media' ? 'opaque' : 'talk',
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
  sourceVideo: 'media/ai-best-worst-20260812/main-30fps.mp4',
  captionsSrc: 'data/AI_BEST_WORST_20260812_talk01.bilingual.v1.json',
  captionVariant: 'transparent-v8',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.022) saturate(1.012) brightness(0.998)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.18) 0%, rgba(2,7,12,0.035) 39%, rgba(2,7,12,0.005) 100%)',
  motion: {
    cuts: [...layers.map((layer) => layer.start), durationSeconds],
    baseScale: 1.008,
    peakScales: [1.032, 1.025, 1.034, 1.027, 1.033, 1.029],
    peakX: [-7, 5, -5, 4, -6, 5],
    peakY: [-2, -1, -2, -1, -2, -1],
    transformOrigin: '56% 42%',
  },
  scenes,
  sfxCues,
};

const EvidenceOverlay: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps: compositionFps} = useVideoConfig();
  const reveal = spring({
    frame: frame - 2,
    fps: compositionFps,
    config: {damping: 23, stiffness: 178, mass: 0.86},
  });
  const fade = Math.min(
    interpolate(frame, [0, 8], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(8, durationInFrames - 8), durationInFrames],
      [1, 0],
      clamp,
    ),
  );
  const source = layer.params.evidenceSrc;
  if (!source) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 128,
        width: 690,
        height: 590,
        display: 'grid',
        gridTemplateColumns: '308px 1fr',
        gap: 24,
        alignItems: 'center',
        color: '#F8FAFD',
        fontFamily,
        textShadow: '0 4px 19px rgba(0,0,0,0.96)',
        opacity: fade,
        transform: `translateX(${interpolate(reveal, [0, 1], [-24, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 308,
          height: 448,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          background: 'rgba(4,12,18,0.56)',
          borderLeft: '5px solid #68DAFF',
          boxShadow: '0 18px 48px rgba(0,0,0,0.38)',
        }}
      >
        <Img
          src={staticFile(source)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            background: '#F7F8FA',
          }}
        />
      </div>
      <div style={{alignSelf: 'center'}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            color: '#68DAFF',
            fontSize: 16,
            fontWeight: 950,
          }}
        >
          <span style={{width: 24, height: 3, background: '#68DAFF'}} />
          原始出处
        </div>
        <div
          style={{
            marginTop: 15,
            fontSize: [...layer.title].length > 16 ? 36 : 42,
            lineHeight: 1.1,
            fontWeight: 950,
          }}
        >
          {layer.title}
        </div>
        <div
          style={{
            marginTop: 16,
            color: 'rgba(248,250,253,0.78)',
            fontSize: 20,
            lineHeight: 1.3,
            fontWeight: 820,
          }}
        >
          {layer.detail}
        </div>
        <div style={{marginTop: 20, display: 'grid', gap: 9}}>
          {layer.items.slice(0, 3).map((item, index) => {
            const itemReveal = interpolate(
              frame,
              [9 + index * 7, 21 + index * 7],
              [0, 1],
              clamp,
            );
            return (
              <div
                key={item}
                style={{
                  paddingLeft: 13,
                  borderLeft: `4px solid ${index === 2 ? '#FFC45E' : '#65D69A'}`,
                  fontSize: 19,
                  lineHeight: 1.2,
                  fontWeight: 900,
                  opacity: itemReveal,
                }}
              >
                {item}
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 22,
            color: '#FFC45E',
            fontSize: 15,
            lineHeight: 1.25,
            fontWeight: 900,
          }}
        >
          {layer.params.evidenceLabel}
        </div>
      </div>
    </div>
  );
};

const renderCustomScene = (scene: V72CustomScene) => {
  const layer = scene.data as unknown as PlanLayer;
  switch (scene.customKey) {
    case 'primitive':
      return layer.params.primitive ? (
        <V8BestWorstPrimitiveStage scene={layer.params.primitive} />
      ) : null;
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
    case 'evidence':
      return <EvidenceOverlay layer={layer} />;
    case 'definition':
      return <V8HeroDefinition layer={layer} />;
    case 'closing':
      return <V8Closing layer={layer} />;
    case 'statement':
    default:
      return <V8DirectStatement layer={layer} />;
  }
};

const AIBestWorstChapter: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  if (seconds < 55.58) return null;
  const chapters = [
    {start: 55.58, index: '02', title: '增强还是替代'},
    {start: 153.63, index: '03', title: '人的成长位置'},
    {start: 249.77, index: '04', title: '任务与就业'},
    {start: 321.71, index: '05', title: '生产率J曲线'},
    {start: 410.58, index: '06', title: '三本账与行动'},
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

const AIBestWorstV80Talk16x9: React.FC<{soundEnabled: boolean}> = ({
  soundEnabled,
}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
    persistentOverlay={<AIBestWorstChapter />}
  />
);

export const AIBestWorstV80Talk16x9WithSfx: React.FC = () => (
  <AIBestWorstV80Talk16x9 soundEnabled />
);

export const AIBestWorstV80Talk16x9NoSfx: React.FC = () => (
  <AIBestWorstV80Talk16x9 soundEnabled={false} />
);
