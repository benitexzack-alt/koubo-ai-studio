#!/usr/bin/env node

import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  approvalReceiptRelativePathFor,
  compileShotPrompt,
  generationDefinitionSha256,
  loadPlanAndStyle,
  sha256File,
  stableJsonSha256,
  validateGeneratedVideoPlan,
} from './generated-video-plan-core.mjs';
import {
  RUNNINGHUB_H3_PROVIDER,
  approvalReceiptPathFor,
  buildH3Request,
  loadGeneratedVideoLedger,
  quoteH3Shot,
  resumeH3Shot,
  runH3Shot,
  stableJsonSha256 as providerStableJsonSha256,
} from './runninghub-generated-video-client.mjs';
import {
  assertNoRetiredGeneratedStyle,
  findRetiredGeneratedStyleFingerprints,
} from './generated-style-policy.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const toAbsolute = (filePath) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
const clone = (value) => JSON.parse(JSON.stringify(value));
const timestamp = (now) =>
  typeof now === 'function' ? now() : new Date().toISOString();

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

const runtimeConfig = () => {
  const envPath = path.join(projectRoot, '.env');
  const fileEnv = fs.existsSync(envPath)
    ? parseEnv(fs.readFileSync(envPath, 'utf8'))
    : {};
  return {...fileEnv, ...process.env};
};

const assertProjectPathWithoutSymlinks = (filePath, label) => {
  const absolutePath = toAbsolute(filePath);
  if (
    absolutePath !== projectRoot &&
    !absolutePath.startsWith(`${projectRoot}${path.sep}`)
  ) {
    throw new Error(`${label}必须位于口播项目内：${filePath}`);
  }
  const relativePath = path.relative(projectRoot, absolutePath);
  let cursor = projectRoot;
  for (const segment of relativePath.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`${label}路径不得经过符号链接：${filePath}`);
    }
  }
  return absolutePath;
};

const atomicWriteJson = (filePath, value, {beforeCommit = null} = {}) => {
  const absolutePath = assertProjectPathWithoutSymlinks(filePath, 'JSON写入目标');
  const parent = path.dirname(absolutePath);
  fs.mkdirSync(parent, {recursive: true});
  assertProjectPathWithoutSymlinks(parent, 'JSON写入目录');
  const temporaryPath = `${absolutePath}.tmp-${process.pid}-${randomUUID()}`;
  const descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
  let descriptorClosed = false;
  let committed = false;
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptorClosed = true;
    if (typeof beforeCommit === 'function') beforeCommit();
    assertProjectPathWithoutSymlinks(parent, 'JSON写入目录');
    fs.renameSync(temporaryPath, absolutePath);
    committed = true;
  } finally {
    if (!descriptorClosed) fs.closeSync(descriptor);
    if (!committed) fs.rmSync(temporaryPath, {force: true});
  }
};

const acquirePlanExecutionLock = (planPath) => {
  const absolutePlanPath = assertProjectPathWithoutSymlinks(
    planPath,
    '生成视频拆镜计划',
  );
  const lockPath = `${absolutePlanPath}.execution.lock`;
  assertProjectPathWithoutSymlinks(path.dirname(lockPath), '计划执行锁目录');
  let descriptor;
  try {
    descriptor = fs.openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(
        `生成视频计划正在被另一进程执行或写入：${lockPath}；禁止并发付费或覆盖计划`,
      );
    }
    throw error;
  }
  const opened = fs.fstatSync(descriptor);
  fs.writeFileSync(
    descriptor,
    `${JSON.stringify({pid: process.pid, acquiredAt: new Date().toISOString()})}\n`,
  );
  fs.fsyncSync(descriptor);
  return () => {
    try {
      fs.closeSync(descriptor);
    } finally {
      if (fs.existsSync(lockPath)) {
        const current = fs.lstatSync(lockPath);
        if (
          current.isFile() &&
          current.dev === opened.dev &&
          current.ino === opened.ino
        ) {
          fs.rmSync(lockPath, {force: true});
        }
      }
    }
  };
};

const createPlanCas = ({loaded, requestedPlanPath}) => {
  let expectedSha256 = loaded.planSha256;
  const readCurrent = () => {
    const current = loadPlanAndStyle(requestedPlanPath);
    if (current.planSha256 !== expectedSha256) {
      throw new Error(
        '生成视频计划在执行期间被其他进程修改；已停止后续付费和计划写回，' +
          '请核对当前计划、授权与任务账本',
      );
    }
    return current;
  };
  return {
    assertCurrent: readCurrent,
    write: () => {
      readCurrent();
      atomicWriteJson(loaded.planPath, loaded.plan, {beforeCommit: readCurrent});
      expectedSha256 = stableJsonSha256(loaded.plan);
      return expectedSha256;
    },
  };
};

const assertValid = (plan, style, phase, now) => {
  const result = validateGeneratedVideoPlan(plan, style, {phase, now});
  if (!result.ok) {
    throw new Error(
      `生成视频计划未通过 ${phase} 门禁：\n${result.errors
        .map((error) => `- [${error.code}] ${error.message}`)
        .join('\n')}`,
    );
  }
  return result;
};

const assertRunningHubActionAllowed = ({loaded, planPath, operation}) =>
  assertNoRetiredGeneratedStyle({
    value: {plan: loaded.plan, style: loaded.style},
    operation: `RunningHub ${operation}`,
    location: '$runningHubPlan',
    additionalStrings: [planPath, loaded.planPath, loaded.stylePath],
    projectRoot,
    documentPaths: [planPath, loaded.planPath, loaded.stylePath],
  });

const retiredStyleHitsFor = ({loaded, planPath}) =>
  findRetiredGeneratedStyleFingerprints(
    {plan: loaded.plan, style: loaded.style},
    {
      location: '$runningHubPlan',
      additionalStrings: [planPath, loaded.planPath, loaded.stylePath],
      projectRoot,
      documentPaths: [planPath, loaded.planPath, loaded.stylePath],
    },
  );

const requireApiKey = (apiKey) => {
  if (!isText(apiKey)) {
    throw new Error('缺少RUNNINGHUB_API_KEY；未执行联网报价或付费提交');
  }
  return apiKey.trim();
};

const runtimeShot = (shot) => ({
  id: shot.id,
  durationSeconds: shot.timing.durationSeconds,
});

export const compilePlanFile = ({planPath}) => {
  const prelockLoaded = loadPlanAndStyle(planPath);
  assertRunningHubActionAllowed({
    loaded: prelockLoaded,
    planPath,
    operation: 'compile',
  });
  const releaseLock = acquirePlanExecutionLock(planPath);
  try {
    const loaded = loadPlanAndStyle(planPath);
    assertRunningHubActionAllowed({loaded, planPath, operation: 'compile'});
    const planCas = createPlanCas({loaded, requestedPlanPath: planPath});
    const next = clone(loaded.plan);
    let changed = false;
    for (const shot of next.shots ?? []) {
      const compiledPrompt = compileShotPrompt(next, loaded.style, shot);
      if (shot.promptCore?.compiledPrompt !== compiledPrompt) {
        shot.promptCore.compiledPrompt = compiledPrompt;
        changed = true;
      }
    }
    if (changed) {
      next.productionStatus = 'planned';
      next.costAuthorization = {
        ...next.costAuthorization,
        status: 'not-approved',
        approvalId: null,
        approvedBy: null,
        approvedAt: null,
        expiresAt: null,
        maxPerShotCny: null,
        maxAmountCny: null,
        scope: {
          type: 'plan-only',
          planId: next.planId,
          definitionSha256: null,
        },
        currency: 'CNY',
        maxAttemptsPerShot: 1,
        automaticRetry: false,
      };
      next.outputs = {
        ...next.outputs,
        approvalReceiptPath: null,
        approvalReceiptSha256: null,
      };
    }
    assertValid(next, loaded.style, 'plan');
    if (changed) {
      loaded.plan = next;
      planCas.write();
    }
    return {changed, plan: next, style: loaded.style};
  } finally {
    releaseLock();
  }
};

export const preflightPlan = ({planPath}) => {
  const loaded = loadPlanAndStyle(planPath);
  assertRunningHubActionAllowed({loaded, planPath, operation: 'preflight'});
  const validation = assertValid(loaded.plan, loaded.style, 'plan');
  return {
    planId: loaded.plan.planId,
    videoId: loaded.plan.videoId,
    shotCount: loaded.plan.shots.length,
    provider: loaded.plan.provider,
    definitionSha256: generationDefinitionSha256(loaded.plan),
    promptSha256ByShot: Object.fromEntries(
      loaded.plan.shots.map((shot) => [
        shot.id,
        stableJsonSha256(validation.compiledPrompts[shot.id]),
      ]),
    ),
    paidTaskSubmitted: false,
  };
};

const quoteShots = async ({plan, style, shots, apiKey, fetchImpl}) => {
  const validation = assertValid(plan, style, 'plan');
  return Promise.all(
    shots.map((shot) =>
      quoteH3Shot({
        apiKey,
        shot: runtimeShot(shot),
        prompt: validation.compiledPrompts[shot.id],
        fetchImpl,
      }),
    ),
  );
};

const quotePathFor = (plan) =>
  plan.outputs?.quotePath ??
  path.posix.join(
    plan.outputs?.rootDir ?? `edit/generated-video/${plan.planId}`,
    'latest-quote.json',
  );

const syncApprovalReceiptEvidence = ({plan, receiptPath = null}) => {
  const expectedAbsolute = approvalReceiptPathFor(
    plan.costAuthorization.approvalId,
  );
  if (isText(receiptPath) && path.resolve(receiptPath) !== expectedAbsolute) {
    throw new Error('RunningHub费用批准消费回执路径与当前approvalId不一致');
  }
  if (!fs.existsSync(expectedAbsolute)) {
    throw new Error('RunningHub费用批准消费回执缺失，禁止把任务标记为已物化');
  }
  const relativePath = approvalReceiptRelativePathFor(
    plan.costAuthorization.approvalId,
  );
  plan.outputs = {
    ...plan.outputs,
    approvalReceiptPath: relativePath,
    approvalReceiptSha256: sha256File(relativePath),
  };
  return {
    receiptPath: expectedAbsolute,
    relativePath,
    sha256: plan.outputs.approvalReceiptSha256,
  };
};

export const quotePlan = async ({
  planPath,
  apiKey,
  fetchImpl = fetch,
  now,
  writeReport = true,
}) => {
  const loaded = loadPlanAndStyle(planPath);
  assertRunningHubActionAllowed({loaded, planPath, operation: 'quote'});
  const key = requireApiKey(apiKey);
  const quotes = await quoteShots({
    plan: loaded.plan,
    style: loaded.style,
    shots: loaded.plan.shots,
    apiKey: key,
    fetchImpl,
  });
  const totalEstimatedCostCny = Number(
    quotes.reduce((total, quote) => total + quote.estimatedCostCny, 0).toFixed(4),
  );
  const report = {
    schemaVersion: 'runninghub-quote/v1',
    planId: loaded.plan.planId,
    definitionSha256: generationDefinitionSha256(loaded.plan),
    quotedAt: timestamp(now),
    priceFreshness: 'current-at-request-time',
    currency: 'CNY',
    totalEstimatedCostCny,
    quotes,
    ledgerCreated: false,
    paidTaskSubmitted: false,
  };
  if (writeReport) atomicWriteJson(quotePathFor(loaded.plan), report);
  return report;
};

const syncShotOutput = ({plan, shotId, result}) => {
  const shot = plan.shots.find((item) => item.id === shotId);
  if (!shot) throw new Error(`计划中找不到镜头${shotId}`);
  const attempt = result.attempt;
  const hasReportedActualCost =
    attempt.actualCostStatus === 'reported' &&
    Number.isFinite(Number(attempt.actualCostCny)) &&
    Number(attempt.actualCostCny) >= 0;
  shot.output = {
    ...shot.output,
    providerTaskId: result.taskId,
    sha256: attempt.outputSha256,
    attemptCount: 1,
    chargedCostCny: hasReportedActualCost
      ? Number(attempt.actualCostCny)
      : null,
    costBasis: hasReportedActualCost ? 'actual' : 'unconfirmed',
  };
};

const requireReportedActualCost = (attempt, label) => {
  const value = Number(attempt?.actualCostCny);
  if (
    attempt?.actualCostStatus !== 'reported' ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `${label}没有可核对的非负实际费用；必须恢复同一taskId完成账单对账，` +
        '不得用预估费用替代实际扣费或继续提交后续镜头',
    );
  }
  return value;
};

const assertQuotesWithinPerShotLimit = (plan, quotes, suffix) => {
  for (const quote of quotes) {
    if (quote.estimatedCostCny > plan.costAuthorization.maxPerShotCny) {
      throw new Error(
        `镜头${quote.shotId}最新预估${quote.estimatedCostCny}元超过单镜授权上限` +
          `${plan.costAuthorization.maxPerShotCny}元；${suffix}`,
      );
    }
  }
};

const allDownloaded = (plan, ledger) =>
  (plan.shots ?? []).every((shot) => {
    const attempt = ledger?.attempts?.[shot.id];
    return (
      ['downloaded', 'qa-passed'].includes(attempt?.status) &&
      isText(shot.output?.videoPath) &&
      fs.existsSync(toAbsolute(shot.output.videoPath))
    );
  });

const assertLedgerDefinition = (plan, ledger) => {
  if (!ledger) return;
  const expected = generationDefinitionSha256(plan);
  if (ledger.planId !== plan.planId || ledger.planSha256 !== expected) {
    throw new Error(
      'RunningHub任务账本与当前拆镜、提示词或输出定义不一致；禁止复用旧任务或重新提交',
    );
  }
};

const promptSha256 = (prompt) =>
  createHash('sha256').update(Buffer.from(prompt)).digest('hex');

const assertAttemptBinding = ({plan, shot, attempt}) => {
  if (!attempt) throw new Error(`镜头${shot.id}没有可恢复的RunningHub任务记录`);
  const expectedOutputPath = toAbsolute(shot.output.videoPath);
  const expectedRequestSha256 = providerStableJsonSha256(
    buildH3Request({
      prompt: shot.promptCore.compiledPrompt,
      durationSeconds: shot.timing.durationSeconds,
    }),
  );
  const failures = [];
  if (attempt.attemptNumber !== 1) failures.push('attemptNumber');
  if (attempt.shotId !== shot.id) failures.push('shotId');
  if (attempt.providerId !== RUNNINGHUB_H3_PROVIDER.id) failures.push('providerId');
  if (attempt.model !== RUNNINGHUB_H3_PROVIDER.model) failures.push('model');
  if (attempt.modelRoute !== RUNNINGHUB_H3_PROVIDER.modelRoute) {
    failures.push('modelRoute');
  }
  if (attempt.resolution !== RUNNINGHUB_H3_PROVIDER.resolution) {
    failures.push('resolution');
  }
  if (attempt.ratio !== RUNNINGHUB_H3_PROVIDER.ratio) failures.push('ratio');
  if (attempt.durationSeconds !== shot.timing.durationSeconds) {
    failures.push('durationSeconds');
  }
  if (attempt.requestSha256 !== expectedRequestSha256) failures.push('requestSha256');
  if (attempt.promptSha256 !== promptSha256(shot.promptCore.compiledPrompt)) {
    failures.push('promptSha256');
  }
  if (
    !isText(attempt.outputPath) ||
    path.resolve(attempt.outputPath) !== expectedOutputPath
  ) {
    failures.push('outputPath');
  }
  if (!isText(attempt.taskId)) failures.push('taskId');
  if (
    isText(shot.output?.providerTaskId) &&
    shot.output.providerTaskId !== attempt.taskId
  ) {
    failures.push('plan.providerTaskId');
  }
  if (
    isText(shot.output?.sha256) &&
    shot.output.sha256 !== attempt.outputSha256
  ) {
    failures.push('plan.outputSha256');
  }
  if (![0, 1].includes(shot.output?.attemptCount)) {
    failures.push('plan.attemptCount');
  }
  if (
    shot.output?.chargedCostCny !== null &&
    shot.output?.chargedCostCny !== undefined &&
    Number(shot.output.chargedCostCny) !== Number(attempt.actualCostCny)
  ) {
    failures.push('plan.chargedCostCny');
  }
  const expectedAuthorization = {
    approvalId: plan.costAuthorization.approvalId,
    approvedBy: plan.costAuthorization.approvedBy,
    approvedAt: plan.costAuthorization.approvedAt,
    expiresAt: plan.costAuthorization.expiresAt,
    status: plan.costAuthorization.status,
    scope: plan.costAuthorization.scope,
    maxPerShotCny: Number(plan.costAuthorization.maxPerShotCny),
    maxAmountCny: Number(plan.costAuthorization.maxAmountCny),
    currency: plan.costAuthorization.currency,
    maxAttemptsPerShot: plan.costAuthorization.maxAttemptsPerShot,
    automaticRetry: plan.costAuthorization.automaticRetry,
  };
  if (
    providerStableJsonSha256(attempt.authorization ?? {}) !==
    providerStableJsonSha256(expectedAuthorization)
  ) {
    failures.push('authorization');
  }
  if (failures.length > 0) {
    throw new Error(
      `镜头${shot.id}账本任务绑定损坏（${failures.join('、')}）；` +
        '禁止查询或写入，需人工核对原始任务回执',
    );
  }
  return attempt;
};

const runPlanLocked = async ({
  planPath,
  apiKey,
  confirmPaid,
  fetchImpl = fetch,
  pollIntervalMs = 10_000,
  maximumPollCount = 180,
  now,
}) => {
  if (confirmPaid !== true) {
    throw new Error('批次付费提交必须显式提供--confirm-paid');
  }
  const loaded = loadPlanAndStyle(planPath);
  assertRunningHubActionAllowed({loaded, planPath, operation: 'run'});
  const planCas = createPlanCas({loaded, requestedPlanPath: planPath});
  assertValid(loaded.plan, loaded.style, 'submit', now);
  if (!['ready-for-submit', 'submitted'].includes(loaded.plan.productionStatus)) {
    throw new Error(
      `当前productionStatus=${loaded.plan.productionStatus}，只有ready-for-submit或submitted可以执行付费提交`,
    );
  }
  const key = requireApiKey(apiKey);
  const ledgerPath = toAbsolute(loaded.plan.outputs.ledgerPath);
  const ledger = loadGeneratedVideoLedger(ledgerPath);
  assertLedgerDefinition(loaded.plan, ledger);
  const outstanding = [];
  let priorAuthorizedCostCny = 0;
  let recoveredCompletedEvidence = false;
  for (const shot of loaded.plan.shots) {
    const attempt = ledger?.attempts?.[shot.id];
    if (!attempt) {
      outstanding.push(shot);
      continue;
    }
    assertAttemptBinding({plan: loaded.plan, shot, attempt});
    if (!['downloaded', 'qa-passed'].includes(attempt.status)) {
      throw new Error(
        `镜头${shot.id}已有taskId=${attempt.taskId ?? '未知'}且状态=${attempt.status}；` +
          '必须恢复同一任务，禁止再次提交',
      );
    }
    priorAuthorizedCostCny += requireReportedActualCost(
      attempt,
      `镜头${shot.id}既有任务`,
    );
    if (!fs.existsSync(toAbsolute(shot.output.videoPath))) {
      throw new Error(`镜头${shot.id}账本已完成但本地文件缺失，禁止重新提交`);
    }
    const actualOutputSha256 = sha256File(shot.output.videoPath);
    if (actualOutputSha256 !== attempt.outputSha256) {
      throw new Error(
        `镜头${shot.id}本地文件与任务账本哈希不一致；禁止覆盖或重新提交`,
      );
    }
    syncShotOutput({
      plan: loaded.plan,
      shotId: shot.id,
      result: {taskId: attempt.taskId, attempt},
    });
    recoveredCompletedEvidence = true;
  }
  const recoveredApprovalReceipt = recoveredCompletedEvidence
    ? syncApprovalReceiptEvidence({plan: loaded.plan})
    : null;
  if (recoveredCompletedEvidence) {
    planCas.write();
  }

  let activeQuotes = await quoteShots({
    plan: loaded.plan,
    style: loaded.style,
    shots: outstanding,
    apiKey: key,
    fetchImpl,
  });
  planCas.assertCurrent();
  assertQuotesWithinPerShotLimit(
    loaded.plan,
    activeQuotes,
    '全部镜头均未新提交',
  );
  const newEstimatedCostCny = activeQuotes.reduce(
    (total, quote) => total + quote.estimatedCostCny,
    0,
  );
  const authorizedBatchTotalCny = Number(
    (priorAuthorizedCostCny + newEstimatedCostCny).toFixed(4),
  );
  if (authorizedBatchTotalCny > loaded.plan.costAuthorization.maxAmountCny) {
    throw new Error(
      `批次预估总额${authorizedBatchTotalCny}元超过用户授权上限` +
        `${loaded.plan.costAuthorization.maxAmountCny}元；全部镜头均未新提交`,
    );
  }

  const quoteReport = {
    schemaVersion: 'runninghub-quote/v1',
    planId: loaded.plan.planId,
    definitionSha256: generationDefinitionSha256(loaded.plan),
    quotedAt: timestamp(now),
    priceFreshness: 'per-shot-refreshed-immediately-before-submit',
    currency: 'CNY',
    priorAuthorizedCostCny,
    newEstimatedCostCny,
    authorizedBatchTotalCny,
    latestProjectedTotalCny: authorizedBatchTotalCny,
    quotes: activeQuotes,
    quoteCycles: [{
      quotedAt: timestamp(now),
      reason: 'initial-batch-before-first-submit',
      shotIds: outstanding.map((shot) => shot.id),
      quotes: activeQuotes,
    }],
    ledgerCreated: ledger !== null,
    paidTaskSubmitted: false,
  };
  atomicWriteJson(quotePathFor(loaded.plan), quoteReport);

  const results = [];
  let approvalReceipt = recoveredApprovalReceipt;
  let accumulatedActualCostCny = priorAuthorizedCostCny;
  for (const [index, shot] of outstanding.entries()) {
    planCas.assertCurrent();
    assertValid(loaded.plan, loaded.style, 'submit', now);
    const currentQuote = activeQuotes.find((quote) => quote.shotId === shot.id);
    if (!currentQuote) {
      throw new Error(`镜头${shot.id}缺少提交前最新报价，未提交任务`);
    }
    const result = await runH3Shot({
      planPath: loaded.planPath,
      planId: loaded.plan.planId,
      videoId: loaded.plan.videoId,
      planSha256: generationDefinitionSha256(loaded.plan),
      style: {
        id: loaded.style.id,
        sha256: stableJsonSha256(loaded.style),
      },
      authorization: loaded.plan.costAuthorization,
      shot: runtimeShot(shot),
      prompt: shot.promptCore.compiledPrompt,
      outputPath: toAbsolute(shot.output.videoPath),
      ledgerPath,
      apiKey: key,
      confirmPaid: true,
      priceQuote: currentQuote,
      fetchImpl,
      pollIntervalMs,
      maximumPollCount,
      beforePaidReserve: () => planCas.assertCurrent(),
    });
    results.push(result);
    approvalReceipt = syncApprovalReceiptEvidence({
      plan: loaded.plan,
      receiptPath: result.approvalReceipt?.receiptPath,
    });
    syncShotOutput({plan: loaded.plan, shotId: shot.id, result});
    loaded.plan.productionStatus = 'submitted';
    planCas.write();
    if (
      result.attempt.actualCostStatus !== 'reported' ||
      !Number.isFinite(Number(result.attempt.actualCostCny)) ||
      Number(result.attempt.actualCostCny) < 0
    ) {
      loaded.plan.productionStatus = 'billing-reconciliation-required';
      loaded.plan.billingReconciliation = {
        status: 'unresolved',
        shotId: shot.id,
        taskId: result.taskId,
        detectedAt: timestamp(now),
        actualCostStatus: result.attempt.actualCostStatus ?? 'missing',
        message:
          'RunningHub未返回可核对的非负实际费用；已停止后续付费提交，' +
          '不得以预估费用冒充实际扣费。',
      };
      quoteReport.paidTaskSubmitted = true;
      atomicWriteJson(quotePathFor(loaded.plan), quoteReport);
      planCas.write();
      throw new Error(
        `镜头${shot.id}已生成，但RunningHub未返回可核对的非负实际费用；` +
          '已停止后续付费提交，必须恢复同一taskId完成账单对账',
      );
    }
    const chargedCostCny = Number(result.attempt.actualCostCny);
    accumulatedActualCostCny += chargedCostCny;
    const persistCostStop = ({type, message, projectedTotalCny = null}) => {
      loaded.plan.productionStatus = type === 'actual'
        ? 'cost-limit-breached'
        : 'cost-reauthorization-required';
      loaded.plan.costLimitStop = {
        status: 'unresolved',
        type,
        shotId: shot.id,
        detectedAt: timestamp(now),
        chargedCostCny,
        accumulatedActualCostCny: Number(accumulatedActualCostCny.toFixed(4)),
        projectedTotalCny,
        maxPerShotCny: loaded.plan.costAuthorization.maxPerShotCny,
        maxAmountCny: loaded.plan.costAuthorization.maxAmountCny,
        message,
      };
      planCas.write();
      throw new Error(message);
    };
    if (chargedCostCny > loaded.plan.costAuthorization.maxPerShotCny) {
      persistCostStop({
        type: 'actual',
        message:
          `镜头${shot.id}实际费用${chargedCostCny}元超过单镜授权上限` +
          `${loaded.plan.costAuthorization.maxPerShotCny}元；已记录本次实际扣费并停止，需人工核对并重新授权`,
      });
    }
    if (accumulatedActualCostCny > loaded.plan.costAuthorization.maxAmountCny) {
      persistCostStop({
        type: 'actual',
        message:
          `已完成镜头的累计实际费用${Number(accumulatedActualCostCny.toFixed(4))}元超过授权总额` +
          `${loaded.plan.costAuthorization.maxAmountCny}元；已记录本次实际扣费并停止，需人工核对并重新授权`,
      });
    }
    const remainingShots = outstanding.slice(index + 1);
    if (remainingShots.length === 0) {
      quoteReport.paidTaskSubmitted = true;
      atomicWriteJson(quotePathFor(loaded.plan), quoteReport);
      continue;
    }
    activeQuotes = await quoteShots({
      plan: loaded.plan,
      style: loaded.style,
      shots: remainingShots,
      apiKey: key,
      fetchImpl,
    });
    planCas.assertCurrent();
    const refreshedAt = timestamp(now);
    quoteReport.quoteCycles.push({
      quotedAt: refreshedAt,
      reason: `after-${shot.id}-before-${remainingShots[0].id}-submit`,
      shotIds: remainingShots.map((item) => item.id),
      quotes: activeQuotes,
    });
    quoteReport.quotedAt = refreshedAt;
    quoteReport.quotes = activeQuotes;
    quoteReport.paidTaskSubmitted = true;
    atomicWriteJson(quotePathFor(loaded.plan), quoteReport);
    const remainingEstimatedCostCny = activeQuotes.reduce(
      (total, quote) => total + quote.estimatedCostCny,
      0,
    );
    quoteReport.latestProjectedTotalCny = Number(
      (accumulatedActualCostCny + remainingEstimatedCostCny).toFixed(4),
    );
    atomicWriteJson(quotePathFor(loaded.plan), quoteReport);
    const overLimitQuote = activeQuotes.find(
      (quote) =>
        quote.estimatedCostCny >
        loaded.plan.costAuthorization.maxPerShotCny,
    );
    if (overLimitQuote) {
      persistCostStop({
        type: 'forecast',
        projectedTotalCny: Number(
          (accumulatedActualCostCny + remainingEstimatedCostCny).toFixed(4),
        ),
        message:
          `镜头${overLimitQuote.shotId}提交前最新预估${overLimitQuote.estimatedCostCny}元超过单镜授权上限` +
          `${loaded.plan.costAuthorization.maxPerShotCny}元；已停止后续新提交，需重新取得金额授权`,
      });
    }
    if (
      accumulatedActualCostCny + remainingEstimatedCostCny >
        loaded.plan.costAuthorization.maxAmountCny
    ) {
      const projectedTotalCny = Number(
          (accumulatedActualCostCny + remainingEstimatedCostCny).toFixed(4),
      );
      persistCostStop({
        type: 'forecast',
        projectedTotalCny,
        message:
          `已完成镜头的实际费用加剩余预估为${projectedTotalCny}元，超过授权总额` +
          `${loaded.plan.costAuthorization.maxAmountCny}元；已停止后续新提交，需重新取得金额授权`,
      });
    }
  }
  const finalLedger = loadGeneratedVideoLedger(ledgerPath);
  if (allDownloaded(loaded.plan, finalLedger)) {
    loaded.plan.productionStatus = 'downloaded';
    planCas.write();
  }
  return {
    planId: loaded.plan.planId,
    submittedCount: results.length,
    skippedCompletedCount: loaded.plan.shots.length - results.length,
    authorizedBatchTotalCny,
    productionStatus: loaded.plan.productionStatus,
    approvalReceipt,
    results,
  };
};

export const runPlan = async (options) => {
  const prelockLoaded = loadPlanAndStyle(options.planPath);
  assertRunningHubActionAllowed({
    loaded: prelockLoaded,
    planPath: options.planPath,
    operation: 'run',
  });
  const releaseLock = acquirePlanExecutionLock(options.planPath);
  try {
    return await runPlanLocked(options);
  } finally {
    releaseLock();
  }
};

const resumePlanShotLocked = async ({
  planPath,
  shotId,
  apiKey,
  fetchImpl = fetch,
  pollIntervalMs = 10_000,
  maximumPollCount = 180,
  now,
}) => {
  const loaded = loadPlanAndStyle(planPath);
  const retiredStyleHits = retiredStyleHitsFor({loaded, planPath});
  const retiredStyleRecoveryOnly = retiredStyleHits.length > 0;
  const planCas = createPlanCas({loaded, requestedPlanPath: planPath});
  assertValid(loaded.plan, loaded.style, 'plan');
  const key = requireApiKey(apiKey);
  const shot = loaded.plan.shots.find((item) => item.id === shotId);
  if (!shot) throw new Error(`计划中找不到镜头${shotId}`);
  const ledgerPath = toAbsolute(loaded.plan.outputs.ledgerPath);
  const existingLedger = loadGeneratedVideoLedger(ledgerPath);
  assertLedgerDefinition(loaded.plan, existingLedger);
  const attempt = assertAttemptBinding({
    plan: loaded.plan,
    shot,
    attempt: existingLedger?.attempts?.[shot.id],
  });
  const result = await resumeH3Shot({
    planPath: loaded.planPath,
    planId: loaded.plan.planId,
    videoId: loaded.plan.videoId,
    planSha256: generationDefinitionSha256(loaded.plan),
    shot: runtimeShot(shot),
    prompt: shot.promptCore.compiledPrompt,
    outputPath: toAbsolute(shot.output.videoPath),
    ledgerPath,
    apiKey: key,
    fetchImpl,
    pollIntervalMs,
    maximumPollCount,
  });
  syncApprovalReceiptEvidence({plan: loaded.plan});
  syncShotOutput({plan: loaded.plan, shotId, result});
  const ledger = loadGeneratedVideoLedger(ledgerPath);
  if (retiredStyleRecoveryOnly) {
    loaded.plan.retiredStyleRecovery = {
      policyId: 'retired-generated-style/v1',
      status: 'recovery-only-not-production-usable',
      shotId,
      taskId: attempt.taskId,
      recoveredAt: timestamp(now),
      fingerprints: [...new Set(retiredStyleHits.map((hit) => hit.fingerprint))],
    };
  }
  if (result.attempt.actualCostStatus !== 'reported') {
    loaded.plan.productionStatus = 'billing-reconciliation-required';
    loaded.plan.billingReconciliation = {
      status: 'unresolved',
      shotId,
      taskId: attempt.taskId,
      detectedAt: timestamp(now),
      actualCostStatus: result.attempt.actualCostStatus ?? 'missing',
      message: '同一taskId恢复后仍没有可核对的非负实际费用。',
    };
  } else {
    loaded.plan.billingReconciliation = null;
    loaded.plan.productionStatus = retiredStyleRecoveryOnly
      ? 'retired-style-recovery-only'
      : allDownloaded(loaded.plan, ledger)
        ? 'downloaded'
        : 'submitted';
  }
  planCas.write();
  return retiredStyleRecoveryOnly
    ? {
        ...result,
        recoveryOnly: true,
        productionUsability: 'blocked-retired-style',
      }
    : result;
};

export const resumePlanShot = async (options) => {
  const prelockLoaded = loadPlanAndStyle(options.planPath);
  assertRunningHubActionAllowed({
    loaded: prelockLoaded,
    planPath: options.planPath,
    operation: 'resume',
  });
  const releaseLock = acquirePlanExecutionLock(options.planPath);
  try {
    return await resumePlanShotLocked(options);
  } finally {
    releaseLock();
  }
};

export const readPlanStatus = ({planPath}) => {
  const loaded = loadPlanAndStyle(planPath);
  const retiredStyleHits = retiredStyleHitsFor({loaded, planPath});
  assertValid(loaded.plan, loaded.style, 'plan');
  const ledger = loadGeneratedVideoLedger(toAbsolute(loaded.plan.outputs.ledgerPath));
  assertLedgerDefinition(loaded.plan, ledger);
  for (const shot of loaded.plan.shots) {
    const attempt = ledger?.attempts?.[shot.id];
    if (attempt) assertAttemptBinding({plan: loaded.plan, shot, attempt});
  }
  return {
    planId: loaded.plan.planId,
    productionStatus: loaded.plan.productionStatus,
    productionUsability:
      retiredStyleHits.length > 0
        ? 'blocked-retired-style'
        : 'eligible-subject-to-other-gates',
    retiredStyleFingerprints: [
      ...new Set(retiredStyleHits.map((hit) => hit.fingerprint)),
    ],
    ledger,
  };
};

const optionValue = (args, name) => {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : null;
};

const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0];
  const planPath = optionValue(args, 'plan');
  const config = runtimeConfig();
  if (!command || !planPath) {
    throw new Error(
      '用法：node tools/run-runninghub-generated-video.mjs ' +
        '<compile|preflight|quote|run|resume|status> --plan <plan.json> ' +
        '[--shot G01] [--confirm-paid]',
    );
  }
  let result;
  if (command === 'compile') {
    const compiled = compilePlanFile({planPath});
    result = {
      changed: compiled.changed,
      planId: compiled.plan.planId,
      shotCount: compiled.plan.shots.length,
      productionStatus: compiled.plan.productionStatus,
      costAuthorizationStatus: compiled.plan.costAuthorization.status,
    };
  }
  else if (command === 'preflight') result = preflightPlan({planPath});
  else if (command === 'quote') {
    result = await quotePlan({
      planPath,
      apiKey: config.RUNNINGHUB_API_KEY,
    });
  } else if (command === 'run') {
    result = await runPlan({
      planPath,
      apiKey: config.RUNNINGHUB_API_KEY,
      confirmPaid: args.includes('--confirm-paid'),
    });
  } else if (command === 'resume') {
    result = await resumePlanShot({
      planPath,
      shotId: optionValue(args, 'shot'),
      apiKey: config.RUNNINGHUB_API_KEY,
    });
  } else if (command === 'status') result = readPlanStatus({planPath});
  else throw new Error(`未知命令：${command}`);
  console.log(JSON.stringify(result, null, 2));
};

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
