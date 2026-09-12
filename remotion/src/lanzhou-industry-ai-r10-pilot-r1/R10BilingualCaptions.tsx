import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

import bilingualDocument from '../../../edit/20260910_lanzhou_industry_ai/05_实录与字幕/actual-spoken.bilingual.candidate.v1.json';
import {
  R10_DURATION_IN_FRAMES,
  R10_FPS,
  R10_SOURCE_TRIM_BEFORE,
} from './runtime-contract';

type SourceCaption = {
  id: string;
  beatId: string;
  startMs: number;
  endMs: number;
  zh: string;
  en: string;
};

type BilingualDocument = {
  canonicalSource: string;
  englishTranslationSource: string;
  captions: SourceCaption[];
};

const source = bilingualDocument as BilingualDocument;
const windowStartMs = (R10_SOURCE_TRIM_BEFORE / R10_FPS) * 1000;
const windowEndMs = windowStartMs + (R10_DURATION_IN_FRAMES / R10_FPS) * 1000;
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

if (source.canonicalSource !== 'recorded-audio') {
  throw new Error('R10_CAPTION_SOURCE_NOT_RECORDED_AUDIO');
}
if (source.englishTranslationSource !== 'same-window-recorded-chinese-candidate') {
  throw new Error('R10_CAPTION_ENGLISH_SOURCE_INVALID');
}

const captions = source.captions
  .filter((caption) => caption.endMs > windowStartMs && caption.startMs < windowEndMs)
  .map((caption) => {
    if (
      !caption.id
      || !caption.beatId
      || !caption.zh.trim()
      || !caption.en.trim()
      || !Number.isFinite(caption.startMs)
      || !Number.isFinite(caption.endMs)
      || caption.endMs <= caption.startMs
    ) {
      throw new Error(`R10_CAPTION_INVALID:${caption.id}`);
    }
    return {
      ...caption,
      startFrame: Math.max(
        0,
        Math.round(((Math.max(caption.startMs, windowStartMs) - windowStartMs) / 1000) * R10_FPS),
      ),
      endFrameExclusive: Math.min(
        R10_DURATION_IN_FRAMES,
        Math.round(((Math.min(caption.endMs, windowEndMs) - windowStartMs) / 1000) * R10_FPS),
      ),
    };
  });

export const R10BilingualCaptions: React.FC = () => {
  const frame = useCurrentFrame();
  const caption = captions.find((item) => (
    frame >= item.startFrame && frame < item.endFrameExclusive
  ));
  if (!caption) return null;

  const fadeFrames = Math.max(1, Math.min(4, Math.floor((caption.endFrameExclusive - caption.startFrame) / 3)));
  const opacity = Math.min(
    interpolate(frame, [caption.startFrame, caption.startFrame + fadeFrames], [0, 1], clamp),
    interpolate(
      frame,
      [caption.endFrameExclusive - fadeFrames, caption.endFrameExclusive],
      [1, 0],
      clamp,
    ),
  );

  return (
    <div
      data-caption-id={caption.id}
      data-caption-authority="recorded-audio"
      style={{
        position: 'absolute',
        zIndex: 900,
        left: 180,
        right: 180,
        bottom: 48,
        minHeight: 150,
        padding: '22px 42px 20px',
        boxSizing: 'border-box',
        borderRadius: 24,
        background: 'linear-gradient(180deg, rgba(9,12,14,0.68), rgba(9,12,14,0.88))',
        boxShadow: '0 18px 54px rgba(0,0,0,0.34)',
        color: '#fff',
        textAlign: 'center',
        opacity,
      }}
    >
      <div style={{fontSize: 42, lineHeight: 1.24, fontWeight: 900, letterSpacing: 0.4}}>
        {caption.zh}
      </div>
      <div
        style={{
          marginTop: 9,
          color: '#DDE5E6',
          fontFamily: 'Inter, Arial, sans-serif',
          fontSize: 23,
          lineHeight: 1.25,
          fontWeight: 600,
          letterSpacing: 0.15,
        }}
      >
        {caption.en}
      </div>
    </div>
  );
};
