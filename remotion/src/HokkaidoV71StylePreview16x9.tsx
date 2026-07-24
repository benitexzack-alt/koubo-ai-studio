import {Audio, Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {LocalFont} from './components/LocalFont';
import {
  V7AnnotatedMediaStage,
  V7ChapterMarker,
  V7EvidenceQuote,
  V7HeroMetric,
  V7ProcessRail,
} from './components/V7InformationStage';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const HOKKAIDO_V71_PREVIEW_DURATION_IN_FRAMES = f(30);

const PreviewFootage: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const scale = interpolate(
    seconds,
    [0, 6.8, 14, 20, 25, 30],
    [1.03, 1.055, 1.035, 1.057, 1.035, 1.052],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const x = interpolate(
    seconds,
    [0, 6.8, 14, 20, 25, 30],
    [-2, 8, -3, 8, -1, 5],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#05090E'}}>
      <Video
        src={staticFile('media/two-ledgers-20260722/main-30fps.mp4')}
        muted
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(1.045) saturate(1.025) brightness(0.96)',
          transform: `translate3d(${x}px, ${Math.sin(seconds * 0.28) * 1.6}px, 0) scale(${scale})`,
          transformOrigin: '59% 40%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.20) 0%, rgba(2,7,12,0.02) 53%, rgba(2,7,12,0.07) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const PreviewScenes: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={f(0.1)} durationInFrames={f(6.6)} premountFor={10}>
      <V7ChapterMarker
        index="01"
        eyebrow="REAL PROBLEM · 北海道农场"
        title="不是先学AI"
        subtitle="先把田里每天重复、又真的麻烦的一件事说清楚。"
      />
    </Sequence>

    <Sequence from={f(6.8)} durationInFrames={f(7)} premountFor={10}>
      <V7ProcessRail
        eyebrow="WORKFLOW · 一条真实工作链"
        title="AI怎样进入一个项目"
        steps={[
          {label: '现场输入', detail: '愿望、资料、真实问题', tone: 'cyan'},
          {label: 'AI处理', detail: '整理、生成、串联工具', tone: 'amber'},
          {label: '人工验收', detail: '核对事实与可用性', tone: 'cyan'},
          {label: '留下结果', detail: '下次还能继续调用', tone: 'green'},
        ]}
      />
    </Sequence>

    <Sequence from={f(14)} durationInFrames={f(6)} premountFor={10}>
      <V7EvidenceQuote
        marker="OFFICIAL CASE"
        source="OpenAI 官方视频 · 2026-07-09"
        quote="我不是工程师，但我用 Codex 提高效率"
        caption="引用只证明真实案例，不把二创解说当成原始信源。"
      />
    </Sequence>

    <Sequence from={f(20)} durationInFrames={f(5)} premountFor={10}>
      <V7HeroMetric
        eyebrow="LOCAL PRACTICE · 兰州本地实践"
        value="3"
        suffix="个真实项目"
        caption="不是三个功能，是三条工作链"
        facts={['今石缘线上石展', 'Bo2漫展服务', '大志设计灵感系统']}
        tone="amber"
      />
    </Sequence>

    <Sequence from={f(25)} durationInFrames={f(5)} premountFor={10}>
      <V7AnnotatedMediaStage
        index="03"
        eyebrow="MEDIA + FACTS"
        title="画面展示时，重点仍然留在屏幕上"
        facts={[
          {label: '主体', value: '完整素材画面', tone: 'cyan'},
          {label: '辅助', value: '侧边事实标注', tone: 'amber'},
          {label: '底部', value: '双语字幕同步', tone: 'white'},
        ]}
        mediaSrc="media/dazhi-20260721/inspiration-motion-v1.mp4"
        mediaKind="video"
        mediaLabel="大志灵感系统 · 已有项目素材"
      />
    </Sequence>
  </AbsoluteFill>
);

const PreviewHud: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = frame / Math.max(1, HOKKAIDO_V71_PREVIEW_DURATION_IN_FRAMES - 1);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 28,
          display: 'flex',
          alignItems: 'center',
          color: '#F7FAFC',
          fontFamily,
          textShadow: '0 3px 16px rgba(0,0,0,0.94)',
          zIndex: 120,
        }}
      >
        <div style={{width: 9, height: 9, background: '#62D8FF', boxShadow: '0 0 17px #62D8FF'}} />
        <div style={{marginLeft: 12, fontSize: 19, fontWeight: 950}}>超哥AI创业记</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
          bottom: 20,
          height: 3,
          background: 'rgba(255,255,255,0.14)',
          zIndex: 140,
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #62D8FF, #FFBE55)',
            boxShadow: '0 0 14px rgba(98,216,255,0.65)',
          }}
        />
      </div>
    </>
  );
};

const PreviewSound: React.FC = () => (
  <>
    <Sequence from={f(0.12)}>
      <Audio src={staticFile('audio/koubo-sfx-v1/section-air.wav')} volume={0.1} />
    </Sequence>
    <Sequence from={f(6.8)}>
      <Audio src={staticFile('audio/koubo-sfx-v1/node-connect.wav')} volume={0.15} />
    </Sequence>
    <Sequence from={f(14)}>
      <Audio src={staticFile('audio/koubo-sfx-v1/card-reveal.wav')} volume={0.1} />
    </Sequence>
    <Sequence from={f(20)}>
      <Audio src={staticFile('audio/koubo-sfx-v1/keyword-tick.wav')} volume={0.12} />
    </Sequence>
    <Sequence from={f(25)}>
      <Audio src={staticFile('audio/koubo-sfx-v1/ui-click.wav')} volume={0.11} />
    </Sequence>
  </>
);

const Preview: React.FC<{withSfx: boolean}> = ({withSfx}) => (
  <AbsoluteFill style={{background: '#05090E', overflow: 'hidden'}}>
    <LocalFont />
    <PreviewFootage />
    <PreviewScenes />
    {withSfx ? <PreviewSound /> : null}
    <PreviewHud />
  </AbsoluteFill>
);

export const HokkaidoV71StylePreview16x9: React.FC = () => <Preview withSfx />;

export const HokkaidoV71StylePreview16x9NoSfx: React.FC = () => <Preview withSfx={false} />;
