// 只检查本期参数；不启动浏览器、不读取媒体、不调用渲染。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const ts = require('typescript');

const runtimeModule = path.join(__dirname, 'runtime.ts');
const projectRoot = path.resolve(__dirname, '../../..');
const r1Runtime = 'edit/20261016_musk_grok_business_ai/04_后期准备/runtime-plan.v1.json';
const r2Runtime = 'edit/20261016_musk_grok_business_ai/07_小样修改R2/runtime-plan.r2.json';
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--runtime')) throw new Error('用法：check-parameters.cjs [--runtime 本期R1或R2权威路径]');
const runtimePath = path.resolve(projectRoot, args[1] ?? r2Runtime);
if (![r1Runtime, r2Runtime].some(value => path.resolve(projectRoot, value) === runtimePath)) throw new Error('只能检查本期R1或R2权威运行数据，不能将工程内快照当作权威来源');
const code = ts.transpileModule(fs.readFileSync(runtimeModule, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true},
}).outputText;
const loaded = {exports: {}};
new Function('require', 'module', 'exports', code)(createRequire(runtimeModule), loaded, loaded.exports);
const raw = fs.readFileSync(runtimePath);
const plan = JSON.parse(raw);

try {
  // 只执行组件导出的纯布局函数；外部视听模块留空，不创建 React 树或浏览器。
  const compositionPath = path.join(__dirname, 'Composition.tsx');
  const compositionCode = ts.transpileModule(fs.readFileSync(compositionPath, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX},
  }).outputText;
  const composition = {exports: {}};
  new Function('require', 'module', 'exports', compositionCode)(
    id => id === './runtime' ? loaded.exports : {}, composition, composition.exports);
  const {MEDIA_LAYOUT, mergePresenterWindows, presenterMix, continuousBusinessPhase} = composition.exports;
  const fixture = (from, to, state = 'ready', kind = 'real-evidence') => ({state, kind, window: {from, to}, asset: {}});
  const continuous = [fixture(900, 1050), fixture(600, 750), fixture(750, 900),
    fixture(2045, 2269, 'ready', 'paper'), fixture(3857, 4097, 'ready', 'paper'), fixture(1200, 1400, 'pending')];
  const original = JSON.stringify(continuous);
  const groups = mergePresenterWindows(continuous);
  assert.deepEqual(groups, [{from: 600, to: 1050}, {from: 2045, to: 2269}, {from: 3857, to: 4097}]);
  assert.equal(JSON.stringify(continuous), original);
  assert.deepEqual(mergePresenterWindows([fixture(10, 20), fixture(21, 40)]), [{from: 10, to: 20}, {from: 21, to: 40}]);
  for (const frame of [749, 750, 899, 900]) {
    assert.equal(presenterMix(frame, groups[0]), 1);
    assert.equal(loaded.exports.opacity(frame, groups[0], 5), 1);
  }
  for (const [frame, expected] of [[30, 0], [34, .5], [38, 1], [52, 1], [56, .5], [60, 0]]) {
    assert.equal(presenterMix(frame, {from: 30, to: 60}), expected);
  }
  assert.equal(presenterMix(100), 0);
  const {presenter, paper} = MEDIA_LAYOUT;
  assert.equal(paper.width / paper.height, 7 / 4);
  assert.equal(presenter.width / presenter.height, 16 / 9);
  assert.ok(presenter.x + presenter.width <= paper.x);
  for (const rect of [presenter, paper]) {
    assert.ok(rect.x >= 0 && rect.x + rect.width <= plan.width);
    assert.ok(rect.y >= 0 && rect.y + rect.height < loaded.exports.CAPTION_REGION.y);
  }
  const snapshot = fs.readFileSync(path.join(__dirname, 'runtime-plan.snapshot.json'));
  const profile = fs.readFileSync(path.resolve(__dirname, '../../../workflow/active-production-profile.v1.json'));
  const profileSnapshot = fs.readFileSync(path.join(__dirname, 'production-profile.snapshot.json'));
  if (!raw.equals(snapshot) || !profile.equals(profileSnapshot)) throw new Error('本期运行数据或活动V9档案与Remotion内快照不一致');
  loaded.exports.validateRuntimePlan(plan, 'preview');
  const continuousCue = plan.overlays.find(cue => cue.kind === 'continuous-business');
  if (continuousCue) {
    for (const [frame, phase] of [[2269, 'pit'], [2507, 'expectation'], [2811, 'negation'], [2887, 'tasks'], [3225, 'matching'], [3449, 'application']]) {
      assert.equal(continuousBusinessPhase(frame, plan), phase);
    }
    assert.equal(continuousCue.items.find(item => item.eventId === 'no-universal').text, '没有哪一个AI是万能的');
    assert.equal(continuousCue.items.find(item => item.eventId === 'strongest-model').text.replace(/\s/gu, ''), '不是买一套号称最强的模型');
    for (let frame = continuousCue.from + 8; frame < continuousCue.to - 8; frame++) {
      assert.equal(plan.overlays.filter(cue => frame >= cue.from && frame < cue.to).length, 1);
      assert.equal(plan.mediaSlots.some(slot => slot.state === 'ready' && frame >= slot.window.from && frame < slot.window.to), false);
    }
  }
  for (const camera of plan.cameraWindows.filter(window => window.motion === 'push-hold')) {
    assert.equal(loaded.exports.cameraScale(camera.from, camera), 1);
    assert.equal(loaded.exports.cameraScale(camera.settleFrame, camera), camera.peakScale);
    assert.equal(loaded.exports.cameraScale(camera.to - camera.releaseFrames, camera), camera.peakScale);
    assert.equal(loaded.exports.cameraScale(camera.to, camera), 1);
    for (let frame = camera.from; frame <= camera.to; frame++) {
      const value = loaded.exports.cameraScale(frame, camera);
      assert.ok(value >= 1 && value <= 1.08);
      assert.equal(loaded.exports.mix(value, 1, 1), 1);
    }
  }
  let formalParameters = '通过，仅代表参数，不代表生产授权';
  try { loaded.exports.validateRuntimePlan(plan, 'formal'); }
  catch (error) { formalParameters = error.message; }
  console.log(JSON.stringify({
    result: '本期准备参数通过',
    canonicalRuntimePath: runtimePath,
    runtimeSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    frames: plan.durationInFrames,
    captions: plan.captions.length,
    emptyEnglish: plan.captions.filter((caption) => !caption.english.trim()).length,
    events: plan.events.length,
    addedSfx: plan.sfx.length,
    continuousBusinessPhasesChecked: Boolean(continuousCue),
    pushHoldWindowsChecked: plan.cameraWindows.filter(window => window.motion === 'push-hold').length,
    pendingMedia: plan.mediaSlots.filter((slot) => slot.state === 'pending').map((slot) => slot.id),
    typePixels: loaded.exports.TYPE,
    layout: {presenter, paper, caption: loaded.exports.CAPTION_REGION, transitionFrames: MEDIA_LAYOUT.transitionFrames,
      mergedMediaWindows: mergePresenterWindows(plan.mediaSlots), contiguousBoundaryChecksPassed: true},
    formalParameters,
    renderExecuted: false,
    mediaAcceptancePerformed: false,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({result: '本期准备参数未通过', message: error.message, renderExecuted: false}, null, 2));
  process.exitCode = 1;
}
