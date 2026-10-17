import {Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
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
import candidatePlan from './candidate-plan.v2.json';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

type ClipId =
  | 'P01'
  | 'P02'
  | 'P03'
  | 'P04'
  | 'P05'
  | 'P06'
  | 'P07'
  | 'P08'
  | 'P09'
  | 'P10'
  | 'P11';

type PageSpec = {src: string; holdSeconds: number; label: string};

type CandidateScene = {
  id: string;
  kind: 'hook-button' | 'screen' | 'generated' | 'semantic' | 'pdf';
  component?: string;
  start: number;
  end: number;
  title: string;
  detail: string;
  trimStart?: number;
  points?: string[];
  focusCrop?: string;
  items?: string[];
  clipId?: ClipId;
  semanticException?: string;
  pages?: PageSpec[];
};

type CandidatePlan = {
  durationSeconds: number;
  sourceVideo: string;
  screenVideo: string;
  captionsSrc: string;
  brandLabel: string;
  generatedClipDurationSeconds: number;
  clipVolumes: Record<ClipId, number>;
  chapters: Array<{start: number; index: string; title: string}>;
  scenes: CandidateScene[];
  sfxCues: Array<{id: string; time: number; src: string; volume: number}>;
};

const plan = candidatePlan as CandidatePlan;
export const WECHAT_GEO_AAO_MANUAL_R2_DURATION_IN_FRAMES = f(
  plan.durationSeconds,
);

const scenes: V72ProductionScene[] = plan.scenes.map((scene) => ({
  id: scene.id,
  start: scene.start,
  end: scene.end,
  kind: 'custom',
  customKey: scene.kind === 'semantic' ? scene.component ?? 'statement' : scene.kind,
  data: scene as unknown as Record<string, unknown>,
  background:
    scene.kind === 'screen' || scene.kind === 'generated' || scene.kind === 'pdf'
      ? 'opaque'
      : 'talk',
  zIndex: scene.kind === 'pdf' ? 230 : undefined,
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
  sourceFilter: 'contrast(1.026) saturate(1.015) brightness(0.998)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.18) 0%, rgba(2,7,12,0.025) 42%, rgba(2,7,12,0.01) 100%)',
  motion: {
    cuts: [...plan.scenes.map((scene) => scene.start), plan.durationSeconds],
    baseScale: 1.008,
    peakScales: [1.032, 1.026, 1.034, 1.028, 1.031, 1.027],
    peakX: [-7, 5, -5, 4, -6, 5],
    peakY: [-2, -1, -2, -1, -2, -1],
    transformOrigin: '56% 42%',
  },
  scenes,
  sfxCues,
};

const sceneFade = (frame: number, durationInFrames: number) => {
  const fadeFrames = Math.min(10, Math.max(5, Math.round(durationInFrames * 0.08)));
  return Math.min(
    interpolate(frame, [0, fadeFrames], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(fadeFrames, durationInFrames - fadeFrames), durationInFrames],
      [1, 0],
      clamp,
    ),
  );
};

const HookButtonScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const durationInFrames = f(scene.end - scene.start);
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
        top: 148,
        width: 780,
        color: '#F8FAFD',
        fontFamily,
        opacity: sceneFade(frame, durationInFrames),
        textShadow: '0 5px 24px rgba(0,0,0,0.96)',
        transform: `translateX(${interpolate(reveal, [0, 1], [-28, 0])}px)`,
      }}
    >
      <div style={{color: '#68DAFF', fontSize: 20, fontWeight: 950}}>
        真实界面变化
      </div>
      <div style={{marginTop: 13, fontSize: 54, lineHeight: 1.05, fontWeight: 950}}>
        {scene.title}
      </div>
      <div
        style={{
          marginTop: 22,
          width: 770,
          padding: 14,
          boxSizing: 'border-box',
          background: 'rgba(247,249,252,0.94)',
          boxShadow: '0 22px 56px rgba(0,0,0,0.42)',
          borderLeft: '6px solid #68DAFF',
        }}
      >
        <Img
          src={staticFile('media/wechat-geo-aao-manual-11clips-r1/button-crop.png')}
          style={{width: '100%', display: 'block'}}
        />
      </div>
      <div style={{marginTop: 13, color: '#FFC45E', fontSize: 25, fontWeight: 900}}>
        {scene.detail}
      </div>
    </div>
  );
};

const ScreenEvidenceScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const durationInFrames = f(scene.end - scene.start);
  const reveal = spring({
    frame: frame - 2,
    fps: compositionFps,
    config: {damping: 24, stiffness: 176, mass: 0.86},
  });
  const opacity = sceneFade(frame, durationInFrames);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#05090D', opacity}}>
      <Video
        src={staticFile(plan.screenVideo)}
        muted
        trimBefore={f(scene.trimStart ?? 0)}
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: 'blur(28px) brightness(0.28) saturate(0.72)',
          transform: 'scale(1.12)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(3,8,13,0.96) 0%, rgba(3,8,13,0.82) 41%, rgba(3,8,13,0.22) 68%, rgba(3,8,13,0.56) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 108,
          top: 0,
          width: 500,
          height: 1080,
          overflow: 'hidden',
          background: '#000',
          boxShadow: '0 0 0 2px rgba(255,255,255,0.12), 0 24px 64px rgba(0,0,0,0.56)',
        }}
      >
        <Video
          src={staticFile(plan.screenVideo)}
          muted
          trimBefore={f(scene.trimStart ?? 0)}
          style={{width: '100%', height: '100%', objectFit: 'contain'}}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 156,
          width: 780,
          color: '#F8FAFD',
          fontFamily,
          textShadow: '0 5px 24px rgba(0,0,0,0.98)',
          transform: `translateX(${interpolate(reveal, [0, 1], [-26, 0])}px)`,
        }}
      >
        <div style={{color: '#68DAFF', fontSize: 19, fontWeight: 950}}>
          微信真实录屏 · 完整竖屏保留
        </div>
        <div
          style={{
            marginTop: 16,
            maxWidth: 760,
            fontSize: [...scene.title].length > 16 ? 45 : 54,
            lineHeight: 1.08,
            fontWeight: 950,
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            marginTop: 16,
            maxWidth: 700,
            color: 'rgba(248,250,253,0.82)',
            fontSize: 25,
            lineHeight: 1.3,
            fontWeight: 820,
          }}
        >
          {scene.detail}
        </div>
        {scene.focusCrop ? (
          <div
            style={{
              marginTop: 20,
              width: 740,
              padding: 12,
              boxSizing: 'border-box',
              background: 'rgba(247,249,252,0.96)',
              borderLeft: '6px solid #68DAFF',
              boxShadow: '0 18px 48px rgba(0,0,0,0.42)',
            }}
          >
            <Img
              src={staticFile(scene.focusCrop)}
              style={{width: '100%', display: 'block'}}
            />
          </div>
        ) : null}
        {scene.points?.length ? (
          <div style={{marginTop: 25, display: 'grid', gap: 13}}>
            {scene.points.slice(0, 4).map((point, index) => {
              const itemReveal = spring({
                frame: frame - 8 - index * 7,
                fps: compositionFps,
                config: {damping: 23, stiffness: 186, mass: 0.82},
              });
              return (
                <div
                  key={point}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 50,
                    paddingLeft: 14,
                    borderLeft: `5px solid ${index === (scene.points?.length ?? 1) - 1 ? '#FFC45E' : '#65D69A'}`,
                    background: 'rgba(4,13,20,0.34)',
                    fontSize: 24,
                    fontWeight: 900,
                    opacity: itemReveal,
                  }}
                >
                  {point}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const GeneratedClipScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const clipId = scene.clipId as ClipId;
  const durationInFrames = f(scene.end - scene.start);
  const sourceFrames = f(plan.generatedClipDurationSeconds);
  const playFrames = Math.min(durationInFrames, sourceFrames);
  const reveal = spring({
    frame: frame - 3,
    fps: compositionFps,
    config: {damping: 23, stiffness: 178, mass: 0.84},
  });
  const opacity = sceneFade(frame, durationInFrames);
  const mediaBase = `media/wechat-geo-aao-manual-11clips-r1/${clipId}`;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#03070B', opacity}}>
      <Sequence durationInFrames={playFrames} premountFor={12}>
        <Video
          src={staticFile(`${mediaBase}.mp4`)}
          volume={plan.clipVolumes[clipId]}
          objectFit="cover"
          style={{
            width: '100%',
            height: '100%',
            filter: 'contrast(1.025) saturate(0.96) brightness(0.92)',
          }}
        />
      </Sequence>
      {durationInFrames > playFrames ? (
        <Sequence from={playFrames} durationInFrames={durationInFrames - playFrames}>
          <Img
            src={staticFile(`${mediaBase}-last.png`)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'contrast(1.025) saturate(0.96) brightness(0.9)',
            }}
          />
        </Sequence>
      ) : null}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.87) 0%, rgba(2,7,12,0.48) 34%, rgba(2,7,12,0.02) 69%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 148,
          width: 710,
          color: '#F8FAFD',
          fontFamily,
          textShadow: '0 5px 25px rgba(0,0,0,0.98)',
          transform: `translateX(${interpolate(reveal, [0, 1], [-26, 0])}px)`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <span
            style={{
              padding: '7px 10px',
              color: '#071018',
              background: '#68DAFF',
              fontSize: 17,
              fontWeight: 950,
            }}
          >
            {clipId}
          </span>
          <span style={{color: '#FFC45E', fontSize: 17, fontWeight: 950}}>
            AI生成 · 概念演绎
          </span>
        </div>
        <div
          style={{
            marginTop: 17,
            fontSize: [...scene.title].length > 16 ? 44 : 53,
            lineHeight: 1.07,
            fontWeight: 950,
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            marginTop: 18,
            paddingLeft: 15,
            borderLeft: '5px solid #68DAFF',
            color: 'rgba(248,250,253,0.88)',
            fontSize: 24,
            lineHeight: 1.28,
            fontWeight: 840,
          }}
        >
          {scene.detail}
        </div>
        {scene.semanticException ? (
          <div
            style={{
              marginTop: 18,
              maxWidth: 640,
              color: '#FFC45E',
              fontSize: 17,
              lineHeight: 1.3,
              fontWeight: 850,
            }}
          >
            边界：{scene.semanticException}
          </div>
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 52,
          top: 72,
          padding: '8px 12px',
          color: '#68DAFF',
          background: 'rgba(3,10,16,0.52)',
          borderBottom: '2px solid #68DAFF',
          fontFamily,
          fontSize: 16,
          fontWeight: 900,
        }}
      >
        场景演绎 · 不作事实证据
      </div>
    </AbsoluteFill>
  );
};

const PdfShowcaseScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  const pages = scene.pages ?? [];
  let cursor = 0;
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#071018',
        opacity: sceneFade(frame, durationInFrames),
      }}
    >
      {pages.map((page, index) => {
        const from = cursor;
        const pageFrames =
          index === pages.length - 1
            ? Math.max(1, durationInFrames - from)
            : f(page.holdSeconds);
        cursor += pageFrames;
        return (
          <Sequence
            key={page.src}
            from={from}
            durationInFrames={pageFrames}
            premountFor={8}
          >
            <Img
              src={staticFile(page.src)}
              style={{width: '100%', height: '100%', objectFit: 'contain'}}
            />
            <div
              style={{
                position: 'absolute',
                right: 48,
                top: 54,
                padding: '8px 12px',
                color: '#68DAFF',
                background: 'rgba(3,10,16,0.78)',
                borderBottom: '2px solid #68DAFF',
                fontFamily,
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              {page.label} · {index + 1}/3
            </div>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const semanticLayer = (scene: CandidateScene): V8SemanticLayer => ({
  id: scene.id,
  start: scene.start,
  end: scene.end,
  title: scene.title,
  detail: scene.detail,
  items: scene.items ?? [],
  params: {component: scene.component ?? 'statement'},
});

const renderCustomScene = (wrappedScene: V72CustomScene) => {
  const scene = wrappedScene.data as unknown as CandidateScene;
  if (scene.kind === 'hook-button') return <HookButtonScene scene={scene} />;
  if (scene.kind === 'screen') return <ScreenEvidenceScene scene={scene} />;
  if (scene.kind === 'generated') return <GeneratedClipScene scene={scene} />;
  if (scene.kind === 'pdf') return <PdfShowcaseScene scene={scene} />;

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

const CandidateChapterAnchor: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
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

export const WechatGeoAaoManual11CandidateR2WithSfx: React.FC = () => (
  <V72ProductionShell
    config={config}
    soundEnabled
    renderCustomScene={renderCustomScene}
    persistentOverlay={<CandidateChapterAnchor />}
  />
);
