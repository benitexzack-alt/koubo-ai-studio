import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root="/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4";
const out="/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4/first-frame-final-preparation-r1";
const W=1672,H=941;
const deliver=path.join(out,'local-structure-revision-r2');
fs.mkdirSync(path.join(deliver,'first-frames'),{recursive:true});
const qa=path.join(deliver,'local-structure-layers');
fs.mkdirSync(qa,{recursive:true});
const mag=args=>execFileSync('/opt/homebrew/bin/magick',args,{encoding:'utf8'});
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let n=0, layers=[], operations=[];
function polygon(points,color,blur=0){
 const dest=path.join(qa,'layer-'+String(++n).padStart(3,'0')+'.png');
 const args=['-size',W+'x'+H,'xc:none','-fill',color,'-draw','polygon '+points.map(p=>p.join(',')).join(' ')];
 if(blur)args.push('-blur','0x'+blur);
 mag([...args,dest]);layers.push(dest);return dest;
}
function texture(src,crop,quad,brightness=100){
 const [x,y,w,h]=crop,dest=path.join(qa,'layer-'+String(++n).padStart(3,'0')+'.png');
 const points=[[0,0],[w-1,0],[w-1,h-1],[0,h-1]].map((s,i)=>s.join(',')+' '+quad[i].join(',')).join(' ');
 // 透视的消失线可在目标四边形之外产生不透明虚拟像素，必须用真实目标多边形裁切。
 mag([src,'-crop',w+'x'+h+'+'+x+'+'+y,'+repage','-modulate',brightness+',100,100','-alpha','on','-virtual-pixel','transparent','-define','distort:viewport='+W+'x'+H+'+0+0','-distort','Perspective',points,'+repage','(','-size',W+'x'+H,'xc:none','-fill','white','-draw','polygon '+quad.map(p=>p.join(',')).join(' '),')','-compose','DstIn','-composite',dest]);
 layers.push(dest);operations.push({source:src,crop,quad,brightness});return dest;
}
function rect(src,crop,x,y,w,h,bright=100){return texture(src,crop,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],bright);}
function finish(id,base,name,notes){
 const dest=path.join(deliver,'first-frames',name);if(fs.existsSync(dest))throw Error('输出已存在：'+dest);
 const args=[base];for(const l of layers)args.push(l,'-compose','Over','-composite');
 mag([...args,dest]);
 const receipt={schemaVersion:'koubo-local-paper-structure-composite/v1',sceneId:id,createdAt:new Date().toISOString(),method:'摄影纸材纹理与确定性像素四边形局部合成',base:{path:base,sha256:sha(base)},output:{path:dest,sha256:sha(dest)},notes,operations,layerPaths:layers,modelCalls:0,upstreamContractChanged:false,actualMillimetreClearanceVerified:false,dynamicAccepted:false,needsActualVisualReview:true};
 fs.writeFileSync(path.join(deliver,id+'.local-structure-receipt.v1.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({sceneId:id,path:dest,sha256:receipt.output.sha256}));
 layers=[];operations=[];
}
const p5=path.join(out,'native-edits/P05.native-edit.png');
const old5=path.join(root,'first-frame-remaining-production-r1/first-frames/P05_B15_first-frame.png');
const paper=[90,194,380,75],blueTop=[365,414,113,45];
// 同一台面修复成本纸垫和低矮不透明罩；入口朝右，纸垫由右向左直滑。
texture(old5,blueTop,[[102,398],[508,398],[494,468],[73,468]]);
polygon([[164,435],[333,435],[329,463],[157,463]],'rgba(0,0,0,0.30)',4);
polygon([[162,430],[327,430],[322,460],[157,460]],'#10283f');
texture(p5,paper,[[169,405],[330,405],[318,436],[156,436]],97);
texture(p5,paper,[[156,436],[163,435],[163,460],[156,460]],74);
texture(p5,paper,[[169,405],[176,405],[163,436],[156,436]],84);
// 右口完全开放，右端只有窄边纸厚，不能横断入口。
texture(p5,paper,[[330,405],[333,405],[321,436],[318,436]],83);
polygon([[336,454],[486,454],[485,462],[334,462]],'rgba(0,0,0,0.28)',3);
// 原纸垫原尺寸平移，保持每张纸的实际纹理与层厚。
rect(p5,[282,410,151,49],334,410,151,49);
// 接收槽前缘与中台顶面统一落在同一透视前线，消除原图纸厚造成的入口落差。
texture(p5,[1300,511,240,71],[[1225,499],[1553,499],[1580,604],[1234,604]]);
texture(p5,[1300,511,240,71],[[1234,604],[1580,604],[1580,612],[1234,612]],78);
finish('P05',p5,'P05_B15_first-frame.png','右侧接收槽已由原生局部编辑去除左墙；本地把成本罩的入口转为面向右侧纸垫，罩与纸垫共用原台顶面，平移向左进入，不折弯/掉落。罩长与深度覆盖整叠纸，初态纸垫在口外。三牌不改。');
// P06保留摄影原图四牌及G4，对错误机构区域进行可审计局部搭建。
const p6=path.join(out,'native-edits/P06.native-edit.png');
const old6=path.join(root,'first-frame-remaining-production-r1/first-frames/P06_B17_first-frame.png');
const warm=[130,166,280,66];
// 使用同图纯背景的纵向明暗，清除机构，不使用外部图片。
const background=texture(p6,[5,264,88,455],[[105,263],[1206,263],[1206,717],[105,717]]);
// 恢复前三组独立牌脚，牌面保持基底原像素。
for(const [x,y,w,h] of [[132,247,16,132],[392,247,17,132],[510,247,17,133],[769,247,17,133],[890,247,17,133],[1147,247,17,133]]){
 rect(p6,[x,y,w,h],x,y,w,h);
}
// 后排共同打开的文件夹背板，不是封闭柜。顶部纸夹来自已修复摄影片。
polygon([[982,303],[1182,311],[1190,647],[971,646]],'rgba(0,0,0,0.24)',7);
texture(p6,[965,332,163,73],[[991,304],[1175,313],[1171,637],[985,630]],100);
rect(p6,[1025,260,63,68],1030,271,63,68);
// 两路的支承腿，后路较短、前路较高；不把图像像素冒称毫米。
for(const [x,y,h] of [[151,469,32],[346,469,32],[596,597,56],[746,597,56]]){
 texture(p6,warm,[[x,y],[x+16,y],[x+16,y+h],[x,y+h]],73);
}
// 两条独立连续托面：同一纹理四边形从各自源站直达空接收位，没有横向接缝/台阶。
polygon([[142,462],[1156,462],[1158,483],[137,483]],'rgba(0,0,0,0.25)',6);
texture(p6,warm,[[148,411],[1155,411],[1147,463],[139,463]],97);
texture(p6,warm,[[139,463],[1147,463],[1147,476],[139,476]],78);
polygon([[585,590],[1156,590],[1158,615],[580,615]],'rgba(0,0,0,0.28)',6);
texture(p6,warm,[[591,539],[1155,539],[1147,591],[581,591]],94);
texture(p6,warm,[[581,591],[1147,591],[1147,608],[581,608]],74);
// 每个起点只有后、左、前缘，右侧完全开放；边墙不横断运动方向。
texture(p6,warm,[[149,399],[369,399],[369,411],[148,411]],83);
texture(p6,warm,[[148,411],[157,411],[148,463],[139,463]],80);
texture(p6,warm,[[139,463],[369,463],[369,479],[139,479]],88);
texture(p6,warm,[[591,526],[771,526],[771,539],[591,539]],80);
texture(p6,warm,[[591,539],[600,539],[590,591],[581,591]],76);
texture(p6,warm,[[581,591],[771,591],[771,611],[581,611]],85);
// 两个无字卡保留唯一初态，接收区域全空。
for(const q of [[[187,422],[333,422],[327,450],[181,450]],[[624,550],[748,550],[742,579],[618,579]]]){
 polygon(q.map(([x,y])=>[x+2,y+5]),'rgba(0,0,0,0.28)',3);
 texture(p6,warm,q,104);
 const [a,b,c,d]=q;texture(p6,warm,[d,c,[c[0],c[1]+5],[d[0],d[1]+5]],82);
}
// 文件夹右端边翼，不放在从左来的入口；共同背板与开放双层托面可辨。
texture(p6,warm,[[1148,386],[1168,378],[1168,465],[1148,463]],87);
texture(p6,warm,[[1148,514],[1168,506],[1168,594],[1148,591]],84);
finish('P06',p6,'P06_B17_first-frame.png','摄影纹理局部搭建：两源托盘右侧全开；每一路由同一完整纸面连续至G3空接收位置，无接缝高差。G3为打开文件夹背板、未扣纸夹和双层接收托面，右边翼不挡来件。G4摄影放大镜与四牌原样保留。只有scope/cooperation各一张，初态分别位于G1/G2，三层空间含固定牌/文件夹背板/托面/腿及G4。像素构造不声称毫米实测或动态通过。');
