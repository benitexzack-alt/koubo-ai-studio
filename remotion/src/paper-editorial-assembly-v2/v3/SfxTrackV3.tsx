import React from 'react';
import {Audio} from '@remotion/media';
import {Sequence, staticFile, useVideoConfig} from 'remotion';

const sfxEvents = [
  {id:'v3-sfx-001',at:0.7,file:'audio/koubo-sfx-v1/card-reveal.wav',volume:0.8},
  {id:'v3-sfx-002',at:9.5,file:'audio/koubo-sfx-v1/section-air.wav',volume:0.8},
  {id:'v3-sfx-003',at:15.0,file:'audio/koubo-sfx-v1/node-connect.wav',volume:1.0},
  {id:'v3-sfx-004',at:19.7,file:'audio/koubo-sfx-v1/section-air.wav',volume:0.8},
  {id:'v3-sfx-005',at:29.3,file:'audio/koubo-sfx-v1/keyword-tick.wav',volume:0.8},
] as const;

export const SfxTrackV3: React.FC = () => {
  const {fps}=useVideoConfig();
  return (
    <>
      {sfxEvents.map((event)=>(
        <Sequence key={event.id} from={Math.round(event.at*fps)} premountFor={fps}>
          <Audio src={staticFile(event.file)} volume={event.volume}/>
        </Sequence>
      ))}
    </>
  );
};
