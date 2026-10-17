import React from 'react';
import {Composition} from 'remotion';
import {
  PAPER_EDITORIAL_ASSEMBLY_V2_DURATION_IN_FRAMES,
  PAPER_EDITORIAL_ASSEMBLY_V2_FPS,
  PAPER_EDITORIAL_ASSEMBLY_V2_HEIGHT,
  PAPER_EDITORIAL_ASSEMBLY_V2_WIDTH,
  PaperEditorialAssemblyV2,
} from './PaperEditorialAssemblyV2';

export const PaperEditorialAssemblyV2CandidateRoot: React.FC = () => (
  <Composition
    id="PaperEditorialAssemblyV2Candidate16x9"
    component={PaperEditorialAssemblyV2}
    width={PAPER_EDITORIAL_ASSEMBLY_V2_WIDTH}
    height={PAPER_EDITORIAL_ASSEMBLY_V2_HEIGHT}
    fps={PAPER_EDITORIAL_ASSEMBLY_V2_FPS}
    durationInFrames={PAPER_EDITORIAL_ASSEMBLY_V2_DURATION_IN_FRAMES}
  />
);

