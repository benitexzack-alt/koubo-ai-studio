import {readFileSync, writeFileSync, mkdirSync, existsSync, symlinkSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validatePreproductionRequest} from '../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';

const episode = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(episode, '../..');
const rel = p => path.relative(repo, p);
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const bind = p => ({path:rel(p),sha256:sha(p)});
const taskId = 'task-20260906T154937Z-69f6ebf8';
const revisionId = '20260906-lanzhou-ai-services-v91-pre-shoot-r1';
const planDir = path.join(episode, '04_导演拆解/v9.1-r1');
for (const dir of ['00_工程控制','01_文稿','02_原片','03_官方素材','04_导演拆解/v9.1-r1','05_纸艺视频','06_补充实拍素材','07_预览与质检','08_发布包']) mkdirSync(path.join(episode,dir),{recursive:true});
function writeNew(p, content) {
  if(existsSync(p)) throw new Error(`文件已存在，不覆盖：${p}`);
  writeFileSync(p,typeof content==='string'?content:`${JSON.stringify(content,null,2)}\n`,{flag:'wx'});
}

const original = path.join(repo,'notes/2026-09-06-请给予我包容和支持-口播稿-v1.md');
const markdown = readFileSync(original,'utf8');
const start='<!-- CONTENT_START -->', end='<!-- CONTENT_END -->';
if(markdown.split(start).length!==2 || markdown.split(end).length!==2) throw new Error('原稿正文标记不唯一');
const body=markdown.split(start)[1].split(end)[0].trim();
const scriptPath=path.join(episode,'01_文稿/用户确认稿_仅预拍权威.txt');
writeNew(scriptPath,body+'\n');
const paragraphs=body.split(/\n\s*\n/).map(x=>x.trim());
if(paragraphs.length!==23) throw new Error(`正文分段变化：${paragraphs.length}`);
const profile=JSON.parse(readFileSync(path.join(repo,'workflow/active-director-profile.v1.json')));
const sourceManifest=path.join(episode,'03_官方素材/official-source-manifest.v1.json');
const fullText=readFileSync(path.join(episode,'03_官方素材/O01_工信部通知原文.txt'),'utf8');
if(!fullText.includes('扎根用户现场')) throw new Error('官方证据缺失');
writeNew(path.join(episode,'00_工程控制/用户预拍授权.v1.json'),{
  schemaVersion:'koubo-pre-shoot-user-confirmation/v1',taskId,revisionId,recordedAt:new Date().toISOString(),
  authority:'direct-user-message',quote:'上面的口播内容是我的新文稿，根据这个文稿开始准备新版本的导演策划',
  script:bind(scriptPath),originalDraft:bind(original),scriptVerbatim:true,
  approved:true,scope:'预拍导演与官方素材准备',humanReadAloudConfirmed:false,
  formalAuthorized:false,externalGenerationAuthorized:false,postShootRebindRequired:true,
  historicalDraftStatusNotOverwritten:true,referenceLink:'https://weixin.qq.com/sph/AYni8IHd5x',referenceLinkFullContentRead:false,
});

const row=[.07,.29,.51,.73].map(x=>({x,y:.15,width:.20,height:.54}));
const quad=b=>[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]];
const labelBox=b=>({x:b.x+.015,y:b.y+b.height-.105,width:b.width-.03,height:.08});
const base='16:9横版，真实手工纸艺微缩定格摄影。深靛蓝分层硬纸背景、暖白纸面、可见纸纤维和瓦楞切口，冷青纸件辅助、少量赭黄纸件点重点，侧向柔光和真实接触阴影。前景纸件、中景机构、后景竖立纸板至少三层；不是扁平流程图或PPT。正面略高机位，所有纸牌近正视，不能窄斜透视。主体及所有牌面只在横向5%至95%、纵向5%至75%区域，底部20%为空白字幕安全区。';
const blank='本次只生成无字底图：所有标签牌完全空白、平整、无纹样，恰好四张，不多不少；没有额外空白牌，牌面完全无任何印记和图形，禁止生成文字或任何符号。G与N等代码仅供定位，不得印在图上。精确中文由后续本地文字烘焙按textPlan写入。';
const motionLock='输入首帧是唯一视觉与文字基准。所有中文已是纸面的一部分，逐字保持字体、内容、顺序、颜色、相对纸面位置，不生成新字、不改写、不抹掉文字。四块带字硬纸牌只允许整体平移和轻微刚体转动，不折叠、卷曲、拉伸、拼字、遮字或出画；只有无字纸件可展开、对齐、卡合。固定机位，真实手作逐格运动，物件数量和身份不变，禁止滤镜、霓虹、漂浮字幕、蒙版换景和人物。';
function scene(title, durationSeconds, specs, boxes, firstFrame, motion, boundary) {
  const groups=specs.map((s,i)=>({id:`G${i+1}`,name:s[0],material:s[1],depth:(i%3)+1}));
  const nodes=specs.map((s,i)=>({id:`N${i+1}`,label:s[2]??s[0],groupId:`G${i+1}`,role:i===0?'input':i===specs.length-1?'output':'mechanism',textVisibility:s[2]?'paper-label':'visual-only'}));
  const textPlan=specs.flatMap((s,i)=>s[2]?[{nodeId:`N${i+1}`,text:s[2],role:'diegetic-node-label',groupId:`G${i+1}`,surfaceId:`G${i+1}-rigid-label-card`,anchorQuad:quad(labelBox(boxes[i])),maxChars:6,persistence:`S${i+1}-to-end`,occlusionOwner:'own-rigid-card-above-own-group',ocrRequired:true,motionConstraint:'rigid-surface',embeddingMode:'first-frame-baked',trackingKeyframesRequired:false,enterStageId:`S${i+1}`,stageOffsetFrames:0}]:[]);
  return {
    title,archetype:'mechanical-causality',durationSeconds,objectGroups:groups,nodes,
    stages:specs.map((s,i)=>({id:`S${i+1}`,order:i+1,subject:`G${i+1}`,action:s[3],landingNodeIds:[`N${i+1}`],sfxRole:s[4]??'paper-slide'})),
    labelBindingPolicy:{unlabeledObjectGroups:specs.flatMap((s,i)=>s[2]?[]:[{groupId:`G${i+1}`,reason:s[5]}])},
    readableTextPolicy:{maximumSimultaneousLabels:4,slashMergeForbidden:true,silentTruncationForbidden:true},textPlan,screenTextPlan:[],
    layoutContract:{coordinateSpace:'normalized-0-to-1',contentSafeRect:{x:.05,y:.05,width:.9,height:.7},subtitleReservedRect:{x:0,y:.8,width:1,height:.2},objectGroupBoxes:boxes.map((box,i)=>({groupId:`G${i+1}`,box})),paperLabelSurfaceBoxes:textPlan.map(item=>({nodeId:item.nodeId,groupId:item.groupId,surfaceId:item.surfaceId,box:labelBox(boxes[Number(item.groupId.slice(1))-1])})),layoutInterpretation:{objectGroupBoxes:'broad-composition-zones',paperLabelSurfaceBoxes:'reserved-placement-zones',exactPixelMatchRequired:false,contentAndSubtitleContainmentIsHard:true},generatedDecorationPolicy:'forbidden'},
    prompt:{firstFrame:`${base}\n${firstFrame}\n${blank}`,motion:`${motionLock}\n${motion}\n${boundary}\n保留轻而清楚的纸张滑动、折页、卡合原生音效，不生成对白、口播、背景音乐。`,generatedReadableTextAllowed:false},
    semanticBoundary:boundary,
    postShootTiming:{mode:'contextual-summary-after-spoken-terms',lockedStartSeconds:null,explanation:'带字牌首帧全部可见，必须放在各关键词已经口述且仍处于该机制解释窗口之后；否则重拆镜头，不让未说出的结论提前出现。超出源片长度回到真人，不用末帧冻结补时。'},
  };
}

const paper=new Map();
paper.set(11,scene('先分版本，再进知识库',8,[
 ['散落资料','暖白散页叠与纯空白硬牌','散落资料','散页在左侧归拢成可分拣的一摞。'],
 ['有效资料托盘','青绿色浅纸托与纯空白硬牌','有效资料','完整整洁的纸页移到上方青绿托盘。','paper-click'],
 ['作废资料隔离盒','工业灰纸盒与纯空白硬牌','作废资料','旧纸页移到下方灰盒，保留归档且不进入右侧书架。'],
 ['知识库纸书架','靛蓝立体书架与纯空白硬牌','企业知识库','只把青绿托盘中已筛过的纸页卡进右侧书架，灰盒保持独立。','paper-click'],
],[{x:.07,y:.16,width:.20,height:.49},{x:.34,y:.08,width:.25,height:.29},{x:.34,y:.42,width:.25,height:.29},{x:.70,y:.14,width:.23,height:.55}],
 '左侧G1是一摞互相错开的无字资料，牌固定在左侧前沿；中间上方G2是青绿色托盘，牌在该托盘前沿；中间下方G3是灰色隔离纸盒，牌在灰盒前沿；右侧G4是尚未装满的靛蓝书架，牌在右侧书架前沿。恰好四张牌，G1、G2、G3、G4各一张。无字纸路从左侧分成上下两条，但只有上方纸路接到书架。首帧所有物件已经存在，不出现人物或电脑界面。',
 '0至1秒保留可读起始构图；1至2.5秒左侧散页轻轻归拢；2.5至4秒有效纸页沿上路滑入青绿托盘；4至5.5秒旧页沿下路滑入灰盒；5.5至7秒仅青绿托盘的纸页卡入右侧书架；7至8秒结果停留。带字牌始终与所属托盘或书架绑定。',
 '只说明分类与筛选方法，不表示所有有效资料自动全量入库，不表示已实施某个客户项目，也不把作废资料销毁。'));
paper.set(12,scene('答复带依据，确认后再发',9,[
 ['依据资料册','青绿色资料册和纯空白硬牌','资料出处','资料册沿切口展开，露出内页本体。','paper-unfold'],
 ['答复纸页','暖白纸页、连接棉线与纯空白硬牌','整理答复','答复纸页平移就位，短棉线始终连回资料册。'],
 ['人工确认台','赭黄色机械闸片和纯空白硬牌','人工确认','答复在确认台前短暂停住，无字确认压板落下后闸片才移开。','paper-click'],
 ['客户收件盒','靛蓝收件纸盒和纯空白硬牌','发给客户','确认后的答复沿纸路滑入客户收件盒，连接依据的棉线保持可追溯。','paper-slide'],
],row,
 '从左到右四组：G1青绿色资料册，G2暖白答复页，G3赭黄人工确认台，G4靛蓝客户收件盒。G1牌在资料册前下方，G2牌在答复页前下方，G3牌在闸片前下方，G4牌在收件盒前下方，恰好一组一张共四张。G2答复页的棉线连到G1资料册，G3闸片处于关闭状态，G4收件盒为空，所有物件首帧即存在。不要生成对话框或手指。',
 '0至1秒读构图；1至2.5秒无字资料页展开；2.5至4秒答复页带着棉线移到确认台前；4至6秒在闭合闸片前停住，随后无字压板落下、闸片机械移开；6至8秒答复完整滑进收件盒；8至9秒稳住结果。四张带字牌始终可读。',
 '必须先停在人工确认处，再出现发给客户的结果；不能画成AI直接发送。价格、交期、售后承诺和资料没有答案交回人工，由原声和真人语义卡说明，不伪造第五张牌。'));
paper.set(13,scene('交付后，用真实问题继续试',8,[
 ['日常问题册','暖白小本和纯空白硬牌','日常问题','一张完全空白的业务纸页从小本滑到试用台。'],
 ['试用检索台','冷青翻页架和纯空白硬牌','实际试用','纸页进入翻页架，架中留下一个未被资料填满的空位。','paper-unfold'],
 ['纠错整理槽','灰色分类槽和纯空白硬牌','查漏纠错','空位对应的纸页滑到纠错槽，与合适的无字资料页配对。'],
 ['更新资料册','赭黄可换页册和纯空白硬牌','更新资料','替换页卡回资料册，棉线回路连回试用台，表明仍需继续试。','paper-click'],
],[{x:.07,y:.08,width:.34,height:.27},{x:.59,y:.08,width:.34,height:.27},{x:.59,y:.43,width:.34,height:.27},{x:.07,y:.43,width:.34,height:.27}],
 '四组围成宽松的矩形工作回路：左上G1日常问题小本、右上G2冷青翻页架、右下G3灰色分类槽、左下G4赭黄可换页册。G1到G4每组前沿各有且仅有一张平整空白硬牌，共四张。棉线在牌后连接四组，不跨过牌面。纸件有不同高度，翻页架立起，空白业务页未进入架子，更新页放在本子旁。',
 '0至1秒稳定构图；1至2.5秒纸页从左上小本滑到右上翻页架；2.5至4秒翻页架展开，露出一个缺少资料的空位；4至5.5秒对应纸页移到右下分类槽，与另一张无字纸页叠合；5.5至7秒替换页卡回左下本子，棉线轻轻收紧连回试用台；7至8秒停留。',
 '表现持续发现与处理问题，不能出现一次交付后全部解决的奖章、胜利符号或成功保证。'));
paper.set(16,scene('GEO先把真实信息整理清楚',8,[
 ['业务资料座','暖白文件夹和纯空白硬牌','做什么业务','业务文件夹向中间略微靠拢。'],
 ['服务地域资料座','冷青折叠纸条和纯空白硬牌','服务哪些地方','服务纸条展开连接到中间归档座。','paper-unfold'],
 ['案例资料座','工业灰无图纸册和纯空白硬牌','真实案例','无图纸册向中间滑入，不出现客户Logo或照片。'],
 ['联系资料座','赭黄纸槽和纯空白硬牌','从哪里联系','联系纸槽沿纸路接入归档座。','paper-click'],
 ['真实信息归档座','中央靛蓝无字档案夹',null,'四组纸件短棉线接入同一档案夹，保持四块带字牌朝向镜头。','paper-click','中央档案夹只是信息归整物件，不配置第五张标签；不画AI推荐或认证。'],
],[{x:.07,y:.08,width:.28,height:.28},{x:.65,y:.08,width:.28,height:.28},{x:.07,y:.43,width:.28,height:.28},{x:.65,y:.43,width:.28,height:.28},{x:.39,y:.21,width:.22,height:.37}],
 'G1业务文件夹在左上，G2服务纸条在右上，G3案例无图纸册在左下，G4联系纸槽在右下，G5无字档案夹在正中且略高。四张牌分别在G1左上文件夹前沿、G2右上纸条前沿、G3左下纸册前沿、G4右下纸槽前沿；G5中央档案夹没有标签牌，不得多生第五张牌。外侧四组以未拉紧的棉线连接中央，所有四张牌正视镜头。',
 '0至1秒读清布局；1至2.2秒左上文件夹向中间靠近；2.2至3.4秒右上无字纸条展开；3.4至4.6秒左下纸册平移；4.6至5.8秒右下纸槽对齐；5.8至7秒四条棉线轻轻收紧接入中央无字档案夹；7至8秒停留完整结构。只动无字部件和整组硬牌，不折带字牌。',
 '只演示企业真实信息整理，不表示AI必然推荐、不生成平台搜索界面或排名。本镜结束回到真人继续讲实际查、持续看。'));
paper.set(18,scene('资料权限接好后，人来定下一步',9,[
 ['资料权限底座','靛蓝双槽底座、两枚无字插片和纯空白硬牌','资料和权限','两枚无字插片都卡入底座后，连接纸路才展开。','paper-click'],
 ['咨询归类槽','冷青三格纸槽和纯空白硬牌','查记录归类','几张完全空白咨询纸页从底座移到分类槽，按位置分入三格。'],
 ['待跟进事项托盘','暖白分层托盘和纯空白硬牌','待跟进事项','未完成的几张空白纸页滑到前方托盘整齐排好。'],
 ['人的决策台','赭黄无字选择拨片和纯空白硬牌','人来决定','托盘停在选择拨片前，拨片维持中立位置，不自动向客户端送出。','paper-click'],
],row,
 '从左到右G1双槽底座、G2三格分类槽、G3分层托盘、G4选择拨片。G1两个无字插片放在各自槽前尚未完全卡入，G2有空白咨询纸页，G3托盘为空，G4拨片保持中立。每组前沿一张纯空白硬牌，共四张。G1的插片不是标签牌，尺寸比牌小很多且完全无字。不得出现自动付款、外发按钮或客户成交图。',
 '0至1秒稳定；1至2.5秒G1两枚无字插片先后卡入，只有第二枚卡稳后纸路才展开；2.5至4.5秒空白咨询页沿路进入G2三格槽；4.5至6.5秒未完成纸页移到G3托盘排成层次；6.5至8秒托盘停在G4拨片前，拨片不做选择；8至9秒停留等待人工决定的状态。',
 '这是有前提的未来场景，不是已实现的客户项目。必须先有资料和权限，再出现整理结果；最后只到人来决定，不自动联系客户、不夸大成全自动经营。'));

const beats=paragraphs.map((spokenLine,index)=>{
  const n=index+1;
  const basic={id:`B${String(n).padStart(2,'0')}`,order:n,spokenLine,coreMeaning:spokenLine,kind:'speaker-commentary',visualDecision:{class:'speaker',producer:'codex-remotion',fallback:'blocked'},evidenceRefs:[]};
  if(paper.has(n)) return {...basic,kind:'process-explanation',coreMeaning:paper.get(n).title,visualDecision:{class:'paper-editorial',producer:'first-frame-batch-and-user-runninghub',fallback:'blocked'},assetUse:{role:'illustration-only',evidenceEligible:false,aiDisclosureRequired:true},paperScene:paper.get(n)};
  if(n===8) return {...basic,kind:'official-evidence',coreMeaning:'官方通知支持应用服务与现场部署方向，不替个人资历背书',visualDecision:{class:'real-evidence',producer:'official-source-capture',fallback:'blocked'},evidenceRefs:[{id:'O01',path:rel(sourceManifest),sha256:sha(sourceManifest),url:'https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_6fbc038bf15c445ab53b2a94a3f9d4e4.html'}],presentation:{mode:'real-media-with-presenter-inset',speakerIsExplainingThisAsset:true,minimumDurationSeconds:8,materialAudioMode:'muted',presenter:{source:'authoritative-talk-source',audioOwner:'base-talk-only',duplicateVideoMuted:true,anchor:'bottom-right',shape:'circle',platformSafeSlot:profile.routingPolicy.realMaterialPresenterInset.presenterSlot},transition:{enterFrames:16,exitFrames:12,hardCutForbidden:true},captions:{overlapForbidden:true,minimumGapPx:32}}};
  return basic;
});
const filenames={routeLockPath:'director-route-lock.v1.json',planPath:'director-preproduction-plan.v1.json',assetSheetPath:'导演素材执行单.md',firstFramePromptManifestPath:'first-frame-prompts.v1.json',runningHubPromptManifestPath:'runninghub-image-to-video-prompts.v1.json',runningHubPromptSheetPath:'02_RunningHub图生视频提示词.md',aiGeneratedVideoPromptManifestPath:'ai-generated-video-prompts.v1.json',aiGeneratedVideoPromptSheetPath:'03_AI写实视频需求.md',compileReceiptPath:'director-compile-receipt.v1.json',validationReceiptPath:'director-validation-receipt.v1.json'};
const request={schemaVersion:'koubo-director-preproduction-request/v1',requestId:revisionId,taskId,phase:'pre-shoot',status:'candidate-preview-required',inputScript:{...bind(scriptPath),authority:'user-confirmed-script',role:'provisional-authority'},directorProfile:{path:'workflow/active-director-profile.v1.json',profileId:profile.profileId,profileVersion:profile.profileVersion},policy:{branch:'paper-editorial',fallback:'blocked',v9ContractEnabled:true,textStrategy:'deterministic-first-frame-text-v9',generatedReadableTextAllowed:false,modelGeneratedReadableTextAllowed:false,deterministicTextMayBeBakedIntoFirstFrame:true,defaultPaperTextMode:'first-frame-baked',actualImageAnchorCalibrationRequired:true,runningHubRequiresTextBakeReceipt:true,paperNodeScreenOverlayAllowed:false,postShootRebindRequired:true},outputs:Object.fromEntries(Object.entries(filenames).map(([k,v])=>[k,rel(path.join(planDir,v))])),beats};
const result=validatePreproductionRequest({request,projectRoot:repo,profile});
writeNew(path.join(planDir,'director-preproduction-request.v1.json'),request);
if(!result.ok) throw new Error(result.errors.join('\n'));
writeNew(path.join(episode,'00_工程控制/原稿逐段保真回执.v1.json'),{taskId,source:bind(original),extractedScript:bind(scriptPath),paragraphCount:23,beatCount:beats.length,allParagraphsVerbatim:beats.every((b,i)=>b.spokenLine===paragraphs[i]),paperSceneCount:paper.size,aiRealisticVideoCount:0,recordingReceived:false,postShootRebindRequired:true,notFullRecordingAuthority:true});
const desktop='/Users/pc/Desktop/口播素材/2026-09-06_在兰州把企业AI服务做下去';
if(!existsSync(desktop)) symlinkSync(episode,desktop);
else if(realpathSync(desktop)!==episode) throw new Error('桌面同名目录不是本工程，禁止覆盖');
console.log(JSON.stringify({ok:true,request:rel(path.join(planDir,'director-preproduction-request.v1.json')),script:bind(scriptPath),paperCount:paper.size,desktop,realpath:realpathSync(desktop)}));
