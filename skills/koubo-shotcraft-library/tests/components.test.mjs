/**
 * 运行：node --test skills/koubo-shotcraft-library/tests/components.test.mjs
 * 仅使用现有 remotion/node_modules，在内存中编译和 SSR，不安装依赖、不写构建产物。
 * 中文布局检查覆盖文字保真、折行容量和声明尺寸，不代替真实字体的浏览器像素验收。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(new URL('../../../remotion/package.json', import.meta.url));
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const componentPath = fileURLToPath(new URL('../assets/ShotcraftEffects.tsx', import.meta.url));
const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const source = readFileSync(componentPath, 'utf8');
const output = ts.transpileModule(source, {
  fileName: componentPath,
  reportDiagnostics: true,
  compilerOptions: {
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
assert.equal(output.diagnostics?.length ?? 0, 0, '组件必须能够内存编译');
const module = { exports: {} };
vm.runInNewContext(output.outputText, {
  module,
  exports: module.exports,
  require: (name) => {
    assert.equal(name, 'react', '组件运行时不得增加其他依赖');
    return React;
  },
}, { filename: componentPath, timeout: 5000 });
const effects = module.exports;
const defaults = { frame: 90, fps: 30, durationInFrames: 180 };
const originalChild = React.createElement('div', { 'data-original-card': 'retained' }, '原始图卡正文');
const samples = {
  MarkerUnderline: { before: '保留', keyword: '真实证据', after: '再强调' },
  KeywordReveal: { items: [
    { text: '原始材料', atFrame: 0 },
    { text: '完整来源', atFrame: 24 },
    { text: '真实验证', atFrame: 52 },
  ] },
  EvidenceScan: { width: 960, height: 540, rect: { x: 120, y: 100, width: 320, height: 200 }, label: '关键段落' },
  LineCarry: { fromLabel: '原始材料', toLabel: '核对结论' },
  PaperTapePin: { children: originalChild },
};

const propsFor = (name, overrides = {}) => ({ ...samples[name], ...defaults, ...overrides });
const tree = (name, overrides) => effects[name](propsFor(name, overrides));
const markup = (name, overrides) => renderToStaticMarkup(React.createElement(effects[name], propsFor(name, overrides)));
const elements = (node) => React.Children.toArray(node.props.children).filter(React.isValidElement);
const descendants = (node) => [node, ...elements(node).flatMap(descendants)];
function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props.children);
}
function layoutOf(node) {
  const { visibility: _visibility, ...layout } = node.props.style;
  return layout;
}
function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}：${actual} / ${expected}`);
}

test('组件严格类型检查及运行时依赖清单', () => {
  const program = ts.createProgram([componentPath], {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    paths: { react: [path.join(projectRoot, 'remotion/node_modules/@types/react/index.d.ts')] },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => projectRoot,
    getCanonicalFileName: (name) => name,
    getNewLine: () => '\n',
  }));
  const imports = program.getSourceFile(componentPath).statements
    .filter(ts.isImportDeclaration).map((statement) => statement.moduleSpecifier.text);
  assert.deepEqual(imports, ['react']);
  for (const name of Object.keys(samples)) assert.equal(typeof effects[name], 'function');
  assert.equal(effects.SHOTCRAFT_DEFAULTS.minimumFontSize, 36);
});

for (const name of Object.keys(samples)) {
  test(`${name}：245 组跨帧确定性、时间边界与外盒声明尺寸`, () => {
    for (const fps of [24, 25, 29.97, 30, 60]) {
      for (const durationInFrames of [1, 2, 10, 30, 90, 180, 360]) {
        const layout = layoutOf(tree(name, { fps, durationInFrames, frame: 0 }));
        for (const frame of [-1, 0, 1, durationInFrames / 3, durationInFrames - 1, durationInFrames, durationInFrames + 1]) {
          const input = { fps, durationInFrames, frame };
          const rendered = markup(name, input);
          markup(name, { ...input, frame: durationInFrames - 1 });
          assert.equal(markup(name, input), rendered, '渲染顺序不能改变结果');
          assert.doesNotMatch(rendered, /NaN|Infinity|(?:animation|transition):/);
          assert.doesNotMatch(rendered, /<(?:audio|video|iframe|script)\b/);
          const root = tree(name, input);
          const expected = frame < 0 || frame >= durationInFrames ? 'hidden' : 'visible';
          assert.equal(root.props.style.visibility, expected);
          assert.equal(rendered.includes('visibility:hidden'), expected === 'hidden');
          assert.deepEqual(layoutOf(root), layout, '外盒尺寸与排版声明不得随帧变化');
          assert.equal(root.props.style.letterSpacing, 0);
          if (name === 'PaperTapePin') {
            assert.strictEqual(elements(root)[0].props.children, originalChild, '原始图卡节点不得克隆或替换');
            assert.match(rendered, /data-original-card="retained"/);
          }
        }
      }
    }
  });

  test(`${name}：非法时间输入必须抛错`, () => {
    for (const frame of [NaN, Infinity, -Infinity]) assert.throws(() => markup(name, { frame }), /frame/);
    for (const fps of [0, -1, NaN, Infinity]) assert.throws(() => markup(name, { fps }), /fps/);
    for (const durationInFrames of [0, -1, 1.5, NaN, Infinity]) {
      assert.throws(() => markup(name, { durationInFrames }), /durationInFrames/);
    }
  });
}

test('马克笔：标题落定后再划线，最终状态保持且帧率换算一致', () => {
  const line = (frame, fps = 30) => descendants(tree('MarkerUnderline', { frame, fps })).find((node) => node.type === 'svg');
  assert.equal(elements(tree('MarkerUnderline', { frame: 22 }))[0].props.style.transform, 'translateY(0px)');
  assert.equal(line(32).props.style.clipPath, 'inset(0 100% 0 0)');
  assert.equal(line(42).props.style.clipPath, 'inset(0 0% 0 0)');
  assert.notEqual(markup('MarkerUnderline', { frame: 20 }), markup('MarkerUnderline', { frame: 42 }));
  assert.equal(markup('MarkerUnderline', { frame: 60 }), markup('MarkerUnderline', { frame: 179 }));
  assert.equal(line(42).props.style.clipPath, line(84, 60).props.style.clipPath);
});

test('逐项呈现：真实局部帧起点、末帧与窗外项目不互相挪动', () => {
  const rowsAt = (frame, items = samples.KeywordReveal.items) => elements(elements(tree('KeywordReveal', { frame, items }))[0]);
  closeTo(rowsAt(23)[1].props.style.opacity, 0, '未到起点');
  closeTo(rowsAt(24)[1].props.style.opacity, 0, '起点首帧');
  assert.ok(rowsAt(30)[1].props.style.opacity > 0);
  const late = [{ text: '末帧出现', atFrame: 179 }, { text: '窗外不出现', atFrame: 180 }];
  assert.equal(rowsAt(179, late)[0].props.style.opacity, 1);
  assert.equal(rowsAt(179, late)[1].props.style.opacity, 0);
  assert.equal(elements(tree('KeywordReveal', { frame: 0 }))[0].props.style.transform, 'translateY(16px)');
  assert.equal(elements(tree('KeywordReveal', { frame: 179 }))[0].props.style.transform, 'translateY(-16px)');
  for (const atFrame of [-1, NaN, Infinity]) {
    assert.throws(() => markup('KeywordReveal', { items: [{ text: '原始文字', atFrame }] }), /atFrame/);
  }
});

test('证据扫描：扫描线越过矩形下缘后才收框，文字随后出现', () => {
  const { height, rect } = samples.EvidenceScan;
  const margin = height / 9;
  const trigger = (0.06 + (rect.y + rect.height + margin) / (height + margin * 2) * 0.6) * 137;
  const before = elements(tree('EvidenceScan', { frame: trigger - 0.1 }));
  const after = elements(tree('EvidenceScan', { frame: trigger + 1 }));
  assert.equal(before[0].props.style.opacity, 0);
  assert.ok(after[0].props.style.opacity > 0);
  assert.equal(after[2].props.style.opacity, 0, '不能先于收框标注');
  assert.ok(elements(tree('EvidenceScan', { frame: trigger + 0.05 * 137 + 1 }))[2].props.style.opacity > 0);
  const settled = elements(tree('EvidenceScan', { frame: 137 }));
  assert.equal(settled[0].props.style.transform, 'scale(1)');
  for (const [key, value] of Object.entries(rect)) {
    assert.equal(settled[0].props.style[{ x: 'left', y: 'top' }[key] ?? key], value);
  }
});

test('证据扫描：越界、非有限值和无效尺寸必须拒绝，贴边矩形允许', () => {
  const valid = samples.EvidenceScan.rect;
  const invalid = [
    { ...valid, x: -1 }, { ...valid, y: -1 },
    { ...valid, x: 960 - valid.width + 1 }, { ...valid, y: 540 - valid.height + 1 },
    { ...valid, width: 0 }, { ...valid, height: -1 },
    ...['x', 'y', 'width', 'height'].flatMap((key) => [NaN, Infinity, -Infinity].map((value) => ({ ...valid, [key]: value }))),
  ];
  for (const rect of invalid) assert.throws(() => markup('EvidenceScan', { rect }), /矩形|rect\./);
  for (const key of ['width', 'height']) {
    for (const value of [0, -1, NaN, Infinity]) assert.throws(() => markup('EvidenceScan', { [key]: value }), new RegExp(key));
  }
  assert.doesNotThrow(() => markup('EvidenceScan', { rect: { x: 0, y: 0, width: 960, height: 540 }, label: '' }));
  assert.doesNotThrow(() => markup('EvidenceScan', { rect: { x: 640, y: 340, width: 320, height: 200 } }));
  assert.throws(() => markup('EvidenceScan', { width: 80, height: 80, rect: { x: 0, y: 0, width: 40, height: 40 }, label: '中文标注过长时必须拒绝而不是截断' }), /容纳/);
});

test('线条接力：围框后再显示终点标签，笔头卸载且保持最终状态', () => {
  const destination = (frame) => elements(tree('LineCarry', { frame })).at(-1);
  assert.equal(destination(111).props.style.opacity, 0);
  assert.equal(destination(112).props.style.opacity, 0);
  assert.equal(destination(124).props.style.opacity, 1);
  assert.ok(descendants(tree('LineCarry', { frame: 117 })).some((node) => node.type === 'circle'));
  assert.ok(!descendants(tree('LineCarry', { frame: 118 })).some((node) => node.type === 'circle'));
  assert.equal(markup('LineCarry', { frame: 124 }), markup('LineCarry', { frame: 179 }));
});

test('纸胶带：落帧压扁跨帧率可见，拍定后外壳停止但原图卡始终挂载', () => {
  for (const fps of [24, 25, 29.97, 30, 60]) {
    const durationInFrames = Math.ceil(6 * fps);
    for (const [index, land] of [[1, 58], [2, 82]]) {
      const frame = Math.ceil(land * fps / 30 - 1e-9);
      const tape = elements(tree('PaperTapePin', { frame, fps, durationInFrames }))[index];
      assert.match(tape.props.style.transform, /scaleY\(0\.72\)/);
    }
  }
  assert.equal(elements(tree('PaperTapePin', { frame: 86 }))[0].props.style.transform, 'translateY(2px) rotate(0deg)');
  assert.equal(markup('PaperTapePin', { frame: 86 }), markup('PaperTapePin', { frame: 179 }));
  for (const durationInFrames of [1, 2, 10]) {
    const root = tree('PaperTapePin', { frame: durationInFrames - 1, durationInFrames });
    assert.strictEqual(elements(root)[0].props.children, originalChild);
    for (const tape of elements(root).slice(1)) assert.match(tape.props.style.transform, /scaleY\(1\)/);
  }
});

const longChinese = '依据原始材料逐项核对中文内容，不替换原声、不省略证据，也不把推测写成已经确认的结论。'.repeat(3);

test('长中文：马克笔与逐项文字完整保留，允许换行而非省略或缩小字号', () => {
  const marker = tree('MarkerUnderline', { before: '前文', keyword: longChinese, after: '后文', fontSize: 12 });
  assert.equal(textOf(marker), `前文${longChinese}后文`);
  assert.equal(marker.props.style.fontSize, 36);
  assert.equal(marker.props.style.overflowWrap, 'anywhere');
  const keyword = descendants(marker).find((node) => node.type === 'span');
  assert.equal(keyword.props.style.maxWidth, '100%');
  const items = [{ text: longChinese, atFrame: 0 }, { text: longChinese, atFrame: 40 }];
  const reveal = tree('KeywordReveal', { items, fontSize: 20 });
  assert.equal(textOf(reveal), longChinese.repeat(2));
  assert.equal(reveal.props.style.fontSize, 36);
  assert.equal(reveal.props.style.overflowWrap, 'anywhere');
  assert.equal(elements(elements(reveal)[0]).length, 2, '每项保留稳定的完整行槽');
  for (const name of ['MarkerUnderline', 'KeywordReveal']) {
    const overrides = name === 'MarkerUnderline' ? { keyword: longChinese } : { items };
    assert.doesNotMatch(markup(name, overrides), /text-overflow:ellipsis|line-clamp|white-space:nowrap/);
  }
});

test('长中文：证据标注折行不丢字，声明的标签矩形位于画面内', () => {
  const overrides = { width: 640, height: 900, rect: { x: 80, y: 120, width: 400, height: 160 }, label: longChinese };
  const root = tree('EvidenceScan', overrides);
  const label = elements(root).at(-1);
  const style = label.props.style;
  const lines = textOf(label).split('\n');
  assert.equal(lines.join(''), longChinese);
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(Array.from(line).length * style.fontSize <= style.width - 24);
  assert.equal(style.height, lines.length * parseFloat(style.lineHeight) + 16);
  assert.ok(style.left >= 0 && style.left + style.width <= overrides.width);
  assert.ok(style.top >= 0 && style.top + style.height <= overrides.height);
  assert.equal(style.whiteSpace, 'pre-wrap');
  assert.equal(style.fontSize, 36);
  assert.doesNotThrow(() => markup('EvidenceScan', overrides));
});

test('长中文：接力两端折行容量和高度匹配，图卡正文不被组件改写', () => {
  const overrides = { width: 600, fromLabel: longChinese, toLabel: longChinese + '𠮷' };
  const root = tree('LineCarry', overrides);
  const labels = elements(root).filter((node) => node.type === 'div');
  for (const [index, label] of labels.entries()) {
    const lines = textOf(label).split('\n');
    assert.equal(lines.join(''), index === 0 ? overrides.fromLabel : overrides.toLabel);
    for (const line of lines) assert.ok(Array.from(line).length * label.props.style.fontSize <= label.props.style.width);
    assert.ok(lines.length * parseFloat(label.props.style.lineHeight) <= label.props.style.height);
    assert.ok(label.props.style.top + label.props.style.height <= root.props.style.height);
  }
  const child = React.createElement('div', { style: { width: '100%', height: '100%', overflowWrap: 'anywhere' } }, longChinese);
  for (const frame of [-1, 0, 58, 86, 179, 180]) {
    const paper = tree('PaperTapePin', { children: child, frame });
    assert.equal(textOf(paper), longChinese);
    assert.strictEqual(elements(paper)[0].props.children, child);
    assert.equal(paper.props.style.width, 640);
    assert.equal(paper.props.style.height, 488);
    assert.equal(elements(paper)[0].props.style.fontSize, 36);
    assert.ok(markup('PaperTapePin', { children: child, frame }).includes(longChinese));
  }
});
