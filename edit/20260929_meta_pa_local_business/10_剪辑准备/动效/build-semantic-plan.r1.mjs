import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const episode = 'edit/20260929_meta_pa_local_business';
const out = `${episode}/10_剪辑准备/动效`;
const runtime = 'remotion/src/meta-pa-local-business-r1/semantic';
const source = `${episode}/10_剪辑准备/字幕/meta-pa.actual.canonical.r1.json`;
const anchorsPath = `${episode}/03_导演拆解/实录候选时间锚点.r1.json`;
const transcript = JSON.parse(fs.readFileSync(source));
const anchors = JSON.parse(fs.readFileSync(anchorsPath));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const normalize = text => String(text).replace(/AEA|AA/gu, 'AI').replace(/千万|签问/gu, '千问').replace(/非洲/gu, '飞猪').replace(/宛入住/gu, '晚入住').replace(/[\p{P}\p{Z}\s]/gu, '');
const beat = id => anchors.beats.find(b => b.beatId === id);
const quote = id => { const b=beat(id); return transcript.segments.filter(s=>s.id>=b.asrSegmentIds[0]&&s.id<=b.asrSegmentIds[1]).map(s=>s.text).join(''); };
const phraseAt = (id, phrase) => {
  const b=beat(id), mapped=[];
  const words=transcript.words.filter(w=>w.sourceSegment>=b.asrSegmentIds[0]&&w.sourceSegment<=b.asrSegmentIds[1]);
  for(const w of words) { const chars=[...normalize(w.text)]; chars.forEach((char,i)=>mapped.push({char,at:w.start+(w.end-w.start)*i/Math.max(1,chars.length)})); }
  // ASR 把英语缩写拆成两个词时，仅统一搜索索引；没有更改字幕或录音。
  for(let i=0;i+1<mapped.length;i++) if(mapped[i].char==='A'&&mapped[i+1].char==='A') mapped[i+1].char='I';
  const target=normalize(phrase), haystack=mapped.map(m=>m.char).join(''), at=haystack.indexOf(target);
  if(at<0) throw new Error(`本期实录不存在效果文字:${id}:${phrase}`);
  return mapped[at].at;
};
// 每个对象维持、推进、回落。文字均从本条实录抽取；不补回拍前未说出的文案。
const specs = [
  ['B01','直接关键词','AI','挑选商家',['先问AI'],'找得到','direct'],
  ['B02','逐项条件','业务条件','查得到',['什么服务','什么条件能接','预约从哪里进'],'','process'],
  ['B06','路径接通','选择路径','刷到广告',['自己去挑','直接交代','你帮我去找'],'','process'],
  ['B07','定义落点','个人助理','PA',[],'个人的AI助理','direct'],
  ['B11','重点圈定','先核对','取消怎么收费',[],'帮我看清楚','direct'],
  ['B14','条件更新','变化条件','日期',['人数','预算','再去确认'],'','process'],
  ['B18','入口延续','顾客入口','多看你一眼',['平台上的位置','视频','推荐'],'','process'],
  ['B19','候选名单','顾客入口','筛选出来的几家',[],'未必看得到','direct'],
  ['B20','入口转移','顾客入口','受到挑战',[],'慢慢的去挑','direct'],
  ['B22','双层关系','入口与服务','入口优势',['可能会松动','商品售后','仍然会参与到竞争'],'','process'],
  ['B29','双路径对照','两种走法','手机里替你操作',['已有的这个生意','接进对话','商家商品交易服务'],'','process'],
  ['B30','三问接通','企业应用','模型会说什么',['哪些业务信息','哪项服务','由谁来'],'','process'],
  ['B32','问题清单','常见问题','顾客常问什么',['免费停车还是收费','需要提前联系'],'','process'],
  ['B34','差异定位','真实业务核对','常见的问题',['哪些没有写','哪些已经过时','写的不一样'],'服务为准','process'],
  ['B35','核对闭环','检查回答','真实的信息',['查得到','理解准确','怎么回答的','依据是从哪里来的'],'','process'],
  ['B37','定位断点','定位断点','断在了哪里',['资料缺了','预约的页面打开','需要前台确认'],'','process'],
  ['B38','结论强调','已有功能','能用的功能先用',[],'','direct'],
  ['B39','角色接力','分工','老板知道',['答应客户','员工能用','检查结果'],'','process'],
  ['B40','可执行检查','现在就检查','店里的一项服务',['地址服务条件','联系方式和预约','出处'],'','process'],
  ['B41','服务落点','本地服务','企业AI应用',[],'GEO','direct'],
];

const exceptions = {
  // 本地识别把“接进对话”写为“接近对话”；两个字不能靠文稿强改。
  B29: {items:['已有的这个生意','对话','商家商品交易服务']},
  // GEO 的拼写由字幕工作者按音证修正；本层暂不提前附加待核词形。
  B41: {detail:''},
};
const layers = specs.map(([id, family, label, title, rawItems, rawDetail, component]) => {
  const b=beat(id), ex=exceptions[id]??{}, items=ex.items??rawItems, detail=ex.detail??rawDetail;
  const start=phraseAt(id,title), end=b.endSeconds;
  const atItems=items.map(item=>phraseAt(id,item)), detailAt=detail?phraseAt(id,detail):null;
  const y = id==='B01'?84:96;
  return {
    id:`semantic-${id}`, beatId:id, route:'speaker', family,
    start: Math.round(start*30)/30, end:Math.round(end*30)/30,
    title, detail, items,
    params:{component,label,itemFrames:atItems.map(at=>Math.max(0,Math.round((at-start)*30))),detailFrame:detailAt==null?0:Math.max(0,Math.round((detailAt-start)*30))},
    layout:{x:64,y,width:528,maxHeight:420,componentTranslation:{x:-16,y:y-(component==='direct'?164:144)},actualTitleFontPixels:48,actualBodyFontPixels:35.2,opaque:false,coverageUpperBound:528*420/(1920*1080)},
    textAuthority:'actual-recording', quote:quote(id),
    protectedRegions:[{x:790,y:0,width:1040,height:870},{x:0,y:510,width:1920,height:390},{x:0,y:900,width:1920,height:180}],
    approval:'candidate-preview-required',
  };
});

const events=[];
for(const layer of layers){
  events.push({id:`${layer.id}-enter`,beatId:layer.beatId,actionId:`${layer.id}:title`,startSeconds:layer.start,endSeconds:layer.start+0.32,role:layer.beatId==='B01'?'hook-accent':layer.params.component==='process'?'path-enter':'keyword',priority:layer.beatId==='B01'?'high':'medium',visualAction:'关键词或主对象进入',text:layer.title});
  const lastAt=layer.params.detailFrame>0?layer.params.detailFrame:layer.params.itemFrames.at(-1);
  if(lastAt>0) events.push({id:`${layer.id}-settle`,beatId:layer.beatId,actionId:`${layer.id}:last-node`,startSeconds:Math.round((layer.start+lastAt/30)*30)/30,endSeconds:Math.round((layer.start+lastAt/30)*30)/30+0.2,role:layer.beatId==='B01'?'hook-question':layer.params.component==='process'?'node-confirm':'keyword-detail',priority:'light',visualAction:'同一对象推进到最后节点或重点结果',text:layer.detail||layer.items.at(-1)});
}
// 真实资料每个镜头一个进入声，聚焦音点另由实际框选合同绑定，不对普通字幕配音。
for(const b of anchors.beats.filter(b=>b.primaryRoute==='real-evidence')) events.push({id:`evidence-${b.routeCueId}-enter`,beatId:b.beatId,actionId:`${b.routeCueId}:media-enter`,startSeconds:b.insertStartSeconds,endSeconds:b.insertStartSeconds+0.3,role:'evidence-enter',priority:'light',visualAction:'真实资料视窗进入',text:null});
const plan={schemaVersion:'koubo-episode-continuous-semantic-plan/v1',taskId:'meta-pa-local-business-20260929-director-r1',revisionId:'meta-pa-preview-r1',productionProfile:{id:'v8-semantic-continuity-sfx',version:'V8'},inputs:{transcript:{path:source,sha256:sha(source)},anchors:{path:anchorsPath,sha256:sha(anchorsPath)}},status:'candidate-ready-not-user-accepted',layers,policy:{paperGeneratedOverlay:false,modifySharedV8:false,actualSpokenTextOnly:true,maximumCoverage:.42,avoidFullScreenInformationBoard:true}};
const sound={schemaVersion:'koubo-semantic-sound-events/v1',taskId:plan.taskId,revisionId:plan.revisionId,status:'audio-source-assignment-and-audibility-pending',userAudibilityConfirmed:false,events:events.sort((a,b)=>a.startSeconds-b.startSeconds),policy:{voice:'retain-original-no-edit-no-retime',paperNativeAudio:'preserve-usable-native-actions-under-voice',subtitleSounds:false,maximumMainPlusLightPerObject:2,firstAccent:'hook core phrase, not a leading blast',sourceAssignment:'root-selects-local-licensed-variants-measured-by-rms-and-peak',repetition:'no same source within 25 seconds or consecutive; default at most three times per source'}};
fs.mkdirSync(path.join(root,runtime),{recursive:true});
for(const [file,body] of [[`${out}/continuous-semantic-plan.r1.json`,plan],[`${out}/semantic-sound-events.r1.json`,sound],[`${runtime}/semantic-plan.r1.json`,plan]]) fs.writeFileSync(file,JSON.stringify(body,null,2)+'\n');
console.log(JSON.stringify({layers:layers.length,soundEvents:events.length,maximumCoverage:Math.max(...layers.map(l=>l.layout.coverageUpperBound)),generatedVideoOverlayCount:0,shotcraftSelectionStillPending:true},null,2));
