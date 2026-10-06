import {Easing, interpolate, spring} from 'remotion';
import {FPS, type EffectKind} from './plan.ts';

export const progress = (frame: number, from: number, to: number): number => {
  if (!Number.isFinite(frame) || to <= from) throw new Error('帧或区间不合法');
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
};
export const entered = (frame: number, at: number, duration = 12): number => progress(frame, at, at + duration);
export const windowOpacity = (frame: number, from: number, to: number): number =>
  entered(frame, from, 6) * (1 - progress(frame, to - 6, to));
export const chapterSettle = (frame: number): number => spring({
  frame: frame - 5, fps: FPS, config: {damping: 22, stiffness: 180, mass: 0.65},
});
export const soundEnvelope = (frame: number, duration: number): number => {
  if (frame < 0 || frame >= duration) return 0;
  // 短点击的主瞬态可能位于最初 20 ms，不再用两帧淡入压掉它。
  // WAV 起点的防爆音短渐入由本期派生文件处理，组件仅压短尾。
  return Math.max(0, Math.min(1, (duration - frame - 1) / 3));
};

/** 被组件和边界测试共同使用的纯帧状态，不依赖时钟、随机数或浏览器副作用。 */
export const frameState = (kind: EffectKind, frame: number): readonly number[] => {
  switch (kind) {
    case 'burst': return [windowOpacity(frame, 15, 47), progress(frame, 15, 47), entered(frame, 79, 30)];
    case 'chapter': return [entered(frame, 5, 10), chapterSettle(frame), entered(frame, 16, 6)];
    case 'list': return [0, 1, 2, 3].map((index) => entered(frame, 10 + index * 29));
    case 'opposing': return [windowOpacity(frame, 11, 60), entered(frame, 66, 8), entered(frame, 83, 8)];
    case 'pipeline': return [entered(frame, 5), entered(frame, 29), entered(frame, 53),
      entered(frame, 72), progress(frame, 102, 125), entered(frame, 123, 22), entered(frame, 149, 19)];
    case 'equation': return [entered(frame, 5), entered(frame, 20, 8), entered(frame, 25), entered(frame, 47, 17)];
  }
};
