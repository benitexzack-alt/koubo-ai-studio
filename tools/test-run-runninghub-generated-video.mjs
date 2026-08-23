import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  approvalReceiptRelativePathFor,
  compileShotPrompt,
  generatedVideoMediaRootFor,
  generatedVideoPlanPathFor,
  generatedVideoRenderSourceFor,
  generationDefinitionSha256,
} from './generated-video-plan-core.mjs';
import {
  compilePlanFile,
  preflightPlan,
  quotePlan,
  readPlanStatus,
  resumePlanShot,
  runPlan,
} from './run-runninghub-generated-video.mjs';
import {
  approvalReceiptPathFor,
  buildH3Request,
  RUNNINGHUB_H3_PROVIDER,
  stableJsonSha256 as providerStableJsonSha256,
} from './runninghub-generated-video-client.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.resolve(projectRoot, relativePath), 'utf8'));
const style = readJson('workflow/style-library/koubo-paper-construct-v1.json');
const template = readJson('templates/08-generated-video-plan-template.json');
const clone = (value) => JSON.parse(JSON.stringify(value));
const retiredLegacyRunnerTest = (name, callback) =>
  test(name, {skip: '纸构推演 v1 已退役；保留历史费用与并发 fixture 作失败回归档案。'}, callback);

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});
const binaryResponse = (buffer) => ({
  ok: true,
  status: 200,
  arrayBuffer: async () =>
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
});

const makeShot = ({id, layerId, offset, outputPath}) => {
  const shot = clone(template.shots[0]);
  shot.id = id;
  shot.requestId = id;
  shot.layerId = layerId;
  shot.spokenAnchor = {
    text: `${id}：散乱的信息被推入统一的结构。`,
    startSeconds: offset,
    endSeconds: offset + 5,
  };
  shot.selectionReason = '抽象机制需要用一个可见物理因果动作解释，只作概念演绎。';
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
    durationSeconds: 6,
    establish: {startSeconds: 0, endSeconds: 0.8},
    action: {startSeconds: 0.8, endSeconds: 5.2},
    finalHold: {startSeconds: 5.2, endSeconds: 6},
  };
  shot.promptCore = {
    concept: '信息结构化',
    visualMetaphor: '卡片沿滑轨进入归档槽',
    openingFrame: '信息卡停在滑轨左侧，推杆贴住左边缘',
    actionInstruction: '推杆只推动这一张卡沿直线进入归档槽',
    closingFrame: '同一张卡完整入槽并稳定停留',
    compiledPrompt: '',
  };
  shot.output.videoPath = outputPath;
  return shot;
};

const createPlanFixture = (
  t,
  {shotCount = 2, maxAmountCny = 5, maxPerShotCny = 2.5} = {},
) => {
  const relativeRoot = `work/.runninghub-plan-runner-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const absoluteRoot = path.resolve(projectRoot, relativeRoot);
  fs.mkdirSync(absoluteRoot, {recursive: true});

  const plan = clone(template);
  const uniqueId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  plan.planId = `runner-contract-${shotCount}-${uniqueId}`;
  plan.videoId = `RUNNER_${shotCount}_${uniqueId}`;
  plan.videoTitle = 'RunningHub批次费用门测试';
  plan.productionStatus = 'ready-for-submit';
  plan.planPath = generatedVideoPlanPathFor(plan.videoId);
  plan.visualPlan = `${relativeRoot}/visual-plan.json`;
  const workflowRoot = `edit/generated-video/${plan.planId}`;
  const mediaRoot = generatedVideoMediaRootFor(plan.videoId, plan.planId);
  plan.outputs = {
    rootDir: mediaRoot,
    ledgerPath: `${workflowRoot}/generation-ledger.json`,
    quotePath: `${workflowRoot}/latest-quote.json`,
    approvalReceiptPath: null,
    approvalReceiptSha256: null,
    contactSheetPath: `${workflowRoot}/contact-sheet.jpg`,
    qaReportPath: `${workflowRoot}/qa-report.json`,
  };
  const approvedAt = new Date(Date.now() - 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  plan.costAuthorization = {
    status: 'approved',
    approvalId: `approval-${plan.planId}`,
    approvedBy: '测试用户',
    approvedAt,
    expiresAt,
    scope: {type: 'plan-only', planId: plan.planId, definitionSha256: null},
    maxPerShotCny,
    maxAmountCny,
    currency: 'CNY',
    maxAttemptsPerShot: 1,
    automaticRetry: false,
  };
  plan.shots = Array.from({length: shotCount}, (_, index) => {
    const id = `G${String(index + 1).padStart(2, '0')}`;
    return makeShot({
      id,
      layerId: `provider-layer-${id}`,
      offset: index * 6,
      outputPath: `${mediaRoot}/${id}.mp4`,
    });
  });
  for (const shot of plan.shots) {
    shot.promptCore.compiledPrompt = compileShotPrompt(plan, style, shot);
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
        component: 'generated-media',
        src: generatedVideoRenderSourceFor(plan.videoId, plan.planId, shot.id),
        disclosure: 'AI生成·概念演绎',
        badge: '非真实业务证据',
      },
    })),
  };
  fs.writeFileSync(
    path.resolve(projectRoot, plan.visualPlan),
    `${JSON.stringify(visualPlan, null, 2)}\n`,
  );
  plan.costAuthorization.scope.definitionSha256 =
    generationDefinitionSha256(plan);
  const planPath = plan.planPath;
  fs.mkdirSync(path.dirname(path.resolve(projectRoot, planPath)), {recursive: true});
  fs.writeFileSync(
    path.resolve(projectRoot, planPath),
    `${JSON.stringify(plan, null, 2)}\n`,
  );
  t.after(() => {
    fs.rmSync(absoluteRoot, {recursive: true, force: true});
    fs.rmSync(path.dirname(path.resolve(projectRoot, planPath)), {
      recursive: true,
      force: true,
    });
    fs.rmSync(path.resolve(projectRoot, workflowRoot), {recursive: true, force: true});
    fs.rmSync(path.resolve(projectRoot, mediaRoot), {recursive: true, force: true});
    fs.rmSync(path.resolve(
      projectRoot,
      approvalReceiptRelativePathFor(plan.costAuthorization.approvalId),
    ), {
      force: true,
    });
  });
  return {plan, planPath, relativeRoot, absoluteRoot};
};

test('退役纸构计划阻断 compile/preflight/quote/run 且零联网零写入', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const absolutePlanPath = path.resolve(projectRoot, fixture.planPath);
  const before = fs.readFileSync(absolutePlanPath);
  let networkCalls = 0;
  const fetchImpl = async () => {
    networkCalls += 1;
    throw new Error('退役硬门后不应联网');
  };

  assert.throws(
    () => compilePlanFile({planPath: fixture.planPath}),
    /退役生成风格硬门.*RunningHub compile/s,
  );
  assert.throws(
    () => preflightPlan({planPath: fixture.planPath}),
    /退役生成风格硬门.*RunningHub preflight/s,
  );
  await assert.rejects(
    quotePlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      fetchImpl,
    }),
    /退役生成风格硬门.*RunningHub quote/s,
  );
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
    }),
    /退役生成风格硬门.*RunningHub run/s,
  );

  assert.equal(networkCalls, 0);
  assert.deepEqual(fs.readFileSync(absolutePlanPath), before);
  assert.equal(
    fs.existsSync(path.resolve(projectRoot, fixture.plan.outputs.ledgerPath)),
    false,
  );
  assert.equal(
    fs.existsSync(path.resolve(projectRoot, fixture.plan.outputs.quotePath)),
    false,
  );
  assert.equal(fs.existsSync(`${absolutePlanPath}.execution.lock`), false);
});

test('RunningHub 按改名文件内容 SHA 阻断并在 status 回执标记不可生产', (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const retiredVideoSha256 =
    'e0bb0900417c0a5f87d112ded4e3be56af4cd0ad0a9842a2349e15c0ffc70435';
  const sourcePath = path.resolve(
    projectRoot,
    'remotion/public/media/wechat-geo-aao-20260823/user-generated-paper/G01.mp4',
  );
  assert.equal(
    createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
    retiredVideoSha256,
  );
  const renamedRelative = `${fixture.relativeRoot}/renamed-retired-video.bin`;
  fs.copyFileSync(sourcePath, path.resolve(projectRoot, renamedRelative));
  const changed = readJson(fixture.planPath);
  changed.retiredRegressionAsset = renamedRelative;
  fs.writeFileSync(
    path.resolve(projectRoot, fixture.planPath),
    `${JSON.stringify(changed, null, 2)}\n`,
  );

  let compileError = null;
  try {
    compilePlanFile({planPath: fixture.planPath});
  } catch (error) {
    compileError = error;
  }
  assert.ok(compileError);
  assert.equal(compileError.code, 'RETIRED_GENERATED_STYLE');
  assert.ok(
    compileError.hits.some((hit) => hit.sha256 === retiredVideoSha256),
    'RunningHub compile 必须记录改名 G01 的目标 SHA-256。',
  );
  const status = readPlanStatus({planPath: fixture.planPath});
  assert.equal(status.productionUsability, 'blocked-retired-style');
  assert.ok(
    status.retiredStyleFingerprints.includes(`sha256:${retiredVideoSha256}`),
  );
});

test('退役纸构计划保留 status，并显式标记不可生产', (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const result = readPlanStatus({planPath: fixture.planPath});
  assert.equal(result.planId, fixture.plan.planId);
  assert.equal(result.productionUsability, 'blocked-retired-style');
  assert.ok(result.retiredStyleFingerprints.includes('koubo-paper-construct-v1'));
});

test('退役纸构 resume 没有已绑定 taskId 时在加锁前零联网失败', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const absolutePlanPath = path.resolve(projectRoot, fixture.planPath);
  const before = fs.readFileSync(absolutePlanPath);
  let networkCalls = 0;
  await assert.rejects(
    resumePlanShot({
      planPath: fixture.planPath,
      shotId: 'G01',
      apiKey: 'test-only-key',
      fetchImpl: async () => {
        networkCalls += 1;
        throw new Error('无绑定 taskId 时不应联网');
      },
    }),
    /退役生成风格硬门.*RunningHub resume/s,
  );
  assert.equal(networkCalls, 0);
  assert.deepEqual(fs.readFileSync(absolutePlanPath), before);
  assert.equal(fs.existsSync(`${absolutePlanPath}.execution.lock`), false);
});

test('退役纸构已有 taskId 的 resume 也在联网下载写入前阻断', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const shot = fixture.plan.shots[0];
  const planSha256 = generationDefinitionSha256(fixture.plan);
  const ledgerPath = path.resolve(projectRoot, fixture.plan.outputs.ledgerPath);
  const outputPath = path.resolve(projectRoot, shot.output.videoPath);
  const receiptPath = approvalReceiptPathFor(
    fixture.plan.costAuthorization.approvalId,
  );
  const authorization = clone(fixture.plan.costAuthorization);
  const request = buildH3Request({
    prompt: shot.promptCore.compiledPrompt,
    durationSeconds: shot.timing.durationSeconds,
  });
  const taskId = 'retired-bound-task-G01';
  fs.mkdirSync(path.dirname(ledgerPath), {recursive: true});
  fs.writeFileSync(
    ledgerPath,
    `${JSON.stringify({
      schemaVersion: 1,
      provider: RUNNINGHUB_H3_PROVIDER.provider,
      providerId: RUNNINGHUB_H3_PROVIDER.id,
      model: RUNNINGHUB_H3_PROVIDER.model,
      planId: fixture.plan.planId,
      planSha256,
      style: {id: 'koubo-paper-construct-v1'},
      authorization,
      policy: {
        maximumPaidAttemptsPerShot: 1,
        automaticPaidRetryAllowed: false,
      },
      attempts: {
        G01: {
          shotId: 'G01',
          attemptNumber: 1,
          status: 'submitted',
          taskId,
          providerId: RUNNINGHUB_H3_PROVIDER.id,
          model: RUNNINGHUB_H3_PROVIDER.model,
          modelRoute: RUNNINGHUB_H3_PROVIDER.modelRoute,
          resolution: RUNNINGHUB_H3_PROVIDER.resolution,
          ratio: RUNNINGHUB_H3_PROVIDER.ratio,
          durationSeconds: shot.timing.durationSeconds,
          requestSha256: providerStableJsonSha256(request),
          promptSha256: createHash('sha256')
            .update(Buffer.from(shot.promptCore.compiledPrompt))
            .digest('hex'),
          outputPath,
          outputSha256: null,
          actualCostCny: null,
          actualCostStatus: 'missing',
          authorization,
        },
      },
    }, null, 2)}\n`,
  );
  fs.mkdirSync(path.dirname(receiptPath), {recursive: true});
  fs.writeFileSync(
    receiptPath,
    `${JSON.stringify({
      schemaVersion: 'generated-video-approval-consumption/v1',
      approvalId: authorization.approvalId,
      planId: fixture.plan.planId,
      definitionSha256: planSha256,
      ledgerPath,
      approvedBy: authorization.approvedBy,
      approvedAt: authorization.approvedAt,
      expiresAt: authorization.expiresAt,
      maxPerShotCny: Number(authorization.maxPerShotCny),
      maxAmountCny: Number(authorization.maxAmountCny),
      currency: authorization.currency,
      providerId: RUNNINGHUB_H3_PROVIDER.id,
      consumedAt: new Date().toISOString(),
    }, null, 2)}\n`,
  );

  const absolutePlanPath = path.resolve(projectRoot, fixture.planPath);
  const planBeforeResume = fs.readFileSync(absolutePlanPath);
  const ledgerBeforeResume = fs.readFileSync(ledgerPath);
  const remoteUrl = 'https://cdn.runninghub.example/retired-bound-G01.mp4';
  let queryCalls = 0;
  let paidSubmitCalls = 0;
  await assert.rejects(
    resumePlanShot({
      planPath: fixture.planPath,
      shotId: 'G01',
      apiKey: 'test-only-key',
      fetchImpl: async (url) => {
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.queryRoute)) queryCalls += 1;
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) paidSubmitCalls += 1;
        if (url === remoteUrl) throw new Error('退役恢复不得下载');
        throw new Error(`退役恢复不应发起请求：${url}`);
      },
      pollIntervalMs: 0,
      maximumPollCount: 1,
      now: () => '2026-08-24T12:00:00.000Z',
    }),
    /退役生成风格硬门.*RunningHub resume/s,
  );

  assert.equal(queryCalls, 0);
  assert.equal(paidSubmitCalls, 0);
  assert.deepEqual(fs.readFileSync(absolutePlanPath), planBeforeResume);
  assert.deepEqual(fs.readFileSync(ledgerPath), ledgerBeforeResume);
  assert.equal(fs.existsSync(outputPath), false);
  assert.equal(fs.existsSync(`${absolutePlanPath}.execution.lock`), false);
});

retiredLegacyRunnerTest('preflight 完全离线且不创建任务账本', (t) => {
  const fixture = createPlanFixture(t);
  const result = preflightPlan({planPath: fixture.planPath});
  assert.equal(result.shotCount, 2);
  assert.equal(result.paidTaskSubmitted, false);
  assert.equal(
    fs.existsSync(path.resolve(projectRoot, fixture.plan.outputs.ledgerPath)),
    false,
  );
});

retiredLegacyRunnerTest('quote 只完成全部镜头报价，不提交任务', async (t) => {
  const fixture = createPlanFixture(t);
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
  };
  const report = await quotePlan({
    planPath: fixture.planPath,
    apiKey: 'test-only-key',
    fetchImpl,
    now: () => '2026-08-22T09:01:00.000Z',
  });
  assert.equal(report.totalEstimatedCostCny, 4);
  assert.equal(report.paidTaskSubmitted, false);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)));
  assert.equal(
    fs.existsSync(path.resolve(projectRoot, fixture.plan.outputs.ledgerPath)),
    false,
  );
});

retiredLegacyRunnerTest('批次总报价超过授权上限时全部镜头均不提交', async (t) => {
  const fixture = createPlanFixture(t, {maxAmountCny: 3});
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
  };
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
    }),
    /批次预估总额4元超过用户授权上限3元；全部镜头均未新提交/,
  );
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)));
  assert.equal(
    fs.existsSync(path.resolve(projectRoot, fixture.plan.outputs.ledgerPath)),
    false,
  );
});

retiredLegacyRunnerTest('计划执行锁已存在时禁止并发报价和付费', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const lockPath = `${path.resolve(projectRoot, fixture.planPath)}.execution.lock`;
  fs.writeFileSync(lockPath, '{"test":"busy"}\n');
  let networkCalls = 0;
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async () => {
        networkCalls += 1;
        throw new Error('不应联网');
      },
    }),
    /禁止并发付费或覆盖计划/,
  );
  assert.equal(networkCalls, 0);
  fs.rmSync(lockPath, {force: true});
});

retiredLegacyRunnerTest('全量报价期间计划被外部修改时零模型提交且释放执行锁', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const absolutePlanPath = path.resolve(projectRoot, fixture.planPath);
  const lockPath = `${absolutePlanPath}.execution.lock`;
  let modelCalls = 0;
  let changed = false;
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async (url) => {
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
          if (!changed) {
            changed = true;
            const externalPlan = readJson(fixture.planPath);
            externalPlan.videoTitle += '（外部修改）';
            fs.writeFileSync(
              absolutePlanPath,
              `${JSON.stringify(externalPlan, null, 2)}\n`,
            );
          }
          return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
        }
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) modelCalls += 1;
        throw new Error('不应进入模型提交');
      },
    }),
    /执行期间被其他进程修改/,
  );
  assert.equal(modelCalls, 0);
  assert.equal(fs.existsSync(lockPath), false);
});

retiredLegacyRunnerTest('单镜权威报价等待期间计划变更时reserve前零模型提交', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const absolutePlanPath = path.resolve(projectRoot, fixture.planPath);
  const lockPath = `${absolutePlanPath}.execution.lock`;
  let priceCalls = 0;
  let modelCalls = 0;
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async (url) => {
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
          priceCalls += 1;
          if (priceCalls === 2) {
            const externalPlan = readJson(fixture.planPath);
            externalPlan.videoTitle += '（权威报价期间外部修改）';
            fs.writeFileSync(
              absolutePlanPath,
              `${JSON.stringify(externalPlan, null, 2)}\n`,
            );
          }
          return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
        }
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) modelCalls += 1;
        throw new Error('不应进入模型提交');
      },
    }),
    /执行期间被其他进程修改|计划.*已变更|计划.*不一致|未通过submit完整门禁/,
  );
  assert.equal(priceCalls, 2, '必须进入单镜提交前的第二次服务端报价。');
  assert.equal(modelCalls, 0);
  assert.equal(fs.existsSync(lockPath), false);
});

retiredLegacyRunnerTest('首镜实际费用抬高后会停止后续新提交', async (t) => {
  const fixture = createPlanFixture(t, {
    maxAmountCny: 4.5,
    maxPerShotCny: 3.5,
  });
  const calls = [];
  const remoteUrl = 'https://cdn.runninghub.example/G01.mp4?secret=hidden';
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      return jsonResponse({
        taskId: 'task-G01',
        status: 'SUCCESS',
        results: [{outputType: 'mp4', url: remoteUrl}],
        usage: {consumeMoney: '3'},
      });
    }
    if (url === remoteUrl) return binaryResponse(Buffer.from('mock-video-G01'));
    throw new Error(`未预期的模拟请求：${url}`);
  };
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 1,
    }),
    /实际费用加剩余预估为5元，超过授权总额4.5元；已停止后续新提交/,
  );
  assert.equal(
    calls.filter((url) => url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)).length,
    4,
  );
  assert.equal(
    calls.filter((url) => url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)).length,
    1,
  );
  const updated = readJson(fixture.planPath);
  assert.equal(updated.shots[0].output.providerTaskId, 'task-G01');
  assert.equal(updated.shots[1].output.providerTaskId, null);
  assert.equal(updated.productionStatus, 'cost-reauthorization-required');
  assert.equal(updated.costLimitStop.type, 'forecast');
});

retiredLegacyRunnerTest('单镜实际费用超过单镜授权时即使已经下载也不得正常完成', async (t) => {
  const fixture = createPlanFixture(t, {
    shotCount: 1,
    maxAmountCny: 4,
    maxPerShotCny: 2.5,
  });
  const remoteUrl = 'https://cdn.runninghub.example/G01-over-limit.mp4';
  const fetchImpl = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      return jsonResponse({
        taskId: 'task-G01-over-limit',
        status: 'SUCCESS',
        results: [{outputType: 'mp4', url: remoteUrl}],
        usage: {consumeMoney: '3'},
      });
    }
    if (url === remoteUrl) return binaryResponse(Buffer.from('mock-over-limit'));
    throw new Error(`未预期的模拟请求：${url}`);
  };
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 1,
    }),
    /实际费用3元超过单镜授权上限2.5元；已记录本次实际扣费并停止/,
  );
  const updated = readJson(fixture.planPath);
  assert.equal(updated.productionStatus, 'cost-limit-breached');
  assert.equal(updated.costLimitStop.shotId, 'G01');
  assert.equal(updated.shots[0].output.chargedCostCny, 3);
  assert.equal(
    fs.existsSync(path.resolve(projectRoot, updated.shots[0].output.videoPath)),
    true,
  );
});

retiredLegacyRunnerTest('第二镜提交前重新报价上涨时停止且不复用陈旧报价', async (t) => {
  const fixture = createPlanFixture(t, {
    maxAmountCny: 5,
    maxPerShotCny: 2.5,
  });
  let priceCalls = 0;
  let paidSubmitCalls = 0;
  const remoteUrl = 'https://cdn.runninghub.example/G01-fresh-price.mp4';
  const fetchImpl = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      priceCalls += 1;
      return jsonResponse({
        estimatedPrice: priceCalls <= 3 ? 2 : 3,
        currency: 'CNY',
      });
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      paidSubmitCalls += 1;
      return jsonResponse({
        taskId: 'task-G01-fresh-price',
        status: 'SUCCESS',
        results: [{outputType: 'mp4', url: remoteUrl}],
        usage: {consumeMoney: '2'},
      });
    }
    if (url === remoteUrl) return binaryResponse(Buffer.from('fresh-price-G01'));
    throw new Error(`未预期的模拟请求：${url}`);
  };
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 1,
    }),
    /镜头G02提交前最新预估3元超过单镜授权上限2.5元/,
  );
  assert.equal(priceCalls, 4);
  assert.equal(paidSubmitCalls, 1);
  const updated = readJson(fixture.planPath);
  assert.equal(updated.productionStatus, 'cost-reauthorization-required');
  assert.equal(updated.shots[1].output.providerTaskId, null);
});

for (const billingCase of [
  {name: '缺失', usage: undefined},
  {name: '负数', usage: {consumeMoney: '-1'}},
]) {
  retiredLegacyRunnerTest(`首镜实际费用${billingCase.name}时停止后续付费且不拿预估冒充实扣`, async (t) => {
    const fixture = createPlanFixture(t, {
      maxAmountCny: 5,
      maxPerShotCny: 2.5,
    });
    let paidSubmitCalls = 0;
    const remoteUrl = `https://cdn.runninghub.example/billing-${billingCase.name}.mp4`;
    const fetchImpl = async (url) => {
      if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
        return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
      }
      if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
        paidSubmitCalls += 1;
        return jsonResponse({
          taskId: `task-billing-${billingCase.name}`,
          status: 'SUCCESS',
          results: [{outputType: 'mp4', url: remoteUrl}],
          ...(billingCase.usage ? {usage: billingCase.usage} : {}),
        });
      }
      if (url === remoteUrl) {
        return binaryResponse(Buffer.from(`billing-${billingCase.name}`));
      }
      throw new Error(`未预期的模拟请求：${url}`);
    };
    await assert.rejects(
      runPlan({
        planPath: fixture.planPath,
        apiKey: 'test-only-key',
        confirmPaid: true,
        fetchImpl,
        pollIntervalMs: 0,
        maximumPollCount: 1,
      }),
      /未返回可核对的非负实际费用/,
    );
    assert.equal(paidSubmitCalls, 1);
    const updated = readJson(fixture.planPath);
    assert.equal(updated.productionStatus, 'billing-reconciliation-required');
    assert.equal(updated.shots[0].output.chargedCostCny, null);
    assert.equal(updated.shots[0].output.costBasis, 'unconfirmed');
    assert.equal(updated.shots[1].output.providerTaskId, null);
  });
}

retiredLegacyRunnerTest('最后一镜使累计实际费用超总授权时不得返回 downloaded', async (t) => {
  const fixture = createPlanFixture(t, {
    maxAmountCny: 4.5,
    maxPerShotCny: 3.5,
  });
  let submitIndex = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      submitIndex += 1;
      const shotId = `G${String(submitIndex).padStart(2, '0')}`;
      return jsonResponse({
        taskId: `task-${shotId}-total-limit`,
        status: 'SUCCESS',
        results: [{
          outputType: 'mp4',
          url: `https://cdn.runninghub.example/${shotId}-total-limit.mp4`,
        }],
        usage: {consumeMoney: submitIndex === 1 ? '2' : '3'},
      });
    }
    if (url.startsWith('https://cdn.runninghub.example/')) {
      return binaryResponse(Buffer.from(`mock-total-limit-${submitIndex}`));
    }
    throw new Error(`未预期的模拟请求：${url}`);
  };
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl,
      pollIntervalMs: 0,
      maximumPollCount: 1,
    }),
    /累计实际费用5元超过授权总额4.5元/,
  );
  const updated = readJson(fixture.planPath);
  assert.equal(updated.productionStatus, 'cost-limit-breached');
  assert.equal(updated.costLimitStop.shotId, 'G02');
  assert.equal(updated.costLimitStop.accumulatedActualCostCny, 5);
});

retiredLegacyRunnerTest('费用批准未绑定修改后的拆镜定义时网络调用为零', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const changed = readJson(fixture.planPath);
  changed.shots[0].selectionReason += '定义被修改';
  changed.shots[0].promptCore.compiledPrompt = compileShotPrompt(
    changed,
    style,
    changed.shots[0],
  );
  fs.writeFileSync(
    path.resolve(projectRoot, fixture.planPath),
    `${JSON.stringify(changed, null, 2)}\n`,
  );
  let networkCalls = 0;
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async () => {
        networkCalls += 1;
        throw new Error('不应联网');
      },
    }),
    /generationDefinitionSha256/,
  );
  assert.equal(networkCalls, 0);
});

retiredLegacyRunnerTest('报价路径与视觉方案冲突时原文件不变且网络调用为零', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const changed = readJson(fixture.planPath);
  changed.outputs.quotePath = changed.visualPlan;
  const visualAbsolute = path.resolve(projectRoot, changed.visualPlan);
  const before = fs.readFileSync(visualAbsolute);
  fs.writeFileSync(
    path.resolve(projectRoot, fixture.planPath),
    `${JSON.stringify(changed, null, 2)}\n`,
  );
  let networkCalls = 0;
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async () => {
        networkCalls += 1;
        throw new Error('不应联网');
      },
    }),
    /不得覆盖计划、风格卡或V8视觉方案|必须固定为/,
  );
  assert.equal(networkCalls, 0);
  assert.deepEqual(fs.readFileSync(visualAbsolute), before);
});

retiredLegacyRunnerTest('任务输出目录经过符号链接时在联网前失败', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1});
  const workflowRoot = path.dirname(
    path.resolve(projectRoot, fixture.plan.outputs.ledgerPath),
  );
  fs.mkdirSync(path.dirname(workflowRoot), {recursive: true});
  fs.symlinkSync(fixture.absoluteRoot, workflowRoot, 'dir');
  let networkCalls = 0;
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async () => {
        networkCalls += 1;
        throw new Error('不应联网');
      },
    }),
    /路径不得经过符号链接/,
  );
  assert.equal(networkCalls, 0);
});

retiredLegacyRunnerTest('同一approvalId已有消费回执但账本缺失时禁止再次付费提交', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1, maxAmountCny: 3});
  const remoteUrl = 'https://cdn.runninghub.example/receipt-guard.mp4';
  const firstFetch = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      return jsonResponse({
        taskId: 'task-receipt-guard',
        status: 'SUCCESS',
        results: [{outputType: 'mp4', url: remoteUrl}],
        usage: {consumeMoney: '2'},
      });
    }
    if (url === remoteUrl) return binaryResponse(Buffer.from('receipt-guard'));
    throw new Error(`未预期的模拟请求：${url}`);
  };
  await runPlan({
    planPath: fixture.planPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl: firstFetch,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  });
  const replay = readJson(fixture.planPath);
  replay.productionStatus = 'submitted';
  replay.shots[0].output.providerTaskId = null;
  replay.shots[0].output.sha256 = null;
  replay.shots[0].output.attemptCount = 0;
  replay.shots[0].output.chargedCostCny = null;
  fs.rmSync(path.resolve(projectRoot, replay.outputs.ledgerPath), {force: true});
  fs.rmSync(path.resolve(projectRoot, replay.shots[0].output.videoPath), {force: true});
  fs.writeFileSync(
    path.resolve(projectRoot, fixture.planPath),
    `${JSON.stringify(replay, null, 2)}\n`,
  );
  let paidSubmitCalls = 0;
  await assert.rejects(
    runPlan({
      planPath: fixture.planPath,
      apiKey: 'test-only-key',
      confirmPaid: true,
      fetchImpl: async (url) => {
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
          return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
        }
        if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
          paidSubmitCalls += 1;
        }
        throw new Error('不应进入付费提交');
      },
    }),
    /已有消费回执但当前任务账本缺失，禁止重新提交/,
  );
  assert.equal(paidSubmitCalls, 0);
});

retiredLegacyRunnerTest('任务已下载但计划写回中断时只从同一账本恢复证据且不再付费', async (t) => {
  const fixture = createPlanFixture(t, {shotCount: 1, maxAmountCny: 3});
  const remoteUrl = 'https://cdn.runninghub.example/writeback-recovery.mp4';
  const firstFetch = async (url) => {
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      return jsonResponse({
        taskId: 'task-writeback-recovery',
        status: 'SUCCESS',
        results: [{outputType: 'mp4', url: remoteUrl}],
        usage: {consumeMoney: '2'},
      });
    }
    if (url === remoteUrl) return binaryResponse(Buffer.from('writeback-recovery'));
    throw new Error(`未预期的模拟请求：${url}`);
  };
  await runPlan({
    planPath: fixture.planPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl: firstFetch,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  });

  const interrupted = readJson(fixture.planPath);
  interrupted.productionStatus = 'submitted';
  interrupted.outputs.approvalReceiptPath = null;
  interrupted.outputs.approvalReceiptSha256 = null;
  interrupted.shots[0].output.providerTaskId = null;
  interrupted.shots[0].output.sha256 = null;
  interrupted.shots[0].output.attemptCount = 0;
  interrupted.shots[0].output.chargedCostCny = null;
  interrupted.shots[0].output.costBasis = null;
  fs.writeFileSync(
    path.resolve(projectRoot, fixture.planPath),
    `${JSON.stringify(interrupted, null, 2)}\n`,
  );

  let networkCalls = 0;
  const recovered = await runPlan({
    planPath: fixture.planPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl: async () => {
      networkCalls += 1;
      throw new Error('既有任务恢复不应联网或再次付费');
    },
  });
  assert.equal(networkCalls, 0);
  assert.equal(recovered.submittedCount, 0);
  assert.equal(recovered.productionStatus, 'downloaded');
  const updated = readJson(fixture.planPath);
  assert.equal(updated.shots[0].output.providerTaskId, 'task-writeback-recovery');
  assert.equal(updated.shots[0].output.attemptCount, 1);
  assert.equal(updated.shots[0].output.chargedCostCny, 2);
  assert.match(updated.shots[0].output.sha256, /^[a-f0-9]{64}$/);
  assert.match(updated.outputs.approvalReceiptSha256, /^[a-f0-9]{64}$/);
});

retiredLegacyRunnerTest('合法批次先完成全量报价，再逐镜各提交一次并同步本地结果', async (t) => {
  const fixture = createPlanFixture(t, {maxAmountCny: 4.5});
  const calls = [];
  let submitIndex = 0;
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)) {
      return jsonResponse({estimatedPrice: 2, currency: 'CNY'});
    }
    if (url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)) {
      submitIndex += 1;
      const shotId = `G${String(submitIndex).padStart(2, '0')}`;
      return jsonResponse({
        taskId: `task-${shotId}`,
        status: 'SUCCESS',
        results: [{
          outputType: 'mp4',
          url: `https://cdn.runninghub.example/${shotId}.mp4?secret=hidden`,
        }],
        usage: {consumeMoney: '2'},
      });
    }
    if (url.startsWith('https://cdn.runninghub.example/')) {
      return binaryResponse(Buffer.from(`mock-video-${url.includes('G01') ? 'G01' : 'G02'}`));
    }
    throw new Error(`未预期的模拟请求：${url}`);
  };
  const result = await runPlan({
    planPath: fixture.planPath,
    apiKey: 'test-only-key',
    confirmPaid: true,
    fetchImpl,
    pollIntervalMs: 0,
    maximumPollCount: 1,
  });
  assert.equal(result.submittedCount, 2);
  assert.equal(result.productionStatus, 'downloaded');
  const firstSubmit = calls.findIndex((url) =>
    url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute),
  );
  assert.equal(
    firstSubmit,
    3,
    '必须先完成两镜全量报价和首镜权威复报，再出现第一次付费提交。',
  );
  assert.equal(
    calls.filter((url) => url.endsWith(RUNNINGHUB_H3_PROVIDER.pricePreviewRoute)).length,
    5,
  );
  assert.equal(
    calls.filter((url) => url.endsWith(RUNNINGHUB_H3_PROVIDER.modelRoute)).length,
    2,
  );
  const updated = readJson(fixture.planPath);
  assert.equal(updated.productionStatus, 'downloaded');
  assert.equal(
    updated.outputs.approvalReceiptPath,
    approvalReceiptRelativePathFor(updated.costAuthorization.approvalId),
  );
  assert.match(updated.outputs.approvalReceiptSha256, /^[a-f0-9]{64}$/);
  const approvalReceipt = readJson(updated.outputs.approvalReceiptPath);
  assert.equal(
    approvalReceipt.schemaVersion,
    'generated-video-approval-consumption/v1',
  );
  assert.equal(approvalReceipt.expiresAt, updated.costAuthorization.expiresAt);
  for (const shot of updated.shots) {
    assert.equal(shot.output.providerTaskId, `task-${shot.id}`);
    assert.equal(shot.output.attemptCount, 1);
    assert.equal(shot.output.chargedCostCny, 2);
    assert.match(shot.output.sha256, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(path.resolve(projectRoot, shot.output.videoPath)), true);
  }
  updated.shots[0].selectionReason += '（测试定义已变化）';
  updated.shots[0].promptCore.compiledPrompt = compileShotPrompt(
    updated,
    style,
    updated.shots[0],
  );
  fs.writeFileSync(
    path.resolve(projectRoot, fixture.planPath),
    `${JSON.stringify(updated, null, 2)}\n`,
  );
  assert.throws(
    () => readPlanStatus({planPath: fixture.planPath}),
    /任务账本与当前拆镜、提示词或输出定义不一致/,
  );
});
