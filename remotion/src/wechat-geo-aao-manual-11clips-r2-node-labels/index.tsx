import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  WECHAT_GEO_AAO_MANUAL_R2_NODE_LABELS_DURATION_IN_FRAMES,
  WechatGeoAaoManual11CandidateR2NodeLabelsWithSfx,
} from './WechatGeoAaoManual11CandidateR2NodeLabels';

const WechatGeoAaoManual11CandidateR2NodeLabelsRoot: React.FC = () => (
  <Composition
    id="WechatGeoAaoManual11-CandidateR2-NodeLabels-WithSfx"
    component={WechatGeoAaoManual11CandidateR2NodeLabelsWithSfx}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={WECHAT_GEO_AAO_MANUAL_R2_NODE_LABELS_DURATION_IN_FRAMES}
  />
);

registerRoot(WechatGeoAaoManual11CandidateR2NodeLabelsRoot);
