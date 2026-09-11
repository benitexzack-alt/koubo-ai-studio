import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const r="/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4/first-frame-final-preparation-r1",v=path.join(r,'local-structure-revision-r2'),out=path.join(r,'local-structure-polish-P06-r4');fs.mkdirSync(out,{recursive:true});
const mag=a=>execFileSync('/opt/homebrew/bin/magick',a),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const base=path.join(r,'native-edits/P06.native-edit.png'),bg=path.join(out,'feathered-background.png'),dest=path.join(out,'P06_B17_first-frame.png');
if(fs.existsSync(dest))throw Error('不覆盖已有成品');
mag([base,'-crop','88x941+5+0','+repage','-resize','1672x941!','(','-size','1672x941','xc:black','-fill','white','-draw','rectangle 67,216 1227,724','-blur','0x10',')','-alpha','off','-compose','CopyOpacity','-composite',bg]);
const shadow=path.join(out,'label-contact-shadows.png');
mag(['-size','1672x941','xc:none','-fill','rgba(0,0,0,0.25)','-draw',[[141,380],[400,380],[519,380],[778,380],[898,380],[1156,380]].map(([x,y])=>'ellipse '+x+','+y+' 17,5 0,360').join(' '),'-blur','0x4',shadow]);
// 从结构回执取本镜图层，不能以跨镜全局序号猜测；前一镜新增图层后序号会变化。
const structureReceipt=JSON.parse(fs.readFileSync(path.join(v,'P06.local-structure-receipt.v1.json')));
const layers=structureReceipt.layerPaths.slice(1);
const cleanBase=path.join(out,'base-without-floating-line.png');
mag([base,'(',base,'-crop','64x16+5+255','+repage',')','-geometry','+1028+255','-compose','Over','-composite',cleanBase]);
const args=[cleanBase,bg,'-compose','Over','-composite',shadow,'-compose','Over','-composite'];for(const l of layers)args.push(l,'-compose','Over','-composite');
// 扩大底图遮罩覆盖旧机构轮廓后，逐像素恢复未改变的三张固定牌，避免擦到牌面。
for(const [x,y,w,h]of [[115,153,311,95],[494,152,310,96],[871,152,308,96]])args.push('(',base,'-crop',w+'x'+h+'+'+x+'+'+y,'+repage',')','-geometry','+'+x+'+'+y,'-compose','Over','-composite');
mag([...args,dest]);
fs.writeFileSync(path.join(out,'polish-receipt.v1.json'),JSON.stringify({sceneId:'P06',source:{path:base,sha256:sha(base)},priorStructure:{path:path.join(v,'first-frames/P06_B17_first-frame.png'),sha256:sha(path.join(v,'first-frames/P06_B17_first-frame.png'))},output:{path:dest,sha256:sha(dest)},changes:['背景边界改为18像素连续渐变','六根固定牌脚补接触阴影'],geometryChanged:false,modelCalls:0,needsVisualReview:true},null,2)+'\n',{flag:'wx'});console.log(dest);
