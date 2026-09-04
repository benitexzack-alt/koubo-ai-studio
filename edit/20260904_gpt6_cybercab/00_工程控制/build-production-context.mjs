import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd();
const control='edit/20260904_gpt6_cybercab/00_工程控制';
const groups={
  current_project_index:['knowledge/00-项目知识索引.md'],
  current_project_summary:['project.md'],
  latest_update:['edit/20260904_gpt6_cybercab/00_工程控制/direct-formal-user-authorization.v1.json'],
  applicable_rules_or_skills:['knowledge/20-V8连续语义动效与可感知音效基线.md','knowledge/22-实录优先字幕与系列发布包硬门禁.md'],
  historical_failures:['knowledge/22-实录优先字幕与系列发布包硬门禁.md'],
  task_original_materials:['workflow/jobs/20260904_gpt6_cybercab_v80.production.json',
    'edit/20260904_gpt6_cybercab/04_导演拆解/剪后261秒_素材与镜头对位.v3.json',
    'edit/20260904_gpt6_cybercab/07_实录与字幕/turbo-review-r2/corrected-caption-pages.v1.json',
    'edit/20260904_gpt6_cybercab/00_工程控制/scoped-direct-export.v1.json'],
};
const notes={
  current_project_index:'按当前项目索引定位V8实录字幕与发布包规则；不沿用旧事故189秒素材链。',
  current_project_summary:'读取项目制作基线、当前GPT6与Cybercab准备状态及历次字幕/遮脸/音效事故记录，沿用V8且保留真实素材。',
  latest_update:'执行本条用户直接授权：无需新增预览确认，先修复实录转写与独立的正式直出入口，不代替公开发布。',
  applicable_rules_or_skills:'V8真人讲解连续语义覆盖；不使用全屏解释卡；原片声音唯一正文；输出后配真人帧和完整发布包。',
  historical_failures:'防止再次以文稿替换实录、忽略标签与口播语义、长末帧冻结、机器质检冒充人工验收。',
  task_original_materials:'已读取并应用本条实际job、六段用户素材映射、原片词级识别与授权清单；只删除明确授权的没有人负责。',
};
const requirements={required_receipt_groups:groups};
const receipts=Object.entries(groups).flatMap(([g,paths])=>paths.map(p=>({path:path.join(root,p),
  sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex'),read_status:'read',read_completed_at:new Date().toISOString(),
  application_status:'applied',application_note:notes[g]})));
fs.writeFileSync(`${control}/knowledge-requirements.v1.json`,JSON.stringify(requirements,null,2)+'\n');
fs.writeFileSync(`${control}/knowledge-read-receipts.v1.json`,JSON.stringify({receipts},null,2)+'\n');
console.log(JSON.stringify({groups:Object.keys(groups),receiptCount:receipts.length}));
