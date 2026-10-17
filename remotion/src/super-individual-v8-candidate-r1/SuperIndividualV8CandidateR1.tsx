import {Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
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
} from '../components/V72ProductionShell';
import {
  V8Closing,
  V8ComparisonBars,
  V8DirectStatement,
  V8HeroDefinition,
  V8ProcessRail,
  V8StatusStack,
  type V8SemanticLayer,
} from '../components/V8SemanticStage';
import candidatePlan from './candidate-plan.v1.json';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

type ClipId =
  | 'PV01'
  | 'PV02'
  | 'PV03'
  | 'PV04'
  | 'PV05'
  | 'PV06'
  | 'PV07'
  | 'PV08'
  | 'PV09'
  | 'PV10'
  | 'AV01'
  | 'AV02';

type CandidateScene = {
  id: string;
  kind: 'paper' | 'ai' | 'semantic';
  component?: string;
  start: number;
  end: number;
  title?: string;
  detail?: string;
  items?: string[];
  clipId?: ClipId;
};

type CandidatePlan = {
  durationSeconds: number;
  sourceVideo: string;
  captionsSrc: string;
  brandLabel: string;
  paperVolume: number;
  aiVolume: number;
  chapters: Array<{start: number; index: string; title: string}>;
  scenes: CandidateScene[];
  sfxCues: Array<{id: string; time: number; src: string; volume: number}>;
};

const plan = candidatePlan as CandidatePlan;
export const SUPER_INDIVIDUAL_R1_DURATION_IN_FRAMES = f(plan.durationSeconds);

const scenes: V72ProductionScene[] = plan.scenes.map((scene) => ({
  id: scene.id,
  start: scene.start,
  end: scene.end,
  kind: 'custom',
  customKey: scene.kind === 'semantic' ? scene.component ?? 'statement' : scene.kind,
  data: scene as unknown as Record<string, unknown>,
  background: ['paper', 'ai'].includes(scene.kind) ? 'opaque' : 'talk',
  zIndex: ['paper', 'ai'].includes(scene.kind) ? 180 : 90,
}));

const sfxCues: V72SfxCue[] = plan.sfxCues.map((cue) => ({
  id: cue.id,
  time: cue.time,
  file: cue.src.split('/').at(-1) ?? cue.id,
  src: cue.src,
  volume: cue.volume,
}));

const config: V72ProductionConfig = {
  durationSeconds: plan.durationSeconds,
  sourceVideo: plan.sourceVideo,
  captionsSrc: plan.captionsSrc,
  captionVariant: 'transparent-v8',
  captionMode: 'bilingual',
  brandLabel: plan.brandLabel,
  sourceFilter: 'contrast(1.035) saturate(1.02) brightness(1.006)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.17) 0%, rgba(2,7,12,0.015) 46%, rgba(2,7,12,0.02) 100%)',
  motion: {
    cuts: [...plan.scenes.map((scene) => scene.start), plan.durationSeconds],
    baseScale: 1.008,
    peakScales: [1.034, 1.028, 1.037, 1.029, 1.035, 1.03],
    peakX: [-9, 6, -7, 5, -8, 6],
    peakY: [-2, -1, -2, -1, -2, -1],
    transformOrigin: '50% 43%',
  },
  scenes,
  sfxCues,
};

const sceneOpacity = (frame: number, durationInFrames: number) => {
  const fade = Math.min(8, Math.max(4, Math.round(durationInFrames * 0.05)));
  return Math.min(
    interpolate(frame, [0, fade], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(fade, durationInFrames - fade), durationInFrames],
      [1, 0],
      clamp,
    ),
  );
};

const ExactMeaningCard: React.FC<{scene: CandidateScene; side: 'left' | 'right'}> = ({
  scene,
  side,
}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const reveal = spring({
    frame: frame - 4,
    fps: compositionFps,
    config: {damping: 23, stiffness: 184, mass: 0.84},
  });
  return (
    <div
      style={{
        position: 'absolute',
        [side]: 54,
        top: 132,
        width: 680,
        boxSizing: 'border-box',
        padding: '26px 28px 28px',
        color: '#F7FAFC',
        fontFamily,
        background: 'rgba(3,10,17,0.82)',
        borderLeft: side === 'left' ? '6px solid #68DAFF' : undefined,
        borderRight: side === 'right' ? '6px solid #68DAFF' : undefined,
        boxShadow: '0 20px 58px rgba(0,0,0,0.42)',
        textShadow: '0 4px 18px rgba(0,0,0,0.9)',
        opacity: reveal,
        transform: `translateX(${interpolate(reveal, [0, 1], [side === 'left' ? -28 : 28, 0])}px)`,
      }}
    >
      <div style={{color: '#68DAFF', fontSize: 17, fontWeight: 950}}>
        {scene.clipId} · 核心含义
      </div>
      <div style={{marginTop: 12, fontSize: 49, lineHeight: 1.08, fontWeight: 950}}>
        {scene.title}
      </div>
      <div
        style={{
          marginTop: 14,
          color: 'rgba(247,250,252,0.86)',
          fontSize: 23,
          lineHeight: 1.3,
          fontWeight: 820,
        }}
      >
        {scene.detail}
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20}}>
        {(scene.items ?? []).map((item, index) => {
          const itemReveal = spring({
            frame: frame - 10 - index * 5,
            fps: compositionFps,
            config: {damping: 22, stiffness: 190, mass: 0.82},
          });
          return (
            <div
              key={item}
              style={{
                minWidth: 114,
                padding: '10px 14px',
                color: index === 0 ? '#071018' : '#F7FAFC',
                background: index === 0 ? '#FFC45E' : 'rgba(104,218,255,0.15)',
                border: index === 0 ? 'none' : '1px solid rgba(104,218,255,0.46)',
                fontSize: 21,
                fontWeight: 900,
                textAlign: 'center',
                opacity: itemReveal,
                transform: `translateY(${interpolate(itemReveal, [0, 1], [12, 0])}px)`,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GeneratedScene: React.FC<{
  scene: CandidateScene;
  generatedSoundEnabled: boolean;
}> = ({scene, generatedSoundEnabled}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  const numericId = Number(scene.clipId?.slice(2) ?? 1);
  const side = numericId % 2 === 0 ? 'right' : 'left';
  const volume = generatedSoundEnabled
    ? scene.kind === 'paper'
      ? plan.paperVolume
      : plan.aiVolume
    : 0;
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#03070B',
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <Video
        src={staticFile(`media/super-individual-20260828-r1/${scene.clipId}.mp4`)}
        volume={volume}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter:
            scene.kind === 'paper'
              ? 'contrast(1.02) saturate(0.98) brightness(0.93)'
              : 'contrast(1.03) saturate(0.96) brightness(0.82)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            side === 'left'
              ? 'linear-gradient(90deg, rgba(2,7,12,0.58) 0%, rgba(2,7,12,0.08) 52%, rgba(2,7,12,0.02) 100%)'
              : 'linear-gradient(270deg, rgba(2,7,12,0.58) 0%, rgba(2,7,12,0.08) 52%, rgba(2,7,12,0.02) 100%)',
        }}
      />
      <ExactMeaningCard scene={scene} side={side} />
    </AbsoluteFill>
  );
};

const semanticLayer = (scene: CandidateScene): V8SemanticLayer => ({
  id: scene.id,
  start: scene.start,
  end: scene.end,
  title: scene.title ?? '',
  detail: scene.detail ?? '',
  items: scene.items ?? [],
  params: {component: scene.component ?? 'statement'},
});

const makeCustomRenderer = (generatedSoundEnabled: boolean) =>
  (wrappedScene: V72CustomScene) => {
    const scene = wrappedScene.data as unknown as CandidateScene;
    if (scene.kind === 'paper' || scene.kind === 'ai') {
      return (
        <GeneratedScene scene={scene} generatedSoundEnabled={generatedSoundEnabled} />
      );
    }

    const layer = semanticLayer(scene);
    switch (scene.component) {
      case 'comparison':
        return <V8ComparisonBars layer={layer} />;
      case 'process':
        return <V8ProcessRail layer={layer} />;
      case 'definition':
        return <V8HeroDefinition layer={layer} />;
      case 'status':
        return <V8StatusStack layer={layer} />;
      case 'closing':
        return <V8Closing layer={layer} />;
      case 'statement':
      default:
        return <V8DirectStatement layer={layer} />;
    }
  };

const ChapterAnchor: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  const opaqueScene = plan.scenes.find(
    (scene) =>
      ['paper', 'ai'].includes(scene.kind) &&
      seconds >= scene.start &&
      seconds < scene.end,
  );
  if (opaqueScene) return null;

  const chapter =
    [...plan.chapters].reverse().find((item) => seconds >= item.start) ??
    plan.chapters[0];
  const reveal = interpolate(seconds - chapter.start, [0, 0.3], [0, 1], clamp);
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
      <span style={{width: 34, height: 2, background: '#68DAFF'}} />
      <span style={{fontSize: 19, fontWeight: 900}}>{chapter.title}</span>
    </div>
  );
};

const Candidate: React.FC<{
  soundEnabled: boolean;
  generatedSoundEnabled: boolean;
}> = ({soundEnabled, generatedSoundEnabled}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={makeCustomRenderer(generatedSoundEnabled)}
    persistentOverlay={<ChapterAnchor />}
  />
);

export const SuperIndividualV8CandidateR1WithSfx: React.FC = () => (
  <Candidate soundEnabled generatedSoundEnabled />
);

export const SuperIndividualV8CandidateR1NoSfx: React.FC = () => (
  <Candidate soundEnabled={false} generatedSoundEnabled />
);

