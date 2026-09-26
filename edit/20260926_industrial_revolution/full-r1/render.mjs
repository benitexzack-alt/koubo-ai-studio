import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderStill, renderMedia} from '@remotion/renderer';

const root=path.dirname(fileURLToPath(import.meta.url));
const mode=process.argv[2]??'stills';
const started=Date.now(),run=promisify(execFile);
const rawPath=path.join(root,'exports','工业革命_从蒸汽到智能_无声画面_R2.mp4');
const finalPath=path.join(root,'exports','工业革命_从蒸汽到智能_三分钟_R2.mp4');
const mux=()=>run('/opt/homebrew/bin/ffmpeg',['-y','-hide_banner','-loglevel','error','-i',rawPath,'-i',path.join(root,'public','music-full.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac_at','-aac_at_quality','2','-b:a','320k','-ar','48000','-t','180.4','-movflags','+faststart',finalPath]);
await fs.mkdir(path.join(root,'verify'),{recursive:true});
await fs.mkdir(path.join(root,'exports'),{recursive:true});
if(mode==='mux'){await mux();console.log('全片音乐封装完成，尚需音画技术检查。');process.exit(0);}
const serveUrl=await bundle({entryPoint:path.join(root,'src/index.tsx'),rootDir:root,publicDir:path.join(root,'public'),outDir:path.join(root,'.bundle'),enableCaching:true});
// 使用已存在的专用无头浏览器；不触发安装。系统Chrome并发抓帧曾实测出现孤立空帧。
const browserExecutable='/Users/pc/Documents/口播/remotion/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell';
await fs.access(browserExecutable);
const browser=await openBrowser('chrome',{browserExecutable});
const common={serveUrl,puppeteerInstance:browser,logLevel:'warn'};
try{
  const composition=await selectComposition({...common,id:'IndustrialHistoryFull'});
  if(mode==='stills'){
    const frames=(process.env.FULL_FRAMES??'120,400,670,1040,1340,1720,2080,2240,2450,2620,2750,3030,3230,3530,3970,4280,4470,4650,4803,5000,5300').split(',').map(Number);
    for(const frame of frames){await renderStill({...common,composition,frame,output:path.join(root,'verify',`frame-${String(frame).padStart(4,'0')}.png`),scale:.67});console.log(`画面帧 ${frame} 已生成`);}
  }else if(mode==='video' || mode==='probe'){
    let last=-1;
    await renderMedia({...common,composition,codec:'h264',muted:true,crf:18,imageFormat:'png',pixelFormat:'yuv420p',colorSpace:'bt709',concurrency:3,overwrite:false,frameRange:mode==='probe'?[4139,4530]:undefined,outputLocation:mode==='probe'?path.join(root,'verify','问题段重渲染_R2.mp4'):rawPath,onProgress:({progress})=>{const n=Math.floor(progress*20);if(n!==last){last=n;console.log(`全片渲染 ${n*5}%`);}}});
    if(mode==='video') await mux();
  }else throw new Error(`未知模式：${mode}`);
  const elapsedSeconds=(Date.now()-started)/1000;
  await fs.writeFile(path.join(root,'verify',`${mode}-R2-render-receipt.json`),JSON.stringify({mode,elapsedSeconds,finishedAt:new Date().toISOString(),browserExecutable,imageFormat:'png',composition:{id:composition.id,width:composition.width,height:composition.height,fps:composition.fps,durationInFrames:composition.durationInFrames},formalRelease:false,humanReview:'pending'},null,2)+'\n');
  console.log(`本次 ${mode} 用时 ${elapsedSeconds.toFixed(1)} 秒`);
}finally{await browser.close({silent:true});}
