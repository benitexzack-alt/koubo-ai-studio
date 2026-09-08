import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {ROOT, CONTROL, OUTPUT, hashFile, readJson, digest} from './runner-core.mjs';

const control = path.join(ROOT, CONTROL), output = path.join(ROOT, OUTPUT);
const reviewPath = path.join(control, 'independent-audio-finish-review.v1.json');
const review = readJson(reviewPath);
assert.equal(review.decision, 'allow-one-local-audio-finish-pending-measured-qa');
const ffmpeg = fs.realpathSync(review.allowedOperation.ffmpeg.path);
assert.equal(hashFile(ffmpeg), review.allowedOperation.ffmpeg.sha256);
const raw = review.input.path, dir = path.join(output, 'audio-finish');
assert(!fs.existsSync(dir), '仅允许一次，不覆盖音频收尾');
assert.equal(hashFile(raw), review.input.sha256);
fs.mkdirSync(dir);
const target = path.join(dir, 'with-sfx-960x540.mp4');
const commands = [];
const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const rules = {gainDb: -.3, gainToleranceDb: .25, normalizedResidualMaximum: .06,
  lowEnergyRmsDbFS: -55, expectedVideoFrames: 8393, truePeakMaximumDbFS: -1,
  excludeLowEnergyFromGainJudgment: true, lowEnergyDoesNotProveAudibility: true,
  audioComparison: '同采样点双声道，不搜索或偷偷补偿时移；AAC有损重编码用实测增益和归一残差核对。'};
write('measurement-rules.v1.json', rules);
function run(label, executable, args, binary = false) {
  const startedAt = new Date().toISOString();
  const r = spawnSync(executable, args, {cwd: ROOT, encoding: binary ? undefined : 'utf8', timeout: 600000, maxBuffer: 256 * 1024 * 1024});
  const item = {label, executable, args, startedAt, endedAt: new Date().toISOString(), exitCode: r.status, error: r.error?.message ?? null};
  commands.push(item);
  write(`${label}.command.json`, item);
  fs.writeFileSync(path.join(dir, `${label}.stderr.txt`), r.stderr ?? '', {flag: 'wx'});
  if (!binary) fs.writeFileSync(path.join(dir, `${label}.stdout.txt`), r.stdout ?? '', {flag: 'wx'});
  assert.equal(r.status, 0, `${label}: ${r.stderr?.toString().slice(-2000)}`);
  return r.stdout;
}
function context(label) {
  const b = review.contextBinding;
  const r = JSON.parse(run(label, 'python3', [path.join(control, 'runtime/knowledge-readonly.py'), '--context', b.contextPath, '--context-sha256', b.sha256]));
  assert.equal(r.status, 'context-valid');
  assert.deepEqual(r.problems, []);
  return r;
}
context('context-before');
run('audio-finish', ffmpeg, ['-hide_banner', '-nostats', '-n', '-i', raw, '-map', '0:v:0', '-map', '0:a:0',
  '-c:v', 'copy', '-af', review.allowedOperation.audioFilter, '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', target]);
const probe = file => JSON.parse(run(file === raw ? 'raw-probe' : 'final-probe', '/opt/homebrew/bin/ffprobe',
  ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]));
const before = probe(raw), after = probe(target);
const v = after.streams.find(s => s.codec_type === 'video'), a = after.streams.find(s => s.codec_type === 'audio');
const bv = before.streams.find(s => s.codec_type === 'video'), ba = before.streams.find(s => s.codec_type === 'audio');
const presentation = s => Object.fromEntries(['codec_name','codec_tag_string','profile','level','width','height','pix_fmt','color_range',
  'color_space','color_transfer','color_primaries','sample_aspect_ratio','display_aspect_ratio','field_order','r_frame_rate','avg_frame_rate',
  'time_base','start_pts','start_time','duration_ts','duration','side_data_list'].map(k => [k,s[k] ?? null]));
const videoPackets = file => JSON.parse(run(file === raw ? 'raw-video-packets' : 'final-video-packets', '/opt/homebrew/bin/ffprobe',
  ['-v','error','-select_streams','v:0','-show_packets','-show_data_hash','sha256','-show_entries','packet=pts_time,dts_time,duration_time,size,flags,data_hash','-of','json',file])).packets;
const p0 = videoPackets(raw), p1 = videoPackets(target);
const frameHash = (label, file) => run(label, ffmpeg, ['-v','error','-i',file,'-map','0:v:0','-an','-f','framemd5','-'])
  .split('\n').filter(l => l && !l.startsWith('#')).map(l => l.replaceAll(' ',''));
const f0 = frameHash('raw-frames', raw), f1 = frameHash('final-frames', target);
run('full-decode', ffmpeg, ['-v','error','-xerror','-i',target,'-map','0:v:0','-map','0:a:0','-f','null','-']);
const sLabel = 'signal-scan';
run(sLabel, ffmpeg, ['-hide_banner','-nostats','-i',target,'-vf','blackdetect=d=0.2:pix_th=0.1,freezedetect=n=-50dB:d=2',
  '-af','silencedetect=noise=-50dB:d=2,ebur128=peak=true','-f','null','-']);
const log = fs.readFileSync(path.join(dir, `${sLabel}.stderr.txt`),'utf8');
const summary = log.slice(log.lastIndexOf('Summary:'));
const loudness = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
const truePeak = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
const pcm = (label,file) => run(label,ffmpeg,['-v','error','-i',file,'-map','0:a:0','-c:a','pcm_f32le','-f','f32le','-'],true);
const x = pcm('raw-pcm',raw), y = pcm('final-pcm',target);
const sampleRate = Number(a.sample_rate), channels = a.channels;
const visual = readJson(path.join(ROOT,'remotion/src/lanzhou-services-v91-candidate-r2/visual-plan.v1.json'));
const data = readJson(path.join(ROOT,'edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r1/data.v1.json'));
const windows = [{id:'FULL',start:0,end:Math.min(x.length,y.length)/4/channels/sampleRate},
  {id:'HOST',start:12,end:20},{id:'NEWS',start:69/30,end:313/30},
  ...data.papers.map(p=>({id:p.id,start:p.outputStartFrame/30,end:(p.outputStartFrame+p.durationInFrames)/30})),
  ...visual.sfx.map(c=>({id:c.id,start:c.frame/30,end:(c.frame+c.durationInFrames)/30}))];
const gains = windows.map(w=>{
  const first=Math.round(w.start*sampleRate)*channels, last=Math.min(Math.round(w.end*sampleRate)*channels,x.length/4,y.length/4);
  let xx=0,yy=0,xy=0;
  for(let i=first;i<last;i++){const q=x.readFloatLE(i*4),r=y.readFloatLE(i*4);xx+=q*q;yy+=r*r;xy+=q*r;}
  const gain=xy/xx, gainDb=20*Math.log10(gain), rmsDb=10*Math.log10(xx/(last-first));
  const residual=Math.sqrt(Math.max(0,yy-2*gain*xy+gain*gain*xx)/yy);
  const excluded=rmsDb<rules.lowEnergyRmsDbFS;
  return {...w,scalarSamples:last-first,rmsDbFS:rmsDb,gainDb,normalizedResidual:residual,lowEnergyExcluded:excluded,
    pass:excluded||(Math.abs(gainDb-rules.gainDb)<=rules.gainToleranceDb&&residual<=rules.normalizedResidualMaximum)};
});
const audioPackets = file => JSON.parse(run(file===raw?'raw-audio-packets':'final-audio-packets','/opt/homebrew/bin/ffprobe',
  ['-v','error','-select_streams','a:0','-show_packets','-show_entries','packet=pts_time,duration_time,side_data_list','-of','json',file])).packets;
const ap0=audioPackets(raw),ap1=audioPackets(target);
const finalContext=context('context-after');
const checks={sourceUnchanged:hashFile(raw)===review.input.sha256,
  rawQaUnchanged:hashFile(path.join(ROOT,review.rawQa.path))===review.rawQa.sha256,
  rawReceiptUnchanged:hashFile(path.join(ROOT,review.renderReceipt.path))===review.renderReceipt.sha256,
  videoParameters:v.width===960&&v.height===540&&v.r_frame_rate==='30/1'&&Number(v.nb_read_frames)===8393&&v.codec_name==='h264',
  audioParameters:a.codec_name==='aac'&&sampleRate===48000&&channels===2,
  videoPresentationIdentical:digest(presentation(bv))===digest(presentation(v)),
  videoPayloadAndTimingIdentical:digest(p0)===digest(p1),
  allDecodedVideoFramesIdentical:f0.length===8393&&digest(f0)===digest(f1),
  audioDecodedSampleCountIdentical:x.length===y.length, audioStartTimeIdentical:a.start_time===ba.start_time,
  globalAndWindowGain:gains.every(g=>g.pass),
  noBlackIntervals:!log.includes('black_start:'),noLongFreeze:!log.includes('freeze_start:'),
  noLongSilenceIncludingOpenTail:!log.includes('silence_start:'),
  loudnessMeasured:Number.isFinite(loudness),truePeakWithinBound:Number.isFinite(truePeak)&&truePeak<=-1};
const result={schemaVersion:'lanzhou-r2-audio-finish-qa/v1',generatedAt:new Date().toISOString(),
  status:Object.values(checks).every(Boolean)?'technical-checks-passed-user-review-required':'technical-review-required',
  review:{path:reviewPath,sha256:hashFile(reviewPath)},raw:{path:raw,sha256:hashFile(raw)},
  video:{path:target,sha256:hashFile(target),bytes:fs.statSync(target).size,duration:v.duration,width:v.width,height:v.height,
    frames:v.nb_read_frames,fps:v.r_frame_rate,pixFmt:v.pix_fmt,colorRange:v.color_range,videoCodec:v.codec_name,audioCodec:a.codec_name,channels},
  checks,masterGainDb:-.3,loudnessLUFS:loudness,truePeakDbFS:truePeak,measurementRules:rules,gains,
  videoIdentity:{packetCount:p1.length,packetDigest:digest(p1),frameCount:f1.length,frameDigest:digest(f1)},
  audioIntegrity:{rawDeclaredSeconds:ba.duration,finalDeclaredSeconds:a.duration,rawDecodedSamplesPerChannel:x.length/4/channels,
    finalDecodedSamplesPerChannel:y.length/4/channels,rawBoundaryPackets:[ap0[0],ap0.at(-1)],finalBoundaryPackets:[ap1[0],ap1.at(-1)],
    note:'保留原AAC完整解码样本，不用视频时长裁音频；若容器duration因编码末帧填充变化，以下实际样本与首尾packet供核对，不能自动视为已解释。'},
  context:finalContext,commands,humanListeningPerformed:false,formalEnabled:false,userPreviewApproved:false,publishAuthorized:false};
write('audio-finish-qa.v1.json',result);
console.log(JSON.stringify({status:result.status,video:result.video,checks,loudness,truePeak,gains,audioIntegrity:result.audioIntegrity},null,2));
