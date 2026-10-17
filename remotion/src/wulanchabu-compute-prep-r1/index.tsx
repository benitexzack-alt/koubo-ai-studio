import React from 'react';
import {Composition, registerRoot, Series} from 'remotion';
import {
  ComputeRentalPrepR1,
  ComputeValueChainPrepR1,
  WulanchabuReasonsPrepR1,
} from './WulanchabuComputePrepR1';

const FPS = 30;

const Montage: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={6 * FPS}>
      <WulanchabuReasonsPrepR1 />
    </Series.Sequence>
    <Series.Sequence durationInFrames={6 * FPS}>
      <ComputeRentalPrepR1 />
    </Series.Sequence>
    <Series.Sequence durationInFrames={8 * FPS}>
      <ComputeValueChainPrepR1 />
    </Series.Sequence>
  </Series>
);

const Root: React.FC = () => (
  <>
    <Composition
      id="WulanchabuReasonsPrepR1"
      component={WulanchabuReasonsPrepR1}
      durationInFrames={6 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="ComputeRentalPrepR1"
      component={ComputeRentalPrepR1}
      durationInFrames={6 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="ComputeValueChainPrepR1"
      component={ComputeValueChainPrepR1}
      durationInFrames={8 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="WulanchabuComputeAnimationMontageR1"
      component={Montage}
      durationInFrames={20 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />
  </>
);

registerRoot(Root);

