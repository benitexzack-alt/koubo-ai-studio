import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contextFingerprint,
  experienceSignalForCandidate,
  rebuildExperiencePatterns,
  sha256Text,
  validateExperienceLedger,
} from '../scripts/experience-ledger-core.mjs';

const sha = 'a'.repeat(64);
const policy = {
  exactReuseMinimumAcceptedCases: 1,
  patternPromotionMinimumAcceptedCases: 2,
  patternPromotionMinimumDistinctTasks: 2,
  candidatePreviewStillRequired: true,
  automaticFormalApproval: false,
  latestRejectionBlocksExactReuse: true,
};
const context = {mainVisual: 'speaker', materialClass: 'talking-head', semanticIntents: ['emphasis'], keyTerms: ['信任']};
const makeCase = ({id, taskId, outcome = 'accepted', recordedAt, contextOverride = {}, componentSha = sha}) => {
  const nextContext = {...context, ...contextOverride};
  const quote = outcome === 'accepted' ? '确认通过' : '这个不对';
  return {
    caseId: id,
    outcome,
    taskId,
    revisionId: 'r1',
    beatId: 'beat-001',
    effectId: 'marker-underline',
    cardName: 'marker-underline-title',
    recordedAt,
    reason: '用户人工判断',
    context: nextContext,
    contextFingerprint: contextFingerprint(nextContext),
    selection: {path: 'edit/selection.json', sha256: sha},
    applicationReceipt: {path: 'edit/application.json', sha256: sha},
    candidate: {path: 'outputs/candidate.mp4', sha256: sha},
    component: {name: 'MarkerUnderline', path: 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx', sha256: componentSha},
    registrySha256: sha,
    userEvidence: {quote, quoteSha256: sha256Text(quote)},
  };
};

test('空经验库合法，且一条验收不会直接晋级通用规则', () => {
  const empty = {schemaVersion: 'koubo-shotcraft-experience-ledger/v1', policy, cases: [], patterns: []};
  assert.deepEqual(validateExperienceLedger(empty), []);
  const one = makeCase({id: 'case-1', taskId: 'task-1', recordedAt: '2026-09-04T10:00:00+08:00'});
  assert.deepEqual(rebuildExperiencePatterns([one], policy), []);
});

test('两个不同任务的同类成功案例晋级为可复用规则', () => {
  const cases = [
    makeCase({id: 'case-1', taskId: 'task-1', recordedAt: '2026-09-04T10:00:00+08:00'}),
    makeCase({id: 'case-2', taskId: 'task-2', recordedAt: '2026-09-05T10:00:00+08:00', contextOverride: {keyTerms: ['关键']}}),
  ];
  const patterns = rebuildExperiencePatterns(cases, policy);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].status, 'reusable-pattern');
  assert.equal(patterns[0].acceptedTaskCount, 2);
  assert.deepEqual(validateExperienceLedger({schemaVersion: 'koubo-shotcraft-experience-ledger/v1', policy, cases, patterns}), []);
});

test('最新同语境否决覆盖旧验收并阻断精确复用', () => {
  const cases = [
    makeCase({id: 'case-1', taskId: 'task-1', recordedAt: '2026-09-04T10:00:00+08:00'}),
    makeCase({id: 'case-2', taskId: 'task-2', outcome: 'rejected', recordedAt: '2026-09-05T10:00:00+08:00'}),
  ];
  const ledger = {schemaVersion: 'koubo-shotcraft-experience-ledger/v1', policy, cases, patterns: rebuildExperiencePatterns(cases, policy)};
  const signal = experienceSignalForCandidate({ledger, context, effectId: 'marker-underline', cardName: 'marker-underline-title', registrySha256: sha, componentSha256: sha});
  assert.equal(signal.exactAccepted, false);
  assert.equal(signal.exactRejected, true);
  assert.equal(signal.exactCaseId, 'case-2');
});

test('组件哈希变化后旧案例只作为过期证据，不参与直接复用', () => {
  const entry = makeCase({id: 'case-old', taskId: 'task-1', recordedAt: '2026-09-04T10:00:00+08:00', componentSha: 'b'.repeat(64)});
  const ledger = {schemaVersion: 'koubo-shotcraft-experience-ledger/v1', policy, cases: [entry], patterns: []};
  const signal = experienceSignalForCandidate({ledger, context, effectId: 'marker-underline', cardName: 'marker-underline-title', registrySha256: sha, componentSha256: sha});
  assert.equal(signal.exactAccepted, false);
  assert.deepEqual(signal.staleCaseIds, ['case-old']);
});

test('篡改派生规则或关闭预览门会被拒绝', () => {
  const entry = makeCase({id: 'case-1', taskId: 'task-1', recordedAt: '2026-09-04T10:00:00+08:00'});
  const ledger = {schemaVersion: 'koubo-shotcraft-experience-ledger/v1', policy: {...policy, candidatePreviewStillRequired: false}, cases: [entry], patterns: [{patternId: 'fake'}]};
  const errors = validateExperienceLedger(ledger);
  assert.ok(errors.includes('SHOTCRAFT_EXPERIENCE_PREVIEW_GATE_MISSING'));
  assert.ok(errors.includes('SHOTCRAFT_EXPERIENCE_PATTERNS_STALE'));
});

test('经验账本不接受绝对路径绑定', () => {
  const entry = makeCase({id: 'case-absolute', taskId: 'task-1', recordedAt: '2026-09-04T10:00:00+08:00'});
  entry.candidate.path = '/tmp/candidate.mp4';
  const ledger = {schemaVersion: 'koubo-shotcraft-experience-ledger/v1', policy, cases: [entry], patterns: []};
  assert.ok(validateExperienceLedger(ledger).includes('SHOTCRAFT_EXPERIENCE_CASE_INVALID:case-absolute'));
});
