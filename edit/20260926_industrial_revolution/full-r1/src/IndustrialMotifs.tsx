import React from 'react';

export type IndustrialMotifsProps = {frame: number; fps: number; mode: 'electricity' | 'assembly'};
type Point = readonly [number, number];
const TAU = Math.PI * 2;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

const travel = (points: readonly Point[], amount: number): Point => {
  const lengths = points.slice(1).map((point, i) => Math.hypot(point[0] - points[i][0], point[1] - points[i][1]));
  let distance = clamp(amount) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const t = distance / Math.max(0.001, lengths[i]);
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
    }
    distance -= lengths[i];
  }
  return points[0];
};

const Wire: React.FC<{points: readonly Point[]; time: number; start: number}> = ({points, time, start}) => {
  const energize = smooth(start, start + 1, time);
  const p = travel(points, ((Math.max(0, time - start) * 0.47) % 1));
  const path = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${point[0]} ${point[1]}`).join(' ');
  return <g>
    <path d={path} fill="none" stroke="#06121a" strokeWidth={12} strokeLinejoin="round" />
    <path d={path} fill="none" stroke="#6a6550" strokeWidth={4} strokeLinejoin="round" />
    <path d={path} fill="none" stroke="#cf985e" strokeWidth={2} strokeLinejoin="round" opacity={energize * 0.9} />
    <g opacity={energize}>
      <circle cx={p[0]} cy={p[1]} r={22} fill="url(#motif-halo)" />
      <circle cx={p[0]} cy={p[1]} r={4} fill="#e2c99b" />
    </g>
  </g>;
};

const FactoryNode: React.FC<{x: number; y: number; scale: number; time: number; start: number}> = ({x, y, scale, time, start}) => {
  const power = smooth(start, start + 1, time);
  const rotation = Math.max(0, time - start) * 104;
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx={8} cy={98} rx={125} ry={23} fill="url(#motif-shadow)" />
    <path d="M-105 48 L58 21 L117 56 L-44 87Z" fill="#263b40" stroke="#7d7b62" strokeWidth={0.8} />
    <path d="M-105 48 L-44 87 V98 L-105 61Z M-44 87 L117 56 V69 L-44 98Z" fill="#101e26" />
    <path d="M-84 -22 L60 -49 V36 L-84 62Z" fill="url(#motif-building)" stroke="#798076" strokeWidth={1} />
    <path d="M60 -49 L97 -23 V61 L60 36Z" fill="#142831" stroke="#526865" strokeWidth={1} />
    <path d="M-84 -22 L-84 -51 L-40 -27 L-40 -61 L5 -35 L5 -70 L60 -49Z" fill="url(#motif-brass)" stroke="#b5a07c" strokeWidth={1} />
    <path d="M60 -49 L97 -23 L45 -44 L5 -70 M-40 -61 L1 -34 M-84 -51 L-43 -25" fill="none" stroke="#8d8c74" strokeWidth={1} />
    <path d="M43 -45 V-112 L61 -115 V-48Z" fill="url(#motif-steel)" stroke="#9c9376" strokeWidth={1} />
    <path d="M61 -115 L71 -109 V-44 L61 -48Z" fill="#14242b" />
    <path d="M-111 -8 H-96 L-84 -13" fill="none" stroke="#b09667" strokeWidth={3} />
    <circle cx={-111} cy={-8} r={5} fill="#142c37" stroke="#d2b37b" strokeWidth={1.5} />
    <circle cx={-111} cy={-8} r={2.5} fill="#e6c891" opacity={power} />
    {Array.from({length: 4}, (_, column) => Array.from({length: 2}, (_, row) => {
      const wx = -70 + column * 31;
      const wy = 3 - column * 5.7 + row * 25;
      const lit = smooth(start + column * 0.11 + row * 0.1, start + 0.75 + column * 0.11, time);
      return <g key={`${column}-${row}`}>
        <path d={`M${wx} ${wy} l18 -3.4 v16 l-18 3.4Z`} fill="#06151e" stroke="#70857d" strokeWidth={0.8} />
        <path d={`M${wx + 2} ${wy + 2} l14 -2.6 v12 l-14 2.6Z`} fill="#e2b774" opacity={lit * 0.88} />
        <path d={`M${wx + 9} ${wy - 1.7} v16`} stroke="#273c40" strokeWidth={1.3} />
      </g>;
    }))}
    <g transform={`translate(96 41) rotate(${rotation})`} opacity={0.55 + power * 0.45}>
      <circle r={20} fill="#0c1d26" stroke="url(#motif-brass)" strokeWidth={5} />
      {[0, 60, 120].map((a) => <path key={a} d="M-17 0H17" transform={`rotate(${a})`} stroke="#a9a080" strokeWidth={3} />)}
      <circle r={5} fill="#c69d65" />
    </g>
    <ellipse cx={-9} cy={31} rx={91} ry={60} fill="url(#motif-halo)" opacity={power * 0.07} />
  </g>;
};

const Electricity: React.FC<{time: number}> = ({time}) => {
  const angle = time * 90;
  const starts = [0.75, 3.0, 5.5];
  const wires: readonly (readonly Point[])[] = [
    [[876, 415], [995, 415], [1040, 276], [1164, 276]],
    [[876, 435], [1060, 435], [1125, 402], [1457, 402]],
    [[876, 455], [984, 455], [1045, 608], [1204, 608]],
  ];
  return <g>
    <ellipse cx={1050} cy={471} rx={705} ry={356} fill="url(#motif-environment)" />
    {wires.map((points, i) => <Wire key={i} points={points} time={time} start={starts[i]} />)}
    <FactoryNode x={1275} y={284} scale={1.04} time={time} start={starts[0] + 1 / 0.47} />
    <FactoryNode x={1566} y={410} scale={1.03} time={time} start={starts[1] + 1 / 0.47} />
    <FactoryNode x={1319} y={610} scale={1.09} time={time} start={starts[2] + 1 / 0.47} />
    {/* A rotating machine supplies the three visible distribution branches. */}
    <g transform="translate(783 435)">
      <ellipse cx={17} cy={225} rx={211} ry={37} fill="url(#motif-shadow)" />
      <path d="M-150 189 L86 168 L181 196 L-75 227Z" fill="#3b4c4d" stroke="#8d8267" strokeWidth={1} />
      <path d="M-75 227 L181 196 V216 L-75 248Z" fill="#142630" />
      <path d="M-122 179 L-66 90 H53 L94 170Z" fill="url(#motif-cast)" stroke="#748381" strokeWidth={1.4} />
      <ellipse cx={23} cy={10} rx={153} ry={182} fill="#0e1d25" stroke="#637577" strokeWidth={22} />
      <ellipse cx={0} cy={0} rx={153} ry={182} fill="#081821" stroke="url(#motif-steel)" strokeWidth={18} />
      <ellipse cx={0} cy={0} rx={137} ry={165} fill="none" stroke="#bc9967" strokeWidth={2} />
      {[0, 90, 180, 270].map((a) => <g key={a} transform={`rotate(${a})`}>
        <path d="M-45 -163 Q0 -183 45 -163 L39 -107 Q0 -120 -39 -107Z" fill="url(#motif-brass)" stroke="#cdaf7d" strokeWidth={1} />
        {Array.from({length: 11}, (_, i) => <path key={i} d={`M${-35 + i * 7} -165 L${-30 + i * 6} -112`} stroke="#694c2f" strokeWidth={2.5} />)}
      </g>)}
      <g transform={`scale(.83 1) rotate(${angle})`}>
        <circle r={105} fill="url(#motif-cast)" stroke="#99a18b" strokeWidth={1.2} />
        {Array.from({length: 12}, (_, i) => <g key={i} transform={`rotate(${i * 30})`}>
          <path d="M-11 -99 H11 L14 -48 H-14Z" fill="url(#motif-brass)" stroke="#e0bd85" strokeWidth={0.6} />
          <path d="M-5 -94 V-52 M2 -95 V-51 M8 -95 V-53" stroke="#684b2f" strokeWidth={1.2} />
        </g>)}
        <circle r={44} fill="url(#motif-steel)" stroke="#c3b48b" strokeWidth={2} />
        <path d="M-27 -15 L28 12 M-24 16 L23 -19" stroke="#213944" strokeWidth={10} />
      </g>
      <ellipse cx={4} cy={0} rx={24} ry={29} fill="url(#motif-brass)" stroke="#cdb783" strokeWidth={1.2} />
      <path d="M4 -15 L91 -1 L91 18 L4 16Z" fill="url(#motif-steel)" stroke="#9caa9a" strokeWidth={1} />
      <ellipse cx={91} cy={8} rx={8} ry={10} fill="#1a3540" stroke="#a7ac8d" strokeWidth={2} />
      <path d="M80 -31 H104 V33 H80Z" fill="url(#motif-cast)" stroke="#a09a73" strokeWidth={1} />
      {[-20, 0, 20].map((y) => <g key={y}><circle cx={93} cy={y} r={5.5} fill="url(#motif-brass)" /><circle cx={93} cy={y} r={2.2} fill="#17313c" /></g>)}
      <path d="M-116 -159 C-175 -108 -174 105 -113 159" fill="none" stroke="#73b9bd" strokeWidth={1.2} opacity={0.3} />
      <path d="M-105 -166 C-178 -101 -176 99 -104 166" fill="none" stroke="#73b9bd" strokeWidth={0.8} opacity={0.16} />
      {Array.from({length: 8}, (_, i) => {
        const a = i * TAU / 8;
        return <circle key={i} cx={Math.cos(a) * 153} cy={Math.sin(a) * 182} r={5} fill="#c2a36d" stroke="#233943" strokeWidth={1.3} />;
      })}
    </g>
  </g>;
};

const CarWheel: React.FC<{x: number; y: number; spin: number; opacity: number; lift?: number}> = ({x, y, spin, opacity, lift = 0}) => (
  <g transform={`translate(${x} ${y - lift})`} opacity={opacity}>
    <ellipse cx={6} cy={-2} rx={23} ry={28} fill="#060f14" stroke="#415658" strokeWidth={4} />
    <g transform={`scale(.83 1) rotate(${spin})`}>
      <circle r={28} fill="#09131b" stroke="#9b8e6c" strokeWidth={3.4} />
      {Array.from({length: 10}, (_, i) => <path key={i} d="M0 -23 V23" transform={`rotate(${i * 18})`} stroke="#b49563" strokeWidth={1.2} />)}
      <circle r={8} fill="url(#motif-brass)" stroke="#d3b781" strokeWidth={1} />
    </g>
  </g>
);

const Chassis: React.FC<{x: number; y: number; time: number}> = ({x, y, time}) => {
  const axle = smooth(817, 895, x);
  const motor = smooth(1080, 1158, x);
  const body = smooth(1350, 1432, x);
  const spin = (x - 620) / 28 * 180 / Math.PI;
  return <g transform={`translate(${x} ${y})`}>
    <ellipse cx={4} cy={50} rx={143} ry={20} fill="url(#motif-shadow)" />
    <CarWheel x={-60} y={12} spin={spin} opacity={axle} lift={(1 - axle) * 50} />
    <CarWheel x={91} y={-5} spin={spin} opacity={axle} lift={(1 - axle) * 50} />
    <path d="M-110 13 L85 -10 L124 9 L-75 37Z" fill="url(#motif-steel)" stroke="#a69c78" strokeWidth={1.5} />
    <path d="M-110 13 V24 L-75 48 V37Z M-75 37 L124 9 V21 L-75 48Z" fill="#21343b" stroke="#5b736e" strokeWidth={0.7} />
    {Array.from({length: 6}, (_, i) => <path key={i} d={`M${-88 + i * 32} ${12 - i * 3.6} l31 17`} stroke="#172b34" strokeWidth={8} />)}
    <g opacity={axle} transform={`translate(0 ${(1 - axle) * -43})`}>
      <path d="M-79 14 L-50 37 M76 -4 L102 18" stroke="url(#motif-brass)" strokeWidth={9} />
      <path d="M-79 10 L-50 33 M76 -8 L102 14" stroke="#d2b47d" strokeWidth={1.5} />
    </g>
    <g opacity={motor} transform={`translate(0 ${(1 - motor) * -75})`}>
      <path d="M29 -32 L80 -39 L102 -22 L51 -13Z" fill="#899184" stroke="#cfad78" strokeWidth={1} />
      <path d="M29 -32 V3 L51 19 V-13Z" fill="#506065" />
      <path d="M51 -13 L102 -22 V9 L51 19Z" fill="url(#motif-cast)" stroke="#92a394" strokeWidth={1} />
      {Array.from({length: 5}, (_, i) => <path key={i} d={`M${36 + i * 9} -33 l18 13`} stroke="#233c47" strokeWidth={2} />)}
      <path d="M-43 5 L-42 -44 L-11 -49 L-9 -1 M-42 -44 L9 -34" fill="none" stroke="url(#motif-brass)" strokeWidth={4} />
      <ellipse cx={7} cy={-33} rx={13} ry={5} fill="none" stroke="#c1a26d" strokeWidth={3} transform="rotate(-25 7 -33)" />
    </g>
    <g opacity={body} transform={`translate(0 ${(1 - body) * -83})`}>
      <path d="M-93 -27 L-68 -49 L-6 -54 L15 -16 L48 -20 L53 -49 L95 -54 L115 -22 L116 7 L-75 36 L-98 13Z" fill="url(#motif-body)" stroke="#bdb184" strokeWidth={1.5} />
      <path d="M-93 -27 L-74 -40 L-16 -46 L-1 -17Z" fill="#152832" stroke="#8b9b90" strokeWidth={1} />
      <path d="M-65 -23 L-12 -29 L-9 17 L-65 24Z" fill="#16333e" stroke="#9c936e" strokeWidth={1} />
      <path d="M52 -49 L96 -54 L111 -30 L66 -23Z" fill="url(#motif-steel)" />
      <path d="M63 -19 L111 -27 V5 L65 14Z" fill="#273e46" stroke="#a2926c" strokeWidth={1} />
      {Array.from({length: 7}, (_, i) => <path key={i} d={`M${70 + i * 5} -17 V7`} stroke="#81907f" strokeWidth={1.1} />)}
      <path d="M-88 -27 L-84 -86 L-21 -93 L-6 -54 M-84 -86 L-29 -91" fill="none" stroke="#b4ac85" strokeWidth={3} />
      <path d="M-89 -89 L-30 -97 L-13 -90 L-74 -82Z" fill="#111e27" stroke="#ad9b75" strokeWidth={1} />
      <circle cx={116} cy={-10} r={7} fill="#b9a778" stroke="#475d5e" strokeWidth={2} />
    </g>
    <CarWheel x={-71} y={36} spin={spin} opacity={axle} lift={(1 - axle) * 44} />
    <CarWheel x={98} y={13} spin={spin} opacity={axle} lift={(1 - axle) * 44} />
    <path d="M-94 40 L-119 36 M121 14 L144 9" stroke="#a29269" strokeWidth={4} />
    <circle cx={0} cy={0} r={130} fill="url(#motif-halo)" opacity={0.015 + Math.sin(time * 2) * 0.006} />
  </g>;
};

const stationXs = [850, 1118, 1390];
const lineY = (x: number) => 635 - (x - 600) * 0.21;

const Assembly: React.FC<{time: number}> = ({time}) => {
  const x = 635 + Math.min(time, 10) * 93;
  const y = lineY(x);
  return <g>
    <ellipse cx={1100} cy={497} rx={713} ry={338} fill="url(#motif-environment)" />
    {/* Stations are racks of parts, not robot arms or automated assembly cells. */}
    {stationXs.map((stationX, index) => {
      const sy = lineY(stationX);
      const active = 1 - clamp(Math.abs(x - stationX - 20) / 100);
      return <g key={stationX} transform={`translate(${stationX} ${sy - 135})`}>
        <path d="M-67 -39 L67 -64 L97 -47 L-37 -21Z" fill="url(#motif-cast)" stroke="#768981" strokeWidth={1} />
        <path d="M-63 -36 V47 M89 -45 V15 M-32 -21 V62" stroke="url(#motif-steel)" strokeWidth={7} />
        <path d="M-63 39 L-32 57 L89 8" fill="none" stroke="#485c5d" strokeWidth={3} />
        {index === 0 && <g>
          <CarWheel x={-31} y={-68} spin={0} opacity={0.7} />
          <CarWheel x={29} y={-79} spin={0} opacity={0.7} />
          <path d="M-33 -51 L41 -67" stroke="#ac986b" strokeWidth={4} />
        </g>}
        {index === 1 && <g>
          <path d="M-34 -63 L21 -76 L53 -59 L-3 -45Z" fill="url(#motif-steel)" stroke="#9fa88f" />
          <path d="M-34 -63 V-41 L-3 -22 V-45Z M-3 -45 L53 -59 V-35 L-3 -22Z" fill="url(#motif-cast)" stroke="#8a9277" />
          {Array.from({length: 5}, (_, i) => <path key={i} d={`M${-25 + i * 11} ${-63 - i * 2} l25 15`} stroke="#425861" strokeWidth={3} />)}
        </g>}
        {index === 2 && <g>
          <path d="M-42 -47 V-105 L17 -115 L60 -53" fill="none" stroke="url(#motif-brass)" strokeWidth={5} />
          <path d="M-45 -72 L9 -82 L57 -54 L3 -40Z" fill="url(#motif-body)" stroke="#a8a782" strokeWidth={1} />
          <path d="M-45 -72 V-47 L3 -22 V-40Z" fill="#253e46" />
        </g>}
        <ellipse cx={14} cy={8} rx={93} ry={48} fill="url(#motif-halo)" opacity={active * 0.11} />
        <path d="M9 50 L31 87" stroke="#d5b27c" strokeWidth={1.8} opacity={active * 0.65} strokeDasharray="3 9" />
      </g>;
    })}
    {/* The moving carrier is the motor of this explanatory diagram. */}
    <path d="M559 660 L1598 442 L1692 484 L643 714Z" fill="#142a34" stroke="#536d6c" strokeWidth={2} />
    <path d="M643 714 L1692 484 V507 L643 740Z" fill="url(#motif-cast)" stroke="#415b60" strokeWidth={1.1} />
    <path d="M561 660 V685 L643 740 V714Z" fill="#0a1b24" />
    <path d="M583 655 L1617 443 M628 695 L1667 474" stroke="#bba174" strokeWidth={5} />
    <path d="M583 653 L1617 441 M628 693 L1667 472" stroke="#d2be93" strokeWidth={1} />
    {Array.from({length: 28}, (_, i) => {
      const px = 570 + ((i * 40 + time * 93) % 1100);
      const py = lineY(px) + 15;
      return <path key={i} d={`M${px} ${py} l49 32`} stroke="#546a6d" strokeWidth={5} opacity={0.78} />;
    })}
    {stationXs.map((px) => <g key={px}>
      <path d={`M${px - 18} ${lineY(px) + 55} V${lineY(px) + 111} M${px + 73} ${lineY(px) + 23} V${lineY(px) + 78}`} stroke="url(#motif-steel)" strokeWidth={11} />
      <path d={`M${px - 19} ${lineY(px) + 99} l92 -32`} stroke="#3e5357" strokeWidth={4} />
    </g>)}
    <Chassis x={x} y={y} time={time} />
  </g>;
};

/** Frame must come from the parent's Remotion useCurrentFrame() timeline. */
export const IndustrialMotifs: React.FC<IndustrialMotifsProps> = ({frame, fps, mode}) => {
  const time = Math.max(0, frame / Math.max(1, fps));
  return <svg width="100%" height="100%" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg" style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    <defs>
      <linearGradient id="motif-brass" x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#5a3c26" /><stop offset="0.3" stopColor="#c39a62" /><stop offset="0.49" stopColor="#e5c58d" /><stop offset="0.72" stopColor="#8a6844" /><stop offset="1" stopColor="#403a2e" /></linearGradient>
      <linearGradient id="motif-steel" x1="0" y1="0" x2="0.1" y2="1"><stop stopColor="#2d4149" /><stop offset="0.36" stopColor="#82958d" /><stop offset="0.5" stopColor="#c1c3a2" /><stop offset="0.58" stopColor="#597274" /><stop offset="1" stopColor="#132b35" /></linearGradient>
      <linearGradient id="motif-cast" x1="0" y1="0" x2="0.6" y2="1"><stop stopColor="#51676c" /><stop offset="0.35" stopColor="#263f49" /><stop offset="1" stopColor="#0b1a24" /></linearGradient>
      <linearGradient id="motif-building" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#64665a" /><stop offset="0.55" stopColor="#354d4e" /><stop offset="1" stopColor="#162a34" /></linearGradient>
      <linearGradient id="motif-body" x1="0" y1="0" x2="0.4" y2="1"><stop stopColor="#61746d" /><stop offset="0.18" stopColor="#254551" /><stop offset="0.56" stopColor="#173341" /><stop offset="1" stopColor="#0c202b" /></linearGradient>
      <radialGradient id="motif-environment"><stop stopColor="#344a4b" stopOpacity={0.35} /><stop offset="0.55" stopColor="#17313d" stopOpacity={0.16} /><stop offset="1" stopColor="#070d13" stopOpacity={0} /></radialGradient>
      <radialGradient id="motif-shadow"><stop stopColor="#000" stopOpacity={0.85} /><stop offset="1" stopColor="#000" stopOpacity={0} /></radialGradient>
      <radialGradient id="motif-halo"><stop stopColor="#d6bd8d" stopOpacity={0.75} /><stop offset="0.2" stopColor="#73b9bd" stopOpacity={0.35} /><stop offset="1" stopColor="#73b9bd" stopOpacity={0} /></radialGradient>
      <clipPath id="motif-stage"><rect x={465} y={123} width={1340} height={675} /></clipPath>
    </defs>
    <rect width={1920} height={1080} fill="#070d13" />
    <g clipPath="url(#motif-stage)">{mode === 'electricity' ? <Electricity time={time} /> : <Assembly time={time} />}</g>
  </svg>;
};

export default IndustrialMotifs;
