import {Video} from '@remotion/media';
import React, {type CSSProperties, type ReactNode} from 'react';
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {CaptionOverlay} from './components/CaptionOverlay';
import {LocalFont} from './components/LocalFont';

const fps = 30;
const frameAt = (seconds: number) => Math.round(seconds * fps);

export const AI_LANDING_DOCUMENTARY_V2_DURATION_IN_FRAMES = frameAt(589.671);

const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

const chapters = [
  {start: 0, end: 24.46, index: '01', label: '本地 AI 落地，先看现场'},
  {start: 24.46, end: 203.94, index: '02', label: '先理解真实业务'},
  {start: 203.94, end: 300.14, index: '03', label: '把需求翻译给 Codex'},
  {start: 300.14, end: 476.72, index: '04', label: '安装、实操与工作流'},
  {start: 476.72, end: 559.28, index: '05', label: 'GEO 不等于 SEO'},
  {start: 559.28, end: 589.671, index: '06', label: '方案交接，先跑小闭环'},
];

const fadeForSequence = (frame: number, duration: number, fadeFrames = 10) =>
  interpolate(frame, [0, fadeFrames, duration - fadeFrames, duration], [0, 1, 1, 0], clamp);

const FrostedMask: React.FC<{
  style: CSSProperties;
  radius?: number;
}> = ({style, radius = 24}) => (
  <div
    style={{
      position: 'absolute',
      borderRadius: radius,
      background: 'rgba(4, 11, 18, 0.22)',
      backdropFilter: 'blur(44px) saturate(0.32) brightness(0.72)',
      WebkitBackdropFilter: 'blur(44px) saturate(0.32) brightness(0.72)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 10px 40px rgba(0,0,0,0.2)',
      ...style,
    }}
  />
);

const PrivacyLabel: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      right: 34,
      top: 30,
      padding: '9px 13px',
      borderRadius: 9,
      color: 'rgba(245,249,252,0.9)',
      background: 'rgba(4,11,18,0.74)',
      fontFamily,
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: 0.5,
    }}
  >
    现场信息已脱敏
  </div>
);

const BaseFootagePrivacy: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <FrostedMask style={{left: -34, top: -28, width: 650, height: 560}} />
    <FrostedMask style={{left: 286, top: 46, width: 1155, height: 684}} />
    <FrostedMask style={{left: 1432, top: 46, width: 530, height: 790}} />
    <PrivacyLabel />
  </AbsoluteFill>
);

const WalkthroughPrivacy: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <FrostedMask style={{left: -30, top: 300, width: 1160, height: 810}} />
    <FrostedMask style={{left: 1150, top: 155, width: 810, height: 690}} />
    <PrivacyLabel />
  </AbsoluteFill>
);

const ControlDeskPrivacy: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <FrostedMask style={{left: 445, top: 425, width: 460, height: 390}} radius={20} />
    <FrostedMask style={{left: 865, top: 355, width: 360, height: 330}} radius={18} />
    <FrostedMask style={{left: 620, top: 140, width: 245, height: 245}} radius={90} />
    <FrostedMask style={{left: 1230, top: 130, width: 260, height: 250}} radius={95} />
    <PrivacyLabel />
  </AbsoluteFill>
);

const OpeningTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const entered = spring({frame, fps, config: {damping: 20, stiffness: 150, mass: 0.85}});
  const opacity = interpolate(frame, [0, 12, 220, 246], [0, 1, 1, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        padding: '0 78px 205px',
        background:
          'linear-gradient(90deg, rgba(2,8,14,0.85) 0%, rgba(2,8,14,0.36) 56%, rgba(2,8,14,0.05) 100%), linear-gradient(0deg, rgba(2,8,14,0.7), transparent 55%)',
        opacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 1070,
          color: '#F7FBFF',
          fontFamily,
          transform: `translateY(${interpolate(entered, [0, 1], [26, 0])}px)`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 14, color: '#5DE8FF', fontSize: 23, fontWeight: 900}}>
          <span style={{width: 42, height: 5, background: '#5DE8FF'}} />
          真实企业现场
        </div>
        <div style={{marginTop: 18, fontSize: 66, lineHeight: 1.08, fontWeight: 950, letterSpacing: -1.5}}>
          本地 AI 落地服务纪实
        </div>
        <div style={{marginTop: 20, color: 'rgba(247,251,255,0.82)', fontSize: 30, lineHeight: 1.35, fontWeight: 700}}>
          从需求梳理，到 Codex 工作流与 GEO 内容基础
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ChapterRibbon: React.FC<{index: string; label: string; duration: number}> = ({index, label, duration}) => {
  const frame = useCurrentFrame();
  const opacity = fadeForSequence(frame, duration, 12);
  const entered = spring({frame, fps, config: {damping: 20, stiffness: 185}});

  return (
    <div
      style={{
        position: 'absolute',
        left: 44,
        top: 34,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '11px 16px 12px 12px',
        borderRadius: 13,
        color: '#F7FBFF',
        background: 'rgba(3,11,19,0.82)',
        boxShadow: '0 14px 46px rgba(0,0,0,0.3)',
        fontFamily,
        opacity,
        transform: `translateX(${interpolate(entered, [0, 1], [-22, 0])}px)`,
      }}
    >
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 40,
          height: 40,
          borderRadius: 9,
          background: '#53E5FF',
          color: '#07131D',
          fontSize: 18,
          fontWeight: 950,
        }}
      >
        {index}
      </div>
      <div style={{fontSize: 23, fontWeight: 900}}>{label}</div>
    </div>
  );
};

const EditorialNote: React.FC<{
  title: string;
  body: string;
  disclaimer?: string;
  duration: number;
  accent?: string;
  children?: ReactNode;
}> = ({title, body, disclaimer, duration, accent = '#5DE8FF', children}) => {
  const frame = useCurrentFrame();
  const opacity = fadeForSequence(frame, duration, 12);
  const entered = spring({frame, fps, config: {damping: 18, stiffness: 160}});

  return (
    <div
      style={{
        position: 'absolute',
        right: 54,
        top: 128,
        width: 670,
        padding: '24px 27px 25px',
        borderRadius: 20,
        borderTop: `6px solid ${accent}`,
        color: '#F7FBFF',
        background: 'linear-gradient(135deg, rgba(5,16,27,0.94), rgba(7,26,39,0.9))',
        boxShadow: '0 26px 72px rgba(0,0,0,0.4)',
        fontFamily,
        opacity,
        transform: `translateY(${interpolate(entered, [0, 1], [24, 0])}px)`,
      }}
    >
      <div style={{color: accent, fontSize: 20, fontWeight: 900}}>编辑补充</div>
      <div style={{marginTop: 11, fontSize: 38, lineHeight: 1.12, fontWeight: 950}}>{title}</div>
      <div style={{marginTop: 15, color: 'rgba(247,251,255,0.83)', fontSize: 24, lineHeight: 1.48, fontWeight: 700}}>{body}</div>
      {children}
      {disclaimer ? (
        <div style={{marginTop: 14, color: 'rgba(247,251,255,0.58)', fontSize: 17, lineHeight: 1.4}}>{disclaimer}</div>
      ) : null}
    </div>
  );
};

const ClosingFlow: React.FC<{duration: number}> = ({duration}) => (
  <EditorialNote
    title="本地 AI 落地流程"
    body="先跑一个真实、可验证的小闭环，再决定是否扩大。"
    duration={duration}
    accent="#61F4A0"
  >
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 18}}>
      {['看现场', '拆流程', '工具介入', '小步试跑', '人工复核', '持续验证'].map((item, index) => (
        <React.Fragment key={item}>
          <span
            style={{
              padding: '8px 11px',
              borderRadius: 9,
              background: 'rgba(97,244,160,0.1)',
              color: '#B8FFD2',
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            {item}
          </span>
          {index < 5 ? <span style={{alignSelf: 'center', color: '#61F4A0', fontSize: 17}}>→</span> : null}
        </React.Fragment>
      ))}
    </div>
  </EditorialNote>
);

const ThirdPersonOpening: React.FC = () => (
  <>
    <Sequence from={0} durationInFrames={frameAt(4.6)}>
      <Video
        src={staticFile('media/AI_LANDING_20260711_thirdperson_0132_sdr.mp4')}
        trimBefore={frameAt(6.65)}
        volume={0}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
      <WalkthroughPrivacy />
    </Sequence>
    <Sequence from={frameAt(4.6)} durationInFrames={frameAt(3.7)}>
      <Video
        src={staticFile('media/AI_LANDING_20260711_thirdperson_0128_sdr.mp4')}
        trimBefore={frameAt(0.15)}
        volume={0}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
      <ControlDeskPrivacy />
    </Sequence>
    <Sequence from={0} durationInFrames={frameAt(8.3)}>
      <OpeningTitle />
    </Sequence>
  </>
);

export const AILandingFieldDocumentaryV2: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#030A11', overflow: 'hidden'}}>
      <LocalFont />
      <Video
        src={staticFile('media/AI_LANDING_20260711_documentary_base_rough_v2.mp4')}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
      <Sequence from={frameAt(8.3)} durationInFrames={AI_LANDING_DOCUMENTARY_V2_DURATION_IN_FRAMES - frameAt(8.3)}>
        <BaseFootagePrivacy />
      </Sequence>

      <ThirdPersonOpening />

      {chapters.map((chapter) => {
        const duration = Math.min(frameAt(3.4), frameAt(chapter.end - chapter.start));
        return (
          <Sequence key={chapter.index} from={frameAt(chapter.start)} durationInFrames={duration}>
            <ChapterRibbon index={chapter.index} label={chapter.label} duration={duration} />
          </Sequence>
        );
      })}

      <Sequence from={frameAt(203.94)} durationInFrames={frameAt(211.5 - 203.94)}>
        <EditorialNote
          title="Vibe Coding 式协作"
          body="先用自然语言把业务、目标和边界讲清楚，再让工具规划与迭代。"
          duration={frameAt(211.5 - 203.94)}
        />
      </Sequence>

      <Sequence from={frameAt(476.72)} durationInFrames={frameAt(488.45 - 476.72)}>
        <EditorialNote
          title="GEO 不等于 SEO"
          body="SEO 帮助搜索引擎理解和发现信息；GEO 增加内容被生成式 AI 理解、引用或提及的机会。"
          disclaimer="不保证提及、曝光、咨询或成交"
          duration={frameAt(488.45 - 476.72)}
          accent="#61F4A0"
        />
      </Sequence>

      <Sequence from={frameAt(559.28)} durationInFrames={frameAt(589.671 - 559.28)}>
        <ClosingFlow duration={frameAt(589.671 - 559.28)} />
      </Sequence>

      <CaptionOverlay captionsSrc="data/AI_LANDING_20260711_documentary_v2.captions.json" />
    </AbsoluteFill>
  );
};
