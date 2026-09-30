import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Easing, Img, staticFile, useCurrentFrame} from 'remotion';
import {chapterPalette, chapterTitles, HistoryScene, timeline} from './timeline';
import {beatFrames, downbeatFrames, strongFrames} from './cues';
import {EarlyStoryMotion} from './motion/EarlyStoryMotion';
import {LateStoryMotion} from './motion/LateStoryMotion';

export type HistoryFilmR6Props = {availableArtKeys: string[]; audioReady: boolean};
const serif = '"Songti SC", "STSong", serif';
const sans = '"PingFang SC", "Heiti SC", sans-serif';
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (n: number) => Easing.inOut(Easing.cubic)(clamp(n));
const reveal = (f: number, at: number, d = 18) => smooth((f - at) / d);
const closest = (list: number[], n: number) => list.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a, list[0] ?? n);
const pulse = (frame: number) => {
  const cue = strongFrames.filter((f) => f <= frame).at(-1) ?? -100;
  return Math.exp(-(frame - cue) / 7);
};

const tear = (x: number) => 'polygon(0 0, ' + x + 'px 0, ' + (x - 18) + 'px 106px, ' + (x + 15) + 'px 220px, ' + (x - 12) + 'px 360px, ' + (x + 21) + 'px 481px, ' + (x - 9) + 'px 590px, ' + (x + 18) + 'px 749px, ' + (x - 16) + 'px 902px, ' + x + 'px 1080px, 0 1080px)';

const Atmosphere: React.FC<{scene: HistoryScene; local: number; beat: number}> = ({scene, local, beat}) => {
  const pal = chapterPalette[scene.chapter - 1];
  const water = /water|sea|sail|harbor|strait|river|ship|cart-wheel/.test(scene.transition);
  return <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
    <defs><linearGradient id={'wave-' + scene.id} x1="0" x2="1"><stop stopColor={pal.water} stopOpacity="0"/><stop offset=".55" stopColor={pal.water} stopOpacity=".4"/><stop offset="1" stopColor={pal.light} stopOpacity=".15"/></linearGradient></defs>
    {water && Array.from({length: 5}, (_, i) => {
      const offset = Math.sin(local / 31 + i * .74) * 17;
      const y = 908 + i * 22 + offset;
      return <path key={'w' + i} d={'M-90 ' + y + ' Q180 ' + (y - 52) + ' 435 ' + (y + 3) + ' T1000 ' + (y - 15) + ' T1565 ' + (y + 12) + ' T2020 ' + (y - 30)} fill="none" stroke={'url(#wave-' + scene.id + ')'} strokeWidth={i === 0 ? 3 : 1.2} opacity={.25 + beat * .13}/>;
    })}
    {Array.from({length: 18}, (_, i) => <circle key={i} cx={(i * 397.1 + local * (.14 + i % 3 * .09)) % 1920} cy={130 + (i * 73.7 + Math.sin(local / 70 + i) * 12) % 705} r={i % 5 === 0 ? 2 : .9} fill={pal.light} opacity={.08 + beat * .1}/>)}
    <path d="M85 1012 C310 995 476 1024 755 1010 S1200 989 1532 1013 S1780 1026 1840 1006" fill="none" stroke={pal.accent} strokeWidth="1.2" opacity=".36"/>
  </svg>;
};

const SceneArt: React.FC<{scene: HistoryScene; local: number; index: number}> = ({scene, local, index}) => {
  const p = smooth(local / Math.max(1, scene.durationFrames - 1));
  const direction = index % 2 ? -1 : 1;
  const water = /water|sea|sail|harbor|strait|river|ship/.test(scene.transition);
  const scale = 1.055 + p * .055;
  const x = direction * (-22 + p * 44);
  const y = 6 - p * 17;
  const common: React.CSSProperties = {position: 'absolute', width: 1920, height: 1080, objectFit: 'cover', transformOrigin: '61% 45%', filter: 'saturate(.9) contrast(1.05)'};
  return <AbsoluteFill style={{overflow: 'hidden', background: '#102029'}}>
    <Img src={staticFile('assets/' + scene.artKey + '.png')} style={{...common, transform: 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')'}}/>
    <AbsoluteFill style={{maskImage: 'linear-gradient(transparent 52%, black 76%)', WebkitMaskImage: 'linear-gradient(transparent 52%, black 76%)', opacity: .74}}>
      <Img src={staticFile('assets/' + scene.artKey + '.png')} style={{...common, transform: 'translate(' + (x * 1.7) + 'px,' + (y - 7 + (water ? Math.sin(local / 24) * 2.5 : 0)) + 'px) scale(' + (scale + .022) + ')'}}/>
    </AbsoluteFill>
    <AbsoluteFill style={{background: 'linear-gradient(90deg,rgba(5,17,22,.45),transparent 48%), linear-gradient(0deg,rgba(6,12,16,.96) 0%,rgba(6,12,16,.52) 19%,transparent 45%),radial-gradient(ellipse at 64% 43%,transparent 35%,rgba(7,15,17,.38) 100%)'}}/>
    <Atmosphere scene={scene} local={local} beat={pulse(scene.startFrame + local)}/>
  </AbsoluteFill>;
};

const subEvents: Record<string, Array<{year: string; title: string; caption?: string}>> = {
  H07: [{year: '1662', title: '郑成功驱荷'}, {year: '1684', title: '清廷设台湾府'}],
  H09: [{year: '1839', title: '虎门销烟'}, {year: '1840', title: '鸦片战争'}, {year: '1842', title: '《南京条约》签订'}],
  H12: [{year: '1894', title: '甲午战争'}, {year: '1895', title: '《马关条约》签订'}],
  H14: [{year: '1900', title: '北京失陷'}, {year: '1901', title: '《辛丑条约》签订'}],
  H15: [{year: '1911', title: '武昌起义', caption: '10月10日晚，武昌起义爆发。'}, {year: '1912', title: '清帝退位', caption: '2月12日，清帝退位。'}],
  H23: [{year: '1945.8', title: '日本宣布投降'}, {year: '1945.9', title: '受降签字'}],
  H26: [{year: '1949.4.20', title: '渡江战役', caption: '4月20日夜，渡江战役开始。'}, {year: '1949.4.23', title: '占领南京', caption: '4月23日，人民解放军占领南京。'}],
};

const SceneText: React.FC<{scene: HistoryScene; local: number; index: number}> = ({scene, local, index}) => {
  const events = subEvents[scene.id] ?? [{year: scene.year, title: scene.title}];
  const switches = events.map((_, i) => i === 0 ? 0 : Math.max(0, closest(beatFrames, scene.startFrame + scene.durationFrames * i / events.length) - scene.startFrame));
  const eventIndex = switches.reduce((active, at, i) => local >= at ? i : active, 0);
  const item = events[eventIndex];
  const intro = index === 0 ? 141 : 7;
  const inP = reveal(local, Math.max(intro, switches[eventIndex]), 15);
  const outP = scene.id === 'H28' ? 1 : 1 - reveal(local, scene.durationFrames - 9, 9);
  const opacity = inP * outP;
  const pal = chapterPalette[scene.chapter - 1];
  const titleSize = item.title.length > 17 ? 43 : item.title.length > 12 ? 49 : 58;
  return <>
    <div style={{position: 'absolute', left: 110, top: 116, opacity, color: pal.light, fontFamily: serif, fontSize: item.year.length > 9 ? 63 : item.year.length > 6 ? 78 : 106, lineHeight: 1, letterSpacing: 5, textShadow: '0 3px 28px #071117', transform: 'translateY(' + ((1 - inP) * 18) + 'px)'}}>{item.year}</div>
    <div style={{position: 'absolute', left: 112, top: 792, maxWidth: 1550, opacity, transform: 'translateY(' + ((1 - inP) * 17) + 'px)'}}>
      <div style={{width: 76 + inP * 72, height: 2, marginBottom: 18, background: pal.accent}}/>
      <div style={{fontFamily: serif, fontSize: scene.id === 'H28' ? 66 : titleSize, fontWeight: 600, letterSpacing: scene.id === 'H28' ? 6 : 3, lineHeight: 1.2, color: pal.light, textShadow: '0 4px 26px #000'}}>{item.title}</div>
      <div style={{fontFamily: sans, fontSize: 25, letterSpacing: 2, color: '#e3ded4', lineHeight: 1.5, marginTop: 15, opacity: reveal(local, Math.max(intro + 7, switches[eventIndex] + 6), 14)}}>{item.caption ?? scene.caption}</div>
    </div>
    {events.length > 1 && <div style={{position: 'absolute', left: 114, top: 259, display: 'flex', gap: 14, opacity: reveal(local, intro, 16)}}>{events.map((_, i) => <div key={i} style={{width: i === eventIndex ? 48 : 14, height: 2, background: pal.accent, opacity: i === eventIndex ? 1 : .4}}/>)}</div>}
  </>;
};

const Shot: React.FC<{scene: HistoryScene; frame: number; index: number}> = ({scene, frame, index}) => {
  const local = Math.min(scene.durationFrames - 1, Math.max(0, frame - scene.startFrame));
  const pal = chapterPalette[scene.chapter - 1];
  const beat = pulse(scene.startFrame + local);
  return <AbsoluteFill>
    <SceneArt scene={scene} local={local} index={index}/>
    <AbsoluteFill style={{opacity: .8 * reveal(local, 12, 24)}}>
      {index < 12 ? <EarlyStoryMotion scene={scene} local={local} light={pal.light} accent={pal.accent} beat={beat}/> : <LateStoryMotion scene={scene} local={local} light={pal.light} accent={pal.accent} beat={beat}/>}
    </AbsoluteFill>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 72% 39%,' + pal.accent + '40,transparent 55%)', opacity: beat * .24, mixBlendMode: 'screen', pointerEvents: 'none'}}/>
    <SceneText scene={scene} local={local} index={index}/>
  </AbsoluteFill>;
};

const Opening: React.FC<{frame: number}> = ({frame}) => {
  const a = reveal(frame, 9, 28) * (1 - reveal(frame, 123, 25));
  return <div style={{position: 'absolute', left: 108, top: 328, color: '#ecd8b5', opacity: a, textShadow: '0 5px 38px rgba(0,0,0,.7)'}}>
    <div style={{fontFamily: serif, fontSize: 116, letterSpacing: 15, lineHeight: 1.15}}>{'山河五百年'.split('').map((c, i) => <span key={i} style={{display: 'inline-block', opacity: reveal(frame, 15 + i * 14, 18), transform: 'translateY(' + ((1 - reveal(frame, 15 + i * 14, 22)) * 20) + 'px)'}}>{c}</span>)}</div>
    <div style={{fontFamily: serif, fontSize: 32, letterSpacing: 13, marginTop: 30, color: '#c9a878'}}>1449 — 1949</div>
    <div style={{width: 160, height: 2, background: '#c9a878', marginTop: 32, transformOrigin: 'left', transform: 'scaleX(' + reveal(frame, 29, 44) + ')'}}/>
  </div>;
};

export const HistoryFilmR6: React.FC<HistoryFilmR6Props> = ({audioReady}) => {
  const frame = useCurrentFrame();
  const scenes = timeline.scenes;
  const index = Math.max(0, scenes.findIndex((s) => frame >= s.startFrame && frame < s.startFrame + s.durationFrames));
  const scene = scenes[index];
  const previous = scenes[index - 1];
  const local = frame - scene.startFrame;
  const chapterChange = previous && previous.chapter !== scene.chapter;
  const transitionDuration = scene.id === 'H05' ? 26 : scene.id === 'H06' ? 10 : chapterChange ? 15 : scene.beatLevel === 'accent' ? 12 : 21;
  const p = index === 0 ? 1 : smooth(local / transitionDuration);
  const x = -70 + p * 2110;
  const fold = /page|paper|edict|document|headlin|treaty/.test(scene.transition);
  return <AbsoluteFill style={{background: '#111c20', overflow: 'hidden', fontFamily: sans}}>
    {audioReady && <Audio src={staticFile('audio/music.mp3')}/>}
    {previous && p < 1 && <Shot scene={previous} frame={previous.startFrame + previous.durationFrames - 1} index={index - 1}/>}
    <AbsoluteFill style={{clipPath: p < 1 ? tear(x) : undefined}}><Shot scene={scene} frame={frame} index={index}/></AbsoluteFill>
    {p > 0 && p < 1 && <div style={{position: 'absolute', left: x - 7, top: 0, height: 1080, width: fold ? 48 : 7, transform: 'rotate(-.5deg)', background: fold ? 'linear-gradient(90deg,#ba9a70,#ead7b2,#493d31)' : '#e3cba7', boxShadow: '-9px 0 26px rgba(0,0,0,.45)', opacity: Math.sin(p * Math.PI) * .83}}/>}
    {frame < 150 && <Opening frame={frame}/>}
    <div style={{position: 'absolute', top: 0, left: 0, width: 1920, height: 38, background: '#101817'}}/>
    <div style={{position: 'absolute', left: 110, top: 62, color: '#e8dac5', fontSize: 17, letterSpacing: 5, opacity: .73}}>山河五百年 <span style={{color: '#c8a075', margin: '0 17px'}}>／</span> 1449—1949</div>
    <div style={{position: 'absolute', right: 110, top: 65, color: '#ddd2c0', fontSize: 16, letterSpacing: 4, opacity: .68}}>{chapterTitles[scene.chapter - 1]}</div>
    <div style={{position: 'absolute', left: 110, top: 1019, height: 2, width: 1700, background: '#bfad8d25'}}/>
    <div style={{position: 'absolute', left: 110, top: 1019, height: 2, width: 1700 * frame / (timeline.meta.durationInFrames - 1), background: '#c7a371'}}/>
    <div style={{position: 'absolute', right: 110, bottom: 24, fontSize: 13, letterSpacing: 2, color: '#d8cdbb', opacity: .62}}>历史艺术复原</div>
    <AbsoluteFill style={{background: '#101817', opacity: 1 - reveal(frame, 0, 10), pointerEvents: 'none'}}/>
  </AbsoluteFill>;
};
