import React from 'react';
import {Composition, registerRoot, type CalculateMetadataFunction} from 'remotion';
import {DirectorMotionUpgrade, validateEpisodeAssets, type RuntimePlan, type EpisodeProps} from './Composition';
import runtime from './runtime-plan.v1.json';
const plan = runtime as RuntimePlan;
const metadata: CalculateMetadataFunction<EpisodeProps> = async ({props, abortSignal}) => {
  await validateEpisodeAssets(props.plan, props.withSfx, abortSignal);
  return {fps: props.plan.fps, width: props.plan.width, height: props.plan.height, props};
};
const Root: React.FC = () => <>
  <Composition id="DirectorMotionUpgrade20261014-WithSfx" component={DirectorMotionUpgrade}
    durationInFrames={1798} fps={30} width={1920} height={1080} defaultProps={{plan, withSfx: true}} calculateMetadata={metadata} />
  <Composition id="DirectorMotionUpgrade20261014-NoSfx" component={DirectorMotionUpgrade}
    durationInFrames={1798} fps={30} width={1920} height={1080} defaultProps={{plan, withSfx: false}} calculateMetadata={metadata} />
</>;
registerRoot(Root);
