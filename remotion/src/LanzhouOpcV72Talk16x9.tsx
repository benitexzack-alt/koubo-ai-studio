import {Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  V72ProductionShell,
  type V72CustomScene,
  type V72ProductionConfig,
} from './components/V72ProductionShell';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const LANZHOU_OPC_DURATION_IN_FRAMES = f(260.5);

type MontageItem = {
  src: string;
  kind: 'video' | 'image';
  label: string;
  fit?: 'cover' | 'contain';
};

type MontageData = {
  eyebrow: string;
  title: string;
  detail: string;
  items: MontageItem[];
};

const MontageAsset: React.FC<{
  item: MontageItem;
  index: number;
  count: number;
}> = ({item, index, count}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const fade = Math.min(9, Math.max(4, Math.floor(durationInFrames / 4)));
  const opacity = Math.min(
    index === 0 ? 1 : interpolate(frame, [0, fade], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(fade, durationInFrames - fade), durationInFrames],
      [1, 0],
      clamp,
    ),
  );
  const scale = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    item.fit === 'contain' ? [1.01, 1.045] : [1.035, 1.09],
    clamp,
  );
  const x = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    index % 2 === 0 ? [0, -13] : [-10, 4],
    clamp,
  );

  return (
    <AbsoluteFill style={{opacity, background: '#03070B'}}>
      {item.kind === 'video' ? (
        <Video
          src={staticFile(item.src)}
          muted
          loop
          objectFit={item.fit ?? 'cover'}
          style={{
            width: '100%',
            height: '100%',
            transform: `translate3d(${x}px, 0, 0) scale(${scale})`,
            transformOrigin: '50% 48%',
          }}
        />
      ) : (
        <Img
          src={staticFile(item.src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: item.fit ?? 'cover',
            transform: `translate3d(${x}px, 0, 0) scale(${scale})`,
            transformOrigin: '50% 48%',
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.78) 0%, rgba(2,7,12,0.28) 43%, rgba(2,7,12,0.03) 72%), linear-gradient(180deg, rgba(2,7,12,0.12), transparent 62%, rgba(2,7,12,0.38))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 54,
          bottom: 156,
          padding: '8px 12px',
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(3,8,12,0.70)',
          color: 'rgba(247,250,252,0.88)',
          fontFamily,
          fontSize: 16,
          fontWeight: 850,
        }}
      >
        {item.label} · {String(index + 1).padStart(2, '0')}/{String(count).padStart(2, '0')}
      </div>
    </AbsoluteFill>
  );
};

const MediaMontage: React.FC<{data: MontageData}> = ({data}) => {
  const {durationInFrames} = useVideoConfig();
  const itemFrames = Math.max(1, Math.floor(durationInFrames / data.items.length));
  const overlap = Math.min(10, Math.max(5, Math.round(itemFrames * 0.12)));

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#03070B'}}>
      {data.items.map((item, index) => {
        const from = index * itemFrames;
        const end =
          index === data.items.length - 1
            ? durationInFrames
            : Math.min(durationInFrames, from + itemFrames + overlap);
        return (
          <Sequence
            key={`${item.src}-${index}`}
            from={from}
            durationInFrames={Math.max(1, end - from)}
            premountFor={10}
            style={{zIndex: index + 1}}
          >
            <MontageAsset item={item} index={index} count={data.items.length} />
          </Sequence>
        );
      })}
      <div
        style={{
          position: 'absolute',
          zIndex: 80,
          left: 62,
          top: 154,
          width: 660,
          color: '#F7FAFC',
          fontFamily,
          textShadow: '0 5px 28px rgba(0,0,0,0.98)',
        }}
      >
        <div style={{color: '#62D8FF', fontSize: 18, fontWeight: 950}}>
          {data.eyebrow}
        </div>
        <div style={{marginTop: 12, fontSize: 55, lineHeight: 1.06, fontWeight: 950}}>
          {data.title}
        </div>
        <div
          style={{
            marginTop: 22,
            width: 570,
            borderLeft: '4px solid #FFBE55',
            paddingLeft: 16,
            color: 'rgba(247,250,252,0.90)',
            fontSize: 27,
            lineHeight: 1.28,
            fontWeight: 850,
          }}
        >
          {data.detail}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TopicBar: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      zIndex: 300,
      right: 54,
      top: 28,
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      color: '#F7FAFC',
      fontFamily,
      fontSize: 18,
      fontWeight: 900,
      textShadow: '0 3px 16px rgba(0,0,0,0.94)',
    }}
  >
    <span style={{color: '#62D8FF'}}>兰州OPC大会</span>
    <span style={{color: 'rgba(247,250,252,0.54)'}}>·</span>
    <span>三个入口正在变清楚</span>
  </div>
);

const media = (name: string) =>
  `media/lanzhou-opc-20260731/broll/${name}`;

const config: V72ProductionConfig = {
  durationSeconds: 260.5,
  sourceVideo:
    'media/lanzhou-opc-20260731/talk/LANZHOU_OPC_20260731_talk01_30fps_loudness.mp4',
  captionsSrc: 'data/LANZHOU_OPC_20260731_talk01.bilingual.v1.json',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.045) saturate(1.035) brightness(1.015)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.31) 0%, rgba(2,7,12,0.06) 54%, rgba(2,7,12,0.02) 100%)',
  motion: {
    cuts: [
      0, 3.4, 8.9, 15.9, 20.9, 27.9, 33.9, 40.9, 52.9, 55.9, 57.9,
      68.9, 78.9, 89.9, 93.9, 100.9, 111.9, 119.9, 129.9, 135.9,
      142.9, 153.9, 160.9, 170.9, 178.9, 184.9, 193.9, 202.9, 207.9,
      217.9, 223.9, 232.9, 238.9, 245.9, 250.9, 257.9, 260.5,
    ],
    baseScale: 1.035,
    peakScales: [1.076, 1.081, 1.074, 1.08],
    peakX: [-16, -8, 7, -13],
    peakY: [-4, -2, -3, -2],
    transformOrigin: '62% 43%',
  },
  scenes: [
    {
      id: 'event-open',
      kind: 'custom',
      customKey: 'montage',
      start: 0,
      end: 3.4,
      data: {
        eyebrow: 'LANZHOU · 现场',
        title: '首届OPC技能交流大会',
        detail: '大会举办地：兰州',
        items: [
          {src: media('video/L01_stage_red.mp4'), kind: 'video', label: '大会现场实拍'},
        ],
      },
    },
    {
      id: 'local-question',
      kind: 'chapter',
      start: 3.4,
      end: 8.9,
      index: '？',
      eyebrow: 'FOR LOCAL PEOPLE · 兰州本地',
      title: '想学AI，也想真正参与',
      subtitle: '网上信息很多，真正可进入的路径还需要被看见。',
      tone: 'cyan',
    },
    {
      id: 'three-blockers',
      kind: 'info-stack',
      start: 8.9,
      end: 15.9,
      eyebrow: 'THREE QUESTIONS · 三个现实问题',
      title: '参与AI，最容易卡在哪里？',
      items: [
        {label: '实训', detail: '去哪里真正动手', tone: 'cyan'},
        {label: '同行', detail: '去哪里找到协作的人', tone: 'green'},
        {label: '支持', detail: '去哪里了解创业扶持', tone: 'amber'},
      ],
    },
    {
      id: 'event-evidence',
      kind: 'custom',
      customKey: 'montage',
      start: 15.9,
      end: 27.9,
      data: {
        eyebrow: 'POSITIVE CHANGE · 积极变化',
        title: '本地入口，正在出现',
        detail: '从网上听概念，走向在兰州能找到、能参与的现场。',
        items: [
          {src: media('stills/I08_event_01.jpg'), kind: 'image', label: '大会现场照片'},
          {src: media('stills/I09_event_02.jpg'), kind: 'image', label: '大会现场照片'},
          {src: media('stills/I10_event_03.jpg'), kind: 'image', label: '大会现场照片'},
          {src: media('stills/I11_event_04.jpg'), kind: 'image', label: '大会现场照片'},
          {src: media('video/V02_morning_wide.mp4'), kind: 'video', label: '大会现场实拍'},
          {src: media('video/V03_morning_pan.mp4'), kind: 'video', label: '大会现场实拍'},
        ],
      },
    },
    {
      id: 'ai-boom-question',
      kind: 'metric',
      start: 27.9,
      end: 33.9,
      eyebrow: 'AI BOOM · 讨论之外',
      value: '开始了吗？',
      caption: 'AI真正的大爆发，普通人该怎么看',
      tone: 'cyan',
    },
    {
      id: 'macro-signals',
      kind: 'info-stack',
      start: 33.9,
      end: 40.9,
      eyebrow: 'MACRO SIGNALS · 宏观信号',
      title: '大家通常看三件事',
      items: [
        {label: '模型', detail: '能力有没有继续提升'},
        {label: '算力', detail: '基础设施有没有扩张'},
        {label: '用户', detail: '全世界有多少人在使用', tone: 'amber'},
      ],
    },
    {
      id: 'ordinary-view',
      kind: 'truth',
      start: 40.9,
      end: 52.9,
      eyebrow: 'ORDINARY PEOPLE · 更直接的判断',
      left: '网上很热',
      right: '本地能动手',
      note: '你的城市有没有实训场景，也有没有能够一起做事的人。',
    },
    {
      id: 'three-entrances',
      kind: 'process',
      start: 52.9,
      end: 57.9,
      eyebrow: 'THREE ENTRANCES · 三个入口',
      title: '从大会现场，看见参与路径',
      steps: [
        {label: '实训', detail: '先把手动起来', tone: 'cyan'},
        {label: '协作', detail: '找到同行与行业', tone: 'green'},
        {label: '扶持', detail: '关注公开细则', tone: 'amber'},
      ],
    },
    {
      id: 'training-montage',
      kind: 'custom',
      customKey: 'montage',
      start: 57.9,
      end: 93.9,
      data: {
        eyebrow: '01 · TRAINING',
        title: '实训入口',
        detail: '从台上演讲，走到参训者手里的电脑和手机。',
        items: [
          {src: media('video/V_101316_livp.mp4'), kind: 'video', label: '实训现场动态照片'},
          {src: media('stills/I_101316.jpg'), kind: 'image', label: '实训现场照片'},
          {src: media('video/V_101318_livp.mp4'), kind: 'video', label: '实训现场动态照片'},
          {src: media('stills/I_101318.jpg'), kind: 'image', label: '实训现场照片'},
          {src: media('video/V_101321_livp.mp4'), kind: 'video', label: '实训现场动态照片'},
          {src: media('stills/I_101321.jpg'), kind: 'image', label: '实训现场照片'},
          {src: media('video/V_101323_livp.mp4'), kind: 'video', label: '实训现场动态照片'},
          {src: media('stills/I_101323.jpg'), kind: 'image', label: '实训现场照片'},
          {src: media('video/L02_training_screen.mp4'), kind: 'video', label: '大会长视频精选'},
        ],
      },
    },
    {
      id: 'collaboration-montage',
      kind: 'custom',
      customKey: 'montage',
      start: 93.9,
      end: 119.9,
      data: {
        eyebrow: '02 · COLLABORATION',
        title: '协作入口',
        detail: '科技企业、行业组织与AI实践者，在本地形成更具体的连接。',
        items: [
          {src: media('video/V_151111_livp.mp4'), kind: 'video', label: '行业交流动态照片'},
          {src: media('stills/I_151111.jpg'), kind: 'image', label: '行业交流照片'},
          {src: media('video/V_151115_livp.mp4'), kind: 'video', label: '行业交流动态照片'},
          {src: media('stills/I_151115.jpg'), kind: 'image', label: '行业交流照片'},
          {src: media('video/V_151116_livp.mp4'), kind: 'video', label: '行业交流动态照片'},
          {src: media('stills/I_151116.jpg'), kind: 'image', label: '行业交流照片'},
          {src: media('video/L03_industry_screen.mp4'), kind: 'video', label: '大会长视频精选'},
        ],
      },
    },
    {
      id: 'industry-direction',
      kind: 'info-stack',
      start: 119.9,
      end: 129.9,
      eyebrow: 'LOCAL INDUSTRIES · 本地行业',
      title: 'AI不会只停留在科技公司',
      items: [
        {label: '内容', detail: '广告、设计与新媒体', tone: 'cyan'},
        {label: '产业', detail: '制造、农业与更多企业', tone: 'green'},
        {label: '协作', detail: '行业经验连接AI能力', tone: 'amber'},
      ],
    },
    {
      id: 'people-collaborate',
      kind: 'evidence',
      start: 129.9,
      end: 135.9,
      marker: 'FUTURE DIRECTION',
      source: '大会现场观察与口播判断',
      quote: '懂行业的人，和懂AI的人',
      caption: '会有越来越多一起做事的机会。',
      tone: 'green',
    },
    {
      id: 'support-chapter',
      kind: 'chapter',
      start: 135.9,
      end: 142.9,
      index: '03',
      eyebrow: 'SUPPORT · 扶持入口',
      title: 'OPC创业直通车',
      subtitle: '专项扶持计划已经在大会上发布。',
      tone: 'amber',
    },
    {
      id: 'support-media',
      kind: 'annotated-media',
      start: 142.9,
      end: 153.9,
      index: '03',
      eyebrow: 'SUPPORT PLAN',
      title: '专项扶持计划',
      facts: [
        {label: '面向', value: '创业者与从业者'},
        {label: '企业', value: '中小微企业'},
        {label: '内容', value: '政策·技术·实训·资源', tone: 'amber'},
      ],
      mediaSrc: media('video/L04_support_screen.mp4'),
      mediaKind: 'video',
      mediaLabel: '大会长视频精选 · 现场实拍',
      mediaFit: 'cover',
      mediaLoop: true,
    },
    {
      id: 'support-status',
      kind: 'evidence',
      start: 153.9,
      end: 160.9,
      marker: 'CURRENT STATUS',
      source: '本次大会公开信息',
      quote: '扶持计划已经发布',
      caption: '申请条件与运行方式，具体以后续公开信息为准。',
      tone: 'amber',
    },
    {
      id: 'entrance-not-result',
      kind: 'truth',
      start: 160.9,
      end: 170.9,
      eyebrow: 'BOUNDARY · 不提前下结论',
      left: '看到入口',
      right: '已经有结果',
      note: '搭完一个智能体，也不等于已经拥有一家真正能够经营的OPC。',
    },
    {
      id: 'details-and-projects',
      kind: 'evidence',
      start: 170.9,
      end: 178.9,
      marker: 'NEXT CHECK',
      source: '后续验证标准',
      quote: '公开的细则，真实的项目',
      caption: '入口被摆上台面，已经是值得关注的开始。',
      tone: 'cyan',
    },
    {
      id: 'local-three-parts',
      kind: 'process',
      start: 178.9,
      end: 184.9,
      eyebrow: 'LOCAL ECOSYSTEM · 本地路径',
      title: '入口开始形成组合',
      steps: [
        {label: '实训', detail: '能学习能动手', tone: 'cyan'},
        {label: '组织', detail: '能连接行业', tone: 'green'},
        {label: '支持', detail: '正在公开细则', tone: 'amber'},
      ],
    },
    {
      id: 'from-local',
      kind: 'metric',
      start: 184.9,
      end: 193.9,
      eyebrow: 'START LOCAL · 从兰州开始',
      value: '本地',
      suffix: '就是入口',
      caption: 'AI不再只是北上广深发生的新闻',
      facts: ['从自己的城市寻找位置', '从能参与的现场开始判断'],
      tone: 'green',
    },
    {
      id: 'opc-reframe',
      kind: 'truth',
      start: 193.9,
      end: 202.9,
      eyebrow: 'ONE PERSON COMPANY · 重新理解OPC',
      left: '一人公司',
      right: '一个人扛全部',
      note: '组织越轻，越需要外部实训、同行协作和资源连接。',
    },
    {
      id: 'light-organization',
      kind: 'info-stack',
      start: 202.9,
      end: 207.9,
      eyebrow: 'LIGHTER COMPANY · 更轻的组织',
      title: '轻，不等于孤立',
      items: [
        {label: '能力', detail: '外部实训补能力', tone: 'cyan'},
        {label: '伙伴', detail: '同行协作补边界', tone: 'green'},
        {label: '资源', detail: '本地连接补支撑', tone: 'amber'},
      ],
    },
    {
      id: 'action-path',
      kind: 'process',
      start: 207.9,
      end: 217.9,
      eyebrow: 'ACTION · 现在怎么进入',
      title: '按自己的阶段，选择第一步',
      steps: [
        {label: '刚开始', detail: '关注实训，先动手', tone: 'cyan'},
        {label: '有经验', detail: '连接联盟与行业', tone: 'green'},
        {label: '想创业', detail: '盯住后续公开细则', tone: 'amber'},
      ],
    },
    {
      id: 'support-decision',
      kind: 'evidence',
      start: 217.9,
      end: 223.9,
      marker: 'MAKE A DECISION',
      source: '参与前的判断顺序',
      quote: '先看公开细则，再决定是否适合',
      caption: '积极参与，也保留事实边界。',
      tone: 'amber',
    },
    {
      id: 'lighter-future',
      kind: 'metric',
      start: 223.9,
      end: 232.9,
      eyebrow: 'AI FUTURE · 更轻的公司',
      value: '1个人',
      caption: '调用更多工具、伙伴和本地资源',
      facts: ['组织越来越轻', '可调用的外部能力越来越多'],
      tone: 'cyan',
    },
    {
      id: 'closing-media',
      kind: 'annotated-media',
      start: 232.9,
      end: 238.9,
      index: '→',
      eyebrow: 'FROM EVENT TO DAILY WORK',
      title: 'AI进入本地日常',
      facts: [
        {label: '培训', value: '从听到动手'},
        {label: '行业', value: '从关注到协作'},
        {label: '创业', value: '从入口到验证', tone: 'green'},
      ],
      mediaSrc: media('video/L05_closing_screen.mp4'),
      mediaKind: 'video',
      mediaLabel: '大会长视频精选 · 现场实拍',
      mediaFit: 'cover',
      mediaLoop: true,
    },
    {
      id: 'not-far-away',
      kind: 'info-stack',
      start: 238.9,
      end: 245.9,
      eyebrow: 'NOT FAR AWAY · 不再站在远处看',
      title: '入口已经出现在自己的城市',
      items: [
        {label: '实训', detail: '把手动起来', tone: 'cyan'},
        {label: '协作', detail: '找到一起做事的人', tone: 'green'},
        {label: '创业', detail: '关注真实参与机会', tone: 'amber'},
      ],
    },
    {
      id: 'cta',
      kind: 'chapter',
      start: 245.9,
      end: 250.9,
      index: '？',
      eyebrow: 'YOUR NEXT STEP · 你的下一步',
      title: '你现在最需要哪一个？',
      subtitle: '实训、协作，还是创业入口？评论区告诉我。',
      tone: 'amber',
    },
    {
      id: 'continue-following',
      kind: 'annotated-media',
      start: 250.9,
      end: 257.9,
      index: '＋',
      eyebrow: 'KEEP FOLLOWING · 持续跟进',
      title: '从一场大会，到真实机会',
      facts: [
        {label: '继续看', value: '入口如何落地'},
        {label: '继续验', value: '谁能真实参与'},
        {label: '继续讲', value: '兰州AI创业', tone: 'amber'},
      ],
      mediaSrc: media('video/L05_closing_screen.mp4'),
      mediaKind: 'video',
      mediaLabel: '大会现场实拍',
      mediaFit: 'cover',
      mediaLoop: true,
    },
  ],
  sfxCues: [
    {id: 'sfx-001', time: 0.15, file: 'section-sweep.wav', volume: 0.14},
    {id: 'sfx-002', time: 8.9, file: 'card-slide.wav', volume: 0.14},
    {id: 'sfx-003', time: 15.9, file: 'evidence-shutter.wav', volume: 0.12},
    {id: 'sfx-004', time: 20.9, file: 'keyword-select.wav', volume: 0.09},
    {id: 'sfx-005', time: 27.9, file: 'section-sweep.wav', volume: 0.12},
    {id: 'sfx-006', time: 40.9, file: 'zoom-out.wav', volume: 0.1},
    {id: 'sfx-007', time: 52.9, file: 'node-select.wav', volume: 0.1},
    {id: 'sfx-008', time: 55.9, file: 'keyword-select.wav', volume: 0.09},
    {id: 'sfx-009', time: 57.9, file: 'section-sweep.wav', volume: 0.14},
    {id: 'sfx-010', time: 64.9, file: 'ui-click.wav', volume: 0.08},
    {id: 'sfx-011', time: 72.9, file: 'evidence-shutter.wav', volume: 0.1},
    {id: 'sfx-012', time: 78.9, file: 'node-select.wav', volume: 0.08},
    {id: 'sfx-013', time: 89.9, file: 'zoom-out.wav', volume: 0.09},
    {id: 'sfx-014', time: 93.9, file: 'section-sweep.wav', volume: 0.14},
    {id: 'sfx-015', time: 100.9, file: 'evidence-shutter.wav', volume: 0.1},
    {id: 'sfx-016', time: 104.9, file: 'ui-click.wav', volume: 0.08},
    {id: 'sfx-017', time: 111.9, file: 'node-select.wav', volume: 0.08},
    {id: 'sfx-018', time: 119.9, file: 'section-sweep.wav', volume: 0.12},
    {id: 'sfx-019', time: 124.9, file: 'keyword-select.wav', volume: 0.08},
    {id: 'sfx-020', time: 129.9, file: 'card-slide.wav', volume: 0.12},
    {id: 'sfx-021', time: 135.9, file: 'section-sweep.wav', volume: 0.14},
    {id: 'sfx-022', time: 137.9, file: 'keyword-select.wav', volume: 0.08},
    {id: 'sfx-023', time: 142.9, file: 'evidence-shutter.wav', volume: 0.12},
    {id: 'sfx-024', time: 147.9, file: 'node-select.wav', volume: 0.08},
    {id: 'sfx-025', time: 153.9, file: 'section-sweep.wav', volume: 0.12},
    {id: 'sfx-026', time: 160.9, file: 'zoom-out.wav', volume: 0.1},
    {id: 'sfx-027', time: 170.9, file: 'ui-click.wav', volume: 0.08},
    {id: 'sfx-028', time: 178.9, file: 'section-sweep.wav', volume: 0.12},
    {id: 'sfx-029', time: 193.9, file: 'zoom-out.wav', volume: 0.1},
    {id: 'sfx-030', time: 207.9, file: 'section-sweep.wav', volume: 0.12},
    {id: 'sfx-031', time: 223.9, file: 'number-affirmation.wav', volume: 0.12},
    {id: 'sfx-032', time: 232.9, file: 'evidence-shutter.wav', volume: 0.1},
    {id: 'sfx-033', time: 238.9, file: 'zoom-out.wav', volume: 0.09},
    {id: 'sfx-034', time: 245.9, file: 'card-slide.wav', volume: 0.12},
    {id: 'sfx-035', time: 250.9, file: 'section-sweep.wav', volume: 0.1},
    {id: 'sfx-036', time: 257.9, file: 'keyword-select.wav', volume: 0.08},
  ],
};

const renderCustomScene = (scene: V72CustomScene) => {
  if (scene.customKey !== 'montage' || !scene.data) {
    return null;
  }
  return <MediaMontage data={scene.data as MontageData} />;
};

const LanzhouOpcV72Talk16x9: React.FC<{soundEnabled: boolean}> = ({
  soundEnabled,
}) => (
  <AbsoluteFill>
    <V72ProductionShell
      config={config}
      soundEnabled={soundEnabled}
      renderCustomScene={renderCustomScene}
    />
    <TopicBar />
  </AbsoluteFill>
);

export const LanzhouOpcV72Talk16x9WithSfx: React.FC = () => (
  <LanzhouOpcV72Talk16x9 soundEnabled />
);

export const LanzhouOpcV72Talk16x9NoSfx: React.FC = () => (
  <LanzhouOpcV72Talk16x9 soundEnabled={false} />
);
