import React from 'react';
import {Composition} from 'remotion';
import {
  LOCAL_AI_SERVICES_R1_DURATION_IN_FRAMES,
  LocalAIServicesV8CandidateR1NoSfx,
  LocalAIServicesV8CandidateR1WithSfx,
} from './LocalAIServicesV8CandidateR1';

export const LocalAIServicesCandidateRoot: React.FC = () => (
  <>
    <Composition
      id="LocalAIServices16x9-V8-R1-WithSfx"
      component={LocalAIServicesV8CandidateR1WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={LOCAL_AI_SERVICES_R1_DURATION_IN_FRAMES}
    />
    <Composition
      id="LocalAIServices16x9-V8-R1-NoSfx"
      component={LocalAIServicesV8CandidateR1NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={LOCAL_AI_SERVICES_R1_DURATION_IN_FRAMES}
    />
  </>
);
