import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../../../..');
const base='edit/20260906_lanzhou_ai_services';
const output=`${base}/07_预览与质检/candidate-preview-r1`;
const publicDir='remotion/public/lanzhou-services-candidate-r1';
const rate=16000;
function decode(relative){
  const p=spawnSync('/opt/homebrew/bin/ffmpeg',['-v','error','-i',path.join(root,relative),'-vn','-ac','1','-ar',String(rate),'-f','f32le','pipe:1'],{maxBuffer:64*1024*1024});
  if(p.status!==0)throw new Error(p.stderr.toString());
  return new Float32Array(Uint8Array.from(p.stdout).buffer);
}
const video=`${output}/render/with-sfx-960x540.mp4`;
const y=decode(video),h=decode(`${publicDir}/R01.mp4`);
const data=JSON.parse(fs.readFileSync(path.join(root,base,'04_导演拆解/candidate-preview-r1/data.v1.json')));
const results=[];
for(const p of data.papers){
  const material=decode(`${publicDir}/${p.publicPath}`);
  const start=Math.round(p.outputStartFrame/30*rate);
  const hostStart=Math.round((p.outputStartFrame-244)/30*rate);
  const n=Math.min(Math.floor(p.durationInFrames/30*rate),material.length)-3200;
  let coarse={lag:0,score:-Infinity};
  for(let lag=-8000;lag<=8000;lag+=16){
    let dot=0,hh=0,yy=0;
    for(let i=3200;i<n;i+=8){const hv=h[hostStart+i],yv=y[start+i+lag];dot+=hv*yv;hh+=hv*hv;yy+=yv*yv;}
    const score=dot/Math.sqrt(hh*yy);
    if(score>coarse.score)coarse={lag,score};
  }
  let best;
  for(let lag=coarse.lag-16;lag<=coarse.lag+16;lag++){
    let hh=0,mm=0,hm=0,hy=0,my=0,yy=0;
    for(let i=3200;i<n;i++){
      const hv=h[hostStart+i],mv=material[i]*.1,yv=y[start+i+lag];
      hh+=hv*hv;mm+=mv*mv;hm+=hv*mv;hy+=hv*yv;my+=mv*yv;yy+=yv*yv;
    }
    const det=hh*mm-hm*hm;
    if(det<=0)continue;
    const a=(hy*mm-my*hm)/det,b=(my*hh-hy*hm)/det;
    const residual=Math.max(0,yy-a*hy-b*my);
    const item={id:p.id,lagSamples:lag,hostCoefficient:a,materialCoefficientRelativeToDeclaredGain:b,
      estimatedMaterialGain:b*.1,modelFitR2:1-residual/yy,
      materialToHostDb:10*Math.log10(mm/hh),sourceSha256:p.sha256};
    if(!best||item.modelFitR2>best.modelFitR2)best=item;
  }
  results.push({...best,lagMilliseconds:best.lagSamples/rate*1000,statisticallyConsistentWithMaterialInMix:best?.modelFitR2>.9&&best?.materialCoefficientRelativeToDeclaredGain>.3&&best?.materialCoefficientRelativeToDeclaredGain<2});
}
const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,video))).digest('hex');
const result={schemaVersion:'lanzhou-candidate-paper-audio-regression/v1',video:{path:video,sha256:hash},
  method:'在每个纸艺窗口中排除首尾0.2秒，用解码到16kHz单声道的权威口播和0.1倍源片音频，对最终AAC混音作双源最小二乘拟合；先在正负0.5秒搜索真实解码偏移，再细化至单采样。该数值检测不是人耳试听或字幕验收。',
  results,humanListeningPerformed:false,formalEnabled:false};
fs.writeFileSync(path.join(root,output,'qa/paper-audio-regression.v2.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result,null,2));
