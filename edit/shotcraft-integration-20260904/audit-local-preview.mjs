import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../..');
const output = path.join(base, 'local-preview-v1');
const qa = path.join(output, 'qa');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'remotion/src/shotcraft-candidate-v1/candidate-plan.v1.json')));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = ['with-sfx.mp4', 'no-sfx.mp4'].map((name) => path.join(output, name));
if (process.argv.length !== 2) throw new Error('固定样片质检不接受其他输入');
for (const file of files) if (!fs.statSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error('样片不是常规文件');
if (fs.existsSync(qa)) throw new Error('已有质检证据不能覆盖');
fs.mkdirSync(qa);
const checks = [];
const run = (binary, args, id, binaryOutput = false) => {
  const result = spawnSync(binary, args, {encoding: binaryOutput ? undefined : 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000});
  fs.writeFileSync(path.join(qa, `${id}.stderr.log`), result.stderr ?? '', {flag: 'wx'});
  if (!binaryOutput) fs.writeFileSync(path.join(qa, `${id}.stdout.log`), result.stdout ?? '', {flag: 'wx'});
  checks.push({id, command: [binary, ...args], exitCode: result.status});
  if (result.error || result.status !== 0) throw new Error(`${id}: ${result.error?.message ?? result.status}`);
  return binaryOutput ? result.stdout : String(result.stdout);
};
const measurements = [];
const pcm = [];
for (const [index, file] of files.entries()) {
  const id = index ? 'no-sfx' : 'with-sfx';
  const probe = JSON.parse(run('ffprobe', ['-v','error','-count_frames','-show_streams','-show_format','-of','json',file], `${id}-probe`));
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  if (!(v?.width === 960 && v.height === 540 && v.r_frame_rate === '30/1' && Number(v.nb_read_frames) === 930 && Math.abs(Number(v.duration) - 31) < .001 && v.codec_name === 'h264' && a?.codec_name === 'aac')) throw new Error('媒体规格不符合固定31秒样片');
  run('ffmpeg', ['-nostdin','-hide_banner','-v','error','-xerror','-i',file,'-map','0:v:0','-map','0:a:0','-f','null','-'], `${id}-decode`);
  const frameHashes = run('ffmpeg', ['-nostdin','-hide_banner','-v','error','-i',file,'-map','0:v:0','-an','-f','framemd5','-'], `${id}-frames`);
  run('ffmpeg', ['-nostdin','-hide_banner','-i',file,'-vf','blackdetect=d=0.08:pix_th=0.1:pic_th=0.98,freezedetect=n=-50dB:d=1','-af','silencedetect=n=-50dB:d=0.8,ebur128=peak=true','-f','null','-'], `${id}-signals`);
  const log = fs.readFileSync(path.join(qa, `${id}-signals.stderr.log`), 'utf8');
  const blackEvents = [...log.matchAll(/black_start:([^\n]+)/g)].map((m) => m[0]);
  const freezeEvents = [...log.matchAll(/lavfi\.freezedetect\.([^\n]+)/g)].map((m) => m[0]);
  const silenceEvents = [...log.matchAll(/silence_(?:start|end):[^\n]+/g)].map((m) => m[0]);
  const summary = log.slice(log.lastIndexOf('Summary:'));
  measurements.push({id, path: file, sha256: sha(fs.readFileSync(file)), bytes: fs.statSync(file).size, video: v, audio: a,
    decodedFrameDigest: sha(frameHashes), blackEvents, freezeEvents, silenceEvents, loudnessSummary: summary});
  pcm.push(run('ffmpeg', ['-nostdin','-hide_banner','-v','error','-i',file,'-map','0:a:0','-ac','2','-ar','48000','-t','31','-f','f32le','-'], `${id}-pcm`, true));
}
if (measurements[0].decodedFrameDigest !== measurements[1].decodedFrameDigest) throw new Error('两版解码画面不一致');
if (pcm[0].length !== pcm[1].length) throw new Error('两版音轨采样长度不同');
const samples = pcm.map((b) => new Float32Array(b.buffer, b.byteOffset, b.length / 4));
const rms = (from, to, difference = true) => {
  let sum = 0, peak = 0, n = 0;
  for (let i = Math.max(0, Math.floor(from * 96000)); i < Math.min(samples[0].length, Math.floor(to * 96000)); i++) {
    const value = difference ? samples[0][i] - samples[1][i] : samples[1][i];
    sum += value * value; peak = Math.max(peak, Math.abs(value)); n++;
  }
  return {rmsDbfs: n && sum ? 10 * Math.log10(sum / n) : null, peakDbfs: peak ? 20 * Math.log10(peak) : null};
};
const cues = plan.sfx.map((cue) => ({...cue, atSeconds: cue.frame / 30, difference: rms(cue.frame / 30, cue.frame / 30 + .25),
  speechAndMaterial: rms(cue.frame / 30, cue.frame / 30 + .25, false), semanticAudibility: 'pending-user-listening'}));
const report = {schemaVersion: 'shotcraft-local-preview-machine-qa/v1', at: new Date().toISOString(),
  status: 'machine-analysis-complete-human-review-pending', scope: 'local-experiment-only', formalEnabled: false, productionEligible: false,
  measurements, sameDecodedPicture: true, audioDifferenceFirstSecond: rms(0,1), sfxCues: cues, checks,
  limitations: ['AAC差分有编码扩散，不作为精确声学同步证明。','逐项读词来自既有ASR定位，需用户1倍速确认。','黑场/静音/冻结命中必须结合实际画面复核。','机器检测不能替代正常音量试听和用户完整观看。']};
fs.writeFileSync(path.join(qa, 'machine-qa.v1.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({path: path.join(qa, 'machine-qa.v1.json'), sha256: sha(fs.readFileSync(path.join(qa, 'machine-qa.v1.json'))),
  sameDecodedPicture: true, measured: measurements.map(({id,sha256,bytes,blackEvents,freezeEvents,silenceEvents,loudnessSummary}) => ({id,sha256,bytes,blackEvents,freezeEvents,silenceEvents,loudnessSummary})), cues}, null, 2));
