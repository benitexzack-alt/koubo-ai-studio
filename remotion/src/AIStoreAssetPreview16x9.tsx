import React from 'react';
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

const colors = {
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

const fontFamily = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';
const fps = 30;

const enterStyle = (frame: number, delay = 0, distance = 28) => {
  const progress = spring({
    fps,
    frame: frame - delay,
    config: {damping: 18, stiffness: 150, mass: 0.8},
  });

  return {
    opacity: interpolate(progress, [0, 1], [0, 1]),
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

const fadeOut = (frame: number, duration: number) =>
  interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });

const TopLine: React.FC<{eyebrow: string; dark?: boolean}> = ({eyebrow, dark = false}) => (
  <div
    style={{
      position: 'absolute',
      top: 48,
      left: 72,
      right: 72,
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      color: dark ? colors.white : colors.ink,
      fontFamily,
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: 0,
    }}
  >
    <span style={{width: 48, height: 6, background: colors.yellow}} />
    <span>{eyebrow}</span>
    <span style={{marginLeft: 'auto', fontWeight: 500, opacity: 0.72}}>超哥 AI 创业记 · 素材预览</span>
  </div>
);

const DefinitionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 135;
  const zoom = interpolate(frame, [0, duration], [1.02, 1.08], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <AbsoluteFill style={{background: colors.paper, opacity: fadeOut(frame, duration)}}>
      <Img
        src={staticFile('generated/ai-store-20260715/ai-store-capability-showroom-v1.png')}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`}}
      />
      <AbsoluteFill style={{background: 'rgba(246,249,252,0.54)'}} />
      <div style={{position: 'absolute', inset: '0 0 0 0', background: 'linear-gradient(90deg, rgba(246,249,252,0.98) 0%, rgba(246,249,252,0.92) 35%, rgba(246,249,252,0.20) 72%)'}} />
      <TopLine eyebrow="定义" />
      <div style={{position: 'absolute', top: 180, left: 84, width: 770, fontFamily}}>
        <div style={{...enterStyle(frame, 4), color: colors.ink, fontSize: 132, lineHeight: 1, fontWeight: 900, letterSpacing: 0}}>
          AI超市
        </div>
        <div style={{...enterStyle(frame, 13), marginTop: 34, color: colors.ink, fontSize: 40, lineHeight: 1.42, fontWeight: 700, letterSpacing: 0}}>
          不是软件导航
          <br />
          是把 AI 能力变成可交付的业务结果
        </div>
        <div style={{...enterStyle(frame, 24), marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18}}>
          {['能力货架', '需求诊断', '集成交付', '持续运维'].map((item, index) => (
            <div
              key={item}
              style={{
                borderLeft: `7px solid ${index === 3 ? colors.green : colors.cyan}`,
                background: 'rgba(255,255,255,0.9)',
                padding: '17px 22px',
                color: colors.ink,
                fontSize: 29,
                fontWeight: 750,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ValueScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 135;
  const items = [
    {index: '01', title: '选对', detail: '降低选择与学习成本', color: colors.cyan},
    {index: '02', title: '接入', detail: '降低组合与部署成本', color: colors.yellow},
    {index: '03', title: '负责', detail: '降低维护与协作成本', color: colors.green},
  ];

  return (
    <AbsoluteFill style={{background: colors.paper, color: colors.ink, fontFamily, opacity: fadeOut(frame, duration)}}>
      <TopLine eyebrow="客户价值" />
      <div style={{position: 'absolute', top: 150, left: 84, right: 84}}>
        <div style={{...enterStyle(frame, 2), fontSize: 66, lineHeight: 1.12, fontWeight: 900, letterSpacing: 0}}>
          客户买的不是工具数量
        </div>
        <div style={{...enterStyle(frame, 9), marginTop: 16, color: colors.muted, fontSize: 30, fontWeight: 600}}>
          而是三种真实成本下降
        </div>
        <div style={{marginTop: 72, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28}}>
          {items.map((item, index) => (
            <div
              key={item.title}
              style={{
                ...enterStyle(frame, 18 + index * 8, 34),
                height: 330,
                background: colors.white,
                borderTop: `9px solid ${item.color}`,
                padding: '38px 34px',
                boxShadow: '0 18px 50px rgba(20,31,43,0.10)',
              }}
            >
              <div style={{fontSize: 24, color: colors.muted, fontWeight: 700}}>{item.index}</div>
              <div style={{marginTop: 40, fontSize: 70, fontWeight: 900}}>{item.title}</div>
              <div style={{marginTop: 30, fontSize: 30, lineHeight: 1.45, color: colors.muted, fontWeight: 600}}>{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const RevenueScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 150;
  const items = [
    {label: '标准工具箱', sub: '低客单 · 易复制', color: colors.cyan},
    {label: '项目交付', sub: '诊断 · 部署 · 验收', color: colors.yellow},
    {label: '订阅运维', sub: '更新 · 监控 · 培训', color: colors.green},
    {label: '渠道生态', sub: '最后一步 · 合规复制', color: colors.orange},
  ];

  return (
    <AbsoluteFill style={{background: colors.ink, color: colors.white, fontFamily, opacity: fadeOut(frame, duration)}}>
      <TopLine eyebrow="盈利模型" dark />
      <div style={{position: 'absolute', top: 150, left: 84, right: 84}}>
        <div style={{...enterStyle(frame, 2), fontSize: 68, fontWeight: 900}}>收益不是一条线，是四层结构</div>
        <div style={{marginTop: 92, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18}}>
          {items.map((item, index) => {
            const progress = spring({fps, frame: frame - 18 - index * 8, config: {damping: 18, stiffness: 160}});
            return (
              <div key={item.label} style={{position: 'relative', opacity: progress, transform: `translateX(${interpolate(progress, [0, 1], [34, 0])}px)`}}>
                <div style={{height: 300, borderTop: `8px solid ${item.color}`, background: '#1B252E', padding: '34px 26px'}}>
                  <div style={{fontSize: 24, color: item.color, fontWeight: 800}}>{String(index + 1).padStart(2, '0')}</div>
                  <div style={{marginTop: 46, fontSize: 41, fontWeight: 850}}>{item.label}</div>
                  <div style={{marginTop: 32, fontSize: 24, lineHeight: 1.4, color: '#B7C2CC', fontWeight: 600}}>{item.sub}</div>
                </div>
                {index < items.length - 1 ? <div style={{position: 'absolute', right: -20, top: 142, width: 22, height: 4, background: colors.white, opacity: 0.48}} /> : null}
              </div>
            );
          })}
        </div>
        <div style={{...enterStyle(frame, 63), marginTop: 42, padding: '20px 28px', borderLeft: `8px solid ${colors.orange}`, background: '#2A2020', fontSize: 29, fontWeight: 800}}>
          持续收费 ≠ 自动躺赚　只有持续使用、持续创造价值，订阅才成立
        </div>
      </div>
    </AbsoluteFill>
  );
};

const EvidenceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 180;
  const cards = [
    {
      source: '工业和信息化部 · 2025-05-09',
      title: '既懂行业，又懂数字化',
      detail: '提供“小快轻准”解决方案',
      image: 'screenshots/20260713_ai_store_miit_small_fast_light.png',
      color: colors.cyan,
    },
    {
      source: '上海市经信委 · 2026-05-19',
      title: '算力 + 模型 + 应用',
      detail: '线上平台 + 线下交付',
      image: 'screenshots/20260713_ai_store_shanghai_three_layers.png',
      color: colors.yellow,
    },
    {
      source: '甘肃省官方规划 · 2026-04-20',
      title: '模型即服务',
      detail: '智能体即服务 · 场景牵引',
      image: 'screenshots/20260713_ai_store_gansu_model_agent_service.png',
      color: colors.green,
    },
  ];

  return (
    <AbsoluteFill style={{background: colors.paper, color: colors.ink, fontFamily, opacity: fadeOut(frame, duration)}}>
      <TopLine eyebrow="官网证据" />
      <div style={{position: 'absolute', top: 138, left: 84, right: 84}}>
        <div style={{...enterStyle(frame, 2), fontSize: 58, fontWeight: 900}}>模式已经出现，盈利仍需真实验证</div>
        <div style={{marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24}}>
          {cards.map((card, index) => (
            <div key={card.source} style={{...enterStyle(frame, 14 + index * 10), height: 545, background: colors.white, borderTop: `8px solid ${card.color}`, padding: '26px 24px', boxShadow: '0 14px 46px rgba(20,31,43,0.09)'}}>
              <div style={{height: 174, background: '#F7F9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12}}>
                <Img src={staticFile(card.image)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
              </div>
              <div style={{marginTop: 28, fontSize: 21, color: colors.muted, fontWeight: 650}}>{card.source}</div>
              <div style={{marginTop: 26, fontSize: 40, lineHeight: 1.18, fontWeight: 900}}>{card.title}</div>
              <div style={{marginTop: 18, fontSize: 26, lineHeight: 1.4, color: colors.muted, fontWeight: 650}}>{card.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FutureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 150;
  const nodes = ['模型 / 工具 / 智能体', '本地 AI 服务站', '企业真实流程', '反馈 / 续费'];

  return (
    <AbsoluteFill style={{background: colors.ink, opacity: fadeOut(frame, duration)}}>
      <Img src={staticFile('generated/ai-store-20260715/local-ai-delivery-scene-v1.png')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(17,24,32,0.98) 0%, rgba(17,24,32,0.88) 40%, rgba(17,24,32,0.30) 72%)'}} />
      <TopLine eyebrow="未来发展" dark />
      <div style={{position: 'absolute', top: 150, left: 84, width: 820, color: colors.white, fontFamily}}>
        <div style={{...enterStyle(frame, 2), fontSize: 65, lineHeight: 1.1, fontWeight: 900}}>从卖工具，走向运营结果</div>
        <div style={{...enterStyle(frame, 10), marginTop: 22, fontSize: 28, lineHeight: 1.5, color: '#D2DAE1', fontWeight: 600}}>
          工具越来越普及，行业理解、本地交付和持续运营更有价值
        </div>
        <div style={{marginTop: 54}}>
          {nodes.map((node, index) => (
            <div key={node} style={{...enterStyle(frame, 20 + index * 8, 20), display: 'flex', alignItems: 'center', marginBottom: 18}}>
              <div style={{width: 52, height: 52, background: index === 1 ? colors.yellow : colors.cyan, color: colors.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900}}>{index + 1}</div>
              <div style={{marginLeft: 18, minWidth: 390, padding: '13px 20px', background: 'rgba(17,24,32,0.78)', border: '1px solid rgba(255,255,255,0.25)', fontSize: 28, fontWeight: 750}}>{node}</div>
              {index < nodes.length - 1 ? <div style={{marginLeft: 18, width: 52, height: 3, background: colors.yellow, transformOrigin: 'left', transform: `scaleX(${interpolate(frame, [35 + index * 8, 55 + index * 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})})`}} /> : null}
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', right: 60, bottom: 42, padding: '10px 14px', color: colors.white, background: 'rgba(17,24,32,0.68)', fontFamily, fontSize: 19}}>AI 生成示意画面</div>
    </AbsoluteFill>
  );
};

const FranchiseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 105;

  return (
    <AbsoluteFill style={{background: '#FFF7F2', color: colors.ink, fontFamily, opacity: fadeOut(frame, duration)}}>
      <TopLine eyebrow="风险边界" />
      <div style={{position: 'absolute', top: 160, left: 84, right: 84, display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 60, alignItems: 'center'}}>
        <div>
          <div style={{...enterStyle(frame, 2), color: colors.orange, fontSize: 30, fontWeight: 900}}>连锁不是起点</div>
          <div style={{...enterStyle(frame, 8), marginTop: 16, fontSize: 78, lineHeight: 1.05, fontWeight: 950}}>先跑通<br />再复制</div>
          <div style={{...enterStyle(frame, 16), marginTop: 34, fontSize: 27, lineHeight: 1.55, color: colors.muted, fontWeight: 650}}>没有成熟模式、指导能力和合规条件，不能把“AI 超市”直接包装成招商故事。</div>
        </div>
        <div style={{...enterStyle(frame, 18), background: colors.white, borderTop: `8px solid ${colors.orange}`, padding: '36px 34px', boxShadow: '0 18px 55px rgba(95,41,18,0.10)'}}>
          <Img src={staticFile('screenshots/20260713_ai_store_mofcom_franchise_requirement.png')} style={{width: '100%', height: 110, objectFit: 'contain', imageRendering: 'auto'}} />
          <div style={{marginTop: 32, fontSize: 34, lineHeight: 1.35, fontWeight: 850}}>成熟经营模式 + 持续指导能力</div>
          <div style={{marginTop: 16, fontSize: 27, color: colors.muted, fontWeight: 650}}>至少 2 个直营店，且经营时间超过 1 年</div>
          <div style={{marginTop: 28, fontSize: 20, color: colors.muted}}>来源：中华人民共和国商务部 · 公开办事指南</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ActionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const items = ['1个行业', '1个重复流程', '1套验收指标'];

  return (
    <AbsoluteFill style={{background: colors.paper, color: colors.ink, fontFamily}}>
      <TopLine eyebrow="行动输入" />
      <div style={{position: 'absolute', top: 170, left: 84, right: 84, textAlign: 'center'}}>
        <div style={{...enterStyle(frame, 2), fontSize: 86, lineHeight: 1.06, fontWeight: 950}}>先跑通，再复制</div>
        <div style={{...enterStyle(frame, 9), marginTop: 26, color: colors.muted, fontSize: 30, fontWeight: 650}}>不要先搭大平台，不要先谈加盟</div>
        <div style={{marginTop: 76, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26}}>
          {items.map((item, index) => (
            <div key={item} style={{...enterStyle(frame, 18 + index * 8), height: 210, background: colors.white, borderBottom: `10px solid ${[colors.cyan, colors.yellow, colors.green][index]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, fontWeight: 900, boxShadow: '0 14px 44px rgba(20,31,43,0.10)'}}>{item}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const AIStoreAssetPreview16x9: React.FC = () => {
  const {durationInFrames} = useVideoConfig();

  return (
    <AbsoluteFill style={{background: colors.paper}}>
      <Sequence from={0} durationInFrames={135}><DefinitionScene /></Sequence>
      <Sequence from={135} durationInFrames={135}><ValueScene /></Sequence>
      <Sequence from={270} durationInFrames={150}><RevenueScene /></Sequence>
      <Sequence from={420} durationInFrames={180}><EvidenceScene /></Sequence>
      <Sequence from={600} durationInFrames={150}><FutureScene /></Sequence>
      <Sequence from={750} durationInFrames={105}><FranchiseScene /></Sequence>
      <Sequence from={855} durationInFrames={durationInFrames - 855}><ActionScene /></Sequence>
    </AbsoluteFill>
  );
};
