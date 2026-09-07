import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const dir = import.meta.dirname;
const repo = path.resolve(dir, '../../../..');
const base = 'edit/20260906_lanzhou_ai_services';
const videoPath = `${base}/07_预览与质检/candidate-preview-r1/render/with-sfx-960x540.mp4`;
const qaPath = `${base}/07_预览与质检/candidate-preview-r1/qa/candidate-machine-qa.v1.json`;
const imageDir = `${base}/07_预览与质检/candidate-preview-r1/qa/extra-shotcraft-frames`;
const expectedSha = '9d6342ac4456f362406e3b0b4da00eeeb09812265fae02cf203d01740e69d2e4';
const read = (p) => JSON.parse(fs.readFileSync(path.resolve(repo, p), 'utf8'));
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(repo, p))).digest('hex');
const bind = (p) => ({path: path.relative(repo, path.resolve(repo, p)), sha256: sha(p)});
const qa = read(qaPath);
assert.equal(qa.status, 'technical-checks-passed-user-review-required');
assert.equal(qa.video.sha256, expectedSha);
assert.equal(qa.checks.decodeExit, true);
assert.equal(sha(videoPath), expectedSha);
const selectionPath = path.join(dir, 'output-selection.derived.v2.json');
const selection = read(selectionPath);
const requested = [3140, 5055, 7200, 7745, 7970, 8260];
const checks = requested.map((frame) => {
  const beat = selection.beats.find((b) => b.decision === 'apply' && frame >= b.frames.startFrame && frame < b.frames.endFrameExclusive);
  assert(beat);
  return {beatId: beat.beatId, effectId: beat.effectId, frames: beat.frames, requestedFrame: frame,
    earlyFrame: beat.frames.startFrame + 3, representativeFrame: beat.beatId === 'output-c022' ? 3185 : frame};
});
const frames = [...new Set(checks.flatMap((c) => [c.earlyFrame, c.requestedFrame, c.representativeFrame]))].sort((a, b) => a - b);
assert.equal(frames.length, 13);
const receiptPath = path.join(dir, 'extra-shotcraft-extraction.v1.json');
assert(!fs.existsSync(receiptPath));
assert(!fs.existsSync(path.resolve(repo, imageDir)), '独立抽帧目录已存在，不覆盖');
fs.mkdirSync(path.resolve(repo, imageDir));
const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-threads', '2', '-i', path.resolve(repo, videoPath),
  '-map', '0:v:0', '-an', '-sn', '-dn', '-filter_threads', '1', '-vf', `select=${frames.map((f) => `eq(n\\,${f})`).join('+')}`,
  '-fps_mode', 'vfr', '-frames:v', String(frames.length), '-start_number', '0', '-compression_level', '2', '-threads', '1',
  path.resolve(repo, imageDir, 'selected-%03d.png')];
const startedAt = new Date().toISOString();
const result = spawnSync('ffmpeg', args, {cwd: repo, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024});
const images = [];
if (result.status === 0) {
  for (const [index, frame] of frames.entries()) {
    const temporary = path.resolve(repo, imageDir, `selected-${String(index).padStart(3, '0')}.png`);
    const destination = path.resolve(repo, imageDir, `frame-${String(frame).padStart(5, '0')}.png`);
    assert(!fs.existsSync(destination));
    fs.renameSync(temporary, destination);
    const bytes = fs.readFileSync(destination);
    assert.equal(bytes.readUInt32BE(16), 960);
    assert.equal(bytes.readUInt32BE(20), 540);
    images.push({...bind(destination), frame, seconds: frame / 30, width: 960, height: 540});
  }
}
assert.equal(sha(videoPath), expectedSha, '抽帧期间视频发生变化');
fs.writeFileSync(receiptPath, JSON.stringify({status: result.status === 0 ? 'exact-output-frames-extracted-not-yet-visually-reviewed' : 'extraction-failed',
  startedAt, finishedAt: new Date().toISOString(), video: bind(videoPath), machineQA: bind(qaPath), selection: bind(selectionPath),
  command: ['ffmpeg', ...args], exitCode: result.status, stderr: result.stderr, stdout: result.stdout, checks, images,
  extractionMethod: '单次完整解码，select按零起始解码帧号精确选择；无seek近似、无缩放或图像重绘。',
  authorization: '父任务已确认固定视频完整媒体QA通过；允许六项效果入场早帧与代表帧对照。',
  originalRunnerSuccessClaimed: false, applicationReceiptGenerated: false, formalAllowed: false}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({exitCode: result.status, images: images.length, receiptPath}, null, 2));
if (result.status !== 0) process.exitCode = result.status || 1;
