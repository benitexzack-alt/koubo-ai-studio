import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontFamily, palette} from './palette';
import {paperSpring, progress} from './motion';

export type EnterFrom = 'left' | 'right' | 'top' | 'bottom' | 'scale' | 'fold';

type AssemblyPieceProps = {
  children?: React.ReactNode;
  delay: number;
  enterFrom?: EnterFrom;
  style?: React.CSSProperties;
  className?: string;
  shadow?: 'soft' | 'deep' | 'none';
};

const enterOffset: Record<EnterFrom, {x: number; y: number; scale: number; rotate: number}> = {
  left: {x: -150, y: 10, scale: 0.98, rotate: -5},
  right: {x: 150, y: -8, scale: 0.98, rotate: 5},
  top: {x: 0, y: -120, scale: 0.98, rotate: -3},
  bottom: {x: 0, y: 130, scale: 0.98, rotate: 3},
  scale: {x: 0, y: 0, scale: 0.55, rotate: -7},
  fold: {x: 38, y: -18, scale: 0.7, rotate: 12},
};

const shadows = {
  soft: '0 12px 24px rgba(20, 34, 36, 0.18), 0 3px 0 rgba(25, 44, 50, 0.12)',
  deep: '0 28px 50px rgba(12, 24, 28, 0.30), 0 6px 0 rgba(25, 44, 50, 0.16)',
  none: 'none',
} as const;

export const tornClipA =
  'polygon(1% 3%, 9% 0, 18% 2%, 27% 0, 36% 2%, 47% 0, 56% 3%, 66% 1%, 77% 3%, 87% 0, 98% 2%, 100% 14%, 98% 28%, 100% 43%, 98% 59%, 100% 73%, 98% 88%, 99% 98%, 87% 100%, 75% 98%, 64% 100%, 52% 98%, 40% 100%, 28% 98%, 16% 100%, 2% 98%, 0 84%, 2% 69%, 0 54%, 2% 39%, 0 24%)';

export const tornClipB =
  'polygon(0 5%, 12% 1%, 24% 3%, 35% 0, 49% 3%, 62% 1%, 75% 4%, 88% 1%, 100% 5%, 98% 19%, 100% 34%, 98% 48%, 100% 64%, 98% 78%, 100% 95%, 87% 99%, 73% 97%, 58% 100%, 45% 97%, 31% 100%, 16% 97%, 1% 100%, 2% 83%, 0 67%, 2% 50%, 0 34%, 2% 18%)';

export const AssemblyPiece: React.FC<AssemblyPieceProps> = ({
  children,
  delay,
  enterFrom = 'scale',
  style,
  className,
  shadow = 'soft',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = paperSpring(frame, Math.round(delay * fps), fps);
  const from = enterOffset[enterFrom];
  const x = interpolate(p, [0, 1], [from.x, 0]);
  const y = interpolate(p, [0, 1], [from.y, 0]);
  const scale = interpolate(p, [0, 1], [from.scale, 1]);
  const rotate = interpolate(p, [0, 1], [from.rotate, 0]);

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        opacity: p,
        transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`,
        transformOrigin: enterFrom === 'fold' ? '0% 100%' : '50% 50%',
        boxShadow: shadows[shadow],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const PaperGrain: React.FC<{opacity?: number; dark?: boolean}> = ({
  opacity = 0.18,
  dark = false,
}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity,
      mixBlendMode: dark ? 'screen' : 'multiply',
      backgroundImage: [
        'radial-gradient(circle at 18% 24%, rgba(31,44,48,.25) 0 0.9px, transparent 1.2px)',
        'radial-gradient(circle at 72% 68%, rgba(31,44,48,.18) 0 0.7px, transparent 1.1px)',
        'repeating-linear-gradient(8deg, transparent 0 6px, rgba(31,44,48,.035) 7px 8px)',
      ].join(','),
      backgroundSize: '13px 13px, 17px 17px, 100% 9px',
    }}
  />
);

export const Halftone: React.FC<{
  color?: string;
  opacity?: number;
  size?: number;
}> = ({color = palette.ink, opacity = 0.18, size = 12}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity,
      backgroundImage: `radial-gradient(${color} 0 1.6px, transparent 1.9px)`,
      backgroundSize: `${size}px ${size}px`,
    }}
  />
);

export const SceneNumber: React.FC<{
  number: string;
  kicker: string;
  title: string;
  inverse?: boolean;
}> = ({number, kicker, title, inverse = false}) => (
  <div
    style={{
      position: 'absolute',
      left: 92,
      top: 62,
      zIndex: 40,
      color: inverse ? palette.creamBright : palette.ink,
      fontFamily,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 22,
    }}
  >
    <div
      style={{
        fontSize: 24,
        lineHeight: 1,
        fontWeight: 900,
        letterSpacing: 2,
        border: `3px solid ${inverse ? palette.creamBright : palette.ink}`,
        borderRadius: 999,
        padding: '11px 13px 10px',
      }}
    >
      {number}
    </div>
    <div>
      <div style={{fontSize: 19, fontWeight: 800, letterSpacing: 5, opacity: 0.7}}>
        {kicker}
      </div>
      <div style={{fontSize: 42, lineHeight: 1.1, fontWeight: 950, marginTop: 9}}>
        {title}
      </div>
    </div>
  </div>
);

export const SceneReveal: React.FC<{
  children: React.ReactNode;
  color: string;
  darkGrain?: boolean;
}> = ({children, color, darkGrain = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = progress(frame, 0, Math.round(0.52 * fps));
  const edge = p * 104;
  const clipPath = `polygon(0 0, ${Math.max(0, edge - 1)}% 0, ${Math.max(
    0,
    edge - 3,
  )}% 12%, ${Math.min(104, edge + 1)}% 23%, ${Math.max(
    0,
    edge - 2,
  )}% 36%, ${Math.min(104, edge + 1)}% 49%, ${Math.max(
    0,
    edge - 3,
  )}% 63%, ${Math.min(104, edge + 1)}% 76%, ${Math.max(
    0,
    edge - 2,
  )}% 89%, ${Math.min(104, edge + 1)}% 100%, 0 100%)`;

  return (
    <AbsoluteFill style={{background: color, clipPath}}>
      {children}
      <PaperGrain dark={darkGrain} opacity={darkGrain ? 0.11 : 0.16} />
    </AbsoluteFill>
  );
};

export const PaperLabel: React.FC<{
  children: React.ReactNode;
  background?: string;
  color?: string;
  rotate?: number;
}> = ({children, background = palette.creamBright, color = palette.ink, rotate = -1}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      padding: '7px 17px 8px',
      background,
      color,
      fontFamily,
      fontSize: 23,
      fontWeight: 900,
      letterSpacing: 3,
      transform: `rotate(${rotate}deg)`,
      clipPath: tornClipB,
    }}
  >
    {children}
  </div>
);

export const MovingDot: React.FC<{
  start: number;
  duration: number;
  from: [number, number];
  via?: [number, number];
  to: [number, number];
  color?: string;
  size?: number;
}> = ({start, duration, from, via, to, color = palette.brick, size = 20}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = progress(frame, Math.round(start * fps), Math.round(duration * fps));
  const mid = via ?? [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const first = Math.min(1, p * 2);
  const second = Math.max(0, p * 2 - 1);
  const x =
    p < 0.5
      ? interpolate(first, [0, 1], [from[0], mid[0]])
      : interpolate(second, [0, 1], [mid[0], to[0]]);
  const y =
    p < 0.5
      ? interpolate(first, [0, 1], [from[1], mid[1]])
      : interpolate(second, [0, 1], [mid[1], to[1]]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 0 5px ${palette.creamBright}, 0 8px 18px rgba(12,24,28,.25)`,
        zIndex: 28,
        opacity: p > 0 && p < 1 ? 1 : 0,
      }}
    />
  );
};

