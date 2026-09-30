import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {HistoryFilmR6, HistoryFilmR6Props} from './HistoryFilmR6';
import {timeline} from './timeline';

const Root: React.FC = () => (
  <Composition
    id="ChinaHistory1449To1949"
    component={HistoryFilmR6}
    durationInFrames={timeline.meta.durationInFrames}
    fps={timeline.meta.fps}
    width={timeline.meta.width}
    height={timeline.meta.height}
    defaultProps={{availableArtKeys: [], audioReady: false} satisfies HistoryFilmR6Props}
  />
);

registerRoot(Root);
