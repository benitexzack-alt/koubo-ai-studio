import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  V72ProductionShell,
  type V72CustomScene,
  type V72ProductionConfig,
  type V72ProductionScene,
  type V72SfxCue,
} from './components/V72ProductionShell';
import sfxContract from './data/AISelfMediaV73.sfx.v1.json';

const fps = 30;
const durationSeconds = 384.733333;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const AI_SELF_MEDIA_V73_DURATION_IN_FRAMES = f(durationSeconds);

type Tone = 'cyan' | 'amber' | 'green' | 'red' | 'white';

const colors: Record<Tone, string> = {
  cyan: '#62D8FF',
  amber: '#FFBE55',
  green: '#67D8A0',
  red: '#FF7068',
  white: '#F7FAFC',
};

type CustomItem = {
  label: string;
  detail?: string;
  tone?: Tone;
};

type CustomData = {
  eyebrow?: string;
  title?: string;
  detail?: string;
  note?: string;
  items?: CustomItem[];
  questions?: string[];
};

const sceneOpacity = (frame: number, durationInFrames: number) => {
  const fade = Math.min(10, Math.max(5, Math.round(durationInFrames * 0.08)));
  return Math.min(
    interpolate(frame, [0, fade], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(fade, durationInFrames - fade), durationInFrames],
      [1, 0],
      clamp,
    ),
  );
};

const useEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps: compositionFps,
    config: {damping: 20, stiffness: 185, mass: 0.82},
  });
};

const GlassStage: React.FC<{
  children: React.ReactNode;
  width?: number;
  top?: number;
}> = ({children, width = 730, top = 112}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const enter = useEnter(1);
  const opacity = sceneOpacity(frame, durationInFrames);

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top,
        width,
        maxHeight: 730,
        boxSizing: 'border-box',
        padding: '27px 29px 30px',
        overflow: 'hidden',
        color: colors.white,
        fontFamily,
        background:
          'linear-gradient(145deg, rgba(3,10,16,0.86), rgba(5,15,23,0.64))',
        border: '1px solid rgba(98,216,255,0.34)',
        borderLeft: '5px solid rgba(98,216,255,0.88)',
        boxShadow: '0 20px 54px rgba(0,0,0,0.38)',
        backdropFilter: 'blur(13px)',
        opacity,
        transform: `translateX(${interpolate(enter, [0, 1], [-32, 0])}px)`,
        textShadow: '0 4px 20px rgba(0,0,0,0.96)',
      }}
    >
      {children}
    </div>
  );
};

const Eyebrow: React.FC<{children: React.ReactNode; tone?: Tone}> = ({
  children,
  tone = 'cyan',
}) => (
  <div
    style={{
      color: colors[tone],
      fontSize: 18,
      lineHeight: 1.1,
      fontWeight: 950,
      letterSpacing: 0,
    }}
  >
    {children}
  </div>
);

const TagGridScene: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const data = (scene.data ?? {}) as CustomData;
  const items = data.items ?? [];

  return (
    <GlassStage width={742} top={92}>
      <Eyebrow tone="amber">{data.eyebrow ?? 'REAL BARRIERS · 真实卡点'}</Eyebrow>
      <div
        style={{
          marginTop: 11,
          fontSize: 49,
          lineHeight: 1.06,
          fontWeight: 950,
        }}
      >
        {data.title}
      </div>
      {data.detail ? (
        <div
          style={{
            marginTop: 15,
            color: 'rgba(247,250,252,0.78)',
            fontSize: 23,
            lineHeight: 1.28,
            fontWeight: 850,
          }}
        >
          {data.detail}
        </div>
      ) : null}
      <div
        style={{
          marginTop: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        {items.map((item, index) => {
          const enter = spring({
            frame: frame - 8 - index * 7,
            fps,
            config: {damping: 21, stiffness: 190, mass: 0.8},
          });
          const tone = colors[item.tone ?? (index % 3 === 1 ? 'amber' : 'cyan')];
          return (
            <div
              key={`${item.label}-${index}`}
              style={{
                minHeight: item.detail ? 90 : 68,
                boxSizing: 'border-box',
                padding: '14px 15px',
                background: 'rgba(255,255,255,0.055)',
                borderLeft: `3px solid ${tone}`,
                opacity: enter,
                transform: `translateY(${interpolate(enter, [0, 1], [15, 0])}px)`,
              }}
            >
              <div style={{color: tone, fontSize: 25, lineHeight: 1.12, fontWeight: 950}}>
                {item.label}
              </div>
              {item.detail ? (
                <div
                  style={{
                    marginTop: 7,
                    color: 'rgba(247,250,252,0.84)',
                    fontSize: 18,
                    lineHeight: 1.2,
                    fontWeight: 850,
                  }}
                >
                  {item.detail}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {data.note ? (
        <div
          style={{
            marginTop: 17,
            paddingTop: 13,
            borderTop: '1px solid rgba(255,255,255,0.16)',
            color: 'rgba(247,250,252,0.70)',
            fontSize: 18,
            lineHeight: 1.25,
          }}
        >
          {data.note}
        </div>
      ) : null}
    </GlassStage>
  );
};

const FlywheelScene: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const data = (scene.data ?? {}) as CustomData;
  const items = data.items ?? [];
  const opacity = sceneOpacity(frame, durationInFrames);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        color: colors.white,
        fontFamily,
        opacity,
      }}
    >
      <div style={{position: 'absolute', left: 62, top: 104}}>
        <Eyebrow tone="amber">PLATFORM FLYWHEEL · 平台闭环</Eyebrow>
        <div style={{marginTop: 12, fontSize: 58, lineHeight: 1.05, fontWeight: 950}}>
          {data.title ?? '平台为什么需要创作者？'}
        </div>
        <div
          style={{
            marginTop: 14,
            color: 'rgba(247,250,252,0.72)',
            fontSize: 23,
            fontWeight: 850,
          }}
        >
          {data.detail}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 62,
          right: 62,
          top: 350,
          display: 'grid',
          gridTemplateColumns: '1fr 74px 1fr 74px 1fr 74px 1fr',
          alignItems: 'center',
        }}
      >
        {items.slice(0, 4).map((item, index) => {
          const enter = spring({
            frame: frame - 8 - index * 10,
            fps,
            config: {damping: 20, stiffness: 180, mass: 0.82},
          });
          const tone = colors[item.tone ?? (index === 2 ? 'amber' : 'cyan')];
          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <div
                style={{
                  minHeight: 220,
                  boxSizing: 'border-box',
                  padding: '27px 24px',
                  borderTop: `4px solid ${tone}`,
                  borderRight: `1px solid ${tone}66`,
                  borderBottom: `1px solid ${tone}66`,
                  borderLeft: `1px solid ${tone}66`,
                  background: 'rgba(255,255,255,0.045)',
                  boxShadow: `0 20px 50px rgba(0,0,0,0.30), 0 0 28px ${tone}16`,
                  opacity: enter,
                  transform: `translateY(${interpolate(enter, [0, 1], [22, 0])}px)`,
                }}
              >
                <div style={{color: tone, fontSize: 18, fontWeight: 950}}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div style={{marginTop: 17, color: tone, fontSize: 34, fontWeight: 950}}>
                  {item.label}
                </div>
                <div
                  style={{
                    marginTop: 15,
                    color: 'rgba(247,250,252,0.84)',
                    fontSize: 22,
                    lineHeight: 1.24,
                    fontWeight: 850,
                  }}
                >
                  {item.detail}
                </div>
              </div>
              {index < 3 ? (
                <div
                  style={{
                    color: colors.cyan,
                    fontSize: 50,
                    textAlign: 'center',
                    opacity: spring({
                      frame: frame - 20 - index * 10,
                      fps,
                      config: {damping: 20, stiffness: 180},
                    }),
                  }}
                >
                  →
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 62,
          top: 702,
          padding: '14px 18px',
          borderLeft: `4px solid ${colors.green}`,
          background: 'rgba(103,216,160,0.08)',
          color: colors.green,
          fontSize: 25,
          fontWeight: 950,
        }}
      >
        内容越有价值，闭环越可能继续转动
      </div>
    </div>
  );
};

const QuestionScene: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const data = (scene.data ?? {}) as CustomData;
  const questions = data.questions ?? [];

  return (
    <GlassStage width={804} top={78}>
      <Eyebrow tone="amber">30条之后，先回答这三个问题</Eyebrow>
      <div style={{marginTop: 11, fontSize: 50, lineHeight: 1.06, fontWeight: 950}}>
        {data.title ?? '先别问能不能赚钱'}
      </div>
      <div style={{marginTop: 24, display: 'grid', gap: 13}}>
        {questions.map((question, index) => {
          const enter = spring({
            frame: frame - 8 - index * 14,
            fps,
            config: {damping: 21, stiffness: 185, mass: 0.82},
          });
          return (
            <div
              key={question}
              style={{
                display: 'grid',
                gridTemplateColumns: '58px 1fr',
                gap: 14,
                minHeight: 110,
                alignItems: 'center',
                padding: '0 18px 0 10px',
                borderLeft: `4px solid ${index === 2 ? colors.green : colors.cyan}`,
                background: 'rgba(255,255,255,0.05)',
                opacity: enter,
                transform: `translateX(${interpolate(enter, [0, 1], [-24, 0])}px)`,
              }}
            >
              <div
                style={{
                  color: index === 2 ? colors.green : colors.cyan,
                  fontSize: 22,
                  fontWeight: 950,
                  textAlign: 'center',
                }}
              >
                0{index + 1}
              </div>
              <div style={{fontSize: 28, lineHeight: 1.22, fontWeight: 950}}>
                {question}
              </div>
            </div>
          );
        })}
      </div>
    </GlassStage>
  );
};

const TimelineScene: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [8, 42], [0, 1], clamp);
  const data = (scene.data ?? {}) as CustomData;

  return (
    <GlassStage width={765} top={126}>
      <Eyebrow tone="amber">PERSONAL LOG · 个人实践记录</Eyebrow>
      <div style={{marginTop: 12, fontSize: 48, lineHeight: 1.05, fontWeight: 950}}>
        {data.title ?? '先把自己放进实验里'}
      </div>
      <div
        style={{
          marginTop: 35,
          display: 'grid',
          gridTemplateColumns: '130px 1fr 130px',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div style={{color: colors.cyan, fontSize: 30, fontWeight: 950}}>7月8日</div>
        <div style={{position: 'relative', height: 18}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 8,
              height: 2,
              background: 'rgba(255,255,255,0.20)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 7,
              width: `${progress * 100}%`,
              height: 4,
              background: `linear-gradient(90deg, ${colors.cyan}, ${colors.amber})`,
              boxShadow: '0 0 18px rgba(98,216,255,0.55)',
            }}
          />
        </div>
        <div style={{color: colors.amber, fontSize: 30, fontWeight: 950, textAlign: 'right'}}>
          8月8日
        </div>
      </div>
      <div
        style={{
          marginTop: 32,
          padding: '22px 24px',
          borderLeft: `4px solid ${colors.green}`,
          background: 'rgba(103,216,160,0.08)',
          color: colors.green,
          fontSize: 31,
          lineHeight: 1.25,
          fontWeight: 950,
        }}
      >
        持续验证：AI到底能给内容创作带来什么
      </div>
      <div style={{marginTop: 17, color: 'rgba(247,250,252,0.68)', fontSize: 18}}>
        日期来自本人实拍口述，不延伸为增长或变现结论。
      </div>
    </GlassStage>
  );
};

const ClosingScene: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const data = (scene.data ?? {}) as CustomData;
  const enter = useEnter(2);

  return (
    <GlassStage width={760} top={208}>
      <Eyebrow tone="amber">START NOW · 从第一条开始</Eyebrow>
      <div
        style={{
          marginTop: 18,
          color: colors.white,
          fontSize: 68,
          lineHeight: 1.02,
          fontWeight: 950,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [22, 0])}px)`,
        }}
      >
        {data.title}
      </div>
      <div
        style={{
          marginTop: 25,
          paddingTop: 17,
          borderTop: `3px solid ${colors.cyan}`,
          color: colors.cyan,
          fontSize: 29,
          fontWeight: 950,
        }}
      >
        {data.detail}
      </div>
    </GlassStage>
  );
};

const scenes: V72ProductionScene[] = [
  {
    id: 'hook-friction',
    kind: 'custom',
    customKey: 'tag-grid',
    start: 0.2,
    end: 13.5,
    data: {
      eyebrow: '你迟迟没开始，真的是因为这些吗？',
      title: '普通人的四个自媒体误区',
      items: [
        {label: '没团队', tone: 'red'},
        {label: '口才不好', tone: 'amber'},
        {label: '不会拍视频', tone: 'cyan'},
        {label: '不敢出镜', tone: 'green'},
      ],
      note: '真正的问题：还没看懂平台为什么样的内容买单。',
    },
  },
  {
    id: 'platform-question',
    kind: 'chapter',
    start: 13.6,
    end: 22.35,
    index: '01',
    eyebrow: 'PLATFORM ECONOMY · 平台经济',
    title: '平台为什么愿意付钱？',
    subtitle: '先看懂平台闭环，再谈普通人的入场方式。',
    tone: 'cyan',
    style: {top: 126, width: 880},
  },
  {
    id: 'youtube-flywheel',
    kind: 'custom',
    customKey: 'flywheel',
    start: 27.6,
    end: 43.3,
    background: 'opaque',
    data: {
      title: 'YouTube搭建的不是视频库，而是闭环',
      detail: '创作者、用户、商家与平台相互推动。',
      items: [
        {label: '创作者', detail: '持续生产内容', tone: 'cyan'},
        {label: '用户', detail: '愿意停留更久', tone: 'green'},
        {label: '商家', detail: '愿意持续投广告', tone: 'amber'},
        {label: '平台', detail: '分配部分收益', tone: 'cyan'},
      ],
    },
  },
  {
    id: 'flywheel-result',
    kind: 'info-stack',
    start: 43.35,
    end: 50.85,
    eyebrow: 'LOOP · 循环转起来之后',
    title: '三方都愿意继续留下',
    items: [
      {label: '创作者', detail: '继续生产好内容', tone: 'cyan'},
      {label: '用户', detail: '继续观看', tone: 'green'},
      {label: '商家', detail: '继续投放', tone: 'amber'},
    ],
    style: {top: 118, width: 650},
  },
  {
    id: 'youtube-100b-evidence',
    kind: 'annotated-media',
    start: 50.9,
    end: 58.65,
    background: 'opaque',
    index: 'A',
    eyebrow: 'YOUTUBE OFFICIAL · 官方披露',
    title: '累计支付超1000亿美元',
    facts: [
      {label: '周期', value: '过去四年'},
      {label: '对象', value: '创作者 / 艺术家 / 媒体公司'},
      {label: '口径', value: '累计支付规模', tone: 'amber'},
      {label: '边界', value: '不等于个人账号收益', tone: 'red'},
    ],
    mediaSrc: 'screenshots/20260808_youtube_creator_payout_100b.png',
    mediaKind: 'image',
    mediaLabel: '来源：YouTube 2026 CEO Letter · 官方页面截图',
    mediaFit: 'contain',
  },
  {
    id: 'alphabet-60b-metric',
    kind: 'metric',
    start: 58.68,
    end: 66.45,
    eyebrow: 'ALPHABET 2025 · 官方财报口径',
    value: '600',
    suffix: '亿美元以上',
    caption: 'YouTube广告和订阅年收入',
    facts: ['平台收入规模', '不外推普通创作者个人收益'],
    tone: 'amber',
    style: {top: 148, width: 710},
  },
  {
    id: 'attention-value',
    kind: 'evidence',
    start: 66.5,
    end: 70.15,
    source: '由前述两项官方口径支持',
    marker: 'CONCLUSION · 结论',
    quote: '平台愿意为优质注意力付钱',
    caption: '支付与收入规模说明平台存在内容价值分配机制，不代表人人自动获益。',
    tone: 'cyan',
    style: {top: 156, width: 850},
  },
  {
    id: 'douyin-entry',
    kind: 'chapter',
    start: 70.2,
    end: 74.55,
    index: '02',
    eyebrow: 'DOUYIN · 抖音',
    title: '逻辑类似，形式不同',
    subtitle: '激励、商单、交易与直播，是不同类型的入口。',
    tone: 'amber',
    style: {top: 126, width: 860},
  },
  {
    id: 'douyin-routes',
    kind: 'custom',
    customKey: 'tag-grid',
    start: 74.6,
    end: 84,
    data: {
      eyebrow: 'PUBLIC ROUTES · 公开入口',
      title: '入口存在，但不是躺赚按钮',
      items: [
        {label: '创作者伙伴计划'},
        {label: '中视频相关收益', tone: 'green'},
        {label: '星图商单', tone: 'amber'},
        {label: '全民任务'},
        {label: '商品橱窗', tone: 'green'},
        {label: '精选联盟', tone: 'amber'},
        {label: '直播带货'},
      ],
      note: '具体开通条件与结果，以现行规则和账号后台为准。',
    },
  },
  {
    id: 'xingtu-evidence',
    kind: 'annotated-media',
    start: 84,
    end: 91,
    background: 'opaque',
    index: 'B',
    eyebrow: 'XINGTU · 巨量星图',
    title: '商业合作有明确规则',
    facts: [
      {label: '页面', value: '新达人入驻必读手册'},
      {label: '用途', value: '证明入口存在', tone: 'green'},
      {label: '边界', value: '不代表自动获得商单', tone: 'red'},
    ],
    mediaSrc: 'screenshots/20260808_xingtu_creator_entry.png',
    mediaKind: 'image',
    mediaLabel: '来源：巨量星图官方帮助中心',
    mediaFit: 'contain',
  },
  {
    id: 'douyin-ec-evidence',
    kind: 'annotated-media',
    start: 91,
    end: 98.2,
    background: 'opaque',
    index: 'C',
    eyebrow: 'DOUYIN E-COMMERCE · 抖音电商',
    title: '达人交易路径公开可见',
    facts: [
      {label: '入口', value: '达人 / 商品 / 直播'},
      {label: '用途', value: '证明交易机制存在', tone: 'green'},
      {label: '边界', value: '不构成收益承诺', tone: 'red'},
    ],
    mediaSrc: 'screenshots/20260808_douyin_ec_creator_path.png',
    mediaKind: 'image',
    mediaLabel: '来源：抖音电商官方达人页面',
    mediaFit: 'contain',
  },
  {
    id: 'cost-question',
    kind: 'chapter',
    start: 98.3,
    end: 103.45,
    index: '？',
    eyebrow: 'WHY SO HARD · 为什么很难',
    title: '过去，内容生产太贵了',
    subtitle: '任何一个环节卡住，发布就会停下来。',
    tone: 'red',
    style: {top: 126, width: 850},
  },
  {
    id: 'content-cost',
    kind: 'process',
    start: 103.5,
    end: 117.1,
    eyebrow: 'CONTENT COST · 内容成本',
    title: '一条内容背后的完整流程',
    steps: [
      {label: '选题资料', detail: '找方向 / 查资料', tone: 'cyan'},
      {label: '文案拍摄', detail: '写脚本 / 开口讲', tone: 'amber'},
      {label: '剪辑封面', detail: '做成片 / 做包装', tone: 'cyan'},
      {label: '发布复盘', detail: '看反馈 / 再调整', tone: 'green'},
    ],
    style: {top: 120, width: 1160},
  },
  {
    id: 'give-up-before-start',
    kind: 'custom',
    customKey: 'tag-grid',
    start: 117.2,
    end: 126.2,
    data: {
      eyebrow: 'FRICTION · 开始之前',
      title: '很多人不是不想做',
      detail: '而是一想到整套流程，就先放弃了。',
      items: [
        {label: '要露脸', tone: 'red'},
        {label: '要表达', tone: 'amber'},
        {label: '要剪辑', tone: 'cyan'},
        {label: '要坚持', tone: 'green'},
      ],
    },
  },
  {
    id: 'ai-workflow',
    kind: 'info-stack',
    start: 126.3,
    end: 141.7,
    eyebrow: 'AI ASSIST · AI辅助',
    title: '门槛正在被压低',
    items: [
      {label: '文案', detail: '先把想法整理成逻辑', tone: 'cyan'},
      {label: '选题', detail: '拆热点和同行', tone: 'amber'},
      {label: '脚本', detail: '先生成可修改的提纲', tone: 'green'},
    ],
    style: {top: 112, width: 660},
  },
  {
    id: 'no-face-modes',
    kind: 'custom',
    customKey: 'tag-grid',
    start: 141.75,
    end: 152.8,
    data: {
      eyebrow: 'START WITHOUT CAMERA · 不出镜也能先开始',
      title: '先选你能持续的形式',
      items: [
        {label: '图文'},
        {label: '录屏', tone: 'green'},
        {label: '口播字幕', tone: 'amber'},
        {label: '知识卡片'},
      ],
      note: 'AI还可以辅助看评论、看数据、找下一条怎么改。',
    },
  },
  {
    id: 'civilization-capability',
    kind: 'chapter',
    start: 152.85,
    end: 160.6,
    index: 'AI',
    eyebrow: 'CAPABILITY · 能力边界',
    title: '文明级认知能力',
    subtitle: '它能整理知识与方法，但不能替代发布、测试和真实验证。',
    tone: 'cyan',
    style: {top: 126, width: 900},
  },
  {
    id: 'ai-core-truth',
    kind: 'truth',
    start: 160.65,
    end: 167.5,
    eyebrow: 'CORE TRUTH · 一定要说清楚',
    left: 'AI替你赚钱',
    right: 'AI降低试错成本',
    note: '工具能降低内容成本，真实结果仍要靠你发布、验证和持续改进。',
  },
  {
    id: 'what-you-do',
    kind: 'process',
    start: 167.6,
    end: 177.9,
    eyebrow: 'YOUR WORK · 真正要你做的',
    title: '把真实价值持续讲出来',
    steps: [
      {label: '问题', detail: '讲清楚', tone: 'cyan'},
      {label: '经验', detail: '讲明白', tone: 'amber'},
      {label: '工具', detail: '用给别人看', tone: 'green'},
      {label: '过程', detail: '持续记录', tone: 'cyan'},
    ],
    style: {top: 120, width: 1160},
  },
  {
    id: 'realistic-path',
    kind: 'chapter',
    start: 178,
    end: 185,
    index: '03',
    eyebrow: 'REALISTIC PATH · 现实路径',
    title: '先别辞职All in',
    subtitle: '也别一上来就买课、囤工具、搞矩阵。',
    tone: 'amber',
    style: {top: 126, width: 850},
  },
  {
    id: 'thirty-posts',
    kind: 'metric',
    start: 185.1,
    end: 194.75,
    eyebrow: 'MINIMUM LOOP · 最小验证闭环',
    value: '30',
    suffix: '条内容',
    caption: '先跑一次低成本实验',
    facts: ['不是起号保证', '不是变现承诺', '目的是获得真实反馈'],
    tone: 'amber',
    style: {top: 140, width: 710},
  },
  {
    id: 'steps-one-two',
    kind: 'process',
    start: 194.8,
    end: 216.6,
    eyebrow: 'STEP 01–02 · 先收窄对象和问题',
    title: '不要一上来讲“AI改变世界”',
    steps: [
      {label: '选人群', detail: '长期观察一类人', tone: 'cyan'},
      {label: '定问题', detail: '只解决一个具体问题', tone: 'amber'},
      {label: '给场景', detail: '文案 / 出镜 / 记录', tone: 'green'},
      {label: '讲结果', detail: '让别人马上能用', tone: 'cyan'},
    ],
    style: {top: 120, width: 1160},
  },
  {
    id: 'step-three',
    kind: 'info-stack',
    start: 216.65,
    end: 228,
    eyebrow: 'STEP 03 · 降低内容成本',
    title: '每天形成一套可执行产出',
    items: [
      {label: '选题 + 脚本', detail: '先完成内容骨架', tone: 'cyan'},
      {label: '封面思路', detail: '提前锁定单一重点', tone: 'amber'},
      {label: '发布复盘', detail: '根据真实反馈再改', tone: 'green'},
    ],
    style: {top: 112, width: 675},
  },
  {
    id: 'step-four-feedback',
    kind: 'custom',
    customKey: 'tag-grid',
    start: 228.1,
    end: 245.35,
    data: {
      eyebrow: 'STEP 04 · 看真实反馈',
      title: '四个问题，比“我很努力”更重要',
      items: [
        {label: '有人看完吗？'},
        {label: '有人收藏吗？', tone: 'green'},
        {label: '有人说用得上吗？', tone: 'amber'},
        {label: '有人私信问下一步吗？'},
      ],
      note: '四步跑不通，先别急着谈变现。',
    },
  },
  {
    id: 'effort-vs-retention',
    kind: 'truth',
    start: 245.4,
    end: 256.55,
    eyebrow: 'PLATFORM SIGNAL · 平台信号',
    left: '努力本身',
    right: '用户愿意停留',
    note: '平台看见的是用户行为，不是创作者在镜头外花了多少时间。',
  },
  {
    id: 'digital-assets',
    kind: 'custom',
    customKey: 'tag-grid',
    start: 256.6,
    end: 267.35,
    data: {
      eyebrow: 'DIGITAL ASSET · 数字资产',
      title: '没赚到钱，也不等于一无所获',
      items: [
        {label: '公开表达', detail: '每一条内容'},
        {label: '市场反馈', detail: '每一次复盘', tone: 'green'},
        {label: '方法案例', detail: '判断你的材料', tone: 'amber'},
        {label: '失败记录', detail: '下一次改进依据'},
      ],
    },
  },
  {
    id: 'publish-feedback-loop',
    kind: 'process',
    start: 267.45,
    end: 281.2,
    eyebrow: 'PUBLIC LOOP · 公开反馈闭环',
    title: '机会不会判断你脑子里的想法',
    steps: [
      {label: '发布', detail: '让别人看见', tone: 'cyan'},
      {label: '测试', detail: '接受真实反应', tone: 'amber'},
      {label: '反馈', detail: '修正下一条', tone: 'green'},
      {label: '信任', detail: '逐步形成判断材料', tone: 'cyan'},
    ],
    style: {top: 120, width: 1160},
  },
  {
    id: 'three-questions',
    kind: 'custom',
    customKey: 'questions',
    start: 281.25,
    end: 308,
    data: {
      title: '先别问AI能不能让你赚钱',
      questions: [
        '能不能用AI把一个具体问题讲清楚？',
        '能不能用最低成本连续发布30条内容？',
        '能不能把内容变成别人能看见、判断和信任的数字资产？',
      ],
    },
  },
  {
    id: 'no-guarantees',
    kind: 'info-stack',
    start: 308.1,
    end: 331.8,
    eyebrow: 'BOUNDARY · 结果边界',
    title: '这是一条低成本路径，不是保证',
    items: [
      {label: '不保证', detail: '一定变现', tone: 'red'},
      {label: '不保证', detail: '平台一定给流量', tone: 'red'},
      {label: '值得测试', detail: '用认知、时间和反馈换真实验证', tone: 'green'},
    ],
    style: {top: 112, width: 690},
  },
  {
    id: 'be-seen',
    kind: 'chapter',
    start: 331.85,
    end: 338.05,
    index: '→',
    eyebrow: 'FIRST RESULT · 第一个结果',
    title: '先成为一个被看见的人',
    subtitle: '不需要一开始就成为大博主。',
    tone: 'cyan',
    style: {top: 126, width: 850},
  },
  {
    id: 'personal-timeline',
    kind: 'custom',
    customKey: 'timeline',
    start: 338.1,
    end: 355.1,
    data: {
      title: '这一个月，我也在持续验证',
    },
  },
  {
    id: 'personal-connections',
    kind: 'custom',
    customKey: 'tag-grid',
    start: 355.2,
    end: 364.55,
    data: {
      eyebrow: 'PERSONAL OBSERVATION · 本人观察',
      title: '短期里已经出现了真实连接',
      items: [
        {label: '持续发布', tone: 'cyan'},
        {label: '连接到粉丝', tone: 'green'},
        {label: '认识兰州本地创业者', tone: 'amber'},
        {label: '继续验证', tone: 'cyan'},
      ],
      note: '不展示数量、收入或成交，不把个人观察升级为普遍结果。',
    },
  },
  {
    id: 'long-term-asset',
    kind: 'evidence',
    start: 364.65,
    end: 374.05,
    source: '超哥 · 个人实践判断',
    marker: 'PERSONAL VIEW · 个人观点',
    quote: '长期做数字资产的积累，我相信它一定是有价值的',
    caption: '是否变现仍待长期验证；这里表达的是持续积累的个人判断。',
    tone: 'green',
    style: {top: 158, width: 850},
  },
  {
    id: 'start-now',
    kind: 'custom',
    customKey: 'closing',
    start: 374.1,
    end: 381.4,
    data: {
      title: '第一步：一定要开始',
      detail: '先完成第一条，再用真实反馈改下一条。',
    },
  },
  {
    id: 'identity-close',
    kind: 'custom',
    customKey: 'closing',
    start: 381.45,
    end: durationSeconds,
    data: {
      title: '我是超哥',
      detail: '我在兰州AI创业',
    },
  },
];

const sfxCues: V72SfxCue[] = sfxContract.cues.map((cue) => ({
  id: cue.id,
  time: cue.start,
  file: cue.source.split('/').at(-1) ?? cue.id,
  src: cue.source.replace(/^remotion\/public\//, ''),
  volume: cue.volume,
}));

const config: V72ProductionConfig = {
  durationSeconds,
  sourceVideo: 'media/ai-selfmedia-20260808/main-30fps.mp4',
  captionsSrc: 'data/AI_SELFMEDIA_20260808_talk01.bilingual.v1.json',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.025) saturate(0.985) brightness(0.99)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.24) 0%, rgba(2,7,12,0.035) 51%, rgba(2,7,12,0.02) 100%)',
  motion: {
    cuts: [
      ...scenes.map((scene) => scene.start),
      6.4,
      22.4,
      32.9,
      98.28,
      141.72,
      177.96,
      235.64,
      267.44,
      300.24,
      331.84,
      355.16,
      364.6,
    ],
    baseScale: 1.01,
    peakScales: [1.043, 1.048, 1.04, 1.046, 1.042],
    peakX: [-7, 5, -3, 7, -5],
    peakY: [-2, -3, 0, -2, -1],
    transformOrigin: '58% 42%',
  },
  scenes,
  sfxCues,
};

const renderCustomScene = (scene: V72CustomScene) => {
  switch (scene.customKey) {
    case 'tag-grid':
      return <TagGridScene scene={scene} />;
    case 'flywheel':
      return <FlywheelScene scene={scene} />;
    case 'questions':
      return <QuestionScene scene={scene} />;
    case 'timeline':
      return <TimelineScene scene={scene} />;
    case 'closing':
      return <ClosingScene scene={scene} />;
    default:
      return null;
  }
};

const AISelfMediaV73Talk16x9: React.FC<{soundEnabled: boolean}> = ({
  soundEnabled,
}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
  />
);

export const AISelfMediaV73Talk16x9WithSfx: React.FC = () => (
  <AISelfMediaV73Talk16x9 soundEnabled />
);

export const AISelfMediaV73Talk16x9NoSfx: React.FC = () => (
  <AISelfMediaV73Talk16x9 soundEnabled={false} />
);
