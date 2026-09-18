import {Video} from '@remotion/media';
import React from 'react';
import {MarkerUnderline} from './ShotcraftEffects.generated';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

type Tone = 'cyan' | 'amber' | 'green' | 'red' | 'white';
const tones: Record<Tone, string> = {
  cyan: '#68DAFF',
  amber: '#FFC45E',
  green: '#65D69A',
  red: '#FF7068',
  white: '#F8FAFD',
};

export type V8SemanticLayer = {
  id: string;
  start: number;
  end: number;
  title: string;
  detail: string;
  items: string[];
  params: {
    component: string;
    label?: string;
    hubLabel?: string;
    hubFrame?: number;
    itemFrames?: number[];
    detailFrame?: number;
    equalBars?: boolean;
    marker?: {itemIndex: number; startFrame: number; durationInFrames: number; keyword: string; after?: string};
    src?: string;
    mediaClips?: Array<{
      src: string;
      durationSeconds: number;
      trimBeforeSeconds?: number;
    }>;
    disclosure?: string;
    badge?: string;
    mediaScale?: number;
    mediaTransformOrigin?: string;
  };
};

const useReveal = (delay = 0, stiffness = 180) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    config: {damping: 22, stiffness, mass: 0.82},
  });
};

const useSceneOpacity = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
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

const safeStage: React.CSSProperties = {
  position: 'absolute',
  left: 80,
  top: 142,
  width: 660,
  maxHeight: 620,
  color: tones.white,
  fontFamily,
  textShadow: '0 4px 19px rgba(0,0,0,0.94)',
  transform: 'scale(0.8)',
  transformOrigin: 'top left',
};

const StageLabel: React.FC<{children: React.ReactNode; tone?: Tone}> = ({
  children,
  tone = 'cyan',
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      color: tones[tone],
      fontSize: 32,
      lineHeight: 1,
      fontWeight: 950,
      letterSpacing: 0,
    }}
  >
    <span
      style={{
        width: 24,
        height: 3,
        background: tones[tone],
        boxShadow: `0 0 13px ${tones[tone]}99`,
      }}
    />
    {children}
  </div>
);

const AccentText: React.FC<{children: string; baseColor: string}> = ({
  children,
  baseColor,
}) => {
  const parts = children.split(/(DeepSeek|Agent|AI|≠|→|=|\+)/g);
  return (
    <>
      {parts.map((part, index) => {
        const isOperator = ['≠', '→', '=', '+'].includes(part);
        const isAi = ['AI', 'Agent', 'DeepSeek'].includes(part);
        return (
          <span
            key={`${part}-${index}`}
            style={{color: isOperator ? tones.amber : isAi ? tones.cyan : baseColor}}
          >
            {part}
          </span>
        );
      })}
    </>
  );
};

const StageTitle: React.FC<{children: string; tone?: Tone}> = ({
  children,
  tone = 'white',
}) => {
  return (
    <div
      style={{
        marginTop: 14,
        maxWidth: 650,
        color: tones[tone],
        fontSize: [...children].length > 18 ? 52 : 60,
        lineHeight: 1.08,
        fontWeight: 950,
        letterSpacing: 0,
      }}
    >
      <AccentText baseColor={tones[tone]}>{children}</AccentText>
    </div>
  );
};

const StageDetail: React.FC<{children?: string}> = ({children}) =>
  children ? (
    <div
      style={{
        marginTop: 14,
        maxWidth: 650,
        color: 'rgba(248,250,253,0.98)',
        fontSize: 44,
        lineHeight: 1.24,
        fontWeight: 800,
      }}
    >
      {children}
    </div>
  ) : null;

const itemRevealAt = (frame: number, layer: V8SemanticLayer, index: number) =>
  spring({frame: frame - (layer.params.itemFrames?.[index] ?? 7 + index * 10), fps: 30,
    config: {damping: 23, stiffness: 184, mass: 0.84}});

const TimedDetail: React.FC<{layer: V8SemanticLayer; frame: number}> = ({layer, frame}) => (
  <div style={{opacity: interpolate(frame, [layer.params.detailFrame ?? 0, (layer.params.detailFrame ?? 0) + 6], [0, 1], clamp)}}>
    <StageDetail>{layer.detail}</StageDetail>
  </div>
);

const ItemText: React.FC<{layer: V8SemanticLayer; frame: number; index: number; text: string}> = ({layer, frame, index, text}) => {
  const marker=layer.params.marker;
  return marker?.itemIndex===index
    ? <MarkerUnderline frame={frame-marker.startFrame} fps={30} durationInFrames={marker.durationInFrames} keyword={marker.keyword} after={marker.after} fontSize={44}/>
    : <>{text}</>;
};

export const V8ChapterAnchor: React.FC<{timeSeconds: number}> = ({
  timeSeconds,
}) => {
  const chapters = [
    {start: 0, index: '01', title: '认知生产线'},
    {start: 34, index: '02', title: 'AI站在哪一层'},
    {start: 88, index: '03', title: '现实世界'},
    {start: 146.64, index: '04', title: '四项权利'},
    {start: 230.18, index: '05', title: '反馈校准'},
    {start: 272.7, index: '06', title: '普通人的位置'},
  ];
  const chapter = [...chapters].reverse().find((item) => timeSeconds >= item.start) ?? chapters[0];
  const localTime = timeSeconds - chapter.start;
  const reveal = interpolate(localTime, [0, 0.32], [0, 1], clamp);

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
        color: tones.white,
        fontFamily,
        textShadow: '0 3px 15px rgba(0,0,0,0.96)',
        opacity: reveal,
      }}
    >
      <span style={{color: tones.cyan, fontSize: 31, fontWeight: 950}}>
        {chapter.index}
      </span>
      <span
        style={{
          width: 34,
          height: 2,
          background: tones.cyan,
          transform: `scaleX(${reveal})`,
          transformOrigin: 'left center',
        }}
      />
      <span style={{fontSize: 22, fontWeight: 900}}>{chapter.title}</span>
    </div>
  );
};

export const V8DirectStatement: React.FC<{layer: V8SemanticLayer}> = ({
  layer,
}) => {
  const frame = useCurrentFrame();
  const reveal = useReveal(1);
  const opacity = useSceneOpacity();
  return (
    <div
      style={{
        ...safeStage,
        top: 164,
        opacity,
        transform: `translateX(${interpolate(reveal, [0, 1], [-26, 0])}px) scale(0.8)`,
        transformOrigin: 'top left',
      }}
    >
      <StageLabel>{layer.params.label ?? '关键判断'}</StageLabel>
      <StageTitle>{layer.title}</StageTitle>
      <div
        style={{
          marginTop: 18,
          width: interpolate(reveal, [0, 1], [0, 390]),
          height: 4,
          background: tones.cyan,
          boxShadow: '0 0 17px rgba(104,218,255,0.66)',
        }}
      />
      <TimedDetail layer={layer} frame={frame} />
      {layer.items.length ? (
        <div style={{display: 'flex', gap: 12, marginTop: 21, flexWrap: 'wrap'}}>
          {layer.items.slice(0, 3).map((item, index) => {
            const itemReveal = itemRevealAt(frame, layer, index);
            return (
              <div
                key={item}
                style={{
                  padding: '8px 12px',
                  color: index === layer.items.length - 1 ? tones.amber : tones.white,
                  background: 'rgba(4,12,18,0.32)',
                  borderBottom: `2px solid ${index === layer.items.length - 1 ? tones.amber : tones.cyan}`,
                  fontSize: 44,
                  fontWeight: 900,
                  opacity: itemReveal,
                }}
              >
                <ItemText layer={layer} frame={frame} index={index} text={item}/>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export const V8ComparisonBars: React.FC<{layer: V8SemanticLayer}> = ({
  layer,
}) => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const items = layer.items.slice(0, 3);
  return (
    <div style={{...safeStage, top: 144, opacity}}>
      <StageLabel tone="amber">{layer.params.label ?? '对照关系'}</StageLabel>
      <StageTitle>{layer.title}</StageTitle>
      <div style={{marginTop: 24, display: 'grid', gap: 16}}>
        {items.map((item, index) => {
          const reveal = itemRevealAt(frame, layer, index);
          const color = index === items.length - 1 ? tones.green : index === 0 ? tones.red : tones.amber;
          const width = layer.params.equalBars ? 92 : items.length === 2 ? (index === 0 ? 54 : 92) : 54 + index * 18;
          return (
            <div key={item} style={{opacity: reveal}}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
                <span style={{color, fontSize: 28, fontWeight: 950}}>0{index + 1}</span>
                <span style={{fontSize: 44, lineHeight: 1.2, fontWeight: 920}}><ItemText layer={layer} frame={frame} index={index} text={item}/></span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  width: 620,
                  height: 6,
                  background: 'rgba(255,255,255,0.12)',
                }}
              >
                <div
                  style={{
                    width: `${width * reveal}%`,
                    height: '100%',
                    background: color,
                    boxShadow: `0 0 14px ${color}77`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <TimedDetail layer={layer} frame={frame} />
    </div>
  );
};

export const V8ProcessRail: React.FC<{layer: V8SemanticLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const items = layer.items.slice(0, 4);
  const progress = interpolate(frame, [layer.params.itemFrames?.[0] ?? 6, Math.max(7, (layer.params.itemFrames?.at(-1) ?? 36) + 6)], [0, 1], clamp);
  return (
    <div style={{...safeStage, top: 144, opacity}}>
      <StageLabel>{layer.params.label ?? '推进路径'}</StageLabel>
      <StageTitle>{layer.title}</StageTitle>
      <div style={{position: 'relative', marginTop: 25, paddingLeft: 44}}>
        <div
          style={{
            position: 'absolute',
            left: 13,
            top: 17,
            width: 3,
            height: 74 * Math.max(0, items.length - 1),
            background: 'rgba(255,255,255,0.13)',
          }}
        >
          <div
            style={{
              width: '100%',
              height: `${progress * 100}%`,
              background: tones.cyan,
              boxShadow: '0 0 15px rgba(104,218,255,0.75)',
            }}
          />
        </div>
        {items.map((item, index) => {
          const active = itemRevealAt(frame, layer, index);
          return (
            <div
              key={item}
              style={{
                position: 'relative',
                minHeight: 74,
                display: 'flex',
                alignItems: 'flex-start',
                opacity: active,
                transform: `translateX(${(1 - active) * -12}px)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: -42,
                  top: 5,
                  width: 28,
                  height: 28,
                  display: 'grid',
                  placeItems: 'center',
                  color: active > 0.7 ? '#061018' : tones.cyan,
                  background: active > 0.7 ? tones.cyan : '#07121A',
                  border: `2px solid ${tones.cyan}`,
                  fontSize: 20,
                  fontWeight: 950,
                }}
              >
                {index + 1}
              </div>
              <div style={{fontSize: 44, lineHeight: 1.2, fontWeight: 920}}>{item}</div>
            </div>
          );
        })}
      </div>
      <TimedDetail layer={layer} frame={frame} />
    </div>
  );
};

export const V8NodeMap: React.FC<{layer: V8SemanticLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const items = layer.items.slice(0, 4);
  const hubLabel = layer.params.hubLabel ??
    (layer.params.component === 'feedback-loop' ? '现实反馈' : '核心位置');
  const progress = interpolate(frame, [5, 44], [0, 1], clamp);
  return (
    <div style={{...safeStage, top: 128, height: 460, opacity}}>
      <StageLabel tone="green">{layer.params.label ?? '关系地图'}</StageLabel>
      <StageTitle>{layer.title}</StageTitle>
      <TimedDetail layer={layer} frame={frame} />
      <div style={{position: 'relative', marginTop: 20, width: 650, height: 380}}>
        <svg
          width="650"
          height="380"
          viewBox="0 0 650 380"
          style={{position: 'absolute', inset: 0, overflow: 'visible'}}
        >
          {items.map((_, index) => {
            const y = 38 + index * 92;
            const branchProgress = itemRevealAt(frame, layer, index);
            return (
              <g key={index}>
                <path
                  d={`M 260 164 C 284 164, 284 ${y}, 308 ${y}`}
                  fill="none"
                  stroke={index === items.length - 1 ? tones.green : tones.cyan}
                  strokeWidth="3"
                  strokeDasharray="190"
                  strokeDashoffset={190 * (1 - branchProgress)}
                  opacity={branchProgress}
                />
                <circle
                  cx="308"
                  cy={y}
                  r={4 + branchProgress * 3}
                  fill={index === items.length - 1 ? tones.green : tones.cyan}
                  opacity={branchProgress}
                />
              </g>
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 36,
            top: 112,
            width: 224,
            minHeight: 102,
            display: 'grid',
            placeItems: 'center',
            padding: '11px 5px',
            boxSizing: 'border-box',
            color: tones.cyan,
            background: 'rgba(4,13,20,0.42)',
            border: `2px solid ${tones.cyan}`,
            fontSize: 40,
            lineHeight: 1.12,
            textAlign: 'center',
            fontWeight: 950,
            opacity: interpolate(frame, [layer.params.hubFrame ?? 0, (layer.params.hubFrame ?? 0) + 6], [0, 1], clamp),
          }}
        >
          {hubLabel}
        </div>
        {items.map((item, index) => {
          const itemProgress = itemRevealAt(frame, layer, index);
          const color = index === items.length - 1 ? tones.green : tones.cyan;
          return (
            <div
              key={item}
              style={{
                position: 'absolute',
                left: 320,
                top: index * 92,
                width: 330,
                minHeight: 76,
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                boxSizing: 'border-box',
                color: tones.white,
                background: 'rgba(4,13,20,0.31)',
                borderLeft: `4px solid ${color}`,
                fontSize: 42,
                lineHeight: 1.14,
                fontWeight: 900,
                opacity: itemProgress,
                transform: `translateX(${(1 - itemProgress) * 18}px)`,
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

export const V8SourceBranches: React.FC<{layer: V8SemanticLayer}> = ({
  layer,
}) => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const items = layer.items.slice(0, 3);
  const progress = interpolate(frame, [5, 38], [0, 1], clamp);
  return (
    <div style={{...safeStage, top: 126, height: 650, opacity}}>
      <StageLabel tone="amber">调用权</StageLabel>
      <StageTitle>{layer.title}</StageTitle>
      <StageDetail>{layer.detail}</StageDetail>
      <div style={{position: 'relative', marginTop: 20, width: 610, height: 304}}>
        <svg
          width="610"
          height="304"
          viewBox="0 0 610 304"
          style={{position: 'absolute', inset: 0}}
        >
          {items.map((_, index) => {
            const y = 28 + index * 92;
            const branch = interpolate(
              progress,
              [index * 0.22, Math.min(1, index * 0.22 + 0.38)],
              [0, 1],
              clamp,
            );
            const color = index === 2 ? tones.red : index === 1 ? tones.green : tones.cyan;
            return (
              <g key={index}>
                <path
                  d={`M 174 148 C 238 148, 234 ${y + 28}, 302 ${y + 28}`}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeDasharray="205"
                  strokeDashoffset={205 * (1 - branch)}
                  opacity={0.42 + branch * 0.58}
                />
                <circle cx="302" cy={y + 28} r={5 + branch * 2} fill={color} />
              </g>
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: 96,
            width: 158,
            height: 106,
            display: 'grid',
            placeItems: 'center',
            padding: '12px',
            boxSizing: 'border-box',
            color: tones.cyan,
            background: 'rgba(4,13,20,0.38)',
            border: `2px solid ${tones.cyan}`,
            fontSize: 24,
            lineHeight: 1.12,
            textAlign: 'center',
            fontWeight: 950,
          }}
        >
          一个真实问题
        </div>
        {items.map((item, index) => {
          const reveal = interpolate(
            progress,
            [index * 0.22 + 0.08, Math.min(1, index * 0.22 + 0.4)],
            [0, 1],
            clamp,
          );
          const color = index === 2 ? tones.red : index === 1 ? tones.green : tones.cyan;
          return (
            <div
              key={item}
              style={{
                position: 'absolute',
                left: 316,
                top: 28 + index * 92,
                width: 280,
                minHeight: 58,
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                boxSizing: 'border-box',
                color: tones.white,
                background: 'rgba(4,13,20,0.32)',
                borderLeft: `5px solid ${color}`,
                fontSize: 25,
                fontWeight: 930,
                opacity: reveal,
                transform: `translateX(${(1 - reveal) * 18}px)`,
              }}
            >
              <span style={{marginRight: 13, color, fontSize: 14, fontWeight: 950}}>
                SOURCE 0{index + 1}
              </span>
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const V8QuestionList: React.FC<{layer: V8SemanticLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  return (
    <div style={{...safeStage, top: 136, opacity}}>
      <StageLabel tone="amber">现实检查</StageLabel>
      <StageTitle>{layer.title}</StageTitle>
      <div style={{marginTop: 20, display: 'grid', gap: 9}}>
        {layer.items.slice(0, 4).map((item, index) => {
          const reveal = spring({
            frame: frame - 5 - index * 9,
            fps: 30,
            config: {damping: 23, stiffness: 186, mass: 0.82},
          });
          return (
            <div
              key={item}
              style={{
                display: 'grid',
                gridTemplateColumns: '42px 1fr',
                alignItems: 'center',
                minHeight: 58,
                borderBottom: '1px solid rgba(255,255,255,0.16)',
                opacity: reveal,
                transform: `translateX(${interpolate(reveal, [0, 1], [-15, 0])}px)`,
              }}
            >
              <span style={{color: index === 3 ? tones.green : tones.amber, fontSize: 17, fontWeight: 950}}>
                0{index + 1}
              </span>
              <span style={{fontSize: 27, lineHeight: 1.16, fontWeight: 900}}>{item}</span>
            </div>
          );
        })}
      </div>
      <StageDetail>{layer.detail}</StageDetail>
    </div>
  );
};

export const V8HeroDefinition: React.FC<{layer: V8SemanticLayer}> = ({
  layer,
}) => {
  const reveal = useReveal(2, 176);
  const opacity = useSceneOpacity();
  return (
    <div style={{...safeStage, top: 195, opacity}}>
      <StageLabel tone="amber">核心概念</StageLabel>
      <div
        style={{
          marginTop: 12,
          color: tones.white,
          fontSize: [...layer.title].length > 12 ? 50 : 66,
          lineHeight: 1.02,
          fontWeight: 950,
          transform: `scale(${interpolate(reveal, [0, 1], [0.92, 1])})`,
          transformOrigin: 'left center',
        }}
      >
        <AccentText baseColor={tones.white}>{layer.title}</AccentText>
      </div>
      <div
        style={{
          marginTop: 17,
          width: interpolate(reveal, [0, 1], [0, 420]),
          height: 5,
          background: tones.amber,
          boxShadow: '0 0 18px rgba(255,196,94,0.7)',
        }}
      />
      <StageDetail>{layer.detail}</StageDetail>
    </div>
  );
};

export const V8RightsRail: React.FC<{layer: V8SemanticLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  return (
    <div style={{...safeStage, top: 122, opacity}}>
      <StageLabel tone="amber">位置建立</StageLabel>
      <StageTitle>{layer.title}</StageTitle>
      <div style={{marginTop: 18, display: 'grid', gap: 8}}>
        {layer.items.slice(0, 4).map((item, index) => {
          const reveal = interpolate(frame, [4 + index * 7, 15 + index * 7], [0, 1], clamp);
          const colors = [tones.cyan, tones.amber, tones.green, tones.red];
          return (
            <div
              key={item}
              style={{
                display: 'grid',
                gridTemplateColumns: '74px 1fr',
                minHeight: 56,
                alignItems: 'center',
                color: tones.white,
                opacity: reveal,
              }}
            >
              <span style={{color: colors[index], fontSize: 18, fontWeight: 950}}>
                0{index + 1}
              </span>
              <span
                style={{
                  borderLeft: `4px solid ${colors[index]}`,
                  paddingLeft: 15,
                  fontSize: 25,
                  fontWeight: 930,
                }}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const V8StatusStack: React.FC<{layer: V8SemanticLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  return (
    <div style={{...safeStage, top: 170, opacity}}>
      <StageLabel tone="red">反馈信号</StageLabel>
      <StageTitle>{layer.title}</StageTitle>
      <div style={{marginTop: 24, display: 'grid', gap: 12}}>
        {layer.items.slice(0, 3).map((item, index) => {
          const reveal = spring({
            frame: frame - 7 - index * 11,
            fps: 30,
            config: {damping: 22, stiffness: 186, mass: 0.82},
          });
          const color = index === 2 ? tones.green : index === 1 ? tones.amber : tones.red;
          return (
            <div
              key={item}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                minHeight: 62,
                padding: '0 16px',
                color: tones.white,
                background: 'rgba(4,13,20,0.32)',
                borderLeft: `5px solid ${color}`,
                fontSize: 24,
                fontWeight: 920,
                opacity: reveal,
                transform: `translateX(${interpolate(reveal, [0, 1], [-20, 0])}px)`,
              }}
            >
              <span style={{color, fontSize: 17, fontWeight: 950}}>SIGN 0{index + 1}</span>
              {item}
            </div>
          );
        })}
      </div>
      <StageDetail>{layer.detail}</StageDetail>
    </div>
  );
};

export const V8MediaStage: React.FC<{layer: V8SemanticLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const durationInFrames = Math.max(1, Math.round((layer.end - layer.start) * fps));
  const opacity = useSceneOpacity();
  const reveal = useReveal(3);
  const mediaScale = layer.params.mediaScale ?? 1.02;
  const scale = interpolate(
    frame,
    [0, durationInFrames],
    [mediaScale, mediaScale + 0.055],
    clamp,
  );
  const mediaClips = layer.params.mediaClips?.length
    ? layer.params.mediaClips
    : layer.params.src
      ? [{src: layer.params.src, durationSeconds: layer.end - layer.start}]
      : [];
  if (mediaClips.length === 0) return null;
  let clipCursor = 0;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#03080D', opacity}}>
      {mediaClips.map((clip, index) => {
        const from = clipCursor;
        const clipFrames = index === mediaClips.length - 1
          ? Math.max(1, durationInFrames - from)
          : Math.max(1, Math.round(clip.durationSeconds * fps));
        clipCursor += clipFrames;
        return (
          <Sequence
            key={`${layer.id}-media-${index}`}
            from={from}
            durationInFrames={clipFrames}
            premountFor={12}
          >
            <Video
              src={staticFile(clip.src)}
              muted
              trimBefore={Math.round((clip.trimBeforeSeconds ?? 0) * fps)}
              objectFit="cover"
              style={{
                width: '100%',
                height: '100%',
                filter: 'contrast(1.035) saturate(0.96) brightness(0.82)',
                transform: `scale(${scale})`,
                transformOrigin: layer.params.mediaTransformOrigin ?? '50% 48%',
              }}
            />
          </Sequence>
        );
      })}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.84) 0%, rgba(2,7,12,0.38) 33%, rgba(2,7,12,0.04) 67%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 56,
          top: 142,
          width: 590,
          color: tones.white,
          fontFamily,
          textShadow: '0 5px 23px rgba(0,0,0,0.98)',
          opacity: reveal,
          transform: `translateX(${interpolate(reveal, [0, 1], [-24, 0])}px)`,
        }}
      >
        <div style={{color: tones.amber, fontSize: 17, fontWeight: 950}}>
          {layer.params.disclosure || 'AI生成 · 概念画面'}
        </div>
        <div style={{marginTop: 16, fontSize: 46, lineHeight: 1.08, fontWeight: 950}}>
          {layer.title}
        </div>
        <div
          style={{
            marginTop: 17,
            paddingLeft: 15,
            borderLeft: `4px solid ${tones.cyan}`,
            fontSize: 22,
            lineHeight: 1.28,
            fontWeight: 840,
          }}
        >
          {layer.detail}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 52,
          top: 72,
          padding: '8px 11px',
          color: tones.cyan,
          background: 'rgba(3,10,16,0.48)',
          borderBottom: `2px solid ${tones.cyan}`,
          fontFamily,
          fontSize: 16,
          fontWeight: 900,
        }}
      >
        {layer.params.badge || '场景演绎 · 不作事实证据'}
      </div>
    </AbsoluteFill>
  );
};

export const V8Closing: React.FC<{layer: V8SemanticLayer}> = ({layer}) => {
  const reveal = useReveal(0);
  const opacity = useSceneOpacity();
  const compactTitle = [...layer.title].length > 11;
  return (
    <div
      style={{
        ...safeStage,
        top: 260,
        opacity,
        transform: `translateX(${interpolate(reveal, [0, 1], [-20, 0])}px)`,
      }}
    >
      <StageLabel tone="green">兰州AI创业实践</StageLabel>
      <div
        style={{
          marginTop: 13,
          fontSize: compactTitle ? 46 : 62,
          lineHeight: 1.04,
          fontWeight: 950,
          whiteSpace: compactTitle ? 'nowrap' : 'normal',
        }}
      >
        {layer.title}
      </div>
      <div style={{marginTop: 15, color: tones.cyan, fontSize: 29, fontWeight: 930}}>
        {layer.detail}
      </div>
    </div>
  );
};
