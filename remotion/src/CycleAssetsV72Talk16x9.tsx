import {Audio, Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {AdaptiveBilingualCaptionOverlay} from './components/AdaptiveBilingualCaptionOverlay';
import {LocalFont} from './components/LocalFont';
import {
  V7AnnotatedMediaStage,
  V7ChapterMarker,
  V7HeroMetric,
  V7LocalContrastVeil,
  V7TransparentInfoStack,
  V7TruthStatement,
} from './components/V7InformationStage';

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
  red: '#FF6B64',
  dark: '#04080D',
  muted: 'rgba(247,250,252,0.68)',
};

export const CYCLE_ASSETS_DURATION_IN_FRAMES = f(378.75);

const semanticMotionCuts = [
  0, 10, 18, 29, 44, 54, 72, 78, 92, 107, 128, 139, 154, 165, 169,
  187, 198, 211, 225, 239, 257, 271, 284, 304, 318, 336, 353, 363,
  376, 378.75,
];

const semanticMotion = (seconds: number) => {
  let segmentIndex = semanticMotionCuts.findIndex(
    (cut, index) =>
      seconds >= cut &&
      seconds <
        (semanticMotionCuts[index + 1] ?? Number.POSITIVE_INFINITY),
  );
  if (segmentIndex < 0) {
    segmentIndex = semanticMotionCuts.length - 2;
  }
  const start = semanticMotionCuts[segmentIndex] ?? 0;
  const end =
    semanticMotionCuts[segmentIndex + 1] ??
    CYCLE_ASSETS_DURATION_IN_FRAMES / fps;
  const duration = Math.max(0.6, end - start);
  const progress = Math.min(1, Math.max(0, (seconds - start) / duration));
  const accentAt = Math.min(0.32, Math.max(0.16, 1.45 / duration));
  const settleAt = Math.max(accentAt + 0.18, 0.76);
  const intensity =
    progress <= accentAt
      ? interpolate(progress, [0, accentAt], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        })
      : progress <= settleAt
        ? interpolate(progress, [accentAt, settleAt], [1, 0.72], {
            ...clamp,
            easing: Easing.inOut(Easing.cubic),
          })
        : interpolate(progress, [settleAt, 1], [0.72, 0], {
            ...clamp,
            easing: Easing.inOut(Easing.cubic),
          });
  const peakScale = [1.078, 1.083, 1.075, 1.081][segmentIndex % 4];
  const peakX = [-24, -12, 8, -20][segmentIndex % 4];
  const peakY = [-5, -3, -4, -2][segmentIndex % 4];

  return {
    scale: 1.035 + (peakScale - 1.035) * intensity,
    x: peakX * intensity,
    y: peakY * intensity,
  };
};

const useSceneOpacity = (fadeFrames = 10) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return Math.min(
    interpolate(frame, [0, fadeFrames], [0, 1], clamp),
    interpolate(
      frame,
      [
        Math.max(fadeFrames, durationInFrames - fadeFrames),
        durationInFrames,
      ],
      [1, 0],
      clamp,
    ),
  );
};

const TalkFootage: React.FC = () => {
  const frame = useCurrentFrame();
  const motion = semanticMotion(frame / fps);

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: colors.dark}}>
      <Video
        src={staticFile('media/cycle-assets-20260730/main-30fps.mp4')}
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(1.035) saturate(1.02) brightness(0.995)',
          transform: `translate3d(${motion.x}px, ${motion.y}px, 0) scale(${motion.scale})`,
          transformOrigin: '56% 42%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.13) 0%, rgba(2,7,12,0.01) 54%, rgba(2,7,12,0.035) 100%)',
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

const OpaqueMediaStage: React.FC<
  React.ComponentProps<typeof V7AnnotatedMediaStage>
> = (props) => (
  <AbsoluteFill style={{background: colors.dark}}>
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(145deg, #07111A 0%, #03070B 56%, #071018 100%)',
      }}
    />
    <V7AnnotatedMediaStage {...props} motionPreset="v72" />
  </AbsoluteFill>
);

const ThreeWordHook: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const words = [
    {label: '技术', tone: colors.cyan},
    {label: '钱', tone: colors.amber},
    {label: '时间', tone: colors.green},
  ];

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 190,
        width: 840,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 26px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.66} width={980} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          WHAT REMAINS · 热潮退去以后
        </div>
        <div style={{marginTop: 12, fontSize: 52, fontWeight: 950}}>
          今天砸进去的东西，最后沉淀成什么？
        </div>
        <div
          style={{
            marginTop: 35,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 18,
          }}
        >
          {words.map((word, index) => {
            const progress = spring({
              frame: frame - index * 10,
              fps: localFps,
              config: {damping: 20, stiffness: 175},
            });
            return (
              <div
                key={word.label}
                style={{
                  minHeight: 126,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderTop: `4px solid ${word.tone}`,
                  borderLeft: `1px solid ${word.tone}66`,
                  background: 'rgba(2,7,12,0.24)',
                  color: word.tone,
                  fontSize: 52,
                  fontWeight: 950,
                  opacity: progress,
                  transform: `translateY(${interpolate(
                    progress,
                    [0, 1],
                    [20, 0],
                  )}px)`,
                }}
              >
                {word.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const InternetTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const line = interpolate(frame, [5, 48], [0, 1], clamp);
  const points = [
    {year: '1990s', label: '大规模铺设光纤'},
    {year: '2000', label: '投资热潮与泡沫'},
    {year: '后来', label: '基础设施重新被利用'},
  ];

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 176,
        width: 1040,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 26px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.65} width={1170} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          DOT-COM ERA · 先回头看互联网泡沫
        </div>
        <div style={{marginTop: 12, fontSize: 55, fontWeight: 950}}>
          热度会退，建成的东西不会凭空消失
        </div>
        <div style={{position: 'relative', marginTop: 70, height: 210}}>
          <div
            style={{
              position: 'absolute',
              left: 20,
              top: 52,
              width: 920 * line,
              height: 4,
              background: `linear-gradient(90deg, ${colors.cyan}, ${colors.amber})`,
              boxShadow: '0 0 18px rgba(98,216,255,0.65)',
            }}
          />
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 42,
            }}
          >
            {points.map((point, index) => {
              const progress = interpolate(
                frame,
                [12 + index * 12, 28 + index * 12],
                [0, 1],
                clamp,
              );
              return (
                <div key={point.year} style={{opacity: progress}}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      marginLeft: 12,
                      borderRadius: '50%',
                      background: index === 1 ? colors.amber : colors.cyan,
                      boxShadow: `0 0 20px ${
                        index === 1 ? colors.amber : colors.cyan
                      }`,
                    }}
                  />
                  <div
                    style={{
                      marginTop: 24,
                      color: index === 1 ? colors.amber : colors.cyan,
                      fontSize: 33,
                      fontWeight: 950,
                    }}
                  >
                    {point.year}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 25,
                      lineHeight: 1.18,
                      fontWeight: 900,
                    }}
                  >
                    {point.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const DarkFiberStage: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const pulse = interpolate(frame % 66, [0, 33, 65], [0.18, 1, 0.18], clamp);
  const lines = [0, 1, 2, 3, 4];

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 144,
        width: 960,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 26px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.68} width={1120} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          DARK FIBER · 暗光纤
        </div>
        <div style={{marginTop: 12, fontSize: 58, fontWeight: 950}}>
          公司会退出，光纤仍然埋在地下
        </div>
        <div style={{marginTop: 34, display: 'grid', gap: 18}}>
          {lines.map((line, index) => {
            const active = index <= Math.floor((frame / 36) % 6);
            const tone = active ? colors.cyan : 'rgba(247,250,252,0.18)';
            return (
              <div
                key={line}
                style={{
                  position: 'relative',
                  width: 760,
                  height: 18,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,0,0,0.26)',
                }}
              >
                <div
                  style={{
                    width: active ? `${35 + index * 13}%` : '0%',
                    height: '100%',
                    background: tone,
                    boxShadow: active
                      ? `0 0 ${18 + pulse * 18}px ${colors.cyan}`
                      : 'none',
                  }}
                />
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 28,
            borderLeft: `4px solid ${colors.amber}`,
            paddingLeft: 16,
            color: colors.amber,
            fontSize: 31,
            lineHeight: 1.2,
            fontWeight: 950,
          }}
        >
          不用从零再挖一遍
        </div>
      </div>
    </div>
  );
};

const QingyangEvidenceStage: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity(7);
  const images = [
    {
      src: 'media/cycle-assets-20260730/01_庆阳算力产业园航拍_中国甘肃网.jpg',
      label: '算力产业园',
    },
    {
      src: 'media/cycle-assets-20260730/02_庆阳服务器机架与技术人员_中国甘肃网.jpg',
      label: '服务器机架',
    },
    {
      src: 'media/cycle-assets-20260730/03_庆阳智算机房_中国甘肃网.jpg',
      label: '智算机房',
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(145deg, #07111A 0%, #03070B 56%, #071018 100%)',
        color: colors.ink,
        fontFamily,
        opacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 62,
          top: 54,
          color: colors.cyan,
          fontSize: 18,
          fontWeight: 950,
        }}
      >
        QINGYANG · 西北算力基础设施
      </div>
      <div
        style={{
          position: 'absolute',
          left: 62,
          top: 82,
          fontSize: 45,
          fontWeight: 950,
        }}
      >
        庆阳已经形成真实算力场景
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
          top: 160,
          height: 690,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 18,
        }}
      >
        {images.map((image, index) => {
          const progress = spring({
            frame: frame - index * 7,
            fps: localFps,
            config: {damping: 20, stiffness: 175},
          });
          return (
            <div
              key={image.src}
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderTop: `3px solid ${
                  index === 1 ? colors.amber : colors.cyan
                }`,
                background: '#05090E',
                opacity: progress,
                transform: `translateY(${interpolate(
                  progress,
                  [0, 1],
                  [20, 0],
                )}px)`,
              }}
            >
              <Img
                src={staticFile(image.src)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: `scale(${interpolate(
                    frame,
                    [0, 100],
                    [1.02, 1.075],
                    clamp,
                  )})`,
                }}
              />
              <AbsoluteFill
                style={{
                  background:
                    'linear-gradient(180deg, transparent 58%, rgba(2,7,12,0.88))',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  bottom: 48,
                  fontSize: 28,
                  fontWeight: 950,
                  textShadow: '0 4px 18px rgba(0,0,0,0.96)',
                }}
              >
                {image.label}
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  bottom: 18,
                  color: colors.muted,
                  fontSize: 15,
                  fontWeight: 850,
                }}
              >
                来源：中国甘肃网-甘肃日报
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const NorthwestCapitalStage: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const metricIn = spring({
    frame: frame - 3,
    fps: localFps,
    config: {damping: 19, stiffness: 180},
  });
  const route = interpolate(frame, [18, 56], [0, 1], clamp);

  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 132,
        width: 820,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 26px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.7} width={980} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          ZHONGWEI · 两家新公司
        </div>
        <div
          style={{
            marginTop: 11,
            display: 'flex',
            alignItems: 'baseline',
            color: colors.amber,
            opacity: metricIn,
            transform: `translateY(${interpolate(
              metricIn,
              [0, 1],
              [22, 0],
            )}px)`,
          }}
        >
          <span style={{fontSize: 96, lineHeight: 1, fontWeight: 950}}>
            22
          </span>
          <span style={{margin: '0 10px', fontSize: 44, fontWeight: 950}}>
            亿 +
          </span>
          <span style={{fontSize: 96, lineHeight: 1, fontWeight: 950}}>
            24
          </span>
          <span style={{marginLeft: 10, fontSize: 42, fontWeight: 950}}>
            亿元
          </span>
        </div>
        <div
          style={{
            marginTop: 8,
            color: colors.ink,
            fontSize: 28,
            fontWeight: 950,
          }}
        >
          两家公司注册资本
        </div>
        <div
          style={{
            position: 'relative',
            marginTop: 34,
            width: 700,
            height: 150,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 70,
              top: 58,
              width: 490 * route,
              height: 3,
              background: `linear-gradient(90deg, ${colors.cyan}, ${colors.green})`,
              boxShadow: '0 0 18px rgba(98,216,255,0.65)',
            }}
          />
          {[
            {left: 34, city: '庆阳', sub: '算力基础', tone: colors.cyan},
            {
              left: 548,
              city: '中卫',
              sub: '绿色算力方向',
              tone: colors.green,
            },
          ].map((point) => (
            <div
              key={point.city}
              style={{position: 'absolute', left: point.left, top: 28}}
            >
              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: '50%',
                  border: `2px solid ${point.tone}`,
                  background: `${point.tone}18`,
                  boxShadow: `0 0 22px ${point.tone}44`,
                }}
              />
              <div
                style={{
                  marginTop: 8,
                  color: point.tone,
                  fontSize: 24,
                  fontWeight: 950,
                }}
              >
                {point.city}
              </div>
              <div
                style={{
                  marginTop: 3,
                  color: colors.muted,
                  fontSize: 16,
                  fontWeight: 850,
                }}
              >
                {point.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DualAssetStage: React.FC<{
  eyebrow: string;
  title: string;
  leftTitle: string;
  leftDetail: string;
  rightTitle: string;
  rightDetail: string;
}> = ({
  eyebrow,
  title,
  leftTitle,
  leftDetail,
  rightTitle,
  rightDetail,
}) => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const items = [
    {
      index: '01',
      title: leftTitle,
      detail: leftDetail,
      tone: colors.cyan,
    },
    {
      index: '02',
      title: rightTitle,
      detail: rightDetail,
      tone: colors.amber,
    },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 140,
        width: 900,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 26px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.68} width={1030} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          {eyebrow}
        </div>
        <div style={{marginTop: 10, fontSize: 49, fontWeight: 950}}>
          {title}
        </div>
        <div
          style={{
            marginTop: 30,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 18,
          }}
        >
          {items.map((item, index) => {
            const progress = spring({
              frame: frame - 6 - index * 12,
              fps: localFps,
              config: {damping: 20, stiffness: 175},
            });
            return (
              <div
                key={item.title}
                style={{
                  minHeight: 250,
                  padding: '22px 23px',
                  boxSizing: 'border-box',
                  borderTop: `4px solid ${item.tone}`,
                  borderLeft: `1px solid ${item.tone}77`,
                  background: 'rgba(2,7,12,0.27)',
                  opacity: progress,
                  transform: `translateY(${interpolate(
                    progress,
                    [0, 1],
                    [20, 0],
                  )}px)`,
                }}
              >
                <div
                  style={{
                    color: item.tone,
                    fontSize: 18,
                    fontWeight: 950,
                  }}
                >
                  {item.index}
                </div>
                <div
                  style={{
                    marginTop: 16,
                    color: item.tone,
                    fontSize: 38,
                    lineHeight: 1.08,
                    fontWeight: 950,
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    marginTop: 18,
                    color: colors.ink,
                    fontSize: 26,
                    lineHeight: 1.22,
                    fontWeight: 900,
                  }}
                >
                  {item.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const BranchContextStage: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const branch = interpolate(frame, [12, 54], [0, 1], clamp);

  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 134,
        width: 940,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 26px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.69} width={1080} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          FIELD ACCESS · 公开网络里没有的一手情况
        </div>
        <div style={{marginTop: 10, fontSize: 50, fontWeight: 950}}>
          真正进过现场，才拿得到上下文
        </div>
        <div style={{position: 'relative', marginTop: 35, height: 390}}>
          {[
            {
              top: 20,
              title: '老板愿意告诉你',
              detail: '客户流失 · 团队卡点 · 试过什么',
              tone: colors.cyan,
            },
            {
              top: 225,
              title: '设计师愿意拿出来',
              detail: '未成形灵感 · 废稿 · 预算 · 顾虑',
              tone: colors.green,
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                position: 'absolute',
                left: 0,
                top: item.top,
                width: 480,
                minHeight: 135,
                padding: '18px 20px',
                boxSizing: 'border-box',
                borderLeft: `4px solid ${item.tone}`,
                background: 'rgba(2,7,12,0.29)',
              }}
            >
              <div
                style={{
                  color: item.tone,
                  fontSize: 28,
                  fontWeight: 950,
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 22,
                  lineHeight: 1.2,
                  fontWeight: 850,
                }}
              >
                {item.detail}
              </div>
            </div>
          ))}
          <div
            style={{
              position: 'absolute',
              left: 480,
              top: 86,
              width: 150 * branch,
              height: 3,
              background: colors.cyan,
              transform: 'rotate(20deg)',
              transformOrigin: 'left center',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 480,
              top: 292,
              width: 150 * branch,
              height: 3,
              background: colors.green,
              transform: 'rotate(-20deg)',
              transformOrigin: 'left center',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 620,
              top: 115,
              width: 285,
              minHeight: 155,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              border: `2px solid ${colors.amber}`,
              background: 'rgba(255,190,85,0.11)',
              boxShadow: '0 0 38px rgba(255,190,85,0.18)',
              color: colors.amber,
              fontSize: 38,
              lineHeight: 1.08,
              fontWeight: 950,
              opacity: branch,
            }}
          >
            一手上下文
          </div>
        </div>
      </div>
    </div>
  );
};

const KnowledgeContainerStage: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const containerIn = spring({
    frame: frame - 4,
    fps: localFps,
    config: {damping: 20, stiffness: 175},
  });
  const items = [
    {label: '真实现场上下文', tone: colors.cyan},
    {label: '行动与失败记录', tone: colors.green},
    {label: '被验收的证据', tone: colors.amber},
  ];

  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 128,
        width: 920,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 26px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.7} width={1060} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          KNOWLEDGE BASE · 知识库只是容器
        </div>
        <div style={{marginTop: 10, fontSize: 50, fontWeight: 950}}>
          真正值钱的是装进去的内容
        </div>
        <div
          style={{
            marginTop: 30,
            width: 780,
            minHeight: 390,
            padding: '24px 28px',
            boxSizing: 'border-box',
            border: `2px solid ${colors.cyan}AA`,
            background: 'rgba(2,7,12,0.25)',
            boxShadow: '0 0 38px rgba(98,216,255,0.12)',
            opacity: containerIn,
          }}
        >
          <div
            style={{
              color: colors.cyan,
              fontSize: 20,
              fontWeight: 950,
            }}
          >
            CONTAINER / 可检索、可调用
          </div>
          <div style={{marginTop: 24, display: 'grid', gap: 17}}>
            {items.map((item, index) => {
              const progress = spring({
                frame: frame - 16 - index * 11,
                fps: localFps,
                config: {damping: 20, stiffness: 175},
              });
              return (
                <div
                  key={item.label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr',
                    alignItems: 'center',
                    gap: 14,
                    minHeight: 68,
                    opacity: progress,
                    transform: `translateX(${interpolate(
                      progress,
                      [0, 1],
                      [-20, 0],
                    )}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${item.tone}`,
                      color: item.tone,
                      fontSize: 16,
                      fontWeight: 950,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div
                    style={{
                      borderLeft: `3px solid ${item.tone}`,
                      paddingLeft: 15,
                      color: item.tone,
                      fontSize: 29,
                      fontWeight: 950,
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChecklistStage: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const lists = [
    {
      index: '01',
      question: '哪些真实场景愿意向你打开？',
      examples: ['企业现场', '设计过程', '客户反馈'],
      tone: colors.cyan,
    },
    {
      index: '02',
      question: '哪些结果被使用者真正验收过？',
      examples: ['有人使用', '有人确认', '有结果证据'],
      tone: colors.amber,
    },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 132,
        width: 960,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 26px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.69} width={1110} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          ACTION · 今天就列两张清单
        </div>
        <div style={{marginTop: 10, fontSize: 51, fontWeight: 950}}>
          别再用囤工具代替真实行动
        </div>
        <div
          style={{
            marginTop: 28,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 18,
          }}
        >
          {lists.map((list, listIndex) => {
            const panelIn = spring({
              frame: frame - listIndex * 10,
              fps: localFps,
              config: {damping: 20, stiffness: 175},
            });
            return (
              <div
                key={list.index}
                style={{
                  minHeight: 350,
                  padding: '22px 23px',
                  boxSizing: 'border-box',
                  borderTop: `4px solid ${list.tone}`,
                  background: 'rgba(2,7,12,0.28)',
                  opacity: panelIn,
                }}
              >
                <div
                  style={{
                    color: list.tone,
                    fontSize: 20,
                    fontWeight: 950,
                  }}
                >
                  CHECKLIST {list.index}
                </div>
                <div
                  style={{
                    marginTop: 15,
                    fontSize: 30,
                    lineHeight: 1.18,
                    fontWeight: 950,
                  }}
                >
                  {list.question}
                </div>
                <div style={{marginTop: 24, display: 'grid', gap: 15}}>
                  {list.examples.map((example, index) => {
                    const itemIn = spring({
                      frame: frame - 18 - listIndex * 8 - index * 9,
                      fps: localFps,
                      config: {damping: 20, stiffness: 170},
                    });
                    return (
                      <div
                        key={example}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '34px 1fr',
                          gap: 10,
                          alignItems: 'center',
                          opacity: itemIn,
                        }}
                      >
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            border: `2px solid ${list.tone}`,
                            color: list.tone,
                            fontSize: 19,
                            lineHeight: '22px',
                            textAlign: 'center',
                            fontWeight: 950,
                          }}
                        >
                          ✓
                        </div>
                        <div style={{fontSize: 24, fontWeight: 900}}>
                          {example}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const DurableContextStage: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();
  const fade = interpolate(frame, [0, 70], [1, 0.12], clamp);
  const durable = interpolate(frame, [35, 90], [0, 1], clamp);

  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 180,
        width: 940,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 26px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.69} width={1080} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          WHAT CHANGES · 什么会换
        </div>
        <div
          style={{
            marginTop: 28,
            display: 'flex',
            gap: 18,
            opacity: fade,
          }}
        >
          {['模型会换', '工具会换', '热度会换'].map((item) => (
            <div
              key={item}
              style={{
                minWidth: 230,
                padding: '16px 18px',
                borderTop: `3px solid ${colors.red}`,
                background: 'rgba(2,7,12,0.28)',
                color: colors.muted,
                fontSize: 29,
                fontWeight: 950,
              }}
            >
              {item}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 40,
            borderLeft: `5px solid ${colors.amber}`,
            paddingLeft: 20,
            color: colors.amber,
            fontSize: 48,
            lineHeight: 1.15,
            fontWeight: 950,
            opacity: durable,
            transform: `translateY(${interpolate(
              durable,
              [0, 1],
              [18, 0],
            )}px)`,
          }}
        >
          现场、行动、失败、验收
          <div
            style={{
              marginTop: 12,
              color: colors.ink,
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            这些会让AI越用越像你
          </div>
        </div>
      </div>
    </div>
  );
};

type LeftProcessStep = {
  label: string;
  detail: string;
  tone: string;
};

const LeftProcessGrid: React.FC<{
  eyebrow: string;
  title: string;
  steps: [LeftProcessStep, LeftProcessStep, LeftProcessStep, LeftProcessStep];
}> = ({eyebrow, title, steps}) => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const bead = (frame % 72) / 71;
  const positions = [
    {left: 0, top: 0},
    {left: 430, top: 0},
    {left: 430, top: 210},
    {left: 0, top: 210},
  ];

  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 118,
        width: 870,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 26px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.7} width={1010} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          {eyebrow}
        </div>
        <div style={{marginTop: 10, fontSize: 45, lineHeight: 1.08, fontWeight: 950}}>
          {title}
        </div>
        <div style={{position: 'relative', marginTop: 26, width: 800, height: 370}}>
          {steps.map((step, index) => {
            const progress = spring({
              frame: frame - 5 - index * 10,
              fps: localFps,
              config: {damping: 20, stiffness: 175},
            });
            const position = positions[index];
            return (
              <div
                key={step.label}
                style={{
                  position: 'absolute',
                  left: position.left,
                  top: position.top,
                  width: 370,
                  height: 160,
                  boxSizing: 'border-box',
                  padding: '15px 18px 17px',
                  borderTop: `3px solid ${step.tone}`,
                  borderLeft: `1px solid ${step.tone}88`,
                  background: 'rgba(2,7,12,0.31)',
                  opacity: progress,
                  transform: `translateY(${interpolate(progress, [0, 1], [16, 0])}px)`,
                }}
              >
                <div style={{color: step.tone, fontSize: 16, fontWeight: 950}}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div
                  style={{
                    marginTop: 9,
                    color: step.tone,
                    fontSize: 25,
                    lineHeight: 1.08,
                    fontWeight: 950,
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    marginTop: 9,
                    fontSize: 22,
                    lineHeight: 1.18,
                    fontWeight: 900,
                  }}
                >
                  {step.detail}
                </div>
              </div>
            );
          })}

          <div
            style={{
              position: 'absolute',
              left: 374,
              top: 78,
              width: 52,
              height: 2,
              background: 'rgba(98,216,255,0.7)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 374 + bead * 42,
              top: 74,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: colors.cyan,
              boxShadow: `0 0 16px ${colors.cyan}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 612,
              top: 164,
              width: 2,
              height: 42,
              background: 'rgba(98,216,255,0.7)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 608,
              top: 164 + bead * 32,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: colors.cyan,
              boxShadow: `0 0 16px ${colors.cyan}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 374,
              top: 288,
              width: 52,
              height: 2,
              background: 'rgba(98,216,255,0.7)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 416 - bead * 42,
              top: 284,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: colors.cyan,
              boxShadow: `0 0 16px ${colors.cyan}`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

const Scenes: React.FC = () => (
  <AbsoluteFill>
    <Scene start={0.15} end={10}>
      <V7ChapterMarker
        index="01"
        eyebrow="AI CYCLE · 真正会留下什么"
        title="热潮退去，什么留下？"
        subtitle="不猜哪家公司会赢，先看技术、钱和时间最终沉淀成什么。"
      />
    </Scene>

    <Scene start={10} end={18}>
      <ThreeWordHook />
    </Scene>

    <Scene start={18} end={21}>
      <InternetTimeline />
    </Scene>

    <Scene start={21} end={29}>
      <OpaqueMediaStage
        index="01"
        eyebrow="INFRASTRUCTURE · 互联网时代"
        title="抢着铺光纤、建网络"
        facts={[
          {label: '时间', value: '2000年前后', tone: 'cyan'},
          {label: '建设', value: '光纤与网络', tone: 'amber'},
          {label: '属性', value: 'AI生成概念画面', tone: 'white'},
        ]}
        mediaSrc="media/cycle-assets-20260730/01-fiber-construction-30fps.mp4"
        mediaKind="video"
        mediaLabel="AI生成概念画面 · 不作为历史证据"
      />
    </Scene>

    <Scene start={29} end={35}>
      <InternetTimeline />
    </Scene>

    <Scene start={35} end={44}>
      <V7HeroMetric
        eyebrow="DARK FIBER · 一度闲置"
        value=">90"
        suffix="%"
        caption="上世纪90年代铺下的光纤"
        facts={['美联储研究提到', '后来一度处于闲置状态']}
        tone="amber"
      />
    </Scene>

    <Scene start={44} end={54}>
      <V7ChapterMarker
        index="02"
        eyebrow="DEFINITION · 暗光纤"
        title="公司会倒，光纤不会消失"
        subtitle="估值和热度可以归零，已经埋下的线路仍可能被重新利用。"
        tone="amber"
      />
    </Scene>

    <Scene start={54} end={62}>
      <OpaqueMediaStage
        index="02"
        eyebrow="DARK FIBER · 重新点亮"
        title="已经铺下的线路，可以被再次使用"
        facts={[
          {label: '资产', value: '地下光纤', tone: 'cyan'},
          {label: '变化', value: '闲置 → 重新承载需求', tone: 'amber'},
          {label: '属性', value: 'AI生成概念画面', tone: 'white'},
        ]}
        mediaSrc="media/cycle-assets-20260730/02-dark-fiber-30fps.mp4"
        mediaKind="video"
        mediaLabel="AI生成概念画面 · 科学可视化"
      />
    </Scene>

    <Scene start={62} end={72}>
      <DarkFiberStage />
    </Scene>

    <Scene start={72} end={78}>
      <V7TruthStatement
        eyebrow="TECH CYCLE · 第一层沉淀"
        left="热潮退去"
        right="底层基础设施消失"
        note="技术周期会淘汰公司，但不会自动抹掉已经建成的基础设施。"
      />
    </Scene>

    <Scene start={78} end={86}>
      <OpaqueMediaStage
        index="03"
        eyebrow="MASS ENTRY · 个人电脑"
        title="个人电脑进入日常"
        facts={[
          {label: '工作', value: '写文档与使用软件', tone: 'cyan'},
          {label: '学校', value: '学习数字工具', tone: 'amber'},
          {label: '家庭', value: '浏览信息与上网', tone: 'green'},
        ]}
        mediaSrc="media/cycle-assets-20260730/03-personal-computer-30fps.mp4"
        mediaKind="video"
        mediaLabel="AI生成概念画面 · 90年代末日常场景"
      />
    </Scene>

    <Scene start={86} end={92}>
      <V7ChapterMarker
        index="03"
        eyebrow="MASS ENTRY · 个人电脑"
        title="普通人怎么进入数字世界"
        subtitle="工作、学校、家庭里的电脑，逐渐成为大众使用网络的入口。"
      />
    </Scene>

    <Scene start={92} end={107}>
      <LeftProcessGrid
        eyebrow="TWO LAYERS · 互联网留下的两层"
        title="光纤决定容量，电脑决定入口"
        steps={[
          {label: '地下光纤', detail: '世界能跑多少', tone: 'cyan'},
          {label: '桌面电脑', detail: '普通人怎么进入', tone: 'amber'},
          {label: '日常动作', detail: '查、写、用', tone: 'green'},
          {label: '使用习惯', detail: '被长期保留下来', tone: 'cyan'},
        ].map((step) => ({
          ...step,
          tone: colors[step.tone as keyof typeof colors],
        })) as [LeftProcessStep, LeftProcessStep, LeftProcessStep, LeftProcessStep]}
      />
    </Scene>

    <Scene start={107} end={128}>
      <V7TransparentInfoStack
        eyebrow="INTERNET LEGACY · 真正留下来的"
        title="不只有网络，还有入口和习惯"
        items={[
          {label: '基础设施', detail: '网络承载能力', tone: 'cyan'},
          {label: '大众入口', detail: '个人电脑', tone: 'amber'},
          {label: '使用习惯', detail: '查资料、写文档、上网', tone: 'green'},
        ]}
      />
    </Scene>

    <Scene start={128} end={139}>
      <DualAssetStage
        eyebrow="FROM INTERNET TO AI · 同一套观察框架"
        title="把互联网留下的两层，放到今天的AI"
        leftTitle="基础设施"
        leftDetail="网络 → 芯片、算力中心、数据中心"
        rightTitle="能力入口"
        rightDetail="个人电脑 → 能理解目标的大模型"
      />
    </Scene>

    <Scene start={139} end={147}>
      <OpaqueMediaStage
        index="04"
        eyebrow="LAYER 01 · 算力底座"
        title="AI算力中心"
        facts={[
          {label: '硬件', value: '芯片与服务器', tone: 'cyan'},
          {label: '运行', value: '供电、制冷、网络', tone: 'amber'},
          {label: '属性', value: 'AI生成概念画面', tone: 'white'},
        ]}
        mediaSrc="media/cycle-assets-20260730/04-ai-compute-center-30fps.mp4"
        mediaKind="video"
        mediaLabel="AI生成概念画面 · 不对应具体真实项目"
      />
    </Scene>

    <Scene start={147} end={154}>
      <V7TransparentInfoStack
        eyebrow="LAYER 01 · 算力底座"
        title="已经建下来的能力，不会随名字消失"
        items={[
          {label: '芯片', detail: '计算能力的硬件基础', tone: 'cyan'},
          {label: '算力中心', detail: '规模化运行能力', tone: 'amber'},
          {label: '数据中心', detail: '供电、制冷与网络', tone: 'green'},
        ]}
      />
    </Scene>

    <Scene start={154} end={157}>
      <QingyangEvidenceStage />
    </Scene>

    <Scene start={157} end={162}>
      <NorthwestCapitalStage />
    </Scene>

    <Scene start={162} end={165}>
      <OpaqueMediaStage
        index="06"
        eyebrow="GREEN COMPUTE · 西北方向"
        title="西北绿色算力"
        facts={[
          {label: '能源', value: '光伏与风电', tone: 'green'},
          {label: '设施', value: '数据中心与机房', tone: 'cyan'},
          {label: '边界', value: '不对应具体项目现场', tone: 'amber'},
        ]}
        mediaSrc="media/cycle-assets-20260730/06-green-compute-30fps.mp4"
        mediaKind="video"
        mediaLabel="AI生成概念画面 · 西北绿色算力"
      />
    </Scene>

    <Scene start={165} end={169}>
      <V7ChapterMarker
        index="04"
        eyebrow="LAYER 02 · 大模型"
        title="新的能力入口"
        subtitle="不先背完机器的规则，也能用人话描述目标。"
        tone="amber"
      />
    </Scene>

    <Scene start={169} end={176}>
      <V7TransparentInfoStack
        eyebrow="OLD INTERFACE · 过去先学机器规则"
        title="会用软件，先要记住操作步骤"
        items={[
          {label: '菜单', detail: '先找到功能入口', tone: 'cyan'},
          {label: '按钮', detail: '记住具体操作', tone: 'amber'},
          {label: '步骤', detail: '按机器规则执行', tone: 'red'},
        ]}
      />
    </Scene>

    <Scene start={176} end={184}>
      <OpaqueMediaStage
        index="05"
        eyebrow="NATURAL LANGUAGE · 新入口"
        title="一句人话讲给AI"
        facts={[
          {label: '输入', value: '自然语言目标', tone: 'cyan'},
          {label: '处理', value: '文档、表格、图表', tone: 'amber'},
          {label: '属性', value: 'AI生成概念画面', tone: 'white'},
        ]}
        mediaSrc="media/cycle-assets-20260730/05-natural-language-30fps.mp4"
        mediaKind="video"
        mediaLabel="AI生成概念画面 · 非真实软件界面"
      />
    </Scene>

    <Scene start={184} end={198}>
      <LeftProcessGrid
        eyebrow="THE SHIFT · 机器开始理解人的目标"
        title="先说人话，再让AI组织数字能力"
        steps={[
          {label: '表达目标', detail: '一句人话', tone: 'cyan'},
          {label: 'AI理解', detail: '拆解步骤', tone: 'amber'},
          {label: '调用工具', detail: '文档、表格、图表', tone: 'green'},
          {label: '形成初稿', detail: '回到人来判断', tone: 'cyan'},
        ].map((step) => ({
          ...step,
          tone: colors[step.tone as keyof typeof colors],
        })) as [LeftProcessStep, LeftProcessStep, LeftProcessStep, LeftProcessStep]}
      />
    </Scene>

    <Scene start={198} end={211}>
      <DualAssetStage
        eyebrow="AI ERA · 时代留下的两类资产"
        title="一层是底座，一层是入口"
        leftTitle="算力底座"
        leftDetail="芯片、算力中心、数据中心"
        rightTitle="能力入口"
        rightDetail="大模型理解目标、组织工具"
      />
    </Scene>

    <Scene start={211} end={225}>
      <V7TruthStatement
        eyebrow="PUBLIC CAPABILITY · 时代公共能力"
        left="同一个模型"
        right="同样的结果"
        note="算力会更便宜，模型会更普及；真正的差异要从真实场景里产生。"
      />
    </Scene>

    <Scene start={225} end={239}>
      <V7HeroMetric
        eyebrow="WHY DIFFERENT · 同一模型，不同结果"
        value="2"
        suffix="样东西"
        caption="差别不只在提示词"
        facts={['进场资格', '验收证据']}
        tone="cyan"
      />
    </Scene>

    <Scene start={239} end={257}>
      <DualAssetStage
        eyebrow="ASSET 01 · 进场资格"
        title="别人为什么愿意把真实问题交给你"
        leftTitle="企业现场"
        leftDetail="客户流失、团队卡点、过去试过什么"
        rightTitle="设计现场"
        rightDetail="未成形灵感、废稿、预算与顾虑"
      />
    </Scene>

    <Scene start={257} end={271}>
      <BranchContextStage />
    </Scene>

    <Scene start={271} end={284}>
      <V7ChapterMarker
        index="05"
        eyebrow="ASSET 02 · 验收证据"
        title="生成出来，不等于解决问题"
        subtitle="页面有没有人用、图片能不能交付、方案到底解决了谁的问题，都要回现场验证。"
        tone="amber"
      />
    </Scene>

    <Scene start={284} end={304}>
      <LeftProcessGrid
        eyebrow="REAL VALIDATION · 被现实检验"
        title="把结果拿回现场，走完这条链"
        steps={[
          {label: '生成', detail: '页面、图片、方案', tone: 'cyan'},
          {label: '使用', detail: '谁真的拿去用', tone: 'amber'},
          {label: '失败与修改', detail: '哪里卡住、为什么改', tone: 'red'},
          {label: '真实验收', detail: '谁确认、什么算通过', tone: 'green'},
        ].map((step) => ({
          ...step,
          tone: colors[step.tone as keyof typeof colors],
        })) as [LeftProcessStep, LeftProcessStep, LeftProcessStep, LeftProcessStep]}
      />
    </Scene>

    <Scene start={304} end={318}>
      <KnowledgeContainerStage />
    </Scene>

    <Scene start={318} end={328}>
      <DualAssetStage
        eyebrow="WHAT THE ERA KEEPS · 时代留下两样"
        title="公共能力会越来越强"
        leftTitle="算力底座"
        leftDetail="更强、更便宜、更普及"
        rightTitle="能力入口"
        rightDetail="更自然地理解人的目标"
      />
    </Scene>

    <Scene start={328} end={336}>
      <DualAssetStage
        eyebrow="WHAT YOU KEEP · 普通人留下两样"
        title="个人差异来自真实现场"
        leftTitle="进场资格"
        leftDetail="拿到别人没有的上下文"
        rightTitle="验收证据"
        rightDetail="留下被现实确认的判断"
      />
    </Scene>

    <Scene start={336} end={353}>
      <ChecklistStage />
    </Scene>

    <Scene start={353} end={363}>
      <DurableContextStage />
    </Scene>

    <Scene start={363} end={376}>
      <V7TransparentInfoStack
        eyebrow="PERSONAL CONTEXT · AI越用越像你"
        title="真正穿越周期的是你的连续记录"
        items={[
          {label: '进过什么现场', detail: '别人拿不到的真实上下文', tone: 'cyan'},
          {label: '做过和错过什么', detail: '行动过程与失败', tone: 'amber'},
          {label: '被谁验收过', detail: '现实确认的证据', tone: 'green'},
        ]}
      />
    </Scene>

    <Scene start={376} end={378.75}>
      <V7ChapterMarker
        index="06"
        eyebrow="FOLLOW · 超哥AI创业记"
        title="在兰州，把AI落到真实现场"
        subtitle="模型会换，真实经验和验收证据会留下。"
      />
    </Scene>
  </AbsoluteFill>
);

type SfxCue = {
  time: number;
  file:
    | 'section-sweep.wav'
    | 'card-slide.wav'
    | 'number-affirmation.wav'
    | 'node-select.wav'
    | 'ui-click.wav'
    | 'evidence-shutter.wav'
    | 'keyword-select.wav'
    | 'zoom-out.wav';
  volume: number;
};

const sfxCues: SfxCue[] = [
  {time: 0.15, file: 'section-sweep.wav', volume: 0.15},
  {time: 10, file: 'card-slide.wav', volume: 0.18},
  {time: 18, file: 'section-sweep.wav', volume: 0.14},
  {time: 21, file: 'evidence-shutter.wav', volume: 0.16},
  {time: 35, file: 'number-affirmation.wav', volume: 0.22},
  {time: 44, file: 'keyword-select.wav', volume: 0.14},
  {time: 54, file: 'card-slide.wav', volume: 0.18},
  {time: 72, file: 'zoom-out.wav', volume: 0.18},
  {time: 78, file: 'section-sweep.wav', volume: 0.15},
  {time: 92, file: 'card-slide.wav', volume: 0.17},
  {time: 96, file: 'node-select.wav', volume: 0.09},
  {time: 101, file: 'node-select.wav', volume: 0.09},
  {time: 107, file: 'card-slide.wav', volume: 0.17},
  {time: 128, file: 'section-sweep.wav', volume: 0.15},
  {time: 139, file: 'card-slide.wav', volume: 0.18},
  {time: 154, file: 'evidence-shutter.wav', volume: 0.17},
  {time: 157, file: 'number-affirmation.wav', volume: 0.23},
  {time: 162, file: 'evidence-shutter.wav', volume: 0.16},
  {time: 165, file: 'section-sweep.wav', volume: 0.15},
  {time: 169, file: 'card-slide.wav', volume: 0.18},
  {time: 176, file: 'evidence-shutter.wav', volume: 0.16},
  {time: 184, file: 'card-slide.wav', volume: 0.18},
  {time: 190, file: 'node-select.wav', volume: 0.09},
  {time: 198, file: 'section-sweep.wav', volume: 0.15},
  {time: 211, file: 'keyword-select.wav', volume: 0.13},
  {time: 225, file: 'number-affirmation.wav', volume: 0.21},
  {time: 239, file: 'section-sweep.wav', volume: 0.15},
  {time: 257, file: 'node-select.wav', volume: 0.1},
  {time: 271, file: 'section-sweep.wav', volume: 0.15},
  {time: 284, file: 'card-slide.wav', volume: 0.18},
  {time: 291, file: 'node-select.wav', volume: 0.09},
  {time: 298, file: 'number-affirmation.wav', volume: 0.2},
  {time: 304, file: 'ui-click.wav', volume: 0.11},
  {time: 318, file: 'section-sweep.wav', volume: 0.15},
  {time: 328, file: 'card-slide.wav', volume: 0.17},
  {time: 336, file: 'ui-click.wav', volume: 0.11},
  {time: 345, file: 'ui-click.wav', volume: 0.11},
  {time: 353, file: 'zoom-out.wav', volume: 0.18},
  {time: 363, file: 'keyword-select.wav', volume: 0.13},
  {time: 376, file: 'section-sweep.wav', volume: 0.15},
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

const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const progress =
    (frame / Math.max(1, CYCLE_ASSETS_DURATION_IN_FRAMES - 1)) * 100;

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
          left: 54,
          right: 54,
          bottom: 20,
          height: 3,
          background: 'rgba(255,255,255,0.14)',
          zIndex: 280,
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.amber})`,
            boxShadow: '0 0 14px rgba(98,216,255,0.65)',
          }}
        />
      </div>
    </>
  );
};

const Program: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <AbsoluteFill style={{background: colors.dark, overflow: 'hidden'}}>
    <LocalFont />
    <TalkFootage />
    <Scenes />
    {soundEnabled ? <SemanticSfx /> : null}
    <Hud />
    <AdaptiveBilingualCaptionOverlay captionsSrc="data/CYCLE_ASSETS_20260730_talk01.bilingual.v1.json" />
  </AbsoluteFill>
);

export const CycleAssetsV72Talk16x9WithSfx: React.FC = () => (
  <Program soundEnabled />
);

export const CycleAssetsV72Talk16x9NoSfx: React.FC = () => (
  <Program soundEnabled={false} />
);
