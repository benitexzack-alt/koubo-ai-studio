import {createHash} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';

export class VideoQualityMetricsV2Error extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'VideoQualityMetricsV2Error';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = null) => {
  throw new VideoQualityMetricsV2Error(code, message, details);
};

const parseRate = (value) => {
  const [numerator, denominator = '1'] = String(value ?? '').split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return Number.NaN;
  }
  return numerator / denominator;
};

const run = (binary, args, code, label) => {
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    fail(code, `${label}无法启动。`, {reason: result.error.message});
  }
  if (result.status !== 0) {
    fail(code, `${label}失败，退出码 ${String(result.status)}。`, {
      stderr: String(result.stderr ?? '').slice(-4000),
    });
  }
  return {stdout: result.stdout, stderr: result.stderr, exitCode: result.status};
};

export const probeVideoV2 = ({videoPath, ffprobeBin = 'ffprobe'}) => {
  const result = run(
    ffprobeBin,
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,nb_frames,channels,sample_rate',
      '-of',
      'json',
      videoPath,
    ],
    'FFPROBE_FAILED',
    'ffprobe 媒体探测',
  );
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    fail('FFPROBE_JSON_INVALID', 'ffprobe 没有返回有效 JSON。', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  const videoStreams = (parsed.streams ?? []).filter((stream) => stream.codec_type === 'video');
  const audioStreams = (parsed.streams ?? []).filter((stream) => stream.codec_type === 'audio');
  if (videoStreams.length !== 1) {
    fail('VIDEO_STREAM_COUNT_INVALID', `必须且只能包含一条视频流，实际 ${videoStreams.length} 条。`);
  }
  const primary = videoStreams[0];
  const durationSeconds = Number(parsed.format?.duration);
  const fps = parseRate(primary.avg_frame_rate || primary.r_frame_rate);
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isFinite(fps) ||
    fps <= 0 ||
    !Number.isInteger(Number(primary.width)) ||
    !Number.isInteger(Number(primary.height))
  ) {
    fail('VIDEO_METADATA_INVALID', '视频时长、帧率或尺寸无效。');
  }
  return {
    durationSeconds,
    width: Number(primary.width),
    height: Number(primary.height),
    fps,
    codec: String(primary.codec_name ?? ''),
    declaredFrameCount: /^\d+$/u.test(String(primary.nb_frames ?? ''))
      ? Number(primary.nb_frames)
      : null,
    videoStreamCount: videoStreams.length,
    audioStreamCount: audioStreams.length,
    audioStreams: audioStreams.map((stream) => ({
      index: Number(stream.index),
      codec: String(stream.codec_name ?? ''),
      channels: Number(stream.channels ?? 0),
      sampleRate: Number(stream.sample_rate ?? 0),
    })),
    formatBytes: Number(parsed.format?.size ?? 0),
    formatBitRate: Number(parsed.format?.bit_rate ?? 0),
    raw: parsed,
  };
};

export const probeVideoFrameTimelineV2 = ({videoPath, ffprobeBin = 'ffprobe'}) => {
  const result = run(
    ffprobeBin,
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_frames',
      '-show_entries',
      'frame=best_effort_timestamp_time,pkt_duration_time',
      '-of',
      'json',
      videoPath,
    ],
    'FFPROBE_FRAME_TIMELINE_FAILED',
    'ffprobe 逐帧时间轴探测',
  );
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    fail('FFPROBE_FRAME_TIMELINE_JSON_INVALID', 'ffprobe 逐帧时间轴未返回有效 JSON。', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  const frames = (parsed.frames ?? []).map((frame, index) => ({
    index,
    ptsSeconds: Number(frame.best_effort_timestamp_time),
    durationSeconds: Number(frame.pkt_duration_time),
  }));
  if (
    frames.length === 0 ||
    frames.some((frame) => !Number.isFinite(frame.ptsSeconds))
  ) {
    fail('VIDEO_FRAME_PTS_MISSING', '视频必须为每帧提供可解析 PTS。');
  }
  const nonMonotonic = [];
  for (let index = 1; index < frames.length; index += 1) {
    if (frames[index].ptsSeconds <= frames[index - 1].ptsSeconds) {
      nonMonotonic.push({
        previousFrame: index - 1,
        previousPtsSeconds: frames[index - 1].ptsSeconds,
        frame: index,
        ptsSeconds: frames[index].ptsSeconds,
      });
    }
  }
  return {
    frameCount: frames.length,
    monotonic: nonMonotonic.length === 0,
    nonMonotonic,
    firstPtsSeconds: frames[0].ptsSeconds,
    lastPtsSeconds: frames.at(-1).ptsSeconds,
    frames,
  };
};

export const decodeVideoFullyV2 = ({videoPath, ffmpegBin = 'ffmpeg'}) => {
  const result = run(
    ffmpegBin,
    [
      '-hide_banner',
      '-nostdin',
      '-nostats',
      '-v',
      'error',
      '-xerror',
      '-err_detect',
      'explode',
      '-i',
      videoPath,
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      '-sn',
      '-dn',
      '-f',
      'null',
      '-',
    ],
    'VIDEO_DECODE_FAILED',
    'FFmpeg 全片严格解码',
  );
  return {status: 'passed', exitCode: result.exitCode};
};

const percentileFloor = (values, percentile) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.floor((sorted.length - 1) * percentile);
  return sorted[index];
};

const summarize = (values) => ({
  count: values.length,
  mean: values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null,
  median: percentileFloor(values, 0.5),
  p90: percentileFloor(values, 0.9),
  p99: percentileFloor(values, 0.99),
  min: values.length ? Math.min(...values) : null,
  max: values.length ? Math.max(...values) : null,
});

const closeRun = (runs, startFrame, endFrame, fps, kind) => {
  if (startFrame === null || endFrame < startFrame) return;
  runs.push({
    kind,
    startFrame,
    endFrame,
    startSeconds: startFrame / fps,
    endSeconds: (endFrame + 1) / fps,
    durationSeconds: (endFrame - startFrame + 1) / fps,
    frameCount: endFrame - startFrame + 1,
  });
};

const findFrameRuns = (rows, predicate, fps, kind) => {
  const runs = [];
  let start = null;
  for (const row of rows) {
    if (predicate(row)) {
      if (start === null) start = row.frame;
    } else if (start !== null) {
      closeRun(runs, start, row.frame - 1, fps, kind);
      start = null;
    }
  }
  if (start !== null) closeRun(runs, start, rows.at(-1).frame, fps, kind);
  return runs;
};

const findTransitionRuns = (rows, predicate, fps, kind) => {
  const runs = [];
  let firstTransition = null;
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (predicate(row)) {
      if (firstTransition === null) firstTransition = index;
    } else if (firstTransition !== null) {
      closeRun(runs, firstTransition - 1, index - 1, fps, kind);
      firstTransition = null;
    }
  }
  if (firstTransition !== null) {
    closeRun(runs, firstTransition - 1, rows.length - 1, fps, kind);
  }
  return runs;
};

const entropy = (histogram, pixelCount) => {
  let result = 0;
  for (const count of histogram) {
    if (count === 0) continue;
    const probability = count / pixelCount;
    result -= probability * Math.log2(probability);
  }
  return result;
};

const nmsBoundaries = (rows, {threshold, windowSeconds, fps}) => {
  const radius = Math.max(1, Math.round(windowSeconds * fps));
  const candidates = rows
    .filter((row) => row.frame > 0 && row.madPrev >= threshold)
    .sort((left, right) => right.madPrev - left.madPrev || left.frame - right.frame);
  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((item) => Math.abs(item.frame - candidate.frame) <= radius)) continue;
    selected.push(candidate);
  }
  return selected
    .sort((left, right) => left.frame - right.frame)
    .map((row) => ({
      frame: row.frame,
      timeSeconds: row.timeSeconds,
      scoreMadRgb: row.madPrev,
    }));
};

export const analyzeDecodedFramesV2 = ({
  videoPath,
  fps,
  ffmpegBin = 'ffmpeg',
  analysisWidth = 160,
  analysisHeight = 90,
  blackLumaThreshold = 8,
  whiteLumaThreshold = 247,
  freezeMadThreshold = 0.05,
  boundaryMadThreshold = 8,
  boundaryNmsSeconds = 0.5,
}) =>
  new Promise((resolve, reject) => {
    if (!Number.isInteger(analysisWidth) || !Number.isInteger(analysisHeight)) {
      reject(new VideoQualityMetricsV2Error('ANALYSIS_DIMENSIONS_INVALID', '分析尺寸必须为整数。'));
      return;
    }
    const child = spawn(
      ffmpegBin,
      [
        '-hide_banner',
        '-nostdin',
        '-nostats',
        '-v',
        'error',
        '-i',
        videoPath,
        '-map',
        '0:v:0',
        '-an',
        '-sn',
        '-dn',
        '-vf',
        `scale=${analysisWidth}:${analysisHeight}`,
        '-pix_fmt',
        'rgb24',
        '-f',
        'rawvideo',
        '-',
      ],
      {stdio: ['ignore', 'pipe', 'pipe']},
    );
    const frameBytes = analysisWidth * analysisHeight * 3;
    const pixelCount = analysisWidth * analysisHeight;
    let pending = Buffer.alloc(0);
    let previous = null;
    let stderr = '';
    const rows = [];
    const hashCounts = new Map();

    const consume = (frameBuffer) => {
      const luma = new Uint8Array(pixelCount);
      const histogram = new Uint32Array(256);
      let lumaSum = 0;
      let rgbDifference = 0;
      for (let pixel = 0, offset = 0; pixel < pixelCount; pixel += 1, offset += 3) {
        const red = frameBuffer[offset];
        const green = frameBuffer[offset + 1];
        const blue = frameBuffer[offset + 2];
        const value = Math.max(0, Math.min(255, Math.trunc(
          red * 0.2126 + green * 0.7152 + blue * 0.0722,
        )));
        luma[pixel] = value;
        histogram[value] += 1;
        lumaSum += value;
        if (previous) {
          rgbDifference += Math.abs(red - previous[offset]);
          rgbDifference += Math.abs(green - previous[offset + 1]);
          rgbDifference += Math.abs(blue - previous[offset + 2]);
        }
      }
      let horizontal = 0;
      let vertical = 0;
      for (let y = 0; y < analysisHeight; y += 1) {
        for (let x = 0; x < analysisWidth; x += 1) {
          const pixel = y * analysisWidth + x;
          if (x > 0) horizontal += Math.abs(luma[pixel] - luma[pixel - 1]);
          if (y > 0) vertical += Math.abs(luma[pixel] - luma[pixel - analysisWidth]);
        }
      }
      const hash = createHash('sha256').update(frameBuffer).digest('hex');
      hashCounts.set(hash, (hashCounts.get(hash) ?? 0) + 1);
      const frame = rows.length;
      rows.push({
        frame,
        timeSeconds: frame / fps,
        lumaMean: lumaSum / pixelCount,
        entropy: entropy(histogram, pixelCount),
        edgeStrength: (
          horizontal / (analysisHeight * Math.max(1, analysisWidth - 1)) +
          vertical / (analysisWidth * Math.max(1, analysisHeight - 1))
        ) / 2,
        madPrev: previous ? rgbDifference / frameBytes : 0,
        frameSha256: hash,
      });
      previous = Buffer.from(frameBuffer);
    };

    child.stdout.on('data', (chunk) => {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      while (pending.length >= frameBytes) {
        consume(pending.subarray(0, frameBytes));
        pending = pending.subarray(frameBytes);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-64 * 1024);
    });
    child.on('error', (error) => {
      reject(new VideoQualityMetricsV2Error('FRAME_ANALYSIS_FAILED', '逐帧分析无法启动。', {
        reason: error.message,
      }));
    });
    child.on('close', (code) => {
      if (code !== 0 || pending.length !== 0 || rows.length === 0) {
        reject(new VideoQualityMetricsV2Error('FRAME_ANALYSIS_FAILED', '逐帧分析未完整结束。', {
          exitCode: code,
          trailingBytes: pending.length,
          stderr: stderr.slice(-4000),
        }));
        return;
      }
      const blackRuns = findFrameRuns(
        rows,
        (row) => row.lumaMean <= blackLumaThreshold,
        fps,
        'black',
      );
      const whiteRuns = findFrameRuns(
        rows,
        (row) => row.lumaMean >= whiteLumaThreshold,
        fps,
        'white',
      );
      const freezeRuns = findTransitionRuns(
        rows,
        (row) => row.madPrev <= freezeMadThreshold,
        fps,
        'freeze-by-mad',
      );
      const exactDuplicateRuns = findTransitionRuns(
        rows,
        (row) => row.frameSha256 === rows[row.frame - 1]?.frameSha256,
        fps,
        'exact-consecutive-frame-hash',
      );
      const repeatedHashes = [...hashCounts.entries()]
        .filter(([, count]) => count > 1)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
      resolve({
        algorithm: {
          scale: `${analysisWidth}x${analysisHeight}`,
          luma: 'Rec.709 RGB coefficients truncated to uint8',
          entropy: 'Shannon entropy over 256-bin uint8 luma histogram',
          edgeStrength: 'mean absolute adjacent luma difference, horizontal/vertical average',
          madPrev: 'mean absolute decoded RGB-channel difference from previous frame',
          frameHash: 'SHA-256 of decoded scaled rgb24 frame',
          percentile: 'floor((n-1)*p), no interpolation',
          boundary: `MAD >= ${boundaryMadThreshold}, greedy NMS ${boundaryNmsSeconds}s`,
        },
        frameCount: rows.length,
        rows,
        summary: {
          luma: summarize(rows.map((row) => row.lumaMean)),
          entropy: summarize(rows.map((row) => row.entropy)),
          edgeStrength: summarize(rows.map((row) => row.edgeStrength)),
          madPrev: summarize(rows.map((row) => row.madPrev)),
        },
        blackRuns,
        whiteRuns,
        freezeRuns,
        exactDuplicateRuns,
        exactFrameHashes: {
          uniqueCount: hashCounts.size,
          repeatedHashCount: repeatedHashes.length,
          repeatedFrameCount: repeatedHashes.reduce((sum, [, count]) => sum + count - 1, 0),
          topRepeated: repeatedHashes.slice(0, 20).map(([sha256, count]) => ({sha256, count})),
        },
        boundaries: nmsBoundaries(rows, {
          threshold: boundaryMadThreshold,
          windowSeconds: boundaryNmsSeconds,
          fps,
        }),
      });
    });
  });

export const runFfmpegDetectorsV2 = ({
  videoPath,
  ffmpegBin = 'ffmpeg',
  blackMinimumSeconds = 0.1,
  freezeMinimumSeconds = 0.5,
}) => {
  const filter = [
    `blackdetect=d=${blackMinimumSeconds}:pix_th=0.10`,
    `freezedetect=n=-50dB:d=${freezeMinimumSeconds}`,
  ].join(',');
  const result = run(
    ffmpegBin,
    [
      '-hide_banner',
      '-nostdin',
      '-nostats',
      '-v',
      'info',
      '-i',
      videoPath,
      '-map',
      '0:v:0',
      '-an',
      '-vf',
      filter,
      '-f',
      'null',
      '-',
    ],
    'FFMPEG_DETECTORS_FAILED',
    'FFmpeg blackdetect/freezedetect',
  );
  const text = result.stderr;
  const blackEvents = [...text.matchAll(
    /black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/gu,
  )].map((match) => ({
    startSeconds: Number(match[1]),
    endSeconds: Number(match[2]),
    durationSeconds: Number(match[3]),
  }));
  const freezeStarts = [...text.matchAll(/freeze_start:\s*([\d.]+)/gu)].map((match) => Number(match[1]));
  const freezeEnds = [...text.matchAll(/freeze_end:\s*([\d.]+)\s*\|\s*freeze_duration:\s*([\d.]+)/gu)]
    .map((match) => ({endSeconds: Number(match[1]), durationSeconds: Number(match[2])}));
  const freezeEvents = freezeEnds.map((event, index) => ({
    startSeconds: freezeStarts[index] ?? event.endSeconds - event.durationSeconds,
    ...event,
  }));
  return {
    exitCode: result.exitCode,
    filter,
    blackEvents,
    freezeEvents,
  };
};
