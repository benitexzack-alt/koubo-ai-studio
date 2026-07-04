import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {LocalFont} from './components/LocalFont';
import type {TalkProps} from './data/story';
import {colors, fontFamily} from './styles';

export const CoverStill: React.FC<TalkProps> = ({coverTitle, coverSubTitle, hostName}) => {
  return (
    <AbsoluteFill style={{background: '#050A12', overflow: 'hidden', fontFamily}}>
      <LocalFont />
      <Img
        src={staticFile('refs/IMG_1908_参考博主主页.PNG')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.14,
          filter: 'blur(8px) saturate(0.9)',
          transform: 'scale(1.04)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(5,10,18,0.96), rgba(5,10,18,0.72) 44%, rgba(5,10,18,0.9)), radial-gradient(circle at 70% 30%, rgba(25,211,255,0.28), transparent 34%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 74,
          top: 76,
          padding: '12px 18px',
          background: colors.yellow,
          color: '#050A12',
          borderRadius: 12,
          fontSize: 34,
          fontWeight: 900,
        }}
      >
        第一集
      </div>
      <div
        style={{
          position: 'absolute',
          left: 74,
          top: 178,
          width: 980,
          color: colors.ink,
          fontSize: 142,
          lineHeight: 0.96,
          fontWeight: 900,
          letterSpacing: 0,
          textShadow: '0 16px 50px rgba(0,0,0,0.45)',
        }}
      >
        {coverTitle}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 84,
          top: 480,
          padding: '10px 18px',
          color: colors.yellow,
          fontSize: 74,
          lineHeight: 1.1,
          fontWeight: 900,
          borderLeft: `12px solid ${colors.cyan}`,
          background: 'rgba(0,0,0,0.36)',
        }}
      >
        {coverSubTitle}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 84,
          bottom: 92,
          color: colors.muted,
          fontSize: 34,
          fontWeight: 800,
        }}
      >
        {hostName} · AI 落地观察
      </div>
      <div
        style={{
          position: 'absolute',
          right: 96,
          bottom: 86,
          width: 440,
          height: 440,
          border: '2px solid rgba(25,211,255,0.44)',
          borderRadius: 36,
          transform: 'rotate(-8deg)',
        }}
      />
    </AbsoluteFill>
  );
};
