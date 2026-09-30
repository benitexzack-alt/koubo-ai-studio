import React from 'react';
import type {HistoryScene} from '../timeline';
import {beatFrames, downbeatFrames} from '../cues';

type EarlyStoryMotionProps = {
  scene: HistoryScene;
  local: number;
  accent: string;
  light: string;
  beat: number;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => {
  const p = clamp(value);
  return p * p * (3 - 2 * p);
};
const phase = (frame: number, start: number, length: number) => ease((frame - start) / Math.max(1, length));
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const PAPER = '#d9c6a3';
const DARK = '#182e31';
const RED = '#86513d';

const musicCue = (scene: HistoryScene, fraction: number) => {
  const end = scene.startFrame + scene.durationFrames;
  const measuredDownbeats = downbeatFrames.filter(frame => frame >= scene.startFrame && frame < end);
  const candidates = measuredDownbeats.length ? measuredDownbeats : beatFrames.filter(frame => frame >= scene.startFrame && frame < end);
  const target = scene.startFrame + scene.durationFrames * fraction;
  const cue = candidates.reduce((best, frame) => Math.abs(frame - target) < Math.abs(best - target) ? frame : best, candidates[0] ?? scene.startFrame);
  return cue - scene.startFrame;
};

const wheelPoints = (r: number) => Array.from({length: 64}, (_, i) => {
  const radius = i % 4 === 0 || i % 4 === 3 ? r : r * .89;
  const angle = i * Math.PI / 32;
  return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
}).join(' ');

const Gear: React.FC<{x: number; y: number; r: number; angle: number; color: string; paper: string; ids: string}> = ({x, y, r, angle, color, paper, ids}) => (
  <g transform={`translate(${x} ${y}) rotate(${angle})`} filter={`url(#${ids}-shadow)`}>
    <polygon points={wheelPoints(r)} fill={color} stroke={paper} strokeWidth="2.5"/>
    <circle r={r * .67} fill={DARK} stroke={paper} strokeWidth={r * .035}/>
    {[0, 1, 2, 3, 4, 5].map(i => <path key={i} transform={`rotate(${i * 60})`} d={`M${r * .17} 0H${r * .66}`} stroke={color} strokeWidth={r * .16}/>) }
    <circle r={r * .19} fill={paper} stroke={color} strokeWidth={r * .065}/>
    <circle r={r * .055} fill={DARK}/>
    <polygon points={wheelPoints(r)} fill={`url(#${ids}-fibers)`} opacity=".4"/>
  </g>
);

const Wheel: React.FC<{r: number; ids: string; broken?: boolean}> = ({r, ids, broken = false}) => (
  <g filter={`url(#${ids}-shadow)`}>
    <path d={broken ? `M${-r * .97} ${-r * .23}A${r} ${r} 0 1 0 ${r * .66} ${-r * .75}` : `M${r} 0A${r} ${r} 0 1 1 ${-r} 0A${r} ${r} 0 1 1 ${r} 0`} fill="none" stroke={PAPER} strokeWidth="18"/>
    <path d={broken ? `M${-r * .96} ${-r * .22}A${r} ${r} 0 1 0 ${r * .65} ${-r * .74}` : `M${r} 0A${r} ${r} 0 1 1 ${-r} 0A${r} ${r} 0 1 1 ${r} 0`} fill="none" stroke="#8a7150" strokeWidth="5"/>
    {[0, 1, 2, 3, 4, 5, 6, 7].filter(i => !broken || i > 1).map(i => <path key={i} transform={`rotate(${i * 45})`} d={`M0 0L${r - 11} 0`} stroke={PAPER} strokeWidth="11"/>) }
    <circle r="25" fill="#876647" stroke={PAPER} strokeWidth="5"/>
    <circle r="7" fill={DARK}/>
  </g>
);

const Water: React.FC<{local: number; beat: number; color: string; opacity?: number}> = ({local, beat, color, opacity = 1}) => (
  <g opacity={opacity}>
    {[0, 1, 2, 3].map(i => {
      const x = Math.sin(local * .024 + i * .9) * (9 + beat * 3);
      const y = 646 + i * 28;
      return <g key={i} transform={`translate(${x} 0)`}>
        <path d={`M980 ${y + 16}C1100 ${y - 32} 1200 ${y + 48} 1340 ${y + 7}S1600 ${y - 24} 1790 ${y + 13}L1790 ${y + 25}C1630 ${y - 10} 1450 ${y + 36} 1320 ${y + 22}S1100 ${y - 5} 980 ${y + 30}Z`} fill={color} opacity={.11 - i * .014}/>
        <path d={`M990 ${y + 15}C1110 ${y - 20} 1200 ${y + 38} 1340 ${y + 7}S1600 ${y - 24} 1780 ${y + 13}`} fill="none" stroke={color} strokeWidth={i === 0 ? 3 : 1.6} opacity={.35 - i * .055}/>
      </g>;
    })}
  </g>
);

const Boat: React.FC<{local: number; sail: number; ids: string; iron?: boolean; accent: string}> = ({local, sail, ids, iron = false, accent}) => {
  const billow = Math.sin(local * .04) * 7;
  return <g filter={`url(#${ids}-shadow)`}>
    <path d="M-160 2Q-12 21 155-7L115 44Q-2 72-122 43Z" fill={iron ? '#41575a' : '#836b4b'} stroke={PAPER} strokeWidth="3"/>
    <path d="M-139 10Q-2 30 135 5L115 26Q-15 46-127 29Z" fill={`url(#${ids}-paper)`} opacity={iron ? .28 : .72}/>
    <path d="M-146 1Q0 15 145-9" fill="none" stroke={accent} strokeWidth="6"/>
    {iron ? <g>
      <path d="M-80 0L-69-48H71L91-3Z" fill="#3b5051" stroke={PAPER} strokeWidth="2.5"/>
      <path d="M-55-49L-52-94H-21L-18-49M26-49L29-89H55L58-49" fill="#293d40" stroke={PAPER} strokeWidth="2"/>
      <path d="M-110-5L-117-15H-172M96-6L120-20H175" fill="none" stroke={PAPER} strokeWidth="6"/>
      <path d="M4-45V-139M-16-116H31" fill="none" stroke={PAPER} strokeWidth="3"/>
    </g> : <g>
      <path d="M-20 8V-223M72 9V-151" stroke="#bea883" strokeWidth="7"/>
      <g transform={`translate(-20 -211) scale(${Math.max(.025, sail)} 1)`}>
        <path d={`M7 0Q${120 + billow} 38 117 181L7 191Z`} fill={`url(#${ids}-paper)`} stroke="#947959" strokeWidth="2"/>
        {[42, 78, 118, 158].map(y => <path key={y} d={`M9 ${y}Q67 ${y - 6} ${y < 78 ? 108 : 118} ${y - 13}`} fill="none" stroke="#a88c64" strokeWidth="3"/>) }
        <path d="M10 6L10 185" stroke="#eedcba" strokeWidth="3" opacity=".75"/>
        <path d={`M7 0Q${120 + billow} 38 117 181L7 191Z`} fill={`url(#${ids}-fibers)`} opacity=".6"/>
      </g>
      <g transform={`translate(72 -146) scale(${Math.max(.025, sail)} 1)`}>
        <path d="M5 0Q70 12 66 128L5 143Z" fill={PAPER} stroke="#947959" strokeWidth="2"/>
        {[34, 70, 106].map(y => <path key={y} d={`M7 ${y}L66 ${y - 8}`} stroke="#a88c64" strokeWidth="2"/>) }
      </g>
      <path d="M-129 5L-17-221L144-10M-111 29L70-144L133 19" fill="none" stroke={PAPER} strokeOpacity=".5" strokeWidth="1.5"/>
    </g>}
    <path d="M-160 2Q-12 21 155-7L115 44Q-2 72-122 43Z" fill={`url(#${ids}-fibers)`} opacity=".5"/>
  </g>;
};

const Sheet: React.FC<{ids: string; width?: number; height?: number; lines?: boolean}> = ({ids, width = 340, height = 230, lines = true}) => (
  <g filter={`url(#${ids}-shadow)`}>
    <path d={`M0 0L${width - 13} -8L${width + 7} ${height - 20}L${width - 12} ${height + 9}L-5 ${height - 4}Z`} fill={`url(#${ids}-paper)`} stroke="#8b775c" strokeWidth="2"/>
    <path d={`M${width - 13} -8L${width - 21} 17L${width + 7} ${height - 20}`} fill="none" stroke="#efe0c1" strokeWidth="3" opacity=".8"/>
    {lines && Array.from({length: 8}, (_, i) => <g key={i} opacity={.45 - i * .018}>
      <path d={`M${30 + i % 3 * 10} ${33 + i * 21}H${width - 31 - i % 4 * 17}`} stroke="#45403a" strokeWidth="2.5"/>
      <path d={`M${45 + i % 4 * 6} ${38 + i * 21}H${width - 66 - i % 3 * 20}`} stroke="#45403a" strokeWidth="1"/>
    </g>)}
    <path d={`M0 0L${width - 13} -8L${width + 7} ${height - 20}L${width - 12} ${height + 9}L-5 ${height - 4}Z`} fill={`url(#${ids}-fibers)`} opacity=".75"/>
  </g>
);

const Gate: React.FC<{close: number; ids: string; accent: string; light: string}> = ({close, ids, accent, light}) => (
  <g transform="translate(1450 660)" filter={`url(#${ids}-shadow)`}>
    <path d="M-298-191H-142V42H-310ZM142-191H298L310 42H142Z" fill="#4b5c54" stroke={light} strokeWidth="2"/>
    <path d="M-251-198L-214-280H213L251-198Z" fill="#3b4947" stroke={light} strokeWidth="3"/>
    <path d="M-292-206Q-237-196-224-233H226Q242-196 294-207L244-186H-246Z" fill={accent}/>
    <path d="M-254-285Q-193-271-171-303H172Q194-271 257-285L208-263H-208Z" fill={light} opacity=".75"/>
    <path d="M-143 42V-133Q0-236 143-133V42" fill={DARK} stroke={light} strokeWidth="3"/>
    <g transform={`translate(${-134 * (1 - close)} 0)`}>
      <path d="M-135 38V-128Q-80-170-4-177L-4 38Z" fill="#80654c" stroke={light} strokeWidth="3"/>
      {[0, 1, 2, 3].map(i => <path key={i} d={`M${-114 + i * 27}-130V33`} stroke="#3a332c" strokeWidth="3"/>) }
      <path d="M-133-61H-6M-133 4H-6" stroke={accent} strokeWidth="8"/>
    </g>
    <g transform={`translate(${134 * (1 - close)} 0)`}>
      <path d="M4 38V-177Q80-170 135-128V38Z" fill="#71533e" stroke={light} strokeWidth="3"/>
      {[0, 1, 2, 3].map(i => <path key={i} d={`M${24 + i * 27}-130V33`} stroke="#3a332c" strokeWidth="3"/>) }
      <path d="M6-61H133M6 4H133" stroke={accent} strokeWidth="8"/>
    </g>
    {Array.from({length: 6}, (_, i) => <path key={i} d={`M-300 ${-171 + i * 34}H-146M146 ${-171 + i * 34}H300`} stroke={light} strokeWidth="1.4" opacity=".28"/>) }
    <path d="M-312 45H312" stroke={light} strokeWidth="7"/>
  </g>
);

const Smoke: React.FC<{local: number; start: number; ids: string; opacity: number}> = ({local, start, ids, opacity}) => (
  <g opacity={opacity} filter={`url(#${ids}-soft)`}>
    {[0, 1, 2, 3, 4].map(i => {
      const drift = Math.max(0, local - start) * (.15 + i * .018);
      const x = 1260 + i * 79 + Math.sin(local * .024 + i) * 9;
      return <path key={i} d={`M${x} ${656 - drift}C${x - 55} ${596 - drift} ${x + 89} ${553 - drift} ${x + 15} ${486 - drift}S${x + 10} ${407 - drift} ${x + 34} ${365 - drift}`} fill="none" stroke="#c2d1c5" strokeWidth={32 - i * 3} strokeLinecap="round" opacity={.18 + i % 2 * .09}/>;
    })}
  </g>
);

/** A frame-driven paper theatre layer; all geography remains abstract. */
export const EarlyStoryMotion: React.FC<EarlyStoryMotionProps> = ({scene, local, accent, light, beat}) => {
  if (!/^H(0[1-9]|1[0-2])$/.test(scene.id)) return null;
  const ids = `early-${scene.id}`;
  const duration = Math.max(1, scene.durationFrames);
  const p = clamp(local / duration);
  const pulse = clamp(beat);
  const entrance = phase(local, 0, Math.min(25, duration * .2));
  const ocean = '#82a7a6';
  const cueA = musicCue(scene, .2);
  const cueB = musicCue(scene, .45);
  const cueC = musicCue(scene, .7);
  const tear = phase(local, cueA, Math.max(18, cueC - cueA));
  const breakWheel = phase(local, cueA, 23);

  return <svg width="1920" height="1080" viewBox="0 0 1920 1080" aria-label={`${scene.title}的连续纸艺意象`} style={{position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden'}}>
    <defs>
      <linearGradient id={`${ids}-paper`} x1="0" y1="0" x2=".9" y2="1">
        <stop offset="0" stopColor="#eee0c5"/>
        <stop offset=".45" stopColor={light}/>
        <stop offset="1" stopColor="#a8916b"/>
      </linearGradient>
      <pattern id={`${ids}-fibers`} width="52" height="45" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
        <path d="M2 9L18 7M29 23L49 20M12 39L29 40M35 4L43 5" stroke="#735e45" strokeWidth=".65" opacity=".38"/>
        <path d="M7 16L31 17M30 33L44 34M1 30L9 31" stroke="#fff3d9" strokeWidth=".75" opacity=".42"/>
      </pattern>
      <filter id={`${ids}-shadow`} x="-40%" y="-40%" width="180%" height="200%">
        <feDropShadow dx="0" dy="9" stdDeviation="9" floodColor="#061113" floodOpacity=".62"/>
      </filter>
      <filter id={`${ids}-soft`} x="-30%" y="-40%" width="180%" height="200%">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
    </defs>
    <g opacity={entrance * .91}>
      {scene.id === 'H01' && <g>
        <g transform={`translate(${1395 + breakWheel * 48} ${592 + breakWheel * 38}) rotate(${mix(local * .17, 32 + (local - cueA) * .009, breakWheel)})`}>
          <Wheel r={139} ids={ids} broken={local >= cueA}/>
        </g>
        <g transform={`translate(${1480 + breakWheel * 98} ${498 + breakWheel * 90}) rotate(${breakWheel * 110})`} opacity={breakWheel}>
          <path d="M-38-46Q43-63 73 6L53 19Q21-23-35-25Z" fill={PAPER} stroke="#8a7150" strokeWidth="3" filter={`url(#${ids}-shadow)`}/>
          <path d="M-13 7L-3 83" stroke={PAPER} strokeWidth="10"/>
        </g>
        <g transform={`translate(1608 520) rotate(${-7 + breakWheel * 17 + Math.sin(local * .018) * 1.5})`}>
          <path d="M0-222V144" stroke="#c3af8c" strokeWidth="7"/>
          <path d={`M4-209L${126 - breakWheel * 44} ${-190 + Math.sin(local * .034) * 6}L70-147L${116 - breakWheel * 50}-105L4-129Z`} fill={RED} stroke={PAPER} strokeWidth="1.5"/>
          <path d="M5-209L65-195L48-161L74-130L4-129Z" fill={`url(#${ids}-fibers)`}/>
        </g>
        <path d="M1160 740Q1440 695 1770 728" fill="none" stroke={accent} strokeWidth="5" opacity=".3"/>
      </g>}

      {scene.id === 'H02' && <g transform={`translate(0 ${mix(35, 0, phase(local, 0, 65))})`}>
        <Gate close={phase(local, cueA, Math.max(32, cueB - cueA))} ids={ids} accent={accent} light={light}/>
        <g opacity={phase(local, cueB, 18)} transform={`translate(1450 ${668 + pulse * .8})`}>
          <path d="M-131-48H131" stroke={light} strokeWidth="13" filter={`url(#${ids}-shadow)`}/>
          <path d="M-117-52H119" stroke="#987e56" strokeWidth="3"/>
        </g>
      </g>}

      {scene.id === 'H03' && <g>
        <Water local={local} beat={pulse} color={ocean}/>
        <g transform={`translate(${mix(1172, 1570, ease(p))} ${628 + Math.sin(local * .035) * 4}) rotate(${Math.sin(local * .024) * 1.1})`}>
          <Boat local={local} sail={phase(local, cueA, 36)} ids={ids} accent={accent}/>
        </g>
        <path d={`M${mix(1080, 1430, ease(p))} 687Q${mix(1210, 1560, ease(p))} 706 ${mix(1330, 1690, ease(p))} 687`} stroke={light} strokeWidth="2" fill="none" opacity=".38"/>
      </g>}

      {scene.id === 'H04' && <g>
        <g transform={`translate(1390 425) rotate(-6)`}>
          <g transform={`scale(${mix(.04, 1, phase(local, 0, 75))} 1)`}><Sheet ids={ids} width={345} height={240}/></g>
          <path d="M2-9V258" stroke="#907752" strokeWidth="9"/>
        </g>
        <Gear x={1166} y={562} r={114} angle={local * .35} color="#846c4b" paper={light} ids={ids}/>
        <Gear x={1305} y={584} r={61} angle={-local * .65} color="#aa8b5b" paper={light} ids={ids}/>
        <g transform={`translate(1422 ${mix(345, 460, phase(local, cueB, 26)) - phase(local, cueC, 30) * 42 + Math.sin(local * .015) * 2})`} filter={`url(#${ids}-shadow)`}>
          <path d="M-18-9L223-25L246 76L2 94Z" fill="#6b5942" stroke={light} strokeWidth="3"/>
          <path d="M2 5L207-10L222 59L20 74Z" fill="#302f29"/>
          {Array.from({length: 6}, (_, i) => <path key={i} d={`M${24 + i * 31} 6L${41 + i * 31} 65`} stroke={PAPER} strokeWidth="7" opacity=".3"/>) }
          <path d="M26 86L233 65" stroke={accent} strokeWidth="7"/>
        </g>
        <path d="M1220 729Q1440 746 1750 719" fill="none" stroke={accent} strokeWidth="3" opacity=".22"/>
      </g>}

      {(scene.id === 'H05' || scene.id === 'H06') && <g>
        <g transform={`translate(${1310 - tear * (scene.id === 'H05' ? 12 : 94)} 350) rotate(${-7 - tear * 13})`}>
          <path d="M-120 15L156-9L187 48L152 103L188 149L164 190L192 242L165 307L-114 338Z" fill={`url(#${ids}-paper)`} stroke="#9c8059" strokeWidth="2" filter={`url(#${ids}-shadow)`}/>
          <path d="M-120 15L156-9L187 48L152 103L188 149L164 190L192 242L165 307L-114 338Z" fill={`url(#${ids}-fibers)`}/>
          {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M-70 ${70 + i * 44}L131 ${45 + i * 44}`} stroke="#645746" strokeWidth="2" opacity=".4"/>) }
        </g>
        <g transform={`translate(${1440 + tear * (scene.id === 'H05' ? 12 : 54)} 360) rotate(${8 + tear * 8})`}>
          <path d="M9-15L300 8L290 326L-13 310L14 245L-14 193L10 152L-26 106L9 51Z" fill={`url(#${ids}-paper)`} stroke="#9c8059" strokeWidth="2" filter={`url(#${ids}-shadow)`}/>
          <path d="M9-15L300 8L290 326L-13 310L14 245L-14 193L10 152L-26 106L9 51Z" fill={`url(#${ids}-fibers)`}/>
          <path d="M34 46L257 66M24 115L263 135M35 191L253 211M22 271L256 291" stroke="#645746" strokeWidth="2" opacity=".4"/>
        </g>
        <path d="M1457 356L1490 408L1451 464L1487 510L1461 552L1494 603L1467 669" fill="none" stroke={light} strokeWidth={2 + pulse * 1.4} opacity={.25 + tear * .4}/>
      </g>}

      {scene.id === 'H07' && <g>
        <Water local={local} beat={pulse} color={ocean}/>
        <g transform={`translate(${mix(1180, 1510, phase(local, cueA, Math.max(35, cueC - cueA)))} ${631 + Math.sin(local * .03) * 3}) scale(.75)`} opacity={1 - phase(local, cueC, 40) * .7}>
          <Boat local={local} sail={.92} ids={ids} accent={accent}/>
        </g>
        {scene.year.split('/').map((year, i) => {
          const up = phase(local, i === 0 ? cueA : cueC, 18);
          return <g key={year} transform={`translate(${1210 + i * 420} ${378 + (1 - up) * 22}) rotate(${i ? 4 : -5})`} opacity={up}>
            <path d="M-72-39L85-48L91 29L-82 42Z" fill={`url(#${ids}-paper)`} stroke="#a58b66" strokeWidth="2" filter={`url(#${ids}-shadow)`}/>
            <path d="M-72-39L85-48L91 29L-82 42Z" fill={`url(#${ids}-fibers)`}/>
            <text textAnchor="middle" y="13" fill="#293a39" fontFamily="Songti SC, serif" fontSize="45" fontWeight="700">{year.trim()}</text>
            <path d="M-29 49L0 62L29 47" fill="none" stroke={accent} strokeWidth="3"/>
          </g>;
        })}
      </g>}

      {scene.id === 'H08' && <g>
        <Water local={local} beat={pulse} color={ocean} opacity={.7}/>
        <g transform={`translate(${mix(1450, 1530, phase(local, 0, duration * .45))} ${617 + Math.sin(local * .025) * 2})`}>
          <Boat local={local} sail={1 - phase(local, cueB, Math.max(32, cueC - cueB)) * .88} ids={ids} accent={accent}/>
        </g>
        <g transform="translate(1038 666)" filter={`url(#${ids}-shadow)`}>
          <path d="M-15 13L205-7V23L-15 41Z" fill="#6d6550" stroke={light} strokeWidth="2"/>
          {[0, 1, 2].map(i => {
            const load = phase(local, musicCue(scene, .2 + i * .13), 40);
            return <g key={i} transform={`translate(${i * 57 + load * 90} ${-18 - Math.sin(load * Math.PI) * 37})`} opacity={1 - load * .35}>
              <path d="M0-37L42-43L53 3L10 10Z" fill={i % 2 ? '#8b7856' : '#a39473'} stroke={PAPER} strokeWidth="2"/>
              <path d="M11-38L22 8M31-41L41 4M5-16L46-23" stroke="#4b4d3c" strokeWidth="3"/>
            </g>;
          })}
        </g>
      </g>}

      {scene.id === 'H09' && <g>
        <g opacity={1 - phase(local, cueB, Math.max(24, cueC - cueB))}>
          <path d="M1060 661L1236 627L1474 650L1302 704Z" fill="#446461" stroke={light} strokeWidth="2"/>
          <path d="M1060 661L1302 704V727L1060 686ZM1302 704L1474 650V674L1302 727Z" fill="#294441" stroke={accent} strokeWidth="2"/>
          <path d="M1110 658L1274 684L1404 657" stroke={ocean} strokeWidth="5" opacity=".5"/>
          <Smoke local={local} start={0} ids={ids} opacity={1 - phase(local, cueA, Math.max(35, cueB - cueA))}/>
        </g>
        <g transform={`translate(${mix(1730, 1600, phase(local, cueB, 40))} 638) scale(.65)`} opacity={phase(local, cueB, 24) * (1 - phase(local, cueC, 35))}>
          <Boat local={local} sail={1} ids={ids} accent={accent} iron/>
        </g>
        <g transform={`translate(1360 ${mix(688, 469, phase(local, cueC, 37))}) rotate(-5)`} opacity={phase(local, cueC, 24)}>
          <Sheet ids={ids} width={360} height={214}/>
          <path d="M278 159L310 177L295 200L266 182Z" fill={RED} opacity=".7"/>
        </g>
      </g>}

      {scene.id === 'H10' && <g>
        <g transform="translate(1050 365) rotate(-2)">
          <path d="M0 32L651 0L695 324L30 349Z" fill="#c7b896" opacity=".55" filter={`url(#${ids}-shadow)`}/>
          <path d="M0 32L651 0L695 324L30 349Z" fill={`url(#${ids}-fibers)`} opacity=".7"/>
          <path d={`M305-3L${310 + tear * 11} 49L${272 - tear * 14} 96L${312 + tear * 13} 151L${280 - tear * 17} 208L${333 + tear * 15} 263L320 341`} fill="none" stroke={DARK} strokeWidth={3 + tear * 22} strokeLinecap="round"/>
          <path d="M305-3L310 49L272 96L312 151L280 208L333 263L320 341" fill="none" stroke={RED} strokeWidth="5" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - tear} opacity={.68 + pulse * .12}/>
          <path d="M72 308Q113 214 191 185M400 296Q492 202 620 228" fill="none" stroke="#647969" strokeWidth="2" opacity=".4"/>
        </g>
        <g transform={`translate(${1325 + tear * 32} ${532 + tear * 11})`} opacity={tear * .7}>
          <path d="M0 0L18-14L42 22L15 44Z" fill={PAPER} filter={`url(#${ids}-shadow)`}/>
          <path d="M84 111L112 104L127 132L102 145Z" fill={PAPER}/>
        </g>
      </g>}

      {scene.id === 'H11' && <g>
        <path d="M1075 684H1762V715H1075Z" fill="#34494a" stroke={light} strokeWidth="2" filter={`url(#${ids}-shadow)`}/>
        <path d="M1204 436L1580 441Q1656 437 1656 519Q1656 591 1574 596L1202 614" fill="none" stroke="#795e43" strokeWidth="17"/>
        <path d="M1204 435L1580 441Q1656 437 1656 519Q1656 591 1574 596L1202 614" fill="none" stroke={light} strokeWidth="2" strokeDasharray="18 23" strokeDashoffset={-local * 2.1} opacity=".6"/>
        <Gear x={1203} y={525} r={125} angle={local * .8} color="#978461" paper={light} ids={ids}/>
        <Gear x={1398} y={604} r={84} angle={-local * 1.19} color="#7e7258" paper={light} ids={ids}/>
        <Gear x={1586} y={517} r={79} angle={local * 1.265} color="#958462" paper={light} ids={ids}/>
        <g transform={`translate(1720 ${490 + Math.sin(local * .055) * 51})`}>
          <path d="M-34-13H34V64H-34Z" fill="#8d9b8d" stroke={light} strokeWidth="3" filter={`url(#${ids}-shadow)`}/>
          <path d="M0 63V151" stroke={light} strokeWidth="8"/>
          <path d="M-44 151H45" stroke={accent} strokeWidth="11"/>
        </g>
        <path d={`M1586 517L${1718} ${495 + Math.sin(local * .055) * 51}`} stroke={PAPER} strokeWidth="9"/>
      </g>}

      {scene.id === 'H12' && <g>
        <Water local={local} beat={pulse} color={ocean} opacity={1 - phase(local, duration * .6, duration * .22)}/>
        <g transform={`translate(${mix(1380, 1625, phase(local, cueA, Math.max(35, cueC - cueA)))} ${633 + phase(local, cueA, Math.max(35, cueC - cueA)) * 30}) rotate(${phase(local, cueB, 35) * 7}) scale(${1 - phase(local, cueB, 35) * .2})`} opacity={1 - phase(local, cueB, Math.max(32, cueC - cueB))}>
          <Boat local={local} sail={1} ids={ids} accent={accent} iron/>
        </g>
        <g transform={`translate(1390 416) rotate(${-9 + phase(local, cueB, 42) * 13})`} opacity={phase(local, cueB, 24)}>
          <g transform={`scale(${mix(1, .52, phase(local, cueC, 35))} 1)`}><Sheet ids={ids} width={385} height={260}/></g>
          <path d="M197-3L190 267" stroke="#7b654b" strokeWidth="3" opacity={phase(local, cueC, 25) * .75}/>
          <path d="M158 201L199 190L204 223L165 231Z" fill={RED} opacity=".72"/>
        </g>
      </g>}
    </g>
  </svg>;
};
