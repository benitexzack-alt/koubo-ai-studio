import React from 'react';
import {Audio, Video} from '@remotion/media';
import {AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {V72ProductionShell, type V72ProductionConfig, type V72CustomScene} from '../components/V72ProductionShell';
import {V8Closing, V8ComparisonBars, V8DirectStatement, V8HeroDefinition, V8ProcessRail, V8StatusStack, type V8SemanticLayer} from '../components/V8SemanticStage';
import {MarkerUnderline} from '../shotcraft-candidate-v1/ShotcraftEffects.generated';
import plan from './candidate-plan.v1.json';

type Scene = (typeof plan.scenes)[number];
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const fontFamily = '"Koubo Heiti", "PingFang SC", sans-serif';

const config: V72ProductionConfig = {
  durationSeconds: 261,
  sourceVideo: 'media/R01-cut.mp4',
  captionsSrc: 'data/actual-bilingual.v1.json',
  captionVariant: 'transparent-v8', captionMode: 'bilingual', brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.025) saturate(1.015)',
  sourceOverlay: 'linear-gradient(90deg, rgba(2,7,12,0.16), rgba(2,7,12,0) 51%)',
  motion: {cuts: plan.scenes.map(s => s.start), baseScale: 1.003,
    peakScales: [1.021, 1.014, 1.018], peakX: [-4, 3, -3], peakY: [-1, 0, -1], transformOrigin: '59% 43%'},
  scenes: plan.scenes.map(scene => ({id: scene.id, start: scene.start, end: scene.end,
    kind: 'custom', customKey: scene.kind, data: scene,
    background: scene.kind === 'semantic' ? 'talk' : 'opaque', zIndex: scene.kind === 'semantic' ? 90 : 180})),
  sfxCues: plan.sfxCues.map(cue => ({id: cue.id, time: cue.time, src: cue.src, file: cue.src.split('/').at(-1)!, volume: cue.volume})),
};

const SourceTag: React.FC<{label: string}> = ({label}) => <div style={{position: 'absolute', right: 48, top: 32,
  color: '#fff', background: 'rgba(0,0,0,0.74)', padding: '7px 12px', fontFamily, fontSize: 19,
  borderLeft: '3px solid #68DAF8', zIndex: 5}}>{label}</div>;

const MediaScene: React.FC<{scene: Scene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const frames = Math.round((scene.end - scene.start) * 30);
  if (scene.kind === 'paper') return <AbsoluteFill style={{background: '#0C1116'}}>
    <Video src={staticFile(scene.asset)} muted style={{width: '100%', height: '100%', objectFit: 'contain'}} />
    <SourceTag label="AI生成 · 纸艺机制示意" />
  </AbsoluteFill>;
  const isU01 = scene.id === 'B1';
  // U01 has embedded subtitles: keep its whole frame above our separate caption band.
  const progress = Math.min(interpolate(frame, [0, 16], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)}),
    interpolate(frame, [frames - 12, frames], [1, 0], clamp));
  return <AbsoluteFill style={{background: '#090D12'}}>
    <Video src={staticFile(scene.asset)} trimBefore={Math.round(scene.trimStart * 30)} muted
      style={{position: 'absolute', left: 0, top: isU01 ? 0 : 48, width: '100%', height: isU01 ? 900 : 870, objectFit: 'contain'}} />
    {!isU01 && <div style={{position: 'absolute', overflow: 'hidden',
      right: interpolate(progress, [0, 1], [0, 64]), bottom: interpolate(progress, [0, 1], [0, 178]),
      width: interpolate(progress, [0, 1], [1920, 278]), height: interpolate(progress, [0, 1], [1080, 278]),
      borderRadius: interpolate(progress, [0, 1], [0, 150]),
      border: `${3 * progress}px solid #F6F6F6`, boxSizing: 'border-box'}}>
      <Video src={staticFile('media/R01-cut.mp4')} trimBefore={Math.round(scene.start * 30)} muted objectFit="cover"
        style={{width: '100%', height: '100%', objectPosition: '61% 43%'}} />
    </div>}
    <SourceTag label={scene.sourceLabel} />
  </AbsoluteFill>;
};

const SemanticScene: React.FC<{scene: Scene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const layer: V8SemanticLayer = {id: scene.id, start: scene.start, end: scene.end,
    title: scene.title, detail: scene.detail, items: scene.items, params: {component: scene.component}};
  if (scene.component === 'marker') return <div style={{position: 'absolute', left: 54, top: 152, width: 640,
    color: '#F8FAFD', fontFamily, textShadow: '0 3px 12px #10151D'}}>
    <div style={{fontSize: 22, color: '#68DAF8', marginBottom: 20}}>本期关键词</div>
    <MarkerUnderline frame={frame} fps={30} durationInFrames={Math.round((scene.end-scene.start)*30)} keyword={scene.title} fontSize={58}/>
    <div style={{fontSize: 28, lineHeight: 1.5, marginTop: 28, maxWidth: 590}}>{scene.detail}</div>
  </div>;
  switch(scene.component) {
    case 'comparison': return <V8ComparisonBars layer={layer}/>;
    case 'process': return <V8ProcessRail layer={layer}/>;
    case 'definition': return <V8HeroDefinition layer={layer}/>;
    case 'status': return <V8StatusStack layer={layer}/>;
    case 'closing': return <V8Closing layer={layer}/>;
    default: return <V8DirectStatement layer={layer}/>;
  }
};

const PersistentLayers: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = plan.scenes.find(s => frame >= Math.round(s.start*30) && frame < Math.round(s.end*30));
  const chapter = [...plan.chapters].reverse().find(c => frame >= c.startFrame) ?? plan.chapters[0];
  return <>
    {plan.mediaAudio.map(track => <Sequence key={track.id} from={track.startFrame} durationInFrames={track.durationFrames} layout="none">
      <Audio src={staticFile(track.asset)} trimBefore={track.trimBeforeFrames} volume={track.volume}/>
    </Sequence>)}
    {scene?.kind === 'semantic' && <div style={{position:'absolute', left:54, top:72, zIndex:215, color:'#FAFAFA',
      display:'flex', gap:16, alignItems:'center', fontFamily, fontSize:22, textShadow:'0 2px 10px #111'}}>
      <span style={{color:'#68DAF8',fontWeight:900}}>{chapter.number}</span><span>{chapter.title}</span>
    </div>}
  </>;
};

export const GPT6CybercabV8R1: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) =>
  <V72ProductionShell config={config} soundEnabled={soundEnabled}
    renderCustomScene={(wrapped: V72CustomScene) => {
      const scene = wrapped.data as unknown as Scene;
      return scene.kind === 'semantic' ? <SemanticScene scene={scene}/> : <MediaScene scene={scene}/>;
    }} persistentOverlay={<PersistentLayers/>}/>;
