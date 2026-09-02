import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';

export type NormalizedPoint = readonly [number, number];
export type NormalizedQuad = readonly [
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
];

export type PaperSurfaceTextKeyframe = {
  frame: number;
  anchorQuad: NormalizedQuad;
};

export type PaperSurfaceTextProps = {
  text: string;
  keyframes: readonly PaperSurfaceTextKeyframe[];
  sourceWidth?: number;
  sourceHeight?: number;
  enterFrame?: number;
  exitFrame?: number;
  zIndex?: number;
  color?: string;
  background?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  padding?: string;
  visibilityClipPath?: string;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const interpolateQuad = (
  keyframes: readonly PaperSurfaceTextKeyframe[],
  frame: number,
): NormalizedQuad => {
  const ordered = [...keyframes].sort((left, right) => left.frame - right.frame);
  if (ordered.length === 0) {
    throw new Error('PAPER_SURFACE_TEXT_KEYFRAMES_EMPTY');
  }
  if (frame <= ordered[0].frame) return ordered[0].anchorQuad;
  if (frame >= ordered[ordered.length - 1].frame) {
    return ordered[ordered.length - 1].anchorQuad;
  }
  const rightIndex = ordered.findIndex((keyframe) => keyframe.frame >= frame);
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  const progress = clamp01((frame - left.frame) / (right.frame - left.frame));
  return left.anchorQuad.map((point, index) => [
    point[0] + (right.anchorQuad[index][0] - point[0]) * progress,
    point[1] + (right.anchorQuad[index][1] - point[1]) * progress,
  ]) as unknown as NormalizedQuad;
};

export const quadToCssMatrix3d = ({
  anchorQuad,
  canvasWidth,
  canvasHeight,
  sourceWidth,
  sourceHeight,
}: {
  anchorQuad: NormalizedQuad;
  canvasWidth: number;
  canvasHeight: number;
  sourceWidth: number;
  sourceHeight: number;
}) => {
  const [[x0n, y0n], [x1n, y1n], [x2n, y2n], [x3n, y3n]] = anchorQuad;
  const x0 = x0n * canvasWidth;
  const y0 = y0n * canvasHeight;
  const x1 = x1n * canvasWidth;
  const y1 = y1n * canvasHeight;
  const x2 = x2n * canvasWidth;
  const y2 = y2n * canvasHeight;
  const x3 = x3n * canvasWidth;
  const y3 = y3n * canvasHeight;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const determinant = dx1 * dy2 - dx2 * dy1;

  let g = 0;
  let h = 0;
  if (Math.abs(dx3) > 1e-8 || Math.abs(dy3) > 1e-8) {
    if (Math.abs(determinant) < 1e-8) {
      throw new Error('PAPER_SURFACE_TEXT_QUAD_DEGENERATE');
    }
    g = (dx3 * dy2 - dx2 * dy3) / determinant;
    h = (dx1 * dy3 - dx3 * dy1) / determinant;
  }

  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const values = [
    a / sourceWidth,
    d / sourceWidth,
    0,
    g / sourceWidth,
    b / sourceHeight,
    e / sourceHeight,
    0,
    h / sourceHeight,
    0,
    0,
    1,
    0,
    x0,
    y0,
    0,
    1,
  ];
  return `matrix3d(${values.map((value) => Number(value.toFixed(10))).join(',')})`;
};

export const PaperSurfaceText: React.FC<PaperSurfaceTextProps> = ({
  text,
  keyframes,
  sourceWidth = 1000,
  sourceHeight = 240,
  enterFrame = 0,
  exitFrame,
  zIndex = 30,
  color = '#14272D',
  background = 'rgba(255,248,231,.88)',
  fontSize = 92,
  fontFamily = 'PingFang SC, Hiragino Sans GB, sans-serif',
  fontWeight = 900,
  padding = '0 54px',
  visibilityClipPath,
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  if (frame < enterFrame || (Number.isFinite(exitFrame) && frame > Number(exitFrame))) {
    return null;
  }
  const anchorQuad = interpolateQuad(keyframes, frame);
  const transform = quadToCssMatrix3d({
    anchorQuad,
    canvasWidth: width,
    canvasHeight: height,
    sourceWidth,
    sourceHeight,
  });
  return (
    <div
      data-paper-surface-text={text}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: sourceWidth,
        height: sourceHeight,
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
        padding,
        color,
        background,
        fontFamily,
        fontSize,
        fontWeight,
        lineHeight: 1,
        letterSpacing: 0,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        transformOrigin: '0 0',
        transform,
        clipPath: visibilityClipPath,
        overflow: 'hidden',
        zIndex,
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
};
