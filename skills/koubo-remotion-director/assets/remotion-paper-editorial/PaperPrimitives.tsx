import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  DIRECTOR_ANIMATION_FRAMES,
  PAPER_EDITORIAL,
  PaperMaterial,
  clamp01,
} from './style';

const {colors, font} = PAPER_EDITORIAL;

const tornA =
  'polygon(1% 3%,8% 1%,15% 3%,23% 0,31% 3%,40% 1%,49% 4%,58% 0,67% 3%,76% 1%,85% 4%,94% 1%,99% 4%,97% 17%,100% 31%,97% 45%,100% 59%,97% 73%,100% 87%,98% 98%,88% 100%,78% 97%,68% 100%,58% 97%,48% 100%,38% 97%,28% 100%,17% 97%,2% 100%,3% 85%,0 71%,3% 57%,0 43%,3% 29%,0 15%)';

const tornB =
  'polygon(0 5%,10% 2%,19% 5%,30% 1%,41% 4%,52% 0,63% 4%,75% 1%,87% 5%,99% 2%,97% 18%,100% 34%,97% 51%,100% 67%,97% 83%,100% 97%,88% 99%,76% 96%,64% 100%,51% 97%,38% 100%,25% 96%,13% 100%,1% 97%,3% 81%,0 65%,3% 49%,0 33%,3% 18%)';

export const PaperGrain: React.FC<{
  dark?: boolean;
  strength?: number;
  dotSize?: number;
}> = ({dark = false, strength = 1, dotSize = 1.1}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity: (dark ? 0.14 : 0.2) * strength,
      mixBlendMode: dark ? 'screen' : 'multiply',
      backgroundImage: [
        `radial-gradient(circle at 23% 31%, ${dark ? colors.paper : colors.ink} 0 ${dotSize}px, transparent ${dotSize + 0.4}px)`,
        `radial-gradient(circle at 74% 67%, ${dark ? colors.paperLight : colors.inkSoft} 0 ${dotSize * 0.7}px, transparent ${dotSize + 0.2}px)`,
        `repeating-linear-gradient(7deg, transparent 0 10px, ${dark ? 'rgba(255,248,231,.15)' : 'rgba(20,39,45,.09)'} 11px 12px)`,
        `repeating-linear-gradient(97deg, transparent 0 26px, ${dark ? 'rgba(255,248,231,.08)' : 'rgba(20,39,45,.05)'} 27px 28px)`,
      ].join(','),
      backgroundSize: '13px 13px, 19px 19px, 100% 12px, 28px 100%',
    }}
  />
);

export const Workbench: React.FC<{label?: string}> = ({label = '纸媒叙事装配'}) => (
  <AbsoluteFill
    style={{
      overflow: 'hidden',
      background:
        'radial-gradient(circle at 48% 38%, #F7EFD9 0 23%, #E2CDA4 57%, #B99767 100%)',
      color: colors.ink,
      fontFamily: font,
    }}
  >
    <PaperGrain strength={0.48} dotSize={0.65} />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'linear-gradient(104deg, transparent 0 18%, rgba(86,57,30,.08) 18.1% 18.35%, transparent 18.45% 64%, rgba(86,57,30,.07) 64.1% 64.35%, transparent 64.45%), radial-gradient(ellipse at 50% 118%, rgba(61,38,20,.18), transparent 58%)',
        boxShadow: 'inset 0 0 110px rgba(75,45,22,.2)',
      }}
    />
  </AbsoluteFill>
);

const materialSurface = (material: PaperMaterial | string, color: string) => {
  if (material === 'blueprint') {
    return `linear-gradient(145deg, rgba(255,255,255,.16), transparent 35%), ${color}`;
  }
  if (material === 'photo') {
    return `linear-gradient(160deg, rgba(255,255,255,.82) 0 3%, ${color} 4% 92%, rgba(20,39,45,.13))`;
  }
  if (material === 'film') {
    return `linear-gradient(135deg, rgba(255,255,255,.16), transparent 30%), ${color}`;
  }
  if (material === 'metal') {
    return `linear-gradient(135deg, #D5C18D 0, ${color} 34%, #6D4D1E 70%, #CCB477 100%)`;
  }
  return `linear-gradient(148deg, rgba(255,255,255,.44) 0 2.5%, ${color} 3.5% 76%, rgba(20,39,45,.16) 100%)`;
};

export const PaperPiece: React.FC<{
  children?: React.ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  enterFrame?: number;
  color?: string;
  material?: PaperMaterial | string;
  rotate?: number;
  tiltX?: number;
  tiltY?: number;
  thickness?: number;
  direction?: 'drop' | 'left' | 'right' | 'rise' | 'press';
  zIndex?: number;
  clip?: 'a' | 'b' | 'none';
  radius?: number;
  style?: React.CSSProperties;
}> = ({
  children,
  x,
  y,
  width,
  height,
  enterFrame = 0,
  color = colors.paper,
  material = 'uncoated',
  rotate = 0,
  tiltX = 0,
  tiltY = 0,
  thickness = 5,
  direction = 'drop',
  zIndex = 10,
  clip = 'a',
  radius = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = clamp01(
    spring({
      frame: frame - enterFrame,
      fps,
      durationInFrames: DIRECTOR_ANIMATION_FRAMES.paperPiece,
      config: {damping: 17, stiffness: 145, mass: 1.05},
    }),
  );
  const vectors = {
    drop: [0, -150, -4, 1.04],
    left: [-220, 18, -6, 1],
    right: [230, -10, 6, 1],
    rise: [0, 180, 3, 0.92],
    press: [0, -45, -8, 1.22],
  } as const;
  const [fromX, fromY, fromRotate, fromScale] = vectors[direction];
  const tx = interpolate(progress, [0, 1], [fromX, 0]);
  const ty = interpolate(progress, [0, 1], [fromY, 0]);
  const turn = interpolate(progress, [0, 1], [rotate + fromRotate, rotate]);
  const scale = interpolate(progress, [0, 1], [fromScale, 1]);
  const clipPath = clip === 'a' ? tornA : clip === 'b' ? tornB : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity: progress,
        transformStyle: 'preserve-3d',
        transform: `perspective(1450px) translate3d(${tx}px, ${ty}px, 0) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotateZ(${turn}deg) scale(${scale})`,
        zIndex,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '5%',
          right: '4%',
          bottom: -Math.max(18, thickness * 4),
          height: Math.max(32, thickness * 6),
          borderRadius: '50%',
          background: colors.shadow,
          opacity: 0.72 * progress,
          filter: 'blur(18px)',
          transform: 'scaleX(.95)',
        }}
      />
      {Array.from({length: thickness}).map((_, index) => {
        const depth = thickness - index;
        return (
          <div
            key={depth}
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate3d(${depth * 1.8}px, ${depth * 2.8}px, ${-depth}px)`,
              background: color,
              filter: `brightness(${0.47 + index * 0.055}) saturate(.82)`,
              clipPath,
              borderRadius: radius,
              boxShadow: index === 0 ? '0 7px 0 rgba(5,14,17,.26)' : undefined,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: materialSurface(material, color),
          clipPath,
          borderRadius: radius,
          overflow: 'hidden',
          boxShadow:
            'inset 0 3px 0 rgba(255,255,255,.43), inset -6px -7px 0 rgba(20,39,45,.1), 0 24px 34px rgba(3,10,13,.18)',
        }}
      >
        {material !== 'metal' ? <PaperGrain dark={material === 'film'} strength={0.72} /> : null}
        {children}
      </div>
    </div>
  );
};

export const InkLabel: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
}> = ({children, size = 30, color = colors.ink, align = 'left', style}) => (
  <div
    style={{
      position: 'relative',
      zIndex: 4,
      color,
      fontFamily: font,
      fontSize: size,
      lineHeight: 1.15,
      fontWeight: 900,
      letterSpacing: 1,
      textAlign: align,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Twine: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  enterFrame: number;
  color?: string;
  width?: number;
  zIndex?: number;
}> = ({x1, y1, x2, y2, enterFrame, color = colors.red, width = 7, zIndex = 18}) => {
  const frame = useCurrentFrame();
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const progress = interpolate(frame, [enterFrame, enterFrame + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: x1,
        top: y1,
        width: length,
        height: width,
        transformOrigin: '0 50%',
        transform: `rotate(${angle}deg) scaleX(${progress})`,
        background: `linear-gradient(180deg, rgba(255,255,255,.36), ${color} 38%, rgba(0,0,0,.24))`,
        borderRadius: 99,
        boxShadow: '0 5px 7px rgba(4,11,14,.34)',
        zIndex,
      }}
    />
  );
};

export const PaperPin: React.FC<{
  x: number;
  y: number;
  enterFrame: number;
  color?: string;
  size?: number;
  zIndex?: number;
}> = ({x, y, enterFrame, color = colors.red, size = 34, zIndex = 35}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = clamp01(
    spring({
      frame: frame - enterFrame,
      fps,
      durationInFrames: DIRECTOR_ANIMATION_FRAMES.paperPin,
      config: {damping: 13, stiffness: 220},
    }),
  );
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 27%, #FFF8E7 0 8%, ${color} 12% 58%, #54231B 100%)`,
        boxShadow: '4px 9px 9px rgba(3,10,13,.42)',
        transform: `translateY(${interpolate(p, [0, 1], [-85, 0])}px) scale(${p})`,
        opacity: p,
        zIndex,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '48%',
          top: '78%',
          width: 4,
          height: 30,
          background: '#746247',
          transform: 'rotate(11deg)',
          transformOrigin: 'top',
        }}
      />
    </div>
  );
};

export const FilmReel: React.FC<{label: string}> = ({label}) => (
  <div style={{position: 'absolute', inset: 0, color: colors.paperLight, fontFamily: font}}>
    <div
      style={{
        position: 'absolute',
        left: 34,
        top: 30,
        width: 102,
        height: 102,
        border: `13px solid ${colors.paperLight}`,
        borderRadius: '50%',
        boxShadow: `inset 0 0 0 5px ${colors.ink}`,
      }}
    >
      {[0, 90, 180, 270].map((turn) => (
        <div
          key={turn}
          style={{
            position: 'absolute',
            left: 38,
            top: 6,
            width: 14,
            height: 31,
            borderRadius: 20,
            background: colors.ink,
            transformOrigin: '7px 45px',
            transform: `rotate(${turn}deg)`,
          }}
        />
      ))}
    </div>
    <div style={{position: 'absolute', left: 144, top: 85, width: 185, height: 46, borderTop: `17px double ${colors.paperLight}`}} />
    <InkLabel color={colors.paperLight} size={27} style={{position: 'absolute', left: 35, bottom: 22}}>
      {label}
    </InkLabel>
  </div>
);

export const CommentMagnifier: React.FC<{label: string}> = ({label}) => (
  <div style={{position: 'absolute', inset: 0, fontFamily: font}}>
    {[0, 1, 2].map((index) => (
      <div
        key={index}
        style={{
          position: 'absolute',
          left: 32,
          top: 38 + index * 46,
          width: 236 - index * 23,
          height: 18,
          background: index === 1 ? colors.red : colors.inkSoft,
          opacity: 0.82,
        }}
      />
    ))}
    <div
      style={{
        position: 'absolute',
        right: 28,
        top: 40,
        width: 112,
        height: 112,
        borderRadius: '50%',
        border: `15px solid ${colors.ink}`,
        boxShadow: '6px 7px 0 rgba(20,39,45,.2)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        right: 15,
        top: 146,
        width: 88,
        height: 18,
        borderRadius: 99,
        background: colors.ink,
        transform: 'rotate(47deg)',
        transformOrigin: 'left center',
      }}
    />
    <InkLabel size={28} style={{position: 'absolute', left: 30, bottom: 19}}>
      {label}
    </InkLabel>
  </div>
);

export const FoldedMap: React.FC<{label: string}> = ({label}) => (
  <div style={{position: 'absolute', inset: 0, fontFamily: font, color: colors.paperLight}}>
    {[1, 2].map((index) => (
      <div
        key={index}
        style={{position: 'absolute', left: `${index * 33.33}%`, top: 0, bottom: 0, borderLeft: '3px dashed rgba(255,248,231,.55)'}}
      />
    ))}
    <svg width="100%" height="100%" viewBox="0 0 360 210" style={{position: 'absolute', inset: 0}}>
      <path d="M12 158 C80 87 116 177 176 109 C225 53 273 127 348 48" fill="none" stroke="#FFF8E7" strokeWidth="9" strokeDasharray="14 11" />
      <path d="M15 65 L86 26 L146 61 L214 25 L330 72" fill="none" stroke="#D7A52A" strokeWidth="5" opacity=".9" />
    </svg>
    <div style={{position: 'absolute', left: 248, top: 51, width: 34, height: 34, borderRadius: '50% 50% 50% 0', background: colors.red, transform: 'rotate(-45deg)', boxShadow: '5px 7px 0 rgba(0,0,0,.2)'}}>
      <div style={{width: 11, height: 11, borderRadius: '50%', background: colors.paperLight, margin: 7}} />
    </div>
    <InkLabel color={colors.paperLight} size={27} style={{position: 'absolute', left: 26, bottom: 18}}>
      {label}
    </InkLabel>
  </div>
);

export const FriendBubble: React.FC<{label: string}> = ({label}) => (
  <div style={{position: 'absolute', inset: 0, fontFamily: font}}>
    <div
      style={{
        position: 'absolute',
        left: 34,
        right: 35,
        top: 36,
        bottom: 54,
        border: `8px solid ${colors.ink}`,
        borderRadius: '44% 48% 42% 46%',
        background: 'rgba(255,248,231,.34)',
      }}
    >
      <div style={{position: 'absolute', left: 43, top: 40, width: 22, height: 22, borderRadius: '50%', background: colors.ink}} />
      <div style={{position: 'absolute', left: 86, top: 40, width: 22, height: 22, borderRadius: '50%', background: colors.ink}} />
      <div style={{position: 'absolute', right: 43, top: 40, width: 22, height: 22, borderRadius: '50%', background: colors.ink}} />
      <div style={{position: 'absolute', left: 98, bottom: -38, width: 54, height: 64, background: colors.ink, clipPath: 'polygon(0 0,100% 0,18% 100%)'}} />
    </div>
    <InkLabel size={27} style={{position: 'absolute', left: 34, bottom: 17}}>
      {label}
    </InkLabel>
  </div>
);

export const MachineGear: React.FC<{
  x: number;
  y: number;
  size: number;
  turn: number;
  color?: string;
  zIndex?: number;
}> = ({x, y, size, turn, color = colors.brass, zIndex = 30}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size,
      borderRadius: '50%',
      border: `${Math.max(12, size * 0.09)}px dotted ${color}`,
      background: `radial-gradient(circle, ${colors.ink} 0 18%, ${color} 19% 43%, #63461D 44% 52%, transparent 53%)`,
      filter: 'drop-shadow(10px 14px 8px rgba(2,8,10,.35))',
      transform: `rotate(${turn}deg)`,
      zIndex,
    }}
  />
);

export const Conveyor: React.FC<{
  x: number;
  y: number;
  width: number;
  enterFrame: number;
  progress: number;
}> = ({x, y, width, enterFrame, progress}) => {
  const frame = useCurrentFrame();
  const visible = interpolate(frame, [enterFrame, enterFrame + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{position: 'absolute', left: x, top: y, width, height: 116, opacity: visible, zIndex: 19}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 25, height: 55, background: '#5C4B32', border: `8px solid ${colors.ink}`, boxShadow: '0 18px 22px rgba(0,0,0,.32)'}}>
        <div style={{position: 'absolute', inset: 6, overflow: 'hidden', backgroundImage: `repeating-linear-gradient(90deg, ${colors.kraft} 0 48px, #7D603D 49px 55px)`, backgroundPositionX: `${-progress * 110}px`}} />
      </div>
      {[0, width - 56].map((left) => (
        <div key={left} style={{position: 'absolute', left, top: 19, width: 58, height: 68, borderRadius: '50%', background: `radial-gradient(circle, ${colors.ink} 0 21%, #A47E46 23% 53%, ${colors.ink} 55%)`}} />
      ))}
    </div>
  );
};
