import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  WECHAT_GEO_AAO_V80_DURATION_IN_FRAMES,
  WechatGeoAaoV80Talk16x9NoSfx,
  WechatGeoAaoV80Talk16x9WithSfx,
} from './WechatGeoAaoV80Talk16x9';

const WechatGeoAaoV80Root: React.FC = () => (
  <>
    <Composition
      id="WechatGeoAao16x9-V80-WithSfx"
      component={WechatGeoAaoV80Talk16x9WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={WECHAT_GEO_AAO_V80_DURATION_IN_FRAMES}
    />
    <Composition
      id="WechatGeoAao16x9-V80-NoSfx"
      component={WechatGeoAaoV80Talk16x9NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={WECHAT_GEO_AAO_V80_DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(WechatGeoAaoV80Root);
