import React from 'react';
import {Composition, registerRoot, type CalculateMetadataFunction} from 'remotion';
import runtime from './runtime-plan.snapshot.json';
import {SmallBusinessAiAgility} from './Composition';
import {validateEpisodeAssets} from './runtime';
import type {EpisodeProps, RuntimePlan} from './types';

const plan = runtime as unknown as RuntimePlan;
const metadata: CalculateMetadataFunction<EpisodeProps> = async ({props, abortSignal}) => {
  await validateEpisodeAssets(props.plan, props.mode, abortSignal);
  return {width: props.plan.width, height: props.plan.height, fps: props.plan.fps, durationInFrames: props.plan.durationInFrames, props};
};
const Root: React.FC = () => <>
  <Composition id="SmallBusinessAiAgility20261017-WithSfx" component={SmallBusinessAiAgility}
    width={1920} height={1080} fps={30} durationInFrames={4126}
    defaultProps={{plan, withSfx: true, mode: 'preview'}} calculateMetadata={metadata} />
  <Composition id="SmallBusinessAiAgility20261017-NoSfx" component={SmallBusinessAiAgility}
    width={1920} height={1080} fps={30} durationInFrames={4126}
    defaultProps={{plan, withSfx: false, mode: 'preview'}} calculateMetadata={metadata} />
  <Composition id="SmallBusinessAiAgility20261017-FormalWithSfx" component={SmallBusinessAiAgility}
    width={1920} height={1080} fps={30} durationInFrames={4126}
    defaultProps={{plan, withSfx: true, mode: 'formal'}} calculateMetadata={metadata} />
</>;
registerRoot(Root);
