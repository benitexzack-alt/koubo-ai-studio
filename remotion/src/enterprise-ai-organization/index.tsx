import React from 'react';
import {Composition, registerRoot, type CalculateMetadataFunction} from 'remotion';
import {EnterpriseAIOrganization, validateEpisodeAssets, type RuntimePlan, type EpisodeProps} from './Composition';
import runtime from './runtime-plan.v1.json';

const plan = runtime as unknown as RuntimePlan;
const metadata: CalculateMetadataFunction<EpisodeProps> = async ({props, abortSignal}) => {
  await validateEpisodeAssets(props.plan, props.withSfx, abortSignal);
  return {fps: props.plan.fps, width: props.plan.width, height: props.plan.height, props};
};
const Root: React.FC = () => <>
  <Composition id="EnterpriseAIOrganization-WithSfx" component={EnterpriseAIOrganization}
    durationInFrames={4385} fps={30} width={1920} height={1080}
    defaultProps={{plan, withSfx: true}} calculateMetadata={metadata} />
  <Composition id="EnterpriseAIOrganization-NoAddedSfx" component={EnterpriseAIOrganization}
    durationInFrames={4385} fps={30} width={1920} height={1080}
    defaultProps={{plan, withSfx: false}} calculateMetadata={metadata} />
</>;
registerRoot(Root);
