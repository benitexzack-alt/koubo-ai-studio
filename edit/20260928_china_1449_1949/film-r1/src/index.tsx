import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {HistoryFilm, HistoryFilmProps} from './HistoryFilm';
import {timeline} from './timeline';

const Root: React.FC = () => (
  <Composition
    id="ChinaHistory1449To1949"
    component={HistoryFilm}
    durationInFrames={timeline.meta.durationInFrames}
    fps={timeline.meta.fps}
    width={timeline.meta.width}
    height={timeline.meta.height}
    defaultProps={{availableArtKeys: [], audioReady: false} satisfies HistoryFilmProps}
  />
);

registerRoot(Root);
