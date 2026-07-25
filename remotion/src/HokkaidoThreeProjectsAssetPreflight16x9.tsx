import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {LocalFont} from './components/LocalFont';
import {
  V7AnnotatedMediaStage,
  V7ProcessRail,
} from './components/V7InformationStage';

const fps = 30;
const f = (seconds: number) => Math.round(seconds * fps);
const fontFamily = '"Koubo Heiti", "PingFang SC", "Microsoft YaHei", sans-serif';

export const HOKKAIDO_THREE_PROJECTS_PREFLIGHT_DURATION_IN_FRAMES = f(68);

type MediaScene = {
  from: number;
  duration: number;
  index: string;
  eyebrow: string;
  title: string;
  facts: Array<{
    label: string;
    value: string;
    tone?: 'cyan' | 'amber' | 'green' | 'white';
  }>;
  mediaSrc: string;
  mediaKind?: 'video' | 'image';
  mediaLabel: string;
};

const scenes: MediaScene[] = [
  {
    from: 0,
    duration: 5,
    index: '01',
    eyebrow: 'OFFICIAL CASE · 北海道',
    title: '从手动卷膜到电机',
    facts: [
      {label: '真实问题', value: '逐棚查看与开窗', tone: 'cyan'},
      {label: 'AI作用', value: '拆方案、写代码', tone: 'amber'},
      {label: '最终责任', value: '本人安装与测试', tone: 'green'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/hokkaido/H02-manual-film-to-motor.mp4',
    mediaLabel: 'OpenAI 官方视频 · 必要短引用',
  },
  {
    from: 5,
    duration: 5,
    index: '01',
    eyebrow: 'TOOL CHAIN · 北海道',
    title: '一次提示调用工具',
    facts: [
      {label: '输入', value: '明确现场目标', tone: 'cyan'},
      {label: '中间', value: '数据与工具调用', tone: 'amber'},
      {label: '边界', value: '不等于AI替代农业判断', tone: 'white'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/hokkaido/H04-prompt-tools-data.mp4',
    mediaLabel: 'OpenAI 官方视频 · 真实案例画面',
  },
  {
    from: 10,
    duration: 5,
    index: '02',
    eyebrow: 'REAL WORKFLOW · 今石缘',
    title: '人工审核与独立编号',
    facts: [
      {label: '参与者', value: '石友上传真实资料', tone: 'cyan'},
      {label: '人工环节', value: '后台审核确认', tone: 'amber'},
      {label: '结果', value: '编号后进入展厅', tone: 'green'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/jinshiyuan/J03-admin-review-number.mp4',
    mediaLabel: '今石缘项目测试录屏 · 手机号已遮挡',
  },
  {
    from: 15,
    duration: 5,
    index: '02',
    eyebrow: 'AI ASSIST · 今石缘',
    title: '资料变成展示海报',
    facts: [
      {label: '输入', value: '审核过的图片与资料', tone: 'cyan'},
      {label: 'AI辅助', value: '整理赏析与版式', tone: 'amber'},
      {label: '不能替代', value: '鉴定、估价与入选判断', tone: 'white'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/jinshiyuan/J06-poster-result.mp4',
    mediaLabel: '今石缘项目测试结果 · 非鉴定结论',
  },
  {
    from: 20,
    duration: 5,
    index: '03',
    eyebrow: 'TICKET PROTOTYPE · Bo2',
    title: '票务原型先接住到场',
    facts: [
      {label: '基础链路', value: '票务、电子票、验票', tone: 'cyan'},
      {label: '隐私', value: '测试订单号已遮挡', tone: 'green'},
      {label: '状态', value: '仍需端到端验收', tone: 'amber'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/bo2/B01-ticket-prototype-masked.mp4',
    mediaLabel: 'Bo2 票务原型 · 测试数据',
  },
  {
    from: 25,
    duration: 5,
    index: '03',
    eyebrow: 'AI POSTER · Bo2',
    title: '现场照片变纪念海报',
    facts: [
      {label: '真实输入', value: '观众本人现场照片', tone: 'cyan'},
      {label: '本人选择', value: '八种视觉方向', tone: 'amber'},
      {label: '状态', value: '概念演示，尚未全链跑通', tone: 'white'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/bo2/B02-ai-poster-flow.mp4',
    mediaLabel: 'AI 生成概念演示 · 用户提供素材',
  },
  {
    from: 30,
    duration: 5,
    index: '04',
    eyebrow: 'DIRECTION · 大志',
    title: '同一灵感显影三条路',
    facts: [
      {label: '输入', value: '文字、草图与参考资料', tone: 'cyan'},
      {label: 'AI处理', value: '生成真正不同的方向', tone: 'amber'},
      {label: '人工判断', value: '设计师选择与修改', tone: 'green'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/dazhi/D02-three-directions.mp4',
    mediaLabel: '大志灵感系统 · 内部验证录屏',
  },
  {
    from: 35,
    duration: 5,
    index: '04',
    eyebrow: 'REFINE · 大志',
    title: '角度、光线继续细化',
    facts: [
      {label: '不是一次生成', value: '方向可以连续修改', tone: 'cyan'},
      {label: '比较维度', value: '视角、光线与空间元素', tone: 'amber'},
      {label: '专业边界', value: '概念图不冒充施工交付', tone: 'white'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/dazhi/D03-refine-and-multiview.mp4',
    mediaLabel: '大志灵感系统 · 概念多视角',
  },
  {
    from: 40,
    duration: 5,
    index: '04',
    eyebrow: 'MOTION · 大志',
    title: '选定方向继续成片',
    facts: [
      {label: '画面基础', value: '已选择的空间方向', tone: 'cyan'},
      {label: '视频输出', value: '不同时长概念视频', tone: 'amber'},
      {label: '状态', value: '内部生成测试', tone: 'white'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/dazhi/D04-concept-video.mp4',
    mediaLabel: 'AI 生成概念视频 · 非真实完工现场',
  },
  {
    from: 45,
    duration: 5,
    index: '04',
    eyebrow: 'MEMORY · 大志',
    title: '选择理由回写知识库',
    facts: [
      {label: '留下什么', value: '选择、删除与修改原因', tone: 'cyan'},
      {label: '下一次', value: '继续检索与调用', tone: 'green'},
      {label: '价值', value: '把灵感变成可复用上下文', tone: 'amber'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/dazhi/D05-knowledge-writeback.mp4',
    mediaLabel: '大志灵感系统 · 本地知识回写',
  },
  {
    from: 50,
    duration: 4,
    index: '02',
    eyebrow: 'OWNED CHANNEL · 今石缘',
    title: '已有账号承接公开展示',
    facts: [
      {label: '截图用途', value: '证明已有内容入口', tone: 'cyan'},
      {label: '数据边界', value: '只代表截图当时状态', tone: 'white'},
      {label: '不作承诺', value: '不外推未来流量结果', tone: 'amber'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/images/jinshiyuan/account-proof.png',
    mediaKind: 'image',
    mediaLabel: '今石缘账号截图 · 截图时状态',
  },
  {
    from: 54,
    duration: 4,
    index: '03',
    eyebrow: 'STYLE CHOICE · Bo2',
    title: '六种方向交给本人选择',
    facts: [
      {label: '同一输入', value: '现场照片与本人选择', tone: 'cyan'},
      {label: '生成结果', value: '六种海报视觉方向', tone: 'amber'},
      {label: '状态', value: 'AI生成概念演示', tone: 'white'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/images/bo2/style-grid-6.png',
    mediaKind: 'image',
    mediaLabel: 'AI 生成概念演示 · 六种视觉方向',
  },
  {
    from: 58,
    duration: 4,
    index: '04',
    eyebrow: 'REAL INPUT · 大志',
    title: '灵感先从真实草图出发',
    facts: [
      {label: '输入类型', value: '空间草图与项目说明', tone: 'cyan'},
      {label: '后续处理', value: '方向、视角与光线', tone: 'amber'},
      {label: '专业边界', value: '输入示例，非施工图', tone: 'white'},
    ],
    mediaSrc:
      'media/hokkaido-three-projects-20260725/images/dazhi/floor-sketch.png',
    mediaKind: 'image',
    mediaLabel: '大志项目真实输入 · 非施工图',
  },
];

const PreflightHud: React.FC = () => {
  const frame = useCurrentFrame();
  const progress =
    frame / Math.max(1, HOKKAIDO_THREE_PROJECTS_PREFLIGHT_DURATION_IN_FRAMES - 1);

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
          top: 31,
          color: 'rgba(247,250,252,0.7)',
          fontFamily,
          fontSize: 16,
          fontWeight: 850,
          zIndex: 120,
        }}
      >
        素材预演 · 最终时间以词级转写为准
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

export const HokkaidoThreeProjectsAssetPreflight16x9: React.FC = () => (
  <AbsoluteFill
    style={{
      overflow: 'hidden',
      background:
        'radial-gradient(circle at 74% 32%, rgba(28,93,126,0.18), transparent 42%), #05090E',
    }}
  >
    <LocalFont />
    {scenes.map((scene) => (
      <Sequence
        key={`${scene.index}-${scene.from}-${scene.mediaSrc}`}
        from={f(scene.from)}
        durationInFrames={f(scene.duration)}
        premountFor={10}
      >
        <V7AnnotatedMediaStage
          index={scene.index}
          eyebrow={scene.eyebrow}
          title={scene.title}
          facts={scene.facts}
          mediaSrc={scene.mediaSrc}
          mediaKind={scene.mediaKind ?? 'video'}
          mediaLabel={scene.mediaLabel}
          mediaFit="contain"
        />
      </Sequence>
    ))}
    <Sequence from={f(62)} durationInFrames={f(6)} premountFor={10}>
      <V7ProcessRail
        eyebrow="FINAL MAP · 正式片预留"
        title="同一条参与链"
        steps={[
          {label: '真实愿望', detail: '谁想做什么', tone: 'cyan'},
          {label: '资料输入', detail: '图片、现场与经验', tone: 'amber'},
          {label: 'AI处理', detail: '整理、生成与串联', tone: 'cyan'},
          {label: '人工确认', detail: '结果留存再复用', tone: 'green'},
        ]}
      />
    </Sequence>
    <PreflightHud />
  </AbsoluteFill>
);
