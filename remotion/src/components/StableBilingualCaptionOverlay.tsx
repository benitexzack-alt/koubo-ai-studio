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

type StableBilingualCaptionPage = {
  zh: string;
  en: string;
  startMs: number;
  endMs: number;
  highlights?: string[];
};

const normalize = (input: unknown): StableBilingualCaptionPage[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      const page = item as Partial<StableBilingualCaptionPage>;
      return {
        zh: String(page.zh ?? '').trim(),
        en: String(page.en ?? '').trim(),
        startMs: Number(page.startMs ?? 0),
        endMs: Number(page.endMs ?? 0),
        highlights: Array.isArray(page.highlights) ? page.highlights.map(String) : [],
      };
    })
    .filter((page) => page.zh && page.en && page.endMs > page.startMs)
    .sort((left, right) => left.startMs - right.startMs);
};

const splitByHighlights = (text: string, highlights: string[]) => {
  const keywords = [...highlights].filter(Boolean).sort((left, right) => right.length - left.length);
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

export const StableBilingualCaptionOverlay: React.FC<{captionsSrc: string}> = ({captionsSrc}) => {
  const [captions, setCaptions] = useState<StableBilingualCaptionPage[] | null>(null);
  const [handle] = useState(() => delayRender('加载稳定中英双语字幕'));

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

  return <StableCaptionPages captions={captions} />;
};

const StableCaptionPages: React.FC<{captions: StableBilingualCaptionPage[]}> = ({captions}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const current = useMemo(
    () => captions.find((caption) => nowMs >= caption.startMs && nowMs < caption.endMs),
    [captions, nowMs],
  );

  if (!current) {
    return null;
  }

  const fadeMs = Math.min(100, Math.max(45, (current.endMs - current.startMs) * 0.08));
  const opacity = Math.min(
    interpolate(nowMs, [current.startMs, current.startMs + fadeMs], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    interpolate(nowMs, [current.endMs - fadeMs, current.endMs], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const parts = splitByHighlights(current.zh, current.highlights ?? []);

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 42,
        width: 1480,
        height: 118,
        transform: 'translateX(-50%)',
        boxSizing: 'border-box',
        padding: '11px 28px 12px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.62)',
        boxShadow: '0 18px 54px rgba(0,0,0,0.46)',
        opacity,
        pointerEvents: 'none',
        fontFamily,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      <div
        style={{
          width: '100%',
          color: colors.ink,
          fontSize: 38,
          lineHeight: 1.12,
          fontWeight: 900,
          letterSpacing: 0,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          WebkitTextStroke: '1.1px rgba(0,0,0,0.74)',
          textShadow: '0 3px 10px rgba(0,0,0,0.92)',
        }}
      >
        {parts.map((part, index) => (
          <span
            key={`${part.text}-${index}`}
            style={{
              color: part.highlighted ? colors.yellow : colors.ink,
              textShadow: '0 3px 10px rgba(0,0,0,0.92)',
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
          fontSize: 20,
          lineHeight: 1.08,
          fontWeight: 680,
          letterSpacing: 0.1,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          textShadow: '0 3px 10px rgba(0,0,0,0.95)',
        }}
      >
        {current.en}
      </div>
    </div>
  );
};
