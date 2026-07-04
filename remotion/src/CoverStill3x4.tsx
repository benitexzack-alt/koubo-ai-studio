import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {LocalFont} from './components/LocalFont';
import type {TalkProps} from './data/story';
import {colors, fontFamily} from './styles';

export const CoverStill3x4: React.FC<TalkProps> = ({
  coverImageSrc,
  coverBgSrc,
  coverKicker,
  coverTitle,
  coverSubTitle,
  hostName,
}) => {
  const isPremium = Boolean(coverBgSrc);

  return (
    <AbsoluteFill style={{background: '#050A12', overflow: 'hidden', fontFamily}}>
      <LocalFont />
      {coverBgSrc && (
        <Img
          src={staticFile(coverBgSrc)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'contrast(1.12) saturate(1.1) brightness(0.86)',
          }}
        />
      )}
      <Img
        src={staticFile(coverImageSrc)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: isPremium ? '72% center' : 'center',
          opacity: isPremium ? 0.62 : 0.78,
          filter: isPremium
            ? 'contrast(1.18) saturate(1.04) brightness(1.12)'
            : 'contrast(1.08) saturate(1.06) brightness(0.82)',
          WebkitMaskImage: isPremium
            ? 'linear-gradient(90deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.24) 36%, rgba(0,0,0,1) 66%, rgba(0,0,0,1) 100%)'
            : undefined,
          maskImage: isPremium
            ? 'linear-gradient(90deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.24) 36%, rgba(0,0,0,1) 66%, rgba(0,0,0,1) 100%)'
            : undefined,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            isPremium
              ? 'linear-gradient(90deg, rgba(5,10,18,0.98) 0%, rgba(5,10,18,0.82) 47%, rgba(5,10,18,0.24) 72%, rgba(5,10,18,0.66) 100%), linear-gradient(180deg, rgba(5,10,18,0.54) 0%, rgba(5,10,18,0.08) 42%, rgba(5,10,18,0.94) 100%)'
              : 'linear-gradient(180deg, rgba(5,10,18,0.9) 0%, rgba(5,10,18,0.28) 36%, rgba(5,10,18,0.94) 100%)',
        }}
      />
      {isPremium && (
        <>
          <div
            style={{
              position: 'absolute',
              right: 62,
              top: 116,
              width: 300,
              height: 300,
              borderRadius: 999,
              border: `2px solid ${colors.cyan}66`,
              boxShadow: `0 0 80px ${colors.cyan}33`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 54,
              top: 700,
              width: 520,
              height: 138,
              borderRadius: 18,
              background: 'rgba(5,10,18,0.72)',
              border: `1px solid ${colors.cyan}77`,
              boxShadow: `0 0 50px ${colors.cyan}22`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 26,
                top: 22,
                color: colors.cyan,
                fontSize: 23,
                fontWeight: 950,
              }}
            >
              老板经验
            </div>
            <div
              style={{
                position: 'absolute',
                left: 166,
                top: 22,
                color: colors.yellow,
                fontSize: 23,
                fontWeight: 950,
              }}
            >
              结构化资料
            </div>
            <div
              style={{
                position: 'absolute',
                left: 354,
                top: 22,
                color: '#5CFF8F',
                fontSize: 23,
                fontWeight: 950,
              }}
            >
              AI执行
            </div>
            <div
              style={{
                position: 'absolute',
                left: 34,
                right: 34,
                top: 78,
                height: 5,
                borderRadius: 99,
                background: `linear-gradient(90deg, ${colors.cyan}, ${colors.yellow}, #5CFF8F)`,
                boxShadow: `0 0 24px ${colors.cyan}66`,
              }}
            />
          </div>
        </>
      )}
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
          fontSize: isPremium ? 27 : 32,
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {coverKicker ?? '本地 AI 落地'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: isPremium ? 430 : 54,
          top: isPremium ? 154 : 154,
          color: colors.ink,
          fontSize: isPremium ? 102 : 118,
          lineHeight: isPremium ? 0.96 : 0.98,
          fontWeight: 900,
          letterSpacing: 0,
          textShadow: isPremium
            ? `0 16px 52px rgba(0,0,0,0.7), 0 0 34px ${colors.cyan}44`
            : '0 16px 52px rgba(0,0,0,0.62)',
        }}
      >
        {coverTitle}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: isPremium ? 408 : 54,
          top: isPremium ? 420 : 440,
          padding: '14px 18px 20px',
          borderLeft: `14px solid ${colors.cyan}`,
          background: isPremium ? 'rgba(0,0,0,0.56)' : 'rgba(0,0,0,0.46)',
          color: colors.yellow,
          fontSize: isPremium ? 52 : 68,
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
          right: isPremium ? 408 : 54,
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
