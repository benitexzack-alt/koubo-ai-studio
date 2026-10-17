import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  SUPER_INDIVIDUAL_R1_DURATION_IN_FRAMES,
  SuperIndividualV8CandidateR1NoSfx,
  SuperIndividualV8CandidateR1WithSfx,
} from './SuperIndividualV8CandidateR1';

const Root: React.FC = () => (
  <>
    <Composition
      id="SuperIndividual-V8-CandidateR1-WithSfx"
      component={SuperIndividualV8CandidateR1WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={SUPER_INDIVIDUAL_R1_DURATION_IN_FRAMES}
    />
    <Composition
      id="SuperIndividual-V8-CandidateR1-NoSfx"
      component={SuperIndividualV8CandidateR1NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={SUPER_INDIVIDUAL_R1_DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(Root);

