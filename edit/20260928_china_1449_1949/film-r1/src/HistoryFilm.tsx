import React from 'react';
import {Audio} from '@remotion/media';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {chapterPalette, chapterTitles, HistoryScene, timeline} from './timeline';
import {HistoricalMotifs} from './HistoricalMotifs';
import {M1Paper} from './segments/M1Paper';

export type HistoryFilmProps = {
  availableArtKeys: string[];
  audioReady: boolean;
};

const FONT_SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", serif';
const FONT_SANS = '"PingFang SC", "Heiti SC", "Noto Sans CJK SC", sans-serif';
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => Easing.inOut(Easing.cubic)(clamp(v));
const enter = (frame: number, from: number, duration: number) =>
  ease((frame - from) / Math.max(1, duration));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

const FiberOverlay: React.FC<{frame: number; color: string}> = ({frame, color}) => {
  const drift = frame * 0.006;
  return (
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, opacity: 0.34, pointerEvents: 'none'}}>
      {Array.from({length: 51}, (_, i) => {
        const x = (i * 337.37 + 91) % 1950;
        const y = (i * 171.13 + 47) % 1090;
        const length = 20 + (i % 6) * 17;
        return <path key={i} d={`M${x + drift} ${y} q${length * 0.46} ${i % 2 ? 3 : -3} ${length} 0`} fill="none" stroke={color} strokeWidth={i % 9 === 0 ? 1.2 : 0.55} opacity={i % 7 === 0 ? 0.23 : 0.11}/>;
      })}
      {Array.from({length: 36}, (_, i) => (
        <circle key={`d-${i}`} cx={(i * 431.3 + 30 + drift * 5) % 1940} cy={(i * 229.6 + 40) % 1090} r={i % 4 === 0 ? 1.2 : 0.65} fill={color} opacity={0.14 + (i % 3) * 0.035}/>
      ))}
    </svg>
  );
};

const WaterThread: React.FC<{frame: number; duration: number; color: string; chapter: number}> = ({frame, duration, color, chapter}) => {
  const progress = ease(frame / Math.max(1, duration - 1));
  const reverse = chapter % 2 === 0;
  const offset = reverse ? (1 - progress) * 1530 : progress * 1530;
  return (
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <defs>
        <linearGradient id={`water-${chapter}`} x1="0" x2="1"><stop stopColor={color} stopOpacity="0"/><stop offset=".4" stopColor={color} stopOpacity=".48"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient>
      </defs>
      <path d="M-80 688 C220 628 346 725 596 674 S1036 605 1277 667 S1624 718 2020 642" fill="none" stroke={`url(#water-${chapter})`} strokeWidth="2.4" opacity=".34"/>
      <path d="M-80 703 C220 643 346 740 596 689 S1036 620 1277 682 S1624 733 2020 657" fill="none" stroke={color} strokeWidth=".85" opacity=".16"/>
      <circle cx={reverse ? 1710 - offset : 180 + offset} cy={675 + Math.sin(progress * Math.PI * 4) * 26} r="3.5" fill={color} opacity={0.15 + 0.34 * Math.sin(progress * Math.PI)}/>
    </svg>
  );
};

const AbstractImage: React.FC<{scene: HistoryScene; local: number; index: number; hasArt: boolean}> = ({scene, local, index, hasArt}) => {
  const palette = chapterPalette[Math.max(0, Math.min(5, scene.chapter - 1))];
  const p = clamp(local / Math.max(1, scene.durationFrames - 1));
  const horizontal = index % 2 === 0 ? 1 : -1;
  const movement = ease(p);
  const scale = 1.055 + movement * 0.078;
  const tx = horizontal * lerp(-18, 19, movement);
  const ty = lerp(-14, 11, movement);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: `radial-gradient(ellipse at 62% 38%, ${palette.mid} 0%, ${palette.dark} 76%)`}}>
      {hasArt ? (
        <Img
          src={staticFile(`assets/${scene.artKey}.png`)}
          style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: index % 3 === 0 ? '54% 42%' : index % 3 === 1 ? '45% 46%' : '50% 53%', transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: index % 2 ? '35% 43%' : '65% 51%', filter: 'contrast(1.08) saturate(.87)'}}
        />
      ) : (
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
          {Array.from({length: 11}, (_, i) => <path key={i} d={`M-60 ${190 + i * 78} C300 ${130 + i * 64} 520 ${290 + i * 77} 850 ${220 + i * 72} S1450 ${90 + i * 83} 1990 ${190 + i * 78}`} fill="none" stroke={i % 2 ? palette.water : palette.light} strokeWidth={i % 3 ? 1 : 1.5} opacity={0.08 + (i % 3) * .02}/>)}
          <circle cx={1100 + tx * 3} cy={485 + ty * 3} r="308" fill={palette.accent} opacity=".07"/>
        </svg>
      )}
      <AbsoluteFill style={{background: `linear-gradient(90deg, ${palette.dark}f2 0%, ${palette.dark}b8 27%, ${palette.dark}44 55%, ${palette.dark}10 78%), linear-gradient(0deg, ${palette.dark}ed 0%, ${palette.dark}46 28%, transparent 55%), radial-gradient(ellipse at 55% 45%, transparent 26%, ${palette.dark}77 100%)`}}/>
      <AbsoluteFill style={{background: `linear-gradient(0deg, ${palette.accent}10, transparent 48%), repeating-linear-gradient(100deg, transparent 0px, transparent 39px, ${palette.light}08 40px, transparent 41px)`, mixBlendMode: 'screen', opacity: 0.52}}/>
      <FiberOverlay frame={local} color={palette.light}/>
      <WaterThread frame={local} duration={scene.durationFrames} color={palette.water} chapter={scene.chapter}/>
    </AbsoluteFill>
  );
};

const PageEdge: React.FC<{local: number; accent: string; light: string; level: HistoryScene['beatLevel']}> = ({local, accent, light, level}) => {
  const reach = level === 'accent' ? 350 : 160;
  const slide = (1 - enter(local, 0, level === 'accent' ? 15 : 24)) * reach;
  return (
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', transform: `translateX(${-slide}px)`}}>
      <path d="M0 0 H86 L77 90 L90 215 L76 340 L89 462 L74 585 L91 730 L77 855 L92 1080 H0Z" fill={light} opacity=".16"/>
      <path d="M0 0 H83 L73 95 L87 215 L75 340 L87 462 L72 585 L89 730 L75 855 L90 1080" fill="none" stroke={accent} strokeWidth="1.2" opacity=".4"/>
      <path d="M0 40 H1920 M0 1037 H1920" fill="none" stroke={light} opacity=".12" strokeWidth="1"/>
    </svg>
  );
};

const SceneTypography: React.FC<{scene: HistoryScene; local: number; index: number}> = ({scene, local, index}) => {
  const palette = chapterPalette[Math.max(0, Math.min(5, scene.chapter - 1))];
  const introDelay = index === 0 ? 112 : scene.id === 'H09' ? 55 : scene.id === 'H13' ? 28 : 0;
  const fast = scene.durationFrames < 140;
  const reveal = enter(local, introDelay + (fast ? 3 : 6), fast ? 12 : 20);
  const captionReveal = enter(local, introDelay + (fast ? 8 : 15), fast ? 11 : 20);
  const exit = index === timeline.scenes.length - 1 ? 1 : 1 - enter(local, scene.durationFrames - (fast ? 6 : 12), fast ? 6 : 12);
  const opacity = reveal * exit;
  const titleSize = scene.title.length > 20 ? 45 : scene.title.length > 14 ? 53 : 62;
  const yearSize = scene.year.length > 12 ? 77 : scene.year.length > 7 ? 91 : 123;
  return (
    <>
      <div style={{position: 'absolute', left: 120, top: 66, color: palette.light, fontFamily: FONT_SANS, fontSize: 18, letterSpacing: 5, opacity: .86}}>山河五百年 <span style={{color: palette.accent, padding: '0 16px'}}>／</span> 1449—1949</div>
      {scene.id !== 'H28' && <div style={{position: 'absolute', right: 112, top: 68, color: palette.light, fontFamily: FONT_SANS, fontSize: 16, letterSpacing: 3, opacity: .67}}>第 {String(scene.chapter).padStart(2, '0')} 章 · {chapterTitles[scene.chapter - 1]}</div>}
      {index === 0 && (
        <div style={{position: 'absolute', left: 120, top: 243, color: palette.light, opacity: (1 - enter(local, 111, 24)) * enter(local, 15, 29), transform: `translateY(${(1 - enter(local, 15, 32)) * 23}px)`}}>
          <div style={{fontFamily: FONT_SERIF, fontSize: 116, letterSpacing: 14, lineHeight: 1.1, textShadow: '0 6px 28px #000'}}>山河五百年</div>
          <div style={{fontFamily: FONT_SANS, fontSize: 29, letterSpacing: 9, marginTop: 38, color: palette.accent}}>一首歌，走过 1449—1949</div>
          <div style={{width: 96, height: 2, background: palette.accent, marginTop: 46}}/>
        </div>
      )}
      <div style={{position: 'absolute', left: 119, top: scene.durationFrames < 130 ? 248 : 206, maxWidth: 1290, color: palette.light, opacity, transform: `translateY(${(1 - reveal) * 28}px)`}}>
        <div style={{fontFamily: FONT_SERIF, fontSize: yearSize, fontWeight: 600, letterSpacing: 4, lineHeight: 1, textShadow: '0 5px 32px rgba(0,0,0,.8)'}}>{scene.year}</div>
        <div style={{width: 92, height: 2, marginTop: 28, background: palette.accent}}/>
        <div style={{fontFamily: FONT_SERIF, fontSize: titleSize, fontWeight: 600, lineHeight: 1.25, letterSpacing: 3, marginTop: 24, textShadow: '0 4px 20px #000'}}>{scene.title}</div>
        <div style={{fontFamily: FONT_SANS, fontSize: 27, lineHeight: 1.55, letterSpacing: 2, marginTop: 20, maxWidth: 950, color: '#e5dfd3', opacity: captionReveal}}>{scene.caption}</div>
      </div>
      <PageEdge local={local} accent={palette.accent} light={palette.light} level={scene.beatLevel}/>
    </>
  );
};

const ScenePulse: React.FC<{local: number; scene: HistoryScene}> = ({local, scene}) => {
  const palette = chapterPalette[Math.max(0, Math.min(5, scene.chapter - 1))];
  const strength = scene.beatLevel === 'accent' ? .32 : scene.beatLevel === 'phrase' ? .16 : .06;
  const opacity = Math.exp(-Math.max(0, local) / (scene.beatLevel === 'accent' ? 6 : 10)) * strength;
  return <AbsoluteFill style={{background: `radial-gradient(ellipse at 63% 45%, ${palette.accent} 0%, transparent 57%)`, mixBlendMode: 'screen', opacity, pointerEvents: 'none'}}/>;
};

const ChapterChange: React.FC<{scene: HistoryScene; local: number; previousChapter?: number}> = ({scene, local, previousChapter}) => {
  if (previousChapter === scene.chapter || previousChapter === undefined) return null;
  const palette = chapterPalette[Math.max(0, Math.min(5, scene.chapter - 1))];
  const opacity = enter(local, 1, 8) * (1 - enter(local, 44, 15));
  return (
    <div style={{position: 'absolute', left: 119, top: 148, color: palette.accent, opacity, fontFamily: FONT_SERIF, fontSize: 30, letterSpacing: 9, textShadow: '0 2px 14px #000'}}>{chapterTitles[scene.chapter - 1]}</div>
  );
};

const StoryScene: React.FC<{scene: HistoryScene; frame: number; index: number; hasArt: boolean; previousChapter?: number}> = ({scene, frame, index, hasArt, previousChapter}) => {
  const local = Math.max(0, Math.min(scene.durationFrames - 1, frame - scene.startFrame));
  return (
    <AbsoluteFill>
      <AbstractImage scene={scene} local={local} index={index} hasArt={hasArt}/>
      <HistoricalMotifs scene={scene} local={local} light={chapterPalette[Math.max(0, Math.min(5, scene.chapter - 1))].light} accent={chapterPalette[Math.max(0, Math.min(5, scene.chapter - 1))].accent}/>
      <SceneTypography scene={scene} local={local} index={index}/>
      <ChapterChange scene={scene} local={local} previousChapter={previousChapter}/>
      <ScenePulse local={local} scene={scene}/>
    </AbsoluteFill>
  );
};

const FrameLine: React.FC<{frame: number; activeScene: number}> = ({frame, activeScene}) => {
  const {scenes, meta} = timeline;
  const p = frame / Math.max(1, meta.durationInFrames - 1);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 119, right: 119, bottom: 77, height: 1, background: 'rgba(239,225,196,.19)'}}/>
      <div style={{position: 'absolute', left: 119, bottom: 76, width: `${(1682 * p).toFixed(2)}px`, height: 2, background: '#d7ad79', boxShadow: '0 0 10px rgba(213,163,106,.62)'}}/>
      {scenes.map((s, i) => <div key={s.id} style={{position: 'absolute', left: 119 + s.startFrame / meta.durationInFrames * 1682, bottom: 73, height: i === activeScene ? 9 : 5, width: i === activeScene ? 2 : 1, background: i <= activeScene ? '#ddbb8a' : '#b8aea0', opacity: i === activeScene ? 1 : .48}}/>)}
      <div style={{position: 'absolute', left: 120, bottom: 42, color: '#ded3c2', fontFamily: FONT_SANS, fontSize: 14, letterSpacing: 2, opacity: .66}}>1449</div>
      <div style={{position: 'absolute', right: 120, bottom: 42, color: '#ded3c2', fontFamily: FONT_SANS, fontSize: 14, letterSpacing: 2, opacity: .66}}>1949</div>
      <div style={{position: 'absolute', right: 119, bottom: 106, color: '#ded3c2', fontFamily: FONT_SANS, fontSize: 13, letterSpacing: 1, opacity: .56}}>历史艺术复原画面</div>
    </AbsoluteFill>
  );
};

export const HistoryFilm: React.FC<HistoryFilmProps> = ({availableArtKeys, audioReady}) => {
  const frame = useCurrentFrame();
  const {scenes, meta} = timeline;
  const sceneIndex = Math.max(0, scenes.findIndex((s) => frame >= s.startFrame && frame < s.startFrame + s.durationFrames));
  const current = scenes[sceneIndex];
  const previous = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
  const local = frame - current.startFrame;
  const duration = current.beatLevel === 'accent' ? 9 : current.beatLevel === 'phrase' ? 16 : 24;
  const hardTear = current.beatLevel === 'accent';
  const transitionP = sceneIndex === 0 ? 1 : enter(local + (hardTear ? 4 : 0), 0, duration);
  const available = new Set(availableArtKeys);
  const finalScene = sceneIndex === scenes.length - 1;
  const inM1 = frame >= 3604 && frame <= 4229;
  const inM1Handoff = frame >= 4214 && frame <= 4229;

  return (
    <AbsoluteFill style={{background: '#101715', overflow: 'hidden', fontFamily: FONT_SANS}}>
      {audioReady && <Audio src={staticFile('audio/music.mp3')} trimBefore={1}/>}
      {inM1 ? (
        <>
          {inM1Handoff && <StoryScene scene={scenes[15]} frame={frame} index={15} hasArt={available.has(scenes[15].artKey)} previousChapter={scenes[14].chapter}/>}
          <M1Paper frame={frame}/>
        </>
      ) : (
        <>
          {previous && transitionP < 1 && <StoryScene scene={previous} frame={previous.startFrame + previous.durationFrames - 1} index={sceneIndex - 1} hasArt={available.has(previous.artKey)} previousChapter={sceneIndex > 1 ? scenes[sceneIndex - 2].chapter : undefined}/>}
          <AbsoluteFill style={{opacity: hardTear ? 1 : transitionP, clipPath: hardTear && transitionP < 1 ? `polygon(0 0, ${Math.max(.1, transitionP * 100)}% 0, ${Math.max(.1, transitionP * 100)}% 100%, 0 100%)` : undefined}}>
            <StoryScene scene={current} frame={frame} index={sceneIndex} hasArt={available.has(current.artKey)} previousChapter={previous?.chapter}/>
          </AbsoluteFill>
          {hardTear && transitionP < 1 && <div style={{position: 'absolute', top: 0, bottom: 0, left: `${transitionP * 100}%`, width: 5, transform: 'translateX(-3px)', background: '#e8c99e', opacity: .72, boxShadow: '0 0 20px #f7d6a6'}}/>}
        </>
      )}
      <FrameLine frame={frame} activeScene={sceneIndex}/>
      {finalScene && <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(85,11,18,.18), transparent 62%)', pointerEvents: 'none'}}/>}
      <AbsoluteFill style={{background: '#111610', opacity: 1 - enter(frame, 0, 12), pointerEvents: 'none'}}/>
      <AbsoluteFill style={{background: '#121617', opacity: interpolate(frame, [meta.durationInFrames - 4, meta.durationInFrames - 1], [0, .11], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), pointerEvents: 'none'}}/>
    </AbsoluteFill>
  );
};
