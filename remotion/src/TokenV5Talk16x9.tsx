import {Audio, Video} from '@remotion/media';
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
import {LocalFont} from './components/LocalFont';

const fps = 30;
const durationInFrames = 6595;
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const frames = (seconds: number) => Math.round(seconds * fps);

const palette = {
  night: '#050B14',
  panel: 'rgba(8, 24, 38, 0.94)',
  cyan: '#55E6FF',
  blue: '#3E8DFF',
  green: '#62F5A3',
  yellow: '#FFD34E',
  red: '#FF6B6B',
  ink: '#F5FAFF',
  muted: '#A9BED0',
  paper: '#F6F9FC',
  darkInk: '#122131',
};

const enter = (frame: number, delay = 0, distance = 28): CSSProperties => {
  const progress = spring({
    fps,
    frame: frame - delay,
    config: {damping: 20, stiffness: 170, mass: 0.82},
  });
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

const sceneOpacity = (frame: number, duration: number) => {
  const ramp = Math.max(4, Math.min(10, Math.floor(duration / 3)));
  return Math.min(
    interpolate(frame, [0, ramp], [0, 1], clamp),
    interpolate(frame, [duration - ramp, duration], [1, 0], clamp),
  );
};

const SceneFade: React.FC<{duration: number; children: ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>{children}</AbsoluteFill>;
};

const CameraVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const cameraTimes = [0, 4.62, 13.56, 31.08, 39.46, 55.34, 81.64, 118.76, 133.12, 165.04, 191.22, 219.83];
  const cameraScales = [1.01, 1.025, 1.018, 1.032, 1.018, 1.03, 1.018, 1.03, 1.018, 1.028, 1.018, 1.03];
  const cameraX = [0, 8, 2, 12, 4, 10, 3, 11, 3, 9, 2, 8];
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
      src={staticFile('media/TOKEN_20260715_talk01_16x9_input.mp4')}
      objectFit="cover"
      style={{
        width: '100%',
        height: '100%',
        filter: 'contrast(1.025) saturate(1.04) brightness(1.015)',
        transform: `translate3d(${translateX}px, 0, 0) scale(${scale})`,
        transformOrigin: '52% 34%',
      }}
    />
  );
};

const CardShell: React.FC<{
  eyebrow: string;
  accent?: string;
  width?: number;
  top?: number;
  children: ReactNode;
}> = ({eyebrow, accent = palette.cyan, width = 650, top = 150, children}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...enter(frame, 0, 30),
        position: 'absolute',
        left: 64,
        top,
        width,
        padding: '25px 28px 30px',
        background: 'rgba(7, 22, 35, 0.93)',
        borderTop: `7px solid ${accent}`,
        outline: '1px solid rgba(111,220,255,0.20)',
        boxShadow: '0 25px 78px rgba(0,0,0,0.36)',
        color: palette.ink,
        fontFamily,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12, color: accent, fontSize: 19, fontWeight: 900}}>
        <span style={{width: 30, height: 4, background: accent}} />
        {eyebrow}
      </div>
      {children}
    </div>
  );
};

const GridBackground: React.FC = () => (
  <AbsoluteFill style={{background: 'radial-gradient(circle at 72% 18%, rgba(62,141,255,0.22), transparent 34%), radial-gradient(circle at 16% 82%, rgba(85,230,255,0.12), transparent 34%), #050B14'}}>
    <AbsoluteFill
      style={{
        opacity: 0.18,
        backgroundImage:
          'linear-gradient(rgba(85,230,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(85,230,255,0.22) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    />
  </AbsoluteFill>
);

const TopBrandBar: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 30,
      left: 54,
      right: 54,
      height: 48,
      display: 'flex',
      alignItems: 'center',
      color: palette.ink,
      fontFamily,
      fontSize: 20,
      zIndex: 80,
      textShadow: '0 2px 10px rgba(0,0,0,0.75)',
    }}
  >
    <div style={{width: 10, height: 10, borderRadius: 99, background: palette.green, boxShadow: `0 0 18px ${palette.green}`}} />
    <div style={{marginLeft: 12, fontWeight: 900}}>超哥 · 兰州记录 AI 创业</div>
    <div style={{marginLeft: 22, color: palette.cyan, fontWeight: 900}}>TOKEN 产业链</div>
  </div>
);

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const width = `${(frame / Math.max(1, durationInFrames - 1)) * 100}%`;
  return (
    <div style={{position: 'absolute', left: 54, right: 54, bottom: 24, height: 4, background: 'rgba(255,255,255,0.18)', zIndex: 80}}>
      <div style={{height: '100%', width, background: `linear-gradient(90deg, ${palette.blue}, ${palette.cyan}, ${palette.green})`, boxShadow: `0 0 13px ${palette.cyan}`}} />
    </div>
  );
};

const HookMacroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const nodes = [
    {label: '芯片', tone: palette.cyan},
    {label: '服务器', tone: palette.blue},
    {label: '数据中心', tone: palette.green},
    {label: '光电与水电', tone: palette.yellow},
    {label: '模型服务', tone: '#B58CFF'},
  ];

  return (
    <AbsoluteFill>
      <GridBackground />
      <Img
        src={staticFile('generated/token-v5-20260715/chip-server-datacenter-cinematic-v1.png')}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.76,
          transform: `scale(${interpolate(frame, [0, 94], [1.02, 1.09], clamp)})`,
        }}
      />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(5,11,20,0.28), rgba(5,11,20,0.92))'}} />
      <div style={{position: 'absolute', left: 72, top: 110, color: palette.ink, fontFamily}}>
        <div style={{...enter(frame, 1), color: palette.cyan, fontSize: 20, fontWeight: 900}}>一次提问触发的真实资源链</div>
        <div style={{...enter(frame, 5), marginTop: 12, fontSize: 58, fontWeight: 950}}>提问发出后，后台开始运转</div>
      </div>
      <div style={{position: 'absolute', left: 72, right: 72, top: 560, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 30}}>
        {nodes.map((node, index) => {
          const progress = spring({fps, frame: frame - 8 - index * 6, config: {damping: 20, stiffness: 180}});
          return (
            <div key={node.label} style={{position: 'relative', height: 150, padding: '20px 22px', background: 'rgba(6,20,32,0.82)', outline: `1px solid ${node.tone}77`, opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [26, 0])}px)`, color: palette.ink, fontFamily}}>
              <div style={{color: node.tone, fontSize: 16, fontWeight: 900}}>0{index + 1}</div>
              <div style={{marginTop: 24, fontSize: 27, fontWeight: 950}}>{node.label}</div>
              {index < nodes.length - 1 ? <div style={{position: 'absolute', right: -30, top: 73, width: 30, height: 4, background: node.tone, boxShadow: `0 0 14px ${node.tone}`}} /> : null}
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', right: 58, bottom: 44, color: palette.muted, fontFamily, fontSize: 16}}>AI 概念画面 · 用于链路示意</div>
    </AbsoluteFill>
  );
};

const EraCard: React.FC<{index: number; era: string; driver: string; tone: string}> = ({index, era, driver, tone}) => {
  const frame = useCurrentFrame();
  const progress = spring({fps, frame: frame - index * 10, config: {damping: 20, stiffness: 180}});
  return (
    <div style={{display: 'grid', gridTemplateColumns: '54px 1fr 180px', alignItems: 'center', gap: 16, padding: '17px 18px', background: index === 2 ? 'rgba(85,230,255,0.12)' : 'rgba(255,255,255,0.055)', borderLeft: `6px solid ${tone}`, opacity: progress, transform: `translateX(${interpolate(progress, [0, 1], [-22, 0])}px)`}}>
      <div style={{color: tone, fontSize: 17, fontWeight: 900}}>0{index + 1}</div>
      <div style={{fontSize: 27, fontWeight: 850}}>{era}</div>
      <div style={{color: tone, textAlign: 'right', fontSize: 35, fontWeight: 950}}>{driver}</div>
    </div>
  );
};

const EraScene: React.FC = () => (
  <CardShell eyebrow="三时代驱动变量" accent={palette.yellow} top={138}>
    <div style={{marginTop: 16, fontSize: 41, lineHeight: 1.12, fontWeight: 950}}>从石油、流量，到 Token</div>
    <div style={{marginTop: 24, display: 'grid', gap: 11}}>
      <EraCard index={0} era="工业时代" driver="石油" tone={palette.yellow} />
      <EraCard index={1} era="互联网时代" driver="流量" tone={palette.blue} />
      <EraCard index={2} era="AI 时代" driver="Token" tone={palette.cyan} />
    </div>
  </CardShell>
);

const OrdinaryQuestionCard: React.FC = () => (
  <CardShell eyebrow="先回答一个现实问题" accent={palette.yellow} top={178}>
    <div style={{marginTop: 24, fontSize: 50, lineHeight: 1.18, fontWeight: 950}}>这跟普通人<br />到底有什么关系？</div>
    <div style={{marginTop: 24, color: palette.muted, fontSize: 23, lineHeight: 1.5}}>先看懂整条链，再判断自己能站在哪一层。</div>
  </CardShell>
);

const TokenDefinitionCard: React.FC = () => {
  const frame = useCurrentFrame();
  const wrong = ['虚拟货币', '算力本身'];
  return (
    <CardShell eyebrow="Token 的第一性定义" accent={palette.cyan} top={142}>
      <div style={{marginTop: 18, display: 'flex', gap: 10}}>
        {wrong.map((item, index) => <div key={item} style={{...enter(frame, index * 7), padding: '10px 14px', background: 'rgba(255,107,107,0.12)', color: '#FFB2B2', fontSize: 21, fontWeight: 850, textDecoration: 'line-through'}}>{item}</div>)}
      </div>
      <div style={{...enter(frame, 14), marginTop: 22, fontSize: 37, lineHeight: 1.2, fontWeight: 950}}>大模型处理信息时的<br /><span style={{color: palette.cyan, fontSize: 58}}>计量单位</span></div>
      <div style={{...enter(frame, 24), marginTop: 18, padding: '15px 17px', background: 'rgba(85,230,255,0.10)', color: palette.muted, fontSize: 22, lineHeight: 1.45}}>输入与输出，都会被拆成 Token。</div>
    </CardShell>
  );
};

const ModelActionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const models = [
    {name: '豆包', action: '回复一段话', sample: '正在组织回答……', tone: palette.cyan},
    {name: 'DeepSeek', action: '写一份文案', sample: '正在生成结构与正文……', tone: palette.blue},
    {name: 'Kimi', action: '分析一份文件', sample: '正在提取重点与结论……', tone: palette.green},
  ];
  return (
    <AbsoluteFill>
      <GridBackground />
      <div style={{position: 'absolute', left: 70, top: 108, color: palette.ink, fontFamily}}>
        <div style={{color: palette.cyan, fontSize: 20, fontWeight: 900}}>中性操作示意 · 非官方界面</div>
        <div style={{marginTop: 12, fontSize: 52, fontWeight: 950}}>不同任务，都会产生输入与输出</div>
      </div>
      <div style={{position: 'absolute', left: 70, right: 70, top: 300, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24}}>
        {models.map((model, index) => {
          const progress = spring({fps, frame: frame - 5 - index * 9, config: {damping: 20, stiffness: 170}});
          const typed = Math.floor(interpolate(frame, [28 + index * 8, 86 + index * 8], [0, model.sample.length], clamp));
          return (
            <div key={model.name} style={{height: 440, padding: '28px 28px', background: palette.panel, outline: `1px solid ${model.tone}66`, boxShadow: `0 22px 65px ${model.tone}18`, opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [34, 0])}px)`, color: palette.ink, fontFamily}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                <div style={{width: 42, height: 42, borderRadius: 9, background: model.tone, color: palette.night, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 950}}>{index + 1}</div>
                <div style={{marginLeft: 14, fontSize: 31, fontWeight: 950}}>{model.name}</div>
              </div>
              <div style={{marginTop: 34, color: model.tone, fontSize: 23, fontWeight: 900}}>{model.action}</div>
              <div style={{marginTop: 22, minHeight: 130, padding: '20px 20px', background: 'rgba(255,255,255,0.055)', color: '#DCEAF4', fontSize: 22, lineHeight: 1.55}}>{model.sample.slice(0, typed)}<span style={{color: model.tone}}>▍</span></div>
              <div style={{marginTop: 28, display: 'flex', gap: 8, alignItems: 'center'}}>
                {Array.from({length: 7}).map((_, tokenIndex) => <div key={tokenIndex} style={{height: 13, width: 26 + ((tokenIndex * 11) % 30), background: model.tone, opacity: 0.22 + tokenIndex * 0.08}} />)}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const ConsumptionCard: React.FC = () => (
  <CardShell eyebrow="Token 与算力持续消耗" accent={palette.cyan} top={154}>
    <div style={{marginTop: 22, fontSize: 40, lineHeight: 1.18, fontWeight: 950}}>模型 → 智能体 → AI 应用</div>
    <div style={{marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10}}>
      {['手机', '电脑', '企业系统'].map((item, index) => <div key={item} style={{padding: '17px 8px', background: index === 2 ? 'rgba(98,245,163,0.13)' : 'rgba(255,255,255,0.055)', color: index === 2 ? palette.green : palette.ink, textAlign: 'center', fontSize: 22, fontWeight: 900}}>{item}</div>)}
    </div>
    <div style={{marginTop: 24, color: palette.muted, fontSize: 22, lineHeight: 1.5}}>一旦 AI 接进真实终端，围绕 Token 的生意就会继续往外长。</div>
  </CardShell>
);

const ResourceMapCard: React.FC = () => {
  const frame = useCurrentFrame();
  const nodes = ['芯片', '服务器', '光模块', '数据中心', '电力', '网络', '冷却'];
  return (
    <CardShell eyebrow="上游 · AI 靠什么跑起来" accent={palette.cyan} width={720} top={122}>
      <div style={{marginTop: 18, fontSize: 41, fontWeight: 950}}>基础设施与算力</div>
      <div style={{marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10}}>
        {nodes.map((node, index) => {
          const progress = spring({fps, frame: frame - index * 5, config: {damping: 20, stiffness: 180}});
          return <div key={node} style={{padding: '15px 17px', background: 'rgba(255,255,255,0.055)', borderLeft: `5px solid ${index > 3 ? palette.yellow : palette.cyan}`, fontSize: 23, fontWeight: 850, opacity: progress}}>{node}</div>;
        })}
      </div>
      <div style={{marginTop: 20, color: palette.cyan, fontSize: 30, fontWeight: 950}}>上游卖：这些东西和算力</div>
    </CardShell>
  );
};

const MidstreamCard: React.FC = () => (
  <CardShell eyebrow="中游 · 把算力变成可调用能力" accent={palette.blue} width={710} top={140}>
    <div style={{marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12}}>
      {['大模型公司', '云平台', '智能体平台', 'AI 开发工具'].map((item) => <div key={item} style={{padding: '19px 15px', background: 'rgba(62,141,255,0.12)', color: palette.ink, fontSize: 23, fontWeight: 900}}>{item}</div>)}
    </div>
    <div style={{marginTop: 28, color: palette.blue, fontSize: 32, fontWeight: 950}}>中游卖：模型、平台和服务</div>
  </CardShell>
);

const ThreeLayerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const columns = [
    {title: '上游', sell: '卖算力', detail: '芯片 / 服务器 / 数据中心', tone: palette.cyan},
    {title: '中游', sell: '卖模型', detail: '模型 / 云平台 / 智能体', tone: palette.blue},
    {title: '下游', sell: '卖结果', detail: '把 AI 接进真实业务', tone: palette.green},
  ];
  return (
    <AbsoluteFill>
      <GridBackground />
      <div style={{position: 'absolute', left: 70, top: 105, color: palette.ink, fontFamily}}>
        <div style={{color: palette.green, fontSize: 20, fontWeight: 900}}>整条产业链，最后压缩成一句话</div>
        <div style={{marginTop: 12, fontSize: 57, fontWeight: 950}}>上游卖算力，中游卖模型，下游卖结果</div>
      </div>
      <div style={{position: 'absolute', left: 72, right: 72, top: 340, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28}}>
        {columns.map((column, index) => {
          const progress = spring({fps, frame: frame - index * 10, config: {damping: 20, stiffness: 175}});
          return <div key={column.title} style={{height: 360, padding: '32px 30px', background: index === 2 ? 'rgba(10,48,41,0.94)' : palette.panel, outline: `1px solid ${column.tone}66`, opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [32, 0])}px)`, color: palette.ink, fontFamily}}><div style={{color: column.tone, fontSize: 20, fontWeight: 900}}>0{index + 1}</div><div style={{marginTop: 20, fontSize: 48, fontWeight: 950}}>{column.title}</div><div style={{marginTop: 26, color: column.tone, fontSize: 39, fontWeight: 950}}>{column.sell}</div><div style={{marginTop: 24, color: palette.muted, fontSize: 22, lineHeight: 1.5}}>{column.detail}</div></div>;
        })}
      </div>
    </AbsoluteFill>
  );
};

const ExportCorrectionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const items = ['电力', '服务器', '数据中心', '网络', '模型服务'];
  return (
    <AbsoluteFill>
      <GridBackground />
      <div style={{position: 'absolute', left: 72, top: 105, color: palette.ink, fontFamily}}>
        <div style={{color: palette.red, fontSize: 20, fontWeight: 900}}>概念纠偏</div>
        <div style={{marginTop: 12, fontSize: 53, fontWeight: 950}}>“Token 出海”不是把 Token 装车运走</div>
      </div>
      <div style={{position: 'absolute', left: 90, right: 90, top: 475, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 48}}>
        {items.map((item, index) => {
          const progress = spring({fps, frame: frame - 8 - index * 8, config: {damping: 20, stiffness: 180}});
          return <div key={item} style={{position: 'relative', height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: palette.panel, outline: `1px solid ${index === 4 ? palette.green : palette.cyan}66`, opacity: progress, transform: `scale(${interpolate(progress, [0, 1], [0.86, 1])})`, color: palette.ink, fontFamily}}><div style={{color: index === 4 ? palette.green : palette.cyan, fontSize: 17, fontWeight: 900}}>0{index + 1}</div><div style={{marginTop: 18, fontSize: 29, fontWeight: 950}}>{item}</div>{index < items.length - 1 ? <div style={{position: 'absolute', right: -48, top: 87, width: 48, height: 4, background: palette.cyan, boxShadow: `0 0 14px ${palette.cyan}`}} /> : null}</div>;
        })}
      </div>
      <div style={{position: 'absolute', left: 470, right: 470, top: 735, padding: '20px 24px', background: 'rgba(98,245,163,0.12)', borderLeft: `7px solid ${palette.green}`, color: palette.green, textAlign: 'center', fontFamily, fontSize: 29, fontWeight: 950}}>把算力和模型服务，通过网络送出去</div>
    </AbsoluteFill>
  );
};

const GansuEvidenceScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: palette.paper, color: palette.darkInk, fontFamily}}>
      <div style={{position: 'absolute', left: 66, top: 100, right: 66}}>
        <div style={{color: '#087EA4', fontSize: 20, fontWeight: 900}}>官方原页证据 · 甘肃上游节点</div>
        <div style={{marginTop: 10, fontSize: 48, fontWeight: 950}}>国家批复甘肃枢纽，设立庆阳数据中心集群</div>
      </div>
      <div style={{...enter(frame, 4), position: 'absolute', left: 66, top: 255, width: 1050, height: 650, padding: 20, background: '#FFFFFF', boxShadow: '0 22px 70px rgba(18,33,49,0.18)'}}>
        <Img src={staticFile('screenshots/20260714_token_gansu_hub_approval.png')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 34%'}} />
      </div>
      <div style={{position: 'absolute', left: 1150, right: 66, top: 255, display: 'grid', gap: 18}}>
        <div style={{...enter(frame, 13), padding: 22, background: '#FFFFFF', boxShadow: '0 18px 54px rgba(18,33,49,0.12)'}}><div style={{color: '#087EA4', fontSize: 18, fontWeight: 900}}>原文要点 01</div><Img src={staticFile('screenshots/20260714_token_gansu_hub_quote.png')} style={{marginTop: 14, width: '100%', height: 160, objectFit: 'contain'}} /></div>
        <div style={{...enter(frame, 24), padding: 22, background: '#FFFFFF', boxShadow: '0 18px 54px rgba(18,33,49,0.12)'}}><div style={{color: '#1F9D68', fontSize: 18, fontWeight: 900}}>原文要点 02</div><Img src={staticFile('screenshots/20260714_token_qingyang_cluster_quote.png')} style={{marginTop: 14, width: '100%', height: 160, objectFit: 'contain'}} /></div>
      </div>
      <div style={{position: 'absolute', left: 68, bottom: 46, color: '#5E7182', fontSize: 17}}>来源：国家发展改革委等四部门复函（2022-01-12）｜原页引用，不代表合作或投资背书</div>
    </AbsoluteFill>
  );
};

const LongxiaolangScene: React.FC = () => (
  <AbsoluteFill style={{background: palette.paper, color: palette.darkInk, fontFamily}}>
    <div style={{position: 'absolute', left: 70, top: 104, right: 70}}>
      <div style={{color: '#1F9D68', fontSize: 20, fontWeight: 900}}>甘肃下游案例 · 原文引用</div>
      <div style={{marginTop: 10, fontSize: 49, fontWeight: 950}}>“陇小郎”：AI 进入一个具体行业</div>
    </div>
    <div style={{position: 'absolute', left: 70, top: 245, width: 920, height: 690, padding: 20, background: '#FFFFFF', boxShadow: '0 22px 70px rgba(18,33,49,0.16)'}}>
      <Img src={staticFile('screenshots/20260714_token_longxiaolang_top.png')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 8%'}} />
    </div>
    <div style={{position: 'absolute', left: 1040, right: 70, top: 300, padding: '38px 36px', background: '#FFFFFF', borderTop: '8px solid #1F9D68', boxShadow: '0 22px 70px rgba(18,33,49,0.16)'}}>
      <div style={{fontSize: 24, color: '#1F9D68', fontWeight: 900}}>原文可支持的事实</div>
      <div style={{marginTop: 28, fontSize: 42, lineHeight: 1.32, fontWeight: 950}}>独家授权签约<br />首轮成果转化</div>
      <div style={{marginTop: 30, padding: '20px 22px', background: '#EDF8F2', color: '#4C6171', fontSize: 22, lineHeight: 1.55}}>这里只说明甘肃出现了 AI 接入具体行业的下游动作；不外推医疗效果或商业成功。</div>
    </div>
    <div style={{position: 'absolute', left: 72, bottom: 42, color: '#5E7182', fontSize: 17}}>来源：甘肃省中医院微信公众号｜原页必要引用</div>
  </AbsoluteFill>
);

const OrdinaryPositionCard: React.FC = () => (
  <CardShell eyebrow="普通人的现实位置" accent={palette.green} width={710} top={135}>
    <div style={{marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
      <div style={{padding: '18px 17px', background: 'rgba(255,211,78,0.10)', borderTop: `5px solid ${palette.yellow}`, fontSize: 21, lineHeight: 1.4, fontWeight: 850}}>建数据中心<br /><span style={{color: palette.yellow, fontSize: 29}}>需要资本</span></div>
      <div style={{padding: '18px 17px', background: 'rgba(62,141,255,0.11)', borderTop: `5px solid ${palette.blue}`, fontSize: 21, lineHeight: 1.4, fontWeight: 850}}>训练大模型<br /><span style={{color: palette.blue, fontSize: 29}}>需要技术团队</span></div>
    </div>
    <div style={{marginTop: 26, color: palette.green, fontSize: 43, lineHeight: 1.2, fontWeight: 950}}>普通人与本地创业者<br />更现实的位置：下游</div>
    <div style={{marginTop: 24, color: palette.muted, fontSize: 22, lineHeight: 1.5}}>吃透一条业务流程，就有机会做成应用、服务或可交付系统。</div>
  </CardShell>
);

const ChaoPositionCard: React.FC = () => {
  const frame = useCurrentFrame();
  const chain = ['上游算力', '中游模型', '甘肃业务', '可交付应用'];
  return (
    <CardShell eyebrow="超哥在兰州选择的位置" accent={palette.green} width={760} top={135}>
      <div style={{marginTop: 22, display: 'grid', gap: 11}}>
        {chain.map((item, index) => {
          const progress = spring({fps, frame: frame - index * 8, config: {damping: 20, stiffness: 180}});
          return <div key={item} style={{position: 'relative', padding: '16px 18px', background: index === 3 ? 'rgba(98,245,163,0.15)' : 'rgba(255,255,255,0.055)', borderLeft: `6px solid ${index === 3 ? palette.green : palette.cyan}`, fontSize: 25, fontWeight: 900, opacity: progress}}><span style={{color: index === 3 ? palette.green : palette.cyan, marginRight: 18}}>0{index + 1}</span>{item}</div>;
        })}
      </div>
      <div style={{marginTop: 24, color: palette.muted, fontSize: 22, lineHeight: 1.5}}>不是再训练一个模型，而是把现成能力接进本地企业真实业务。</div>
    </CardShell>
  );
};

const CtaCard: React.FC = () => (
  <CardShell eyebrow="别急着追概念" accent={palette.yellow} width={720} top={150}>
    <div style={{marginTop: 20, fontSize: 45, lineHeight: 1.22, fontWeight: 950}}>先把这条链看清楚<br />再决定自己站在哪里</div>
    <div style={{marginTop: 28, padding: '17px 20px', background: 'rgba(98,245,163,0.13)', color: palette.green, fontSize: 27, fontWeight: 950}}>关注我 · 我是超哥 · 在兰州记录 AI 创业</div>
  </CardShell>
);

const SoundDesign: React.FC = () => {
  const cues = [
    {time: 1.45, file: 'whoosh-soft.wav', volume: 0.12},
    {time: 1.7, file: 'impact-low.wav', volume: 0.12},
    {time: 4.6, file: 'whoosh-soft.wav', volume: 0.09},
    {time: 5.1, file: 'ui-pop.wav', volume: 0.12},
    {time: 7.3, file: 'ui-pop.wav', volume: 0.12},
    {time: 10.2, file: 'ui-pop.wav', volume: 0.12},
    {time: 13.18, file: 'impact-low.wav', volume: 0.10},
    {time: 14.58, file: 'whoosh-soft.wav', volume: 0.08},
    {time: 20.18, file: 'data-pulse.wav', volume: 0.10},
    {time: 31.76, file: 'whoosh-soft.wav', volume: 0.10},
    {time: 32.15, file: 'ui-pop.wav', volume: 0.12},
    {time: 33.0, file: 'ui-pop.wav', volume: 0.12},
    {time: 33.85, file: 'ui-pop.wav', volume: 0.12},
    {time: 39.08, file: 'confirm-tick.wav', volume: 0.12},
    {time: 56.0, file: 'whoosh-soft.wav', volume: 0.08},
    {time: 94.5, file: 'whoosh-soft.wav', volume: 0.08},
    {time: 115.15, file: 'impact-low.wav', volume: 0.10},
    {time: 119.28, file: 'whoosh-soft.wav', volume: 0.08},
    {time: 133.58, file: 'confirm-tick.wav', volume: 0.10},
    {time: 149.24, file: 'confirm-tick.wav', volume: 0.10},
    {time: 170.0, file: 'whoosh-soft.wav', volume: 0.08},
    {time: 191.72, file: 'data-pulse.wav', volume: 0.10},
    {time: 213.36, file: 'confirm-tick.wav', volume: 0.12},
  ];

  return (
    <>
      {cues.map((cue, index) => (
        <Sequence key={`${cue.time}-${cue.file}-${index}`} from={frames(cue.time)}>
          <Audio src={staticFile(`audio/token-v5/${cue.file}`)} volume={cue.volume} />
        </Sequence>
      ))}
    </>
  );
};

export const TokenV5Talk16x9: React.FC = () => (
  <AbsoluteFill style={{background: palette.night}}>
    <LocalFont />
    <CameraVideo />
    <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(5,11,20,0.20) 0%, rgba(5,11,20,0.02) 48%, rgba(5,11,20,0.08) 100%)'}} />

    <Sequence from={frames(1.5)} durationInFrames={frames(3.12)} premountFor={fps}><SceneFade duration={frames(3.12)}><HookMacroScene /></SceneFade></Sequence>
    <Sequence from={frames(4.62)} durationInFrames={frames(8.94)} premountFor={fps}><SceneFade duration={frames(8.94)}><EraScene /></SceneFade></Sequence>
    <Sequence from={frames(14.62)} durationInFrames={frames(5.4)} premountFor={fps}><SceneFade duration={frames(5.4)}><OrdinaryQuestionCard /></SceneFade></Sequence>
    <Sequence from={frames(20.22)} durationInFrames={frames(10.86)} premountFor={fps}><SceneFade duration={frames(10.86)}><TokenDefinitionCard /></SceneFade></Sequence>
    <Sequence from={frames(31.82)} durationInFrames={frames(7.64)} premountFor={fps}><SceneFade duration={frames(7.64)}><ModelActionScene /></SceneFade></Sequence>
    <Sequence from={frames(40.34)} durationInFrames={frames(15.0)} premountFor={fps}><SceneFade duration={frames(15)}><ConsumptionCard /></SceneFade></Sequence>
    <Sequence from={frames(56.04)} durationInFrames={frames(25.6)} premountFor={fps}><SceneFade duration={frames(25.6)}><ResourceMapCard /></SceneFade></Sequence>
    <Sequence from={frames(82.26)} durationInFrames={frames(11.42)} premountFor={fps}><SceneFade duration={frames(11.42)}><MidstreamCard /></SceneFade></Sequence>
    <Sequence from={frames(94.54)} durationInFrames={frames(24.22)} premountFor={fps}><SceneFade duration={frames(24.22)}><ThreeLayerScene /></SceneFade></Sequence>
    <Sequence from={frames(119.32)} durationInFrames={frames(13.8)} premountFor={fps}><SceneFade duration={frames(13.8)}><ExportCorrectionScene /></SceneFade></Sequence>
    <Sequence from={frames(133.64)} durationInFrames={frames(14.9)} premountFor={fps}><SceneFade duration={frames(14.9)}><GansuEvidenceScene /></SceneFade></Sequence>
    <Sequence from={frames(149.3)} durationInFrames={frames(15.74)} premountFor={fps}><SceneFade duration={frames(15.74)}><LongxiaolangScene /></SceneFade></Sequence>
    <Sequence from={frames(165.78)} durationInFrames={frames(25.44)} premountFor={fps}><SceneFade duration={frames(25.44)}><OrdinaryPositionCard /></SceneFade></Sequence>
    <Sequence from={frames(191.76)} durationInFrames={frames(13.12)} premountFor={fps}><SceneFade duration={frames(13.12)}><ChaoPositionCard /></SceneFade></Sequence>
    <Sequence from={frames(205.6)} durationInFrames={frames(14.08)} premountFor={fps}><SceneFade duration={frames(14.08)}><CtaCard /></SceneFade></Sequence>

    <SoundDesign />
    <TopBrandBar />
    <ProgressBar />
    <BilingualCaptionOverlay captionsSrc="data/TOKEN_20260715_talk01_16x9.bilingual.v1.json" />
  </AbsoluteFill>
);
