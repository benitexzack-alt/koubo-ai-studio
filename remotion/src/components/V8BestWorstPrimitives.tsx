import React from 'react';
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

const color = {
  cyan: '#64D8FF',
  green: '#65D69A',
  amber: '#FFC45E',
  red: '#FF7068',
  white: '#F8FAFD',
  ink: '#071019',
};

const sceneOpacity = (frame: number, durationInFrames: number) => {
  const fade = Math.min(10, Math.max(5, Math.round(durationInFrames * 0.1)));
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

const panel: React.CSSProperties = {
  position: 'absolute',
  left: 58,
  top: 142,
  width: 650,
  color: color.white,
  fontFamily,
  textShadow: '0 4px 19px rgba(0,0,0,0.95)',
};

const Label: React.FC<{children: React.ReactNode; tone?: string}> = ({
  children,
  tone = color.cyan,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      color: tone,
      fontSize: 17,
      fontWeight: 950,
    }}
  >
    <span style={{width: 26, height: 3, background: tone}} />
    {children}
  </div>
);

const Title: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      marginTop: 13,
      maxWidth: 640,
      fontSize: 45,
      lineHeight: 1.08,
      fontWeight: 950,
    }}
  >
    {children}
  </div>
);

export type V8BestWorstPrimitive =
  | {
      kind: 'fork';
      title: string;
      input: string;
      left: string;
      right: string;
      leftHint?: string;
      rightHint?: string;
    }
  | {
      kind: 'decision-chain';
      title: string;
      items: string[];
    }
  | {
      kind: 'training-ladder';
      title: string;
      items: string[];
      removedIndex?: number;
    }
  | {
      kind: 'bounded-number';
      title: string;
      value: string;
      boundaries: string[];
    }
  | {
      kind: 'j-curve';
      title: string;
      items: string[];
    }
  | {
      kind: 'three-ledgers';
      title: string;
      items: string[];
    };

const Fork: React.FC<Extract<V8BestWorstPrimitive, {kind: 'fork'}>> = (
  props,
) => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const hub = spring({
    frame,
    fps,
    config: {damping: 22, stiffness: 182, mass: 0.84},
  });
  const line = interpolate(frame, [9, 33], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const branch = (delay: number) =>
    interpolate(frame, [delay, delay + 15], [0, 1], clamp);

  return (
    <div style={{...panel, opacity}}>
      <Label>同一套 AI 的两条路径</Label>
      <Title>{props.title}</Title>
      <div style={{position: 'relative', marginTop: 24, width: 640, height: 330}}>
        <svg
          width="640"
          height="330"
          viewBox="0 0 640 330"
          style={{position: 'absolute', inset: 0, overflow: 'visible'}}
        >
          <path
            d="M 166 164 C 254 164, 242 76, 350 76"
            fill="none"
            stroke={color.red}
            strokeWidth="4"
            strokeDasharray="270"
            strokeDashoffset={270 * (1 - line)}
          />
          <path
            d="M 166 164 C 254 164, 242 252, 350 252"
            fill="none"
            stroke={color.green}
            strokeWidth="4"
            strokeDasharray="270"
            strokeDashoffset={270 * (1 - line)}
          />
          <circle cx="350" cy="76" r={7} fill={color.red} opacity={line} />
          <circle cx="350" cy="252" r={7} fill={color.green} opacity={line} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: 111,
            width: 166,
            minHeight: 106,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            boxSizing: 'border-box',
            color: color.cyan,
            background: 'rgba(3,12,19,0.36)',
            border: `2px solid ${color.cyan}`,
            fontSize: 25,
            lineHeight: 1.12,
            textAlign: 'center',
            fontWeight: 950,
            opacity: hub,
            transform: `scale(${0.92 + hub * 0.08})`,
          }}
        >
          {props.input}
        </div>
        {[
          {
            top: 28,
            value: props.left,
            hint: props.leftHint,
            tone: color.red,
            reveal: branch(20),
          },
          {
            top: 204,
            value: props.right,
            hint: props.rightHint,
            tone: color.green,
            reveal: branch(29),
          },
        ].map((item) => (
          <div
            key={item.value}
            style={{
              position: 'absolute',
              left: 364,
              top: item.top,
              width: 268,
              minHeight: 96,
              padding: '15px 18px',
              boxSizing: 'border-box',
              background: 'rgba(3,12,19,0.32)',
              borderLeft: `5px solid ${item.tone}`,
              opacity: item.reveal,
              transform: `translateX(${(1 - item.reveal) * 20}px)`,
            }}
          >
            <div style={{color: item.tone, fontSize: 28, fontWeight: 950}}>
              {item.value}
            </div>
            {item.hint ? (
              <div
                style={{
                  marginTop: 8,
                  color: 'rgba(248,250,253,0.72)',
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {item.hint}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const DecisionChain: React.FC<
  Extract<V8BestWorstPrimitive, {kind: 'decision-chain'}>
> = ({title, items}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const shown = items.slice(0, 5);
  return (
    <div style={{...panel, opacity}}>
      <Label>决策责任链</Label>
      <Title>{title}</Title>
      <div style={{position: 'relative', marginTop: 34, display: 'grid', gap: 15}}>
        {shown.map((item, index) => {
          const reveal = interpolate(
            frame,
            [5 + index * 9, 17 + index * 9],
            [0, 1],
            clamp,
          );
          const tone = index === 0 ? color.cyan : index === shown.length - 1 ? color.amber : color.green;
          return (
            <div
              key={item}
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: '64px 1fr',
                alignItems: 'center',
                minHeight: 62,
                opacity: reveal,
                transform: `translateX(${(1 - reveal) * -18}px)`,
              }}
            >
              <span style={{color: tone, fontSize: 16, fontWeight: 950}}>
                0{index + 1}
              </span>
              <span
                style={{
                  borderLeft: `4px solid ${tone}`,
                  padding: '9px 0 9px 17px',
                  background: 'linear-gradient(90deg, rgba(3,12,19,0.34), transparent)',
                  fontSize: 27,
                  fontWeight: 930,
                }}
              >
                {item}
              </span>
              {index < shown.length - 1 ? (
                <span
                  style={{
                    position: 'absolute',
                    left: 21,
                    bottom: -19,
                    width: 2,
                    height: 22,
                    background: 'rgba(100,216,255,0.55)',
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TrainingLadder: React.FC<
  Extract<V8BestWorstPrimitive, {kind: 'training-ladder'}>
> = ({title, items, removedIndex = 0}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const remove = interpolate(frame, [38, 56], [0, 1], clamp);
  return (
    <div style={{...panel, opacity}}>
      <Label tone={color.amber}>练级台阶</Label>
      <Title>{title}</Title>
      <div
        style={{
          marginTop: 34,
          height: 350,
          display: 'flex',
          flexDirection: 'column-reverse',
          justifyContent: 'flex-start',
          gap: 14,
        }}
      >
        {items.slice(0, 3).map((item, index) => {
          const reveal = interpolate(frame, [7 + index * 10, 21 + index * 10], [0, 1], clamp);
          const isRemoved = index === removedIndex;
          const widths = [330, 448, 574];
          return (
            <div
              key={item}
              style={{
                width: widths[index] ?? 574,
                minHeight: 78,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                boxSizing: 'border-box',
                background: 'rgba(3,12,19,0.34)',
                borderLeft: `5px solid ${isRemoved ? color.red : color.cyan}`,
                fontSize: 27,
                fontWeight: 930,
                opacity: reveal * (isRemoved ? 1 - remove * 0.58 : 1),
                transform: `translateX(${(1 - reveal) * -18 + (isRemoved ? remove * 54 : 0)}px)`,
              }}
            >
              <span style={{marginRight: 18, color: isRemoved ? color.red : color.cyan}}>
                0{index + 1}
              </span>
              {item}
              {isRemoved ? (
                <span
                  style={{
                    marginLeft: 'auto',
                    color: color.red,
                    fontSize: 17,
                    opacity: remove,
                  }}
                >
                  先被机器拿走
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BoundedNumber: React.FC<
  Extract<V8BestWorstPrimitive, {kind: 'bounded-number'}>
> = ({title, value, boundaries}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const number = spring({
    frame: frame - 4,
    fps,
    config: {damping: 19, stiffness: 190, mass: 0.86},
  });
  return (
    <div style={{...panel, opacity}}>
      <Label tone={color.amber}>数字必须带边界</Label>
      <Title>{title}</Title>
      <div style={{display: 'flex', alignItems: 'center', gap: 27, marginTop: 25}}>
        <div
          style={{
            color: color.amber,
            fontSize: 104,
            lineHeight: 1,
            fontWeight: 950,
            transform: `scale(${0.82 + number * 0.18})`,
          }}
        >
          {value}
        </div>
        <div style={{width: 390, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
          {boundaries.slice(0, 4).map((item, index) => {
            const reveal = interpolate(frame, [16 + index * 7, 28 + index * 7], [0, 1], clamp);
            return (
              <div
                key={item}
                style={{
                  minHeight: 66,
                  display: 'grid',
                  placeItems: 'center',
                  padding: '8px 12px',
                  boxSizing: 'border-box',
                  color: index === 3 ? color.green : color.white,
                  background: 'rgba(3,12,19,0.34)',
                  borderBottom: `3px solid ${index === 3 ? color.green : color.cyan}`,
                  fontSize: 21,
                  lineHeight: 1.12,
                  textAlign: 'center',
                  fontWeight: 920,
                  opacity: reveal,
                  transform: `translateY(${(1 - reveal) * 12}px)`,
                }}
              >
                {item}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const JCurve: React.FC<Extract<V8BestWorstPrimitive, {kind: 'j-curve'}>> = ({
  title,
  items,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const progress = interpolate(frame, [8, 51], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const pathLength = 690;
  return (
    <div style={{...panel, opacity}}>
      <Label>通用技术的互补投入</Label>
      <Title>{title}</Title>
      <div style={{position: 'relative', marginTop: 20, width: 640, height: 330}}>
        <svg width="640" height="330" viewBox="0 0 640 330">
          <path d="M 54 22 V 286 H 610" fill="none" stroke="rgba(248,250,253,0.32)" strokeWidth="2" />
          <path
            d="M 54 78 C 170 92, 184 240, 280 240 C 405 240, 410 79, 602 42"
            fill="none"
            stroke={color.cyan}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={pathLength}
            strokeDashoffset={pathLength * (1 - progress)}
            style={{filter: 'drop-shadow(0 0 8px rgba(100,216,255,0.62))'}}
          />
          <line x1="280" x2="280" y1="240" y2="286" stroke={color.amber} strokeWidth="3" strokeDasharray="7 7" opacity={progress} />
          <circle cx="280" cy="240" r="8" fill={color.amber} opacity={progress} />
        </svg>
        <div style={{position: 'absolute', left: 62, top: 64, color: color.red, fontSize: 19, fontWeight: 920}}>先投入与重构</div>
        <div style={{position: 'absolute', right: 30, top: 25, color: color.green, fontSize: 19, fontWeight: 920}}>再释放能力</div>
        <div
          style={{
            position: 'absolute',
            left: 98,
            bottom: 12,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            width: 510,
          }}
        >
          {items.slice(0, 4).map((item, index) => {
            const reveal = interpolate(frame, [24 + index * 6, 35 + index * 6], [0, 1], clamp);
            return (
              <span
                key={item}
                style={{
                  padding: '7px 11px',
                  color: index === 3 ? color.amber : color.white,
                  background: 'rgba(3,12,19,0.38)',
                  borderBottom: `2px solid ${index === 3 ? color.amber : color.cyan}`,
                  fontSize: 18,
                  fontWeight: 900,
                  opacity: reveal,
                }}
              >
                {item}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ThreeLedgers: React.FC<
  Extract<V8BestWorstPrimitive, {kind: 'three-ledgers'}>
> = ({title, items}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const colors = [color.cyan, color.green, color.amber];
  const endpoints = [0.9, 0.72, 0.44];
  return (
    <div style={{...panel, opacity}}>
      <Label tone={color.amber}>三本账不能混算</Label>
      <Title>{title}</Title>
      <div style={{marginTop: 30, display: 'grid', gap: 22}}>
        {items.slice(0, 3).map((item, index) => {
          const reveal = interpolate(frame, [6 + index * 9, 20 + index * 9], [0, 1], clamp);
          return (
            <div key={item} style={{opacity: reveal}}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 13}}>
                <span style={{color: colors[index], fontSize: 17, fontWeight: 950}}>账本 0{index + 1}</span>
                <span style={{fontSize: 26, fontWeight: 930}}>{item}</span>
              </div>
              <div style={{marginTop: 10, width: 610, height: 7, background: 'rgba(248,250,253,0.12)'}}>
                <div
                  style={{
                    width: `${endpoints[index] * reveal * 100}%`,
                    height: '100%',
                    background: colors[index],
                    boxShadow: `0 0 13px ${colors[index]}66`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const V8BestWorstPrimitiveStage: React.FC<{
  scene: V8BestWorstPrimitive;
}> = ({scene}) => {
  switch (scene.kind) {
    case 'fork':
      return <Fork {...scene} />;
    case 'decision-chain':
      return <DecisionChain {...scene} />;
    case 'training-ladder':
      return <TrainingLadder {...scene} />;
    case 'bounded-number':
      return <BoundedNumber {...scene} />;
    case 'j-curve':
      return <JCurve {...scene} />;
    case 'three-ledgers':
      return <ThreeLedgers {...scene} />;
  }
};
