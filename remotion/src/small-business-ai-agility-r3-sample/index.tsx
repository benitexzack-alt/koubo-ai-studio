import React from 'react';
import {Composition, registerRoot, type CalculateMetadataFunction} from 'remotion';
import snapshot from './sample-plan.snapshot.json';
import {SmallBusinessAgilityR3Sample} from './Composition';
import {validateEpisodeAssets} from '../small-business-ai-agility-20261017/runtime';
import type {EpisodeProps, RuntimePlan} from '../small-business-ai-agility-20261017/types';

const plan = snapshot as unknown as RuntimePlan;
const metadata: CalculateMetadataFunction<EpisodeProps> = async ({props, abortSignal}) => {
  if (props.mode !== 'preview') throw new Error('R3局部比较只接受预览模式');
  await validateEpisodeAssets(props.plan, 'preview', abortSignal);
  return {width: 1920, height: 1080, fps: 30, durationInFrames: 4126, props};
};
const Root: React.FC = () => <>
  <Composition id="SmallBusinessAgilityR3Sample-WithSfx" component={SmallBusinessAgilityR3Sample}
    width={1920} height={1080} fps={30} durationInFrames={4126}
    defaultProps={{plan, withSfx: true, mode: 'preview'}} calculateMetadata={metadata} />
  <Composition id="SmallBusinessAgilityR3Sample-NoSfx" component={SmallBusinessAgilityR3Sample}
    width={1920} height={1080} fps={30} durationInFrames={4126}
    defaultProps={{plan, withSfx: false, mode: 'preview'}} calculateMetadata={metadata} />
</>;
registerRoot(Root);
