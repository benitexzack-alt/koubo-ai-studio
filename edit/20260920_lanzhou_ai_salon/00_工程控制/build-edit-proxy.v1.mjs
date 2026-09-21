import {
  createReadStream,
  readFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve, dirname, join} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../../..');
const edlPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/06_剪辑工程/edl.salon-highlight.v1.json',
);
const outputPath = resolve(
  projectRoot,
  'remotion/public-salon-20260920/media/salon-edit-proxy-v1.mp4',
);
const receiptPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/06_剪辑工程/edit-proxy.receipt.v1.json',
);

const edl = JSON.parse(readFileSync(edlPath, 'utf8'));
const sourcePath = resolve(projectRoot, edl.source);
const cuts = edl.cuts;
const fps = 30;
const audioSampleRate = 48000;
const samplesPerFrame = audioSampleRate / fps;
const expectedFrames = Math.round(edl.targetDurationSeconds * fps);

mkdirSync(dirname(outputPath), {recursive: true});
mkdirSync(dirname(receiptPath), {recursive: true});

const inputArgs = [];
const filterParts = [];
const concatInputs = [];
const segmentDirectory = mkdtempSync(join(tmpdir(), 'salon-sdr-segments-'));
const segmentReceipts = [];

for (const [index, cut] of cuts.entries()) {
  const sourceDuration = Number((cut.sourceEnd - cut.sourceStart).toFixed(3));
  const startFrame = Math.round(cut.timelineStart * fps);
  const endFrame = Math.round(cut.timelineEnd * fps);
  const frameCount = endFrame - startFrame;
  const sampleCount = frameCount * samplesPerFrame;
  const exactDuration = frameCount / fps;
  const segmentPath = join(segmentDirectory, `segment-${String(index).padStart(2, '0')}.mov`);

  // AVFoundation performs the HLG / Dolby Vision to BT.709 SDR conversion.
  // The prior FFmpeg-only path merely changed the colour tags and left the
  // HDR transfer curve unmapped.
  const convert = spawnSync(
    '/usr/bin/avconvert',
    [
      '--source',
      sourcePath,
      '--preset',
      'Preset1920x1080',
      '--output',
      segmentPath,
      '--start',
      cut.sourceStart.toFixed(3),
      '--duration',
      sourceDuration.toFixed(3),
      '--replace',
    ],
    {cwd: projectRoot, stdio: 'inherit'},
  );
  if (convert.status !== 0) {
    rmSync(segmentDirectory, {recursive: true, force: true});
    process.exit(convert.status ?? 1);
  }

  segmentReceipts.push({
    id: cut.id,
    sourceStart: cut.sourceStart,
    sourceEnd: cut.sourceEnd,
    timelineStart: cut.timelineStart,
    timelineEnd: cut.timelineEnd,
    startFrame,
    endFrame,
    frameCount,
    sampleCount,
  });
  inputArgs.push('-i', segmentPath);

  filterParts.push(
    `[${index}:v]fps=${fps},trim=start_frame=0:end_frame=${frameCount},` +
      `scale=1920:1080:flags=lanczos,format=yuv420p,` +
      `setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709,` +
      `setpts=N/(${fps}*TB)[v${index}]`,
  );
  filterParts.push(
    `[${index}:a]aresample=${audioSampleRate}:first_pts=0,` +
      `loudnorm=I=-16:LRA=7:TP=-2,` +
      `aresample=${audioSampleRate},apad=whole_len=${sampleCount},` +
      `atrim=start_sample=0:end_sample=${sampleCount},` +
      `afade=t=in:st=0:d=0.008,` +
      `afade=t=out:st=${Math.max(0, exactDuration - 0.008).toFixed(6)}:d=0.008,` +
      `asetpts=N/SR/TB[a${index}]`,
  );
  concatInputs.push(`[v${index}][a${index}]`);
}

filterParts.push(
  `${concatInputs.join('')}concat=n=${cuts.length}:v=1:a=1[vout][aout]`,
);

const ffmpegArgs = [
  '-hide_banner',
  '-y',
  ...inputArgs,
  '-filter_complex',
  filterParts.join(';'),
  '-map',
  '[vout]',
  '-map',
  '[aout]',
  '-c:v',
  'h264_videotoolbox',
  '-allow_sw',
  '1',
  '-b:v',
  '18M',
  '-maxrate',
  '24M',
  '-bufsize',
  '36M',
  '-tag:v',
  'avc1',
  '-pix_fmt',
  'yuv420p',
  '-color_primaries',
  'bt709',
  '-color_trc',
  'bt709',
  '-colorspace',
  'bt709',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-ar',
  '48000',
  '-movflags',
  '+faststart',
  outputPath,
];

const render = spawnSync('ffmpeg', ffmpegArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
});
if (render.status !== 0) {
  rmSync(segmentDirectory, {recursive: true, force: true});
  process.exit(render.status ?? 1);
}

const probe = spawnSync(
  'ffprobe',
  [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration,sample_rate,channels,color_primaries,color_transfer,color_space',
    '-of',
    'json',
    outputPath,
  ],
  {encoding: 'utf8'},
);
if (probe.status !== 0) {
  rmSync(segmentDirectory, {recursive: true, force: true});
  process.stderr.write(probe.stderr ?? 'ffprobe failed\n');
  process.exit(probe.status ?? 1);
}

const probeJson = JSON.parse(probe.stdout);
const videoStream = probeJson.streams.find((stream) => stream.codec_type === 'video');
if (Number(videoStream?.nb_frames) !== expectedFrames) {
  rmSync(segmentDirectory, {recursive: true, force: true});
  process.stderr.write(
    `代理片帧数不匹配：expected=${expectedFrames}, actual=${videoStream?.nb_frames ?? 'unknown'}\n`,
  );
  process.exit(1);
}

const hash = createHash('sha256');
for await (const chunk of createReadStream(outputPath)) {
  hash.update(chunk);
}
const sha256 = hash.digest('hex');
const receipt = {
  schemaVersion: 1,
  videoId: edl.videoId,
  edl: 'edit/20260920_lanzhou_ai_salon/06_剪辑工程/edl.salon-highlight.v1.json',
  output: 'remotion/public-salon-20260920/media/salon-edit-proxy-v1.mp4',
  expectedDurationSeconds: edl.targetDurationSeconds,
  expectedFrames,
  actualFrames: Number(videoStream.nb_frames),
  timelinePolicy: 'cumulative-edl-boundaries-rounded-to-30fps',
  colorTransform: {
    source: 'BT.2020 HLG / Dolby Vision',
    method: 'Apple AVFoundation avconvert Preset1920x1080',
    output: 'BT.709 SDR yuv420p',
  },
  audioPolicy: edl.audioPolicy,
  sourceSha256: edl.sourceSha256,
  outputSha256: sha256,
  segments: segmentReceipts,
  ffprobe: probeJson,
  createdAt: new Date().toISOString(),
};
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
rmSync(segmentDirectory, {recursive: true, force: true});
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
