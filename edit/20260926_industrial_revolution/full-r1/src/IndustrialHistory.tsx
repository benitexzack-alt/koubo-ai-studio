import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {Factory} from '../../pilot-r1/src/Factory';
import {Transistor} from '../../pilot-r1/src/Transistor';
import {Microelectronics} from '../../pilot-r1/src/Microelectronics';
import {Network} from '../../pilot-r1/src/Network';
import {SteamMechanism} from './SteamMechanism';
import {IndustrialMotifs} from './IndustrialMotifs';
import {Frontier} from './Frontier';
import {timeline, beatCues} from './timeline';

const C={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const ease=(f:number,a:number,b:number)=>interpolate(f,[a,b],[0,1],{...C,easing:Easing.inOut(Easing.cubic)});
const SERIF='"Songti SC", "STSong", serif';
const SANS='"PingFang SC", "Heiti SC", sans-serif';

const Plate:React.FC<{name:string;frame:number;direction?:number}>=({name,frame,direction=1})=>{
  const t=frame/30;
  return <AbsoluteFill style={{overflow:'hidden',background:'#070d13'}}>
    <Img src={staticFile(`${name}.png`)} style={{width:'100%',height:'100%',objectFit:'cover',transform:`scale(${1.035+t*.007}) translate(${direction*-t*1.6}px,${t*.65}px)`,transformOrigin:'65% 43%'}}/>
    <AbsoluteFill style={{background:'linear-gradient(90deg,rgba(2,8,14,.48),transparent 55%),linear-gradient(0deg,rgba(2,6,10,.90),transparent 43%)'}}/>
    <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
      {Array.from({length:44},(_,i)=><circle key={i} cx={(i*397.7+t*(4+i%5))%2070-70} cy={(i*163.4-t*(4+i%7)+2000)%990} r={i%9===0?1.8:.7} fill="#ead2a7" opacity={.07+i%4*.025}/>)}
    </svg>
  </AbsoluteFill>;
};

const ResearchLinks:React.FC<{frame:number}>=({frame})=>{
  const t=frame/30;
  const nodes=Array.from({length:12},(_,i)=>({x:840+(i%4)*180+Math.sin(i*2)*24,y:235+Math.floor(i/4)*155}));
  return <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
    <defs><filter id="research-glow"><feGaussianBlur stdDeviation="3"/></filter></defs>
    {nodes.slice(0,-1).map((p,i)=>{
      const q=nodes[i+1],o=ease(frame,i*9,i*9+38),u=(t*.25+i*.17)%1;
      const cx=(p.x+q.x)/2+20,cy=p.y-25;
      return <g key={i} opacity={o*.65}>
        <path d={`M${p.x},${p.y} Q${(p.x+q.x)/2+20},${p.y-25} ${q.x},${q.y}`} fill="none" stroke={i%3?'#ca9b64':'#68b6c0'} strokeWidth="1.4"/>
        <circle cx={(1-u)**2*p.x+2*(1-u)*u*cx+u*u*q.x} cy={(1-u)**2*p.y+2*(1-u)*u*cy+u*u*q.y} r="3" fill="#f0d7a8"/>
      </g>;
    })}
    {nodes.map((p,i)=><g key={i} opacity={ease(frame,i*7,i*7+22)}><circle {...{cx:p.x,cy:p.y}} r="13" fill="#67b7bd" opacity=".35" filter="url(#research-glow)"/><circle cx={p.x} cy={p.y} r="3.4" fill="#e6cd9b"/></g>)}
  </svg>;
};

const Outro:React.FC<{frame:number}>=({frame})=>{
  const marks=[{x:335,title:'蒸汽',sub:'机械化',year:'第一次'},{x:750,title:'电力',sub:'规模化',year:'第二次'},{x:1165,title:'数字',sub:'信息化',year:'第三次'},{x:1580,title:'智能',sub:'融合与探索',year:'第四次'}];
  return <AbsoluteFill style={{background:'radial-gradient(ellipse at 60% 43%,#172830 0%,#070d13 68%)',color:'#edddc5'}}>
    <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
      <defs><linearGradient id="outro-line" gradientUnits="userSpaceOnUse" x1="335" y1="510" x2="1580" y2="510"><stop stopColor="#9b673e"/><stop offset=".7" stopColor="#d9b27d"/><stop offset="1" stopColor="#74b7bc"/></linearGradient></defs>
      <path d="M335 510 H1580" stroke="url(#outro-line)" strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset={1-ease(frame,0,85)} />
      {marks.map((m,i)=><g key={m.x} opacity={ease(frame,i*14,i*14+22)}>
        <circle cx={m.x} cy="510" r="47" fill="#0c161b" stroke={i===3?'#79b4b4':'#bb8d59'} strokeWidth="1.3"/>
        <circle cx={m.x} cy="510" r={10+Math.sin(frame/30+i)*1.5} fill={i===3?'#81c2c5':'#d7a66a'}/>
      </g>)}
    </svg>
    <div style={{position:'absolute',top:174,left:0,right:0,textAlign:'center',fontFamily:SERIF,fontSize:64,letterSpacing:9,opacity:ease(frame,8,38)}}>工业革命，仍在继续</div>
    {marks.map((m,i)=><div key={m.x} style={{position:'absolute',left:m.x-135,width:270,top:592,textAlign:'center',opacity:ease(frame,i*14+8,i*14+36)}}>
      <div style={{fontFamily:SERIF,fontSize:38,letterSpacing:6}}>{m.title}</div>
      <div style={{fontSize:20,letterSpacing:4,color:'#bdb4a7',marginTop:18}}>{m.sub}</div>
      <div style={{fontSize:16,color:'#8f918c',marginTop:16,letterSpacing:3}}>{m.year}</div>
    </div>)}
    <div style={{position:'absolute',bottom:105,left:0,right:0,textAlign:'center',fontSize:21,letterSpacing:4,color:'#b9b9ae',opacity:ease(frame,58,90)}}>已有的成就，与尚未完成的未来。</div>
    <div style={{position:'absolute',bottom:49,left:0,right:0,textAlign:'center',fontSize:15,letterSpacing:1,color:'#7c8c90',opacity:ease(frame,58,90)}}>时代划分为叙事框架；量子计算与聚变为探索中的前沿。场景由人工智能与程序动画构建。</div>
  </AbsoluteFill>;
};

export const IndustrialHistory:React.FC=()=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig();
  const row=timeline.find(s=>f>=s.start && f<s.end);
  const collapse=ease(f,2787,2809);
  const titleOpacity=ease(f,24,64)*(1-ease(f,228,272));
  const captionIn=row?row.start+(row.start===0?290:14):0;
  const captionOpacity=row?Math.min(ease(f,captionIn,captionIn+19),1-ease(f,row.end-12,row.end)):0;
  return <AbsoluteFill style={{background:'#070d13',overflow:'hidden',fontFamily:SANS}}>
    <Audio src={staticFile('music-full.wav')}/>
    {f<513 && <Plate name="preindustrial" frame={f}/>}
    {f>=513 && f<864 && <SteamMechanism frame={f-513} fps={fps}/>}
    {f>=864 && f<1215 && <Plate name="steam-mill" frame={f-864}/>}
    {f>=1215 && f<1492 && <Plate name="railway" frame={f-1215} direction={-1}/>}
    {f>=1492 && f<1892 && <IndustrialMotifs frame={f-1492} fps={fps} mode="electricity"/>}
    {f>=1892 && f<2160 && <IndustrialMotifs frame={f-1892} fps={fps} mode="assembly"/>}
    {f>=2160 && f<2330 && <Factory frame={f-2160}/>}
    {f>=2330 && f<2809 && <AbsoluteFill style={{transform:`scale(${1-collapse*.97})`,transformOrigin:'58.85% 36.4%',opacity:1-collapse*.35}}><Microelectronics frame={f-2330} fps={fps} illustrateContact={false}/></AbsoluteFill>}
    {f>=2330 && f<2560 && <AbsoluteFill style={{opacity:1-ease(f,2538,2560)}}><Transistor frame={f-2330}/></AbsoluteFill>}
    {f>=2809 && f<3383 && <Network frame={f-2809} fps={fps}/>}
    {f>2787 && f<2809 && <svg width="1920" height="1080" style={{position:'absolute',inset:0}}><defs><radialGradient id="gather"><stop stopColor="#f4d49c"/><stop offset="1" stopColor="#caa574" stopOpacity="0"/></radialGradient></defs><circle cx="1130" cy="393" r={20+collapse*48} fill="url(#gather)" opacity={collapse}/></svg>}
    {f>=3383 && f<3705 && <Plate name="ai-lab" frame={f-3383}/>}
    {f>=3705 && f<4139 && <Frontier mode="ai" frame={f-3705} fps={fps}/>}
    {f>=4139 && f<4403 && <><Plate name="ai-lab" frame={f-4139+270} direction={-1}/><ResearchLinks frame={f-4139}/></>}
    {f>=4403 && f<4531 && <Plate name="quantum-fridge" frame={f-4403}/>}
    {f>=4531 && f<4755 && <Frontier mode="quantum" frame={f-4531} fps={fps}/>}
    {f>=4755 && f<5187 && <Frontier mode="fusion" frame={f-4755} fps={fps}/>}
    {f>=4755 && f<4803 && <AbsoluteFill style={{opacity:1-ease(f,4762,4803)}}><Plate name="fusion-chamber" frame={f-4755}/></AbsoluteFill>}
    {f<5187 && <AbsoluteFill style={{pointerEvents:'none',background:'radial-gradient(ellipse at 61% 43%, transparent 25%, rgba(0,3,7,.38) 98%),linear-gradient(0deg,rgba(2,6,10,.94),rgba(2,6,10,.10) 28%,transparent 43%)'}}/>}
    {row && <>
      <div style={{position:'absolute',top:61,left:112,color:'#b5b4af',fontSize:18,letterSpacing:6}}>工业革命</div>
      <div style={{position:'absolute',top:45,right:98,padding:'9px 12px',borderRadius:3,background:'rgba(4,10,15,.72)',color:'#c0c3bf',fontSize:16,letterSpacing:1.5,textShadow:'0 1px 3px #000'}}>{row.label}</div>
      {f>272 && <div style={{position:'absolute',top:169,left:110,color:'#ddd2c1',opacity:ease(f,row.start===0?272:row.start,row.start===0?298:row.start+15)}}>
        <div style={{fontFamily:SERIF,fontSize:27,letterSpacing:5,color:'#c69c68'}}>{row.era}</div>
        <div style={{fontFamily:SERIF,fontSize:row.year.length>5?57:row.year.length===4&&/^\d/.test(row.year)?91:64,lineHeight:1.1,letterSpacing:2,marginTop:14}}>{row.year}</div>
        <div style={{width:44,height:1,background:'#ac895b',marginTop:28}}/>
      </div>}
      <div style={{position:'absolute',left:112,bottom:92,opacity:captionOpacity,transform:`translateY(${(1-ease(f,captionIn,captionIn+22))*18}px)`,color:'#f2e5d2'}}>
        <div style={{height:1,width:70,background:'#cda46d',marginBottom:22}}/>
        <div style={{fontFamily:SERIF,fontSize:52,fontWeight:600,letterSpacing:3,textShadow:'0 3px 20px #000'}}>{row.title}</div>
        <div style={{fontFamily:SANS,fontSize:25,letterSpacing:2.5,color:'#c5c1b8',marginTop:15}}>{row.line}</div>
        <div style={{fontFamily:SANS,fontSize:17,letterSpacing:.8,color:'#949a9b',marginTop:24}}>{row.source}</div>
      </div>
    </>}
    {f<272 && <div style={{position:'absolute',left:110,top:240,opacity:titleOpacity,color:'#edddc5',transform:`translateY(${(1-ease(f,20,94))*24}px)`}}>
      <div style={{fontSize:20,letterSpacing:10,color:'#c39866',marginBottom:35}}>四次变革 · 一段未完的历史</div>
      <div style={{fontFamily:SERIF,fontSize:108,fontWeight:600,letterSpacing:12,lineHeight:1.15}}>工业革命</div>
      <div style={{fontFamily:SERIF,fontSize:39,letterSpacing:9,marginTop:36,color:'#d0c7b6'}}>从蒸汽到智能</div>
      <div style={{width:84,height:2,background:'#b88b55',marginTop:43}}/>
    </div>}
    {beatCues.map(hit=>{const d=f-hit;if(d<0||d>14)return null;return <AbsoluteFill key={hit} style={{background:'radial-gradient(ellipse at 63% 43%,rgba(235,190,123,.42),rgba(28,54,57,.1) 35%,transparent 65%)',opacity:Math.exp(-d/4)*.35,pointerEvents:'none'}}/>;})}
    {f>=5187 && <Outro frame={f-5187}/>}
    <AbsoluteFill style={{background:'#070d13',opacity:1-ease(f,0,16),pointerEvents:'none'}}/>
    <AbsoluteFill style={{background:'#070d13',opacity:ease(f,5370,5411),pointerEvents:'none'}}/>
  </AbsoluteFill>;
};
