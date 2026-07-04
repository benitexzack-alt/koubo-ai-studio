import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {LocalFont} from './components/LocalFont';
import type {TalkProps} from './data/story';
import {colors, fontFamily} from './styles';

export const CoverStill3x4: React.FC<TalkProps> = ({
  coverImageSrc,
  coverTitle,
  coverSubTitle,
  hostName,
}) => {
  return (
    <AbsoluteFill style={{background: '#050A12', overflow: 'hidden', fontFamily}}>
      <LocalFont />
      <Img
        src={staticFile(coverImageSrc)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.78,
          filter: 'contrast(1.08) saturate(1.06) brightness(0.82)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(5,10,18,0.9) 0%, rgba(5,10,18,0.28) 36%, rgba(5,10,18,0.94) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 64,
          height: 54,
          padding: '0 20px',
          borderRadius: 10,
          background: colors.yellow,
          color: '#050A12',
          fontSize: 32,
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        本地 AI 落地
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
          top: 154,
          color: colors.ink,
          fontSize: 118,
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
          left: 54,
          right: 54,
          top: 440,
          padding: '14px 18px 20px',
          borderLeft: `14px solid ${colors.cyan}`,
          background: 'rgba(0,0,0,0.46)',
          color: colors.yellow,
          fontSize: 68,
          lineHeight: 1.08,
          fontWeight: 900,
          textShadow: '0 8px 30px rgba(0,0,0,0.62)',
        }}
      >
        {coverSubTitle}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
          bottom: 112,
          padding: '18px 22px',
          borderRadius: 16,
          background: 'rgba(5,10,18,0.78)',
          border: '1px solid rgba(255,255,255,0.14)',
          color: colors.ink,
          fontSize: 32,
          lineHeight: 1.28,
          fontWeight: 850,
        }}
      >
        {hostName} · 甘肃小微企业 AI 实战
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          bottom: 58,
          color: 'rgba(247,250,255,0.68)',
          fontSize: 23,
          fontWeight: 800,
        }}
      >
        短视频选题 · 客服话术 · 门店曝光 · 流程梳理
      </div>
    </AbsoluteFill>
  );
};
