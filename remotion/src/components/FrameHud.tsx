import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, fontFamily} from '../styles';

export const FrameHud: React.FC<{
  hostName: string;
  identity: string;
  topic: string;
  footerTag: string;
}> = ({hostName, identity, topic, footerTag}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{pointerEvents: 'none', fontFamily}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.3), rgba(0,0,0,0.02) 48%, rgba(0,0,0,0.22)), linear-gradient(0deg, rgba(0,0,0,0.42), rgba(0,0,0,0) 42%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 66,
          bottom: 46,
          right: 66,
          height: 6,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.yellow})`,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 66,
          top: 38,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 18px',
          borderRadius: 18,
          background: colors.panel,
          border: '1px solid rgba(255,255,255,0.15)',
          color: colors.ink,
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        <span style={{color: colors.yellow}}>AI FIELD NOTES</span>
        <span style={{color: 'rgba(255,255,255,0.32)'}}>|</span>
        <span>{hostName}</span>
        <span style={{color: colors.muted, fontWeight: 700}}>{identity}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 66,
          top: 42,
          maxWidth: 690,
          padding: '14px 20px',
          borderRadius: 18,
          background: 'rgba(255,210,63,0.92)',
          color: '#050A12',
          fontSize: 32,
          lineHeight: 1.1,
          fontWeight: 900,
          textAlign: 'right',
        }}
      >
        {topic}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 66,
          bottom: 66,
          color: 'rgba(255,255,255,0.58)',
          fontSize: 22,
          fontWeight: 800,
        }}
      >
        {footerTag}
      </div>
    </AbsoluteFill>
  );
};
