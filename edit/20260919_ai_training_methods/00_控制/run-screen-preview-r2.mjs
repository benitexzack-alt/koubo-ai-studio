// 本期用户单独批准的隔离样片入口；不调用、解锁或伪造正式生产 V2。
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../..');
const dir=path.join(root,'edit/20260919_ai_training_methods/07_预览与质检/录屏小样R2');
const require=createRequire(path.join(root,'remotion/package.json'));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(exe,args)=>{const p=spawnSync(exe,args,{cwd:root,encoding:'utf8',maxBuffer:15e6});if(p.status!==0)throw Error(p.stderr||p.stdout);return p;};
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n)));
const mode=process.argv[2];if(!['preflight','stills','render'].includes(mode))throw Error('仅允许预检、风险帧、隔离样片');
const job=read('preview-job.json');
if(job.formalEnabled!==false||job.publishAuthorized!==false||job.durationInFrames!==1269)throw Error('范围不符');
for(const item of job.bindings){const p=path.resolve(root,item.path);if(!p.startsWith(root+path.sep)||fs.lstatSync(p).isSymbolicLink()||sha(p)!==item.sha256)throw Error(`输入变更:${item.path}`);}
const auth=read('authorization.json');if(auth.userQuote!=='现在按照这个重新再出一个小样'||auth.formalEnabled!==false)throw Error('授权不符');
const context=run('python3',['/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py','validate-context','--context',job.contextPath]);
const validation=JSON.parse(context.stdout);if(validation.status!=='context-valid'||validation.gate?.formal_execution_allowed!==true)throw Error('上下文复检未通过');
run('node',['skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs',path.relative(root,path.join(dir,'selection-r3.json')),'.']);
const review=read('independent-review.json');
if(review.status!=='approved-for-local-preview'||review.jobSha256!==sha(path.join(dir,'preview-job.json')))throw Error('缺少本期独立审查');
if(mode==='preflight'){console.log('本期隔离预检通过；不授予正式生产或发布权限');process.exit(0);}
if(mode==='render'){
 const visual=read('risk-frame-review.json');
 if(visual.jobSha256!==sha(path.join(dir,'preview-job.json'))||visual.status!=='risk-frames-reviewed')throw Error('风险帧未检查');
}
const {bundle}=require('@remotion/bundler');const {selectComposition,renderStill,renderMedia}=require('@remotion/renderer');
const browser=path.join(root,'remotion/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell');
if(!fs.existsSync(browser))throw Error('本地浏览器缺失，禁止自动下载');
// 强制仅回环地址，避免向局域网开放本期个人素材。
const portConfig=require(path.join(path.dirname(require.resolve('@remotion/renderer')),'port-config.js'));
Object.defineProperty(portConfig,'getPortConfig',{value:()=>({host:'127.0.0.1',hostsToTry:['127.0.0.1']}),configurable:false});
const url=await bundle({entryPoint:path.join(root,'remotion/src/ai-training-screen-r2/index.tsx'),publicDir:path.join(root,'remotion/public/media/ai-training-screen-r2'),webpackOverride:c=>({...c,resolve:{...c.resolve,modules:[path.join(root,'remotion/node_modules'),'node_modules']}})});
const composition=await selectComposition({serveUrl:url,id:'AITrainingScreenPreview',browserExecutable:browser});
const common={serveUrl:url,composition,browserExecutable:browser,scale:1,logLevel:'error'};
if(mode==='stills'){
 for(const frame of [30,190,300,465,550,640,730,875,1000,1085,1190,1245]){
  const output=path.join(dir,`risk-${frame}.png`);if(fs.existsSync(output))throw Error(`不覆盖:${output}`);
  await renderStill({...common,frame,output,imageFormat:'png'});console.log(`风险帧 ${frame}`);
 }
}else{
 const outputLocation=path.join(dir,'picture-only.mp4');if(fs.existsSync(outputLocation))throw Error('不覆盖旧样片');
 await renderMedia({...common,codec:'h264',crf:18,audioCodec:null,muted:true,concurrency:3,outputLocation,onProgress:({renderedFrames})=>{if(renderedFrames%150===0)console.log(`画面 ${renderedFrames}/1269`);}});
 console.log('画面已渲染，尚待双版本配音轨与检查');
}
