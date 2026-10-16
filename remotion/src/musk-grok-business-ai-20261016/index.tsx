import React from 'react';
import {Composition, registerRoot, type CalculateMetadataFunction} from 'remotion';
import runtime from './runtime-plan.snapshot.json';
import {MuskGrokBusinessAi} from './Composition';
import {validateEpisodeAssets} from './runtime';
import type {EpisodeProps, RuntimePlan} from './types';

const plan = runtime as unknown as RuntimePlan;
const metadata: CalculateMetadataFunction<EpisodeProps> = async ({props, abortSignal}) => {
  await validateEpisodeAssets(props.plan, props.mode, abortSignal);
  return {width: props.plan.width, height: props.plan.height, fps: props.plan.fps, durationInFrames: props.plan.durationInFrames, props};
};
const Root: React.FC = () => <>
  <Composition id="MuskGrokBusinessAI20261016-WithSfx" component={MuskGrokBusinessAi}
    width={1920} height={1080} fps={30} durationInFrames={5035}
    defaultProps={{plan, withSfx: true, mode: 'preview'}} calculateMetadata={metadata} />
  <Composition id="MuskGrokBusinessAI20261016-NoSfx" component={MuskGrokBusinessAi}
    width={1920} height={1080} fps={30} durationInFrames={5035}
    defaultProps={{plan, withSfx: false, mode: 'preview'}} calculateMetadata={metadata} />
  <Composition id="MuskGrokBusinessAI20261016-FormalWithSfx" component={MuskGrokBusinessAi}
    width={1920} height={1080} fps={30} durationInFrames={5035}
    defaultProps={{plan, withSfx: true, mode: 'formal'}} calculateMetadata={metadata} />
</>;
registerRoot(Root);
