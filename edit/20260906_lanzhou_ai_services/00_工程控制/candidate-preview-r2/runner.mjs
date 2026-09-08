import fs from 'node:fs';
import path from 'node:path';
import {spawnSync, spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOT, KB, CONTROL, ENTRY, PUBLIC, OUTPUT, PORT, BINARIES, BROWSER,
  checked, hashFile, ensure, digest, collectRuntime, validateRequest, assertSnapshot, readJson,
  loadTypescript, cleanEnvironment, sandboxProfile, outputNames, absent} from './runner-core.mjs';

const flags = {formalEnabled: false, productionEligible: false, cryptographicProductionAuthorization: false,
  userPreviewApproved: false, publishAuthorized: false};
const json = value => JSON.stringify(value, null, 2) + '\n';
const writeNew = (file, value) => fs.writeFileSync(file, json(value), {flag: 'wx', mode: 0o600});

export function parseCli(args) {
  ensure(['runtime', 'preflight', 'stills', 'render'].includes(args[0]), 'COMMAND_FORBIDDEN');
  if (args[0] === 'runtime') { ensure(args.length === 1, 'UNKNOWN_ARGUMENT'); return {command: 'runtime'}; }
  ensure(args.length === 3 && args[1] === '--request' && typeof args[2] === 'string', 'USAGE_REQUEST_REQUIRED');
  return {command: args[0], requestPath: args[2]};
}

function runLocal(executable, args, options = {}) {
  const r = spawnSync(executable, args, {cwd: ROOT, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    env: cleanEnvironment(path.join(ROOT, CONTROL, 'runtime', 'read-only-home')), ...options});
  ensure(!r.error && r.status === 0, 'LOCAL_CHECK_FAILED', r.error?.message || r.stderr?.slice(-3000) || r.stdout?.slice(-3000));
  return r.stdout;
}

// This validator is read-only. Its knowledge gate does not confer production authority.
export function validateKnowledge(snapshot, runtime) {
  const context = snapshot.request.knowledgeContext;
  const q = s => JSON.stringify(s);
  const profile = `(version 1)(allow default)(deny network*)(deny file-write*)` +
    `(deny file-read-data (regex #"(^|/)\\.env($|\\.)") (subpath ${q(path.join(KB, '../..', '.ssh'))}))`;
  const stdout = runLocal('/usr/bin/sandbox-exec', ['-p', profile, runtime.python, '-I', '-B',
    path.join(ROOT, CONTROL, 'runtime/knowledge-readonly.py'), '--context', context.contextPath, '--context-sha256', context.sha256]);
  const receipt = JSON.parse(stdout);
  ensure(receipt.schema_version === 'opc-task-context-validation/1.0' && receipt.status === 'context-valid'
    && receipt.task?.id === context.taskId && receipt.task?.important === true && receipt.context_path === context.contextPath
    && receipt.project_route?.project_root === ROOT && receipt.gate?.formal_execution_allowed === true
    && Array.isArray(receipt.problems) && receipt.problems.length === 0, 'KNOWLEDGE_VALIDATOR_BLOCKED');
  return receipt;
}

function spawnWorker(executable, args, env, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {cwd, env, stdio: ['ignore', 'inherit', 'inherit']});
    const stop = () => child.kill('SIGTERM');
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child.once('error', reject);
    child.once('close', (code, signal) => {
      process.off('SIGINT', stop); process.off('SIGTERM', stop);
      if (code === 0) resolve(); else reject(new Error(`WORKER_FAILED:${code ?? signal}`));
    });
  });
}

function stageInputs(snapshot, scratch) {
  const stageRoot = path.join(scratch, 'project');
  const bindings = new Map(snapshot.bound.map(b => [b.path, b.sha256]));
  for (const name of [...snapshot.imports, ...snapshot.publicFiles, 'remotion/package.json', 'remotion/tsconfig.json']) {
    const source = checked(ROOT, name);
    const target = path.join(stageRoot, name);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL | fs.constants.COPYFILE_FICLONE);
    ensure(hashFile(target) === (bindings.get(name) || hashFile(source)), 'STAGED_INPUT_DRIFT', name);
  }
  return stageRoot;
}

export function validateMediaProbe(probe) {
  const video = probe.streams?.filter(s => s.codec_type === 'video');
  const audio = probe.streams?.filter(s => s.codec_type === 'audio');
  ensure(video?.length === 1 && video[0].width === 960 && video[0].height === 540 && video[0].codec_name === 'h264'
    && video[0].r_frame_rate === '30/1' && Number(video[0].nb_read_frames) === 8393, 'ACTUAL_OUTPUT_SCOPE_MISMATCH');
  ensure(audio?.length === 1 && audio[0].codec_name === 'aac' && Number(audio[0].duration) > 279, 'ACTUAL_AUDIO_TRACK_MISSING');
  return {width: 960, height: 540, fps: 30, frames: 8393, audioTrack: true, audibleContentVerified: false};
}

export function validatePng(buffer) {
  ensure(buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && buffer.toString('ascii', 12, 16) === 'IHDR' && buffer.readUInt32BE(16) === 960 && buffer.readUInt32BE(20) === 540, 'ACTUAL_STILL_SCOPE_MISMATCH');
}

export const postRenderProbeOptions = scratch => ({cwd: path.join(ROOT, BINARIES), env: cleanEnvironment(scratch), timeout: 600000});

async function execute(snapshot, runtime, knowledge) {
  const {command, request} = snapshot;
  ensure(process.platform === 'darwin' && process.arch === 'arm64', 'LOCAL_SANDBOX_REQUIRED');
  const outputRoot = checked(ROOT, OUTPUT, true);
  fs.mkdirSync(outputRoot, {recursive: true});
  const lock = checked(ROOT, `${OUTPUT}/active.lock`, true);
  const identity = {pid: process.pid, command, requestIntentSha256: snapshot.requestIntentSha256, startedAt: new Date().toISOString()};
  writeNew(lock, identity);
  let outputDir;
  let ownsOutput = false;
  try {
    absent(ROOT, `${OUTPUT}/${command}`);
    outputDir = checked(ROOT, `${OUTPUT}/${command}`, true);
    fs.mkdirSync(outputDir, {recursive: false});
    ownsOutput = true;
    const runs = checked(ROOT, `${CONTROL}/runtime/runs`, true);
    fs.mkdirSync(runs, {recursive: true});
    const scratch = fs.mkdtempSync(path.join(runs, `${command}-`));
    for (const n of ['home', 'tmp']) fs.mkdirSync(path.join(scratch, n));
    const secretProbe = path.join(runs, `probe-${path.basename(scratch)}.txt`);
    fs.writeFileSync(secretProbe, 'non-secret sandbox fixture', {flag: 'wx', mode: 0o600});
    const readFiles = [runtime.node, runtime.python, path.join(ROOT, 'remotion/package.json'), lock];
    const profile = sandboxProfile({scratch, outputDir, readFiles});
    const probe = JSON.parse(runLocal('/usr/bin/sandbox-exec', ['-p', profile, runtime.node,
      path.join(ROOT, CONTROL, 'runtime/network-probe.mjs'), secretProbe], {env: cleanEnvironment(scratch)}));
    ensure(Object.values(probe).length === 4 && Object.values(probe).every(v => v === true), 'SANDBOX_PROBE_FAILED');
    const stageRoot = stageInputs(snapshot, scratch);
    const outputs = outputNames(request, command).map((n, i) => ({path: path.join(ROOT, n), ...(command === 'stills' ? {frame: request.stillFrames[i]} : {})}));
    const job = {command, root: ROOT, port: PORT, stageRoot, scratch, entry: path.join(stageRoot, ENTRY),
      publicDir: path.join(stageRoot, PUBLIC), browser: path.join(ROOT, BROWSER), binaries: path.join(ROOT, BINARIES), outputs};
    const descriptor = path.join(scratch, 'job.json');
    writeNew(descriptor, job);
    assertSnapshot(ROOT, snapshot);
    ensure(collectRuntime().sha256 === runtime.sha256, 'RUNTIME_DRIFT');
    validateKnowledge(snapshot, runtime);
    writeNew(path.join(outputDir, 'started.json'), {...identity, ...flags, permission: request.permission,
      independentReview: request.independentReview, runtimeSha256: runtime.sha256, knowledge, sandbox: probe,
      acceptedPaperExceptions: snapshot.permission.acceptedPaperExceptions, postshootRepresentation: snapshot.permission.postshootRepresentation,
      unresolvedAsrMustRemainVisibleInReceipt: true, boundInputs: snapshot.bound});
    await spawnWorker('/usr/bin/sandbox-exec', ['-p', profile, runtime.node, path.join(ROOT, CONTROL, 'runtime/worker.mjs'), descriptor], cleanEnvironment(scratch), path.join(stageRoot, 'remotion'));
    const qa = [];
    for (const o of outputs) {
      const n = path.relative(ROOT, o.path);
      checked(ROOT, n);
      if (command === 'stills') { validatePng(fs.readFileSync(o.path)); qa.push({path: n, frame: o.frame, sha256: hashFile(o.path), width: 960, height: 540}); }
      else {
        const raw = runLocal('/usr/bin/sandbox-exec', ['-p', profile, path.join(ROOT, BINARIES, 'ffprobe'), '-v', 'error', '-count_frames',
          '-show_streams', '-show_format', '-of', 'json', o.path], postRenderProbeOptions(scratch));
        qa.push({path: n, sha256: hashFile(o.path), ...validateMediaProbe(JSON.parse(raw))});
      }
    }
    assertSnapshot(ROOT, snapshot);
    ensure(collectRuntime().sha256 === runtime.sha256, 'RUNTIME_DRIFT_AFTER_EXECUTION');
    const afterKnowledge = validateKnowledge(snapshot, runtime);
    const result = {...identity, ...flags, status: 'candidate-generated-pending-human-review', outputs: qa,
      knowledge: afterKnowledge, runtimeSha256: runtime.sha256, requestIntentSha256: snapshot.requestIntentSha256,
      independentReview: request.independentReview, inputDriftCheck: 'unchanged', visualReviewPassed: false,
      audibleContentVerified: false, currentSharedPostshootValidatorPassed: false};
    writeNew(path.join(outputDir, 'receipt.json'), result);
    return result;
  } catch (e) {
    if (ownsOutput && fs.existsSync(outputDir)) writeNew(path.join(outputDir, 'failed.json'), {...identity, ...flags,
      status: 'blocked', error: e.message, outputDisposition: 'partial-or-unverified-do-not-reuse'});
    throw e;
  } finally {
    if (fs.existsSync(lock) && digest(readJson(lock)) === digest(identity)) fs.unlinkSync(lock);
  }
}

export async function main(args) {
  const cli = parseCli(args);
  const runtime = collectRuntime();
  if (cli.command === 'runtime') return {schemaVersion: 'koubo-lanzhou-candidate-runtime/v1', sha256: runtime.sha256,
    fileCount: runtime.files.length, browserPresent: true, automaticInstallationAllowed: false, ...flags};
  const snapshot = validateRequest({...cli, runtime, ts: loadTypescript()});
  assertSnapshot(ROOT, snapshot);
  const knowledge = validateKnowledge(snapshot, runtime);
  assertSnapshot(ROOT, snapshot);
  if (cli.command === 'preflight') return {status: 'preflight-valid-no-render', ...flags, knowledge,
    runtimeSha256: runtime.sha256, requestIntentSha256: snapshot.requestIntentSha256,
    imports: snapshot.imports, publicFileCount: snapshot.publicFiles.length, sandboxExecutionProbe: 'pending-action',
    outputAvailability: Object.fromEntries(['stills', 'render'].map(c => [c, !fs.existsSync(checked(ROOT, `${OUTPUT}/${c}`, true))]))};
  return execute(snapshot, runtime, knowledge);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(value => process.stdout.write(json(value))).catch(error => {
    process.stderr.write(json({status: 'blocked', error: error.message, ...flags})); process.exitCode = 1;
  });
}
