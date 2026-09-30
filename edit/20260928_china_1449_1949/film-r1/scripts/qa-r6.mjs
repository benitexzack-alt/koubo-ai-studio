import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const revision = process.argv[2] ?? 'b';
if (!/^[a-z0-9-]+$/.test(revision)) throw new Error('版本号不合法。');
const dir = path.join(root, 'exports', 'r6-' + revision);
const video = path.join(dir, '山河五百年_1449-1949_完整成片_R6.mp4');
const timeline = JSON.parse(await fs.readFile(path.join(root, 'data/timeline.json'), 'utf8'));
const beatData = JSON.parse(await fs.readFile(path.join(root, 'data/beats_R4.json'), 'utf8'));
const digest = async (file) => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
const originalMusic = timeline.meta.audioSource;
const projectMusic = path.join(root, 'public/audio/music.mp3');
const originalHash = await digest(originalMusic);
const projectHash = await digest(projectMusic);
const videoHash = await digest(video);
const optionalJson = async (name) => {
  try {return JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
};
const motionReview = await optionalJson('低运动复核.json');
const audioReview = await optionalJson('音轨复测.json');
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', video], {encoding: 'utf8'}));
const picture = probe.streams.find(s => s.codec_type === 'video');
const sound = probe.streams.find(s => s.codec_type === 'audio');
const decode = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-v', 'info', '-i', video, '-vf', 'blackdetect=d=0.1:pix_th=0.10:pic_th=0.99,freezedetect=n=-50dB:d=1', '-af', 'silencedetect=n=-60dB:d=0.5', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
if (decode.error) throw decode.error;
const log = decode.stderr ?? '';
await fs.writeFile(path.join(dir, '逐帧解码检查.log'), log);
const black = [...log.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)].map(m => ({start: +m[1], end: +m[2], duration: +m[3]}));
const freeze = [...log.matchAll(/lavfi\.freezedetect\.freeze_start: ([\d.]+)/g)].map(m => +m[1]);
const freezeEnds = [...log.matchAll(/lavfi\.freezedetect\.freeze_end: ([\d.]+)/g)].map(m => +m[1]);
const freezeCandidates = freeze.map((start, i) => ({start, end: freezeEnds[i] ?? null}));
const reviewedMotion = motionReview?.videoSha256 === videoHash ? motionReview.reviewedCandidates ?? [] : [];
const unreviewedFreeze = freezeCandidates.filter(candidate => !reviewedMotion.some(r =>
  candidate.end !== null && Math.abs(r.startSeconds - candidate.start) < .001 && Math.abs(r.endSeconds - candidate.end) < .001 &&
  r.classification === 'low-motion-camera-ease-out-not-duplicate-frames' && r.framesExamined >= 30 &&
  r.uniqueFrameHashes === r.framesExamined && r.duplicateFrames === 0 && r.adjacentDuplicateFrames === 0));
const silence = [...log.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map(m => ({end: +m[1], duration: +m[2], start: +m[1] - +m[2]}));
let end = 0;
const spans = timeline.scenes.map(scene => {
  if (scene.startFrame !== end || scene.durationFrames < 1) throw new Error('场景缺帧或重叠：' + scene.id);
  end += scene.durationFrames;
  const nearest = beatData.beats.reduce((best, b) => Math.abs(b.frame - scene.startFrame) < Math.abs(best.frame - scene.startFrame) ? b : best, beatData.beats[0]);
  return {id: scene.id, startFrame: scene.startFrame, endFrameExclusive: end, nearestBeatFrame: nearest.frame, deviationFrames: scene.id === 'H01' ? null : scene.startFrame - nearest.frame};
});
const checks = {
  originalMusicPreserved: originalHash === projectHash,
  videoDimensions: picture?.width === 1920 && picture?.height === 1080,
  videoFrameRate: picture?.r_frame_rate === '30/1',
  videoFrameCount: +picture?.nb_read_frames === 6497,
  timelineContinuous: end === 6497 && spans.length === 28,
  sceneBoundariesOnMeasuredBeats: spans.slice(1).every(s => s.deviationFrames === 0),
  audioPresent: sound?.codec_name === 'aac' && sound?.sample_rate === '48000',
  fullDecodeSucceeded: decode.status === 0,
  noUnexpectedFullBlack: black.every(b => b.end <= .4),
  noUnreviewedFreezeCandidates: unreviewedFreeze.length === 0,
  originalTrackSynchronization: audioReview?.videoSha256 === videoHash && audioReview.originalSha256 === originalHash && audioReview.samples?.length === 10 && audioReview.samples.every(s => Math.abs(s.lagSamples) <= 1),
};
const codePaths = ['src/index.tsx', 'src/HistoryFilmR6.tsx', 'src/motion/EarlyStoryMotion.tsx', 'src/motion/LateStoryMotion.tsx', 'data/timeline.json', 'render-r6.mjs'];
const sourceHashes = Object.fromEntries(await Promise.all(codePaths.map(async p => [p, await digest(path.join(root, p))])));
const report = {
  revision, generatedAt: new Date().toISOString(), video,
  status: Object.values(checks).every(Boolean) ? 'technical-checks-passed-human-review-pending' : 'technical-checks-need-review',
  checks, videoSha256: videoHash, bytes: (await fs.stat(video)).size,
  media: {video: picture, audio: sound, containerDurationSeconds: +probe.format.duration},
  music: {original: originalMusic, originalSha256: originalHash, projectSha256: projectHash, policy: 'original-track-direct-mux'},
  spans, black, freezeCandidates, unreviewedFreezeCandidates: unreviewedFreeze, silence,
  motionReview: reviewedMotion, audioReview,
  sourceHashes,
  reviewLimits: ['低频测拍并不等于人耳验收；关键动作完成点还需一倍速看听。', '历史画面为艺术复原，不是史料照片。', '静音记录需结合原曲自然停顿／淡出解释，不自动删除原曲。', '待用户完整观看确认，未授权公开发布。'],
};
await fs.writeFile(path.join(dir, '质量检查.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({status: report.status, checks, duration: report.media.containerDurationSeconds, black, freezeCandidates, unreviewedFreeze, silence, bytes: report.bytes}, null, 2));
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
