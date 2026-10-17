import {Easing, interpolate, spring} from 'remotion';

export const clampV3 = (value: number): number => Math.max(0, Math.min(1, value));

export const easeV3 = (
  frame: number,
  start: number,
  duration: number,
  easing = Easing.inOut(Easing.cubic),
): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

export const landV3 = (
  frame: number,
  start: number,
  fps: number,
  duration = Math.round(fps * 0.62),
): number =>
  clampV3(
    spring({
      frame: frame - start,
      fps,
      durationInFrames: duration,
      config: {damping: 16, stiffness: 145, mass: 1.08},
    }),
  );

export const settleV3 = (
  frame: number,
  start: number,
  fps: number,
  duration = Math.round(fps * 0.72),
): number =>
  clampV3(
    spring({
      frame: frame - start,
      fps,
      durationInFrames: duration,
      config: {damping: 200, stiffness: 115, mass: 1},
    }),
  );

