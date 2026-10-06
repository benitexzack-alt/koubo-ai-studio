import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Img, Sequence, staticFile} from 'remotion';
import {AdditiveEquation, BurstStatement, ChapterStamp, OpposingLabels, PipelinePackage, SequentialList} from './effects';
import {EFFECT_KINDS, EFFECT_NAMES, PAPER_ORANGE as C, PRESENTER_PROTECTION, SEGMENT_FRAMES, SOUND_CUES, SUBTITLE_PROTECTION, TYPE, type EffectKind} from './plan';
import {soundEnvelope} from './motion';

export const CandidateEffect: React.FC<{kind: EffectKind}> = ({kind}) => {
  switch (kind) {
    case 'burst': return <BurstStatement />;
    case 'chapter': return <ChapterStamp chapterIndex={5} />;
    case 'list': return <SequentialList />;
    case 'opposing': return <OpposingLabels />;
    case 'pipeline': return <PipelinePackage />;
    case 'equation': return <AdditiveEquation />;
  }
};

export const CandidateSounds: React.FC<{kind: EffectKind}> = ({kind}) => <>
  {SOUND_CUES[kind].map((cue, index) => <Sequence key={`${kind}-${index}`} from={cue.at} durationInFrames={cue.duration} layout="none">
    <Audio src={staticFile(cue.source)} trimAfter={cue.duration}
      volume={(frame) => cue.gain * soundEnvelope(frame, cue.duration)} />
  </Sequence>)}
</>;

/** 本期真实静帧仅用于布局，绝不是与口播同步的成片。 */
export const CandidateDemo: React.FC<{withSfx: boolean; layoutReference: boolean; showProtectionGuides: boolean}> =
({withSfx, layoutReference, showProtectionGuides}) => <AbsoluteFill translate="no" className="notranslate" style={{
  backgroundColor: C.canvas, color: C.text, fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
}}>
  {layoutReference ? <>
    <Img src={staticFile('motion-upgrade-r1/presenter-layout-reference.png')} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    <div style={{position: 'absolute', left: 48, top: 86, width: 792, height: 698, borderRadius: 12,
      backgroundColor: 'rgba(255,252,246,0.95)'}} />
  </> : null}
  <div style={{position: 'absolute', left: 64, top: 24, fontSize: TYPE.label, color: C.text,
    padding: '5px 12px', backgroundColor: C.surface}}>
    {layoutReference ? '本期静帧布局试验 · 非实录同步' : '保护区导读 · 非本期剪辑'} · {withSfx ? '有动作音效' : '同画面无音效'}
  </div>
  {showProtectionGuides ? <div style={{position: 'absolute', ...PRESENTER_PROTECTION, border: `2px dashed ${C.rule}`,
    display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 22}}>
    <div style={{fontSize: TYPE.body}}>真人保护区</div>
    <div style={{fontSize: TYPE.label, color: C.muted}}>实际同步原片尚未绑定</div>
  </div> : null}
  {showProtectionGuides ? <div style={{position: 'absolute', ...SUBTITLE_PROTECTION, borderTop: `2px dashed ${C.rule}`,
    display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: TYPE.label, color: C.muted}}>
    字幕保护区 · 实录字幕未绑定
  </div> : null}
  {EFFECT_KINDS.map((kind, index) => <Sequence key={kind} from={index * SEGMENT_FRAMES} durationInFrames={SEGMENT_FRAMES}>
    <CandidateEffect kind={kind} />
    {withSfx ? <CandidateSounds kind={kind} /> : null}
    <div style={{position: 'absolute', left: 64, top: 800, fontSize: TYPE.label, color: C.text,
      backgroundColor: C.surface, padding: '5px 12px'}}>
      {index + 1} / {EFFECT_KINDS.length} · {EFFECT_NAMES[kind]} · 纸艺镜头不叠加本效果
    </div>
  </Sequence>)}
</AbsoluteFill>;
