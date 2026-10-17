import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
} from 'remotion';

const SOURCE_WIDTH = 1672;
const SOURCE_HEIGHT = 941;

const asset = (name: string) =>
  staticFile(`lanzhou-industry-ai-paper-local-r1/${name}`);

const continuousProgress = (
  frame: number,
  startFrame: number,
  endFrame: number,
) => {
  if (frame <= startFrame) return 0;
  if (frame >= endFrame) return 1;
  const raw = (frame - startFrame) / (endFrame - startFrame);
  return raw * raw * (3 - 2 * raw);
};

const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

type Point = readonly [number, number];

const interpolatePolygon = (
  from: readonly Point[],
  to: readonly Point[],
  progress: number,
) =>
  from
    .map(([x, y], index) => {
      const [targetX, targetY] = to[index];
      return `${mix(x, targetX, progress)},${mix(y, targetY, progress)}`;
    })
    .join(' ');

const PaperTexture = ({id, href}: {id: string; href: string}) => (
  <pattern
    id={id}
    width={128}
    height={128}
    patternUnits="userSpaceOnUse"
  >
    <image
      href={href}
      x={0}
      y={0}
      width={128}
      height={128}
      preserveAspectRatio="none"
    />
  </pattern>
);

const Stage = ({children}: {children: React.ReactNode}) => (
  <AbsoluteFill style={{backgroundColor: '#0a3157', overflow: 'hidden'}}>
    <div
      style={{
        width: SOURCE_WIDTH,
        height: SOURCE_HEIGHT,
        transform: `scale(${1920 / SOURCE_WIDTH}, ${1080 / SOURCE_HEIGHT})`,
        transformOrigin: 'top left',
        position: 'relative',
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

const FullFrame = ({src}: {src: string}) => (
  <Img
    src={src}
    style={{
      position: 'absolute',
      inset: 0,
      width: SOURCE_WIDTH,
      height: SOURCE_HEIGHT,
    }}
  />
);

const P04Book = ({progress}: {progress: number}) => {
  const texture = asset('P04-paper-texture.png');
  const leftStart: readonly Point[] = [
    [782, 393],
    [847, 360],
    [848, 548],
    [783, 582],
  ];
  const rightStart: readonly Point[] = [
    [848, 385],
    [879, 365],
    [880, 553],
    [848, 584],
  ];
  const leftEnd: readonly Point[] = [
    [742, 514],
    [840, 501],
    [840, 586],
    [731, 577],
  ];
  const rightEnd: readonly Point[] = [
    [840, 501],
    [950, 514],
    [960, 576],
    [840, 586],
  ];

  const left = interpolatePolygon(leftStart, leftEnd, progress);
  const right = interpolatePolygon(rightStart, rightEnd, progress);
  const leftThickness = interpolatePolygon(
    leftStart.map(([x, y]) => [x, y + 5] as const),
    leftEnd.map(([x, y]) => [x, y + 5] as const),
    progress,
  );
  const rightThickness = interpolatePolygon(
    rightStart.map(([x, y]) => [x, y + 5] as const),
    rightEnd.map(([x, y]) => [x, y + 5] as const),
    progress,
  );
  const seamTop: Point = [
    mix(848, 840, progress),
    mix(385, 501, progress),
  ];
  const seamBottom: Point = [
    mix(848, 840, progress),
    mix(584, 586, progress),
  ];

  return (
    <svg
      width={SOURCE_WIDTH}
      height={SOURCE_HEIGHT}
      viewBox={`0 0 ${SOURCE_WIDTH} ${SOURCE_HEIGHT}`}
      style={{position: 'absolute', inset: 0}}
      aria-label="一件无字服务折页沿中央折轴展开"
    >
      <defs>
        <PaperTexture id="p04-paper" href={texture} />
        <filter id="p04-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="10" dy="14" stdDeviation="11" floodColor="#07182c" floodOpacity="0.38" />
        </filter>
      </defs>
      <ellipse
        cx={mix(845, 846, progress)}
        cy={mix(579, 589, progress)}
        rx={mix(82, 130, progress)}
        ry={mix(25, 23, progress)}
        fill="#07192c"
        opacity={0.13}
      />
      <polygon points={leftThickness} fill="#c9af82" opacity={0.9} />
      <polygon points={rightThickness} fill="#b99b6c" opacity={0.86} />
      <g filter="url(#p04-shadow)">
        <polygon points={left} fill="url(#p04-paper)" />
        <polygon points={right} fill="url(#p04-paper)" />
      </g>
      <line
        x1={seamTop[0]}
        y1={seamTop[1]}
        x2={seamBottom[0]}
        y2={seamBottom[1]}
        stroke="#cdb58f"
        strokeWidth={2.2}
        opacity={0.88}
      />
    </svg>
  );
};

export const P04B11LocalDeterministic: React.FC = () => {
  const frame = useCurrentFrame();
  const start = 30;
  const end = 144;
  const base = asset('P04_B11_first-frame-text-baked.png');
  const clean = asset('P04_B11_clean-plate.png');
  const progress = continuousProgress(frame, start, end);

  return (
    <Stage>
      {frame < start ? (
        <FullFrame src={base} />
      ) : (
        <>
          <FullFrame src={clean} />
          <P04Book progress={progress} />
        </>
      )}
    </Stage>
  );
};

const PhotoCutout = ({
  src,
  clipPath,
  translateX = 0,
}: {
  src: string;
  clipPath: string;
  translateX?: number;
}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      width: SOURCE_WIDTH,
      height: SOURCE_HEIGHT,
      clipPath,
      transform: `translateX(${translateX}px)`,
    }}
  >
    <FullFrame src={src} />
  </div>
);

const P05WorkBook = ({
  unfoldProgress,
  slideProgress,
}: {
  unfoldProgress: number;
  slideProgress: number;
}) => {
  const texture = asset('P05-paper-texture.png');
  const slideX = mix(0, 565, slideProgress);
  const slideY = mix(0, 34, slideProgress);

  const leftStart: readonly Point[] = [
    [700, 482],
    [758, 476],
    [758, 551],
    [697, 553],
  ];
  const rightStart: readonly Point[] = [
    [704, 484],
    [758, 476],
    [758, 551],
    [701, 554],
  ];
  const leftEnd: readonly Point[] = [
    [685, 493],
    [812, 478],
    [812, 568],
    [675, 558],
  ];
  const rightEnd: readonly Point[] = [
    [812, 478],
    [948, 491],
    [958, 557],
    [812, 568],
  ];

  const offset = (points: readonly Point[]) =>
    points.map(([x, y]) => [x + slideX, y + slideY] as const);
  const left = interpolatePolygon(
    offset(leftStart),
    offset(leftEnd),
    unfoldProgress,
  );
  const right = interpolatePolygon(
    offset(rightStart),
    offset(rightEnd),
    unfoldProgress,
  );
  const leftThickness = interpolatePolygon(
    offset(leftStart.map(([x, y]) => [x, y + 5] as const)),
    offset(leftEnd.map(([x, y]) => [x, y + 5] as const)),
    unfoldProgress,
  );
  const rightThickness = interpolatePolygon(
    offset(rightStart.map(([x, y]) => [x, y + 5] as const)),
    offset(rightEnd.map(([x, y]) => [x, y + 5] as const)),
    unfoldProgress,
  );
  const seamTop: Point = [
    mix(758, 812, unfoldProgress) + slideX,
    mix(476, 478, unfoldProgress) + slideY,
  ];
  const seamBottom: Point = [
    mix(758, 812, unfoldProgress) + slideX,
    mix(551, 568, unfoldProgress) + slideY,
  ];

  return (
    <svg
      width={SOURCE_WIDTH}
      height={SOURCE_HEIGHT}
      viewBox={`0 0 ${SOURCE_WIDTH} ${SOURCE_HEIGHT}`}
      style={{position: 'absolute', inset: 0}}
      aria-label="一件无字作品折页先展开，再整体移入下一次尝试承台"
    >
      <defs>
        <PaperTexture id="p05-paper" href={texture} />
        <filter id="p05-shadow" x="-30%" y="-40%" width="170%" height="200%">
          <feDropShadow dx="9" dy="12" stdDeviation="10" floodColor="#07192d" floodOpacity="0.34" />
        </filter>
      </defs>
      <ellipse
        cx={mix(757, 817, unfoldProgress) + slideX}
        cy={mix(554, 574, unfoldProgress) + slideY}
        rx={mix(74, 142, unfoldProgress)}
        ry={mix(16, 20, unfoldProgress)}
        fill="#07192c"
        opacity={0.12}
      />
      <polygon points={leftThickness} fill="#cfb182" />
      <polygon points={rightThickness} fill="#bc9968" />
      <g filter="url(#p05-shadow)">
        <polygon points={left} fill="url(#p05-paper)" />
        <polygon points={right} fill="url(#p05-paper)" />
      </g>
      <line
        x1={seamTop[0]}
        y1={seamTop[1]}
        x2={seamBottom[0]}
        y2={seamBottom[1]}
        stroke="#c9ad81"
        strokeWidth={2.2}
      />
    </svg>
  );
};

export const P05B15LocalDeterministic: React.FC = () => {
  const frame = useCurrentFrame();
  const base = asset('P05_B15_first-frame-text-baked.png');
  const clean = asset('P05_B15_clean-plate.png');

  const reserveStart = 24;
  const reserveEnd = 66;
  const unfoldStart = 81;
  const unfoldEnd = 120;
  const slideStart = 132;
  const slideEnd = 168;

  const reserveProgress = continuousProgress(
    frame,
    reserveStart,
    reserveEnd,
  );
  const unfoldProgress = continuousProgress(
    frame,
    unfoldStart,
    unfoldEnd,
  );
  const slideProgress = continuousProgress(frame, slideStart, slideEnd);
  const reserveX = mix(0, -184, reserveProgress);

  return (
    <Stage>
      {frame < reserveStart ? (
        <FullFrame src={base} />
      ) : (
        <>
          <FullFrame src={clean} />

          <PhotoCutout
            src={base}
            clipPath="polygon(19.8% 42.3%, 29.9% 42.3%, 29.5% 49.6%, 19.6% 49.6%)"
            translateX={reserveX}
          />

          <P05WorkBook
            unfoldProgress={unfoldProgress}
            slideProgress={slideProgress}
          />

          <PhotoCutout
            src={base}
            clipPath="polygon(4.0% 41.2%, 20.5% 41.2%, 20.2% 50.5%, 4.0% 50.5%)"
          />

          <PhotoCutout
            src={base}
            clipPath="polygon(72.5% 63.2%, 96.1% 63.2%, 96.1% 65.8%, 72.5% 65.8%)"
          />
        </>
      )}
    </Stage>
  );
};
