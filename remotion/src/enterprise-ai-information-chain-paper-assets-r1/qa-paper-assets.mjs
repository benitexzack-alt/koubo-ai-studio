import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';

const projectRoot = '/Users/pc/Documents/口播';
const revisionRoot = resolve(
  projectRoot,
  'edit/20260826_enterprise_ai_information_chain/04_Remotion规划/paper-assets-r1',
);
const manifestPath = join(revisionRoot, 'plan/paper-assets-manifest.v1.json');
const qaPath = join(revisionRoot, 'qa/paper-assets-machine-qa.v1.json');
const sumsPath = join(revisionRoot, 'qa/SHA256SUMS.txt');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const sha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

const runText = (command, args) =>
  execFileSync(command, args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});

const probe = (path) =>
  JSON.parse(
    runText('ffprobe', [
      '-v',
      'error',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      path,
    ]),
  );

const filterLog = (path, filter) => {
  const result = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', path, '-vf', filter, '-an', '-f', 'null', '-'],
    {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024},
  );
  return {
    exitCode: result.status,
    log: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  };
};

const volumeLog = (path) => {
  const result = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', path, '-af', 'volumedetect', '-vn', '-f', 'null', '-'],
    {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024},
  );
  const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const mean = log.match(/mean_volume:\s*(-?[\d.]+|[-+]?inf) dB/i)?.[1] ?? null;
  const max = log.match(/max_volume:\s*(-?[\d.]+|[-+]?inf) dB/i)?.[1] ?? null;
  return {exitCode: result.status, meanVolumeDb: mean, maxVolumeDb: max};
};

const decode = (path) => {
  const result = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', path, '-map', '0', '-f', 'null', '-'],
    {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024},
  );
  return {
    exitCode: result.status,
    errors: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
};

const videoHash = (path) =>
  runText('ffmpeg', [
    '-v',
    'error',
    '-i',
    path,
    '-map',
    '0:v:0',
    '-c:v',
    'copy',
    '-f',
    'hash',
    '-hash',
    'sha256',
    '-',
  ])
    .trim()
    .replace(/^SHA256=/, '')
    .toLowerCase();

const parseFps = (value) => {
  const [numerator, denominator] = String(value).split('/').map(Number);
  return denominator ? numerator / denominator : numerator;
};

const parseFreezeSegments = (log) => {
  const starts = [...log.matchAll(/freeze_start:\s*([\d.]+)/g)].map((match) => Number(match[1]));
  const ends = [...log.matchAll(/freeze_end:\s*([\d.]+)/g)].map((match) => Number(match[1]));
  const durations = [...log.matchAll(/freeze_duration:\s*([\d.]+)/g)].map((match) => Number(match[1]));
  return durations.map((durationSeconds, index) => ({
    startSeconds: starts[index] ?? null,
    endSeconds: ends[index] ?? null,
    durationSeconds,
    classification: durationSeconds <= 2.5 ? 'intentional-reading-hold' : 'abnormal-long-freeze',
  }));
};

const findById = (dir, id) => {
  const matches = readdirSync(dir).filter(
    (name) => name.startsWith(`${id}_`) && name.endsWith('.mp4'),
  );
  if (matches.length !== 1) {
    throw new Error(`${dir} 中 ${id} 应唯一匹配，实际 ${matches.length} 条`);
  }
  return join(dir, matches[0]);
};

const results = [];
const errors = [];

for (const shot of manifest.shots) {
  const withSfx = findById(join(revisionRoot, 'with-sfx'), shot.id);
  const noSfx = findById(join(revisionRoot, 'no-sfx'), shot.id);
  const withProbe = probe(withSfx);
  const noProbe = probe(noSfx);
  const withVideo = withProbe.streams.find((stream) => stream.codec_type === 'video');
  const withAudio = withProbe.streams.find((stream) => stream.codec_type === 'audio');
  const noVideo = noProbe.streams.find((stream) => stream.codec_type === 'video');
  const noAudio = noProbe.streams.find((stream) => stream.codec_type === 'audio');
  const withDuration = Number(withProbe.format.duration);
  const noDuration = Number(noProbe.format.duration);
  const withDecode = decode(withSfx);
  const noDecode = decode(noSfx);
  const black = filterLog(withSfx, 'blackdetect=d=0.25:pic_th=0.98');
  const freeze = filterLog(withSfx, 'freezedetect=n=0.001:d=1.5');
  const freezeSegments = parseFreezeSegments(freeze.log);
  const volume = volumeLog(withSfx);
  const withVideoHash = videoHash(withSfx);
  const noVideoHash = videoHash(noSfx);
  const checks = {
    withSfxVideoSpec:
      withVideo?.codec_name === 'h264' &&
      withVideo?.width === manifest.render.width &&
      withVideo?.height === manifest.render.height &&
      Math.abs(parseFps(withVideo?.avg_frame_rate) - manifest.render.fps) < 0.01,
    noSfxVideoSpec:
      noVideo?.codec_name === 'h264' &&
      noVideo?.width === manifest.render.width &&
      noVideo?.height === manifest.render.height &&
      Math.abs(parseFps(noVideo?.avg_frame_rate) - manifest.render.fps) < 0.01,
    duration:
      Math.abs(withDuration - shot.durationSeconds) <= 0.12 &&
      Math.abs(noDuration - shot.durationSeconds) <= 0.12,
    withSfxAudio: withAudio?.codec_name === 'aac',
    noSfxAudioAbsent: !noAudio,
    fullDecode: withDecode.exitCode === 0 && noDecode.exitCode === 0,
    videoBitstreamSame: withVideoHash === noVideoHash,
    noBlackSegment: !black.log.includes('black_start:'),
    noAbnormalLongFreeze: freezeSegments.every((segment) => segment.durationSeconds <= 2.5),
    nonSilentSfx:
      volume.exitCode === 0 &&
      volume.maxVolumeDb !== null &&
      !String(volume.maxVolumeDb).toLowerCase().includes('inf'),
  };
  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failed.length > 0) {
    errors.push({id: shot.id, failed});
  }
  results.push({
    id: shot.id,
    title: shot.title,
    expectedDurationSeconds: shot.durationSeconds,
    withSfx: {
      path: withSfx,
      file: basename(withSfx),
      sha256: sha256(withSfx),
      durationSeconds: withDuration,
      width: withVideo?.width ?? null,
      height: withVideo?.height ?? null,
      fps: parseFps(withVideo?.avg_frame_rate),
      codec: withVideo?.codec_name ?? null,
      pixelFormat: withVideo?.pix_fmt ?? null,
      audioCodec: withAudio?.codec_name ?? null,
      meanVolumeDb: volume.meanVolumeDb,
      maxVolumeDb: volume.maxVolumeDb,
    },
    noSfx: {
      path: noSfx,
      file: basename(noSfx),
      sha256: sha256(noSfx),
      durationSeconds: noDuration,
      width: noVideo?.width ?? null,
      height: noVideo?.height ?? null,
      fps: parseFps(noVideo?.avg_frame_rate),
      codec: noVideo?.codec_name ?? null,
      pixelFormat: noVideo?.pix_fmt ?? null,
      audioCodec: noAudio?.codec_name ?? null,
    },
    videoBitstreamSha256: withVideoHash,
    checks,
    diagnostics: {
      withDecodeErrors: withDecode.errors,
      noDecodeErrors: noDecode.errors,
      blackdetectExitCode: black.exitCode,
      freezedetectExitCode: freeze.exitCode,
      freezeSegments,
    },
  });
}

const receipt = {
  schemaVersion: 'koubo-paper-assets-machine-qa/v1',
  revisionId: manifest.revisionId,
  generatedAt: new Date().toISOString(),
  authority: manifest.authority,
  candidateOnly: true,
  formalRenderEnabled: false,
  totalShots: results.length,
  expectedDurationSecondsPerVariant: manifest.shots.reduce(
    (sum, shot) => sum + shot.durationSeconds,
    0,
  ),
  passed: errors.length === 0,
  p0: errors.length,
  p1: 0,
  results,
  errors,
};

writeFileSync(qaPath, `${JSON.stringify(receipt, null, 2)}\n`);
const sumLines = [manifestPath, qaPath]
  .concat(results.flatMap((item) => [item.withSfx.path, item.noSfx.path]))
  .map((path) => `${sha256(path)}  ${path}`)
  .join('\n');
writeFileSync(sumsPath, `${sumLines}\n`);

console.log(JSON.stringify({qaPath, sumsPath, passed: receipt.passed, errors}, null, 2));
process.exit(receipt.passed ? 0 : 1);
