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
import {fontFamily} from '../styles';

type EnglishCaption = {
  text: string;
  startMs: number;
  endMs: number;
};

const normalize = (input: unknown): EnglishCaption[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      const maybe = item as Partial<EnglishCaption>;
      return {
        text: String(maybe.text ?? ''),
        startMs: Number(maybe.startMs ?? 0),
        endMs: Number(maybe.endMs ?? 0),
      };
    })
    .filter((item) => item.text.trim().length > 0 && item.endMs > item.startMs);
};

export const EnglishCaptionOverlay: React.FC<{captionsSrc: string}> = ({captionsSrc}) => {
  const [captions, setCaptions] = useState<EnglishCaption[] | null>(null);
  const [handle] = useState(() => delayRender('加载英文辅助字幕'));

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

  return <EnglishCaptionPages captions={captions} />;
};

const EnglishCaptionPages: React.FC<{captions: EnglishCaption[]}> = ({captions}) => {
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

  const localFrame = Math.max(0, frame - (current.startMs / 1000) * fps);
  const pop = spring({frame: localFrame, fps, config: {damping: 22, stiffness: 140}});
  const exit = interpolate(nowMs, [current.endMs - 180, current.endMs], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 36,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          padding: '5px 14px 7px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.46)',
          opacity: exit,
          transform: `translateY(${interpolate(pop, [0, 1], [14, 0])}px)`,
          color: 'rgba(247,250,255,0.9)',
          fontFamily,
          fontSize: 25,
          lineHeight: 1.18,
          fontWeight: 800,
          textAlign: 'center',
          textShadow: '0 3px 10px rgba(0,0,0,0.96)',
        }}
      >
        {current.text}
      </div>
    </AbsoluteFill>
  );
};
