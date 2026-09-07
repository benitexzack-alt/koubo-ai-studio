import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ROOT, CONTROL, OUTPUT, collectRuntime, hashFile, readJson, requestIntentSha256} from '../runner-core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const renderRoot = path.join(ROOT, OUTPUT, 'render');
const result = {schemaVersion: 'candidate-recovery-binding-check/v1', startedAt: new Date().toISOString(),
  status: 'pending', renderExecutedByThisCheck: false, formalEnabled: false};
try {
  const startedPath = path.join(renderRoot, 'started.json');
  const failedPath = path.join(renderRoot, 'failed.json');
  const videoPath = path.join(renderRoot, 'with-sfx-960x540.mp4');
  const started = readJson(startedPath);
  const failed = readJson(failedPath);
  const requestPath = path.join(ROOT, CONTROL, 'request.v5.json');
  const request = readJson(requestPath);
  assert.equal(started.command, 'render');
  assert.equal(started.requestIntentSha256, requestIntentSha256(request));
  assert.equal(failed.requestIntentSha256, started.requestIntentSha256);
  assert.equal(failed.startedAt, started.startedAt);
  assert.equal(failed.pid, started.pid);
  assert(failed.error.startsWith('LOCAL_CHECK_FAILED:dyld[') && failed.error.includes('Library not loaded: libavdevice.dylib')
    && failed.error.includes('@remotion/compositor-darwin-arm64/ffprobe'));
  assert.equal(started.knowledge.status, 'context-valid');
  assert.deepEqual(started.knowledge.problems, []);
  assert(Object.values(started.sandbox).every(v => v === true));
  for (const k of ['formalEnabled', 'productionEligible', 'cryptographicProductionAuthorization', 'userPreviewApproved', 'publishAuthorized']) {
    assert.equal(started[k], false); assert.equal(failed[k], false);
  }
  const runtime = collectRuntime();
  assert.equal(runtime.sha256, started.runtimeSha256);
  assert.equal(runtime.sha256, request.runtimeSha256);
  assert.equal(hashFile(request.knowledgeContext.contextPath), request.knowledgeContext.sha256);
  result.boundInputs = started.boundInputs.map(b => {
    assert.equal(hashFile(path.join(ROOT, b.path)), b.sha256, `input drift: ${b.path}`);
    return {...b, current: true};
  });
  assert.deepEqual(started.permission, request.permission);
  assert.deepEqual(started.independentReview, request.independentReview);
  const permission = readJson(path.join(ROOT, request.permission.path));
  for (const k of ['formalEnabled', 'productionEligible', 'userPreviewApproved', 'publishAuthorized']) assert.equal(permission[k], false);
  result.request = {path: requestPath, sha256: hashFile(requestPath), intentSha256: requestIntentSha256(request)};
  result.runtimeSha256 = runtime.sha256;
  result.context = request.knowledgeContext;
  result.permission = request.permission;
  result.renderStarted = {path: startedPath, sha256: hashFile(startedPath), startedAt: started.startedAt, pid: started.pid};
  result.originalFailure = {path: failedPath, sha256: hashFile(failedPath), status: failed.status, error: failed.error, preserved: true};
  const stat = fs.statSync(videoPath, {bigint: true});
  result.video = {path: videoPath, sha256: hashFile(videoPath), bytes: String(stat.size), mtimeNs: String(stat.mtimeNs), inode: String(stat.ino)};
  result.status = 'bindings-unchanged-awaiting-decode-evidence';
  result.currentKnowledgeValidatorRerun = false;
  result.existingRenderOnly = true;
} catch (error) {
  result.status = 'blocked'; result.error = {message: error.message, stack: error.stack}; process.exitCode = 1;
}
result.endedAt = new Date().toISOString();
const output = path.join(root, 'recovery-binding-check.v1.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, sha256: hashFile(output), status: result.status, boundInputCount: result.boundInputs?.length,
  runtimeSha256: result.runtimeSha256, video: result.video, error: result.error?.message}, null, 2));
