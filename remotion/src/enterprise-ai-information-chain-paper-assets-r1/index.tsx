import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {
  PAPER_ASSET_SHOTS,
  PaperAssetComposition,
} from './PaperAssetComposition';

const PaperAssetRoot: React.FC = () => (
  <>
    {PAPER_ASSET_SHOTS.flatMap((shot) => [
      <Composition
        key={`${shot.id}-with-sfx`}
        id={`EnterpriseAIInfoChain-${shot.id}-WithSfx`}
        component={PaperAssetComposition}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={Math.round(shot.durationSeconds * 30)}
        defaultProps={{shotId: shot.id, withSfx: true}}
      />,
      <Composition
        key={`${shot.id}-no-sfx`}
        id={`EnterpriseAIInfoChain-${shot.id}-NoSfx`}
        component={PaperAssetComposition}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={Math.round(shot.durationSeconds * 30)}
        defaultProps={{shotId: shot.id, withSfx: false}}
      />,
    ])}
  </>
);

registerRoot(PaperAssetRoot);

