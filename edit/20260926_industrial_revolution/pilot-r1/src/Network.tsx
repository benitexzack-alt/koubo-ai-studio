import React from 'react';

type Vec3 = {x: number; y: number; z: number};
type Projected = {x: number; y: number; z: number};
type Node = {latitude: number; longitude: number; layer: number; parent: number};

const GOLD = '#cf985e';
const CYAN = '#73b9bd';
const TAU = Math.PI * 2;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
const out = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const blend = (a: number, b: number, t: number) => a + (b - a) * t;

// 抽象信息节点，非城市坐标或真实互联网拓扑。
const NODES: Node[] = [
  {latitude: 8, longitude: 0, layer: 0, parent: 0},
  {latitude: 33, longitude: -35, layer: 1, parent: 0},
  {latitude: 29, longitude: 42, layer: 1, parent: 0},
  {latitude: -28, longitude: -28, layer: 1, parent: 0},
  {latitude: -21, longitude: 46, layer: 1, parent: 0},
  {latitude: 66, longitude: 5, layer: 2, parent: 1},
  {latitude: 11, longitude: -70, layer: 2, parent: 1},
  {latitude: 50, longitude: -89, layer: 2, parent: 1},
  {latitude: 53, longitude: 87, layer: 2, parent: 2},
  {latitude: 8, longitude: 83, layer: 2, parent: 2},
  {latitude: -5, longitude: 25, layer: 2, parent: 2},
  {latitude: -58, longitude: -1, layer: 2, parent: 3},
  {latitude: -39, longitude: -82, layer: 2, parent: 3},
  {latitude: -10, longitude: -45, layer: 2, parent: 3},
  {latitude: -50, longitude: 71, layer: 2, parent: 4},
  {latitude: -17, longitude: 110, layer: 2, parent: 4},
  {latitude: -4, longitude: 58, layer: 2, parent: 4},
  {latitude: 38, longitude: -145, layer: 3, parent: 7},
  {latitude: -5, longitude: -112, layer: 3, parent: 6},
  {latitude: -41, longitude: -142, layer: 3, parent: 12},
  {latitude: 6, longitude: 157, layer: 3, parent: 15},
  {latitude: 43, longitude: 139, layer: 3, parent: 8},
  {latitude: -40, longitude: 161, layer: 3, parent: 14},
  {latitude: 71, longitude: -119, layer: 3, parent: 5},
  {latitude: -67, longitude: -102, layer: 3, parent: 11},
  {latitude: -66, longitude: 134, layer: 3, parent: 14},
  {latitude: 12, longitude: -28, layer: 3, parent: 13},
  {latitude: 37, longitude: 7, layer: 3, parent: 5},
  {latitude: -32, longitude: 10, layer: 3, parent: 11},
  {latitude: 18, longitude: 64, layer: 3, parent: 9},
  {latitude: 50, longitude: -40, layer: 3, parent: 1},
  {latitude: -3, longitude: -87, layer: 3, parent: 6},
  {latitude: -39, longitude: 51, layer: 3, parent: 4},
];

const spherePoint = (latitude: number, longitude: number): Vec3 => {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  return {x: Math.cos(lat) * Math.sin(lon), y: -Math.sin(lat), z: Math.cos(lat) * Math.cos(lon)};
};
const POINTS = NODES.map((n) => spherePoint(n.latitude, n.longitude));
const CROSS_LINKS = [[1, 2], [2, 4], [3, 4], [6, 12], [5, 8], [9, 15], [11, 14], [13, 10], [26, 28], [27, 29], [30, 7], [31, 18]];
const EDGES = [
  ...NODES.slice(1).map((n, i) => ({from: n.parent, to: i + 1, layer: n.layer, cross: false})),
  ...CROSS_LINKS.map(([from, to]) => ({from, to, layer: 4, cross: true})),
];

function curve(a: Vec3, b: Vec3, progress: number, height: number): Vec3 {
  const cosine = Math.min(.999999, Math.max(-.999999, a.x * b.x + a.y * b.y + a.z * b.z));
  const angle = Math.acos(cosine);
  const divisor = Math.sin(angle);
  const wa = Math.sin((1 - progress) * angle) / divisor;
  const wb = Math.sin(progress * angle) / divisor;
  const altitude = 1 + Math.sin(Math.PI * progress) * height;
  return {x: (a.x * wa + b.x * wb) * altitude, y: (a.y * wa + b.y * wb) * altitude, z: (a.z * wa + b.z * wb) * altitude};
}

function pathFrom(points: Projected[]) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

function visibleSegments(points: Projected[], front: boolean) {
  let d = '';
  let pen = false;
  for (const p of points) {
    if ((p.z >= 0) === front) {
      d += `${pen ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)} `;
      pen = true;
    } else {
      pen = false;
    }
  }
  return d;
}

/**
 * 本段仅接收由主合成 useCurrentFrame() 推导的局部帧。
 * 默认设计 30 fps / 0–191 帧；不使用随机数、时钟、CSS 动画或外部素材。
 */
export const Network: React.FC<{frame: number; fps: number}> = ({frame, fps}) => {
  const seconds = Math.max(0, frame) / fps;
  const pullback = ease(seconds / 6.38);
  const radius = blend(414, 365, pullback);
  const centerX = blend(1139, 1156, pullback);
  const centerY = blend(418, 443, pullback);
  const yaw = blend(-.025, .23, pullback);
  const tilt = -.08;
  const sphereReveal = ease((seconds - .18) / 1.18);
  const gridReveal = ease((seconds - .42) / 1.48);
  const project = (point: Vec3): Projected => {
    const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
    const z1 = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
    const y = point.y * Math.cos(tilt) - z1 * Math.sin(tilt);
    const z = point.y * Math.sin(tilt) + z1 * Math.cos(tilt);
    return {x: centerX + x * radius, y: centerY + y * radius, z};
  };
  const nodes = POINTS.map(project);
  const root = nodes[0];
  const rootFlash = Math.exp(-seconds * 3.2);
  const rootBreath = .68 + .32 * Math.pow(Math.sin(seconds * Math.PI * 112.893 / 60), 8);
  const meridians = Array.from({length: 12}, (_, i) => {
    const lon = i * 15;
    return Array.from({length: 121}, (__, j) => {
      const angle = j / 120 * TAU;
      return project({x: Math.sin(angle) * Math.sin(lon * Math.PI / 180), y: Math.cos(angle), z: Math.sin(angle) * Math.cos(lon * Math.PI / 180)});
    });
  });
  const parallels = [-65, -45, -25, 0, 25, 45, 65].map((latitude) =>
    Array.from({length: 121}, (_, i) => project(spherePoint(latitude, i * 3)))
  );
  const arrivalTime = (index: number) => index === 0 ? 0 : .26 + NODES[index].layer * .46 + (index % 5) * .062;
  const routes = EDGES.map((edge, index) => {
    const begin = edge.cross ? 2.4 + (index % 6) * .07 : Math.max(.35, arrivalTime(edge.from)) + .03 * (index % 4);
    const reveal = out((seconds - begin) / (edge.layer === 1 ? .64 : .83));
    const lift = edge.cross ? .035 : .07 + .013 * (index % 3);
    const points = Array.from({length: 33}, (_, j) => project(curve(POINTS[edge.from], POINTS[edge.to], j / 32, lift)));
    const depth = points.reduce((sum, p) => sum + p.z, 0) / points.length;
    const pulsePosition = ((Math.max(0, seconds - begin) * (.41 + (index % 3) * .055) + index * .131) % 1);
    const pulse = project(curve(POINTS[edge.from], POINTS[edge.to], pulsePosition, lift));
    const color = edge.layer <= 1 || index % 5 === 0 ? GOLD : CYAN;
    return {edge, index, points, depth, reveal, pulsePosition, pulse, color, begin};
  }).sort((a, b) => a.depth - b.depth);
  const sortedNodes = nodes.map((p, index) => ({p, index})).sort((a, b) => a.p.z - b.p.z);
  const inputReveal = out(seconds / .65);

  return (
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}} aria-label="信息节点连接的抽象球体示意">
      <defs>
        <radialGradient id="network-space" cx="61%" cy="39%" r="62%">
          <stop offset="0" stopColor="#172a30" />
          <stop offset=".48" stopColor="#0b151d" />
          <stop offset="1" stopColor="#070d13" />
        </radialGradient>
        <radialGradient id="network-body" cx="34%" cy="28%" r="78%">
          <stop offset="0" stopColor="#17363d" stopOpacity=".54" />
          <stop offset=".64" stopColor="#091820" stopOpacity=".9" />
          <stop offset="1" stopColor="#040a10" stopOpacity=".96" />
        </radialGradient>
        <radialGradient id="network-halo">
          <stop offset="0" stopColor={CYAN} stopOpacity="0" />
          <stop offset=".82" stopColor={CYAN} stopOpacity="0" />
          <stop offset=".94" stopColor={CYAN} stopOpacity=".14" />
          <stop offset="1" stopColor={CYAN} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="network-flash">
          <stop offset="0" stopColor="#fff5dd" stopOpacity=".9" />
          <stop offset=".12" stopColor={GOLD} stopOpacity=".58" />
          <stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="network-input" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={GOLD} stopOpacity="0" />
          <stop offset=".52" stopColor={GOLD} stopOpacity=".7" />
          <stop offset="1" stopColor="#ffedc7" stopOpacity="1" />
        </linearGradient>
        <filter id="network-soft" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <linearGradient id="network-bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070d13" stopOpacity="0" />
          <stop offset="1" stopColor="#070d13" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="1920" height="1080" fill="url(#network-space)" />

      {/* 环境深度只以低亮度点表示，不绘制虚构地理。 */}
      <g opacity={sphereReveal * .21}>
        {Array.from({length: 34}, (_, i) => {
          const x = 685 + ((i * 283) % 1190);
          const y = 43 + ((i * 127) % 768);
          return <circle key={i} cx={x} cy={y} r={i % 7 === 0 ? 1.3 : .55} fill={i % 3 ? CYAN : GOLD} opacity={.3 + (i % 5) * .11} />;
        })}
      </g>

      <g opacity={sphereReveal}>
        <circle cx={centerX} cy={centerY} r={radius * 1.075} fill="url(#network-halo)" />
        <circle cx={centerX} cy={centerY} r={radius} fill="url(#network-body)" />
        <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke={CYAN} strokeWidth=".8" opacity=".32" />
      </g>

      <g fill="none" stroke={CYAN} strokeWidth=".6" opacity={gridReveal * .23}>
        {[...meridians, ...parallels].map((points, index) => <path key={index} d={visibleSegments(points, false)} opacity=".3" />)}
      </g>
      <g fill="none" stroke={CYAN} strokeWidth=".75" opacity={gridReveal * .29}>
        {[...meridians, ...parallels].map((points, index) => <path key={index} d={visibleSegments(points, true)} strokeWidth={index === 15 ? 1.15 : .65} opacity={index === 15 ? .95 : .62} />)}
      </g>

      {/* 主导线从前场景延续进主节点；高光先于完整网络出现。 */}
      <g fill="none" opacity={1 - ease((seconds - 2.6) / 2.4) * .74}>
        {[-5, 0, 5].map((offset) => (
          <path key={offset}
            d={`M-70,${649 + offset * 2} C360,${667 + offset * 2} 621,${392 + offset * 2} ${root.x},${root.y + offset * .14}`}
            stroke="url(#network-input)" strokeWidth={offset === 0 ? 2.5 : .55}
            pathLength="1" strokeDasharray="1" strokeDashoffset={1 - inputReveal}
            opacity={offset === 0 ? .9 : .35} />
        ))}
      </g>

      <g fill="none" strokeLinecap="round">
        {routes.map(({edge, index, points, depth, reveal, pulsePosition, pulse, color, begin}) => {
          if (reveal <= 0) return null;
          const alpha = (depth > 0 ? .57 : .09) * (edge.cross ? .60 : 1);
          const d = pathFrom(points);
          const pulseAlpha = pulse.z > 0 && seconds > begin + .2 && pulsePosition < reveal ? .87 : 0;
          return (
            <g key={index}>
              {depth > .05 && edge.layer === 1 && <path d={d} stroke={color} strokeWidth="6.5" opacity={alpha * .09} pathLength="1" strokeDasharray="1" strokeDashoffset={1 - reveal} />}
              <path d={d} stroke={color} strokeWidth={edge.layer === 1 ? 1.6 : edge.cross ? .65 : .95} opacity={alpha} pathLength="1" strokeDasharray="1" strokeDashoffset={1 - reveal} />
              {pulseAlpha > 0 && <g opacity={pulseAlpha}>
                <circle cx={pulse.x} cy={pulse.y} r={5.2} fill={color} opacity=".08" />
                <circle cx={pulse.x} cy={pulse.y} r={2.2} fill={color} opacity=".38" />
                <circle cx={pulse.x} cy={pulse.y} r={1.15 + Math.max(0, pulse.z) * .55} fill="#e4f3e9" />
              </g>}
            </g>
          );
        })}
      </g>

      <g>
        {sortedNodes.map(({p, index}) => {
          if (index === 0) return null;
          const show = out((seconds - arrivalTime(index)) / .46);
          if (show <= 0) return null;
          const front = p.z >= -.02;
          const size = (NODES[index].layer === 1 ? 3.3 : 2) * (.77 + Math.max(0, p.z) * .4);
          const color = index % 4 === 0 || NODES[index].layer === 1 ? GOLD : CYAN;
          const pulse = Math.pow(Math.max(0, Math.cos((seconds - arrivalTime(index)) * 3.3)), 8);
          const documentNode = front && index >= 1 && index <= 4;
          return <g key={index} opacity={show * (front ? .92 : .09)}>
            {front && <circle cx={p.x} cy={p.y} r={size * (3 + pulse)} fill={color} opacity={.06 + pulse * .035} />}
            {documentNode ? (
              // 连接路径的终点就是纸页中心，表示相互链接的文档，而非互联网诞生。
              <g transform={`translate(${p.x},${p.y}) rotate(${index % 2 ? -7 : 6})`} stroke={color} strokeLinecap="round" strokeLinejoin="round">
                <path d="M-10,-14 H3 L10,-7 V14 H-10 Z" fill="#0a1820" strokeWidth="1.25" />
                <path d="M3,-14 V-7 H10" fill="none" strokeWidth=".95" opacity=".8" />
                <path d="M-5,-2 H5 M-5,3 H5 M-5,8 H1" fill="none" strokeWidth=".9" opacity=".72" />
              </g>
            ) : <>
              <circle cx={p.x} cy={p.y} r={size} fill={color} />
              {front && <circle cx={p.x - .35} cy={p.y - .35} r={size * .32} fill="#fff6e8" />}
            </>}
          </g>;
        })}
      </g>

      <g>
        <circle cx={root.x} cy={root.y} r={102 + rootFlash * 65} fill="url(#network-flash)" opacity={.25 + rootFlash * .7} />
        <circle cx={root.x} cy={root.y} r={10 + rootFlash * 9} fill={GOLD} opacity={.3 * rootBreath} filter="url(#network-soft)" />
        <circle cx={root.x} cy={root.y} r={7.5} fill="#f2c387" />
        <circle cx={root.x} cy={root.y} r={3.8} fill="#fff5dc" />
        <circle cx={root.x} cy={root.y} r={13 + 14 * out(seconds / .75)} fill="none" stroke={GOLD} strokeWidth=".75" opacity={.6 * (1 - ease(seconds / .95))} />
      </g>

      <rect x="0" y="815" width="1920" height="265" fill="url(#network-bottom)" />
    </svg>
  );
};
