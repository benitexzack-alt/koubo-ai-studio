import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {
  compilePostshootRebindPlan,
  validatePostshootRebindRequest,
  validatePostshootRebindPlan,
} from '../scripts/postshoot-rebind-core.mjs';
import {sha256File} from '../scripts/preproduction-director-core.mjs';

function fixture(run) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'koubo-postshoot-incident-'));
  const put = (name, value) => {
    const target = path.join(root, name);
    writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
    return {path: target, sha256: sha256File(target)};
  };
  const timeline = {captions: [
    {id: 'C1', startMs: 1000, endMs: 2000, text: '算力可以按需租用'},
    {id: 'C2', startMs: 3000, endMs: 4000, text: '后面解释实际做法'},
  ]};
  const pre = {taskId: 'task-1', requestId: 'pre-1'};
  const preRequest = put('pre-request.json', pre);
  const prePlanBody = {...pre, formalEligible: false, policy: {incidentPreventionVersion: '1'}, beats: [
    {id: 'B1', spokenLine: '算力可以按需租用', paperScene: {
      nodes: [{id: 'N1', label: '按需租用'}],
      stages: [{id: 'S1', subject: 'moving-part'}],
      textPlan: [{nodeId: 'N1', text: '按需租用', embeddingMode: 'first-frame-baked',
        enterStageId: 'initial', persistence: 'initial-to-end', firstReadableFrame: 0}],
    }},
    {id: 'B2', spokenLine: '完全没有说出的下一期安排'},
  ]};
  const prePlan = put('pre-plan.json', prePlanBody);
  const preValidation = put('pre-validation.json', {taskId: pre.taskId,
    status: 'validated-provisional-previsualization', skillExecuted: true,
    artifacts: {request: preRequest, plan: prePlan}});
  const media = put('media.mp4', 'unit-test-media-not-production');
  const spoken = put('spoken.json', timeline);
  const request = {
    schemaVersion: 'koubo-director-postshoot-rebind-request/v1',
    requestId: 'post-1', revisionId: 'revision-1', taskId: 'task-1', phase: 'post-shoot',
    policy: {incidentPreventionVersion: '1'}, timelineFps: 30,
    sourcePreproduction: {requestPath: preRequest.path, requestSha256: preRequest.sha256,
      planPath: prePlan.path, planSha256: prePlan.sha256,
      validationReceiptPath: preValidation.path, validationReceiptSha256: preValidation.sha256},
    recordedMedia: {...media, durationSeconds: 5},
    spokenTimeline: {...spoken, authority: 'recorded-audio', scriptRole: 'comparison-only'},
    mappings: [{beatId: 'B1', order: 1, disposition: 'keep', startSeconds: 2, endSeconds: 4,
      semanticTimingMode: 'contextual-summary-after-spoken-terms',
      actualCaptionIds: ['C1'], actualSpokenLine: '算力可以按需租用',
      semanticAnchorText: '按需租用', anchorStartMs: 1000, anchorEndMs: 2000,
      alignmentStatus: 'exact', textDecision: 'confirmed', visualDecision: 'keep',
      nodeTextBindings: [{nodeId: 'N1', resolvedText: '按需租用', enterStageId: 'initial',
        actualCaptionIds: ['C1'], actualSpokenTerms: ['按需租用'],
        anchorStartMs: 1000, anchorEndMs: 2000, visualEnterMs: 2000,
        firstReadableFrame: 0, labelEnterFrame: 0, stageActionFrame: null,
        emphasisStageId: null, emphasisFrame: null, alignmentStatus: 'exact'}]},
    {beatId: 'B2', order: 2, disposition: 'omit', reason: 'not-spoken'}],
    outputs: {rebindPlanPath: path.join(root, 'plan.json'),
      validationReceiptPath: path.join(root, 'validation.json')},
  };
  const identity = (beatId, target = 'beat') => ({taskId: request.taskId,
    requestId: request.requestId, revisionId: request.revisionId, beatId, target,
    recordedMediaSha256: media.sha256, spokenTimelineSha256: spoken.sha256,
    preproductionPlanSha256: prePlan.sha256});
  const omission = {...identity('B2'), schemaVersion: 'koubo-postshoot-omission-evidence/v1',
    reason: 'not-spoken', preproductionSpokenLine: prePlanBody.beats[1].spokenLine,
    review: {reviewerId: 'independent-reviewer', reviewedAt: '2026-09-08T12:00:00Z',
      method: 'full-recording-and-transcript-review', rangeMs: [0, 5000]},
    captionAssessments: timeline.captions.map(c => ({captionId: c.id, text: c.text,
      relation: 'not-this-beat', reason: 'This caption concerns another recorded beat.'}))};
  request.mappings[1].omissionEvidence = put('omission.json', omission);
  const requestPath = path.join(root, 'request.json');
  const validate = () => validatePostshootRebindRequest({request, projectRoot: root});
  const compile = () => {
    put('request.json', request);
    return compilePostshootRebindPlan({request, requestPath, validation: validate()});
  };
  const approvePartial = () => {
    const source = put('user-message.txt', 'I accept this partial alignment for this revision only.');
    const approval = {...identity('B1'), schemaVersion: 'koubo-postshoot-partial-approval/v1',
      approved: true, approvedBy: 'user', approvedAt: '2026-09-08T12:00:00Z',
      approvalQuote: readFileSync(source.path, 'utf8'), sourceMessage: source};
    request.mappings[0].alignmentStatus = 'partial';
    request.mappings[0].partialException = {...identity('B1'), approved: true, approvedBy: 'user',
      approvedAt: approval.approvedAt, scope: 'B1', reason: 'Explicit scoped acceptance.',
      approvalEvidence: put('approval.json', approval)};
  };
  try { run({root, put, request, requestPath, validate, compile, omission, approvePartial}); }
  finally { rmSync(root, {recursive: true, force: true}); }
}

function useLegacyCompatibleKeptBeats(f) {
  const first = f.request.mappings[0];
  first.startSeconds = 1;
  first.endSeconds = 2;
  first.semanticTimingMode = 'within-beat';
  Object.assign(first.nodeTextBindings[0], {visualEnterMs: 1000, stageActionFrame: 0});
  f.request.mappings[1] = {beatId: 'B2', order: 2, disposition: 'keep',
    startSeconds: 3, endSeconds: 4, actualCaptionIds: ['C2'],
    actualSpokenLine: '后面解释实际做法', semanticAnchorText: '实际做法',
    anchorStartMs: 3000, anchorEndMs: 4000, alignmentStatus: 'exact',
    nodeTextBindings: [], textDecision: 'confirmed', visualDecision: 'keep'};
}

test('safe initial labels and evidence-backed omission compile without invented motion or speech', () => fixture(f => {
  const v = f.validate();
  assert.equal(v.ok, true, v.errors.join('\n'));
  const plan = f.compile();
  assert.deepEqual(plan.beats.map(b => b.id), ['B1']);
  assert.deepEqual(plan.beatDispositions.map(b => b.beatId), ['B1', 'B2']);
  assert.equal(plan.beatDispositions[1].disposition, 'omit');
  assert.equal(plan.paperScenes[0].textPlan[0].postshootBinding.firstReadableFrame, 0);
  assert.equal(plan.policy.incidentPreventionVersion, '1');
}));

test('new requests cannot silently use legacy mode', () => fixture(f => {
  useLegacyCompatibleKeptBeats(f);
  delete f.request.policy;
  assert.equal(f.validate().ok, false);
}));

test('top-level safety version is accepted when policy is absent', () => fixture(f => {
  delete f.request.policy;
  f.request.incidentPreventionVersion = '1';
  assert.equal(f.validate().ok, true, f.validate().errors.join('\n'));
}));

test('omission cannot contain output timing or borrowed actual speech', () => fixture(f => {
  Object.assign(f.request.mappings[1], {startSeconds: 4, endSeconds: 5,
    actualSpokenLine: '后面解释实际做法', actualCaptionIds: ['C2']});
  assert.equal(f.validate().ok, false);
}));

for (const mode of ['missing', 'wrong-source', 'incomplete-transcript', 'spoken-match']) {
  test(`omission rejects ${mode} evidence`, () => fixture(f => {
    if (mode === 'missing') delete f.request.mappings[1].omissionEvidence;
    else {
      if (mode === 'wrong-source') f.omission.recordedMediaSha256 = '0'.repeat(64);
      if (mode === 'incomplete-transcript') f.omission.captionAssessments.pop();
      if (mode === 'spoken-match') f.omission.captionAssessments[0].relation = 'spoken';
      f.request.mappings[1].omissionEvidence = f.put('omission.json', f.omission);
    }
    assert.equal(f.validate().ok, false);
  }));
}

test('a partial approval cannot be inherited from another revision', () => fixture(f => {
  f.approvePartial();
  assert.equal(f.validate().ok, true, f.validate().errors.join('\n'));
  f.request.mappings[0].partialException.revisionId = 'old-revision';
  assert.equal(f.validate().ok, false);
}));

test('legacy generic partial exception cannot authorize the safety contract', () => fixture(f => {
  useLegacyCompatibleKeptBeats(f);
  f.request.mappings[0].alignmentStatus = 'partial';
  f.request.mappings[0].partialException = {approved: true, approvedBy: 'user',
    approvedAt: 'yesterday', reason: 'accepted', scope: 'this-beat'};
  assert.equal(f.validate().ok, false);
}));

test('first-frame-baked labels cannot be falsely declared as appearing later', () => fixture(f => {
  Object.assign(f.request.mappings[0].nodeTextBindings[0], {
    firstReadableFrame: 30, labelEnterFrame: 30, visualEnterMs: 3000,
    stageActionFrame: 30, emphasisFrame: 30, emphasisStageId: 'S1'});
  assert.equal(f.validate().ok, false);
}));

test('rigid label action and emphasis may occur after genuine frame-zero readability', () => fixture(f => {
  Object.assign(f.request.mappings[0].nodeTextBindings[0], {
    stageActionFrame: 30, emphasisFrame: 30, emphasisStageId: 'S1'});
  assert.equal(f.validate().ok, true, f.validate().errors.join('\n'));
}));

test('frame-zero visibility still enforces the 300ms semantic limit', () => fixture(f => {
  const m = f.request.mappings[0];
  m.semanticTimingMode = 'within-beat';
  m.startSeconds = 0;
  m.nodeTextBindings[0].visualEnterMs = 0;
  const v = f.validate();
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes('POSTSHOOT_NODE_VISUAL_CLAIM_TOO_EARLY:B1:N1'));
}));

test('compiler rejects mutated request after validation', () => fixture(f => {
  const validation = f.validate();
  f.put('request.json', f.request);
  f.request.mappings[0].actualSpokenLine = 'never spoken';
  assert.throws(() => compilePostshootRebindPlan({request: f.request,
    requestPath: f.requestPath, validation}));
}));

test('whole-transcript exact spoken match defeats a false not-spoken review', () => fixture(f => {
  const evidence = {...f.omission, beatId: 'B1', preproductionSpokenLine: '算力可以按需租用'};
  f.request.mappings[0] = {beatId: 'B1', order: 1, disposition: 'omit', reason: 'not-spoken',
    omissionEvidence: f.put('false-omission.json', evidence)};
  const result = f.validate();
  assert.ok(result.errors.includes('POSTSHOOT_OMIT_SPOKEN_CONTENT_DETECTED:B1'));
}));

for (const field of ['taskId', 'requestId', 'revisionId', 'recordedMediaSha256',
  'spokenTimelineSha256', 'preproductionPlanSha256', 'beatId', 'target']) {
  test(`partial approval rejects replay with changed ${field}`, () => fixture(f => {
    f.approvePartial();
    const exception = f.request.mappings[0].partialException;
    exception[field] = 'changed';
    assert.equal(f.validate().ok, false);
  }));
}

test('partial approval quote must exist in its bound source message', () => fixture(f => {
  f.approvePartial();
  const exception = f.request.mappings[0].partialException;
  const approval = JSON.parse(readFileSync(exception.approvalEvidence.path, 'utf8'));
  approval.approvalQuote = 'This sentence was never approved.';
  exception.approvalEvidence = f.put('approval.json', approval);
  assert.ok(f.validate().errors.includes('POSTSHOOT_PARTIAL_APPROVAL:B1:beat_QUOTE_NOT_IN_SOURCE'));
}));

test('partial acceptance never waives first readability or the 300ms limit', () => fixture(f => {
  f.approvePartial();
  f.request.mappings[0].semanticTimingMode = 'within-beat';
  f.request.mappings[0].startSeconds = 0;
  f.request.mappings[0].nodeTextBindings[0].visualEnterMs = 0;
  assert.ok(f.validate().errors.includes('POSTSHOOT_NODE_VISUAL_CLAIM_TOO_EARLY:B1:N1'));
}));

test('declaring an earlier semantic anchor cannot invent word timestamps', () => fixture(f => {
  const m = f.request.mappings[0];
  m.semanticTimingMode = 'within-beat';
  m.startSeconds = 1;
  m.nodeTextBindings[0].visualEnterMs = 1000;
  assert.ok(f.validate().errors.includes('POSTSHOOT_NODE_VISUAL_CLAIM_TOO_EARLY:B1:N1'));
}));

test('initial is not a real action or emphasis stage', () => fixture(f => {
  Object.assign(f.request.mappings[0].nodeTextBindings[0], {
    emphasisStageId: 'initial', stageActionFrame: 0, emphasisFrame: 0});
  assert.ok(f.validate().errors.includes('POSTSHOOT_EMPHASIS_ACTION_BINDING_INVALID:B1:N1'));
}));

test('legacy labelEnterFrame cannot contradict firstReadableFrame', () => fixture(f => {
  f.request.mappings[0].nodeTextBindings[0].labelEnterFrame = 1;
  assert.ok(f.validate().errors.includes('POSTSHOOT_FIRST_READABLE_FRAME_INVALID:B1:N1'));
}));

test('output validator rejects altered speech, timing, omitted-beat ledger and policy', () => fixture(f => {
  const plan = f.compile();
  const validation = f.validate();
  assert.equal(validatePostshootRebindPlan({request: f.request, requestPath: f.requestPath,
    validation, plan}).ok, true);
  for (const mutate of [p => { p.beats[0].spokenLine = 'invented'; },
    p => { p.paperScenes[0].textPlan[0].postshootBinding.firstReadableFrame = 20; },
    p => { p.beatDispositions.pop(); }, p => { delete p.policy; }]) {
    const changed = structuredClone(plan);
    mutate(changed);
    assert.equal(validatePostshootRebindPlan({request: f.request, requestPath: f.requestPath,
      validation, plan: changed}).ok, false);
  }
}));

test('compiler rejects source or omission evidence drift after validation', () => fixture(f => {
  const validation = f.validate();
  f.put('request.json', f.request);
  f.put('omission.json', {...f.omission, reason: 'changed'});
  assert.throws(() => compilePostshootRebindPlan({request: f.request, requestPath: f.requestPath,
    validation}), /POSTSHOOT_COMPILE_REQUIRES_CURRENT_SAFE_VALIDATION/);
}));

const validatorCli = fileURLToPath(new URL('../scripts/validate-postshoot-director.mjs', import.meta.url));
test('CLI only writes a safe receipt for the exact derived output, without overwriting', () => fixture(f => {
  const plan = f.compile();
  f.put('plan.json', plan);
  const args = [validatorCli, '--repo-root', f.root, '--request', f.requestPath];
  const result = spawnSync(process.execPath, args, {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const receiptPath = f.request.outputs.validationReceiptPath;
  const before = sha256File(receiptPath);
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert.equal(receipt.policy.incidentPreventionVersion, '1');
  assert.equal(receipt.gates.renderedAssetTimingVerified, false);
  assert.equal(spawnSync(process.execPath, args, {encoding: 'utf8'}).status, 1);
  assert.equal(sha256File(receiptPath), before);
}));

test('CLI rejects a tampered plan before creating any receipt', () => fixture(f => {
  const plan = f.compile();
  plan.beats[0].spokenLine = 'invented';
  f.put('plan.json', plan);
  const result = spawnSync(process.execPath, [validatorCli, '--repo-root', f.root,
    '--request', f.requestPath], {encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /POSTSHOOT_PLAN_DERIVATION_MISMATCH/);
  assert.equal(existsSync(f.request.outputs.validationReceiptPath), false);
}));

test('compiler rereads source data instead of trusting mutated validation objects', () => fixture(f => {
  f.put('request.json', f.request);
  const validation = f.validate();
  validation.prePlan.beats[0].paperScene.textPlan[0].text = 'invented';
  const plan = compilePostshootRebindPlan({request: f.request, requestPath: f.requestPath, validation});
  assert.equal(plan.paperScenes[0].textPlan[0].text, '按需租用');
}));

test('duplicated caption ids cannot fabricate repeated recorded speech', () => fixture(f => {
  f.request.mappings[0].actualCaptionIds = ['C1', 'C1'];
  f.request.mappings[0].actualSpokenLine = '算力可以按需租用算力可以按需租用';
  assert.ok(f.validate().errors.includes('POSTSHOOT_CAPTION_ORDER_OR_DUPLICATE:B1'));
}));

test('300ms boundary uses real first-readable frame, not a later claimed timestamp', () => fixture(f => {
  const m = f.request.mappings[0];
  m.semanticTimingMode = 'within-beat';
  m.startSeconds = 1.7;
  m.anchorStartMs = 1700;
  m.nodeTextBindings[0].anchorStartMs = 1700;
  m.nodeTextBindings[0].visualEnterMs = 1700;
  assert.equal(f.validate().ok, true, f.validate().errors.join('\n'));
  m.startSeconds = 1.699;
  m.anchorStartMs = 1699;
  m.nodeTextBindings[0].anchorStartMs = 1699;
  const result = f.validate();
  assert.ok(result.errors.includes('POSTSHOOT_NODE_VISUAL_CLAIM_TOO_EARLY:B1:N1'));
}));

test('new safety mode cannot accept an old preproduction plan by stripping its policy', () => fixture(f => {
  const source = f.request.sourcePreproduction;
  const plan = JSON.parse(readFileSync(source.planPath, 'utf8'));
  delete plan.policy;
  const changed = f.put('pre-plan.json', plan);
  source.planSha256 = changed.sha256;
  const receipt = JSON.parse(readFileSync(source.validationReceiptPath, 'utf8'));
  receipt.artifacts.plan = changed;
  source.validationReceiptSha256 = f.put('pre-validation.json', receipt).sha256;
  f.omission.preproductionPlanSha256 = changed.sha256;
  f.request.mappings[1].omissionEvidence = f.put('omission.json', f.omission);
  assert.ok(f.validate().errors.includes('POSTSHOOT_PRE_PLAN_SAFETY_VERSION_INVALID'));
}));

test('neutral-background self-report does not waive a future visible claim', () => fixture(f => {
  const m = f.request.mappings[0];
  m.semanticTimingMode = 'within-beat';
  m.startSeconds = 0;
  Object.assign(m.nodeTextBindings[0], {visualEnterMs: 0,
    neutralMechanismBackground: true, semanticLeadExempt: true});
  assert.ok(f.validate().errors.includes('POSTSHOOT_NODE_VISUAL_CLAIM_TOO_EARLY:B1:N1'));
}));

test('existing rebind CLI and validator round-trip the new contract in an isolated fixture', () => fixture(f => {
  f.put('request.json', f.request);
  const compiler = fileURLToPath(new URL('../scripts/rebind-postshoot-director.mjs', import.meta.url));
  const args = ['--repo-root', f.root, '--request', f.requestPath];
  const compiled = spawnSync(process.execPath, [compiler, ...args], {encoding: 'utf8'});
  assert.equal(compiled.status, 0, compiled.stderr);
  const validated = spawnSync(process.execPath, [validatorCli, ...args], {encoding: 'utf8'});
  assert.equal(validated.status, 0, validated.stderr);
  const plan = JSON.parse(readFileSync(f.request.outputs.rebindPlanPath, 'utf8'));
  assert.deepEqual(plan.beats.map(b => b.id), ['B1']);
  assert.equal(plan.beatDispositions[1].reason, 'not-spoken');
}));
