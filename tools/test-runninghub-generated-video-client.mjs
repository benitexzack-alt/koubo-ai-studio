import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  compileShotPrompt,
  generatedVideoMediaRootFor,
  generatedVideoPlanPathFor as generatedVideoPlanRelativePathFor,
  generatedVideoRenderSourceFor,
  generationDefinitionSha256,
} from './generated-video-plan-core.mjs';

import {
  RUNNINGHUB_H3_PROVIDER,
  approvalReceiptPathFor,
  buildH3Request,
  generatedVideoLedgerPathFor,
  generatedVideoOutputPathFor,
  loadGeneratedVideoLedger,
  quoteH3Shot,
  resumeH3Shot,
  runH3Shot,
} from './runninghub-generated-video-client.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toProjectPath = (filePath) =>
  path.relative(projectRoot, filePath).split(path.sep).join('/');
const readProjectJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.resolve(projectRoot, relativePath), 'utf8'));
const planTemplate = readProjectJson('templates/08-generated-video-plan-template.json');
const paperStyle = readProjectJson(
  'workflow/style-library/koubo-paper-construct-v1.json',
);
const clone = (value) => structuredClone(value);

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

const binaryResponse = (buffer, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  arrayBuffer: async () =>
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
});

const makeTemporaryDirectory = (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'koubo-runninghub-client-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return directory;
};

const makeGenerationWorkspace = (t, planId, videoId = `VIDEO-${planId}`) => {
  const ledgerPath = generatedVideoLedgerPathFor(planId);
  const planPath = path.resolve(
    projectRoot,
    generatedVideoPlanRelativePathFor(videoId),
  );
  const ledgerRoot = path.dirname(ledgerPath);
  const planRoot = path.dirname(planPath);
  const mediaRoot = path.dirname(
    path.dirname(
      generatedVideoOutputPathFor({videoId, planId, shotId: 'G01'}),
    ),
  );
  fs.rmSync(ledgerRoot, {recursive: true, force: true});
  fs.rmSync(planRoot, {recursive: true, force: true});
  fs.rmSync(mediaRoot, {recursive: true, force: true});
  t.after(() => {
    fs.rmSync(ledgerRoot, {recursive: true, force: true});
    fs.rmSync(planRoot, {recursive: true, force: true});
    fs.rmSync(mediaRoot, {recursive: true, force: true});
  });
  return {
    planId,
    videoId,
    planPath,
    ledgerPath,
    outputPath: (shotId) => generatedVideoOutputPathFor({videoId, planId, shotId}),
  };
};

const authorization = (
  t,
  planId,
  definitionSha256,
  maxPerShotCny = 3.1,
  {approvalId = `approval-test-${planId}`, maxAmountCny = maxPerShotCny} = {},
) => {
  const receiptPath = approvalReceiptPathFor(approvalId);
  const approvedAt = new Date(Date.now() - 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
  fs.rmSync(receiptPath, {force: true});
  t.after(() => fs.rmSync(receiptPath, {force: true}));
  return {
    approvalId,
    approvedBy: '测试用户',
    approvedAt,
    expiresAt,
    status: 'approved',
    currency: 'CNY',
    scope: {type: 'plan-only', planId, definitionSha256},
    maxPerShotCny,
    maxAmountCny,
    maxAttemptsPerShot: 1,
    automaticRetry: false,
  };
};

const createPaidPlan = (
  t,
  workspace,
  {
    shots,
    maxPerShotCny = 3.1,
    maxAmountCny = maxPerShotCny,
    approvalId = `approval-test-${workspace.planId}`,
    approvedAt,
    expiresAt,
  },
) => {
  const plan = clone(planTemplate);
  plan.planId = workspace.planId;
  plan.videoId = workspace.videoId;
  plan.videoTitle = '运行客户端离线测试计划';
  plan.productionStatus = 'ready-for-submit';
  plan.planPath = generatedVideoPlanRelativePathFor(workspace.videoId);
  plan.visualPlan = `edit/${workspace.videoId}/visual-plan.json`;
  const mediaRoot = generatedVideoMediaRootFor(
    workspace.videoId,
    workspace.planId,
  );
  const workflowRoot = `edit/generated-video/${workspace.planId}`;
  plan.outputs = {
    rootDir: mediaRoot,
    ledgerPath: `${workflowRoot}/generation-ledger.json`,
    quotePath: `${workflowRoot}/latest-quote.json`,
    approvalReceiptPath: null,
    approvalReceiptSha256: null,
    contactSheetPath: `${workflowRoot}/contact-sheet.jpg`,
    qaReportPath: `${workflowRoot}/qa-report.json`,
  };
  plan.shots = shots.map(({id, durationSeconds}, index) => {
    const shot = clone(planTemplate.shots[0]);
    const actionEndSeconds = Number((durationSeconds - 0.8).toFixed(3));
    shot.id = id;
    shot.requestId = `request-${id}`;
    shot.layerId = `provider-layer-${id}`;
    shot.spokenAnchor = {
      text: `${id}：散乱信息被推入统一结构。`,
      startSeconds: index * durationSeconds,
      endSeconds: (index + 1) * durationSeconds,
    };
    shot.selectionReason = '抽象机制需要用可见物理因果动作解释，只作概念演绎。';
    shot.causalChain = {
      initialState: '一张暖纸色信息卡停在海军蓝滑轨左侧。',
      physicalCause: '海军蓝纸板推杆贴住信息卡左边缘施力。',
      resultState: '同一张信息卡进入砖红归档槽并稳定停住。',
    };
    shot.singleAction = {
      actions: [{
        verb: '推动',
        actor: '海军蓝纸板推杆',
        object: '暖纸色信息卡',
        visibleCause: '推杆全程贴住信息卡左边缘',
        visibleEffect: '信息卡沿直线进入归档槽',
      }],
    };
    shot.mechanism = 'slide';
    shot.composition = {
      view: 'front-miniature',
      mainSubject: '一张暖纸色信息卡',
      mainSubjectCount: 1,
      negativeSpace: '上方与两侧保留纸面负空间',
      subtitleSafeBottomRatio: 0.18,
      labels: 'blank-remotion-later',
    };
    shot.camera = {movement: 'fixed', framing: '正面中近景微缩舞台'};
    shot.continuity = {
      objectIdentityLock: '信息卡数量、暖纸色和身份不变',
      shapeLock: '信息卡始终保持同一矩形纸板形状',
      contactContinuity: '推杆从开始到入槽前始终贴住卡片',
    };
    shot.timing = {
      durationSeconds,
      establish: {startSeconds: 0, endSeconds: 0.8},
      action: {startSeconds: 0.8, endSeconds: actionEndSeconds},
      finalHold: {startSeconds: actionEndSeconds, endSeconds: durationSeconds},
    };
    shot.promptCore = {
      concept: '信息结构化',
      visualMetaphor: '卡片沿滑轨进入归档槽',
      openingFrame: '信息卡停在滑轨左侧，推杆贴住左边缘',
      actionInstruction: '推杆只推动这一张卡沿直线进入归档槽',
      closingFrame: '同一张卡完整入槽并稳定停留',
      compiledPrompt: '',
    };
    shot.output.videoPath = `${mediaRoot}/${id}.mp4`;
    return shot;
  });
  for (const shot of plan.shots) {
    shot.promptCore.compiledPrompt = compileShotPrompt(plan, paperStyle, shot);
  }
  const visualPlan = {
    schemaVersion: 4,
    experiment: {id: 'v8-semantic-continuity-sfx'},
    videoId: plan.videoId,
    styleReferenceIds: ['koubo-paper-construct-v1'],
    layers: plan.shots.map((shot) => ({
      id: shot.layerId,
      start: shot.spokenAnchor.startSeconds,
      end: shot.spokenAnchor.endSeconds,
      spokenLine: shot.spokenAnchor.text,
      purpose: 'concept-illustration',
      asset: {sourceType: 'provider-generated-video', source: shot.output.videoPath},
      assetDecision: {
        class: 'generated-video',
        producer: 'codex-provider',
        requestId: shot.requestId,
        evidenceUse: 'illustration-only',
        styleReferenceId: 'koubo-paper-construct-v1',
        fallback: 'speaker-plus-information',
      },
      params: {
        disclosure: 'AI生成·概念演绎',
        badge: '非真实业务证据',
        src: generatedVideoRenderSourceFor(plan.videoId, plan.planId, shot.id),
        mediaClips: [],
      },
    })),
  };
  fs.mkdirSync(path.dirname(path.resolve(projectRoot, plan.visualPlan)), {
    recursive: true,
  });
  fs.writeFileSync(
    path.resolve(projectRoot, plan.visualPlan),
    `${JSON.stringify(visualPlan, null, 2)}\n`,
    {mode: 0o600},
  );
  const planSha256 = generationDefinitionSha256(plan);
  const costAuthorization = authorization(
    t,
    workspace.planId,
    planSha256,
    maxPerShotCny,
    {approvalId, maxAmountCny},
  );
  if (approvedAt) costAuthorization.approvedAt = approvedAt;
  if (expiresAt) costAuthorization.expiresAt = expiresAt;
  plan.costAuthorization = structuredClone(costAuthorization);
  fs.mkdirSync(path.dirname(workspace.planPath), {recursive: true});
  fs.writeFileSync(workspace.planPath, `${JSON.stringify(plan, null, 2)}\n`, {
    mode: 0o600,
  });
  return {
    plan,
    planPath: workspace.planPath,
    planSha256,
    authorization: costAuthorization,
    runtimeShot: (shotId) => {
      const planned = plan.shots.find((shot) => shot.id === shotId);
      return {id: planned.id, durationSeconds: planned.timing.durationSeconds};
    },
    promptFor: (shotId) =>
      plan.shots.find((shot) => shot.id === shotId).promptCore.compiledPrompt,
  };
};

test('H3 请求固定使用 2K、16:9 与无水印参数', () => {
  const payload = buildH3Request({
    prompt: '纸板齿轮推动卡片前进',
    durationSeconds: 8,
  });

  assert.deepEqual(payload, {
    prompt: '纸板齿轮推动卡片前进',
    resolution: '2K',
    duration: '8',
    ratio: '16:9',
    aigc_watermark: false,
  });
  assert.equal(RUNNINGHUB_H3_PROVIDER.model, 'MiniMax-H3');
});

test('quote 只访问价格预估，不写账本也不提交付费任务', async (t) => {
  const directory = makeTemporaryDirectory(t);
  const ledgerPath = path.join(directory, 'ledger.json');
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    return jsonResponse({
      estimatedPrice: 3.1,
      currency: 'CNY',
      isFreeThisCall: false,
    });
  };

  const quote = await quoteH3Shot({
    apiKey: 'test-only-key',
    shot: {id: 'G01', durationSeconds: 8},
    prompt: '纸片从卡槽中被滚轮推出',
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    `${RUNNINGHUB_H3_PROVIDER.baseUrl}${RUNNINGHUB_H3_PROVIDER.pricePreviewRoute}`,
  );
  assert.equal(
    calls.some(({url}) => url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)),
    false,
  );
  assert.equal(fs.existsSync(ledgerPath), false);
  assert.equal(quote.shotId, 'G01');
  assert.equal(quote.estimatedCostCny, 3.1);
  assert.equal(quote.paidTaskSubmitted, false);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    prompt: '纸片从卡槽中被滚轮推出',
    resolution: '2K',
    duration: '8',
    ratio: '16:9',
    aigc_watermark: false,
  });
});

test('预估费用超过单镜上限时不提交、不写账本', async (t) => {
  const workspace = makeGenerationWorkspace(t, 'plan-over-budget');
  const {ledgerPath, videoId} = workspace;
  const outputPath = workspace.outputPath('G01');
  let shot = {id: 'G01', durationSeconds: 8};
  let prompt = '纸制机械臂将卡片推入文件盒';
  const binding = createPaidPlan(t, workspace, {
    shots: [{...shot, prompt}],
    maxPerShotCny: 3,
  });
  shot = binding.runtimeShot('G01');
  prompt = binding.promptFor('G01');
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    return jsonResponse({
      estimatedPrice: 3.1,
      currency: 'CNY',
      isFreeThisCall: false,
    });
  };

  await assert.rejects(
    runH3Shot({
      videoId,
      planId: 'plan-over-budget',
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot,
      prompt,
      outputPath,
      ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
    }),
    /超过单镜上限3元，未提交任务/,
  );

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    `${RUNNINGHUB_H3_PROVIDER.baseUrl}${RUNNINGHUB_H3_PROVIDER.pricePreviewRoute}`,
  );
  assert.equal(fs.existsSync(ledgerPath), false);
  assert.equal(fs.existsSync(outputPath), false);
});

test('低层付费原语拒绝过期或超过24小时的金额授权', async (t) => {
  const directory = makeTemporaryDirectory(t);
  const planId = 'plan-expired-authorization';
  const planSha256 = 'e'.repeat(64);
  const expired = authorization(t, planId, planSha256, 3);
  expired.approvedAt = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  expired.expiresAt = new Date(Date.now() - 60 * 60_000).toISOString();
  let callCount = 0;
  await assert.rejects(
    runH3Shot({
      planId,
      planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: expired,
      shot: {id: 'G01', durationSeconds: 5},
      prompt: '过期授权不得进入滑槽',
      outputPath: path.join(directory, 'G01.mp4'),
      ledgerPath: path.join(directory, 'ledger.json'),
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async () => {
        callCount += 1;
        throw new Error('过期授权不应联网');
      },
    }),
    /金额授权已经过期/,
  );
  assert.equal(callCount, 0);
  assert.equal(fs.existsSync(approvalReceiptPathFor(expired.approvalId)), false);

  const overlyLong = {
    ...expired,
    approvalId: `${expired.approvalId}-long`,
    approvedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 25 * 60 * 60_000).toISOString(),
  };
  t.after(() => fs.rmSync(approvalReceiptPathFor(overlyLong.approvalId), {force: true}));
  await assert.rejects(
    runH3Shot({
      planId,
      planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: overlyLong,
      shot: {id: 'G01', durationSeconds: 5},
      prompt: '超长授权窗口不得进入滑槽',
      outputPath: path.join(directory, 'G01-long.mp4'),
      ledgerPath: path.join(directory, 'ledger-long.json'),
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async () => {
        callCount += 1;
        throw new Error('超长授权不应联网');
      },
    }),
    /有效期必须晚于approvedAt且最长不超过24小时/,
  );
  assert.equal(callCount, 0);
});

test('合法 run 只提交一次，下载后记录文件哈希与脱敏结果地址', async (t) => {
  const workspace = makeGenerationWorkspace(t, 'plan-valid-run');
  const {ledgerPath, videoId} = workspace;
  const outputPath = workspace.outputPath('G01');
  const videoBytes = Buffer.from('offline-mocked-runninghub-video');
  const remoteUrl =
    'https://cdn.runninghub.example/generated/G01.mp4?token=secret-token&expires=999';
  const calls = [];
  let shot = {id: 'G01', durationSeconds: 8};
  let prompt = '纸制齿轮推动蓝色卡片到红色终点';
  const binding = createPaidPlan(t, workspace, {
    shots: [{...shot, prompt}],
    maxPerShotCny: 3.1,
  });
  shot = binding.runtimeShot('G01');
  prompt = binding.promptFor('G01');
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({
        estimatedPrice: 3.1,
        currency: 'CNY',
        isFreeThisCall: false,
      });
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      return jsonResponse({taskId: 'task-fixed-001', status: 'RUNNING'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.queryRoute)) {
      assert.deepEqual(JSON.parse(options.body), {taskId: 'task-fixed-001'});
      return jsonResponse({
        taskId: 'task-fixed-001',
        status: 'SUCCESS',
        results: [{url: remoteUrl, outputType: 'mp4'}],
        usage: {thirdPartyConsumeMoney: '2.8', consumeMoney: '0.2'},
      });
    }
    if (url === remoteUrl) return binaryResponse(videoBytes);
    throw new Error(`未预期的模拟请求：${url}`);
  };

  const costAuthorization = binding.authorization;
  const result = await runH3Shot({
    videoId,
    planId: 'plan-valid-run',
    planPath: binding.planPath,
    planSha256: binding.planSha256,
    style: {id: 'koubo-paper-construct-v1', version: 1},
    authorization: costAuthorization,
    shot,
    prompt,
    outputPath,
    ledgerPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl,
    pollIntervalMs: 0,
    maximumPollCount: 2,
  });

  const submitCalls = calls.filter(({url}) =>
    url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute),
  );
  assert.equal(submitCalls.length, 1);
  assert.equal(result.status, 'downloaded');
  assert.equal(result.taskId, 'task-fixed-001');
  assert.deepEqual(fs.readFileSync(outputPath), videoBytes);

  const expectedSha256 = crypto.createHash('sha256').update(videoBytes).digest('hex');
  const ledger = loadGeneratedVideoLedger(ledgerPath);
  const attempt = ledger.attempts.G01;
  assert.equal(attempt.attemptNumber, 1);
  assert.equal(attempt.taskId, 'task-fixed-001');
  assert.equal(attempt.status, 'downloaded');
  assert.equal(attempt.outputBytes, videoBytes.length);
  assert.equal(attempt.outputSha256, expectedSha256);
  assert.equal(
    attempt.remoteResultUrl,
    'https://cdn.runninghub.example/generated/G01.mp4',
  );
  assert.equal(attempt.actualCostCny, 3);
  assert.equal(attempt.authorization.approvalId, costAuthorization.approvalId);
  assert.deepEqual(attempt.authorization.scope, {
    type: 'plan-only',
    planId: 'plan-valid-run',
    definitionSha256: binding.planSha256,
  });
  const receipt = JSON.parse(
    fs.readFileSync(approvalReceiptPathFor(costAuthorization.approvalId), 'utf8'),
  );
  assert.equal(receipt.schemaVersion, 'generated-video-approval-consumption/v1');
  assert.equal(receipt.expiresAt, costAuthorization.expiresAt);
  assert.equal(receipt.ledgerPath, path.resolve(ledgerPath));

  const ledgerText = fs.readFileSync(ledgerPath, 'utf8');
  assert.equal(ledgerText.includes('secret-token'), false);
  assert.equal(ledgerText.includes('test-only-key'), false);
});

test('同一计划镜头已有付费记录时阻止重复提交', async (t) => {
  const workspace = makeGenerationWorkspace(t, 'plan-duplicate-guard');
  const {ledgerPath, videoId} = workspace;
  const outputPath = workspace.outputPath('G01');
  let shot = {id: 'G01', durationSeconds: 6};
  let prompt = '滚轮将卡片从输入区推到完成区';
  const binding = createPaidPlan(t, workspace, {
    shots: [{...shot, prompt}],
    maxPerShotCny: 3.1,
  });
  shot = binding.runtimeShot('G01');
  prompt = binding.promptFor('G01');
  const remoteUrl = 'https://cdn.runninghub.example/generated/G02.mp4?token=private';
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2.5, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      return jsonResponse({
        taskId: 'task-fixed-duplicate',
        status: 'SUCCESS',
        results: [{url: remoteUrl, outputType: 'mp4'}],
      });
    }
    if (url === remoteUrl) return binaryResponse(Buffer.from('first-result'));
    throw new Error(`未预期的模拟请求：${url}`);
  };
  const argumentsForRun = {
    videoId,
    planId: 'plan-duplicate-guard',
    planPath: binding.planPath,
    planSha256: binding.planSha256,
    style: {id: 'koubo-paper-construct-v1'},
    authorization: binding.authorization,
    shot,
    prompt,
    outputPath,
    ledgerPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  };

  await runH3Shot(argumentsForRun);
  assert.equal(
    calls.filter(({url}) => url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)).length,
    1,
  );
  fs.rmSync(outputPath);
  const callCountBeforeDuplicate = calls.length;

  await assert.rejects(
    runH3Shot(argumentsForRun),
    /已经存在一次付费任务记录，禁止二次提交/,
  );
  assert.equal(calls.length, callCountBeforeDuplicate);
  assert.equal(loadGeneratedVideoLedger(ledgerPath).attempts.G01.attemptNumber, 1);
});

test('resume 可对账崩溃窗口遗留文件且只查询同一 taskId', async (t) => {
  const planId = 'plan-resume-existing-task';
  const workspace = makeGenerationWorkspace(t, planId);
  const {ledgerPath, videoId} = workspace;
  const outputPath = workspace.outputPath('G01');
  let shot = {id: 'G01', durationSeconds: 5};
  let prompt = '纸制机械臂将卡片固定到归档位';
  const binding = createPaidPlan(t, workspace, {
    shots: [{...shot, prompt}],
    maxPerShotCny: 3.1,
  });
  shot = binding.runtimeShot('G01');
  prompt = binding.promptFor('G01');
  const taskId = 'task-resume-007';
  const initialCalls = [];
  const initialFetch = async (url, options) => {
    initialCalls.push({url, options});
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      return jsonResponse({taskId, status: 'RUNNING'});
    }
    throw new Error(`初始提交不应请求：${url}`);
  };

  await assert.rejects(
    runH3Shot({
      videoId,
      planId,
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot,
      prompt,
      outputPath,
      ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: initialFetch,
      pollIntervalMs: 0,
      maximumPollCount: 0,
    }),
    /在轮询上限内未返回终态/,
  );
  assert.equal(
    initialCalls.filter(({url}) => url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute))
      .length,
    1,
  );
  assert.equal(loadGeneratedVideoLedger(ledgerPath).attempts.G01.taskId, taskId);
  assert.equal(
    loadGeneratedVideoLedger(ledgerPath).attempts.G01.status,
    'task-status-unknown',
  );

  const remoteUrl =
    'https://cdn.runninghub.example/generated/G03.mp4?temporary_signature=private';
  const resumedBytes = Buffer.from('resumed-offline-video');
  const resumeCalls = [];
  const resumeFetch = async (url, options) => {
    resumeCalls.push({url, options});
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.queryRoute)) {
      assert.deepEqual(JSON.parse(options.body), {taskId});
      return jsonResponse({
        taskId,
        status: 'SUCCESS',
        results: [{url: remoteUrl, outputType: 'mp4'}],
        usage: {consumeMoney: 2},
      });
    }
    if (url === remoteUrl) return binaryResponse(resumedBytes);
    throw new Error(`恢复阶段不应请求：${url}`);
  };

  fs.writeFileSync(outputPath, resumedBytes);

  const resumed = await resumeH3Shot({
    videoId,
    planId,
    planPath: binding.planPath,
    planSha256: binding.planSha256,
    shot,
    prompt,
    outputPath,
    ledgerPath,
    apiKey: 'test-only-key',
    fetchImpl: resumeFetch,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  });

  assert.equal(resumed.taskId, taskId);
  assert.deepEqual(fs.readFileSync(outputPath), resumedBytes);
  assert.equal(
    resumeCalls.filter(({url}) => url.endsWith(RUNNINGHUB_H3_PROVIDER.queryRoute))
      .length,
    1,
  );
  assert.equal(
    resumeCalls.some(({url}) => url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)),
    false,
  );
  assert.equal(
    resumeCalls.some(({url}) => url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)),
    false,
  );
  assert.equal(loadGeneratedVideoLedger(ledgerPath).attempts.G01.taskId, taskId);
  assert.equal(loadGeneratedVideoLedger(ledgerPath).attempts.G01.status, 'downloaded');
  assert.equal(
    loadGeneratedVideoLedger(ledgerPath).attempts.G01.recoveredExistingFile,
    true,
  );
  assert.equal(
    loadGeneratedVideoLedger(ledgerPath).attempts.G01.outputSha256,
    crypto.createHash('sha256').update(resumedBytes).digest('hex'),
  );
});

test('runH3Shot 内部消费approvalId，换账本或计划时第二次模型提交为0', async (t) => {
  const directory = makeTemporaryDirectory(t);
  const sharedApprovalId = `approval-direct-guard-${crypto.randomUUID()}`;
  const firstPlanId = 'plan-direct-receipt-a';
  const firstWorkspace = makeGenerationWorkspace(t, firstPlanId);
  let firstShot = {id: 'G01', durationSeconds: 5};
  let firstPrompt = '纸片转盘将任务卡推向完成区';
  const firstBinding = createPaidPlan(t, firstWorkspace, {
    shots: [{...firstShot, prompt: firstPrompt}],
    maxPerShotCny: 4,
    maxAmountCny: 8,
    approvalId: sharedApprovalId,
  });
  firstShot = firstBinding.runtimeShot('G01');
  firstPrompt = firstBinding.promptFor('G01');
  const firstAuthorization = firstBinding.authorization;
  const secondPlanId = 'plan-direct-receipt-b';
  const secondWorkspace = makeGenerationWorkspace(t, secondPlanId);
  let secondShot = {id: 'G01', durationSeconds: 5};
  let secondPrompt = '纸板门在另一计划中打开';
  const secondBinding = createPaidPlan(t, secondWorkspace, {
    shots: [{...secondShot, prompt: secondPrompt}],
    maxPerShotCny: 4,
    maxAmountCny: 8,
    approvalId: sharedApprovalId,
    approvedAt: firstAuthorization.approvedAt,
    expiresAt: firstAuthorization.expiresAt,
  });
  secondShot = secondBinding.runtimeShot('G01');
  secondPrompt = secondBinding.promptFor('G01');
  const calls = [];
  const remoteUrl = 'https://cdn.runninghub.example/direct-receipt.mp4';
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      return jsonResponse({
        taskId: 'task-direct-receipt',
        status: 'SUCCESS',
        results: [{url: remoteUrl, outputType: 'mp4'}],
        usage: {consumeMoney: 1.8},
      });
    }
    if (url === remoteUrl) return binaryResponse(Buffer.from('receipt-result'));
    throw new Error(`未预期的模拟请求：${url}`);
  };

  await runH3Shot({
    videoId: firstWorkspace.videoId,
    planId: firstPlanId,
    planPath: firstBinding.planPath,
    planSha256: firstBinding.planSha256,
    style: {id: 'koubo-paper-construct-v1'},
    authorization: firstAuthorization,
    shot: firstShot,
    prompt: firstPrompt,
    outputPath: firstWorkspace.outputPath('G01'),
    ledgerPath: firstWorkspace.ledgerPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  });
  assert.equal(
    calls.filter((url) => url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)).length,
    1,
  );

  await assert.rejects(
    runH3Shot({
      videoId: firstWorkspace.videoId,
      planId: firstPlanId,
      planPath: firstBinding.planPath,
      planSha256: firstBinding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: firstAuthorization,
      shot: {id: 'G02', durationSeconds: 5},
      prompt: '另一张纸卡进入新滑槽',
      outputPath: firstWorkspace.outputPath('G02'),
      ledgerPath: path.join(directory, 'second-ledger.json'),
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 1,
    }),
    /任务账本必须位于口播项目根目录内/,
  );

  await assert.rejects(
    runH3Shot({
      videoId: secondWorkspace.videoId,
      planId: secondPlanId,
      planPath: secondBinding.planPath,
      planSha256: secondBinding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: secondBinding.authorization,
      shot: secondShot,
      prompt: secondPrompt,
      outputPath: secondWorkspace.outputPath('G01'),
      ledgerPath: secondWorkspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 1,
    }),
    /其他计划、账本或金额定义消费/,
  );
  assert.equal(
    calls.filter((url) => url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)).length,
    1,
  );
});

test('缺失实际费用时保留下载文件并只允许resume同一taskId对账', async (t) => {
  const directory = makeTemporaryDirectory(t);
  const planId = 'plan-billing-missing';
  const workspace = makeGenerationWorkspace(t, planId);
  const {ledgerPath, videoId} = workspace;
  let prompt = '纸制输送带把空白卡片送到结果盒';
  let shot = {id: 'G01', durationSeconds: 6};
  let secondPrompt = '另一张纸卡等待对账完成';
  const outputPath = workspace.outputPath('G01');
  const remoteUrl = 'https://cdn.runninghub.example/billing-missing.mp4';
  const bytes = Buffer.from('billing-missing-video-stays');
  const binding = createPaidPlan(t, workspace, {
    shots: [
      {...shot, prompt},
      {id: 'G02', durationSeconds: 5, prompt: secondPrompt},
    ],
    maxPerShotCny: 4,
    maxAmountCny: 8,
  });
  shot = binding.runtimeShot('G01');
  prompt = binding.promptFor('G01');
  secondPrompt = binding.promptFor('G02');
  const {planSha256} = binding;
  const costAuthorization = binding.authorization;
  let submitCount = 0;
  const firstFetch = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2.2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      submitCount += 1;
      return jsonResponse({
        taskId: 'task-billing-missing',
        status: 'SUCCESS',
        results: [{url: remoteUrl, outputType: 'mp4'}],
      });
    }
    if (url === remoteUrl) return binaryResponse(bytes);
    throw new Error(`未预期的模拟请求：${url}`);
  };
  const result = await runH3Shot({
    videoId,
    planId,
    planPath: binding.planPath,
    planSha256,
    style: {id: 'koubo-paper-construct-v1'},
    authorization: costAuthorization,
    shot,
    prompt,
    outputPath,
    ledgerPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl: firstFetch,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  });
  assert.equal(result.status, 'billing-reconciliation-required');
  assert.equal(result.attempt.actualCostStatus, 'missing');
  assert.equal(result.attempt.actualCostCny, null);
  assert.deepEqual(fs.readFileSync(outputPath), bytes);
  assert.equal(submitCount, 1);

  await assert.rejects(
    runH3Shot({
      videoId,
      planId,
      planPath: binding.planPath,
      planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: costAuthorization,
      shot: {id: 'G02', durationSeconds: 5},
      prompt: secondPrompt,
      outputPath: workspace.outputPath('G02'),
      ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async (url) => {
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
          return jsonResponse({estimatedPrice: 1, currency: 'CNY'});
        }
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) submitCount += 1;
        throw new Error(`对账未完成时不应请求：${url}`);
      },
    }),
    /未终结付费任务/,
  );
  assert.equal(submitCount, 1);

  let resumeQueryCount = 0;
  const resumeFetch = async (url, options) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.queryRoute)) {
      resumeQueryCount += 1;
      assert.deepEqual(JSON.parse(options.body), {taskId: 'task-billing-missing'});
      return jsonResponse({
        taskId: 'task-billing-missing',
        status: 'SUCCESS',
        results: [{url: remoteUrl, outputType: 'mp4'}],
        usage: {consumeMoney: 2.1},
      });
    }
    if (url === remoteUrl) return binaryResponse(bytes);
    throw new Error(`恢复阶段未预期的模拟请求：${url}`);
  };
  const resumed = await resumeH3Shot({
    videoId,
    planId,
    planPath: binding.planPath,
    planSha256,
    shot,
    prompt,
    outputPath,
    ledgerPath,
    apiKey: 'test-only-key',
    fetchImpl: resumeFetch,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  });
  assert.equal(resumed.status, 'downloaded');
  assert.equal(resumed.attempt.actualCostStatus, 'reported');
  assert.equal(resumed.attempt.actualCostCny, 2.1);
  assert.equal(resumed.attempt.recoveredExistingFile, true);
  assert.equal(resumeQueryCount, 1);
  assert.equal(submitCount, 1);
});

test('任一已提供费用字段为负数时不记为实际扣费', async (t) => {
  const planId = 'plan-billing-invalid';
  const workspace = makeGenerationWorkspace(t, planId);
  const {ledgerPath, videoId} = workspace;
  const outputPath = workspace.outputPath('G01');
  let shot = {id: 'G01', durationSeconds: 5};
  let prompt = '纸板天平展示两项费用对账';
  const binding = createPaidPlan(t, workspace, {
    shots: [{...shot, prompt}],
    maxPerShotCny: 3,
  });
  shot = binding.runtimeShot('G01');
  prompt = binding.promptFor('G01');
  const remoteUrl = 'https://cdn.runninghub.example/billing-invalid.mp4';
  const fetchImpl = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      return jsonResponse({
        taskId: 'task-billing-invalid',
        status: 'SUCCESS',
        results: [{url: remoteUrl, outputType: 'mp4'}],
        usage: {thirdPartyConsumeMoney: 2, consumeMoney: -0.1},
      });
    }
    if (url === remoteUrl) return binaryResponse(Buffer.from('invalid-billing-video'));
    throw new Error(`未预期的模拟请求：${url}`);
  };
  const result = await runH3Shot({
    videoId,
    planId,
    planPath: binding.planPath,
    planSha256: binding.planSha256,
    style: {id: 'koubo-paper-construct-v1'},
    authorization: binding.authorization,
    shot,
    prompt,
    outputPath,
    ledgerPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  });
  assert.equal(result.status, 'billing-reconciliation-required');
  assert.equal(result.attempt.actualCostStatus, 'invalid');
  assert.equal(result.attempt.actualCostCny, null);
  assert.equal(fs.existsSync(outputPath), true);
});

test('低层付费原语按已对账金额加本镜最新报价阻断超总额提交', async (t) => {
  const planId = 'plan-low-level-total-cap';
  const workspace = makeGenerationWorkspace(t, planId);
  const {ledgerPath, videoId} = workspace;
  let firstPrompt = '第一张纸卡完成计费';
  let secondPrompt = '第二张纸卡尝试进入计费滑槽';
  const binding = createPaidPlan(t, workspace, {
    shots: [
      {id: 'G01', durationSeconds: 5, prompt: firstPrompt},
      {id: 'G02', durationSeconds: 5, prompt: secondPrompt},
    ],
    maxPerShotCny: 4,
    maxAmountCny: 5,
  });
  firstPrompt = binding.promptFor('G01');
  secondPrompt = binding.promptFor('G02');
  const {planSha256} = binding;
  const costAuthorization = binding.authorization;
  const remoteUrl = 'https://cdn.runninghub.example/total-cap-first.mp4';
  let quoteCount = 0;
  let submitCount = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      quoteCount += 1;
      return jsonResponse({
        estimatedPrice: quoteCount === 1 ? 2.6 : 2.6,
        currency: 'CNY',
      });
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      submitCount += 1;
      return jsonResponse({
        taskId: 'task-total-cap-first',
        status: 'SUCCESS',
        results: [{url: remoteUrl, outputType: 'mp4'}],
        usage: {consumeMoney: 2.5},
      });
    }
    if (url === remoteUrl) return binaryResponse(Buffer.from('first-total-cap-video'));
    throw new Error(`未预期的模拟请求：${url}`);
  };

  await runH3Shot({
    videoId,
    planId,
    planPath: binding.planPath,
    planSha256,
    style: {id: 'koubo-paper-construct-v1'},
    authorization: costAuthorization,
    shot: {id: 'G01', durationSeconds: 5},
    prompt: firstPrompt,
    outputPath: workspace.outputPath('G01'),
    ledgerPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  });
  await assert.rejects(
    runH3Shot({
      videoId,
      planId,
      planPath: binding.planPath,
      planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: costAuthorization,
      shot: {id: 'G02', durationSeconds: 5},
      prompt: secondPrompt,
      outputPath: workspace.outputPath('G02'),
      ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 1,
    }),
    /已有实际费用加本镜最新服务端报价为5\.1元.*超过授权总额5元/,
  );
  assert.equal(quoteCount, 2);
  assert.equal(submitCount, 1);
  assert.equal(loadGeneratedVideoLedger(ledgerPath).attempts.G02, undefined);
});

test('双并发镜头在同一账本锁内重算总额，模型最多提交一次', async (t) => {
  const planId = 'plan-concurrent-total-cap';
  const workspace = makeGenerationWorkspace(t, planId);
  let promptFor = (shotId) => `${shotId}纸卡进入并发滑槽`;
  const binding = createPaidPlan(t, workspace, {
    shots: ['G01', 'G02'].map((id) => ({
      id,
      durationSeconds: 5,
      prompt: promptFor(id),
    })),
    maxPerShotCny: 3,
    maxAmountCny: 3,
  });
  promptFor = binding.promptFor;
  const {planSha256} = binding;
  const costAuthorization = binding.authorization;
  let priceCount = 0;
  let modelSubmitCount = 0;
  let releasePrices;
  const bothPricesStarted = new Promise((resolve) => {
    releasePrices = resolve;
  });
  const remoteBytes = Buffer.from('one-concurrent-result');
  const fetchImpl = async (url, options) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      priceCount += 1;
      if (priceCount === 2) releasePrices();
      await bothPricesStarted;
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      modelSubmitCount += 1;
      const payload = JSON.parse(options.body);
      const shotId = payload.prompt.includes('G01') ? 'G01' : 'G02';
      return jsonResponse({
        taskId: `task-concurrent-${shotId}`,
        status: 'SUCCESS',
        results: [
          {
            url: `https://cdn.runninghub.example/concurrent-${shotId}.mp4`,
            outputType: 'mp4',
          },
        ],
        usage: {consumeMoney: 2},
      });
    }
    if (url.startsWith('https://cdn.runninghub.example/concurrent-')) {
      return binaryResponse(remoteBytes);
    }
    throw new Error(`未预期的并发模拟请求：${url}`);
  };
  const runShot = (shotId) =>
    runH3Shot({
      videoId: workspace.videoId,
      planId,
      planPath: binding.planPath,
      planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: costAuthorization,
      shot: {id: shotId, durationSeconds: 5},
      prompt: promptFor(shotId),
      outputPath: workspace.outputPath(shotId),
      ledgerPath: workspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 1,
    });
  const results = await Promise.allSettled([runShot('G01'), runShot('G02')]);
  assert.equal(priceCount, 2);
  assert.equal(modelSubmitCount, 1);
  assert.equal(results.filter(({status}) => status === 'fulfilled').length, 1);
  assert.equal(results.filter(({status}) => status === 'rejected').length, 1);
  assert.equal(
    Object.keys(loadGeneratedVideoLedger(workspace.ledgerPath).attempts).length,
    1,
  );
});

test('伪造低priceQuote不能跳过付费前服务端强制报价', async (t) => {
  const planId = 'plan-forged-display-quote';
  const workspace = makeGenerationWorkspace(t, planId);
  let shot = {id: 'G01', durationSeconds: 5};
  let prompt = '伪造低价不得进入付费滑槽';
  const binding = createPaidPlan(t, workspace, {
    shots: [{...shot, prompt}],
    maxPerShotCny: 3,
  });
  shot = binding.runtimeShot('G01');
  prompt = binding.promptFor('G01');
  const forgedLowQuote = await quoteH3Shot({
    apiKey: 'test-only-key',
    shot,
    prompt,
    fetchImpl: async () =>
      jsonResponse({estimatedPrice: 1, currency: 'CNY', isFreeThisCall: false}),
  });
  let priceCount = 0;
  let modelSubmitCount = 0;
  await assert.rejects(
    runH3Shot({
      videoId: workspace.videoId,
      planId,
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot,
      prompt,
      outputPath: workspace.outputPath('G01'),
      ledgerPath: workspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      priceQuote: forgedLowQuote,
      fetchImpl: async (url) => {
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
          priceCount += 1;
          return jsonResponse({
            estimatedPrice: 4,
            currency: 'CNY',
            isFreeThisCall: false,
          });
        }
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) modelSubmitCount += 1;
        throw new Error(`伪造报价后不应请求：${url}`);
      },
    }),
    /批次展示报价与最新服务端报价不一致/,
  );
  assert.equal(priceCount, 1);
  assert.equal(modelSubmitCount, 0);
  assert.equal(fs.existsSync(workspace.ledgerPath), false);
});

test('服务端报价等待跨过expiresAt时不reserve且不提交模型', async (t) => {
  const planId = 'plan-expires-during-price-preview';
  const workspace = makeGenerationWorkspace(t, planId);
  let shot = {id: 'G01', durationSeconds: 5};
  let prompt = '报价等待跨过授权窗口';
  const binding = createPaidPlan(t, workspace, {
    shots: [{...shot, prompt}],
    maxPerShotCny: 3,
    approvedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 150).toISOString(),
  });
  shot = binding.runtimeShot('G01');
  prompt = binding.promptFor('G01');
  const costAuthorization = binding.authorization;
  let priceCount = 0;
  let modelSubmitCount = 0;
  await assert.rejects(
    runH3Shot({
      videoId: workspace.videoId,
      planId,
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: costAuthorization,
      shot,
      prompt,
      outputPath: workspace.outputPath('G01'),
      ledgerPath: workspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async (url) => {
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
          priceCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 250));
          return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
        }
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) modelSubmitCount += 1;
        throw new Error(`授权过期后不应请求：${url}`);
      },
    }),
    /金额授权已经过期/,
  );
  assert.equal(priceCount, 1);
  assert.equal(modelSubmitCount, 0);
  assert.equal(fs.existsSync(workspace.ledgerPath), false);
  assert.equal(
    fs.existsSync(approvalReceiptPathFor(costAuthorization.approvalId)),
    false,
  );
});

test('beforePaidReserve在账本锁内抛错时0reserve且0模型提交', async (t) => {
  const planId = 'plan-before-reserve-cas-failure';
  const workspace = makeGenerationWorkspace(t, planId);
  const binding = createPaidPlan(t, workspace, {
    shots: [{id: 'G01', durationSeconds: 5, prompt: 'CAS失败不得付费'}],
    maxPerShotCny: 3,
  });
  let callbackCount = 0;
  let priceCount = 0;
  let modelSubmitCount = 0;
  await assert.rejects(
    runH3Shot({
      videoId: workspace.videoId,
      planId,
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot: binding.runtimeShot('G01'),
      prompt: binding.promptFor('G01'),
      outputPath: workspace.outputPath('G01'),
      ledgerPath: workspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      beforePaidReserve: ({latestPrice}) => {
        callbackCount += 1;
        assert.equal(latestPrice.estimatedCostCny, 2);
        throw new Error('计划CAS已变更');
      },
      fetchImpl: async (url) => {
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
          priceCount += 1;
          return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
        }
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) modelSubmitCount += 1;
        throw new Error(`CAS失败后不应请求：${url}`);
      },
    }),
    /计划CAS已变更/,
  );
  assert.equal(callbackCount, 1);
  assert.equal(priceCount, 1);
  assert.equal(modelSubmitCount, 0);
  assert.equal(fs.existsSync(workspace.ledgerPath), false);
});

test('productionStatus未达ready-for-submit时低层直调零网络零模型提交', async (t) => {
  const workspace = makeGenerationWorkspace(t, 'plan-submit-status-guard');
  const binding = createPaidPlan(t, workspace, {
    shots: [{id: 'G01', durationSeconds: 5, prompt: '非法生产状态反例'}],
    maxPerShotCny: 3,
  });
  const changed = clone(binding.plan);
  changed.productionStatus = 'planned';
  fs.writeFileSync(binding.planPath, `${JSON.stringify(changed, null, 2)}\n`);
  let networkCount = 0;
  await assert.rejects(
    runH3Shot({
      videoId: workspace.videoId,
      planId: workspace.planId,
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot: binding.runtimeShot('G01'),
      prompt: binding.promptFor('G01'),
      outputPath: workspace.outputPath('G01'),
      ledgerPath: workspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async () => {
        networkCount += 1;
        throw new Error('非法生产状态不应联网');
      },
    }),
    /SUBMIT_STATUS_INVALID/,
  );
  assert.equal(networkCount, 0);
  assert.equal(fs.existsSync(workspace.ledgerPath), false);
});

test('materialized与qa-passed不得作为低层全新付费入口', async (t) => {
  const workspace = makeGenerationWorkspace(t, 'plan-terminal-status-paid-guard');
  const binding = createPaidPlan(t, workspace, {
    shots: [{id: 'G01', durationSeconds: 5, prompt: '终结生产状态不得重新付费'}],
    maxPerShotCny: 3,
  });
  let priceCount = 0;
  let modelSubmitCount = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) priceCount += 1;
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) modelSubmitCount += 1;
    throw new Error(`终结生产状态不应联网：${url}`);
  };
  for (const productionStatus of ['materialized', 'qa-passed']) {
    const changed = clone(binding.plan);
    changed.productionStatus = productionStatus;
    fs.writeFileSync(binding.planPath, `${JSON.stringify(changed, null, 2)}\n`);
    await assert.rejects(
      runH3Shot({
        videoId: workspace.videoId,
        planId: workspace.planId,
        planPath: binding.planPath,
        planSha256: binding.planSha256,
        style: {id: 'koubo-paper-construct-v1'},
        authorization: binding.authorization,
        shot: binding.runtimeShot('G01'),
        prompt: binding.promptFor('G01'),
        outputPath: workspace.outputPath('G01'),
        ledgerPath: workspace.ledgerPath,
        apiKey: 'test-only-key',
        confirmPaid: true,
        fetchImpl,
      }),
      /runH3Shot全新付费入口只允许ready-for-submit或submitted/,
      productionStatus,
    );
  }
  assert.equal(priceCount, 0);
  assert.equal(modelSubmitCount, 0);
  assert.equal(fs.existsSync(workspace.ledgerPath), false);
});

test('计划外G99直调在报价前被拒绝且零模型提交', async (t) => {
  const workspace = makeGenerationWorkspace(t, 'plan-member-guard');
  const binding = createPaidPlan(t, workspace, {
    shots: [{id: 'G01', durationSeconds: 5, prompt: '计划内唯一镜头'}],
    maxPerShotCny: 3,
  });
  let networkCount = 0;
  await assert.rejects(
    runH3Shot({
      videoId: workspace.videoId,
      planId: workspace.planId,
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot: {id: 'G99', durationSeconds: 5},
      prompt: binding.promptFor('G01'),
      outputPath: workspace.outputPath('G99'),
      ledgerPath: workspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async () => {
        networkCount += 1;
        throw new Error('计划外镜头不应联网');
      },
    }),
    /不是当前计划内唯一的精确成员/,
  );
  assert.equal(networkCount, 0);
  assert.equal(fs.existsSync(workspace.ledgerPath), false);
});

test('服务端报价后计划被篡改时零reserve零模型提交', async (t) => {
  const workspace = makeGenerationWorkspace(t, 'plan-mutated-after-price');
  const binding = createPaidPlan(t, workspace, {
    shots: [{id: 'G01', durationSeconds: 5, prompt: '报价后计划篡改反例'}],
    maxPerShotCny: 3,
  });
  let priceCount = 0;
  let modelSubmitCount = 0;
  await assert.rejects(
    runH3Shot({
      videoId: workspace.videoId,
      planId: workspace.planId,
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot: binding.runtimeShot('G01'),
      prompt: binding.promptFor('G01'),
      outputPath: workspace.outputPath('G01'),
      ledgerPath: workspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async (url) => {
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
          priceCount += 1;
          const changed = clone(binding.plan);
          changed.shots[0].promptCore.compiledPrompt += '\n报价后恶意篡改';
          fs.writeFileSync(
            binding.planPath,
            `${JSON.stringify(changed, null, 2)}\n`,
          );
          return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
        }
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
          modelSubmitCount += 1;
        }
        throw new Error(`计划篡改后不应请求：${url}`);
      },
    }),
    /计划定义已变更|COMPILED_PROMPT_(?:MISMATCH|STALE)/,
  );
  assert.equal(priceCount, 1);
  assert.equal(modelSubmitCount, 0);
  assert.equal(fs.existsSync(workspace.ledgerPath), false);
});

test('篡改provider的4K或9比16请求在任何网络前被拒绝', async (t) => {
  const workspace = makeGenerationWorkspace(t, 'plan-provider-contract-guard');
  const binding = createPaidPlan(t, workspace, {
    shots: [{id: 'G01', durationSeconds: 5, prompt: '提供商合同篡改反例'}],
    maxPerShotCny: 3,
  });
  let networkCount = 0;
  await assert.rejects(
    runH3Shot({
      provider: {...RUNNINGHUB_H3_PROVIDER, resolution: '4K', ratio: '9:16'},
      videoId: workspace.videoId,
      planId: workspace.planId,
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot: binding.runtimeShot('G01'),
      prompt: binding.promptFor('G01'),
      outputPath: workspace.outputPath('G01'),
      ledgerPath: workspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async () => {
        networkCount += 1;
        throw new Error('篡改provider不应联网');
      },
    }),
    /合同字段resolution与固定2K\/16:9\/无水印定义不一致/,
  );
  assert.equal(networkCount, 0);
  assert.equal(fs.existsSync(workspace.ledgerPath), false);
});

test('既有镜头实际费用超过单镜授权时锁内拒绝后续付费', async (t) => {
  const workspace = makeGenerationWorkspace(t, 'plan-prior-per-shot-breach');
  const binding = createPaidPlan(t, workspace, {
    shots: [
      {id: 'G01', durationSeconds: 5, prompt: '第一镜实扣超单镜上限'},
      {id: 'G02', durationSeconds: 5, prompt: '第二镜应被阻断'},
    ],
    maxPerShotCny: 3,
    maxAmountCny: 10,
  });
  const remoteUrl = 'https://cdn.runninghub.example/per-shot-breach.mp4';
  let priceCount = 0;
  let modelSubmitCount = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      priceCount += 1;
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      modelSubmitCount += 1;
      return jsonResponse({
        taskId: 'task-prior-per-shot-breach',
        status: 'SUCCESS',
        results: [{url: remoteUrl, outputType: 'mp4'}],
        usage: {consumeMoney: 3.5},
      });
    }
    if (url === remoteUrl) return binaryResponse(Buffer.from('per-shot-breach'));
    throw new Error(`未预期请求：${url}`);
  };
  await runH3Shot({
    videoId: workspace.videoId,
    planId: workspace.planId,
    planPath: binding.planPath,
    planSha256: binding.planSha256,
    style: {id: 'koubo-paper-construct-v1'},
    authorization: binding.authorization,
    shot: binding.runtimeShot('G01'),
    prompt: binding.promptFor('G01'),
    outputPath: workspace.outputPath('G01'),
    ledgerPath: workspace.ledgerPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  });
  await assert.rejects(
    runH3Shot({
      videoId: workspace.videoId,
      planId: workspace.planId,
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot: binding.runtimeShot('G02'),
      prompt: binding.promptFor('G02'),
      outputPath: workspace.outputPath('G02'),
      ledgerPath: workspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 1,
    }),
    /实际费用3\.5元超过单镜授权上限3元/,
  );
  assert.equal(priceCount, 2);
  assert.equal(modelSubmitCount, 1);
  assert.equal(loadGeneratedVideoLedger(workspace.ledgerPath).attempts.G02, undefined);
});

test('费用回执与账本随机临时路径均拒绝符号链接', async (t) => {
  const directory = makeTemporaryDirectory(t);
  const workspace = makeGenerationWorkspace(t, 'plan-receipt-temp-symlink');
  const binding = createPaidPlan(t, workspace, {
    shots: [{id: 'G01', durationSeconds: 5, prompt: '回执与临时文件符号链接反例'}],
    maxPerShotCny: 3,
  });
  const protectedTarget = path.join(directory, 'protected.json');
  fs.writeFileSync(protectedTarget, 'protected-content');
  const receiptPath = approvalReceiptPathFor(binding.authorization.approvalId);
  fs.mkdirSync(path.dirname(receiptPath), {recursive: true});
  fs.symlinkSync(protectedTarget, receiptPath);
  let priceCount = 0;
  let modelSubmitCount = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      priceCount += 1;
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) modelSubmitCount += 1;
    throw new Error(`符号链接门禁后不应请求：${url}`);
  };
  const argumentsForRun = {
    videoId: workspace.videoId,
    planId: workspace.planId,
    planPath: binding.planPath,
    planSha256: binding.planSha256,
    style: {id: 'koubo-paper-construct-v1'},
    authorization: binding.authorization,
    shot: binding.runtimeShot('G01'),
    prompt: binding.promptFor('G01'),
    outputPath: workspace.outputPath('G01'),
    ledgerPath: workspace.ledgerPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl,
  };
  await assert.rejects(
    runH3Shot(argumentsForRun),
    /费用批准消费回执拒绝符号链接/,
  );
  assert.equal(fs.readFileSync(protectedTarget, 'utf8'), 'protected-content');
  fs.unlinkSync(receiptPath);

  const originalRandomBytes = crypto.randomBytes;
  const fixedRandomByte = 0x5a;
  crypto.randomBytes = (size) => Buffer.alloc(size, fixedRandomByte);
  const predictableTemporaryPath =
    `${workspace.ledgerPath}.tmp-${process.pid}-${'5a'.repeat(16)}`;
  fs.mkdirSync(path.dirname(predictableTemporaryPath), {recursive: true});
  fs.symlinkSync(protectedTarget, predictableTemporaryPath);
  try {
    await assert.rejects(
      runH3Shot(argumentsForRun),
      /任务账本临时文件拒绝符号链接/,
    );
  } finally {
    crypto.randomBytes = originalRandomBytes;
    if (fs.lstatSync(predictableTemporaryPath).isSymbolicLink()) {
      fs.unlinkSync(predictableTemporaryPath);
    }
  }
  assert.equal(priceCount, 2);
  assert.equal(modelSubmitCount, 0);
  assert.equal(fs.existsSync(workspace.ledgerPath), false);
  assert.equal(fs.readFileSync(protectedTarget, 'utf8'), 'protected-content');
});

test('计划父目录符号链接与项目外planPath在联网前被拒绝', async (t) => {
  const directory = makeTemporaryDirectory(t);
  const workspace = makeGenerationWorkspace(t, 'plan-path-symlink-ancestor');
  const binding = createPaidPlan(t, workspace, {
    shots: [{id: 'G01', durationSeconds: 5, prompt: '计划路径安全反例'}],
    maxPerShotCny: 3,
  });
  let networkCount = 0;
  const mustNotFetch = async () => {
    networkCount += 1;
    throw new Error('计划路径失败后不应联网');
  };
  const baseArguments = {
    videoId: workspace.videoId,
    planId: workspace.planId,
    planSha256: binding.planSha256,
    style: {id: 'koubo-paper-construct-v1'},
    authorization: binding.authorization,
    shot: binding.runtimeShot('G01'),
    prompt: binding.promptFor('G01'),
    outputPath: workspace.outputPath('G01'),
    ledgerPath: workspace.ledgerPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl: mustNotFetch,
  };
  await assert.rejects(
    runH3Shot({...baseArguments, planPath: path.join(directory, 'outside.json')}),
    /生成视频拆镜计划必须位于口播项目根目录内/,
  );

  const planRoot = path.dirname(binding.planPath);
  const outsidePlanRoot = path.join(directory, 'outside-plan-root');
  fs.renameSync(planRoot, outsidePlanRoot);
  fs.symlinkSync(outsidePlanRoot, planRoot);
  try {
    await assert.rejects(
      runH3Shot({...baseArguments, planPath: binding.planPath}),
      /生成视频拆镜计划父目录拒绝符号链接目录/,
    );
  } finally {
    fs.unlinkSync(planRoot);
  }
  assert.equal(networkCount, 0);
  assert.equal(fs.existsSync(workspace.ledgerPath), false);
});

test('resume在联网查询前锁定plan、请求、提示词、输出、授权与尝试定义', async (t) => {
  const directory = makeTemporaryDirectory(t);
  const planId = 'plan-resume-definition-lock';
  const workspace = makeGenerationWorkspace(t, planId);
  const {ledgerPath, videoId} = workspace;
  const binding = createPaidPlan(t, workspace, {
    shots: [{
      id: 'G01',
      durationSeconds: 7,
      prompt: '纸板机械臂把深蓝卡片推进棕色归档盒',
    }],
    maxPerShotCny: 3,
  });
  const {planSha256} = binding;
  const prompt = binding.promptFor('G01');
  const shot = binding.runtimeShot('G01');
  const outputPath = workspace.outputPath('G01');
  const taskId = 'task-resume-definition-lock';
  const fetchImpl = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      return jsonResponse({taskId, status: 'RUNNING'});
    }
    throw new Error(`初始提交不应请求：${url}`);
  };
  await assert.rejects(
    runH3Shot({
      videoId,
      planId,
      planPath: binding.planPath,
      planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot,
      prompt,
      outputPath,
      ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 0,
    }),
    /在轮询上限内未返回终态/,
  );
  const baseline = loadGeneratedVideoLedger(ledgerPath);
  let queryCount = 0;
  const mustNotQuery = async (url) => {
    queryCount += 1;
    throw new Error(`定义校验失败时不应联网：${url}`);
  };
  const baseArguments = {
    videoId,
    planId,
    planPath: binding.planPath,
    planSha256,
    shot,
    prompt,
    outputPath,
    ledgerPath,
    apiKey: 'test-only-key',
    fetchImpl: mustNotQuery,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  };
  const writeMutatedLedger = (mutate) => {
    const next = structuredClone(baseline);
    mutate(next);
    fs.writeFileSync(ledgerPath, `${JSON.stringify(next, null, 2)}\n`);
  };
  const cases = [
    {
      name: 'requestSha256',
      mutate: (ledger) => {
        ledger.attempts.G01.requestSha256 = '0'.repeat(64);
      },
      pattern: /恢复请求、提示词或时长已发生变化/,
    },
    {
      name: 'promptSha256',
      mutate: (ledger) => {
        ledger.attempts.G01.promptSha256 = '0'.repeat(64);
      },
      pattern: /恢复请求、提示词或时长已发生变化/,
    },
    {
      name: 'attemptNumber',
      mutate: (ledger) => {
        ledger.attempts.G01.attemptNumber = 2;
      },
      pattern: /尝试序号或镜头绑定不一致/,
    },
    {
      name: 'provider',
      mutate: (ledger) => {
        ledger.attempts.G01.providerId = 'tampered-provider';
      },
      pattern: /提供商或模型定义不一致/,
    },
    {
      name: 'authorization',
      mutate: (ledger) => {
        ledger.attempts.G01.authorization.approvalId = 'tampered-approval';
      },
      pattern: /费用授权快照与账本不一致/,
    },
    {
      name: 'outputPath',
      mutate: (ledger) => {
        ledger.attempts.G01.outputPath = path.join(directory, 'attacker.mp4');
      },
      pattern: /账本输出路径与调用者当前固定路径不一致/,
    },
  ];
  for (const item of cases) {
    writeMutatedLedger(item.mutate);
    await assert.rejects(resumeH3Shot(baseArguments), item.pattern, item.name);
  }
  fs.writeFileSync(ledgerPath, `${JSON.stringify(baseline, null, 2)}\n`);
  await assert.rejects(
    resumeH3Shot({...baseArguments, planSha256: '7'.repeat(64)}),
    /generationDefinitionSha256不一致/,
  );
  await assert.rejects(
    resumeH3Shot({...baseArguments, prompt: '被篡改的提示词'}),
    /调用提示词与计划定义不一致|恢复请求、提示词或时长已发生变化/,
  );
  await assert.rejects(
    resumeH3Shot({
      ...baseArguments,
      outputPath: workspace.outputPath('G02'),
    }),
    /视频输出必须使用固定项目派生路径/,
  );
  assert.equal(queryCount, 0);

  const mismatchFetch = async (url, options) => {
    queryCount += 1;
    assert.equal(url.endsWith(RUNNINGHUB_H3_PROVIDER.queryRoute), true);
    assert.deepEqual(JSON.parse(options.body), {taskId});
    return jsonResponse({taskId: 'task-attacker-substitution', status: 'RUNNING'});
  };
  await assert.rejects(
    resumeH3Shot({...baseArguments, fetchImpl: mismatchFetch}),
    /回传taskId与固定任务不一致/,
  );
  assert.equal(queryCount, 1);
});

test('项目外路径与任意层级符号链接在任何网络请求前被拒绝', async (t) => {
  const directory = makeTemporaryDirectory(t);
  let networkCount = 0;
  const mustNotFetch = async (url) => {
    networkCount += 1;
    throw new Error(`路径门禁失败时不应请求：${url}`);
  };

  const outsidePlanId = 'plan-outside-path';
  await assert.rejects(
    runH3Shot({
      videoId: `VIDEO-${outsidePlanId}`,
      planId: outsidePlanId,
      planSha256: '7'.repeat(64),
      style: {id: 'koubo-paper-construct-v1'},
      authorization: authorization(t, outsidePlanId, '7'.repeat(64), 2),
      shot: {id: 'G01', durationSeconds: 5},
      prompt: '项目外路径反例',
      outputPath: path.join(directory, 'outside.mp4'),
      ledgerPath: path.join(directory, 'outside-ledger.json'),
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: mustNotFetch,
    }),
    /任务账本必须位于口播项目根目录内/,
  );

  const ancestorPlanId = 'plan-symlink-ancestor';
  const ancestorWorkspace = makeGenerationWorkspace(t, ancestorPlanId);
  const ancestorOutputPath = ancestorWorkspace.outputPath('G01');
  const videoAncestor = path.dirname(
    path.dirname(path.dirname(ancestorOutputPath)),
  );
  fs.mkdirSync(path.dirname(videoAncestor), {recursive: true});
  const outsideAncestorTarget = path.join(directory, 'outside-video-root');
  fs.mkdirSync(outsideAncestorTarget);
  fs.symlinkSync(outsideAncestorTarget, videoAncestor);
  try {
    await assert.rejects(
      runH3Shot({
        videoId: ancestorWorkspace.videoId,
        planId: ancestorPlanId,
        planSha256: '8'.repeat(64),
        style: {id: 'koubo-paper-construct-v1'},
        authorization: authorization(t, ancestorPlanId, '8'.repeat(64), 2),
        shot: {id: 'G01', durationSeconds: 5},
        prompt: '项目内祖先目录符号链接反例',
        outputPath: ancestorOutputPath,
        ledgerPath: ancestorWorkspace.ledgerPath,
        apiKey: 'test-only-key',
        confirmPaid: true,
        fetchImpl: mustNotFetch,
      }),
      /拒绝符号链接目录/,
    );
  } finally {
    fs.unlinkSync(videoAncestor);
  }

  const ledgerPlanId = 'plan-symlink-ledger';
  const ledgerWorkspace = makeGenerationWorkspace(t, ledgerPlanId);
  const ledgerTarget = path.join(directory, 'ledger-target.json');
  fs.writeFileSync(ledgerTarget, '{}\n');
  fs.mkdirSync(path.dirname(ledgerWorkspace.ledgerPath), {recursive: true});
  fs.symlinkSync(ledgerTarget, ledgerWorkspace.ledgerPath);
  await assert.rejects(
    runH3Shot({
      videoId: ledgerWorkspace.videoId,
      planId: ledgerPlanId,
      planSha256: '9'.repeat(64),
      style: {id: 'koubo-paper-construct-v1'},
      authorization: authorization(t, ledgerPlanId, '9'.repeat(64), 2),
      shot: {id: 'G01', durationSeconds: 5},
      prompt: '账本符号链接反例',
      outputPath: ledgerWorkspace.outputPath('G01'),
      ledgerPath: ledgerWorkspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: mustNotFetch,
    }),
    /任务账本拒绝符号链接/,
  );

  const outputPlanId = 'plan-symlink-output';
  const outputWorkspace = makeGenerationWorkspace(t, outputPlanId);
  const outputTarget = path.join(directory, 'output-target.mp4');
  fs.writeFileSync(outputTarget, 'do-not-overwrite');
  const outputLink = outputWorkspace.outputPath('G01');
  fs.mkdirSync(path.dirname(outputLink), {recursive: true});
  fs.symlinkSync(outputTarget, outputLink);
  await assert.rejects(
    runH3Shot({
      videoId: outputWorkspace.videoId,
      planId: outputPlanId,
      planSha256: 'a'.repeat(64),
      style: {id: 'koubo-paper-construct-v1'},
      authorization: authorization(t, outputPlanId, 'a'.repeat(64), 2),
      shot: {id: 'G01', durationSeconds: 5},
      prompt: '输出符号链接反例',
      outputPath: outputLink,
      ledgerPath: outputWorkspace.ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: mustNotFetch,
    }),
    /视频输出拒绝符号链接/,
  );
  assert.equal(fs.readFileSync(outputTarget, 'utf8'), 'do-not-overwrite');
  assert.equal(networkCount, 0);
});

test('远端下载期间输出被换成符号链接时不跟随且不覆盖目标', async (t) => {
  const directory = makeTemporaryDirectory(t);
  const planId = 'plan-download-symlink-race';
  const workspace = makeGenerationWorkspace(t, planId);
  const {ledgerPath, videoId} = workspace;
  const binding = createPaidPlan(t, workspace, {
    shots: [{id: 'G01', durationSeconds: 5, prompt: '下载窗口符号链接反例'}],
    maxPerShotCny: 2,
  });
  const outputPath = workspace.outputPath('G01');
  const protectedTarget = path.join(directory, 'protected-target.mp4');
  fs.writeFileSync(protectedTarget, 'protected-content');
  const remoteUrl = 'https://cdn.runninghub.example/download-race.mp4';
  let submitCount = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 1, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      submitCount += 1;
      return jsonResponse({
        taskId: 'task-download-symlink-race',
        status: 'SUCCESS',
        results: [{url: remoteUrl, outputType: 'mp4'}],
        usage: {consumeMoney: 1},
      });
    }
    if (url === remoteUrl) {
      fs.symlinkSync(protectedTarget, outputPath);
      return binaryResponse(Buffer.from('attacker-controlled-remote-video'));
    }
    throw new Error(`未预期的模拟请求：${url}`);
  };
  await assert.rejects(
    runH3Shot({
      videoId,
      planId,
      planPath: binding.planPath,
      planSha256: binding.planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization: binding.authorization,
      shot: binding.runtimeShot('G01'),
      prompt: binding.promptFor('G01'),
      outputPath,
      ledgerPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 1,
    }),
    /既有视频输出拒绝符号链接/,
  );
  assert.equal(submitCount, 1);
  assert.equal(fs.readFileSync(protectedTarget, 'utf8'), 'protected-content');
  assert.equal(loadGeneratedVideoLedger(ledgerPath).attempts.G01.status, 'download-failed');
});
