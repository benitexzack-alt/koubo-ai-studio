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
import {StableBilingualCaptionOverlay} from './components/StableBilingualCaptionOverlay';
import {
  V7AnnotatedMediaStage,
  V7HeroMetric,
  V7TransparentInfoStack,
  V7TruthStatement,
} from './components/V7InformationStage';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

const testStartSeconds = 129;
const testStartFrame = f(testStartSeconds);

export const WAIC_V7_TEST_DURATION_IN_FRAMES = f(30);

const testSegments = [
  {id: 'main-a', from: 0, duration: 739, trimBefore: testStartFrame, volume: 1},
  {id: 'borrow-not-equal', from: 739, duration: 30, trimBefore: 3332, volume: 0},
  {id: 'main-b', from: 769, duration: 131, trimBefore: 4613, volume: 1},
];

const V7TalkFootage: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const scale = interpolate(
    seconds,
    [0, 4.8, 10.1, 18.2, 23.0, 30],
    [1.035, 1.055, 1.035, 1.058, 1.038, 1.05],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const x = interpolate(
    seconds,
    [0, 4.8, 10.1, 18.2, 23.0, 30],
    [0, 8, -2, 10, 0, 5],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const y = Math.sin(seconds * 0.34) * 1.8;

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#05090E'}}>
      {testSegments.map((segment) => (
        <Sequence
          key={segment.id}
          from={segment.from}
          durationInFrames={segment.duration}
          premountFor={fps}
        >
          <Video
            src={staticFile('media/waic2026-v6/WAIC_20260718_talk01_30fps_loudness.mp4')}
            trimBefore={segment.trimBefore}
            volume={segment.volume}
            objectFit="cover"
            style={{
              width: '100%',
              height: '100%',
              filter: 'contrast(1.045) saturate(1.04) brightness(1.01)',
              transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
              transformOrigin: '55% 36%',
            }}
          />
        </Sequence>
      ))}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.16) 0%, rgba(2,7,12,0.01) 52%, rgba(2,7,12,0.08) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const V7Scenes: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={f(0.15)} durationInFrames={f(4.65)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="CASE STUDY · 天文数据案例"
        title="18岁学生，重新观察旧数据"
        items={[
          {label: '人物', detail: '马泰奥·帕兹', tone: 'cyan'},
          {label: '年龄', detail: '18岁', tone: 'amber', active: true},
          {label: '研究对象', detail: 'NEOWISE红外观测', tone: 'cyan'},
        ]}
      />
    </Sequence>

    <Sequence from={f(4.8)} durationInFrames={f(5.2)} premountFor={15}>
      <V7AnnotatedMediaStage
        index="01"
        eyebrow="OBSERVATION DATA"
        title="退役望远镜留下的观测数据"
        facts={[
          {label: '设备', value: 'NEOWISE', tone: 'cyan'},
          {label: '数据跨度', value: '10年', tone: 'amber'},
          {label: '输入类型', value: '红外观测', tone: 'white'},
        ]}
        mediaSrc="media/waic2026-v6/V05-retired-telescope-data.mp4"
        mediaKind="video"
        mediaLabel="AI概念画面 · 非真实天文影像"
      />
    </Sequence>

    <Sequence from={f(10.15)} durationInFrames={f(8.0)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="METHOD · 方法不是结论"
        title="机器学习在寻找细微变化"
        items={[
          {label: '输入', detail: '10年红外测量', tone: 'cyan'},
          {label: '识别', detail: '很细微的变化', tone: 'amber', active: true},
          {label: '输出', detail: '标记并分类候选目标', tone: 'green'},
        ]}
      />
    </Sequence>

    <Sequence from={f(18.2)} durationInFrames={f(4.85)} premountFor={10}>
      <V7HeroMetric
        eyebrow="FLAGGED & CLASSIFIED · 标记并分类"
        prefix="约"
        value="150万"
        caption="潜在新目标"
        facts={['来自红外测量中的细微变化', '这是候选结果，不是最终确认']}
        tone="amber"
      />
    </Sequence>

    <Sequence from={f(23.05)} durationInFrames={f(6.95)} premountFor={10}>
      <V7TruthStatement
        eyebrow="FACT CHECK · 事实边界"
        left="约150万个潜在新目标"
        right="逐个确认的新天体"
        note="模型先找候选，后续仍需要进一步观测与人工确认。"
      />
    </Sequence>
  </AbsoluteFill>
);

const V7Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = (frame / Math.max(1, WAIC_V7_TEST_DURATION_IN_FRAMES - 1)) * 100;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
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
        <div style={{marginLeft: 22, color: '#62D8FF', fontSize: 17, fontWeight: 900}}>兰州AI创业者 · 啊超</div>
      </div>
      <div style={{position: 'absolute', left: 54, right: 54, bottom: 20, height: 3, background: 'rgba(255,255,255,0.14)', zIndex: 140}}>
        <div style={{width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #62D8FF, #FFBE55)', boxShadow: '0 0 14px rgba(98,216,255,0.65)'}} />
      </div>
    </>
  );
};

const V7SoundDesign: React.FC = () => (
  <>
    <Sequence from={f(0.2)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/waic2026-v6/card-pop.wav')} volume={0.72} />
    </Sequence>
    <Sequence from={f(4.8)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/waic2026-v6/section-whoosh.wav')} volume={0.13} />
    </Sequence>
    <Sequence from={f(18.2)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/waic2026-v6/thesis-impact.wav')} volume={1.15} />
    </Sequence>
    <Sequence from={f(23.05)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/waic2026-v6/node-connect.wav')} volume={0.28} />
    </Sequence>
  </>
);

export const WAICV7TransparentTest16x9: React.FC = () => (
  <AbsoluteFill style={{background: '#05090E', overflow: 'hidden'}}>
    <LocalFont />
    <V7TalkFootage />
    <V7Scenes />
    <Sequence from={739} durationInFrames={30} premountFor={5}>
      <Audio src={staticFile('audio/waic2026-v6/correction-not-equal.wav')} volume={1} />
    </Sequence>
    <V7SoundDesign />
    <V7Hud />
    <Sequence from={-testStartFrame}>
      <StableBilingualCaptionOverlay captionsSrc="data/WAIC_20260718_talk01_16x9.bilingual.v1.json" />
    </Sequence>
  </AbsoluteFill>
);
