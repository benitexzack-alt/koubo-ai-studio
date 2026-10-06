import React, {type CSSProperties, type ReactNode} from 'react';
import {useCurrentFrame} from 'remotion';
import {CHAPTERS, DEFAULT_BURST_LINES, DEFAULT_BURST_STATEMENT, OVERLAY_BOUNDS, PAPER_ORANGE as C, TYPE} from './plan';
import {chapterSettle, entered, frameState, progress} from './motion';

const font = '"PingFang SC", "Microsoft YaHei", sans-serif';
const base: CSSProperties = {fontFamily: font, color: C.text, boxSizing: 'border-box', fontSynthesis: 'none'};
export interface LayerProps {left?: number; top?: number; width?: number; height?: number;}
const Layer: React.FC<LayerProps & {children: ReactNode}> = ({
  left = OVERLAY_BOUNDS.left, top = OVERLAY_BOUNDS.top, width = OVERLAY_BOUNDS.width,
  height = OVERLAY_BOUNDS.height, children,
}) => <div translate="no" className="notranslate"
  style={{...base, position: 'absolute', left, top, width, height, overflow: 'hidden'}}>{children}</div>;
const Heading: React.FC<{children: ReactNode}> = ({children}) =>
  <div style={{fontSize: TYPE.headline, fontWeight: 650, lineHeight: 1.23, letterSpacing: '-0.02em'}}>{children}</div>;
const Rule: React.FC<{width?: number; progress?: number}> = ({width = 740, progress: p = 1}) =>
  <div style={{height: 4, marginTop: 24, width, background: C.accent, transform: `scaleX(${p})`, transformOrigin: 'left'}} />;

export interface BurstStatementProps extends LayerProps {burstPhrase?: string; statement?: string;}
export const BurstStatement: React.FC<BurstStatementProps> = ({burstPhrase = '10', statement = DEFAULT_BURST_STATEMENT, ...layer}) => {
  const frame = useCurrentFrame();
  const [burstOpacity, sweep, reveal] = frameState('burst', frame);
  return <Layer {...layer}>
    <div style={{position: 'absolute', top: 50, left: 12, width: 740, height: 400, overflow: 'hidden', opacity: burstOpacity}}>
      {[-3, -2, -1, 0, 1, 2, 3].map((index) => <div key={index} style={{
        position: 'absolute', left: 120, top: 55 + index * 116 - sweep * 180,
        fontSize: 180, fontWeight: 750, lineHeight: 1, color: 'transparent',
        WebkitTextStroke: `2px ${C.accent}`, opacity: 0.25,
      }}>{burstPhrase}</div>)}
      <div style={{position: 'absolute', left: 120, top: 100, fontSize: 180, fontWeight: 750, lineHeight: 1, color: C.accent}}>{burstPhrase}</div>
    </div>
    <div style={{position: 'absolute', left: 12, top: 95, width: 740,
      opacity: reveal > 0 ? 1 : 0, clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
      filter: `blur(${(1 - reveal) * 5}px)`}}>
      <div style={{fontSize: 104, fontWeight: 650, lineHeight: 1.18, letterSpacing: '-0.03em'}}>
        {(statement === DEFAULT_BURST_STATEMENT ? DEFAULT_BURST_LINES : statement.split('\n'))
          .map((line, index) => <div key={index}>{line}</div>)}
      </div>
      <Rule width={720} progress={reveal} />
    </div>
  </Layer>;
};

export interface ChapterStampProps extends LayerProps {chapterIndex?: number; titleLines?: readonly string[];}
export const ChapterStamp: React.FC<ChapterStampProps> = ({chapterIndex = 0, titleLines, ...layer}) => {
  if (!Number.isInteger(chapterIndex) || chapterIndex < 0 || chapterIndex >= CHAPTERS.length) throw new Error('章名序号必须在 0—9');
  const frame = useCurrentFrame();
  const enter = entered(frame, 5, 10);
  const settle = chapterSettle(frame);
  const lines = titleLines ?? CHAPTERS[chapterIndex];
  return <Layer {...layer}>
    <div style={{position: 'absolute', left: 12, top: 45, width: 740, transformOrigin: 'left center',
      opacity: enter, transform: `rotate(${(1 - settle) * -7}deg) scale(${1.12 - settle * 0.12})`}}>
      <Heading>{lines.map((line, index) => <div key={index}>{line}</div>)}</Heading>
      <Rule width={Math.min(720, 100 + Math.max(...lines.map((line) => line.length)) * 60)} />
    </div>
    <div style={{position: 'absolute', left: 12, top: 276, color: C.accent, fontSize: TYPE.label,
      fontWeight: 500, opacity: entered(frame, 16, 6)}}>第 {chapterIndex + 1} 项</div>
  </Layer>;
};

export interface SequentialListProps extends LayerProps {heading?: string; items?: readonly string[]; initialVisibleCount?: number;}
export const SequentialList: React.FC<SequentialListProps> = ({
  heading = '打包交付', items = ['硬件', '软件', '配置', '培训'], initialVisibleCount = 0, ...layer
}) => {
  if (!items.length || items.length > 4) throw new Error('局部列表只支持 1—4 项；请分段，不缩字塞十项');
  if (!Number.isInteger(initialVisibleCount) || initialVisibleCount < 0 || initialVisibleCount > items.length) throw new Error('初始可见项数量不合法');
  const frame = useCurrentFrame();
  return <Layer {...layer}>
    <Heading>{heading}</Heading>
    <div style={{marginTop: 36, display: 'flex', flexDirection: 'column', gap: 20, width: 730}}>
      {items.map((item, index) => {
        const reveal = index < initialVisibleCount ? 1 : entered(frame, 10 + index * 29);
        return <div key={`${index}-${item}`} style={{display: 'flex', alignItems: 'center', height: 86,
          border: `2px solid ${C.rule}`, borderRadius: 43, padding: '0 22px', gap: 24}}>
          <div style={{fontSize: TYPE.label, color: C.muted, width: 44, height: 44, lineHeight: '40px', textAlign: 'center',
            border: `2px solid ${C.accent}`, borderRadius: 22, flexShrink: 0}}>{index + 1}</div>
          <div style={{fontSize: TYPE.body, lineHeight: 1.1, whiteSpace: 'nowrap',
            clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`, filter: `blur(${(1 - reveal) * 4}px)`}}>{item}</div>
        </div>;
      })}
    </div>
  </Layer>;
};

export interface OpposingLabelsProps extends LayerProps {initialLabel?: string; leftLabel?: string; rightLabel?: string;}
export const OpposingLabels: React.FC<OpposingLabelsProps> = ({
  initialLabel = 'AI代写', leftLabel = 'AI初稿', rightLabel = '人工深度二创', ...layer
}) => {
  const frame = useCurrentFrame();
  const [initial, left, right] = frameState('opposing', frame);
  return <Layer {...layer}>
    <div style={{position: 'absolute', left: 12, top: 60, fontSize: TYPE.headline, opacity: initial,
      transform: `translateX(${(1 - initial) * -32}px)`}}>{initialLabel}</div>
    <div style={{position: 'absolute', left: 12, top: 175, padding: '18px 28px',
      background: C.text, color: C.surface, fontSize: TYPE.headline, opacity: left,
      transform: `translateX(${(1 - left) * -56}px)`}}>{leftLabel}</div>
    <div style={{position: 'absolute', left: 170, top: 320, width: 570,
      fontSize: TYPE.headline, fontWeight: 650, fontStyle: 'italic', color: C.accent,
      opacity: right, transform: `translateX(${(1 - right) * 42}px)`}}>{rightLabel}</div>
    <div style={{position: 'absolute', left: 170, top: 408, width: 500, height: 4,
      background: C.accent, transformOrigin: 'left', transform: `scaleX(${right})`}} />
  </Layer>;
};

const connectorStyle: CSSProperties = {stroke: C.accent, strokeWidth: 4, fill: 'none'};
export interface PipelinePackageProps extends LayerProps {stages?: readonly string[]; outputs?: readonly string[]; system?: string; outcome?: string;}
export const PipelinePackage: React.FC<PipelinePackageProps> = ({
  stages = ['选品', '内容', '客服'], outputs = ['交付'], system = '可复用的课件', outcome = '结果导向的工作流培训', ...layer
}) => {
  if (stages.length !== 3 || !outputs.length || outputs.length > 3) throw new Error('候选流程支持三个阶段、1—3 个输出；其他拓扑另审');
  const frame = useCurrentFrame();
  const shrink = progress(frame, 102, 125);
  const boundary = entered(frame, 123, 22);
  const result = entered(frame, 149, 19);
  return <Layer {...layer}>
    <Heading>完整业务流程</Heading>
    <div style={{position: 'absolute', left: 10, top: 118, width: 740, height: 380,
      border: `3px solid ${C.accent}`, borderRadius: 16, opacity: boundary,
      clipPath: `inset(0 ${(1 - boundary) * 100}% 0 0)`}} />
    <div style={{position: 'absolute', left: 10, top: 118, width: 740, height: 390,
      transformOrigin: 'center center', transform: `scale(${1 - shrink * 0.10}) translateY(${-shrink * 10}px)`}}>
      <svg width={740} height={390} style={{position: 'absolute', left: 0, top: 0}}>
        {[0, 1].map((index) => {
          const amount = entered(frame, 17 + index * 24, 10);
          return <path key={index} d={`M ${195 + index * 255} 80 H ${255 + index * 255}`} style={{...connectorStyle, strokeDasharray: 60, strokeDashoffset: 60 * (1 - amount)}} />;
        })}
        {outputs.map((_, index) => {
          const x = 370 + (index - (outputs.length - 1) / 2) * 240;
          return <path key={index} d={`M 607 140 V 176 H ${x} V 225`} style={{...connectorStyle, opacity: entered(frame, 66 + index * 12)}} />;
        })}
      </svg>
      {stages.map((stage, index) => <div key={stage} style={{position: 'absolute', left: index * 255, top: 26,
        width: 195, minHeight: 112, padding: '22px 12px', background: C.surface,
        borderBottom: `5px solid ${C.accent}`, fontSize: 50, textAlign: 'center',
        opacity: entered(frame, 5 + index * 24), transform: `translateY(${(1 - entered(frame, 5 + index * 24)) * 20}px)`}}>{stage}</div>)}
      {outputs.map((output, index) => <div key={`${index}-${output}`} style={{position: 'absolute',
        left: 280 + (index - (outputs.length - 1) / 2) * 240, top: 228, width: 180,
        background: C.accent, padding: '12px 0', color: C.accentInk, fontSize: 50, textAlign: 'center',
        opacity: entered(frame, 72 + index * 12)}}>{output}</div>)}
    </div>
    <div style={{position: 'absolute', left: 28, top: 462, fontSize: TYPE.label, color: C.muted, opacity: boundary}}>{system}</div>
    <svg width={740} height={85} style={{position: 'absolute', left: 10, top: 500}}>
      <path d="M 370 0 V 66" style={{...connectorStyle, strokeDasharray: 66, strokeDashoffset: 66 * (1 - result)}} />
      <path d="M 359 53 L 370 66 L 381 53" style={{...connectorStyle, opacity: result}} />
    </svg>
    <div style={{position: 'absolute', left: 10, top: 586, width: 740, fontSize: TYPE.headline,
      color: C.accent, lineHeight: 1.14, fontWeight: 650, opacity: result}}>{outcome}</div>
  </Layer>;
};

export interface AdditiveEquationProps extends LayerProps {components?: readonly string[]; result?: string;}
export const AdditiveEquation: React.FC<AdditiveEquationProps> = ({
  components = ['AI初稿', '人工深度二创'], result = '内容服务', ...layer
}) => {
  if (components.length !== 2) throw new Error('局部组成关系候选只支持两个部件，不自动扩展图式');
  const frame = useCurrentFrame();
  const [one, plus, two, resolved] = frameState('equation', frame);
  return <Layer {...layer}>
    <Heading>AI内容反同质化服务</Heading>
    <div style={{position: 'absolute', left: 0, top: 160, width: 285, opacity: one,
      transform: `translateY(${(1 - one) * 18}px)`}}>
      <div style={{width: 90, height: 78, border: `4px solid ${C.rule}`, borderLeft: `9px solid ${C.accent}`, marginBottom: 24}} />
      <div style={{fontSize: TYPE.headline, lineHeight: 1.2, width: 285}}>{components[0]}</div>
    </div>
    <div style={{position: 'absolute', left: 296, top: 207, fontSize: 86, color: C.accent, opacity: plus}}>+</div>
    <div style={{position: 'absolute', left: 385, top: 160, width: 360, opacity: two,
      transform: `translateY(${(1 - two) * 18}px)`}}>
      <svg width={96} height={82} style={{display: 'block', marginBottom: 24}}>
        <path d="M 7 61 L 18 33 L 60 4 L 82 27 L 40 68 Z M 19 33 L 40 54 M 7 76 H 87" style={{...connectorStyle, strokeWidth: 5}} />
      </svg>
      <div style={{fontSize: TYPE.headline, lineHeight: 1.2, width: 360}}>{components[1]}</div>
    </div>
    <div style={{position: 'absolute', left: 0, top: 432, display: 'flex', alignItems: 'center', gap: 40,
      opacity: resolved, transform: `translateY(${(1 - resolved) * 16}px)`}}>
      <div style={{fontSize: 86, color: C.accent}}>=</div>
      <div style={{fontSize: 76, color: C.accent, fontWeight: 650}}>{result}</div>
    </div>
  </Layer>;
};
