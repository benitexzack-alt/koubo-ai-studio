import React from 'react';
import {Composition, registerRoot, type CalculateMetadataFunction} from 'remotion';
import snapshot from './runtime-plan.json';
import {AiCostProfit20261023, validateRuntimePlan, type EpisodeProps, type RuntimePlan} from './Composition';

const plan = snapshot as unknown as RuntimePlan;
const metadata: CalculateMetadataFunction<EpisodeProps> = async ({props}) => {
  validateRuntimePlan(props.plan, props.mode);
  return {width: 1920, height: 1080, fps: 30, durationInFrames: 9864, props};
};

const Root: React.FC = () => <>
  <Composition id="AiCostProfit20261023WithSfx" component={AiCostProfit20261023}
    width={1920} height={1080} fps={30} durationInFrames={9864}
    defaultProps={{plan, withSfx: true, mode: 'preview'}} calculateMetadata={metadata} />
  <Composition id="AiCostProfit20261023NoSfx" component={AiCostProfit20261023}
    width={1920} height={1080} fps={30} durationInFrames={9864}
    defaultProps={{plan, withSfx: false, mode: 'preview'}} calculateMetadata={metadata} />
</>;

registerRoot(Root);
