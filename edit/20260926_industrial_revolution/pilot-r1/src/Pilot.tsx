import React from 'react';
import {AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {Factory} from './Factory';
import {Transistor} from './Transistor';
import {Microelectronics} from './Microelectronics';
import {Network} from './Network';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = (f:number, a:number, b:number) => interpolate(f,[a,b],[0,1],{...clamp,easing:Easing.inOut(Easing.cubic)});
const envelope = (f:number,a:number,b:number) => Math.min(ease(f,a,a+13),1-ease(f,b-12,b));
const SERIF = '"Songti SC", "STSong", serif';
const SANS = '"PingFang SC", "Heiti SC", sans-serif';

const Caption: React.FC<{frame:number; start:number; end:number; title:string; line:string; source:string}> = ({frame,start,end,title,line,source}) => {
  const o = envelope(frame,start,end);
  return <div style={{position:'absolute',left:112,bottom:92,opacity:o,transform:`translateY(${(1-ease(frame,start,start+22))*18}px)`,color:'#f2e5d2'}}>
    <div style={{height:1,width:70,background:'#cda46d',marginBottom:22}}/>
    <div style={{fontFamily:SERIF,fontSize:52,fontWeight:600,letterSpacing:3,textShadow:'0 3px 20px #000'}}>{title}</div>
    <div style={{fontFamily:SANS,fontSize:25,letterSpacing:3,color:'#c5c1b8',marginTop:15}}>{line}</div>
    <div style={{fontFamily:SANS,fontSize:16,letterSpacing:1,color:'#949a9b',marginTop:24}}>{source}</div>
  </div>;
};

export const Pilot:React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const first = 170;
  const second = 649;
  const stage = f < first ? 0 : f < second ? 1 : 2;
  const era = f < first ? '电气时代' : '数字时代';
  const year = f < first ? '19世纪末' : f < 382 ? '1947' : f < 534 ? '1958' : f < second ? '此后' : '1989';
  const collapse = ease(f,627,649);
  return <AbsoluteFill style={{background:'#070d13',fontFamily:SANS,overflow:'hidden'}}>
    <Audio src={staticFile('music-pilot.wav')}/>
    {f < first && <Factory frame={f}/>}
    {f >= first && f < second && <AbsoluteFill style={{transform:`scale(${1-collapse*.97})`,transformOrigin:'58.85% 36.4%',opacity:1-collapse*.35}}><Microelectronics frame={f-first} fps={fps} illustrateContact={false}/></AbsoluteFill>}
    {f >= first && f < 400 && <AbsoluteFill style={{opacity:1-ease(f,378,400)}}><Transistor frame={f-first}/></AbsoluteFill>}
    {f >= second && <Network frame={f-second} fps={fps}/>}
    {f>627 && f<649 && <svg width="1920" height="1080" style={{position:'absolute',inset:0}}><defs><radialGradient id="gather-light"><stop stopColor="#f4d49c"/><stop offset=".2" stopColor="#dfb46d" stopOpacity=".5"/><stop offset="1" stopColor="#caa574" stopOpacity="0"/></radialGradient></defs><circle cx="1130" cy="393" r={20+collapse*48} fill="url(#gather-light)" opacity={collapse}/></svg>}
    <AbsoluteFill style={{pointerEvents:'none',background:'radial-gradient(ellipse at 61% 43%, transparent 25%, rgba(0,3,7,.38) 98%), linear-gradient(0deg, rgba(2,6,10,.94), rgba(2,6,10,.15) 28%, transparent 43%)'}}/>
    <div style={{position:'absolute',top:61,left:112,color:'#b5b4af',fontSize:18,letterSpacing:6}}>工业革命</div>
    <div style={{position:'absolute',top:55,right:110,color:'#a7aaa7',fontSize:16,letterSpacing:2}}>{stage === 0 ? '历史场景艺术重构' : stage === 2 ? '信息连接示意' : f<382 ? '早期晶体管艺术示意' : f<534 ? '元件集成关系示意' : '后续技术演进示意'}</div>
    <div style={{position:'absolute',top:169,left:110,color:'#ddd2c1'}}>
      <div style={{fontFamily:SERIF,fontSize:28,letterSpacing:7,color:'#c69c68'}}>{era}</div>
      <div style={{fontFamily:SERIF,fontSize:year.length>5?64:91,lineHeight:1.1,letterSpacing:2,marginTop:14}}>{year}</div>
      <div style={{width:44,height:1,background:'#ac895b',marginTop:28}}/>
    </div>
    <Caption frame={f} start={0} end={161} title="电力，走进工厂" line="电动机逐步成为工业动力。" source="历史背景：电气化的发展"/>
    <Caption frame={f} start={187} end={374} title="晶体管诞生" line="推动电子器件微型化。" source="史实来源：贝尔实验室"/>
    <Caption frame={f} start={390} end={534} title="集成电路原型" line="把多个电子元件，集成在同一块半导体上。" source="史实来源：计算机历史博物馆"/>
    <Caption frame={f} start={534} end={646} title="电路越来越密集" line="电子计算，进入芯片时代。" source="后续发展示意"/>
    <Caption frame={f} start={658} end={840} title="万维网构想提出" line="让信息，沿着链接流动。" source="史实来源：欧洲核子研究中心"/>
    {[first,second].map((hit) => {
      const d=f-hit;
      if(d < -9 || d>16) return null;
      const opacity = d<0 ? (d+9)/9*.22 : Math.exp(-d/4)*.45;
      return <AbsoluteFill key={hit} style={{background:'radial-gradient(ellipse at 63% 43%, rgba(235,190,123,.45), rgba(28,54,57,.15) 35%, transparent 65%)',opacity,pointerEvents:'none'}}/>;
    })}
    <AbsoluteFill style={{pointerEvents:'none',opacity:1-ease(f,0,10),background:'#070d13'}}/>
    <AbsoluteFill style={{pointerEvents:'none',opacity:ease(f,827,839),background:'#070d13'}}/>
  </AbsoluteFill>;
};
