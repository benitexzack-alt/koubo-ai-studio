import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  WECHAT_GEO_AAO_MANUAL_R1_DURATION_IN_FRAMES,
  WechatGeoAaoManual11CandidateR1WithSfx,
} from './WechatGeoAaoManual11CandidateR1';

const WechatGeoAaoManual11CandidateR1Root: React.FC = () => (
  <Composition
    id="WechatGeoAaoManual11-CandidateR1-WithSfx"
    component={WechatGeoAaoManual11CandidateR1WithSfx}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={WECHAT_GEO_AAO_MANUAL_R1_DURATION_IN_FRAMES}
  />
);

registerRoot(WechatGeoAaoManual11CandidateR1Root);
