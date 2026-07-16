import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const [inputArg, outputArg] = process.argv.slice(2);

if (!inputArg || !outputArg) {
  console.error('用法：node tools/prepare-apple-hdr-sdr-proxy.mjs <HDR输入.mov> <SDR输出.mp4>');
  process.exit(1);
}

const root = process.cwd();
const input = path.resolve(root, inputArg);
const output = path.resolve(root, outputArg);

if (!fs.existsSync(input)) {
  console.error(`输入素材不存在：${input}`);
  process.exit(1);
}

const run = (command, args) => {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8'});
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().slice(-5000);
    throw new Error(`${command} 退出码 ${result.status}\n${detail}`);
  }
  return result;
};

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koubo-hdr-sdr-'));
const appleIntermediate = path.join(tempDir, 'apple-sdr.mov');

try {
  fs.mkdirSync(path.dirname(output), {recursive: true});

  console.log('第一步：使用 macOS 媒体管线把 HLG / Dolby Vision 基础层转换为 SDR BT.709');
  run('/usr/bin/avconvert', [
    '--source',
    input,
    '--preset',
    'Preset1920x1080',
    '--output',
    appleIntermediate,
    '--replace',
  ]);

  console.log('第二步：统一为 1920×1080、30fps、H.264，并彻底移除源元数据和音轨');
  run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    appleIntermediate,
    '-map',
    '0:v:0',
    '-vf',
    'fps=30,scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-profile:v',
    'high',
    '-level:v',
    '4.2',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-map_metadata',
    '-1',
    '-movflags',
    '+faststart',
    output,
  ]);

  const probe = run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=codec_name,width,height,avg_frame_rate,pix_fmt,color_space,color_transfer,color_primaries:format=duration:format_tags',
    '-of',
    'json',
    output,
  ]);
  const info = JSON.parse(probe.stdout);
  const video = info.streams?.[0] ?? {};
  const tags = info.format?.tags ?? {};
  const forbiddenMetadata = Object.keys(tags).filter((key) =>
    /(location|make|model|creation|software)/i.test(key),
  );

  if (
    video.codec_name !== 'h264' ||
    video.width !== 1920 ||
    video.height !== 1080 ||
    video.pix_fmt !== 'yuv420p' ||
    video.color_space !== 'bt709' ||
    video.color_transfer !== 'bt709' ||
    video.color_primaries !== 'bt709' ||
    forbiddenMetadata.length > 0
  ) {
    throw new Error(`代理规格或隐私校验失败：${JSON.stringify({video, forbiddenMetadata})}`);
  }

  console.log(
    `代理已生成：${output}（${Number(info.format.duration).toFixed(3)} 秒，H.264 / SDR BT.709，源元数据已移除）`,
  );
} finally {
  fs.rmSync(tempDir, {recursive: true, force: true});
}
