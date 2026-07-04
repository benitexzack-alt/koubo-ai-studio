import type {Caption} from '@remotion/captions';

export type Beat = {
  start: number;
  end: number;
  eyebrow: string;
  title: string;
  detail: string;
  accent?: string;
  variant?: 'statement' | 'compare' | 'checklist' | 'flow' | 'metric';
  side?: 'left' | 'right';
  items?: string[];
  steps?: string[];
  leftLabel?: string;
  leftText?: string;
  rightLabel?: string;
  rightText?: string;
  metricLabel?: string;
  metricValue?: string;
};

export type TalkProps = {
  videoSrc: string;
  captionsSrc: string;
  coverImageSrc: string;
  topic: string;
  hostName: string;
  identity: string;
  coverTitle: string;
  coverSubTitle: string;
  coverKicker?: string;
  coverBgSrc?: string;
  footerTag: string;
  beats: Beat[];
};

export const defaultTalkProps: TalkProps = {
  videoSrc: 'media/IMG_1911_proxy_16x9.mp4',
  captionsSrc: 'data/IMG_1911.captions.json',
  coverImageSrc: 'covers/cover-base-face.jpg',
  topic: '甘肃小微企业，怎么用上 AI？',
  hostName: '兰州 AI 创业者',
  identity: '本地 AI 工具 / 算力 / 企业曝光',
  coverTitle: '甘肃企业',
  coverSubTitle: '别错过 AI 这波机会',
  footerTag: 'AI | 甘肃本地 | 小微企业 | OPC',
  beats: [
    {
      start: 1.8,
      end: 6.7,
      eyebrow: '开场身份',
      title: '38 岁，在兰州重新出发',
      detail: '不是讲概念，是把 AI 做成本地企业能用的工具。',
      accent: '#19D3FF',
    },
    {
      start: 6.8,
      end: 17.2,
      eyebrow: '核心判断',
      title: 'AI 不该只属于大公司',
      detail: '小微企业、个体老板，也需要低成本、能见效的 AI 方案。',
      accent: '#FFD23F',
    },
    {
      start: 17.3,
      end: 33.0,
      eyebrow: '服务对象',
      title: '从甘肃本地的真实需求开始',
      detail: '获客、曝光、内容、工具应用和算力对接，先解决眼前问题。',
      accent: '#5CFF8F',
    },
    {
      start: 33.1,
      end: 49.0,
      eyebrow: '创业连接',
      title: '寻找本地 OPC 一起做事',
      detail: '一个人公司不是单打独斗，而是用 AI 把交付能力放大。',
      accent: '#FF7A45',
    },
    {
      start: 49.1,
      end: 66.0,
      eyebrow: '内容方向',
      title: '讲基础，也讲实操',
      detail: '每一期围绕一个工具、一个案例、一个企业能马上验证的动作。',
      accent: '#B57CFF',
    },
    {
      start: 66.1,
      end: 79.2,
      eyebrow: '第一期结尾',
      title: '从兰州开始，把 AI 落到地上',
      detail: '关注这个账号，一起看甘肃小微企业如何进入 AI 时代。',
      accent: '#19D3FF',
    },
  ],
};

export const localBossAiProps: TalkProps = {
  videoSrc: 'media/IMG_1926_proxy_16x9.mp4',
  captionsSrc: 'data/IMG_1926.captions.json',
  coverImageSrc: 'covers/IMG_1926_cover_base.jpg',
  topic: '本地老板用 AI，第一步不是买软件',
  hostName: '兰州 AI 创业者彭超',
  identity: '甘肃小微企业 AI 落地',
  coverTitle: '先别买AI系统',
  coverSubTitle: '先把生意讲清楚',
  footerTag: 'AI | 兰州本地 | 小微企业 | 落地案例',
  beats: [
    {
      start: 0.5,
      end: 5.5,
      eyebrow: '反常识开场',
      title: '第一步不是买系统',
      detail: '很多老板一听 AI，先想采购工具，但真正卡住的是业务没讲清。',
      accent: '#FFD23F',
    },
    {
      start: 5.6,
      end: 13.8,
      eyebrow: '核心判断',
      title: '先把生意说清楚',
      detail: '产品、顾客、问题、复购、差评，这些才是 AI 能发挥作用的原料。',
      accent: '#19D3FF',
    },
    {
      start: 13.9,
      end: 29.2,
      eyebrow: '餐饮店例子',
      title: '每天卖什么，顾客问什么？',
      detail: '菜单、常见问题、差评原因、适合拍的视频内容，都要先结构化。',
      accent: '#5CFF8F',
    },
    {
      start: 29.3,
      end: 42.8,
      eyebrow: '落地动作',
      title: '把经验变成 AI 能读的资料',
      detail: '表格、话术、选题库和流程，比一上来买大系统更容易见效。',
      accent: '#FF7A45',
    },
    {
      start: 42.9,
      end: 53.6,
      eyebrow: '最小闭环',
      title: '先跑通一个小结果',
      detail: '短视频选题、客服回复、门店曝光，能验证，再继续往下做。',
      accent: '#B57CFF',
    },
    {
      start: 53.7,
      end: 61.4,
      eyebrow: '账号定位',
      title: '记录甘肃企业怎么用上 AI',
      detail: '不讲虚的，从兰州开始，把本地小微企业一步步带进 AI 时代。',
      accent: '#19D3FF',
    },
  ],
};

export const localBossAiV2Props: TalkProps = {
  ...localBossAiProps,
  coverBgSrc: 'covers/local-boss-ai-cover-bg-v2.svg',
  coverKicker: 'LOCAL AI FIELD NOTES',
  coverTitle: '别急着买AI',
  coverSubTitle: '系统不是第一步',
  footerTag: 'AI | 兰州本地 | 小微企业 | 业务结构化',
  beats: [
    {
      start: 0.5,
      end: 5.5,
      eyebrow: '误区',
      title: '第一步不是买系统',
      detail: 'AI 落地的第一关，不是采购工具，而是把业务讲清楚。',
      accent: '#FFD23F',
      variant: 'statement',
      side: 'left',
      items: ['别先问买什么', '先问业务怎么跑'],
    },
    {
      start: 5.6,
      end: 13.8,
      eyebrow: '判断',
      title: '工具不懂你的生意',
      detail: '产品、顾客、问题、复购、差评，才是 AI 能工作的原料。',
      accent: '#19D3FF',
      variant: 'compare',
      side: 'left',
      leftLabel: '先买系统',
      leftText: '工具很贵，业务仍乱',
      rightLabel: '先讲清楚',
      rightText: '资料清楚，AI 才能帮忙',
    },
    {
      start: 13.9,
      end: 29.2,
      eyebrow: '餐饮店样例',
      title: '老板每天知道很多',
      detail: '真正要做的是把经验从脑子里拿出来，整理成可调用资料。',
      accent: '#5CFF8F',
      variant: 'checklist',
      side: 'left',
      items: ['每天卖什么菜', '顾客常问什么', '差评集中在哪', '哪道菜适合拍视频', '老顾客为何复购'],
    },
    {
      start: 29.3,
      end: 42.8,
      eyebrow: '落地路径',
      title: '经验要变成流程',
      detail: '表格、话术、选题库和流程，是小微企业 AI 落地的底座。',
      accent: '#FF7A45',
      variant: 'flow',
      side: 'right',
      steps: ['老板经验', '结构表格', '客服话术', '选题库', '执行流程'],
    },
    {
      start: 42.9,
      end: 53.6,
      eyebrow: '小闭环',
      title: '先验证一个小结果',
      detail: '短视频选题、客服回复、门店曝光，跑通以后再继续扩大。',
      accent: '#B57CFF',
      variant: 'metric',
      side: 'left',
      metricLabel: '先跑通',
      metricValue: '1 个闭环',
      items: ['短视频选题', '客服回复', '门店曝光'],
    },
    {
      start: 53.7,
      end: 61.4,
      eyebrow: '账号定位',
      title: '记录甘肃企业怎么用上 AI',
      detail: '不讲虚的，从兰州开始，把本地小微企业一步步带进 AI 时代。',
      accent: '#19D3FF',
      variant: 'statement',
      side: 'left',
      items: ['兰州本地', '小微企业', 'AI 实战记录'],
    },
  ],
};

export const normalizeCaptions = (input: unknown): Caption[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      const maybe = item as Partial<Caption>;
      return {
        text: String(maybe.text ?? ''),
        startMs: Number(maybe.startMs ?? 0),
        endMs: Number(maybe.endMs ?? 0),
        timestampMs:
          maybe.timestampMs === null || maybe.timestampMs === undefined
            ? null
            : Number(maybe.timestampMs),
        confidence:
          maybe.confidence === null || maybe.confidence === undefined
            ? null
            : Number(maybe.confidence),
      } satisfies Caption;
    })
    .filter((item) => item.text.trim().length > 0 && item.endMs >= item.startMs);
};
