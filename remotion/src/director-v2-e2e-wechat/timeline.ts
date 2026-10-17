import mediaContract from './candidate-media-contract.json';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_IN_FRAMES = 45 * FPS;

export const SPOKEN_SOURCE_IN_SECONDS = mediaContract.spokenMedia.sourceRangeSeconds[0];
export const SPOKEN_SOURCE_OUT_SECONDS = mediaContract.spokenMedia.sourceRangeSeconds[1];

export const BOUNDARIES = {
  queryEnd: Math.round(10.64 * FPS),
  oldSearchEnd: Math.round(22.23 * FPS),
  proofEnd: Math.round(36.64 * FPS),
  end: DURATION_IN_FRAMES,
} as const;

export type CaptionCue = {
  id: string;
  start: number;
  end: number;
  text: string;
};

// 字幕正文取自 canonical cleaned 实录：
// edit/20260823_wechat_geo_aao/transcripts/WECHAT_GEO_AAO_20260823_talk01.cleaned.v1.json
// 时间窗与全量文本只从 candidate-media-contract 读取；验证器会对照
// canonical cleaned 正文、原音 23.32–68.32 秒窗及 0–45 秒连续性。
// 两处可由原音确认的 ASR 纠错及其原文对照只记录在媒体合同，字幕正文只读取 canonical cleaned cues。
export const CAPTION_CUES: CaptionCue[] = mediaContract.captionAuthority.cues.map((cue) => ({
  id: cue.id,
  start: cue.start,
  end: cue.end,
  text: cue.text,
}));

export const SCREEN_CLIPS = {
  ...mediaContract.screenClips,
  excludedPrivacyAndLoading: mediaContract.excludedScreenRange,
} as const;

export const SCREEN_CLIP_RUNTIME_ORDER = mediaContract.screenClipRuntimeOrder;
