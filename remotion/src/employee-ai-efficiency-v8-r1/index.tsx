import React from 'react';
import {Video} from '@remotion/media';
import {
  AbsoluteFill, Composition, Easing, Sequence, interpolate, registerRoot,
  staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import {V72ProductionShell, type V72ProductionConfig} from '../components/V72ProductionShell';
import plan from './runtime-plan.v1.json';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
type Callout = typeof plan.callouts[number];
type Insertion = typeof plan.insertions[number];

const SpokenKeyword: React.FC<{cue: Callout}> = ({cue}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = Math.round(cue.end * fps) - Math.round(cue.start * fps);
  const enter = interpolate(frame, [0, 8], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const exit = interpolate(frame, [duration - 5, duration - 1], [1, 0], clamp);
  return (
    <div style={{position: 'absolute', left: 80, top: 164, width: 470,
      color: '#fff', fontFamily: '"Koubo Heiti", sans-serif', fontSize: cue.fontSize,
      fontWeight: 800, lineHeight: 1.2, opacity: enter * exit,
      transform: `translateY(${(1 - enter) * 12}px)`,
      textShadow: '0 2px 6px rgba(0,0,0,.9), 0 0 22px rgba(0,0,0,.6)'}}>
      {cue.lines.map(line => <div key={line}>{line}</div>)}
      <div style={{marginTop: 16, height: 5, width: 112,
        background: cue.accent, transformOrigin: 'left',
        transform: `scaleX(${interpolate(frame, [5, 18], [0, 1], clamp)})`}} />
    </div>
  );
};

const GeneratedInsertion: React.FC<{clip: Insertion}> = ({clip}) => {
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: '#15171b'}}>
      <Video src={staticFile(clip.src)} muted trimBefore={Math.round(clip.sourceStartSeconds * fps)}
        objectFit="contain" style={{width: '100%', height: '100%'}} />
      <div style={{position: 'absolute', right: 54, top: 28, padding: '5px 12px',
        fontFamily: '"Koubo Heiti", sans-serif', fontSize: 21, color: '#fff',
        background: 'rgba(0,0,0,.48)', borderRadius: 4}}>{clip.label}</div>
    </AbsoluteFill>
  );
};

const config: V72ProductionConfig = {
  durationSeconds: plan.durationInFrames / plan.fps,
  sourceVideo: plan.sourceVideo,
  captionsSrc: plan.captionsSrc,
  captionVariant: 'transparent-v8',
  brandLabel: '超哥AI创业记',
  sourceObjectFit: 'contain',
  sourceFilter: 'none',
  sourceOverlay: 'none',
  motion: plan.motion,
  scenes: [
    ...plan.insertions.map(clip => ({id: clip.id, kind: 'custom' as const,
      customKey: 'generated-insertion', start: clip.startFrame / plan.fps,
      end: clip.endFrameExclusive / plan.fps, background: 'talk' as const, zIndex: 80})),
    ...plan.callouts.map(cue => ({id: cue.id, kind: 'custom' as const,
      customKey: 'spoken-keyword', start: cue.start, end: cue.end,
      background: 'talk' as const, zIndex: 100})),
  ],
  sfxCues: plan.sfxCues,
};

const Episode: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => {
  // 听辨没有答复时不把识别为“荣誉、对话”的候选字幕放进可观看预览。
  if (!plan.audioReviewComplete) throw new Error('本期一处实录听辨尚未确认，请先更新字幕绑定。');
  return <V72ProductionShell config={config} soundEnabled={soundEnabled}
    renderCustomScene={scene => {
      if (scene.customKey === 'generated-insertion') {
        const clip = plan.insertions.find(item => item.id === scene.id);
        return clip ? <GeneratedInsertion clip={clip} /> : null;
      }
      const cue = plan.callouts.find(item => item.id === scene.id);
      return cue ? <SpokenKeyword cue={cue} /> : null;
    }} />;
};

const Preview: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <AbsoluteFill>
    {plan.previewRanges.map(range => (
      <Sequence key={range.startFrame} from={range.outputStartFrame} durationInFrames={range.durationInFrames}>
        <Sequence from={-range.startFrame}>
          <Episode soundEnabled={soundEnabled} />
        </Sequence>
      </Sequence>
    ))}
  </AbsoluteFill>
);

const Root: React.FC = () => <>
  <Composition id="EmployeeAIEfficiencyV8-Preview-WithSfx" component={Preview}
    durationInFrames={plan.previewDurationInFrames} fps={30} width={1920} height={1080}
    defaultProps={{soundEnabled: true}} />
  <Composition id="EmployeeAIEfficiencyV8-Preview-NoSfx" component={Preview}
    durationInFrames={plan.previewDurationInFrames} fps={30} width={1920} height={1080}
    defaultProps={{soundEnabled: false}} />
  <Composition id="EmployeeAIEfficiencyV8-Full-WithSfx" component={Episode}
    durationInFrames={plan.durationInFrames} fps={30} width={1920} height={1080}
    defaultProps={{soundEnabled: true}} />
  <Composition id="EmployeeAIEfficiencyV8-Full-NoSfx" component={Episode}
    durationInFrames={plan.durationInFrames} fps={30} width={1920} height={1080}
    defaultProps={{soundEnabled: false}} />
</>;

registerRoot(Root);
