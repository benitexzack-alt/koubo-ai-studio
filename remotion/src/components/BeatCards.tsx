import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {Beat} from '../data/story';
import {colors, fontFamily} from '../styles';

const panelBg = 'rgba(4, 9, 18, 0.82)';
const dimText = 'rgba(247,250,255,0.72)';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const CardShell: React.FC<{
  beat: Beat;
  index: number;
  children: React.ReactNode;
}> = ({beat, index, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;
  const side = beat.side ?? 'left';
  const localFrame = frame - beat.start * fps;
  const enter = spring({
    frame: Math.max(0, localFrame),
    fps,
    config: {damping: 22, stiffness: 170},
  });
  const exit = interpolate(seconds, [beat.end - 0.35, beat.end], [1, 0], clamp);
  const drift = interpolate(seconds, [beat.start, beat.end], [0, side === 'left' ? 16 : -16], clamp);
  const width = beat.variant === 'flow' || beat.variant === 'compare' ? 690 : 590;
  const xFrom = side === 'left' ? -96 : 96;
  const left = side === 'left' ? 66 : 1920 - width - 66;
  const top = 112 + (index % 2) * 18;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        borderRadius: 14,
        background: panelBg,
        border: `1px solid ${(beat.accent ?? colors.cyan)}99`,
        boxShadow: `0 22px 72px rgba(0,0,0,0.42), 0 0 44px ${(beat.accent ?? colors.cyan)}35`,
        opacity: exit,
        overflow: 'hidden',
        transform: `translateX(${interpolate(enter, [0, 1], [xFrom, drift])}px) scale(${interpolate(enter, [0, 1], [0.96, 1])})`,
        fontFamily,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          background: beat.accent ?? colors.cyan,
          boxShadow: `0 0 24px ${(beat.accent ?? colors.cyan)}AA`,
        }}
      />
      {children}
    </div>
  );
};

const Label: React.FC<{beat: Beat}> = ({beat}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      minHeight: 32,
      padding: '0 12px',
      borderRadius: 8,
      background: `${beat.accent ?? colors.cyan}1F`,
      color: beat.accent ?? colors.cyan,
      fontSize: 21,
      lineHeight: 1,
      fontWeight: 900,
      letterSpacing: 0,
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 99,
        background: beat.accent ?? colors.cyan,
      }}
    />
    {beat.eyebrow}
  </div>
);

const StatementCard: React.FC<{beat: Beat}> = ({beat}) => (
  <div style={{padding: '24px 30px 28px'}}>
    <Label beat={beat} />
    <div
      style={{
        marginTop: 18,
        color: colors.ink,
        fontSize: 50,
        lineHeight: 1.08,
        fontWeight: 950,
        letterSpacing: 0,
      }}
    >
      {beat.title}
    </div>
    <div
      style={{
        marginTop: 14,
        color: dimText,
        fontSize: 27,
        lineHeight: 1.35,
        fontWeight: 760,
      }}
    >
      {beat.detail}
    </div>
    {beat.items && (
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20}}>
        {beat.items.map((item) => (
          <span
            key={item}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: colors.ink,
              fontSize: 22,
              fontWeight: 850,
            }}
          >
            {item}
          </span>
        ))}
      </div>
    )}
  </div>
);

const CompareCard: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pulse = interpolate(Math.sin((frame / fps) * Math.PI * 1.6), [-1, 1], [0.72, 1]);

  return (
    <div style={{padding: '24px 28px 28px'}}>
      <Label beat={beat} />
      <div
        style={{
          marginTop: 18,
          color: colors.ink,
          fontSize: 45,
          lineHeight: 1.08,
          fontWeight: 950,
        }}
      >
        {beat.title}
      </div>
      <div style={{display: 'flex', alignItems: 'stretch', gap: 16, marginTop: 20}}>
        <ComparePanel
          label={beat.leftLabel ?? '错误路径'}
          text={beat.leftText ?? ''}
          color="#FF5C7A"
          muted
        />
        <div
          style={{
            width: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: beat.accent ?? colors.cyan,
            fontSize: 34,
            fontWeight: 950,
            opacity: pulse,
          }}
        >
          →
        </div>
        <ComparePanel
          label={beat.rightLabel ?? '正确路径'}
          text={beat.rightText ?? ''}
          color={beat.accent ?? colors.cyan}
        />
      </div>
    </div>
  );
};

const ComparePanel: React.FC<{label: string; text: string; color: string; muted?: boolean}> = ({
  label,
  text,
  color,
  muted,
}) => (
  <div
    style={{
      flex: 1,
      minHeight: 122,
      borderRadius: 12,
      padding: '16px 18px',
      background: muted ? 'rgba(255,92,122,0.1)' : `${color}1A`,
      border: `1px solid ${color}88`,
    }}
  >
    <div style={{color, fontSize: 20, fontWeight: 950}}>{label}</div>
    <div style={{marginTop: 14, color: colors.ink, fontSize: 27, lineHeight: 1.22, fontWeight: 900}}>
      {text}
    </div>
  </div>
);

const ChecklistCard: React.FC<{beat: Beat}> = ({beat}) => (
  <div style={{padding: '24px 30px 28px'}}>
    <Label beat={beat} />
    <div style={{marginTop: 18, color: colors.ink, fontSize: 45, lineHeight: 1.1, fontWeight: 950}}>
      {beat.title}
    </div>
    <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 18}}>
      {(beat.items ?? []).map((item, itemIndex) => (
        <div
          key={item}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: 44,
            padding: '0 14px',
            borderRadius: 9,
            background: itemIndex % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            color: colors.ink,
            fontSize: 24,
            fontWeight: 850,
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 99,
              border: `3px solid ${beat.accent ?? colors.cyan}`,
              boxShadow: `0 0 18px ${(beat.accent ?? colors.cyan)}66`,
            }}
          />
          {item}
        </div>
      ))}
    </div>
  </div>
);

const FlowCard: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = interpolate(frame / fps, [beat.start, beat.end], [0, 1], clamp);
  const steps = beat.steps ?? [];

  return (
    <div style={{padding: '24px 28px 30px'}}>
      <Label beat={beat} />
      <div style={{marginTop: 18, color: colors.ink, fontSize: 43, lineHeight: 1.08, fontWeight: 950}}>
        {beat.title}
      </div>
      <div style={{position: 'relative', marginTop: 24, padding: '8px 0'}}>
        <div
          style={{
            position: 'absolute',
            left: 18,
            right: 18,
            top: 34,
            height: 4,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.14)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: 34,
            height: 4,
            width: `${progress * 92}%`,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${colors.cyan}, ${beat.accent ?? colors.yellow})`,
            boxShadow: `0 0 26px ${(beat.accent ?? colors.cyan)}88`,
          }}
        />
        <div style={{display: 'grid', gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 10}}>
          {steps.map((step, index) => {
            const active = progress >= index / Math.max(1, steps.length - 1) - 0.02;
            return (
              <div key={step} style={{textAlign: 'center'}}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    margin: '0 auto 12px',
                    borderRadius: 99,
                    background: active ? beat.accent ?? colors.cyan : 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    boxShadow: active ? `0 0 24px ${(beat.accent ?? colors.cyan)}88` : 'none',
                  }}
                />
                <div style={{color: active ? colors.ink : dimText, fontSize: 21, lineHeight: 1.18, fontWeight: 900}}>
                  {step}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{marginTop: 18, color: dimText, fontSize: 24, lineHeight: 1.32, fontWeight: 760}}>
        {beat.detail}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = Math.max(0, frame - beat.start * fps);
  const amount = interpolate(local, [0, 42], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{padding: '24px 30px 28px'}}>
      <Label beat={beat} />
      <div style={{display: 'flex', gap: 24, alignItems: 'center', marginTop: 18}}>
        <div
          style={{
            width: 154,
            height: 154,
            borderRadius: 999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: `conic-gradient(${beat.accent ?? colors.cyan} ${amount * 270}deg, rgba(255,255,255,0.1) 0deg)`,
            boxShadow: `0 0 34px ${(beat.accent ?? colors.cyan)}44`,
          }}
        >
          <div
            style={{
              width: 126,
              height: 126,
              borderRadius: 999,
              background: '#050A12',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{color: dimText, fontSize: 20, fontWeight: 900}}>{beat.metricLabel ?? '验证'}</div>
            <div style={{color: colors.ink, fontSize: 29, fontWeight: 950}}>{beat.metricValue ?? '1 个结果'}</div>
          </div>
        </div>
        <div style={{flex: 1}}>
          <div style={{color: colors.ink, fontSize: 43, lineHeight: 1.08, fontWeight: 950}}>{beat.title}</div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16}}>
            {(beat.items ?? []).map((item) => (
              <span
                key={item}
                style={{
                  padding: '8px 11px',
                  borderRadius: 8,
                  background: `${beat.accent ?? colors.cyan}18`,
                  color: colors.ink,
                  border: `1px solid ${(beat.accent ?? colors.cyan)}66`,
                  fontSize: 21,
                  fontWeight: 850,
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const KeywordPopOverlay: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;
  const local = Math.max(0, frame - beat.start * fps);
  const enter = spring({frame: local, fps, config: {damping: 18, stiffness: 220}});
  const exit = interpolate(seconds, [beat.end - 0.22, beat.end], [1, 0], clamp);
  const accent = beat.accent ?? colors.yellow;
  const side = beat.side ?? 'left';
  const left = side === 'right' ? 1220 : 84;
  const top = 420;
  const shimmer = interpolate(Math.sin(seconds * Math.PI * 2.6), [-1, 1], [0.55, 1]);
  const titleLength = [...beat.title].filter((char) => char.trim().length > 0).length;
  const titleFontSize = titleLength > 13 ? 39 : titleLength > 8 ? 43 : 48;
  const pulse = interpolate(Math.sin(seconds * Math.PI * 4.2), [-1, 1], [0.86, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: 585,
        padding: '17px 22px 19px',
        borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(4,9,18,0.9), rgba(7,16,28,0.78))',
        border: `1px solid ${accent}AA`,
        boxShadow: `0 18px 54px rgba(0,0,0,0.42), 0 0 ${Math.round(28 * shimmer)}px ${accent}66`,
        opacity: exit,
        overflow: 'hidden',
        transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px) scale(${interpolate(enter, [0, 1], [0.93, 1])})`,
        fontFamily,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 7,
          background: accent,
          boxShadow: `0 0 30px ${accent}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 18,
          top: 18,
          width: 54,
          height: 54,
          borderRadius: 999,
          border: `2px solid ${accent}88`,
          opacity: 0.72,
          transform: `scale(${pulse})`,
          boxShadow: `0 0 22px ${accent}44`,
        }}
      />
      <div
        style={{
          position: 'relative',
          color: accent,
          fontSize: 20,
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: 0,
        }}
      >
        {beat.eyebrow}
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: 10,
          color: colors.ink,
          fontSize: titleFontSize,
          lineHeight: 1.04,
          fontWeight: 950,
          letterSpacing: 0,
          textShadow: `0 0 24px ${accent}44, 0 3px 10px rgba(0,0,0,0.9)`,
        }}
      >
        {beat.title}
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: 10,
          height: 4,
          width: `${interpolate(enter, [0, 1], [18, 100])}%`,
          borderRadius: 99,
          background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.84))`,
          boxShadow: `0 0 18px ${accent}99`,
        }}
      />
      {beat.detail ? (
        <div
          style={{
            position: 'relative',
            marginTop: 10,
            color: dimText,
            fontSize: 24,
            lineHeight: 1.26,
            fontWeight: 780,
          }}
        >
          {beat.detail}
        </div>
      ) : null}
    </div>
  );
};

const OcrCalloutOverlay: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = Math.max(0, frame - beat.start * fps);
  const seconds = frame / fps;
  const exit = interpolate(seconds, [beat.end - 0.3, beat.end], [1, 0], clamp);
  const canvas = beat.canvas ?? {width: 1920, height: 1080};
  const accent = beat.accent ?? colors.yellow;
  const scaleX = 1920 / canvas.width;
  const scaleY = 1080 / canvas.height;

  return (
    <AbsoluteFill style={{opacity: exit, fontFamily}}>
      {(beat.callouts ?? []).map((callout, index) => {
        const padding = callout.padding ?? 12;
        const left = (callout.box.x - padding) * scaleX;
        const top = (callout.box.y - padding) * scaleY;
        const width = (callout.box.width + padding * 2) * scaleX;
        const height = (callout.box.height + padding * 2) * scaleY;
        const labelSide = left + width > 1500 ? 'left' : 'right';
        const labelLeft = labelSide === 'left' ? left - 260 : left + width + 24;
        const labelTop = Math.max(76, top - 6);
        const delay = index * 8;
        const itemEnter = interpolate(Math.max(0, local - delay), [0, 18], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        });

        return (
          <React.Fragment key={`${callout.text}-${index}`}>
            <div
              style={{
                position: 'absolute',
                left,
                top,
                width,
                height,
                borderRadius: 12,
                border: `5px solid ${accent}`,
                boxShadow: `0 0 28px ${accent}99, inset 0 0 28px ${accent}33`,
                background: `${accent}12`,
                opacity: itemEnter,
                transform: `scale(${interpolate(itemEnter, [0, 1], [0.88, 1])})`,
                transformOrigin: 'center',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: labelSide === 'left' ? labelLeft + 228 : left + width,
                top: top + height / 2,
                width: labelSide === 'left' ? left - labelLeft - 6 : labelLeft - (left + width) + 6,
                height: 3,
                borderRadius: 99,
                background: accent,
                boxShadow: `0 0 18px ${accent}88`,
                opacity: itemEnter,
                transform: `scaleX(${itemEnter})`,
                transformOrigin: labelSide === 'left' ? 'right' : 'left',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: labelLeft,
                top: labelTop,
                minWidth: 220,
                maxWidth: 280,
                padding: '14px 18px',
                borderRadius: 12,
                background: 'rgba(5,10,18,0.88)',
                border: `1px solid ${accent}AA`,
                boxShadow: `0 18px 54px rgba(0,0,0,0.44), 0 0 28px ${accent}33`,
                color: colors.ink,
                opacity: itemEnter,
                transform: `translateY(${interpolate(itemEnter, [0, 1], [18, 0])}px)`,
              }}
            >
              <div style={{color: accent, fontSize: 20, fontWeight: 950}}>{beat.eyebrow}</div>
              <div style={{marginTop: 6, fontSize: 28, lineHeight: 1.16, fontWeight: 950}}>
                {callout.label ?? callout.text}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

const renderBeat = (beat: Beat) => {
  switch (beat.variant) {
    case 'compare':
      return <CompareCard beat={beat} />;
    case 'checklist':
      return <ChecklistCard beat={beat} />;
    case 'flow':
      return <FlowCard beat={beat} />;
    case 'metric':
      return <MetricCard beat={beat} />;
    case 'ocr-callout':
      return <OcrCalloutOverlay beat={beat} />;
    case 'keyword-pop':
      return <KeywordPopOverlay beat={beat} />;
    case 'statement':
    default:
      return <StatementCard beat={beat} />;
  }
};

export const BeatCards: React.FC<{beats: Beat[]}> = ({beats}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {beats.map((beat, index) => {
        const active = seconds >= beat.start && seconds < beat.end;
        if (!active) {
          return null;
        }

        if (beat.variant === 'ocr-callout' || beat.variant === 'keyword-pop') {
          return <React.Fragment key={`${beat.start}-${beat.title}`}>{renderBeat(beat)}</React.Fragment>;
        }

        return (
          <CardShell key={`${beat.start}-${beat.title}`} beat={beat} index={index}>
            {renderBeat(beat)}
          </CardShell>
        );
      })}
    </AbsoluteFill>
  );
};
