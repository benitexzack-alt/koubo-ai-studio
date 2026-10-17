import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  P04B11LocalDeterministic,
  P05B15LocalDeterministic,
} from './PaperLocalCompositions';

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const DURATION_IN_FRAMES = 210;

const LocalPaperRoot: React.FC = () => (
  <>
    <Composition
      id="LanzhouIndustryAI-P04-B11-LocalDeterministic"
      component={P04B11LocalDeterministic}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={DURATION_IN_FRAMES}
    />
    <Composition
      id="LanzhouIndustryAI-P05-B15-LocalDeterministic"
      component={P05B15LocalDeterministic}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(LocalPaperRoot);
