import React from 'react';
import {AbsoluteFill, Audio, Composition, Easing, interpolate, OffthreadVideo, registerRoot, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {AdaptiveBilingualCaptionOverlay} from '../components/AdaptiveBilingualCaptionOverlay';
import {LocalFont} from '../components/LocalFont';
import {PresenterMediaStage} from './vendor/assets/remotion-presenter-media/PresenterMediaStage';
import {EvidenceScan, MarkerUnderline} from './vendor/ShotcraftEffects';
import decision from './decision.json';
import selection from './selection.json';
import timeline from './timeline.json';
import sources from './sources.json';

const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;

const cameraAt=(frame:number)=>{
 const i=timeline.beats.findIndex(b=>frame>=b.frames.startFrame&&frame<b.frames.endFrameExclusive);
 const b=timeline.beats[Math.max(0,i)],duration=(b.frames.endFrameExclusive-b.frames.startFrame)/30;
 const p=(frame-b.frames.startFrame)/(duration*30),accent=Math.min(.32,Math.max(.16,1.45/duration)),settle=Math.max(accent+.18,.76);
 const n=p<=accent?interpolate(p,[0,accent],[0,1],{...clamp,easing:Easing.out(Easing.cubic)}):p<=settle?interpolate(p,[accent,settle],[1,.72],{...clamp,easing:Easing.inOut(Easing.cubic)}):interpolate(p,[settle,1],[.72,0],{...clamp,easing:Easing.inOut(Easing.cubic)});
 return {scale:1.012+([1.065,1.075,1.07,1.08][Math.max(0,i)%4]-1.012)*n,x:[-12,14,-16,12][Math.max(0,i)%4]*n,y:2*n};
};

const Evidence:React.FC<{beatId:string;previewStart:number}>=({beatId,previewStart})=>{
 const f=useCurrentFrame(),aol=beatId==='B18';
 const picked=selection.beats.find(b=>b.beatId===beatId)!;
 const duration=picked.frames.endFrameExclusive-picked.frames.startFrame;
 const source=sources.materials[aol?0:1],apple=sources.materials[2];
 const enter=interpolate(f,[0,9],[0,1],clamp);
 return <AbsoluteFill>
  <PresenterMediaStage materialSrc="evidence-background.mp4" presenterSrc="presenter-square.mp4" speakerStartFromFrame={previewStart} durationInFrames={duration} presenterPlacement="fallback" presenterShape="rounded-rectangle" enterFrames={6} exitFrames={6}/>
  <div style={{position:'absolute',left:430,top:130,width:1390,height:700,color:'#f6f8fc',opacity:enter,transform:`translateY(${16*(1-enter)}px)`}}>
   <div style={{fontSize:44,fontWeight:850,letterSpacing:1}}>{aol?'AOL 服务变更说明':'BlackBerry 业务调整'}</div>
   <div style={{position:'absolute',left:32,top:650,fontSize:25,color:'#a6bacb'}}>{aol?'官方原文节选 · legal.aol.com':'公司新闻稿 · 2016.09.28 · GlobeNewswire'}</div>
   <div style={{position:'absolute',left:32,top:140,width:1300,height:140,fontSize:36,lineHeight:1.5,display:'flex',alignItems:'center'}}>{source.quote}</div>
   <div style={{position:'absolute',left:32,top:310,width:1300,fontSize:38,lineHeight:1.5,color:'#e3d09d'}}>{source.translation}</div>
   {aol?<div style={{position:'absolute',left:32,top:480,width:1280,opacity:interpolate(f,[37,45],[0,1],clamp),fontSize:40,fontWeight:800,color:'#ffcc94'}}>{source.separateCorrection}</div>:<div style={{position:'absolute',left:32,top:470,width:1280,opacity:interpolate(f,[40,49],[0,1],clamp)}}>
    <div style={{fontSize:34,color:'#92dce9'}}>App Store：截至2010年6月，累计向开发者支付10亿美元</div>
    <div style={{fontSize:25,marginTop:14,color:'#b3c3d0'}}>{apple.onScreenSource}</div>
    <div style={{fontSize:27,marginTop:14,color:'#e4c58e'}}>累计支付不等于净利润，也不代表所有团队都赚钱。</div>
   </div>}
   <div style={{position:'absolute',left:0,top:0,width:1390,height:430,overflow:'hidden'}}><EvidenceScan frame={f} fps={30} durationInFrames={duration} {...picked.componentProps as {width:number;height:number;rect:{x:number;y:number;width:number;height:number};label:string}}/></div>
  </div>
 </AbsoluteFill>;
};

const Preview=()=>{
 const frame=useCurrentFrame(),sourceFrame=frame,m=cameraAt(sourceFrame);
 const marker=selection.beats.find(b=>b.beatId==='B02')!;
 const mf=sourceFrame-marker.frames.startFrame;
 return <AbsoluteFill style={{backgroundColor:'#101923',fontFamily:'"Koubo Heiti", "PingFang SC", sans-serif',color:'white'}}>
  <LocalFont/>
  <Audio src={staticFile("audio/final-mix.wav")}/>
  <AbsoluteFill style={{transform:`translate3d(${m.x}px,${m.y}px,0) scale(${m.scale})`,transformOrigin:'53% 38%'}}><OffthreadVideo src={staticFile('host.mp4')} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/></AbsoluteFill>
  {decision.paper.map(p=><Sequence key={p.id} from={p.startFrame} durationInFrames={p.endFrameExclusive-p.startFrame} premountFor={15}><OffthreadVideo src={staticFile(`${p.id}.mp4`)} startFrom={Math.round(p.sourceInSeconds*30)} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/><div style={{position:'absolute',right:55,top:45,fontSize:24,color:'#efe8db',textShadow:'0 2px 6px #000'}}>AI生成 · 纸艺示意</div></Sequence>)}
  {['B18','B19'].map(id=>{const b=selection.beats.find(s=>s.beatId===id)!;const start=b.frames.startFrame;return <Sequence key={id} from={start} durationInFrames={b.frames.endFrameExclusive-b.frames.startFrame} premountFor={15}><Evidence beatId={id} previewStart={start}/></Sequence>;})}
  {mf>=0&&sourceFrame<marker.frames.endFrameExclusive&&<div style={{position:'absolute',left:50,top:170,width:455,height:370,opacity:interpolate(mf,[73,81],[1,0],clamp)}}><MarkerUnderline frame={interpolate(mf,[0,20,27,80],[0,32,42,80],clamp)} fps={30} durationInFrames={81} before="别让你的" keyword="短板" after="去跟别人的长板拼" fontSize={48}/></div>}
  <div style={{position:'absolute',left:60,top:42,fontSize:32,fontWeight:600,textShadow:'0 2px 9px #000'}}>超哥AI创业记</div>
  <AdaptiveBilingualCaptionOverlay captionsSrc="captions.json" variant="transparent-v8"/>
 </AbsoluteFill>;
};
registerRoot(()=> <Composition id="IndustryAiNoAnxietyFinalR1" component={Preview} width={1920} height={1080} fps={30} durationInFrames={3687}/>);
