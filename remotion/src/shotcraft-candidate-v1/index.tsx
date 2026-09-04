import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {ShotcraftCandidate} from './ShotcraftCandidate';
import plan from './candidate-plan.v1.json';

function Root(){return <>
  <Composition id="ShotcraftCandidateWithSfx" component={ShotcraftCandidate} width={1920} height={1080} fps={plan.fps} durationInFrames={plan.durationInFrames} defaultProps={{withSfx:true}}/>
  <Composition id="ShotcraftCandidateNoSfx" component={ShotcraftCandidate} width={1920} height={1080} fps={plan.fps} durationInFrames={plan.durationInFrames} defaultProps={{withSfx:false}}/>
</>;}
registerRoot(Root);
