import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeV3, landV3} from './motionV3';
import {v3Font, v3Palette} from './paletteV3';

export const tornV3A =
  'polygon(1% 4%, 7% 1%, 14% 3%, 23% 0, 31% 3%, 40% 1%, 49% 4%, 57% 0, 66% 3%, 76% 1%, 84% 4%, 93% 1%, 99% 4%, 97% 15%, 100% 28%, 97% 42%, 100% 56%, 97% 70%, 100% 84%, 98% 97%, 89% 99%, 78% 97%, 68% 100%, 58% 97%, 48% 100%, 37% 97%, 27% 100%, 16% 97%, 2% 100%, 3% 86%, 0 73%, 3% 58%, 0 44%, 3% 30%, 0 16%)';

export const tornV3B =
  'polygon(0 6%, 11% 2%, 20% 5%, 31% 1%, 42% 4%, 53% 0, 64% 4%, 76% 1%, 87% 5%, 99% 2%, 97% 18%, 100% 34%, 97% 51%, 100% 67%, 97% 83%, 100% 97%, 88% 99%, 76% 96%, 64% 100%, 51% 97%, 38% 100%, 25% 96%, 13% 100%, 1% 97%, 3% 81%, 0 65%, 3% 49%, 0 33%, 3% 18%)';

export const PaperFiberV3: React.FC<{dark?: boolean; strength?: number}> = ({
  dark = false,
  strength = 1,
}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity: (dark ? 0.12 : 0.18) * strength,
      mixBlendMode: dark ? 'screen' : 'multiply',
      backgroundImage: [
        `radial-gradient(circle at 22% 31%, ${dark ? '#FFF7E3' : '#14282E'} 0 0.8px, transparent 1px)`,
        `radial-gradient(circle at 78% 63%, ${dark ? '#FFF7E3' : '#14282E'} 0 0.65px, transparent 1px)`,
        `repeating-linear-gradient(7deg, transparent 0 9px, ${dark ? 'rgba(255,247,227,.18)' : 'rgba(20,40,46,.12)'} 10px 11px)`,
        `repeating-linear-gradient(97deg, transparent 0 23px, ${dark ? 'rgba(255,247,227,.08)' : 'rgba(20,40,46,.06)'} 24px 25px)`,
      ].join(','),
      backgroundSize: '11px 11px, 17px 17px, 100% 11px, 25px 100%',
    }}
  />
);

export const HalftoneV3: React.FC<{
  color?: string;
  opacity?: number;
  size?: number;
}> = ({color = v3Palette.ink, opacity = 0.25, size = 10}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity,
      backgroundImage: `radial-gradient(${color} 0 1.5px, transparent 1.8px)`,
      backgroundSize: `${size}px ${size}px`,
    }}
  />
);

type CardstockPieceV3Props = {
  children?: React.ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
  color: string;
  clipPath?: string;
  rotate?: number;
  tiltX?: number;
  tiltY?: number;
  thickness?: number;
  enter?: 'drop' | 'left' | 'right' | 'rise' | 'press';
  zIndex?: number;
  radius?: number | string;
  origin?: string;
  style?: React.CSSProperties;
};

const enters = {
  drop: {x: 0, y: -190, scale: 1.04, rotate: -4},
  left: {x: -230, y: 20, scale: 1, rotate: -6},
  right: {x: 240, y: -10, scale: 1, rotate: 6},
  rise: {x: 0, y: 210, scale: 0.92, rotate: 3},
  press: {x: 0, y: -48, scale: 1.28, rotate: -9},
} as const;

export const CardstockPieceV3: React.FC<CardstockPieceV3Props> = ({
  children,
  x,
  y,
  width,
  height,
  delay,
  color,
  clipPath = tornV3A,
  rotate = 0,
  tiltX = 0,
  tiltY = 0,
  thickness = 5,
  enter = 'drop',
  zIndex = 10,
  radius = 0,
  origin = '50% 50%',
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = landV3(frame, Math.round(delay * fps), fps);
  const from = enters[enter];
  const tx = interpolate(p, [0, 1], [from.x, 0]);
  const ty = interpolate(p, [0, 1], [from.y, 0]);
  const scale = interpolate(p, [0, 1], [from.scale, 1]);
  const turn = interpolate(p, [0, 1], [rotate + from.rotate, rotate]);
  const contact = interpolate(p, [0, 0.78, 1], [0, 0.24, 0.34]);
  const blur = interpolate(p, [0, 1], [36, 18]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity: p,
        transformOrigin: origin,
        transformStyle: 'preserve-3d',
        transform: `perspective(1500px) translate3d(${tx}px, ${ty}px, 0) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotateZ(${turn}deg) scale(${scale})`,
        zIndex,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '4%',
          right: '4%',
          bottom: -Math.max(16, thickness * 3.2),
          height: Math.max(28, thickness * 5),
          borderRadius: '50%',
          background: `rgba(8, 18, 21, ${contact})`,
          filter: `blur(${blur}px)`,
          transform: `scaleX(${0.92 + p * 0.08})`,
          zIndex: 0,
        }}
      />
      {Array.from({length: thickness}).map((_, index) => {
        const layer = thickness - index;
        return (
          <div
            key={layer}
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate3d(${layer * 1.6}px, ${layer * 2.5}px, ${-layer}px)`,
              background: color,
              filter: `brightness(${0.52 + index * 0.035}) saturate(.8)`,
              clipPath,
              borderRadius: radius,
              boxShadow: index === 0 ? '0 7px 0 rgba(11,25,30,.24)' : 'none',
              zIndex: 1 + index,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(148deg, rgba(255,255,255,.46) 0 2.4%, ${color} 3.2% 74%, rgba(18,35,39,.18) 100%)`,
          clipPath,
          borderRadius: radius,
          boxShadow: 'inset 0 3px 0 rgba(255,255,255,.42), inset -5px -6px 0 rgba(15,31,35,.08), 0 20px 30px rgba(8,18,21,.12)',
          overflow: 'hidden',
          zIndex: thickness + 3,
        }}
      >
        <PaperFiberV3 strength={0.82} />
        {children}
      </div>
    </div>
  );
};

export const SceneMarkV3: React.FC<{
  number: string;
  label: string;
  title: string;
  inverse?: boolean;
  align?: 'left' | 'right';
}> = ({number, label, title, inverse = false, align = 'left'}) => (
  <div
    style={{
      position: 'absolute',
      left: align === 'left' ? 76 : undefined,
      right: align === 'right' ? 84 : undefined,
      top: 55,
      zIndex: 80,
      display: 'flex',
      flexDirection: align === 'right' ? 'row-reverse' : 'row',
      gap: 20,
      alignItems: 'flex-start',
      color: inverse ? v3Palette.paperLight : v3Palette.ink,
      fontFamily: v3Font,
      textAlign: align,
    }}
  >
    <div
      style={{
        border: `3px solid ${inverse ? v3Palette.paperLight : v3Palette.ink}`,
        borderRadius: 99,
        padding: '9px 11px 8px',
        fontSize: 21,
        lineHeight: 1,
        fontWeight: 950,
      }}
    >
      {number}
    </div>
    <div>
      <div style={{fontSize: 17, fontWeight: 850, letterSpacing: 5, opacity: 0.72}}>{label}</div>
      <div style={{fontSize: 39, lineHeight: 1.12, fontWeight: 950, marginTop: 7, letterSpacing: 1}}>{title}</div>
    </div>
  </div>
);

export const PaperWipeV3: React.FC<{
  direction?: 'left' | 'right';
  primary?: string;
  secondary?: string;
  handoffLabel: string;
  durationInFrames?: number;
}> = ({direction = 'left', primary = v3Palette.red, secondary = v3Palette.paperLight, handoffLabel, durationInFrames = 20}) => {
  const frame = useCurrentFrame();
  const p = easeV3(frame, 0, Math.max(1, durationInFrames - 1));
  const sign = direction === 'left' ? 1 : -1;
  const x1 = interpolate(p, [0, 0.58, 1], [sign * -2200, sign * -120, sign * 2200]);
  const x2 = interpolate(p, [0, 0.66, 1], [sign * -2420, sign * -320, sign * 2050]);

  return (
    <AbsoluteFill style={{zIndex: 200, pointerEvents: 'none', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: -210,
          top: 24,
          width: 2340,
          height: 780,
          background: primary,
          zIndex: 2,
          clipPath: tornV3B,
          transform: `translateX(${x1}px) rotate(${direction === 'left' ? -4 : 4}deg)`,
          boxShadow: '0 45px 70px rgba(7,17,21,.38)',
        }}
      >
        <PaperFiberV3 />
        <div style={{position:'absolute',left:875,top:305,width:590,height:142,background:v3Palette.paperLight,color:v3Palette.ink,fontFamily:v3Font,fontSize:34,fontWeight:950,letterSpacing:4,display:'grid',placeItems:'center',clipPath:tornV3A,boxShadow:'12px 15px 0 rgba(7,17,21,.3)',borderTop:`7px solid ${v3Palette.yellow}`}}>
          {handoffLabel}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: -420,
          top: 215,
          width: 2350,
          height: 535,
          background: secondary,
          zIndex: 1,
          clipPath: tornV3A,
          transform: `translateX(${x2}px) rotate(${direction === 'left' ? 5 : -5}deg)`,
          boxShadow: '0 36px 60px rgba(7,17,21,.32)',
        }}
      >
        <PaperFiberV3 />
      </div>
    </AbsoluteFill>
  );
};
