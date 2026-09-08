import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {LanzhouServicesCandidate} from './LanzhouServicesCandidate';

registerRoot(() => <Composition id="LanzhouServicesV91CandidateR2" component={LanzhouServicesCandidate}
  width={1920} height={1080} fps={30} durationInFrames={8393} />);
