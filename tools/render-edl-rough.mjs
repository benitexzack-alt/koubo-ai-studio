import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const args = process.argv.slice(2);
const edlPath = args[0];
const outputFlag = args.indexOf('--output');
const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : null;
const workersFlag = args.indexOf('--workers');
const workers = workersFlag >= 0 ? Number(args[workersFlag + 1]) : 3;

if (!edlPath || !outputPath) {
  console.error('用法：node tools/render-edl-rough.mjs <edl.json> --output <rough.mp4> [--workers 3]');
  process.exit(1);
}

if (!Number.isInteger(workers) || workers < 1 || workers > 6) {
  console.error('--workers 必须是 1 至 6 的整数。');
  process.exit(1);
}

const root = process.cwd();
const edlAbsolute = path.resolve(root, edlPath);
const outputAbsolute = path.resolve(root, outputPath);
const edl = JSON.parse(fs.readFileSync(edlAbsolute, 'utf8'));
const edlDir = path.dirname(edlAbsolute);
const workDir = path.join(edlDir, `clips_${edl.videoId}_rough_v1`);

const run = (command, commandArgs, {capture = false} = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} 退出码 ${code}\n${stderr.slice(-4000)}`));
        return;
      }
      resolve({stdout, stderr});
    });
  });

const resolveSource = (sourceId) => {
  const configured = edl.sources?.[sourceId];
  if (!configured) {
    throw new Error(`EDL 未声明素材：${sourceId}`);
  }
  return path.resolve(edlDir, configured);
};

const validate = () => {
  if (!Array.isArray(edl.ranges) || edl.ranges.length === 0) {
    throw new Error('EDL ranges 不能为空。');
  }
  const target = edl.output ?? {};
  if (target.width !== 1920 || target.height !== 1080 || target.fps !== 30) {
    throw new Error('本工具只接受当前横屏基线：1920×1080、30fps。');
  }
  let total = 0;
  for (const [index, range] of edl.ranges.entries()) {
    const source = resolveSource(range.source);
    if (!fs.existsSync(source)) {
      throw new Error(`第 ${index + 1} 段素材不存在：${source}`);
    }
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end <= range.start) {
      throw new Error(`第 ${index + 1} 段时间范围无效。`);
    }
    total += range.end - range.start;
  }
  if (total > Number(edl.targetRuntimeSeconds ?? Infinity)) {
    throw new Error(`EDL 总时长 ${total.toFixed(2)} 秒超过目标。`);
  }
  return total;
};

const segmentPath = (index) => path.join(workDir, `segment_${String(index + 1).padStart(2, '0')}.mp4`);

const renderSegment = async (range, index) => {
  const source = resolveSource(range.source);
  const duration = range.end - range.start;
  const fadeOutStart = Math.max(0, duration - 0.03);
  const destination = segmentPath(index);
  const videoFilter = [
    'scale=1920:1080:flags=lanczos',
    'fps=30',
    'setsar=1',
    'eq=contrast=1.015:saturation=1.02:brightness=0.005',
  ].join(',');
  const audioFilter = [
    'afade=t=in:st=0:d=0.03',
    `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=0.03`,
  ].join(',');

  console.log(
    `[${String(index + 1).padStart(2, '0')}/${edl.ranges.length}] ` +
      `${range.beat} ${range.start.toFixed(2)}-${range.end.toFixed(2)} (${duration.toFixed(2)}s)`,
  );

  await run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    range.start.toFixed(3),
    '-i',
    source,
    '-t',
    duration.toFixed(3),
    '-map',
    '0:v:0',
    '-map',
    '0:a:0',
    '-vf',
    videoFilter,
    '-af',
    audioFilter,
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '20',
    '-profile:v',
    'high',
    '-level:v',
    '4.2',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-g',
    '60',
    '-keyint_min',
    '60',
    '-sc_threshold',
    '0',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-map_metadata',
    '-1',
    '-movflags',
    '+faststart',
    destination,
  ]);
};

const renderWithWorkers = async () => {
  let cursor = 0;
  const worker = async () => {
    while (cursor < edl.ranges.length) {
      const index = cursor;
      cursor += 1;
      await renderSegment(edl.ranges[index], index);
    }
  };
  await Promise.all(Array.from({length: Math.min(workers, edl.ranges.length)}, () => worker()));
};

const parseLoudnorm = (stderr) => {
  const start = stderr.lastIndexOf('{');
  const end = stderr.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('无法解析 loudnorm 第一遍测量结果。');
  }
  return JSON.parse(stderr.slice(start, end + 1));
};

const normalizeAudio = async (input, output) => {
  console.log('响度第一遍：测量最终粗剪音轨');
  const measured = await run(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      input,
      '-map',
      '0:a:0',
      '-af',
      'loudnorm=I=-16:LRA=11:TP=-1.5:print_format=json',
      '-f',
      'null',
      '-',
    ],
    {capture: true},
  );
  const stats = parseLoudnorm(measured.stderr);
  console.log(`  输入 I=${stats.input_i} LUFS，TP=${stats.input_tp} dBTP，LRA=${stats.input_lra} LU`);

  const filter = [
    'loudnorm=I=-16:LRA=11:TP=-1.5',
    `measured_I=${stats.input_i}`,
    `measured_TP=${stats.input_tp}`,
    `measured_LRA=${stats.input_lra}`,
    `measured_thresh=${stats.input_thresh}`,
    `offset=${stats.target_offset}`,
    'linear=true',
    'print_format=summary',
  ].join(':');

  console.log('响度第二遍：写入 -16 LUFS / -1.5 dBTP 音轨');
  await run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    input,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0',
    '-c:v',
    'copy',
    '-af',
    filter,
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-map_metadata',
    '-1',
    '-movflags',
    '+faststart',
    output,
  ]);
};

const main = async () => {
  const total = validate();
  fs.mkdirSync(workDir, {recursive: true});
  fs.mkdirSync(path.dirname(outputAbsolute), {recursive: true});
  console.log(`EDL：${edl.ranges.length} 段，目标时长 ${total.toFixed(2)} 秒，并行数 ${workers}`);

  await renderWithWorkers();

  const concatList = path.join(workDir, 'concat.txt');
  fs.writeFileSync(
    concatList,
    edl.ranges.map((_, index) => `file '${segmentPath(index).replaceAll("'", "'\\''")}'`).join('\n') + '\n',
  );
  const base = path.join(workDir, 'rough_prenorm.mp4');
  console.log('无损拼接片段');
  await run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatList,
    '-c',
    'copy',
    '-map_metadata',
    '-1',
    '-movflags',
    '+faststart',
    base,
  ]);

  await normalizeAudio(base, outputAbsolute);
  const sizeMb = fs.statSync(outputAbsolute).size / 1024 / 1024;
  console.log(`粗剪已生成：${outputAbsolute}（${sizeMb.toFixed(1)} MB）`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
