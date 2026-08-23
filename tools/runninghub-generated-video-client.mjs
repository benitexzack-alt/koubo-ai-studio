import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  buildH3RequestDefinition,
  generatedVideoPlanPathFor as generatedVideoPlanRelativePathFor,
  generationDefinitionSha256,
  loadPlanAndStyle,
  validateGeneratedVideoPlan,
} from './generated-video-plan-core.mjs';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECURITY_CLOCK_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const COST_AUTHORIZATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const failLegacyProductionScope = (code, message) => {
  const error = new Error(message);
  error.code = code;
  throw error;
};

const assertLegacyProductionScope = () =>
  failLegacyProductionScope(
    'RH_V1_RETIRED',
    '旧 RunningHub v1 客户端已永久退役：quote/run/resume 全部禁用；' +
    '新 H3 只能走完整 v2 协议、外部授权、单次消费、查询下载与人工验收链。',
  );

export const RUNNINGHUB_APPROVAL_RECEIPT_DIRECTORY = path.resolve(
  projectRoot,
  'edit/generated-video/approval-receipts',
);

export const RUNNINGHUB_H3_PROVIDER = Object.freeze({
  id: 'runninghub-minimax-h3-2k',
  provider: 'RunningHub',
  model: 'MiniMax-H3',
  baseUrl: 'https://www.runninghub.cn',
  modelRoute: '/openapi/v2/minimax/hailuo-h3/multimodal-to-video',
  pricePreviewRoute:
    '/openapi/v2/price-preview/minimax/hailuo-h3/multimodal-to-video',
  queryRoute: '/openapi/v2/query',
  apiKeyEnvironmentVariable: 'RUNNINGHUB_API_KEY',
  resolution: '2K',
  ratio: '16:9',
  minimumDurationSeconds: 5,
  maximumDurationSeconds: 15,
  aigcWatermark: false,
});

const ensureText = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label}不能为空`);
  }
  return value.trim();
};

const ensurePositiveNumber = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label}必须是正数`);
  }
  return number;
};

const createSecurityClock = () => {
  const wallStartMs = Date.now();
  const monotonicStart = process.hrtime.bigint();
  const nowMs = () => {
    const monotonicElapsedMs =
      Number(process.hrtime.bigint() - monotonicStart) / 1_000_000;
    return Math.max(Date.now(), wallStartMs + monotonicElapsedMs);
  };
  return {
    nowMs,
    nowIso: () => new Date(nowMs()).toISOString(),
  };
};

const nowIso = (now) =>
  typeof now === 'function' ? now() : new Date().toISOString();

const sha256Buffer = (buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');

const lstatOrNull = (filePath) => {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};

const assertRegularEntry = (filePath, label, {allowMissing = false} = {}) => {
  const stat = lstatOrNull(filePath);
  if (!stat) {
    if (allowMissing) return null;
    throw new Error(`${label}不存在：${filePath}`);
  }
  if (stat.isSymbolicLink()) {
    throw new Error(`${label}拒绝符号链接：${filePath}`);
  }
  if (!stat.isFile()) {
    throw new Error(`${label}必须是普通文件：${filePath}`);
  }
  return stat;
};

const ensureDirectoryWithoutSymlink = (directoryPath, label) => {
  const absolutePath = path.resolve(directoryPath);
  const parsed = path.parse(absolutePath);
  const components = absolutePath
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);
  let current = parsed.root;
  for (const component of components) {
    current = path.join(current, component);
    let entry = lstatOrNull(current);
    if (!entry) {
      try {
        fs.mkdirSync(current, {mode: 0o700});
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
      }
      entry = lstatOrNull(current);
    }
    if (entry?.isSymbolicLink()) {
      throw new Error(`${label}拒绝符号链接目录：${current}`);
    }
    if (!entry?.isDirectory()) {
      throw new Error(`${label}不是目录：${current}`);
    }
  }
  return absolutePath;
};

const assertProjectContainedPath = (filePath, label) => {
  const absolutePath = path.resolve(filePath);
  const relative = path.relative(projectRoot, absolutePath);
  if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label}必须位于口播项目根目录内：${absolutePath}`);
  }
  return absolutePath;
};

const ensurePathSegment = (value, label) => {
  const segment = ensureText(value, label);
  if (
    segment === '.' ||
    segment === '..' ||
    segment.includes('/') ||
    segment.includes('\\') ||
    segment.includes('\0')
  ) {
    throw new Error(`${label}必须是单一安全路径段`);
  }
  return segment;
};

export const generatedVideoLedgerPathFor = (planId) =>
  path.resolve(
    projectRoot,
    'edit/generated-video',
    ensurePathSegment(planId, 'planId'),
    'generation-ledger.json',
  );

export const generatedVideoOutputPathFor = ({videoId, planId, shotId}) =>
  path.resolve(
    projectRoot,
    'remotion/public/media',
    ensurePathSegment(videoId, 'videoId'),
    'generated-video',
    ensurePathSegment(planId, 'planId'),
    `${ensurePathSegment(shotId, 'shot.id')}.mp4`,
  );

const generatedVideoPlanAbsolutePathFor = (videoId) =>
  path.resolve(
    projectRoot,
    generatedVideoPlanRelativePathFor(ensurePathSegment(videoId, 'videoId')),
  );

const resolveManagedProjectPath = (filePath, label) => {
  const normalizedPath = ensureText(filePath, label);
  return assertProjectContainedPath(
    path.isAbsolute(normalizedPath)
      ? normalizedPath
      : path.resolve(projectRoot, normalizedPath),
    label,
  );
};

const assertFixedPlanPath = ({planPath, videoId}) => {
  const suppliedPlanPath = assertProjectContainedPath(
    ensureText(planPath, '生成视频拆镜计划路径'),
    '生成视频拆镜计划',
  );
  const expectedPlanPath = generatedVideoPlanAbsolutePathFor(videoId);
  if (suppliedPlanPath !== expectedPlanPath) {
    throw new Error(`生成视频拆镜计划必须使用固定项目派生路径：${expectedPlanPath}`);
  }
  return assertSafeFileLocation(expectedPlanPath, '生成视频拆镜计划', {
    allowMissing: false,
  }).absolutePath;
};

const assertSafeFileLocation = (filePath, label, {allowMissing = true} = {}) => {
  const absolutePath = path.resolve(filePath);
  ensureDirectoryWithoutSymlink(path.dirname(absolutePath), `${label}父目录`);
  return {
    absolutePath,
    stat: assertRegularEntry(absolutePath, label, {allowMissing}),
  };
};

const assertFixedGenerationPaths = ({
  videoId,
  planId,
  shotId,
  ledgerPath,
  outputPath,
  allowExistingOutput = true,
}) => {
  const suppliedLedgerPath = assertProjectContainedPath(
    ledgerPath,
    'RunningHub任务账本',
  );
  const suppliedOutputPath = assertProjectContainedPath(
    outputPath,
    'RunningHub视频输出',
  );
  const expectedLedgerPath = generatedVideoLedgerPathFor(planId);
  const expectedOutputPath = generatedVideoOutputPathFor({videoId, planId, shotId});
  if (suppliedLedgerPath !== expectedLedgerPath) {
    throw new Error(
      `RunningHub任务账本必须使用固定项目派生路径：${expectedLedgerPath}`,
    );
  }
  if (suppliedOutputPath !== expectedOutputPath) {
    throw new Error(
      `RunningHub视频输出必须使用固定项目派生路径：${expectedOutputPath}`,
    );
  }
  const fixedLedgerPath = assertSafeFileLocation(
    expectedLedgerPath,
    'RunningHub任务账本',
    {allowMissing: true},
  ).absolutePath;
  const fixedOutputPath = assertSafeFileLocation(
    expectedOutputPath,
    'RunningHub视频输出',
    {allowMissing: allowExistingOutput},
  ).absolutePath;
  return {fixedLedgerPath, fixedOutputPath};
};

const sameFileIdentity = (left, right) =>
  left && right && left.dev === right.dev && left.ino === right.ino;

const safeReadFile = (filePath, label) => {
  const {absolutePath, stat: before} = assertSafeFileLocation(filePath, label, {
    allowMissing: false,
  });
  const descriptor = fs.openSync(
    absolutePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
  );
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || !sameFileIdentity(before, opened)) {
      throw new Error(`${label}在读取前发生变化，已拒绝`);
    }
    const content = fs.readFileSync(descriptor);
    const after = assertRegularEntry(absolutePath, label);
    if (!sameFileIdentity(opened, after)) {
      throw new Error(`${label}在读取期间发生变化，已拒绝`);
    }
    return content;
  } finally {
    fs.closeSync(descriptor);
  }
};

export const sha256File = (filePath) =>
  sha256Buffer(safeReadFile(filePath, '待校验文件'));

const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const stableJsonSha256 = (value) =>
  sha256Buffer(Buffer.from(stableJson(value)));

const readJson = (filePath, label = 'JSON文件') =>
  JSON.parse(safeReadFile(filePath, label).toString('utf8'));

const randomTemporaryPath = (targetPath, purpose) =>
  `${targetPath}.${purpose}-${process.pid}-${crypto.randomBytes(16).toString('hex')}`;

const openExclusiveRegularFile = (filePath, label) => {
  const {absolutePath} = assertSafeFileLocation(filePath, label, {
    allowMissing: true,
  });
  let descriptor;
  try {
    descriptor = fs.openSync(
      absolutePath,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        (fs.constants.O_NOFOLLOW ?? 0),
      0o600,
    );
  } catch (error) {
    if (error?.code === 'EEXIST') {
      assertRegularEntry(absolutePath, label);
    }
    throw error;
  }
  const opened = fs.fstatSync(descriptor);
  if (!opened.isFile()) {
    fs.closeSync(descriptor);
    throw new Error(`${label}创建后不是普通文件，已拒绝`);
  }
  return {absolutePath, descriptor, opened};
};

const removeOwnedFile = (filePath, identity) => {
  const current = lstatOrNull(filePath);
  if (current && !current.isSymbolicLink() && sameFileIdentity(current, identity)) {
    fs.unlinkSync(filePath);
  }
};

const atomicWriteJson = (filePath, value, label = 'JSON文件') => {
  const {absolutePath} = assertSafeFileLocation(filePath, label, {
    allowMissing: true,
  });
  const temporaryPath = randomTemporaryPath(absolutePath, 'tmp');
  const temporary = openExclusiveRegularFile(temporaryPath, `${label}临时文件`);
  let installed = false;
  try {
    fs.writeFileSync(
      temporary.descriptor,
      `${JSON.stringify(value, null, 2)}\n`,
      {encoding: 'utf8'},
    );
    fs.fsyncSync(temporary.descriptor);
    const written = fs.fstatSync(temporary.descriptor);
    if (!sameFileIdentity(temporary.opened, written)) {
      throw new Error(`${label}临时文件在写入期间发生变化`);
    }
    fs.closeSync(temporary.descriptor);
    temporary.descriptor = null;
    ensureDirectoryWithoutSymlink(path.dirname(absolutePath), `${label}父目录`);
    assertRegularEntry(absolutePath, label, {allowMissing: true});
    assertRegularEntry(temporaryPath, `${label}临时文件`);
    fs.renameSync(temporaryPath, absolutePath);
    installed = true;
    const after = assertRegularEntry(absolutePath, label);
    if (!sameFileIdentity(after, written)) {
      throw new Error(`${label}原子替换后文件身份不一致`);
    }
  } finally {
    if (temporary.descriptor !== null) fs.closeSync(temporary.descriptor);
    if (!installed) removeOwnedFile(temporaryPath, temporary.opened);
  }
};

const withLedgerLock = (ledgerPath, callback) => {
  const {absolutePath} = assertSafeFileLocation(ledgerPath, 'RunningHub任务账本', {
    allowMissing: true,
  });
  const lockPath = `${absolutePath}.lock`;
  assertSafeFileLocation(lockPath, 'RunningHub任务账本锁', {
    allowMissing: true,
  });
  let lock;
  try {
    lock = openExclusiveRegularFile(lockPath, 'RunningHub任务账本锁');
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`RunningHub任务账本正在被另一进程占用：${absolutePath}`);
    }
    throw error;
  }
  try {
    return callback();
  } finally {
    const opened = fs.fstatSync(lock.descriptor);
    fs.closeSync(lock.descriptor);
    removeOwnedFile(lockPath, opened);
  }
};

const sanitizedUrl = (value) => {
  try {
    const parsed = new URL(value);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const validateProvider = (provider = RUNNINGHUB_H3_PROVIDER) => {
  for (const key of [
    'id',
    'provider',
    'model',
    'baseUrl',
    'modelRoute',
    'pricePreviewRoute',
    'queryRoute',
    'apiKeyEnvironmentVariable',
    'resolution',
    'ratio',
  ]) {
    ensureText(provider[key], `provider.${key}`);
  }
  for (const field of [
    'id',
    'provider',
    'model',
    'baseUrl',
    'modelRoute',
    'pricePreviewRoute',
    'queryRoute',
    'apiKeyEnvironmentVariable',
    'resolution',
    'ratio',
    'minimumDurationSeconds',
    'maximumDurationSeconds',
    'aigcWatermark',
  ]) {
    if (!Object.is(provider[field], RUNNINGHUB_H3_PROVIDER[field])) {
      throw new Error(
        `RunningHub H3提供商合同字段${field}与固定2K/16:9/无水印定义不一致`,
      );
    }
  }
  return provider;
};

export const buildH3Request = ({
  prompt,
  durationSeconds,
  provider = RUNNINGHUB_H3_PROVIDER,
}) => {
  validateProvider(provider);
  const duration = Number(durationSeconds);
  if (
    !Number.isInteger(duration) ||
    duration < provider.minimumDurationSeconds ||
    duration > provider.maximumDurationSeconds
  ) {
    throw new Error(
      `MiniMax-H3 时长必须是 ${provider.minimumDurationSeconds}–${provider.maximumDurationSeconds} 秒整数`,
    );
  }
  return {
    prompt: ensureText(prompt, '完整视频提示词'),
    resolution: provider.resolution,
    duration: String(duration),
    ratio: provider.ratio,
    aigc_watermark: provider.aigcWatermark === true,
  };
};

const requestOptions = (apiKey, body) => ({
  method: 'POST',
  headers: {
    Authorization: `Bearer ${ensureText(apiKey, 'RUNNINGHUB_API_KEY')}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(120_000),
});

const readJsonResponse = async (response, label) => {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label}返回了无法解析的响应，HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(
      `${label}失败，HTTP ${response.status}：${
        body.errorMessage ?? body.message ?? '未知错误'
      }`,
    );
  }
  if (body.errorCode) {
    throw new Error(`${label}失败：${body.errorMessage || body.errorCode}`);
  }
  return body;
};

const previewPrice = async ({provider, apiKey, payload, fetchImpl, pathGuard}) => {
  if (typeof pathGuard === 'function') pathGuard();
  const response = await fetchImpl(
    `${provider.baseUrl}${provider.pricePreviewRoute}`,
    requestOptions(apiKey, payload),
  );
  const body = await readJsonResponse(response, 'RunningHub价格预估');
  const estimatedCostCny = Number(body.estimatedPrice);
  if (!Number.isFinite(estimatedCostCny) || estimatedCostCny < 0) {
    throw new Error('RunningHub价格预估缺少有效金额');
  }
  if (body.currency !== 'CNY') {
    throw new Error(`RunningHub价格币种不是CNY：${body.currency ?? '未知'}`);
  }
  return {
    estimatedCostCny,
    currency: body.currency,
    isFreeThisCall: body.isFreeThisCall === true,
  };
};

const submitTask = async ({provider, apiKey, payload, fetchImpl, pathGuard}) => {
  if (typeof pathGuard === 'function') pathGuard();
  const response = await fetchImpl(
    `${provider.baseUrl}${provider.modelRoute}`,
    requestOptions(apiKey, payload),
  );
  const body = await readJsonResponse(response, 'RunningHub视频任务提交');
  return {...body, taskId: ensureText(body.taskId, 'RunningHub视频任务taskId')};
};

const queryTask = async ({provider, apiKey, taskId, fetchImpl, pathGuard}) => {
  if (typeof pathGuard === 'function') pathGuard();
  const response = await fetchImpl(
    `${provider.baseUrl}${provider.queryRoute}`,
    requestOptions(apiKey, {taskId}),
  );
  const body = await readJsonResponse(response, 'RunningHub任务查询');
  if (body.taskId !== taskId) {
    throw new Error(
      `RunningHub任务查询回传taskId与固定任务不一致：` +
        `${body.taskId ?? '缺失'} != ${taskId}`,
    );
  }
  return body;
};

const statusName = (value) => String(value ?? '').toUpperCase();

const waitForTerminalTask = async ({
  provider,
  apiKey,
  taskId,
  initialResponse,
  fetchImpl,
  pollIntervalMs,
  maximumPollCount,
  pathGuard,
}) => {
  let current = initialResponse;
  let transientErrors = 0;
  for (let count = 0; count <= maximumPollCount; count += 1) {
    if (['SUCCESS', 'FAILED'].includes(statusName(current.status))) return current;
    if (count === maximumPollCount) break;
    if (pollIntervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    try {
      current = await queryTask({provider, apiKey, taskId, fetchImpl, pathGuard});
      transientErrors = 0;
    } catch (error) {
      transientErrors += 1;
      if (transientErrors > 3) throw error;
    }
  }
  throw new Error(
    `RunningHub任务${taskId}在轮询上限内未返回终态，可稍后只恢复同一taskId`,
  );
};

const selectVideoResult = (results) =>
  (results ?? []).find(
    (item) =>
      String(item.outputType ?? '').toLowerCase() === 'mp4' ||
      sanitizedUrl(item.url ?? '').toLowerCase().endsWith('.mp4'),
  );

const reconcileActualCost = (usage) => {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    return {
      actualCostStatus: 'missing',
      actualCostCny: null,
      billingIssue: 'RunningHub终态响应缺少usage，不能将预估金额当作实际扣费',
    };
  }
  const fieldNames = ['thirdPartyConsumeMoney', 'consumeMoney'];
  const provided = fieldNames.filter((field) =>
    Object.prototype.hasOwnProperty.call(usage, field),
  );
  if (provided.length === 0) {
    return {
      actualCostStatus: 'missing',
      actualCostCny: null,
      billingIssue: 'RunningHub usage未提供可对账金额字段',
    };
  }
  const values = [];
  for (const field of provided) {
    const raw = usage[field];
    if (
      raw === null ||
      raw === undefined ||
      (typeof raw === 'string' && raw.trim() === '')
    ) {
      return {
        actualCostStatus: 'missing',
        actualCostCny: null,
        billingIssue: `RunningHub usage.${field}缺失有效金额`,
      };
    }
    if (typeof raw !== 'number' && typeof raw !== 'string') {
      return {
        actualCostStatus: 'invalid',
        actualCostCny: null,
        billingIssue: `RunningHub usage.${field}不是数值或数字字符串`,
      };
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return {
        actualCostStatus: 'invalid',
        actualCostCny: null,
        billingIssue: `RunningHub usage.${field}不是有限非负数`,
      };
    }
    values.push(value);
  }
  return {
    actualCostStatus: 'reported',
    actualCostCny: Number(
      values.reduce((total, value) => total + value, 0).toFixed(6),
    ),
    billingIssue: '',
  };
};

const downloadVideo = async ({remoteUrl, outputPath, fetchImpl, pathGuard}) => {
  if (typeof pathGuard === 'function') pathGuard();
  const {absolutePath} = assertSafeFileLocation(outputPath, 'RunningHub视频输出', {
    allowMissing: true,
  });
  const response = await fetchImpl(remoteUrl, {
    method: 'GET',
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) {
    throw new Error(`RunningHub结果下载失败，HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error('RunningHub结果文件为空');
  const remoteSha256 = sha256Buffer(buffer);
  if (lstatOrNull(absolutePath)) {
    const existingBuffer = safeReadFile(absolutePath, 'RunningHub既有视频输出');
    const existingSha256 = sha256Buffer(existingBuffer);
    if (existingSha256 === remoteSha256) {
      return {
        bytes: existingBuffer.length,
        sha256: existingSha256,
        recoveredExistingFile: true,
        conflict: false,
      };
    }
    const recoveryPath = randomTemporaryPath(absolutePath, 'download-conflict');
    const recovery = openExclusiveRegularFile(
      recoveryPath,
      'RunningHub下载冲突隔离文件',
    );
    try {
      fs.writeFileSync(recovery.descriptor, buffer);
      fs.fsyncSync(recovery.descriptor);
    } finally {
      fs.closeSync(recovery.descriptor);
    }
    const recoveryAfter = assertRegularEntry(
      recoveryPath,
      'RunningHub下载冲突隔离文件',
    );
    if (!sameFileIdentity(recovery.opened, recoveryAfter)) {
      throw new Error('RunningHub下载冲突隔离文件写入后发生变化');
    }
    return {
      conflict: true,
      existingBytes: existingBuffer.length,
      existingSha256,
      remoteBytes: buffer.length,
      remoteSha256,
      recoveryPath,
    };
  }
  const temporaryPath = randomTemporaryPath(absolutePath, 'download');
  const temporary = openExclusiveRegularFile(temporaryPath, 'RunningHub下载临时文件');
  let installed = false;
  try {
    fs.writeFileSync(temporary.descriptor, buffer);
    fs.fsyncSync(temporary.descriptor);
    const written = fs.fstatSync(temporary.descriptor);
    fs.closeSync(temporary.descriptor);
    temporary.descriptor = null;
    if (!sameFileIdentity(temporary.opened, written)) {
      throw new Error('RunningHub下载临时文件在写入期间发生变化');
    }
    ensureDirectoryWithoutSymlink(path.dirname(absolutePath), 'RunningHub视频输出父目录');
    assertRegularEntry(absolutePath, 'RunningHub视频输出', {allowMissing: true});
    assertRegularEntry(temporaryPath, 'RunningHub下载临时文件');
    try {
      fs.linkSync(temporaryPath, absolutePath);
    } catch (error) {
      if (error?.code === 'EEXIST') {
        assertRegularEntry(absolutePath, 'RunningHub视频输出');
        throw new Error('RunningHub视频输出在下载期间被创建，已拒绝覆盖');
      }
      throw error;
    }
    installed = true;
    const outputAfter = assertRegularEntry(absolutePath, 'RunningHub视频输出');
    if (!sameFileIdentity(outputAfter, written)) {
      throw new Error('RunningHub视频输出安装后文件身份不一致');
    }
  } finally {
    if (temporary.descriptor !== null) fs.closeSync(temporary.descriptor);
    removeOwnedFile(temporaryPath, temporary.opened);
    if (!installed && lstatOrNull(absolutePath)?.isSymbolicLink()) {
      throw new Error('RunningHub视频输出写入后检测到符号链接');
    }
  }
  return {
    bytes: buffer.length,
    sha256: remoteSha256,
    recoveredExistingFile: false,
    conflict: false,
  };
};

const emptyLedger = ({planId, planSha256, style, authorization, now}) => ({
  schemaVersion: 1,
  provider: RUNNINGHUB_H3_PROVIDER.provider,
  providerId: RUNNINGHUB_H3_PROVIDER.id,
  model: RUNNINGHUB_H3_PROVIDER.model,
  planId,
  planSha256,
  style,
  authorization,
  policy: {
    maximumPaidAttemptsPerShot: 1,
    automaticPaidRetryAllowed: false,
  },
  createdAt: now,
  updatedAt: now,
  attempts: {},
});

export const approvalReceiptPathFor = (approvalId) => {
  const normalizedApprovalId = ensureText(approvalId, 'costAuthorization.approvalId');
  const digest = sha256Buffer(Buffer.from(normalizedApprovalId));
  return path.resolve(RUNNINGHUB_APPROVAL_RECEIPT_DIRECTORY, `${digest}.json`);
};

const approvalReceiptDefinition = ({
  planId,
  planSha256,
  authorization,
  ledgerPath,
}) => ({
  schemaVersion: 'generated-video-approval-consumption/v1',
  approvalId: ensureText(authorization?.approvalId, 'costAuthorization.approvalId'),
  planId: ensureText(planId, 'planId'),
  definitionSha256: ensureText(planSha256, 'planSha256'),
  ledgerPath: path.resolve(ensureText(ledgerPath, 'ledgerPath')),
  approvedBy: ensureText(authorization?.approvedBy, 'costAuthorization.approvedBy'),
  approvedAt: ensureText(authorization?.approvedAt, 'costAuthorization.approvedAt'),
  expiresAt: ensureText(authorization?.expiresAt, 'costAuthorization.expiresAt'),
  maxPerShotCny: Number(authorization?.maxPerShotCny),
  maxAmountCny: Number(authorization?.maxAmountCny),
  currency: authorization?.currency,
  providerId: RUNNINGHUB_H3_PROVIDER.id,
});

const assertReceiptMatches = (existing, expected) => {
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (existing?.[field] !== expectedValue) {
      throw new Error(
        `approvalId=${expected.approvalId}已被其他计划、账本或金额定义消费，禁止复用`,
      );
    }
  }
};

const verifyApprovalConsumptionReceipt = ({
  planId,
  planSha256,
  authorization,
  ledgerPath,
}) => {
  const expected = approvalReceiptDefinition({
    planId,
    planSha256,
    authorization,
    ledgerPath,
  });
  const receiptPath = approvalReceiptPathFor(expected.approvalId);
  const existing = readJson(receiptPath, 'RunningHub费用批准消费回执');
  assertReceiptMatches(existing, expected);
  const ledger = loadGeneratedVideoLedger(expected.ledgerPath);
  if (!ledger) {
    throw new Error(
      `approvalId=${expected.approvalId}已有消费回执但当前任务账本缺失，禁止重新提交`,
    );
  }
  if (ledger.planId !== planId || ledger.planSha256 !== planSha256) {
    throw new Error('RunningHub费用批准消费回执与当前账本定义不一致');
  }
  return {receiptPath, created: false};
};

export const loadGeneratedVideoLedger = (ledgerPath) => {
  const containedPath = assertProjectContainedPath(
    ledgerPath,
    'RunningHub任务账本',
  );
  const {absolutePath, stat} = assertSafeFileLocation(
    containedPath,
    'RunningHub任务账本',
    {allowMissing: true},
  );
  return stat ? readJson(absolutePath, 'RunningHub任务账本') : null;
};

export const claimApprovalConsumptionReceipt = ({
  planId,
  planSha256,
  authorization,
  ledgerPath,
}) => {
  const securityClock = createSecurityClock();
  const timing = validateAuthorizationDefinition({
    authorization,
    planId,
    planSha256,
  });
  assertAuthorizationLive({timing, currentTimeMs: securityClock.nowMs()});
  const expected = approvalReceiptDefinition({
    planId,
    planSha256,
    authorization,
    ledgerPath,
  });
  const requiredLedgerPath = generatedVideoLedgerPathFor(planId);
  if (expected.ledgerPath !== requiredLedgerPath) {
    throw new Error(
      `RunningHub费用批准回执只允许绑定固定账本路径：${requiredLedgerPath}`,
    );
  }
  assertSafeFileLocation(expected.ledgerPath, 'RunningHub任务账本', {
    allowMissing: true,
  });
  const receiptPath = approvalReceiptPathFor(expected.approvalId);
  ensureDirectoryWithoutSymlink(
    RUNNINGHUB_APPROVAL_RECEIPT_DIRECTORY,
    'RunningHub费用批准消费回执目录',
  );
  const existingEntry = lstatOrNull(receiptPath);
  if (!existingEntry) {
    let receipt;
    try {
      receipt = openExclusiveRegularFile(receiptPath, 'RunningHub费用批准消费回执');
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    if (receipt) {
      try {
        fs.writeFileSync(
          receipt.descriptor,
          `${JSON.stringify({...expected, consumedAt: securityClock.nowIso()}, null, 2)}\n`,
          {encoding: 'utf8'},
        );
        fs.fsyncSync(receipt.descriptor);
        const written = fs.fstatSync(receipt.descriptor);
        if (!sameFileIdentity(receipt.opened, written)) {
          throw new Error('RunningHub费用批准消费回执写入期间发生变化');
        }
      } catch (error) {
        removeOwnedFile(receiptPath, receipt.opened);
        throw error;
      } finally {
        fs.closeSync(receipt.descriptor);
      }
      const after = assertRegularEntry(receiptPath, 'RunningHub费用批准消费回执');
      if (!sameFileIdentity(receipt.opened, after)) {
        throw new Error('RunningHub费用批准消费回执创建后文件身份不一致');
      }
      return {receiptPath, created: true};
    }
  }
  return verifyApprovalConsumptionReceipt({
    planId,
    planSha256,
    authorization,
    ledgerPath: expected.ledgerPath,
  });
};

const reserveAttempt = ({
  provider,
  planPath,
  videoId,
  ledgerPath,
  outputPath,
  planId,
  planSha256,
  style,
  authorization,
  shot,
  payload,
  record,
  latestPrice,
  securityClock,
  beforePaidReserve,
}) =>
  withLedgerLock(ledgerPath, () => {
    const {fixedLedgerPath, fixedOutputPath} = assertFixedGenerationPaths({
      videoId,
      planId,
      shotId: shot.id,
      ledgerPath,
      outputPath,
    });
    assertPaidPlanBinding({
      provider,
      planPath,
      videoId,
      planId,
      planSha256,
      authorization,
      shot,
      payload,
      ledgerPath: fixedLedgerPath,
      outputPath: fixedOutputPath,
      securityClock,
    });
    if (lstatOrNull(fixedOutputPath)) {
      throw new Error(`镜头${shot.id}输出文件在报价期间已出现，拒绝付费提交`);
    }
    const timing = validateAuthorizationDefinition({
      authorization,
      planId,
      planSha256,
    });
    assertAuthorizationLive({
      timing,
      currentTimeMs: securityClock.nowMs(),
    });
    if (
      latestPrice.currency !== 'CNY' ||
      !Number.isFinite(latestPrice.estimatedCostCny) ||
      latestPrice.estimatedCostCny < 0 ||
      latestPrice.estimatedCostCny > timing.perShotLimit
    ) {
      throw new Error(
        `镜头${shot.id}最新服务端报价无效或超过单镜授权上限，未提交任务`,
      );
    }
    const existingLedger = loadGeneratedVideoLedger(fixedLedgerPath);
    assertLedgerAuthorizationMatches({
      ledger: existingLedger,
      authorization,
      planId,
      planSha256,
    });
    if (existingLedger?.attempts?.[shot.id]) {
      throw new Error(`镜头${shot.id}已经存在一次付费任务记录，禁止二次提交`);
    }
    const priorActualCostCny = committedActualCostBeforeNewAttempt({
      ledger: existingLedger,
      authorization,
    });
    const projectedAuthorizedCostCny = Number(
      (priorActualCostCny + latestPrice.estimatedCostCny).toFixed(6),
    );
    if (projectedAuthorizedCostCny > timing.totalLimit) {
      throw new Error(
        `已有实际费用加本镜最新服务端报价为${projectedAuthorizedCostCny}元，` +
          `超过授权总额${timing.totalLimit}元，未提交任务`,
      );
    }
    if (typeof beforePaidReserve === 'function') {
      const callbackResult = beforePaidReserve({
        videoId,
        planId,
        planSha256,
        shotId: shot.id,
        ledgerPath: fixedLedgerPath,
        outputPath: fixedOutputPath,
        latestPrice: {...latestPrice},
        priorActualCostCny,
        projectedAuthorizedCostCny,
      });
      if (callbackResult && typeof callbackResult.then === 'function') {
        throw new Error('beforePaidReserve必须是同步CAS回调');
      }
    }
    assertAuthorizationLive({
      timing,
      currentTimeMs: securityClock.nowMs(),
    });
    assertFixedGenerationPaths({
      videoId,
      planId,
      shotId: shot.id,
      ledgerPath: fixedLedgerPath,
      outputPath: fixedOutputPath,
    });
    assertPaidPlanBinding({
      provider,
      planPath,
      videoId,
      planId,
      planSha256,
      authorization,
      shot,
      payload,
      ledgerPath: fixedLedgerPath,
      outputPath: fixedOutputPath,
      securityClock,
    });
    const timestamp = securityClock.nowIso();
    const approvalReceipt = claimApprovalConsumptionReceipt({
      planId,
      planSha256,
      authorization,
      ledgerPath: fixedLedgerPath,
    });
    const ledger =
      existingLedger ??
      emptyLedger({planId, planSha256, style, authorization, now: timestamp});
    ledger.attempts[shot.id] = {
      attemptNumber: 1,
      shotId: shot.id,
      status: 'reserved',
      reservedAt: timestamp,
      updatedAt: timestamp,
      ...record,
      outputPath: fixedOutputPath,
      estimatedCostCny: latestPrice.estimatedCostCny,
      currency: latestPrice.currency,
      isFreeThisCall: latestPrice.isFreeThisCall,
      priorActualCostCny,
      projectedAuthorizedCostCny,
      approvalReceiptPath: approvalReceipt.receiptPath,
    };
    ledger.updatedAt = timestamp;
    atomicWriteJson(fixedLedgerPath, ledger, 'RunningHub任务账本');
    return {attempt: ledger.attempts[shot.id], approvalReceipt};
  });

const updateAttempt = ({ledgerPath, planId, shotId, patch, now}) =>
  withLedgerLock(ledgerPath, () => {
    const ledger = loadGeneratedVideoLedger(ledgerPath);
    if (!ledger || ledger.planId !== planId) {
      throw new Error('找不到当前自动插片计划的RunningHub任务账本');
    }
    if (!ledger.attempts[shotId]) {
      throw new Error(`找不到镜头${shotId}的RunningHub任务记录`);
    }
    const timestamp = nowIso(now);
    Object.assign(ledger.attempts[shotId], patch, {updatedAt: timestamp});
    ledger.updatedAt = timestamp;
    atomicWriteJson(ledgerPath, ledger, 'RunningHub任务账本');
    return ledger.attempts[shotId];
  });

export const quoteH3Shot = async ({
  provider = RUNNINGHUB_H3_PROVIDER,
  apiKey,
  shot,
  prompt,
  fetchImpl = fetch,
}) => {
  assertLegacyProductionScope();
  const payload = buildH3Request({
    prompt,
    durationSeconds: shot.durationSeconds,
    provider,
  });
  const price = await previewPrice({provider, apiKey, payload, fetchImpl});
  return {
    shotId: shot.id,
    durationSeconds: shot.durationSeconds,
    ...price,
    requestSha256: stableJsonSha256(payload),
    promptSha256: sha256Buffer(Buffer.from(payload.prompt)),
    paidTaskSubmitted: false,
  };
};

const finishTask = async ({
  provider,
  planId,
  shot,
  ledgerPath,
  outputPath,
  apiKey,
  taskId,
  initialResponse,
  fetchImpl,
  pollIntervalMs,
  maximumPollCount,
  now,
  pathGuard,
}) => {
  if (initialResponse?.taskId !== taskId) {
    throw new Error(
      `RunningHub任务响应taskId与固定任务不一致：` +
        `${initialResponse?.taskId ?? '缺失'} != ${taskId}`,
    );
  }
  let terminal;
  try {
    terminal = await waitForTerminalTask({
      provider,
      apiKey,
      taskId,
      initialResponse,
      fetchImpl,
      pollIntervalMs,
      maximumPollCount,
      pathGuard,
    });
  } catch (error) {
    updateAttempt({
      ledgerPath,
      planId,
      shotId: shot.id,
      patch: {status: 'task-status-unknown', errorMessage: error.message},
      now,
    });
    throw error;
  }
  if (statusName(terminal.status) === 'FAILED') {
    const billing = reconcileActualCost(terminal.usage);
    updateAttempt({
      ledgerPath,
      planId,
      shotId: shot.id,
      patch: {
        status:
          billing.actualCostStatus === 'reported'
            ? 'failed'
            : 'billing-reconciliation-required',
        taskTerminalStatus: 'failed',
        errorCode: terminal.errorCode ?? '',
        errorMessage: terminal.errorMessage ?? 'RunningHub任务失败',
        usage: terminal.usage ?? null,
        ...billing,
      },
      now,
    });
    throw new Error(
      `RunningHub任务失败：${terminal.errorMessage || terminal.errorCode || '未知错误'}`,
    );
  }
  const videoResult = selectVideoResult(terminal.results);
  if (!videoResult?.url) {
    updateAttempt({
      ledgerPath,
      planId,
      shotId: shot.id,
      patch: {status: 'download-blocked', errorMessage: '任务成功但没有返回MP4结果'},
      now,
    });
    throw new Error('RunningHub任务成功但没有返回MP4结果');
  }
  let downloaded;
  try {
    downloaded = await downloadVideo({
      remoteUrl: videoResult.url,
      outputPath,
      fetchImpl,
      pathGuard,
    });
  } catch (error) {
    updateAttempt({
      ledgerPath,
      planId,
      shotId: shot.id,
      patch: {
        status: 'download-failed',
        remoteResultUrl: sanitizedUrl(videoResult.url),
        errorMessage: error.message,
      },
      now,
    });
    throw error;
  }
  if (downloaded.conflict) {
    updateAttempt({
      ledgerPath,
      planId,
      shotId: shot.id,
      patch: {
        status: 'download-conflict',
        remoteResultUrl: sanitizedUrl(videoResult.url),
        existingOutputSha256: downloaded.existingSha256,
        remoteOutputSha256: downloaded.remoteSha256,
        recoveryPath: downloaded.recoveryPath,
        errorMessage: '本地既有文件与RunningHub结果哈希不一致，已隔离远端副本',
      },
      now,
    });
    throw new Error(
      `镜头${shot.id}本地既有文件与RunningHub结果不一致；远端副本已隔离到` +
        `${downloaded.recoveryPath}，需人工裁决，未覆盖原文件`,
    );
  }
  const billing = reconcileActualCost(terminal.usage);
  const finalStatus =
    billing.actualCostStatus === 'reported'
      ? 'downloaded'
      : 'billing-reconciliation-required';
  const attempt = updateAttempt({
    ledgerPath,
    planId,
    shotId: shot.id,
    patch: {
      status: finalStatus,
      taskTerminalStatus: 'success',
      completedAt: nowIso(now),
      outputPath,
      outputBytes: downloaded.bytes,
      outputSha256: downloaded.sha256,
      recoveredExistingFile: downloaded.recoveredExistingFile,
      remoteResultUrl: sanitizedUrl(videoResult.url),
      outputType: videoResult.outputType ?? 'mp4',
      usage: terminal.usage ?? null,
      ...billing,
      errorCode: '',
      errorMessage:
        finalStatus === 'billing-reconciliation-required'
          ? billing.billingIssue
          : '',
    },
    now,
  });
  return {status: finalStatus, taskId, outputPath, attempt};
};

const authorizationSnapshot = (authorization) => ({
  approvalId: authorization.approvalId,
  approvedBy: authorization.approvedBy,
  approvedAt: authorization.approvedAt,
  expiresAt: authorization.expiresAt,
  status: authorization.status,
  scope: authorization.scope,
  maxPerShotCny: Number(authorization.maxPerShotCny),
  maxAmountCny: Number(authorization.maxAmountCny),
  currency: authorization.currency,
  maxAttemptsPerShot: authorization.maxAttemptsPerShot,
  automaticRetry: authorization.automaticRetry,
});

const validateAuthorizationDefinition = ({authorization, planId, planSha256}) => {
  const perShotLimit = ensurePositiveNumber(
    authorization?.maxPerShotCny,
    'costAuthorization.maxPerShotCny',
  );
  const totalLimit = ensurePositiveNumber(
    authorization?.maxAmountCny,
    'costAuthorization.maxAmountCny',
  );
  if (authorization?.status !== 'approved') {
    throw new Error('付费提交前costAuthorization.status必须为approved');
  }
  if (authorization?.currency !== 'CNY') {
    throw new Error('付费提交的费用币种必须为CNY');
  }
  if (authorization?.maxAttemptsPerShot !== 1 || authorization?.automaticRetry !== false) {
    throw new Error('口播自动插片必须保持每镜一次、禁止自动重试');
  }
  ensureText(authorization?.approvalId, 'costAuthorization.approvalId');
  ensureText(authorization?.approvedBy, 'costAuthorization.approvedBy');
  ensureText(authorization?.approvedAt, 'costAuthorization.approvedAt');
  ensureText(authorization?.expiresAt, 'costAuthorization.expiresAt');
  const approvedAtMs = Date.parse(authorization.approvedAt);
  const expiresAtMs = Date.parse(authorization.expiresAt);
  if (Number.isNaN(approvedAtMs)) {
    throw new Error('costAuthorization.approvedAt必须是有效时间');
  }
  if (Number.isNaN(expiresAtMs)) {
    throw new Error('costAuthorization.expiresAt必须是有效时间');
  }
  if (
    expiresAtMs <= approvedAtMs ||
    expiresAtMs - approvedAtMs > COST_AUTHORIZATION_MAX_AGE_MS
  ) {
    throw new Error('费用授权有效期必须晚于approvedAt且最长不超过24小时');
  }
  if (
    authorization?.scope?.type !== 'plan-only' ||
    authorization?.scope?.planId !== planId ||
    authorization?.scope?.definitionSha256 !== planSha256
  ) {
    throw new Error(
      '费用授权必须以plan-only精确绑定当前planId与generationDefinitionSha256',
    );
  }
  return {perShotLimit, totalLimit, approvedAtMs, expiresAtMs};
};

const assertAuthorizationLive = ({timing, currentTimeMs}) => {
  if (!Number.isFinite(currentTimeMs)) {
    throw new Error('付费提交无法取得有效安全系统时间');
  }
  if (timing.approvedAtMs > currentTimeMs + SECURITY_CLOCK_MAX_FUTURE_SKEW_MS) {
    throw new Error('costAuthorization.approvedAt不得比安全系统时间晚超过5分钟');
  }
  if (currentTimeMs > timing.expiresAtMs) {
    throw new Error('本次金额授权已经过期，必须重新报价并取得新授权');
  }
};

const assertLedgerAuthorizationMatches = ({ledger, authorization, planId, planSha256}) => {
  if (!ledger) return;
  if (ledger.planId !== planId || ledger.planSha256 !== planSha256) {
    throw new Error('RunningHub任务账本与当前自动插片计划不一致');
  }
  if (ledger.providerId !== RUNNINGHUB_H3_PROVIDER.id) {
    throw new Error('RunningHub任务账本提供商定义不一致');
  }
  if (
    stableJsonSha256(authorizationSnapshot(ledger.authorization ?? {})) !==
    stableJsonSha256(authorizationSnapshot(authorization))
  ) {
    throw new Error('RunningHub任务账本与当前费用授权不一致');
  }
};

const assertPaidPlanBinding = ({
  provider,
  planPath,
  videoId,
  planId,
  planSha256,
  authorization = null,
  shot,
  payload,
  ledgerPath,
  outputPath,
  securityClock,
  validationPhase = 'submit',
}) => {
  const fixedPlanPath = assertFixedPlanPath({planPath, videoId});
  const beforeBuffer = safeReadFile(fixedPlanPath, '生成视频拆镜计划');
  const plan = JSON.parse(beforeBuffer.toString('utf8'));
  const loaded = loadPlanAndStyle(fixedPlanPath);
  if (stableJsonSha256(loaded.plan) !== stableJsonSha256(plan)) {
    throw new Error('生成视频拆镜计划在安全读取期间发生变化，已拒绝');
  }
  const validation = validateGeneratedVideoPlan(loaded.plan, loaded.style, {
    phase: validationPhase,
    now: () => new Date(securityClock.nowMs()).toISOString(),
  });
  if (!validation.ok) {
    throw new Error(
      `生成视频拆镜计划未通过${validationPhase}完整门禁：` +
        validation.errors
          .map((error) => `${error.code}:${error.message}`)
          .join('；'),
    );
  }
  const afterBuffer = safeReadFile(fixedPlanPath, '生成视频拆镜计划');
  if (sha256Buffer(afterBuffer) !== sha256Buffer(beforeBuffer)) {
    throw new Error('生成视频拆镜计划在完整门禁校验期间发生变化，已拒绝');
  }
  if (
    validationPhase === 'submit' &&
    !['ready-for-submit', 'submitted'].includes(plan.productionStatus)
  ) {
    throw new Error(
      'runH3Shot全新付费入口只允许ready-for-submit或submitted；' +
        `当前为${plan.productionStatus ?? '未知状态'}`,
    );
  }
  if (plan.videoId !== videoId || plan.planId !== planId) {
    throw new Error('生成视频拆镜计划与当前videoId或planId不一致');
  }
  if (
    resolveManagedProjectPath(plan.planPath, 'plan.planPath') !== fixedPlanPath
  ) {
    throw new Error('生成视频拆镜计划内部planPath与实际固定路径不一致');
  }
  const currentPlanSha256 = generationDefinitionSha256(plan);
  if (currentPlanSha256 !== planSha256) {
    throw new Error(
      '生成视频拆镜计划定义已变更，当前generationDefinitionSha256不一致',
    );
  }
  if (authorization) {
    if (
      stableJsonSha256(authorizationSnapshot(plan.costAuthorization ?? {})) !==
      stableJsonSha256(authorizationSnapshot(authorization))
    ) {
      throw new Error('生成视频拆镜计划内的费用授权与当前付费授权不一致');
    }
  }
  if (
    resolveManagedProjectPath(plan.outputs?.ledgerPath, 'plan.outputs.ledgerPath') !==
    ledgerPath
  ) {
    throw new Error('生成视频拆镜计划内的账本路径与当前固定账本不一致');
  }
  const matchingShots = (Array.isArray(plan.shots) ? plan.shots : []).filter(
    (candidate) => candidate?.id === shot?.id,
  );
  if (matchingShots.length !== 1) {
    throw new Error(`镜头${shot?.id ?? '未知'}不是当前计划内唯一的精确成员`);
  }
  const plannedShot = matchingShots[0];
  if (Number(plannedShot.timing?.durationSeconds) !== Number(shot.durationSeconds)) {
    throw new Error(`镜头${shot.id}的调用时长与计划定义不一致`);
  }
  if (
    String(plannedShot.promptCore?.compiledPrompt ?? '').trim() !== payload.prompt
  ) {
    throw new Error(`镜头${shot.id}的调用提示词与计划定义不一致`);
  }
  const plannedRequest = buildH3RequestDefinition(plannedShot);
  if (
    stableJsonSha256(plannedRequest) !== stableJsonSha256(payload) ||
    plannedRequest.resolution !== provider.resolution ||
    plannedRequest.ratio !== provider.ratio
  ) {
    throw new Error(`镜头${shot.id}的H3请求与计划定义不一致`);
  }
  if (
    resolveManagedProjectPath(
      plannedShot.output?.videoPath,
      `plan.shots.${shot.id}.output.videoPath`,
    ) !== outputPath
  ) {
    throw new Error(`镜头${shot.id}的输出路径与计划定义不一致`);
  }
  return {fixedPlanPath, plan, plannedShot, currentPlanSha256};
};

const committedActualCostBeforeNewAttempt = ({ledger, authorization}) => {
  if (!ledger) return 0;
  let total = 0;
  for (const attempt of Object.values(ledger.attempts ?? {})) {
    if (!['downloaded', 'qa-passed', 'failed'].includes(attempt?.status)) {
      throw new Error(
        `镜头${attempt?.shotId ?? '未知'}已有未终结付费任务` +
          `（${attempt?.status ?? '未知状态'}），禁止新付费提交`,
      );
    }
    if (
      attempt.actualCostStatus !== 'reported' ||
      typeof attempt.actualCostCny !== 'number' ||
      !Number.isFinite(attempt.actualCostCny) ||
      attempt.actualCostCny < 0
    ) {
      throw new Error(
        `镜头${attempt?.shotId ?? '未知'}实际费用尚未完成对账，禁止新付费提交`,
      );
    }
    if (attempt.actualCostCny > Number(authorization.maxPerShotCny)) {
      throw new Error(
        `镜头${attempt?.shotId ?? '未知'}已对账实际费用` +
          `${attempt.actualCostCny}元超过单镜授权上限` +
          `${Number(authorization.maxPerShotCny)}元，禁止新付费提交`,
      );
    }
    total += Number(attempt.actualCostCny);
  }
  if (total > Number(authorization.maxAmountCny)) {
    throw new Error('已有实际费用超过当前授权总额，禁止新付费提交');
  }
  return Number(total.toFixed(6));
};

export const runH3Shot = async ({
  provider = RUNNINGHUB_H3_PROVIDER,
  planPath,
  videoId,
  planId,
  planSha256,
  style,
  authorization,
  shot,
  prompt,
  outputPath,
  ledgerPath,
  apiKey,
  confirmPaid,
  priceQuote = null,
  fetchImpl = fetch,
  pollIntervalMs = 10_000,
  maximumPollCount = 180,
  beforePaidReserve,
}) => {
  assertLegacyProductionScope();
  const securityClock = createSecurityClock();
  const secureNow = () => securityClock.nowIso();
  validateProvider(provider);
  if (confirmPaid !== true) throw new Error('付费提交必须显式提供--confirm-paid');
  const timing = validateAuthorizationDefinition({
    authorization,
    planId,
    planSha256,
  });
  assertAuthorizationLive({timing, currentTimeMs: securityClock.nowMs()});
  const {fixedLedgerPath, fixedOutputPath} = assertFixedGenerationPaths({
    videoId,
    planId,
    shotId: shot.id,
    ledgerPath,
    outputPath,
  });
  const generationPathGuard = () =>
    {
      assertFixedGenerationPaths({
        videoId,
        planId,
        shotId: shot.id,
        ledgerPath: fixedLedgerPath,
        outputPath: fixedOutputPath,
      });
      assertPaidPlanBinding({
        provider,
        planPath,
        videoId,
        planId,
        planSha256,
        authorization,
        shot,
        payload,
        ledgerPath: fixedLedgerPath,
        outputPath: fixedOutputPath,
        securityClock,
      });
    };
  if (lstatOrNull(fixedOutputPath)) {
    throw new Error(`镜头${shot.id}输出文件已存在，拒绝重复生成：${fixedOutputPath}`);
  }
  const payload = buildH3Request({
    prompt,
    durationSeconds: shot.durationSeconds,
    provider,
  });
  assertPaidPlanBinding({
    provider,
    planPath,
    videoId,
    planId,
    planSha256,
    authorization,
    shot,
    payload,
    ledgerPath: fixedLedgerPath,
    outputPath: fixedOutputPath,
    securityClock,
  });
  const existingLedger = loadGeneratedVideoLedger(fixedLedgerPath);
  assertLedgerAuthorizationMatches({
    ledger: existingLedger,
    authorization,
    planId,
    planSha256,
  });
  if (existingLedger?.attempts?.[shot.id]) {
    throw new Error(`镜头${shot.id}已经存在一次付费任务记录，禁止二次提交`);
  }
  const requestSha256 = stableJsonSha256(payload);
  const price = await previewPrice({
    provider,
    apiKey,
    payload,
    fetchImpl,
    pathGuard: generationPathGuard,
  });
  generationPathGuard();
  assertAuthorizationLive({timing, currentTimeMs: securityClock.nowMs()});
  if (priceQuote) {
    if (
      priceQuote.shotId !== shot.id ||
      priceQuote.requestSha256 !== requestSha256 ||
      priceQuote.currency !== 'CNY' ||
      !Number.isFinite(Number(priceQuote.estimatedCostCny)) ||
      Number(priceQuote.estimatedCostCny) < 0 ||
      priceQuote.paidTaskSubmitted !== false
    ) {
      throw new Error(`镜头${shot.id}的批次报价与当前请求不一致，未提交任务`);
    }
    if (
      Math.abs(Number(priceQuote.estimatedCostCny) - price.estimatedCostCny) > 0.000001 ||
      (priceQuote.isFreeThisCall === true) !== price.isFreeThisCall
    ) {
      throw new Error(
        `镜头${shot.id}的批次展示报价与最新服务端报价不一致，未提交任务`,
      );
    }
  }
  if (price.estimatedCostCny > timing.perShotLimit) {
    throw new Error(
      `镜头${shot.id}最新服务端预估费用${price.estimatedCostCny}元超过单镜上限${timing.perShotLimit}元，未提交任务`,
    );
  }
  const reservation = reserveAttempt({
    provider,
    planPath,
    videoId,
    ledgerPath: fixedLedgerPath,
    outputPath: fixedOutputPath,
    planId,
    planSha256,
    style,
    authorization,
    shot,
    payload,
    latestPrice: price,
    securityClock,
    beforePaidReserve,
    record: {
      providerId: provider.id,
      model: provider.model,
      modelRoute: provider.modelRoute,
      resolution: provider.resolution,
      ratio: provider.ratio,
      durationSeconds: shot.durationSeconds,
      promptSha256: sha256Buffer(Buffer.from(payload.prompt)),
      requestSha256,
      maximumCostCny: timing.perShotLimit,
      authorization: authorizationSnapshot(authorization),
    },
  });
  generationPathGuard();
  assertAuthorizationLive({timing, currentTimeMs: securityClock.nowMs()});
  let submitted;
  try {
    submitted = await submitTask({
      provider,
      apiKey,
      payload,
      fetchImpl,
      pathGuard: generationPathGuard,
    });
  } catch (error) {
    updateAttempt({
      ledgerPath: fixedLedgerPath,
      planId,
      shotId: shot.id,
      patch: {status: 'submission-unknown', errorMessage: error.message},
      now: secureNow,
    });
    throw error;
  }
  updateAttempt({
    ledgerPath: fixedLedgerPath,
    planId,
    shotId: shot.id,
    patch: {
      status: statusName(submitted.status).toLowerCase() || 'submitted',
      submittedAt: secureNow(),
      taskId: submitted.taskId,
    },
    now: secureNow,
  });
  const result = await finishTask({
    provider,
    planId,
    shot,
    ledgerPath: fixedLedgerPath,
    outputPath: fixedOutputPath,
    apiKey,
    taskId: submitted.taskId,
    initialResponse: submitted,
    fetchImpl,
    pollIntervalMs,
    maximumPollCount,
    now: secureNow,
    pathGuard: generationPathGuard,
  });
  return {...result, approvalReceipt: reservation.approvalReceipt};
};

export const resumeH3Shot = async ({
  provider = RUNNINGHUB_H3_PROVIDER,
  planPath,
  videoId,
  planId,
  planSha256,
  shot,
  prompt,
  outputPath,
  ledgerPath,
  apiKey,
  fetchImpl = fetch,
  pollIntervalMs = 10_000,
  maximumPollCount = 180,
}) => {
  assertLegacyProductionScope();
  const securityClock = createSecurityClock();
  const secureNow = () => securityClock.nowIso();
  validateProvider(provider);
  const {fixedLedgerPath, fixedOutputPath} = assertFixedGenerationPaths({
    videoId,
    planId,
    shotId: shot.id,
    ledgerPath,
    outputPath,
  });
  const payload = buildH3Request({
    prompt,
    durationSeconds: shot.durationSeconds,
    provider,
  });
  assertPaidPlanBinding({
    provider,
    planPath,
    videoId,
    planId,
    planSha256,
    shot,
    payload,
    ledgerPath: fixedLedgerPath,
    outputPath: fixedOutputPath,
    securityClock,
    validationPhase: 'plan',
  });
  const ledger = loadGeneratedVideoLedger(fixedLedgerPath);
  if (!ledger || ledger.planId !== planId || ledger.planSha256 !== planSha256) {
    throw new Error('RunningHub恢复请求与当前planId或planSha256不一致');
  }
  if (ledger.providerId !== provider.id) {
    throw new Error('RunningHub恢复请求与当前提供商定义不一致');
  }
  const generationPathGuard = () => {
    assertFixedGenerationPaths({
      videoId,
      planId,
      shotId: shot.id,
      ledgerPath: fixedLedgerPath,
      outputPath: fixedOutputPath,
    });
    assertPaidPlanBinding({
      provider,
      planPath,
      videoId,
      planId,
      planSha256,
      authorization: ledger.authorization,
      shot,
      payload,
      ledgerPath: fixedLedgerPath,
      outputPath: fixedOutputPath,
      securityClock,
      validationPhase: 'plan',
    });
  };
  generationPathGuard();
  const attempt = ledger.attempts?.[shot.id];
  if (!attempt) throw new Error(`镜头${shot.id}没有可恢复的RunningHub任务`);
  if (attempt.attemptNumber !== 1 || attempt.shotId !== shot.id) {
    throw new Error(`镜头${shot.id}的付费尝试序号或镜头绑定不一致`);
  }
  if (
    attempt.providerId !== provider.id ||
    attempt.model !== provider.model ||
    attempt.modelRoute !== provider.modelRoute
  ) {
    throw new Error(`镜头${shot.id}的RunningHub提供商或模型定义不一致`);
  }
  const expectedRequestSha256 = stableJsonSha256(payload);
  const expectedPromptSha256 = sha256Buffer(Buffer.from(payload.prompt));
  if (
    attempt.requestSha256 !== expectedRequestSha256 ||
    attempt.promptSha256 !== expectedPromptSha256
  ) {
    throw new Error(`镜头${shot.id}的恢复请求、提示词或时长已发生变化`);
  }
  if (path.resolve(attempt.outputPath ?? '') !== fixedOutputPath) {
    throw new Error(`镜头${shot.id}的账本输出路径与调用者当前固定路径不一致`);
  }
  if (
    stableJsonSha256(attempt.authorization ?? {}) !==
    stableJsonSha256(authorizationSnapshot(ledger.authorization ?? {}))
  ) {
    throw new Error(`镜头${shot.id}的费用授权快照与账本不一致`);
  }
  if (
    ledger.authorization?.scope?.type !== 'plan-only' ||
    ledger.authorization?.scope?.planId !== planId ||
    ledger.authorization?.scope?.definitionSha256 !== planSha256
  ) {
    throw new Error(`镜头${shot.id}的费用授权未绑定当前计划定义`);
  }
  const receiptPath = approvalReceiptPathFor(ledger.authorization?.approvalId);
  if (!lstatOrNull(receiptPath)) {
    throw new Error(`镜头${shot.id}的费用批准消费回执缺失，禁止恢复`);
  }
  verifyApprovalConsumptionReceipt({
    planId,
    planSha256,
    authorization: ledger.authorization,
    ledgerPath: fixedLedgerPath,
  });
  const taskId = ensureText(attempt.taskId, `镜头${shot.id}.taskId`);
  if (!taskId) {
    throw new Error(`镜头${shot.id}没有taskId，禁止重新提交，只能核对账单`);
  }
  if (attempt.status === 'downloaded' || attempt.status === 'qa-passed') {
    throw new Error(`镜头${shot.id}已经下载完成，不需要恢复`);
  }
  if (attempt.status === 'failed' && attempt.actualCostStatus === 'reported') {
    throw new Error(`镜头${shot.id}已终结失败且费用已对账，不需要恢复`);
  }
  generationPathGuard();
  const firstQuery = await queryTask({
    provider,
    apiKey,
    taskId,
    fetchImpl,
    pathGuard: generationPathGuard,
  });
  return finishTask({
    provider,
    planId,
    shot,
    ledgerPath: fixedLedgerPath,
    outputPath: fixedOutputPath,
    apiKey,
    taskId,
    initialResponse: firstQuery,
    fetchImpl,
    pollIntervalMs,
    maximumPollCount,
    now: secureNow,
    pathGuard: generationPathGuard,
  });
};
