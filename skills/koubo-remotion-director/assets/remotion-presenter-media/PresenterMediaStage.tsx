import {Video} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame} from 'remotion';
import platformSafeAreasDocument from '../../references/platform-safe-areas.v1.json';

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
  presenterPlacement?: 'default' | 'fallback';
  enterFrames?: number;
  exitFrames?: number;
};

type PresenterSlot = {
  anchor: 'bottom-right' | 'bottom-left';
  right?: number;
  left?: number;
  bottom: number;
};

type PlatformSafeAreaProfile = {
  id: string;
  presenter: {
    size: {width: number; height: number};
    slots: {default: PresenterSlot; fallback: PresenterSlot};
    transition: {minimumScale: number; maximumScale: number};
  };
};

const safeAreaProfile = (
  platformSafeAreasDocument as {profiles: PlatformSafeAreaProfile[]}
).profiles.find(({id}) => id === 'douyin-feed-landscape-16x9-v1');

if (!safeAreaProfile) {
  throw new Error('缺少 douyin-feed-landscape-16x9-v1 平台安全区合同');
}

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
  presenterPlacement = 'default',
  enterFrames = 16,
  exitFrames = 12,
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, Math.max(1, enterFrames)], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - Math.max(1, exitFrames)), durationInFrames],
    [1, 0],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const visibility = Math.min(enter, exit);
  const slot = safeAreaProfile.presenter.slots[presenterPlacement];
  const width = safeAreaProfile.presenter.size.width;
  const height = safeAreaProfile.presenter.size.height;
  const scale = interpolate(
    visibility,
    [0, 1],
    [
      safeAreaProfile.presenter.transition.minimumScale,
      safeAreaProfile.presenter.transition.maximumScale,
    ],
    clamp,
  );
  const horizontalPosition = slot.anchor === 'bottom-right'
    ? {right: slot.right}
    : {left: slot.left};
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
          ...horizontalPosition,
          bottom: slot.bottom,
          width,
          height,
          boxSizing: 'border-box',
          overflow: 'hidden',
          borderRadius: presenterShape === 'circle' ? '50%' : 18,
          border: '5px solid rgba(255,255,255,0.92)',
          boxShadow: '0 14px 42px rgba(0,0,0,0.38)',
          opacity: visibility,
          transform: `scale(${scale})`,
          transformOrigin: slot.anchor === 'bottom-right' ? 'bottom right' : 'bottom left',
        }}
        data-platform-safe-area-profile={safeAreaProfile.id}
        data-presenter-slot={presenterPlacement}
      >
        <Video
          src={staticFile(presenterSrc)}
          trimBefore={speakerStartFromFrame}
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
