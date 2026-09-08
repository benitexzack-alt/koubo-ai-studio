import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const root='/Users/pc/Documents/口播';
const control='edit/20260906_lanzhou_ai_services/00_工程控制/formal-r2-v1';
assert.equal(process.argv.length,3);
assert(process.argv[2].startsWith(`${root}/${control}/runtime/run-`) && process.argv[2].endsWith('/job.json'));
const job=JSON.parse(fs.readFileSync(process.argv[2]));
assert.equal(job.stage,path.join(path.dirname(process.argv[2]),'project'));
assert.equal(job.output,`${root}/edit/20260906_lanzhou_ai_services/07_预览与质检/formal-r2-v1/video-only.mp4`);
assert(!fs.existsSync(job.output));
const require=createRequire(`${root}/remotion/package.json`);
const launcher=require(`${root}/remotion/node_modules/@remotion/renderer/dist/browser/BrowserRunner.js`);
const launch=launcher.makeBrowserRunner;
launcher.makeBrowserRunner=a=>launch({...a,processArguments:a.processArguments.map(v=>v==='--remote-debugging-port=0'?'--remote-debugging-port=54092':v)});
const ports=require(`${root}/remotion/node_modules/@remotion/renderer/dist/port-config.js`);
Object.defineProperty(ports,'getPortConfig',{value:()=>({host:'127.0.0.1',hostsToTry:['127.0.0.1']}),writable:false});
const {bundle}=require('@remotion/bundler');
const {renderMedia,renderStill,selectComposition,openBrowser}=require('@remotion/renderer');
const browserExecutable=`${root}/remotion/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const binariesDirectory=`${root}/remotion/node_modules/@remotion/compositor-darwin-arm64`;
const serveUrl=await bundle({entryPoint:path.join(job.stage,'remotion/src/lanzhou-services-v91-candidate-r2/index.tsx'),
  rootDir:path.join(job.stage,'remotion'),publicDir:path.join(job.stage,'remotion/public/lanzhou-services-candidate-r2'),
  outDir:path.join(path.dirname(process.argv[2]),'bundle'),enableCaching:false,symlinkPublicDir:false,gitSource:null,
  webpackOverride:c=>({...c,cache:false,resolve:{...c.resolve,modules:[`${root}/remotion/node_modules`]},resolveLoader:{...c.resolveLoader,modules:[`${root}/remotion/node_modules`]}})});
const browser=await openBrowser('chrome',{browserExecutable,logLevel:'warn'});
try {
  const common={serveUrl,browserExecutable,binariesDirectory,puppeteerInstance:browser,port:54091,envVariables:{},
    onBrowserDownload:()=>{throw new Error('禁止自动下载');},logLevel:'warn'};
  const composition=await selectComposition({...common,id:'LanzhouServicesV91CandidateR2'});
  assert.equal(composition.width,1920);assert.equal(composition.height,1080);assert.equal(composition.fps,30);assert.equal(composition.durationInFrames,8393);
  // Reuse the accepted R2 component byte-for-byte; only the staged host video is full resolution.
  for(const frame of [52,600,2582]) await renderStill({...common,composition,frame,scale:1,imageFormat:'png',overwrite:false,
    output:path.join(path.dirname(job.output),`source-delta-${frame}.png`)});
  let state={progress:0,renderedFrames:0,encodedFrames:0};
  const report=()=>console.log(`正式高清输出 ${Math.floor(state.progress*100)}%：${state.renderedFrames}/8393帧，已编码${state.encodedFrames}帧`);
  const timer=setInterval(report,30000);
  try {await renderMedia({...common,composition,outputLocation:job.output,codec:'h264',pixelFormat:'yuv420p',
    colorSpace:'bt709',imageFormat:'png',muted:true,scale:1,frameRange:[0,8392],concurrency:2,crf:16,overwrite:false,
    onProgress:p=>{state=p;}});} finally {clearInterval(timer);}
} finally {await browser.close({silent:true});}
