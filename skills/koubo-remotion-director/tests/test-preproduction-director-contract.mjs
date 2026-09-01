#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildFirstFramePromptManifest,
  buildRunningHubPromptManifest,
  compilePreproductionPlan,
  sha256File,
  validatePromptHandoffManifests,
  validatePreproductionRequest,
} from '../scripts/preproduction-director-core.mjs';

const profile = {
  profileId: 'paper-editorial-director-v3',
  profileVersion: '3.0.0',
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
    textStrategy: 'remotion-deterministic-overlay',
    generatedReadableTextAllowed: false,
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
          {id: 'N1', label: '智算中心', groupId: 'G1', role: 'source'},
          {id: 'N2', label: '算力资源池', groupId: 'G2', role: 'pool'},
          {id: 'N3', label: '按需租用', groupId: 'G2', role: 'rule'},
          {id: 'N4', label: '知识库', groupId: 'G3', role: 'need'},
          {id: 'N5', label: '智能体', groupId: 'G3', role: 'need'},
          {id: 'N6', label: '工作流', groupId: 'G3', role: 'need'},
          {id: 'N7', label: '调度', groupId: 'G4', role: 'path'},
          {id: 'N8', label: '结果', groupId: 'G5', role: 'output'},
          {id: 'N9', label: '人工确认', groupId: 'G5', role: 'boundary'},
        ],
        stages: [
          {id: 'S1', order: 1, action: '底座展开', subject: 'G1', landingNodeIds: ['N1'], sfxRole: 'paper-unfold'},
          {id: 'S2', order: 2, action: '资源池卡入', subject: 'G2', landingNodeIds: ['N2', 'N3'], sfxRole: 'paper-click'},
          {id: 'S3', order: 3, action: '需求卡进入', subject: 'G3', landingNodeIds: ['N4', 'N5', 'N6'], sfxRole: 'paper-slide'},
          {id: 'S4', order: 4, action: '棉线连接并盖章', subject: 'G4', landingNodeIds: ['N7', 'N8', 'N9'], sfxRole: 'stamp'},
        ],
        textPlan: [
          ['N1', '智算中心', 'S1', 'left-back'],
          ['N2', '算力资源池', 'S2', 'center'],
          ['N3', '按需租用', 'S2', 'center-front'],
          ['N4', '知识库', 'S3', 'right-top'],
          ['N5', '智能体', 'S3', 'right-middle'],
          ['N6', '工作流', 'S3', 'right-bottom'],
          ['N7', '调度', 'S4', 'path'],
          ['N8', '结果', 'S4', 'front'],
          ['N9', '人工确认', 'S4', 'front-right'],
        ].map(([nodeId, text, enterStageId, position]) => ({
          nodeId,
          text,
          enterStageId,
          position,
        })),
        prompt: {
          firstFrame: '摄影级手作纸艺微缩场景，算力资源池与企业需求卡分层摆放，无可读文字。',
          motion: '纸质底座展开，资源池卡入，需求卡顺序滑入，棉线连接到结果盒并盖章。',
          generatedReadableTextAllowed: false,
        },
      },
    },
  ],
});

const root = mkdtempSync(path.join(os.tmpdir(), 'koubo-preproduction-test-'));
try {
  const scriptPath = path.join(root, 'script.md');
  writeFileSync(
    scriptPath,
    '中小企业不用自己买服务器，算力正在变成可以按需租用的公共资源。\n',
  );
  const request = makeRequest(scriptPath);
  const positive = validatePreproductionRequest({request, projectRoot: root, profile});
  assert.equal(positive.ok, true, positive.errors.join('\n'));

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
  assert.equal(
    firstFrameManifest.scenes[0].pairId,
    runningHubManifest.scenes[0].pairId,
  );
  assert.ok(Object.hasOwn(firstFrameManifest.scenes[0], 'firstFramePrompt'));
  assert.ok(!Object.hasOwn(firstFrameManifest.scenes[0], 'imageToVideoPrompt'));
  assert.ok(Object.hasOwn(runningHubManifest.scenes[0], 'imageToVideoPrompt'));
  assert.ok(!Object.hasOwn(runningHubManifest.scenes[0], 'firstFramePrompt'));

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
      genericInformationFallbackRejected: true,
      missingNodeTextRejected: true,
      scriptDriftRejected: true,
      firstFrameAndImageToVideoPromptsSeparated: true,
      promptPairMismatchRejected: true,
    }),
  );
} finally {
  rmSync(root, {recursive: true, force: true});
}
