import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  CardstockPieceV3,
  HalftoneV3,
  PaperFiberV3,
  SceneMarkV3,
  tornV3A,
  tornV3B,
} from './PaperEngineV3';
import {easeV3, landV3} from './motionV3';
import {v3Font, v3Palette} from './paletteV3';

const PaperBuildingV3: React.FC<{
  delay:number;
  x:number;
  bottom:number;
  width:number;
  height:number;
  depth:number;
  color:string;
  rows:number;
  zIndex:number;
}> = ({delay,x,bottom,width,height,depth,color,rows,zIndex}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const p=landV3(frame,Math.round(delay*fps),fps,Math.round(.72*fps));
  return (
    <div style={{position:'absolute',left:x,bottom,width,height,opacity:p,transformOrigin:'50% 100%',transform:`perspective(1050px) translateY(${interpolate(p,[0,1],[height*.9,0])}px) rotateX(${interpolate(p,[0,1],[-18,0])}deg) scaleY(${interpolate(p,[0,1],[.14,1])})`,zIndex}}>
      <div style={{position:'absolute',left:'8%',right:'-3%',bottom:-26,height:40,borderRadius:'50%',background:'rgba(7,17,21,.38)',filter:'blur(14px)'}}/>
      <div style={{position:'absolute',inset:0,background:`linear-gradient(150deg,rgba(255,255,255,.42) 0 3%,${color} 4% 82%,rgba(12,27,31,.18) 100%)`,clipPath:tornV3B,boxShadow:'inset 0 4px 0 rgba(255,255,255,.35),0 9px 0 rgba(9,22,26,.32),0 23px 30px rgba(7,17,21,.25)',overflow:'hidden'}}>
        <HalftoneV3 color={v3Palette.ink} opacity={.1} size={9}/>
        <div style={{position:'absolute',left:'17%',right:'17%',top:'18%',display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:`${Math.max(8,width*.065)}px`,gridAutoRows:`${Math.max(15,height/(rows*5))}px`}}>
          {Array.from({length:rows*2}).map((_,index)=><div key={index} style={{background:index%3===0?v3Palette.yellow:v3Palette.paperLight,clipPath:tornV3A,boxShadow:'3px 4px 0 rgba(12,27,31,.2)'}}/>)}
        </div>
      </div>
      <div style={{position:'absolute',right:-depth,top:12,width:depth,height:height-8,background:`linear-gradient(90deg,${color},rgba(10,25,30,.5))`,clipPath:'polygon(0 0,100% 11%,100% 100%,0 96%)',transformOrigin:'left center',transform:'skewY(12deg)',filter:'brightness(.62)',boxShadow:'7px 9px 0 rgba(7,17,21,.25)'}}/>
      <div style={{position:'absolute',left:5,right:-depth+4,top:-Math.max(18,depth*.45),height:Math.max(28,depth*.6),background:v3Palette.paperLight,clipPath:'polygon(0 100%,12% 0,88% 0,100% 100%)',transform:'skewX(-9deg)',boxShadow:'0 4px 0 rgba(9,22,26,.3)'}}/>
    </div>
  );
};

const DataParcelV3: React.FC<{start:number;duration:number;offset:number;color:string}> = ({start,duration,offset,color}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const p=easeV3(frame,Math.round(start*fps),Math.round(duration*fps));
  const x=interpolate(p,[0,.55,1],[960+offset,940+offset*.35,985+offset*.18]);
  const y=interpolate(p,[0,.55,1],[930,650,470]);
  const scale=interpolate(p,[0,1],[1.15,.42]);
  return <div style={{position:'absolute',left:x-26,top:y-22,width:52,height:44,background:color,clipPath:tornV3A,transform:`scale(${scale}) rotate(${p*150}deg)`,boxShadow:'7px 10px 0 rgba(7,17,21,.3)',zIndex:76,opacity:p>0&&p<1?1:0}}/>;
};

export const WorldMiniatureSystemV3: React.FC = () => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const reveal=easeV3(frame,0,Math.round(.58*fps));
  const ground=easeV3(frame,Math.round(.05*fps),Math.round(.78*fps));
  const road=easeV3(frame,Math.round(.72*fps),Math.round(1.12*fps));
  const gate=landV3(frame,Math.round(1.92*fps),fps,Math.round(.75*fps));
  const camera=easeV3(frame,0,Math.round(8.6*fps));
  const complete=landV3(frame,Math.round(6.72*fps),fps,Math.round(.65*fps));
  const edge=reveal*106;
  const clipPath=`polygon(${100-edge}% 0,100% 0,100% 100%,${Math.min(100,103-edge)}% 100%,${Math.max(0,99-edge)}% 82%,${Math.min(100,104-edge)}% 61%,${Math.max(0,99-edge)}% 39%,${Math.min(100,104-edge)}% 18%)`;

  return (
    <AbsoluteFill style={{background:'#102E3E',overflow:'hidden',clipPath}}>
      <div style={{position:'absolute',left:0,right:0,top:0,height:540,background:'linear-gradient(#0D2531,#23566A 72%,#D0A944 73% 75%,#1A3238 76%)'}}/>
      <PaperFiberV3 dark strength={.7}/>
      <div style={{position:'absolute',inset:-55,transform:`translateY(${interpolate(camera,[0,1],[20,-12])}px) scale(${interpolate(camera,[0,1],[1.035,1.0])})`,transformOrigin:'50% 70%'}}>
        <div style={{position:'absolute',left:120,top:425,width:1780,height:770,background:v3Palette.ink2,clipPath:'polygon(28% 0,72% 0,100% 100%,0 100%)',transformOrigin:'50% 0',transform:`scaleY(${ground})`,boxShadow:'inset 0 12px 0 rgba(255,255,255,.1),0 -18px 38px rgba(7,17,21,.34)',zIndex:6}}>
          <PaperFiberV3 dark strength={.8}/>
          <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(255,247,227,.09) 2px,transparent 2px),linear-gradient(90deg,rgba(255,247,227,.08) 2px,transparent 2px)',backgroundSize:'78px 62px',transform:'perspective(600px) rotateX(8deg)'}}/>
        </div>

        <div style={{position:'absolute',left:650,top:452,width:690,height:650,background:v3Palette.paperLight,clipPath:'polygon(44% 0,56% 0,100% 100%,0 100%)',transformOrigin:'50% 0',transform:`scaleY(${road})`,boxShadow:'inset 16px 0 0 rgba(20,40,46,.12),inset -16px 0 0 rgba(20,40,46,.12),0 15px 0 rgba(7,17,21,.32)',zIndex:12}}>
          <div style={{position:'absolute',left:'49%',top:0,bottom:0,width:12,background:v3Palette.red,opacity:.85}}/>
          {[16,34,53,72].map(top=><div key={top} style={{position:'absolute',left:`${45-top*.33}%`,top:`${top}%`,width:`${10+top*.65}%`,height:8,background:v3Palette.yellow,opacity:.7}}/>)}
        </div>

        <CardstockPieceV3 x={195} y={680} width={360} height={240} delay={.25} color={v3Palette.red} rotate={-8} tiltX={-12} tiltY={10} thickness={10} enter="rise" zIndex={45}>
          <HalftoneV3 color={v3Palette.paperLight} opacity={.18} size={9}/>
          <div style={{position:'absolute',left:46,top:44,color:v3Palette.paperLight,fontFamily:v3Font,fontWeight:950,fontSize:27,letterSpacing:4}}>原始输入</div>
          <div style={{position:'absolute',left:48,right:48,top:105,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>{Array.from({length:8}).map((_,i)=><div key={i} style={{height:26,background:i%3===0?v3Palette.yellow:v3Palette.paperLight,clipPath:tornV3A}}/>)}</div>
        </CardstockPieceV3>
        <CardstockPieceV3 x={1430} y={720} width={330} height={210} delay={.48} color={v3Palette.teal} rotate={7} tiltX={-10} tiltY={-12} thickness={10} enter="rise" zIndex={46}>
          <div style={{position:'absolute',left:55,top:48,width:210,height:102,border:`13px double ${v3Palette.paperLight}`,display:'grid',placeItems:'center'}}><div style={{width:54,height:54,borderRadius:'50%',background:v3Palette.yellow}}/></div>
        </CardstockPieceV3>

        <div style={{position:'absolute',left:770,top:285,width:450,height:350,opacity:gate,transformOrigin:'50% 100%',transform:`translateY(${interpolate(gate,[0,1],[240,0])}px) scaleY(${interpolate(gate,[0,1],[.18,1])})`,zIndex:52}}>
          <div style={{position:'absolute',left:40,right:40,bottom:-28,height:54,borderRadius:'50%',background:'rgba(7,17,21,.4)',filter:'blur(15px)'}}/>
          <div style={{position:'absolute',left:48,top:20,width:354,height:320,border:`64px solid ${v3Palette.red}`,borderBottom:0,borderRadius:'180px 180px 0 0',boxShadow:`inset 0 0 0 10px rgba(255,255,255,.25),18px 15px 0 ${v3Palette.redDark},28px 28px 24px rgba(7,17,21,.28)`}}>
            <HalftoneV3 color={v3Palette.paperLight} opacity={.14} size={10}/>
          </div>
          <div style={{position:'absolute',left:80,top:252,width:290,height:90,background:v3Palette.paperLight,clipPath:tornV3B,boxShadow:'12px 14px 0 rgba(7,17,21,.32)',display:'grid',placeItems:'center',fontFamily:v3Font,fontWeight:950,color:v3Palette.ink,fontSize:24,letterSpacing:4}}>处理机制</div>
        </div>

        <DataParcelV3 start={3.05} duration={1.8} offset={-160} color={v3Palette.red}/>
        <DataParcelV3 start={3.35} duration={1.75} offset={0} color={v3Palette.yellow}/>
        <DataParcelV3 start={3.62} duration={1.72} offset={160} color={v3Palette.teal}/>

        <PaperBuildingV3 delay={4.35} x={380} bottom={555} width={170} height={260} depth={42} color={v3Palette.teal} rows={3} zIndex={27}/>
        <PaperBuildingV3 delay={4.72} x={540} bottom={535} width={210} height={340} depth={52} color={v3Palette.paper} rows={4} zIndex={31}/>
        <PaperBuildingV3 delay={5.08} x={1225} bottom={530} width={220} height={370} depth={56} color={v3Palette.red} rows={4} zIndex={32}/>
        <PaperBuildingV3 delay={5.45} x={1438} bottom={555} width={178} height={280} depth={44} color={v3Palette.yellow} rows={3} zIndex={30}/>
        <PaperBuildingV3 delay={5.82} x={1068} bottom={570} width={155} height={235} depth={38} color={v3Palette.teal} rows={3} zIndex={29}/>

        <CardstockPieceV3 x={1370} y={220} width={400} height={138} delay={6.65} color={v3Palette.paperLight} rotate={4} tiltX={-2} tiltY={-8} thickness={7} enter="press" zIndex={84}>
          <div style={{position:'absolute',inset:17,border:`10px double ${v3Palette.red}`,display:'grid',placeItems:'center',color:v3Palette.red,fontFamily:v3Font,fontSize:28,fontWeight:950,letterSpacing:5,opacity:complete}}>系统长成</div>
        </CardstockPieceV3>

        <CardstockPieceV3 x={270} y={350} width={225} height={92} delay={7.35} color={v3Palette.paperLight} rotate={-5} thickness={5} enter="rise" zIndex={88}>
          <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontFamily:v3Font,fontWeight:950,fontSize:25,color:v3Palette.ink}}>输出回执 A</div>
        </CardstockPieceV3>
        <CardstockPieceV3 x={575} y={250} width={225} height={92} delay={8.05} color={v3Palette.teal} rotate={3} thickness={5} enter="rise" zIndex={88}>
          <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontFamily:v3Font,fontWeight:950,fontSize:25,color:v3Palette.paperLight}}>输出回执 B</div>
        </CardstockPieceV3>
        <CardstockPieceV3 x={1085} y={300} width={225} height={92} delay={8.75} color={v3Palette.yellow} rotate={-3} thickness={5} enter="rise" zIndex={88}>
          <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontFamily:v3Font,fontWeight:950,fontSize:25,color:v3Palette.ink}}>输出回执 C</div>
        </CardstockPieceV3>
        <CardstockPieceV3 x={1480} y={455} width={245} height={92} delay={9.45} color={v3Palette.paperLight} rotate={5} thickness={5} enter="rise" zIndex={88}>
          <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontFamily:v3Font,fontWeight:950,fontSize:25,color:v3Palette.red}}>汇总回执 ✓</div>
        </CardstockPieceV3>

        <div style={{position:'absolute',left:0,right:0,bottom:0,height:135,background:v3Palette.charcoal,clipPath:'polygon(0 24%,8% 13%,17% 26%,28% 11%,39% 25%,51% 8%,63% 26%,74% 12%,86% 25%,100% 10%,100% 100%,0 100%)',zIndex:94,boxShadow:'0 -18px 38px rgba(7,17,21,.35)'}}><PaperFiberV3 dark strength={.7}/></div>
      </div>
      <SceneMarkV3 number="03" label="低机位纸雕系统" title="输入穿过机制，长成可见输出" inverse/>
    </AbsoluteFill>
  );
};
