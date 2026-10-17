import React from 'react';
import {Audio, Video} from '@remotion/media';
import {
  AbsoluteFill,
  Easing,
  Freeze,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {BOUNDARIES, CAPTION_CUES, FPS, SCREEN_CLIPS, SPOKEN_SOURCE_IN_SECONDS} from './timeline';
import mediaContract from './candidate-media-contract.json';

const FONT = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';
const PAPER = '#e9dfca';
const PAPER_LIGHT = '#faf3e4';
const INK = '#28231c';
const MUTED_INK = '#655b4e';
const RED = '#a94131';
const BLUE = '#356a78';
const GOLD = '#c78a2e';
const GREEN = '#496d51';
const MAIN_MEDIA = mediaContract.spokenMedia.staticFileName;
const SCREEN_MEDIA = mediaContract.screenMedia.staticFileName;

const frameAt = (seconds: number) => Math.round(seconds * FPS);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const enterAt = (frame: number, at: number, duration = 18) =>
  interpolate(frame, [at, at + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

type ScreenClip = {
  sourceIn: number;
  sourceOut: number;
  representativeTime: number;
  semanticClaim: string;
  outputInFrame: number;
  outputOutFrame: number;
};

const PaperWorld: React.FC<{tone?: string}> = ({tone = GOLD}) => (
  <AbsoluteFill
    style={{
      backgroundColor: PAPER,
      backgroundImage:
        'radial-gradient(circle at 18% 23%, rgba(255,255,255,.74) 0 1px, transparent 2px), radial-gradient(circle at 72% 63%, rgba(60,43,23,.12) 0 1px, transparent 2px), repeating-linear-gradient(7deg, rgba(86,62,35,.035) 0 1px, transparent 1px 8px)',
      backgroundSize: '37px 39px, 29px 31px, 100% 100%',
      overflow: 'hidden',
      fontFamily: FONT,
      color: INK,
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: 78,
        right: 78,
        top: 42,
        height: 870,
        background: 'linear-gradient(154deg, rgba(255,252,243,.76), rgba(219,204,177,.62))',
        boxShadow: 'inset 0 0 0 2px rgba(70,51,29,.08), 0 28px 55px rgba(52,37,22,.14)',
        clipPath:
          'polygon(0 1%, 2% 0, 7% 1%, 14% 0, 22% 1%, 31% 0, 43% 1%, 55% 0, 66% 1%, 76% 0, 88% 1%, 100% 0, 99% 98%, 93% 100%, 82% 99%, 73% 100%, 63% 99%, 50% 100%, 39% 99%, 28% 100%, 16% 99%, 6% 100%, 0 98%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 260,
        background: `linear-gradient(178deg, ${tone}22, rgba(84,63,39,.18))`,
        clipPath: 'polygon(0 22%, 18% 12%, 41% 19%, 63% 8%, 82% 17%, 100% 9%, 100% 100%, 0 100%)',
        filter: 'drop-shadow(0 -13px 15px rgba(47,34,21,.15))',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 124,
        top: 86,
        width: 360,
        height: 38,
        background: `${tone}45`,
        transform: 'rotate(-2deg)',
        boxShadow: '0 8px 12px rgba(48,34,20,.12)',
      }}
    />
  </AbsoluteFill>
);

const PaperLabel: React.FC<{children: React.ReactNode; tone?: string; small?: boolean}> = ({
  children,
  tone = RED,
  small = false,
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: small ? '8px 14px' : '11px 20px',
      background: tone,
      color: '#fff9ec',
      fontFamily: FONT,
      fontSize: small ? 20 : 25,
      lineHeight: 1,
      fontWeight: 800,
      letterSpacing: 1,
      clipPath:
        'polygon(0 5%, 4% 0, 13% 4%, 27% 0, 45% 4%, 62% 0, 78% 4%, 94% 0, 100% 8%, 98% 92%, 89% 100%, 74% 96%, 58% 100%, 40% 96%, 23% 100%, 7% 95%, 0 100%)',
      boxShadow: '0 7px 0 rgba(54,40,24,.2), 0 15px 24px rgba(45,32,19,.18)',
    }}
  >
    {children}
  </div>
);

const ThickPaper: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  color?: string;
  depth?: number;
  torn?: boolean;
}> = ({children, style, color = PAPER_LIGHT, depth = 12, torn = true}) => (
  <div
    style={{
      position: 'absolute',
      boxSizing: 'border-box',
      backgroundColor: color,
      backgroundImage:
        'linear-gradient(112deg, transparent 0 46%, rgba(90,65,36,.075) 47%, transparent 49%), repeating-linear-gradient(4deg, rgba(85,62,35,.025) 0 1px, transparent 1px 7px)',
      border: '2px solid rgba(70,51,29,.14)',
      boxShadow: `0 ${depth}px 0 rgba(184,168,137,.95), 0 ${depth + 7}px 0 rgba(106,83,53,.14), 0 ${depth + 18}px 28px rgba(48,34,20,.24)`,
      clipPath: torn
        ? 'polygon(0 2%, 4% 0, 9% 2%, 15% 0, 23% 2%, 31% 0, 42% 2%, 52% 0, 63% 2%, 74% 0, 84% 2%, 94% 0, 100% 3%, 99% 96%, 95% 100%, 87% 97%, 77% 100%, 67% 97%, 55% 100%, 43% 97%, 31% 100%, 20% 97%, 9% 100%, 0 97%)'
        : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);

const PhoneFrame: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div
    style={{
      position: 'absolute',
      width: 430,
      height: 930,
      padding: 13,
      borderRadius: 42,
      background: '#171613',
      boxShadow: '0 13px 0 #090806, 0 34px 54px rgba(38,27,16,.42)',
      boxSizing: 'border-box',
      ...style,
    }}
  >
    <div
      style={{
        position: 'absolute',
        zIndex: 3,
        left: '50%',
        top: 10,
        width: 105,
        height: 20,
        borderRadius: 18,
        transform: 'translateX(-50%)',
        background: '#070706',
      }}
    />
    {children}
  </div>
);

const screenPlaybackRate = (clip: ScreenClip) =>
  (clip.sourceOut - clip.sourceIn) / ((clip.outputOutFrame - clip.outputInFrame) / FPS);

const ScreenPlayback: React.FC<{clip: ScreenClip; style?: React.CSSProperties}> = ({clip, style}) => {
  const {fps} = useVideoConfig();
  return (
    <Video
      src={staticFile(SCREEN_MEDIA)}
      muted
      objectFit="contain"
      playbackRate={screenPlaybackRate(clip)}
      trimBefore={Math.round(clip.sourceIn * fps)}
      trimAfter={Math.round(clip.sourceOut * fps)}
      style={{width: '100%', height: '100%', background: '#000', borderRadius: 28, ...style}}
    />
  );
};

const ScreenZoom: React.FC<{clip: ScreenClip; objectPosition: string}> = ({clip, objectPosition}) => {
  const {fps} = useVideoConfig();
  return (
    <Video
      src={staticFile(SCREEN_MEDIA)}
      muted
      objectFit="cover"
      playbackRate={screenPlaybackRate(clip)}
      trimBefore={Math.round(clip.sourceIn * fps)}
      trimAfter={Math.round(clip.sourceOut * fps)}
      style={{width: '100%', height: '100%', background: '#000', objectPosition}}
    />
  );
};

type ConditionTagGeometry = {
  id: string;
  text: string;
  x: number;
  y: number;
  at: number;
  rotation: number;
  tone: string;
};

const CONDITION_TAG_GEOMETRY: readonly ConditionTagGeometry[] = [
  {id: 'condition-lanzhou', text: '兰州中心', x: 116, y: 686, at: 102, rotation: -2.6, tone: RED},
  {id: 'condition-people', text: '4 人', x: 408, y: 710, at: 148, rotation: 1.8, tone: BLUE},
  {id: 'condition-light', text: '不辣 · 清淡', x: 670, y: 682, at: 190, rotation: -1.4, tone: GOLD},
  {id: 'condition-diet', text: '减肥期', x: 982, y: 712, at: 245, rotation: 2.2, tone: GREEN},
] as const;

const ConditionTagCard: React.FC<{
  tag: ConditionTagGeometry;
  opacity: number;
  transform: string;
}> = ({tag, opacity, transform}) => (
  <ThickPaper
    depth={9}
    style={{
      left: tag.x,
      top: tag.y,
      minWidth: 220,
      padding: '22px 30px',
      transform,
      opacity,
      zIndex: 13,
    }}
  >
    <div style={{height: 11, width: 68, background: tag.tone, marginBottom: 15}} />
    <div style={{fontSize: 38, fontWeight: 900, whiteSpace: 'nowrap'}}>{tag.text}</div>
  </ThickPaper>
);

const AnimatedConditionTag: React.FC<{tag: ConditionTagGeometry}> = ({tag}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = frame >= 318 ? 1 : spring({frame: frame - tag.at, fps, config: {damping: 18, stiffness: 145}});
  return (
    <ConditionTagCard
      tag={tag}
      opacity={progress}
      transform={`translate3d(${(1 - progress) * 260}px, ${(1 - progress) * -120}px, 0) rotate(${tag.rotation * progress}deg) scale(${0.72 + progress * 0.28})`}
    />
  );
};

const QueryConditionsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const phoneEnter = enterAt(frame, 0, 16);
  const zoomEnter = enterAt(frame, 18, 18);
  const clip = SCREEN_CLIPS.query;
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: INK}}>
      <PaperWorld tone={BLUE} />
      <div style={{position: 'absolute', left: 116, top: 82, zIndex: 9}}>
        <PaperLabel tone={BLUE}>我问它：</PaperLabel>
      </div>
      <ThickPaper
        depth={15}
        style={{
          left: 110,
          top: 190,
          width: 1000,
          height: 396,
          padding: '28px 32px',
          opacity: zoomEnter,
          transform: `translateY(${(1 - zoomEnter) * 42}px) rotate(-1.2deg)`,
          overflow: 'hidden',
          zIndex: 4,
        }}
      >
        <div style={{fontSize: 22, color: MUTED_INK, marginBottom: 15, fontWeight: 700}}>
          这句话里，有四个条件
        </div>
        <div style={{height: 295, overflow: 'hidden', border: '10px solid #d4c5a8'}}>
          <ScreenZoom clip={clip} objectPosition="50% 42%" />
        </div>
      </ThickPaper>
      <PhoneFrame
        style={{
          right: 118,
          top: 32,
          opacity: phoneEnter,
          transform: `translateX(${(1 - phoneEnter) * 54}px) rotate(.7deg)`,
          zIndex: 7,
        }}
      >
        <ScreenPlayback clip={clip} />
      </PhoneFrame>
      <div
        style={{
          position: 'absolute',
          left: 115,
          top: 622,
          fontSize: 24,
          color: MUTED_INK,
          fontWeight: 700,
          letterSpacing: 1,
          zIndex: 6,
        }}
      >
        把需求一项一项拆开
      </div>
      {CONDITION_TAG_GEOMETRY.map((tag) => <AnimatedConditionTag key={tag.id} tag={tag} />)}
    </AbsoluteFill>
  );
};

const PersonRail: React.FC<{index: number; x: number}> = ({index, x}) => (
  <div style={{position: 'absolute', left: x, top: 244, width: 360, height: 590}}>
    <div
      style={{
        position: 'absolute',
        left: 130,
        top: 0,
        width: 82,
        height: 82,
        borderRadius: '50%',
        background: '#d8c8aa',
        border: '8px solid #f7efdf',
        boxShadow: '0 7px 0 #b5a382, 0 14px 20px rgba(48,34,20,.18)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 88,
        top: 79,
        width: 170,
        height: 105,
        borderRadius: '80px 80px 12px 12px',
        background: '#efe4ce',
        border: '2px solid rgba(70,51,29,.14)',
        boxShadow: '0 8px 0 #c5b492, 0 16px 24px rgba(48,34,20,.16)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 31,
        top: 218,
        width: 292,
        height: 332,
        border: '6px dashed rgba(73,58,39,.28)',
        borderRadius: 18,
        boxSizing: 'border-box',
        background: 'rgba(255,252,242,.24)',
      }}
    >
      <div style={{paddingTop: 112, textAlign: 'center', color: '#8d806d', fontSize: 26}}>
        空轨位 {index}
      </div>
    </div>
  </div>
);

const FilmObject: React.FC = () => (
  <div
    style={{
      width: 270,
      height: 176,
      background: '#29251f',
      border: '12px solid #16130f',
      boxShadow: '0 10px 0 #080706, 0 20px 28px rgba(42,30,18,.3)',
      transform: 'rotate(-3deg)',
      position: 'relative',
    }}
  >
    {[18, 69, 120, 171, 222].map((left) => (
      <React.Fragment key={left}>
        <div style={{position: 'absolute', left, top: -8, width: 24, height: 15, background: PAPER}} />
        <div style={{position: 'absolute', left, bottom: -8, width: 24, height: 15, background: PAPER}} />
      </React.Fragment>
    ))}
    <div
      style={{
        position: 'absolute',
        inset: '26px 28px',
        background: RED,
        color: '#fff7e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 29,
        fontWeight: 900,
      }}
    >
      刷短视频
    </div>
  </div>
);

const CommentObject: React.FC = () => (
  <div style={{position: 'relative', width: 280, height: 190}}>
    <ThickPaper style={{inset: 0, padding: '33px 28px'}} depth={9}>
      <div style={{fontSize: 33, fontWeight: 900}}>翻评论</div>
      <div style={{marginTop: 20, height: 10, width: 145, background: '#b7a88b'}} />
      <div style={{marginTop: 14, height: 10, width: 190, background: '#d1c3a7'}} />
    </ThickPaper>
    <div
      style={{
        position: 'absolute',
        right: -26,
        bottom: -24,
        width: 92,
        height: 92,
        border: `13px solid ${BLUE}`,
        borderRadius: '50%',
        boxShadow: '0 8px 12px rgba(40,29,17,.23)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        right: -55,
        bottom: -55,
        width: 72,
        height: 15,
        background: BLUE,
        transform: 'rotate(46deg)',
        transformOrigin: 'left center',
      }}
    />
  </div>
);

const MapObject: React.FC = () => (
  <div
    style={{
      position: 'relative',
      width: 286,
      height: 190,
      filter: 'drop-shadow(0 18px 16px rgba(44,31,18,.24))',
      transform: 'rotate(2deg)',
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#d9e0c5',
        clipPath: 'polygon(0 9%, 31% 0, 65% 9%, 100% 0, 96% 92%, 67% 100%, 33% 91%, 3% 100%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '33%',
        top: 0,
        bottom: 0,
        width: 3,
        background: 'rgba(74,64,43,.23)',
        transform: 'rotate(-3deg)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '66%',
        top: 0,
        bottom: 0,
        width: 3,
        background: 'rgba(74,64,43,.23)',
        transform: 'rotate(3deg)',
      }}
    />
    <svg width="286" height="190" style={{position: 'absolute', inset: 0}}>
      <path
        d="M18 144 C62 72, 107 135, 151 70 S235 118, 274 38"
        fill="none"
        stroke={BLUE}
        strokeWidth="11"
        strokeDasharray="18 9"
      />
    </svg>
    <div
      style={{
        position: 'absolute',
        left: 170,
        top: 40,
        width: 43,
        height: 43,
        borderRadius: '50% 50% 50% 0',
        background: RED,
        transform: 'rotate(-45deg)',
        boxShadow: '5px 7px 8px rgba(40,27,17,.25)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 13,
          top: 13,
          width: 17,
          height: 17,
          borderRadius: '50%',
          background: '#fff1dd',
        }}
      />
    </div>
    <div style={{position: 'absolute', left: 25, top: 18, fontWeight: 900, fontSize: 27}}>打开地图</div>
  </div>
);

const FriendObject: React.FC = () => (
  <div
    style={{
      position: 'relative',
      width: 280,
      height: 184,
      background: '#d8eadf',
      borderRadius: '68px 68px 68px 18px',
      border: '2px solid rgba(55,84,63,.25)',
      boxShadow: '0 10px 0 #a8c6b1, 0 21px 28px rgba(40,30,18,.23)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 34,
      fontWeight: 900,
      transform: 'rotate(2deg)',
    }}
  >
    问朋友
    <div
      style={{
        position: 'absolute',
        left: 8,
        bottom: -31,
        width: 66,
        height: 55,
        background: '#a8c6b1',
        clipPath: 'polygon(0 0, 100% 0, 0 100%)',
      }}
    />
  </div>
);

type ActionObjectId = 'film' | 'comments' | 'map' | 'friend';
type ActionObjectGeometry = {id: ActionObjectId; x: number; y: number};
const ACTION_OBJECT_GEOMETRY: readonly ActionObjectGeometry[] = [
  {id: 'film', x: 152, y: 514},
  {id: 'comments', x: 577, y: 505},
  {id: 'map', x: 998, y: 510},
  {id: 'friend', x: 1422, y: 510},
] as const;

const ActionObject: React.FC<{id: ActionObjectId}> = ({id}) => {
  if (id === 'film') return <FilmObject />;
  if (id === 'comments') return <CommentObject />;
  if (id === 'map') return <MapObject />;
  return <FriendObject />;
};

const ActionOnRail: React.FC<{at: number; geometry: ActionObjectGeometry}> = ({
  at,
  geometry,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = frame >= 347 ? 1 : spring({frame: frame - at, fps, config: {damping: 16, stiffness: 150}});
  return (
    <div
      style={{
        position: 'absolute',
        left: geometry.x,
        top: geometry.y,
        zIndex: 9,
        opacity: progress,
        transform: `translate3d(0, ${(1 - progress) * -165}px, 0) rotateX(${(1 - progress) * 58}deg) scale(${0.74 + progress * 0.26})`,
        transformOrigin: 'bottom center',
      }}
    >
      <ActionObject id={geometry.id} />
    </div>
  );
};

const SearchWorkbenchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const tray = enterAt(frame, 0, 24);
  const conditionTrayOpacity = interpolate(frame, [0, 142, 161], [1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const localActionTimes = {
    video: frameAt(15.99 - 10.64),
    comments: frameAt(17.5 - 10.64),
    map: frameAt(19 - 10.64),
    friend: frameAt(21 - 10.64),
  };
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: INK, perspective: 1400}}>
      <PaperWorld tone={RED} />
      <div style={{position: 'absolute', left: 116, top: 78, zIndex: 10}}>
        <PaperLabel tone={RED}>以前：四个人分工</PaperLabel>
      </div>
      <div style={{position: 'absolute', left: 116, top: 137, fontSize: 47, fontWeight: 900, zIndex: 10}}>
        先给每个人留一个位置
      </div>
      {CONDITION_TAG_GEOMETRY.map((tag, index) => {
        const handoff = enterAt(frame, 1, 24);
        const targetX = 760 + index * 245;
        const targetY = 82 + (index % 2) * 10;
        return (
          <ConditionTagCard
            key={tag.id}
            tag={tag}
            opacity={conditionTrayOpacity}
            transform={`translate3d(${(targetX - tag.x) * handoff}px, ${(targetY - tag.y) * handoff}px, 0) rotate(${tag.rotation * (1 - handoff) + [-2, 1.2, -1, 1.8][index] * handoff}deg) scale(${1 - handoff * 0.35})`}
          />
        );
      })}
      <ThickPaper
        torn={false}
        depth={18}
        style={{
          left: 88,
          top: 214,
          width: 1744,
          height: 700,
          opacity: tray,
          transform: `rotateX(${12 - tray * 7}deg) translateY(${(1 - tray) * 70}px)`,
          transformOrigin: 'bottom center',
          backgroundColor: '#e4d5b9',
        }}
      >
        <div style={{position: 'absolute', left: 44, right: 44, top: 42, height: 7, background: 'rgba(92,67,38,.22)'}} />
        <div style={{position: 'absolute', left: 44, right: 44, bottom: 42, height: 7, background: 'rgba(92,67,38,.18)'}} />
      </ThickPaper>
      {[110, 534, 958, 1382].map((x, index) => (
        <PersonRail key={x} index={index + 1} x={x} />
      ))}
      {ACTION_OBJECT_GEOMETRY.map((geometry) => (
        <ActionOnRail key={geometry.id} at={localActionTimes[geometry.id === 'film' ? 'video' : geometry.id]} geometry={geometry} />
      ))}
    </AbsoluteFill>
  );
};

const Pin: React.FC<{x: number; y: number; scale?: number}> = ({x, y, scale = 1}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 72,
      height: 72,
      borderRadius: '50% 50% 50% 0',
      background: RED,
      transform: `rotate(-45deg) scale(${scale})`,
      boxShadow: '11px 14px 18px rgba(45,31,18,.28)',
      zIndex: 14,
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: 22,
        top: 22,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: '#fff4df',
      }}
    />
  </div>
);

const ProofLayout: React.FC<{
  clip: ScreenClip;
  badge: string;
  title: string;
  note: string;
  zoomPosition: string;
  tone: string;
  showPin?: boolean;
  children?: React.ReactNode;
}> = ({clip, badge, title, note, zoomPosition, tone, showPin = false, children}) => {
  const frame = useCurrentFrame();
  const phone = enterAt(frame, 0, 14);
  const print = enterAt(frame, 8, 18);
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: INK}}>
      <PaperWorld tone={tone} />
      <PhoneFrame
        style={{
          left: 116,
          top: 37,
          width: 440,
          height: 950,
          opacity: phone,
          transform: `translateX(${(1 - phone) * -48}px) rotate(-.7deg)`,
          zIndex: 9,
        }}
      >
        <ScreenPlayback clip={clip} />
      </PhoneFrame>
      <div style={{position: 'absolute', left: 638, top: 78, zIndex: 10}}>
        <PaperLabel tone={tone}>{badge}</PaperLabel>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 638,
          top: 138,
          width: 1110,
          fontSize: 55,
          fontWeight: 900,
          lineHeight: 1.13,
          zIndex: 10,
        }}
      >
        {title}
      </div>
      <ThickPaper
        depth={16}
        style={{
          left: 638,
          top: 268,
          width: 1110,
          height: 474,
          padding: '25px 28px',
          opacity: print,
          transform: `translateY(${(1 - print) * 46}px) rotate(.8deg)`,
          overflow: 'hidden',
          zIndex: 7,
        }}
      >
        <div style={{height: 345, overflow: 'hidden', border: '12px solid #d1c1a3', background: '#000'}}>
          <ScreenZoom clip={clip} objectPosition={zoomPosition} />
        </div>
        <div style={{fontSize: 20, marginTop: 13, color: MUTED_INK, fontWeight: 700}}>与左侧当时的完整界面对照</div>
      </ThickPaper>
      <ThickPaper
        depth={8}
        style={{
          left: 706,
          top: 776,
          width: 960,
          minHeight: 104,
          padding: '23px 30px',
          fontSize: 27,
          lineHeight: 1.42,
          zIndex: 8,
        }}
      >
        {note}
      </ThickPaper>
      <div
        style={{
          position: 'absolute',
          left: 638,
          top: 220,
          width: 1110,
          boxSizing: 'border-box',
          padding: '8px 14px',
          background: 'rgba(250,243,228,.94)',
          boxShadow: '0 5px 0 rgba(106,83,53,.12)',
          color: '#6d4d30',
          fontSize: 24,
          fontWeight: 800,
          zIndex: 11,
        }}
      >
        录屏当时画面；价格、评分、营业状态以当时页面为准，非现时推荐
      </div>
      {showPin ? <Pin x={1533} y={484} scale={0.9} /> : null}
      {children}
    </AbsoluteFill>
  );
};

const AnswerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const converge = enterAt(frame, 1, 14);
  return (
    <ProofLayout
      clip={SCREEN_CLIPS.answerRecommendations}
      badge="真实回答 / 推荐卡"
      title="先看到几个方向"
      note="这里只证明回答卡与地图推荐在当时画面中可见。"
      zoomPosition="50% 43%"
      tone={BLUE}
      showPin
    >
      {ACTION_OBJECT_GEOMETRY.map((item) => (
        <div
          key={item.id}
          style={{
            position: 'absolute',
            left: 960 + (item.x - 960) * (1 - converge),
            top: 520 + (item.y - 520) * (1 - converge),
            width: 300,
            height: 210,
            opacity: 1 - converge,
            transform: `scale(${1 - converge * 0.76})`,
            transformOrigin: 'top left',
            zIndex: 13,
          }}
        >
          <ActionObject id={item.id} />
        </div>
      ))}
    </ProofLayout>
  );
};

const MapScene: React.FC = () => (
  <ProofLayout
    clip={SCREEN_CLIPS.mapApp}
    badge="真实地图 App"
    title="同一枚定位针，落到地图"
    note="独立地图页的门店落点与入口可见；权限弹窗没有被当作门店证据。"
    zoomPosition="50% 52%"
    tone={GOLD}
    showPin
  />
);

const StoreEntryJumpScene: React.FC = () => {
  const frame = useCurrentFrame();
  const globalFrame = frame + SCREEN_CLIPS.storeEntryJump.outputInFrame;
  const jumpStartFrame = mediaContract.semanticFrameGates.storeEntryJumpFrame;
  const jump = enterAt(globalFrame, jumpStartFrame - 1, 18);
  return (
    <ProofLayout
      clip={SCREEN_CLIPS.storeEntryJump}
      badge="真实门店卡进入动作"
      title="点击入口后，明确跳切"
      note="保留点入门店的动作；中间步骤不伪装成连续实时过程。"
      zoomPosition="50% 58%"
      tone={RED}
    >
      <div
        style={{
          position: 'absolute',
          left: 592,
          right: 88,
          top: 412,
          height: 228,
          background: '#27231d',
          color: '#fff5e5',
          clipPath:
            'polygon(0 8%, 5% 0, 12% 11%, 20% 0, 28% 10%, 36% 0, 45% 10%, 54% 0, 63% 10%, 72% 0, 82% 10%, 91% 0, 100% 9%, 98% 92%, 91% 100%, 82% 90%, 73% 100%, 64% 91%, 54% 100%, 45% 91%, 35% 100%, 25% 91%, 14% 100%, 5% 90%, 0 100%)',
          boxShadow: '0 25px 36px rgba(38,27,17,.36)',
          opacity: jump,
          transform: `scaleX(${0.72 + jump * 0.28})`,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 36,
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: 1.5,
        }}
      >
        <span style={{fontSize: 70, letterSpacing: 13}}>···</span>
        <span>中间步骤已跳过</span>
        <span style={{fontSize: 25, fontWeight: 600, color: '#decfb5'}}>加载 / 隐私 / 弹层</span>
      </div>
    </ProofLayout>
  );
};

const MenuScene: React.FC = () => (
  <ProofLayout
    clip={SCREEN_CLIPS.storeMenu}
    badge="真实门店菜单"
    title="菜单与选规格入口可见"
    note="这里只证明当时画面的菜单和入口可见；不声称已完成下单或支付。"
    zoomPosition="50% 60%"
    tone={GREEN}
  />
);

const TalkingHeadScene: React.FC = () => {
  const {fps} = useVideoConfig();
  const clip = mediaContract.talkingHeadClip;
  return (
    <AbsoluteFill style={{background: '#15120e'}}>
      <Video
        src={staticFile(MAIN_MEDIA)}
        muted
        objectFit="contain"
        trimBefore={Math.round(clip.spokenSourceIn * fps)}
        trimAfter={Math.round(clip.spokenSourceOut * fps)}
        style={{width: '100%', height: '100%', background: '#15120e'}}
      />
    </AbsoluteFill>
  );
};

type ThirdPartyStatusStripLayout =
  typeof mediaContract.candidateOnlyRender.stillAcceptancePolicy.closingEvidenceLayout.thirdPartyStatusStrip;

const ThirdPartyStatusStrip: React.FC<{layout: ThirdPartyStatusStripLayout}> = ({layout}) => (
  <ThickPaper
    depth={8}
    style={{
      left: layout.left,
      top: layout.top,
      width: layout.width,
      height: layout.height,
      padding: `${layout.paddingY}px ${layout.paddingX}px`,
      display: 'flex',
      alignItems: 'center',
      color: MUTED_INK,
      fontSize: layout.fontSize,
      fontWeight: 800,
      lineHeight: layout.lineHeight,
      whiteSpace: 'nowrap',
      overflow: 'visible',
      zIndex: 12,
    }}
  >
    录屏当时画面；价格、评分、营业状态以当时页面为准，非现时推荐
  </ThickPaper>
);

const ClosingQuestionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const card = enterAt(frame, 0, 18);
  const globalFrame = frame + mediaContract.talkingHeadClip.outputOutFrame;
  const sentenceFrame = mediaContract.semanticFrameGates.questionFlipFirstAllowedFrame;
  const sentenceAllowed = globalFrame >= sentenceFrame;
  const flip = clamp01((globalFrame - sentenceFrame + 1) / 22);
  const turn = interpolate(flip, [0, 1], [0, 180]);
  const screenshotClip = SCREEN_CLIPS.storeMenu;
  const closingLayout = mediaContract.candidateOnlyRender.stillAcceptancePolicy.closingEvidenceLayout;
  const imageCard = closingLayout.imageCard;
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: INK, perspective: 1600}}>
      <PaperWorld tone={GREEN} />
      <div style={{position: 'absolute', left: 116, top: 76, zIndex: 12}}>
        <PaperLabel tone={GREEN}>回看刚才的真实界面</PaperLabel>
      </div>
      <div style={{position: 'absolute', left: 116, top: 140, fontSize: 57, fontWeight: 900, zIndex: 12}}>
        {sentenceAllowed ? '不是它推荐了哪家店' : '这里最值得我们研究的……'}
      </div>
      <ThickPaper
        depth={18}
        style={{
          left: imageCard.left,
          top: imageCard.top,
          width: imageCard.width,
          height: imageCard.height,
          padding: `${imageCard.paddingY}px ${imageCard.paddingX}px`,
          opacity: card,
          transform: `translateY(${(1 - card) * 50}px) rotate(-2deg)`,
          overflow: imageCard.overflow as React.CSSProperties['overflow'],
          zIndex: 7,
        }}
      >
        <div
          style={{
            height: imageCard.screenContentHeight,
            overflow: 'hidden',
            border: `${imageCard.screenBorderWidth}px solid #d2c1a1`,
            background: '#000',
          }}
        >
          <Freeze frame={0}>
            <Video
              src={staticFile(SCREEN_MEDIA)}
              muted
              objectFit="contain"
              trimBefore={Math.round(screenshotClip.representativeTime * fps)}
              trimAfter={Math.round((screenshotClip.representativeTime + 1 / FPS) * fps)}
              style={{width: '100%', height: '100%', background: '#000', objectPosition: '50% 60%'}}
            />
          </Freeze>
        </div>
      </ThickPaper>
      <ThirdPartyStatusStrip layout={closingLayout.thirdPartyStatusStrip} />
      <div
        style={{
          position: 'absolute',
          left: 1045,
          top: 300,
          width: 660,
          height: 390,
          transformStyle: 'preserve-3d',
          transform: `rotateY(${turn}deg)`,
          opacity: card,
          zIndex: 9,
        }}
      >
        <ThickPaper
          depth={20}
          style={{
            inset: 0,
            padding: '65px 54px',
            backfaceVisibility: 'hidden',
            backgroundColor: '#f7efdd',
          }}
        >
          <div style={{fontSize: 25, color: MUTED_INK, letterSpacing: 2, fontWeight: 700}}>具体店名</div>
          <div
            style={{
              fontSize: 75,
              fontWeight: 900,
              marginTop: 38,
            }}
          >
            某家门店
          </div>
        </ThickPaper>
        <ThickPaper
          depth={20}
          style={{
            inset: 0,
            padding: '40px',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundColor: '#dce8dd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 220,
            lineHeight: 1,
            fontWeight: 900,
            color: GREEN,
          }}
        >
          ？
        </ThickPaper>
      </div>
    </AbsoluteFill>
  );
};

const TranscriptCaption: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / FPS;
  const cue = CAPTION_CUES.find((item) => seconds >= item.start && seconds < item.end);
  if (!cue) return null;
  const enter = interpolate(seconds, [cue.start, cue.start + 0.1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 250,
        bottom: 58,
        width: 1420,
        padding: '18px 34px',
        boxSizing: 'border-box',
        borderRadius: 7,
        background: 'rgba(23,21,18,.92)',
        color: '#fff8e8',
        textAlign: 'center',
        fontFamily: FONT,
        fontSize: 40,
        fontWeight: 800,
        lineHeight: 1.35,
        letterSpacing: 0.5,
        boxShadow: '0 14px 24px rgba(29,21,13,.3)',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 10}px)`,
        zIndex: 40,
      }}
    >
      {cue.text}
    </div>
  );
};

const SfxTrack: React.FC = () => (
  <>
    {mediaContract.sfxCues.map((cue) => (
      <Sequence key={cue.id} from={'atFrame' in cue ? cue.atFrame : frameAt(cue.atSeconds)}>
        <Audio src={staticFile(cue.staticFileName)} volume={cue.volume} />
      </Sequence>
    ))}
  </>
);

export type DirectorV2E2EWechatProps = {candidateRenderGate?: string; withSfx?: boolean};

export const DirectorV2E2EWechat: React.FC<DirectorV2E2EWechatProps> = ({candidateRenderGate, withSfx = false}) => {
  if (candidateRenderGate !== mediaContract.candidateOnlyRender.gate) {
    throw new Error('Candidate workflow gate rejected this invocation. Use the validated candidate-only wrapper.');
  }

  const queryEnd = SCREEN_CLIPS.query.outputOutFrame;
  const workbenchEnd = SCREEN_CLIPS.answerRecommendations.outputInFrame;
  const answerEnd = SCREEN_CLIPS.answerRecommendations.outputOutFrame;
  const mapEnd = SCREEN_CLIPS.mapApp.outputOutFrame;
  const entryEnd = SCREEN_CLIPS.storeEntryJump.outputOutFrame;
  const proofEnd = SCREEN_CLIPS.storeMenu.outputOutFrame;
  const humanEnd = mediaContract.talkingHeadClip.outputOutFrame;

  return (
    <AbsoluteFill style={{background: PAPER}}>
      <Sequence from={0} durationInFrames={queryEnd} premountFor={FPS}>
        <QueryConditionsScene />
      </Sequence>
      <Sequence from={queryEnd} durationInFrames={workbenchEnd - queryEnd} premountFor={FPS}>
        <SearchWorkbenchScene />
      </Sequence>
      <Sequence from={workbenchEnd} durationInFrames={answerEnd - workbenchEnd} premountFor={FPS}>
        <AnswerScene />
      </Sequence>
      <Sequence from={answerEnd} durationInFrames={mapEnd - answerEnd} premountFor={FPS}>
        <MapScene />
      </Sequence>
      <Sequence from={mapEnd} durationInFrames={entryEnd - mapEnd} premountFor={FPS}>
        <StoreEntryJumpScene />
      </Sequence>
      <Sequence from={entryEnd} durationInFrames={proofEnd - entryEnd} premountFor={FPS}>
        <MenuScene />
      </Sequence>
      <Sequence from={proofEnd} durationInFrames={humanEnd - proofEnd} premountFor={FPS}>
        <TalkingHeadScene />
      </Sequence>
      <Sequence from={humanEnd} durationInFrames={BOUNDARIES.end - humanEnd} premountFor={FPS}>
        <ClosingQuestionScene />
      </Sequence>
      <Audio src={staticFile(MAIN_MEDIA)} trimBefore={Math.round(SPOKEN_SOURCE_IN_SECONDS * FPS)} volume={1} />
      {withSfx ? <SfxTrack /> : null}
      <TranscriptCaption />
    </AbsoluteFill>
  );
};
