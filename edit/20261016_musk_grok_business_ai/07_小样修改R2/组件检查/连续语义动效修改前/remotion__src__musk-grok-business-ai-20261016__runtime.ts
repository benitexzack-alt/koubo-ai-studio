import {staticFile} from 'remotion';
import productionProfile from './production-profile.snapshot.json';
import type {FrameWindow, Rect, RenderMode, RuntimePlan} from './types';

const cards = productionProfile.nextEpisodeDefaults.wordCards;
export const TYPE = {
  title: cards.mainTitleOutputPixels,
  supporting: cards.supportingTextOutputPixels,
  category: cards.categoryLabelOutputPixels,
};
export const DEFAULT_REGION: Rect = {x: 64, y: 100, width: 620, height: 360};
export const CAPTION_REGION: Rect = {x: 88, y: 886, width: 1744, height: 168};
export const inside = (frame: number, window: FrameWindow) => frame >= window.from && frame < window.to;
export const progress = (frame: number, start: number, duration: number) => Math.max(0, Math.min(1, (frame - start) / Math.max(1, duration)));
export const easeOut = (value: number) => 1 - (1 - value) ** 4;
export const smooth = (value: number) => value * value * (3 - 2 * value);
export const mix = (a: number, b: number, value: number) => a + (b - a) * value;
export const opacity = (frame: number, window: FrameWindow, fade = 6) => Math.min(progress(frame, window.from, fade), 1 - progress(frame, window.to - fade, fade));

const requireValue: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(`本期数据未就绪：${message}`);
};
const localPath = (value: string) => typeof value === 'string' && value.length > 0 && !/^(?:[a-z]+:|\/)/iu.test(value) && !value.split(/[\\/]/u).includes('..');
export const asset = (source: string, plan: RuntimePlan) => {
  requireValue(localPath(source), `素材只能是本期 publicDir 内路径：${String(source)}`);
  requireValue(plan.assetPrefix === '' || (localPath(plan.assetPrefix) && plan.assetPrefix.endsWith('/')), 'assetPrefix 必须为空或以 / 结尾的相对目录');
  return staticFile(`${plan.assetPrefix}${source}`);
};
export const eventFrame = (plan: RuntimePlan, id: string) => {
  const event = plan.events.find((item) => item.id === id);
  requireValue(event, `缺少实录视觉事件 ${id}`);
  return event.frame;
};

const assertWindow = (window: FrameWindow, duration: number, label: string) => requireValue(
  Number.isInteger(window.from) && Number.isInteger(window.to) && window.from >= 0 && window.to > window.from && window.to <= duration,
  `${label}帧窗无效`,
);
const assertRect = (rect: Rect) => requireValue(
  [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0 && rect.x + rect.width <= 1920 && rect.y + rect.height <= CAPTION_REGION.y - 16,
  '信息层区域越界或进入字幕区',
);

/** 这是本期数据防错，不替代受控生产门、事实核验或用户验收。 */
export const validateRuntimePlan = (plan: RuntimePlan, mode: RenderMode) => {
  requireValue(productionProfile.profileId === 'v9-semantic-direction-sfx' && productionProfile.profileVersion === 'V9', '当前生产档案不是V9');
  requireValue(plan.schemaVersion === 'musk-grok-v9/v1' && plan.width === 1920 && plan.height === 1080 && plan.fps === 30 && plan.durationInFrames === 5035, '本期画幅或全量帧数不符');
  for (const source of [plan.host.src, plan.voice.src, plan.fonts.displaySrc, plan.fonts.captionSrc]) asset(source, plan);
  requireValue(plan.host.trimBeforeFrame === 0 && plan.host.trimAfterFrame === 5035 && plan.voice.trimBeforeFrame === 0 && plan.voice.trimAfterFrame === 5035, '真人和口播须保留0—5035全量同窗');
  requireValue(plan.voice.gain === 1 && plan.voice.playbackRate === 1, '不得用降低口播增益或变速替代动作配声');
  requireValue(plan.captions.length > 0, '待填本期实录双语字幕');
  let captionEnd = 0;
  const captionIds = new Set<string>();
  for (const caption of plan.captions) {
    assertWindow(caption, plan.durationInFrames, `字幕${caption.id}`);
    const englishMayBePending = mode === 'preview' && plan.review.captions === 'pending';
    requireValue(!captionIds.has(caption.id) && caption.from >= captionEnd && caption.chinese.trim() &&
      (caption.english.trim() || englishMayBePending), `字幕${caption.id}重叠、重复或缺少已确认的中英正文`);
    requireValue(caption.highlights.every((word) => word.length > 0 && caption.chinese.includes(word)), `字幕${caption.id}重点词不在实录中`);
    captionIds.add(caption.id); captionEnd = caption.to;
  }
  const eventIds = new Set<string>();
  for (const event of plan.events) {
    requireValue(!eventIds.has(event.id) && Number.isInteger(event.frame) && event.frame >= 0 && event.frame < 5035, `视觉事件${event.id}重复或越界`);
    eventIds.add(event.id);
  }
  for (const cue of plan.overlays) {
    assertWindow(cue, 5035, `信息层${cue.id}`); assertRect(cue.region ?? DEFAULT_REGION);
    requireValue(cue.items.length > 0 && cue.items.length <= 4 && (cue.kind !== 'comparison' || cue.items.length === 2), `信息层${cue.id}对象数量不适合当前布局`);
    for (const item of cue.items) requireValue(item.text.trim() && inside(eventFrame(plan, item.eventId), cue), `信息层${cue.id}事件须在本条帧窗内`);
    if (cue.emphasisEventId) requireValue(inside(eventFrame(plan, cue.emphasisEventId), cue), `信息层${cue.id}强调点越界`);
  }
  const slots = plan.mediaSlots.filter((slot) => slot.window !== null).sort((a, b) => a.window!.from - b.window!.from);
  for (const [index, slot] of slots.entries()) {
    assertWindow(slot.window!, 5035, `素材${slot.id}`);
    requireValue(index === 0 || slot.window!.from >= slots[index - 1].window!.to, '主画面素材窗不能重叠');
  }
  requireValue(['P01', 'P02'].every((id) => plan.mediaSlots.some((slot) => slot.id === id && slot.kind === 'paper')), '保留本期P01和P02两处纸艺槽位');
  for (const slot of plan.mediaSlots) {
    if (slot.state === 'pending') {
      requireValue(slot.reviewStatus === 'pending', `待补素材${slot.id}不得标成已验收`);
      // 候选路径可先登记；pending 素材不进入资源加载或主画面选择。
      if (slot.asset) asset(slot.asset.src, plan);
      continue;
    }
    requireValue(slot.window && slot.asset, `素材${slot.id}待绑定实际文件和帧窗`);
    asset(slot.asset.src, plan);
    requireValue(slot.sourceLabel.trim(), `素材${slot.id}缺来源或说明性质`);
    if (slot.asset.imageFocus) {
      const focus = slot.asset.imageFocus;
      requireValue(slot.kind === 'real-evidence' && slot.asset.type === 'image' &&
        Object.values(focus).every(Number.isFinite) && focus.x >= 0 && focus.y >= 0 &&
        focus.width > 0 && focus.height > 0 && focus.x + focus.width <= focus.sourceWidth &&
        focus.y + focus.height <= focus.sourceHeight, `截图${slot.id}显示视窗越界`);
    }
    if (slot.asset.type === 'video') {
      requireValue(slot.asset.sourceFps > 0 && slot.asset.sourceInFrame >= 0 && slot.asset.sourceDurationFrames !== null, `视频${slot.id}缺源帧数`);
      requireValue((slot.window.to - slot.window.from) / 30 <= (slot.asset.sourceDurationFrames! - slot.asset.sourceInFrame) / slot.asset.sourceFps + 1 / 30, `视频${slot.id}不足以原速覆盖窗口`);
    }
    if (slot.asset.nativeAudio) asset(slot.asset.nativeAudio.src, plan);
    if (slot.asset.audioDisposition === 'preserve') requireValue(slot.asset.nativeAudio, `素材${slot.id}声明保声但缺原生音轨`);
  }
  for (const window of plan.avoidanceWindows) {
    assertWindow(window, 5035, '手势避让'); if (window.region) assertRect(window.region);
    requireValue(window.reason.trim(), '手势避让须记录真实画面依据');
  }
  requireValue(plan.cameraWindows.length > 0, '待按实录填写电子运镜窗口');
  for (const window of plan.cameraWindows) {
    assertWindow(window, 5035, '电子运镜'); requireValue(window.peakScale > 1 && window.peakScale <= 1.08, '电子运镜须可感知且保持温和');
  }
  const sounds = plan.sfx.map((cue) => {
    asset(cue.src, plan);
    const from = eventFrame(plan, cue.eventId) - cue.transientOffsetFrames;
    const duration = cue.trimAfterFrame - cue.trimBeforeFrame;
    requireValue([cue.trimBeforeFrame, cue.trimAfterFrame, cue.transientOffsetFrames, cue.fadeInFrames, cue.fadeOutFrames].every(Number.isInteger) && cue.trimBeforeFrame >= 0 && cue.transientOffsetFrames >= 0 && cue.transientOffsetFrames < duration && cue.fadeInFrames >= 0 && cue.fadeOutFrames >= 0 && cue.gain > 0 && cue.gain <= 1, `音效${cue.id}裁切、瞬态或增益无效`);
    requireValue(plan.events.find((item) => item.id === cue.eventId)?.sound === 'added', `音效${cue.id}事件没有声明附加声`);
    assertWindow({from, to: from + duration}, 5035, `音效${cue.id}`);
    return {from, to: from + duration};
  }).sort((a, b) => a.from - b.from);
  for (let i = 1; i < sounds.length; i++) requireValue(sounds[i].from >= sounds[i - 1].to, '同一时刻最多一个附加前景音效');
  if (mode === 'formal') {
    requireValue(plan.mediaSlots.every((slot) => slot.state === 'ready' && slot.reviewStatus === 'accepted'), '正式模式拒绝待补或未验收素材');
    requireValue(Object.values(plan.review).every((status) => status === 'accepted') && plan.voice.reviewStatus === 'accepted' && plan.sfx.every((cue) => cue.reviewStatus === 'accepted'), '字幕、时点、保护区、视觉或声音尚未验收');
    requireValue(plan.mediaSlots.every((slot) => slot.asset?.audioDisposition !== 'pending'), '原生动作声尚未逐源判断');
  }
};

export const validateEpisodeAssets = async (plan: RuntimePlan, mode: RenderMode, signal?: AbortSignal) => {
  validateRuntimePlan(plan, mode);
  const sources = [plan.host.src, plan.voice.src, plan.fonts.displaySrc, plan.fonts.captionSrc,
    ...plan.mediaSlots.flatMap((slot) => slot.state === 'ready' && slot.asset ? [slot.asset.src, ...(slot.asset.nativeAudio ? [slot.asset.nativeAudio.src] : [])] : []),
    ...plan.sfx.map((cue) => cue.src)];
  await Promise.all([...new Set(sources)].map(async (src) => {
    const response = await fetch(asset(src, plan), {method: 'HEAD', signal});
    requireValue(response.ok && !(response.headers.get('content-type') ?? '').includes('text/html') && response.headers.get('content-length') !== '0', `本地素材没有真实提供：${src}`);
  }));
};
