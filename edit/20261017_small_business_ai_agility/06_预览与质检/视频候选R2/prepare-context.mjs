import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..');
const notes={
 'knowledge/00-项目知识索引.md':'已读取项目阶段索引，应用V9完整观看候选；不扩展导演、发布与下游任务。',
 'project.md':'已读顶部当前本期剪辑和首帧状态，保留原137.533秒工程，不复用上期验收；未通读无关历史。',
 'knowledge/08-决策与复盘日志.md':'已读顶部本期首帧连续失败及上一期声音/索引事故；保留首帧r1/r2历史失败；本轮采用用户新提交的成品8秒视频，不改写旧验收。',
 'AGENTS.md':'已读取本轮用户提供的全套项目规范；只修本期视频R2和内部聊天候选入口，保留R1，不修改正式或发布门禁。',
 'knowledge/22-实录优先字幕与系列发布包硬门禁.md':'已读实录唯一正文，81段原SRT只做可重放78组分页，不改原话；正式发布包不提前触发。',
 'knowledge/23-V9导演编排与动效采用基线.md':'已读V9基线；沿用已有动效/原声/字幕与左下真人，实际视听待审。',
 'workflow/active-production-profile.v1.json':'已读当前V9档案，逻辑1080p/30fps，输出1080p完整观看候选及720p前35秒无附加音效对照，不是正式片验收。'
};
const taskNames=['production-job.first-candidate.v1.json','first-candidate-input.v1.json','用户预览范围.v1.json','输入适配实测.v1.json','本期内部预览聊天授权_完整.v1.json','production-job.no-sfx-first35s.v1.json','本期内部预览聊天授权_无附加音效.v1.json','本轮视频候选导出请求.v1.json','统一启动回执.v1.json'];
const groups={current_project_index:[resolve(root,'knowledge/00-项目知识索引.md')],current_project_summary:[resolve(root,'project.md')],latest_update:[resolve(root,'knowledge/08-决策与复盘日志.md')],
 applicable_rules_or_skills:['AGENTS.md','knowledge/22-实录优先字幕与系列发布包硬门禁.md','knowledge/23-V9导演编排与动效采用基线.md','workflow/active-production-profile.v1.json'].map(p=>resolve(root,p)),
 historical_failures:[resolve(root,'knowledge/08-决策与复盘日志.md')],task_original_materials:taskNames.map(n=>resolve(out,n))};
const receipts=Object.entries(notes).map(([p,note])=>({path:resolve(root,p),note}));
for(const name of taskNames)receipts.push({path:resolve(out,name),note:'本轮实际构造并复核的本期预览输入。当前输入与代码闭包实算绑定，原声全量同源、78分页全覆盖；真实聊天许可，不冒充独立签名/全片验收/发布。'});
writeFileSync(resolve(out,'知识上下文需求.v1.json'),JSON.stringify({required_receipt_groups:groups},null,2)+'\n');
writeFileSync(resolve(out,'知识读取与应用回执.v1.json'),JSON.stringify({schemaVersion:'episode-context-read-receipts/v1',receipts:receipts.map(r=>({path:r.path,
 sha256:createHash('sha256').update(readFileSync(r.path)).digest('hex'),read_status:'read',read_completed_at:new Date().toISOString(),application_status:'applied',application_note:r.note}))},null,2)+'\n');
console.log('已记录本轮实际读取与应用范围；未声明历史全库阅读。');
