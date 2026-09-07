import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ROOT, CONTROL, OUTPUT, hashFile, readJson} from '../runner-core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const qaRoot = path.join(ROOT, OUTPUT, 'qa');
const binding = readJson(path.join(root, 'recovery-binding-check.v1.json'));
assert.equal(binding.status, 'bindings-unchanged-awaiting-decode-evidence');
const qa = readJson(path.join(qaRoot, 'candidate-machine-qa.v1.json'));
const media = readJson(path.join(qaRoot, 'media.json'));
assert.deepEqual(media, readJson(path.join(qaRoot, 'probe.stdout.txt')));
const video = media.streams.filter(s => s.codec_type === 'video');
const audio = media.streams.filter(s => s.codec_type === 'audio');
assert.equal(video.length, 1); assert.equal(audio.length, 1);
assert.equal(video[0].codec_name, 'h264'); assert.equal(video[0].width, 960); assert.equal(video[0].height, 540);
assert.equal(video[0].nb_read_frames, '8393'); assert.equal(video[0].r_frame_rate, '30/1');
assert.equal(video[0].duration, '279.766667'); assert.equal(video[0].pix_fmt, 'yuvj420p');
assert.equal(audio[0].codec_name, 'aac'); assert.equal(audio[0].channels, 2); assert.equal(audio[0].duration, '279.829333');
for (const name of ['probe', 'full-decode', 'signal-scan']) {
  const command = readJson(path.join(qaRoot, `${name}.command.json`));
  assert.equal(command.exitCode, 0); assert.equal(command.error, null);
  assert(command.args.includes(binding.video.path));
}
const decode = readJson(path.join(qaRoot, 'full-decode.command.json'));
assert(decode.args.includes('-xerror') && decode.args.includes('0:v:0') && decode.args.includes('0:a:0'));
assert.equal(fs.statSync(path.join(qaRoot, 'full-decode.stderr.txt')).size, 0);
const signal = fs.readFileSync(path.join(qaRoot, 'signal-scan.stderr.txt'), 'utf8');
assert(!/black_start:|freeze_start:|silence_start:/.test(signal));
assert(/I:\s+-15\.9 LUFS/.test(signal) && /Peak:\s+-1\.1 dBFS/.test(signal));
assert(/frame=\s*8393/.test(signal));
assert.equal(qa.video.sha256, binding.video.sha256);
assert.equal(hashFile(binding.video.path), binding.video.sha256);
assert.equal(hashFile(binding.renderStarted.path), binding.renderStarted.sha256);
assert.equal(hashFile(binding.originalFailure.path), binding.originalFailure.sha256);
const nativePath = path.join(ROOT, CONTROL, 'runtime/tests/bundled-ffprobe-readonly-2026-09-07T16-11-02-600Z.json');
assert.equal(hashFile(nativePath), '81f7c43ead7e36d85e6bfc8d99194765f0952023df837d96ac84032532aabf5c');
const native = readJson(nativePath);
assert.equal(native.result.exitCode, 0); assert.equal(native.result.stderr, '');
assert.deepEqual(native.before, native.after);
assert.equal(native.result.probe.streams.find(s => s.codec_type === 'video').nb_read_frames, '8393');
assert.equal(native.videoProducedByThisCheck, false);
for (const key of ['formalEnabled', 'userPreviewApproved', 'publishAuthorized']) assert.equal(qa[key], false);
const files = ['candidate-machine-qa.v1.json', 'media.json', 'probe.command.json', 'probe.stdout.txt',
  'full-decode.command.json', 'full-decode.stderr.txt', 'signal-scan.command.json', 'signal-scan.stdout.txt', 'signal-scan.stderr.txt'];
const result = {schemaVersion: 'candidate-recovery-qa-evidence-review/v1', checkedAt: new Date().toISOString(),
  status: 'existing-candidate-technical-evidence-verified', qaExecutor: 'parent-composition-task',
  independentReviewMethod: 'read-raw-command-output-and-current-artifact-hash', probesOrDecodeRerun: false,
  video: binding.video, inputBindingReceipt: {path: path.join(root, 'recovery-binding-check.v1.json'), sha256: hashFile(path.join(root, 'recovery-binding-check.v1.json'))},
  evidence: files.map(name => ({path: path.join(qaRoot, name), sha256: hashFile(path.join(qaRoot, name))})),
  nativeBundledProbeEvidence: {path: nativePath, sha256: hashFile(nativePath), executedBy: 'Linnaeus', exitCode: 0, rerunByReviewer: false},
  videoFrames: 8393, width: 960, height: 540, fps: 30, videoDuration: 279.766667, audioDuration: 279.829333,
  pixFmt: 'yuvj420p', colorRange: 'pc', audioCodec: 'aac', channels: 2,
  loudnessLUFS: -15.9, truePeakDbFS: -1.1,
  scanBoundary: 'blackdetect d=0.2,pix_th=0.1; freezedetect n=-50dB,d=2; silencedetect noise=-50dB,d=2',
  noEventsWithinScanThresholds: true, originalRunnerFailurePreserved: true, formalEnabled: false, userPreviewApproved: false};
const output = path.join(root, 'recovery-qa-evidence-check.v1.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, sha256: hashFile(output), status: result.status, checkedAt: result.checkedAt}, null, 2));
