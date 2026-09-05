/**
 * node --test skills/koubo-shotcraft-library/tests/local-preview.test.mjs
 * 所有媒体均为临时合成字节，不解码、不渲染、不执行 OCR，不生成真实授权或验收回执。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn, spawnSync} from 'node:child_process';
import http from 'node:http';
import {once} from 'node:events';
import test from 'node:test';
import {
  ABSENT_CONFIGS, AUTHORIZATION, COMPOSITIONS, CONTEXT_EVIDENCE_PATHS, CONTEXT_PATH, CONTEXT_TASK_ID,
  ENTRY, IMPLEMENTER_AGENT_ID, LOCAL_BROWSER, LOOPBACK_PRELOAD, REMOTION_PORT_CONFIG,
  LOCAL_CLI, NETWORK_SANDBOX, OUTPUT_ROOT, PLAN, REQUIRED_BINDINGS, STILL_FRAMES,
  assertOutputsAvailable, assertSnapshot, buildCommands, checkedPath, collectImportClosure,
  parseCommand, validateLocalPreview, assertContextValidation, contextValidationCommand, resolvePythonExecutable,
} from '../scripts/run-local-preview.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const base = 'skills/koubo-shotcraft-library';
const candidate = 'remotion/src/shotcraft-candidate-v1';
const reviewPath = 'edit/shotcraft-integration-20260904/synthetic-independent-review.json';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (body) => JSON.stringify(body, null, 2) + '\n';
const clone = (body) => structuredClone(body);

function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'shotcraft-local-preview-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const put = (name, body) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), {recursive: true});
    fs.writeFileSync(path.join(root, name), body);
  };
  const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  const copies = new Set([
    `${base}/scripts/run-local-preview.mjs`, `${base}/scripts/validate-plan.mjs`, `${base}/registry.v1.json`,
    `${base}/assets/ShotcraftEffects.tsx`, ENTRY, `${candidate}/ShotcraftCandidate.tsx`,
    `${candidate}/ShotcraftEffects.generated.tsx`, `${candidate}/tsconfig.json`, 'remotion/tsconfig.json',
  ]);
  for (const name of REQUIRED_BINDINGS) put(name, copies.has(name) ? fs.readFileSync(path.join(repo, name)) : 'synthetic-only\n');
  const oldPlan = JSON.parse(fs.readFileSync(path.join(repo, PLAN), 'utf8'));
  const bind = (item) => ({path: item.path, publicPath: item.publicPath, sha256: sha(fs.readFileSync(path.join(root, item.path)))});
  const captions = [{startMs: 42600, endMs: 73600, zh: '真实材料', en: 'Synthetic fixture'}];
  put(oldPlan.captions.path, json(captions));
  put(`${candidate}/captions.generated.json`, json(captions));
  const plan = {
    schemaVersion: 'shotcraft-candidate/v1', status: 'candidate-preview-required', formalEnabled: false,
    productionEligible: false, subtitleAuthority: 'actual-recording', width: 1920, height: 1080,
    fps: 30, durationInFrames: 930, sourceStartFrame: 1278,
    source: bind(oldPlan.source), captions: bind(oldPlan.captions),
    assets: Object.fromEntries(Object.entries(oldPlan.assets).map(([id, item]) => [id, bind(item)])),
    effects: [{id: 'fixture', effectId: 'marker-underline', mainVisual: 'speaker', from: 0, duration: 100,
      region: {x: 0, y: 0, width: 400, height: 300},
      protectedRegions: [{x: 800, y: 0, width: 1000, height: 800}, {x: 0, y: 900, width: 1920, height: 180}],
      quote: '真实材料', texts: ['真实材料'], purpose: '合成测试'}],
    mediaWindows: [{from: 300, duration: 65, mediaStartFrame: 0}],
    sfx: [{id: 'fixture', assetId: 'pop', frame: 95, gain: 0.1}], review: {userApproved: false},
  };
  put(PLAN, json(plan));
  function seal({extra = [], changeBindings = (items) => items, reviewPatch = {}, authPatch = {}} = {}) {
    const bindings = changeBindings([...REQUIRED_BINDINGS, ...extra].map((name) => ({path: name, sha256: sha(fs.readFileSync(path.join(root, name)))})));
    const review = {
      schemaVersion: 'shotcraft-local-preview-code-review/v1', decision: 'allow-local-preview',
      manifestSha256: sha(JSON.stringify(bindings)), reviewerAgentId: '00000000-0000-4000-8000-000000000001',
      cryptographicProductionAuthorization: false, evidenceScope: 'synthetic-test-only', ...reviewPatch,
    };
    put(reviewPath, json(review));
    const auth = {
      schemaVersion: 'shotcraft-local-preview-authorization/v1', scope: 'local-experiment-only', userConfirmed: true,
      formalEnabled: false, productionEligible: false, independentReview: {path: reviewPath, sha256: sha(json(review))},
      bindings, evidenceScope: 'synthetic-test-only', ...authPatch,
    };
    put(AUTHORIZATION, json(auth));
    return auth;
  }
  seal();
  return {root, put, read, seal, plan, validate: (command = 'preflight') => validateLocalPreview({root, command})};
}

function tree(root) {
  const entries = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      entries.push([relative, entry.isSymbolicLink() ? fs.readlinkSync(absolute) : entry.isDirectory() ? 'directory' : sha(fs.readFileSync(absolute))]);
      if (entry.isDirectory()) visit(absolute);
    }
  }
  visit(root);
  return entries.sort(([a], [b]) => a.localeCompare(b));
}

test('合法合成预检可重复且只读，不需要影片后验收、系统密钥或生产解冻', async (t) => {
  const f = fixture(t);
  const before = tree(f.root);
  const first = await f.validate();
  assert.deepEqual(await f.validate(), first);
  assert.equal(first.status, 'local-preflight-passed');
  assert.equal(first.formalEnabled, false);
  assert.equal(first.productionEligible, false);
  assert.equal(first.cryptographicProductionAuthorization, false);
  assert.equal(first.userPostReview, 'pending');
  assert.ok(first.importClosure.includes(`${candidate}/captions.generated.json`));
  assert.deepEqual(tree(f.root), before);
  assert.ok(!fs.existsSync(path.join(f.root, OUTPUT_ROOT)));
});

test('每一个必需绑定都不能省略', async (t) => {
  const f = fixture(t);
  assert.equal(new Set(REQUIRED_BINDINGS).size, REQUIRED_BINDINGS.length);
  for (const missing of REQUIRED_BINDINGS) {
    f.seal({changeBindings: (items) => items.filter((item) => item.path !== missing)});
    await assert.rejects(f.validate(), /REQUIRED_BINDING_MISSING/);
  }
  assert.ok(!fs.existsSync(path.join(f.root, OUTPUT_ROOT)));
});

test('所有绑定均实际读哈希，保护生产文件漂移也必须失败', async (t) => {
  const f = fixture(t);
  for (const name of REQUIRED_BINDINGS) {
    const absolute = path.join(f.root, name);
    const bytes = fs.readFileSync(absolute);
    fs.appendFileSync(absolute, '\nchanged');
    await assert.rejects(f.validate(), /BINDING_HASH_MISMATCH/);
    fs.writeFileSync(absolute, bytes);
  }
  await f.validate();
});

test('额外 source-policy/transcript 绑定也逐项读取，不能静默忽略', async (t) => {
  const f = fixture(t);
  const extra = ['edit/source-policy.fixture.json', 'edit/cleaned-transcript.fixture.json'];
  for (const name of extra) f.put(name, '{}');
  f.seal({extra});
  await f.validate();
  fs.unlinkSync(path.join(f.root, extra[1]));
  await assert.rejects(f.validate(), /ENOENT/);
  f.put(extra[1], 'changed');
  await assert.rejects(f.validate(), /BINDING_HASH_MISMATCH/);
});

test('拒绝缺失、错误类型、重复、伪造及越界绑定', async (t) => {
  const f = fixture(t);
  for (const patch of [
    {bindings: null}, {bindings: []}, {bindings: [{}]},
    {bindings: [{path: '../outside', sha256: '0'.repeat(64)}]},
    {bindings: [{path: '/tmp/outside', sha256: '0'.repeat(64)}]},
    {bindings: [{path: 'remotion/../outside', sha256: '0'.repeat(64)}]},
    {bindings: [{path: 'remotion\\outside', sha256: '0'.repeat(64)}]},
    {bindings: [{path: 'remotion//outside', sha256: '0'.repeat(64)}]},
    {bindings: [{path: REQUIRED_BINDINGS[0], sha256: 'invalid'}]},
  ]) {
    f.seal({authPatch: patch});
    await assert.rejects(f.validate());
  }
  f.seal({changeBindings: (items) => [...items, items[0]]});
  await assert.rejects(f.validate(), /BINDING_DUPLICATE_OR_CIRCULAR/);
  f.seal({changeBindings: (items) => [{...items[0], ignored: true}, ...items.slice(1)]});
  await assert.rejects(f.validate(), /BINDING_INVALID/);
});

test('所有权限字段均严格校验，不接受真假值转换或正式授权', async (t) => {
  const f = fixture(t);
  for (const authPatch of [
    {schemaVersion: 'other'}, {scope: 'production'}, {userConfirmed: false}, {userConfirmed: 'true'},
    {formalEnabled: true}, {formalEnabled: undefined}, {productionEligible: true}, {productionEligible: 0},
  ]) {
    f.seal({authPatch});
    await assert.rejects(f.validate(), /AUTHORIZATION_INVALID/);
  }
});

test('独立审查需真实身份字段、正确决策和原顺序清单哈希，不充当密码学生产授权', async (t) => {
  const f = fixture(t);
  for (const reviewPatch of [
    {schemaVersion: 'other'}, {decision: 'accepted'}, {manifestSha256: '0'.repeat(64)},
    {reviewerAgentId: IMPLEMENTER_AGENT_ID}, {reviewerAgentId: IMPLEMENTER_AGENT_ID.toUpperCase()},
    {reviewerAgentId: ''}, {reviewerAgentId: 'independent-auditor'},
    {cryptographicProductionAuthorization: true}, {cryptographicProductionAuthorization: undefined},
  ]) {
    f.seal({reviewPatch});
    await assert.rejects(f.validate(), /INDEPENDENT_REVIEW/);
  }
  f.seal();
  const auth = f.read(AUTHORIZATION);
  auth.bindings.reverse();
  f.put(AUTHORIZATION, json(auth));
  await assert.rejects(f.validate(), /INDEPENDENT_REVIEW_INVALID/);
  f.seal();
  f.put(reviewPath, json({...f.read(reviewPath), decision: 'blocked'}));
  await assert.rejects(f.validate(), /REVIEW_HASH_MISMATCH/);
});

test('审查路径不能越界、指向输出或混入被审查清单形成循环', async (t) => {
  const f = fixture(t);
  for (const name of ['../outside', '/tmp/outside', AUTHORIZATION, `${OUTPUT_ROOT}/review.json`, 'edit/elsewhere.json', PLAN]) {
    f.seal({authPatch: {independentReview: {path: name, sha256: '0'.repeat(64)}}});
    await assert.rejects(f.validate(), /REVIEW_PATH_INVALID|UNSAFE_PATH/);
  }
});

test('31秒、930帧、30fps、源起点和原尺寸全部固定，不能仅靠总秒数相等', async (t) => {
  const f = fixture(t);
  for (const patch of [
    {durationInFrames: 900}, {durationInFrames: 931}, {fps: 60, durationInFrames: 1860},
    {width: 960, height: 540}, {height: 1081}, {sourceStartFrame: 0},
    {formalEnabled: true}, {productionEligible: true}, {review: {userApproved: true}},
  ]) {
    f.put(PLAN, json({...f.plan, ...patch}));
    f.seal();
    await assert.rejects(f.validate(), /FIXED_SAMPLE_REQUIRED|PLAN_FORMAL_FORBIDDEN|POST_REVIEW_MUST_REMAIN_PENDING/);
  }
});

test('复用 validateFiles，实录引语、字幕时间及遮挡错误仍然阻断', async (t) => {
  const f = fixture(t);
  const badQuote = clone(f.plan);
  badQuote.effects[0].quote = '未说过的内容';
  f.put(PLAN, json(badQuote));
  f.seal();
  await assert.rejects(f.validate(), /QUOTE_NOT_IN_WINDOW/);
  const badRegion = clone(f.plan);
  badRegion.effects[0].region.x = 900;
  f.put(PLAN, json(badRegion));
  f.seal();
  await assert.rejects(f.validate(), /OCCLUSION/);
  const badCaptions = [{startMs: 42600, endMs: 42000, zh: '真实材料'}];
  f.put(f.plan.captions.path, json(badCaptions));
  f.put(`${candidate}/captions.generated.json`, json(badCaptions));
  const plan = clone(f.plan);
  plan.captions.sha256 = sha(json(badCaptions));
  f.put(PLAN, json(plan));
  f.seal();
  await assert.rejects(f.validate(), /CAPTIONS_INVALID/);
});

test('媒体 publicPath 必须对应实际受锁路径，拒绝外网、编码越界和换源', async (t) => {
  const f = fixture(t);
  for (const value of ['https://example.invalid/source.mp4', '../outside.mp4', '%2e%2e/outside.mp4', 'media/wrong.mp4']) {
    const plan = clone(f.plan);
    plan.source.publicPath = value;
    f.put(PLAN, json(plan));
    f.seal();
    await assert.rejects(f.validate(), /MEDIA_PUBLIC_PATH_MISMATCH|UNSAFE_PATH/);
  }
  const plan = {...f.plan, mediaPublicPath: 'media/wrong.mp4'};
  f.put(PLAN, json(plan));
  f.seal();
  await assert.rejects(f.validate(), /MEDIA_PUBLIC_PATH_MISMATCH/);
  f.put(PLAN, json({...f.plan, source: f.plan.assets.family}));
  f.seal();
  await assert.rejects(f.validate(), /FIXED_SOURCE_REQUIRED/);
});

test('字幕和效果镜像必须字节相同，即使新哈希已经重新绑定并审查', async (t) => {
  const f = fixture(t);
  const captionMirror = `${candidate}/captions.generated.json`;
  const original = fs.readFileSync(path.join(f.root, captionMirror));
  f.put(captionMirror, Buffer.concat([original, Buffer.from('\n')]));
  f.seal();
  await assert.rejects(f.validate(), /CAPTION_MIRROR_MISMATCH/);
  f.put(captionMirror, original);
  fs.appendFileSync(path.join(f.root, `${candidate}/ShotcraftEffects.generated.tsx`), '\n');
  f.seal();
  await assert.rejects(f.validate(), /EFFECT_MIRROR_MISMATCH/);
});

test('媒体窗口和音效非法帧、资产或增益不能进入渲染', async (t) => {
  const f = fixture(t);
  for (const patch of [
    {mediaWindows: [{from: 900, duration: 100, mediaStartFrame: 0}]},
    {mediaWindows: [{from: 0, duration: 50, mediaStartFrame: -1}]},
    {sfx: [{assetId: 'family', frame: 1, gain: 0.1}]},
    {sfx: [{assetId: 'pop', frame: 930, gain: 0.1}]},
    {sfx: [{assetId: 'pop', frame: 1, gain: 1.1}]},
  ]) {
    f.put(PLAN, json({...f.plan, ...patch}));
    f.seal();
    await assert.rejects(f.validate(), /MEDIA_WINDOW_INVALID|SFX_INVALID/);
  }
});

test('文件、父目录、授权和审查的符号链接均拒绝，包含断链', async (t) => {
  for (const name of [REQUIRED_BINDINGS[0], AUTHORIZATION, reviewPath]) {
    const f = fixture(t);
    const target = path.join(f.root, name);
    fs.renameSync(target, target + '.original');
    fs.symlinkSync(target + '.original', target);
    await assert.rejects(f.validate(), /SYMLINK_FORBIDDEN/);
  }
  const f = fixture(t);
  fs.renameSync(path.join(f.root, 'remotion/public'), path.join(f.root, 'remotion/public-real'));
  fs.symlinkSync('public-real', path.join(f.root, 'remotion/public'));
  await assert.rejects(f.validate(), /SYMLINK_FORBIDDEN/);
  fs.symlinkSync('/nonexistent-synthetic-target', path.join(f.root, 'broken'));
  assert.throws(() => checkedPath(f.root, 'broken/child', true), /SYMLINK_FORBIDDEN/);
});

test('绑定目录而非文件、实际文件缺失均失败', async (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.root, REQUIRED_BINDINGS[0]));
  await assert.rejects(f.validate(), /ENOENT/);
  fs.mkdirSync(path.join(f.root, REQUIRED_BINDINGS[0]));
  await assert.rejects(f.validate(), /REGULAR_FILE_REQUIRED/);
});

test('两个 Composition 的身份、尺寸、时钟和 A/B 属性不得改变', async (t) => {
  const f = fixture(t);
  const original = fs.readFileSync(path.join(f.root, ENTRY), 'utf8');
  for (const [from, to] of [
    ['ShotcraftCandidateWithSfx', 'OtherComposition'], ['width={1920}', 'width={960}'],
    ['fps={plan.fps}', 'fps={60}'], ['withSfx:true', 'withSfx:false'],
    ['component={ShotcraftCandidate}', 'component={Other}'],
    ['defaultProps={{withSfx:true}}', 'defaultProps={{withSfx:true}} calculateMetadata={someFunction}'],
  ]) {
    assert.ok(original.includes(from));
    f.put(ENTRY, original.replace(from, to));
    f.seal();
    await assert.rejects(f.validate(), /COMPOSITION|INTRINSIC_SIZE/);
  }
});

test('候选静态导入闭包必须绑定；重新审查后允许局部可读性修改及本地辅助模块', async (t) => {
  const f = fixture(t);
  const component = `${candidate}/ShotcraftCandidate.tsx`;
  const helper = `${candidate}/readability.ts`;
  const original = fs.readFileSync(path.join(f.root, component), 'utf8');
  f.put(helper, 'export const labelSize = 42;\n');
  f.put(component, "import {labelSize} from './readability';\n" + original.replace('fontSize:42', 'fontSize:labelSize'));
  await assert.rejects(f.validate(), /BINDING_HASH_MISMATCH/);
  f.seal();
  await assert.rejects(f.validate(), /IMPORT_BINDING_REQUIRED/);
  f.seal({extra: [helper]});
  const result = await f.validate();
  assert.ok(result.importClosure.includes(helper));
});

test('外部资源、动态导入、额外包和生产目录导入均阻断', async (t) => {
  const f = fixture(t);
  const component = `${candidate}/ShotcraftCandidate.tsx`;
  const original = fs.readFileSync(path.join(f.root, component), 'utf8');
  for (const prefix of [
    "const external = 'https://example.invalid/image.png';\n", "fetch('/local');\n",
    "import('./helper');\n", "import fs from 'node:fs';\n", "import '../Root';\n",
  ]) {
    f.put(component, prefix + original);
    f.seal();
    await assert.rejects(f.validate(), /EXTERNAL_RESOURCE|DYNAMIC_IO|DYNAMIC_IMPORT|PACKAGE_NOT_ALLOWED|IMPORT_OUTSIDE_CANDIDATE/);
  }
});

test('校验器自身新增的本地模块也必须绑定，不能先执行再补验哈希', async (t) => {
  const f = fixture(t);
  const validator = `${base}/scripts/validate-plan.mjs`;
  const helper = `${base}/scripts/synthetic-helper.mjs`;
  f.put(helper, 'export const synthetic = true;\n');
  f.put(validator, "import {synthetic} from './synthetic-helper.mjs';\n" + fs.readFileSync(path.join(f.root, validator), 'utf8'));
  f.seal();
  await assert.rejects(f.validate(), /IMPORT_BINDING_REQUIRED/);
  f.seal({extra: [helper]});
  const result = await f.validate();
  assert.ok(result.importClosure.includes(helper));
  assert.ok(result.importClosure.includes(validator));
});

test('配置必须保持已核实不存在，tsconfig 不得增加外部继承或插件', async (t) => {
  const f = fixture(t);
  for (const name of ABSENT_CONFIGS) {
    f.put(name, 'throw new Error("must not execute");');
    await assert.rejects(f.validate(), /PATH_ALREADY_EXISTS/);
    fs.unlinkSync(path.join(f.root, name));
  }
  f.put(`${candidate}/tsconfig.json`, json({extends: '/outside.json'}));
  f.seal();
  await assert.rejects(f.validate(), /TSCONFIG_EXTENDS/);
});

test('预检后再次检查所有输入及授权/审查，拒绝在渲染前漂移', async (t) => {
  const f = fixture(t);
  const snapshot = await f.validate();
  for (const name of [AUTHORIZATION, reviewPath, PLAN, 'workflow/director-skill-lock.v1.json']) {
    const original = fs.readFileSync(path.join(f.root, name));
    fs.appendFileSync(path.join(f.root, name), '\n');
    assert.throws(() => assertSnapshot(f.root, snapshot), /INPUT_CHANGED/);
    f.put(name, original);
  }
});

test('已有输出、失败日志、并行锁和输出父级越界不能被覆盖或删除', async (t) => {
  const names = [`${OUTPUT_ROOT}/with-sfx.mp4`, `${OUTPUT_ROOT}/no-sfx.mp4`,
    `${OUTPUT_ROOT}/render-ab.start.json`, `${OUTPUT_ROOT}/render-ab.finish.json`, `${OUTPUT_ROOT}/active-run.lock`];
  for (const name of names) {
    const f = fixture(t);
    f.put(name, 'retained-failed-output');
    const before = tree(f.root);
    await assert.rejects(f.validate('render-ab'), /PATH_ALREADY_EXISTS/);
    assert.deepEqual(tree(f.root), before);
  }
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, OUTPUT_ROOT, 'stills'), {recursive: true});
  await assert.rejects(f.validate('stills'), /PATH_ALREADY_EXISTS/);
  await f.validate('render-ab');
  fs.symlinkSync('/tmp', path.join(f.root, OUTPUT_ROOT, 'with-sfx.mp4'));
  await assert.rejects(f.validate('render-ab'), /SYMLINK_FORBIDDEN/);
  const g = fixture(t);
  fs.symlinkSync('/tmp', path.join(g.root, OUTPUT_ROOT));
  assert.throws(() => assertOutputsAvailable(g.root, 'render-ab'), /SYMLINK_FORBIDDEN/);
});

test('固定命令契约：只渲染指定两版、七个静帧、960x540 和固定编码', () => {
  assert.deepEqual(STILL_FRAMES, [95, 245, 332, 470, 550, 650, 870]);
  const ab = buildCommands(repo, 'render-ab');
  assert.equal(ab.length, 2);
  for (const [index, spec] of ab.entries()) {
    assert.equal(spec.executable, '/usr/bin/sandbox-exec');
    assert.deepEqual(spec.args.slice(0, 6), ['-p', NETWORK_SANDBOX, process.execPath, '--import', LOOPBACK_PRELOAD, path.join(repo, LOCAL_CLI)]);
    assert.ok(spec.args.includes(path.join(repo, ENTRY)));
    assert.ok(spec.args.includes(COMPOSITIONS[index]));
    for (const arg of ['--width=1920', '--height=1080', '--fps=30', '--duration=930', '--scale=0.5', '--concurrency=2', '--crf=20', '--codec=h264', '--pixel-format=yuv420p', '--overwrite=false', '--env-file=/dev/null', '--bundle-cache=false']) assert.ok(spec.args.includes(arg), arg);
    assert.ok(spec.args.includes('--browser-executable=' + path.join(repo, LOCAL_BROWSER)));
    assert.ok(!spec.args.some((arg) => /^(?:--props|--config|--frames|--muted|--formal)(?:=|$)/u.test(arg)));
    assert.equal(spec.output, `${OUTPUT_ROOT}/${index === 0 ? 'with-sfx' : 'no-sfx'}.mp4`);
  }
  const stills = buildCommands(repo, 'stills');
  assert.equal(stills.length, 7);
  for (const [index, spec] of stills.entries()) {
    assert.ok(spec.args.includes(`--frame=${STILL_FRAMES[index]}`));
    assert.ok(spec.args.includes('--image-format=png'));
    assert.equal(spec.output, `${OUTPUT_ROOT}/stills/frame-${STILL_FRAMES[index]}.png`);
  }
  assert.deepEqual(buildCommands(repo, 'preflight'), []);
});

test('禁止任何额外 CLI 参数；真实 runner 参数拒绝路径也无文件副作用', () => {
  for (const args of [[], ['formal'], ['render'], ['stills', '--frames=0-30'], ['render-ab', '--output=/tmp/x'],
    ['preflight', '--entry=other.tsx'], ['render-ab', '--props={}'], ['preflight', '--root=/tmp'], ['--help']]) {
    assert.throws(() => parseCommand(args), /COMMAND_NOT_ALLOWED/);
  }
  const before = fs.existsSync(path.join(repo, OUTPUT_ROOT));
  const result = spawnSync(process.execPath, [path.join(repo, `${base}/scripts/run-local-preview.mjs`), 'render-ab', '--formal'], {encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /COMMAND_NOT_ALLOWED/);
  assert.equal(fs.existsSync(path.join(repo, OUTPUT_ROOT)), before);
});

test('预渲染拒绝路径不创建目录或执行未验哈希校验器', async (t) => {
  const f = fixture(t);
  f.put(`${base}/scripts/validate-plan.mjs`, `throw new Error('unverified-code-must-not-run');`);
  const before = tree(f.root);
  await assert.rejects(f.validate('render-ab'), /BINDING_HASH_MISMATCH/);
  assert.deepEqual(tree(f.root), before);
  assert.ok(!fs.existsSync(path.join(f.root, OUTPUT_ROOT)));
});

test('导入闭包函数不执行候选源码', (t) => {
  const f = fixture(t);
  const component = `${candidate}/ShotcraftCandidate.tsx`;
  fs.appendFileSync(path.join(f.root, component), "\nthrow new Error('must-not-execute');\n");
  const auth = f.seal();
  assert.ok(collectImportClosure(f.root, auth.bindings).includes(component));
});

test('固定知识上下文 CLI 只执行 validate-context，Python 路径是唯一环境选择', () => {
  const python = path.join(os.tmpdir(), 'configured-python', 'python3');
  const spec = contextValidationCommand(python);
  assert.equal(CONTEXT_TASK_ID, 'task-20260904T084602Z-be40d4d5');
  assert.equal(spec.executable, python);
  assert.deepEqual(spec.args.slice(0, 2), ['-I', '-B']);
  assert.ok(spec.args[2].endsWith('/04_Claude Code日常操作/scripts/opc_rag.py'));
  assert.deepEqual(spec.args.slice(-3), ['validate-context', '--context', CONTEXT_PATH]);
  assert.deepEqual(Object.keys(spec.env), ['PATH']);
  assert.ok(!spec.args.some((arg) => ['start', 'index', 'writeback-apply'].includes(arg)));
  assert.throws(() => contextValidationCommand('python3'), /CONTEXT_PYTHON_ABSOLUTE_REQUIRED/);
  assert.equal(CONTEXT_EVIDENCE_PATHS.length, 5);
  assert.ok(CONTEXT_EVIDENCE_PATHS.some((p) => p.endsWith('/context-requirements.v1.json')));
  assert.ok(CONTEXT_EVIDENCE_PATHS.some((p) => p.endsWith('/read-receipts.v1.json')));
  assert.ok(REQUIRED_BINDINGS.every((p) => !path.isAbsolute(p)));
});

test('Python 默认从 PATH 解析绝对可执行文件，忽略空项、相对目录及不可执行候选', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shotcraft-python-path-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const blocked = path.join(root, 'blocked');
  const executableDir = path.join(root, 'valid');
  fs.mkdirSync(blocked);
  fs.mkdirSync(executableDir);
  fs.writeFileSync(path.join(blocked, 'python3'), 'synthetic-only', {mode: 0o600});
  const executable = path.join(executableDir, 'python3');
  fs.writeFileSync(executable, 'synthetic-only', {mode: 0o700});
  assert.equal(resolvePythonExecutable(['', 'relative-bin', blocked, executableDir].join(path.delimiter)), executable);
  assert.equal(contextValidationCommand(resolvePythonExecutable(executableDir)).executable, executable);
  assert.throws(() => resolvePythonExecutable(['', 'relative-bin', blocked].join(path.delimiter)), /CONTEXT_PYTHON_NOT_FOUND/);
  assert.throws(() => resolvePythonExecutable(''), /CONTEXT_PYTHON_NOT_FOUND/);
});

test('上下文复检必须 exit0 且 context-valid，不能凭旧 context-ready 或伪布尔值放行', () => {
  const body = {schema_version: 'opc-task-context-validation/1.0', status: 'context-valid',
    context_path: CONTEXT_PATH, task: {id: CONTEXT_TASK_ID, important: true},
    project_route: {project_root: repo}, gate: {formal_execution_allowed: true}};
  const result = (patch = {}, status = 0) => ({status, stdout: JSON.stringify({...body, ...patch})});
  assert.deepEqual(assertContextValidation(result()), body);
  for (const patch of [
    {status: 'blocked-context-stale'}, {status: 'context-ready'}, {status: 'context-valid', gate: {formal_execution_allowed: 'true'}},
    {task: {id: 'another-task', important: true}}, {task: {id: CONTEXT_TASK_ID, important: false}},
    {project_route: {project_root: '/tmp'}}, {context_path: '/tmp/context.json'},
  ]) assert.throws(() => assertContextValidation(result(patch)), /CONTEXT_/);
  assert.throws(() => assertContextValidation(result({}, 1)), /CONTEXT_VALIDATION_FAILED/);
  assert.throws(() => assertContextValidation({...result(), error: new Error('spawn failed')}), /CONTEXT_VALIDATION_FAILED/);
  assert.throws(() => assertContextValidation({status: 0, stdout: 'not json'}), /CONTEXT_VALIDATION_JSON_INVALID/);
});

test('真实 CLI 在创建目录及每次启动渲染前均复检 context，不调用生产门', () => {
  const source = fs.readFileSync(path.join(repo, `${base}/scripts/run-local-preview.mjs`), 'utf8');
  const main = source.slice(source.indexOf('async function main()'));
  assert.ok(main.indexOf('snapshot.knowledgeContext = validateKnowledgeContext();') < main.indexOf("command === 'preflight'"));
  assert.ok(main.indexOf('validateKnowledgeContext(snapshot.knowledgeContext)') < main.indexOf('fs.mkdirSync'));
  const loop = main.slice(main.indexOf('for (const spec of commands)'));
  assert.ok(loop.indexOf('validateKnowledgeContext(snapshot.knowledgeContext)') < loop.indexOf('spawnSync(spec.executable'));
  assert.doesNotMatch(main, /assertProductionEntryPreflight|validateKnowledgeContextForProduction/);
});

test('真实入站负例：旧 Remotion 配置在非回环返回200，固定预加载后只接受127.0.0.1',
  {skip: process.platform !== 'darwin', timeout: 15000}, async (t) => {
    const address = Object.values(os.networkInterfaces()).flat().find((item) => !item.internal && item.family === 'IPv4')?.address;
    assert.ok(address, '必须有真实非回环IPv4才能证明本负例；不能静默跳过');
    const probe = `const http = require('node:http');
      const {getPortConfig} = require(${JSON.stringify(path.join(repo, REMOTION_PORT_CONFIG))});
      const config = getPortConfig(true);
      const server = http.createServer((req, res) => res.end('synthetic-probe'));
      server.listen({port: 0, host: config.host}, () => process.stdout.write(JSON.stringify({port:server.address().port, host:config.host}) + '\\n'));`;
    const request = (host, port) => new Promise((resolve) => {
      const req = http.get({host, port, path: '/', timeout: 800}, (response) => {
        response.resume();
        resolve({status: response.statusCode});
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', (error) => resolve({error: error.code ?? error.message}));
    });
    for (const hardened of [false, true]) {
      const args = ['-p', NETWORK_SANDBOX, process.execPath, ...(hardened ? ['--import', LOOPBACK_PRELOAD] : []), '-e', probe];
      const child = spawn('/usr/bin/sandbox-exec', args, {stdio: ['ignore', 'pipe', 'pipe']});
      const exited = once(child, 'exit');
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      t.after(() => { if (child.exitCode === null) child.kill('SIGTERM'); });
      try {
        const ready = await Promise.race([
          once(child.stdout, 'data').then(([chunk]) => JSON.parse(String(chunk))),
          exited.then(([code]) => { throw new Error(`probe exit ${code}: ${stderr}`); }),
        ]);
        assert.equal(ready.host, hardened ? '127.0.0.1' : '0.0.0.0');
        assert.equal((await request('127.0.0.1', ready.port)).status, 200);
        const externalInterface = await request(address, ready.port);
        if (hardened) assert.equal(externalInterface.error, 'ECONNREFUSED', JSON.stringify(externalInterface));
        else assert.equal(externalInterface.status, 200, '旧配置必须实际复现可达，证明负例不是网络断开导致');
      } finally { child.kill('SIGTERM'); await exited; }
    }
  });

test('macOS 网络沙箱允许本地回环服务，不启动浏览器或媒体工具', {skip: process.platform !== 'darwin'}, () => {
  assert.match(NETWORK_SANDBOX, /\(deny network-outbound\)/);
  assert.match(NETWORK_SANDBOX, /remote ip "localhost:\*"/);
  const probe = `const http = require('node:http');
    const server = http.createServer((req, res) => res.end('local-only'));
    server.listen(0, '127.0.0.1', () => {
      http.get({host: '127.0.0.1', port: server.address().port}, response => {
        response.pipe(process.stdout);
        response.on('end', () => server.close());
      }).on('error', error => { console.error(error); server.close(); process.exitCode = 1; });
    });`;
  const result = spawnSync('/usr/bin/sandbox-exec', ['-p', NETWORK_SANDBOX, process.execPath, '-e', probe], {encoding: 'utf8', timeout: 10000});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'local-only');
});
