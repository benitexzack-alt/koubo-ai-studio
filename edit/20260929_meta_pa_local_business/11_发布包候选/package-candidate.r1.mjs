import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {validateKnowledgeContextForProductionV2} from '../../../tools/knowledge-context-production-gate.mjs';

const root = '/Users/pc/Documents/口播';
const episode = 'edit/20260929_meta_pa_local_business';
const out = path.join(root, episode, '11_发布包候选');
const mode = process.argv[2] ?? 'prepare';
assert(['prepare','assemble'].includes(mode), '只允许本期发布包准备与候选组装，不发布');
fs.mkdirSync(out,{recursive:true});
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rel = p => path.relative(root,p).split(path.sep).join('/');
const read = p => JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const bound = p => ({path:rel(path.resolve(root,p)),sha256:sha(path.resolve(root,p))});
const put = (name,body) => fs.writeFileSync(path.join(out,name),typeof body==='string'?body:JSON.stringify(body,null,2)+'\n');
const draftPath = 'notes/2026-09-28-PA口播优化/正式口播稿.v2.md';
const draft = fs.readFileSync(path.join(root,draftPath),'utf8');
const mainTitle = draft.match(/^- 抖音主标题：(.+)$/m)?.[1];
const alternatives = [draft.match(/^- 备选一：(.+)$/m)?.[1],draft.match(/^- 备选二：(.+)$/m)?.[1]];
assert(mainTitle&&alternatives.every(Boolean),'必须逐字取到本期原有一主两备');
const captionPath = `${episode}/10_剪辑准备/字幕/meta-pa.actual.bilingual.r2.json`;
const canonicalPath = `${episode}/10_剪辑准备/字幕/meta-pa.actual.canonical.r1.json`;
const spokenPolicyPath = `${episode}/10_剪辑准备/字幕/meta-pa.spoken-source-policy.r2.json`;
const captions = read(captionPath);
assert(Array.isArray(captions)&&captions.length>0,'实际中英文字幕必须存在');
const descriptionPages = ['C128','C129','C130','C131'].map(id=>captions.find(p=>p.id===id));
assert(descriptionPages.every(Boolean),'发布文案只从本期连续实录字幕页原样取用');
for(let i=1;i<descriptionPages.length;i++)assert.equal(descriptionPages[i-1].endMs,descriptionPages[i].startMs,'实录文案必须连续');
assert.equal(descriptionPages[0].startMs,373920);assert.equal(descriptionPages.at(-1).endMs,386400);
const description = descriptionPages.map(p=>p.zh).join('\n');
const tags=['Meta','兰州','企业AI应用','GEO'];
const sourceReceiptPath = `${episode}/01_素材投放区/05_公开素材_Codex准备/采集回执.r2.json`;
const sources = read(sourceReceiptPath).entries.map(e=>({name:e.name,sourceName:e.sourceName,sourceUrl:e.sourceUrl,localPath:e.path,sha256:e.sha256,bytes:e.bytes,observedAt:e.observedAt,rights:e.rights}));
for(const s of sources)assert.equal(sha(path.join(root,s.localPath)),s.sha256,`公开素材来源绑定变化:${s.name}`);
const intakePath=`${episode}/10_剪辑准备/素材验收/素材规格与完整解码回执.r1.json`;
const intake=read(intakePath);
const plannedFinal=`${episode}/12_正式成片/Meta个人AI助理与本地商家_V8_R1_1080P.mp4`;
const templatePath='templates/10-超哥AI创业记_3比4系列封面提示词母版.md';
const sourceCopyReviewPath='notes/2026-09-28-PA口播优化/文案精修与事实复核.v2.json';
const sourceCopyReview=read(sourceCopyReviewPath);
const prompt=`制作一张3:4竖版、1080×1440的抖音知识口播封面，延续“超哥AI创业记”系列统一视觉体系。

唯一人物素材：本发布包里的“本条成片真人截图.png”，必须从本期最终成片真实提取。未取得这张截图前，不生成封面，不用原片、旧片、历史照片或相似人物替代。

准确分离截图中的真人，只移除原画面叠加的字幕、信息卡、图标和栏目文字；保留原始真实五官、脸型、眼睛、鼻子、嘴型、发型、年龄感、肤色、衣服、麦克风、表情、手势、身体比例和姿态。禁止重新生成人脸、换脸、美颜重塑、修改表情或手势。只允许自然抠像、裁切、清晰度优化、轻微明暗调整与环境光融合。

人物放画面右侧或右下，占约38%～45%，保留清晰半身讲解状态。标题和知识结构不遮住面部及关键手势。

左上小型系列文字：“超哥AI创业记”。主标题严格分两行：“顾客让AI选店”“你的店找得到吗”。“你的店”用暖黄色或暖金色，其他主标题用白色，字体粗壮紧凑、高对比，九宫格缩略图也能读清。辅助文字原样使用：“商家信息与预约入口”。不新增保证推荐、获得订单或亲测等表述。

本期知识结构选择“核对流程路径”。标题下方、人物左侧放五个短中文节点：“地址”→“服务条件”→“联系方式”→“预约入口”→“核对结果”。这些词取自本条实录核对动作，不画AI自动完成交易的成功结果。结构占画面约20%～35%，用半透明深蓝信息卡、少量简洁节点、细线与箭头组织；不要做成PPT，不堆满小字。

一条克制的暖金色或蓝金渐变细路径线连接五个节点，有清晰方向感，不做廉价霓虹。表现AI查到的业务信息需要回到真实服务核对，不表示已获得推荐或完成预约。

背景优先使用本条截图中真实环境的延展、虚化与压暗；若需要另外使用兰州真实街景，必须有已核验的授权素材，未有素材时用深海军蓝纯色与克制结构层次，不虚构本地现场、店面或客户。保持“前景真人—中景知识结构—后景真实环境/深蓝底”的层次，背景不能抢标题与人物。

颜色固定为深黑、深海军蓝、工业灰、冷青蓝、白色，少量暖黄色/暖金色突出问题与判断。真实商业纪实摄影感结合知识可视化与电影级侧光；真人截图质感自然，人物边缘只允许轻微环境光，禁止明显发光描边。

阅读顺序为标题、人物、逻辑结构、环境细节。保留四周安全边距，不退化成大字加空背景，也不塞进十几个图标。

禁止：AI重绘人物、变形手指、塑料皮肤、修改原始手势、其他主角、机器人头像、人形机器人、代码雨、宇宙背景、廉价赛博朋克、紫色霓虹、金币现金、豪车、收益数字、暴富暗示、成功保证、股票暴涨视觉、真实平台标志、二维码、联系方式、水印、随机数字、乱码、虚假推荐截图、评分销量订单、虚假企业后台或虚假收益截图。

仅文字封面提示词候选，尚未制作封面。最终应自然融入“超哥AI创业记”系列主页，人物身份与本期真实截图一致。
`;
const copyRecord={schema:'meta-pa-publish-copy-origin/v1',status:'no-rewrite-source-bound',noRewrite:true,newPublicSpokenScriptWritten:false,titleSource:{...bound(draftPath),mainTitle,alternatives,extraction:'正式稿V2标题段逐字搬运；不把V2正文作为拍后字幕权威'},descriptionSource:{...bound(captionPath),canonical:bound(canonicalPath),captionIds:descriptionPages.map(p=>p.id),startMs:descriptionPages[0].startMs,endMs:descriptionPages.at(-1).endMs,text:description,extraction:'连续实际口播候选原话逐字搬运，保留连接词，不从拍前稿恢复'},hashtags:{tags,policy:'未找到本条已确认话题时，采用任务明确允许的中性词；不添加保证或亲测'},coverPrompt:{template:bound(templatePath),titleWordsSource:bound(draftPath),knowledgeNodeSource:{...bound(captionPath),captionIds:descriptionPages.map(p=>p.id)},newSpokenClaims:false,personSourcePolicy:'current-final-video-frame-only'},priorSourceCopyReview:{...bound(sourceCopyReviewPath),sourceDraftHashStillMatches:sourceCopyReview.draft.sha256===sha(path.join(root,draftPath)),inheritedAsHistoricalEvidenceOnly:true,currentPackageReviewPassed:false},currentRewriteScores:null,whyNoNewRewriteScores:'本轮只搬运已有标题与实录原话，不重写公开口播；不伪造新的双Skill改写评分或通过回执。',fullWatchConfirmed:false,publishAuthorized:false};
put('标题文案与封面提示词.md',`# 本期发布包文字候选\n\n状态：待完整观看与发布前确认，尚未发布。\n\n## 标题\n\n主标题：${mainTitle}\n\n备选一：${alternatives[0]}\n\n备选二：${alternatives[1]}\n\n## 发布文案\n\n${description}\n\n## 话题\n\n${tags.map(x=>'#'+x).join(' ')}\n\n## 封面提示词\n\n${prompt}`);
put('封面提示词_可复制.md',prompt);
put('文案来源与原样搬运回执.r1.json',copyRecord);
put('公开来源与素材登记.r1.json',{status:'source-bound-commentary-candidate',sourceReceipt:bound(sourceReceiptPath),currentFactBoundary:bound(`${episode}/03_导演拆解/事实与公开资料边界.md`),historicalDraftFactLock:{...bound(draftPath),role:'历史标题来源及研究附录，不将旧M153/旧产品段恢复进本期原声'},sources,publicationOrRightsCleared:false});
put('公开来源表.md',`# 本期来源表\n\n官方公告说明厂商公开介绍，不证明本人亲测或所有账号已开通。订房为假设情景，生成画面不作证据。素材为本期评论必要片段/局部引用候选，不提供无限转载许可。\n\n本期事实边界沿用2026年9月29日核对记录；标题来源稿件的历史M153段不能替代本期二代手机资料。\n\n${sources.map(s=>`- ${s.name}：${s.sourceName}；${s.sourceUrl}\n  - 本地文件哈希：${s.sha256}`).join('\n')}\n`);
const stamp=ms=>{const value=Math.round(ms),hh=Math.floor(value/3600000),mm=Math.floor(value%3600000/60000),ss=Math.floor(value%60000/1000),milli=value%1000;return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')},${String(milli).padStart(3,'0')}`;};
for(const [name,fields] of [['中文字幕.srt',['zh']],['英文辅助字幕.srt',['en']],['中英文同窗字幕.srt',['zh','en']]])put(name,captions.map((p,i)=>`${i+1}\n${stamp(p.startMs)} --> ${stamp(p.endMs)}\n${fields.map(f=>p[f]).join('\n')}\n`).join('\n'));
put('终验待确认清单.md',`# 本期终验待确认\n\n- 完整观看本条候选成片：原声全部保留，字幕实际用词及英文同窗正确。\n- 核对275.96秒、350.38秒等已登记疑词，不能因语境擅自恢复拍前稿；最终字幕若更新，重新组装本包。\n- 检查P01的筛分结果及全部纸艺字物同动、动作结束可读性。\n- 正常音量试听开场钩子、每个Remotion重点动作音与纸艺原生音，不压人声、不重复叠声。\n- 公开资料正文、来源和数字无遮挡，真人小窗同步固定左下，字幕位于独立区。\n- 推荐截图必须来自本条最终成片；封面不得AI重绘真人。\n- 发布前独立核对当日AI内容声明、版权引用、事实限定；本包不授权发布、投放或交易。\n\n本包不将机器校验冒充完整人工观看或公开发布许可。\n`);
const originalMeta={schema:'meta-pa-release-candidate/v1',releaseId:'20260929-meta-pa-local-business-v8-r1',status:'ready-for-user-review',metadataPrepared:true,packageComplete:false,formalCandidateRendered:false,publishAuthorized:false,fullWatchConfirmed:false,userPreviewApproved:false,mainTitle,alternativeTitles:alternatives,description,tags,copyOrigin:bound(path.join(out,'文案来源与原样搬运回执.r1.json')),subtitles:{source:bound(captionPath),canonicalSource:bound(canonicalPath),spokenPolicy:bound(spokenPolicyPath),chinese:bound(path.join(out,'中文字幕.srt')),english:bound(path.join(out,'英文辅助字幕.srt')),bilingual:bound(path.join(out,'中英文同窗字幕.srt')),humanFullListeningConfirmed:false},cover:{aspectRatio:'3:4',width:1080,height:1440,prompt:bound(path.join(out,'封面提示词_可复制.md')),frame:null,personSourcePolicy:'current-final-video-frame-only',coverImageGenerated:false},production:{plannedFinalPath:plannedFinal,finalFile:null,technicalQa:null,generatedMaterials:intake.entries.filter(e=>e.directorBinding).map(e=>({id:e.id,path:e.path,sha256:e.sha256,durationSeconds:e.durationSeconds,video:e.video})),paperActualResolution:'1344x768',paperUpscaledWithAI:false},sources:bound(path.join(out,'公开来源与素材登记.r1.json')),publish:{status:'not-published',platformReviewPassed:false,aiContentDisclosurePending:true,paymentOrBoostAuthorized:false}};
if(mode==='prepare'){
  if(!fs.existsSync(path.join(out,'发布记录.r1.json'))||read(path.join(out,'发布记录.r1.json')).packageComplete===false)put('发布记录.r1.json',originalMeta);
  put('文字与字幕准备回执.r1.json',{status:'metadata-and-subtitles-prepared',noRewrite:true,mainTitleCopiedExactly:true,alternativeTitlesCopiedExactly:true,descriptionCaptionIds:descriptionPages.map(p=>p.id),subtitlePages:captions.length,formalVideoNotInvented:true,finalFrameNotInvented:true,publishAuthorized:false,fullWatchConfirmed:false,preparedAt:new Date().toISOString()});
  console.log('发布包文字与字幕候选已准备；成片、成片截图与成片QA待实际绑定。');
}else{
  const screenshotArg=process.argv[3],qaArg=process.argv[4];assert(screenshotArg&&qaArg,'组装必须提供主线程从本条最终MP4抽帧的截图回执及成片QA路径');
  const jobPath=path.join(root,episode,'10_剪辑准备/完整视听小样R1/preview-job.json'),job=read(jobPath);
  assert(Array.isArray(job.bindings)&&job.bindings.length>0,'本期job必须有实际输入绑定');
  for(const b of job.bindings){const p=path.resolve(root,b.path);assert(p.startsWith(root+path.sep),'job输入不能越界');assert(fs.lstatSync(p).isFile()&&!fs.lstatSync(p).isSymbolicLink(),'job输入必须为普通文件');assert.equal(sha(p),b.sha256,`组装前输入变化:${b.path}`);}
  const knowledgeContextProof=validateKnowledgeContextForProductionV2({projectRoot:root,jobPath,job,command:'release-validation'});
  assert.equal(knowledgeContextProof.required,true,'发布包知识上下文必须执行实际复检，不能跳过');
  assert.equal(knowledgeContextProof.validationStatus,'context-valid','发布包知识上下文复检未成功');
  assert.equal(knowledgeContextProof.formalExecutionAllowed,true,'任务上下文未允许执行');
  const jobSha256=sha(jobPath);
  const screenshotReceipt=read(screenshotArg),qaPath=path.resolve(root,qaArg),finalPath=path.join(root,plannedFinal);
  assert(fs.existsSync(finalPath)&&fs.statSync(finalPath).size>0,'本条最终MP4尚不存在，不能组装完整包');
  assert(fs.existsSync(qaPath)&&fs.statSync(qaPath).size>0,'成片QA尚不存在');
  const finalSha=sha(finalPath),qa=read(qaPath);assert.equal(qa.inputs?.video?.sha256,finalSha,'成片QA必须绑定当前最终MP4的SHA256');assert(Array.isArray(qa.hardErrors),'成片QA必须明确列出hardErrors');assert.equal(qa.hardErrors.length,0,'成片QA仍有硬错误，不能组装完整候选包');
  assert.equal(screenshotReceipt.sourceFinalVideo?.path,plannedFinal,'截图必须绑定本条最终成片规范路径');assert.equal(screenshotReceipt.sourceFinalVideo?.sha256,finalSha,'截图回执必须绑定当前最终成片SHA256');assert(Number.isFinite(screenshotReceipt.timestampSeconds)&&screenshotReceipt.timestampSeconds>=0,'截图时间点缺失');
  const framePath=path.resolve(root,screenshotReceipt.frame?.path??'');assert(framePath.startsWith(path.join(root,episode)+path.sep),'成片截图只能在本期目录');assert(fs.existsSync(framePath),'本条成片截图不存在');assert.equal(sha(framePath),screenshotReceipt.frame.sha256,'截图SHA256不匹配');
  assert.equal(fs.readFileSync(framePath).subarray(0,8).toString('hex'),'89504e470d0a1a0a','推荐成片截图必须为实际PNG，不能改扩展名冒充');
  const probe=spawnSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',finalPath],{encoding:'utf8'});assert.equal(probe.status,0,'本条最终MP4探测失败');const media=JSON.parse(probe.stdout);assert(screenshotReceipt.timestampSeconds<Number(media.format.duration),'截图时间超过本条成片');
  const destinations=[[finalPath,path.join(out,path.basename(finalPath))],[framePath,path.join(out,'本条成片真人截图.png')],[qaPath,path.join(out,'成片技术检查.json')]];
  for(const [src,dest] of destinations){if(path.resolve(src)===path.resolve(dest))continue;if(fs.existsSync(dest)){assert.equal(sha(src),sha(dest),`已有包文件不同，禁止静默覆盖:${dest}`);}else fs.copyFileSync(src,dest,fs.constants.COPYFILE_EXCL);}
  const metadata={...originalMeta,packageComplete:true,formalCandidateRendered:true,preparedAt:new Date().toISOString()};metadata.production.finalFile=bound(path.join(out,path.basename(finalPath)));metadata.production.canonicalFinalFile=bound(finalPath);metadata.production.technicalQa=bound(path.join(out,'成片技术检查.json'));metadata.production.mediaProbe=media;metadata.production.reviewFlags=qa.reviewFlags??[];metadata.production.packageAssemblyBinding={job:bound(jobPath),jobSha256,knowledgeContextProof,v2FormalPreflightPassed:false};metadata.cover.frame={...bound(path.join(out,'本条成片真人截图.png')),timestampSeconds:screenshotReceipt.timestampSeconds,sourceFinalVideo:bound(finalPath),extractionReceipt:bound(screenshotArg)};
  put('发布记录.r1.json',metadata);
  const deliveryFiles=fs.readdirSync(out).filter(name=>fs.statSync(path.join(out,name)).isFile()&&name!=='完整包文件回执.r1.json').map(name=>({name,bytes:fs.statSync(path.join(out,name)).size,sha256:sha(path.join(out,name))}));
  put('完整包文件回执.r1.json',{status:'ready-for-user-review',packageComplete:true,fullWatchConfirmed:false,publishAuthorized:false,files:deliveryFiles});
  console.log('本期完整发布包候选已组装；仍待用户完整观看，未公开发布。');
}
