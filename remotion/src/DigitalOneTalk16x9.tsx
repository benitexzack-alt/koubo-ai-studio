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
import {LocalFont} from './components/LocalFont';

const palette = {
  paper: '#F4F7FB',
  ink: '#111820',
  muted: '#5C6875',
  blue: '#087EA4',
  blueDeep: '#07516B',
  blueSoft: '#DDF4FA',
  yellow: '#F6C445',
  green: '#1F9D68',
  greenSoft: '#E7F7EF',
  orange: '#E9693A',
  orangeSoft: '#FFF0E8',
  red: '#C94343',
  white: '#FFFFFF',
};

const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const fps = 30;
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const secondsToFrames = (seconds: number) => Math.round(seconds * fps);

const sceneOpacity = (frame: number, duration: number) => {
  const ramp = Math.max(1, Math.min(10, Math.floor(duration / 3)));
  return Math.min(
    interpolate(frame, [0, ramp], [0, 1], clamp),
    interpolate(frame, [duration - ramp, duration], [1, 0], clamp),
  );
};

const enter = (frame: number, delay = 0, distance = 24): CSSProperties => {
  const progress = spring({
    fps,
    frame: frame - delay,
    config: {damping: 20, stiffness: 165, mass: 0.8},
  });

  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

const CameraVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  const times = [0, 6.4, 13.94, 24.76, 34.72, 50.88, 82.56, 97.6, 112.62, 120.18, 145.92, 152.94, 171.62, 174.85];
  const scales = [1.012, 1.034, 1.022, 1.018, 1.038, 1.018, 1.026, 1.018, 1.043, 1.02, 1.036, 1.022, 1.034, 1.034];
  const x = [0, 6, 4, 8, 8, 0, 6, 5, 10, 6, 9, 6, 8, 8];
  const scale = interpolate(seconds, times, scales, {...clamp, easing: Easing.inOut(Easing.cubic)});
  const translateX = interpolate(seconds, times, x, {...clamp, easing: Easing.inOut(Easing.cubic)});

  return (
    <Video
      src={staticFile('media/DIGITAL1_20260714_talk01_16x9_input.mp4')}
      objectFit="cover"
      style={{
        width: '100%',
        height: '100%',
        filter: 'contrast(1.025) saturate(1.045) brightness(1.02)',
        transform: `translate3d(${translateX}px, 0, 0) scale(${scale})`,
        transformOrigin: '67% 38%',
      }}
    />
  );
};

const SceneFade: React.FC<{duration: number; children: ReactNode}> = ({duration, children}) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{opacity: sceneOpacity(frame, duration)}}>{children}</AbsoluteFill>;
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

const CardShell: React.FC<{
  eyebrow: string;
  accent?: string;
  width?: number;
  top?: number;
  children: ReactNode;
}> = ({eyebrow, accent = palette.blue, width = 720, top = 130, children}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...enter(frame, 0, 30),
        position: 'absolute',
        left: 64,
        top,
        width,
        padding: '25px 28px 28px',
        background: 'rgba(248,251,255,0.965)',
        borderTop: `8px solid ${accent}`,
        boxShadow: '0 24px 68px rgba(10,27,43,0.24)',
        color: palette.ink,
        fontFamily,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12, color: palette.muted, fontSize: 19, fontWeight: 850}}>
        <span style={{width: 30, height: 4, background: accent}} />
        {eyebrow}
      </div>
      {children}
    </div>
  );
};

const DefinitionCard: React.FC<{
  eyebrow: string;
  title: string;
  detail?: string;
  items?: string[];
  disclaimer?: string;
  accent?: string;
}> = ({eyebrow, title, detail, items, disclaimer, accent = palette.yellow}) => {
  const frame = useCurrentFrame();
  return (
    <CardShell eyebrow={eyebrow} accent={accent}>
      <div style={{...enter(frame, 4), marginTop: 22, fontSize: 56, lineHeight: 1.03, fontWeight: 950}}>{title}</div>
      {detail ? (
        <div style={{...enter(frame, 10), marginTop: 18, color: palette.muted, fontSize: 25, lineHeight: 1.42, fontWeight: 700}}>{detail}</div>
      ) : null}
      {items ? (
        <div style={{marginTop: 28, display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 10}}>
          {items.map((item, index) => (
            <div
              key={item}
              style={{
                ...enter(frame, 15 + index * 9, 18),
                padding: '16px 10px',
                background: index === items.length - 1 ? palette.greenSoft : palette.white,
                borderTop: `5px solid ${index === items.length - 1 ? palette.green : palette.blue}`,
                textAlign: 'center',
                fontSize: 23,
                lineHeight: 1.22,
                fontWeight: 880,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      ) : null}
      {disclaimer ? (
        <div style={{...enter(frame, 42), marginTop: 22, padding: '12px 15px', background: '#EEF3F7', color: palette.muted, fontSize: 19, lineHeight: 1.35, fontWeight: 760}}>
          {disclaimer}
        </div>
      ) : null}
    </CardShell>
  );
};

const FragmentedMap: React.FC = () => {
  const frame = useCurrentFrame();
  const nodes = [
    {title: '个人聊天', detail: '客户', x: 0, y: 0, color: palette.blue},
    {title: '老板经验', detail: '报价', x: 350, y: 0, color: palette.yellow},
    {title: '纸质记录', detail: '库存', x: 0, y: 142, color: palette.orange},
    {title: '员工记忆', detail: '售后', x: 350, y: 142, color: palette.green},
  ];
  const lineProgress = interpolate(frame, [20, 58], [0, 1], clamp);

  return (
    <CardShell eyebrow="经营信息现状" accent={palette.blue} top={118}>
      <div style={{...enter(frame, 3), marginTop: 18, fontSize: 43, lineHeight: 1.08, fontWeight: 950}}>信息散在四个地方</div>
      <div style={{position: 'relative', marginTop: 24, height: 274}}>
        <svg width="664" height="274" viewBox="0 0 664 274" style={{position: 'absolute', inset: 0}}>
          <path d="M156 52 C250 52 250 52 350 52 M156 194 C250 194 250 194 350 194 M80 98 C80 124 80 140 80 142 M430 98 C430 124 430 140 430 142" fill="none" stroke="#77BDD1" strokeWidth="4" strokeDasharray="9 8" strokeDashoffset={interpolate(lineProgress, [0, 1], [110, 0])} />
        </svg>
        {nodes.map((node, index) => (
          <div
            key={node.title}
            style={{
              ...enter(frame, 10 + index * 8, 20),
              position: 'absolute',
              left: node.x,
              top: node.y,
              width: 314,
              padding: '17px 18px',
              background: palette.white,
              borderLeft: `7px solid ${node.color}`,
              boxShadow: '0 10px 24px rgba(19,43,60,0.1)',
            }}
          >
            <div style={{color: palette.muted, fontSize: 18, fontWeight: 800}}>{node.detail}</div>
            <div style={{marginTop: 4, fontSize: 27, fontWeight: 920}}>{node.title}</div>
          </div>
        ))}
      </div>
      <div style={{...enter(frame, 52), padding: '13px 17px', background: palette.ink, color: palette.white, fontSize: 22, lineHeight: 1.35, fontWeight: 820}}>
        结果：AI 看不见真实经营数据
      </div>
    </CardShell>
  );
};

const EvidenceShell: React.FC<{
  accent: string;
  children: ReactNode;
}> = ({accent, children}) => (
  <AbsoluteFill style={{background: palette.paper, color: palette.ink, fontFamily}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 10, background: accent}} />
    {children}
  </AbsoluteFill>
);

const EvidenceNotice: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <EvidenceShell accent={palette.blue}>
      <div style={{position: 'absolute', left: 70, top: 132, width: 590}}>
        <div style={{...enter(frame, 2), color: palette.blue, fontSize: 22, fontWeight: 900}}>官方文件 · 身份核对</div>
        <div style={{...enter(frame, 8), marginTop: 18, fontSize: 53, lineHeight: 1.08, fontWeight: 950}}>工信部 2024 年评测指标</div>
        <div style={{...enter(frame, 15), marginTop: 24, color: palette.muted, fontSize: 26, lineHeight: 1.45, fontWeight: 700}}>工信厅企业〔2024〕56号</div>
        <div style={{...enter(frame, 22), marginTop: 35, padding: '15px 17px', background: palette.blueSoft, borderLeft: `7px solid ${palette.blue}`, fontSize: 22, lineHeight: 1.45, fontWeight: 820}}>
          用于说明数字化能力的分级顺序，不把文件解读成“低级别不能使用 AI”。
        </div>
        <div style={{...enter(frame, 30), marginTop: 32, color: palette.muted, fontSize: 19, lineHeight: 1.45, fontWeight: 720}}>
          来源：工业和信息化部｜2024-09-09
        </div>
      </div>
      <div style={{...enter(frame, 12, 28), position: 'absolute', left: 730, top: 100, width: 1120, height: 690, padding: 22, background: palette.white, boxShadow: '0 22px 64px rgba(19,42,58,0.16)'}}>
        <Img src={staticFile('screenshots/20260713_digital1_miit_notice_title.png')} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>
    </EvidenceShell>
  );
};

const EvidenceLevels: React.FC = () => {
  const frame = useCurrentFrame();
  const levels = [
    {label: '一级', text: '信息技术工具辅助', color: palette.yellow},
    {label: '二级', text: '在线数据采集与规范管理', color: palette.blue},
    {label: '四级', text: '人工智能与模型驱动', color: palette.green},
  ];
  return (
    <EvidenceShell accent={palette.blue}>
      <div style={{...enter(frame, 2), position: 'absolute', left: 72, top: 86, fontSize: 46, lineHeight: 1.08, fontWeight: 950}}>
        工具辅助 → 在线采集 → AI 驱动
      </div>
      <div style={{...enter(frame, 7), position: 'absolute', right: 70, top: 95, color: palette.muted, fontSize: 20, fontWeight: 760}}>
        分级路径，不代表低级别禁止使用 AI
      </div>
      <div style={{...enter(frame, 12, 24), position: 'absolute', left: 70, top: 188, width: 1780, height: 350, padding: '20px 22px', background: palette.white, boxShadow: '0 20px 58px rgba(17,37,53,0.15)'}}>
        <Img src={staticFile('screenshots/20260713_digital1_miit_assessment_p07_levels_crop.png')} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>
      <div style={{position: 'absolute', left: 70, top: 570, width: 1780, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16}}>
        {levels.map((level, index) => (
          <div key={level.label} style={{...enter(frame, 25 + index * 10, 18), padding: '16px 18px', background: palette.white, borderTop: `6px solid ${level.color}`, boxShadow: '0 10px 26px rgba(19,43,60,0.1)'}}>
            <div style={{color: palette.muted, fontSize: 18, fontWeight: 850}}>{level.label}</div>
            <div style={{marginTop: 6, fontSize: 24, lineHeight: 1.28, fontWeight: 900}}>{level.text}</div>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 72, top: 758, color: palette.muted, fontSize: 18, lineHeight: 1.35, fontWeight: 720}}>
        来源：工信部《中小企业数字化水平评测指标（2024年版）》第 7 页
      </div>
    </EvidenceShell>
  );
};

const EvidenceGansu: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <EvidenceShell accent={palette.yellow}>
      <div style={{position: 'absolute', left: 70, top: 82, display: 'flex', alignItems: 'baseline', gap: 42}}>
        <div style={{...enter(frame, 2), fontSize: 66, lineHeight: 1, fontWeight: 950}}>超 2000 家</div>
        <div style={{...enter(frame, 8), color: palette.blue, fontSize: 76, lineHeight: 1, fontWeight: 950}}>68.2%</div>
        <div style={{...enter(frame, 14), color: palette.muted, fontSize: 24, fontWeight: 820}}>规上工业企业数字化改造口径</div>
      </div>
      <div style={{...enter(frame, 16, 24), position: 'absolute', left: 70, top: 214, width: 1780, height: 350, padding: '18px 20px', background: palette.white, boxShadow: '0 22px 60px rgba(19,42,58,0.15)'}}>
        <Img src={staticFile('screenshots/20260713_digital1_gansu_press_evidence_composite.png')} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>
      <div style={{position: 'absolute', left: 70, top: 598, width: 1780, display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 18}}>
        <div style={{...enter(frame, 28), padding: '15px 18px', background: palette.orangeSoft, borderLeft: `7px solid ${palette.orange}`, fontSize: 23, lineHeight: 1.4, fontWeight: 860}}>
          规上工业口径，不代表全省小微企业
        </div>
        <div style={{...enter(frame, 36), padding: '15px 18px', background: palette.blueSoft, borderLeft: `7px solid ${palette.blue}`, fontSize: 22, lineHeight: 1.4, fontWeight: 820}}>
          同一官方页面截图拼接
        </div>
      </div>
      <div style={{position: 'absolute', left: 72, top: 732, color: palette.muted, fontSize: 18, lineHeight: 1.4, fontWeight: 720}}>
        来源：甘肃省政府新闻办省工信厅专场｜2025-11-26
      </div>
    </EvidenceShell>
  );
};

const BoundaryCard: React.FC<{
  eyebrow: string;
  title: string;
  detail?: string;
  items?: string[];
}> = ({eyebrow, title, detail, items}) => {
  const frame = useCurrentFrame();
  return (
    <CardShell eyebrow={eyebrow} accent={palette.orange}>
      <div style={{...enter(frame, 4), marginTop: 22, color: palette.orange, fontSize: 24, fontWeight: 900}}>口径边界</div>
      <div style={{...enter(frame, 10), marginTop: 8, fontSize: 43, lineHeight: 1.12, fontWeight: 950}}>{title}</div>
      {detail ? <div style={{...enter(frame, 18), marginTop: 24, padding: '16px 18px', background: palette.orangeSoft, fontSize: 23, lineHeight: 1.48, fontWeight: 760}}>{detail}</div> : null}
      {items ? (
        <div style={{marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10}}>
          {items.map((item, index) => (
            <div key={item} style={{...enter(frame, 18 + index * 9), padding: '16px 10px', background: palette.white, borderTop: `5px solid ${palette.orange}`, textAlign: 'center', fontSize: 23, fontWeight: 880}}>{item}</div>
          ))}
        </div>
      ) : null}
    </CardShell>
  );
};

const ThreeChecksCard: React.FC = () => {
  const frame = useCurrentFrame();
  const columns = [
    {number: '01', title: '客户与订单', detail: '能不能找到完整记录？', color: palette.blue},
    {number: '02', title: '价格与库存', detail: '有没有统一数字版本？', color: palette.yellow},
    {number: '03', title: '更新与确认', detail: '谁更新、谁最终确认？', color: palette.green},
  ];
  return (
    <CardShell eyebrow="老板自查" accent={palette.blue} width={760}>
      <div style={{...enter(frame, 3), marginTop: 20, fontSize: 47, lineHeight: 1.08, fontWeight: 950}}>先查三件事</div>
      <div style={{marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12}}>
        {columns.map((item, index) => (
          <div key={item.number} style={{...enter(frame, 13 + index * 10, 22), minHeight: 230, padding: '18px 15px', background: palette.white, borderTop: `7px solid ${item.color}`}}>
            <div style={{color: item.color, fontSize: 21, fontWeight: 950}}>{item.number}</div>
            <div style={{marginTop: 18, fontSize: 27, lineHeight: 1.2, fontWeight: 920}}>{item.title}</div>
            <div style={{marginTop: 15, color: palette.muted, fontSize: 20, lineHeight: 1.42, fontWeight: 700}}>{item.detail}</div>
          </div>
        ))}
      </div>
    </CardShell>
  );
};

const KeywordPop: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame * 0.13), [-1, 1], [0.96, 1.02]);
  return (
    <div style={{...enter(frame, 0, 24), position: 'absolute', left: 70, top: 250, width: 700, padding: '30px 34px', background: 'rgba(255,248,244,0.97)', borderLeft: `10px solid ${palette.orange}`, boxShadow: '0 24px 68px rgba(27,32,38,0.24)', color: palette.ink, fontFamily, transform: `translateY(${interpolate(spring({fps, frame, config: {damping: 19, stiffness: 170}}), [0, 1], [24, 0])}px) scale(${pulse})`}}>
      <div style={{color: palette.orange, fontSize: 20, fontWeight: 900}}>先别急着接 AI</div>
      <div style={{marginTop: 12, fontSize: 50, lineHeight: 1.08, fontWeight: 950}}>让混乱跑得更快</div>
    </div>
  );
};

const Action753Card: React.FC = () => {
  const frame = useCurrentFrame();
  const inputs = ['客户从哪来', '问了什么', '谁跟进', '给了什么方案', '结果怎样'];
  const metrics = ['省没省时间', '少没少漏单', '结果准不准'];
  return (
    <CardShell eyebrow="最小验证方法" accent={palette.green} width={770} top={112}>
      <div style={{...enter(frame, 2), marginTop: 17, display: 'flex', alignItems: 'baseline', gap: 16}}>
        <span style={{color: palette.blue, fontSize: 58, fontWeight: 950}}>7 天</span>
        <span style={{color: palette.muted, fontSize: 25, fontWeight: 850}}>/</span>
        <span style={{color: palette.yellow, fontSize: 58, fontWeight: 950}}>5 项</span>
        <span style={{color: palette.muted, fontSize: 25, fontWeight: 850}}>/</span>
        <span style={{color: palette.green, fontSize: 58, fontWeight: 950}}>3 个验证</span>
      </div>
      <div style={{marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9}}>
        {inputs.map((item, index) => (
          <div key={item} style={{...enter(frame, 11 + index * 6, 15), padding: '11px 13px', background: palette.white, borderLeft: `5px solid ${palette.blue}`, fontSize: 20, lineHeight: 1.25, fontWeight: 830}}>
            <span style={{marginRight: 9, color: palette.muted, fontSize: 16}}>0{index + 1}</span>{item}
          </div>
        ))}
      </div>
      <div style={{marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9}}>
        {metrics.map((item, index) => (
          <div key={item} style={{...enter(frame, 43 + index * 7, 14), padding: '13px 9px', background: palette.greenSoft, borderTop: `5px solid ${palette.green}`, textAlign: 'center', fontSize: 20, lineHeight: 1.28, fontWeight: 870}}>{item}</div>
        ))}
      </div>
    </CardShell>
  );
};

const MinimumFlowCard: React.FC = () => {
  const frame = useCurrentFrame();
  const nodes = [
    {title: '纸张 / 聊天 / 经验', color: palette.orange},
    {title: '数字记录与流程', color: palette.blue},
    {title: 'AI 进入经营', color: palette.green},
  ];
  return (
    <CardShell eyebrow="最小路径" accent={palette.blue} width={780}>
      <div style={{...enter(frame, 3), marginTop: 19, fontSize: 45, lineHeight: 1.08, fontWeight: 950}}>先留下流程，再接 AI</div>
      <div style={{marginTop: 34, display: 'flex', alignItems: 'stretch', gap: 8}}>
        {nodes.map((node, index) => (
          <React.Fragment key={node.title}>
            <div style={{...enter(frame, 12 + index * 10, 18), width: 210, padding: '20px 14px', background: palette.white, borderTop: `7px solid ${node.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 23, lineHeight: 1.32, fontWeight: 880}}>{node.title}</div>
            {index < nodes.length - 1 ? (
              <div style={{...enter(frame, 18 + index * 10, 10), width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.blue, fontSize: 34, fontWeight: 950}}>→</div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </CardShell>
  );
};

const SurveyCtaCard: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <CardShell eyebrow="甘肃本地企业真实摸底" accent={palette.yellow} width={760} top={122}>
      <div style={{...enter(frame, 3), marginTop: 20, fontSize: 45, lineHeight: 1.12, fontWeight: 950}}>行业 + 最乱的一个环节</div>
      <div style={{marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12}}>
        <div style={{...enter(frame, 13), padding: '19px 18px', background: palette.white, borderTop: `6px solid ${palette.blue}`}}>
          <div style={{color: palette.muted, fontSize: 18, fontWeight: 820}}>输入 01</div>
          <div style={{marginTop: 7, fontSize: 28, fontWeight: 920}}>你的行业</div>
        </div>
        <div style={{...enter(frame, 22), padding: '19px 18px', background: palette.white, borderTop: `6px solid ${palette.yellow}`}}>
          <div style={{color: palette.muted, fontSize: 18, fontWeight: 820}}>输入 02</div>
          <div style={{marginTop: 7, fontSize: 28, fontWeight: 920}}>最靠人记的环节</div>
        </div>
      </div>
      <div style={{...enter(frame, 36), marginTop: 24, padding: '14px 17px', background: palette.orangeSoft, borderLeft: `7px solid ${palette.orange}`, color: palette.ink, fontSize: 21, lineHeight: 1.4, fontWeight: 850}}>
        隐私提醒：不要留公司名、客户数据和可识别个人信息
      </div>
    </CardShell>
  );
};

const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], clamp);
  const evidence = seconds >= 50.88 && seconds < 81.74;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', fontFamily}}>
      <div style={{position: 'absolute', top: 30, left: 52, right: 52, display: 'flex', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: evidence ? '7px 12px' : 0, background: evidence ? 'rgba(255,255,255,0.88)' : undefined, color: evidence ? palette.ink : palette.white, textShadow: evidence ? 'none' : '0 2px 10px rgba(0,0,0,0.82)', fontSize: 21, fontWeight: 900}}>
          <span style={{width: 34, height: 6, background: palette.yellow}} />
          超哥 AI 创业记 · 兰州
        </div>
        {!evidence ? (
          <div style={{marginLeft: 'auto', padding: '8px 13px', background: 'rgba(8,16,24,0.58)', color: palette.white, textShadow: '0 2px 8px rgba(0,0,0,0.7)', fontSize: 19, fontWeight: 800}}>
            AI 接不进企业，问题可能不在 AI
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, background: 'rgba(255,255,255,0.34)'}}>
        <div style={{height: '100%', width: `${progress * 100}%`, background: palette.yellow}} />
      </div>
    </AbsoluteFill>
  );
};

export const DigitalOneTalk16x9: React.FC = () => {
  return (
    <AbsoluteFill style={{background: palette.ink}}>
      <LocalFont />
      <CameraVideo />

      <TimedScene start={0.44} end={13.94}>
        <DefinitionCard eyebrow="先判断问题在哪" title="AI 根本看不见" detail="不是模型不够强，是生意没有留下记录。" accent={palette.yellow} />
      </TimedScene>
      <TimedScene start={13.94} end={24.76}><FragmentedMap /></TimedScene>
      <TimedScene start={34.72} end={49.98}>
        <DefinitionCard eyebrow="本视频工作定义" title="数字化 1.0" items={['找得到', '能更新', '可追溯']} disclaimer="本视频工作定义，非官方术语；也不等于花几十万上系统。" accent={palette.blue} />
      </TimedScene>
      <TimedScene start={50.88} end={56.16}><EvidenceNotice /></TimedScene>
      <TimedScene start={56.88} end={72.24}><EvidenceLevels /></TimedScene>
      <TimedScene start={73} end={81.74}><EvidenceGansu /></TimedScene>
      <TimedScene start={82.56} end={96.46}>
        <BoundaryCard eyebrow="甘肃数据怎么理解" title="规上工业 ≠ 全省小微企业" detail="餐饮 / 装修 / 民宿 / 美业，仍需要真实调查，不能拿工业口径直接外推。" />
      </TimedScene>
      <TimedScene start={97.6} end={112.62}><ThreeChecksCard /></TimedScene>
      <TimedScene start={112.62} end={119.42}><KeywordPop /></TimedScene>
      <TimedScene start={120.18} end={145.32}><Action753Card /></TimedScene>
      <TimedScene start={145.92} end={152.21}><MinimumFlowCard /></TimedScene>
      <TimedScene start={152.94} end={163.06}><SurveyCtaCard /></TimedScene>
      <TimedScene start={163.06} end={171.24}>
        <BoundaryCard eyebrow="公开调查方法" title="不拿小样本冒充全省" items={['样本量', '行业分布', '采集渠道']} />
      </TimedScene>

      <Hud />
      <BilingualCaptionOverlay captionsSrc="data/DIGITAL1_20260714_talk01.bilingual.v1.json" />
    </AbsoluteFill>
  );
};
