import {Audio, Video} from '@remotion/media';
import React, {type CSSProperties, type ReactNode, useCallback, useEffect, useState} from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {LocalFont} from './components/LocalFont';
import {StableBilingualCaptionOverlay} from './components/StableBilingualCaptionOverlay';

export const WAIC_V6_DURATION_IN_FRAMES = 10704;
export const WAIC_V6_PREVIEW_DURATION_IN_FRAMES = 900;

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

const palette = {
  graphite: '#05090E',
  deepBlue: '#081A26',
  ink: '#F5F7F8',
  mist: '#C8D2D8',
  cyan: '#6BCFE8',
  steel: '#78A8BC',
  amber: '#F4AA55',
  green: '#86C89A',
  red: '#F0786C',
};

const editedSegments = [
  {id: 'main-a', from: 0, duration: 4609, trimBefore: 0},
  {id: 'borrow-not-equal', from: 4609, duration: 30, trimBefore: 3332},
  {id: 'main-b', from: 4639, duration: 3629, trimBefore: 4613},
  {id: 'main-c', from: 8268, duration: 2436, trimBefore: 8354},
];

const sceneFade = (frame: number, duration: number, fadeFrames = 10) =>
  Math.min(
    interpolate(frame, [0, Math.min(fadeFrames, duration / 2)], [0, 1], clamp),
    interpolate(frame, [Math.max(0, duration - fadeFrames), duration], [1, 0], clamp),
  );

const Enter: React.FC<{children: ReactNode; delay?: number; style?: CSSProperties}> = ({
  children,
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = spring({
    fps,
    frame: frame - delay,
    config: {damping: 19, stiffness: 170, mass: 0.85},
  });
  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [24, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const cameraTimes = [
  0, 6.0, 9.2, 20, 31.8, 41, 52, 56, 69, 82, 97, 106, 122, 129, 151, 160,
  174, 188, 207, 218, 250, 273, 278.6, 288, 306, 320, 341.7, 352, 356.8,
];
const cameraScale = [
  1.03, 1.06, 1.033, 1.03, 1.05, 1.034, 1.052, 1.032, 1.046, 1.032, 1.047,
  1.033, 1.046, 1.032, 1.046, 1.032, 1.045, 1.032, 1.048, 1.032, 1.047, 1.034,
  1.06, 1.034, 1.045, 1.032, 1.06, 1.04, 1.045,
];
const cameraX = [
  -5, 8, 0, -8, 10, 1, -9, 2, 12, 1, -8, 2, 10, 1, -8, 2, 10, 1, -9, 2,
  11, 2, -5, 2, 9, 1, -6, 1, 3,
];

const EditedFootage: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const scale = interpolate(seconds, cameraTimes, cameraScale, {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const x = interpolate(seconds, cameraTimes, cameraX, {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const y = Math.sin(seconds * 0.24) * 2.4;

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: palette.graphite}}>
      {editedSegments.map((segment) => (
        <Sequence
          key={segment.id}
          from={segment.from}
          durationInFrames={segment.duration}
          premountFor={fps}
        >
          <Video
            src={staticFile('media/waic2026-v6/WAIC_20260718_talk01_30fps_loudness.mp4')}
            trimBefore={segment.trimBefore}
            volume={segment.id === 'borrow-not-equal' ? 0 : 1}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'contrast(1.035) saturate(1.035) brightness(1.01)',
              transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
              transformOrigin: '55% 35%',
            }}
          />
        </Sequence>
      ))}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(4,9,14,0.18) 0%, rgba(4,9,14,0.015) 50%, rgba(4,9,14,0.08) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

type Broll = {
  id: string;
  start: number;
  end: number;
  src: string;
  kind: 'video' | 'image';
  label: string;
  title?: string;
  subtitle?: string;
  fit?: 'cover' | 'contain';
  evidence?: boolean;
  dim?: number;
};

const brolls: Broll[] = [
  {
    id: 'v01',
    start: 2.45,
    end: 7.55,
    src: 'media/waic2026-v6/V01-earthquake-hook.mp4',
    kind: 'video',
    label: 'AI概念画面',
    title: '论文里的结论，不等于见过地球的震动',
  },
  {
    id: 'v02',
    start: 28.72,
    end: 32.08,
    src: 'media/waic2026-v6/V02-machine-anomaly.mp4',
    kind: 'video',
    label: 'AI概念画面',
    title: '坏掉之前，机器先发出异常信号',
  },
  {
    id: 'v03',
    start: 35.55,
    end: 40.65,
    src: 'media/waic2026-v6/V03-farm-leaf-soil-weather.mp4',
    kind: 'video',
    label: 'AI概念画面',
    title: '叶色、土壤、天气，都在现场先发生',
  },
  {
    id: 'v04',
    start: 75.8,
    end: 80.9,
    src: 'media/waic2026-v6/V04-cold-chain-anomaly.mp4',
    kind: 'video',
    label: 'AI概念画面',
    title: '冷链数据，是一条连续变化的温度曲线',
  },
  {
    id: 'wang-jian-1',
    start: 99.0,
    end: 104.8,
    src: 'evidence/waic2026-v6/wang-jian-scientific-data-02m02s.jpg',
    kind: 'image',
    label: '演讲原视频截帧',
    title: '科学数据，不只有文字和表格',
    fit: 'contain',
    evidence: true,
  },
  {
    id: 'wang-jian-2',
    start: 111.0,
    end: 116.2,
    src: 'evidence/waic2026-v6/wang-jian-geodata-10m25s.jpg',
    kind: 'image',
    label: '演讲原视频截帧',
    title: '地震波、红外信号、设备声音，先于文字发生',
    fit: 'contain',
    evidence: true,
  },
  {
    id: 'v05',
    start: 134.1,
    end: 139.2,
    src: 'media/waic2026-v6/V05-retired-telescope-data.mp4',
    kind: 'video',
    label: 'AI概念画面',
    title: '旧数据没变，观察数据的方法变了',
  },
  {
    id: 'neowise-evidence',
    start: 148.1,
    end: 160.0,
    src: 'evidence/waic2026-v6/neowise-official-top-16x9.png',
    kind: 'image',
    label: '公开来源证据',
    title: '约150万个潜在新目标',
    subtitle: '“潜在”不等于已经逐个确认的新天体',
    fit: 'contain',
    evidence: true,
  },
  {
    id: 'v06',
    start: 219.0,
    end: 224.1,
    src: 'media/waic2026-v6/V06-smart-pharmacy.mp4',
    kind: 'video',
    label: 'AI概念画面',
    title: '机器人进入原有流程，药剂师仍然在场',
  },
  {
    id: 'pharmacy-evidence',
    start: 224.2,
    end: 231.5,
    src: 'evidence/waic2026-v6/smart-pharmacy-report-top-16x9.png',
    kind: 'image',
    label: '公开报道截图',
    title: '智慧药房的重点，是协助真实流程',
    fit: 'contain',
    evidence: true,
  },
  {
    id: 'v07',
    start: 273.25,
    end: 278.35,
    src: 'media/waic2026-v6/V07-human-validation-loop.mp4',
    kind: 'video',
    label: 'AI概念画面',
    title: '模型给候选，人回到现场确认',
  },
];

const BrollLayer: React.FC<{item: Broll}> = ({item}) => {
  const frame = useCurrentFrame();
  const duration = f(item.end - item.start);
  const opacity = sceneFade(frame, duration, item.evidence ? 8 : 10);
  const zoom = item.evidence
    ? 1
    : interpolate(frame, [0, duration], [1.01, 1.045], {
        ...clamp,
        easing: Easing.out(Easing.quad),
      });

  return (
    <AbsoluteFill style={{background: palette.graphite, opacity, overflow: 'hidden'}}>
      {item.kind === 'image' ? (
        <>
          <Img
            src={staticFile(item.src)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(30px) brightness(0.28) saturate(0.75)',
              transform: 'scale(1.12)',
            }}
          />
          <Img
            src={staticFile(item.src)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: item.fit ?? 'cover',
              transform: `scale(${zoom})`,
            }}
          />
        </>
      ) : (
        <Video
          src={staticFile(item.src)}
          muted
          volume={0}
          style={{
            width: '100%',
            height: '100%',
            objectFit: item.fit ?? 'cover',
            transform: `scale(${zoom})`,
            filter: 'contrast(1.035) saturate(1.025)',
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background: item.evidence
            ? 'linear-gradient(180deg, rgba(2,7,11,0.06), rgba(2,7,11,0.32))'
            : `linear-gradient(90deg, rgba(2,7,11,${item.dim ?? 0.62}) 0%, rgba(2,7,11,0.12) 68%, rgba(2,7,11,0.22) 100%)`,
        }}
      />
      {item.title ? (
        <div
          style={{
            position: 'absolute',
            left: 64,
            top: 112,
            maxWidth: item.evidence ? 770 : 900,
            color: palette.ink,
            fontFamily,
            textShadow: '0 4px 22px rgba(0,0,0,0.88)',
          }}
        >
          <div style={{width: 86, height: 5, background: item.evidence ? palette.cyan : palette.amber}} />
          <div style={{marginTop: 18, fontSize: item.evidence ? 42 : 51, lineHeight: 1.12, fontWeight: 950}}>
            {item.title}
          </div>
          {item.subtitle ? (
            <div
              style={{
                marginTop: 18,
                padding: '13px 17px',
                borderLeft: `6px solid ${palette.amber}`,
                background: 'rgba(4,10,15,0.78)',
                color: '#FFE0B8',
                fontSize: 27,
                lineHeight: 1.3,
                fontWeight: 900,
              }}
            >
              {item.subtitle}
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          right: 54,
          bottom: 154,
          padding: '7px 11px',
          background: 'rgba(0,0,0,0.64)',
          color: item.evidence ? palette.cyan : palette.mist,
          fontFamily,
          fontSize: 17,
          fontWeight: 850,
        }}
      >
        {item.label}
      </div>
    </AbsoluteFill>
  );
};

const Brolls: React.FC = () => (
  <AbsoluteFill>
    {brolls.map((item) => (
      <Sequence
        key={item.id}
        from={f(item.start)}
        durationInFrames={f(item.end - item.start)}
        premountFor={fps}
      >
        <BrollLayer item={item} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

const HookQuestion: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame, [0, 7, 34, 55], [0.35, 1, 0.82, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 76,
        bottom: 220,
        width: 820,
        color: palette.ink,
        fontFamily,
        textShadow: '0 5px 24px rgba(0,0,0,0.92)',
      }}
    >
      <div style={{fontSize: 20, color: palette.amber, fontWeight: 900}}>第一性问题</div>
      <div style={{marginTop: 11, fontSize: 67, lineHeight: 1.02, fontWeight: 950}}>它真的懂地球吗？</div>
      <div style={{marginTop: 18, width: `${pulse * 100}%`, maxWidth: 540, height: 6, background: palette.amber}} />
    </div>
  );
};

const FieldSignalStrip: React.FC = () => {
  const frame = useCurrentFrame();
  const signals = [
    {name: '设备声音', detail: '异响 / 振动', color: palette.amber},
    {name: '作物叶色', detail: '纹理 / 长势', color: palette.green},
    {name: '土壤天气', detail: '湿度 / 雨后变化', color: palette.steel},
    {name: '冷链曲线', detail: '连续温度变化', color: palette.cyan},
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 58,
        top: 120,
        width: 760,
        height: 620,
        overflow: 'hidden',
        background: 'rgba(5,13,19,0.91)',
        boxShadow: '0 24px 76px rgba(0,0,0,0.46)',
        borderTop: `7px solid ${palette.amber}`,
        color: palette.ink,
        fontFamily,
      }}
    >
      <Img
        src={staticFile('generated/waic2026-v6/field-signal-strip-base.png')}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.19}}
      />
      <div style={{position: 'relative', padding: '25px 27px'}}>
        <div style={{color: palette.amber, fontSize: 19, fontWeight: 900}}>FIELD SIGNALS · 现场信号采样带</div>
        <div style={{marginTop: 9, fontSize: 42, lineHeight: 1.1, fontWeight: 950}}>数据不只在表格里</div>
        <div style={{marginTop: 25, display: 'grid', gap: 10}}>
          {signals.map((signal, index) => {
            const p = spring({fps, frame: frame - 6 - index * 17, config: {damping: 20, stiffness: 175}});
            const wave = interpolate(frame, [0, 280], [0, 185], clamp);
            return (
              <div
                key={signal.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '150px 1fr 148px',
                  alignItems: 'center',
                  gap: 14,
                  height: 86,
                  padding: '0 16px',
                  background: 'rgba(255,255,255,0.055)',
                  borderLeft: `5px solid ${signal.color}`,
                  opacity: p,
                  transform: `translateX(${interpolate(p, [0, 1], [-24, 0])}px)`,
                }}
              >
                <div style={{fontSize: 23, fontWeight: 900}}>{signal.name}</div>
                <div style={{position: 'relative', height: 34, overflow: 'hidden'}}>
                  <div style={{position: 'absolute', left: -wave + index * 32, top: 15, width: 330, height: 3, background: signal.color, boxShadow: `0 0 12px ${signal.color}`}} />
                  {Array.from({length: 9}).map((_, tick) => (
                    <div
                      key={tick}
                      style={{
                        position: 'absolute',
                        left: tick * 38 - ((wave * (index + 1)) % 38),
                        top: 9 + ((tick * 7 + index * 5) % 13),
                        width: 5,
                        height: 5,
                        borderRadius: 99,
                        background: signal.color,
                      }}
                    />
                  ))}
                </div>
                <div style={{color: signal.color, fontSize: 17, fontWeight: 850, textAlign: 'right'}}>{signal.detail}</div>
              </div>
            );
          })}
        </div>
        <div style={{marginTop: 20, color: palette.mist, fontSize: 21, lineHeight: 1.45}}>
          先在现场发生，再被人识别、记录、解释。
        </div>
      </div>
    </div>
  );
};

const TextVsObservation: React.FC = () => {
  const frame = useCurrentFrame();
  const split = interpolate(frame, [8, 58], [48, 62], clamp);
  return (
    <AbsoluteFill style={{background: palette.graphite, color: palette.ink, fontFamily, overflow: 'hidden'}}>
      <Img
        src={staticFile('generated/waic2026-v6/text-vs-observation-base.png')}
        style={{width: '100%', height: '100%', objectFit: 'cover', opacity: 0.48, transform: 'scale(1.025)'}}
      />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(3,8,12,0.85), rgba(3,8,12,0.50), rgba(3,8,12,0.76))'}} />
      <div style={{position: 'absolute', left: 66, right: 66, top: 90}}>
        <div style={{color: palette.cyan, fontSize: 20, fontWeight: 900}}>TEXT vs OBSERVATION</div>
        <div style={{marginTop: 8, fontSize: 53, lineHeight: 1.1, fontWeight: 950}}>AI读过结论，还是见过现场？</div>
      </div>
      <div style={{position: 'absolute', left: 70, right: 70, top: 300, display: 'grid', gridTemplateColumns: '1fr 150px 1fr', gap: 28, alignItems: 'center'}}>
        <Enter style={{height: 430, padding: '28px', background: 'rgba(218,225,228,0.90)', color: '#172027'}}>
          <div style={{color: '#55656E', fontSize: 18, fontWeight: 900}}>文字结论</div>
          <div style={{marginTop: 18, fontSize: 38, fontWeight: 950}}>论文 · 网页 · 说明书</div>
          <div style={{marginTop: 30, display: 'grid', gap: 14}}>
            {[82, 94, 72, 88, 64].map((width, index) => <div key={index} style={{width: `${width}%`, height: 16, background: `rgba(34,50,59,${0.22 + index * 0.06})`}} />)}
          </div>
          <div style={{marginTop: 42, color: '#4E5D65', fontSize: 22, lineHeight: 1.5}}>擅长读取别人写下来的结论</div>
        </Enter>
        <div style={{textAlign: 'center'}}>
          <div style={{margin: '0 auto', width: split, height: split, borderRadius: 99, border: `3px solid ${palette.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.amber, fontSize: 30, fontWeight: 950}}>？</div>
        </div>
        <Enter delay={10} style={{height: 430, padding: '28px', background: 'rgba(7,22,30,0.90)', outline: `1px solid ${palette.amber}66`}}>
          <div style={{color: palette.amber, fontSize: 18, fontWeight: 900}}>现场观测</div>
          <div style={{marginTop: 18, fontSize: 38, fontWeight: 950}}>震动 · 红外 · 声音 · 曲线</div>
          <div style={{marginTop: 33, height: 105, position: 'relative', overflow: 'hidden'}}>
            <div style={{position: 'absolute', left: -120 + frame * 3, top: 52, width: 680, height: 3, background: palette.amber}} />
            {Array.from({length: 13}).map((_, index) => <div key={index} style={{position: 'absolute', left: index * 46, top: 34 + ((index * 17) % 45), width: 7, height: 7, borderRadius: 99, background: index % 3 === 0 ? palette.amber : palette.cyan}} />)}
          </div>
          <div style={{marginTop: 30, color: palette.mist, fontSize: 22, lineHeight: 1.5}}>要直接处理现场留下来的物理信号</div>
        </Enter>
      </div>
    </AbsoluteFill>
  );
};

const HumanValidationLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const nodes = [
    {label: '记录现场', detail: '声音 / 图像 / 曲线', tone: palette.steel},
    {label: '行业人员标注', detail: '正常 / 异常', tone: palette.cyan},
    {label: '模型寻找候选', detail: '不是自动结论', tone: palette.green},
    {label: '回到现场复核', detail: '决定能不能用', tone: palette.amber},
  ];
  return (
    <div style={{position: 'absolute', left: 58, top: 130, width: 760, padding: '25px 27px 28px', background: 'rgba(5,13,19,0.92)', borderTop: `7px solid ${palette.cyan}`, color: palette.ink, fontFamily, boxShadow: '0 26px 78px rgba(0,0,0,0.45)'}}>
      <div style={{color: palette.cyan, fontSize: 19, fontWeight: 900}}>HUMAN VALIDATION LOOP</div>
      <div style={{marginTop: 9, fontSize: 42, lineHeight: 1.1, fontWeight: 950}}>模型找候选，人负责确认</div>
      <div style={{marginTop: 25, display: 'grid', gap: 9}}>
        {nodes.map((node, index) => {
          const p = spring({fps, frame: frame - index * 18, config: {damping: 19, stiffness: 175}});
          return (
            <div key={node.label} style={{position: 'relative', display: 'grid', gridTemplateColumns: '56px 1fr 190px', alignItems: 'center', height: 78, padding: '0 16px', background: index === 3 ? 'rgba(244,170,85,0.12)' : 'rgba(255,255,255,0.05)', borderLeft: `5px solid ${node.tone}`, opacity: p, transform: `translateX(${interpolate(p, [0, 1], [-26, 0])}px)`}}>
              <div style={{color: node.tone, fontSize: 19, fontWeight: 950}}>0{index + 1}</div>
              <div style={{fontSize: 24, fontWeight: 950}}>{node.label}</div>
              <div style={{color: node.tone, fontSize: 17, fontWeight: 850, textAlign: 'right'}}>{node.detail}</div>
              {index < nodes.length - 1 ? <div style={{position: 'absolute', left: 42, bottom: -12, width: 3, height: 12, background: node.tone}} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ThreeQuestionsLens: React.FC = () => {
  const frame = useCurrentFrame();
  const questions = ['看什么？', '什么算异常？', '结果能不能用？'];
  return (
    <div style={{position: 'absolute', left: 58, top: 155, width: 750, padding: '26px 28px 31px', background: 'rgba(5,13,19,0.92)', borderTop: `7px solid ${palette.amber}`, color: palette.ink, fontFamily, boxShadow: '0 26px 78px rgba(0,0,0,0.45)'}}>
      <div style={{color: palette.amber, fontSize: 19, fontWeight: 900}}>真正干过这一行的人，决定三件事</div>
      <div style={{marginTop: 24, display: 'grid', gap: 13}}>
        {questions.map((question, index) => {
          const p = spring({fps, frame: frame - 5 - index * 24, config: {damping: 18, stiffness: 180}});
          return (
            <div key={question} style={{display: 'grid', gridTemplateColumns: '54px 1fr', alignItems: 'center', height: 96, padding: '0 18px', background: index === 2 ? 'rgba(244,170,85,0.14)' : 'rgba(255,255,255,0.055)', opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.92, 1])})`}}>
              <div style={{color: palette.amber, fontSize: 18, fontWeight: 950}}>0{index + 1}</div>
              <div style={{fontSize: 39, fontWeight: 950}}>{question}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [5, 44], [0, 1], clamp);
  return (
    <AbsoluteFill style={{background: palette.graphite, color: palette.ink, fontFamily, overflow: 'hidden'}}>
      <Img src={staticFile('generated/waic2026-v6/human-validation-loop-base.png')} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: 0.58, transform: `scale(${1.02 + reveal * 0.035})`}} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(3,8,12,0.88), rgba(3,8,12,0.52), rgba(3,8,12,0.28))'}} />
      <div style={{position: 'absolute', left: 72, top: 175, width: 980}}>
        <div style={{color: palette.amber, fontSize: 21, fontWeight: 900}}>从WAIC 2026带回来的一个判断</div>
        <div style={{marginTop: 18, fontSize: 68, lineHeight: 1.08, fontWeight: 950}}>AI进入各个行业<br />最后都要回到现场</div>
        <div style={{marginTop: 35, display: 'flex', gap: 12, flexWrap: 'wrap'}}>
          {['模型提供能力', '行业人员定义异常', '人判断结果能不能用'].map((item, index) => <div key={item} style={{padding: '14px 17px', background: index === 2 ? 'rgba(244,170,85,0.16)' : 'rgba(255,255,255,0.075)', color: index === 2 ? '#FFD8A4' : palette.mist, fontSize: 22, fontWeight: 900}}>{item}</div>)}
        </div>
      </div>
      <div style={{position: 'absolute', left: 72, bottom: 164, color: palette.mist, fontSize: 24, fontWeight: 850}}>关注我 · 我是超哥 · 在兰州记录AI创业</div>
      <div style={{position: 'absolute', right: 54, bottom: 154, padding: '7px 11px', background: 'rgba(0,0,0,0.64)', color: palette.mist, fontSize: 17, fontWeight: 850}}>AI概念画面</div>
    </AbsoluteFill>
  );
};

const Cards: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={f(6.0)} durationInFrames={f(3.25)}><HookQuestion /></Sequence>
    <Sequence from={f(56.35)} durationInFrames={f(15.1)} premountFor={15}><FieldSignalStrip /></Sequence>
    <Sequence from={f(106.35)} durationInFrames={f(15.2)} premountFor={fps}><TextVsObservation /></Sequence>
    <Sequence from={f(203.65)} durationInFrames={f(12.1)} premountFor={15}><HumanValidationLoop /></Sequence>
    <Sequence from={f(278.55)} durationInFrames={f(11.5)} premountFor={15}><ThreeQuestionsLens /></Sequence>
    <Sequence from={f(341.65)} durationInFrames={WAIC_V6_DURATION_IN_FRAMES - f(341.65)} premountFor={fps}><ClosingScene /></Sequence>
  </AbsoluteFill>
);

type CaptionPage = {startMs: number; endMs: number; zh: string; highlights?: string[]};

const splitHighlights = (text: string, highlights: string[]) => {
  const sorted = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);
  const parts: Array<{text: string; active: boolean}> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const hit = sorted.find((item) => text.startsWith(item, cursor));
    if (hit) {
      parts.push({text: hit, active: true});
      cursor += hit.length;
      continue;
    }
    const next = sorted.map((item) => text.indexOf(item, cursor + 1)).filter((at) => at >= 0).sort((a, b) => a - b)[0] ?? text.length;
    parts.push({text: text.slice(cursor, next), active: false});
    cursor = next;
  }
  return parts;
};

const ChineseCaptions: React.FC = () => {
  const [pages, setPages] = useState<CaptionPage[] | null>(null);
  const [handle] = useState(() => delayRender('加载WAIC V6中文字幕'));
  const load = useCallback(async () => {
    try {
      const response = await fetch(staticFile('data/WAIC_20260718_talk01_16x9.zh.v1.json'));
      setPages((await response.json()) as CaptionPage[]);
      continueRender(handle);
    } catch (error) {
      cancelRender(error as Error);
    }
  }, [handle]);
  useEffect(() => void load(), [load]);
  const frame = useCurrentFrame();
  const now = (frame / fps) * 1000;
  const current = pages?.find((page) => now >= page.startMs && now < page.endMs);
  if (!current) return null;
  const fade = Math.min(
    interpolate(now, [current.startMs, current.startMs + 70], [0, 1], clamp),
    interpolate(now, [current.endMs - 70, current.endMs], [1, 0], clamp),
  );
  const parts = splitHighlights(current.zh, current.highlights ?? []);
  const fontSize = current.zh.length > 25 ? 34 : current.zh.length > 20 ? 37 : 40;
  return (
    <div style={{position: 'absolute', left: '50%', bottom: 40, width: 1460, minHeight: 86, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 28px', boxSizing: 'border-box', background: 'rgba(0,0,0,0.68)', borderRadius: 13, boxShadow: '0 18px 50px rgba(0,0,0,0.48)', color: palette.ink, fontFamily, fontSize, lineHeight: 1.18, fontWeight: 950, textAlign: 'center', opacity: fade, textShadow: '0 3px 10px rgba(0,0,0,0.96)', WebkitTextStroke: '0.8px rgba(0,0,0,0.75)', zIndex: 120}}>
      <div>
        {parts.map((part, index) => <span key={`${part.text}-${index}`} style={{color: part.active ? '#FFD08A' : palette.ink}}>{part.text}</span>)}
      </div>
    </div>
  );
};

const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = (frame / Math.max(1, WAIC_V6_DURATION_IN_FRAMES - 1)) * 100;
  return (
    <>
      <div style={{position: 'absolute', left: 52, right: 52, top: 28, height: 48, display: 'flex', alignItems: 'center', color: palette.ink, fontFamily, textShadow: '0 3px 14px rgba(0,0,0,0.88)', zIndex: 110}}>
        <div style={{width: 10, height: 10, borderRadius: 99, background: palette.amber, boxShadow: `0 0 16px ${palette.amber}`}} />
        <div style={{marginLeft: 12, fontSize: 20, fontWeight: 950}}>超哥AI创业记</div>
        <div style={{marginLeft: 23, color: palette.cyan, fontSize: 19, fontWeight: 900}}>WAIC 2026 · 现场数据</div>
        <div style={{marginLeft: 'auto', padding: '7px 11px', background: 'rgba(0,0,0,0.48)', color: palette.mist, fontSize: 16, fontWeight: 800}}>V6 现场数据纪录片</div>
      </div>
      <div style={{position: 'absolute', left: 52, right: 52, bottom: 22, height: 4, background: 'rgba(255,255,255,0.16)', zIndex: 130}}>
        <div style={{height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${palette.steel}, ${palette.cyan}, ${palette.amber})`, boxShadow: `0 0 12px ${palette.cyan}`}} />
      </div>
    </>
  );
};

const SoundDesign: React.FC = () => {
  const cues = [
    {time: 6.04, file: 'thesis-impact.wav', volume: 3.0},
    {time: 19.9, file: 'section-whoosh.wav', volume: 0.20},
    {time: 56.35, file: 'card-pop.wav', volume: 1.60},
    {time: 65.6, file: 'node-connect.wav', volume: 0.30},
    {time: 76.55, file: 'node-connect.wav', volume: 0.30},
    {time: 81.95, file: 'section-whoosh.wav', volume: 0.20},
    {time: 85.25, file: 'thesis-impact.wav', volume: 2.70},
    {time: 278.55, file: 'card-pop.wav', volume: 1.55},
    {time: 341.72, file: 'thesis-impact.wav', volume: 2.90},
  ];
  return (
    <>
      {cues.map((cue, index) => (
        <Sequence key={`${cue.time}-${cue.file}-${index}`} from={f(cue.time)} durationInFrames={f(3)} premountFor={10}>
          <Audio src={staticFile(`audio/waic2026-v6/${cue.file}`)} volume={cue.volume} />
        </Sequence>
      ))}
    </>
  );
};

export const WAICV6Talk16x9: React.FC = () => (
  <AbsoluteFill style={{background: palette.graphite, overflow: 'hidden'}}>
    <LocalFont />
    <EditedFootage />
    <Brolls />
    <Cards />
    <Sequence from={4609} durationInFrames={30} premountFor={5}>
      <Audio src={staticFile('audio/waic2026-v6/correction-not-equal.wav')} volume={1} />
    </Sequence>
    <SoundDesign />
    <Hud />
    <StableBilingualCaptionOverlay captionsSrc="data/WAIC_20260718_talk01_16x9.bilingual.v1.json" />
  </AbsoluteFill>
);

const previewSlices = [
  {sourceStart: 3.0, duration: 4.0},
  {sourceStart: 56.2, duration: 11.0},
  {sourceStart: 79.5, duration: 6.5},
  {sourceStart: 278.5, duration: 4.0},
  {sourceStart: 341.6, duration: 4.5},
];

export const WAICV6Preview16x9: React.FC = () => {
  let outputFrame = 0;
  return (
    <AbsoluteFill style={{background: palette.graphite}}>
      {previewSlices.map((slice, index) => {
        const from = outputFrame;
        const duration = f(slice.duration);
        outputFrame += duration;
        return (
          <Sequence key={`${slice.sourceStart}-${index}`} from={from} durationInFrames={duration}>
            <Sequence from={-f(slice.sourceStart)}>
              <WAICV6Talk16x9 />
            </Sequence>
          </Sequence>
        );
      })}
      <div style={{position: 'absolute', right: 54, top: 88, padding: '7px 12px', background: 'rgba(0,0,0,0.66)', color: palette.amber, fontFamily, fontSize: 17, fontWeight: 900, zIndex: 200}}>
        V6样式试听预览 · 5段关键节点拼接
      </div>
    </AbsoluteFill>
  );
};
