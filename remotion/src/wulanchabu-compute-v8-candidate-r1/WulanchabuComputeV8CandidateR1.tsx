import {Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
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

type CandidateScene = {
  id: string;
  kind: 'paper' | 'official-video' | 'official-image' | 'fact-note' | 'semantic';
  component?: string;
  start: number;
  end: number;
  title?: string;
  detail?: string;
  items?: string[];
  labels?: string[];
  clipId?: PaperId;
  asset?: string;
  fit?: 'cover' | 'contain' | 'cover-top';
  trimStart?: number;
  sourceLabel?: string;
};

type CandidatePlan = {
  durationSeconds: number;
  sourceVideo: string;
  captionsSrc: string;
  brandLabel: string;
  paperVolume: number;
  chapters: Array<{start: number; index: string; title: string}>;
  scenes: CandidateScene[];
  sfxCues: Array<{id: string; time: number; src: string; volume: number}>;
};

const plan = candidatePlan as CandidatePlan;
export const WULANCHABU_COMPUTE_R1_DURATION_IN_FRAMES = f(plan.durationSeconds);

const opaqueKinds = new Set(['paper', 'official-video', 'official-image']);
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
  sourceFilter: 'contrast(1.025) saturate(1.015) brightness(0.995)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.13) 0%, rgba(2,7,12,0.01) 46%, rgba(2,7,12,0.01) 100%)',
  motion: {
    cuts: [...plan.scenes.map((scene) => scene.start), plan.durationSeconds],
    baseScale: 1.006,
    peakScales: [1.026, 1.022, 1.028, 1.023, 1.027, 1.022],
    peakX: [-7, 4, -6, 4, -7, 4],
    peakY: [-2, -1, -2, -1, -2, -1],
    transformOrigin: '55% 43%',
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

const paperAnchors = [
  {left: 54, top: 118},
  {left: 54, top: 220},
  {right: 54, top: 118},
  {right: 54, top: 220},
  {left: 54, top: 322},
  {right: 54, top: 322},
];

const PaperLabels: React.FC<{labels: string[]}> = ({labels}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  return (
    <>
      {labels.slice(0, 6).map((label, index) => {
        const reveal = spring({
          frame: frame - 7 - index * 7,
          fps: compositionFps,
          config: {damping: 22, stiffness: 182, mass: 0.84},
        });
        const anchor = paperAnchors[index];
        const warm = index === labels.slice(0, 6).length - 1;
        return (
          <div
            key={`${label}-${index}`}
            style={{
              position: 'absolute',
              ...anchor,
              minWidth: 206,
              maxWidth: 300,
              height: 64,
              padding: '0 19px',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              color: '#182028',
              background: warm ? '#FFD47A' : '#F4E9D2',
              borderLeft: `8px solid ${warm ? '#C66B2E' : '#315C80'}`,
              boxShadow: '0 13px 28px rgba(53,34,19,0.3)',
              fontFamily,
              fontSize: 25,
              lineHeight: 1,
              fontWeight: 950,
              opacity: reveal,
              transform: `translateY(${interpolate(reveal, [0, 1], [16, 0])}px) rotate(${index % 2 === 0 ? -0.7 : 0.7}deg)`,
            }}
          >
            <span style={{marginRight: 12, color: warm ? '#9C421E' : '#315C80', fontSize: 16}}>
              {String(index + 1).padStart(2, '0')}
            </span>
            {label}
          </div>
        );
      })}
    </>
  );
};

const PaperScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#B89662',
        opacity: sceneOpacity(frame, durationInFrames),
      }}
    >
      <Video
        src={staticFile(`media/wulanchabu-compute-20260901-r1/paper/${scene.clipId}.mp4`)}
        volume={plan.paperVolume}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 34,
          color: '#F8F3E9',
          background: 'rgba(12,24,34,0.9)',
          borderLeft: '6px solid #68DAF8',
          padding: '10px 17px 11px',
          fontFamily,
          fontSize: 22,
          lineHeight: 1,
          fontWeight: 950,
          boxShadow: '0 12px 30px rgba(0,0,0,0.26)',
        }}
      >
        {scene.title}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 54,
          top: 42,
          color: '#163145',
          background: 'rgba(244,233,210,0.94)',
          padding: '7px 12px',
          fontFamily,
          fontSize: 15,
          fontWeight: 900,
        }}
      >
        纸艺关系示意 · 原声保留
      </div>
      <PaperLabels labels={scene.labels ?? []} />
    </AbsoluteFill>
  );
};

const SourceTag: React.FC<{label?: string}> = ({label}) =>
  label ? (
    <div
      style={{
        position: 'absolute',
        right: 42,
        top: 31,
        padding: '8px 13px',
        color: '#F8FAFD',
        background: 'rgba(3,9,14,0.78)',
        borderLeft: '4px solid #68DAF8',
        fontFamily,
        fontSize: 16,
        fontWeight: 900,
      }}
    >
      {label}
    </div>
  ) : null;

const OfficialVideoScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  const source = staticFile(`media/wulanchabu-compute-20260901-r1/${scene.asset}`);
  const contain = scene.fit === 'contain';
  return (
    <AbsoluteFill
      style={{background: '#03070A', overflow: 'hidden', opacity: sceneOpacity(frame, durationInFrames)}}
    >
      {contain ? (
        <>
          <Video
            src={source}
            muted
            trimBefore={f(scene.trimStart ?? 0)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(30px) brightness(0.36) saturate(0.82)',
              transform: 'scale(1.14)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 520,
              right: 520,
              top: 0,
              bottom: 0,
              background: '#020406',
              boxShadow: '0 0 70px rgba(0,0,0,0.72)',
            }}
          >
            <Video
              src={source}
              muted
              trimBefore={f(scene.trimStart ?? 0)}
              style={{width: '100%', height: '100%', objectFit: 'contain'}}
            />
          </div>
        </>
      ) : (
        <Video
          src={source}
          muted
          trimBefore={f(scene.trimStart ?? 0)}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      )}
      <AbsoluteFill
        style={{background: 'linear-gradient(180deg, rgba(2,6,10,0.12), rgba(2,6,10,0.04) 62%, rgba(2,6,10,0.44))'}}
      />
      <SourceTag label={scene.sourceLabel} />
    </AbsoluteFill>
  );
};

const OfficialImageScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  const progress = interpolate(frame, [0, durationInFrames], [1, 1.035], clamp);
  const fit = scene.fit === 'cover-top' ? 'cover' : 'cover';
  return (
    <AbsoluteFill
      style={{background: '#03070A', overflow: 'hidden', opacity: sceneOpacity(frame, durationInFrames)}}
    >
      <Img
        src={staticFile(`media/wulanchabu-compute-20260901-r1/${scene.asset}`)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
          objectPosition: scene.fit === 'cover-top' ? 'center top' : 'center center',
          transform: `scale(${progress})`,
          filter: scene.fit === 'cover-top' ? 'brightness(0.76)' : 'brightness(0.72) saturate(0.9)',
        }}
      />
      <AbsoluteFill
        style={{background: 'linear-gradient(90deg, rgba(2,7,12,0.9) 0%, rgba(2,7,12,0.46) 42%, rgba(2,7,12,0.04) 76%)'}}
      />
      <div
        style={{
          position: 'absolute',
          left: 62,
          top: 198,
          width: 720,
          color: '#F8FAFD',
          fontFamily,
          textShadow: '0 5px 24px rgba(0,0,0,0.98)',
        }}
      >
        <div style={{color: '#68DAF8', fontSize: 20, fontWeight: 950}}>真实公开材料</div>
        <div style={{marginTop: 14, fontSize: 54, lineHeight: 1.07, fontWeight: 950}}>
          {scene.title}
        </div>
        <div
          style={{
            marginTop: 18,
            paddingLeft: 16,
            borderLeft: '6px solid #FFC45E',
            color: 'rgba(248,250,253,0.9)',
            fontSize: 27,
            lineHeight: 1.3,
            fontWeight: 830,
          }}
        >
          {scene.detail}
        </div>
      </div>
      <SourceTag label={scene.sourceLabel} />
    </AbsoluteFill>
  );
};

const FactNoteScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const reveal = spring({
    frame: frame - 3,
    fps: compositionFps,
    config: {damping: 23, stiffness: 180, mass: 0.84},
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 52,
        top: 154,
        width: 735,
        padding: '26px 28px 28px',
        boxSizing: 'border-box',
        color: '#F8FAFD',
        background: 'rgba(3,11,17,0.79)',
        borderLeft: '7px solid #FFC45E',
        boxShadow: '0 22px 58px rgba(0,0,0,0.35)',
        fontFamily,
        textShadow: '0 3px 15px rgba(0,0,0,0.95)',
        opacity: reveal,
        transform: `translateX(${interpolate(reveal, [0, 1], [-30, 0])}px)`,
      }}
    >
      <div style={{color: '#FFC45E', fontSize: 20, fontWeight: 950}}>{scene.title}</div>
      <div style={{marginTop: 13, fontSize: 42, lineHeight: 1.15, fontWeight: 950}}>
        {scene.detail}
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 22}}>
        {(scene.items ?? []).map((item, index) => (
          <div
            key={item}
            style={{
              padding: '10px 14px',
              color: '#F8FAFD',
              background: 'rgba(104,218,248,0.13)',
              borderBottom: `3px solid ${index === (scene.items?.length ?? 1) - 1 ? '#FFC45E' : '#68DAF8'}`,
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            {item}
          </div>
        ))}
      </div>
      <div style={{marginTop: 18, color: 'rgba(248,250,253,0.66)', fontSize: 17, fontWeight: 800}}>
        {scene.sourceLabel}
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
  if (scene.kind === 'official-video') return <OfficialVideoScene scene={scene} />;
  if (scene.kind === 'official-image') return <OfficialImageScene scene={scene} />;
  if (scene.kind === 'fact-note') return <FactNoteScene scene={scene} />;

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

export const WulanchabuComputeV8CandidateR1WithSfx: React.FC = () => (
  <V72ProductionShell
    config={config}
    soundEnabled
    renderCustomScene={renderCustomScene}
    persistentOverlay={<ChapterAnchor />}
  />
);

export const WulanchabuComputeV8CandidateR1NoSfx: React.FC = () => (
  <V72ProductionShell
    config={config}
    soundEnabled={false}
    renderCustomScene={renderCustomScene}
    persistentOverlay={<ChapterAnchor />}
  />
);
