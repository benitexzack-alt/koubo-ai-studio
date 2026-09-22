import {
  createReadStream,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '../../..');
const sourcePath = resolve(
  projectRoot,
  'remotion/public-salon-20260920/media/salon-final-source-sdr-v2.mov',
);
const outputPath = resolve(
  projectRoot,
  'remotion/public-salon-20260920/media/salon-final-proxy-v2.mp4',
);
const receiptPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/06_剪辑工程/final-proxy.receipt.v2.json',
);
const sourceManifestPath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/00_工程控制/final-source.v2.json',
);

const fps = 30;
const frameCount = 18413;
const audioSampleRate = 48000;
const samplesPerFrame = audioSampleRate / fps;
const sampleCount = frameCount * samplesPerFrame;
const durationSeconds = frameCount / fps;

// 这些边界来自最终粗剪的硬切检测，并按 30fps 帧边界固定。
// 全片按原顺序、零删减重组，只用于逐位发言者响度匹配。
const speakerSegments = [
  {id: 'host-open', label: '主持人开场', startFrame: 0, endFrame: 3243},
  {id: 'laoxu', label: '老徐', startFrame: 3243, endFrame: 7754},
  {id: 'weiyuanjia', label: '魏元甲', startFrame: 7754, endFrame: 9026},
  {id: 'huangpengfei', label: '黄鹏飞', startFrame: 9026, endFrame: 10305},
  {id: 'li', label: '李女士', startFrame: 10305, endFrame: 11595},
  {id: 'hongyan', label: '洪岩', startFrame: 11595, endFrame: 14027},
  {id: 'geyongpeng', label: '葛永鹏', startFrame: 14027, endFrame: 15325},
  {id: 'hanzhixin', label: '韩志鑫', startFrame: 15325, endFrame: 16477},
  {id: 'host-close', label: '主持人结尾', startFrame: 16477, endFrame: frameCount},
];

const hashFile = async (filePath) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
};

const originalSourcePath = resolve(
  projectRoot,
  'edit/20260920_lanzhou_ai_salon/01_原始素材/copy_63E2AF15-FCCC-4042-A5F1-7616B6D8BA30.MOV',
);
const originalSourceSha256 = await hashFile(originalSourcePath);
const expectedOriginalSha256 =
  '0bfdd6e411bbb6c97aeece55b55d0e68b63528367706cdf58c0f45f5c46617fd';
if (originalSourceSha256 !== expectedOriginalSha256) {
  throw new Error(`最终源哈希不匹配：${originalSourceSha256}`);
}

mkdirSync(dirname(outputPath), {recursive: true});
mkdirSync(dirname(receiptPath), {recursive: true});
mkdirSync(dirname(sourceManifestPath), {recursive: true});

const videoSplitOutputs = speakerSegments.map((_, index) => `[vsrc${index}]`).join('');
const audioSplitOutputs = speakerSegments.map((_, index) => `[asrc${index}]`).join('');
const filters = [
  `[0:v]fps=${fps},trim=start_frame=0:end_frame=${frameCount},` +
    `scale=1920:1080:flags=lanczos,format=yuv420p,` +
    `setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709,` +
    `split=${speakerSegments.length}${videoSplitOutputs}`,
  `[0:a]aresample=${audioSampleRate}:first_pts=0,apad=whole_len=${sampleCount},` +
    `atrim=start_sample=0:end_sample=${sampleCount},` +
    `asplit=${speakerSegments.length}${audioSplitOutputs}`,
];
const concatInputs = [];

for (const [index, segment] of speakerSegments.entries()) {
  const startSample = segment.startFrame * samplesPerFrame;
  const endSample = segment.endFrame * samplesPerFrame;
  const segmentFrames = segment.endFrame - segment.startFrame;
  const segmentDuration = segmentFrames / fps;
  filters.push(
    `[vsrc${index}]trim=start_frame=${segment.startFrame}:end_frame=${segment.endFrame},` +
      `setpts=N/(${fps}*TB)[v${index}]`,
  );
  filters.push(
    `[asrc${index}]atrim=start_sample=${startSample}:end_sample=${endSample},` +
      `asetpts=N/SR/TB,loudnorm=I=-16:LRA=7:TP=-2,aresample=${audioSampleRate},` +
      `apad=whole_len=${segmentFrames * samplesPerFrame},` +
      `atrim=start_sample=0:end_sample=${segmentFrames * samplesPerFrame},` +
      `afade=t=in:st=0:d=0.008,` +
      `afade=t=out:st=${Math.max(0, segmentDuration - 0.008).toFixed(6)}:d=0.008,` +
      `asetpts=N/SR/TB[a${index}]`,
  );
  concatInputs.push(`[v${index}][a${index}]`);
}
filters.push(
  `${concatInputs.join('')}concat=n=${speakerSegments.length}:v=1:a=1[vout][aout]`,
);

const render = spawnSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-y',
    '-i',
    sourcePath,
    '-filter_complex',
    filters.join(';'),
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
    String(audioSampleRate),
    '-movflags',
    '+faststart',
    outputPath,
  ],
  {cwd: projectRoot, stdio: 'inherit'},
);
if (render.status !== 0) process.exit(render.status ?? 1);

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
if (probe.status !== 0) throw new Error(probe.stderr || 'ffprobe failed');
const probeJson = JSON.parse(probe.stdout);
const video = probeJson.streams.find((stream) => stream.codec_type === 'video');
if (Number(video?.nb_frames) !== frameCount) {
  throw new Error(`代理片帧数不匹配：expected=${frameCount}, actual=${video?.nb_frames}`);
}

const outputSha256 = await hashFile(outputPath);
const convertedSourceSha256 = await hashFile(sourcePath);
const segments = speakerSegments.map((segment) => ({
  ...segment,
  startSeconds: Number((segment.startFrame / fps).toFixed(6)),
  endSeconds: Number((segment.endFrame / fps).toFixed(6)),
  frameCount: segment.endFrame - segment.startFrame,
}));
const sourceManifest = {
  schemaVersion: 2,
  authority: 'user-designated-final-video-source',
  original: {
    path: 'edit/20260920_lanzhou_ai_salon/01_原始素材/copy_63E2AF15-FCCC-4042-A5F1-7616B6D8BA30.MOV',
    sha256: originalSourceSha256,
    immutable: true,
  },
  convertedSource: {
    path: 'remotion/public-salon-20260920/media/salon-final-source-sdr-v2.mov',
    sha256: convertedSourceSha256,
    colorTransform: 'Apple AVFoundation Preset1920x1080: BT.2020 HLG/Dolby Vision to BT.709 SDR',
  },
  timing: {fps, frameCount, durationSeconds},
  semanticsPolicy: 'The actual recorded audio in this final source is the sole subtitle and semantic text authority.',
  cardCorrections: [
    '黄鹏飞｜企业 AI 服务实践者｜需求连接 / 销售与交付',
    '葛永鹏｜西部奥体体育',
    '韩志鑫｜大四学生',
  ],
  speakerSegments: segments,
};
const receipt = {
  schemaVersion: 2,
  videoId: 'LANZHOU_AI_SALON_20260920_FINAL_R2',
  sourceManifest: 'edit/20260920_lanzhou_ai_salon/00_工程控制/final-source.v2.json',
  output: 'remotion/public-salon-20260920/media/salon-final-proxy-v2.mp4',
  outputSha256,
  timingPolicy: 'full-user-final-cut-preserved-at-30fps; speaker-boundary-audio-loudness-matching-only',
  audioPolicy: 'per-speaker-segment loudnorm I=-16 LRA=7 TP=-2; exact 1600 samples per video frame',
  ffprobe: probeJson,
  segments,
  createdAt: new Date().toISOString(),
};
writeFileSync(sourceManifestPath, `${JSON.stringify(sourceManifest, null, 2)}\n`);
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
