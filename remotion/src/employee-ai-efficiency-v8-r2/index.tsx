import React from 'react';
import {Video} from '@remotion/media';
import {AbsoluteFill, Composition, Sequence, registerRoot, staticFile, useVideoConfig} from 'remotion';
import {V72ProductionShell, type V72ProductionConfig} from '../components/V72ProductionShell';
import {V8DirectStatement, V8ComparisonBars, V8ProcessRail, V8NodeMap, type V8SemanticLayer} from './V8SemanticStage.r2';
import plan from './runtime-plan.v2.json';

const layers=plan.layers as V8SemanticLayer[];
const config: V72ProductionConfig={
  durationSeconds:plan.durationInFrames/plan.fps,sourceVideo:plan.sourceVideo,captionsSrc:plan.captionsSrc,
  captionVariant:'transparent-v8',brandLabel:'超哥AI创业记',sourceObjectFit:'contain',sourceFilter:'none',sourceOverlay:'none',
  motion:plan.motion,sfxCues:plan.sfxCues,
  scenes:[
    ...plan.insertions.map(clip=>({id:clip.id,kind:'custom' as const,customKey:'insertion',start:clip.startFrame/30,end:clip.endFrameExclusive/30,background:'talk' as const,zIndex:80})),
    ...layers.map(layer=>({id:layer.id,kind:'custom' as const,customKey:'semantic',start:layer.start,end:layer.end,background:'talk' as const,zIndex:100})),
  ],
};
const Episode: React.FC<{soundEnabled:boolean}>=({soundEnabled})=>{
  const {fps}=useVideoConfig();
  return <V72ProductionShell config={config} soundEnabled={soundEnabled} renderCustomScene={scene=>{
    if(scene.customKey==='insertion'){
      const clip=plan.insertions.find(x=>x.id===scene.id)!;
      return <AbsoluteFill style={{background:'#15171b'}}>
        <Video src={staticFile(clip.src)} muted trimBefore={Math.round(clip.sourceStartSeconds*fps)} objectFit="contain" style={{width:'100%',height:'100%'}} />
        <div style={{position:'absolute',right:54,top:28,padding:'5px 12px',fontFamily:'"Koubo Heiti", sans-serif',fontSize:21,color:'#fff',background:'rgba(0,0,0,.48)',borderRadius:4}}>{clip.label}</div>
      </AbsoluteFill>;
    }
    const layer=layers.find(x=>x.id===scene.id)!;
    const Component=layer.params.component==='comparison'?V8ComparisonBars:layer.params.component==='process'?V8ProcessRail:layer.params.component==='node-map'?V8NodeMap:V8DirectStatement;
    return <div data-semantic-layer={layer.id}><Component layer={layer}/></div>;
  }}/>;
};
const Preview:React.FC<{soundEnabled:boolean}>=({soundEnabled})=><AbsoluteFill>
  {plan.previewRanges.map(range=><Sequence key={range.startFrame} from={range.outputStartFrame} durationInFrames={range.durationInFrames}>
    <Sequence from={-range.startFrame}><Episode soundEnabled={soundEnabled}/></Sequence>
  </Sequence>)}
</AbsoluteFill>;
const Root:React.FC=()=><>
  <Composition id="EmployeeAIEfficiencyV8-R2-Full-WithSfx" component={Episode} durationInFrames={plan.durationInFrames} fps={30} width={1920} height={1080} defaultProps={{soundEnabled:true}}/>
  <Composition id="EmployeeAIEfficiencyV8-R2-Full-NoSfx" component={Episode} durationInFrames={plan.durationInFrames} fps={30} width={1920} height={1080} defaultProps={{soundEnabled:false}}/>
  <Composition id="EmployeeAIEfficiencyV8-R2-Preview-WithSfx" component={Preview} durationInFrames={plan.previewDurationInFrames} fps={30} width={1920} height={1080} defaultProps={{soundEnabled:true}}/>
  <Composition id="EmployeeAIEfficiencyV8-R2-Preview-NoSfx" component={Preview} durationInFrames={plan.previewDurationInFrames} fps={30} width={1920} height={1080} defaultProps={{soundEnabled:false}}/>
</>;
registerRoot(Root);
