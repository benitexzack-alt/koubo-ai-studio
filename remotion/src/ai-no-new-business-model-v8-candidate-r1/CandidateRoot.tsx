import React from 'react';
import {Composition} from 'remotion';
import {
  AI_NO_NEW_BUSINESS_MODEL_R1_DURATION_IN_FRAMES,
  AINoNewBusinessModelV8CandidateR1NoSfx,
  AINoNewBusinessModelV8CandidateR1WithSfx,
} from './AINoNewBusinessModelV8CandidateR1';

export const AINoNewBusinessModelCandidateRoot: React.FC = () => (
  <>
    <Composition
      id="AINoNewBusinessModel16x9-V8-R1-WithSfx"
      component={AINoNewBusinessModelV8CandidateR1WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={AI_NO_NEW_BUSINESS_MODEL_R1_DURATION_IN_FRAMES}
    />
    <Composition
      id="AINoNewBusinessModel16x9-V8-R1-NoSfx"
      component={AINoNewBusinessModelV8CandidateR1NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={AI_NO_NEW_BUSINESS_MODEL_R1_DURATION_IN_FRAMES}
    />
  </>
);
