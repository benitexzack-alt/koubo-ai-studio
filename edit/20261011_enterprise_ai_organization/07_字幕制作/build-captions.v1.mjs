import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(out,'../04_实录与字幕/enterprise-ai-organization.mlx-whisper-large-v3-turbo.raw.v1.json');
const raw=JSON.parse(fs.readFileSync(source,'utf8'));
const crossPath=path.join(out,'focus-crosscheck.raw.v1.json');
const cross=JSON.parse(fs.readFileSync(crossPath,'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const normalize=t=>t.replace(/[\s，。？！、：；,.?!:;"“”'‘’（）()《》【】\[\]·—–-]/g,'').toLowerCase();
// 只组合相邻实录段。英文逐页翻译此处的实录候选，不读取拍前稿。
const rows=[
 [[0,1],'As business owners, we are busy making media and building sales channels.',['新媒体','跑渠道']],
 [[2,3],'Upgrading products, desperately looking for customers.',['找客户']],
 [[4],'But have you considered a harsh reality?',['残酷的现实']],
 [[5,6],"At the next industry crossroads, can your business survive?",['存活下来']],
 [[7],"What matters may not be your current business results.",['业务成绩']],
 [[8,9],"It may be whether your entire organization has completed its AI overhaul.",['整个组织','AI底层改造']],
 [[10,11],"There is nothing wrong with customer acquisition or making products.",['获客','做产品']],
 [[12],"And there is nothing wrong with customer acquisition, either.",['获客']],
 [[13,14],"But in the vast majority of firms, AI is still something only the boss plays with.",['老板自己玩']],
 [[15,16,17],"Or it is only used to edit videos and write copy, just as a tool.",['工具']],
 [[18],"That is not AI transformation at all.",['AI转型']],
 [[19],"So what is a truly focused, in-depth AI overhaul?",['深度AI改造']],
 [[20,21],"It is not buying a system or installing software.",['不是买系统','不是上软件']],
 [[22,23],"It is connecting every department and bringing it to every person.",['每一个部门','每一个人']],
 [[24,25],"Let every role in the company grow into an independent super-individual.",['每一个岗位','超级个体']],
 [[26,27,28,29,30],"Sales, operations, administration, production, and business.",['销售','运营','行政','生产','业务']],
 [[31,32],"Every part, all embedded in the AI work rate.",['每一个环节','AI']],
 [[33,34],"It is not optional. Everyone must use it.",['不是可选','全员必用']],
 [[35,36],"Early in the overhaul, you do not see explosive business results.",['改造的初期','爆发式']],
 [[37],"Nor do you see results that turn into money right away.",['立刻变现']],
 [[38,39,40],"Many bosses work at it for two months and see no returns.",['两个月','收益']],
 [[41,42],"Then they give up outright, thinking AI is a gimmick.",['放弃','噱头']],
 [[43],"But this is precisely the most crucial period of laying the groundwork.",['最关键','沉淀期']],
 [[44,45],"What I am doing now is giving the whole company a new",['整个公司']],
 [[46],"underlying operating system.",['底层的操作系统']],
 [[47],"When the big AI market takes off,",['AI大市场']],
 [[48],"when industry rules are forced into a complete restructuring,",['行业规则','重构']],
 [[49,50],"other teams will be scrambling and cramming at the last minute.",['手忙脚乱','临时补课']],
 [[51],"Their internal processes will all be disconnected.",['流程','脱节']],
 [[52],"An era that talent cannot keep up with.",['人才','时代']],
 [[53],"When market competition leaves them unable to advance or retreat,",['进退两难']],
 [[54,55],"everyone in your company is already skilled at thinking, collaborating, and working with AI.",['AI','思考','协作','干活']],
 [[56],"Each person is an efficient super-individual.",['高效','超级个体']],
 [[57,58],"Then individual abilities add up, together pushing the whole company forward.",['个体能力','合力']],
 [[59],"Others are forced to catch up.",['被迫追赶']],
 [[60,61],"You are the one who prepared ahead, the first to take the plunge.",['提前布局','第一个']],
 [[62,63],"In the future, competition between businesses",['企业的竞争']],
 [[64,65],"is no longer a single-point comparison of products and channels.",['产品和渠道','单点对比']],
 [[66],"It is a contest of how AI-enabled the whole organization is.",['整个组织','AI化程度']],
 [[67],"An early overhaul may not bring an immediate win.",['不一定马上赢']],
 [[68],"But without one, you may go out at the next crossroads.",['不改造','下一个路口']],
 [[69],"Is your company truly ready to welcome the AI era?",['准备好','AI时代']],
 [[70],"If your company wants an in-depth, company-wide AI overhaul",['全员AI深度改造']],
 [[71],"but does not know where to start,",['哪里开始']],
 [[72,73],"leave your industry in the comments, and I will break it down in detail.",['你的行业','详细拆解']],
 [[74,75],"I am Chao Ge, focused on enterprise AI implementation services in Lanzhou.",['超哥','兰州','企业AI落地服务']],
];
const words=raw.segments.flatMap(s=>s.words.map((w,i)=>({...w,text:w.word,raw_text:w.word,verbatim_text:w.word,segmentId:s.id,segmentWordIndex:i,type:'word',speaker_id:'speaker_0',confidence:w.probability})));
words.forEach((w,i)=>w.sourceWordIndex=i);
const defs=[
 [9,'AA','AI',1,'I','proper-noun-spelling','W01'],
 [10,'货客','获客',0,'获','unmistakable-asr-error','W01'],
 [12,'货客','获客',0,'获','unmistakable-asr-error','W01'],
 [14,'AA','AI',1,'I','proper-noun-spelling','W02'],
 [19,'成下心','沉下心',5,'沉','unmistakable-asr-error','W03'],
 [42,'AA','AI',1,'AI','proper-noun-spelling','W05'],
 [47,'AA','AI',2,'AI','proper-noun-spelling','W06'],
];
const corrections=defs.map(([segmentId,from,to,index,text,type,windowId],i)=>{
 const w=words.find(w=>w.segmentId===segmentId&&w.segmentWordIndex===index);
 const before=w.text; w.text=text;w.verbatim_text=text;
 return {id:`COR-${i+1}`,segmentId,from,to,type,status:'machine-candidate-applied',humanListeningPerformed:false,userConfirmed:false,evidence:`本期原声独立短窗 ${windowId}；仅专名或同音正字候选，不代表听辨确认。`,crosscheckText:cross.windows.find(w=>w.id===windowId).text,wordChanges:[{sourceWordIndex:w.sourceWordIndex,from:before,to:text,start:w.start,end:w.end}]};
});
const segments=raw.segments.map(s=>({id:s.id,start:s.start,end:s.end,raw_text:s.text,text:words.filter(w=>w.segmentId===s.id).map(w=>w.text).join(''),sourceWordIndices:words.filter(w=>w.segmentId===s.id).map(w=>w.sourceWordIndex)}));
const used=rows.flatMap(r=>r[0]);if(used.length!==segments.length||used.some((v,i)=>v!==i))throw Error('没有全文逐段顺序覆盖');
const captions=rows.map(([ids,en],i)=>({id:`C${String(i+1).padStart(3,'0')}`,start:segments[ids[0]].start,end:segments[ids.at(-1)].end,zh:ids.map(id=>segments[id].text).join('，')+'。',en}));
const runtime=captions.map((c,i)=>({id:c.id,from:Math.max(0,Math.round(c.start*30)),to:Math.min(4385,Math.round(c.end*30)),chinese:c.zh,english:c.en,highlights:rows[i][2].filter(h=>c.zh.includes(h))}));
const pendingItems=[
 {id:'REVIEW-01',segmentIds:[32],start:50.74,end:53,raw:'全部嵌入AI工作率',crosscheck:'全部嵌入AA工作里',applied:false,reason:'率/里/流等尾音未解决；保守保留整段原始率，不从拍前稿恢复。英文按当前率候选译work rate。'},
 {id:'REVIEW-02',segmentIds:[52],start:88.5,end:90.1,raw:'人才跟不上的时代',crosscheck:'人才跟不上的时代',applied:false,reason:'两次机器识别一致，保留的，不顺句。'},
 {id:'REVIEW-03',segmentIds:[65],start:118.5,end:119.22,raw:'单点对比',crosscheck:'单点对比',applied:false,reason:'两次机器识别一致，保留对比，不按拍前稿改比拼。'},
 {id:'REVIEW-04',segmentIds:[68],start:125.74,end:129.2,raw:'但不改造很可能在下一个路口出去',crosscheck:'但不改造很可能在下一个路口出去',applied:false,reason:'两次机器识别一致，保留出去，不按拍前稿改出局。'},
];
pendingItems.forEach(p=>Object.assign(p,{status:'machine-candidate-not-human-reviewed',humanListeningPerformed:false,userConfirmed:false}));
const transcript={schema_version:1,schemaVersion:'enterprise-ai-organization-spoken-candidate/v1',language:'zh',source,rawSourceSha256:hash(source),sourceVideoSha256:'6547a15055ec44a5765f054816e2f9555ce1524b4f8664dbbeb6bce1fa8712bb',duration_seconds:146.145011,raw_text:raw.text,text:words.map(w=>w.text).join(''),method:'全段离线ASR加独立音频短窗机器复核；时间词槽不变，专名和同音正字有记录；不读取拍前稿。',reviewStatus:'machine-candidate-unreviewed',humanListeningPerformed:false,finalHumanAcceptance:false,words,segments};
const policy={schemaVersion:1,canonicalSource:'recorded-audio',scriptRole:'comparison-only',captionTextPolicy:'spoken-verbatim',englishTranslationSource:'canonical-spoken-chinese',sourceVideoSha256:transcript.sourceVideoSha256,sourceTranscript:source,sourceTranscriptSha256:hash(source),candidateTranscript:path.join(out,'transcript.canonical-candidate.v1.json'),verification:{minimumGlobalPrecision:1,minimumGlobalCoverage:1,corrections,humanListeningPerformed:false,correctionsUserConfirmed:false,finalHumanAcceptance:false,sourceWordTimingUnchanged:true,allRawWordsRetained:true},compliance:{status:'passed',scope:'normalized-candidate-words-and-captions-mechanical-identity-only',precision:1,coverage:1,warning:'只指候选与字幕机械同源；疑词未解决，不代表人耳听辨、英文人工审核或整片确认。'},review:{status:'pending-human-review',humanListeningPerformed:false,correctionsUserConfirmed:false,finalHumanAcceptance:false,downstreamFinalReleaseAllowed:false,pendingItems}};
if(normalize(captions.map(c=>c.zh).join(''))!==normalize(transcript.text))throw Error('实录候选与分页字幕全文不一致');
for(let i=0;i<runtime.length;i++){const c=runtime[i];if(c.from>=c.to||c.to>4385||(i&&c.from<runtime[i-1].to))throw Error('帧窗不合法');if([...captions[i].zh.replace(/[，。]/g,'')].length>28)throw Error('分页超过28字');}
const checks={schemaVersion:'caption-candidate-check/v1',status:'mechanically-passed-not-human-reviewed',fps:30,durationFrames:4385,sourceDurationSeconds:146.145011,pageCount:captions.length,rawSegmentCount:raw.segments.length,sourceWordCount:words.length,allSegmentsCoveredInOrder:true,allSourceWordSlotsRetained:true,sourceWordTimingUnchanged:true,normalizedChineseIdentity:true,firstCaptionFrame:runtime[0].from,lastCaptionFrame:runtime.at(-1).to,maxChineseCharacters:Math.max(...captions.map(c=>[...c.zh.replace(/[，。]/g,'')].length)),humanListeningPerformed:false,pendingItems,corrections};
for(const [name,data] of [['captions.v1.json',captions],['captions.runtime.v1.json',runtime],['transcript.canonical-candidate.v1.json',transcript],['spoken-source-policy.v1.json',policy],['caption-checks.v1.json',checks],['correction-candidates.v1.json',{corrections,pendingItems,crosscheckSource:crossPath,crosscheckSha256:hash(crossPath),humanListeningPerformed:false}],['caption-bindings.v1.json',rows.map(([ids],i)=>({captionId:captions[i].id,segmentIds:ids,sourceWordIndices:words.filter(w=>ids.includes(w.segmentId)).map(w=>w.sourceWordIndex)}))]])fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({pages:captions.length,words:words.length,frames:4385,maxChineseCharacters:checks.maxChineseCharacters,status:checks.status,pending:pendingItems.length}));
