#!/usr/bin/env node
/**
 * Compare the exact global-frame window 3602–4230 of R4 with an R5 segment.
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
const m1Path = path.join(root, 'data', 'm1.json');
const m1 = JSON.parse(await fs.readFile(m1Path, 'utf8'));
const START = m1.range.qaStart;
const END = m1.range.qaEnd;
const FPS = 30;
const FRAMES = END - START + 1;
const SECONDS = FRAMES / FPS;
const W = 96;
const H = 54;
const PIXELS = W * H;
const BLOCK_COLS = 12;
const BLOCK_ROWS = 6;
const BLOCK_W = W / BLOCK_COLS;
const BLOCK_H = H / BLOCK_ROWS;
const AUDIO_RATE = 2000;
const defaultR4 = path.join(root, 'exports', '山河五百年_1449-1949_完整候选_R4.mp4');
const defaultR5 = path.join(root, 'verify', '山河五百年_1898至1912_R5_监制样段.mp4');
const defaultBeats = path.join(root, 'data', 'beats_R4.json');

if (START !== 3602 || END !== 4230 || FRAMES !== 629) throw new Error('M1 验收窗口不是已锁定的 3602—4230／629 帧。');
if (!Array.isArray(m1.qaCueFrames) || m1.qaCueFrames.length !== 27
    || m1.qaCueFrames.some((frame) => !Number.isInteger(frame) || frame < m1.range.start || frame > m1.range.end)) {
  throw new Error('data/m1.json 的 27 个验收 cue 缺失或越界。');
}

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

async function decodeSeamFrame(file, globalFrame, isR4Window) {
  const seconds = isR4Window ? globalFrame / FPS : (globalFrame - START) / FPS;
  const raw = await command('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-ss', String(seconds), '-i', file, '-an',
    '-vf', 'scale=480:270:flags=area,format=gray', '-frames:v', '1',
    '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1',
  ]);
  if (raw.length !== 480 * 270) throw new Error(`接缝帧 f${globalFrame} 解码失败：${file}`);
  return raw;
}

async function decodeAudio(file, isR4Window, sampleRate = AUDIO_RATE) {
  const args = ['-hide_banner', '-loglevel', 'error'];
  if (isR4Window) args.push('-ss', String(START / FPS));
  args.push('-i', file, '-t', String(SECONDS), '-vn', '-ac', '1', '-ar', String(sampleRate), '-f', 's16le', 'pipe:1');
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

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
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
  const structureDiff = new Float64Array(FRAMES);
  const maxBlockDiff = new Float64Array(FRAMES);
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
  for (let frame = 1; frame < FRAMES; frame++) {
    const offset = frame * PIXELS;
    const brightnessChange = luma[frame] - luma[frame - 1];
    const blocks = new Float64Array(BLOCK_COLS * BLOCK_ROWS);
    let total = 0;
    for (let row = 0; row < H; row++) {
      for (let column = 0; column < W; column++) {
        const pixel = row * W + column;
        const centeredDelta = Math.abs(raw[offset + pixel] - raw[offset - PIXELS + pixel] - brightnessChange);
        total += centeredDelta;
        const block = Math.floor(row / BLOCK_H) * BLOCK_COLS + Math.floor(column / BLOCK_W);
        blocks[block] += centeredDelta;
      }
    }
    structureDiff[frame] = total / PIXELS;
    maxBlockDiff[frame] = Math.max(...blocks) / (BLOCK_W * BLOCK_H);
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
    motion,
    structureDiff,
    maxBlockDiff,
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

function cueHitAt(analysis, localFrame) {
  const baseStart = Math.max(0, localFrame - 8);
  const baseEnd = Math.max(1, localFrame - 1);
  const structureBaseline = median(analysis.structureDiff.slice(baseStart, baseEnd));
  const blockBaseline = median(analysis.maxBlockDiff.slice(baseStart, baseEnd));
  const peakStart = Math.max(0, localFrame - 1);
  const peakEnd = Math.min(FRAMES, localFrame + 2);
  const structurePeak = Math.max(...analysis.structureDiff.slice(peakStart, peakEnd));
  const blockPeak = Math.max(...analysis.maxBlockDiff.slice(peakStart, peakEnd));
  return {hit: structurePeak >= Math.max(1, 2 * structureBaseline)
      || blockPeak >= Math.max(4, 2 * blockBaseline),
    structurePeak: Number(structurePeak.toFixed(2)), blockPeak: Number(blockPeak.toFixed(2))};
}

function qaBeatHits(analysis, absoluteAccents) {
  const cueDetails = m1.qaCueFrames.map((frame) => ({frame, ...cueHitAt(analysis, frame - START)}));
  const onBeatFrames = absoluteAccents.filter((accent) => accent.onBeat
      && accent.frame >= START + 8 && accent.frame < m1.range.handoffStart).map((accent) => accent.frame);
  const accentHits = onBeatFrames.filter((frame) => {
    const local = frame - START;
    return [local - 1, local, local + 1].some((candidate) => cueHitAt(analysis, candidate).hit);
  });
  const interiorStart = m1.range.start + 1 - START;
  const interiorEnd = m1.range.end + 1 - START;
  let longestNearStatic = 0;
  let currentNearStatic = 0;
  for (const delta of analysis.motion.slice(interiorStart, interiorEnd)) {
    currentNearStatic = delta < 0.6 ? currentNearStatic + 1 : 0;
    longestNearStatic = Math.max(longestNearStatic, currentNearStatic);
  }
  return {
    cueHits: cueDetails.filter((cue) => cue.hit).length,
    cueTotal: cueDetails.length,
    missedCueFrames: cueDetails.filter((cue) => !cue.hit).map((cue) => cue.frame),
    cueDetails,
    onBeatAccentHits: accentHits.length,
    onBeatAccentTotal: onBeatFrames.length,
    onBeatAccentHitRate: onBeatFrames.length ? accentHits.length / onBeatFrames.length : null,
    longestNearStaticFrames: longestNearStatic,
  };
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

function refinedAudioAlignment(r4, r5, coarseOffsetMs) {
  const rate = 48000;
  const center = Math.round(coarseOffsetMs * rate / 1000);
  let bestLag = center;
  let bestCorrelation = -1;
  for (let lag = center - 24; lag <= center + 24; lag++) {
    const correlation = correlationAt(r4, r5, lag, 0, Math.min(r4.length, r5.length));
    if (correlation > bestCorrelation) { bestCorrelation = correlation; bestLag = lag; }
  }
  const first = Math.max(0, -bestLag);
  const last = Math.min(r4.length, r5.length - bestLag);
  let residualPower = 0;
  let referencePower = 0;
  for (let i = first; i < last; i++) {
    const difference = r5[i + bestLag] - r4[i];
    residualPower += difference * difference;
    referencePower += r4[i] * r4[i];
  }
  return {offsetMs: bestLag * 1000 / rate, correlation: bestCorrelation,
    residualDb: 10 * Math.log10(residualPower / (referencePower + 1e-12) + 1e-12)};
}

function compareAudio(r4, r5, r4High, r5High) {
  const n = Math.min(r4.length, r5.length);
  const headEnd = Math.min(n, AUDIO_RATE * 3);
  const tailStart = Math.max(0, n - AUDIO_RATE * 3);
  const overall = bestOffset(r4, r5, 0, n);
  return {
    signConvention: '正偏移表示 R5 音乐晚于 R4；单位毫秒',
    overall,
    firstThreeSeconds: bestOffset(r4, r5, 0, headEnd),
    lastThreeSeconds: bestOffset(r4, r5, tailStart, n),
    precise48k: refinedAudioAlignment(r4High, r5High, overall.offsetMs),
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
    qaCueHits: hits.cueHits,
    qaCueTotal: hits.cueTotal,
    missedQaCueFrames: hits.missedCueFrames,
    onBeatAccentHits: hits.onBeatAccentHits,
    onBeatAccentTotal: hits.onBeatAccentTotal,
    onBeatAccentHitRate: hits.onBeatAccentHitRate,
    longestNearStaticFrames: hits.longestNearStaticFrames,
  };
}

async function main() {
  const opts = options(process.argv.slice(2));
  for (const file of [opts.r4, opts.r5, opts.beats]) await fs.access(file);
  const [r4Probe, r5Probe, beatData] = await Promise.all([
    probe(opts.r4), probe(opts.r5), fs.readFile(opts.beats, 'utf8').then(JSON.parse),
  ]);
  if (r4Probe.fps !== FPS || (r4Probe.frames && r4Probe.frames <= END)) throw new Error('R4 全片不包含指定的 3602—4230 帧 30fps 窗口。');
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
  const [r4Audio, r5Audio, r4Audio48k, r5Audio48k] = await Promise.all([
    r4Probe.hasAudio ? decodeAudio(opts.r4, true) : null,
    r5Probe.hasAudio ? decodeAudio(opts.r5, opts.self) : null,
    r4Probe.hasAudio ? decodeAudio(opts.r4, true, 48000) : null,
    r5Probe.hasAudio ? decodeAudio(opts.r5, opts.self, 48000) : null,
  ]);
  const audio = r4Audio && r5Audio ? compareAudio(r4Audio, r5Audio, r4Audio48k, r5Audio48k) : null;
  if (r5Analysis.nearBlackRuns.length > r4Analysis.nearBlackRuns.length
      || r5Analysis.nearWhiteRuns.length > r4Analysis.nearWhiteRuns.length) {
    structuralFlags.push('R5 新增连续近黑／近白帧，需检查是否是设计意图');
  }
  const [r4SeamStart, r4SeamEnd, r5SeamStart, r5SeamEnd] = await Promise.all([
    decodeSeamFrame(opts.r4, START, true), decodeSeamFrame(opts.r4, END, true),
    decodeSeamFrame(opts.r5, START, opts.self), decodeSeamFrame(opts.r5, END, opts.self),
  ]);
  const meanFrameError = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum / a.length;
  };
  const seam = {
    startMeanGrayError: meanFrameError(r4SeamStart, r5SeamStart),
    endMeanGrayError: meanFrameError(r4SeamEnd, r5SeamEnd),
    trailingFrameDelta: r5Analysis.motion[FRAMES - 1],
    precedingTenMedianDelta: median(r5Analysis.motion.slice(FRAMES - 11, FRAMES - 1)),
  };
  const r4Hits = qaBeatHits(r4Analysis, beatData.strongAccents);
  const r5Hits = qaBeatHits(r5Analysis, beatData.strongAccents);
  const machineGates = {
    startSeam: {passed: seam.startMeanGrayError <= 1.5, measured: seam.startMeanGrayError, limit: 1.5},
    endSeam: {passed: seam.endMeanGrayError <= 1.5, measured: seam.endMeanGrayError, limit: 1.5},
    trailingContinuity: {passed: seam.trailingFrameDelta <= 3 * Math.max(seam.precedingTenMedianDelta, 0.3),
      measured: seam.trailingFrameDelta, limit: 3 * Math.max(seam.precedingTenMedianDelta, 0.3)},
    cueHits: {passed: r5Hits.cueHits >= 24, measured: r5Hits.cueHits, required: 24, total: 27},
    onBeatAccents: {passed: r5Hits.onBeatAccentHitRate !== null && r5Hits.onBeatAccentHitRate >= 0.7,
      measured: r5Hits.onBeatAccentHitRate, required: 0.7, total: r5Hits.onBeatAccentTotal},
    nearStatic: {passed: r5Hits.longestNearStaticFrames <= 54,
      measured: r5Hits.longestNearStaticFrames, limit: 54, target: 41},
    audio: {passed: Boolean(audio && Math.abs(audio.precise48k.offsetMs) <= 5 && audio.precise48k.residualDb <= -20),
      offsetMs: audio?.precise48k.offsetMs ?? null, residualDb: audio?.precise48k.residualDb ?? null,
      offsetLimitMs: 5, residualLimitDb: -20},
  };
  const report = {
    window: {globalStartFrame: START, globalEndFrame: END, localFrames: FRAMES, fps: FPS, startSeconds: START / FPS, durationSeconds: SECONDS},
    source: {r4: opts.r4, r5: opts.r5, m1: m1Path, beatData: opts.beats, selfCheck: opts.self},
    media: {r4: r4Probe, r5: r5Probe},
    metricDefinitions: {
      visualEvent: '96×54 灰度帧差局部峰值：高于邻域中位数 3 倍且帧差 >1.5；只是切换／动作候选',
      hardChangeCandidate: '平均帧差 ≥12 且超过 10 灰度的像素占比 ≥25%；不是镜头语义判断',
      structureDiff: 'sdiff = 每帧减去整体平均亮度后，相邻帧绝对差的均值；整屏闪亮不计结构动作',
      blockDiff: '96×54 灰度图分成 12×6 块，取各块去整体亮度后的平均绝对帧差最大值',
      cueHit: '全局 cue 减 3602；在 ±1 帧内 sdiff 峰 ≥max(1,2×前 8～2 帧中位数)，或局部块峰 ≥max(4,2×同基线)',
      onBeatAccentHit: '只统计改画主体内的在拍强重音，同一判据放宽到 ±2 帧；4214 起交接段不计',
      nearStatic: '改画主体 f3604—4229 内，平均灰度帧差 <0.6 的最长连续帧数；不能判断有意留白',
      nearBlackOrWhite: '连续至少 3 帧，95% 像素分别 <16 或 >239，且全帧均值分别 <8 或 >247',
    },
    visualMachineProxy: {r4: compactVisual(r4Analysis, r4Hits), r5: compactVisual(r5Analysis, r5Hits),
      medianMotionRatioR5ToR4: Number((r5Analysis.medianFrameDelta / Math.max(r4Analysis.medianFrameDelta, 1e-9)).toFixed(2)),
      r5QaCueDetails: r5Hits.cueDetails},
    seam,
    audioSync: audio,
    machineGates,
    machineGatesPassed: Object.values(machineGates).every((gate) => gate.passed),
    structuralFlags,
    manualReviewRequired: ['场内是否存在全屏叠化与交接语义', '年份重叠与每条文字完整可读时长', '史实禁项', '资产放大倍率与 1080p 画质', '监制及用户正常速度完整观看'],
    interpretation: '这些数值只检验锁定单中可量化的机器代理项；历史准确性、构图、文字停留和音乐情绪仍需人审。',
  };
  console.log(JSON.stringify(report, null, 2));
  if (!opts.self && (structuralFlags.length || !report.machineGatesPassed)) process.exitCode = 2;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
