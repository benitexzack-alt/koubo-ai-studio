import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, cancelRender, staticFile, useCurrentFrame} from 'remotion';
import {ASSETS, CARD_ROW, FONT_FAMILY, HEIGHT, SCENES, TILE, TITLE, TITLE_PAINTED_WIDTH, TITLE_VIDEO_STYLE, TOOLS, TYPE, WIDTH} from './plan';
import {TILE_CELLS, cardState, statementOpacity, tileOpacity, titleState} from './motion';

const failMedia = (path: string) => (error: Error) => cancelRender(new Error(`R2必需素材无法解码：${path}；${error.message}`));
const videoStyle = {width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%'} as const;

export const TitleBehindSubject: React.FC = () => {
  const frame = useCurrentFrame();
  const state = titleState(frame);
  const duration = SCENES[0].duration;
  return <AbsoluteFill>
    <OffthreadVideo data-layer="background-video" src={staticFile(ASSETS.titleTake)}
      trimBefore={0} trimAfter={duration} playbackRate={1} muted
      style={TITLE_VIDEO_STYLE} onError={failMedia(ASSETS.titleTake)} />
    <AbsoluteFill data-layer="title-tint" style={{backgroundColor: '#000', opacity: state.opacity * 0.30}} />
    <AbsoluteFill data-layer="title" style={{opacity: state.opacity,
      transform: `scale(${state.scale})`, transformOrigin: '50% 40%',
      filter: 'drop-shadow(0px 0px 14px rgba(245,245,245,0.16))'}}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT}>
        <text x={WIDTH / 2} y={520} textAnchor="middle" textLength={TITLE_PAINTED_WIDTH}
          lengthAdjust="spacingAndGlyphs" fill="#F5F5F5" fontFamily={FONT_FAMILY}
          fontSize={TYPE.headline} fontWeight={400} style={{fontSynthesis: 'none'}}>{TITLE}</text>
      </svg>
    </AbsoluteFill>
    <OffthreadVideo data-layer="same-frame-presenter-matte" src={staticFile(ASSETS.presenterMatte)}
      trimBefore={0} trimAfter={duration} playbackRate={1} muted transparent
      style={TITLE_VIDEO_STYLE} onError={failMedia(ASSETS.presenterMatte)} />
  </AbsoluteFill>;
};

export const TileSceneDissolve: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = SCENES[1];
  return <AbsoluteFill>
    <OffthreadVideo src={staticFile(ASSETS.base)} trimBefore={scene.sourceFrom}
      trimAfter={scene.sourceFrom + scene.duration} playbackRate={1} muted
      style={videoStyle} onError={failMedia(ASSETS.base)} />
    <AbsoluteFill>
      {TILE_CELLS.map((cell) => <div key={cell.index} data-tile={cell.index} style={{
        position: 'absolute', left: cell.left, top: cell.top, width: TILE.width + 2, height: TILE.height + 2,
        opacity: tileOpacity(frame, cell.index), backgroundColor: TILE.canvas,
        backgroundImage: `linear-gradient(${TILE.grid} 1px, transparent 1px), linear-gradient(90deg, ${TILE.grid} 1px, transparent 1px)`,
        backgroundSize: '64px 64px', backgroundPosition: `${-cell.left}px ${-cell.top}px`,
      }} />)}
    </AbsoluteFill>
    <AbsoluteFill style={{opacity: statementOpacity(frame), alignItems: 'center', justifyContent: 'center',
      color: TILE.text, gap: 26, pointerEvents: 'none'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 18, color: TILE.accent,
        fontSize: TYPE.label, letterSpacing: '0.1em'}}>
        <span style={{width: 9, height: 9, backgroundColor: TILE.accent, borderRadius: '50%'}} />{TILE.mark}
      </div>
      <div style={{fontSize: 142, lineHeight: 1.12, textAlign: 'center', letterSpacing: '-0.025em',
        fontWeight: 400, fontSynthesis: 'none'}}>
        {TILE.lines.map((line) => <div key={line}>{line}</div>)}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>;
};

export const ForegroundCardRow: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = SCENES[2];
  return <AbsoluteFill>
    <OffthreadVideo src={staticFile(ASSETS.base)} trimBefore={scene.sourceFrom}
      trimAfter={scene.sourceFrom + scene.duration} playbackRate={1} muted
      style={videoStyle} onError={failMedia(ASSETS.base)} />
    {TOOLS.map((tool, index) => {
      const state = cardState(frame, index);
      if (!state.visible) return null;
      return <div key={tool.key} data-tool-card={tool.key} style={{
        position: 'absolute', left: CARD_ROW.left + index * (CARD_ROW.width + CARD_ROW.gap), top: CARD_ROW.top,
        width: CARD_ROW.width, height: CARD_ROW.height, boxSizing: 'border-box', borderRadius: 22,
        padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12,
        backgroundColor: 'rgba(250,250,247,0.90)', color: '#15202B',
        boxShadow: `0 ${state.shadowY}px ${state.shadowBlur}px rgba(0,0,0,0.23)`,
        opacity: state.opacity, transformOrigin: '50% 50%',
        transform: `perspective(1200px) translate3d(${state.x}px, ${state.y}px, ${state.z}px) rotateY(${state.rotationY}deg) rotateZ(${state.rotationZ}deg) scale(${state.scale})`,
      }}>
        <Img src={staticFile(tool.image)} alt={tool.label}
          style={{width: CARD_ROW.imageSize, height: CARD_ROW.imageSize, objectFit: 'contain', borderRadius: 16}}
          onError={() => cancelRender(new Error(`R2工具真实图缺失：${tool.image}`))} />
        <div style={{fontSize: TYPE.body, lineHeight: '50px', whiteSpace: 'nowrap', fontWeight: 400,
          fontSynthesis: 'none'}}>{tool.label}</div>
      </div>;
    })}
  </AbsoluteFill>;
};
