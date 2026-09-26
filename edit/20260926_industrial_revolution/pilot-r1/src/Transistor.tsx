import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';

export const Transistor:React.FC<{frame:number}> = ({frame}) => {
  const t=frame/30;
  const dive=Math.max(0,Math.min(1,(t-5.65)/1.4));
  const eased=dive*dive*(3-2*dive);
  return <AbsoluteFill style={{overflow:'hidden',background:'#080d11'}}>
    <Img src={staticFile('transistor-r1.png')} style={{width:'100%',height:'100%',objectFit:'cover',transform:`scale(${1.04+t*.018+eased*.17}) translateY(${-eased*20}px)`,transformOrigin:'67% 45%'}}/>
    <AbsoluteFill style={{background:'linear-gradient(90deg,rgba(2,8,14,.55),transparent 59%),linear-gradient(0deg,rgba(2,6,10,.96),transparent 50%)'}}/>
    <svg width="1920" height="1080" style={{position:'absolute',inset:0}}>
      <defs><radialGradient id="contact-light"><stop stopColor="#f5d29d" stopOpacity=".16"/><stop offset="1" stopColor="#d39b5c" stopOpacity="0"/></radialGradient></defs>
      <ellipse cx={1280} cy={447} rx={170+t*12} ry={130+t*6} fill="url(#contact-light)" opacity={.6+Math.sin(t*1.4)*.2}/>
      {Array.from({length:26},(_,i)=><circle key={i} cx={(i*389+t*(i%4+4))%1900} cy={(i*173-t*9+1080)%820} r={i%3===0?1.5:.8} fill="#e6c58f" opacity={.1+i%3*.025}/>)}
    </svg>
  </AbsoluteFill>;
};
