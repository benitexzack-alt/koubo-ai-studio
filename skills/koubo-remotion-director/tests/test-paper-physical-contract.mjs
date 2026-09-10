#!/usr/bin/env node
import assert from 'node:assert/strict';
import {validatePaperPhysicalContract, renderPhysicalConstraints} from '../scripts/paper-physical-contract.mjs';

const beat = {id: 'B07'};
const fixture = () => ({
  objectGroups: ['G1', 'G2', 'G3', 'G4'].map((id) => ({id, name: id})),
  motionContract: {
    parts: [
      {id: 'pages', name: '回答纸页组合', kind: 'blank-part', groupId: 'G1'},
      {id: 'lever', name: '后侧控制杆', kind: 'blank-part', groupId: 'G3'},
      {id: 'label', name: '固定标签', kind: 'label', groupId: 'G2'},
    ],
    initialLocations: [{partId: 'pages', groupId: 'G1'}, {partId: 'lever', groupId: 'G3'}],
    actions: [
      {id: 'A1', partId: 'pages', operation: 'slide', fromGroupId: 'G1', toGroupId: 'G2'},
      {id: 'A2', partId: 'pages', operation: 'slide', fromGroupId: 'G2', toGroupId: 'G3'},
      {id: 'A3', partId: 'lever', operation: 'rotate-rigid', fromGroupId: 'G3', toGroupId: 'G3'},
      {id: 'A4', partId: 'pages', operation: 'slide', fromGroupId: 'G3', toGroupId: 'G4'},
    ],
    physicalContract: {
      schemaVersion: 'koubo-paper-physical-contract/v1', coordinateSystem: 'tabletop-mm', minimumClearanceMm: 2,
      inventory: [
        {partId: 'pages', quantity: 1, unit: 'rigid-assembly', envelopeMm: {width: 20, depth: 10, height: 3}},
        {partId: 'lever', quantity: 1, unit: 'rigid-assembly', envelopeMm: {width: 8, depth: 4, height: 5}},
      ],
      stations: [
        {groupId: 'G1', initialPartIds: ['pages']}, {groupId: 'G2', initialPartIds: []},
        {groupId: 'G3', initialPartIds: ['lever']}, {groupId: 'G4', initialPartIds: []},
      ],
      docks: [0, 40, 80, 120].map((xMm, i) => ({id: `D${i + 1}`, groupId: `G${i + 1}`,
        xMm, yMm: 0, supportHeightMm: 10, openingWidthMm: 14, openingHeightMm: 5})),
      supports: [{id: 'S1', xMm: -12, yMm: -7, widthMm: 144, depthMm: 14, topHeightMm: 10}],
      obstacles: [{id: 'O1', xMm: 72, yMm: 20, zMm: 10, widthMm: 16, depthMm: 8, heightMm: 10}],
      transfers: [
        {actionId: 'A1', fromDockId: 'D1', toDockId: 'D2', supportIds: ['S1']},
        {actionId: 'A2', fromDockId: 'D2', toDockId: 'D3', supportIds: ['S1']},
        {actionId: 'A4', fromDockId: 'D3', toDockId: 'D4', supportIds: ['S1']},
      ],
    },
  },
});
const physical = (scene) => scene.motionContract.physicalContract;
const check = (scene, required = true) => validatePaperPhysicalContract({scene, beat, required});
let tests = 0;
const test = (name, run) => {
  try {run(); tests++;} catch (error) {error.message = `${name}: ${error.message}`; throw error;}
};
const reject = (name, change, code) => test(name, () => {
  const scene = fixture();
  change(physical(scene), scene.motionContract, scene);
  const errors = check(scene);
  assert(errors.length > 0, '无效合同不得通过');
  assert(errors.every((error) => error.endsWith(':B07')), errors.join('|'));
  if (code) assert(errors.includes(`${code}:B07`), errors.join('|'));
});

test('P02 三段滑动与同组控制杆合法', () => assert.deepEqual(check(fixture()), []));
test('无合同仅在非必需时兼容', () => {
  assert.deepEqual(validatePaperPhysicalContract({scene: {}, beat}), []);
  assert.deepEqual(check({}), ['PAPER_PHYSICAL_CONTRACT_REQUIRED:B07']);
  assert.equal(renderPhysicalConstraints({}), '');
});
test('没有跨组动作的展开合法', () => {
  const scene = fixture();
  scene.motionContract.actions = [{id: 'A1', partId: 'pages', operation: 'unfold', fromGroupId: 'G1', toGroupId: 'G1'}];
  Object.assign(physical(scene), {docks: [], transfers: [], supports: [], obstacles: []});
  assert.deepEqual(check(scene), []);
});
reject('布尔通过不能替代合同', (_p, m) => {m.physicalContract = {passed: true};});
reject('schema 不匹配', (p) => {p.schemaVersion = 'other';}, 'PAPER_PHYSICAL_SCHEMA_INVALID');
reject('坐标系必须毫米', (p) => {p.coordinateSystem = 'normalized';}, 'PAPER_PHYSICAL_COORDINATE_SYSTEM_INVALID');
reject('最小净空不足一毫米', (p) => {p.minimumClearanceMm = 0.9;}, 'PAPER_PHYSICAL_CLEARANCE_INVALID');
reject('数量不能复制', (p) => {p.inventory[0].quantity = 2;}, 'PAPER_PHYSICAL_INVENTORY_QUANTITY_INVALID');
reject('数量不能用布尔', (p) => {p.inventory[0].quantity = true;});
reject('数量不能省略', (p) => {delete p.inventory[0].quantity;});
reject('单位必须刚性组合', (p) => {p.inventory[0].unit = 'sheets';}, 'PAPER_PHYSICAL_INVENTORY_UNIT_INVALID');
reject('库存漏件', (p) => {p.inventory.pop();}, 'PAPER_PHYSICAL_INVENTORY_COVERAGE_INVALID');
reject('库存重复', (p) => {p.inventory.push(structuredClone(p.inventory[0]));}, 'PAPER_PHYSICAL_INVENTORY_ID_INVALID');
reject('固定标签不得进入库存', (p) => {p.inventory.push({...p.inventory[0], partId: 'label'});}, 'PAPER_PHYSICAL_INVENTORY_PART_INVALID');
reject('未知库存件', (p) => {p.inventory[0].partId = 'unknown';});
reject('空站也必须列出', (p) => {p.stations.splice(1, 1);}, 'PAPER_PHYSICAL_STATION_COVERAGE_INVALID');
reject('空站字段不能省略', (p) => {delete p.stations[1].initialPartIds;}, 'PAPER_PHYSICAL_STATION_INITIAL_PARTS_REQUIRED');
reject('重复站', (p) => {p.stations.push(structuredClone(p.stations[1]));}, 'PAPER_PHYSICAL_STATION_ID_INVALID');
reject('同站重复初态件', (p) => {p.stations[0].initialPartIds.push('pages');}, 'PAPER_PHYSICAL_STATION_INITIAL_DUPLICATE');
reject('跨站预摆同件', (p) => {p.stations[1].initialPartIds.push('pages');}, 'PAPER_PHYSICAL_STATION_INITIAL_DUPLICATE');
reject('初态漏件', (p) => {p.stations[0].initialPartIds = [];}, 'PAPER_PHYSICAL_STATION_INITIAL_COVERAGE_INVALID');
reject('初态错站', (p) => {p.stations[0].initialPartIds = []; p.stations[1].initialPartIds = ['pages'];}, 'PAPER_PHYSICAL_STATION_INITIAL_MISMATCH');
reject('初态不允许标签', (p) => {p.stations[1].initialPartIds = ['label'];});
reject('原始 initialLocations 重复', (_p, m) => {m.initialLocations.push({...m.initialLocations[0]});});
reject('原始 initialLocations 漏件', (_p, m) => {m.initialLocations.pop();});
reject('组 ID 重复', (_p, _m, s) => {s.objectGroups.push({...s.objectGroups[0]});});
reject('part ID 重复', (_p, m) => {m.parts.push({...m.parts[0]});});
reject('dock ID 重复', (p) => {p.docks.push({...p.docks[0]});});
reject('support ID 重复', (p) => {p.supports.push({...p.supports[0]});});
reject('obstacle ID 重复', (p) => {p.obstacles.push({...p.obstacles[0]});});
reject('action ID 重复', (_p, m) => {m.actions.push({...m.actions[0]});});

for (const field of ['inventory', 'stations', 'docks', 'supports', 'obstacles', 'transfers']) {
  for (const value of [undefined, null, {}, true, '[]']) {
    reject(`${field} 非法数组 ${String(value)}`, (p) => {p[field] = value;});
  }
  reject(`${field} 中的空记录不抛异常`, (p) => {p[field] = [null];});
}
for (const field of ['parts', 'initialLocations', 'actions']) {
  reject(`运动合同 ${field} 非法数组`, (_p, m) => {m[field] = null;});
  reject(`运动合同 ${field} 空记录`, (_p, m) => {m[field] = [null];});
}
reject('物件组非法数组', (_p, _m, s) => {s.objectGroups = {};});
reject('物件组空记录', (_p, _m, s) => {s.objectGroups = [null];});
for (const value of [false, true, [], 'contract', 1]) {
  reject(`合同类型非法 ${String(value)}`, (_p, m) => {m.physicalContract = value;});
}
for (const [collection, fields] of [
  ['docks', ['xMm', 'yMm', 'supportHeightMm', 'openingWidthMm', 'openingHeightMm']],
  ['supports', ['xMm', 'yMm', 'widthMm', 'depthMm', 'topHeightMm']],
  ['obstacles', ['xMm', 'yMm', 'zMm', 'widthMm', 'depthMm', 'heightMm']],
]) {
  for (const field of fields) for (const value of [NaN, Infinity, -Infinity, '10', null]) {
    reject(`${collection}.${field} 必须有限数 ${String(value)}`, (p) => {p[collection][0][field] = value;});
  }
}
for (const value of [NaN, Infinity, -Infinity, '2', null]) {
  reject('净空必须有限数', (p) => {p.minimumClearanceMm = value;});
}
for (const field of ['width', 'depth', 'height']) {
  for (const value of [0, -1, NaN, Infinity, '20', null]) {
    reject(`包络 ${field} 必须有限正数`, (p) => {p.inventory[0].envelopeMm[field] = value;});
  }
}
for (const [collection, fields] of [
  ['docks', ['openingWidthMm', 'openingHeightMm']],
  ['supports', ['widthMm', 'depthMm']], ['obstacles', ['widthMm', 'depthMm', 'heightMm']],
]) for (const field of fields) for (const value of [0, -1]) {
  reject(`${collection}.${field} 必须正数`, (p) => {p[collection][0][field] = value;});
}
reject('dock 关联未知组', (p) => {p.docks[0].groupId = 'unknown';});
reject('transfer 关联未知 dock', (p) => {p.transfers[0].toDockId = 'unknown';});
reject('dock 不属于动作目标组', (p) => {p.transfers[0].toDockId = 'D3';}, 'PAPER_PHYSICAL_DOCK_GROUP_MISMATCH');
reject('跨组动作漏 transfer', (p) => {p.transfers.pop();}, 'PAPER_PHYSICAL_TRANSFER_COVERAGE_INVALID');
reject('同一动作多 transfer', (p) => {p.transfers.push({...p.transfers[0]});}, 'PAPER_PHYSICAL_TRANSFER_ID_INVALID');
reject('多余 transfer', (p) => {p.transfers.push({...p.transfers[0], actionId: 'missing'});}, 'PAPER_PHYSICAL_TRANSFER_ACTION_INVALID');
reject('同组控制杆不得冒充 transfer', (p) => {p.transfers.push({actionId: 'A3', fromDockId: 'D3', toDockId: 'D3', supportIds: ['S1']});}, 'PAPER_PHYSICAL_TRANSFER_ACTION_INVALID');
reject('跨组暂不支持展开', (_p, m) => {m.actions[0].operation = 'unfold';}, 'PAPER_PHYSICAL_TRANSFER_OPERATION_UNSUPPORTED');
reject('动作不能搬固定标签', (_p, m) => {m.actions[0].partId = 'label';});
reject('动作初态错组', (_p, m) => {m.actions[0].fromGroupId = 'G2';});
reject('支承列表不能为空', (p) => {p.transfers[0].supportIds = [];});
reject('支承列表不能省略', (p) => {delete p.transfers[0].supportIds;});
reject('支承 ID 不存在', (p) => {p.transfers[0].supportIds = ['missing'];});
reject('支承 ID 不可重复', (p) => {p.transfers[0].supportIds = ['S1', 'S1'];});
reject('支承列表必须数组', (p) => {p.transfers[0].supportIds = {};});
reject('滑动起终点 x 必须不同', (p) => {p.docks[1].xMm = 0;}, 'PAPER_PHYSICAL_SLIDE_ALIGNMENT_INVALID');
reject('滑动不能偏 y', (p) => {p.docks[1].yMm = 1;}, 'PAPER_PHYSICAL_SLIDE_ALIGNMENT_INVALID');
reject('滑动不能跨高度', (p) => {p.docks[1].supportHeightMm = 11;}, 'PAPER_PHYSICAL_SLIDE_ALIGNMENT_INVALID');
reject('支承面高度必须相同', (p) => {p.supports[0].topHeightMm = 9;}, 'PAPER_PHYSICAL_SUPPORT_HEIGHT_MISMATCH');
for (const dock of [0, 1]) {
  reject('进入和离开开口都检查宽度', (p) => {p.docks[dock].openingWidthMm = 13.99;}, 'PAPER_PHYSICAL_OPENING_TOO_SMALL');
  reject('进入和离开开口都检查高度', (p) => {p.docks[dock].openingHeightMm = 4.99;}, 'PAPER_PHYSICAL_OPENING_TOO_SMALL');
}
reject('过宽最大包络不能借动作缩小', (p) => {p.inventory[0].envelopeMm.depth = 20;}, 'PAPER_PHYSICAL_OPENING_TOO_SMALL');
reject('过长最大包络超过支承', (p) => {p.inventory[0].envelopeMm.width = 21;}, 'PAPER_PHYSICAL_SUPPORT_COVERAGE_GAP');
reject('过高最大包络不能通过开口', (p) => {p.inventory[0].envelopeMm.height = 4;}, 'PAPER_PHYSICAL_OPENING_TOO_SMALL');

const tileSupports = (p, gap = 0) => {
  p.supports = [
    {id: 'left', xMm: -12, yMm: -7, widthMm: 60, depthMm: 14, topHeightMm: 10},
    {id: 'right', xMm: 48 + gap, yMm: -7, widthMm: 84 - gap, depthMm: 14, topHeightMm: 10},
  ];
  p.transfers.forEach((t) => {t.supportIds = ['left', 'right'];});
};
test('相接的多个支承并集覆盖合法', () => {
  const s = fixture(); tileSupports(physical(s)); assert.deepEqual(check(s), []);
});
reject('支承外接矩形够大但中间有缝', (p) => tileSupports(p, 0.1), 'PAPER_PHYSICAL_SUPPORT_COVERAGE_GAP');
reject('不能忽略微小正宽缝隙', (p) => tileSupports(p, 1e-8), 'PAPER_PHYSICAL_SUPPORT_COVERAGE_GAP');
reject('只选左面不能借未选右面覆盖', (p) => {tileSupports(p); p.transfers[0].supportIds = ['left'];}, 'PAPER_PHYSICAL_SUPPORT_COVERAGE_GAP');
reject('四边围住仍不能覆盖中央孔洞', (p) => {
  p.supports = [
    {id: 'top', xMm: -12, yMm: 1, widthMm: 144, depthMm: 6, topHeightMm: 10},
    {id: 'bottom', xMm: -12, yMm: -7, widthMm: 144, depthMm: 6, topHeightMm: 10},
    {id: 'left', xMm: -12, yMm: -1, widthMm: 31, depthMm: 2, topHeightMm: 10},
    {id: 'right', xMm: 21, yMm: -1, widthMm: 111, depthMm: 2, topHeightMm: 10},
  ];
  p.transfers.forEach((t) => {t.supportIds = p.supports.map((s) => s.id);});
}, 'PAPER_PHYSICAL_SUPPORT_COVERAGE_GAP');
test('二维拼接覆盖合法', () => {
  const s = fixture(); const p = physical(s);
  tileSupports(p);
  p.supports = p.supports.flatMap((support) => [
    {...support, id: `${support.id}-bottom`, depthMm: 7},
    {...support, id: `${support.id}-top`, yMm: 0, depthMm: 7},
  ]);
  p.transfers.forEach((t) => {t.supportIds = p.supports.map((support) => support.id);});
  assert.deepEqual(check(s), []);
});
const obstacle = (p, patch = {}) => {p.obstacles = [{id: 'block', xMm: 20, yMm: -1, zMm: 11,
  widthMm: 1, depthMm: 2, heightMm: 1, ...patch}];};
reject('障碍正体积交叠', (p) => obstacle(p), 'PAPER_PHYSICAL_OBSTACLE_COLLISION');
reject('净空边带内障碍也失败', (p) => obstacle(p, {yMm: 6}), 'PAPER_PHYSICAL_OBSTACLE_COLLISION');
reject('上方净空内障碍也失败', (p) => obstacle(p, {zMm: 14}), 'PAPER_PHYSICAL_OBSTACLE_COLLISION');
for (const patch of [{yMm: 7}, {zMm: 15}, {zMm: 9, heightMm: 1}]) {
  test('仅边界相接不算正体积碰撞', () => {
    const s = fixture(); obstacle(physical(s), patch); assert.deepEqual(check(s), []);
  });
}
const splitDock = (p, delta) => {
  p.docks.push({...p.docks[1], id: 'D2-out', ...delta});
  p.transfers[1].fromDockId = 'D2-out';
};
test('不同 dock ID 但相同对接数值合法', () => {
  const s = fixture(); splitDock(physical(s), {}); assert.deepEqual(check(s), []);
});
for (const delta of [{xMm: 41}, {yMm: 1}, {supportHeightMm: 11}]) {
  reject('同件跨段 dock 数值断裂', (p) => splitDock(p, delta), 'PAPER_PHYSICAL_DOCK_DISCONTINUITY');
}
for (const operation of ['rotate-rigid', 'unfold']) {
  reject('中间同组动作不能自动挪 dock', (p, m) => {
    m.actions.splice(1, 0, {id: 'middle', partId: 'pages', operation, fromGroupId: 'G2', toGroupId: 'G2'});
    splitDock(p, {xMm: 41});
  }, 'PAPER_PHYSICAL_DOCK_DISCONTINUITY');
}
test('反向滑动同样合法', () => {
  const s = fixture(); const p = physical(s);
  p.docks.forEach((dock) => {dock.xMm = 120 - dock.xMm;});
  assert.deepEqual(check(s), []);
});
reject('有限输入导致边界溢出也拒绝', (p) => {
  p.supports[0].xMm = Number.MAX_VALUE; p.supports[0].widthMm = Number.MAX_VALUE;
});
reject('扫掠计算溢出不能通过', (p) => {
  p.docks[0].xMm = -Number.MAX_VALUE; p.inventory[0].envelopeMm.width = Number.MAX_VALUE;
});
test('渲染包含真实数值、空站和验收边界且不改输入', () => {
  const scene = fixture(); const before = structuredClone(scene);
  const output = renderPhysicalConstraints(scene);
  for (const token of ['pages', 'lever', '全景总量', '刚性组合', 'G2', '初态活动件为空', 'G4', 'A1', 'A2', 'A4',
    '同高', '连续开放通道', '14', '5', '净空', '支承', '不复制', '不预摆', '三层', '台阶', '计划数值', '不是图像验证']) {
    assert(output.includes(token), token);
  }
  assert.equal(output.split('\n').filter((line) => /^动作A\d/.test(line)).length, 3);
  assert(!/^动作A3/m.test(output));
  assert.deepEqual(check(scene), []);
  assert.deepEqual(scene, before);
});
test('空活动件站和有活动件站都保留固定字牌与静态布景', () => {
  const scene = fixture();
  Object.assign(scene.objectGroups[1], {name: '作品展示台', material: '固定字牌和静态作品册'});
  Object.assign(scene.objectGroups[2], {name: '老板核对台', material: '固定字牌和静态老板纸人'});
  const output = renderPhysicalConstraints(scene);
  assert(output.includes('作品展示台（G2）初态活动件为空（保留固定字牌与布景）'));
  assert(output.includes('老板核对台（G3）初态活动件仅有：后侧控制杆（lever）'));
  assert(output.includes('计数仅含无字活动件，不含固定字牌与静态布景'));
  assert(output.includes('固定字牌与静态布景保持原样'));
  assert(!output.includes('初态为空'));
  assert(!output.includes('初态仅有'));
  assert.deepEqual(check(scene), []);
});
test('非法合同不得渲染成安全结论', () => {
  const scene = fixture(); physical(scene).supports = null;
  assert.match(renderPhysicalConstraints(scene), /无效|不完整/);
});
test('运输包络不冒称涵盖本组折叠或控制杆旋转', () => {
  const output = renderPhysicalConstraints(fixture());
  assert(output.includes('跨组滑动的运输姿态最大包络'));
  assert(output.includes('本镜不作跨组输送，局部动作范围按动作区及真实动态另行检查'));
  assert(output.includes('局部折叠与旋转的临时姿态不属于水平运输包络验算'));
  assert(!output.includes('展开或转动后也不得超过该包络'));
});
console.log(JSON.stringify({ok: true, tests, scope: 'physical-contract-only', generatedMedia: false, dynamicAcceptance: false}));
