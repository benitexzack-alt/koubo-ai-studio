import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {Beat} from '../data/story';
import {colors, fontFamily} from '../styles';

export const BeatCards: React.FC<{beats: Beat[]}> = ({beats}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {beats.map((beat, index) => {
        const active = seconds >= beat.start && seconds < beat.end;
        const localFrame = frame - beat.start * fps;
        const progress = spring({
          frame: Math.max(0, localFrame),
          fps,
          config: {damping: 20, stiffness: 140},
        });
        const exit = interpolate(seconds, [beat.end - 0.28, beat.end], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        if (!active) {
          return null;
        }

        return (
          <div
            key={`${beat.start}-${beat.title}`}
            style={{
              position: 'absolute',
              left: 66,
              top: 98 + (index % 2) * 26,
              width: 548,
              padding: '24px 28px 26px',
              borderRadius: 22,
              background: colors.panelStrong,
              border: `1px solid ${beat.accent ?? colors.cyan}`,
              boxShadow: `0 20px 80px rgba(0,0,0,0.38), 0 0 44px ${(beat.accent ?? colors.cyan)}42`,
              opacity: exit,
              transform: `translateX(${interpolate(progress, [0, 1], [-80, 0])}px) scale(${interpolate(progress, [0, 1], [0.96, 1])})`,
              fontFamily,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                height: 34,
                padding: '0 13px',
                borderRadius: 999,
                background: `${beat.accent ?? colors.cyan}20`,
                color: beat.accent ?? colors.cyan,
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: beat.accent ?? colors.cyan,
                }}
              />
              {beat.eyebrow}
            </div>
            <div
              style={{
                marginTop: 18,
                color: colors.ink,
                fontSize: 46,
                lineHeight: 1.12,
                fontWeight: 900,
                letterSpacing: 0,
              }}
            >
              {beat.title}
            </div>
            <div
              style={{
                marginTop: 14,
                color: colors.muted,
                fontSize: 27,
                lineHeight: 1.36,
                fontWeight: 700,
              }}
            >
              {beat.detail}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
