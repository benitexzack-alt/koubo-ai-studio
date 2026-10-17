// 同一23秒候选缺陷返修：复用已实际读取且哈希未变的规则；重新绑定当前job。
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..'),previous=resolve(out,'../控制');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const old=read(resolve(previous,'知识读取与应用回执.v1.json'));
const sourceNotes=['knowledge/00-项目知识索引.md','project.md','knowledge/08-决策与复盘日志.md','AGENTS.md',
 'knowledge/22-实录优先字幕与系列发布包硬门禁.md','knowledge/23-V9导演编排与动效采用基线.md',
 'workflow/active-production-profile.v1.json','research/20261017_agility_motion_review/README.md'];
const receipts=sourceNotes.map(p=>{const file=resolve(root,p),entry=old.receipts.find(r=>r.path===file);assert(entry);assert.equal(hash(file),entry.sha256,'已读规则变化必须重读');return entry;});
const names=['production-job.sample.v1.json','first-candidate-input.v1.json','本期局部预览聊天授权.v1.json',
 '返修范围与旧版保留.v1.json','组件冻结清单.v1.json'];
for(const name of names){const path=resolve(out,name);readFileSync(path,'utf8');receipts.push({path,sha256:hash(path),read_status:'read',
 read_completed_at:new Date().toISOString(),application_status:'applied',application_note:'本轮实际构造/读取的返修输入：只修23秒样片三处实片叠字，原版回执保留；声音计划不变，未整片或发布。'});}
for(const name of ['本轮局部动效小样授权原话.v1.json','用户局部预览范围.v1.json','统一启动回执.v1.md']){
 const path=resolve(previous,name),entry=old.receipts.find(r=>r.path===path);assert(entry);assert.equal(hash(path),entry.sha256);receipts.push(entry);
}
const groups={current_project_index:[resolve(root,'knowledge/00-项目知识索引.md')],current_project_summary:[resolve(root,'project.md')],
 latest_update:[resolve(root,'knowledge/08-决策与复盘日志.md')],
 applicable_rules_or_skills:['AGENTS.md','knowledge/22-实录优先字幕与系列发布包硬门禁.md','knowledge/23-V9导演编排与动效采用基线.md','workflow/active-production-profile.v1.json'].map(p=>resolve(root,p)),
 historical_failures:[resolve(root,'knowledge/08-决策与复盘日志.md'),resolve(out,'返修范围与旧版保留.v1.json')],
 task_original_materials:[...names.map(n=>resolve(out,n)),...['本轮局部动效小样授权原话.v1.json','用户局部预览范围.v1.json','统一启动回执.v1.md'].map(n=>resolve(previous,n)),resolve(root,'research/20261017_agility_motion_review/README.md')]};
writeFileSync(resolve(out,'知识上下文需求.v1.json'),JSON.stringify({required_receipt_groups:groups},null,2)+'\n',{flag:'wx'});
writeFileSync(resolve(out,'知识读取与应用回执.v1.json'),JSON.stringify({schemaVersion:'episode-context-read-receipts/v1',receipts},null,2)+'\n',{flag:'wx'});
console.log('已绑定本轮返修job，旧版规则读取回执按实际原时间/哈希复用；未渲染。');
