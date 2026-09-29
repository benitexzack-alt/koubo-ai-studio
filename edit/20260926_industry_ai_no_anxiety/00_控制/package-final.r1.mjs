import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const ep='edit/20260926_industry_ai_no_anxiety';
const qa=`${ep}/07_预览与质检/正式R1`;
const pkg=`${ep}/09_发布包/行业经验配AI_V8_R1`;
const abs=p=>path.resolve(root,p);
const read=p=>JSON.parse(fs.readFileSync(abs(p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(abs(p))).digest('hex');
const bind=p=>({path:p,sha256:hash(p)});
const write=(p,v)=>fs.writeFileSync(abs(p),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const copy=(src,dst)=>fs.copyFileSync(abs(src),abs(dst),fs.constants.COPYFILE_EXCL);
const media=read(`${qa}/media-qa.r1.json`);
const audio=read(`${qa}/final-aac-audio-qa.json`);
const final=media.output.path;
assert.equal(hash(final),media.output.sha256);
assert.equal(audio.finalSha256,media.output.sha256);
assert.equal(audio.retainedEventCount,7);
assert.equal(audio.alignment.bestDelaySamples,0);
assert(media.fullDecodePassed && !media.blackFramesDetected && !media.longSilenceDetected);
assert(audio.paper.length===5 && audio.paper.every(p=>p.nativeAudioRetained));
assert.equal(fs.realpathSync('/Users/pc/Desktop/口播素材/2026-09-26_行业经验配AI'),abs(ep));
const visual={status:'sampled-frames-reviewed',output:bind(final),reviewedFrames:media.frames,
  findings:['29个抽帧复核，含所有纸艺、3处Shotcraft、公开资料与结尾。','资料段真人位于左下；资料正文、来源、双语字幕分区。','P03原生运镜末段出现字牌自然出画，未扩大裁切；P04纸车经过前景立柱时自然遮挡。','推荐真人截图来自本条成片122.7秒，无字幕遮脸、眼睛睁开。'],
  normalSpeedFullWatchByAssistant:false,userFullWatchConfirmed:false,publishAuthorized:false};
write(`${qa}/visual-review.r1.json`,visual);
const selectionPath=`${ep}/04_Remotion准备/动效选择.r1.json`;
const selection=read(selectionPath);
const component='skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx';
const vendor='remotion/src/industry-ai-no-anxiety-final-r1/vendor/ShotcraftEffects.tsx';
assert.equal(hash(component),hash(vendor));
const registry=read('skills/koubo-shotcraft-library/registry.v1.json');
const receipt={schemaVersion:'koubo-shotcraft-application-receipt/v1',taskId:selection.taskId,revisionId:selection.revisionId,
  selection:bind(selectionPath),output:bind(final),implementation:bind(vendor),
  applications:selection.beats.filter(b=>b.decision==='apply').map(b=>({beatId:b.beatId,effectId:b.effectId,frames:b.frames,
    component:{name:registry.effects.find(e=>e.id===b.effectId).component,...bind(component)},outputSha256:hash(final),finalWorking:true})),
  reviewScope:'实际最终MP4抽帧与固定组件落地核对，不代替用户全片视听确认'};
write(`${qa}/shotcraft-application.r1.json`,receipt);
const validation=JSON.parse(execFileSync(process.execPath,['skills/koubo-shotcraft-library/scripts/validate-application-receipt.mjs',`${qa}/shotcraft-application.r1.json`,'.'],{encoding:'utf8'}));
assert.equal(validation.status,'application-receipt-valid');
write(`${qa}/shotcraft-validation.r1.json`,validation);
copy(final,`${pkg}/行业经验配AI_正片_1080P.mp4`);
copy(`${qa}/frames/122_7.png`,`${pkg}/本条成片真人截图.png`);
write(`${pkg}/真人截图来源.json`,{source:bind(final),seconds:122.7,frame:3681,screenshot:bind(`${pkg}/本条成片真人截图.png`),aiRedrawn:false});
const captionsPath=`${ep}/06_实录与字幕/实录双语字幕_候选.r1.json`;
const captions=read(captionsPath);
assert.equal(captions.length,59);
const stamp=n=>{const ms=Math.round(n);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
for(const lang of ['zh','bilingual']) write(`${pkg}/${lang==='zh'?'实录中文字幕':'实录中英文字幕'}.srt`,captions.map((c,i)=>`${i+1}\n${stamp(c.startMs)} --> ${stamp(c.endMs)}\n${c.zh}${lang==='bilingual'?'\n'+c.en:''}\n`).join('\n'));
copy(`${ep}/01_素材投放区/05_公开素材_Codex准备/公开资料引文.r1.json`,`${pkg}/公开资料来源.json`);
const publicationPath=`${pkg}/发布文案.md`;
const coverPath=`${pkg}/3比4真人截图合成封面提示词.md`;
const factLock={scope:'本次发布包摘录，不重写实录正文',subtitleAuthority:bind(captionsPath),
  extracts:{mainTitle:'C01',alternative1:'C02',alternative2:'C22',publicationCopy:['C08','C09','C22'],identity:'C59'},
  newFacts:[],pending:['全文观点及素材权限的发布前终审不由本次技术检查替代'],noProfitGuarantee:true};
write(`${pkg}/文案事实锁.json`,factLock);
write(`${pkg}/文案审校报告.json`,{schema_version:1,task_id:'task-20260929T180000Z-industry-final-r1',status:'extract-and-cover-packaging-reviewed',
  scope:'原实录摘录标题与发布文案、真人截图封面提示词；不是新口播稿门禁放行',reviewed_at:new Date().toISOString(),
  draft:bind(publicationPath),coverPrompt:bind(coverPath),factLock:bind(`${pkg}/文案事实锁.json`),
  skills:{humanizer_zh:{...bind('/Users/pc/.codex/skills/humanizer-zh/SKILL.md'),read:true},humanize_koubo_script:{...bind('skills/humanize-koubo-script/SKILL.md'),read:true}},
  checks:{humanizer_pattern_scan_completed:true,ai_boundary_review_completed:true,fact_safe_rewrite_completed:true,retention_risk_review_completed:true,read_aloud_completed:false,voice_match_completed:true},
  readAloudNote:'未新增口播正文；标题文案从已录真人口播摘取，不冒称助手朗读或听审。',
  ai_boundary_review:{notes:'标题与文案保留本人实录问句；制作说明与发布文案隔离；封面不重绘真人、不增加收益或客户事实。'},
  retention_review:{risk_node_count:0,nodes:[],no_high_risk_reason:'仅短句摘录，主体与行业经验明确，无新增收益许诺或夸张悬念；此结果不推广为全片留存结论。'},
  fact_changes:{new_facts:[],removed_facts:[],wording_strength_changes:[],pending_user_confirmations:['最终成片完整观看']},
  scores:{directness:9,spoken_naturalness:9,rhythm:8,personal_voice:10,fact_fidelity:10}});
write(`${pkg}/使用说明.md`,'# 行业经验配AI｜发布包\n\n正片：1920×1080、30fps、122.9秒。保留完整实录，含59段双语字幕、5段纸艺原生音、3处Shotcraft与7个重点音效。\n\n- `行业经验配AI_正片_1080P.mp4`：完整正片。\n- `本条成片真人截图.png`：本条正片122.7秒原帧，可配合3比4封面提示词制作封面；未生成封面成图。\n- `发布文案.md`：主标题、两个备选、发布文案、话题；提醒部分不复制。\n- 两份SRT：实际口播中文字幕与中英文字幕备份，成片已内嵌。\n- `公开资料来源.json`：片内短引文来源。\n\n技术检查与29个风险帧抽检通过，不代替正常速度全片视听。样片已通过，正片待您完整确认；没有上传或发布，全文事实及素材权限终审仍是独立事项。\n');
for(const name of ['media-qa.r1.json','final-aac-audio-qa.json','audio-remux-receipt.r1.json','visual-review.r1.json','shotcraft-application.r1.json','shotcraft-validation.r1.json']) copy(`${qa}/${name}`,`${pkg}/${name}`);
const files=fs.readdirSync(abs(pkg)).filter(n=>fs.statSync(abs(`${pkg}/${n}`)).isFile()).map(n=>({...bind(`${pkg}/${n}`),bytes:fs.statSync(abs(`${pkg}/${n}`)).size}));
const required=['行业经验配AI_正片_1080P.mp4','本条成片真人截图.png','3比4真人截图合成封面提示词.md','发布文案.md'];
assert(required.every(n=>files.some(f=>f.path.endsWith('/'+n)&&f.bytes>0)));
assert(['主标题：','备选一：','备选二：','# 发布文案','# 话题'].every(s=>fs.readFileSync(abs(publicationPath),'utf8').includes(s)));
assert.equal(hash(`${pkg}/行业经验配AI_正片_1080P.mp4`),hash(final));
write(`${pkg}/发布记录.v1.json`,{releaseId:'industry-ai-no-anxiety-v8-r1-20260929',status:'formal-candidate-awaiting-full-watch',
  packageCompleteness:'six-required-deliverables-present',productionReceipt:media.sourceProductionReceipt,final:bind(final),files,
  coverScreenshotSeconds:122.7,captionCount:59,shotcraftCount:3,sfxCount:7,paperCount:5,
  localPackageCheck:'passed',genericFullReleaseGateClaimed:false,previewApproved:true,userFullWatchConfirmed:false,publishAuthorized:false});
const record=read(`${pkg}/发布记录.v1.json`);
for(const f of record.files) assert.equal(hash(f.path),f.sha256);
write(`${qa}/package-validation.r1.json`,{status:'local-package-valid',releaseRecord:bind(`${pkg}/发布记录.v1.json`),fileCount:files.length,
  requiredDeliverableGroups:6,userFullWatchConfirmed:false,publishAuthorized:false});
console.log(JSON.stringify({status:'local-package-valid',packagePath:abs(pkg),fileCount:files.length,finalSha256:hash(final)},null,2));
