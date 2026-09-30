import React from 'react';
import {AbsoluteFill, Composition, Easing, Img, interpolate, OffthreadVideo, registerRoot, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {AdaptiveBilingualCaptionOverlay} from '../components/AdaptiveBilingualCaptionOverlay';
import {LocalFont} from '../components/LocalFont';
import {EpisodeSemanticOverlay} from './semantic/EpisodeSemanticOverlay';
import anchors from './runtime/anchors.r1.json';
import selection from './runtime/shotcraft-selection.r2.json';

const FPS=30,DURATION=12286;
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const F=(t:number)=>Math.round(t*FPS);
const cameraAt=(frame:number)=>{
 const i=anchors.beats.findIndex(b=>frame>=F(b.startSeconds)&&frame<F(b.endSeconds));
 if(i<0)return {scale:1.012,x:0,y:0};
 const b=anchors.beats[i],p=(frame-F(b.startSeconds))/Math.max(1,F(b.endSeconds-b.startSeconds));
 const accent=Math.min(.32,Math.max(.16,1.45/(b.endSeconds-b.startSeconds))),settle=Math.max(accent+.18,.76);
 const n=p<=accent?interpolate(p,[0,accent],[0,1],{...clamp,easing:Easing.out(Easing.cubic)}):p<=settle?interpolate(p,[accent,settle],[1,.72],{...clamp,easing:Easing.inOut(Easing.cubic)}):interpolate(p,[settle,1],[.72,0],{...clamp,easing:Easing.inOut(Easing.cubic)});
 return {scale:1.012+([1.065,1.075,1.07,1.08][i%4]-1.012)*n,x:[-12,14,-16,12][i%4]*n,y:2*n};
};
const imageStyle={width:'100%',height:'100%',objectFit:'contain'} as const;
const Picture:React.FC<{file:string;style?:React.CSSProperties}>=({file,style})=><Img src={staticFile(`media/${file}`)} style={{...imageStyle,...style}}/>;
const Label:React.FC<{children:React.ReactNode}>=({children})=><div style={{fontSize:40,fontWeight:800,color:'#ffca8c',marginTop:25}}>{children}</div>;
const Evidence:React.FC<{id:string;sourceStart:number;duration:number}>=({id,sourceStart,duration})=>{
 const f=useCurrentFrame(),enter=interpolate(f,[0,9],[0,1],clamp);
 const headers:Record<string,string>={R01:'Meta 2026 年第二季度财报',R02:'Muse · 个人 AI 助理',R03:'云端浏览器 · 购买前确认',R04:'2026 年 9 月 21 日的市场报道',R05:'助理促成交易：小额收费计划',R06:'豆包手机助手 · 系统级协作',R07:'千问 · 接入现有服务',R08:'千问与淘宝 · 购物和订单互通'};
 const source:Record<string,string>={R01:'来源：Meta 投资者关系 · 2026.07.29 · 财报第 1、9 页',R02:'来源：Meta 官方发布演示 · 2026.09 · 非本人实测',R03:'来源：Meta 官方发布演示 · 2026.09 · 非本人实测',R04:'来源：Yahoo Finance · Daniel Howley · 2026.09.21',R05:'来源：Yahoo Finance · Daniel Howley · 2026.09.24',R06:'来源：中兴通讯 · 2026.09.16 · 厂商能力介绍',R07:'来源：阿里巴巴集团 · 2026.01.15 · 原页节选',R08:'来源：阿里巴巴集团 · 官方产品演示图 · 非当前商品报价'};
 return <AbsoluteFill style={{background:'#101923'}}>
  <div style={{position:'absolute',left:60,top:590,width:330,height:285,overflow:'hidden',borderRadius:22,boxShadow:'0 8px 28px #0008'}}><OffthreadVideo src={staticFile('media/host.mp4')} startFrom={sourceStart} muted style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'60% 38%'}}/></div>
  <div style={{position:'absolute',left:450,top:115,width:1380,height:760,opacity:enter,transform:`translateY(${16*(1-enter)}px)`}}>
   <div style={{fontSize:44,fontWeight:800,marginBottom:22}}>{headers[id]}</div>
   <div style={{position:'relative',height:620,width:1380,overflow:'hidden'}}>
    {id==='R01'&&(f<F(3.86)?<><div style={{height:395,width:1340}}><Picture file="meta-revenue-table.png"/></div><Label>广告收入占总收入约 97.6% ≈ 98%</Label><div style={{fontSize:30,marginTop:15}}>59,363 ÷ 60,801 · 同期财报口径</div></>:<><div style={{position:'relative',height:320,overflow:'hidden',background:'#fff',borderRadius:12}}><Img src={staticFile('media/meta-dap-excerpt.png')} style={{position:'absolute',width:1340,left:20,top:-180}}/></div><Label>应用家族日活：2026 年 6 月平均 36 亿</Label><div style={{fontSize:30,marginTop:18}}>不是 Muse 用户数，也不是同时在线人数。</div></>)}
    {id==='R02'&&<OffthreadVideo src={staticFile('media/muse-intro.mp4')} startFrom={F(.8)} muted style={imageStyle}/>}
    {id==='R03'&&(f<F(2.7)?<OffthreadVideo src={staticFile('media/muse-intro.mp4')} startFrom={F(36)} muted style={imageStyle}/>:<Sequence from={F(2.7)} durationInFrames={duration-F(2.7)} premountFor={15}><OffthreadVideo src={staticFile('media/muse-shopping.mp4')} startFrom={F(15)} muted style={imageStyle}/></Sequence>)}
    {(id==='R04'||id==='R05')&&<><div style={{position:'absolute',left:45,top:35,width:1220,height:244}}><Picture file={id==='R04'?'stock-header.png':'fee-header.png'}/></div><div style={{position:'absolute',left:45,top:290,width:1050,height:120}}><Picture file={id==='R04'?'stock-byline.png':'fee-byline.png'}/></div><div style={{position:'absolute',left:50,top:460,fontSize:40,fontWeight:750,color:'#ffcc94'}}>{id==='R04'?'约 11% · 当日报道涨幅':'计划收费 · 不是已经全面实施'}</div><div style={{position:'absolute',left:50,top:535,fontSize:29,color:'#bccddb'}}>{id==='R04'?'报道同时提及评级调整，不能只归因为助理发布。':'报道引述未来商业化安排，具体实施仍以正式规则为准。'}</div></>}
    {id==='R06'&&<Picture file="doubao.png"/>}
    {id==='R07'&&<><div style={{position:'absolute',left:0,top:0,width:1380,height:410,background:'#fff',overflow:'hidden'}}><Img src={staticFile('media/qwen-ecosystem.png')} style={{position:'absolute',width:1720,left:-220,top:-95}}/></div><div style={{position:'absolute',left:40,top:445,fontSize:29,color:'#b6c6d7'}}>官方原文列举的服务</div><div style={{position:'absolute',left:40,top:498,fontSize:36,fontWeight:800,color:'#ffcc94'}}>淘宝 · 淘宝闪购 · 支付宝 · 飞猪 · 高德</div></>}
    {id==='R08'&&<Picture file="qwen-taobao.png"/>}
   </div>
   <div style={{position:'absolute',left:0,top:722,fontSize:24,color:'#b6c6d7'}}>{source[id]}</div>
  </div>
 </AbsoluteFill>;
};
const Preview=()=>{
 const frame=useCurrentFrame(),c=cameraAt(frame);
 return <AbsoluteFill style={{backgroundColor:'#101923',fontFamily:'"Koubo Heiti", "PingFang SC", sans-serif',color:'white'}}>
  <LocalFont/>
  <AbsoluteFill style={{transform:`translate3d(${c.x}px,${c.y}px,0) scale(${c.scale})`,transformOrigin:'56% 37%'}}><OffthreadVideo src={staticFile('media/host.mp4')} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/></AbsoluteFill>
  {anchors.beats.filter(b=>b.routeCueId&&['paper-editorial','ai-generated-video'].includes(b.primaryRoute)).map(b=>{const start=F(b.insertStartSeconds!),dur=F(b.insertDurationSeconds!);return <Sequence key={b.beatId} from={start} durationInFrames={dur} premountFor={15}><AbsoluteFill style={{background:'#0c1d2b'}}/><OffthreadVideo src={staticFile(`media/${b.routeCueId}.mp4`)} muted style={{position:'absolute',top:30,width:'100%',height:875,objectFit:'contain'}}/><div style={{position:'absolute',right:55,top:45,fontSize:24,color:'#efe8db',textShadow:'0 2px 6px #000'}}>AI生成 · {b.primaryRoute==='paper-editorial'?'纸艺示意':'情景示意'}</div></Sequence>;})}
  {anchors.beats.filter(b=>b.primaryRoute==='real-evidence').map(b=>{const start=F(b.startSeconds),dur=F(b.endSeconds)-start;return <Sequence key={b.beatId} from={start} durationInFrames={dur} premountFor={15}><Evidence id={b.routeCueId!} sourceStart={start} duration={dur}/></Sequence>;})}
  <EpisodeSemanticOverlay selection={selection}/>
  <div style={{position:'absolute',left:60,top:40,fontSize:30,fontWeight:600,textShadow:'0 2px 9px #000'}}>超哥AI创业记</div>
  <AdaptiveBilingualCaptionOverlay captionsSrc="captions.json" variant="transparent-v8"/>
 </AbsoluteFill>;
};
registerRoot(()=> <Composition id="MetaPALocalBusinessPreviewR1" component={Preview} width={1920} height={1080} fps={FPS} durationInFrames={DURATION}/>);
