// 只执行本期纯布局函数，不创建浏览器、媒体树或渲染。
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '../../../..');
const dir = path.join(root, 'remotion/src/musk-grok-business-ai-20261016');
const ts = require(path.join(root, 'remotion/node_modules/typescript'));
const runtimePath = path.join(dir, 'runtime.ts');
const runtime = {exports: {}};
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    esModuleInterop: true, resolveJsonModule: true, jsx: ts.JsxEmit.ReactJSX},
}).outputText;
new Function('require', 'module', 'exports', compile(runtimePath))(
  createRequire(runtimePath), runtime, runtime.exports);
const composition = {exports: {}};
const compositionPath = path.join(dir, 'Composition.tsx');
new Function('require', 'module', 'exports', compile(compositionPath))(
  id => id === './runtime' ? runtime.exports : {}, composition, composition.exports);
const plan = JSON.parse(fs.readFileSync(path.join(root,
  'edit/20261016_musk_grok_business_ai/08_字幕校正R3/runtime-plan.r3.json')));
const {eventFrame, progress, smooth} = runtime.exports;
const end = eventFrame(plan, 'strongest-model');
const start = end - 14;
const skew = Math.abs(Math.tan(-3 * Math.PI / 180));
const gap = (a, b) => Math.max(b.left - a.right, a.left - b.right,
  b.top - a.bottom, a.top - b.bottom);
const frames = [];
for (let frame = start; frame <= end; frame++) {
  const rects = [0, 1, 2, 3].map(index => {
    assert.ok(frame >= eventFrame(plan, `task-${index}`) + 7, '四卡原入场已落定，缩放为1');
    const layout = composition.exports.taskTagLayout(frame, end, index);
    // CSS skewX(-3deg)，变换原点0 50%，包围盒比逻辑宽度每侧多height*tan(3°)/2。
    const edge = layout.height * skew / 2;
    const rect = {index, ...layout, left: layout.left - edge,
      right: layout.left + layout.width + edge,
      bottom: layout.top + layout.height};
    assert.ok(rect.left >= 0 && rect.right <= 620 && rect.top >= 0 && rect.bottom <= 352,
      `frame ${frame}: 四卡在容器和底边线内`);
    assert.ok(layout.width - 5 >= 4 * layout.fontSize,
      `frame ${frame}: 最长四字标签在扣除5px左边线后仍有字宽`);
    return rect;
  });
  const pairs = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const separation = gap(rects[i], rects[j]);
    assert.ok(separation >= 0, `frame ${frame}: 卡${i}与卡${j}交叠`);
    pairs.push({pair: [i, j], separationPixels: separation});
  }
  const oldTitleOpacity = 1 - smooth(progress(frame, start, 8));
  if (oldTitleOpacity > 0) for (const rect of rects) {
    assert.ok(gap(rect, {left: 22, right: 598, top: 22, bottom: 60.4}) >= 0,
      `frame ${frame}: 与旧否定标题交叠`);
  }
  if (frame === end) for (const rect of rects) {
    assert.ok(gap(rect, {left: 22, right: 598, top: 104, bottom: 216}) >= 0,
      '收拢完成后给新否定句保留独立空间');
  }
  frames.push({frame, seconds: frame / plan.fps, oldTitleOpacity, rects, pairs});
}
const result = {
  status: '通过', fromFrame: start, settledFrame: end, durationFrames: 14,
  sampleCountIncludingEndpoints: frames.length,
  path: '4帧原位收小→4帧上下两行分别横移→6帧上提到单行；旧否定标题前8帧退出',
  minPairSeparationPixels: Math.min(...frames.flatMap(frame => frame.pairs.map(pair => pair.separationPixels))),
  compositionSha256: crypto.createHash('sha256').update(fs.readFileSync(compositionPath)).digest('hex'),
  limitations: ['只验证源逻辑几何及保守倾斜包围盒，未渲染或检查成片视觉。',
    '字宽按四个全角汉字和当前字号估算；未以字体栅格化冒充真实像素检查。'],
  renderExecuted: false, frames,
};
fs.writeFileSync(path.join(__dirname, '14帧几何复核.v1.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({...result, frames: undefined}, null, 2));
