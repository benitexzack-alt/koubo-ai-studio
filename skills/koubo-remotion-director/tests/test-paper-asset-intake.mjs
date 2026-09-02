#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildSceneIdentity,
  sha256File,
} from '../scripts/preproduction-director-core.mjs';
import {validatePaperAssetIntake} from '../scripts/paper-asset-intake-core.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'koubo-paper-asset-intake-test-'));
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = path.join(skillRoot, 'scripts/build-paper-asset-contact-sheet.mjs');
const validateScript = path.join(skillRoot, 'scripts/validate-paper-generated-asset-intake.mjs');
const run = (binary, args) =>
  spawnSync(binary, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

try {
  const scene = {
    beatId: 'B01',
    title: '算力进入业务',
    prompt: {firstFrame: '无文字纸艺场景', motion: '纸片按顺序装配'},
    objectGroups: [
      {id: 'G1'},
      {id: 'G2'},
      {id: 'G3'},
    ],
    stages: [
      {id: 'S1'},
      {id: 'S2'},
      {id: 'S3'},
      {id: 'S4'},
    ],
    textPlan: [
      {
        nodeId: 'N1',
        text: '按需租用',
        embeddingMode: 'tracked-paper-surface',
      },
    ],
  };
  const planPath = path.join(root, 'plan.json');
  const plan = {
    taskId: 'asset-intake-test',
    phase: 'post-shoot',
    status: 'candidate-preview-required',
    formalEligible: false,
    spokenAuthority: 'recorded-audio',
    paperScenes: [scene],
  };
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  const identity = buildSceneIdentity(scene, 0);

  const sourceFramePath = path.join(root, 'first-frame.png');
  const firstPath = path.join(root, 'first.png');
  const middlePath = path.join(root, 'middle.png');
  const lastPath = path.join(root, 'last.png');
  for (const [filePath, color] of [
    [sourceFramePath, '#E8D6AF'],
    [firstPath, '#274C77'],
    [middlePath, '#F4D35E'],
    [lastPath, '#2A9D8F'],
  ]) {
    const result = run('magick', ['-size', '640x360', `xc:${color}`, filePath]);
    assert.equal(result.status, 0, result.stderr);
  }
  const generatedPath = path.join(root, '视频.mp4');
  writeFileSync(generatedPath, 'source-generated-video');
  const canonicalName = `P01__${identity.pairSha256.slice(0, 8)}.mp4`;
  const candidatePath = path.join(root, canonicalName);
  writeFileSync(candidatePath, 'production-bound-video');
  const mediaQaPath = path.join(root, 'media-qa.json');
  writeFileSync(
    mediaQaPath,
    `${JSON.stringify({fullDecodePassed: true, videoSha256: sha256File(candidatePath)}, null, 2)}\n`,
  );

  const requestPath = path.join(root, 'asset-intake.json');
  const request = {
    schemaVersion: 'koubo-paper-generated-asset-intake/v1',
    taskId: plan.taskId,
    sourcePlan: {path: planPath, sha256: sha256File(planPath)},
    contactSheetFontPath: path.join(os.homedir(), 'Library/Fonts/NotoSansCJKsc-Bold.otf'),
    assets: [
      {
        sceneId: identity.sceneId,
        pairId: identity.pairId,
        pairSha256: identity.pairSha256,
        textPlanSha256: identity.textPlanSha256,
        inputFirstFrame: {
          path: sourceFramePath,
          sha256: sha256File(sourceFramePath),
          pHash: '0123456789abcdef',
        },
        generatedVideo: {path: generatedPath, sha256: sha256File(generatedPath)},
        productionCandidate: {
          path: candidatePath,
          sha256: sha256File(candidatePath),
          canonicalFileName: canonicalName,
        },
        evidenceFrames: [
          {moment: 'first', path: firstPath, sha256: sha256File(firstPath)},
          {moment: 'middle', path: middlePath, sha256: sha256File(middlePath)},
          {moment: 'last', path: lastPath, sha256: sha256File(lastPath)},
        ],
        mediaQaReceipt: {path: mediaQaPath, sha256: sha256File(mediaQaPath)},
        expectedObjectGroupIds: ['G1', 'G2', 'G3'],
        expectedStageIds: ['S1', 'S2', 'S3', 'S4'],
        semanticReview: {
          status: 'exact',
          object: '算力底座与企业需求',
          change: '算力从底座进入业务',
          spokenConsistency: '与当前口播的按需调用一致',
          ownSceneClosest: true,
          mostSimilarSceneId: 'P01',
        },
        silentViewReview: {
          status: 'passed',
          objectAnswer: '算力底座',
          relationshipOrChangeAnswer: '资源进入企业业务',
          spokenConsistencyAnswer: '对应按需租用这一句',
        },
        mechanismEvidence: {
          inputMoment: 'first',
          actionMoment: 'middle',
          outputMoment: 'last',
          visibleStateChange: true,
        },
        textQa: {
          status: 'passed',
          driftFree: true,
          samples: [
            {moment: 'first', expectedTexts: [], recognizedTexts: [], exact: true},
            {moment: 'middle', expectedTexts: ['按需租用'], recognizedTexts: ['按需租用'], exact: true},
            {moment: 'last', expectedTexts: ['按需租用'], recognizedTexts: ['按需租用'], exact: true},
          ],
        },
      },
    ],
    outputs: {
      contactSheetPath: path.join(root, 'contact-sheet.png'),
      contactSheetManifestPath: path.join(root, 'contact-sheet.json'),
      validationReceiptPath: path.join(root, 'validation-receipt.json'),
    },
  };
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`);

  const build = run(process.execPath, [
    buildScript,
    '--request',
    requestPath,
    '--repo-root',
    root,
  ]);
  assert.equal(build.status, 0, build.stderr);
  assert.equal(existsSync(request.outputs.contactSheetPath), true);
  assert.equal(existsSync(request.outputs.contactSheetManifestPath), true);

  const validation = run(process.execPath, [
    validateScript,
    '--request',
    requestPath,
    '--repo-root',
    root,
  ]);
  assert.equal(validation.status, 0, validation.stderr);
  const receipt = JSON.parse(readFileSync(request.outputs.validationReceiptPath, 'utf8'));
  assert.equal(receipt.gates.contactSheetBuiltFromBoundAssets, true);
  assert.equal(receipt.gates.silentViewRetellingPassed, true);
  assert.equal(receipt.gates.inputActionOutputPassed, true);

  const falseOcrRequest = structuredClone(request);
  falseOcrRequest.assets[0].textQa.samples[1].recognizedTexts = ['错误节点'];
  const falseOcr = validatePaperAssetIntake({
    request: falseOcrRequest,
    requestPath,
    projectRoot: root,
    requireContactSheet: false,
  });
  assert.equal(falseOcr.ok, false);
  assert.ok(falseOcr.errors.includes('PAPER_ASSET_TEXT_QA_SAMPLE_COVERAGE_INVALID:P01'));

  writeFileSync(candidatePath, 'mutated-production-bound-video');
  const stale = validatePaperAssetIntake({
    request,
    requestPath,
    projectRoot: root,
    requireContactSheet: true,
  });
  assert.equal(stale.ok, false);
  assert.ok(stale.errors.includes('PAPER_ASSET_PRODUCTION_CANDIDATE:P01_SHA_MISMATCH'));

  console.log(
    JSON.stringify({
      ok: true,
      sourceIdentityBound: true,
      contactSheetBoundToFormalAssetOrderAndSha: true,
      silentViewRetellingRequired: true,
      inputActionOutputRequired: true,
      textFirstMiddleLastRequired: true,
      falseOcrDeclarationRejected: true,
      staleCandidateRejected: true,
    }),
  );
} finally {
  rmSync(root, {recursive: true, force: true});
}
