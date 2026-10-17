import {Video} from '@remotion/media';
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
} from '../components/V72ProductionShell';
import sfxContract from './WechatGeoAaoV80.sfx.preview.v1.json';
import visualPlan from './WechatGeoAaoV80.visual-plan.preview.v1.json';

const fps = 30;
const durationSeconds = 331.466667;
const f = (seconds: number) => Math.round(seconds * fps);

export const WECHAT_GEO_AAO_V80_DURATION_IN_FRAMES = f(durationSeconds);

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const colors = {
  ink: '#F7FAFC',
  muted: 'rgba(247,250,252,0.76)',
  cyan: '#69DBFF',
  blue: '#4F91FF',
  amber: '#FFC45E',
  green: '#65D69A',
  red: '#FF746E',
  panel: 'rgba(3,11,17,0.72)',
};

type PlanLayer = {
  id: string;
  start: number;
  end: number;
  title: string;
  detail: string;
  items: string[];
  background: 'talk' | 'opaque';
  params: {
    component: string;
    src?: string;
    trimBeforeSeconds?: number;
    playbackRate?: number;
    screenMode?: 'image-ai' | 'restaurant-query';
    disclosure?: string;
    badge?: string;
    previewFallback?: boolean;
    pages?: string[];
  };
  visualEvent: {id: string; enterAt: number; primary: boolean};
};

const layers = visualPlan.layers as unknown as PlanLayer[];
const renderableLayers = layers.filter(
  (layer) => typeof layer.params?.component === 'string',
);
const scenes: V72ProductionScene[] = renderableLayers.map((layer) => ({
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
  sourceVideo: 'media/wechat-geo-aao-20260823/main-30fps.mp4',
  captionsSrc: 'data/WECHAT_GEO_AAO_20260823.bilingual.v1.json',
  captionVariant: 'transparent-v8',
  captionMode: 'bilingual',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.025) saturate(1.012) brightness(0.995)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.11) 0%, rgba(2,7,12,0.01) 54%, rgba(2,7,12,0.07) 100%)',
  motion: {
    cuts: [0, 6.31, 20.04, 23.32, 33.96, 47.07, durationSeconds],
    baseScale: 1.008,
    peakScales: [1.03, 1.022, 1.032, 1.024, 1.029, 1.022],
    peakX: [-6, 4, -5, 4, -5, 3],
    peakY: [-2, -1, -2, -1, -2, -1],
    transformOrigin: '55% 43%',
  },
  scenes,
  sfxCues,
};

const useReveal = (delay = 0, stiffness = 184) => {
  const frame = useCurrentFrame();
  const {fps: currentFps} = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps: currentFps,
    config: {damping: 23, stiffness, mass: 0.84},
  });
};

const useSceneOpacity = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const fade = Math.min(8, Math.max(4, Math.round(durationInFrames * 0.08)));
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

const Eyebrow: React.FC<{
  children: React.ReactNode;
  tone?: 'cyan' | 'amber' | 'green';
}> = ({children, tone = 'cyan'}) => {
  const color = colors[tone];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color,
        fontSize: 20,
        lineHeight: 1,
        fontWeight: 950,
        letterSpacing: 0,
      }}
    >
      <span
        style={{
          width: 27,
          height: 3,
          background: color,
          boxShadow: `0 0 14px ${color}99`,
        }}
      />
      {children}
    </div>
  );
};

const HookScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const reveal = useReveal(1, 190);
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 188,
        width: 670,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 24px rgba(0,0,0,0.96)',
        transform: `translateX(${interpolate(reveal, [0, 1], [-30, 0])}px)`,
      }}
    >
      <Eyebrow>微信入口变化</Eyebrow>
      <div
        style={{
          position: 'relative',
          width: 566,
          height: 121,
          marginTop: 17,
          overflow: 'hidden',
          background: '#F6F5F7',
          border: `3px solid ${colors.cyan}`,
          boxShadow: '0 18px 42px rgba(0,0,0,0.36)',
          opacity: reveal,
          transform: `translateY(${(1 - reveal) * 12}px)`,
        }}
      >
        <Img
          src={staticFile(
            'media/wechat-geo-aao-20260823/ui-callouts/press-to-talk.png',
          )}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: 8,
            padding: '5px 9px',
            color: '#061018',
            background: colors.cyan,
            fontSize: 14,
            lineHeight: 1,
            fontWeight: 950,
          }}
        >
          真实界面特写
        </div>
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 54,
          lineHeight: 1.03,
          fontWeight: 950,
          letterSpacing: 0,
        }}
      >
        <span style={{color: colors.ink}}>“按住说话” </span>
        <span style={{color: colors.amber}}>颜色变了</span>
      </div>
      <div
        style={{
          marginTop: 19,
          width: interpolate(reveal, [0, 1], [0, 470]),
          height: 5,
          background: colors.cyan,
          boxShadow: '0 0 18px rgba(105,219,255,0.65)',
        }}
      />
      <div
        style={{
          marginTop: 17,
          color: colors.muted,
          fontSize: 27,
          lineHeight: 1.28,
          fontWeight: 850,
        }}
      >
        更值得看的，是后面多了一个
        <span style={{color: colors.cyan}}> AI入口</span>。
      </div>
      <div style={{display: 'flex', gap: 14, marginTop: 23}}>
        {layer.items.map((item, index) => {
          const itemReveal = spring({
            frame: frame - 8 - index * 7,
            fps,
            config: {damping: 23, stiffness: 188, mass: 0.84},
          });
          return (
            <div
              key={item}
              style={{
                minWidth: 142,
                padding: '11px 15px',
                boxSizing: 'border-box',
                color: index === 1 ? colors.amber : colors.ink,
                background: 'rgba(3,11,17,0.42)',
                borderLeft: `4px solid ${index === 1 ? colors.amber : colors.cyan}`,
                fontSize: 24,
                fontWeight: 930,
                opacity: itemReveal,
                transform: `translateY(${(1 - itemReveal) * 10}px)`,
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

const RealScreenScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const reveal = useReveal(1, 176);
  const opacity = useSceneOpacity();
  const frame = useCurrentFrame();
  const mode = layer.params.screenMode ?? 'image-ai';
  const isQuery = mode === 'restaurant-query';
  const screenSrc = layer.params.src;
  if (!screenSrc) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 106,
        width: 830,
        height: 826,
        color: colors.ink,
        fontFamily,
        opacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(104deg, rgba(3,10,16,0.86) 0%, rgba(3,10,16,0.72) 58%, rgba(3,10,16,0.16) 100%)',
          borderLeft: `4px solid ${colors.cyan}`,
          boxShadow: '0 24px 62px rgba(0,0,0,0.32)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 20,
          top: 17,
          width: 466,
          height: 792,
          overflow: 'hidden',
          background: '#05080B',
          border: '1px solid rgba(255,255,255,0.17)',
          boxShadow: '0 18px 44px rgba(0,0,0,0.48)',
          transform: `translateX(${interpolate(reveal, [0, 1], [-24, 0])}px)`,
        }}
      >
        <Video
          src={staticFile(screenSrc)}
          muted
          trimBefore={Math.round((layer.params.trimBeforeSeconds ?? 0) * fps)}
          playbackRate={layer.params.playbackRate ?? 1}
          objectFit="cover"
          style={{
            width: '100%',
            height: '100%',
            objectPosition: isQuery ? '50% 54%' : '50% 51%',
            filter: 'contrast(1.035) saturate(0.98) brightness(0.96)',
            transform: 'scale(1.015)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 10,
            background: colors.cyan,
            boxShadow: '0 0 18px rgba(105,219,255,0.65)',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 520,
          top: isQuery ? 86 : 40,
          width: 276,
          textShadow: '0 4px 18px rgba(0,0,0,0.96)',
          transform: `translateX(${interpolate(reveal, [0, 1], [18, 0])}px)`,
        }}
      >
        {!isQuery ? (
          <div
            style={{
              position: 'relative',
              width: 264,
              height: 119,
              marginBottom: 18,
              overflow: 'hidden',
              background: '#020305',
              border: `3px solid ${colors.amber}`,
              boxShadow: '0 16px 38px rgba(0,0,0,0.38)',
            }}
          >
            <Img
              src={staticFile(
                'media/wechat-geo-aao-20260823/ui-callouts/ai-process.png',
              )}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                imageRendering: 'auto',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 7,
                top: 7,
                padding: '4px 7px',
                color: '#071018',
                background: colors.amber,
                fontSize: 13,
                lineHeight: 1,
                fontWeight: 950,
              }}
            >
              入口特写
            </div>
          </div>
        ) : null}
        <Eyebrow tone={isQuery ? 'amber' : 'cyan'}>
          {isQuery ? '需求输入' : '真实界面'}
        </Eyebrow>
        <div
          style={{
            marginTop: 15,
            fontSize: 41,
            lineHeight: 1.08,
            fontWeight: 950,
            letterSpacing: 0,
          }}
        >
          {isQuery ? '一句话说清这次需求' : '图片里多了“AI处理”'}
        </div>
        <div style={{display: 'grid', gap: 10, marginTop: 22}}>
          {layer.items.map((item, index) => {
            const itemReveal = spring({
              frame: frame - 7 - index * 7,
              fps,
              config: {damping: 23, stiffness: 188, mass: 0.84},
            });
            return (
              <div
                key={item}
                style={{
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '7px 11px',
                  boxSizing: 'border-box',
                  color: index === layer.items.length - 1 ? colors.amber : colors.ink,
                  background: 'rgba(255,255,255,0.065)',
                  borderLeft: `4px solid ${index === layer.items.length - 1 ? colors.amber : colors.cyan}`,
                  fontSize: 22,
                  lineHeight: 1.16,
                  fontWeight: 900,
                  opacity: itemReveal,
                  transform: `translateX(${(1 - itemReveal) * 14}px)`,
                }}
              >
                <span
                  style={{
                    marginRight: 10,
                    color: colors.cyan,
                    fontSize: 14,
                    fontWeight: 950,
                  }}
                >
                  0{index + 1}
                </span>
                {item}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 520,
          bottom: 31,
          width: 278,
          paddingTop: 9,
          color: colors.muted,
          borderTop: '1px solid rgba(255,255,255,0.18)',
          fontSize: 16,
          lineHeight: 1.25,
          fontWeight: 780,
        }}
      >
        {layer.params.disclosure}
      </div>
    </div>
  );
};

const ModelBoundaryScene: React.FC = () => {
  const reveal = useReveal(0, 184);
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const rows = [
    {label: '能力已知', text: '官方能力支持图像风格化', color: colors.green},
    {label: '具体未知', text: '该微信入口调用的模型版本未公开', color: colors.amber},
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 194,
        width: 718,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 22px rgba(0,0,0,0.96)',
        transform: `translateX(${interpolate(reveal, [0, 1], [-24, 0])}px)`,
      }}
    >
      <Eyebrow tone="amber">事实边界</Eyebrow>
      <div
        style={{
          marginTop: 15,
          fontSize: 58,
          lineHeight: 1.04,
          fontWeight: 950,
          letterSpacing: 0,
        }}
      >
        <span style={{color: colors.amber}}>可能是</span>混元生图
      </div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24}}>
        {rows.map((row, index) => {
          const rowReveal = spring({
            frame: frame - 5 - index * 7,
            fps,
            config: {damping: 23, stiffness: 190, mass: 0.82},
          });
          return (
            <div
              key={row.label}
              style={{
                minHeight: 138,
                padding: '15px 17px',
                boxSizing: 'border-box',
                background: colors.panel,
                borderTop: `4px solid ${row.color}`,
                opacity: rowReveal,
                transform: `translateY(${(1 - rowReveal) * 14}px)`,
              }}
            >
              <div style={{color: row.color, fontSize: 18, fontWeight: 950}}>{row.label}</div>
              <div
                style={{
                  marginTop: 12,
                  color: colors.ink,
                  fontSize: 25,
                  lineHeight: 1.23,
                  fontWeight: 860,
                }}
              >
                {row.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FourWaySearchScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const reveal = useReveal(0, 180);
  const opacity = useSceneOpacity();
  const points = [
    {x: 312, y: 9},
    {x: 520, y: 120},
    {x: 312, y: 235},
    {x: 105, y: 120},
  ];
  const lineProgress = interpolate(frame, [5, 34], [0, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 56,
        top: 130,
        width: 740,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 4px 18px rgba(0,0,0,0.96)',
        transform: `translateX(${interpolate(reveal, [0, 1], [-24, 0])}px)`,
      }}
    >
      <Eyebrow>旧搜寻路径</Eyebrow>
      <div
        style={{
          marginTop: 14,
          fontSize: 54,
          lineHeight: 1.05,
          fontWeight: 950,
          letterSpacing: 0,
        }}
      >
        以前，<span style={{color: colors.amber}}>四个人</span>分头找
      </div>
      <div style={{position: 'relative', marginTop: 24, width: 690, height: 340}}>
        <svg
          width="690"
          height="340"
          viewBox="0 0 690 340"
          style={{position: 'absolute', inset: 0, overflow: 'visible'}}
        >
          {points.map((point, index) => {
            const pathLength = 205;
            const branch = interpolate(
              lineProgress,
              [index * 0.13, Math.min(1, index * 0.13 + 0.42)],
              [0, 1],
              clamp,
            );
            return (
              <path
                key={index}
                d={`M 345 170 C 345 170, ${point.x + 60} ${point.y + 42}, ${point.x + 60} ${point.y + 42}`}
                fill="none"
                stroke={index === 3 ? colors.amber : colors.cyan}
                strokeWidth="3"
                strokeDasharray={pathLength}
                strokeDashoffset={pathLength * (1 - branch)}
                opacity={0.42 + branch * 0.58}
              />
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 279,
            top: 122,
            width: 132,
            height: 96,
            display: 'grid',
            placeItems: 'center',
            color: colors.ink,
            background: 'rgba(3,12,19,0.76)',
            border: `3px solid ${colors.cyan}`,
            boxShadow: '0 0 24px rgba(105,219,255,0.22)',
            fontSize: 27,
            fontWeight: 950,
          }}
        >
          吃什么？
        </div>
        {layer.items.map((item, index) => {
          const itemReveal = spring({
            frame: frame - 8 - index * 8,
            fps,
            config: {damping: 23, stiffness: 188, mass: 0.82},
          });
          const point = points[index];
          return (
            <div
              key={item}
              style={{
                position: 'absolute',
                left: point.x,
                top: point.y,
                width: 120,
                minHeight: 84,
                display: 'grid',
                placeItems: 'center',
                padding: '8px',
                boxSizing: 'border-box',
                color: index === 3 ? colors.amber : colors.ink,
                background: 'rgba(3,12,19,0.72)',
                borderLeft: `4px solid ${index === 3 ? colors.amber : colors.cyan}`,
                fontSize: 22,
                lineHeight: 1.13,
                textAlign: 'center',
                fontWeight: 920,
                opacity: itemReveal,
                transform: `scale(${0.92 + itemReveal * 0.08})`,
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

const TalkInfoCardScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const reveal = useReveal(0, 182);
  const opacity = useSceneOpacity();

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 132,
        width: 590,
        color: colors.ink,
        fontFamily,
        opacity,
        pointerEvents: 'none',
        textShadow: '0 4px 18px rgba(0,0,0,0.96)',
        transform: `translateX(${interpolate(reveal, [0, 1], [-28, 0])}px)`,
      }}
    >
      <Eyebrow tone="cyan">
        {layer.params.disclosure ?? 'V8 · 关键信息'}
      </Eyebrow>
      <div
        style={{
          marginTop: 15,
          fontSize: 48,
          lineHeight: 1.08,
          fontWeight: 950,
        }}
      >
        {layer.title}
      </div>
      <div
        style={{
          width: 520,
          marginTop: 13,
          color: colors.muted,
          fontSize: 23,
          lineHeight: 1.35,
          fontWeight: 760,
        }}
      >
        {layer.detail}
      </div>
      <div
        style={{
          width: 510,
          marginTop: 24,
          display: 'grid',
          gap: 10,
        }}
      >
        {layer.items.map((item, index) => {
          const itemReveal = spring({
            frame: frame - 7 - index * 6,
            fps,
            config: {damping: 23, stiffness: 188, mass: 0.84},
          });
          const isLast = index === layer.items.length - 1;
          return (
            <div
              key={item}
              style={{
                position: 'relative',
                minHeight: 58,
                display: 'flex',
                alignItems: 'center',
                padding: '0 18px 0 52px',
                boxSizing: 'border-box',
                color: isLast ? colors.amber : colors.ink,
                background: 'rgba(3,11,17,0.68)',
                borderLeft: `4px solid ${isLast ? colors.amber : colors.cyan}`,
                boxShadow: '0 12px 28px rgba(0,0,0,0.22)',
                fontSize: 24,
                lineHeight: 1.16,
                fontWeight: 920,
                opacity: itemReveal,
                transform: `translateY(${(1 - itemReveal) * 16}px)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 16,
                  width: 23,
                  height: 23,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#071018',
                  background: isLast ? colors.amber : colors.cyan,
                  fontSize: 14,
                  fontWeight: 950,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </div>
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PaperConstructScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  if (layer.params.previewFallback || !layer.params.src) {
    return <FourWaySearchScene layer={layer} />;
  }
  const reveal = useReveal(0, 174);
  const opacity = useSceneOpacity();
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        color: colors.ink,
        background: '#0A1118',
        fontFamily,
        opacity,
        transform: `scale(${interpolate(reveal, [0, 1], [1.025, 1])})`,
      }}
    >
      <Video
        src={staticFile(layer.params.src)}
        muted
        objectFit="cover"
        style={{width: '100%', height: '100%'}}
      />
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 88,
          padding: '9px 14px',
          color: colors.amber,
          background: 'rgba(3,10,16,0.76)',
          borderLeft: `4px solid ${colors.amber}`,
          fontSize: 21,
          fontWeight: 950,
        }}
      >
        AI生成·纸构概念演绎
      </div>
      <div
        style={{
          position: 'absolute',
          left: 170,
          right: 170,
          bottom: 190,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}
      >
        {layer.items.map((item, index) => (
          <div
            key={item}
            style={{
              minHeight: 64,
              display: 'grid',
              placeItems: 'center',
              color: index === 3 ? colors.amber : colors.ink,
              background: 'rgba(3,10,16,0.78)',
              borderTop: `3px solid ${index === 3 ? colors.amber : colors.cyan}`,
              fontSize: 24,
              fontWeight: 920,
              textShadow: '0 3px 12px rgba(0,0,0,0.96)',
            }}
          >
            {item}
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 54,
          top: 88,
          padding: '9px 14px',
          color: colors.muted,
          background: 'rgba(3,10,16,0.72)',
          fontSize: 18,
          fontWeight: 850,
        }}
      >
        非真实业务证据
      </div>
    </div>
  );
};

const PdfShowcaseScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const reveal = useReveal(0, 178);
  const opacity = useSceneOpacity();
  const pages = layer.params.pages ?? [];
  if (pages.length === 0) return null;

  const pageSpan = Math.max(1, Math.floor(durationInFrames / pages.length));
  const activePage = Math.min(pages.length - 1, Math.floor(frame / pageSpan));
  const localFrame = frame - activePage * pageSpan;
  const pageReveal = spring({
    frame: localFrame,
    fps,
    config: {damping: 24, stiffness: 170, mass: 0.9},
  });
  const pageLabels = ['正式课件', '核心关系', '建设路径'];

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 112,
        width: 900,
        height: 760,
        color: colors.ink,
        fontFamily,
        opacity,
        pointerEvents: 'none',
        textShadow: '0 4px 18px rgba(0,0,0,0.92)',
        transform: `translateX(${interpolate(reveal, [0, 1], [-28, 0])}px)`,
      }}
    >
      <Eyebrow tone="amber">真实课件 · 18页</Eyebrow>
      <div
        style={{
          marginTop: 14,
          fontSize: 52,
          lineHeight: 1.04,
          fontWeight: 950,
        }}
      >
        GEO <span style={{color: colors.amber}}>×</span> AAO 讲解课件
      </div>
      <div
        style={{
          position: 'relative',
          width: 836,
          height: 470,
          marginTop: 22,
          overflow: 'hidden',
          background: '#F6F2EA',
          border: '1px solid rgba(255,255,255,0.24)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.44)',
        }}
      >
        <Img
          key={pages[activePage]}
          src={staticFile(pages[activePage])}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: pageReveal,
            transform: `translateX(${(1 - pageReveal) * 34}px) scale(${0.985 + pageReveal * 0.015})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 14,
            top: 14,
            padding: '7px 11px',
            color: '#071018',
            background: colors.amber,
            fontSize: 16,
            lineHeight: 1,
            fontWeight: 950,
            boxShadow: '0 8px 18px rgba(0,0,0,0.2)',
          }}
        >
          {pageLabels[activePage] ?? `第${activePage + 1}页`}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 19,
        }}
      >
        {pages.map((page, index) => (
          <div
            key={page}
            style={{
              width: index === activePage ? 48 : 15,
              height: 6,
              background: index === activePage ? colors.amber : 'rgba(255,255,255,0.28)',
              transition: 'none',
            }}
          />
        ))}
        <div
          style={{
            marginLeft: 10,
            padding: '10px 16px',
            color: colors.ink,
            background: 'rgba(3,11,17,0.68)',
            borderLeft: `4px solid ${colors.amber}`,
            fontSize: 24,
            fontWeight: 920,
          }}
        >
          评论区留“GEO” · 免费分享
        </div>
      </div>
    </div>
  );
};

const TopicLabel: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      right: 54,
      top: 30,
      zIndex: 222,
      padding: '8px 13px',
      color: colors.cyan,
      background: 'rgba(3,10,16,0.42)',
      borderBottom: `2px solid ${colors.cyan}`,
      fontFamily,
      fontSize: 17,
      fontWeight: 900,
      letterSpacing: 0,
      textShadow: '0 3px 14px rgba(0,0,0,0.94)',
    }}
  >
    微信AI · GEO · AAO
  </div>
);

const renderCustomScene = (scene: V72CustomScene) => {
  const layer = scene.data as unknown as PlanLayer;
  switch (scene.customKey) {
    case 'wechat-hook':
      return <HookScene layer={layer} />;
    case 'real-screen':
      return <RealScreenScene layer={layer} />;
    case 'model-boundary':
      return <ModelBoundaryScene />;
    case 'four-way-search':
      return <FourWaySearchScene layer={layer} />;
    case 'talk-info-card':
      return <TalkInfoCardScene layer={layer} />;
    case 'paper-construct-video':
      return <PaperConstructScene layer={layer} />;
    case 'pdf-showcase':
      return <PdfShowcaseScene layer={layer} />;
    default:
      return null;
  }
};

const WechatGeoAaoV80Talk16x9: React.FC<{soundEnabled: boolean}> = ({
  soundEnabled,
}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
    persistentOverlay={<TopicLabel />}
  />
);

export const WechatGeoAaoV80Talk16x9WithSfx: React.FC = () => (
  <WechatGeoAaoV80Talk16x9 soundEnabled />
);

export const WechatGeoAaoV80Talk16x9NoSfx: React.FC = () => (
  <WechatGeoAaoV80Talk16x9 soundEnabled={false} />
);
