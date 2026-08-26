import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {DirectorComposition} from './DirectorComposition';
import {
  DirectorPlan,
  PAPER_EDITORIAL,
  validateDirectorRenderPlanInput,
} from './style';
export {validateDirectorRenderPlanInput} from './style';

export type DirectorInput = Partial<DirectorPlan> | {plan?: unknown};

const WithSfx: React.FC<DirectorInput> = (input) => (
  <DirectorComposition plan={validateDirectorRenderPlanInput(input)} withSfx />
);

const NoSfx: React.FC<DirectorInput> = (input) => (
  <DirectorComposition
    plan={validateDirectorRenderPlanInput(input)}
    withSfx={false}
  />
);

const Still: React.FC<DirectorInput> = (input) => (
  <DirectorComposition
    plan={validateDirectorRenderPlanInput(input)}
    withSfx={false}
    forceNeutralLocalMotion
  />
);

const metadata = ({props}: {props: DirectorInput}) => {
  const plan = validateDirectorRenderPlanInput(props);
  return {
    width: plan.render.width,
    height: plan.render.height,
    fps: plan.render.fps,
    durationInFrames: plan.render.durationInFrames,
  };
};

const Root: React.FC = () => (
  <>
    <Composition
      id="PaperEditorialDirector-Sample-WithSfx"
      component={WithSfx}
      durationInFrames={900}
      fps={PAPER_EDITORIAL.fps}
      width={PAPER_EDITORIAL.width}
      height={PAPER_EDITORIAL.height}
      calculateMetadata={metadata}
    />
    <Composition
      id="PaperEditorialDirector-Sample-NoSfx"
      component={NoSfx}
      durationInFrames={900}
      fps={PAPER_EDITORIAL.fps}
      width={PAPER_EDITORIAL.width}
      height={PAPER_EDITORIAL.height}
      calculateMetadata={metadata}
    />
    <Composition
      id="PaperEditorialDirector-Still"
      component={Still}
      durationInFrames={900}
      fps={PAPER_EDITORIAL.fps}
      width={PAPER_EDITORIAL.width}
      height={PAPER_EDITORIAL.height}
      calculateMetadata={metadata}
    />
  </>
);

registerRoot(Root);
