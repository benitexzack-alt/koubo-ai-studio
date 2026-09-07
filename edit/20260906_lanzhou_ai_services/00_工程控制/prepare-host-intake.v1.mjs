import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const repo = path.resolve(import.meta.dirname, '../../..');
const episode = path.resolve(import.meta.dirname, '..');
const source = path.join(episode, '02_原片/copy_3257E7D6-476D-4668-93F2-0CA1BD79F373.MOV');
const qa = path.join(episode, '07_预览与质检/host-intake-r1');
const proxy = path.join(qa, 'R01_960x540_响度处理代理.mp4');
const receiptPath = path.join(qa, 'host-intake-receipt.v1.json');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const relative = p => path.relative(repo, p);
const write = (name, value) => fs.writeFileSync(path.join(qa, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx'});
const run = (command, args) => {
  const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
  assert.equal(result.status, 0, `${command}: ${result.stderr}`);
  return result;
};
assert(!fs.existsSync(proxy) && !fs.existsSync(receiptPath), '历史产物不覆盖');
fs.mkdirSync(qa, {recursive: true});
const sourceHash = sha(source);
assert.equal(sourceHash, '9e220b1e93a5eb49759827faf5a47aaef71ca030f674c6c8b549c9e0e159c07b');
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source]).stdout);
write('source-ffprobe.v1.json', probe);
const video = probe.streams.find(s => s.codec_type === 'video');
assert.equal(video.nb_frames, '8149');
assert.equal(video.width, 1920);
assert.equal(video.height, 1080);
const diagnostics = run('ffmpeg', ['-hide_banner', '-nostdin', '-i', source, '-map', '0:v:0', '-map', '0:a:0', '-vf', 'blackdetect=d=0.3:pix_th=0.10,freezedetect=n=-50dB:d=2', '-af', 'silencedetect=n=-52dB:d=0.8,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
write('source-full-decode-and-signals.log', diagnostics.stderr);
const measurement = JSON.parse(diagnostics.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0] ?? 'null');
assert(measurement && Number.isFinite(Number(measurement.input_i)));
const filter = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${measurement.input_i}:measured_TP=${measurement.input_tp}:measured_LRA=${measurement.input_lra}:measured_thresh=${measurement.input_thresh}:offset=${measurement.target_offset}:linear=true:print_format=json`;
const encoded = run('ffmpeg', ['-hide_banner', '-nostdin', '-n', '-i', source, '-map', '0:v:0', '-map', '0:a:0', '-vf', 'scale=960:540,setsar=1', '-r', '30', '-af', filter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', proxy]);
write('proxy-encode.log', encoded.stderr);
const normalization = JSON.parse(encoded.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0] ?? 'null');
const decoded = run('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-i', proxy, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-']);
write('proxy-full-decode.log', decoded.stderr);
const proxyProbe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', proxy]).stdout);
write('proxy-ffprobe.v1.json', proxyProbe);
assert.equal(proxyProbe.streams.find(s => s.codec_type === 'video').nb_frames, '8149');
assert.equal(sha(source), sourceHash);
write('host-intake-receipt.v1.json', {
  schemaVersion: 'koubo-local-host-intake/v1', status: 'technical-intake-passed-not-transcript-acceptance', at: new Date().toISOString(),
  source: {path: relative(source), sha256: sourceHash, durationSeconds: Number(video.duration), frames: Number(video.nb_frames)},
  sourceFullDecodeExitCode: diagnostics.status, originalUnchanged: true,
  signalEvents: diagnostics.stderr.split('\n').filter(line => /black_start|freeze_start|freeze_end|silence_start|silence_end/.test(line)),
  audioMeasurement: measurement, normalization, normalizationFilter: filter,
  audioPolicy: '只处理响度，不删词，不移时，不替换为TTS；实际听感仍待用户样片验收',
  proxy: {path: relative(proxy), sha256: sha(proxy), ffprobe: relative(path.join(qa, 'proxy-ffprobe.v1.json')), fullDecodeExitCode: decoded.status},
  visualInspection: {evidence: relative(path.join(qa, 'contact.jpg')), sampleTimesSeconds: [0, 45, 90, 135, 180, 225], faceAreaApproximate1920: {x: 885, y: 140, width: 520, height: 650}, leftInformationArea: {x: 54, y: 110, width: 680, height: 650}},
  formalEnabled: false, humanListeningCompleted: false, productionRenderStarted: false,
});
console.log(JSON.stringify({receiptPath, sha256: sha(receiptPath), proxy, measuredLufs: measurement.input_i, outputLufs: normalization?.output_i, sourceFrames: video.nb_frames}));
