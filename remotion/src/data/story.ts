import type {Caption} from '@remotion/captions';

export type Beat = {
  start: number;
  end: number;
  eyebrow: string;
  title: string;
  detail: string;
  accent?: string;
  variant?:
    | 'statement'
    | 'compare'
    | 'checklist'
    | 'flow'
    | 'metric'
    | 'ocr-callout'
    | 'keyword-pop'
    | 'perspective'
    | 'mind-map';
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

export type FullScreenBroll = {
  start: number;
  end: number;
  src: string;
  kind: 'image' | 'video';
  title?: string;
  subtitle?: string;
  accent?: string;
  fit?: 'cover' | 'contain';
  dim?: number;
  blur?: number;
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
  brolls?: FullScreenBroll[];
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

export const geoAiRecommendTalk01Props: TalkProps = {
  videoSrc: 'media/GEO_20260709_talk01_16x9_full_proxy.mp4',
  captionsSrc: 'data/GEO_20260709_talk01_16x9.full.captions.json',
  coverImageSrc: 'covers/IMG_1926_cover_base.jpg',
  topic: '以后客户问 AI，凭什么推荐你？',
  hostName: '超哥 AI 创业记',
  identity: '兰州 AI 创业 / 甘肃本地企业 GEO 落地',
  coverTitle: '别让 AI 找不到你',
  coverSubTitle: '本地老板的 GEO 入门',
  coverKicker: 'AI FIELD NOTES',
  footerTag: 'GEO | AI 搜索 | 甘肃本地企业 | 获客',
  cameraMotionStrength: 0.45,
  brolls: [
    {
      start: 6.0,
      end: 13.8,
      src: 'media/GEO_20260709_ai_search_recommendation.mp4',
      kind: 'video',
      title: '客户开始问 AI',
      subtitle: '搜索入口正在从“搜关键词”变成“问问题”。',
      accent: '#19D3FF',
      dim: 0.34,
    },
    {
      start: 33.2,
      end: 42.2,
      src: 'media/GEO_20260709_geo_process_concept.mp4',
      kind: 'video',
      title: 'SEO → GEO',
      subtitle: '过去让搜索引擎找到你，现在让 AI 能理解你。',
      accent: '#5CFF8F',
      dim: 0.3,
    },
    {
      start: 107.2,
      end: 114.8,
      src: 'media/GEO_20260709_content_asset_network.png',
      kind: 'image',
      title: '三类材料',
      subtitle: '身份说清楚、信息对齐、案例写具体。',
      accent: '#FFD23F',
      dim: 0.2,
    },
    {
      start: 159.2,
      end: 166.0,
      src: 'media/GEO_20260709_doubao_test_question.png',
      kind: 'image',
      accent: '#19D3FF',
      fit: 'contain',
      dim: 0.62,
      blur: 5,
    },
    {
      start: 166.0,
      end: 173.2,
      src: 'media/GEO_20260709_deepseek_test_question.png',
      kind: 'image',
      accent: '#B57CFF',
      fit: 'contain',
      dim: 0.62,
      blur: 5,
    },
    {
      start: 184.4,
      end: 191.0,
      src: 'media/GEO_20260709_lanzhou_local_business_ai.mp4',
      kind: 'video',
      title: '整理成内容资产',
      subtitle: '业务、案例、产品和服务，要变成 AI 能读懂的材料。',
      accent: '#5CFF8F',
      dim: 0.28,
    },
  ],
  beats: [
    {
      start: 1.2,
      end: 5.1,
      eyebrow: '黄金首屏',
      title: '客户正在被 AI 抢走',
      detail: '先把注意力拉回来：未来客户可能先问 AI。',
      accent: '#FFD23F',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 28.5,
      end: 45.5,
      eyebrow: '概念翻译',
      title: 'GEO：让 AI 愿意推荐你',
      detail: '不是黑科技，不是玄学服务，而是让 AI 有材料理解你的生意。',
      accent: '#19D3FF',
      variant: 'compare',
      side: 'left',
      leftLabel: 'SEO',
      leftText: '让搜索引擎搜到你',
      rightLabel: 'GEO',
      rightText: '让 AI 理解并提到你',
    },
    {
      start: 60.5,
      end: 88.4,
      eyebrow: '常见问题',
      title: '网上全是套话',
      detail: '专业团队、品质保障、客户至上，AI 很难判断你适合谁。',
      accent: '#FF7A45',
      variant: 'statement',
      side: 'left',
      items: ['你服务谁', '解决什么问题', '有什么案例'],
    },
    {
      start: 104.0,
      end: 154.5,
      eyebrow: '三个动作',
      title: '先补三类材料',
      detail: '先别急着买系统，把 AI 能读取、能判断、能引用的资料补齐。',
      accent: '#5CFF8F',
      variant: 'flow',
      side: 'left',
      steps: ['身份说死', '信息对齐', '案例写实'],
    },
    {
      start: 156.6,
      end: 178.0,
      eyebrow: '自测动作',
      title: '打开豆包，问三个问题',
      detail: '做你这行的公司、你的公司业务、三家本地服务商。',
      accent: '#19D3FF',
      variant: 'checklist',
      side: 'left',
      items: ['行业公司有哪些', 'AI 能不能说对', '推荐里有没有你'],
    },
    {
      start: 181.0,
      end: 207.8,
      eyebrow: '人设锚定',
      title: '把业务整理成内容资产',
      detail: '不是只教工具，而是帮本地企业把业务、案例、产品整理成 AI 能读懂的材料。',
      accent: '#B57CFF',
      variant: 'statement',
      side: 'left',
      items: ['业务', '案例', '产品', '服务'],
    },
    {
      start: 209.4,
      end: 224.5,
      eyebrow: '今天就做',
      title: '公司介绍改成四句话',
      detail: '你在哪、服务谁、解决啥问题、有啥真实案例。',
      accent: '#FFD23F',
      variant: 'metric',
      side: 'left',
      metricLabel: '模板',
      metricValue: '4 句话',
      items: ['在哪里', '服务谁', '解决什么', '真实案例'],
    },
    {
      start: 225.8,
      end: 243.2,
      eyebrow: '行动引导',
      title: '评论区打“模板”',
      detail: '继续记录怎么帮甘肃老板把 AI 用到获客、内容、客户跟进里。',
      accent: '#5CFF8F',
      variant: 'statement',
      side: 'left',
      items: ['获客', '内容', '客户跟进'],
    },
  ],
};

export const localBusinessAiDailyTalk01Props: TalkProps = {
  videoSrc: 'media/GEO_20260710_talk01_16x9_hd.mp4',
  captionsSrc: 'data/GEO_20260710_talk01_16x9.captions.json',
  bilingualCaptionsSrc: 'data/GEO_20260710_talk01_16x9.bilingual.v1.json',
  coverImageSrc: 'media/GEO_20260710_local_owner_phone.png',
  topic: '本地老板，先把这 3 件小事交给 AI',
  hostName: '超哥 AI 创业记',
  identity: '兰州 AI 创业 / 本地生意实操',
  coverTitle: 'AI 先帮你省时间',
  coverSubTitle: '餐饮店 3 个零门槛动作',
  coverKicker: 'LOCAL AI NOTES',
  footerTag: '',
  cameraMotionStrength: 0.42,
  brolls: [
    {start: 31.88, end: 35.8, src: 'media/GEO_20260710_store_owner_anxious.mp4', kind: 'video', title: '第一件：拍照发内容', subtitle: '一张图，变成三套能直接发的内容。', accent: '#19D3FF', dim: 0.31},
    {start: 55.06, end: 58.96, src: 'media/GEO_20260710_manual_records.mp4', kind: 'video', title: '第二件：做活动方案', subtitle: '把生意数据交给 AI，老板用经验拍板。', accent: '#19D3FF', dim: 0.31},
    {start: 73.32, end: 77.2, src: 'media/GEO_20260710_content_touchpoints.png', kind: 'image', title: '第三件：整理客户评价', subtitle: '菜品、服务、环境、价格，自动归类。', accent: '#19D3FF', dim: 0.28},
    {start: 118.28, end: 122.1, src: 'media/GEO_20260710_local_owner_phone.png', kind: 'image', accent: '#19D3FF', dim: 0.28},
    {start: 133.9, end: 137.9, src: 'media/GEO_20260710_empty_store.mp4', kind: 'video', accent: '#19D3FF', dim: 0.31},
  ],
  beats: [
    {start: 1.02, end: 6.94, eyebrow: 'LOCAL-FIRST', title: 'AI 不只属于大公司', detail: '餐饮、装修、民宿、美业，都有马上能用的小动作。', accent: '#19D3FF', variant: 'perspective', side: 'left', items: ['餐饮', '装修', '民宿 / 美业']},
    {start: 7.56, end: 17.72, eyebrow: '先问关系', title: '本地生意，也有关系', detail: '不必先弄懂大模型，先看店里哪件小事能交给 AI。', accent: '#19D3FF', variant: 'keyword-pop', side: 'left'},
    {start: 17.72, end: 22.48, eyebrow: '真实问题', title: '每天该做，却没认真做', detail: '这就是 AI 最先能帮上的地方。', accent: '#19D3FF', variant: 'statement', side: 'left'},
    {start: 23.18, end: 27.98, eyebrow: '餐饮案例', title: '餐饮店的 3 件小事', detail: '直接交给 AI', accent: '#19D3FF', variant: 'mind-map', side: 'left', steps: ['拍照发内容', '做活动方案', '整理客户评价']},
    {start: 28.82, end: 30.92, eyebrow: '01 / CONTENT', title: '拍照发内容', detail: '一张图，不只发一次。', accent: '#19D3FF', variant: 'keyword-pop', side: 'left'},
    {start: 52.54, end: 54.18, eyebrow: '02 / CAMPAIGN', title: '做活动方案', detail: '数据交给 AI，经验留给老板。', accent: '#19D3FF', variant: 'keyword-pop', side: 'left'},
    {start: 70.94, end: 72.64, eyebrow: '03 / REVIEW', title: '整理客户评价', detail: '把零散反馈变成问题清单。', accent: '#19D3FF', variant: 'keyword-pop', side: 'left'},
    {start: 92.36, end: 99.2, eyebrow: '核心判断', title: '第一步，不是比模型', detail: '先找一个高频、重复、能立刻交出去的小动作。', accent: '#19D3FF', variant: 'compare', side: 'left', leftLabel: '先别做', leftText: '比模型 / 搞复杂系统', rightLabel: '先去做', rightText: '跑通一件小事'},
    {start: 99.58, end: 110.08, eyebrow: '记住这三句', title: '三个变换', detail: '让 AI 接手重复活', accent: '#19D3FF', variant: 'mind-map', side: 'left', steps: ['图 → 文案', '套餐 → 活动', '评价 → 清单']},
    {start: 111.62, end: 117.28, eyebrow: '真正价值', title: '省下重复活的时间', detail: '小事跑通，才有后面的增长。', accent: '#19D3FF', variant: 'keyword-pop', side: 'left'},
    {start: 118.28, end: 128.72, eyebrow: '模板化', title: '先跑顺，再固定成模板', detail: '输入菜名，内容直接出，日常经营才会轻一点。', accent: '#19D3FF', variant: 'flow', side: 'left', steps: ['跑通小事', '固定模板', '更省心']},
    {start: 128.72, end: 133.32, eyebrow: 'AI 的价值', title: '不是让你当技术专家', detail: '是把想做、没时间做的事，踏实地落到地上。', accent: '#19D3FF', variant: 'statement', side: 'left'},
    {start: 137.1, end: 140.38, eyebrow: '明天就做', title: '找一件小事，交给 AI', detail: '不用先改变世界，先让店里轻一点。', accent: '#19D3FF', variant: 'keyword-pop', side: 'left'},
    {start: 141.04, end: 146.68, eyebrow: '互动', title: '评论区留言你的行业', detail: '我告诉你，AI 可以从哪件小事开始。', accent: '#19D3FF', variant: 'keyword-pop', side: 'left'},
  ],
};

export const opcWestYouthTalk01Props: TalkProps = {
  videoSrc: 'media/OPC_20260711_talk01_16x9_hd.mp4',
  captionsSrc: 'data/OPC_20260711_talk01_16x9.captions.json',
  bilingualCaptionsSrc: 'data/OPC_20260711_talk01_16x9.bilingual.v1.json',
  coverImageSrc: 'media/OPC_20260711_workbench_screenshot.png',
  topic: '西北年轻人，怎么用 AI 做自己的 OPC',
  hostName: '超哥 AI 创业记',
  identity: '兰州 AI 创业 / 本地 OPC 打样',
  coverTitle: '西北年轻人',
  coverSubTitle: '用 AI 做自己的 OPC',
  coverKicker: 'OPC FIELD NOTES',
  footerTag: '',
  cameraMotionStrength: 0.58,
  brolls: [
    {
      start: 38.12,
      end: 47.86,
      src: 'media/OPC_20260711_local_street_scene.mp4',
      kind: 'video',
      title: '本地不缺场景',
      subtitle: '街区、门店、县城、行业，都是可验证的问题来源。',
      accent: '#19D3FF',
      dim: 0.28,
    },
    {
      start: 81.2,
      end: 96.8,
      src: 'media/OPC_20260711_restaurant_ai_delivery.mp4',
      kind: 'video',
      title: '先做一份看得见的交付',
      subtitle: '新菜图片 → 视频文案 / 活动海报 / 客户评价整理。',
      accent: '#19D3FF',
      dim: 0.22,
    },
    {
      start: 126.5,
      end: 137.62,
      src: 'media/OPC_20260711_youth_skill_delivery.mp4',
      kind: 'video',
      title: '技能要变成交付',
      subtitle: '剪辑、设计、AI 写代码，都要落到真实问题。',
      accent: '#19D3FF',
      dim: 0.24,
    },
    {
      start: 146.4,
      end: 159.38,
      src: 'media/OPC_20260711_workbench_screenshot.png',
      kind: 'image',
      title: '真实问题 → AI 小交付',
      subtitle: '小应用、小流程、小交付，先跑通再公开记录。',
      accent: '#19D3FF',
      fit: 'contain',
      dim: 0.54,
      blur: 3,
    },
  ],
  beats: [
    {
      start: 1.04,
      end: 15.8,
      eyebrow: 'OPC / FIRST QUESTION',
      title: 'OPC 不是概念',
      detail: '把身边真实资源，变成有人买单的交付。',
      accent: '#19D3FF',
      variant: 'perspective',
      side: 'left',
      items: ['真实资源', 'AI 放大', '交付结果'],
    },
    {
      start: 16.5,
      end: 37.3,
      eyebrow: 'DEFINITION / 01',
      title: 'OPC = 一种工作方式',
      detail: '人负责客户、判断和结果；AI 加速重复活。',
      accent: '#19D3FF',
      variant: 'compare',
      side: 'left',
      leftLabel: '不是',
      leftText: '一个人干完所有活',
      rightLabel: '而是',
      rightText: '人守结果，AI 做重复活',
    },
    {
      start: 48.46,
      end: 66.45,
      eyebrow: 'LOCAL RESOURCE MAP',
      title: '身边资源，不是落后资源',
      detail: '真实问题',
      accent: '#19D3FF',
      variant: 'mind-map',
      side: 'left',
      steps: ['餐饮', '设计', '装修', '民宿', '家具店'],
    },
    {
      start: 67.14,
      end: 79.26,
      eyebrow: '3 LEVERS',
      title: '三根杠杆',
      detail: '真实场景、看得见的交付、真实反馈。',
      accent: '#19D3FF',
      variant: 'perspective',
      side: 'left',
      items: ['真实场景', '看得见的交付', '真实反馈'],
    },
    {
      start: 99.48,
      end: 113.8,
      eyebrow: 'FIRST ASSET',
      title: '第一份 OPC 资料',
      detail: '不是计划书，是一次真实反馈。',
      accent: '#19D3FF',
      variant: 'metric',
      side: 'left',
      metricLabel: '验证',
      metricValue: '3 个问题',
      items: ['愿不愿意用', '有没有省时间', '会不会再找你'],
    },
    {
      start: 114.58,
      end: 125.94,
      eyebrow: 'MINIMUM LOOP',
      title: '先做一个小闭环',
      detail: '行业 → 重复动作 → 结果 → 反馈。',
      accent: '#19D3FF',
      variant: 'flow',
      side: 'left',
      steps: ['找行业', '盯动作', '交结果', '拿反馈'],
    },
    {
      start: 138.88,
      end: 143.3,
      eyebrow: 'CORE STANDARD',
      title: '先让一个人说：有用',
      detail: '再谈规模化。',
      accent: '#FFD23F',
      variant: 'keyword-pop',
      side: 'left',
    },
    {
      start: 163.14,
      end: 172.48,
      eyebrow: 'PARTNER SIGNAL',
      title: '我要找这类年轻人',
      detail: '有场景、有技能、愿意打样。',
      accent: '#19D3FF',
      variant: 'checklist',
      side: 'left',
      items: ['本地场景', '一项技能', '愿意打样'],
    },
    {
      start: 173.08,
      end: 186.06,
      eyebrow: 'COMMENT CTA',
      title: '评论区留下三件事',
      detail: '城市、技能、身边行业资源。',
      accent: '#19D3FF',
      variant: 'mind-map',
      side: 'left',
      steps: ['你的城市', '你会什么', '行业资源'],
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
