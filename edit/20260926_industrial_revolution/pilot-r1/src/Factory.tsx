import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';

export const Factory: React.FC<{frame: number}> = ({frame}) => {
  const t = frame / 30;
  const scale = 1.025 + t * 0.012;
  return <AbsoluteFill style={{background: '#080d11', overflow: 'hidden'}}>
    <Img src={staticFile('factory-r1.png')} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${-t*3}px, ${t*1.1}px) scale(${scale})`, transformOrigin: '65% 46%'}}/>
    <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(2,8,14,.52) 0%, transparent 56%), linear-gradient(0deg, rgba(2,5,8,.94), transparent 38%)'}}/>
    <svg width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="factoryGlow"><stop stopColor="#fbd4a2" stopOpacity=".20"/><stop offset="1" stopColor="#d6a063" stopOpacity="0"/></radialGradient>
        <linearGradient id="factoryWire"><stop stopColor="#bd8046" stopOpacity="0"/><stop offset=".6" stopColor="#d4ad77" stopOpacity=".38"/><stop offset="1" stopColor="#fcddb2" stopOpacity=".8"/></linearGradient>
      </defs>
      <ellipse cx={1260} cy={480} rx={450} ry={340} fill="url(#factoryGlow)" opacity={0.45 + Math.sin(t * 0.9) * 0.12}/>
      {Array.from({length: 48}, (_, i) => {
        const x = (i * 359.7 + t * (5 + i % 5)) % 2100 - 90;
        const y = (i * 137.4 - t * (6 + i % 4) + 1100) % 900;
        return <circle key={i} cx={x} cy={y} r={i % 7 === 0 ? 2.1 : 0.9} fill="#e3c198" opacity={0.07 + (i % 4) * .04}/>;
      })}
      <path d="M 1970 552 C 1730 552 1640 640 1470 640 C 1270 640 1170 570 1090 477" stroke="url(#factoryWire)" strokeWidth="2" fill="none" pathLength="1" strokeDasharray="1" strokeDashoffset={1-Math.max(0,Math.min(1,(t-3.9)/1.55))}/>
    </svg>
  </AbsoluteFill>;
};
