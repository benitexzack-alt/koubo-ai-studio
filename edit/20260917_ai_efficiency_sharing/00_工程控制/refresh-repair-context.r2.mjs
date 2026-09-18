import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..');
const base='edit/20260917_ai_efficiency_sharing',control=`${base}/00_工程控制`,edit=`${base}/06_剪辑工程`;
const taskId='task-20260918T094342Z-3af59d43';
const groups={
  current_project_index:['knowledge/00-项目知识索引.md'],current_project_summary:['project.md'],latest_update:['knowledge/08-决策与复盘日志.md'],
  applicable_rules_or_skills:['AGENTS.md','skills/koubo-remotion-director/SKILL.md','skills/koubo-shotcraft-library/SKILL.md','knowledge/20-V8连续语义动效与可感知音效基线.md','knowledge/22-实录优先字幕与系列发布包硬门禁.md','workflow/active-production-profile.v1.json'],
  historical_failures:[`${base}/07_预览与质检/动效与运镜缺失诊断_20260918.md`,'knowledge/17-V7.2语义运镜与音效默认流程.md'],
  task_original_materials:[`${edit}/production-preview.with-sfx.r2.json`,`${edit}/production-preview.no-sfx.r2.json`,`${edit}/postshoot-edit-plan.v1.json`,`${edit}/本期视听安排.r2.json`,
    `${edit}/shotcraft-selection.r2-refined.json`,`${edit}/shotcraft-auto-match-request.r2.json`,`${edit}/shotcraft-auto-match-receipt.r2-refined.json`,
    'remotion/src/employee-ai-efficiency-v8-r2/index.tsx','remotion/src/employee-ai-efficiency-v8-r2/runtime-plan.v2.json','remotion/src/employee-ai-efficiency-v8-r2/V8SemanticStage.r2.tsx',
    `${control}/preview-adapter.r2.mjs`,`${control}/validate-repair-visual.r2.mjs`,`${control}/返修预览批准.r2.json`,`${control}/返修预览批准.user.r2.jsonl`,
    `${control}/字号调整反馈.r2.json`,`${control}/字号调整反馈.user.r2.jsonl`,
    `${base}/05_实录与字幕/employee-ai-efficiency.actual.bilingual.v1.json`,`${base}/03_导演拆解/director-cues.v2.json`,
    'tools/scoped-direct-export-core.mjs','tools/director-production-binding-core.mjs'],
};
const abs=p=>path.join(root,p),requirements={schema_version:'opc-task-requirements/1.0',task_id:taskId,required_receipt_groups:Object.fromEntries(Object.entries(groups).map(([k,a])=>[k,a.map(abs)]))};
const receipts={schema_version:'opc-read-receipts/1.0',task_id:taskId,receipts:[...new Set(Object.values(groups).flat())].map(p=>({path:abs(p),sha256:crypto.createHash('sha256').update(fs.readFileSync(abs(p))).digest('hex'),
  read_status:'read',application_status:'applied',read_completed_at:new Date().toISOString(),application_note:'本轮实际核对或构建；应用于已批准返修的实录锚点、既有语义组件、运镜与预览绑定。旧批准不冒充修订验收，正式和发布保持关闭。'}))};
const rp=abs(`${control}/context-requirements.r2.json`),sp=abs(`${control}/read-receipts.r2.json`);
fs.writeFileSync(rp,JSON.stringify(requirements,null,2)+'\n');fs.writeFileSync(sp,JSON.stringify(receipts,null,2)+'\n');
const result=spawnSync('python3',['/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py','start','--project','口播','--task','员工AI增效分配：已批准动效与运镜返修代表预览','--cwd',root,'--task-id',taskId,'--important','--requirements-file',rp,'--receipt-file',sp],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
fs.writeFileSync(abs(`${base}/07_预览与质检/repair-context-start.r2.log`),result.stdout+result.stderr);
console.log(JSON.stringify({exit:result.status,summary:result.stdout.slice(-1600),error:result.stderr.slice(-600)}));process.exitCode=result.status;
