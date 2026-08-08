import {Audio} from '@remotion/media';
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
} from 'remotion';
import {LocalFont} from './components/LocalFont';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);

export const AI_SELF_MEDIA_ASSET_PREFLIGHT_DURATION_IN_FRAMES = f(100);

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

const colors = {
  bg: '#070B10',
  panel: 'rgba(12, 18, 25, 0.88)',
  panelSoft: 'rgba(18, 25, 33, 0.70)',
  line: 'rgba(255,255,255,0.15)',
  ink: '#F7FAFC',
  muted: '#AAB5C0',
  cyan: '#62D8FF',
  amber: '#FFBE55',
  green: '#67D8A0',
  red: '#FF7068',
};

type Accent = 'cyan' | 'amber' | 'green' | 'red';

const sceneOpacity = (frame: number, durationFrames: number) =>
  Math.min(
    interpolate(frame, [0, 8], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(8, durationFrames - 8), durationFrames],
      [1, 0],
      clamp,
    ),
  );

const enter = (frame: number, delay = 0) =>
  spring({
    frame: frame - delay,
    fps,
    config: {damping: 20, stiffness: 175, mass: 0.82},
  });

const enterStyle = (
  frame: number,
  delay = 0,
  offset = 22,
): React.CSSProperties => {
  const progress = enter(frame, delay);
  return {
    opacity: progress,
    transform: `translate3d(0, ${interpolate(progress, [0, 1], [offset, 0])}px, 0)`,
  };
};

const SceneShell: React.FC<{
  index: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  durationFrames: number;
  children: React.ReactNode;
}> = ({index, eyebrow, title, subtitle, durationFrames, children}) => {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, durationFrames);
  const titleIn = enter(frame, 2);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.032) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.032) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        color: colors.ink,
        fontFamily,
        opacity,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(5,10,15,0.18), rgba(5,10,15,0.70))',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 56,
          top: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 19,
          fontWeight: 900,
          zIndex: 30,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            background: colors.cyan,
            boxShadow: `0 0 16px ${colors.cyan}`,
          }}
        />
        超哥AI创业记
      </div>

      <div
        style={{
          position: 'absolute',
          right: 56,
          top: 30,
          color: 'rgba(247,250,252,0.64)',
          fontSize: 17,
          fontWeight: 850,
          zIndex: 30,
        }}
      >
        AI + 自媒体低成本实验
      </div>

      <div
        style={{
          position: 'absolute',
          left: 72,
          right: 72,
          top: 88,
          display: 'grid',
          gridTemplateColumns: '110px 1fr',
          gap: 24,
          alignItems: 'start',
          zIndex: 20,
          opacity: titleIn,
          transform: `translateY(${interpolate(titleIn, [0, 1], [18, 0])}px)`,
        }}
      >
        <div
          style={{
            color: colors.cyan,
            fontSize: 74,
            lineHeight: 0.9,
            fontWeight: 950,
          }}
        >
          {index}
        </div>
        <div>
          <div
            style={{
              color: colors.cyan,
              fontSize: 17,
              lineHeight: 1,
              fontWeight: 950,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 48,
              lineHeight: 1.08,
              fontWeight: 950,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                marginTop: 9,
                color: colors.muted,
                fontSize: 22,
                lineHeight: 1.25,
                fontWeight: 820,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{position: 'absolute', inset: 0, zIndex: 10}}>{children}</div>

      <div
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          bottom: 24,
          height: 3,
          background: 'rgba(255,255,255,0.12)',
          zIndex: 40,
        }}
      >
        <div
          style={{
            width: `${interpolate(frame, [0, durationFrames], [0, 100], clamp)}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.amber})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const Tag: React.FC<{label: string; accent?: Accent}> = ({
  label,
  accent = 'cyan',
}) => (
  <div
    style={{
      minHeight: 44,
      padding: '0 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      border: `1px solid ${colors[accent]}99`,
      background: `${colors[accent]}16`,
      color: colors[accent],
      fontSize: 19,
      fontWeight: 900,
    }}
  >
    {label}
  </div>
);

export const SelfMediaHookFrictionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const items: Array<{label: string; detail: string; accent: Accent}> = [
    {label: '资源', detail: '觉得要先有条件', accent: 'amber'},
    {label: '团队', detail: '觉得一个人做不了', accent: 'red'},
    {label: '拍摄', detail: '觉得设备还不够', accent: 'cyan'},
    {label: '出镜', detail: '怕表达不自然', accent: 'amber'},
    {label: '剪辑', detail: '想到流程就放弃', accent: 'red'},
  ];

  return (
    <SceneShell
      index="01"
      eyebrow="THE FIRST MISUNDERSTANDING · 第一个误区"
      title="很多人迟迟没开始，先怪设备和资源"
      subtitle="真正需要先看懂的，是平台为什么需要创作者。"
      durationFrames={f(6)}
    >
      <div
        style={{
          position: 'absolute',
          left: 82,
          right: 82,
          top: 380,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 18,
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.label}
            style={{
              ...enterStyle(frame, 8 + index * 8),
              height: 245,
              padding: '28px 24px',
              boxSizing: 'border-box',
              background: colors.panel,
              borderTop: `4px solid ${colors[item.accent]}`,
              borderLeft: `1px solid ${colors[item.accent]}66`,
              borderRight: `1px solid ${colors[item.accent]}33`,
              borderBottom: `1px solid ${colors[item.accent]}33`,
              borderRadius: 6,
            }}
          >
            <div
              style={{
                color: colors[item.accent],
                fontSize: 18,
                fontWeight: 950,
              }}
            >
              0{index + 1}
            </div>
            <div
              style={{
                marginTop: 28,
                color: colors.ink,
                fontSize: 40,
                fontWeight: 950,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                marginTop: 17,
                color: colors.muted,
                fontSize: 21,
                lineHeight: 1.3,
                fontWeight: 820,
              }}
            >
              {item.detail}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          ...enterStyle(frame, 54, 15),
          position: 'absolute',
          left: 430,
          right: 430,
          top: 704,
          padding: '18px 28px',
          borderLeft: `5px solid ${colors.cyan}`,
          background: 'rgba(98,216,255,0.10)',
          color: colors.ink,
          fontSize: 31,
          fontWeight: 950,
          textAlign: 'center',
        }}
      >
        不是没设备，是还没看懂闭环
      </div>
    </SceneShell>
  );
};

export const SelfMediaPlatformFlywheelScene: React.FC = () => {
  const frame = useCurrentFrame();
  const nodes: Array<{label: string; detail: string; accent: Accent}> = [
    {label: '创作者内容', detail: '持续供给', accent: 'cyan'},
    {label: '用户停留', detail: '愿意继续看', accent: 'green'},
    {label: '商家广告', detail: '购买触达', accent: 'amber'},
    {label: '平台收入', detail: '广告 + 订阅', accent: 'cyan'},
    {label: '创作者收益', detail: '符合条件后分配', accent: 'green'},
  ];
  const active = Math.floor(frame / 28) % nodes.length;
  const returnProgress = interpolate(frame, [55, 175], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <SceneShell
      index="02"
      eyebrow="CREATOR ECONOMY · 创作者经济"
      title="平台自己不生产全部内容，它搭的是一个循环"
      subtitle="每一环都有自己的责任，入口不等于自动收益。"
      durationFrames={f(8)}
    >
      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 390,
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {nodes.map((node, index) => {
          const nodeIn = enter(frame, 8 + index * 9);
          const isActive = active === index;
          return (
            <React.Fragment key={node.label}>
              <div
                style={{
                  width: 298,
                  height: 225,
                  padding: '28px 24px',
                  boxSizing: 'border-box',
                  background: isActive
                    ? `${colors[node.accent]}20`
                    : colors.panel,
                  border: `1px solid ${colors[node.accent]}${isActive ? 'FF' : '66'}`,
                  borderTop: `4px solid ${colors[node.accent]}`,
                  borderRadius: 6,
                  opacity: nodeIn,
                  transform: `translateY(${interpolate(nodeIn, [0, 1], [22, 0])}px) scale(${isActive ? 1.025 : 1})`,
                  boxShadow: isActive
                    ? `0 0 34px ${colors[node.accent]}28`
                    : 'none',
                }}
              >
                <div
                  style={{
                    color: colors[node.accent],
                    fontSize: 18,
                    fontWeight: 950,
                  }}
                >
                  0{index + 1}
                </div>
                <div
                  style={{
                    marginTop: 31,
                    color: colors.ink,
                    fontSize: 32,
                    lineHeight: 1.08,
                    fontWeight: 950,
                  }}
                >
                  {node.label}
                </div>
                <div
                  style={{
                    marginTop: 18,
                    color: colors.muted,
                    fontSize: 20,
                    fontWeight: 820,
                  }}
                >
                  {node.detail}
                </div>
              </div>
              {index < nodes.length - 1 ? (
                <div
                  style={{
                    width: 64,
                    height: 225,
                    position: 'relative',
                    flexShrink: 0,
                    opacity: nodeIn,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 8,
                      right: 10,
                      top: 111,
                      height: 2,
                      background: 'rgba(98,216,255,0.50)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: 105,
                      color: colors.cyan,
                      fontSize: 27,
                      lineHeight: 1,
                    }}
                  >
                    ›
                  </div>
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 100,
          right: 100,
          top: 700,
          height: 82,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 20,
            width: `${returnProgress * 100}%`,
            height: 3,
            background: `linear-gradient(90deg, ${colors.green}, ${colors.cyan})`,
            boxShadow: '0 0 18px rgba(98,216,255,0.38)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            color: colors.green,
            fontSize: 22,
            fontWeight: 900,
          }}
        >
          收益进入下一轮内容供给 ↩
        </div>
      </div>
    </SceneShell>
  );
};

export const SelfMediaYouTubeEvidenceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const metricIn = enter(frame, 4);
  const imageIn = enter(frame, 12);
  const zoom = interpolate(frame, [0, f(8)], [1.13, 1.22], clamp);

  return (
    <SceneShell
      index="03"
      eyebrow="OFFICIAL EVIDENCE · 官方证据"
      title="过去四年，支付超过 1000 亿美元"
      subtitle="对象包括创作者、艺术家和媒体公司。"
      durationFrames={f(8)}
    >
      <div
        style={{
          position: 'absolute',
          left: 76,
          top: 350,
          width: 470,
          height: 470,
          padding: '36px 34px',
          boxSizing: 'border-box',
          background: colors.panel,
          borderLeft: `5px solid ${colors.amber}`,
          borderTop: `1px solid ${colors.amber}88`,
          borderRight: `1px solid ${colors.amber}44`,
          borderBottom: `1px solid ${colors.amber}44`,
          opacity: metricIn,
          transform: `translateX(${interpolate(metricIn, [0, 1], [-28, 0])}px)`,
        }}
      >
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          YOUTUBE · 2026 CEO 公开信
        </div>
        <div
          style={{
            marginTop: 44,
            color: colors.amber,
            fontSize: 104,
            lineHeight: 0.92,
            fontWeight: 950,
          }}
        >
          1000亿+
        </div>
        <div
          style={{
            marginTop: 20,
            color: colors.ink,
            fontSize: 35,
            lineHeight: 1.2,
            fontWeight: 950,
          }}
        >
          美元
        </div>
        <div
          style={{
            marginTop: 28,
            color: colors.muted,
            fontSize: 23,
            lineHeight: 1.4,
            fontWeight: 820,
          }}
        >
          过去四年
          <br />
          创作者 · 艺术家 · 媒体公司
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 600,
          top: 310,
          width: 1240,
          height: 600,
          overflow: 'hidden',
          background: '#FFFFFF',
          border: `1px solid ${colors.cyan}99`,
          boxShadow: '0 22px 70px rgba(0,0,0,0.46)',
          opacity: imageIn,
          transform: `translateY(${interpolate(imageIn, [0, 1], [22, 0])}px)`,
        }}
      >
        <Img
          src={staticFile('screenshots/20260808_youtube_creator_payout_100b.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '84% 67%',
            transform: `scale(${zoom})`,
            transformOrigin: '83% 68%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 24,
            bottom: 20,
            padding: '8px 12px',
            color: colors.ink,
            background: 'rgba(4,9,14,0.82)',
            border: '1px solid rgba(255,255,255,0.16)',
            fontSize: 16,
            fontWeight: 850,
          }}
        >
          来源：YouTube 官方博客 · 抓取日期 2026-08-08
        </div>
      </div>

      <div
        style={{
          ...enterStyle(frame, 42, 10),
          position: 'absolute',
          left: 88,
          top: 835,
          color: colors.red,
          fontSize: 19,
          fontWeight: 900,
        }}
      >
        这组数字不能推出普通创作者的平均或稳定收入
      </div>
    </SceneShell>
  );
};

export const SelfMediaAlphabetMetricScene: React.FC = () => {
  const frame = useCurrentFrame();
  const metricIn = enter(frame, 4);
  const splitIn = enter(frame, 18);

  return (
    <SceneShell
      index="04"
      eyebrow="PLATFORM REVENUE · 平台收入口径"
      title="YouTube 广告 + 订阅年收入超过 600 亿美元"
      subtitle="Alphabet 2025 Q4 Earnings Call；只用文字来源卡，不仿造网页截图。"
      durationFrames={f(7)}
    >
      <div
        style={{
          position: 'absolute',
          left: 115,
          right: 115,
          top: 340,
          height: 470,
          display: 'grid',
          gridTemplateColumns: '0.95fr 1.05fr',
          gap: 36,
        }}
      >
        <div
          style={{
            padding: '36px 42px',
            boxSizing: 'border-box',
            background: colors.panel,
            borderLeft: `6px solid ${colors.amber}`,
            borderTop: `1px solid ${colors.amber}77`,
            borderRight: `1px solid ${colors.amber}33`,
            borderBottom: `1px solid ${colors.amber}33`,
            opacity: metricIn,
            transform: `translateY(${interpolate(metricIn, [0, 1], [26, 0])}px)`,
          }}
        >
          <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
            2025 年全年口径
          </div>
          <div
            style={{
              marginTop: 48,
              color: colors.amber,
              fontSize: 128,
              lineHeight: 0.9,
              fontWeight: 950,
            }}
          >
            600亿+
          </div>
          <div
            style={{
              marginTop: 19,
              color: colors.ink,
              fontSize: 37,
              fontWeight: 950,
            }}
          >
            美元年收入
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateRows: '1fr 1fr auto',
            gap: 18,
            opacity: splitIn,
            transform: `translateX(${interpolate(splitIn, [0, 1], [28, 0])}px)`,
          }}
        >
          {[
            {label: '广告', detail: '商家为触达用户付费', accent: 'cyan' as Accent},
            {label: '订阅', detail: '用户为服务持续付费', accent: 'green' as Accent},
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: '28px 32px',
                boxSizing: 'border-box',
                background: colors.panelSoft,
                borderLeft: `5px solid ${colors[item.accent]}`,
                borderTop: `1px solid ${colors[item.accent]}55`,
              }}
            >
              <div
                style={{
                  color: colors[item.accent],
                  fontSize: 34,
                  fontWeight: 950,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  marginTop: 13,
                  color: colors.muted,
                  fontSize: 23,
                  fontWeight: 820,
                }}
              >
                {item.detail}
              </div>
            </div>
          ))}
          <div
            style={{
              padding: '20px 28px',
              background: 'rgba(255,112,104,0.12)',
              border: `1px solid ${colors.red}88`,
              color: colors.ink,
              fontSize: 28,
              fontWeight: 950,
              textAlign: 'center',
            }}
          >
            平台总收入 ≠ 个人收入
          </div>
        </div>
      </div>
    </SceneShell>
  );
};

export const SelfMediaDouyinChannelsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const channels: Array<{label: string; detail: string; accent: Accent}> = [
    {label: '内容激励', detail: '符合条件的内容计划', accent: 'cyan'},
    {label: '商业合作', detail: '星图等平台内合作', accent: 'amber'},
    {label: '商品交易', detail: '橱窗、短视频、直播', accent: 'green'},
    {label: '任务奖励', detail: '以当前后台为准', accent: 'red'},
  ];
  const secondImage = interpolate(frame, [130, 160], [0, 1], clamp);

  return (
    <SceneShell
      index="05"
      eyebrow="DOUYIN ROUTES · 抖音相关入口"
      title="入口很多，但没有一个是躺赚按钮"
      subtitle="把动态计划归为四类，具体开通条件逐项核验。"
      durationFrames={f(10)}
    >
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 320,
          width: 430,
          display: 'grid',
          gap: 14,
        }}
      >
        {channels.map((channel, index) => (
          <div
            key={channel.label}
            style={{
              ...enterStyle(frame, 6 + index * 9, 14),
              minHeight: 108,
              padding: '19px 22px',
              boxSizing: 'border-box',
              background: colors.panel,
              borderLeft: `5px solid ${colors[channel.accent]}`,
              borderTop: `1px solid ${colors[channel.accent]}55`,
            }}
          >
            <div
              style={{
                color: colors[channel.accent],
                fontSize: 24,
                fontWeight: 950,
              }}
            >
              {channel.label}
            </div>
            <div
              style={{
                marginTop: 8,
                color: colors.muted,
                fontSize: 18,
                fontWeight: 820,
              }}
            >
              {channel.detail}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 550,
          top: 295,
          width: 1290,
          height: 650,
          overflow: 'hidden',
          background: '#F7F9FB',
          border: `1px solid ${colors.cyan}99`,
          boxShadow: '0 24px 72px rgba(0,0,0,0.48)',
        }}
      >
        <Img
          src={staticFile('screenshots/20260808_xingtu_creator_entry.png')}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '74% 51%',
            opacity: 1 - secondImage,
            transform: 'scale(1.03)',
          }}
        />
        <Img
          src={staticFile('screenshots/20260808_douyin_ec_creator_path.png')}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 51%',
            opacity: secondImage,
            transform: `scale(${interpolate(frame, [130, f(10)], [1.02, 1.08], clamp)})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 18,
            bottom: 92,
            padding: '7px 11px',
            background: 'rgba(4,9,14,0.78)',
            color: colors.ink,
            fontSize: 16,
            fontWeight: 850,
          }}
        >
          {secondImage < 0.5 ? '来源：巨量星图帮助中心' : '来源：抖音电商达人公开页'}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 560,
          right: 90,
          top: 865,
          padding: '16px 22px',
          background: 'rgba(4,9,14,0.92)',
          borderLeft: `5px solid ${colors.amber}`,
          color: colors.ink,
          fontSize: 21,
          fontWeight: 900,
          textAlign: 'center',
          boxShadow: '0 10px 28px rgba(0,0,0,0.30)',
        }}
      >
        具体开通条件、账号状态和结算规则，以当前官方页面与账号后台为准
      </div>
    </SceneShell>
  );
};

export const SelfMediaContentCostScene: React.FC = () => {
  const frame = useCurrentFrame();
  const stages = ['选题', '资料', '文案', '拍摄', '剪辑', '封面', '复盘'];
  const active = Math.min(stages.length - 1, Math.floor(frame / 25));
  const rail = interpolate(frame, [8, 145], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <SceneShell
      index="06"
      eyebrow="CONTENT COST · 内容生产成本"
      title="过去，一个人要同时扛住七个环节"
      subtitle="任何一环停住，连续发布就会中断。"
      durationFrames={f(8)}
    >
      <div
        style={{
          position: 'absolute',
          left: 120,
          right: 120,
          top: 430,
          height: 4,
          background: 'rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            width: `${rail * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.red})`,
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 90,
          right: 90,
          top: 370,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 16,
        }}
      >
        {stages.map((stage, index) => {
          const itemIn = enter(frame, 8 + index * 8);
          const passed = index < active;
          const isActive = index === active;
          const accent: Accent = passed ? 'green' : isActive ? 'red' : 'cyan';
          return (
            <div
              key={stage}
              style={{
                height: 250,
                padding: '26px 18px',
                boxSizing: 'border-box',
                background: isActive ? 'rgba(255,112,104,0.14)' : colors.panel,
                border: `1px solid ${colors[accent]}88`,
                borderTop: `4px solid ${colors[accent]}`,
                borderRadius: 6,
                opacity: itemIn,
                transform: `translateY(${interpolate(itemIn, [0, 1], [22, 0])}px)`,
              }}
            >
              <div style={{color: colors[accent], fontSize: 17, fontWeight: 950}}>
                {String(index + 1).padStart(2, '0')}
              </div>
              <div
                style={{
                  marginTop: 42,
                  color: colors.ink,
                  fontSize: 35,
                  fontWeight: 950,
                  textAlign: 'center',
                }}
              >
                {stage}
              </div>
              <div
                style={{
                  marginTop: 28,
                  color: colors[accent],
                  fontSize: 18,
                  fontWeight: 900,
                  textAlign: 'center',
                }}
              >
                {passed ? '已处理' : isActive ? '可能卡住' : '等待'}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          ...enterStyle(frame, 66, 14),
          position: 'absolute',
          left: 450,
          right: 450,
          top: 720,
          padding: '18px 28px',
          color: colors.ink,
          background: 'rgba(255,112,104,0.12)',
          border: `1px solid ${colors.red}88`,
          fontSize: 30,
          fontWeight: 950,
          textAlign: 'center',
        }}
      >
        内容生产太贵，很多人还没发布就停了
      </div>
    </SceneShell>
  );
};

export const SelfMediaAIWorkflowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const columns: Array<{
    eyebrow: string;
    title: string;
    items: string[];
    accent: Accent;
  }> = [
    {
      eyebrow: 'YOUR INPUT',
      title: '你的输入',
      items: ['具体问题', '真实经验', '想表达的判断'],
      accent: 'amber',
    },
    {
      eyebrow: 'AI ASSIST',
      title: 'AI 辅助',
      items: ['整理逻辑', '拆选题', '脚本提纲', '封面思路', '评论复盘'],
      accent: 'cyan',
    },
    {
      eyebrow: 'REAL CHECK',
      title: '真实验证',
      items: ['本人拍摄', '公开发布', '看反馈', '继续修改'],
      accent: 'green',
    },
  ];
  const bead = interpolate(frame % 75, [0, 74], [0, 1], clamp);

  return (
    <SceneShell
      index="07"
      eyebrow="HUMAN + AI WORKFLOW · 人与AI协作"
      title="AI 可以处理任务，但不能替你完成验证"
      subtitle="输入来自你，发布、反馈和责任也仍然属于你。"
      durationFrames={f(8)}
    >
      <div
        style={{
          position: 'absolute',
          left: 100,
          right: 100,
          top: 320,
          display: 'grid',
          gridTemplateColumns: '1fr 90px 1fr 90px 1fr',
          alignItems: 'stretch',
        }}
      >
        {columns.map((column, index) => (
          <React.Fragment key={column.title}>
            <div
              style={{
                ...enterStyle(frame, 5 + index * 12),
                minHeight: 430,
                padding: '28px 30px',
                boxSizing: 'border-box',
                background: colors.panel,
                borderLeft: `5px solid ${colors[column.accent]}`,
                borderTop: `1px solid ${colors[column.accent]}66`,
                borderRight: `1px solid ${colors[column.accent]}33`,
                borderBottom: `1px solid ${colors[column.accent]}33`,
              }}
            >
              <div
                style={{
                  color: colors[column.accent],
                  fontSize: 16,
                  fontWeight: 950,
                }}
              >
                {column.eyebrow}
              </div>
              <div
                style={{
                  marginTop: 15,
                  color: colors.ink,
                  fontSize: 39,
                  fontWeight: 950,
                }}
              >
                {column.title}
              </div>
              <div style={{marginTop: 30, display: 'grid', gap: 12}}>
                {column.items.map((item, itemIndex) => (
                  <div
                    key={item}
                    style={{
                      ...enterStyle(frame, 17 + index * 10 + itemIndex * 5, 10),
                      minHeight: 47,
                      padding: '0 15px',
                      display: 'flex',
                      alignItems: 'center',
                      background: `${colors[column.accent]}12`,
                      borderLeft: `3px solid ${colors[column.accent]}`,
                      color: colors.ink,
                      fontSize: 21,
                      fontWeight: 880,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
            {index < columns.length - 1 ? (
              <div style={{position: 'relative', minHeight: 430}}>
                <div
                  style={{
                    position: 'absolute',
                    left: 12,
                    right: 12,
                    top: 214,
                    height: 2,
                    background: 'rgba(98,216,255,0.48)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 12 + bead * 56,
                    top: 209,
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    background: colors.cyan,
                    boxShadow: `0 0 16px ${colors.cyan}`,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: 202,
                    color: colors.cyan,
                    fontSize: 29,
                  }}
                >
                  ›
                </div>
              </div>
            ) : null}
          </React.Fragment>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 395,
          right: 395,
          top: 800,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        {['图文', '录屏', '字幕口播', '知识卡片'].map((item, index) => (
          <div key={item} style={enterStyle(frame, 65 + index * 6, 10)}>
            <Tag label={item} accent={index % 2 === 0 ? 'cyan' : 'amber'} />
          </div>
        ))}
      </div>
    </SceneShell>
  );
};

export const SelfMediaAITruthScene: React.FC = () => {
  const frame = useCurrentFrame();
  const leftIn = enter(frame, 2);
  const rightIn = enter(frame, 18);

  return (
    <SceneShell
      index="08"
      eyebrow="CORE JUDGMENT · 核心判断"
      title="AI 不是替你赚钱，是替你降低试错成本"
      subtitle="工具能力和真实结果之间，仍然隔着你的行动。"
      durationFrames={f(8)}
    >
      <div
        style={{
          position: 'absolute',
          left: 130,
          right: 130,
          top: 345,
          display: 'grid',
          gridTemplateColumns: '1fr 115px 1fr',
          alignItems: 'stretch',
          gap: 24,
        }}
      >
        <div
          style={{
            minHeight: 330,
            padding: '40px 44px',
            boxSizing: 'border-box',
            background: 'rgba(255,112,104,0.12)',
            border: `1px solid ${colors.red}99`,
            borderTop: `5px solid ${colors.red}`,
            opacity: leftIn,
            transform: `translateX(${interpolate(leftIn, [0, 1], [-28, 0])}px)`,
          }}
        >
          <div style={{color: colors.red, fontSize: 18, fontWeight: 950}}>
            AI 不是
          </div>
          <div
            style={{
              marginTop: 72,
              color: colors.ink,
              fontSize: 58,
              lineHeight: 1.08,
              fontWeight: 950,
              textAlign: 'center',
            }}
          >
            替你赚钱
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.amber,
            fontSize: 92,
            fontWeight: 950,
          }}
        >
          →
        </div>

        <div
          style={{
            minHeight: 330,
            padding: '40px 44px',
            boxSizing: 'border-box',
            background: 'rgba(103,216,160,0.12)',
            border: `1px solid ${colors.green}99`,
            borderTop: `5px solid ${colors.green}`,
            opacity: rightIn,
            transform: `translateX(${interpolate(rightIn, [0, 1], [28, 0])}px)`,
          }}
        >
          <div style={{color: colors.green, fontSize: 18, fontWeight: 950}}>
            AI 可以
          </div>
          <div
            style={{
              marginTop: 72,
              color: colors.ink,
              fontSize: 58,
              lineHeight: 1.08,
              fontWeight: 950,
              textAlign: 'center',
            }}
          >
            降低试错成本
          </div>
        </div>
      </div>

      <div
        style={{
          ...enterStyle(frame, 58, 14),
          position: 'absolute',
          left: 325,
          right: 325,
          top: 745,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        {['讲清问题', '展示工具', '持续记录', '接受反馈'].map((item, index) => (
          <Tag
            key={item}
            label={item}
            accent={index === 3 ? 'green' : index === 0 ? 'amber' : 'cyan'}
          />
        ))}
      </div>
    </SceneShell>
  );
};

export const SelfMediaThirtyPostScene: React.FC = () => {
  const frame = useCurrentFrame();
  const steps: Array<{title: string; detail: string; accent: Accent}> = [
    {title: '选一个人群', detail: '长期观察', accent: 'cyan'},
    {title: '只解一个问题', detail: '具体可用', accent: 'amber'},
    {title: 'AI 降低成本', detail: '选题到复盘', accent: 'green'},
    {title: '看真实反馈', detail: '发布后校准', accent: 'red'},
  ];
  const line = interpolate(frame, [15, 150], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <SceneShell
      index="09"
      eyebrow="30-POST EXPERIMENT · 30条内容实验"
      title="先跑一个小闭环，再谈变现"
      subtitle="30 条是本条建议的实验样本，不是平台规则和结果保证。"
      durationFrames={f(10)}
    >
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 340,
          width: 390,
          height: 470,
          padding: '32px 30px',
          boxSizing: 'border-box',
          background: colors.panel,
          borderLeft: `6px solid ${colors.amber}`,
          borderTop: `1px solid ${colors.amber}66`,
        }}
      >
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 950}}>
          MINIMUM LOOP
        </div>
        <div
          style={{
            marginTop: 55,
            color: colors.amber,
            fontSize: 176,
            lineHeight: 0.82,
            fontWeight: 950,
            textAlign: 'center',
          }}
        >
          30
        </div>
        <div
          style={{
            marginTop: 25,
            color: colors.ink,
            fontSize: 40,
            fontWeight: 950,
            textAlign: 'center',
          }}
        >
          条内容
        </div>
        <div
          style={{
            marginTop: 33,
            color: colors.muted,
            fontSize: 20,
            lineHeight: 1.35,
            fontWeight: 820,
            textAlign: 'center',
          }}
        >
          用数量换真实样本
          <br />
          不用数量替代质量
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 545,
          right: 90,
          top: 395,
          height: 4,
          background: 'rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            width: `${line * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.green})`,
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 520,
          right: 70,
          top: 340,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {steps.map((step, index) => (
          <div
            key={step.title}
            style={{
              ...enterStyle(frame, 12 + index * 12),
              height: 330,
              padding: '27px 23px',
              boxSizing: 'border-box',
              background: colors.panel,
              borderTop: `4px solid ${colors[step.accent]}`,
              borderLeft: `1px solid ${colors[step.accent]}66`,
              borderRight: `1px solid ${colors[step.accent]}33`,
              borderBottom: `1px solid ${colors[step.accent]}33`,
              borderRadius: 6,
            }}
          >
            <div
              style={{
                color: colors[step.accent],
                fontSize: 18,
                fontWeight: 950,
              }}
            >
              STEP 0{index + 1}
            </div>
            <div
              style={{
                marginTop: 65,
                color: colors.ink,
                fontSize: 32,
                lineHeight: 1.1,
                fontWeight: 950,
                textAlign: 'center',
              }}
            >
              {step.title}
            </div>
            <div
              style={{
                marginTop: 25,
                color: colors.muted,
                fontSize: 22,
                fontWeight: 820,
                textAlign: 'center',
              }}
            >
              {step.detail}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          ...enterStyle(frame, 85, 12),
          position: 'absolute',
          left: 640,
          right: 190,
          top: 730,
          padding: '17px 24px',
          background: 'rgba(103,216,160,0.11)',
          borderLeft: `5px solid ${colors.green}`,
          color: colors.ink,
          fontSize: 27,
          fontWeight: 950,
          textAlign: 'center',
        }}
      >
        每条只解决一个具体问题
      </div>
    </SceneShell>
  );
};

export const SelfMediaFeedbackScene: React.FC = () => {
  const frame = useCurrentFrame();
  const signals: Array<{label: string; question: string; accent: Accent}> = [
    {label: '看完', question: '观众愿不愿意听到结尾？', accent: 'cyan'},
    {label: '收藏', question: '这条内容能不能留下来用？', accent: 'amber'},
    {label: '评论', question: '有没有人说“这个我用得上”？', accent: 'green'},
    {label: '私信', question: '有没有人追问下一步？', accent: 'red'},
  ];

  return (
    <SceneShell
      index="10"
      eyebrow="REAL FEEDBACK · 真实反馈"
      title="别先看收益，先看用户有没有反应"
      subtitle="所有数值都等发布后真实产生，预制画面不填写假数据。"
      durationFrames={f(7)}
    >
      <div
        style={{
          position: 'absolute',
          left: 90,
          right: 90,
          top: 370,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 20,
        }}
      >
        {signals.map((signal, index) => {
          const cardIn = enter(frame, 7 + index * 10);
          const pulse = 0.72 + 0.28 * Math.sin((frame - index * 9) / 12);
          return (
            <div
              key={signal.label}
              style={{
                height: 360,
                padding: '31px 27px',
                boxSizing: 'border-box',
                background: colors.panel,
                borderTop: `5px solid ${colors[signal.accent]}`,
                borderLeft: `1px solid ${colors[signal.accent]}66`,
                borderRight: `1px solid ${colors[signal.accent]}33`,
                borderBottom: `1px solid ${colors[signal.accent]}33`,
                borderRadius: 6,
                opacity: cardIn,
                transform: `translateY(${interpolate(cardIn, [0, 1], [23, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  background: colors[signal.accent],
                  boxShadow: `0 0 ${18 * pulse}px ${colors[signal.accent]}`,
                }}
              />
              <div
                style={{
                  marginTop: 48,
                  color: colors[signal.accent],
                  fontSize: 52,
                  fontWeight: 950,
                }}
              >
                {signal.label}
              </div>
              <div
                style={{
                  marginTop: 30,
                  color: colors.ink,
                  fontSize: 25,
                  lineHeight: 1.36,
                  fontWeight: 850,
                }}
              >
                {signal.question}
              </div>
              <div
                style={{
                  marginTop: 31,
                  color: colors.muted,
                  fontSize: 17,
                  fontWeight: 850,
                }}
              >
                数据待发布后产生
              </div>
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
};

export const SelfMediaDigitalAssetScene: React.FC = () => {
  const frame = useCurrentFrame();
  const nodes: Array<{label: string; accent: Accent}> = [
    {label: '内容', accent: 'cyan'},
    {label: '复盘', accent: 'amber'},
    {label: '案例', accent: 'green'},
    {label: '观点', accent: 'cyan'},
    {label: '方法', accent: 'amber'},
    {label: '失败记录', accent: 'red'},
  ];
  const line = interpolate(frame, [8, 145], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <SceneShell
      index="11"
      eyebrow="DIGITAL RECORD · 数字记录"
      title="数字资产不是收益截图，是一条可被核验的过程"
      subtitle="别人通过这些材料看见你、判断你，再决定是否信任你。"
      durationFrames={f(9)}
    >
      <div
        style={{
          position: 'absolute',
          left: 115,
          right: 115,
          top: 485,
          height: 5,
          background: 'rgba(255,255,255,0.13)',
        }}
      >
        <div
          style={{
            width: `${line * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.green})`,
            boxShadow: '0 0 18px rgba(98,216,255,0.35)',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 88,
          right: 88,
          top: 390,
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 18,
        }}
      >
        {nodes.map((node, index) => (
          <div
            key={node.label}
            style={{
              ...enterStyle(frame, 10 + index * 10),
              height: 195,
              padding: '24px 18px',
              boxSizing: 'border-box',
              background: colors.panel,
              border: `1px solid ${colors[node.accent]}77`,
              borderTop: `4px solid ${colors[node.accent]}`,
              borderRadius: 6,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 17,
                height: 17,
                margin: '0 auto',
                background: colors[node.accent],
                boxShadow: `0 0 15px ${colors[node.accent]}`,
              }}
            />
            <div
              style={{
                marginTop: 39,
                color: colors.ink,
                fontSize: 31,
                lineHeight: 1.08,
                fontWeight: 950,
              }}
            >
              {node.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 420,
          right: 420,
          top: 690,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
        }}
      >
        {[
          {label: '能看到', accent: 'cyan' as Accent},
          {label: '能判断', accent: 'amber' as Accent},
          {label: '能信任', accent: 'green' as Accent},
        ].map((item, index) => (
          <div
            key={item.label}
            style={{
              ...enterStyle(frame, 78 + index * 10, 12),
              padding: '20px 16px',
              background: `${colors[item.accent]}12`,
              border: `1px solid ${colors[item.accent]}88`,
              color: colors[item.accent],
              fontSize: 31,
              fontWeight: 950,
              textAlign: 'center',
            }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </SceneShell>
  );
};

export const SelfMediaClosingQuestionsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const questions = [
    '我能不能用 AI，把一个具体问题讲清楚？',
    '我能不能用最低成本，连续发布 30 条内容？',
    '我能不能留下别人能看到、能判断、能信任的记录？',
  ];

  return (
    <SceneShell
      index="12"
      eyebrow="FINAL CHECK · 最后三问"
      title="不要先问 AI 能不能让你赚钱"
      subtitle="先判断自己能不能把一件具体的事持续做出来。"
      durationFrames={f(11)}
    >
      <div
        style={{
          position: 'absolute',
          left: 230,
          right: 230,
          top: 330,
          display: 'grid',
          gap: 18,
        }}
      >
        {questions.map((question, index) => {
          const rowIn = enter(frame, 10 + index * 18);
          return (
            <div
              key={question}
              style={{
                minHeight: 118,
                padding: '0 30px',
                display: 'grid',
                gridTemplateColumns: '64px 1fr',
                gap: 24,
                alignItems: 'center',
                boxSizing: 'border-box',
                background: colors.panel,
                borderLeft: `5px solid ${index === 2 ? colors.green : colors.cyan}`,
                borderTop: '1px solid rgba(255,255,255,0.10)',
                opacity: rowIn,
                transform: `translateX(${interpolate(rowIn, [0, 1], [-30, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px solid ${index === 2 ? colors.green : colors.cyan}`,
                  color: index === 2 ? colors.green : colors.cyan,
                  fontSize: 20,
                  fontWeight: 950,
                }}
              >
                0{index + 1}
              </div>
              <div
                style={{
                  color: colors.ink,
                  fontSize: 33,
                  lineHeight: 1.2,
                  fontWeight: 950,
                }}
              >
                {question}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          ...enterStyle(frame, 98, 16),
          position: 'absolute',
          left: 390,
          right: 390,
          top: 790,
          padding: '22px 30px',
          background: 'rgba(103,216,160,0.13)',
          border: `1px solid ${colors.green}`,
          borderLeft: `6px solid ${colors.green}`,
          color: colors.ink,
          fontSize: 42,
          fontWeight: 950,
          textAlign: 'center',
        }}
      >
        先成为一个被看见的人
      </div>
    </SceneShell>
  );
};

const sceneRanges = [
  {from: 0, duration: 6, component: SelfMediaHookFrictionScene},
  {from: 6, duration: 8, component: SelfMediaPlatformFlywheelScene},
  {from: 14, duration: 8, component: SelfMediaYouTubeEvidenceScene},
  {from: 22, duration: 7, component: SelfMediaAlphabetMetricScene},
  {from: 29, duration: 10, component: SelfMediaDouyinChannelsScene},
  {from: 39, duration: 8, component: SelfMediaContentCostScene},
  {from: 47, duration: 8, component: SelfMediaAIWorkflowScene},
  {from: 55, duration: 8, component: SelfMediaAITruthScene},
  {from: 63, duration: 10, component: SelfMediaThirtyPostScene},
  {from: 73, duration: 7, component: SelfMediaFeedbackScene},
  {from: 80, duration: 9, component: SelfMediaDigitalAssetScene},
  {from: 89, duration: 11, component: SelfMediaClosingQuestionsScene},
] as const;

const sfxCues = [
  {at: 0, src: 'soft-card-pop-a.wav', volume: 0.055},
  {at: 6, src: 'line-connect-a.wav', volume: 0.05},
  {at: 14, src: 'evidence-paper-a.wav', volume: 0.055},
  {at: 22, src: 'number-settle-a.wav', volume: 0.06},
  {at: 29, src: 'media-whoosh-a.wav', volume: 0.07},
  {at: 39, src: 'list-tick-a.wav', volume: 0.05},
  {at: 47, src: 'line-connect-a.wav', volume: 0.05},
  {at: 55, src: 'chapter-sweep-a.wav', volume: 0.06},
  {at: 63, src: 'line-connect-a.wav', volume: 0.05},
  {at: 73, src: 'list-tick-b.wav', volume: 0.05},
  {at: 80, src: 'soft-card-pop-b.wav', volume: 0.055},
  {at: 89, src: 'cta-confirm-a.wav', volume: 0.06},
] as const;

const PreflightSfx: React.FC = () => (
  <>
    {sfxCues.map((cue) => (
      <Sequence key={`${cue.at}-${cue.src}`} from={f(cue.at)} durationInFrames={f(1.4)}>
        <Audio
          src={staticFile(`audio/koubo-sfx-v3-candidates/${cue.src}`)}
          volume={cue.volume}
        />
      </Sequence>
    ))}
  </>
);

const AISelfMediaAssetPreflight16x9: React.FC<{withSfx: boolean}> = ({
  withSfx,
}) => (
  <AbsoluteFill style={{background: colors.bg}}>
    <LocalFont />
    {sceneRanges.map((scene) => {
      const Scene = scene.component;
      return (
        <Sequence
          key={`${scene.from}-${scene.duration}`}
          from={f(scene.from)}
          durationInFrames={f(scene.duration)}
          premountFor={f(0.5)}
        >
          <Scene />
        </Sequence>
      );
    })}
    {withSfx ? <PreflightSfx /> : null}
  </AbsoluteFill>
);

export const AISelfMediaAssetPreflight16x9WithSfx: React.FC = () => (
  <AISelfMediaAssetPreflight16x9 withSfx />
);

export const AISelfMediaAssetPreflight16x9NoSfx: React.FC = () => (
  <AISelfMediaAssetPreflight16x9 withSfx={false} />
);
