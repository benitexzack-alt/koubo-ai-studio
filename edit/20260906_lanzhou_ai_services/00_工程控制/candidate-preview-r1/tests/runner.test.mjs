import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT, KB, CONTROL, EPISODE, REVISION, ENTRY, PUBLIC, PERMISSION, OUTPUT, RENDER, COMPOSITION,
  CAPTION_COMPONENT, CAPTION_SHA, SHOTCRAFT_SOURCE, SHOTCRAFT_COPY, hashFile, digest, readJson, relativePath, checked, absent, requestIntentSha256,
  validateRequest, assertSnapshot, collectLocalImports, cleanEnvironment, sandboxProfile, loadTypescript} from '../runner-core.mjs';
import {parseCli, validateMediaProbe, validatePng} from '../runner.mjs';

const ts = loadTypescript();
const base = path.join(ROOT, CONTROL, 'runtime/tests');
fs.mkdirSync(base, {recursive: true});
const top = fs.mkdtempSync(path.join(base, 'suite-'));
const put = (file, data) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data)); };
const fixedNow = Date.parse('2026-09-07T12:00:00Z');
let serial = 0;
test.after(() => fs.rmSync(top, {recursive: true, force: true}));

function fixture() {
  const root = path.join(top, `case-${serial++}`);
  const kb = path.join(root, 'kb');
  const requestPath = `${CONTROL}/request.v1.json`;
  const permission = structuredClone(readJson(path.join(ROOT, PERMISSION)));
  const dataPath = `edit/${EPISODE}/04_导演拆解/candidate-preview-r1/data.v1.json`;
  const entryText = `import data from '../../../${dataPath}'; export const duration = data.frames;`;
  put(path.join(root, ENTRY), entryText);
  put(path.join(root, dataPath), {frames: 8393});
  put(path.join(root, PUBLIC, 'fonts/STHeiti-Medium.ttc'), 'font-fixture');
  for (const scene of permission.acceptedPaperExceptions) {
    const file = path.join(root, PUBLIC, `${scene.sceneId}.mp4`);
    put(file, `non-media-test-fixture-${scene.sceneId}`);
    scene.sha256 = hashFile(file);
  }
  const contextPath = path.join(kb, '.opc-rag/tasks/test-context/context.json');
  const context = {status: 'context-ready', task: {id: 'test-context', important: true}, gate: {formal_execution_allowed: true},
    project_route: {project_root: root}, receipt_groups: {task_original_materials: {status: 'complete', entries: [ENTRY, dataPath].map(n => ({
      resolved_path: path.join(root, n), sha256: hashFile(path.join(root, n)), states: {retrieved: true, read: true, applied: true}, application_note: 'unit test applied evidence only'}))}}};
  put(contextPath, context);
  const paths = [ENTRY, dataPath, `${PUBLIC}/fonts/STHeiti-Medium.ttc`, ...permission.acceptedPaperExceptions.map(s => `${PUBLIC}/${s.sceneId}.mp4`)];
  const request = {schemaVersion: 'koubo-lanzhou-candidate-preview/v1', episodeId: EPISODE, revisionId: REVISION,
    permission: {path: PERMISSION, sha256: ''}, entry: ENTRY, compositionId: COMPOSITION, publicDir: PUBLIC, render: {...RENDER},
    stillFrames: [0, 68, 69, 312, 313, 8392], knowledgeContext: {taskId: 'test-context', contextPath, sha256: hashFile(contextPath)},
    runtimeSha256: digest('fixture runtime'), bindings: paths.map(n => ({path: n, sha256: hashFile(path.join(root, n))})),
    independentReview: {path: `${CONTROL}/review.json`, sha256: ''}};
  const evidencePath = `${CONTROL}/review-evidence.txt`;
  put(path.join(root, evidencePath), 'unit test fixture, not production authorization');
  const review = {schemaVersion: 'koubo-lanzhou-candidate-code-review/v1', episodeId: EPISODE, revisionId: REVISION,
    decision: 'allow-candidate-preview', cryptographicProductionAuthorization: false, reviewerId: 'fixture-reviewer', implementerId: 'fixture-implementer',
    requestIntentSha256: '', runtimeSha256: request.runtimeSha256, reviewedAt: '2026-09-07T11:00:00Z', expiresAt: '2026-09-07T13:00:00Z',
    evidence: {path: evidencePath, sha256: hashFile(path.join(root, evidencePath))}, quote: 'unit test fixture'};
  const seal = () => {
    put(path.join(root, PERMISSION), permission); request.permission.sha256 = hashFile(path.join(root, PERMISSION));
    review.requestIntentSha256 = requestIntentSha256(request);
    put(path.join(root, request.independentReview.path), review); request.independentReview.sha256 = hashFile(path.join(root, request.independentReview.path));
    put(path.join(root, requestPath), request);
  };
  seal();
  return {root, kb, request, permission, review, context, contextPath, dataPath, requestPath, seal,
    validate: (command = 'preflight') => validateRequest({root, kb, requestPath, command, ts, runtime: {sha256: digest('fixture runtime')}, now: fixedNow})};
}

test('repo root and CLI are fixed; no arbitrary flags or production command', () => {
  assert.equal(ROOT, path.resolve(CONTROL, '../../../..'));
  assert.equal(path.basename(KB), '个人知识库');
  assert.deepEqual(parseCli(['runtime']), {command: 'runtime'});
  assert.equal(parseCli(['render', '--request', 'x.json']).command, 'render');
  for (const args of [['formal'], ['runtime', '--grant', 'old'], ['render', '--request', 'x', '--scale', '1'], ['render'], ['stills', '--output', '/tmp/x']]) assert.throws(() => parseCli(args));
});

test('first preview has no accepted candidate dependency and never implies formal eligibility', () => {
  const f = fixture(); const result = f.validate();
  assert.equal(result.productionEligible, false); assert.equal(result.formalEnabled, false);
  assert.equal(result.userPreviewApproved, false);
  assertSnapshot(f.root, result, f.kb);
  assert.equal(fs.existsSync(path.join(f.root, OUTPUT)), false);
});

for (const [name, mutation, code] of [
  ['other episode', f => f.request.episodeId = '20260904_cybercab', /EPISODE_REVISION/],
  ['other revision', f => f.request.revisionId = 'r0', /EPISODE_REVISION/],
  ['formal true', f => f.permission.formalEnabled = true, /FORMAL_AUTHORIZATION/],
  ['preview already approved', f => f.permission.userPreviewApproved = true, /FORMAL_AUTHORIZATION/],
  ['old grant schema', f => f.permission.schemaVersion = 'shotcraft-local-preview-grant/v1', /OLD_GRANT/],
  ['old director id', f => f.permission.directorTaskId = 'new-bootstrap', /DIRECTOR_ID/],
  ['payments', f => f.permission.scope.allowPayments = true, /PERMISSION_SCOPE/],
  ['external network', f => f.permission.scope.allowExternalNetwork = true, /PERMISSION_SCOPE/],
  ['new generation', f => f.permission.scope.allowNewGeneration = true, /PERMISSION_SCOPE/],
  ['fake shared validation', f => f.permission.postshootRepresentation.currentSharedPostshootValidatorPassed = true, /EXCEPTION_SCOPE/],
  ['fake B23 keep', f => f.permission.postshootRepresentation.preshootB23 = 'keep', /EXCEPTION_SCOPE/],
  ['fake first reveal', f => f.permission.postshootRepresentation.labelActionIsFirstReveal = true, /EXCEPTION_SCOPE/],
  ['missing five clips', f => f.permission.acceptedPaperExceptions.pop(), /FIVE_ASSET/],
  ['unknown paper bytes', f => f.permission.acceptedPaperExceptions[0].sha256 = digest('other clip'), /ACCEPTED_PAPER/],
  ['high resolution', f => f.request.render.scale = 1, /LOW_RES/],
  ['duration drift', f => f.request.render.durationInFrames = 8394, /LOW_RES/],
  ['wrong entry', f => f.request.entry = 'remotion/src/index.ts', /FIXED_ENTRY/],
  ['wrong public dir', f => f.request.publicDir = 'remotion/public', /FIXED_ENTRY/],
  ['unknown grant field', f => f.request.grant = 'old', /UNKNOWN_REQUEST/],
  ['negative frame', f => f.request.stillFrames = [-1], /STILL_RANGE/],
  ['out of range', f => f.request.stillFrames = [8393], /STILL_RANGE/],
  ['duplicate frame', f => f.request.stillFrames = [0, 0], /STILL_RANGE/],
  ['runtime drift', f => f.request.runtimeSha256 = digest('new runtime'), /RUNTIME_DRIFT/],
  ['self-review', f => f.review.reviewerId = f.review.implementerId, /INDEPENDENT_REVIEWER/],
  ['expired review', f => f.review.expiresAt = '2026-09-07T11:30:00Z', /REVIEW_EXPIRED/],
  ['invented review quote', f => f.review.quote = 'not present', /REVIEW_EVIDENCE/],
  ['fake production signature', f => f.review.cryptographicProductionAuthorization = true, /INDEPENDENT_REVIEW_INVALID/],
  ['context escape', f => f.request.knowledgeContext.contextPath = '/tmp/context.json', /CONTEXT_PATH_ESCAPE/],
  ['duplicate bindings', f => f.request.bindings.push(f.request.bindings[0]), /BINDING_DUPLICATE/],
  ['missing import', f => f.request.bindings = f.request.bindings.filter(b => b.path !== f.dataPath), /IMPORT_BINDING/],
  ['missing public hash', f => f.request.bindings = f.request.bindings.filter(b => !b.path.endsWith('P01.mp4')), /PUBLIC_CLOSURE/],
]) test(`reject ${name}`, () => { const f = fixture(); mutation(f); f.seal(); assert.throws(() => f.validate(), code); });

test('stale review cannot bind a new request without new evidence', () => {
  const f = fixture(); f.request.stillFrames = [1]; put(path.join(f.root, f.requestPath), f.request);
  assert.throws(() => f.validate(), /REVIEW_STALE/);
});

test('Shotcraft generated copy must bind the original bytes too', () => {
  const f = fixture();
  put(path.join(f.root, ENTRY), 'import {x} from "./ShotcraftEffects.generated"; export const y=x;');
  put(path.join(f.root, SHOTCRAFT_SOURCE), 'export const x=1;');
  put(path.join(f.root, SHOTCRAFT_COPY), 'export const x=2;');
  f.request.bindings[0].sha256 = hashFile(path.join(f.root, ENTRY));
  for (const n of [SHOTCRAFT_SOURCE, SHOTCRAFT_COPY]) f.request.bindings.push({path:n, sha256:hashFile(path.join(f.root,n))});
  f.seal(); assert.throws(() => f.validate(), /SHOTCRAFT_COPY_SOURCE_MISMATCH/);
});

test('real hashes reject changed inputs, changed public set, permission drift and context drift', () => {
  for (const kind of ['input', 'public', 'permission', 'context']) {
    const f = fixture(); const s = f.validate();
    if (kind === 'input') put(path.join(f.root, f.dataPath), {frames: 1});
    if (kind === 'public') put(path.join(f.root, PUBLIC, 'new.mp4'), 'not bound');
    if (kind === 'permission') put(path.join(f.root, PERMISSION), {...f.permission, evidence: {}});
    if (kind === 'context') put(f.contextPath, {...f.context, status: 'blocked'});
    assert.throws(() => assertSnapshot(f.root, s, f.kb), /DRIFT/);
  }
});

test('context read-only booleans and current material hashes are compulsory', () => {
  const f = fixture(); f.context.receipt_groups.task_original_materials.entries[0].states.applied = false;
  put(f.contextPath, f.context); f.request.knowledgeContext.sha256 = hashFile(f.contextPath); f.seal();
  assert.throws(() => f.validate(), /CONTEXT_MATERIAL_NOT_APPLIED/);
});

test('paths and symlinks are denied; hardlinks remain permitted', () => {
  for (const name of ['../outside', '/tmp/x', 'a//b', 'a/./b', 'a/%2e%2e/b', 'a\\b', 'a/.env', 'x/../../y']) assert.throws(() => relativePath(name));
  const f = fixture(); const target = path.join(f.root, PUBLIC, 'P01.mp4');
  const hardlink = path.join(f.root, PUBLIC, 'hard.mp4'); fs.linkSync(target, hardlink);
  assert.equal(hashFile(checked(f.root, `${PUBLIC}/hard.mp4`)), hashFile(target));
  const symlink = path.join(f.root, PUBLIC, 'sym.mp4'); fs.symlinkSync(target, symlink);
  assert.throws(() => checked(f.root, `${PUBLIC}/sym.mp4`), /SYMLINK/);
  assert.throws(() => f.validate(), /SYMLINK/);
});

test('existing action output, dangling links, locks and partial failures cannot be overwritten', () => {
  for (const name of [`${OUTPUT}/render`, `${OUTPUT}/active.lock`]) {
    const f = fixture(); put(path.join(f.root, name, 'placeholder'), 'x');
    assert.throws(() => f.validate('render'), /OUTPUT_EXISTS/);
  }
  const f = fixture(); fs.mkdirSync(path.join(f.root, OUTPUT), {recursive: true});
  fs.symlinkSync('/absent', path.join(f.root, OUTPUT, 'render'));
  assert.throws(() => absent(f.root, `${OUTPUT}/render`), /SYMLINK/);
});

test('stills and render are independent non-overwriting actions', () => {
  const f = fixture(); put(path.join(f.root, OUTPUT, 'stills/receipt.json'), '{}');
  assert.equal(f.validate('render').command, 'render');
  assert.equal(f.validate('preflight').command, 'preflight');
  assert.throws(() => f.validate('stills'), /OUTPUT_EXISTS/);
});

function importCase(source, extra = {}) {
  const f = fixture(); put(path.join(f.root, ENTRY), source);
  for (const [n, text] of Object.entries(extra)) put(path.join(f.root, n), text);
  const names = [ENTRY, ...Object.keys(extra)];
  return () => collectLocalImports(f.root, ENTRY, new Map(names.map(n => [n, hashFile(path.join(f.root, n))])), ts);
}

test('dynamic IO, package escape and unresolved imports are blocked', () => {
  for (const source of ['fetch("captions.json")', 'globalThis.fetch("x")', 'import("./x")', 'const p=process.env',
    'import fs from "node:fs";', 'const x="https://example.invalid/x";', 'import x from "../../../outside";']) assert.throws(importCase(source));
  assert.doesNotThrow(importCase('// https://example.invalid is a comment\nexport const a=1;'));
});

test('only exact SHA-pinned caption fetch and one literal captions.json call is permitted', () => {
  const caption = fs.readFileSync(path.join(ROOT, CAPTION_COMPONENT), 'utf8');
  assert.equal(digest(caption), CAPTION_SHA);
  const prefix = 'import {AdaptiveBilingualCaptionOverlay} from "../components/AdaptiveBilingualCaptionOverlay";';
  const extra = {[CAPTION_COMPONENT]: caption, 'remotion/src/styles.ts': fs.readFileSync(path.join(ROOT, 'remotion/src/styles.ts'), 'utf8'), [`${PUBLIC}/captions.json`]: '[]'};
  assert.doesNotThrow(importCase(prefix + 'export const x=<AdaptiveBilingualCaptionOverlay captionsSrc="captions.json" />;', extra));
  for (const call of ['captionsSrc="other.json"', 'captionsSrc={source}', 'captionsSrc="captions.json" {...other}'])
    assert.throws(importCase(prefix + `export const x=<AdaptiveBilingualCaptionOverlay ${call} />;`, extra), /CAPTION/);
  assert.throws(importCase('import * as C from "../components/AdaptiveBilingualCaptionOverlay";', extra), /CAPTION/);
  assert.throws(importCase(prefix + 'export const x=<AdaptiveBilingualCaptionOverlay captionsSrc="captions.json" />;', {...extra, [CAPTION_COMPONENT]: caption + '\n// changed'}), /CAPTION_IMPLEMENTATION_CHANGED/);
});

test('QA rejects high resolution, truncated video or missing audio without manufacturing a pass', () => {
  const probe = {streams: [{codec_type: 'video', codec_name: 'h264', width: 960, height: 540, r_frame_rate: '30/1', nb_read_frames: '8393'},
    {codec_type: 'audio', codec_name: 'aac', duration: '279.77'}]};
  assert.equal(validateMediaProbe(probe).audibleContentVerified, false);
  for (const change of [p => p.streams.pop(), p => p.streams[0].width = 1920, p => p.streams[0].nb_read_frames = '100']) {
    const p = structuredClone(probe); change(p); assert.throws(() => validateMediaProbe(p));
  }
  assert.throws(() => validatePng(Buffer.alloc(24)), /ACTUAL_STILL/);
});

test('clean environment contains neither inherited secrets nor proxy/node injection flags', () => {
  const before = process.env.NODE_OPTIONS;
  process.env.NODE_OPTIONS = '--import evil'; process.env.TEST_SECRET_KEY = 'fixture';
  const env = cleanEnvironment(top);
  assert.equal(env.NODE_OPTIONS, undefined); assert.equal(env.TEST_SECRET_KEY, undefined); assert.equal(env.HTTPS_PROXY, undefined);
  delete process.env.TEST_SECRET_KEY;
  if (before === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = before;
});

test('native sandbox admits only designated loopback and denies fixture secret data', {skip: process.platform !== 'darwin'}, () => {
  const scratch = path.join(top, 'native-probe'); const outputDir = path.join(scratch, 'out');
  for (const n of [scratch, outputDir, path.join(scratch, 'tmp'), path.join(scratch, 'home')]) fs.mkdirSync(n, {recursive: true});
  const secret = path.join(top, 'denied-fixture.txt'); put(secret, 'nonsecret test fixture');
  const profile = sandboxProfile({scratch, outputDir, readFiles: [fs.realpathSync(process.execPath)]});
  const r = spawnSync('/usr/bin/sandbox-exec', ['-p', profile, fs.realpathSync(process.execPath), path.join(ROOT, CONTROL, 'runtime/network-probe.mjs'), secret],
    {env: cleanEnvironment(scratch), cwd: ROOT, encoding: 'utf8', timeout: 10000});
  assert.equal(r.status, 0, r.stderr || r.error?.message || r.stdout);
  assert.deepEqual(JSON.parse(r.stdout), {loopbackAllowed: true, otherLoopbackDenied: true, secretEnvironmentAbsent: true, secretFileDenied: true});
});
