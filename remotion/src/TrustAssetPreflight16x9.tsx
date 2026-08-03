import {Audio} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {LocalFont} from './components/LocalFont';

const fps = 30;
export const TRUST_ASSET_PREFLIGHT_DURATION_IN_FRAMES = 30 * fps;

const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const palette = {
  bg: '#070A0E',
  panel: 'rgba(12, 18, 25, 0.82)',
  line: 'rgba(255, 255, 255, 0.16)',
  text: '#F7F9FB',
  muted: '#A9B3BE',
  cyan: '#57D5FF',
  amber: '#FFBE55',
  green: '#66E39A',
  red: '#FF6978',
};

const enterStyle = (frame: number, delay = 0): React.CSSProperties => {
  const progress = spring({
    frame: frame - delay,
    fps,
    config: {damping: 18, stiffness: 130, mass: 0.85},
  });
  return {
    opacity: interpolate(progress, [0, 1], [0, 1], clamp),
    transform: `translate3d(0, ${interpolate(progress, [0, 1], [28, 0], clamp)}px, 0)`,
  };
};

const SceneHeader: React.FC<{
  index: string;
  eyebrow: string;
  title: string;
  demo?: boolean;
}> = ({index, eyebrow, title, demo = false}) => (
  <div style={{position: 'absolute', left: 72, top: 70, zIndex: 20}}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        color: palette.cyan,
        fontSize: 21,
        fontWeight: 900,
        letterSpacing: 0,
      }}
    >
      <span>{index}</span>
      <span style={{width: 44, height: 3, background: palette.cyan}} />
      <span>{eyebrow}</span>
      {demo ? (
        <span
          style={{
            marginLeft: 8,
            padding: '5px 10px',
            border: `1px solid ${palette.amber}`,
            color: palette.amber,
            fontSize: 17,
            fontWeight: 850,
          }}
        >
          情景演示
        </span>
      ) : null}
    </div>
    <div
      style={{
        marginTop: 12,
        color: palette.text,
        fontSize: 50,
        lineHeight: 1.13,
        fontWeight: 950,
        letterSpacing: 0,
      }}
    >
      {title}
    </div>
  </div>
);

const BrandHud: React.FC = () => (
  <>
    <div
      style={{
        position: 'absolute',
        left: 56,
        top: 26,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        color: palette.text,
        fontSize: 19,
        fontWeight: 900,
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          background: palette.cyan,
          boxShadow: `0 0 16px ${palette.cyan}`,
        }}
      />
      超哥AI创业记
    </div>
    <div
      style={{
        position: 'absolute',
        left: 56,
        right: 56,
        bottom: 22,
        height: 3,
        background: 'rgba(255,255,255,0.12)',
        zIndex: 100,
      }}
    />
  </>
);

const OutputCard: React.FC<{
  label: string;
  detail: string;
  color: string;
  frame: number;
  delay: number;
}> = ({label, detail, color, frame, delay}) => (
  <div
    style={{
      ...enterStyle(frame, delay),
      width: 250,
      height: 132,
      padding: '22px 24px',
      boxSizing: 'border-box',
      background: palette.panel,
      border: `1px solid ${color}`,
      borderRadius: 8,
      boxShadow: '0 18px 42px rgba(0,0,0,0.28)',
    }}
  >
    <div style={{fontSize: 17, color, fontWeight: 900}}>{label}</div>
    <div
      style={{
        marginTop: 13,
        fontSize: 27,
        color: palette.text,
        fontWeight: 900,
      }}
    >
      {detail}
    </div>
  </div>
);

const StoreScene: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.55 + 0.45 * Math.sin(frame / 8);

  return (
    <AbsoluteFill style={{background: palette.bg}}>
      <SceneHeader
        index="01"
        eyebrow="CREATE IS NOT DISTRIBUTE · 做出来不等于被看见"
        title="AI把内容做快了，顾客反应没有自动出现"
        demo
      />
      <div
        style={{
          position: 'absolute',
          left: 78,
          right: 78,
          top: 250,
          bottom: 92,
          display: 'grid',
          gridTemplateColumns: '380px 1fr 440px',
          gap: 38,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            ...enterStyle(frame, 0),
            height: 470,
            position: 'relative',
            background: 'rgba(18,24,31,0.72)',
            border: `1px solid ${palette.line}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: 70,
              background: palette.amber,
              color: '#15100A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 950,
            }}
          >
            本地实体店
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              height: 56,
              borderBottom: `1px solid ${palette.line}`,
            }}
          >
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                style={{
                  background: item % 2 === 0 ? '#E7E9EC' : '#2B3037',
                  borderRight: `1px solid ${palette.line}`,
                }}
              />
            ))}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 84,
              bottom: 42,
              width: 212,
              height: 232,
              border: `2px solid ${palette.line}`,
              background: '#0D131A',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 72,
                top: 35,
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#C7D0D9',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 46,
                bottom: 38,
                width: 116,
                height: 88,
                background: '#65717D',
                borderRadius: '52px 52px 8px 8px',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 30,
                right: 30,
                bottom: 18,
                height: 11,
                background: palette.cyan,
                opacity: 0.8,
              }}
            />
          </div>
        </div>

        <div
          style={{
            height: 470,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: -28,
              right: -28,
              top: '50%',
              height: 2,
              background: palette.cyan,
              opacity: 0.35 + pulse * 0.35,
            }}
          />
          <OutputCard
            label="AI OUTPUT 01"
            detail="海报批量生成"
            color={palette.cyan}
            frame={frame}
            delay={5}
          />
          <OutputCard
            label="AI OUTPUT 02"
            detail="文案快速完成"
            color={palette.green}
            frame={frame}
            delay={11}
          />
          <OutputCard
            label="AI OUTPUT 03"
            detail="内容已经发布"
            color={palette.amber}
            frame={frame}
            delay={17}
          />
        </div>

        <div
          style={{
            ...enterStyle(frame, 23),
            height: 470,
            padding: 30,
            boxSizing: 'border-box',
            background: palette.panel,
            border: `1px solid ${palette.red}`,
            borderRadius: 8,
          }}
        >
          <div style={{fontSize: 18, color: palette.red, fontWeight: 900}}>
            REAL RESPONSE · 真实反馈
          </div>
          {[
            ['浏览', '很少'],
            ['咨询', '暂无'],
            ['到店', '未确认'],
          ].map(([label, value], index) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 30,
                paddingBottom: 18,
                borderBottom: `1px solid ${palette.line}`,
              }}
            >
              <span style={{fontSize: 23, color: palette.muted}}>{label}</span>
              <span
                style={{
                  fontSize: 31,
                  color: index === 0 ? palette.amber : palette.red,
                  fontWeight: 950,
                }}
              >
                {value}
              </span>
            </div>
          ))}
          <div
            style={{
              marginTop: 35,
              padding: '18px 20px',
              background: 'rgba(255,105,120,0.12)',
              color: palette.text,
              fontSize: 28,
              fontWeight: 950,
              textAlign: 'center',
            }}
          >
            做出来 ≠ 被看见
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OpcScene: React.FC = () => {
  const frame = useCurrentFrame();
  const scan = interpolate(frame % 90, [0, 89], [0, 100], clamp);
  return (
    <AbsoluteFill style={{background: '#080B10'}}>
      <SceneHeader
        index="02"
        eyebrow="DEMO IS NOT ADOPTION · 能运行不等于有人用"
        title="产品演示很顺，真实采用仍然很少"
        demo
      />
      <div
        style={{
          position: 'absolute',
          left: 92,
          right: 92,
          top: 250,
          bottom: 90,
          display: 'grid',
          gridTemplateColumns: '310px 1fr 420px',
          gap: 36,
          alignItems: 'center',
        }}
      >
        <div style={{...enterStyle(frame, 0), textAlign: 'center'}}>
          <div
            style={{
              width: 170,
              height: 170,
              margin: '0 auto',
              borderRadius: '50%',
              background: '#2E3A45',
              border: `2px solid ${palette.cyan}`,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 55,
                top: 30,
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: '#D6DCE2',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 37,
                bottom: 24,
                width: 96,
                height: 54,
                borderRadius: '44px 44px 8px 8px',
                background: '#8995A0',
              }}
            />
          </div>
          <div
            style={{
              marginTop: 26,
              color: palette.text,
              fontSize: 32,
              fontWeight: 950,
            }}
          >
            OPC 创作者
          </div>
          <div style={{marginTop: 10, color: palette.muted, fontSize: 20}}>
            小程序 · 行业智能体
          </div>
        </div>

        <div
          style={{
            ...enterStyle(frame, 8),
            height: 492,
            padding: 24,
            boxSizing: 'border-box',
            background: '#111821',
            border: `1px solid ${palette.cyan}`,
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 18,
              borderBottom: `1px solid ${palette.line}`,
            }}
          >
            <span style={{fontSize: 21, color: palette.text, fontWeight: 900}}>
              产品演示窗口
            </span>
            <span style={{fontSize: 18, color: palette.green, fontWeight: 900}}>
              运行正常
            </span>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              top: 96,
              height: 2,
              background: palette.cyan,
              transform: `translateY(${scan * 3.5}px)`,
              opacity: 0.45,
            }}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 18,
              marginTop: 26,
            }}
          >
            {[
              ['需求输入', '已完成'],
              ['自动生成', '已完成'],
              ['流程运行', '流畅'],
              ['真实用户', '待验证'],
            ].map(([label, value], index) => (
              <div
                key={label}
                style={{
                  height: 142,
                  padding: 22,
                  boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.045)',
                  border: `1px solid ${index === 3 ? palette.amber : palette.line}`,
                  borderRadius: 6,
                }}
              >
                <div style={{fontSize: 18, color: palette.muted}}>{label}</div>
                <div
                  style={{
                    marginTop: 22,
                    color: index === 3 ? palette.amber : palette.green,
                    fontSize: 30,
                    fontWeight: 950,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            ...enterStyle(frame, 17),
            height: 492,
            padding: 28,
            boxSizing: 'border-box',
            background: palette.panel,
            border: `1px solid ${palette.red}`,
            borderRadius: 8,
          }}
        >
          <div style={{fontSize: 18, color: palette.red, fontWeight: 900}}>
            REAL ADOPTION · 真实采用
          </div>
          <div
            style={{
              marginTop: 26,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <span style={{fontSize: 26, color: palette.muted}}>持续使用</span>
            <span style={{fontSize: 52, color: palette.red, fontWeight: 950}}>
              很少
            </span>
          </div>
          <div
            style={{
              marginTop: 25,
              padding: 18,
              border: `1px solid ${palette.line}`,
              background: 'rgba(255,255,255,0.035)',
            }}
          >
            <div style={{fontSize: 17, color: palette.amber, fontWeight: 900}}>
              同类功能
            </div>
            <div
              style={{
                marginTop: 15,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  style={{
                    height: 72,
                    border: `1px solid ${palette.amber}`,
                    background: 'rgba(255,190,85,0.08)',
                  }}
                />
              ))}
            </div>
            <div
              style={{
                marginTop: 13,
                color: palette.muted,
                fontSize: 18,
                textAlign: 'right',
              }}
            >
              快速出现
            </div>
          </div>
          <div
            style={{
              marginTop: 28,
              color: palette.text,
              fontSize: 29,
              fontWeight: 950,
              textAlign: 'center',
            }}
          >
            能运行 ≠ 愿意用
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const GatesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const gates = [
    {index: '01', title: '做出来', note: 'AI降低创造成本', color: palette.cyan},
    {index: '02', title: '被看见', note: '还要经过分发筛选', color: palette.amber},
    {index: '03', title: '愿意使用', note: '必须命中真实痛点', color: palette.green},
  ];
  return (
    <AbsoluteFill style={{background: '#090C11'}}>
      <SceneHeader
        index="03"
        eyebrow="THREE DIFFERENT GATES · 三个不同的大门"
        title="创造、分发和采用，不能混成一件事"
      />
      <div
        style={{
          position: 'absolute',
          left: 104,
          right: 104,
          top: 320,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 32,
        }}
      >
        {gates.map((gate, index) => {
          const style = enterStyle(frame, index * 8);
          return (
            <div
              key={gate.index}
              style={{
                ...style,
                height: 390,
                padding: 34,
                boxSizing: 'border-box',
                background: palette.panel,
                border: `1px solid ${gate.color}`,
                borderRadius: 8,
                position: 'relative',
              }}
            >
              <div style={{fontSize: 18, color: gate.color, fontWeight: 900}}>
                GATE {gate.index}
              </div>
              <div
                style={{
                  marginTop: 80,
                  color: palette.text,
                  fontSize: 54,
                  fontWeight: 950,
                }}
              >
                {gate.title}
              </div>
              <div
                style={{
                  marginTop: 26,
                  color: palette.muted,
                  fontSize: 25,
                  lineHeight: 1.45,
                }}
              >
                {gate.note}
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 34,
                  right: 34,
                  bottom: 34,
                  height: 8,
                  background: gate.color,
                  opacity: 0.78,
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const TimelineScene: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = [
    {label: '真实需求', color: palette.cyan},
    {label: '行动尝试', color: palette.green},
    {label: '失败调整', color: palette.red},
    {label: '现场验收', color: palette.amber},
    {label: '继续迭代', color: palette.cyan},
  ];
  const lineProgress = interpolate(frame, [4, 50], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{background: '#070A0E'}}>
      <SceneHeader
        index="04"
        eyebrow="BUILD IN PUBLIC · 公开真实过程"
        title="信任来自一条可核验的时间线"
      />
      <div
        style={{
          position: 'absolute',
          left: 108,
          right: 108,
          top: 420,
          height: 8,
          background: 'rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            width: `${lineProgress * 100}%`,
            height: '100%',
            background: palette.cyan,
            boxShadow: `0 0 22px ${palette.cyan}`,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 82,
          right: 82,
          top: 353,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 18,
        }}
      >
        {steps.map((step, index) => {
          const progress = spring({
            frame: frame - 5 - index * 8,
            fps,
            config: {damping: 17, stiffness: 145},
          });
          return (
            <div
              key={step.label}
              style={{
                opacity: progress,
                transform: `translate3d(0, ${interpolate(progress, [0, 1], [36, 0], clamp)}px, 0)`,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 92,
                  height: 92,
                  margin: '0 auto',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#111821',
                  border: `3px solid ${step.color}`,
                  color: step.color,
                  fontSize: 24,
                  fontWeight: 950,
                  boxShadow: `0 0 24px ${step.color}55`,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </div>
              <div
                style={{
                  marginTop: 42,
                  padding: '22px 10px',
                  background: palette.panel,
                  border: `1px solid ${step.color}`,
                  borderRadius: 8,
                  color: palette.text,
                  fontSize: 29,
                  fontWeight: 950,
                }}
              >
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          ...enterStyle(frame, 48),
          position: 'absolute',
          left: 300,
          right: 300,
          bottom: 210,
          padding: '23px 30px',
          background: 'rgba(87,213,255,0.09)',
          border: `1px solid ${palette.cyan}`,
          color: palette.text,
          fontSize: 30,
          fontWeight: 900,
          textAlign: 'center',
        }}
      >
        不是展示一个完美人设，而是持续留下可以检查的证据
      </div>
    </AbsoluteFill>
  );
};

const SceneAudio: React.FC = () => (
  <>
    <Sequence from={4}>
      <Audio
        src={staticFile('audio/koubo-sfx-v2/section-sweep.wav')}
        volume={0.13}
      />
    </Sequence>
    <Sequence from={8 * fps}>
      <Audio
        src={staticFile('audio/koubo-sfx-v2/card-slide.wav')}
        volume={0.14}
      />
    </Sequence>
    <Sequence from={16 * fps}>
      <Audio
        src={staticFile('audio/koubo-sfx-v2/node-select.wav')}
        volume={0.09}
      />
    </Sequence>
    <Sequence from={23 * fps}>
      <Audio
        src={staticFile('audio/koubo-sfx-v2/evidence-shutter.wav')}
        volume={0.12}
      />
    </Sequence>
  </>
);

export const TrustAssetPreflight16x9: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: currentFps} = useVideoConfig();
  const progress = frame / Math.max(1, TRUST_ASSET_PREFLIGHT_DURATION_IN_FRAMES - 1);

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: palette.bg,
        color: palette.text,
        fontFamily,
      }}
    >
      <LocalFont />
      <Sequence durationInFrames={8 * currentFps}>
        <StoreScene />
      </Sequence>
      <Sequence from={8 * currentFps} durationInFrames={8 * currentFps}>
        <OpcScene />
      </Sequence>
      <Sequence from={16 * currentFps} durationInFrames={7 * currentFps}>
        <GatesScene />
      </Sequence>
      <Sequence from={23 * currentFps} durationInFrames={7 * currentFps}>
        <TimelineScene />
      </Sequence>
      <SceneAudio />
      <BrandHud />
      <div
        style={{
          position: 'absolute',
          left: 56,
          bottom: 22,
          width: `${progress * (1920 - 112)}px`,
          height: 3,
          background: palette.amber,
          zIndex: 110,
        }}
      />
    </AbsoluteFill>
  );
};

const StandaloneAsset: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill
    style={{
      overflow: 'hidden',
      background: palette.bg,
      color: palette.text,
      fontFamily,
    }}
  >
    <LocalFont />
    {children}
  </AbsoluteFill>
);

export const TrustStoreScenarioAsset16x9: React.FC = () => (
  <StandaloneAsset>
    <StoreScene />
  </StandaloneAsset>
);

export const TrustOpcScenarioAsset16x9: React.FC = () => (
  <StandaloneAsset>
    <OpcScene />
  </StandaloneAsset>
);

export const TrustThreeGatesAsset16x9: React.FC = () => (
  <StandaloneAsset>
    <GatesScene />
  </StandaloneAsset>
);

export const TrustTimelineAsset16x9: React.FC = () => (
  <StandaloneAsset>
    <TimelineScene />
  </StandaloneAsset>
);
