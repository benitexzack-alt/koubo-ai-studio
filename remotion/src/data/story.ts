import type {Caption} from '@remotion/captions';

export type Beat = {
  start: number;
  end: number;
  eyebrow: string;
  title: string;
  detail: string;
  accent?: string;
};

export type TalkProps = {
  videoSrc: string;
  captionsSrc: string;
  topic: string;
  hostName: string;
  identity: string;
  coverTitle: string;
  coverSubTitle: string;
  footerTag: string;
  beats: Beat[];
};

export const defaultTalkProps: TalkProps = {
  videoSrc: 'media/IMG_1911_proxy_16x9.mp4',
  captionsSrc: 'data/IMG_1911.captions.json',
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
