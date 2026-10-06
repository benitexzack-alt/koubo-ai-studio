import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {CandidateDemo} from './CandidateDemo';
import {DEMO_FRAMES, FPS, HEIGHT, WIDTH} from './plan';

const CandidateRoot: React.FC = () => <>
  <Composition id="TenAIBusinesses-MotionUpgrade-R1-WithSfx" component={CandidateDemo}
    durationInFrames={DEMO_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT}
    defaultProps={{withSfx: true, layoutReference: true, showProtectionGuides: false}} />
  <Composition id="TenAIBusinesses-MotionUpgrade-R1-NoSfx" component={CandidateDemo}
    durationInFrames={DEMO_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT}
    defaultProps={{withSfx: false, layoutReference: true, showProtectionGuides: false}} />
  <Composition id="TenAIBusinesses-MotionUpgrade-R1-ProtectionGuide" component={CandidateDemo}
    durationInFrames={DEMO_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT}
    defaultProps={{withSfx: false, layoutReference: false, showProtectionGuides: true}} />
</>;
registerRoot(CandidateRoot);
