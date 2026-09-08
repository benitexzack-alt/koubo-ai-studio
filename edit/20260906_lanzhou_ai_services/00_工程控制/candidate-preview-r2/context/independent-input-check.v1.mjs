import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT, KB, CONTROL, ENTRY, PUBLIC, OUTPUT, RENDER, COMPOSITION, RUNTIME_FILES,
  hashFile, readJson, digest, checked, collectRuntime, requestIntentSha256,
  collectLocalImports, loadTypescript, validatePermission, validatePreservedInputs} from '../runner-core.mjs';
import {selectStillFrames} from '../prepare-request.v1.mjs';

const file = name => checked(ROOT, name);
const read = name => readJson(file(name));
const names = ['request.v1.json', 'runtime-snapshot.v1.json', 'review-request-intent.v1.json', 'still-coverage.v1.json'];
const captures = names.map(name => ({path: `${CONTROL}/${name}`, sha256: hashFile(file(`${CONTROL}/${name}`))}));
const request = read(captures[0].path);
const runtimeSnapshot = read(captures[1].path);
const intent = read(captures[2].path);
const coverage = read(captures[3].path);
const permission = read(request.permission.path);
assert.equal(hashFile(file(request.permission.path)), request.permission.sha256);
validatePermission(permission, request, 'preflight');
validatePermission(permission, request, 'stills');
assert.equal(request.entry, ENTRY);
assert.equal(request.compositionId, COMPOSITION);
assert.equal(request.publicDir, PUBLIC);
assert.deepEqual(request.render, RENDER);
assert.equal(request.independentReview.path, `${CONTROL}/independent-review.v1.json`);
assert.equal(request.independentReview.sha256, null);
assert.equal(requestIntentSha256(request), intent.requestIntentSha256);
assert.equal(request.runtimeSha256, intent.runtimeSha256);
assert.equal(runtimeSnapshot.sha256, digest(runtimeSnapshot.files));
const runtime = collectRuntime();
assert.deepEqual(runtime, runtimeSnapshot, '实际runtime与capture不一致');
assert.equal(runtime.sha256, request.runtimeSha256);
const byPath = new Map();
for (const binding of request.bindings) {
  assert.equal(byPath.has(binding.path), false);
  assert.equal(hashFile(file(binding.path)), binding.sha256, binding.path);
  byPath.set(binding.path, binding.sha256);
}
const list = name => fs.statSync(file(name)).isFile() ? [name]
  : fs.readdirSync(file(name)).sort().flatMap(n => list(`${name}/${n}`));
const publicFiles = list(PUBLIC);
validatePreservedInputs(permission, byPath, publicFiles);
assert.equal(publicFiles.length, 22);
const manifest = read(`${CONTROL}/public-assets.v1.json`);
assert.deepEqual(publicFiles.sort(), manifest.bindings.map(b => b.publicPath).sort());
for (const b of manifest.bindings) {
  const original = fs.statSync(file(b.source));
  const linked = fs.lstatSync(file(b.publicPath));
  assert.equal(linked.isSymbolicLink(), false);
  assert.equal(linked.ino, original.ino);
  assert.equal(linked.dev, original.dev);
  assert.equal(byPath.get(b.publicPath), b.sha256);
}
const imports = collectLocalImports(ROOT, ENTRY, byPath, loadTypescript());
const contextBinding = read(`${CONTROL}/context/context-binding.v1.json`);
assert.deepEqual(request.knowledgeContext, contextBinding);
assert.equal(hashFile(contextBinding.contextPath), contextBinding.sha256);
const context = readJson(contextBinding.contextPath);
const validation = read(`${CONTROL}/context/validate-context.v1.result.json`);
assert.equal(context.task.id, contextBinding.taskId);
assert.equal(context.task.important, true);
assert.equal(context.status, 'context-ready');
assert.equal(context.gate.formal_execution_allowed, true);
assert.equal(context.project_route.project_root, ROOT);
assert.equal(validation.status, 'context-valid');
assert.deepEqual(validation.problems, []);
const materials = context.receipt_groups.task_original_materials;
assert.equal(materials.status, 'complete');
for (const name of imports.filter(n => n === ENTRY || n.endsWith('.json'))) {
  const receipt = materials.entries.find(r => r.resolved_path === path.join(ROOT, name));
  assert(receipt, name);
  assert.equal(receipt.sha256, byPath.get(name), name);
  for (const state of ['retrieved', 'read', 'applied']) assert.equal(receipt.states[state], true);
  assert(receipt.application_note.trim());
}
const receipts = Object.values(context.receipt_groups).flatMap(g => g.entries);
for (const receipt of receipts) assert.equal(hashFile(receipt.resolved_path), receipt.sha256, receipt.resolved_path);
const database = path.join(KB, '.opc-rag/opc_rag.sqlite3');
assert.equal(hashFile(database), context.index_freshness.generation.database_sha256, '索引代际变化');
for (const suffix of ['-wal', '-shm', '-journal']) assert.equal(fs.existsSync(database + suffix), false);
const visualPath = path.posix.join(path.posix.dirname(ENTRY), 'visual-plan.v1.json');
const visual = read(visualPath);
const selection = read(visual.shotcraftSelection.path);
const sfx = read(`${CONTROL}/sfx-plan.v1.json`);
assert.equal(hashFile(file(visual.shotcraftSelection.path)), visual.shotcraftSelection.sha256);
assert.equal(visual.shotcraftSelection.path.endsWith('output-selection.derived.v2.json'), true);
assert.equal(visual.sfxPlan.sha256, byPath.get(`${CONTROL}/sfx-plan.v1.json`));
assert.equal(sfx.visualSource.selectionSha256, visual.shotcraftSelection.sha256);
assert.equal(hashFile(sfx.visualSource.prepareVisualPath), sfx.visualSource.prepareVisualSha256);
assert.deepEqual(sfx.sourceAudioGains, {host: 1, news: 0.62, paper: 0.1});
assert.deepEqual(visual.sfx, sfx.cues);
assert.equal(sfx.cues.length, 26);
assert.equal(sfx.publicAssets.length, 9);
assert.equal(sfx.pendingAsrItemsRemain, 13);
assert.equal(sfx.formalEnabled, false);
assert.equal(visual.formal, false);
const rows = [...visual.semantic, ...visual.effects];
const occurrences = new Map();
for (const cue of sfx.cues) {
  assert(cue.gain >= 0.26 && cue.gain <= 0.36);
  assert.equal(byPath.get(`${PUBLIC}/${cue.publicPath}`), cue.sourceSha256);
  assert(Number.isInteger(cue.sourceStartFrame) && cue.sourceStartFrame >= 0);
  assert(Number.isInteger(cue.durationInFrames) && cue.durationInFrames > 0);
  assert.equal(cue.fadeOutFrames, 1);
  assert(cue.frame + cue.durationInFrames <= 8393);
  const row = rows.find(r => r.id === cue.visualId);
  assert(row && cue.frame >= row.from && cue.frame + cue.durationInFrames <= row.to, cue.id);
  assert.equal(row.from, cue.visualBinding.from);
  assert.equal(row.to, cue.visualBinding.to);
  assert.equal(hashFile(cue.visualBinding.sourcePath), cue.visualBinding.sourceSha256);
  for (const interval of sfx.protectedIntervals) assert(cue.frame + cue.durationInFrames <= interval.from || cue.frame >= interval.to, cue.id);
  const group = occurrences.get(cue.publicPath) ?? [];
  group.push(cue.frame);
  occurrences.set(cue.publicPath, group);
}
for (const frames of occurrences.values()) {
  assert(frames.length <= 3);
  for (let i = 1; i < frames.length; i++) assert(frames[i] - frames[i - 1] >= 750);
}
for (let i = 1; i < sfx.cues.length; i++) {
  assert(sfx.cues[i].frame >= sfx.cues[i - 1].frame + sfx.cues[i - 1].durationInFrames);
  assert.notEqual(sfx.cues[i].publicPath, sfx.cues[i - 1].publicPath);
}
for (const row of visual.effects) {
  const beat = selection.beats.find(b => b.beatId === row.id);
  assert.equal(beat.decision, 'apply');
  assert.deepEqual(row.props, beat.componentProps);
  assert.deepEqual(row.wordFrames, beat.componentProps.items?.map(x => x.atFrame) ?? []);
}
const expectedCoverage = {...selectStillFrames(visual), plan: {path: visualPath, sha256: byPath.get(visualPath)}};
assert.deepEqual(coverage, expectedCoverage);
assert.deepEqual(request.stillFrames, coverage.stillFrames);
assert.equal(coverage.allFramesReviewed, false);
assert.equal(coverage.fullRenderPendingParentStillReview, true);
for (const name of ['active.lock', 'stills', 'render']) assert.equal(fs.existsSync(path.join(ROOT, OUTPUT, name)), false);
for (const capture of captures) assert.equal(hashFile(file(capture.path)), capture.sha256, '审查期间快照变化');
const result = {schemaVersion: 'candidate-r2-independent-static-check/v1', checkedAt: new Date().toISOString(),
  status: 'static-checks-passed', captures, requestIntentSha256: intent.requestIntentSha256,
  runtimeSha256: runtime.sha256, runtimeFiles: runtime.files.length, boundInputCount: request.bindings.length,
  imports, contextBinding, contextReceiptEntries: receipts.length, priorValidateExitCode: 0,
  officialValidationRepeated: false, contextAndIndexHashesCurrent: true,
  publicHardlinks: 22, reusedPublic: 13, existingSfxFiles: 9, cueCount: 26,
  cueSourceBindingsCurrent: true, cueVisualRowsBound: true, noProtectedWindowOverlap: true,
  cueOffsetsDurationsGainsConsumed: true, sourceGains: sfx.sourceAudioGains,
  coverageCounts: coverage.counts, allFramesReviewed: false, audioHeard: false,
  protectedExceptionsUnchanged: true, unresolvedAsrCount: 13,
  checkedRuntimeCode: RUNTIME_FILES.map(n => ({path: n, sha256: hashFile(file(n))})),
  requestModified: false, renderPerformed: false, formalEnabled: false, publishAuthorized: false};
fs.writeFileSync(path.join(ROOT, CONTROL, 'context/independent-input-check.v1.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(result, null, 2));
