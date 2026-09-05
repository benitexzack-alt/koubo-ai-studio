import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildCardCapabilityIndex,
  matchDirectorEffects,
  validateAutoMatchRequest,
  validateCapabilityIndex,
} from '../scripts/shotcraft-matcher-core.mjs';
import {contextFingerprint} from '../scripts/experience-ledger-core.mjs';
import {validateDirectorSelection} from '../scripts/validate-director-selection.mjs';

const skillRoot = path.resolve(import.meta.dirname, '..');
const libraryBytes = fs.readFileSync(path.join(skillRoot, 'upstream/gallery/api/library.json'));
const registryBytes = fs.readFileSync(path.join(skillRoot, 'registry.v1.json'));
const indexBytes = fs.readFileSync(path.join(skillRoot, 'card-capability-index.v2.json'));
const library = JSON.parse(libraryBytes);
const registry = JSON.parse(registryBytes);
const index = JSON.parse(indexBytes);
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const componentSha = sha(fs.readFileSync(path.join(skillRoot, 'assets/ShotcraftEffects.tsx')));
const emptyLedger = JSON.parse(fs.readFileSync(path.join(skillRoot, 'experience/shotcraft-acceptance-ledger.v1.json')));
const placeholder = 'a'.repeat(64);
const captions = [
  {startMs: 0, endMs: 6000, zh: '第一看门店数据，第二看库存，第三看同行活动。'},
  {startMs: 6000, endMs: 12000, zh: '这里显示官方页面的关键按钮。'},
  {startMs: 12000, endMs: 18000, zh: '按住说话以后，语音会直接进入输入框。'},
  {startMs: 18000, endMs: 24000, zh: '真正的核心是信任。'},
];

const binding = (filePath, bytes = Buffer.from('fixture')) => ({path: filePath, sha256: sha(bytes)});
const baseBeat = (overrides = {}) => ({
  beatId: 'beat-001',
  mainVisual: 'speaker',
  frames: {startFrame: 0, endFrameExclusive: 180},
  quote: '第一看门店数据，第二看库存，第三看同行活动。',
  purpose: '逐项呈现老板每天需要检查的三类信息',
  semanticIntents: ['list', 'process'],
  materialClass: 'talking-head',
  energy: 'medium',
  existingVisualSufficiency: 'low',
  keyPhrases: ['门店数据', '库存', '同行活动'],
  region: {x: 60, y: 140, width: 620, height: 360},
  protectedRegions: [
    {x: 800, y: 0, width: 900, height: 850},
    {x: 0, y: 900, width: 1920, height: 180},
  ],
  ...overrides,
});

const requestFixture = (beat = baseBeat()) => ({
  schemaVersion: 'koubo-shotcraft-auto-match-request/v1',
  taskId: 'task-v91-test',
  revisionId: 'candidate-r1',
  directorProfile: {profileId: 'paper-editorial-director-v9', profileVersion: '9.1.0'},
  subtitleAuthority: 'actual-recording',
  registry: binding('skills/koubo-shotcraft-library/registry.v1.json', registryBytes),
  library: binding('skills/koubo-shotcraft-library/upstream/gallery/api/library.json', libraryBytes),
  capabilityIndex: binding('skills/koubo-shotcraft-library/card-capability-index.v2.json', indexBytes),
  experienceLedger: binding('skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json'),
  componentModule: {path: 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx', sha256: componentSha},
  captions: {path: 'edit/test/actual-captions.json', sha256: placeholder},
  canvas: {width: 1920, height: 1080, fps: 30, durationInFrames: 720},
  beats: [beat],
});

const run = (beat, ledger = emptyLedger) => matchDirectorEffects({request: requestFixture(beat), captions, index, registry, ledger});

test('能力索引完整覆盖当前157张卡和214个样式，且构建结果确定', () => {
  assert.deepEqual(validateCapabilityIndex(index, library, registry), []);
  assert.equal(index.stats.cardCount, 157);
  assert.equal(index.stats.styleCount, 214);
  assert.equal(index.stats.candidateRenderableCount, 5);
  assert.equal(index.stats.adaptationRequiredCount, 152);
  const rebuilt = buildCardCapabilityIndex({
    library,
    registry,
    libraryBinding: index.source.library,
    registryBinding: index.source.registry,
    upstreamCommit: index.source.upstreamCommit,
  });
  assert.deepEqual(rebuilt, index);
});

test('请求必须使用实录权威和V9.1导演档案', () => {
  assert.deepEqual(validateAutoMatchRequest(requestFixture()), []);
  const invalid = requestFixture();
  invalid.subtitleAuthority = 'pre-shoot-script';
  invalid.directorProfile.profileVersion = '9.0.0';
  assert.ok(validateAutoMatchRequest(invalid).includes('SHOTCRAFT_AUTO_MATCH_ACTUAL_RECORDING_REQUIRED'));
  assert.ok(validateAutoMatchRequest(invalid).includes('SHOTCRAFT_AUTO_MATCH_V91_PROFILE_REQUIRED'));
});

test('列举型实录自动选择逐项呈现，并生成可直接消费的组件参数', () => {
  const result = run(baseBeat());
  assert.equal(result.selection.beats[0].decision, 'apply');
  assert.equal(result.selection.beats[0].effectId, 'keyword-reveal');
  assert.deepEqual(result.selection.beats[0].componentProps.items.map((item) => item.text), ['门店数据', '库存', '同行活动']);
  assert.deepEqual(validateDirectorSelection(result.selection, captions, registry), []);
});

test('真实界面证据自动选择证据扫描，并保留真实素材绑定', () => {
  const beat = baseBeat({
    beatId: 'beat-002',
    mainVisual: 'real-evidence',
    frames: {startFrame: 180, endFrameExclusive: 360},
    quote: '这里显示官方页面的关键按钮。',
    purpose: '框选真实官方页面中的关键按钮',
    semanticIntents: ['evidence', 'selection'],
    materialClass: 'screen-recording',
    keyPhrases: ['关键按钮'],
    evidence: {
      asset: {path: 'edit/test/official-screen.png', sha256: placeholder},
      rect: {x: 120, y: 80, width: 260, height: 120},
      claimBoundary: '只证明当前画面出现该按钮，不外推功能结果',
    },
  });
  const result = run(beat);
  assert.equal(result.selection.beats[0].effectId, 'evidence-scan');
  assert.deepEqual(result.selection.beats[0].componentProps.rect, beat.evidence.rect);
  assert.deepEqual(validateDirectorSelection(result.selection, captions, registry), []);
});

test('最匹配但尚未适配的卡只进入适配队列，不冒充可渲染组件', () => {
  const beat = baseBeat({
    beatId: 'beat-003',
    frames: {startFrame: 360, endFrameExclusive: 540},
    quote: '按住说话以后，语音会直接进入输入框。',
    purpose: '表现语音输入持续活性和提交动作',
    semanticIntents: ['voice', 'process'],
    materialClass: 'interface',
    keyPhrases: ['按住说话', '语音'],
  });
  const result = run(beat);
  assert.equal(result.selection.beats[0].decision, 'not-needed');
  assert.ok(result.matches[0].adaptationCandidates.some((candidate) => candidate.cardName === 'voice-waveform-live'));
  assert.ok(result.matches[0].adaptationCandidates.every((candidate) => candidate.renderability === 'adaptation-required'));
});

test('纸艺和生成视频主画面永远不套Shotcraft', () => {
  for (const mainVisual of ['paper-editorial', 'generated-video']) {
    const result = run(baseBeat({mainVisual}));
    assert.equal(result.selection.beats[0].decision, 'not-needed');
    assert.equal(result.matches[0].rankedCandidates.length, 0);
  }
});

test('一次已验收案例优先复用，但仍保持候选预览门', () => {
  const beat = baseBeat({
    beatId: 'beat-004',
    frames: {startFrame: 540, endFrameExclusive: 660},
    quote: '真正的核心是信任。',
    purpose: '强调本段唯一结论',
    semanticIntents: ['emphasis', 'conclusion'],
    keyPhrases: ['信任'],
  });
  const context = {
    mainVisual: 'speaker', materialClass: 'talking-head',
    semanticIntents: ['conclusion', 'emphasis'], keyTerms: ['信任'],
  };
  const ledger = {
    ...emptyLedger,
    cases: [{
      caseId: 'case-accepted', outcome: 'accepted', taskId: 'old-task', revisionId: 'r1', beatId: 'old-beat',
      effectId: 'marker-underline', cardName: 'marker-underline-title', recordedAt: '2026-09-04T12:00:00+08:00', reason: '用户确认',
      context, contextFingerprint: contextFingerprint(context),
      selection: binding('edit/old/selection.json'), applicationReceipt: binding('edit/old/application.json'), candidate: binding('outputs/old.mp4'),
      component: {name: 'MarkerUnderline', path: 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx', sha256: componentSha},
      registrySha256: sha(registryBytes), userEvidence: {quote: '通过', quoteSha256: sha(Buffer.from('通过'))},
    }],
    patterns: [],
  };
  const result = run(beat, ledger);
  assert.equal(result.selection.beats[0].effectId, 'marker-underline');
  assert.equal(result.selection.beats[0].matchContext.origin, 'validated-case');
  assert.equal(result.matches[0].rankedCandidates[0].experience.exactAccepted, true);
});

test('同语境的最新否决会阻断该效果直接复用', () => {
  const beat = baseBeat({
    beatId: 'beat-004', frames: {startFrame: 540, endFrameExclusive: 660}, quote: '真正的核心是信任。',
    purpose: '强调本段唯一结论', semanticIntents: ['emphasis', 'conclusion'], keyPhrases: ['信任'],
  });
  const context = {mainVisual: 'speaker', materialClass: 'talking-head', semanticIntents: ['conclusion', 'emphasis'], keyTerms: ['信任']};
  const common = {
    taskId: 'old-task', revisionId: 'r1', beatId: 'old-beat', effectId: 'marker-underline', cardName: 'marker-underline-title', reason: '用户判断', context,
    contextFingerprint: contextFingerprint(context), selection: binding('edit/old/selection.json'), applicationReceipt: binding('edit/old/application.json'), candidate: binding('outputs/old.mp4'),
    component: {name: 'MarkerUnderline', path: 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx', sha256: componentSha}, registrySha256: sha(registryBytes),
    userEvidence: {quote: '不通过', quoteSha256: sha(Buffer.from('不通过'))},
  };
  const ledger = {...emptyLedger, cases: [
    {...common, caseId: 'case-accepted', outcome: 'accepted', recordedAt: '2026-09-04T12:00:00+08:00'},
    {...common, caseId: 'case-rejected', outcome: 'rejected', recordedAt: '2026-09-05T12:00:00+08:00'},
  ], patterns: []};
  const result = run(beat, ledger);
  assert.notEqual(result.selection.beats[0].effectId, 'marker-underline');
});

test('任何自动apply都只能来自当前注册表，不设置机械配额', () => {
  const result = run(baseBeat());
  const registered = new Set(registry.effects.map((effect) => effect.id));
  for (const beat of result.selection.beats.filter((item) => item.decision === 'apply')) assert.ok(registered.has(beat.effectId));
  assert.equal('quota' in result.selection, false);
});
