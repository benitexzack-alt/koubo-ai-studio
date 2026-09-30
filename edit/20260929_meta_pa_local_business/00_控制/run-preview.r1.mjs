// 本期完整1080P待审候选；保留输入/知识/风险帧门，不冒充V2正式release或允许发布。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {validateKnowledgeContextForProductionV2} from '../../../tools/knowledge-context-production-gate.mjs';
const root=path.resolve(import.meta.dirname,'../../..'),base='edit/20260929_meta_pa_local_business',dir=path.join(root,base,'10_剪辑准备/完整视听小样R1');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const mode=process.argv[2];assert(['preflight','stills','render','mux'].includes(mode),'只允许本期小样动作');
const jobPath=path.join(dir,'preview-job.json'),job=read('preview-job.json'),auth=read('isolated-preview-authorization.json');
assert.equal(job.formalEnabled,false);assert.equal(job.productionEligible,false);assert.equal(job.publishAuthorized,false);assert.equal(job.userPreviewApproved,false);
assert.equal(auth.decision,'approved-isolated-preview');assert.equal(auth.formalEnabled,false);assert.equal(auth.publishAuthorized,false);assert.equal(auth.jobSha256,sha(jobPath));assert.equal(auth.isolationExplicitlyApproved,true);assert(auth.userQuote&&auth.authorizationBasis,'必须绑定本期真实用户指令及授权范围');
for(const b of job.bindings){const p=path.resolve(root,b.path);assert(p.startsWith(root+path.sep));assert(!fs.lstatSync(p).isSymbolicLink());assert.equal(sha(p),b.sha256,`输入变化:${b.path}`);}
const proof=validateKnowledgeContextForProductionV2({projectRoot:root,jobPath,job,command:'direct-remotion-preview'});
const run=(exe,args)=>{const r=spawnSync(exe,args,{cwd:root,encoding:'utf8',maxBuffer:20e6});if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout;};
run('node',['skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs',job.shotcraftSelection,'.']);
fs.writeFileSync(path.join(dir,`context-preflight-${mode}.json`),JSON.stringify({knowledgeContext:proof,jobSha256:sha(jobPath),isolatedPreview:true,formalEligible:false,v2FormalPreflightPassed:false},null,2)+'\n');
if(mode==='preflight'){console.log('本期隔离小样知识上下文与输入绑定复检通过；不是V2正式生产结果');process.exit(0);}
if(mode==='render'||mode==='mux'){const review=read('risk-frame-review.json');assert.equal(review.status,'risk-frames-reviewed');assert.equal(review.jobSha256,sha(jobPath));}
if(mode==='mux'){
 const picture=path.join(dir,'picture-only-1080p.r1.mp4'),out=path.join(root,job.outputs.fullPreview);assert(fs.existsSync(picture));assert(!fs.existsSync(out));fs.mkdirSync(path.dirname(out),{recursive:true});
 run('ffmpeg',['-hide_banner','-nostats','-n','-i',picture,'-i',path.join(root,job.sound.mix),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-af','apad','-t',String(job.durationInFrames/30),'-movflags','+faststart',out]);
 console.log('完整1080P视听候选已合成；待全片技术检查与用户完整观看');process.exit(0);
}
const require=createRequire(path.join(root,'remotion/package.json')),{bundle}=require('@remotion/bundler'),{selectComposition,renderStill,renderMedia}=require('@remotion/renderer');
const browser=path.join(root,'remotion/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell');assert(fs.existsSync(browser));
const portConfig=require(path.join(path.dirname(require.resolve('@remotion/renderer')),'port-config.js'));Object.defineProperty(portConfig,'getPortConfig',{value:()=>({host:'127.0.0.1',hostsToTry:['127.0.0.1']}),configurable:false});
const serveUrl=await bundle({entryPoint:path.join(root,job.remotion.root,job.remotion.entry),publicDir:path.join(root,job.remotion.publicDir),webpackOverride:c=>({...c,resolve:{...c.resolve,modules:[path.join(root,'remotion/node_modules'),'node_modules']}})});
const composition=await selectComposition({serveUrl,id:job.remotion.compositionId,browserExecutable:browser});assert.equal(composition.durationInFrames,12286);
const common={serveUrl,composition,browserExecutable:browser,logLevel:'error'};
if(mode==='stills'){
 for(const t of [5,11,16,19,33,36,41,56.6,60,63,73,95,108,116,127,154,175,198,202,217,225,227,234,260,263,272,280,294,312,330,353,376,385,407]){const frame=Math.round(t*30),output=path.join(dir,`risk-r2-${frame}.png`);assert(!fs.existsSync(output));await renderStill({...common,scale:1,frame,output,imageFormat:'png'});console.log(`风险帧 ${t} 秒`);}
 fs.writeFileSync(path.join(dir,'risk-render-receipt.r2.json'),JSON.stringify({jobSha256:sha(jobPath),status:'risk-frames-rendered',width:1920,height:1080,humanFullWatchConfirmed:false},null,2)+'\n');
}else{
 const outputLocation=path.join(dir,'picture-only-1080p.r1.mp4');assert(!fs.existsSync(outputLocation));assert.equal(job.renderScale,1);let last=-1;
 await renderMedia({...common,scale:1,codec:'h264',crf:18,muted:true,audioCodec:null,concurrency:4,outputLocation,onProgress:({renderedFrames})=>{const n=Math.floor(renderedFrames/300);if(n>last){last=n;console.log(`完整1080P画面 ${renderedFrames}/12286`);}}});console.log('完整1080P画面已导出，待原声与音效合成');
}
