import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  SUPER_INDIVIDUAL_R1_DURATION_IN_FRAMES,
  SuperIndividualV8CandidateR2NoSfx,
  SuperIndividualV8CandidateR2WithSfx,
} from './SuperIndividualV8CandidateR2';

const Root: React.FC = () => (
  <>
    <Composition
      id="SuperIndividual-V8-CandidateR2-WithSfx"
      component={SuperIndividualV8CandidateR2WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={SUPER_INDIVIDUAL_R1_DURATION_IN_FRAMES}
    />
    <Composition
      id="SuperIndividual-V8-CandidateR2-NoSfx"
      component={SuperIndividualV8CandidateR2NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={SUPER_INDIVIDUAL_R1_DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(Root);
