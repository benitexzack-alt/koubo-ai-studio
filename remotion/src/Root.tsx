import React from 'react';
import {Composition, Folder, Still} from 'remotion';
import {AIBizTalk16x9} from './AIBizTalk16x9';
import {CoverStill} from './CoverStill';
import {CoverStill9x16} from './CoverStill9x16';
import {defaultTalkProps} from './data/story';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Koubo">
        <Composition
          id="AIBizTalk16x9"
          component={AIBizTalk16x9}
          width={1920}
          height={1080}
          fps={30}
          durationInFrames={2380}
          defaultProps={defaultTalkProps}
        />
        <Still
          id="CoverStill"
          component={CoverStill}
          width={1920}
          height={1080}
          defaultProps={defaultTalkProps}
        />
        <Still
          id="CoverStill9x16"
          component={CoverStill9x16}
          width={1080}
          height={1920}
          defaultProps={defaultTalkProps}
        />
      </Folder>
    </>
  );
};
