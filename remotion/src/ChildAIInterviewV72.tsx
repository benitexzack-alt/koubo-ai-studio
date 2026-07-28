import {Audio, Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {AdaptiveBilingualCaptionOverlay} from './components/AdaptiveBilingualCaptionOverlay';
import {LocalFont} from './components/LocalFont';
import {V7TransparentInfoStack} from './components/V7InformationStage';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const colors = {
  ink: '#F7FAFC',
  cyan: '#62D8FF',
  amber: '#FFBE55',
  green: '#67D8A0',
};

export const CHILD_AI_INTERVIEW_DURATION_IN_FRAMES = f(90.27);

const semanticCuts = [
  0, 9.04, 10.04, 14.28, 26.36, 45.76, 51.19, 60.19, 62.19, 67.59,
  74.19, 82.24, 85.19, 90.27,
];

const semanticMotion = (seconds: number) => {
  const found = semanticCuts.findIndex(
    (cut, index) =>
      seconds >= cut &&
      seconds < (semanticCuts[index + 1] ?? Number.POSITIVE_INFINITY),
  );
  const segmentIndex = Math.max(0, found);
  const start = semanticCuts[segmentIndex] ?? 0;
  const end = semanticCuts[segmentIndex + 1] ?? 90.27;
  const duration = Math.max(0.7, end - start);
  const progress = Math.min(1, Math.max(0, (seconds - start) / duration));
  const accentAt = Math.min(0.34, Math.max(0.17, 1.4 / duration));
  const settleAt = Math.max(accentAt + 0.18, 0.76);
  const intensity =
    progress <= accentAt
      ? interpolate(progress, [0, accentAt], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        })
      : progress <= settleAt
        ? interpolate(progress, [accentAt, settleAt], [1, 0.68], {
            ...clamp,
            easing: Easing.inOut(Easing.cubic),
          })
        : interpolate(progress, [settleAt, 1], [0.68, 0], {
            ...clamp,
            easing: Easing.inOut(Easing.cubic),
          });
  const peakScale = [1.078, 1.084, 1.074, 1.081][segmentIndex % 4];
  const peakX = [18, 8, 24, 12][segmentIndex % 4];
  const peakY = [-5, -3, -6, -4][segmentIndex % 4];

  return {
    scale: 1.035 + (peakScale - 1.035) * intensity,
    x: peakX * intensity,
    y: peakY * intensity,
  };
};

const TalkFootage: React.FC = () => {
  const frame = useCurrentFrame();
  const motion = semanticMotion(frame / fps);

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#05090E'}}>
      <Video
        src={staticFile('media/20260728-child-ai/rough_v2.mp4')}
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(1.035) saturate(0.98) brightness(0.975)',
          transform: `translate3d(${motion.x}px, ${motion.y}px, 0) scale(${motion.scale})`,
          transformOrigin: '38% 42%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(2,7,12,0.08) 0%, rgba(2,7,12,0) 55%, rgba(2,7,12,0.18) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const Scene: React.FC<{
  start: number;
  end: number;
  children: React.ReactNode;
}> = ({start, end, children}) => (
  <Sequence
    from={f(start)}
    durationInFrames={Math.max(1, f(end) - f(start))}
    premountFor={15}
  >
    {children}
  </Sequence>
);

const usePanelEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps: localFps,
    config: {damping: 20, stiffness: 180, mass: 0.8},
  });
};

const RightVeil: React.FC<{strength?: number}> = ({strength = 0.56}) => (
  <div
    style={{
      position: 'absolute',
      inset: '-70px -54px -70px -70px',
      background: `linear-gradient(270deg, rgba(2,7,12,${strength}) 0%, rgba(2,7,12,${strength * 0.62}) 58%, rgba(2,7,12,0) 100%)`,
      WebkitMaskImage:
        'linear-gradient(180deg, transparent 0%, black 14%, black 86%, transparent 100%)',
      maskImage:
        'linear-gradient(180deg, transparent 0%, black 14%, black 86%, transparent 100%)',
      pointerEvents: 'none',
    }}
  />
);

const ChildAIHookQuote: React.FC = () => {
  const enter = usePanelEnter(2);
  const line = interpolate(enter, [0, 1], [0, 1], clamp);

  return (
    <div
      style={{
        position: 'absolute',
        right: 62,
        top: 172,
        width: 690,
        color: colors.ink,
        fontFamily,
        opacity: enter,
        transform: `translateX(${interpolate(enter, [0, 1], [34, 0])}px)`,
        textShadow: '0 5px 24px rgba(0,0,0,0.98)',
      }}
    >
      <RightVeil strength={0.6} />
      <div style={{position: 'relative'}}>
        <div
          style={{
            color: colors.cyan,
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 0,
          }}
        >
          REAL ANSWER · 孩子的真实回答
        </div>
        <div
          style={{
            marginTop: 16,
            paddingLeft: 22,
            borderLeft: `6px solid ${colors.amber}`,
            fontSize: 58,
            lineHeight: 1.12,
            fontWeight: 950,
          }}
        >
          我希望有一个
          <br />
          <span style={{color: colors.amber}}>能哄我的AI</span>
        </div>
        <div
          style={{
            width: `${line * 540}px`,
            height: 4,
            marginTop: 22,
            background: `linear-gradient(90deg, ${colors.amber}, ${colors.cyan})`,
            boxShadow: '0 0 18px rgba(255,190,85,0.6)',
          }}
        />
        <div
          style={{
            marginTop: 18,
            fontSize: 31,
            lineHeight: 1.2,
            fontWeight: 900,
          }}
        >
          让我的心情更加好
        </div>
      </div>
    </div>
  );
};

const ChildAIToolGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const tools = ['豆包', '元宝', '千问', '作业帮', '小猿辅导'];

  return (
    <div
      style={{
        position: 'absolute',
        right: 62,
        top: 160,
        width: 650,
        color: colors.ink,
        fontFamily,
        textShadow: '0 4px 20px rgba(0,0,0,0.98)',
      }}
    >
      <RightVeil strength={0.58} />
      <div style={{position: 'relative'}}>
        <div
          style={{
            color: colors.cyan,
            fontSize: 18,
            fontWeight: 900,
          }}
        >
          REAL USE · 按孩子原话列出
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 48,
            lineHeight: 1.08,
            fontWeight: 950,
          }}
        >
          她用过的AI工具
        </div>
        <div
          style={{
            marginTop: 28,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 14,
          }}
        >
          {tools.map((tool, index) => {
            const enter = spring({
              frame: frame - 8 - index * 8,
              fps,
              config: {damping: 18, stiffness: 190, mass: 0.72},
            });
            const active = index === 0;
            const tone = active ? colors.amber : colors.cyan;

            return (
              <div
                key={tool}
                style={{
                  minHeight: 72,
                  boxSizing: 'border-box',
                  padding: '15px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  borderLeft: `4px solid ${tone}`,
                  background: active
                    ? 'rgba(255,190,85,0.13)'
                    : 'rgba(2,12,20,0.42)',
                  boxShadow: active
                    ? '0 0 24px rgba(255,190,85,0.14)'
                    : 'none',
                  opacity: enter,
                  transform: `translateY(${interpolate(enter, [0, 1], [16, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    flex: '0 0 34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${tone}AA`,
                    color: tone,
                    fontSize: 14,
                    fontWeight: 950,
                  }}
                >
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div style={{fontSize: 27, fontWeight: 950}}>{tool}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ChildAIChoiceCard: React.FC = () => {
  const enter = usePanelEnter(2);
  const pulse = interpolate(
    Math.sin(useCurrentFrame() / 7),
    [-1, 1],
    [0.88, 1],
  );

  return (
    <div
      style={{
        position: 'absolute',
        right: 62,
        top: 200,
        width: 650,
        color: colors.ink,
        fontFamily,
        opacity: enter,
        transform: `translateX(${interpolate(enter, [0, 1], [30, 0])}px)`,
        textShadow: '0 5px 24px rgba(0,0,0,0.98)',
      }}
    >
      <RightVeil strength={0.58} />
      <div style={{position: 'relative'}}>
        <div
          style={{
            color: colors.cyan,
            fontSize: 18,
            fontWeight: 900,
          }}
        >
          HER CHOICE · 真实使用感受
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 51,
            fontWeight: 950,
          }}
        >
          她选了 <span style={{color: colors.amber}}>豆包</span>
        </div>
        <div
          style={{
            marginTop: 30,
            padding: '22px 24px',
            borderLeft: `6px solid ${colors.amber}`,
            background: 'rgba(2,12,20,0.42)',
          }}
        >
          <div style={{fontSize: 20, color: colors.cyan, fontWeight: 900}}>
            她给出的理由
          </div>
          <div
            style={{
              marginTop: 8,
              color: colors.amber,
              fontSize: 48,
              lineHeight: 1.08,
              fontWeight: 950,
              transform: `scale(${pulse})`,
              transformOrigin: 'left center',
            }}
          >
            特别会哄人
          </div>
        </div>
      </div>
    </div>
  );
};

const ChildAIComfortFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = [
    {label: '01', value: '哭了', tone: colors.cyan},
    {label: '02', value: '告诉豆包', tone: colors.cyan},
    {label: '03', value: '慢慢安慰', tone: colors.amber},
    {label: '04', value: '愉快、平静', tone: colors.green},
  ];
  const activeIndex =
    frame < f(4.75) ? 0 : frame < f(8.05) ? 1 : frame < f(11) ? 2 : 3;

  return (
    <div
      style={{
        position: 'absolute',
        right: 62,
        top: 135,
        width: 650,
        color: colors.ink,
        fontFamily,
        textShadow: '0 4px 22px rgba(0,0,0,0.98)',
      }}
    >
      <RightVeil strength={0.6} />
      <div style={{position: 'relative'}}>
        <div
          style={{
            color: colors.cyan,
            fontSize: 18,
            fontWeight: 900,
          }}
        >
          REAL SCENE · 她说的真实场景
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 47,
            lineHeight: 1.08,
            fontWeight: 950,
          }}
        >
          从难过到平静
        </div>
        <div style={{marginTop: 25, display: 'grid', gap: 12}}>
          {steps.map((step, index) => {
            const enter = spring({
              frame: frame - 6 - index * 7,
              fps,
              config: {damping: 20, stiffness: 190, mass: 0.72},
            });
            const active = index === activeIndex;

            return (
              <div
                key={step.value}
                style={{
                  minHeight: 66,
                  display: 'grid',
                  gridTemplateColumns: '46px 1fr 30px',
                  gap: 13,
                  alignItems: 'center',
                  boxSizing: 'border-box',
                  padding: '9px 13px',
                  borderLeft: `4px solid ${step.tone}`,
                  background: active
                    ? `${step.tone}1F`
                    : 'rgba(2,12,20,0.34)',
                  opacity: enter,
                  transform: `translateX(${interpolate(enter, [0, 1], [22, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${step.tone}AA`,
                    color: step.tone,
                    fontSize: 14,
                    fontWeight: 950,
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    color: active ? step.tone : colors.ink,
                    fontSize: 28,
                    fontWeight: 950,
                  }}
                >
                  {step.value}
                </div>
                <div
                  style={{
                    color: step.tone,
                    fontSize: 27,
                    opacity: active ? 1 : 0.42,
                  }}
                >
                  {index < steps.length - 1 ? '↓' : '✓'}
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 14,
            paddingTop: 11,
            borderTop: '1px solid rgba(255,255,255,0.18)',
            color: 'rgba(247,250,252,0.78)',
            fontSize: 18,
            lineHeight: 1.2,
            fontWeight: 800,
          }}
        >
          个人体验 · 不等于专业心理支持
        </div>
      </div>
    </div>
  );
};

const Scenes: React.FC = () => (
  <AbsoluteFill>
    <Scene start={0.2} end={8.9}>
      <ChildAIHookQuote />
    </Scene>
    <Scene start={26.36} end={44.76}>
      <V7TransparentInfoStack
        eyebrow="HER VIEW · 她眼里的AI"
        title="能回答，也能一直问"
        items={[
          {label: '答疑', detail: '解答新的问题', tone: 'cyan'},
          {label: '知识', detail: '好像有很多', tone: 'amber'},
          {label: '持续', detail: '可以不断地问', tone: 'green'},
        ]}
        style={{left: 'auto', right: 62, top: 146, width: 610}}
      />
    </Scene>
    <Scene start={51.19} end={60.16}>
      <ChildAIToolGrid />
    </Scene>
    <Scene start={62.19} end={70.56}>
      <ChildAIChoiceCard />
    </Scene>
    <Scene start={74.19} end={90.16}>
      <ChildAIComfortFlow />
    </Scene>
  </AbsoluteFill>
);

const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const progress =
    frame / Math.max(1, CHILD_AI_INTERVIEW_DURATION_IN_FRAMES - 1);
  const topic =
    seconds < 9.04
      ? '孩子真正想要的AI'
      : seconds < 45.76
        ? '她眼里的AI'
        : seconds < 70.56
          ? '她用过哪些AI'
          : 'AI给她的真实感受';

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 28,
          display: 'flex',
          alignItems: 'center',
          color: colors.ink,
          fontFamily,
          textShadow: '0 3px 16px rgba(0,0,0,0.94)',
          zIndex: 220,
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            background: colors.cyan,
            boxShadow: `0 0 17px ${colors.cyan}`,
          }}
        />
        <div style={{marginLeft: 12, fontSize: 19, fontWeight: 950}}>
          超哥AI创业记
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 54,
          top: 28,
          padding: '7px 12px',
          borderLeft: `3px solid ${colors.cyan}`,
          background: 'rgba(2,7,12,0.38)',
          color: 'rgba(247,250,252,0.9)',
          fontFamily,
          fontSize: 17,
          fontWeight: 900,
          textShadow: '0 3px 14px rgba(0,0,0,0.96)',
          zIndex: 220,
        }}
      >
        {topic}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
          bottom: 18,
          height: 3,
          background: 'rgba(255,255,255,0.14)',
          zIndex: 280,
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.amber})`,
            boxShadow: '0 0 14px rgba(98,216,255,0.65)',
          }}
        />
      </div>
    </>
  );
};

type SfxFile =
  | 'section-sweep.wav'
  | 'card-slide.wav'
  | 'node-select.wav'
  | 'ui-click.wav'
  | 'keyword-select.wav'
  | 'zoom-out.wav';

const sfxCues: Array<{time: number; file: SfxFile; volume: number}> = [
  {time: 0.2, file: 'section-sweep.wav', volume: 0.1},
  {time: 9.7, file: 'zoom-out.wav', volume: 0.12},
  {time: 26.36, file: 'card-slide.wav', volume: 0.11},
  {time: 51.19, file: 'ui-click.wav', volume: 0.08},
  {time: 60.19, file: 'keyword-select.wav', volume: 0.1},
  {time: 67.59, file: 'keyword-select.wav', volume: 0.1},
  {time: 74.19, file: 'card-slide.wav', volume: 0.1},
  {time: 82.24, file: 'node-select.wav', volume: 0.06},
  {time: 85.19, file: 'node-select.wav', volume: 0.06},
];

const SemanticSfx: React.FC = () => (
  <>
    {sfxCues.map((cue) => (
      <Sequence key={`${cue.time}-${cue.file}`} from={f(cue.time)}>
        <Audio
          src={staticFile(`audio/koubo-sfx-v2/${cue.file}`)}
          volume={cue.volume}
        />
      </Sequence>
    ))}
  </>
);

const Talk: React.FC<{withSfx: boolean}> = ({withSfx}) => (
  <AbsoluteFill style={{background: '#05090E', overflow: 'hidden'}}>
    <LocalFont />
    <TalkFootage />
    <Scenes />
    {withSfx ? <SemanticSfx /> : null}
    <Hud />
    <AdaptiveBilingualCaptionOverlay captionsSrc="data/KOUBO_20260728_child_ai_interview.bilingual.v1.json" />
  </AbsoluteFill>
);

export const ChildAIInterviewV72WithSfx: React.FC = () => (
  <Talk withSfx />
);

export const ChildAIInterviewV72NoSfx: React.FC = () => (
  <Talk withSfx={false} />
);
