#!/usr/bin/env node
import assert from 'node:assert/strict';
import {derivePaperProjection, validatePaperProjectionContract, renderProjectionConstraints} from '../scripts/paper-projection-contract.mjs';

const beat = {id: 'B07'};
const fixture = () => ({
  objectGroups: ['G1', 'G2', 'G3', 'G4'].map((id) => ({id, name: id})),
  layoutContract: {
    contentSafeRect: {x: 0.04, y: 0.12, width: 0.92, height: 0.64},
    subtitleReservedRect: {x: 0.04, y: 0.81, width: 0.92, height: 0.17},
    paperLabelSurfaceBoxes: [{nodeId: 'N1', box: {x: 0.1, y: 0.2, width: 0.1, height: 0.04}}],
  },
  motionContract: {
    parts: [{id: 'pages', name: '回答纸页组合', kind: 'blank-part', groupId: 'G1'},
      {id: 'lever', name: '后侧控制杆', kind: 'blank-part', groupId: 'G3'}],
    initialLocations: [{partId: 'pages', groupId: 'G1'}, {partId: 'lever', groupId: 'G3'}],
    actions: [
      {id: 'A1', partId: 'pages', operation: 'slide', fromGroupId: 'G1', toGroupId: 'G2', sweptRect: {x: 0.1, y: 0.46, width: 0.32, height: 0.12}},
      {id: 'A2', partId: 'pages', operation: 'slide', fromGroupId: 'G2', toGroupId: 'G3', sweptRect: {x: 0.33, y: 0.46, width: 0.31, height: 0.12}},
      {id: 'A3', partId: 'lever', operation: 'rotate-rigid', fromGroupId: 'G3', toGroupId: 'G3', sweptRect: {x: 0.55, y: 0.34, width: 0.14, height: 0.08}},
      {id: 'A4', partId: 'pages', operation: 'slide', fromGroupId: 'G3', toGroupId: 'G4', sweptRect: {x: 0.56, y: 0.46, width: 0.33, height: 0.12}},
    ],
    physicalContract: {
      schemaVersion: 'koubo-paper-physical-contract/v1', coordinateSystem: 'tabletop-mm', minimumClearanceMm: 2,
      inventory: [
        {partId: 'pages', quantity: 1, unit: 'rigid-assembly', envelopeMm: {width: 50, depth: 20, height: 4}},
        {partId: 'lever', quantity: 1, unit: 'rigid-assembly', envelopeMm: {width: 20, depth: 20, height: 15}},
      ],
      stations: [{groupId: 'G1', initialPartIds: ['pages']}, {groupId: 'G2', initialPartIds: []},
        {groupId: 'G3', initialPartIds: ['lever']}, {groupId: 'G4', initialPartIds: []}],
      docks: [80, 200, 320, 440].map((xMm, i) => ({id: `D${i + 1}`, groupId: `G${i + 1}`, xMm, yMm: 50,
        supportHeightMm: 10, openingWidthMm: 24, openingHeightMm: 6})),
      supports: [{id: 'table', xMm: 50, yMm: 35, widthMm: 420, depthMm: 30, topHeightMm: 10}],
      obstacles: [{id: 'lever-full-rotation-envelope', xMm: 310, yMm: -10, zMm: 10, widthMm: 20, depthMm: 20, heightMm: 15}],
      transfers: [{actionId: 'A1', fromDockId: 'D1', toDockId: 'D2', supportIds: ['table']},
        {actionId: 'A2', fromDockId: 'D2', toDockId: 'D3', supportIds: ['table']},
        {actionId: 'A4', fromDockId: 'D3', toDockId: 'D4', supportIds: ['table']}],
    },
    projectionContract: {
      schemaVersion: 'koubo-paper-projection/v1', type: 'axis-aligned-affine-reference', frame: {width: 1920, height: 1080},
      xScale: 3.4, yScale: 2.8, zScale: 2.6, originX: 76, originY: 400, paddingPx: 4,
      localActionEnvelopes: [{actionId: 'A3', obstacleId: 'lever-full-rotation-envelope'}],
    },
  },
});
const projection = (scene) => scene.motionContract.projectionContract;
const physical = (scene) => scene.motionContract.physicalContract;
const check = (scene) => validatePaperProjectionContract({scene, beat});
const backfill = (scene) => {
  const result = derivePaperProjection(scene);
  assert.equal(result.ok, true, result.errors.join('|'));
  for (const {actionId, rect} of result.actionRects) scene.motionContract.actions.find((a) => a.id === actionId).sweptRect = {...rect};
  return scene;
};
const near = (a, b) => assert(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
let tests = 0;
const test = (name, run) => {try {run(); tests++;} catch (error) {error.message = `${name}: ${error.message}`; throw error;}};
const rejectDerive = (name, change, code) => test(name, () => {
  const scene = fixture(); change(projection(scene), physical(scene), scene);
  const result = derivePaperProjection(scene);
  assert.equal(result.ok, false);
  assert(result.errors.length > 0);
  assert(result.errors.every((e) => e.startsWith('PAPER_PROJECTION_')));
  if (code) assert(result.errors.some((e) => e.startsWith(code)), result.errors.join('|'));
  assert.deepEqual([result.actionRects, result.supportRects, result.obstacleRects], [[], [], []]);
  assert(check(scene).every((e) => e.startsWith('PAPER_PROJECTION_') && e.endsWith(':B07')));
});
const rejectLayout = (name, change, code) => test(name, () => {
  const scene = backfill(fixture()); change(scene);
  const errors = check(scene);
  assert(errors.some((e) => e.startsWith(code)), errors.join('|'));
  assert(errors.every((e) => e.endsWith(':B07')));
});

test('旧 P02 矩形无法通过同一投影联验', () => {
  const scene = fixture();
  assert.equal(derivePaperProjection(scene).ok, true);
  assert(check(scene).some((e) => e.startsWith('PAPER_PROJECTION_ACTION_RECT_MISMATCH')));
});
test('同源推导回填后通过且不改输入', () => {
  const scene = backfill(fixture()); const before = structuredClone(scene);
  assert.deepEqual(check(scene), []);
  const result = derivePaperProjection(scene);
  assert.deepEqual(Object.keys(result).sort(), ['ok', 'errors', 'actionRects', 'supportRects', 'obstacleRects'].sort());
  assert.equal(result.actionRects.length, 4);
  assert.deepEqual(result.supportRects.map((r) => r.supportId), ['table']);
  assert.deepEqual(result.obstacleRects.map((r) => r.obstacleId), ['lever-full-rotation-envelope']);
  renderProjectionConstraints(scene);
  assert.deepEqual(scene, before);
});
test('三个毫米扫掠范围使用同一公式并包含净空及像素外扩', () => {
  const result = derivePaperProjection(fixture());
  for (const [id, left, right] of [['A1', 53, 227], ['A2', 173, 347], ['A4', 293, 467]]) {
    const rect = result.actionRects.find((r) => r.actionId === id).rect;
    near(rect.x, (76 + 3.4 * left - 4) / 1920);
    near(rect.width, (3.4 * (right - left) + 8) / 1920);
    near(rect.y, (400 + 2.8 * 38 - 2.6 * 16 - 4) / 1080);
    near(rect.height, (2.8 * 24 + 2.6 * 6 + 8) / 1080);
  }
});
test('支承只投影顶面，局部动作投影完整三维包络', () => {
  const result = derivePaperProjection(fixture());
  const support = result.supportRects[0].rect;
  near(support.y, (400 + 2.8 * 35 - 2.6 * 10 - 4) / 1080);
  near(support.height, (2.8 * 30 + 8) / 1080);
  const local = result.actionRects.find((r) => r.actionId === 'A3').rect;
  near(local.y, (400 + 2.8 * -10 - 2.6 * 25 - 4) / 1080);
  near(local.height, (2.8 * 20 + 2.6 * 15 + 8) / 1080);
  assert.deepEqual(local, result.obstacleRects[0].rect);
});
test('推导不得读取旧动作矩形或布局', () => {
  const scene = fixture(); const before = derivePaperProjection(scene);
  scene.motionContract.actions.forEach((action) => {delete action.sweptRect;});
  delete scene.layoutContract;
  assert.deepEqual(derivePaperProjection(scene), before);
});
test('不配置不自动宣称投影检查', () => {
  const scene = fixture(); delete scene.motionContract.projectionContract; delete scene.motionContract.physicalContract;
  assert.deepEqual(check(scene), []);
  assert.equal(renderProjectionConstraints(scene), '');
  assert.equal(derivePaperProjection(scene).ok, false);
  assert.deepEqual(derivePaperProjection(scene).errors, ['PAPER_PROJECTION_CONTRACT_REQUIRED']);
  assert.deepEqual(validatePaperProjectionContract({scene: {}, beat}), []);
  assert.equal(renderProjectionConstraints({}), '');
});
for (const field of ['originX', 'originY', 'xScale', 'yScale', 'zScale', 'paddingPx']) {
  rejectLayout(`修改 ${field} 后旧矩形失效`, (s) => {projection(s)[field] += 0.25;}, 'PAPER_PROJECTION_ACTION_RECT_MISMATCH');
}
for (const field of ['width', 'height']) {
  rejectLayout('画幅变化后旧矩形失效', (s) => {projection(s).frame[field] += 100;}, 'PAPER_PROJECTION_ACTION_RECT_MISMATCH');
}
rejectDerive('类型错误', (p) => {p.type = 'perspective';}, 'PAPER_PROJECTION_TYPE_INVALID');
rejectDerive('版本错误', (p) => {p.schemaVersion = 'other';}, 'PAPER_PROJECTION_SCHEMA_INVALID');
for (const value of [null, false, true, [], 'projection', 1]) {
  rejectDerive('配置字段存在但格式非法', (_p, _physical, s) => {s.motionContract.projectionContract = value;});
}
for (const field of ['xScale', 'yScale', 'zScale']) for (const value of [0, -1, NaN, Infinity, -Infinity, '3', null, undefined]) {
  rejectDerive(`${field} 必须有限正数`, (p) => {p[field] = value;});
}
for (const field of ['width', 'height']) for (const value of [0, -1, NaN, Infinity, '1920', null, undefined]) {
  rejectDerive('画幅维度必须有限正数', (p) => {p.frame[field] = value;});
}
for (const field of ['originX', 'originY', 'paddingPx']) for (const value of [NaN, Infinity, -Infinity, '4', null, undefined]) {
  rejectDerive(`${field} 必须有限数`, (p) => {p[field] = value;});
}
rejectDerive('padding 不可为负', (p) => {p.paddingPx = -1;});
test('零 padding 合法', () => {const s = fixture(); projection(s).paddingPx = 0; assert.deepEqual(check(backfill(s)), []);});
for (const value of [null, undefined, [], true]) rejectDerive('frame 坏类型不抛异常', (p) => {p.frame = value;});
for (const value of [null, undefined, {}, true, '[]', [null], [1], [[]], [{}]]) {
  rejectDerive('局部绑定非法数组或坏项不抛异常', (p) => {p.localActionEnvelopes = value;});
}
rejectDerive('局部绑定不能漏', (p) => {p.localActionEnvelopes = [];}, 'PAPER_PROJECTION_LOCAL_COVERAGE_INVALID');
rejectDerive('局部动作只能绑定一次', (p) => {p.localActionEnvelopes.push({...p.localActionEnvelopes[0]});});
rejectDerive('局部动作不能绑定未知 obstacle', (p) => {p.localActionEnvelopes[0].obstacleId = 'unknown';});
rejectDerive('局部绑定不能指向跨组动作', (p) => {p.localActionEnvelopes[0].actionId = 'A1';});
rejectDerive('局部绑定不能指向未知动作', (p) => {p.localActionEnvelopes[0].actionId = 'unknown';});
rejectDerive('不能跳过物理校验', (_p, p) => {p.inventory[0].quantity = 2;}, 'PAPER_PROJECTION_PHYSICAL_INVALID');
rejectDerive('坏物理数组不抛异常', (_p, p) => {p.obstacles = [null];}, 'PAPER_PROJECTION_PHYSICAL_INVALID');
rejectDerive('缺物理合同拒绝', (_p, _physical, s) => {delete s.motionContract.physicalContract;}, 'PAPER_PROJECTION_PHYSICAL_INVALID');
rejectDerive('有限比例导致溢出拒绝', (p) => {p.xScale = Number.MAX_VALUE;}, 'PAPER_PROJECTION_BOUNDS_INVALID');
rejectDerive('有限画幅导致归一化溢出拒绝', (p) => {p.frame.width = Number.MIN_VALUE;}, 'PAPER_PROJECTION_BOUNDS_INVALID');
test('只有局部展开的合同合法且须显式绑定', () => {
  const s = fixture(); s.motionContract.actions = [{id: 'A3', partId: 'lever', operation: 'unfold', fromGroupId: 'G3', toGroupId: 'G3'}];
  physical(s).transfers = []; physical(s).supports = []; physical(s).docks = [];
  assert.deepEqual(check(backfill(s)), []);
});
test('只有跨组动作允许空 localActionEnvelopes', () => {
  const s = fixture(); s.motionContract.actions = s.motionContract.actions.filter((a) => a.id !== 'A3');
  projection(s).localActionEnvelopes = [];
  assert.deepEqual(check(backfill(s)), []);
});
rejectLayout('动作矩形缺失不能通过', (s) => {delete s.motionContract.actions[0].sweptRect;}, 'PAPER_PROJECTION_ACTION_RECT_INVALID');
rejectLayout('动作矩形 NaN 不能通过', (s) => {s.motionContract.actions[0].sweptRect.x = NaN;}, 'PAPER_PROJECTION_ACTION_RECT_INVALID');
test('矩形比较仅容忍归一化数值 epsilon', () => {
  const s = backfill(fixture()); s.motionContract.actions[0].sweptRect.x += 5e-10;
  assert.deepEqual(check(s), []);
  s.motionContract.actions[0].sweptRect.x += 1e-7;
  assert(check(s).some((e) => e.startsWith('PAPER_PROJECTION_ACTION_RECT_MISMATCH')));
});
rejectLayout('完整动作投影侵入标签', (s) => {s.layoutContract.paperLabelSurfaceBoxes[0].box = {...s.motionContract.actions[0].sweptRect};}, 'PAPER_PROJECTION_ACTION_LABEL_OVERLAP');
rejectLayout('局部动作区也须避开标签', (s) => {s.layoutContract.paperLabelSurfaceBoxes[0].box = {...s.motionContract.actions[2].sweptRect};}, 'PAPER_PROJECTION_ACTION_LABEL_OVERLAP');
rejectLayout('动作投影侵入字幕', (s) => {s.layoutContract.subtitleReservedRect = {...s.motionContract.actions[0].sweptRect};}, 'PAPER_PROJECTION_ACTION_SUBTITLE_OVERLAP');
rejectLayout('动作投影超安全区', (s) => {s.layoutContract.contentSafeRect.width = 0.5;}, 'PAPER_PROJECTION_ACTION_UNSAFE');
rejectLayout('不能用缩小旧矩形逃避真实投影遮字', (s) => {
  s.layoutContract.paperLabelSurfaceBoxes[0].box = {...s.motionContract.actions[0].sweptRect};
  s.motionContract.actions[0].sweptRect = {x: 0.05, y: 0.13, width: 0.01, height: 0.01};
}, 'PAPER_PROJECTION_ACTION_LABEL_OVERLAP');
rejectLayout('未选支承面越安全区也拒绝', (s) => {
  physical(s).supports.push({id: 'unused', xMm: -300, yMm: 0, widthMm: 20, depthMm: 20, topHeightMm: 10});
}, 'PAPER_PROJECTION_SUPPORT_UNSAFE');
rejectLayout('支承面侵入字幕也拒绝', (s) => {
  physical(s).supports.push({id: 'unused', xMm: 100, yMm: 205, widthMm: 20, depthMm: 5, topHeightMm: 10});
}, 'PAPER_PROJECTION_SUPPORT_SUBTITLE_OVERLAP');
for (const value of [null, undefined, {}, [null], [undefined], Array(1), [{box: null}], [{box: {x: NaN}}]]) {
  rejectLayout('坏标签数组或矩形拒绝', (s) => {s.layoutContract.paperLabelSurfaceBoxes = value;}, 'PAPER_PROJECTION_LABEL_BOXES_INVALID');
}
rejectLayout('缺布局不得静默跳过安全区', (s) => {delete s.layoutContract;}, 'PAPER_PROJECTION_LAYOUT_INVALID');
rejectLayout('安全区本身必须有效', (s) => {s.layoutContract.contentSafeRect.x = -1;}, 'PAPER_PROJECTION_LAYOUT_INVALID');
rejectLayout('物理不相撞但 slide 投影被静态物件遮挡仍拒绝', (s) => {
  physical(s).obstacles.push({id: 'rear', xMm: 100, yMm: 150, zMm: 115, widthMm: 10, depthMm: 10, heightMm: 5});
}, 'PAPER_PROJECTION_SLIDE_OBSTACLE_OVERLAP');
test('局部动作不因自身或其他静态 bbox 相交声称真实碰撞', () => {
  const s = fixture(); physical(s).obstacles.push({...physical(s).obstacles[0], id: 'another-local-bound'});
  assert.deepEqual(check(backfill(s)), []);
});
test('静态障碍投影与标签交叠不单独判碰撞', () => {
  const s = fixture(); physical(s).obstacles.push({id: 'static-bound', xMm: 100, yMm: -40, zMm: 10, widthMm: 10, depthMm: 5, heightMm: 5});
  const bound = derivePaperProjection(s).obstacleRects.find((r) => r.obstacleId === 'static-bound').rect;
  s.layoutContract.paperLabelSurfaceBoxes[0].box = {...bound};
  assert.deepEqual(check(backfill(s)), []);
});
test('渲染逐动作同源参考矩形而不是实测保证', () => {
  const s = backfill(fixture()); const output = renderProjectionConstraints(s);
  for (const token of ['X=76+3.4*x', 'Y=400+2.8*y-2.6*z', '1920', '1080', '4', '声明包络', '不是图像验证', '未配置', '不在本次']) {
    assert(output.includes(token), token);
  }
  for (const {actionId, rect} of derivePaperProjection(s).actionRects) {
    assert(output.includes(actionId)); assert(output.includes(JSON.stringify(rect)));
  }
});
test('坏投影不得渲染成通过结论', () => {
  const s = fixture(); projection(s).xScale = NaN;
  assert.match(renderProjectionConstraints(s), /无效|不完整/);
});
console.log(JSON.stringify({ok: true, tests, scope: 'projection-reference-contract-only', generatedMedia: false, dynamicAcceptance: false}));
