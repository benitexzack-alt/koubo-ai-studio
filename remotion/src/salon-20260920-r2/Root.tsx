import React from 'react';
import {Composition, Folder} from 'remotion';
import {
  SALON_R2_DURATION_IN_FRAMES,
  SALON_R2_FPS,
  SalonHighlightR2NoSfx,
  SalonHighlightR2WithSfx,
} from './SalonHighlightR2';

export const SalonR2Root: React.FC = () => (
  <Folder name="Lanzhou-AI-Salon-20260920-R2">
    <Composition
      id="LanzhouAISalon20260920R2-WithSfx"
      component={SalonHighlightR2WithSfx}
      width={1920}
      height={1080}
      fps={SALON_R2_FPS}
      durationInFrames={SALON_R2_DURATION_IN_FRAMES}
    />
    <Composition
      id="LanzhouAISalon20260920R2-NoSfx"
      component={SalonHighlightR2NoSfx}
      width={1920}
      height={1080}
      fps={SALON_R2_FPS}
      durationInFrames={SALON_R2_DURATION_IN_FRAMES}
    />
  </Folder>
);

