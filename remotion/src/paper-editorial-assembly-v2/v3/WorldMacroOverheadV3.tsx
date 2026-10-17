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

const OverheadTokenV3: React.FC<{
  delay: number;
  x: number;
  y: number;
  color: string;
  label: string;
  icon: 'eye' | 'paper' | 'nodes';
  rotate: number;
}> = ({delay, x, y, color, label, icon, rotate}) => (
  <CardstockPieceV3
    x={x}
    y={y}
    width={340}
    height={165}
    delay={delay}
    color={color}
    rotate={rotate}
    thickness={7}
    enter="right"
    zIndex={28}
  >
    <HalftoneV3 color={v3Palette.paperLight} opacity={0.16} size={9} />
    <div
      style={{
        position: 'absolute',
        left: 38,
        top: 42,
        width: 94,
        height: 78,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {icon === 'eye' ? (
        <div
          style={{
            width: 86,
            height: 52,
            background: v3Palette.paperLight,
            clipPath: 'polygon(0 50%, 18% 15%, 50% 0, 82% 15%, 100% 50%, 82% 85%, 50% 100%, 18% 85%)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div style={{width: 25, height: 25, borderRadius: '50%', background: v3Palette.yellow}} />
        </div>
      ) : null}
      {icon === 'paper' ? (
        <div style={{position: 'relative', width: 88, height: 74}}>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: index * 12,
                top: index * 9,
                width: 62,
                height: 48,
                background: index === 2 ? v3Palette.paperLight : v3Palette.yellow,
                clipPath: tornV3B,
                boxShadow: '4px 5px 0 rgba(12,28,32,.28)',
              }}
            />
          ))}
        </div>
      ) : null}
      {icon === 'nodes' ? (
        <div style={{position: 'relative', width: 94, height: 78}}>
          <svg width="94" height="78"><path d="M18 18 L75 22 L51 64 Z" fill="none" stroke={v3Palette.paperLight} strokeWidth="8" /></svg>
          {[[18,18],[75,22],[51,64]].map(([left, top]) => (
            <div key={`${left}-${top}`} style={{position:'absolute',left:left-10,top:top-10,width:20,height:20,borderRadius:'50%',background:v3Palette.yellow,border:`4px solid ${v3Palette.paperLight}`}} />
          ))}
        </div>
      ) : null}
    </div>
    <div style={{position:'absolute',left:155,top:48,color:v3Palette.paperLight,fontFamily:v3Font,fontWeight:950,fontSize:34,letterSpacing:4}}>{label}</div>
    <div style={{position:'absolute',left:156,top:102,display:'flex',gap:9}}>
      {[72,44,58].map((width,index)=><div key={index} style={{width,height:8,background:v3Palette.paperLight,opacity:.52}} />)}
    </div>
  </CardstockPieceV3>
);

const TravelBeadV3: React.FC<{
  start: number;
  duration: number;
  from: [number, number];
  via: [number, number];
  to: [number, number];
  color?: string;
}> = ({start, duration, from, via, to, color = v3Palette.red}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = easeV3(frame, Math.round(start * fps), Math.round(duration * fps));
  const q = p < 0.5 ? p * 2 : (p - 0.5) * 2;
  const x = p < 0.5 ? interpolate(q,[0,1],[from[0],via[0]]) : interpolate(q,[0,1],[via[0],to[0]]);
  const y = p < 0.5 ? interpolate(q,[0,1],[from[1],via[1]]) : interpolate(q,[0,1],[via[1],to[1]]);
  const visible = p > 0 && p < 1 ? 1 : 0;
  return (
    <div style={{position:'absolute',left:x-18,top:y-18,width:36,height:36,borderRadius:'50%',background:color,border:`7px solid ${v3Palette.paperLight}`,boxShadow:'0 13px 16px rgba(7,18,22,.34)',zIndex:62,opacity:visible}} />
  );
};

export const WorldMacroOverheadV3: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const camera = easeV3(frame, 0, Math.round(8.5 * fps));
  const path = easeV3(frame, Math.round(2.55 * fps), Math.round(1.55 * fps));
  const rotateWheel = easeV3(frame, Math.round(1.75 * fps), Math.round(4.8 * fps));
  const seal = landV3(frame, Math.round(6.82 * fps), fps, Math.round(.62 * fps));
  const auditSweep = easeV3(frame, Math.round(7.4 * fps), Math.round(2.05 * fps));
  const auditOpacity = interpolate(auditSweep,[0,.08,.88,1],[0,.78,.78,0]);

  return (
    <AbsoluteFill style={{background:'#A99D82',overflow:'hidden'}}>
      <PaperFiberV3 strength={1.2} />
      <div
        style={{
          position:'absolute',
          inset:-54,
          transform:`scale(${interpolate(camera,[0,1],[1.075,1.0])}) rotate(${interpolate(camera,[0,1],[-.8,.2])}deg)`,
          transformOrigin:'50% 50%',
        }}
      >
        <CardstockPieceV3 x={165} y={123} width={1640} height={875} delay={0.18} color={v3Palette.paper} rotate={-.6} thickness={9} enter="drop" zIndex={5}>
          <div style={{position:'absolute',inset:42,border:`3px dashed rgba(20,40,46,.18)`,clipPath:tornV3B}} />
        </CardstockPieceV3>

        <CardstockPieceV3 x={115} y={260} width={450} height={145} delay={0.6} color={v3Palette.red} rotate={-5} thickness={6} enter="left" zIndex={16}>
          <HalftoneV3 color={v3Palette.paperLight} opacity={.18} size={10} />
          <div style={{position:'absolute',left:48,top:45,display:'flex',gap:12,alignItems:'center'}}>
            {[28,54,80,44,94,61,35,72,48].map((height,index)=><div key={index} style={{width:10,height,background:v3Palette.paperLight,borderRadius:8}} />)}
          </div>
        </CardstockPieceV3>

        <svg width="1920" height="1080" style={{position:'absolute',inset:0,zIndex:20}}>
          <path d="M490 330 C650 345 690 426 785 516" fill="none" stroke={v3Palette.red} strokeWidth="30" strokeLinecap="round" strokeDasharray="470" strokeDashoffset={470*(1-path)} />
          <path d="M1010 508 C1155 430 1240 338 1390 295 M1010 535 C1205 535 1310 535 1450 538 M1000 567 C1135 662 1192 765 1320 820" fill="none" stroke={v3Palette.ink} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="820" strokeDashoffset={820*(1-path)} />
        </svg>

        <CardstockPieceV3 x={735} y={304} width={420} height={420} delay={1.35} color={v3Palette.navy} clipPath="circle(50% at 50% 50%)" radius="50%" rotate={0} thickness={10} enter="press" zIndex={32}>
          <HalftoneV3 color={v3Palette.paperLight} opacity={.18} size={11} />
          <div style={{position:'absolute',left:70,top:70,width:280,height:280,borderRadius:'50%',background:v3Palette.paperLight,boxShadow:'inset 0 0 0 15px rgba(20,40,46,.13),0 13px 0 rgba(9,23,28,.28)',transform:`rotate(${rotateWheel*72}deg)`}}>
            {[0,1,2].map(index=><div key={index} style={{position:'absolute',left:120,top:-28,width:40,height:92,background:index===1?v3Palette.yellow:v3Palette.red,transformOrigin:'20px 168px',transform:`rotate(${index*120}deg)`,clipPath:tornV3B,boxShadow:'5px 7px 0 rgba(10,26,31,.25)'}} />)}
            <div style={{position:'absolute',left:92,top:92,width:96,height:96,borderRadius:'50%',background:v3Palette.red,display:'grid',placeItems:'center',color:v3Palette.paperLight,fontFamily:v3Font,fontSize:44,fontWeight:950}}>×3</div>
          </div>
        </CardstockPieceV3>

        <OverheadTokenV3 delay={3.05} x={1300} y={206} color={v3Palette.navy} label="镜头" icon="eye" rotate={-5} />
        <OverheadTokenV3 delay={3.82} x={1405} y={455} color={v3Palette.teal} label="证据" icon="paper" rotate={1.8} />
        <OverheadTokenV3 delay={4.62} x={1225} y={748} color={v3Palette.redDark} label="关系" icon="nodes" rotate={5.2} />

        <TravelBeadV3 start={5.15} duration={1.0} from={[995,520]} via={[1198,398]} to={[1390,295]} />
        <TravelBeadV3 start={5.48} duration={1.02} from={[1005,540]} via={[1235,536]} to={[1450,538]} color={v3Palette.yellow} />
        <TravelBeadV3 start={5.8} duration={1.04} from={[995,560]} via={[1134,676]} to={[1320,820]} />

        <div style={{position:'absolute',left:684,top:256,width:526,height:526,borderRadius:'50%',border:`18px double ${v3Palette.red}`,opacity:seal,transform:`scale(${interpolate(seal,[0,1],[1.28,1])}) rotate(-6deg)`,zIndex:58,boxShadow:'0 18px 26px rgba(8,20,23,.2)'}} />
        <div style={{position:'absolute',left:748,top:760,opacity:seal,transform:`translateY(${interpolate(seal,[0,1],[-50,0])}px) rotate(-2deg)`,zIndex:65,background:v3Palette.paperLight,color:v3Palette.ink,fontFamily:v3Font,fontSize:23,fontWeight:900,letterSpacing:4,padding:'12px 22px',clipPath:tornV3A,boxShadow:'8px 10px 0 rgba(15,35,40,.23)'}}>信号完成三路装配</div>

        <div style={{position:'absolute',left:657,top:229,width:580,height:580,borderRadius:'50%',border:`15px dashed ${v3Palette.yellow}`,opacity:auditOpacity,transform:`rotate(${interpolate(auditSweep,[0,1],[-20,310])}deg)`,zIndex:67,filter:'drop-shadow(0 12px 10px rgba(7,18,22,.24))'}} />
        <CardstockPieceV3 x={1540} y={325} width={230} height={82} delay={7.45} color={v3Palette.paperLight} rotate={-4} thickness={5} enter="press" zIndex={70}>
          <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontFamily:v3Font,fontSize:24,fontWeight:950,color:v3Palette.ink}}>✓ 镜头复核</div>
        </CardstockPieceV3>
        <CardstockPieceV3 x={1570} y={590} width={230} height={82} delay={8.15} color={v3Palette.yellow} rotate={3} thickness={5} enter="press" zIndex={70}>
          <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontFamily:v3Font,fontSize:24,fontWeight:950,color:v3Palette.ink}}>✓ 证据复核</div>
        </CardstockPieceV3>
        <CardstockPieceV3 x={1450} y={900} width={250} height={82} delay={8.85} color={v3Palette.paperLight} rotate={-2} thickness={5} enter="press" zIndex={70}>
          <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',fontFamily:v3Font,fontSize:24,fontWeight:950,color:v3Palette.ink}}>✓ 关系复核</div>
        </CardstockPieceV3>
      </div>
      <SceneMarkV3 number="01" label="宏观俯拍装配" title="一句话被拆成三条视觉任务" />
    </AbsoluteFill>
  );
};
