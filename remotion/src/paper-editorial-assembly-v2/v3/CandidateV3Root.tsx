import React from 'react';
import {Composition} from 'remotion';
import {
  PAPER_EDITORIAL_ASSEMBLY_V3_DURATION_IN_FRAMES,
  PAPER_EDITORIAL_ASSEMBLY_V3_FPS,
  PAPER_EDITORIAL_ASSEMBLY_V3_HEIGHT,
  PAPER_EDITORIAL_ASSEMBLY_V3_WIDTH,
  PaperEditorialAssemblyV3,
} from './PaperEditorialAssemblyV3';

export const PaperEditorialAssemblyV3CandidateRoot:React.FC=()=> (
  <Composition
    id="PaperEditorialAssemblyV3Candidate16x9"
    component={PaperEditorialAssemblyV3}
    width={PAPER_EDITORIAL_ASSEMBLY_V3_WIDTH}
    height={PAPER_EDITORIAL_ASSEMBLY_V3_HEIGHT}
    fps={PAPER_EDITORIAL_ASSEMBLY_V3_FPS}
    durationInFrames={PAPER_EDITORIAL_ASSEMBLY_V3_DURATION_IN_FRAMES}
  />
);

