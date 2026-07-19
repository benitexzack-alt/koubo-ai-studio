#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants, createReadStream, createWriteStream } from 'node:fs';
import {
  access,
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://api.eachlabs.ai';
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 600;
const IMAGE_LIMIT_BYTES = 50 * 1024 * 1024;
const VIDEO_LIMIT_BYTES = 200 * 1024 * 1024;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = await realpath(path.resolve(scriptDir, '../../..'));

const parseEnv = (source) => Object.fromEntries(
  source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
      return [key, value];
    }),
);
const projectEnv = await readFile(path.join(projectRoot, '.env'), 'utf8')
  .then(parseEnv)
  .catch((error) => {
    if (error.code === 'ENOENT') return {};
    throw error;
  });
const config = { ...projectEnv, ...process.env };

const OPERATIONS = {
  'remove-background': {
    model: 'eachlabs-bg-remover-v1',
    kind: 'image',
    outputExtensions: new Set(['.png']),
  },
  'upscale-image': {
    model: 'topaz-upscale-image',
    kind: 'image',
    outputExtensions: new Set(['.png', '.jpg', '.jpeg']),
  },
  'upscale-video': {
    model: 'topaz-upscale-video',
    kind: 'video',
    outputExtensions: new Set(['.mp4']),
  },
};

const MIME_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.mp4', 'video/mp4'],
  ['.mov', 'video/quicktime'],
  ['.webm', 'video/webm'],
]);

const INPUT_EXTENSIONS = {
  image: new Set(['.jpg', '.jpeg', '.png', '.webp']),
  video: new Set(['.mp4', '.mov', '.webm']),
};

const VALUE_FLAGS = new Set([
  '--output',
  '--asset-class',
  '--production-state',
  '--scale',
  '--target-fps',
  '--image-model',
]);

const BOOLEAN_FLAGS = new Set([
  '--dry-run',
  '--h264',
  '--confirm-external-processing',
  '--confirm-cost',
  '--help',
]);

const usage = () => {
  console.log(`用法：
  node skills/koubo-asset-prep/scripts/prepare-asset.mjs doctor
  node skills/koubo-asset-prep/scripts/prepare-asset.mjs <operation> <input> --output <path> --asset-class <class> --production-state <state> [options]

operation:
  remove-background  输出透明 PNG
  upscale-image      图片 2x/4x 升清
  upscale-video      视频 2x/4x 升清

必填：
  --output <path>
  --asset-class person|generated|illustrative|evidence
  --production-state ready-for-production

可选：
  --scale 2|4
  --image-model "Standard V2"|"High Fidelity V2"
  --target-fps <整数>
  --h264
  --dry-run

真实调用还必须显式增加：
  --confirm-external-processing --confirm-cost`);
};

const fail = (message) => {
  throw new Error(message);
};

const parseArgs = (args) => {
  const options = {};
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    if (BOOLEAN_FLAGS.has(token)) {
      options[token.slice(2)] = true;
      continue;
    }

    if (!VALUE_FLAGS.has(token)) {
      fail(`未知参数：${token}`);
    }

    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`参数 ${token} 缺少值。`);
    }
    options[token.slice(2)] = value;
    index += 1;
  }

  return { positional, options };
};

const exists = async (target) => {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const isInside = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const relativeToProject = (target) => path.relative(projectRoot, target) || '.';

const parsePositiveInteger = (value, label, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    fail(`${label} 必须是 ${min} 到 ${max} 之间的整数。`);
  }
  return parsed;
};

const resolveHttpsInput = (rawInput) => {
  let url;
  try {
    url = new URL(rawInput);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') {
    fail('外部输入只接受 HTTPS 地址。');
  }
  return url;
};

const inspectInput = async (rawInput, kind) => {
  const inputUrl = resolveHttpsInput(rawInput);
  if (inputUrl) {
    const extension = path.extname(inputUrl.pathname).toLowerCase();
    if (!INPUT_EXTENSIONS[kind].has(extension)) {
      fail(`外部地址扩展名不符合 ${kind} 输入要求：${extension || '无扩展名'}`);
    }
    return {
      sourceType: 'https-url',
      inputUrl: inputUrl.toString(),
      displayInput: `${inputUrl.hostname}${inputUrl.pathname}`,
      extension,
      mimeType: MIME_TYPES.get(extension),
      size: null,
      localPath: null,
    };
  }

  const candidate = path.resolve(process.cwd(), rawInput);
  if (!(await exists(candidate))) {
    fail(`输入素材不存在：${candidate}`);
  }
  const localPath = await realpath(candidate);
  if (!isInside(projectRoot, localPath)) {
    fail('输入素材不在当前口播项目内，已停止处理。');
  }
  const stat = await lstat(localPath);
  if (!stat.isFile()) {
    fail('输入必须是单个文件。');
  }
  const extension = path.extname(localPath).toLowerCase();
  if (!INPUT_EXTENSIONS[kind].has(extension)) {
    fail(`输入格式不符合 ${kind} 要求：${extension || '无扩展名'}`);
  }
  const sizeLimit = kind === 'image' ? IMAGE_LIMIT_BYTES : VIDEO_LIMIT_BYTES;
  if (stat.size > sizeLimit) {
    fail(`输入文件超过项目安全上限：${kind === 'image' ? '50 MB' : '200 MB'}。`);
  }

  return {
    sourceType: 'local-file',
    inputUrl: null,
    displayInput: relativeToProject(localPath),
    extension,
    mimeType: MIME_TYPES.get(extension),
    size: stat.size,
    localPath,
  };
};

const inspectOutput = async (rawOutput, operationConfig, rawInput) => {
  if (!rawOutput) {
    fail('缺少 --output。');
  }
  const lexicalOutput = path.resolve(process.cwd(), rawOutput);
  if (!isInside(projectRoot, lexicalOutput)) {
    fail('输出路径必须位于当前口播项目内。');
  }
  if (rawInput.localPath && lexicalOutput === rawInput.localPath) {
    fail('禁止覆盖原始输入素材。');
  }
  const extension = path.extname(lexicalOutput).toLowerCase();
  if (!operationConfig.outputExtensions.has(extension)) {
    fail(`输出扩展名不正确，允许：${[...operationConfig.outputExtensions].join(', ')}`);
  }
  if (await exists(lexicalOutput)) {
    fail(`输出已存在，禁止覆盖：${lexicalOutput}`);
  }
  const ledgerPath = `${lexicalOutput}.asset-prep.json`;
  if (await exists(ledgerPath)) {
    fail(`处理记录已存在，禁止覆盖：${ledgerPath}`);
  }
  return { lexicalOutput, ledgerPath, extension };
};

const buildModelInput = (operation, publicUrl, options, assetClass, outputExtension) => {
  if (operation === 'remove-background') {
    return { image_url: publicUrl };
  }

  const scale = options.scale
    ? parsePositiveInteger(options.scale, '--scale', { min: 2, max: 4 })
    : 2;
  if (![2, 4].includes(scale)) {
    fail('--scale 当前只允许 2 或 4。');
  }

  if (operation === 'upscale-image') {
    const allowedModels = new Set(['Standard V2', 'High Fidelity V2']);
    const imageModel = options['image-model']
      || (assetClass === 'person' ? 'High Fidelity V2' : 'Standard V2');
    if (!allowedModels.has(imageModel)) {
      fail(`--image-model 当前只允许：${[...allowedModels].join('、')}`);
    }
    return {
      image_url: publicUrl,
      upscale_factor: scale,
      model: imageModel,
      face_enhancement: false,
      output_format: outputExtension === '.png' ? 'png' : 'jpeg',
    };
  }

  const modelInput = {
    video_url: publicUrl,
    upscale_factor: scale,
    h264_output: Boolean(options.h264),
  };
  if (options['target-fps']) {
    modelInput.target_fps = parsePositiveInteger(options['target-fps'], '--target-fps', {
      min: 1,
      max: 120,
    });
  }
  return modelInput;
};

const requestJson = async (url, init, timeoutMs = 60_000) => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const bodyText = await response.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { raw: bodyText.slice(0, 1_000) };
  }
  if (!response.ok) {
    const detail = body.error || body.message || body.raw || `HTTP ${response.status}`;
    fail(`each::labs 请求失败（${response.status}）：${detail}`);
  }
  return body;
};

const sha256File = async (filePath) => {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
};

const requireHttpsUrl = (value, label) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} 不是有效地址。`);
  }
  if (parsed.protocol !== 'https:') {
    fail(`${label} 不是 HTTPS 地址。`);
  }
  return parsed.toString();
};

const presignAndUpload = async (input, apiKey) => {
  const fileType = input.mimeType.startsWith('image/') ? 'image' : 'video';
  const presign = await requestJson(`${API_BASE}/v1/upload/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      content_type: input.mimeType,
      file_type: fileType,
    }),
  });

  if (!presign.presigned_url || !presign.public_url) {
    fail('each::labs 预签名响应缺少上传地址或公开素材地址。');
  }
  const presignedUrl = requireHttpsUrl(presign.presigned_url, '预签名上传地址');
  const publicUrl = requireHttpsUrl(presign.public_url, '模型素材地址');

  const uploadResponse = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': input.mimeType,
      ...(presign.required_headers || {}),
    },
    body: createReadStream(input.localPath),
    duplex: 'half',
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!uploadResponse.ok) {
    fail(`素材上传失败：HTTP ${uploadResponse.status}`);
  }

  return {
    uploadId: presign.id || null,
    publicUrl,
  };
};

const findHttpsUrl = (value) => {
  if (typeof value === 'string') {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' ? value : null;
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findHttpsUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = findHttpsUrl(item);
      if (found) return found;
    }
  }
  return null;
};

const runPrediction = async (model, modelInput, apiKey) => {
  const created = await requestJson(`${API_BASE}/v1/prediction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ model, input: modelInput }),
  });

  const predictionId = created.predictionID || created.prediction_id || created.id;
  if (!predictionId) {
    const immediateUrl = findHttpsUrl(created.output);
    if (immediateUrl) {
      return { predictionId: null, final: created, outputUrl: immediateUrl };
    }
    fail('each::labs 没有返回预测 ID。');
  }

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    const current = await requestJson(`${API_BASE}/v1/prediction/${encodeURIComponent(predictionId)}`, {
      headers: { 'X-API-Key': apiKey },
    });
    const status = String(current.status || '').toLowerCase();

    if (['success', 'completed'].includes(status)) {
      const outputUrl = findHttpsUrl(current.output);
      if (!outputUrl) {
        fail('预测成功，但响应中没有 HTTPS 输出地址。');
      }
      return { predictionId, final: current, outputUrl };
    }
    if (['error', 'failed', 'cancelled', 'canceled'].includes(status)) {
      fail(`模型处理失败（${status}）：${current.error || current.logs || '未提供详情'}`);
    }

    if (attempt === 1 || attempt % 15 === 0) {
      console.error(`模型处理中：${status || '未知状态'}（第 ${attempt} 次检查）`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  fail('模型处理超过 20 分钟，已停止轮询；原始素材未改动。');
};

const downloadExclusive = async (url, outputPath) => {
  const parent = path.dirname(outputPath);
  await mkdir(parent, { recursive: true });
  const realParent = await realpath(parent);
  if (!isInside(projectRoot, realParent)) {
    fail('输出目录通过符号链接逃逸出项目，已停止写入。');
  }
  const finalOutput = path.join(realParent, path.basename(outputPath));
  if (await exists(finalOutput)) {
    fail(`输出已存在，禁止覆盖：${finalOutput}`);
  }

  const temporary = `${finalOutput}.partial-${process.pid}-${Date.now()}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10 * 60_000) });
    if (!response.ok || !response.body) {
      fail(`下载模型输出失败：HTTP ${response.status}`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, { flags: 'wx' }));
    await copyFile(temporary, finalOutput, constants.COPYFILE_EXCL);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return finalOutput;
};

const readHeader = async (filePath, length = 32) => {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

const validateDownloadedFile = async (operation, outputPath) => {
  const stat = await lstat(outputPath);
  if (!stat.isFile() || stat.size === 0) {
    fail('模型输出为空或不是普通文件。');
  }

  if (operation === 'remove-background') {
    const header = await readHeader(outputPath);
    const pngSignature = header.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    if (!pngSignature) {
      fail('抠图输出不是有效 PNG。');
    }
    const colorType = header[25];
    if (![4, 6].includes(colorType)) {
      fail('抠图 PNG 没有检测到 Alpha 通道。');
    }
  }

  if (operation === 'upscale-image') {
    const header = await readHeader(outputPath);
    const signature = header.subarray(0, 12).toString('hex');
    const isPng = signature.startsWith('89504e470d0a1a0a');
    const isJpeg = signature.startsWith('ffd8ff');
    if (!isPng && !isJpeg) {
      fail('图片升清输出不是有效 PNG 或 JPEG。');
    }
  }

  if (operation === 'upscale-video') {
    const probe = spawnSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate',
      '-of', 'json',
      outputPath,
    ], { encoding: 'utf8' });
    if (probe.status !== 0) {
      fail(`ffprobe 无法读取视频输出：${probe.stderr.trim()}`);
    }
    const parsed = JSON.parse(probe.stdout);
    const videoStream = parsed.streams?.find((stream) => stream.codec_type === 'video');
    if (!videoStream?.width || !videoStream?.height) {
      fail('视频输出缺少可识别的视频流。');
    }
    return { ffprobe: parsed };
  }

  return {};
};

const runDoctor = () => {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const ffprobe = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });
  console.log(JSON.stringify({
    skill: 'koubo-asset-prep',
    projectRoot,
    node: process.versions.node,
    nodeSupported: nodeMajor >= 20,
    ffprobeAvailable: ffprobe.status === 0,
    eachlabsApiKeyConfigured: Boolean(config.EACHLABS_API_KEY?.trim()),
    networkCalled: false,
    uploadsPerformed: false,
    operations: Object.keys(OPERATIONS),
  }, null, 2));
};

const main = async () => {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (options.help || positional.length === 0) {
    usage();
    return;
  }

  const [operation, rawInput] = positional;
  if (operation === 'doctor') {
    if (positional.length !== 1) fail('doctor 不接受输入素材。');
    runDoctor();
    return;
  }
  if (positional.length !== 2) {
    fail('必须提供 operation 和单个输入素材。');
  }
  const operationConfig = OPERATIONS[operation];
  if (!operationConfig) {
    fail(`未知 operation：${operation}`);
  }

  const assetClass = options['asset-class'];
  const allowedAssetClasses = new Set(['person', 'generated', 'illustrative', 'evidence']);
  if (!allowedAssetClasses.has(assetClass)) {
    fail('--asset-class 必须是 person、generated、illustrative 或 evidence。');
  }
  if (assetClass === 'evidence') {
    fail('证据类素材禁止进行 AI 抠图或升清，请保留原文件。');
  }
  if (operation === 'upscale-video' && assetClass === 'person') {
    fail('真人主口播/真人视频不进入 AI 视频升清；请使用原始高分辨率素材或确定性转码。');
  }

  const input = await inspectInput(rawInput, operationConfig.kind);
  const output = await inspectOutput(options.output, operationConfig, input);
  const placeholderUrl = input.inputUrl || 'https://upload-pending.invalid/input';
  const modelInput = buildModelInput(
    operation,
    placeholderUrl,
    options,
    assetClass,
    output.extension,
  );

  const plan = {
    skill: 'koubo-asset-prep',
    operation,
    model: operationConfig.model,
    assetClass,
    productionState: options['production-state'] || null,
    input: input.displayInput,
    inputSourceType: input.sourceType,
    inputBytes: input.size,
    output: relativeToProject(output.lexicalOutput),
    modelInput: {
      ...modelInput,
      image_url: modelInput.image_url ? '[上传后地址]' : undefined,
      video_url: modelInput.video_url ? '[上传后地址]' : undefined,
    },
    externalProcessingRequired: true,
    dynamicCost: true,
    networkCalled: false,
    uploadsPerformed: false,
  };

  if (options['dry-run']) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (options['production-state'] !== 'ready-for-production') {
    fail('内容未达到 ready-for-production，禁止上传和付费调用。');
  }
  if (!options['confirm-external-processing']) {
    fail('尚未授权外部处理。确认素材允许上传至 each::labs 及模型提供商后，增加 --confirm-external-processing。');
  }
  if (!options['confirm-cost']) {
    fail('尚未确认本次模型调用可能计费。确认后增加 --confirm-cost。');
  }
  const apiKey = config.EACHLABS_API_KEY?.trim();
  if (!apiKey) {
    fail('未配置 EACHLABS_API_KEY；没有上传，也没有创建付费预测。');
  }

  const inputSha256 = input.localPath ? await sha256File(input.localPath) : null;
  const uploaded = input.localPath
    ? await presignAndUpload(input, apiKey)
    : { uploadId: null, publicUrl: input.inputUrl };
  const liveModelInput = buildModelInput(
    operation,
    uploaded.publicUrl,
    options,
    assetClass,
    output.extension,
  );
  const prediction = await runPrediction(operationConfig.model, liveModelInput, apiKey);
  const actualOutput = await downloadExclusive(prediction.outputUrl, output.lexicalOutput);
  const validation = await validateDownloadedFile(operation, actualOutput);
  const outputSha256 = await sha256File(actualOutput);
  const metrics = prediction.final.metrics || {};

  const ledger = {
    schemaVersion: 1,
    status: 'generated-awaiting-human-review',
    createdAt: new Date().toISOString(),
    provider: 'each::labs',
    upstreamRepository: 'https://github.com/awesome-genmedia/skills',
    upstreamCommit: 'e4e641e21e59561fab7ab2bb7d90889e04aed84e',
    operation,
    model: operationConfig.model,
    assetClass,
    input: {
      sourceType: input.sourceType,
      projectPath: input.localPath ? relativeToProject(input.localPath) : null,
      remoteHost: input.inputUrl ? new URL(input.inputUrl).hostname : null,
      sha256: inputSha256,
      bytes: input.size,
      uploadId: uploaded.uploadId,
    },
    request: {
      ...liveModelInput,
      image_url: liveModelInput.image_url ? '[external-media-url-redacted]' : undefined,
      video_url: liveModelInput.video_url ? '[external-media-url-redacted]' : undefined,
    },
    prediction: {
      id: prediction.predictionId,
      cost: metrics.cost ?? null,
      predictTimeSeconds: metrics.predict_time ?? null,
    },
    output: {
      projectPath: relativeToProject(actualOutput),
      sha256: outputSha256,
      bytes: (await lstat(actualOutput)).size,
      ffprobe: validation.ffprobe || null,
    },
    humanReview: {
      status: 'pending',
      reviewer: null,
      reviewedAt: null,
      notes: null,
    },
  };

  await writeFile(`${actualOutput}.asset-prep.json`, `${JSON.stringify(ledger, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });

  console.log(JSON.stringify({
    status: ledger.status,
    output: ledger.output.projectPath,
    record: `${ledger.output.projectPath}.asset-prep.json`,
    model: ledger.model,
    cost: ledger.prediction.cost,
    next: '检查输出并完成人工确认，确认前不得进入正式视觉方案。',
  }, null, 2));
};

main().catch((error) => {
  console.error(`错误：${error.message}`);
  process.exitCode = 1;
});
