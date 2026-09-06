import {readFileSync, writeFileSync, existsSync, lstatSync, symlinkSync, realpathSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateV9ProductionState} from '../../../skills/koubo-remotion-director/scripts/v9-workflow-state-core.mjs';

const episode=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(episode,'../..');
const planDir=path.join(episode,'04_导演拆解/v9.1-r1');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const bind=p=>({path:path.relative(repo,p),sha256:sha(p)});
function writeNew(p,value){if(existsSync(p))throw new Error(`禁止覆盖：${p}`);writeFileSync(p,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
const requestPath=path.join(planDir,'director-preproduction-request.v1.json');
const request=read(requestPath);
const f=read(path.join(planDir,'first-frame-prompts.v1.json'));
const val=read(path.join(planDir,'director-validation-receipt.v1.json'));
if(val.ok===false || val.skillExecuted!==true) throw new Error('导演校验未通过');
const script=path.resolve(repo,request.inputScript.path);
const body=readFileSync(script,'utf8').trim();
const paragraphs=body.split(/\n\s*\n/).map(x=>x.trim());
if(!request.beats.every((b,i)=>b.spokenLine===paragraphs[i]) || paragraphs.length!==23) throw new Error('原话段落不匹配');
const original=path.join(repo,'notes/2026-09-06-请给予我包容和支持-口播稿-v1.md');
writeNew(path.join(episode,'00_工程控制/原稿逐段保真回执.v1.json'),{taskId:request.taskId,source:bind(original),extractedScript:bind(script),paragraphCount:23,beatCount:23,allParagraphsVerbatim:true,paperSceneCount:f.sceneCount,aiRealisticVideoCount:0,recordingReceived:false,postShootRebindRequired:true});

let sheet='# 01 首帧图提示词与纸面中文\n\n> 每镜的底图提示词用于无字场景生成；纸面中文是同镜必须交付的部分。完整批量输入使用同目录JSON，不得只交底图。所有数字坐标仅是执行合同，不得印入图片。\n\n';
for(const s of f.scenes){
  sheet+=`## ${s.sceneId} ${s.title}\n\n口播原句：${s.spokenLine}\n\n最终带字首帧：\`${s.deterministicTextBake.outputImageFileName}\`。\n\n`;
  sheet+='|节点|唯一所属物件|准确中文|纸面|\n|---|---|---|---|\n';
  for(const l of s.deterministicTextBake.labels) sheet+=`|${l.nodeId}|${l.groupId}|${l.text}|${l.surfaceId}|\n`;
  sheet+=`\n### 底图生成提示词\n\n${s.firstFramePrompt}\n\n### 文字处理要求\n\n按实际生成图逐牌校准anchorQuad，再写入上述中文。黑色粗中文无衬线字，纸面近正视，字不压纸边，缩到手机横屏仍可读；不要生成模型猜字，不把中文放到屏幕浮层。字少的牌不填充额外小字。OCR与逐图视觉核验都通过才能交付。文字处理失败时复用合格底图修复文字，不能反复整图重生。\n\n配对ID：\`${s.pairId}\`；配对哈希：\`${s.pairSha256}\`。\n\n`;
}
writeNew(path.join(planDir,'01_首帧图提示词_含纸面文字.md'),sheet);

const profile=read(path.join(repo,'workflow/active-director-profile.v1.json'));
const registry=path.join(repo,profile.routingPolicy.shotcraft.registryPath);
const library=path.join(repo,profile.routingPolicy.shotcraft.libraryPath);
const ledger=path.join(repo,profile.routingPolicy.shotcraft.experienceLedgerPath);
writeNew(path.join(planDir,'shotcraft-pre-shoot-opportunities.v1.json'),{taskId:request.taskId,phase:'pre-shoot',status:'pending-recorded-audio',matcherExecuted:false,applicationCount:0,registry:bind(registry),catalog:bind(library),experienceLedger:bind(ledger),fullCatalogCardCount:157,registeredCandidateComponents:read(registry).effects.length,eligibleBeatIds:request.beats.filter(b=>['speaker','real-evidence'].includes(b.visualDecision.class)).map(b=>b.id),excludedPaperBeatIds:request.beats.filter(b=>b.visualDecision.class==='paper-editorial').map(b=>b.id),opportunities:[{beatId:'B05',intent:'list',why:'三句老板关切保留问题性质'},{beatId:'B08',intent:'evidence',why:'框选工信部原文，不改原文'},{beatId:'B14',intent:'list',why:'训练后对应的三种实际工作'},{beatId:'B16',subwindow:'回到真人以后',intent:'correction',why:'AI是否推荐要实际查'},{beatId:'B23',intent:'conclusion',why:'从眼前真实工作聊起'}],next:'拍后先实录转写和素材门，再读取当时最新库/经验哈希全库匹配；本文件不代替自动匹配回执。',formalAuthorized:false});

const officialPath=path.join(episode,'03_官方素材/official-source-manifest.v1.json');
const official=read(officialPath);
for(const item of official.items) if(sha(item.path)!==item.sha256) throw new Error(`官方素材哈希不符：${item.path}`);
const preflightPath=path.join(repo,'workflow/account-performance-preflights/task-20260906T154937Z-69f6ebf8.json');
const preflight=read(preflightPath);
writeNew(path.join(episode,'00_工程控制/本期知识与账号应用.v1.json'),{taskId:request.taskId,recordedAt:new Date().toISOString(),accountPreflight:bind(preflightPath),accountEvidenceCollectedAt:preflight.accountContext.collectedAt,learningCard:{...preflight.learningCard,actualSha256:sha(preflight.learningCard.path),retrieved:true,read:true,applied:true},baseline:preflight.automaticReference.accountBaseline.weightedMetrics,recentSix:preflight.automaticReference.recentSix.map(x=>({videoKey:x.videoKey,title:x.title,metrics:x.metrics})),appliedLessons:['lesson:hook:concrete-conflict-scene-object','lesson:conversion:narrow-high-intent-is-a-separate-win','lesson:metrics:separate-early-and-mature-windows'],application:'正文不改。开头先让观众认出找资料、报表、咨询的真实问题，真人为主，不先播纸艺或政策长图；有效本地咨询和主页访问单独记录。',observationWindows:['early-within-3h','24h','72h','7d'],causalConclusionPromoted:false,official:bind(officialPath),upstreamScriptGate:bind(path.join(repo,'notes/2026-09-06-请给予我包容和支持-成稿校验-v1.json')),publicScriptRewritten:false});

const state=read(path.join(repo,'skills/koubo-remotion-director/templates/v9-production-state.v1.json'));
Object.assign(state,{taskId:request.taskId,revisionId:request.requestId,currentStage:'director-prompt-packs-ready'});
state.stageHistory=[
 {stage:'script-confirmed',completedAt:read(path.join(episode,'00_工程控制/用户预拍授权.v1.json')).recordedAt,artifacts:{script:bind(script),scriptUserConfirmation:bind(path.join(episode,'00_工程控制/用户预拍授权.v1.json'))}},
 {stage:'director-prompt-packs-ready',completedAt:new Date().toISOString(),artifacts:{directorRequest:bind(requestPath),directorPlan:bind(path.resolve(repo,request.outputs.planPath)),directorValidation:bind(path.resolve(repo,request.outputs.validationReceiptPath)),firstFramePromptManifest:bind(path.resolve(repo,request.outputs.firstFramePromptManifestPath)),imageToVideoPromptManifest:bind(path.resolve(repo,request.outputs.runningHubPromptManifestPath)),aiVideoPromptManifest:bind(path.resolve(repo,request.outputs.aiGeneratedVideoPromptManifestPath))}},
];
const stateCheck=validateV9ProductionState({state,projectRoot:repo,verifyFiles:true});
if(!stateCheck.ok) throw new Error(JSON.stringify(stateCheck));
writeNew(path.join(episode,'00_工程控制/v9-production-state.v1.json'),state);
writeNew(path.join(episode,'00_工程控制/v9-state-validation.v1.json'),stateCheck);

const desktop='/Users/pc/Desktop/口播素材/2026-09-06_在兰州把企业AI服务做下去';
let present=false;try{lstatSync(desktop);present=true;}catch(e){if(e.code!=='ENOENT')throw e;}
if(!present)symlinkSync(episode,desktop);else if(realpathSync(desktop)!==episode)throw new Error('桌面入口冲突');
writeNew(path.join(episode,'00_工程控制/桌面入口回执.v1.json'),{entry:desktop,type:'single-directory-symlink',target:episode,resolved:realpathSync(desktop),duplicateProjectCreated:false});
writeNew(path.join(episode,'README_先看这里.md'),`# 在兰州，把企业AI服务做下去\n\n唯一工程：${episode}\n\n桌面入口：${desktop}\n\n## 现在的状态\n\nV9.1预拍策划已编译校验，5段纸艺共42秒，额外AI写实0段，未生成首帧和视频，尚未收到本条原片。正文按用户这次提供的23段保留。\n\n## 文件放哪里\n\n- 本条完整实拍放进 02_原片。\n- 五段纸艺视频按P01到P05对应放进 05_纸艺视频，保留源音轨和文件名。\n- 自有、已授权、已脱敏工位或资料实拍可放 06_补充实拍素材，不是拍摄的前置条件。\n- 官方通知、解读长图和5个附件已在 03_官方素材。\n- 导演总策划、首帧提示词、图生视频提示词及配对JSON在 04_导演拆解/v9.1-r1。\n- 07_预览与质检、08_发布包为后续预留，当前没有成片。\n\n## 给首帧批量项目的交接文本\n\n请读取本期的 ${planDir}/first-frame-prompts.v1.json，按P01到P05及各自pairId执行。先验证P02一张，最终要交付带正确纸面中文的首帧，不是空白底图。底图生成之后按实际纸牌重新标定，按deterministicTextBake.labels写字、OCR并逐图视觉验收。不得更改口播、节点文字、标签所属组或动作语义；失败时保留合格底图，不盲目重生。先交首帧与回执，不提交RunningHub、不付费。\n\n这是一份交接说明，本轮尚未向其他项目派发生成。带字首帧验收后，图生视频项目再按独立的RunningHub清单与同镜带字图片配对；不要把首帧prompt当动态图prompt。\n\n实录和素材到齐后还需重新对时、157卡匹配与小样。用户看过小样后才能正式渲染；发布包仍按原标准，不自动发布。\n`);
writeNew(path.join(episode,'00_工程控制/本轮技术检查.v1.json'),{taskId:request.taskId,createdAt:new Date().toISOString(),phase:'pre-shoot',status:'director-prompt-packs-ready',verbatimParagraphs:23,paperScenes:5,paperLabels:20,paperPlannedDurationSeconds:42,officialSavedItems:official.items.length,officialShaCheck:'pass',firstFrameAndMotionPaired:true,skillValidation:bind(path.resolve(repo,request.outputs.validationReceiptPath)),stateValidation:bind(path.join(episode,'00_工程控制/v9-state-validation.v1.json')),skillLock:bind(path.join(repo,'workflow/director-skill-lock.v1.json')),lockRepair:{cause:'已提交1df7352渲染入口加固后四个文件的锁未同步',scope:'仅重建四个哈希记录与派生汇总，未改Skill代码、未改正式门禁',tests:['正式渲染入口边界回归通过','生产preflight 28/28通过','活动档案锁回归通过','预拍合同回归通过','当前V9.1活动档案校验通过'],realAuthorizedRenderTested:false},knownLimits:['视频号短链正文不可读，不声称还原原视频内容','尚未生图，文字清晰与动态稳定性待验证','未收到原片，拍后实录重绑/字幕/157卡自动匹配待执行','原始长图1069x14601只能局部取用，不能缩整图播放','五份WPS附件原样存档，只做文件类型/哈希检查，未逐页审阅'],externalActions:{generation:0,uploads:0,payments:0,published:false}});

function allFiles(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?allFiles(path.join(dir,d.name)):d.isFile()?[path.join(dir,d.name)]:[]);}
const files=allFiles(episode).map(p=>({...bind(p),bytes:readFileSync(p).length}));
writeNew(path.join(episode,'00_工程控制/交付清单_SHA256.v1.json'),{taskId:request.taskId,createdAt:new Date().toISOString(),status:'pre-shoot-preparation-only',selfExcluded:true,files});
console.log(JSON.stringify({ok:true,stateCheck,files:files.length,desktop,promptSha256:sha(path.join(planDir,'first-frame-prompts.v1.json'))}));
