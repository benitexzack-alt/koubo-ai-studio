import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  WECHAT_GEO_AAO_MANUAL_R2_DURATION_IN_FRAMES,
  WechatGeoAaoManual11CandidateR2WithSfx,
} from './WechatGeoAaoManual11CandidateR2';

const WechatGeoAaoManual11CandidateR2Root: React.FC = () => (
  <Composition
    id="WechatGeoAaoManual11-CandidateR2-WithSfx"
    component={WechatGeoAaoManual11CandidateR2WithSfx}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={WECHAT_GEO_AAO_MANUAL_R2_DURATION_IN_FRAMES}
  />
);

registerRoot(WechatGeoAaoManual11CandidateR2Root);
