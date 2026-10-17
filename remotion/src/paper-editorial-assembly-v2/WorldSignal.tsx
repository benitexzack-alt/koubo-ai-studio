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

const SpeakerCutout: React.FC = () => (
  <div style={{position: 'absolute', inset: 0}}>
    <div
      style={{
        position: 'absolute',
        width: 164,
        height: 164,
        left: 90,
        top: 72,
        borderRadius: '46% 54% 50% 50%',
        background: palette.ink,
        clipPath: 'polygon(15% 18%, 81% 4%, 100% 47%, 76% 95%, 22% 86%, 0 49%)',
      }}
    >
      <Halftone color={palette.creamBright} opacity={0.22} size={10} />
      <div
        style={{
          position: 'absolute',
          width: 58,
          height: 38,
          right: 13,
          top: 67,
          background: palette.creamBright,
          clipPath: 'polygon(0 26%, 100% 0, 100% 72%, 0 100%)',
        }}
      />
    </div>
    <div
      style={{
        position: 'absolute',
        left: 48,
        bottom: 28,
        width: 300,
        height: 78,
        background: palette.brick,
        clipPath: tornClipB,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      {[24, 38, 58, 31, 66, 43, 27, 52, 34].map((height, index) => (
        <div
          key={index}
          style={{
            width: 8,
            height,
            borderRadius: 9,
            background: palette.creamBright,
          }}
        />
      ))}
    </div>
  </div>
);

const taskIcon = (kind: 'frame' | 'evidence' | 'relation'): React.ReactNode => {
  if (kind === 'frame') {
    return (
      <div style={{width: 96, height: 76, position: 'relative'}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: `9px solid ${palette.creamBright}`,
            clipPath: tornClipB,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 28,
            top: 20,
            width: 42,
            height: 34,
            background: palette.mustard,
            clipPath: 'polygon(0 100%, 35% 42%, 57% 69%, 75% 26%, 100% 100%)',
          }}
        />
      </div>
    );
  }

  if (kind === 'evidence') {
    return (
      <div style={{width: 96, height: 82, position: 'relative'}}>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: 11 + index * 13,
              top: 7 + index * 11,
              width: 62,
              height: 55,
              background: index === 2 ? palette.creamBright : palette.mustard,
              border: `5px solid ${palette.creamBright}`,
              transform: `rotate(${(index - 1) * 5}deg)`,
              clipPath: tornClipA,
            }}
          />
        ))}
        <div style={{position: 'absolute', left: 48, top: 34, width: 18, height: 18, borderRadius: '50%', background: palette.brick}} />
      </div>
    );
  }

  return (
    <div style={{width: 100, height: 82, position: 'relative'}}>
      {[
        [16, 18],
        [71, 14],
        [53, 60],
      ].map(([left, top], index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left,
            top,
            width: 25,
            height: 25,
            borderRadius: '50%',
            background: index === 2 ? palette.mustard : palette.creamBright,
            border: `5px solid ${palette.creamBright}`,
          }}
        />
      ))}
      <svg width="100" height="82" style={{position: 'absolute', inset: 0}}>
        <path d="M29 31 L76 27 L64 66 L29 31" fill="none" stroke={palette.creamBright} strokeWidth="7" />
      </svg>
    </div>
  );
};

const TaskCard: React.FC<{
  delay: number;
  top: number;
  label: string;
  kind: 'frame' | 'evidence' | 'relation';
  color: string;
  rotate: number;
}> = ({delay, top, label, kind, color, rotate}) => (
  <AssemblyPiece
    delay={delay}
    enterFrom="right"
    shadow="deep"
    style={{
      left: 1190,
      top,
      width: 520,
      height: 185,
      background: color,
      clipPath: tornClipA,
      transformOrigin: 'left center',
      rotate: `${rotate}deg`,
      zIndex: 18,
    }}
  >
    <Halftone color={palette.ink} opacity={0.12} size={13} />
    <div style={{position: 'absolute', left: 48, top: 52}}>{taskIcon(kind)}</div>
    <div
      style={{
        position: 'absolute',
        left: 186,
        top: 46,
        color: palette.creamBright,
        fontFamily,
        fontWeight: 950,
        fontSize: 43,
        letterSpacing: 6,
      }}
    >
      {label}
    </div>
    <div
      style={{
        position: 'absolute',
        left: 188,
        top: 107,
        display: 'flex',
        gap: 11,
      }}
    >
      {[92, 58, 112].map((width, index) => (
        <div key={index} style={{width, height: 9, background: palette.creamBright, opacity: 0.55}} />
      ))}
    </div>
  </AssemblyPiece>
);

const TaskLock: React.FC<{delay: number; top: number; color: string}> = ({delay, top, color}) => (
  <AssemblyPiece
    delay={delay}
    enterFrom="scale"
    shadow="deep"
    style={{
      left: 1607,
      top,
      width: 70,
      height: 70,
      borderRadius: '50%',
      background: palette.creamBright,
      border: `8px solid ${color}`,
      zIndex: 36,
      display: 'grid',
      placeItems: 'center',
    }}
  >
    <div
      style={{
        width: 31,
        height: 17,
        borderLeft: `8px solid ${color}`,
        borderBottom: `8px solid ${color}`,
        transform: 'translateY(-3px) rotate(-45deg)',
      }}
    />
  </AssemblyPiece>
);

export const WorldSignal: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const thread = drawProgress(frame, Math.round(2.75 * fps), Math.round(1.35 * fps));
  const waveform = progress(frame, Math.round(1.2 * fps), Math.round(1.15 * fps));
  const splitPress = paperSpring(frame, Math.round(2.35 * fps), fps, Math.round(0.46 * fps));
  const completion = paperSpring(frame, Math.round(6.52 * fps), fps, Math.round(0.56 * fps));

  return (
    <SceneReveal color={palette.cream}>
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 680,
            height: 1080,
            background: palette.navy,
            clipPath: 'polygon(0 0, 88% 0, 96% 16%, 89% 31%, 97% 47%, 90% 63%, 97% 80%, 89% 100%, 0 100%)',
          }}
        >
          <Halftone color={palette.creamBright} opacity={0.12} size={15} />
        </div>

        <AssemblyPiece
          delay={0.36}
          enterFrom="top"
          style={{
            left: 435,
            top: -16,
            width: 720,
            height: 128,
            background: palette.brick,
            clipPath: tornClipA,
            rotate: '-2deg',
            zIndex: 8,
          }}
        />

        <SceneNumber number="01" kicker="信号拆解" title="一句话，变成三项视觉任务" inverse />

        <AssemblyPiece
          delay={0.68}
          enterFrom="left"
          shadow="deep"
          style={{
            left: 118,
            top: 255,
            width: 395,
            height: 430,
            background: palette.creamBright,
            clipPath: tornClipA,
            rotate: '-1.8deg',
            zIndex: 15,
          }}
        >
          <SpeakerCutout />
        </AssemblyPiece>

        <AssemblyPiece
          delay={1.0}
          enterFrom="bottom"
          style={{
            left: 82,
            top: 744,
            width: 520,
            height: 154,
            background: palette.mustard,
            clipPath: tornClipB,
            rotate: '1.5deg',
            zIndex: 12,
          }}
        >
          <div style={{position: 'absolute', left: 46, top: 50}}>
            <PaperLabel background={palette.ink} color={palette.creamBright} rotate={-2}>
              原始语义信号
            </PaperLabel>
          </div>
        </AssemblyPiece>

        <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, zIndex: 10}}>
          <path
            d="M465 477 C610 425 705 468 805 493"
            fill="none"
            stroke={palette.brick}
            strokeWidth="28"
            strokeLinecap="round"
            strokeDasharray="430"
            strokeDashoffset={430 * (1 - waveform)}
          />
          <path
            d="M830 493 C1005 420 1004 230 1200 240 M830 493 C1005 493 1020 492 1200 492 M830 493 C1010 555 1020 760 1200 748"
            fill="none"
            stroke={palette.ink}
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="900"
            strokeDashoffset={900 * (1 - thread)}
          />
          {[240, 492, 748].map((cy) => (
            <circle key={cy} cx="1200" cy={cy} r="15" fill={palette.brick} opacity={thread} />
          ))}
        </svg>

        <AssemblyPiece
          delay={2.18}
          enterFrom="scale"
          shadow="deep"
          style={{
            left: 740,
            top: 400,
            width: 188,
            height: 188,
            borderRadius: '50%',
            background: palette.creamBright,
            border: `13px solid ${palette.ink}`,
            zIndex: 20,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 28,
              top: 30,
              width: 106,
              height: 106,
              borderRadius: '50%',
              background: palette.brick,
              transform: `scale(${0.75 + splitPress * 0.25})`,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div style={{fontFamily, color: palette.creamBright, fontSize: 58, fontWeight: 950}}>×3</div>
          </div>
        </AssemblyPiece>

        <TaskCard delay={3.35} top={148} label="镜头" kind="frame" color={palette.navy} rotate={-1.5} />
        <TaskCard delay={4.02} top={395} label="证据" kind="evidence" color={palette.teal} rotate={1.2} />
        <TaskCard delay={4.69} top={640} label="关系" kind="relation" color={palette.brickDark} rotate={-0.8} />

        <MovingDot start={5.25} duration={0.84} from={[830, 493]} via={[1008, 420]} to={[1200, 240]} />
        <MovingDot start={5.52} duration={0.82} from={[830, 493]} via={[1015, 493]} to={[1200, 492]} color={palette.mustard} />
        <MovingDot start={5.8} duration={0.86} from={[830, 493]} via={[1015, 565]} to={[1200, 748]} />
        <TaskLock delay={5.45} top={207} color={palette.navy} />
        <TaskLock delay={5.92} top={454} color={palette.teal} />
        <TaskLock delay={6.34} top={699} color={palette.brickDark} />

        <div
          style={{
            position: 'absolute',
            left: 968,
            bottom: 73,
            zIndex: 35,
            opacity: completion,
            transform: `translateY(${interpolate(completion, [0, 1], [36, 0])}px) rotate(-2deg)`,
          }}
        >
          <PaperLabel background={palette.creamBright} color={palette.ink} rotate={-1}>
            同一句话 · 三种认知增量
          </PaperLabel>
        </div>
      </AbsoluteFill>
    </SceneReveal>
  );
};
