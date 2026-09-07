import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(root,'../../../../..');
const taskId='opc-task-20260907-lanzhou-candidate-preview-r1-context';
const contextPath=`/Users/pc/Documents/个人知识库/.opc-rag/tasks/${taskId}/context.json`;
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const ctx=read(contextPath);
const validateFile=fs.readdirSync(root).filter(p=>p.endsWith('.validate-context.result.json')).sort().at(-1);
assert(validateFile,'缺少官方validate-context结果');
const validation=read(path.join(root,validateFile));
assert.equal(validation.status,'context-valid');
assert.equal(validation.gate.formal_execution_allowed,true);
assert.equal(ctx.task.id,taskId);
assert.equal(ctx.task.important,true);
assert.equal(ctx.status,'context-ready');
assert.equal(ctx.gate.formal_execution_allowed,true);
assert.notEqual(ctx.task.id,'task-20260906T154937Z-69f6ebf8');
const entries=Object.values(ctx.receipt_groups).flatMap(g=>g.entries);
for(const e of entries){
  assert.equal(hash(e.resolved_path),e.sha256,e.path);
  for(const state of ['retrieved','read','applied']) assert.equal(e.states[state],true,`${e.path}:${state}`);
}
const materialPaths=ctx.receipt_groups.task_original_materials.entries.map(e=>e.resolved_path);
for(const p of ['remotion/src/lanzhou-services-v91-candidate-r1/index.tsx','remotion/src/lanzhou-services-v91-candidate-r1/visual-plan.v1.json','edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r1/data.v1.json']) assert(materialPaths.includes(path.join(project,p)),p);
const permission=read(path.join(root,'../permission.v1.json'));
for(const key of ['formalEnabled','productionEligible','publishAuthorized','userPreviewApproved'])assert.equal(permission[key],false,key);
const binding={taskId,contextPath,sha256:hash(contextPath)};
fs.writeFileSync(path.join(root,'context-binding.v1.json'),JSON.stringify(binding,null,2)+'\n');
const report={schemaVersion:'candidate-context-integrity/v1',checkedAt:new Date().toISOString(),status:'verified-knowledge-context-only',binding,entryCount:entries.length,
  validationResult:path.join(root,validateFile),important:true,allCurrentInputHashesMatch:true,coreEntryAndImportJsonPresent:true,
  formalEnabled:false,productionEligible:false,publishAuthorized:false,codeReviewStatus:'awaiting-complete-runner-closure',allow:false,
  readScopeReceipt:path.join(root,'read-receipts.v1.json'),scopeDecision:path.join(root,'scope-decision.v1.json'),
  boundary:'技术门就绪，不代表全部bootstrap扩展历史逐项已读、ASR听验、源片语义通过、完整代码审查通过或正式渲染授权。'};
fs.writeFileSync(path.join(root,'context-integrity.v1.json'),JSON.stringify(report,null,2)+'\n');
const handoff=read(path.join(root,'handoff.v1.json'));
handoff.contextExists=true;handoff.contextValidationStatus='context-valid';handoff.binding=binding;
fs.writeFileSync(path.join(root,'handoff.v1.json'),JSON.stringify(handoff,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
