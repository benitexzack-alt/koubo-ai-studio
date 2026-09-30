import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root='/Users/pc/Documents/口播/edit/20260929_meta_pa_local_business';
const out=path.join(root,'10_剪辑准备/素材验收');
const report=path.join(out,'素材规格与完整解码回执.r1.json');
const results=[];
for(const id of ['P01','P02','P03','P04','P05','P06','P07','G01','V01','V02','ORIGINAL']){
const dir=id[0]==='P'?'04_纸艺视频':id[0]==='G'?'03_AI情景视频':id[0]==='V'?'05_公开素材_Codex准备':'01_口播原片';
const file=fs.readdirSync(path.join(root,'01_素材投放区',dir)).find(n=>id==='ORIGINAL'?/\.mov$/i.test(n):n.includes(id));
const input=path.join(root,'01_素材投放区',dir,file);
const probe=JSON.parse(spawnSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',input],{encoding:'utf8'}).stdout);
const d=Number(probe.format.duration);const v=probe.streams.find(s=>s.codec_type==='video');const [n,den]=v.avg_frame_rate.split('/').map(Number);const fps=n/den;
const times=id==='ORIGINAL'?[0,45,90,135,180,225,270,315,405]:id[0]==='P'||id[0]==='G'?[0,.5,1,2,3,4,5,6,Math.max(0,d-.2)]:Array.from({length:9},(_,i)=>i*(d-.1)/8);
const indices=[...new Set(times.map(t=>Math.round(t*fps)))];const select=indices.map(i=>`eq(n\\,${i})`).join('+');const image=path.join(out,`${id}_首中末与动作边界.jpg`);
const vf=`select='${select}',scale=640:-2,tile=3x3:nb_frames=${indices.length}:padding=6:margin=6`;
const r=spawnSync('ffmpeg',['-y','-hide_banner','-v','error','-threads','2','-i',input,'-vf',vf,'-frames:v','1','-q:v','2',image],{encoding:'utf8'});
results.push({id,path:image,passed:r.status===0&&fs.existsSync(image),timesSeconds:times,error:r.stderr?.trim()});console.log(`${id}: ${results.at(-1).passed}`);
}
if(fs.existsSync(report)){const data=JSON.parse(fs.readFileSync(report,'utf8'));for(const r of results){const e=data.entries.find(e=>e.id===r.id);if(e)e.contactSheet=r;}data.contactRebuiltAt=new Date().toISOString();fs.writeFileSync(report,JSON.stringify(data,null,2)+'\n');}
fs.writeFileSync(path.join(out,'联系表回执.r1.json'),JSON.stringify(results,null,2)+'\n');
