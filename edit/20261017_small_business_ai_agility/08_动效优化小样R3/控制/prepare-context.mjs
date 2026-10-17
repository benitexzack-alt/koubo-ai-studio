// 本轮实际读取/构造的最小项目上下文。只用于R3局部视觉预览。
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..');
const notes={
 'knowledge/00-项目知识索引.md':'已读阶段索引，采用V9编辑预览并参考V8连续语义，不回退或启动新生成链。',
 'project.md':'已读顶部本期研究和已导出状态；本轮仅承接用户批准的24—47秒局部修改对照，旧全片保留。',
 'knowledge/08-决策与复盘日志.md':'已读顶部历史观看与当前纸艺事故段，并核对全片登记索引失效记录；不把过往静图失败或渲染后失败补写成功。',
 'AGENTS.md':'已读取当前聊天全文及本地阶段路由，应用局部任务精确边界、实录优先与未验收不得发布。',
 'knowledge/22-实录优先字幕与系列发布包硬门禁.md':'已读全文：字幕和音频不在本轮改写范围，源完整保留，输出仅截取获批23秒。',
 'knowledge/23-V9导演编排与动效采用基线.md':'已读全文：同一对象连续关系、大字可读、阅读停留与真人保护是本轮样片核验目标。',
 'workflow/active-production-profile.v1.json':'已读活动档案V9继承、范围和验收条件；本轮1080p/30fps局部预览不登记整片验收。',
 'research/20261017_agility_motion_review/README.md':'已读本期空档/字号/V7V8实片研究；按已获用户同意的最小23秒对照执行，不扩展全片。'
};
const names=['production-job.sample.v1.json','first-candidate-input.v1.json','用户局部预览范围.v1.json','输入适配检查.v1.json',
 '本期局部预览聊天授权.v1.json','本轮局部动效小样授权原话.v1.json','组件冻结清单.v1.json','统一启动回执.v1.md'];
const groups={current_project_index:[resolve(root,'knowledge/00-项目知识索引.md')],
 current_project_summary:[resolve(root,'project.md')],latest_update:[resolve(root,'knowledge/08-决策与复盘日志.md')],
 applicable_rules_or_skills:['AGENTS.md','knowledge/22-实录优先字幕与系列发布包硬门禁.md','knowledge/23-V9导演编排与动效采用基线.md','workflow/active-production-profile.v1.json'].map(p=>resolve(root,p)),
 historical_failures:[resolve(root,'knowledge/08-决策与复盘日志.md')],
 task_original_materials:[...names.map(n=>resolve(out,n)),resolve(root,'research/20261017_agility_motion_review/README.md')]};
const receipts=Object.entries(notes).map(([p,note])=>({path:resolve(root,p),note}));
for(const name of names)receipts.push({path:resolve(out,name),note:'本轮实际读取或构造的R3局部输入；用户原话、23秒限定、完整源保护、预览闭包与禁止正式/发布已核对。'});
writeFileSync(resolve(out,'知识上下文需求.v1.json'),JSON.stringify({required_receipt_groups:groups},null,2)+'\n',{flag:'wx'});
writeFileSync(resolve(out,'知识读取与应用回执.v1.json'),JSON.stringify({schemaVersion:'episode-context-read-receipts/v1',receipts:receipts.map(r=>({path:r.path,
 sha256:createHash('sha256').update(readFileSync(r.path)).digest('hex'),read_status:'read',read_completed_at:new Date().toISOString(),application_status:'applied',application_note:r.note}))},null,2)+'\n',{flag:'wx'});
console.log('已记录本轮局部任务读取与应用；未启动渲染。');
