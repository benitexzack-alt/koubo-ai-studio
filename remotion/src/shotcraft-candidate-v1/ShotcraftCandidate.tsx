import React from 'react';
import {AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {EvidenceScan, KeywordReveal, LineCarry, MarkerUnderline, PaperTapePin} from './ShotcraftEffects.generated';
import plan from './candidate-plan.v1.json';
import captions from './captions.generated.json';

const full = {width:'100%',height:'100%',objectFit:'contain' as const};
const asset = (id: keyof typeof plan.assets) => staticFile(plan.assets[id].publicPath);
const fontFamily = '"Koubo Heiti", "PingFang SC", sans-serif';

export function ShotcraftCandidate({withSfx = true}: {withSfx?:boolean}) {
  const frame=useCurrentFrame();
  const time=(plan.sourceStartFrame+frame)/plan.fps*1000;
  const caption=captions.find(c=>c.startMs<=time && c.endMs>time);
  const evidence=plan.mediaWindows.find(w=>w.from<=frame && w.from+w.duration>frame);
  return <AbsoluteFill style={{backgroundColor:'#16191a',fontFamily}}>
    <OffthreadVideo src={staticFile(plan.source.publicPath)} startFrom={plan.sourceStartFrame} style={full}/>
    {evidence && <Sequence from={evidence.from} durationInFrames={evidence.duration}>
      <AbsoluteFill><OffthreadVideo src={asset('family')} startFrom={evidence.mediaStartFrame} style={full} volume={0.12}/></AbsoluteFill>
      <div style={{position:'absolute',right:72,bottom:188,width:296,height:296,borderRadius:'50%',overflow:'hidden',border:'2px solid #ddd'}}>
        <OffthreadVideo src={staticFile(plan.source.publicPath)} startFrom={plan.sourceStartFrame+evidence.from} muted style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'72% 45%'}}/>
      </div>
    </Sequence>}
    {plan.effects.filter(e=>e.from<=frame && frame<e.from+e.duration).map(e=>{
      const timing={frame:frame-e.from,fps:plan.fps,durationInFrames:e.duration};
      return <Sequence key={e.id} from={e.from} durationInFrames={e.duration} layout="none"><div data-effect={e.id} style={{position:'absolute',left:e.region.x,top:e.region.y,width:e.region.width,height:e.region.height,overflow:'hidden'}}>
        {e.effectId==='marker-underline' && <MarkerUnderline {...timing} before="AI" keyword="家庭故事动画" after="、婚礼定制短片" fontSize={60}/>}
        {e.effectId==='paper-tape-pin' && <><div style={{fontSize:38,color:'#fff',textShadow:'0 2px 5px #222'}}>抖音上面</div><PaperTapePin {...timing} width={620}><Sequence from={0}><OffthreadVideo src={asset('family')} style={full} volume={0.12}/></Sequence></PaperTapePin></>}
        {e.effectId==='evidence-scan' && <EvidenceScan {...timing} width={e.region.width} height={e.region.height} rect={{x:8,y:8,width:1024,height:420}} label="动画短片"/>}
        {e.effectId==='keyword-reveal' && <KeywordReveal {...timing} items={plan.listItems} fontSize={50}/>}
        {e.effectId==='line-carry' && <LineCarry {...timing} fromLabel="点点滴滴" toLabel="故事脚本" width={620}/>}
      </div></Sequence>;
    })}
    {withSfx && plan.sfx.map(c=><Sequence key={c.id} from={c.frame} durationInFrames={plan.durationInFrames-c.frame}><Audio src={asset(c.assetId as keyof typeof plan.assets)} volume={c.gain}/></Sequence>)}
    <div style={{position:'absolute',left:48,top:32,fontSize:25,color:'#fff',textShadow:'0 2px 4px #111'}}>超哥AI创业记</div>
    {caption && <div style={{position:'absolute',left:110,right:110,bottom:50,textAlign:'center',color:'#fff',textShadow:'0 2px 6px #000',fontWeight:600}}>
      <div style={{fontSize:42,lineHeight:1.4}}>{caption.zh}</div><div style={{fontSize:24,lineHeight:1.4}}>{caption.en}</div>
    </div>}
    <div style={{position:'absolute',left:48,right:48,bottom:28,height:3,background:'#ffffff40'}}><div style={{height:'100%',width:`${(frame+1)/plan.durationInFrames*100}%`,background:'#67cee0'}}/></div>
  </AbsoluteFill>;
}
