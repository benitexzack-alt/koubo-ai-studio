import {Video} from '@remotion/media';
import React from 'react';
import {Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Beat} from '../data/story';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const beatWeight = (seconds: number, beat: Beat) => {
  if (seconds < beat.start || seconds > beat.end) {
    return 0;
  }

  const fadeIn = interpolate(seconds, [beat.start, Math.min(beat.start + 0.45, beat.end)], [0, 1], clamp);
  const fadeOut = interpolate(seconds, [Math.max(beat.start, beat.end - 0.45), beat.end], [1, 0], clamp);

  return Math.min(fadeIn, fadeOut);
};

const semanticBoost = (beat?: Beat) => {
  switch (beat?.variant) {
    case 'keyword-pop':
      return 0.014;
    case 'compare':
      return 0.009;
    case 'checklist':
    case 'flow':
    case 'metric':
      return 0.007;
    case 'statement':
      return 0.005;
    default:
      return 0.004;
  }
};

const activeBeat = (seconds: number, beats: Beat[]) => {
  return beats
    .map((beat, index) => ({beat, index, weight: beatWeight(seconds, beat)}))
    .filter((item) => item.weight > 0)
    .sort((a, b) => {
      if (a.beat.variant === 'keyword-pop' && b.beat.variant !== 'keyword-pop') {
        return -1;
      }

      if (a.beat.variant !== 'keyword-pop' && b.beat.variant === 'keyword-pop') {
        return 1;
      }

      return b.weight - a.weight;
    })[0];
};

const keywordPunch = (seconds: number, beats: Beat[]) => {
  const keyword = beats.find((beat) => beat.variant === 'keyword-pop' && seconds >= beat.start && seconds <= beat.end);
  if (!keyword) {
    return 0;
  }

  const local = seconds - keyword.start;
  if (local > 0.72) {
    return 0;
  }

  return interpolate(local, [0, 0.18, 0.72], [0, 0.019, 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
};

export const DigitalCameraVideo: React.FC<{
  videoSrc: string;
  beats: Beat[];
  strength?: number;
}> = ({videoSrc, beats, strength = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;
  const current = activeBeat(seconds, beats);
  const weight = current?.weight ?? 0;
  const sideNudge = current?.beat.side === 'right' ? -1 : 1;

  const baseScale = 1.022 + 0.014 * strength;
  const breathX = Math.sin(seconds * 0.36) * 9 * strength;
  const breathY = Math.cos(seconds * 0.28) * 5 * strength;
  const breathScale = Math.sin(seconds * 0.18) * 0.004 * strength;
  const scale =
    baseScale + breathScale + semanticBoost(current?.beat) * weight * strength + keywordPunch(seconds, beats) * strength;
  const translateX = breathX + sideNudge * weight * 5 * strength;
  const translateY = breathY - weight * 3 * strength;

  return (
    <Video
      src={staticFile(videoSrc)}
      objectFit="cover"
      style={{
        width: '100%',
        height: '100%',
        filter: 'contrast(1.04) saturate(1.08) brightness(1.08)',
        transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
        transformOrigin: 'center center',
      }}
    />
  );
};
