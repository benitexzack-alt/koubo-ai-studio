import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {GPT6CybercabV8R1} from './GPT6CybercabV8R1';

const Root: React.FC = () => <>
  <Composition id="GPT6CybercabV8R1WithSfx" component={GPT6CybercabV8R1}
    defaultProps={{soundEnabled: true}} width={1920} height={1080} fps={30} durationInFrames={7830} />
  <Composition id="GPT6CybercabV8R1NoSfx" component={GPT6CybercabV8R1}
    defaultProps={{soundEnabled: false}} width={1920} height={1080} fps={30} durationInFrames={7830} />
</>;
registerRoot(Root);
