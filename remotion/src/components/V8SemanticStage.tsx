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
    src?: string;
    disclosure?: string;
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
  left: 54,
  top: 142,
  width: 620,
  maxHeight: 620,
  color: tones.white,
  fontFamily,
  textShadow: '0 4px 19px rgba(0,0,0,0.94)',
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
      fontSize: 17,
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

const StageTitle: React.FC<{children: string; tone?: Tone}> = ({
  children,
  tone = 'white',
}) => (
  <div
    style={{
      marginTop: 14,
      maxWidth: 610,
      color: tones[tone],
      fontSize: [...children].length > 18 ? 39 : 47,
      lineHeight: 1.08,
      fontWeight: 950,
      letterSpacing: 0,
    }}
  >
    {children}
  </div>
);

const StageDetail: React.FC<{children?: string}> = ({children}) =>
  children ? (
    <div
      style={{
        marginTop: 14,
        maxWidth: 590,
        color: 'rgba(248,250,253,0.76)',
        fontSize: 21,
        lineHeight: 1.28,
        fontWeight: 800,
      }}
    >
      {children}
    </div>
  ) : null;

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
      <span style={{color: tones.cyan, fontSize: 28, fontWeight: 950}}>
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
      <span style={{fontSize: 19, fontWeight: 900}}>{chapter.title}</span>
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
        top: 210,
        opacity,
        transform: `translateX(${interpolate(reveal, [0, 1], [-26, 0])}px)`,
      }}
    >
      <StageLabel>关键判断</StageLabel>
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
      <StageDetail>{layer.detail}</StageDetail>
      {layer.items.length ? (
        <div style={{display: 'flex', gap: 12, marginTop: 21, flexWrap: 'wrap'}}>
          {layer.items.slice(0, 3).map((item, index) => {
            const itemReveal = spring({
              frame: frame - 8 - index * 6,
              fps: 30,
              config: {damping: 22, stiffness: 190, mass: 0.82},
            });
            return (
              <div
                key={item}
                style={{
                  padding: '8px 12px',
                  color: index === layer.items.length - 1 ? tones.amber : tones.white,
                  background: 'rgba(4,12,18,0.32)',
                  borderBottom: `2px solid ${index === layer.items.length - 1 ? tones.amber : tones.cyan}`,
                  fontSize: 19,
                  fontWeight: 900,
                  opacity: itemReveal,
                }}
              >
                {item}
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
    <div style={{...safeStage, top: 172, opacity}}>
      <StageLabel tone="amber">对照关系</StageLabel>
      <StageTitle>{layer.title}</StageTitle>
      <div style={{marginTop: 24, display: 'grid', gap: 16}}>
        {items.map((item, index) => {
          const reveal = spring({
            frame: frame - 7 - index * 10,
            fps: 30,
            config: {damping: 23, stiffness: 184, mass: 0.84},
          });
          const color = index === items.length - 1 ? tones.green : index === 0 ? tones.red : tones.amber;
          const width = items.length === 2 ? (index === 0 ? 54 : 92) : 54 + index * 18;
          return (
            <div key={item}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
                <span style={{color, fontSize: 16, fontWeight: 950}}>0{index + 1}</span>
                <span style={{fontSize: 24, lineHeight: 1.16, fontWeight: 920}}>{item}</span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  width: 545,
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
      <StageDetail>{layer.detail}</StageDetail>
    </div>
  );
};

export const V8ProcessRail: React.FC<{layer: V8SemanticLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const items = layer.items.slice(0, 4);
  const progress = interpolate(frame, [6, 42], [0, 1], clamp);
  return (
    <div style={{...safeStage, top: 144, opacity}}>
      <StageLabel>推进路径</StageLabel>
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
          const active = interpolate(progress, [index / Math.max(1, items.length), Math.min(1, index / Math.max(1, items.length) + 0.28)], [0, 1], clamp);
          return (
            <div
              key={item}
              style={{
                position: 'relative',
                minHeight: 74,
                display: 'flex',
                alignItems: 'flex-start',
                opacity: 0.35 + active * 0.65,
                transform: `translateX(${(1 - active) * -12}px)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: -42,
                  top: 5,
                  width: 22,
                  height: 22,
                  display: 'grid',
                  placeItems: 'center',
                  color: active > 0.7 ? '#061018' : tones.cyan,
                  background: active > 0.7 ? tones.cyan : '#07121A',
                  border: `2px solid ${tones.cyan}`,
                  fontSize: 10,
                  fontWeight: 950,
                }}
              >
                {index + 1}
              </div>
              <div style={{fontSize: 25, lineHeight: 1.18, fontWeight: 920}}>{item}</div>
            </div>
          );
        })}
      </div>
      <StageDetail>{layer.detail}</StageDetail>
    </div>
  );
};

export const V8NodeMap: React.FC<{layer: V8SemanticLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const items = layer.items.slice(0, 4);
  const hubLabel =
    layer.params.component === 'feedback-loop' ? '现实反馈' : '核心位置';
  const progress = interpolate(frame, [5, 44], [0, 1], clamp);
  return (
    <div style={{...safeStage, top: 136, height: 630, opacity}}>
      <StageLabel tone="green">关系地图</StageLabel>
      <StageTitle>{layer.title}</StageTitle>
      <div style={{position: 'relative', marginTop: 20, width: 605, height: 330}}>
        <svg
          width="605"
          height="330"
          viewBox="0 0 605 330"
          style={{position: 'absolute', inset: 0, overflow: 'visible'}}
        >
          {items.map((_, index) => {
            const y = 34 + index * 76;
            const branchProgress = interpolate(
              progress,
              [index * 0.17, Math.min(1, index * 0.17 + 0.3)],
              [0, 1],
              clamp,
            );
            return (
              <g key={index}>
                <path
                  d={`M 166 164 C 235 164, 225 ${y}, 292 ${y}`}
                  fill="none"
                  stroke={index === items.length - 1 ? tones.green : tones.cyan}
                  strokeWidth="3"
                  strokeDasharray="190"
                  strokeDashoffset={190 * (1 - branchProgress)}
                  opacity={0.38 + branchProgress * 0.62}
                />
                <circle
                  cx="292"
                  cy={y}
                  r={4 + branchProgress * 3}
                  fill={index === items.length - 1 ? tones.green : tones.cyan}
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
            width: 132,
            minHeight: 102,
            display: 'grid',
            placeItems: 'center',
            padding: '11px',
            boxSizing: 'border-box',
            color: tones.cyan,
            background: 'rgba(4,13,20,0.42)',
            border: `2px solid ${tones.cyan}`,
            fontSize: 23,
            lineHeight: 1.12,
            textAlign: 'center',
            fontWeight: 950,
          }}
        >
          {hubLabel}
        </div>
        {items.map((item, index) => {
          const itemProgress = interpolate(
            progress,
            [index * 0.17 + 0.08, Math.min(1, index * 0.17 + 0.34)],
            [0, 1],
            clamp,
          );
          const color = index === items.length - 1 ? tones.green : tones.cyan;
          return (
            <div
              key={item}
              style={{
                position: 'absolute',
                left: 304,
                top: index * 76,
                width: 286,
                minHeight: 62,
                display: 'flex',
                alignItems: 'center',
                padding: '10px 15px',
                boxSizing: 'border-box',
                color: tones.white,
                background: 'rgba(4,13,20,0.31)',
                borderLeft: `4px solid ${color}`,
                fontSize: 22,
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
              <span style={{fontSize: 23, lineHeight: 1.16, fontWeight: 900}}>{item}</span>
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
        {layer.title}
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
  const {durationInFrames} = useVideoConfig();
  const opacity = useSceneOpacity();
  const reveal = useReveal(3);
  const scale = interpolate(frame, [0, durationInFrames], [1.02, 1.075], clamp);
  if (!layer.params.src) return null;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#03080D', opacity}}>
      <Video
        src={staticFile(layer.params.src)}
        muted
        loop
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(1.035) saturate(0.96) brightness(0.82)',
          transform: `scale(${scale})`,
        }}
      />
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
        场景演绎 · 不作事实证据
      </div>
    </AbsoluteFill>
  );
};

export const V8Closing: React.FC<{layer: V8SemanticLayer}> = ({layer}) => {
  const reveal = useReveal(0);
  const opacity = useSceneOpacity();
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
      <div style={{marginTop: 13, fontSize: 62, lineHeight: 1.04, fontWeight: 950}}>
        {layer.title}
      </div>
      <div style={{marginTop: 15, color: tones.cyan, fontSize: 29, fontWeight: 930}}>
        {layer.detail}
      </div>
    </div>
  );
};
