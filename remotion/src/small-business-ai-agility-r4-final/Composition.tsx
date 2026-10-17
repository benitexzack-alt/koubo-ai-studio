import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {SmallBusinessAiAgility} from '../small-business-ai-agility-20261017/Composition';
import {SemanticRelationSample} from '../small-business-ai-agility-r3-sample/Composition';
import {easeOut, progress} from '../small-business-ai-agility-20261017/runtime';
import type {EpisodeProps} from '../small-business-ai-agility-20261017/types';
import cues from './full-cues.v1.json';

type WordNode = {id: string; text: string; at: number; settle: number; until?: number; x: number; y: number;
  width: number; height: number; fontSize: number; accent: boolean; duration: number};
type RelationLine = {id: string; at: number; settle: number; points: number[][]; duration: number};
type Scene = {id: string; fromFrame: number; toFrame: number; source: string; nodes: WordNode[]; lines: RelationLine[]; note: string};
const scenes = cues.scenes as Scene[];
const FONT = '"SmallBusinessAgility20261017-Display", "PingFang SC", sans-serif';
const WHITE = '#fffdf8';
const ACCENT = '#e1b96d';

/** 字卡固定行列，所有替换均先退净再入；不复用已发生遮字的斜向穿越。 */
export const FullSemanticLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = scenes.find((item) => frame >= item.fromFrame && frame < item.toFrame);
  if (!scene) return null;
  const sceneFade = 1 - progress(frame, scene.toFrame - 8, 8);
  return <AbsoluteFill data-r4-scene={scene.id} style={{zIndex: 50, pointerEvents: 'none',
    fontFamily: FONT, opacity: sceneFade}}>
    {scene.lines.map((line) => {
      const p = easeOut(progress(frame, line.at, line.duration));
      return <svg key={line.id} width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: p}}>
        <polyline points={line.points.map((point) => point.join(',')).join(' ')} fill="none" stroke={ACCENT}
          strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" pathLength={1}
          strokeDasharray={1} strokeDashoffset={1 - p} />
      </svg>;
    })}
    {scene.nodes.map((node) => {
      const p = easeOut(progress(frame, node.at, node.duration));
      const leave = node.until === undefined ? 1 : 1 - progress(frame, node.until - 8, 8);
      if (p === 0 || leave === 0) return null;
      return <div key={node.id} data-r4-node={node.id} style={{position: 'absolute', left: node.x,
        top: node.y + (1 - p) * 10, width: node.width, height: node.height, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', padding: '0 18px', borderRadius: 8,
        color: node.accent ? ACCENT : WHITE, background: 'rgba(20,39,47,.72)',
        fontSize: node.fontSize, lineHeight: 1.08, whiteSpace: 'nowrap',
        opacity: p * leave}}>{node.text}</div>;
    })}
  </AbsoluteFill>;
};

export const SmallBusinessAgilityR4Final: React.FC<EpisodeProps> = ({plan, withSfx, mode}) => {
  if (mode !== 'preview') throw new Error('本期完整有声候选须经本条观看验收，不能自行登记为正式通过');
  if (plan.overlays.length !== 0) throw new Error('R4独立信息层要求旧信息层清空，防止两套字卡重叠');
  return <AbsoluteFill>
    <SmallBusinessAiAgility plan={plan} withSfx={withSfx} mode="preview" />
    <SemanticRelationSample />
    <FullSemanticLayer />
  </AbsoluteFill>;
};
