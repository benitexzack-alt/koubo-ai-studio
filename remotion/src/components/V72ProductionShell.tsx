import {Audio, Video} from '@remotion/media';
import React, {type CSSProperties} from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {AdaptiveBilingualCaptionOverlay} from './AdaptiveBilingualCaptionOverlay';
import {LocalFont} from './LocalFont';
import {
  V7AnnotatedMediaStage,
  V7ChapterMarker,
  V7EvidenceQuote,
  V7HeroMetric,
  V7ProcessRail,
  V7TransparentInfoStack,
  V7TruthStatement,
  type V7InfoItem,
  type V7MediaFact,
  type V7ProcessStep,
  type V7Tone,
} from './V7InformationStage';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export type V72SfxCue = {
  id: string;
  time: number;
  file: string;
  src?: string;
  volume: number;
};

export type V72MotionConfig = {
  cuts: number[];
  baseScale?: number;
  peakScales?: number[];
  peakX?: number[];
  peakY?: number[];
  transformOrigin?: string;
};

type V72SceneBase = {
  id: string;
  start: number;
  end: number;
  background?: 'talk' | 'opaque';
  zIndex?: number;
};

export type V72ChapterScene = V72SceneBase & {
  kind: 'chapter';
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  tone?: V7Tone;
  style?: CSSProperties;
};

export type V72MetricScene = V72SceneBase & {
  kind: 'metric';
  eyebrow: string;
  prefix?: string;
  value: string;
  suffix?: string;
  caption: string;
  facts?: string[];
  tone?: V7Tone;
  style?: CSSProperties;
};

export type V72InfoStackScene = V72SceneBase & {
  kind: 'info-stack';
  eyebrow: string;
  title: string;
  items: V7InfoItem[];
  style?: CSSProperties;
};

export type V72ProcessScene = V72SceneBase & {
  kind: 'process';
  eyebrow: string;
  title: string;
  steps: V7ProcessStep[];
  style?: CSSProperties;
};

export type V72EvidenceScene = V72SceneBase & {
  kind: 'evidence';
  source: string;
  quote: string;
  caption: string;
  marker?: string;
  tone?: V7Tone;
  style?: CSSProperties;
};

export type V72TruthScene = V72SceneBase & {
  kind: 'truth';
  eyebrow: string;
  left: string;
  right: string;
  note: string;
};

export type V72AnnotatedMediaScene = V72SceneBase & {
  kind: 'annotated-media';
  index: string;
  eyebrow: string;
  title: string;
  facts: V7MediaFact[];
  mediaSrc: string;
  mediaKind: 'video' | 'image';
  mediaLabel: string;
  mediaFit?: 'cover' | 'contain';
  mediaLoop?: boolean;
};

export type V72CustomScene = V72SceneBase & {
  kind: 'custom';
  customKey: string;
  data?: Record<string, unknown>;
};

export type V72ProductionScene =
  | V72ChapterScene
  | V72MetricScene
  | V72InfoStackScene
  | V72ProcessScene
  | V72EvidenceScene
  | V72TruthScene
  | V72AnnotatedMediaScene
  | V72CustomScene;

export type V72ProductionConfig = {
  durationSeconds: number;
  sourceVideo: string;
  captionsSrc: string;
  captionVariant?: 'boxed' | 'transparent-v8';
  brandLabel?: string;
  sourceObjectFit?: 'cover' | 'contain';
  sourceFilter?: string;
  sourceOverlay?: string;
  motion: V72MotionConfig;
  scenes: V72ProductionScene[];
  sfxCues: V72SfxCue[];
};

const motionAt = (
  seconds: number,
  durationSeconds: number,
  config: V72MotionConfig,
) => {
  const cuts = [...new Set([0, ...config.cuts, durationSeconds])]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  let segmentIndex = cuts.findIndex(
    (cut, index) =>
      seconds >= cut &&
      seconds < (cuts[index + 1] ?? Number.POSITIVE_INFINITY),
  );
  if (segmentIndex < 0) {
    segmentIndex = Math.max(0, cuts.length - 2);
  }

  const start = cuts[segmentIndex] ?? 0;
  const end = cuts[segmentIndex + 1] ?? durationSeconds;
  const duration = Math.max(0.6, end - start);
  const progress = Math.min(1, Math.max(0, (seconds - start) / duration));
  const accentAt = Math.min(0.32, Math.max(0.16, 1.45 / duration));
  const settleAt = Math.max(accentAt + 0.18, 0.76);
  const intensity =
    progress <= accentAt
      ? interpolate(progress, [0, accentAt], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        })
      : progress <= settleAt
        ? interpolate(progress, [accentAt, settleAt], [1, 0.72], {
            ...clamp,
            easing: Easing.inOut(Easing.cubic),
          })
        : interpolate(progress, [settleAt, 1], [0.72, 0], {
            ...clamp,
            easing: Easing.inOut(Easing.cubic),
          });

  const baseScale = config.baseScale ?? 1.035;
  const peakScales = config.peakScales ?? [1.078, 1.083, 1.075, 1.081];
  const peakX = config.peakX ?? [-24, -12, 8, -20];
  const peakY = config.peakY ?? [-5, -3, -4, -2];
  const scale = peakScales[segmentIndex % peakScales.length] ?? 1.078;

  return {
    scale: baseScale + (scale - baseScale) * intensity,
    x: (peakX[segmentIndex % peakX.length] ?? 0) * intensity,
    y: (peakY[segmentIndex % peakY.length] ?? 0) * intensity,
  };
};

const V72TalkFootage: React.FC<{config: V72ProductionConfig}> = ({config}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const motion = motionAt(frame / fps, config.durationSeconds, config.motion);

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#04080D'}}>
      <Video
        src={staticFile(config.sourceVideo)}
        objectFit={config.sourceObjectFit ?? 'cover'}
        style={{
          width: '100%',
          height: '100%',
          filter:
            config.sourceFilter ??
            'contrast(1.035) saturate(1.02) brightness(0.995)',
          transform: `translate3d(${motion.x}px, ${motion.y}px, 0) scale(${motion.scale})`,
          transformOrigin: config.motion.transformOrigin ?? '56% 42%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            config.sourceOverlay ??
            'linear-gradient(90deg, rgba(2,7,12,0.13) 0%, rgba(2,7,12,0.01) 54%, rgba(2,7,12,0.035) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const StandardScene: React.FC<{scene: V72ProductionScene}> = ({scene}) => {
  switch (scene.kind) {
    case 'chapter':
      return (
        <V7ChapterMarker
          index={scene.index}
          eyebrow={scene.eyebrow}
          title={scene.title}
          subtitle={scene.subtitle}
          tone={scene.tone}
          style={scene.style}
        />
      );
    case 'metric':
      return (
        <V7HeroMetric
          eyebrow={scene.eyebrow}
          prefix={scene.prefix}
          value={scene.value}
          suffix={scene.suffix}
          caption={scene.caption}
          facts={scene.facts}
          tone={scene.tone}
          style={scene.style}
        />
      );
    case 'info-stack':
      return (
        <V7TransparentInfoStack
          eyebrow={scene.eyebrow}
          title={scene.title}
          items={scene.items}
          style={scene.style}
        />
      );
    case 'process':
      return (
        <V7ProcessRail
          eyebrow={scene.eyebrow}
          title={scene.title}
          steps={scene.steps}
          style={scene.style}
        />
      );
    case 'evidence':
      return (
        <V7EvidenceQuote
          source={scene.source}
          quote={scene.quote}
          caption={scene.caption}
          marker={scene.marker}
          tone={scene.tone}
          style={scene.style}
        />
      );
    case 'truth':
      return (
        <V7TruthStatement
          eyebrow={scene.eyebrow}
          left={scene.left}
          right={scene.right}
          note={scene.note}
        />
      );
    case 'annotated-media':
      return (
        <V7AnnotatedMediaStage
          index={scene.index}
          eyebrow={scene.eyebrow}
          title={scene.title}
          facts={scene.facts}
          mediaSrc={scene.mediaSrc}
          mediaKind={scene.mediaKind}
          mediaLabel={scene.mediaLabel}
          mediaFit={scene.mediaFit}
          mediaLoop={scene.mediaLoop}
          motionPreset="v72"
        />
      );
    case 'custom':
      return null;
  }
};

const SceneLayer: React.FC<{
  scene: V72ProductionScene;
  fps: number;
  renderCustomScene?: (scene: V72CustomScene) => React.ReactNode;
}> = ({scene, fps, renderCustomScene}) => {
  const from = Math.round(scene.start * fps);
  const durationInFrames = Math.max(1, Math.round(scene.end * fps) - from);
  return (
    <Sequence
      from={from}
      durationInFrames={durationInFrames}
      premountFor={15}
      style={{zIndex: scene.zIndex ?? 80}}
    >
      {scene.background === 'opaque' ? (
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(145deg, #07111A 0%, #03070B 56%, #071018 100%)',
          }}
        />
      ) : null}
      {scene.kind === 'custom' ? (
        renderCustomScene?.(scene)
      ) : (
        <StandardScene scene={scene} />
      )}
    </Sequence>
  );
};

const V72SemanticSfx: React.FC<{cues: V72SfxCue[]; fps: number}> = ({
  cues,
  fps,
}) => (
  <>
    {cues.map((cue) => (
      <Sequence key={cue.id} from={Math.round(cue.time * fps)}>
        <Audio
          src={staticFile(cue.src ?? `audio/koubo-sfx-v2/${cue.file}`)}
          volume={cue.volume}
        />
      </Sequence>
    ))}
  </>
);

const V72Hud: React.FC<{
  durationSeconds: number;
  brandLabel: string;
}> = ({durationSeconds, brandLabel}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const durationInFrames = Math.max(1, Math.round(durationSeconds * fps));
  const progress = (frame / Math.max(1, durationInFrames - 1)) * 100;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 28,
          zIndex: 220,
          display: 'flex',
          alignItems: 'center',
          color: '#F7FAFC',
          fontFamily,
          textShadow: '0 3px 16px rgba(0,0,0,0.94)',
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            background: '#62D8FF',
            boxShadow: '0 0 17px #62D8FF',
          }}
        />
        <div style={{marginLeft: 12, fontSize: 19, fontWeight: 950}}>
          {brandLabel}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
          bottom: 20,
          zIndex: 280,
          height: 3,
          background: 'rgba(255,255,255,0.14)',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #62D8FF, #FFBE55)',
            boxShadow: '0 0 14px rgba(98,216,255,0.65)',
          }}
        />
      </div>
    </>
  );
};

export const V72ProductionShell: React.FC<{
  config: V72ProductionConfig;
  soundEnabled?: boolean;
  renderCustomScene?: (scene: V72CustomScene) => React.ReactNode;
  persistentOverlay?: React.ReactNode;
}> = ({config, soundEnabled = true, renderCustomScene, persistentOverlay}) => {
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#04080D'}}>
      <LocalFont />
      <V72TalkFootage config={config} />
      {config.scenes.map((scene) => (
        <SceneLayer
          key={scene.id}
          scene={scene}
          fps={fps}
          renderCustomScene={renderCustomScene}
        />
      ))}
      {soundEnabled ? (
        <V72SemanticSfx cues={config.sfxCues} fps={fps} />
      ) : null}
      {persistentOverlay}
      <V72Hud
        durationSeconds={config.durationSeconds}
        brandLabel={config.brandLabel ?? '超哥AI创业记'}
      />
      <AdaptiveBilingualCaptionOverlay
        captionsSrc={config.captionsSrc}
        variant={config.captionVariant}
      />
    </AbsoluteFill>
  );
};
