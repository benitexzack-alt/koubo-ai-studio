import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  AssemblyPiece,
  Halftone,
  MovingDot,
  PaperLabel,
  SceneNumber,
  SceneReveal,
  tornClipA,
  tornClipB,
} from './PaperPrimitives';
import {drawProgress, paperSpring, progress} from './motion';
import {fontFamily, palette} from './palette';

const InputToken: React.FC<{delay: number; top: number; color: string; symbol: 'bars' | 'dot' | 'grid'}> = ({
  delay,
  top,
  color,
  symbol,
}) => (
  <AssemblyPiece
    delay={delay}
    enterFrom="left"
    shadow="deep"
    style={{
      left: 124,
      top,
      width: 218,
      height: 158,
      background: color,
      clipPath: tornClipA,
      rotate: delay % 0.2 > 0.08 ? '2deg' : '-2deg',
      zIndex: 17,
    }}
  >
    <Halftone color={palette.creamBright} opacity={0.16} size={11} />
    {symbol === 'bars' ? (
      <div style={{position: 'absolute', left: 47, right: 47, top: 38, display: 'flex', alignItems: 'end', gap: 13, height: 80}}>
        {[44, 78, 57, 92].map((height, index) => (
          <div key={index} style={{width: 19, height, background: palette.creamBright}} />
        ))}
      </div>
    ) : null}
    {symbol === 'dot' ? (
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <div style={{width: 78, height: 78, borderRadius: '50%', background: palette.creamBright, boxShadow: `0 0 0 17px ${palette.mustard}`}} />
      </div>
    ) : null}
    {symbol === 'grid' ? (
      <div style={{position: 'absolute', left: 49, top: 32, display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: 10}}>
        {Array.from({length: 9}).map((_, index) => (
          <div
            key={index}
            style={{
              width: 34,
              height: 28,
              background: index === 4 ? palette.mustard : palette.creamBright,
              clipPath: tornClipB,
            }}
          />
        ))}
      </div>
    ) : null}
  </AssemblyPiece>
);

const ProcessingGate: React.FC<{delay: number}> = ({delay}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const turn = progress(frame, Math.round((delay + 0.4) * fps), Math.round(2.4 * fps));

  return (
    <AssemblyPiece
      delay={delay}
      enterFrom="scale"
      shadow="deep"
      style={{
        left: 692,
        top: 324,
        width: 475,
        height: 415,
        background: palette.creamBright,
        clipPath: tornClipB,
        zIndex: 19,
      }}
    >
      <Halftone color={palette.navy} opacity={0.13} size={12} />
      <div
        style={{
          position: 'absolute',
          left: 97,
          top: 61,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: palette.brick,
          boxShadow: `0 0 0 22px ${palette.navy}, 0 18px 0 rgba(20,44,52,.25)`,
          transform: `rotate(${turn * 116}deg)`,
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: 118,
              top: -29,
              width: 45,
              height: 67,
              background: index % 2 === 0 ? palette.brick : palette.mustard,
              transformOrigin: '22px 169px',
              transform: `rotate(${index * 45}deg)`,
              clipPath: tornClipB,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: 77,
            top: 77,
            width: 126,
            height: 126,
            borderRadius: '50%',
            background: palette.creamBright,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div style={{width: 56, height: 56, background: palette.navy, clipPath: 'polygon(0 0, 100% 50%, 0 100%)'}} />
        </div>
      </div>
    </AssemblyPiece>
  );
};

const Building: React.FC<{
  delay: number;
  left: number;
  bottom: number;
  width: number;
  height: number;
  color: string;
  roof?: 'flat' | 'peak' | 'step';
}> = ({delay, left, bottom, width, height, color, roof = 'flat'}) => (
  <AssemblyPiece
    delay={delay}
    enterFrom="bottom"
    shadow="deep"
    style={{
      left,
      bottom,
      width,
      height,
      background: color,
      clipPath:
        roof === 'peak'
          ? 'polygon(50% 0, 100% 18%, 98% 100%, 0 100%, 2% 18%)'
          : roof === 'step'
            ? 'polygon(0 18%, 32% 18%, 32% 0, 73% 0, 73% 11%, 100% 11%, 98% 100%, 1% 100%)'
            : tornClipB,
      zIndex: 23,
    }}
  >
    <Halftone color={palette.ink} opacity={0.11} size={10} />
    <div
      style={{
        position: 'absolute',
        left: Math.round(width * 0.18),
        right: Math.round(width * 0.18),
        top: Math.round(height * 0.24),
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: Math.max(9, Math.round(width * 0.09)),
      }}
    >
      {Array.from({length: height > 240 ? 8 : 6}).map((_, index) => (
        <div
          key={index}
          style={{
            height: Math.max(16, Math.round(height * 0.08)),
            background: index % 3 === 0 ? palette.mustard : palette.creamBright,
            clipPath: tornClipA,
          }}
        />
      ))}
    </div>
  </AssemblyPiece>
);

export const WorldCity: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const road = drawProgress(frame, Math.round(2.28 * fps), Math.round(1.35 * fps));
  const branches = drawProgress(frame, Math.round(3.08 * fps), Math.round(1.3 * fps));
  const skyline = progress(frame, Math.round(4.45 * fps), Math.round(1.8 * fps));
  const complete = paperSpring(frame, Math.round(6.65 * fps), fps, Math.round(0.6 * fps));

  return (
    <SceneReveal color={palette.navy} darkGrain>
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,247,231,.06) 2px, transparent 2px), linear-gradient(90deg, rgba(255,247,231,.06) 2px, transparent 2px)',
            backgroundSize: '54px 54px',
          }}
        />

        <AssemblyPiece
          delay={0.18}
          enterFrom="top"
          shadow="deep"
          style={{
            left: 52,
            top: 38,
            width: 1815,
            height: 980,
            background: '#234F62',
            clipPath: tornClipA,
            rotate: '0.25deg',
            zIndex: 3,
          }}
        >
          <Halftone color={palette.creamBright} opacity={0.09} size={14} />
        </AssemblyPiece>

        <div
          style={{
            position: 'absolute',
            left: 86,
            top: 58,
            width: 830,
            height: 127,
            background: palette.creamBright,
            clipPath: tornClipA,
            zIndex: 38,
          }}
        />
        <SceneNumber number="03" kicker="机制生长" title="让数据路径长成可用系统" />

        <AssemblyPiece
          delay={0.6}
          enterFrom="left"
          style={{
            left: 97,
            top: 225,
            width: 275,
            height: 62,
            background: palette.cream,
            clipPath: tornClipB,
            zIndex: 19,
          }}
        >
          <div style={{position: 'absolute', left: 41, top: 9}}>
            <PaperLabel background={palette.cream} color={palette.ink} rotate={0}>输入</PaperLabel>
          </div>
        </AssemblyPiece>

        <InputToken delay={0.88} top={323} color={palette.brick} symbol="bars" />
        <InputToken delay={1.26} top={529} color={palette.teal} symbol="dot" />
        <InputToken delay={1.64} top={735} color={palette.mustard} symbol="grid" />

        <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, zIndex: 12}}>
          <path
            d="M342 402 C480 402 548 444 705 480 C856 516 1003 514 1160 548 C1326 583 1390 678 1555 702"
            fill="none"
            stroke={palette.creamBright}
            strokeWidth="72"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1650"
            strokeDashoffset={1650 * (1 - road)}
          />
          <path
            d="M342 607 C495 607 550 569 705 536 M342 813 C512 813 548 635 727 586 M1110 547 C1280 450 1397 380 1590 353 M1135 577 C1320 610 1390 560 1652 570"
            fill="none"
            stroke={palette.mustard}
            strokeWidth="35"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1700"
            strokeDashoffset={1700 * (1 - branches)}
          />
          <path
            d="M342 402 C480 402 548 444 705 480 C856 516 1003 514 1160 548 C1326 583 1390 678 1555 702"
            fill="none"
            stroke={palette.brick}
            strokeWidth="8"
            strokeDasharray="19 17"
            strokeDashoffset={120 - road * 120}
            opacity={road}
          />
        </svg>

        <ProcessingGate delay={2.7} />

        <MovingDot start={3.55} duration={1.15} from={[342, 402]} via={[720, 482]} to={[1125, 550]} color={palette.brick} size={23} />
        <MovingDot start={3.9} duration={1.2} from={[342, 607]} via={[710, 538]} to={[1125, 568]} color={palette.teal} size={23} />
        <MovingDot start={4.2} duration={1.3} from={[342, 813]} via={[725, 586]} to={[1160, 582]} color={palette.mustard} size={23} />

        <div
          style={{
            position: 'absolute',
            left: 1225,
            bottom: 187,
            width: 570,
            height: 90,
            background: palette.black,
            clipPath: tornClipA,
            transform: `scaleX(${skyline})`,
            transformOrigin: 'left center',
            opacity: skyline,
            zIndex: 21,
          }}
        />
        <Building delay={4.5} left={1235} bottom={258} width={150} height={245} color={palette.brick} roof="peak" />
        <Building delay={4.82} left={1390} bottom={258} width={175} height={344} color={palette.cream} roof="step" />
        <Building delay={5.14} left={1570} bottom={258} width={185} height={275} color={palette.teal} />
        <Building delay={5.46} left={1715} bottom={258} width={105} height={205} color={palette.mustard} roof="peak" />

        {[1284, 1364, 1510, 1620, 1745].map((left, index) => (
          <AssemblyPiece
            key={left}
            delay={5.25 + index * 0.16}
            enterFrom="bottom"
            shadow="none"
            style={{
              left,
              bottom: 229,
              width: 35,
              height: 74 + (index % 2) * 22,
              background: palette.creamBright,
              clipPath: 'polygon(50% 0, 100% 32%, 76% 100%, 24% 100%, 0 32%)',
              zIndex: 27,
            }}
          />
        ))}

        <div
          style={{
            position: 'absolute',
            right: 112,
            top: 126,
            width: 348,
            height: 116,
            background: palette.brick,
            clipPath: tornClipB,
            opacity: complete,
            transform: `translateY(${interpolate(complete, [0, 1], [-82, 0])}px) rotate(2deg)`,
            zIndex: 42,
            display: 'grid',
            placeItems: 'center',
            color: palette.creamBright,
            fontFamily,
            fontSize: 31,
            fontWeight: 950,
            letterSpacing: 5,
            boxShadow: '0 18px 28px rgba(7,17,22,.34)',
          }}
        >
          路径已长成
        </div>
      </AbsoluteFill>
    </SceneReveal>
  );
};
