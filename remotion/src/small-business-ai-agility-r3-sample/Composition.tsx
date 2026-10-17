import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {SmallBusinessAiAgility} from '../small-business-ai-agility-20261017/Composition';
import {easeOut, mix, progress, smooth} from '../small-business-ai-agility-20261017/runtime';
import type {EpisodeProps, RuntimePlan} from '../small-business-ai-agility-20261017/types';
import cues from './sample-cues.v1.json';

export const SAMPLE_WINDOW = cues.sampleWindow;
export const SAMPLE_EVENTS = cues.events;
const E = SAMPLE_EVENTS;
const C = {white: '#fffdf8', cream: '#f2eadc', accent: '#e1b96d', ink: '#14272f'};
const FONT = '"SmallBusinessAgility20261017-Display", "PingFang SC", sans-serif';
const enter = (frame: number, from: number, duration = 12) => easeOut(progress(frame, from, duration));
const sceneAlpha = (frame: number) => Math.min(progress(frame, E.enterprise, 6), 1 - progress(frame, E.exit, 8));

/** 仅替换本次比较窗中的旧信息层；完整源时间轴、原字幕与运镜不裁剪。 */
export const deriveSamplePlan = (plan: RuntimePlan): RuntimePlan => ({
  ...plan,
  overlays: plan.overlays.filter((cue) => cue.to <= SAMPLE_WINDOW.from || cue.from >= SAMPLE_WINDOW.to),
});

const TextPlate: React.FC<{
  children: React.ReactNode; x: number; y: number; width: number; height: number; size: number;
  opacity?: number; color?: string; background?: boolean; scale?: number; compact?: number;
}> = ({children, x, y, width, height, size, opacity = 1, color = C.white, background = true, scale = 1, compact = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, width, height, boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0,
    padding: `0 ${mix(18, 7, compact)}px`, borderRadius: 8,
    color, background: background ? 'rgba(20,39,47,.72)' : undefined,
    fontSize: size, lineHeight: 1.08, letterSpacing: mix(0, -1.2, compact), whiteSpace: 'nowrap',
    opacity, transform: `scale(${scale})`, transformOrigin: '0 50%'}}>{children}</div>
);

const FrictionNode: React.FC<{frame: number; index: number; at: number; text: string; compact: number; lift: number; exit: number}> =
  ({frame, index, at, text, compact, lift, exit}) => {
    const arrive = enter(frame, at);
    const initialX = 64;
    const initialY = 240 + index * 108;
    const settleIntoResult = smooth(progress(frame, E.timeConclusion - 12, 12));
    const x = mix(initialX, 64 + index * 228, compact);
    // 先占定互不重叠的列，再竖向收拢，避免斜向经过其他节点的文字。
    const y = mix(initialY, 132 + settleIntoResult * 86, lift);
    return <div data-parallel-friction={index} style={{opacity: arrive * (1 - exit),
      transform: `translateY(${(1 - arrive) * 18 - exit * 18}px)`, transformOrigin: '64px 180px'}}>
      <TextPlate x={x} y={y} width={mix(360, 218, compact)} height={mix(92, 88, compact)}
        size={mix(60, 52, compact)} compact={compact}>
        {text}
      </TextPlate>
      <div style={{position: 'absolute', left: x, top: y + 12, width: 4,
        height: mix(68, 64, compact), backgroundColor: C.accent}} />
    </div>;
  };

/** 同一组并列节点持续显现、收拢与转场，不把汇报/开会/拉扯画成先后步骤。 */
export const SemanticRelationSample: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < SAMPLE_WINDOW.from || frame >= SAMPLE_WINDOW.to) return null;
  const opening = enter(frame, E.enterprise);
  const toFriction = smooth(progress(frame, E.reporting - 8, 8));
  const compact = smooth(progress(frame, E.compactForHand, E.compactColumnsSettled - E.compactForHand));
  const compactLift = smooth(progress(frame, E.compactColumnsSettled, E.compactSettled - E.compactColumnsSettled));
  const toSmall = smooth(progress(frame, E.smallCompany, 14));
  const largeTitleAlpha = (1 - compact) * (1 - toSmall);
  const introAlpha = (1 - toFriction) * (1 - toSmall);
  const conclusion = enter(frame, E.timeConclusion);
  const company = enter(frame, E.smallCompany, 14);
  const boss = enter(frame, E.bossDecision, 10);
  const direction = enter(frame, E.sameDayDirection, 12);
  const noApproval = enter(frame, E.noApproval);
  const noCoordination = enter(frame, E.noCoordination);
  const costFold = smooth(progress(frame, E.lowTrialCost, 8));
  const lowTrialCost = enter(frame, E.lowTrialCostReveal, 8);

  return <AbsoluteFill data-r3-sample="parallel-friction-to-decision" style={{zIndex: 50, pointerEvents: 'none',
    fontFamily: FONT, color: C.white, opacity: sceneAlpha(frame)}}>
    <TextPlate x={64} y={110 + (1 - opening) * 12} width={302} height={108} size={84}
      opacity={opening * largeTitleAlpha}>大企业</TextPlate>
    <TextPlate x={64} y={250} width={310} height={104} size={76} opacity={introAlpha * opening} color={C.cream}>层级多</TextPlate>
    <TextPlate x={64} y={376} width={302} height={90} size={60} opacity={introAlpha * enter(frame, E.fixedProcess)}>流程固化</TextPlate>

    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: introAlpha * opening}}>
      {[0, 1, 2].map((index) => {
        const p = enter(frame, E.enterprise + index * 3, 9);
        return <g key={index} opacity={p} transform={`translate(${440 + index * 28},${252 + index * 50 + (1 - p) * 14})`}>
          <rect x={0} y={0} width={154} height={26} rx={3} fill={C.cream} fillOpacity={.94} />
          {index < 2 ? <path d="M 77 28 V 39 H 105 V 48" fill="none" stroke={C.accent} strokeWidth={4} /> : null}
        </g>;
      })}
    </svg>

    <FrictionNode frame={frame} index={0} at={E.reporting} text="层层汇报" compact={compact} lift={compactLift} exit={toSmall} />
    <FrictionNode frame={frame} index={1} at={E.meetings} text="反复开会" compact={compact} lift={compactLift} exit={toSmall} />
    <FrictionNode frame={frame} index={2} at={E.tugging} text="相互拉扯" compact={compact} lift={compactLift} exit={toSmall} />
    <TextPlate x={64} y={340 + (1 - conclusion) * 12} width={402} height={116} size={88}
      color={C.accent} opacity={conclusion * (1 - toSmall)}>需要很久</TextPlate>

    <TextPlate x={64} y={110 + (1 - company) * 20} width={596} height={108} size={76}
      opacity={company}>
      十几个人<span style={{opacity: enter(frame, E.companySuffix, 8)}}>的公司</span>
    </TextPlate>
    <TextPlate x={64} y={225 + (1 - boss) * 12} width={424} height={100} size={88}
      opacity={boss} color={C.accent} scale={mix(.96, 1, boss)}>老板拍板</TextPlate>
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: direction}}>
      <path d="M 108 342 V 380" stroke={C.accent} strokeWidth={5} fill="none" pathLength={1}
        strokeDasharray={1} strokeDashoffset={1 - direction} strokeLinecap="round" />
      <path d="M 98 371 L 108 382 L 118 371" stroke={C.accent} strokeWidth={5} fill="none"
        strokeLinejoin="round" strokeLinecap="round" opacity={progress(frame, E.sameDayDirection + 8, 4)} />
    </svg>
    <TextPlate x={64} y={394 + (1 - direction) * 16} width={464} height={104} size={80}
      opacity={direction}>
      <span style={{color: C.accent}}>当天</span>定方向
    </TextPlate>
    <TextPlate x={64} y={526 + (1 - noApproval) * 10 - costFold * 8} width={432} height={76} size={52} opacity={noApproval * (1 - costFold)}>
      <span style={{color: C.accent}}>不用</span>复杂的审批
    </TextPlate>
    <TextPlate x={64} y={620 + (1 - noCoordination) * 10 - costFold * 14} width={590} height={76} size={52} opacity={noCoordination * (1 - costFold)}>
      <span style={{color: C.accent}}>不需要</span>协调好几个部门
    </TextPlate>
    <TextPlate x={64} y={526 + (1 - lowTrialCost) * 10} width={492} height={96} size={72} opacity={lowTrialCost}>
      试错成本<span style={{color: C.accent}}>极低</span>
    </TextPlate>
  </AbsoluteFill>;
};

export const SmallBusinessAgilityR3Sample: React.FC<EpisodeProps> = ({plan, withSfx, mode}) => {
  const samplePlan = useMemo(() => deriveSamplePlan(plan), [plan]);
  if (mode !== 'preview') throw new Error('本条23秒局部比较只允许预览，不是正式成片入口');
  return <AbsoluteFill>
    <SmallBusinessAiAgility plan={samplePlan} withSfx={withSfx} mode="preview" />
    <SemanticRelationSample />
  </AbsoluteFill>;
};
