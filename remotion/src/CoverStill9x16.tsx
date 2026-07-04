import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {LocalFont} from './components/LocalFont';
import type {TalkProps} from './data/story';
import {colors, fontFamily} from './styles';

export const CoverStill9x16: React.FC<TalkProps> = ({coverTitle, coverSubTitle, hostName}) => {
  return (
    <AbsoluteFill style={{background: '#050A12', overflow: 'hidden', fontFamily}}>
      <LocalFont />
      <Img
        src={staticFile('covers/cover-base-face.jpg')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.7,
          filter: 'contrast(1.08) saturate(1.04) brightness(0.82)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(5,10,18,0.88) 0%, rgba(5,10,18,0.34) 38%, rgba(5,10,18,0.92) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 58,
          top: 86,
          height: 58,
          padding: '0 22px',
          borderRadius: 12,
          background: colors.yellow,
          color: '#050A12',
          fontSize: 34,
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        第一集
      </div>
      <div
        style={{
          position: 'absolute',
          left: 58,
          right: 58,
          top: 188,
          color: colors.ink,
          fontSize: 132,
          lineHeight: 0.98,
          fontWeight: 900,
          letterSpacing: 0,
          textShadow: '0 16px 52px rgba(0,0,0,0.62)',
        }}
      >
        {coverTitle}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 58,
          right: 58,
          top: 488,
          padding: '14px 18px 20px',
          borderLeft: `14px solid ${colors.cyan}`,
          background: 'rgba(0,0,0,0.42)',
          color: colors.yellow,
          fontSize: 74,
          lineHeight: 1.1,
          fontWeight: 900,
          textShadow: '0 8px 30px rgba(0,0,0,0.62)',
        }}
      >
        {coverSubTitle}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 58,
          right: 58,
          bottom: 134,
          padding: '18px 22px',
          borderRadius: 18,
          background: 'rgba(5,10,18,0.78)',
          border: '1px solid rgba(255,255,255,0.14)',
          color: colors.ink,
          fontSize: 34,
          lineHeight: 1.28,
          fontWeight: 850,
        }}
      >
        {hostName} · 服务甘肃本地小微企业
      </div>
      <div
        style={{
          position: 'absolute',
          left: 58,
          bottom: 78,
          color: 'rgba(247,250,255,0.66)',
          fontSize: 24,
          fontWeight: 800,
        }}
      >
        AI | 甘肃本地 | 小微企业 | OPC
      </div>
    </AbsoluteFill>
  );
};
