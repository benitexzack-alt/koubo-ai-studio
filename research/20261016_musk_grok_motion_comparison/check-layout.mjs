// 只验证本次隔离样片的真实浏览器布局与时钟，不宣称用户观感通过。
import {chromium} from '../../remotion/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({executablePath:'/Users/pc/Documents/口播/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell',headless:true,args:['--allow-file-access-from-files','--force-color-profile=srgb']});
const report={scope:'三种源码改编样片的全部807帧文字边界',humanAccepted:false,styles:[],errors:[]};
try {
 for(const style of ['continuous','stage','editorial']){
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
  page.on('pageerror',e=>report.errors.push({style,error:e.message}));
  await page.goto(pathToFileURL(path.join(root,'web/sample.html')).href+'?style='+style);
  await page.evaluate(()=>window.READY);
  const results=await page.evaluate(()=>{
   const failures=[],collisions=[],first={},states=[];let count=0,maxRight=0,maxBottom=0,minFont=Infinity;
   for(let frame=0;frame<SAMPLE_DATA.durationFrames;frame++){
    scene.update(frame/SAMPLE_DATA.fps);
    const audit=window.sampleAudit().motion;
    if([0,15,105,231,348,501,543,583,713,806].includes(frame))states.push({frame,...audit});
    const readable=audit.texts.filter(text=>text.opacity>.5);
    for(let a=0;a<readable.length;a++)for(let b=a+1;b<readable.length;b++){
     const x=readable[a],y=readable[b];
     const overlapWidth=Math.min(x.right,y.right)-Math.max(x.left,y.left),overlapHeight=Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top);
     if(overlapWidth>2&&overlapHeight>2)collisions.push({frame,texts:[x.text,y.text],overlapWidth,overlapHeight});
    }
    for(const text of audit.texts){
     count++;maxRight=Math.max(maxRight,text.right);maxBottom=Math.max(maxBottom,text.bottom);minFont=Math.min(minFont,text.fontSize);
     first[text.text]??=frame;
     if(text.left<63||text.top<95||text.right>725||text.bottom>511||text.fontSize<44)failures.push({frame,...text});
    }
   }
   return {frames:SAMPLE_DATA.durationFrames,count,maxRight,maxBottom,minFont,first,failures,collisions,states,fontLoaded:document.fonts.check('60px Motion')};
  });
  report.styles.push({style,...results});
  await page.close();
 }
}finally{await browser.close();}
report.passed=report.errors.length===0&&report.styles.every(s=>s.failures.length===0&&s.collisions.length===0&&s.fontLoaded);
fs.writeFileSync(path.join(root,'qa/layout.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,styles:report.styles.map(({style,frames,maxRight,maxBottom,minFont,first,failures})=>({style,frames,maxRight,maxBottom,minFont,first,failures:failures.slice(0,3)})),errors:report.errors}));
if(!report.passed)process.exitCode=1;
