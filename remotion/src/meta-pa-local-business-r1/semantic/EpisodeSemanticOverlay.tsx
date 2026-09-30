import React from 'react';
import {AbsoluteFill, Sequence, staticFile, Img, useCurrentFrame, interpolate} from 'remotion';
import {
  V8DirectStatement,
  V8ProcessRail,
  type V8SemanticLayer,
} from '../../employee-ai-efficiency-v8-r2/V8SemanticStage.r2';
import {
  MarkerUnderline,
  KeywordReveal,
  EvidenceScan,
  LineCarry,
  PaperTapePin,
} from '../runtime/ShotcraftEffects';
import candidatePlan from './semantic-plan.r1.json';

type SemanticLayer = V8SemanticLayer & {
  beatId: string;
  layout: {componentTranslation: {x: number; y: number}};
};

export type EpisodeShotcraftBeat = {
  beatId: string;
  decision: string;
  effectId?: string;
  frames: {startFrame: number; endFrameExclusive: number};
  region?: {x: number; y: number; width: number; height: number};
  componentProps?: Record<string, unknown>;
  evidence?: {asset?: {path: string}};
};

const layers = candidatePlan.layers as SemanticLayer[];

const SemanticObject: React.FC<{layer: SemanticLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const duration = Math.round(layer.end * 30) - Math.round(layer.start * 30);
  const opacity = interpolate(frame, [Math.max(0, duration-9), duration-1], [1,0], {extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const Component = layer.params.component === 'process' ? V8ProcessRail : V8DirectStatement;
  const shift = layer.layout.componentTranslation;
  // 基准组件内部已按 0.8 缩放：标题 48，条目 35.2 像素。这里不再二次缩字。
  return <AbsoluteFill style={{opacity,transform: `translate(${shift.x}px,${shift.y}px)`, pointerEvents: 'none'}}>
    <Component layer={layer}/>
  </AbsoluteFill>;
};

const ShotcraftObject: React.FC<{beat: EpisodeShotcraftBeat}> = ({beat}) => {
  const frame = useCurrentFrame();
  if (!beat.region || !beat.componentProps || !beat.effectId) throw new Error(`本期已选动效缺字段：${beat.beatId}`);
  const durationInFrames = beat.frames.endFrameExclusive - beat.frames.startFrame;
  const opacity = interpolate(frame, [Math.max(0,durationInFrames-9),durationInFrames-1], [1,0], {extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const timing = {frame, fps: 30, durationInFrames};
  const p = beat.componentProps;
  const rect = beat.region;
  let object: React.ReactNode;
  if (beat.effectId === 'marker-underline') object = <MarkerUnderline {...timing} before={String(p.before ?? '')} keyword={String(p.keyword)} after={String(p.after ?? '')} fontSize={48}/>;
  else if (beat.effectId === 'keyword-reveal') object = <div className="meta-pa-keyword-list"><style>{`.meta-pa-keyword-list > div > div > div:first-child {font-size:48px;line-height:1.15;}`}</style><KeywordReveal {...timing} items={p.items as Array<{text: string; atFrame: number}>} fontSize={36}/></div>;
  else if (beat.effectId === 'line-carry') object = <LineCarry {...timing} fromLabel={String(p.fromLabel)} toLabel={String(p.toLabel)} width={Number(p.width ?? rect.width)}/>;
  else if (beat.effectId === 'evidence-scan') object = <EvidenceScan {...timing} width={Number(p.width)} height={Number(p.height)} rect={p.rect as {x: number; y: number; width: number; height: number}} label={String(p.label)}/>;
  else if (beat.effectId === 'paper-tape-pin') {
    const src = beat.evidence?.asset?.path;
    if (!src) throw new Error(`纸胶带不能假造真实图卡：${beat.beatId}`);
    object = <PaperTapePin {...timing} width={Number(p.width ?? rect.width)}><Img src={staticFile(src)} style={{width:'100%',height:'100%',objectFit:'contain'}}/></PaperTapePin>;
  } else throw new Error(`没有适配本期所选组件：${beat.effectId}`);
  return <div style={{position:'absolute',left:rect.x,top:rect.y,width:rect.width,height:rect.height,opacity,pointerEvents:'none'}}>{object}</div>;
};

/** 本条连续语义层。P/G 时间窗已在计划外，无全屏信息板、无素材变速或循环。 */
export const EpisodeSemanticOverlay: React.FC<{
  selection?: {beats: EpisodeShotcraftBeat[]};
  shotcraftEnabled?: boolean;
}> = ({selection, shotcraftEnabled = true}) => {
  const selected = shotcraftEnabled ? (selection?.beats ?? []).filter(b => b.decision === 'apply') : [];
  // 同一 eligible beat 如确有更匹配 Shotcraft，则只消费所选层，不把两层文字叠在一起。
  const selectedIds = new Set(selected.map(b => b.beatId));
  return <>
    {layers.filter(l => !selectedIds.has(l.beatId)).map(layer => {
      const start = Math.round(layer.start * 30), end = Math.round(layer.end * 30);
      return <Sequence key={layer.id} from={start} durationInFrames={end-start} premountFor={15}><SemanticObject layer={layer}/></Sequence>;
    })}
    {selected.map(beat => <Sequence key={`shotcraft-${beat.beatId}`} from={beat.frames.startFrame} durationInFrames={beat.frames.endFrameExclusive-beat.frames.startFrame} premountFor={15}><ShotcraftObject beat={beat}/></Sequence>)}
  </>;
};
