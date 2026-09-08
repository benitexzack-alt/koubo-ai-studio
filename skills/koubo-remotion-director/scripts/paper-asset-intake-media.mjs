import {spawnSync} from 'node:child_process';
import {existsSync, realpathSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {sha256File} from './preproduction-director-core.mjs';

export function paperMediaTools(names = ['ffmpeg', 'ffprobe']) {
  return Object.fromEntries(names.map(name => {
    const found = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'].map(dir => path.join(dir, name)).find(existsSync);
    if (!found) throw new Error(`PAPER_MEDIA_TOOL_MISSING:${name}`);
    const file = realpathSync(found);
    return [name, {path: file, sha256: sha256File(file)}];
  }));
}

export function runPaperMediaTool(tool, args, {out, name, timeout = 120000} = {}) {
  if (sha256File(tool.path) !== tool.sha256) throw new Error('PAPER_MEDIA_TOOL_CHANGED');
  const result = spawnSync(tool.path, args, {encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024,
    env: {PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME ?? '', LANG: 'en_US.UTF-8'},
    stdio: ['ignore', 'pipe', 'pipe']});
  let commandReceipt;
  if (out) {
    const save = (suffix, text) => {
      const file = path.join(out, `${name}.${suffix}`);
      writeFileSync(file, text, {flag: 'wx'});
      return {path: file, sha256: sha256File(file)};
    };
    const stdout = save('stdout.txt', result.stdout ?? '');
    const stderr = save('stderr.txt', result.stderr ?? '');
    commandReceipt = save('command.json', JSON.stringify({tool, args, exitCode: result.status,
      signal: result.signal, error: result.error?.message ?? null, stdout, stderr}));
  }
  if (result.status !== 0 || result.error) throw new Error(`PAPER_MEDIA_COMMAND_FAILED:${name ?? path.basename(tool.path)}:${result.error?.message ?? result.stderr}`);
  return {stdout: result.stdout, commandReceipt};
}

export function probePaperVideo(videoPath, tools, options = {}) {
  const result = runPaperMediaTool(tools.ffprobe, ['-v', 'error', '-select_streams', 'v', '-count_frames',
    '-show_streams', '-show_frames', '-show_entries',
    'stream=codec_type,width,height,r_frame_rate,avg_frame_rate,nb_read_frames,codec_name,pix_fmt:frame=best_effort_timestamp_time,width,height',
    '-of', 'json', videoPath], {...options, name: 'probe'});
  const probe = JSON.parse(result.stdout);
  if (probe.streams?.length !== 1) throw new Error('PAPER_MEDIA_VIDEO_STREAM_COUNT_INVALID');
  const stream = probe.streams[0];
  const rate = /^(\d+)\/(\d+)$/u.exec(stream.avg_frame_rate ?? '');
  const frameCount = Number(stream.nb_read_frames);
  const fpsNumerator = Number(rate?.[1]);
  const fpsDenominator = Number(rate?.[2]);
  if (!rate || fpsNumerator <= 0 || fpsDenominator <= 0 || stream.r_frame_rate !== stream.avg_frame_rate ||
    !Number.isSafeInteger(frameCount) || frameCount < 3 || probe.frames?.length !== frameCount ||
    !Number.isSafeInteger(stream.width) || !Number.isSafeInteger(stream.height) || stream.width <= 0 || stream.height <= 0) throw new Error('PAPER_MEDIA_PROBE_INVALID');
  const step = fpsDenominator / fpsNumerator;
  const firstTime = Number(probe.frames[0].best_effort_timestamp_time);
  if (!Number.isFinite(firstTime) || probe.frames.some((frame, index) => !Number.isFinite(Number(frame.best_effort_timestamp_time)) ||
    Math.abs(Number(frame.best_effort_timestamp_time) - firstTime - index * step) > 0.0001 ||
    frame.width !== stream.width || frame.height !== stream.height)) throw new Error('PAPER_MEDIA_VFR_OR_DIMENSION_CHANGE_UNSUPPORTED');
  return {probe, media: {frameCount, fpsNumerator, fpsDenominator, width: stream.width, height: stream.height}, commandReceipt: result.commandReceipt};
}

export const paperFrameSelect = indices => `select=${indices.map(index => `eq(n\\,${index})`).join('+')}`;

const frameHashes = text => text.split(/\r?\n/u).filter(line => line.trim() && !line.startsWith('#'))
  .map(line => line.split(',').at(-1).trim());

// Re-decode the actual source and PNG pixels. Receipt JSON is not an execution proof.
export function verifyPaperSourceFrames({videoPath, videoSha256, frames, expectedMedia, tools = paperMediaTools()}) {
  if (!statSync(videoPath).isFile() || sha256File(videoPath) !== videoSha256) throw new Error('PAPER_SOURCE_VIDEO_SHA_MISMATCH');
  const {media} = probePaperVideo(videoPath, tools);
  for (const key of ['frameCount', 'fpsNumerator', 'fpsDenominator', 'width', 'height']) {
    if (media[key] !== expectedMedia?.[key]) throw new Error(`PAPER_SOURCE_PROBE_MISMATCH:${key}`);
  }
  const sorted = [...frames].sort((a, b) => a.frameIndex - b.frameIndex);
  const indices = sorted.map(frame => frame.frameIndex);
  if (!indices.length || new Set(indices).size !== indices.length || indices.some(index => !Number.isSafeInteger(index) || index < 0 || index >= media.frameCount)) throw new Error('PAPER_SOURCE_FRAME_INDICES_INVALID');
  const result = runPaperMediaTool(tools.ffmpeg, ['-nostdin', '-v', 'error', '-xerror', '-i', videoPath,
    '-map', '0:v:0', '-vf', `${paperFrameSelect(indices)},format=rgb24`, '-an', '-fps_mode', 'passthrough',
    '-f', 'framehash', '-hash', 'sha256', '-']);
  const hashes = frameHashes(result.stdout);
  if (hashes.length !== sorted.length) throw new Error('PAPER_SOURCE_DECODED_FRAME_COUNT_MISMATCH');
  const verified = [];
  for (const [index, frame] of sorted.entries()) {
    if (sha256File(frame.path) !== frame.sha256) throw new Error(`PAPER_SOURCE_IMAGE_SHA_MISMATCH:${frame.frameIndex}`);
    const image = runPaperMediaTool(tools.ffmpeg, ['-nostdin', '-v', 'error', '-xerror', '-i', frame.path,
      '-vf', 'format=rgb24', '-frames:v', '1', '-f', 'framehash', '-hash', 'sha256', '-']);
    const imageHashes = frameHashes(image.stdout);
    const dimensions = /^#dimensions\s+0:\s+(\d+)x(\d+)$/mu.exec(image.stdout);
    if (Number(dimensions?.[1]) !== media.width || Number(dimensions?.[2]) !== media.height) throw new Error(`PAPER_SOURCE_FRAME_DIMENSIONS_MISMATCH:${frame.frameIndex}`);
    if (imageHashes.length !== 1 || imageHashes[0] !== hashes[index]) throw new Error(`PAPER_SOURCE_FRAME_PIXEL_MISMATCH:${frame.frameIndex}`);
    verified.push({frameIndex: frame.frameIndex, imageSha256: frame.sha256, rgb24Sha256: hashes[index]});
  }
  // Audio and video decode errors must not be hidden behind a receipt boolean.
  runPaperMediaTool(tools.ffmpeg, ['-nostdin', '-v', 'error', '-xerror', '-i', videoPath,
    '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-']);
  if (sha256File(videoPath) !== videoSha256 || sorted.some(frame => sha256File(frame.path) !== frame.sha256)) throw new Error('PAPER_SOURCE_CHANGED_DURING_VERIFICATION');
  return {status: 'source-frame-pixels-and-full-decode-verified', videoSha256, media, frames: verified, tools,
    semanticAcceptancePerformed: false, ocrRecognitionIndependentlyRepeated: false};
}
