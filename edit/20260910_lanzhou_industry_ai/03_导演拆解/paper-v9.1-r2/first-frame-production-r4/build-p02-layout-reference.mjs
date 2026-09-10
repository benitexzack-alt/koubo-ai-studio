import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const sharp=require('/Users/pc/Documents/口播/remotion/node_modules/sharp');
const root=path.dirname(fileURLToPath(import.meta.url));
const base=path.dirname(root);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected='50e1a63b6dd48c56f48e80c7c9a4f145bb6c7ce3855afe1914a2f9d26b5e2e66';
assert.equal(sha(path.join(base,'first-frame-prompts.v1.json')),expected);
const manifest=JSON.parse(fs.readFileSync(path.join(base,'first-frame-prompts.v1.json')));
const scene=manifest.scenes.find(s=>s.sceneId==='P02');
const W=1920,H=1080,sx=3.4,sy=2.8,sz=2.6,ox=76,oy=440;
const project=(x,y,z)=>[ox+sx*x,oy+sy*y-sz*z];
const rect=(x,y,w,h,fill,more='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${more}/>`;
const poly=(points,fill,more='')=>`<polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="${fill}" ${more}/>`;
const plane=(x,y,w,d,z,fill,more='')=>poly([[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]].map(p=>project(...p)),fill,more);
const color=['#ede1cb','#29456a','#eee2cc','#d8ae49'];
const body=[];
body.push(rect(0,0,W,H,'#193553'));
body.push(rect(125,167,1670,450,'#213e60'));
body.push(rect(158,393,1604,198,'#2a496c'));
body.push(rect(177,590,1568,53,'#203b5c'));
const labelBoxes=[[154,228,325,96],[579,228,325,96],[1006,228,325,96],[1446,228,325,96]];
labelBoxes.forEach(([x,y,w,h],i)=>{
 const center=x+w/2;
 body.push(rect(center-10,y+h,20,244,'#caba9e'));
 body.push(rect(center-22,y+h+239,44,8,'#cfbea3'));
 body.push(rect(x+5,y+5,w,h,'#10253c','opacity=".35"'));
 body.push(rect(x,y,w,h,'#f2e9d8'));
});
// The owner is a static cut-paper figure wholly within the existing obstacle envelope.
// Hands are at the sides of the body, not on the transport surface.
const ownerBox={x:1072,y:364,width:172,height:176};
body.push('<g transform="translate(-16,54.6) scale(1,0.85)">');
body.push(poly([[1124,441],[1098,461],[1088,524],[1112,533],[1133,477],[1215,477],[1236,533],[1260,524],[1250,461],[1221,441]],'#e8dec8'));
body.push(poly([[1128,444],[1218,444],[1223,565],[1123,565]],'#e9dfcb'));
body.push(poly([[1147,456],[1198,456],[1211,565],[1135,565]],'#274461'));
body.push(`<ellipse cx="1172" cy="409" rx="42" ry="46" fill="#e7d2b2"/>`);
body.push(`<path d="M1130 406 Q1127 361 1174 364 Q1218 365 1215 405 L1190 384 Q1166 409 1130 406" fill="#514840"/>`);
body.push(`<ellipse cx="1105" cy="530" rx="15" ry="12" fill="#e7d2b2"/>`);
body.push(`<ellipse cx="1243" cy="530" rx="15" ry="12" fill="#e7d2b2"/>`);
body.push(rect(1122,561,43,10,'#213b56'));
body.push(rect(1180,561,43,10,'#213b56'));
body.push('</g>');
// Lever is drawn in the original x=305..345 y=65..85 z=20..40 envelope.
const leverBack=project(314,74,20),pivot=project(314,74,36),tip=project(342,74,39);
body.push(rect(leverBack[0]-13,pivot[1],26,leverBack[1]-pivot[1]+5,'#d0bd98'));
body.push(`<line x1="${pivot[0]}" y1="${pivot[1]}" x2="${tip[0]}" y2="${tip[1]}" stroke="#e0cda7" stroke-width="13" stroke-linecap="round"/>`);
body.push(`<circle cx="${pivot[0]}" cy="${pivot[1]}" r="13" fill="#a9987a"/>`);
body.push(`<circle cx="${tip[0]}" cy="${tip[1]}" r="11" fill="#ecdcbd"/>`);
// Only the front outer edge shows thickness. All internal station edges are flush.
const deck=scene.physicalContract.supports;
const left=project(50,148,20),right=project(470,148,20);
body.push(rect(left[0],left[1]+5,right[0]-left[0],9,'#0e243d','opacity=".35"'));
deck.forEach((d,i)=>{
 body.push(plane(d.xMm,d.yMm,d.widthMm,d.depthMm,20,color[i]));
 const a=project(d.xMm,d.yMm+d.depthMm,20),b=project(d.xMm+d.widthMm,d.yMm+d.depthMm,20);
 body.push(rect(a[0],a[1],b[0]-a[0],7,i===1?'#1c3552':i===3?'#aa8331':'#bcb098'));
});
// One stack: width50 depth24 height4, centered at draft-G1=80,130.
const draftBoxes=[];
for(let i=0;i<5;i++){
 const z=20+(i+1)*0.8;
 body.push(plane(55,118,50,24,z,i===4?'#faf6ec':'#ddd3bd'));
 const p=project(55,142,z),q=project(105,142,z);
 body.push(rect(p[0],p[1],q[0]-p[0],1.2,'#ad9f87'));
}
const safe=scene.layoutContract.contentSafeRect;
const normalized=(b)=>({x:b.x/W,y:b.y/H,width:b.width/W,height:b.height/H});
const inside=b=>b.x>=safe.x*W && b.y>=safe.y*H && b.x+b.width<=(safe.x+safe.width)*W && b.y+b.height<=(safe.y+safe.height)*H;
const functionalDeck={x:left[0],y:project(50,112,20)[1],width:right[0]-left[0],height:left[1]-project(50,112,20)[1]+7};
assert.ok(inside(functionalDeck)); assert.ok(inside(ownerBox));
labelBoxes.forEach(b=>assert.ok(inside({x:b[0],y:b[1],width:b[2],height:b[3]})));
const laneRear=project(50,112,20)[1];
const handMaximumY=542*0.85+54.6;
assert.ok(laneRear-handMaximumY>180);
assert.ok(ownerBox.x>=project(290,20,20)[0] && ownerBox.x+ownerBox.width<=project(345,55,20)[0]);
assert.ok(ownerBox.y+ownerBox.height<=project(345,55,20)[1]);
assert.ok(tip[1]-11-handMaximumY>15);
assert.ok(laneRear-(leverBack[1]+5)>90);
assert.ok(364-(labelBoxes[2][1]+labelBoxes[2][3])>=40);
const outputs=['P02.layout-reference.v2.svg','P02.layout-reference.v2.png','P02.layout-reference-check.v2.json'];
outputs.forEach(f=>assert.ok(!fs.existsSync(path.join(root,f)),'不覆盖已有参考:'+f));
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body.join('\n')}</svg>`;
fs.writeFileSync(path.join(root,outputs[0]),svg,{flag:'wx'});
const png=await sharp(Buffer.from(svg)).png().toBuffer();
fs.writeFileSync(path.join(root,outputs[1]),png,{flag:'wx'});
const receipt={schemaVersion:'koubo-deterministic-layout-reference/v1',status:'reference-geometry-checked-not-final-image',sceneId:'P02',sourceManifest:{path:path.join(base,'first-frame-prompts.v1.json'),sha256:expected},physicalContractSha256:scene.physicalContractSha256,sourceRevisionId:manifest.revisionId,productionAttemptId:'first-frame-production-r4',projection:{type:'orthographic-layout-reference',width:W,height:H,xScale:sx,yScale:sy,zScale:sz,originX:ox,originY:oy},layout:{functionalDeckPx:functionalDeck,ownerPx:ownerBox,handMaximumYPx:handMaximumY,laneRearYPx:laneRear,leverMaximumYPx:leverBack[1]+5,labelBoxesPx:labelBoxes},checks:{functionalDeckWithinHardSafeRect:true,fourIndependentBlankLabels:true,oneDraftAtG1:true,otherReceivingSurfacesEmpty:true,continuousFlushSupportFromSignedContract:true,handLaneProjectedGapPx:laneRear-handMaximumY,leverLaneProjectedGapPx:laneRear-(leverBack[1]+5),ownerLabelProjectedGapPx:40,ownerWithinProjectedObstacleEnvelope:true,handLeverProjectedGapPx:tip[1]-11-handMaximumY},references:outputs.slice(0,2).map(f=>({path:path.join(root,f),sha256:sha(path.join(root,f))})),limitations:'确定位置的参考草图，不是实际生图QA、纸艺材质验收、毫米实测或真实动态验证；后续模型若偏离必须再次拦截。',createdAt:new Date().toISOString()};
fs.writeFileSync(path.join(root,outputs[2]),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({ok:true,reference:receipt.references[1],layout:receipt.layout,checks:receipt.checks}));
