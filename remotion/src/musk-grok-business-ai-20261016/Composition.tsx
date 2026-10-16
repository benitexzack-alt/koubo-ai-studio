import React, {useEffect, useMemo} from 'react';
import {loadFont} from '@remotion/fonts';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, cancelRender, continueRender, delayRender, useCurrentFrame} from 'remotion';
import type {Caption, EpisodeProps, FrameWindow, MediaSlot, OverlayCue, RuntimePlan} from './types';
import {asset, cameraScale, CAPTION_REGION, DEFAULT_REGION, easeOut, eventFrame, inside, mix, opacity, progress, smooth, TYPE, validateRuntimePlan} from './runtime';

const DISPLAY = 'MuskGrok20261016-Display';
const CAPTION = 'MuskGrok20261016-Caption';
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

/** 两个观点依实录先后出现，后者获得重点；不自动画成已验证的产品调用关系。 */
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
  return <div style={{marginTop: 40, width: 600, padding: '24px 20px', boxSizing: 'border-box',
    color: C.ink, backgroundColor: C.accent, borderRadius: 5, fontSize: TYPE.title,
    clipPath: `inset(0 ${100 * (1 - arrive)}% 0 0)`, transform: `translateX(${16 * (1 - arrive)}px)`,
    boxShadow: `0 0 0 ${focus * 3}px rgba(242,234,220,.85),0 10px 22px rgba(0,0,0,.18)`}}>{cue.items[0].text}</div>;
};

export const continuousBusinessPhase = (frame: number, plan: RuntimePlan) => {
  if (frame < eventFrame(plan, 'strongest-question')) return 'pit';
  if (frame < eventFrame(plan, 'no-universal')) return 'expectation';
  if (frame < eventFrame(plan, 'task-0')) return 'negation';
  if (frame < eventFrame(plan, 'strongest-model')) return 'tasks';
  if (frame < eventFrame(plan, 'capabilities')) return 'matching';
  return 'application';
};

/** 四卡先原位收小，再分行横移，最后上提；避免两行卡片斜向交叉。 */
export const taskTagLayout = (frame: number, matchingFrame: number, index: number) => {
  const start = matchingFrame - 14;
  const shrink = smooth(progress(frame, start, 4));
  const shift = smooth(progress(frame, start + 4, 4));
  const lift = smooth(progress(frame, start + 8, 6));
  return {
    left: mix(22 + (index % 2) * 292, 22 + index * 146, shift),
    top: mix(94 + Math.floor(index / 2) * 106, 20, lift),
    width: mix(270, 138, shrink), height: mix(82, 48, shrink),
    fontSize: mix(TYPE.supporting, TYPE.category, shrink),
  };
};

/** 复用10/14同容器转义、原对象缩为标题、旧标签不动及共同工作容器；不重播旧内容。 */
const ContinuousBusiness: React.FC<{cue: OverlayCue; plan: RuntimePlan; frame: number}> = ({cue, plan, frame}) => {
  const at = (id: string) => eventFrame(plan, id);
  const txt = (id: string) => cue.items.find((item) => item.eventId === id)!.text;
  const phase = continuousBusinessPhase(frame, plan);
  const question = smooth(progress(frame, at('strongest-question'), 18));
  const tasks = smooth(progress(frame, at('task-0') - 18, 18));
  const matching = smooth(progress(frame, at('strongest-model') - 14, 8));
  const application = smooth(progress(frame, at('capabilities'), 16));
  const selection = smooth(progress(frame, at('match-business'), 12));
  const taskIds = ['task-0', 'task-1', 'task-2', 'task-3'];
  return <div data-upgrade-effect="continuous-business-container" style={{position: 'relative', width: '100%', height: 360,
    background: 'linear-gradient(135deg,rgba(16,32,42,.94),rgba(29,45,53,.88))', borderRadius: 8,
    borderBottom: `${mix(3, 8, Math.max(tasks, selection))}px solid ${C.accent}`, boxSizing: 'border-box',
    boxShadow: '0 14px 32px rgba(0,0,0,.16)', overflow: 'hidden'}}>
    {['pit', 'expectation'].includes(phase) ? <>
      <div style={{position: 'absolute', left: 22, top: mix(42, 20, question), fontSize: mix(TYPE.title, TYPE.category, question),
        color: C.cream}}>{txt('business-pit')}</div>
      <div style={{position: 'absolute', left: 22, top: 142, fontSize: TYPE.title, color: C.accent,
        opacity: progress(frame, at('pit-mark'), 6) * (1 - question),
        transform: `translateY(${-24 * (1 - easeOut(progress(frame, at('pit-mark'), 12)))}px)`}}>{txt('pit-mark')}</div>
      <div style={{position: 'absolute', left: 22, top: 78, fontSize: TYPE.supporting, color: C.cream, opacity: question}}>{txt('strongest-question')}</div>
      <div style={{position: 'absolute', left: 22, top: 148, width: 576, padding: '14px 18px', boxSizing: 'border-box',
        fontSize: TYPE.title, color: C.ink, background: C.cream, borderRadius: 4,
        opacity: progress(frame, at('universal-expect'), 4),
        transform: `scaleX(${.9 + .1 * easeOut(progress(frame, at('universal-expect'), 12))})`, transformOrigin: '0 50%'}}>{txt('universal-expect')}</div>
      <div style={{position: 'absolute', left: 22, top: 270, fontSize: TYPE.category, color: C.muted,
        opacity: progress(frame, at('universal-result'), 6)}}>{txt('universal-result')}</div>
    </> : null}
    {['negation', 'tasks'].includes(phase) ? <div style={{position: 'absolute', left: 22, top: mix(90, 22, tasks),
      width: 576, fontSize: mix(TYPE.title, TYPE.category, tasks), lineHeight: 1.2, color: C.accent,
      opacity: progress(frame, at('no-universal'), 8) * (1 - matching)}}>{txt('no-universal')}</div> : null}
    {['tasks', 'matching'].includes(phase) ? taskIds.map((id, index) => {
      const enter = easeOut(progress(frame, at(id), 7));
      return <div key={id} style={{position: 'absolute', ...taskTagLayout(frame, at('strongest-model'), index),
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        backgroundColor: C.cream, color: C.ink, borderLeft: `5px solid ${C.accent}`, borderRadius: 4,
        opacity: progress(frame, at(id), 3),
        transform: `skewX(-3deg) scale(${.88 + .12 * enter})`, transformOrigin: '0 50%'}}>{txt(id)}</div>;
    }) : null}
    {phase === 'matching' ? <div style={{position: 'absolute', left: 22, top: 104, width: 576, height: 112,
      boxSizing: 'border-box', padding: '10px 18px', backgroundColor: C.cream, color: C.ink, borderRadius: 4,
      fontSize: TYPE.supporting, whiteSpace: 'pre-line', lineHeight: 1.1,
      opacity: progress(frame, at('strongest-model'), 14) * (1 - .26 * selection)}}>{txt('strongest-model')}</div> : null}
    {['matching', 'application'].includes(phase) ? <div style={{position: 'absolute', left: 22, top: mix(246, 20, application),
      width: 576, fontSize: mix(TYPE.title, TYPE.category, application), color: C.accent, lineHeight: 1.1,
      opacity: progress(frame, at('match-business'), 4), padding: '8px 0',
      borderBottom: `${3 * selection * (1 - application)}px solid ${C.cream}`}}>{txt('match-business')}</div> : null}
    {phase === 'application' ? <>
      <div style={{position: 'absolute', left: 22, top: 86, fontSize: TYPE.supporting, color: C.cream,
        opacity: progress(frame, at('capabilities') + 16, 8)}}>{txt('capabilities')}</div>
      {['departments', 'people', 'work-step'].map((id, index) => {
        const enter = easeOut(progress(frame, at(id), 7));
        return <div key={id} style={{position: 'absolute', left: index === 1 ? 314 : 22, top: index < 2 ? 158 : 250,
          width: index < 2 ? 270 : 576, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: C.cream, color: C.ink, fontSize: TYPE.supporting, borderRadius: 4,
          opacity: progress(frame, at(id), 3), transform: `translateY(${20 * (1 - enter)}px)`}}>{txt(id)}</div>;
      })}
    </> : null}
  </div>;
};

/** 10/14 WordingChoice 的逐字出现与色彩接力；这里只呈现本条说出的两种用途。 */
const WordingChoice: React.FC<{cue: OverlayCue; plan: RuntimePlan; frame: number}> = ({cue, plan, frame}) => {
  const selected = smooth(progress(frame, eventFrame(plan, cue.emphasisEventId!) - 12, 12));
  return <div data-upgrade-effect="wording-choice-adaptation" style={{position: 'relative', height: 350}}>
    {cue.items.map((item, index) => {
      const at = eventFrame(plan, item.eventId);
      const enter = easeOut(progress(frame, at, 8));
      return <React.Fragment key={item.eventId}>
        <div style={{position: 'absolute', top: index * 176, left: 0, fontSize: TYPE.category, color: C.cream,
          opacity: progress(frame, at, 3)}}>{item.label}</div>
        <div style={{position: 'absolute', left: 0, top: 40 + index * 176, width: 610, height: 104,
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', borderRadius: 5,
          color: C.ink, fontSize: TYPE.title, backgroundColor: index ? C.accent : `rgb(${mix(225, 242, selected)},${mix(185, 234, selected)},${mix(109, 220, selected)})`,
          opacity: progress(frame, at, 3), transform: `scale(${.97 + .03 * enter})`,
          outline: index ? `${3 * selected}px solid ${C.cream}` : undefined, boxShadow: '0 10px 24px rgba(0,0,0,.16)'}}>
          {[...item.text].map((letter, i) => <span key={i} style={{opacity: frame >= at + i * 2 ? 1 : 0}}>{letter}</span>)}
        </div>
      </React.Fragment>;
    })}
  </div>;
};

const InformationLayer: React.FC<{cue: OverlayCue; plan: RuntimePlan; frame: number}> = ({cue, plan, frame}) => {
  const avoidance = plan.avoidanceWindows.find((window) => inside(frame, window));
  if (avoidance?.region === null) return null;
  const region = avoidance?.region ?? cue.region ?? DEFAULT_REGION;
  return <div data-motion={cue.kind} style={{position: 'absolute', left: region.x, top: region.y,
    width: region.width, height: region.height, opacity: opacity(frame, cue), boxSizing: 'border-box',
    fontFamily: `"${DISPLAY}", "PingFang SC", sans-serif`, color: C.white,
    textShadow: '0 2px 8px rgba(0,0,0,.7)'}}>
    {cue.title ? <div style={{fontSize: TYPE.category, lineHeight: 1.2, marginBottom: 18, color: C.cream}}>{cue.title}</div> : null}
    {cue.kind === 'continuous-business' ? <ContinuousBusiness cue={cue} plan={plan} frame={frame} /> :
      cue.kind === 'hook-reveal' ? <HookReveal cue={cue} plan={plan} frame={frame} /> :
      cue.kind === 'wording-choice' ? <WordingChoice cue={cue} plan={plan} frame={frame} /> :
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

export const MuskGrokBusinessAi: React.FC<EpisodeProps> = ({plan, withSfx, mode}) => {
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
      <div style={{position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '62% 44%'}}>
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
