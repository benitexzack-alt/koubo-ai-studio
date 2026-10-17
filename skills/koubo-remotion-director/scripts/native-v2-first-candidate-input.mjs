import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateDirectorCuesV2File} from './director-cues-v2-core.mjs';
import {assertCurrentPaperBaseline, PAPER_TEXT_POLICY} from './paper-quality-baseline.mjs';
import {paperMediaTools, runPaperMediaTool} from './paper-asset-intake-media.mjs';
import {sha256File} from './preproduction-director-core.mjs';

export const NATIVE_V2_INPUT_FORMAT = 'director-cues-v2-surface-bound';
export const NATIVE_V2_ARTIFACTS = Object.freeze([
  'directorCues', 'runtimePlan', 'spokenTimeline', 'postshootRebind',
  'mediaIntake', 'factReview', 'userScope',
]);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
// 只容忍排版标点差异；小数点、负号、百分号等仍是正文信息。
const normal = (value) => String(value ?? '').replace(/[\s，。！？、；：…“”‘’「」『』（）()"'!?;:,]/gu, '');
const requireValue = (condition, code, details) => {
  if (!condition) throw Object.assign(new Error(`原生v2候选输入拒绝：${code}`), {code, details});
};
const reviewStatus = (value) => value === 'pending' || value === 'accepted';
const verifiedMedia = new Map();
const verifiedPcm = new Map();
export const nativeV2FullDecodeTimeoutMs = (durationSeconds) => Math.min(600000, Math.max(120000, Math.ceil(durationSeconds * 2000)));

// 用户只接受本期 P01 的静态用途；不把历史结构/OCR失败改写为动态验收通过。
const AGILITY_STATIC_PAPER = Object.freeze({
  episodeId: 'small-business-ai-agility-20261017', taskId: 'SMALL_BUSINESS_AI_AGILITY_20261017',
  selectionPath: 'edit/20261017_small_business_ai_agility/00_控制/P01静图选择与Remotion预览请求.v1.json',
  selectionSha256: '11b5d7522abe960ca5dfded7f1268d196938c871a7cb1ee4edc2d3fe7cf70188',
  imagePath: 'edit/20261017_small_business_ai_agility/01_素材投放区/04_纸艺视频/P01_首帧_r1.png',
  imageSha256: 'fbcd564b441932f28b3543dc7c2460b1b92241c010354a5b965427889fa8a0b0',
  previousQaPath: 'edit/20261017_small_business_ai_agility/04_首帧质检/P01_生成与检查回执_r1-r2.json',
  previousQaSha256: 'cd07bcc90be5078be2bda1cd64916815121ec0f1dfa623ca3f1388eefd621d12',
});

export function validateAgilityStaticPaperSelection({projectRoot, contract, job, scope, runtime, closure, itemFor}) {
  const fixed = AGILITY_STATIC_PAPER;
  requireValue(contract.episodeId === fixed.episodeId && contract.taskId === fixed.taskId &&
    job.videoId === fixed.episodeId && scope.scope?.useUserSelectedStaticPaper === true &&
    scope.scope.useExistingPaperVideos === false, 'NV2_STATIC_PAPER_SCOPE_INVALID');
  const bound = (reference, path, hash) => reference?.sha256 === hash &&
    resolve(projectRoot, reference.path ?? '') === resolve(projectRoot, path) &&
    sha256File(resolve(projectRoot, path)) === hash;
  requireValue(bound(scope.staticPaperSelection, fixed.selectionPath, fixed.selectionSha256) &&
    bound(scope.staticPaperPreviousQa, fixed.previousQaPath, fixed.previousQaSha256),
    'NV2_STATIC_PAPER_SELECTION_INVALID');
  const selection = closure.document(scope.staticPaperSelection).body;
  closure.document(scope.staticPaperPreviousQa);
  requireValue(selection.schemaVersion === 'episode-static-paper-user-selection/v1' &&
    selection.episodeId === fixed.episodeId && selection.taskId === fixed.taskId &&
    selection.source === 'current-human-chat-message' && selection.staticImageChoiceAccepted === true &&
    selection.staticDowngrade?.approved === true && selection.staticDowngrade.approvedBy === 'user' &&
    selection.dynamicQualityAccepted === false && selection.previousQaPreserved === true &&
    selection.previousQaPath === fixed.previousQaPath && selection.formalAccepted === false &&
    selection.fullWatchConfirmed === false && selection.publishAuthorized === false &&
    selection.independentSignature === false && selection.runningHubAuthorized === false &&
    selection.videoGenerationOnExternalPlatformAuthorized === false &&
    selection.userQuotes?.includes('直接就用这张静态图片去Remotion直接生成视频就行了。') &&
    bound(selection.selectedImage, fixed.imagePath, fixed.imageSha256), 'NV2_STATIC_PAPER_ACCEPTANCE_INVALID');
  const papers = runtime.mediaSlots.filter(slot => slot.kind === 'paper');
  requireValue(runtime.fps === 30 && papers.length === 1 && papers[0].id === 'P01' &&
    papers[0].state === 'ready' && papers[0].window?.from === 1998 && papers[0].window.to === 2238 &&
    papers[0].asset?.type === 'image' && papers[0].asset.sourceInFrame === 0 &&
    papers[0].asset.nativeAudio === null && papers[0].asset.audioDisposition === 'not-applicable' &&
    (papers[0].asset.playbackRate === undefined || papers[0].asset.playbackRate === 1),
    'NV2_STATIC_PAPER_SLOT_INVALID');
  const item = itemFor(papers[0].asset.src);
  requireValue(item.media?.type === 'image' && bound(item.source, fixed.imagePath, fixed.imageSha256) &&
    bound(item.sourceReceipt, fixed.selectionPath, fixed.selectionSha256) &&
    item.renderAsset?.sha256 === fixed.imageSha256 &&
    sha256File(resolve(projectRoot, item.renderAsset.path)) === fixed.imageSha256,
    'NV2_STATIC_PAPER_ASSET_INVALID');
  return true;
}

// 仅本期 R3 的真实校字指令；保留旧 11 条候选，新增范围严格来自已保存的 8 条实际差异。
export function validateMuskGrokR3UserDirectedCorrections({projectRoot, contract, job, correction, segments, closure}) {
  const revision = 'musk-grok-business-ai-v9-full-candidate-r3-20261016';
  requireValue(contract.episodeId === 'musk-grok-business-ai-20261016' &&
    contract.taskId === '20261016_musk_grok_business_ai_director_v2' && contract.revisionId === revision &&
    job.videoId === contract.episodeId && job.jobId === '20261016_musk_grok_business_ai_v9_candidate' &&
    job.productionGate?.revisionId === revision, 'NV2_R3_CORRECTION_SCOPE_INVALID');
  requireValue(correction.schemaVersion === 'episode-user-directed-spelling-corrections/v1' &&
    correction.userDirectedSpellingOnly === true && correction.fullNormalSpeedListeningPerformed === false &&
    correction.factsVerified === false && correction.formalAuthorized === false && correction.publishAuthorized === false,
    'NV2_R3_CORRECTION_ACCEPTANCE_INVALID');
  const prefix = 'edit/20261016_musk_grok_business_ai/';
  const expected = {
    baseCorrectionReceipt: ['04_后期准备/字幕制作/识别修正与待听词.v1.json', '189eceb306cbbd02d6fd9c52b85b821b22fe36a752dfa4313a6373b74698b333'],
    userInstruction: ['08_字幕校正R3/用户校字原话.v1.json', 'eb073c83e23e1ccdb403a4446be0f2d4ceaa1ea240e41be0a9bfc1c8e53d8c8a'],
    changeReport: ['08_字幕校正R3/校字变更与检查.v1.json', '1c922a08b42b583aee5f615ca6f9d4d93ccd6e67dfe4a8476e0eb08ed86a35c9'],
    exportInstruction: ['09_正片导出R3/本轮正片导出原话.v1.json', 'b17d7c34f28019f1685fc947075becaff945745a3db406f4c6d3b067bb549a68'],
  };
  const records = {};
  for (const [key, [suffix, hash]] of Object.entries(expected)) {
    const reference = correction[key];
    requireValue(reference?.sha256 === hash &&
      resolve(projectRoot, reference.path) === resolve(projectRoot, prefix + suffix) &&
      sha256File(resolve(projectRoot, reference.path)) === hash, 'NV2_R3_CORRECTION_SOURCE_INVALID');
    records[key] = closure.document(reference).body;
  }
  const base = records.baseCorrectionReceipt.corrections, changes = records.changeReport.changes;
  requireValue(base.length === 11 && changes.length === 8 && correction.corrections.length === 19 &&
    JSON.stringify(correction.corrections.slice(0, 11)) === JSON.stringify(base), 'NV2_R3_BASE_CORRECTIONS_CHANGED');
  for (const [index, change] of changes.entries()) {
    const entry = correction.corrections[11 + index];
    const segment = segments.find(item => item.id === Number(change.captionId.slice(1)) - 1);
    requireValue(segment && entry.captionId === change.captionId && entry.segmentId === segment.id &&
      entry.raw_text === change.before && entry.text === change.after && entry.basis === change.basis &&
      entry.start === segment.start && entry.end === segment.end &&
      Math.abs(Math.round(segment.start * 30) - change.from) <= 1 &&
      Math.abs(Math.round(segment.end * 30) - change.to) <= 1 && normal(segment.text) === normal(change.after) &&
      entry.status === 'user-directed-spelling-correction' && entry.userDirected === true &&
      entry.humanListeningPerformed === false && entry.userConfirmed === false,
      'NV2_R3_CORRECTION_DIFF_MISMATCH');
  }
  return true;
}

function decodedPcmHash(reference, projectRoot) {
  const tool = paperMediaTools(['ffmpeg']).ffmpeg;
  const file = resolve(projectRoot, reference.path);
  const key = `${file}:${reference.sha256}:${tool.sha256}`;
  requireValue(sha256File(file) === reference.sha256, 'NV2_ORIGINAL_AUDIO_SHA_CHANGED');
  if (!verifiedPcm.has(key)) {
    const value = runPaperMediaTool(tool, ['-nostdin', '-v', 'error', '-xerror', '-i', file,
      '-map', '0:a:0', '-c:a', 'pcm_s16le', '-f', 'hash', '-hash', 'sha256', '-']).stdout.trim();
    requireValue(/^SHA256=[a-f0-9]{64}$/u.test(value) && sha256File(file) === reference.sha256,
      'NV2_ORIGINAL_AUDIO_HASH_INVALID');
    verifiedPcm.set(key, value);
  }
  return verifiedPcm.get(key);
}

// 回执不是解码的替身；对真实字节执行只读 probe / full decode，不抽帧、不渲染。
function verifyMedia({projectRoot, item, closure}) {
  const reference = item.renderAsset;
  const file = resolve(projectRoot, reference.path);
  requireValue(['image', 'video', 'audio', 'font'].includes(item.media?.type), 'NV2_MEDIA_TYPE_INVALID');
  requireValue(item.source && item.sourceReceipt, 'NV2_MEDIA_PROVENANCE_REQUIRED', {id: item.id});
  closure.document(item.sourceReceipt);
  if (item.media.type === 'font') return null;
  const tools = paperMediaTools(['ffmpeg', 'ffprobe']);
  if (item.media.type === 'image') {
    const key = `${file}:${reference.sha256}:${tools.ffmpeg.sha256}:image`;
    if (!verifiedMedia.has(key)) {
      runPaperMediaTool(tools.ffmpeg, ['-nostdin', '-v', 'error', '-xerror', '-i', file,
        '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-']);
      requireValue(sha256File(file) === reference.sha256, 'NV2_MEDIA_CHANGED_DURING_CHECK');
      verifiedMedia.set(key, {decodedImage: true});
    }
    return verifiedMedia.get(key);
  }
  const receipt = closure.document(item.decodeReceipt).body;
  requireValue(receipt.exitCode === 0 && receipt.fullDecode === true &&
    receipt.source?.sha256 === reference.sha256 &&
    resolve(projectRoot, receipt.source?.path ?? '') === file &&
    Array.isArray(receipt.command) && receipt.command.includes('-i') &&
    receipt.command.includes('-f') && receipt.command.includes('null'), 'NV2_DECODE_RECEIPT_INVALID', {id: item.id});
  requireValue(receipt.tool?.path === tools.ffmpeg.path && receipt.tool.sha256 === tools.ffmpeg.sha256,
    'NV2_DECODE_TOOL_MISMATCH');
  const key = `${file}:${reference.sha256}:${tools.ffmpeg.sha256}:${tools.ffprobe.sha256}`;
  if (verifiedMedia.has(key)) return verifiedMedia.get(key);
  requireValue(sha256File(file) === reference.sha256, 'NV2_MEDIA_SHA_CHANGED');
  const probe = JSON.parse(runPaperMediaTool(tools.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]).stdout);
  const stream = probe.streams?.find((value) => value.codec_type === item.media.type);
  requireValue(stream, 'NV2_MEDIA_STREAM_MISSING', {id: item.id});
  const durationSeconds = Number(stream.duration ?? probe.format?.duration);
  requireValue(Number.isFinite(durationSeconds) && durationSeconds > 0 &&
    Number.isFinite(item.media.durationSeconds) && Math.abs(durationSeconds - item.media.durationSeconds) <= 0.1,
    'NV2_MEDIA_DURATION_MISMATCH', {id: item.id});
  let fps = null;
  if (item.media.type === 'video') {
    const rate = /^(\d+)\/(\d+)$/u.exec(stream.avg_frame_rate ?? '');
    fps = rate ? Number(rate[1]) / Number(rate[2]) : NaN;
    requireValue(Number.isFinite(fps) && fps > 0 && Math.abs(fps - item.media.fps) < 0.01,
      'NV2_MEDIA_FPS_MISMATCH', {id: item.id});
  }
  runPaperMediaTool(tools.ffmpeg, ['-nostdin', '-v', 'error', '-xerror', '-i', file,
    '-map', item.media.type === 'video' ? '0:v:0' : '0:a:0', ...(item.media.type === 'video' ? ['-map', '0:a?'] : []), '-f', 'null', '-'],
  {timeout: nativeV2FullDecodeTimeoutMs(durationSeconds)});
  requireValue(sha256File(file) === reference.sha256, 'NV2_MEDIA_CHANGED_DURING_CHECK');
  const result = {durationSeconds, fps, fullDecode: true};
  verifiedMedia.set(key, result);
  return result;
}

/** 只验证真实审阅输入；不制造旧预拍、首帧烘焙、人工观看或正式放行回执。 */
export function validateNativeV2FirstCandidate({projectRoot, contract, job, readClosure}) {
  requireValue(contract.inputFormat === NATIVE_V2_INPUT_FORMAT &&
    job.director?.inputFormat === NATIVE_V2_INPUT_FORMAT, 'NV2_FORMAT_BINDING_MISMATCH');
  requireValue(Object.keys(contract.artifacts ?? {}).length === NATIVE_V2_ARTIFACTS.length &&
    NATIVE_V2_ARTIFACTS.every((key) => contract.artifacts[key]), 'NV2_ARTIFACTS_REQUIRED');
  const closure = readClosure({projectRoot,
    references: [...NATIVE_V2_ARTIFACTS.map((key) => contract.artifacts[key]), contract.profile, contract.style]});
  const docs = Object.fromEntries(NATIVE_V2_ARTIFACTS.map((key) => [key, closure.document(contract.artifacts[key])]));
  const {directorCues: {body: cues}, runtimePlan: {body: runtime}, spokenTimeline: {body: spoken},
    postshootRebind: {body: rebound}, mediaIntake: {body: intake}, factReview: {body: facts}, userScope: {body: scope}} = docs;
  const profile = closure.document(contract.profile).body;
  requireValue(resolve(projectRoot, contract.profile.path) === resolve(projectRoot, 'workflow/active-director-profile.v1.json') &&
    resolve(projectRoot, profile.style?.path ?? '') === resolve(projectRoot, contract.style.path), 'NV2_PROFILE_BINDING_MISMATCH');
  requireValue(cues.taskId === contract.taskId && cues.styleLocks?.paperEditorial?.textPolicy === PAPER_TEXT_POLICY,
    'NV2_DIRECTOR_SOURCE_MISMATCH');
  assertCurrentPaperBaseline(cues, profile);
  const cuesResult = validateDirectorCuesV2File({inputPath: docs.directorCues.absolutePath, projectRoot});
  requireValue(cuesResult.ok, 'NV2_DIRECTOR_CUES_INVALID', {errors: cuesResult.errors});
  for (const key of NATIVE_V2_ARTIFACTS) {
    const bound = job.director.artifacts?.[key];
    requireValue(bound?.sha256 === contract.artifacts[key].sha256 &&
      resolve(projectRoot, bound?.path ?? '') === docs[key].absolutePath, 'NV2_JOB_ARTIFACT_MISMATCH', {key});
  }
  for (const body of [scope, intake]) requireValue(body.episodeId === contract.episodeId &&
    body.taskId === contract.taskId && body.revisionId === contract.revisionId, 'NV2_INPUT_IDENTITY_MISMATCH');
  const staticPaperRequested = scope.scope?.useUserSelectedStaticPaper === true;
  requireValue(scope.schemaVersion === 'episode-native-v2-review-authorization/v1' &&
    ['reviewOnly', 'preserveAllOriginalSpeech', 'allowPendingReviewInCandidate'].every((key) => scope.scope?.[key] === true) &&
    (staticPaperRequested ? scope.scope.useExistingPaperVideos === false :
      scope.scope.useExistingPaperVideos === true && !scope.staticPaperSelection && !scope.staticPaperPreviousQa) &&
    scope.scope?.formalAuthorized === false && scope.scope?.publishAuthorized === false &&
    text(scope.quotedUserMessage) && Number.isFinite(Date.parse(scope.recordedAt)), 'NV2_REVIEW_SCOPE_REQUIRED');
  requireValue(readFileSync(resolve(projectRoot, scope.sourceMessage?.path ?? ''), 'utf8').includes(scope.quotedUserMessage),
    'NV2_USER_QUOTE_NOT_IN_SOURCE');
  requireValue(Array.isArray(facts.decisionItems) && facts.decisionItems.every((item) => text(item.id) && text(item.issue)) &&
    facts.episodeId === contract.episodeId, 'NV2_FACT_REVIEW_REGISTER_REQUIRED');
  requireValue(intake.schemaVersion === 'episode-native-v2-media-intake/v1' &&
    Array.isArray(intake.assets) && intake.assets.length > 0, 'NV2_MEDIA_INTAKE_INVALID');
  requireValue(resolve(projectRoot, intake.source?.path ?? '') === resolve(projectRoot, job.inputs?.source ?? '') &&
    resolve(projectRoot, intake.renderProxy?.path ?? '') === resolve(projectRoot, job.inputs?.renderProxy ?? ''), 'NV2_SOURCE_BINDING_MISMATCH');
  const preservation = closure.document(intake.sourcePreservationReceipt).body;
  requireValue(preservation && typeof preservation === 'object', 'NV2_SOURCE_PRESERVATION_RECEIPT_REQUIRED');

  const fps = runtime.fps, duration = runtime.durationInFrames;
  requireValue(Number.isSafeInteger(duration) && duration > 0 && fps === job.remotion?.fps &&
    runtime.width === job.remotion.width && runtime.height === job.remotion.height &&
    Math.abs(duration / fps - job.remotion.durationSeconds) < 1 / fps &&
    runtime.host?.trimBeforeFrame === 0 && runtime.host.trimAfterFrame === duration &&
    runtime.voice?.trimBeforeFrame === 0 && runtime.voice.trimAfterFrame === duration &&
    runtime.voice.gain === 1 && runtime.voice.playbackRate === 1, 'NV2_FULL_SOURCE_RETENTION_REQUIRED');
  requireValue(spoken.canonicalSource === 'recorded-audio' && spoken.scriptRole === 'comparison-only' &&
    Array.isArray(spoken.segments) && spoken.segments.length > 0 &&
    rebound.canonicalSource === 'recorded-audio' && rebound.durationInFrames === duration && rebound.fps === fps,
    'NV2_SPOKEN_AUTHORITY_INVALID');
  const segments = spoken.segments;
  requireValue(new Set(segments.map((item) => item.id)).size === segments.length && segments.every((item, i) =>
    Number.isFinite(item.start) && Number.isFinite(item.end) && item.start >= 0 && item.end > item.start &&
    item.end <= duration / fps + 1 / fps && text(item.text) && (!i || item.start >= segments[i - 1].end - 0.001)),
    'NV2_SPOKEN_TIMELINE_INVALID');
  requireValue(runtime.captions?.length === segments.length && runtime.captions.every((caption, i) =>
    normal(caption.chinese) === normal(segments[i].text) && Math.abs(caption.from - Math.round(segments[i].start * fps)) <= 1 &&
    Math.abs(caption.to - Math.round(segments[i].end * fps)) <= 1 && typeof caption.english === 'string' &&
    (caption.english.trim() || runtime.review?.captions === 'pending')), 'NV2_CAPTIONS_NOT_SPOKEN_SOURCE');
  const raw = readClosure({projectRoot, references: [{path: spoken.rawSource, sha256: spoken.rawSha256}]});
  const rawBody = raw.document({path: spoken.rawSource}).body;
  requireValue(Array.isArray(rawBody.segments) && rawBody.segments.length === segments.length &&
    rawBody.segments.every((item, i) => item.id === segments[i].id &&
      normal(item.text) === normal(segments[i].raw_text ?? segments[i].text) &&
      Math.abs(item.start - segments[i].start) < 0.001 && Math.abs(item.end - segments[i].end) < 0.001),
    'NV2_RAW_SPEECH_COVERAGE_MISMATCH');
  const changedSegments = segments.filter(item => normal(item.text) !== normal(item.raw_text ?? item.text));
  if (changedSegments.length > 0) {
    requireValue(intake.spokenCorrectionReceipt, 'NV2_SPOKEN_CORRECTION_RECEIPT_REQUIRED');
    const correction = closure.document(intake.spokenCorrectionReceipt).body;
    requireValue(correction.noFactCorrectionsApplied === true && correction.noSpokenWordsTrimmed === true &&
      Array.isArray(correction.corrections) && correction.corrections.length > 0 &&
      runtime.review?.captions === 'pending', 'NV2_SPOKEN_CORRECTIONS_NOT_PENDING');
    const hasDirected = correction.corrections.some(entry => entry.status === 'user-directed-spelling-correction');
    if (hasDirected || contract.revisionId === 'musk-grok-business-ai-v9-full-candidate-r3-20261016') {
      validateMuskGrokR3UserDirectedCorrections({projectRoot, contract, job, correction, segments, closure});
    }
    for (const entry of correction.corrections) {
      const segment = segments.find(item => item.id === entry.segmentId);
      requireValue(segment && text(entry.raw_text) && text(entry.text) && text(entry.basis) &&
        (entry.status === 'asr-correction-candidate' || (hasDirected && entry.status === 'user-directed-spelling-correction')) &&
        entry.humanListeningPerformed === false && entry.userConfirmed === false &&
        Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start &&
        entry.start >= segment.start - 0.001 && entry.end <= segment.end + 0.001,
        'NV2_SPOKEN_CORRECTION_ENTRY_INVALID');
    }
    for (const segment of segments) {
      let replay = normal(segment.raw_text ?? segment.text);
      for (const entry of correction.corrections.filter(item => item.segmentId === segment.id)) {
        const before = normal(entry.raw_text);
        requireValue(before && replay.split(before).length === 2, 'NV2_SPOKEN_CORRECTION_AMBIGUOUS');
        replay = replay.replace(before, normal(entry.text));
      }
      requireValue(replay === normal(segment.text), 'NV2_UNREGISTERED_SPOKEN_REWRITE', {segmentId: segment.id});
    }
  }
  const beats = rebound.semanticBeats;
  requireValue(Array.isArray(beats) && beats.length > 0 && beats.every((beat) => beat.sourceSpeechPreserved === true &&
    beat.scriptRole === 'comparison-only' && Array.isArray(beat.sourceSegmentIds)) &&
    JSON.stringify(beats.flatMap((beat) => beat.sourceSegmentIds)) === JSON.stringify(segments.map((item) => item.id)),
    'NV2_REBIND_SPEECH_COVERAGE_MISMATCH');
  for (const beat of beats) {
    const source = beat.sourceSegmentIds.map((id) => segments.find((item) => item.id === id));
    requireValue(source.every(Boolean) && normal(beat.rawSpokenText) === normal(source.map((item) => item.raw_text ?? item.text).join('')),
      'NV2_REBIND_TEXT_CHANGED');
  }
  const rootPublic = resolve(projectRoot, job.remotion.publicDir);
  requireValue(typeof (runtime.assetPrefix ?? '') === 'string' &&
    !/^(?:[a-z]+:|[\\/])/iu.test(runtime.assetPrefix ?? '') &&
    !(runtime.assetPrefix ?? '').split(/[\\/]/u).includes('..'), 'NV2_ASSET_PREFIX_INVALID');
  const assetFile = (src) => {
    requireValue(text(src) && !/^(?:[a-z]+:|[\\/])/iu.test(src) && !src.split(/[\\/]/u).includes('..'), 'NV2_ASSET_PATH_INVALID');
    return resolve(rootPublic, `${runtime.assetPrefix ?? ''}${src}`);
  };
  const assets = intake.assets;
  requireValue(new Set(assets.map((item) => resolve(projectRoot, item.renderAsset.path))).size === assets.length,
    'NV2_DUPLICATE_MEDIA_INTAKE');
  const byPath = new Map(assets.map((item) => [resolve(projectRoot, item.renderAsset.path), item]));
  const itemFor = (src) => {
    const item = byPath.get(assetFile(src)); requireValue(item, 'NV2_RUNTIME_MEDIA_NOT_BOUND', {src}); return item;
  };
  requireValue(byPath.has(resolve(projectRoot, intake.source.path)) &&
    assetFile(runtime.host.src) === resolve(projectRoot, intake.renderProxy.path), 'NV2_ORIGINAL_MEDIA_NOT_BOUND');
  const needed = [runtime.host.src, runtime.voice.src, runtime.fonts?.displaySrc, runtime.fonts?.captionSrc,
    ...runtime.sfx.map((item) => item.src)];
  const papers = runtime.mediaSlots.filter((slot) => slot.kind === 'paper');
  if (staticPaperRequested) validateAgilityStaticPaperSelection({projectRoot, contract, job, scope, runtime, closure, itemFor});
  else requireValue(papers.length > 0 && papers.every((slot) => slot.state === 'ready' && slot.asset?.type === 'video'),
    'NV2_EXISTING_PAPER_REQUIRED');
  for (const slot of runtime.mediaSlots) {
    requireValue(reviewStatus(slot.reviewStatus), 'NV2_MEDIA_REVIEW_STATUS_INVALID');
    if (slot.state !== 'ready') continue;
    requireValue(slot.window && Number.isInteger(slot.window.from) && Number.isInteger(slot.window.to) &&
      slot.window.from >= 0 && slot.window.to > slot.window.from && slot.window.to <= duration, 'NV2_MEDIA_WINDOW_INVALID');
    needed.push(slot.asset.src);
    if (slot.asset.nativeAudio) needed.push(slot.asset.nativeAudio.src);
    if (slot.kind === 'paper') requireValue(text(slot.sourceLabel) && /AI/u.test(slot.sourceLabel), 'NV2_PAPER_DISCLOSURE_REQUIRED');
  }
  needed.forEach(itemFor);
  requireValue(preservation.equal === true && preservation.noTrimming === true &&
    preservation.noSpeedChange === true && preservation.originalStartSeconds === 0 &&
    preservation.preparedStartSeconds === 0 &&
    resolve(projectRoot, preservation.source ?? '') === resolve(projectRoot, intake.source.path) &&
    resolve(projectRoot, preservation.preparedAudio ?? '') === assetFile(runtime.voice.src),
    'NV2_SOURCE_PRESERVATION_RECEIPT_INVALID');
  const originalPcm = decodedPcmHash(intake.source, projectRoot);
  const voicePcm = decodedPcmHash(itemFor(runtime.voice.src).renderAsset, projectRoot);
  requireValue(originalPcm === voicePcm && preservation.sourceDecodedPcmHash === originalPcm &&
    preservation.preparedDecodedPcmHash === voicePcm, 'NV2_ORIGINAL_AUDIO_NOT_PRESERVED');
  const probes = new Map();
  for (const item of assets) probes.set(resolve(projectRoot, item.renderAsset.path), verifyMedia({projectRoot, item, closure}));
  for (const file of [resolve(projectRoot, intake.source.path), assetFile(runtime.host.src), assetFile(runtime.voice.src)]) requireValue(
    Math.abs(probes.get(file)?.durationSeconds - duration / fps) <= 1 / fps,
    'NV2_SOURCE_DURATION_NOT_FULL');
  for (const slot of runtime.mediaSlots.filter((item) => item.state === 'ready' && item.asset.type === 'video')) {
    const media = probes.get(assetFile(slot.asset.src));
    requireValue(media && Math.abs(slot.asset.sourceFps - media.fps) < 0.01 && Number.isSafeInteger(slot.asset.sourceInFrame) && slot.asset.sourceInFrame >= 0 &&
      (slot.asset.playbackRate === undefined || slot.asset.playbackRate === 1) &&
      slot.asset.sourceInFrame / media.fps + (slot.window.to - slot.window.from) / fps <= media.durationSeconds + 1 / fps,
      'NV2_PAPER_OR_MEDIA_WINDOW_EXCEEDS_SOURCE', {id: slot.id});
    if (slot.asset.nativeAudio) requireValue(
      probes.get(assetFile(slot.asset.nativeAudio.src))?.durationSeconds + 1 / fps >=
        slot.asset.sourceInFrame / media.fps + (slot.window.to - slot.window.from) / fps,
      'NV2_NATIVE_AUDIO_WINDOW_EXCEEDS_SOURCE', {id: slot.id});
  }
  const files = [...new Map([...closure.files, ...raw.files].map((item) => [item.path, item])).values()];
  return {ok: true, productionEligible: false, formalEnabled: false, candidateAccepted: false,
    inputFormat: NATIVE_V2_INPUT_FORMAT, taskId: contract.taskId, files,
    documents: [...closure.documents, ...raw.documents], paperSceneCount: papers.length,
    spokenAuthority: 'recorded-audio', scriptRole: 'comparison-only', reviewOnly: true,
    unresolvedFactIds: facts.decisionItems.map((item) => item.id),
    humanAcceptancePerformed: false, pendingReviewAllowedForCandidateOnly: true};
}
