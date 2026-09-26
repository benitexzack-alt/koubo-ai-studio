import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderStill, renderMedia} from '@remotion/renderer';

const root=path.dirname(fileURLToPath(import.meta.url));
const mode=process.argv[2] ?? 'stills';
const started=Date.now();
const run=promisify(execFile);
const rawPath=path.join(root,'exports','工业革命_电气到数字_28秒试片_R1_音轨校正前.mp4');
const finalPath=path.join(root,'exports','工业革命_电气到数字_28秒试片_R1.mp4');
const correctAudio=async()=>{
  // 单独封装已按采样截取的WAV，避免本次检测到的Remotion音轨固定延迟。
  await run('/opt/homebrew/bin/ffmpeg',['-y','-hide_banner','-loglevel','error','-i',rawPath,'-i',path.join(root,'public','music-pilot.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','320k','-ar','48000','-t','28','-movflags','+faststart',finalPath]);
};
if(mode==='mux') {
  await correctAudio();
  console.log('音轨重新封装完成；必须继续运行音频检查脚本。');
  process.exit(0);
}
await fs.mkdir(path.join(root,'verify'),{recursive:true});
await fs.mkdir(path.join(root,'exports'),{recursive:true});
const serveUrl=await bundle({entryPoint:path.join(root,'src/index.tsx'),rootDir:root,publicDir:path.join(root,'public'),outDir:path.join(root,'.bundle'),enableCaching:true});
const browser=await openBrowser('chrome',{browserExecutable:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const common={serveUrl,puppeteerInstance:browser,logLevel:'warn'};
try {
  const composition=await selectComposition({...common,id:'IndustrialHistoryPilot'});
  if(mode==='stills') {
    const frames=(process.env.PILOT_FRAMES ?? '60,170,245,382,460,575,648,649,705,790').split(',').map(Number);
    for(const frame of frames) {
      await renderStill({...common,composition,frame,output:path.join(root,'verify',`frame-${String(frame).padStart(4,'0')}.png`),scale:0.67});
      console.log(`画面帧 ${frame} 已生成`);
    }
  } else if(mode==='video') {
    let last=-1;
    await renderMedia({...common,composition,codec:'h264',audioCodec:'aac',audioBitrate:'320k',crf:18,pixelFormat:'yuv420p',colorSpace:'bt709',concurrency:3,overwrite:true,outputLocation:rawPath,onProgress:({progress})=>{const p=Math.floor(progress*20);if(p!==last){last=p;console.log(`渲染进度 ${p*5}%`);}}});
    await correctAudio();
  } else {throw new Error(`未知模式：${mode}`);}
  const elapsedSeconds=(Date.now()-started)/1000;
  await fs.writeFile(path.join(root,'verify',`${mode}-render-receipt.json`),JSON.stringify({mode,elapsedSeconds,finishedAt:new Date().toISOString(),composition:{id:composition.id,width:composition.width,height:composition.height,fps:composition.fps,durationInFrames:composition.durationInFrames},formalRelease:false},null,2)+'\n');
  console.log(`本次 ${mode} 用时 ${elapsedSeconds.toFixed(1)} 秒`);
} finally {await browser.close({silent:true});}
