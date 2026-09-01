import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  CommentMagnifier,
  Conveyor,
  FilmReel,
  FoldedMap,
  FriendBubble,
  InkLabel,
  MachineGear,
  PaperGrain,
  PaperPiece,
  PaperPin,
  Twine,
  Workbench,
} from './PaperPrimitives';
import {
  DirectorCaption,
  DirectorNode,
  DirectorPlan,
  DirectorScene,
  DIRECTOR_ANIMATION_FRAMES,
  PAPER_EDITORIAL,
  authoredLocalStopMotionFrameState,
  complexRelationRenderEdges,
  complexLayoutSlotForGroup,
  expandSfxCues,
  groupEnterFrame,
  mechanicalRelationRenderEdges,
  nodeEnterFrame,
  occludedStateFrameState,
  photographicStopMotionCamera,
  secondsToFrames,
  stageFrameForTarget,
} from './style';

const {colors, font} = PAPER_EDITORIAL;

type DirectorScreenClip = NonNullable<
  NonNullable<DirectorPlan['media']>['screenClips']
>[number];

const SceneHeader: React.FC<{scene: DirectorScene; index: number; startFrame: number}> = ({
  scene,
  index,
  startFrame,
}) => (
  <PaperPiece
    x={92}
    y={92}
    width={680}
    height={102}
    enterFrame={startFrame}
    color={colors.paperLight}
    thickness={4}
    direction="left"
    rotate={-1.2}
    zIndex={80}
  >
    <div style={{position: 'absolute', inset: '18px 26px', display: 'flex', alignItems: 'center', gap: 20}}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: colors.paperLight,
          background: index === 0 ? colors.red : colors.blue,
          fontFamily: font,
          fontWeight: 950,
          fontSize: 23,
          boxShadow: `0 5px 0 ${colors.ink}`,
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </div>
      <InkLabel size={30}>{scene.cognitiveIncrement}</InkLabel>
    </div>
  </PaperPiece>
);

const groupNodes = (scene: DirectorScene, groupId: string) =>
  (scene.nodes ?? []).filter((node) => node.groupId === groupId);

type PrimitiveNodeEntry = DirectorNode & {enterFrame: number};

const nodeEntriesForGroup = (
  scene: DirectorScene,
  groupId: string,
  fps: number,
): PrimitiveNodeEntry[] =>
  groupNodes(scene, groupId).map((node) => ({
    ...node,
    enterFrame: nodeEnterFrame(scene, node, fps),
  }));

const requireStageFrame = (scene: DirectorScene, targetId: string, fps: number) => {
  const frame = stageFrameForTarget(scene, targetId, fps);
  if (frame === null) throw new Error(`DIRECTOR_RUNTIME_STAGE_MISSING:${targetId}`);
  return frame;
};

const TimedNodeTags: React.FC<{
  nodes: PrimitiveNodeEntry[];
  dark?: boolean;
}> = ({nodes, dark = false}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', left: 14, right: 14, bottom: 50, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 5, zIndex: 20}}>
      {nodes.map((node, index) => {
        const progress = interpolate(frame, [node.enterFrame - 5, node.enterFrame + 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        });
        return (
          <div
            key={node.id}
            style={{
              padding: '5px 9px',
              background: dark ? colors.paperLight : index % 2 ? colors.yellow : colors.paperLight,
              color: colors.ink,
              font: `900 14px/1 ${font}`,
              boxShadow: '3px 4px 0 rgba(20,39,45,.18)',
              opacity: progress,
              transform: `translateY(${interpolate(progress, [0, 1], [18, 0])}px) scale(${interpolate(progress, [0, 1], [.78, 1])}) rotate(${index % 2 ? 1.2 : -1.2}deg)`,
            }}
          >
            {node.label ?? node.id}
          </div>
        );
      })}
    </div>
  );
};

const PrimitiveContent: React.FC<{
  primitive: string;
  label: string;
  nodes: PrimitiveNodeEntry[];
}> = ({primitive, label, nodes}) => {
  if (primitive === 'film-reel') return <><FilmReel label={label} /><TimedNodeTags nodes={nodes} dark /></>;
  if (primitive === 'comment-magnifier') return <><CommentMagnifier label={label} /><TimedNodeTags nodes={nodes} /></>;
  if (primitive === 'folded-map') return <><FoldedMap label={label} /><TimedNodeTags nodes={nodes} dark /></>;
  if (primitive === 'friend-bubble') return <><FriendBubble label={label} /><TimedNodeTags nodes={nodes} /></>;
  if (primitive === 'request-tray' || primitive === 'convergence-tray') {
    return (
      <><InkLabel size={22} align="center" style={{position: 'absolute', left: 16, right: 16, top: 18}}>{label}</InkLabel><TimedNodeTags nodes={nodes} dark={primitive === 'convergence-tray'} /></>
    );
  }
  if (primitive === 'timeline-strip') {
    return (
      <div style={{position: 'absolute', inset: 22, fontFamily: font}}>
        <div style={{position: 'absolute', left: 18, right: 18, top: 58, height: 22, background: colors.ink}} />
        {[0, 1, 2, 3].map((index) => <div key={index} style={{position: 'absolute', left: 35 + index * 105, top: 30, width: 4, height: 82, background: index % 2 ? colors.red : colors.yellow}} />)}
        <TimedNodeTags nodes={nodes} />
      </div>
    );
  }
  if (primitive === 'tool-ticket') {
    return (
      <div style={{position: 'absolute', inset: 24, display: 'grid', gridTemplateColumns: '100px 1fr', gap: 18, alignItems: 'center'}}>
        <div style={{width: 88, height: 88, display: 'grid', placeItems: 'center', borderRadius: '50%', background: colors.ink, color: colors.paperLight, font: `950 32px/1 ${font}`, boxShadow: `0 8px 0 ${colors.red}`}}>AI</div>
        <InkLabel size={25}>{label}</InkLabel>
        <TimedNodeTags nodes={nodes} />
      </div>
    );
  }
  if (primitive === 'cut-paper-track') {
    return (
      <div style={{position: 'absolute', inset: 24}}>
        {[0, 1, 2, 3].map((index) => <div key={index} style={{width: `${92 - index * 15}%`, height: 24, marginTop: 15, background: index % 2 ? colors.inkSoft : colors.red, boxShadow: '4px 5px 0 rgba(20,39,45,.15)'}} />)}
        <TimedNodeTags nodes={nodes} />
      </div>
    );
  }
  if (primitive === 'lever-track') {
    return (
      <div style={{position: 'absolute', inset: 22}}>
        <div style={{position: 'absolute', left: 25, top: 82, width: 245, height: 18, background: colors.ink, transform: 'rotate(-10deg)', transformOrigin: '60% 50%'}} />
        <div style={{position: 'absolute', left: 158, top: 93, width: 0, height: 0, borderLeft: '32px solid transparent', borderRight: '32px solid transparent', borderBottom: `64px solid ${colors.red}`}} />
        {[0, 1, 2].map((index) => <div key={index} style={{position: 'absolute', right: 18 + index * 35, bottom: 44, width: 24, height: 35 + index * 35, background: colors.yellow}} />)}
        <TimedNodeTags nodes={nodes} />
      </div>
    );
  }
  if (primitive === 'control-rig') {
    return (
      <div style={{position: 'absolute', inset: 20}}>
        <div style={{position: 'absolute', left: 38, right: 38, top: 28, height: 15, background: colors.ink}} />
        {[78, 160, 242].map((left, index) => <div key={left} style={{position: 'absolute', left, top: 40, width: 5, height: 78 + index * 10, background: index === 1 ? colors.red : colors.inkSoft}} />)}
        <div style={{position: 'absolute', left: 96, bottom: 48, width: 160, height: 19, background: colors.yellow, transform: 'rotate(-12deg)', boxShadow: '7px 8px 0 rgba(20,39,45,.22)'}} />
        <TimedNodeTags nodes={nodes} />
      </div>
    );
  }
  if (primitive === 'responsibility-base') {
    return (
      <div style={{position: 'absolute', inset: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18}}>
        <TimedNodeTags nodes={nodes} />
      </div>
    );
  }
  throw new Error(`DIRECTOR_RUNTIME_VISUAL_PRIMITIVE_UNKNOWN:${primitive}`);
};

const COMPLEX_LAYOUT = [
  {x: 690, y: 248, width: 540, height: 135, rotate: -0.6},
  {x: 170, y: 425, width: 330, height: 235, rotate: -2.2},
  {x: 555, y: 425, width: 330, height: 235, rotate: 1.5},
  {x: 1035, y: 425, width: 330, height: 235, rotate: -1.3},
  {x: 1420, y: 425, width: 330, height: 235, rotate: 2},
  {x: 685, y: 738, width: 550, height: 125, rotate: -0.4},
] as const;

const primitiveColors: Record<string, {color: string; material: string}> = {
  'request-tray': {color: colors.paperLight, material: 'uncoated'},
  'film-reel': {color: colors.red, material: 'film'},
  'comment-magnifier': {color: colors.paperLight, material: 'uncoated'},
  'folded-map': {color: colors.blue, material: 'blueprint'},
  'friend-bubble': {color: colors.yellow, material: 'kraft'},
  'convergence-tray': {color: colors.ink, material: 'blueprint'},
  'timeline-strip': {color: colors.paperLight, material: 'uncoated'},
  'tool-ticket': {color: colors.yellow, material: 'kraft'},
  'cut-paper-track': {color: '#D7D1C0', material: 'uncoated'},
  'lever-track': {color: colors.blue, material: 'blueprint'},
  'control-rig': {color: colors.paperLight, material: 'uncoated'},
  'responsibility-base': {color: '#C7A36A', material: 'kraft'},
};

const complexLayoutForGroup = (scene: DirectorScene, groupId: string) => {
  const layout = COMPLEX_LAYOUT[complexLayoutSlotForGroup(scene, groupId)];
  if (!layout) {
    throw new Error(`DIRECTOR_RUNTIME_COMPLEX_LAYOUT_MISSING:${scene.id}:${groupId}`);
  }
  return layout;
};

const ComplexExplanationScene: React.FC<{scene: DirectorScene; sceneIndex: number}> = ({scene, sceneIndex}) => {
  const {fps} = useVideoConfig();
  const groups = scene.objectGroups ?? [];
  if (groups.length < 5 || groups.length > 6) throw new Error('DIRECTOR_RUNTIME_COMPLEX_GROUP_COUNT_INVALID');
  const groupEnterFrames = groups.map((group) => groupEnterFrame(scene, group, fps));
  const finalGroupIndex = groups.length - 1;
  const finalLayout = complexLayoutForGroup(scene, groups[finalGroupIndex].id);
  const relationEdges = complexRelationRenderEdges(scene, fps);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Workbench label="语义装配工作台" />
      <SceneHeader scene={scene} index={sceneIndex} startFrame={Math.max(0, groupEnterFrames[0])} />
      <PaperPiece x={118} y={218} width={1684} height={690} enterFrame={Math.max(0, groupEnterFrames[0] - 3)} color={colors.paper} material="uncoated" thickness={9} direction="press" rotate={-0.45} tiltX={2.8} tiltY={-1.4} zIndex={3} clip="b">
        <PaperGrain strength={1.15} />
        <div style={{position: 'absolute', left: 68, right: 68, top: 72, height: 4, background: colors.ink, opacity: 0.25}} />
      </PaperPiece>
      {groups.slice(0, -1).map((group, index) => {
        const layout = complexLayoutForGroup(scene, group.id);
        const palette = primitiveColors[group.visualPrimitive];
        if (!palette) throw new Error(`DIRECTOR_RUNTIME_VISUAL_PRIMITIVE_UNKNOWN:${group.visualPrimitive}`);
        const nodes = nodeEntriesForGroup(scene, group.id, fps);
        return (
          <React.Fragment key={group.id}>
            <PaperPiece x={layout.x} y={layout.y} width={layout.width} height={layout.height} enterFrame={groupEnterFrames[index]} color={palette.color} material={palette.material} thickness={index === 0 ? 6 : 8} direction={index % 2 ? 'left' : 'right'} rotate={layout.rotate} zIndex={20 + index * 3}>
              <PrimitiveContent primitive={group.visualPrimitive} label={group.label} nodes={nodes} />
            </PaperPiece>
            {index > 0 ? <PaperPin x={layout.x + layout.width / 2} y={layout.y + layout.height} enterFrame={groupEnterFrames[index] + 3} color={[colors.red, colors.yellow, colors.blue, colors.cyan][(index - 1) % 4]} size={31} zIndex={36} /> : null}
          </React.Fragment>
        );
      })}
      {relationEdges.map((edge, index) => {
        const fromLayout = COMPLEX_LAYOUT[edge.fromSlot];
        const toLayout = COMPLEX_LAYOUT[edge.toSlot];
        if (!fromLayout || !toLayout) {
          throw new Error(`DIRECTOR_RUNTIME_COMPLEX_RELATION_LAYOUT_MISSING:${edge.from}->${edge.to}`);
        }
        return (
          <Twine
            key={`${edge.from}:${edge.to}`}
            x1={fromLayout.x + fromLayout.width / 2}
            y1={fromLayout.y + fromLayout.height / 2}
            x2={toLayout.x + toLayout.width / 2}
            y2={toLayout.y + toLayout.height / 2}
            enterFrame={edge.enterFrame}
            color={[colors.red, colors.yellow, colors.blue, colors.cyan][index % 4]}
            width={8}
            zIndex={12}
          />
        );
      })}
      {(() => {
        const group = groups[finalGroupIndex];
        const palette = primitiveColors[group.visualPrimitive];
        if (!palette) throw new Error(`DIRECTOR_RUNTIME_VISUAL_PRIMITIVE_UNKNOWN:${group.visualPrimitive}`);
        return (
          <>
            <PaperPiece x={finalLayout.x} y={finalLayout.y} width={finalLayout.width} height={finalLayout.height} enterFrame={groupEnterFrames[finalGroupIndex]} color={palette.color} material={palette.material} thickness={9} direction="press" rotate={finalLayout.rotate} zIndex={48}>
              <PrimitiveContent primitive={group.visualPrimitive} label={group.label} nodes={nodeEntriesForGroup(scene, group.id, fps)} />
            </PaperPiece>
            <PaperPin x={finalLayout.x + finalLayout.width / 2} y={finalLayout.y + 31} enterFrame={groupEnterFrames[finalGroupIndex] + 3} color={colors.red} size={42} zIndex={55} />
          </>
        );
      })()}
    </AbsoluteFill>
  );
};

const PaperScreen: React.FC<{
  clip: DirectorScreenClip;
  fromFrame: number;
  label: string;
}> = ({clip, fromFrame, label}) => {
  const {fps} = useVideoConfig();
  return (
    <Sequence from={fromFrame} durationInFrames={clip.outputOutFrame - clip.outputInFrame} premountFor={Math.round(fps / 2)}>
      <div style={{position: 'absolute', inset: 0}}>
        <div
          style={{
            position: 'absolute',
            left: 26,
            top: 26,
            width: 212,
            height: 458,
            border: `12px solid ${colors.ink}`,
            borderRadius: 23,
            overflow: 'hidden',
            background: colors.ink,
            boxShadow: '8px 10px 0 rgba(20,39,45,.2)',
          }}
        >
          <OffthreadVideo
            muted
            src={staticFile(clip.staticFileName)}
            trimBefore={clip.trimBeforeFrame}
            playbackRate={clip.playbackRate}
            style={{width: '100%', height: '100%', objectFit: 'contain', background: colors.ink}}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 263,
            right: 26,
            top: 55,
            height: 292,
            overflow: 'hidden',
            border: `10px solid ${colors.paperLight}`,
            boxShadow: `0 0 0 4px ${colors.ink}, 8px 11px 0 rgba(20,39,45,.17)`,
            background: colors.paper,
          }}
        >
          <OffthreadVideo
            muted
            src={staticFile(clip.staticFileName)}
            trimBefore={clip.trimBeforeFrame}
            playbackRate={clip.playbackRate}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: '50% 43%',
              filter: 'saturate(.66) contrast(1.1) sepia(.09)',
            }}
          />
          <div style={{position: 'absolute', inset: 0, backgroundImage: `radial-gradient(${colors.ink} 0 1px, transparent 1.4px)`, backgroundSize: '8px 8px', opacity: 0.12, mixBlendMode: 'multiply'}} />
        </div>
        <InkLabel size={27} style={{position: 'absolute', left: 270, right: 30, top: 382}}>
          {label}
        </InkLabel>
      </div>
    </Sequence>
  );
};

const SupportPrimitive: React.FC<{
  primitive: string;
  label: string;
  nodes: PrimitiveNodeEntry[];
}> = ({primitive, label, nodes}) => {
  if (primitive === 'path-base') {
    return (
      <div style={{position: 'absolute', inset: '17px 28px'}}>
        <div style={{position: 'absolute', left: 12, right: 12, top: 34, height: 10, background: colors.ink, transform: 'skewX(-18deg)'}} />
        {[0, 1, 2].map((index) => <div key={index} style={{position: 'absolute', left: 18 + index * 285, top: 20, width: 35, height: 35, borderRadius: '50%', background: index === 1 ? colors.red : colors.yellow, border: `6px solid ${colors.ink}`}} />)}
        <InkLabel size={23} align="center" style={{position: 'absolute', left: 0, right: 0, top: 58}}>{label}</InkLabel>
      </div>
    );
  }
  if (primitive === 'responsibility-base') {
    return (
      <div style={{position: 'absolute', inset: 12, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 18}}>
        <div style={{height: 48, border: `7px double ${colors.red}`, display: 'grid', placeItems: 'center', color: colors.red, font: `950 21px/1 ${font}`, transform: 'rotate(-1deg)'}}>{label}</div>
        <TimedNodeTags nodes={nodes} />
        <div style={{width: 72, height: 72, borderRadius: '50%', background: colors.ink, boxShadow: `inset 0 0 0 11px ${colors.yellow}, 7px 8px 0 rgba(20,39,45,.2)`}} />
      </div>
    );
  }
  throw new Error(`DIRECTOR_RUNTIME_VISUAL_PRIMITIVE_UNKNOWN:${primitive}`);
};

const MechanicalCausalityScene: React.FC<{
  scene: DirectorScene;
  sceneIndex: number;
  clips: DirectorScreenClip[];
}> = ({scene, sceneIndex, clips}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const groups = scene.objectGroups ?? [];
  const inputGroup = groups.find((group) => group.visualRole === 'causal-input');
  const actionGroup = groups.find((group) => group.visualRole === 'single-causal-action');
  const outputGroup = groups.find((group) => ['evidence-output', 'human-decision-output'].includes(group.visualRole));
  const supportGroups = groups.filter((group) => group.visualRole === 'causal-support');
  const supportGroup = supportGroups[0];
  if (!scene.mechanism || !inputGroup || !actionGroup || !outputGroup || !supportGroup) {
    throw new Error('DIRECTOR_RUNTIME_MECHANISM_CORE_MISSING');
  }
  if (supportGroups.length !== 1) throw new Error('DIRECTOR_RUNTIME_SUPPORT_GROUP_COUNT_INVALID');
  if (inputGroup.visualPrimitive !== 'answer-tickets') {
    throw new Error(`DIRECTOR_RUNTIME_VISUAL_PRIMITIVE_UNKNOWN:${inputGroup.visualPrimitive}`);
  }
  const inputFrame = requireStageFrame(scene, scene.mechanism.inputNodeId, fps);
  const actionFrame = requireStageFrame(scene, scene.mechanism.actionNodeId, fps);
  const outputFrames = scene.mechanism.outputNodeIds.map((id) => requireStageFrame(scene, id, fps));
  const supportFrame = groupEnterFrame(scene, supportGroup, fps);
  const pressProgress = interpolate(frame, [actionFrame - 12, actionFrame + 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const gearTurn = interpolate(pressProgress, [0, 1], [0, 185]);
  const conveyorProgress = Math.max(
    0,
    Math.min(DIRECTOR_ANIMATION_FRAMES.mechanicalAction, frame - actionFrame),
  );
  const inputNodes = groupNodes(scene, inputGroup.id);
  const outputNodes = groupNodes(scene, outputGroup.id);
  const supportNodes = nodeEntriesForGroup(scene, supportGroup.id, fps);
  const relationEdges = mechanicalRelationRenderEdges(scene, fps);
  const screenPlacement = scene.screenPlacements?.[0];
  const placementClips = screenPlacement
    ? screenPlacement.clipIds.map((clipId) => {
        const clip = clips.find((item) => item.id === clipId && item.placementId === screenPlacement.id);
        if (!clip) throw new Error(`DIRECTOR_RUNTIME_SCREEN_PLACEMENT_CLIP_MISSING:${clipId}`);
        return clip;
      })
    : [];

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Workbench label="单动作因果机器" />
      <SceneHeader scene={scene} index={sceneIndex} startFrame={inputFrame} />

      <PaperPiece x={92} y={226} width={1738} height={680} enterFrame={Math.max(0, inputFrame - 4)} color="#D9C79D" material="kraft" thickness={10} direction="press" rotate={0.35} tiltX={2.1} tiltY={1.2} zIndex={3} clip="b">
        <div style={{position: 'absolute', inset: 36, border: `5px solid ${colors.ink}`, opacity: 0.76}} />
        <PaperGrain strength={1.2} />
      </PaperPiece>

      <PaperPiece x={155} y={355} width={425} height={332} enterFrame={inputFrame} color={colors.paperLight} material="photo" thickness={7} direction="left" rotate={-2.1} zIndex={16}>
        <InkLabel size={29} style={{position: 'absolute', left: 30, right: 30, top: 27}}>
          {inputGroup.label}
        </InkLabel>
        <div style={{position: 'absolute', left: 30, right: 30, top: 92, bottom: 34, display: 'grid', gridTemplateColumns: inputNodes.length > 2 ? '1fr 1fr' : '1fr', alignContent: 'center', gap: 14}}>
          {inputNodes.map((node, index) => (
            <div key={index} style={{padding: '16px 18px', background: [colors.red, colors.yellow, colors.cyan, colors.blue, colors.kraft][index], color: index === 1 ? colors.ink : colors.paperLight, font: `900 22px/1.15 ${font}`, textAlign: 'center', transform: `rotate(${[-2, 1, -1, 2, 0][index]}deg)`, boxShadow: '4px 6px 0 rgba(20,39,45,.18)'}}>
              {node.label}
            </div>
          ))}
        </div>
      </PaperPiece>

      {relationEdges.map((edge, index) => (
        <Twine
          key={`${edge.from}->${edge.to}`}
          x1={edge.x1}
          y1={edge.y1}
          x2={edge.x2}
          y2={edge.y2}
          enterFrame={edge.enterFrame}
          color={[colors.red, colors.yellow, colors.cyan, colors.blue][index % 4]}
          width={11}
          zIndex={22 + index}
        />
      ))}
      <Conveyor x={530} y={642} width={830} enterFrame={inputFrame + 3} progress={conveyorProgress} />

      <PaperPiece x={690} y={308} width={445} height={450} enterFrame={Math.max(inputFrame + 5, actionFrame - 20)} color={colors.blue} material="blueprint" thickness={11} direction="rise" rotate={-0.4} zIndex={25} clip="b">
        <div style={{position: 'absolute', inset: 25, border: `5px solid ${colors.paperLight}`, opacity: 0.72}} />
        <div style={{position: 'absolute', left: 90, top: 72, width: 265, height: 265, borderRadius: '50%', background: '#20353B', boxShadow: 'inset 0 0 0 13px rgba(255,248,231,.28), 0 20px 0 rgba(7,18,22,.22)'}} />
        {actionGroup.visualPrimitive === 'locator-press' ? (
          <>
            <MachineGear x={123} y={104} size={205} turn={gearTurn} color={colors.yellow} zIndex={4} />
            <div style={{position: 'absolute', left: 197, top: 15, width: 42, height: 170, background: `linear-gradient(90deg,#6E4D1C,${colors.yellow},#6E4D1C)`, borderRadius: 20, transform: `translateY(${interpolate(pressProgress, [0, .58, 1], [-55, 62, 3])}px)`, boxShadow: '9px 12px 0 rgba(7,18,22,.25)'}} />
          </>
        ) : actionGroup.visualPrimitive === 'control-lever' ? (
          <>
            <div style={{position: 'absolute', left: 190, top: 95, width: 34, height: 210, background: `linear-gradient(90deg,#6E4D1C,${colors.yellow},#6E4D1C)`, borderRadius: 20, transformOrigin: '50% 88%', transform: `rotate(${interpolate(pressProgress, [0, 1], [-42, 42])}deg)`, boxShadow: '10px 12px 0 rgba(7,18,22,.25)'}} />
            <div style={{position: 'absolute', left: 173, top: 55, width: 70, height: 70, borderRadius: '50%', background: colors.red, boxShadow: '8px 10px 0 rgba(7,18,22,.28)'}} />
            {[0, 1, 2].map((index) => <div key={index} style={{position: 'absolute', left: 95 + index * 92, top: 245, width: 6, height: 85, background: index === 1 ? colors.yellow : colors.paperLight, opacity: interpolate(pressProgress, [0, 1], [.4, 1])}} />)}
          </>
        ) : (() => { throw new Error(`DIRECTOR_RUNTIME_VISUAL_PRIMITIVE_UNKNOWN:${actionGroup.visualPrimitive}`); })()}
        <InkLabel color={colors.paperLight} size={28} align="center" style={{position: 'absolute', left: 30, right: 30, bottom: 30}}>
          {actionGroup.label}
        </InkLabel>
      </PaperPiece>
      <PaperPin x={912} y={527} enterFrame={actionFrame} color={colors.red} size={54} zIndex={50} />

      {outputGroup.visualPrimitive === 'screen-proof-strip' ? (
        screenPlacement && placementClips.length > 0 ? (
          <Sequence
            from={secondsToFrames(screenPlacement.visibleFrom - scene.start, fps)}
            durationInFrames={secondsToFrames(screenPlacement.visibleTo - screenPlacement.visibleFrom, fps)}
            premountFor={17}
          >
            <PaperPiece x={1202} y={280} width={555} height={560} enterFrame={-17} color={colors.paperLight} material="photo" thickness={10} direction="right" rotate={1.2} tiltY={-2} zIndex={28} clip="b">
              {placementClips.map((clip) => (
                <PaperScreen
                  key={clip.id}
                  clip={clip}
                  fromFrame={clip.outputInFrame - secondsToFrames(screenPlacement.visibleFrom, fps)}
                  label={clip.semanticClaim || outputGroup.label}
                />
              ))}
            </PaperPiece>
          </Sequence>
        ) : (() => { throw new Error('DIRECTOR_RUNTIME_SCREEN_PLACEMENT_REQUIRED'); })()
      ) : outputGroup.visualPrimitive === 'decision-stamp' ? (
        <PaperPiece x={1202} y={280} width={555} height={560} enterFrame={Math.max(actionFrame + 4, outputFrames[0] - 8)} color={colors.paperLight} material="photo" thickness={10} direction="right" rotate={1.2} tiltY={-2} zIndex={28} clip="b">
          <div style={{position: 'absolute', inset: 24, display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: 24}}>
            {outputNodes.map((node, index) => {
              const p = interpolate(frame, [outputFrames[index] - 8, outputFrames[index] + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.4))});
              return <div key={node.id} style={{width: 126, height: 126, borderRadius: '50%', border: `12px double ${colors.red}`, display: 'grid', placeItems: 'center', color: colors.red, font: `950 27px/1 ${font}`, transform: `translateY(${interpolate(p, [0, 1], [-90, 0])}px) scale(${p}) rotate(${index * 7 - 7}deg)`, opacity: p, boxShadow: '8px 11px 0 rgba(20,39,45,.2)'}}>{node.label}</div>;
            })}
            <InkLabel size={27} align="center" style={{width: '100%', marginTop: 8}}>{outputGroup.label}</InkLabel>
          </div>
        </PaperPiece>
      ) : (() => { throw new Error(`DIRECTOR_RUNTIME_VISUAL_PRIMITIVE_UNKNOWN:${outputGroup.visualPrimitive}`); })()}

      <PaperPiece x={610} y={748} width={700} height={110} enterFrame={supportFrame} color="#BA945C" material="kraft" thickness={8} direction="press" rotate={-0.4} zIndex={58}>
        <SupportPrimitive primitive={supportGroup.visualPrimitive} label={supportGroup.label} nodes={supportNodes} />
      </PaperPiece>

    </AbsoluteFill>
  );
};

const PhotographicStateRevealScene: React.FC<{
  scene: DirectorScene;
  plan: DirectorPlan;
  forceNeutralLocalMotion?: boolean;
}> = ({scene, plan, forceNeutralLocalMotion = false}) => {
  const localFrame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const globalFrame = secondsToFrames(scene.start, fps) + localFrame;
  const state = occludedStateFrameState(scene, globalFrame, fps);
  const assets = plan.media?.visualStateAssets ?? [];
  const progressiveLocalAssembly =
    scene.stateReveal?.method === 'progressive-local-assembly';
  const progressiveFrameState = progressiveLocalAssembly
    ? authoredLocalStopMotionFrameState(scene, globalFrame, fps, forceNeutralLocalMotion)
    : null;
  const stateAssetId = progressiveFrameState?.stateAssetId ?? state.stateAssetId;
  const stateAsset = assets.find((asset) => asset.id === stateAssetId);
  const occluderAsset = scene.stateReveal?.method === 'fully-occluded-hard-cut'
    ? assets.find((asset) => asset.id === scene.stateReveal.occluderAssetId)
    : undefined;
  if (!stateAsset) throw new Error(`DIRECTOR_RUNTIME_STATE_ASSET_MISSING:${scene.id}:${stateAssetId}`);
  if (!progressiveLocalAssembly && !occluderAsset) {
    throw new Error(`DIRECTOR_RUNTIME_OCCLUDER_ASSET_MISSING:${scene.id}`);
  }

  if (progressiveLocalAssembly) {
    if (!progressiveFrameState) {
      throw new Error(`DIRECTOR_RUNTIME_PROGRESSIVE_FRAME_STATE_MISSING:${scene.id}`);
    }
    if (progressiveFrameState.phase === 'neutral') {
      return (
        <AbsoluteFill style={{overflow: 'hidden', background: '#d9cdb8'}}>
          <Img
            src={staticFile(stateAsset.staticFileName)}
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
        </AbsoluteFill>
      );
    }
    const baseStateAsset = assets.find(
      (asset) => asset.id === progressiveFrameState.baseStateAssetId,
    );
    const poseAsset = assets.find(
      (asset) => asset.id === progressiveFrameState.poseAssetId,
    );
    if (!baseStateAsset) {
      throw new Error(`DIRECTOR_RUNTIME_BASE_STATE_ASSET_MISSING:${scene.id}:${progressiveFrameState.baseStateAssetId}`);
    }
    if (!poseAsset || poseAsset.role !== 'motion-pose') {
      throw new Error(`DIRECTOR_RUNTIME_MOTION_POSE_ASSET_MISSING:${scene.id}:${String(progressiveFrameState.poseAssetId)}`);
    }
    if (!progressiveFrameState.region || progressiveFrameState.poseIndex === null) {
      throw new Error(`DIRECTOR_RUNTIME_AUTHORED_LOCAL_STOP_MOTION_STATE_INVALID:${scene.id}:${progressiveFrameState.stateId}`);
    }
    const {region} = progressiveFrameState;
    return (
      <AbsoluteFill style={{overflow: 'hidden', background: '#d9cdb8'}}>
        <Img
          src={staticFile(baseStateAsset.staticFileName)}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
        <div
          style={{
            position: 'absolute',
            left: region.x,
            top: region.y,
            width: region.width,
            height: region.height,
            zIndex: 120,
            pointerEvents: 'none',
          }}
        >
          <Img
            src={staticFile(poseAsset.staticFileName)}
            style={{width: '100%', height: '100%', objectFit: 'contain'}}
          />
        </div>
      </AbsoluteFill>
    );
  }

  const camera = photographicStopMotionCamera(localFrame, fps);
  let occluderX = 1920;
  if (state.transition) {
    const transition = state.transition;
    if (state.phase === 'closing') {
      occluderX = interpolate(
        globalFrame,
        [transition.closeStartFrame, transition.fullyOccludedFromFrame],
        [1920, 0],
        {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)},
      );
    } else if (state.phase === 'occluded') {
      occluderX = 0;
    } else if (state.phase === 'opening') {
      occluderX = interpolate(
        globalFrame,
        [transition.firstRevealFrame, transition.revealCompleteFrame],
        [0, -1920],
        {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)},
      );
    }
  }
  const stopMotionX = Math.round(occluderX / 120) * 120;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#d9cdb8'}}>
      <Img
        src={staticFile(stateAsset.staticFileName)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate3d(${camera.translateX}px, ${camera.translateY}px, 0) scale(${camera.scale})`,
          transformOrigin: '52% 48%',
        }}
      />
      {state.transition ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translateX(${stopMotionX}px)`,
            filter: 'drop-shadow(-24px 14px 18px rgba(55,39,24,.34))',
            zIndex: 180,
          }}
        >
          <Img
            src={staticFile(occluderAsset!.staticFileName)}
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const CaptionTrack: React.FC<{captions: DirectorCaption[]}> = ({captions}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  const cue = captions.find((item) => time >= item.start && time < item.end);
  if (!cue) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 190,
        right: 190,
        bottom: 42,
        zIndex: 300,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          padding: '8px 18px 10px',
          color: '#FFFDF6',
          background: 'transparent',
          WebkitTextStroke: '1.4px rgba(18,24,24,.96)',
          textShadow: '0 3px 0 rgba(18,24,24,.98), 0 6px 12px rgba(0,0,0,.55)',
          fontFamily: font,
          fontSize: 36,
          lineHeight: 1.25,
          fontWeight: 850,
          letterSpacing: 0.6,
          textAlign: 'center',
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};

const SoundTrack: React.FC<{plan: DirectorPlan; withSfx: boolean}> = ({plan, withSfx}) => {
  const {fps} = useVideoConfig();
  const spoken = plan.media?.spoken;
  const sfxCues = expandSfxCues(plan.media?.sfx ?? [], fps);
  return (
    <>
      {spoken ? (
        <Audio
          src={staticFile(spoken.staticFileName)}
          trimBefore={Math.round(spoken.sourceIn * fps)}
          trimAfter={Math.round(spoken.sourceOut * fps)}
          volume={spoken.volume ?? 1}
        />
      ) : null}
      {withSfx
        ? sfxCues.map((cue) => (
            <Sequence key={cue.key} from={cue.frame}>
              <Audio src={staticFile(cue.staticFileName)} volume={cue.volume} />
            </Sequence>
          ))
        : null}
    </>
  );
};

export const DirectorComposition: React.FC<{
  plan: DirectorPlan;
  withSfx?: boolean;
  forceNeutralLocalMotion?: boolean;
}> = ({plan, withSfx = false, forceNeutralLocalMotion = false}) => {
  const resolvedPlan = plan;
  return (
    <AbsoluteFill style={{background: colors.desk}}>
      {resolvedPlan.scenes.map((scene, index) => {
        const from = secondsToFrames(scene.start, resolvedPlan.render.fps);
        const duration = Math.max(
          1,
          secondsToFrames(scene.end, resolvedPlan.render.fps) - from,
        );
        let content: React.ReactNode;
        if (scene.stateReveal) {
          content = (
            <PhotographicStateRevealScene
              scene={scene}
              plan={resolvedPlan}
              forceNeutralLocalMotion={forceNeutralLocalMotion}
            />
          );
        } else if (scene.type === 'complex-explanation') {
          content = <ComplexExplanationScene scene={scene} sceneIndex={index} />;
        } else if (scene.type === 'mechanical-causality') {
          content = (
            <MechanicalCausalityScene
              scene={scene}
              sceneIndex={index}
              clips={resolvedPlan.media?.screenClips ?? []}
            />
          );
        } else if (scene.type === 'occluded-state-reveal') {
          throw new Error(`DIRECTOR_RUNTIME_STATE_REVEAL_REQUIRED:${scene.id}`);
        } else {
          throw new Error(`DIRECTOR_RUNTIME_SCENE_TYPE_UNKNOWN:${String(scene.type)}`);
        }
        return (
          <Sequence key={scene.id} from={from} durationInFrames={duration} premountFor={15}>
            {content}
          </Sequence>
        );
      })}
      <CaptionTrack captions={resolvedPlan.captions ?? []} />
      <SoundTrack plan={resolvedPlan} withSfx={withSfx} />
    </AbsoluteFill>
  );
};
