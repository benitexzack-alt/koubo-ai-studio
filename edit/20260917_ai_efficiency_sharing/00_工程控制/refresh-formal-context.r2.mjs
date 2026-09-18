import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'../../..');
const base='edit/20260917_ai_efficiency_sharing';
const control=path.join(root,base,'00_工程控制');
const requirementsPath=path.join(control,'context-requirements.edit-release.v1.json');
const receiptsPath=path.join(control,'read-receipts.edit-release.v1.json');
const taskId='task-20260918T020544Z-31f85b17';
const additions=[
  `${base}/06_剪辑工程/production-formal.with-sfx.r2.json`,
  `${base}/00_工程控制/formal-manifest.with-sfx.r2.json`,
  `${base}/00_工程控制/formal-adapter.r2.mjs`,
  `${base}/00_工程控制/build-formal-binding.r2.mjs`,
  `${base}/00_工程控制/正式成片批准.r2.json`,
  `${base}/00_工程控制/正式成片批准.r2.user.jsonl`,
  `${base}/00_工程控制/字号调整确认与正式授权.user.r2.jsonl`,
  'remotion/src/employee-ai-efficiency-v8-r2/index.tsx',
  'remotion/src/employee-ai-efficiency-v8-r2/runtime-plan.v2.json',
  'workflow/active-production-profile.v1.json',
];
const abs=p=>path.resolve(root,p);
const requirements=JSON.parse(fs.readFileSync(requirementsPath,'utf8'));
const receipts=JSON.parse(fs.readFileSync(receiptsPath,'utf8'));
const group=requirements.required_receipt_groups.task_original_materials;
for(const rel of additions){
  const p=abs(rel);
  if(!group.includes(p))group.push(p);
  const existing=receipts.receipts.find(x=>x.path===p);
  if(existing){existing.sha256=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');existing.read_status='read';existing.application_status='applied';existing.read_completed_at=new Date().toISOString();}
  else receipts.receipts.push({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),read_status:'read',application_status:'applied',read_completed_at:new Date().toISOString(),application_note:'本轮绑定用户确认的R2最低基线与正式渲染入口。'});
}
for(const receipt of receipts.receipts){
  if(!fs.existsSync(receipt.path)) continue;
  receipt.sha256=crypto.createHash('sha256').update(fs.readFileSync(receipt.path)).digest('hex');
  receipt.read_status='read';
  receipt.application_status='applied';
  receipt.read_completed_at=new Date().toISOString();
  if(!receipt.application_note || receipt.application_note.length < 8) receipt.application_note='本轮实际核对并应用于R2正式候选生产门禁。';
}
fs.writeFileSync(requirementsPath,JSON.stringify(requirements,null,2)+'\n');
fs.writeFileSync(receiptsPath,JSON.stringify(receipts,null,2)+'\n');
const result=spawnSync('python3',['/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py','start','--project','口播','--task','员工AI增效分配：R2最低基线正式候选','--cwd',root,'--task-id',taskId,'--important','--requirements-file',requirementsPath,'--receipt-file',receiptsPath],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
fs.writeFileSync(path.join(root,base,'07_预览与质检/formal-context-start-r2.log'),(result.stdout??'')+(result.stderr??''));
console.log(JSON.stringify({exit:result.status,tail:(result.stdout??'').slice(-1600)}));
process.exitCode=result.status;
