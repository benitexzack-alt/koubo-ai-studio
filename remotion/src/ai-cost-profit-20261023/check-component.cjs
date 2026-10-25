// 本期局部组件契约检查：不启动浏览器，不读取媒体，不执行渲染。
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');

let currentFrame = 0;
const element = (type, props) => ({type, props: props ?? {}});
const remotion = Object.fromEntries(['AbsoluteFill', 'Freeze', 'Img', 'OffthreadVideo', 'Sequence'].map(name => [name, name]));
Object.assign(remotion, {staticFile: value => value, useCurrentFrame: () => currentFrame,
  cancelRender: error => {throw error;}, delayRender: () => 1, continueRender: () => {}});
const modules = {
  react: {useMemo: callback => callback(), useEffect: () => {}},
  'react/jsx-runtime': {jsx: element, jsxs: element, Fragment: 'Fragment'},
  remotion,
  '@remotion/fonts': {},
  '@remotion/media': {Audio: 'Audio'},
};
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'Composition.tsx'), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX},
}).outputText;
const loaded = {exports: {}};
new Function('require', 'module', 'exports', code)(name => {
  if (!(name in modules)) throw new Error(`测试不允许加载额外模块：${name}`);
  return modules[name];
}, loaded, loaded.exports);
const {AiCostProfit20261023, validateRuntimePlan, mergePresenterWindows, LAYOUT} = loaded.exports;

const fixture = () => ({
  width: 1920, height: 1080, fps: 30, durationInFrames: 9864,
  host: {src: 'episode/host.mp4', trimBeforeFrame: 0, trimAfterFrame: 9864, sourceDurationInFrames: 9864},
  voice: {src: 'episode/voice.wav', gain: 1, playbackRate: 1},
  fonts: {heading: 'fonts/heading.woff2', body: 'fonts/body.ttf'},
  captions: Array.from({length: 164}, (_, i) => ({id: i + 1, from: i * 30, to: i * 30 + 29, chinese: '实录原句', english: 'Spoken words'})),
  inserts: Array.from({length: 11}, (_, i) => ({shotId: `P${String(i + 1).padStart(2, '0')}`,
    from: 100 + i * 300, to: 200 + i * 300, src: `episode/P${i + 1}.mp4`, presenter: 'bottom-left', style: i % 2 ? 'pixel' : 'paper'})),
  evidence: [{id: 'E01', from: 7000, to: 7060, src: 'episode/evidence.mp4', kind: 'video', title: '公开资料', credit: '来源名称', presenter: 'bottom-left', trimBeforeFrame: 33}],
  aiScenes: [{id: 'A01', from: 5000, to: 5070, src: 'episode/A01.mp4', trimBeforeFrame: 12, presenter: 'bottom-left'}],
  speakerCards: [{id: 'S01', from: 8000, to: 8120, lines: ['成本降了', '利润呢', '再算一遍'], lineAtFrames: [8000, 8030, 8060]}],
  sfx: [{from: 30, src: 'episode/hook.wav', gain: .4, durationInFrames: 12}],
});
function tree(plan, frame, withSfx = true) {
  currentFrame = frame;
  const nodes = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node === null || node === undefined || typeof node !== 'object') return;
    if (typeof node.type === 'function') return visit(node.type(node.props));
    nodes.push(node);
    visit(node.props?.children);
  }
  visit(AiCostProfit20261023({plan, withSfx, mode: 'preview'}));
  return nodes;
}
const plan = fixture();
validateRuntimePlan(plan, 'preview');
assert.throws(() => validateRuntimePlan(plan, 'formal'), /仅允许预览/);
for (const mutation of [
  p => {p.captions.pop();},
  p => {p.inserts.pop();},
  p => {p.voice.playbackRate = 1.1;},
  p => {p.host.sourceDurationInFrames = 9800;},
  p => {p.aiScenes[0].from = 100; p.aiScenes[0].to = 180;},
  p => {p.aiScenes[0].presenter = 'none';},
  p => {p.evidence[0].trimBeforeFrame = -1;},
  p => {p.aiScenes[0].trimBeforeFrame = 1.5;},
  p => {p.aiScenes[0].src = 'https://example.com/remote.mp4';},
]) {
  const invalid = fixture(); mutation(invalid); assert.throws(() => validateRuntimePlan(invalid));
}
assert.deepEqual(mergePresenterWindows([{from: 10, to: 20}, {from: 21, to: 40}, {from: 42, to: 60}]),
  [{from: 10, to: 40}, {from: 42, to: 60}]);

const ai = tree(plan, 5012);
const aiVideo = ai.find(n => n.type === 'OffthreadVideo' && n.props.src === 'episode/A01.mp4');
assert.equal(aiVideo.props.trimBefore, 12);
assert.equal(aiVideo.props.muted, true);
assert.equal(aiVideo.props.style.objectFit, 'contain');
const host = ai.find(n => n.props['data-presenter'] === 'continuous-original-source');
assert.equal(host.props.style.left, LAYOUT.presenter.x);
assert.equal(host.props.style.top, LAYOUT.presenter.y);
assert.equal(tree(plan, 5000).find(n => n.props['data-presenter']).props.style.width, 1920);
assert.ok(ai.some(n => n.props.children === 'AI生成 · 情景示意'));
assert.ok(ai.some(n => n.props.style?.width === 1344 && n.props.style?.height === 756));
assert.ok(LAYOUT.presenter.x + LAYOUT.presenter.width < LAYOUT.evidence.x);
assert.ok(LAYOUT.evidence.y + LAYOUT.evidence.height < LAYOUT.caption.y);
const evidenceVideo = tree(plan, 7012).find(n => n.type === 'OffthreadVideo' && n.props.src === 'episode/evidence.mp4');
assert.equal(evidenceVideo.props.trimBefore, 33);
assert.equal(evidenceVideo.props.style.objectFit, 'contain');

const wavPlan = fixture();
wavPlan.inserts[0].nativeAudioSrc = 'episode/P01_拟音.wav';
const audios = tree(wavPlan, 130).filter(n => n.type === 'Audio');
assert.equal(audios.filter(n => n.props.src === 'episode/P01_拟音.wav').length, 1);
assert.equal(audios.filter(n => n.props.src === 'episode/P1.mp4').length, 0);
assert.deepEqual(tree(wavPlan, 130, false).filter(n => n.type === 'Audio').map(n => n.props.src), ['episode/voice.wav']);
assert.equal(LAYOUT.speakerWords.rowHeight * 3 + LAYOUT.speakerWords.rowGap * 2, LAYOUT.speakerWords.maxHeight);
assert.ok(LAYOUT.speakerWords.maxHeight <= 360);
const tail = fixture(); tail.host.sourceDurationInFrames = 9863;
validateRuntimePlan(tail);
assert.equal(tree(tail, 9862).filter(n => n.type === 'Freeze').length, 0);
assert.deepEqual(tree(tail, 9863).filter(n => n.type === 'Freeze').map(n => n.props.frame), [9862]);

const runtimeFile = path.join(__dirname, 'runtime-plan.json');
const runtimeExists = fs.existsSync(runtimeFile);
if (runtimeExists) validateRuntimePlan(JSON.parse(fs.readFileSync(runtimeFile, 'utf8')));
console.log(JSON.stringify({result: '本期局部组件契约检查通过', actualRuntimeChecked: runtimeExists,
  checked: ['164条实录字幕', '11镜齐全', 'AI独立视窗', '真实素材入点', '左下真人与12帧过渡', '字幕区独立', '拟音单轨选择', '最多1帧补尾', '拒绝正式模式'],
  renderExecuted: false, mediaAcceptancePerformed: false}, null, 2));
