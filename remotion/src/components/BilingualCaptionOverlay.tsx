import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {colors, fontFamily} from '../styles';

type BilingualCaptionPage = {
  zh: string;
  en: string;
  startMs: number;
  endMs: number;
  highlights?: string[];
};

const punctuation = new Set(['，', '。', '？', '！', '、', '：', '；', ',', '.', '?', '!', ':', ';']);

const normalize = (input: unknown): BilingualCaptionPage[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      const maybe = item as Partial<BilingualCaptionPage>;
      const highlights = Array.isArray(maybe.highlights) ? maybe.highlights.map(String) : [];
      return {
        zh: String(maybe.zh ?? ''),
        en: String(maybe.en ?? ''),
        startMs: Number(maybe.startMs ?? 0),
        endMs: Number(maybe.endMs ?? 0),
        highlights,
      };
    })
    .filter((item) => item.zh.trim().length > 0 && item.en.trim().length > 0 && item.endMs > item.startMs);
};

type CaptionPart = {text: string; active: boolean; punctuation: boolean};

const splitText = (text: string, highlights: string[]) => {
  const parts: CaptionPart[] = [];
  let index = 0;
  const sortedHighlights = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);

  while (index < text.length) {
    const match = sortedHighlights.find((keyword) => text.startsWith(keyword, index));
    if (match) {
      parts.push({text: match, active: true, punctuation: false});
      index += match.length;
      continue;
    }

    const char = text[index];
    parts.push({text: char, active: false, punctuation: punctuation.has(char)});
    index += 1;
  }

  return parts;
};

const groupTextParts = (parts: CaptionPart[]) => {
  const groups: CaptionPart[][] = [];

  parts.forEach((part) => {
    if (part.punctuation && groups.length > 0) {
      groups[groups.length - 1].push(part);
      return;
    }

    groups.push([part]);
  });

  return groups;
};

const visibleLength = (text: string) =>
  [...text].filter((char) => !punctuation.has(char) && char.trim().length > 0).length;

const captionMetrics = (page: BilingualCaptionPage) => {
  const zhLength = visibleLength(page.zh);
  const enLength = page.en.trim().length;
  const dense = zhLength > 26 || enLength > 94;
  const veryDense = zhLength > 32 || enLength > 118;

  return {
    maxWidth: veryDense ? 1360 : dense ? 1300 : 1220,
    zhSize: veryDense ? 39 : dense ? 42 : 46,
    enSize: veryDense ? 20 : dense ? 21 : 23,
    padding: veryDense ? '9px 22px 12px' : dense ? '10px 23px 13px' : '10px 22px 13px',
    bottom: veryDense ? 48 : 56,
  };
};

export const BilingualCaptionOverlay: React.FC<{captionsSrc: string}> = ({captionsSrc}) => {
  const [captions, setCaptions] = useState<BilingualCaptionPage[] | null>(null);
  const [handle] = useState(() => delayRender('加载中英双语句群字幕'));

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

  return <CaptionPages captions={captions} />;
};

const CaptionPages: React.FC<{captions: BilingualCaptionPage[]}> = ({captions}) => {
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

  return <ActiveCaption page={current} nowMs={nowMs} />;
};

const ActiveCaption: React.FC<{page: BilingualCaptionPage; nowMs: number}> = ({page, nowMs}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const localFrame = Math.max(0, frame - (page.startMs / 1000) * fps);
  const enter = spring({frame: localFrame, fps, config: {damping: 20, stiffness: 180}});
  const exit = interpolate(nowMs, [page.endMs - 180, page.endMs], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const groups = groupTextParts(splitText(page.zh, page.highlights ?? []));
  const metrics = captionMetrics(page);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: metrics.bottom,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: metrics.maxWidth,
          padding: metrics.padding,
          borderRadius: 12,
          background: 'rgba(0,0,0,0.58)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 18px 54px rgba(0,0,0,0.46)',
          opacity: exit,
          transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px) scale(${interpolate(enter, [0, 1], [0.97, 1])})`,
          textAlign: 'center',
          fontFamily,
        }}
      >
        <div
          style={{
            color: colors.ink,
            fontSize: metrics.zhSize,
            lineHeight: 1.18,
            fontWeight: 900,
            letterSpacing: 0,
            WebkitTextStroke: '1.15px rgba(0,0,0,0.72)',
            textShadow: '0 3px 10px rgba(0,0,0,0.92)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'baseline',
            rowGap: 0,
          }}
        >
          {groups.map((group, groupIndex) => (
            <span
              key={`${group.map((part) => part.text).join('')}-${groupIndex}`}
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                whiteSpace: 'nowrap',
              }}
            >
              {group.map((part, partIndex) => (
                <span
                  key={`${part.text}-${partIndex}`}
                  style={{
                    color: part.active ? colors.yellow : colors.ink,
                    fontSize: part.punctuation ? '0.58em' : '1em',
                    lineHeight: part.punctuation ? 1 : 1.18,
                    display: 'inline-block',
                    transform: part.punctuation ? 'translateY(0.26em)' : undefined,
                    marginLeft: part.punctuation ? '-0.05em' : undefined,
                    marginRight: part.punctuation ? '0.07em' : undefined,
                    textShadow: part.active
                      ? '0 0 22px rgba(255,210,63,0.66), 0 3px 10px rgba(0,0,0,0.9)'
                      : '0 3px 10px rgba(0,0,0,0.92)',
                  }}
                >
                  {part.text}
                </span>
              ))}
            </span>
          ))}
        </div>
        <div
          style={{
            marginTop: 4,
            color: 'rgba(247,250,255,0.86)',
            fontSize: metrics.enSize,
            lineHeight: 1.16,
            fontWeight: 760,
            letterSpacing: 0,
            textShadow: '0 3px 10px rgba(0,0,0,0.95)',
          }}
        >
          {page.en}
        </div>
      </div>
    </AbsoluteFill>
  );
};
