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

// Scoped overrides preserve the shared V8 animation and keep this revision isolated.
const typography = `
.r2-semantic > div {left:64px!important;top:170px!important;width:640px!important;max-height:670px!important}
.r2-semantic > div > div:first-child {font-size:28px!important}
.r2-semantic > div > div:nth-child(2) {font-size:76px!important;line-height:1.16!important;max-width:640px!important;color:#FFD068!important}
.r2-semantic > div > div:nth-child(2) span {color:inherit!important}
.r2-statement > div > div:nth-child(4),.r2-questions > div > div:nth-child(4) {font-size:40px!important;line-height:1.4!important;max-width:640px!important;color:#FFFFFF!important;margin-top:24px!important}
.r2-questions > div > div:nth-child(3) {gap:16px!important;margin-top:28px!important}
.r2-questions > div > div:nth-child(3) > div {min-height:76px!important;grid-template-columns:54px 1fr!important;padding-bottom:12px}
.r2-questions > div > div:nth-child(3) > div > span:first-child {font-size:26px!important;color:#78DEED!important}
.r2-questions > div > div:nth-child(3) > div > span:last-child {font-size:46px!important;line-height:1.24!important}
.r2-marker > div > div > span {font-size:88px!important;line-height:1.2!important;color:#FFD068!important}
.r2-opening > div > div:nth-child(2) {font-size:112px!important;line-height:1.2!important}
.r2-evidence > div > div:last-child {left:52px!important;top:600px!important;width:1066px!important;color:#FFFFFF!important}
.r2-evidence > div > div:last-child::before {content:'口播：';color:#B8E4EC}
`;

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

function OfficialEvidence({sourceStartFrame}: {sourceStartFrame: number}) {
  const local = useCurrentFrame();
  const second = local >= 170;
  const enter = interpolate(local, [0, 12], [0.96, 1], clamp);
  const reveal = (at: number) => ({opacity:interpolate(local,[at,at+8],[0,1],clamp),
    transform:`translateY(${interpolate(local,[at,at+8],[14,0],clamp)}px)`});
  const ink = (at: number) => local >= at ? '#15242A' : '#59636B';
  return <AbsoluteFill style={{background: '#10181d'}}>
    <div style={{position:'absolute',left:64,top:78,color:'#C6DDE5',fontSize:32}}>工业和信息化部官网 · 工信厅科函〔2026〕414号</div>
    <div style={{position:'absolute',left:64,top:122,color:'#AFC2CC',fontSize:28}}>2026年8月27日成文 · 8月31日发布</div>
    <div data-official-excerpt style={{position:'absolute',left:64,top:170,width:1170,height:680,
      background:'#F8F9F8',color:'#15242A',boxShadow:'0 14px 32px #0004',transform:`scale(${enter})`,transformOrigin:'left top'}}>
      <div style={{position:'absolute',left:52,top:34,fontSize:30,color:'#4B6670'}}>官网原文摘录 · 放大排版</div>
      {!second ? <>
        <div style={{position:'absolute',left:52,top:92,fontSize:44,...reveal(0)}}>工业和信息化部办公厅</div>
        <div style={{position:'absolute',left:52,top:170,fontSize:50,color:ink(85)}}>关于开展</div>
        <div style={{position:'absolute',left:52,top:248,fontSize:76,fontWeight:900,color:ink(91)}}>人工智能应用服务商</div>
        <div style={{position:'absolute',left:52,top:352,fontSize:76,fontWeight:900,color:ink(154)}}>
          <span style={{background:`rgba(255,208,104,${interpolate(local,[154,160],[0,1],clamp)})`,padding:'2px 8px'}}>培育专项行动</span>的通知
        </div>
        <div style={{position:'absolute',left:52,top:544,fontSize:32,color:'#4B6670'}}>工信厅科函〔2026〕414号</div>
      </> : <>
        <div style={{position:'absolute',left:52,top:92,fontSize:38,fontWeight:800}}>人工智能应用服务商培育专项行动</div>
        <div style={{position:'absolute',left:52,top:178,fontSize:50,...reveal(173)}}>鼓励服务商搭建</div>
        <div style={{position:'absolute',left:52,top:250,fontSize:50,...reveal(190)}}>前线部署工程师（FDE）团队，</div>
        <div style={{position:'absolute',left:52,top:344,fontSize:84,fontWeight:900,...reveal(221)}}>
          <span style={{background:'#FFD068',padding:'2px 8px'}}>扎根用户现场</span>，
        </div>
        <div style={{position:'absolute',left:52,top:468,fontSize:68,fontWeight:800,...reveal(242)}}>保障场景落地。</div>
      </>}
    </div>
    <div style={{position:'absolute',left:1282,top:178,width:560,color:'#C6DDE5',fontSize:28}}>原文截图</div>
    <div style={{position:'absolute',left:1282,top:224,width:560,height:326,display:'flex',alignItems:'flex-start'}}>
      <Img src={staticFile(second?'O01-onsite.png':'O01-title.png')} style={{width:560,maxHeight:326,objectFit:'contain',objectPosition:'top'}} />
    </div>
    <div style={{position:'absolute',left:64,top:872,width:1160,color:'#AFC2CC',fontSize:26,lineHeight:1.4}}>政策背景引用，不代表对本人或公司的官方认定或推荐。</div>
    <div style={{position: 'absolute', right: 360, bottom: 202, width: 278, height: 278, borderRadius: '50%', overflow: 'hidden', border: '2px solid #D8E4E9', opacity: interpolate(local,[0,12],[0,1],clamp), transform: `scale(${enter})`}}>
      <HostVideo sourceFrame={sourceStartFrame} inset />
    </div>
  </AbsoluteFill>;
}

function Semantic({scene}: {scene: typeof visual.semantic[number]}) {
  const layer: V8SemanticLayer = {id: scene.id, start: scene.from / fps, end: scene.to / fps,
    title: scene.title, detail: scene.detail, items: scene.items, params: {component: scene.component}};
  return <div className={`r2-semantic r2-${scene.component}${scene.sourceCaptionId === 'c001' ? ' r2-opening' : ''}`}>
    {scene.component === 'questions' ? <V8QuestionList layer={layer} /> : <V8DirectStatement layer={layer} />}
  </div>;
}

function Effect({effect}: {effect: typeof visual.effects[number]}) {
  const frame = useCurrentFrame();
  const timing = {frame, fps, durationInFrames: effect.to - effect.from};
  const props = effect.props as {before?: string; keyword?: string; after?: string; label?: string};
  return <div data-effect={effect.id} className={effect.effectId === 'marker-underline' ? 'r2-marker' : effect.effectId === 'evidence-scan' ? 'r2-evidence' : undefined} style={{position: 'absolute', left: effect.region.x, top: effect.region.y,
    width: effect.region.width, height: effect.region.height, overflow: effect.effectId === 'evidence-scan' ? 'hidden' : 'visible'}}>
    {effect.effectId === 'marker-underline' && <MarkerUnderline {...timing} before={props.before}
      keyword={props.keyword ?? effect.words[0]} after={props.after} fontSize={64} />}
    {effect.effectId === 'keyword-reveal' && <KeywordReveal {...timing} fontSize={70}
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
    <style>{typography}</style>
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
    {official && <Sequence from={visual.official[0].from} durationInFrames={visual.official.at(-1)!.to-visual.official[0].from}>
      <OfficialEvidence sourceStartFrame={visual.official[0].sourceStartFrame} />
    </Sequence>}
    {!news && !paper && visual.semantic.filter(s => frame >= s.from && frame < s.to).map(scene =>
      <Sequence key={scene.id} from={scene.from} durationInFrames={scene.to - scene.from}><Semantic scene={scene} /></Sequence>)}
    {!news && !paper && visual.effects.filter(e => frame >= e.from && frame < e.to).map(effect =>
      <Sequence key={effect.id} from={effect.from} durationInFrames={effect.to - effect.from}><Effect effect={effect} /></Sequence>)}
    {visual.sfx.map(cue => <Sequence key={cue.id} from={cue.frame} durationInFrames={Math.min(cue.durationInFrames, total - cue.frame)}>
      <Audio src={staticFile(cue.publicPath)} startFrom={cue.sourceStartFrame}
        volume={f => cue.gain * interpolate(f,[Math.max(0,cue.durationInFrames-cue.fadeOutFrames-1),cue.durationInFrames-1],[1,0],clamp)} />
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
