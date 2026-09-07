import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ROOT, CONTROL, collectRuntime, digest, hashFile, readJson, requestIntentSha256} from '../runner-core.mjs';
import {validateKnowledge} from '../runner.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const result = {schemaVersion: 'candidate-context-delta-review/v1', startedAt: new Date().toISOString(),
  decision: 'pending', staticReviewRepeated: false, formalEnabled: false, renderExecuted: false};
try {
  const requestPath = path.join(ROOT, CONTROL, 'request.v5.json');
  const request = readJson(requestPath);
  const previous = readJson(path.join(ROOT, CONTROL, 'request.v4.json'));
  const intent = readJson(path.join(ROOT, CONTROL, 'review-request-intent.v5.json'));
  const omit = r => Object.fromEntries(Object.entries(r).filter(([k]) => !['knowledgeContext', 'independentReview'].includes(k)));
  assert.equal(digest(omit(request)), digest(omit(previous)), 'non-context request delta');
  assert.deepEqual(request.knowledgeContext, readJson(path.join(root, 'context-binding.v3.json')));
  assert.equal(hashFile(request.knowledgeContext.contextPath), request.knowledgeContext.sha256);
  const priorReviewPath = path.join(ROOT, CONTROL, 'independent-review.v4.json');
  assert.equal(hashFile(priorReviewPath), '1b16c72319d51a496d1e73380ce8050116021df17cf12f7ffdd66739b6b8c204');
  const runtime = collectRuntime();
  const declared = readJson(path.join(ROOT, CONTROL, 'runtime-snapshot.v5.json'));
  const previousRuntime = readJson(path.join(ROOT, CONTROL, 'runtime-snapshot.v4.json'));
  assert.equal(runtime.sha256, 'e1b32bb53dacfe318aa0d5637a09f35a9e4ee3fd5d5ee6d051f19eaf14a546ce');
  assert.equal(runtime.sha256, request.runtimeSha256);
  assert.equal(runtime.sha256, declared.sha256);
  assert.deepEqual(runtime.files, declared.files);
  assert.deepEqual(declared.files, previousRuntime.files);
  assert.equal(requestIntentSha256(request), intent.requestIntentSha256);
  assert.equal(runtime.sha256, intent.runtimeSha256);
  result.requestSha256BeforeReviewBinding = hashFile(requestPath);
  result.requestIntentSha256 = requestIntentSha256(request);
  result.runtimeSha256 = runtime.sha256;
  result.runtimeFileCount = runtime.files.length;
  result.contextBinding = request.knowledgeContext;
  result.priorIndependentReview = {path: priorReviewPath, sha256: hashFile(priorReviewPath)};
  result.onlyContextAndReviewBindingChanged = true;
  result.knowledge = validateKnowledge({request}, runtime);
  assert.equal(result.knowledge.status, 'context-valid');
  assert.deepEqual(result.knowledge.problems, []);
  assert.equal(hashFile(requestPath), result.requestSha256BeforeReviewBinding);
  assert.equal(hashFile(request.knowledgeContext.contextPath), request.knowledgeContext.sha256);
  result.decision = 'context-delta-and-live-knowledge-passed';
} catch (error) {
  result.decision = 'blocked'; result.error = {message: error.message, stack: error.stack}; process.exitCode = 1;
}
result.endedAt = new Date().toISOString();
const output = path.join(root, 'context-delta-v5-independent-check.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, sha256: hashFile(output), decision: result.decision,
  requestIntentSha256: result.requestIntentSha256, runtimeSha256: result.runtimeSha256,
  knowledgeStatus: result.knowledge?.status, checkedAt: result.endedAt,
  expiresAt: new Date(Date.now() + 43200000).toISOString(), error: result.error?.message}, null, 2));
