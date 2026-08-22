import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

import {
  approvalReceiptRelativePathFor,
  buildH3RequestDefinition,
  compileShotPrompt,
  generatedVideoMediaRootFor,
  generatedVideoPlanPathFor,
  generatedVideoRenderSourceFor,
  generatedVideoWorkflowRootFor,
  generationDefinitionSha256,
  sha256File,
  stableJsonSha256,
  validateGeneratedVideoPlan,
} from './generated-video-plan-core.mjs';
import {
  applyGeneratedVideoVisualReview,
  prepareGeneratedVideoQa,
} from './qa-generated-video-plan.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.resolve(projectRoot, relativePath), 'utf8'));
const style = readJson('workflow/style-library/koubo-paper-construct-v1.json');
const template = readJson('templates/08-generated-video-plan-template.json');
const clone = (value) => JSON.parse(JSON.stringify(value));

const run = (binary, args) => {
  const result = spawnSync(binary, args, {encoding: 'utf8'});
  if (result.status !== 0) {
    throw new Error(`${binary}测试准备失败：${result.stderr || result.stdout}`);
  }
};

test('真实 ffprobe/ffmpeg 联系表与逐镜视觉复核可把下载产物推进到 qa-passed', (t) => {
  const relativeRoot = `work/.generated-video-qa-test-${process.pid}`;
  const absoluteRoot = path.resolve(projectRoot, relativeRoot);
  fs.mkdirSync(absoluteRoot, {recursive: true});

  const planId = `qa-contract-test-${process.pid}`;
  const videoId = `QA_CONTRACT_TEST_${process.pid}`;
  const workflowRoot = generatedVideoWorkflowRootFor(planId);
  const mediaRoot = generatedVideoMediaRootFor(videoId, planId);
  const planPath = generatedVideoPlanPathFor(videoId);
  const approvalId = `approval-qa-test-${process.pid}`;
  const approvalReceiptPath = approvalReceiptRelativePathFor(approvalId);
  const videoPath = `${mediaRoot}/G01.mp4`;
  fs.mkdirSync(path.dirname(path.resolve(projectRoot, videoPath)), {recursive: true});
  t.after(() => {
    fs.rmSync(absoluteRoot, {recursive: true, force: true});
    fs.rmSync(path.resolve(projectRoot, workflowRoot), {recursive: true, force: true});
    fs.rmSync(path.resolve(projectRoot, mediaRoot), {recursive: true, force: true});
    fs.rmSync(path.resolve(projectRoot, `edit/${videoId}`), {recursive: true, force: true});
    fs.rmSync(path.resolve(projectRoot, approvalReceiptPath), {force: true});
  });
  run('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=#D0C3B3:s=1920x1080:r=2:d=6',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    path.resolve(projectRoot, videoPath),
  ]);

  const plan = clone(template);
  plan.planId = planId;
  plan.videoId = videoId;
  plan.videoTitle = '纸构推演QA测试';
  plan.planPath = planPath;
  plan.productionStatus = 'downloaded';
  plan.visualPlan = `${relativeRoot}/visual-plan.json`;
  plan.outputs = {
    rootDir: mediaRoot,
    ledgerPath: `${workflowRoot}/generation-ledger.json`,
    quotePath: `${workflowRoot}/latest-quote.json`,
    approvalReceiptPath: null,
    approvalReceiptSha256: null,
    contactSheetPath: `${workflowRoot}/contact-sheet.jpg`,
    qaReportPath: `${workflowRoot}/qa-report.json`,
  };
  plan.costAuthorization = {
    status: 'approved',
    approvalId,
    approvedBy: '测试用户',
    approvedAt: '2026-08-22T09:20:00.000Z',
    expiresAt: '2026-08-23T09:20:00.000Z',
    scope: {type: 'plan-only', planId: plan.planId, definitionSha256: null},
    maxPerShotCny: 3.1,
    maxAmountCny: 3.1,
    currency: 'CNY',
    maxAttemptsPerShot: 1,
    automaticRetry: false,
  };
  const shot = clone(template.shots[0]);
  shot.id = 'G01';
  shot.requestId = 'G01';
  shot.layerId = 'provider-layer-G01';
  shot.spokenAnchor = {
    text: '散乱的信息被一个看得见的结构重新组织起来。',
    startSeconds: 0,
    endSeconds: 5,
  };
  shot.selectionReason = '这是抽象机制，只用纸构动作作概念演绎。';
  shot.causalChain = {
    initialState: '暖纸色卡片停在滑轨左侧。',
    physicalCause: '海军蓝推杆贴住卡片左缘施力。',
    resultState: '同一张卡片进入砖红归档槽。',
  };
  shot.singleAction = {
    actions: [{
      verb: '推动',
      actor: '海军蓝推杆',
      object: '暖纸色卡片',
      visibleCause: '推杆始终贴住卡片左缘',
      visibleEffect: '卡片沿直线进入归档槽',
    }],
  };
  shot.mechanism = 'slide';
  shot.composition = {
    view: 'front-miniature',
    mainSubject: '一张暖纸色卡片',
    mainSubjectCount: 1,
    negativeSpace: '上方与两侧保留纸面负空间',
    subtitleSafeBottomRatio: 0.18,
    labels: 'blank-remotion-later',
  };
  shot.camera = {movement: 'fixed', framing: '正面中近景微缩舞台'};
  shot.continuity = {
    objectIdentityLock: '同一张暖纸色卡片，数量和颜色不变',
    shapeLock: '始终保持同一矩形纸板形状',
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
    openingFrame: '卡片停在左侧，推杆贴住左边缘',
    actionInstruction: '推杆只推动这一张卡进入归档槽',
    closingFrame: '同一张卡入槽后稳定停留',
    compiledPrompt: '',
  };
  shot.output = {
    providerTaskId: 'task-qa-test',
    videoPath,
    sha256: sha256File(videoPath),
    attemptCount: 1,
    chargedCostCny: 3,
    probe: {width: null, height: null, durationSeconds: null, fps: null, codec: null},
  };
  shot.qa = clone(template.shots[0].qa);
  shot.fallback = 'speaker-plus-information';
  shot.promptCore.compiledPrompt = compileShotPrompt(plan, style, shot);
  plan.shots = [shot];

  const visualPlan = {
    schemaVersion: 4,
    experiment: {id: 'v8-semantic-continuity-sfx'},
    videoId: plan.videoId,
    styleReferenceIds: ['koubo-paper-construct-v1'],
    layers: [{
      id: shot.layerId,
      start: shot.spokenAnchor.startSeconds,
      end: shot.spokenAnchor.endSeconds,
      spokenLine: shot.spokenAnchor.text,
      purpose: 'concept-illustration',
      asset: {sourceType: 'provider-generated-video', source: videoPath},
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
    }],
  };
  fs.writeFileSync(
    path.resolve(projectRoot, plan.visualPlan),
    `${JSON.stringify(visualPlan, null, 2)}\n`,
  );
  plan.costAuthorization.scope.definitionSha256 =
    generationDefinitionSha256(plan);
  fs.mkdirSync(
    path.dirname(path.resolve(projectRoot, plan.outputs.ledgerPath)),
    {recursive: true},
  );
  fs.writeFileSync(
    path.resolve(projectRoot, plan.outputs.ledgerPath),
    `${JSON.stringify({
      schemaVersion: 1,
      planId: plan.planId,
      planSha256: generationDefinitionSha256(plan),
      provider: 'RunningHub',
      providerId: 'runninghub-minimax-h3-2k',
      model: 'MiniMax-H3',
      authorization: clone(plan.costAuthorization),
      policy: {
        maximumPaidAttemptsPerShot: 1,
        automaticPaidRetryAllowed: false,
      },
      attempts: {
        G01: {
          shotId: 'G01',
          attemptNumber: 1,
          status: 'downloaded',
          taskId: shot.output.providerTaskId,
          providerId: 'runninghub-minimax-h3-2k',
          model: 'MiniMax-H3',
          modelRoute: '/openapi/v2/minimax/hailuo-h3/multimodal-to-video',
          resolution: '2K',
          ratio: '16:9',
          durationSeconds: shot.timing.durationSeconds,
          requestSha256: stableJsonSha256(buildH3RequestDefinition(shot)),
          promptSha256: createHash('sha256')
            .update(Buffer.from(shot.promptCore.compiledPrompt))
            .digest('hex'),
          maximumCostCny: plan.costAuthorization.maxPerShotCny,
          currency: 'CNY',
          outputPath: path.resolve(projectRoot, shot.output.videoPath),
          outputSha256: shot.output.sha256,
          actualCostCny: shot.output.chargedCostCny,
          actualCostStatus: 'reported',
          authorization: clone(plan.costAuthorization),
        },
      },
    }, null, 2)}\n`,
  );
  fs.mkdirSync(path.dirname(path.resolve(projectRoot, approvalReceiptPath)), {
    recursive: true,
  });
  fs.writeFileSync(
    path.resolve(projectRoot, approvalReceiptPath),
    `${JSON.stringify({
      schemaVersion: 'generated-video-approval-consumption/v1',
      approvalId: plan.costAuthorization.approvalId,
      planId: plan.planId,
      definitionSha256: generationDefinitionSha256(plan),
      approvedBy: plan.costAuthorization.approvedBy,
      approvedAt: plan.costAuthorization.approvedAt,
      expiresAt: plan.costAuthorization.expiresAt,
      maxPerShotCny: plan.costAuthorization.maxPerShotCny,
      maxAmountCny: plan.costAuthorization.maxAmountCny,
      currency: plan.costAuthorization.currency,
      ledgerPath: path.resolve(projectRoot, plan.outputs.ledgerPath),
      providerId: 'runninghub-minimax-h3-2k',
      consumedAt: '2026-08-22T09:21:00.000Z',
    }, null, 2)}\n`,
  );
  plan.outputs.approvalReceiptPath = approvalReceiptPath;
  plan.outputs.approvalReceiptSha256 = sha256File(approvalReceiptPath);
  fs.mkdirSync(path.dirname(path.resolve(projectRoot, planPath)), {recursive: true});
  fs.writeFileSync(
    path.resolve(projectRoot, planPath),
    `${JSON.stringify(plan, null, 2)}\n`,
  );

  const absolutePlanPath = path.resolve(projectRoot, planPath);
  const planLockPath = `${absolutePlanPath}.execution.lock`;
  const planBytesBeforeCollision = fs.readFileSync(absolutePlanPath);
  fs.writeFileSync(planLockPath, '{"test":"busy"}\n');
  assert.throws(
    () => prepareGeneratedVideoQa({planPath}),
    /禁止并发QA写回/,
  );
  fs.rmSync(planLockPath, {force: true});
  assert.deepEqual(fs.readFileSync(absolutePlanPath), planBytesBeforeCollision);

  const externallyChangedPlan = clone(plan);
  externallyChangedPlan.videoTitle = '外部进程在QA期间改了计划';
  assert.throws(
    () =>
      prepareGeneratedVideoQa({
        planPath,
        beforeQaMutation: () => {
          fs.writeFileSync(
            absolutePlanPath,
            `${JSON.stringify(externallyChangedPlan, null, 2)}\n`,
          );
        },
      }),
    /QA期间被其他进程修改/,
  );
  assert.equal(fs.existsSync(planLockPath), false, 'QA失败后必须释放计划锁。');
  fs.writeFileSync(absolutePlanPath, planBytesBeforeCollision);

  assert.throws(
    () =>
      prepareGeneratedVideoQa({
        planPath,
        now: () => '2026-08-22T09:21:00.000Z',
        beforeQaMutation: (candidatePlan) => {
          candidatePlan.outputs.qaReportPath = candidatePlan.planPath;
        },
      }),
    /QA写入前计划安全复核失败|不得覆盖|MANAGED_PATH_COLLISION/,
  );
  assert.deepEqual(
    fs.readFileSync(path.resolve(projectRoot, planPath)),
    planBytesBeforeCollision,
    'QA碰撞失败注入不得改动原计划任何字节。',
  );

  const pendingReview = prepareGeneratedVideoQa({
    planPath,
    now: () => '2026-08-22T09:21:00.000Z',
  });
  assert.equal(pendingReview.status, 'pending-visual-review');
  assert.equal(
    fs.existsSync(path.resolve(projectRoot, plan.outputs.contactSheetPath)),
    true,
  );
  const preparedPlan = readJson(planPath);
  assert.equal(preparedPlan.productionStatus, 'qa-review-required');
  assert.equal(preparedPlan.shots[0].output.probe.width, 1920);
  assert.equal(preparedPlan.shots[0].output.probe.height, 1080);

  pendingReview.status = 'passed';
  pendingReview.reviewer = 'codex-vision-test';
  pendingReview.reviewerKind = 'codex-vision';
  pendingReview.reviewerModel = 'test-vision-model';
  pendingReview.reviewerVersion = '1';
  pendingReview.reviewedAt = '2026-08-22T09:22:00.000Z';
  pendingReview.shots[0].decision = 'passed';
  for (const key of Object.keys(pendingReview.shots[0].checks)) {
    pendingReview.shots[0].checks[key] = true;
  }
  fs.writeFileSync(
    path.resolve(projectRoot, plan.outputs.qaReportPath),
    `${JSON.stringify(pendingReview, null, 2)}\n`,
  );
  assert.throws(
    () =>
      applyGeneratedVideoVisualReview({
        planPath,
        reviewPath: plan.outputs.qaReportPath,
      }),
    /缺少逐项观察结论/,
  );
  for (const key of Object.keys(pendingReview.shots[0].checks)) {
    pendingReview.shots[0].observations[key] = `已检查${key}，测试回执为通过。`;
  }
  fs.writeFileSync(
    path.resolve(projectRoot, plan.outputs.qaReportPath),
    `${JSON.stringify(pendingReview, null, 2)}\n`,
  );
  const result = applyGeneratedVideoVisualReview({
    planPath,
    reviewPath: plan.outputs.qaReportPath,
  });
  assert.equal(result.status, 'qa-passed');
  const passedPlan = readJson(planPath);
  assert.equal(passedPlan.productionStatus, 'qa-passed');
  assert.equal(passedPlan.shots[0].qa.visualReview.reviewer, 'codex-vision-test');
  assert.equal(
    validateGeneratedVideoPlan(passedPlan, style, {phase: 'materialized'}).ok,
    true,
  );

  const changedDefinition = clone(passedPlan);
  changedDefinition.shots[0].selectionReason += '（语义定义被修改）';
  changedDefinition.shots[0].promptCore.compiledPrompt = compileShotPrompt(
    changedDefinition,
    style,
    changedDefinition.shots[0],
  );
  changedDefinition.costAuthorization.scope.definitionSha256 =
    generationDefinitionSha256(changedDefinition);
  const changedDefinitionResult = validateGeneratedVideoPlan(
    changedDefinition,
    style,
    {phase: 'materialized'},
  );
  assert.equal(changedDefinitionResult.ok, false);
  assert.ok(
    changedDefinitionResult.errors.some(
      (error) => error.code === 'LEDGER_PLAN_SHA_MISMATCH',
    ),
  );
  assert.ok(
    changedDefinitionResult.errors.some((error) =>
      error.code.includes('QA_GENERATION_DEFINITION_SHA256_MISMATCH'),
    ),
  );

  const visualBefore = fs.readFileSync(path.resolve(projectRoot, plan.visualPlan));
  const changedVisualPlan = readJson(plan.visualPlan);
  changedVisualPlan.layers[0].directorNote = '测试修改视觉语义但不改输出路径';
  fs.writeFileSync(
    path.resolve(projectRoot, plan.visualPlan),
    `${JSON.stringify(changedVisualPlan, null, 2)}\n`,
  );
  const changedVisualResult = validateGeneratedVideoPlan(
    passedPlan,
    style,
    {phase: 'materialized'},
  );
  assert.equal(changedVisualResult.ok, false);
  assert.ok(
    changedVisualResult.errors.some((error) =>
      error.code.includes('QA_VISUAL_PLAN_SHA256_MISMATCH'),
    ),
  );
  fs.writeFileSync(path.resolve(projectRoot, plan.visualPlan), visualBefore);
});
