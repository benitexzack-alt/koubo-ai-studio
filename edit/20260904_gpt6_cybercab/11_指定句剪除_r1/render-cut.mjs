import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(dir, '../01_口播原片/R01_口播原片.MOV');
const output = path.join(dir, '01_口播原片_仅剪除没有人负责_r1.mp4');
const preview = path.join(dir, '02_剪口检查_有声.mp4');
const expectedSourceHash = '403e295fd1eb73769fe9b3c64000179f5c1b791f016a621afeaa69aa7859ebde';
const fps = 30;
const sourceFrames = 7858;
const cutStartFrame = 3538;
const cutEndFrame = 3566;
const outputFrames = sourceFrames - (cutEndFrame - cutStartFrame);
const duration = outputFrames / fps;
const sampleRate = 44100;
const join = cutStartFrame / fps;
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const save = (name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
function run(command, args, logName) {
  const fd = fs.openSync(path.join(dir, logName), 'wx');
  const result = spawnSync(command, args, {stdio: ['ignore', fd, fd]});
  fs.closeSync(fd);
  if (result.error || result.status !== 0) throw result.error || new Error(`${command}: exit ${result.status}; ${logName}`);
}
function probe(p) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', p], {encoding: 'utf8'});
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}
if (hash(source) !== expectedSourceHash) throw new Error('SOURCE_HASH_MISMATCH');
if (fs.existsSync(output) || fs.existsSync(preview)) throw new Error('OUTPUT_EXISTS_NO_OVERWRITE');
const edl = {
  schema: 'authorized-phrase-removal-v1',
  authorization: '把没有人负责的这一段原视频剪裁掉',
  source, sourceSha256: expectedSourceHash, sourceFrames, fps,
  remove: {text: '没有人负责', startFrameInclusive: cutStartFrame, endFrameExclusive: cutEndFrame, startSeconds: join, endSeconds: cutEndFrame / fps, durationSeconds: (cutEndFrame - cutStartFrame) / fps},
  keep: [{sourceStartFrame: 0, sourceEndFrameExclusive: cutStartFrame, outputStartFrame: 0}, {sourceStartFrame: cutEndFrame, sourceEndFrameExclusive: sourceFrames, outputStartFrame: cutStartFrame}],
  preservedAdjacentSpeech: ['没有人驾驶', '没有人干预', '眼睛是摄像头'],
  expectedOutputFrames: outputFrames, expectedOutputDuration: duration,
  audio: {sampleRate, stereo: true, cutStartSample: cutStartFrame * sampleRate / fps, cutEndSample: cutEndFrame * sampleRate / fps, joinDeclickFadeSecondsPerSide: 0.003, endPaddingMaximumSeconds: 0.014, otherGainChange: false},
  scope: '原片指定句剪除副本，非正式包装成片；其他内容不改；不替代事实审阅和用户验收',
};
save('cut-edl.v1.json', edl);
const filter = [
  `[0:v]split=2[v0][v1]`,
  `[v0]trim=end_frame=${cutStartFrame},setpts=N/(30*TB)[va]`,
  `[v1]trim=start_frame=${cutEndFrame}:end_frame=${sourceFrames},setpts=N/(30*TB)[vb]`,
  '[va][vb]concat=n=2:v=1:a=0[v]',
  '[0:a]asplit=2[a0][a1]',
  `[a0]atrim=end_sample=${cutStartFrame * 1470},asetpts=PTS-STARTPTS,afade=t=out:st=${join - 0.003}:d=0.003[aa]`,
  `[a1]atrim=start_sample=${cutEndFrame * 1470},asetpts=PTS-STARTPTS,afade=t=in:d=0.003[ab]`,
  `[aa][ab]concat=n=2:v=0:a=1,apad,atrim=end_sample=${duration * sampleRate}[a]`,
].join(';');
run('ffmpeg', ['-hide_banner', '-n', '-i', source, '-filter_complex', filter, '-map', '[v]', '-map', '[a]', '-map_metadata', '-1', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30', '-fps_mode', 'cfr', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'aac', '-b:a', '320k', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', output], 'render.log');
run('ffmpeg', ['-hide_banner', '-v', 'error', '-xerror', '-i', output, '-map', '0:v', '-map', '0:a', '-f', 'null', '-'], 'full-decode.log');
const media = probe(output);
const video = media.streams.find(s => s.codec_type === 'video');
const audio = media.streams.find(s => s.codec_type === 'audio');
if (Number(video.nb_frames) !== outputFrames || video.width !== 1920 || video.height !== 1080 || video.r_frame_rate !== '30/1' || video.codec_name !== 'h264' || video.pix_fmt !== 'yuv420p' || audio.codec_name !== 'aac' || audio.channels !== 2 || Math.abs(Number(media.format.duration) - duration) > 0.034) throw new Error('OUTPUT_MEDIA_CHECK_FAILED');
run('ffmpeg', ['-hide_banner', '-v', 'error', '-n', '-ss', String(join - 4), '-i', output, '-t', '10', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', preview], 'preview-render.log');
run('ffmpeg', ['-hide_banner', '-v', 'error', '-xerror', '-i', preview, '-f', 'null', '-'], 'preview-decode.log');
run('ffmpeg', ['-hide_banner', '-v', 'error', '-n', '-i', preview, '-vn', '-ar', '16000', '-ac', '1', path.join(dir, '核验_成片剪口.wav')], 'preview-audio.log');
if (hash(source) !== expectedSourceHash) throw new Error('SOURCE_CHANGED');
save('media-qa.v1.json', {createdAt: new Date().toISOString(), scope: edl.scope, sourceUnchanged: true, edlSha256: hash(path.join(dir, 'cut-edl.v1.json')), output: {path: output, sha256: hash(output), media, fullDecodeExit: 0}, preview: {path: preview, sha256: hash(preview), sourceOutputStartSeconds: join - 4, joinAtSeconds: 4, media: probe(preview), fullDecodeExit: 0}, status: 'technical-check-passed-awaiting-join-review', humanListeningClaimed: false, formalRender: false, published: false});
console.log(JSON.stringify({output, preview, outputFrames, duration, sha256: hash(output)}));
