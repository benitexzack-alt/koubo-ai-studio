import {Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  V72ProductionShell,
  type V72CustomScene,
  type V72ProductionConfig,
  type V72ProductionScene,
  type V72SfxCue,
} from './components/V72ProductionShell';
import sfxContract from './data/AICognitivePositionV73.sfx.v1.json';
import visualPlan from './data/AICognitivePositionV73.visual-plan.v1.json';

const fps = 30;
const durationSeconds = 305.968005;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const AI_COGNITIVE_POSITION_V73_DURATION_IN_FRAMES =
  f(durationSeconds);

type Tone = 'cyan' | 'amber' | 'green' | 'red' | 'white';

const colors: Record<Tone, string> = {
  cyan: '#62D8FF',
  amber: '#FFBE55',
  green: '#67D8A0',
  red: '#FF7068',
  white: '#F7FAFC',
};

type PlanParams = {
  component: string;
  title?: string;
  detail?: string;
  items?: string[];
  src?: string;
  disclosure?: string;
};

type PlanLayer = {
  id: string;
  start: number;
  end: number;
  title: string;
  detail: string;
  items: string[];
  params: PlanParams;
};

const layers = visualPlan.layers as PlanLayer[];

const sceneOpacity = (frame: number, durationInFrames: number) => {
  const fade = Math.min(10, Math.max(4, Math.round(durationInFrames * 0.1)));
  return Math.min(
    interpolate(frame, [0, fade], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(fade, durationInFrames - fade), durationInFrames],
      [1, 0],
      clamp,
    ),
  );
};

const useEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps: compositionFps,
    config: {damping: 21, stiffness: 184, mass: 0.82},
  });
};

const Panel: React.FC<{
  children: React.ReactNode;
  tone?: Tone;
  top?: number;
  width?: number;
}> = ({children, tone = 'cyan', top = 108, width = 622}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const enter = useEnter(1);
  const opacity = sceneOpacity(frame, durationInFrames);

  return (
    <div
      style={{
        position: 'absolute',
        left: 52,
        top,
        width,
        maxHeight: 650,
        boxSizing: 'border-box',
        padding: '25px 27px 28px',
        overflow: 'hidden',
        color: colors.white,
        fontFamily,
        background: 'rgba(3, 10, 16, 0.70)',
        borderLeft: `5px solid ${colors[tone]}`,
        boxShadow: '0 18px 48px rgba(0,0,0,0.30)',
        backdropFilter: 'blur(13px)',
        opacity,
        transform: `translateX(${interpolate(enter, [0, 1], [-30, 0])}px)`,
        textShadow: '0 4px 18px rgba(0,0,0,0.92)',
      }}
    >
      {children}
    </div>
  );
};

const Eyebrow: React.FC<{children: React.ReactNode; tone?: Tone}> = ({
  children,
  tone = 'cyan',
}) => (
  <div
    style={{
      color: colors[tone],
      fontSize: 18,
      lineHeight: 1.1,
      fontWeight: 950,
      letterSpacing: 0,
    }}
  >
    {children}
  </div>
);

const Title: React.FC<{children: string; tone?: Tone}> = ({
  children,
  tone = 'white',
}) => (
  <div
    style={{
      marginTop: 11,
      color: colors[tone],
      fontSize: [...children].length > 18 ? 42 : 49,
      lineHeight: 1.08,
      fontWeight: 950,
      letterSpacing: 0,
    }}
  >
    {children}
  </div>
);

const Detail: React.FC<{children?: string}> = ({children}) =>
  children ? (
    <div
      style={{
        marginTop: 16,
        color: 'rgba(247,250,252,0.78)',
        fontSize: 22,
        lineHeight: 1.3,
        fontWeight: 820,
      }}
    >
      {children}
    </div>
  ) : null;

const RowList: React.FC<{items: string[]; tones?: Tone[]}> = ({
  items,
  tones = ['cyan', 'amber', 'green', 'cyan'],
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{marginTop: 22, display: 'grid', gap: 0}}>
      {items.slice(0, 4).map((item, index) => {
        const enter = spring({
          frame: frame - 6 - index * 7,
          fps,
          config: {damping: 22, stiffness: 188, mass: 0.82},
        });
        const tone = tones[index % tones.length] ?? 'cyan';
        return (
          <div
            key={`${item}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '38px 1fr',
              minHeight: 56,
              alignItems: 'center',
              borderTop: index === 0 ? `1px solid ${colors[tone]}66` : '1px solid rgba(255,255,255,0.11)',
              opacity: enter,
              transform: `translateX(${interpolate(enter, [0, 1], [-18, 0])}px)`,
            }}
          >
            <div style={{color: colors[tone], fontSize: 16, fontWeight: 950}}>
              {String(index + 1).padStart(2, '0')}
            </div>
            <div style={{fontSize: 24, lineHeight: 1.18, fontWeight: 900}}>
              {item}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const StatementScene: React.FC<{layer: PlanLayer}> = ({layer}) => (
  <Panel tone={layer.params.component === 'definition' ? 'amber' : 'cyan'}>
    <Eyebrow tone={layer.params.component === 'definition' ? 'amber' : 'cyan'}>
      {layer.params.component === 'definition'
        ? 'DEFINITION · 关键定义'
        : 'KEY POINT · 重点判断'}
    </Eyebrow>
    <Title>{layer.title}</Title>
    <Detail>{layer.detail}</Detail>
    {layer.items.length ? <RowList items={layer.items} /> : null}
  </Panel>
);

const ComparisonScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const items = layer.items.slice(0, 3);
  return (
    <Panel tone="amber" top={120}>
      <Eyebrow tone="amber">CONTRAST · 对照</Eyebrow>
      <Title>{layer.title}</Title>
      <div style={{marginTop: 23, display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, items.length)}, 1fr)`, gap: 12}}>
        {items.map((item, index) => {
          const enter = spring({
            frame: frame - 7 - index * 8,
            fps,
            config: {damping: 21, stiffness: 186, mass: 0.84},
          });
          const tone: Tone = index === items.length - 1 ? 'green' : index === 1 ? 'amber' : 'cyan';
          return (
            <div
              key={item}
              style={{
                minHeight: 136,
                padding: '20px 15px 17px',
                boxSizing: 'border-box',
                borderTop: `4px solid ${colors[tone]}`,
                background: 'rgba(255,255,255,0.045)',
                opacity: enter,
                transform: `translateY(${interpolate(enter, [0, 1], [18, 0])}px)`,
              }}
            >
              <div style={{color: colors[tone], fontSize: 16, fontWeight: 950}}>
                0{index + 1}
              </div>
              <div style={{marginTop: 14, fontSize: 23, lineHeight: 1.16, fontWeight: 950}}>
                {item}
              </div>
            </div>
          );
        })}
      </div>
      <Detail>{layer.detail}</Detail>
    </Panel>
  );
};

const FlowScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const items = layer.items.slice(0, 4);
  const lineProgress = interpolate(frame, [6, 30], [0, 1], clamp);
  return (
    <Panel top={124}>
      <Eyebrow>FLOW · 关系路径</Eyebrow>
      <Title>{layer.title}</Title>
      <div style={{marginTop: 29, position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, items.length)}, 1fr)`, gap: 10}}>
        <div
          style={{
            position: 'absolute',
            left: 28,
            right: 28,
            top: 26,
            height: 2,
            background: `linear-gradient(90deg, ${colors.cyan} ${lineProgress * 100}%, rgba(255,255,255,0.13) ${lineProgress * 100}%)`,
          }}
        />
        {items.map((item, index) => {
          const enter = spring({frame: frame - 8 - index * 8, fps, config: {damping: 22, stiffness: 186, mass: 0.82}});
          const tone: Tone = index === items.length - 1 ? 'green' : index === 1 ? 'amber' : 'cyan';
          return (
            <div key={item} style={{position: 'relative', textAlign: 'center', opacity: enter}}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors[tone],
                  background: '#07111A',
                  border: `2px solid ${colors[tone]}`,
                  fontSize: 16,
                  fontWeight: 950,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </div>
              <div style={{marginTop: 13, fontSize: 19, lineHeight: 1.16, fontWeight: 900}}>{item}</div>
            </div>
          );
        })}
      </div>
      <Detail>{layer.detail}</Detail>
    </Panel>
  );
};

const QuestionGridScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  return (
    <Panel top={82} width={640}>
      <Eyebrow tone="amber">REALITY CHECK · 现实检查</Eyebrow>
      <Title>{layer.title}</Title>
      <div style={{marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
        {layer.items.slice(0, 4).map((item, index) => {
          const enter = spring({frame: frame - 5 - index * 8, fps, config: {damping: 21, stiffness: 188, mass: 0.82}});
          const tone: Tone = index === 3 ? 'green' : index === 1 ? 'amber' : 'cyan';
          return (
            <div
              key={item}
              style={{
                minHeight: 96,
                padding: '16px 15px',
                boxSizing: 'border-box',
                borderTop: `3px solid ${colors[tone]}`,
                background: 'rgba(255,255,255,0.045)',
                opacity: enter,
              }}
            >
              <div style={{color: colors[tone], fontSize: 15, fontWeight: 950}}>0{index + 1}</div>
              <div style={{marginTop: 10, fontSize: 21, lineHeight: 1.16, fontWeight: 900}}>{item}</div>
            </div>
          );
        })}
      </div>
      <Detail>{layer.detail}</Detail>
    </Panel>
  );
};

const LayerMapScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  return (
    <Panel tone="green" top={102}>
      <Eyebrow tone="green">POSITION MAP · 位置图</Eyebrow>
      <Title>{layer.title}</Title>
      <div style={{marginTop: 23, display: 'grid', gap: 12}}>
        {layer.items.slice(0, 3).map((item, index) => {
          const enter = spring({frame: frame - 6 - index * 9, fps, config: {damping: 21, stiffness: 184, mass: 0.84}});
          const tone: Tone = index === layer.items.length - 1 ? 'green' : index === 1 ? 'amber' : 'cyan';
          return (
            <div
              key={item}
              style={{
                display: 'grid',
                gridTemplateColumns: '62px 1fr',
                minHeight: 76,
                alignItems: 'center',
                borderLeft: `4px solid ${colors[tone]}`,
                paddingLeft: 17,
                background: 'rgba(255,255,255,0.04)',
                opacity: enter,
                transform: `translateX(${interpolate(enter, [0, 1], [-18, 0])}px)`,
              }}
            >
              <div style={{color: colors[tone], fontSize: 17, fontWeight: 950}}>L{index + 1}</div>
              <div style={{fontSize: 24, lineHeight: 1.18, fontWeight: 930}}>{item}</div>
            </div>
          );
        })}
      </div>
      <Detail>{layer.detail}</Detail>
    </Panel>
  );
};

const FourRightsScene: React.FC<{layer: PlanLayer}> = ({layer}) => (
  <Panel tone="amber" top={80} width={642}>
    <Eyebrow tone="amber">FOUR RIGHTS · 四项权利</Eyebrow>
    <Title>{layer.title}</Title>
    <RowList items={layer.items} tones={['cyan', 'amber', 'green', 'red']} />
    <Detail>{layer.detail}</Detail>
  </Panel>
);

const FeedbackLoopScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [5, 31], [0, 1], clamp);
  return (
    <Panel tone="green" top={92} width={640}>
      <Eyebrow tone="green">CALIBRATION LOOP · 校准闭环</Eyebrow>
      <Title>{layer.title}</Title>
      <div style={{marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11}}>
        {layer.items.slice(0, 4).map((item, index) => (
          <div
            key={item}
            style={{
              minHeight: 88,
              padding: '16px 17px',
              boxSizing: 'border-box',
              borderLeft: `4px solid ${index === 3 ? colors.green : colors.cyan}`,
              background: 'rgba(255,255,255,0.045)',
              opacity: interpolate(progress, [index * 0.18, Math.min(1, index * 0.18 + 0.28)], [0, 1], clamp),
            }}
          >
            <div style={{color: index === 3 ? colors.green : colors.cyan, fontSize: 15, fontWeight: 950}}>0{index + 1}</div>
            <div style={{marginTop: 9, fontSize: 23, fontWeight: 930}}>{item}</div>
          </div>
        ))}
      </div>
      <Detail>{layer.detail}</Detail>
    </Panel>
  );
};

const CallDemoScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const line = interpolate(frame, [8, 34], [0, 1], clamp);
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: '#03080E',
        color: colors.white,
        fontFamily,
        opacity,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 92,
          padding: '8px 12px',
          color: colors.amber,
          background: 'rgba(0,0,0,0.58)',
          border: `1px solid ${colors.amber}88`,
          fontSize: 17,
          fontWeight: 950,
        }}
      >
        流程演示 · 非真实平台录屏
      </div>
      <div style={{position: 'absolute', left: 54, top: 158, width: 620}}>
        <Title>{layer.title}</Title>
        <Detail>{layer.detail}</Detail>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 705,
          top: 215,
          width: 420,
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.cyan,
          background: 'rgba(98,216,255,0.08)',
          border: `2px solid ${colors.cyan}`,
          fontSize: 31,
          fontWeight: 950,
        }}
      >
        一个真实问题
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1118,
          top: 274,
          width: `${line * 115}px`,
          height: 3,
          background: colors.cyan,
          boxShadow: '0 0 16px rgba(98,216,255,0.62)',
        }}
      />
      <div style={{position: 'absolute', left: 1245, top: 110, width: 540, display: 'grid', gap: 16}}>
        {layer.items.slice(0, 3).map((item, index) => {
          const enter = spring({frame: frame - 12 - index * 10, fps, config: {damping: 21, stiffness: 184, mass: 0.84}});
          const tone: Tone = index === 2 ? 'red' : index === 1 ? 'green' : 'cyan';
          return (
            <div
              key={item}
              style={{
                minHeight: 126,
                padding: '21px 24px',
                boxSizing: 'border-box',
                borderLeft: `5px solid ${colors[tone]}`,
                background: 'rgba(255,255,255,0.055)',
                opacity: enter,
                transform: `translateX(${interpolate(enter, [0, 1], [26, 0])}px)`,
              }}
            >
              <div style={{color: colors[tone], fontSize: 16, fontWeight: 950}}>SOURCE 0{index + 1}</div>
              <div style={{marginTop: 13, fontSize: 31, fontWeight: 950}}>{item}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const GeneratedBrollScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const enter = useEnter(3);
  const scale = interpolate(frame, [0, durationInFrames], [1.035, 1.09], clamp);

  if (!layer.params.src) return null;

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#03070B', opacity}}>
      <Video
        src={staticFile(layer.params.src)}
        muted
        loop
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(1.03) saturate(0.92) brightness(0.78)',
          transform: `scale(${scale})`,
          transformOrigin: '50% 48%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.91) 0%, rgba(2,7,12,0.54) 37%, rgba(2,7,12,0.10) 76%), linear-gradient(180deg, rgba(2,7,12,0.14), transparent 55%, rgba(2,7,12,0.48))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 58,
          top: 96,
          width: 665,
          color: colors.white,
          fontFamily,
          textShadow: '0 5px 24px rgba(0,0,0,0.97)',
          opacity: enter,
          transform: `translateX(${interpolate(enter, [0, 1], [-26, 0])}px)`,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '8px 12px',
            color: colors.amber,
            background: 'rgba(3,8,12,0.82)',
            border: `1px solid ${colors.amber}99`,
            fontSize: 17,
            fontWeight: 950,
          }}
        >
          AI生成 · 概念画面
        </div>
        <div style={{marginTop: 20, fontSize: 50, lineHeight: 1.08, fontWeight: 950}}>
          {layer.title}
        </div>
        <div
          style={{
            marginTop: 18,
            paddingLeft: 16,
            borderLeft: `4px solid ${colors.cyan}`,
            fontSize: 23,
            lineHeight: 1.3,
            fontWeight: 850,
          }}
        >
          {layer.detail}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ClosingScene: React.FC<{layer: PlanLayer}> = ({layer}) => {
  const enter = useEnter(0);
  return (
    <Panel tone="green" top={210} width={590}>
      <Eyebrow tone="green">LOCAL AI PRACTICE · 兰州实践</Eyebrow>
      <div
        style={{
          marginTop: 12,
          color: colors.white,
          fontSize: 58,
          lineHeight: 1.05,
          fontWeight: 950,
          opacity: enter,
        }}
      >
        {layer.title}
      </div>
      <div style={{marginTop: 18, color: colors.cyan, fontSize: 29, fontWeight: 950}}>
        {layer.detail}
      </div>
    </Panel>
  );
};

const toScene = (layer: PlanLayer): V72ProductionScene => ({
  id: layer.id,
  start: layer.start,
  end: layer.end,
  kind: 'custom',
  customKey: layer.params.component,
  data: layer as unknown as Record<string, unknown>,
  background:
    layer.params.component === 'generated-broll' ||
    layer.params.component === 'call-demo'
      ? 'opaque'
      : 'talk',
});

const sfxCues: V72SfxCue[] = sfxContract.cues.map((cue) => ({
  id: cue.id,
  time: cue.start,
  file: cue.source.split('/').at(-1) ?? cue.id,
  src: cue.source.replace(/^remotion\/public\//, ''),
  volume: cue.volume,
}));

const scenes = layers.map(toScene);

const config: V72ProductionConfig = {
  durationSeconds,
  sourceVideo: 'media/ai-cognitive-position-20260810/main-30fps.mp4',
  captionsSrc: 'data/AI_COGNITIVE_POSITION_20260810_talk01.bilingual.v1.json',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.025) saturate(0.99) brightness(0.985)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.23) 0%, rgba(2,7,12,0.035) 47%, rgba(2,7,12,0.02) 100%)',
  motion: {
    cuts: [
      ...scenes.map((scene) => scene.start),
      4.8,
      31.2,
      59.4,
      95.6,
      118.8,
      154.7,
      170.8,
      194.8,
      221.8,
      243.8,
      269.2,
      289.8,
    ],
    baseScale: 1.01,
    peakScales: [1.043, 1.049, 1.041, 1.047, 1.044],
    peakX: [-6, 5, -3, 7, -5],
    peakY: [-2, -3, 0, -2, -1],
    transformOrigin: '58% 42%',
  },
  scenes,
  sfxCues,
};

const renderCustomScene = (scene: V72CustomScene) => {
  const layer = scene.data as unknown as PlanLayer;
  switch (scene.customKey) {
    case 'comparison':
    case 'three-feedbacks':
      return <ComparisonScene layer={layer} />;
    case 'flow':
    case 'timeline':
      return <FlowScene layer={layer} />;
    case 'question-grid':
      return <QuestionGridScene layer={layer} />;
    case 'layer-map':
      return <LayerMapScene layer={layer} />;
    case 'four-rights':
      return <FourRightsScene layer={layer} />;
    case 'feedback-loop':
      return <FeedbackLoopScene layer={layer} />;
    case 'call-demo':
      return <CallDemoScene layer={layer} />;
    case 'generated-broll':
      return <GeneratedBrollScene layer={layer} />;
    case 'closing':
      return <ClosingScene layer={layer} />;
    case 'statement':
    case 'definition':
    default:
      return <StatementScene layer={layer} />;
  }
};

const AICognitivePositionV73Talk16x9: React.FC<{
  soundEnabled: boolean;
}> = ({soundEnabled}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
  />
);

export const AICognitivePositionV73Talk16x9WithSfx: React.FC = () => (
  <AICognitivePositionV73Talk16x9 soundEnabled />
);

export const AICognitivePositionV73Talk16x9NoSfx: React.FC = () => (
  <AICognitivePositionV73Talk16x9 soundEnabled={false} />
);
