const schema = 'koubo-paper-physical-contract/v1';
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const finite = Number.isFinite;
const positive = (value) => finite(value) && value > 0;
const sameKeys = (a, b) => a.size === b.size && [...a.keys()].every((key) => b.has(key));
const operations = new Set(['hold', 'slide', 'rotate-rigid', 'unfold', 'fold', 'insert', 'open', 'close', 'lock']);

// Docks use XY centers; supports and obstacles use minimum-corner XY coordinates.
const rectangle = (item) => ({x0: item.xMm, x1: item.xMm + item.widthMm,
  y0: item.yMm, y1: item.yMm + item.depthMm});
const validRectangle = (r) => Object.values(r).every(finite) && r.x1 > r.x0 && r.y1 > r.y0;
const overlaps = (a0, a1, b0, b1) => Math.min(a1, b1) > Math.max(a0, b0);
const sameDockPosition = (a, b) => a.xMm === b.xMm && a.yMm === b.yMm && a.supportHeightMm === b.supportHeightMm;
const sweptVolume = (from, to, envelope, clearance) => ({
  x0: Math.min(from.xMm, to.xMm) - envelope.width / 2 - clearance,
  x1: Math.max(from.xMm, to.xMm) + envelope.width / 2 + clearance,
  y0: from.yMm - envelope.depth / 2 - clearance,
  y1: from.yMm + envelope.depth / 2 + clearance,
  z0: from.supportHeightMm,
  z1: from.supportHeightMm + envelope.height + clearance,
});

function unionCovers(target, rectangles) {
  const clipped = rectangles.map((r) => ({x0: Math.max(target.x0, r.x0), x1: Math.min(target.x1, r.x1),
    y0: Math.max(target.y0, r.y0), y1: Math.min(target.y1, r.y1)})).filter(validRectangle);
  const xs = [...new Set([target.x0, target.x1, ...clipped.flatMap((r) => [r.x0, r.x1])])].sort((a, b) => a - b);
  const ys = [...new Set([target.y0, target.y1, ...clipped.flatMap((r) => [r.y0, r.y1])])].sort((a, b) => a - b);
  // Every positive-area boundary cell needs real support; a union's bounding box is insufficient.
  for (let x = 0; x < xs.length - 1; x++) {
    for (let y = 0; y < ys.length - 1; y++) {
      if (!clipped.some((r) => r.x0 <= xs[x] && r.x1 >= xs[x + 1] && r.y0 <= ys[y] && r.y1 >= ys[y + 1])) return false;
    }
  }
  return true;
}

export function validatePaperPhysicalContract({scene, beat, required = false} = {}) {
  const errors = new Set();
  const fail = (ok, code) => {if (!ok) errors.add(`PAPER_PHYSICAL_${code}:${beat?.id ?? 'unknown'}`);};
  const motion = scene?.motionContract;
  const contract = motion?.physicalContract;
  if (contract === undefined || contract === null) {
    fail(!required, 'CONTRACT_REQUIRED');
    return [...errors];
  }
  if (!record(contract)) {
    fail(false, 'CONTRACT_INVALID');
    return [...errors];
  }
  fail(contract.schemaVersion === schema, 'SCHEMA_INVALID');
  fail(contract.coordinateSystem === 'tabletop-mm', 'COORDINATE_SYSTEM_INVALID');
  fail(finite(contract.minimumClearanceMm) && contract.minimumClearanceMm >= 1, 'CLEARANCE_INVALID');
  const array = (owner, key, code) => {
    fail(Array.isArray(owner?.[key]), code);
    return Array.isArray(owner?.[key]) ? owner[key] : [];
  };
  const index = (rows, key, code) => {
    const result = new Map();
    for (const row of rows) {
      const valid = record(row) && text(row[key]) && !result.has(row[key]);
      fail(valid, code);
      if (valid) result.set(row[key], row);
    }
    return result;
  };
  const groups = index(array(scene, 'objectGroups', 'GROUPS_REQUIRED'), 'id', 'GROUP_ID_INVALID');
  const parts = index(array(motion, 'parts', 'PARTS_REQUIRED'), 'id', 'PART_ID_INVALID');
  for (const part of parts.values()) {
    fail(['blank-part', 'label'].includes(part.kind) && groups.has(part.groupId), 'PART_REFERENCE_INVALID');
  }
  const blankParts = new Map([...parts].filter(([, part]) => part.kind === 'blank-part'));
  const inventory = index(array(contract, 'inventory', 'INVENTORY_REQUIRED'), 'partId', 'INVENTORY_ID_INVALID');
  fail(sameKeys(inventory, blankParts), 'INVENTORY_COVERAGE_INVALID');
  for (const item of inventory.values()) {
    fail(blankParts.has(item.partId), 'INVENTORY_PART_INVALID');
    fail(item.quantity === 1, 'INVENTORY_QUANTITY_INVALID');
    fail(item.unit === 'rigid-assembly', 'INVENTORY_UNIT_INVALID');
    fail(record(item.envelopeMm) && ['width', 'depth', 'height'].every((key) => positive(item.envelopeMm[key])), 'ENVELOPE_INVALID');
  }
  const initial = index(array(motion, 'initialLocations', 'INITIAL_LOCATIONS_REQUIRED'), 'partId', 'INITIAL_LOCATION_ID_INVALID');
  fail(sameKeys(initial, blankParts), 'INITIAL_LOCATION_COVERAGE_INVALID');
  for (const state of initial.values()) {
    fail(blankParts.has(state.partId) && groups.has(state.groupId), 'INITIAL_LOCATION_REFERENCE_INVALID');
  }
  const stations = index(array(contract, 'stations', 'STATIONS_REQUIRED'), 'groupId', 'STATION_ID_INVALID');
  fail(sameKeys(stations, groups), 'STATION_COVERAGE_INVALID');
  const placed = new Set();
  for (const station of stations.values()) {
    fail(groups.has(station.groupId), 'STATION_GROUP_INVALID');
    for (const partId of array(station, 'initialPartIds', 'STATION_INITIAL_PARTS_REQUIRED')) {
      fail(text(partId) && blankParts.has(partId), 'STATION_INITIAL_PART_INVALID');
      fail(!placed.has(partId), 'STATION_INITIAL_DUPLICATE');
      fail(initial.get(partId)?.groupId === station.groupId, 'STATION_INITIAL_MISMATCH');
      placed.add(partId);
    }
  }
  fail(sameKeys(placed, blankParts), 'STATION_INITIAL_COVERAGE_INVALID');
  const docks = index(array(contract, 'docks', 'DOCKS_REQUIRED'), 'id', 'DOCK_ID_INVALID');
  for (const dock of docks.values()) {
    fail(groups.has(dock.groupId), 'DOCK_GROUP_INVALID');
    fail(['xMm', 'yMm', 'supportHeightMm'].every((key) => finite(dock[key])) &&
      ['openingWidthMm', 'openingHeightMm'].every((key) => positive(dock[key])), 'DOCK_DIMENSIONS_INVALID');
  }
  const supports = index(array(contract, 'supports', 'SUPPORTS_REQUIRED'), 'id', 'SUPPORT_ID_INVALID');
  for (const support of supports.values()) {
    fail(['xMm', 'yMm', 'topHeightMm'].every((key) => finite(support[key])) &&
      ['widthMm', 'depthMm'].every((key) => positive(support[key])) && validRectangle(rectangle(support)), 'SUPPORT_DIMENSIONS_INVALID');
  }
  const obstacles = index(array(contract, 'obstacles', 'OBSTACLES_REQUIRED'), 'id', 'OBSTACLE_ID_INVALID');
  for (const obstacle of obstacles.values()) {
    fail(['xMm', 'yMm', 'zMm'].every((key) => finite(obstacle[key])) &&
      ['widthMm', 'depthMm', 'heightMm'].every((key) => positive(obstacle[key])) && validRectangle(rectangle(obstacle)) &&
      finite(obstacle.zMm + obstacle.heightMm) && obstacle.zMm + obstacle.heightMm > obstacle.zMm, 'OBSTACLE_DIMENSIONS_INVALID');
  }
  const actions = index(array(motion, 'actions', 'ACTIONS_REQUIRED'), 'id', 'ACTION_ID_INVALID');
  const locations = new Map([...initial].map(([partId, state]) => [partId, state.groupId]));
  const crossActions = new Map();
  for (const action of actions.values()) {
    fail(blankParts.has(action.partId) && groups.has(action.fromGroupId) && groups.has(action.toGroupId), 'ACTION_REFERENCE_INVALID');
    fail(operations.has(action.operation), 'ACTION_OPERATION_INVALID');
    fail(locations.get(action.partId) === action.fromGroupId, 'ACTION_STATE_DISCONTINUITY');
    locations.set(action.partId, action.toGroupId);
    if (action.fromGroupId !== action.toGroupId) {
      crossActions.set(action.id, action);
      fail(action.operation === 'slide', 'TRANSFER_OPERATION_UNSUPPORTED');
    }
  }
  const transfers = index(array(contract, 'transfers', 'TRANSFERS_REQUIRED'), 'actionId', 'TRANSFER_ID_INVALID');
  fail(sameKeys(transfers, crossActions), 'TRANSFER_COVERAGE_INVALID');
  for (const transfer of transfers.values()) {
    const action = crossActions.get(transfer.actionId);
    fail(Boolean(action), 'TRANSFER_ACTION_INVALID');
    const from = docks.get(transfer.fromDockId);
    const to = docks.get(transfer.toDockId);
    fail(Boolean(from && to), 'TRANSFER_DOCK_INVALID');
    if (action && from && to) {
      fail(from.groupId === action.fromGroupId && to.groupId === action.toGroupId, 'DOCK_GROUP_MISMATCH');
    }
    const ids = array(transfer, 'supportIds', 'TRANSFER_SUPPORTS_REQUIRED');
    fail(ids.length > 0 && new Set(ids).size === ids.length && ids.every((id) => text(id) && supports.has(id)), 'TRANSFER_SUPPORT_INVALID');
  }
  // Malformed arrays, entries, numbers and references never reach arithmetic or dereferencing below.
  if (errors.size > 0) return [...errors];
  const previousDock = new Map();
  const clearance = contract.minimumClearanceMm;
  for (const action of crossActions.values()) {
    const transfer = transfers.get(action.id);
    const from = docks.get(transfer.fromDockId);
    const to = docks.get(transfer.toDockId);
    const envelope = inventory.get(action.partId).envelopeMm;
    const previous = previousDock.get(action.partId);
    fail(!previous || sameDockPosition(previous, from), 'DOCK_DISCONTINUITY');
    previousDock.set(action.partId, to);
    fail(from.xMm !== to.xMm && from.yMm === to.yMm && from.supportHeightMm === to.supportHeightMm, 'SLIDE_ALIGNMENT_INVALID');
    const width = envelope.depth + 2 * clearance;
    const height = envelope.height + clearance;
    fail(finite(width) && finite(height), 'SWEEP_DIMENSIONS_INVALID');
    for (const dock of [from, to]) {
      fail(dock.openingWidthMm >= width && dock.openingHeightMm >= height, 'OPENING_TOO_SMALL');
    }
    const selected = transfer.supportIds.map((id) => supports.get(id));
    fail(selected.every((support) => support.topHeightMm === from.supportHeightMm), 'SUPPORT_HEIGHT_MISMATCH');
    const swept = sweptVolume(from, to, envelope, clearance);
    const valid = validRectangle(swept) && swept.z1 > swept.z0;
    fail(valid, 'SWEEP_DIMENSIONS_INVALID');
    if (!valid) continue;
    fail(unionCovers(swept, selected.map(rectangle)), 'SUPPORT_COVERAGE_GAP');
    for (const obstacle of obstacles.values()) {
      const r = rectangle(obstacle);
      const collision = overlaps(swept.x0, swept.x1, r.x0, r.x1) && overlaps(swept.y0, swept.y1, r.y0, r.y1) &&
        overlaps(swept.z0, swept.z1, obstacle.zMm, obstacle.zMm + obstacle.heightMm);
      fail(!collision, 'OBSTACLE_COLLISION');
    }
  }
  return [...errors];
}

export function renderPhysicalConstraints(scene) {
  const contract = scene?.motionContract?.physicalContract;
  if (contract === undefined || contract === null) return '';
  if (validatePaperPhysicalContract({scene, required: true}).length > 0) {
    return '物理合同无效或不完整，须先修正计划数值；不得据此声称图像验证或动态验收通过。';
  }
  const motion = scene.motionContract;
  const parts = new Map(motion.parts.map((part) => [part.id, part]));
  const groups = new Map(scene.objectGroups.map((group) => [group.id, group]));
  const inventory = new Map(contract.inventory.map((item) => [item.partId, item]));
  const docks = new Map(contract.docks.map((dock) => [dock.id, dock]));
  const transfers = new Map(contract.transfers.map((transfer) => [transfer.actionId, transfer]));
  const transportedParts = new Set(motion.actions.filter((action) => transfers.has(action.id)).map((action) => action.partId));
  const partName = (id) => `${parts.get(id).name ?? id}（${id}）`;
  const groupName = (id) => `${groups.get(id).name ?? id}（${id}）`;
  const clearance = contract.minimumClearanceMm;
  const lines = [
    '以下仅是毫米制计划数值约束，不是图像验证或动态验收。对接点坐标是中心，支承面与障碍的坐标是其矩形最小角起点。',
    `全镜最小净空为${clearance}毫米。计数仅含无字活动件，不含固定字牌与静态布景；一叠纸页按一个刚性组合处理。固定字牌与静态布景保持原样。`,
    ...contract.inventory.map((item) => {
      const e = item.envelopeMm;
      return `${partName(item.partId)}全景总量固定为${item.quantity}个刚性组合；` + (transportedParts.has(item.partId)
        ? `跨组滑动的运输姿态最大包络宽${e.width}、深${e.depth}、高${e.height}毫米，输送途中不得缩小或变形。`
        : '本镜不作跨组输送，局部动作范围按动作区及真实动态另行检查。');
    }),
    ...contract.stations.map((station) => `${groupName(station.groupId)}${station.initialPartIds.length === 0 ? '初态活动件为空（保留固定字牌与布景），不预摆后续活动件结果' :
      `初态活动件仅有：${station.initialPartIds.map(partName).join('、')}；保留固定字牌与布景`}。`),
  ];
  for (const action of motion.actions) {
    const transfer = transfers.get(action.id);
    if (!transfer) continue;
    const from = docks.get(transfer.fromDockId);
    const to = docks.get(transfer.toDockId);
    const e = inventory.get(action.partId).envelopeMm;
    const swept = sweptVolume(from, to, e, clearance);
    lines.push(`动作${action.id}：${partName(action.partId)}从${groupName(from.groupId)}对接点${from.id}（${from.xMm},${from.yMm}）` +
      `至${groupName(to.groupId)}对接点${to.id}（${to.xMm},${to.yMm}），沿横向同高连续开放通道滑动，支承高度均为${from.supportHeightMm}毫米。` +
      `离开开口宽${from.openingWidthMm}、高${from.openingHeightMm}毫米，进入开口宽${to.openingWidthMm}、高${to.openingHeightMm}毫米；` +
      `两端开口至少宽${e.depth + 2 * clearance}、高${e.height + clearance}毫米，侧面各留${clearance}毫米、顶部留${clearance}毫米净空。` +
      `含净空的扫掠范围为横向[${swept.x0},${swept.x1}]、纵向[${swept.y0},${swept.y1}]、高度[${swept.z0},${swept.z1}]毫米；` +
      `支承面${transfer.supportIds.join('、')}的并集必须完整覆盖，不能有缝隙，任何障碍不得侵入该净空体积。`);
  }
  lines.push('同一部件的前段终点与后段起点必须保持同一位置和高度；中间同组转动或展开不能自动改变对接点。局部折叠与旋转的临时姿态不属于水平运输包络验算，须按动作区检查；再次跨组滑动时必须恢复约定运输姿态，不能临时缩小物件穿过窄口。');
  lines.push('全程不复制无字活动件，不预摆后续活动件结果，不把一叠纸页拆成多套；只有指定的无字部件按合同动作，固定字牌与静态布景保持原样。');
  lines.push('三层纸质空间来自后景、固定标签与非输送布景，不得把输送台做成台阶。上述数值必须在后续真实图像和动态候选中另行验证。');
  return lines.join('\n');
}
