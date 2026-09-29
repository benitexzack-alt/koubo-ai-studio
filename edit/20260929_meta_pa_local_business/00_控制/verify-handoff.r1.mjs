import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const ep='edit/20260929_meta_pa_local_business',absolute=path.resolve(ep);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const put=(p,x)=>fs.writeFileSync(path.join(absolute,p),typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');
const get=p=>JSON.parse(fs.readFileSync(path.join(absolute,p),'utf8'));
const publicDir=path.join(absolute,'01_素材投放区/05_公开素材_Codex准备');
const old=get('01_素材投放区/05_公开素材_Codex准备/采集回执.r1.json');
const additions={
 'S02_Meta二季报官方.pdf':['https://s21.q4cdn.com/399680738/files/doc_news/Meta-Reports-Second-Quarter-2026-Results-2026.pdf','Meta投资者关系','直接取得官方PDF'],
 'S02_Meta二季报原页截图.png':['https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Second-Quarter-2026-Results/','Meta投资者关系','浏览器真实原页截图'],
 'S03_千问生态原页截图.png':['https://www.alibabagroup.com/zh-HK/document-1948497434959151104','阿里巴巴集团','浏览器完整页归档；长图不直接全屏上片'],
 'S03_千问生态正文视窗.png':['https://www.alibabagroup.com/zh-HK/document-1948497434959151104','阿里巴巴集团','浏览器当前正文视窗，已视觉检查'],
 'S04_千问淘宝原页截图.png':['https://www.alibabagroup.com/zh-HK/document-1991231293551017984','阿里巴巴集团','浏览器真实原页截图'],
 'S06_收费计划报道原页.png':['https://finance.yahoo.com/technology/article/metas-zuckerberg-says-muse-ai-agent-will-take-a-small-fee-from-transactions-234639802.html','Yahoo Finance / Daniel Howley','浏览器读取正文并存截图；只取必要短引文，不包含今天动态行情'],
 'S07_九月二十一日股价报道原页.png':['https://finance.yahoo.com/technology/article/meta-stock-soars-11-on-price-target-increase-muse-ai-downloads-180423756.html','Yahoo Finance / Daniel Howley','浏览器读取当日原报道并存截图；不包含今天动态行情'],
};
const entries=[];
for(const name of fs.readdirSync(publicDir).filter(n=>/\.(png|html|pdf|mp4)$/.test(n))){
 const p=path.join(publicDir,name),previous=old.entries.find(e=>e.name===name),meta=additions[name];
 if(!previous&&!meta)throw Error('未登记来源:'+name);
 let probe=null,decode=false;
 if(name.endsWith('.mp4')){
  probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size:stream=index,codec_name,width,height,codec_type,r_frame_rate','-of','json',p],{encoding:'utf8'}));
  execFileSync('ffmpeg',['-hide_banner','-v','error','-i',p,'-f','null','-'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});decode=true;
 }
 entries.push({name,path:path.relative(process.cwd(),p),sha256:hash(p),bytes:fs.statSync(p).size,sourceUrl:meta?.[0]||previous.url,sourceName:meta?.[1]||previous.source,acquisitionNote:meta?.[2]||(name==='I01_千问淘宝官方图.png'?'浏览器已观察资产导出；图片已看':name.endsWith('.mp4')?'中断后按原URL续传，完整解码通过':previous.purpose),status:decode?'download-complete-decode-passed':'download-complete',probe,decodePassed:decode||null,productionApproved:false,rights:'来源公开；本期评论必要引用候选，授权/引用范围待复核，不含背景音乐许可',observedAt:new Date().toISOString()});
}
put('01_素材投放区/05_公开素材_Codex准备/采集回执.r2.json',{supersedesForAvailabilityOnly:'采集回执.r1.json',entries,count:entries.length,originalFilesModified:false,fullArticleRepublishingAllowed:false,sourceVideoMusicAllowed:false,statement:'采集与技术可用性不等于正式生产或版权全部放行。'});
const cues=get('03_导演拆解/director-cues.v2.json'),timeline=get('03_导演拆解/实录候选时间锚点.r1.json');
const source=fs.readFileSync(path.join(absolute,'06_实录核对/实录候选_导演覆盖输入.txt'),'utf8');
const normalize=s=>s.replace(/\s+/g,'');
if(normalize(cues.semanticBeats.map(x=>x.scriptQuote).join(''))!==normalize(source))throw Error('实录覆盖不完整');
let next=0;const insertions=[];
for(const b of timeline.beats){
 if(b.asrSegmentIds[0]!==next)throw Error('分段遗漏/重复:'+b.beatId);next=b.asrSegmentIds[1]+1;
 if(b.insertStartSeconds!==null){if(b.insertStartSeconds<b.startSeconds-0.001||b.insertStartSeconds+b.insertDurationSeconds>b.endSeconds+0.001)throw Error('插片越出语义段:'+b.beatId);insertions.push({id:b.routeCueId,start:b.insertStartSeconds,end:b.insertStartSeconds+b.insertDurationSeconds});}
}
for(let i=1;i<insertions.length;i++)if(insertions[i].start<insertions[i-1].end-0.001)throw Error('插片重叠');
const mapping=get('03_导演拆解/公开素材镜头映射.r1.json');
for(const item of mapping)if(!fs.existsSync(item.candidatePath))throw Error('公开素材缺失:'+item.id);
const structural=JSON.parse(execFileSync('node',['skills/koubo-remotion-director/scripts/validate-director-cues-v2.mjs','--input',`${ep}/03_导演拆解/director-cues.v2.json`,'--repo-root','.'],{encoding:'utf8'}));
const link='/Users/pc/Desktop/口播素材/2026-09-29_Meta个人助理与本地商家';
fs.mkdirSync(path.dirname(link),{recursive:true});
let linkStatus='verified';
if(fs.existsSync(link)||(()=>{try{fs.lstatSync(link);return true;}catch{return false;}})()){
 try{if(!fs.lstatSync(link).isSymbolicLink()||fs.realpathSync(link)!==absolute)linkStatus='素材入口待处理';}catch{linkStatus='素材入口待处理';}
}else fs.symlinkSync(absolute,link,'dir');
put('00_控制/桌面入口回执.v1.json',{entry:link,target:absolute,resolved:linkStatus==='verified'?fs.realpathSync(link):null,status:linkStatus,noDuplicateProjectCreated:true,existingEntryOverwritten:false,instructions:path.join(absolute,'01_素材投放区/投放说明.md')});
if(linkStatus!=='verified')throw Error(linkStatus);
const ownDocs=['03_导演拆解/本期导演方案.md','03_导演拆解/给您制作_首帧与视频提示词.md','03_导演拆解/事实与公开资料边界.md','04_动效与声音计划/上期问题核查与本期执行边界.md','06_实录核对/实录与文稿核对说明.md'];
put('00_控制/交接检查.r1.json',{checkedAt:new Date().toISOString(),structural,recording:{path:JSON.parse(fs.readFileSync(`${ep}/00_控制/原片入库.json`)).copy,completeDecodePassed:true,assistantFullListening:false,transcriptStatus:'local-asr-not-human-verified'},coverage:{segments:next,beats:cues.semanticBeats.length,exactTextCovered:true,insertWithinSemanticWindow:true,noInsertionOverlap:true},publicAssets:{downloaded:entries.length,videosCompleteDecodePassed:entries.filter(e=>e.decodePassed).length,allEightSlotsHaveCandidateFile:true,productionApproval:false},desktopLink:linkStatus,documents:ownDocs.map(p=>({path:p,sha256:hash(path.join(absolute,p))})),downstreamGenerated:false,rendered:false,published:false,qualityApproval:'待用户审阅方案，素材回来后动态与听感验收',scope:'director-planning-and-user-authorized-public-collection'});
const readDocs=[['skills/koubo-remotion-director/SKILL.md','阶段仅做完整导演规划'],['skills/koubo-remotion-director/references/semantic-visual-director.v2.md','全文四路择一，事实核验与画面选择分开'],['skills/koubo-remotion-director/references/paper-quality-baseline-20260829.md','首帧中文、字物同动、原生声'],['knowledge/20-V8连续语义动效与可感知音效基线.md','核查上期连续语义层和声音退步'],['skills/koubo-shotcraft-library/SKILL.md','仅核查当前能力索引与上期选择差距，未运行本期正式选卡']];
put('00_控制/本轮读取与应用.json',{taskContextId:'task-20260929T161029Z-4fd52ece',entries:readDocs.map(([p,use])=>({path:p,sha256:hash(p),retrieved:true,read:true,applied:true,application:use})),memoryUse:'历史记忆只提示实录优先；本轮使用当前文件复核，未将记忆当作实际听审。'});
put('请先看这里.md',`# 本期交接｜Meta个人AI助理与本地商家\n\n原片已入库：6分49.5秒，横屏1080P。原声不改；未听审的本地转写不会直接用作字幕。\n\n先看[导演方案](03_导演拆解/本期导演方案.md)，再看[给您制作的提示词](03_导演拆解/给您制作_首帧与视频提示词.md)。\n\n本次建议7条纸艺＋1条生活情景；8处公开素材位已有候选文件（含2条完整官方视频、官方图片、PDF和页面截图，共${entries.length}个文件）。28处动效机会及动作声音已逐项设计，尚未选卡实装或试听。\n\n## 您准备什么\n\n确认方案后，按提示词制作P01—P07和G01。首帧准确带字，先检查再生成视频；保留原生动作声。纸艺放04_纸艺视频，情景放03_AI情景视频，不需重复上传原片。\n\n桌面入口：${link}\n\n## Codex负责什么\n\n公开资料已存05分区；素材收齐和方案确认后，负责实际字幕核对、Remotion、对应音效、公开资料左下真人和字幕安全区、正常速度视听小样。未获授权不直接渲染成片或发布。\n\n[上期为什么动效少、声音不明显](04_动效与声音计划/上期问题核查与本期执行边界.md)\n\n[实录与文稿疑点](06_实录核对/实录与文稿核对说明.md)｜[事实与来源边界](03_导演拆解/事实与公开资料边界.md)\n\n当前需单独确认：新增日活句的口径说明、订房“不遗漏”句的实际说法及处理方式；都未擅自改原声和字幕。\n\n当前状态是导演候选与素材交接，不是新片动效已经实现，更不是已经修好声音。\n`);
console.log(JSON.stringify({publicFiles:entries.length,fullCoverage:next,beats:cues.semanticBeats.length,desktop:link,structure:structural.ok}));
