import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {assertScopedDirectExport} from '../../../tools/scoped-direct-export-core.mjs';
const base='edit/20260919_ai_training_methods',qa=`${base}/07_预览与质检/正式R1`;
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(args)=>{const r=spawnSync('ffmpeg',args,{encoding:'utf8',maxBuffer:20e6});if(r.status!==0)throw Error(r.stderr);return r.stdout;};
const jobPath=`${base}/06_剪辑工程/production-formal.r1.json`,job=read(jobPath);
assertScopedDirectExport({projectRoot:process.cwd(),job,jobPath,command:'qa'});
const raw=job.formal.rawOutput,final=job.formal.finalOutput,mix='remotion/public-ai-training-final-r1/audio/final-mix.wav';
const previous=read(`${qa}/final-aac-audio-qa.json`);
if(previous.alignment.bestDelaySamples!==2048||previous.status!=='machine-audio-needs-review')throw Error('不符合本次已查明的封装问题');
if(sha(final)!==sha(raw))throw Error('原候选不是本次受控原始输出');
const receiptPath=path.join(path.dirname(raw),fs.readdirSync(path.dirname(raw)).find(n=>n.startsWith(`.${path.basename(raw)}.production-receipt.`)));
if(read(receiptPath).output.sha256!==sha(raw))throw Error('受控回执不匹配');
const temp=`${base}/08_正式成片/AI八种训练方法_R1_音轨校准中.mp4`;
run(['-v','error','-n','-i',raw,'-i',mix,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','320k','-ar','48000','-movflags','+faststart',temp]);
const videoHash=p=>run(['-v','error','-i',p,'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).trim();
const before=videoHash(raw),after=videoHash(temp);
if(before!==after)throw Error('视频码流意外变化，禁止交付');
const prior=`${qa}/首次AAC封装_已替代`;fs.mkdirSync(prior,{recursive:true});
for(const name of ['final-aac-audio-qa.json','media-qa.r1.json','shotcraft-application.r1.json','decode-audio-black.log']){
 if(fs.existsSync(`${qa}/${name}`))fs.renameSync(`${qa}/${name}`,`${prior}/${name}`);
}
fs.renameSync(final,`${prior}/旧候选_音轨延迟42毫秒.mp4`);
fs.renameSync(temp,final);
fs.writeFileSync(`${qa}/audio-remux-receipt.r1.json`,JSON.stringify({schemaVersion:'ai-training-audio-remux/v1',reason:'已核验原AAC比预混音晚2048采样，使用同一绑定PCM重新编码，修正AAC预置延迟；不改变画面或原声内容',source:{path:raw,sha256:sha(raw),productionReceipt:receiptPath},mix:{path:mix,sha256:sha(mix)},output:{path:final,sha256:sha(final)},videoPacketHashBefore:before,videoPacketHashAfter:after,videoBitstreamUnchanged:before===after,voiceEdited:false,priorEvidence:prior,status:'remuxed-awaiting-final-audio-qa'},null,2)+'\n');
console.log('音轨重新封装完成；视频码流完全不变，等待实际AAC复验。');
