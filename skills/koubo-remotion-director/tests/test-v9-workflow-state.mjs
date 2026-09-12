import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createNativePreproductionFixture, runDirectorCli} from './fixtures/v9-native-preproduction.mjs';
import {buildDirectorCuesV2Handoff} from '../scripts/director-cues-v2-handoff-core.mjs';
import {
  buildV2LegacyGenerationBridgeReceipt,
  validateV2LegacyGenerationBridgeReceipt,
} from '../scripts/v2-legacy-generation-bridge-core.mjs';
import {
  V2_DIRECT_HANDOFF_FORMAT,
  V9_STAGES,
  validateV9ProductionState,
} from '../scripts/v9-workflow-state-core.mjs';

const sha = 'a'.repeat(64);
const binding = (name) => ({path: `evidence/${name}.json`, sha256: sha});

const requiredArtifacts = {
  'script-confirmed': ['script', 'scriptUserConfirmation'],
  'director-prompt-packs-ready': [
    'directorRequest',
    'directorPlan',
    'directorValidation',
    'firstFramePromptManifest',
    'imageToVideoPromptManifest',
    'aiVideoPromptManifest',
  ],
  'generation-handoff-ready': [
    'generationInventory',
    'generationOwnershipReceipt',
    'directorCues',
    'directorCuesUserApproval',
    'directorCuesHandoff',
    'directorCuesHandoffValidationReceipt',
  ],
  'asset-intake-passed': ['talkingHeadSource', 'requiredAssetsManifest', 'assetIntakeReceipt'],
  'postshoot-rebound': [
    'spokenSourceBinding',
    'postshootRebindReceipt',
    'shotcraftSelectionPlan',
    'shotcraftAutoMatchRequest',
    'shotcraftAutoMatchReceipt',
    'shotcraftExperienceLookupReceipt',
  ],
  'candidate-preview-rendered': [
    'candidatePreview',
    'candidateQaReceipt',
    'shotcraftApplicationReceipt',
  ],
  'candidate-preview-user-approved': [
    'candidateUserAcceptance',
    'shotcraftExperienceWriteReceipt',
  ],
  'formal-rendered': ['formalVideo', 'formalQaReceipt'],
  'release-package-ready': ['releaseRecord', 'releasePackageReceipt'],
};

function buildState(stageCount, gateOverrides = {}) {
  const stageHistory = V9_STAGES.slice(0, stageCount).map((stage) => ({
    stage,
    completedAt: '2026-09-05T02:30:00+08:00',
    artifacts: Object.fromEntries(
      requiredArtifacts[stage].map((name) => [name, binding(`${stage}-${name}`)]),
    ),
  }));
  const completed = new Set(stageHistory.map((item) => item.stage));
  const previewApproved = completed.has('candidate-preview-user-approved');
  const formalRendered = completed.has('formal-rendered');
  const releaseReady = completed.has('release-package-ready');
  return {
    schemaVersion: 'koubo-v9-production-state/v1',
    taskId: 'task-v9-test',
    revisionId: 'candidate-v9-r1',
    status: releaseReady
      ? 'ready-for-user-review'
      : formalRendered
        ? 'formal-candidate-ready'
        : previewApproved
          ? 'formal-authorized'
          : 'candidate-preview-required',
    directorProfile: {
      profileId: 'paper-editorial-director-v9',
      profileVersion: '9.0.0',
    },
    currentStage: stageHistory.at(-1).stage,
    stageHistory,
    gates: {
      formalEnabled: previewApproved,
      releasePackageEnabled: formalRendered,
      publicationEnabled: false,
      externalActionsRequireExplicitAuthorization: true,
      ...gateOverrides,
    },
    spokenSourcePolicy: {
      subtitleAuthority: 'actual-recording',
      preShootScriptRoleAfterRecording: 'comparison-only',
    },
    exclusions: {
      old189SecondChainExcluded: true,
      retiredPaperV1Excluded: true,
      failedDirectorMastersExcluded: true,
      supersededRevisionReuseForbidden: true,
    },
  };
}

test('V9 accepts the script-confirmed start state', () => {
  const result = validateV9ProductionState({state: buildState(1)});
  assert.equal(result.ok, true);
  assert.equal(result.nextStage, 'director-prompt-packs-ready');
  assert.equal(result.formalEnabled, false);
});

test('V9.1 requires automatic matching and experience lookup at postshoot rebound', (t) => {
  const fixture = strictFixture(t, 5);
  delete fixture.state.stageHistory[4].artifacts.shotcraftAutoMatchReceipt;
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_ARTIFACT_BINDING_INVALID:postshoot-rebound:shotcraftAutoMatchReceipt'));
});

test('V9.1 requires the accepted preview to be written into the experience ledger', (t) => {
  const fixture = strictFixture(t, 7);
  delete fixture.state.stageHistory[6].artifacts.shotcraftExperienceWriteReceipt;
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_ARTIFACT_BINDING_INVALID:candidate-preview-user-approved:shotcraftExperienceWriteReceipt'));
});

test('V9.1 semantic v2 blocks generation handoff until the complete director plan is user-approved', (t) => {
  const fixture = strictFixture(t, 3);
  const state = fixture.state;
  const saved = structuredClone(state.stageHistory[2].artifacts);
  for (const key of [
    'directorCues',
    'directorCuesUserApproval',
    'directorCuesHandoff',
    'directorCuesHandoffValidationReceipt',
  ]) delete state.stageHistory[2].artifacts[key];
  const blocked = fixture.validate();
  assert.equal(blocked.ok, false);
  assert.ok(blocked.errors.includes(
    'V9_ARTIFACT_BINDING_INVALID:generation-handoff-ready:directorCues',
  ));
  assert.ok(blocked.errors.includes(
    'V9_ARTIFACT_BINDING_INVALID:generation-handoff-ready:directorCuesUserApproval',
  ));
  assert.ok(blocked.errors.includes(
    'V9_ARTIFACT_BINDING_INVALID:generation-handoff-ready:directorCuesHandoff',
  ));
  assert.ok(blocked.errors.includes(
    'V9_ARTIFACT_BINDING_INVALID:generation-handoff-ready:directorCuesHandoffValidationReceipt',
  ));

  Object.assign(state.stageHistory[2].artifacts, saved);
  const ready = fixture.validate();
  assert.equal(ready.ok, true, ready.errors.join('\n'));
});

test('V9 rejects skipped or reordered stages', () => {
  const state = buildState(3);
  state.stageHistory[1].stage = 'asset-intake-passed';
  const result = validateV9ProductionState({state});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith('V9_STAGE_ORDER_INVALID')));
});

test('V9 rejects formal enablement before the user accepts the candidate preview', () => {
  const result = validateV9ProductionState({
    state: buildState(6, {formalEnabled: true}),
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_FORMAL_ENABLED_BEFORE_PREVIEW_ACCEPTANCE'));
});

test('V9 rejects a missing director prompt pack', () => {
  const state = buildState(2);
  delete state.stageHistory[1].artifacts.aiVideoPromptManifest;
  const result = validateV9ProductionState({state});
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.includes(
      'V9_ARTIFACT_BINDING_INVALID:director-prompt-packs-ready:aiVideoPromptManifest',
    ),
  );
});

test('V9 accepts the complete release-package state while publication stays disabled', () => {
  const result = validateV9ProductionState({state: buildState(V9_STAGES.length)});
  assert.equal(result.ok, true);
  assert.equal(result.nextStage, null);
  assert.equal(result.formalEnabled, false);
  assert.equal(result.releasePackageEnabled, false);
});

const receiptTypes = {
  scriptUserConfirmation: ['koubo-pre-shoot-user-confirmation/v1', 'approved'],
  directorRequest: ['koubo-director-preproduction-request/v1', 'ready-for-validation'],
  directorPlan: ['koubo-director-preproduction-plan/v1', 'provisional-previsualization'],
  directorValidation: ['koubo-director-validation-receipt/v1', 'validated-provisional-previsualization'],
  firstFramePromptManifest: ['koubo-paper-first-frame-prompt-manifest/v1', 'automation-input-ready'],
  imageToVideoPromptManifest: ['koubo-runninghub-image-to-video-prompt-manifest/v1', 'awaiting-text-baked-firstframes'],
  aiVideoPromptManifest: ['koubo-ai-generated-video-prompt-manifest/v1', 'not-required'],
  generationInventory: ['koubo-generation-inventory/v1', 'handoff-ready'],
  generationOwnershipReceipt: ['koubo-generation-ownership-receipt/v1', 'ownership-confirmed'],
  requiredAssetsManifest: ['koubo-required-assets-manifest/v1', 'ready-for-intake'],
  assetIntakeReceipt: ['koubo-paper-generated-asset-intake-receipt/v1', 'validated-candidate-assets-ready-for-preview'],
  spokenSourceBinding: ['koubo-spoken-source-binding/v1', 'validated'],
  postshootRebindReceipt: ['koubo-director-postshoot-validation-receipt/v1', 'validated-candidate-preview-required'],
  shotcraftSelectionPlan: ['koubo-shotcraft-director-selection/v1', 'selection-ready'],
  shotcraftAutoMatchRequest: ['koubo-shotcraft-auto-match-request/v1', 'ready-for-validation'],
  shotcraftAutoMatchReceipt: ['koubo-shotcraft-auto-match-receipt/v1', 'candidate-match-ready'],
  shotcraftExperienceLookupReceipt: ['koubo-shotcraft-experience-lookup-receipt/v1', 'lookup-complete'],
  candidateQaReceipt: ['koubo-candidate-qa-receipt/v1', 'passed'],
  shotcraftApplicationReceipt: ['koubo-shotcraft-application-receipt/v1', 'passed'],
  candidateUserAcceptance: ['koubo-candidate-user-acceptance/v1', 'approved'],
  shotcraftExperienceWriteReceipt: ['koubo-shotcraft-experience-write-receipt/v1', 'experience-recorded'],
  formalQaReceipt: ['koubo-formal-qa-receipt/v1', 'passed'],
  releaseRecord: ['koubo-release-record/v1', 'ready-for-user-review'],
  releasePackageReceipt: ['koubo-release-package-receipt/v1', 'passed'],
};
const hashFile = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const hashText = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

function attachSemanticDirectorV2Fixture(fixture) {
  const {state, projectRoot, documents, bindings, persist} = fixture;
  const generationRecord = state.stageHistory.find((item) => item.stage === 'generation-handoff-ready');
  if (!generationRecord) return;
  const writeJson = (relative, value) => {
    const file = path.join(projectRoot, relative);
    mkdirSync(path.dirname(file), {recursive: true});
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    return file;
  };
  const bindFile = (relative) => ({path: relative, sha256: hashFile(path.join(projectRoot, relative))});
  const scriptText = readFileSync(path.join(projectRoot, bindings.script.path), 'utf8');
  const aiPrefix = '写实编辑部纪实风格，暖中性自然光，真实工作空间，深蓝与暖白色调，16:9。';
  const cues = {
    schemaVersion: 'koubo-director-cues/v2',
    taskId: state.taskId,
    status: 'ready-for-user-review',
    executionScope: 'director-only',
    handoffGate: {status: 'blocked-awaiting-user-approval', downstreamAllowed: false},
    inputScript: {...bindings.script, authority: 'user-confirmed-script'},
    routingPolicy: {
      selectionBasis: 'semantic-need-not-fixed-cadence', speakerIsFallback: true,
      generatedInsertMinimum: 0, paperInsertMinimum: 0, fixedCadenceForbidden: true,
      generatedVisualCannotServeAsEvidence: true, shotcraftSelectionStage: 'post-shoot-edit-release',
      shotcraftEligibleRoutes: ['speaker', 'real-evidence'],
      shotcraftForbiddenInsideRoutes: ['paper-editorial', 'ai-generated-video'],
    },
    styleLocks: {
      aiGeneratedVideo: {
        referenceImages: [],
        promptPrefix: aiPrefix,
        mustKeep: ['纪实摄影', '真实空间', '暖中性光'],
        mustAvoid: ['伪造证据', '真实品牌复刻', '模型可读文字'],
      },
      paperEditorial: null,
    },
    selectionSummary: {
      mainPoint: '状态机测试只验证当前 v2 AI 导演表与下游交接是否同源。',
      argumentFlow: ['完整脚本由同一个离线 AI 情景测试 beat 承接'],
      routeCounts: {speaker: 0, 'real-evidence': 0, 'ai-generated-video': 1, 'paper-editorial': 0, shotcraftOpportunity: 0},
      routeRationales: {
        speaker: '测试夹具不执行真人分路。',
        'real-evidence': '测试夹具没有执行真实素材分路。',
        'ai-generated-video': '离线通用场景用于验证 v2 到旧 AI 清单的确定性转换。',
        'paper-editorial': '测试夹具没有执行纸艺分路。',
      },
      visualRhythmReason: '单一离线测试 beat 只用于验证状态绑定，不作为真实导演方案。',
      protectedSpeakerBeatIds: [],
    },
    semanticBeats: [{
      id: 'B01', order: 1, scriptQuote: scriptText, rhetoricalRole: 'state-contract-fixture',
      claimClass: 'generic-illustration', requiresRealEvidence: false, primaryRoute: 'ai-generated-video',
      routeCueId: 'G01', decisionReason: '离线通用场景只验证状态合同。', viewerGain: 'make-scene-concrete',
    }],
    routePlans: {
      realMaterials: {status: 'not-required', notRequiredReason: '状态合同测试不执行真实素材分路。', items: []},
      aiGeneratedVideos: {
        status: 'planned',
        notRequiredReason: null,
        items: [{
          id: 'G01',
          beatId: 'B01',
          startAnchorText: scriptText.trim().slice(0, 10),
          endAnchorText: scriptText.trim().slice(-10),
          timingStatus: 'pre-shoot-text-anchor-only',
          purpose: 'illustration-only',
          representationPolicy: 'synthetic-not-evidence',
          evidenceEligible: false,
          disclosureRequired: true,
          realEntityReenactmentForbidden: true,
          mode: 'image-to-video',
          durationSeconds: 5,
          visualIntent: '用无特定主体的工作场景验证 AI 提示词转换。',
          primaryAction: '店主低头查看桌上结果页',
          firstFramePrompt: `${aiPrefix}中景固定机位，一位无品牌特征的成年店主坐在真实工作桌前，桌上放着无可读文字的结果页和普通文具，双手停在纸页两侧，背景为模糊货架，不出现真实公司、标志或官方界面。`,
          videoPrompt: '基于已确认首帧，店主低头查看桌上结果页，视线从页面左侧移到右侧，机位保持稳定，结尾停在专注阅读状态，不新增人物、标志或文字。',
          negativePrompt: ['不生成可读文字', '不复刻真实公司或真实人物', '不把演绎画面伪装成证据'],
        }],
      },
      paperEditorials: {status: 'not-required', notRequiredReason: '状态合同测试不执行纸艺分路。', items: []},
    },
    shotcraftOpportunities: [],
    rhythmAudit: {
      basis: 'semantic-runs-not-seconds', fixedCadenceForbidden: true, longSpeakerRunsReviewed: true,
      runs: [],
    },
  };
  writeJson('director-v2/cues.json', cues);
  bindings.directorCues = generationRecord.artifacts.directorCues = bindFile('director-v2/cues.json');
  documents.directorCues = cues;
  const approval = {
    schemaVersion: 'koubo-director-cues-user-approval/v2',
    status: 'approved',
    taskId: state.taskId,
    revisionId: state.revisionId,
    bindings: {directorCues: bindings.directorCues},
    approved: true,
    userQuote: '离线状态合同测试批准，不构成现实用户授权。',
    approvedAt: '2026-09-08T10:02:00+08:00',
    exceptions: [],
  };
  writeJson('director-v2/approval.json', approval);
  bindings.directorCuesUserApproval = generationRecord.artifacts.directorCuesUserApproval =
    bindFile('director-v2/approval.json');
  documents.directorCuesUserApproval = approval;
  const activeProfileSource = new URL('../../../workflow/active-director-profile.v1.json', import.meta.url);
  writeJson('workflow/active-director-profile.v1.json', JSON.parse(readFileSync(activeProfileSource, 'utf8')));
  const handoff = buildDirectorCuesV2Handoff({
    projectRoot,
    cues: bindings.directorCues.path,
    approval: bindings.directorCuesUserApproval.path,
    profile: 'workflow/active-director-profile.v1.json',
    outputDir: 'director-v2/handoff',
  });
  bindings.directorCuesHandoff = generationRecord.artifacts.directorCuesHandoff = {
    path: path.relative(realpathSync(projectRoot), handoff.masterPath), sha256: handoff.masterSha256,
  };
  bindings.directorCuesHandoffValidationReceipt =
    generationRecord.artifacts.directorCuesHandoffValidationReceipt = {
      path: path.relative(realpathSync(projectRoot), handoff.receiptPath), sha256: handoff.receiptSha256,
    };
  state.generationHandoffFormat = V2_DIRECT_HANDOFF_FORMAT;
  bindings.generationInventory = generationRecord.artifacts.generationInventory =
    structuredClone(bindings.directorCuesHandoff);
  bindings.generationOwnershipReceipt = generationRecord.artifacts.generationOwnershipReceipt =
    structuredClone(bindings.directorCuesUserApproval);
  const generationIndex = state.stageHistory.findIndex((item) => item.stage === 'generation-handoff-ready');
  const immutableV2Sources = new Set([
    'generationInventory',
    'generationOwnershipReceipt',
    'directorCues',
    'directorCuesUserApproval',
    'directorCuesHandoff',
    'directorCuesHandoffValidationReceipt',
  ]);
  const downstreamDirectorAuthority = new Set([
    'assetIntakeReceipt',
    'postshootRebindReceipt',
    'shotcraftSelectionPlan',
  ]);
  for (const record of state.stageHistory.slice(generationIndex)) {
    for (const key of Object.keys(record.artifacts ?? {})) {
      if (immutableV2Sources.has(key)) continue;
      const doc = documents[key];
      if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !doc.bindings) continue;
      if (downstreamDirectorAuthority.has(key)) {
        doc.bindings.directorCuesHandoff = structuredClone(bindings.directorCuesHandoff);
        doc.directorAuthority = 'directorCuesHandoff';
        doc.legacyDirectorPlanRole = 'compatibility-only';
      }
      for (const dependency of Object.keys(doc.bindings)) {
        if (bindings[dependency]) doc.bindings[dependency] = structuredClone(bindings[dependency]);
      }
      persist(key);
    }
  }
}

function strictFixture(t, stageCount = 9) {
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'v9-state-incident-'));
  t.after(() => rmSync(projectRoot, {recursive: true, force: true}));
  const state = buildState(stageCount);
  state.policy = {incidentPreventionVersion: '1'};
  state.directorProfile.profileVersion = '9.1.0';
  state.directorProfile.directorPlanningOutput = 'koubo-director-cues/v2';
  const documents = {};
  const bindings = {};
  const persist = (key) => {
    writeFileSync(path.join(projectRoot, bindings[key].path), JSON.stringify(documents[key]));
    bindings[key].sha256 = hashFile(path.join(projectRoot, bindings[key].path));
  };
  if (stageCount >= 2) {
    const native = createNativePreproductionFixture(projectRoot);
    Object.assign(state, {taskId: native.state.taskId, revisionId: native.state.revisionId,
      preproductionRequestId: native.state.preproductionRequestId});
    state.stageHistory.splice(0, 2, ...native.state.stageHistory);
    for (const [key, binding] of Object.entries(native.artifacts)) {
      bindings[key] = binding;
      if (key !== 'script') documents[key] = JSON.parse(readFileSync(path.join(projectRoot, binding.path)));
    }
  }
  for (const record of state.stageHistory) {
    for (const key of requiredArtifacts[record.stage]) {
      if (bindings[key]) continue;
      const previous = structuredClone(bindings);
      bindings[key] = record.artifacts[key] = {path: `${key}.json`, sha256: sha};
      if (receiptTypes[key]) {
        const [schemaVersion, status] = receiptTypes[key];
        documents[key] = {
          schemaVersion, status, taskId: state.taskId, revisionId: state.revisionId,
          bindings: previous, approved: true, userQuote: '已核对当前候选，批准本版本。',
          approvedAt: '2026-09-08T09:00:00+08:00', formalAuthorized: true,
          skillExecuted: true, items: [], exceptions: [],
        };
      } else {
        documents[key] = 'local-media-or-script-fixture';
      }
      persist(key);
    }
  }
  const fixture = {state, projectRoot, documents, bindings, persist,
    validate: () => validateV9ProductionState({state, projectRoot, verifyFiles: true})};
  attachSemanticDirectorV2Fixture(fixture);
  return fixture;
}

test('强化模板必须硬开启事故预防策略', () => {
  const template = JSON.parse(readFileSync(new URL('../templates/v9-production-state.v1.json', import.meta.url)));
  assert.equal(template.policy?.incidentPreventionVersion, '1');
  assert.equal(template.directorProfile?.profileVersion, '9.1.0');
  assert.equal(template.directorProfile?.directorPlanningOutput, 'koubo-director-cues/v2');
  const approvalTemplate = JSON.parse(readFileSync(new URL('../templates/director-cues-user-approval.v2.json', import.meta.url)));
  assert.equal(approvalTemplate.schemaVersion, 'koubo-director-cues-user-approval/v2');
  assert.equal(approvalTemplate.status, 'pending-user-approval');
  assert.equal(approvalTemplate.approved, false);
});

test('原生AI清单不能删除已传播的强化策略再重算外层哈希', (t) => {
  const fixture = strictFixture(t, 2);
  delete fixture.documents.aiVideoPromptManifest.policy;
  fixture.persist('aiVideoPromptManifest');
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('NATIVE_POLICY_REQUIRED')));
});

test('强化状态支持完整的当前版本证据链，发布仍关闭', (t) => {
  const fixture = strictFixture(t);
  assert.deepEqual(fixture.validate().errors, []);
});

test('强化 V9.1 删除 v2 导演标识也不能绕过导演表交接门', (t) => {
  const fixture = strictFixture(t, 3);
  delete fixture.state.directorProfile.directorPlanningOutput;
  delete fixture.state.stageHistory[2].artifacts.directorCuesHandoffValidationReceipt;
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_DIRECTOR_PLANNING_OUTPUT_REQUIRED'));
  assert.ok(result.errors.includes(
    'V9_ARTIFACT_BINDING_INVALID:generation-handoff-ready:directorCuesHandoffValidationReceipt',
  ));
});

test('强化 V9.1 的直连模式要求生成所有权键直接绑定当前 v2 用户批准', (t) => {
  const fixture = strictFixture(t, 3);
  fixture.state.stageHistory[2].artifacts.generationOwnershipReceipt =
    structuredClone(fixture.bindings.directorCuesHandoff);
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_DIRECT_V2_GENERATION_OWNERSHIP_MISMATCH'));
});

test('强化 V9.1 进入生成交接后不允许删掉交接格式退回通用旧清单', (t) => {
  const fixture = strictFixture(t, 3);
  delete fixture.state.generationHandoffFormat;
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_STRICT_GENERATION_HANDOFF_FORMAT_REQUIRED'));
});

test('强化 V9.1 会从落盘目录重验 v2 handoff，而不是只相信状态外层哈希', (t) => {
  const fixture = strictFixture(t, 3);
  const masterBinding = fixture.bindings.directorCuesHandoff;
  const masterPath = path.join(fixture.projectRoot, masterBinding.path);
  const master = JSON.parse(readFileSync(masterPath, 'utf8'));
  master.routeMappings[0].beatCount += 1;
  writeFileSync(masterPath, `${JSON.stringify(master, null, 2)}\n`);
  masterBinding.sha256 = hashFile(masterPath);
  fixture.state.stageHistory[2].artifacts.generationInventory = structuredClone(masterBinding);
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith('V9_DIRECTOR_V2_HANDOFF_INVALID:')));
});

test('强化 V9.1 拒绝绑定其他 profileVersion 的有效 v2 handoff', (t) => {
  const fixture = strictFixture(t, 3);
  const profilePath = path.join(fixture.projectRoot, 'workflow/active-director-profile.v1.json');
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  profile.profileVersion = '9.1.1';
  writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
  const handoff = buildDirectorCuesV2Handoff({
    projectRoot: fixture.projectRoot,
    cues: fixture.bindings.directorCues.path,
    approval: fixture.bindings.directorCuesUserApproval.path,
    profile: 'workflow/active-director-profile.v1.json',
    outputDir: 'director-v2/handoff-911',
  });
  const generation = fixture.state.stageHistory[2].artifacts;
  generation.directorCuesHandoff = {
    path: path.relative(realpathSync(fixture.projectRoot), handoff.masterPath),
    sha256: handoff.masterSha256,
  };
  generation.directorCuesHandoffValidationReceipt = {
    path: path.relative(realpathSync(fixture.projectRoot), handoff.receiptPath),
    sha256: handoff.receiptSha256,
  };
  generation.generationInventory = structuredClone(generation.directorCuesHandoff);
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) =>
    error.includes('V9_DIRECTOR_V2_HANDOFF_INVALID:HANDOFF_STATE_PROFILE_VERSION_MISMATCH')));
});

test('无强化策略的 V9.0 历史状态不被强制升级为 v2，但仍只读不可推进', () => {
  const state = buildState(3);
  state.directorProfile.profileVersion = '9.0.0';
  delete state.directorProfile.directorPlanningOutput;
  for (const key of [
    'directorCues',
    'directorCuesUserApproval',
    'directorCuesHandoff',
    'directorCuesHandoffValidationReceipt',
  ]) delete state.stageHistory[2].artifacts[key];
  const result = validateV9ProductionState({state});
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.validationMode, 'legacy-read-only');
  assert.equal(result.stageAdvanceAllowed, false);
});

test('无强化策略的 V9.1 不能伪装成历史只读状态', () => {
  const state = buildState(1);
  state.directorProfile.profileVersion = '9.1.0';
  state.directorProfile.directorPlanningOutput = 'koubo-director-cues/v2';
  const result = validateV9ProductionState({state});
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_LEGACY_READ_ONLY_PROFILE_REQUIRED'));
  assert.ok(result.errors.includes('V9_LEGACY_READ_ONLY_DIRECTOR_OUTPUT_FORBIDDEN'));
  assert.equal(result.stageAdvanceAllowed, false);
});

test('强化策略禁止把 V9.1 降级成 V9.0', (t) => {
  const fixture = strictFixture(t, 1);
  fixture.state.directorProfile.profileVersion = '9.0.0';
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('V9_STRICT_PROFILE_VERSION_REQUIRED'));
  assert.equal(result.stageAdvanceAllowed, false);
});

test('V9 生成器可直接绑定 v2 master，无需手工改所有权回执', (t) => {
  const fixture = strictFixture(t, 3);
  const result = runDirectorCli('build-v9-preproduction-state.mjs', fixture.projectRoot, [
    '--request', 'request.json',
    '--script-confirmation', 'confirmation.json',
    '--director-v2-handoff', fixture.bindings.directorCuesHandoff.path,
    '--output', 'direct-v2-state.json',
  ]);
  assert.equal(result.status, 0, result.stderr);
  const state = JSON.parse(readFileSync(path.join(fixture.projectRoot, 'direct-v2-state.json')));
  const artifacts = state.stageHistory[2].artifacts;
  assert.equal(state.generationHandoffFormat, V2_DIRECT_HANDOFF_FORMAT);
  assert.deepEqual(artifacts.generationInventory, artifacts.directorCuesHandoff);
  assert.deepEqual(artifacts.generationOwnershipReceipt, artifacts.directorCuesUserApproval);
  const checked = validateV9ProductionState({
    state,
    projectRoot: fixture.projectRoot,
    verifyFiles: true,
  });
  assert.deepEqual(checked.errors, []);
});

for (const [key, field, expected] of [
  ['assetIntakeReceipt', 'binding', 'CONTENT_BINDING_MISMATCH:directorCuesHandoff'],
  ['postshootRebindReceipt', 'authority', 'DIRECTOR_V2_DOWNSTREAM_AUTHORITY_INVALID'],
  ['shotcraftSelectionPlan', 'legacy-role', 'DIRECTOR_V2_LEGACY_PLAN_ROLE_INVALID'],
]) {
  test(`v2 导演权威不能在下游 ${key} 被旧 directorPlan 反向覆盖`, (t) => {
    const fixture = strictFixture(t);
    if (field === 'binding') delete fixture.documents[key].bindings.directorCuesHandoff;
    if (field === 'authority') fixture.documents[key].directorAuthority = 'directorPlan';
    if (field === 'legacy-role') fixture.documents[key].legacyDirectorPlanRole = 'authoritative';
    fixture.persist(key);
    const result = fixture.validate();
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes(expected)), result.errors.join('\n'));
  });
}

test('旧 ready-pack 入口必须显式提供 v2 master，不再从旧验收回执猜测绑定', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'v9-builder-requires-v2-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  createNativePreproductionFixture(root);
  const result = runDirectorCli('build-v9-preproduction-state.mjs', root, [
    '--request', 'request.json',
    '--script-confirmation', 'confirmation.json',
    '--handoff-pack', 'not-read-before-v2-gate.json',
    '--output', 'state.json',
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /V9_DIRECTOR_V2_HANDOFF_REQUIRED/);
});

test('v2 到旧生成链的转换回执绑定 master、六子件、旧提示词和 inventory', (t) => {
  const fixture = strictFixture(t, 3);
  const root = fixture.projectRoot;
  const writeJson = (relative, value) => {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), {recursive: true});
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    return {path: relative, sha256: hashFile(file)};
  };
  const identity = {taskId: fixture.state.taskId, revisionId: fixture.state.revisionId};
  const firstFramePromptManifest = writeJson('legacy/firstframe.json', {
    ...identity, sceneCount: 0, scenes: [],
  });
  const imageToVideoPromptManifest = writeJson('legacy/video.json', {
    ...identity, sceneCount: 0, scenes: [],
  });
  const master = JSON.parse(readFileSync(path.join(root, fixture.bindings.directorCuesHandoff.path), 'utf8'));
  const aiSource = JSON.parse(readFileSync(path.join(root, master.artifacts.aiVideo.path), 'utf8'));
  const aiSourceItem = aiSource.items[0];
  const legacyNegativePrompt = aiSourceItem.negativePrompt.join('；');
  const aiVideoPromptManifest = writeJson('legacy/ai.json', {
    ...identity,
    itemCount: 1,
    items: [{
      sceneId: 'A01',
      beatId: aiSourceItem.beatId,
      mode: 'image-to-video',
      prompt: aiSourceItem.prompt,
      promptSha256: hashText(aiSourceItem.prompt),
      negativePrompt: legacyNegativePrompt,
      negativePromptSha256: hashText(legacyNegativePrompt),
      durationSeconds: aiSourceItem.durationSeconds,
      purpose: aiSourceItem.purpose,
      evidenceEligible: false,
      disclosureRequired: true,
      manualExecutionRequired: true,
    }],
  });
  const generationOwnershipReceipt = writeJson('legacy/acceptance.json', {
    ...identity, approved: true,
  });
  const job = writeJson('legacy/job.json', {sourceManifest: firstFramePromptManifest});
  const generationInventory = writeJson('legacy/pack.json', {
    ...identity,
    sourceJob: job,
    sourceRunningHubManifest: imageToVideoPromptManifest,
    userAcceptance: generationOwnershipReceipt,
    sceneCount: 0,
    scenes: [],
  });
  const args = {
    projectRoot: root,
    directorCuesHandoff: fixture.bindings.directorCuesHandoff,
    directorCuesHandoffValidationReceipt: fixture.bindings.directorCuesHandoffValidationReceipt,
    generationInventory,
    generationOwnershipReceipt,
    firstFramePromptManifest,
    imageToVideoPromptManifest,
    aiVideoPromptManifest,
  };
  const document = buildV2LegacyGenerationBridgeReceipt(args);
  const bridgeReceipt = writeJson('legacy/bridge.json', document);
  assert.deepEqual(validateV2LegacyGenerationBridgeReceipt({...args, bridgeReceipt}).errors, []);
  assert.equal(
    document.conversions.aiGeneratedVideo.items[0].negativePromptTransform,
    'join-fullwidth-semicolon-v1',
  );
  const driftedAi = writeJson('legacy/ai-drifted.json', {
    ...identity,
    itemCount: 1,
    items: [{
      ...JSON.parse(readFileSync(path.join(root, aiVideoPromptManifest.path), 'utf8')).items[0],
      negativePrompt: `${legacyNegativePrompt}；脱钩限制`,
      negativePromptSha256: hashText(`${legacyNegativePrompt}；脱钩限制`),
    }],
  });
  const drifted = validateV2LegacyGenerationBridgeReceipt({
    ...args,
    aiVideoPromptManifest: driftedAi,
    bridgeReceipt,
  });
  assert.equal(drifted.ok, false);
  assert.ok(drifted.errors.some((error) => error.includes('AI_CONTENT_MISMATCH')));
});

for (const [name, change, expected] of [
  ['失败回执', (doc) => { doc.status = 'failed'; }, 'CONTENT_STATUS_INVALID'],
  ['错类型', (doc) => { doc.schemaVersion = 'koubo-formal-qa-receipt/v1'; }, 'CONTENT_SCHEMA_INVALID'],
  ['跨任务', (doc) => { doc.taskId = 'other-task'; }, 'CONTENT_TASK_MISMATCH'],
  ['旧版本', (doc) => { doc.revisionId = 'old-revision'; }, 'CONTENT_REVISION_MISMATCH'],
  ['空绑定', (doc) => { doc.bindings = {}; }, 'CONTENT_BINDING_MISMATCH'],
  ['错脚本哈希', (doc) => { doc.bindings.script.sha256 = 'b'.repeat(64); }, 'CONTENT_BINDING_MISMATCH'],
  ['错脚本路径', (doc) => { doc.bindings.script.path = 'elsewhere.json'; }, 'CONTENT_BINDING_MISMATCH'],
  ['批准布尔值缺失', (doc) => { delete doc.approved; }, 'USER_APPROVAL_REQUIRED'],
  ['例外伪装成功', (doc) => { doc.exceptions = [{status: 'known-exception-user-accepted'}]; }, 'EXCEPTION_NOT_SUCCESS'],
  ['失败结果伪装成功', (doc) => { doc.ok = false; }, 'CONTENT_FAILURE'],
]) {
  test(`强化状态拒绝${name}，即使文件哈希重新算对`, (t) => {
    const fixture = strictFixture(t, 1);
    change(fixture.documents.scriptUserConfirmation);
    fixture.persist('scriptUserConfirmation');
    const result = fixture.validate();
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes(expected)), result.errors.join('\n'));
    assert.equal(result.nextStage, null);
    assert.equal(result.formalEnabled, false);
  });
}

test('强化状态不能跳过内部文件检查或省略项目根目录', () => {
  const state = buildState(7);
  state.policy = {incidentPreventionVersion: '1'};
  for (const options of [{}, {verifyFiles: true}, {verifyFiles: false, projectRoot: '/tmp'}]) {
    const result = validateV9ProductionState({state, ...options});
    assert.equal(result.ok, false);
    assert.equal(result.formalEnabled, false);
    assert.equal(result.nextStage, null);
  }
});

test('未知策略版本不能静默降级旧夹具模式', () => {
  const state = buildState(1);
  state.policy = {incidentPreventionVersion: '2'};
  assert.equal(validateV9ProductionState({state}).ok, false);
});

test('每一种结构化产物均拒绝错类型或失败状态', (t) => {
  const fixture = strictFixture(t);
  for (const key of Object.keys(receiptTypes).filter((item) =>
    !['generationInventory', 'generationOwnershipReceipt'].includes(item))) {
    for (const field of ['schemaVersion', 'status']) {
      if (key === 'scriptUserConfirmation' && field === 'status') continue;
      const original = fixture.documents[key][field];
      fixture.documents[key][field] = field === 'status' ? 'failed' : 'wrong-type/v1';
      fixture.persist(key);
      const result = fixture.validate();
      assert.equal(result.ok, false, `${key}:${field}`);
      const errorType = field === 'status' ? 'CONTENT_STATUS_INVALID' : 'CONTENT_SCHEMA_INVALID';
      assert.ok(result.errors.some((error) => error.includes(errorType) && error.endsWith(`:${key}`)), result.errors.join('\n'));
      assert.equal(result.formalEnabled, false);
      assert.equal(result.releasePackageEnabled, false);
      fixture.documents[key][field] = original;
      fixture.persist(key);
    }
  }
});

test('用户保留例外不能写为可复用成功经验', (t) => {
  const fixture = strictFixture(t, 7);
  fixture.documents.shotcraftExperienceWriteReceipt.entries = [{exceptionApplied: true, status: 'reusable-pattern'}];
  fixture.persist('shotcraftExperienceWriteReceipt');
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('EXCEPTION_NOT_SUCCESS')));
  assert.equal(result.formalEnabled, false);
});

test('候选批准不自动等于正式授权', (t) => {
  const fixture = strictFixture(t, 7);
  fixture.documents.candidateUserAcceptance.formalAuthorized = false;
  fixture.persist('candidateUserAcceptance');
  assert.equal(fixture.validate().formalEnabled, false);
  assert.equal(fixture.validate().ok, false);
});

test('状态本身去掉策略不能把带强化策略的上游回执降级为旧读', (t) => {
  const fixture = strictFixture(t, 1);
  delete fixture.state.policy;
  fixture.documents.scriptUserConfirmation.policy = {incidentPreventionVersion: '1'};
  fixture.persist('scriptUserConfirmation');
  const result = fixture.validate();
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith('V9_INCIDENT_POLICY_REQUIRED')));
  assert.equal(result.stageAdvanceAllowed, false);
});

test('旧纯夹具只读兼容不等于内容校验或推进权限', () => {
  const result = validateV9ProductionState({state: buildState(9)});
  assert.equal(result.ok, true);
  assert.equal(result.validationMode, 'legacy-read-only');
  assert.equal(result.contentVerified, false);
  assert.equal(result.stageAdvanceAllowed, false);
});

test('当前真实编译器及独立校验器原件可进入V9状态，不补写通用envelope', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'v9-native-roundtrip-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const fixture = createNativePreproductionFixture(root);
  const originals = Object.fromEntries(Object.entries(fixture.artifacts).map(([key, binding]) => [key, hashFile(path.join(root, binding.path))]));
  const plan = fixture.read(path.join(root, fixture.artifacts.directorPlan.path));
  const firstFrame = fixture.read(path.join(root, fixture.artifacts.firstFramePromptManifest.path));
  assert.equal(plan.revisionId, fixture.request.revisionId);
  assert.equal(firstFrame.bindings, undefined);
  assert.equal(fixture.read(path.join(root, fixture.artifacts.directorCompileReceipt.path)).skillExecuted, false);
  const result = validateV9ProductionState({state: fixture.state, projectRoot: root, verifyFiles: true});
  assert.deepEqual(result.errors, []);
  assert.equal(result.stageAdvanceAllowed, true);
  assert.equal(result.nextStage, 'generation-handoff-ready');
  assert.equal(result.formalEnabled, false);
  const generated = runDirectorCli('build-v9-preproduction-state.mjs', root,
    ['--request', 'request.json', '--script-confirmation', 'confirmation.json', '--output', 'state.json']);
  assert.equal(generated.status, 0, generated.stderr);
  const builtState = JSON.parse(readFileSync(path.join(root, 'state.json'), 'utf8'));
  assert.equal(builtState.directorProfile.directorPlanningOutput, 'koubo-director-cues/v2');
  const checked = runDirectorCli('validate-v9-production-state.mjs', root, ['--state', 'state.json']);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  for (const [key, binding] of Object.entries(fixture.artifacts)) {
    assert.equal(hashFile(path.join(root, binding.path)), originals[key]);
  }
  const reviewPath = fixture.request.beats[0].paperScene.motionContract.semanticReview.path;
  const review = fixture.read(reviewPath);
  writeFileSync(reviewPath, JSON.stringify({...review, sourceQuote: '被换掉的原话'}));
  const drifted = validateV9ProductionState({state: fixture.state, projectRoot: root, verifyFiles: true});
  assert.equal(drifted.ok, false);
  assert.equal(drifted.nextStage, null);
  assert.ok(drifted.errors.some((error) => error.includes('PAPER_SEMANTIC_REVIEW_FILE_OR_SHA_INVALID')));
});
