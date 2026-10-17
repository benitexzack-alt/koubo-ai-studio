// 同一本期从已确认R3到R4整片继续执行；复用真实启动回执，当前job另建知识上下文。
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..');
const notes={
 'knowledge/00-项目知识索引.md':'本期已读取索引，沿V9后期路线复用当前素材与原声；新R4只承接本条最新导出授权。',
 'project.md':'本轮已读顶部R3实片结果；用户后续确认23秒样片并要求整片，此新授权单独绑定，不把旧待审字样或小样通过误作整片验收。',
 'knowledge/08-决策与复盘日志.md':'本轮已读顶部R3三处实帧叠字与修订事实，保留旧失败和实际成功渲染回执；另核对R2知识索引失效教训。',
 'AGENTS.md':'当前任务直接适用全中文、实录优先、精确范围和成片待观看边界；本轮不改变文稿、来源事实或发布授权。',
 'knowledge/22-实录优先字幕与系列发布包硬门禁.md':'已读全文。R4字幕原样保留，原声完整；封面发布文字由父任务另准备，不以小样验收替代新整片观看。',
 'knowledge/23-V9导演编排与动效采用基线.md':'已读全文，同对象关系推进、阅读停留、真人交接与声点同步适用；不升级全局V9。',
 'knowledge/20-V8连续语义动效与可感知音效基线.md':'本轮读取V9继承版本纪律、0.5至0.7、视觉音频边界；人物保护与音效可感知须本条实际检查，技术计数不是人审。',
 'workflow/active-production-profile.v1.json':'已读当前活动V9档案，保留4126帧1080p/30fps；全长候选只走已授权预览route，正式验收仍独立。',
 'research/20261017_agility_motion_review/README.md':'本期已完整读取字小/空档/旧版关系表达研究；本轮按用户小样认可延续全文，不机械恢复固定切镜配额。'
};
const names=['production-job.full-candidate.v1.json','first-candidate-input.v1.json','用户整片候选范围.v1.json','输入适配检查.v1.json',
 '本期整片候选聊天授权.v1.json','本轮整片与发布包导出授权原话.v1.json','组件冻结清单.v1.json'];
const bootstrap=resolve(root,'edit/20261017_small_business_ai_agility/08_动效优化小样R3/控制/统一启动回执.v1.md');
const groups={current_project_index:[resolve(root,'knowledge/00-项目知识索引.md')],current_project_summary:[resolve(root,'project.md')],
 latest_update:[resolve(root,'knowledge/08-决策与复盘日志.md')],
 applicable_rules_or_skills:['AGENTS.md','knowledge/20-V8连续语义动效与可感知音效基线.md','knowledge/22-实录优先字幕与系列发布包硬门禁.md','knowledge/23-V9导演编排与动效采用基线.md','workflow/active-production-profile.v1.json'].map(p=>resolve(root,p)),
 historical_failures:[resolve(root,'knowledge/08-决策与复盘日志.md')],
 task_original_materials:[...names.map(n=>resolve(out,n)),bootstrap,resolve(root,'research/20261017_agility_motion_review/README.md')]};
const receipts=Object.entries(notes).map(([p,note])=>({path:resolve(root,p),note}));
for(const name of names)receipts.push({path:resolve(out,name),note:'本轮实际构造并复核的R4有音效完整候选：真实最新用户原话、23秒限定验收引用、独立全片文件闭包，未标新全片通过。'});
receipts.push({path:bootstrap,note:'复用2026-10-17本期R3阶段真实统一启动回执；本轮是同一视频已确认后的连续执行，此回执不冒称新运行，R4当前job另建实际context。'});
const now=new Date().toISOString();
writeFileSync(resolve(out,'知识上下文需求.v1.json'),JSON.stringify({required_receipt_groups:groups},null,2)+'\n',{flag:'wx'});
writeFileSync(resolve(out,'知识读取与应用回执.v1.json'),JSON.stringify({schemaVersion:'episode-context-read-receipts/v1',receipts:receipts.map(r=>({path:r.path,
 sha256:createHash('sha256').update(readFileSync(r.path)).digest('hex'),read_status:'read',read_completed_at:now,application_status:'applied',application_note:r.note}))},null,2)+'\n',{flag:'wx'});
console.log('R4当前job知识读取范围已绑定；复用此前真实启动记录，未重复账号预检或渲染。');
