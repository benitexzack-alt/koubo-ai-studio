import React from 'react';
import {Composition, registerRoot, staticFile, type CalculateMetadataFunction} from 'remotion';
import {SceneDemo, type SceneDemoProps} from './SceneDemo';
import {validateAssets} from './assets';
import {DEMO_FRAMES, FPS, HEIGHT, WIDTH} from './plan';

const validateCandidate: CalculateMetadataFunction<SceneDemoProps> = async ({props, abortSignal}) => {
  await validateAssets(props.withSfx, staticFile, abortSignal);
  return {props, durationInFrames: DEMO_FRAMES};
};
const SceneDemoRoot: React.FC = () => <>
  <Composition id="TenAIBusinesses-MotionUpgrade-R2-WithSfx" component={SceneDemo}
    durationInFrames={DEMO_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT}
    defaultProps={{withSfx: true}} calculateMetadata={validateCandidate} />
  <Composition id="TenAIBusinesses-MotionUpgrade-R2-NoSfx" component={SceneDemo}
    durationInFrames={DEMO_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT}
    defaultProps={{withSfx: false}} calculateMetadata={validateCandidate} />
</>;
registerRoot(SceneDemoRoot);
