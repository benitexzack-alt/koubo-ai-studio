import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT, KB, CONTROL, OUTPUT, PUBLIC, RENDER, hashFile, readJson, digest,
  collectRuntime, requestIntentSha256, validatePermission, validatePreservedInputs} from './runner-core.mjs';

const absolute = name => path.isAbsolute(name) ? name : path.join(ROOT, name);
const read = name => readJson(absolute(name));
const hash = name => hashFile(absolute(name));
const control = name => `${CONTROL}/${name}`;
const captures = ['request.v1.json', 'request.v2.json', 'runtime-snapshot.v2.json',
  'review-request-intent.v2.json', 'still-coverage.v2.json', 'independent-review.v1.json',
  'context/context-binding.v2.json', 'context/validate-context.v2.result.json'].map(control)
  .concat(`${OUTPUT}/keyframe-visual-review.v1.json`, `${OUTPUT}/stills/receipt.json`)
  .map(name => ({path: name, sha256: hash(name)}));
const before = read(control('request.v1.json'));
const current = read(control('request.v2.json'));
const priorReview = read(control('independent-review.v1.json'));
assert.equal(hash(control('independent-review.v1.json')), '126ac070e985f96b92344ddbfe9fdede1d577f7286bd3bd016365c75f255e8e5');
assert.equal(requestIntentSha256(before), priorReview.requestIntentSha256);
const intent = read(control('review-request-intent.v2.json'));
assert.equal(requestIntentSha256(current), intent.requestIntentSha256);
assert.equal(current.independentReview.path, control('independent-review.v2.json'));
assert.equal(current.independentReview.sha256, null);
const omitDelta = ({knowledgeContext, bindings, independentReview, ...rest}) => rest;
assert.deepEqual(omitDelta(current), omitDelta(before));
assert.deepEqual(current.render, RENDER);
assert.equal(current.bindings.length, 51);
const replacements = new Map([
  [control('context/context-binding.v1.json'), control('context/context-binding.v2.json')],
  [control('still-coverage.v1.json'), control('still-coverage.v2.json')],
]);
const bindingDelta = [];
for (const previous of before.bindings) {
  const name = replacements.get(previous.path) ?? previous.path;
  const next = current.bindings.find(b => b.path === name);
  assert(next, name);
  if (previous.path !== control('context/context-binding.v1.json')) assert.equal(next.sha256, previous.sha256, name);
  if (name !== previous.path) bindingDelta.push({before: previous, after: next});
}
const byPath = new Map();
for (const binding of current.bindings) {
  assert(!byPath.has(binding.path));
  assert.equal(hash(binding.path), binding.sha256, binding.path);
  byPath.set(binding.path, binding.sha256);
}
const runtime = collectRuntime();
assert.deepEqual(runtime, read(control('runtime-snapshot.v2.json')));
assert.deepEqual(runtime, read(control('runtime-snapshot.v1.json')));
assert.equal(runtime.sha256, current.runtimeSha256);
assert.equal(runtime.sha256, 'f0649c76836fec6059a3757bd42d50e6a4104877873609cc9a2f3410c3ae5597');
const permission = read(current.permission.path);
assert.equal(hash(current.permission.path), current.permission.sha256);
validatePermission(permission, current, 'render');
const files = name => fs.statSync(absolute(name)).isFile() ? [name]
  : fs.readdirSync(absolute(name)).sort().flatMap(child => files(`${name}/${child}`));
validatePreservedInputs(permission, byPath, files(PUBLIC));
const manifest = read(control('public-assets.v1.json'));
assert.equal(manifest.bindings.length, 22);
for (const b of manifest.bindings) {
  const source = fs.statSync(absolute(b.source));
  const linked = fs.lstatSync(absolute(b.publicPath));
  assert(!linked.isSymbolicLink());
  assert.equal(source.ino, linked.ino);
  assert.equal(source.dev, linked.dev);
}
const binding = read(control('context/context-binding.v2.json'));
assert.deepEqual(current.knowledgeContext, binding);
assert.equal(hash(binding.contextPath), binding.sha256);
const context = read(binding.contextPath);
const validation = read(control('context/validate-context.v2.result.json'));
assert.equal(context.status, 'context-ready');
assert.equal(context.task.id, binding.taskId);
assert.equal(context.task.important, true);
assert.equal(validation.status, 'context-valid');
assert.equal(validation.gate.formal_execution_allowed, true);
assert.deepEqual(validation.problems, []);
assert.equal(read(control('context/validate-context.v2.command.json')).exitCode, 0);
const oldReceipts = read(control('context/read-receipts.v1.json')).receipts;
const newReceipts = read(control('context/read-receipts.v2.json')).receipts;
assert.equal(newReceipts.length, 24);
for (const r of newReceipts) {
  const previous = oldReceipts.find(x => x.path === r.path);
  for (const field of ['sha256', 'read_completed_at', 'read_scope', 'application_note']) assert.equal(r[field], previous[field]);
  assert.equal(hash(r.path), r.sha256);
}
const database = path.join(KB, '.opc-rag/opc_rag.sqlite3');
assert.equal(hash(database), context.index_freshness.generation.database_sha256);
for (const suffix of ['-wal', '-shm', '-journal']) assert(!fs.existsSync(database + suffix));
const staleSources = read(control('context/index-stale-diagnosis.v2.json')).changedFiles
  .map(changed => ({path: changed.path, boundSha256: changed.sha256, currentSha256: hash(changed.path)}))
  .filter(changed => changed.boundSha256 !== changed.currentSha256);
const coverage = read(control('still-coverage.v2.json'));
assert.deepEqual(coverage, read(control('still-coverage.v1.json')));
assert.deepEqual(current.stillFrames, coverage.stillFrames);
const parent = read(`${OUTPUT}/keyframe-visual-review.v1.json`);
const stills = read(`${OUTPUT}/stills/receipt.json`);
assert.equal(parent.requestIntentSha256, priorReview.requestIntentSha256);
assert.equal(stills.requestIntentSha256, priorReview.requestIntentSha256);
assert.equal(stills.runtimeSha256, runtime.sha256);
assert.equal(stills.inputDriftCheck, 'unchanged');
assert.equal(parent.parentStillReviewComplete, true);
assert.equal(parent.allPlannedStillFramesReviewed, true);
assert.equal(parent.actionDecision, 'allow-full-length-local-low-resolution-candidate-render');
assert.deepEqual(parent.coverage, coverage.coverage.map(c => ({...c, reviewed: true})));
assert.deepEqual(stills.outputs, parent.frames.map(({inspection, ...frame}) => frame));
assert.deepEqual(stills.outputs.map(f => f.frame), current.stillFrames);
assert.equal(stills.outputs.length, 62);
for (const f of stills.outputs) {
  assert.equal(hash(f.path), f.sha256);
  const png = fs.readFileSync(absolute(f.path));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 960);
  assert.equal(png.readUInt32BE(20), 540);
}
assert.equal(parent.contactSheets.length, 8);
for (const sheet of parent.contactSheets) assert.equal(hash(sheet.path), sheet.sha256);
const sfx = read(control('sfx-plan.v1.json'));
assert.equal(sfx.cues.length, 26);
assert.equal(sfx.pendingAsrItemsRemain, 13);
assert.equal(sfx.formalEnabled, false);
assert.deepEqual(sfx.sourceAudioGains, {host: 1, news: 0.62, paper: 0.1});
assert(sfx.cues.every(c => c.gain >= 0.26 && c.gain <= 0.36));
assert.equal(permission.acceptedPaperExceptions.length, 5);
assert.equal(parent.unresolvedAsrItems, 13);
for (const name of ['render', 'active.lock']) assert(!fs.existsSync(absolute(`${OUTPUT}/${name}`)));
for (const capture of captures) assert.equal(hash(capture.path), capture.sha256, '审查期间快照变化');
const result = {schemaVersion: 'candidate-r2-independent-delta-check/v2', checkedAt: new Date().toISOString(),
  status: staleSources.length ? 'static-delta-passed-context-blocked' : 'delta-checks-passed',
  captures, requestIntentSha256: intent.requestIntentSha256,
  runtimeSha256: runtime.sha256, runtimeFiles: runtime.files.length, runtimeUnchanged: true,
  boundInputCount: 51, bindingDelta, unchangedSamePathBindings: 49, coverageBytesUnchanged: true,
  noSourceVisualPublicSfxChanges: true, publicHardlinks: 22, contextBinding: binding,
  contextAndDatabaseHashesCurrent: true, contextSourceFreshnessCurrent: staleSources.length === 0,
  staleSources, reusedReadReceipts: 24, priorValidateExitCode: 0,
  currentReadonlyValidation: {path: control('independent-review.context-check.v2.json'),
    sha256: hash(control('independent-review.context-check.v2.json'))},
  stillCount: 62, stillPngDimensions: [960, 540],
  stillsMatchParentReview: true, contactSheets: parent.contactSheets,
  staticInspection: '已实际查看8页联系表；58/2498/2610/6360单图此前已查看，当前SHA未变。',
  noObservedP0P1: true, remainingP2: parent.remainingP2,
  unresolvedAsrItems: 13, acceptedPaperExceptions: permission.acceptedPaperExceptions,
  exceptionInheritance: permission.exceptionInheritance, cueCount: 26,
  fullDynamicReviewPerformed: false, humanListeningPerformed: false,
  formalEnabled: false, productionEligible: false, publishAuthorized: false,
  requestModified: false, renderPerformed: false};
fs.writeFileSync(absolute(control('independent-review.delta-check.v2.json')), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: result.status, checkedAt: result.checkedAt,
  requestIntentSha256: result.requestIntentSha256, runtimeSha256: result.runtimeSha256,
  boundInputCount: 51, stillCount: 62, formalEnabled: false}));
