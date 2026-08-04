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
import sfxContract from './data/AIProductivityV73.sfx.v1.json';
import visualPlan from './data/AIProductivityV73.visual-plan.v1.json';

const fps = 30;
const durationSeconds = 413.533333;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const AI_PRODUCTIVITY_V73_DURATION_IN_FRAMES = f(durationSeconds);

type Tone = 'cyan' | 'amber' | 'green' | 'red' | 'purple' | 'white';
type StandardTone = Exclude<Tone, 'purple'>;

const colors: Record<Tone, string> = {
  cyan: '#62D8FF',
  amber: '#FFBE55',
  green: '#67D8A0',
  red: '#FF7068',
  purple: '#B995FF',
  white: '#F7FAFC',
};

type PlanItem = {
  label: string;
  detail: string;
  tone?: StandardTone;
};

type PlanStep = {
  label: string;
  detail: string;
  tone?: StandardTone;
};

type PlanParams = {
  component: string;
  eyebrow?: string;
  left?: string;
  right?: string;
  leftValue?: string;
  rightValue?: string;
  note?: string;
  value?: string;
  suffix?: string;
  caption?: string;
  facts?: string[];
  marker?: string;
  source?: string;
  quote?: string;
  index?: string;
  subtitle?: string;
  active?: number;
  big?: string;
  bullets?: string[];
  items?: PlanItem[];
  steps?: PlanStep[];
  questions?: string[];
  src?: string;
  label?: string;
  title?: string;
  detail?: string;
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

const sceneProgress = (frame: number, durationInFrames: number) => {
  const fade = Math.min(10, Math.max(5, Math.round(durationInFrames * 0.08)));
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
    config: {damping: 20, stiffness: 180, mass: 0.82},
  });
};

const GlassStage: React.FC<{
  children: React.ReactNode;
  width?: number;
  top?: number;
}> = ({children, width = 700, top = 112}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = sceneProgress(frame, durationInFrames);
  const enter = useEnter(1);

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top,
        width,
        maxHeight: 676,
        boxSizing: 'border-box',
        padding: '28px 30px 30px',
        overflow: 'hidden',
        color: colors.white,
        fontFamily,
        background:
          'linear-gradient(145deg, rgba(3,10,16,0.83), rgba(5,15,23,0.61))',
        border: '1px solid rgba(98,216,255,0.34)',
        borderLeft: '5px solid rgba(98,216,255,0.88)',
        boxShadow: '0 20px 54px rgba(0,0,0,0.34)',
        backdropFilter: 'blur(13px)',
        opacity,
        transform: `translateX(${interpolate(enter, [0, 1], [-34, 0])}px)`,
        textShadow: '0 4px 20px rgba(0,0,0,0.94)',
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

const DemoPlans: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const data = scene.data as PlanLayer;
  const planNames = data.items.length ? data.items : ['目标版', '执行版', '预算版'];

  return (
    <GlassStage width={720} top={118}>
      <Eyebrow tone="amber">情景示意 · 非真实客户后台</Eyebrow>
      <div style={{marginTop: 12, fontSize: 50, lineHeight: 1.05, fontWeight: 950}}>
        {data.title}
      </div>
      <div style={{marginTop: 25, display: 'grid', gap: 14}}>
        {planNames.slice(0, 3).map((name, index) => {
          const enter = spring({
            frame: frame - 10 - index * 11,
            fps,
            config: {damping: 20, stiffness: 190, mass: 0.8},
          });
          return (
            <div
              key={name}
              style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr 106px',
                alignItems: 'center',
                minHeight: 76,
                padding: '0 18px',
                background: 'rgba(255,255,255,0.055)',
                border: '1px solid rgba(98,216,255,0.22)',
                opacity: enter,
                transform: `translateX(${interpolate(enter, [0, 1], [-22, 0])}px)`,
              }}
            >
              <div style={{color: colors.cyan, fontSize: 19, fontWeight: 950}}>
                0{index + 1}
              </div>
              <div style={{fontSize: 30, fontWeight: 950}}>{name}</div>
              <div
                style={{
                  color: index === 2 ? colors.amber : colors.green,
                  fontSize: 18,
                  fontWeight: 900,
                  textAlign: 'right',
                }}
              >
                已生成
              </div>
            </div>
          );
        })}
      </div>
      <div style={{marginTop: 18, color: 'rgba(247,250,252,0.72)', fontSize: 19}}>
        仅替代未录制的操作过程，不代表真实项目结果。
      </div>
    </GlassStage>
  );
};

const DemoTable: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const data = scene.data as PlanLayer;
  const rows = [
    ['08/04', '本地咨询', '示例字段', '待跟进'],
    ['08/04', '线上内容', '示例字段', '已整理'],
    ['08/04', '客户回访', '示例字段', '待确认'],
  ];

  return (
    <GlassStage width={730} top={124}>
      <Eyebrow tone="amber">虚构字段 · 流程示意</Eyebrow>
      <div style={{marginTop: 11, fontSize: 52, lineHeight: 1.05, fontWeight: 950}}>
        {data.title}
      </div>
      <div
        style={{
          marginTop: 23,
          display: 'grid',
          gridTemplateColumns: '105px 1fr 128px 110px',
          padding: '12px 14px',
          color: colors.cyan,
          background: 'rgba(98,216,255,0.10)',
          fontSize: 17,
          fontWeight: 950,
        }}
      >
        {['日期', '渠道', '咨询量', '跟进状态'].map((cell) => (
          <div key={cell}>{cell}</div>
        ))}
      </div>
      <div style={{display: 'grid', gap: 2}}>
        {rows.map((row, rowIndex) => {
          const enter = spring({
            frame: frame - 9 - rowIndex * 9,
            fps,
            config: {damping: 22, stiffness: 185, mass: 0.84},
          });
          return (
            <div
              key={row.join('-')}
              style={{
                display: 'grid',
                gridTemplateColumns: '105px 1fr 128px 110px',
                minHeight: 58,
                alignItems: 'center',
                padding: '0 14px',
                background: 'rgba(255,255,255,0.045)',
                fontSize: 18,
                fontWeight: 820,
                opacity: enter,
              }}
            >
              {row.map((cell, cellIndex) => (
                <div
                  key={`${cell}-${cellIndex}`}
                  style={{color: cellIndex === 3 ? colors.green : colors.white}}
                >
                  {cell}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{marginTop: 17, color: 'rgba(247,250,252,0.72)', fontSize: 18}}>
        不使用真实经营数据，只展示“整理前后”的动作逻辑。
      </div>
    </GlassStage>
  );
};

const TwoScale: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const data = scene.data as PlanLayer;
  const params = data.params;
  const line = interpolate(frame, [12, 32], [0, 1], clamp);

  return (
    <GlassStage width={732} top={156}>
      <Eyebrow>{data.title}</Eyebrow>
      <div
        style={{
          marginTop: 26,
          display: 'grid',
          gridTemplateColumns: '1fr 70px 1fr',
          alignItems: 'stretch',
          gap: 12,
        }}
      >
        {[
          {label: params.left, value: params.leftValue, tone: 'cyan' as Tone},
          {label: params.right, value: params.rightValue, tone: 'amber' as Tone},
        ].map((item, index) => {
          const enter = spring({
            frame: frame - 4 - index * 9,
            fps,
            config: {damping: 20, stiffness: 178, mass: 0.86},
          });
          return (
            <React.Fragment key={item.label}>
              {index === 1 ? (
                <div style={{display: 'flex', alignItems: 'center'}}>
                  <div
                    style={{
                      width: `${line * 52}px`,
                      height: 3,
                      background: colors.amber,
                      boxShadow: '0 0 14px rgba(255,190,85,0.65)',
                    }}
                  />
                  <div style={{color: colors.amber, fontSize: 24}}>›</div>
                </div>
              ) : null}
              <div
                style={{
                  minHeight: 190,
                  padding: '25px 22px',
                  background: 'rgba(255,255,255,0.055)',
                  borderTop: `4px solid ${colors[item.tone]}`,
                  opacity: enter,
                  transform: `translateY(${interpolate(enter, [0, 1], [18, 0])}px)`,
                }}
              >
                <div style={{color: colors[item.tone], fontSize: 21, fontWeight: 950}}>
                  {item.label}
                </div>
                <div style={{marginTop: 22, fontSize: 38, lineHeight: 1.12, fontWeight: 950}}>
                  {item.value}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{marginTop: 19, fontSize: 20, color: 'rgba(247,250,252,0.74)'}}>
        {data.detail}
      </div>
    </GlassStage>
  );
};

const gateLabels = ['流程', '需求', '新价值', '收益分享'];

const GateRail: React.FC<{active: number}> = ({active}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [8, 34], [0, 1], clamp);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginTop: 22,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 32,
          right: 32,
          top: 23,
          height: 2,
          background: `linear-gradient(90deg, ${colors.cyan} ${progress * 100}%, rgba(255,255,255,0.15) ${progress * 100}%)`,
        }}
      />
      {gateLabels.map((label, index) => {
        const selected = active < 0 || active === index;
        const tone = active === index ? colors.amber : colors.cyan;
        return (
          <div key={label} style={{position: 'relative', textAlign: 'center'}}>
            <div
              style={{
                width: 46,
                height: 46,
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                color: tone,
                background: selected ? `${tone}26` : 'rgba(255,255,255,0.055)',
                border: `2px solid ${selected ? tone : 'rgba(255,255,255,0.23)'}`,
                boxShadow: selected ? `0 0 20px ${tone}45` : 'none',
                fontSize: 17,
                fontWeight: 950,
              }}
            >
              {String(index + 1).padStart(2, '0')}
            </div>
            <div
              style={{
                marginTop: 10,
                color: selected ? colors.white : 'rgba(247,250,252,0.60)',
                fontSize: 17,
                fontWeight: 900,
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FourGates: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const data = scene.data as PlanLayer;
  return (
    <GlassStage width={735} top={148}>
      <Eyebrow>FOUR GATES · 四道门槛</Eyebrow>
      <div style={{marginTop: 12, fontSize: 50, lineHeight: 1.07, fontWeight: 950}}>
        {data.title}
      </div>
      <div style={{marginTop: 10, color: 'rgba(247,250,252,0.78)', fontSize: 23}}>
        {data.detail}
      </div>
      <GateRail active={data.params.active ?? -1} />
    </GlassStage>
  );
};

const GateDetail: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const data = scene.data as PlanLayer;
  const params = data.params;
  const active = params.active ?? 0;

  return (
    <GlassStage width={745} top={88}>
      <Eyebrow tone="amber">{data.title} · FOUR GATES</Eyebrow>
      <GateRail active={active} />
      <div
        style={{
          marginTop: 25,
          color: active === 1 ? colors.amber : colors.white,
          fontSize: active === 1 ? 55 : 42,
          lineHeight: 1.08,
          fontWeight: 950,
        }}
      >
        {params.big}
      </div>
      <div style={{marginTop: 21, display: 'grid', gap: 12}}>
        {(params.bullets ?? []).map((bullet, index) => {
          const enter = spring({
            frame: frame - 12 - index * 10,
            fps,
            config: {damping: 21, stiffness: 182, mass: 0.82},
          });
          return (
            <div
              key={bullet}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr',
                gap: 10,
                alignItems: 'start',
                fontSize: 22,
                lineHeight: 1.22,
                fontWeight: 850,
                opacity: enter,
                transform: `translateX(${interpolate(enter, [0, 1], [-16, 0])}px)`,
              }}
            >
              <div style={{color: index === 2 ? colors.green : colors.cyan}}>▸</div>
              <div>{bullet}</div>
            </div>
          );
        })}
      </div>
    </GlassStage>
  );
};

const GeneratedBroll: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const data = scene.data as PlanLayer;
  const params = data.params;
  const opacity = sceneProgress(frame, durationInFrames);
  const scale = interpolate(frame, [0, durationInFrames], [1.01, 1.055], clamp);
  const enter = useEnter(3);

  if (!params.src) {
    return null;
  }

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#03070B', opacity}}>
      <Video
        src={staticFile(params.src)}
        muted
        loop
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${scale})`,
          transformOrigin: '50% 48%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.78) 0%, rgba(2,7,12,0.20) 48%, rgba(2,7,12,0.05) 78%), linear-gradient(180deg, rgba(2,7,12,0.10), transparent 54%, rgba(2,7,12,0.42))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 62,
          top: 116,
          width: 665,
          color: colors.white,
          fontFamily,
          textShadow: '0 5px 24px rgba(0,0,0,0.96)',
          opacity: enter,
          transform: `translateX(${interpolate(enter, [0, 1], [-26, 0])}px)`,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '8px 12px',
            color: colors.amber,
            background: 'rgba(3,8,12,0.78)',
            border: '1px solid rgba(255,190,85,0.54)',
            fontSize: 17,
            fontWeight: 950,
          }}
        >
          {params.label ?? 'AI生成 · 情景示意'}
        </div>
        <div style={{marginTop: 18, fontSize: 49, lineHeight: 1.08, fontWeight: 950}}>
          {params.title ?? data.title}
        </div>
        <div
          style={{
            marginTop: 17,
            borderLeft: `4px solid ${colors.cyan}`,
            paddingLeft: 15,
            fontSize: 23,
            lineHeight: 1.28,
            fontWeight: 850,
          }}
        >
          {params.detail ?? data.detail}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const QuestionList: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const data = scene.data as PlanLayer;
  const questions = data.params.questions ?? [];

  return (
    <GlassStage width={770} top={72}>
      <Eyebrow tone="amber">CHECKLIST · 四道门逐项验收</Eyebrow>
      <div style={{marginTop: 11, fontSize: 47, lineHeight: 1.06, fontWeight: 950}}>
        {data.title}
      </div>
      <div style={{marginTop: 22, display: 'grid', gap: 11}}>
        {questions.map((question, index) => {
          const enter = spring({
            frame: frame - 7 - index * 12,
            fps,
            config: {damping: 21, stiffness: 185, mass: 0.84},
          });
          return (
            <div
              key={question}
              style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr',
                minHeight: 72,
                alignItems: 'center',
                gap: 13,
                padding: '0 15px 0 10px',
                background: index === 0 ? 'rgba(98,216,255,0.10)' : 'rgba(255,255,255,0.045)',
                borderLeft: `3px solid ${index === 0 ? colors.cyan : colors.amber}`,
                opacity: enter,
                transform: `translateX(${interpolate(enter, [0, 1], [-22, 0])}px)`,
              }}
            >
              <div style={{color: index === 0 ? colors.cyan : colors.amber, fontSize: 20, fontWeight: 950}}>
                0{index + 1}
              </div>
              <div style={{fontSize: 22, lineHeight: 1.2, fontWeight: 900}}>{question}</div>
            </div>
          );
        })}
      </div>
    </GlassStage>
  );
};

const CompactProcess: React.FC<{scene: V72CustomScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const data = scene.data as PlanLayer;
  const steps = data.params.steps ?? [];

  return (
    <GlassStage width={748} top={90}>
      <Eyebrow>REAL WORKFLOW · 真实流程</Eyebrow>
      <div style={{marginTop: 11, fontSize: 46, lineHeight: 1.06, fontWeight: 950}}>
        {data.title}
      </div>
      <div style={{marginTop: 23, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
        {steps.slice(0, 4).map((step, index) => {
          const enter = spring({
            frame: frame - 8 - index * 9,
            fps,
            config: {damping: 21, stiffness: 185, mass: 0.82},
          });
          const tone = colors[step.tone ?? (index === 1 ? 'amber' : index > 1 ? 'green' : 'cyan')];
          return (
            <div
              key={`${step.label}-${index}`}
              style={{
                minHeight: 136,
                boxSizing: 'border-box',
                padding: '17px 18px',
                background: 'rgba(255,255,255,0.052)',
                borderTop: `3px solid ${tone}`,
                opacity: enter,
                transform: `translateY(${interpolate(enter, [0, 1], [16, 0])}px)`,
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <div style={{color: tone, fontSize: 16, fontWeight: 950}}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div style={{color: tone, fontSize: 24, fontWeight: 950}}>{step.label}</div>
              </div>
              <div style={{marginTop: 14, fontSize: 24, lineHeight: 1.2, fontWeight: 900}}>
                {step.detail}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{marginTop: 16, color: 'rgba(247,250,252,0.72)', fontSize: 19}}>
        本次未提供真实项目后台，保留为方法示意，不冒充验收证据。
      </div>
    </GlassStage>
  );
};

const toScene = (layer: PlanLayer): V72ProductionScene => {
  const params = layer.params;
  const base = {id: layer.id, start: layer.start, end: layer.end};

  switch (params.component) {
    case 'truth':
      return {
        ...base,
        kind: 'truth',
        eyebrow: params.eyebrow ?? layer.title,
        left: params.left ?? '',
        right: params.right ?? '',
        note: params.note ?? layer.detail,
      };
    case 'metric':
      return {
        ...base,
        kind: 'metric',
        eyebrow: params.eyebrow ?? layer.title,
        value: params.value ?? '',
        suffix: params.suffix,
        caption: params.caption ?? layer.detail,
        facts: params.facts,
        tone: layer.id === 'nber-macro-study' ? 'amber' : 'cyan',
      };
    case 'evidence':
      return {
        ...base,
        kind: 'evidence',
        marker: params.marker,
        source: params.source ?? '',
        quote: params.quote ?? layer.title,
        caption: params.caption ?? layer.detail,
        tone: 'cyan',
      };
    case 'chapter':
      return {
        ...base,
        kind: 'chapter',
        index: params.index ?? '→',
        eyebrow: params.eyebrow ?? layer.title,
        title: layer.title,
        subtitle: params.subtitle ?? layer.detail,
        tone: layer.id === 'cta-four-gates' ? 'amber' : 'cyan',
      };
    case 'info-stack':
      return {
        ...base,
        kind: 'info-stack',
        eyebrow: params.eyebrow ?? layer.title,
        title: layer.title,
        items: (params.items ?? []).map((item) => ({
          label: item.label,
          detail: item.detail,
          tone: item.tone,
        })),
        style: {top: 106},
      };
    case 'process':
      return {
        ...base,
        kind: 'custom',
        customKey: 'process-compact',
        data: layer as unknown as Record<string, unknown>,
      };
    default:
      return {
        ...base,
        kind: 'custom',
        customKey: params.component,
        data: layer as unknown as Record<string, unknown>,
        background: params.component === 'generated-broll' ? 'opaque' : 'talk',
      };
  }
};

const sfxCues: V72SfxCue[] = sfxContract.cues.map((cue) => ({
  id: cue.id,
  time: cue.start,
  file: cue.source.split('/').at(-1) ?? cue.id,
  src: cue.source.replace(/^remotion\/public\//, ''),
  volume: cue.volume,
}));

const sceneStarts = layers.map((layer) => layer.start);
const extraMotionCuts = [
  6, 34, 49, 64, 74, 87, 101, 128, 139, 149, 168, 181, 193, 213, 226,
  249, 274, 289, 297, 316, 338, 361, 371, 388, 408,
];

const config: V72ProductionConfig = {
  durationSeconds,
  sourceVideo: 'media/ai-productivity-20260804/main-30fps.mp4',
  captionsSrc: 'data/AI_PRODUCTIVITY_20260804_talk01.bilingual.v1.json',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.04) saturate(1.025) brightness(0.975)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.20) 0%, rgba(2,7,12,0.035) 51%, rgba(2,7,12,0.03) 100%)',
  motion: {
    cuts: [...sceneStarts, ...extraMotionCuts],
    baseScale: 1.014,
    peakScales: [1.047, 1.055, 1.043, 1.052, 1.049],
    peakX: [-8, 7, -4, 9, -6],
    peakY: [-2, -4, 0, -3, -1],
    transformOrigin: '58% 42%',
  },
  scenes: layers.map(toScene),
  sfxCues,
};

const renderCustomScene = (scene: V72CustomScene) => {
  switch (scene.customKey) {
    case 'demo-plans':
      return <DemoPlans scene={scene} />;
    case 'demo-table':
      return <DemoTable scene={scene} />;
    case 'two-scale':
      return <TwoScale scene={scene} />;
    case 'four-gates':
      return <FourGates scene={scene} />;
    case 'gate-detail':
      return <GateDetail scene={scene} />;
    case 'generated-broll':
      return <GeneratedBroll scene={scene} />;
    case 'question-list':
      return <QuestionList scene={scene} />;
    case 'process-compact':
      return <CompactProcess scene={scene} />;
    default:
      return null;
  }
};

const AIProductivityV73Talk16x9: React.FC<{soundEnabled: boolean}> = ({
  soundEnabled,
}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
  />
);

export const AIProductivityV73Talk16x9WithSfx: React.FC = () => (
  <AIProductivityV73Talk16x9 soundEnabled />
);

export const AIProductivityV73Talk16x9NoSfx: React.FC = () => (
  <AIProductivityV73Talk16x9 soundEnabled={false} />
);
