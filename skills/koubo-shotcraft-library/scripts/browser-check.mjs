import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const repo=path.resolve(import.meta.dirname,'../../..');
const require=createRequire(path.join(repo,'remotion/package.json'));
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.resolve(import.meta.dirname,'../assets/ShotcraftEffects.tsx'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
vm.runInNewContext(code,{exports:module.exports,module,require:n=>{assert.equal(n,'react');return React;}});
const output=path.join(repo,'edit/shotcraft-integration-20260904/component-qa');
fs.mkdirSync(output,{recursive:true});
const samples={
  MarkerUnderline:{before:'先保留',keyword:'真实证据',after:'再强调',fontSize:58},
  KeywordReveal:{items:[{text:'原始材料',atFrame:0},{text:'完整来源',atFrame:20},{text:'真实验证',atFrame:40}],fontSize:52},
  EvidenceScan:{width:1040,height:545,rect:{x:8,y:8,width:1024,height:420},label:'关键区域'},
  LineCarry:{fromLabel:'原始材料',toLabel:'核对结论',width:620},
  PaperTapePin:{width:620,children:React.createElement('div',{style:{width:'100%',height:'100%',background:'#354b50',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:42}},'测试占位，不是素材')},
};
const browser=await chromium.launch({headless:true});
const results=[];
try {
  const page=await browser.newPage();
  for(const width of [1920,960,390]) {
    await page.setViewportSize({width,height:Math.ceil(width*9/16)});
    for(const [name,props] of Object.entries(samples)) for(const frame of [0,24,90,149]) {
      const html=renderToStaticMarkup(React.createElement(module.exports[name],{...props,frame,fps:30,durationInFrames:150}));
      const slotWidth=name==='EvidenceScan'?1040:650;
      await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#171b1c}#canvas{width:1920px;height:1080px;transform:scale(${width/1920});transform-origin:0 0;position:relative;overflow:hidden}#effect{position:absolute;left:80px;top:170px;width:${slotWidth}px;height:620px}</style><div id="canvas"><div id="effect">${html}</div></div>`);
      await page.evaluate(()=>document.fonts.ready);
      const layout=await page.evaluate(()=>{
        const slot=document.querySelector('#effect').getBoundingClientRect();
        const problems=[];
        for(const el of document.querySelectorAll('#effect *')) {
          if(![...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim()) || getComputedStyle(el).opacity==='0')continue;
          const r=el.getBoundingClientRect();
          if(r.left<slot.left-2||r.right>slot.right+2||r.top<slot.top-2||r.bottom>slot.bottom+2)problems.push({text:el.textContent,left:r.left,right:r.right});
        }
        return {problems, horizontalOverflow:document.documentElement.scrollWidth>innerWidth};
      });
      assert.equal(layout.horizontalOverflow,false,`${name} ${width}: 水平溢出`);
      assert.deepEqual(layout.problems,[],`${name} ${width} ${frame}: 文字出界`);
      results.push({name,width,frame,passed:true});
      if(width===960 && frame===149) await page.screenshot({path:path.join(output,`${name}.png`)});
    }
  }
  fs.writeFileSync(path.join(output,'browser-layout.v1.json'),`${JSON.stringify({status:'passed',cases:results.length,scope:'synthetic-component-layout-only',realSpokenPreviewRendered:false,results},null,2)}\n`);
  console.log(JSON.stringify({cases:results.length,passed:true,output,realSpokenPreviewRendered:false}));
} finally {await browser.close();}
