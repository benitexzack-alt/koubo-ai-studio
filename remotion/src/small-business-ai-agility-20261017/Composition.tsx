import React, {useEffect, useMemo} from 'react';
import {loadFont} from '@remotion/fonts';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, cancelRender, continueRender, delayRender, useCurrentFrame} from 'remotion';
import type {Caption, EpisodeProps, FrameWindow, MediaSlot, OverlayCue, RuntimePlan} from './types';
import {asset, cameraScale, CAPTION_REGION, DEFAULT_REGION, easeOut, eventFrame, inside, mix, opacity, progress, smooth, TYPE, validateRuntimePlan} from './runtime';

const DISPLAY = 'SmallBusinessAgility20261017-Display';
const CAPTION = 'SmallBusinessAgility20261017-Caption';
const C = {ink: '#16252d', cream: '#f2eadc', white: '#fffdf8', accent: '#e1b96d', muted: '#c8d1d4'};
const mediaError = (src: string) => (error: Error) => cancelRender(new Error(`本期媒体不可用：${src}；${error.message}`));
export const MEDIA_LAYOUT = {presenter: {x: 64, y: 620, width: 400, height: 225},
  paper: {x: 520, y: 90, width: 1344, height: 768}, transitionFrames: 8} as const;

/** 连续资料共用一次真人缩入/回全屏；片段边界不改变真人位置。 */
export const mergePresenterWindows = (slots: MediaSlot[]): FrameWindow[] => {
  const windows = slots.filter((slot) => slot.state === 'ready' && slot.window && slot.asset)
    .map((slot) => ({...slot.window!})).sort((a, b) => a.from - b.from);
  return windows.reduce<FrameWindow[]>((runs, window) => {
    const last = runs.at(-1);
    if (last && window.from <= last.to) last.to = Math.max(last.to, window.to);
    else runs.push(window);
    return runs;
  }, []);
};
export const presenterMix = (frame: number, window?: FrameWindow) => window
  ? smooth(Math.min(progress(frame, window.from, MEDIA_LAYOUT.transitionFrames),
    1 - progress(frame, window.to - MEDIA_LAYOUT.transitionFrames, MEDIA_LAYOUT.transitionFrames))) : 0;

const EvidenceImage: React.FC<{slot: MediaSlot; plan: RuntimePlan}> = ({slot, plan}) => {
  const media = slot.asset!;
  const crop = media.imageFocus;
  if (!crop) return <Img src={asset(media.src, plan)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />;
  const scale = Math.min(1344 / crop.width, 756 / crop.height);
  return <AbsoluteFill style={{backgroundColor: '#000', alignItems: 'center', justifyContent: 'center'}}>
    <div style={{position: 'relative', width: crop.width * scale, height: crop.height * scale, overflow: 'hidden'}}>
      <Img src={asset(media.src, plan)} style={{position: 'absolute', width: crop.sourceWidth * scale,
        height: crop.sourceHeight * scale, maxWidth: 'none', left: -crop.x * scale, top: -crop.y * scale}} />
    </div>
  </AbsoluteFill>;
};

const highlighted = (text: string, words: string[]) => {
  const sorted = [...words].filter(Boolean).sort((a, b) => b.length - a.length);
  const parts: Array<{text: string; hot: boolean}> = [];
  let offset = 0;
  while (offset < text.length) {
    const match = sorted.find((word) => text.startsWith(word, offset));
    if (match) {parts.push({text: match, hot: true}); offset += match.length;}
    else {
      const next = sorted.map((word) => text.indexOf(word, offset + 1)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? text.length;
      parts.push({text: text.slice(offset, next), hot: false}); offset = next;
    }
  }
  return parts;
};

const BilingualCaption: React.FC<{caption: Caption; frame: number}> = ({caption, frame}) => (
  <div data-caption={caption.id} style={{position: 'absolute', left: CAPTION_REGION.x, top: CAPTION_REGION.y,
    width: CAPTION_REGION.width, height: CAPTION_REGION.height, boxSizing: 'border-box', padding: '8px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontFamily: `"${CAPTION}", "PingFang SC", sans-serif`, textAlign: 'center', zIndex: 100,
    background: 'linear-gradient(90deg,rgba(5,11,17,0),rgba(5,11,17,.68) 10%,rgba(5,11,17,.68) 90%,rgba(5,11,17,0))',
    opacity: opacity(frame, caption, 2)}}>
    <div style={{width: '100%', fontSize: 44, lineHeight: 1.08, color: '#F7FAFF', fontWeight: 900,
      WebkitTextStroke: '1px rgba(0,0,0,.86)', paintOrder: 'stroke fill', textShadow: '0 3px 8px #000', overflowWrap: 'break-word'}}>
      {highlighted(caption.chinese, caption.highlights).map((part, index) => <span key={index}
        style={{color: part.hot ? '#FFD23F' : undefined}}>{part.text}</span>)}
    </div>
    <div style={{width: '100%', color: 'rgba(247,250,255,.87)', fontSize: 22, lineHeight: 1.1,
      fontWeight: 600, textShadow: '0 2px 6px #000', overflowWrap: 'break-word'}}>{caption.english}</div>
  </div>
);

/** 继承已测试的短入场、旧标签保持和逐项累积；内容与时点全由本期数据提供。 */
const TagStack: React.FC<{cue: OverlayCue; plan: RuntimePlan; frame: number}> = ({cue, plan, frame}) => (
  <div style={{display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 16}}>
    {cue.items.map((item, index) => {
      const at = eventFrame(plan, item.eventId);
      const arrive = easeOut(progress(frame, at, 7));
      return <div key={index} style={{fontSize: TYPE.supporting, lineHeight: 1.18, color: C.ink,
        backgroundColor: C.cream, padding: '14px 20px', borderLeft: `6px solid ${C.accent}`, borderRadius: 4,
        opacity: progress(frame, at, 3), transform: `translateY(${12 * (1 - arrive)}px) scale(${.9 + .1 * arrive})`,
        transformOrigin: '0 50%', boxShadow: '0 8px 20px rgba(0,0,0,.13)'}}>{item.text}</div>;
    })}
  </div>
);

/** 两个问题或观点依实录先后出现；后者强调时保留前者，接回真人回答。 */
const WordingComparison: React.FC<{cue: OverlayCue; plan: RuntimePlan; frame: number}> = ({cue, plan, frame}) => {
  const selected = cue.emphasisEventId ? smooth(progress(frame, eventFrame(plan, cue.emphasisEventId), 12)) : 0;
  return <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
    {cue.items.map((item, index) => {
      const at = eventFrame(plan, item.eventId);
      const enter = easeOut(progress(frame, at, 10));
      const second = index === 1;
      return <div key={index} style={{minHeight: 82, padding: '16px 22px', boxSizing: 'border-box',
        fontSize: TYPE.title, lineHeight: 1.08, whiteSpace: 'pre-line', borderRadius: 5, color: C.ink,
        backgroundColor: second ? C.accent : C.cream, opacity: progress(frame, at, 4) * (second ? 1 : 1 - selected * .26),
        outline: second ? `${selected * 3}px solid rgba(242,234,220,.9)` : undefined,
        transform: `translateX(${18 * (1 - enter)}px)`, boxShadow: '0 8px 20px rgba(0,0,0,.13)'}}>{item.text}</div>;
    })}
  </div>;
};

const HookReveal: React.FC<{cue: OverlayCue; plan: RuntimePlan; frame: number}> = ({cue, plan, frame}) => {
  const arrive = easeOut(progress(frame, eventFrame(plan, cue.items[0].eventId), 12));
  const focus = smooth(progress(frame, eventFrame(plan, cue.emphasisEventId!) - 8, 8));
  return <div style={{marginTop: 40, width: '100%', padding: '24px 20px', boxSizing: 'border-box',
    color: C.ink, backgroundColor: C.accent, borderRadius: 5, fontSize: TYPE.title,
    clipPath: `inset(0 ${100 * (1 - arrive)}% 0 0)`, transform: `translateX(${16 * (1 - arrive)}px)`,
    boxShadow: `0 0 0 ${focus * 3}px rgba(242,234,220,.85),0 10px 22px rgba(0,0,0,.18)`}}>{cue.items[0].text}</div>;
};

/** 六个岗位是并列选择；每项占有固定槽位，后出现的标签不挤动旧标签。 */
const RoleGrid: React.FC<{cue: OverlayCue; plan: RuntimePlan; frame: number}> = ({cue, plan, frame}) => (
  <div data-role-layout="parallel-3-by-2" style={{display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
    gridTemplateRows: 'repeat(2,84px)', gap: 12}}>
    {cue.items.map((item) => {
      const at = eventFrame(plan, item.eventId);
      const enter = easeOut(progress(frame, at, 7));
      return <div key={item.eventId} style={{display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px 16px', boxSizing: 'border-box', borderLeft: `6px solid ${C.accent}`, borderRadius: 4,
        fontSize: TYPE.supporting, lineHeight: 1.18, whiteSpace: 'nowrap', color: C.ink, backgroundColor: C.cream,
        opacity: progress(frame, at, 3), transform: `translateY(${12 * (1 - enter)}px)`,
        boxShadow: '0 8px 20px rgba(0,0,0,.13)'}}>{item.text}</div>;
    })}
  </div>
);

const InformationLayer: React.FC<{cue: OverlayCue; plan: RuntimePlan; frame: number}> = ({cue, plan, frame}) => {
  const avoidance = plan.avoidanceWindows.find((window) => inside(frame, window));
  if (avoidance?.region === null) return null;
  const region = avoidance?.region ?? cue.region ?? DEFAULT_REGION;
  return <div data-motion={cue.kind} style={{position: 'absolute', left: region.x, top: region.y,
    width: region.width, height: region.height, opacity: opacity(frame, cue), boxSizing: 'border-box',
    fontFamily: `"${DISPLAY}", "PingFang SC", sans-serif`, color: C.white,
    textShadow: '0 2px 8px rgba(0,0,0,.7)'}}>
    {cue.title ? <div style={{fontSize: TYPE.category, lineHeight: 1.2, marginBottom: 18, color: C.cream}}>{cue.title}</div> : null}
    {cue.kind === 'role-grid' ? <RoleGrid cue={cue} plan={plan} frame={frame} /> :
      cue.kind === 'hook-reveal' ? <HookReveal cue={cue} plan={plan} frame={frame} /> :
      cue.kind === 'comparison' ? <WordingComparison cue={cue} plan={plan} frame={frame} /> : <TagStack cue={cue} plan={plan} frame={frame} />}
  </div>;
};

const MediaStage: React.FC<{slot: MediaSlot; plan: RuntimePlan; frame: number; presentationWindow: FrameWindow}> = ({slot, plan, frame, presentationWindow}) => {
  if (slot.state !== 'ready' || !slot.window || !slot.asset) return null;
  const media = slot.asset;
  const duration = slot.window.to - slot.window.from;
  const sourceIn = Math.round(media.sourceInFrame / media.sourceFps * plan.fps);
  if (slot.kind === 'paper') return <AbsoluteFill style={{backgroundColor: '#17272f'}}>
    <Sequence from={slot.window.from} durationInFrames={duration} premountFor={30}>
      <div style={{position: 'absolute', left: MEDIA_LAYOUT.paper.x, top: MEDIA_LAYOUT.paper.y,
        width: MEDIA_LAYOUT.paper.width, height: MEDIA_LAYOUT.paper.height,
        opacity: opacity(frame, presentationWindow, 5)}}>
        {media.type === 'image' ? <Img src={asset(media.src, plan)} style={{width: '100%', height: '100%', objectFit: 'contain'}} /> :
          <OffthreadVideo src={asset(media.src, plan)} muted playbackRate={1} trimBefore={sourceIn} trimAfter={sourceIn + duration}
            style={{width: '100%', height: '100%', objectFit: 'contain'}} onError={mediaError(media.src)} />}
      </div>
      {media.audioDisposition === 'preserve' && media.nativeAudio ? <Audio src={asset(media.nativeAudio.src, plan)}
        trimBefore={sourceIn} trimAfter={sourceIn + duration} playbackRate={1} volume={media.nativeAudio.gain}
        onError={mediaError(media.nativeAudio.src)} /> : null}
    </Sequence>
    <div style={{position: 'absolute', right: 64, top: 36, padding: '5px 10px',
      fontFamily: `"${CAPTION}", "PingFang SC", sans-serif`, fontSize: 24, color: C.white,
      backgroundColor: 'rgba(23,39,47,.85)'}}>AI生成·纸艺示意</div>
  </AbsoluteFill>;
  return <AbsoluteFill style={{background: 'linear-gradient(115deg,#e8e2d6,#f4eee4 65%,#e1dbce)'}}>
    <div style={{position: 'absolute', left: 64, top: 148, width: 400, fontFamily: `"${DISPLAY}", "PingFang SC", sans-serif`,
      fontSize: TYPE.title, lineHeight: 1.2, color: '#35424a'}}>{slot.displayTitle}</div>
    <div style={{position: 'absolute', left: 64, top: 500, width: 400, color: '#58615b', fontFamily: `"${CAPTION}", "PingFang SC", sans-serif`,
      fontSize: 24, lineHeight: 1.35, overflowWrap: 'break-word'}}>{slot.sourceLabel}</div>
    <Sequence from={slot.window.from} durationInFrames={duration} premountFor={30}>
      <div style={{position: 'absolute', left: 520, top: 90, width: 1344, height: 756, overflow: 'hidden',
        opacity: opacity(frame, presentationWindow, 5), borderRadius: 4, boxShadow: '0 12px 28px rgba(30,39,42,.17)', backgroundColor: '#f8f4ed'}}>
        {media.type === 'image' ? <EvidenceImage slot={slot} plan={plan} /> :
          <OffthreadVideo src={asset(media.src, plan)} muted playbackRate={1} trimBefore={sourceIn} trimAfter={sourceIn + duration}
            style={{width: '100%', height: '100%', objectFit: 'contain'}} onError={mediaError(media.src)} />}
      </div>
      {media.audioDisposition === 'preserve' && media.nativeAudio ? <Audio src={asset(media.nativeAudio.src, plan)}
        trimBefore={sourceIn} trimAfter={sourceIn + duration} playbackRate={1} volume={media.nativeAudio.gain}
        onError={mediaError(media.nativeAudio.src)} /> : null}
    </Sequence>
  </AbsoluteFill>;
};

const AddedSound: React.FC<{plan: RuntimePlan}> = ({plan}) => <>{plan.sfx.map((cue) => {
  const duration = cue.trimAfterFrame - cue.trimBeforeFrame;
  const from = eventFrame(plan, cue.eventId) - cue.transientOffsetFrames;
  return <Sequence key={cue.id} from={from} durationInFrames={duration}>
    <Audio src={asset(cue.src, plan)} trimBefore={cue.trimBeforeFrame} trimAfter={cue.trimAfterFrame} playbackRate={1}
      volume={(frame) => cue.gain * (cue.fadeInFrames === 0 ? 1 : progress(frame, 0, cue.fadeInFrames)) *
        (cue.fadeOutFrames === 0 ? 1 : 1 - progress(frame, duration - cue.fadeOutFrames, cue.fadeOutFrames))}
      onError={mediaError(cue.src)} />
  </Sequence>;
})}</>;

export const SmallBusinessAiAgility: React.FC<EpisodeProps> = ({plan, withSfx, mode}) => {
  const frame = useCurrentFrame();
  useMemo(() => validateRuntimePlan(plan, mode), [plan, mode]);
  useEffect(() => {
    const handle = delayRender('加载本期本地字体');
    Promise.all([
      loadFont({family: DISPLAY, url: asset(plan.fonts.displaySrc, plan), format: 'woff2', weight: '400', display: 'block'}),
      loadFont({family: CAPTION, url: asset(plan.fonts.captionSrc, plan), format: 'truetype', weight: '400 900', display: 'block'}),
    ]).then(() => continueRender(handle)).catch((error: unknown) => cancelRender(new Error(`本期字体不可用：${String(error)}`)));
  }, [plan.fonts.displaySrc, plan.fonts.captionSrc, plan.assetPrefix]);
  // pending 只留同一条真人底片；不给观众显示槽位、生产编号或“待补”标签。
  const activeMedia = plan.mediaSlots.find((slot) => slot.state === 'ready' && slot.window && inside(frame, slot.window));
  const presenterWindows = useMemo(() => mergePresenterWindows(plan.mediaSlots), [plan.mediaSlots]);
  const mediaWindow = presenterWindows.find((window) => inside(frame, window));
  const m = presenterMix(frame, mediaWindow);
  const camera = plan.cameraWindows.find((window) => inside(frame, window));
  const zoom = mix(cameraScale(frame, camera), 1, m);
  const caption = plan.captions.find((item) => inside(frame, item));
  return <AbsoluteFill translate="no" className="notranslate" style={{backgroundColor: '#17272f', overflow: 'hidden'}}>
    {activeMedia && mediaWindow ? <MediaStage slot={activeMedia} plan={plan} frame={frame} presentationWindow={mediaWindow} /> : null}
    <div data-presenter="continuous-original-source" style={{position: 'absolute', left: mix(0, MEDIA_LAYOUT.presenter.x, m),
      top: mix(0, MEDIA_LAYOUT.presenter.y, m),
      width: mix(1920, MEDIA_LAYOUT.presenter.width, m), height: mix(1080, MEDIA_LAYOUT.presenter.height, m),
      opacity: 1, borderRadius: 10 * m, overflow: 'hidden',
      boxShadow: m ? '0 10px 28px rgba(20,28,32,.2)' : undefined}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: `${camera?.origin?.x ?? 55}% ${camera?.origin?.y ?? 44}%`}}>
        <OffthreadVideo src={asset(plan.host.src, plan)} muted playbackRate={1} trimBefore={plan.host.trimBeforeFrame}
          trimAfter={plan.host.trimAfterFrame} style={{width: '100%', height: '100%', objectFit: 'cover'}} onError={mediaError(plan.host.src)} />
      </div>
    </div>
    {!activeMedia ? plan.overlays.filter((cue) => inside(frame, cue)).map((cue) => <InformationLayer key={cue.id} cue={cue} plan={plan} frame={frame} />) : null}
    <div style={{position: 'absolute', left: 64, top: 36, fontFamily: `"${CAPTION}", "PingFang SC", sans-serif`, fontSize: 24,
      fontWeight: 900, color: activeMedia?.kind === 'real-evidence' ? '#53616a' : 'rgba(247,250,255,.88)',
      textShadow: activeMedia?.kind === 'real-evidence' ? 'none' : '0 2px 8px rgba(0,0,0,.7)'}}>超哥AI创业记</div>
    {caption ? <BilingualCaption caption={caption} frame={frame} /> : null}
    <Audio src={asset(plan.voice.src, plan)} trimBefore={plan.voice.trimBeforeFrame} trimAfter={plan.voice.trimAfterFrame}
      volume={1} playbackRate={1} onError={mediaError(plan.voice.src)} />
    {withSfx ? <AddedSound plan={plan} /> : null}
  </AbsoluteFill>;
};
