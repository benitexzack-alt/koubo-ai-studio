/** 本期数据接口；所有帧窗为 30fps、左闭右开，src 相对本期 publicDir。 */
export type FrameWindow = {from: number; to: number};
export type Rect = {x: number; y: number; width: number; height: number};
export type ReviewStatus = 'pending' | 'accepted';
export type RenderMode = 'preview' | 'formal';

export type Caption = FrameWindow & {
  id: string;
  chinese: string;
  english: string;
  highlights: string[];
};

export type VisualEvent = {
  id: string;
  frame: number;
  sound: 'silent' | 'added' | 'native';
  reason: string;
};

export type OverlayCue = FrameWindow & {
  id: string;
  kind: 'comparison' | 'tags' | 'cta' | 'hook-reveal' | 'continuous-business' | 'wording-choice';
  /** 必须来自本期实录；组件不预写观点或模型排名。 */
  title?: string;
  items: Array<{text: string; eventId: string; label?: string}>;
  /** comparison 两项都出现后，才强调第二项。 */
  emphasisEventId?: string;
  region?: Rect;
};
export type CameraWindow = FrameWindow & {peakScale: number; motion?: 'push-hold'; settleFrame?: number; releaseFrames?: number};

export type MediaAsset = {
  type: 'image' | 'video';
  src: string;
  sourceInFrame: number;
  sourceFps: number;
  sourceDurationFrames: number | null;
  audioDisposition: 'pending' | 'preserve' | 'omit-unusable' | 'not-applicable';
  audioReason: string;
  /** 从该素材取得的原生声；独立路径避免重复播放主口播。 */
  nativeAudio: null | {src: string; gain: number};
  /** 只改变截图的显示视窗，原截图文件保持完整。 */
  imageFocus?: Rect & {sourceWidth: number; sourceHeight: number};
};

export type MediaSlot = {
  id: string;
  kind: 'paper' | 'real-evidence';
  window: FrameWindow | null;
  state: 'pending' | 'ready';
  reviewStatus: ReviewStatus;
  asset: MediaAsset | null;
  displayTitle?: string;
  /** 真实资料展示官方来源名称；纸艺统一显示说明性质。 */
  sourceLabel: string;
};

export type SfxCue = {
  id: string;
  eventId: string;
  src: string;
  /** 裁切帧按本期 30fps 换算；transientOffset 从裁切后起点计。 */
  trimBeforeFrame: number;
  trimAfterFrame: number;
  transientOffsetFrames: number;
  gain: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  reviewStatus: ReviewStatus;
};

export type RuntimePlan = {
  schemaVersion: 'musk-grok-v9/v1';
  width: 1920;
  height: 1080;
  fps: 30;
  durationInFrames: 5035;
  assetPrefix: string;
  fonts: {displaySrc: string; captionSrc: string};
  host: {src: string; trimBeforeFrame: number; trimAfterFrame: number};
  voice: {
    src: string;
    trimBeforeFrame: number;
    trimAfterFrame: number;
    gain: 1;
    playbackRate: 1;
    reviewStatus: ReviewStatus;
  };
  captions: Caption[];
  events: VisualEvent[];
  overlays: OverlayCue[];
  mediaSlots: MediaSlot[];
  /** 默认为左上候选区；手势经过时指定替代区域，null 表示暂时隐藏信息层。 */
  avoidanceWindows: Array<FrameWindow & {region: Rect | null; reason: string}>;
  /** 仅变换真人空间，不改变真人播放速度。 */
  cameraWindows: CameraWindow[];
  sfx: SfxCue[];
  review: {
    captions: ReviewStatus;
    timing: ReviewStatus;
    visual: ReviewStatus;
    audio: ReviewStatus;
    safeAreas: ReviewStatus;
  };
};

export type EpisodeProps = {plan: RuntimePlan; withSfx: boolean; mode: RenderMode};
