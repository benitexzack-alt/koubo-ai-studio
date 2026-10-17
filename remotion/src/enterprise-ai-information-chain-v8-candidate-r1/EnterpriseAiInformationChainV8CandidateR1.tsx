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
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

type PaperId =
  | 'P01'
  | 'P02'
  | 'P03'
  | 'P04'
  | 'P05'
  | 'P06'
  | 'P07'
  | 'P08'
  | 'P09'
  | 'P10';
type AiId = 'S01' | 'S02';

type CandidateScene = {
  id: string;
  kind: 'paper' | 'ai' | 'screen' | 'semantic' | 'toolkit';
  component?: string;
  start: number;
  end: number;
  title?: string;
  detail?: string;
  items?: string[];
  clipId?: PaperId | AiId;
  trimStart?: number;
};

type CandidatePlan = {
  durationSeconds: number;
  sourceVideo: string;
  screenVideo: string;
  captionsSrc: string;
  brandLabel: string;
  paperVolume: number;
  aiVolumes: Record<AiId, number>;
  chapters: Array<{start: number; index: string; title: string}>;
  scenes: CandidateScene[];
  sfxCues: Array<{id: string; time: number; src: string; volume: number}>;
};

const plan = candidatePlan as CandidatePlan;
export const ENTERPRISE_AI_INFORMATION_CHAIN_R1_DURATION_IN_FRAMES = f(
  plan.durationSeconds,
);

const scenes: V72ProductionScene[] = plan.scenes.map((scene) => ({
  id: scene.id,
  start: scene.start,
  end: scene.end,
  kind: 'custom',
  customKey: scene.kind === 'semantic' ? scene.component ?? 'statement' : scene.kind,
  data: scene as unknown as Record<string, unknown>,
  background: ['paper', 'ai', 'screen'].includes(scene.kind) ? 'opaque' : 'talk',
  zIndex: ['paper', 'ai', 'screen'].includes(scene.kind) ? 180 : 90,
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
  sourceFilter: 'contrast(1.032) saturate(1.018) brightness(1.004)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.17) 0%, rgba(2,7,12,0.02) 44%, rgba(2,7,12,0.015) 100%)',
  motion: {
    cuts: [...plan.scenes.map((scene) => scene.start), plan.durationSeconds],
    baseScale: 1.008,
    peakScales: [1.032, 1.026, 1.035, 1.028, 1.033, 1.027],
    peakX: [-8, 5, -6, 4, -7, 5],
    peakY: [-2, -1, -2, -1, -2, -1],
    transformOrigin: '51% 43%',
  },
  scenes,
  sfxCues,
};

const sceneOpacity = (frame: number, durationInFrames: number) => {
  const fade = Math.min(9, Math.max(5, Math.round(durationInFrames * 0.06)));
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

const PaperScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#071018',
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 72,
          bottom: 0,
          overflow: 'hidden',
          background: '#D1B27C',
        }}
      >
        <Video
          src={staticFile(
            `media/enterprise-ai-information-chain-20260826-r1/${scene.clipId}.mp4`,
          )}
          volume={plan.paperVolume}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 48,
          top: 27,
          color: '#FFC45E',
          fontFamily,
          fontSize: 15,
          fontWeight: 900,
        }}
      >
        纸艺语义镜头 · 原声保留
      </div>
    </AbsoluteFill>
  );
};

const AiScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const durationInFrames = f(scene.end - scene.start);
  const reveal = spring({
    frame: frame - 4,
    fps: compositionFps,
    config: {damping: 24, stiffness: 176, mass: 0.86},
  });
  const clipId = scene.clipId as AiId;
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#03070B',
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <Video
        src={staticFile(
          `media/enterprise-ai-information-chain-20260826-r1/${clipId === 'S01' ? 'S01_scattered-data' : 'S02_hot-dish-signal'}.mp4`,
        )}
        volume={plan.aiVolumes[clipId]}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'contrast(1.025) saturate(0.98) brightness(0.9)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.9) 0%, rgba(2,7,12,0.48) 36%, rgba(2,7,12,0.04) 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 178,
          width: 700,
          color: '#F8FAFD',
          fontFamily,
          textShadow: '0 5px 24px rgba(0,0,0,0.98)',
          transform: `translateX(${interpolate(reveal, [0, 1], [-28, 0])}px)`,
        }}
      >
        <div style={{color: '#68DAFF', fontSize: 19, fontWeight: 950}}>
          AI生成 · 场景演绎
        </div>
        <div
          style={{
            marginTop: 15,
            fontSize: 52,
            lineHeight: 1.06,
            fontWeight: 950,
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            marginTop: 18,
            paddingLeft: 15,
            borderLeft: '5px solid #FFC45E',
            color: 'rgba(248,250,253,0.88)',
            fontSize: 25,
            lineHeight: 1.28,
            fontWeight: 820,
          }}
        >
          {scene.detail}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ScreenScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const durationInFrames = f(scene.end - scene.start);
  const reveal = spring({
    frame: frame - 3,
    fps: compositionFps,
    config: {damping: 24, stiffness: 180, mass: 0.86},
  });
  const source = staticFile(plan.screenVideo);
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#04080D',
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <Video
        src={source}
        muted
        trimBefore={f(scene.trimStart ?? 0)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'blur(26px) brightness(0.3) saturate(0.8)',
          transform: 'scale(1.12)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(3,8,13,0.3) 0%, rgba(3,8,13,0.06) 52%, rgba(3,8,13,0.58) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 92,
          right: 92,
          top: 92,
          bottom: 126,
          overflow: 'hidden',
          background: '#020406',
          boxShadow: '0 0 0 2px rgba(104,218,255,0.38), 0 28px 72px rgba(0,0,0,0.64)',
        }}
      >
        <Video
          src={source}
          muted
          trimBefore={f(scene.trimStart ?? 0)}
          style={{width: '100%', height: '100%', objectFit: 'contain'}}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 92,
          width: 660,
          padding: '18px 22px 20px',
          boxSizing: 'border-box',
          color: '#F8FAFD',
          background: 'rgba(3,10,16,0.88)',
          borderLeft: '6px solid #68DAFF',
          fontFamily,
          textShadow: '0 4px 18px rgba(0,0,0,0.94)',
          transform: `translateX(${interpolate(reveal, [0, 1], [-24, 0])}px)`,
        }}
      >
        <div style={{color: '#68DAFF', fontSize: 17, fontWeight: 950}}>
          真实系统录屏
        </div>
        <div style={{marginTop: 9, fontSize: 36, lineHeight: 1.06, fontWeight: 950}}>
          {scene.title}
        </div>
        <div
          style={{
            marginTop: 10,
            color: 'rgba(248,250,253,0.82)',
            fontSize: 20,
            lineHeight: 1.28,
            fontWeight: 800,
          }}
        >
          {scene.detail}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ToolkitScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const items = scene.items ?? [];
  const reveal = spring({
    frame: frame - 2,
    fps: compositionFps,
    config: {damping: 22, stiffness: 184, mass: 0.84},
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 160,
        width: 790,
        color: '#F8FAFD',
        fontFamily,
        textShadow: '0 4px 19px rgba(0,0,0,0.96)',
        transform: `translateX(${interpolate(reveal, [0, 1], [-28, 0])}px)`,
      }}
    >
      <div style={{color: '#68DAFF', fontSize: 20, fontWeight: 950}}>
        已整理 · 可按行业修改
      </div>
      <div style={{marginTop: 14, fontSize: 49, lineHeight: 1.07, fontWeight: 950}}>
        {scene.title}
      </div>
      <div
        style={{
          marginTop: 13,
          color: 'rgba(248,250,253,0.86)',
          fontSize: 24,
          lineHeight: 1.28,
          fontWeight: 820,
        }}
      >
        {scene.detail}
      </div>
      <div style={{marginTop: 22, display: 'grid', gap: 12}}>
        {items.map((item, index) => {
          const itemReveal = spring({
            frame: frame - 9 - index * 7,
            fps: compositionFps,
            config: {damping: 22, stiffness: 190, mass: 0.82},
          });
          return (
            <div
              key={item}
              style={{
                display: 'flex',
                alignItems: 'center',
                minHeight: 62,
                padding: '0 18px',
                background: 'rgba(5,14,22,0.72)',
                borderLeft: `6px solid ${index === 2 ? '#FFC45E' : '#68DAFF'}`,
                boxShadow: '0 15px 35px rgba(0,0,0,0.28)',
                fontSize: 26,
                fontWeight: 900,
                opacity: itemReveal,
                transform: `translateX(${interpolate(itemReveal, [0, 1], [-18, 0])}px)`,
              }}
            >
              <span style={{color: '#68DAFF', marginRight: 14}}>
                {String(index + 1).padStart(2, '0')}
              </span>
              {item}
            </div>
          );
        })}
      </div>
    </div>
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

const renderCustomScene = (wrappedScene: V72CustomScene) => {
  const scene = wrappedScene.data as unknown as CandidateScene;
  if (scene.kind === 'paper') return <PaperScene scene={scene} />;
  if (scene.kind === 'ai') return <AiScene scene={scene} />;
  if (scene.kind === 'screen') return <ScreenScene scene={scene} />;
  if (scene.kind === 'toolkit') return <ToolkitScene scene={scene} />;

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
      ['paper', 'ai', 'screen'].includes(scene.kind) &&
      seconds >= scene.start &&
      seconds < scene.end,
  );
  if (opaqueScene) return null;

  const chapter =
    [...plan.chapters].reverse().find((item) => seconds >= item.start) ??
    plan.chapters[0];
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

export const EnterpriseAiInformationChainV8CandidateR1WithSfx: React.FC = () => (
  <V72ProductionShell
    config={config}
    soundEnabled
    renderCustomScene={renderCustomScene}
    persistentOverlay={<ChapterAnchor />}
  />
);
