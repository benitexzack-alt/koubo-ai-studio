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
const durationSeconds = 351.666667;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const TRUST_V72_DURATION_IN_FRAMES = f(durationSeconds);

type FullScreenVideoData = {
  src: string;
  playbackRate?: number;
  fit?: 'cover' | 'contain';
};

type ProjectItem = {
  src: string;
  label: string;
  fit?: 'cover' | 'contain';
};

type ProjectMontageData = {
  eyebrow: string;
  title: string;
  detail: string;
  items: ProjectItem[];
};

type DocumentEvidenceData = {
  imageSrc: string;
  marker: string;
  source: string;
  title: string;
  conclusion: string;
  boundary: string;
};

const sceneOpacity = (frame: number, durationInFrames: number) => {
  const fade = Math.min(10, Math.max(5, Math.round(durationInFrames * 0.08)));
  return Math.min(
    interpolate(frame, [0, fade], [0, 1], clamp),
    interpolate(
      frame,
      [Math.max(fade, durationInFrames - fade), durationInFrames],
      [1, 0],
      clamp,
    ),
  );
};

const FullScreenMotion: React.FC<{data: FullScreenVideoData}> = ({data}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const scale = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    data.fit === 'contain' ? [1, 1.025] : [1.01, 1.045],
    clamp,
  );

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#05090D', opacity}}>
      <Video
        src={staticFile(data.src)}
        muted
        loop
        playbackRate={data.playbackRate ?? 1}
        objectFit={data.fit ?? 'cover'}
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${scale})`,
          transformOrigin: '50% 46%',
        }}
      />
    </AbsoluteFill>
  );
};

const ProjectClip: React.FC<{
  item: ProjectItem;
  index: number;
  count: number;
}> = ({item, index, count}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const scale = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    item.fit === 'contain' ? [1.01, 1.045] : [1.035, 1.085],
    clamp,
  );
  const x = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    index % 2 === 0 ? [0, -12] : [-9, 4],
    clamp,
  );

  return (
    <AbsoluteFill style={{background: '#03070B', opacity}}>
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
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.58) 0%, rgba(2,7,12,0.13) 48%, rgba(2,7,12,0.02) 78%), linear-gradient(180deg, rgba(2,7,12,0.12), transparent 58%, rgba(2,7,12,0.30))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 58,
          top: 86,
          padding: '8px 12px',
          border: '1px solid rgba(98,216,255,0.46)',
          background: 'rgba(3,8,12,0.70)',
          color: '#F7FAFC',
          fontFamily,
          fontSize: 17,
          fontWeight: 900,
        }}
      >
        {item.label} · {String(index + 1).padStart(2, '0')}/
        {String(count).padStart(2, '0')}
      </div>
    </AbsoluteFill>
  );
};

const ProjectMontage: React.FC<{data: ProjectMontageData}> = ({data}) => {
  const {durationInFrames} = useVideoConfig();
  const itemFrames = Math.max(1, Math.floor(durationInFrames / data.items.length));
  const overlap = Math.min(10, Math.max(5, Math.round(itemFrames * 0.14)));

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
            premountFor={8}
            style={{zIndex: index + 1}}
          >
            <ProjectClip item={item} index={index} count={data.items.length} />
          </Sequence>
        );
      })}
      <div
        style={{
          position: 'absolute',
          zIndex: 80,
          left: 62,
          top: 100,
          width: 680,
          color: '#F7FAFC',
          fontFamily,
          textShadow: '0 5px 28px rgba(0,0,0,0.98)',
        }}
      >
        <div style={{color: '#62D8FF', fontSize: 18, fontWeight: 950}}>
          {data.eyebrow}
        </div>
        <div style={{marginTop: 10, fontSize: 48, lineHeight: 1.08, fontWeight: 950}}>
          {data.title}
        </div>
        <div
          style={{
            marginTop: 17,
            width: 600,
            borderLeft: '4px solid #FFBE55',
            paddingLeft: 15,
            color: 'rgba(247,250,252,0.90)',
            fontSize: 24,
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

const DocumentEvidence: React.FC<{data: DocumentEvidenceData}> = ({data}) => {
  const frame = useCurrentFrame();
  const {fps: currentFps, durationInFrames} = useVideoConfig();
  const opacity = sceneOpacity(frame, durationInFrames);
  const imageIn = interpolate(frame, [0, currentFps * 0.45], [0, 1], clamp);
  const textIn = interpolate(
    frame,
    [currentFps * 0.22, currentFps * 0.8],
    [0, 1],
    clamp,
  );

  return (
    <AbsoluteFill style={{opacity, fontFamily, color: '#F7FAFC'}}>
      <div
        style={{
          position: 'absolute',
          left: 52,
          top: 112,
          width: 930,
          height: 690,
          border: '1px solid rgba(98,216,255,0.38)',
          background: 'rgba(3,9,14,0.58)',
          boxShadow: '0 24px 72px rgba(0,0,0,0.46)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(110deg, rgba(98,216,255,0.09), transparent 44%, rgba(255,190,85,0.05))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 28,
            top: 28,
            bottom: 28,
            width: 286,
            padding: 18,
            boxSizing: 'border-box',
            border: '1px solid rgba(255,255,255,0.13)',
            background: '#F4F5F7',
            opacity: imageIn,
            transform: `translateY(${interpolate(imageIn, [0, 1], [22, 0])}px)`,
          }}
        >
          <Img
            src={staticFile(data.imageSrc)}
            style={{width: '100%', height: '100%', objectFit: 'contain'}}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 344,
            right: 30,
            top: 42,
            opacity: textIn,
            transform: `translateX(${interpolate(textIn, [0, 1], [24, 0])}px)`,
          }}
        >
          <div style={{color: '#62D8FF', fontSize: 17, fontWeight: 950}}>
            {data.marker} · {data.source}
          </div>
          <div style={{marginTop: 22, fontSize: 44, lineHeight: 1.12, fontWeight: 950}}>
            {data.title}
          </div>
          <div
            style={{
              marginTop: 28,
              padding: '20px 22px',
              borderLeft: '5px solid #66E39A',
              background: 'rgba(102,227,154,0.08)',
              fontSize: 27,
              lineHeight: 1.3,
              fontWeight: 900,
            }}
          >
            {data.conclusion}
          </div>
          <div
            style={{
              marginTop: 24,
              paddingTop: 18,
              borderTop: '2px solid rgba(255,105,120,0.56)',
              color: 'rgba(247,250,252,0.86)',
              fontSize: 23,
              lineHeight: 1.3,
              fontWeight: 850,
            }}
          >
            边界：{data.boundary}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const media = (name: string) => `media/trust-asset-20260802/${name}`;

const projectMedia = {
  knowledgeBase: 'media/two-ledgers-20260722/personal-kb-graph-cropped-30fps.mp4',
  jinshiyuan:
    'media/hokkaido-three-projects-20260725/jinshiyuan/J01-entry-form-crop.mp4',
  bo2: 'media/hokkaido-three-projects-20260725/bo2/B02-ai-poster-flow.mp4',
  dazhi:
    'media/hokkaido-three-projects-20260725/dazhi/D03-refine-and-multiview.mp4',
  jinshiyuanReview:
    'media/hokkaido-three-projects-20260725/jinshiyuan/J03-admin-review-number.mp4',
  bo2Points:
    'media/hokkaido-three-projects-20260725/bo2/B03-points-record.mp4',
  dazhiWriteback:
    'media/hokkaido-three-projects-20260725/dazhi/D05-knowledge-writeback.mp4',
};

const config: V72ProductionConfig = {
  durationSeconds,
  sourceVideo: media('TRUST_20260802_talk01_30fps_loudness.mp4'),
  captionsSrc: 'data/TRUST_20260802_talk01.bilingual.v1.json',
  brandLabel: '超哥AI创业记',
  sourceFilter: 'contrast(1.035) saturate(1.025) brightness(1.01)',
  sourceOverlay:
    'linear-gradient(90deg, rgba(2,7,12,0.24) 0%, rgba(2,7,12,0.04) 48%, rgba(2,7,12,0.01) 78%)',
  motion: {
    cuts: [
      0, 6.4, 16.64, 27.14, 30.86, 38.38, 44.26, 57.08, 66.53,
      72.44, 79.08, 86.92, 95.45, 101.88, 110.6, 122.36, 133.62,
      141.8, 149.98, 159.74, 168.68, 174.84, 186.24, 194.04, 201.96,
      211.84, 222.96, 231.9, 240.6, 253.66, 260.32, 269.68, 278.24,
      288.48, 293.08, 304.86, 309.98, 322.77, 331.24, 343, 349.12,
      durationSeconds,
    ],
    baseScale: 1.018,
    peakScales: [1.052, 1.057, 1.049, 1.055],
    peakX: [-11, -6, 7, -9],
    peakY: [-3, -2, -3, -1],
    transformOrigin: '56% 40%',
  },
  scenes: [
    {
      id: 'hook-tools-not-money',
      kind: 'truth',
      start: 0.1,
      end: 6.4,
      eyebrow: 'AI工具 · 结果边界',
      left: '掌握工具',
      right: '自动赚到钱',
      note: '真正的问题，是工具之后有没有真实分发、使用和验证。',
    },
    {
      id: 'store-scenario',
      kind: 'custom',
      customKey: 'full-screen-motion',
      start: 6.4,
      end: 16.64,
      background: 'opaque',
      data: {
        src: media('01-store-output-no-response-v1.mp4'),
        playbackRate: 0.78,
      },
    },
    {
      id: 'opc-scenario',
      kind: 'custom',
      customKey: 'full-screen-motion',
      start: 16.64,
      end: 27.14,
      background: 'opaque',
      data: {
        src: media('02-opc-demo-low-adoption-v1.mp4'),
        playbackRate: 0.76,
      },
    },
    {
      id: 'platform-integration',
      kind: 'evidence',
      start: 27.14,
      end: 30.86,
      marker: '趋势判断',
      source: '依据实际口述，不作确定预测',
      quote: '同质化功能，平台很快就能整合',
      caption: '通用功能可以是入场能力，很难单独成为长期壁垒。',
      tone: 'amber',
      style: {top: 126, width: 870},
    },
    {
      id: 'core-question',
      kind: 'chapter',
      start: 30.86,
      end: 38.38,
      index: '？',
      eyebrow: '真正属于你的是什么',
      title: '普通人的AI资产',
      subtitle: '当工具和模板越来越容易获得，什么还能真正留在你手里？',
      tone: 'cyan',
    },
    {
      id: 'creation-chapter',
      kind: 'chapter',
      start: 38.38,
      end: 44.26,
      index: '01',
      eyebrow: 'CREATION · 创造',
      title: '创作门槛持续下降',
      subtitle: '先看设备、团队、手机和AI如何改变生产成本。',
      tone: 'cyan',
    },
    {
      id: 'creation-cost-path',
      kind: 'process',
      start: 44.26,
      end: 57.08,
      eyebrow: 'CREATION COST · 创作成本',
      title: '每一次入口变化，都让更多人能做出来',
      steps: [
        {label: '过去', detail: '设备·团队·后期', tone: 'amber'},
        {label: '手机', detail: '普通人随手创作', tone: 'cyan'},
        {label: 'AI', detail: '文案·图片·视频·程序', tone: 'green'},
        {label: '结果', detail: '创作门槛继续下降', tone: 'green'},
      ],
      style: {top: 116, transform: 'scale(0.9)', transformOrigin: 'left top'},
    },
    {
      id: 'productivity-evidence',
      kind: 'custom',
      customKey: 'document-evidence',
      start: 57.08,
      end: 66.53,
      data: {
        imageSrc: media('05-nber-generative-ai-at-work-cover.png'),
        marker: '研究依据',
        source: 'NBER Working Paper 31161',
        title: 'AI能加快部分任务',
        conclusion: '特定客服现场实验观察到，AI辅助与平均生产率提升相关。',
        boundary: '不同任务和人群效果不同，不能外推为覆盖所有工作。',
      },
    },
    {
      id: 'creation-boundary',
      kind: 'metric',
      start: 66.53,
      end: 72.44,
      eyebrow: '能够成立的结论',
      value: '更低',
      suffix: '创作门槛',
      caption: 'AI继续压低创作环节的门槛',
      facts: ['不等于覆盖所有工作', '不等于自动解决分发'],
      tone: 'green',
      style: {top: 120},
    },
    {
      id: 'distribution-problem',
      kind: 'info-stack',
      start: 72.44,
      end: 95.45,
      eyebrow: 'DISTRIBUTION · 分发',
      title: '做出来以后，还有三道判断',
      items: [
        {label: '平台', detail: '算法排序、筛选、推送', tone: 'cyan'},
        {label: '路人', detail: '有没有停下来观看', tone: 'amber'},
        {label: '用户', detail: '是否存在痛点并持续使用', tone: 'green'},
      ],
      style: {top: 116},
    },
    {
      id: 'three-gates',
      kind: 'custom',
      customKey: 'full-screen-motion',
      start: 95.45,
      end: 101.88,
      background: 'opaque',
      data: {
        src: media('03-three-gates-v1.mp4'),
        playbackRate: 1,
      },
    },
    {
      id: 'copy-chapter',
      kind: 'chapter',
      start: 101.88,
      end: 110.6,
      index: '02',
      eyebrow: 'COPY · 复制',
      title: '先入场，确实有阶段价值',
      subtitle: '新工具刚出现时，抢先掌握方法可以换来一段短暂窗口。',
      tone: 'amber',
    },
    {
      id: 'early-bird-ticket',
      kind: 'chapter',
      start: 110.6,
      end: 122.36,
      index: '→',
      eyebrow: 'EARLY ACCESS · 信息差',
      title: '一张早鸟入场券',
      subtitle: '可以帮助你更早进场，但它不是永久护城河。',
      tone: 'amber',
      style: {top: 132},
    },
    {
      id: 'copy-spread',
      kind: 'info-stack',
      start: 122.36,
      end: 141.8,
      eyebrow: 'COPY SPEED · 复制加速',
      title: '领先优势为什么很快被抹平',
      items: [
        {label: '文案', detail: '表达方式被模仿', tone: 'cyan'},
        {label: '工作流', detail: '操作步骤被拆解', tone: 'green'},
        {label: '通用功能', detail: '短时间涌现同类产品', tone: 'amber'},
        {label: '模板', detail: '教程扩散后无限复用', tone: 'red'},
      ],
      style: {top: 94, transform: 'scale(0.9)', transformOrigin: 'left top'},
    },
    {
      id: 'what-remains',
      kind: 'chapter',
      start: 141.8,
      end: 149.98,
      index: '？',
      eyebrow: '红利窗口还在',
      title: '你沉淀下了什么',
      subtitle: '真正需要盘点的，不只是这一波还能赚多久。',
      tone: 'cyan',
    },
    {
      id: 'middle-layer',
      kind: 'truth',
      start: 149.98,
      end: 168.68,
      eyebrow: '趋势判断 · 通用中间层',
      left: '能做出来',
      right: '长期壁垒',
      note: '一个按钮、一套话术和标准化功能，都可能被复制或整合。',
    },
    {
      id: 'trust-answer',
      kind: 'chapter',
      start: 168.68,
      end: 174.84,
      index: '03',
      eyebrow: '真正值得守住',
      title: '信任',
      subtitle: '不是一句口号，而是一组能供别人客观判断的证据。',
      tone: 'amber',
    },
    {
      id: 'trust-distribution',
      kind: 'process',
      start: 174.84,
      end: 194.04,
      eyebrow: 'TRUST × DISTRIBUTION · 信任与分发',
      title: '被推到面前，不等于被相信',
      steps: [
        {label: '内容', detail: '作品或产品出现', tone: 'cyan'},
        {label: '平台', detail: '排序筛选后推送', tone: 'cyan'},
        {label: '观众', detail: '点进来开始判断', tone: 'amber'},
        {label: '证据', detail: '支撑客观评估', tone: 'green'},
      ],
      style: {top: 112, transform: 'scale(0.9)', transformOrigin: 'left top'},
    },
    {
      id: 'enough-material',
      kind: 'evidence',
      start: 194.04,
      end: 201.96,
      marker: '现实问题',
      source: '不是算法天然偏爱真实',
      quote: '你有没有足够完整的素材',
      caption: '让进入内容的人，有证据对你作出客观判断。',
      tone: 'green',
    },
    {
      id: 'build-in-public-definition',
      kind: 'chapter',
      start: 201.96,
      end: 211.84,
      index: 'BIP',
      eyebrow: 'BUILD IN PUBLIC · 公开真实过程',
      title: '不是完美人设，也不是生活流水账',
      subtitle: '它公开的是一件真实事情如何被尝试、纠错、验证和迭代。',
      tone: 'cyan',
      style: {top: 126, transform: 'scale(0.86)', transformOrigin: 'left top'},
    },
    {
      id: 'build-in-public-timeline',
      kind: 'custom',
      customKey: 'full-screen-motion',
      start: 211.84,
      end: 222.96,
      background: 'opaque',
      data: {
        src: media('04-verifiable-timeline-v1.mp4'),
        playbackRate: 0.63,
      },
    },
    {
      id: 'personal-history',
      kind: 'custom',
      customKey: 'project-montage',
      start: 222.96,
      end: 231.9,
      background: 'opaque',
      data: {
        eyebrow: '真实项目记录',
        title: '碎片串成个人历史',
        detail: '这里只证明持续记录和迭代发生过，不包装成商业成功。',
        items: [
          {src: projectMedia.knowledgeBase, label: '个人知识库', fit: 'contain'},
          {src: projectMedia.jinshiyuan, label: '今石缘项目过程', fit: 'contain'},
          {src: projectMedia.bo2, label: 'BO2项目过程', fit: 'contain'},
          {src: projectMedia.dazhi, label: '大志设计过程', fit: 'contain'},
        ],
      },
    },
    {
      id: 'presence-boundary',
      kind: 'truth',
      start: 231.9,
      end: 240.6,
      eyebrow: '关键边界 · 在场与信任',
      left: '持续在场',
      right: '自动获得信任',
      note: '持续更新和露面只是原材料，最终还要看披露是否合适、证据是否可核验。',
    },
    {
      id: 'disclosure-evidence',
      kind: 'evidence',
      start: 240.6,
      end: 260.32,
      marker: '研究边界',
      source: 'Wiley · Consumer Behaviour',
      quote: '公开越多，不等于可信度越高',
      caption: '披露是否适合语境，会影响受众对披露者的评价和可信度感知。',
      tone: 'amber',
    },
    {
      id: 'copyable-vs-history',
      kind: 'custom',
      customKey: 'project-montage',
      start: 260.32,
      end: 278.24,
      background: 'opaque',
      data: {
        eyebrow: '难以短期补齐',
        title: '问题、判断、失败与检验',
        detail: '标题和功能可以模仿，完整做事历程需要在真实场景里一点点留下。',
        items: [
          {src: projectMedia.jinshiyuan, label: '需求输入', fit: 'contain'},
          {src: projectMedia.jinshiyuanReview, label: '审核与编号', fit: 'contain'},
          {src: projectMedia.bo2, label: '方案迭代', fit: 'contain'},
          {src: projectMedia.bo2Points, label: '流程记录', fit: 'contain'},
          {src: projectMedia.dazhi, label: '设计精化', fit: 'contain'},
          {src: projectMedia.dazhiWriteback, label: '知识回写', fit: 'contain'},
        ],
      },
    },
    {
      id: 'ai-media-engine',
      kind: 'info-stack',
      start: 278.24,
      end: 293.08,
      eyebrow: 'AI × 自媒体 · 两种能力',
      title: '三样东西，各自解决不同问题',
      items: [
        {label: 'AI', detail: '降低创作成本', tone: 'cyan'},
        {label: '信息差', detail: '提供早期入场门票', tone: 'amber'},
        {label: '自媒体', detail: '让探索过程被外界看见', tone: 'green'},
      ],
      style: {top: 112},
    },
    {
      id: 'long-term-asset',
      kind: 'info-stack',
      start: 293.08,
      end: 309.98,
      eyebrow: 'LONG-TERM ASSET · 长期资产',
      title: '一条完整、可核验的时间线',
      items: [
        {label: '真实', detail: '扎根真实问题', tone: 'cyan'},
        {label: '核验', detail: '能供外人检查', tone: 'green'},
        {label: '边界', detail: '敢标注这里尚未验证', tone: 'amber'},
        {label: '连续', detail: '相关记录串成完整历程', tone: 'green'},
      ],
      style: {top: 90, transform: 'scale(0.9)', transformOrigin: 'left top'},
    },
    {
      id: 'long-term-boundary',
      kind: 'truth',
      start: 309.98,
      end: 322.77,
      eyebrow: '不作结果承诺',
      left: '完整时间线',
      right: '保证流量和成交',
      note: '它真正增加的，是别人评估你、信任你时能够看到的证据。',
    },
    {
      id: 'final-action',
      kind: 'info-stack',
      start: 322.77,
      end: 343,
      eyebrow: 'ACTION · 现在就开始',
      title: '给每个项目留下三项记录',
      items: [
        {label: '做过', detail: '你实际做过什么', tone: 'cyan'},
        {label: '待验', detail: '哪些方面值得验证', tone: 'amber'},
        {label: '未验', detail: '哪些方面依旧没有验证', tone: 'red'},
      ],
      style: {top: 112},
    },
    {
      id: 'comment-and-brand-close',
      kind: 'chapter',
      start: 343,
      end: durationSeconds,
      index: '？',
      eyebrow: '评论区聊聊',
      title: '你目前最大的卡点是什么',
      subtitle: '我是超哥，在兰州AI创业。',
      tone: 'amber',
    },
  ],
  sfxCues: [
    {id: 'sfx-001', time: 0.12, file: 'section-sweep.wav', volume: 0.11},
    {id: 'sfx-002', time: 6.4, file: 'card-slide.wav', volume: 0.13},
    {id: 'sfx-003', time: 16.64, file: 'card-slide.wav', volume: 0.12},
    {id: 'sfx-004', time: 30.86, file: 'section-sweep.wav', volume: 0.11},
    {id: 'sfx-005', time: 44.26, file: 'node-select.wav', volume: 0.08},
    {id: 'sfx-006', time: 57.08, file: 'evidence-shutter.wav', volume: 0.1},
    {id: 'sfx-007', time: 72.44, file: 'zoom-out.wav', volume: 0.08},
    {id: 'sfx-008', time: 95.45, file: 'node-select.wav', volume: 0.1},
    {id: 'sfx-009', time: 101.88, file: 'section-sweep.wav', volume: 0.1},
    {id: 'sfx-010', time: 119.7, file: 'keyword-select.wav', volume: 0.08},
    {id: 'sfx-011', time: 141.8, file: 'zoom-out.wav', volume: 0.08},
    {id: 'sfx-012', time: 173.03, file: 'number-affirmation.wav', volume: 0.12},
    {id: 'sfx-013', time: 201.96, file: 'section-sweep.wav', volume: 0.1},
    {id: 'sfx-014', time: 211.84, file: 'node-select.wav', volume: 0.09},
    {id: 'sfx-015', time: 240.6, file: 'evidence-shutter.wav', volume: 0.1},
    {id: 'sfx-016', time: 260.32, file: 'card-slide.wav', volume: 0.1},
    {id: 'sfx-017', time: 278.24, file: 'section-sweep.wav', volume: 0.09},
    {id: 'sfx-018', time: 293.08, file: 'section-sweep.wav', volume: 0.1},
    {id: 'sfx-019', time: 322.77, file: 'keyword-select.wav', volume: 0.09},
    {id: 'sfx-020', time: 343, file: 'card-slide.wav', volume: 0.1},
  ],
};

const renderCustomScene = (scene: V72CustomScene) => {
  if (!scene.data) {
    return null;
  }
  if (scene.customKey === 'full-screen-motion') {
    return <FullScreenMotion data={scene.data as FullScreenVideoData} />;
  }
  if (scene.customKey === 'project-montage') {
    return <ProjectMontage data={scene.data as ProjectMontageData} />;
  }
  if (scene.customKey === 'document-evidence') {
    return <DocumentEvidence data={scene.data as DocumentEvidenceData} />;
  }
  return null;
};

const TrustV72Talk16x9: React.FC<{soundEnabled: boolean}> = ({soundEnabled}) => (
  <V72ProductionShell
    config={config}
    soundEnabled={soundEnabled}
    renderCustomScene={renderCustomScene}
  />
);

export const TrustV72Talk16x9WithSfx: React.FC = () => (
  <TrustV72Talk16x9 soundEnabled />
);

export const TrustV72Talk16x9NoSfx: React.FC = () => (
  <TrustV72Talk16x9 soundEnabled={false} />
);
