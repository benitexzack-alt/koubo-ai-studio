import {Video} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {BeatCards} from './components/BeatCards';
import {CaptionOverlay} from './components/CaptionOverlay';
import {FrameHud} from './components/FrameHud';
import {LocalFont} from './components/LocalFont';
import type {TalkProps} from './data/story';

export const AIBizTalk16x9: React.FC<TalkProps> = ({
  videoSrc,
  captionsSrc,
  hostName,
  identity,
  topic,
  footerTag,
  beats,
}) => {
  return (
    <AbsoluteFill style={{background: '#050A12'}}>
      <LocalFont />
      <Video
        src={staticFile(videoSrc)}
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(1.06) saturate(1.08) brightness(0.96)',
        }}
      />
      <FrameHud hostName={hostName} identity={identity} topic={topic} footerTag={footerTag} />
      <BeatCards beats={beats} />
      <CaptionOverlay captionsSrc={captionsSrc} />
    </AbsoluteFill>
  );
};
