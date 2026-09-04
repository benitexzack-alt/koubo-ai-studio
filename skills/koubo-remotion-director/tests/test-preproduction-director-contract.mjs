#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildAiGeneratedVideoPromptManifest,
  buildFirstFramePromptManifest,
  buildRunningHubPromptManifest,
  compilePreproductionPlan,
  renderAiGeneratedVideoPromptSheet,
  sha256File,
  validatePromptHandoffManifests,
  validatePreproductionRequest,
} from '../scripts/preproduction-director-core.mjs';

const profile = {
  profileId: 'paper-editorial-director-v3',
  profileVersion: '3.2.0',
  routingPolicy: {
    paperRequiredKinds: ['abstract-mechanism', 'causal-chain'],
  },
};

const style = {
  styleId: 'koubo-paper-editorial-assembly-v3',
  acceptedDynamicAnchor: {sha256: 'a'.repeat(64)},
};

const makeRequest = (scriptPath) => ({
  schemaVersion: 'koubo-director-preproduction-request/v1',
  requestId: 'test-preproduction-request',
  taskId: 'test-preproduction-task',
  phase: 'pre-shoot',
  status: 'candidate-preview-required',
  inputScript: {
    path: scriptPath,
    sha256: sha256File(scriptPath),
    authority: 'user-confirmed-script',
    role: 'provisional-authority',
  },
  directorProfile: {
    path: 'workflow/active-director-profile.v1.json',
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
  },
  policy: {
    branch: 'paper-editorial',
    fallback: 'blocked',
      textStrategy: 'deterministic-first-frame-text-v3.2',
      generatedReadableTextAllowed: false,
      modelGeneratedReadableTextAllowed: false,
      deterministicTextMayBeBakedIntoFirstFrame: true,
      defaultPaperTextMode: 'first-frame-baked',
      actualImageAnchorCalibrationRequired: true,
      runningHubRequiresTextBakeReceipt: true,
      paperNodeScreenOverlayAllowed: false,
    postShootRebindRequired: true,
  },
  outputs: {
    routeLockPath: 'out/route.json',
    planPath: 'out/plan.json',
    assetSheetPath: 'out/assets.md',
    firstFramePromptManifestPath: 'out/first-frame-prompts.json',
    runningHubPromptManifestPath: 'out/runninghub-prompts.json',
    runningHubPromptSheetPath: 'out/runninghub-prompts.md',
    compileReceiptPath: 'out/compile.json',
    validationReceiptPath: 'out/validation.json',
  },
  beats: [
    {
      id: 'B01',
      order: 1,
      spokenLine: '算力正在变成可以按需租用的公共资源',
      coreMeaning: '从重资产持有转为按需调用',
      kind: 'abstract-mechanism',
      visualDecision: {
        class: 'paper-editorial',
        producer: 'codex-remotion',
        fallback: 'blocked',
      },
      evidenceRefs: [],
      paperScene: {
        archetype: 'complex-explanation',
        title: '算力按需租用',
        durationSeconds: 6,
        objectGroups: [
          {id: 'G1', name: '算力底座', material: '蓝色瓦楞纸', depth: 1},
          {id: 'G2', name: '资源池', material: '白色卡纸', depth: 2},
          {id: 'G3', name: '企业需求', material: '灰绿便签', depth: 3},
          {id: 'G4', name: '调度路径', material: '棉线', depth: 2},
          {id: 'G5', name: '业务结果', material: '暖白纸盒', depth: 3},
        ],
        nodes: [
          {id: 'N1', label: '智算中心', groupId: 'G1', role: 'source', textVisibility: 'paper-label'},
          {id: 'N2', label: '算力资源池', groupId: 'G2', role: 'pool', textVisibility: 'paper-label'},
          {id: 'N3', label: '按需租用', groupId: 'G2', role: 'rule', textVisibility: 'paper-label'},
          {id: 'N4', label: '知识库', groupId: 'G3', role: 'need', textVisibility: 'visual-only'},
          {id: 'N5', label: '智能体', groupId: 'G3', role: 'need', textVisibility: 'visual-only'},
          {id: 'N6', label: '工作流', groupId: 'G3', role: 'need', textVisibility: 'visual-only'},
          {id: 'N7', label: '调度', groupId: 'G4', role: 'path', textVisibility: 'visual-only'},
          {id: 'N8', label: '结果', groupId: 'G5', role: 'output', textVisibility: 'paper-label'},
          {id: 'N9', label: '人工确认', groupId: 'G5', role: 'boundary', textVisibility: 'visual-only'},
        ],
        stages: [
          {id: 'S1', order: 1, action: '底座展开', subject: 'G1', landingNodeIds: ['N1'], sfxRole: 'paper-unfold'},
          {id: 'S2', order: 2, action: '资源池卡入', subject: 'G2', landingNodeIds: ['N2', 'N3'], sfxRole: 'paper-click'},
          {id: 'S3', order: 3, action: '需求卡进入', subject: 'G3', landingNodeIds: ['N4', 'N5', 'N6'], sfxRole: 'paper-slide'},
          {id: 'S4', order: 4, action: '棉线连接到结果盒', subject: 'G4', landingNodeIds: ['N7'], sfxRole: 'paper-slide'},
          {id: 'S5', order: 5, action: '结果盒卡入并由无字确认压板锁定', subject: 'G5', landingNodeIds: ['N8', 'N9'], sfxRole: 'paper-click'},
        ],
        labelBindingPolicy: {
          unlabeledObjectGroups: [
            {groupId: 'G3', reason: '企业需求使用三张无字造型卡区分，不设置可读标签牌。'},
            {groupId: 'G4', reason: '调度路径由棉线本体表达，不设置可读标签牌。'},
          ],
        },
        readableTextPolicy: {
          maximumSimultaneousLabels: 4,
          slashMergeForbidden: true,
          silentTruncationForbidden: true,
        },
        textPlan: [
          ['N1', '智算中心', 'G1', 'S1', 'first-frame-baked', 'rigid-surface'],
          ['N2', '算力资源池', 'G2', 'S2', 'tracked-paper-surface', 'tracked-moving-surface'],
          ['N3', '按需租用', 'G2', 'S2', 'tracked-paper-surface', 'tracked-moving-surface'],
          ['N8', '结果', 'G5', 'S5', 'tracked-paper-surface', 'rigid-surface'],
        ].map(([nodeId, text, groupId, enterStageId, embeddingMode, motionConstraint], index) => ({
          nodeId,
          text,
          role: 'diegetic-node-label',
          groupId,
          surfaceId: `${groupId}-surface-${index + 1}`,
          anchorQuad: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.2], [0.1, 0.2]],
          maxChars: 8,
          persistence: `${enterStageId}-to-end`,
          occlusionOwner: 'none',
          ocrRequired: true,
          motionConstraint,
          embeddingMode,
          trackingKeyframesRequired: embeddingMode === 'tracked-paper-surface',
          enterStageId,
          stageOffsetFrames: 0,
        })),
        screenTextPlan: [
          {role: 'screen-title', text: '算力按需租用', embeddingMode: 'screen-overlay'},
        ],
        prompt: {
          firstFrame: '摄影级手作纸艺微缩场景，算力资源池与企业需求卡分层摆放，无可读文字。',
          motion: '纸质底座展开，资源池卡入，需求卡顺序滑入，棉线连接到结果盒，无字确认压板落下锁定。',
          generatedReadableTextAllowed: false,
        },
      },
    },
  ],
});

const buildV9LayoutContract = () => ({
  coordinateSpace: 'normalized-0-to-1',
  contentSafeRect: {x: 0.05, y: 0.05, width: 0.9, height: 0.7},
  subtitleReservedRect: {x: 0, y: 0.8, width: 1, height: 0.2},
  objectGroupBoxes: [
    {groupId: 'G1', box: {x: 0.07, y: 0.1, width: 0.16, height: 0.5}},
    {groupId: 'G2', box: {x: 0.25, y: 0.1, width: 0.23, height: 0.5}},
    {groupId: 'G3', box: {x: 0.5, y: 0.1, width: 0.14, height: 0.5}},
    {groupId: 'G4', box: {x: 0.66, y: 0.1, width: 0.1, height: 0.5}},
    {groupId: 'G5', box: {x: 0.78, y: 0.1, width: 0.15, height: 0.5}},
  ],
  paperLabelSurfaceBoxes: [
    {
      nodeId: 'N1',
      groupId: 'G1',
      surfaceId: 'G1-surface-1',
      box: {x: 0.08, y: 0.45, width: 0.14, height: 0.08},
    },
    {
      nodeId: 'N2',
      groupId: 'G2',
      surfaceId: 'G2-surface-2',
      box: {x: 0.26, y: 0.42, width: 0.1, height: 0.08},
    },
    {
      nodeId: 'N3',
      groupId: 'G2',
      surfaceId: 'G2-surface-3',
      box: {x: 0.37, y: 0.42, width: 0.1, height: 0.08},
    },
    {
      nodeId: 'N8',
      groupId: 'G5',
      surfaceId: 'G5-surface-4',
      box: {x: 0.8, y: 0.44, width: 0.11, height: 0.08},
    },
  ],
  layoutInterpretation: {
    objectGroupBoxes: 'broad-composition-zones',
    paperLabelSurfaceBoxes: 'reserved-placement-zones',
    exactPixelMatchRequired: false,
    contentAndSubtitleContainmentIsHard: true,
  },
  generatedDecorationPolicy: 'forbidden',
});

const enableV9 = (sourceRequest, outputRoot = 'out-v9') => {
  const request = structuredClone(sourceRequest);
  request.policy.v9ContractEnabled = true;
  request.policy.textStrategy = 'deterministic-first-frame-text-v9';
  request.beats
    .filter((beat) => beat.visualDecision?.class === 'paper-editorial')
    .forEach((beat) => {
      beat.paperScene.layoutContract = buildV9LayoutContract();
    });
  request.outputs = {
    routeLockPath: `${outputRoot}/route.json`,
    planPath: `${outputRoot}/plan.json`,
    assetSheetPath: `${outputRoot}/assets.md`,
    firstFramePromptManifestPath: `${outputRoot}/first-frame-prompts.json`,
    runningHubPromptManifestPath: `${outputRoot}/runninghub-prompts.json`,
    runningHubPromptSheetPath: `${outputRoot}/runninghub-prompts.md`,
    aiGeneratedVideoPromptManifestPath: `${outputRoot}/ai-generated-video-prompts.json`,
    aiGeneratedVideoPromptSheetPath: `${outputRoot}/ai-generated-video-prompts.md`,
    compileReceiptPath: `${outputRoot}/compile.json`,
    validationReceiptPath: `${outputRoot}/validation.json`,
  };
  return request;
};

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const requestTemplate = JSON.parse(
  readFileSync(
    path.resolve(testDirectory, '../templates/director-preproduction-request.v1.json'),
    'utf8',
  ),
);
assert.equal(requestTemplate.policy.v9ContractEnabled, true);
assert.equal(requestTemplate.directorProfile.profileId, 'paper-editorial-director-v9');
assert.equal(requestTemplate.directorProfile.profileVersion, '9.0.0');
assert.equal(requestTemplate.policy.textStrategy, 'deterministic-first-frame-text-v9');
assert.equal(
  requestTemplate.outputs.aiGeneratedVideoPromptManifestPath,
  '<NEW_AI_GENERATED_VIDEO_PROMPT_MANIFEST_PATH>',
);
assert.equal(
  requestTemplate.outputs.aiGeneratedVideoPromptSheetPath,
  '<NEW_AI_GENERATED_VIDEO_PROMPT_SHEET_PATH>',
);

const root = mkdtempSync(path.join(os.tmpdir(), 'koubo-preproduction-test-'));
try {
  const scriptPath = path.join(root, 'script.md');
  writeFileSync(
    scriptPath,
    '中小企业不用自己买服务器，算力正在变成可以按需租用的公共资源。\n现在看这段真实婚礼短片。\n没有真实素材时，用情景演绎说明老人接受访谈。\n',
  );
  const request = makeRequest(scriptPath);
  const positive = validatePreproductionRequest({request, projectRoot: root, profile});
  assert.equal(positive.ok, true, positive.errors.join('\n'));

  const v9Profile = {
    ...profile,
    profileId: 'paper-editorial-director-v9',
    profileVersion: '9.0.0',
  };
  const v9ProfileWithoutContract = structuredClone(request);
  v9ProfileWithoutContract.directorProfile.profileId = v9Profile.profileId;
  v9ProfileWithoutContract.directorProfile.profileVersion = v9Profile.profileVersion;
  const v9ProfileWithoutContractResult = validatePreproductionRequest({
    request: v9ProfileWithoutContract,
    projectRoot: root,
    profile: v9Profile,
  });
  assert.equal(v9ProfileWithoutContractResult.ok, false);
  assert.ok(
    v9ProfileWithoutContractResult.errors.includes(
      'PREPRODUCTION_V9_CONTRACT_REQUIRED_BY_PROFILE',
    ),
  );

  const v9MissingLayout = structuredClone(request);
  v9MissingLayout.policy.v9ContractEnabled = true;
  Object.assign(v9MissingLayout.outputs, {
    aiGeneratedVideoPromptManifestPath: 'out-v9-missing/ai-generated-video-prompts.json',
    aiGeneratedVideoPromptSheetPath: 'out-v9-missing/ai-generated-video-prompts.md',
  });
  const v9MissingLayoutResult = validatePreproductionRequest({
    request: v9MissingLayout,
    projectRoot: root,
    profile,
  });
  assert.equal(v9MissingLayoutResult.ok, false);
  assert.ok(v9MissingLayoutResult.errors.includes('PAPER_LAYOUT_CONTRACT_MISSING:B01'));

  const v9Request = enableV9(request);
  const v9Positive = validatePreproductionRequest({request: v9Request, projectRoot: root, profile});
  assert.equal(v9Positive.ok, true, v9Positive.errors.join('\n'));

  const v9MissingGroupBox = structuredClone(v9Request);
  v9MissingGroupBox.beats[0].paperScene.layoutContract.objectGroupBoxes.pop();
  const v9MissingGroupBoxResult = validatePreproductionRequest({
    request: v9MissingGroupBox,
    projectRoot: root,
    profile,
  });
  assert.equal(v9MissingGroupBoxResult.ok, false);
  assert.ok(
    v9MissingGroupBoxResult.errors.includes(
      'PAPER_LAYOUT_GROUP_BOX_BINDING_INVALID:B01:G5',
    ),
  );

  const v9MissingLabelBox = structuredClone(v9Request);
  v9MissingLabelBox.beats[0].paperScene.layoutContract.paperLabelSurfaceBoxes.pop();
  const v9MissingLabelBoxResult = validatePreproductionRequest({
    request: v9MissingLabelBox,
    projectRoot: root,
    profile,
  });
  assert.equal(v9MissingLabelBoxResult.ok, false);
  assert.ok(
    v9MissingLabelBoxResult.errors.includes(
      'PAPER_LAYOUT_LABEL_SURFACE_BOX_BINDING_INVALID:B01:N8',
    ),
  );

  const v9GroupOutsideSafeRect = structuredClone(v9Request);
  v9GroupOutsideSafeRect.beats[0].paperScene.layoutContract.objectGroupBoxes[0].box.x = 0;
  const v9GroupOutsideSafeRectResult = validatePreproductionRequest({
    request: v9GroupOutsideSafeRect,
    projectRoot: root,
    profile,
  });
  assert.equal(v9GroupOutsideSafeRectResult.ok, false);
  assert.ok(
    v9GroupOutsideSafeRectResult.errors.includes(
      'PAPER_LAYOUT_GROUP_BOX_OUTSIDE_CONTENT_SAFE_RECT:B01:G1',
    ),
  );

  const v9LabelInSubtitle = structuredClone(v9Request);
  const subtitleLayout = v9LabelInSubtitle.beats[0].paperScene.layoutContract;
  subtitleLayout.contentSafeRect.height = 0.85;
  subtitleLayout.objectGroupBoxes[0].box.height = 0.8;
  subtitleLayout.paperLabelSurfaceBoxes[0].box.y = 0.81;
  const v9LabelInSubtitleResult = validatePreproductionRequest({
    request: v9LabelInSubtitle,
    projectRoot: root,
    profile,
  });
  assert.equal(v9LabelInSubtitleResult.ok, false);
  assert.ok(
    v9LabelInSubtitleResult.errors.includes(
      'PAPER_LAYOUT_LABEL_SURFACE_BOX_INTRUDES_SUBTITLE:B01:N1',
    ),
  );

  const v9DecorationAllowed = structuredClone(v9Request);
  v9DecorationAllowed.beats[0].paperScene.layoutContract.generatedDecorationPolicy = 'allowed';
  const v9DecorationAllowedResult = validatePreproductionRequest({
    request: v9DecorationAllowed,
    projectRoot: root,
    profile,
  });
  assert.equal(v9DecorationAllowedResult.ok, false);
  assert.ok(
    v9DecorationAllowedResult.errors.includes(
      'PAPER_LAYOUT_GENERATED_DECORATION_NOT_FORBIDDEN:B01',
    ),
  );

  const missingUnlabeledDeclaration = structuredClone(request);
  delete missingUnlabeledDeclaration.beats[0].paperScene.labelBindingPolicy;
  const missingUnlabeledResult = validatePreproductionRequest({
    request: missingUnlabeledDeclaration,
    projectRoot: root,
    profile,
  });
  assert.equal(missingUnlabeledResult.ok, false);
  assert.ok(
    missingUnlabeledResult.errors.includes(
      'LABEL_OBJECT_BINDING_AMBIGUOUS:B01:UNLABELED_GROUPS_UNDECLARED_OR_MISMATCHED',
    ),
  );

  const crossBoundLabel = structuredClone(request);
  Object.assign(
    crossBoundLabel.beats[0].paperScene.nodes.find((node) => node.id === 'N4'),
    {groupId: 'G4', textVisibility: 'paper-label'},
  );
  crossBoundLabel.beats[0].paperScene.nodes.find((node) => node.id === 'N3').textVisibility =
    'visual-only';
  crossBoundLabel.beats[0].paperScene.textPlan = crossBoundLabel.beats[0].paperScene.textPlan
    .filter((item) => item.nodeId !== 'N3')
    .concat({
      nodeId: 'N4',
      text: '家族档案',
      role: 'diegetic-node-label',
      groupId: 'G4',
      surfaceId: 'G4-rigid-label-card',
      anchorQuad: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.2], [0.1, 0.2]],
      maxChars: 8,
      persistence: 'S5-to-end',
      occlusionOwner: 'none',
      ocrRequired: true,
      motionConstraint: 'rigid-surface',
      embeddingMode: 'first-frame-baked',
      trackingKeyframesRequired: false,
      enterStageId: 'S5',
      stageOffsetFrames: 0,
    });
  crossBoundLabel.beats[0].paperScene.stages.find((stage) => stage.id === 'S3').landingNodeIds = [
    'N5',
    'N6',
  ];
  crossBoundLabel.beats[0].paperScene.stages.find((stage) => stage.id === 'S5').landingNodeIds = [
    'N4',
    'N8',
    'N9',
  ];
  crossBoundLabel.beats[0].paperScene.labelBindingPolicy.unlabeledObjectGroups = [
    {groupId: 'G3', reason: '该组仅保留无字需求物件。'},
  ];
  const crossBoundResult = validatePreproductionRequest({
    request: crossBoundLabel,
    projectRoot: root,
    profile,
  });
  assert.equal(crossBoundResult.ok, false);
  assert.ok(
    crossBoundResult.errors.includes(
      'LABEL_OBJECT_BINDING_AMBIGUOUS:B01:N4:STAGE_GROUP_MISMATCH',
    ),
  );

  const symbolCueConflict = structuredClone(request);
  symbolCueConflict.beats[0].paperScene.objectGroups[2].material = '暖白人物与问题票';
  symbolCueConflict.beats[0].paperScene.stages[2].action = '真实人物问题票落到桌面';
  const symbolCueResult = validatePreproductionRequest({
    request: symbolCueConflict,
    projectRoot: root,
    profile,
  });
  assert.equal(symbolCueResult.ok, false);
  assert.ok(
    symbolCueResult.errors.some(
      (error) =>
        error ===
        'SYMBOL_CUE_CONFLICT:B01:objectGroups.G3.material:问题票:USE_纯空白需求卡',
    ),
  );

  const correctedNoTextFixture = structuredClone(request);
  correctedNoTextFixture.beats[0].paperScene.objectGroups[2].material =
    '暖白人物与纯空白需求卡';
  correctedNoTextFixture.beats[0].paperScene.stages[2].action =
    '一张完全空白、无图形无印记的需求卡落到人物旁的桌面';
  correctedNoTextFixture.beats[0].paperScene.prompt.firstFrame +=
    ' 禁止问题票、问号牌、编号卡、验收章、勾选、警告牌和二维码。';
  const correctedNoTextResult = validatePreproductionRequest({
    request: correctedNoTextFixture,
    projectRoot: root,
    profile,
  });
  assert.equal(correctedNoTextResult.ok, true, correctedNoTextResult.errors.join('\n'));

  const requestPath = path.join(root, 'request.json');
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const plan = compilePreproductionPlan({
    request,
    requestPath,
    profile,
    style,
  });
  assert.equal(plan.paperScenes.length, 1);
  assert.equal(plan.formalEligible, false);
  assert.equal(plan.postShootRebindRequired, true);

  const firstFrameManifest = buildFirstFramePromptManifest(plan);
  const runningHubManifest = buildRunningHubPromptManifest(plan);
  const handoffResult = validatePromptHandoffManifests({
    plan,
    firstFrameManifest,
    runningHubManifest,
  });
  assert.equal(handoffResult.ok, true, handoffResult.errors.join('\n'));
  assert.equal(firstFrameManifest.scenes.length, 1);
  assert.equal(runningHubManifest.scenes.length, 1);
  assert.equal(runningHubManifest.status, 'awaiting-text-baked-firstframes');
  assert.equal(
    firstFrameManifest.scenes[0].pairId,
    runningHubManifest.scenes[0].pairId,
  );
  assert.ok(Object.hasOwn(firstFrameManifest.scenes[0], 'firstFramePrompt'));
  assert.ok(!Object.hasOwn(firstFrameManifest.scenes[0], 'imageToVideoPrompt'));
  assert.ok(Object.hasOwn(runningHubManifest.scenes[0], 'imageToVideoPrompt'));
  assert.ok(!Object.hasOwn(runningHubManifest.scenes[0], 'firstFramePrompt'));
  assert.equal(firstFrameManifest.scenes[0].deterministicTextBake.enabled, true);
  assert.equal(
    runningHubManifest.scenes[0].inputFirstFrameFileName,
    firstFrameManifest.scenes[0].deterministicTextBake.outputImageFileName,
  );
  assert.equal(
    firstFrameManifest.scenes[0].textPlanSha256,
    runningHubManifest.scenes[0].inputFirstFrameTextPlanSha256,
  );
  assert.equal(firstFrameManifest.scenes[0].deterministicTextBake.anchorCalibrationRequired, true);

  const v9RequestPath = path.join(root, 'v9-request.json');
  writeFileSync(v9RequestPath, `${JSON.stringify(v9Request, null, 2)}\n`);
  const v9Plan = compilePreproductionPlan({
    request: v9Request,
    requestPath: v9RequestPath,
    profile,
    style,
  });
  const v9FirstFrameManifest = buildFirstFramePromptManifest(v9Plan);
  const v9RunningHubManifest = buildRunningHubPromptManifest(v9Plan);
  const v9AiManifest = buildAiGeneratedVideoPromptManifest(v9Plan);
  const v9HandoffResult = validatePromptHandoffManifests({
    plan: v9Plan,
    firstFrameManifest: v9FirstFrameManifest,
    runningHubManifest: v9RunningHubManifest,
    aiGeneratedVideoManifest: v9AiManifest,
  });
  assert.equal(v9HandoffResult.ok, true, v9HandoffResult.errors.join('\n'));
  assert.equal(v9AiManifest.status, 'not-required');
  assert.equal(v9AiManifest.itemCount, 0);
  assert.deepEqual(v9AiManifest.items, []);
  assert.equal(v9FirstFrameManifest.v9ContractEnabled, true);
  assert.deepEqual(
    v9FirstFrameManifest.scenes[0].layoutContract,
    v9Request.beats[0].paperScene.layoutContract,
  );
  assert.ok(
    v9FirstFrameManifest.scenes[0].firstFramePrompt.startsWith(
      v9Request.beats[0].paperScene.prompt.firstFrame,
    ),
  );
  assert.match(
    v9FirstFrameManifest.scenes[0].firstFramePrompt,
    /内容安全区：x=0\.0500, y=0\.0500, width=0\.9000, height=0\.7000/,
  );
  assert.match(
    v9FirstFrameManifest.scenes[0].firstFramePrompt,
    /字幕保留区：x=0\.0000, y=0\.8000, width=1\.0000, height=0\.2000/,
  );
  assert.match(
    v9FirstFrameManifest.scenes[0].firstFramePrompt,
    /generatedDecorationPolicy=forbidden/,
  );
  assert.match(
    v9FirstFrameManifest.scenes[0].firstFramePrompt,
    /宽区指导.*不要求逐像素贴合/,
  );
  assert.ok(!Object.hasOwn(v9RunningHubManifest.scenes[0], 'layoutContract'));
  assert.match(renderAiGeneratedVideoPromptSheet(v9Plan, v9AiManifest), /not-required/);

  const routedRequest = structuredClone(request);
  routedRequest.beats.push(
    {
      id: 'B02',
      order: 2,
      spokenLine: '现在看这段真实婚礼短片。',
      coreMeaning: '用用户真实素材作为主画面，本人在右下角继续讲解。',
      kind: 'real-person-action',
      visualDecision: {class: 'real-evidence', producer: 'user', fallback: 'blocked'},
      evidenceRefs: ['U01 用户婚礼短片'],
      presentation: {
        mode: 'real-media-with-presenter-inset',
        materialAudioMode: 'duck-under-narration',
        speakerIsExplainingThisAsset: true,
        minimumDurationSeconds: 3,
        presenter: {
          source: 'authoritative-talk-source',
          audioOwner: 'base-talk-only',
          duplicateVideoMuted: true,
          anchor: 'bottom-right',
          shape: 'circle',
        },
        transition: {enterFrames: 16, exitFrames: 12, hardCutForbidden: true},
        captions: {overlapForbidden: true, minimumGapPx: 24},
      },
    },
    {
      id: 'B03',
      order: 3,
      spokenLine: '没有真实素材时，用情景演绎说明老人接受访谈。',
      coreMeaning: '只作人物和环境情景演绎，不充当需求证据。',
      kind: 'real-person-action',
      visualDecision: {class: 'generated-video', producer: 'user', fallback: 'blocked'},
      evidenceRefs: [],
      generatedVideoBrief: {
        role: 'illustration-only',
        presentationMode: 'full-screen',
        evidenceEligible: false,
        purpose: '表现上门访谈的动作与情绪',
        prompt: '真实纪实风格，子女与老人围坐访谈，不出现可读文字。',
        disclosureRequired: true,
      },
    },
  );
  const routedResult = validatePreproductionRequest({
    request: routedRequest,
    projectRoot: root,
    profile,
  });
  assert.equal(routedResult.ok, true, routedResult.errors.join('\n'));
  const routedPlan = compilePreproductionPlan({
    request: routedRequest,
    requestPath,
    profile,
    style,
  });
  assert.equal(routedPlan.routeSummary.presenterInsetBeatCount, 1);
  assert.equal(routedPlan.routeSummary.generatedVideoBeatCount, 1);

  const v9AiRequest = structuredClone(v9Request);
  v9AiRequest.beats.push({
    id: 'B02',
    order: 2,
    spokenLine: '没有真实素材时，用情景演绎说明老人接受访谈。',
    coreMeaning: '只作人物和环境情景演绎，不充当需求证据。',
    kind: 'real-person-action',
    visualDecision: {class: 'generated-video', producer: 'user', fallback: 'blocked'},
    evidenceRefs: [],
    generatedVideoBrief: {
      role: 'illustration-only',
      presentationMode: 'full-screen',
      evidenceEligible: false,
      mode: 'text-to-video',
      durationSeconds: 6,
      purpose: '表现上门访谈的动作与情绪',
      prompt: '真实纪实风格，子女与老人围坐访谈，不出现可读文字。',
      negativePrompt: '禁止品牌标志、可读文字、医疗诊断和事实证明暗示。',
      disclosureRequired: true,
      manualExecutionRequired: true,
    },
  });
  const v9AiRequestResult = validatePreproductionRequest({
    request: v9AiRequest,
    projectRoot: root,
    profile,
  });
  assert.equal(v9AiRequestResult.ok, true, v9AiRequestResult.errors.join('\n'));
  const v9AiRequestPath = path.join(root, 'v9-ai-request.json');
  writeFileSync(v9AiRequestPath, `${JSON.stringify(v9AiRequest, null, 2)}\n`);
  const v9AiPlan = compilePreproductionPlan({
    request: v9AiRequest,
    requestPath: v9AiRequestPath,
    profile,
    style,
  });
  const v9AiFirstFrameManifest = buildFirstFramePromptManifest(v9AiPlan);
  const v9AiRunningHubManifest = buildRunningHubPromptManifest(v9AiPlan);
  const v9AiVideoManifest = buildAiGeneratedVideoPromptManifest(v9AiPlan);
  assert.equal(v9AiVideoManifest.status, 'manual-execution-required');
  assert.equal(v9AiVideoManifest.itemCount, 1);
  assert.deepEqual(
    Object.keys(v9AiVideoManifest.items[0]).sort(),
    [
      'beatId',
      'disclosureRequired',
      'durationSeconds',
      'evidenceEligible',
      'manualExecutionRequired',
      'mode',
      'negativePrompt',
      'negativePromptSha256',
      'outputFileName',
      'prompt',
      'promptSha256',
      'purpose',
      'sceneId',
    ].sort(),
  );
  assert.equal(v9AiVideoManifest.items[0].sceneId, 'A01');
  assert.equal(v9AiVideoManifest.items[0].beatId, 'B02');
  assert.equal(v9AiVideoManifest.items[0].outputFileName, 'A01_ai-generated-video.mp4');
  assert.equal(v9AiVideoManifest.items[0].manualExecutionRequired, true);
  assert.equal(v9AiVideoManifest.items[0].disclosureRequired, true);
  assert.equal(v9AiVideoManifest.items[0].evidenceEligible, false);
  const v9AiHandoffResult = validatePromptHandoffManifests({
    plan: v9AiPlan,
    firstFrameManifest: v9AiFirstFrameManifest,
    runningHubManifest: v9AiRunningHubManifest,
    aiGeneratedVideoManifest: v9AiVideoManifest,
  });
  assert.equal(v9AiHandoffResult.ok, true, v9AiHandoffResult.errors.join('\n'));

  const v9AiMissingNegativePrompt = structuredClone(v9AiRequest);
  delete v9AiMissingNegativePrompt.beats[1].generatedVideoBrief.negativePrompt;
  const v9AiMissingNegativePromptResult = validatePreproductionRequest({
    request: v9AiMissingNegativePrompt,
    projectRoot: root,
    profile,
  });
  assert.equal(v9AiMissingNegativePromptResult.ok, false);
  assert.ok(
    v9AiMissingNegativePromptResult.errors.includes(
      'GENERATED_VIDEO_NEGATIVE_PROMPT_MISSING:B02',
    ),
  );

  const mixedAiVideoManifest = structuredClone(v9AiVideoManifest);
  mixedAiVideoManifest.items[0].firstFramePrompt = '不得混入第三套提示词包';
  const mixedAiVideoManifestResult = validatePromptHandoffManifests({
    plan: v9AiPlan,
    firstFrameManifest: v9AiFirstFrameManifest,
    runningHubManifest: v9AiRunningHubManifest,
    aiGeneratedVideoManifest: mixedAiVideoManifest,
  });
  assert.equal(mixedAiVideoManifestResult.ok, false);
  assert.ok(
    mixedAiVideoManifestResult.errors.includes(
      'AI_VIDEO_PROMPT_MANIFEST_CONTAINS_PAPER_FIELDS:A01',
    ),
  );

  const mismatchedPair = structuredClone(runningHubManifest);
  mismatchedPair.scenes[0].pairId = 'P99-B99';
  const mismatchedPairResult = validatePromptHandoffManifests({
    plan,
    firstFrameManifest,
    runningHubManifest: mismatchedPair,
  });
  assert.equal(mismatchedPairResult.ok, false);
  assert.ok(
    mismatchedPairResult.errors.includes('RUNNINGHUB_PAIR_ID_MISMATCH:P01'),
  );

  const genericFallback = structuredClone(request);
  genericFallback.beats[0].visualDecision.class = 'remotion-information';
  const genericResult = validatePreproductionRequest({
    request: genericFallback,
    projectRoot: root,
    profile,
  });
  assert.equal(genericResult.ok, false);
  assert.ok(
    genericResult.errors.includes('PAPER_REQUIRED_BEAT_UNFULFILLED:B01'),
  );
  assert.ok(
    genericResult.errors.includes('GENERIC_CARD_CANNOT_SATISFY_PAPER_BEAT:B01'),
  );

  const missingText = structuredClone(request);
  missingText.beats[0].paperScene.textPlan = [];
  const textResult = validatePreproductionRequest({
    request: missingText,
    projectRoot: root,
    profile,
  });
  assert.equal(textResult.ok, false);
  assert.ok(textResult.errors.some((error) => error.startsWith('PAPER_TEXT_NODE_LABEL_MISMATCH')));

  const movingBakedText = structuredClone(request);
  movingBakedText.beats[0].paperScene.textPlan[0].motionConstraint = 'tracked-moving-surface';
  const movingBakedResult = validatePreproductionRequest({
    request: movingBakedText,
    projectRoot: root,
    profile,
  });
  assert.equal(movingBakedResult.ok, false);
  assert.ok(
    movingBakedResult.errors.includes('PAPER_FIRST_FRAME_BAKED_REQUIRES_RIGID_SURFACE:B01:N1'),
  );

  const screenNodeText = structuredClone(request);
  screenNodeText.beats[0].paperScene.textPlan[0].embeddingMode = 'screen-overlay';
  const screenNodeResult = validatePreproductionRequest({
    request: screenNodeText,
    projectRoot: root,
    profile,
  });
  assert.equal(screenNodeResult.ok, false);
  assert.ok(
    screenNodeResult.errors.includes('PAPER_TEXT_EMBEDDING_MODE_INVALID:B01:N1'),
  );

  const lateText = structuredClone(request);
  lateText.beats[0].paperScene.textPlan[0].stageOffsetFrames = 4;
  const lateTextResult = validatePreproductionRequest({
    request: lateText,
    projectRoot: root,
    profile,
  });
  assert.equal(lateTextResult.ok, false);
  assert.ok(lateTextResult.errors.includes('PAPER_TEXT_STAGE_OFFSET_INVALID:B01:N1'));

  const modelWritesText = structuredClone(request);
  modelWritesText.policy.modelGeneratedReadableTextAllowed = true;
  const modelTextResult = validatePreproductionRequest({
    request: modelWritesText,
    projectRoot: root,
    profile,
  });
  assert.equal(modelTextResult.ok, false);
  assert.ok(modelTextResult.errors.includes('PREPRODUCTION_MODEL_GENERATED_TEXT_NOT_BLOCKED'));

  const cliProfilePath = path.join(root, 'profile.json');
  const cliStylePath = path.join(root, 'style.json');
  writeFileSync(
    cliProfilePath,
    `${JSON.stringify({...profile, style: {path: 'style.json'}}, null, 2)}\n`,
  );
  writeFileSync(cliStylePath, `${JSON.stringify(style, null, 2)}\n`);
  const cliRequest = enableV9(v9AiRequest, 'out-v9-cli');
  cliRequest.directorProfile.path = 'profile.json';
  const cliRequestPath = path.join(root, 'v9-cli-request.json');
  writeFileSync(cliRequestPath, `${JSON.stringify(cliRequest, null, 2)}\n`);
  const scriptsRoot = path.resolve(testDirectory, '../scripts');
  const compileResult = spawnSync(
    process.execPath,
    [
      path.join(scriptsRoot, 'compile-preproduction-director.mjs'),
      '--request',
      cliRequestPath,
      '--repo-root',
      root,
    ],
    {encoding: 'utf8'},
  );
  assert.equal(compileResult.status, 0, compileResult.stderr || compileResult.stdout);
  const cliAiManifestPath = path.join(root, cliRequest.outputs.aiGeneratedVideoPromptManifestPath);
  const cliAiSheetPath = path.join(root, cliRequest.outputs.aiGeneratedVideoPromptSheetPath);
  assert.equal(existsSync(cliAiManifestPath), true);
  assert.equal(existsSync(cliAiSheetPath), true);
  const cliAiManifest = JSON.parse(readFileSync(cliAiManifestPath, 'utf8'));
  assert.equal(cliAiManifest.status, 'manual-execution-required');
  assert.equal(cliAiManifest.itemCount, 1);
  assert.equal(cliAiManifest.items[0].beatId, 'B02');
  const validateResult = spawnSync(
    process.execPath,
    [
      path.join(scriptsRoot, 'validate-preproduction-director.mjs'),
      '--request',
      cliRequestPath,
      '--repo-root',
      root,
    ],
    {encoding: 'utf8'},
  );
  assert.equal(validateResult.status, 0, validateResult.stderr || validateResult.stdout);
  const cliValidationReceipt = JSON.parse(
    readFileSync(path.join(root, cliRequest.outputs.validationReceiptPath), 'utf8'),
  );
  assert.equal(cliValidationReceipt.gates.normalizedPaperLayoutContractsRequired, true);
  assert.equal(cliValidationReceipt.gates.aiGeneratedVideoPromptPackageSeparated, true);
  assert.equal(
    cliValidationReceipt.artifacts.aiGeneratedVideoPromptManifest.sha256,
    sha256File(cliAiManifestPath),
  );

  const scriptDrift = structuredClone(request);
  writeFileSync(scriptPath, '文稿已经变更。\n');
  const driftResult = validatePreproductionRequest({
    request: scriptDrift,
    projectRoot: root,
    profile,
  });
  assert.equal(driftResult.ok, false);
  assert.ok(driftResult.errors.includes('PREPRODUCTION_SCRIPT_SHA_MISMATCH'));

  console.log(
    JSON.stringify({
      ok: true,
      positivePaperPlanCompiled: true,
      unlabeledObjectGroupsMustBeDeclared: true,
      crossBoundLabelRejected: true,
      symbolCueConflictRejected: true,
      correctedNoTextFixtureValidated: true,
      genericInformationFallbackRejected: true,
      missingNodeTextRejected: true,
      scriptDriftRejected: true,
      firstFrameAndImageToVideoPromptsSeparated: true,
      promptPairMismatchRejected: true,
      paperSurfaceBindingsRequired: true,
      silentTextTruncationRejected: true,
      movingFirstFrameBakeRejected: true,
      paperNodeScreenOverlayRejected: true,
      nodeStageOffsetOverThreeFramesRejected: true,
      modelGeneratedChineseRemainsBlocked: true,
      realMaterialPresenterInsetValidated: true,
      generatedVideoIllustrationBoundaryValidated: true,
      runningHubPrematureReadinessBlocked: true,
      legacyFixtureCompatibleWithoutV9: true,
      normalizedV9LayoutContractValidated: true,
      v9LayoutFailuresRejected: true,
      firstFrameNumericSafetyTermsAppended: true,
      aiGeneratedVideoPromptPackageSeparated: true,
      zeroAiVideoPackageMarkedNotRequired: true,
      v9CompilerAndValidatorExecuted: true,
    }),
  );
} finally {
  rmSync(root, {recursive: true, force: true});
}
