import React from 'react';
import {AbsoluteFill,Composition,OffthreadVideo,registerRoot,staticFile,useCurrentFrame,interpolate,Sequence,Easing} from 'remotion';
import {PresenterMediaStage} from '../../../skills/koubo-remotion-director/assets/remotion-presenter-media/PresenterMediaStage';
import {EvidenceScan} from '../../../skills/koubo-shotcraft-library/assets/ShotcraftEffects';
import {AdaptiveBilingualCaptionOverlay} from '../components/AdaptiveBilingualCaptionOverlay';
import {LocalFont} from '../components/LocalFont';
import {V8DirectStatement,V8ProcessRail,type V8SemanticLayer} from '../employee-ai-efficiency-v8-r2/V8SemanticStage.r2';
import selection from '../../../edit/20260919_ai_training_methods/07_预览与质检/录屏小样R2/selection-r3.json';
const media='';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
// 用户已认可的两段录屏和小窗逐字保留，不跟随主画面运镜。
const Screen:React.FC<{kind:'question'|'archive';from:number;duration:number}>=({kind,from,duration})=>{
 const f=useCurrentFrame();
 const picked=selection.beats.find(b=>b.beatId==='screen-question')!;
 return <AbsoluteFill>
  <PresenterMediaStage materialSrc={`${media}${kind==='question'?'question-v4':kind}.mp4`} presenterSrc={`${media}host.mp4`} speakerStartFromFrame={from} durationInFrames={duration} presenterPlacement="fallback" presenterShape="rounded-rectangle" enterFrames={6} exitFrames={6}/>
  {kind==='question'&&picked.decision==='apply'&&<div style={{position:'absolute',left:350,top:230}}><EvidenceScan frame={f} fps={30} durationInFrames={duration} width={1540} height={360} rect={{x:10,y:110,width:1510,height:92}} label="深挖底层的问题"/></div>}
 </AbsoluteFill>;
};
// 使用已确认 R2 v3 的幅度、曲线与锚点；仅重绑本期语义切点。
const cameraAt=(seconds:number)=>{
 const cuts=[0,4.8,7.3,13.16,19.08,22.6666666667,26.8,35.54,42.3];
 const i=Math.max(0,cuts.findIndex((s,n)=>seconds>=s&&seconds<(cuts[n+1]??Infinity)));
 const duration=cuts[i+1]-cuts[i];
 const p=(seconds-cuts[i])/duration;
 const accent=Math.min(.32,Math.max(.16,1.45/duration)),settle=Math.max(accent+.18,.76);
 const intensity=p<=accent?interpolate(p,[0,accent],[0,1],{...clamp,easing:Easing.out(Easing.cubic)}):p<=settle?interpolate(p,[accent,settle],[1,.72],{...clamp,easing:Easing.inOut(Easing.cubic)}):interpolate(p,[settle,1],[.72,0],{...clamp,easing:Easing.inOut(Easing.cubic)});
 return {scale:1.012+([1.065,1.075,1.07,1.08][i%4]-1.012)*intensity,x:[-12,14,-16,12][i%4]*intensity,y:[2,3,2,3][i%4]*intensity};
};
const layers:V8SemanticLayer[]=[
 {id:'blind-spots',start:8.74,end:19.08,title:'看着会',detail:'浅尝辄止',items:['一上手就废','知识短板'],params:{component:'direct',label:'',itemFrames:[24,190],detailFrame:273}},
 {id:'chapter-five',start:20.10,end:22.6666666667,title:'严苛进度镜像',detail:'',items:[],params:{component:'direct',label:'第五'}},
 {id:'compare-work',start:26.8,end:35.54,title:'对比前后产出',detail:'',items:['真的能力提升','反复犯同一个老错误'],params:{component:'process',label:'',itemFrames:[99,175]}},
 {id:'measurable-progress',start:37.78,end:42.3,title:'只夸奖可以量化的进步',detail:'不做虚假鼓励',items:[],params:{component:'direct',label:'',detailFrame:83}},
];
const Semantic:React.FC<{layer:V8SemanticLayer}>=({layer})=>{
 const frame=useCurrentFrame(),duration=Math.round((layer.end-layer.start)*30);
 const fade=interpolate(frame,[duration-8,duration],[1,0],clamp);
 const Component=layer.params.component==='process'?V8ProcessRail:V8DirectStatement;
 return <AbsoluteFill style={{opacity:fade}}><Component layer={layer}/></AbsoluteFill>;
};
const Preview=()=>{
 const frame=useCurrentFrame(),motion=cameraAt(frame/30);
 return <AbsoluteFill style={{backgroundColor:'#101619',fontFamily:'PingFang SC',color:'white'}}>
  <LocalFont/>
  <AbsoluteFill style={{transform:`translate3d(${motion.x}px,${motion.y}px,0) scale(${motion.scale})`,transformOrigin:'53% 38%'}}><OffthreadVideo src={staticFile(`${media}host.mp4`)} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/></AbsoluteFill>
  <Sequence from={144} durationInFrames={75}><Screen kind="question" from={144} duration={75}/></Sequence>
  <Sequence from={680} durationInFrames={124}><Screen kind="archive" from={680} duration={124}/></Sequence>
  {layers.map(layer=><Sequence key={layer.id} from={Math.round(layer.start*30)} durationInFrames={Math.round(layer.end*30)-Math.round(layer.start*30)}><Semantic layer={layer}/></Sequence>)}
  <div style={{position:'absolute',left:60,top:42,fontSize:32,fontWeight:600,textShadow:'0 2px 9px #000'}}>超哥AI创业记</div>
  <AdaptiveBilingualCaptionOverlay captionsSrc="captions.json" variant="transparent-v8"/>
 </AbsoluteFill>;
};
registerRoot(()=> <Composition id="AITrainingScreenPreview" component={Preview} width={1920} height={1080} fps={30} durationInFrames={1269}/>);
