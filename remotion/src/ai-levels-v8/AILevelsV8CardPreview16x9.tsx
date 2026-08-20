import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const FPS = 30;
const SCENE_SECONDS = 5;
const SCENE_FRAMES = FPS * SCENE_SECONDS;
export const AI_LEVELS_V8_PREVIEW_DURATION_IN_FRAMES = SCENE_FRAMES * 8;

const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

type Tone = 'blue' | 'teal' | 'coral' | 'amber' | 'ink' | 'green';

const colors: Record<Tone, string> = {
  blue: '#4D8DFF',
  teal: '#21B7A8',
  coral: '#F06B55',
  amber: '#E8A93C',
  ink: '#253246',
  green: '#58A96B',
};

type Tool = {
  label: string;
  mark: string;
  tone: Tone;
  icon?: string;
};

const tool = (label: string, mark: string, tone: Tone, icon?: string): Tool => ({
  label,
  mark,
  tone,
  icon,
});

const tools = {
  doubao: tool('豆包', '豆', 'blue', 'brands/ai-levels/doubao.png'),
  deepseek: tool('DeepSeek', 'D', 'blue', 'brands/ai-levels/deepseek.png'),
  kimi: tool('Kimi', 'K', 'ink', 'brands/ai-levels/kimi.png'),
  qianwen: tool('千问', 'Q', 'amber'),
  kimiDocs: tool('Kimi 文档', 'K', 'ink', 'brands/ai-levels/kimi.png'),
  feishu: tool('飞书表格', '飞', 'blue'),
  qianwenOffice: tool('千问办公', 'Q', 'amber'),
  workbuddy: tool('WorkBuddy', 'W', 'green', 'brands/ai-levels/workbuddy.png'),
  n8n: tool('n8n', 'N', 'coral', 'brands/ai-levels/n8n.svg'),
  dify: tool('Dify', 'D', 'teal', 'brands/ai-levels/dify.svg'),
  zapier: tool('Zapier', 'Z', 'amber', 'brands/ai-levels/zapier.svg'),
  codex: tool('Codex', 'C', 'ink'),
  claude: tool('Claude Code', 'CC', 'amber', 'brands/ai-levels/claude.png'),
  cursor: tool('Cursor', 'C', 'blue', 'brands/ai-levels/cursor.png'),
  harness: tool('Agent Harness', 'H', 'coral'),
  github: tool('GitHub', 'GH', 'ink', 'brands/ai-levels/github.svg'),
  gitee: tool('Gitee', 'G', 'coral', 'brands/ai-levels/gitee.svg'),
  git: tool('Git', 'G', 'amber', 'brands/ai-levels/git.svg'),
  docker: tool('Docker', 'D', 'blue', 'brands/ai-levels/docker.svg'),
};

const enter = (frame: number, fps: number, delay = 0) =>
  spring({frame: frame - delay, fps, config: {damping: 18, stiffness: 130, mass: 0.75}});

const MockSpeaker: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 38) * 5;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1050,
        height: 1080,
        backgroundColor: '#E8E4DF',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: 170,
          backgroundColor: '#D6E0DD',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 128,
          top: 208,
          width: 680,
          height: 690,
          transform: `translateY(${drift}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 228,
            top: 0,
            width: 220,
            height: 245,
            borderRadius: '50%',
            backgroundColor: '#B8B1AA',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 86,
            top: 210,
            width: 505,
            height: 500,
            borderRadius: '180px 180px 36px 36px',
            backgroundColor: '#59636B',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 30,
            top: 350,
            width: 210,
            height: 78,
            borderRadius: 40,
            backgroundColor: '#78848A',
            transform: 'rotate(-18deg)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 335,
            width: 215,
            height: 78,
            borderRadius: 40,
            backgroundColor: '#78848A',
            transform: 'rotate(22deg)',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 52,
          bottom: 38,
          padding: '12px 18px',
          borderRadius: 6,
          backgroundColor: 'rgba(255,255,255,0.82)',
          color: '#54606C',
          fontFamily,
          fontSize: 24,
          fontWeight: 650,
        }}
      >
        原片人物安全区，正式版按脸部和手势重新定位
      </div>
    </div>
  );
};

const BrandTag: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      left: 50,
      top: 38,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      color: '#17222E',
      fontFamily,
      fontSize: 25,
      fontWeight: 750,
    }}
  >
    <span style={{width: 10, height: 10, backgroundColor: '#21B7A8'}} />
    超哥AI创业记
  </div>
);

const ToolPill: React.FC<{item: Tool; index: number}> = ({item, index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = enter(frame, fps, 16 + index * 5);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 48,
        padding: '0 14px 0 8px',
        borderRadius: 6,
        backgroundColor: '#FFFFFF',
        border: '1px solid rgba(28,45,61,0.13)',
        boxShadow: '0 8px 18px rgba(31,47,62,0.08)',
        transform: `translateY(${(1 - p) * 14}px) scale(${0.96 + p * 0.04})`,
        opacity: p,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 5,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          backgroundColor: item.icon ? '#F6F7F8' : colors[item.tone],
          color: '#FFFFFF',
          fontFamily,
          fontSize: item.mark.length > 1 ? 12 : 18,
          fontWeight: 850,
        }}
      >
        {item.icon ? (
          <Img src={staticFile(item.icon)} style={{width: 27, height: 27, objectFit: 'contain'}} />
        ) : (
          item.mark
        )}
      </span>
      <span style={{fontFamily, fontSize: 21, fontWeight: 720, color: '#22303C'}}>{item.label}</span>
    </div>
  );
};

const ToolRow: React.FC<{items: Tool[]}> = ({items}) => (
  <div style={{display: 'flex', flexWrap: 'wrap', gap: 10, minHeight: 48}}>
    {items.map((item, index) => <ToolPill key={`${item.label}-${index}`} item={item} index={index} />)}
  </div>
);

const Panel: React.FC<{
  number: string;
  title: string;
  kicker: string;
  tone: Tone;
  tools?: Tool[];
  children: React.ReactNode;
}> = ({number, title, kicker, tone, tools: sceneTools, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = enter(frame, fps);
  return (
    <div
      style={{
        position: 'absolute',
        right: 58,
        top: 74,
        width: 760,
        height: 900,
        padding: '34px 38px',
        boxSizing: 'border-box',
        borderRadius: 8,
        backgroundColor: 'rgba(248,250,251,0.82)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(24,42,59,0.12)',
        boxShadow: '0 18px 48px rgba(27,42,56,0.13)',
        transform: `translateX(${(1 - p) * 45}px)`,
        opacity: p,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
        <div
          style={{
            width: 66,
            height: 66,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 7,
            backgroundColor: colors[tone],
            color: '#FFFFFF',
            fontFamily,
            fontSize: 34,
            fontWeight: 850,
          }}
        >
          {number}
        </div>
        <div>
          <div style={{fontFamily, fontSize: 46, fontWeight: 820, color: '#192631'}}>{title}</div>
          <div style={{fontFamily, fontSize: 22, fontWeight: 650, color: colors[tone], marginTop: 5}}>{kicker}</div>
        </div>
      </div>
      {sceneTools ? <div style={{marginTop: 24}}><ToolRow items={sceneTools} /></div> : null}
      <div style={{marginTop: 28, height: sceneTools ? 620 : 700}}>{children}</div>
    </div>
  );
};

const RevealBox: React.FC<{
  children: React.ReactNode;
  delay?: number;
  tone?: Tone;
  style?: React.CSSProperties;
}> = ({children, delay = 0, tone = 'ink', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = enter(frame, fps, delay);
  return (
    <div
      style={{
        borderRadius: 7,
        border: `1px solid ${colors[tone]}33`,
        backgroundColor: '#FFFFFF',
        color: '#25323E',
        fontFamily,
        transform: `translateY(${(1 - p) * 18}px)`,
        opacity: p,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const OverviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entries = [
    ['01', '问答', '答案'],
    ['02', '任务', '交付物'],
    ['03', '流程', '重复接力'],
    ['04', '组装', '本地系统'],
    ['05', '开源改造', '持续维护'],
    ['06', '系统经营', '责任闭环'],
  ];
  return (
    <Panel number="6" title="AI 工作接力地图" kicker="不是工具排名，是工作推进到哪一棒" tone="teal">
      <div style={{position: 'relative', marginTop: 8, height: 610}}>
        <div style={{position: 'absolute', left: 46, top: 40, width: 4, height: 500, backgroundColor: '#C8D4D6'}} />
        {entries.map(([num, title, detail], index) => {
          const p = enter(frame, fps, 12 + index * 10);
          return (
            <div
              key={num}
              style={{
                position: 'absolute',
                left: 0,
                top: 2 + index * 91,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                opacity: p,
                transform: `translateX(${(1 - p) * 24}px)`,
              }}
            >
              <div style={{width: 96, height: 62, borderRadius: 7, backgroundColor: index < 3 ? '#21B7A8' : '#253246', color: '#fff', display: 'grid', placeItems: 'center', fontFamily, fontSize: 28, fontWeight: 850}}>{num}</div>
              <div style={{flex: 1, height: 62, borderRadius: 7, backgroundColor: '#FFFFFF', border: '1px solid #D9E0E2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px'}}>
                <strong style={{fontFamily, fontSize: 28, color: '#1D2934'}}>{title}</strong>
                <span style={{fontFamily, fontSize: 20, color: '#66747F'}}>{detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

const QaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [36, 104], [0, 1], clamp);
  return (
    <Panel number="1" title="问答" kicker="人提问，AI 给参考答案" tone="blue" tools={[tools.doubao, tools.deepseek, tools.kimi, tools.qianwen]}>
      <RevealBox delay={32} tone="blue" style={{padding: 22, fontSize: 27, fontWeight: 720}}>
        你：帮我整理一段客户回复
      </RevealBox>
      <RevealBox delay={52} tone="teal" style={{padding: 22, marginTop: 18, fontSize: 26, lineHeight: 1.55}}>
        AI：先给你一份可修改的参考答案……
      </RevealBox>
      <div style={{marginTop: 38, height: 8, backgroundColor: '#E3E8EA', overflow: 'hidden'}}>
        <div style={{width: `${progress * 100}%`, height: '100%', backgroundColor: '#F06B55'}} />
      </div>
      <div style={{marginTop: 14, color: '#D65342', fontFamily, fontSize: 29, fontWeight: 820}}>
        边界：答案停在聊天框
      </div>
      <div style={{marginTop: 18, color: '#5D6973', fontFamily, fontSize: 22, lineHeight: 1.55}}>
        修改、发送、对象和结果责任，仍由你接住。
      </div>
    </Panel>
  );
};

const TaskScene: React.FC = () => {
  const nodes = [
    ['资料', '咨询记录、会议纪要'],
    ['要求', '格式、对象、不能错'],
    ['交付物', '表格、简报、文档'],
  ];
  return (
    <Panel number="2" title="任务" kicker="资料 + 要求 → 可验收交付物" tone="green" tools={[tools.kimiDocs, tools.feishu, tools.qianwenOffice, tools.workbuddy]}>
      <div style={{display: 'grid', gap: 16}}>
        {nodes.map(([name, detail], index) => (
          <RevealBox key={name} delay={35 + index * 14} tone={index === 2 ? 'green' : 'ink'} style={{padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <strong style={{fontFamily, fontSize: 29}}>{name}</strong>
            <span style={{fontFamily, fontSize: 21, color: '#68757F'}}>{detail}</span>
          </RevealBox>
        ))}
      </div>
      <RevealBox delay={90} tone="coral" style={{marginTop: 30, padding: 24, backgroundColor: '#FFF7F4', textAlign: 'center'}}>
        <div style={{fontFamily, fontSize: 30, fontWeight: 850, color: '#D95A45'}}>人工验收</div>
        <div style={{fontFamily, fontSize: 21, color: '#6B625E', marginTop: 9}}>名字、数字、结论，确认后才能交出去</div>
      </RevealBox>
    </Panel>
  );
};

const FlowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = ['表单进入', '内容分类', '写入表格', '提醒负责人', '人工确认'];
  return (
    <Panel number="3" title="流程" kicker="不是做一次，是每天稳定接力" tone="coral" tools={[tools.n8n, tools.dify, tools.zapier]}>
      <div style={{marginTop: 20}}>
        {steps.map((name, index) => {
          const p = enter(frame, FPS, 34 + index * 18);
          const human = index === steps.length - 1;
          return (
            <React.Fragment key={name}>
              <div style={{height: 70, display: 'flex', alignItems: 'center', gap: 15, opacity: p, transform: `translateX(${(1 - p) * 24}px)`}}>
                <div style={{width: 42, height: 42, borderRadius: '50%', backgroundColor: human ? '#F06B55' : '#21B7A8', color: '#FFFFFF', display: 'grid', placeItems: 'center', fontFamily, fontSize: 21, fontWeight: 850}}>{index + 1}</div>
                <div style={{flex: 1, height: 58, borderRadius: 7, backgroundColor: human ? '#FFF1ED' : '#FFFFFF', border: `1px solid ${human ? '#F6B3A6' : '#D8E2E3'}`, display: 'flex', alignItems: 'center', padding: '0 20px', fontFamily, fontSize: 26, fontWeight: 720}}>{name}</div>
              </div>
              {index < steps.length - 1 ? <div style={{height: 14, width: 3, marginLeft: 20, backgroundColor: '#BED0D2'}} /> : null}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{marginTop: 20, color: '#B04D3B', fontFamily, fontSize: 22, fontWeight: 760}}>对外动作必须能暂停、确认和追责</div>
    </Panel>
  );
};

const AssembleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const nodes = [
    {label: '本地文件', x: 20, y: 26},
    {label: '网站', x: 450, y: 26},
    {label: 'API', x: 20, y: 255},
    {label: '运行命令', x: 430, y: 255},
  ];
  return (
    <Panel number="4" title="组装" kicker="把 AI 接进电脑和小系统" tone="blue" tools={[tools.codex, tools.claude, tools.cursor, tools.harness]}>
      <div style={{position: 'relative', height: 390}}>
        <div style={{position: 'absolute', left: 225, top: 130, width: 210, height: 100, borderRadius: 8, backgroundColor: '#253246', color: '#FFFFFF', display: 'grid', placeItems: 'center', fontFamily, fontSize: 30, fontWeight: 820}}>工作区</div>
        {nodes.map((node, index) => {
          const p = enter(frame, FPS, 35 + index * 13);
          return (
            <div key={node.label} style={{position: 'absolute', left: node.x, top: node.y, width: 190, height: 62, borderRadius: 7, border: '1px solid #BDD2DF', backgroundColor: '#FFFFFF', display: 'grid', placeItems: 'center', fontFamily, fontSize: 23, fontWeight: 720, opacity: p, transform: `scale(${0.92 + p * 0.08})`}}>{node.label}</div>
          );
        })}
        <svg width="650" height="390" style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <line x1="210" y1="58" x2="300" y2="150" stroke="#76A8C8" strokeWidth="3" />
          <line x1="450" y1="58" x2="360" y2="150" stroke="#76A8C8" strokeWidth="3" />
          <line x1="210" y1="285" x2="300" y2="225" stroke="#76A8C8" strokeWidth="3" />
          <line x1="430" y1="285" x2="360" y2="225" stroke="#76A8C8" strokeWidth="3" />
        </svg>
      </div>
      <RevealBox delay={92} tone="coral" style={{padding: 22, backgroundColor: '#FFF6F2'}}>
        <div style={{fontFamily, fontSize: 26, fontWeight: 820, color: '#D95A45'}}>环境 · 接口 · 权限 · 配置 · 报错</div>
        <div style={{fontFamily, fontSize: 20, color: '#6A625E', marginTop: 8}}>看它改了什么，也要看结果是否真的跑通</div>
      </RevealBox>
    </Panel>
  );
};

const OpenSourceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = ['拉取代码', '安装依赖', '部署运行', '修改适配', '更新维护', '备份恢复'];
  return (
    <Panel number="5" title="开源改造" kicker="下载只是开始，维护才是后半程" tone="ink" tools={[tools.github, tools.gitee, tools.git, tools.docker]}>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14}}>
        {steps.map((step, index) => {
          const p = enter(frame, FPS, 34 + index * 12);
          return (
            <div key={step} style={{height: 88, borderRadius: 7, backgroundColor: index < 3 ? '#F5F7F8' : '#EAF3F0', border: '1px solid #D4DEE0', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px', opacity: p, transform: `translateY(${(1 - p) * 16}px)`}}>
              <span style={{fontFamily, fontSize: 18, color: '#72808A'}}>0{index + 1}</span>
              <strong style={{fontFamily, fontSize: 27, color: '#26333F', marginTop: 4}}>{step}</strong>
            </div>
          );
        })}
      </div>
      <RevealBox delay={105} tone="amber" style={{marginTop: 26, padding: 22, textAlign: 'center', backgroundColor: '#FFF9EC'}}>
        <strong style={{fontFamily, fontSize: 29, color: '#A56D16'}}>下载成功 ≠ 已经拥有产品</strong>
      </RevealBox>
    </Panel>
  );
};

const SystemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const nodes = ['模型 / API', '流程', '知识库', '版本部署', '权限', '日志', '备份', '人工审核'];
  return (
    <Panel number="6" title="系统经营" kicker="没有第六层神器，只有责任闭环" tone="teal" tools={[tools.dify, tools.n8n]}>
      <div style={{position: 'relative', height: 500}}>
        <div style={{position: 'absolute', left: 220, top: 165, width: 220, height: 130, borderRadius: 8, backgroundColor: '#253246', color: '#FFFFFF', display: 'grid', placeItems: 'center', textAlign: 'center', fontFamily, fontSize: 31, fontWeight: 850, zIndex: 2}}>真实业务<br /><span style={{fontSize: 20, color: '#AFC1C9'}}>有人使用 · 有人负责</span></div>
        {nodes.map((node, index) => {
          const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
          const x = 282 + Math.cos(angle) * 245;
          const y = 196 + Math.sin(angle) * 165;
          const p = enter(frame, FPS, 35 + index * 8);
          return (
            <div key={node} style={{position: 'absolute', left: x, top: y, width: 140, height: 54, borderRadius: 7, backgroundColor: index >= 4 ? '#FFF2EE' : '#FFFFFF', border: `1px solid ${index >= 4 ? '#F1B5A9' : '#C9DADB'}`, display: 'grid', placeItems: 'center', textAlign: 'center', fontFamily, fontSize: 19, fontWeight: 720, opacity: p, transform: `translate(-50%, -50%) scale(${0.9 + p * 0.1})`, zIndex: 3}}>{node}</div>
          );
        })}
      </div>
      <div style={{fontFamily, fontSize: 23, lineHeight: 1.55, color: '#52606B', marginTop: 8}}>
        真正难的是：谁维护、谁能看、谁接错、谁恢复。
      </div>
    </Panel>
  );
};

const ClosingScene: React.FC = () => {
  const rows = [
    ['整理资料最费时', '先练第 2 层：任务'],
    ['每天重复搬运', '去看第 3 层：流程'],
    ['准备接文件和接口', '再碰第 4 层以后'],
  ];
  return (
    <Panel number="?" title="你现在在哪一层" kicker="从最费时、最容易错的那一步反查" tone="coral">
      <div style={{display: 'grid', gap: 20, marginTop: 30}}>
        {rows.map(([problem, answer], index) => (
          <RevealBox key={problem} delay={24 + index * 20} tone={index === 2 ? 'blue' : 'teal'} style={{padding: 24}}>
            <div style={{fontFamily, fontSize: 23, color: '#6A7781'}}>{problem}</div>
            <div style={{fontFamily, fontSize: 31, color: '#1F2D39', fontWeight: 850, marginTop: 8}}>{answer}</div>
          </RevealBox>
        ))}
      </div>
      <RevealBox delay={94} tone="coral" style={{marginTop: 32, padding: 26, backgroundColor: '#FFF3EF'}}>
        <div style={{fontFamily, fontSize: 31, fontWeight: 850, color: '#D65742'}}>先看 AI 已经替你干到哪儿</div>
        <div style={{fontFamily, fontSize: 23, color: '#655E5A', marginTop: 10}}>再决定下一棒由谁接住</div>
      </RevealBox>
    </Panel>
  );
};

const sceneComponents = [OverviewScene, QaScene, TaskScene, FlowScene, AssembleScene, OpenSourceScene, SystemScene, ClosingScene];

const SceneAudio: React.FC<{index: number}> = ({index}) => {
  const secondary = index === 6 ? 'system-alert.wav' : index === 2 || index === 3 ? 'human-check.wav' : 'rail-connect.wav';
  return (
    <>
      <Audio src={staticFile('audio/ai-levels-v8/level-open.wav')} volume={0.72} />
      <Sequence from={44} durationInFrames={32}>
        <Audio src={staticFile('audio/ai-levels-v8/tool-pop.wav')} volume={0.72} />
      </Sequence>
      <Sequence from={88} durationInFrames={40}>
        <Audio src={staticFile(`audio/ai-levels-v8/${secondary}`)} volume={0.76} />
      </Sequence>
    </>
  );
};

const Preview: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <AbsoluteFill style={{backgroundColor: '#DDE3E1'}}>
    <MockSpeaker />
    <BrandTag />
    {sceneComponents.map((Scene, index) => (
      <Sequence key={index} from={index * SCENE_FRAMES} durationInFrames={SCENE_FRAMES}>
        <Scene />
        {soundEnabled ? <SceneAudio index={index} /> : null}
      </Sequence>
    ))}
    <div style={{position: 'absolute', right: 62, bottom: 28, fontFamily, fontSize: 18, color: '#7A858D'}}>V8 技术预演 · 非正式成片</div>
  </AbsoluteFill>
);

export const AILevelsV8CardPreview16x9WithSfx: React.FC = () => <Preview soundEnabled />;
export const AILevelsV8CardPreview16x9NoSfx: React.FC = () => <Preview soundEnabled={false} />;
