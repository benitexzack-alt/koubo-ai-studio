import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Fixed review derivatives only: preserve the rendered video and apply equal gain.
const base = path.join(path.dirname(fileURLToPath(import.meta.url)), 'local-preview-v1');
const qa = path.join(base, 'review-qa');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inputs = [
  ['with-sfx', '14afa75861c0060b1a677260c77f50797746a0b458058ed66f086ba2caf84406', '01_动效样片_有附加音效_31秒.mp4'],
  ['no-sfx', 'd67c30795803d2cedd481fd6b4d98e09e46db89b30f3064c3d919f653759d9b0', '02_动效样片_无附加音效对照_31秒.mp4'],
];
if (process.argv.length !== 2) throw new Error('本脚本不接受其他输入');
if (fs.existsSync(qa)) throw new Error('不得覆盖已有试听回执');
for (const [id, hash, name] of inputs) {
  const source = path.join(base, `${id}.mp4`);
  if (fs.lstatSync(source).isSymbolicLink() || sha(fs.readFileSync(source)) !== hash) throw new Error('原始样片绑定不一致');
  if (fs.existsSync(path.join(base, name))) throw new Error('试听副本已存在');
}
fs.mkdirSync(qa);
const checks = [];
const run = (bin, args, id) => {
  const r = spawnSync(bin, args, {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120000});
  fs.writeFileSync(path.join(qa, `${id}.stdout.log`), r.stdout ?? '', {flag: 'wx'});
  fs.writeFileSync(path.join(qa, `${id}.stderr.log`), r.stderr ?? '', {flag: 'wx'});
  checks.push({id, command: [bin, ...args], exitCode: r.status});
  if (r.error || r.status !== 0) throw new Error(`${id}: ${r.error?.message ?? r.status}`);
  return r;
};
const measured = [];
for (const [id, hash, name] of inputs) {
  const source = path.join(base, `${id}.mp4`);
  const file = path.join(base, name);
  run('ffmpeg', ['-nostdin','-hide_banner','-v','error','-n','-i',source,'-map','0:v:0','-map','0:a:0',
    '-c:v','copy','-af','volume=5dB','-c:a','aac','-b:a','320k','-ar','48000','-ac','2','-t','31','-movflags','+faststart',file], `${id}-copy`);
  const probe = JSON.parse(run('ffprobe', ['-v','error','-count_frames','-show_streams','-show_format','-of','json',file], `${id}-probe`).stdout);
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  if (!(v?.width === 960 && v.height === 540 && v.r_frame_rate === '30/1' && Number(v.nb_read_frames) === 930 &&
    Number(v.duration) === 31 && v.codec_name === 'h264' && a?.codec_name === 'aac' && a.channels === 2 &&
    Math.abs(Number(a.duration) - 31) < .001)) throw new Error('试听副本媒体规格不符');
  run('ffmpeg', ['-nostdin','-hide_banner','-v','error','-xerror','-i',file,'-map','0:v:0','-map','0:a:0','-f','null','-'], `${id}-decode`);
  const frames = run('ffmpeg', ['-nostdin','-hide_banner','-v','error','-i',file,'-map','0:v:0','-an','-f','framemd5','-'], `${id}-frames`).stdout;
  const rawFrames = fs.readFileSync(path.join(base, 'qa', `${id}-frames.stdout.log`), 'utf8');
  if (frames !== rawFrames) throw new Error('试听副本改变了视频帧');
  const signals = run('ffmpeg', ['-nostdin','-hide_banner','-i',file,
    '-vf','blackdetect=d=0.08:pix_th=0.1:pic_th=0.98,freezedetect=n=-50dB:d=1',
    '-af','silencedetect=n=-50dB:d=0.8,ebur128=peak=true','-f','null','-'], `${id}-signals`).stderr;
  const summary = signals.slice(signals.lastIndexOf('Summary:'));
  const lufs = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
  const truePeak = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
  const events = [...signals.matchAll(/black_start:[^\n]+|lavfi\.freezedetect\.[^\n]+|silence_(?:start|end):[^\n]+/g)].map((m) => m[0]);
  if (!(lufs >= -21 && lufs <= -18 && truePeak <= -1) || events.length) throw new Error('试听副本信号检查需复核');
  if (sha(fs.readFileSync(source)) !== hash) throw new Error('原始样片被改变');
  measured.push({id, path: file, sha256: sha(fs.readFileSync(file)), bytes: fs.statSync(file).size,
    source: {path: source, sha256: hash}, gainDb: 5, videoStreamCopied: true, same930DecodedFrames: true,
    video: v, audio: a, integratedLufs: lufs, truePeakDbfs: truePeak, blackFreezeSilenceEvents: events});
}
const receipt = {schemaVersion: 'shotcraft-review-copy-qa/v1', at: new Date().toISOString(),
  status: 'machine-analysis-complete-human-review-pending', formalEnabled: false, productionEligible: false,
  method: '两版统一线性增益+5dB；无压缩、无自动动态增益、无画面重编码；只去掉31秒画面末尾之外的AAC填充。原始渲染保留。',
  measured, checks, limitations: ['AAC重新编码；保留原始A/B用于音效差分审计。','声音主观可听度、7处音效时机和正常速度整体观感仍待用户确认。']};
fs.writeFileSync(path.join(qa, 'review-copy-qa.v1.json'), JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({receipt: path.join(qa, 'review-copy-qa.v1.json'), measured: measured.map(({id,path,sha256,integratedLufs,truePeakDbfs}) => ({id,path,sha256,integratedLufs,truePeakDbfs}))}, null, 2));
