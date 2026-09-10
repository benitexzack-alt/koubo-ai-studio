import {validatePaperPhysicalContract, sweptVolume} from './paper-physical-contract.mjs';

const schema = 'koubo-paper-projection/v1';
const epsilon = 1e-9;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const positive = (value) => Number.isFinite(value) && value > 0;
const configured = (scene) => record(scene?.motionContract) && Object.hasOwn(scene.motionContract, 'projectionContract');
const rectKeys = ['x', 'y', 'width', 'height'];
const validRect = (rect) => record(rect) && rectKeys.every((key) => Number.isFinite(rect[key])) && rect.width > 0 && rect.height > 0 &&
  Number.isFinite(rect.x + rect.width) && Number.isFinite(rect.y + rect.height);
const contains = (outer, inner) => inner.x >= outer.x - epsilon && inner.y >= outer.y - epsilon &&
  inner.x + inner.width <= outer.x + outer.width + epsilon && inner.y + inner.height <= outer.y + outer.height + epsilon;
const normalizedRect = (rect) => validRect(rect) && contains({x: 0, y: 0, width: 1, height: 1}, rect);
const overlaps = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > epsilon &&
  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > epsilon;
const obstacleVolume = (item) => ({x0: item.xMm, x1: item.xMm + item.widthMm, y0: item.yMm,
  y1: item.yMm + item.depthMm, z0: item.zMm, z1: item.zMm + item.heightMm});
const supportVolume = (item) => ({x0: item.xMm, x1: item.xMm + item.widthMm, y0: item.yMm,
  y1: item.yMm + item.depthMm, z0: item.topHeightMm, z1: item.topHeightMm});

function projectBounds(volume, projection) {
  const xs = [];
  const ys = [];
  // All eight corners matter: a part's top shifts Y even when its support is level.
  for (const x of [volume.x0, volume.x1]) for (const y of [volume.y0, volume.y1]) for (const z of [volume.z0, volume.z1]) {
    xs.push(projection.originX + projection.xScale * x);
    ys.push(projection.originY + projection.yScale * y - projection.zScale * z);
  }
  const x0 = Math.min(...xs) - projection.paddingPx;
  const x1 = Math.max(...xs) + projection.paddingPx;
  const y0 = Math.min(...ys) - projection.paddingPx;
  const y1 = Math.max(...ys) + projection.paddingPx;
  return {x: x0 / projection.frame.width, y: y0 / projection.frame.height,
    width: (x1 - x0) / projection.frame.width, height: (y1 - y0) / projection.frame.height};
}

export function derivePaperProjection(scene) {
  const errors = new Set();
  const fail = (ok, code) => {if (!ok) errors.add(`PAPER_PROJECTION_${code}`);};
  const actionRects = [];
  const supportRects = [];
  const obstacleRects = [];
  const result = () => ({ok: errors.size === 0, errors: [...errors],
    actionRects: errors.size ? [] : actionRects, supportRects: errors.size ? [] : supportRects, obstacleRects: errors.size ? [] : obstacleRects});
  if (!configured(scene)) {
    fail(false, 'CONTRACT_REQUIRED');
    return result();
  }
  // The physical validator has no projection dependency; derivation never reads old sweptRect values.
  for (const error of validatePaperPhysicalContract({scene, required: true})) {
    fail(false, `PHYSICAL_INVALID:${error.split(':')[0]}`);
  }
  const motion = scene.motionContract;
  const projection = motion.projectionContract;
  if (!record(projection)) {
    fail(false, 'CONTRACT_INVALID');
    return result();
  }
  fail(projection.schemaVersion === schema, 'SCHEMA_INVALID');
  fail(projection.type === 'axis-aligned-affine-reference', 'TYPE_INVALID');
  fail(record(projection.frame) && positive(projection.frame.width) && positive(projection.frame.height), 'FRAME_INVALID');
  fail(['xScale', 'yScale', 'zScale'].every((key) => positive(projection[key])), 'SCALE_INVALID');
  fail(['originX', 'originY'].every((key) => Number.isFinite(projection[key])), 'ORIGIN_INVALID');
  fail(Number.isFinite(projection.paddingPx) && projection.paddingPx >= 0, 'PADDING_INVALID');
  fail(Array.isArray(projection.localActionEnvelopes), 'LOCAL_ENVELOPES_REQUIRED');
  if (errors.size > 0) return result();
  const physical = motion.physicalContract;
  const inventory = new Map(physical.inventory.map((item) => [item.partId, item]));
  const docks = new Map(physical.docks.map((dock) => [dock.id, dock]));
  const transfers = new Map(physical.transfers.map((transfer) => [transfer.actionId, transfer]));
  const obstacles = new Map(physical.obstacles.map((obstacle) => [obstacle.id, obstacle]));
  const localActions = new Map(motion.actions.filter((action) => action.fromGroupId === action.toGroupId).map((action) => [action.id, action]));
  const localBindings = new Map();
  for (const binding of projection.localActionEnvelopes) {
    if (!record(binding) || !text(binding.actionId) || !text(binding.obstacleId)) {
      fail(false, 'LOCAL_ENVELOPE_INVALID');
      continue;
    }
    fail(!localBindings.has(binding.actionId), 'LOCAL_ENVELOPE_DUPLICATE');
    fail(localActions.has(binding.actionId), 'LOCAL_ACTION_INVALID');
    fail(obstacles.has(binding.obstacleId), 'LOCAL_OBSTACLE_INVALID');
    localBindings.set(binding.actionId, binding.obstacleId);
  }
  fail(localBindings.size === localActions.size && [...localActions.keys()].every((id) => localBindings.has(id)), 'LOCAL_COVERAGE_INVALID');
  if (errors.size > 0) return result();
  const projected = (volume, id) => {
    const rect = projectBounds(volume, projection);
    fail(validRect(rect), `BOUNDS_INVALID:${id}`);
    return rect;
  };
  for (const action of motion.actions) {
    const transfer = transfers.get(action.id);
    const volume = transfer ? sweptVolume(docks.get(transfer.fromDockId), docks.get(transfer.toDockId),
      inventory.get(action.partId).envelopeMm, physical.minimumClearanceMm) : obstacleVolume(obstacles.get(localBindings.get(action.id)));
    actionRects.push({actionId: action.id, rect: projected(volume, action.id)});
  }
  for (const support of physical.supports) supportRects.push({supportId: support.id, rect: projected(supportVolume(support), support.id)});
  for (const obstacle of physical.obstacles) obstacleRects.push({obstacleId: obstacle.id, rect: projected(obstacleVolume(obstacle), obstacle.id)});
  return result();
}

export function validatePaperProjectionContract({scene, beat} = {}) {
  if (!configured(scene)) return [];
  const beatId = beat?.id ?? scene?.beatId ?? 'unknown';
  const derived = derivePaperProjection(scene);
  if (!derived.ok) return derived.errors.map((error) => `${error}:${beatId}`);
  const errors = new Set();
  const fail = (ok, code) => {if (!ok) errors.add(`PAPER_PROJECTION_${code}:${beatId}`);};
  const layout = scene.layoutContract;
  const layoutValid = record(layout) && normalizedRect(layout.contentSafeRect) && normalizedRect(layout.subtitleReservedRect);
  fail(layoutValid, 'LAYOUT_INVALID');
  const labels = layout?.paperLabelSurfaceBoxes;
  const labelsValid = Array.isArray(labels) && Array.from(labels).every((label) => record(label) && normalizedRect(label.box));
  fail(labelsValid, 'LABEL_BOXES_INVALID');
  const actions = new Map(scene.motionContract.actions.map((action) => [action.id, action]));
  for (const {actionId, rect} of derived.actionRects) {
    const action = actions.get(actionId);
    fail(normalizedRect(action.sweptRect), `ACTION_RECT_INVALID:${actionId}`);
    if (validRect(action.sweptRect)) {
      fail(rectKeys.every((key) => Math.abs(action.sweptRect[key] - rect[key]) <= epsilon), `ACTION_RECT_MISMATCH:${actionId}`);
    }
    // Gates use the full derived rectangle, never a potentially undersized legacy action rectangle.
    if (layoutValid) {
      fail(contains(layout.contentSafeRect, rect), `ACTION_UNSAFE:${actionId}`);
      fail(!overlaps(layout.subtitleReservedRect, rect), `ACTION_SUBTITLE_OVERLAP:${actionId}`);
    }
    if (labelsValid) {
      for (const label of labels) fail(!overlaps(label.box, rect), `ACTION_LABEL_OVERLAP:${actionId}`);
    }
    if (action.fromGroupId !== action.toGroupId && action.operation === 'slide') {
      for (const obstacle of derived.obstacleRects) {
        fail(!overlaps(rect, obstacle.rect), `SLIDE_OBSTACLE_OVERLAP:${actionId}:${obstacle.obstacleId}`);
      }
    }
  }
  if (layoutValid) {
    for (const {supportId, rect} of derived.supportRects) {
      fail(contains(layout.contentSafeRect, rect), `SUPPORT_UNSAFE:${supportId}`);
      fail(!overlaps(layout.subtitleReservedRect, rect), `SUPPORT_SUBTITLE_OVERLAP:${supportId}`);
    }
  }
  // Do not infer local-action collisions or obstacle/label collisions from conservative static bounds.
  return [...errors];
}

export function renderProjectionConstraints(scene) {
  if (!configured(scene)) return '';
  const derived = derivePaperProjection(scene);
  if (!derived.ok) return '投影参考合同无效或不完整，须先修正计划数值；不能据此声称画面或动态验收通过。';
  const p = scene.motionContract.projectionContract;
  return [
    '以下为当前镜头的轴向对齐仿射参考，不是图像验证，也不是动态实测。未配置投影合同的镜头不在本次投影联验范围。',
    `世界坐标单位为毫米，画幅为${p.frame.width}×${p.frame.height}像素，参考公式：X=${p.originX}+${p.xScale}*x；Y=${p.originY}+${p.yScale}*y-${p.zScale}*z。`,
    `投影取完整包络八角的屏幕边界，四边各外扩${p.paddingPx}像素，再按画幅宽高归一化；跨组滑动已计入物理净空，支承只投影顶面。`,
    ...derived.actionRects.map(({actionId, rect}) => `动作${actionId}的完整参考动作区（归一化）为${JSON.stringify(rect)}。`),
    ...p.localActionEnvelopes.map(({actionId, obstacleId}) => `局部动作${actionId}使用${obstacleId}的完整声明包络；声明包络不是已动态验证的真实轨迹。`),
    '完整动作区与支承面须留在内容安全区并避开字幕区，动作区须避开固定标签；跨组滑动须避开静态障碍的参考投影。',
    '局部动作与自身或其他静态包络相交，不能仅据外接矩形声称真实碰撞；障碍全包络与标签的相交也不直接代表真实遮挡。实际姿态、可读性和遮挡须用真实首帧与动态抽帧另行检查。',
  ].join('\n');
}
