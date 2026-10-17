import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {DirectorV2E2EWechat} from './DirectorV2E2EWechat';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './timeline';

const CandidateRoot: React.FC = () => (
  <>
    <Composition
      id="DirectorV2E2EWechat-Candidate02-WithSfx"
      component={DirectorV2E2EWechat}
      defaultProps={{candidateRenderGate: 'blocked-direct-render', withSfx: true}}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={DURATION_IN_FRAMES}
    />
    <Composition
      id="DirectorV2E2EWechat-Candidate02-NoSfx"
      component={DirectorV2E2EWechat}
      defaultProps={{candidateRenderGate: 'blocked-direct-render', withSfx: false}}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={DURATION_IN_FRAMES}
    />
  </>
);

registerRoot(CandidateRoot);
