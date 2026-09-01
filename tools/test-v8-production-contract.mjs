import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  approvalReceiptRelativePathFor,
  buildH3RequestDefinition,
  compileShotPrompt,
  generatedVideoMediaRootFor,
  generatedVideoPlanPathFor,
  generatedVideoRenderSourceFor,
  generatedVideoEvidenceBinding,
  generationDefinitionSha256,
  stableJsonSha256,
} from './generated-video-plan-core.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const testRootRelative = `work/.v8-contract-test-${process.pid}`;
const testRoot = path.join(projectRoot, testRootRelative);
const clone = (value) => JSON.parse(JSON.stringify(value));
const stylePath = 'workflow/style-library/koubo-paper-construct-v1.json';
const style = JSON.parse(readFileSync(path.join(projectRoot, stylePath), 'utf8'));
const audioFiles = [
  'remotion/public/audio/koubo-sfx-v1/section-air.wav',
  'remotion/public/audio/koubo-sfx-v1/card-reveal.wav',
  'remotion/public/audio/koubo-sfx-v1/node-connect.wav',
  'remotion/public/audio/koubo-sfx-v1/camera-shutter.wav',
  'remotion/public/audio/koubo-sfx-v2/number-affirmation.wav',
  'remotion/public/audio/koubo-sfx-v2/keyword-select.wav',
];
const externalTestRoots = new Set();

const writeJson = (name, value) => {
  const relativePath = `${testRootRelative}/${name}`;
  writeFileSync(
    path.join(projectRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
  return relativePath;
};
const writeArtifact = (name, content = name) => {
  const relativePath = `${testRootRelative}/${name}`;
  writeFileSync(path.join(projectRoot, relativePath), content);
  return relativePath;
};
const writeAt = (relativePath, content) => {
  const absolutePath = path.join(projectRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), {recursive: true});
  writeFileSync(absolutePath, content);
  return relativePath;
};
const writeJsonAt = (relativePath, value) =>
  writeAt(relativePath, `${JSON.stringify(value, null, 2)}\n`);
const sha256 = (filePath) =>
  createHash('sha256')
    .update(readFileSync(path.join(projectRoot, filePath)))
    .digest('hex');
const run = (script, argument) =>
  spawnSync(process.execPath, [script, argument], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
const output = (result) => `${result.stdout ?? ''}${result.stderr ?? ''}`;
const assertPasses = (label, result) => {
  if (result.status !== 0) throw new Error(`${label}应通过：\n${output(result)}`);
};
const assertFailsWith = (label, result, expected) => {
  if (result.status === 0) throw new Error(`${label}应失败，但通过了。`);
  if (!output(result).includes(expected)) {
    throw new Error(`${label}缺少错误“${expected}”：\n${output(result)}`);
  }
};

const layers = Array.from({length: 6}, (_, index) => {
  const start = index * 5;
  const family = ['statement', 'process', 'evidence'][index % 3];
  return {
    id: `layer-${index + 1}`,
    start,
    end: start + 4.5,
    spokenLine: `测试原句${index + 1}`,
    purpose: 'semantic-emphasis',
    kind: 'transparent-semantic-information',
    variant: family,
    titleOwner: true,
    overlapGroup: `group-${index + 1}`,
    zone: 'left-safe',
    background: 'talk',
    asset: {
      sourceType: 'remotion-component',
      source: `V8/${family}`,
    },
    assetDecision: {
      class: 'remotion-information',
      producer: 'codex-remotion',
      requestId: null,
      fallback: 'speaker-plus-information',
    },
    visualEvent: {
      id: `event-${index + 1}`,
      enterAt: start + 0.1,
      primary: true,
    },
    sound: {
      policy: 'required',
      role: `role-${index + 1}`,
      cueId: `cue-${index + 1}`,
      offsetFrames: 0,
      maxSyncErrorFrames: 2,
    },
    params: {component: family},
    presentation: {
      renderMode: 'speaker-overlay',
      semanticFamily: family,
      coverageRatio: 0.34,
      progressiveReveal: true,
    },
    checks: {
      avoidFace: true,
      avoidHands: true,
      avoidSubtitle: true,
      needsFrameReview: true,
      continuousReviewIntervalSeconds: 0.5,
      reviewAt: start + 2,
    },
  };
});

const basePlan = {
  schemaVersion: 4,
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: 'candidate-preview-required',
  },
  videoId: 'V8_CONTRACT_TEST',
  videoTitle: 'V8合同测试',
  sourceVideo: 'source/test.mp4',
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: ['ref-a', 'ref-b'],
  target: {aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin'},
  previewCoverage: [
    'hook',
    'complex-overlay',
    'cta',
    'speaker-overlay',
    'media-fullscreen',
    'progressive-process',
    'source-evidence',
    'hero-emphasis',
    'sfx-ab',
    'full-screen-asset',
  ],
  layers,
};

const baseCueSheet = {
  schemaVersion: 3,
  experimentId: 'v8-semantic-continuity-sfx',
  videoId: basePlan.videoId,
  cues: layers.map((layer, index) => ({
    id: layer.sound.cueId,
    visualEventId: layer.visualEvent.id,
    role: layer.sound.role,
    start: layer.visualEvent.enterAt,
    end: layer.visualEvent.enterAt + 0.6,
    source: audioFiles[index],
    volume: 0.3,
    userAudibilityConfirmed: false,
  })),
};

const baseJob = {
  schemaVersion: 1,
  videoId: basePlan.videoId,
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: 'candidate-preview-required',
    userPreviewApproved: false,
    previewAuditionRoles: layers.map((layer) => layer.sound.role),
  },
  inputs: {visualPlan: '', sfxCueSheet: ''},
  remotion: {fps: 30},
  preview: {
    ranges: [{id: 'continuous-v8', startSeconds: 0, endSeconds: 30}],
    renderWithoutSfxComparison: true,
  },
  formal: {enabled: false},
};

const writeCase = (name, plan, cueSheet, job) => {
  const planPath = writeJson(`${name}.visual-plan.json`, plan);
  const cuePath = writeJson(`${name}.sfx.json`, cueSheet);
  const materialized = clone(job);
  materialized.inputs.visualPlan = planPath;
  materialized.inputs.sfxCueSheet = cuePath;
  return {
    planPath,
    jobPath: writeJson(`${name}.production.json`, materialized),
  };
};

const writeProviderCase = (name, mutate = () => {}) => {
  const plan = clone(basePlan);
  const cueSheet = clone(baseCueSheet);
  const job = clone(baseJob);
  plan.videoId = `${basePlan.videoId}_${name}`;
  cueSheet.videoId = plan.videoId;
  job.videoId = plan.videoId;
  const visualPlanPath = `${testRootRelative}/${name}.visual-plan.json`;
  const generatedPlanId = `${name}-generated-video`;
  const generatedPlanPath = generatedVideoPlanPathFor(plan.videoId);
  const workflowRoot = `edit/generated-video/${generatedPlanId}`;
  const mediaRoot = generatedVideoMediaRootFor(plan.videoId, generatedPlanId);
  const approvalId = `${name}-cost-approval`;
  const approvalReceiptPath = approvalReceiptRelativePathFor(approvalId);
  externalTestRoots.add(path.dirname(generatedPlanPath));
  externalTestRoots.add(workflowRoot);
  externalTestRoots.add(mediaRoot);
  externalTestRoots.add(approvalReceiptPath);
  const outputVideoPath = writeAt(`${mediaRoot}/G01.mp4`, '假视频测试内容');
  const alternateVideoPath = writeArtifact(`${name}.alternate.mp4`, '另一条假视频');
  const ledgerPath = `${workflowRoot}/generation-ledger.json`;
  const globalContactSheetPath = writeAt(
    `${workflowRoot}/contact-sheet.jpg`,
    `${name}-global-contact-sheet`,
  );
  const globalQaReportPath = `${workflowRoot}/qa-report.json`;
  const shotContactSheetPath = writeAt(
    `${workflowRoot}/G01-contact-sheet.jpg`,
    `${name}-shot-contact-sheet`,
  );
  const shotQaReportPath = `${workflowRoot}/G01-qa.json`;

  const providerLayer = plan.layers[0];
  providerLayer.purpose = 'concept-illustration';
  providerLayer.kind = 'full-screen-asset';
  providerLayer.zone = 'full-screen';
  providerLayer.background = 'opaque';
  providerLayer.asset = {
    sourceType: 'provider-generated-video',
    source: outputVideoPath,
  };
  providerLayer.assetDecision = {
    class: 'generated-video',
    producer: 'codex-provider',
    requestId: 'G01',
    evidenceUse: 'illustration-only',
    styleReferenceId: 'koubo-paper-construct-v1',
    fallback: 'speaker-plus-information',
  };
  providerLayer.params = {
    component: 'generated-media',
    src: generatedVideoRenderSourceFor(plan.videoId, generatedPlanId, 'G01'),
    disclosure: 'AI生成·概念演绎',
    badge: '非真实业务证据',
  };
  providerLayer.presentation = {
    renderMode: 'media-fullscreen',
    semanticFamily: 'paper-construct',
    coverageRatio: 1,
    progressiveReveal: true,
  };
  if (!plan.styleReferenceIds.includes('koubo-paper-construct-v1')) {
    plan.styleReferenceIds.push('koubo-paper-construct-v1');
  }

  const generatedPlan = {
    schemaVersion: 'generated-video-plan/v1',
    planId: generatedPlanId,
    videoId: plan.videoId,
    videoTitle: plan.videoTitle,
    planPath: generatedPlanPath,
    visualPlan: visualPlanPath,
    productionStatus: 'qa-passed',
    scope: 'ai-concept-explainer-inserts-only',
    styleReference: {
      id: 'koubo-paper-construct-v1',
      nameZh: '纸构推演 v1',
      path: stylePath,
      sourceSampleSha256:
        'f172d6dc4831ce51bdecfe1359b1187666cad23c098c402edfc6836e3e553949',
    },
    provider: {
      platform: 'RunningHub',
      adapter: 'wanxiang-zaojing-runninghub',
      model: 'MiniMax-H3',
      resolution: '2K',
      aspectRatio: '16:9',
      clipDurationSeconds: {min: 5, max: 15},
    },
    costAuthorization: {
      status: 'approved',
      approvalId,
      approvedBy: 'user',
      approvedAt: '2026-08-22T15:00:00+08:00',
      expiresAt: '2026-08-23T15:00:00+08:00',
      scope: {
        type: 'plan-only',
        planId: generatedPlanId,
        definitionSha256: null,
      },
      maxPerShotCny: 3.1,
      maxAmountCny: 3.1,
      currency: 'CNY',
      maxAttemptsPerShot: 1,
      automaticRetry: false,
    },
    outputs: {
      rootDir: mediaRoot,
      ledgerPath,
      quotePath: `${workflowRoot}/latest-quote.json`,
      approvalReceiptPath,
      approvalReceiptSha256: null,
      contactSheetPath: globalContactSheetPath,
      qaReportPath: globalQaReportPath,
    },
    shots: [
      {
        id: 'G01',
        requestId: 'G01',
        layerId: providerLayer.id,
        assetClass: 'generated-video',
        spokenAnchor: {
          text: providerLayer.spokenLine,
          startSeconds: providerLayer.start,
          endSeconds: providerLayer.end,
        },
        selectionReason: '这句表达的是抽象能力被结构化装载的过程，需要概念演绎。',
        evidenceUse: 'illustration-only',
        causalChain: {
          initialState: '一张海军蓝空白卡片停在纸板轨道左端',
          physicalCause: '可见齿轮推动轨道滑块',
          resultState: '卡片进入红色纸板档案盒并稳定停住',
        },
        singleAction: {
          actions: [
            {
              verb: '推入',
              actor: '可见纸板齿轮',
              object: '海军蓝空白卡片',
              visibleCause: '齿轮齿面始终与滑块接触',
              visibleEffect: '卡片被推入档案盒',
            },
          ],
        },
        mechanism: 'gear',
        composition: {
          view: 'front-miniature',
          mainSubject: '纸板档案盒与唯一卡片',
          mainSubjectCount: 1,
          negativeSpace: '右上保留空白信息区',
          subtitleSafeBottomRatio: 0.18,
          labels: 'blank-remotion-later',
        },
        camera: {movement: 'fixed', framing: '正面微缩中景'},
        continuity: {
          objectIdentityLock: '全程仅一张海军蓝卡片',
          shapeLock: '卡片长宽和纸板厚度全程不变',
          contactContinuity: '齿轮、滑块与卡片接触链不中断',
        },
        timing: {
          durationSeconds: 6,
          establish: {startSeconds: 0, endSeconds: 0.8},
          action: {startSeconds: 0.8, endSeconds: 5.2},
          finalHold: {startSeconds: 5.2, endSeconds: 6},
        },
        promptCore: {
          concept: '把抽象能力结构化装入档案',
          visualMetaphor: '可见纸板齿轮把卡片推入档案盒',
          openingFrame: '卡片在轨道左端，档案盒在右端',
          actionInstruction: '齿轮只执行一次转动，将卡片推入档案盒',
          closingFrame: '卡片完整进入档案盒并定格',
          compiledPrompt: '',
        },
        output: {
          providerTaskId: 'runninghub-test-task',
          videoPath: outputVideoPath,
          sha256: sha256(outputVideoPath),
          attemptCount: 1,
          chargedCostCny: 3.1,
          costBasis: 'actual',
          probe: {
            width: 2048,
            height: 1152,
            durationSeconds: 6,
            fps: 30,
            codec: 'h264',
          },
        },
        qa: {
          status: 'passed',
          contactSheetPath: shotContactSheetPath,
          reportPath: shotQaReportPath,
          visualReview: {
            status: 'passed',
            reviewer: 'codex-visual-qa',
            reviewerKind: 'codex-vision',
            reviewerModel: 'v8-contract-test-model',
            reviewerVersion: '1',
            reviewedAt: '2026-08-22T15:10:00+08:00',
            contactSheetSha256: sha256(shotContactSheetPath),
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
        },
        fallback: 'speaker-plus-information',
      },
    ],
  };
  generatedPlan.shots[0].promptCore.compiledPrompt = compileShotPrompt(
    generatedPlan,
    style,
    generatedPlan.shots[0],
  );
  generatedPlan.costAuthorization.scope.definitionSha256 =
    generationDefinitionSha256(generatedPlan);
  writeJsonAt(visualPlanPath, plan);
  writeJsonAt(approvalReceiptPath, {
    schemaVersion: 'generated-video-approval-consumption/v1',
    approvalId: generatedPlan.costAuthorization.approvalId,
    planId: generatedPlan.planId,
    definitionSha256: generationDefinitionSha256(generatedPlan),
    approvedBy: generatedPlan.costAuthorization.approvedBy,
    approvedAt: generatedPlan.costAuthorization.approvedAt,
    expiresAt: generatedPlan.costAuthorization.expiresAt,
    maxPerShotCny: generatedPlan.costAuthorization.maxPerShotCny,
    maxAmountCny: generatedPlan.costAuthorization.maxAmountCny,
    currency: generatedPlan.costAuthorization.currency,
    ledgerPath: path.resolve(projectRoot, ledgerPath),
    providerId: 'runninghub-minimax-h3-2k',
    consumedAt: '2026-08-22T15:02:00+08:00',
  });
  generatedPlan.outputs.approvalReceiptSha256 = sha256(approvalReceiptPath);
  const evidenceBinding = generatedVideoEvidenceBinding(generatedPlan, style);
  const qaObservations = Object.fromEntries(
    Object.keys(generatedPlan.shots[0].qa.checks).map((check) => [
      check,
      `已复核${check}，V8合同测试证据为通过。`,
    ]),
  );
  writeJsonAt(globalQaReportPath, {
    schemaVersion: 'generated-video-visual-review/v1',
    planId: generatedPlan.planId,
    ...evidenceBinding,
    status: 'passed',
    reviewer: 'codex-visual-qa',
    reviewerKind: 'codex-vision',
    reviewerModel: 'v8-contract-test-model',
    reviewerVersion: '1',
    reviewedAt: '2026-08-22T15:10:00+08:00',
    contactSheetPath: globalContactSheetPath,
    contactSheetSha256: sha256(globalContactSheetPath),
    shots: [{
      id: 'G01',
      decision: 'passed',
      checks: clone(generatedPlan.shots[0].qa.checks),
      observations: clone(qaObservations),
      notes: 'V8合同测试逐镜复核通过。',
      videoSha256: generatedPlan.shots[0].output.sha256,
      contactSheetPath: shotContactSheetPath,
      contactSheetSha256: sha256(shotContactSheetPath),
      reportPath: shotQaReportPath,
    }],
  });
  writeJsonAt(shotQaReportPath, {
    schemaVersion: 'generated-video-shot-qa/v1',
    planId: generatedPlan.planId,
    shotId: 'G01',
    ...evidenceBinding,
    videoSha256: generatedPlan.shots[0].output.sha256,
    preparedAt: '2026-08-22T15:09:00+08:00',
    status: 'passed',
    spokenAnchor: clone(generatedPlan.shots[0].spokenAnchor),
    causalChain: clone(generatedPlan.shots[0].causalChain),
    singleAction: clone(generatedPlan.shots[0].singleAction),
    continuity: clone(generatedPlan.shots[0].continuity),
    sampleFractions: [0, 0.25, 0.5, 0.75, 1],
    contactSheetPath: shotContactSheetPath,
    contactSheetSha256: sha256(shotContactSheetPath),
    requiredChecks: clone(generatedPlan.shots[0].qa.checks),
    visualReview: {
      ...clone(generatedPlan.shots[0].qa.visualReview),
      observations: clone(qaObservations),
      notes: 'V8合同测试逐镜复核通过。',
    },
  });
  writeJsonAt(ledgerPath, {
    schemaVersion: 1,
    planId: generatedPlan.planId,
    planSha256: generationDefinitionSha256(generatedPlan),
    provider: 'RunningHub',
    providerId: 'runninghub-minimax-h3-2k',
    model: 'MiniMax-H3',
    authorization: clone(generatedPlan.costAuthorization),
    policy: {
      maximumPaidAttemptsPerShot: 1,
      automaticPaidRetryAllowed: false,
    },
    attempts: {
      G01: {
        shotId: 'G01',
        attemptNumber: 1,
        status: 'downloaded',
        taskId: generatedPlan.shots[0].output.providerTaskId,
        providerId: 'runninghub-minimax-h3-2k',
        model: 'MiniMax-H3',
        modelRoute: '/openapi/v2/minimax/hailuo-h3/multimodal-to-video',
        resolution: '2K',
        ratio: '16:9',
        durationSeconds: generatedPlan.shots[0].timing.durationSeconds,
        requestSha256: stableJsonSha256(
          buildH3RequestDefinition(generatedPlan.shots[0]),
        ),
        promptSha256: createHash('sha256')
          .update(Buffer.from(generatedPlan.shots[0].promptCore.compiledPrompt))
          .digest('hex'),
        maximumCostCny: generatedPlan.costAuthorization.maxPerShotCny,
        currency: generatedPlan.costAuthorization.currency,
        outputPath: path.resolve(projectRoot, outputVideoPath),
        outputSha256: generatedPlan.shots[0].output.sha256,
        actualCostCny: generatedPlan.shots[0].output.chargedCostCny,
        actualCostStatus: 'reported',
        authorization: clone(generatedPlan.costAuthorization),
      },
    },
  });

  job.inputs.visualPlan = visualPlanPath;
  job.inputs.generatedVideoPlan = generatedPlanPath;
  job.inputs.fingerprintPaths = [
    visualPlanPath,
    generatedPlanPath,
    stylePath,
    approvalReceiptPath,
    ledgerPath,
    globalContactSheetPath,
    globalQaReportPath,
    outputVideoPath,
    shotContactSheetPath,
    shotQaReportPath,
  ];

  mutate({
    plan,
    cueSheet,
    job,
    generatedPlan,
    paths: {outputVideoPath, alternateVideoPath, shotQaReportPath},
  });
  const cuePath = writeJson(`${name}.sfx.json`, cueSheet);
  job.inputs.sfxCueSheet = cuePath;
  writeJson(`${name}.visual-plan.json`, plan);
  writeJsonAt(generatedPlanPath, generatedPlan);
  return {
    planPath: visualPlanPath,
    generatedPlanPath,
    jobPath: writeJson(`${name}.production.json`, job),
  };
};

mkdirSync(testRoot, {recursive: true});
try {
  const valid = writeCase('valid', basePlan, baseCueSheet, baseJob);
  assertPasses('合法V8视觉方案', run('tools/validate-visual-plan.mjs', valid.planPath));
  assertPasses('合法V8生产合同', run('tools/validate-v8-production-contract.mjs', valid.jobPath));

  const legacyUserPlan = clone(basePlan);
  const legacyUserVideo = writeArtifact('legacy-user-generated.mp4', '历史用户生成视频');
  legacyUserPlan.layers[0] = {
    ...legacyUserPlan.layers[0],
    purpose: 'concept-illustration',
    kind: 'full-screen-asset',
    zone: 'full-screen',
    background: 'opaque',
    asset: {sourceType: 'user-generated-video', source: legacyUserVideo},
    assetDecision: {
      class: 'generated-video',
      producer: 'user',
      requestId: 'LEGACY-S01',
      fallback: 'speaker-plus-information',
    },
    params: {component: 'generated-media'},
    presentation: {
      renderMode: 'media-fullscreen',
      semanticFamily: 'legacy-user-media',
      coverageRatio: 1,
      progressiveReveal: true,
    },
  };
  const legacyUserCase = writeCase(
    'legacy-user-generated',
    legacyUserPlan,
    baseCueSheet,
    baseJob,
  );
  assertPasses(
    '历史 user 生成视频视觉方案',
    run('tools/validate-visual-plan.mjs', legacyUserCase.planPath),
  );
  assertPasses(
    '历史 user 生成视频生产合同',
    run('tools/validate-v8-production-contract.mjs', legacyUserCase.jobPath),
  );

  const provider = writeProviderCase('provider-retired');
  assertFailsWith(
    '纸构推演 v1 视觉方案已退役',
    run('tools/validate-visual-plan.mjs', provider.planPath),
    '退役生成风格硬门',
  );
  assertFailsWith(
    '纸构推演 v1 不得进入 V8 生产',
    run('tools/validate-v8-production-contract.mjs', provider.jobPath),
    '退役生成风格硬门',
  );

  const retiredComponentPlan = clone(basePlan);
  retiredComponentPlan.layers[0].params.component = 'paper-construct-video';
  retiredComponentPlan.layers[0].asset.sourceType = 'local-video';
  retiredComponentPlan.layers[0].assetDecision = {
    class: 'real-evidence',
    producer: 'existing',
    fallback: 'speaker-plus-information',
  };
  const retiredComponentCase = writeCase(
    'retired-component-spoof',
    retiredComponentPlan,
    baseCueSheet,
    baseJob,
  );
  assertFailsWith(
    '退役组件不能靠producer/sourceType错标绕过视觉门',
    run('tools/validate-visual-plan.mjs', retiredComponentCase.planPath),
    'paper-construct-video',
  );
  assertFailsWith(
    '退役组件不能靠producer/sourceType错标绕过V8合同',
    run('tools/validate-v8-production-contract.mjs', retiredComponentCase.jobPath),
    'paper-construct-video',
  );

  const retiredPathPlan = clone(basePlan);
  retiredPathPlan.layers[0].asset = {
    sourceType: 'local-video',
    source: 'remotion/public/media/test/user-generated-paper/G01.mp4',
  };
  retiredPathPlan.layers[0].assetDecision = {
    class: 'real-evidence',
    producer: 'existing',
    fallback: 'speaker-plus-information',
  };
  const retiredPathCase = writeCase(
    'retired-path-spoof',
    retiredPathPlan,
    baseCueSheet,
    baseJob,
  );
  assertFailsWith(
    '退役路径段不能靠producer/sourceType错标绕过',
    run('tools/validate-visual-plan.mjs', retiredPathCase.planPath),
    '/user-generated-paper/',
  );

  const retiredSource =
    'remotion/public/media/wechat-geo-aao-20260823/user-generated-paper/G01.mp4';
  const retiredSha256 =
    'e0bb0900417c0a5f87d112ded4e3be56af4cd0ad0a9842a2349e15c0ffc70435';
  if (sha256(retiredSource) !== retiredSha256) {
    throw new Error('V8 内容哈希回归源 G01 已漂移。');
  }
  const renamedRetiredSource = `${testRootRelative}/renamed-retired-source.bin`;
  copyFileSync(
    path.join(projectRoot, retiredSource),
    path.join(projectRoot, renamedRetiredSource),
  );
  const retiredHashPlan = clone(basePlan);
  retiredHashPlan.layers[0].asset = {
    sourceType: 'local-video',
    source: renamedRetiredSource,
  };
  retiredHashPlan.layers[0].assetDecision = {
    class: 'generated-video',
    producer: 'user',
    fallback: 'speaker-plus-information',
  };
  const retiredHashCase = writeCase(
    'retired-content-sha',
    retiredHashPlan,
    baseCueSheet,
    baseJob,
  );
  assertFailsWith(
    '改名 G01 仍被视觉方案内容哈希门阻断',
    run('tools/validate-visual-plan.mjs', retiredHashCase.planPath),
    retiredSha256,
  );
  assertFailsWith(
    '改名 G01 仍被 V8 合同内容哈希门阻断',
    run('tools/validate-v8-production-contract.mjs', retiredHashCase.jobPath),
    retiredSha256,
  );

  const opaque = clone(basePlan);
  opaque.layers[0].background = 'opaque';
  const opaqueCase = writeCase('opaque', opaque, baseCueSheet, baseJob);
  assertFailsWith(
    '全屏说明页',
    run('tools/validate-v8-production-contract.mjs', opaqueCase.jobPath),
    '禁止全屏或不透明背景',
  );

  const callDemo = clone(basePlan);
  callDemo.layers[0].params.component = 'call-demo';
  const callDemoCase = writeCase('call-demo', callDemo, baseCueSheet, baseJob);
  assertFailsWith(
    '旧call-demo',
    run('tools/validate-v8-production-contract.mjs', callDemoCase.jobPath),
    '仍使用被退回',
  );

  const oversized = clone(basePlan);
  oversized.layers[0].presentation.coverageRatio = 0.6;
  const oversizedCase = writeCase('oversized', oversized, baseCueSheet, baseJob);
  assertFailsWith(
    '覆盖过大',
    run('tools/validate-v8-production-contract.mjs', oversizedCase.jobPath),
    '超过 42%',
  );

  const quiet = clone(baseCueSheet);
  quiet.cues[0].volume = 0.12;
  const quietCase = writeCase('quiet', basePlan, quiet, baseJob);
  assertFailsWith(
    '旧低音量',
    run('tools/validate-v8-production-contract.mjs', quietCase.jobPath),
    '0.20–0.55',
  );

  const repeated = clone(baseCueSheet);
  repeated.cues[1].source = repeated.cues[0].source;
  const repeatedCase = writeCase('repeated-sfx', basePlan, repeated, baseJob);
  assertFailsWith(
    '短时重复音效',
    run('tools/validate-v8-production-contract.mjs', repeatedCase.jobPath),
    '连续音效不得复用',
  );

  const voicePatch = clone(baseCueSheet);
  voicePatch.cues[0].source =
    'remotion/public/audio/koubo-sfx-v8/waic-correction-not-equal.wav';
  const voicePatchCase = writeCase('voice-patch', basePlan, voicePatch, baseJob);
  assertFailsWith(
    '人声补丁误入音效池',
    run('tools/validate-v8-production-contract.mjs', voicePatchCase.jobPath),
    '引用了人声补丁',
  );

  const approvedPlan = clone(basePlan);
  approvedPlan.experiment.status = 'candidate-preview-approved';
  const approvedCues = clone(baseCueSheet);
  approvedCues.cues.forEach((cue) => {
    cue.userAudibilityConfirmed = true;
  });
  const approvedJob = clone(baseJob);
  approvedJob.experiment.status = 'candidate-preview-approved';
  approvedJob.experiment.userPreviewApproved = true;
  approvedJob.experiment.userPreviewApprovedAt = '2026-08-10T04:15:39Z';
  approvedJob.formal.enabled = true;
  const approvedCase = writeCase(
    'preview-approved',
    approvedPlan,
    approvedCues,
    approvedJob,
  );
  assertPasses(
    '用户预览通过后的视觉方案',
    run('tools/validate-visual-plan.mjs', approvedCase.planPath),
  );
  assertPasses(
    '用户预览通过后的正式片解锁',
    run('tools/validate-v8-production-contract.mjs', approvedCase.jobPath),
  );

  const unlocked = clone(baseJob);
  unlocked.formal.enabled = true;
  const unlockedCase = writeCase('unlocked-formal', basePlan, baseCueSheet, unlocked);
  assertFailsWith(
    '未试听先正式渲染',
    run('tools/validate-v8-production-contract.mjs', unlockedCase.jobPath),
    'formal.enabled=false',
  );

  console.log('V8生产合同回归通过：通用V8、普通user视频与退役生成风格隔离均通过。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
  for (const relativeRoot of externalTestRoots) {
    rmSync(path.join(projectRoot, relativeRoot), {recursive: true, force: true});
  }
}
