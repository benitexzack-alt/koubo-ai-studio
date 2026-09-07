import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ROOT, KB, CONTROL, ENTRY, RUNTIME_FILES, collectRuntime, collectLocalImports, loadTypescript,
  validatePermission, digest, hashFile, readJson, requestIntentSha256} from '../runner-core.mjs';
import {validateKnowledge} from '../runner.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const requestPath = path.join(ROOT, CONTROL, 'request.v3.json');
const result = {schemaVersion: 'candidate-knowledge-v3-independent-check/v1', startedAt: new Date().toISOString(),
  decision: 'pending', formalEnabled: false, productionEligible: false, cryptographicProductionAuthorization: false};
const database = path.join(KB, '.opc-rag/opc_rag.sqlite3');
function databaseIdentity() {
  const s = fs.lstatSync(database, {bigint: true});
  assert(s.isFile() && !s.isSymbolicLink());
  const sidecars = ['-wal', '-shm', '-journal'].map(suffix => {
    try { fs.lstatSync(database + suffix); return {suffix, present: true}; }
    catch (error) { if (error.code !== 'ENOENT') throw error; return {suffix, present: false}; }
  });
  assert(sidecars.every(x => !x.present), 'SQLite sidecar present');
  return {path: database, dev: String(s.dev), inode: String(s.ino), size: String(s.size),
    mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs), sha256: hashFile(database), sidecars};
}
try {
  const request = readJson(requestPath);
  result.requestPath = requestPath;
  result.requestSha256BeforeReviewBinding = hashFile(requestPath);
  const prior = readJson(path.join(ROOT, CONTROL, 'request.v2.json'));
  const omit = value => Object.fromEntries(Object.entries(value).filter(([key]) => !['knowledgeContext', 'independentReview'].includes(key)));
  assert.equal(digest(omit(request)), digest(omit(prior)), 'v3 scope changed beyond context/review');
  result.requestDelta = ['knowledgeContext', 'independentReview'];
  assert.deepEqual(request.knowledgeContext, readJson(path.join(root, 'context-binding.v2.json')));
  const intent = readJson(path.join(ROOT, CONTROL, 'review-request-intent.v3.json'));
  const snapshot = readJson(path.join(ROOT, CONTROL, 'runtime-snapshot.v3.json'));
  const priorSnapshot = readJson(path.join(ROOT, CONTROL, 'runtime-snapshot.v2.json'));
  assert.equal(digest(snapshot.files), snapshot.sha256);
  assert.deepEqual(snapshot.files, priorSnapshot.files, 'runtime differs from reviewed v2');
  const runtime = collectRuntime();
  assert.equal(runtime.sha256, 'ed21cafce06b36a5f77ef8b24f8e692216ccf81346b3874c2a0489962f35ed6d');
  assert.equal(runtime.sha256, request.runtimeSha256);
  assert.deepEqual(runtime.files, snapshot.files);
  assert.equal(requestIntentSha256(request), intent.requestIntentSha256);
  assert.equal(runtime.sha256, intent.runtimeSha256);
  result.runtimeSha256 = runtime.sha256;
  result.runtimeFileCount = runtime.files.length;
  result.runtimeDeltaFromReviewedV2 = [];
  result.requestIntentSha256 = requestIntentSha256(request);
  result.codeHashes = RUNTIME_FILES.map(p => ({path: p, sha256: hashFile(path.join(ROOT, p))}));
  result.inputChecks = [...request.bindings, request.permission].map(b => {
    assert.equal(hashFile(path.join(ROOT, b.path)), b.sha256, b.path);
    return {...b, current: true};
  });
  const permission = readJson(path.join(ROOT, request.permission.path));
  for (const command of ['preflight', 'stills', 'render']) validatePermission(permission, request, command);
  result.permissionChecks = ['preflight', 'stills', 'render'];
  result.imports = collectLocalImports(ROOT, ENTRY, new Map(request.bindings.map(b => [b.path, b.sha256])), loadTypescript());
  const context = readJson(request.knowledgeContext.contextPath);
  assert.equal(hashFile(request.knowledgeContext.contextPath), request.knowledgeContext.sha256);
  result.materialChecks = result.imports.filter(p => p === ENTRY || p.endsWith('.json')).map(p => {
    const entry = context.receipt_groups.task_original_materials.entries.find(e => e.resolved_path === path.join(ROOT, p));
    assert(entry && entry.application_note.trim(), p);
    assert.equal(entry.sha256, hashFile(path.join(ROOT, p)), p);
    for (const state of ['retrieved', 'read', 'applied']) assert.equal(entry.states[state], true, p);
    return {path: p, sha256: entry.sha256, states: entry.states, application_note: entry.application_note};
  });
  result.databaseBefore = databaseIdentity();
  assert.equal(result.databaseBefore.sha256, context.index_freshness.generation.database_sha256);
  result.knowledge = validateKnowledge({request}, runtime);
  result.databaseAfter = databaseIdentity();
  assert.deepEqual(result.databaseAfter, result.databaseBefore, 'database changed');
  assert.equal(result.knowledge.status, 'context-valid');
  assert.deepEqual(result.knowledge.problems, []);
  assert.equal(result.knowledge.gate.formal_execution_allowed, true);
  assert.equal(hashFile(requestPath), result.requestSha256BeforeReviewBinding, 'request changed');
  assert.equal(hashFile(request.knowledgeContext.contextPath), request.knowledgeContext.sha256, 'context changed');
  for (const b of [...result.inputChecks, ...result.codeHashes]) assert.equal(hashFile(path.join(ROOT, b.path)), b.sha256, b.path);
  result.decision = 'knowledge-valid-and-reviewed-inputs-unchanged';
  result.databaseUnchanged = true;
  result.requestUntouched = true;
  result.noRenderExecuted = true;
} catch (error) {
  result.decision = 'blocked';
  result.error = {message: error.message, stack: error.stack};
  process.exitCode = 1;
}
result.endedAt = new Date().toISOString();
const output = path.join(root, 'knowledge-v3-independent-check.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, decision: result.decision, runtimeSha256: result.runtimeSha256,
  runtimeFileCount: result.runtimeFileCount, requestIntentSha256: result.requestIntentSha256,
  inputCount: result.inputChecks?.length, importCount: result.imports?.length,
  knowledgeStatus: result.knowledge?.status, databaseUnchanged: result.databaseUnchanged, error: result.error?.message}, null, 2));
