import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  AbsoluteFill,
  Img,
  cancelRender,
  continueRender,
  delayRender,
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
} from '../components/V72ProductionShell';
import {
  V8ComparisonBars,
  V8DirectStatement,
  V8HeroDefinition,
  V8NodeMap,
  V8ProcessRail,
  V8QuestionList,
  V8SourceBranches,
  type V8SemanticLayer,
} from '../components/V8SemanticStage';
import visualPlanDocument from '../salon-20260920/visual-plan.v2.json';
import sfxDocument from '../salon-20260920/sfx-cues.v2.json';

export const SALON_R2_FPS = 30;
export const SALON_R2_DURATION_IN_FRAMES = 18413;
export const SALON_R2_DURATION_SECONDS =
  SALON_R2_DURATION_IN_FRAMES / SALON_R2_FPS;

const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

type SalonParams = V8SemanticLayer['params'] & {
  imageSrc?: string;
  fit?: 'cover' | 'contain';
  position?: string;
  panY?: boolean;
};

type SalonLayer = Omit<V8SemanticLayer, 'params'> & {
  params: SalonParams;
  background: 'talk' | 'opaque';
  visualEvent: {id: string; enterAt: number; primary: boolean};
};

type BilingualCaption = {
  startMs: number;
  endMs: number;
  zh: string;
  en: string;
  highlights?: string[];
};

type Guest = {
  start: number;
  end: number;
  name: string;
  identity: string;
  topics: string[];
};

const guestCards: Guest[] = [
  {
    start: 108.1,
    end: 114.6,
    name: '老徐',
    identity: '医保 IP 实践者',
    topics: ['账号数据', '公域转私域', '变现卡点'],
  },
  {
    start: 258.466667,
    end: 264.966667,
    name: '魏元甲',
    identity: '学生 AI 创新实践者',
    topics: ['AI 教学系统', '创意大赛', '副业探索'],
  },
  {
    start: 300.866667,
    end: 307.866667,
    name: '黄鹏飞',
    identity: '企业 AI 服务实践者',
    topics: ['需求连接', '销售与交付'],
  },
  {
    start: 343.5,
    end: 350,
    name: '李女士',
    identity: '超级个体认知分享者',
    topics: ['知识付费边界', 'OPC 创业', '实践结果'],
  },
  {
    start: 386.5,
    end: 393,
    name: '洪岩',
    identity: '飞书生态企业服务实践者',
    topics: ['企业数据', '飞书协同', 'AI 上下文'],
  },
  {
    start: 467.566667,
    end: 474.566667,
    name: '葛永鹏',
    identity: '西部奥体体育',
    topics: ['传统行业', 'AI 学习', '业务实践'],
  },
  {
    start: 510.833333,
    end: 517.833333,
    name: '韩志鑫',
    identity: '大四学生',
    topics: ['AI 判断', '计算机专业', 'GPT Image Tool'],
  },
];

const chapters = [
  {start: 0, index: '01', title: '为什么办这场沙龙'},
  {start: 108.1, index: '02', title: '老徐：账号数据与变现卡点'},
  {start: 258.466667, index: '03', title: '魏元甲：学生 AI 实践'},
  {start: 300.866667, index: '04', title: '黄鹏飞：需求连接与交付'},
  {start: 343.5, index: '05', title: '李女士：知识付费边界'},
  {start: 386.5, index: '06', title: '洪岩：企业数据与 AI'},
  {start: 467.566667, index: '07', title: '葛永鹏：传统行业的 AI 学习'},
  {start: 510.833333, index: '08', title: '韩志鑫：学生视角的 AI 判断'},
  {start: 549.233333, index: '09', title: '每个月继续见'},
];

const visualPlan = visualPlanDocument as unknown as {layers: SalonLayer[]};
const sfxSheet = sfxDocument as unknown as {
  cues: Array<{
    id: string;
    start: number;
    source: string;
    volume: number;
  }>;
};

// 嘉宾卡由本组件按最终源的硬切点统一管理，避免视觉计划内的旧姓名重复出现。
const layers = visualPlan.layers.filter(
  (layer) => layer.params.component !== 'speaker-intro',
);
const scenes: V72ProductionScene[] = layers.map((layer) => ({
  id: layer.id,
  start: layer.start,
  end: layer.end,
  kind: 'custom',
  customKey: layer.params.component,
  data: layer as unknown as Record<string, unknown>,
  background: layer.background,
}));

const publicAssetPath = (source: string) =>
  source.replace(/^remotion\/public-salon-20260920\//u, '');

const sfxCues: V72SfxCue[] = sfxSheet.cues.map((cue) => ({
  id: cue.id,
  time: cue.start,
  file: cue.source.split('/').at(-1) ?? cue.id,
  src: publicAssetPath(cue.source),
  volume: cue.volume,
}));

const normalizeCaptions = (input: unknown): BilingualCaption[] => {
  const raw = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as {captions?: unknown}).captions)
      ? ((input as {captions: unknown[]}).captions ?? [])
      : [];

  return raw
    .map((item) => {
      const value = item as Partial<BilingualCaption> & {text?: string};
      return {
        startMs: Number(value.startMs ?? 0),
        endMs: Number(value.endMs ?? 0),
        zh: String(value.zh ?? value.text ?? '').trim(),
        en: String(value.en ?? '').trim(),
        highlights: Array.isArray(value.highlights)
          ? value.highlights.map(String)
          : [],
      };
    })
    .filter((cue) => cue.zh && cue.endMs > cue.startMs)
    .sort((left, right) => left.startMs - right.startMs);
};

const splitHighlight = (text: string, highlights: string[]) => {
  const terms = [...highlights]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  const parts: Array<{text: string; highlighted: boolean}> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const term = terms.find((item) => text.startsWith(item, cursor));
    if (term) {
      parts.push({text: term, highlighted: true});
      cursor += term.length;
      continue;
    }
    const next = terms
      .map((item) => text.indexOf(item, cursor + 1))
      .filter((value) => value >= 0)
      .sort((left, right) => left - right)[0];
    const end = next ?? text.length;
    parts.push({text: text.slice(cursor, end), highlighted: false});
    cursor = end;
  }
  return parts;
};

const BilingualCaptionOverlay: React.FC = () => {
  const [captions, setCaptions] = useState<BilingualCaption[] | null>(null);
  const [handle] = useState(() => delayRender('加载沙龙 R2 双语字幕'));
  const load = useCallback(async () => {
    try {
      const response = await fetch(
        staticFile('data/captions.final-source.bilingual.v2.json'),
      );
      if (!response.ok) {
        throw new Error(`双语字幕加载失败：${response.status}`);
      }
      setCaptions(normalizeCaptions(await response.json()));
      continueRender(handle);
    } catch (error) {
      cancelRender(error as Error);
    }
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const cue = useMemo(
    () => captions?.find((item) => nowMs >= item.startMs && nowMs < item.endMs),
    [captions, nowMs],
  );

  if (!cue) return null;

  const fadeMs = Math.min(90, Math.max(45, (cue.endMs - cue.startMs) * 0.07));
  const opacity = Math.min(
    interpolate(nowMs, [cue.startMs, cue.startMs + fadeMs], [0, 1], clamp),
    interpolate(nowMs, [cue.endMs - fadeMs, cue.endMs], [1, 0], clamp),
  );
  const parts = splitHighlight(cue.zh, cue.highlights ?? []);
  const zhSize = [...cue.zh].length > 20 ? 36 : [...cue.zh].length > 16 ? 39 : 43;
  const enSize = cue.en.length > 85 ? 16 : cue.en.length > 65 ? 18 : 20;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 40,
        zIndex: 320,
        width: 1540,
        minHeight: cue.en ? 108 : 78,
        padding: cue.en ? '7px 40px 9px' : '8px 40px 10px',
        boxSizing: 'border-box',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#F8FAFD',
        background:
          'linear-gradient(90deg, rgba(3,8,13,0) 0%, rgba(3,8,13,0.69) 12%, rgba(3,8,13,0.69) 88%, rgba(3,8,13,0) 100%)',
        fontFamily,
        textAlign: 'center',
        opacity,
      }}
    >
      <div
        style={{
          width: '100%',
          fontSize: zhSize,
          fontWeight: 920,
          lineHeight: 1.12,
          whiteSpace: 'nowrap',
          WebkitTextStroke: '1.15px rgba(0,0,0,0.88)',
          textShadow: '0 3px 9px rgba(0,0,0,1), 0 0 18px rgba(0,0,0,0.68)',
        }}
      >
        {parts.map((part, index) => (
          <span
            key={`${part.text}-${index}`}
            style={{color: part.highlighted ? '#FFD15C' : '#F8FAFD'}}
          >
            {part.text}
          </span>
        ))}
      </div>
      {cue.en ? (
        <div
          style={{
            width: '100%',
            marginTop: 4,
            color: 'rgba(236,244,249,0.88)',
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: enSize,
            fontWeight: 650,
            lineHeight: 1.12,
            whiteSpace: 'nowrap',
            textShadow: '0 2px 7px rgba(0,0,0,0.98)',
          }}
        >
          {cue.en}
        </div>
      ) : null}
    </div>
  );
};

const EditorialImage: React.FC<{layer: SalonLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const reveal = spring({
    frame,
    fps: SALON_R2_FPS,
    config: {damping: 24, stiffness: 145, mass: 0.9},
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 10), durationInFrames],
    [1, 0],
    clamp,
  );
  const progress = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    [0, 1],
    clamp,
  );
  const src = staticFile(publicAssetPath(layer.params.imageSrc ?? 'images/1.png'));
  const fit = layer.params.fit ?? 'cover';
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#04080D', opacity: exit}}>
      {fit === 'contain' ? (
        <Img
          src={src}
          style={{
            position: 'absolute',
            inset: -30,
            width: 'calc(100% + 60px)',
            height: 'calc(100% + 60px)',
            objectFit: 'cover',
            filter: 'blur(25px) brightness(0.32) saturate(0.82)',
            transform: `scale(${1.07 + progress * 0.03})`,
          }}
        />
      ) : null}
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
          objectPosition: layer.params.position ?? '50% 50%',
          transform: `scale(${1.015 + progress * 0.035})`,
          filter: 'contrast(1.02) saturate(0.96) brightness(0.88)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(3,8,13,0.82) 0%, rgba(3,8,13,0.28) 43%, rgba(3,8,13,0.04) 72%), linear-gradient(0deg, rgba(3,8,13,0.7) 0%, rgba(3,8,13,0) 42%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 66,
          top: 148,
          width: 720,
          color: '#F8FAFD',
          fontFamily,
          opacity: reveal,
          transform: `translateX(${interpolate(reveal, [0, 1], [-28, 0])}px)`,
          textShadow: '0 5px 24px rgba(0,0,0,0.98)',
        }}
      >
        <div style={{color: '#FFD15C', fontSize: 19, fontWeight: 950}}>
          兰州 AI 实践者共创沙龙 · 第一期
        </div>
        <div style={{marginTop: 17, fontSize: 54, lineHeight: 1.06, fontWeight: 950}}>
          {layer.title}
        </div>
        <div
          style={{
            marginTop: 16,
            paddingLeft: 16,
            borderLeft: '5px solid #68DAFF',
            fontSize: 25,
            lineHeight: 1.28,
            fontWeight: 840,
          }}
        >
          {layer.detail}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MetricStack: React.FC<{layer: SalonLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = Math.min(
    interpolate(frame, [0, 8], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(8, durationInFrames - 8), durationInFrames],
      [1, 0],
      clamp,
    ),
  );
  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 150,
        width: 660,
        color: '#F8FAFD',
        fontFamily,
        opacity,
        textShadow: '0 4px 18px rgba(0,0,0,0.96)',
      }}
    >
      <div style={{color: '#68DAFF', fontSize: 20, fontWeight: 950}}>
        现场分享 · 以实录为准
      </div>
      <div style={{marginTop: 12, fontSize: 62, lineHeight: 1.02, fontWeight: 950, color: '#FFD15C'}}>
        {layer.title}
      </div>
      <div style={{marginTop: 12, fontSize: 23, lineHeight: 1.25, fontWeight: 820}}>
        {layer.detail}
      </div>
      <div style={{marginTop: 22, display: 'grid', gap: 10}}>
        {layer.items.slice(0, 3).map((item, index) => {
          const itemReveal = spring({
            frame: frame - 8 - index * 7,
            fps: SALON_R2_FPS,
            config: {damping: 22, stiffness: 180, mass: 0.82},
          });
          return (
            <div
              key={item}
              style={{
                display: 'grid',
                gridTemplateColumns: '46px 1fr',
                alignItems: 'center',
                minHeight: 58,
                padding: '0 15px',
                background: 'rgba(3,13,20,0.48)',
                borderLeft: `5px solid ${index === 0 ? '#68DAFF' : index === 1 ? '#FFD15C' : '#65D69A'}`,
                fontSize: 28,
                fontWeight: 920,
                opacity: itemReveal,
                transform: `translateX(${(1 - itemReveal) * 18}px)`,
              }}
            >
              <span style={{fontSize: 16, color: '#68DAFF'}}>0{index + 1}</span>
              <span>{item}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GuestIntroCards: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;
  const guest = guestCards.find((item) => seconds >= item.start && seconds < item.end);
  if (!guest) return null;

  const localFrame = frame - Math.round(guest.start * fps);
  const durationInFrames = Math.round((guest.end - guest.start) * fps);
  const reveal = spring({
    frame: localFrame - 2,
    fps,
    config: {damping: 21, stiffness: 168, mass: 0.84},
  });
  const exit = interpolate(
    localFrame,
    [Math.max(1, durationInFrames - 10), durationInFrames],
    [1, 0],
    clamp,
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 158,
        zIndex: 300,
        width: 690,
        padding: '25px 31px 24px',
        boxSizing: 'border-box',
        color: '#F8FAFD',
        fontFamily,
        background:
          'linear-gradient(135deg, rgba(3,13,20,0.92), rgba(3,13,20,0.66))',
        borderLeft: '7px solid #68DAFF',
        boxShadow: '0 24px 74px rgba(0,0,0,0.46)',
        opacity: reveal * exit,
        transform: `translateX(${interpolate(reveal, [0, 1], [-40, 0])}px)`,
      }}
    >
      <div style={{color: '#68DAFF', fontSize: 18, fontWeight: 950, letterSpacing: 3}}>
        本次分享
      </div>
      <div style={{marginTop: 9, fontSize: 68, lineHeight: 1, fontWeight: 950}}>
        {guest.name}
      </div>
      <div style={{marginTop: 12, color: '#FFD15C', fontSize: 29, fontWeight: 900}}>
        {guest.identity}
      </div>
      <div style={{display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap'}}>
        {guest.topics.map((item) => (
          <span
            key={item}
            style={{
              padding: '7px 12px',
              background: 'rgba(255,255,255,0.1)',
              fontSize: 20,
              fontWeight: 850,
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

const ChapterMarker: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;
  const chapter =
    [...chapters].reverse().find((item) => seconds >= item.start) ?? chapters[0];
  const reveal = interpolate(seconds - chapter.start, [0, 0.32], [0, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 72,
        zIndex: 285,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: '#F8FAFD',
        fontFamily,
        textShadow: '0 3px 15px rgba(0,0,0,0.96)',
        opacity: reveal,
      }}
    >
      <span style={{color: '#68DAFF', fontSize: 28, fontWeight: 950}}>
        {chapter.index}
      </span>
      <span
        style={{
          width: 34,
          height: 2,
          background: '#68DAFF',
          transform: `scaleX(${reveal})`,
          transformOrigin: 'left center',
        }}
      />
      <span style={{fontSize: 20, fontWeight: 900}}>{chapter.title}</span>
    </div>
  );
};

const renderCustomScene = (scene: V72CustomScene) => {
  const layer = scene.data as unknown as SalonLayer;
  switch (scene.customKey) {
    case 'image-editorial':
      return <EditorialImage layer={layer} />;
    case 'metric-stack':
      return <MetricStack layer={layer} />;
    case 'comparison':
      return <V8ComparisonBars layer={layer} />;
    case 'timeline':
    case 'flow':
      return <V8ProcessRail layer={layer} />;
    case 'layer-map':
      return <V8NodeMap layer={layer} />;
    case 'question-grid':
      return <V8QuestionList layer={layer} />;
    case 'source-branches':
      return <V8SourceBranches layer={layer} />;
    case 'definition':
      return <V8HeroDefinition layer={layer} />;
    case 'statement':
    default:
      return <V8DirectStatement layer={layer} />;
  }
};

const config: V72ProductionConfig = {
  durationSeconds: SALON_R2_DURATION_SECONDS,
  sourceVideo: 'media/salon-final-proxy-v2.mp4',
  captionsSrc: 'data/empty-captions.json',
  captionMode: 'chinese',
  brandLabel: '兰州 AI 实践者共创沙龙 · 第一期',
  sourceFilter: 'contrast(1.02) saturate(1.01) brightness(0.995)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.12) 0%, rgba(2,7,12,0.015) 54%, rgba(2,7,12,0.025) 100%)',
  motion: {
    cuts: [
      0,
      44,
      71,
      98,
      108.1,
      150,
      205,
      258.466667,
      300.866667,
      343.5,
      386.5,
      430,
      467.566667,
      510.833333,
      549.233333,
      SALON_R2_DURATION_SECONDS,
    ],
    baseScale: 1.006,
    peakScales: [1.022, 1.026, 1.02, 1.024, 1.021],
    peakX: [-5, 4, -4, 5, -3],
    peakY: [-2, -1, 0, -2, -1],
    transformOrigin: '54% 43%',
  },
  scenes,
  sfxCues,
};

const SalonHighlightR2: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
    persistentOverlay={
      <>
        <ChapterMarker />
        <GuestIntroCards />
        <BilingualCaptionOverlay />
      </>
    }
  />
);

export const SalonHighlightR2WithSfx: React.FC = () => (
  <SalonHighlightR2 soundEnabled />
);
export const SalonHighlightR2NoSfx: React.FC = () => (
  <SalonHighlightR2 soundEnabled={false} />
);

