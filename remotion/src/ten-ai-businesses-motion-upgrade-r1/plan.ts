/** 独立参考适配候选；不是官方 HyperFrames 模块，也不是本期实录时间轴。 */
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const SEGMENT_FRAMES = 240;
export const EFFECT_KINDS = ['burst', 'chapter', 'list', 'opposing', 'pipeline', 'equation'] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];
export const DEMO_FRAMES = SEGMENT_FRAMES * EFFECT_KINDS.length;
export const DEFAULT_BURST_STATEMENT = '10个AI赚钱生意';
export const DEFAULT_BURST_LINES = ['10个AI', '赚钱生意'] as const;

export const PAPER_ORANGE = {
  canvas: '#F5EDE0', surface: '#FFFCF6', text: '#30281F', muted: '#71614F',
  accent: '#E36F3D', accentInk: '#201811', rule: '#D2BFA7',
} as const;
export const TYPE = {headline: 60, body: 44, label: 32} as const;
export const OVERLAY_BOUNDS = {left: 64, top: 96, width: 760, height: 680} as const;
export const PRESENTER_PROTECTION = {left: 880, top: 160, width: 480, height: 680} as const;
export const SUBTITLE_PROTECTION = {left: 64, top: 870, width: 1776, height: 146} as const;

export const CHAPTERS = [
  ['AI Agent', '落地服务商'], ['垂类行业', '数据集生产'], ['AI内容', '反同质化服务'],
  ['AI设备的', '“最后一公里”渠道'], ['银发族AI陪伴', '与生活服务'],
  ['AI原生的', '组织咨询服务'], ['GEO代运营'], ['AI时代的', '数据资产中介'],
  ['产业带AI改造', '“包工头”'], ['“人机协作”', '技能培训'],
] as const;

export const EFFECT_REFERENCES: Record<EffectKind, string> = {
  burst: 'bs-creatormotion-type-burst-statement', chapter: 'bs-creatormotion-chapter-title-stamp',
  list: 'bs-creatormotion-cards-sequential-list', opposing: 'bs-creatormotion-type-opposing-labels',
  pipeline: 'bs-creatormotion-diagram-pipeline-package', equation: 'bs-creatormotion-diagram-additive-equation',
};
export const EFFECT_NAMES: Record<EffectKind, string> = {
  burst: '开头大词条', chapter: '十项章名', list: '顺序揭示', opposing: '不对称对照',
  pipeline: '流程收束', equation: '组成关系',
};

export interface SoundCue {
  at: number;
  duration: number;
  source: string;
  gain: number;
  role: string;
}
export const SOUND_ASSETS = {
  hook: {duration: 11, peakDbfs: -14, peakOffsetFrames: 0.27},
  confirm: {duration: 5, peakDbfs: -20, peakOffsetFrames: 0.16},
  keyword: {duration: 8, peakDbfs: -18, peakOffsetFrames: 0.39},
  sweep: {duration: 6, peakDbfs: -18, peakOffsetFrames: 1.15},
  click: {duration: 9, peakDbfs: -20, peakOffsetFrames: 1.07},
  slide: {duration: 12, peakDbfs: -18, peakOffsetFrames: 1},
  connect: {duration: 12, peakDbfs: -18, peakOffsetFrames: 0.63},
} as const;
const cue = (at: number, asset: keyof typeof SOUND_ASSETS, role: string): SoundCue => ({
  at, duration: SOUND_ASSETS[asset].duration, source: `motion-upgrade-r1/sfx/${asset}.wav`, gain: 1, role,
});

/** 本期派生 WAV 已源截取/峰归一；每个场景只保留一个前景音，未绑定实际人声。 */
export const SOUND_CUES: Record<EffectKind, readonly SoundCue[]> = {
  burst: [cue(15, 'hook', '钩子数字入场'), cue(79, 'keyword', '题名揭示')],
  chapter: [cue(5, 'sweep', '章名旋转入场'), cue(22, 'confirm', '序号读稳')],
  list: [10, 39, 68, 97].map((at) => cue(at, 'click', '逐项文字揭示')),
  opposing: [cue(11, 'keyword', '初始词入场'), cue(66, 'slide', '左侧印刷词入场'),
    cue(83, 'keyword', '右侧对照词入场')],
  pipeline: [5, 29, 53].map((at) => cue(at, 'connect', '阶段节点入场'))
    .concat([cue(72, 'keyword', '交付输出显现'), cue(102, 'sweep', '整组开始收束'),
      cue(128, 'click', '边界显现'), cue(149, 'confirm', '结果关系显现')]),
  equation: [cue(5, 'connect', '部件一入场'), cue(25, 'keyword', '部件二入场'),
    cue(47, 'confirm', '组成结果显现')],
};

export const CANDIDATE_STATUS = {
  kind: '原生Remotion参考适配候选', sourceRuntime: 'HyperFrames', runtime: 'Remotion',
  paperRouteUnchanged: true, productionAdopted: false, actualPresenterBound: false,
  actualSpokenTimingBound: false, humanAudioAccepted: false, humanVisualAccepted: false,
  presenterLayoutReference: 'motion-upgrade-r1/presenter-layout-reference.png',
} as const;
