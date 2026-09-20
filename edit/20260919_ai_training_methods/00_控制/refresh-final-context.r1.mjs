import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),base='edit/20260919_ai_training_methods',control=`${base}/00_控制`;
const taskId='task-20260920T122900Z-a17f1001';
const groups={
 current_project_index:['knowledge/00-项目知识索引.md'],
 current_project_summary:['project.md'],
 latest_update:['knowledge/08-决策与复盘日志.md'],
 applicable_rules_or_skills:['skills/koubo-shotcraft-library/SKILL.md','knowledge/20-V8连续语义动效与可感知音效基线.md','knowledge/22-实录优先字幕与系列发布包硬门禁.md','workflow/active-production-profile.v1.json'],
 historical_failures:['knowledge/20-V8连续语义动效与可感知音效基线.md','knowledge/22-实录优先字幕与系列发布包硬门禁.md'],
 task_original_materials:[`${base}/06_剪辑工程/production-formal.r1.json`,`${control}/formal-authorization.r1.json`,`${base}/05_实录与字幕/final-r1-bilingual-captions.json`,`${base}/05_实录与字幕/final-r1-spoken-source-policy.json`,'remotion/src/ai-training-final-r1/runtime-plan.r1.json',`${control}/正式直出调整.r1.json`],
};
const requirements={schema_version:'opc-task-requirements/1.0',task_id:taskId,required_receipt_groups:Object.fromEntries(Object.entries(groups).map(([k,ps])=>[k,ps.map(p=>path.resolve(root,p))]))};
const notes={'project.md':'本轮读取顶部当前本期状态及默认V8参考；只延续edit-release，不把历史待办叠加。','knowledge/08-决策与复盘日志.md':'本轮读取顶部本期R2及暂停记录；用户最新已明确保留原声，旧暂停点不再是待决策项。','knowledge/00-项目知识索引.md':'本轮读取索引，定位并应用V8与实录字幕、仅本地正式候选边界。'};
const receipts={schema_version:'opc-read-receipts/1.0',task_id:taskId,receipts:[...new Set(Object.values(groups).flat())].map(p=>({path:path.resolve(root,p),sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex'),read_status:'read',application_status:'applied',read_completed_at:new Date().toISOString(),application_note:notes[p]??'本轮已实际读取并应用：保留本期完整原声和实录文字、已批准小样基线、每个动效绑定音效，不伪造全片人审或发布授权。'}))};
const req=`${control}/context-requirements.final-r1.json`,rec=`${control}/read-receipts.final-r1.json`;
fs.writeFileSync(req,JSON.stringify(requirements,null,2)+'\n');fs.writeFileSync(rec,JSON.stringify(receipts,null,2)+'\n');
const result=spawnSync('python3',['/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py','start','--project','口播','--task','AI八种训练方法：完整原声实录字幕，每个动效补音效，直接正式成片','--cwd',root,'--task-id',taskId,'--important','--requirements-file',path.resolve(req),'--receipt-file',path.resolve(rec)],{cwd:root,encoding:'utf8',maxBuffer:20e6});
fs.writeFileSync(`${control}/context-final-r1.log`,(result.stdout??'')+(result.stderr??''));console.log((result.stdout??'').slice(-3500));if(result.status!==0)console.error(result.stderr);process.exitCode=result.status;
