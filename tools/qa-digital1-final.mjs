#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_OUTPUT_DIR = resolve(
  PROJECT_ROOT,
  'edit/verify/DIGITAL1_20260714_talk01/final',
);
const REVIEW_POINTS = [
  7.2,
  19,
  42.3,
  53.5,
  64,
  77.2,
  89.5,
  105,
  116,
  134,
  149,
  158,
  167.5,
];
const MAX_BUFFER = 64 * 1024 * 1024;

const usage = () => `
用法：
  node tools/qa-digital1-final.mjs <正式成片路径> [选项]

选项：
  --output-dir <目录>  指定质检输出目录
  --ffmpeg <路径>     指定 FFmpeg 可执行文件
  --ffprobe <路径>    指定 FFprobe 可执行文件
  --json                 终端只输出机器可读 JSON
  -h, --help             显示帮助

输出：
  qa-report.json         机器可读质检报告
  qa-summary.txt         中文摘要
  frame_01.jpg ...       13 个固定语义节点抽帧
  contact-sheet.jpg      13 帧总览图

说明：机器质检不代替发布前的人工完整观看。
`.trim();

const parseArgs = (argv) => {
  const parsed = {
    input: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    ffmpeg: null,
    ffprobe: null,
    jsonOnly: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '-h' || argument === '--help') {
      parsed.help = true;
    } else if (argument === '--json') {
      parsed.jsonOnly = true;
    } else if (argument === '--output-dir') {
      parsed.outputDir = argv[index + 1];
      index += 1;
    } else if (argument === '--ffmpeg') {
      parsed.ffmpeg = argv[index + 1];
      index += 1;
    } else if (argument === '--ffprobe') {
      parsed.ffprobe = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('-')) {
      throw new Error(`未知选项：${argument}`);
    } else if (!parsed.input) {
      parsed.input = argument;
    } else {
      throw new Error(`只能传入一个成片路径，多余参数：${argument}`);
    }
  }

  for (const [flag, value] of [
    ['--output-dir', parsed.outputDir],
    ['--ffmpeg', parsed.ffmpeg],
    ['--ffprobe', parsed.ffprobe],
  ]) {
    if (value === undefined) {
      throw new Error(`${flag} 后缺少路径`);
    }
  }

  return parsed;
};

const firstExisting = (candidates) =>
  candidates.find((candidate) => candidate && existsSync(candidate)) ??
  candidates.find(Boolean);

const run = (binary, args) => {
  const startedAt = Date.now();
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    signal: result.signal,
    elapsedMs: Date.now() - startedAt,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? null,
  };
};

const compactCommandResult = (result) => ({
  ok: result.ok,
  status: result.status,
  signal: result.signal,
  elapsedMs: result.elapsedMs,
  error: result.error,
  diagnostic: result.ok
    ? null
    : (result.stderr || result.stdout).trim().slice(-4000) || '命令执行失败',
});

const parseRate = (value) => {
  if (!value || value === '0/0') return null;
  const [numerator, denominator = '1'] = value.split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
};

const asFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseProbe = (stdout) => {
  const raw = JSON.parse(stdout);
  const video = raw.streams?.find((stream) => stream.codec_type === 'video') ?? null;
  const audio = raw.streams?.find((stream) => stream.codec_type === 'audio') ?? null;

  return {
    format: {
      name: raw.format?.format_name ?? null,
      longName: raw.format?.format_long_name ?? null,
      durationSeconds: asFiniteNumber(raw.format?.duration),
      sizeBytes: asFiniteNumber(raw.format?.size),
      bitRate: asFiniteNumber(raw.format?.bit_rate),
    },
    video: video
      ? {
          codec: video.codec_name ?? null,
          profile: video.profile ?? null,
          width: video.width ?? null,
          height: video.height ?? null,
          pixelFormat: video.pix_fmt ?? null,
          frameRate: parseRate(video.avg_frame_rate || video.r_frame_rate),
          frameRateRaw: video.avg_frame_rate || video.r_frame_rate || null,
          colorSpace: video.color_space ?? null,
          colorTransfer: video.color_transfer ?? null,
          colorPrimaries: video.color_primaries ?? null,
        }
      : null,
    audio: audio
      ? {
          codec: audio.codec_name ?? null,
          sampleRate: asFiniteNumber(audio.sample_rate),
          channels: audio.channels ?? null,
          channelLayout: audio.channel_layout ?? null,
          bitRate: asFiniteNumber(audio.bit_rate),
        }
      : null,
    streamCount: raw.streams?.length ?? 0,
  };
};

const collectMatches = (text, expression, keys) => {
  const matches = [];
  for (const match of text.matchAll(expression)) {
    matches.push(
      Object.fromEntries(keys.map((key, index) => [key, asFiniteNumber(match[index + 1])])),
    );
  }
  return matches;
};

const parseVideoDetections = (stderr) => {
  const blackEvents = collectMatches(
    stderr,
    /black_start:([-\d.]+)\s+black_end:([-\d.]+)\s+black_duration:([-\d.]+)/g,
    ['start', 'end', 'duration'],
  );
  const freezeStarts = [...stderr.matchAll(/freeze_start:\s*([-\d.]+)/g)].map((match) =>
    asFiniteNumber(match[1]),
  );
  const freezeEnds = [...stderr.matchAll(/freeze_end:\s*([-\d.]+)/g)].map((match) =>
    asFiniteNumber(match[1]),
  );
  const freezeDurations = [...stderr.matchAll(/freeze_duration:\s*([-\d.]+)/g)].map(
    (match) => asFiniteNumber(match[1]),
  );
  const freezeCount = Math.max(
    freezeStarts.length,
    freezeEnds.length,
    freezeDurations.length,
  );
  const freezeEvents = Array.from({length: freezeCount}, (_, index) => ({
    start: freezeStarts[index] ?? null,
    end: freezeEnds[index] ?? null,
    duration: freezeDurations[index] ?? null,
  }));

  return {
    blackEvents,
    freezeEvents,
    relevantLogLines: stderr
      .split('\n')
      .filter((line) => line.includes('black_') || line.includes('freeze_'))
      .map((line) => line.trim()),
  };
};

const parseSilenceDetections = (stderr) => {
  const starts = [...stderr.matchAll(/silence_start:\s*([-\d.]+)/g)].map((match) =>
    asFiniteNumber(match[1]),
  );
  const ends = collectMatches(
    stderr,
    /silence_end:\s*([-\d.]+)\s*\|\s*silence_duration:\s*([-\d.]+)/g,
    ['end', 'duration'],
  );
  const count = Math.max(starts.length, ends.length);
  const silenceEvents = Array.from({length: count}, (_, index) => ({
    start: starts[index] ?? null,
    end: ends[index]?.end ?? null,
    duration: ends[index]?.duration ?? null,
  }));

  return {
    silenceEvents,
    relevantLogLines: stderr
      .split('\n')
      .filter((line) => line.includes('silence_'))
      .map((line) => line.trim()),
  };
};

const parseLoudnorm = (stderr) => {
  const blocks = [
    ...stderr.matchAll(/\{\s*"input_i"\s*:\s*"[^"]+"[\s\S]*?\}/g),
  ];
  if (blocks.length === 0) return null;
  const raw = JSON.parse(blocks.at(-1)[0]);
  return {
    inputIntegratedLufs: asFiniteNumber(raw.input_i),
    inputTruePeakDbtp: asFiniteNumber(raw.input_tp),
    inputLraLu: asFiniteNumber(raw.input_lra),
    inputThresholdLufs: asFiniteNumber(raw.input_thresh),
    targetOffsetLu: asFiniteNumber(raw.target_offset),
    raw,
  };
};

const formatNumber = (value, digits = 2) =>
  Number.isFinite(value) ? Number(value).toFixed(digits) : '未读取';

const buildSummary = (report) => {
  const probe = report.media;
  const loudness = report.checks.loudness.measurement;
  const lines = [
    '数字化1.0 V4 正式成片机器质检',
    `输入：${report.input.path}`,
    `报告时间：${report.createdAt}`,
    '',
    `媒体：${probe?.video?.width ?? '未读取'}×${probe?.video?.height ?? '未读取'} / ${formatNumber(probe?.video?.frameRate, 2)} fps / ${probe?.video?.codec ?? '未读取'} + ${probe?.audio?.codec ?? '未读取'} / ${formatNumber(probe?.format?.durationSeconds, 2)} 秒`,
    `完整解码：${report.checks.fullDecode.ok ? '通过' : '失败'}`,
    `黑场检测：${report.checks.videoDetections.blackEvents.length} 处`,
    `冻结检测：${report.checks.videoDetections.freezeEvents.length} 处`,
    `静音检测：${report.checks.silenceDetections.silenceEvents.length} 处`,
    `响度：${formatNumber(loudness?.inputIntegratedLufs)} LUFS，真峰值 ${formatNumber(loudness?.inputTruePeakDbtp)} dBTP，LRA ${formatNumber(loudness?.inputLraLu)} LU`,
    `关键帧：${report.checks.keyframes.createdCount}/${REVIEW_POINTS.length} 张`,
    `关键帧总览：${report.checks.contactSheet.ok ? report.checks.contactSheet.path : '生成失败'}`,
    '',
    `机器结论：${report.acceptance.label}`,
  ];

  if (report.acceptance.warnings.length > 0) {
    lines.push('需要复核：');
    for (const warning of report.acceptance.warnings) lines.push(`- ${warning}`);
  }
  if (report.acceptance.failures.length > 0) {
    lines.push('硬性失败：');
    for (const failure of report.acceptance.failures) lines.push(`- ${failure}`);
  }
  lines.push('', '说明：机器质检不代替发布前的人工完整观看。');
  return `${lines.join('\n')}\n`;
};

const main = () => {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`参数错误：${error.message}\n\n${usage()}`);
    process.exitCode = 2;
    return;
  }

  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.input) {
    console.error(`缺少正式成片路径。\n\n${usage()}`);
    process.exitCode = 2;
    return;
  }

  const input = resolve(args.input);
  const outputDir = resolve(args.outputDir);
  if (!existsSync(input)) {
    console.error(`成片不存在：${input}`);
    process.exitCode = 2;
    return;
  }

  const ffmpeg = firstExisting([
    args.ffmpeg,
    process.env.FFMPEG_BIN,
    '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg',
    'ffmpeg',
  ]);
  const ffprobe = firstExisting([
    args.ffprobe,
    process.env.FFPROBE_BIN,
    '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe',
    'ffprobe',
  ]);
  const ffmpegVersion = run(ffmpeg, ['-version']);
  const ffprobeVersion = run(ffprobe, ['-version']);
  if (!ffmpegVersion.ok || !ffprobeVersion.ok) {
    console.error(
      `FFmpeg 工具不可用。\nFFmpeg：${ffmpegVersion.error || ffmpegVersion.stderr}\nFFprobe：${ffprobeVersion.error || ffprobeVersion.stderr}`,
    );
    process.exitCode = 2;
    return;
  }

  mkdirSync(outputDir, {recursive: true});
  for (let index = 1; index <= REVIEW_POINTS.length; index += 1) {
    rmSync(resolve(outputDir, `frame_${String(index).padStart(2, '0')}.jpg`), {
      force: true,
    });
  }
  for (const filename of ['contact-sheet.jpg', 'qa-report.json', 'qa-summary.txt']) {
    rmSync(resolve(outputDir, filename), {force: true});
  }

  if (!args.jsonOnly) console.error('正在读取媒体参数…');
  const probeResult = run(ffprobe, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    input,
  ]);
  let media = null;
  let probeParseError = null;
  if (probeResult.ok) {
    try {
      media = parseProbe(probeResult.stdout);
    } catch (error) {
      probeParseError = error.message;
    }
  }

  if (!args.jsonOnly) console.error('正在执行完整解码…');
  const decodeResult = run(ffmpeg, [
    '-hide_banner',
    '-nostats',
    '-v',
    'error',
    '-nostdin',
    '-i',
    input,
    '-map',
    '0:v:0?',
    '-map',
    '0:a:0?',
    '-sn',
    '-dn',
    '-f',
    'null',
    '-',
  ]);

  if (!args.jsonOnly) console.error('正在检测黑场与冻结画面…');
  const videoDetectionResult = run(ffmpeg, [
    '-hide_banner',
    '-nostats',
    '-nostdin',
    '-i',
    input,
    '-map',
    '0:v:0',
    '-an',
    '-vf',
    'blackdetect=d=0.20:pix_th=0.10,freezedetect=n=-50dB:d=2.0',
    '-f',
    'null',
    '-',
  ]);
  const videoDetections = parseVideoDetections(videoDetectionResult.stderr);

  if (!args.jsonOnly) console.error('正在检测静音区间…');
  const silenceResult = run(ffmpeg, [
    '-hide_banner',
    '-nostats',
    '-nostdin',
    '-i',
    input,
    '-map',
    '0:a:0',
    '-vn',
    '-af',
    'silencedetect=noise=-40dB:d=0.8',
    '-f',
    'null',
    '-',
  ]);
  const silenceDetections = parseSilenceDetections(silenceResult.stderr);

  if (!args.jsonOnly) console.error('正在分析响度…');
  const loudnessResult = run(ffmpeg, [
    '-hide_banner',
    '-nostats',
    '-nostdin',
    '-i',
    input,
    '-map',
    '0:a:0',
    '-vn',
    '-af',
    'loudnorm=I=-16:TP=-1:LRA=7:print_format=json',
    '-f',
    'null',
    '-',
  ]);
  let loudness = null;
  let loudnessParseError = null;
  if (loudnessResult.ok) {
    try {
      loudness = parseLoudnorm(loudnessResult.stderr);
      if (!loudness) loudnessParseError = '未找到 loudnorm JSON 结果';
    } catch (error) {
      loudnessParseError = error.message;
    }
  }

  if (!args.jsonOnly) console.error('正在抽取 13 个固定语义节点…');
  const filterList = run(ffmpeg, ['-hide_banner', '-filters']);
  const canDrawText = filterList.ok && `${filterList.stdout}\n${filterList.stderr}`.includes('drawtext');
  const fontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';
  const keyframeResults = REVIEW_POINTS.map((seconds, index) => {
    const number = String(index + 1).padStart(2, '0');
    const path = resolve(outputDir, `frame_${number}.jpg`);
    const label = `${number}  ${seconds}s`;
    const videoFilter = canDrawText
      ? `drawbox=x=24:y=h-76:w=250:h=52:color=black@0.72:t=fill,drawtext=fontfile='${fontPath}':text='${label}':x=40:y=h-62:fontsize=28:fontcolor=white`
      : null;
    const commandArgs = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-ss',
      String(seconds),
      '-i',
      input,
      '-map',
      '0:v:0',
      '-frames:v',
      '1',
      ...(videoFilter ? ['-vf', videoFilter] : []),
      '-q:v',
      '2',
      '-y',
      path,
    ];
    let result = run(ffmpeg, commandArgs);
    if (!result.ok && videoFilter) {
      const filterIndex = commandArgs.indexOf('-vf');
      commandArgs.splice(filterIndex, 2);
      result = run(ffmpeg, commandArgs);
    }
    return {
      index: index + 1,
      seconds,
      path,
      exists: existsSync(path) && statSync(path).size > 0,
      command: compactCommandResult(result),
    };
  });

  const contactSheetPath = resolve(outputDir, 'contact-sheet.jpg');
  const contactSheetResult = run(ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-framerate',
    '1',
    '-start_number',
    '1',
    '-i',
    resolve(outputDir, 'frame_%02d.jpg'),
    '-vf',
    'scale=440:-2,tile=4x4:nb_frames=13:padding=8:margin=12:color=0x0A0F1C',
    '-frames:v',
    '1',
    '-update',
    '1',
    '-q:v',
    '2',
    '-y',
    contactSheetPath,
  ]);
  const contactSheetExists =
    existsSync(contactSheetPath) && statSync(contactSheetPath).size > 0;

  const failures = [];
  const warnings = [];
  if (!probeResult.ok || probeParseError || !media) failures.push('FFprobe 媒体参数读取失败');
  if (!decodeResult.ok) failures.push('完整解码失败');
  if (!videoDetectionResult.ok) failures.push('黑场/冻结检测命令失败');
  if (!silenceResult.ok) failures.push('静音检测命令失败');
  if (!loudnessResult.ok || loudnessParseError || !loudness) failures.push('响度分析失败');
  const createdFrameCount = keyframeResults.filter((item) => item.exists).length;
  if (createdFrameCount !== REVIEW_POINTS.length) {
    failures.push(`关键帧抽取不完整（${createdFrameCount}/${REVIEW_POINTS.length}）`);
  }
  if (!contactSheetResult.ok || !contactSheetExists) failures.push('关键帧总览图生成失败');

  if (videoDetections.blackEvents.length > 0) {
    warnings.push(`检出 ${videoDetections.blackEvents.length} 处持续至少 0.2 秒的黑场，需逐帧复核`);
  }
  if (videoDetections.freezeEvents.length > 0) {
    warnings.push(`检出 ${videoDetections.freezeEvents.length} 处持续至少 2 秒的画面冻结，需复核是否为合法静态卡`);
  }
  if (silenceDetections.silenceEvents.length > 0) {
    warnings.push(`检出 ${silenceDetections.silenceEvents.length} 处持续至少 0.8 秒的静音，需复核口播停顿`);
  }
  if (loudness) {
    if (
      loudness.inputIntegratedLufs === null ||
      Math.abs(loudness.inputIntegratedLufs - -16) > 1.5
    ) {
      warnings.push(
        `综合响度与 -16 LUFS 目标偏差超过 1.5 LU（实测 ${formatNumber(loudness.inputIntegratedLufs)} LUFS）`,
      );
    }
    if (
      loudness.inputTruePeakDbtp === null ||
      loudness.inputTruePeakDbtp > -0.5
    ) {
      warnings.push(
        `真峰值高于 -0.5 dBTP 复核线（实测 ${formatNumber(loudness.inputTruePeakDbtp)} dBTP）`,
      );
    }
  }

  const status = failures.length > 0 ? 'failed' : warnings.length > 0 ? 'review' : 'passed';
  const label =
    status === 'failed'
      ? '未通过机器硬门禁'
      : status === 'review'
        ? '机器硬门禁通过，存在需人工复核项'
        : '机器侧质检通过，待人工完整观看';

  const report = {
    schemaVersion: 1,
    task: 'DIGITAL1_20260714_talk01_V4_final',
    createdAt: new Date().toISOString(),
    input: {
      path: input,
      sizeBytes: statSync(input).size,
    },
    outputDirectory: outputDir,
    tools: {
      ffmpeg: {
        path: ffmpeg,
        version: ffmpegVersion.stdout.split('\n')[0] || null,
      },
      ffprobe: {
        path: ffprobe,
        version: ffprobeVersion.stdout.split('\n')[0] || null,
      },
    },
    media,
    checks: {
      probe: {
        ...compactCommandResult(probeResult),
        parseError: probeParseError,
      },
      fullDecode: compactCommandResult(decodeResult),
      videoDetections: {
        command: compactCommandResult(videoDetectionResult),
        ...videoDetections,
      },
      silenceDetections: {
        command: compactCommandResult(silenceResult),
        ...silenceDetections,
      },
      loudness: {
        command: compactCommandResult(loudnessResult),
        measurement: loudness,
        parseError: loudnessParseError,
      },
      keyframes: {
        requestedSeconds: REVIEW_POINTS,
        createdCount: createdFrameCount,
        frames: keyframeResults,
      },
      contactSheet: {
        ...compactCommandResult(contactSheetResult),
        path: contactSheetPath,
        exists: contactSheetExists,
      },
    },
    acceptance: {
      status,
      label,
      failures,
      warnings,
      note: '机器质检不代替发布前的人工完整观看。',
    },
  };

  const reportPath = resolve(outputDir, 'qa-report.json');
  const summaryPath = resolve(outputDir, 'qa-summary.txt');
  const summary = buildSummary(report);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(summaryPath, summary, 'utf8');

  if (args.jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(summary.trimEnd());
    console.log(`\n机器报告：${reportPath}`);
    console.log(`中文摘要：${summaryPath}`);
  }
  if (failures.length > 0) process.exitCode = 1;
};

main();
