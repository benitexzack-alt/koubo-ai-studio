import {Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
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
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

type PaperId = 'P01' | 'P02' | 'P03' | 'P04' | 'P05' | 'P06' | 'P07';
type CandidateScene = {
  id: string;
  kind: 'paper' | 'real-media' | 'generated-video' | 'semantic';
  component?: string;
  start: number;
  end: number;
  title?: string;
  detail?: string;
  items?: string[];
  clipId?: PaperId;
  asset?: string;
  renderAsset?: string;
  presenterAsset?: string;
  fit?: 'cover' | 'contain';
  trimStart?: number;
  sourceLabel?: string;
  presenterShape?: 'circle' | 'rounded-rectangle';
};

type CandidatePlan = {
  durationSeconds: number;
  sourceVideo: string;
  captionsSrc: string;
  brandLabel: string;
  paperVolume: number;
  generatedVideoVolume: number;
  realMediaVolume: number;
  chapters: Array<{start: number; index: string; title: string}>;
  scenes: CandidateScene[];
  sfxCues: Array<{id: string; time: number; src: string; volume: number}>;
};

const plan = candidatePlan as CandidatePlan;
export const LOCAL_AI_SERVICES_R1_DURATION_IN_FRAMES = f(plan.durationSeconds);

const opaqueKinds = new Set(['paper', 'real-media', 'generated-video']);
const scenes: V72ProductionScene[] = plan.scenes.map((scene) => ({
  id: scene.id,
  start: scene.start,
  end: scene.end,
  kind: 'custom',
  customKey: scene.kind === 'semantic' ? scene.component ?? 'statement' : scene.kind,
  data: scene as unknown as Record<string, unknown>,
  background: opaqueKinds.has(scene.kind) ? 'opaque' : 'talk',
  zIndex: opaqueKinds.has(scene.kind) ? 180 : 90,
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
  sourceFilter: 'contrast(1.035) saturate(1.02) brightness(0.995)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.18) 0%, rgba(2,7,12,0.015) 48%, rgba(2,7,12,0.02) 100%)',
  motion: {
    cuts: [...plan.scenes.map((scene) => scene.start), plan.durationSeconds],
    baseScale: 1.006,
    peakScales: [1.026, 1.022, 1.028, 1.023, 1.027, 1.022],
    peakX: [-7, 4, -6, 4, -7, 4],
    peakY: [-2, -1, -2, -1, -2, -1],
    transformOrigin: '57% 43%',
  },
  scenes,
  sfxCues,
};

const sceneOpacity = (frame: number, durationInFrames: number) => {
  const fade = Math.min(8, Math.max(4, Math.round(durationInFrames * 0.06)));
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

const SourceTag: React.FC<{label?: string; tone?: 'cyan' | 'amber'}> = ({
  label,
  tone = 'cyan',
}) =>
  label ? (
    <div
      style={{
        position: 'absolute',
        right: 46,
        top: 30,
        zIndex: 20,
        padding: '8px 13px',
        color: '#F8FAFD',
        background: 'rgba(3,9,14,0.78)',
        borderLeft: `4px solid ${tone === 'amber' ? '#FFC15A' : '#68DAF8'}`,
        fontFamily,
        fontSize: 16,
        fontWeight: 900,
        textShadow: '0 2px 10px rgba(0,0,0,0.95)',
      }}
    >
      {label}
    </div>
  ) : null;

const PaperScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  if (!scene.clipId) return null;
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#071018',
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <Video
        src={staticFile(`media/local-ai-services-20260902-r1/paper/${scene.clipId}.mp4`)}
        volume={plan.paperVolume}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
      <SourceTag label="AI生成 · 纸艺机制示意" />
    </AbsoluteFill>
  );
};

const GeneratedVideoScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  if (!scene.asset) return null;
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#03070B',
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <Video
        src={staticFile(`media/local-ai-services-20260902-r1/${scene.asset}`)}
        trimBefore={f(scene.trimStart ?? 0)}
        volume={plan.generatedVideoVolume}
        style={{width: '100%', height: '100%', objectFit: scene.fit ?? 'cover'}}
      />
      <SourceTag label={scene.sourceLabel ?? 'AI生成情景演绎'} tone="amber" />
    </AbsoluteFill>
  );
};

const RealMediaScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  if (!scene.asset) return null;
  const source = staticFile(
    `media/local-ai-services-20260902-r1/${scene.renderAsset ?? scene.asset}`,
  );
  const trimStart = scene.renderAsset ? 0 : f(scene.trimStart ?? 0);
  const enter = interpolate(frame, [0, 16], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 12), durationInFrames],
    [1, 0],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const inset = Math.min(enter, exit);
  const isCircle = (scene.presenterShape ?? 'circle') === 'circle';
  const targetWidth = isCircle ? 310 : 382;
  const targetHeight = isCircle ? 310 : 244;
  const width = interpolate(inset, [0, 1], [1920, targetWidth], clamp);
  const height = interpolate(inset, [0, 1], [1080, targetHeight], clamp);
  const right = interpolate(inset, [0, 1], [0, 64], clamp);
  const bottom = interpolate(inset, [0, 1], [0, 170], clamp);
  const radius = isCircle
    ? interpolate(inset, [0, 1], [0, 999], clamp)
    : interpolate(inset, [0, 1], [0, 16], clamp);

  return (
    <AbsoluteFill
      style={{
        background: '#05090D',
        overflow: 'hidden',
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      {scene.fit === 'contain' && !scene.renderAsset ? (
        <Video
          src={source}
          trimBefore={trimStart}
          muted
          volume={0}
          style={{
            position: 'absolute',
            inset: -28,
            zIndex: 0,
            width: 'calc(100% + 56px)',
            height: 'calc(100% + 56px)',
            objectFit: 'cover',
            filter: 'blur(28px) brightness(0.33) saturate(0.72)',
            transform: 'scale(1.04)',
          }}
        />
      ) : null}
      <Video
        src={source}
        trimBefore={trimStart}
        volume={plan.realMediaVolume}
        objectFit={scene.renderAsset ? 'cover' : scene.fit ?? 'cover'}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          width: '100%',
          height: '100%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          zIndex: 3,
          right,
          bottom,
          width,
          height,
          overflow: 'hidden',
          borderRadius: radius,
          border: `${interpolate(inset, [0, 1], [0, 5], clamp)}px solid rgba(255,255,255,0.94)`,
          boxShadow: inset > 0.8 ? '0 15px 44px rgba(0,0,0,0.42)' : 'none',
        }}
      >
        <Video
          src={staticFile(scene.presenterAsset ?? plan.sourceVideo)}
          trimBefore={scene.presenterAsset ? 0 : f(scene.start)}
          muted
          volume={0}
          objectFit="cover"
          style={{
            width: '100%',
            height: '100%',
            objectPosition: '59% 42%',
          }}
        />
      </div>
      <SourceTag label={scene.sourceLabel ?? '用户提供案例素材'} />
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

const renderCustomScene = (wrappedScene: V72CustomScene) => {
  const scene = wrappedScene.data as unknown as CandidateScene;
  if (scene.kind === 'paper') return <PaperScene scene={scene} />;
  if (scene.kind === 'real-media') return <RealMediaScene scene={scene} />;
  if (scene.kind === 'generated-video') return <GeneratedVideoScene scene={scene} />;

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
    (scene) => opaqueKinds.has(scene.kind) && seconds >= scene.start && seconds < scene.end,
  );
  if (opaqueScene) return null;
  const chapter =
    [...plan.chapters].reverse().find((item) => seconds >= item.start) ?? plan.chapters[0];
  const reveal = interpolate(seconds - chapter.start, [0, 0.3], [0, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 52,
        top: 68,
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
      <span style={{color: '#68DAF8', fontSize: 28, fontWeight: 950}}>{chapter.index}</span>
      <span style={{width: 34, height: 2, background: '#68DAF8'}} />
      <span style={{fontSize: 19, fontWeight: 900}}>{chapter.title}</span>
    </div>
  );
};

const Candidate: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
    persistentOverlay={<ChapterAnchor />}
  />
);

export const LocalAIServicesV8CandidateR1WithSfx: React.FC = () => (
  <Candidate soundEnabled />
);

export const LocalAIServicesV8CandidateR1NoSfx: React.FC = () => (
  <Candidate soundEnabled={false} />
);
