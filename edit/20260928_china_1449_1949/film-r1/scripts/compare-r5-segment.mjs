#!/usr/bin/env node
/**
 * Compare the exact global-frame window 3603–4213 of R4 with an R5 segment.
 * All visual scores below are machine proxies; normal-speed human review decides quality.
 *
 * Usage:
 *   node scripts/compare-r5-segment.mjs
 *   node scripts/compare-r5-segment.mjs --r5 /absolute/path/to/R5.mp4
 *   node scripts/compare-r5-segment.mjs --self  # R4 window against itself
 */
import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = 3603;
const END = 4213;
const FPS = 30;
const FRAMES = END - START + 1;
const SECONDS = FRAMES / FPS;
const W = 96;
const H = 54;
const PIXELS = W * H;
const AUDIO_RATE = 2000;
const defaultR4 = path.join(root, 'exports', '山河五百年_1449-1949_完整候选_R4.mp4');
const defaultR5 = path.join(root, 'verify', '山河五百年_1898至1912_R5_监制样段.mp4');
const defaultBeats = '/tmp/r4review/beats_R4.json';

function options(argv) {
  const out = {r4: defaultR4, r5: defaultR5, beats: defaultBeats, self: false};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--self') out.self = true;
    else if (key === '--help') {
      console.log('用法：node scripts/compare-r5-segment.mjs [--r4 路径] [--r5 路径] [--beats 路径] [--self]');
      process.exit(0);
    } else if (['--r4', '--r5', '--beats'].includes(key) && argv[i + 1]) {
      out[key.slice(2)] = path.resolve(argv[++i]);
    } else throw new Error(`未知或缺少参数：${key}`);
  }
  if (out.self) out.r5 = out.r4;
  return out;
}

async function command(binary, args, maxBuffer = 16 * 1024 * 1024) {
  try {
    const {stdout} = await run(binary, args, {encoding: 'buffer', maxBuffer});
    return stdout;
  } catch (error) {
    throw new Error(`${binary} 失败：${error.stderr?.toString().trim() || error.message}`);
  }
}

async function probe(file) {
  const raw = await command('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,avg_frame_rate,nb_frames,width,height', '-of', 'json', file]);
  const data = JSON.parse(raw.toString());
  const video = data.streams?.find((stream) => stream.codec_type === 'video');
  const audio = data.streams?.find((stream) => stream.codec_type === 'audio');
  if (!video) throw new Error(`没有视频轨：${file}`);
  const [num, den] = (video.avg_frame_rate ?? '0/1').split('/').map(Number);
  return {
    width: video.width,
    height: video.height,
    fps: num / den,
    frames: Number(video.nb_frames) || null,
    durationSeconds: Number(data.format?.duration) || null,
    hasAudio: Boolean(audio),
  };
}

async function decodeFrames(file, isR4Window) {
  const args = ['-hide_banner', '-loglevel', 'error'];
  if (isR4Window) args.push('-ss', String(START / FPS));
  args.push('-i', file, '-an', '-vf', `scale=${W}:${H}:flags=area,format=gray`, '-frames:v', String(FRAMES), '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1');
  const raw = await command('ffmpeg', args);
  if (raw.length !== PIXELS * FRAMES) {
    throw new Error(`解码帧数异常：${file} 得到 ${raw.length / PIXELS} 帧，预期 ${FRAMES} 帧`);
  }
  return raw;
}

async function decodeAudio(file, isR4Window) {
  const args = ['-hide_banner', '-loglevel', 'error'];
  if (isR4Window) args.push('-ss', String(START / FPS));
  args.push('-i', file, '-t', String(SECONDS), '-vn', '-ac', '1', '-ar', String(AUDIO_RATE), '-f', 's16le', 'pipe:1');
  const raw = await command('ffmpeg', args);
  const samples = new Float64Array(Math.floor(raw.length / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = raw.readInt16LE(i * 2) / 32768;
  return samples;
}

function percentile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[index];
}

function frameRuns(flags, minimum = 3) {
  const runs = [];
  for (let i = 0; i < flags.length;) {
    if (!flags[i]) { i++; continue; }
    let end = i;
    while (end + 1 < flags.length && flags[end + 1]) end++;
    if (end - i + 1 >= minimum) runs.push({localStart: i, localEnd: end, globalStart: START + i, frames: end - i + 1});
    i = end + 1;
  }
  return runs;
}

function analyzeFrames(raw) {
  const motion = new Float64Array(FRAMES);
  const changed = new Float64Array(FRAMES);
  const luma = new Float64Array(FRAMES);
  const black = new Array(FRAMES).fill(false);
  const white = new Array(FRAMES).fill(false);
  for (let frame = 0; frame < FRAMES; frame++) {
    const offset = frame * PIXELS;
    let luminance = 0;
    let difference = 0;
    let changedPixels = 0;
    let darkPixels = 0;
    let lightPixels = 0;
    for (let pixel = 0; pixel < PIXELS; pixel++) {
      const value = raw[offset + pixel];
      luminance += value;
      if (value < 16) darkPixels++;
      if (value > 239) lightPixels++;
      if (frame > 0) {
        const delta = Math.abs(value - raw[offset - PIXELS + pixel]);
        difference += delta;
        if (delta > 10) changedPixels++;
      }
    }
    luma[frame] = luminance / PIXELS;
    motion[frame] = difference / PIXELS;
    changed[frame] = changedPixels / PIXELS;
    black[frame] = luma[frame] < 8 && darkPixels / PIXELS > 0.95;
    white[frame] = luma[frame] > 247 && lightPixels / PIXELS > 0.95;
  }
  const events = [];
  const hardChanges = [];
  for (let frame = 1; frame < FRAMES - 1; frame++) {
    const neighborhood = motion.slice(Math.max(1, frame - 30), Math.min(FRAMES, frame + 30));
    const localMedian = percentile(neighborhood, 0.5);
    if (motion[frame] >= motion[frame - 1] && motion[frame] > motion[frame + 1]
        && motion[frame] > 3 * Math.max(localMedian, 0.3) && motion[frame] > 1.5) events.push(frame);
    if (motion[frame] >= 12 && changed[frame] >= 0.25) hardChanges.push(frame);
  }
  const interior = [...motion.slice(1)];
  return {
    eventFrames: events,
    hardChangeFrames: hardChanges,
    nearBlackRuns: frameRuns(black),
    nearWhiteRuns: frameRuns(white),
    medianFrameDelta: percentile(interior, 0.5),
    p90FrameDelta: percentile(interior, 0.9),
    slowFrameShare: interior.filter((delta) => delta < 0.6).length / interior.length,
    activeFrameShare: interior.filter((delta) => delta >= 1.5).length / interior.length,
    minMeanLuma: Math.min(...luma),
    maxMeanLuma: Math.max(...luma),
  };
}

function beatHits(analysis, absoluteAccents) {
  // Window edges have no preceding/following frames for a fair ±2 frame test.
  const local = absoluteAccents.map((accent) => Number(accent.frame) - START)
    .filter((frame) => Number.isFinite(frame) && frame >= 2 && frame <= FRAMES - 3);
  const hits = local.filter((accent) => analysis.eventFrames.some((event) => Math.abs(event - accent) <= 2));
  return {strongAccentsInWindow: local.length, visualEventsNearAccent: hits.length,
    hitRate: local.length ? hits.length / local.length : null};
}

function correlationAt(a, b, lag, from, to) {
  const first = Math.max(from, -lag, 0);
  const last = Math.min(to, a.length, b.length - lag);
  if (last - first < AUDIO_RATE / 2) return -1;
  let sumA = 0; let sumB = 0; let sumAA = 0; let sumBB = 0; let sumAB = 0;
  for (let i = first; i < last; i++) {
    const x = a[i]; const y = b[i + lag];
    sumA += x; sumB += y; sumAA += x * x; sumBB += y * y; sumAB += x * y;
  }
  const n = last - first;
  const numerator = sumAB - sumA * sumB / n;
  const denominator = Math.sqrt((sumAA - sumA * sumA / n) * (sumBB - sumB * sumB / n));
  return denominator > 0 ? numerator / denominator : -1;
}

function bestOffset(a, b, from, to) {
  let best = {lagSamples: 0, correlation: -1};
  for (let lag = -Math.round(AUDIO_RATE * 0.2); lag <= Math.round(AUDIO_RATE * 0.2); lag++) {
    const correlation = correlationAt(a, b, lag, from, to);
    if (correlation > best.correlation) best = {lagSamples: lag, correlation};
  }
  return {offsetMs: best.lagSamples * 1000 / AUDIO_RATE, correlation: best.correlation};
}

function audioRmsDbfs(samples) {
  const power = samples.reduce((sum, sample) => sum + sample * sample, 0) / Math.max(1, samples.length);
  return 20 * Math.log10(Math.sqrt(power) + 1e-12);
}

function compareAudio(r4, r5) {
  const n = Math.min(r4.length, r5.length);
  const headEnd = Math.min(n, AUDIO_RATE * 3);
  const tailStart = Math.max(0, n - AUDIO_RATE * 3);
  return {
    signConvention: '正偏移表示 R5 音乐晚于 R4；单位毫秒',
    overall: bestOffset(r4, r5, 0, n),
    firstThreeSeconds: bestOffset(r4, r5, 0, headEnd),
    lastThreeSeconds: bestOffset(r4, r5, tailStart, n),
    r4RmsDbfs: audioRmsDbfs(r4),
    r5RmsDbfs: audioRmsDbfs(r5),
  };
}

function compactVisual(analysis, hits) {
  return {
    medianFrameDelta: Number(analysis.medianFrameDelta.toFixed(3)),
    p90FrameDelta: Number(analysis.p90FrameDelta.toFixed(3)),
    slowFrameShare: Number(analysis.slowFrameShare.toFixed(3)),
    activeFrameShare: Number(analysis.activeFrameShare.toFixed(3)),
    visualEventCount: analysis.eventFrames.length,
    hardChangeCandidateGlobalFrames: analysis.hardChangeFrames.map((frame) => START + frame),
    nearBlackRuns: analysis.nearBlackRuns,
    nearWhiteRuns: analysis.nearWhiteRuns,
    ...hits,
  };
}

async function main() {
  const opts = options(process.argv.slice(2));
  for (const file of [opts.r4, opts.r5, opts.beats]) await fs.access(file);
  const [r4Probe, r5Probe, beatData] = await Promise.all([
    probe(opts.r4), probe(opts.r5), fs.readFile(opts.beats, 'utf8').then(JSON.parse),
  ]);
  if (r4Probe.fps !== FPS || (r4Probe.frames && r4Probe.frames <= END)) throw new Error('R4 全片不包含指定的 3603—4213 帧 30fps 窗口。');
  if (beatData.fps !== FPS || !Array.isArray(beatData.strongAccents)) throw new Error('强重音数据格式或 30fps 时间基不符。');
  const structuralFlags = [];
  if (!opts.self) {
    if (r5Probe.width !== 1920 || r5Probe.height !== 1080) structuralFlags.push('R5 不是 1920×1080');
    if (r5Probe.fps !== FPS) structuralFlags.push('R5 不是 30fps');
    if (r5Probe.frames !== FRAMES) structuralFlags.push(`R5 帧数为 ${r5Probe.frames ?? '未知'}，预期 ${FRAMES}`);
  }
  if (!r5Probe.hasAudio) structuralFlags.push('R5 没有音频轨');
  const r4Frames = await decodeFrames(opts.r4, true);
  const r5Frames = await decodeFrames(opts.r5, opts.self);
  const r4Analysis = analyzeFrames(r4Frames);
  const r5Analysis = analyzeFrames(r5Frames);
  const r4Audio = r4Probe.hasAudio ? await decodeAudio(opts.r4, true) : null;
  const r5Audio = r5Probe.hasAudio ? await decodeAudio(opts.r5, opts.self) : null;
  const audio = r4Audio && r5Audio ? compareAudio(r4Audio, r5Audio) : null;
  if (audio && (Math.abs(audio.overall.offsetMs) > 1000 / FPS || audio.overall.correlation < 0.9)) {
    structuralFlags.push('音轨相对 R4 可能错位或内容不同，需正常速度试听');
  }
  if (r5Analysis.nearBlackRuns.length > r4Analysis.nearBlackRuns.length
      || r5Analysis.nearWhiteRuns.length > r4Analysis.nearWhiteRuns.length) {
    structuralFlags.push('R5 新增连续近黑／近白帧，需检查是否是设计意图');
  }
  const r4Hits = beatHits(r4Analysis, beatData.strongAccents);
  const r5Hits = beatHits(r5Analysis, beatData.strongAccents);
  const report = {
    window: {globalStartFrame: START, globalEndFrame: END, localFrames: FRAMES, fps: FPS, startSeconds: START / FPS, durationSeconds: SECONDS},
    source: {r4: opts.r4, r5: opts.r5, selfCheck: opts.self},
    media: {r4: r4Probe, r5: r5Probe},
    metricDefinitions: {
      visualEvent: '96×54 灰度帧差局部峰值：高于邻域中位数 3 倍且帧差 >1.5；只是切换／动作候选',
      hardChangeCandidate: '平均帧差 ≥12 且超过 10 灰度的像素占比 ≥25%；不是镜头语义判断',
      slowFrame: '平均帧差 <0.6；无法识别有意留白或细腻动作',
      accentHit: 'R4 音轨强重音全局帧减 3603 后，视觉事件落在 ±2 帧内；排除窗口两端各 2 帧',
      nearBlackOrWhite: '连续至少 3 帧，95% 像素分别 <16 或 >239，且全帧均值分别 <8 或 >247',
    },
    visualMachineProxy: {r4: compactVisual(r4Analysis, r4Hits), r5: compactVisual(r5Analysis, r5Hits),
      medianMotionRatioR5ToR4: Number((r5Analysis.medianFrameDelta / Math.max(r4Analysis.medianFrameDelta, 1e-9)).toFixed(2))},
    audioSync: audio,
    structuralFlags,
    interpretation: '画面差分、候选切点与 ±2 帧强重音命中率只是机器代理指标；历史准确性、构图、文字停留和音乐情绪必须由监制在正常速度完整观看后判断。',
  };
  console.log(JSON.stringify(report, null, 2));
  if (structuralFlags.length) process.exitCode = 2;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
