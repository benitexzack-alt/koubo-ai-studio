import {readFileSync, writeFileSync, mkdirSync, createReadStream, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve, relative} from 'node:path';

const root = process.cwd();
const base = 'edit/20260904_gpt6_cybercab';
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const job = read('workflow/jobs/20260904_gpt6_cybercab_v80.production.json');
const plan = read('remotion/src/gpt6-cybercab-v8-r1/candidate-plan.v1.json');
const run = read(job.reports.runManifest);
const output = resolve(root, job.formal.finalOutput);
if (run.status !== 'passed' || run.formalQa?.status !== 'passed') throw new Error('正式渲染与完整解码尚未通过');
const dir = resolve(root, `${base}/08_预览与质检/formal-r1/final-output-audit`);
mkdirSync(dir, {recursive: true});
const framesDir = resolve(dir, 'frames');
mkdirSync(framesDir, {recursive: true});
const packageDir = resolve(root, `${base}/10_发布包`);
const sha = async path => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
};
const command = (bin, args, name) => {
  const result = spawnSync(bin, args, {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
  writeFileSync(resolve(dir, `${name}.log`), result.stderr ?? '');
  if (result.status !== 0) throw new Error(`${name}: ${result.stderr}`);
  return result;
};
const probe = JSON.parse(command('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', output], 'ffprobe').stdout);
const video = probe.streams.find(stream => stream.codec_type === 'video');
const audio = probe.streams.find(stream => stream.codec_type === 'audio');
const errors = [];
if (video.width !== 1920 || video.height !== 1080 || video.avg_frame_rate !== '30/1' || Number(video.nb_read_frames) !== 7830 || video.codec_name !== 'h264' || video.pix_fmt !== 'yuv420p') errors.push('视频规格不符合锁定版本');
if (audio.codec_name !== 'aac' || audio.channels !== 2 || Number(audio.sample_rate) !== 48000) errors.push('音频规格不符合锁定版本');
if (Math.abs(Number(probe.format.duration) - 261) > 0.1) errors.push('时长偏差');
const signals = command('ffmpeg', ['-hide_banner', '-nostats', '-i', output, '-vf', 'freezedetect=n=0.002:d=2', '-af', 'silencedetect=n=-50dB:d=2', '-f', 'null', '-'], 'freeze-silence');
const signalEvents = signals.stderr.split('\n').filter(line => /freeze_(start|duration|end)|silence_(start|duration|end)/.test(line));
const outputSha = await sha(output);
if (outputSha !== run.formalQa.sha256) errors.push('成片哈希与受控质检不一致');
const frames = [];
for (const [index, scene] of plan.scenes.entries()) {
  const frame = Math.min(7829, Math.round((scene.start + Math.min(1, (scene.end - scene.start) / 2)) * 30));
  const path = resolve(framesDir, `${String(index + 1).padStart(2, '0')}-${scene.id}-${frame}.png`);
  command('ffmpeg', ['-v', 'error', '-ss', String(frame / 30), '-i', output, '-frames:v', '1', '-y', path], `frame-${scene.id}`);
  frames.push({sceneId: scene.id, kind: scene.kind, frame, timeSeconds: frame / 30, path: relative(root, path), sha256: await sha(path)});
}
command('ffmpeg', ['-v', 'error', '-pattern_type', 'glob', '-i', `${framesDir}/*.png`, '-vf', 'scale=480:270,tile=4x11:padding=6:margin=6:color=white', '-frames:v', '1', '-y', resolve(dir, '正式成片联系表.jpg')], 'contact-sheet');
const coverFrame = resolve(packageDir, '封面人物帧_正式片_212.267秒.png');
command('ffmpeg', ['-v', 'error', '-ss', String(6368 / 30), '-i', output, '-frames:v', '1', '-y', coverFrame], 'cover-frame');
const paper = plan.scenes.filter(scene => scene.kind === 'paper').map(scene => {
  const track = plan.mediaAudio.find(item => item.asset === scene.asset);
  if (!track || track.volume <= 0 || track.durationFrames !== 219) errors.push(`${scene.id}原声绑定异常`);
  return {id: scene.id, title: scene.title, startSeconds: scene.start, endSeconds: scene.end, labels: scene.items, audio: track};
});
if (paper.length !== 6) errors.push('纸艺素材不为六段');
for (let index = 1; index < plan.scenes.length; index++) {
  if (Math.round(plan.scenes[index].start * 30) !== Math.round(plan.scenes[index - 1].end * 30)) errors.push(`场景不连续:${index}`);
}
const receipt = {
  schemaVersion: 1, createdAt: new Date().toISOString(), jobId: job.jobId,
  status: errors.length ? 'failed' : 'machine-checked-awaiting-visual-review',
  output: {path: job.formal.finalOutput, sha256: outputSha, sizeBytes: statSync(output).size, video, audio, durationSeconds: Number(probe.format.duration)},
  controlledRender: {path: job.reports.runManifest, sha256: await sha(resolve(root, job.reports.runManifest)), result: run.formalQa},
  checks: {fullDecode: 'passed-by-controlled-runner', frameCount: Number(video.nb_read_frames), blackIntervals: run.formalQa.blackFrameCount, signalEvents, paperCount: paper.length, semanticContinuity: errors.filter(item => item.startsWith('场景')).length === 0, sfxCueCount: plan.sfxCues.length},
  paper, frameEvidence: frames,
  recommendedCoverFrame: {path: relative(root, coverFrame), sha256: await sha(coverFrame), sourceVideo: job.formal.finalOutput, sourceSha256: outputSha, sourceTimeSeconds: 6368 / 30, sourceType: 'current-final-video-real-frame'},
  knownLimitations: read(`${base}/00_工程控制/spoken-source-policy.v1.json`).knownLimitations,
  humanFullWatchConfirmed: false, humanAudioReviewCompleted: false, published: false, errors,
};
writeFileSync(resolve(dir, '正式成片机器质检回执.v1.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({status: receipt.status, output: receipt.output.path, sha256: outputSha, signalEvents, errors, receipt: relative(root, resolve(dir, '正式成片机器质检回执.v1.json'))}, null, 2));
if (errors.length) process.exitCode = 1;
