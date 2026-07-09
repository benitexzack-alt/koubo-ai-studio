import React from 'react';
import {Composition, Folder, Still} from 'remotion';
import {AIBizTalk16x9} from './AIBizTalk16x9';
import {CoverStill} from './CoverStill';
import {CoverStill3x4} from './CoverStill3x4';
import {CoverStill9x16} from './CoverStill9x16';
import {
  defaultTalkProps,
  gansuStoreAiTalk01Props,
  geoAiRecommendTalk01Props,
  localBossAiOcrDemoProps,
  localBossAiProps,
  localBossAiV2Props,
  smallBusinessAiV1Props,
} from './data/story';

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
        <Composition
          id="AIBizTalk16x9-IMG1926"
          component={AIBizTalk16x9}
          width={1920}
          height={1080}
          fps={30}
          durationInFrames={1848}
          defaultProps={localBossAiProps}
        />
        <Composition
          id="AIBizTalk16x9-IMG1926-v2"
          component={AIBizTalk16x9}
          width={1920}
          height={1080}
          fps={30}
          durationInFrames={1848}
          defaultProps={localBossAiV2Props}
        />
        <Composition
          id="AIBizTalk16x9-OCRDemo"
          component={AIBizTalk16x9}
          width={1920}
          height={1080}
          fps={30}
          durationInFrames={120}
          defaultProps={localBossAiOcrDemoProps}
        />
        <Composition
          id="AIBizTalk16x9-SmallBusinessAI-v1"
          component={AIBizTalk16x9}
          width={1920}
          height={1080}
          fps={30}
          durationInFrames={5082}
          defaultProps={smallBusinessAiV1Props}
        />
        <Composition
          id="AIBizTalk16x9-GansuStoreAI-Talk01"
          component={AIBizTalk16x9}
          width={1920}
          height={1080}
          fps={30}
          durationInFrames={3543}
          defaultProps={gansuStoreAiTalk01Props}
        />
        <Composition
          id="AIBizTalk16x9-GEO-AIRecommend-Talk01"
          component={AIBizTalk16x9}
          width={1920}
          height={1080}
          fps={30}
          durationInFrames={7306}
          defaultProps={geoAiRecommendTalk01Props}
        />
        <Still
          id="CoverStill"
          component={CoverStill}
          width={1920}
          height={1080}
          defaultProps={defaultTalkProps}
        />
        <Still
          id="CoverStill3x4"
          component={CoverStill3x4}
          width={1080}
          height={1440}
          defaultProps={defaultTalkProps}
        />
        <Still
          id="CoverStill3x4-IMG1926"
          component={CoverStill3x4}
          width={1080}
          height={1440}
          defaultProps={localBossAiProps}
        />
        <Still
          id="CoverStill3x4-IMG1926-v2"
          component={CoverStill3x4}
          width={1080}
          height={1440}
          defaultProps={localBossAiV2Props}
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
