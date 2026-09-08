import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {ROOT,KB,CONTROL,hashFile,readJson,write,knowledge} from './formal-core.mjs';
const here=path.join(ROOT,CONTROL),folder=path.join(here,'context-v2');
const taskId='opc-task-20260908-lanzhou-r2-formal-v2';
const prior=path.join(ROOT,'edit/20260906_lanzhou_ai_services/00_工程控制/candidate-preview-r2/context');
const old=readJson(path.join(prior,'read-receipts.v3.json'));
for(const r of old.receipts)assert.equal(hashFile(r.path),r.sha256,r.path);
const requirements=readJson(path.join(prior,'requirements.v3.json'));
requirements.taskId=taskId;
const newFiles=['job.v2.json','formal-core.mjs','worker.mjs','run.mjs','user-authorization.evidence.json'].map(n=>path.join(here,n));
requirements.required_receipt_groups.latest_update=[newFiles[0],newFiles.at(-1)];
requirements.required_receipt_groups.task_original_materials.push(...newFiles);
const receipts=old.receipts.map(r=>({...r,inheritanceNote:'SHA未变，继承先前真实阅读；旧预览授权只作历史，本条正式权限以当前job和新用户原文为准。'}));
for(const p of newFiles)receipts.push({path:p,sha256:hashFile(p),read_status:'read',read_completed_at:new Date().toISOString(),
  read_scope:'本轮逐行编写并审查的完整隔离正式执行代码/结构化授权与绑定清单',retrieved:true,read:true,applied:true,
  application_status:'applied',retrieval_source:'current-turn-authored-and-reviewed',application_note:'仅当前用户授权的音频收尾及1080正式输出；原R2字幕和视觉字节保持，所有原片与历史门禁不修改，不公开发布。'});
write(path.join(folder,'requirements.v1.json'),requirements);
write(path.join(folder,'read-receipts.v1.json'),{schemaVersion:old.schemaVersion,taskId,receipts,generatedAt:new Date().toISOString()});
const args=[path.join(KB,'04_Claude Code日常操作/scripts/opc_rag.py'),'--pretty','start','--project','口播','--task',
  '兰州企业AI服务R2正式交付：用户已确认其他内容且明确要求音效改完直接成片。当前新job绑定8393帧、8149帧完整原口播、244帧新闻、5条本条已接受纸艺、实录字幕及R2完整混音。仅全局-0.3dB和原1920视频输出，不改文案或视觉，不复用旧事故链，不外部调用，不发布；旧预览formal=false保持。',
  '--cwd',ROOT,'--task-id',taskId,'--important','--requirements-file',path.join(folder,'requirements.v1.json'),'--receipt-file',path.join(folder,'read-receipts.v1.json')];
const r=spawnSync('python3',args,{cwd:ROOT,encoding:'utf8',maxBuffer:32*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',KOUBO_ACCOUNT_PREFLIGHT_OUTPUT_ROOT:path.join(folder,'account-feedback')}});
for(const k of ['stdout','stderr'])fs.writeFileSync(path.join(folder,`start.${k}.txt`),r[k]??'',{flag:'wx'});
write(path.join(folder,'start.command.json'),{args,exitCode:r.status});
assert.equal(r.status,0,r.stdout?.slice(-3000));
assert.equal(JSON.parse(r.stdout).status,'context-ready');
const contextPath=path.join(KB,'.opc-rag/tasks',taskId,'context.json');
const binding={taskId,contextPath,sha256:hashFile(contextPath)};
write(path.join(folder,'binding.v1.json'),binding);
write(path.join(folder,'validation.v1.json'),knowledge(binding));
console.log(JSON.stringify(binding));
