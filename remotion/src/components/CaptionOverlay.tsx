import type {Caption} from '@remotion/captions';
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
import {normalizeCaptions} from '../data/story';

type CaptionToken = {
  text: string;
  fromMs: number;
  toMs: number;
};

type CaptionPage = {
  startMs: number;
  endMs: number;
  tokens: CaptionToken[];
};

const maxPageChars = 16;
const minPageChars = 5;
const hardPunctuation = new Set(['。', '？', '！', '.', '?', '!']);
const softPunctuation = new Set(['，', ',', '；', ';', '：', ':', '、']);
const punctuation = new Set([...hardPunctuation, ...softPunctuation]);
const splitPattern = /([，。？！,.;；:：、!?])/u;
const protectedPairs = new Set(['甘肃', '庆阳', '兰州', '重新', '新做', 'OP', 'PC']);

const countChars = (tokens: CaptionToken[]) =>
  tokens.reduce((sum, token) => sum + token.text.trim().length, 0);

const countMeaningfulChars = (tokens: CaptionToken[]) =>
  tokens.reduce((sum, token) => {
    const meaningful = token.text
      .trim()
      .split('')
      .filter((char) => !punctuation.has(char)).length;
    return sum + meaningful;
  }, 0);

const isProtectedBoundary = (previousText: string, nextText: string) => {
  const previous = previousText.trim();
  const next = nextText.trim();
  if (!previous || !next) {
    return false;
  }

  if (protectedPairs.has(`${previous}${next}`)) {
    return true;
  }

  return /^[A-Z]+$/.test(previous) && /^[A-Z]+$/.test(next);
};

const splitCaptionText = (caption: Caption): CaptionToken[] => {
  const text = caption.text.trim();
  if (!text) {
    return [];
  }

  return text
    .split(splitPattern)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      fromMs: caption.startMs,
      toMs: caption.endMs,
    }));
};

const toPage = (tokens: CaptionToken[]): CaptionPage => ({
  startMs: tokens[0].fromMs,
  endMs: tokens[tokens.length - 1].toMs,
  tokens,
});

const splitLongClause = (tokens: CaptionToken[]): CaptionToken[][] => {
  const totalChars = countChars(tokens);
  if (totalChars <= maxPageChars) {
    return [tokens];
  }

  const pageCount = Math.ceil(totalChars / maxPageChars);
  const targetChars = Math.ceil(totalChars / pageCount);
  const pages: CaptionToken[][] = [];
  let current: CaptionToken[] = [];

  for (const token of tokens) {
    const nextLength = countChars(current) + token.text.length;
    const previousText = current[current.length - 1]?.text ?? '';
    const cutsProtectedPair = isProtectedBoundary(previousText, token.text);
    if (
      current.length > 0 &&
      nextLength > targetChars &&
      countMeaningfulChars(current) >= minPageChars &&
      !cutsProtectedPair
    ) {
      pages.push(current);
      current = [];
    }
    current.push(token);
  }

  if (current.length > 0) {
    pages.push(current);
  }

  const last = pages[pages.length - 1];
  const previous = pages[pages.length - 2];
  if (previous && countMeaningfulChars(last) < minPageChars) {
    if (countChars(previous) + countChars(last) <= maxPageChars + minPageChars) {
      previous.push(...last);
      pages.pop();
    } else {
      while (countMeaningfulChars(last) < minPageChars && countMeaningfulChars(previous) > minPageChars) {
        const moved = previous.pop();
        if (!moved) {
          break;
        }
        last.unshift(moved);
      }
    }
  }

  return pages;
};

const mergeCaptionPages = (pages: CaptionPage[]): CaptionPage[] => {
  const merged = [...pages];
  const mergeAt = (index: number, nextIndex: number) => {
    const combined = [...merged[index].tokens, ...merged[nextIndex].tokens];
    merged[index] = toPage(combined);
    merged.splice(nextIndex, 1);
  };

  for (let index = 0; index < merged.length; index += 1) {
    const page = merged[index];
    if (countMeaningfulChars(page.tokens) >= minPageChars) {
      continue;
    }

    const next = merged[index + 1];
    if (next && countChars(page.tokens) + countChars(next.tokens) <= maxPageChars + 4) {
      mergeAt(index, index + 1);
      index -= 1;
      continue;
    }

    const previous = merged[index - 1];
    if (previous && countChars(previous.tokens) + countChars(page.tokens) <= maxPageChars + 4) {
      mergeAt(index - 1, index);
      index -= 2;
    }
  }

  return merged;
};

const toCaptionPages = (captions: Caption[]): CaptionPage[] => {
  const pages: CaptionPage[] = [];
  let clause: CaptionToken[] = [];

  const flushClause = () => {
    if (clause.length === 0) {
      return;
    }

    for (const group of splitLongClause(clause)) {
      pages.push(toPage(group));
    }
    clause = [];
  };

  for (const caption of captions) {
    for (const token of splitCaptionText(caption)) {
      clause.push(token);
      if (punctuation.has(token.text)) {
        flushClause();
      }
    }
  }

  flushClause();

  return mergeCaptionPages(pages);
};

export const CaptionOverlay: React.FC<{captionsSrc: string}> = ({captionsSrc}) => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [handle] = useState(() => delayRender('加载口播字幕'));

  const load = useCallback(async () => {
    try {
      const response = await fetch(staticFile(captionsSrc));
      const raw = await response.json();
      setCaptions(normalizeCaptions(raw));
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

const CaptionPages: React.FC<{captions: Caption[]}> = ({captions}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const pages = useMemo(() => toCaptionPages(captions), [captions]);

  const current = pages.find((candidate, index) => {
    const next = pages[index + 1];
    const end = next ? next.startMs : candidate.endMs + 240;
    return nowMs >= candidate.startMs && nowMs < end;
  });

  if (!current) {
    return null;
  }

  const index = pages.indexOf(current);
  const next = pages[index + 1];
  const pageEndMs = next ? Math.max(current.endMs, next.startMs) : current.endMs + 240;

  return <ActiveCaptionPage page={current} pageEndMs={pageEndMs} nowMs={nowMs} />;
};

const ActiveCaptionPage: React.FC<{page: CaptionPage; pageEndMs: number; nowMs: number}> = ({
  page,
  pageEndMs,
  nowMs,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const localFrame = Math.max(0, frame - (page.startMs / 1000) * fps);
  const pop = spring({frame: localFrame, fps, config: {damping: 18, stiffness: 180}});

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 84,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          padding: '10px 18px 14px',
          borderRadius: 14,
          background: 'rgba(0,0,0,0.54)',
          boxShadow: '0 18px 54px rgba(0,0,0,0.46)',
          opacity: 1,
          transform: `translateY(${interpolate(pop, [0, 1], [26, 0])}px) scale(${interpolate(pop, [0, 1], [0.96, 1])})`,
          textAlign: 'center',
          fontFamily,
          fontSize: 54,
          lineHeight: 1.22,
          fontWeight: 900,
          letterSpacing: 0,
          color: colors.ink,
          WebkitTextStroke: '1.4px rgba(0,0,0,0.72)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {page.tokens.map((token) => {
          const active = token.fromMs <= nowMs && token.toMs > nowMs;
          return (
            <span
              key={`${token.fromMs}-${token.toMs}-${token.text}`}
              style={{
                color: active ? colors.yellow : colors.ink,
                textShadow: active
                  ? '0 0 22px rgba(255,210,63,0.68), 0 3px 10px rgba(0,0,0,0.9)'
                  : '0 3px 10px rgba(0,0,0,0.92)',
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
