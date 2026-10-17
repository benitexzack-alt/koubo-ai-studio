import React from 'react';
import {Composition} from 'remotion';
import {
  WULANCHABU_COMPUTE_R1_DURATION_IN_FRAMES,
  WulanchabuComputeV8CandidateR1NoSfx,
  WulanchabuComputeV8CandidateR1WithSfx,
} from './WulanchabuComputeV8CandidateR1';

export const WulanchabuComputeCandidateRoot: React.FC = () => (
  <>
    <Composition
      id="WulanchabuCompute16x9-V8-R1-WithSfx"
      component={WulanchabuComputeV8CandidateR1WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={WULANCHABU_COMPUTE_R1_DURATION_IN_FRAMES}
    />
    <Composition
      id="WulanchabuCompute16x9-V8-R1-NoSfx"
      component={WulanchabuComputeV8CandidateR1NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={WULANCHABU_COMPUTE_R1_DURATION_IN_FRAMES}
    />
  </>
);
