import React from 'react';
import {Composition, Folder} from 'remotion';
import {
  SALON_HIGHLIGHT_DURATION_IN_FRAMES,
  SalonHighlightNoSfx,
  SalonHighlightWithSfx,
} from './SalonHighlight';

export const SalonRoot: React.FC = () => (
  <Folder name="Lanzhou-AI-Salon-20260920">
    <Composition
      id="LanzhouAISalon20260920-WithSfx"
      component={SalonHighlightWithSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={SALON_HIGHLIGHT_DURATION_IN_FRAMES}
    />
    <Composition
      id="LanzhouAISalon20260920-NoSfx"
      component={SalonHighlightNoSfx}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={SALON_HIGHLIGHT_DURATION_IN_FRAMES}
    />
  </Folder>
);
