// 仅修复当前已授权23秒小样的三处实际叠字；保留首版与全部旧控制记录。
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..'),previous=resolve(out,'../控制');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const ref=p=>({path:relative(root,p),sha256:createHash('sha256').update(readFileSync(p)).digest('hex')});
const write=(name,body)=>{const p=resolve(out,name);writeFileSync(p,JSON.stringify(body,null,2)+'\n',{flag:'wx'});return p;};
assert(process.argv.includes('--component-frozen'),'需要root最终冻结后执行');
assert(!existsSync(resolve(out,'production-job.sample.v1.json')),'修订job已有文件，不覆盖');
const oldJobPath=resolve(previous,'production-job.sample.v1.json'),oldJob=read(oldJobPath);
const oldInputPath=resolve(root,oldJob.productionGate.firstCandidateInput.path),oldInput=read(oldInputPath);
const runtimePath=resolve(root,oldInput.artifacts.runtimePlan.path);
assert.equal(ref(runtimePath).sha256,oldInput.artifacts.runtimePlan.sha256,'本次三处版式返修不得改动计划、声音或媒体');
const input=write('first-candidate-input.v1.json',{...oldInput,executionGroupId:'codex-small-business-ai-agility-motion-sample-r3-repair1'});
const job={...oldJob,title:'小公司AI_24至47秒_动效优化R3_过渡叠字修订1',
 knowledgeContext:{taskId:'small-business-ai-agility-motion-sample-r3-repair1-20261017',contextPath:'small-business-ai-agility-motion-sample-r3-repair1-20261017/context.json'},
 productionGate:{...oldJob.productionGate,firstCandidateInput:ref(input),localChatPreviewAuthorization:null},
 preview:{...oldJob.preview,output:'edit/20261017_small_business_ai_agility/08_动效优化小样R3/小公司AI_24-47秒_动效优化R3_1080p_有音效_修订1.mp4'},
 preparationNote:'沿用用户已批准的同一23秒样片范围，只修实片发现的三处过渡叠字。旧输出/回执/控制目录不覆盖，未应用整片或改变全局版本。'};
write('production-job.sample.v1.json',job);
write('返修范围与旧版保留.v1.json',{schemaVersion:'episode-scoped-sample-repair/v1',createdAt:new Date().toISOString(),
 previousJob:ref(oldJobPath),previousInput:ref(oldInputPath),userAuthorization:oldJob.productionGate.localChatPreviewAuthorization,
 sourceUserRequest:ref(resolve(previous,'本轮局部动效小样授权原话.v1.json')),
 defects:['约882帧层级多退出与汇报进入交叉叠化','约990帧收横排时节点斜向穿越造成叠字','约1375帧尾词与上一节点同时可见造成叠字'],
 requestedRepair:['层级多先退场后出现汇报','先水平分列再竖移','尾词延后并给上一节点完成退场'],
 sourceRangeFrames:{start:720,end:1409},runtimePlanUnchanged:true,audioAndCaptionsUnchanged:true,
 previousVideoPreserved:true,previousReceiptPreserved:true,previousControlDirectoryPreserved:true,
 humanAcceptancePerformed:false,formalAuthorized:false,publishAuthorized:false,renderInvoked:false});
write('组件冻结清单.v1.json',{frozenAt:new Date().toISOString(),files:['index.tsx','Composition.tsx','sample-plan.snapshot.json','sample-cues.v1.json','tsconfig.json'].map(n=>ref(resolve(root,'remotion/src/small-business-ai-agility-r3-sample',n))),
 frozenFor:'同一R3样片三处叠字返修；新输出保留首版',renderInvoked:false});
console.log(JSON.stringify({prepared:true,job:ref(resolve(out,'production-job.sample.v1.json')),renderInvoked:false}));
