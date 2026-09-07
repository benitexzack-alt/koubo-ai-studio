import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(root,'../../../../..');
const kb='/Users/pc/Documents/个人知识库';
const cli=path.join(kb,'04_Claude Code日常操作/scripts/opc_rag.py');
const taskId='opc-task-20260907-lanzhou-candidate-preview-r1-context';
const action=process.argv[2];
if (!['status','index','start','validate-context'].includes(action)) throw new Error('仅允许status、index、start、validate-context；不提供full重建或知识写回入口。');
const args=[cli,'--pretty',action];
if(action==='start') args.push('--project','口播','--task','20260906_lanzhou_ai_services 独立候选知识上下文：本地全长有声低清小样，用户接受五段既有纸艺瑕疵且不重生不增费；formal=false；待最终request和独立代码闭包审查，不冒用导演原task或正式job。','--cwd',project,'--task-id',taskId,'--important','--requirements-file',path.join(root,'requirements.v1.json'),'--receipt-file',path.join(root,'read-receipts.v1.json'));
if(action==='validate-context') args.push('--context',path.join(kb,'.opc-rag/tasks',taskId,'context.json'));
const time=new Date().toISOString().replace(/[:.]/g,'-');
const prefix=path.join(root,`${time}.${action}`);
const result=spawnSync('python3',args,{cwd:project,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',KOUBO_ACCOUNT_PREFLIGHT_OUTPUT_ROOT:path.join(root,'account-feedback')},encoding:'utf8',maxBuffer:32*1024*1024});
fs.writeFileSync(prefix+'.stdout.txt',result.stdout??'');
fs.writeFileSync(prefix+'.stderr.txt',result.stderr??'');
const receipt={schemaVersion:'candidate-context-cli-command/v1',startedAt:time,endedAt:new Date().toISOString(),command:['python3',...args],exitCode:result.status,signal:result.signal,error:result.error?.message??null,stdout:prefix+'.stdout.txt',stderr:prefix+'.stderr.txt'};
fs.writeFileSync(prefix+'.command.json',JSON.stringify(receipt,null,2)+'\n');
let output;
try{output=JSON.parse(result.stdout);fs.writeFileSync(prefix+'.result.json',JSON.stringify(output,null,2)+'\n');}catch{}
console.log(JSON.stringify({commandReceipt:prefix+'.command.json',exitCode:result.status,status:output?.status,summary:output?.summary,gate:output?.gate,artifacts:output?.artifacts,counts:output?{updated:output.updated,documents:output.documents,changed_or_new:output.changed_or_new}:null,error:result.error?.message??null},null,2));
process.exitCode=result.status??1;
