import React from 'react';
import {AbsoluteFill,Composition,OffthreadVideo,registerRoot,staticFile,useCurrentFrame,interpolate} from 'remotion';
import {PresenterMediaStage} from '../../../skills/koubo-remotion-director/assets/remotion-presenter-media/PresenterMediaStage';
import {EvidenceScan} from '../../../skills/koubo-shotcraft-library/assets/ShotcraftEffects';
import captions from '../../../edit/20260919_ai_training_methods/07_预览与质检/录屏小样R1/captions.json';
import selection from '../../../edit/20260919_ai_training_methods/07_预览与质检/录屏小样R1/selection-r3.json';
import {Sequence} from 'remotion';
const media='';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const Screen:React.FC<{kind:'question'|'archive';from:number;duration:number}>=({kind,from,duration})=>{
 const f=useCurrentFrame();
 const picked=selection.beats.find(b=>b.beatId==='screen-question')!;
 return <AbsoluteFill>
  <PresenterMediaStage materialSrc={`${media}${kind==='question'?'question-v4':kind}.mp4`} presenterSrc={`${media}host.mp4`} speakerStartFromFrame={from} durationInFrames={duration} presenterPlacement="fallback" presenterShape="rounded-rectangle" enterFrames={6} exitFrames={6}/>
  {kind==='question'&&picked.decision==='apply'&&<div style={{position:'absolute',left:350,top:230}}><EvidenceScan frame={f} fps={30} durationInFrames={duration} width={1540} height={360} rect={{x:10,y:110,width:1510,height:92}} label="深挖底层的问题"/></div>}
 </AbsoluteFill>;
};
const Preview=()=>{
 const frame=useCurrentFrame();
 const caption=captions.find(c=>c.startMs<=frame/30*1000&&c.endMs>frame/30*1000);
 const scale=interpolate(frame,[0,144,324,680,804,1268],[1,1.04,1.025,1.07,1.015,1.065],clamp);
 return <AbsoluteFill style={{backgroundColor:'#101619',fontFamily:'PingFang SC',color:'white'}}>
  <AbsoluteFill style={{transform:`scale(${scale})`,transformOrigin:'52% 38%'}}><OffthreadVideo src={staticFile(`${media}host.mp4`)} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/></AbsoluteFill>
  <Sequence from={144} durationInFrames={75}><Screen kind="question" from={144} duration={75}/></Sequence>
  <Sequence from={680} durationInFrames={124}><Screen kind="archive" from={680} duration={124}/></Sequence>
  <div style={{position:'absolute',left:60,top:42,fontSize:32,fontWeight:600,textShadow:'0 2px 9px #000'}}>超哥AI创业记</div>
  <div style={{position:'absolute',left:0,bottom:0,width:'100%',height:174,background:'rgba(5,9,13,.88)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10}}>
   {caption&&<><div style={{fontSize:46,fontWeight:650,lineHeight:1.15,maxWidth:1740,textAlign:'center'}}>{caption.zh}</div><div style={{fontSize:30,lineHeight:1.2,maxWidth:1740,textAlign:'center',color:'#e2e5e8'}}>{caption.en}</div></>}
  </div>
 </AbsoluteFill>;
};
registerRoot(()=> <Composition id="AITrainingScreenPreview" component={Preview} width={1920} height={1080} fps={30} durationInFrames={1269}/>);
