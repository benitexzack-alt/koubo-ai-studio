import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='edit/20260926_industry_ai_no_anxiety',out=`${base}/04_Remotion准备`;
const read=p=>JSON.parse(fs.readFileSync(p));
const binding=p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
const timeline=read(`${out}/实录重绑时间线.r1.json`),selection=read(`${out}/动效选择.r1.json`);
const paper=[
 {id:'P01',beatId:'B07',startFrame:656,endFrameExclusive:739,sourceInSeconds:2.6,note:'报价提问约2.77秒，只取翻开报价内页到成本/风险显露的有效动作，不延长口播'},
 {id:'P02',beatId:'B09',startFrame:923,endFrameExclusive:1077,sourceInSeconds:0,note:'从桥梁分开开始，保留合拢及小车通过接缝；素材“技术能力”不作为实录字幕，字幕保留用户确认的“技能能力”'},
 {id:'P03',beatId:'B12',startFrame:1367,endFrameExclusive:1607,sourceInSeconds:0,note:'完整8秒，保留拿起铲子和掀动纸面；不循环或冻结补时'},
 {id:'P04',beatId:'B13',startFrame:1615,endFrameExclusive:1823,sourceInSeconds:1,note:'取靠近交付入口至通过回款出口的动作，时长约6.93秒'},
 {id:'P05',beatId:'B24',startFrame:3340,endFrameExclusive:3580,sourceInSeconds:0,note:'先真人轻装上阵，再从现金流句开始播放完整8秒折页，不提前切掉结果'},
].map(p=>{
 const name=fs.readdirSync(`${base}/01_素材投放区/04_纸艺视频`).find(n=>n.includes(`_${p.id}_`));assert(name);
 const beat=timeline.beats.find(b=>b.id===p.beatId);
 assert(p.startFrame>=beat.frames.startFrame&&p.endFrameExclusive<=beat.frames.endFrameExclusive);
 const durationSeconds=(p.endFrameExclusive-p.startFrame)/30;
 assert(p.sourceInSeconds+durationSeconds<=8+1e-6);
 return {...p,source:binding(`${base}/01_素材投放区/04_纸艺视频/${name}`),durationSeconds,sourceOutSeconds:p.sourceInSeconds+durationSeconds,playbackRate:1,loop:false,freezeLastFrame:false,nativeAudio:{retain:true,sourceInSeconds:p.sourceInSeconds,delayFrames:p.startFrame,mixStatus:'待正常速度试听与逐镜增益测量'},dynamicReview:'逐秒联系表已看，完整速度验收未完成'};
});
const pack=read('assets/sfx/koubo-sfx-v8/manifest.json');
const events=[
 ['开场钩子',17,'v1-section-air',.48,'开头原声开始，短空气强调，避免压第一个字'],
 ['B02',97,'v1-card-reveal',.42,'关键词说明入场'],
 ['B02',117,'v1-keyword-tick',.36,'“短板”出声时划线，不早于该词'],
 ['B18',2279,'v1-camera-shutter',.40,'AOL资料进入'],
 ['B18',2316,'v1-ui-click',.40,'AOL事实更正层进入，字音对齐'],
 ['B19',2530,'v1-node-connect',.40,'黑莓资料框选进入'],
 ['B19',2570,'v1-confirm-soft',.42,'应用团队独立事实出现，不配普通字幕'],
];
const sfx=events.map(([beatId,frame,id,volume,purpose],i)=>{
 const item=pack.items.find(x=>x.id===id);assert(item&&item.license==='CC0');
 const source=binding(item.output);assert.equal(source.sha256,item.outputSha256);
 return {id:`S${i+1}`,beatId,frame,source,volume,purpose,license:item.license,licenseReference:item.licenseReference,nominalPeakDbfs:Number((item.outputPeakDbfs+20*Math.log10(volume)).toFixed(2)),audibilityConfirmed:false};
});
assert.equal(new Set(sfx.map(s=>s.source.sha256)).size,sfx.length);
const document={schemaVersion:1,status:'edit-decision-candidate-not-rendered',productionProfile:{id:'v8-semantic-continuity-sfx',version:'V8'},fps:30,durationInFrames:3687,source:binding(`${base}/01_素材投放区/01_口播原片/copy_3241166C-5FB2-403F-A2D9-53A2B1C9393A.MOV`),timeline:binding(`${out}/实录重绑时间线.r1.json`),captions:binding(`${base}/06_实录与字幕/实录双语字幕_候选.r1.json`),shotcraft:binding(`${out}/动效选择.r1.json`),preserveFullRecording:true,paper,publicEvidence:{source:binding(`${base}/01_素材投放区/05_公开素材_Codex准备/公开资料引文.r1.json`),speakerPlacement:'bottom-left',speakerWindow:{x:60,y:610,width:330,height:250},documentWindow:{x:430,y:130,width:1390,height:700},captionArea:{x:0,y:900,width:1920,height:180},showInternalIds:false},sfx,camera:{reference:'workflow/active-production-profile.v1.json',scaleRange:[1.012,1.08],xRange:[-16,14],protectedSpeakerRegion:{x:530,y:0,width:1390,height:900},implementationStatus:'参数候选，需真实帧验证，尚未落片'},proposedPreview:{durationSeconds:36,ranges:[{startFrame:0,endFrameExclusive:178},{startFrame:656,endFrameExclusive:1077},{startFrame:2279,endFrameExclusive:2670},{startFrame:3340,endFrameExclusive:3430}],sameFrameSfxAB:true},formalEnabled:false,userPreviewApproved:false,publishAuthorized:false};
// 预览保留末镜完整8秒，不能为缩短预览截掉最后一张纸的展开结果。
document.proposedPreview.durationSeconds=41;
document.proposedPreview.ranges[3].endFrameExclusive=3580;
assert.equal(document.proposedPreview.ranges.reduce((n,r)=>n+r.endFrameExclusive-r.startFrame,0),1230);
fs.writeFileSync(`${out}/剪辑与声音落点.r1.json`,JSON.stringify(document,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({paper:paper.length,shotcraft:selection.beats.filter(b=>b.decision==='apply').length,sfx:sfx.length,fullSeconds:3687/30,previewSeconds:document.proposedPreview.durationSeconds,originalVoiceChanged:false,rendered:false}));
