import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const out=path.dirname(fileURLToPath(import.meta.url));
const a=JSON.parse(fs.readFileSync(path.join(out,'frame-evidence.v1.json')));
const requests={B1:[35.5,38.35,41.2],B2:[50.6,53.7,56.8],B3:[3,8.5,10.5],B5:[132,135.25,138.5]};
const rows=[];
for(const [id,times] of Object.entries(requests)){
 const b=a.shots.find(b=>b.id===id); const source=a.sources[b.assetId];
 const files=times.map(t=>{
  if(t<b.sourceIn||t>=b.sourceOut)throw Error('越界');
  const file=`${id}-refine-${t.toFixed(3)}.jpg`;
  execFileSync('ffmpeg',['-v','error','-n','-ss',String(t),'-i',source.path,'-frames:v','1','-vf','scale=960:-2','-q:v','2',path.join(out,file)]);
  return {requestedTimeSeconds:t,file};
 });
 const sheet=`${id}-refine-contact.jpg`;
 execFileSync('ffmpeg',['-v','error','-n',...files.flatMap(f=>['-i',path.join(out,f.file)]),'-filter_complex','[0:v][1:v][2:v]hstack=inputs=3[v]','-map','[v]','-frames:v','1','-q:v','2',path.join(out,sheet)]);
 rows.push({id,files,sheet});
}
fs.writeFileSync(path.join(out,'refine-evidence.v1.json'),JSON.stringify(rows,null,2)+'\n',{flag:'wx'});
