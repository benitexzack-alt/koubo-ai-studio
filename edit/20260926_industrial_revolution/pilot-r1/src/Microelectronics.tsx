import React from 'react';

/**
 * Artistic mechanism study, not a reconstruction of a historical specimen.
 * `frame` must be the scene-local value derived from Remotion useCurrentFrame().
 * The sparse early circuit deliberately precedes the modern high-density die.
 */
export type MicroelectronicsProps = {frame: number; fps: number; illustrateContact?: boolean};
type Point = readonly [number, number];

const COPPER = '#cf985e';
const SIGNAL = '#73b9bd';
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, t: number) => {
  const n = clamp((t - a) / (b - a));
  return n * n * (3 - 2 * n);
};
const mix = (a: number, b: number, n: number) => a + (b - a) * n;
const pointsToString = (points: readonly Point[]) => points.map((p) => p.join(',')).join(' ');

const onPolyline = (points: readonly Point[], fraction: number): Point => {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let distance = clamp(fraction) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const amount = distance / Math.max(lengths[i], 0.0001);
      return [mix(points[i][0], points[i + 1][0], amount), mix(points[i][1], points[i + 1][1], amount)];
    }
    distance -= lengths[i];
  }
  return points[0];
};

const onCubic = (p: readonly [Point, Point, Point, Point], n: number): Point => {
  const m = 1 - n;
  return [
    m ** 3 * p[0][0] + 3 * m ** 2 * n * p[1][0] + 3 * m * n ** 2 * p[2][0] + n ** 3 * p[3][0],
    m ** 3 * p[0][1] + 3 * m ** 2 * n * p[1][1] + 3 * m * n ** 2 * p[2][1] + n ** 3 * p[3][1],
  ];
};

const Pulse: React.FC<{point: Point; strength?: number; radius?: number}> = ({point, strength = 1, radius = 3}) => (
  <g opacity={strength}>
    <circle cx={point[0]} cy={point[1]} r={radius * 5} fill="url(#micro-signal-halo)" />
    <circle cx={point[0]} cy={point[1]} r={radius} fill="#b3e0d9" />
    <circle cx={point[0] - radius * 0.2} cy={point[1] - radius * 0.2} r={radius * 0.35} fill="#f0f0cf" />
  </g>
);

const Trace: React.FC<{points: readonly Point[]; time: number; index: number; opacity?: number; width?: number}> = ({
  points, time, index, opacity = 1, width = 2.2,
}) => {
  const cycle = ((time * 0.34 + index * 0.137) % 1 + 1) % 1;
  return (
    <g opacity={opacity}>
      <polyline points={pointsToString(points)} fill="none" stroke="#080a0c" strokeWidth={width + 3} />
      <polyline points={pointsToString(points)} fill="none" stroke={COPPER} strokeWidth={width} opacity={0.66} strokeLinejoin="round" />
      <polyline points={pointsToString(points)} fill="none" stroke="#e3b47d" strokeWidth={0.55} opacity={0.55} />
      <Pulse point={onPolyline(points, cycle)} radius={2.2} strength={0.85} />
      {points.filter((_, i) => i === 0 || i === points.length - 1).map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={4.3} fill="#171d20" stroke={COPPER} strokeWidth={1.2} />
          <circle cx={p[0]} cy={p[1]} r={1.25} fill="#dbb17b" />
        </g>
      ))}
    </g>
  );
};

const ContactDevice: React.FC<{time: number}> = ({time}) => {
  const dive = smooth(5.9, 7.45, time);
  const opacity = 1 - smooth(7.066666667, 7.5, time);
  const scale = mix(0.94, 1.08, smooth(0, 5.9, time)) + dive * 2.5;
  const input: readonly [Point, Point, Point, Point] = [[-378, 128], [-285, 122], [-208, -150], [-32, 34]];
  const output: readonly [Point, Point, Point, Point] = [[18, 34], [147, -172], [178, 93], [349, 35]];
  const particle = ((time * 0.48) % 1 + 1) % 1;
  const outputParticle = ((time * 0.48 - 0.36) % 1 + 1) % 1;
  return (
    <g opacity={opacity} transform={`translate(${1080 - dive * 28} ${420 - dive * 80}) scale(${scale})`}>
      <ellipse cx={30} cy={239} rx={340} ry={48} fill="url(#micro-shadow)" opacity={0.75} />
      <ellipse cx={9} cy={173} rx={216} ry={76} fill="#131719" />
      <path d="M-207 153 L-207 184 C-177 263 194 265 225 183 L225 153Z" fill="url(#micro-base-edge)" />
      <ellipse cx={9} cy={153} rx={216} ry={76} fill="url(#micro-base-face)" stroke="#8a6a48" strokeWidth={1.6} />
      <ellipse cx={9} cy={154} rx={191} ry={63} fill="none" stroke="#25292a" strokeWidth={3} />
      <ellipse cx={9} cy={150} rx={199} ry={67} fill="none" stroke="#d5a36b" strokeWidth={0.6} opacity={0.55} />
      {Array.from({length: 32}, (_, i) => {
        const angle = (i / 32) * Math.PI * 2;
        return <path key={i} d={`M${9 + Math.cos(angle) * 201} ${153 + Math.sin(angle) * 69} l${Math.cos(angle) * 9} ${Math.sin(angle) * 3}`} stroke="#aa875d" strokeWidth={1} opacity={0.4} />;
      })}
      <path d="M-24 142 L-24 62 L50 44 L50 134Z" fill="url(#micro-dark-metal)" stroke="#6b6256" strokeWidth={1} />
      <path d="M-129 83 L-28 31 L129 68 L29 123Z" fill="#060d13" stroke="#839394" strokeWidth={1.3} />
      <path d="M-129 83 L29 123 L29 142 L-129 102Z" fill="#14202a" />
      <path d="M29 123 L129 68 L129 87 L29 142Z" fill="#091117" />
      <path d="M-123 82 L-28 36 L121 69 L29 117Z" fill="url(#micro-germanium)" />
      <path d="M-119 83 L29 117 L117 71" fill="none" stroke="#a6baba" strokeWidth={0.7} opacity={0.48} />
      {Array.from({length: 16}, (_, i) => <path key={i} d={`M${-99 + i * 8.5} ${74 + i * 2} l44 -21`} stroke="#8da8ad" strokeWidth={0.55} opacity={0.12} />)}
      <path d="M-93 -194 L-30 37 L25 31 L76 -192Z" fill="url(#micro-wedge-side)" stroke="#9e815c" strokeWidth={1.2} />
      <path d="M-83 -192 L-31 28 L-10 19 L10 -202Z" fill="url(#micro-wedge-face)" />
      <path d="M10 -202 L-10 19 L23 29 L67 -192Z" fill="#211d16" />
      <path d="M-87 -191 L-30 35 M70 -191 L20 34" fill="none" stroke="#f4c47b" strokeWidth={2.2} />
      <path d="M-78 -192 L-24 19 M60 -189 L18 20" fill="none" stroke="#bc8643" strokeWidth={4.5} />
      <path d="M-140 -195 C-107 -230 43 -242 100 -199" fill="none" stroke="#151b1e" strokeWidth={17} />
      <path d="M-140 -197 C-107 -232 43 -244 100 -201" fill="none" stroke="url(#micro-wire)" strokeWidth={9} />
      <path d="M-378 128 C-285 122 -208 -150 -32 34" fill="none" stroke="#141516" strokeWidth={17} />
      <path d="M-378 124 C-285 118 -208 -154 -32 30" fill="none" stroke="url(#micro-wire)" strokeWidth={9} />
      <path d="M-378 121 C-285 115 -208 -157 -32 27" fill="none" stroke="#efc08a" strokeWidth={1.4} opacity={0.62} />
      <path d="M18 34 C147 -172 178 93 349 35" fill="none" stroke="#101419" strokeWidth={18} />
      <path d="M18 30 C147 -176 178 89 349 31" fill="none" stroke="url(#micro-wire)" strokeWidth={10} />
      <path d="M19 26 C147 -180 178 85 349 27" fill="none" stroke="#eac18d" strokeWidth={1.7} opacity={0.63} />
      <g opacity={smooth(0.35, 1.2, time)}>
        <Pulse point={onCubic(input, particle)} radius={4} />
        <Pulse point={onCubic(output, outputParticle)} radius={6} strength={smooth(1.1, 2.3, time)} />
        <ellipse cx={-7} cy={40} rx={63} ry={23} fill="url(#micro-signal-halo)" opacity={0.45 + Math.sin(time * 3) * 0.12} />
        <circle cx={-30} cy={34} r={3} fill="#d8c99d" />
        <circle cx={19} cy={32} r={4} fill="#c7e3d6" />
      </g>
      <path d="M-172 184 L-216 218 M181 184 L218 211" stroke="#272929" strokeWidth={7} />
      <path d="M-172 180 L-216 214 M181 180 L218 207" stroke="#ab8052" strokeWidth={2} />
    </g>
  );
};

const earlyPositions: readonly Point[] = [[-166, -100], [-24, -100], [116, -100], [-166, 25], [-24, 25], [116, 25]];

const CircuitEvolution: React.FC<{time: number}> = ({time}) => {
  const arrival = smooth(7.066666667, 7.5, time);
  const integrate = smooth(12.133333334, 13.35, time);
  const density = smooth(12.133333334, 15.35, time);
  const settle = smooth(7.066666667, 15.5, time);
  const planeScale = mix(1.08, 1.23, settle);
  const traceTime = Math.max(0, time - 7.066666667);
  const modernOpacity = smooth(12.133333334, 13.3, time);
  return (
    <g opacity={arrival}>
      <ellipse cx={1080} cy={710} rx={455} ry={66} fill="url(#micro-shadow)" opacity={0.85} />
      <g transform={`translate(${1100 - settle * 25} ${440 - settle * 22}) scale(${planeScale})`}>
        {/* The oblique projection gives every trace and contact a common plane. */}
        <g transform="matrix(0.96 0.19 -0.62 0.55 0 0)">
          <path d="M-346 -260 H346 V258 H-346Z" transform="translate(0 40)" fill="#020709" stroke="#192329" strokeWidth={2} />
          <path d="M-346 -260 V258 L-346 298 L346 298 L346 258 H-346Z" fill="url(#micro-package-edge)" />
          <path d="M346 -260 V258 L346 298 L362 284 L362 -274Z" fill="#151d21" />
          <path d="M-346 -260 H346 V258 H-346Z" fill="url(#micro-ceramic)" stroke="#63645a" strokeWidth={2} />
          <path d="M-331 -245 H331 V243 H-331Z" fill="none" stroke="#aa8053" strokeWidth={0.8} opacity={0.7} />
          <path d="M-324 -238 H324 V236 H-324Z" fill="url(#micro-etch)" opacity={0.55} />
          {[-1, 1].map((side) => Array.from({length: 16}, (_, i) => {
            const x = -285 + i * 38;
            return <g key={`${side}-${i}`}>
              <path d={`M${x} ${side * 255} v${side * 61} l10 6 v${-side * 61}Z`} fill="url(#micro-wire)" opacity={modernOpacity * 0.9} />
              <path d={`M${x + 2} ${side * 260} v${side * 53}`} stroke="#e3b67d" strokeWidth={1} opacity={modernOpacity * 0.6} />
            </g>;
          }))}
          {[-1, 1].map((side) => Array.from({length: 10}, (_, i) => {
            const y = -193 + i * 43;
            return <path key={`${side}-l-${i}`} d={`M${side * 342} ${y} h${side * 53} v11 h${-side * 53}Z`} fill="url(#micro-wire)" opacity={modernOpacity * 0.8} />;
          }))}
          {/* Sparse discrete structures remain visually legible before integration. */}
          <g opacity={1 - smooth(12.133333334, 13.45, time)}>
            {earlyPositions.map(([x, y], i) => {
              const cx = mix(x, x * 0.42, integrate);
              const cy = mix(y, y * 0.42, integrate);
              const blockScale = mix(1, 0.44, integrate);
              const pulsePhase = (traceTime * 0.35 + i * 0.11) % 1;
              return <g key={i}>
                <Trace points={[[-288, -170 + i * 69], [cx - 48, -170 + i * 69], [cx - 48, cy + 18], [cx, cy + 18]]} time={traceTime} index={i} width={2.6} />
                <Trace points={[[cx + 70 * blockScale, cy + 18], [cx + 92, cy + 18], [cx + 92, -163 + i * 69], [295, -163 + i * 69]]} time={traceTime - 0.7} index={i + 9} width={2.6} />
                <g transform={`translate(${cx} ${cy}) scale(${blockScale})`}>
                  <path d="M0 -15 H70 V41 H0Z" fill="#354b4a" stroke="#bd9b66" strokeWidth={0.8} opacity={0.85} />
                  <path d="M7 -9 H63 V35 H7Z" fill="#1c3136" stroke="#829386" strokeWidth={0.6} />
                  <path d="M10 12 H20 L24 3 L31 25 L39 3 L46 25 L52 12 H60" fill="none" stroke={i % 2 === 0 ? '#d7af73' : SIGNAL} strokeWidth={2.7} />
                  <path d="M-7 12 H10 M60 12 H77" stroke="#d8b278" strokeWidth={2.2} />
                  <path d="M7 -7 H62" stroke="#eac58f" strokeWidth={0.8} opacity={0.75} />
                  <circle cx={36} cy={13} r={19} fill="url(#micro-signal-halo)" opacity={pulsePhase > 0.45 && pulsePhase < 0.62 ? 0.8 : 0.05} />
                </g>
              </g>;
            })}
            <path d="M-265 -202 C-144 -300 -61 -196 49 -195 C130 -191 191 -287 264 -203" fill="none" stroke="url(#micro-wire)" strokeWidth={3} opacity={1 - integrate} />
            <path d="M-264 199 C-139 286 39 181 137 191 C193 196 224 257 269 201" fill="none" stroke="url(#micro-wire)" strokeWidth={3} opacity={1 - integrate} />
          </g>
          {/* High density arrives only after the early, sparse circuit has played. */}
          <g opacity={modernOpacity}>
            <path d="M-246 -191 H246 V191 H-246Z" transform={`translate(0 ${mix(-33, -8, density)})`} fill="#040a11" stroke="#947755" strokeWidth={2.3} />
            <g transform={`translate(0 ${mix(-33, -8, density)})`}>
              <rect x={-239} y={-184} width={478} height={366} fill="url(#micro-die-face)" />
              <rect x={-229} y={-174} width={458} height={346} fill="none" stroke="#779e9c" strokeWidth={0.6} opacity={0.48} />
              {Array.from({length: 13}, (_, row) => Array.from({length: 19}, (_, col) => {
                const x = -216 + col * 23;
                const y = -160 + row * 25;
                const reveal = smooth(12.25 + (col + row) * 0.034, 13.85 + (col + row) * 0.034, time);
                const variant = (col * 7 + row * 11) % 5;
                const active = Math.max(0, 1 - Math.abs(((traceTime * 0.38 - (col + row * 0.7) * 0.028) % 1 + 1) % 1 - 0.5) * 15);
                return <g key={`${row}-${col}`} opacity={reveal}>
                  <rect x={x} y={y} width={17} height={18} fill={variant < 2 ? '#1e3940' : '#554637'} stroke={variant < 2 ? '#759c98' : '#c19965'} strokeWidth={0.55} />
                  <path d={`M${x + 2} ${y + 4} h13 M${x + 2} ${y + 8} h13 M${x + 2} ${y + 12} h13`} stroke={variant < 2 ? '#598b8b' : '#a67e4f'} strokeWidth={0.6} opacity={0.65} />
                  <rect x={x + 2} y={y + 2} width={13} height={14} fill={SIGNAL} opacity={active * 0.38 * density} />
                </g>;
              }))}
              {[0, 1, 2, 3].map((i) => <path key={i} d={`M${-178 + i * 114} -175 V174`} stroke="#bda174" strokeWidth={3.2} opacity={0.68} />)}
              {[-1, 0, 1].map((i) => <path key={i} d={`M-230 ${i * 104} H230`} stroke="#172b31" strokeWidth={6} />)}
              {[-1, 0, 1].map((i) => <path key={i} d={`M-230 ${i * 104} H230`} stroke="#c09b67" strokeWidth={1.6} opacity={0.8} />)}
              <path d="M-238 -184 H240 V183" fill="none" stroke="#d4b77d" strokeWidth={1} opacity={0.8} />
              <path d="M-228 -173 L226 165" stroke="#cee2ce" strokeWidth={20} opacity={0.025} />
            </g>
            {Array.from({length: 16}, (_, i) => {
              const x = -214 + i * 28.5;
              return [-1, 1].map((side) => <g key={`${i}-${side}`}>
                <path d={`M${x} ${side * 176 - 8} Q${x + (i - 7.5) * 3} ${side * 213 - 37} ${-285 + i * 38} ${side * 240}`} fill="none" stroke="#342b1f" strokeWidth={5} />
                <path d={`M${x} ${side * 176 - 8} Q${x + (i - 7.5) * 3} ${side * 213 - 40} ${-285 + i * 38} ${side * 240}`} fill="none" stroke="url(#micro-wire)" strokeWidth={2.8} />
                <circle cx={-285 + i * 38} cy={side * 240} r={4} fill="#cfa56d" />
              </g>);
            })}
            {Array.from({length: 9}, (_, i) => {
              const y = -147 + i * 37;
              return [-1, 1].map((side) => <Trace key={`${i}-${side}`} points={[[side * 330, y], [side * 287, y], [side * 266, y - 20], [side * 232, y - 20]]} index={i + (side + 1) * 5} time={traceTime} opacity={density} width={1.8} />);
            })}
            {[-1, 0, 1].map((lane) => <Pulse key={lane} point={[-217 + (((traceTime * 0.26 + lane * 0.17) % 1 + 1) % 1) * 434, lane * 104 - 8]} radius={3.6} strength={density} />)}
          </g>
          <path d="M-346 -260 H346" stroke="#d6ac70" strokeWidth={1.4} opacity={0.7} />
          <path d="M-346 258 H346" stroke="#31494c" strokeWidth={1} opacity={0.8} />
        </g>
      </g>
    </g>
  );
};

export const Microelectronics: React.FC<MicroelectronicsProps> = ({frame, fps, illustrateContact = true}) => {
  const time = Math.max(0, frame / Math.max(1, fps));
  return (
    <svg width="100%" height="100%" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg" style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <defs>
        <radialGradient id="micro-environment" cx="59%" cy="41%" r="55%"><stop offset="0" stopColor="#263435" stopOpacity={0.47} /><stop offset="0.54" stopColor="#102129" stopOpacity={0.22} /><stop offset="1" stopColor="#070d13" stopOpacity={0} /></radialGradient>
        <radialGradient id="micro-shadow"><stop offset="0" stopColor="#000" stopOpacity={0.9} /><stop offset="1" stopColor="#000" stopOpacity={0} /></radialGradient>
        <radialGradient id="micro-signal-halo"><stop offset="0" stopColor="#b2dad0" stopOpacity={0.75} /><stop offset="0.18" stopColor="#73b9bd" stopOpacity={0.42} /><stop offset="1" stopColor="#73b9bd" stopOpacity={0} /></radialGradient>
        <linearGradient id="micro-wire" x1="0" y1="0" x2="0.6" y2="1"><stop stopColor="#6b4628" /><stop offset="0.26" stopColor="#c48d50" /><stop offset="0.45" stopColor="#efd09a" /><stop offset="0.61" stopColor="#b87b3e" /><stop offset="1" stopColor="#5d402a" /></linearGradient>
        <linearGradient id="micro-base-edge"><stop stopColor="#141b1d" /><stop offset="0.28" stopColor="#4b4840" /><stop offset="0.47" stopColor="#9b815d" /><stop offset="0.6" stopColor="#4e4a3f" /><stop offset="1" stopColor="#181f21" /></linearGradient>
        <radialGradient id="micro-base-face" cx="38%" cy="31%"><stop stopColor="#a89471" /><stop offset="0.46" stopColor="#55584e" /><stop offset="1" stopColor="#182226" /></radialGradient>
        <linearGradient id="micro-dark-metal"><stop stopColor="#122027" /><stop offset="0.47" stopColor="#7c7762" /><stop offset="0.53" stopColor="#3a4140" /><stop offset="1" stopColor="#10191d" /></linearGradient>
        <linearGradient id="micro-germanium" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#596a6d" /><stop offset="0.35" stopColor="#1c303b" /><stop offset="0.64" stopColor="#455957" /><stop offset="1" stopColor="#101d2b" /></linearGradient>
        <linearGradient id="micro-wedge-side"><stop stopColor="#5c4228" /><stop offset="0.43" stopColor="#aa8050" /><stop offset="1" stopColor="#2b2922" /></linearGradient>
        <linearGradient id="micro-wedge-face" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#785d39" /><stop offset="0.55" stopColor="#d0a067" /><stop offset="1" stopColor="#6b4827" /></linearGradient>
        <linearGradient id="micro-ceramic" x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#45463c" /><stop offset="0.24" stopColor="#202d30" /><stop offset="0.75" stopColor="#172125" /><stop offset="1" stopColor="#0c161e" /></linearGradient>
        <linearGradient id="micro-package-edge"><stop stopColor="#10191c" /><stop offset="0.48" stopColor="#5b5948" /><stop offset="1" stopColor="#162126" /></linearGradient>
        <linearGradient id="micro-element"><stop stopColor="#b88c54" /><stop offset="0.5" stopColor="#6a614b" /><stop offset="1" stopColor="#303d3e" /></linearGradient>
        <linearGradient id="micro-die-face" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5b685d" /><stop offset="0.25" stopColor="#1e3740" /><stop offset="0.54" stopColor="#4d4940" /><stop offset="1" stopColor="#11252e" /></linearGradient>
        <pattern id="micro-etch" width="23" height="19" patternUnits="userSpaceOnUse"><path d="M0 4H17 M4 8H21 M0 16H8" stroke="#96a695" strokeWidth={0.5} opacity={0.25} /><circle cx={18} cy={14} r={0.7} fill="#ddc39b" opacity={0.16} /></pattern>
        <linearGradient id="micro-lower-shade" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#070d13" stopOpacity={0} /><stop offset="0.42" stopColor="#070d13" stopOpacity={0.93} /><stop offset="1" stopColor="#070d13" /></linearGradient>
        <clipPath id="micro-hero-clip"><rect x={350} y={95} width={1380} height={718} /></clipPath>
      </defs>
      <rect width={1920} height={1080} fill="#070d13" />
      <rect width={1920} height={940} fill="url(#micro-environment)" />
      <g clipPath="url(#micro-hero-clip)">
        {illustrateContact && <ContactDevice time={time} />}
        <CircuitEvolution time={time} />
      </g>
      <rect y={762} width={1920} height={318} fill="url(#micro-lower-shade)" />
    </svg>
  );
};

export default Microelectronics;
