import {Audio, Video} from '@remotion/media';
import React from 'react';
import {AbsoluteFill, Sequence, staticFile} from 'remotion';

import runtimeTimelineDocument from './runtime-timeline.r10.json';
import {R10BilingualCaptions} from './R10BilingualCaptions';
import {
  ContrastLedgerR10,
  OwnerQuestionArchiveR10,
  PaperBusinessPipelineR10,
  VisibilityBridgeR10,
} from './R10VisualComponents';
import {
  R10_DURATION_IN_FRAMES,
  R10_SOURCE_TRIM_BEFORE,
  assertR10RuntimeTimeline,
  type R10Event,
  type R10RendererId,
} from './runtime-contract';

const timeline = assertR10RuntimeTimeline(runtimeTimelineDocument);
const fontUrl = staticFile('fonts/STHeiti-Medium.ttc');
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const LANZHOU_INDUSTRY_AI_R10_PILOT_R1_DURATION_IN_FRAMES = (
  R10_DURATION_IN_FRAMES
);

const renderers: Record<R10RendererId, React.FC<{event: R10Event}>> = {
  ContrastLedgerR10,
  OwnerQuestionArchiveR10,
  PaperBusinessPipelineR10,
  VisibilityBridgeR10,
};

const soundVolume = (role: string) => {
  if (/confirm|impact|stamp/i.test(role)) return 0.34;
  if (/paper|slide|rustle/i.test(role)) return 0.3;
  if (/node|tick|click/i.test(role)) return 0.28;
  return 0.26;
};

const RuntimeEvent: React.FC<{event: R10Event}> = ({event}) => {
  const Renderer = renderers[event.component];
  if (!Renderer) throw new Error(`R10_RUNTIME_RENDERER_NOT_FOUND:${event.component}`);
  return <Renderer event={event} />;
};

const PreviewLabel: React.FC = () => (
  <>
    <div
      style={{
        position: 'absolute',
        zIndex: 980,
        left: 42,
        top: 28,
        color: '#FFFFFF',
        fontFamily,
        fontSize: 24,
        fontWeight: 900,
        textShadow: '0 3px 10px rgba(0,0,0,.86)',
      }}
    >
      超哥AI创业记
    </div>
    <div
      style={{
        position: 'absolute',
        zIndex: 980,
        right: 42,
        top: 26,
        padding: '8px 14px',
        color: '#FFD28A',
        background: 'rgba(18,16,14,.82)',
        border: '2px solid rgba(255,190,102,.82)',
        fontFamily,
        fontSize: 22,
        fontWeight: 950,
        letterSpacing: 0.5,
      }}
    >
      R10旁路预览｜非正式
    </div>
  </>
);

export const LanzhouIndustryAIR10PilotR1: React.FC<{soundEnabled: boolean}> = ({
  soundEnabled,
}) => (
  <AbsoluteFill
    data-r10-timeline-sha={timeline.timelineSha256}
    data-r10-source-graph-sha={timeline.sourceGraphSha256}
    style={{background: '#0A0C0D', fontFamily}}
  >
    <style>{`@font-face{font-family:"Koubo Heiti";src:url("${fontUrl}") format("truetype");font-style:normal;font-weight:400 950;}`}</style>
    <Video
      src={staticFile('R01.mp4')}
      trimBefore={R10_SOURCE_TRIM_BEFORE}
      volume={1}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center center',
        filter: 'contrast(1.025) saturate(1.012) brightness(1.005)',
      }}
    />
    <AbsoluteFill
      style={{
        background: 'linear-gradient(90deg, rgba(7,10,11,.18), rgba(7,10,11,.015) 52%, rgba(7,10,11,.04))',
      }}
    />

    {timeline.events.map((event) => (
      <Sequence
        key={event.id}
        from={event.firstVisibleFrame}
        durationInFrames={event.endFrameExclusive - event.firstVisibleFrame}
        name={`${event.beatId}:${event.component}`}
      >
        <RuntimeEvent event={event} />
      </Sequence>
    ))}

    {soundEnabled && timeline.soundCues.map((cue) => (
      <Sequence
        key={cue.id}
        from={cue.frame}
        durationInFrames={R10_DURATION_IN_FRAMES - cue.frame}
        name={`SFX:${cue.id}`}
      >
        <Audio src={staticFile(cue.source)} volume={soundVolume(cue.role)} />
      </Sequence>
    ))}

    <R10BilingualCaptions />
    <PreviewLabel />
  </AbsoluteFill>
);

export const LanzhouIndustryAIR10PilotR1WithSfx: React.FC = () => (
  <LanzhouIndustryAIR10PilotR1 soundEnabled />
);

export const LanzhouIndustryAIR10PilotR1NoSfx: React.FC = () => (
  <LanzhouIndustryAIR10PilotR1 soundEnabled={false} />
);
