import React from 'react';

type Point = {x: number; y: number; z: number};
type Layer = {depth: number; key: string; element: React.ReactNode};
type Mode = 'ai' | 'quantum' | 'fusion';
const GOLD = '#cf985e';
const CYAN = '#73b9bd';
const TAU = Math.PI * 2;
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {const t = clamp(v); return t * t * (3 - 2 * t);};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const path = (points: Point[], close = false) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + (close ? ' Z' : '');
const rgb = (r: number, g: number, b: number) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;

function helix(start: Point, end: Point, radius: number, turns: number, count: number): Point[] {
  return Array.from({length: count}, (_, i) => {
    const t = i / (count - 1), phase = t * TAU * turns;
    return {x: mix(start.x, end.x, t) + Math.cos(phase) * radius, y: mix(start.y, end.y, t), z: mix(start.z, end.z, t) + Math.sin(phase) * radius};
  });
}

function bezier(a: Point, b: Point, c: Point, d: Point, count: number): Point[] {
  return Array.from({length: count}, (_, i) => {
    const t = i / (count - 1), q = 1 - t;
    return {x: q ** 3 * a.x + 3 * q * q * t * b.x + 3 * q * t * t * c.x + t ** 3 * d.x,
      y: q ** 3 * a.y + 3 * q * q * t * b.y + 3 * q * t * t * c.y + t ** 3 * d.y,
      z: q ** 3 * a.z + 3 * q * q * t * b.z + 3 * q * t * t * c.z + t ** 3 * d.z};
  });
}

const HELIX_A = helix({x: -145, y: 150, z: -30}, {x: -155, y: -150, z: -10}, 39, 3.5, 49);
const HELIX_B = helix({x: 59, y: -161, z: 82}, {x: 127, y: 112, z: 40}, 44, 3.75, 49);
const HELIX_C = helix({x: -106, y: 158, z: -104}, {x: 126, y: -105, z: -58}, 35, 3.1, 43);
const PROTEIN = [
  ...HELIX_A,
  ...bezier(HELIX_A[48], {x: -238, y: -243, z: 4}, {x: 100, y: -253, z: 127}, HELIX_B[0], 19).slice(1),
  ...HELIX_B.slice(1),
  ...bezier(HELIX_B[48], {x: 188, y: 270, z: 55}, {x: -28, y: 251, z: -161}, HELIX_C[0], 20).slice(1),
  ...HELIX_C.slice(1),
  ...bezier(HELIX_C[42], {x: -65, y: -237, z: -90}, {x: 66, y: -271, z: -3}, {x: 184, y: -200, z: 30}, 15).slice(1),
];
const CONTACTS = [[12, 139], [31, 156], [43, 169], [72, 163], [84, 145], [103, 124], [8, 114], [64, 177]];

function Protein({seconds}: {seconds: number}) {
  const yaw = -.14 + seconds * .026;
  const scale = mix(1.1, 1.34, smooth((seconds - 3) / 9));
  const project = (p: Point): Point => {
    const x = p.x * Math.cos(yaw) + p.z * Math.sin(yaw);
    const behind = p.z * Math.cos(yaw) - p.x * Math.sin(yaw);
    const z = p.y * Math.sin(.38) + behind * Math.cos(.38);
    const y = p.y * Math.cos(.38) - behind * Math.sin(.38);
    const perspective = 1150 / (1150 - z);
    return {x: 1155 + x * scale * perspective, y: 418 + y * scale * perspective, z};
  };
  const points = PROTEIN.map((target, i) => {
    const u = i / (PROTEIN.length - 1);
    const progress = smooth((seconds - 1.05 - u * .65) / 4.55);
    const source = {x: mix(-428, 405, u), y: Math.sin(u * TAU * 1.4) * 37, z: Math.cos(u * TAU) * 12};
    return project({x: mix(source.x, target.x, progress), y: mix(source.y, target.y, progress), z: mix(source.z, target.z, progress)});
  });
  const layers: Layer[] = [];
  points.slice(0, -1).forEach((a, i) => {
    const b = points[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
    const coil = i < 48 || (i > 66 && i < 114) || (i > 133 && i < 176);
    const width = mix(1.7, coil ? 6.1 : 2.6, smooth((seconds - 3) / 4.4));
    const light = clamp((a.z + 160) / 370);
    const cool = i > 66 && i < 115;
    const color = cool ? rgb(42 + light * 91, 90 + light * 126, 95 + light * 124) : rgb(104 + light * 125, 65 + light * 117, 35 + light * 95);
    const quad = [{x: a.x + nx * width, y: a.y + ny * width, z: 0}, {x: b.x + nx * width, y: b.y + ny * width, z: 0},
      {x: b.x - nx * width, y: b.y - ny * width, z: 0}, {x: a.x - nx * width, y: a.y - ny * width, z: 0}];
    layers.push({key: `chain-${i}`, depth: (a.z + b.z) / 2, element: <g>
      <path d={path(quad, true)} fill={color} />
      <path d={`M${a.x},${a.y} L${b.x},${b.y}`} fill="none" stroke={cool ? '#bee3dc' : '#efd2a3'} strokeWidth={coil ? .7 : 1.15} opacity={.24 + light * .34} />
      {i % 3 === 0 && <circle cx={a.x} cy={a.y} r={mix(2.4, 2.0, smooth(seconds / 7))} fill={cool ? '#a9d4ce' : '#e2b679'} opacity={.58 + light * .37} />}
    </g>});
  });
  return <g aria-label="非特定实测蛋白的单链折叠艺术示意">
    <ellipse cx="1154" cy="755" rx="270" ry="20" fill="#000" opacity=".25" filter="url(#frontier-soft)" />
    <g opacity={(1 - smooth((seconds - 2) / 3.4)) * .65}>
      {Array.from({length: 10}, (_, i) => {
        const p = (seconds * .31 + i / 10) % 1;
        return <circle key={i} cx={632 + p * 137} cy={421 + Math.sin(p * Math.PI) * 16} r={2.5 + i % 2} fill={i % 3 === 0 ? CYAN : GOLD} opacity={smooth(p * 4)} />;
      })}
      <path d="M620,422 C669,439 716,420 757,420" fill="none" stroke={GOLD} strokeWidth=".6" opacity=".3" />
    </g>
    <g stroke={CYAN} strokeWidth=".8" opacity={smooth((seconds - 6.2) / 3.2) * .3}>
      {CONTACTS.map(([from, to], i) => <path key={i} d={`M${points[from].x},${points[from].y} L${points[to].x},${points[to].y}`} strokeDasharray="2 7" />)}
    </g>
    {layers.sort((a, b) => a.depth - b.depth).map((layer) => <React.Fragment key={layer.key}>{layer.element}</React.Fragment>)}
  </g>;
}

const QUBIT_SITES = Array.from({length: 105}, (_, index) => ({row: Math.floor(index / 15), column: index % 15}));

function Quantum({seconds}: {seconds: number}) {
  const scale = mix(1.01, 1.075, smooth(seconds / 9));
  const project = (x: number, y: number, height = 0): Point => ({x: 1175 + (x * .84 + y * .50) * scale, y: 417 + (-x * .185 + y * .66 - height) * scale, z: y});
  const corners = [project(-446, -230), project(446, -230), project(446, 230), project(-446, 230)];
  const lower = [project(-446, -230, -24), project(446, -230, -24), project(446, 230, -24), project(-446, 230, -24)];
  const grid = QUBIT_SITES.map(({row, column}) => ({row, column, p: project((column - 7) * 52, (row - 3) * 52, 3)}));
  return <g aria-label="105个节点的七行十五列芯片艺术示意，非实际芯片版图和量子运动模拟">
    <ellipse cx="1190" cy="685" rx="416" ry="42" fill="#000" opacity=".32" filter="url(#frontier-soft)" />
    <path d={path([corners[1], lower[1], lower[2], corners[2]], true)} fill="#15252b" stroke="#304147" strokeWidth="1" />
    <path d={path([corners[2], lower[2], lower[3], corners[3]], true)} fill="#101b23" stroke="#31444a" strokeWidth="1" />
    <path d={path(corners, true)} fill="url(#frontier-chip)" stroke="#678087" strokeWidth="1.3" />
    <path d={path([project(-428, -211), project(428, -211), project(428, 211), project(-428, 211)], true)} fill="none" stroke={GOLD} strokeWidth=".8" opacity=".58" />
    <g stroke={GOLD} strokeWidth="1.2" opacity=".42">
      {Array.from({length: 24}, (_, i) => {
        const x = -397 + i * 34.5;
        const a = project(x, -231), b = project(x, -204);
        const c = project(x, 206), d = project(x, 238, -8);
        return <g key={i}><path d={`M${a.x},${a.y} L${b.x},${b.y}`} /><path d={`M${c.x},${c.y} L${d.x},${d.y}`} /></g>;
      })}
    </g>
    <g fill="none" stroke={CYAN} strokeWidth=".65" opacity={smooth((seconds - .35) / 1.6) * .21}>
      {Array.from({length: 7}, (_, row) => <path key={row} d={path(Array.from({length: 15}, (__, column) => project((column - 7) * 52, (row - 3) * 52, 3)))} />)}
      {Array.from({length: 15}, (_, column) => <path key={column} d={path(Array.from({length: 7}, (__, row) => project((column - 7) * 52, (row - 3) * 52, 3)))} />)}
    </g>
    {grid.map(({row, column, p}, index) => {
      const appear = .25 + .75 * smooth((seconds - .14 - column * .055 - row * .025) / 1.4);
      const local = Math.exp(-((column - 8) ** 2 + (row - 3) ** 2) / 12);
      const phase = .5 + .5 * Math.sin(seconds * 2.6 - Math.hypot(column - 7, row - 3) * 1.25);
      const brightness = (.13 + phase * .68) * local * smooth((seconds - 2) / 2);
      const x = (column - 7) * 52, y = (row - 3) * 52;
      const pad = [project(x - 13, y - 13, 3), project(x + 13, y - 13, 3), project(x + 13, y + 13, 3), project(x - 13, y + 13, 3)];
      const capA = [project(x - 8, y, 3), project(x + 8, y, 3)];
      const capB = [project(x, y - 8, 3), project(x, y + 8, 3)];
      return <g key={index} data-qubit-site={index + 1} opacity={appear}>
        <path d={path(pad, true)} fill="#101e29" stroke={index % 9 === 0 ? GOLD : '#4e777e'} strokeWidth=".65" />
        <path d={path(pad, true)} fill={CYAN} opacity={brightness * .34} />
        <path d={path(capA)} stroke={index % 9 === 0 ? GOLD : '#91afb0'} strokeWidth="3" />
        <path d={path(capB)} stroke={index % 9 === 0 ? GOLD : '#91afb0'} strokeWidth="3" />
        <circle cx={p.x} cy={p.y} r={1.4} fill="#d7e8df" opacity={.34 + brightness * .62} />
      </g>;
    })}
    {/* 局部相位波纹只是关系说明，不绘制“量子小球”的经典轨迹。 */}
    <g opacity={smooth((seconds - 2.2) / 1.5)} fill="none" strokeWidth="1.1">
      {[0, 1, 2].map((ribbon) => {
        const p = Array.from({length: 60}, (_, i) => {
          const u = i / 59;
          const envelope = Math.sin(Math.PI * u);
          return project(-26 + u * 157, (ribbon - 1) * 52 + Math.sin(u * TAU * 2 - seconds * 2.6 + ribbon * 1.8) * envelope * 9, 6);
        });
        return <path key={ribbon} d={path(p)} stroke={ribbon === 1 ? GOLD : CYAN} opacity={ribbon === 1 ? .85 : .6} />;
      })}
    </g>
  </g>;
}

function Fusion({frame, fps}: {frame: number; fps: number}) {
  const seconds = Math.max(0, frame) / fps;
  const impact = Math.exp(-Math.pow((frame - 48) / (fps * .32), 2));
  const intensity = .30 + smooth(seconds / 1.65) * .43 + impact * .58;
  const rotation = -.055 + .105 * smooth(seconds / 12);
  const scale = mix(.99, 1.075, smooth(seconds / 12));
  const tilt = 1.04;
  const torus = (u: number, v: number, minor = 78): Point => ({x: (282 + minor * Math.cos(v)) * Math.cos(u + rotation), y: (282 + minor * Math.cos(v)) * Math.sin(u + rotation), z: minor * Math.sin(v)});
  const project = (p: Point): Point => ({x: 1156 + p.x * scale, y: 431 + (p.y * Math.cos(tilt) - p.z * Math.sin(tilt)) * scale, z: p.y * Math.sin(tilt) + p.z * Math.cos(tilt)});
  const quads: Layer[] = [];
  for (let uIndex = 0; uIndex < 64; uIndex++) {
    const u = uIndex / 64 * TAU;
    // 正面约150度壳体剖开，两端保留环形截面；并非运行中的装置录像。
    if (u > Math.PI * .09 && u < Math.PI * .91) continue;
    for (let vIndex = 0; vIndex < 12; vIndex++) {
      const v = vIndex / 12 * TAU;
      const points = [project(torus(u, v)), project(torus(u + TAU / 64, v)), project(torus(u + TAU / 64, v + TAU / 12)), project(torus(u, v + TAU / 12))];
      const light = clamp(.32 + Math.cos(v - .75) * .28 + Math.cos(u + 1) * .14);
      const color = rgb(16 + light * 65, 26 + light * 76, 33 + light * 79);
      quads.push({key: `wall-${uIndex}-${vIndex}`, depth: points.reduce((n, p) => n + p.z, 0) / 4,
        element: <path d={path(points, true)} fill={color} stroke={color} strokeWidth=".75" />});
    }
  }
  const plasmaPath = (tubePhase = 0, tubeRadius = 0) => Array.from({length: 161}, (_, i) => {
    const u = i / 160 * TAU;
    const v = tubePhase + u * 3 + seconds * .17;
    return project(torus(u, v, tubeRadius));
  });
  const frontPlasma = Array.from({length: 95}, (_, i) => project(torus(Math.PI * .085 + i / 94 * Math.PI * .83, 0, 0)));
  const exposedFloorOuter = Array.from({length: 70}, (_, i) => project(torus(Math.PI * .085 + i / 69 * Math.PI * .83, -Math.PI / 3.1, 78)));
  const exposedFloorInner = Array.from({length: 70}, (_, i) => project(torus(Math.PI * .915 - i / 69 * Math.PI * .83, -Math.PI * .73, 78)));
  return <g aria-label="磁约束托卡马克剖面与等离子体环示意，非真实物理模拟">
    <ellipse cx="1158" cy="702" rx="402" ry="48" fill="#000" opacity=".4" filter="url(#frontier-soft)" />
    <ellipse cx="1155" cy="446" rx={339 * scale} ry={196 * scale} fill="url(#frontier-fusion-aura)" opacity={intensity * .65} />
    {quads.sort((a, b) => a.depth - b.depth).map((layer) => <React.Fragment key={layer.key}>{layer.element}</React.Fragment>)}
    <path d={path([...exposedFloorOuter, ...exposedFloorInner], true)} fill="#1a262b" stroke="#51666b" strokeWidth="1.15" />
    {/* 后方以低亮度透视线说明闭合环路，前方剖开部分显露热核心。 */}
    <path d={path(plasmaPath())} fill="none" stroke={GOLD} strokeWidth={14 + impact * 6} opacity={.16 + intensity * .09} filter="url(#frontier-plasma-glow)" />
    <path d={path(plasmaPath())} fill="none" stroke="#ecb579" strokeWidth="4" opacity=".29" />
    <path d={path(frontPlasma)} fill="none" stroke="#ed7b38" strokeWidth={40 + impact * 24} opacity={.33 * intensity} filter="url(#frontier-plasma-glow)" />
    <path d={path(frontPlasma)} fill="none" stroke="#d98b48" strokeWidth={22 + impact * 7} opacity={.28 + intensity * .33} />
    <path d={path(frontPlasma)} fill="none" stroke="#efb86f" strokeWidth={10 + impact * 3} opacity={.68 + impact * .21} />
    <path d={path(frontPlasma)} fill="none" stroke="#fff0c4" strokeWidth={2.3 + impact * 1.9} opacity={.82 + impact * .16} />
    <g fill="none" strokeWidth=".8">
      {[0, 1, 2, 3, 4].map((index) => <path key={index} d={path(plasmaPath(index / 5 * TAU, 8 + index * 1.2))} stroke={index % 2 ? '#efc79b' : '#d48d53'} opacity={(.12 + index * .025) * intensity} />)}
    </g>
    <g fill="none" stroke={CYAN} strokeWidth=".8" opacity={.30 + smooth(seconds / 2) * .15}>
      {Array.from({length: 13}, (_, index) => {
        const u = index / 13 * TAU;
        const coil = Array.from({length: 65}, (__, j) => project(torus(u, j / 64 * TAU, 91)));
        return <path key={index} d={path(coil)} opacity={Math.sin(u) > 0 ? .68 : .28} />;
      })}
    </g>
    <g fill="none" stroke={CYAN} strokeWidth=".65" opacity=".23">
      {[0, 1, 2].map((index) => <path key={index} d={path(Array.from({length: 181}, (_, i) => project(torus(i / 180 * TAU, i / 180 * TAU * 2 + index * TAU / 3, 96))))} />)}
    </g>
    {[Math.PI * .085, Math.PI * .915].map((u, index) => {
      const outer = Array.from({length: 65}, (_, i) => project(torus(u, i / 64 * TAU, 79)));
      const inner = Array.from({length: 65}, (_, i) => project(torus(u, (64 - i) / 64 * TAU, 64)));
      return <g key={index}>
        <path d={`${path(outer, true)} ${path(inner, true)}`} fill="#82674c" fillRule="evenodd" stroke="#c19b70" strokeWidth=".85" />
        <path d={path(inner, true)} fill="none" stroke="#e3b777" strokeWidth="1.5" opacity=".7" />
        {Array.from({length: 12}, (_, i) => {
          const a = project(torus(u, i / 12 * TAU, 72));
          return <circle key={i} cx={a.x} cy={a.y} r="1.65" fill="#28383e" stroke="#c1aa80" strokeWidth=".45" />;
        })}
      </g>;
    })}
  </g>;
}

/** 三种艺术／结构示意；主合成负责可见的限定语。所有时间来自传入局部帧。 */
export const Frontier: React.FC<{frame: number; fps: number; mode: Mode}> = ({frame, fps, mode}) => {
  const seconds = Math.max(0, frame) / fps;
  return <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
    <defs>
      <radialGradient id="frontier-space" cx="63%" cy="40%" r="61%">
        <stop offset="0" stopColor={mode === 'fusion' ? '#25211c' : '#152a31'} />
        <stop offset=".5" stopColor="#0b151d" /><stop offset="1" stopColor="#070d13" />
      </radialGradient>
      <linearGradient id="frontier-chip" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#253d47" /><stop offset=".45" stopColor="#142531" /><stop offset="1" stopColor="#0b141e" />
      </linearGradient>
      <radialGradient id="frontier-fusion-aura">
        <stop offset="0" stopColor="#ffc37f" stopOpacity="0" /><stop offset=".45" stopColor="#bf6632" stopOpacity=".10" />
        <stop offset=".78" stopColor="#df8c42" stopOpacity=".33" /><stop offset="1" stopColor="#db853c" stopOpacity="0" />
      </radialGradient>
      <filter id="frontier-soft" x="-40%" y="-150%" width="180%" height="400%"><feGaussianBlur stdDeviation="13" /></filter>
      <filter id="frontier-plasma-glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="8" /></filter>
      <linearGradient id="frontier-bottom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#070d13" stopOpacity="0" /><stop offset="1" stopColor="#070d13" /></linearGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#frontier-space)" />
    {mode === 'ai' && <Protein seconds={seconds} />}
    {mode === 'quantum' && <Quantum seconds={seconds} />}
    {mode === 'fusion' && <Fusion frame={frame} fps={fps} />}
    <rect x="0" y="802" width="1920" height="278" fill="url(#frontier-bottom)" />
  </svg>;
};
