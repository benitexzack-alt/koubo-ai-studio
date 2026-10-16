import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const base = 'edit/20261016_musk_grok_business_ai/04_后期准备/动效匹配';
const directorPath = 'edit/20261016_musk_grok_business_ai/04_后期准备/实录导演重绑候选.v1.json';
const rawPath = 'edit/20261016_musk_grok_business_ai/04_后期准备/实录转写/musk-grok-business-ai.mlx-whisper-large-v3-turbo.raw.v1.json';
const sourcePath = 'edit/20261016_musk_grok_business_ai/01_素材投放区/01_口播原片/copy_7BB13FE6-D6AA-467C-9A11-D944F0BD6F88.MOV';
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const binding = p => ({path:p,sha256:hash(p)});
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const writeNew = (name, obj) => {
 const target=path.join(root,base,name), body=JSON.stringify(obj,null,2)+'\n';
 if(fs.existsSync(target) && fs.readFileSync(target,'utf8')===body)return;
 fs.writeFileSync(target,body,{flag:'wx'});
};
const director = read(directorPath), raw = read(rawPath);
if (director.sourceTranscriptSha256 !== hash(rawPath)) throw new Error('实录输入哈希不一致');
// 这里只制作扫描器所需的实录快照。保留全部原始 ASR，包括疑词；不得用于成片字幕。
const captionsName = '实录扫描输入_原始ASR80段.v1.json';
writeNew(captionsName,{
 schemaVersion:'shotcraft-candidate-caption-snapshot/v1',status:'raw-asr-matching-only',
 source:binding(rawPath),humanReviewed:false,approvedForSubtitle:false,
 captions:raw.segments.map(s=>({id:s.id,startMs:Math.round(s.start*1000),endMs:Math.round(s.end*1000),zh:s.text})),
});
// 数值来自逐段语义判断，仅为扫描输入，不代表观感验收。high 不用于掩盖未适配。
// 每项：意图、语义说明、素材类别、能量、现有画面充分度、原句短语。
const configs = {
 B01:[['opening'],'保留招呼与真人建立联系，零点九秒不另加需要阅读的信息','talking-head','low','high',[]],
 B02:[['opening','reveal'],'飞车钩子接真实展示，不把尚待核验的量产判断放大','talking-head','medium','medium',['能够飞的车']],
 B03:[['evidence','process'],'让真实车辆动作说明翻滚与推进，重点需绑定官方源帧及事实边界','screen-recording','medium','medium',['空中翻滚','冷气推进系统','负压吸附风扇']],
 B04:[['evidence','data','comparison'],'让观众读官方配置和口播差异，避免动画数字造成已经核实的印象','document','low','medium',['1.7秒','483公里','370公里每小时']],
 B05:[['evidence'],'上路范围存在待决事实，不以对勾或徽章强化原话','talking-head','low','medium',['正常上路']],
 B06:[['transition'],'从车辆切到AI话题，给下一资料段留完整入场','talking-head','low','high',[]],
 B07:[['evidence','comparison'],'对照只靠自家与不同领域模型，官方原帖未来时限定必须保留','document','low','medium',['自家的模型','不同领域的顶尖模型']],
 B08:[['evidence','list'],'示例随原句出现且与官网同步，专名未听审不能制作虚构调用演示','document','low','medium',['绘图','复杂的业务问题']],
 B09:[['hierarchy','convergence'],'中枢比喻交给下一纸艺段，不重复建立一套全屏中枢图','talking-head','low','medium',[]],
 B11:[['correction','emphasis'],'转向企业问题，与下一段问题标签连贯，不强调无统计支持的最大判断','talking-head','low','medium',['AI落地']],
 B12:[['question','list'],'三个逐步扩大期待的问题标签按实录累积，旧标签保持位置','talking-head','low','low',['哪个大模型最强','万能的AI','所有的问题']],
 B13:[['correction'],'真人承接前段问题，万能一词待听审前不制作纠偏结论牌','talking-head','low','medium',[]],
 B14:[['list','selection'],'画图写代码推理读文档是并列用途，逐项进入并保持，不连成步骤','talking-head','low','low',['画图','深度写代码','复杂推理','读业务文档']],
 B15:[['correction','comparison'],'最强模型条先保留，下一段以按需匹配连续接替，不换整张板','talking-head','low','low',['最强的模型']],
 B16:[['selection','transformation'],'同一对象从追求最强转向按需调用匹配业务，结果保持供阅读','talking-head','low','low',['按需调用','匹配业务']],
 B17:[['hierarchy','process'],'让AI能力到部门到每个人的关系逐层建立，工作缓解为待听审词','talking-head','low','low',['AI能力','各个部门','每一个人']],
 B18:[['correction'],'保留真人两句否定给后续纸艺留空间，不让炫技字卡反客为主','talking-head','low','high',[]],
 B20:[['emphasis'],'从纸艺回到真人直视安抚，减少新的阅读负担','talking-head','low','high',[]],
 B21:[['comparison'],'对照面向未来的玩具与现在的工具，只表达观点不展示效果保证','talking-head','low','low',['未来的玩具','现在','工具']],
 B22:[['question','outro','list'],'邀请只收束为行业与卡点两个输入，不复述十六秒整段长字卡','talking-head','low','medium',['行业','卡点']],
 B23:[['outro'],'人物自己完成姓名地域服务身份，无需品牌片尾替代真人','talking-head','low','high',[]],
};
const initialRegion={x:64,y:100,width:620,height:360};
const beats=director.semanticBeats.filter(b=>b.primaryRoute!=='paper-editorial').map(b=>{
 const c=configs[b.id];if(!c)throw new Error('缺少逐段配置 '+b.id);
 return {beatId:b.id,mainVisual:b.primaryRoute,frames:{startFrame:b.from,endFrameExclusive:b.to},
 quote:b.rawSpokenText,purpose:c[1],semanticIntents:c[0],materialClass:c[2],energy:c[3],existingVisualSufficiency:c[4],keyPhrases:c[5],
 region:initialRegion,protectedRegions:[{x:800,y:140,width:900,height:730},{x:0,y:900,width:1920,height:180},{x:0,y:500,width:800,height:400}],
 layoutStatus:'initial-unvalidated-not-render-authorized',
 layoutCaveat:'左上仅初始框；联系表有上举手势侵入。真实素材版式与左下真人小窗待锁定，不得据本矩形宣称动态避让通过。',
 existingVisualSufficiencyEvidence:{status:'semantic-and-sparse-contact-sheet-estimate',reason:c[1],actualDynamicPreviewWatched:false},
 sourceSegmentIds:b.sourceSegmentIds,
 };
});
if(beats.length!==21)throw new Error('预期21个可扫描段');
const paths={registry:'skills/koubo-shotcraft-library/registry.v1.json',library:'skills/koubo-shotcraft-library/upstream/gallery/api/library.json',capabilityIndex:'skills/koubo-shotcraft-library/card-capability-index.v2.json',experienceLedger:'skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json',componentModule:'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx'};
writeNew('auto-match-request.v1.json',{
 schemaVersion:'koubo-shotcraft-auto-match-request/v1',taskId:'musk-grok-business-ai-20261016',revisionId:'postshoot-motion-candidate-v1',
 directorProfile:{profileId:'paper-editorial-director-v9',profileVersion:'9.1.0'},subtitleAuthority:'actual-recording',
 ...Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,binding(p)])),captions:binding(base+'/'+captionsName),
 canvas:{width:1920,height:1080,fps:30,durationInFrames:director.durationInFrames},beats,
 preparation:{status:'candidate-only',directorInput:binding(directorPath),sourceRecording:binding(sourcePath),
 originalAsr:binding(rawPath),captionSnapshotNotForPlayback:true,materialsNotFinal:true,subtitleAcceptance:false,renderAuthorizedByThisFile:false,
 excludedBeats:director.semanticBeats.filter(b=>b.primaryRoute==='paper-editorial').map(b=>({beatId:b.id,routeCueId:b.routeCueId,reason:'纸艺主画面内部禁止叠加Shotcraft，保留P01/P02素材槽位'})),
 geometryEvidence:binding('edit/20261016_musk_grok_business_ai/04_后期准备/原片构图核对/原片每30秒联系表.jpg'),
 }});
console.log(JSON.stringify({request:base+'/auto-match-request.v1.json',eligibleBeats:beats.length,excluded:2,rawCaptionCount:raw.segments.length}));
