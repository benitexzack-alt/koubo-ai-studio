import React, {useEffect} from 'react';
import {loadFont} from '@remotion/fonts';
import {Audio} from '@remotion/media';
import {
  AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, cancelRender,
  continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame,
} from 'remotion';
import {fontFamily as captionFontFamily} from '../styles';

type FrameWindow = {from: number; to: number};
export type Caption = FrameWindow & {
  id: string; chinese: string; english: string; left?: number; top?: number; width?: number;
};
export type PaperClip = FrameWindow & {
  id: string; src: string; sourceInFrame: number; sourceFps: number;
};
export type MotionItem = {
  text: string; from?: number; to?: number; image?: string;
  detail?: string; column?: 0 | 1;
};
export type Motion = FrameWindow & {
  id: string;
  kind: 'chapter' | 'list' | 'bundle' | 'branches' | 'comparison' | 'products' | 'tile' | 'question';
  title: string; chapterNumber?: string | number; detail?: string; result?: string;
  resultFrom?: number; items: MotionItem[]; columnTitles?: [string, string];
  coverAt?: number; statementAt?: number; statementOut?: number; returnAt?: number;
};
export type Camera = FrameWindow & {maxScale: number; focusX?: number; focusY?: number; inFrames?: number; outFrames?: number};
export type Opening = FrameWindow & {
  video: string; matte: string; title: string; sourceInFrame?: number;
  titleFrom?: number; titleTo?: number;
};
export type RuntimePlan = {
  durationInFrames: number; fps: number; width: number; height: number;
  assetPrefix?: string; fontSource?: string; captionFontSource?: string;
  hostSource: string; audioWithSfx: string; audioNoSfx: string;
  captions: Caption[]; paperClips: PaperClip[]; opening?: Opening | null;
  motions: Motion[]; cameras: Camera[];
};
export type EpisodeProps = {plan: RuntimePlan; withSfx: boolean};

const PALETTE = {ink: '#F5F8FC', cyan: '#68DAFF', gold: '#D9B871', navy: '#111F2B'};
const EFFECT_FONT = 'TenAI-R1-Smiley';
const CAPTION_FONT = 'TenAI-R1-Caption';
const DEFAULT_FONT = 'motion-upgrade-r2/fonts/smiley-sans.woff2';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const inside = (frame: number, range: FrameWindow) => frame >= range.from && frame < range.to;
const progress = (frame: number, at: number, duration: number) =>
  Math.max(0, Math.min(1, (frame - at) / Math.max(1, duration)));
const outQuart = (value: number) => 1 - (1 - value) ** 4;
const appear = (frame: number, at: number, fps: number) => spring({
  frame: frame - at, fps, durationInFrames: Math.round(fps * 0.4), config: {damping: 200},
});

/** 本期源文件在独立public入口；R2真实图和字体继续使用已绑定的本地路径。 */
export const assetPath = (source: string, plan: RuntimePlan): string => {
  if (/^(https?:|data:|file:)/.test(source) || source.startsWith('/') || source.includes('..')) {
    throw new Error(`本期只允许已绑定的本地public素材：${source}`);
  }
  const prefix = (plan.assetPrefix ?? 'ten-ai-businesses-final-r1/').replace(/\/?$/, '/');
  return source.startsWith('motion-upgrade-r2/') || source.startsWith(prefix) ? source : `${prefix}${source}`;
};
const sourceUrl = (source: string, plan: RuntimePlan) => staticFile(assetPath(source, plan));
const failMedia = (source: string) => (error: Error) =>
  cancelRender(new Error(`本期必需媒体不可用：${source}；${error.message}`));

/** 结构检查不代替字幕、抠像或视听验收；任何缺少必需素材都不能静默降级。 */
export const assertRuntimePlan = (plan: RuntimePlan): void => {
  if (plan.durationInFrames !== 8534 || plan.fps !== 30 || plan.width !== 1920 || plan.height !== 1080) {
    throw new Error('本期完整原声规格必须为8534帧、30fps、1920×1080；不得用短片或改速替代');
  }
  const checkWindow = (value: FrameWindow, label: string) => {
    if (!Number.isInteger(value.from) || !Number.isInteger(value.to) || value.from < 0 ||
      value.to <= value.from || value.to > plan.durationInFrames) throw new Error(`${label}帧窗不合法`);
  };
  for (const caption of plan.captions) {
    checkWindow(caption, caption.id);
    if (!caption.chinese.trim() || !caption.english.trim()) throw new Error(`${caption.id}缺少同窗实录双语字幕`);
  }
  if (!plan.captions.length) throw new Error('完整成片不能缺少本条实录双语字幕');
  const sortedCaptions = [...plan.captions].sort((a, b) => a.from - b.from);
  if (sortedCaptions.some((caption, index) => index > 0 && caption.from < sortedCaptions[index - 1].to)) {
    throw new Error('字幕窗重叠，不能通过覆盖隐藏某句实录');
  }
  for (const clip of plan.paperClips) {
    checkWindow(clip, clip.id);
    if (!Number.isInteger(clip.sourceInFrame) || clip.sourceInFrame < 0 || clip.sourceFps <= 0) {
      throw new Error(`${clip.id}纸艺源起帧或源帧率不合法`);
    }
  }
  const sortedPaper = [...plan.paperClips].sort((a, b) => a.from - b.from);
  if (sortedPaper.some((clip, index) => index > 0 && clip.from < sortedPaper[index - 1].to)) {
    throw new Error('纸艺主画面之间存在重叠，需先明确唯一画面');
  }
  for (const motion of plan.motions) {
    checkWindow(motion, motion.id);
    if (!motion.title.trim()) throw new Error(`${motion.id}没有观众可见标题`);
    if (motion.items.length > 4) throw new Error(`${motion.id}同时节点超过四个，请按实录拆分而非缩小字体`);
    if (motion.kind === 'products' && motion.items.some((item) => !item.image)) {
      throw new Error(`${motion.id}产品卡必须绑定真实产品图，不使用替代图标`);
    }
    if (motion.kind === 'tile' && motion.to - motion.from < 42) throw new Error(`${motion.id}铺格返回窗不足`);
    if (motion.resultFrom !== undefined && (motion.resultFrom < motion.from || motion.resultFrom >= motion.to)) {
      throw new Error(`${motion.id}结果落点越出当前实录窗`);
    }
    for (const item of motion.items) {
      if (item.from !== undefined && (item.from < motion.from || item.from >= motion.to)) {
        throw new Error(`${motion.id}节点入点越出当前实录窗`);
      }
      if (item.to !== undefined && (item.to <= (item.from ?? motion.from) || item.to > motion.to)) {
        throw new Error(`${motion.id}节点出点不合法`);
      }
    }
  }
  for (const camera of plan.cameras) {
    checkWindow(camera, '电子运镜');
    if (camera.maxScale < 1 || camera.maxScale > 1.08) throw new Error('电子运镜超出本期保守边界');
  }
  if (plan.opening) {
    checkWindow(plan.opening, '开场同帧抠像');
    if (!plan.opening.video || !plan.opening.matte) throw new Error('开场人物后大字缺少同帧底片或遮罩');
  }
};

export const validateEpisodeAssets = async (plan: RuntimePlan, withSfx: boolean, signal?: AbortSignal) => {
  assertRuntimePlan(plan);
  const assets = new Set([
    plan.hostSource, withSfx ? plan.audioWithSfx : plan.audioNoSfx,
    plan.fontSource ?? DEFAULT_FONT, ...(plan.captionFontSource ? [plan.captionFontSource] : []),
    ...plan.paperClips.map((clip) => clip.src),
    ...(plan.opening ? [plan.opening.video, plan.opening.matte] : []),
    ...plan.motions.flatMap((motion) => motion.items.flatMap((item) => item.image ? [item.image] : [])),
  ]);
  await Promise.all([...assets].map(async (source) => {
    const response = await fetch(sourceUrl(source, plan), {method: 'HEAD', signal});
    if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html') ||
      response.headers.get('content-length') === '0') {
      throw new Error(`本期必需素材未真实提供：${source}（${response.status}）`);
    }
  }));
};

const cameraState = (frame: number, cameras: Camera[]) => {
  const camera = [...cameras].reverse().find((item) => inside(frame, item));
  if (!camera) return {scale: 1.012, origin: '60% 40%'};
  const duration = camera.to - camera.from;
  const enter = progress(frame, camera.from, camera.inFrames ?? Math.min(27, duration * 0.32));
  const leave = 1 - progress(frame, camera.to - (camera.outFrames ?? Math.min(24, duration * 0.28)),
    camera.outFrames ?? Math.min(24, duration * 0.28));
  const amount = Easing.inOut(Easing.quad)(Math.max(0, Math.min(enter, leave)));
  return {scale: 1.012 + (camera.maxScale - 1.012) * amount,
    origin: `${camera.focusX ?? 60}% ${camera.focusY ?? 40}%`};
};

const TitleBehindSubject: React.FC<{opening: Opening; plan: RuntimePlan; camera: ReturnType<typeof cameraState>}> =
  ({opening, plan, camera}) => {
    const localFrame = useCurrentFrame();
    const frame = localFrame + opening.from;
    const punchAt = opening.titleFrom ?? opening.from + 26;
    const clearAt = opening.titleTo ?? opening.to - 17;
    const punch = 1 - 2 ** (-10 * progress(frame, punchAt, 8));
    const settle = outQuart(progress(frame, punchAt + 8, 6));
    const opacity = punch * (1 - progress(frame, clearAt, 4));
    const titleScale = frame < punchAt + 8 ? 0.72 + punch * 0.305 : 1.025 - settle * 0.025;
    const sourceStart = opening.sourceInFrame ?? 0;
    const videoStyle = {position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
      objectFit: 'cover', objectPosition: '50% 50%'} as const;
    return <AbsoluteFill data-opening="same-frame-layers" style={{transform: `scale(${camera.scale})`,
      transformOrigin: camera.origin}}>
      <OffthreadVideo data-layer="background" src={sourceUrl(opening.video, plan)} muted
        trimBefore={sourceStart} trimAfter={sourceStart + opening.to - opening.from} playbackRate={1}
        style={videoStyle} onError={failMedia(opening.video)} />
      <AbsoluteFill style={{backgroundColor: '#000', opacity: opacity * 0.30}} />
      <AbsoluteFill data-layer="behind-subject-title" style={{opacity, transform: `scale(${titleScale})`,
        transformOrigin: '50% 40%', filter: 'drop-shadow(0 0 14px rgba(245,245,245,0.16))'}}>
        <svg viewBox="0 0 1920 1080" width={1920} height={1080}>
          <text x={960} y={520} textAnchor="middle" textLength={1730} lengthAdjust="spacingAndGlyphs"
            fill="#F5F5F5" fontFamily={EFFECT_FONT} fontSize={400} fontWeight={400}>{opening.title}</text>
        </svg>
      </AbsoluteFill>
      <OffthreadVideo data-layer="same-frame-presenter" src={sourceUrl(opening.matte, plan)} muted transparent
        trimBefore={sourceStart} trimAfter={sourceStart + opening.to - opening.from} playbackRate={1}
        style={videoStyle} onError={failMedia(opening.matte)} />
    </AbsoluteFill>;
  };

const Node: React.FC<{item: MotionItem; motion: Motion; frame: number; fps: number; style?: React.CSSProperties}> =
  ({item, motion, frame, fps, style}) => {
    const at = item.from ?? motion.from;
    const reveal = appear(frame, at, fps);
    const opacity = progress(frame, at, 3) * (item.to === undefined ? 1 : 1 - progress(frame, item.to - 5, 5));
    return <div data-node={item.text} style={{fontSize: 44, lineHeight: 1.14, color: PALETTE.ink,
      padding: '8px 14px', borderLeft: `3px solid ${PALETTE.cyan}`, borderRadius: '0 10px 10px 0',
      background: 'linear-gradient(90deg,rgba(17,31,43,.58),rgba(17,31,43,.15))',
      opacity, transform: `translateX(${-22 * (1 - reveal)}px)`, boxSizing: 'border-box', ...style}}>
      {item.text}
    </div>;
  };

const ListBody: React.FC<{motion: Motion; frame: number; fps: number}> = ({motion, frame, fps}) => {
  const grid = motion.items.length === 4 && motion.items.every((item) => [...item.text].length <= 6);
  return <div style={{display: 'grid', gridTemplateColumns: grid ? '1fr 1fr' : '1fr', gap: 10}}>
    {motion.items.map((item, index) => <Node key={`${motion.id}-${index}`} {...{item, motion, frame, fps}} />)}
  </div>;
};

const BundleBody: React.FC<{motion: Motion; frame: number; fps: number}> = ({motion, frame, fps}) => {
  const resultAt = motion.resultFrom ?? Math.max(motion.from, ...motion.items.map((item) => item.from ?? motion.from)) + 12;
  const result = appear(frame, resultAt, fps);
  return <div data-relationship="many-inputs-one-package" style={{position: 'relative', height: 268}}>
    <svg width={612} height={268} viewBox="0 0 612 268" style={{position: 'absolute', inset: 0}}>
      {motion.items.map((item, index) => {
        const startX = index % 2 === 0 ? 142 : 470;
        const startY = Math.floor(index / 2) * 82 + 61;
        const reveal = progress(frame, (item.from ?? motion.from) + 5, 10);
        return <path key={index} d={`M${startX} ${startY} C${startX} 182,306 164,306 207`}
          fill="none" stroke={PALETTE.cyan} strokeWidth={3} pathLength={1}
          strokeDasharray={1} strokeDashoffset={1 - reveal} opacity={reveal * 0.7} />;
      })}
    </svg>
    {motion.items.map((item, index) => <Node key={index} {...{item, motion, frame, fps}} style={{
      position: 'absolute', left: index % 2 === 0 ? 0 : 328, top: Math.floor(index / 2) * 82,
      width: 284, textAlign: 'center', borderLeft: 'none', borderBottom: `3px solid ${PALETTE.cyan}`,
    }} />)}
    <div data-result="delivery-package" style={{position: 'absolute', left: 100, top: 207, width: 412,
      fontSize: 44, lineHeight: 1.16, padding: '9px 10px', boxSizing: 'border-box', textAlign: 'center',
      color: PALETTE.gold, background: 'rgba(17,31,43,.72)', borderRadius: 12,
      boxShadow: `0 0 ${18 * result}px rgba(217,184,113,.18)`, opacity: progress(frame, resultAt, 3),
      transform: `translateY(${12 * (1 - result)}px)`}}>{motion.result ?? '打包交付'}</div>
  </div>;
};

const BranchBody: React.FC<{motion: Motion; frame: number; fps: number}> = ({motion, frame, fps}) => (
  <div data-relationship="one-parent-parallel-branches" style={{position: 'relative', height: motion.items.length === 4 ? 276 : 252}}>
    <svg width={612} height={276} viewBox="0 0 612 276" style={{position: 'absolute', inset: 0}}>
      {motion.items.map((item, index) => {
        const reveal = progress(frame, item.from ?? motion.from, 13);
        const y = 36 + index * (motion.items.length === 4 ? 68 : 84);
        return <path key={index} d={`M196 126 C230 126,242 ${y},275 ${y}`}
          fill="none" stroke={PALETTE.cyan} strokeWidth={3} pathLength={1}
          strokeDasharray={1} strokeDashoffset={1 - reveal} opacity={reveal * 0.8} />;
      })}
    </svg>
    <div style={{position: 'absolute', left: 0, top: 92, width: 196, fontSize: 44, lineHeight: 1.15,
      color: PALETTE.gold, padding: '9px 0', textAlign: 'center', borderRadius: 12, background: 'rgba(17,31,43,.64)'}}>
      {motion.result ?? '人＋AI'}
    </div>
    {motion.items.map((item, index) => <Node key={index} {...{item, motion, frame, fps}} style={{
      position: 'absolute', left: 277, top: index * (motion.items.length === 4 ? 68 : 84), width: 335,
    }} />)}
  </div>
);

const ComparisonBody: React.FC<{motion: Motion; frame: number; fps: number}> = ({motion, frame, fps}) => {
  const columns = [0, 1] as const;
  return <div data-relationship="same-dimension-comparison" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22}}>
    {columns.map((column) => <div key={column} style={{minWidth: 0, paddingTop: 8,
      borderTop: `3px solid ${column === 0 ? PALETTE.cyan : PALETTE.gold}`}}>
      {motion.columnTitles?.[column] ? <div style={{fontSize: 32, color: column === 0 ? PALETTE.cyan : PALETTE.gold,
        lineHeight: 1.16, marginBottom: 15}}>{motion.columnTitles[column]}</div> : null}
      {motion.items.filter((item, index) => (item.column ?? index % 2) === column).map((item, index) =>
        <Node key={index} {...{item, motion, frame, fps}} style={{marginBottom: 10, borderLeft: 'none',
          background: 'rgba(17,31,43,.4)', color: column === 0 ? PALETTE.ink : PALETTE.gold}} />)}
    </div>)}
  </div>;
};

const SemanticStage: React.FC<{motion: Motion; chapter?: Motion; frame: number; fps: number}> =
  ({motion, chapter, frame, fps}) => {
    const heading = chapter ?? motion;
    const headerOpacity = progress(frame, heading.from, 6);
    const bodyOpacity = Math.min(progress(frame, motion.from, 5), 1 - progress(frame, motion.to - 5, 5));
    const body = motion.kind === 'bundle' ? <BundleBody {...{motion, frame, fps}} /> :
      motion.kind === 'branches' ? <BranchBody {...{motion, frame, fps}} /> :
      motion.kind === 'comparison' ? <ComparisonBody {...{motion, frame, fps}} /> :
      motion.kind === 'question' ? <div style={{position: 'relative', fontSize: 44, lineHeight: 1.25,
        opacity: progress(frame, motion.items[0]?.from ?? motion.from, 3),
        borderRadius: '20px 20px 20px 0', padding: '20px 22px', color: PALETTE.ink,
        background: 'rgba(17,31,43,.58)', borderLeft: `4px solid ${PALETTE.gold}`}}>
        {motion.items[0]?.text ?? motion.detail ?? motion.title}
      </div> : <ListBody {...{motion, frame, fps}} />;
    return <div data-semantic-layer={motion.id} style={{position: 'absolute', left: 64, top: 96, width: 660,
      minHeight: 100, maxHeight: 414, padding: '0 24px 18px 0', boxSizing: 'border-box', color: PALETTE.ink,
      fontFamily: EFFECT_FONT, fontSynthesis: 'none', textShadow: '0 3px 15px rgba(0,0,0,.8)'}}>
      <div data-persistent-heading={heading.id} style={{opacity: headerOpacity, display: 'flex', gap: 14, alignItems: 'flex-start'}}>
        {heading.chapterNumber !== undefined ? <div style={{fontSize: 32, lineHeight: 1.1,
          color: PALETTE.cyan, marginTop: 15, flexShrink: 0, width: 44}}>
          <span>{String(heading.chapterNumber).padStart(2, '0')}</span>
          <div style={{width: 38, height: 3, marginTop: 9, backgroundColor: PALETTE.cyan}} />
        </div> : null}
        <div style={{fontSize: 64, lineHeight: 1.11, letterSpacing: 0, overflowWrap: 'normal',
          maxWidth: heading.chapterNumber === undefined ? 636 : 578,
          marginBottom: motion.items.length || motion.detail ? 23 : 0}}>{heading.title}</div>
      </div>
      <div style={{opacity: bodyOpacity}}>
        {motion.detail && motion.kind !== 'question' ? <div style={{fontSize: 44, lineHeight: 1.18,
          marginBottom: 16, color: PALETTE.gold}}>{motion.detail}</div> : null}
        {body}
      </div>
    </div>;
  };

const ProductCards: React.FC<{motion: Motion; frame: number; plan: RuntimePlan}> = ({motion, frame, plan}) => {
  const width = 320; const gap = 48;
  const left = (1920 - (motion.items.length * width + (motion.items.length - 1) * gap)) / 2;
  return <AbsoluteFill data-effect="real-products-in-foreground">
    {motion.items.map((item, index) => {
      const at = item.from ?? motion.from;
      if (frame < at || (item.to !== undefined && frame >= item.to)) return null;
      const eased = outQuart(progress(frame, at, Math.round(plan.fps * 0.38)));
      const opacity = Math.min(progress(frame, at, 2), 1 - progress(frame, motion.to - 6, 6));
      return <div key={index} data-product={item.text} style={{position: 'absolute', left: left + index * (width + gap),
        top: 752, width, height: 184, boxSizing: 'border-box', padding: 14, borderRadius: 22,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        backgroundColor: 'rgba(250,250,247,.9)', color: '#15202B', fontFamily: EFFECT_FONT,
        boxShadow: `0 ${32 - eased * 14}px ${34 - eased * 8}px rgba(0,0,0,.23)`, opacity,
        transformOrigin: '50% 50%', transform: `perspective(1200px) translate3d(${-80 * (1 - eased)}px,${8 * (1 - eased)}px,${64 * (1 - eased)}px) rotateY(${18 * (1 - eased)}deg) rotateZ(${-5.5 * (1 - eased)}deg) scale(${0.86 + eased * 0.14})`}}>
        <Img src={sourceUrl(item.image!, plan)} alt={item.text} style={{width: 94, height: 94,
          objectFit: 'contain', borderRadius: 16}} onError={() => cancelRender(new Error(`真实产品图缺失：${item.image}`))} />
        <div style={{fontSize: 44, lineHeight: '50px', whiteSpace: 'nowrap', fontSynthesis: 'none'}}>{item.text}</div>
      </div>;
    })}
  </AbsoluteFill>;
};

const orderedTiles = Array.from({length: 40}, (_, index) => ({index,
  column: index % 8, row: Math.floor(index / 8),
  distance: (index % 8 - 3.5) ** 2 + (Math.floor(index / 8) - 2) ** 2,
})).sort((a, b) => a.distance - b.distance || a.index - b.index);

const TileDissolve: React.FC<{motion: Motion; frame: number}> = ({motion, frame}) => {
  const coverAt = motion.coverAt ?? motion.from;
  const statementAt = motion.statementAt ?? motion.from + 18;
  const statementOut = motion.statementOut ?? motion.to - 36;
  const returnAt = motion.returnAt ?? motion.to - 26;
  const statementOpacity = progress(frame, statementAt, 4) * (1 - progress(frame, statementOut, 3));
  return <AbsoluteFill data-effect="center-out-8x5-tile-return">
    {orderedTiles.map((cell, rank) => <div key={cell.index} style={{position: 'absolute',
      left: cell.column * 240, top: cell.row * 216, width: 242, height: 218,
      opacity: progress(frame, coverAt + rank * 0.27, 2.7) * (1 - progress(frame, returnAt + (39 - rank) * 0.27, 2.7)),
      backgroundColor: PALETTE.navy,
      backgroundImage: 'linear-gradient(rgba(196,210,221,.075) 1px,transparent 1px),linear-gradient(90deg,rgba(196,210,221,.075) 1px,transparent 1px)',
      backgroundSize: '64px 64px', backgroundPosition: `${-cell.column * 240}px ${-cell.row * 216}px`,
    }} />)}
    <AbsoluteFill style={{opacity: statementOpacity, alignItems: 'center', justifyContent: 'center', gap: 26,
      color: PALETTE.ink, fontFamily: EFFECT_FONT, fontSynthesis: 'none'}}>
      {motion.chapterNumber !== undefined ? <div style={{fontSize: 32, color: PALETTE.gold}}>
        第{motion.chapterNumber}个生意
      </div> : null}
      <div style={{fontSize: 142, lineHeight: 1.12, textAlign: 'center', maxWidth: 1750, whiteSpace: 'pre-line'}}>{motion.title}</div>
    </AbsoluteFill>
  </AbsoluteFill>;
};

const BilingualCaption: React.FC<{caption: Caption; frame: number; plan: RuntimePlan}> = ({caption, frame, plan}) => {
  const zhLength = [...caption.chinese].length;
  const enLength = caption.english.length;
  const zhSize = zhLength >= 39 ? 31 : zhLength >= 35 ? 33 : zhLength >= 31 ? 35 : zhLength >= 27 ? 37 : 39;
  const enSize = enLength >= 96 ? 16 : enLength >= 82 ? 17 : enLength >= 68 ? 18 : 20;
  const fade = Math.min(3, Math.max(1, Math.floor((caption.to - caption.from) * 0.06)));
  const opacity = Math.min(progress(frame, caption.from, fade), 1 - progress(frame, caption.to - fade, fade));
  return <div data-caption={caption.id} style={{position: 'absolute', left: caption.left ?? 205,
    top: caption.top ?? 930, width: caption.width ?? 1510, height: 108, boxSizing: 'border-box',
    padding: '6px 24px 8px', background: 'linear-gradient(90deg,rgba(2,7,12,0),rgba(2,7,12,.38) 12%,rgba(2,7,12,.38) 88%,rgba(2,7,12,0))',
    opacity, pointerEvents: 'none', fontFamily: plan.captionFontSource ? CAPTION_FONT : captionFontFamily,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 260}}>
    <div style={{width: '100%', color: '#F7FAFF', fontSize: zhSize, lineHeight: 1.12, fontWeight: 900,
      textAlign: 'center', whiteSpace: 'nowrap', WebkitTextStroke: '1.25px rgba(0,0,0,.88)',
      textShadow: '0 3px 7px #000,0 0 16px rgba(0,0,0,.72)'}}>{caption.chinese}</div>
    <div style={{width: '100%', marginTop: 5, color: 'rgba(247,250,255,.84)', fontSize: enSize,
      lineHeight: 1.08, fontWeight: 680, textAlign: 'center', whiteSpace: 'nowrap',
      textShadow: '0 2px 6px #000,0 0 13px rgba(0,0,0,.78)'}}>{caption.english}</div>
  </div>;
};

export const TenAIBusinessesFinal: React.FC<EpisodeProps> = ({plan, withSfx}) => {
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender('加载本期本地字体');
    const fonts = [loadFont({family: EFFECT_FONT, url: sourceUrl(plan.fontSource ?? DEFAULT_FONT, plan),
      format: 'woff2', weight: '400', display: 'block'})];
    if (plan.captionFontSource) fonts.push(loadFont({family: CAPTION_FONT,
      url: sourceUrl(plan.captionFontSource, plan), weight: '400', display: 'block'}));
    Promise.all(fonts).then(() => continueRender(handle))
      .catch((error: unknown) => cancelRender(new Error(`本期本地字体加载失败：${String(error)}`)));
  }, [plan.fontSource, plan.captionFontSource, plan.assetPrefix]);

  const paper = plan.paperClips.find((clip) => inside(frame, clip));
  const opening = plan.opening && inside(frame, plan.opening) ? plan.opening : null;
  const active = paper || opening ? [] : plan.motions.filter((motion) => inside(frame, motion));
  const chapter = [...active].reverse().find((motion) => motion.kind === 'chapter');
  const semantic = [...active].reverse().find((motion) => motion.kind !== 'products' && motion.kind !== 'tile' && motion.kind !== 'chapter') ?? chapter;
  const products = active.find((motion) => motion.kind === 'products');
  const tile = active.find((motion) => motion.kind === 'tile');
  const camera = cameraState(frame, paper ? [] : plan.cameras);
  const caption = plan.captions.find((item) => inside(frame, item));
  const mixedAudio = withSfx ? plan.audioWithSfx : plan.audioNoSfx;

  return <AbsoluteFill translate="no" className="notranslate" style={{backgroundColor: '#111A24', overflow: 'hidden'}}>
    {!paper && !opening ? <AbsoluteFill data-camera-scale={camera.scale} style={{transform: `scale(${camera.scale})`, transformOrigin: camera.origin}}>
      <OffthreadVideo data-source="continuous-original-picture" src={sourceUrl(plan.hostSource, plan)} muted
        trimBefore={0} trimAfter={plan.durationInFrames} playbackRate={1}
        style={{width: '100%', height: '100%', objectFit: 'cover'}} onError={failMedia(plan.hostSource)} />
    </AbsoluteFill> : null}
    {plan.opening ? <Sequence from={plan.opening.from} durationInFrames={plan.opening.to - plan.opening.from}
      premountFor={plan.fps}>
      <TitleBehindSubject opening={plan.opening} plan={plan} camera={camera} />
    </Sequence> : null}
    {plan.paperClips.map((clip) => <Sequence key={clip.id} from={clip.from} durationInFrames={clip.to - clip.from}
      premountFor={plan.fps}>
      <AbsoluteFill data-paper={clip.id} style={{backgroundColor: '#111A24'}}>
        <OffthreadVideo src={sourceUrl(clip.src, plan)} muted playbackRate={1}
          trimBefore={Math.round(clip.sourceInFrame / clip.sourceFps * plan.fps)}
          trimAfter={Math.round(clip.sourceInFrame / clip.sourceFps * plan.fps) + clip.to - clip.from}
          style={{width: '100%', height: '100%', objectFit: 'contain'}} onError={failMedia(clip.src)} />
        <div style={{position: 'absolute', right: 48, top: 28, fontFamily: EFFECT_FONT, fontSize: 24,
          color: PALETTE.ink, backgroundColor: 'rgba(5,10,18,.5)', padding: '5px 12px', borderRadius: 5}}>AI生成·纸艺示意</div>
      </AbsoluteFill>
    </Sequence>)}
    {!paper && !opening && !tile && semantic ? <SemanticStage motion={semantic} chapter={chapter} frame={frame} fps={plan.fps} /> : null}
    {!paper && !opening && !tile && products ? <ProductCards motion={products} frame={frame} plan={plan} /> : null}
    {!paper && !opening && tile ? <TileDissolve motion={tile} frame={frame} /> : null}
    <div style={{position: 'absolute', left: 64, top: 38, fontFamily: captionFontFamily, fontSize: 24,
      fontWeight: 900, color: 'rgba(247,250,255,.88)', textShadow: '0 3px 12px rgba(0,0,0,.9)'}}>超哥AI创业记</div>
    {caption ? <BilingualCaption caption={caption} frame={frame} plan={plan} /> : null}
    {/* 两版都保留完整真人原声与纸艺原生声；此开关只选择是否加入后期动作音的预混轨。 */}
    <Audio data-audio="complete-voice-and-paper-native-sound" src={sourceUrl(mixedAudio, plan)}
      trimBefore={0} trimAfter={plan.durationInFrames} playbackRate={1} volume={1} onError={failMedia(mixedAudio)} />
  </AbsoluteFill>;
};
