import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  ENTERPRISE_AI_INFORMATION_CHAIN_R1_DURATION_IN_FRAMES,
  EnterpriseAiInformationChainV8CandidateR1WithSfx,
} from './EnterpriseAiInformationChainV8CandidateR1';

const EnterpriseAiInformationChainCandidateR1Root: React.FC = () => (
  <Composition
    id="EnterpriseAiInformationChain-V8-CandidateR1-WithSfx"
    component={EnterpriseAiInformationChainV8CandidateR1WithSfx}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={ENTERPRISE_AI_INFORMATION_CHAIN_R1_DURATION_IN_FRAMES}
  />
);

registerRoot(EnterpriseAiInformationChainCandidateR1Root);
