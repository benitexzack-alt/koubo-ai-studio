import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {ROOT, hashFile} from './runner-core.mjs';

const episode = path.join(ROOT, 'edit/20260906_lanzhou_ai_services');
const oldVideo = path.join(episode, '07_预览与质检/candidate-preview-r1/render/with-sfx-960x540.mp4');
const output = path.join(episode, '07_预览与质检/candidate-preview-r2');
const newVideo = path.join(output, 'render/with-sfx-960x540.mp4');
const receipt = path.join(output, 'qa/protected-media-comparison.v1.json');
assert(!fs.existsSync(receipt), '不覆盖既有对照');
assert.equal(hashFile(oldVideo), '9d6342ac4456f362406e3b0b4da00eeeb09812265fae02cf203d01740e69d2e4');
assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'render/receipt.json'))).status, 'candidate-generated-pending-human-review');
const data = JSON.parse(fs.readFileSync(path.join(episode, '04_导演拆解/candidate-preview-r1/data.v1.json')));
const ranges = [{id: 'NEWS', from: 69, frames: 244}, ...data.papers.map(p => ({id: p.id, from: p.outputStartFrame, frames: p.durationInFrames}))];
const commands = [];
const ffmpeg = '/opt/homebrew/bin/ffmpeg';
function run(args) {
  const start = Date.now();
  const r = spawnSync(ffmpeg, args, {maxBuffer: 32 * 1024 * 1024, timeout: 120000});
  commands.push({executable: ffmpeg, args, exitCode: r.status, elapsedMs: Date.now() - start, stderr: r.stderr?.toString() ?? ''});
  assert.equal(r.status, 0, r.stderr?.toString());
  return r;
}
function audio(file, from, duration) {
  const r = run(['-v', 'error', '-ss', String(from), '-i', file, '-t', String(duration), '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', '-']);
  const a = new Float32Array(r.stdout.length / 4);
  for (let i = 0; i < a.length; i++) a[i] = r.stdout.readFloatLE(i * 4);
  return a;
}
const comparisons = [];
for (const range of ranges) {
  const start = range.from / 30;
  const duration = range.frames / 30;
  const filter = `[0:v]trim=end_frame=${range.frames},setpts=PTS-STARTPTS[a];[1:v]trim=end_frame=${range.frames},setpts=PTS-STARTPTS[b];[a][b]ssim`;
  const visual = run(['-hide_banner', '-nostats', '-ss', String(start), '-i', oldVideo, '-ss', String(start), '-i', newVideo,
    '-filter_complex', filter, '-t', String(duration), '-an', '-f', 'null', '-']);
  const ssim = Number(visual.stderr.toString().match(/SSIM .*All:([\d.]+)/)?.[1]);
  const a = audio(oldVideo, start, duration), b = audio(newVideo, start, duration);
  const n = Math.min(a.length, b.length);
  let aa = 0, bb = 0, ab = 0, error = 0;
  for (let i = 0; i < n; i++) {aa += a[i] ** 2; bb += b[i] ** 2; ab += a[i] * b[i]; error += (a[i] - b[i]) ** 2;}
  const correlation = ab / Math.sqrt(aa * bb);
  const relativeRmsError = Math.sqrt(error / aa);
  comparisons.push({...range, seconds: [start, start + duration], visual: {ssim, pass: Number.isFinite(ssim) && ssim >= .995},
    audio: {samples: n, sameSampleCount: a.length === b.length, correlation, relativeRmsError,
      gainDb: 10 * Math.log10(bb / aa), noTimeShiftApplied: true,
      pass: a.length === b.length && Number.isFinite(correlation) && correlation >= .999 && relativeRmsError <= .02}});
}
const report = {schemaVersion: 'lanzhou-r2-protected-output-comparison/v1', generatedAt: new Date().toISOString(),
  status: comparisons.every(c => c.visual.pass && c.audio.pass) ? 'protected-output-comparison-passed' : 'requires-review',
  oldVideo: {path: oldVideo, sha256: hashFile(oldVideo)}, newVideo: {path: newVideo, sha256: hashFile(newVideo)},
  comparisons, commands, sourceDefectsReclassifiedAsPass: false,
  evidenceScope: '对两版已输出文件的6个保护区间做全区间SSIM及同时间PCM对照；证明版本间一致性，不证明原有源动画语义正确或P03原声清晰可闻。',
  humanListeningPerformed: false, userPreviewApproved: false, formalEnabled: false};
fs.writeFileSync(receipt, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: report.status, receipt, comparisons}, null, 2));
