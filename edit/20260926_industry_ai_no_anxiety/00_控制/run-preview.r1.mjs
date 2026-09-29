// 仅本期用户批准的41秒隔离样片入口；不解锁生产V2或正式发布。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..'),base='edit/20260926_industry_ai_no_anxiety',dir=path.join(root,base,'07_预览与质检/视听小样R1');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n)));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const mode=process.argv[2];assert(['preflight','stills','render'].includes(mode),'仅允许预检、风险帧和样片');
const job=read('preview-job.json'),auth=read('authorization.json');
assert.equal(job.taskId,'industry-ai-no-anxiety-preview-20260929');assert.equal(job.durationInFrames,1230);assert.equal(job.formalEnabled,false);assert.equal(job.publishAuthorized,false);
assert.equal(auth.userQuote,'好的，生成样片。');assert.equal(auth.formalEnabled,false);assert.equal(auth.publishAuthorized,false);
for(const b of job.bindings){const p=path.resolve(root,b.path);assert(p.startsWith(root+path.sep));assert(!fs.lstatSync(p).isSymbolicLink());assert.equal(sha(p),b.sha256,`输入已变:${b.path}`);}
const run=(exe,args)=>{const r=spawnSync(exe,args,{cwd:root,encoding:'utf8',maxBuffer:10e6});if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout;};
const context=JSON.parse(run('python3',['/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py','validate-context','--context',job.knowledgeContext.contextPath]));
assert.equal(context.status,'context-valid');assert.equal(context.gate.formal_execution_allowed,true);
run('node',['skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs',`${base}/04_Remotion准备/动效选择.r1.json`,'.']);
if(mode==='preflight'){console.log('本期41秒预览输入与上下文复检通过；无正式导出或发布权限');process.exit(0);}
if(mode==='render'){const review=read('risk-frame-review.json');assert.equal(review.status,'risk-frames-reviewed');assert.equal(review.jobSha256,sha(path.join(dir,'preview-job.json')));}
const require=createRequire(path.join(root,'remotion/package.json'));
const {bundle}=require('@remotion/bundler'),{selectComposition,renderStill,renderMedia}=require('@remotion/renderer');
const browser=path.join(root,'remotion/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell');assert(fs.existsSync(browser));
const portConfig=require(path.join(path.dirname(require.resolve('@remotion/renderer')),'port-config.js'));
Object.defineProperty(portConfig,'getPortConfig',{value:()=>({host:'127.0.0.1',hostsToTry:['127.0.0.1']}),configurable:false});
const url=await bundle({entryPoint:path.join(root,'remotion/src/industry-ai-no-anxiety-preview-r1/index.tsx'),publicDir:path.join(root,'remotion/public/media/industry-ai-no-anxiety-preview-r1'),webpackOverride:c=>({...c,resolve:{...c.resolve,modules:[path.join(root,'remotion/node_modules'),'node_modules']}})});
const composition=await selectComposition({serveUrl:url,id:'IndustryAiNoAnxietyPreviewR1',browserExecutable:browser});assert.equal(composition.durationInFrames,1230);
const common={serveUrl:url,composition,browserExecutable:browser,scale:1,logLevel:'error'};
if(mode==='stills'){
 for(const frame of [45,123,155,200,450,490,575,650,725,870,925,1015,1140,1220]){const output=path.join(dir,`risk-${frame}.png`);assert(!fs.existsSync(output));await renderStill({...common,frame,output,imageFormat:'png'});console.log(`风险帧 ${frame}`);}
}else{
 const outputLocation=path.join(dir,'picture-only.mp4');assert(!fs.existsSync(outputLocation),'不覆盖已有样片');
 let last=-1;await renderMedia({...common,codec:'h264',crf:18,muted:true,audioCodec:null,concurrency:3,outputLocation,onProgress:({renderedFrames})=>{const n=Math.floor(renderedFrames/150);if(n>last){last=n;console.log(`画面 ${renderedFrames}/1230`);}}});console.log('画面渲染完成，待混音和媒体检查');
}
