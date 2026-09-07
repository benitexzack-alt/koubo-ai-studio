import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {AdaptiveBilingualCaptionOverlay} from '../components/AdaptiveBilingualCaptionOverlay';
import {LocalFont} from '../components/LocalFont';
import {V8DirectStatement, V8QuestionList, type V8SemanticLayer} from '../components/V8SemanticStage';
import {MarkerUnderline, KeywordReveal, EvidenceScan} from './ShotcraftEffects.generated';
import data from '../../../edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r1/data.v1.json';
import visual from './visual-plan.v1.json';

const fps = 30;
const total = 8393;
const insertion = 244;
const split = 69;
const full: React.CSSProperties = {width: '100%', height: '100%', objectFit: 'contain'};
const fontFamily = '"Koubo Heiti", "PingFang SC", sans-serif';
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

function HostVideo({sourceFrame = 0, inset = false}: {sourceFrame?: number; inset?: boolean}) {
  return <OffthreadVideo src={staticFile('R01.mp4')} startFrom={sourceFrame} muted
    style={inset ? {width: '100%', height: '100%', objectFit: 'cover', objectPosition: '65% 38%'} : full} />;
}

function News() {
  const frame = useCurrentFrame();
  const detailOpacity = interpolate(frame, [6, 14], [0, 1], clamp);
  return <AbsoluteFill style={{background: '#030608'}}>
    <div style={{position: 'absolute', left: 64, top: 60, width: 540, height: 960}}>
      <OffthreadVideo src={staticFile('U01.mp4')} muted style={full} />
    </div>
    <div style={{position: 'absolute', left: 688, top: 344, width: 1056, height: 264, overflow: 'hidden', opacity: detailOpacity}}>
      <OffthreadVideo src={staticFile('U01.mp4')} muted style={{position: 'absolute', width: 1188, height: 2112, left: -66, top: -308}} />
    </div>
    <div style={{position: 'absolute', left: 688, top: 650, width: 1056, color: '#D0D8DF', fontSize: 27, lineHeight: 1.5}}>
      金融投资报新闻画面 · 9月4日消息<br/>《人工智能中小企业创业支持计划（2026—2028年）》
    </div>
  </AbsoluteFill>;
}

function OfficialEvidence({second, sourceStartFrame}: {second: boolean; sourceStartFrame: number}) {
  const local = useCurrentFrame();
  const enter = interpolate(local, [0, 12], [0.92, 1], clamp);
  return <AbsoluteFill style={{background: '#10181d'}}>
    <div style={{position: 'absolute', left: 84, top: 78, color: '#C6DDE5', fontSize: 25}}>工业和信息化部官网 · 工信厅科函〔2026〕414号</div>
    <div style={{position: 'absolute', left: 84, top: 112, color: '#8DABB7', fontSize: 22}}>2026年8月27日成文 · 8月31日发布</div>
    {second ? <div style={{position: 'absolute', left: 84, top: 330, width: 1056, height: 150, background: '#fff', display: 'flex', alignItems: 'center'}}>
      <Img src={staticFile('O01-onsite.png')} style={{width: 1056, height: 113.42}} />
    </div> : <div style={{position: 'absolute', left: 84, top: 330, width: 1056, height: 275, overflow: 'hidden', background: '#fff'}}>
      <Img src={staticFile('O01-title.png')} style={{position: 'absolute', width: 1390.83, height: 1043.12, left: -167.42, top: -286.54}} />
    </div>}
    <div style={{position: 'absolute', left: 84, top: 725, width: 1060, color: '#AFC2CC', fontSize: 24, lineHeight: 1.5}}>政策背景引用，不代表对本人或公司的官方认定或推荐。</div>
    <div style={{position: 'absolute', right: 360, bottom: 202, width: 278, height: 278, borderRadius: '50%', overflow: 'hidden', border: '2px solid #D8E4E9', opacity: interpolate(local,[0,12],[0,1],clamp), transform: `scale(${enter})`}}>
      <HostVideo sourceFrame={sourceStartFrame} inset />
    </div>
  </AbsoluteFill>;
}

function Semantic({scene}: {scene: typeof visual.semantic[number]}) {
  const layer: V8SemanticLayer = {id: scene.id, start: scene.from / fps, end: scene.to / fps,
    title: scene.title, detail: scene.detail, items: scene.items, params: {component: scene.component}};
  return scene.component === 'questions' ? <V8QuestionList layer={layer} /> : <V8DirectStatement layer={layer} />;
}

function Effect({effect}: {effect: typeof visual.effects[number]}) {
  const frame = useCurrentFrame();
  const timing = {frame, fps, durationInFrames: effect.to - effect.from};
  const props = effect.props as {before?: string; keyword?: string; after?: string; label?: string};
  return <div data-effect={effect.id} style={{position: 'absolute', left: effect.region.x, top: effect.region.y,
    width: effect.region.width, height: effect.region.height, overflow: effect.effectId === 'evidence-scan' ? 'hidden' : 'visible'}}>
    {effect.effectId === 'marker-underline' && <MarkerUnderline {...timing} before={props.before}
      keyword={props.keyword ?? effect.words[0]} after={props.after} fontSize={54} />}
    {effect.effectId === 'keyword-reveal' && <KeywordReveal {...timing} fontSize={46}
      items={effect.words.map((text, index) => ({text, atFrame: effect.wordFrames[index]}))} />}
    {effect.effectId === 'evidence-scan' && <EvidenceScan {...timing} width={effect.region.width}
      height={effect.region.height} rect={effect.rect} label={props.label ?? effect.words[0]} />}
  </div>;
}

export function LanzhouServicesCandidate() {
  const frame = useCurrentFrame();
  const news = frame >= split && frame < split + insertion;
  const paper = data.papers.find(p => frame >= p.outputStartFrame && frame < p.outputStartFrame + p.durationInFrames);
  const official = visual.official.find(o => frame >= o.from && frame < o.to);
  const sourceFrame = frame < split ? frame : frame - insertion;
  return <AbsoluteFill style={{background: '#090D10', fontFamily}}>
    <LocalFont />
    <Sequence from={0} durationInFrames={split}><Audio src={staticFile('R01.mp4')} endAt={split} volume={1} /></Sequence>
    <Sequence from={split} durationInFrames={insertion}><Audio src={staticFile('U01.mp4')} volume={0.62} /></Sequence>
    <Sequence from={split + insertion} durationInFrames={8149 - split}><Audio src={staticFile('R01.mp4')} startFrom={split} volume={1} /></Sequence>
    {!news && !paper && !official && <Sequence from={frame < split ? 0 : split + insertion} durationInFrames={frame < split ? split : 8149 - split}>
      <HostVideo sourceFrame={frame < split ? 0 : split} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg,rgba(4,9,12,.32),rgba(4,9,12,.03) 42%,transparent 58%)'}} />
    </Sequence>}
    {news && <Sequence from={split} durationInFrames={insertion}><News /></Sequence>}
    {paper && <Sequence from={paper.outputStartFrame} durationInFrames={paper.durationInFrames}>
      <OffthreadVideo src={staticFile(paper.publicPath)} muted style={full} />
      <Audio src={staticFile(paper.publicPath)} volume={0.1} />
    </Sequence>}
    {official && <Sequence from={official.from} durationInFrames={official.to - official.from}>
      <OfficialEvidence second={official.second} sourceStartFrame={official.sourceStartFrame} />
    </Sequence>}
    {!news && !paper && visual.semantic.filter(s => frame >= s.from && frame < s.to).map(scene =>
      <Sequence key={scene.id} from={scene.from} durationInFrames={scene.to - scene.from}><Semantic scene={scene} /></Sequence>)}
    {!news && !paper && visual.effects.filter(e => frame >= e.from && frame < e.to).map(effect =>
      <Sequence key={effect.id} from={effect.from} durationInFrames={effect.to - effect.from}><Effect effect={effect} /></Sequence>)}
    {visual.sfx.map(cue => <Sequence key={cue.id} from={cue.frame} durationInFrames={Math.min(45, total - cue.frame)}>
      <Audio src={staticFile(cue.publicPath)} volume={cue.gain} />
    </Sequence>)}
    <div style={{position: 'absolute', left: 48, top: 28, fontSize: 24, fontWeight: 800, color: '#fff', textShadow: '0 2px 8px #111'}}>超哥AI创业记</div>
    {!news && !paper && !official && <div style={{position: 'absolute', left: 54, top: 82, color: '#85D5E4', fontSize: 24, fontWeight: 800, textShadow: '0 2px 7px #111'}}>
      {visual.chapters.filter(c => sourceFrame >= c.sourceFrame).at(-1)?.title}
    </div>}
    {paper && <div style={{position: 'absolute', left: 48, top: 64, color: '#DFE6E9', fontSize: 20, textShadow: '0 2px 6px #111'}}>AI生成 · 概念演绎</div>}
    {!news && <AdaptiveBilingualCaptionOverlay captionsSrc="captions.json" variant="transparent-v8" />}
    <div style={{position: 'absolute', left: 48, right: 48, bottom: 26, height: 3, background: '#FFFFFF3A'}}>
      <div style={{height: '100%', width: `${(frame + 1) / total * 100}%`, background: '#68D8E8'}} />
    </div>
  </AbsoluteFill>;
}
