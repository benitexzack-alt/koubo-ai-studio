import {Video} from '@remotion/media';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  cancelRender,
  continueRender,
  delayRender,
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
import candidatePlan from '../../public-ai-no-new-business-model-v8-r1/data/candidate-plan.v1.json';
import {MarkerUnderline} from './ShotcraftEffects.generated';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

type SceneKind =
  | 'semantic'
  | 'paper'
  | 'ai'
  | 'evidence-card'
  | 'archive-montage'
  | 'public-video'
  | 'shotcraft-marker';
type SemanticComponent =
  | 'hook'
  | 'statement'
  | 'chapter'
  | 'question'
  | 'status'
  | 'metric'
  | 'comparison'
  | 'switch'
  | 'warning'
  | 'process'
  | 'closing'
  | 'quote'
  | 'signoff';

type CandidateScene = {
  id: string;
  beatId: string;
  kind: SceneKind;
  component?: SemanticComponent;
  side?: 'left' | 'right';
  start: number;
  end: number;
  title?: string;
  detail?: string;
  items?: string[];
  asset?: string;
  assets?: string[];
  sourceLabel?: string;
  focusCount?: number;
  markerBefore?: string;
  markerKeyword?: string;
  markerAfter?: string;
  region?: {x: number; y: number; width: number; height: number};
  segments?: Array<{
    asset: string;
    startFrame: number;
    endFrameExclusive: number;
    label: string;
  }>;
};

type VisualPlan = {
  status: string;
  formalAllowed: boolean;
  canvas: {
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
    durationSeconds: number;
  };
  audioPolicy: {
    hostSource: string;
  };
  insertions: Array<{
    id: string;
    beatId: string;
    kind: 'image' | 'video';
    src: string;
    startFrame: number;
    endFrameExclusive: number;
    label: string;
  }>;
  speakerOverlays: Array<{
    id: string;
    beatId: string;
    startFrame: number;
    endFrameExclusive: number;
    type:
      | 'thesis'
      | 'chapter'
      | 'question'
      | 'list'
      | 'comparison'
      | 'keyword'
      | 'causal'
      | 'boundary'
      | 'process'
      | 'quote'
      | 'outro';
    title: string;
    subtitle?: string;
    items?: string[];
    reviewState?: string;
  }>;
  sfxCues: Array<{
    id: string;
    atFrame: number;
    src: string;
    volume: number;
    purpose: string;
  }>;
  reviewGates: {
    actualAudioCaptionReviewRequired: boolean;
    fullSpeedVisualReviewRequired: boolean;
    sfxListeningReviewRequired: boolean;
    publicationApproved: boolean;
  };
};

type CaptionPage = {
  id?: string;
  startMs: number;
  endMs: number;
  zh: string;
  en: string;
  reviewRequired?: boolean;
};

type CaptionDocument = {
  pages?: CaptionPage[];
};

const visualPlan = candidatePlan as unknown as VisualPlan;

const chapters = [
  {start: 0, index: '01', title: '效率，不是新模式'},
  {start: 30.98, index: '02', title: '什么才算新商业模式'},
  {start: 75.32, index: '03', title: 'AI真正改变了什么'},
  {start: 112.08, index: '04', title: '集装箱的效率革命'},
  {start: 160.66, index: '05', title: '广告投放的机器化'},
  {start: 242.08, index: '06', title: '知识工作如何被重写'},
  {start: 310.48, index: '07', title: '效率革命的终局'},
];

const componentForOverlay = (
  type: VisualPlan['speakerOverlays'][number]['type'],
): SemanticComponent => {
  switch (type) {
    case 'thesis':
      return 'hook';
    case 'chapter':
      return 'chapter';
    case 'question':
      return 'question';
    case 'list':
      return 'status';
    case 'comparison':
      return 'comparison';
    case 'keyword':
      return 'statement';
    case 'causal':
      return 'comparison';
    case 'boundary':
      return 'warning';
    case 'process':
      return 'process';
    case 'quote':
      return 'quote';
    case 'outro':
      return 'signoff';
  }
};

const sideForOverlay = (index: number): 'left' | 'right' =>
  index % 2 === 0 ? 'left' : 'right';

const focusCountFor = (id: string) => {
  if (id === 'R02') return 4;
  if (id === 'R01' || id === 'R05') return 3;
  if (id === 'R03') return 2;
  return 0;
};

const r04Insertions = visualPlan.insertions.filter((item) =>
  ['R04A', 'R04B', 'R04C'].includes(item.id),
);

const insertionScenes: CandidateScene[] = visualPlan.insertions
  .filter((item) => !['R04A', 'R04B', 'R04C'].includes(item.id))
  .map((item) => ({
    id: item.id,
    beatId: item.beatId,
    kind: item.id.startsWith('P')
      ? 'paper'
      : item.id.startsWith('G')
        ? 'ai'
        : item.kind === 'video'
          ? 'public-video'
          : 'evidence-card',
    start: item.startFrame / visualPlan.canvas.fps,
    end: item.endFrameExclusive / visualPlan.canvas.fps,
    asset: item.src,
    sourceLabel: item.label,
    focusCount: focusCountFor(item.id),
  }));

const archiveScene: CandidateScene[] =
  r04Insertions.length === 3
    ? [
        {
          id: 'R04-archive-montage',
          beatId: 'B14',
          kind: 'archive-montage',
          start: r04Insertions[0].startFrame / visualPlan.canvas.fps,
          end:
            r04Insertions[r04Insertions.length - 1].endFrameExclusive /
            visualPlan.canvas.fps,
          sourceLabel: '授权公开档案 · 集装箱船 / 新泽西 / 深圳',
          detail:
            '集装箱化是重要条件之一；制造业转移与深圳发展不是单一因果。',
          segments: r04Insertions.map((item) => ({
            asset: item.src,
            startFrame: item.startFrame - r04Insertions[0].startFrame,
            endFrameExclusive:
              item.endFrameExclusive - r04Insertions[0].startFrame,
            label: item.label,
          })),
        },
      ]
    : [];

const speakerScenes: CandidateScene[] = visualPlan.speakerOverlays.map(
  (overlay, index) => ({
    id: overlay.id,
    beatId: overlay.beatId,
    kind: 'semantic',
    component: componentForOverlay(overlay.type),
    side: sideForOverlay(index),
    start: overlay.startFrame / visualPlan.canvas.fps,
    end: overlay.endFrameExclusive / visualPlan.canvas.fps,
    title: overlay.title,
    detail: overlay.subtitle,
    items: overlay.items,
  }),
);

const shotcraftScenes: CandidateScene[] = [
  {
    id: 'SHOTCRAFT-B03-marker-underline',
    beatId: 'B03',
    kind: 'shotcraft-marker',
    start: 466 / visualPlan.canvas.fps,
    end: 609 / visualPlan.canvas.fps,
    markerBefore: '这些词听起来',
    markerKeyword: '令人兴奋',
    markerAfter: '但它们掩盖了一个极其朴素的真相',
    region: {x: 72, y: 126, width: 548, height: 286},
  },
];

const scenes = [
  ...insertionScenes,
  ...archiveScene,
  ...speakerScenes,
  ...shotcraftScenes,
].sort((left, right) => left.start - right.start);

const plan = {
  durationSeconds: visualPlan.canvas.durationSeconds,
  sourceVideo: visualPlan.audioPolicy.hostSource,
  captionsSrc: 'data/actual-spoken.bilingual.candidate.v1.json',
  brandLabel: '超哥AI创业记',
  chapters,
  scenes,
  sfxCues: visualPlan.sfxCues.map((cue) => ({
    id: cue.id,
    time: cue.atFrame / visualPlan.canvas.fps,
    src: cue.src,
    volume: cue.volume,
  })),
};

export const AI_NO_NEW_BUSINESS_MODEL_R1_DURATION_IN_FRAMES = f(
  plan.durationSeconds,
);

const opaqueKinds = new Set<SceneKind>([
  'paper',
  'ai',
  'evidence-card',
  'archive-montage',
  'public-video',
]);

const productionScenes: V72ProductionScene[] = plan.scenes.map((scene) => ({
  id: scene.id,
  start: scene.start,
  end: scene.end,
  kind: 'custom',
  customKey: scene.kind,
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
  sourceFilter: 'contrast(1.035) saturate(1.018) brightness(1.005)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.16) 0%, rgba(2,7,12,0.01) 47%, rgba(2,7,12,0.08) 100%)',
  motion: {
    cuts: [...plan.scenes.map((scene) => scene.start), plan.durationSeconds],
    baseScale: 1.004,
    peakScales: [1.022, 1.016, 1.02, 1.015, 1.021, 1.017],
    peakX: [-5, 3, -4, 3, -5, 3],
    peakY: [-1, 0, -1, 0, -1, 0],
    transformOrigin: '50% 42%',
  },
  scenes: productionScenes,
  sfxCues,
};

const colors = {
  cyan: '#69D8F7',
  amber: '#FFC15A',
  coral: '#FF735F',
  green: '#6AD89A',
  white: '#F8FAFD',
  muted: 'rgba(238,245,250,0.82)',
  ink: '#071018',
};

const fadeForScene = (frame: number, durationInFrames: number) => {
  const fade = Math.min(9, Math.max(4, Math.round(durationInFrames * 0.06)));
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

const publicMaterialKinds = new Set<SceneKind>([
  'evidence-card',
  'archive-montage',
  'public-video',
]);

const publicMaterialViewport = {
  left: 394,
  top: 36,
  width: 1472,
  height: 828,
};

const PublicMaterialViewport: React.FC<{children: React.ReactNode}> = ({
  children,
}) => (
  <div
    style={{
      position: 'absolute',
      ...publicMaterialViewport,
      overflow: 'hidden',
      borderRadius: 16,
      background: '#071018',
      boxShadow: '0 18px 54px rgba(0,0,0,0.34)',
    }}
  >
    {children}
  </div>
);

const PublicMaterialPresenterInset: React.FC<{scene: CandidateScene}> = ({
  scene,
}) => {
  const frame = useCurrentFrame();
  const durationInFrames = Math.max(1, f(scene.end - scene.start));
  const enter = spring({
    frame,
    fps,
    durationInFrames: 14,
    config: {damping: 200},
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 10), durationInFrames],
    [1, 0],
    clamp,
  );
  const visible = Math.min(enter, exit);

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        bottom: 54,
        zIndex: 42,
        width: 310,
        height: 214,
        overflow: 'hidden',
        border: '4px solid rgba(248,250,253,0.96)',
        borderRadius: 18,
        boxSizing: 'border-box',
        background: '#071018',
        boxShadow: '0 16px 44px rgba(0,0,0,0.48)',
        opacity: visible,
        transform: `translateY(${interpolate(visible, [0, 1], [12, 0], clamp)}px) scale(${interpolate(visible, [0, 1], [0.96, 1], clamp)})`,
        transformOrigin: '0 100%',
      }}
    >
      <Video
        src={staticFile(plan.sourceVideo)}
        trimBefore={f(scene.start)}
        muted
        volume={0}
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          objectPosition: '59% 42%',
          filter: config.sourceFilter,
        }}
      />
    </div>
  );
};

const SourceTag: React.FC<{
  label?: string;
  tone?: 'cyan' | 'amber' | 'coral';
}> = ({label, tone = 'cyan'}) => {
  if (!label) return null;
  const color =
    tone === 'amber' ? colors.amber : tone === 'coral' ? colors.coral : colors.cyan;
  return (
    <div
      style={{
        position: 'absolute',
        right: 44,
        top: 28,
        zIndex: 30,
        maxWidth: 760,
        padding: '8px 13px 9px',
        color: colors.white,
        background: 'rgba(3,9,14,0.82)',
        borderLeft: `4px solid ${color}`,
        boxShadow: '0 8px 28px rgba(0,0,0,0.24)',
        fontFamily,
        fontSize: 17,
        lineHeight: 1.2,
        fontWeight: 900,
        textAlign: 'right',
        textShadow: '0 2px 10px rgba(0,0,0,0.96)',
      }}
    >
      {label}
    </div>
  );
};

const highlightTerms = [
  'AI',
  '商业模式',
  '成本',
  '效率',
  '新秩序',
  '人工假设',
  '模型预测',
  '理解客户',
  '人类判断',
];

const HighlightedText: React.FC<{text: string}> = ({text}) => {
  const terms = [...highlightTerms].sort((a, b) => b.length - a.length);
  const parts: Array<{value: string; active: boolean}> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const term = terms.find((candidate) => text.startsWith(candidate, cursor));
    if (term) {
      parts.push({value: term, active: true});
      cursor += term.length;
      continue;
    }
    const next = terms
      .map((candidate) => text.indexOf(candidate, cursor + 1))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];
    const end = next ?? text.length;
    parts.push({value: text.slice(cursor, end), active: false});
    cursor = end;
  }
  return (
    <>
      {parts.map((part, index) => (
        <span
          key={`${part.value}-${index}`}
          style={{color: part.active ? colors.amber : colors.white}}
        >
          {part.value}
        </span>
      ))}
    </>
  );
};

const eyebrowFor = (component: SemanticComponent | undefined) => {
  switch (component) {
    case 'hook':
      return '本期命题';
    case 'question':
      return '关键问题';
    case 'chapter':
      return '视角切换';
    case 'metric':
      return '量级说明';
    case 'comparison':
      return '对照关系';
    case 'switch':
      return '机制切换';
    case 'warning':
      return '口径边界';
    case 'process':
      return '工作流程';
    case 'closing':
    case 'quote':
      return '最后的判断';
    case 'signoff':
      return '超哥AI创业记';
    default:
      return '核心逻辑';
  }
};

const SemanticItems: React.FC<{
  scene: CandidateScene;
  frame: number;
}> = ({scene, frame}) => {
  const items = scene.items ?? [];
  if (items.length === 0) return null;

  if (scene.component === 'process') {
    const rail = interpolate(frame, [7, 54], [0, 1], clamp);
    return (
      <div style={{position: 'relative', marginTop: 22, paddingLeft: 38}}>
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: 12,
            bottom: 12,
            width: 3,
            background: 'rgba(255,255,255,0.18)',
          }}
        >
          <div
            style={{
              width: '100%',
              height: `${rail * 100}%`,
              background: colors.cyan,
              boxShadow: '0 0 13px rgba(105,216,247,0.72)',
            }}
          />
        </div>
        {items.slice(0, 4).map((item, index) => {
          const reveal = spring({
            frame: frame - 7 - index * 7,
            fps,
            config: {damping: 22, stiffness: 190, mass: 0.82},
          });
          return (
            <div
              key={item}
              style={{
                position: 'relative',
                minHeight: 49,
                color: colors.white,
                fontSize: 25,
                fontWeight: 900,
                opacity: reveal,
                transform: `translateX(${(1 - reveal) * -10}px)`,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: -37,
                  top: 0,
                  width: 23,
                  height: 23,
                  display: 'grid',
                  placeItems: 'center',
                  color: colors.ink,
                  background: colors.cyan,
                  fontSize: 12,
                  fontWeight: 950,
                }}
              >
                {index + 1}
              </span>
              {item}
            </div>
          );
        })}
      </div>
    );
  }

  if (scene.component === 'switch' || scene.component === 'comparison') {
    return (
      <div style={{display: 'grid', gap: 10, marginTop: 21}}>
        {items.slice(0, 3).map((item, index) => {
          const reveal = spring({
            frame: frame - 8 - index * 7,
            fps,
            config: {damping: 21, stiffness: 188, mass: 0.8},
          });
          const color = index === items.length - 1 ? colors.amber : colors.cyan;
          return (
            <div
              key={item}
              style={{
                padding: '10px 13px',
                color: colors.white,
                background: 'rgba(2,9,14,0.6)',
                borderLeft: `4px solid ${color}`,
                fontSize: 24,
                fontWeight: 900,
                opacity: reveal,
                transform: `translateX(${(1 - reveal) * 12}px)`,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 21}}>
      {items.slice(0, 4).map((item, index) => {
        const reveal = spring({
          frame: frame - 7 - index * 6,
          fps,
          config: {damping: 22, stiffness: 190, mass: 0.82},
        });
        return (
          <div
            key={item}
            style={{
              padding: '9px 12px',
              color: colors.white,
              background: 'rgba(3,10,16,0.58)',
              borderBottom: `3px solid ${index === items.length - 1 ? colors.amber : colors.cyan}`,
              fontSize: 22,
              lineHeight: 1.05,
              fontWeight: 900,
              opacity: reveal,
              transform: `translateY(${(1 - reveal) * 9}px)`,
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
};

const SemanticScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  const opacity = fadeForScene(frame, durationInFrames);
  const reveal = spring({
    frame,
    fps,
    config: {damping: 22, stiffness: 178, mass: 0.84},
  });
  const side = scene.side ?? 'left';
  const width = scene.component === 'signoff' ? 460 : 560;
  const left = side === 'left' ? 54 : 1920 - 54 - width;
  const top = scene.component === 'hook' ? 226 : scene.component === 'signoff' ? 292 : 162;
  const enterX = side === 'left' ? -22 : 22;
  const titleLength = [...(scene.title ?? '')].length;
  const titleSize =
    scene.component === 'metric'
      ? 54
      : scene.component === 'signoff'
        ? 50
        : titleLength > 24
          ? 39
          : titleLength > 17
            ? 44
            : 49;
  const accent = scene.component === 'warning' ? colors.coral : colors.cyan;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        padding: scene.component === 'signoff' ? '23px 26px 22px' : '22px 25px 24px',
        boxSizing: 'border-box',
        color: colors.white,
        background:
          'linear-gradient(135deg, rgba(3,10,16,0.83), rgba(3,10,16,0.56))',
        borderLeft: `5px solid ${accent}`,
        boxShadow: '0 18px 54px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(8px)',
        fontFamily,
        opacity,
        transform: `translateX(${interpolate(reveal, [0, 1], [enterX, 0])}px)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          color: accent,
          fontSize: 17,
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: 1.1,
        }}
      >
        <span style={{width: 26, height: 3, background: accent}} />
        {eyebrowFor(scene.component)}
      </div>
      <div
        style={{
          marginTop: 14,
          color: colors.white,
          fontSize: titleSize,
          lineHeight: 1.08,
          fontWeight: 950,
          letterSpacing: -0.5,
          whiteSpace: 'pre-line',
          textShadow: '0 3px 16px rgba(0,0,0,0.96)',
        }}
      >
        <HighlightedText text={scene.title ?? ''} />
      </div>
      {scene.detail ? (
        <div
          style={{
            marginTop: 14,
            color: colors.muted,
            fontSize: scene.component === 'signoff' ? 26 : 24,
            lineHeight: 1.35,
            fontWeight: 760,
            textShadow: '0 2px 12px rgba(0,0,0,0.98)',
          }}
        >
          {scene.detail}
        </div>
      ) : null}
      <SemanticItems scene={scene} frame={frame} />
    </div>
  );
};

const GeneratedScene: React.FC<{
  scene: CandidateScene;
  mode: 'paper' | 'ai';
}> = ({scene, mode}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  if (!scene.asset) return null;
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#071018',
        opacity: fadeForScene(frame, durationInFrames),
      }}
    >
      <Video
        src={staticFile(scene.asset)}
        muted
        volume={0}
        objectFit="cover"
        style={{width: '100%', height: '100%'}}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(2,7,12,0.12) 0%, rgba(2,7,12,0) 70%, rgba(2,7,12,0.16) 100%)',
        }}
      />
      <SourceTag
        label={scene.sourceLabel}
        tone={mode === 'ai' ? 'amber' : 'cyan'}
      />
    </AbsoluteFill>
  );
};

const FocusSweep: React.FC<{
  sceneId: string;
  count: number;
  frame: number;
  durationInFrames: number;
}> = ({sceneId, count, frame, durationInFrames}) => {
  const safeCount = Math.max(1, count);
  const progress = interpolate(frame, [10, Math.max(11, durationInFrames - 12)], [0, 1], clamp);
  const active = Math.min(safeCount - 1, Math.floor(progress * safeCount));
  const layouts: Record<string, Array<{x: number; y: number; width: number; height: number}>> = {
    R01: [
      {x: 96, y: 250, width: 540, height: 620},
      {x: 690, y: 250, width: 540, height: 620},
      {x: 1284, y: 250, width: 540, height: 620},
    ],
    R02: [
      {x: 96, y: 250, width: 396, height: 620},
      {x: 530, y: 250, width: 396, height: 620},
      {x: 964, y: 250, width: 396, height: 620},
      {x: 1398, y: 250, width: 426, height: 620},
    ],
    R03: [
      {x: 96, y: 270, width: 820, height: 560},
      {x: 1004, y: 270, width: 820, height: 560},
    ],
    R05: [
      {x: 96, y: 270, width: 490, height: 560},
      {x: 715, y: 270, width: 490, height: 560},
      {x: 1334, y: 270, width: 490, height: 560},
    ],
  };
  const fallbackGap = safeCount === 4 ? 23 : safeCount === 3 ? 34 : 46;
  const fallbackAvailable = 1920 - fallbackGap * (safeCount + 1);
  const fallbackWidth = fallbackAvailable / safeCount;
  const fallback = Array.from({length: safeCount}, (_, index) => ({
    x: fallbackGap + index * (fallbackWidth + fallbackGap),
    y: 232,
    width: fallbackWidth,
    height: 625,
  }));
  const rect = (layouts[sceneId] ?? fallback)[active] ?? fallback[0];
  const pulse = 0.72 + 0.28 * Math.sin((frame / fps) * Math.PI * 1.2);
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        border: `4px solid rgba(255,115,95,${pulse})`,
        borderRadius: 34,
        boxShadow: `0 0 0 9999px rgba(4,10,14,0.04), 0 0 22px rgba(255,115,95,${0.24 * pulse})`,
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}
    />
  );
};

const EvidenceCardScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  if (!scene.asset) return null;
  const opacity = fadeForScene(frame, durationInFrames);
  const cardScale = publicMaterialViewport.width / 1920;
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#0A1420',
        opacity,
      }}
    >
      <PublicMaterialViewport>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1920,
            height: 1080,
            transform: `scale(${cardScale})`,
            transformOrigin: '0 0',
          }}
        >
          <Img
            src={staticFile(scene.asset)}
            style={{width: 1920, height: 1080, objectFit: 'contain'}}
          />
          {(scene.focusCount ?? 0) > 0 ? (
            <FocusSweep
              sceneId={scene.id}
              count={scene.focusCount ?? 1}
              frame={frame}
              durationInFrames={durationInFrames}
            />
          ) : null}
        </div>
      </PublicMaterialViewport>
      <PublicMaterialPresenterInset scene={scene} />
    </AbsoluteFill>
  );
};

const montageOpacity = (
  frame: number,
  startFrame: number,
  endFrameExclusive: number,
  isFirst: boolean,
  isLast: boolean,
) => {
  const fade = 10;
  const enter =
    isFirst
      ? interpolate(frame, [0, fade], [0, 1], clamp)
      : interpolate(
          frame,
          [startFrame - fade, startFrame + fade],
          [0, 1],
          clamp,
        );
  const exit =
    isLast
      ? interpolate(
          frame,
          [endFrameExclusive - fade, endFrameExclusive],
          [1, 0],
          clamp,
        )
      : interpolate(
          frame,
          [endFrameExclusive - fade, endFrameExclusive + fade],
          [1, 0],
          clamp,
        );
  return Math.min(enter, exit);
};

const ArchiveMontageScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  const segments = scene.segments ?? [];
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#071018',
        opacity: fadeForScene(frame, durationInFrames),
      }}
    >
      <PublicMaterialViewport>
        {segments.map((segment, index) => {
          const opacity = montageOpacity(
            frame,
            segment.startFrame,
            segment.endFrameExclusive,
            index === 0,
            index === segments.length - 1,
          );
          const commonStyle: React.CSSProperties = {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity,
          };
          return segment.asset.endsWith('.mp4') ? (
            <Video
              key={segment.asset}
              src={staticFile(segment.asset)}
              muted
              volume={0}
              style={commonStyle}
            />
          ) : (
            <Img
              key={segment.asset}
              src={staticFile(segment.asset)}
              style={commonStyle}
            />
          );
        })}
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(180deg, rgba(3,9,14,0.22) 0%, rgba(3,9,14,0) 36%, rgba(3,9,14,0.08) 100%)',
          }}
        />
      </PublicMaterialViewport>
      {scene.detail ? (
        <div
          style={{
            position: 'absolute',
            left: publicMaterialViewport.left + 24,
            top: 76,
            width: 890,
            padding: '13px 17px 14px',
            color: colors.white,
            background: 'rgba(3,9,14,0.76)',
            borderLeft: `5px solid ${colors.coral}`,
            fontFamily,
            fontSize: 24,
            lineHeight: 1.35,
            fontWeight: 850,
            textShadow: '0 2px 12px rgba(0,0,0,0.98)',
          }}
        >
          {scene.detail}
        </div>
      ) : null}
      <PublicMaterialPresenterInset scene={scene} />
    </AbsoluteFill>
  );
};

const PublicVideoScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = f(scene.end - scene.start);
  if (!scene.asset) return null;
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#071018',
        opacity: fadeForScene(frame, durationInFrames),
      }}
    >
      <PublicMaterialViewport>
        <Video
          src={staticFile(scene.asset)}
          muted
          volume={0}
          objectFit="contain"
          style={{width: '100%', height: '100%'}}
        />
      </PublicMaterialViewport>
      <PublicMaterialPresenterInset scene={scene} />
    </AbsoluteFill>
  );
};

const ShotcraftMarkerScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = Math.max(1, f(scene.end - scene.start));
  const region = scene.region ?? {x: 72, y: 126, width: 548, height: 286};
  return (
    <div
      style={{
        position: 'absolute',
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height,
        overflow: 'hidden',
        fontFamily,
      }}
    >
      <MarkerUnderline
        frame={frame}
        fps={fps}
        durationInFrames={durationInFrames}
        before={scene.markerBefore}
        keyword={scene.markerKeyword ?? ''}
        after={scene.markerAfter}
        fontSize={52}
      />
    </div>
  );
};

const renderCustomScene = (wrappedScene: V72CustomScene) => {
  const scene = wrappedScene.data as unknown as CandidateScene;
  switch (scene.kind) {
    case 'paper':
      return <GeneratedScene scene={scene} mode="paper" />;
    case 'ai':
      return <GeneratedScene scene={scene} mode="ai" />;
    case 'evidence-card':
      return <EvidenceCardScene scene={scene} />;
    case 'archive-montage':
      return <ArchiveMontageScene scene={scene} />;
    case 'public-video':
      return <PublicVideoScene scene={scene} />;
    case 'shotcraft-marker':
      return <ShotcraftMarkerScene scene={scene} />;
    case 'semantic':
    default:
      return <SemanticScene scene={scene} />;
  }
};

const normalizeCaptionDocument = (input: unknown): CaptionPage[] => {
  const raw = Array.isArray(input)
    ? input
    : Array.isArray((input as CaptionDocument | null)?.pages)
      ? ((input as CaptionDocument).pages ?? [])
      : [];
  return raw
    .map((item) => {
      const page = item as Partial<CaptionPage>;
      return {
        id: String(page.id ?? ''),
        startMs: Number(page.startMs ?? 0),
        endMs: Number(page.endMs ?? 0),
        zh: String(page.zh ?? '').trim(),
        en: String(page.en ?? '').trim(),
        reviewRequired: Boolean(page.reviewRequired),
      };
    })
    .filter((page) => page.zh && page.en && page.endMs > page.startMs)
    .sort((a, b) => a.startMs - b.startMs);
};

const captionChineseSize = (length: number) => {
  if (length >= 22) return 34;
  if (length >= 18) return 37;
  return 40;
};

const captionEnglishSize = (length: number) => {
  if (length >= 100) return 15;
  if (length >= 82) return 16;
  if (length >= 66) return 17;
  return 19;
};

const ActualSpokenCaptionOverlay: React.FC<{captionsSrc: string}> = ({
  captionsSrc,
}) => {
  const [captions, setCaptions] = useState<CaptionPage[] | null>(null);
  const [handle] = useState(() => delayRender('加载本期实录中英字幕'));

  const load = useCallback(async () => {
    try {
      const response = await fetch(staticFile(captionsSrc));
      if (!response.ok) {
        throw new Error(`字幕加载失败: ${response.status} ${captionsSrc}`);
      }
      const raw: unknown = await response.json();
      const normalized = normalizeCaptionDocument(raw);
      if (normalized.length === 0) {
        throw new Error(`字幕文档不含可用 pages: ${captionsSrc}`);
      }
      setCaptions(normalized);
      continueRender(handle);
    } catch (error) {
      cancelRender(error as Error);
    }
  }, [captionsSrc, handle]);

  useEffect(() => {
    load();
  }, [load]);

  if (!captions) return null;
  return <ActualSpokenCaptionPages captions={captions} />;
};

const ActualSpokenCaptionPages: React.FC<{captions: CaptionPage[]}> = ({
  captions,
}) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const nowMs = (frame / compositionFps) * 1000;
  const current = useMemo(
    () =>
      captions.find(
        (caption) => nowMs >= caption.startMs && nowMs < caption.endMs,
      ),
    [captions, nowMs],
  );
  if (!current) return null;

  const currentSeconds = frame / compositionFps;
  const publicMaterialActive = plan.scenes.some(
    (scene) =>
      publicMaterialKinds.has(scene.kind) &&
      currentSeconds >= scene.start &&
      currentSeconds < scene.end,
  );

  const fadeMs = Math.min(
    90,
    Math.max(45, (current.endMs - current.startMs) * 0.06),
  );
  const opacity = Math.min(
    interpolate(
      nowMs,
      [current.startMs, current.startMs + fadeMs],
      [0, 1],
      clamp,
    ),
    interpolate(
      nowMs,
      [current.endMs - fadeMs, current.endMs],
      [1, 0],
      clamp,
    ),
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: publicMaterialActive ? publicMaterialViewport.left : '50%',
        bottom: 38,
        zIndex: 320,
        width: publicMaterialActive ? publicMaterialViewport.width : 1540,
        minHeight: 108,
        transform: publicMaterialActive ? 'none' : 'translateX(-50%)',
        boxSizing: 'border-box',
        padding: publicMaterialActive ? '7px 22px 9px' : '7px 28px 9px',
        color: colors.white,
        background:
          publicMaterialActive
            ? 'linear-gradient(90deg, rgba(2,7,12,0.82) 0%, rgba(2,7,12,0.62) 50%, rgba(2,7,12,0.2) 100%)'
            : 'linear-gradient(90deg, rgba(2,7,12,0) 0%, rgba(2,7,12,0.47) 13%, rgba(2,7,12,0.47) 87%, rgba(2,7,12,0) 100%)',
        fontFamily,
        textAlign: 'center',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <div
        style={{
          color: colors.white,
          fontSize: captionChineseSize([...current.zh].length),
          lineHeight: 1.12,
          fontWeight: 950,
          whiteSpace: 'nowrap',
          WebkitTextStroke: '1.2px rgba(0,0,0,0.9)',
          textShadow: '0 3px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.74)',
        }}
      >
        <HighlightedText text={current.zh} />
      </div>
      <div
        style={{
          marginTop: 5,
          color: 'rgba(247,250,255,0.84)',
          fontSize: captionEnglishSize(current.en.length),
          lineHeight: 1.08,
          fontWeight: 680,
          whiteSpace: 'nowrap',
          textShadow: '0 2px 7px rgba(0,0,0,1), 0 0 12px rgba(0,0,0,0.8)',
        }}
      >
        {current.en}
      </div>
    </div>
  );
};

const ChapterAnchor: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  const opaqueScene = plan.scenes.find(
    (scene) =>
      opaqueKinds.has(scene.kind) && seconds >= scene.start && seconds < scene.end,
  );
  if (opaqueScene) return null;
  const chapter =
    [...plan.chapters].reverse().find((item) => seconds >= item.start) ??
    plan.chapters[0];
  const reveal = interpolate(seconds - chapter.start, [0, 0.28], [0, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 66,
        zIndex: 215,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: colors.white,
        fontFamily,
        fontSize: 19,
        fontWeight: 900,
        textShadow: '0 3px 15px rgba(0,0,0,0.96)',
        opacity: reveal,
      }}
    >
      <span style={{color: colors.cyan, fontSize: 27, fontWeight: 950}}>
        {chapter.index}
      </span>
      <span style={{width: 32, height: 2, background: colors.cyan}} />
      <span>{chapter.title}</span>
    </div>
  );
};

const PersistentLayers: React.FC = () => (
  <>
    <ChapterAnchor />
    <ActualSpokenCaptionOverlay captionsSrc={plan.captionsSrc} />
  </>
);

const Candidate: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
    persistentOverlay={<PersistentLayers />}
  />
);

export const AINoNewBusinessModelV8CandidateR1WithSfx: React.FC = () => (
  <Candidate soundEnabled />
);

export const AINoNewBusinessModelV8CandidateR1NoSfx: React.FC = () => (
  <Candidate soundEnabled={false} />
);
