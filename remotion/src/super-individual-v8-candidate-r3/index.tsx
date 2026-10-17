import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  SUPER_INDIVIDUAL_R1_DURATION_IN_FRAMES,
  SuperIndividualV8CandidateR3NoSfx,
  SuperIndividualV8CandidateR3WithSfx,
} from './SuperIndividualV8CandidateR3';

const Root: React.FC = () => (
  <>
    <Composition
      id="SuperIndividual-V8-CandidateR3-WithSfx"
      component={SuperIndividualV8CandidateR3WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={SUPER_INDIVIDUAL_R1_DURATION_IN_FRAMES}
    />
    <Composition
      id="SuperIndividual-V8-CandidateR3-NoSfx"
      component={SuperIndividualV8CandidateR3NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={SUPER_INDIVIDUAL_R1_DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(Root);
