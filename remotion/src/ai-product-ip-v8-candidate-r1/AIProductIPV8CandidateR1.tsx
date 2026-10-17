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
import candidatePlan from './candidate-plan.v1.json';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

type ClipId = 'PV01' | 'PV02' | 'PV03' | 'PV04';
type SceneSide = 'left' | 'right';

type CandidateScene = {
  id: string;
  kind: 'paper' | 'semantic';
  component?: string;
  side?: SceneSide;
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
  chapters: Array<{start: number; index: string; title: string}>;
  scenes: CandidateScene[];
  sfxCues: Array<{id: string; time: number; src: string; volume: number}>;
};

const plan = candidatePlan as CandidatePlan;
export const AI_PRODUCT_IP_R1_DURATION_IN_FRAMES = f(plan.durationSeconds);

const scenes: V72ProductionScene[] = plan.scenes.map((scene) => ({
  id: scene.id,
  start: scene.start,
  end: scene.end,
  kind: 'custom',
  customKey: scene.kind === 'paper' ? 'paper' : scene.component ?? 'statement',
  data: scene as unknown as Record<string, unknown>,
  background: scene.kind === 'paper' ? 'opaque' : 'talk',
  zIndex: scene.kind === 'paper' ? 180 : 90,
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
  sourceFilter: 'contrast(1.04) saturate(1.025) brightness(1.005)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.16) 0%, rgba(2,7,12,0.01) 48%, rgba(2,7,12,0.05) 100%)',
  motion: {
    cuts: [...plan.scenes.map((scene) => scene.start), plan.durationSeconds],
    baseScale: 1.006,
    peakScales: [1.028, 1.024, 1.03, 1.025, 1.029, 1.024],
    peakX: [-7, 5, -6, 4, -7, 5],
    peakY: [-2, -1, -2, -1, -2, -1],
    transformOrigin: '50% 42%',
  },
  scenes,
  sfxCues,
};

const accent = {
  cyan: '#69D8F7',
  amber: '#FFC15A',
  green: '#67D89A',
  red: '#FF756E',
  white: '#F8FAFD',
  ink: '#071017',
};

const sceneOpacity = (frame: number, durationInFrames: number) => {
  const fade = Math.min(9, Math.max(4, Math.round(durationInFrames * 0.08)));
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

const HighlightedText: React.FC<{text: string}> = ({text}) => {
  const pieces = text.split(
    /(AI|个人IP|技术|信任|落地服务|商业认知|产品|变现|客户|工具|模板|终局)/g,
  );
  return (
    <>
      {pieces.map((piece, index) => {
        const warm = ['信任', '落地服务', '商业认知', '变现', '客户', '终局'].includes(
          piece,
        );
        const cool = ['AI', '个人IP', '技术', '产品', '工具', '模板'].includes(
          piece,
        );
        return (
          <span
            key={`${piece}-${index}`}
            style={{color: warm ? accent.amber : cool ? accent.cyan : accent.white}}
          >
            {piece}
          </span>
        );
      })}
    </>
  );
};

const PanelHeader: React.FC<{
  title: string;
  detail: string;
  eyebrow?: string;
}> = ({title, detail, eyebrow = '关键判断'}) => (
  <>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: accent.cyan,
        fontSize: 21,
        lineHeight: 1,
        fontWeight: 950,
      }}
    >
      <span style={{width: 27, height: 3, background: accent.cyan}} />
      {eyebrow}
    </div>
    <div
      style={{
        marginTop: 15,
        maxWidth: 650,
        fontSize: [...title].length > 16 ? 48 : 58,
        lineHeight: 1.08,
        fontWeight: 950,
        letterSpacing: 0,
        whiteSpace: 'pre-line',
        textShadow: '0 4px 20px rgba(0,0,0,0.98)',
      }}
    >
      <HighlightedText text={title} />
    </div>
    <div
      style={{
        marginTop: 15,
        maxWidth: 620,
        color: 'rgba(248,250,253,0.9)',
        fontSize: 27,
        lineHeight: 1.3,
        fontWeight: 820,
        textShadow: '0 3px 17px rgba(0,0,0,0.98)',
      }}
    >
      {detail}
    </div>
  </>
);

const ItemChip: React.FC<{
  text: string;
  index: number;
  frame: number;
  color?: string;
}> = ({text, index, frame, color = accent.cyan}) => {
  const reveal = spring({
    frame: frame - 8 - index * 6,
    fps,
    config: {damping: 22, stiffness: 190, mass: 0.82},
  });
  return (
    <div
      style={{
        minWidth: 128,
        padding: '10px 14px',
        boxSizing: 'border-box',
        color: accent.white,
        background: 'rgba(3,11,17,0.55)',
        borderLeft: `4px solid ${color}`,
        fontSize: 25,
        lineHeight: 1.08,
        fontWeight: 920,
        opacity: reveal,
        transform: `translateY(${(1 - reveal) * 12}px)`,
        textShadow: '0 2px 12px rgba(0,0,0,0.95)',
      }}
    >
      {text}
    </div>
  );
};

const LogoRail: React.FC<{items: string[]; frame: number}> = ({items, frame}) => {
  const logos: Record<string, string> = {
    GitHub: 'brands/ai-levels/github.svg',
    n8n: 'brands/ai-levels/n8n.svg',
    Dify: 'brands/ai-levels/dify.svg',
    Cursor: 'brands/ai-levels/cursor.png',
  };
  return (
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginTop: 25}}>
      {items.slice(0, 4).map((item, index) => {
        const reveal = spring({
          frame: frame - 8 - index * 5,
          fps,
          config: {damping: 22, stiffness: 188, mass: 0.82},
        });
        return (
          <div
            key={item}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              height: 68,
              padding: '0 16px',
              boxSizing: 'border-box',
              color: accent.white,
              background: 'rgba(3,11,17,0.58)',
              borderBottom: `3px solid ${index === 0 ? accent.amber : accent.cyan}`,
              fontSize: 25,
              fontWeight: 920,
              opacity: reveal,
              transform: `translateY(${(1 - reveal) * 12}px)`,
            }}
          >
            <div
              style={{
                width: 37,
                height: 37,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,0.94)',
              }}
            >
              <Img
                src={staticFile(logos[item])}
                style={{width: 30, height: 30, objectFit: 'contain'}}
              />
            </div>
            {item}
          </div>
        );
      })}
    </div>
  );
};

const ComparisonRows: React.FC<{items: string[]; frame: number}> = ({
  items,
  frame,
}) => (
  <div style={{display: 'grid', gap: 17, marginTop: 26}}>
    {items.slice(0, 2).map((item, index) => {
      const reveal = spring({
        frame: frame - 8 - index * 9,
        fps,
        config: {damping: 22, stiffness: 188, mass: 0.82},
      });
      const color = index === 0 ? accent.cyan : accent.amber;
      return (
        <div key={item} style={{opacity: reveal}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 13}}>
            <span style={{color, fontSize: 19, fontWeight: 950}}>0{index + 1}</span>
            <span
              style={{
                color: accent.white,
                fontSize: 31,
                lineHeight: 1.14,
                fontWeight: 930,
              }}
            >
              {item}
            </span>
          </div>
          <div style={{marginTop: 8, width: 590, height: 7, background: 'rgba(255,255,255,0.12)'}}>
            <div
              style={{
                width: `${(index === 0 ? 92 : 58) * reveal}%`,
                height: '100%',
                background: color,
                boxShadow: `0 0 15px ${color}77`,
              }}
            />
          </div>
        </div>
      );
    })}
  </div>
);

const NodeGrid: React.FC<{items: string[]; frame: number}> = ({items, frame}) => (
  <div
    style={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 15,
      marginTop: 26,
    }}
  >
    {items.slice(0, 4).map((item, index) => {
      const reveal = spring({
        frame: frame - 7 - index * 6,
        fps,
        config: {damping: 22, stiffness: 190, mass: 0.82},
      });
      const color = index === 3 ? accent.amber : accent.cyan;
      return (
        <div
          key={item}
          style={{
            height: 80,
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
            boxSizing: 'border-box',
            color: accent.white,
            background: 'rgba(3,11,17,0.58)',
            borderLeft: `5px solid ${color}`,
            fontSize: 29,
            fontWeight: 930,
            opacity: reveal,
            transform: `translateX(${(1 - reveal) * 15}px)`,
          }}
        >
          {item}
        </div>
      );
    })}
  </div>
);

const ProcessRail: React.FC<{items: string[]; frame: number}> = ({items, frame}) => {
  const progress = interpolate(frame, [6, 48], [0, 1], clamp);
  return (
    <div style={{position: 'relative', marginTop: 24, paddingLeft: 48}}>
      <div
        style={{
          position: 'absolute',
          left: 14,
          top: 18,
          width: 3,
          height: 70 * Math.max(0, items.length - 1),
          background: 'rgba(255,255,255,0.16)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: `${progress * 100}%`,
            background: accent.cyan,
            boxShadow: '0 0 15px rgba(105,216,247,0.75)',
          }}
        />
      </div>
      {items.slice(0, 4).map((item, index) => {
        const active = interpolate(
          progress,
          [index * 0.19, Math.min(1, index * 0.19 + 0.27)],
          [0, 1],
          clamp,
        );
        return (
          <div
            key={item}
            style={{
              position: 'relative',
              minHeight: 70,
              color: accent.white,
              fontSize: 28,
              lineHeight: 1.15,
              fontWeight: 920,
              opacity: 0.32 + active * 0.68,
              transform: `translateX(${(1 - active) * -12}px)`,
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: -47,
                top: 2,
                width: 26,
                height: 26,
                display: 'grid',
                placeItems: 'center',
                color: active > 0.72 ? accent.ink : accent.cyan,
                background: active > 0.72 ? accent.cyan : '#07121A',
                border: `2px solid ${accent.cyan}`,
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
};

const BridgeRail: React.FC<{items: string[]; frame: number}> = ({items, frame}) => {
  const bridge = ['AI产品', ...items.slice(0, 2), items[2] ?? '溢价能力'];
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 9, marginTop: 30}}>
      {bridge.map((item, index) => {
        const reveal = spring({
          frame: frame - 8 - index * 7,
          fps,
          config: {damping: 22, stiffness: 188, mass: 0.82},
        });
        return (
          <React.Fragment key={`${item}-${index}`}>
            <div
              style={{
                minWidth: index === 0 ? 116 : 126,
                padding: '14px 12px',
                color: index === bridge.length - 1 ? accent.amber : accent.white,
                background: 'rgba(3,11,17,0.58)',
                borderBottom: `3px solid ${index === bridge.length - 1 ? accent.amber : accent.cyan}`,
                fontSize: 23,
                fontWeight: 930,
                textAlign: 'center',
                opacity: reveal,
              }}
            >
              {item}
            </div>
            {index < bridge.length - 1 ? (
              <span style={{color: accent.cyan, fontSize: 27, fontWeight: 950, opacity: reveal}}>
                →
              </span>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const HostSemanticScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const durationInFrames = Math.max(1, f(scene.end - scene.start));
  const opacity = sceneOpacity(frame, durationInFrames);
  const reveal = spring({
    frame,
    fps,
    config: {damping: 22, stiffness: 178, mass: 0.84},
  });
  const side = scene.side ?? 'left';
  const sideOffset = side === 'left' ? 54 : 1920 - 54 - 660;
  const enterX = side === 'left' ? -24 : 24;
  const items = scene.items ?? [];
  const title = scene.title ?? '';
  const detail = scene.detail ?? '';

  return (
    <div
      style={{
        position: 'absolute',
        left: sideOffset,
        top: scene.component === 'hook' ? 245 : 165,
        width: 660,
        color: accent.white,
        fontFamily,
        opacity,
        transform: `translateX(${interpolate(reveal, [0, 1], [enterX, 0])}px)`,
      }}
    >
      <PanelHeader
        title={title}
        detail={detail}
        eyebrow={
          scene.component === 'hook'
            ? '本期判断'
            : scene.component === 'closing'
              ? '行动方向'
              : scene.component === 'comparison'
                ? '对照关系'
                : scene.component === 'process'
                  ? '结果路径'
                  : '核心逻辑'
        }
      />

      {scene.component === 'logos' ? <LogoRail items={items} frame={frame} /> : null}
      {scene.component === 'comparison' ? (
        <ComparisonRows items={items} frame={frame} />
      ) : null}
      {scene.component === 'nodes' ? <NodeGrid items={items} frame={frame} /> : null}
      {scene.component === 'process' ? <ProcessRail items={items} frame={frame} /> : null}
      {scene.component === 'bridge' ? <BridgeRail items={items} frame={frame} /> : null}
      {['hook', 'thesis', 'closing'].includes(scene.component ?? '') ? (
        <div style={{display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap'}}>
          {items.slice(0, 3).map((item, index) => (
            <ItemChip
              key={item}
              text={item}
              index={index}
              frame={frame}
              color={index === items.length - 1 ? accent.amber : accent.cyan}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

type PaperTagSpec = {
  text: string;
  x: number;
  y: number;
  delay: number;
  color?: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
};

const paperTags: Record<ClipId, {headline: string; tags: PaperTagSpec[]}> = {
  PV01: {
    headline: '做出来更快，不等于卖出去更容易',
    tags: [
      {text: '做出来更快', x: 430, y: 284, delay: 9, color: accent.cyan, width: 210},
      {text: 'AI产品', x: 822, y: 486, delay: 24, color: accent.white, width: 150},
      {text: '卖出去更难', x: 1380, y: 390, delay: 50, color: accent.amber, width: 210},
    ],
  },
  PV02: {
    headline: '技术与模板正在快速普及',
    tags: [
      {text: 'Vibe Coding', x: 204, y: 204, delay: 7, color: accent.cyan, width: 190},
      {text: '智能体', x: 526, y: 204, delay: 16, color: accent.cyan, width: 140},
      {text: '流程', x: 814, y: 204, delay: 25, color: accent.cyan, width: 120},
      {text: '自动化', x: 1087, y: 204, delay: 34, color: accent.cyan, width: 140},
      {text: 'GitHub', x: 1530, y: 696, delay: 54, color: accent.amber, width: 150},
    ],
  },
  PV03: {
    headline: '客户买的从来不是工具，是结果',
    tags: [
      {text: '落地', x: 390, y: 174, delay: 8, color: accent.cyan, width: 116},
      {text: '省钱', x: 582, y: 174, delay: 18, color: accent.cyan, width: 116},
      {text: '获客', x: 777, y: 174, delay: 28, color: accent.cyan, width: 116},
      {text: '增收', x: 970, y: 174, delay: 38, color: accent.cyan, width: 116},
      {text: '真实问题', x: 1162, y: 174, delay: 48, color: accent.amber, width: 168},
    ],
  },
  PV04: {
    headline: 'AI产品通过个人IP走向客户',
    tags: [
      {text: 'AI产品', x: 116, y: 500, delay: 7, color: accent.cyan, width: 150},
      {text: '个人IP', x: 820, y: 164, delay: 18, color: accent.white, width: 160},
      {text: '信任', x: 708, y: 648, delay: 28, color: accent.cyan, width: 116},
      {text: '曝光', x: 900, y: 648, delay: 36, color: accent.cyan, width: 116},
      {text: '人设', x: 1092, y: 648, delay: 44, color: accent.cyan, width: 116},
      {text: '持续交付', x: 1280, y: 648, delay: 52, color: accent.amber, width: 170},
      {text: '客户', x: 1660, y: 470, delay: 62, color: accent.amber, width: 116},
    ],
  },
};

const PaperTag: React.FC<{spec: PaperTagSpec; frame: number}> = ({spec, frame}) => {
  const reveal = spring({
    frame: frame - spec.delay,
    fps,
    config: {damping: 21, stiffness: 195, mass: 0.78},
  });
  const color = spec.color ?? accent.cyan;
  return (
    <div
      style={{
        position: 'absolute',
        left: spec.x,
        top: spec.y,
        width: spec.width ?? 150,
        padding: '9px 13px',
        boxSizing: 'border-box',
        color,
        background: 'rgba(4,10,14,0.75)',
        borderLeft: `4px solid ${color}`,
        fontFamily,
        fontSize: 27,
        lineHeight: 1.05,
        fontWeight: 950,
        textAlign: spec.align ?? 'center',
        textShadow: '0 2px 10px rgba(0,0,0,0.96)',
        opacity: reveal,
        transform: `translateY(${(1 - reveal) * 12}px)`,
      }}
    >
      {spec.text}
    </div>
  );
};

const PaperLabelOverlay: React.FC<{clipId: ClipId}> = ({clipId}) => {
  const frame = useCurrentFrame();
  const spec = paperTags[clipId];
  const headlineReveal = spring({
    frame: frame - 4,
    fps,
    config: {damping: 22, stiffness: 188, mass: 0.82},
  });
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 72,
          maxWidth: 910,
          padding: '8px 18px 10px',
          color: accent.white,
          background: 'rgba(4,10,14,0.72)',
          borderBottom: `4px solid ${accent.cyan}`,
          fontFamily,
          fontSize: 36,
          lineHeight: 1.08,
          fontWeight: 950,
          textAlign: 'center',
          textShadow: '0 3px 14px rgba(0,0,0,0.98)',
          opacity: headlineReveal,
          transform: `translateX(-50%) translateY(${(1 - headlineReveal) * -10}px)`,
        }}
      >
        {spec.headline}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 54,
          top: 30,
          color: 'rgba(248,250,253,0.82)',
          fontFamily,
          fontSize: 17,
          fontWeight: 850,
          textShadow: '0 2px 10px rgba(0,0,0,0.98)',
        }}
      >
        AI生成 · 机制示意
      </div>
      {spec.tags.map((tag) => (
        <PaperTag key={tag.text} spec={tag} frame={frame} />
      ))}
    </AbsoluteFill>
  );
};

const GeneratedScene: React.FC<{scene: CandidateScene}> = ({scene}) => {
  if (!scene.clipId) return null;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#03070B'}}>
      <Video
        src={staticFile(`media/ai-product-ip-20260830-r1/${scene.clipId}.mp4`)}
        volume={plan.paperVolume}
        objectFit="cover"
        style={{width: '100%', height: '100%'}}
      />
      <PaperLabelOverlay clipId={scene.clipId} />
    </AbsoluteFill>
  );
};

const customRenderer = (wrappedScene: V72CustomScene) => {
  const scene = wrappedScene.data as unknown as CandidateScene;
  if (scene.kind === 'paper') {
    return <GeneratedScene scene={scene} />;
  }
  return <HostSemanticScene scene={scene} />;
};

const ChapterAnchor: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  const paperScene = plan.scenes.find(
    (scene) => scene.kind === 'paper' && seconds >= scene.start && seconds < scene.end,
  );
  if (paperScene) return null;

  const chapter =
    [...plan.chapters].reverse().find((item) => seconds >= item.start) ??
    plan.chapters[0];
  const reveal = interpolate(seconds - chapter.start, [0, 0.28], [0, 1], clamp);
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
        color: accent.white,
        fontFamily,
        textShadow: '0 3px 15px rgba(0,0,0,0.96)',
        opacity: reveal,
      }}
    >
      <span style={{color: accent.cyan, fontSize: 28, fontWeight: 950}}>
        {chapter.index}
      </span>
      <span style={{width: 34, height: 2, background: accent.cyan}} />
      <span style={{fontSize: 20, fontWeight: 900}}>{chapter.title}</span>
    </div>
  );
};

const Candidate: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={customRenderer}
    persistentOverlay={<ChapterAnchor />}
  />
);

export const AIProductIPV8CandidateR1WithSfx: React.FC = () => (
  <Candidate soundEnabled />
);

export const AIProductIPV8CandidateR1NoSfx: React.FC = () => (
  <Candidate soundEnabled={false} />
);
