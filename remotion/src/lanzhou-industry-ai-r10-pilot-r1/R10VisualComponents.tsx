import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame} from 'remotion';

import {
  R10_FPS,
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

const actionProgress = (frame: number, event: R10Event, action: R10Action) => {
  const start = localFrame(event, action.startFrame);
  const duration = Math.max(1, action.endFrameExclusive - action.startFrame);
  return spring({
    frame: Math.max(0, frame - start),
    fps: R10_FPS,
    durationInFrames: duration,
    config: {damping: 20, stiffness: 142, mass: 0.82},
  });
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

const PaperCard: React.FC<{
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  progress: number;
  depth: number;
  rotate?: number;
  children?: React.ReactNode;
}> = ({id, title, x, y, width, height, color, progress, depth, rotate = 0, children}) => (
  <div
    data-object-group={id}
    data-depth-plane={depth}
    style={{
      position: 'absolute',
      left: x,
      top: y,
      zIndex: depth * 10,
      width,
      height,
      padding: '18px 20px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      color: '#251D1A',
      background: color,
      clipPath: 'polygon(1% 3%, 98% 0, 100% 94%, 96% 100%, 2% 97%, 0 9%)',
      boxShadow: `0 ${10 + depth * 4}px ${22 + depth * 8}px rgba(0,0,0,.34)`,
      opacity: progress,
      transform: `translateY(${interpolate(progress, [0, 1], [120, 0])}px) scale(${interpolate(progress, [0, 1], [0.78, 1])}) rotate(${rotate}deg)`,
      transformOrigin: 'center bottom',
    }}
  >
    <PaperGrain opacity={0.22} />
    <div style={{position: 'relative', fontSize: 26, fontWeight: 950}}>{title}</div>
    {children}
  </div>
);

const NodeLabel: React.FC<{
  id: string;
  text: string;
  color?: string;
  progress?: number;
}> = ({id, text, color = '#F9F3E3', progress = 1}) => (
  <span
    data-semantic-node={id}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 34,
      margin: '7px 7px 0 0',
      padding: '4px 10px',
      color: '#28201C',
      background: color,
      boxShadow: '0 4px 8px rgba(0,0,0,.16)',
      fontSize: 18,
      fontWeight: 900,
      opacity: progress,
      transform: `translateY(${interpolate(progress, [0, 1], [24, 0])}px) scale(${interpolate(progress, [0, 1], [0.82, 1])})`,
    }}
  >
    {text}
  </span>
);

export const PaperBusinessPipelineR10: React.FC<{event: R10Event}> = ({event}) => {
  const frame = useCurrentFrame();
  const paper = getR10PaperRuntimeProps(event);
  const actions = event.actions.slice(0, 6);
  if (actions.length < 6) throw new Error('R10_B07_RENDER_ACTIONS_INCOMPLETE');
  const [collect, classify, scriptDraft, publicMaterials, aiProduction, businessFoundation] = actions.map((action) => (
    actionProgress(frame, event, action)
  ));
  const groups = paper.objectGroups;
  if (groups.length !== 6) throw new Error('R10_B07_RENDER_REQUIRES_SIX_GROUPS');
  const nodesFor = (groupId: string) => paper.semanticNodes.filter((node) => (
    node.objectGroupId === groupId
  ));
  const renderNodes = (
    nodes: R10PaperSemanticNode[],
    progress: number,
    colors: string[] = [],
  ) => nodes.map((node, index) => (
    <NodeLabel
      key={node.nodeId}
      id={node.nodeId}
      text={node.labelZh}
      color={colors[index]}
      progress={progress}
    />
  ));

  return (
    <AbsoluteFill
      data-r10-paper-scene="B07"
      data-final-hold-frames={event.endFrameExclusive - event.actionEndFrame}
      style={{
        zIndex: 200,
        overflow: 'hidden',
        color: '#F9F1DD',
        fontFamily,
        background: [
          'radial-gradient(circle at 72% 18%, rgba(220,153,83,.2), transparent 25%)',
          'linear-gradient(132deg, #301A1C 0%, #17181B 48%, #263026 100%)',
        ].join(','),
      }}
    >
      <PaperGrain opacity={0.3} />
      <div
        data-depth-plane="1"
        style={{
          position: 'absolute',
          left: -80,
          top: -110,
          width: 820,
          height: 390,
          background: '#713B36',
          clipPath: 'polygon(0 4%, 95% 0, 100% 79%, 83% 100%, 0 90%)',
          transform: `rotate(-7deg) translateY(${interpolate(collect, [0, 1], [-80, 0])}px)`,
          opacity: 0.72 * collect,
        }}
      />
      <div
        data-depth-plane="2"
        style={{
          position: 'absolute',
          left: 330,
          top: 74,
          width: 1280,
          height: 704,
          background: '#C9A86B',
          clipPath: 'polygon(1% 5%, 96% 0, 100% 94%, 4% 100%)',
          boxShadow: '0 32px 80px rgba(0,0,0,.46)',
          transform: 'rotate(-1.8deg)',
          opacity: 0.32,
        }}
      />
      <div style={{position: 'absolute', left: 66, top: 48, zIndex: 80}}>
        <div style={{color: '#E9B16E', fontSize: 20, fontWeight: 950, letterSpacing: 2}}>B07 · 确定性纸艺装配</div>
        <div style={{marginTop: 7, fontSize: 48, fontWeight: 950}}>
          {groups[0].labelZh} → {groups[4].labelZh} → {groups[5].labelZh}
        </div>
      </div>

      <PaperCard id={groups[0].id} title={groups[0].labelZh} x={70} y={170} width={330} height={210} color="#D78362" progress={collect} depth={3} rotate={-2}>
        {renderNodes(nodesFor(groups[0].id), collect, ['#F9F3E3', '#F3C988'])}
      </PaperCard>
      <PaperCard id={groups[1].id} title={groups[1].labelZh} x={470} y={130} width={300} height={200} color="#E2C49B" progress={classify} depth={4} rotate={2}>
        {renderNodes(nodesFor(groups[1].id), classify, ['#D9E2B4', '#F3C988'])}
      </PaperCard>
      <PaperCard id={groups[2].id} title={groups[2].labelZh} x={830} y={180} width={310} height={200} color="#A8B69B" progress={scriptDraft} depth={5} rotate={-1}>
        {renderNodes(nodesFor(groups[2].id), scriptDraft)}
      </PaperCard>
      <PaperCard id={groups[3].id} title={groups[3].labelZh} x={1210} y={138} width={340} height={210} color="#E8D7B8" progress={scriptDraft} depth={4} rotate={2.5}>
        {renderNodes(nodesFor(groups[3].id), scriptDraft, ['#F7E9C8'])}
        <div
          style={{
            position: 'absolute',
            right: 26,
            bottom: 24,
            width: 82,
            height: 82,
            display: 'grid',
            placeItems: 'center',
            border: '8px double #7B3129',
            borderRadius: '50%',
            color: '#7B3129',
            fontSize: 23,
            fontWeight: 950,
            opacity: scriptDraft,
            transform: `rotate(-12deg) scale(${interpolate(scriptDraft, [0, 1], [1.8, 1])})`,
          }}
        >
          {groups[3].labelZh}
        </div>
      </PaperCard>
      <PaperCard id={groups[4].id} title={groups[4].labelZh} x={420} y={492} width={520} height={190} color="#C7D0A9" progress={publicMaterials} depth={6} rotate={-1.5}>
        {renderNodes(nodesFor(groups[4].id), publicMaterials, ['#F2D08F', '#F7E9C8'])}
      </PaperCard>
      <PaperCard id={groups[5].id} title={groups[5].labelZh} x={1080} y={500} width={500} height={190} color="#E4A86F" progress={aiProduction} depth={6} rotate={1.5}>
        {nodesFor(groups[5].id).map((node, index) => (
          <NodeLabel
            key={node.nodeId}
            id={node.nodeId}
            text={node.labelZh}
            color={index === 0 ? '#F2D08F' : '#F7E9C8'}
            progress={index === 0 ? aiProduction : businessFoundation}
          />
        ))}
      </PaperCard>

      {[
        {left: 386, top: 248, width: 150, progress: collect},
        {left: 785, top: 236, width: 125, progress: classify},
        {left: 1190, top: 245, width: 155, progress: scriptDraft},
        {left: 1410, top: 352, width: 190, progress: publicMaterials, rotate: 118},
        {left: 820, top: 564, width: 300, progress: businessFoundation},
      ].map((arrow, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            zIndex: 75,
            left: arrow.left,
            top: arrow.top,
            width: arrow.width,
            height: 12,
            background: '#F0B96F',
            clipPath: 'polygon(0 30%, 82% 30%, 82% 0, 100% 50%, 82% 100%, 82% 70%, 0 70%)',
            opacity: arrow.progress,
            transform: `rotate(${arrow.rotate ?? 0}deg) scaleX(${arrow.progress})`,
            transformOrigin: 'left center',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          zIndex: 85,
          right: 70,
          top: 418,
          width: 210,
          height: 210,
          border: '4px dashed rgba(240,185,111,.76)',
          borderRadius: '50%',
          opacity: businessFoundation,
          transform: `scale(${interpolate(businessFoundation, [0, 1], [0.4, 1])}) rotate(${interpolate(businessFoundation, [0, 1], [-28, 0])}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          zIndex: 90,
          right: 94,
          top: 482,
          width: 162,
          color: '#F3D69D',
          fontSize: 27,
          lineHeight: 1.25,
          fontWeight: 950,
          textAlign: 'center',
          opacity: businessFoundation,
        }}
      >
        {paper.actionLabelsZh['business-foundation']}<br />{paper.actionLabelsZh['ai-production']}
      </div>
      <div
        data-action-layer="ai-production"
        style={{
          position: 'absolute',
          zIndex: 82,
          left: 700,
          top: 406,
          width: 520,
          height: 62,
          display: 'grid',
          placeItems: 'center',
          color: '#2B2621',
          background: '#F0B96F',
          clipPath: 'polygon(2% 10%, 98% 0, 100% 86%, 3% 100%)',
          boxShadow: '0 12px 26px rgba(0,0,0,.3)',
          fontSize: 24,
          fontWeight: 950,
          opacity: aiProduction,
          transform: `translateY(${interpolate(aiProduction, [0, 1], [64, 0])}px) scaleX(${interpolate(aiProduction, [0, 1], [0.45, 1])})`,
        }}
      >
        {paper.actionLabelsZh['ai-classify']} · {paper.actionLabelsZh['ai-production']}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 74,
          bottom: 226,
          zIndex: 92,
          padding: '8px 13px',
          color: '#F8E9CA',
          background: 'rgba(26,20,19,.7)',
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
