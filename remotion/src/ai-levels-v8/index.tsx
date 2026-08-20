import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  AI_LEVELS_V8_PREVIEW_DURATION_IN_FRAMES,
  AILevelsV8CardPreview16x9NoSfx,
  AILevelsV8CardPreview16x9WithSfx,
} from './AILevelsV8CardPreview16x9';

const AILevelsV8PreviewRoot: React.FC = () => (
  <>
    <Composition
      id="AILevelsV8CardPreview16x9-WithSfx"
      component={AILevelsV8CardPreview16x9WithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={AI_LEVELS_V8_PREVIEW_DURATION_IN_FRAMES}
    />
    <Composition
      id="AILevelsV8CardPreview16x9-NoSfx"
      component={AILevelsV8CardPreview16x9NoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={AI_LEVELS_V8_PREVIEW_DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(AILevelsV8PreviewRoot);
