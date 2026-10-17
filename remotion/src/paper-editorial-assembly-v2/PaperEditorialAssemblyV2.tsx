import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {WorldCity} from './WorldCity';
import {WorldEvidence} from './WorldEvidence';
import {WorldSignal} from './WorldSignal';
import {palette} from './palette';

export const PAPER_EDITORIAL_ASSEMBLY_V2_FPS = 30;
export const PAPER_EDITORIAL_ASSEMBLY_V2_WIDTH = 1920;
export const PAPER_EDITORIAL_ASSEMBLY_V2_HEIGHT = 1080;
export const PAPER_EDITORIAL_ASSEMBLY_V2_DURATION_IN_FRAMES = 810;

const WORLD_A_START = 0;
const WORLD_B_START = 255;
const WORLD_C_START = 525;
const WORLD_A_DURATION = 270;
const WORLD_B_DURATION = 285;
const WORLD_C_DURATION = 285;

export const PaperEditorialAssemblyV2: React.FC = () => {
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{background: palette.cream}}>
      <Sequence
        from={WORLD_A_START}
        durationInFrames={WORLD_A_DURATION}
        premountFor={fps}
      >
        <WorldSignal />
      </Sequence>

      <Sequence
        from={WORLD_B_START}
        durationInFrames={WORLD_B_DURATION}
        premountFor={fps}
      >
        <WorldEvidence />
      </Sequence>

      <Sequence
        from={WORLD_C_START}
        durationInFrames={WORLD_C_DURATION}
        premountFor={fps}
      >
        <WorldCity />
      </Sequence>
    </AbsoluteFill>
  );
};
