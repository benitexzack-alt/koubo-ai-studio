import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);
const requireFromRemotion = createRequire(new URL('../remotion/package.json', import.meta.url));
const ffmpegBin = process.env.FFMPEG_BIN || 'ffmpeg';

const readPackageVersion = async (name) => {
  const packageJson = new URL(`../remotion/node_modules/${name}/package.json`, import.meta.url);
  const json = JSON.parse(await fs.readFile(packageJson, 'utf8'));
  return json.version;
};

const ffmpegFilters = async () => {
  const {stdout, stderr} = await execFileAsync(ffmpegBin, ['-hide_banner', '-filters']);
  const output = `${stdout}\n${stderr}`;
  const wanted = ['drawtext', 'subtitles', 'zscale', 'tonemap', 'colorspace', 'overlay', 'scale'];
  return Object.fromEntries(wanted.map((name) => [name, output.includes(name)]));
};

const main = async () => {
  const [{stdout: nodeVersion}, {stdout: npmVersion}, {stdout: ffmpegVersion}, filters] = await Promise.all([
    execFileAsync('node', ['-v']),
    execFileAsync('npm', ['-v']),
    execFileAsync(ffmpegBin, ['-version']),
    ffmpegFilters(),
  ]);

  const packages = {};
  for (const name of ['remotion', '@remotion/cli', '@remotion/captions', '@remotion/media', '@remotion/fonts', 'playwright']) {
    packages[name] = await readPackageVersion(name);
  }

  const sharp = requireFromRemotion('sharp');

  console.log(
    JSON.stringify(
      {
        node: nodeVersion.trim(),
        npm: npmVersion.trim(),
        ffmpeg: {
          bin: ffmpegBin,
          version: ffmpegVersion.split('\n')[0],
        },
        packages,
        sharp: sharp.default?.versions?.sharp ?? sharp.versions?.sharp ?? 'installed',
        ffmpegFilters: filters,
        note:
          filters.subtitles && filters.drawtext && filters.zscale
            ? 'FFmpeg 字幕/HDR能力完整。'
            : 'FFmpeg 缺字幕或高质量 HDR 滤镜，当前以 Remotion 字幕/动效为主，FFmpeg 做转码兜底。',
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
