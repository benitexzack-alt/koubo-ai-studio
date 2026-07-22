import {Audio, Video} from '@remotion/media';
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
import {StableBilingualCaptionOverlay} from './components/StableBilingualCaptionOverlay';
import {
  V7HeroMetric,
  V7LocalContrastVeil,
  V7TransparentInfoStack,
} from './components/V7InformationStage';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

const colors = {
  ink: '#F7FAFC',
  cyan: '#62D8FF',
  amber: '#FFBE55',
  green: '#67D8A0',
  red: '#FF6B64',
  dark: '#04080D',
};

export const TWO_LEDGER_DURATION_IN_FRAMES = f(291.5);

const useSceneOpacity = (fadeFrames = 10) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return Math.min(
    interpolate(frame, [0, fadeFrames], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(fadeFrames, durationInFrames - fadeFrames), durationInFrames],
      [1, 0],
      clamp,
    ),
  );
};

const TalkFootage: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const keyframes = [0, 13, 31, 50, 67, 87, 100, 122, 140, 154, 174, 206, 216, 237, 254, 277, 291.5];
  const scale = interpolate(
    seconds,
    keyframes,
    [1.025, 1.052, 1.033, 1.055, 1.034, 1.054, 1.036, 1.058, 1.033, 1.052, 1.035, 1.056, 1.034, 1.053, 1.035, 1.058, 1.04],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const x = interpolate(
    seconds,
    keyframes,
    [-3, 6, -1, 7, -2, 6, 0, 7, -2, 6, -1, 7, -2, 6, -1, 8, 0],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: colors.dark}}>
      <Video
        src={staticFile('media/two-ledgers-20260722/main-30fps.mp4')}
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(1.035) saturate(1.025) brightness(1.01)',
          transform: `translate3d(${x}px, ${Math.sin(seconds * 0.24) * 1.4}px, 0) scale(${scale})`,
          transformOrigin: '61% 42%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.18) 0%, rgba(2,7,12,0.03) 52%, rgba(2,7,12,0.04) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const MetricBoundary: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const metricIn = spring({fps: localFps, frame: frame - 3, config: {damping: 20, stiffness: 175}});
  const itemIn = (delay: number) =>
    spring({fps: localFps, frame: frame - delay, config: {damping: 21, stiffness: 175}});

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 150,
        width: 730,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 25px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.64} width={860} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 900}}>FACT BOUNDARY · 数字能说明什么</div>
        <div
          style={{
            marginTop: 12,
            color: colors.amber,
            fontSize: 104,
            lineHeight: 1,
            fontWeight: 950,
            opacity: metricIn,
            transform: `translateY(${interpolate(metricIn, [0, 1], [24, 0])}px)`,
          }}
        >
          150
          <span style={{marginLeft: 12, color: colors.ink, fontSize: 34}}>个粉丝</span>
        </div>
        <div style={{marginTop: 25, display: 'grid', gap: 18}}>
          {[
            ['=', '还没有拿到流量结果', colors.cyan],
            ['≠', '方向一定错', colors.red],
            ['≠', '方向一定对', colors.red],
          ].map(([sign, label, tone], index) => {
            const progress = itemIn(14 + index * 12);
            return (
              <div
                key={String(label)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '54px 1fr',
                  gap: 13,
                  alignItems: 'center',
                  opacity: progress,
                  transform: `translateX(${interpolate(progress, [0, 1], [-18, 0])}px)`,
                }}
              >
                <div style={{color: String(tone), fontSize: 42, fontWeight: 950}}>{sign}</div>
                <div style={{borderLeft: `3px solid ${tone}`, paddingLeft: 15, fontSize: 30, fontWeight: 950}}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TwoLedgerStage: React.FC<{active: 'result' | 'asset'}> = ({active}) => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const titleIn = spring({fps: localFps, frame: frame - 2, config: {damping: 20, stiffness: 180}});
  const ledgers = [
    {
      id: 'result',
      number: '01',
      title: '结果账',
      en: 'RESULTS LEDGER',
      items: ['观看与收藏', '真实咨询', '试用与验收', '有人付费'],
      tone: colors.cyan,
    },
    {
      id: 'asset',
      number: '02',
      title: '资产账',
      en: 'ASSET LEDGER',
      items: ['真实问题', '自己的判断', '行动与失败', '下次还能用'],
      tone: colors.amber,
    },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 122,
        width: 790,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 24px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.62} width={890} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 900}}>TWO LEDGERS · 每次行动都要留下证据</div>
        <div style={{marginTop: 10, fontSize: 48, lineHeight: 1.08, fontWeight: 950, opacity: titleIn}}>给自己留两本账</div>
        <div style={{marginTop: 25, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18}}>
          {ledgers.map((ledger, ledgerIndex) => {
            const isActive = active === ledger.id;
            const panelIn = spring({
              fps: localFps,
              frame: frame - 9 - ledgerIndex * 7,
              config: {damping: 21, stiffness: 175},
            });
            return (
              <div
                key={ledger.id}
                style={{
                  minHeight: 465,
                  padding: '20px 21px 22px',
                  boxSizing: 'border-box',
                  border: `1px solid ${ledger.tone}${isActive ? 'CC' : '55'}`,
                  background: isActive ? `${ledger.tone}16` : 'rgba(2,7,12,0.28)',
                  boxShadow: isActive ? `0 0 34px ${ledger.tone}22` : 'none',
                  opacity: panelIn,
                  transform: `translateY(${interpolate(panelIn, [0, 1], [18, 0])}px)`,
                }}
              >
                <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
                  <div style={{color: ledger.tone, fontSize: 18, fontWeight: 950}}>{ledger.number}</div>
                  <div style={{color: 'rgba(247,250,252,0.52)', fontSize: 13, fontWeight: 850}}>{ledger.en}</div>
                </div>
                <div style={{marginTop: 10, color: ledger.tone, fontSize: 42, fontWeight: 950}}>{ledger.title}</div>
                <div style={{marginTop: 19, display: 'grid', gap: 16}}>
                  {ledger.items.map((item, itemIndex) => {
                    const rowIn = spring({
                      fps: localFps,
                      frame: frame - 18 - itemIndex * 8,
                      config: {damping: 21, stiffness: 170},
                    });
                    return (
                      <div
                        key={item}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '32px 1fr',
                          gap: 10,
                          alignItems: 'center',
                          color: isActive ? colors.ink : 'rgba(247,250,252,0.66)',
                          fontSize: 23,
                          fontWeight: 900,
                          opacity: rowIn,
                        }}
                      >
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            border: `1px solid ${ledger.tone}AA`,
                            background: `${ledger.tone}${isActive ? '2B' : '11'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: ledger.tone,
                            fontSize: 14,
                          }}
                        >
                          {String(itemIndex + 1)}
                        </div>
                        <div>{item}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const KnowledgeTakeover: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity(8);
  const railIn = spring({fps: localFps, frame, config: {damping: 20, stiffness: 175}});
  const mediaIn = spring({fps: localFps, frame: frame - 5, config: {damping: 20, stiffness: 170}});

  return (
    <AbsoluteFill style={{background: colors.dark, color: colors.ink, fontFamily, opacity}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 72% 46%, rgba(98,216,255,0.10), transparent 42%), linear-gradient(180deg, #070D13, #020508)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 132,
          width: 340,
          textShadow: '0 5px 24px rgba(0,0,0,0.98)',
          opacity: railIn,
          transform: `translateX(${interpolate(railIn, [0, 1], [-22, 0])}px)`,
        }}
      >
        <div style={{color: colors.cyan, fontSize: 64, lineHeight: 1, fontWeight: 950}}>03</div>
        <div style={{marginTop: 8, color: colors.cyan, fontSize: 16, fontWeight: 900}}>PERSONAL KNOWLEDGE BASE</div>
        <div style={{marginTop: 12, fontSize: 39, lineHeight: 1.12, fontWeight: 950}}>个人记录<br />连成知识网络</div>
        <div style={{marginTop: 28, display: 'grid', gap: 19}}>
          {[
            ['真实记录', '做过、错过、改过'],
            ['可以检索', '需要时能找到'],
            ['重新调用', '进入下一次选题与方案'],
          ].map(([label, value], index) => {
            const itemIn = spring({
              fps: localFps,
              frame: frame - 12 - index * 10,
              config: {damping: 21, stiffness: 170},
            });
            const tone = index === 2 ? colors.amber : colors.ink;
            return (
              <div key={label} style={{borderLeft: `3px solid ${tone}`, paddingLeft: 13, opacity: itemIn}}>
                <div style={{color: 'rgba(247,250,252,0.58)', fontSize: 15, fontWeight: 850}}>{label}</div>
                <div style={{marginTop: 5, color: tone, fontSize: 25, lineHeight: 1.14, fontWeight: 950}}>{value}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 420,
          top: 68,
          width: 1445,
          height: 860,
          overflow: 'hidden',
          border: '1px solid rgba(98,216,255,0.42)',
          background: '#1D1D1D',
          boxShadow: '0 26px 80px rgba(0,0,0,0.62), 0 0 34px rgba(98,216,255,0.10)',
          opacity: mediaIn,
          transform: `translateY(${interpolate(mediaIn, [0, 1], [18, 0])}px)`,
        }}
      >
        <Video
          src={staticFile('media/two-ledgers-20260722/personal-kb-graph-cropped-30fps.mp4')}
          muted
          objectFit="cover"
          style={{width: '100%', height: '100%', transform: `scale(${interpolate(frame, [0, 320], [1.02, 1.055], clamp)})`}}
        />
        <AbsoluteFill style={{background: 'linear-gradient(180deg, transparent 64%, rgba(2,7,12,0.40))'}} />
        <div
          style={{
            position: 'absolute',
            right: 18,
            bottom: 18,
            padding: '7px 11px',
            background: 'rgba(3,8,12,0.78)',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: 16,
            fontWeight: 850,
          }}
        >
          真实本地知识库关系图 · 已隐藏目录和文件名
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ValidationFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const nodes = ['方案', '有人用？', '数据卡点', '谁验收？', '拒绝原因', '调整判断'];

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 142,
        width: 800,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 24px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.66} width={920} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 900}}>REAL VALIDATION · 自己走进场景</div>
        <div style={{marginTop: 10, fontSize: 49, fontWeight: 950}}>讨论十次，不如拿到一次真实反馈</div>
        <div style={{marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 58px 1fr', rowGap: 18, alignItems: 'center'}}>
          {nodes.map((node, index) => {
            const progress = spring({
              fps: localFps,
              frame: frame - 11 - index * 11,
              config: {damping: 21, stiffness: 175},
            });
            const tone = index === nodes.length - 1 ? colors.amber : index >= 4 ? colors.green : colors.cyan;
            const isLeft = index % 2 === 0;
            return (
              <React.Fragment key={node}>
                {isLeft ? (
                  <div
                    style={{
                      minHeight: 68,
                      padding: '12px 16px',
                      boxSizing: 'border-box',
                      borderLeft: `4px solid ${tone}`,
                      background: 'rgba(2,7,12,0.30)',
                      fontSize: 26,
                      fontWeight: 950,
                      opacity: progress,
                    }}
                  >
                    {node}
                  </div>
                ) : <div />}
                <div style={{color: tone, fontSize: 33, textAlign: 'center', opacity: progress}}>→</div>
                {!isLeft ? (
                  <div
                    style={{
                      minHeight: 68,
                      padding: '12px 16px',
                      boxSizing: 'border-box',
                      borderRight: `4px solid ${tone}`,
                      background: 'rgba(2,7,12,0.30)',
                      fontSize: 26,
                      fontWeight: 950,
                      textAlign: 'right',
                      opacity: progress,
                    }}
                  >
                    {node}
                  </div>
                ) : <div />}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const DaoQuoteStage: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity(10);
  const firstIn = spring({fps: localFps, frame: frame - 4, config: {damping: 22, stiffness: 150}});
  const secondIn = spring({fps: localFps, frame: frame - 20, config: {damping: 22, stiffness: 150}});
  const line = interpolate(frame, [12, 44], [0, 1], clamp);

  return (
    <AbsoluteFill style={{background: colors.dark, color: colors.ink, fontFamily, opacity}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 46%, rgba(98,216,255,0.10), transparent 38%), linear-gradient(145deg, #071018 0%, #020405 62%, #0C0A07 100%)',
        }}
      />
      <div style={{position: 'absolute', inset: '120px 160px 160px', textAlign: 'center'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 900}}>SOURCE · 《道德经》第四十一章</div>
        <div
          style={{
            marginTop: 54,
            fontSize: 104,
            lineHeight: 1,
            fontWeight: 950,
            opacity: firstIn,
            transform: `translateY(${interpolate(firstIn, [0, 1], [22, 0])}px)`,
          }}
        >
          明道若昧
        </div>
        <div
          style={{
            marginTop: 32,
            color: colors.amber,
            fontSize: 104,
            lineHeight: 1,
            fontWeight: 950,
            opacity: secondIn,
            transform: `translateY(${interpolate(secondIn, [0, 1], [22, 0])}px)`,
          }}
        >
          进道若退
        </div>
        <div
          style={{
            margin: '48px auto 0',
            width: `${line * 680}px`,
            height: 4,
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.amber})`,
          }}
        />
        <div style={{marginTop: 30, color: 'rgba(247,250,252,0.78)', fontSize: 28, fontWeight: 850}}>
          真正往上走，体感有时像在后退
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PersonalContextMap: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity();
  const nodes = ['做过什么', '怎么判断', '为什么改', '哪里失败'];

  return (
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 132,
        width: 810,
        height: 690,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 24px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.67} width={920} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 900}}>PERSONAL CONTEXT · 通用模型没有的部分</div>
        <div style={{marginTop: 10, fontSize: 48, lineHeight: 1.08, fontWeight: 950}}>真实而连续的个人上下文</div>
        <div style={{position: 'relative', marginTop: 35, height: 470}}>
          <div
            style={{
              position: 'absolute',
              left: 232,
              top: 155,
              width: 300,
              height: 138,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              border: `1px solid ${colors.amber}CC`,
              background: 'rgba(255,190,85,0.11)',
              boxShadow: '0 0 42px rgba(255,190,85,0.16)',
              color: colors.amber,
              fontSize: 38,
              lineHeight: 1.1,
              fontWeight: 950,
            }}
          >
            个人上下文
          </div>
          {nodes.map((node, index) => {
            const positions = [
              {left: 10, top: 40},
              {left: 520, top: 40},
              {left: 10, top: 326},
              {left: 520, top: 326},
            ];
            const progress = spring({
              fps: localFps,
              frame: frame - 10 - index * 10,
              config: {damping: 21, stiffness: 175},
            });
            const p = positions[index];
            return (
              <div
                key={node}
                style={{
                  position: 'absolute',
                  left: p.left,
                  top: p.top,
                  width: 235,
                  minHeight: 72,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  borderLeft: `4px solid ${index % 2 === 0 ? colors.cyan : colors.green}`,
                  background: 'rgba(2,7,12,0.33)',
                  fontSize: 25,
                  fontWeight: 950,
                  opacity: progress,
                }}
              >
                {node}
              </div>
            );
          })}
          <div style={{position: 'absolute', left: 205, top: 110, width: 150, height: 2, background: colors.cyan, transform: 'rotate(28deg)', opacity: 0.65}} />
          <div style={{position: 'absolute', left: 444, top: 110, width: 150, height: 2, background: colors.green, transform: 'rotate(-28deg)', opacity: 0.65}} />
          <div style={{position: 'absolute', left: 205, top: 332, width: 150, height: 2, background: colors.cyan, transform: 'rotate(-28deg)', opacity: 0.65}} />
          <div style={{position: 'absolute', left: 444, top: 332, width: 150, height: 2, background: colors.green, transform: 'rotate(28deg)', opacity: 0.65}} />
        </div>
      </div>
    </div>
  );
};

const ClosingStatement: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity(12);
  const titleIn = spring({fps: localFps, frame: frame - 4, config: {damping: 20, stiffness: 170}});
  const underline = interpolate(frame, [10, 36], [0, 1], clamp);

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 190,
        width: 760,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 25px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.68} width={900} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 900}}>TODAY · 从今天开始</div>
        <div
          style={{
            marginTop: 20,
            fontSize: 63,
            lineHeight: 1.08,
            fontWeight: 950,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [22, 0])}px)`,
          }}
        >
          建你的知识库
          <br />
          别让150个粉丝
          <br />
          把你劝退
        </div>
        <div
          style={{
            marginTop: 24,
            width: `${underline * 560}px`,
            height: 5,
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.amber})`,
          }}
        />
      </div>
    </div>
  );
};

const Scenes: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={f(1.4)} durationInFrames={f(11.9)} premountFor={10}>
      <V7HeroMetric
        eyebrow="REAL QUESTION · 一句群友提问"
        value="150"
        suffix="个粉丝"
        caption="怎么变现？"
        facts={['今天的数字，不是方向的判决', '先看每次行动留下了什么']}
        tone="amber"
      />
    </Sequence>

    <Sequence from={f(23.8)} durationInFrames={f(6.9)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="DECISION · 没有结果时怎么判断"
        title="继续、调整，还是停止？"
        items={[
          {label: '继续', detail: '证据在增长', tone: 'green'},
          {label: '调整', detail: '结果弱，但学到了新东西', tone: 'amber', active: true},
          {label: '停止', detail: '两本账长期都不增长', tone: 'red'},
        ]}
      />
    </Sequence>

    <Sequence from={f(39.9)} durationInFrames={f(10.2)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="TWO EXTREMES · 两种判断都不够"
        title="别被一句话带走"
        items={[
          {label: '极端一', detail: '别人一句话，马上劝退', tone: 'red'},
          {label: '极端二', detail: '坚持就会成功，自我安慰', tone: 'amber'},
          {label: '中间', detail: '回到事实和反馈', tone: 'cyan', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(51.2)} durationInFrames={f(15.9)} premountFor={10}>
      <MetricBoundary />
    </Sequence>

    <Sequence from={f(67.8)} durationInFrames={f(19.4)} premountFor={10}>
      <TwoLedgerStage active="result" />
    </Sequence>

    <Sequence from={f(87.3)} durationInFrames={f(12)} premountFor={10}>
      <TwoLedgerStage active="asset" />
    </Sequence>

    <Sequence from={f(99.9)} durationInFrames={f(11.5)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="INPUT · 知识库从真实记录开始"
        title="把做过、错过、改过的留下来"
        items={[
          {label: '参考视频', detail: '看见了什么', tone: 'cyan'},
          {label: '项目交流', detail: '现场发生了什么', tone: 'green'},
          {label: '错误判断', detail: '为什么没做对', tone: 'red'},
          {label: '复盘', detail: '下次怎么改', tone: 'amber', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(111.6)} durationInFrames={f(10.7)} premountFor={fps}>
      <KnowledgeTakeover />
    </Sequence>

    <Sequence from={f(127.3)} durationInFrames={f(12.6)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="DIGITAL ASSET · 不是存完就结束"
        title="能重新调用，才可能形成资产"
        items={[
          {label: '01', detail: '能检索', tone: 'cyan'},
          {label: '02', detail: '能结合', tone: 'green'},
          {label: '03', detail: '能重新调用', tone: 'amber', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(140.7)} durationInFrames={f(13.7)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="FILTER · 数字资产的反面"
        title="堆得再多，也可能只是数字垃圾"
        items={[
          {label: '虚假', detail: '没有真实过程', tone: 'red'},
          {label: '重复', detail: '没有新增判断', tone: 'red'},
          {label: '无来源', detail: '无法核对', tone: 'red'},
          {label: '不复用', detail: '存完再也不用', tone: 'red', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(154.7)} durationInFrames={f(18.8)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="COMPOUNDING · 真正能反复放大的四样东西"
        title="真实，才有复利的起点"
        items={[
          {label: '真实问题', detail: '场景里真的发生过', tone: 'cyan'},
          {label: '自己的判断', detail: '你为什么这样选', tone: 'amber'},
          {label: '行动过程', detail: '你实际做了什么', tone: 'green'},
          {label: '结果或失败', detail: '留下可验证反馈', tone: 'amber', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(174.1)} durationInFrames={f(31.3)} premountFor={10}>
      <ValidationFlow />
    </Sequence>

    <Sequence from={f(206.5)} durationInFrames={f(9.2)} premountFor={10}>
      <DaoQuoteStage />
    </Sequence>

    <Sequence from={f(216.6)} durationInFrames={f(20.1)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="FEEDBACK · 三个不等于"
        title="怀疑可以变成下一次行动"
        items={[
          {label: '学会工具', detail: '不等于有人付钱', tone: 'red'},
          {label: '做出产品', detail: '不等于市场需要', tone: 'red'},
          {label: '发了视频', detail: '不等于立刻有流量', tone: 'red'},
          {label: '反馈链', detail: '检查 → 调整 → 行动', tone: 'green', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(237.6)} durationInFrames={f(16.1)} premountFor={10}>
      <V7HeroMetric
        eyebrow="TODAY'S NUMBER · 不炫耀，也不否定"
        value="150"
        suffix="个粉丝"
        caption="只是今天的一组数字"
        facts={['重复昨天，不叫坚持', '下一次行动要留下新证据']}
        tone="cyan"
      />
    </Sequence>

    <Sequence from={f(254.2)} durationInFrames={f(23.3)} premountFor={10}>
      <PersonalContextMap />
    </Sequence>

    <Sequence from={f(277.8)} durationInFrames={f(13.4)} premountFor={10}>
      <ClosingStatement />
    </Sequence>
  </AbsoluteFill>
);

const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = (frame / Math.max(1, TWO_LEDGER_DURATION_IN_FRAMES - 1)) * 100;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 28,
          display: 'flex',
          alignItems: 'center',
          color: colors.ink,
          fontFamily,
          textShadow: '0 3px 16px rgba(0,0,0,0.94)',
          zIndex: 120,
        }}
      >
        <div style={{width: 9, height: 9, background: colors.cyan, boxShadow: `0 0 17px ${colors.cyan}`}} />
        <div style={{marginLeft: 12, fontSize: 19, fontWeight: 950}}>超哥AI创业记</div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 54,
          top: 26,
          maxWidth: 460,
          padding: '8px 12px',
          color: 'rgba(247,250,252,0.86)',
          background: 'rgba(2,7,12,0.38)',
          borderLeft: `3px solid ${colors.amber}`,
          fontFamily,
          fontSize: 17,
          fontWeight: 900,
          textShadow: '0 3px 14px rgba(0,0,0,0.96)',
          zIndex: 120,
        }}
      >
        150个粉丝之后，怎么判断方向
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
            width: `${progress}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.amber})`,
            boxShadow: '0 0 14px rgba(98,216,255,0.65)',
          }}
        />
      </div>
    </>
  );
};

const SoundDesign: React.FC = () => {
  const cues = [
    {time: 1.4, file: 'whoosh.wav', volume: 0.10},
    {time: 23.8, file: 'ui-switch.wav', volume: 0.14},
    {time: 39.9, file: 'ui-switch.wav', volume: 0.13},
    {time: 67.8, file: 'whoosh.wav', volume: 0.10},
    {time: 70.0, file: 'ui-switch.wav', volume: 0.16},
    {time: 87.3, file: 'ui-switch.wav', volume: 0.16},
    {time: 111.6, file: 'whoosh.wav', volume: 0.12},
    {time: 127.3, file: 'mouse-click.wav', volume: 0.11},
    {time: 154.7, file: 'ui-switch.wav', volume: 0.14},
    {time: 174.1, file: 'whoosh.wav', volume: 0.10},
    {time: 206.5, file: 'page-turn.wav', volume: 0.18},
    {time: 216.6, file: 'ui-switch.wav', volume: 0.14},
    {time: 254.2, file: 'whoosh.wav', volume: 0.10},
    {time: 277.8, file: 'ui-switch.wav', volume: 0.14},
  ];

  return (
    <>
      {cues.map((cue) => (
        <Sequence key={`${cue.time}-${cue.file}`} from={f(cue.time)} durationInFrames={f(1.5)}>
          <Audio src={staticFile(`audio/remotion-sfx/${cue.file}`)} volume={cue.volume} />
        </Sequence>
      ))}
    </>
  );
};

const TwoLedgerProgram: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <AbsoluteFill style={{background: colors.dark, overflow: 'hidden'}}>
    <LocalFont />
    <TalkFootage />
    <Scenes />
    {soundEnabled ? <SoundDesign /> : null}
    <Hud />
    <StableBilingualCaptionOverlay captionsSrc="data/TWO_LEDGER_20260722_talk01_16x9.bilingual.v1.json" />
  </AbsoluteFill>
);

export const TwoLedgersV7Talk16x9: React.FC = () => <TwoLedgerProgram soundEnabled />;
export const TwoLedgersV7Talk16x9NoSfx: React.FC = () => <TwoLedgerProgram soundEnabled={false} />;
