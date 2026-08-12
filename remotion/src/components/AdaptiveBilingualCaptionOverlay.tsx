import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {colors, fontFamily} from '../styles';

type CaptionPage = {
  zh: string;
  en: string;
  startMs: number;
  endMs: number;
  highlights?: string[];
};

const normalize = (input: unknown): CaptionPage[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      const page = item as Partial<CaptionPage>;
      return {
        zh: String(page.zh ?? '').trim(),
        en: String(page.en ?? '').trim(),
        startMs: Number(page.startMs ?? 0),
        endMs: Number(page.endMs ?? 0),
        highlights: Array.isArray(page.highlights)
          ? page.highlights.map(String)
          : [],
      };
    })
    .filter((page) => page.zh && page.en && page.endMs > page.startMs)
    .sort((left, right) => left.startMs - right.startMs);
};

const splitByHighlights = (text: string, highlights: string[]) => {
  const keywords = [...highlights]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  const parts: Array<{text: string; highlighted: boolean}> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const keyword = keywords.find((item) => text.startsWith(item, cursor));
    if (keyword) {
      parts.push({text: keyword, highlighted: true});
      cursor += keyword.length;
      continue;
    }

    const nextKeywordAt = keywords
      .map((item) => text.indexOf(item, cursor + 1))
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0];
    const end = nextKeywordAt ?? text.length;
    parts.push({text: text.slice(cursor, end), highlighted: false});
    cursor = end;
  }

  return parts;
};

const chineseFontSize = (length: number) => {
  if (length >= 39) {
    return 31;
  }
  if (length >= 35) {
    return 33;
  }
  if (length >= 31) {
    return 35;
  }
  if (length >= 27) {
    return 37;
  }
  return 39;
};

const englishFontSize = (length: number) => {
  if (length >= 96) {
    return 16;
  }
  if (length >= 82) {
    return 17;
  }
  if (length >= 68) {
    return 18;
  }
  return 20;
};

export const AdaptiveBilingualCaptionOverlay: React.FC<{
  captionsSrc: string;
  variant?: 'boxed' | 'transparent-v8';
}> = ({captionsSrc, variant = 'boxed'}) => {
  const [captions, setCaptions] = useState<CaptionPage[] | null>(null);
  const [handle] = useState(() => delayRender('加载自适应中英双语字幕'));

  const load = useCallback(async () => {
    try {
      const response = await fetch(staticFile(captionsSrc));
      const raw = await response.json();
      setCaptions(normalize(raw));
      continueRender(handle);
    } catch (error) {
      cancelRender(error as Error);
    }
  }, [captionsSrc, handle]);

  useEffect(() => {
    load();
  }, [load]);

  if (!captions) {
    return null;
  }

  return <CaptionPages captions={captions} variant={variant} />;
};

const CaptionPages: React.FC<{
  captions: CaptionPage[];
  variant: 'boxed' | 'transparent-v8';
}> = ({captions, variant}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const current = useMemo(
    () =>
      captions.find(
        (caption) => nowMs >= caption.startMs && nowMs < caption.endMs,
      ),
    [captions, nowMs],
  );

  if (!current) {
    return null;
  }

  const fadeMs = Math.min(
    90,
    Math.max(45, (current.endMs - current.startMs) * 0.06),
  );
  const opacity = Math.min(
    interpolate(
      nowMs,
      [current.startMs, current.startMs + fadeMs],
      [0, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      },
    ),
    interpolate(
      nowMs,
      [current.endMs - fadeMs, current.endMs],
      [1, 0],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      },
    ),
  );
  const parts = splitByHighlights(current.zh, current.highlights ?? []);
  const zhSize = chineseFontSize([...current.zh].length);
  const enSize = englishFontSize(current.en.length);
  const transparent = variant === 'transparent-v8';

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 42,
        width: 1510,
        height: transparent ? 108 : 124,
        transform: 'translateX(-50%)',
        boxSizing: 'border-box',
        padding: transparent ? '6px 24px 8px' : '11px 30px 12px',
        borderRadius: transparent ? 0 : 8,
        border: transparent ? 'none' : '1px solid rgba(255,255,255,0.09)',
        background: transparent
          ? 'linear-gradient(90deg, rgba(2,7,12,0) 0%, rgba(2,7,12,0.38) 12%, rgba(2,7,12,0.38) 88%, rgba(2,7,12,0) 100%)'
          : 'rgba(0,0,0,0.64)',
        boxShadow: transparent
          ? '0 8px 24px rgba(0,0,0,0.12)'
          : '0 18px 54px rgba(0,0,0,0.46)',
        opacity,
        pointerEvents: 'none',
        fontFamily,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        zIndex: 260,
      }}
    >
      <div
        style={{
          width: '100%',
          color: colors.ink,
          fontSize: zhSize,
          lineHeight: 1.12,
          fontWeight: 900,
          letterSpacing: 0,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          fontVariantEastAsian: 'proportional-width',
          WebkitTextStroke: transparent
            ? '1.25px rgba(0,0,0,0.88)'
            : '1px rgba(0,0,0,0.76)',
          textShadow: transparent
            ? '0 3px 7px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.72)'
            : '0 3px 10px rgba(0,0,0,0.94)',
        }}
      >
        {parts.map((part, index) => (
          <span
            key={`${part.text}-${index}`}
            style={{
              color: part.highlighted ? colors.yellow : colors.ink,
              textShadow: part.highlighted && transparent
                ? '0 0 18px rgba(255,204,61,0.55), 0 3px 7px rgba(0,0,0,1)'
                : undefined,
            }}
          >
            {part.text}
          </span>
        ))}
      </div>
      <div
        style={{
          width: '100%',
          marginTop: 5,
          color: 'rgba(247,250,255,0.84)',
          fontSize: enSize,
          lineHeight: 1.08,
          fontWeight: 680,
          letterSpacing: 0,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          textShadow: transparent
            ? '0 2px 6px rgba(0,0,0,1), 0 0 13px rgba(0,0,0,0.78)'
            : '0 3px 10px rgba(0,0,0,0.95)',
        }}
      >
        {current.en}
      </div>
    </div>
  );
};
