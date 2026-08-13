#!/usr/bin/env node

import crypto from 'node:crypto';
import { constants } from 'node:fs';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const personalKnowledgeBase = process.env.KOUBO_PERSONAL_KB?.trim()
  ? path.resolve(process.env.KOUBO_PERSONAL_KB)
  : path.resolve(projectRoot, '..', '个人知识库');
const topicRadarRoot = process.env.KOUBO_TOPIC_RADAR_ROOT?.trim()
  ? path.resolve(process.env.KOUBO_TOPIC_RADAR_ROOT)
  : path.resolve(projectRoot, '..', 'AI选题雷达');
const defaultContextPath = process.env.KOUBO_ACCOUNT_PERFORMANCE_CONTEXT?.trim()
  ? path.resolve(process.env.KOUBO_ACCOUNT_PERFORMANCE_CONTEXT)
  : path.join(topicRadarRoot, 'data/state/douyin-account-performance-context.json');
const defaultLearningCardPath = process.env.KOUBO_ACCOUNT_LEARNING_CARD?.trim()
  ? path.resolve(process.env.KOUBO_ACCOUNT_LEARNING_CARD)
  : path.join(
    personalKnowledgeBase,
    '01_项目实战/抖音知识中台/工作区/2026-08-09-超哥AI创业记账号数据复盘/当前账号实测学习卡.json'
  );

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;

function parseArguments(argv) {
  const result = {
    contextPath: defaultContextPath,
    learningCardPath: defaultLearningCardPath,
    requiresCurrent: false,
    output: '',
    snapshotDirectory: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--task-id') result.taskId = argv[++index];
    else if (argument === '--output') result.output = argv[++index];
    else if (argument === '--snapshot-directory') result.snapshotDirectory = path.resolve(argv[++index]);
    else if (argument === '--context') result.contextPath = path.resolve(argv[++index]);
    else if (argument === '--learning-card') result.learningCardPath = path.resolve(argv[++index]);
    else if (argument === '--requires-current') result.requiresCurrent = true;
    else throw new Error(`未知参数：${argument}`);
  }
  result.taskId = String(result.taskId || '').trim();
  if (!TASK_ID_PATTERN.test(result.taskId)) {
    throw new Error('必须提供稳定的 --task-id，仅允许字母、数字、点、下划线、冒号和短横线');
  }
  result.output = result.output
    ? path.resolve(result.output)
    : path.join(projectRoot, 'workflow/account-performance-preflights', `${result.taskId}.json`);
  result.snapshotDirectory = result.snapshotDirectory
    ? path.resolve(result.snapshotDirectory)
    : path.join(projectRoot, 'workflow/account-performance-snapshots');
  return result;
}

function sha256Buffer(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function sha256Json(value) {
  return sha256Buffer(Buffer.from(JSON.stringify(value)));
}

async function loadJson(filePath, label) {
  let content;
  try {
    await access(filePath, constants.R_OK);
    content = await readFile(filePath);
  } catch {
    throw new Error(`${label}不存在或不可读：${filePath}`);
  }
  let value;
  try {
    value = JSON.parse(content.toString('utf8'));
  } catch {
    throw new Error(`${label}不是有效JSON：${filePath}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}顶层必须是对象：${filePath}`);
  }
  return { value, content, sha256: sha256Buffer(content) };
}

function validateContext(context, requiresCurrent) {
  if (context.schemaVersion !== 'douyin-account-performance-context/1.0') {
    throw new Error('账号表现执行上下文版本无效，必须先由AI选题雷达重新生成');
  }
  if (!['ready', 'historical-stale'].includes(context.status)) {
    throw new Error(`账号表现执行上下文不可用：${context.status || '未知状态'}`);
  }
  const coverage = context.coverage || {};
  const receipt = context.sourceReceipt || {};
  if (coverage.allAcceptedHistoryUsed !== true || coverage.allPublishedWorksIncluded !== true) {
    throw new Error('账号表现执行上下文没有覆盖全部已接纳历史和全部已发布作品');
  }
  if (!Number.isInteger(coverage.publishedWorkCount) || coverage.publishedWorkCount < 1) {
    throw new Error('账号表现执行上下文缺少有效作品数量');
  }
  if (!Number.isInteger(coverage.acceptedRunCount) || coverage.acceptedRunCount < 1) {
    throw new Error('账号表现执行上下文缺少已接纳快照历史');
  }
  if (!Array.isArray(context.allPublishedWorks)
    || context.allPublishedWorks.length !== coverage.publishedWorkCount) {
    throw new Error('账号表现执行上下文的全量作品明细与覆盖数量不一致');
  }
  const expectedRecentCount = Math.min(6, coverage.publishedWorkCount);
  if (!Array.isArray(context.recentSix) || context.recentSix.length !== expectedRecentCount) {
    throw new Error('账号表现执行上下文缺少最近六条作品明细');
  }
  if (!Array.isArray(context.acceptedHistory?.snapshots)
    || context.acceptedHistory.snapshots.length !== coverage.acceptedRunCount) {
    throw new Error('账号表现执行上下文的快照历史与覆盖数量不一致');
  }
  if (!context.accountBaseline || typeof context.accountBaseline !== 'object'
    || Array.isArray(context.accountBaseline)
    || !Array.isArray(context.contentTypeBaselines)) {
    throw new Error('账号表现执行上下文缺少全账号或内容类型基线');
  }
  if (typeof context.acceptedHistory.status !== 'string'
    || !context.acceptedHistory.periods
    || typeof context.acceptedHistory.periods !== 'object'
    || Array.isArray(context.acceptedHistory.periods)
    || !Array.isArray(context.acceptedHistory.latestVideoChanges)
    || !Array.isArray(context.acceptedHistory.anomalies)
    || typeof context.acceptedHistory.boundary !== 'string') {
    throw new Error('账号表现执行上下文缺少完整的历史变化信号');
  }
  if (!String(receipt.acceptedRunId || '').trim()
    || !SHA256_PATTERN.test(String(receipt.sourceSha256 || ''))
    || receipt.publishedWorkCount !== coverage.publishedWorkCount) {
    throw new Error('账号表现执行上下文来源回执不完整');
  }
  if (context.interpretationBoundary?.descriptiveFactsOnly !== true
    || context.interpretationBoundary?.causalLessonsRequireHumanConfirmation !== true
    || context.interpretationBoundary?.staleDataCannotBeDescribedAsCurrent !== true) {
    throw new Error('账号表现执行上下文缺少事实与因果边界');
  }
  if (requiresCurrent && (context.status !== 'ready' || context.accountDataState?.stale !== false)) {
    throw new Error('本任务要求当前账号数据，但最近官方采集已过期或失败');
  }
}

function validateLearningCard(card) {
  if (card.schema_version !== 1
    || card.type !== 'douyin-account-performance-learning'
    || card.status !== 'current') {
    throw new Error('当前账号实测学习卡版本、类型或状态无效');
  }
  const activeLessonIds = (Array.isArray(card.lessons) ? card.lessons : [])
    .filter((lesson) => lesson?.status === 'active' && String(lesson?.id || '').trim())
    .map((lesson) => lesson.id);
  if (!activeLessonIds.length) throw new Error('当前账号实测学习卡没有有效学习');
  if (!card.active_content_contract?.opening
    || !card.active_content_contract?.duration
    || !card.active_content_contract?.metrics) {
    throw new Error('当前账号实测学习卡缺少执行合同');
  }
  return activeLessonIds;
}

async function atomicWrite(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  await writeFile(temporaryPath, content, { mode: 0o600 });
  await rename(temporaryPath, filePath);
}

async function immutableContextSnapshot(contextPath, contextSha256, snapshotDirectory) {
  const snapshotPath = path.join(snapshotDirectory, `${contextSha256}.json`);
  await mkdir(snapshotDirectory, { recursive: true });
  try {
    await copyFile(contextPath, snapshotPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const copied = await readFile(snapshotPath);
  if (sha256Buffer(copied) !== contextSha256) {
    throw new Error(`账号数据证据快照哈希异常：${snapshotPath}`);
  }
  return snapshotPath;
}

export async function prepareAccountPerformancePreflight(options) {
  const taskId = String(options.taskId || '').trim();
  if (!TASK_ID_PATTERN.test(taskId)) throw new Error('任务ID格式无效');
  const contextPath = path.resolve(options.contextPath || defaultContextPath);
  const learningCardPath = path.resolve(options.learningCardPath || defaultLearningCardPath);
  const outputPath = path.resolve(options.output);
  const contextFile = await loadJson(contextPath, '账号表现执行上下文');
  validateContext(contextFile.value, options.requiresCurrent === true);
  const learningCardFile = await loadJson(learningCardPath, '当前账号实测学习卡');
  const activeLessonIds = validateLearningCard(learningCardFile.value);
  const contextSnapshotPath = await immutableContextSnapshot(
    contextPath,
    contextFile.sha256,
    path.resolve(
      options.snapshotDirectory
        || path.join(projectRoot, 'workflow/account-performance-snapshots')
    )
  );
  const context = contextFile.value;
  const receipt = {
    schemaVersion: 'koubo-account-performance-preflight/1.1',
    taskId,
    generatedAt: new Date().toISOString(),
    status: context.status === 'ready' ? 'ready-current' : 'ready-historical-stale',
    requiresCurrentAccountData: options.requiresCurrent === true,
    accountContext: {
      snapshotPath: contextSnapshotPath,
      snapshotSha256: contextFile.sha256,
      sourceReceiptSha256: context.sourceReceipt.receiptSha256,
      acceptedRunId: context.sourceReceipt.acceptedRunId,
      collectedAt: context.sourceReceipt.collectedAt,
      dataStatus: context.status,
      stale: context.accountDataState.stale,
      publishedWorkCount: context.coverage.publishedWorkCount,
      acceptedRunCount: context.coverage.acceptedRunCount,
      acceptedHistoryCoverageHours: context.coverage.acceptedHistoryCoverageHours,
      allAcceptedHistoryUsed: true,
      allPublishedWorksIncluded: true,
      recentSixCount: context.recentSix.length,
      contextSummarySha256: sha256Json({
        sourceReceipt: context.sourceReceipt,
        coverage: context.coverage,
        accountBaseline: context.accountBaseline,
        contentTypeBaselines: context.contentTypeBaselines,
        recentSix: context.recentSix
      }),
      currentUseBoundary: context.accountDataState.boundary
    },
    learningCard: {
      path: learningCardPath,
      sha256: learningCardFile.sha256,
      snapshotAt: learningCardFile.value.snapshot_at,
      activeLessonIds
    },
    automaticReference: {
      accountBaseline: context.accountBaseline,
      contentTypeBaselines: context.contentTypeBaselines,
      recentSix: context.recentSix,
      acceptedHistorySignals: {
        status: context.acceptedHistory.status,
        periods: context.acceptedHistory.periods,
        latestVideoChanges: context.acceptedHistory.latestVideoChanges,
        anomalies: context.acceptedHistory.anomalies,
        boundary: context.acceptedHistory.boundary
      }
    },
    automaticUseContract: {
      generatedBeforeTopicOrDraft: true,
      descriptiveFactsLoadedAutomatically: true,
      humanConfirmedLessonsLoadedAutomatically: true,
      appliedLessonSelectionStillRequiredInContentGate: true,
      causalLessonsNotAutoGenerated: true,
      staleDataCannotBeDescribedAsCurrent: true
    },
    boundary: context.status === 'ready'
      ? '本回执绑定当前已接纳官方数据；平台统计仍可能延迟，因果结论仍需人工复盘。'
      : '本回执绑定最后一次成功的全量官方历史数据；最近采集失败或过期，不得把这些指标表述为当前实时状态。'
  };
  await atomicWrite(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return { receipt, outputPath };
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const { receipt, outputPath } = await prepareAccountPerformancePreflight(args);
    console.log(JSON.stringify({
      ok: true,
      outputPath,
      receiptSha256: sha256Buffer(await readFile(outputPath)),
      taskId: receipt.taskId,
      status: receipt.status,
      publishedWorkCount: receipt.accountContext.publishedWorkCount,
      acceptedRunCount: receipt.accountContext.acceptedRunCount,
      activeLessonCount: receipt.learningCard.activeLessonIds.length
    }, null, 2));
  } catch (error) {
    console.error(`账号表现自动预检失败：${error.message}`);
    process.exitCode = 1;
  }
}
