import {Audio, Video} from '@remotion/media';
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
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

export const DAZHI_FORMAL_DURATION_IN_FRAMES = 10999;

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

const DazhiTalkFootage: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const keyframes = [
    0, 11, 22, 33, 51, 61, 74, 85, 101, 113, 128, 140, 151, 160, 176, 190, 202,
    219, 242, 266, 281, 296, 318, 341, 351, 366.63,
  ];
  const scale = interpolate(
    seconds,
    keyframes,
    [
      1.03, 1.055, 1.035, 1.052, 1.034, 1.05, 1.038, 1.055, 1.035, 1.05, 1.04,
      1.06, 1.04, 1.055, 1.035, 1.05, 1.038, 1.055, 1.035, 1.05, 1.04, 1.058,
      1.035, 1.05, 1.04, 1.055,
    ],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const x = interpolate(
    seconds,
    keyframes,
    [
      -6, 8, -2, 8, -4, 7, 0, 8, -3, 7, 0, 8, -2, 6, 0, 8, -4, 6, 0, 7, -3,
      8, 0, 7, -2, 6,
    ],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const yBase = interpolate(
    seconds,
    keyframes,
    [
      0, -4, 1, -3, 0, -4, 1, -3, 0, -4, 1, -3, 0, -4, 1, -3, 0, -4, 1, -3,
      0, -4, 1, -3, 0, -4,
    ],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: colors.dark}}>
      <Video
        src={staticFile('media/dazhi-20260721/main-30fps.mp4')}
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(1.04) saturate(1.035) brightness(1.01)',
          transform: `translate3d(${x}px, ${yBase + Math.sin(seconds * 0.28) * 1.3}px, 0) scale(${scale})`,
          transformOrigin: '52% 38%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.12) 0%, rgba(2,7,12,0.01) 54%, rgba(2,7,12,0.08) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const PersonIntroduction: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity(10);
  const titleIn = spring({fps: localFps, frame: frame - 4, config: {damping: 19, stiffness: 170}});
  const subtitleIn = spring({fps: localFps, frame: frame - 18, config: {damping: 21, stiffness: 165}});
  const line = interpolate(frame, [8, 32], [0, 1], clamp);

  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        top: 170,
        width: 690,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 24px rgba(0,0,0,0.96)',
      }}
    >
      <V7LocalContrastVeil strength={0.64} width={850} />
      <div style={{position: 'relative'}}>
        <div
          style={{
            color: colors.cyan,
            fontSize: 18,
            fontWeight: 900,
            opacity: titleIn,
          }}
        >
          PORTRAIT · 本地设计实践
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 78,
            lineHeight: 1,
            fontWeight: 950,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [22, 0])}px)`,
          }}
        >
          设计师大志
        </div>
        <div
          style={{
            marginTop: 18,
            width: `${line * 520}px`,
            height: 5,
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.amber})`,
            boxShadow: '0 0 20px rgba(98,216,255,0.48)',
          }}
        />
        <div
          style={{
            marginTop: 18,
            color: colors.amber,
            fontSize: 36,
            lineHeight: 1.16,
            fontWeight: 950,
            opacity: subtitleIn,
            transform: `translateX(${interpolate(subtitleIn, [0, 1], [-18, 0])}px)`,
          }}
        >
          用AI锁住自己的灵感
        </div>
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            gap: 12,
            opacity: subtitleIn,
            color: 'rgba(247,250,252,0.82)',
            fontSize: 19,
            fontWeight: 850,
          }}
        >
          {['商业空间', '酒吧设计', '灵感产品化'].map((item) => (
            <div
              key={item}
              style={{
                padding: '8px 12px',
                borderLeft: `3px solid ${colors.cyan}`,
                background: 'rgba(2,7,12,0.30)',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

type MediaFact = {label: string; value: string; tone?: keyof typeof colors};

const MediaTakeover: React.FC<{
  index: string;
  eyebrow: string;
  title: string;
  facts: MediaFact[];
  mediaSrc: string;
  mediaKind: 'video' | 'image';
  mediaLabel: string;
  mediaFit?: 'cover' | 'contain';
  mediaBackground?: string;
}> = ({
  index,
  eyebrow,
  title,
  facts,
  mediaSrc,
  mediaKind,
  mediaLabel,
  mediaFit = 'cover',
  mediaBackground = colors.dark,
}) => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opacity = useSceneOpacity(8);
  const railIn = spring({fps: localFps, frame, config: {damping: 20, stiffness: 175}});
  const mediaIn = spring({fps: localFps, frame: frame - 5, config: {damping: 20, stiffness: 170}});
  const mediaScale = interpolate(frame, [0, 240], [1.01, 1.045], clamp);

  return (
    <AbsoluteFill style={{background: colors.dark, color: colors.ink, fontFamily, opacity}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 70% 45%, rgba(98,216,255,0.09), transparent 42%), linear-gradient(180deg, #070D13, #020508)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 52,
          top: 120,
          width: 330,
          height: 720,
          opacity: railIn,
          transform: `translateX(${interpolate(railIn, [0, 1], [-22, 0])}px)`,
          textShadow: '0 4px 20px rgba(0,0,0,0.96)',
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
          <div style={{color: colors.cyan, fontSize: 62, lineHeight: 1, fontWeight: 950}}>{index}</div>
          <div style={{color: colors.cyan, fontSize: 16, fontWeight: 900}}>{eyebrow}</div>
        </div>
        <div style={{marginTop: 12, fontSize: 37, lineHeight: 1.12, fontWeight: 950}}>{title}</div>
        <div style={{marginTop: 28, display: 'grid', gap: 20}}>
          {facts.map((fact, factIndex) => {
            const factIn = spring({
              fps: localFps,
              frame: frame - 12 - factIndex * 10,
              config: {damping: 21, stiffness: 170},
            });
            const tone = colors[fact.tone ?? (factIndex === facts.length - 1 ? 'amber' : 'ink')];
            return (
              <div
                key={`${fact.label}-${factIndex}`}
                style={{
                  opacity: factIn,
                  borderLeft: `3px solid ${tone}`,
                  paddingLeft: 13,
                  transform: `translateX(${interpolate(factIn, [0, 1], [-13, 0])}px)`,
                }}
              >
                <div style={{color: 'rgba(247,250,252,0.58)', fontSize: 15, fontWeight: 850}}>{fact.label}</div>
                <div style={{marginTop: 5, color: tone, fontSize: 27, lineHeight: 1.12, fontWeight: 950}}>{fact.value}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 414,
          top: 68,
          width: 1450,
          height: 866,
          overflow: 'hidden',
          boxSizing: 'border-box',
          border: '1px solid rgba(98,216,255,0.48)',
          background: mediaBackground,
          boxShadow: '0 26px 80px rgba(0,0,0,0.62), 0 0 34px rgba(98,216,255,0.10)',
          opacity: mediaIn,
          transform: `translateY(${interpolate(mediaIn, [0, 1], [18, 0])}px)`,
        }}
      >
        {mediaKind === 'video' ? (
          <Video
            src={staticFile(mediaSrc)}
            muted
            objectFit={mediaFit}
            style={{width: '100%', height: '100%', transform: `scale(${mediaScale})`}}
          />
        ) : (
          <Img
            src={staticFile(mediaSrc)}
            style={{width: '100%', height: '100%', objectFit: mediaFit, transform: `scale(${mediaScale})`}}
          />
        )}
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(180deg, rgba(2,7,12,0.03), transparent 62%, rgba(2,7,12,0.42))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 18,
            bottom: 18,
            padding: '7px 11px',
            background: 'rgba(3,8,12,0.76)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(247,250,252,0.86)',
            fontSize: 16,
            fontWeight: 850,
          }}
        >
          {mediaLabel}
        </div>
      </div>
    </AbsoluteFill>
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
        top: 205,
        width: 720,
        color: colors.ink,
        fontFamily,
        opacity,
        textShadow: '0 5px 25px rgba(0,0,0,0.98)',
      }}
    >
      <V7LocalContrastVeil strength={0.66} width={880} />
      <div style={{position: 'relative'}}>
        <div style={{color: colors.cyan, fontSize: 18, fontWeight: 900}}>ACTION · 回到真实项目</div>
        <div
          style={{
            marginTop: 20,
            fontSize: 58,
            lineHeight: 1.08,
            fontWeight: 950,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [22, 0])}px)`,
          }}
        >
          认真做
          <br />
          真实展示
          <br />
          马上落地
        </div>
        <div
          style={{
            marginTop: 22,
            width: `${underline * 510}px`,
            height: 5,
            background: `linear-gradient(90deg, ${colors.cyan}, ${colors.amber})`,
          }}
        />
      </div>
    </div>
  );
};

const DazhiScenes: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={f(0.2)} durationInFrames={f(5.6)} premountFor={10}>
      <PersonIntroduction />
    </Sequence>

    <Sequence from={f(5.9)} durationInFrames={f(5.3)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="VALUE · 设计师如何帮客户花钱"
        title="不只画图，还要替客户做选择"
        items={[
          {label: '空间', detail: '怎么装、怎么实现', tone: 'cyan'},
          {label: '家具', detail: '选什么、怎么搭', tone: 'amber', active: true},
          {label: '结果', detail: '把钱花在值得的地方', tone: 'green'},
        ]}
      />
    </Sequence>

    <Sequence from={f(11.3)} durationInFrames={f(21.3)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="PRODUCTIZATION · 设计产品化"
        title="从被动接单，到提前研发"
        items={[
          {label: '过去', detail: '客户要什么，就做什么', tone: 'white'},
          {label: '现在', detail: '提前研发完整设计方案', tone: 'cyan', active: true},
          {label: '客户', detail: '像选产品一样选方案', tone: 'amber'},
        ]}
      />
    </Sequence>

    <Sequence from={f(32.8)} durationInFrames={f(6.6)} premountFor={10}>
      <V7HeroMetric
        eyebrow="DESIGN R&D · 商业空间研发"
        value="300-500"
        suffix="㎡"
        caption="酒吧空间产品化尺度"
        facts={['先做风格研发，再匹配具体客户', '数字来自现场口述的空间举例']}
        tone="amber"
      />
    </Sequence>

    <Sequence from={f(39.4)} durationInFrames={f(20.8)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="STYLE INDEX · 不是临时跟风"
        title="一套空间，多种产品方向"
        items={[
          {label: '01', detail: '侘寂风', tone: 'cyan'},
          {label: '02', detail: '古堡风', tone: 'amber'},
          {label: '03', detail: '波西米亚风', tone: 'green'},
          {label: '04', detail: '摩洛哥 / 现代风', tone: 'cyan', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(60.2)} durationInFrames={f(14.1)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="ROLE BOUNDARY · 人做判断，AI做加速"
        title="AI还只是工具"
        items={[
          {label: '设计师', detail: '负责方向、判断与取舍', tone: 'amber', active: true},
          {label: 'AI', detail: '加速灵感显影与方案表达', tone: 'cyan'},
          {label: '目标', detail: '更快、更低成本地实现想法', tone: 'green'},
        ]}
      />
    </Sequence>

    <Sequence from={f(74.4)} durationInFrames={f(10.6)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="VERSION 1.0 · 最小可执行版本"
        title="先把一瞬间的想法接住"
        items={[
          {label: '能看', detail: '把抽象灵感变成画面', tone: 'cyan'},
          {label: '能选', detail: '让客户比较方向', tone: 'amber', active: true},
          {label: '能讲', detail: '把设计逻辑说清楚', tone: 'green'},
        ]}
      />
    </Sequence>

    <Sequence from={f(85.1)} durationInFrames={f(16.2)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="BOUNDARY · 概念展示不是施工交付"
        title="先确认方向，再进入专业设计"
        items={[
          {label: 'V1', detail: '概念图 / 动态短片 / 素材包', tone: 'cyan'},
          {label: '不能代替', detail: '施工图、尺寸、采购与报价', tone: 'red', active: true},
          {label: '下一步', detail: '真实项目专业设计', tone: 'green'},
        ]}
      />
    </Sequence>

    <Sequence from={f(101.5)} durationInFrames={f(6.5)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="INSPIRATION · 灵感出现的瞬间"
        title="先记录，不让它消失"
        items={[
          {label: '场景', detail: '旅行 / 现场 / 短视频', tone: 'cyan'},
          {label: '动作', detail: '按原话快速记下来', tone: 'amber', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(108)} durationInFrames={f(20)} premountFor={fps}>
      <MediaTakeover
        index="01"
        eyebrow="INSPIRATION V1"
        title="灵感速记与显影"
        facts={[
          {label: '输入', value: '保留设计师原话', tone: 'cyan'},
          {label: '整理', value: '业态 / 关键词 / 参考图', tone: 'ink'},
          {label: '输出', value: '生成可讨论的概念方向', tone: 'amber'},
        ]}
        mediaSrc="media/dazhi-20260721/inspiration-v1-30fps.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaBackground="#F3F0E8"
        mediaLabel="真实产品演示 · 大志灵感V1"
      />
    </Sequence>

    <Sequence from={f(128)} durationInFrames={f(4)} premountFor={10}>
      <MediaTakeover
        index="02"
        eyebrow="DESIGN SKETCH"
        title="先把脑中的空间画下来"
        facts={[
          {label: '原点', value: '设计师手绘草图', tone: 'cyan'},
          {label: '确定', value: '拱券 / 吧台 / 空间纵深', tone: 'amber'},
          {label: '价值', value: '保留大志自己的设计判断', tone: 'green'},
        ]}
        mediaSrc="media/dazhi-20260721/inspiration-sketch-v1.png"
        mediaKind="image"
        mediaFit="cover"
        mediaBackground="#F3F0E8"
        mediaLabel="原始设计草图 · 灵感的第一层证据"
      />
    </Sequence>

    <Sequence from={f(132)} durationInFrames={f(4)} premountFor={10}>
      <MediaTakeover
        index="03"
        eyebrow="CONCEPT IMAGE"
        title="从草图显影为空间概念"
        facts={[
          {label: '空间', value: '商业酒吧概念', tone: 'cyan'},
          {label: '方法', value: '材料 × 灯光 × 动线', tone: 'amber'},
          {label: '边界', value: '仅用于方向沟通', tone: 'red'},
        ]}
        mediaSrc="media/dazhi-20260721/灵感概念图_大志设计_v1.png"
        mediaKind="image"
        mediaFit="cover"
        mediaLabel="AI生成概念图 · 非施工依据"
      />
    </Sequence>

    <Sequence from={f(136)} durationInFrames={f(5.1)} premountFor={fps}>
      <MediaTakeover
        index="04"
        eyebrow="CONCEPT MOTION"
        title="从静态概念到空间体验"
        facts={[
          {label: '运镜', value: '沿入口缓慢推进', tone: 'cyan'},
          {label: '重点', value: '纵深 / 材质 / 灯光', tone: 'amber'},
          {label: '用途', value: '帮助客户理解方向', tone: 'green'},
        ]}
        mediaSrc="media/dazhi-20260721/inspiration-motion-v1.mp4"
        mediaKind="video"
        mediaFit="cover"
        mediaLabel="AI图生视频 · 概念动态展示"
      />
    </Sequence>

    <Sequence from={f(141.1)} durationInFrames={f(19)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="REUSE · 灵感不是一次性画面"
        title="先保存，再调用，再专业落地"
        items={[
          {label: '现在', detail: '把想法和概念保存下来', tone: 'cyan'},
          {label: '下次', detail: '遇到合适客户再调出深化', tone: 'amber'},
          {label: '最终', detail: '进入可施工的专业设计', tone: 'green', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(160.1)} durationInFrames={f(10.2)} premountFor={fps}>
      <MediaTakeover
        index="05"
        eyebrow="PERSONAL KNOWLEDGE BASE"
        title="把经验连成第二大脑"
        facts={[
          {label: '输入', value: '灵感 / 经验 / 设计图', tone: 'cyan'},
          {label: '结构', value: '本地知识节点持续关联', tone: 'amber'},
          {label: '结果', value: '需要时能重新调用', tone: 'green'},
        ]}
        mediaSrc="media/dazhi-20260721/personal-knowledge-base-cropped-30fps.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaBackground="#F5F6F7"
        mediaLabel="真实本地知识库关系图"
      />
    </Sequence>

    <Sequence from={f(170.3)} durationInFrames={f(19.7)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="SECOND BRAIN · 不是一堆散文件"
        title="把工作经验变成数字资产"
        items={[
          {label: '灵感', detail: '当下想法持续沉淀', tone: 'cyan'},
          {label: '经验', detail: '做过的项目可以复用', tone: 'amber'},
          {label: '设计图', detail: '历史方案统一归档', tone: 'green'},
        ]}
      />
    </Sequence>

    <Sequence from={f(190)} durationInFrames={f(12)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="MEMORY GAP · 人脑不是数据库"
        title="项目一多，记忆就会断层"
        items={[
          {label: '现实', detail: '项目 / 应酬 / 工作对接', tone: 'white'},
          {label: '问题', detail: '想过的内容会忘记', tone: 'red', active: true},
          {label: '解法', detail: '统一、持续地储存', tone: 'cyan'},
        ]}
      />
    </Sequence>

    <Sequence from={f(202)} durationInFrames={f(17.2)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="MATERIAL LIBRARY · 设计落地资产"
        title="材料不只放在办公室"
        items={[
          {label: '墙板', detail: '防撞板 / 冰火板', tone: 'cyan'},
          {label: '花色', detail: '适配不同空间效果', tone: 'amber'},
          {label: '记录', detail: '形成可检索材料节点', tone: 'green'},
        ]}
      />
    </Sequence>

    <Sequence from={f(219.2)} durationInFrames={f(22.8)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="VALUE ENGINEERING · 效果与成本一起考虑"
        title="不是只选好看，而是选得合适"
        items={[
          {label: '效果', detail: '满足客户空间目标', tone: 'cyan'},
          {label: '材质', detail: '真实可采购、可施工', tone: 'green'},
          {label: '预算', detail: '价格合适、性价比高', tone: 'amber', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(242)} durationInFrames={f(24)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="FAST CHOICE · 材料一选，预算即出"
        title="让客户拥有真实的可选性"
        items={[
          {label: '方案A', detail: '效果更强，价格更高', tone: 'amber'},
          {label: '方案B', detail: '效果合适，预算可控', tone: 'green', active: true},
          {label: '数字库', detail: '快速匹配、快速选择', tone: 'cyan'},
        ]}
      />
    </Sequence>

    <Sequence from={f(266)} durationInFrames={f(29.5)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="ORGANIZER · 设计师不可替代的角色"
        title="客户的想法是散的"
        items={[
          {label: '客户输入', detail: '零散想法与经营需求', tone: 'white'},
          {label: '设计判断', detail: '专业经验与方向取舍', tone: 'amber'},
          {label: '现场条件', detail: '空间、材料与实际预算', tone: 'cyan'},
          {label: '设计师', detail: '把一切组织成完整方案', tone: 'green', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(295.6)} durationInFrames={f(22.2)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="COLLABORATION · 专业框架与技术整合"
        title="先让设计师写清判断框架"
        items={[
          {label: '大志', detail: '设计流程 / 边界 / 判断标准', tone: 'amber'},
          {label: '技术方', detail: '工具编排 / 数据整理 / 实现', tone: 'cyan'},
          {label: '共同结果', detail: '可调用、可迭代的工作流', tone: 'green', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(317.8)} durationInFrames={f(33)} premountFor={10}>
      <V7TransparentInfoStack
        eyebrow="BE SEEN · 真实工作需要被看见"
        title="好团队，不该只靠朋友介绍"
        items={[
          {label: '过去', detail: '圈层与转介绍', tone: 'white'},
          {label: '问题', detail: '很多客户根本找不到', tone: 'red'},
          {label: '现在', detail: '展示真实案例与落地过程', tone: 'cyan'},
          {label: '目标', detail: '让认真做事的人被看见', tone: 'green', active: true},
        ]}
      />
    </Sequence>

    <Sequence from={f(350.8)} durationInFrames={f(15.7)} premountFor={10}>
      <ClosingStatement />
    </Sequence>
  </AbsoluteFill>
);

const DazhiHud: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = (frame / Math.max(1, DAZHI_FORMAL_DURATION_IN_FRAMES - 1)) * 100;
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
        <div
          style={{
            width: 9,
            height: 9,
            background: colors.cyan,
            boxShadow: `0 0 17px ${colors.cyan}`,
          }}
        />
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

const DazhiSoundDesign: React.FC = () => (
  <>
    <Sequence from={f(0.2)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/waic2026-v6/card-pop.wav')} volume={0.4} />
    </Sequence>
    <Sequence from={f(32.8)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/token-v5/data-pulse.wav')} volume={0.2} />
    </Sequence>
    <Sequence from={f(60.2)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/waic2026-v6/thesis-impact.wav')} volume={0.62} />
    </Sequence>
    <Sequence from={f(108)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/waic2026-v6/section-whoosh.wav')} volume={0.1} />
    </Sequence>
    <Sequence from={f(128)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/token-v5/confirm-tick.wav')} volume={0.25} />
    </Sequence>
    <Sequence from={f(132)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/token-v5/confirm-tick.wav')} volume={0.18} />
    </Sequence>
    <Sequence from={f(136)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/waic2026-v6/section-whoosh.wav')} volume={0.08} />
    </Sequence>
    <Sequence from={f(160.1)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/waic2026-v6/node-connect.wav')} volume={0.18} />
    </Sequence>
    <Sequence from={f(242)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/token-v5/data-pulse.wav')} volume={0.18} />
    </Sequence>
    <Sequence from={f(350.8)} durationInFrames={f(2)}>
      <Audio src={staticFile('audio/token-v5/impact-low.wav')} volume={0.32} />
    </Sequence>
  </>
);

export const DazhiFormalV7Talk16x9: React.FC = () => (
  <AbsoluteFill style={{background: colors.dark, overflow: 'hidden'}}>
    <LocalFont />
    <DazhiTalkFootage />
    <DazhiScenes />
    <DazhiSoundDesign />
    <DazhiHud />
    <StableBilingualCaptionOverlay captionsSrc="data/dazhi_20260721_formal.bilingual.v2.json" />
  </AbsoluteFill>
);
