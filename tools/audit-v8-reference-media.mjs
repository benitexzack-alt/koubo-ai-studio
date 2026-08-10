#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {readdirSync, readFileSync, statSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const auditRoot = path.resolve(
  projectRoot,
  process.argv[2] ?? 'work/reference-audit/20260810-v8',
);

const percentile = (values, ratio) => {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * ratio))];
};

const db = (value) => 20 * Math.log10(Math.max(1e-9, value));

const readPcm16Wave = (filePath) => {
  const buffer = readFileSync(filePath);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`只支持 RIFF/WAVE：${filePath}`);
  }

  let offset = 12;
  let format;
  let dataOffset;
  let dataLength;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkLength = buffer.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;
    if (chunkId === 'fmt ') {
      format = {
        audioFormat: buffer.readUInt16LE(payloadOffset),
        channels: buffer.readUInt16LE(payloadOffset + 2),
        sampleRate: buffer.readUInt32LE(payloadOffset + 4),
        bitsPerSample: buffer.readUInt16LE(payloadOffset + 14),
      };
    }
    if (chunkId === 'data') {
      dataOffset = payloadOffset;
      dataLength = Math.min(chunkLength, buffer.length - payloadOffset);
      break;
    }
    offset = payloadOffset + chunkLength + (chunkLength % 2);
  }

  if (!format || dataOffset === undefined || dataLength === undefined) {
    throw new Error(`WAV 缺少 fmt 或 data 块：${filePath}`);
  }
  if (format.audioFormat !== 1 || format.bitsPerSample !== 16) {
    throw new Error(`只支持 16-bit PCM WAV：${filePath}`);
  }

  return {buffer, dataOffset, dataLength, ...format};
};

const decodePcm16 = (filePath) => {
  try {
    return readPcm16Wave(filePath);
  } catch (error) {
    const result = spawnSync(
      'ffmpeg',
      [
        '-v',
        'error',
        '-i',
        filePath,
        '-f',
        's16le',
        '-acodec',
        'pcm_s16le',
        '-ar',
        '48000',
        '-ac',
        '2',
        'pipe:1',
      ],
      {encoding: null, maxBuffer: 128 * 1024 * 1024},
    );
    if (result.status !== 0 || !result.stdout?.length) {
      throw new Error(
        `音频解码失败：${filePath}\n${result.stderr?.toString('utf8') ?? String(error)}`,
      );
    }
    return {
      buffer: result.stdout,
      dataOffset: 0,
      dataLength: result.stdout.length,
      audioFormat: 1,
      channels: 2,
      sampleRate: 48000,
      bitsPerSample: 16,
    };
  }
};

const analyzeWave = (filePath, options = {}) => {
  const wave = decodePcm16(filePath);
  const samplesPerWindow = Math.max(
    1,
    Math.round(wave.sampleRate * (options.windowSeconds ?? 0.02)),
  );
  const bytesPerFrame = wave.channels * 2;
  const frameCount = Math.floor(wave.dataLength / bytesPerFrame);
  const windowCount = Math.ceil(frameCount / samplesPerWindow);
  const windows = [];
  let globalPeak = 0;
  let globalSquareSum = 0;
  let globalSampleCount = 0;

  for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
    const startFrame = windowIndex * samplesPerWindow;
    const endFrame = Math.min(frameCount, startFrame + samplesPerWindow);
    let squareSum = 0;
    let diffSquareSum = 0;
    let sampleCount = 0;
    let previousMono = 0;
    let signChanges = 0;

    for (let frame = startFrame; frame < endFrame; frame += 1) {
      let mono = 0;
      for (let channel = 0; channel < wave.channels; channel += 1) {
        const byteOffset = wave.dataOffset + frame * bytesPerFrame + channel * 2;
        const sample = wave.buffer.readInt16LE(byteOffset) / 32768;
        mono += sample;
        globalPeak = Math.max(globalPeak, Math.abs(sample));
      }
      mono /= wave.channels;
      squareSum += mono * mono;
      globalSquareSum += mono * mono;
      globalSampleCount += 1;
      if (frame > startFrame) {
        const difference = mono - previousMono;
        diffSquareSum += difference * difference;
        if ((mono >= 0) !== (previousMono >= 0)) signChanges += 1;
      }
      previousMono = mono;
      sampleCount += 1;
    }

    const rms = Math.sqrt(squareSum / Math.max(1, sampleCount));
    const diffRms = Math.sqrt(diffSquareSum / Math.max(1, sampleCount - 1));
    windows.push({
      time: startFrame / wave.sampleRate,
      rms,
      rmsDbfs: db(rms),
      brightnessProxy: diffRms / Math.max(1e-7, rms),
      zeroCrossingRate: signChanges / Math.max(1, sampleCount - 1),
    });
  }

  const lookback = Math.max(2, Math.round(0.24 / (options.windowSeconds ?? 0.02)));
  const transientScores = windows.map((window, index) => {
    const previous = windows.slice(Math.max(0, index - lookback), index);
    const baseline = previous.length
      ? percentile(previous.map((item) => item.rmsDbfs), 0.5)
      : window.rmsDbfs;
    const rise = Math.max(0, window.rmsDbfs - baseline);
    return rise * (0.72 + Math.min(1.8, window.brightnessProxy) * 0.28);
  });
  const threshold = Math.max(2.8, percentile(transientScores, 0.975));
  const minSpacing = options.minSpacingSeconds ?? 0.22;
  const transients = [];
  for (let index = 1; index < windows.length - 1; index += 1) {
    const score = transientScores[index];
    if (
      score < threshold ||
      score < transientScores[index - 1] ||
      score < transientScores[index + 1]
    ) {
      continue;
    }
    const candidate = {...windows[index], score};
    const previous = transients.at(-1);
    if (previous && candidate.time - previous.time < minSpacing) {
      if (candidate.score > previous.score) transients[transients.length - 1] = candidate;
    } else {
      transients.push(candidate);
    }
  }

  const meanRms = Math.sqrt(globalSquareSum / Math.max(1, globalSampleCount));
  return {
    format: {
      channels: wave.channels,
      sampleRate: wave.sampleRate,
      bitsPerSample: wave.bitsPerSample,
    },
    durationSeconds: frameCount / wave.sampleRate,
    peakDbfs: db(globalPeak),
    meanRmsDbfs: db(meanRms),
    crestFactorDb: db(globalPeak / Math.max(1e-9, meanRms)),
    transientThreshold: threshold,
    transients,
  };
};

const parseMotionScores = (filePath) => {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  const entries = [];
  let time = null;
  for (const line of lines) {
    const timeMatch = line.match(/pts_time:([0-9.]+)/);
    if (timeMatch) time = Number(timeMatch[1]);
    const scoreMatch = line.match(/lavfi\.scene_score=([0-9.]+)/);
    if (scoreMatch && Number.isFinite(time)) {
      entries.push({time, score: Number(scoreMatch[1])});
    }
  }
  const threshold = percentile(entries.map((entry) => entry.score), 0.985);
  const peaks = [];
  for (let index = 1; index < entries.length - 1; index += 1) {
    const entry = entries[index];
    if (
      entry.score < threshold ||
      entry.score < entries[index - 1].score ||
      entry.score < entries[index + 1].score
    ) {
      continue;
    }
    const previous = peaks.at(-1);
    if (previous && entry.time - previous.time < 0.18) {
      if (entry.score > previous.score) peaks[peaks.length - 1] = entry;
    } else {
      peaks.push(entry);
    }
  }
  return {frameCount: entries.length, threshold, peaks};
};

const alignEvents = (audioEvents, motionEvents, toleranceSeconds = 0.2) => {
  const matches = [];
  let motionIndex = 0;
  for (const audio of audioEvents) {
    while (
      motionIndex + 1 < motionEvents.length &&
      motionEvents[motionIndex + 1].time <= audio.time
    ) {
      motionIndex += 1;
    }
    const candidates = [motionEvents[motionIndex], motionEvents[motionIndex + 1]].filter(Boolean);
    const nearest = candidates.sort(
      (left, right) => Math.abs(left.time - audio.time) - Math.abs(right.time - audio.time),
    )[0];
    if (nearest && Math.abs(nearest.time - audio.time) <= toleranceSeconds) {
      matches.push({
        audioTime: audio.time,
        motionTime: nearest.time,
        deltaSeconds: nearest.time - audio.time,
        audioScore: audio.score,
        motionScore: nearest.score,
      });
    }
  }
  return matches;
};

const walkAudio = (directory) => {
  if (!statSync(directory).isDirectory()) return [];
  return readdirSync(directory, {withFileTypes: true})
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return walkAudio(target);
      return /\.(wav)$/i.test(entry.name) ? [target] : [];
    });
};

const references = ['ref-a', 'ref-b'].map((id) => {
  const audioPath = path.join(auditRoot, id, 'audio/reference.wav');
  const motionPath = path.join(auditRoot, id, 'all-frame-scene-scores.log');
  const audio = analyzeWave(audioPath);
  const motion = parseMotionScores(motionPath);
  const matches = alignEvents(audio.transients, motion.peaks);
  return {
    id,
    audioPath: path.relative(projectRoot, audioPath),
    motionPath: path.relative(projectRoot, motionPath),
    decodedVideoFrameCount: motion.frameCount,
    durationSeconds: audio.durationSeconds,
    audioPeakDbfs: audio.peakDbfs,
    audioMeanRmsDbfs: audio.meanRmsDbfs,
    audioCrestFactorDb: audio.crestFactorDb,
    detectedAudioTransientCount: audio.transients.length,
    detectedMotionPeakCount: motion.peaks.length,
    alignedEventCount: matches.length,
    alignedEventRatio: matches.length / Math.max(1, audio.transients.length),
    topAlignedEvents: matches
      .sort((left, right) => right.audioScore - left.audioScore)
      .slice(0, 60),
  };
});

const sfxRoot = path.join(projectRoot, 'remotion/public/audio');
const sfxInventory = walkAudio(sfxRoot).map((filePath) => {
  const analysis = analyzeWave(filePath, {windowSeconds: 0.01, minSpacingSeconds: 0.08});
  return {
    file: path.relative(projectRoot, filePath),
    durationSeconds: analysis.durationSeconds,
    peakDbfs: analysis.peakDbfs,
    meanRmsDbfs: analysis.meanRmsDbfs,
    crestFactorDb: analysis.crestFactorDb,
    transientCount: analysis.transients.length,
  };
});

const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  method: {
    video: 'FFmpeg lavfi scene_score decoded for every physical frame',
    visualReview: 'Human review of 1 fps contact sheets plus transition frames',
    audio: '20 ms PCM windows, adaptive RMS-rise transient score, 200 ms motion alignment',
    limitation:
      'Audio transient detection includes speech consonants and music accents; aligned events are rhythm evidence, not isolated SFX stems.',
  },
  references,
  sfxInventory,
};

mkdirSync(auditRoot, {recursive: true});
writeFileSync(
  path.join(auditRoot, 'reference-motion-sfx-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);

const markdown = [
  '# V8 参考片动效与音效审计摘要',
  '',
  '> 视觉侧：两条视频所有物理帧均经 FFmpeg 解码并记录 scene score；人工复核采用每秒联系表加转场帧。',
  '> 音频侧：从混合音轨检测瞬态，并与画面运动峰值做 200ms 对齐；这能证明节奏耦合，不能把人声、音乐和音效彻底分轨。',
  '',
  ...references.flatMap((reference) => [
    `## ${reference.id}`,
    '',
    `- 时长：${reference.durationSeconds.toFixed(2)} 秒`,
    `- 逐帧解码：${reference.decodedVideoFrameCount} 帧`,
    `- 音频瞬态：${reference.detectedAudioTransientCount} 个`,
    `- 画面运动峰值：${reference.detectedMotionPeakCount} 个`,
    `- 200ms 内声画对齐：${reference.alignedEventCount} 个（${(reference.alignedEventRatio * 100).toFixed(1)}%）`,
    `- 音频均方响度：${reference.audioMeanRmsDbfs.toFixed(1)} dBFS；峰值：${reference.audioPeakDbfs.toFixed(1)} dBFS`,
    '',
  ]),
  '## 本地音效库',
  '',
  `- 可解析 WAV：${sfxInventory.length} 个`,
  `- 时长范围：${Math.min(...sfxInventory.map((item) => item.durationSeconds)).toFixed(2)}–${Math.max(...sfxInventory.map((item) => item.durationSeconds)).toFixed(2)} 秒`,
  `- 平均 RMS 范围：${Math.min(...sfxInventory.map((item) => item.meanRmsDbfs)).toFixed(1)}–${Math.max(...sfxInventory.map((item) => item.meanRmsDbfs)).toFixed(1)} dBFS`,
  '',
  '完整机器结果见 `reference-motion-sfx-audit.json`。',
  '',
].join('\n');

writeFileSync(path.join(auditRoot, 'reference-motion-sfx-audit.md'), markdown, 'utf8');
console.log(`参考片：${references.length} 条`);
console.log(`本地 WAV：${sfxInventory.length} 个`);
console.log(path.join(auditRoot, 'reference-motion-sfx-audit.json'));
