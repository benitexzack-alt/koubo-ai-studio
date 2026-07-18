#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import {
  mkdtemp,
  mkdir,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

const parseEnv = (source) =>
  Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        if (index === -1) return [line, ''];
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^["']|["']$/g, ''),
        ];
      }),
  );

const envPath = path.join(projectRoot, '.env');
const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const agentsHome = process.env.AGENTS_HOME?.trim()
  ? path.resolve(process.env.AGENTS_HOME)
  : path.join(os.homedir(), '.agents');
const videoUseEnvPath = path.join(agentsHome, 'skills', 'video-use', '.env');
const videoUseEnv = existsSync(videoUseEnvPath)
  ? parseEnv(readFileSync(videoUseEnvPath, 'utf8'))
  : {};
const config = { ...videoUseEnv, ...fileEnv, ...process.env };

const args = process.argv.slice(2);
const valueOf = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const has = (name) => args.includes(`--${name}`);

if (has('help') || has('h')) {
  console.log(`用法：
  node tools/transcribe-elevenlabs.mjs --input <原片> --confirm-upload [选项]

选项：
  --output <JSON>       默认 edit/transcripts/<原片名>.json
  --language <代码>     例如 zh；不填则自动识别
  --num-speakers <数>   已知说话人数，范围 1-32
  --model <模型>        默认 ELEVENLABS_MODEL 或 scribe_v2
  --keyterm <词>        可重复，最多 1000 个；用于专名识别
  --force               允许覆盖已有转写 JSON
  --dry-run             只提取临时音频并检查计划，不上传、不使用 Key
  --confirm-upload      明确同意把提取音频上传至 ElevenLabs
`);
  process.exit(0);
}

const inputValue = valueOf('input');
if (!inputValue) {
  console.error('缺少 --input。运行 node tools/transcribe-elevenlabs.mjs --help 查看用法。');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputValue);
if (!existsSync(inputPath)) {
  console.error(`输入文件不存在：${inputPath}`);
  process.exit(1);
}

const outputPath = valueOf('output')
  ? path.resolve(process.cwd(), valueOf('output'))
  : path.join(projectRoot, 'edit', 'transcripts', `${path.parse(inputPath).name}.json`);
const dryRun = has('dry-run');
const force = has('force');
const confirmed = has('confirm-upload');
const model = valueOf('model') || config.ELEVENLABS_MODEL || 'scribe_v2';
const language = valueOf('language');
const numSpeakersValue = valueOf('num-speakers');
const keyterms = args.flatMap((arg, index) =>
  arg === '--keyterm' && args[index + 1] ? [args[index + 1]] : [],
);

if (existsSync(outputPath) && !force) {
  console.log(`已存在转写缓存，未上传、未覆盖：${outputPath}`);
  process.exit(0);
}

if (!dryRun && !confirmed) {
  console.error('尚未授权上传。确认素材允许交给 ElevenLabs 后，显式增加 --confirm-upload。');
  process.exit(2);
}

const numSpeakers = numSpeakersValue ? Number(numSpeakersValue) : undefined;
if (numSpeakersValue && (!Number.isInteger(numSpeakers) || numSpeakers < 1 || numSpeakers > 32)) {
  console.error('--num-speakers 必须是 1-32 的整数。');
  process.exit(1);
}
if (keyterms.length > 1000) {
  console.error('--keyterm 不能超过 1000 个。');
  process.exit(1);
}

const run = (command, commandArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} 退出码 ${code}：${stderr.trim()}`));
    });
  });

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'koubo-transcribe-'));
const audioPath = path.join(temporaryRoot, `${path.parse(inputPath).name}.wav`);
const ffmpegBin = config.FFMPEG_BIN || 'ffmpeg';

try {
  console.log('正在从原片提取 16kHz 单声道临时音频；不会修改原片。');
  await run(ffmpegBin, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    audioPath,
  ]);

  const audioStat = await stat(audioPath);
  const plan = {
    input: inputPath,
    output: outputPath,
    model,
    language: language || '自动识别',
    numSpeakers: numSpeakers || '自动识别',
    keytermCount: keyterms.length,
    temporaryAudioMiB: Number((audioStat.size / 1024 / 1024).toFixed(2)),
    upload: dryRun ? '否（dry-run）' : '是（已显式授权）',
  };
  console.log(JSON.stringify(plan, null, 2));

  if (dryRun) {
    console.log('预检完成：临时音频已成功提取，没有访问 ElevenLabs。');
    process.exitCode = 0;
  } else {
    const apiKey = config.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY 未配置；请写入项目 .env 或环境变量。');
    }

    const audioHandle = await open(audioPath, 'r');
    try {
      const audioBuffer = await readFile(audioHandle);
      const form = new FormData();
      form.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), path.basename(audioPath));
      form.append('model_id', model);
      form.append('diarize', 'true');
      form.append('tag_audio_events', 'true');
      form.append('timestamps_granularity', 'word');
      if (language) form.append('language_code', language);
      if (numSpeakers) form.append('num_speakers', String(numSpeakers));
      for (const keyterm of keyterms) form.append('keyterms', keyterm);

      const controller = new AbortController();
      const timeoutMs = Number(config.ELEVENLABS_TIMEOUT_MS || 1800000);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: { 'xi-api-key': apiKey },
          body: form,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`ElevenLabs 返回 HTTP ${response.status}：${responseText.slice(0, 800)}`);
      }
      const payload = JSON.parse(responseText);
      if (!Array.isArray(payload.words)) {
        throw new Error('ElevenLabs 响应缺少 words 数组，未写入转写缓存。');
      }
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, {
        encoding: 'utf8',
        flag: force ? 'w' : 'wx',
      });
      console.log(`转写完成：${payload.words.length} 个词级条目，已保存 ${outputPath}`);
    } finally {
      await audioHandle.close();
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
