import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  AI_PRODUCT_IP_R1_DURATION_IN_FRAMES,
  AIProductIPV8CandidateR1NoSfx,
  AIProductIPV8CandidateR1WithSfx,
} from './AIProductIPV8CandidateR1';

const Root: React.FC = () => (
  <>
    <Composition
      id="AIProductIP-V8-CandidateR1-WithSfx"
      component={AIProductIPV8CandidateR1WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={AI_PRODUCT_IP_R1_DURATION_IN_FRAMES}
    />
    <Composition
      id="AIProductIP-V8-CandidateR1-NoSfx"
      component={AIProductIPV8CandidateR1NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={AI_PRODUCT_IP_R1_DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(Root);
