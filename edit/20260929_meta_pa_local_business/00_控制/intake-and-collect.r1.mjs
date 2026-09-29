import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
const root=process.cwd(),ep='edit/20260929_meta_pa_local_business';
const write=(p,v)=>fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const session='/Users/pc/.codex/sessions/2026/09/11/rollout-2026-09-11T19-21-27-01a09033-794b-7dc2-a53d-19afbccec54e.jsonl';
const fd=fs.openSync(session,'r'),size=fs.fstatSync(fd).size,buffer=Buffer.alloc(Math.min(size,16*1024*1024));
fs.readSync(fd,buffer,0,buffer.length,size-buffer.length);fs.closeSync(fd);
const rows=buffer.toString('utf8').split('\n').slice(1).flatMap(l=>{try{return[JSON.parse(l)];}catch{return[];}});
const row=rows.filter(r=>r.type==='response_item'&&r.payload?.role==='user').findLast(r=>JSON.stringify(r.payload.content).includes('copy_1C64A779-C1E2-417C-A440-6474D8A3C04B.MOV')&&JSON.stringify(r.payload.content).includes('靠广告赚钱的Meta'));
if(!row)throw Error('未定位本轮用户文稿，停止避免错用旧稿');
const msg=row.payload.content.filter(c=>c.type==='input_text'||c.type==='text').map(c=>c.text).join('\n');
const start=msg.indexOf('靠广告赚钱的Meta'),end=msg.indexOf('还有成片我也录好了',start);
if(start<0||end<start)throw Error('文稿边界异常');
write(`${ep}/02_文稿/本轮用户文稿_仅对照.txt`,msg.slice(start,end).trim()+'\n');
write(`${ep}/00_控制/本轮用户输入回执.json`,{scriptRole:'comparison-only',sourceSession:session,sourceMessageSha256:crypto.createHash('sha256').update(msg).digest('hex'),scriptSha256:hash(`${ep}/02_文稿/本轮用户文稿_仅对照.txt`),requestedScope:msg.slice(end),receivedRecording:true});
const original='/Users/pc/Downloads/copy_1C64A779-C1E2-417C-A440-6474D8A3C04B.MOV';
const copy=`${ep}/01_素材投放区/01_口播原片/${path.basename(original)}`;
if(hash(original)!==hash(copy))throw Error('原片副本不一致');
write(`${ep}/00_控制/原片入库.json`,{source:original,copy,sha256:hash(copy),probe:JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',copy],{encoding:'utf8'})),originalModified:false,transcriptStatus:'local-asr-not-human-verified'});
const dst=`${ep}/01_素材投放区/05_公开素材_Codex准备`;
const entries=[
 ['S01_Meta发布原页.html','https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/','Meta官方','Muse发布与云浏览器、授权、美国逐步开放'],
 ['S02_Meta二季报原页.html','https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Second-Quarter-2026-Results/','Meta投资者关系','2026Q2广告占比及产品家族日活口径'],
 ['S03_千问生态原页.html','https://www.alibabagroup.com/zh-HK/document-1948497434959151104','阿里巴巴集团','2026年1月生态服务接入'],
 ['S04_千问淘宝原页.html','https://www.alibabagroup.com/zh-HK/document-1991231293551017984','阿里巴巴集团','2026年5月淘宝互通'],
 ['S05_豆包二代原页.html','https://www.zte.com.cn/china/about/news/20260916C1.html','中兴通讯','NaviX Ultra与豆包助手消费者版'],
 ['V01_Muse官方介绍.mp4','https://about.fb.com/wp-content/uploads/2026/09/Introducing-Muse_Sizzle-Video.mp4','Meta官方','产品片候选，非本人实测'],
 ['V02_Muse官方购物演示.mp4','https://about.fb.com/wp-content/uploads/2026/09/Muse_Shopping.mp4','Meta官方','官方功能演示，非兰州订房证据'],
 ['I01_千问淘宝官方图.png','https://data.alibabagroup.com/ecms-files/1532295521/db3caefa-2bf6-4f2a-b80e-74d7913b27f4/767a217693f0d5d228b53ae8ab48b8c1.png','阿里巴巴集团','千问淘宝互通界面'],
 ['I02_豆包二代官方图.png','https://www.zte.com.cn/content/zte-site/www-zte-com-cn/china/about/news/20260916C1/jcr%3Acontent/parsys/image.img.png/1789544868319.png','中兴通讯','实际新型号图片'],
 ['I03_豆包二代能力官方图.png','https://www.zte.com.cn/content/zte-site/www-zte-com-cn/china/about/news/20260916C1/jcr%3Acontent/parsys/image_1009025115.img.png/1789544920662.png','中兴通讯','实际新型号能力示意']
];
const receipts=[];
for(let i=0;i<entries.length;i+=4)await Promise.all(entries.slice(i,i+4).map(async([name,url,source,purpose])=>{
 const p=`${dst}/${name}`;if(fs.existsSync(p))throw Error('不覆盖已有素材:'+p);
 const r=await new Promise(resolve=>{const c=spawn('curl',['-f','-L','--max-time','60','--connect-timeout','15','-sS','-o',p,url]);let err='';c.stderr.on('data',b=>err+=b);c.on('close',code=>resolve({code,error:err.slice(-700)}));});
 const ok=r.code===0&&fs.existsSync(p)&&fs.statSync(p).size>0;
 const receipt={name,url,source,purpose,fetchedAt:new Date().toISOString(),status:ok?'downloaded-review-pending':'download-failed',path:p,sha256:ok?hash(p):null,bytes:ok?fs.statSync(p).size:0,rightsStatus:'official-source-editorial-use-review-required',productionApproved:false,...r};
 receipts.push(receipt);console.log(name,receipt.status,receipt.bytes);
}));
write(`${dst}/采集回执.r1.json`,{entries:receipts,boundary:'来源公开不等于无限转载授权；只作本期评论说明候选，发布前核权，不导入源片音乐。'});
