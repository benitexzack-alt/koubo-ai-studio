import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  AI_LEVELS_V80_DURATION_IN_FRAMES,
  AILevelsV80Talk16x9NoSfx,
  AILevelsV80Talk16x9WithSfx,
} from './AILevelsV80Talk16x9';

const AILevelsV80Root: React.FC = () => (
  <>
    <Composition
      id="AILevels16x9-V80-WithSfx"
      component={AILevelsV80Talk16x9WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={AI_LEVELS_V80_DURATION_IN_FRAMES}
    />
    <Composition
      id="AILevels16x9-V80-NoSfx"
      component={AILevelsV80Talk16x9NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={AI_LEVELS_V80_DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(AILevelsV80Root);
