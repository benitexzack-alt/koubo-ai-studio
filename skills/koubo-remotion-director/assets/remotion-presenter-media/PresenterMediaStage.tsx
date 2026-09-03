import {Video} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame} from 'remotion';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

export type PresenterMediaStageProps = {
  materialSrc: string;
  presenterSrc: string;
  speakerStartFromFrame: number;
  durationInFrames: number;
  materialFit?: 'cover' | 'contain';
  materialAudioMode?: 'muted' | 'duck-under-narration';
  presenterShape?: 'circle' | 'rounded-rectangle';
  presenterObjectPosition?: string;
  enterFrames?: number;
  exitFrames?: number;
};

const dbToGain = (db: number) => 10 ** (db / 20);

export const PresenterMediaStage: React.FC<PresenterMediaStageProps> = ({
  materialSrc,
  presenterSrc,
  speakerStartFromFrame,
  durationInFrames,
  materialFit = 'cover',
  materialAudioMode = 'muted',
  presenterShape = 'circle',
  presenterObjectPosition = '59% 41%',
  enterFrames = 16,
  exitFrames = 12,
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, enterFrames], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - exitFrames), durationInFrames],
    [1, 0],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const inset = Math.min(enter, exit);
  const targetSize = presenterShape === 'circle' ? 296 : 360;
  const targetHeight = presenterShape === 'circle' ? 296 : 230;
  const width = interpolate(inset, [0, 1], [1920, targetSize], clamp);
  const height = interpolate(inset, [0, 1], [1080, targetHeight], clamp);
  const right = interpolate(inset, [0, 1], [0, 72], clamp);
  const bottom = interpolate(inset, [0, 1], [0, 188], clamp);
  const radius = presenterShape === 'circle'
    ? interpolate(inset, [0, 1], [0, 999], clamp)
    : interpolate(inset, [0, 1], [0, 18], clamp);
  const materialGain = materialAudioMode === 'duck-under-narration' ? dbToGain(-15) : 0;

  return (
    <AbsoluteFill style={{backgroundColor: '#05090d', overflow: 'hidden'}}>
      <Video
        src={staticFile(materialSrc)}
        muted={materialAudioMode === 'muted'}
        volume={materialGain}
        style={{width: '100%', height: '100%', objectFit: materialFit}}
      />
      <div
        style={{
          position: 'absolute',
          right,
          bottom,
          width,
          height,
          overflow: 'hidden',
          borderRadius: radius,
          border: `${interpolate(inset, [0, 1], [0, 5], clamp)}px solid rgba(255,255,255,0.92)`,
          boxShadow: inset > 0.8 ? '0 14px 42px rgba(0,0,0,0.38)' : 'none',
        }}
      >
        <Video
          src={staticFile(presenterSrc)}
          startFrom={speakerStartFromFrame}
          muted
          volume={0}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: presenterObjectPosition,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
