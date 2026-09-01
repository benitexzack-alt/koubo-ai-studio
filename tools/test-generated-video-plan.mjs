import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  approvalReceiptRelativePathFor,
  buildH3RequestDefinition,
  compileShotPrompt,
  generatedVideoMediaRootFor,
  generatedVideoPlanPathFor,
  generatedVideoRenderSourceFor,
  generatedVideoWorkflowRootFor,
  generatedVideoEvidenceBinding,
  generationDefinitionSha256,
  sha256File,
  stableJsonSha256,
  validateGeneratedVideoPlan,
} from './generated-video-plan-core.mjs';
import {findRetiredGeneratedStyleFingerprints} from './generated-style-policy.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(projectRoot, relativePath), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const style = readJson('workflow/style-library/koubo-paper-construct-v1.json');
const template = readJson('templates/08-generated-video-plan-template.json');
const bindingRootRelative = `work/.generated-video-binding-test-${process.pid}`;
const bindingRoot = resolve(projectRoot, bindingRootRelative);
const contractPlanId = `generated-video-plan-contract-test-${process.pid}`;
const contractVideoId = `CONTRACT_TEST_${process.pid}`;
const workflowRootRelative = generatedVideoWorkflowRootFor(contractPlanId);
const mediaRootRelative = generatedVideoMediaRootFor(contractVideoId, contractPlanId);
const VALIDATION_NOW = '2026-08-22T09:30:00.000Z';
mkdirSync(bindingRoot, {recursive: true});
process.on('exit', () => rmSync(bindingRoot, {recursive: true, force: true}));

const makeShot = (id, offsetSeconds = 0, mediaRoot = mediaRootRelative) => {
  const shot = clone(template.shots[0]);
  shot.id = id;
  shot.requestId = id;
  shot.layerId = `provider-layer-${id}`;
  shot.spokenAnchor = {
    text: `${id}：数据进入整理流程后，散乱信息被归到同一个结构里。`,
    startSeconds: offsetSeconds,
    endSeconds: offsetSeconds + 5,
  };
  shot.selectionReason = '这句话描述的是抽象信息如何被结构化，无法由真实界面单独证明，只作机制演绎。';
  shot.causalChain = {
    initialState: '三张暖纸色信息卡分散在纸板台面左侧。',
    physicalCause: '海军蓝纸板滑轨推动最前方的一张信息卡。',
    resultState: '同一张信息卡沿滑轨进入右侧砖红色归档槽并稳定停住。',
  };
  shot.singleAction = {
    actions: [
      {
        verb: '推动',
        actor: '海军蓝纸板滑轨',
        object: '最前方的暖纸色信息卡',
        visibleCause: '滑轨前端始终贴住信息卡左边缘向右施力',
        visibleEffect: '信息卡沿直线进入砖红色归档槽',
      },
    ],
  };
  shot.mechanism = 'slide';
  shot.composition = {
    view: 'front-miniature',
    mainSubject: '一张沿滑轨移动的暖纸色信息卡',
    mainSubjectCount: 1,
    negativeSpace: '画面上方与左右两侧保留纸面负空间',
    subtitleSafeBottomRatio: 0.18,
    labels: 'blank-remotion-later',
  };
  shot.camera = {
    movement: 'fixed',
    framing: '正面中近景微缩舞台，主物件完整可见',
  };
  shot.continuity = {
    objectIdentityLock: '信息卡始终为同一张暖纸色矩形卡，数量和颜色不变',
    shapeLock: '信息卡全程保持矩形纸板形状，不弯折、不融化、不增生',
    contactContinuity: '滑轨从接触信息卡左边缘到信息卡入槽前始终保持贴合',
  };
  shot.timing = {
    durationSeconds: 6,
    establish: {startSeconds: 0, endSeconds: 0.8},
    action: {startSeconds: 0.8, endSeconds: 5.2},
    finalHold: {startSeconds: 5.2, endSeconds: 6},
  };
  shot.promptCore = {
    concept: '散乱信息被结构化归档',
    visualMetaphor: '一张信息卡沿纸板滑轨进入归档槽',
    openingFrame: '三张信息卡分散在左侧，滑轨停在第一张卡片左边缘',
    actionInstruction: '滑轨只推动最前方的一张信息卡沿直线向右进入归档槽',
    closingFrame: '同一张信息卡完整进入归档槽，滑轨停止，画面稳定停留',
    compiledPrompt: '',
  };
  shot.output = {
    providerTaskId: null,
    videoPath: `${mediaRoot}/${id}.mp4`,
    sha256: null,
    attemptCount: 0,
    chargedCostCny: null,
    probe: {
      width: null,
      height: null,
      durationSeconds: null,
      fps: null,
      codec: null,
    },
  };
  shot.qa = {
    status: 'pending',
    contactSheetPath: null,
    reportPath: null,
    visualReview: {
      status: 'pending',
      reviewer: null,
      reviewedAt: null,
      contactSheetSha256: null,
    },
    sampleFractions: [0, 0.25, 0.5, 0.75, 1],
    checks: {
      styleSignature: false,
      singleAction: false,
      identityStable: false,
      shapeStable: false,
      contactContinuous: false,
      subtitleSafe: false,
      noForbiddenElements: false,
    },
  };
  shot.fallback = 'speaker-plus-information';
  return shot;
};

const compilePlan = (plan) => {
  for (const shot of plan.shots) {
    shot.promptCore.compiledPrompt = compileShotPrompt(plan, style, shot);
  }
  return plan;
};

const makePlan = (
  shotCount = 1,
  {
    planId = contractPlanId,
    videoId = contractVideoId,
    visualSuffix = `${shotCount}`,
  } = {},
) => {
  const workflowRoot = generatedVideoWorkflowRootFor(planId);
  const mediaRoot = generatedVideoMediaRootFor(videoId, planId);
  const plan = clone(template);
  plan.planId = planId;
  plan.videoId = videoId;
  plan.videoTitle = '纸构推演自动拆镜合同测试';
  plan.planPath = generatedVideoPlanPathFor(videoId);
  plan.productionStatus = 'planned';
  plan.costAuthorization.scope.planId = plan.planId;
  plan.outputs = {
    rootDir: mediaRoot,
    ledgerPath: `${workflowRoot}/generation-ledger.json`,
    quotePath: `${workflowRoot}/latest-quote.json`,
    approvalReceiptPath: null,
    approvalReceiptSha256: null,
    contactSheetPath: `${workflowRoot}/contact-sheet.jpg`,
    qaReportPath: `${workflowRoot}/qa-report.json`,
  };
  plan.shots = Array.from({length: shotCount}, (_, index) =>
    makeShot(
      `G${String(index + 1).padStart(2, '0')}`,
      index * 6,
      mediaRoot,
    ),
  );
  const visualPlanRelative = `${bindingRootRelative}/visual-plan-${visualSuffix}.json`;
  const visualPlan = {
    schemaVersion: 4,
    experiment: {id: 'v8-semantic-continuity-sfx'},
    videoId: plan.videoId,
    styleReferenceIds: ['koubo-paper-construct-v1'],
    layers: [
      ...plan.shots.map((shot) => ({
        id: shot.layerId,
        start: shot.spokenAnchor.startSeconds,
        end: shot.spokenAnchor.endSeconds,
        spokenLine: shot.spokenAnchor.text,
        purpose: 'concept-illustration',
        asset: {
          sourceType: 'provider-generated-video',
          source: shot.output.videoPath,
        },
        assetDecision: {
          class: 'generated-video',
          producer: 'codex-provider',
          requestId: shot.requestId,
          evidenceUse: 'illustration-only',
          styleReferenceId: 'koubo-paper-construct-v1',
          fallback: 'speaker-plus-information',
        },
        params: {
          src: generatedVideoRenderSourceFor(plan.videoId, plan.planId, shot.id),
          disclosure: 'AI生成·概念演绎',
          badge: '非真实业务证据',
        },
      })),
      {
        id: 'historical-user-generated-video',
        start: 90,
        end: 95,
        spokenLine: '历史用户提供生成片，仅用于回归过滤测试。',
        purpose: 'user-provided-context',
        asset: {
          sourceType: 'local-video',
          source: 'refs/historical-user-generated-video.mp4',
        },
        assetDecision: {
          class: 'generated-video',
          producer: 'user',
          evidenceUse: 'user-provided',
        },
      },
    ],
  };
  writeFileSync(
    resolve(projectRoot, visualPlanRelative),
    `${JSON.stringify(visualPlan, null, 2)}\n`,
  );
  plan.visualPlan = visualPlanRelative;
  return compilePlan(plan);
};

const validate = (plan, phase = 'plan', now = VALIDATION_NOW) =>
  validateGeneratedVideoPlan(plan, style, {phase, now: () => now});
const codes = (result) => new Set(result.errors.map((error) => error.code));
const assertPasses = (label, result) => {
  assert.equal(
    result.ok,
    true,
    `${label}应通过，但失败：\n${result.errors.map((error) => `[${error.code}] ${error.message}`).join('\n')}`,
  );
};
const assertFailsWithCode = (label, result, code) => {
  assert.equal(result.ok, false, `${label}应失败，但通过了。`);
  assert.ok(
    codes(result).has(code),
    `${label}应包含 ${code}，实际为：${[...codes(result)].join(', ')}`,
  );
};

const legalPlan = makePlan(1);
assertPasses(
  '一个纸构provider镜头与一个历史user生成片共存的合法单镜计划',
  validate(legalPlan),
);

const legalVisualPlanPath = resolve(projectRoot, legalPlan.visualPlan);
const legalVisualPlanBytes = readFileSync(legalVisualPlanPath);
for (const [label, mutate] of [
  ['自动生成图层缺少AI概念演绎声明', (layer) => delete layer.params.disclosure],
  ['自动生成图层证据徽标被篡改', (layer) => { layer.params.badge = '真实业务证据'; }],
  ['固定生成路径被错标为既有真实证据', (layer) => {
    layer.asset.sourceType = 'local-video';
    layer.assetDecision.class = 'real-evidence';
    layer.assetDecision.producer = 'existing';
    layer.assetDecision.evidenceUse = 'source-evidence';
  }],
]) {
  const changedVisualPlan = JSON.parse(legalVisualPlanBytes.toString('utf8'));
  mutate(changedVisualPlan.layers[0]);
  try {
    writeFileSync(
      legalVisualPlanPath,
      `${JSON.stringify(changedVisualPlan, null, 2)}\n`,
    );
    assertFailsWithCode(
      label,
      validate(legalPlan),
      'VISUAL_PLAN_PROVIDER_BOUNDARY_INVALID',
    );
  } finally {
    writeFileSync(legalVisualPlanPath, legalVisualPlanBytes);
  }
}

const variableShotPlan = makePlan(3);
assertPasses('可变三镜计划', validate(variableShotPlan));
assert.equal(variableShotPlan.shots.length, 3, '镜头数量不应固定为五镜。');

const secondPlanSameVideo = makePlan(1, {
  planId: `${contractPlanId}-second`,
  videoId: contractVideoId,
  visualSuffix: 'same-video-second-plan',
});
assertPasses('同一videoId的第二个计划', validate(secondPlanSameVideo));
assert.notEqual(
  legalPlan.outputs.rootDir,
  secondPlanSameVideo.outputs.rootDir,
  '同一videoId下不同planId必须使用不同媒体根目录。',
);
assert.notEqual(
  legalPlan.shots[0].output.videoPath,
  secondPlanSameVideo.shots[0].output.videoPath,
  '同一videoId下不同planId不得覆盖同一镜头文件。',
);

const planInsideRuntimeTree = clone(legalPlan);
planInsideRuntimeTree.planPath = `${workflowRootRelative}/frames/G01/plan.json`;
assertFailsWithCode(
  '计划文件落入QA运行产物树',
  validate(planInsideRuntimeTree),
  'PLAN_PATH_INVALID',
);

const qaReportCollidesWithPlan = clone(legalPlan);
qaReportCollidesWithPlan.outputs.qaReportPath = qaReportCollidesWithPlan.planPath;
assertFailsWithCode(
  'QA报告覆盖计划文件',
  validate(qaReportCollidesWithPlan),
  'MANAGED_PATH_COLLISION',
);

const mismatchedLayer = clone(legalPlan);
mismatchedLayer.shots[0].layerId = 'missing-provider-layer';
assertFailsWithCode(
  '视觉方案图层错配',
  validate(mismatchedLayer),
  'VISUAL_PLAN_LAYER_BINDING_MISSING',
);

const outsideProjectOutput = clone(legalPlan);
outsideProjectOutput.shots[0].output.videoPath = '/tmp/forbidden-generated-video.mp4';
assertFailsWithCode(
  '输出路径越出口播项目',
  validate(outsideProjectOutput),
  'SHOT_OUTPUT_PATH_OUTSIDE_PROJECT',
);

for (const shot of variableShotPlan.shots) {
  const compiled = shot.promptCore.compiledPrompt;
  for (const token of style.promptContract.requiredLiteralTokens) {
    assert.ok(compiled.includes(token), `${shot.id} 完整提示词缺少风格锁词：${token}`);
  }
  assert.equal(
    compiled,
    compileShotPrompt(variableShotPlan, style, shot),
    `${shot.id} 提示词必须由当前镜头变量和完整风格锁独立编译。`,
  );
}

const multipleActions = clone(legalPlan);
multipleActions.shots[0].singleAction.actions.push({
  verb: '翻开',
  actor: '机械臂',
  object: '另一张卡片',
  visibleCause: '机械臂接触卡片边缘',
  visibleEffect: '另一张卡片被翻开',
});
assertFailsWithCode(
  '单镜多动作',
  validate(multipleActions),
  'SINGLE_ACTION_REQUIRED',
);

const sourceEvidence = clone(legalPlan);
sourceEvidence.shots[0].evidenceUse = 'source-evidence';
assertFailsWithCode(
  '来源证据用途',
  validate(sourceEvidence),
  'EVIDENCE_USE_FORBIDDEN',
);

const missingContact = clone(legalPlan);
missingContact.shots[0].continuity.contactContinuity = '';
missingContact.shots[0].promptCore.compiledPrompt = compileShotPrompt(
  missingContact,
  style,
  missingContact.shots[0],
);
assertFailsWithCode(
  '缺少接触连续性',
  validate(missingContact),
  'CONTINUITY_LOCK_INCOMPLETE',
);

const shortHold = clone(legalPlan);
shortHold.shots[0].timing.action.endSeconds = 5.5;
shortHold.shots[0].timing.finalHold.startSeconds = 5.5;
shortHold.shots[0].promptCore.compiledPrompt = compileShotPrompt(
  shortHold,
  style,
  shortHold.shots[0],
);
assertFailsWithCode(
  '结尾停留不足',
  validate(shortHold),
  'FINAL_HOLD_TOO_SHORT',
);

const shorthand = clone(legalPlan);
shorthand.shots[0].promptCore.actionInstruction = '同上';
shorthand.shots[0].promptCore.compiledPrompt = compileShotPrompt(
  shorthand,
  style,
  shorthand.shots[0],
);
assertFailsWithCode(
  '提示词省略表达',
  validate(shorthand),
  'PROMPT_SHORTHAND_FORBIDDEN',
);

assertFailsWithCode(
  '未批准费用即提交',
  validate(legalPlan, 'submit'),
  'COST_AUTHORIZATION_REQUIRED',
);

const approve = (plan) => {
  plan.productionStatus = 'ready-for-submit';
  plan.costAuthorization = {
    status: 'approved',
    approvalId: 'approval-contract-test-001',
    approvedBy: 'user-contract-test',
    approvedAt: '2026-08-22T14:30:00+08:00',
    expiresAt: '2026-08-23T14:30:00+08:00',
    scope: {
      type: 'plan-only',
      planId: plan.planId,
      definitionSha256: generationDefinitionSha256(plan),
    },
    maxPerShotCny: 3.1,
    maxAmountCny: 9.3,
    currency: 'CNY',
    maxAttemptsPerShot: 1,
    automaticRetry: false,
  };
  return plan;
};

const approvedPlan = approve(clone(legalPlan));
assertPasses('已授权提交计划', validate(approvedPlan, 'submit'));

const futureApproval = clone(approvedPlan);
futureApproval.costAuthorization.approvedAt = '2026-08-22T09:36:00.000Z';
futureApproval.costAuthorization.expiresAt = '2026-08-23T09:36:00.000Z';
assertFailsWithCode(
  '授权时间比当前时间未来超过五分钟',
  validate(futureApproval, 'submit'),
  'COST_APPROVED_AT_IN_FUTURE',
);

const expiredApproval = clone(approvedPlan);
expiredApproval.costAuthorization.approvedAt = '2026-08-21T08:00:00.000Z';
expiredApproval.costAuthorization.expiresAt = '2026-08-22T08:00:00.000Z';
assertFailsWithCode(
  '授权已超过有效期',
  validate(expiredApproval, 'submit'),
  'COST_AUTHORIZATION_EXPIRED',
);

const overlyLongApproval = clone(approvedPlan);
overlyLongApproval.costAuthorization.expiresAt = '2026-08-24T14:30:00+08:00';
assertFailsWithCode(
  '授权窗口超过二十四小时',
  validate(overlyLongApproval, 'submit'),
  'COST_AUTHORIZATION_WINDOW_INVALID',
);

const missingApprovalId = clone(approvedPlan);
missingApprovalId.costAuthorization.approvalId = '';
assertFailsWithCode(
  '费用授权缺少approvalId',
  validate(missingApprovalId, 'submit'),
  'COST_APPROVAL_ID_REQUIRED',
);

const missingPerShotLimit = clone(approvedPlan);
missingPerShotLimit.costAuthorization.maxPerShotCny = null;
assertFailsWithCode(
  '费用授权缺少单镜上限',
  validate(missingPerShotLimit, 'submit'),
  'COST_PER_SHOT_LIMIT_INVALID',
);

const missingOutput = clone(approvedPlan);
missingOutput.productionStatus = 'materialized';
assertFailsWithCode(
  '产物缺失',
  validate(missingOutput, 'materialized'),
  'SHOT_OUTPUT_MISSING',
);

const testRootRelative = workflowRootRelative;
const testRoot = resolve(projectRoot, testRootRelative);
const testMediaRoot = resolve(projectRoot, mediaRootRelative);
mkdirSync(testRoot, {recursive: true});
mkdirSync(testMediaRoot, {recursive: true});

try {
  const materialized = clone(approvedPlan);
  materialized.productionStatus = 'qa-passed';
  const ledgerPath = materialized.outputs.ledgerPath;
  const approvalReceiptPath = approvalReceiptRelativePathFor(
    materialized.costAuthorization.approvalId,
  );
  const globalContactSheetPath = materialized.outputs.contactSheetPath;
  const globalQaReportPath = materialized.outputs.qaReportPath;
  const videoPath = materialized.shots[0].output.videoPath;
  const shotContactSheetPath = `${testRootRelative}/G01-contact-sheet.jpg`;
  const shotQaReportPath = `${testRootRelative}/G01-qa.json`;

  writeFileSync(resolve(projectRoot, globalContactSheetPath), 'contact-sheet');
  writeFileSync(resolve(projectRoot, videoPath), 'fake-local-video-for-contract-test');
  writeFileSync(resolve(projectRoot, shotContactSheetPath), 'shot-contact-sheet');
  materialized.shots[0].output = {
    providerTaskId: 'runninghub-contract-test-task',
    videoPath,
    sha256: sha256File(videoPath),
    attemptCount: 1,
    chargedCostCny: 3.1,
    probe: {
      width: 2560,
      height: 1440,
      durationSeconds: 6,
      fps: 30,
      codec: 'h264',
    },
  };
  materialized.shots[0].qa = {
    status: 'passed',
    contactSheetPath: shotContactSheetPath,
    reportPath: shotQaReportPath,
    visualReview: {
      status: 'passed',
      reviewer: 'codex-vision-contract-test',
      reviewerKind: 'codex-vision',
      reviewerModel: 'contract-test-model',
      reviewerVersion: '1',
      reviewedAt: '2026-08-22T09:10:00.000Z',
      contactSheetSha256: sha256File(shotContactSheetPath),
    },
    sampleFractions: [0, 0.25, 0.5, 0.75, 1],
    checks: {
      styleSignature: true,
      singleAction: true,
      identityStable: true,
      shapeStable: true,
      contactContinuous: true,
      subtitleSafe: true,
      noForbiddenElements: true,
    },
  };
  const qaObservations = Object.fromEntries(
    Object.keys(materialized.shots[0].qa.checks).map((check) => [
      check,
      `已逐项复核${check}，测试证据为通过。`,
    ]),
  );
  const evidenceBinding = generatedVideoEvidenceBinding(materialized, style);
  mkdirSync(dirname(resolve(projectRoot, approvalReceiptPath)), {recursive: true});
  writeFileSync(
    resolve(projectRoot, approvalReceiptPath),
    `${JSON.stringify({
      schemaVersion: 'generated-video-approval-consumption/v1',
      approvalId: materialized.costAuthorization.approvalId,
      planId: materialized.planId,
      definitionSha256: evidenceBinding.generationDefinitionSha256,
      approvedBy: materialized.costAuthorization.approvedBy,
      approvedAt: materialized.costAuthorization.approvedAt,
      expiresAt: materialized.costAuthorization.expiresAt,
      maxPerShotCny: materialized.costAuthorization.maxPerShotCny,
      maxAmountCny: materialized.costAuthorization.maxAmountCny,
      currency: materialized.costAuthorization.currency,
      ledgerPath: resolve(projectRoot, ledgerPath),
      providerId: 'runninghub-minimax-h3-2k',
      consumedAt: '2026-08-22T09:00:00.000Z',
    }, null, 2)}\n`,
  );
  materialized.outputs.approvalReceiptPath = approvalReceiptPath;
  materialized.outputs.approvalReceiptSha256 = sha256File(approvalReceiptPath);
  writeFileSync(
    resolve(projectRoot, globalQaReportPath),
    `${JSON.stringify({
      schemaVersion: 'generated-video-visual-review/v1',
      planId: materialized.planId,
      ...evidenceBinding,
      status: 'passed',
      reviewer: 'codex-vision-contract-test',
      reviewerKind: 'codex-vision',
      reviewerModel: 'contract-test-model',
      reviewerVersion: '1',
      reviewedAt: '2026-08-22T09:10:00.000Z',
      contactSheetPath: globalContactSheetPath,
      contactSheetSha256: sha256File(globalContactSheetPath),
      shots: [{
        id: 'G01',
        decision: 'passed',
        checks: clone(materialized.shots[0].qa.checks),
        observations: clone(qaObservations),
        notes: '合同测试逐镜复核通过。',
        videoSha256: materialized.shots[0].output.sha256,
        contactSheetPath: shotContactSheetPath,
        contactSheetSha256: sha256File(shotContactSheetPath),
        reportPath: shotQaReportPath,
      }],
    }, null, 2)}\n`,
  );
  writeFileSync(
    resolve(projectRoot, shotQaReportPath),
    `${JSON.stringify({
      schemaVersion: 'generated-video-shot-qa/v1',
      planId: materialized.planId,
      shotId: 'G01',
      ...evidenceBinding,
      videoSha256: materialized.shots[0].output.sha256,
      preparedAt: '2026-08-22T09:09:00.000Z',
      status: 'passed',
      spokenAnchor: clone(materialized.shots[0].spokenAnchor),
      causalChain: clone(materialized.shots[0].causalChain),
      singleAction: clone(materialized.shots[0].singleAction),
      continuity: clone(materialized.shots[0].continuity),
      sampleFractions: [0, 0.25, 0.5, 0.75, 1],
      contactSheetPath: shotContactSheetPath,
      contactSheetSha256: sha256File(shotContactSheetPath),
      requiredChecks: clone(materialized.shots[0].qa.checks),
      visualReview: {
        ...clone(materialized.shots[0].qa.visualReview),
        observations: clone(qaObservations),
        notes: '合同测试逐镜复核通过。',
      },
    }, null, 2)}\n`,
  );
  writeFileSync(
    resolve(projectRoot, ledgerPath),
    `${JSON.stringify({
      schemaVersion: 1,
      provider: 'RunningHub',
      providerId: 'runninghub-minimax-h3-2k',
      model: 'MiniMax-H3',
      planId: materialized.planId,
      planSha256: generationDefinitionSha256(materialized),
      style: materialized.styleReference.id,
      authorization: clone(materialized.costAuthorization),
      policy: {
        maximumPaidAttemptsPerShot: 1,
        automaticPaidRetryAllowed: false,
      },
      attempts: {
        G01: {
          attemptNumber: 1,
          shotId: 'G01',
          status: 'downloaded',
          providerId: 'runninghub-minimax-h3-2k',
          model: 'MiniMax-H3',
          modelRoute: '/openapi/v2/minimax/hailuo-h3/multimodal-to-video',
          resolution: '2K',
          ratio: '16:9',
          durationSeconds: materialized.shots[0].timing.durationSeconds,
          requestSha256: stableJsonSha256(
            buildH3RequestDefinition(materialized.shots[0]),
          ),
          promptSha256: createHash('sha256')
            .update(
              Buffer.from(
                buildH3RequestDefinition(materialized.shots[0]).prompt,
              ),
            )
            .digest('hex'),
          maximumCostCny: materialized.costAuthorization.maxPerShotCny,
          currency: materialized.costAuthorization.currency,
          taskId: materialized.shots[0].output.providerTaskId,
          outputPath: resolve(projectRoot, videoPath),
          outputSha256: materialized.shots[0].output.sha256,
          actualCostStatus: 'reported',
          actualCostCny: materialized.shots[0].output.chargedCostCny,
          authorization: clone(materialized.costAuthorization),
        },
      },
    }, null, 2)}\n`,
  );
  assertPasses('已物化且 QA 通过', validate(materialized, 'materialized'));

  const validGlobalQaBytes = readFileSync(resolve(projectRoot, globalQaReportPath));
  const globalQaWithoutObservations = JSON.parse(validGlobalQaBytes.toString('utf8'));
  globalQaWithoutObservations.shots[0].observations = {};
  writeFileSync(
    resolve(projectRoot, globalQaReportPath),
    `${JSON.stringify(globalQaWithoutObservations, null, 2)}\n`,
  );
  assertFailsWithCode(
    '全局QA空壳报告不得冒充逐项视觉复核',
    validate(materialized, 'materialized'),
    'QA_REPORT_SHOT_EVIDENCE_INVALID',
  );
  writeFileSync(resolve(projectRoot, globalQaReportPath), validGlobalQaBytes);

  const validShotQaBytes = readFileSync(resolve(projectRoot, shotQaReportPath));
  const shotQaWithoutObservations = JSON.parse(validShotQaBytes.toString('utf8'));
  shotQaWithoutObservations.visualReview.observations = {};
  writeFileSync(
    resolve(projectRoot, shotQaReportPath),
    `${JSON.stringify(shotQaWithoutObservations, null, 2)}\n`,
  );
  assertFailsWithCode(
    '逐镜QA空壳报告不得绕过apply-review',
    validate(materialized, 'materialized'),
    'SHOT_QA_REVIEW_EVIDENCE_INVALID',
  );
  writeFileSync(resolve(projectRoot, shotQaReportPath), validShotQaBytes);

  const validLedgerBytes = readFileSync(resolve(projectRoot, ledgerPath));
  const assertLedgerMutationFails = (label, mutate, expectedCode) => {
    const changedLedger = JSON.parse(validLedgerBytes.toString('utf8'));
    mutate(changedLedger.attempts.G01, changedLedger);
    try {
      writeFileSync(
        resolve(projectRoot, ledgerPath),
        `${JSON.stringify(changedLedger, null, 2)}\n`,
      );
      assertFailsWithCode(
        label,
        validate(materialized, 'materialized'),
        expectedCode,
      );
    } finally {
      writeFileSync(resolve(projectRoot, ledgerPath), validLedgerBytes);
    }
  };

  for (const field of ['provider', 'providerId', 'model']) {
    assertLedgerMutationFails(
      `账本固定提供商字段${field}被篡改`,
      (_attempt, ledger) => {
        ledger[field] = 'tampered';
      },
      'LEDGER_PROVIDER_CONTRACT_INVALID',
    );
  }
  assertLedgerMutationFails(
    '账本顶层费用授权快照被篡改',
    (_attempt, ledger) => {
      delete ledger.authorization.expiresAt;
    },
    'LEDGER_AUTHORIZATION_SNAPSHOT_MISMATCH',
  );
  assertLedgerMutationFails(
    '账本付费重试策略被篡改',
    (_attempt, ledger) => {
      ledger.policy.automaticPaidRetryAllowed = true;
    },
    'LEDGER_POLICY_INVALID',
  );
  assertLedgerMutationFails(
    '账本夹带计划外G99付费尝试',
    (attempt, ledger) => {
      ledger.attempts.G99 = {
        ...clone(attempt),
        shotId: 'G99',
        actualCostCny: 0,
      };
    },
    'LEDGER_ATTEMPT_SET_MISMATCH',
  );
  assertLedgerMutationFails(
    '账本单镜reported实扣超过单镜授权',
    (attempt) => {
      attempt.actualCostCny = materialized.costAuthorization.maxPerShotCny + 0.01;
    },
    'LEDGER_PER_SHOT_COST_LIMIT_EXCEEDED',
  );
  assertLedgerMutationFails(
    '账本全部reported实扣合计超过总授权',
    (attempt, ledger) => {
      for (const shotId of ['G97', 'G98', 'G99']) {
        ledger.attempts[shotId] = {
          ...clone(attempt),
          shotId,
        };
      }
    },
    'LEDGER_TOTAL_COST_LIMIT_EXCEEDED',
  );

  for (const [field, value] of [
    ['shotId', 'G99'],
    ['attemptNumber', 2],
    ['providerId', 'tampered-provider'],
    ['model', 'tampered-model'],
    ['modelRoute', '/tampered-route'],
    ['resolution', '1080P'],
    ['ratio', '9:16'],
    ['durationSeconds', 7],
    ['requestSha256', '0'.repeat(64)],
    ['promptSha256', '0'.repeat(64)],
    ['maximumCostCny', materialized.costAuthorization.maxPerShotCny + 1],
    ['currency', 'USD'],
  ]) {
    assertLedgerMutationFails(
      `镜头付费尝试字段${field}被篡改`,
      (attempt) => {
        attempt[field] = value;
      },
      'LEDGER_ATTEMPT_BINDING_INVALID',
    );
  }
  assertLedgerMutationFails(
    '镜头付费尝试authorization快照被篡改',
    (attempt) => {
      attempt.authorization.status = 'not-approved';
    },
    'LEDGER_ATTEMPT_BINDING_INVALID',
  );

  assertLedgerMutationFails(
    '账本缺少actualCostStatus',
    (attempt) => {
      delete attempt.actualCostStatus;
    },
    'LEDGER_ACTUAL_COST_EVIDENCE_INVALID',
  );
  assertLedgerMutationFails(
    '账本缺少actualCostCny',
    (attempt) => {
      delete attempt.actualCostCny;
    },
    'LEDGER_ACTUAL_COST_EVIDENCE_INVALID',
  );
  assertLedgerMutationFails(
    '账本actualCostCny不是有限数字',
    (attempt) => {
      attempt.actualCostCny = '3.1';
    },
    'LEDGER_ACTUAL_COST_EVIDENCE_INVALID',
  );
  assertLedgerMutationFails(
    '账本actualCostCny为负数',
    (attempt) => {
      attempt.actualCostCny = -1;
    },
    'LEDGER_ACTUAL_COST_EVIDENCE_INVALID',
  );
  assertLedgerMutationFails(
    '账本仅有estimatedCostCny',
    (attempt) => {
      delete attempt.actualCostStatus;
      delete attempt.actualCostCny;
      attempt.estimatedCostCny = materialized.shots[0].output.chargedCostCny;
    },
    'LEDGER_ACTUAL_COST_EVIDENCE_INVALID',
  );
  assertLedgerMutationFails(
    '账本reported实扣与计划金额不一致',
    (attempt) => {
      attempt.actualCostCny = materialized.shots[0].output.chargedCostCny - 0.1;
    },
    'LEDGER_COST_MISMATCH',
  );

  const badReceiptSha = clone(materialized);
  badReceiptSha.outputs.approvalReceiptSha256 = '0'.repeat(64);
  assertFailsWithCode(
    '消费回执哈希被替换',
    validate(badReceiptSha, 'materialized'),
    'APPROVAL_RECEIPT_SHA_MISMATCH',
  );

  const approvalReceiptBytes = readFileSync(
    resolve(projectRoot, approvalReceiptPath),
  );
  const assertReceiptMutationFails = (label, mutate) => {
    const alteredApprovalReceipt = JSON.parse(
      approvalReceiptBytes.toString('utf8'),
    );
    mutate(alteredApprovalReceipt);
    try {
      writeFileSync(
        resolve(projectRoot, approvalReceiptPath),
        `${JSON.stringify(alteredApprovalReceipt, null, 2)}\n`,
      );
      const alteredReceiptPlan = clone(materialized);
      alteredReceiptPlan.outputs.approvalReceiptSha256 = sha256File(
        approvalReceiptPath,
      );
      assertFailsWithCode(
        label,
        validate(alteredReceiptPlan, 'materialized'),
        'APPROVAL_RECEIPT_BINDING_INVALID',
      );
    } finally {
      writeFileSync(resolve(projectRoot, approvalReceiptPath), approvalReceiptBytes);
    }
  };
  assertReceiptMutationFails('消费回执金额未绑定当前授权', (receipt) => {
    receipt.maxAmountCny += 1;
  });
  assertReceiptMutationFails('消费回执providerId被篡改', (receipt) => {
    receipt.providerId = 'tampered-provider';
  });
  assertReceiptMutationFails('消费回执ledgerPath被篡改', (receipt) => {
    receipt.ledgerPath = resolve(projectRoot, `${workflowRootRelative}/other.json`);
  });

  const badProbe = clone(materialized);
  badProbe.shots[0].output.probe.width = 1280;
  assertFailsWithCode(
    '低于2K级门槛的输出',
    validate(badProbe, 'materialized'),
    'SHOT_PROBE_FRAME_INVALID',
  );
} finally {
  rmSync(testRoot, {recursive: true, force: true});
  rmSync(testMediaRoot, {recursive: true, force: true});
  rmSync(
    resolve(
      projectRoot,
      approvalReceiptRelativePathFor('approval-contract-test-001'),
    ),
    {force: true},
  );
}

assert.equal(
  stableJsonSha256({b: 2, a: 1}),
  stableJsonSha256({a: 1, b: 2}),
  'stableJsonSha256 必须忽略对象键顺序。',
);

const retiredCliPlan = makePlan(1, {
  planId: `retired-cli-plan-${process.pid}`,
  videoId: `RETIRED_CLI_PLAN_${process.pid}`,
  visualSuffix: 'retired-cli',
});
const retiredCliPlanPath = resolve(projectRoot, retiredCliPlan.planPath);
mkdirSync(dirname(retiredCliPlanPath), {recursive: true});
writeFileSync(
  retiredCliPlanPath,
  `${JSON.stringify(retiredCliPlan, null, 2)}\n`,
);
try {
  const retiredValidation = spawnSync(
    process.execPath,
    [
      'tools/validate-generated-video-plan.mjs',
      retiredCliPlan.planPath,
      '--phase',
      'plan',
    ],
    {cwd: projectRoot, encoding: 'utf8'},
  );
  const retiredValidationOutput =
    `${retiredValidation.stdout ?? ''}${retiredValidation.stderr ?? ''}`;
  assert.notEqual(retiredValidation.status, 0, '退役风格不得再显示计划有效。');
  assert.match(retiredValidationOutput, /\[STYLE_RETIRED\]/u);
  assert.match(retiredValidationOutput, /退役生成风格硬门/u);
} finally {
  rmSync(resolve(projectRoot, `edit/${retiredCliPlan.videoId}`), {
    recursive: true,
    force: true,
  });
}

const failedPlanSha256 =
  'ddb5e242f25038dd8b58910fe58427c2e094e056947d9db7fd51d652c6d9e7cd';
const failedPlanSource =
  'edit/WECHAT_GEO_AAO_20260823_talk01/generated-video-plan_WECHAT_GEO_AAO_20260823_talk01_v1.json';
assert.equal(sha256File(failedPlanSource), failedPlanSha256);
const renamedFailedPlanPath = resolve(bindingRoot, 'renamed-failed-plan.bin');
copyFileSync(resolve(projectRoot, failedPlanSource), renamedFailedPlanPath);
const renamedFailedPlan = JSON.parse(readFileSync(renamedFailedPlanPath, 'utf8'));
const renamedPlanHits = findRetiredGeneratedStyleFingerprints(
  renamedFailedPlan,
  {
    location: '$renamedFailedPlan',
    projectRoot,
    documentPaths: [renamedFailedPlanPath],
  },
);
assert.ok(
  renamedPlanHits.some((hit) => hit.sha256 === failedPlanSha256),
  '改名后的失败计划必须按文件内容 SHA-256 命中退役门。',
);

console.log(
  'generated-video-plan 测试通过：历史核心合同保留为失败档案，CLI 对名称及内容哈希退役证据返回 STYLE_RETIRED。',
);
