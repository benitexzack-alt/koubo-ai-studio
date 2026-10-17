import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {PaperWipeV3} from './PaperEngineV3';
import {SfxTrackV3} from './SfxTrackV3';
import {WorldEvidenceWallV3} from './WorldEvidenceWallV3';
import {WorldMacroOverheadV3} from './WorldMacroOverheadV3';
import {WorldMiniatureSystemV3} from './WorldMiniatureSystemV3';
import {v3Palette} from './paletteV3';

export const PAPER_EDITORIAL_ASSEMBLY_V3_FPS=30;
export const PAPER_EDITORIAL_ASSEMBLY_V3_WIDTH=1920;
export const PAPER_EDITORIAL_ASSEMBLY_V3_HEIGHT=1080;
export const PAPER_EDITORIAL_ASSEMBLY_V3_DURATION_IN_FRAMES=900;

export const PaperEditorialAssemblyV3:React.FC=()=> (
  <AbsoluteFill style={{background:v3Palette.paper}}>
    <Sequence from={0} durationInFrames={305} premountFor={30}><WorldMacroOverheadV3/></Sequence>
    <Sequence from={290} durationInFrames={320} premountFor={30}><WorldEvidenceWallV3/></Sequence>
    <Sequence from={595} durationInFrames={305} premountFor={30}><WorldMiniatureSystemV3/></Sequence>

    <Sequence from={283} durationInFrames={20} premountFor={30}>
      <PaperWipeV3 direction="left" primary={v3Palette.red} secondary={v3Palette.paperLight} durationInFrames={20} handoffLabel="信号 → 证据链"/>
    </Sequence>
    <Sequence from={588} durationInFrames={20} premountFor={30}>
      <PaperWipeV3 direction="right" primary={v3Palette.navy} secondary={v3Palette.yellow} durationInFrames={20} handoffLabel="证据链 → 可见系统"/>
    </Sequence>
    <SfxTrackV3/>
  </AbsoluteFill>
);
