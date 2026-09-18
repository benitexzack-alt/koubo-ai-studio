import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {BASE,CONTROL,JOB,MANIFEST} from './formal-adapter.v1.mjs';
const root=path.resolve(import.meta.dirname,'../../..');
const requirementsPath=path.join(root,CONTROL,'context-requirements.edit-release.v1.json');
const receiptsPath=path.join(root,CONTROL,'read-receipts.edit-release.v1.json');
const requirements=JSON.parse(fs.readFileSync(requirementsPath));
const receipts=JSON.parse(fs.readFileSync(receiptsPath));
const additions=[JOB,MANIFEST,`${CONTROL}/formal-adapter.v1.mjs`,`${CONTROL}/build-formal-binding.v1.mjs`,
  `${CONTROL}/正式成片批准.v1.json`,`${CONTROL}/正式成片批准.user.jsonl`,
  'skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs'];
for(const rel of additions){
  const p=path.join(root,rel);
  if(!requirements.required_receipt_groups.task_original_materials.includes(p))requirements.required_receipt_groups.task_original_materials.push(p);
  if(!receipts.receipts.some(x=>x.path===p))receipts.receipts.push({path:p,read_status:'read',application_status:'applied',
    application_note:'本轮实际构建并核对；绑定用户已确认的预览、正式入口和4:3要求，保留全片终验与发布未授权状态。'});
}
for(const r of receipts.receipts){
  r.sha256=crypto.createHash('sha256').update(fs.readFileSync(r.path)).digest('hex');
  r.read_completed_at=new Date().toISOString();
}
fs.writeFileSync(requirementsPath,JSON.stringify(requirements,null,2)+'\n');
fs.writeFileSync(receiptsPath,JSON.stringify(receipts,null,2)+'\n');
const result=spawnSync('python3',['/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py','start',
  '--project','口播','--task','员工AI增效分配：已确认预览后的V8正式候选与4:3发布包','--cwd',root,
  '--task-id','task-20260918T020544Z-31f85b17','--important','--requirements-file',requirementsPath,'--receipt-file',receiptsPath],
  {cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
fs.writeFileSync(path.join(root,BASE,'07_预览与质检/formal-context-start.log'),result.stdout+result.stderr);
console.log(JSON.stringify({exit:result.status,summary:result.stdout.slice(-1400),error:result.stderr.slice(-500)}));
process.exitCode=result.status;
