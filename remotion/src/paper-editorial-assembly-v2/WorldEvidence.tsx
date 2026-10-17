import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  AssemblyPiece,
  Halftone,
  PaperLabel,
  SceneNumber,
  SceneReveal,
  tornClipA,
  tornClipB,
} from './PaperPrimitives';
import {drawProgress, paperSpring, progress} from './motion';
import {fontFamily, palette} from './palette';

const AbstractDocument: React.FC<{
  delay: number;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number;
  color?: string;
  photo?: boolean;
}> = ({delay, left, top, width, height, rotate, color = palette.creamBright, photo = false}) => (
  <AssemblyPiece
    delay={delay}
    enterFrom={left < 800 ? 'left' : 'right'}
    shadow="deep"
    style={{
      left,
      top,
      width,
      height,
      rotate: `${rotate}deg`,
      background: color,
      clipPath: tornClipA,
      zIndex: 16,
    }}
  >
    <Halftone color={palette.ink} opacity={0.08} size={12} />
    {photo ? (
      <>
        <div
          style={{
            position: 'absolute',
            left: 28,
            top: 28,
            width: width - 56,
            height: Math.round(height * 0.55),
            background: palette.navy,
            clipPath: tornClipB,
          }}
        >
          <Halftone color={palette.creamBright} opacity={0.32} size={9} />
          <div
            style={{
              position: 'absolute',
              left: '18%',
              bottom: 0,
              width: '64%',
              height: '66%',
              background: palette.cream,
              clipPath: 'polygon(0 100%, 18% 51%, 35% 70%, 55% 22%, 74% 66%, 100% 42%, 100% 100%)',
            }}
          />
        </div>
        <div style={{position: 'absolute', left: 31, bottom: 34, display: 'flex', gap: 11}}>
          {[0.8, 0.45, 0.65].map((scale, index) => (
            <div key={index} style={{width: (width - 85) * scale, maxWidth: 124, height: 10, background: palette.ink, opacity: 0.5}} />
          ))}
        </div>
      </>
    ) : (
      <>
        <div
          style={{
            position: 'absolute',
            left: 30,
            top: 30,
            width: Math.min(width - 60, 150),
            height: 25,
            background: palette.brick,
          }}
        />
        <div style={{position: 'absolute', left: 30, right: 30, top: 84, display: 'grid', gap: 18}}>
          {[0.93, 0.72, 0.86, 0.56, 0.78].map((scale, index) => (
            <div key={index} style={{width: `${scale * 100}%`, height: 11, background: palette.ink, opacity: 0.43}} />
          ))}
        </div>
      </>
    )}
  </AssemblyPiece>
);

const Pin: React.FC<{x: number; y: number; delay: number; color?: string}> = ({
  x,
  y,
  delay,
  color = palette.brick,
}) => (
  <AssemblyPiece
    delay={delay}
    enterFrom="scale"
    shadow="none"
    style={{
      left: x - 17,
      top: y - 17,
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: color,
      border: `7px solid ${palette.creamBright}`,
      zIndex: 32,
      filter: 'drop-shadow(0 6px 5px rgba(0,0,0,.25))',
    }}
  />
);

export const WorldEvidence: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const routeA = drawProgress(frame, Math.round(3.05 * fps), Math.round(1.15 * fps));
  const routeB = drawProgress(frame, Math.round(3.65 * fps), Math.round(1.25 * fps));
  const routeC = drawProgress(frame, Math.round(4.3 * fps), Math.round(1.15 * fps));
  const timeline = progress(frame, Math.round(5.0 * fps), Math.round(1.05 * fps));
  const stamp = paperSpring(frame, Math.round(6.15 * fps), fps, Math.round(0.55 * fps));

  return (
    <SceneReveal color={palette.black} darkGrain>
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(118deg, rgba(255,247,231,.025) 0 1px, transparent 1px 76px), linear-gradient(28deg, rgba(255,247,231,.02) 0 1px, transparent 1px 92px)',
          }}
        />

        <AssemblyPiece
          delay={0.18}
          enterFrom="top"
          shadow="deep"
          style={{
            left: 76,
            top: 48,
            width: 1765,
            height: 960,
            background: '#D5C6A6',
            clipPath: tornClipA,
            rotate: '-0.3deg',
            zIndex: 4,
          }}
        >
          <Halftone color={palette.ink} opacity={0.08} size={14} />
        </AssemblyPiece>

        <div
          style={{
            position: 'absolute',
            left: 94,
            top: 64,
            width: 730,
            height: 128,
            background: palette.ink,
            clipPath: tornClipB,
            zIndex: 35,
          }}
        />
        <SceneNumber number="02" kicker="证据关系" title="先连来源，再下结论" inverse />

        <AbstractDocument delay={0.82} left={145} top={246} width={350} height={274} rotate={-3.2} photo />
        <AbstractDocument delay={1.12} left={220} top={570} width={430} height={286} rotate={2.1} />
        <AbstractDocument delay={1.45} left={1320} top={213} width={390} height={266} rotate={2.6} />
        <AbstractDocument delay={1.78} left={1270} top={558} width={440} height={294} rotate={-2.1} photo color="#E8D8B9" />

        <AssemblyPiece
          delay={2.15}
          enterFrom="scale"
          shadow="deep"
          style={{
            left: 725,
            top: 292,
            width: 480,
            height: 400,
            background: palette.navy,
            clipPath: tornClipB,
            rotate: '0.8deg',
            zIndex: 20,
          }}
        >
          <Halftone color={palette.creamBright} opacity={0.18} size={10} />
          <div
            style={{
              position: 'absolute',
              left: 118,
              top: 72,
              width: 230,
              height: 230,
              background: palette.brick,
              clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 18px 0 rgba(13,31,39,.3)',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                border: `17px solid ${palette.creamBright}`,
              }}
            />
          </div>
          <div style={{position: 'absolute', left: 126, bottom: 37}}>
            <PaperLabel background={palette.creamBright} color={palette.ink} rotate={-1}>
              待证命题
            </PaperLabel>
          </div>
        </AssemblyPiece>

        <AssemblyPiece
          delay={2.48}
          enterFrom="bottom"
          shadow="soft"
          style={{
            left: 570,
            top: 710,
            width: 405,
            height: 210,
            background: palette.teal,
            clipPath: tornClipA,
            rotate: '-2.5deg',
            zIndex: 13,
          }}
        >
          <svg width="405" height="210" viewBox="0 0 405 210">
            <path
              d="M21 116 C74 53 128 63 175 29 C222 2 256 63 293 49 C344 30 375 74 384 121 C350 170 306 189 257 170 C216 207 154 186 124 166 C74 181 37 158 21 116Z"
              fill={palette.creamBright}
            />
            <path d="M70 116 C140 86 181 118 235 92 C278 73 314 92 348 132" fill="none" stroke={palette.brick} strokeWidth="10" strokeDasharray="16 12" />
            {[95, 203, 326].map((cx, index) => (
              <circle key={cx} cx={cx} cy={[104, 101, 127][index]} r="13" fill={palette.navy} />
            ))}
          </svg>
        </AssemblyPiece>

        <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, zIndex: 26}}>
          <path
            d="M430 365 C590 337 700 386 830 420"
            fill="none"
            stroke={palette.brick}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="560"
            strokeDashoffset={560 * (1 - routeA)}
          />
          <path
            d="M1490 340 C1340 420 1270 488 1116 500 M445 692 C600 665 724 605 830 542"
            fill="none"
            stroke={palette.brick}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="720"
            strokeDashoffset={720 * (1 - routeB)}
          />
          <path
            d="M1490 670 C1337 643 1251 602 1110 560 M780 822 C822 740 868 672 910 635"
            fill="none"
            stroke={palette.brick}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="660"
            strokeDashoffset={660 * (1 - routeC)}
          />
        </svg>

        <Pin x={430} y={365} delay={3.0} />
        <Pin x={830} y={420} delay={3.5} />
        <Pin x={1490} y={340} delay={3.6} />
        <Pin x={1116} y={500} delay={4.0} />
        <Pin x={445} y={692} delay={4.0} />
        <Pin x={910} y={635} delay={4.8} color={palette.mustard} />
        <Pin x={1490} y={670} delay={4.4} />

        <div
          style={{
            position: 'absolute',
            left: 130,
            right: 130,
            bottom: 84,
            height: 58,
            zIndex: 30,
            opacity: timeline,
            transform: `scaleX(${timeline})`,
            transformOrigin: 'left center',
            background: palette.ink,
            clipPath: tornClipB,
          }}
        >
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: `${8 + index * 14}%`,
                top: index % 2 === 0 ? 6 : 18,
                width: 7,
                height: index % 2 === 0 ? 39 : 27,
                background: index === 6 ? palette.mustard : palette.creamBright,
              }}
            />
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            right: 105,
            top: 73,
            width: 310,
            height: 148,
            border: `13px solid ${palette.brick}`,
            color: palette.brick,
            fontFamily,
            fontSize: 31,
            fontWeight: 950,
            letterSpacing: 7,
            display: 'grid',
            placeItems: 'center',
            opacity: stamp,
            transform: `translateY(${interpolate(stamp, [0, 1], [-90, 0])}px) rotate(-7deg) scale(${0.78 + stamp * 0.22})`,
            zIndex: 40,
            clipPath: tornClipB,
          }}
        >
          关系已闭合
        </div>
      </AbsoluteFill>
    </SceneReveal>
  );
};
