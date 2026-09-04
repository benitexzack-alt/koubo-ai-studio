import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const planPath = path.join(root, '04_导演拆解/剪后261秒_素材与镜头对位.v1.json');
const receiptPath = path.join(root, '00_工程控制/preparation-receipt.v1.json');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const plan = read(planPath);
const receipt = read(receiptPath);
const audit = {method:'静帧抽查，不是连续播放或最终验收', createdAt:new Date().toISOString(), planSha256:hash(planPath), receiptSha256:hash(receiptPath), sources:{}, shots:[]};
for (const id of ['U01','T01','T02']) {
  const a = receipt.assets.find(a => a.id === id);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',a.absolutePath], {encoding:'utf8'}));
  const v = probe.streams.find(s => s.codec_type === 'video');
  const [n,d] = v.avg_frame_rate.split('/').map(Number);
  audit.sources[id] = {path:a.absolutePath, sha256:hash(a.absolutePath), expectedSha256:a.sha256, durationSeconds:Number(probe.format.duration), width:v.width, height:v.height, fps:n/d, audioTracks:probe.streams.filter(s=>s.codec_type==='audio').length};
}
for (const b of plan.broll) {
  const a = audit.sources[b.assetId];
  if (b.sourceIn < 0 || b.sourceOut > a.durationSeconds) throw Error('候选范围越界');
  const times = [b.sourceIn, (b.sourceIn+b.sourceOut)/2, b.sourceOut-1/a.fps];
  const frames = times.map((requestedTimeSeconds,i) => {
    const name = `${b.id}-${['in','mid','out-before'][i]}-${requestedTimeSeconds.toFixed(3)}.jpg`;
    execFileSync('ffmpeg',['-v','error','-n','-ss',String(requestedTimeSeconds),'-i',a.path,'-frames:v','1','-vf','scale=960:-2','-q:v','2',path.join(out,name)]);
    return {position:['入点','中点','出点前一帧'][i],requestedTimeSeconds,file:name};
  });
  const sheet = `${b.id}-contact.jpg`;
  execFileSync('ffmpeg',['-v','error','-n',...frames.flatMap(f=>['-i',path.join(out,f.file)]),'-filter_complex','[0:v][1:v][2:v]hstack=inputs=3[v]','-map','[v]','-frames:v','1','-q:v','2',path.join(out,sheet)]);
  audit.shots.push({...b,outputDurationSeconds:(b.outputEndFrameExclusive-b.outputStartFrame)/plan.fps,frames,contactSheet:sheet});
}
fs.writeFileSync(path.join(out,'frame-evidence.v1.json'),JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(audit,null,2));
