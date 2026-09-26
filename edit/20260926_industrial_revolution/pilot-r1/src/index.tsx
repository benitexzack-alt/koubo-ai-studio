import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Pilot} from './Pilot';

const Root = () => <Composition id="IndustrialHistoryPilot" component={Pilot} width={1920} height={1080} fps={30} durationInFrames={840}/>;
registerRoot(Root);
