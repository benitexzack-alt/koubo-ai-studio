import React from 'react';
import {Composition, Folder} from 'remotion';
import {
  SALON_R3_DURATION_IN_FRAMES,
  SALON_R3_FPS,
  SalonHighlightR3NoSfx,
  SalonHighlightR3WithSfx,
} from './SalonHighlightR3';

export const SalonR3Root: React.FC = () => (
  <Folder name="Lanzhou-AI-Salon-20260920-R3">
    <Composition
      id="LanzhouAISalon20260920R3-WithSfx"
      component={SalonHighlightR3WithSfx}
      width={1920}
      height={1080}
      fps={SALON_R3_FPS}
      durationInFrames={SALON_R3_DURATION_IN_FRAMES}
    />
    <Composition
      id="LanzhouAISalon20260920R3-NoSfx"
      component={SalonHighlightR3NoSfx}
      width={1920}
      height={1080}
      fps={SALON_R3_FPS}
      durationInFrames={SALON_R3_DURATION_IN_FRAMES}
    />
  </Folder>
);
