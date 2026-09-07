import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOT, CONTROL, OUTPUT, collectRuntime, digest, hashFile, readJson,
  requestIntentSha256, sandboxProfile, cleanEnvironment} from '../runner-core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const result = {schemaVersion: 'candidate-cwd-v4-independent-check/v1', startedAt: new Date().toISOString(),
  decision: 'pending', formalEnabled: false, inputReviewRepeated: false, renderExecuted: false};
try {
  const requestPath = path.join(ROOT, CONTROL, 'request.v4.json');
  const request = readJson(requestPath);
  const prior = readJson(path.join(ROOT, CONTROL, 'request.v3.json'));
  const intent = readJson(path.join(ROOT, CONTROL, 'review-request-intent.v4.json'));
  const priorRuntime = readJson(path.join(ROOT, CONTROL, 'runtime-snapshot.v3.json'));
  const declaredRuntime = readJson(path.join(ROOT, CONTROL, 'runtime-snapshot.v4.json'));
  const omit = r => Object.fromEntries(Object.entries(r).filter(([k]) => !['runtimeSha256', 'independentReview'].includes(k)));
  assert.equal(digest(omit(request)), digest(omit(prior)), 'v4 changed scope or inputs');
  result.requestSha256BeforeReviewBinding = hashFile(requestPath);
  assert.equal(hashFile(request.knowledgeContext.contextPath), request.knowledgeContext.sha256);
  const previousMachinePath = path.join(root, 'knowledge-v3-independent-check.json');
  assert.equal(hashFile(previousMachinePath), '0e3820951a0f010e83caefc1a6c52839a4180c117025ea393d435c66698c5ce2');
  result.inheritedEvidence = {path: previousMachinePath, sha256: hashFile(previousMachinePath),
    scope: 'v3实际42输入与permission、9静态导入、validateKnowledge证据；本轮不重读原输入，不声称重跑知识门。'};
  const runtime = collectRuntime();
  assert.equal(runtime.sha256, 'e1b32bb53dacfe318aa0d5637a09f35a9e4ee3fd5d5ee6d051f19eaf14a546ce');
  assert.equal(runtime.sha256, declaredRuntime.sha256);
  assert.deepEqual(runtime.files, declaredRuntime.files);
  assert.equal(runtime.sha256, request.runtimeSha256);
  assert.equal(requestIntentSha256(request), intent.requestIntentSha256);
  const oldFiles = new Map(priorRuntime.files.map(f => [f.path, f]));
  const newFiles = new Map(runtime.files.map(f => [f.path, f]));
  const delta = [...new Set([...oldFiles.keys(), ...newFiles.keys()])].filter(p => digest(oldFiles.get(p) ?? null) !== digest(newFiles.get(p) ?? null));
  const runnerPath = `${CONTROL}/runner.mjs`;
  assert.deepEqual(delta, [runnerPath]);
  const source = fs.readFileSync(path.join(ROOT, runnerPath), 'utf8');
  const replacements = [
    ['function spawnWorker(executable, args, env, cwd) {', 'function spawnWorker(executable, args, env) {'],
    ["const child = spawn(executable, args, {cwd, env, stdio:", "const child = spawn(executable, args, {cwd: ROOT, env, stdio:"],
    ["descriptor], cleanEnvironment(scratch), path.join(stageRoot, 'remotion'));", 'descriptor], cleanEnvironment(scratch));'],
  ];
  let reconstructed = source;
  for (const [after, before] of replacements) {
    assert.equal(reconstructed.split(after).length, 2, 'expected one reviewed replacement');
    reconstructed = reconstructed.replace(after, before);
  }
  assert.equal(digest(reconstructed), oldFiles.get(runnerPath).sha256, 'unreviewed runner change');
  result.runtimeSha256 = runtime.sha256;
  result.requestIntentSha256 = requestIntentSha256(request);
  result.runtimeDelta = delta;
  result.exactThreeLineDiffVerified = true;
  result.contextBindingUnchanged = request.knowledgeContext;
  const descriptor = path.join(ROOT, CONTROL, 'runtime/runs/stills-70HhJ7/job.json');
  const job = readJson(descriptor);
  assert.equal(job.root, ROOT);
  assert.equal(job.stageRoot, path.join(job.scratch, 'project'));
  const cwd = path.join(job.stageRoot, 'remotion');
  assert(fs.statSync(cwd).isDirectory());
  const outputDir = path.join(ROOT, OUTPUT, 'stills');
  const profile = sandboxProfile({scratch: job.scratch, outputDir,
    readFiles: [runtime.node, runtime.python, path.join(ROOT, 'remotion/package.json'), path.join(ROOT, OUTPUT, 'active.lock')]});
  const code = `const fs=require('node:fs');const {createRequire}=require('node:module');const root=${JSON.stringify(ROOT)};const cwd=process.cwd();const bundler=createRequire(root+'/remotion/package.json')('@remotion/bundler');let repositoryReadDenied=false;try{fs.readdirSync(root)}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e;repositoryReadDenied=true}if(cwd!==${JSON.stringify(cwd)}||typeof bundler.bundle!=='function'||!repositoryReadDenied)throw new Error('CWD_SMOKE_FAILED');console.log(JSON.stringify({cwd,bundlerLoaded:true,repositoryReadDenied}));`;
  const args = ['-p', profile, runtime.node, '-e', code];
  const probe = spawnSync('/usr/bin/sandbox-exec', args, {cwd, env: cleanEnvironment(job.scratch), encoding: 'utf8', timeout: 60000});
  result.nativeSmoke = {command: ['/usr/bin/sandbox-exec', ...args], cwd, descriptor,
    descriptorSha256: hashFile(descriptor), profileSha256: digest(profile), exitCode: probe.status,
    signal: probe.signal, stdout: probe.stdout, stderr: probe.stderr, error: probe.error?.message ?? null};
  assert.equal(probe.status, 0, probe.stderr || probe.error?.message);
  result.nativeSmoke.parsed = JSON.parse(probe.stdout);
  assert.equal(result.nativeSmoke.parsed.bundlerLoaded, true);
  assert.equal(result.nativeSmoke.parsed.repositoryReadDenied, true);
  assert.equal(hashFile(requestPath), result.requestSha256BeforeReviewBinding);
  for (const p of delta) assert.equal(hashFile(path.join(ROOT, p)), newFiles.get(p).sha256);
  result.decision = 'cwd-fix-and-native-smoke-passed';
} catch (error) {
  result.decision = 'blocked';
  result.error = {message: error.message, stack: error.stack};
  process.exitCode = 1;
}
result.endedAt = new Date().toISOString();
const output = path.join(root, 'cwd-v4-independent-check.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, sha256: hashFile(output), decision: result.decision,
  runtimeSha256: result.runtimeSha256, requestIntentSha256: result.requestIntentSha256,
  nativeSmoke: result.nativeSmoke?.parsed, exitCode: result.nativeSmoke?.exitCode, error: result.error?.message}, null, 2));
