import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

import {
  getR10PaperRuntimeProps,
  type R10Action,
  type R10Event,
  type R10PaperSemanticNode,
} from './runtime-contract';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

const localFrame = (event: R10Event, absoluteFrame: number) => (
  absoluteFrame - event.firstVisibleFrame
);

const frameProgress = (frame: number, start: number, end: number) => {
  if (end <= start) return frame >= end ? 1 : 0;
  return interpolate(frame, [start, end], [0, 1], clamp);
};

const anchorProgress = (
  frame: number,
  event: R10Event,
  start: keyof Pick<R10Event, 'firstVisibleFrame' | 'firstReadableFrame' | 'semanticSettleFrame' | 'actionEndFrame'>,
  end: keyof Pick<R10Event, 'firstReadableFrame' | 'semanticSettleFrame' | 'actionEndFrame' | 'endFrameExclusive'>,
) => frameProgress(frame, localFrame(event, event[start]), localFrame(event, event[end]));

type R10MotionAction = R10Action & {
  landedFrame: number;
  motionEndFrameExclusive: number;
  relationStartFrame: number;
  relationEndFrameExclusive: number;
};

type ActionMotion = {
  visible: boolean;
  arrival: number;
  settle: number;
  relation: number;
};

const stopMotionProgress = (progress: number, steps = 6) => {
  if (progress >= 1) return 1;
  return Math.max(0, Math.floor(progress * steps) / steps);
};

const requireMotionAction = (action: R10Action): R10MotionAction => {
  const candidate = action as R10MotionAction;
  if (
    !Number.isInteger(candidate.landedFrame)
    || !Number.isInteger(candidate.motionEndFrameExclusive)
    || !Number.isInteger(candidate.relationStartFrame)
    || !Number.isInteger(candidate.relationEndFrameExclusive)
  ) {
    throw new Error(`R10_B07_RENDER_MOTION_CONTRACT_MISSING:${action.id}`);
  }
  return candidate;
};

const actionMotion = (frame: number, event: R10Event, sourceAction: R10Action): ActionMotion => {
  const action = requireMotionAction(sourceAction);
  const start = localFrame(event, action.startFrame);
  const landed = localFrame(event, action.landedFrame);
  const motionEnd = localFrame(event, action.motionEndFrameExclusive);
  const relationStart = localFrame(event, action.relationStartFrame);
  const relationEnd = localFrame(event, action.relationEndFrameExclusive);
  return {
    visible: frame >= start,
    arrival: stopMotionProgress(frameProgress(frame, start, landed), 6),
    settle: stopMotionProgress(frameProgress(frame, landed, motionEnd), 5),
    relation: stopMotionProgress(frameProgress(frame, relationStart, relationEnd), 6),
  };
};

const PaperGrain: React.FC<{opacity?: number}> = ({opacity = 0.26}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity,
      mixBlendMode: 'soft-light',
      backgroundImage: [
        'repeating-linear-gradient(7deg, transparent 0 3px, rgba(255,255,255,.08) 3px 4px)',
        'repeating-linear-gradient(93deg, rgba(0,0,0,.05) 0 1px, transparent 1px 5px)',
      ].join(','),
    }}
  />
);

const OverlayShell: React.FC<{
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  accent: string;
  contentProgress: number;
}> = ({eyebrow, title, children, accent, contentProgress}) => (
  <div
    style={{
      position: 'absolute',
      left: 58,
      top: 122,
      width: 718,
      height: 650,
      boxSizing: 'border-box',
      padding: '34px 36px',
      color: '#F8F4E9',
      fontFamily,
      background: 'linear-gradient(145deg, rgba(30,32,31,.86), rgba(17,19,19,.72))',
      borderRadius: '8px 30px 12px 28px',
      boxShadow: '0 26px 70px rgba(0,0,0,.42)',
      overflow: 'hidden',
    }}
  >
    <PaperGrain opacity={0.18} />
    <div
      style={{
        position: 'relative',
        opacity: contentProgress,
        transform: `translateY(${interpolate(contentProgress, [0, 1], [18, 0])}px)`,
      }}
    >
      <div style={{color: accent, fontSize: 20, fontWeight: 900, letterSpacing: 2}}>
        {eyebrow}
      </div>
      <div style={{marginTop: 12, fontSize: 49, lineHeight: 1.12, fontWeight: 950}}>
        {title}
      </div>
      <div style={{marginTop: 28}}>{children}</div>
    </div>
  </div>
);

export const ContrastLedgerR10: React.FC<{event: R10Event}> = ({event}) => {
  const frame = useCurrentFrame();
  const enter = anchorProgress(frame, event, 'firstVisibleFrame', 'firstReadableFrame');
  const compare = anchorProgress(frame, event, 'firstReadableFrame', 'semanticSettleFrame');
  const conclusion = anchorProgress(frame, event, 'semanticSettleFrame', 'actionEndFrame');
  const readable = anchorProgress(frame, event, 'firstReadableFrame', 'semanticSettleFrame');
  const rows = [
    ['谁都能写', '品质好 · 服务好'],
    ['客户真想知道', '凭什么选这家'],
  ];

  return (
    <OverlayShell eyebrow="B05 · 内容不是套话" title="同样用 AI，差别在生意细节" accent="#FFB166" contentProgress={readable}>
      <div style={{display: 'grid', gap: 16}}>
        {rows.map(([label, value], index) => {
          const progress = index === 0 ? enter : compare;
          return (
            <div
              key={label}
              style={{
                display: 'grid',
                gridTemplateColumns: '170px 1fr',
                alignItems: 'center',
                minHeight: 92,
                padding: '12px 18px',
                boxSizing: 'border-box',
                background: index === 0 ? 'rgba(245,222,183,.12)' : 'rgba(255,177,102,.16)',
                borderLeft: `8px solid ${index === 0 ? '#AAA394' : '#FFB166'}`,
                opacity: progress,
                transform: `translateX(${interpolate(progress, [0, 1], [-86, 0])}px)`,
              }}
            >
              <div style={{color: '#CBC3B3', fontSize: 23, fontWeight: 800}}>{label}</div>
              <div style={{fontSize: 34, lineHeight: 1.2, fontWeight: 950}}>{value}</div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 22,
          padding: '16px 20px',
          color: '#211A14',
          background: '#FFB166',
          fontSize: 28,
          fontWeight: 950,
          opacity: conclusion,
          transform: `rotate(${interpolate(conclusion, [0, 1], [-2.4, -0.5])}deg) scale(${interpolate(conclusion, [0, 1], [0.88, 1])})`,
          transformOrigin: 'left center',
        }}
      >
        从“好不好”走到“为什么选你”
      </div>
    </OverlayShell>
  );
};

export const OwnerQuestionArchiveR10: React.FC<{event: R10Event}> = ({event}) => {
  const frame = useCurrentFrame();
  const readable = anchorProgress(frame, event, 'firstReadableFrame', 'semanticSettleFrame');
  const revealStart = localFrame(event, event.firstReadableFrame);
  const revealEnd = localFrame(event, event.actionEndFrame);
  const questions = [
    ['01', '平时怎样回答客户'],
    ['02', '手里有哪些东西'],
    ['03', '价格为什么不一样'],
    ['04', '谁适合 · 什么做不到'],
  ];
  return (
    <OverlayShell eyebrow="B06 · 老板的回答档案" title="先把反复解释的问题留下来" accent="#A7D6A0" contentProgress={readable}>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
        {questions.map(([number, text], index) => {
          const itemStart = revealStart + ((revealEnd - revealStart) * index) / questions.length;
          const itemEnd = revealStart + ((revealEnd - revealStart) * (index + 1)) / questions.length;
          const progress = frameProgress(frame, itemStart, itemEnd);
          return (
            <div
              key={number}
              style={{
                position: 'relative',
                minHeight: 142,
                padding: '20px 18px 16px',
                boxSizing: 'border-box',
                color: '#263029',
                background: index % 2 ? '#E6D8B6' : '#F0E9D6',
                boxShadow: '0 12px 26px rgba(0,0,0,.24)',
                opacity: progress,
                transform: `translateY(${interpolate(progress, [0, 1], [54, 0])}px) rotate(${interpolate(progress, [0, 1], [index % 2 ? 4 : -4, index % 2 ? 1 : -1])}deg)`,
              }}
            >
              <div style={{color: '#5B765D', fontSize: 18, fontWeight: 950}}>{number}</div>
              <div style={{marginTop: 12, fontSize: 27, lineHeight: 1.22, fontWeight: 900}}>{text}</div>
            </div>
          );
        })}
      </div>
    </OverlayShell>
  );
};

const tornEdges = [
  'polygon(1% 4%, 12% 2%, 29% 4%, 48% 1%, 67% 3%, 83% 1%, 99% 5%, 98% 94%, 86% 97%, 68% 95%, 48% 99%, 30% 96%, 13% 99%, 1% 95%)',
  'polygon(2% 1%, 20% 4%, 36% 2%, 55% 5%, 73% 1%, 98% 3%, 100% 92%, 91% 98%, 72% 96%, 57% 99%, 38% 95%, 18% 98%, 0 93%)',
  'polygon(0 5%, 15% 1%, 33% 3%, 51% 0, 70% 4%, 86% 2%, 100% 6%, 97% 96%, 81% 99%, 61% 96%, 43% 100%, 24% 96%, 4% 98%)',
];

const NodeLabel: React.FC<{
  id: string;
  text: string;
  color?: string;
  rotate?: number;
  compact?: boolean;
}> = ({id, text, color = '#F8F0DA', rotate = 0, compact = false}) => (
  <span
    data-semantic-node={id}
    data-text-mounted="rigid-with-paper"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: compact ? 34 : 42,
      margin: '7px 7px 0 0',
      padding: compact ? '4px 10px' : '7px 13px',
      color: '#29211C',
      background: color,
      clipPath: tornEdges[(id.length + Math.abs(Math.round(rotate))) % tornEdges.length],
      boxShadow: '0 5px 7px rgba(48,31,24,.22)',
      fontSize: compact ? 18 : 21,
      lineHeight: 1.18,
      fontWeight: 950,
      transform: `rotate(${rotate}deg)`,
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </span>
);

const PaperAdornment: React.FC<{kind: 'clip' | 'pin' | 'tape' | 'none'}> = ({kind}) => {
  if (kind === 'none') return null;
  if (kind === 'pin') {
    return (
      <div
        data-paper-adornment="pin"
        style={{
          position: 'absolute',
          right: 24,
          top: 20,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 28%, #FFD9A3 0 18%, #B54D3E 24% 68%, #713027 72%)',
          boxShadow: '0 5px 6px rgba(49,26,20,.4)',
        }}
      />
    );
  }
  if (kind === 'clip') {
    return (
      <div
        data-paper-adornment="clip"
        style={{
          position: 'absolute',
          left: 42,
          top: -7,
          width: 34,
          height: 62,
          border: '7px solid #615D56',
          borderBottom: 0,
          borderRadius: '18px 18px 0 0',
          boxShadow: '2px 4px 4px rgba(0,0,0,.2)',
        }}
      />
    );
  }
  return (
    <div
      data-paper-adornment="tape"
      style={{
        position: 'absolute',
        left: '39%',
        top: -13,
        width: 102,
        height: 31,
        background: 'rgba(233,206,143,.78)',
        clipPath: 'polygon(2% 12%, 97% 0, 100% 88%, 4% 100%)',
        boxShadow: '0 4px 5px rgba(70,50,27,.2)',
        transform: 'rotate(-2deg)',
      }}
    />
  );
};

const RigidPaperCluster: React.FC<{
  id?: string;
  actionId: string;
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  motion: ActionMotion;
  depth: number;
  fromX?: number;
  fromY?: number;
  fromRotate?: number;
  rotate?: number;
  edge?: number;
  adornment?: 'clip' | 'pin' | 'tape' | 'none';
  children?: React.ReactNode;
}> = ({
  id,
  actionId,
  title,
  x,
  y,
  width,
  height,
  color,
  motion,
  depth,
  fromX = 0,
  fromY = 0,
  fromRotate = 0,
  rotate = 0,
  edge = 0,
  adornment = 'none',
  children,
}) => {
  const landingPress = motion.arrival >= 1 ? 1 - motion.settle : 0;
  const translateX = fromX * (1 - motion.arrival);
  const translateY = fromY * (1 - motion.arrival) + landingPress * 7;
  const rotation = rotate + fromRotate * (1 - motion.arrival) + landingPress * (rotate <= 0 ? 1.2 : -1.2);
  return (
    <div
      data-object-group={id}
      data-action-layer={actionId}
      data-depth-plane={depth}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: depth * 10,
        width,
        height,
        visibility: motion.visible ? 'visible' : 'hidden',
        transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotation}deg) scale(${1 - landingPress * 0.018})`,
        transformOrigin: 'center bottom',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '8px -7px -9px 7px',
          background: '#755E48',
          clipPath: tornEdges[edge % tornEdges.length],
          boxShadow: '0 14px 18px rgba(0,0,0,.32)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxSizing: 'border-box',
          overflow: 'hidden',
          padding: '20px 22px',
          color: '#2B211D',
          background: [
            'linear-gradient(103deg, rgba(255,255,255,.3), transparent 34%)',
            `linear-gradient(168deg, ${color}, ${color} 72%, rgba(111,82,58,.22))`,
          ].join(','),
          clipPath: tornEdges[edge % tornEdges.length],
          boxShadow: 'inset 0 0 0 2px rgba(91,67,48,.13)',
        }}
      >
        <PaperGrain opacity={0.27} />
        {title && (
          <div style={{position: 'relative', zIndex: 2, fontSize: 27, lineHeight: 1.12, fontWeight: 950}}>
            {title}
          </div>
        )}
        <div style={{position: 'relative', zIndex: 2}}>{children}</div>
      </div>
      <PaperAdornment kind={adornment} />
    </div>
  );
};

const RelationArrow: React.FC<{
  actionId: string;
  progress: number;
  left: number;
  top: number;
  width: number;
  rotate?: number;
  color?: string;
}> = ({actionId, progress, left, top, width, rotate = 0, color = '#D36D4F'}) => (
  <div
    data-relation-action={actionId}
    style={{
      position: 'absolute',
      zIndex: 72,
      left,
      top,
      width,
      height: 15,
      visibility: progress > 0 ? 'visible' : 'hidden',
      background: color,
      clipPath: 'polygon(0 30%, 84% 30%, 84% 0, 100% 50%, 84% 100%, 84% 70%, 0 70%)',
      transform: `rotate(${rotate}deg) scaleX(${progress})`,
      transformOrigin: 'left center',
      filter: 'drop-shadow(0 4px 3px rgba(44,27,19,.26))',
    }}
  />
);

const HeaderToken: React.FC<{
  visible: boolean;
  children: React.ReactNode;
  accent?: boolean;
}> = ({visible, children, accent = false}) => (
  <span
    style={{
      display: visible ? 'inline-flex' : 'none',
      alignItems: 'center',
      minHeight: 46,
      padding: '4px 15px',
      color: accent ? '#FFF4DB' : '#2A211C',
      background: accent ? '#A94F3E' : '#F1DFC0',
      clipPath: tornEdges[accent ? 2 : 1],
      boxShadow: '0 7px 10px rgba(0,0,0,.22)',
      fontSize: 27,
      fontWeight: 950,
    }}
  >
    {children}
  </span>
);

const PaperStageBase: React.FC<{
  label: string;
  children: React.ReactNode;
  dark?: boolean;
}> = ({label, children, dark = false}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      color: dark ? '#F8EED8' : '#2A211C',
      background: dark
        ? 'linear-gradient(142deg, #32302A, #1D2423 56%, #29342D)'
        : 'linear-gradient(145deg, #E8D8B8, #C8A97A 54%, #A67D55)',
    }}
  >
    <PaperGrain opacity={dark ? 0.32 : 0.25} />
    <div
      data-depth-plane="1"
      style={{
        position: 'absolute',
        left: 38,
        right: 38,
        top: 22,
        bottom: 24,
        background: dark ? '#43463E' : '#EDE0C5',
        clipPath: tornEdges[0],
        boxShadow: '0 26px 34px rgba(0,0,0,.34), inset 0 0 0 3px rgba(92,66,48,.14)',
        transform: 'rotate(-.35deg)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        zIndex: 8,
        left: 68,
        top: 42,
        color: dark ? '#EFC184' : '#7B3B31',
        fontSize: 18,
        fontWeight: 950,
        letterSpacing: 2,
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

export const PaperBusinessPipelineR10: React.FC<{event: R10Event}> = ({event}) => {
  const frame = useCurrentFrame();
  const paper = getR10PaperRuntimeProps(event);
  const actions = Object.fromEntries(event.actions.map((action) => [action.id, action]));
  const action = (id: string) => {
    const value = actions[id];
    if (!value) throw new Error(`R10_B07_RENDER_ACTION_MISSING:${id}`);
    return actionMotion(frame, event, value);
  };
  const collect = action('collect');
  const classify = action('ai-classify');
  const scriptDraft = action('script-draft');
  const publicMaterials = action('public-materials');
  const aiProduction = action('ai-production');
  const businessFoundation = action('business-foundation');

  const groupById = Object.fromEntries(paper.objectGroups.map((group) => [group.id, group]));
  const group = (id: string) => {
    const value = groupById[id];
    if (!value) throw new Error(`R10_B07_RENDER_GROUP_MISSING:${id}`);
    return value;
  };
  const semanticNodeById = Object.fromEntries(paper.semanticNodes.map((node) => [node.nodeId, node]));
  const node = (id: string): R10PaperSemanticNode => {
    const value = semanticNodeById[id];
    if (!value) throw new Error(`R10_B07_RENDER_NODE_MISSING:${id}`);
    return value;
  };

  const inputGroup = group('g-input');
  const organizeGroup = group('g-ai-organize');
  const scriptGroup = group('g-script');
  const ownerReviewGroup = group('g-owner-review');
  const publicationGroup = group('g-publication');
  const foundationGroup = group('g-foundation');
  const stageOneExitX = -360 * publicMaterials.arrival;
  const stageOneExitRotate = -2.2 * publicMaterials.arrival;
  const stageTwoEntryX = 1920 * (1 - publicMaterials.arrival);
  const stageTwoPress = publicMaterials.arrival >= 1 ? 1 - publicMaterials.settle : 0;

  return (
    <AbsoluteFill
      data-r10-paper-scene="B07"
      data-paper-scene-model="two-stage-match-cut"
      data-final-hold-frames={event.endFrameExclusive - event.actionEndFrame}
      style={{
        zIndex: 200,
        overflow: 'hidden',
        color: '#F9F1DD',
        fontFamily,
        background: 'linear-gradient(132deg, #27191B, #151A1B 52%, #243127)',
      }}
    >
      <PaperGrain opacity={0.32} />

      <div
        data-paper-stage="internal-workbench"
        style={{
          position: 'absolute',
          left: 0,
          top: 86,
          width: 1920,
          height: 720,
          overflow: 'hidden',
          transform: `translateX(${stageOneExitX}px) rotate(${stageOneExitRotate}deg) scale(${1 - publicMaterials.arrival * 0.045})`,
          transformOrigin: 'left center',
        }}
      >
        <PaperStageBase label="纸面一 · 内部整理台" dark>
          <div
            data-depth-plane="2"
            style={{
              position: 'absolute',
              left: 84,
              top: 103,
              width: 1710,
              height: 10,
              background: 'repeating-linear-gradient(90deg, #B5654F 0 46px, transparent 46px 68px)',
              opacity: 0.62,
              transform: 'rotate(.3deg)',
            }}
          />
          <div style={{position: 'absolute', zIndex: 76, left: 90, top: 72, display: 'flex', gap: 12, alignItems: 'center'}}>
            <HeaderToken visible={collect.visible}>{inputGroup.labelZh}</HeaderToken>
            <HeaderToken visible={classify.visible} accent>→ {organizeGroup.labelZh}</HeaderToken>
            <HeaderToken visible={scriptDraft.visible}>→ {scriptGroup.labelZh} · {ownerReviewGroup.labelZh}</HeaderToken>
          </div>

          <RigidPaperCluster
            id={inputGroup.id}
            actionId="collect"
            title={inputGroup.labelZh}
            x={104}
            y={224}
            width={390}
            height={294}
            color="#D98867"
            motion={collect}
            depth={3}
            fromX={-470}
            fromY={36}
            fromRotate={-13}
            rotate={-2.2}
            edge={0}
            adornment="tape"
          >
            <div style={{position: 'relative', marginTop: 18, height: 188}}>
              <div style={{position: 'absolute', left: 8, right: 8, bottom: 2, height: 98, background: '#8F4F45', clipPath: tornEdges[2], boxShadow: 'inset 0 10px 14px rgba(73,39,34,.22)'}} />
              <div style={{position: 'absolute', left: 20, top: 4, transform: 'rotate(-3deg)'}}>
                <NodeLabel id={node('n1-answers').nodeId} text={node('n1-answers').labelZh} color="#F8EDDA" rotate={-1} />
              </div>
              <div style={{position: 'absolute', right: 12, top: 64, transform: 'rotate(2deg)'}}>
                <NodeLabel id={node('n2-collect').nodeId} text={node('n2-collect').labelZh} color="#F1C781" rotate={1} />
              </div>
              <RelationArrow actionId="collect" progress={collect.relation} left={112} top={121} width={118} color="#F4D39C" />
            </div>
          </RigidPaperCluster>

          <RelationArrow actionId="ai-classify" progress={classify.relation} left={493} top={378} width={166} color="#D97757" />
          <RigidPaperCluster
            id={organizeGroup.id}
            actionId="ai-classify"
            title={organizeGroup.labelZh}
            x={660}
            y={188}
            width={430}
            height={332}
            color="#D9C49F"
            motion={classify}
            depth={4}
            fromY={-420}
            fromRotate={8}
            rotate={1.4}
            edge={1}
            adornment="pin"
          >
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 24}}>
              {[node('n3-ai-classify'), node('n4-organize')].map((item, index) => (
                <div
                  key={item.nodeId}
                  style={{
                    minHeight: 177,
                    padding: '20px 14px',
                    boxSizing: 'border-box',
                    background: index === 0 ? '#A7B393' : '#C98267',
                    clipPath: tornEdges[index + 1],
                    boxShadow: 'inset 0 10px 13px rgba(65,50,35,.2), 0 7px 8px rgba(45,31,23,.18)',
                    transform: `rotate(${index ? 1.6 : -1.4}deg)`,
                  }}
                >
                  <div style={{height: 58, borderBottom: '5px dashed rgba(51,42,33,.3)'}} />
                  <NodeLabel id={item.nodeId} text={item.labelZh} color={index === 0 ? '#F1E7CC' : '#F7D8A7'} compact />
                </div>
              ))}
            </div>
          </RigidPaperCluster>

          <RelationArrow actionId="script-draft" progress={scriptDraft.relation} left={1084} top={374} width={142} color="#879876" />
          <RigidPaperCluster
            id={scriptGroup.id}
            actionId="script-draft"
            title={scriptGroup.labelZh}
            x={1224}
            y={186}
            width={540}
            height={350}
            color="#A9B49C"
            motion={scriptDraft}
            depth={5}
            fromX={610}
            fromY={24}
            fromRotate={13}
            rotate={-1.3}
            edge={2}
            adornment="clip"
          >
            <div style={{position: 'absolute', left: 24, top: 72, width: 286, height: 228, padding: 22, boxSizing: 'border-box', background: '#F0E4CA', clipPath: tornEdges[0], boxShadow: '0 9px 12px rgba(52,38,27,.24)', transform: 'rotate(-1deg)'}}>
              <div style={{height: 11, background: '#756C5B', opacity: .26}} />
              <div style={{height: 11, marginTop: 18, width: '78%', background: '#756C5B', opacity: .22}} />
              <div style={{height: 11, marginTop: 18, width: '88%', background: '#756C5B', opacity: .2}} />
              <NodeLabel id={node('n5-video-script').nodeId} text={node('n5-video-script').labelZh} color="#F2C985" compact rotate={-1} />
            </div>
            <div
              data-object-group={ownerReviewGroup.id}
              style={{
                position: 'absolute',
                right: 22,
                top: 92,
                width: 192,
                height: 194,
                padding: '28px 16px 16px',
                boxSizing: 'border-box',
                background: '#D98B69',
                clipPath: tornEdges[1],
                boxShadow: '0 10px 12px rgba(56,35,27,.26)',
                transform: 'rotate(2.4deg)',
              }}
            >
              <div style={{position: 'absolute', left: 58, top: -5, width: 72, height: 27, borderRadius: 7, background: '#615D56', boxShadow: '0 4px 4px rgba(0,0,0,.2)'}} />
              <NodeLabel id={node('n6-owner-review').nodeId} text={node('n6-owner-review').labelZh} color="#F8ECD6" compact />
              <div style={{position: 'absolute', right: 22, bottom: 18, width: 62, height: 62, display: 'grid', placeItems: 'center', border: '7px double #783529', borderRadius: '50%', color: '#783529', fontSize: 18, fontWeight: 950, transform: 'rotate(-12deg)'}}>核对</div>
            </div>
          </RigidPaperCluster>
        </PaperStageBase>
      </div>

      <div
        data-paper-stage="public-production-workbench"
        data-match-cut-action="public-materials"
        style={{
          position: 'absolute',
          zIndex: 120,
          left: 0,
          top: 86,
          width: 1920,
          height: 720,
          overflow: 'hidden',
          visibility: publicMaterials.visible ? 'visible' : 'hidden',
          transform: `translate3d(${stageTwoEntryX}px, ${stageTwoPress * 8}px, 0) rotate(${stageTwoPress * -.55}deg)`,
          transformOrigin: 'center bottom',
        }}
      >
        <PaperStageBase label="纸面二 · 对外表达台">
          <div style={{position: 'absolute', zIndex: 76, left: 438, top: 62, display: 'flex', gap: 12, alignItems: 'center'}}>
            <HeaderToken visible={publicMaterials.visible} accent>{paper.actionLabelsZh['public-materials']}</HeaderToken>
            <HeaderToken visible={aiProduction.visible}>→ {paper.actionLabelsZh['ai-production']}</HeaderToken>
            <HeaderToken visible={businessFoundation.visible} accent>→ {paper.actionLabelsZh['business-foundation']}</HeaderToken>
          </div>

          <div
            data-preserved-causal-chain="confirmed-stage-one"
            data-depth-plane="3"
            style={{
              position: 'absolute',
              zIndex: 34,
              left: 74,
              top: 142,
              width: 304,
              height: 474,
              padding: '24px 21px',
              boxSizing: 'border-box',
              color: '#F6EAD2',
              background: '#44443D',
              clipPath: tornEdges[1],
              boxShadow: '9px 13px 15px rgba(52,35,24,.3)',
              transform: 'rotate(-1.8deg)',
            }}
          >
            <PaperGrain opacity={0.34} />
            <div style={{position: 'relative', fontSize: 21, fontWeight: 950, color: '#EABB7A'}}>已确认链</div>
            {[inputGroup.labelZh, organizeGroup.labelZh, `${scriptGroup.labelZh} · ${ownerReviewGroup.labelZh}`].map((label, index) => (
              <React.Fragment key={label}>
                <div
                  style={{
                    position: 'relative',
                    marginTop: index === 0 ? 25 : 17,
                    minHeight: index === 2 ? 92 : 76,
                    padding: '14px 13px',
                    boxSizing: 'border-box',
                    color: '#30251E',
                    background: ['#D98666', '#D8C19A', '#A8B397'][index],
                    clipPath: tornEdges[index],
                    boxShadow: '0 7px 8px rgba(0,0,0,.23)',
                    fontSize: 21,
                    lineHeight: 1.2,
                    fontWeight: 950,
                    transform: `rotate(${[-1.5, 1.2, -.8][index]}deg)`,
                  }}
                >
                  {label}
                </div>
                {index < 2 && <div style={{position: 'relative', width: 6, height: 22, margin: '0 auto -10px', background: '#E0A55F'}} />}
              </React.Fragment>
            ))}
          </div>

          <div
            data-object-group={publicationGroup.id}
            data-action-layer="public-materials"
            data-depth-plane="4"
            style={{
              position: 'absolute',
              zIndex: 42,
              left: 438,
              top: 126,
              width: 1288,
              height: 282,
              padding: '24px 30px',
              boxSizing: 'border-box',
              color: '#2A211C',
              background: '#D4B178',
              clipPath: tornEdges[2],
              boxShadow: '8px 15px 17px rgba(63,42,27,.3), inset 0 0 0 3px rgba(83,58,35,.16)',
              transform: `rotate(${-.45 + stageTwoPress * .6}deg)`,
            }}
          >
            <PaperGrain opacity={0.24} />
            <div style={{position: 'relative', fontSize: 27, fontWeight: 950}}>{publicationGroup.labelZh}</div>
            <div style={{position: 'relative', display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 32, marginTop: 18}}>
              <div style={{minHeight: 172, padding: '22px 24px', boxSizing: 'border-box', background: '#F1E4C7', clipPath: tornEdges[0], boxShadow: '0 9px 10px rgba(64,43,28,.23)', transform: 'rotate(-1.1deg)'}}>
                <div style={{height: 10, width: '84%', background: '#8E836D', opacity: .24}} />
                <div style={{height: 10, width: '66%', marginTop: 17, background: '#8E836D', opacity: .2}} />
                <NodeLabel id={node('n7-public-materials').nodeId} text={node('n7-public-materials').labelZh} color="#E8C582" compact />
              </div>
              <div style={{minHeight: 172, padding: '22px 24px', boxSizing: 'border-box', background: '#B9C3A3', clipPath: tornEdges[1], boxShadow: '0 9px 10px rgba(64,43,28,.23)', transform: 'rotate(1.3deg)'}}>
                <div style={{display: 'flex', gap: 11}}>
                  {[0, 1, 2].map((index) => <div key={index} style={{width: 42 + index * 12, height: 48 + index * 16, background: index === 1 ? '#D3785C' : '#EFE1C3', clipPath: tornEdges[index], boxShadow: '0 5px 6px rgba(0,0,0,.16)'}} />)}
                </div>
                <NodeLabel id={node('n8-explain-outward').nodeId} text={node('n8-explain-outward').labelZh} color="#F4E6CC" compact rotate={1} />
              </div>
            </div>
            <RelationArrow actionId="public-materials" progress={publicMaterials.relation} left={535} top={214} width={194} color="#A84F3F" />
            <PaperAdornment kind="tape" />
          </div>

          <RigidPaperCluster
            id={foundationGroup.id}
            actionId="ai-production"
            x={514}
            y={438}
            width={1090}
            height={124}
            color="#C8D0B1"
            motion={aiProduction}
            depth={5}
            fromX={-620}
            fromRotate={-5}
            rotate={.5}
            edge={1}
            adornment="pin"
          >
            <div style={{position: 'relative', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 22, marginTop: 3}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                {[0, 1, 2, 3].map((index) => <span key={index} style={{display: 'block', width: 68 + index * 11, height: 15, background: index === 2 ? '#C66F55' : '#7D9271', clipPath: tornEdges[index % 3]}} />)}
              </div>
              <div
                data-fixed-label-stand="n9-ai-production"
                style={{
                  position: 'relative',
                  zIndex: 5,
                  minHeight: 61,
                  padding: '3px 12px 8px',
                  boxSizing: 'border-box',
                  background: '#E9D9B8',
                  clipPath: tornEdges[0],
                  boxShadow: '0 7px 9px rgba(54,39,28,.25)',
                }}
              >
                <div aria-hidden style={{position: 'absolute', left: '50%', bottom: -18, width: 10, height: 22, background: '#655D4F', transform: 'translateX(-50%)'}} />
                <NodeLabel id={node('n9-ai-production').nodeId} text={node('n9-ai-production').labelZh} color="#F0D49E" />
              </div>
            </div>
            <div style={{position: 'absolute', zIndex: 1, left: 35, right: 330, top: 72, height: 8, background: '#6D7C63', transform: `scaleX(${aiProduction.relation})`, transformOrigin: 'left center'}} />
          </RigidPaperCluster>

          <RelationArrow actionId="business-foundation" progress={businessFoundation.relation} left={975} top={553} width={82} rotate={90} color="#A84F3F" />
          <RigidPaperCluster
            actionId="business-foundation"
            x={432}
            y={570}
            width={1324}
            height={132}
            color="#B65E49"
            motion={businessFoundation}
            depth={6}
            fromY={260}
            fromRotate={-3}
            rotate={-.4}
            edge={2}
            adornment="tape"
          >
            <div data-foundation-substrate="business-foundation" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28, color: '#FFF1D7', fontSize: 31, fontWeight: 950}}>
              <span>{paper.actionLabelsZh['business-foundation']}</span>
              <NodeLabel id={node('n10-business-foundation').nodeId} text={node('n10-business-foundation').labelZh} color="#F5D59A" />
            </div>
            <div style={{position: 'absolute', left: 24, right: 24, bottom: 12, height: 10, background: 'repeating-linear-gradient(90deg, rgba(255,238,208,.76) 0 74px, transparent 74px 96px)'}} />
          </RigidPaperCluster>
        </PaperStageBase>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 74,
          bottom: 226,
          zIndex: 220,
          padding: '8px 13px',
          color: '#F8E9CA',
          background: 'rgba(26,20,19,.74)',
          fontSize: 19,
          fontWeight: 800,
        }}
      >
        概念演绎｜中文节点由 Remotion 确定性渲染
      </div>
    </AbsoluteFill>
  );
};

export const VisibilityBridgeR10: React.FC<{event: R10Event}> = ({event}) => {
  const frame = useCurrentFrame();
  const enter = anchorProgress(frame, event, 'firstVisibleFrame', 'firstReadableFrame');
  const bridge = anchorProgress(frame, event, 'firstReadableFrame', 'semanticSettleFrame');
  const discover = anchorProgress(frame, event, 'semanticSettleFrame', 'actionEndFrame');
  return (
    <OverlayShell eyebrow="B08 · 从店里走到店外" title="没来过的人，也能看见这些经验" accent="#75D0C0" contentProgress={bridge}>
      <div style={{position: 'relative', height: 355}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 50,
            width: 210,
            height: 205,
            display: 'grid',
            placeItems: 'center',
            color: '#F7E8CB',
            background: '#8B4A3E',
            clipPath: 'polygon(4% 16%, 50% 0, 96% 16%, 91% 100%, 8% 96%)',
            fontSize: 31,
            fontWeight: 950,
            opacity: enter,
            transform: `translateX(${interpolate(enter, [0, 1], [-90, 0])}px)`,
          }}
        >
          进店才知道
        </div>
        <div
          style={{
            position: 'absolute',
            left: 210,
            top: 137,
            width: 205,
            height: 18,
            background: '#75D0C0',
            clipPath: 'polygon(0 28%, 84% 28%, 84% 0, 100% 50%, 84% 100%, 84% 72%, 0 72%)',
            transform: `scaleX(${bridge})`,
            transformOrigin: 'left center',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 4,
            top: 28,
            width: 270,
            height: 254,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            boxSizing: 'border-box',
            color: '#28312C',
            background: '#D8DFC4',
            borderRadius: '50%',
            boxShadow: '0 14px 36px rgba(0,0,0,.3)',
            fontSize: 29,
            lineHeight: 1.25,
            fontWeight: 950,
            textAlign: 'center',
            opacity: discover,
            transform: `scale(${interpolate(discover, [0, 1], [0.45, 1])})`,
          }}
        >
          没来过的人<br />搜索时也能找到
        </div>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: 420 + index * 42,
              top: 78 + index * 69,
              width: 84,
              height: 8,
              borderRadius: 99,
              background: index === 1 ? '#F0B56D' : '#75D0C0',
              opacity: discover,
              transform: `translateX(${interpolate(discover, [0, 1], [-54, 0])}px) rotate(${index * 18 - 18}deg)`,
            }}
          />
        ))}
      </div>
    </OverlayShell>
  );
};
