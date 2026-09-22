import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const jobPath = path.join(
  root,
  'workflow/jobs/20260920_lanzhou_ai_salon_v8_r2.production.json',
);
const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const source = path.resolve(root, job.formal.finalOutput);
const outputDirectory = path.join(
  root,
  'edit/20260920_lanzhou_ai_salon/07_预览与质检/正式R2/final-risk-frames',
);

const hashFile = (filePath) =>
  createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const run = (binary, args) => {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${binary} 执行失败：${result.stderr || result.stdout || result.error?.message}`,
    );
  }
};

if (!fs.existsSync(source)) throw new Error(`正式候选不存在：${source}`);
const entries = job.riskFrames?.entries ?? [];
if (entries.length !== 41) throw new Error(`风险帧数量异常：${entries.length}`);

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
    path: path.relative(root, destination).split(path.sep).join('/'),
    sha256: hashFile(destination),
  };
});

const contactSheet = path.join(outputDirectory, 'contact-sheet-final-r2.jpg');
run('montage', [
  ...frames.map((item) => path.resolve(root, item.path)),
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

const receipt = {
  schema: 'salon-final-risk-frame-extraction/v2',
  status: 'extracted-for-human-review',
  source: {
    path: path.relative(root, source).split(path.sep).join('/'),
    sha256: hashFile(source),
  },
  expectedFrameCount: 18413,
  extractedCount: frames.length,
  frames,
  contactSheet: {
    path: path.relative(root, contactSheet).split(path.sep).join('/'),
    sha256: hashFile(contactSheet),
  },
  reviewBoundary:
    '抽帧与联系表只用于视觉复核，不能替代用户按正常速度完整观看正式候选。',
  createdAt: new Date().toISOString(),
};
fs.writeFileSync(
  path.join(outputDirectory, 'risk-frame-extraction.receipt.v2.json'),
  `${JSON.stringify(receipt, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    status: receipt.status,
    extractedCount: frames.length,
    sourceSha256: receipt.source.sha256,
    contactSheet: receipt.contactSheet.path,
  }),
);
