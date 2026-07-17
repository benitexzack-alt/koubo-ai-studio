import {Audio, Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {CaptionOverlay} from './components/CaptionOverlay';
import {StableBilingualCaptionOverlay} from './components/StableBilingualCaptionOverlay';

export const RUISHENG_GEO_DURATION_IN_FRAMES = 8365;
export const RUISHENG_GEO_V2_DURATION_IN_FRAMES = 8560;

const palette = {
  bg: '#07131A',
  panel: 'rgba(8, 29, 39, 0.94)',
  panel2: 'rgba(15, 43, 55, 0.94)',
  line: 'rgba(105, 224, 205, 0.32)',
  text: '#F4F8FA',
  muted: '#A9BBC4',
  teal: '#35D0BA',
  amber: '#FFB454',
  red: '#FF7A6E',
};

const fontFamily = 'PingFang SC, Noto Sans CJK SC, Microsoft YaHei, sans-serif';
const toFrame = (seconds: number) => Math.round(seconds * 30);

const chapters = [
  {start: 0, end: 43.01, label: '01 真实需求'},
  {start: 43.01, end: 122.01, label: '02 企业事实'},
  {start: 122.01, end: 146.93, label: '03 曝光断层'},
  {start: 146.93, end: 215.08, label: '04 用户问题'},
  {start: 215.08, end: 278.83, label: '05 执行路径'},
];

const punchEvents = [5.2, 44.3, 153.3, 182.3, 235.84, 265.32];

const punchAt = (time: number, at: number) => {
  if (time < at || time > at + 0.82) return 0;
  if (time <= at + 0.28) {
    return interpolate(time, [at, at + 0.28], [0, 0.048], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }
  return interpolate(time, [at + 0.28, at + 0.82], [0.048, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
};

const MainFootage: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  const cycle = frame % 240;
  const normalPush = interpolate(cycle, [0, 120, 240], [0, 0.012, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const punch = Math.max(...punchEvents.map((event) => punchAt(time, event)));
  const scale = 1.026 + normalPush + punch;
  const x = Math.sin(time * 0.19) * 7;
  const y = Math.sin(time * 0.13 + 0.8) * 3;

  return (
    <AbsoluteFill style={{backgroundColor: palette.bg, overflow: 'hidden'}}>
      <Video
        src={staticFile('video/ruisheng-geo-v1/ruisheng_geo_rough_v1.mp4')}
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          transformOrigin: '56% 48%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(3,12,17,0.34) 0%, rgba(3,12,17,0.12) 36%, transparent 60%), linear-gradient(0deg, rgba(2,8,12,0.40) 0%, transparent 24%)',
        }}
      />
    </AbsoluteFill>
  );
};

const BrollClip: React.FC<{file: string; duration: number; label: string}> = ({
  file,
  duration,
  label,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const end = Math.max(1, duration * fps);
  const scale = interpolate(frame, [0, end], [1.02, 1.075], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const opacity = interpolate(frame, [0, 6, end - 7, end], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{opacity, overflow: 'hidden', backgroundColor: palette.bg}}>
      <Video
        src={staticFile(`video/ruisheng-geo-v1/${file}`)}
        muted
        objectFit="cover"
        style={{width: '100%', height: '100%', transform: `scale(${scale})`}}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(4,15,21,0.62), transparent 58%), linear-gradient(0deg, rgba(4,15,21,0.40), transparent 40%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 50,
          bottom: 175,
          padding: '8px 16px',
          borderRadius: 999,
          border: `1px solid ${palette.line}`,
          background: 'rgba(4,17,24,0.72)',
          color: palette.text,
          fontFamily,
          fontWeight: 700,
          fontSize: 25,
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};

const broll = [
  {start: 0, duration: 4.2, file: 'IMG_0186.mp4', label: '兰州 · 企业现场'},
  {start: 46.3, duration: 3.4, file: 'IMG_0187.mp4', label: '企业资料核对'},
  {start: 92.3, duration: 2.4, file: 'IMG_0193.mp4', label: '真实业务场景'},
  {start: 130.3, duration: 3.6, file: 'IMG_0195.mp4', label: '线上曝光痛点'},
  {start: 217.84, duration: 4.8, file: 'IMG_0201.mp4', label: '进入执行路径'},
  {start: 273.54, duration: 4.8, file: 'IMG_0202.mp4', label: '真实业务空间'},
];

const brollV2 = broll.map((item) =>
  item.file === 'IMG_0202.mp4' ? {...item, duration: 5.3} : item,
);

const CardShell: React.FC<{
  duration: number;
  children: React.ReactNode;
  centered?: boolean;
  width?: number;
  stable?: boolean;
}> = ({duration, children, centered = false, width = 760, stable = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const end = duration * fps;
  const opacity = interpolate(frame, [0, 9, end - 9, end], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = stable ? 0 : interpolate(frame, [0, 15], [34, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const scale = stable ? 1 : interpolate(frame, [0, 15], [0.965, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: centered ? 'center' : 'flex-start',
        paddingLeft: centered ? 0 : 44,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width,
          padding: '28px 30px 30px',
          borderRadius: 28,
          border: `1px solid ${palette.line}`,
          background: `linear-gradient(145deg, ${palette.panel}, ${palette.panel2})`,
          boxShadow: '0 28px 80px rgba(0,0,0,0.46)',
          color: palette.text,
          fontFamily,
          opacity,
          transform: `translateY(${y}px) scale(${scale})`,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

const Eyebrow: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{fontSize: 23, fontWeight: 800, color: palette.teal, letterSpacing: 3}}>{children}</div>
);

const DefinitionCard: React.FC<{stable?: boolean}> = ({stable}) => (
  <CardShell duration={7} centered width={1050} stable={stable}>
    <Eyebrow>GEO · 真实企业落地</Eyebrow>
    <div style={{fontSize: 70, fontWeight: 950, lineHeight: 1.08, marginTop: 14}}>第一步不是发文章</div>
    <div style={{fontSize: 48, fontWeight: 850, color: palette.amber, marginTop: 10}}>而是先核对企业事实</div>
    <div style={{fontSize: 27, color: palette.muted, marginTop: 18}}>主体、业务、服务、区域、资质、案例，都要先有证据</div>
  </CardShell>
);

const ThreeColumnCard: React.FC<{stable?: boolean}> = ({stable}) => {
  const items = [
    ['企业是谁', '主体 · 品牌 · 渠道'],
    ['真实做什么', '产品 · 服务 · 场景'],
    ['证据在哪里', '资质 · 官网 · 案例'],
  ];
  return (
    <CardShell duration={9} width={800} stable={stable}>
      <Eyebrow>先问清三件事</Eyebrow>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20}}>
        {items.map(([title, body], index) => (
          <div key={title} style={{padding: '20px 13px', borderRadius: 18, background: 'rgba(255,255,255,0.055)', minHeight: 150}}>
            <div style={{fontSize: 24, color: index === 2 ? palette.amber : palette.teal, fontWeight: 900}}>0{index + 1}</div>
            <div style={{fontSize: 30, fontWeight: 900, marginTop: 8}}>{title}</div>
            <div style={{fontSize: 20, lineHeight: 1.45, color: palette.muted, marginTop: 8}}>{body}</div>
          </div>
        ))}
      </div>
    </CardShell>
  );
};

const QuestionCard: React.FC<{stable?: boolean}> = ({stable}) => (
  <CardShell duration={9} width={760} stable={stable}>
    <Eyebrow>客户不会只问一个词</Eyebrow>
    <div style={{fontSize: 44, fontWeight: 930, marginTop: 12}}>问题会继续往下追</div>
    {['适合什么场景？', '参数怎么选？', '谁来安装、调试和售后？'].map((item, index) => (
      <div key={item} style={{marginTop: 12, padding: '12px 18px', borderRadius: 15, background: 'rgba(255,255,255,0.06)', fontSize: 27, fontWeight: 760}}>
        <span style={{color: palette.teal, marginRight: 12}}>Q{index + 1}</span>{item}
      </div>
    ))}
  </CardShell>
);

const ResourceMapCard: React.FC<{stable?: boolean}> = ({stable}) => {
  const nodes = ['客户怎么问', '专业追问', '事实答案', '公开内容', '重复验证'];
  return (
    <CardShell duration={11} width={820} stable={stable}>
      <Eyebrow>现实问题 → 数字资产</Eyebrow>
      <div style={{fontSize: 39, fontWeight: 930, marginTop: 12}}>不是堆关键词，是建立可验证问题链</div>
      <div style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 22}}>
        {nodes.map((node, index) => (
          <React.Fragment key={node}>
            <div style={{padding: '12px 15px', borderRadius: 14, border: `1px solid ${index === 2 ? palette.amber : palette.line}`, background: 'rgba(255,255,255,0.055)', fontSize: 23, fontWeight: 850}}>{node}</div>
            {index < nodes.length - 1 ? <div style={{fontSize: 27, color: palette.teal}}>→</div> : null}
          </React.Fragment>
        ))}
      </div>
    </CardShell>
  );
};

const ActionCard: React.FC<{stable?: boolean}> = ({stable}) => (
  <CardShell duration={11} width={790} stable={stable}>
    <Eyebrow>初期资料清单</Eyebrow>
    <div style={{fontSize: 42, fontWeight: 930, marginTop: 12}}>先指定事实负责人，再开始优化</div>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 18}}>
      {['主体与品牌', '产品与服务', '资质与授权', '官网与案例'].map((item, index) => (
        <div key={item} style={{padding: '15px 17px', borderRadius: 15, background: 'rgba(255,255,255,0.06)', fontSize: 27, fontWeight: 850}}>
          <span style={{color: palette.teal, marginRight: 10}}>✓</span>{item}
        </div>
      ))}
    </div>
  </CardShell>
);

const BoundaryCard: React.FC<{stable?: boolean}> = ({stable}) => (
  <CardShell duration={11} width={820} stable={stable}>
    <Eyebrow>GEO 的边界</Eyebrow>
    <div style={{fontSize: 52, lineHeight: 1.12, fontWeight: 950, marginTop: 12}}>
      发布 <span style={{color: palette.red}}>≠</span> 被 AI 推荐
    </div>
    <div style={{fontSize: 30, lineHeight: 1.5, color: palette.muted, marginTop: 16}}>先完善可核验事实，再持续采样、人工复核和重复验证</div>
  </CardShell>
);

const SemanticCards: React.FC<{stable?: boolean}> = ({stable}) => (
  <>
    <Sequence from={toFrame(2)} durationInFrames={toFrame(7)}><DefinitionCard stable={stable} /></Sequence>
    <Sequence from={toFrame(44.3)} durationInFrames={toFrame(9)}><ThreeColumnCard stable={stable} /></Sequence>
    <Sequence from={toFrame(153.3)} durationInFrames={toFrame(9)}><QuestionCard stable={stable} /></Sequence>
    <Sequence from={toFrame(182.3)} durationInFrames={toFrame(11)}><ResourceMapCard stable={stable} /></Sequence>
    <Sequence from={toFrame(235.84)} durationInFrames={toFrame(11)}><ActionCard stable={stable} /></Sequence>
    <Sequence from={toFrame(264.84)} durationInFrames={toFrame(11)}><BoundaryCard stable={stable} /></Sequence>
  </>
);

const HeaderHud: React.FC<{contentDurationInFrames?: number}> = ({contentDurationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const time = frame / fps;
  const chapter = chapters.find((item) => time >= item.start && time < item.end) ?? chapters.at(-1)!;
  const progress = frame / Math.max(1, (contentDurationInFrames ?? durationInFrames) - 1);
  const factPending = time >= 66.27 && time <= 138.05;

  return (
    <>
      <div style={{position: 'absolute', top: 26, left: 40, right: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          <div style={{padding: '8px 13px', borderRadius: 10, background: palette.teal, color: palette.bg, fontSize: 23, fontWeight: 950}}>GEO 现场记录</div>
          <div style={{fontSize: 25, color: palette.text, fontWeight: 850}}>{chapter.label}</div>
        </div>
        <div style={{fontSize: 21, fontWeight: 780, color: palette.muted}}>瑞盛音箱 · 2026.07.17</div>
      </div>
      {factPending ? (
        <div style={{position: 'absolute', top: 82, right: 42, padding: '7px 13px', borderRadius: 999, background: 'rgba(5,18,25,0.76)', border: `1px solid ${palette.line}`, color: palette.amber, fontFamily, fontSize: 20, fontWeight: 800}}>现场口述 · 企业事实待资料复核</div>
      ) : null}
      <div style={{position: 'absolute', top: 0, left: 0, width: `${progress * 100}%`, height: 6, background: `linear-gradient(90deg, ${palette.teal}, ${palette.amber})`}} />
    </>
  );
};

const cueSheet = [
  [0.25, 'impact-low.wav', 0.72],
  [2.0, 'card-pop.wav', 0.8],
  [5.2, 'node-connect.wav', 0.76],
  [20.14, 'key-transition.wav', 0.68],
  [44.3, 'card-pop.wav', 0.76],
  [46.9, 'node-connect.wav', 0.72],
  [121.96, 'key-transition.wav', 0.66],
  [153.3, 'card-pop.wav', 0.74],
  [182.3, 'node-connect.wav', 0.76],
  [215.04, 'key-transition.wav', 0.66],
  [235.84, 'card-pop.wav', 0.76],
  [245.56, 'confirm.wav', 0.8],
  [265.32, 'impact-low.wav', 0.7],
] as const;

const SoundEffects: React.FC = () => (
  <>
    {cueSheet.map(([start, file, volume]) => (
      <Sequence key={`${start}-${file}`} from={toFrame(start)} layout="none">
        <Audio src={staticFile(`audio/ruisheng-geo-v1/${file}`)} volume={volume} />
      </Sequence>
    ))}
  </>
);

const OutroCard: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = 225;
  const backgroundOpacity = interpolate(frame, [0, 28, duration - 20, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitOpacity = interpolate(frame, [duration - 26, duration - 8], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const headlineOpacity = Math.min(exitOpacity, interpolate(frame, [30, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));
  const identityOpacity = Math.min(exitOpacity, interpolate(frame, [50, 68], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));
  const ctaOpacity = Math.min(exitOpacity, interpolate(frame, [92, 110], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));
  const textY = interpolate(frame, [30, 54], [18, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const scale = interpolate(frame, [0, duration], [1.02, 1.075], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  return (
    <AbsoluteFill style={{backgroundColor: palette.bg, opacity: backgroundOpacity, overflow: 'hidden'}}>
      <Img
        src={staticFile('images/ruisheng-geo-v2/outro-bg.jpg')}
        style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`}}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(3,13,19,0.94) 0%, rgba(3,13,19,0.78) 48%, rgba(3,13,19,0.36) 74%, rgba(3,13,19,0.48) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 184,
          width: 980,
          color: palette.text,
          fontFamily,
        }}
      >
        <div style={{opacity: headlineOpacity, transform: `translateY(${textY}px)`}}>
          <div style={{fontSize: 24, fontWeight: 850, color: palette.teal, letterSpacing: 4}}>
            GEO · 本地企业 AI 落地记录
          </div>
          <div style={{fontSize: 64, lineHeight: 1.12, fontWeight: 950, marginTop: 18}}>
            企业做 GEO，
            <br />
            先把企业事实说清楚
          </div>
        </div>
        <div style={{fontSize: 31, lineHeight: 1.45, color: palette.muted, marginTop: 22, opacity: identityOpacity}}>
          超哥 · 兰州 AI 创业
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 28,
            padding: '12px 20px',
            borderRadius: 999,
            border: `1px solid ${palette.line}`,
            background: 'rgba(7,28,37,0.74)',
            color: palette.amber,
            fontSize: 27,
            fontWeight: 850,
            opacity: ctaOpacity,
          }}
        >
          关注我，看本地企业 AI 怎么一步步落地
        </div>
      </div>
      <Sequence from={34} layout="none">
        <Audio src={staticFile('audio/ruisheng-geo-v1/impact-low.wav')} volume={0.54} />
      </Sequence>
      <Sequence from={30} layout="none">
        <Audio src={staticFile('audio/ruisheng-geo-v1/outro-bed.wav')} volume={0.7} />
      </Sequence>
      <Sequence from={76} layout="none">
        <Audio src={staticFile('audio/ruisheng-geo-v1/node-connect.wav')} volume={0.34} />
      </Sequence>
      <Sequence from={112} layout="none">
        <Audio src={staticFile('audio/ruisheng-geo-v1/confirm.wav')} volume={0.62} />
      </Sequence>
      <div
        style={{
          position: 'absolute',
          right: 58,
          bottom: 36,
          color: 'rgba(244,248,250,0.64)',
          fontFamily,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        兰州 · 真实企业服务现场
      </div>
    </AbsoluteFill>
  );
};

export const RuishengGeoField16x9: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: palette.bg}}>
      <MainFootage />
      {broll.map((item) => (
        <Sequence key={`${item.start}-${item.file}`} from={toFrame(item.start)} durationInFrames={toFrame(item.duration)}>
          <BrollClip file={item.file} duration={item.duration} label={item.label} />
        </Sequence>
      ))}
      <SemanticCards />
      <HeaderHud />
      <SoundEffects />
      <CaptionOverlay captionsSrc="data/ruisheng_geo_rough_v1.captions.json" maxHoldMs={500} />
    </AbsoluteFill>
  );
};

export const RuishengGeoField16x9V2: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: palette.bg}}>
      <Sequence durationInFrames={RUISHENG_GEO_DURATION_IN_FRAMES}>
        <AbsoluteFill style={{backgroundColor: palette.bg}}>
          <MainFootage />
          {brollV2.map((item) => (
            <Sequence key={`${item.start}-${item.file}`} from={toFrame(item.start)} durationInFrames={toFrame(item.duration)}>
              <BrollClip file={item.file} duration={item.duration} label={item.label} />
            </Sequence>
          ))}
          <SemanticCards stable />
          <HeaderHud contentDurationInFrames={RUISHENG_GEO_DURATION_IN_FRAMES} />
          <SoundEffects />
          <StableBilingualCaptionOverlay captionsSrc="data/ruisheng_geo_rough_v2.bilingual.json" />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={RUISHENG_GEO_DURATION_IN_FRAMES - 30} durationInFrames={225}>
        <OutroCard />
      </Sequence>
    </AbsoluteFill>
  );
};
