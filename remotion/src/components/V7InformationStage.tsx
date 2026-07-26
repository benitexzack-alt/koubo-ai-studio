import {Video} from '@remotion/media';
import React, {type CSSProperties} from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

const tones = {
  cyan: '#62D8FF',
  amber: '#FFBE55',
  green: '#67D8A0',
  red: '#FF6B64',
  white: '#F7FAFC',
};

export type V7Tone = keyof typeof tones;

const enterProgress = (frame: number, fps: number, delay = 0) =>
  spring({
    fps,
    frame: frame - delay,
    config: {damping: 20, stiffness: 185, mass: 0.8},
  });

const useSceneOpacity = (fadeFrames = 10) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return Math.min(
    interpolate(frame, [0, fadeFrames], [0, 1], clamp),
    interpolate(frame, [Math.max(fadeFrames, durationInFrames - fadeFrames), durationInFrames], [1, 0], clamp),
  );
};

export const V7LocalContrastVeil: React.FC<{
  side?: 'left' | 'right';
  strength?: number;
  width?: number;
}> = ({side = 'left', strength = 0.56, width = 930}) => {
  const solid = `rgba(2, 7, 12, ${strength})`;
  const transparent = 'rgba(2, 7, 12, 0)';
  return (
    <div
      style={{
        position: 'absolute',
        top: -70,
        bottom: -70,
        [side]: 0,
        width,
        pointerEvents: 'none',
        background:
          side === 'left'
            ? `linear-gradient(90deg, ${solid} 0%, rgba(2, 7, 12, ${strength * 0.62}) 46%, ${transparent} 100%)`
            : `linear-gradient(270deg, ${solid} 0%, rgba(2, 7, 12, ${strength * 0.62}) 46%, ${transparent} 100%)`,
        WebkitMaskImage:
          'linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)',
        maskImage:
          'linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)',
      }}
    />
  );
};

export type V7InfoItem = {
  label: string;
  detail: string;
  tone?: V7Tone;
  active?: boolean;
};

export const V7TransparentInfoStack: React.FC<{
  eyebrow: string;
  title: string;
  items: V7InfoItem[];
  style?: CSSProperties;
}> = ({eyebrow, title, items, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const titleIn = enterProgress(frame, fps, 2);

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 132,
        width: 650,
        color: tones.white,
        fontFamily,
        opacity,
        textShadow: '0 4px 22px rgba(0,0,0,0.96)',
        ...style,
      }}
    >
      <V7LocalContrastVeil strength={0.58} width={790} />
      <div style={{position: 'relative'}}>
        <div
          style={{
            color: tones.cyan,
            fontSize: 18,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: 0,
            opacity: titleIn,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            marginTop: 11,
            fontSize: 48,
            lineHeight: 1.08,
            fontWeight: 950,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [18, 0])}px)`,
          }}
        >
          {title}
        </div>
        <div style={{marginTop: 26, display: 'grid', gap: 16}}>
          {items.map((item, index) => {
            const progress = enterProgress(frame, fps, 10 + index * 12);
            const tone = tones[item.tone ?? (item.active ? 'amber' : 'cyan')];
            return (
              <div
                key={`${item.label}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '46px 1fr',
                  gap: 13,
                  alignItems: 'center',
                  minHeight: 60,
                  opacity: progress,
                  transform: `translateX(${interpolate(progress, [0, 1], [-20, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                    border: `1px solid ${tone}AA`,
                    background: `${tone}1F`,
                    boxShadow: `0 0 22px ${tone}22`,
                    color: tone,
                    fontSize: 16,
                    fontWeight: 950,
                  }}
                >
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div style={{borderLeft: `3px solid ${tone}`, paddingLeft: 13}}>
                  <div style={{color: tone, fontSize: 17, lineHeight: 1.1, fontWeight: 900}}>{item.label}</div>
                  <div style={{marginTop: 5, fontSize: 27, lineHeight: 1.18, fontWeight: 900}}>{item.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const V7HeroMetric: React.FC<{
  eyebrow: string;
  prefix?: string;
  value: string;
  suffix?: string;
  caption: string;
  facts?: string[];
  tone?: V7Tone;
  style?: CSSProperties;
}> = ({eyebrow, prefix, value, suffix, caption, facts = [], tone = 'amber', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const metricIn = enterProgress(frame, fps, 5);
  const accent = tones[tone];
  const underline = interpolate(frame, [8, 28], [0, 1], clamp);

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 176,
        width: 720,
        color: tones.white,
        fontFamily,
        opacity,
        textShadow: '0 5px 24px rgba(0,0,0,0.98)',
        ...style,
      }}
    >
      <V7LocalContrastVeil strength={0.62} width={850} />
      <div style={{position: 'relative'}}>
        <div style={{color: tones.cyan, fontSize: 18, fontWeight: 900}}>{eyebrow}</div>
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'baseline',
            color: accent,
            lineHeight: 1,
            opacity: metricIn,
            transform: `translateY(${interpolate(metricIn, [0, 1], [24, 0])}px) scale(${interpolate(metricIn, [0, 1], [0.93, 1])})`,
            transformOrigin: 'left bottom',
          }}
        >
          {prefix ? <span style={{fontSize: 52, fontWeight: 950, marginRight: 8}}>{prefix}</span> : null}
          <span style={{fontSize: 112, fontWeight: 950}}>{value}</span>
          {suffix ? <span style={{fontSize: 40, fontWeight: 950, marginLeft: 10}}>{suffix}</span> : null}
        </div>
        <div style={{marginTop: 10, width: `${underline * 510}px`, height: 5, background: accent, boxShadow: `0 0 18px ${accent}88`}} />
        <div style={{marginTop: 18, fontSize: 35, lineHeight: 1.18, fontWeight: 950}}>{caption}</div>
        {facts.length ? (
          <div style={{marginTop: 18, display: 'grid', gap: 10}}>
            {facts.slice(0, 3).map((fact, index) => {
              const itemIn = enterProgress(frame, fps, 18 + index * 10);
              return (
                <div
                  key={`${fact}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '12px 1fr',
                    gap: 12,
                    alignItems: 'center',
                    color: 'rgba(247,250,252,0.90)',
                    fontSize: 22,
                    lineHeight: 1.2,
                    fontWeight: 850,
                    opacity: itemIn,
                  }}
                >
                  <div style={{width: 9, height: 9, background: index === 0 ? accent : tones.cyan, transform: 'rotate(45deg)'}} />
                  <div>{fact}</div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export type V7MediaFact = {
  label: string;
  value: string;
  tone?: V7Tone;
};

export const V7AnnotatedMediaStage: React.FC<{
  index: string;
  eyebrow: string;
  title: string;
  facts: V7MediaFact[];
  mediaSrc: string;
  mediaKind: 'video' | 'image';
  mediaLabel: string;
  mediaFit?: 'cover' | 'contain';
  mediaLoop?: boolean;
  motionPreset?: 'v71' | 'v72';
}> = ({
  index,
  eyebrow,
  title,
  facts,
  mediaSrc,
  mediaKind,
  mediaLabel,
  mediaFit = 'cover',
  mediaLoop = false,
  motionPreset = 'v71',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneOpacity(8);
  const railIn = enterProgress(frame, fps, 0);
  const mediaIn = enterProgress(frame, fps, 5);
  const mediaScale =
    motionPreset === 'v72'
      ? interpolate(
          frame,
          [0, 72, 300],
          mediaFit === 'contain'
            ? [1.015, 1.055, 1.04]
            : [1.025, 1.08, 1.055],
          {...clamp, easing: Easing.inOut(Easing.cubic)},
        )
      : interpolate(frame, [0, 180], [1.025, 1.065], clamp);
  const mediaX =
    motionPreset === 'v72'
      ? interpolate(
          frame,
          [0, 72, 300],
          mediaFit === 'contain' ? [0, -8, -3] : [0, -16, -6],
          {...clamp, easing: Easing.inOut(Easing.cubic)},
        )
      : 0;
  const mediaY =
    motionPreset === 'v72'
      ? interpolate(
          frame,
          [0, 72, 300],
          mediaFit === 'contain' ? [0, -4, -1] : [0, -7, -2],
          {...clamp, easing: Easing.inOut(Easing.cubic)},
        )
      : 0;
  const mediaTransform = `translate3d(${mediaX}px, ${mediaY}px, 0) scale(${mediaScale})`;

  return (
    <AbsoluteFill style={{fontFamily, color: tones.white, opacity}}>
      <AbsoluteFill style={{background: 'rgba(2,7,12,0.24)'}} />
      <V7LocalContrastVeil strength={0.74} width={600} />
      <div
        style={{
          position: 'absolute',
          left: 62,
          top: 142,
          width: 350,
          height: 670,
          opacity: railIn,
          transform: `translateX(${interpolate(railIn, [0, 1], [-22, 0])}px)`,
          textShadow: '0 4px 20px rgba(0,0,0,0.98)',
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
          <div style={{color: tones.cyan, fontSize: 62, lineHeight: 1, fontWeight: 950}}>{index}</div>
          <div style={{color: tones.cyan, fontSize: 16, fontWeight: 900}}>{eyebrow}</div>
        </div>
        <div style={{marginTop: 10, fontSize: 34, lineHeight: 1.14, fontWeight: 950}}>{title}</div>
        <div style={{marginTop: 25, display: 'grid', gap: 18}}>
          {facts.slice(0, 4).map((fact, factIndex) => {
            const factIn = enterProgress(frame, fps, 10 + factIndex * 12);
            const tone = tones[fact.tone ?? (factIndex === facts.length - 1 ? 'amber' : 'white')];
            return (
              <div key={`${fact.label}-${factIndex}`} style={{opacity: factIn, borderLeft: `3px solid ${tone}`, paddingLeft: 12}}>
                <div style={{color: 'rgba(247,250,252,0.62)', fontSize: 15, lineHeight: 1.1, fontWeight: 850}}>{fact.label}</div>
                <div style={{marginTop: 4, color: tone, fontSize: 27, lineHeight: 1.1, fontWeight: 950}}>{fact.value}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 456,
          top: 120,
          width: 1400,
          height: 788,
          overflow: 'hidden',
          boxSizing: 'border-box',
          border: '1px solid rgba(98,216,255,0.52)',
          background: '#05090E',
          boxShadow: '0 24px 70px rgba(0,0,0,0.56), 0 0 30px rgba(98,216,255,0.10)',
          opacity: mediaIn,
          transform: `translateY(${interpolate(mediaIn, [0, 1], [18, 0])}px)`,
        }}
      >
        {mediaKind === 'video' ? (
          <Video
            src={staticFile(mediaSrc)}
            muted
            loop={mediaLoop}
            objectFit={mediaFit}
            style={{
              width: '100%',
              height: '100%',
              transform: mediaTransform,
              transformOrigin: '50% 48%',
            }}
          />
        ) : (
          <Img
            src={staticFile(mediaSrc)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: mediaFit,
              transform: mediaTransform,
              transformOrigin: '50% 48%',
            }}
          />
        )}
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(3,8,12,0.06), rgba(3,8,12,0) 58%, rgba(3,8,12,0.42))'}} />
        <div
          style={{
            position: 'absolute',
            right: 18,
            bottom: 16,
            padding: '7px 11px',
            background: 'rgba(3,8,12,0.72)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(247,250,252,0.84)',
            fontSize: 16,
            fontWeight: 850,
          }}
        >
          {mediaLabel}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const V7TruthStatement: React.FC<{
  eyebrow: string;
  left: string;
  right: string;
  note: string;
}> = ({eyebrow, left, right, note}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const leftIn = enterProgress(frame, fps, 3);
  const rightIn = enterProgress(frame, fps, 17);
  const symbolIn = enterProgress(frame, fps, 10);

  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        top: 180,
        width: 930,
        color: tones.white,
        fontFamily,
        opacity,
        textShadow: '0 5px 25px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.66} width={1050} />
      <div style={{position: 'relative'}}>
        <div style={{color: tones.cyan, fontSize: 18, fontWeight: 900}}>{eyebrow}</div>
        <div style={{marginTop: 25, display: 'grid', gridTemplateColumns: '1fr 90px 1fr', alignItems: 'center', gap: 18}}>
          <div style={{color: tones.amber, fontSize: 48, lineHeight: 1.08, fontWeight: 950, opacity: leftIn}}>{left}</div>
          <div style={{color: tones.red, fontSize: 70, lineHeight: 1, fontWeight: 950, textAlign: 'center', opacity: symbolIn}}>≠</div>
          <div style={{fontSize: 42, lineHeight: 1.1, fontWeight: 950, opacity: rightIn}}>{right}</div>
        </div>
        <div style={{marginTop: 27, width: 720, borderTop: `3px solid ${tones.red}`, paddingTop: 17, color: 'rgba(247,250,252,0.88)', fontSize: 25, lineHeight: 1.28, fontWeight: 850}}>{note}</div>
      </div>
    </div>
  );
};

export const V7ChapterMarker: React.FC<{
  index: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  tone?: V7Tone;
  style?: CSSProperties;
}> = ({index, eyebrow, title, subtitle, tone = 'cyan', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const indexIn = enterProgress(frame, fps, 0);
  const titleIn = enterProgress(frame, fps, 8);
  const lineProgress = interpolate(frame, [12, 34], [0, 1], clamp);
  const accent = tones[tone];

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 148,
        width: 1040,
        color: tones.white,
        fontFamily,
        opacity,
        textShadow: '0 5px 28px rgba(0,0,0,0.98)',
        ...style,
      }}
    >
      <V7LocalContrastVeil strength={0.64} width={1160} />
      <div style={{position: 'relative'}}>
        <div style={{display: 'flex', alignItems: 'flex-end', gap: 24}}>
          <div
            style={{
              color: accent,
              fontSize: 164,
              lineHeight: 0.82,
              fontWeight: 950,
              opacity: indexIn,
              transform: `translateY(${interpolate(indexIn, [0, 1], [28, 0])}px)`,
            }}
          >
            {index}
          </div>
          <div style={{paddingBottom: 9, opacity: titleIn}}>
            <div style={{color: accent, fontSize: 18, fontWeight: 950}}>{eyebrow}</div>
            <div style={{marginTop: 11, fontSize: 58, lineHeight: 1.06, fontWeight: 950}}>{title}</div>
          </div>
        </div>
        <div
          style={{
            marginTop: 28,
            width: `${lineProgress * 760}px`,
            height: 4,
            background: `linear-gradient(90deg, ${accent}, rgba(98,216,255,0))`,
            boxShadow: `0 0 18px ${accent}66`,
          }}
        />
        <div
          style={{
            marginTop: 18,
            width: 820,
            color: 'rgba(247,250,252,0.90)',
            fontSize: 29,
            lineHeight: 1.28,
            fontWeight: 850,
            opacity: titleIn,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
};

export type V7ProcessStep = {
  label: string;
  detail: string;
  tone?: V7Tone;
};

export const V7ProcessRail: React.FC<{
  eyebrow: string;
  title: string;
  steps: V7ProcessStep[];
  style?: CSSProperties;
}> = ({eyebrow, title, steps, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const titleIn = enterProgress(frame, fps, 2);
  const beadProgress = (frame % 48) / 47;

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 146,
        width: 1160,
        color: tones.white,
        fontFamily,
        opacity,
        textShadow: '0 4px 24px rgba(0,0,0,0.98)',
        ...style,
      }}
    >
      <V7LocalContrastVeil strength={0.61} width={1280} />
      <div style={{position: 'relative'}}>
        <div style={{color: tones.cyan, fontSize: 18, fontWeight: 950, opacity: titleIn}}>{eyebrow}</div>
        <div style={{marginTop: 10, fontSize: 48, lineHeight: 1.08, fontWeight: 950, opacity: titleIn}}>{title}</div>
        <div style={{marginTop: 40, display: 'flex', alignItems: 'stretch'}}>
          {steps.slice(0, 4).map((step, index) => {
            const stepIn = enterProgress(frame, fps, 10 + index * 11);
            const accent = tones[step.tone ?? (index === steps.length - 1 ? 'green' : 'cyan')];
            return (
              <React.Fragment key={`${step.label}-${index}`}>
                <div
                  style={{
                    width: 244,
                    minHeight: 205,
                    boxSizing: 'border-box',
                    padding: '18px 18px 20px',
                    borderTop: `3px solid ${accent}`,
                    borderLeft: `1px solid ${accent}88`,
                    borderRight: `1px solid ${accent}44`,
                    borderBottom: `1px solid ${accent}44`,
                    background: 'rgba(3,9,14,0.30)',
                    boxShadow: `0 0 28px ${accent}16`,
                    opacity: stepIn,
                    transform: `translateY(${interpolate(stepIn, [0, 1], [20, 0])}px)`,
                  }}
                >
                  <div style={{color: accent, fontSize: 16, fontWeight: 950}}>{String(index + 1).padStart(2, '0')}</div>
                  <div style={{marginTop: 14, color: accent, fontSize: 24, lineHeight: 1.08, fontWeight: 950}}>{step.label}</div>
                  <div style={{marginTop: 12, fontSize: 26, lineHeight: 1.22, fontWeight: 900}}>{step.detail}</div>
                </div>
                {index < Math.min(steps.length, 4) - 1 ? (
                  <div
                    style={{
                      position: 'relative',
                      width: 54,
                      height: 205,
                      flexShrink: 0,
                      opacity: stepIn,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 7,
                        right: 9,
                        top: 101,
                        height: 2,
                        background: 'rgba(98,216,255,0.55)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        right: 5,
                        top: 96,
                        width: 10,
                        height: 10,
                        borderTop: '2px solid rgba(98,216,255,0.78)',
                        borderRight: '2px solid rgba(98,216,255,0.78)',
                        transform: 'rotate(45deg)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 7 + beadProgress * 34,
                        top: 97,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: tones.cyan,
                        boxShadow: `0 0 16px ${tones.cyan}`,
                      }}
                    />
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const V7EvidenceQuote: React.FC<{
  source: string;
  quote: string;
  caption: string;
  marker?: string;
  tone?: V7Tone;
  style?: CSSProperties;
}> = ({source, quote, caption, marker = 'SOURCE', tone = 'cyan', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const panelIn = enterProgress(frame, fps, 4);
  const accent = tones[tone];
  const scan = interpolate(frame % 90, [0, 89], [-120, 880], clamp);

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 168,
        width: 900,
        color: tones.white,
        fontFamily,
        opacity,
        textShadow: '0 4px 22px rgba(0,0,0,0.96)',
        ...style,
      }}
    >
      <V7LocalContrastVeil strength={0.64} width={1040} />
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          padding: '25px 28px 28px',
          border: `1px solid ${accent}88`,
          borderLeft: `5px solid ${accent}`,
          background: 'rgba(3,9,14,0.48)',
          boxShadow: `0 20px 58px rgba(0,0,0,0.42), 0 0 30px ${accent}18`,
          opacity: panelIn,
          transform: `translateY(${interpolate(panelIn, [0, 1], [20, 0])}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: scan,
            width: 120,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)',
            transform: 'skewX(-18deg)',
          }}
        />
        <div style={{position: 'relative'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18}}>
            <div style={{color: accent, fontSize: 16, fontWeight: 950}}>{marker}</div>
            <div style={{color: 'rgba(247,250,252,0.60)', fontSize: 15, fontWeight: 850}}>{source}</div>
          </div>
          <div style={{marginTop: 24, fontSize: 42, lineHeight: 1.24, fontWeight: 950}}>“{quote}”</div>
          <div
            style={{
              marginTop: 24,
              paddingTop: 17,
              borderTop: `2px solid ${accent}77`,
              color: 'rgba(247,250,252,0.86)',
              fontSize: 25,
              lineHeight: 1.28,
              fontWeight: 850,
            }}
          >
            {caption}
          </div>
        </div>
      </div>
    </div>
  );
};
