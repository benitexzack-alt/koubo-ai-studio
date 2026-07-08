import type {Caption} from '@remotion/captions';

export type Beat = {
  start: number;
  end: number;
  eyebrow: string;
  title: string;
  detail: string;
  accent?: string;
  variant?: 'statement' | 'compare' | 'checklist' | 'flow' | 'metric' | 'ocr-callout' | 'keyword-pop';
  side?: 'left' | 'right';
  items?: string[];
  steps?: string[];
  leftLabel?: string;
  leftText?: string;
  rightLabel?: string;
  rightText?: string;
  metricLabel?: string;
  metricValue?: string;
  canvas?: {
    width: number;
    height: number;
  };
  callouts?: Array<{
    text: string;
    label?: string;
    box: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    padding?: number;
  }>;
};

export type TalkProps = {
  videoSrc: string;
  captionsSrc: string;
  englishCaptionsSrc?: string;
  bilingualCaptionsSrc?: string;
  coverImageSrc: string;
  topic: string;
  hostName: string;
  identity: string;
  coverTitle: string;
  coverSubTitle: string;
  coverKicker?: string;
  coverBgSrc?: string;
  footerTag: string;
  cameraMotionStrength?: number;
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

export const localBossAiOcrDemoProps: TalkProps = {
  ...localBossAiV2Props,
  topic: 'OCR 标注测试',
  beats: [
    {
      start: 0.2,
      end: 3.8,
      eyebrow: 'OCR 标注',
      title: '指哪打哪',
      detail: '用坐标把重点打到画面上。',
      accent: '#FFD23F',
      variant: 'ocr-callout',
      canvas: {
        width: 1920,
        height: 1080,
      },
      callouts: [
        {
          text: '本地老板用 AI',
          label: '高亮这句话',
          box: {
            x: 1330,
            y: 42,
            width: 515,
            height: 72,
          },
          padding: 10,
        },
      ],
    },
  ],
};

export const smallBusinessAiV1Props: TalkProps = {
  videoSrc: 'media/IMG_20260707_small_business_ai_rough_v2.mp4',
  captionsSrc: 'data/IMG_20260707_small_business_ai.edl.v2.captions.json',
  englishCaptionsSrc: 'data/IMG_20260707_small_business_ai.edl.v2.english.json',
  bilingualCaptionsSrc: 'data/IMG_20260707_small_business_ai.bilingual.v3.json',
  coverImageSrc: 'covers/IMG_1926_cover_base.jpg',
  topic: '小企业用 AI，第一步不是买系统',
  hostName: '兰州 AI 创业者彭超',
  identity: '甘肃小微企业 AI 落地',
  coverTitle: '小企业用AI',
  coverSubTitle: '第一步不是买系统',
  coverKicker: 'LOCAL AI FIELD NOTES',
  footerTag: 'AI | 小微企业 | 重复动作 | 业务自动化',
  beats: [
    {
      start: 0.4,
      end: 7.6,
      eyebrow: '反常识开场',
      title: '第一步不是买系统',
      detail: '先别采购工具，先找一个每天都在重复的业务动作。',
      accent: '#FFD23F',
      variant: 'compare',
      side: 'left',
      leftLabel: '先买系统',
      leftText: '花钱快，落地慢',
      rightLabel: '先找动作',
      rightText: '马上能验证',
    },
    {
      start: 8.0,
      end: 20.2,
      eyebrow: '问题根源',
      title: '聊天窗口不是业务流程',
      detail: '会写文案、会解释表格，不等于公司真的变高效。',
      accent: '#19D3FF',
      variant: 'statement',
      side: 'left',
      items: ['文案', '通知', '表格', '流程仍旧'],
    },
    {
      start: 20.3,
      end: 28.4,
      eyebrow: '关键词',
      title: '关掉窗口，业务没变',
      detail: '这就是聊天式 AI 和业务流程之间的距离。',
      accent: '#19D3FF',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 30.8,
      end: 35.1,
      eyebrow: '旧 AI',
      title: '你问，它答',
      detail: '有用，但还不是自动化。',
      accent: '#FFD23F',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 35.2,
      end: 49.4,
      eyebrow: '能力变化',
      title: 'AI 开始替你做一段工作',
      detail: '本地广告、网站文案、短视频脚本、客户评论回复，都可以进入流程。',
      accent: '#5CFF8F',
      variant: 'checklist',
      side: 'left',
      items: ['本地广告', '网站文案', '短视频脚本', '评论回复', '跟进提醒'],
    },
    {
      start: 49.8,
      end: 57.8,
      eyebrow: '落地场景',
      title: '分类，再提醒跟进',
      detail: '不是生成一句话，而是推进一个动作。',
      accent: '#5CFF8F',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 58.2,
      end: 80.0,
      eyebrow: '安全纪律',
      title: 'AI 做事，人守门',
      detail: '发客户、付款、发布、提交之前，必须有人确认。',
      accent: '#FF7A45',
      variant: 'flow',
      side: 'left',
      steps: ['AI 草拟', '内部检查', '人工确认', '再发布'],
    },
    {
      start: 72.6,
      end: 80.2,
      eyebrow: '安全边界',
      title: '必须有人确认',
      detail: '该放行的最后一步，永远在人。',
      accent: '#FF7A45',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 80.4,
      end: 97.5,
      eyebrow: '启动方法',
      title: '列一个反待办清单',
      detail: '写下你不想再亲手做的事，但只挑一个任务先跑。',
      accent: '#B57CFF',
      variant: 'checklist',
      side: 'left',
      items: ['不想亲手做', '每天重复', '风险可控', '只挑一个'],
    },
    {
      start: 97.6,
      end: 108.2,
      eyebrow: '执行动作',
      title: '资料先喂给 AI',
      detail: '产品、报价、问题、聊天记录，先整理清楚。',
      accent: '#B57CFF',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 108.4,
      end: 122.4,
      eyebrow: '验证闭环',
      title: '一周只看三个指标',
      detail: '别看热闹，看它有没有真的改变业务动作。',
      accent: '#19D3FF',
      variant: 'metric',
      side: 'left',
      metricLabel: '观察',
      metricValue: '3 个指标',
      items: ['省时间', '少漏跟进', '改改能用'],
    },
    {
      start: 128.1,
      end: 138.3,
      eyebrow: '常见误区',
      title: '先别急着换工具',
      detail: '很多时候，是资料太少、太旧、太乱。',
      accent: '#19D3FF',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 143.2,
      end: 149.9,
      eyebrow: '筛选标准',
      title: '重复 高频 低风险',
      detail: '再加一条：能检查。',
      accent: '#5CFF8F',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 149.8,
      end: 168.8,
      eyebrow: '结尾金句',
      title: '不要先追风口',
      detail: '先省下一个人的半小时，业务跑顺了，再谈系统化、自动化、智能化。',
      accent: '#FFD23F',
      variant: 'statement',
      side: 'left',
      items: ['先省半小时', '再跑顺业务', '最后谈系统'],
    },
  ],
};

export const gansuStoreAiTalk01Props: TalkProps = {
  videoSrc: 'media/IMG_20260708_talk01_16x9_rough_v2.mp4',
  captionsSrc: 'data/IMG_20260708_talk01_16x9.edl.v1.captions.json',
  bilingualCaptionsSrc: 'data/IMG_20260708_talk01_16x9.bilingual.v2.json',
  coverImageSrc: 'covers/IMG_1926_cover_base.jpg',
  topic: '甘肃实体店老板，别被 AI 忽悠',
  hostName: '超哥 AI 创业记',
  identity: '甘肃本地小微企业 AI 落地',
  coverTitle: '实体店老板',
  coverSubTitle: '别被 AI 忽悠',
  coverKicker: 'LOCAL AI FIELD NOTES',
  footerTag: 'AI | 甘肃实体店 | 小微企业 | 真实落地',
  cameraMotionStrength: 0.55,
  beats: [
    {
      start: 0.4,
      end: 3.4,
      eyebrow: '开场钩子',
      title: '别被 AI 忽悠',
      detail: '先把神话拿掉，只看能不能解决本地生意里的真问题。',
      accent: '#FFD23F',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 14.8,
      end: 27.0,
      eyebrow: '账号定位',
      title: '只关心真问题',
      detail: '不聊玄乎概念，只把 AI 翻译成老板听得懂、用得上的小动作。',
      accent: '#19D3FF',
      variant: 'statement',
      side: 'left',
      items: ['听得懂', '用得上', '能验证'],
    },
    {
      start: 27.0,
      end: 39.8,
      eyebrow: '本地场景',
      title: '从店里的小事开始',
      detail: '餐饮、家具、工厂，都先找一个真实业务动作。',
      accent: '#5CFF8F',
      variant: 'checklist',
      side: 'left',
      items: ['餐饮店选题', '家具店话术', '工厂客户跟进'],
    },
    {
      start: 39.8,
      end: 54.8,
      eyebrow: '反常识',
      title: '第一步不是买系统',
      detail: '系统不是起点，重复的小动作才是起点。',
      accent: '#FFD23F',
      variant: 'compare',
      side: 'left',
      leftLabel: '先买系统',
      leftText: '花钱快，验证慢',
      rightLabel: '先找小事',
      rightText: '一周就能看结果',
    },
    {
      start: 54.8,
      end: 72.2,
      eyebrow: '验证方法',
      title: '一周只看三件事',
      detail: '别看概念热不热，看它有没有改变具体动作。',
      accent: '#19D3FF',
      variant: 'metric',
      side: 'left',
      metricLabel: '观察',
      metricValue: '3 件事',
      items: ['省时间', '少漏跟进', '改改能用'],
    },
    {
      start: 72.2,
      end: 77.9,
      eyebrow: '纠偏',
      title: '先别怪 AI',
      detail: '很多时候不是模型不行，是资料太乱、太少。',
      accent: '#FF7A45',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 83.6,
      end: 96.1,
      eyebrow: '真实边界',
      title: '不承诺变现',
      detail: '做成了讲透，做不成把坑讲清楚。',
      accent: '#B57CFF',
      variant: 'statement',
      side: 'left',
      items: ['不造神话', '不追风口', '公开记录'],
    },
    {
      start: 96.1,
      end: 105.5,
      eyebrow: '记忆点',
      title: '先省下半小时',
      detail: '先让 AI 帮你省下一点真实时间，再谈系统化。',
      accent: '#FFD23F',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 105.5,
      end: 117.9,
      eyebrow: '现场证明',
      title: '我自己也先这么干',
      detail: '文稿、字幕、剪辑，都用 Codex 辅助完成。',
      accent: '#5CFF8F',
      variant: 'flow',
      side: 'left',
      steps: ['文稿', '字幕', '剪辑', '复盘'],
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
