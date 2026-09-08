import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT, KB, CONTROL, OUTPUT, hashFile, readJson, requestIntentSha256, digest, validatePermission} from './runner-core.mjs';
const abs = p => path.isAbsolute(p) ? p : path.join(ROOT, p);
const hash = p => hashFile(abs(p));
const read = p => readJson(abs(p));
const c = name => `${CONTROL}/${name}`;
const prior = read(c('independent-review.delta-check.v2.json'));
assert.equal(hash(c('independent-review.delta-check.v2.json')), '4b50b747e2d5861c0c5ebaf919945c71d30f5830694c2dd69366cd72fdd6c7dd');
assert.equal(hash(c('independent-review.v2.json')), '4f7f2a1f3a9bd8b631fffda3a731039dab5a1eb9f81b989698a3ef3fe081df62');
const before = read(c('request.v2.json'));
const request = read(c('request.v3.json'));
const captures = ['request.v3.json', 'runtime-snapshot.v3.json', 'still-coverage.v3.json', 'review-request-intent.v3.json'].map(c).map(p => ({path: p, sha256: hash(p)}));
assert.equal(requestIntentSha256(before), prior.requestIntentSha256);
const intent = read(c('review-request-intent.v3.json'));
assert.equal(requestIntentSha256(request), intent.requestIntentSha256);
const omit = ({knowledgeContext, bindings, independentReview, ...rest}) => rest;
assert.deepEqual(omit(request), omit(before));
assert.deepEqual(request.independentReview, {path: c('independent-review.v3.json'), sha256: null});
assert.equal(request.bindings.length, 51);
const delta = [];
const byPath = new Map(request.bindings.map(b => [b.path, b]));
assert.equal(byPath.size, 51);
for (const previous of before.bindings) {
  const context = previous.path === c('context/context-binding.v2.json');
  const coverage = previous.path === c('still-coverage.v2.json');
  const next = byPath.get(context ? c('context/context-binding.v3.json') : coverage ? c('still-coverage.v3.json') : previous.path);
  assert(next, previous.path);
  if (!context) assert.equal(next.sha256, previous.sha256, previous.path);
  assert.equal(hash(next.path), next.sha256, next.path);
  if (context || coverage) delta.push({before: previous, after: next});
}
const snapshot = read(c('runtime-snapshot.v3.json'));
assert.deepEqual(snapshot, read(c('runtime-snapshot.v2.json')));
assert.equal(digest(snapshot.files), snapshot.sha256);
assert.equal(snapshot.sha256, prior.runtimeSha256);
assert.equal(request.runtimeSha256, snapshot.sha256);
assert.equal(intent.runtimeSha256, snapshot.sha256);
const permission = read(request.permission.path);
assert.equal(hash(request.permission.path), request.permission.sha256);
for (const command of ['preflight', 'render']) validatePermission(permission, request, command);
const binding = read(c('context/context-binding.v3.json'));
assert.deepEqual(request.knowledgeContext, binding);
assert.equal(hash(binding.contextPath), binding.sha256);
const context = read(binding.contextPath);
const validation = read(c('context/validate-context.v3.result.json'));
assert.equal(context.status, 'context-ready');
assert.equal(context.task.id, binding.taskId);
assert.equal(context.task.important, true);
assert.equal(validation.status, 'context-valid');
assert.deepEqual(validation.problems, []);
assert.equal(validation.gate.formal_execution_allowed, true);
assert.equal(read(c('context/validate-context.v3.command.json')).exitCode, 0);
const db = path.join(KB, '.opc-rag/opc_rag.sqlite3');
assert.equal(hash(db), context.index_freshness.generation.database_sha256);
for (const suffix of ['-wal', '-shm', '-journal']) assert(!fs.existsSync(db + suffix));
const attempt = read(c('context/start-attempt.v3.json'));
assert.equal(hash(attempt.changedSource.path), attempt.changedSource.sha256);
const policy = read(attempt.stabilityWindow.statePath).dailyBookkeepingPolicy;
assert.equal(policy.status, 'deferred-during-active-production-context');
assert(policy.skipDailyScan && policy.skipDailyAppend);
assert.deepEqual(read(c('still-coverage.v3.json')), read(c('still-coverage.v2.json')));
for (const receipt of prior.captures.filter(b => b.path.startsWith(OUTPUT))) assert.equal(hash(receipt.path), receipt.sha256);
const parent = read(`${OUTPUT}/keyframe-visual-review.v1.json`);
assert.equal(parent.parentStillReviewComplete, true);
assert.equal(parent.allPlannedStillFramesReviewed, true);
assert.deepEqual(parent.frames.map(f => f.frame), request.stillFrames);
for (const f of parent.frames) assert.equal(hash(f.path), f.sha256);
for (const sheet of parent.contactSheets) assert.equal(hash(sheet.path), sheet.sha256);
assert.equal(parent.frames.length, 62);
for (const capture of captures) assert.equal(hash(capture.path), capture.sha256);
assert(!fs.existsSync(abs(`${OUTPUT}/render`)));
const result = {schemaVersion: 'candidate-r2-independent-generation-delta/v3', checkedAt: new Date().toISOString(),
  status: 'delta-checks-passed', requestIntentSha256: intent.requestIntentSha256, runtimeSha256: snapshot.sha256,
  captures, bindingDelta: delta, boundInputCount: 51, unchangedSamePathBindings: 49, coverageBytesUnchanged: true,
  contextBinding: binding, contextStatus: validation.status, priorValidateExitCode: 0, contextFreshnessHashesCurrent: true,
  runtimeCaptureCommand: 'node prepare-request.v1.mjs v3 v3 --capture', runtimeFiles: snapshot.files.length,
  runtimeVerifiedByCurrentCapture: true, secondFullRuntimeCollectionPerformed: false,
  inheritedReview: {path: c('independent-review.v2.json'), sha256: hash(c('independent-review.v2.json'))},
  inheritedMachineEvidence: {path: c('independent-review.delta-check.v2.json'), sha256: hash(c('independent-review.delta-check.v2.json'))},
  sourceVisualPublicSfxUnchanged: true, stillHashCount: 62, stillImagesReopened: false, stillsRerendered: false,
  priorP2: prior.remainingP2, unresolvedAsrItems: 13, acceptedPaperExceptions: permission.acceptedPaperExceptions,
  fullDynamicReviewPerformed: false, humanListeningPerformed: false, formalEnabled: false,
  productionEligible: false, publishAuthorized: false, requestModified: false, reviewShaBound: false};
fs.writeFileSync(abs(c('independent-review.delta-check.v3.json')), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: result.status, checkedAt: result.checkedAt, requestIntentSha256: result.requestIntentSha256,
  runtimeSha256: result.runtimeSha256, contextBinding: binding, formalEnabled: false}));
