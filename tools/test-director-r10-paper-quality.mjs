import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

import {auditPaperPlan} from './director-r10-paper-quality-core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const stylePath = resolve(
  repoRoot,
  'workflow/style-library/koubo-paper-editorial-assembly-v2.candidate.json',
);
const planPath = resolve(
  repoRoot,
  'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/director-postshoot-rebind-plan.v1.json',
);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));

const style = readJson(stylePath);
const realPlan = readJson(planPath);
const report = auditPaperPlan({style, plan: realPlan});

assert.equal(report.schemaVersion, 'director-r10-paper-quality-report/v1');
assert.deepEqual(report.styleGuard, {
  id: 'koubo-paper-editorial-assembly-v2',
  status: 'blocked-candidate',
  productionEligible: false,
});
assert.equal(report.overallStatus, 'blocked');
assert.equal(report.machineBoundary.aestheticApprovalGranted, false);
assert.equal(report.machineBoundary.humanDynamicReviewRequired, true);
assert.equal(report.batch.paperShotCount, 6);
assert.equal(report.batch.declaredCompositionFamilyCount, 0);
assert.equal(report.batch.uniqueCompositionFamilyCount, 0);
assert.equal(report.batch.minimumCompositionFamilyCount, 3);
assert.equal(report.batch.compositionCoveragePassed, false);

const findingCodes = report.findings.map((finding) => finding.code);
assert.ok(findingCodes.includes('STYLE_BLOCKED_CANDIDATE'));
assert.ok(findingCodes.includes('BATCH_COMPOSITION_COVERAGE_MISSING'));

assert.deepEqual(
  report.shots.map((shot) => shot.beatId),
  ['B04', 'B07', 'B10', 'B11', 'B15', 'B17'],
);

for (const shot of report.shots) {
  assert.equal(shot.declarations.compositionFamily, null);
  assert.equal(shot.declarations.cameraLanguage, null);
  assert.equal(shot.declarations.finalHoldSeconds, null);
  assert.equal(shot.declarations.dynamicCandidateStatus, null);
  assert.equal(shot.declarations.humanAcceptanceStatus, null);
  const codes = shot.findings.map((finding) => finding.code);
  assert.ok(codes.includes('SHOT_COMPOSITION_FAMILY_MISSING'));
  assert.ok(codes.includes('SHOT_CAMERA_LANGUAGE_MISSING'));
  assert.ok(codes.includes('SHOT_FINAL_HOLD_MISSING'));
  assert.ok(codes.includes('SHOT_DYNAMIC_CANDIDATE_STATUS_MISSING'));
  assert.ok(codes.includes('SHOT_HUMAN_ACCEPTANCE_STATUS_MISSING'));
  assert.equal(codes.includes('STAGE_SFX_ROLE_MISSING'), false);
}

const b07 = report.shots.find((shot) => shot.beatId === 'B07');
assert.deepEqual(b07.metrics, {
  rawObjectGroupCount: 4,
  objectGroupCount: 4,
  rawSemanticNodeCount: 4,
  semanticNodeCount: 4,
  depthPlaneCount: 3,
  rawAssemblyBeatCount: 4,
  assemblyBeatCount: 4,
  stageCountWithSfxRole: 4,
  finalHoldSeconds: null,
});
assert.equal(b07.complexExplainer, true);
assert.ok(b07.findings.some((finding) => finding.code === 'COMPLEX_OBJECT_GROUP_COUNT_OUT_OF_RANGE'));
assert.ok(b07.findings.some((finding) => finding.code === 'COMPLEX_SEMANTIC_NODE_COUNT_OUT_OF_RANGE'));
assert.equal(b07.findings.some((finding) => finding.code === 'COMPLEX_ASSEMBLY_BEAT_COUNT_OUT_OF_RANGE'), true);

for (const beatId of ['B04', 'B10', 'B11', 'B15', 'B17']) {
  const shot = report.shots.find((item) => item.beatId === beatId);
  assert.ok(shot.findings.some((finding) => finding.code === 'COMPLEX_ASSEMBLY_BEAT_COUNT_OUT_OF_RANGE'));
}

const repeatedReport = auditPaperPlan({style: clone(style), plan: clone(realPlan)});
assert.equal(JSON.stringify(repeatedReport), JSON.stringify(report));

const declaredPlan = clone(realPlan);
const families = [
  'top-down-editorial-desk',
  'front-mechanical-stage',
  'layered-book-or-cross-section',
];
const cameras = ['fixed', 'subtle-push', 'layered-parallax'];

for (const [shotIndex, beat] of declaredPlan.beats.filter((item) => item.paperScene).entries()) {
  const scene = beat.paperScene;
  scene.compositionFamily = families[shotIndex % families.length];
  scene.cameraLanguage = cameras[shotIndex % cameras.length];
  scene.finalHoldSeconds = 1;
  scene.dynamicCandidate = {status: 'candidate-generated'};
  scene.humanAcceptance = {status: 'pending'};
  scene.objectGroups = Array.from({length: 5}, (_, index) => ({
    id: `G${index + 1}`,
    name: `测试物件组${index + 1}`,
    depth: (index % 3) + 1,
  }));
  scene.nodes = Array.from({length: 9}, (_, index) => ({
    id: `N${index + 1}`,
    label: `测试节点${index + 1}`,
    groupId: `G${(index % 5) + 1}`,
  }));
  scene.stages = Array.from({length: 5}, (_, index) => ({
    id: `S${index + 1}`,
    order: index + 1,
    subject: `G${(index % 5) + 1}`,
    action: `测试装配动作${index + 1}`,
    sfxRole: 'paper-slide',
  }));
}

const declaredReport = auditPaperPlan({style, plan: declaredPlan});
assert.equal(declaredReport.structuralStatus, 'pass');
assert.equal(declaredReport.acceptanceStatus, 'blocked');
assert.equal(declaredReport.overallStatus, 'blocked');
assert.equal(declaredReport.batch.compositionCoveragePassed, true);
assert.equal(declaredReport.batch.consecutiveCompositionVariationPassed, true);
assert.equal(declaredReport.findings.some((finding) => finding.code === 'STYLE_BLOCKED_CANDIDATE'), true);
assert.equal(declaredReport.findings.some((finding) => finding.code === 'HUMAN_DYNAMIC_ACCEPTANCE_PENDING'), true);

const missingSfxPlan = clone(declaredPlan);
missingSfxPlan.beats.find((beat) => beat.id === 'B07').paperScene.stages[2].sfxRole = '';
const missingSfxReport = auditPaperPlan({style, plan: missingSfxPlan});
const missingSfxB07 = missingSfxReport.shots.find((shot) => shot.beatId === 'B07');
assert.ok(missingSfxB07.findings.some((finding) => (
  finding.code === 'STAGE_SFX_ROLE_MISSING' && finding.stageId === 'S3'
)));
assert.equal(missingSfxReport.structuralStatus, 'blocked');

const repeatedCompositionPlan = clone(declaredPlan);
repeatedCompositionPlan.beats.find((beat) => beat.id === 'B07').paperScene.compositionFamily = (
  repeatedCompositionPlan.beats.find((beat) => beat.id === 'B04').paperScene.compositionFamily
);
const repeatedCompositionReport = auditPaperPlan({style, plan: repeatedCompositionPlan});
assert.equal(repeatedCompositionReport.batch.consecutiveCompositionVariationPassed, false);
assert.deepEqual(repeatedCompositionReport.batch.repeatedCompositionPairs, [{
  previousBeatId: 'B04',
  beatId: 'B07',
  compositionFamily: 'top-down-editorial-desk',
}]);
assert.equal(repeatedCompositionReport.structuralStatus, 'blocked');

const invalidCameraPlan = clone(declaredPlan);
invalidCameraPlan.beats.find((beat) => beat.id === 'B04').paperScene.cameraLanguage = 'generic-orbit';
const invalidCameraReport = auditPaperPlan({style, plan: invalidCameraPlan});
assert.ok(invalidCameraReport.shots.find((shot) => shot.beatId === 'B04').findings.some((finding) => (
  finding.code === 'SHOT_CAMERA_LANGUAGE_NOT_ALLOWED'
)));

const driftedStyle = clone(style);
driftedStyle.status = 'active';
driftedStyle.productionEligible = true;
const driftedStyleReport = auditPaperPlan({style: driftedStyle, plan: declaredPlan});
assert.ok(driftedStyleReport.findings.some((finding) => finding.code === 'STYLE_CANDIDATE_GUARD_DRIFTED'));
assert.equal(driftedStyleReport.overallStatus, 'blocked');

const statusOnlyAcceptedPlan = clone(declaredPlan);
for (const beat of statusOnlyAcceptedPlan.beats.filter((item) => item.paperScene)) {
  beat.paperScene.dynamicCandidate = {status: 'accepted'};
  beat.paperScene.humanAcceptance = {status: 'accepted'};
}
const statusOnlyAcceptedReport = auditPaperPlan({style, plan: statusOnlyAcceptedPlan});
assert.equal(statusOnlyAcceptedReport.structuralStatus, 'pass');
assert.equal(statusOnlyAcceptedReport.acceptanceStatus, 'blocked');
assert.equal(statusOnlyAcceptedReport.overallStatus, 'blocked');
for (const shot of statusOnlyAcceptedReport.shots) {
  const codes = shot.findings.map((finding) => finding.code);
  assert.ok(codes.includes('DYNAMIC_CANDIDATE_RECEIPT_PATH_MISSING'));
  assert.ok(codes.includes('DYNAMIC_CANDIDATE_RECEIPT_SHA256_INVALID'));
  assert.ok(codes.includes('HUMAN_ACCEPTANCE_RECEIPT_PATH_MISSING'));
  assert.ok(codes.includes('HUMAN_ACCEPTANCE_RECEIPT_SHA256_INVALID'));
  assert.ok(codes.includes('HUMAN_ACCEPTANCE_REVIEWER_INVALID'));
  assert.ok(codes.includes('HUMAN_ACCEPTANCE_REVIEW_MODE_INVALID'));
  assert.ok(codes.includes('HUMAN_ACCEPTANCE_REVIEWED_AT_MISSING'));
}

const evidenceAcceptedPlan = clone(statusOnlyAcceptedPlan);
for (const [index, beat] of evidenceAcceptedPlan.beats.filter((item) => item.paperScene).entries()) {
  beat.paperScene.dynamicCandidate = {
    status: 'accepted',
    receiptPath: `edit/r10/dynamic/${index + 1}.json`,
    receiptSha256: 'a'.repeat(64),
  };
  beat.paperScene.humanAcceptance = {
    status: 'accepted',
    receiptPath: `edit/r10/human/${index + 1}.json`,
    receiptSha256: 'b'.repeat(64),
    reviewer: 'user',
    reviewMode: 'normal-speed-full-window',
    reviewedAt: '2026-09-12T12:00:00Z',
  };
}
const evidenceAcceptedReport = auditPaperPlan({style, plan: evidenceAcceptedPlan});
assert.equal(evidenceAcceptedReport.structuralStatus, 'pass');
assert.equal(evidenceAcceptedReport.acceptanceStatus, 'accepted');
assert.equal(evidenceAcceptedReport.overallStatus, 'blocked');
assert.equal(evidenceAcceptedReport.machineBoundary.aestheticApprovalGranted, false);

const invalidEntitiesPlan = clone(declaredPlan);
const invalidScene = invalidEntitiesPlan.beats.find((beat) => beat.id === 'B07').paperScene;
invalidScene.objectGroups = [
  {id: 'G1', name: '有效组一', depth: 1},
  {id: 'G1', name: '重复组一', depth: 2},
  {id: 'G3', name: '', depth: 3},
  {id: 'G4', name: '非法层组', depth: 0},
  {},
];
invalidScene.nodes = [
  {id: 'N1', label: '有效节点', groupId: 'G1'},
  {id: 'N1', label: '重复节点', groupId: 'G3'},
  {id: 'N3', label: '', groupId: 'G4'},
  {id: 'N4', label: '悬空节点', groupId: 'G404'},
  {},
  {id: 'N6', label: '缺少归属'},
  {id: 'N7', label: '仍然悬空', groupId: 'G1'},
  {id: 'N8', label: '仍然悬空', groupId: 'G3'},
  {id: 'N9', label: '仍然悬空', groupId: 'G4'},
];
invalidScene.stages = [
  {id: 'S1', order: 1, subject: 'G1', action: '动作一', sfxRole: 'paper-slide'},
  {id: 'S1', order: 3, subject: 'G3', action: '动作二', sfxRole: 'paper-slide'},
  {id: 'S3', order: 3, subject: 'G4', action: '', sfxRole: 'paper-slide'},
  {id: '', order: 4, subject: 'G404', action: '动作四', sfxRole: 'paper-slide'},
];
const invalidEntitiesReport = auditPaperPlan({style, plan: invalidEntitiesPlan});
const invalidEntitiesB07 = invalidEntitiesReport.shots.find((shot) => shot.beatId === 'B07');
const invalidEntityCodes = invalidEntitiesB07.findings.map((finding) => finding.code);
for (const code of [
  'GROUP_ID_MISSING',
  'GROUP_ID_DUPLICATE',
  'GROUP_NAME_MISSING',
  'GROUP_DEPTH_INVALID',
  'NODE_ID_MISSING',
  'NODE_ID_DUPLICATE',
  'NODE_LABEL_MISSING',
  'NODE_GROUP_ID_MISSING',
  'NODE_GROUP_REFERENCE_INVALID',
  'STAGE_ID_MISSING',
  'STAGE_ID_DUPLICATE',
  'STAGE_ORDER_NOT_CONTIGUOUS',
  'STAGE_ACTION_MISSING',
  'STAGE_SUBJECT_REFERENCE_INVALID',
]) {
  assert.ok(invalidEntityCodes.includes(code), `应检出 ${code}`);
}
assert.deepEqual(invalidEntitiesB07.metrics, {
  rawObjectGroupCount: 5,
  objectGroupCount: 0,
  rawSemanticNodeCount: 9,
  semanticNodeCount: 0,
  depthPlaneCount: 0,
  rawAssemblyBeatCount: 4,
  assemblyBeatCount: 0,
  stageCountWithSfxRole: 4,
  finalHoldSeconds: 1,
});
assert.equal(invalidEntitiesReport.structuralStatus, 'blocked');

console.log('director-r10-paper-quality tests passed');
