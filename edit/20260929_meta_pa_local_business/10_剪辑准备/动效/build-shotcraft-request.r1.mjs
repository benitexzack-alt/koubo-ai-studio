import fs from 'node:fs';
import crypto from 'node:crypto';

const episode='edit/20260929_meta_pa_local_business';
const dir=`${episode}/10_剪辑准备/动效`;
const captions=`${episode}/10_剪辑准备/字幕/meta-pa.actual.bilingual.r1.json`;
const canonical=JSON.parse(fs.readFileSync(`${episode}/10_剪辑准备/字幕/meta-pa.actual.canonical.r1.json`));
const anchors=JSON.parse(fs.readFileSync(`${episode}/03_导演拆解/实录候选时间锚点.r1.json`));
const semantic=JSON.parse(fs.readFileSync(`${dir}/continuous-semantic-plan.r1.json`));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const bind=file=>({path:file,sha256:hash(file)});
const fullQuote=b=>canonical.segments.filter(s=>s.id>=b.asrSegmentIds[0]&&s.id<=b.asrSegmentIds[1]).map(s=>s.text).join('');
const windowQuote=(start,end)=>canonical.words.filter(w=>w.start<end&&w.end>start).map(w=>w.text).join('');
const quoteKeys={B03:['Meta'],B04:['98%'],B05:['Muse'],B08:['云端浏览器','确认'],B16:['推荐一家店'],B17:['开店的老板'],B23:['11%'],B24:['未来','收取它的费用'],B25:['走法'],B26:['手机系统'],B27:['淘宝','高德'],B28:['商品订单物流和售后'],B42:['我是超哥']};
const intentions={B01:['opening','emphasis','question'],B02:['list','process'],B06:['comparison','process'],B07:['emphasis'],B11:['emphasis','question'],B14:['list'],B18:['list'],B19:['selection','emphasis'],B20:['transformation'],B22:['hierarchy','process'],B29:['comparison','process'],B30:['question','process'],B32:['list'],B34:['correction','process'],B35:['process'],B37:['process','selection'],B38:['emphasis','conclusion'],B39:['process'],B40:['process','list'],B41:['emphasis']};
const evidenceHeaders={B23:'stock-header.png',B24:'fee-header.png'};
const beats=[];

for(const b of anchors.beats){
  const layer=semantic.layers.find(l=>l.beatId===b.beatId);
  const main=b.primaryRoute==='ai-generated-video'?'generated-video':b.primaryRoute;
  const isGenerated=['paper-editorial','generated-video'].includes(main);
  if(isGenerated){
    const enter=b.insertStartSeconds,exit=enter+b.insertDurationSeconds;
    const pieces=[['-before','speaker',b.startSeconds,enter],['',main,enter,exit],['-after','speaker',exit,b.endSeconds]].filter(p=>p[3]-p[2]>.015);
    for(const [suffix,route,start,end] of pieces){
      const q=windowQuote(start,end);
      const piece={beatId:b.beatId+suffix,mainVisual:route,frames:{startFrame:Math.round(start*30),endFrameExclusive:Math.round(end*30)},quote:q||fullQuote(b),purpose:route==='speaker'?'该插片前后保留真人语句衔接，已验收生成素材承担主体解释':'已验收生成素材完整承担情景或机制解释',semanticIntents:[],materialClass:route==='speaker'?'talking-head':'generated-media',energy:'low',existingVisualSufficiency:'high',keyPhrases:[]};
      if(route==='speaker'){piece.region={x:64,y:96,width:528,height:390};piece.protectedRegions=[{x:790,y:0,width:1040,height:870},{x:0,y:510,width:1920,height:390},{x:0,y:900,width:1920,height:180}];}
      beats.push(piece);
    }
    continue;
  }
  const q=fullQuote(b), real=main==='real-evidence';
  const keys=(layer?[layer.title,...layer.items].slice(0,4):(quoteKeys[b.beatId]??[])).filter(k=>q.includes(k));
  const target={beatId:b.beatId,mainVisual:main,frames:{startFrame:Math.round(b.startSeconds*30),endFrameExclusive:Math.round(b.endSeconds*30)},quote:q,purpose:real?(evidenceHeaders[b.beatId]?'真实报道原文标题框选，核对口播对应重点而非制造数据':'真实原文或官方视频已独立上屏，保持读资料空间，不额外堆叠'):layer?`${layer.family}：围绕同一个对象连续解释${layer.title}`:'保留真人表演和该段衔接，不额外制造信息任务',semanticIntents:real?['evidence']:intentions[b.beatId]??[],materialClass:real?'document':'talking-head',energy:b.beatId==='B01'?'high':'medium',existingVisualSufficiency:layer?'medium':'high',keyPhrases:keys,region:real?{x:500,y:200,width:1180,height:236}:{x:64,y:96,width:528,height:390},protectedRegions:real?[{x:60,y:600,width:340,height:250},{x:0,y:900,width:1920,height:180}]:[{x:790,y:0,width:1040,height:870},{x:0,y:510,width:1920,height:390},{x:0,y:900,width:1920,height:180}]};
  if(evidenceHeaders[b.beatId]) target.evidence={asset:bind(`remotion/public/media/meta-pa-local-business-r1/media/${evidenceHeaders[b.beatId]}`),rect:{x:20,y:80,width:1140,height:145},claimBoundary:'短引真实报道标题；新闻归属和发表日期保留，不将动态今日行情替代事件日期，也不把收费计划表述为已执行'};
  beats.push(target);
}
const request={schemaVersion:'koubo-shotcraft-auto-match-request/v1',taskId:'meta-pa-local-business-20260929-director-r1',revisionId:'meta-pa-preview-r1',directorProfile:{profileId:'paper-editorial-director-v9',profileVersion:'9.1.0'},subtitleAuthority:'actual-recording',registry:bind('skills/koubo-shotcraft-library/registry.v1.json'),library:bind('skills/koubo-shotcraft-library/upstream/gallery/api/library.json'),capabilityIndex:bind('skills/koubo-shotcraft-library/card-capability-index.v2.json'),experienceLedger:bind('skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json'),componentModule:bind('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx'),captions:bind(captions),canvas:{width:1920,height:1080,fps:30,durationInFrames:12286},beats};
fs.writeFileSync(`${dir}/shotcraft-auto-match-request.r1.json`,JSON.stringify(request,null,2)+'\n');
console.log(JSON.stringify({status:'本期字幕哈希已绑定',semanticBeats:anchors.beats.length,actualVisualWindows:beats.length,eligibleWindows:beats.filter(b=>['speaker','real-evidence'].includes(b.mainVisual)).length,generatedWindows:beats.filter(b=>['paper-editorial','generated-video'].includes(b.mainVisual)).length},null,2));
