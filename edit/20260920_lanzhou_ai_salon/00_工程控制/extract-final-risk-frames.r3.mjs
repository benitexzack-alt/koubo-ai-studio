import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const jobRelative =
  'workflow/jobs/20260920_lanzhou_ai_salon_v8_r3.production.json';
const runManifestRelative =
  'edit/20260920_lanzhou_ai_salon/07_预览与质检/正式R3/run-manifest.json';
const ownedQaRootRelative =
  'edit/20260920_lanzhou_ai_salon/07_预览与质检/正式R3';
const outputRelative = `${ownedQaRootRelative}/final-risk-frames`;
const expectedCandidateRelative =
  'edit/20260920_lanzhou_ai_salon/08_正式成片/兰州AI实践者共创沙龙第一期_V8_R3_1080P_正式候选.mp4';

const absolute = (relativePath) => path.resolve(root, relativePath);
const relative = (absolutePath) =>
  path.relative(root, absolutePath).split(path.sep).join('/');
const hashFile = (filePath) =>
  createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
const fail = (message) => {
  throw new Error(message);
};
const run = (binary, args, {json = false} = {}) => {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    fail(`${binary} 执行失败：${result.stderr || result.stdout || result.error?.message}`);
  }
  return json ? JSON.parse(result.stdout) : result.stdout;
};

const job = readJson(jobRelative);
const runManifest = readJson(runManifestRelative);
const source = absolute(job.formal?.finalOutput ?? '');
const outputDirectory = absolute(outputRelative);
const ownedQaRoot = absolute(ownedQaRootRelative);

if (
  job.jobId !== '20260920-lanzhou-ai-salon-v8-r3-formal' ||
  job.videoId !== 'LANZHOU_AI_SALON_20260920_FINAL_R3' ||
  job.formal?.finalOutput !== expectedCandidateRelative
) {
  fail('R3 任务身份或正式候选路径不一致');
}
if (
  outputDirectory !== path.join(ownedQaRoot, 'final-risk-frames') ||
  !outputDirectory.startsWith(`${ownedQaRoot}${path.sep}`)
) {
  fail('风险帧清理目录没有严格限制在正式R3目录');
}
if (!fs.existsSync(source) || !fs.lstatSync(source).isFile()) {
  fail(`R3 正式候选不存在：${source}`);
}

const sourceSha256 = hashFile(source);
const sourceBytes = fs.statSync(source).size;
if (
  runManifest.status !== 'passed' ||
  runManifest.command !== 'formal' ||
  runManifest.formalQa?.status !== 'passed' ||
  runManifest.formalQa?.output !== expectedCandidateRelative ||
  runManifest.formalQa?.sha256 !== sourceSha256 ||
  runManifest.formalQa?.sizeBytes !== sourceBytes
) {
  fail('R3 正式候选与 formal runner 的 passed QA 回执不一致');
}

const probe = run(
  'ffprobe',
  [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate,nb_frames,sample_rate,channels',
    '-of',
    'json',
    source,
  ],
  {json: true},
);
const video = probe.streams?.find((stream) => stream.codec_type === 'video');
const audio = probe.streams?.find((stream) => stream.codec_type === 'audio');
if (
  video?.codec_name !== 'h264' ||
  video?.width !== 1920 ||
  video?.height !== 1080 ||
  video?.r_frame_rate !== '30/1' ||
  video?.nb_frames !== '18413' ||
  audio?.codec_name !== 'aac' ||
  audio?.sample_rate !== '48000' ||
  audio?.channels !== 2
) {
  fail('R3 正式候选媒体规格不符合固定 18413 帧合同');
}

const entries = job.riskFrames?.entries ?? [];
if (
  job.riskFrames?.enabled !== true ||
  job.riskFrames?.fullResolution !== true ||
  entries.length !== 41
) {
  fail(`R3 风险帧合同异常：${entries.length}`);
}

fs.rmSync(outputDirectory, {recursive: true, force: true});
fs.mkdirSync(outputDirectory, {recursive: true});

const frames = entries.map((entry, index) => {
  const safeLayer = entry.layerIds.join('-').replaceAll(/[^A-Za-z0-9_-]/gu, '');
  const timestamp = Number(entry.time).toFixed(3).replace('.', 'p');
  const filename = `${String(index + 1).padStart(2, '0')}-${timestamp}s-${safeLayer}.png`;
  const destination = path.join(outputDirectory, filename);
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    String(entry.time),
    '-i',
    source,
    '-frames:v',
    '1',
    '-vf',
    'scale=1920:1080:flags=lanczos',
    '-y',
    destination,
  ]);
  return {
    index: index + 1,
    timeSeconds: entry.time,
    layerIds: entry.layerIds,
    path: relative(destination),
    sha256: hashFile(destination),
    bytes: fs.statSync(destination).size,
  };
});

const contactSheet = path.join(outputDirectory, 'contact-sheet-final-r3.jpg');
run('montage', [
  ...frames.map((item) => absolute(item.path)),
  '-thumbnail',
  '480x270',
  '-tile',
  '4x',
  '-geometry',
  '+10+32',
  '-background',
  '#111827',
  '-fill',
  'white',
  '-font',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '-pointsize',
  '16',
  '-label',
  '%f',
  '-quality',
  '92',
  contactSheet,
]);

const receiptPath = path.join(
  outputDirectory,
  'risk-frame-extraction.receipt.v2.json',
);
const receipt = {
  schema: 'salon-final-risk-frame-extraction/v2',
  status: 'extracted-for-human-review',
  source: {
    path: relative(source),
    sha256: sourceSha256,
    bytes: sourceBytes,
  },
  sourceRunManifest: {
    path: runManifestRelative,
    sha256: hashFile(absolute(runManifestRelative)),
  },
  media: {
    durationSeconds: Number(probe.format?.duration),
    frameCount: Number(video.nb_frames),
    width: video.width,
    height: video.height,
    fps: 30,
    videoCodec: video.codec_name,
    audioCodec: audio.codec_name,
    audioSampleRate: Number(audio.sample_rate),
    audioChannels: audio.channels,
  },
  expectedFrameCount: 18413,
  extractedCount: frames.length,
  frames,
  contactSheet: {
    path: relative(contactSheet),
    sha256: hashFile(contactSheet),
    bytes: fs.statSync(contactSheet).size,
  },
  fullWatchConfirmed: false,
  publishAuthorized: false,
  reviewBoundary:
    '抽帧与联系表只用于视觉复核，不能替代用户按正常速度完整观看 R3 正式候选。',
  createdAt: new Date().toISOString(),
};
fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

const writtenFiles = fs
  .readdirSync(outputDirectory, {withFileTypes: true})
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);
if (
  frames.length !== 41 ||
  writtenFiles.filter((name) => name.endsWith('.png')).length !== 41 ||
  !writtenFiles.includes('contact-sheet-final-r3.jpg') ||
  !writtenFiles.includes('risk-frame-extraction.receipt.v2.json')
) {
  fail('R3 风险帧输出数量或回执不完整');
}

console.log(
  JSON.stringify({
    status: receipt.status,
    extractedCount: frames.length,
    sourceSha256,
    receipt: relative(receiptPath),
    contactSheet: receipt.contactSheet,
    fullWatchConfirmed: false,
    publishAuthorized: false,
  }),
);
