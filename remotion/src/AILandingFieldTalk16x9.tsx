import {Audio, Video} from '@remotion/media';
import React, {type CSSProperties, type ReactNode} from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {BilingualCaptionOverlay} from './components/BilingualCaptionOverlay';
import {LocalFont} from './components/LocalFont';

export const AI_LANDING_DURATION_IN_FRAMES = 8499;

const fps = 30;
const frameAt = (seconds: number) => Math.round(seconds * fps);
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

const colors = {
  night: '#06111D',
  panel: 'rgba(8, 24, 38, 0.95)',
  paper: '#F7FAFC',
  ink: '#112130',
  white: '#F7FBFF',
  muted: '#AFC4D5',
  cyan: '#55E6FF',
  blue: '#3E8DFF',
  green: '#62F5A3',
  yellow: '#FFD34E',
  orange: '#FF9C5A',
  red: '#FF7373',
};

type SceneSpec = {
  start: number;
  end: number;
  label: string;
  kind:
    | 'definition'
    | 'geo-definition'
    | 'discovery'
    | 'three-column'
    | 'pipeline'
    | 'download'
    | 'result'
    | 'usage'
    | 'handoff'
    | 'baseline'
    | 'questions'
    | 'foundation';
};

const scenes: SceneSpec[] = [
  {start: 0, end: 19.78, label: '现场目标', kind: 'definition'},
  {start: 19.78, end: 35.54, label: '曝光路径', kind: 'geo-definition'},
  {start: 35.54, end: 47.52, label: '先问业务', kind: 'discovery'},
  {start: 47.52, end: 67.3, label: '找到瓶颈', kind: 'three-column'},
  {start: 67.3, end: 112.24, label: '形成方案', kind: 'pipeline'},
  {start: 112.24, end: 122.6, label: '工具安装', kind: 'download'},
  {start: 122.6, end: 147.92, label: '现场结果', kind: 'result'},
  {start: 147.92, end: 198.2, label: '教会使用', kind: 'usage'},
  {start: 198.2, end: 228.64, label: '方案交接', kind: 'handoff'},
  {start: 228.64, end: 240.25, label: '豆包基线', kind: 'baseline'},
  {start: 240.25, end: 272.26, label: 'GEO 问题', kind: 'questions'},
  {start: 272.26, end: 283.289, label: '先建事实底座', kind: 'foundation'},
];

const useSceneMotion = () => {
  const frame = useCurrentFrame();
  const entered = spring({frame, fps, config: {damping: 19, stiffness: 165, mass: 0.82}});
  return {
    opacity: entered,
    transform: `translateY(${interpolate(entered, [0, 1], [24, 0])}px) scale(${interpolate(
      entered,
      [0, 1],
      [0.985, 1],
    )})`,
  } satisfies CSSProperties;
};

const Grid: React.FC = () => (
  <AbsoluteFill
    style={{
      opacity: 0.16,
      backgroundImage:
        'linear-gradient(rgba(85,230,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(85,230,255,0.22) 1px, transparent 1px)',
      backgroundSize: '64px 64px',
    }}
  />
);

const ProtectedFieldVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const cameraTimes = [0, 19.78, 35.54, 47.52, 67.3, 112.24, 147.92, 198.2, 228.64, 240.25, 272.26, 283.289];
  const scales = [1.1, 1.135, 1.105, 1.14, 1.11, 1.145, 1.115, 1.145, 1.11, 1.14, 1.115, 1.15];
  const x = [-12, 12, -8, 14, -10, 12, -8, 14, -10, 12, -8, 10];
  const y = [3, -7, 4, -8, 3, -7, 4, -8, 3, -7, 4, -6];
  const scale = interpolate(seconds, cameraTimes, scales, {...clamp, easing: Easing.inOut(Easing.cubic)});
  const translateX = interpolate(seconds, cameraTimes, x, {...clamp, easing: Easing.inOut(Easing.cubic)});
  const translateY = interpolate(seconds, cameraTimes, y, {...clamp, easing: Easing.inOut(Easing.cubic)});

  const mutedWindows: Array<[number, number]> = [
    [0, 0.12],
    [47.4, 47.62],
    [54.68, 54.94],
    [240.18, 240.46],
  ];
  const volume = (audioFrame: number) => {
    const t = audioFrame / fps;
    return mutedWindows.some(([start, end]) => t >= start && t <= end) ? 0 : 1;
  };

  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: colors.night}}>
      <Video
        src={staticFile('media/AI_LANDING_20260711_field01_rough_v1.mp4')}
        volume={volume}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'blur(28px) brightness(0.5) saturate(0.78) contrast(1.08)',
          transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
          transformOrigin: '50% 50%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 76% 22%, rgba(62,141,255,0.24), transparent 38%), linear-gradient(90deg, rgba(3,10,18,0.92), rgba(3,10,18,0.5) 55%, rgba(3,10,18,0.78))',
        }}
      />
      <Grid />
    </AbsoluteFill>
  );
};

const Shell: React.FC<{eyebrow: string; title: string; children: ReactNode; accent?: string}> = ({
  eyebrow,
  title,
  children,
  accent = colors.cyan,
}) => {
  const motion = useSceneMotion();
  return (
    <div
      style={{
        ...motion,
        position: 'absolute',
        left: 76,
        right: 76,
        top: 126,
        bottom: 204,
        padding: '34px 40px',
        color: colors.white,
        background: 'linear-gradient(135deg, rgba(7,23,38,0.97), rgba(8,30,48,0.91))',
        borderTop: `8px solid ${accent}`,
        outline: '1px solid rgba(115,222,255,0.24)',
        boxShadow: '0 30px 90px rgba(0,0,0,0.5)',
        fontFamily,
        overflow: 'hidden',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 13, color: accent, fontSize: 21, fontWeight: 900}}>
        <span style={{width: 36, height: 5, background: accent}} />
        {eyebrow}
      </div>
      <div style={{marginTop: 12, fontSize: 52, lineHeight: 1.08, fontWeight: 950, letterSpacing: -1}}>{title}</div>
      {children}
    </div>
  );
};

const Pill: React.FC<{children: ReactNode; color?: string}> = ({children, color = colors.cyan}) => (
  <div
    style={{
      padding: '13px 18px',
      background: `${color}18`,
      outline: `1px solid ${color}88`,
      color,
      fontSize: 24,
      fontWeight: 900,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </div>
);

const Arrow: React.FC = () => <div style={{fontSize: 36, color: colors.cyan, fontWeight: 950}}>→</div>;

const DefinitionScene: React.FC = () => (
  <Shell eyebrow="真实企业现场" title="不是先卖工具，而是先听懂问题">
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginTop: 50}}>
      <div style={{padding: 30, background: 'rgba(85,230,255,0.09)', outline: '1px solid rgba(85,230,255,0.38)'}}>
        <div style={{fontSize: 25, color: colors.muted}}>任务一</div>
        <div style={{marginTop: 16, fontSize: 39, lineHeight: 1.22, fontWeight: 950}}>装上 Codex<br />搭一套剪辑工作流</div>
      </div>
      <div style={{padding: 30, background: 'rgba(98,245,163,0.08)', outline: '1px solid rgba(98,245,163,0.36)'}}>
        <div style={{fontSize: 25, color: colors.muted}}>任务二</div>
        <div style={{marginTop: 16, fontSize: 39, lineHeight: 1.22, fontWeight: 950}}>梳理 GEO<br />增加被发现的机会</div>
      </div>
    </div>
  </Shell>
);

const GeoDefinitionScene: React.FC = () => (
  <Shell eyebrow="GEO · 生成式引擎优化" title="先让 AI 看懂你是谁、能解决什么" accent={colors.green}>
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 62}}>
      <Pill color={colors.green}>企业事实</Pill><Arrow /><Pill color={colors.cyan}>公开内容</Pill><Arrow /><Pill color={colors.blue}>AI 可理解</Pill>
    </div>
    <div style={{marginTop: 50, textAlign: 'center', color: colors.muted, fontSize: 24}}>
      只提高被发现与引用的可能性，不承诺推荐、曝光、咨询或成交
    </div>
  </Shell>
);

const DiscoveryScene: React.FC = () => (
  <Shell eyebrow="需求诊断" title="先问产能，再判断值不值得自动化" accent={colors.yellow}>
    <div style={{marginTop: 66, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24}}>
      <div style={{fontSize: 94, fontWeight: 950, color: colors.yellow}}>7–8</div>
      <div><div style={{fontSize: 37, fontWeight: 900}}>人次 / 天</div><div style={{fontSize: 24, color: colors.muted, marginTop: 10}}>客户现场口述，尚未独立核验</div></div>
    </div>
  </Shell>
);

const ThreeColumnScene: React.FC = () => {
  const items = [
    {no: '01', title: '拍摄', body: '日常持续产生素材', color: colors.cyan},
    {no: '02', title: '剪映', body: '主要依赖手工操作', color: colors.yellow},
    {no: '03', title: '模板', body: '固定流程重复交付', color: colors.green},
  ];
  return (
    <Shell eyebrow="业务瓶颈" title="重复，不等于应该盲目自动化" accent={colors.yellow}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, marginTop: 42}}>
        {items.map((item) => (
          <div key={item.no} style={{padding: 25, minHeight: 205, background: 'rgba(255,255,255,0.045)', borderTop: `5px solid ${item.color}`}}>
            <div style={{fontSize: 17, color: item.color, fontWeight: 900}}>{item.no}</div>
            <div style={{fontSize: 39, fontWeight: 950, marginTop: 18}}>{item.title}</div>
            <div style={{fontSize: 24, color: colors.muted, lineHeight: 1.35, marginTop: 18}}>{item.body}</div>
          </div>
        ))}
      </div>
    </Shell>
  );
};

const PipelineScene: React.FC = () => {
  const nodes = ['真实需求', '模板与素材', 'Agent 讨论', 'Skill 方案', '人工验收'];
  return (
    <Shell eyebrow="资源导向流程" title="把需求变成一条可验证的交付链">
      <div style={{position: 'relative', marginTop: 58, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        {nodes.map((node, index) => (
          <React.Fragment key={node}>
            <div style={{width: 245, minHeight: 120, padding: '22px 15px', display: 'grid', placeItems: 'center', textAlign: 'center', background: index === 4 ? 'rgba(98,245,163,0.14)' : 'rgba(85,230,255,0.09)', outline: `1px solid ${index === 4 ? colors.green : colors.cyan}88`, fontSize: 27, fontWeight: 950}}>
              {node}
            </div>
            {index < nodes.length - 1 ? <Arrow /> : null}
          </React.Fragment>
        ))}
      </div>
      <div style={{marginTop: 42, fontSize: 23, color: colors.muted}}>现场生成的是初步方案；真正落地仍要用真实素材、小步测试和人工验收。</div>
    </Shell>
  );
};

const DownloadScene: React.FC = () => (
  <Shell eyebrow="Codex 安装" title="从官方入口下载 Windows 版本" accent={colors.blue}>
    <div style={{marginTop: 54, display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 30}}>
      <div style={{height: 150, display: 'grid', placeItems: 'center', borderRadius: 28, background: colors.paper, color: colors.ink, fontSize: 74, fontWeight: 950}}>C</div>
      <div><div style={{fontSize: 35, fontWeight: 950}}>官方页面 → 产品 → Codex</div><div style={{marginTop: 18, color: colors.muted, fontSize: 23}}>安装与登录涉及账号、网络和系统权限；本片已隐藏所有现场信息。</div></div>
    </div>
  </Shell>
);

const ResultScene: React.FC = () => (
  <Shell eyebrow="现场初步结果" title="先把剪辑流程写成可讨论的方案" accent={colors.green}>
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 43}}>
      {['流程被拆成明确步骤', '方案与 Skill 可以交接'].map((text, index) => (
        <div key={text} style={{padding: 30, minHeight: 170, background: 'rgba(98,245,163,0.08)', outline: '1px solid rgba(98,245,163,0.38)'}}>
          <div style={{fontSize: 21, color: colors.green, fontWeight: 900}}>0{index + 1}</div>
          <div style={{marginTop: 25, fontSize: 34, lineHeight: 1.25, fontWeight: 950}}>{text}</div>
        </div>
      ))}
    </div>
    <div style={{marginTop: 28, fontSize: 22, color: colors.muted}}>这不是“标准答案”，仍需在真实剪辑任务里验证与调整。</div>
  </Shell>
);

const UsageScene: React.FC = () => {
  const steps = [
    {title: '先交流', text: '把目标和边界讲清楚'},
    {title: '再规划', text: '先看流程，不急着执行'},
    {title: '小步测试', text: '从一个重复环节开始'},
    {title: '人工验收', text: '结果可用，才继续扩大'},
  ];
  return (
    <Shell eyebrow="Codex 使用方法" title="工具能力要放进真实流程里" accent={colors.blue}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginTop: 44}}>
        {steps.map((step, index) => (
          <div key={step.title} style={{padding: '22px 20px', minHeight: 205, background: 'rgba(62,141,255,0.09)', borderTop: `5px solid ${index === 3 ? colors.green : colors.blue}`}}>
            <div style={{fontSize: 18, color: index === 3 ? colors.green : colors.blue, fontWeight: 950}}>0{index + 1}</div>
            <div style={{fontSize: 30, marginTop: 22, fontWeight: 950}}>{step.title}</div>
            <div style={{fontSize: 22, lineHeight: 1.4, marginTop: 16, color: colors.muted}}>{step.text}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop: 27, fontSize: 21, color: colors.muted}}>Computer Use 需用户明确授权，能力受系统权限、环境和安全设置限制。</div>
    </Shell>
  );
};

const HandoffScene: React.FC = () => (
  <Shell eyebrow="方案交接" title="把现场理解，交给客户自己的 Codex" accent={colors.green}>
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, marginTop: 63}}>
      <Pill color={colors.cyan}>需求纪要</Pill><Arrow /><Pill color={colors.blue}>客户 Codex</Pill><Arrow /><Pill color={colors.green}>验证与迭代</Pill>
    </div>
    <div style={{marginTop: 48, textAlign: 'center', fontSize: 23, color: colors.muted}}>客户保留自己的资料、理解与恢复能力；方案不是一次交付就永久有效。</div>
  </Shell>
);

const BaselineScene: React.FC = () => (
  <Shell eyebrow="豆包现场演示" title="先记录“当前有没有被回答提及”" accent={colors.orange}>
    <div style={{marginTop: 50, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26}}>
      <div style={{padding: 28, background: 'rgba(255,156,90,0.09)', outline: '1px solid rgba(255,156,90,0.5)'}}><div style={{fontSize: 23, color: colors.orange}}>当次结果</div><div style={{fontSize: 37, fontWeight: 950, marginTop: 17}}>未出现目标工作室</div></div>
      <div style={{padding: 28, background: 'rgba(255,255,255,0.04)', outline: '1px solid rgba(255,255,255,0.16)'}}><div style={{fontSize: 23, color: colors.muted}}>证据边界</div><div style={{fontSize: 30, lineHeight: 1.3, fontWeight: 900, marginTop: 17}}>一次 AI 回答<br />不等于市场排名</div></div>
    </div>
  </Shell>
);

const QuestionsScene: React.FC = () => (
  <Shell eyebrow="GEO 不先猜答案" title="先收集客户真正会问的问题" accent={colors.yellow}>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 46}}>
      {['这项服务叫什么？', '用户会搜哪些词？', '哪些问题值得做内容？'].map((text, index) => (
        <div key={text} style={{padding: '25px 20px', minHeight: 190, background: 'rgba(255,211,78,0.07)', outline: '1px solid rgba(255,211,78,0.35)'}}>
          <div style={{fontSize: 18, color: colors.yellow, fontWeight: 950}}>问题 0{index + 1}</div>
          <div style={{fontSize: 31, lineHeight: 1.3, marginTop: 28, fontWeight: 950}}>{text}</div>
        </div>
      ))}
    </div>
    <div style={{marginTop: 28, fontSize: 22, color: colors.muted}}>AI 回答不等于真实搜索量，也不能直接作为投放依据。</div>
  </Shell>
);

const FoundationScene: React.FC = () => (
  <Shell eyebrow="最小可验证的一步" title="先把企业事实讲清楚，再谈曝光" accent={colors.green}>
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 58}}>
      <Pill color={colors.green}>做什么</Pill><Arrow /><Pill color={colors.cyan}>服务谁</Pill><Arrow /><Pill color={colors.blue}>解决什么问题</Pill>
    </div>
    <div style={{marginTop: 45, textAlign: 'center', fontSize: 29, fontWeight: 900}}>数字化页面只是起点，持续验证才会形成可信内容。</div>
  </Shell>
);

const sceneComponents: Record<SceneSpec['kind'], React.FC> = {
  definition: DefinitionScene,
  'geo-definition': GeoDefinitionScene,
  discovery: DiscoveryScene,
  'three-column': ThreeColumnScene,
  pipeline: PipelineScene,
  download: DownloadScene,
  result: ResultScene,
  usage: UsageScene,
  handoff: HandoffScene,
  baseline: BaselineScene,
  questions: QuestionsScene,
  foundation: FoundationScene,
};

const TopBars: React.FC = () => {
  const frame = useCurrentFrame();
  const current = scenes.find((scene) => frame / fps >= scene.start && frame / fps < scene.end) ?? scenes[scenes.length - 1];
  return (
    <>
      <div style={{position: 'absolute', left: 54, right: 54, top: 28, height: 52, display: 'flex', alignItems: 'center', fontFamily, color: colors.white, zIndex: 80}}>
        <div style={{width: 10, height: 10, borderRadius: 99, background: colors.green, boxShadow: `0 0 18px ${colors.green}`}} />
        <div style={{marginLeft: 13, fontSize: 20, fontWeight: 950}}>超哥 · 兰州 AI 落地现场</div>
        <div style={{marginLeft: 24, color: colors.cyan, fontSize: 19, fontWeight: 900}}>{current.label}</div>
        <div style={{marginLeft: 'auto', padding: '7px 12px', background: 'rgba(0,0,0,0.54)', color: colors.muted, fontSize: 16, fontWeight: 800}}>真实现场 · 屏幕与人员信息已做不可读处理</div>
      </div>
      <div style={{position: 'absolute', left: 54, right: 54, bottom: 25, height: 4, background: 'rgba(255,255,255,0.16)', zIndex: 90}}>
        <div style={{height: '100%', width: `${(frame / (AI_LANDING_DURATION_IN_FRAMES - 1)) * 100}%`, background: `linear-gradient(90deg, ${colors.blue}, ${colors.cyan}, ${colors.green})`, boxShadow: `0 0 12px ${colors.cyan}`}} />
      </div>
    </>
  );
};

const Sfx: React.FC = () => {
  const cues = [
    {time: 0.35, file: 'impact-low.wav', volume: 0.95},
    {time: 2.25, file: 'ui-pop.wav', volume: 0.92},
    {time: 19.78, file: 'whoosh-soft.wav', volume: 0.95},
    {time: 24.2, file: 'data-pulse.wav', volume: 0.9},
    {time: 35.54, file: 'whoosh-soft.wav', volume: 0.9},
    {time: 47.52, file: 'ui-pop.wav', volume: 0.9},
    {time: 67.3, file: 'impact-low.wav', volume: 0.92},
    {time: 73.0, file: 'data-pulse.wav', volume: 0.88},
    {time: 112.24, file: 'confirm-tick.wav', volume: 0.95},
    {time: 122.6, file: 'whoosh-soft.wav', volume: 0.9},
    {time: 147.92, file: 'ui-pop.wav', volume: 0.9},
    {time: 198.2, file: 'confirm-tick.wav', volume: 0.92},
    {time: 228.64, file: 'impact-low.wav', volume: 0.92},
    {time: 240.25, file: 'data-pulse.wav', volume: 0.9},
    {time: 272.26, file: 'confirm-tick.wav', volume: 0.95},
  ];
  return (
    <>
      {cues.map((cue) => (
        <Sequence key={`${cue.time}-${cue.file}`} from={frameAt(cue.time)} durationInFrames={90} premountFor={15}>
          <Audio src={staticFile(`audio/ai-landing-v1/${cue.file}`)} volume={cue.volume} />
        </Sequence>
      ))}
    </>
  );
};

export const AILandingFieldTalk16x9: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: colors.night, fontFamily}}>
    <LocalFont />
    <ProtectedFieldVideo />
    {scenes.map((scene) => {
      const Component = sceneComponents[scene.kind];
      return (
        <Sequence
          key={scene.kind}
          from={frameAt(scene.start)}
          durationInFrames={frameAt(scene.end) - frameAt(scene.start)}
          premountFor={15}
        >
          <Component />
        </Sequence>
      );
    })}
    <TopBars />
    <Sfx />
    <BilingualCaptionOverlay captionsSrc="data/AI_LANDING_20260711_field01_16x9.bilingual.v1.json" />
  </AbsoluteFill>
);
