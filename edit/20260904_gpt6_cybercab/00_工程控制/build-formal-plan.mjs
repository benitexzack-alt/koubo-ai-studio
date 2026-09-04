import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root = process.cwd();
const episode = 'edit/20260904_gpt6_cybercab';
const inputPlan = JSON.parse(fs.readFileSync(path.join(root,episode,'04_导演拆解/剪后261秒_素材与镜头对位.v3.json')));
const read = p => JSON.parse(fs.readFileSync(path.join(root,p)));
const write = (p,v) => {fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');};
const hash = p => createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const publicDir = 'remotion/public-gpt6-cybercab-v8-r1';
const hardlink = (src,dest) => {
  fs.mkdirSync(path.dirname(path.join(root,dest)),{recursive:true});
  if(fs.existsSync(path.join(root,dest))) {if(hash(src)!==hash(dest)) throw Error('Different existing asset: '+dest);}
  else fs.linkSync(path.join(root,src),path.join(root,dest));
};
const source = `${episode}/11_指定句剪除_r1/01_口播原片_仅剪除没有人负责_r1.mp4`;
hardlink(source,`${publicDir}/media/R01-cut.mp4`);
hardlink('remotion/public/fonts/STHeiti-Medium.ttc',`${publicDir}/fonts/STHeiti-Medium.ttc`);
const mediaAudio=[];
const gains={P01:0.22,P02:0.56,P03:0.24,P04:0.36,P05:0.42,P06:0.46};
const blank={title:'',detail:'',items:[],component:'',asset:'',trimStart:0,sourceLabel:''};
const scenes=inputPlan.paperSlots.map(p=>{
  hardlink(`${episode}/${p.asset.path}`,`${publicDir}/media/${p.id}.mp4`);
  mediaAudio.push({id:p.id,asset:`media/${p.id}.mp4`,startFrame:p.outputStartFrame,durationFrames:219,trimBeforeFrames:0,
    volume:gains[p.id],gainDb:20*Math.log10(gains[p.id]),preserveFullSourceAudio:true,sourceSha256:p.asset.sha256});
  return {...blank,id:p.id,kind:'paper',start:p.outputStartFrame/30,end:p.outputEndFrameExclusive/30,
    asset:`media/${p.id}.mp4`,title:p.purpose,items:p.labels};
});
const sources={U01:`${episode}/02_参考与官方素材/U01_用户提供发布视频_待来源核验.MP4`,
  T01:`${episode}/02_参考与官方素材/T01_Cybercab_官方现行宣传_拍摄日期未披露.mp4`};
for(const [id,p] of Object.entries(sources)) hardlink(p,`${publicDir}/media/${id}.mp4`);
for(const b of inputPlan.broll) {
  scenes.push({...blank,id:b.id,kind:'evidence',start:b.outputStartFrame/30,end:b.outputEndFrameExclusive/30,
    asset:`media/${b.assetId}.mp4`,trimStart:b.sourceIn,title:b.purpose,
    sourceLabel:b.assetId==='T01'?'Tesla官方宣传 · 拍摄日期未披露':'用户提供发布会演示素材'});
  if(b.assetId==='U01') mediaAudio.push({id:b.id,asset:'media/U01.mp4',startFrame:b.outputStartFrame,
    durationFrames:b.outputEndFrameExclusive-b.outputStartFrame,trimBeforeFrames:Math.round(b.sourceIn*30),volume:0.10,
    gainDb:-20,preserveFullSourceAudio:false,sourceSha256:hash(sources.U01)});
}
// Exact spoken anchors drive all overlay ranges; no pre-shoot wording repairs the transcript.
const semanticRows = [
  [0,265,'definition','两件科技事件','软件世界与物理世界',['GPT-6 Astra','Tesla Cybercab']],
  [265,617,'comparison','一边是模型，一边是车','本期讨论的两个对象',['GPT-6 Astra','Cybercab']],
  [617,829,'marker','和生意有什么关系','从产品变化，聊到具体的工作。',[]],
  [1211,1405,'process','从任务开始','拆解任务，再进入软件。',['业务任务','拆解步骤','操作软件']],
  [1624,1832,'status','具体工作场景','围绕信息和业务产出。',['数据整理','业务SOP','获客文案','视觉方案']],
  [1832,2003,'process','分析与流程','把注意力放到具体工作上。',['报表分析','流程优化']],
  [2003,2172,'comparison','成本与效率','本段讨论企业使用AI的目标。',['人力成本','工作效率']],
  [2172,2437,'status','重复性的工作','按工作性质来看。',['重复性','流程性','机械性']],
  [2827,3011,'process','回看汽车的变化','从动力形式到驾驶方式。',['马车','燃油车','电动车']],
  [3011,3086,'statement','服务人类驾驶员','驾驶设计围绕人展开。',[]],
  [3296,3487,'comparison','驾驶方式的变化','从人的驾驶，谈到AI驾驶。',['人为主','AI为辅']],
  [3487,3544,'statement','从驾驶员到乘坐者','Cybercab',[]],
  [3784,3912,'definition','走进物理世界','以车辆作为本段讨论对象。',['软件','现实']],
  [3912,4068,'status','虚拟世界的工作','软件系统中的任务与交付。',['软件系统','商业工作']],
  [4278,4465,'comparison','大脑与身体','这是本段的讨论视角。',['软件执行','物理执行']],
  [4465,4600,'statement','关于AGI的讨论','能力边界，还要回到具体任务。',[]],
  [4600,4850,'process','从屏幕到现实','沿着工作发生的地方展开。',['软件','实体工作','商业流程']],
  [4850,5154,'status','和本地企业有关吗','把问题放回身边。',['实体店','小工厂','小门店']],
  [5154,5418,'comparison','面对变化的两种选择','看懂趋势，也看清自己的业务。',['继续原有方法','尝试具体任务']],
  [5418,5550,'marker','回到经营现场','看看哪一段工作值得先试。',[]],
  [5550,5715,'status','面向客户的工作','本段讲到的应用方向。',['获客','营销','设计']],
  [5715,5887,'process','面向内部的工作','围绕流程和数据。',['企业SOP','数据分析','流程优化']],
  [5887,6076,'definition','工具与生意','重点回到怎么用。',['会做事','会借助AI']],
  [6076,6173,'statement','用AI服务自己的生意','从任务出发。',[]],
  [6338,6481,'marker','AI就在现在','回到实际工作里使用。',[]],
  [6481,6626,'status','从业务开始理解','不先纠结技术名词。',['听不懂','不会用','学不会']],
  [6626,6703,'definition','你懂行业，也懂生意','从熟悉的业务开始。',['行业','生意']],
  [6703,6943,'process','从落地到执行','本段讲服务内容。',['落地','优化','陪跑','执行']],
  [6943,7108,'statement','兰州 · 本地企业AI','全流程落地陪跑',[]],
  [7288,7491,'comparison','生意里的实际目标','回到具体需求与交付。',['成本','效率']],
  [7491,7676,'closing','评论区留「落地」','聊聊你的具体业务。',['门店','企业','真实工作']],
  [7676,7830,'statement','我是超哥','在兰州，深耕AI实体落地。',[]],
];
for (const [i,r] of semanticRows.entries()) scenes.push({...blank,id:`S${String(i+1).padStart(2,'0')}`,kind:'semantic',
  start:r[0]/30,end:r[1]/30,component:r[2],title:r[3],detail:r[4],items:r[5]});
scenes.sort((a,b)=>a.start-b.start);
for(let i=0;i<scenes.length;i++) {
  if(i&&Math.abs(scenes[i-1].end-scenes[i].start)>0.000001) throw Error('Coverage gap: '+scenes[i].id);
}
const manifest=read('assets/sfx/koubo-sfx-v8/manifest.json');
const sounds=manifest.items.filter(i=>i.eligibleForSfx&&i.contentKind==='sound-effect'&&fs.existsSync(path.join(root,i.output)));
const sfxCues=scenes.map((s,i)=>{
  const item=sounds[i%sounds.length];
  hardlink(item.output,`${publicDir}/audio/${path.basename(item.output)}`);
  return {id:`${s.id}-sfx`,time:s.start,src:`audio/${path.basename(item.output)}`,volume:0.22,source:item.output};
});
const chapters=[{number:'01',title:'软件与物理世界',startFrame:0},{number:'02',title:'电脑操作与交付',startFrame:829},
  {number:'03',title:'Cybercab',startFrame:2437},{number:'04',title:'从技术到生意',startFrame:3912},
  {number:'05',title:'本地企业怎么用',startFrame:4850},{number:'06',title:'人的角色与服务',startFrame:6173}];
write('remotion/src/gpt6-cybercab-v8-r1/candidate-plan.v1.json',{schemaVersion:1,revision:'gpt6-cybercab-v8-r1',
  sourcePlanSha256:hash(`${episode}/04_导演拆解/剪后261秒_素材与镜头对位.v3.json`),durationFrames:7830,durationSeconds:261,
  scenes,mediaAudio,sfxCues,chapters});
const draft=read(`${episode}/07_实录与字幕/turbo-review-r2/corrected-caption-pages.v1.json`);
const videoId='20260904_gpt6_cybercab';
write(`${episode}/04_导演拆解/visual-plan.formal-r1.json`,{schemaVersion:4,videoId,videoTitle:'GPT-6 Astra与Cybercab：从技术到生意',
  sourceVideo:source,baselineId:'koubo-formal-16x9-v1',styleReferenceIds:['v8-semantic-continuity-sfx'],
  experiment:{id:'v8-semantic-continuity-sfx',status:'scoped-direct-export-authorized'},previewCoverage:[],
  target:{width:1920,height:1080,fps:30},layers:scenes.map((s,i)=>({id:s.id,start:s.start,end:s.end,
    spokenLine:draft.captions.filter(c=>c.startMs<s.end*1000&&c.endMs>s.start*1000).map(c=>c.zh??'自动优化所有的[语音不清]').join('；'),
    purpose:s.title,kind:s.kind==='semantic'?'semantic-overlay':'full-screen-asset',overlapGroup:'primary',
    zone:s.kind==='semantic'?'left':'full-screen',titleOwner:true,
    asset:{sourceType:s.kind==='semantic'?'remotion':s.kind==='paper'?'user-generated-video':'real-evidence',
      source:s.kind==='semantic'?source:`${publicDir}/${s.asset}`},
    assetDecision:{class:s.kind==='semantic'?'remotion-information':s.kind==='paper'?'generated-video':'real-evidence',
      producer:s.kind==='semantic'?'codex-remotion':'user',requestId:`manual-${s.id}`,fallback:'blocked'},
    presentation:{semanticFamily:s.kind==='semantic'?s.component:s.kind,renderMode:s.kind==='semantic'?'speaker-overlay':'media-fullscreen',coverageRatio:s.kind==='semantic'?0.36:1},
    visualEvent:{id:`${s.id}-event`,enterAt:s.start,primary:true},sound:{policy:'required',role:s.kind==='semantic'?'node':'media',cueId:sfxCues[i].id,offsetFrames:0,maxSyncErrorFrames:2},
    params:{component:s.component,src:s.asset},checks:{needsFrameReview:true,reviewAt:Math.min(s.start+1,s.end-1/30),continuousReviewIntervalSeconds:0.5}}))});
write(`${episode}/04_导演拆解/sfx-cues.formal-r1.json`,{schemaVersion:3,videoId,version:'formal-r1',experimentId:'v8-semantic-continuity-sfx',
  cues:sfxCues.map((c,i)=>({id:c.id,visualEventId:`${scenes[i].id}-event`,role:scenes[i].kind==='semantic'?'node':'media',start:c.time,end:c.time+0.4,
    source:c.source,license:'本地V8音效审核清单',licenseReference:'assets/sfx/koubo-sfx-v8/manifest.json',volume:c.volume,voiceDuckDb:0,previewCovered:false,formalReviewed:false,userAudibilityConfirmed:false}))});
console.log(JSON.stringify({sceneCount:scenes.length,paperClips:6,mediaAudio:mediaAudio.length,publicDir,subtitleState:'awaiting-real-ASR'},null,2));
