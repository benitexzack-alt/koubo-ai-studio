import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import Ajv from '../assets/schema-validator-engine.mjs';
import {exportInsertShotsPlan, parseInsertShotsArgs, validateInsertShotsPlan} from '../scripts/insert-shots-plan-core.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = JSON.parse(fs.readFileSync(path.join(skillRoot, 'templates/insert-shots.plan.example.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(skillRoot, 'templates/insert-shots.plan.schema.json'), 'utf8'));
const fresh = () => structuredClone(example);
const validate = (change) => {
  const plan = fresh();
  change(plan, plan.shots[0]);
  return validateInsertShotsPlan(plan);
};
const temporary = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'insert-shots-plan-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const repoRoot = path.join(root, 'repo');
  fs.mkdirSync(repoRoot);
  const inputPath = path.join(root, 'input.json');
  fs.writeFileSync(inputPath, `${JSON.stringify(fresh(), null, 4)}\n`);
  return {root, repoRoot, inputPath};
};

test('纸艺示例与空镜头方案均通过结构检查，但不声称语义核验通过', () => {
  assert.equal(validateInsertShotsPlan(example).ok, true);
  const result = validate((plan) => {plan.shots = [];});
  assert.equal(result.ok, true);
  assert.equal(result.validationScope, 'structure-only');
  assert.match(result.note, /实录逐词对齐/);
});

test('交接 JSON Schema 可编译并接受示例、拒绝未知字段和非法像素主题', () => {
  const check = new Ajv({allErrors: true, strict: false}).compile(schema);
  assert.equal(check(example), true);
  const invalid = fresh();
  invalid.shots[0].style = 'pixel';
  assert.equal(check(invalid), false);
  invalid.shots[0].theme = 'noir';
  assert.equal(check(invalid), true);
  invalid.shots[0].firstFramePrompt = '旧字段';
  assert.equal(check(invalid), false);
});

for (const theme of ['noir', 'blocks', 'mono']) {
  test(`允许像素主题 ${theme}`, () => assert.equal(validate((plan, shot) => {shot.style = 'pixel'; shot.theme = theme;}).ok, true));
}

test('节点是空间顺序，因此标签出现时间可以不递增', () => {
  assert.equal(validate((plan, shot) => {shot.nodes[0].enterSec = 5.5; shot.nodes[3].enterSec = 0;}).ok, true);
});

test('七秒镜头最后一帧的标签时点有效，但 6.99 秒向上取帧后已不可见', () => {
  assert.equal(validate((plan, shot) => {shot.nodes[0].enterSec = 209 / 30;}).ok, true);
  const result = validate((plan, shot) => {shot.nodes[0].enterSec = 6.99;});
  assert.equal(result.ok, false);
  assert.match(result.errors.find((error) => error.path === '$.shots[0].nodes[0].enterSec').message, /至少剩一帧可见/);
});

test('允许超过八秒的镜头与不足两秒的整数帧镜头，不机械设定镜头数量', () => {
  assert.equal(validate((plan, shot) => {shot.duration = 15;}).ok, true);
  assert.equal(validate((plan, shot) => {shot.duration = 1 / 30; shot.nodes.forEach((node) => {node.enterSec = 0;});}).ok, true);
});

for (const [name, change] of [
  ['顶层未知字段', (plan) => {plan.firstFramePrompt = '旧路线';}],
  ['画布未知字段', (plan) => {plan.canvas.aspectRatio = '16:9';}],
  ['镜头旧首帧字段', (plan, shot) => {shot.firstFramePrompt = '旧路线';}],
  ['镜头旧 RunningHub 字段', (plan, shot) => {shot.runninghub = {}; }],
  ['节点未知字段', (plan, shot) => {shot.nodes[0].prompt = '旧路线';}],
  ['缺少必填字段', (plan, shot) => {delete shot.spokenLine;}],
  ['非固定画布', (plan) => {plan.canvas.width = 1080;}],
  ['非固定帧率', (plan) => {plan.canvas.fps = 25;}],
  ['非法风格', (plan, shot) => {shot.style = 'generated-video';}],
  ['非法像素主题', (plan, shot) => {shot.style = 'pixel';}],
  ['空纸艺色调', (plan, shot) => {shot.theme = '  ';}],
  ['节点少于三项', (plan, shot) => {shot.nodes.length = 2;}],
  ['节点超过五项', (plan, shot) => {shot.nodes.push(...structuredClone(shot.nodes));}],
  ['标签超过六字符', (plan, shot) => {shot.nodes[0].label = '一二三四五六七';}],
  ['标签没有中文', (plan, shot) => {shot.nodes[0].label = 'TIME';}],
  ['标签为空', (plan, shot) => {shot.nodes[0].label = ''; }],
  ['节点出现时间为负', (plan, shot) => {shot.nodes[0].enterSec = -1;}],
  ['节点出现时间等于结尾', (plan, shot) => {shot.nodes[0].enterSec = shot.duration;}],
  ['节点出现时间无穷大', (plan, shot) => {shot.nodes[0].enterSec = Infinity;}],
  ['节点出现时间非数', (plan, shot) => {shot.nodes[0].enterSec = NaN;}],
  ['时长为零', (plan, shot) => {shot.duration = 0;}],
  ['时长无穷大', (plan, shot) => {shot.duration = Infinity;}],
  ['时长非整数帧', (plan, shot) => {shot.duration = 7.01;}],
  ['时长大于安全整数范围', (plan, shot) => {shot.duration = 1e100;}],
  ['时间码格式错误', (plan, shot) => {shot.insertAt = '0:12.4';}],
  ['时间码秒数越界', (plan, shot) => {shot.insertAt = '00:00:60.000';}],
  ['时间码分钟越界', (plan, shot) => {shot.insertAt = '00:60:00.000';}],
  ['avoid 不是数组', (plan, shot) => {shot.avoid = '金币';}],
  ['avoid 存在空项', (plan, shot) => {shot.avoid = [''];}],
]) {
  test(`拒绝${name}`, () => assert.equal(validate(change).ok, false));
}

test('标签按 Unicode 字符计数，六个补充汉字不被误算为十二个', () => {
  assert.equal(validate((plan, shot) => {shot.nodes[0].label = '𠮷𠮷𠮷𠮷𠮷𠮷';}).ok, true);
});

for (const unsafe of ['../escape', '..', '.', '/tmp/escape', 'a\\b', 'a\u0000b', 'CON', 'item.', ' item']) {
  test(`拒绝不安全的期号和镜号 ${JSON.stringify(unsafe)}`, () => {
    assert.equal(validate((plan) => {plan.episode = unsafe;}).ok, false);
    assert.equal(validate((plan, shot) => {shot.shotId = unsafe;}).ok, false);
  });
}

test('相邻镜头允许无缝拼接', () => {
  assert.equal(validate((plan, shot) => {plan.shots.push({...structuredClone(shot), shotId: 'P02', insertAt: '00:00:19.400'});}).ok, true);
});

test('拒绝重复镜号及大小写冲突', () => {
  for (const shotId of ['P01', 'p01']) {
    assert.equal(validate((plan, shot) => {plan.shots.push({...structuredClone(shot), shotId, insertAt: '00:00:20.000'});}).ok, false);
  }
});

test('拒绝镜头重叠与倒序', () => {
  for (const insertAt of ['00:00:19.399', '00:00:01.000']) {
    assert.equal(validate((plan, shot) => {plan.shots.push({...structuredClone(shot), shotId: 'P02', insertAt});}).ok, false);
  }
});

test('导出只写规定目录中的一份 JSON，并逐字节保留原稿', (t) => {
  const {repoRoot, inputPath} = temporary(t);
  const result = exportInsertShotsPlan({repoRoot, inputPath});
  const expected = path.join(fs.realpathSync(repoRoot), 'edit/generated-video', example.episode, 'insert-shots.plan.json');
  assert.equal(result.outputPath, expected);
  assert.equal(result.validationScope, 'structure-only');
  assert.deepEqual(fs.readFileSync(expected), fs.readFileSync(inputPath));
  assert.deepEqual(JSON.parse(fs.readFileSync(expected, 'utf8')), example);
  assert.deepEqual(fs.readdirSync(path.dirname(expected)), ['insert-shots.plan.json']);
});

test('拒绝覆盖已经存在的方案，保留原文件', (t) => {
  const {repoRoot, inputPath} = temporary(t);
  const result = exportInsertShotsPlan({repoRoot, inputPath});
  fs.writeFileSync(result.outputPath, '既有内容');
  assert.throws(() => exportInsertShotsPlan({repoRoot, inputPath}), /拒绝覆盖/);
  assert.equal(fs.readFileSync(result.outputPath, 'utf8'), '既有内容');
});

for (const depth of [0, 1, 2]) {
  test(`拒绝输出目录第 ${depth + 1} 层符号链接逃逸`, (t) => {
    const {root, repoRoot, inputPath} = temporary(t);
    const outside = path.join(root, 'outside');
    fs.mkdirSync(outside);
    const parts = ['edit', 'generated-video', example.episode];
    const parent = path.join(repoRoot, ...parts.slice(0, depth));
    fs.mkdirSync(parent, {recursive: true});
    fs.symlinkSync(outside, path.join(parent, parts[depth]), 'dir');
    assert.throws(() => exportInsertShotsPlan({repoRoot, inputPath}), /符号链接/);
    assert.deepEqual(fs.readdirSync(outside), []);
  });
}

test('拒绝最终输出文件的符号链接，保留链接目标', (t) => {
  const {root, repoRoot, inputPath} = temporary(t);
  const destination = path.join(repoRoot, 'edit/generated-video', example.episode);
  fs.mkdirSync(destination, {recursive: true});
  const outside = path.join(root, 'original.json');
  fs.writeFileSync(outside, '不许覆盖');
  fs.symlinkSync(outside, path.join(destination, 'insert-shots.plan.json'));
  assert.throws(() => exportInsertShotsPlan({repoRoot, inputPath}), /拒绝覆盖/);
  assert.equal(fs.readFileSync(outside, 'utf8'), '不许覆盖');
});

test('非法方案在创建任何输出目录前失败', (t) => {
  const {repoRoot, inputPath} = temporary(t);
  const plan = fresh();
  plan.episode = '../escape';
  fs.writeFileSync(inputPath, JSON.stringify(plan));
  assert.throws(() => exportInsertShotsPlan({repoRoot, inputPath}), /校验未通过/);
  assert.deepEqual(fs.readdirSync(repoRoot), []);
});

test('拒绝无效 UTF-8 输入，防止替换字符悄悄改变原稿', (t) => {
  const {repoRoot, inputPath} = temporary(t);
  fs.writeFileSync(inputPath, Buffer.from([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x3a, 0x30, 0x7d]));
  assert.throws(() => exportInsertShotsPlan({repoRoot, inputPath}));
  assert.deepEqual(fs.readdirSync(repoRoot), []);
});

test('严格解析 CLI 参数，拒绝未知参数、重复参数和缺值', () => {
  for (const args of [[], ['--output', 'x'], ['--input'], ['--input', 'x', '--input', 'y'], ['--input', '--repo-root']]) {
    assert.throws(() => parseInsertShotsArgs(args));
  }
  assert.deepEqual(parseInsertShotsArgs(['--input', 'x', '--repo-root', '/tmp']), {input: 'x', 'repo-root': '/tmp'});
});

test('两条 CLI 在临时目录端到端校验和导出，不渲染也不写旁车文件', (t) => {
  const {repoRoot, inputPath} = temporary(t);
  for (const script of ['validate-insert-shots-plan.mjs', 'export-insert-shots-plan.mjs']) {
    const result = spawnSync(process.execPath, [path.join(skillRoot, 'scripts', script), '--input', inputPath, '--repo-root', repoRoot], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).validationScope, 'structure-only');
  }
  const duplicate = spawnSync(process.execPath, [path.join(skillRoot, 'scripts/export-insert-shots-plan.mjs'), '--input', inputPath, '--repo-root', repoRoot], {encoding: 'utf8'});
  assert.equal(duplicate.status, 1);
  assert.match(JSON.parse(duplicate.stderr).error, /拒绝覆盖/);
});
