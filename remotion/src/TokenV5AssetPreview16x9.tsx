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
import {LocalFont} from './components/LocalFont';

const fps = 30;

const palette = {
  night: '#050B14',
  nightSoft: '#0B1724',
  panel: 'rgba(12, 27, 43, 0.88)',
  panelSoft: 'rgba(17, 39, 60, 0.72)',
  line: 'rgba(117, 222, 255, 0.28)',
  cyan: '#5DE7FF',
  blue: '#3E8DFF',
  yellow: '#FFD34E',
  green: '#6CFFA8',
  red: '#FF6B6B',
  ink: '#F4FAFF',
  muted: '#A9BED0',
  paper: '#F5F8FC',
  darkInk: '#122131',
};

const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const appear = (frame: number, delay = 0, distance = 24) => {
  const progress = spring({
    fps,
    frame: frame - delay,
    config: {damping: 200},
    durationInFrames: 24,
  });

  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

const sceneOpacity = (frame: number, duration: number) =>
  interpolate(frame, [0, 10, duration - 12, duration], [0, 1, 1, 0], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });

const GridBackground: React.FC<{bright?: boolean}> = ({bright = false}) => (
  <AbsoluteFill
    style={{
      background: bright
        ? 'radial-gradient(circle at 72% 18%, rgba(61, 174, 255, 0.22), transparent 34%), linear-gradient(135deg, #F6F9FD 0%, #EAF2F9 100%)'
        : 'radial-gradient(circle at 72% 18%, rgba(55, 157, 255, 0.20), transparent 34%), radial-gradient(circle at 22% 82%, rgba(25, 221, 255, 0.12), transparent 30%), #050B14',
      color: bright ? palette.darkInk : palette.ink,
      fontFamily,
    }}
  >
    <AbsoluteFill
      style={{
        opacity: bright ? 0.14 : 0.22,
        backgroundImage:
          'linear-gradient(rgba(93,231,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(93,231,255,0.22) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }}
    />
  </AbsoluteFill>
);

const TopHud: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 34,
      left: 54,
      right: 54,
      height: 46,
      display: 'flex',
      alignItems: 'center',
      color: palette.ink,
      fontFamily,
      fontSize: 21,
      letterSpacing: 1.2,
      zIndex: 30,
    }}
  >
    <div style={{width: 10, height: 10, borderRadius: 99, background: palette.green, boxShadow: `0 0 18px ${palette.green}`}} />
    <div style={{marginLeft: 12, fontWeight: 800}}>超哥 AI 创业记</div>
    <div style={{marginLeft: 22, color: palette.cyan, fontWeight: 800}}>TOKEN 产业链</div>
    <div style={{marginLeft: 'auto', color: palette.muted}}>V5 视觉预演 · 无配音</div>
  </div>
);

const ProgressRail: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames - 1);
  const pulseProgress = (frame % 180) / 180;

  return (
    <div style={{position: 'absolute', left: 62, right: 62, bottom: 38, height: 38, zIndex: 40, fontFamily}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 10, height: 3, background: 'rgba(150,220,255,0.22)'}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 10,
          width: `${progress * 100}%`,
          height: 3,
          background: `linear-gradient(90deg, ${palette.blue}, ${palette.cyan}, ${palette.green})`,
          boxShadow: `0 0 14px ${palette.cyan}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${pulseProgress * 100}%`,
          top: 3,
          width: 16,
          height: 16,
          borderRadius: 99,
          background: palette.ink,
          boxShadow: `0 0 26px 8px ${palette.cyan}`,
          transform: 'translateX(-8px)',
        }}
      />
      <div style={{position: 'absolute', left: 0, top: 20, color: palette.muted, fontSize: 15}}>提问</div>
      <div style={{position: 'absolute', left: '31%', top: 20, color: palette.muted, fontSize: 15}}>算力</div>
      <div style={{position: 'absolute', left: '62%', top: 20, color: palette.muted, fontSize: 15}}>模型</div>
      <div style={{position: 'absolute', right: 0, top: 20, color: palette.green, fontSize: 15, fontWeight: 800}}>结果</div>
    </div>
  );
};

const TitleBlock: React.FC<{eyebrow: string; title: string; detail?: string; bright?: boolean}> = ({
  eyebrow,
  title,
  detail,
  bright = false,
}) => {
  const frame = useCurrentFrame();
  const ink = bright ? palette.darkInk : palette.ink;

  return (
    <div style={{position: 'absolute', left: 76, top: 112, right: 76, zIndex: 10, fontFamily, color: ink}}>
      <div style={{...appear(frame, 0), display: 'flex', alignItems: 'center', gap: 14, color: bright ? palette.blue : palette.cyan, fontSize: 22, fontWeight: 850}}>
        <span style={{width: 38, height: 5, background: palette.yellow}} />
        {eyebrow}
      </div>
      <div style={{...appear(frame, 5), marginTop: 18, fontSize: 66, lineHeight: 1.08, fontWeight: 950, letterSpacing: -1.5}}>{title}</div>
      {detail ? <div style={{...appear(frame, 12), marginTop: 16, color: bright ? '#52677A' : palette.muted, fontSize: 25, fontWeight: 620}}>{detail}</div> : null}
    </div>
  );
};

const PulseLine: React.FC<{startX: number; endX: number; top: number; delay?: number; color?: string}> = ({
  startX,
  endX,
  top,
  delay = 0,
  color = palette.cyan,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + 42], [0, 1], clamp);
  const travel = ((frame - delay) % 80 + 80) % 80 / 80;
  const active = frame >= delay;

  return (
    <>
      <div style={{position: 'absolute', left: startX, top, width: (endX - startX) * progress, height: 4, background: color, boxShadow: `0 0 16px ${color}`}} />
      {active ? (
        <div
          style={{
            position: 'absolute',
            left: startX + (endX - startX) * travel - 8,
            top: top - 6,
            width: 16,
            height: 16,
            borderRadius: 99,
            background: palette.ink,
            boxShadow: `0 0 22px 7px ${color}`,
          }}
        />
      ) : null}
    </>
  );
};

const InfrastructureNode: React.FC<{
  x: number;
  label: string;
  sub: string;
  index: number;
  tone: string;
}> = ({x, label, sub, index, tone}) => {
  const frame = useCurrentFrame();
  const progress = spring({fps, frame: frame - 16 - index * 12, config: {damping: 200}});
  const barCount = index === 0 ? 6 : index === 1 ? 8 : index === 2 ? 5 : 7;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: 390,
        width: 260,
        height: 300,
        padding: '28px 24px',
        background: palette.panel,
        outline: `1px solid ${tone}66`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.28), 0 0 38px ${tone}18`,
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [42, 0])}px)`,
        fontFamily,
        color: palette.ink,
      }}
    >
      <div style={{fontSize: 18, color: tone, fontWeight: 850}}>0{index + 1}</div>
      <div style={{marginTop: 20, display: 'flex', gap: 8, alignItems: 'flex-end', height: 82}}>
        {Array.from({length: barCount}).map((_, barIndex) => {
          const height = 24 + ((barIndex * 17 + index * 11) % 52);
          const wave = 0.72 + 0.28 * Math.sin((frame + barIndex * 7) / 11);
          return <div key={barIndex} style={{width: 15, height: height * wave, background: tone, opacity: 0.48 + barIndex / (barCount * 2), boxShadow: `0 0 12px ${tone}66`}} />;
        })}
      </div>
      <div style={{marginTop: 26, fontSize: 34, fontWeight: 900}}>{label}</div>
      <div style={{marginTop: 12, color: palette.muted, fontSize: 20, lineHeight: 1.35}}>{sub}</div>
    </div>
  );
};

const MacroChainScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 210;
  const nodes = [
    {x: 88, label: '芯片', sub: '计算被点亮', tone: palette.cyan},
    {x: 442, label: '服务器', sub: '任务进入集群', tone: palette.blue},
    {x: 796, label: '数据中心', sub: '算力规模化运行', tone: palette.green},
    {x: 1150, label: '荒漠光电', sub: '能源进入基础设施', tone: palette.yellow},
    {x: 1504, label: '水电与电网', sub: '能量持续供给', tone: '#85B8FF'},
  ];

  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <GridBackground />
      <Img
        src={staticFile('generated/token-v5-20260715/chip-server-datacenter-cinematic-v1.png')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.34,
          transform: `scale(${interpolate(frame, [0, duration], [1.02, 1.09], clamp)})`,
        }}
      />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(5,11,20,0.36) 0%, rgba(5,11,20,0.68) 42%, rgba(5,11,20,0.96) 100%)'}} />
      <TitleBlock eyebrow="开场转场 · 本地预制版" title="一句提问，整条产业链开始运转" detail="芯片 → 服务器 → 数据中心 → 能源系统" />
      <div style={{position: 'absolute', left: 116, right: 116, top: 344, height: 5, background: 'rgba(93,231,255,0.14)'}} />
      {nodes.map((node, index) => (
        <React.Fragment key={node.label}>
          {index < nodes.length - 1 ? <PulseLine startX={node.x + 260} endX={nodes[index + 1].x} top={540} delay={28 + index * 10} color={index >= 2 ? palette.yellow : palette.cyan} /> : null}
          <InfrastructureNode x={node.x} label={node.label} sub={node.sub} index={index} tone={node.tone} />
        </React.Fragment>
      ))}
      <div style={{position: 'absolute', left: 88, bottom: 118, color: palette.muted, fontFamily, fontSize: 19}}>抽象科技预演已可本地制作；写实宏大场面使用外部视频提示词 A。</div>
    </AbsoluteFill>
  );
};

const EraCard: React.FC<{index: number; era: string; driver: string; detail: string; active?: boolean}> = ({index, era, driver, detail, active = false}) => {
  const frame = useCurrentFrame();
  const progress = spring({fps, frame: frame - 12 - index * 12, config: {damping: 200}});
  const meter = interpolate(frame, [34 + index * 10, 88 + index * 10], [0, 1], clamp);
  const tone = active ? palette.cyan : index === 0 ? palette.yellow : palette.blue;

  return (
    <div style={{position: 'relative', height: 470, padding: '34px 32px', background: active ? 'rgba(15,48,67,0.92)' : palette.panel, outline: `1px solid ${tone}66`, opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [34, 0])}px)`, boxShadow: active ? `0 0 60px ${palette.cyan}1F` : 'none'}}>
      <div style={{fontSize: 20, color: tone, fontWeight: 850}}>0{index + 1} · {era}</div>
      <div style={{marginTop: 70, fontSize: active ? 78 : 64, fontWeight: 950, color: palette.ink}}>{driver}</div>
      <div style={{marginTop: 22, color: palette.muted, fontSize: 25, fontWeight: 650}}>{detail}</div>
      <div style={{position: 'absolute', left: 32, right: 32, bottom: 48, height: 12, background: 'rgba(255,255,255,0.08)'}}>
        <div style={{height: '100%', width: `${meter * 100}%`, background: tone, boxShadow: `0 0 18px ${tone}`}} />
      </div>
      {active ? <div style={{position: 'absolute', right: 26, top: 24, padding: '8px 12px', background: palette.cyan, color: palette.night, fontSize: 16, fontWeight: 900}}>当前变量</div> : null}
    </div>
  );
};

const EraScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 180;

  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <GridBackground />
      <TitleBlock eyebrow="三时代接力" title="石油推动机器，流量推动生意，Token 推动 AI 调用" />
      <div style={{position: 'absolute', left: 78, right: 78, top: 330, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26, fontFamily}}>
        <EraCard index={0} era="工业时代" driver="石油" detail="驱动机器与工业系统" />
        <EraCard index={1} era="互联网时代" driver="流量" detail="连接用户与生意" />
        <EraCard index={2} era="AI 时代" driver="Token" detail="衡量模型处理的信息量" active />
      </div>
    </AbsoluteFill>
  );
};

const ModelPanel: React.FC<{index: number; name: string; action: string; line: string; tone: string}> = ({index, name, action, line, tone}) => {
  const frame = useCurrentFrame();
  const progress = spring({fps, frame: frame - 30 - index * 10, config: {damping: 200}});
  const typed = Math.floor(interpolate(frame, [52 + index * 10, 102 + index * 10], [0, line.length], clamp));

  return (
    <div style={{height: 300, background: '#0D1A28', outline: `1px solid ${tone}66`, padding: '26px 24px', opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [28, 0])}px)`, color: palette.ink, fontFamily}}>
      <div style={{display: 'flex', alignItems: 'center'}}>
        <div style={{width: 34, height: 34, borderRadius: 8, background: tone, color: palette.night, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 950}}>{index + 1}</div>
        <div style={{marginLeft: 12, fontSize: 25, fontWeight: 900}}>{name}</div>
        <div style={{marginLeft: 'auto', color: palette.muted, fontSize: 16}}>操作示意</div>
      </div>
      <div style={{marginTop: 28, color: tone, fontSize: 19, fontWeight: 800}}>{action}</div>
      <div style={{marginTop: 18, minHeight: 96, padding: '16px 18px', background: 'rgba(255,255,255,0.05)', fontSize: 20, lineHeight: 1.5, color: '#DCEAF4'}}>{line.slice(0, typed)}<span style={{color: tone}}>▍</span></div>
    </div>
  );
};

const TokenizerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 210;
  const chunks = ['你问', '豆包', '一句话', '背后', '一整条', '产业链', '运转'];

  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <GridBackground />
      <TitleBlock eyebrow="Token 工作示意" title="一句话，会被拆成一组可计量的信息块" detail="不是虚拟货币，也不是算力本身" />
      <div style={{position: 'absolute', left: 86, right: 86, top: 292, color: palette.ink, fontFamily}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          {chunks.map((chunk, index) => {
            const progress = spring({fps, frame: frame - 8 - index * 5, config: {damping: 200}});
            return (
              <div key={chunk} style={{padding: '14px 20px', background: index % 2 ? 'rgba(62,141,255,0.18)' : 'rgba(93,231,255,0.14)', outline: `1px solid ${index % 2 ? palette.blue : palette.cyan}66`, fontSize: 25, fontWeight: 800, opacity: progress, transform: `scale(${interpolate(progress, [0, 1], [0.82, 1])})`}}>{chunk}</div>
            );
          })}
          <div style={{marginLeft: 'auto', color: palette.green, fontSize: 20, fontWeight: 850}}>输入 → 处理 → 输出</div>
        </div>
        <div style={{marginTop: 42, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22}}>
          <ModelPanel index={0} name="豆包" action="回复一段话" line="我先把问题拆开，再给出一段回复……" tone={palette.cyan} />
          <ModelPanel index={1} name="DeepSeek" action="写一份方案" line="方案分为目标、步骤和验证三部分……" tone={palette.blue} />
          <ModelPanel index={2} name="Kimi" action="分析一份文件" line="文件的三个重点分别是背景、问题与结论……" tone={palette.green} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LayerColumn: React.FC<{index: number; title: string; sell: string; items: string[]; tone: string}> = ({index, title, sell, items, tone}) => {
  const frame = useCurrentFrame();
  const progress = spring({fps, frame: frame - 12 - index * 18, config: {damping: 200}});

  return (
    <div style={{position: 'relative', height: 535, padding: '30px 28px', background: index === 2 ? 'rgba(12,49,42,0.92)' : palette.panel, outline: `1px solid ${tone}66`, opacity: progress, transform: `translateX(${interpolate(progress, [0, 1], [38, 0])}px)`, color: palette.ink, fontFamily}}>
      <div style={{display: 'flex', alignItems: 'center'}}>
        <div style={{fontSize: 18, color: tone, fontWeight: 900}}>0{index + 1}</div>
        <div style={{marginLeft: 14, fontSize: 42, fontWeight: 950}}>{title}</div>
      </div>
      <div style={{marginTop: 28, padding: '14px 16px', background: `${tone}18`, borderLeft: `6px solid ${tone}`, color: tone, fontSize: 24, fontWeight: 900}}>{sell}</div>
      <div style={{marginTop: 26, display: 'grid', gridTemplateColumns: index === 0 ? '1fr 1fr' : '1fr', gap: 10}}>
        {items.map((item, itemIndex) => {
          const itemProgress = spring({fps, frame: frame - 34 - index * 18 - itemIndex * 4, config: {damping: 200}});
          return <div key={item} style={{padding: '10px 13px', background: 'rgba(255,255,255,0.055)', color: '#DCEAF4', fontSize: 19, fontWeight: 650, opacity: itemProgress}}>{item}</div>;
        })}
      </div>
      <div style={{position: 'absolute', left: 28, right: 28, bottom: 30, display: 'flex', gap: 5}}>
        {Array.from({length: 12}).map((_, barIndex) => {
          const height = 8 + ((barIndex * 13 + index * 7) % 34);
          const wave = 0.65 + 0.35 * Math.sin((frame + barIndex * 5) / 10);
          return <div key={barIndex} style={{flex: 1, height: height * wave, alignSelf: 'flex-end', background: tone, opacity: 0.28 + barIndex / 28}} />;
        })}
      </div>
    </div>
  );
};

const LayersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 270;

  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <GridBackground />
      <TitleBlock eyebrow="整条链路" title="上游卖算力，中游卖模型，下游卖结果" detail="V5 用同一条 Token 数据流贯穿三层，而不是三张互不相干的卡" />
      <div style={{position: 'absolute', left: 76, right: 76, top: 300, display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr', gap: 24}}>
        <LayerColumn index={0} title="上游" sell="基础设施与算力" items={['芯片', '服务器', '光模块', '数据中心', '电力', '网络', '冷却系统']} tone={palette.cyan} />
        <LayerColumn index={1} title="中游" sell="模型、平台和服务" items={['大模型公司', '云平台', '智能体平台', 'AI 开发工具']} tone={palette.blue} />
        <LayerColumn index={2} title="下游" sell="客户能用的结果" items={['医疗 / 教育 / 制造', '农业 / 内容 / 电商', '本地企业服务']} tone={palette.green} />
      </div>
      <PulseLine startX={657} endX={682} top={580} delay={52} />
      <PulseLine startX={1192} endX={1217} top={580} delay={70} color={palette.green} />
    </AbsoluteFill>
  );
};

const FlowBox: React.FC<{index: number; label: string; detail: string; x: number; tone: string}> = ({index, label, detail, x, tone}) => {
  const frame = useCurrentFrame();
  const progress = spring({fps, frame: frame - 30 - index * 14, config: {damping: 200}});
  return (
    <div style={{position: 'absolute', left: x, top: 470, width: 285, height: 220, padding: '28px 26px', background: palette.panel, outline: `1px solid ${tone}66`, color: palette.ink, fontFamily, opacity: progress, transform: `scale(${interpolate(progress, [0, 1], [0.86, 1])})`}}>
      <div style={{fontSize: 18, color: tone, fontWeight: 900}}>0{index + 1}</div>
      <div style={{marginTop: 22, fontSize: 35, fontWeight: 950}}>{label}</div>
      <div style={{marginTop: 14, color: palette.muted, fontSize: 19}}>{detail}</div>
    </div>
  );
};

const ExportScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 180;
  const cross = interpolate(frame, [8, 34], [0, 1], clamp);
  const boxes = [
    {label: '电力', detail: '支撑基础设施', tone: palette.yellow},
    {label: '服务器', detail: '执行计算任务', tone: palette.cyan},
    {label: '数据中心', detail: '形成算力服务', tone: palette.blue},
    {label: '网络', detail: '把服务送出去', tone: palette.green},
    {label: '企业终端', detail: '调用模型与应用', tone: '#B58CFF'},
  ];

  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <GridBackground />
      <TitleBlock eyebrow="纠偏" title="“Token 出海”不是装车运走" detail="更准确地看，是电力和基础设施转成算力，再通过网络提供模型服务" />
      <div style={{position: 'absolute', left: 92, top: 296, width: 350, height: 105, background: 'rgba(255,107,107,0.12)', outline: `1px solid ${palette.red}77`, color: palette.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily, fontSize: 25, fontWeight: 850}}>
        Token 像石油一样装车
        <div style={{position: 'absolute', left: 24, top: 49, width: 302 * cross, height: 6, background: palette.red, transform: 'rotate(-13deg)', transformOrigin: 'left center', boxShadow: `0 0 14px ${palette.red}`}} />
      </div>
      {boxes.map((box, index) => (
        <React.Fragment key={box.label}>
          <FlowBox index={index} label={box.label} detail={box.detail} x={78 + index * 361} tone={box.tone} />
          {index < boxes.length - 1 ? <PulseLine startX={363 + index * 361} endX={439 + index * 361} top={580} delay={46 + index * 12} color={box.tone} /> : null}
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};

const EvidenceShell: React.FC<{children: React.ReactNode; source: string; tone: string}> = ({children, source, tone}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{...appear(frame, 10), position: 'absolute', left: 74, right: 74, top: 285, bottom: 108, padding: 28, background: 'rgba(255,255,255,0.98)', boxShadow: '0 28px 90px rgba(0,0,0,0.24)', outline: `6px solid ${tone}`, color: palette.darkInk, fontFamily}}>
      {children}
      <div style={{position: 'absolute', left: 28, right: 28, bottom: 18, color: '#60758A', fontSize: 17}}>来源：{source}　｜　原页必要引用，不代表合作或背书</div>
    </div>
  );
};

const GansuEvidenceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 210;
  const highlight = interpolate(frame, [48, 82], [0, 1], clamp);

  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <GridBackground />
      <TitleBlock eyebrow="甘肃上游节点" title="国家批复甘肃枢纽，设立庆阳数据中心集群" detail="原文还明确提出：打造面向全国的算力保障基地" />
      <EvidenceShell source="国家发展改革委等四部门复函 · 2022-01-12" tone={palette.cyan}>
        <div style={{display: 'grid', gridTemplateColumns: '1.12fr 0.88fr', gap: 28, height: '100%', paddingBottom: 28}}>
          <div style={{position: 'relative', overflow: 'hidden', background: '#EAF3FA'}}>
            <Img src={staticFile('screenshots/20260714_token_gansu_hub_approval.png')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 36%'}} />
            <div style={{position: 'absolute', left: 136, right: 76, bottom: 76, height: 74, outline: `5px solid ${palette.yellow}`, boxShadow: `0 0 0 ${18 * highlight}px rgba(255,211,78,${0.12 * highlight})`, opacity: highlight}} />
          </div>
          <div style={{display: 'grid', gridTemplateRows: '1fr 1fr', gap: 20}}>
            <div style={{padding: 20, background: '#F3F7FA', outline: '1px solid #D8E2EA', overflow: 'hidden'}}>
              <div style={{fontSize: 18, color: palette.blue, fontWeight: 900}}>原文 ②</div>
              <Img src={staticFile('screenshots/20260714_token_gansu_hub_quote.png')} style={{marginTop: 12, width: '100%', height: 116, objectFit: 'contain'}} />
            </div>
            <div style={{padding: 20, background: '#F3F7FA', outline: '1px solid #D8E2EA', overflow: 'hidden'}}>
              <div style={{fontSize: 18, color: palette.green, fontWeight: 900}}>原文 ③</div>
              <Img src={staticFile('screenshots/20260714_token_qingyang_cluster_quote.png')} style={{marginTop: 12, width: '100%', height: 116, objectFit: 'contain'}} />
            </div>
          </div>
        </div>
      </EvidenceShell>
    </AbsoluteFill>
  );
};

const LongxiaolangScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 180;

  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <GridBackground />
      <TitleBlock eyebrow="甘肃下游案例" title="“陇小郎”：AI 进入一个具体行业" detail="只证明行业应用与成果转化动作，不外推医疗效果或商业成功" />
      <EvidenceShell source="甘肃省中医院微信公众号 · 2026-07-14" tone={palette.green}>
        <div style={{display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 34, height: '100%', paddingBottom: 28}}>
          <div style={{overflow: 'hidden', background: '#F5F5F5'}}>
            <Img src={staticFile('screenshots/20260714_token_longxiaolang_top.png')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 8%'}} />
          </div>
          <div style={{padding: '26px 18px'}}>
            <div style={{...appear(frame, 22), display: 'inline-flex', padding: '9px 14px', background: '#E7FFF1', color: '#16784A', fontSize: 18, fontWeight: 900}}>发生在甘肃的行业应用</div>
            <div style={{...appear(frame, 30), marginTop: 30, fontSize: 41, lineHeight: 1.3, fontWeight: 950}}>独家授权签约<br />及首轮成果转化</div>
            <div style={{...appear(frame, 42), marginTop: 28, padding: '22px 24px', background: '#F3F7FA', borderLeft: `7px solid ${palette.green}`, color: '#4A6174', fontSize: 23, lineHeight: 1.55, fontWeight: 650}}>
              原文称相关活动发生在 7 月 8 日至 10 日。视频只用它说明：甘肃已经出现 AI 接入具体行业的下游动作。
            </div>
          </div>
        </div>
      </EvidenceShell>
    </AbsoluteFill>
  );
};

const PositionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 240;
  const chain = [
    {label: '庆阳算力', tone: palette.cyan},
    {label: '模型平台', tone: palette.blue},
    {label: '本地业务', tone: palette.yellow},
    {label: '下游结果', tone: palette.green},
  ];

  return (
    <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>
      <GridBackground />
      <TitleBlock eyebrow="超哥的位置" title="把上游算力和中游模型，接到甘肃本地业务里" detail="最后做成有人用、交得出去的应用" />
      <div style={{position: 'absolute', left: 108, right: 108, top: 410, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 84, color: palette.ink, fontFamily}}>
        {chain.map((item, index) => {
          const progress = spring({fps, frame: frame - 18 - index * 16, config: {damping: 200}});
          return (
            <div key={item.label} style={{position: 'relative', height: 190, background: palette.panel, outline: `1px solid ${item.tone}77`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [34, 0])}px)`}}>
              <div style={{fontSize: 18, color: item.tone, fontWeight: 900}}>0{index + 1}</div>
              <div style={{marginTop: 20, fontSize: 35, fontWeight: 950}}>{item.label}</div>
              {index < chain.length - 1 ? <div style={{position: 'absolute', right: -70, top: 92, width: 56, height: 4, background: item.tone, boxShadow: `0 0 16px ${item.tone}`}} /> : null}
            </div>
          );
        })}
      </div>
      <div style={{...appear(frame, 92), position: 'absolute', left: 480, right: 480, top: 690, padding: '28px 34px', background: 'rgba(8,24,36,0.92)', outline: `2px solid ${palette.green}`, color: palette.ink, textAlign: 'center', fontFamily, boxShadow: `0 0 52px ${palette.green}22`}}>
        <div style={{fontSize: 22, color: palette.green, fontWeight: 900}}>超哥 · 兰州 · 下游交付</div>
        <div style={{marginTop: 14, fontSize: 44, fontWeight: 950}}>先看懂链，再找到自己能站住的位置</div>
      </div>
      <div style={{...appear(frame, 132), position: 'absolute', left: 0, right: 0, bottom: 108, textAlign: 'center', color: palette.muted, fontFamily, fontSize: 23}}>关注我！我是超哥，在兰州记录 AI 创业。</div>
    </AbsoluteFill>
  );
};

export const TokenV5AssetPreview16x9: React.FC = () => {
  return (
    <AbsoluteFill style={{background: palette.night}}>
      <LocalFont />
      <Sequence from={0} durationInFrames={210} premountFor={fps}><MacroChainScene /></Sequence>
      <Sequence from={210} durationInFrames={180} premountFor={fps}><EraScene /></Sequence>
      <Sequence from={390} durationInFrames={210} premountFor={fps}><TokenizerScene /></Sequence>
      <Sequence from={600} durationInFrames={270} premountFor={fps}><LayersScene /></Sequence>
      <Sequence from={870} durationInFrames={180} premountFor={fps}><ExportScene /></Sequence>
      <Sequence from={1050} durationInFrames={210} premountFor={fps}><GansuEvidenceScene /></Sequence>
      <Sequence from={1260} durationInFrames={180} premountFor={fps}><LongxiaolangScene /></Sequence>
      <Sequence from={1440} durationInFrames={240} premountFor={fps}><PositionScene /></Sequence>
      <TopHud />
      <ProgressRail />
    </AbsoluteFill>
  );
};
