import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';

import runtimeTimelineDocument from './runtime-timeline.r10.json';
import {PaperBusinessPipelineR10} from './R10VisualComponents';
import {assertR10RuntimeTimeline} from './runtime-contract';

const timeline = assertR10RuntimeTimeline(runtimeTimelineDocument);
const paperEvent = timeline.events.find((event) => event.beatId === 'b07');

if (!paperEvent || paperEvent.component !== 'PaperBusinessPipelineR10') {
  throw new Error('R10_B07_SCENE_ONLY_EVENT_NOT_FOUND');
}

const fontUrl = staticFile('fonts/STHeiti-Medium.ttc');

export const LANZHOU_INDUSTRY_AI_R10_B07_SCENE_ONLY_DURATION_IN_FRAMES = (
  paperEvent.endFrameExclusive - paperEvent.firstVisibleFrame
);

export const LanzhouIndustryAIR10B07PaperSceneOnlyR1: React.FC = () => (
  <AbsoluteFill
    data-r10-paper-scene-only="B07"
    data-r10-timeline-sha={timeline.timelineSha256}
    style={{background: '#17181B'}}
  >
    <style>{`@font-face{font-family:"Koubo Heiti";src:url("${fontUrl}") format("truetype");font-style:normal;font-weight:400 950;}`}</style>
    <PaperBusinessPipelineR10 event={paperEvent} />
  </AbsoluteFill>
);
