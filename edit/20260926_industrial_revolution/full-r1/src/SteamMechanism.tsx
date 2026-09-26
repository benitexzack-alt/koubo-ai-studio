import React from 'react';

export type SteamMechanismProps = {frame: number; fps: number};

const TAU = Math.PI * 2;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** A planar, double-acting slider-crank, not a reconstruction of a Watt engine. */
export const getSteamMechanismPose = (frame: number, fps: number) => {
  const time = Math.max(0, frame / Math.max(1, fps));
  const angle = Math.PI + TAU * (0.31 * time + 0.14 * time * time / (time + 1.5));
  const crankRadius = 110;
  const connectingRodLength = 270;
  const crankPinX = 1360 + Math.cos(angle) * crankRadius;
  const crankPinY = 440 + Math.sin(angle) * crankRadius;
  const crossheadX = crankPinX - Math.sqrt(connectingRodLength ** 2 - (crankPinY - 440) ** 2);
  const sine = Math.sin(angle);
  // At a dead centre choose the pressure side of the upcoming stroke.
  const pressureFromLeft = Math.abs(sine) < 1e-10 ? Math.cos(angle) < 0 : sine < 0;
  return {
    time, angle, crankRadius, connectingRodLength, crankPinX, crankPinY, crossheadX,
    pistonX: crossheadX - 300,
    pressureFromLeft,
  };
};

const Bolt: React.FC<{x: number; y: number; r?: number}> = ({x, y, r = 7}) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r + 2} fill="#10191c" />
    <path d={Array.from({length: 6}, (_, i) => `${i === 0 ? 'M' : 'L'}${Math.cos(i * TAU / 6) * r} ${Math.sin(i * TAU / 6) * r}`).join(' ') + 'Z'} fill="url(#steam-brass)" stroke="#d3ae77" strokeWidth={0.6} />
    <path d={`M${-r * 0.43} ${-r * 0.4} L${r * 0.43} ${r * 0.4}`} stroke="#3d392f" strokeWidth={1.5} />
  </g>
);

const SteamSpecks: React.FC<{left: number; right: number; time: number; warm: boolean; direction: number}> = ({left, right, time, warm, direction}) => (
  <g opacity={warm ? 0.85 : 0.25}>
    {Array.from({length: 20}, (_, i) => {
      const p = ((time * (warm ? 0.63 : 0.28) + i * 0.173) % 1 + 1) % 1;
      const x = left + (right - left) * (direction > 0 ? p : 1 - p);
      const y = 411 + ((i * 29) % 63) + Math.sin(time * 2 + i * 1.9) * 4;
      return <g key={i}>
        <path d={`M${x - direction * 12} ${y} h${direction * 10}`} stroke={warm ? '#e4b77b' : '#7aadb0'} strokeWidth={1.4} opacity={0.6} />
        <circle cx={x} cy={y} r={1.2 + (i % 3) * 0.4} fill={warm ? '#f1cb8d' : '#77afb7'} />
      </g>;
    })}
  </g>
);

/** Parent owns the frame hook, captions, date, music, and external transitions. */
export const SteamMechanism: React.FC<SteamMechanismProps> = ({frame, fps}) => {
  const pose = getSteamMechanismPose(frame, fps);
  const {time, angle, crankPinX, crankPinY, crossheadX, pistonX, pressureFromLeft} = pose;
  const degrees = angle * 180 / Math.PI;
  const chamberLeft = 657;
  const chamberRight = 932;
  const chamberStrength = 0.43 + Math.abs(Math.sin(angle)) * 0.25;
  const zoom = 0.94 + smooth(0, 12, time) * 0.1;
  const intakeCycle = (time * 0.8) % 1;
  const valveOffset = pressureFromLeft ? -11 : 11;
  return <svg width="100%" height="100%" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg" style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    <defs>
      <linearGradient id="steam-brass" x1="0" y1="0" x2="0.9" y2="1"><stop stopColor="#4e3927" /><stop offset="0.24" stopColor="#c29159" /><stop offset="0.43" stopColor="#e0bd83" /><stop offset="0.61" stopColor="#987046" /><stop offset="1" stopColor="#342c23" /></linearGradient>
      <linearGradient id="steam-steel" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#26363c" /><stop offset="0.27" stopColor="#829994" /><stop offset="0.41" stopColor="#d0cfb3" /><stop offset="0.5" stopColor="#4b6366" /><stop offset="1" stopColor="#13252d" /></linearGradient>
      <linearGradient id="steam-cast" x1="0" y1="0" x2="0.5" y2="1"><stop stopColor="#526062" /><stop offset="0.24" stopColor="#24383f" /><stop offset="0.7" stopColor="#101e27" /><stop offset="1" stopColor="#070f15" /></linearGradient>
      <linearGradient id="steam-rim"><stop stopColor="#141e23" /><stop offset="0.23" stopColor="#567074" /><stop offset="0.43" stopColor="#c69e67" /><stop offset="0.7" stopColor="#526769" /><stop offset="1" stopColor="#0b1920" /></linearGradient>
      <linearGradient id="steam-hot"><stop stopColor="#dcac66" stopOpacity={0.2} /><stop offset="0.65" stopColor="#cf985e" stopOpacity={0.62} /><stop offset="1" stopColor="#f3c988" stopOpacity={0.8} /></linearGradient>
      <linearGradient id="steam-cool"><stop stopColor="#254a59" stopOpacity={0.2} /><stop offset="1" stopColor="#73b9bd" stopOpacity={0.22} /></linearGradient>
      <radialGradient id="steam-light"><stop stopColor="#c19b63" stopOpacity={0.22} /><stop offset="0.5" stopColor="#25404a" stopOpacity={0.19} /><stop offset="1" stopColor="#070d13" stopOpacity={0} /></radialGradient>
      <radialGradient id="steam-shadow"><stop stopColor="#000" stopOpacity={0.85} /><stop offset="1" stopColor="#000" stopOpacity={0} /></radialGradient>
      <radialGradient id="steam-vapour"><stop stopColor="#8bb8bc" stopOpacity={0.21} /><stop offset="1" stopColor="#73b9bd" stopOpacity={0} /></radialGradient>
      <pattern id="steam-hatch" width="11" height="11" patternUnits="userSpaceOnUse"><path d="M0 11 L11 0" stroke="#c29e6a" strokeWidth={0.7} opacity={0.23} /></pattern>
      <clipPath id="steam-left-chamber"><rect x={chamberLeft} y={397} width={Math.max(0, pistonX - chamberLeft - 10)} height={87} /></clipPath>
      <clipPath id="steam-right-chamber"><rect x={pistonX + 11} y={397} width={Math.max(0, chamberRight - pistonX - 11)} height={87} /></clipPath>
      <clipPath id="steam-stage"><rect x={500} y={125} width={1160} height={650} /></clipPath>
    </defs>
    <rect width={1920} height={1080} fill="#070d13" />
    <ellipse cx={1110} cy={420} rx={740} ry={455} fill="url(#steam-light)" />
    <g clipPath="url(#steam-stage)">
      <g transform={`translate(1100 435) scale(${zoom}) translate(-1100 -435)`}>
        <ellipse cx={1120} cy={716} rx={544} ry={60} fill="url(#steam-shadow)" />
        {/* Deep cast-iron plinth and fixed supports. */}
        <path d="M589 644 L1460 644 L1600 674 L686 686Z" fill="#344447" stroke="#81735a" strokeWidth={1.2} />
        <path d="M686 686 L1600 674 V708 L686 724Z" fill="url(#steam-cast)" />
        <path d="M589 644 L686 686 V724 L589 680Z" fill="#17262e" />
        <path d="M626 656 L1438 656" stroke="#b3976e" strokeWidth={1} opacity={0.5} />
        <path d="M711 627 L743 523 H855 L888 627Z" fill="url(#steam-cast)" stroke="#566367" strokeWidth={2} />
        <path d="M1284 648 L1326 454 H1390 L1451 648Z" fill="url(#steam-cast)" stroke="#566367" strokeWidth={2.2} />
        <path d="M1301 635 L1338 493 H1375 L1419 635Z" fill="#0a1720" stroke="#30444a" strokeWidth={1} />
        <path d="M1265 649 H1486 V671 H1265Z" fill="url(#steam-steel)" />
        {[1287, 1459, 717, 870].map((x) => <Bolt key={x} x={x} y={659} r={8} />)}
        {/* Flywheel thickness sits behind its rotating spokes. */}
        <circle cx={1375} cy={450} r={187} fill="none" stroke="#142027" strokeWidth={43} />
        <circle cx={1372} cy={447} r={187} fill="none" stroke="#627172" strokeWidth={32} />
        <circle cx={1360} cy={440} r={187} fill="#0a151c" stroke="url(#steam-rim)" strokeWidth={31} />
        <circle cx={1360} cy={440} r={171} fill="none" stroke="#b39970" strokeWidth={1.8} opacity={0.68} />
        <g transform={`rotate(${degrees} 1360 440)`}>
          {Array.from({length: 8}, (_, i) => <g key={i} transform={`rotate(${i * 45} 1360 440)`}>
            <path d="M1350 415 C1312 396 1306 333 1350 272 L1371 272 C1336 334 1342 373 1371 415Z" fill="url(#steam-cast)" stroke="#65716e" strokeWidth={1.2} />
            <path d="M1350 406 C1322 373 1329 320 1359 281" fill="none" stroke="#c69e67" strokeWidth={1} opacity={0.6} />
          </g>)}
          {Array.from({length: 32}, (_, i) => {
            const a = i * TAU / 32;
            return <Bolt key={i} x={1360 + Math.cos(a) * 187} y={440 + Math.sin(a) * 187} r={3.5} />;
          })}
          <path d="M1360 419 H1474 V461 H1360Z" fill="url(#steam-brass)" stroke="#e0bc81" strokeWidth={1.5} />
        </g>
        <circle cx={1360} cy={440} r={38} fill="url(#steam-steel)" stroke="#bb9864" strokeWidth={2} />
        <circle cx={1360} cy={440} r={19} fill="#152832" stroke="#688183" strokeWidth={3} />
        <circle cx={1360} cy={440} r={7} fill="#cfad76" />
        {/* Steam pipe and valve chest: warm intake alternates with the piston stroke. */}
        <path d="M584 233 H765 Q789 233 789 258 V310" fill="none" stroke="#071219" strokeWidth={27} />
        <path d="M584 227 H765 Q789 227 789 254 V307" fill="none" stroke="url(#steam-brass)" strokeWidth={19} />
        <path d="M587 222 H765 Q783 222 783 254 V304" fill="none" stroke="#e5be85" strokeWidth={2} opacity={0.64} />
        {[630, 692, 752].map((x) => <g key={x}><rect x={x} y={211} width={11} height={34} rx={2} fill="url(#steam-steel)" /><path d={`M${x + 5} 213 V243`} stroke="#98a39a" strokeWidth={1} /></g>)}
        {Array.from({length: 6}, (_, i) => {
          const p = (intakeCycle + i / 6) % 1;
          return <circle key={i} cx={589 + p * 170} cy={227} r={2.5} fill="#efd198" opacity={Math.sin(p * Math.PI) * 0.85} />;
        })}
        <path d="M698 300 H882 V351 H698Z" fill="url(#steam-cast)" stroke="#9b845f" strokeWidth={2} />
        <path d="M704 306 H876 V344 H704Z" fill="#10212a" />
        <path d={`M${749 + valveOffset} 307 V344 M${806 + valveOffset} 307 V344`} stroke="url(#steam-brass)" strokeWidth={14} />
        <path d="M688 325 H893" stroke="url(#steam-steel)" strokeWidth={5} />
        <path d="M713 350 V382 H673 V398 M865 350 V382 H915 V398" fill="none" stroke="#1d3036" strokeWidth={21} />
        <path d={pressureFromLeft ? 'M713 350 V382 H673 V398' : 'M865 350 V382 H915 V398'} fill="none" stroke="#d3a36a" strokeWidth={7} opacity={0.75} />
        <path d={pressureFromLeft ? 'M865 350 V370 H963 V310' : 'M713 350 V370 H622 V310'} fill="none" stroke="#72a8ad" strokeWidth={3} opacity={0.43} />
        {Array.from({length: 7}, (_, i) => {
          const age = (time * 0.66 + i / 7) % 1;
          return <ellipse key={i} cx={(pressureFromLeft ? 963 : 622) + Math.sin(age * 4 + i) * 9} cy={300 - age * 112} rx={12 + age * 25} ry={8 + age * 17} fill="url(#steam-vapour)" opacity={(1 - age) * 0.65} />;
        })}
        {/* Cutaway cylinder: both chambers are bounded by the same moving piston. */}
        <path d="M631 373 H947 L974 392 V506 L947 529 H631Z" fill="url(#steam-brass)" stroke="#a18c69" strokeWidth={1.8} />
        <path d="M646 388 H944 V498 H646Z" fill="#071722" stroke="#668082" strokeWidth={2} />
        <rect x={chamberLeft} y={397} width={Math.max(0, pistonX - chamberLeft - 10)} height={87} fill={pressureFromLeft ? 'url(#steam-hot)' : 'url(#steam-cool)'} opacity={pressureFromLeft ? chamberStrength : 0.8} />
        <rect x={pistonX + 11} y={397} width={Math.max(0, chamberRight - pistonX - 11)} height={87} fill={pressureFromLeft ? 'url(#steam-cool)' : 'url(#steam-hot)'} opacity={pressureFromLeft ? 0.8 : chamberStrength} />
        <g clipPath="url(#steam-left-chamber)"><SteamSpecks left={chamberLeft + 4} right={pistonX - 14} time={time} warm={pressureFromLeft} direction={pressureFromLeft ? 1 : -1} /></g>
        <g clipPath="url(#steam-right-chamber)"><SteamSpecks left={pistonX + 14} right={chamberRight - 3} time={time} warm={!pressureFromLeft} direction={pressureFromLeft ? 1 : -1} /></g>
        <path d="M631 373 H947 V388 H631Z M631 499 H947 V529 H631Z" fill="url(#steam-hatch)" />
        <path d="M633 378 H944 M633 524 H944" stroke="#e5bf83" strokeWidth={1} opacity={0.68} />
        <rect x={619} y={374} width={28} height={154} fill="url(#steam-steel)" stroke="#bda16c" strokeWidth={1.3} />
        <rect x={932} y={374} width={26} height={154} fill="url(#steam-steel)" stroke="#bda16c" strokeWidth={1.3} />
        {[620, 943].map((x) => [383, 517].map((y) => <Bolt key={`${x}-${y}`} x={x + 12} y={y} r={5.5} />))}
        {/* Fixed gland, piston rod, crosshead, connecting rod, crank pin. */}
        <path d="M950 423 H982 V456 H950Z" fill="url(#steam-brass)" stroke="#c4a578" strokeWidth={1.5} />
        <path d={`M${pistonX} 440 H${crossheadX}`} stroke="#08131a" strokeWidth={18} />
        <path d={`M${pistonX} 436 H${crossheadX}`} stroke="url(#steam-steel)" strokeWidth={11} />
        <path d={`M${pistonX + 13} 433 H${crossheadX}`} stroke="#d0d0b7" strokeWidth={1.4} opacity={0.7} />
        <rect x={pistonX - 11} y={396} width={23} height={89} fill="url(#steam-steel)" stroke="#cfb37c" strokeWidth={1.2} />
        <path d={`M${pistonX - 7} 397 V484 M${pistonX + 7} 397 V484`} stroke="#0a1e27" strokeWidth={2.7} />
        <path d="M976 410 H1223 M976 469 H1223" stroke="#101f28" strokeWidth={13} />
        <path d="M976 405 H1223 M976 464 H1223" stroke="url(#steam-steel)" strokeWidth={7} />
        <path d={`M${crossheadX - 22} 410 H${crossheadX + 22} V465 H${crossheadX - 22}Z`} fill="url(#steam-brass)" stroke="#d4b077" strokeWidth={1.4} />
        <path d={`M${crossheadX} 445 L${crankPinX} ${crankPinY + 5}`} stroke="#07131a" strokeWidth={23} strokeLinecap="round" />
        <path d={`M${crossheadX} 440 L${crankPinX} ${crankPinY}`} stroke="url(#steam-steel)" strokeWidth={17} strokeLinecap="round" />
        <path d={`M${crossheadX} 437 L${crankPinX} ${crankPinY - 3}`} stroke="#c6b487" strokeWidth={1.6} opacity={0.8} />
        <circle cx={crossheadX} cy={440} r={12} fill="url(#steam-brass)" stroke="#efd2a0" strokeWidth={1.5} />
        <circle cx={crankPinX} cy={crankPinY} r={17} fill="url(#steam-brass)" stroke="#efd2a0" strokeWidth={1.6} />
        <circle cx={crankPinX} cy={crankPinY} r={7} fill="#1a3039" stroke="#779397" strokeWidth={1.7} />
        <circle cx={crossheadX} cy={440} r={4} fill="#1a3039" />
      </g>
    </g>
  </svg>;
};

export default SteamMechanism;
