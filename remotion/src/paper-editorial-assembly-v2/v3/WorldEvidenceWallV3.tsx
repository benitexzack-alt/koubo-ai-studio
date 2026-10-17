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

const ProceduralPhotoCutoutV3: React.FC = () => (
  <div style={{position:'absolute',inset:0,background:'linear-gradient(160deg,#203D45 0 28%,#48676B 29% 56%,#B8A37B 57% 100%)'}}>
    <div style={{position:'absolute',left:0,right:0,bottom:0,height:'45%',background:v3Palette.charcoal,clipPath:'polygon(0 100%,0 62%,12% 41%,23% 58%,35% 18%,49% 52%,61% 27%,75% 61%,88% 36%,100% 55%,100% 100%)'}} />
    <div style={{position:'absolute',left:'12%',bottom:'23%',width:'18%',height:'34%',background:v3Palette.paperLight,clipPath:'polygon(48% 0,100% 100%,0 100%)',opacity:.72}} />
    <div style={{position:'absolute',right:'15%',bottom:'21%',width:'15%',height:'48%',background:v3Palette.red,clipPath:'polygon(45% 0,62% 0,68% 75%,100% 100%,0 100%,38% 75%)'}} />
    <div style={{position:'absolute',left:'43%',bottom:'19%',width:'25%',height:'17%',border:`8px solid ${v3Palette.paperLight}`,borderTopWidth:13,transform:'skewX(-9deg)',opacity:.82}} />
    <HalftoneV3 color={v3Palette.paperLight} opacity={.28} size={8} />
    <div style={{position:'absolute',inset:0,background:'linear-gradient(92deg,rgba(255,255,255,.18),transparent 22% 78%,rgba(0,0,0,.26))',mixBlendMode:'screen'}} />
  </div>
);

const EvidenceNoteV3: React.FC<{
  delay:number;
  x:number;
  y:number;
  width:number;
  height:number;
  rotate:number;
  color:string;
  kind:'document'|'map'|'claim';
}> = ({delay,x,y,width,height,rotate,color,kind}) => (
  <CardstockPieceV3 x={x} y={y} width={width} height={height} delay={delay} color={color} rotate={rotate} tiltX={2} tiltY={-6} thickness={6} enter="right" zIndex={30}>
    {kind==='document' ? (
      <>
        <div style={{position:'absolute',left:28,top:30,width:'40%',height:24,background:v3Palette.red}} />
        <div style={{position:'absolute',left:28,right:28,top:82,display:'grid',gap:17}}>
          {[.92,.68,.84,.55,.77].map((scale,index)=><div key={index} style={{width:`${scale*100}%`,height:10,background:v3Palette.ink,opacity:.48}} />)}
        </div>
      </>
    ):null}
    {kind==='map' ? (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={`M24 ${height*.54} C${width*.17} ${height*.12} ${width*.31} ${height*.28} ${width*.44} ${height*.12} C${width*.56} ${height*.04} ${width*.65} ${height*.38} ${width*.77} ${height*.29} C${width*.9} ${height*.2} ${width*.96} ${height*.54} ${width-22} ${height*.68} C${width*.83} ${height*.94} ${width*.65} ${height*.82} ${width*.53} ${height*.93} C${width*.35} ${height*.88} ${width*.22} ${height*.95} 24 ${height*.54}Z`} fill={v3Palette.paperLight}/>
        <path d={`M56 ${height*.63} C${width*.28} ${height*.42} ${width*.48} ${height*.7} ${width*.68} ${height*.43} C${width*.8} ${height*.3} ${width*.87} ${height*.52} ${width-47} ${height*.58}`} fill="none" stroke={v3Palette.red} strokeWidth="10" strokeDasharray="15 12" />
      </svg>
    ):null}
    {kind==='claim' ? (
      <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center'}}>
        <div style={{width:150,height:150,background:v3Palette.red,clipPath:'polygon(50% 0,100% 50%,50% 100%,0 50%)',display:'grid',placeItems:'center',boxShadow:'10px 12px 0 rgba(7,18,22,.3)'}}>
          <div style={{width:54,height:54,borderRadius:'50%',border:`14px solid ${v3Palette.paperLight}`}} />
        </div>
      </div>
    ):null}
  </CardstockPieceV3>
);

const WallPinV3: React.FC<{x:number;y:number;delay:number;color?:string}> = ({x,y,delay,color=v3Palette.red}) => (
  <CardstockPieceV3 x={x-22} y={y-22} width={44} height={44} delay={delay} color={color} clipPath="circle(50% at 50% 50%)" radius="50%" thickness={4} enter="press" zIndex={70}>
    <div style={{position:'absolute',left:12,top:10,width:20,height:20,borderRadius:'50%',background:v3Palette.paperLight,boxShadow:'0 5px 0 rgba(8,20,23,.3)'}} />
  </CardstockPieceV3>
);

export const WorldEvidenceWallV3: React.FC = () => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const reveal=easeV3(frame,0,Math.round(.55*fps));
  const camera=easeV3(frame,0,Math.round(9*fps));
  const threadA=easeV3(frame,Math.round(3.8*fps),Math.round(1.35*fps));
  const threadB=easeV3(frame,Math.round(4.45*fps),Math.round(1.45*fps));
  const threadC=easeV3(frame,Math.round(5.1*fps),Math.round(1.2*fps));
  const verdict=landV3(frame,Math.round(6.5*fps),fps,Math.round(.58*fps));
  const relationshipAudit=easeV3(frame,Math.round(8*fps),Math.round(1.85*fps));
  const auditX=interpolate(relationshipAudit,[0,.2,.4,.6,.8,1],[665,934,1460,1124,1472,974]);
  const auditY=interpolate(relationshipAudit,[0,.2,.4,.6,.8,1],[368,425,330,476,682,594]);
  const auditOpacity=interpolate(relationshipAudit,[0,.04,.94,1],[0,1,1,0]);
  const edge=reveal*104;
  const clipPath=`polygon(0 0,${Math.max(0,edge-2)}% 0,${Math.min(104,edge+1)}% 17%,${Math.max(0,edge-3)}% 35%,${Math.min(104,edge+1)}% 54%,${Math.max(0,edge-2)}% 72%,${Math.min(104,edge+1)}% 100%,0 100%)`;

  return (
    <AbsoluteFill style={{background:v3Palette.wall,overflow:'hidden',clipPath}}>
      <PaperFiberV3 dark strength={.75}/>
      <div style={{position:'absolute',inset:-90,transform:`translate3d(${interpolate(camera,[0,1],[38,-28])}px,${interpolate(camera,[0,1],[18,-6])}px,0) scale(${interpolate(camera,[0,1],[1.04,1])})`,transformOrigin:'50% 50%'}}>
        <CardstockPieceV3 x={180} y={116} width={1620} height={875} delay={.05} color="#CDBB93" rotate={1.1} tiltX={3} tiltY={-7} thickness={11} enter="right" zIndex={8}>
          <HalftoneV3 color={v3Palette.ink} opacity={.075} size={12}/>
          <div style={{position:'absolute',inset:40,border:`4px solid rgba(20,40,46,.14)`,clipPath:tornV3B}}/>
        </CardstockPieceV3>

        <CardstockPieceV3 x={260} y={225} width={550} height={505} delay={.2} color={v3Palette.paperLight} rotate={-5.5} tiltX={2} tiltY={-8} thickness={8} enter="left" zIndex={24}>
          <div style={{position:'absolute',left:35,top:34,right:35,height:348,clipPath:tornV3B,boxShadow:'inset 0 0 0 10px rgba(255,247,227,.82),9px 12px 0 rgba(14,31,35,.27)',overflow:'hidden'}}><ProceduralPhotoCutoutV3/></div>
          <div style={{position:'absolute',left:42,bottom:47,width:225,height:15,background:v3Palette.ink,opacity:.54}}/>
          <div style={{position:'absolute',left:42,bottom:23,width:356,height:11,background:v3Palette.ink,opacity:.31}}/>
        </CardstockPieceV3>

        <EvidenceNoteV3 delay={.85} x={1275} y={198} width={390} height={258} rotate={4.2} color={v3Palette.paperLight} kind="document"/>
        <EvidenceNoteV3 delay={1.55} x={1295} y={550} width={405} height={272} rotate={-3.2} color="#E4D5B4" kind="document"/>
        <EvidenceNoteV3 delay={2.72} x={650} y={682} width={470} height={228} rotate={3.2} color={v3Palette.teal} kind="map"/>
        <EvidenceNoteV3 delay={3.15} x={845} y={282} width={335} height={335} rotate={-1} color={v3Palette.navy} kind="claim"/>

        <svg width="1920" height="1080" style={{position:'absolute',inset:0,zIndex:55,filter:'drop-shadow(0 9px 4px rgba(7,18,22,.24))'}}>
          <path d="M665 368 C790 330 865 382 934 425" fill="none" stroke={v3Palette.red} strokeWidth="12" strokeLinecap="round" strokeDasharray="520" strokeDashoffset={520*(1-threadA)}/>
          <path d="M1460 330 C1325 384 1232 435 1124 476 M635 610 C760 620 842 583 934 536" fill="none" stroke={v3Palette.red} strokeWidth="12" strokeLinecap="round" strokeDasharray="760" strokeDashoffset={760*(1-threadB)}/>
          <path d="M1472 682 C1346 653 1241 592 1110 558 M884 790 C898 696 936 622 974 594" fill="none" stroke={v3Palette.red} strokeWidth="12" strokeLinecap="round" strokeDasharray="650" strokeDashoffset={650*(1-threadC)}/>
        </svg>

        <WallPinV3 x={665} y={368} delay={3.65}/><WallPinV3 x={934} y={425} delay={4.0}/>
        <WallPinV3 x={1460} y={330} delay={4.25}/><WallPinV3 x={1124} y={476} delay={4.65}/>
        <WallPinV3 x={635} y={610} delay={4.75}/><WallPinV3 x={934} y={536} delay={5.05} color={v3Palette.yellow}/>
        <WallPinV3 x={1472} y={682} delay={5.15}/><WallPinV3 x={974} y={594} delay={5.55}/>

        <div style={{position:'absolute',left:auditX-42,top:auditY-42,width:84,height:84,borderRadius:'50%',background:v3Palette.yellow,border:`10px solid ${v3Palette.paperLight}`,color:v3Palette.ink,fontFamily:v3Font,fontSize:27,fontWeight:950,display:'grid',placeItems:'center',opacity:auditOpacity,zIndex:80,boxShadow:'0 15px 20px rgba(7,18,22,.38)',transform:`rotate(${relationshipAudit*300}deg)`}}>巡</div>

        <CardstockPieceV3 x={1435} y={88} width={340} height={150} delay={6.45} color={v3Palette.paperLight} rotate={-8} tiltX={1} tiltY={-3} thickness={5} enter="press" zIndex={82}>
          <div style={{position:'absolute',inset:17,border:`12px double ${v3Palette.red}`,color:v3Palette.red,fontFamily:v3Font,fontWeight:950,fontSize:29,letterSpacing:5,display:'grid',placeItems:'center',opacity:verdict}}>关系闭合</div>
        </CardstockPieceV3>

        <CardstockPieceV3 x={1130} y={770} width={610} height={190} delay={5.85} color={v3Palette.redDark} rotate={6.5} tiltX={-3} tiltY={-8} thickness={10} enter="rise" zIndex={88}>
          <HalftoneV3 color={v3Palette.paperLight} opacity={.16} size={9}/>
          <div style={{position:'absolute',left:54,top:45,color:v3Palette.paperLight,fontFamily:v3Font,fontSize:24,fontWeight:900,letterSpacing:3}}>前景证据条遮挡板面</div>
          <div style={{position:'absolute',left:55,right:55,top:104,height:12,background:v3Palette.paperLight,opacity:.55}}/>
        </CardstockPieceV3>
      </div>
      <SceneMarkV3 number="02" label="斜视证据墙" title="材料先落位，关系再闭合" inverse align="left"/>
    </AbsoluteFill>
  );
};
