import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),base='edit/20260929_meta_pa_local_business';
const pub='remotion/public/media/meta-pa-local-business-r1',out=`${base}/10_剪辑准备/公开视窗`;
const require=createRequire(path.resolve('remotion/package.json')),sharp=require('sharp');
const ff=args=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-n',...args],{encoding:'utf8',maxBuffer:10e6});if(r.status!==0)throw Error(r.stderr);};
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const d of [pub,`${pub}/media`,`${pub}/audio`,`${pub}/fonts`,out])fs.mkdirSync(d,{recursive:true});
const source=`${base}/01_素材投放区/01_口播原片/copy_1C64A779-C1E2-417C-A440-6474D8A3C04B.MOV`;
if(!fs.existsSync(`${pub}/media/host.mp4`))ff(['-i',source,'-map','0:v:0','-an','-vf','fps=30,setsar=1','-c:v','h264_videotoolbox','-b:v','20M','-pix_fmt','yuv420p','-movflags','+faststart',`${pub}/media/host.mp4`]);
console.log('已准备只读原片的播放代理');
if(!fs.existsSync(`${pub}/audio/original.wav`))ff(['-i',source,'-map','0:a:0','-vn','-ar','48000','-ac','2','-c:a','pcm_s24le',`${pub}/audio/original.wav`]);
const copy=(a,b)=>{if(!fs.existsSync(b))fs.copyFileSync(a,b,fs.constants.COPYFILE_EXCL);};
copy('remotion/public/fonts/STHeiti-Medium.ttc',`${pub}/fonts/STHeiti-Medium.ttc`);
for(const id of ['P01','P02','P03','P04','P05','P06','P07','G01'])copy(`${base}/01_素材投放区/${id==='G01'?'03_AI情景视频':'04_纸艺视频'}/20260929_${id}_待确认生成.mp4`,`${pub}/media/${id}.mp4`);
const evidence=`${base}/01_素材投放区/05_公开素材_Codex准备`;
for(const [a,b]of [['V01_Muse官方介绍.mp4','muse-intro.mp4'],['V02_Muse官方购物演示.mp4','muse-shopping.mp4'],['I01_千问淘宝官方图.png','qwen-taobao.png'],['I03_豆包二代能力官方图.png','doubao.png'],['S03_千问生态正文视窗.png','qwen-ecosystem.png']])copy(`${evidence}/${a}`,`${pub}/media/${b}`);
// 前一版宽摘录保留作历史诊断，不进小样。实际画面只消费标题与署名日期小裁片。
const crops=[['S07_九月二十一日股价报道原页.png','stock-excerpt.png',{left:74,top:249,width:305,height:530}],['S06_收费计划报道原页.png','fee-excerpt.png',{left:78,top:242,width:292,height:480}]];
const usedCrops=[
 ['S07_九月二十一日股价报道原页.png','stock-header.png',{left:80,top:253,width:300,height:60}],
 ['S07_九月二十一日股价报道原页.png','stock-byline.png',{left:80,top:509,width:265,height:30}],
 ['S06_收费计划报道原页.png','fee-header.png',{left:80,top:253,width:300,height:60}],
 ['S06_收费计划报道原页.png','fee-byline.png',{left:80,top:509,width:275,height:30}],
];
for(const [name,dest,rect]of usedCrops){const p=`${pub}/media/${dest}`;if(!fs.existsSync(p))await sharp(`${evidence}/${name}`).extract(rect).resize({width:1200}).png().toFile(p);}
const receipts=[];
for(const [name,dest,rect]of crops){const p=`${pub}/media/${dest}`;if(!fs.existsSync(p))await sharp(`${evidence}/${name}`).extract(rect).resize({width:915}).png().toFile(p);copy(p,`${out}/${dest}`);receipts.push({source:`${evidence}/${name}`,sourceSha256:hash(`${evidence}/${name}`),crop:rect,output:p,sha256:hash(p),purpose:'报道短节选，不展示当前行情，不重印全文'});}
const pdf=`${evidence}/S02_Meta二季报官方.pdf`,prefix=`${out}/meta-financial-page1`;
if(!fs.existsSync(`${prefix}.png`)){const r=spawnSync('pdftoppm',['-f','1','-singlefile','-scale-to','2000','-png',pdf,prefix],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
copy(`${prefix}.png`,`${pub}/media/meta-financial-page1.png`);
const meta=await sharp(`${prefix}.png`).metadata();
const rect={left:Math.round(meta.width*.08),top:Math.round(meta.height*.60),width:Math.round(meta.width*.84),height:Math.round(meta.height*.23)};
const dap=`${pub}/media/meta-dap-excerpt.png`;
if(!fs.existsSync(dap))await sharp(`${prefix}.png`).extract(rect).png().toFile(dap);
receipts.push({source:pdf,sourceSha256:hash(pdf),page:1,crop:rect,output:dap,sha256:hash(dap),purpose:'官方日活口径必要节选，原声不改为另一句话'});
const tablePrefix=`${out}/meta-financial-page8`;
if(!fs.existsSync(`${tablePrefix}.png`)){const r=spawnSync('pdftoppm',['-f','8','-singlefile','-scale-to','2000','-png',pdf,tablePrefix],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
copy(`${tablePrefix}.png`,`${pub}/media/meta-financial-page8.png`);
const table9=`${out}/meta-financial-page9`;
if(!fs.existsSync(`${table9}.png`)){const r=spawnSync('pdftoppm',['-f','9','-singlefile','-scale-to','2000','-png',pdf,table9],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
const tableCrop=`${pub}/media/meta-revenue-table.png`;
if(!fs.existsSync(tableCrop))await sharp(`${table9}.png`).extract({left:95,top:120,width:1390,height:410}).png().toFile(tableCrop);
fs.writeFileSync(`${out}/公开资料视窗回执.r1.json`,JSON.stringify(receipts,null,2)+'\n');
const usedReceipts=usedCrops.map(([name,dest,crop])=>({source:`${evidence}/${name}`,sourceSha256:hash(`${evidence}/${name}`),crop,output:`${pub}/media/${dest}`,sha256:hash(`${pub}/media/${dest}`),purpose:'实际小样消费的标题/作者日期短引文；不显示行情或整篇正文'}));
usedReceipts.push({source:pdf,sourceSha256:hash(pdf),page:9,crop:{left:95,top:120,width:1390,height:410},output:tableCrop,sha256:hash(tableCrop),purpose:'实际季度广告收入/总收入表；第8页现金流图不使用'},receipts[2]);
fs.writeFileSync(`${out}/公开资料实际视窗回执.r2.json`,JSON.stringify({actualUsed:usedReceipts,excludedHistoricalOutputs:['stock-excerpt.png','fee-excerpt.png','meta-financial-page8.png'],priorReceiptScope:'r1为早期候选，其中宽摘录含动态区域，不能当作实际小样展示证据',originalsModified:false},null,2)+'\n');
console.log(JSON.stringify({status:'本期代理与来源视窗已准备',originalsModified:false,formalEnabled:false}));
