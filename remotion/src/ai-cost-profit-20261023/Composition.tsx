import React, {useEffect, useMemo} from 'react';
import {loadFont} from '@remotion/fonts';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Freeze, Img, OffthreadVideo, Sequence, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';

type FrameWindow = {from: number; to: number};
type Caption = FrameWindow & {id: string | number; chinese: string; english: string};
type Insert = FrameWindow & {
  shotId: string; src: string; presenter: 'bottom-left'; style: 'paper' | 'pixel';
  nativeAudioSrc?: string; nativeAudioGain?: number;
};
type Evidence = FrameWindow & {
  id: string; src: string; kind: 'video' | 'image'; title: string; credit: string;
  presenter: 'bottom-left'; focus?: {x: number; y: number; width: number; height: number};
  sourceWidth?: number; sourceHeight?: number; trimBeforeFrame?: number;
};
type AiScene = FrameWindow & {
  id: string; src: string; trimBeforeFrame: number; presenter: 'bottom-left'; title?: string;
};
type SpeakerCard = FrameWindow & {
  id: string; lines: string[]; accent?: string | boolean; lineAtFrames?: number[];
};
type SoundCue = {from: number; src: string; gain: number; durationInFrames?: number};
export type RuntimePlan = {
  width: number; height: number; fps: number; durationInFrames: number;
  captions: Caption[];
  host: {src: string; trimBeforeFrame: number; trimAfterFrame: number; sourceDurationInFrames?: number};
  voice: {src: string; gain: number; playbackRate: number};
  inserts: Insert[]; evidence: Evidence[]; aiScenes: AiScene[]; speakerCards: SpeakerCard[]; sfx: SoundCue[];
  fonts: {heading: string; body: string};
};
export type EpisodeProps = {plan: RuntimePlan; withSfx: boolean; mode: 'preview'};
type StageItem = {type: 'insert'; item: Insert} | {type: 'evidence'; item: Evidence} | {type: 'ai-scene'; item: AiScene};

const HEADING = 'AiCostProfit20261023-Heading';
const BODY = 'AiCostProfit20261023-Body';
const C = {ink: '#16252d', cream: '#f2eadc', white: '#fffdf8', accent: '#e1b96d'};
export const LAYOUT = {
  presenter: {x: 64, y: 620, width: 400, height: 225},
  evidence: {x: 520, y: 90, width: 1344, height: 756},
  caption: {x: 64, y: 900, width: 1792, height: 168},
  transitionFrames: 12,
  speakerWords: {x: 64, y: 120, width: 630, rowHeight: 110, rowGap: 10, maxHeight: 350},
} as const;
const inside = (frame: number, window: FrameWindow) => frame >= window.from && frame < window.to;
const progress = (frame: number, from: number, duration: number) => Math.max(0, Math.min(1, (frame - from) / duration));
const smooth = (p: number) => p * p * (3 - 2 * p);
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const mediaError = (src: string) => (error: Error) => cancelRender(new Error(`本期媒体不可用：${src}；${error.message}`));

const validateAsset = (path: string) => {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('..') || /^[a-z]+:/i.test(path)) {
    throw new Error(`本期素材必须使用 public 内相对路径：${path}`);
  }
};
const validateWindow = (window: FrameWindow, name: string) => {
  if (!Number.isInteger(window.from) || !Number.isInteger(window.to) || window.from < 0 || window.to > 9864 || window.to <= window.from) {
    throw new Error(`${name} 的帧窗无效`);
  }
};
const noOverlap = (windows: FrameWindow[], name: string) => {
  const sorted = [...windows].sort((a, b) => a.from - b.from);
  sorted.forEach((window, index) => {
    validateWindow(window, name);
    if (index && sorted[index - 1].to > window.from) throw new Error(`${name} 出现重叠帧窗`);
  });
};

/** 仅验证本期渲染输入；来源、授权、哈希与观看验收由受控导出入口独立绑定。 */
export const validateRuntimePlan = (plan: RuntimePlan, mode: EpisodeProps['mode'] = 'preview') => {
  if (mode !== 'preview') throw new Error('本条仅允许预览模式，尚未登记完整观看验收');
  if (plan.width !== 1920 || plan.height !== 1080 || plan.fps !== 30 || plan.durationInFrames !== 9864) {
    throw new Error('本期固定保留 1920×1080、30fps、9864 帧完整实录');
  }
  if (plan.host.trimBeforeFrame !== 0 || plan.host.trimAfterFrame !== 9864 || plan.voice.gain !== 1 || plan.voice.playbackRate !== 1) {
    throw new Error('本期原声和真人底片必须全量保留、以 1 倍速连续播放');
  }
  if (plan.captions.length !== 164) throw new Error('本期必须保留原字幕全部 164 条');
  const sourceFrames = plan.host.sourceDurationInFrames ?? plan.durationInFrames;
  if (!Number.isInteger(sourceFrames) || sourceFrames < plan.durationInFrames - 1 || sourceFrames > plan.durationInFrames) {
    throw new Error('真人原片必须覆盖完整实录，最多补最后 1 帧，不得冻结长段');
  }
  if (plan.inserts.length !== 11 || new Set(plan.inserts.map((item) => item.shotId)).size !== 11 ||
    plan.inserts.some((item) => !/^P(0[1-9]|1[01])$/.test(item.shotId))) throw new Error('本期必须保留 P01 至 P11 全部插片');
  noOverlap(plan.captions, '字幕');
  noOverlap([...plan.inserts, ...plan.evidence, ...plan.aiScenes], '主画面');
  noOverlap(plan.speakerCards, '真人字卡');
  [plan.host.src, plan.voice.src, plan.fonts.heading, plan.fonts.body].forEach(validateAsset);
  for (const item of [...plan.inserts, ...plan.evidence, ...plan.aiScenes]) {
    validateAsset(item.src);
    if (item.presenter !== 'bottom-left') throw new Error('本期资料与插片必须保留左下真人');
  }
  for (const insert of plan.inserts) {
    if (insert.style !== 'paper' && insert.style !== 'pixel') throw new Error('本期代码插片仅接受纸艺或像素风');
    if (insert.nativeAudioSrc) validateAsset(insert.nativeAudioSrc);
    if (insert.nativeAudioGain !== undefined && (!Number.isFinite(insert.nativeAudioGain) || insert.nativeAudioGain < 0)) {
      throw new Error(`${insert.shotId} 的拟音增益无效`);
    }
  }
  for (const item of [...plan.evidence, ...plan.aiScenes]) {
    if (!Number.isInteger(item.trimBeforeFrame ?? 0) || (item.trimBeforeFrame ?? 0) < 0) {
      throw new Error(`${item.id} 的素材入点必须为非负整数帧`);
    }
  }
  for (const item of plan.evidence) {
    if (!item.title || !item.credit) throw new Error('真实素材必须显示说明与来源');
    if (item.focus) {
      const {x, y, width, height} = item.focus;
      if (!item.sourceWidth || !item.sourceHeight || x < 0 || y < 0 || width <= 0 || height <= 0 ||
        x + width > item.sourceWidth || y + height > item.sourceHeight) throw new Error(`${item.id} 的原画面裁切越界`);
    }
  }
  for (const card of plan.speakerCards) {
    if (!card.lines.length || card.lines.length > 3) throw new Error(`${card.id} 的字卡必须为 1 至 3 行`);
    if (card.lineAtFrames && (card.lineAtFrames.length !== card.lines.length ||
      card.lineAtFrames.some((frame, index) => !Number.isInteger(frame) || frame < card.from || frame >= card.to ||
        (index > 0 && frame < card.lineAtFrames![index - 1])))) throw new Error(`${card.id} 的逐行出现时间无效`);
  }
  for (const sound of plan.sfx) {
    validateAsset(sound.src);
    if (!Number.isInteger(sound.from) || sound.from < 0 || sound.from >= 9864 || !Number.isFinite(sound.gain) || sound.gain < 0) {
      throw new Error('本期音效起点或增益无效');
    }
  }
};

/** 连续或只差一帧的镜头保持小窗；只补一帧取整间隙，不冻结长段资料。 */
export const mergePresenterWindows = (windows: FrameWindow[]): FrameWindow[] => [...windows]
  .sort((a, b) => a.from - b.from)
  .reduce<FrameWindow[]>((runs, window) => {
    const last = runs.at(-1);
    if (last && window.from - last.to <= 1) last.to = Math.max(last.to, window.to);
    else runs.push({...window});
    return runs;
  }, []);

const presenterMix = (frame: number, window?: FrameWindow) => window
  ? smooth(Math.min(progress(frame, window.from, LAYOUT.transitionFrames),
    1 - progress(frame, window.to - LAYOUT.transitionFrames, LAYOUT.transitionFrames))) : 0;

const MediaVisual: React.FC<{item: Evidence}> = ({item}) => {
  const focus = item.focus;
  const style: React.CSSProperties = focus ? (() => {
    const scale = Math.min(LAYOUT.evidence.width / focus.width, LAYOUT.evidence.height / focus.height);
    return {position: 'absolute', width: item.sourceWidth! * scale, height: item.sourceHeight! * scale,
      maxWidth: 'none', left: -focus.x * scale, top: -focus.y * scale};
  })() : {width: '100%', height: '100%', objectFit: 'contain'};
  const content = item.kind === 'image'
    ? <Img src={staticFile(item.src)} style={style}
      onError={() => cancelRender(new Error(`本期图片不可用：${item.src}`))} />
    : <OffthreadVideo src={staticFile(item.src)} muted playbackRate={1} trimBefore={item.trimBeforeFrame ?? 0}
      style={style} onError={mediaError(item.src)} />;
  if (!focus) return content;
  const scale = Math.min(LAYOUT.evidence.width / focus.width, LAYOUT.evidence.height / focus.height);
  return <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
    <div style={{position: 'relative', width: focus.width * scale, height: focus.height * scale, overflow: 'hidden'}}>{content}</div>
  </AbsoluteFill>;
};

const MediaStage: React.FC<{stage: StageItem; hold: boolean; globalFrame: number}> = ({stage, hold, globalFrame}) => {
  const {item} = stage;
  const duration = item.to - item.from;
  const lastFrame = duration - 1;
  const video = stage.type === 'insert'
    ? <OffthreadVideo src={staticFile(item.src)} muted playbackRate={1}
      style={{width: '100%', height: '100%', objectFit: 'contain'}} onError={mediaError(item.src)} />
    : stage.type === 'ai-scene'
      ? <OffthreadVideo src={staticFile(stage.item.src)} muted playbackRate={1} trimBefore={stage.item.trimBeforeFrame}
        style={{width: '100%', height: '100%', objectFit: 'contain'}} onError={mediaError(stage.item.src)} />
      : <MediaVisual item={stage.item} />;
  const sequence = <Sequence from={item.from} durationInFrames={Math.max(duration, globalFrame - item.from + 1)} premountFor={30}>
    {hold ? <Freeze frame={lastFrame}>{video}</Freeze> : video}
  </Sequence>;
  if (stage.type === 'insert') return <AbsoluteFill style={{backgroundColor: '#17272f'}}>
    {sequence}
    <div style={{position: 'absolute', left: 64, top: 72, padding: '6px 12px', borderRadius: 4,
      fontFamily: `"${BODY}", "PingFang SC", sans-serif`, fontSize: 24, lineHeight: 1.25,
      color: C.white, backgroundColor: 'rgba(23,39,47,.82)'}}>AI生成·{stage.item.style === 'paper' ? '纸艺' : '像素'}示意</div>
  </AbsoluteFill>;
  return <AbsoluteFill style={{background: 'linear-gradient(115deg,#e8e2d6,#f4eee4 65%,#e1dbce)'}}>
    <div style={{position: 'absolute', left: 64, top: 144, width: 400, color: '#35424a',
      fontFamily: `"${HEADING}", "PingFang SC", sans-serif`, fontSize: 50, lineHeight: 1.22,
      whiteSpace: 'pre-line', overflowWrap: 'break-word'}}>{stage.type === 'ai-scene' ? (stage.item.title ?? 'AI情景示意') : stage.item.title}</div>
    <div style={{position: 'absolute', left: 64, top: 476, width: 400, color: '#58615b',
      fontFamily: `"${BODY}", "PingFang SC", sans-serif`, fontSize: 26, lineHeight: 1.4,
      whiteSpace: 'pre-line', overflowWrap: 'break-word'}}>{stage.type === 'ai-scene' ? 'AI生成 · 情景示意' : stage.item.credit}</div>
    <div style={{position: 'absolute', left: LAYOUT.evidence.x, top: LAYOUT.evidence.y,
      width: LAYOUT.evidence.width, height: LAYOUT.evidence.height, overflow: 'hidden',
      borderRadius: 5, backgroundColor: '#f8f4ed', boxShadow: '0 12px 28px rgba(30,39,42,.17)'}}>{sequence}</div>
  </AbsoluteFill>;
};

/** 同一原句的词组依次展开，旧词组停留在固定槽位，不挤动新词组。 */
const SpeakerWords: React.FC<{card: SpeakerCard; frame: number; opacity: number}> = ({card, frame, opacity}) => {
  const accent = typeof card.accent === 'string' ? card.accent : C.accent;
  const fade = 1 - progress(frame, card.to - 8, 8);
  return <div data-speaker-card={card.id} style={{position: 'absolute', left: LAYOUT.speakerWords.x, top: LAYOUT.speakerWords.y, width: LAYOUT.speakerWords.width,
    zIndex: 30, opacity: opacity * fade, fontFamily: `"${HEADING}", "PingFang SC", sans-serif`}}>
    {card.lines.map((line, index) => {
      const at = card.lineAtFrames?.[index] ?? card.from + index * Math.max(12, Math.min(36, Math.floor((card.to - card.from) / (card.lines.length + 1))));
      const p = easeOut(progress(frame, at, 10));
      const glyphCount = Array.from(line).reduce((sum, character) => sum + (/[\x00-\xff]/.test(character) ? .55 : 1), 0);
      const fontSize = Math.min(glyphCount <= 6 ? 88 : 76, Math.floor(574 / Math.max(1, glyphCount)));
      return <div key={index} style={{position: 'relative', marginBottom: index === card.lines.length - 1 ? 0 : LAYOUT.speakerWords.rowGap, width: '100%', boxSizing: 'border-box',
        height: LAYOUT.speakerWords.rowHeight, display: 'flex', alignItems: 'center', padding: '8px 18px 10px 22px',
        borderRadius: 6, borderLeft: `6px solid ${accent}`, backgroundColor: 'rgba(20,39,47,.82)',
        color: index === card.lines.length - 1 && card.accent !== false ? accent : C.white,
        fontSize, lineHeight: 1.08, whiteSpace: 'nowrap', textShadow: '0 2px 6px rgba(0,0,0,.24)',
        opacity: p, transform: `translateX(${(1 - p) * -18}px) scale(${.985 + p * .015})`, transformOrigin: '0 50%'}}>
        {index > 0 ? <div style={{position: 'absolute', left: -6, top: -LAYOUT.speakerWords.rowGap, width: 6, height: LAYOUT.speakerWords.rowGap,
          backgroundColor: accent, transform: `scaleY(${p})`, transformOrigin: '50% 0'}} /> : null}
        {line}
      </div>;
    })}
  </div>;
};

const Captions: React.FC<{caption: Caption}> = ({caption}) => <div data-caption={caption.id} style={{
  position: 'absolute', left: LAYOUT.caption.x, top: LAYOUT.caption.y, width: LAYOUT.caption.width,
  height: LAYOUT.caption.height, boxSizing: 'border-box', padding: '8px 24px', zIndex: 100,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontFamily: `"${BODY}", "PingFang SC", sans-serif`, textAlign: 'center',
  background: 'linear-gradient(90deg,rgba(5,11,17,0),rgba(5,11,17,.74) 8%,rgba(5,11,17,.74) 92%,rgba(5,11,17,0))',
}}>
  <div style={{width: '100%', color: '#F7FAFF', fontSize: 44, lineHeight: 1.12, fontWeight: 900,
    WebkitTextStroke: '1px rgba(0,0,0,.86)', paintOrder: 'stroke fill', textShadow: '0 3px 8px #000',
    overflowWrap: 'break-word'}}>{caption.chinese}</div>
  <div style={{width: '100%', color: 'rgba(247,250,255,.9)', fontSize: 22, lineHeight: 1.16,
    fontWeight: 600, textShadow: '0 2px 6px #000', overflowWrap: 'break-word'}}>{caption.english}</div>
</div>;

export const AiCostProfit20261023: React.FC<EpisodeProps> = ({plan, withSfx, mode}) => {
  const frame = useCurrentFrame();
  useMemo(() => {
    validateRuntimePlan(plan, mode);
  }, [plan, mode]);
  useEffect(() => {
    const handle = delayRender('加载本期本地字体');
    Promise.all([
      loadFont({family: HEADING, url: staticFile(plan.fonts.heading), format: 'woff2', weight: '400', display: 'block'}),
      loadFont({family: BODY, url: staticFile(plan.fonts.body), format: 'truetype', weight: '400 900', display: 'block'}),
    ]).then(() => continueRender(handle)).catch((error: unknown) => cancelRender(new Error(`本期字体不可用：${String(error)}`)));
  }, [plan.fonts.heading, plan.fonts.body]);
  const stages = useMemo<StageItem[]>(() => [
    ...plan.inserts.map((item): StageItem => ({type: 'insert', item})),
    ...plan.evidence.map((item): StageItem => ({type: 'evidence', item})),
    ...plan.aiScenes.map((item): StageItem => ({type: 'ai-scene', item})),
  ].sort((a, b) => a.item.from - b.item.from), [plan.inserts, plan.evidence, plan.aiScenes]);
  const presenterWindows = useMemo(() => mergePresenterWindows(stages.map(({item}) => item)), [stages]);
  const window = presenterWindows.find((item) => inside(frame, item));
  const active = stages.find(({item}) => inside(frame, item));
  const hold = !active && window ? [...stages].reverse().find(({item}) => item.to <= frame && item.to >= window.from) : undefined;
  const stage = active ?? hold;
  const m = presenterMix(frame, window);
  const lastMedia = presenterWindows.filter((item) => item.to <= frame).at(-1);
  const nextMedia = presenterWindows.find((item) => item.from > frame);
  const speakerFrom = lastMedia?.to ?? 0;
  const speakerTo = nextMedia?.from ?? plan.durationInFrames;
  // 每段真人讲解缓慢推进一次；从资料返回时以相同窗口消除缩放突跳。
  const cameraPhase = smooth(progress(frame, speakerFrom, Math.max(30, (speakerTo - speakerFrom) * .85)));
  const baseCameraScale = window
    ? (frame < window.from + LAYOUT.transitionFrames && window.from > 0 ? 1.045 : 1)
    : 1 + .045 * cameraPhase;
  const cameraScale = mix(baseCameraScale, 1, m);
  const caption = plan.captions.find((item) => inside(frame, item));
  const card = plan.speakerCards.find((item) => inside(frame, item));
  const sourceFrames = plan.host.sourceDurationInFrames ?? plan.durationInFrames;
  const presenterVideo = <OffthreadVideo src={staticFile(plan.host.src)} muted playbackRate={1}
    trimBefore={plan.host.trimBeforeFrame} trimAfter={Math.min(plan.host.trimAfterFrame, sourceFrames)}
    style={{width: '100%', height: '100%', objectFit: 'cover'}} onError={mediaError(plan.host.src)} />;
  return <AbsoluteFill translate="no" className="notranslate" style={{backgroundColor: '#17272f', overflow: 'hidden'}}>
    {stage ? <MediaStage stage={stage} hold={Boolean(hold)} globalFrame={frame} /> : null}
    <div data-presenter="continuous-original-source" style={{position: 'absolute',
      left: mix(0, LAYOUT.presenter.x, m), top: mix(0, LAYOUT.presenter.y, m),
      width: mix(plan.width, LAYOUT.presenter.width, m), height: mix(plan.height, LAYOUT.presenter.height, m),
      borderRadius: 10 * m, overflow: 'hidden', zIndex: 20,
      boxShadow: m ? '0 10px 28px rgba(20,28,32,.24)' : undefined}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${cameraScale})`, transformOrigin: '58% 42%'}}>
        {frame >= sourceFrames ? <Freeze frame={sourceFrames - 1}>{presenterVideo}</Freeze> : presenterVideo}
      </div>
    </div>
    {card && !active ? <SpeakerWords card={card} frame={frame} opacity={1 - m} /> : null}
    <div style={{position: 'absolute', left: 64, top: 36, fontFamily: `"${BODY}", "PingFang SC", sans-serif`,
      fontSize: 24, fontWeight: 900, color: stage && stage.type !== 'insert' && m > .5 ? '#53616a' : 'rgba(247,250,255,.88)',
      textShadow: stage && stage.type !== 'insert' && m > .5 ? 'none' : '0 2px 8px rgba(0,0,0,.7)', zIndex: 40}}>超哥AI创业记</div>
    {caption ? <Captions caption={caption} /> : null}
    <Audio src={staticFile(plan.voice.src)} volume={1} playbackRate={1} onError={mediaError(plan.voice.src)} />
    {withSfx ? <>
      {plan.inserts.map((insert) => <Sequence key={insert.shotId} from={insert.from} durationInFrames={insert.to - insert.from} premountFor={30}>
        <Audio src={staticFile(insert.nativeAudioSrc ?? insert.src)} playbackRate={1}
          volume={(localFrame) => (insert.nativeAudioGain ?? .3) * smooth(progress(localFrame, 0, 3)) *
            (1 - smooth(progress(localFrame, insert.to - insert.from - 4, 4)))}
          onError={mediaError(insert.nativeAudioSrc ?? insert.src)} />
      </Sequence>)}
      {plan.sfx.map((cue, index) => <Sequence key={`${cue.src}-${cue.from}-${index}`} from={cue.from}
        durationInFrames={cue.durationInFrames ?? plan.durationInFrames - cue.from} premountFor={30}>
        <Audio src={staticFile(cue.src)} volume={cue.gain} playbackRate={1} onError={mediaError(cue.src)} />
      </Sequence>)}
    </> : null}
  </AbsoluteFill>;
};
