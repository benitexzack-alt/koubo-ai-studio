import React, {useEffect} from 'react';
import {loadFont} from '@remotion/fonts';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Freeze, OffthreadVideo, Sequence, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';
import visualEvents from './visual-events.v1.json';

type FrameWindow = {from: number; to: number};
type Caption = FrameWindow & {id: string; chinese: string; english: string; highlights: string[]};
type PaperClip = FrameWindow & {id: string; src: string; sourceInFrame: number; sourceFps: number};
export type RuntimePlan = {
  durationInFrames: number; fps: number; width: number; height: number; sourceStartFrame: number;
  sourceEndFrame: number; assetPrefix: string; fontSource: string; captionFontSource: string;
  hostSource: string; audioWithSfx: string; audioNoSfx: string; captions: Caption[]; paperClips: PaperClip[];
};
export type EpisodeProps = {plan: RuntimePlan; withSfx: boolean};
const DISPLAY = 'DirectorUpgrade-Smiley';
const CAPTION = 'DirectorUpgrade-Caption';
const C = {ink: '#16252d', cream: '#f2eadc', white: '#fffdf8', accent: '#e1b96d', muted: '#c8d1d4'};
const p = (frame: number, start: number, duration: number) => Math.max(0, Math.min(1, (frame - start) / Math.max(1, duration)));
const q = (v: number) => 1 - (1 - v) ** 4;
const smooth = (v: number) => v * v * (3 - 2 * v);
const mix = (a: number, b: number, v: number) => a + (b - a) * v;
const inside = (frame: number, window: FrameWindow) => frame >= window.from && frame < window.to;
/** 音效预混和实际组件共享此表；禁止另造统一延迟的第二套时钟。 */
export const at = (id: string): number => {
  const event = visualEvents.events.find((item) => item.id === id);
  if (!event) throw new Error(`缺少本条视觉事件：${id}`);
  return event.localFrame;
};
const alpha = (frame: number, from: number, to: number, fade = 7) => Math.min(p(frame, from, fade), 1 - p(frame, to - fade, fade));
const asset = (source: string, plan: RuntimePlan) => {
  if (/^(https?:|data:|file:)/.test(source) || source.startsWith('/') || source.includes('..')) throw new Error(`只接受本地已绑定素材：${source}`);
  return staticFile(`${plan.assetPrefix}${source}`);
};
const fail = (source: string) => (error: Error) => cancelRender(new Error(`本条媒体不可用：${source}；${error.message}`));

export const validateEpisodeAssets = async (plan: RuntimePlan, withSfx: boolean, signal?: AbortSignal) => {
  if (plan.sourceStartFrame !== 1604 || plan.sourceEndFrame !== 3402 || plan.durationInFrames !== 1798 || plan.fps !== 30 || plan.width !== 1920 || plan.height !== 1080) {
    throw new Error('本条必须保留原1604至3402帧的1798帧同窗口播');
  }
  if (plan.captions.length !== 19 || plan.paperClips.length !== 2) throw new Error('本条原字幕或纸艺数量改变');
  for (const [index, item] of plan.captions.entries()) {
    if (item.from < 0 || item.to > plan.durationInFrames || item.to <= item.from || (index > 0 && item.from < plan.captions[index - 1].to)) throw new Error(`字幕窗不合法：${item.id}`);
    if (!item.chinese || !item.english || item.highlights.some((word) => !item.chinese.includes(word))) throw new Error(`字幕正文或重点词不合法：${item.id}`);
  }
  for (const clip of plan.paperClips) {
    const key = clip.id === 'P03' ? 'paper3' : 'paper4';
    if (clip.from !== at(`${key}-start`) || clip.to !== at(`${key}-end`)) throw new Error(`纸艺与视觉事件时钟不一致：${clip.id}`);
  }
  for (const event of visualEvents.events) if (event.sourceFrame !== event.localFrame + plan.sourceStartFrame) throw new Error(`视觉事件时钟漂移：${event.id}`);
  const sources = [plan.hostSource, withSfx ? plan.audioWithSfx : plan.audioNoSfx, plan.fontSource, plan.captionFontSource, ...plan.paperClips.map((clip) => clip.src)];
  await Promise.all(sources.map(async (source) => {
    const response = await fetch(asset(source, plan), {method: 'HEAD', signal});
    if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html') || response.headers.get('content-length') === '0') throw new Error(`素材未真实提供：${source}（${response.status}）`);
  }));
};

const stageStyle: React.CSSProperties = {position: 'absolute', left: 70, top: 124, width: 650, height: 510, fontFamily: DISPLAY, color: C.white};
const smallStyle: React.CSSProperties = {fontSize: 36, lineHeight: 1.15, color: C.cream, letterSpacing: 1};
const cardShadow = '0 14px 32px rgba(0,0,0,.16)';

/** 不是可选→全员必用：保留起态，强调条展开接管。 */
const Mandatory: React.FC<{frame: number}> = ({frame}) => {
  const reveal = q(p(frame, at('mandatory-reveal'), at('mandatory-settle') - at('mandatory-reveal')));
  return <div style={{...stageStyle, opacity: alpha(frame, at('mandatory-start') - 4, at('mandatory-end'))}}>
    <div style={{...smallStyle, opacity: 1 - reveal * 0.35}}>不是可选</div>
    <div style={{position: 'absolute', top: 76, width: 610, height: 128, backgroundColor: C.accent,
      clipPath: `inset(0 ${100 * (1 - reveal)}% 0 0)`, boxShadow: cardShadow, borderRadius: 5}} />
    <div style={{position: 'absolute', top: 91, left: 25, fontSize: 92, whiteSpace: 'nowrap', color: C.ink,
      opacity: reveal, transform: `translateX(${16 * (1 - reveal)}px)`}}>全员必用</div>
  </div>;
};

/** 同一个初期容器连续展开为沉淀层；无业绩数值、进度比例或因果箭头。 */
const Groundwork: React.FC<{frame: number}> = ({frame}) => {
  const turn = smooth(p(frame, at('ground-transform'), at('ground-settle') - at('ground-transform')));
  const settled = q(p(frame, at('ground-reveal'), at('ground-settle') - at('ground-reveal')));
  const oldOpacity = 1 - p(frame, at('ground-transform'), 14);
  const stamp = q(p(frame, at('giveup-start'), at('giveup-contact') - at('giveup-start')));
  return <div style={{...stageStyle, opacity: alpha(frame, at('ground-start'), at('ground-end'))}}>
    <div style={smallStyle}>改造初期</div>
    <div style={{position: 'absolute', left: 0, top: 78, width: 618, height: mix(294, 342, turn),
      borderRadius: 8, background: 'linear-gradient(135deg,rgba(16,32,42,.92),rgba(29,45,53,.82))', boxShadow: cardShadow,
      borderBottom: `${mix(3, 12, turn)}px solid ${C.accent}`, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 28, top: 25, fontSize: 42, color: C.muted, opacity: oldOpacity}}>看不出</div>
      {[{id: 'results-reveal', label: '爆发式的业绩', left: 28}, {id: 'cash-reveal', label: '立刻变现', left: 330}].map((item) => {
        const arrive = q(p(frame, at(item.id), 13));
        return <div key={item.id} style={{position: 'absolute', left: item.left, top: 91, width: 260, height: 91,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: item.label.length > 5 ? 38 : 48,
          border: '1px solid rgba(241,234,220,.4)', borderRadius: 5, background: 'rgba(241,234,220,.07)',
          opacity: arrive * oldOpacity, transform: `translateY(${23 * (1 - arrive)}px)`}}>{item.label}</div>;
      })}
      <div style={{position: 'absolute', top: 211, left: 28, fontSize: 38, color: C.cream,
        opacity: p(frame, at('no-return-reveal'), 7) * oldOpacity}}>看不到收益</div>
      <div style={{position: 'absolute', left: 188, top: 90, width: 244, textAlign: 'center', padding: '12px 0',
        fontSize: 64, color: '#fbf2e3', backgroundColor: '#7d4940', boxShadow: '0 6px 10px rgba(0,0,0,.25)',
        transform: `translateY(${-62 * (1 - stamp)}px) rotate(${-9 - 8 * (1 - stamp)}deg) scale(${1.18 - stamp * .18})`,
        opacity: p(frame, at('giveup-start'), 3) * oldOpacity}}>放弃</div>
      <div style={{position: 'absolute', left: 32, top: 55, right: 32, opacity: settled,
        transform: `translateY(${24 * (1 - settled)}px)`}}>
        <div style={{fontSize: 38, color: C.cream, marginBottom: 20}}>最关键的</div>
        <div style={{fontSize: 112, color: C.accent, lineHeight: 1.1}}>沉淀期</div>
        <div style={{height: 2, backgroundColor: 'rgba(225,185,109,.45)', width: `${100 * settled}%`, marginTop: 25}} />
      </div>
    </div>
  </div>;
};

/** 原规则对象重新合拢，然后交给相同位置的团队标签组。 */
const RulesAndTags: React.FC<{frame: number}> = ({frame}) => {
  const join = q(p(frame, at('rules-start'), at('rules-rebuild') - at('rules-start')));
  const headingMove = smooth(p(frame, at('team-start'), 18));
  const tags = [
    {event: 'tag-cram', text: '临时补课', left: 0, top: 172, width: 276},
    {event: 'tag-process', text: '流程脱节', left: 292, top: 172, width: 276},
    {event: 'tag-talent', text: '人才跟不上', left: 0, top: 274, width: 352},
  ];
  return <div style={{...stageStyle, opacity: alpha(frame, at('rules-start'), at('team-end'))}}>
    <div style={{position: 'absolute', left: 0, top: mix(54, 0, headingMove), fontSize: mix(78, 34, headingMove),
      color: headingMove > .95 ? C.cream : C.white, transformOrigin: '0 0', display: 'flex', gap: mix(65 * (1 - join), 0, headingMove)}}>
      <span style={{transform: `translateX(${-36 * (1 - join)}px)`}}>行业</span>
      <span style={{transform: `translateX(${36 * (1 - join)}px)`}}>规则</span>
    </div>
    <div style={{position: 'absolute', top: 145, height: 3, left: 0, width: 430 * join,
      backgroundColor: C.accent, opacity: 1 - headingMove}} />
    <div style={{position: 'absolute', top: 179, left: 0, fontSize: 98, color: C.accent,
      opacity: p(frame, at('rules-rebuild'), at('rules-settle') - at('rules-rebuild')) * (1 - headingMove)}}>重构</div>
    <div style={{position: 'absolute', top: 62, left: 0, fontSize: 72, opacity: headingMove}}>团队</div>
    {tags.map((item) => {
      // 已购 Wrapping Tag Stack 的识别性动作：短促缩放入场、换行累积、旧标签完全稳住。
      const enter = q(p(frame, at(item.event), 5));
      return <div key={item.event} data-upgrade-effect="wrapping-tag-stack-adaptation" style={{position: 'absolute',
        left: item.left, top: item.top, width: item.width, height: 83, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.ink, backgroundColor: C.cream, borderLeft: `7px solid ${C.accent}`, boxSizing: 'border-box',
        borderRadius: 4, boxShadow: cardShadow, fontSize: 56, opacity: p(frame, at(item.event), 3),
        transform: `skewX(-3deg) scale(${.88 + .12 * enter})`, transformOrigin: '0 50%'}}>{item.text}</div>;
    })}
    <div style={{position: 'absolute', left: 0, top: 389, fontSize: 49, color: C.accent,
      opacity: p(frame, at('dilemma-reveal'), 8), borderBottom: '2px solid rgba(225,185,109,.65)', paddingBottom: 8}}>进退两难</div>
  </div>;
};

/** 原话是并列用途：三词进入同一 AI 工作容器，不连接为前后步骤。 */
const SharedWork: React.FC<{frame: number}> = ({frame}) => {
  const container = q(p(frame, at('work-start'), 16));
  return <div style={{...stageStyle, opacity: alpha(frame, at('work-start'), at('work-end'), 5)}}>
    <div style={smallStyle}>你的公司</div>
    <div style={{position: 'absolute', top: 74, left: 0, width: 617, height: 254, borderRadius: 9,
      background: 'rgba(21,40,49,.91)', boxShadow: cardShadow, borderTop: `5px solid ${C.accent}`,
      transform: `scaleX(${.9 + container * .1})`, transformOrigin: '0 50%'}}>
      <div style={{position: 'absolute', left: 24, top: 22, fontSize: 58, color: C.accent, opacity: p(frame, at('work-ai'), 8)}}>AI</div>
      {[{event: 'work-think', text: '思考'}, {event: 'work-collaborate', text: '协作'}, {event: 'work-do', text: '干活'}].map((item, i) => {
        const enter = q(p(frame, at(item.event), 7));
        return <div key={item.event} style={{position: 'absolute', top: 126, left: 24 + i * 192, width: 176, height: 88,
          borderRadius: 4, background: C.cream, color: C.ink, fontSize: 61, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: p(frame, at(item.event), 2), transform: `translateY(${30 * (1 - enter)}px)`}}>{item.text}</div>;
      })}
    </div>
  </div>;
};

/** 已购 Wording Choice：分句显现→比较符→第二句→第一句退中性、第二句强调边框。 */
const WordingChoice: React.FC<{frame: number}> = ({frame}) => {
  const selection = smooth(p(frame, at('choice-select'), at('choice-settle') - at('choice-select')));
  const text = (sentence: string, when: number) => [...sentence].map((character, i) =>
    <span key={i} style={{opacity: frame >= when + i * 3 ? 1 : 0}}>{character}</span>);
  return <div data-upgrade-effect="wording-choice-adaptation" style={{...stageStyle, opacity: alpha(frame, at('choice-start'), at('choice-end')), top: 145}}>
    <div style={smallStyle}>别人</div>
    <div style={{position: 'absolute', left: 0, top: 54, width: 600, height: 118, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 76,
      backgroundColor: `rgb(${mix(225, 235, selection)},${mix(185, 232, selection)},${mix(109, 225, selection)})`,
      color: C.ink, border: '3px solid rgba(23,37,44,.2)', boxShadow: cardShadow,
      transform: `scale(${.97 + q(p(frame, at('choice-start'), 8)) * .03})`}}>{text('被迫追赶', at('choice-first'))}</div>
    <div style={{position: 'absolute', left: 260, top: 184, width: 80, textAlign: 'center', fontSize: 40, color: C.cream,
      opacity: p(frame, at('choice-mark'), 6)}}>对照</div>
    <div style={{position: 'absolute', top: 242, ...smallStyle, opacity: p(frame, at('choice-second'), 4)}}>你</div>
    <div style={{position: 'absolute', left: 0, top: 295, width: 600, height: 118, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 76, backgroundColor: C.accent, color: C.ink,
      opacity: p(frame, at('choice-second'), 3), border: `3px solid rgba(22,37,45,${selection})`,
      boxShadow: `0 0 0 ${selection * 4}px rgba(241,234,220,${selection * .9}),${cardShadow}`,
      transform: `scale(${.97 + q(p(frame, at('choice-second'), 8)) * .03})`}}>{text('提前布局', at('choice-second'))}</div>
  </div>;
};

const presenterMorph = (frame: number, clips: PaperClip[]) => {
  for (const clip of clips) {
    const key = clip.id === 'P03' ? 'paper3' : 'paper4';
    const shrink = at(`${key}-shrink`); const returned = at(`${key}-return`);
    if (frame >= shrink && frame < returned) {
      const amount = frame < clip.from ? smooth(p(frame, shrink, clip.from - shrink)) : frame < clip.to ? 1 : 1 - smooth(p(frame, clip.to, returned - clip.to));
      return {amount, clip};
    }
  }
  return {amount: 0, clip: null};
};

const PaperMat: React.FC<{frame: number; clip: PaperClip | null}> = ({frame, clip}) => {
  if (!clip) return null;
  const later = frame >= at(clip.id === 'P03' ? 'paper3-title' : 'paper4-title');
  const lines = clip.id === 'P03' ? (later ? ['底层', '操作系统'] : ['整个', '公司']) : (later ? ['个体能力', '合力'] : ['超级', '个体']);
  return <AbsoluteFill style={{backgroundColor: '#e8e2d5',
    backgroundImage: 'repeating-linear-gradient(6deg,rgba(90,78,54,.017) 0px,rgba(90,78,54,.017) 1px,transparent 1px,transparent 5px),linear-gradient(115deg,#e8e2d6,#f4eee4 65%,#e1dbce)'}}>
    <div style={{position: 'absolute', left: 48, right: 48, top: 76, height: 2, background: 'rgba(69,62,47,.14)'}} />
    <div style={{position: 'absolute', left: 64, top: 172, width: 410, color: '#3e443e', fontFamily: DISPLAY, opacity: frame >= clip.from ? 1 : 0}}>
      {lines.map((line, i) => <div key={i} style={{fontSize: line.length >= 4 ? 66 : 94, lineHeight: 1.25, marginBottom: 7}}>{line}</div>)}
    </div>
    <div style={{position: 'absolute', left: 64, top: 460, width: 84, height: 5, backgroundColor: '#ac8d57', opacity: frame >= clip.from ? 1 : 0}} />
    <div style={{position: 'absolute', left: 47, top: 913, right: 47, bottom: 24, background: '#202c32', borderRadius: 7}} />
    <div style={{position: 'absolute', right: 62, top: 30, fontFamily: CAPTION, fontSize: 24, color: '#5f6258'}}>AI生成·纸艺示意</div>
  </AbsoluteFill>;
};

const splitHighlights = (text: string, highlights: string[]) => {
  const keywords = [...highlights].sort((a, b) => b.length - a.length);
  const parts: Array<{text: string; highlighted: boolean}> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const word = keywords.find((item) => text.startsWith(item, cursor));
    if (word) {parts.push({text: word, highlighted: true}); cursor += word.length;}
    else {const next = keywords.map((item) => text.indexOf(item, cursor + 1)).filter((pos) => pos >= 0).sort((a, b) => a - b)[0] ?? text.length;
      parts.push({text: text.slice(cursor, next), highlighted: false}); cursor = next;}
  }
  return parts;
};

const BilingualCaption: React.FC<{caption: Caption; frame: number}> = ({caption, frame}) => {
  const zhLength = [...caption.chinese].length; const enLength = caption.english.length;
  const zhSize = zhLength >= 33 ? 36 : zhLength >= 28 ? 40 : 44;
  const enSize = enLength >= 96 ? 16 : enLength >= 82 ? 17 : enLength >= 68 ? 18 : 20;
  const fade = Math.min(3, Math.max(1, Math.floor((caption.to - caption.from) * .06)));
  return <div data-caption={caption.id} style={{position: 'absolute', left: 205, top: 930, width: 1510, height: 108,
    boxSizing: 'border-box', padding: '6px 24px 8px', background: 'linear-gradient(90deg,rgba(2,7,12,0),rgba(2,7,12,.38) 12%,rgba(2,7,12,.38) 88%,rgba(2,7,12,0))',
    opacity: alpha(frame, caption.from, caption.to, fade), fontFamily: `"${CAPTION}", "PingFang SC", sans-serif`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 260}}>
    <div style={{width: '100%', color: '#F7FAFF', fontSize: zhSize, lineHeight: 1.12, fontWeight: 900, textAlign: 'center', whiteSpace: 'nowrap',
      WebkitTextStroke: '1.25px rgba(0,0,0,.88)', paintOrder: 'stroke fill', textShadow: '0 3px 7px #000,0 0 16px rgba(0,0,0,.72)'}}>
      {splitHighlights(caption.chinese, caption.highlights).map((part, index) => <span key={index} style={{color: part.highlighted ? '#FFD23F' : '#F7FAFF',
        textShadow: part.highlighted ? '0 0 18px rgba(255,204,61,.55),0 3px 7px #000' : undefined}}>{part.text}</span>)}
    </div>
    <div style={{width: '100%', marginTop: 5, color: 'rgba(247,250,255,.84)', fontSize: enSize, lineHeight: 1.08, fontWeight: 680,
      textAlign: 'center', whiteSpace: 'nowrap', textShadow: '0 2px 6px #000,0 0 13px rgba(0,0,0,.78)'}}>{caption.english}</div>
  </div>;
};

export const DirectorMotionUpgrade: React.FC<EpisodeProps> = ({plan, withSfx}) => {
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender('加载一分钟候选本地字体');
    Promise.all([loadFont({family: DISPLAY, url: asset(plan.fontSource, plan), format: 'woff2', weight: '400', display: 'block'}),
      loadFont({family: CAPTION, url: asset(plan.captionFontSource, plan), format: 'truetype', weight: '400 900', display: 'block'})])
      .then(() => continueRender(handle)).catch((error: unknown) => cancelRender(new Error(`字体不可用：${String(error)}`)));
  }, [plan.fontSource, plan.captionFontSource, plan.assetPrefix]);
  const morph = presenterMorph(frame, plan.paperClips);
  const paper = plan.paperClips.find((clip) => inside(frame, clip));
  const caption = plan.captions.find((item) => inside(frame, item));
  const m = morph.amount;
  // 独立的温和运镜；只有真人外层缩放，不改变真实素材的播放速度。
  const cameraWindows = [[at('mandatory-start'), at('mandatory-end')], [at('ground-start'), at('ground-end')],
    [at('rules-start'), at('team-end')], [at('work-start'), at('work-end')], [at('choice-start'), at('choice-end')]];
  const window = cameraWindows.find(([from, to]) => frame >= from && frame < to);
  const zoom = window ? 1.012 + .042 * Math.sin(Math.PI * p(frame, window[0], window[1] - window[0])) ** 2 : 1.012;
  const audio = withSfx ? plan.audioWithSfx : plan.audioNoSfx;
  return <AbsoluteFill translate="no" className="notranslate" style={{backgroundColor: '#17272f', overflow: 'hidden'}}>
    <PaperMat frame={frame} clip={morph.clip} />
    {plan.paperClips.map((clip) => {
      const key = clip.id === 'P03' ? 'paper3' : 'paper4';
      const preparing = frame >= at(`${key}-shrink`) && frame < clip.from;
      const returning = frame >= clip.to && frame < at(`${key}-return`);
      // 仅外部交接窗保持原纸艺首/末帧；主体原窗、原速和音轨不动，真人从不冻结。
      // Freeze 位于原 Sequence 外，使用全片时钟，避免短交接 Sequence 截断末帧。
      return <Freeze key={clip.id} frame={preparing ? clip.from : clip.to - 1} active={preparing || returning}>
        <Sequence from={clip.from} durationInFrames={clip.to - clip.from} premountFor={30}>
          <div style={{position: 'absolute', left: 528, top: 104, width: 1328, height: 759, boxShadow: '0 16px 36px rgba(48,44,35,.18)', overflow: 'hidden', borderRadius: 3}}>
            <OffthreadVideo src={asset(clip.src, plan)} muted playbackRate={1} trimBefore={Math.round(clip.sourceInFrame / clip.sourceFps * plan.fps)}
              trimAfter={Math.round(clip.sourceInFrame / clip.sourceFps * plan.fps) + clip.to - clip.from}
              style={{width: '100%', height: '100%', objectFit: 'contain'}} onError={fail(clip.src)} />
          </div>
        </Sequence>
      </Freeze>;
    })}
    <div data-presenter="same-continuous-video-window" style={{position: 'absolute', left: 64 * m, top: 650 * m,
      width: mix(1920, 440, m), height: mix(1080, 247.5, m), borderRadius: 12 * m, overflow: 'hidden',
      boxShadow: m ? `0 ${14 * m}px ${28 * m}px rgba(33,29,22,${.2 * m})` : undefined}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${mix(zoom, 1.04, m)})`, transformOrigin: '58% 42%'}}>
        <OffthreadVideo src={asset(plan.hostSource, plan)} muted playbackRate={1} trimBefore={plan.sourceStartFrame} trimAfter={plan.sourceEndFrame}
          style={{width: '100%', height: '100%', objectFit: 'cover'}} onError={fail(plan.hostSource)} />
      </div>
    </div>
    {!morph.clip ? <>
      <div style={{position: 'absolute', left: 0, top: 0, width: 790, height: 740,
        background: 'linear-gradient(90deg,rgba(15,28,35,.56),rgba(15,28,35,.22) 75%,transparent)', pointerEvents: 'none'}} />
      {frame < at('mandatory-end') ? <Mandatory frame={frame} /> : null}
      {frame >= at('ground-start') && frame < at('ground-end') ? <Groundwork frame={frame} /> : null}
      {frame >= at('rules-start') && frame < at('team-end') ? <RulesAndTags frame={frame} /> : null}
      {frame >= at('choice-start') && frame < at('choice-end') ? <WordingChoice frame={frame} /> : null}
    </> : null}
    {frame >= at('work-start') && frame < at('work-end') ? <SharedWork frame={frame} /> : null}
    <div style={{position: 'absolute', left: 64, top: 38, fontFamily: CAPTION, fontSize: 24, fontWeight: 900,
      color: morph.clip ? '#58615b' : 'rgba(247,250,255,.88)', textShadow: morph.clip ? 'none' : '0 3px 12px rgba(0,0,0,.9)'}}>超哥AI创业记</div>
    {caption ? <BilingualCaption caption={caption} frame={frame} /> : null}
    <Audio src={asset(audio, plan)} trimBefore={0} trimAfter={plan.durationInFrames} playbackRate={1} volume={1} onError={fail(audio)} />
  </AbsoluteFill>;
};
