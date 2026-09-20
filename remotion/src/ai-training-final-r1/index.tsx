import React from 'react';
import {AbsoluteFill,Audio,Composition,OffthreadVideo,Sequence,Easing,interpolate,registerRoot,staticFile,useCurrentFrame} from 'remotion';
import {PresenterMediaStage} from './vendor/PresenterMediaStage';
import {EvidenceScan} from './vendor/ShotcraftEffects';
import {AdaptiveBilingualCaptionOverlay} from '../components/AdaptiveBilingualCaptionOverlay';
import {LocalFont} from '../components/LocalFont';
import {V8DirectStatement,V8ProcessRail,type V8SemanticLayer} from '../employee-ai-efficiency-v8-r2/V8SemanticStage.r2';
import plan from './runtime-plan.r1.json';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const cuts=[...new Set([0,...plan.layers.flatMap(l=>[l.start,l.end]),...plan.insertions.flatMap(c=>[c.startFrame/30,c.endFrameExclusive/30]),305.1666666667])].sort((a,b)=>a-b);
const cameraAt=(seconds:number)=>{
 const approved=seconds>=128.2&&seconds<170.5;
 const localCuts=approved?[0,4.8,7.3,13.16,19.08,22.6666666667,26.8,35.54,42.3]:cuts;
 const time=approved?seconds-128.2:seconds;
 const i=Math.max(0,localCuts.findIndex((s,n)=>time>=s&&time<(localCuts[n+1]??Infinity)));
 const duration=Math.max(.3,(localCuts[i+1]??305.1666666667)-localCuts[i]),p=(time-localCuts[i])/duration;
 const accent=Math.min(.32,Math.max(.16,1.45/duration)),settle=Math.max(accent+.18,.76);
 const intensity=p<=accent?interpolate(p,[0,accent],[0,1],{...clamp,easing:Easing.out(Easing.cubic)}):p<=settle?interpolate(p,[accent,settle],[1,.72],{...clamp,easing:Easing.inOut(Easing.cubic)}):interpolate(p,[settle,1],[.72,0],{...clamp,easing:Easing.inOut(Easing.cubic)});
 return {scale:1.012+([1.065,1.075,1.07,1.08][i%4]-1.012)*intensity,x:[-12,14,-16,12][i%4]*intensity,y:[2,3,2,3][i%4]*intensity};
};
const Semantic:React.FC<{layer:V8SemanticLayer}>=({layer})=>{
 const frame=useCurrentFrame(),duration=Math.round(layer.end*30)-Math.round(layer.start*30);
 const Component=layer.params.component==='process'?V8ProcessRail:V8DirectStatement;
 return <AbsoluteFill style={{opacity:interpolate(frame,[duration-8,duration],[1,0],clamp),transform:`scale(${plan.semanticScale})`,transformOrigin:'80px 164px'}}><Component layer={layer}/></AbsoluteFill>;
};
const Screen:React.FC<{kind:string;from:number;duration:number}>=({kind,from,duration})=>{
 const frame=useCurrentFrame();
 return <AbsoluteFill><PresenterMediaStage materialSrc={`media/${kind==='question'?'question-v4':'archive'}.mp4`} presenterSrc="media/host.mp4" speakerStartFromFrame={from} durationInFrames={duration} presenterPlacement="fallback" presenterShape="rounded-rectangle" enterFrames={6} exitFrames={6}/>
 {kind==='question'&&<div style={{position:'absolute',left:350,top:230}}><EvidenceScan frame={frame} fps={30} durationInFrames={duration} width={1540} height={360} rect={{x:10,y:110,width:1510,height:92}} label="深挖底层的问题"/></div>}
 </AbsoluteFill>;
};
export const Episode:React.FC<{soundEnabled:boolean}>=({soundEnabled})=>{
 const frame=useCurrentFrame(),motion=cameraAt(frame/30);
 return <AbsoluteFill style={{backgroundColor:'#101619',fontFamily:'"Koubo Heiti", "PingFang SC",sans-serif',color:'white'}}>
  <LocalFont/>
  <AbsoluteFill style={{transform:`translate3d(${motion.x}px,${motion.y}px,0) scale(${motion.scale})`,transformOrigin:'53% 38%'}}><OffthreadVideo src={staticFile(plan.sourceVideo)} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/></AbsoluteFill>
  {plan.insertions.map(clip=><Sequence key={clip.id} from={clip.startFrame} durationInFrames={clip.endFrameExclusive-clip.startFrame}><AbsoluteFill style={{background:clip.route==='paper-editorial'?'#ddd5c4':'#101619'}}><OffthreadVideo src={staticFile(clip.src)} muted style={{position:'absolute',left:184,top:6,width:1552,height:873,objectFit:'contain'}}/><div style={{position:'absolute',right:55,top:34,fontSize:21,color:'#fff',background:'#0007',padding:'4px 8px'}}>AI生成</div></AbsoluteFill></Sequence>)}
  {plan.screens.map(clip=><Sequence key={clip.id} from={clip.startFrame} durationInFrames={clip.endFrameExclusive-clip.startFrame}><Screen kind={clip.kind} from={clip.startFrame} duration={clip.endFrameExclusive-clip.startFrame}/></Sequence>)}
  {plan.layers.map(layer=><Sequence key={layer.id} from={Math.round(layer.start*30)} durationInFrames={Math.round(layer.end*30)-Math.round(layer.start*30)}><Semantic layer={layer}/></Sequence>)}
  <div style={{position:'absolute',left:60,top:42,fontSize:32,fontWeight:600,textShadow:'0 2px 9px #000'}}>超哥AI创业记</div>
  <AdaptiveBilingualCaptionOverlay captionsSrc={plan.captionsSrc} variant="transparent-v8"/>
  <Audio src={staticFile(soundEnabled?plan.mix:'audio/voice-normalized.wav')}/>
 </AbsoluteFill>;
};
const Root=()=><>
 <Composition id="AITrainingV8-Final-WithSfx" component={Episode} durationInFrames={plan.durationInFrames} fps={30} width={1920} height={1080} defaultProps={{soundEnabled:true}}/>
 <Composition id="AITrainingV8-Final-NoSfx" component={Episode} durationInFrames={plan.durationInFrames} fps={30} width={1920} height={1080} defaultProps={{soundEnabled:false}}/>
</>;
registerRoot(Root);
