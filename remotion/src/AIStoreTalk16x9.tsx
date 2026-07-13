import {Video} from '@remotion/media';
import React, {type CSSProperties, type ReactNode} from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {BilingualCaptionOverlay} from './components/BilingualCaptionOverlay';

const palette = {
  paper: '#F4F7FB',
  ink: '#111820',
  muted: '#5C6875',
  cyan: '#00A9C7',
  cyanSoft: '#C9F4FA',
  yellow: '#F6C445',
  green: '#20A36A',
  orange: '#E9693A',
  white: '#FFFFFF',
};

const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const fps = 30;
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const secondsToFrames = (seconds: number) => Math.round(seconds * fps);

const cameraTimes = [
  0, 3.4, 5, 8.1, 11.38, 23.5, 29.8, 30.46, 37.66, 38.22, 68.8, 76.26, 77.18,
  78.2, 79.22, 88, 97.66, 98.78, 109, 120.8, 121.52, 135, 147.58, 148.3, 156,
  162.5, 162.66, 173.84, 174.68, 187.4, 198.78, 199.46, 205.5, 211.06, 211.48,
  215.94, 216.92, 223, 228.7, 229.32, 238.2, 245.64, 246.02, 248.71,
];

const cameraScales = [
  1.015, 1.032, 1.035, 1.029, 1.022, 1.03, 1.024, 1.024, 1.024, 1.022, 1.03,
  1.025, 1.02, 1.045, 1.028, 1.034, 1.024, 1.022, 1.034, 1.024, 1.022, 1.034,
  1.024, 1.022, 1.034, 1.026, 1.022, 1.022, 1.02, 1.032, 1.023, 1.018, 1.028,
  1.032, 1.025, 1.025, 1.02, 1.028, 1.022, 1.018, 1.031, 1.04, 1.035, 1.035,
];

const cameraX = [
  0, 5, 6, 4, 7, 14, 8, 8, 8, 8, 12, 8, 0, 4, 2, 10, 7, 7, 12, 7, 7, 12, 7,
  7, 12, 8, 3, 3, 6, 11, 7, 5, 10, 8, 8, 8, 6, 12, 8, 6, 12, 12, 8, 8,
];

const CameraVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  const scale = interpolate(seconds, cameraTimes, cameraScales, {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const translateX = interpolate(seconds, cameraTimes, cameraX, {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <Video
      src={staticFile('media/AI_STORE_20260715_talk01_16x9_input.mp4')}
      objectFit="cover"
      style={{
        width: '100%',
        height: '100%',
        filter: 'contrast(1.015) saturate(1.035) brightness(1.015)',
        transform: `translate3d(${translateX}px, 0, 0) scale(${scale})`,
        transformOrigin: '51% 31%',
      }}
    />
  );
};

const sceneOpacity = (frame: number, duration: number) =>
  Math.min(
    interpolate(frame, [0, 10], [0, 1], clamp),
    interpolate(frame, [duration - 10, duration], [1, 0], clamp),
  );

const enter = (frame: number, delay = 0, distance = 24) => {
  const progress = spring({
    fps,
    frame: frame - delay,
    config: {damping: 20, stiffness: 165, mass: 0.8},
  });

  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  } satisfies CSSProperties;
};

const SceneFade: React.FC<{duration: number; children: ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>{children}</AbsoluteFill>;
};

const CardShell: React.FC<{
  eyebrow: string;
  accent: string;
  children: ReactNode;
  width?: number;
}> = ({eyebrow, accent, children, width = 610}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        ...enter(frame, 0, 32),
        position: 'absolute',
        left: 70,
        top: 146,
        width,
        minHeight: 420,
        maxHeight: 620,
        padding: '28px 30px 32px',
        background: 'rgba(248,251,255,0.97)',
        borderTop: `8px solid ${accent}`,
        boxShadow: '0 24px 70px rgba(12,28,44,0.24)',
        color: palette.ink,
        fontFamily,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12, color: palette.muted, fontSize: 20, fontWeight: 800}}>
        <span style={{width: 28, height: 4, background: accent}} />
        {eyebrow}
      </div>
      {children}
    </div>
  );
};

const HookCard: React.FC = () => {
  const frame = useCurrentFrame();
  const questions = ['到底是什么', '凭什么赚钱', '普通人怎么参与'];

  return (
    <CardShell eyebrow="一个概念 · 三个问题" accent={palette.yellow}>
      <div style={{...enter(frame, 4), marginTop: 22, fontSize: 76, lineHeight: 1, fontWeight: 950}}>AI 超市</div>
      <div style={{marginTop: 30, display: 'grid', gap: 12}}>
        {questions.map((question, index) => (
          <div
            key={question}
            style={{
              ...enter(frame, 11 + index * 9, 18),
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '13px 16px',
              background: index === 1 ? '#FFF4CF' : palette.white,
              fontSize: 28,
              fontWeight: 850,
            }}
          >
            <span style={{color: index === 1 ? '#A86400' : palette.cyan, fontSize: 21, fontWeight: 950}}>0{index + 1}</span>
            {question}
          </div>
        ))}
      </div>
    </CardShell>
  );
};

const DirectedMap: React.FC<{
  eyebrow: string;
  title: string;
  detail: string;
  nodes: string[];
  accent?: string;
}> = ({eyebrow, title, detail, nodes, accent = palette.cyan}) => {
  const frame = useCurrentFrame();

  return (
    <CardShell eyebrow={eyebrow} accent={accent}>
      <div style={{...enter(frame, 4), marginTop: 20, fontSize: 45, lineHeight: 1.12, fontWeight: 950}}>{title}</div>
      <div style={{...enter(frame, 10), marginTop: 12, color: palette.muted, fontSize: 23, lineHeight: 1.35, fontWeight: 650}}>{detail}</div>
      <div style={{marginTop: 28, display: 'grid', gap: 10}}>
        {nodes.map((node, index) => {
          const line = interpolate(frame, [22 + index * 9, 34 + index * 9], [0, 1], clamp);
          return (
            <React.Fragment key={node}>
              <div
                style={{
                  ...enter(frame, 14 + index * 9, 16),
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 15px',
                  background: index === nodes.length - 1 ? '#E8F8EF' : palette.white,
                  borderLeft: `6px solid ${index === nodes.length - 1 ? palette.green : accent}`,
                  fontSize: 24,
                  fontWeight: 820,
                }}
              >
                <span style={{width: 35, color: palette.muted, fontSize: 18}}>0{index + 1}</span>
                {node}
              </div>
              {index < nodes.length - 1 ? (
                <div style={{height: 13, marginLeft: 32, borderLeft: `3px solid ${accent}`, transform: `scaleY(${line})`, transformOrigin: 'top'}} />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </CardShell>
  );
};

const CapabilityCard: React.FC = () => {
  const frame = useCurrentFrame();
  const outcomes = [
    {title: '少一点重复', color: palette.cyan},
    {title: '回复更及时', color: palette.yellow},
    {title: '内容稳定生产', color: palette.green},
  ];

  return (
    <CardShell eyebrow="客户价值" accent={palette.cyan}>
      <div style={{...enter(frame, 4), marginTop: 20, fontSize: 43, lineHeight: 1.12, fontWeight: 950}}>不是工具数量</div>
      <div style={{...enter(frame, 10), marginTop: 8, color: palette.muted, fontSize: 22, fontWeight: 650}}>而是业务结果变得更确定</div>
      <div style={{marginTop: 27, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10}}>
        {outcomes.map((item, index) => (
          <div
            key={item.title}
            style={{
              ...enter(frame, 16 + index * 9, 20),
              minHeight: 132,
              padding: '18px 12px',
              background: palette.white,
              borderTop: `6px solid ${item.color}`,
              fontSize: 24,
              lineHeight: 1.28,
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            {item.title}
          </div>
        ))}
      </div>
      <div style={{...enter(frame, 51), marginTop: 22, padding: '15px 18px', background: palette.ink, color: palette.white, fontSize: 22, lineHeight: 1.4, fontWeight: 780}}>
        选工具 → 搭流程 → 教员工 → 持续负责
      </div>
    </CardShell>
  );
};

const RevenueCard: React.FC<{step: 1 | 2 | 3 | 4}> = ({step}) => {
  const frame = useCurrentFrame();
  const stages = [
    {title: '标准工具箱', detail: '容易开始 · 容易复制', color: palette.yellow, items: ['餐饮', '零售', '文旅', '销售']},
    {title: '项目交付', detail: '诊断 → 部署 → 培训 → 验收', color: palette.cyan, items: ['知识库', '智能客服', '内容流程', '销售跟进']},
    {title: '订阅与运维', detail: '不是自动扣费，是持续价值', color: palette.green, items: ['模型更新', '知识维护', '员工培训', '效果检查']},
    {title: '平台与连锁', detail: '最后一步，不是第一步', color: palette.orange, items: ['真实客户', '交付复制', '售后持续', '验收标准']},
  ] as const;
  const active = stages[step - 1];

  return (
    <CardShell eyebrow="四层收益结构" accent={active.color}>
      <div style={{...enter(frame, 3), marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 16}}>
        <span style={{color: active.color, fontSize: 64, lineHeight: 1, fontWeight: 950}}>{step}</span>
        <span style={{color: palette.muted, fontSize: 24, fontWeight: 800}}>/ 4</span>
        <span style={{fontSize: 40, fontWeight: 950}}>{active.title}</span>
      </div>
      <div style={{...enter(frame, 9), marginTop: 15, color: palette.muted, fontSize: 23, lineHeight: 1.35, fontWeight: 700}}>{active.detail}</div>
      <div style={{marginTop: 25, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10}}>
        {active.items.map((item, index) => (
          <div key={item} style={{...enter(frame, 15 + index * 6, 16), padding: '13px 14px', background: palette.white, borderLeft: `5px solid ${active.color}`, fontSize: 22, fontWeight: 820}}>{item}</div>
        ))}
      </div>
      <div style={{marginTop: 27, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8}}>
        {stages.map((item, index) => (
          <div key={item.title} style={{height: 8, background: index + 1 <= step ? item.color : '#D8E0E7'}} />
        ))}
      </div>
    </CardShell>
  );
};

const FullScreenConcept: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.02, 1.075], {...clamp, easing: Easing.inOut(Easing.quad)});

  return (
    <AbsoluteFill style={{background: palette.ink, fontFamily, overflow: 'hidden'}}>
      <Img
        src={staticFile('generated/ai-store-20260715/ai-store-capability-showroom-v1.png')}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`}}
      />
      <AbsoluteFill style={{background: 'rgba(10,18,25,0.28)'}} />
      <div style={{...enter(frame, 4), position: 'absolute', left: 78, top: 148, width: 720, padding: '24px 28px', background: 'rgba(248,251,255,0.94)', borderLeft: `9px solid ${palette.yellow}`, color: palette.ink}}>
        <div style={{fontSize: 50, lineHeight: 1.08, fontWeight: 950}}>能力货架不是价值终点</div>
        <div style={{marginTop: 12, color: palette.muted, fontSize: 24, fontWeight: 700}}>真正的价值在选品、组合、交付和售后</div>
      </div>
      <div style={{position: 'absolute', right: 60, bottom: 214, padding: '9px 14px', background: 'rgba(9,17,24,0.74)', color: palette.white, fontSize: 18, fontWeight: 750}}>
        AI 生成概念示意
      </div>
    </AbsoluteFill>
  );
};

const EvidenceScreen: React.FC<{
  eyebrow: string;
  title: string;
  detail: string;
  source: string;
  image: string;
  accent: string;
  warning?: boolean;
}> = ({eyebrow, title, detail, source, image, accent, warning = false}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{background: warning ? '#FFF7F2' : palette.paper, color: palette.ink, fontFamily}}>
      <div style={{position: 'absolute', inset: '0 0 auto 0', height: 10, background: accent}} />
      <div style={{position: 'absolute', left: 78, top: 116, width: 640}}>
        <div style={{...enter(frame, 2), color: accent, fontSize: 23, fontWeight: 900}}>{eyebrow}</div>
        <div style={{...enter(frame, 8), marginTop: 19, fontSize: 57, lineHeight: 1.08, fontWeight: 950}}>{title}</div>
        <div style={{...enter(frame, 16), marginTop: 28, color: palette.muted, fontSize: 27, lineHeight: 1.5, fontWeight: 680}}>{detail}</div>
        {warning ? (
          <div style={{...enter(frame, 24), marginTop: 34, padding: '16px 18px', background: '#FCE3D8', borderLeft: `7px solid ${accent}`, fontSize: 24, lineHeight: 1.4, fontWeight: 850}}>先跑通真实客户，再谈复制和连锁</div>
        ) : null}
      </div>
      <div style={{...enter(frame, 13, 28), position: 'absolute', left: 790, right: 70, top: 120, height: 650, padding: '28px 30px', background: palette.white, borderTop: `8px solid ${accent}`, boxShadow: '0 22px 65px rgba(18,35,50,0.14)'}}>
        <Img src={staticFile(image)} style={{width: '100%', height: 535, objectFit: 'contain'}} />
        <div style={{marginTop: 18, color: palette.muted, fontSize: 19, lineHeight: 1.3, fontWeight: 680}}>{source}</div>
      </div>
    </AbsoluteFill>
  );
};

const DefinitionCard: React.FC<{title: string; detail: string; accent: string; eyebrow: string}> = ({title, detail, accent, eyebrow}) => {
  const frame = useCurrentFrame();
  const parts = detail.split(' / ');

  return (
    <CardShell eyebrow={eyebrow} accent={accent}>
      <div style={{...enter(frame, 4), marginTop: 24, fontSize: 55, lineHeight: 1.06, fontWeight: 950}}>{title}</div>
      <div style={{marginTop: 36, display: 'grid', gap: 11}}>
        {parts.map((part, index) => (
          <div key={part} style={{...enter(frame, 13 + index * 8, 16), padding: '13px 16px', background: palette.white, borderLeft: `6px solid ${index === parts.length - 1 ? palette.green : accent}`, fontSize: 26, fontWeight: 850}}>{part}</div>
        ))}
      </div>
    </CardShell>
  );
};

const ActionCard: React.FC = () => {
  const frame = useCurrentFrame();
  const items = ['1 家企业', '1 个岗位', '1 个重复流程'];

  return (
    <CardShell eyebrow="普通人的最小起点" accent={palette.green}>
      <div style={{...enter(frame, 4), marginTop: 20, fontSize: 52, lineHeight: 1.05, fontWeight: 950}}>先跑通，再复制</div>
      <div style={{...enter(frame, 10), marginTop: 12, color: palette.muted, fontSize: 23, fontWeight: 700}}>能持续交付，才谈规模</div>
      <div style={{marginTop: 28, display: 'grid', gap: 11}}>
        {items.map((item, index) => (
          <div key={item} style={{...enter(frame, 16 + index * 9, 18), display: 'flex', alignItems: 'center', gap: 15, padding: '14px 17px', background: palette.white, borderLeft: `7px solid ${[palette.cyan, palette.yellow, palette.green][index]}`, fontSize: 26, fontWeight: 880}}>
            <span style={{color: palette.muted, fontSize: 19}}>0{index + 1}</span>
            {item}
          </div>
        ))}
      </div>
      <div style={{...enter(frame, 48), marginTop: 22, textAlign: 'center', color: palette.white, background: palette.ink, padding: '13px 16px', fontSize: 22, fontWeight: 850}}>跑通 → 标准化 → 复制</div>
    </CardShell>
  );
};

const BrandCta: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <CardShell eyebrow="在地实践" accent={palette.yellow}>
      <div style={{...enter(frame, 2), marginTop: 28, color: palette.cyan, fontSize: 25, fontWeight: 900}}>关注我</div>
      <div style={{...enter(frame, 7), marginTop: 10, fontSize: 57, lineHeight: 1.05, fontWeight: 950}}>超哥 AI 创业记</div>
      <div style={{...enter(frame, 12), marginTop: 24, color: palette.muted, fontSize: 28, lineHeight: 1.4, fontWeight: 730}}>在兰州记录 AI 创业</div>
    </CardShell>
  );
};

const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], clamp);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', fontFamily}}>
      <div style={{position: 'absolute', top: 35, left: 56, right: 56, display: 'flex', alignItems: 'center', color: palette.white, textShadow: '0 2px 10px rgba(0,0,0,0.8)'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, fontWeight: 900}}>
          <span style={{width: 34, height: 6, background: palette.yellow}} />
          超哥 AI 创业记 · 兰州
        </div>
        <div style={{marginLeft: 'auto', padding: '8px 13px', background: 'rgba(8,16,24,0.54)', fontSize: 20, fontWeight: 780}}>
          AI 超市到底靠什么赚钱
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, background: 'rgba(255,255,255,0.28)'}}>
        <div style={{height: '100%', width: `${progress * 100}%`, background: palette.yellow}} />
      </div>
    </AbsoluteFill>
  );
};

const TimedScene: React.FC<{start: number; end: number; children: ReactNode}> = ({start, end, children}) => {
  const from = secondsToFrames(start);
  const duration = Math.max(1, secondsToFrames(end) - from);
  return (
    <Sequence from={from} durationInFrames={duration} premountFor={15}>
      <SceneFade duration={duration}>{children}</SceneFade>
    </Sequence>
  );
};

export const AIStoreTalk16x9: React.FC = () => {
  return (
    <AbsoluteFill style={{background: palette.ink}}>
      <CameraVideo />

      <TimedScene start={0.12} end={11.38}><HookCard /></TimedScene>
      <TimedScene start={11.38} end={29.8}>
        <DirectedMap eyebrow="AI 超市的定义" title="不是软件链接仓库" detail="能力必须进入真实业务问题" nodes={['模型 / 工具 / 智能体', '行业与业务问题', '可购买、可交付的方案']} />
      </TimedScene>
      <TimedScene start={30.46} end={37.66}><FullScreenConcept /></TimedScene>
      <TimedScene start={47.04} end={76.26}><CapabilityCard /></TimedScene>
      <TimedScene start={79.22} end={97.66}><RevenueCard step={1} /></TimedScene>
      <TimedScene start={98.78} end={120.8}><RevenueCard step={2} /></TimedScene>
      <TimedScene start={121.52} end={147.58}><RevenueCard step={3} /></TimedScene>
      <TimedScene start={148.3} end={162.5}><RevenueCard step={4} /></TimedScene>
      <TimedScene start={162.66} end={173.84}>
        <EvidenceScreen
          eyebrow="官网证据 · 风险边界"
          title="连锁只能是最后一步"
          detail="没有成熟模式、持续指导和合规条件，不能把 AI 超市直接包装成招商故事。"
          source="来源：中华人民共和国商务部 · 商业特许经营公开办事指南"
          image="screenshots/20260713_ai_store_mofcom_franchise_requirement.png"
          accent={palette.orange}
          warning
        />
      </TimedScene>
      <TimedScene start={174.68} end={198.78}>
        <DirectedMap eyebrow="未来发展" title="AI 超市的四个阶段" detail="越往后，越依赖真实交付" nodes={['工具数量', '行业理解', '流程接入', '持续运营与负责']} />
      </TimedScene>
      <TimedScene start={199.46} end={211.06}>
        <DefinitionCard eyebrow="本地机会" title="本地交付更有价值" detail="懂客户 / 懂需求 / 能到现场" accent={palette.yellow} />
      </TimedScene>
      <TimedScene start={211.48} end={215.94}>
        <EvidenceScreen
          eyebrow="甘肃官方规划"
          title="模型即服务 · 智能体即服务"
          detail="规划方向不等于个人项目获批，也不等于必然盈利。"
          source="来源：甘肃省官方规划公开页面"
          image="screenshots/20260713_ai_store_gansu_model_agent_service.png"
          accent={palette.cyan}
        />
      </TimedScene>
      <TimedScene start={216.92} end={228.7}>
        <DirectedMap eyebrow="兰州的切入点" title="不是去造大模型" detail="而是把能力带进本地企业现场" nodes={['模型与智能体', '企业真实流程', '现场交付与验收']} accent={palette.green} />
      </TimedScene>
      <TimedScene start={229.32} end={245.64}><ActionCard /></TimedScene>
      <TimedScene start={246.02} end={248.71}><BrandCta /></TimedScene>

      <Hud />
      <BilingualCaptionOverlay captionsSrc="data/AI_STORE_20260715_talk01.bilingual.v1.json" />
    </AbsoluteFill>
  );
};
