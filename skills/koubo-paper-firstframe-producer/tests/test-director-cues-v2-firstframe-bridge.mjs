import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildDirectorCuesV2Handoff} from '../../koubo-remotion-director/scripts/director-cues-v2-handoff-core.mjs';
import {sha256Json} from '../../koubo-remotion-director/scripts/preproduction-director-core.mjs';
import {
  DIRECTOR_CUES_V2_FIRSTFRAME_BRIDGE_RECEIPT_SCHEMA,
  DIRECTOR_CUES_V2_FIRSTFRAME_BRIDGE_SCHEMA,
  buildDirectorCuesV2FirstFrameBridge,
  validateDirectorCuesV2FirstFrameBridgeDirectory,
} from '../scripts/bridge-director-cues-v2-firstframe.mjs';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const bridgeCli = path.join(
  repositoryRoot,
  'skills/koubo-paper-firstframe-producer/scripts/bridge-director-cues-v2-firstframe.mjs',
);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const writeJson = (filePath, value) => writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

function createOfficialHandoffFixture(root) {
  const referenceBytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(referenceBytes, 0);
  Buffer.from('IHDR').copy(referenceBytes, 12);
  referenceBytes.writeUInt32BE(1920, 16);
  referenceBytes.writeUInt32BE(1080, 20);
  const referencePath = path.join(root, 'paper-reference.png');
  writeFileSync(referencePath, referenceBytes);
  const scriptText = '这个机制把输入压缩成结果。';
  const scriptPath = path.join(root, 'script.txt');
  writeFileSync(scriptPath, scriptText);
  const paperPrefix = '摄影级微缩纸艺定格，暖米色实体桌面，纤维卡纸、三层空间、真实接触阴影与柔和侧光，16:9。';
  const paperItem = {
    id: 'P04', beatId: 'B01', startAnchorText: '这个机制', endAnchorText: '压缩成结果',
    timingStatus: 'pre-shoot-text-anchor-only', durationSeconds: 4,
    purpose: 'illustration-only', evidenceEligible: false,
    reason: '让输入到结果的压缩过程可见。', visualRole: 'mechanism',
    visualMetaphor: '长纸带经过压缩门成为短纸束', composition: '侧视单向压缩台',
    primaryAction: '长纸带穿过压缩门停在托盘',
    textPlan: [
      {text: '输入', surface: '前景固定空白纸牌'},
      {text: '结果', surface: '后景固定空白纸牌'},
    ],
    referenceImageIds: ['REF01'],
    firstFramePrompt: `${paperPrefix}侧视中景，前景是一条平放的长纸带，中景是有可见瓦楞层的纸质压缩门，后景是空托盘；前景固定空白纸牌与后景固定空白纸牌分别由独立支架固定，所有物件保持静止，画面不含可读文字。`,
    videoPrompt: '基于已确认首帧，长纸带穿过压缩门停在托盘，纸带成为整齐短纸束，固定机位，两块纸牌和其他物件保持不动，不生成文字。',
    negativePrompt: ['不生成可读文字', '不重做场景', '不使用PPT卡片'],
  };
  const cues = {
    schemaVersion: 'koubo-director-cues/v2',
    taskId: 'director-v2-firstframe-bridge-test',
    status: 'ready-for-user-review',
    executionScope: 'director-only',
    handoffGate: {status: 'blocked-awaiting-user-approval', downstreamAllowed: false},
    inputScript: {path: 'script.txt', sha256: digest(Buffer.from(scriptText)), authority: 'user-confirmed-script'},
    routingPolicy: {
      selectionBasis: 'semantic-need-not-fixed-cadence', speakerIsFallback: true,
      generatedInsertMinimum: 0, paperInsertMinimum: 0, fixedCadenceForbidden: true,
      generatedVisualCannotServeAsEvidence: true, factVerificationSeparatedFromPrimaryVisual: true,
      constructedVisualPriority: ['paper-editorial', 'ai-generated-video'],
      aiGeneratedVideoUseCondition: 'concrete-human-or-environment-scene-paper-unnatural',
      shotcraftSelectionStage: 'post-shoot-edit-release',
      shotcraftEligibleRoutes: ['speaker', 'real-evidence'],
      shotcraftForbiddenInsideRoutes: ['paper-editorial', 'ai-generated-video'],
    },
    styleLocks: {
      aiGeneratedVideo: null,
      paperEditorial: {
        referenceImages: [{id: 'REF01', path: 'paper-reference.png', sha256: digest(referenceBytes), usage: 'style-mechanism-only'}],
        promptPrefix: paperPrefix,
        textPolicy: 'generated-base-image-then-deterministic-chinese',
        mustKeep: ['真实纸纤维', '三层空间', '接触阴影'],
        mustAvoid: ['PPT卡片', '塑料3D', '模型生成文字'],
      },
    },
    selectionSummary: {
      mainPoint: '抽象压缩机制用纸艺说明。', argumentFlow: ['纸艺解释机制'],
      routeCounts: {speaker: 0, 'real-evidence': 0, 'ai-generated-video': 0, 'paper-editorial': 1, shotcraftOpportunity: 0},
      routeRationales: {
        speaker: '该段机制画面比连续真人更容易理解。',
        'real-evidence': '没有必须展示的外部真实对象。',
        'ai-generated-video': '具体人物情景不会增加理解。',
        'paper-editorial': '抽象压缩关系需要物理隐喻。',
      },
      visualRhythmReason: '单段只在机制处切入纸艺。', protectedSpeakerBeatIds: [],
    },
    semanticBeats: [{
      id: 'B01', order: 1, scriptQuote: scriptText, rhetoricalRole: 'mechanism',
      claimClass: 'abstract-explanation', requiresFactCheck: false, factCheckId: null,
      primaryRoute: 'paper-editorial', routeCueId: 'P04',
      decisionReason: '抽象变化需要可见物理隐喻。', viewerGain: 'explain-mechanism',
    }],
    factChecks: [],
    routePlans: {
      realMaterials: {status: 'not-required', notRequiredReason: '没有需要展示的真实素材。', items: []},
      aiGeneratedVideos: {status: 'not-required', notRequiredReason: 'AI情景不会增加理解。', items: []},
      paperEditorials: {status: 'planned', notRequiredReason: null, items: [paperItem]},
    },
    shotcraftOpportunities: [],
    rhythmAudit: {basis: 'semantic-runs-not-seconds', fixedCadenceForbidden: true, longSpeakerRunsReviewed: true, runs: []},
  };
  const cuesPath = path.join(root, 'director-cues.v2.json');
  writeJson(cuesPath, cues);
  const approval = {
    schemaVersion: 'koubo-director-cues-user-approval/v2', status: 'approved', approved: true,
    taskId: cues.taskId, revisionId: 'r1',
    bindings: {directorCues: {path: 'director-cues.v2.json', sha256: digest(readFileSync(cuesPath))}},
    userQuote: '离线桥接测试批准，不构成现实生成授权。',
    approvedAt: '2026-09-12T12:00:00+08:00', exceptions: [],
  };
  const approvalPath = path.join(root, 'approval.v2.json');
  writeJson(approvalPath, approval);
  const profile = {
    schemaVersion: 'koubo-active-director-profile/v1', profileVersion: '9.1.1',
    scopeBoundary: {
      directorPlanningOutput: 'koubo-director-cues/v2', appliesAfter: 'user-approved-director-cues',
      appliesToDirectorPlanning: false, userApprovalRequiredBeforeDownstream: true,
    },
    routingPolicy: {
      mainVisualClasses: ['speaker', 'real-evidence', 'generated-video', 'paper-editorial'],
      directorCueRouteMap: {
        speaker: 'speaker', 'real-evidence': 'real-evidence',
        'ai-generated-video': 'generated-video', 'paper-editorial': 'paper-editorial',
      },
    },
  };
  mkdirSync(path.join(root, 'workflow'));
  writeJson(path.join(root, 'workflow/active-director-profile.v1.json'), profile);
  const handoff = buildDirectorCuesV2Handoff({
    projectRoot: root,
    cues: 'director-cues.v2.json',
    approval: 'approval.v2.json',
    profile: 'workflow/active-director-profile.v1.json',
    outputDir: 'official-handoff',
  });
  return {
    cuesPath,
    handoff,
    paperPath: path.join(root, handoff.artifacts.paperFirstFrame.path),
    paperVideoPath: path.join(root, handoff.artifacts.paperVideo.path),
    paperItem,
  };
}

test('official v2 paper child bridges to a v2-native first-frame manifest without video prompt leakage', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'director-v2-firstframe-bridge-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const fixture = createOfficialHandoffFixture(root);
  const outputDir = path.join(root, 'firstframe-bridge-r1');
  const result = buildDirectorCuesV2FirstFrameBridge({
    projectRoot: root,
    master: fixture.handoff.masterPath,
    handoffReceipt: fixture.handoff.receiptPath,
    paperFirstFrame: fixture.paperPath,
    selectedScene: 'P04',
    outputDir,
  });
  assert.equal(result.ok, true);
  assert.equal(result.selectedSceneId, 'P04');
  assert.equal(result.sceneCount, 1);
  const manifest = readJson(result.manifestPath);
  const receipt = readJson(result.receiptPath);
  const sourcePaper = readJson(fixture.paperPath);
  assert.equal(manifest.schemaVersion, 'koubo-paper-first-frame-prompt-manifest/v1');
  assert.equal(manifest.sourceDirectorSchema, 'koubo-director-cues/v2');
  assert.equal(manifest.sourceBridgeSchema, DIRECTOR_CUES_V2_FIRSTFRAME_BRIDGE_SCHEMA);
  assert.equal(manifest.requestId, `${manifest.sourceDirectorSchema.replace('koubo-director-cues/v2', 'v2-paper-firstframe')}:${manifest.taskId}:${manifest.revisionId}`);
  assert.equal(manifest.selectedSceneId, 'P04');
  assert.equal(manifest.samplePolicy, 'one-representative-scene');
  assert.equal(manifest.scenes[0].pairId, sourcePaper.items[0].pairId);
  assert.equal(manifest.scenes[0].pairSha256, sourcePaper.items[0].pairSha256);
  assert.equal(manifest.scenes[0].firstFramePrompt, fixture.paperItem.firstFramePrompt);
  assert.deepEqual(manifest.scenes[0].deterministicTextBake.labels.map((label) => label.text), ['输入', '结果']);
  assert.equal(
    manifest.scenes[0].deterministicTextBake.labelsSha256,
    sha256Json(manifest.scenes[0].deterministicTextBake.labels),
  );
  assert.equal(
    manifest.scenes[0].textPlanSha256,
    sha256Json({textPlan: manifest.scenes[0].deterministicTextBake.labels, screenTextPlan: []}),
  );
  assert.equal(JSON.stringify(manifest).includes(fixture.paperItem.videoPrompt), false);
  assert.equal(JSON.stringify(receipt).includes(fixture.paperItem.videoPrompt), false);
  assert.equal(receipt.schemaVersion, DIRECTOR_CUES_V2_FIRSTFRAME_BRIDGE_RECEIPT_SCHEMA);
  assert.equal(receipt.status, 'validated-v2-native-firstframe-input');
  assert.equal(receipt.promptIsolation.imageToVideoChildRead, false);
  assert.deepEqual(Object.keys(receipt.artifacts).sort(), [
    'directorCues', 'directorV2HandoffMaster', 'directorV2HandoffValidationReceipt',
    'firstFramePromptManifest', 'paperFirstFrameHandoff', 'userApproval',
  ].sort());
  for (const source of [
    manifest.sourceDirectorCues,
    manifest.sourceUserApproval,
    manifest.sourceDirectorV2HandoffMaster,
    manifest.sourceDirectorV2HandoffValidationReceipt,
    manifest.sourcePaperFirstFrameHandoff,
    ...Object.values(receipt.artifacts),
  ]) {
    assert.equal(path.isAbsolute(source.path), true);
    assert.equal(digest(readFileSync(source.path)), source.sha256);
  }
  assert.equal(validateDirectorCuesV2FirstFrameBridgeDirectory({projectRoot: root, outputDir}).ok, true);
  assert.throws(() => buildDirectorCuesV2FirstFrameBridge({
    projectRoot: root,
    master: fixture.handoff.masterPath,
    handoffReceipt: fixture.handoff.receiptPath,
    paperFirstFrame: fixture.paperPath,
    selectedScene: 'P04',
    outputDir,
  }), /OUTPUT_ALREADY_EXISTS/u);
});

test('bridge validates only the signed first-frame branch and rejects wrong scene or source binding', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'director-v2-firstframe-isolation-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const fixture = createOfficialHandoffFixture(root);
  const hiddenVideoPath = `${fixture.paperVideoPath}.not-readable-by-firstframe-bridge`;
  renameSync(fixture.paperVideoPath, hiddenVideoPath);
  const cliResult = spawnSync(process.execPath, [
    bridgeCli,
    '--project-root', root,
    '--master', fixture.handoff.masterPath,
    '--handoff-receipt', fixture.handoff.receiptPath,
    '--paper-firstframe', fixture.paperPath,
    '--selected-scene', 'P04',
    '--output-dir', path.join(root, 'isolated-bridge'),
  ], {encoding: 'utf8'});
  assert.equal(cliResult.status, 0, cliResult.stderr);
  assert.equal(existsSync(path.join(root, 'isolated-bridge/first-frame-prompts.v1.json')), true);

  const wrongScene = spawnSync(process.execPath, [
    bridgeCli,
    '--project-root', root,
    '--master', fixture.handoff.masterPath,
    '--handoff-receipt', fixture.handoff.receiptPath,
    '--paper-firstframe', fixture.paperPath,
    '--selected-scene', 'P99',
    '--output-dir', path.join(root, 'wrong-scene'),
  ], {encoding: 'utf8'});
  assert.notEqual(wrongScene.status, 0);
  assert.match(wrongScene.stderr, /SELECTED_SCENE_UNKNOWN:P99/u);
  assert.equal(existsSync(path.join(root, 'wrong-scene')), false);

  const copiedPaperPath = path.join(root, 'unbound-paper-copy.json');
  writeFileSync(copiedPaperPath, readFileSync(fixture.paperPath));
  const wrongBinding = spawnSync(process.execPath, [
    bridgeCli,
    '--project-root', root,
    '--master', fixture.handoff.masterPath,
    '--handoff-receipt', fixture.handoff.receiptPath,
    '--paper-firstframe', copiedPaperPath,
    '--selected-scene', 'P04',
    '--output-dir', path.join(root, 'wrong-binding'),
  ], {encoding: 'utf8'});
  assert.notEqual(wrongBinding.status, 0);
  assert.match(wrongBinding.stderr, /MASTER_PAPER_FIRSTFRAME_PATH_OR_SHA_MISMATCH/u);
  assert.equal(existsSync(path.join(root, 'wrong-binding')), false);

  writeFileSync(fixture.cuesPath, `${readFileSync(fixture.cuesPath, 'utf8')}\n`);
  const cuesDrift = spawnSync(process.execPath, [
    bridgeCli,
    '--project-root', root,
    '--master', fixture.handoff.masterPath,
    '--handoff-receipt', fixture.handoff.receiptPath,
    '--paper-firstframe', fixture.paperPath,
    '--selected-scene', 'P04',
    '--output-dir', path.join(root, 'cues-drift'),
  ], {encoding: 'utf8'});
  assert.notEqual(cuesDrift.status, 0);
  assert.match(cuesDrift.stderr, /SOURCE_CUES_SHA_MISMATCH/u);
  assert.equal(existsSync(path.join(root, 'cues-drift')), false);
});
