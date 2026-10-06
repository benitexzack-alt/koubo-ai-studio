import {CARD_ENTRY_DURATION, CARD_ROW, FPS, SCENES, TILE, TITLE_MOTION, TOOLS, type SceneKind} from './plan.ts';

export const linearProgress = (frame: number, at: number, duration: number): number => {
  if (!Number.isFinite(frame) || duration <= 0) throw new Error('帧或动作区间不合法');
  return Math.max(0, Math.min(1, (frame - at) / duration));
};
const outExpo = (p: number) => p === 1 ? 1 : 1 - 2 ** (-10 * p);
const outQuart = (p: number) => 1 - (1 - p) ** 4;

export const titleState = (frame: number) => {
  const punch = outExpo(linearProgress(frame, TITLE_MOTION.punchAt, TITLE_MOTION.punchEnd - TITLE_MOTION.punchAt));
  const settle = outQuart(linearProgress(frame, TITLE_MOTION.punchEnd, TITLE_MOTION.settleEnd - TITLE_MOTION.punchEnd));
  const clear = linearProgress(frame, TITLE_MOTION.clearAt, TITLE_MOTION.clearEnd - TITLE_MOTION.clearAt);
  return {opacity: punch * (1 - clear), scale: frame < TITLE_MOTION.punchEnd ? 0.72 + punch * 0.305 : 1.025 - settle * 0.025};
};

/** 二维距离决定顺序；同距离用行列索引破同分，乱序寻帧仍得到相同40格状态。 */
const orderedCells = Array.from({length: TILE.columns * TILE.rows}, (_, index) => {
  const column = index % TILE.columns;
  const row = Math.floor(index / TILE.columns);
  const distance = (column - (TILE.columns - 1) / 2) ** 2 + (row - (TILE.rows - 1) / 2) ** 2;
  return {index, column, row, distance};
}).sort((a, b) => a.distance - b.distance || a.index - b.index);
export const TILE_CELLS = orderedCells.map((cell, rank) => ({...cell, rank,
  reverseRank: orderedCells.length - rank - 1,
  left: cell.column * TILE.width, top: cell.row * TILE.height,
})).sort((a, b) => a.index - b.index);

export const tileOpacity = (frame: number, index: number): number => {
  const cell = TILE_CELLS[index];
  if (!cell) throw new Error('格子编号超出8×5范围');
  const cover = linearProgress(frame, TILE.coverAt + cell.rank * TILE.stagger, TILE.cellDuration);
  const restore = linearProgress(frame, TILE.returnAt + cell.reverseRank * TILE.stagger, TILE.cellDuration);
  return cover * (1 - restore);
};
export const statementOpacity = (frame: number): number =>
  linearProgress(frame, TILE.statementAt, TILE.statementIn) *
  (1 - linearProgress(frame, TILE.statementOut, TILE.statementOutDuration));

export const cardState = (frame: number, index: number) => {
  const tool = TOOLS[index];
  if (!tool) throw new Error('工具卡编号超出范围');
  const p = linearProgress(frame, tool.at, CARD_ENTRY_DURATION);
  if (p === 1) return {visible: true, opacity: 1, x: 0, y: 0, z: 0,
    rotationZ: 0, rotationY: 0, scale: 1, shadowY: 18, shadowBlur: 26};
  const eased = outQuart(p);
  return {visible: frame >= tool.at, opacity: linearProgress(frame, tool.at, 2),
    x: -80 * (1 - eased), y: 8 * (1 - eased), z: 64 * (1 - eased),
    rotationZ: -5.5 * (1 - eased), rotationY: 18 * (1 - eased),
    scale: 0.86 + eased * 0.14, shadowY: 32 - eased * 14, shadowBlur: 34 - eased * 8};
};

/** 保守矩形边界涵盖轻倾与透视放大，用于人脸/字幕安全检查。 */
export const cardScreenBounds = (frame: number, index: number) => {
  const state = cardState(frame, index);
  const radians = Math.abs(state.rotationZ) * Math.PI / 180;
  const yRadians = Math.abs(state.rotationY) * Math.PI / 180;
  const halfRotatedWidth = (CARD_ROW.width * Math.cos(radians) + CARD_ROW.height * Math.sin(radians)) * state.scale / 2;
  const nearestCornerZ = state.z + halfRotatedWidth * Math.sin(yRadians);
  const perspectiveScale = 1200 / (1200 - nearestCornerZ);
  const width = (CARD_ROW.width * Math.cos(radians) + CARD_ROW.height * Math.sin(radians)) * state.scale * perspectiveScale;
  const height = (CARD_ROW.height * Math.cos(radians) + CARD_ROW.width * Math.sin(radians)) * state.scale * perspectiveScale;
  const centerX = CARD_ROW.left + index * (CARD_ROW.width + CARD_ROW.gap) + CARD_ROW.width / 2 + state.x * perspectiveScale;
  const centerY = CARD_ROW.top + CARD_ROW.height / 2 + state.y * perspectiveScale;
  return {left: centerX - width / 2, top: centerY - height / 2, right: centerX + width / 2, bottom: centerY + height / 2};
};

export const sourceFrame = (kind: SceneKind, localFrame: number): number => {
  const scene = SCENES.find((entry) => entry.kind === kind);
  if (!scene || !Number.isInteger(localFrame) || localFrame < 0 || localFrame >= scene.duration) {
    throw new Error('只允许当前窗口内的整数帧，禁止循环或末帧延长');
  }
  const result = scene.sourceFrom + localFrame;
  if (result >= scene.sourceLength) throw new Error('原片不足以覆盖当前连续窗口');
  return result;
};
export const titleLayerFrames = (localFrame: number) => ({
  background: sourceFrame('type-behind-subject', localFrame),
  foreground: sourceFrame('type-behind-subject', localFrame),
});
export const soundEnvelope = (frame: number, duration: number): number =>
  frame < 0 || frame >= duration ? 0 : Math.max(0, Math.min(1, (duration - frame - 1) / 3));
export const secondsForFrame = (frame: number) => frame / FPS;
