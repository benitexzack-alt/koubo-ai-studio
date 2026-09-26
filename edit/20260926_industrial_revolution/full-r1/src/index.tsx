import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {IndustrialHistory} from './IndustrialHistory';

const Root:React.FC=()=> <Composition id="IndustrialHistoryFull" component={IndustrialHistory} durationInFrames={5412} fps={30} width={1920} height={1080}/>;
registerRoot(Root);
