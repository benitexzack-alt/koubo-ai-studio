import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  LANZHOU_INDUSTRY_AI_V91_CANDIDATE_R1_DURATION_IN_FRAMES,
  LanzhouIndustryAIV91CandidateR1NoSfx,
  LanzhouIndustryAIV91CandidateR1WithSfx,
} from './LanzhouIndustryAIV91CandidateR1';

const Root: React.FC = () => (
  <>
    <Composition
      id="LanzhouIndustryAIV91CandidateR1WithSfx"
      component={LanzhouIndustryAIV91CandidateR1WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={LANZHOU_INDUSTRY_AI_V91_CANDIDATE_R1_DURATION_IN_FRAMES}
    />
    <Composition
      id="LanzhouIndustryAIV91CandidateR1NoSfx"
      component={LanzhouIndustryAIV91CandidateR1NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={LANZHOU_INDUSTRY_AI_V91_CANDIDATE_R1_DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(Root);
