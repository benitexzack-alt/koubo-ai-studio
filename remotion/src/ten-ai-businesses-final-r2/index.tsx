import React from 'react';
import {Composition, registerRoot, type CalculateMetadataFunction} from 'remotion';
import {TenAIBusinessesFinal, validateEpisodeAssets, type RuntimePlan, type EpisodeProps} from './Composition';
import runtime from './runtime-plan.r2.json';

const plan = runtime as unknown as RuntimePlan;
const metadata: CalculateMetadataFunction<EpisodeProps> = async ({props, abortSignal}) => {
  await validateEpisodeAssets(props.plan, props.withSfx, abortSignal);
  return {fps: props.plan.fps, width: props.plan.width, height: props.plan.height, props};
};
const Root: React.FC = () => <>
  <Composition id="TenAIBusinessesFinalR2WithSfx" component={TenAIBusinessesFinal}
    durationInFrames={8534} fps={30} width={1920} height={1080}
    defaultProps={{plan, withSfx: true}} calculateMetadata={metadata} />
  <Composition id="TenAIBusinessesFinalR2NoSfx" component={TenAIBusinessesFinal}
    durationInFrames={8534} fps={30} width={1920} height={1080}
    defaultProps={{plan, withSfx: false}} calculateMetadata={metadata} />
  <Composition id="TenAIBusinessesPreviewR2WithSfx" component={TenAIBusinessesFinal}
    durationInFrames={1350} fps={30} width={1920} height={1080}
    defaultProps={{plan, withSfx: true}} calculateMetadata={metadata} />
  <Composition id="TenAIBusinessesPreviewR2NoSfx" component={TenAIBusinessesFinal}
    durationInFrames={1350} fps={30} width={1920} height={1080}
    defaultProps={{plan, withSfx: false}} calculateMetadata={metadata} />
</>;
registerRoot(Root);
