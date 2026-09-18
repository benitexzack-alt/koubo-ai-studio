/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Wei Yihao
 * 原作者：Wei Yihao（Vincentwei1021），video-shotcraft。
 * 来源：https://github.com/Vincentwei1021/video-shotcraft
 * 固定提交：6c116cbd24eeb43c99d396696b509f8d88e58789
 * 许可：https://www.apache.org/licenses/LICENSE-2.0
 * 上游许可原文：
 * https://raw.githubusercontent.com/Vincentwei1021/video-shotcraft/6c116cbd24eeb43c99d396696b509f8d88e58789/LICENSE
 * 原生源码依赖（路径相对上游根目录，均已读取；运行时不请求这些文件）：
 * - demos/typography/marker-underline-title/MarkerUnderlineTitle.tsx
 * - demos/ui-entrance/list-reveal/ListReveal.tsx
 * - demos/effects/scanline-annotate-focus/ScanlineAnnotateFocus.tsx
 * - demos/transition/line-carry-transition/LineCarryTransition.tsx
 * - demos/ui-entrance/paper-craft-moves/MaskingTapeSlap.tsx
 * - demos/_fixtures/Motion.tsx（seg、lerp、outBack 等纯函数公式）
 * 卡路径依据：gallery/api/library.json 的 source 字段。
 *
 * 修改说明（2026-09-04）：提取五种运动，改为显式帧参数的中文透明叠层。
 * 保留原生缓动、分段节奏、马克笔变宽笔形和胶带按定关系；删除演示内容、
 * hooks、随机笔形、渐变、音频、镜头横移及全部 Popup 分支。
 * 马克笔改为固定毛边采样和正体字水平笔势；列表改为外部指定逐项起点；
 * 扫描框只标注传入矩形；接力线在局部固定画布运动，不移动底层视频；
 * 胶带仅装饰传入真实图卡，入位位移降为 24px，不代表摄影纸艺制作。
 *
 * 本文件按 Apache License 2.0 提供，不附带任何明示或默示保证。
 * 再分发本源码或衍生作品时，须随附上游完整许可并保留本归属及修改说明。
 *
 * 使用约定：frame 为当前效果的局部帧；fps > 0；durationInFrames 为正整数。
 * 生效区间为 [0, durationInFrames)，区间外只隐藏外盒，保留尺寸及 children。
 * 原生动作以 30fps 换算成秒；短片段压缩动作，长片段延长最终保持态。
 * KeywordReveal 的 atFrame 始终是实际局部帧，整体漂移贯穿实际片段。
 * 外层负责定位、内容真实性、字体预加载、人物/字幕避让和最终动态验收。
 * 运行时仅依赖 React；无 Remotion 依赖，无新增 npm 包、外部资源或媒体控制。
 */
import * as React from 'react';

export interface ShotcraftTimingProps {
  frame: number;
  fps: number;
  durationInFrames: number;
}

export interface MarkerUnderlineProps extends ShotcraftTimingProps {
  before?: string;
  keyword: string;
  after?: string;
  fontSize?: number;
}

export interface KeywordRevealItem {
  text: string;
  /** 实际局部帧，不参与短片段时间压缩；顺序保持传入顺序。 */
  atFrame: number;
}

export interface KeywordRevealProps extends ShotcraftTimingProps {
  items: Array<KeywordRevealItem>;
  fontSize?: number;
}

export interface EvidenceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvidenceScanProps extends ShotcraftTimingProps {
  width: number;
  height: number;
  /** 相对 overlay 左上角的实际像素；必须完整位于 width × height 内。 */
  rect: EvidenceRect;
  label: string;
}

export interface LineCarryProps extends ShotcraftTimingProps {
  fromLabel: string;
  toLabel: string;
  width?: number;
}

export interface PaperTapePinProps extends ShotcraftTimingProps {
  /** 真实图卡；以 objectFit: 'contain' 填入固定图卡槽，不改写或截取内容。 */
  children: React.ReactNode;
  width?: number;
}

/** 所有字号均为 1920 × 1080 原尺寸像素，fontSize 参数最低钳制到 36。 */
export const SHOTCRAFT_DEFAULTS = Object.freeze({
  fontFamily: '"PingFang SC", "Source Han Sans SC", "Noto Sans CJK SC", sans-serif',
  minimumFontSize: 36,
  markerFontSize: 64,
  keywordFontSize: 52,
  evidenceFontSize: 36,
  lineFontSize: 44,
  lineWidth: 960,
  paperWidth: 640,
  before: '',
  after: '',
});

const COLOR = { white: '#f5f7f8', cyan: '#60d3ee', yellow: '#e8c76d' } as const;
const typography: React.CSSProperties = {
  fontFamily: SHOTCRAFT_DEFAULTS.fontFamily,
  fontWeight: 800,
  letterSpacing: 0,
  color: COLOR.white,
  lineHeight: 1.3,
  overflowWrap: 'anywhere',
  textShadow: '0 2px 5px rgba(0,0,0,0.5)',
};

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (t: number, a: number, b: number) => a + (b - a) * t;
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const outQuad = (t: number) => t * (2 - t);
const inOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const outBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const seg = (t: number, a: number, b: number, ease = (p: number) => p) =>
  ease(b <= a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} 必须是有限数值。`);
  return value;
}

function positive(name: string, value: number): number {
  if (finite(name, value) <= 0) throw new RangeError(`${name} 必须大于零。`);
  return value;
}

function fontPixels(value: number): number {
  return Math.max(SHOTCRAFT_DEFAULTS.minimumFontSize, positive('fontSize', value));
}

function timing(props: ShotcraftTimingProps, nativeLastFrame: number) {
  const { frame, fps, durationInFrames } = props;
  finite('frame', frame);
  positive('fps', fps);
  if (!Number.isInteger(durationInFrames) || durationInFrames < 1) {
    throw new RangeError('durationInFrames 必须是正整数。');
  }
  const last = durationInFrames - 1;
  const local = Math.min(last, Math.max(0, frame));
  const end30 = last * 30 / fps;
  return {
    local,
    last,
    t: last === 0 ? 1 : local / last,
    f: last === 0 ? nativeLastFrame : Math.min(nativeLastFrame, local * 30 / fps / Math.min(1, end30 / nativeLastFrame)),
    visible: frame >= 0 && frame < durationInFrames,
  };
}

function surface(visible: boolean): React.CSSProperties {
  return {
    position: 'relative',
    boxSizing: 'border-box',
    flexShrink: 0,
    pointerEvents: 'none',
    visibility: visible ? 'visible' : 'hidden',
    background: 'transparent',
    ...typography,
  };
}

// 固定采样取代上游随机种子，保持中段饱满、首尾收尖和不规则毛边。
const MARKER_EDGE = [0.16, -0.33, 0.27, -0.08, 0.38, -0.21, 0.09, -0.41, 0.22, -0.12, 0.34];
const MARKER_PATH = (() => {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const wobble = MARKER_EDGE[i % MARKER_EDGE.length];
    const mid = 19 + Math.sin(t * Math.PI * 1.6 + 0.4) * 2.6 + wobble * 1.6;
    const width = Math.max(2.2, 14 + Math.sin(t * Math.PI) * 6 - Math.max(0, t - 0.86) * 46 + wobble * 3);
    top.push(`${(t * 252).toFixed(2)},${(mid - width / 2).toFixed(2)}`);
    bottom.push(`${(t * 252).toFixed(2)},${(mid + width / 2).toFixed(2)}`);
  }
  return `M${top.join('L')}L${bottom.reverse().join('L')}Z`;
})();

/** 宽度占满调用者容器；全部文字始终参与排版，关键词下划线不占布局空间。 */
export function MarkerUnderline({
  before = SHOTCRAFT_DEFAULTS.before,
  keyword,
  after = SHOTCRAFT_DEFAULTS.after,
  fontSize = SHOTCRAFT_DEFAULTS.markerFontSize,
  ...props
}: MarkerUnderlineProps): React.ReactElement {
  const { f, visible } = timing(props, 45);
  const size = fontPixels(fontSize);
  const enter = seg(f, 0, 22);
  const draw = 1 - Math.pow(1 - seg(f, 32, 42), 2.2);
  return (
    <div style={{ ...surface(visible), width: '100%', minWidth: 0, paddingBottom: size * 0.24, fontSize: size }}>
      <div style={{ opacity: Math.min(1, enter * 1.6), transform: `translateY(${36 * (1 - outCubic(enter))}px)` }}>
        {before}
        <span style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', color: COLOR.cyan }}>
          {keyword}
          <svg aria-hidden="true" viewBox="0 0 252 44" preserveAspectRatio="none" style={{
            position: 'absolute', left: 0, bottom: -size * 0.18, width: '100%', height: size * 0.3,
            clipPath: `inset(0 ${100 * (1 - draw)}% 0 0)`, overflow: 'visible',
          }}>
            <path d={MARKER_PATH} fill={COLOR.yellow} />
          </svg>
        </span>
        {after}
      </div>
    </div>
  );
}

/** 不渲染菜单、图标或占位项；行高由完整文字决定，出现前也保留行槽。 */
export function KeywordReveal({ items, fontSize = SHOTCRAFT_DEFAULTS.keywordFontSize, ...props }: KeywordRevealProps): React.ReactElement {
  const { t, local, last, visible } = timing(props, 107);
  const size = fontPixels(fontSize);
  return (
    <div style={{ ...surface(visible), width: '100%', minWidth: 0, padding: '32px 16px', fontSize: size }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, transform: `translateY(${lerp(t, 16, -16)}px)` }}>
        {items.map(({ text, atFrame }, index) => {
          if (finite('atFrame', atFrame) < 0) throw new RangeError('atFrame 不得小于零。');
          const end = Math.min(last, atFrame + 0.24 * 107 * props.fps / 30);
          const p = atFrame > last ? 0 : seg(local, atFrame, end, outBack);
          return (
            <div key={index} style={{
              minWidth: 0, opacity: clamp(p * 2.2), color: index === 0 ? COLOR.cyan : COLOR.white,
              transform: `scale(${0.78 + Math.max(0, p) * 0.22}) translateY(${lerp(Math.max(0, p), 14, 0)}px)`,
              transformOrigin: 'left center',
            }}>{text}</div>
          );
        })}
      </div>
    </div>
  );
}

// 中文按一个字占一格保守折行，保留所有字符；只用于已知像素宽度的固定图形标签。
function wrapLabel(text: string, width: number, fontSize: number): string[] {
  const columns = Math.max(1, Math.floor(width / fontSize));
  return text.split('\n').flatMap((line) => {
    const chars = Array.from(line);
    return Array.from({ length: Math.max(1, Math.ceil(chars.length / columns)) }, (_, i) => chars.slice(i * columns, (i + 1) * columns).join(''));
  });
}

/** 固定 width × height 的纯透明叠层；不加载、不推断、不替换下层画面。 */
export function EvidenceScan({ width, height, rect, label, ...props }: EvidenceScanProps): React.ReactElement {
  positive('width', width);
  positive('height', height);
  finite('rect.x', rect.x);
  finite('rect.y', rect.y);
  positive('rect.width', rect.width);
  positive('rect.height', rect.height);
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > width || rect.y + rect.height > height) {
    throw new RangeError('证据矩形必须完整位于传入画面内，不自动移动或缩放框选内容。');
  }
  const { f, visible } = timing(props, 137);
  const t = f / 137;
  const overscan = height / 9;
  const scanY = lerp(seg(t, 0.06, 0.66), -overscan, height + overscan);
  const trigger = 0.06 + (rect.y + rect.height + overscan) / (height + overscan * 2) * 0.6;
  const focus = seg(t, trigger, trigger + 0.11, outCubic);
  const scale = lerp(outBack(seg(t, trigger, trigger + 0.13)), 1.75, 1);
  const flash = 0.07 * seg(t, trigger + 0.04, trigger + 0.09) * (1 - seg(t, trigger + 0.09, trigger + 0.22));
  const labelProgress = seg(t, trigger + 0.05, trigger + 0.16, outCubic);
  const labelWidth = Math.min(width - 16, Math.max(320, rect.width));
  const lines = wrapLabel(label, labelWidth - 24, SHOTCRAFT_DEFAULTS.evidenceFontSize);
  const labelHeight = lines.length * 47 + 16;
  if (label && (labelWidth < 60 || labelHeight > height - 16)) {
    throw new RangeError('证据叠层不足以容纳 36px 完整标注，请扩大叠层或缩短传入标注。');
  }
  const labelX = Math.max(8, Math.min(rect.x, width - labelWidth - 8));
  const preferredY = rect.y >= labelHeight + 20 ? rect.y - labelHeight - 12 : rect.y + rect.height + 12;
  const labelY = Math.max(8, Math.min(preferredY, height - labelHeight - 8));
  const arm = Math.min(36, rect.width / 3, rect.height / 3);
  const stroke = Math.min(4, arm / 3);
  const border = `${stroke}px solid ${COLOR.cyan}`;
  const corners: React.CSSProperties[] = [
    { left: 0, top: 0, borderLeft: border, borderTop: border },
    { right: 0, top: 0, borderRight: border, borderTop: border },
    { left: 0, bottom: 0, borderLeft: border, borderBottom: border },
    { right: 0, bottom: 0, borderRight: border, borderBottom: border },
  ];
  return (
    <div style={{ ...surface(visible), width, height, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height,
        opacity: Math.min(1, focus * 1.6), transform: `scale(${scale})`, transformOrigin: 'center',
      }}>
        {corners.map((corner, index) => <div key={index} style={{ position: 'absolute', width: arm, height: arm, boxSizing: 'border-box', ...corner }} />)}
        <div style={{ position: 'absolute', inset: stroke, background: COLOR.white, opacity: flash }} />
      </div>
      <div style={{
        position: 'absolute', left: 0, top: 0, width, height: 3, background: COLOR.cyan,
        transform: `translateY(${scanY}px)`,
        opacity: seg(t, 0.04, 0.09) * (1 - seg(t, 0.66, 0.71)),
        boxShadow: '0 0 10px rgba(96,211,238,0.3)',
      }} />
      {label && <div style={{
        position: 'absolute', left: labelX, top: labelY, width: labelWidth, height: labelHeight,
        boxSizing: 'border-box', padding: '8px 12px', fontSize: SHOTCRAFT_DEFAULTS.evidenceFontSize,
        lineHeight: '47px', whiteSpace: 'pre-wrap', background: 'rgba(12,14,16,0.58)', borderRadius: 4,
        opacity: labelProgress, transform: `translateY(${4 * (1 - labelProgress)}px)`,
      }}>{lines.join('\n')}</div>}
    </div>
  );
}

type Point = readonly [number, number];

function pointAt(points: Point[], length: number): Point {
  let remaining = Math.max(0, length);
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1];
    const [nextX, nextY] = points[i];
    const distance = Math.hypot(nextX - x, nextY - y);
    if (remaining <= distance) return [lerp(remaining / distance, x, nextX), lerp(remaining / distance, y, nextY)];
    remaining -= distance;
  }
  return points[points.length - 1];
}

/** 固定局部画布中的单线接力；宽度默认 960，至少 320；高度随文字量确定。 */
export function LineCarry({ fromLabel, toLabel, width = SHOTCRAFT_DEFAULTS.lineWidth, ...props }: LineCarryProps): React.ReactElement {
  if (positive('width', width) < 320) throw new RangeError('LineCarry 的 width 至少为 320px。');
  const { f, visible } = timing(props, 159);
  const gap = 64;
  const labelWidth = (width - 48 - gap) / 2;
  const fromLines = wrapLabel(fromLabel, labelWidth, SHOTCRAFT_DEFAULTS.lineFontSize);
  const toLines = wrapLabel(toLabel, labelWidth, SHOTCRAFT_DEFAULTS.lineFontSize);
  const textHeight = Math.max(fromLines.length, toLines.length) * 58;
  const left = 12;
  const rightX = left + labelWidth + gap;
  const top = 12;
  const boxHeight = textHeight + 32;
  const boxWidth = labelWidth + 24;
  const bottom = top + boxHeight;
  const points: Point[] = [[left, bottom], [rightX, bottom], [rightX, top], [rightX + boxWidth, top], [rightX + boxWidth, bottom], [rightX, bottom]];
  const horizontal = rightX - left;
  const total = horizontal + 2 * (boxHeight + boxWidth);
  const first = labelWidth;
  const second = first + gap / 2;
  const third = horizontal + boxHeight + boxWidth * 0.5;
  const drawn = f < 24 ? lerp(seg(f, 0, 24, outCubic), 0, first)
    : f < 34 ? lerp(seg(f, 24, 34), first, second)
      : f < 94 ? lerp(seg(f, 34, 94, inOutCubic), second, third)
        : lerp(seg(f, 94, 112, outCubic), third, total);
  const [tipX, tipY] = pointAt(points, drawn);
  const height = bottom + 16;
  const labelStyle: React.CSSProperties = {
    position: 'absolute', top: top + 16, width: labelWidth, height: textHeight,
    whiteSpace: 'pre-wrap', fontSize: SHOTCRAFT_DEFAULTS.lineFontSize, lineHeight: '58px',
  };
  return (
    <div style={{ ...surface(visible), width, height }}>
      <div style={{ ...labelStyle, left }}>{fromLines.join('\n')}</div>
      <svg aria-hidden="true" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
        <path d={points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')}
          fill="none" stroke={COLOR.cyan} strokeWidth={4} strokeLinecap="round" strokeLinejoin="miter"
          strokeDasharray={`${total} ${total}`} strokeDashoffset={total - drawn} />
        {f < 118 && <circle cx={tipX} cy={tipY} r={6} fill={COLOR.yellow} opacity={1 - seg(f, 112, 118)} />}
      </svg>
      <div style={{ ...labelStyle, left: rightX + 12, color: COLOR.cyan, opacity: seg(f, 112, 124) }}>{toLines.join('\n')}</div>
    </div>
  );
}

const TAPE_EDGE = 'polygon(0% 8%, 2.5% 0%, 97% 3%, 100% 12%, 98.2% 30%, 100% 52%, 98% 74%, 100% 90%, 96.5% 100%, 3% 97%, 0% 88%, 1.8% 64%, 0% 42%, 2% 22%)';
const paperAmplitude = (f: number) => seg(f, 38, 46) * lerp(seg(f, 58, 62), 1, 0.45);
const paperRotation = (f: number) => paperAmplitude(f) * 1.5 * Math.sin((f - 38) * 0.16);
const paperBob = (f: number) => paperAmplitude(f) * 5 * Math.sin((f - 38) * 0.11);
const pinMotion = (f: number, raw: (frame: number) => number) => f <= 82 ? raw(f) : lerp(seg(f, 82, 84), raw(82), 0);

/**
 * 默认外盒 640 × 488；width 至少 240，图卡槽 (width-64) × (width-64)*5/8。
 * 外盒高 = 图卡槽高 + 128，槽左上角 (32,64)，两条胶带位于对角。
 * children 始终原样挂载；只停止图卡外壳摆动，不冻结或控制 children 的视频。
 */
export function PaperTapePin({ children, width = SHOTCRAFT_DEFAULTS.paperWidth, ...props }: PaperTapePinProps): React.ReactElement {
  if (positive('width', width) < 240) throw new RangeError('PaperTapePin 的 width 至少为 240px。');
  const { f, visible } = timing(props, 139);
  const cardWidth = width - 64;
  const cardHeight = cardWidth * 5 / 8;
  const pin = seg(f, 82, 84);
  const tapeWidth = Math.min(240, cardWidth * 0.42);
  const tapeHeight = tapeWidth * 68 / 320;
  const tape = (land: number, x: number, y: number, side: number) => {
    if (f < land - 6) return null;
    const approach = seg(f, land - 6, land, outCubic);
    const rotation = f <= land ? lerp(seg(f, land - 6, land, outQuad), -61, -38) : lerp(seg(f, land, land + 4, outQuad), -38, -45);
    // 将落帧量化到实际采样帧，避免 24/60fps 或短片段跳过一帧压扁。
    const end30 = (props.durationInFrames - 1) * 30 / props.fps;
    const compression = Math.min(1, end30 / 139);
    const landingFrame = Math.ceil(land * props.fps / 30 * compression - 1e-9);
    const sinceLanding = Math.floor(props.frame) - landingFrame;
    const squash = f >= land + 4 ? 1 : sinceLanding === 0 ? 0.72 : sinceLanding === 1 ? 0.9 : 1;
    return <div key={land} aria-hidden="true" style={{
      position: 'absolute', left: x - tapeWidth / 2, top: y - tapeHeight / 2, width: tapeWidth, height: tapeHeight,
      transform: `translate(${side * 96 * (1 - approach)}px, ${side * 72 * (1 - approach)}px) rotate(${rotation}deg) scale(${lerp(approach, 1.45, 1)}) scaleY(${squash})`,
      transformOrigin: 'center', opacity: 0.75 * seg(f, land - 6, land - 4),
      background: COLOR.yellow, clipPath: TAPE_EDGE, boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    }} />;
  };
  return (
    <div style={{ ...surface(visible), width, height: cardHeight + 128 }}>
      <div style={{
        position: 'absolute', left: 32, top: 64, width: cardWidth, height: cardHeight,
        opacity: seg(f, 12, 22), transformOrigin: 'center',
        transform: `translateY(${lerp(seg(f, 12, 38, outCubic), -24, 0) + pinMotion(f, paperBob) + 2 * pin}px) rotate(${pinMotion(f, paperRotation)}deg)`,
        boxShadow: `0 ${lerp(pin, 16, 3)}px ${lerp(pin, 34, 8)}px rgba(0,0,0,${lerp(pin, 0.22, 0.1)})`,
        fontSize: SHOTCRAFT_DEFAULTS.minimumFontSize,
      }}>{children}</div>
      {tape(58, 32 + cardWidth * 0.1, 64 + cardHeight * 0.11, -1)}
      {tape(82, 32 + cardWidth * 0.9, 64 + cardHeight * 0.89, 1)}
    </div>
  );
}
