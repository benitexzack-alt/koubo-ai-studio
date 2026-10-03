/* 所有画面由时间函数重建；不依赖帧间累计、外部图片或实时随机数。 */
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const C = {ink:'#343e3c', muted:'#7b857e', paper:'#faf7ee', grid:'#dce3d8', teal:'#78b7a0', darkTeal:'#447d6c', coral:'#ee8972', coralSide:'#c96d58', yellow:'#f3cf73', blue:'#93bdd1', purple:'#aea6cd'};
const clamp = x => Math.max(0,Math.min(1,x));
const mix = (a,b,u) => a+(b-a)*u;
const ease = x => {x=clamp(x);return x*x*(3-2*x);};
const out = x => 1-Math.pow(1-clamp(x),3);
const progress = (t,a,b) => clamp((t-a)/(b-a));
const pop = x => {x=clamp(x);return 1+2.70158*Math.pow(x-1,3)+1.70158*Math.pow(x-1,2);};
const noise = n => {const x=Math.sin(n*37.13+9.2)*43758.5453;return x-Math.floor(x);};
function at(x,y,r,fn) {ctx.save();ctx.translate(x,y);ctx.rotate(r||0);fn();ctx.restore();}
function path(points,fill,stroke=C.ink,width=4) {
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();}
}
function line(x1,y1,x2,y2,color=C.ink,width=4,seed=1) {
  ctx.beginPath();ctx.moveTo(x1,y1);
  const steps=Math.max(3,Math.ceil(Math.hypot(x2-x1,y2-y1)/40));
  for(let i=1;i<steps;i++){const u=i/steps;const wob=(noise(seed+i)-.5)*2.8;ctx.lineTo(mix(x1,x2,u)+wob,mix(y1,y2,u)+wob);}
  ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();
}
function ellipse(x,y,rx,ry,fill,stroke=null,w=3) {ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=w;ctx.stroke();}}
function text(s,x,y,size=36,color=C.ink,align='left') {ctx.font=`${size}px PaperChinese, sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(s,x,y);}
function paperRect(x,y,w,h,color,angle=0,depth=9) {
  at(x,y,angle,()=>{
    ctx.save();ctx.shadowColor='#353e3422';ctx.shadowBlur=15;ctx.shadowOffsetY=12;path([[0,0],[w,-2],[w+1,h],[2,h+2]],color,null);ctx.restore();
    path([[2,h],[w,h-2],[w+4,h+depth],[3,h+depth]],color===C.coral?C.coralSide:'#d1cbbb',null);
    path([[0,0],[w,-2],[w+1,h],[2,h+2]],color,C.ink,3.4);
    line(6,5,w-7,3,'#ffffff77',2,9);
  });
}
function scribbleArrow(x,y,w,up=0,color=C.ink,alpha=1) {ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+w*.25,y-28-up,x+w*.7,y+12-up,x+w,y-up);ctx.stroke();line(x+w,y-up,x+w-15,y-up-10,color,3,8);line(x+w,y-up,x+w-17,y-up+11,color,3,9);ctx.restore();}
function grass(x,y,n=8) {for(let i=0;i<n;i++){const px=x+i*23;line(px,y,px-3,y-13-noise(i)*9,C.darkTeal,2.3,i);line(px,y,px+8,y-8,C.darkTeal,2.3,i+9);}}
function land(x,w,right=false) {
  path([[x,657],[x+w,657],[x+w+18,848],[x-10,848]],'#d9c7a7',C.ink,4);
  path([[x,655],[x+w,655],[x+w+7,689],[x-3,686]],C.teal,C.ink,4);
  for(let i=0;i<Math.floor(w/32);i++)line(x+15+i*32,722+noise(i)*80,x+23+i*32,745+noise(i)*80,'#b49d7950',3,i+4);
  grass(x+40,653,Math.floor((w-70)/23));
  if(right){
    paperRect(x+222,487,150,169,'#f7e6b6',-.014);
    path([[x+206,492],[x+297,417],[x+388,490]],C.coral,C.ink,4);
    paperRect(x+272,569,45,85,C.darkTeal,0,3);
    paperRect(x+243,517,36,34,C.blue,0,3);paperRect(x+321,517,36,34,C.blue,0,3);
    line(x+259,518,x+260,550,C.ink,2);line(x+338,518,x+338,550,C.ink,2);
  }
}
function tree(x,y,scale=1) {at(x,y,0,()=>{ctx.scale(scale,scale);paperRect(-8,-99,15,104,'#bea17c',-.01,4);path([[-67,-115],[-34,-181],[-44,-209],[6,-256],[37,-224],[51,-171],[74,-126],[43,-93],[-33,-87]],C.teal,C.ink,3);line(0,-113,-17,-156,C.darkTeal,2);line(1,-142,25,-186,C.darkTeal,2);});}
// 原创像素角色：蓝外套、红围巾；脚、手由动作参数独立绘制。
function person(x,y,t,pose='idle',scale=1) {
  const walk=pose==='walk';const step=walk?Math.sin(t*11):Math.sin(t*2)*.08;
  at(x,y+(walk?-Math.abs(step)*5:Math.sin(t*1.7)*1.5),0,()=>{
    ctx.scale(scale,scale);ellipse(0,5,38,8,'#363e3324');
    const px=(a,b,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect(a,b,w,h);};
    px(-23,-122,45,11,'#453c33');px(-29,-111,54,19,'#453c33');
    px(-22,-102,43,35,'#efc297');px(-26,-100,12,15,'#453c33');px(19,-94,9,12,'#efc297');
    px(5,-92,6,6,C.ink);px(14,-79,8,4,'#b9816d');
    px(-23,-67,44,48,'#6586b4');px(-27,-65,49,9,C.coral);px(13,-56,10,24,C.coral);
    const raise=pose==='cheer'?1:pose==='build'?.6:pose==='oops'?.35:0;
    at(-21,-57,-.12-raise*.7+step*.2,()=>{px(-11,0,13,34,'#6586b4');px(-11,29,13,14,'#efc297');});
    at(21,-57,-.08-raise*2-step*.3,()=>{px(-1,0,13,32,'#6586b4');px(-1,28,13,14,'#efc297');});
    at(-12,-23,step*.35,()=>{px(-10,0,17,22,'#444d60');px(-16,19,23,9,'#343e3c');});
    at(12,-23,-step*.35,()=>{px(-8,0,17,22,'#444d60');px(-8,19,26,9,'#343e3c');});
  });
}
function bulb(x,y,t) {
  const on=out(progress(t,2,2.22));const fade=1-ease(progress(t,3.1,3.6));
  ctx.save();ctx.globalAlpha=fade;
  at(x,y+mix(30,0,out(progress(t,1.45,1.85))),-.03,()=>{
    if(on){ctx.save();ctx.shadowColor='#f3cf7399';ctx.shadowBlur=45;ellipse(0,-15,40,47,C.yellow,C.ink,4);ctx.restore();}
    else ellipse(0,-15,40,47,'#f8eed5',C.ink,4);
    paperRect(-20,28,40,22,'#a4aaa0',0,4);line(-15,39,15,39,C.ink,2);line(-12,48,12,48,C.ink,2);
    line(-13,6,-8,-7,C.ink,3);line(-8,-7,0,4,C.ink,3);line(0,4,11,-9,C.ink,3);line(11,-9,14,6,C.ink,3);
    for(let i=0;i<7;i++){const a=Math.PI+(.18+i*.44);line(Math.cos(a)*59,Math.sin(a)*62-15,Math.cos(a)*76,Math.sin(a)*79-15,C.yellow,4.5,i);}
  });ctx.restore();
}
function car(x,y,t,rot=0) {
  at(x,y,rot,()=>{
    ellipse(0,12,67,9,'#343e3c22');
    paperRect(-57,-45,117,38,C.coral,0,6);
    path([[-27,-45],[-11,-80],[24,-80],[48,-45]],C.yellow,C.ink,3.5);
    path([[-17,-49],[-7,-70],[12,-70],[12,-49]],'#cbe0e6',C.ink,2.5);
    path([[19,-49],[19,-70],[28,-68],[39,-49]],'#cbe0e6',C.ink,2.5);
    for(const wx of [-34,37]){ellipse(wx,-1,17,17,C.ink);ellipse(wx,-1,8,8,'#f1e7cd');at(wx,-1,t*5,()=>{line(-7,0,7,0,C.muted,2);line(0,-7,0,7,C.muted,2);});}
    line(-48,-31,-38,-31,'#fff0da',3);line(53,-31,58,-31,C.yellow,5);
  });
}
function flag(x,y,t) {line(x,y,x,y-148,C.ink,5,8);path([[x,y-149],[x+93,y-140+Math.sin(t*2)*4],[x+72,y-88],[x,y-97]],C.coral,C.ink,3);line(x+19,y-132,x+25,y-112,'#fae9d3',4);line(x+25,y-112,x+51,y-128,'#fae9d3',4);}
function bridge(t) {
  const appear=out(progress(t,3.65,4.4));
  if(t<3.65)return;
  const fail=progress(t,8.4,9.3);const rebuilding=t>=11.15;
  if(rebuilding && t<15.0)return;
  const re=out(progress(t,15,15.5));
  const n=13, left=626, w=52;
  for(let i=0;i<n;i++){
    let x=left+i*w,y=626,angle=0;
    if(!rebuilding){
      y-=240*(1-appear);angle=(1-appear)*(.15-(i%3)*.1);
      const bend=Math.sin(i/(n-1)*Math.PI)*20*progress(t,7.25,8.4);y+=bend;
      if(fail){x+=(i-6)*fail*7;y+=fail*fail*(125+noise(i)*110);angle+=(i-6)*fail*.065;}
    }else{y-=185*(1-re);angle=(1-re)*.09;}
    paperRect(x,y,w+1,24,i%3===0?'#e4c783':'#f1da9d',angle,6);
    line(x+10,y+12,x+39,y+11,'#b4915555',2,i+20);
  }
  if((!rebuilding&&!fail)||rebuilding){
    const d=rebuilding?re:appear;
    ctx.save();ctx.globalAlpha=d;
    const sag=!rebuilding?25*progress(t,7.25,8.4):0;
    ctx.beginPath();ctx.moveTo(627,629);ctx.quadraticCurveTo(950,630+sag*1.4,1301,629);ctx.strokeStyle=C.ink;ctx.lineWidth=4;ctx.stroke();ctx.restore();
  }
}
function supports(t) {
  const xs=[740,953,1165];
  xs.forEach((x,i)=>{
    const end=12+i*1.1,u=out(progress(t,end-.55,end));if(!u)return;
    const y=mix(135,650,u);const r=(1-u)*(.09*(i%2?1:-1));
    at(x,y,r,()=>{paperRect(-29,0,58,203,i===1?C.purple:C.blue,0,9);path([[-29,0],[0,-12],[29,0],[0,12]],i===1?'#c4bddc':'#bfd5e0',C.ink,3);line(-14,31,-14,176,'#ffffff66',3);});
    if(t<end+.35){ctx.save();ctx.globalAlpha=1-progress(t,end,end+.35);ellipse(x,858,43,11,'#d3c5a4');ctx.restore();}
  });
  if(t>=15.5){const u=out(progress(t,15.5,15.9));ctx.save();ctx.globalAlpha=u;line(744,711,951,826,C.darkTeal,10);line(951,826,1164,711,C.darkTeal,10);for(const x of xs)ellipse(x,697,5,5,'#fbf5df',C.ink,2);ctx.restore();}
}
function label(s,x,y,color,alpha=1,rotation=0) {ctx.save();ctx.globalAlpha=alpha;at(x,y,rotation,()=>{const w=s.length*35+44;paperRect(-w/2,-27,w,54,color,0,5);text(s,0,0,30,C.ink,'center');});ctx.restore();}
function annotations(t) {
  if(t>3&&t<5.55){const a=Math.min(out(progress(t,3,3.3)),1-ease(progress(t,5,5.55)));scribbleArrow(620,480,640,0,C.muted,a);label('先搭起来',956,428,C.yellow,a,-.02);}
  if(t>5.75&&t<8.6){const a=Math.min(out(progress(t,5.75,6)),1-ease(progress(t,8.25,8.6)));label('试一下',515,412,C.paper,a,.018);scribbleArrow(590,462,165,-2,C.coral,a);}
  if(t>=8.5&&t<10.7){const a=out(progress(t,8.5,8.8));label('还缺点支撑',965,445,'#f4d0c4',a,-.015);const u=out(progress(t,8.7,9.1));ctx.save();ctx.globalAlpha=u;line(979,490,980,529,C.coral,5);ellipse(980,544,4,4,C.coral);ctx.restore();}
  if(t>11.4&&t<16.25){const a=Math.min(out(progress(t,11.4,11.8)),1-ease(progress(t,15.85,16.25)));label('把支撑补上',957,407,'#d7e4d9',a,.013);for(let i=0;i<3;i++){const end=12+i*1.1;if(t>=end){const u=out(progress(t,end,end+.25));ctx.save();ctx.globalAlpha=u;line(736+i*212,898,745+i*212,908,C.darkTeal,4);line(745+i*212,908,761+i*212,887,C.darkTeal,4);ctx.restore();}}}
  if(t>16.4&&t<20.6){const a=Math.min(out(progress(t,16.4,16.7)),1-ease(progress(t,20.2,20.6)));label('再试一次',570,395,C.yellow,a,-.02);scribbleArrow(689,451,558,0,C.darkTeal,a);}
  if(t>=20.4&&t<22.5){const a=out(progress(t,20.4,20.8));label('这次，跑通了',1470,355,'#d7e4d9',a,.015);}
}
function confetti(t) {const u=progress(t,20.4,22.1);if(t<20.4||t>22.1)return;ctx.save();ctx.globalAlpha=1-ease(progress(t,21.5,22.1));for(let i=0;i<26;i++){const theta=noise(i+81)*Math.PI*2, radius=70+noise(i+62)*110;const x=1510+Math.cos(theta)*radius*u;const y=487-Math.sin(theta)*radius*u+u*u*90;at(x,y,i+u*5,()=>{ctx.fillStyle=[C.teal,C.coral,C.yellow,C.purple][i%4];ctx.fillRect(-4,-9,8,18);});}ctx.restore();}
function background(t) {
  ctx.fillStyle=C.paper;ctx.fillRect(0,0,1920,1080);
  ctx.strokeStyle=C.grid;ctx.lineWidth=1;
  for(let x=36;x<1920;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1080);ctx.stroke();}
  for(let y=27;y<1080;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1920,y);ctx.stroke();}
  for(let i=0;i<1600;i++){ctx.fillStyle=i%2?'#746d4f09':'#fff9df90';ctx.fillRect(noise(i+5)*1920,noise(i+123)*1080,1.6,1.6);}
  line(122,61,122,1016,'#d9988733',2);
  for(let i=0;i<5;i++){ellipse(45,160+i*180,12,12,'#d5d7cb');ellipse(44,158+i*180,10,10,'#f0eee4');}
  ctx.save();ctx.globalAlpha=.75;
  at(1500,141,.12,()=>{path([[0,0],[88,-3],[88,24],[0,26]],'#d8cda499',null);for(let i=0;i<8;i++)line(i*11+3,1,i*11+3,22,'#9e937330',1,i);});ctx.restore();
}
function drawAt(time) {
  const t=clamp(time/26)*26;
  ctx.clearRect(0,0,1920,1080);background(t);
  // 小幅确定性运镜；主景始终连续，动作物件保持同一空间关系。
  const final=out(progress(t,22.3,23.3));
  const zoom=1+.025*Math.sin(progress(t,7.7,10.2)*Math.PI)-.045*final;
  ctx.save();ctx.translate(960,580);ctx.scale(zoom,zoom);ctx.translate(-960,-580-10*final);
  ctx.save();ctx.globalAlpha=.5;
  for(let i=0;i<3;i++){const x=800+i*200;const y=830+Math.sin(t*.7+i)*5;ctx.beginPath();ctx.moveTo(x-120,y);ctx.quadraticCurveTo(x,y-25,x+120,y);ctx.strokeStyle='#80b3c0';ctx.lineWidth=3;ctx.stroke();}ctx.restore();
  path([[636,843],[1301,843],[1345,918],[592,918]],'#b3d4d7',null);
  for(let i=0;i<7;i++){const x=645+i*89+Math.sin(t*.9+i)*8;line(x,880,x+38,880,'#f7faf2',3,i+13);}
  land(205,423);land(1300,400,true);tree(274,651,.65);tree(1688,653,.68);
  flag(1642,649,t);
  // 从铅笔草图过渡到能承载动作的纸桥。
  if(t>2.85&&t<4.15){ctx.save();ctx.globalAlpha=.55*Math.sin(progress(t,2.85,4.15)*Math.PI);ctx.setLineDash([10,10]);line(628,625,1300,625,C.muted,3);line(628,650,1300,650,C.muted,3);ctx.setLineDash([]);ctx.restore();}
  supports(t);bridge(t);
  let charX=448,pose='idle';
  if(t>=3.25&&t<5.1){charX=mix(448,570,ease(progress(t,3.25,4.1)));pose=t<4.1?'walk':'build';}
  else if(t>=5.1&&t<11.15){charX=570;pose=t>=8.4?'oops':'idle';}
  else if(t>=11.15&&t<16.3){charX=mix(570,530,ease(progress(t,11.15,11.65)));pose=t>=11.65?'build':'walk';}
  else if(t>=16.3&&t<20.4){charX=530;pose='idle';}
  else if(t>=20.4){charX=mix(530,565,ease(progress(t,20.4,21)));pose='cheer';}
  person(charX,642,t,pose);
  bulb(492,430,t);
  let carX=371,carY=619,carRot=0;
  if(t>=6.3&&t<8.4){carX=mix(371,955,ease(progress(t,6.3,8.4)));carY+=Math.sin(progress(t,6.3,8.4)*Math.PI)*6;}
  else if(t>=8.4&&t<11.15){const u=out(progress(t,8.4,9.4));carX=mix(955,1032,u);carY+=188*u;carRot=.26*u;}
  else if(t>=11.15&&t<17){carX=371;}
  else if(t>=17){carX=mix(371,1525,ease(progress(t,17,20.4)));carY+=Math.sin(t*22)*1.1*(1-progress(t,20.2,20.4));}
  car(carX,carY,t,carRot);
  if(t>8.4&&t<9.2){const u=progress(t,8.4,9.2);ctx.save();ctx.globalAlpha=1-u;for(let i=0;i<9;i++){const a=i*Math.PI*2/9;line(952+Math.cos(a)*(70+u*25),650+Math.sin(a)*(45+u*25),952+Math.cos(a)*(100+u*45),650+Math.sin(a)*(70+u*40),C.coral,4,i);}ctx.restore();}
  if(t>=20.4){const u=out(progress(t,20.4,20.7));ctx.save();ctx.globalAlpha=u;ellipse(1553,535,40,40,'#f5d97944');paperRect(1531,517,36,34,C.yellow,0,3);ctx.restore();}
  annotations(t);confetti(t);
  ctx.restore();
  // 片头与终景文字从同一纸页长出，避免频繁全屏字卡切换。
  const intro=out(progress(t,.45,1.2));
  ctx.save();ctx.globalAlpha=intro;
  at(228,155+30*(1-intro),-.012,()=>{text('从想法，到能用',0,0,63);line(2,47,482,47,C.coral,8,10);});
  text('把一座桥搭起来，也把一个想法试明白。',232,254,29,C.muted);
  ctx.restore();
  if(final){ctx.save();ctx.globalAlpha=final;at(962,963+20*(1-final),-.005,()=>{paperRect(-400,-40,800,80,'#f8e9bf',0,6);text('让想法，真正跑起来。',0,1,43,C.ink,'center');});ctx.restore();}
  // 翻页是同一舞台的重置，擦过失败碎片，第二次搭建保留空间记忆。
  if(t>=10.7&&t<=11.48){
    const u=progress(t,10.7,11.48);
    const pageX=u<.45?mix(-2050,0,out(u/.45)):u<.6?0:mix(0,2050,ease((u-.6)/.4));
    ctx.save();ctx.shadowColor='#37433235';ctx.shadowBlur=30;ctx.shadowOffsetX=-15;
    path([[pageX-40,-50],[pageX+1970,-50],[pageX+1970,1130],[pageX-40,1130]],'#efe9d8',null);
    line(pageX+1920,-30,pageX+1920,1110,'#c8bfab',3);ctx.restore();
  }
  // 开场纸页从下向上展开，音效在0.5秒同步发生。
  if(t<1.2){const u=out(progress(t,.5,1.2));ctx.fillStyle='#efe9da';ctx.fillRect(0,mix(0,1080,u),1920,1080);line(0,mix(0,1080,u),1920,mix(0,1080,u),'#cbc5b7',4);}
}
window.drawAt=drawAt;
window.addEventListener('hf-seek',event=>drawAt(event.detail.time));
window.__hf=window.__hf||{};
window.__hf.buildReady=document.fonts.load('43px PaperChinese').then(()=>{drawAt(0);});
drawAt(0);
// 普通浏览器本地预览；渲染引擎初始化后完全由 hf-seek 定位。
if(new URLSearchParams(location.search).get('preview')==='1') {
  window.__hf.buildReady.then(()=>{
    const start=performance.now();function play(now){drawAt(((now-start)/1000)%26);requestAnimationFrame(play);}requestAnimationFrame(play);
  });
}
