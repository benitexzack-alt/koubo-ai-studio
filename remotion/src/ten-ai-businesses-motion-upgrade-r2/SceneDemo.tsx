import React, {useEffect} from 'react';
import {loadFont} from '@remotion/fonts';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {ForegroundCardRow, TileSceneDissolve, TitleBehindSubject} from './effects';
import {ASSETS, FONT_FAMILY, SCENES, SOUND_CUES, type SceneKind} from './plan';
import {soundEnvelope} from './motion';

export type SceneDemoProps = {withSfx: boolean};
const SceneSounds: React.FC<{kind: SceneKind}> = ({kind}) => <>
  {SOUND_CUES[kind].map((cue) => <Sequence key={`${cue.at}-${cue.source}`} from={cue.at}
    durationInFrames={cue.duration} layout="none">
    <Audio src={staticFile(cue.source)} trimAfter={cue.duration}
      volume={(frame) => cue.gain * soundEnvelope(frame, cue.duration)}
      onError={(error) => cancelRender(new Error(`R2动作音缺失：${cue.source}；${error.message}`))} />
  </Sequence>)}
</>;

/** 同一场景两版都由同一个真实take提供原声，withSfx只开关短动作音。 */
export const SceneDemo: React.FC<SceneDemoProps> = ({withSfx}) => {
  useEffect(() => {
    const handle = delayRender('加载本地得意黑');
    loadFont({family: FONT_FAMILY, url: staticFile(ASSETS.font), format: 'woff2', weight: '400', display: 'block'})
      .then(() => continueRender(handle))
      .catch((error: unknown) => cancelRender(new Error(`R2本地字体无法加载：${String(error)}`)));
  }, []);
  return <AbsoluteFill translate="no" className="notranslate" style={{backgroundColor: '#111F2B',
    fontFamily: FONT_FAMILY, fontSynthesis: 'none'}}>
    {SCENES.map((scene) => <Sequence key={scene.kind} from={scene.from} durationInFrames={scene.duration}>
      {scene.kind === 'type-behind-subject' ? <TitleBehindSubject /> :
        scene.kind === 'transition-tile-dissolve' ? <TileSceneDissolve /> : <ForegroundCardRow />}
      <Audio data-role="original-narration" src={staticFile(ASSETS.base)} trimBefore={scene.narrationFrom}
        trimAfter={scene.narrationFrom + scene.duration} playbackRate={1} volume={1}
        onError={(error) => cancelRender(new Error(`R2原声无法读取：${ASSETS.base}；${error.message}`))} />
      {withSfx ? <SceneSounds kind={scene.kind} /> : null}
    </Sequence>)}
  </AbsoluteFill>;
};
