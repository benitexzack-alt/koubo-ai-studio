import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(projectRoot, 'remotion/public/audio/koubo-sfx-v8');
const manifestPath = path.join(projectRoot, 'assets/sfx/koubo-sfx-v8/manifest.json');
const targetPeakDbfs = -6;

const packs = [
  {
    id: 'v1',
    directory: 'remotion/public/audio/koubo-sfx-v1',
    license: 'CC0',
    licenseReference: 'assets/sfx/koubo-sfx-v1/manifest.json',
  },
  {
    id: 'v2',
    directory: 'remotion/public/audio/koubo-sfx-v2',
    license: 'Mixkit Free License',
    licenseReference: 'assets/sfx/koubo-sfx-v2/manifest.json',
  },
  {
    id: 'v3',
    directory: 'remotion/public/audio/koubo-sfx-v3-candidates',
    license: 'Mixkit Free License',
    licenseReference: 'assets/sfx/koubo-sfx-v3-candidates/manifest.json',
  },
  {
    id: 'remotion',
    directory: 'remotion/public/audio/remotion-sfx',
    license: 'CC0',
    licenseReference: 'assets/sfx/koubo-sfx-v1/manifest.json',
  },
  {
    id: 'waic',
    directory: 'remotion/public/audio/waic2026-v6',
    license: 'ElevenLabs API generated sound effect',
    licenseReference: 'assets/sfx/waic2026-test/README.md',
  },
];

const run = (binary, args, label) => {
  const result = spawnSync(binary, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${label}失败：\n${result.stderr || result.stdout}`);
  }
  return result;
};
const sha256 = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');
const probePeak = (filePath) => {
  const result = run(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', filePath, '-af', 'volumedetect', '-f', 'null', '-'],
    `检测峰值 ${filePath}`,
  );
  const match = result.stderr.match(/max_volume:\s*(-?[0-9.]+) dB/);
  if (!match) throw new Error(`无法读取峰值：${filePath}`);
  return Number(match[1]);
};
const probeDuration = (filePath) => {
  const result = run(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', filePath],
    `检测时长 ${filePath}`,
  );
  return Number(result.stdout.trim());
};

mkdirSync(outputRoot, {recursive: true});
mkdirSync(path.dirname(manifestPath), {recursive: true});

const items = [];
for (const pack of packs) {
  const sourceDirectory = path.join(projectRoot, pack.directory);
  for (const fileName of readdirSync(sourceDirectory).sort((a, b) => a.localeCompare(b))) {
    if (!/\.wav$/i.test(fileName)) continue;
    const sourcePath = path.join(sourceDirectory, fileName);
    if (!statSync(sourcePath).isFile()) continue;
    const outputName = `${pack.id}-${fileName}`;
    const outputPath = path.join(outputRoot, outputName);
    const sourcePeakDbfs = probePeak(sourcePath);
    const gainDb = targetPeakDbfs - sourcePeakDbfs;
    run(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-i',
        sourcePath,
        '-af',
        `volume=${gainDb.toFixed(3)}dB`,
        '-ar',
        '48000',
        '-ac',
        '2',
        '-c:a',
        'pcm_s16le',
        outputPath,
      ],
      `标准化 ${fileName}`,
    );
    const outputPeakDbfs = probePeak(outputPath);
    items.push({
      id: `${pack.id}-${path.parse(fileName).name}`,
      source: path.relative(projectRoot, sourcePath),
      output: path.relative(projectRoot, outputPath),
      license: pack.license,
      licenseReference: pack.licenseReference,
      sourcePeakDbfs,
      appliedGainDb: Number(gainDb.toFixed(3)),
      outputPeakDbfs,
      durationSeconds: probeDuration(outputPath),
      sourceSha256: sha256(sourcePath),
      outputSha256: sha256(outputPath),
    });
  }
}

const manifest = {
  schemaVersion: 1,
  pack: 'koubo-sfx-v8',
  status: 'candidate-only-user-audition-required',
  createdAt: new Date().toISOString(),
  processing: {
    sampleRate: 48000,
    channels: 2,
    codec: 'pcm_s16le',
    targetPeakDbfs,
    note: '只统一格式和峰值，不改变来源许可；成片仍需同画面有声/无声试听。',
  },
  items,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`V8候选音效：${items.length} 个`);
console.log(path.relative(projectRoot, manifestPath));
