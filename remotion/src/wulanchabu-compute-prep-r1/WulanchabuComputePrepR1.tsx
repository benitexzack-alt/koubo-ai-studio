import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {LocalFont} from '../components/LocalFont';

const FONT = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const COLORS = {
  ink: '#071018',
  panel: '#101A22',
  panelSoft: '#17242D',
  white: '#F7FAFC',
  muted: '#A8B7C2',
  cyan: '#62D7F7',
  green: '#53D79A',
  yellow: '#FFC65A',
  red: '#FF756B',
  line: '#345262',
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const revealAt = (frame: number, fps: number, atSeconds: number) =>
  spring({
    frame: frame - atSeconds * fps,
    fps,
    config: {damping: 22, stiffness: 175, mass: 0.82},
  });

const opacityAt = (frame: number, fps: number, atSeconds: number) =>
  interpolate(frame, [atSeconds * fps, (atSeconds + 0.28) * fps], [0, 1], clamp);

const PreviewStage: React.FC<{
  children: React.ReactNode;
  label: string;
  previewBackground?: boolean;
}> = ({children, label, previewBackground = true}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: previewBackground ? COLORS.ink : 'transparent',
        color: COLORS.white,
        fontFamily: FONT,
        overflow: 'hidden',
      }}
    >
      <LocalFont />
      {previewBackground ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: 36,
              top: 26,
              color: COLORS.cyan,
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            超哥AI创业记 · 动画预制
          </div>
          <div
            style={{
              position: 'absolute',
              right: 70,
              top: 84,
              width: 810,
              height: 890,
              border: `2px dashed ${COLORS.line}`,
              backgroundColor: '#0B141B',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '46%',
                textAlign: 'center',
                color: '#607481',
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              真人主画面安全区
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              right: 70,
              bottom: 34,
              color: COLORS.muted,
              fontSize: 17,
              fontWeight: 700,
            }}
          >
            {label} · 最终按实录时间轴挂载
          </div>
        </>
      ) : null}
      {children}
    </AbsoluteFill>
  );
};

const Header: React.FC<{eyebrow: string; title: string; detail: string}> = ({
  eyebrow,
  title,
  detail,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const show = revealAt(frame, fps, 0.05);
  return (
    <div
      style={{
        position: 'absolute',
        left: 66,
        top: 92,
        width: 790,
        transform: `translateY(${interpolate(show, [0, 1], [18, 0])}px)`,
        opacity: show,
      }}
    >
      <div style={{color: COLORS.yellow, fontSize: 20, fontWeight: 950}}>{eyebrow}</div>
      <div style={{marginTop: 8, fontSize: 46, lineHeight: 1.08, fontWeight: 950}}>
        {title}
      </div>
      <div
        style={{
          marginTop: 12,
          color: COLORS.muted,
          fontSize: 22,
          lineHeight: 1.3,
          fontWeight: 760,
        }}
      >
        {detail}
      </div>
    </div>
  );
};

type ReasonNodeProps = {
  at: number;
  index: string;
  title: string;
  detail: string;
  value: string;
  accent: string;
  top: number;
};

const ReasonNode: React.FC<ReasonNodeProps> = ({
  at,
  index,
  title,
  detail,
  value,
  accent,
  top,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const show = revealAt(frame, fps, at);
  return (
    <div
      style={{
        position: 'absolute',
        left: 66,
        top,
        width: 790,
        height: 160,
        padding: '22px 24px',
        boxSizing: 'border-box',
        backgroundColor: COLORS.panel,
        borderLeft: `7px solid ${accent}`,
        boxShadow: '0 14px 32px rgba(0,0,0,0.24)',
        opacity: show,
        transform: `translateX(${interpolate(show, [0, 1], [-34, 0])}px)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <div
            style={{
              width: 50,
              height: 50,
              display: 'grid',
              placeItems: 'center',
              backgroundColor: accent,
              color: COLORS.ink,
              fontSize: 24,
              fontWeight: 950,
            }}
          >
            {index}
          </div>
          <div>
            <div style={{fontSize: 32, lineHeight: 1.08, fontWeight: 950}}>{title}</div>
            <div
              style={{
                marginTop: 10,
                color: COLORS.muted,
                fontSize: 20,
                fontWeight: 760,
              }}
            >
              {detail}
            </div>
          </div>
        </div>
        <div
          style={{
            maxWidth: 270,
            color: accent,
            fontSize: 27,
            lineHeight: 1.12,
            fontWeight: 950,
            textAlign: 'right',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
};

export const WulanchabuReasonsPrepR1: React.FC<{previewBackground?: boolean}> = ({
  previewBackground = true,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lineProgress = interpolate(frame, [1.0 * fps, 4.5 * fps], [0, 1], clamp);
  return (
    <PreviewStage label="A01 三项条件" previewBackground={previewBackground}>
      <Header
        eyebrow="为什么是乌兰察布"
        title="算力项目看中的，不只是一片空地"
        detail="绿电、冷凉气候和低时延网络，三项条件同时成立"
      />
      <div
        style={{
          position: 'absolute',
          left: 88,
          top: 330,
          width: 4,
          height: 515 * lineProgress,
          backgroundColor: COLORS.line,
        }}
      />
      <ReasonNode
        at={0.72}
        index="1"
        title="绿电"
        detail="风电、光伏和数据中心协同"
        value="能源优势"
        accent={COLORS.green}
        top={260}
      />
      <ReasonNode
        at={1.9}
        index="2"
        title="自然冷源"
        detail="公开报道口径：年均约4.3℃"
        value="约10个月"
        accent={COLORS.cyan}
        top={450}
      />
      <ReasonNode
        at={3.15}
        index="3"
        title="低时延"
        detail="乌兰察布至北京亦庄双回路光缆"
        value="低于4.2ms"
        accent={COLORS.yellow}
        top={640}
      />
      <div
        style={{
          position: 'absolute',
          left: 66,
          top: 850,
          width: 790,
          color: COLORS.muted,
          fontSize: 18,
          lineHeight: 1.35,
          fontWeight: 720,
          opacity: opacityAt(frame, fps, 4.25),
        }}
      >
        数据来源：新华社公开报道。数字只对应特定线路与报道时点。
      </div>
    </PreviewStage>
  );
};

const CostRow: React.FC<{label: string; at: number; color?: string}> = ({
  label,
  at,
  color = COLORS.red,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const show = revealAt(frame, fps, at);
  return (
    <div
      style={{
        height: 54,
        padding: '0 17px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.panelSoft,
        borderLeft: `5px solid ${color}`,
        opacity: show,
        transform: `translateY(${interpolate(show, [0, 1], [14, 0])}px)`,
      }}
    >
      <span style={{fontSize: 21, fontWeight: 850}}>{label}</span>
      <span style={{color, fontSize: 18, fontWeight: 950}}>计入总账</span>
    </div>
  );
};

export const ComputeRentalPrepR1: React.FC<{previewBackground?: boolean}> = ({
  previewBackground = true,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rent = revealAt(frame, fps, 2.9);
  const settle = revealAt(frame, fps, 4.55);
  return (
    <PreviewStage label="A02 自建与租用" previewBackground={previewBackground}>
      <Header
        eyebrow="企业先别急着买服务器"
        title="不是只看一台 GPU 的价格"
        detail="先把硬件、电费、运维、利用率和数据要求算成一笔总账"
      />
      <div
        style={{
          position: 'absolute',
          left: 66,
          top: 285,
          width: 372,
          height: 515,
          padding: 20,
          boxSizing: 'border-box',
          backgroundColor: '#121C24',
          borderTop: `6px solid ${COLORS.red}`,
        }}
      >
        <div style={{fontSize: 29, fontWeight: 950}}>自建 GPU</div>
        <div style={{marginTop: 8, color: COLORS.muted, fontSize: 18, fontWeight: 740}}>
          前期投入高，闲置也在花钱
        </div>
        <div style={{display: 'grid', gap: 12, marginTop: 24}}>
          <CostRow label="硬件采购" at={0.72} />
          <CostRow label="电力与制冷" at={1.16} />
          <CostRow label="运维与故障" at={1.6} />
          <CostRow label="利用率" at={2.04} />
          <CostRow label="数据与权限" at={2.48} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 460,
          top: 285,
          width: 396,
          height: 515,
          padding: 24,
          boxSizing: 'border-box',
          backgroundColor: '#121C24',
          borderTop: `6px solid ${COLORS.green}`,
          opacity: rent,
          transform: `translateX(${interpolate(rent, [0, 1], [28, 0])}px)`,
        }}
      >
        <div style={{fontSize: 29, fontWeight: 950}}>按需租用</div>
        <div style={{marginTop: 8, color: COLORS.muted, fontSize: 18, fontWeight: 740}}>
          降低前期重资产投入
        </div>
        <div style={{marginTop: 42, color: COLORS.muted, fontSize: 18, fontWeight: 820}}>
          使用量
        </div>
        <div
          style={{
            position: 'relative',
            marginTop: 18,
            width: 332,
            height: 12,
            backgroundColor: '#28404D',
          }}
        >
          <div
            style={{
              width: `${interpolate(rent, [0, 1], [8, 72])}%`,
              height: '100%',
              backgroundColor: COLORS.green,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -9,
              left: `${interpolate(rent, [0, 1], [8, 72])}%`,
              width: 30,
              height: 30,
              marginLeft: -15,
              backgroundColor: COLORS.white,
              border: `7px solid ${COLORS.green}`,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{display: 'grid', gap: 14, marginTop: 54}}>
          {['按任务选择', '按调用扩缩', '先小范围验证'].map((label, index) => (
            <div
              key={label}
              style={{
                padding: '13px 16px',
                backgroundColor: COLORS.panelSoft,
                color: index === 2 ? COLORS.yellow : COLORS.white,
                fontSize: 21,
                fontWeight: 850,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 66,
          top: 835,
          width: 790,
          padding: '17px 22px',
          boxSizing: 'border-box',
          backgroundColor: COLORS.yellow,
          color: COLORS.ink,
          fontSize: 29,
          fontWeight: 950,
          opacity: settle,
          transform: `scaleX(${interpolate(settle, [0, 1], [0.78, 1])})`,
          transformOrigin: 'left center',
        }}
      >
        结论：先算总账，再决定自建还是租用
      </div>
    </PreviewStage>
  );
};

type ChainNodeProps = {
  at: number;
  top: number;
  left: number;
  label: string;
  detail: string;
  accent: string;
};

const ChainNode: React.FC<ChainNodeProps> = ({at, top, left, label, detail, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const show = revealAt(frame, fps, at);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: 238,
        height: 112,
        padding: '16px 18px',
        boxSizing: 'border-box',
        backgroundColor: COLORS.panel,
        borderBottom: `6px solid ${accent}`,
        opacity: show,
        transform: `translateY(${interpolate(show, [0, 1], [22, 0])}px)`,
      }}
    >
      <div style={{fontSize: 25, fontWeight: 950}}>{label}</div>
      <div style={{marginTop: 8, color: COLORS.muted, fontSize: 17, fontWeight: 720}}>
        {detail}
      </div>
    </div>
  );
};

const Arrow: React.FC<{at: number; left: number; top: number; width: number}> = ({
  at,
  left,
  top,
  width,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = interpolate(frame, [at * fps, (at + 0.46) * fps], [0, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: width * progress,
        height: 4,
        backgroundColor: COLORS.line,
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -1,
          top: -7,
          width: 0,
          height: 0,
          borderTop: '9px solid transparent',
          borderBottom: '9px solid transparent',
          borderLeft: `13px solid ${COLORS.line}`,
        }}
      />
    </div>
  );
};

export const ComputeValueChainPrepR1: React.FC<{previewBackground?: boolean}> = ({
  previewBackground = true,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const result = revealAt(frame, fps, 5.8);
  return (
    <PreviewStage label="A03 算力到生意" previewBackground={previewBackground}>
      <Header
        eyebrow="硬件在草原，价值发生在业务现场"
        title="算力要经过五个节点，才会变成结果"
        detail="基础设施提供能力，行业流程和人工验收决定它有没有用"
      />
      <ChainNode
        at={0.7}
        left={66}
        top={302}
        label="绿电"
        detail="能源底座"
        accent={COLORS.green}
      />
      <Arrow at={1.15} left={304} top={356} width={44} />
      <ChainNode
        at={1.42}
        left={354}
        top={302}
        label="数据中心"
        detail="算力供给"
        accent={COLORS.cyan}
      />
      <Arrow at={1.92} left={592} top={356} width={44} />
      <ChainNode
        at={2.18}
        left={642}
        top={302}
        label="模型 / API"
        detail="通用能力"
        accent={COLORS.cyan}
      />
      <div
        style={{
          position: 'absolute',
          left: 748,
          top: 428,
          width: 4,
          height: interpolate(frame, [2.72 * fps, 3.22 * fps], [0, 74], clamp),
          backgroundColor: COLORS.line,
        }}
      />
      <ChainNode
        at={3.12}
        left={354}
        top={510}
        label="行业流程"
        detail="知识库 / 工作流"
        accent={COLORS.yellow}
      />
      <Arrow at={3.66} left={592} top={564} width={44} />
      <ChainNode
        at={3.98}
        left={642}
        top={510}
        label="人来验收"
        detail="判断与责任"
        accent={COLORS.yellow}
      />
      <div
        style={{
          position: 'absolute',
          left: 66,
          top: 510,
          width: 238,
          height: 112,
          padding: '16px 18px',
          boxSizing: 'border-box',
          backgroundColor: '#0C171F',
          border: `2px dashed ${COLORS.line}`,
          color: COLORS.muted,
          opacity: opacityAt(frame, fps, 3.1),
        }}
      >
        <div style={{fontSize: 21, fontWeight: 900}}>企业现场</div>
        <div style={{marginTop: 8, fontSize: 17, lineHeight: 1.25, fontWeight: 720}}>
          餐饮 · 零售 · 服务
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 66,
          top: 700,
          width: 814,
          padding: '24px 26px',
          boxSizing: 'border-box',
          backgroundColor: COLORS.yellow,
          color: COLORS.ink,
          opacity: result,
          transform: `translateY(${interpolate(result, [0, 1], [22, 0])}px)`,
        }}
      >
        <div style={{fontSize: 32, fontWeight: 950}}>算力是底座，业务结果要在现场验收</div>
        <div style={{marginTop: 9, fontSize: 19, lineHeight: 1.3, fontWeight: 820}}>
          行业理解、客户关系和交付服务，才是下游真正要补的部分
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 66,
          top: 860,
          color: COLORS.muted,
          fontSize: 18,
          fontWeight: 740,
          opacity: opacityAt(frame, fps, 6.4),
        }}
      >
        关系示意，不代表任何企业已完成部署或产生收益
      </div>
    </PreviewStage>
  );
};

