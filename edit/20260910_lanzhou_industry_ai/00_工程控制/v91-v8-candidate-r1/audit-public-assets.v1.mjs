#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const relative = (value) => path.relative(projectRoot, value).split(path.sep).join('/');
const publicDir = path.join(projectRoot, 'remotion/public-lanzhou-industry-ai-v91-r1');
const controlDir = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/00_工程控制/v91-v8-candidate-r1',
);
const qaDir = path.join(
  projectRoot,
  'edit/20260910_lanzhou_industry_ai/06_预览与质检/V9.1_V8候选_r1',
);
const probeDir = path.join(qaDir, 'ffprobe');
mkdirSync(probeDir, {recursive: true});

const sha256 = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');

const run = (binary, args, label) => {
  const result = spawnSync(binary, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    label,
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? null,
  };
};

const mediaSpecs = [
  {
    id: 'R01',
    role: 'canonical-render-proxy',
    path: path.join(publicDir, 'R01.mp4'),
    source:
      'edit/20260910_lanzhou_industry_ai/01_原始口播/copy_B71E2E7B-29AC-4653-AC9C-9D4A3C3D3AB6.MOV',
    transfer: 'ffmpeg-transcode-h264-aac-1920x1080-30fps-crf17',
    audioPolicy: 'canonical-voice',
  },
  {
    id: 'P01',
    role: 'user-paper-video-B04',
    path: path.join(publicDir, 'P01.mp4'),
    source:
      'edit/20260910_lanzhou_industry_ai/04_纸艺视频待验收/20260910_r4_P01_B04_待确认生成.mp4',
    transfer: 'byte-identical-copy',
    audioPolicy: 'composition-muted',
  },
  {
    id: 'P02',
    role: 'user-paper-video-B07',
    path: path.join(publicDir, 'P02.mp4'),
    source:
      'edit/20260910_lanzhou_industry_ai/04_纸艺视频待验收/20260910_r4_P02_B07_待确认生成.mp4',
    transfer: 'byte-identical-copy',
    audioPolicy: 'composition-muted',
  },
  {
    id: 'P03',
    role: 'user-paper-video-B10',
    path: path.join(publicDir, 'P03.mp4'),
    source: 'edit/20260910_lanzhou_industry_ai/04_纸艺视频待验收/视频_4.mp4',
    transfer: 'byte-identical-copy',
    audioPolicy: 'composition-muted',
  },
  {
    id: 'P04',
    role: 'user-paper-video-B11',
    path: path.join(publicDir, 'P04.mp4'),
    source: 'edit/20260910_lanzhou_industry_ai/04_纸艺视频待验收/视频_2.mp4',
    transfer: 'byte-identical-copy',
    audioPolicy: 'composition-muted',
  },
  {
    id: 'P05',
    role: 'user-paper-video-B15',
    path: path.join(publicDir, 'P05.mp4'),
    source: 'edit/20260910_lanzhou_industry_ai/04_纸艺视频待验收/视频_3.mp4',
    transfer: 'byte-identical-copy',
    audioPolicy: 'composition-muted',
  },
  {
    id: 'P06',
    role: 'user-paper-video-B17',
    path: path.join(publicDir, 'P06.mp4'),
    source: 'edit/20260910_lanzhou_industry_ai/04_纸艺视频待验收/视频.mp4',
    transfer: 'byte-identical-copy',
    audioPolicy: 'composition-muted',
  },
];

const mediaResults = [];
for (const spec of mediaSpecs) {
  const probeResult = run(
    'ffprobe',
    ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', spec.path],
    `${spec.id}-ffprobe`,
  );
  let probe = null;
  if (probeResult.ok) {
    probe = JSON.parse(probeResult.stdout);
    writeFileSync(
      path.join(probeDir, `${spec.id}.ffprobe.json`),
      `${JSON.stringify(probe, null, 2)}\n`,
    );
  }
  const decodeResult = run(
    'ffmpeg',
    ['-v', 'error', '-i', spec.path, '-map', '0:v:0', '-map', '0:a:0?', '-f', 'null', '-'],
    `${spec.id}-full-decode`,
  );
  const sourcePath = path.join(projectRoot, spec.source);
  const outputSha256 = sha256(spec.path);
  const sourceSha256 = sha256(sourcePath);
  const video = probe?.streams?.find((stream) => stream.codec_type === 'video') ?? null;
  const audio = probe?.streams?.find((stream) => stream.codec_type === 'audio') ?? null;
  mediaResults.push({
    id: spec.id,
    role: spec.role,
    path: relative(spec.path),
    source: spec.source,
    transfer: spec.transfer,
    audioPolicy: spec.audioPolicy,
    bytes: statSync(spec.path).size,
    sha256: outputSha256,
    sourceSha256,
    byteIdenticalToSource:
      statSync(spec.path).size === statSync(sourcePath).size && outputSha256 === sourceSha256,
    probe: probe
      ? {
          durationSeconds: Number(probe.format?.duration ?? 0),
          formatName: probe.format?.format_name ?? null,
          video: video
            ? {
                codec: video.codec_name,
                profile: video.profile,
                pixelFormat: video.pix_fmt,
                width: video.width,
                height: video.height,
                frameRate: video.avg_frame_rate,
              }
            : null,
          audio: audio
            ? {
                codec: audio.codec_name,
                sampleRate: Number(audio.sample_rate),
                channels: audio.channels,
              }
            : null,
        }
      : null,
    ffprobeStatus: probeResult.ok ? 'passed' : 'failed',
    fullDecodeStatus: decodeResult.ok ? 'passed' : 'failed',
    decodeError: decodeResult.ok
      ? null
      : [decodeResult.error, decodeResult.stderr].filter(Boolean).join('\n'),
  });
}

const sfxSourceDir = path.join(projectRoot, 'remotion/public/audio/koubo-sfx-v8');
const sfxTargetDir = path.join(publicDir, 'sfx');
const sourceSfx = readdirSync(sfxSourceDir)
  .filter((name) => name.endsWith('.wav'))
  .sort();
const copiedSfx = readdirSync(sfxTargetDir)
  .filter((name) => name.endsWith('.wav'))
  .sort();
const sfx = sourceSfx.map((name) => {
  const source = path.join(sfxSourceDir, name);
  const copy = path.join(sfxTargetDir, name);
  const sourceSha256 = sha256(source);
  const copySha256 = sha256(copy);
  return {
    name,
    source: relative(source),
    copy: relative(copy),
    sha256: copySha256,
    byteIdenticalToSource:
      statSync(source).size === statSync(copy).size && sourceSha256 === copySha256,
  };
});

const allMediaProbePassed = mediaResults.every((item) => item.ffprobeStatus === 'passed');
const allMediaDecodePassed = mediaResults.every((item) => item.fullDecodeStatus === 'passed');
const allPaperCopiesMatch = mediaResults
  .filter((item) => item.id.startsWith('P'))
  .every((item) => item.byteIdenticalToSource);
const allSfxCopied =
  sourceSfx.length === copiedSfx.length &&
  sourceSfx.every((name, index) => copiedSfx[index] === name) &&
  sfx.every((item) => item.byteIdenticalToSource);
const r01 = mediaResults.find((item) => item.id === 'R01');
const proxySpecPassed = Boolean(
  r01?.probe?.video?.codec === 'h264' &&
    r01.probe.video.width === 1920 &&
    r01.probe.video.height === 1080 &&
    r01.probe.video.frameRate === '30/1' &&
    r01.probe.video.pixelFormat === 'yuv420p' &&
    r01.probe.audio?.codec === 'aac' &&
    r01.probe.audio.sampleRate === 48000,
);

const manifest = {
  schemaVersion: 'lanzhou-industry-ai-v91-v8-asset-manifest/v1',
  createdAt: new Date().toISOString(),
  taskId: 'task-20260910T105427Z-a149c6de',
  revisionId: '20260911-lanzhou-industry-ai-v91-v8-candidate-r1',
  publicDir: relative(publicDir),
  canonicalAudioPolicy: {
    source: 'R01.mp4',
    authority: 'recorded-audio',
    paperAndAuxiliaryMediaMuted: true,
  },
  media: mediaResults,
  captions: {
    source:
      'edit/20260910_lanzhou_industry_ai/05_实录与字幕/actual-spoken.bilingual.candidate.v1.json',
    publicArray: `${relative(publicDir)}/captions.json`,
    sha256: sha256(path.join(publicDir, 'captions.json')),
    status: 'candidate-needs-user-audio-review',
    formalAllowed: false,
  },
  sfx: {
    sourceDirectory: relative(sfxSourceDir),
    copyDirectory: relative(sfxTargetDir),
    sourceCount: sourceSfx.length,
    copiedCount: copiedSfx.length,
    allByteIdentical: allSfxCopied,
    items: sfx,
  },
  checks: {
    allMediaProbePassed,
    allMediaDecodePassed,
    r01ProxySpecPassed: proxySpecPassed,
    allSixPaperCopiesByteIdentical: allPaperCopiesMatch,
    allV8SfxCopiedByteIdentically: allSfxCopied,
  },
  status:
    allMediaProbePassed &&
    allMediaDecodePassed &&
    proxySpecPassed &&
    allPaperCopiesMatch &&
    allSfxCopied
      ? 'asset-preparation-passed'
      : 'asset-preparation-failed',
};

const decodeReport = {
  schemaVersion: 'lanzhou-industry-ai-media-decode-report/v1',
  createdAt: manifest.createdAt,
  media: mediaResults.map((item) => ({
    id: item.id,
    path: item.path,
    sha256: item.sha256,
    ffprobeStatus: item.ffprobeStatus,
    fullDecodeStatus: item.fullDecodeStatus,
    decodeError: item.decodeError,
  })),
  passed: allMediaProbePassed && allMediaDecodePassed,
};

writeFileSync(
  path.join(controlDir, 'asset-manifest.v1.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
writeFileSync(
  path.join(qaDir, 'media-decode-report.v1.json'),
  `${JSON.stringify(decodeReport, null, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      status: manifest.status,
      mediaCount: mediaResults.length,
      mediaDurationSeconds: mediaResults.map((item) => [item.id, item.probe?.durationSeconds]),
      sfxCount: copiedSfx.length,
      captionsSha256: manifest.captions.sha256,
    },
    null,
    2,
  ),
);
