import {chromium} from '../../remotion/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({executablePath:'/Users/pc/Documents/口播/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true});
const report={scope:'真实MP4在本地对照页的播放与版本切换',humanAccepted:false,items:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:5195/');
 await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
 for(let i=0;i<4;i++){
  if(i)await page.locator(`button[data-index="${i}"]`).click();
  await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
  await page.evaluate(async()=>{const v=document.querySelector('video');v.muted=true;v.currentTime=0;await v.play()});
  await page.waitForFunction(()=>document.querySelector('video').ended,{},{timeout:25000});
  report.items.push(await page.evaluate(()=>{const v=document.querySelector('video');return {name:document.querySelector('#name').textContent,src:v.currentSrc,duration:v.duration,width:v.videoWidth,height:v.videoHeight,ended:v.ended,error:v.error?.message||null}}));
 }
 await page.evaluate(()=>{const v=document.querySelector('video');v.currentTime=7.2;v.pause()});
 await page.locator('button[data-index="1"]').click();
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2&&Math.abs(document.querySelector('video').currentTime-7.2)<.08);
 await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.seeking&&v.readyState>=3});
 report.switchPreservesTime=await page.locator('video').evaluate(v=>v.currentTime);
 await page.screenshot({path:path.join(root,'qa/对照页_桌面.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 report.mobile=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 await page.screenshot({path:path.join(root,'qa/对照页_手机.png'),fullPage:true});
 report.passed=!report.errors.length&&report.items.length===4&&report.items.every(x=>x.ended&&!x.error&&x.width===1920&&x.height===1080)&&report.mobile.scrollWidth<=report.mobile.viewport;
}finally{await browser.close();}
fs.writeFileSync(path.join(root,'qa/gallery.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
