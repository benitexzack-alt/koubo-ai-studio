import React from 'react';
import {HistoryScene} from '../timeline';
import {downbeatFrames} from '../cues';

type Props = {scene: HistoryScene; local: number; accent: string; light: string; beat: number};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {const p = clamp(n); return p * p * (3 - 2 * p);};
const phase = (p: number, a: number, b: number) => ease((p - a) / Math.max(.001, b - a));
const star = (cx: number, cy: number, radius: number, angle: number) => Array.from({length: 10}, (_, i) => {
  const r = i % 2 ? radius * .381966 : radius;
  return `${cx + Math.cos(angle + i * Math.PI / 5) * r},${cy + Math.sin(angle + i * Math.PI / 5) * r}`;
}).join(' ');

type SheetProps = {x: number; y: number; w: number; h: number; id: string; angle?: number; opacity?: number; children?: React.ReactNode};
const Sheet: React.FC<SheetProps> = ({x, y, w, h, id, angle = 0, opacity = 1, children}) => (
  <g transform={`translate(${x} ${y}) rotate(${angle} ${w / 2} ${h / 2})`} opacity={opacity}>
    <path d={`M2 5L${w - 5} 0L${w} ${h - 4}L0 ${h}Z`} fill={`url(#${id}-paper)`} filter={`url(#${id}-shadow)`}/>
    <path d={`M2 5L${w - 5} 0L${w} ${h - 4}L0 ${h}Z`} fill={`url(#${id}-grain)`} opacity=".36"/>
    <path d={`M8 12L${w - 13} 7M8 12L6 ${h - 10}`} fill="none" stroke="#fff4d9" strokeWidth="1.4" opacity=".6"/>
    {children}
  </g>
);

const Print: React.FC<{w: number; h: number; accent: string; reveal?: number; dense?: boolean}> = ({w, h, accent, reveal = 1, dense = false}) => (
  <g opacity={reveal} fill={accent}>
    <rect x="27" y="26" width={w - 54} height="12" opacity=".64"/>
    <rect x="27" y="46" width={(w - 54) * .74} height="4" opacity=".38"/>
    {Array.from({length: dense ? 4 : 3}, (_, col) => {
      const cols = dense ? 4 : 3;
      const cw = (w - 68) / cols;
      return <g key={col}>
        {Array.from({length: Math.max(1, Math.floor((h - 83) / 14))}, (_, row) => <rect key={row} x={27 + col * (cw + 4)} y={72 + row * 14} width={cw * (.78 + ((col * 7 + row * 3) % 5) * .042)} height={row % 5 === 0 ? 3.8 : 2.6} opacity={row % 5 === 0 ? .48 : .32}/>)}
      </g>;
    })}
  </g>
);

const InkPath: React.FC<{d: string; amount: number; color: string; width?: number; opacity?: number}> = ({d, amount, color, width = 5, opacity = 1}) => <path d={d} pathLength="1" strokeDasharray="1" strokeDashoffset={1 - clamp(amount)} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={opacity}/>;

const Boat: React.FC<{x: number; y: number; scale?: number; accent: string; light: string; angle?: number}> = ({x, y, scale = 1, accent, light, angle = 0}) => (
  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
    <path d="M-103 0Q0 36 112 -4L83 26Q-4 47 -77 24Z" fill={light} stroke={accent} strokeWidth="2"/>
    <path d="M-98 2Q0 17 105 -2" stroke={accent} strokeWidth="3" fill="none"/>
    <path d="M-43 -6L-22 -35H51L78 -3Z" fill={light} stroke={accent} strokeWidth="2"/>
    <path d="M-21 -35V-4M14 -35V-4M49 -35V-4" stroke={accent} strokeWidth="2" opacity=".68"/>
    <path d="M-106 26L-168 70" stroke={accent} strokeWidth="5" strokeLinecap="round"/>
  </g>
);

const Wheel: React.FC<{x: number; y: number; radius: number; rotation: number; light: string; accent: string}> = ({x, y, radius, rotation, light, accent}) => (
  <g transform={`translate(${x} ${y}) rotate(${rotation})`}>
    <circle r={radius} fill="#19201e" fillOpacity=".7" stroke={light} strokeWidth="7"/>
    <circle r={radius - 9} fill="none" stroke={accent} strokeWidth="2"/>
    {Array.from({length: 8}, (_, i) => <path key={i} d={`M0 0L${Math.cos(i * Math.PI / 4) * (radius - 6)} ${Math.sin(i * Math.PI / 4) * (radius - 6)}`} stroke={light} strokeWidth="3"/>)}
    <circle r="8" fill={accent}/>
  </g>
);

export const LateStoryMotion: React.FC<Props> = ({scene, local, accent, light, beat}) => {
  if (!/^H(1[3-9]|2[0-8])$/.test(scene.id)) return null;
  const p = clamp(local / Math.max(1, scene.durationFrames - 1));
  const id = `late-${scene.id}`;
  const ink = '#343733';
  const warm = '#b88b4f';
  const pulse = clamp(beat);
  const enter = phase(p, 0, Math.min(.17, 16 / scene.durationFrames));
  const float = Math.sin(local / 39) * 2.5;
  const cueStart = (fraction: number) => {
    const target = scene.startFrame + fraction * scene.durationFrames;
    const candidates = downbeatFrames.filter((frame) => frame >= scene.startFrame && frame < scene.startFrame + scene.durationFrames && Math.abs(frame - target) <= Math.min(18, scene.durationFrames * .07));
    const nearest = candidates.reduce<number | null>((best, frame) => best === null || Math.abs(frame - target) < Math.abs(best - target) ? frame : best, null);
    return nearest === null ? fraction : (nearest - scene.startFrame) / scene.durationFrames;
  };
  const onBeat = (from: number, until: number) => phase(p, cueStart(from), until);
  let content: React.ReactNode;

  switch (scene.id) {
    case 'H13': {
      const open = onBeat(.03, .42);
      const close = onBeat(.68, .99);
      const height = 42 + 359 * open * (1 - close * .91);
      const y = 492 - height / 2;
      content = <g transform={`rotate(-5 1440 485)`}>
        <Sheet x={1170} y={y} w={510} h={height} id={id}>
          <g opacity={phase(p, .17, .4) * (1 - close)}>
            {Array.from({length: 9}, (_, i) => <path key={i} d={`M${54 + i * 48} 42V${Math.max(45, height - 36)}`} stroke={ink} strokeWidth={i % 3 === 0 ? 6 : 4} strokeDasharray="9 6 5 9" opacity={.4 + (i % 3) * .1}/>)}
            <rect x="400" y={Math.max(45, height - 82)} width="49" height="49" fill="none" stroke="#9e3b27" strokeWidth="4"/>
            <path d={`M413 ${height - 71}h23v27h-23Z`} stroke="#9e3b27" fill="none" strokeWidth="3"/>
          </g>
        </Sheet>
        {[y, y + height].map((cy, i) => <g key={i}>
          <rect x="1153" y={cy - 9} width="544" height="18" rx="9" fill={`url(#${id}-rod)`}/>
          <rect x="1151" y={cy - 11} width="14" height="22" rx="4" fill={warm}/>
          <rect x="1685" y={cy - 11} width="14" height="22" rx="4" fill={warm}/>
        </g>)}
        <path d={`M1440 ${y - 12}Q1390 ${y - 39} 1408 ${y - 81}`} fill="none" stroke={accent} strokeWidth="3" opacity={.6}/>
      </g>;
      break;
    }
    case 'H14': {
      const shut = phase(p, .02, .4);
      const paper = phase(p, .5, .67);
      const torn = onBeat(.74, 1);
      const gap = 145 * torn;
      content = <>
        <g opacity={1 - phase(p, .4, .66)}>
          <path d="M1105 355H1750V674H1105Z" fill="#202521" stroke={accent} strokeWidth="2"/>
          <path d="M1070 357L1130 304H1726L1782 357Z" fill={light} opacity=".57"/>
          {[0, 1].map((i) => <g key={i} transform={`translate(${(i ? 1 : -1) * 130 * (1 - shut)} 0)`}>
            <rect x={i ? 1430 : 1180} y="366" width="249" height="304" fill="#3e4135" stroke={warm} strokeWidth="2"/>
            {Array.from({length: 6}, (_, k) => <path key={k} d={`M${i ? 1442 : 1192} ${398 + k * 46}h220`} stroke={warm} opacity=".32" strokeWidth="3"/>)}
          </g>)}
        </g>
        <g opacity={paper} transform={`translate(0 ${26 * (1 - paper)}) rotate(3 1420 490)`}>
          <g transform={`translate(${-gap} ${-torn * 12}) rotate(${-torn * 7} 1300 490)`}>
            <path d="M1135 318L1430 307L1421 369L1437 400L1417 443L1433 483L1418 532L1436 574L1423 628L1137 650Z" fill={`url(#${id}-paper)`} filter={`url(#${id}-shadow)`}/>
            {Array.from({length: 16}, (_, i) => <path key={i} d={`M1164 ${350 + i * 17}h${190 + i % 4 * 11}`} stroke={ink} strokeWidth="3" opacity=".4"/>)}
          </g>
          <g transform={`translate(${gap} ${torn * 20}) rotate(${torn * 8} 1570 490)`}>
            <path d="M1430 307L1730 315L1724 643L1423 628L1436 574L1418 532L1433 483L1417 443L1437 400L1421 369Z" fill={`url(#${id}-paper)`} filter={`url(#${id}-shadow)`}/>
            {Array.from({length: 16}, (_, i) => <path key={i} d={`M1470 ${350 + i * 17}h${195 + i % 3 * 9}`} stroke={ink} strokeWidth="3" opacity=".4"/>)}
            <rect x="1639" y="568" width="38" height="38" fill="none" stroke="#913b2d" strokeWidth="3"/>
          </g>
        </g>
      </>;
      break;
    }
    case 'H15': {
      const first = phase(p, 0, .24);
      const second = onBeat(.5, .7);
      content = <>
        <Sheet x={1100 - 45 * second} y={308 + 45 * second} w={415} h={368} angle={-9 - 9 * second} opacity={first * (1 - second * .62)} id={id}>
          <Print w={415} h={368} accent={ink} dense/>
          <path d="M28 140H384V216H28Z" fill={accent} fillOpacity=".21"/>
          <path d="M36 214L91 174L141 188L204 150L271 186L333 162L377 210Z" fill={ink} opacity=".5"/>
        </Sheet>
        <Sheet x={1390 - 63 * second} y={376 - 88 * second} w={354} h={374} angle={11 - 10 * second} opacity={second} id={id}>
          <Print w={354} h={374} accent={ink}/>
          <path d="M28 132H327M28 144H327" stroke={accent} strokeWidth="3"/>
          <rect x="270" y="288" width="40" height="40" fill="none" stroke="#933b29" strokeWidth="3"/>
        </Sheet>
        <path d="M1070 738Q1320 747 1740 707" stroke={accent} strokeWidth="2" opacity={second * .45} fill="none"/>
      </>;
      break;
    }
    case 'H16': {
      const printing = phase(p, .01, .74);
      const y = 422 + printing * 164;
      content = <>
        <g transform="rotate(-6 1410 477)">
          <Sheet x={1190} y={y - 274} w={454} h={336} id={id}><Print w={454} h={336} accent={ink} reveal={printing} dense/></Sheet>
          <rect x="1130" y="387" width="574" height="90" rx="44" fill={`url(#${id}-rod)`}/>
          <path d={`M1160 ${421 + Math.sin(local / 18) * 17}H1675`} stroke={light} strokeWidth="3" opacity=".3"/>
          <rect x="1120" y="467" width="598" height="17" fill="#484b42"/>
        </g>
        {Array.from({length: 7}, (_, i) => {
          const step = phase(p, .19 + i * .066, .34 + i * .066);
          return <g key={i} transform={`translate(${1040 + i * 92} ${693 - Math.sin(i / 2) * 25 - step * 16}) rotate(-24)`} opacity={step * .75}>
            <ellipse cx="0" cy="0" rx="9" ry="24" fill={light}/><ellipse cx="26" cy="18" rx="9" ry="24" fill={accent}/>
          </g>;
        })}
      </>;
      break;
    }
    case 'H17': {
      const lamp = phase(p, .01, .24);
      const boat = onBeat(.51, .77);
      content = <>
        <g opacity={lamp * (1 - boat * .85)} transform={`translate(${-boat * 24} ${float})`}>
          <ellipse cx="1340" cy="536" rx="220" ry="29" fill={light} opacity=".17"/>
          <path d="M1134 543L1536 543L1507 650L1159 650Z" fill="#343831" stroke={accent} strokeWidth="2"/>
          <path d="M1200 651L1189 732M1470 651L1483 732" stroke={light} strokeWidth="5" opacity=".65"/>
          <ellipse cx="1340" cy="497" rx={43 + pulse * 4} ry="10" fill={light} opacity=".37"/>
          <path d="M1340 489V397M1314 395H1366L1382 360H1298Z" fill={light} fillOpacity=".84" stroke={accent} strokeWidth="2"/>
          <path d="M1320 509H1360L1350 490H1330Z" fill={accent}/>
          <path d="M1245 552H1428V568H1245Z" fill={light} opacity=".57"/>
        </g>
        <g opacity={boat} transform={`translate(${(1 - boat) * 50} ${float})`}>
          <Boat x={1495} y={560} scale={1.3} accent={accent} light={light}/>
          {[0, 1, 2].map((i) => <path key={i} d={`M${1200 - i * 15} ${628 + i * 31}Q1420 ${598 + i * 31} 1700 ${630 + i * 30}`} stroke={light} strokeWidth={2 - i * .35} fill="none" opacity={.42 - i * .1}/>)}
        </g>
      </>;
      break;
    }
    case 'H18': {
      const advance = onBeat(.02, .92);
      content = <>
        <Sheet x={1130} y={320} w={602} h={386} id={id} angle={-4} opacity={.79}>
          <path d="M30 323Q84 252 147 285T273 195T415 130T561 35" fill="none" stroke={ink} strokeWidth="28" opacity=".09"/>
          <InkPath d="M45 334C137 296 151 236 245 242S340 134 414 140S486 67 558 50" amount={advance} color={ink} width={9}/>
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={[73, 246, 405, 550][i]} cy={[322, 242, 143, 52][i]} r={6 + pulse * 2} fill={warm} opacity={phase(p, .13 + i * .19, .23 + i * .19)}/>)}
        </Sheet>
        <path d="M1013 683L1078 651L1063 704Z" fill={accent} opacity={advance * .6}/>
      </>;
      break;
    }
    case 'H19': {
      const split = onBeat(.14, .88);
      content = <>
        <Sheet x={1135} y={321} w={595} h={383} id={id} angle={3} opacity={.81}>
          <InkPath d="M54 305C149 306 176 225 280 204" amount={phase(p, 0, .28)} color={ink} width={8}/>
          <InkPath d={`M280 204C377 ${195 - split * 45} 410 ${182 - split * 92} 550 ${170 - split * 82}`} amount={phase(p, .16, .76)} color="#984a35" width={8}/>
          <InkPath d={`M280 204C373 ${216 + split * 44} 451 ${210 + split * 89} 550 ${211 + split * 110}`} amount={phase(p, .16, .76)} color={ink} width={7}/>
          <path d="M310 33L295 73L320 114L304 155L326 197L308 245L329 289L310 353" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - split} stroke="#726346" fill="none" strokeWidth="2" opacity=".65"/>
        </Sheet>
      </>;
      break;
    }
    case 'H20': {
      const forward = phase(p, 0, .96);
      content = <g opacity={enter}>
        <path d="M1190 749L1460 275M1775 749L1460 275" fill="none" stroke={light} strokeWidth="7"/>
        <path d="M1200 749L1465 280M1764 749L1456 280" fill="none" stroke={accent} strokeWidth="2"/>
        {Array.from({length: 12}, (_, i) => {
          const t = ((i / 12 + forward * .13) % 1);
          const z = t * t;
          const y = 283 + z * 464;
          return <path key={i} d={`M${1460 - z * 274} ${y}L${1460 + z * 320} ${y}`} stroke={light} strokeWidth={2 + z * 12} opacity={Math.min(1, t * 5, (1 - t) * 7) * .72}/>;
        })}
        <path d={`M${1410 - forward * 90} ${285 + forward * 70}H${1510 + forward * 100}L${1530 + forward * 120} ${319 + forward * 110}H${1390 - forward * 105}Z`} fill="#262e2c" stroke={accent} strokeWidth="2"/>
        <circle cx="1447" cy={318 + forward * 75} r={8 + pulse * 2} fill={light} opacity=".57"/>
      </g>;
      break;
    }
    case 'H21': {
      const march = phase(p, .02, .91);
      content = <>
        {[0, 1, 2].map((layer) => <path key={layer} d={`M990 ${708 - layer * 20}L${1160 + layer * 47} ${496 - layer * 61}L${1270 + layer * 30} ${626 - layer * 30}L${1440 + layer * 42} ${416 - layer * 65}L${1620 + layer * 34} ${602 - layer * 36}L1830 ${438 - layer * 56}V746H990Z`} fill={layer === 0 ? '#343e38' : light} opacity={layer === 0 ? .58 : .1 + layer * .07}/>)}
        <InkPath d="M1045 697C1141 638 1170 595 1243 608S1295 488 1385 504S1451 467 1516 456" amount={march} color={light} width={5}/>
        <InkPath d="M1165 738C1254 670 1294 646 1363 583S1441 524 1516 456" amount={phase(p, .17, .89)} color={accent} width={4}/>
        <InkPath d="M1729 684C1657 637 1620 603 1523 599S1440 560 1375 559" amount={phase(p, .22, .95)} color={light} width={4}/>
        {[{x: 1516, y: 456, a: .69}, {x: 1375, y: 559, a: .78}].map((node, i) => <g key={i} opacity={phase(p, node.a, node.a + .15)}>
          <circle cx={node.x} cy={node.y} r={11 + pulse * 3} fill={warm}/><circle cx={node.x} cy={node.y} r="24" stroke={light} fill="none" strokeWidth="2"/>
        </g>)}
      </>;
      break;
    }
    case 'H22': {
      const bridge = phase(p, .01, .24);
      const guard = onBeat(.23, .77);
      content = <>
        <g opacity={bridge}>
          <path d="M1030 588H1790V631H1030Z" fill={light} opacity=".77"/>
          <path d="M1075 631Q1116 546 1160 631M1255 631Q1297 546 1340 631M1435 631Q1477 546 1520 631M1615 631Q1657 546 1700 631" fill="#1f2725"/>
          {Array.from({length: 10}, (_, i) => <path key={i} d={`M${1070 + i * 76} 586V551H${1084 + i * 76}V586`} fill={light} opacity=".77"/>)}
          <path d="M1068 552H1753" stroke={light} strokeWidth="6"/>
        </g>
        <g opacity={guard} transform={`translate(0 ${34 * (1 - guard)})`}>
          {[0, 1, 2].map((i) => <g key={i} transform={`translate(${1185 + i * 165} ${465 - i % 2 * 30})`}>
            <path d="M-61 28L0 -25L64 28V104H-61Z" fill={light} fillOpacity=".81" stroke={accent} strokeWidth="2"/>
            <path d="M-82 28L0 -42L83 28Z" fill="#525549" stroke={light} strokeWidth="2"/>
            <rect x="-12" y="63" width="25" height="40" fill={ink} opacity=".76"/>
          </g>)}
          <path d={`M1090 350Q1415 ${274 - pulse * 5} 1750 351L1722 391Q1420 337 1110 394Z`} fill={light} fillOpacity=".67" stroke={accent} strokeWidth="2"/>
          <path d="M1108 369Q1415 311 1734 371" stroke="#fff3d3" strokeWidth="2" fill="none" opacity=".6"/>
        </g>
        {[0, 1, 2].map((i) => <path key={i} d={`M1070 ${680 + i * 26}Q1360 ${648 + i * 30} 1760 ${688 + i * 20}`} stroke={accent} strokeWidth="2" fill="none" opacity=".26"/>)}
      </>;
      break;
    }
    case 'H23': {
      const clear = phase(p, .02, .41);
      const document = phase(p, .21, .5);
      const second = onBeat(.52, .78);
      content = <>
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M${1070 + i * 130} 714C${960 + i * 150} 551 ${1280 + i * 100} 454 ${1170 + i * 120} 249`} stroke="#8b8573" strokeWidth={41 + i * 13} strokeLinecap="round" opacity={(1 - clear) * .14} fill="none"/>)}
        <Sheet x={1120 - second * 34} y={337 + second * 23} w={384} h={353} angle={-7} id={id} opacity={document * (1 - second * .24)}><Print w={384} h={353} accent={ink}/></Sheet>
        <Sheet x={1380 - second * 24} y={407 - second * 107} w={368} h={359} angle={10 - second * 6} id={id} opacity={second}>
          <Print w={368} h={359} accent={ink}/>
          <InkPath d="M52 290C87 261 80 306 123 279S151 307 185 280S225 312 283 279" amount={phase(p, .71, .97)} color={ink} width={2.8}/>
        </Sheet>
      </>;
      break;
    }
    case 'H24': {
      const tear = onBeat(.04, .96);
      content = <g transform="rotate(-3 1430 495)">
        <g transform={`translate(${-tear * 90} ${-tear * 11}) rotate(${-tear * 7} 1290 500)`}>
          <path d="M1140 330H1430L1422 366L1444 405L1420 448L1443 495L1421 541L1440 586L1427 677H1140Z" fill={`url(#${id}-paper)`} filter={`url(#${id}-shadow)`}/>
          <path d="M1170 375H1370M1170 399H1392M1170 436H1365M1170 459H1381M1170 494H1365M1170 517H1392M1170 553H1372M1170 576H1388M1170 613H1370" stroke={ink} strokeWidth="4" opacity=".46"/>
        </g>
        <g transform={`translate(${tear * 90} ${tear * 22}) rotate(${tear * 7} 1580 500)`}>
          <path d="M1430 330H1720V677H1427L1440 586L1421 541L1443 495L1420 448L1444 405L1422 366Z" fill={`url(#${id}-paper)`} filter={`url(#${id}-shadow)`}/>
          <path d="M1470 375H1682M1470 399H1666M1470 436H1680M1470 459H1665M1470 494H1678M1470 517H1660M1470 553H1683M1470 576H1668M1470 613H1684" stroke={ink} strokeWidth="4" opacity=".46"/>
        </g>
      </g>;
      break;
    }
    case 'H25': {
      const cart = onBeat(.39, .98);
      content = <>
        {[0, 1, 2].map((i) => {
          const arrive = phase(p, .04 + i * .16, .2 + i * .16);
          return <g key={i} transform={`translate(${1170 + i * 244} ${379 + (1 - arrive) * 34 + i % 2 * 22})`} opacity={arrive}>
            <path d="M-92 -48L88 -55L97 88L-99 98Z" fill={`url(#${id}-paper)`} filter={`url(#${id}-shadow)`}/>
            <circle cy="15" r="35" fill="none" stroke={ink} strokeWidth="2" opacity=".6"/>
            <circle cy="15" r={8 + pulse * 2} fill="#995339"/>
            <path d="M-52 68H53M-48 79H39" stroke={ink} strokeWidth="2" opacity=".45"/>
          </g>;
        })}
        <g transform={`translate(${1120 + cart * 375} ${637 + float})`} opacity={phase(p, .31, .52)}>
          <path d="M-90 -28H118L154 1H-112Z" fill={light} stroke={accent} strokeWidth="2"/>
          <path d="M-100 7H147M147 7L217 37" stroke={light} strokeWidth="5"/>
          <path d="M-56 -31V-73H80V-31M-27 -32V-95H52V-73" stroke={accent} strokeWidth="2" fill={light}/>
          <Wheel x={-44} y={44} radius={43} rotation={cart * 260} light={light} accent={accent}/>
          <Wheel x={89} y={44} radius={43} rotation={cart * 260} light={light} accent={accent}/>
        </g>
        <path d="M1050 730Q1430 737 1810 704" stroke={accent} strokeWidth="2" opacity=".5" fill="none"/>
      </>;
      break;
    }
    case 'H26': {
      const crossing = phase(p, .03, .94);
      content = <>
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${995 - i * 11} ${476 + i * 54}Q${1220 + Math.sin(local / 32 + i) * 25} ${442 + i * 54} ${1450 + Math.sin(local / 40) * 25} ${481 + i * 50}T1840 ${473 + i * 51}`} stroke={i % 2 ? accent : light} strokeWidth={2.8 - i * .35} fill="none" opacity={.46 - i * .055}/>)}
        <g opacity={enter}>
          <Boat x={1130 + crossing * 470} y={461 - crossing * 86 + float} scale={.79} accent={accent} light={light} angle={-6}/>
          <Boat x={1040 + crossing * 526} y={634 - crossing * 113 - float} scale={1.18} accent={accent} light={light} angle={-7}/>
          <path d={`M${1020 + crossing * 440} ${703 - crossing * 122}Q${1120 + crossing * 440} ${697 - crossing * 122} ${1270 + crossing * 440} ${705 - crossing * 122}`} stroke={light} strokeWidth="2" fill="none" opacity=".45"/>
        </g>
      </>;
      break;
    }
    case 'H27': {
      const meeting = phase(p, .03, .42);
      const fold = onBeat(.68, .99);
      content = <g transform={`rotate(-4 1430 490)`}>
        <Sheet x={1150} y={330} w={584} h={363} id={id} opacity={meeting}>
          <g transform={`translate(292 182) scale(${1 - fold * .85} 1)`}>
            <ellipse rx="205" ry="103" fill="#82715b" fillOpacity=".22" stroke={ink} strokeWidth="2"/>
            {Array.from({length: 9}, (_, i) => {
              const a = i / 9 * Math.PI * 2;
              return <path key={i} d={`M${Math.cos(a) * 236 - 13} ${Math.sin(a) * 127 - 8}h26v16h-26Z`} fill={ink} opacity=".48"/>;
            })}
            <rect x="-72" y="-57" width="143" height="114" fill={light} stroke={accent} strokeWidth="2"/>
            <path d="M-47 -30H47M-47 -17H41M-47 -3H47M-47 11H38M-47 25H44" stroke={ink} strokeWidth="3" opacity=".65"/>
          </g>
          <path d="M292 10V352" stroke={warm} strokeWidth="2" opacity=".48"/>
          <path d={`M292 10L${292 + (1 - fold) * 275} 5V357L292 353Z`} fill={`url(#${id}-paper)`} opacity={fold * .94}/>
        </Sheet>
      </g>;
      break;
    }
    case 'H28': {
      const reveal = onBeat(.01, .37);
      // Flag geometry follows the 30 × 20 construction grid; every small star points at the large star.
      const flagX = 155;
      const flagY = 345;
      const unit = 10;
      content = <g opacity={reveal} transform={`translate(0 ${(1 - reveal) * 27}) rotate(-3 305 445)`}>
        <path d="M151 341L460 338L464 550L147 554Z" fill={light} filter={`url(#${id}-shadow)`}/>
        <svg x={flagX} y={flagY} width={unit * 30} height={unit * 20} viewBox="0 0 30 20">
          <defs><clipPath id={`${id}-flag-reveal`}><rect width={30 * reveal} height="20"/></clipPath></defs>
          <g clipPath={`url(#${id}-flag-reveal)`}>
            <rect width="30" height="20" fill="#DE2910"/>
            <polygon points={star(5, 5, 3, -Math.PI / 2)} fill="#FFDE00"/>
            {([[10, 2], [12, 4], [12, 7], [10, 9]] as Array<[number, number]>).map(([x, y], i) => <polygon key={i} points={star(x, y, 1, Math.atan2(5 - y, 5 - x))} fill="#FFDE00"/>)}
            <path d="M15 0V20" stroke="#891409" strokeOpacity=".1" strokeWidth=".13"/>
            <path d="M.3 .3H29.7V19.7" stroke="#ff7641" strokeOpacity=".18" strokeWidth=".12" fill="none"/>
          </g>
        </svg>
        <path d={`M${flagX + reveal * 300} 345V545`} stroke={light} strokeWidth="2" opacity={(1 - reveal) * .65}/>
      </g>;
      break;
    }
  }

  return <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}} aria-label="无字纸物历史叙事动效">
    <defs>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f0dfb5"/><stop offset=".43" stopColor={light}/><stop offset="1" stopColor="#bca77e"/></linearGradient>
      <linearGradient id={`${id}-rod`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#bba179"/><stop offset=".32" stopColor="#ded0a6"/><stop offset=".7" stopColor="#5b4a32"/><stop offset="1" stopColor="#302c23"/></linearGradient>
      <pattern id={`${id}-grain`} width="43" height="31" patternUnits="userSpaceOnUse"><path d="M2 7L18 8M23 24L40 22M4 25L8 19M33 4L40 7" stroke="#7b6849" strokeWidth=".5" opacity=".4"/><path d="M12 16L27 14M34 29L41 30" stroke="#fff3d1" strokeWidth=".65" opacity=".8"/></pattern>
      <filter id={`${id}-shadow`} x="-20%" y="-20%" width="145%" height="150%"><feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#050a08" floodOpacity=".47"/></filter>
      <clipPath id={`${id}-stage`}><rect x={scene.id === 'H28' ? 110 : 900} y="220" width={scene.id === 'H28' ? 1700 : 910} height="540"/></clipPath>
    </defs>
    <g clipPath={`url(#${id}-stage)`} opacity={enter}>{content}</g>
  </svg>;
};
