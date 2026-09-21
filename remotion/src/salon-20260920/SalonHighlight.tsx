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
import visualPlan from './visual-plan.v1.json';
import sfxSheet from './sfx-cues.v1.json';

const fps = 30;
export const SALON_HIGHLIGHT_DURATION_SECONDS = 508.22;
export const SALON_HIGHLIGHT_DURATION_IN_FRAMES = Math.round(
  SALON_HIGHLIGHT_DURATION_SECONDS * fps,
);
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

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
type CaptionCue = {
  startMs: number;
  endMs: number;
  text: string;
  highlights?: string[];
};

const layers = visualPlan.layers as SalonLayer[];
const scenes: V72ProductionScene[] = layers.map((layer) => ({
  id: layer.id,
  start: layer.start,
  end: layer.end,
  kind: 'custom',
  customKey: layer.params.component,
  data: layer as unknown as Record<string, unknown>,
  background: layer.background,
}));
const sfxCues: V72SfxCue[] = sfxSheet.cues.map((cue) => ({
  id: cue.id,
  time: cue.start,
  file: cue.source.split('/').at(-1) ?? cue.id,
  src: cue.source.replace(/^remotion\/public-salon-20260920\//u, ''),
  volume: cue.volume,
}));

const splitHighlight = (text: string, highlights: string[]) => {
  const terms = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);
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
      .sort((a, b) => a - b)[0];
    const end = next ?? text.length;
    parts.push({text: text.slice(cursor, end), highlighted: false});
    cursor = end;
  }
  return parts;
};

const SalonCaptionOverlay: React.FC = () => {
  const [captions, setCaptions] = useState<CaptionCue[] | null>(null);
  const [handle] = useState(() => delayRender('加载沙龙实录字幕'));
  const load = useCallback(async () => {
    try {
      const response = await fetch(staticFile('data/captions.machine-candidate.v1.json'));
      const value = (await response.json()) as CaptionCue[];
      setCaptions(value);
      continueRender(handle);
    } catch (error) {
      cancelRender(error as Error);
    }
  }, [handle]);
  useEffect(() => {
    load();
  }, [load]);
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const nowMs = (frame / compositionFps) * 1000;
  const cue = useMemo(
    () => captions?.find((item) => nowMs >= item.startMs && nowMs < item.endMs),
    [captions, nowMs],
  );
  if (!cue) return null;
  const duration = cue.endMs - cue.startMs;
  const fade = Math.min(90, Math.max(45, duration * 0.08));
  const opacity = Math.min(
    interpolate(nowMs, [cue.startMs, cue.startMs + fade], [0, 1], clamp),
    interpolate(nowMs, [cue.endMs - fade, cue.endMs], [1, 0], clamp),
  );
  const parts = splitHighlight(cue.text, cue.highlights ?? []);
  const fontSize = [...cue.text].length > 19 ? 38 : [...cue.text].length > 15 ? 42 : 46;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 47,
        zIndex: 310,
        width: 1540,
        minHeight: 78,
        padding: '8px 42px 11px',
        boxSizing: 'border-box',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#F8FAFD',
        background:
          'linear-gradient(90deg, rgba(3,8,13,0) 0%, rgba(3,8,13,0.72) 12%, rgba(3,8,13,0.72) 88%, rgba(3,8,13,0) 100%)',
        fontFamily,
        fontSize,
        fontWeight: 920,
        lineHeight: 1.16,
        textAlign: 'center',
        letterSpacing: 0,
        WebkitTextStroke: '1.25px rgba(0,0,0,0.86)',
        textShadow: '0 3px 9px rgba(0,0,0,1), 0 0 18px rgba(0,0,0,0.72)',
        opacity,
      }}
    >
      <span>
        {parts.map((part, index) => (
          <span
            key={`${part.text}-${index}`}
            style={{
              color: part.highlighted ? '#FFD15C' : '#F8FAFD',
              textShadow: part.highlighted
                ? '0 0 18px rgba(255,209,92,0.58), 0 3px 9px rgba(0,0,0,1)'
                : undefined,
            }}
          >
            {part.text}
          </span>
        ))}
      </span>
    </div>
  );
};

const ImageEditorial: React.FC<{layer: SalonLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const reveal = spring({frame, fps, config: {damping: 24, stiffness: 145, mass: 0.9}});
  const exit = interpolate(frame, [Math.max(0, durationInFrames - 10), durationInFrames], [1, 0], clamp);
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], clamp);
  const src = staticFile(layer.params.imageSrc ?? 'images/1.png');
  const fit = layer.params.fit ?? 'cover';
  const panY = layer.params.panY;
  const scale = interpolate(progress, [0, 1], [1.025, 1.085]);
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
            filter: 'blur(24px) brightness(0.34) saturate(0.8)',
            transform: `scale(${1.08 + progress * 0.04})`,
          }}
        />
      ) : null}
      {panY ? (
        <Img
          src={src}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: 'auto',
            transform: `translateY(${interpolate(progress, [0, 1], [-1080, -2440], clamp)}px)`,
            filter: 'contrast(1.025) saturate(0.94) brightness(0.9)',
          }}
        />
      ) : (
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: fit,
            objectPosition: layer.params.position ?? '50% 50%',
            transform: `scale(${scale})`,
            filter: 'contrast(1.025) saturate(0.96) brightness(0.88)',
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(3,8,13,0.84) 0%, rgba(3,8,13,0.34) 40%, rgba(3,8,13,0.05) 70%), linear-gradient(0deg, rgba(3,8,13,0.74) 0%, rgba(3,8,13,0) 42%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 142,
          width: 710,
          color: '#F8FAFD',
          fontFamily,
          opacity: reveal,
          transform: `translateX(${interpolate(reveal, [0, 1], [-32, 0])}px)`,
          textShadow: '0 5px 24px rgba(0,0,0,0.98)',
        }}
      >
        <div style={{color: '#FFD15C', fontSize: 19, fontWeight: 950}}>
          本期沙龙 · 主题画面
        </div>
        <div style={{marginTop: 17, fontSize: 54, lineHeight: 1.06, fontWeight: 950}}>
          {layer.title}
        </div>
        <div style={{marginTop: 16, paddingLeft: 16, borderLeft: '5px solid #68DAFF', fontSize: 25, lineHeight: 1.28, fontWeight: 840}}>
          {layer.detail}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SpeakerIntroCard: React.FC<{layer: SalonLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const reveal = spring({frame: frame - 2, fps, config: {damping: 20, stiffness: 170, mass: 0.82}});
  const exit = interpolate(frame, [Math.max(1, durationInFrames - 9), durationInFrames], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 160,
        zIndex: 230,
        width: 650,
        padding: '27px 31px 25px',
        boxSizing: 'border-box',
        color: '#F8FAFD',
        fontFamily,
        background: 'linear-gradient(135deg, rgba(3,13,20,0.91), rgba(3,13,20,0.62))',
        borderLeft: '7px solid #68DAFF',
        boxShadow: '0 24px 74px rgba(0,0,0,0.46)',
        opacity: reveal * exit,
        transform: `translateX(${interpolate(reveal, [0, 1], [-42, 0])}px)`,
      }}
    >
      <div style={{color: '#68DAFF', fontSize: 18, fontWeight: 950, letterSpacing: 3}}>
        本次分享
      </div>
      <div style={{marginTop: 9, fontSize: 70, lineHeight: 1, fontWeight: 950}}>
        {layer.title}
      </div>
      <div style={{marginTop: 12, color: '#FFD15C', fontSize: 29, fontWeight: 900}}>
        {layer.detail}
      </div>
      <div style={{display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap'}}>
        {layer.items.slice(0, 3).map((item) => (
          <span key={item} style={{padding: '7px 12px', background: 'rgba(255,255,255,0.1)', fontSize: 20, fontWeight: 850}}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

const MetricStack: React.FC<{layer: SalonLayer}> = ({layer}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = Math.min(
    interpolate(frame, [0, 8], [0, 1], clamp),
    interpolate(frame, [Math.max(8, durationInFrames - 8), durationInFrames], [1, 0], clamp),
  );
  return (
    <div style={{position:'absolute',left:58,top:150,width:660,color:'#F8FAFD',fontFamily,opacity,textShadow:'0 4px 18px rgba(0,0,0,0.96)'}}>
      <div style={{color:'#68DAFF',fontSize:20,fontWeight:950}}>现场数据 · 以实录为准</div>
      <div style={{marginTop:12,fontSize:62,lineHeight:1.02,fontWeight:950,color:'#FFD15C'}}>{layer.title}</div>
      <div style={{marginTop:12,fontSize:23,lineHeight:1.25,fontWeight:820,color:'rgba(248,250,253,0.88)'}}>{layer.detail}</div>
      <div style={{marginTop:22,display:'grid',gap:10}}>
        {layer.items.slice(0,3).map((item,index) => {
          const itemReveal = spring({frame:frame-8-index*7,fps,config:{damping:22,stiffness:180,mass:0.82}});
          return <div key={item} style={{display:'grid',gridTemplateColumns:'46px 1fr',alignItems:'center',minHeight:58,padding:'0 15px',background:'rgba(3,13,20,0.43)',borderLeft:`5px solid ${index===0?'#68DAFF':index===1?'#FFD15C':'#65D69A'}`,fontSize:28,fontWeight:920,opacity:itemReveal,transform:`translateX(${(1-itemReveal)*18}px)`}}><span style={{fontSize:16,color:'#68DAFF'}}>0{index+1}</span><span>{item}</span></div>;
        })}
      </div>
    </div>
  );
};

const SalonChapter: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: compositionFps} = useVideoConfig();
  const seconds = frame / compositionFps;
  const chapters = [
    {start:0,index:'01',title:'为什么办这场沙龙'},
    {start:99.9,index:'02',title:'老徐：账号与变现卡点'},
    {start:250.6,index:'03',title:'魏元甲：学生AI实践'},
    {start:295.3,index:'04',title:'黄先生：连接企业需求'},
    {start:337.92,index:'05',title:'李女士：边界与结果'},
    {start:381.04,index:'06',title:'洪岩：企业数据与AI'},
    {start:443.62,index:'07',title:'每个月继续见'},
  ];
  const chapter = [...chapters].reverse().find((item) => seconds >= item.start) ?? chapters[0];
  const reveal = interpolate(seconds - chapter.start, [0, 0.32], [0, 1], clamp);
  return <div style={{position:'absolute',left:54,top:72,zIndex:285,display:'flex',alignItems:'center',gap:10,color:'#F8FAFD',fontFamily,textShadow:'0 3px 15px rgba(0,0,0,0.96)',opacity:reveal}}><span style={{color:'#68DAFF',fontSize:28,fontWeight:950}}>{chapter.index}</span><span style={{width:34,height:2,background:'#68DAFF',transform:`scaleX(${reveal})`,transformOrigin:'left center'}}/><span style={{fontSize:20,fontWeight:900}}>{chapter.title}</span></div>;
};

const renderCustomScene = (scene: V72CustomScene) => {
  const layer = scene.data as unknown as SalonLayer;
  switch (scene.customKey) {
    case 'image-editorial': return <ImageEditorial layer={layer} />;
    case 'speaker-intro': return <SpeakerIntroCard layer={layer} />;
    case 'metric-stack': return <MetricStack layer={layer} />;
    case 'comparison': return <V8ComparisonBars layer={layer} />;
    case 'timeline':
    case 'flow': return <V8ProcessRail layer={layer} />;
    case 'layer-map': return <V8NodeMap layer={layer} />;
    case 'question-grid': return <V8QuestionList layer={layer} />;
    case 'source-branches': return <V8SourceBranches layer={layer} />;
    case 'definition': return <V8HeroDefinition layer={layer} />;
    case 'statement':
    default: return <V8DirectStatement layer={layer} />;
  }
};

const config: V72ProductionConfig = {
  durationSeconds: SALON_HIGHLIGHT_DURATION_SECONDS,
  sourceVideo: 'media/salon-edit-proxy-v1.mp4',
  captionsSrc: 'data/empty-captions.json',
  captionMode: 'chinese',
  brandLabel: '兰州AI实践者共创沙龙 · 第一期',
  sourceFilter: 'contrast(1.025) saturate(1.02) brightness(0.995)',
  sourceOverlay: 'linear-gradient(90deg, rgba(2,7,12,0.15) 0%, rgba(2,7,12,0.02) 52%, rgba(2,7,12,0.02) 100%)',
  motion: {
    cuts: [0,61.06,90.54,99.9,124.88,176.96,216.66,250.6,276.04,281.9,295.3,323.3,337.92,365.72,381.04,383.06,420,443.62,494.42,501.1],
    baseScale: 1.012,
    peakScales: [1.048,1.052,1.046,1.055,1.05],
    peakX: [-7,5,-6,7,-4],
    peakY: [-3,-2,-1,-3,-2],
    transformOrigin: '54% 43%',
  },
  scenes,
  sfxCues,
};

const SalonHighlight: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
    persistentOverlay={<><SalonChapter /><SalonCaptionOverlay /></>}
  />
);

export const SalonHighlightWithSfx: React.FC = () => <SalonHighlight soundEnabled />;
export const SalonHighlightNoSfx: React.FC = () => <SalonHighlight soundEnabled={false} />;
