#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(
  projectRoot,
  'assets/sfx/koubo-sfx-v3-candidates/manifest.json',
);
const force = process.argv.includes('--force');

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));
const sha256 = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');
const writeJsonAtomic = (filePath, value) => {
  const temporary = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporary, filePath);
};
const fail = (message) => {
  throw new Error(message);
};
const sleep = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const browserHeaders = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/136 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/octet-stream;q=0.9,*/*;q=0.8',
  referer: 'https://mixkit.co/free-sound-effects/',
};
const resolveOfficialDownloadUrl = async (item) => {
  const downloadPageUrl = `https://mixkit.co/free-sound-effects/download/${item.mixkit_id}/?context=item+grid`;
  const modalResponse = await fetch(downloadPageUrl, {headers: browserHeaders});
  if (!modalResponse.ok) {
    fail(`官方下载弹窗请求失败 ${item.mixkit_id}：HTTP ${modalResponse.status}`);
  }
  const modalHtml = await modalResponse.text();
  const matched = modalHtml.match(
    /data-download--modal-url-value="([^"]+)"/,
  );
  if (!matched?.[1]) {
    fail(`官方下载弹窗未返回文件地址：${item.mixkit_id}`);
  }
  item.download_page_url = downloadPageUrl;
  item.source_url = matched[1].replaceAll('&amp;', '&');
  return item.source_url;
};

const manifest = readJson(manifestPath);
if (manifest.status !== 'candidate-only-user-audition-required') {
  fail('候选音效包状态异常，停止处理。');
}

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const ffmpegCheck = spawnSync(ffmpeg, ['-version'], {encoding: 'utf8'});
if (ffmpegCheck.status !== 0) {
  fail('找不到 ffmpeg，无法统一候选音效规格。');
}
const ffprobeCheck = spawnSync(ffprobe, ['-version'], {encoding: 'utf8'});
if (ffprobeCheck.status !== 0) {
  fail('找不到 ffprobe，无法验证候选音效规格。');
}

for (const item of manifest.items ?? []) {
  const sourcePath = resolve(projectRoot, item.source_file);
  const outputPath = resolve(projectRoot, item.output_file);
  mkdirSync(dirname(sourcePath), {recursive: true});
  mkdirSync(dirname(outputPath), {recursive: true});

  if (force || !existsSync(sourcePath)) {
    const officialDownloadUrl = await resolveOfficialDownloadUrl(item);
    const response = await fetch(officialDownloadUrl, {
      headers: {
        ...browserHeaders,
        accept: 'audio/mpeg,audio/wav,application/octet-stream,*/*;q=0.8',
      },
    });
    if (!response.ok) {
      fail(`下载失败 ${item.mixkit_id}：HTTP ${response.status}`);
    }
    writeFileSync(sourcePath, Buffer.from(await response.arrayBuffer()));
    await sleep(500);
  }

  if (force || !existsSync(outputPath)) {
    const conversion = spawnSync(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        sourcePath,
        '-ar',
        '48000',
        '-ac',
        '2',
        '-c:a',
        'pcm_s16le',
        outputPath,
      ],
      {encoding: 'utf8'},
    );
    if (conversion.status !== 0) {
      fail(
        `音效转换失败 ${item.mixkit_id}：${conversion.stderr || conversion.stdout}`,
      );
    }
  }

  item.source_sha256 = sha256(sourcePath);
  item.output_sha256 = sha256(outputPath);
  const probe = spawnSync(
    ffprobe,
    [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_name,sample_rate,channels',
      '-of',
      'json',
      outputPath,
    ],
    {encoding: 'utf8'},
  );
  if (probe.status !== 0) {
    fail(`音效规格检查失败 ${item.mixkit_id}：${probe.stderr}`);
  }
  const stream = JSON.parse(probe.stdout).streams?.[0];
  if (
    stream?.codec_name !== 'pcm_s16le' ||
    stream?.sample_rate !== '48000' ||
    stream?.channels !== 2
  ) {
    fail(
      `音效规格不合格 ${item.mixkit_id}：${JSON.stringify(stream)}`,
    );
  }
}

manifest.prepared_at = new Date().toISOString();
manifest.prepared_count = manifest.items.length;
writeJsonAtomic(manifestPath, manifest);

console.log(
  `V3候选音效已本地化：${manifest.items.length}个文件。状态仍为待下一条试听，不自动替换V2。`,
);
