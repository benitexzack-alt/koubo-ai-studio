import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BeatCards} from './components/BeatCards';
import {BilingualCaptionOverlay} from './components/BilingualCaptionOverlay';
import {CaptionOverlay} from './components/CaptionOverlay';
import {DigitalCameraVideo} from './components/DigitalCameraVideo';
import {EnglishCaptionOverlay} from './components/EnglishCaptionOverlay';
import {FrameHud} from './components/FrameHud';
import {LocalFont} from './components/LocalFont';
import type {TalkProps} from './data/story';

export const AIBizTalk16x9: React.FC<TalkProps> = ({
  videoSrc,
  captionsSrc,
  bilingualCaptionsSrc,
  englishCaptionsSrc,
  hostName,
  identity,
  topic,
  footerTag,
  beats,
  cameraMotionStrength,
}) => {
  return (
    <AbsoluteFill style={{background: '#050A12'}}>
      <LocalFont />
      <DigitalCameraVideo videoSrc={videoSrc} beats={beats} strength={cameraMotionStrength} />
      <FrameHud hostName={hostName} identity={identity} topic={topic} footerTag={footerTag} />
      <BeatCards beats={beats} />
      {bilingualCaptionsSrc ? (
        <BilingualCaptionOverlay captionsSrc={bilingualCaptionsSrc} />
      ) : (
        <>
          <CaptionOverlay captionsSrc={captionsSrc} />
          {englishCaptionsSrc ? <EnglishCaptionOverlay captionsSrc={englishCaptionsSrc} /> : null}
        </>
      )}
    </AbsoluteFill>
  );
};
