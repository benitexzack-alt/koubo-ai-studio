/** 本期三个真实口播窗口的独立参考适配实验，不是完整成片或已接纳生产计划。 */
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FONT_FAMILY = 'R2-Smiley-Sans';
export const TYPE = {headline: 400, body: 44, label: 32} as const;
export const ASSETS = {
  base: 'motion-upgrade-r2/base.mp4',
  titleTake: 'motion-upgrade-r2/title-take.mp4',
  presenterMatte: 'motion-upgrade-r2/presenter-matte.webm',
  font: 'motion-upgrade-r2/fonts/smiley-sans.woff2',
  doubao: 'motion-upgrade-r2/tools/doubao.png',
  workbuddy: 'motion-upgrade-r2/tools/workbuddy.png',
  codex: 'motion-upgrade-r2/tools/codex.png',
} as const;

export const TITLE = '10个AI赚钱生意';
export const TITLE_PAINTED_WIDTH = 1730;
export const TITLE_MOTION = {
  punchAt: 0.85 * FPS, punchEnd: 1.12 * FPS, settleEnd: 1.30 * FPS,
  clearAt: 4.72 * FPS, clearEnd: 4.84 * FPS,
} as const;
/** 原版1.4倍裁切不适合本期近景；底片与alpha层共同使用原尺寸、相同锚点。 */
export const TITLE_VIDEO_STYLE = {
  position: 'absolute', left: 0, top: 0,
  width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%',
  transform: 'translateX(0px) scale(1)', transformOrigin: '50% 50%',
} as const;
export const TITLE_LAYER_ORDER = ['background-video', 'title-tint', 'title', 'same-frame-presenter-matte'] as const;

export const SCENES = [
  {kind: 'type-behind-subject', from: 0, duration: 162, source: ASSETS.titleTake, sourceFrom: 0, sourceLength: 162, narrationFrom: 132},
  {kind: 'transition-tile-dissolve', from: 162, duration: 204, source: ASSETS.base, sourceFrom: 990, sourceLength: 1800, narrationFrom: 990},
  {kind: 'cards-foreground-row', from: 366, duration: 240, source: ASSETS.base, sourceFrom: 1110, sourceLength: 1800, narrationFrom: 1110},
] as const;
export type SceneKind = (typeof SCENES)[number]['kind'];
export const DEMO_FRAMES = 606;

export const TILE = {
  columns: 8, rows: 5, width: 240, height: 216,
  coverAt: 1.15 * FPS, cellDuration: 0.09 * FPS, stagger: 0.009 * FPS,
  statementAt: 1.60 * FPS, statementIn: 0.14 * FPS,
  statementOut: 3.45 * FPS, statementOutDuration: 0.10 * FPS,
  returnAt: 3.56 * FPS,
  canvas: '#111F2B', grid: 'rgba(196,210,221,0.075)',
  text: '#F5F5F5', accent: '#D9B871',
  mark: '第二个生意', lines: ['垂类行业', '数据集生产'],
} as const;

export const FACE_PROTECTION = {left: 820, top: 150, width: 650, height: 595} as const;
export const SUBTITLE_PROTECTION = {left: 96, top: 956, width: 1728, height: 124} as const;
export const CARD_ROW = {left: 432, top: 752, width: 320, height: 184, gap: 48, imageSize: 94} as const;
export const CARD_ENTRY_DURATION = 0.38 * FPS;
export const TOOLS = [
  {key: 'doubao', label: '豆包工作', image: ASSETS.doubao, spokenAtSeconds: 38.060, at: 32},
  {key: 'workbuddy', label: 'WorkBuddy', image: ASSETS.workbuddy, spokenAtSeconds: 38.860, at: 56},
  {key: 'codex', label: 'Codex', image: ASSETS.codex, spokenAtSeconds: 39.650, at: 80},
] as const;

export interface SoundCue {at: number; duration: number; source: string; gain: number; role: string}
const sound = (at: number, asset: string, duration: number, gain: number, role: string): SoundCue => ({
  at, duration, source: `motion-upgrade-r1/sfx/${asset}.wav`, gain, role,
});
/** 复用本期已准备派生WAV；原声始终保留，最终可感知度须正常速度试听。 */
export const SOUND_CUES: Record<SceneKind, readonly SoundCue[]> = {
  'type-behind-subject': [sound(26, 'hook', 11, 0.9, '标题冲入落点')],
  'transition-tile-dissolve': [sound(35, 'sweep', 6, 0.85, '格子中心展开'),
    sound(48, 'confirm', 5, 0.85, '章名读稳'), sound(107, 'sweep', 6, 0.8, '格子从边缘返回')],
  'cards-foreground-row': [sound(32, 'slide', 12, 0.85, '豆包工作整卡入场'),
    sound(56, 'click', 9, 0.9, 'WorkBuddy整卡入场'), sound(80, 'confirm', 5, 0.9, 'Codex整卡入场')],
};
export const EXPERIMENT = {
  independentEntry: 'src/ten-ai-businesses-motion-upgrade-r2/index.tsx',
  status: '待用户正常速度审阅', productionAdopted: false,
  narration: '三个原片片段原声，播放速度1，matte静音',
  titleDifference: '6.8秒原例适配为5.4秒同帧take；改在4.72秒清题，保留末尾真人；不套1.4倍近景裁切',
  tileDifference: '保留8×5中心展开和边缘返回；目的地换成暗蓝金点章名，属于独立转场实验',
  cardDifference: '四张示例卡换为三张真实产品图；按本期38.060/38.860/39.650秒触发，移至脸部下方',
} as const;
