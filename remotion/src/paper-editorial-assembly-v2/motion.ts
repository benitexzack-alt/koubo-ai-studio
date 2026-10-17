import {Easing, interpolate, spring} from 'remotion';

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const progress = (
  frame: number,
  startFrame: number,
  durationInFrames: number,
): number =>
  interpolate(frame, [startFrame, startFrame + durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

export const paperSpring = (
  frame: number,
  startFrame: number,
  fps: number,
  durationInFrames = Math.round(0.56 * fps),
): number =>
  clamp01(
    spring({
      frame: frame - startFrame,
      fps,
      durationInFrames,
      config: {damping: 18, stiffness: 155, mass: 0.9},
    }),
  );

export const softSpring = (
  frame: number,
  startFrame: number,
  fps: number,
  durationInFrames = Math.round(0.72 * fps),
): number =>
  clamp01(
    spring({
      frame: frame - startFrame,
      fps,
      durationInFrames,
      config: {damping: 200, stiffness: 110, mass: 1},
    }),
  );

export const drawProgress = (
  frame: number,
  startFrame: number,
  durationInFrames: number,
): number => progress(frame, startFrame, durationInFrames);

