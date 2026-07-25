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
import {AdaptiveBilingualCaptionOverlay} from './components/AdaptiveBilingualCaptionOverlay';
import {LocalFont} from './components/LocalFont';
import {
  V7AnnotatedMediaStage,
  V7ChapterMarker,
  V7HeroMetric,
  V7ProcessRail,
  V7TransparentInfoStack,
  V7TruthStatement,
} from './components/V7InformationStage';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};
const fontFamily =
  '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const HOKKAIDO_THREE_PROJECTS_DURATION_IN_FRAMES = f(386.9);

const TalkFootage: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const keyframes = [
    0, 10.3, 17, 28.2, 43.8, 67.7, 85.8, 105, 127.6, 147.7, 170.1,
    195.4, 211.5, 235, 258.5, 280.5, 303.5, 331.5, 355.5, 372.5, 386.9,
  ];
  const scale = interpolate(
    seconds,
    keyframes,
    [
      1.025, 1.052, 1.034, 1.055, 1.036, 1.052, 1.033, 1.056, 1.034,
      1.052, 1.036, 1.055, 1.034, 1.054, 1.035, 1.056, 1.034, 1.053,
      1.035, 1.057, 1.04,
    ],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const x = interpolate(
    seconds,
    keyframes,
    [
      -4, 8, -2, 7, -2, 7, -1, 8, -2, 7, -1, 7, -2, 8, -1, 8, -2,
      7, -1, 8, 0,
    ],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );
  const y = interpolate(
    seconds,
    keyframes,
    [0, -2, 1, -2, 1, -1, 1, -2, 1, -1, 1, -2, 1, -1, 1, -2, 1, -1, 1, -2, 0],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  );

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#05090E'}}>
      <Video
        src={staticFile(
          'media/hokkaido-three-projects-20260725/talk/HOKKAIDO3_20260725_talk01_30fps_loudness.mp4',
        )}
        objectFit="cover"
        style={{
          width: '100%',
          height: '100%',
          filter: 'contrast(1.035) saturate(1.025) brightness(0.99)',
          transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
          transformOrigin: '56% 43%',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(2,7,12,0.13) 0%, rgba(2,7,12,0.01) 54%, rgba(2,7,12,0.04) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

type MediaStageProps = React.ComponentProps<typeof V7AnnotatedMediaStage>;

const OpaqueMediaStage: React.FC<MediaStageProps> = (props) => (
  <AbsoluteFill style={{background: '#05090E'}}>
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(145deg, #07111A 0%, #03070B 56%, #071018 100%)',
      }}
    />
    <V7AnnotatedMediaStage {...props} />
  </AbsoluteFill>
);

const Scene: React.FC<{
  start: number;
  end: number;
  children: React.ReactNode;
}> = ({start, end, children}) => (
  <Sequence
    from={f(start)}
    durationInFrames={Math.max(1, f(end) - f(start))}
    premountFor={15}
  >
    {children}
  </Sequence>
);

const Scenes: React.FC = () => (
  <AbsoluteFill>
    <Scene start={0.2} end={10.3}>
      <V7ChapterMarker
        index="01"
        eyebrow="REAL CASE · 北海道农场"
        title="不会编程，怎么把AI接进温室？"
        subtitle="先说清一个每天都发生的真实麻烦，再让AI进入解决过程。"
      />
    </Scene>

    <Scene start={17} end={27.8}>
      <OpaqueMediaStage
        index="01"
        eyebrow="ORIGINAL PROBLEM · 北海道"
        title="原来要逐棚查看、手动开窗"
        facts={[
          {label: '真实场景', value: '多座温室', tone: 'cyan'},
          {label: '重复动作', value: '逐棚查看温度', tone: 'amber'},
          {label: '人工操作', value: '手动开窗', tone: 'white'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/hokkaido/H02-manual-film-to-motor.mp4"
        mediaKind="video"
        mediaLabel="OpenAI 官方视频 · 必要短引用"
      />
    </Scene>

    <Scene start={28.2} end={43.8}>
      <V7ProcessRail
        eyebrow="WORKFLOW · 从一句需求开始"
        title="先定义结果，再让AI拆解"
        steps={[
          {label: '现场需求', detail: '群里看温度', tone: 'cyan'},
          {label: '动作目标', detail: '一句话开窗', tone: 'amber'},
          {label: 'AI拆解', detail: '方案与部件', tone: 'cyan'},
          {label: '人工执行', detail: '购买、安装、测试', tone: 'green'},
        ]}
      />
    </Scene>

    <Scene start={43.8} end={55.7}>
      <OpaqueMediaStage
        index="01"
        eyebrow="AI ASSIST · 北海道"
        title="拆方案、列部件、继续追问"
        facts={[
          {label: '输入', value: '明确的现场目标', tone: 'cyan'},
          {label: 'AI处理', value: '拆方案与列部件', tone: 'amber'},
          {label: '不会接线', value: '拍照继续问', tone: 'green'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/hokkaido/H04-prompt-tools-data.mp4"
        mediaKind="video"
        mediaLabel="OpenAI 官方视频 · 真实案例画面"
      />
    </Scene>

    <Scene start={55.7} end={67.7}>
      <OpaqueMediaStage
        index="01"
        eyebrow="HUMAN IN THE LOOP · 北海道"
        title="AI写代码，人进温室安装测试"
        facts={[
          {label: 'Codex', value: '连接传感器与电机', tone: 'cyan'},
          {label: '农民本人', value: '安装与测试', tone: 'amber'},
          {label: '出错以后', value: '回来继续改', tone: 'green'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/hokkaido/H03-remote-greenhouse-motor.mp4"
        mediaKind="video"
        mediaLabel="OpenAI 官方视频 · 现场设备动作"
        mediaLoop
      />
    </Scene>

    <Scene start={67.7} end={81.1}>
      <V7HeroMetric
        eyebrow="REAL BUILD TIME · 远程开窗"
        value="2"
        suffix="个月"
        caption="不是一句提示词直接变成结果"
        facts={['员工在群里查询温度', '发出指令后电机动作', '现场安装与测试由人完成']}
        tone="amber"
      />
    </Scene>

    <Scene start={81.1} end={85.8}>
      <OpaqueMediaStage
        index="01"
        eyebrow="FIELD LOGGING · 北海道"
        title="手机定位记录农活"
        facts={[
          {label: '官方画面', value: '田间GPS边界', tone: 'cyan'},
          {label: '证明范围', value: '只限画面所示功能', tone: 'amber'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/hokkaido/H01-gps-field-boundary.mp4"
        mediaKind="video"
        mediaLabel="OpenAI 官方视频 · 必要短引用"
      />
    </Scene>

    <Scene start={85.8} end={105}>
      <V7TruthStatement
        eyebrow="FACT BOUNDARY · AI没有替人懂农业"
        left="会写代码、会查错"
        right="替人做农业判断"
        note="农民提供现场经验，亲自安装、测试和确认；AI承担中间的技术协作。"
      />
    </Scene>

    <Scene start={105} end={127.6}>
      <V7HeroMetric
        eyebrow="LOCAL PRACTICE · 三条真实工作链"
        value="3"
        suffix="个项目"
        caption="起点都是一群人被流量、技术或流程卡住"
        facts={['今石缘线上石展', 'Bo2漫展服务', '大志设计师灵感系统']}
        tone="amber"
      />
    </Scene>

    <Scene start={127.6} end={147.7}>
      <OpaqueMediaStage
        index="02"
        eyebrow="REAL DESIRE · 今石缘"
        title="好石头想被更多人看见"
        facts={[
          {label: '石友愿望', value: '展示自己的好东西', tone: 'cyan'},
          {label: '现实限制', value: '个人流量有限', tone: 'amber'},
          {label: '平台作用', value: '承接持续展示', tone: 'green'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/images/jinshiyuan/account-proof.png"
        mediaKind="image"
        mediaFit="contain"
        mediaLabel="今石缘账号截图 · 仅代表截图时状态"
      />
    </Scene>

    <Scene start={147.7} end={153.1}>
      <OpaqueMediaStage
        index="02"
        eyebrow="ENTRY · 今石缘"
        title="持续运行的线上石展"
        facts={[
          {label: '入口', value: '活动报名', tone: 'cyan'},
          {label: '状态', value: '当前项目原型', tone: 'amber'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/jinshiyuan/J01-entry-form-crop.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaLoop
        mediaLabel="今石缘项目测试录屏"
      />
    </Scene>

    <Scene start={153.1} end={158.9}>
      <OpaqueMediaStage
        index="02"
        eyebrow="INPUT · 今石缘"
        title="资料先由石友真实提供"
        facts={[
          {label: '图片', value: '作品原图', tone: 'cyan'},
          {label: '资料', value: '尺寸、石种、故事', tone: 'amber'},
          {label: '授权', value: '确认后进入审核', tone: 'green'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/jinshiyuan/J02-upload-and-consent.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaLoop
        mediaLabel="今石缘项目测试录屏"
      />
    </Scene>

    <Scene start={158.9} end={170.1}>
      <OpaqueMediaStage
        index="02"
        eyebrow="HUMAN REVIEW · 今石缘"
        title="人工审核以后再编号"
        facts={[
          {label: '责任主体', value: '后台人工审核', tone: 'cyan'},
          {label: '入选结果', value: '生成独立编号', tone: 'amber'},
          {label: '后续', value: '进入线上展厅', tone: 'green'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/jinshiyuan/J03-admin-review-number.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaLabel="今石缘项目测试录屏 · 手机号已遮挡"
      />
    </Scene>

    <Scene start={170.1} end={179.8}>
      <OpaqueMediaStage
        index="02"
        eyebrow="AI ASSIST · 今石缘"
        title="审核后，AI才进入内容制作"
        facts={[
          {label: '事实底座', value: '审核过的原图与资料', tone: 'cyan'},
          {label: 'AI辅助', value: '美化图片与整理内容', tone: 'amber'},
          {label: '不能替代', value: '鉴定、估价、入选判断', tone: 'white'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/jinshiyuan/J04-ai-copy-generating.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaLabel="今石缘项目测试生成过程"
      />
    </Scene>

    <Scene start={179.8} end={185.8}>
      <OpaqueMediaStage
        index="02"
        eyebrow="CONTENT · 今石缘"
        title="赏析内容仍受真实资料约束"
        facts={[
          {label: '输入', value: '真实作品资料', tone: 'cyan'},
          {label: '输出', value: '赏析文本测试', tone: 'amber'},
          {label: '边界', value: '不作鉴定结论', tone: 'white'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/jinshiyuan/J05-ai-copy-result.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaLabel="今石缘项目测试结果"
      />
    </Scene>

    <Scene start={185.8} end={195.4}>
      <OpaqueMediaStage
        index="02"
        eyebrow="OUTPUT · 今石缘"
        title="统一展示海报"
        facts={[
          {label: '统一呈现', value: '作品信息与版式', tone: 'cyan'},
          {label: '平台分发', value: '账号、朋友圈、群', tone: 'amber'},
          {label: '不承诺', value: '未来流量结果', tone: 'white'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/jinshiyuan/J06-poster-result.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaLoop
        mediaLabel="今石缘展示海报 · 非鉴定结论"
      />
    </Scene>

    <Scene start={195.4} end={211.5}>
      <V7TransparentInfoStack
        eyebrow="NEXT STEP · 待首期活动验证"
        title="不只展示，还要形成持续参与"
        items={[
          {label: '线上评选', detail: '每期按公开规则组织', tone: 'cyan'},
          {label: '数字证书', detail: '给获奖作品留下记录', tone: 'amber'},
          {label: '当期奖品', detail: '以每期真实规则为准', tone: 'green'},
          {label: '当前边界', detail: '完整运营结果仍待验证', tone: 'white'},
        ]}
      />
    </Scene>

    <Scene start={211.5} end={218}>
      <OpaqueMediaStage
        index="03"
        eyebrow="TICKET PROTOTYPE · Bo2"
        title="卖票、出票、验票是基础"
        facts={[
          {label: '当前', value: '票务页面原型', tone: 'cyan'},
          {label: '测试数据', value: '订单号已遮挡', tone: 'green'},
          {label: '仍需验证', value: '支付、出票、核验', tone: 'amber'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/bo2/B01-ticket-prototype-masked.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaLoop
        mediaLabel="Bo2 票务原型 · 测试数据"
      />
    </Scene>

    <Scene start={218} end={228.5}>
      <V7ChapterMarker
        index="02"
        eyebrow="REAL EXPERIENCE · Bo2漫展"
        title="一张票之后，还要留下纪念"
        subtitle="观众真正愿意带走和分享的，往往还有自己当天拍下的照片。"
        tone="amber"
      />
    </Scene>

    <Scene start={228.5} end={235}>
      <OpaqueMediaStage
        index="03"
        eyebrow="POINTS PROTOTYPE · Bo2"
        title="核验入场后发放海报积分"
        facts={[
          {label: '目标体验', value: '核验以后获得积分', tone: 'cyan'},
          {label: '当前画面', value: '积分页面原型', tone: 'amber'},
          {label: '状态', value: '待端到端验收', tone: 'white'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/bo2/B03-points-record.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaLabel="Bo2 积分页面原型 · 尚未全链跑通"
      />
    </Scene>

    <Scene start={235} end={250.5}>
      <OpaqueMediaStage
        index="03"
        eyebrow="AI POSTER · Bo2"
        title="现场照片变成纪念海报"
        facts={[
          {label: '真实输入', value: '观众本人照片', tone: 'cyan'},
          {label: '本人选择', value: '喜欢的视觉风格', tone: 'amber'},
          {label: 'AI处理', value: '完成视觉转换', tone: 'green'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/bo2/B02-ai-poster-flow.mp4"
        mediaKind="video"
        mediaFit="contain"
        mediaLabel="AI生成概念演示 · 用户提供素材"
      />
    </Scene>

    <Scene start={250.5} end={258.5}>
      <V7TruthStatement
        eyebrow="CURRENT BOUNDARY · Bo2"
        left="票务原型 + 视觉方向"
        right="完整业务结果"
        note="支付、出票、核验、积分和真实生图仍需端到端验收。"
      />
    </Scene>

    <Scene start={258.5} end={269.5}>
      <OpaqueMediaStage
        index="04"
        eyebrow="REAL INPUT · 大志"
        title="灵感先从真实草图出发"
        facts={[
          {label: '设计师', value: '大志', tone: 'cyan'},
          {label: '项目目标', value: '锁住自己的灵感', tone: 'amber'},
          {label: '输入示例', value: '草图，非施工图', tone: 'white'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/images/dazhi/floor-sketch.png"
        mediaKind="image"
        mediaFit="contain"
        mediaLabel="大志项目真实输入 · 非施工图"
      />
    </Scene>

    <Scene start={269.5} end={280.5}>
      <OpaqueMediaStage
        index="04"
        eyebrow="CAPTURE · 大志"
        title="文字、草图、平面图先留住"
        facts={[
          {label: '输入', value: '文字与项目说明', tone: 'cyan'},
          {label: '空间资料', value: '草图、平面图、参考', tone: 'amber'},
          {label: '第一步', value: '整理成灵感卡', tone: 'green'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/dazhi/D01-input-and-brief.mp4"
        mediaKind="video"
        mediaLabel="大志灵感系统 · 内部验证录屏"
      />
    </Scene>

    <Scene start={280.5} end={291.5}>
      <OpaqueMediaStage
        index="04"
        eyebrow="DIRECTION · 大志"
        title="同一灵感显影不同方向"
        facts={[
          {label: 'AI处理', value: '生成不同方向', tone: 'cyan'},
          {label: '人工判断', value: '大志自己选择', tone: 'amber'},
          {label: '修改记录', value: '为什么选、为什么删', tone: 'green'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/dazhi/D02-three-directions.mp4"
        mediaKind="video"
        mediaLabel="大志灵感系统 · 内部验证录屏"
      />
    </Scene>

    <Scene start={291.5} end={303.5}>
      <OpaqueMediaStage
        index="04"
        eyebrow="REFINE · 大志"
        title="角度、光线、软硬装继续细化"
        facts={[
          {label: '不是一次生成', value: '方向可连续修改', tone: 'cyan'},
          {label: '比较维度', value: '视角、光线、空间元素', tone: 'amber'},
          {label: '专业边界', value: '概念多视角', tone: 'white'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/dazhi/D03-refine-and-multiview.mp4"
        mediaKind="video"
        mediaLabel="大志灵感系统 · 概念多视角"
      />
    </Scene>

    <Scene start={303.5} end={319.5}>
      <OpaqueMediaStage
        index="04"
        eyebrow="MOTION · 大志"
        title="选定方向继续生成概念视频"
        facts={[
          {label: '沿用方向', value: '不必从头再来', tone: 'cyan'},
          {label: '时长选择', value: '四秒、八秒或更长', tone: 'amber'},
          {label: '状态', value: '非真实完工现场', tone: 'white'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/dazhi/D04-concept-video.mp4"
        mediaKind="video"
        mediaLabel="AI生成概念视频 · 非真实完工现场"
      />
    </Scene>

    <Scene start={319.5} end={331.5}>
      <OpaqueMediaStage
        index="04"
        eyebrow="MEMORY · 大志"
        title="选择理由回写本地知识"
        facts={[
          {label: '已经验证', value: '灵感记录与连续细化', tone: 'cyan'},
          {label: '留下', value: '选择、删除、修改原因', tone: 'amber'},
          {label: '下一次', value: '继续检索调用', tone: 'green'},
        ]}
        mediaSrc="media/hokkaido-three-projects-20260725/dazhi/D05-knowledge-writeback.mp4"
        mediaKind="video"
        mediaLabel="大志灵感系统 · 本地知识回写"
      />
    </Scene>

    <Scene start={331.5} end={342.5}>
      <V7TruthStatement
        eyebrow="CORE IDEA · 三个项目的共同点"
        left="页面多一个“生成”按钮"
        right="AI真正落地"
        note="真正的价值，是把人的愿望、资料、AI处理、人工确认和结果留存接成一条链。"
      />
    </Scene>

    <Scene start={342.5} end={355.5}>
      <V7ProcessRail
        eyebrow="PARTICIPATION CHAIN · 真实参与过程"
        title="五个问题，决定AI能不能真正进入项目"
        steps={[
          {label: '真实愿望', detail: '谁有需求', tone: 'cyan'},
          {label: '资料输入', detail: '谁来提供', tone: 'amber'},
          {label: 'AI处理', detail: '具体做哪一步', tone: 'cyan'},
          {label: '人工确认', detail: '结果留下并复用', tone: 'green'},
        ]}
      />
    </Scene>

    <Scene start={355.5} end={372.5}>
      <V7TransparentInfoStack
        eyebrow="SELF CHECK · 看看你最熟的行业"
        title="一群人，究竟被什么卡住？"
        items={[
          {label: '真实愿望', detail: '他们一直想做什么', tone: 'cyan'},
          {label: '当前卡点', detail: '流量、技术还是流程', tone: 'amber'},
          {label: '交给AI', detail: '能处理哪一步', tone: 'cyan'},
          {label: '留给人', detail: '哪些判断必须人工确认', tone: 'green'},
        ]}
      />
    </Scene>

    <Scene start={372.5} end={386.9}>
      <V7ChapterMarker
        index="?"
        eyebrow="YOUR INDUSTRY · 留下真实问题"
        title="你的行业，最想解决什么？"
        subtitle="评论区留下行业和问题。关注超哥，在兰州继续跑本地AI项目。"
        tone="amber"
      />
    </Scene>
  </AbsoluteFill>
);

const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = frame / fps;
  const progress =
    frame / Math.max(1, HOKKAIDO_THREE_PROJECTS_DURATION_IN_FRAMES - 1);
  const topic =
    seconds < 105
      ? '北海道农场'
      : seconds < 211.5
        ? '今石缘线上石展'
        : seconds < 258.5
          ? 'Bo2漫展服务'
          : seconds < 331.5
            ? '大志灵感系统'
            : '真实参与链';

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
          zIndex: 220,
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            background: '#62D8FF',
            boxShadow: '0 0 17px #62D8FF',
          }}
        />
        <div style={{marginLeft: 12, fontSize: 19, fontWeight: 950}}>
          超哥AI创业记
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 54,
          top: 28,
          padding: '7px 12px',
          borderLeft: '3px solid #62D8FF',
          background: 'rgba(2,7,12,0.38)',
          color: 'rgba(247,250,252,0.88)',
          fontFamily,
          fontSize: 17,
          fontWeight: 900,
          textShadow: '0 3px 14px rgba(0,0,0,0.96)',
          zIndex: 220,
        }}
      >
        {topic}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
          bottom: 18,
          height: 3,
          background: 'rgba(255,255,255,0.14)',
          zIndex: 280,
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

const OptionalSfx: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps: localFps} = useVideoConfig();
  const opening = spring({
    frame,
    fps: localFps,
    config: {damping: 20, stiffness: 170},
  });

  return (
    <>
      <Sequence from={f(0.2)}>
        <Audio
          src={staticFile('audio/koubo-sfx-v1/section-air.wav')}
          volume={0.07 * opening}
        />
      </Sequence>
      {[105, 127.6, 211.5, 258.5, 331.5].map((start) => (
        <Sequence key={start} from={f(start)}>
          <Audio
            src={staticFile('audio/koubo-sfx-v1/section-air.wav')}
            volume={0.065}
          />
        </Sequence>
      ))}
      {[43.8, 158.9, 228.5, 280.5, 342.5].map((start) => (
        <Sequence key={start} from={f(start)}>
          <Audio
            src={staticFile('audio/koubo-sfx-v1/node-connect.wav')}
            volume={0.085}
          />
        </Sequence>
      ))}
    </>
  );
};

const Talk: React.FC<{withSfx: boolean}> = ({withSfx}) => (
  <AbsoluteFill style={{background: '#05090E', overflow: 'hidden'}}>
    <LocalFont />
    <TalkFootage />
    <Scenes />
    {withSfx ? <OptionalSfx /> : null}
    <Hud />
    <AdaptiveBilingualCaptionOverlay captionsSrc="data/HOKKAIDO3_20260725_talk01.bilingual.v1.json" />
  </AbsoluteFill>
);

export const HokkaidoThreeProjectsTalk16x9: React.FC = () => (
  <Talk withSfx={false} />
);

export const HokkaidoThreeProjectsTalk16x9WithSfx: React.FC = () => (
  <Talk withSfx />
);
