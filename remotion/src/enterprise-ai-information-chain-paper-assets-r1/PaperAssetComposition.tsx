import React from 'react';
import {AbsoluteFill} from 'remotion';
import manifestJson from '../../../edit/20260826_enterprise_ai_information_chain/04_Remotion规划/paper-assets-r1/plan/paper-assets-manifest.v1.json';
import {DirectorComposition} from './vendor-paper-editorial/DirectorComposition';
import {
  DirectorNode,
  DirectorObjectGroup,
  DirectorPlan,
  DirectorScene,
  PAPER_EDITORIAL,
} from './vendor-paper-editorial/style';

const FPS = 30;
const SFX_BASE = 'paper-assets/enterprise-ai-information-chain-r1';
const {colors, font} = PAPER_EDITORIAL;

type ComplexGroup = {
  label: string;
  primitive: string;
  nodes: string[];
};

type MechanicalPart = {
  label: string;
  nodes?: string[];
  primitive?: 'locator-press' | 'control-lever';
  role?: 'evidence-output' | 'human-decision-output';
};

type ComplexShot = {
  id: string;
  kind: 'complex';
  durationSeconds: number;
  title: string;
  sourceLine: string;
  groups: ComplexGroup[];
};

type MechanicalShot = {
  id: string;
  kind: 'mechanical';
  durationSeconds: number;
  title: string;
  sourceLine: string;
  input: MechanicalPart;
  action: MechanicalPart & {primitive: 'locator-press' | 'control-lever'};
  output: MechanicalPart & {role: 'evidence-output' | 'human-decision-output'};
  support: MechanicalPart;
};

export type PaperShot = ComplexShot | MechanicalShot;

type PaperAssetManifest = {
  revisionId: string;
  shots: PaperShot[];
};

const manifest = manifestJson as PaperAssetManifest;

export const PAPER_ASSET_SHOTS = manifest.shots;

const cueTrack = (stageTimes: number[]) => {
  const reveal = stageTimes.filter((_, index) => index % 4 === 1);
  const connect = stageTimes.filter((_, index) => index % 4 === 2);
  const tick = stageTimes.filter((_, index) => index % 4 === 3);
  return [
    {
      id: 'page-turn',
      path: `${SFX_BASE}/sfx-page-turn-712036de.wav`,
      staticFileName: `${SFX_BASE}/sfx-page-turn-712036de.wav`,
      sha256: '712036deb5343f319090be4e4b28362b6d4ff028fb0ff2758fd1a4384c31ec20',
      cues: [{id: 'page-open', atSeconds: 0.02, volume: 0.16}],
    },
    {
      id: 'card-reveal',
      path: `${SFX_BASE}/sfx-card-reveal-ee2cd1a4.wav`,
      staticFileName: `${SFX_BASE}/sfx-card-reveal-ee2cd1a4.wav`,
      sha256: 'ee2cd1a4d78d60a4d81391d0ea3a1873f02fc907d61667b8897df9f56f4ff896',
      cues: reveal.map((atSeconds, index) => ({
        id: `card-${index + 1}`,
        atSeconds,
        volume: 0.13,
      })),
    },
    {
      id: 'node-connect',
      path: `${SFX_BASE}/sfx-node-connect-9432d376.wav`,
      staticFileName: `${SFX_BASE}/sfx-node-connect-9432d376.wav`,
      sha256: '9432d37654181c4e4627c3c466271895d28f7dde650c3c9cd307eb77fb283fdc',
      cues: connect.map((atSeconds, index) => ({
        id: `connect-${index + 1}`,
        atSeconds,
        volume: 0.11,
      })),
    },
    {
      id: 'keyword-tick',
      path: `${SFX_BASE}/sfx-keyword-tick-1ed414d9.wav`,
      staticFileName: `${SFX_BASE}/sfx-keyword-tick-1ed414d9.wav`,
      sha256: '1ed414d9a26793d3bab087f6226f83a4e0566fac05a14552aebc43d0ac7cdff5',
      cues: tick.map((atSeconds, index) => ({
        id: `tick-${index + 1}`,
        atSeconds,
        volume: 0.1,
      })),
    },
  ];
};

const buildComplexScene = (shot: ComplexShot): DirectorScene => {
  const roles = [
    'context-input',
    'source-channel',
    'source-channel',
    'source-channel',
    'source-channel',
    'result-convergence',
  ] as const;
  const groupTimes = [
    0.12,
    Math.max(1.05, shot.durationSeconds * 0.14),
    shot.durationSeconds * 0.29,
    shot.durationSeconds * 0.44,
    shot.durationSeconds * 0.59,
    shot.durationSeconds - 1.7,
  ];
  const objectGroups: DirectorObjectGroup[] = shot.groups.map((group, groupIndex) => {
    const id = `${shot.id}-g${groupIndex + 1}`;
    return {
      id,
      label: group.label,
      visualPrimitive: group.primitive,
      visualRole: roles[groupIndex],
      material: groupIndex === 5 ? 'blueprint' : 'uncoated',
      nodeIds: group.nodes.map((_, nodeIndex) => `${id}-n${nodeIndex + 1}`),
    };
  });
  const nodes: DirectorNode[] = objectGroups.flatMap((group, groupIndex) =>
    shot.groups[groupIndex].nodes.map((label, nodeIndex) => ({
      id: group.nodeIds![nodeIndex],
      label,
      role: groupIndex === 5 ? 'result' : groupIndex === 0 ? 'input' : 'evidence',
      visualRole: group.visualRole,
      groupId: group.id,
    })),
  );
  const assemblyStages = objectGroups.flatMap((group, groupIndex) => {
    const base = groupTimes[groupIndex];
    return [
      {
        id: `${shot.id}-s${groupIndex + 1}-paper`,
        atSeconds: base,
        action: groupIndex === 5 ? '汇合并锁定结果' : '放置纸张物件',
        targetIds: [group.id],
      },
      ...group.nodeIds!.map((nodeId, nodeIndex) => ({
        id: `${shot.id}-s${groupIndex + 1}-n${nodeIndex + 1}`,
        atSeconds: Math.min(shot.durationSeconds - 1.12, base + 0.18 + nodeIndex * 0.24),
        action: '显现节点文字',
        targetIds: [nodeId],
      })),
    ];
  });
  const relations = [
    ...objectGroups.slice(1, 5).map((group) => ({from: objectGroups[0].id, to: group.id})),
    ...objectGroups.slice(1, 5).map((group) => ({from: group.id, to: objectGroups[5].id})),
  ];
  const durationInFrames = Math.round(shot.durationSeconds * FPS);
  const completionFrame = durationInFrames - 31;
  return {
    id: `${shot.id}-complex`,
    type: 'complex-explanation',
    start: 0,
    end: shot.durationSeconds,
    spokenLine: shot.sourceLine,
    cognitiveIncrement: shot.title,
    camera: 'oblique-top-down',
    layers: 4,
    objectGroups,
    nodes,
    assemblyStages,
    relations,
    completion: {
      model: 'paper-editorial-animation-completion/v1',
      requiredStageIds: assemblyStages.map((stage) => stage.id),
      actualCompletionFrame: completionFrame,
      lockEndExclusiveFrame: durationInFrames,
      availableSettledFrames: durationInFrames - completionFrame,
      minimumLockFrames: 30,
      criticalContributorIds: [objectGroups[5].id],
    },
  };
};

const buildMechanicalScene = (shot: MechanicalShot): DirectorScene => {
  const ids = {
    inputGroup: `${shot.id}-input`,
    actionGroup: `${shot.id}-action`,
    outputGroup: `${shot.id}-output`,
    supportGroup: `${shot.id}-support`,
  };
  const inputNodeIds = shot.input.nodes!.map((_, index) => `${ids.inputGroup}-n${index + 1}`);
  const actionNodeId = `${ids.actionGroup}-n1`;
  const outputNodeIds = shot.output.nodes!.map((_, index) => `${ids.outputGroup}-n${index + 1}`);
  const supportNodeIds = shot.support.nodes!.map((_, index) => `${ids.supportGroup}-n${index + 1}`);
  const objectGroups: DirectorObjectGroup[] = [
    {
      id: ids.inputGroup,
      label: shot.input.label,
      visualPrimitive: 'answer-tickets',
      visualRole: 'causal-input',
      nodeIds: inputNodeIds,
    },
    {
      id: ids.actionGroup,
      label: shot.action.label,
      visualPrimitive: shot.action.primitive,
      visualRole: 'single-causal-action',
      nodeIds: [actionNodeId],
    },
    {
      id: ids.outputGroup,
      label: shot.output.label,
      visualPrimitive: 'decision-stamp',
      visualRole: shot.output.role,
      nodeIds: outputNodeIds,
    },
    {
      id: ids.supportGroup,
      label: shot.support.label,
      visualPrimitive: 'responsibility-base',
      visualRole: 'causal-support',
      nodeIds: supportNodeIds,
    },
  ];
  const nodes: DirectorNode[] = [
    ...shot.input.nodes!.map((label, index) => ({
      id: inputNodeIds[index],
      label,
      role: 'input',
      visualRole: 'causal-input',
      groupId: ids.inputGroup,
    })),
    {
      id: actionNodeId,
      label: shot.action.label,
      role: 'mechanism',
      visualRole: 'single-causal-action',
      groupId: ids.actionGroup,
    },
    ...shot.output.nodes!.map((label, index) => ({
      id: outputNodeIds[index],
      label,
      role: 'outcome',
      visualRole: shot.output.role,
      groupId: ids.outputGroup,
    })),
    ...shot.support.nodes!.map((label, index) => ({
      id: supportNodeIds[index],
      label,
      role: 'constraint',
      visualRole: 'causal-support',
      groupId: ids.supportGroup,
    })),
  ];
  const inputAt = 0.12;
  const actionAt = shot.durationSeconds * 0.34;
  const outputAt = shot.durationSeconds * 0.56;
  const supportAt = shot.durationSeconds - 1.75;
  const assemblyStages = [
    {
      id: `${shot.id}-input-paper`,
      atSeconds: inputAt,
      action: '输入信息进入工作台',
      targetIds: [ids.inputGroup],
    },
    ...inputNodeIds.map((nodeId, index) => ({
      id: `${shot.id}-input-node-${index + 1}`,
      atSeconds: inputAt + 0.28 + index * 0.28,
      action: '显现输入节点',
      targetIds: [nodeId],
    })),
    {
      id: `${shot.id}-action`,
      atSeconds: actionAt,
      action: '执行唯一因果动作',
      targetIds: [ids.actionGroup, actionNodeId],
    },
    {
      id: `${shot.id}-output-paper`,
      atSeconds: outputAt - 0.25,
      action: '展开结果承载纸',
      targetIds: [ids.outputGroup],
    },
    ...outputNodeIds.map((nodeId, index) => ({
      id: `${shot.id}-output-node-${index + 1}`,
      atSeconds: outputAt + index * 0.48,
      action: '压印结果节点',
      targetIds: [nodeId],
    })),
    {
      id: `${shot.id}-support-paper`,
      atSeconds: supportAt,
      action: '放置责任与反馈底座',
      targetIds: [ids.supportGroup],
    },
    ...supportNodeIds.map((nodeId, index) => ({
      id: `${shot.id}-support-node-${index + 1}`,
      atSeconds: Math.min(shot.durationSeconds - 1.12, supportAt + 0.18 + index * 0.22),
      action: '显现责任节点',
      targetIds: [nodeId],
    })),
  ];
  const relations = [
    {from: inputNodeIds[0], to: actionNodeId},
    ...outputNodeIds.map((nodeId) => ({from: actionNodeId, to: nodeId})),
    {from: ids.outputGroup, to: ids.supportGroup},
  ];
  const durationInFrames = Math.round(shot.durationSeconds * FPS);
  const completionFrame = durationInFrames - 31;
  return {
    id: `${shot.id}-mechanical`,
    type: 'mechanical-causality',
    start: 0,
    end: shot.durationSeconds,
    spokenLine: shot.sourceLine,
    cognitiveIncrement: shot.title,
    camera: 'macro-oblique-paper-machine',
    layers: 4,
    objectGroups,
    nodes,
    assemblyStages,
    relations,
    mechanism: {
      inputNodeId: inputNodeIds[0],
      actionNodeId,
      outputNodeIds,
    },
    completion: {
      model: 'paper-editorial-animation-completion/v1',
      requiredStageIds: assemblyStages.map((stage) => stage.id),
      actualCompletionFrame: completionFrame,
      lockEndExclusiveFrame: durationInFrames,
      availableSettledFrames: durationInFrames - completionFrame,
      minimumLockFrames: 30,
      criticalContributorIds: [ids.supportGroup],
    },
  };
};

export const buildPaperAssetPlan = (shot: PaperShot): DirectorPlan => {
  const scene = shot.kind === 'complex' ? buildComplexScene(shot) : buildMechanicalScene(shot);
  const stageTimes = (scene.assemblyStages ?? [])
    .filter((stage) => stage.action !== '显现节点文字' && stage.action !== '显现输入节点')
    .map((stage) => stage.atSeconds);
  return {
    schemaVersion: 'koubo-director-output/v1-task-isolated-material',
    project: {
      id: manifest.revisionId,
      title: shot.title,
    },
    title: shot.title,
    executionMode: 'plan-only',
    render: {
      width: 1920,
      height: 1080,
      fps: FPS,
      durationSeconds: shot.durationSeconds,
      durationInFrames: Math.round(shot.durationSeconds * FPS),
      publicDir: 'remotion/public',
    },
    media: {
      sfx: cueTrack(stageTimes),
    },
    captions: [],
    scenes: [scene],
  };
};

export type PaperAssetCompositionProps = {
  shotId: string;
  withSfx: boolean;
};

export const PaperAssetComposition: React.FC<PaperAssetCompositionProps> = ({
  shotId,
  withSfx,
}) => {
  const shot = PAPER_ASSET_SHOTS.find((item) => item.id === shotId);
  if (!shot) throw new Error(`PAPER_ASSET_SHOT_NOT_FOUND:${shotId}`);
  const plan = buildPaperAssetPlan(shot);
  return (
    <AbsoluteFill style={{background: colors.desk, fontFamily: font}}>
      <DirectorComposition plan={plan} withSfx={withSfx} />
      <div
        style={{
          position: 'absolute',
          right: 82,
          top: 88,
          zIndex: 420,
          padding: '12px 22px',
          color: colors.paperLight,
          background: colors.ink,
          border: `3px solid ${colors.yellow}`,
          boxShadow: '7px 9px 0 rgba(20,39,45,.22)',
          fontSize: 22,
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: 0,
          transform: 'rotate(.7deg)',
        }}
      >
        流程示意
      </div>
    </AbsoluteFill>
  );
};
