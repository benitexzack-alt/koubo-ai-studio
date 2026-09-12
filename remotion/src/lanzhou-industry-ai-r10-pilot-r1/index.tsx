import React from 'react';
import {Composition, registerRoot} from 'remotion';

import {
  LANZHOU_INDUSTRY_AI_R10_PILOT_R1_DURATION_IN_FRAMES,
  LanzhouIndustryAIR10PilotR1NoSfx,
  LanzhouIndustryAIR10PilotR1WithSfx,
} from './LanzhouIndustryAIR10PilotR1';

const R10PilotRoot: React.FC = () => (
  <>
    <Composition
      id="LanzhouIndustryAIR10PilotR1WithSfx"
      component={LanzhouIndustryAIR10PilotR1WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={LANZHOU_INDUSTRY_AI_R10_PILOT_R1_DURATION_IN_FRAMES}
    />
    <Composition
      id="LanzhouIndustryAIR10PilotR1NoSfx"
      component={LanzhouIndustryAIR10PilotR1NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={LANZHOU_INDUSTRY_AI_R10_PILOT_R1_DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(R10PilotRoot);
