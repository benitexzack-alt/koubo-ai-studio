import {Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {FullScreenBroll} from '../data/story';
import {colors, fontFamily} from '../styles';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const titleStyle: React.CSSProperties = {
  position: 'absolute',
  left: 72,
  top: 88,
  maxWidth: 820,
  fontFamily,
  color: colors.ink,
  textShadow: '0 4px 16px rgba(0,0,0,0.85)',
};

const BrollItem: React.FC<{item: FullScreenBroll}> = ({item}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const durationFrames = Math.max(1, Math.round((item.end - item.start) * fps));
  const localFrame = frame;
  const fade = Math.min(
    interpolate(localFrame, [0, Math.min(14, durationFrames / 2)], [0, 1], clamp),
    interpolate(localFrame, [Math.max(0, durationFrames - 14), durationFrames], [1, 0], clamp),
  );
  const zoom = interpolate(localFrame, [0, durationFrames], [1.015, 1.055], {
    ...clamp,
    easing: Easing.out(Easing.quad),
  });
  const accent = item.accent ?? colors.cyan;
  const mediaFilter = [
    `contrast(${item.blur ? 1.08 : 1.04})`,
    'saturate(1.08)',
    item.blur ? `blur(${item.blur}px)` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <AbsoluteFill style={{background: '#030713', opacity: fade, pointerEvents: 'none'}}>
      {item.kind === 'video' ? (
        <Video
          src={staticFile(item.src)}
          muted
          loop
          volume={0}
          style={{
            width: '100%',
            height: '100%',
            objectFit: item.fit ?? 'cover',
            transform: `scale(${zoom})`,
            filter: mediaFilter,
          }}
        />
      ) : (
        <Img
          src={staticFile(item.src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: item.fit ?? 'cover',
            transform: `scale(${zoom})`,
            filter: mediaFilter,
          }}
        />
      )}
      <AbsoluteFill style={{background: `rgba(2,6,16,${item.dim ?? 0.26})`}} />
      {item.title ? (
        <div style={titleStyle}>
          <div
            style={{
              width: 118,
              height: 5,
              borderRadius: 99,
              background: accent,
              boxShadow: `0 0 22px ${accent}AA`,
              marginBottom: 18,
            }}
          />
          <div style={{fontSize: 62, lineHeight: 1.02, fontWeight: 950, letterSpacing: 0}}>
            {item.title}
          </div>
          {item.subtitle ? (
            <div
              style={{
                marginTop: 16,
                maxWidth: 760,
                color: 'rgba(247,250,255,0.82)',
                fontSize: 29,
                lineHeight: 1.32,
                fontWeight: 780,
              }}
            >
              {item.subtitle}
            </div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const FullScreenBrollOverlay: React.FC<{brolls?: FullScreenBroll[]}> = ({brolls}) => {
  const {fps} = useVideoConfig();
  if (!brolls || brolls.length === 0) {
    return null;
  }

  return (
    <AbsoluteFill>
      {brolls.map((item) => (
        <Sequence
          key={`${item.src}-${item.start}`}
          from={Math.round(item.start * fps)}
          durationInFrames={Math.max(1, Math.round((item.end - item.start) * fps))}
          premountFor={fps}
        >
          <BrollItem item={item} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
