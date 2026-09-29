import React from 'react';
import {Easing} from 'remotion';
import {HistoryScene} from './timeline';

const progress = (frame: number, from: number, duration: number) => Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, (frame - from) / Math.max(1, duration))));

const starPoints = (cx: number, cy: number, outer: number, rotation: number) =>
  Array.from({length: 10}, (_, i) => {
    const radius = i % 2 === 0 ? outer : outer * .382;
    const angle = rotation + Math.PI * i / 5;
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
  }).join(' ');

const FlagOfChina: React.FC<{local: number}> = ({local}) => {
  const opacity = progress(local, 3, 15);
  const largeX = 5;
  const largeY = 5;
  const small: Array<[number, number]> = [[10, 2], [12, 4], [12, 7], [10, 9]];
  return (
    <svg width="270" height="204" viewBox="0 0 36 27" style={{position: 'absolute', right: 145, top: 98, opacity: opacity * .91, transform: `translateY(${(1 - opacity) * 14}px) rotate(-3deg)`, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,.42))'}} aria-label="纸页上的完整五星红旗矢量意象，不代表广场升旗位置">
      <defs>
        <linearGradient id="flag-cloth" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ac2219"/>
          <stop offset=".22" stopColor="#DE2910"/>
          <stop offset=".56" stopColor="#e93419"/>
          <stop offset="1" stopColor="#bd1b10"/>
        </linearGradient>
      </defs>
      <path d="M1 .8 L35 .4 L35.4 25.5 L.4 26.4Z" fill="#e5d8bf" stroke="#a58b67" strokeWidth=".32"/>
      <path d="M3 3H33V23H3Z" fill="url(#flag-cloth)"/>
      <g transform="translate(3 3)">
        <polygon points={starPoints(largeX, largeY, 3, -Math.PI / 2)} fill="#FFDE00"/>
        {small.map(([x, y], i) => <polygon key={i} points={starPoints(x, y, 1, Math.atan2(largeY - y, largeX - x))} fill="#FFDE00"/>)}
      </g>
      <path d="M3.4 3.4V22.6" fill="none" stroke="#f47952" strokeOpacity=".28" strokeWidth=".35"/>
    </svg>
  );
};

type MicroBeat = {stamp: string; detail: string};
const MICRO_BEATS: Record<string, MicroBeat[]> = {
  H07: [{stamp: '1662', detail: '郑成功驱荷'}, {stamp: '1684', detail: '设台湾府'}],
  H09: [{stamp: '1839', detail: '虎门销烟'}, {stamp: '1840', detail: '鸦片战争'}, {stamp: '1842', detail: '《南京条约》'}],
  H12: [{stamp: '1894', detail: '甲午战争'}, {stamp: '1895', detail: '《马关条约》'}],
  H14: [{stamp: '1900', detail: '北京沦陷'}, {stamp: '1901', detail: '《辛丑条约》'}],
  H15: [{stamp: '1911', detail: '武昌起义'}, {stamp: '1912', detail: '清帝退位'}],
  H23: [{stamp: '1945.8', detail: '日本宣布投降'}, {stamp: '1945.9', detail: '受降签字'}],
  H26: [{stamp: '4 月 20 日夜', detail: '渡江战役开始'}, {stamp: '4 月 23 日', detail: '占领南京'}],
};

const MicroBeatCard: React.FC<{scene: HistoryScene; local: number; light: string; accent: string}> = ({scene, local, light, accent}) => {
  const beats = MICRO_BEATS[scene.id];
  if (!beats) return null;
  const cycle = Math.max(1, scene.durationFrames / beats.length);
  return (
    <div style={{position: 'absolute', right: 122, top: 150, width: 508, display: 'flex', flexDirection: 'column', gap: 12, pointerEvents: 'none'}}>
      {beats.map((beat, i) => {
        const active = progress(local, i * cycle + (scene.id === 'H09' ? 55 : 2), Math.min(15, cycle * .23));
        const subdued = i < beats.length - 1 ? 1 - progress(local, (i + 1) * cycle + 3, 15) * .52 : 1;
        return (
          <div key={beat.stamp} style={{display: 'flex', alignItems: 'center', gap: 18, padding: '12px 18px', borderLeft: `2px solid ${accent}`, background: 'rgba(8,13,17,.46)', opacity: active * subdued, transform: `translateX(${(1 - active) * 38}px)`, boxShadow: '0 2px 18px rgba(0,0,0,.14)'}}>
            <span style={{fontFamily: '"Songti SC", serif', fontSize: 26, fontWeight: 600, color: light, whiteSpace: 'nowrap'}}>{beat.stamp}</span>
            <span style={{fontFamily: '"PingFang SC", sans-serif', fontSize: 20, color: '#e2d8c5', whiteSpace: 'nowrap'}}>{beat.detail}</span>
          </div>
        );
      })}
    </div>
  );
};

const InkRoutes: React.FC<{local: number; duration: number; accent: string; branch: boolean}> = ({local, duration, accent, branch}) => {
  const p = progress(local, 8, Math.max(28, duration * .65));
  return (
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <path d="M1080 759 C1250 744 1285 571 1418 548 S1682 486 1790 342" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} fill="none" stroke={accent} strokeWidth="2" opacity=".68"/>
      {branch && <path d="M1418 548 C1514 601 1623 651 1810 681" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress(local, duration * .28, Math.max(20, duration * .42))} fill="none" stroke={accent} strokeWidth="1.5" opacity=".5"/>}
      <circle cx="1080" cy="759" r="4.5" fill={accent} opacity={p}/>
      <circle cx="1790" cy="342" r="4.5" fill={accent} opacity={p}/>
      {branch && <circle cx="1810" cy="681" r="4" fill={accent} opacity={progress(local, duration * .6, 20)}/>}
    </svg>
  );
};

// 海、海峡、长江仅共享抽象水纹语言；不使用同一条带端点的路线，避免暗示地理连通。
const WaterRipples: React.FC<{local: number; duration: number; accent: string}> = ({local, duration, accent}) => {
  const p = progress(local, 2, Math.min(45, duration * .36));
  return (
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${970 + i * 52} ${653 + i * 35} C${1160 + i * 28} ${600 + i * 37} ${1350 + i * 19} ${708 + i * 28} ${1570 + i * 34} ${648 + i * 31} S1820 ${627 + i * 24} 1980 ${677 + i * 29}`} fill="none" stroke={accent} strokeWidth={i === 0 ? 2.4 : 1.15} opacity={p * (.3 - i * .045)}/>)}
    </svg>
  );
};

const MechanicalLines: React.FC<{local: number; duration: number; accent: string}> = ({local, duration, accent}) => {
  const p = progress(local, 3, Math.min(35, duration * .4));
  const angle = local * .22;
  return (
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <g opacity={p * .35} transform={`rotate(${angle} 1550 520)`}>
        <circle cx="1550" cy="520" r="191" fill="none" stroke={accent} strokeWidth="2" strokeDasharray="25 16"/>
        <circle cx="1550" cy="520" r="101" fill="none" stroke={accent} strokeWidth="3"/>
        <circle cx="1550" cy="520" r="19" fill={accent}/>
        {Array.from({length: 8}, (_, i) => {
          const theta = Math.PI * i / 4;
          return <path key={i} d={`M${1550 + Math.cos(theta) * 104} ${520 + Math.sin(theta) * 104}L${1550 + Math.cos(theta) * 188} ${520 + Math.sin(theta) * 188}`} stroke={accent} strokeWidth="8"/>;
        })}
      </g>
    </svg>
  );
};

const WarTracks: React.FC<{local: number; duration: number; accent: string}> = ({local, duration, accent}) => {
  const p = progress(local, 0, Math.min(26, duration * .3));
  return (
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <g opacity={p * .38}>
        <path d="M1150 1060L1475 260M1890 1060L1475 260" fill="none" stroke={accent} strokeWidth="2.4"/>
        {Array.from({length: 8}, (_, i) => {
          const y = 410 + i * i * 9;
          const ratio = (y - 260) / 800;
          return <path key={i} d={`M${1475 - ratio * 325} ${y}H${1475 + ratio * 415}`} stroke={accent} strokeWidth={1 + ratio * 3}/>;
        })}
      </g>
    </svg>
  );
};

export const HistoricalMotifs: React.FC<{scene: HistoryScene; local: number; light: string; accent: string}> = ({scene, local, light, accent}) => {
  const kind = scene.transition;
  const water = /water|sea|sail|harbor|strait|river|ship|cart-wheel/.test(kind);
  const route = /route|map-ember|markers|line-advance/.test(kind);
  const mechanical = /gear|steam/.test(kind);
  const rail = /rail/.test(kind);
  return (
    <>
      {water && <WaterRipples local={local} duration={scene.durationFrames} accent={accent}/>}
      {route && <InkRoutes local={local} duration={scene.durationFrames} accent={accent} branch={/split|diverge|three/.test(kind)}/>}
      {mechanical && <MechanicalLines local={local} duration={scene.durationFrames} accent={accent}/>}
      {rail && <WarTracks local={local} duration={scene.durationFrames} accent={accent}/>}
      <MicroBeatCard scene={scene} local={local} light={light} accent={accent}/>
      {scene.id === 'H28' && <FlagOfChina local={local}/>}
    </>
  );
};
