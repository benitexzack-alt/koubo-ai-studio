import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  collectProductionBoundFilesV2, computeProductionCompositionBindingV2,
  computeProductionJobSnapshotSha256V2, stableJsonSha256ForProductionGateV2,
} from '../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {assertNoRetiredGeneratedStyle} from '../../../tools/generated-style-policy.mjs';

export const BASE = 'edit/20261006_ten_ai_businesses';
export const CONTROL = `${BASE}/00_成片控制`;
export const ROUTE = 'ten-ai-businesses-scoped-render-r1';
export const EPISODE = '20261006_ten_ai_businesses';
export const REVISION = 'ten-ai-businesses-v8-final-r1';
export const PUBLIC = 'remotion/public-ten-ai-businesses-final-r1';
export const RUNTIME = 'remotion/src/ten-ai-businesses-final-r1/runtime-plan.r1.json';
export const ENTRY = 'src/ten-ai-businesses-final-r1/index.tsx';
export const SOURCE = `${BASE}/01_素材投放区/01_口播原片/copy_49E4F13A-70AB-4E11-92B2-545146690784.MOV`;
export const ORIGINALS = Object.freeze([SOURCE, ...Array.from({length: 6}, (_, i) =>
  `${BASE}/01_素材投放区/04_纸艺视频/20261006_P0${i + 1}_待确认生成.mp4`)]);
export const PREVIEW_QUOTE = '先把这次的成片做出来，然后在这个成片的基础上，我们正好在制作过程当中测试优化一下。然后再就是原纸艺的镜头的原声也保留。';
const SHA = /^[a-f0-9]{64}$/u;
const SELF_PIN = 'tools/scoped-direct-export-core.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => stableJsonSha256ForProductionGateV2(a) === stableJsonSha256ForProductionGateV2(b);
const assert = (ok, message) => {
  if (!ok) throw Object.assign(new Error(message), {code: 'TABR1_BINDING'});
};
export const isTenAIBusinessesRenderR1 = job => job?.productionGate?.route === ROUTE;
export const jobPathFor = variant => `${CONTROL}/production-${variant}.r1.json`;
export const manifestPathFor = variant => `${CONTROL}/export-manifest.${variant}.r1.json`;
export const previewPathFor = variant => `${BASE}/07_预览与质检/10个AI生意_45秒_${variant === 'with-sfx' ? '有附加音效' : '无附加音效'}_R1.mp4`;
export const FULL_CANDIDATE_OUTPUT = `${BASE}/08_正式成片/10个AI生意_V8_R1_1080P_完整候选.mp4`;
export function variantFor(job) {
  const variant = ['with-sfx', 'no-sfx', 'full-candidate', 'formal'].find(value => job?.jobId === `20261006-ten-ai-businesses-v8-r1-${value}`);
  assert(variant && job.videoId === EPISODE, '仅接受本期明确登记的四种任务身份');
  return variant;
}
function inside(root, value) {
  assert(typeof value === 'string' && value && !isAbsolute(value), '绑定路径必须是项目相对路径');
  const absolute = resolve(root, value), normalized = relative(root, absolute).split(sep).join('/');
  assert(normalized === value && !normalized.startsWith('../'), '绑定路径不得逃逸或使用非规范路径');
  let cursor = root;
  for (const part of normalized.split('/')) {
    cursor = resolve(cursor, part);
    assert(existsSync(cursor) && !lstatSync(cursor).isSymbolicLink(), `文件缺失或路径经过符号链接：${value}`);
  }
  assert(lstatSync(absolute).isFile() && realpathSync(absolute) === absolute, `绑定须为普通文件：${value}`);
  return absolute;
}
const read = (root, value) => JSON.parse(readFileSync(inside(root, value), 'utf8'));
function probe(root, value) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,avg_frame_rate,nb_frames,duration', '-of', 'json', inside(root, value)],
  {encoding: 'utf8', maxBuffer: 1024 * 1024});
  assert(result.status === 0, `本期媒体探测失败：${value}`);
  return JSON.parse(result.stdout);
}
function bound(root, ref) {
  assert(SHA.test(ref?.sha256 ?? ''), '绑定摘要尚未形成，保持待准备');
  const bytes = readFileSync(inside(root, ref.path));
  assert(hash(bytes) === ref.sha256, `绑定内容发生变化：${ref.path}`);
  return bytes;
}
export function collectTenAIBusinessesBindings({projectRoot, job}) {
  const copy = structuredClone(job), manifest = manifestPathFor(variantFor(job));
  copy.inputs.fingerprintPaths = copy.inputs.fingerprintPaths.filter(value => ![SELF_PIN, manifest].includes(value));
  const boundFiles = collectProductionBoundFilesV2({projectRoot, job: copy}).filter(value => ![SELF_PIN, manifest].includes(value.path));
  const contentFiles = boundFiles.filter(value => value.path.startsWith('remotion/') ||
    value.path.startsWith(`${BASE}/01_素材投放区/`) ||
    ['transcript', 'bilingualCaptions', 'spokenSourcePolicy', 'visualPlan', 'sfxCueSheet'].some(key => job.inputs[key] === value.path));
  return {
    jobSnapshotSha256: computeProductionJobSnapshotSha256V2(job), boundFiles,
    compositionBinding: computeProductionCompositionBindingV2(job, {projectRoot}),
    contentBindingSha256: stableJsonSha256ForProductionGateV2(contentFiles),
  };
}
function userQuote(root, ref) {
  const lines = bound(root, ref).toString('utf8').trim().split(/\r?\n/u);
  assert(lines.length === 1, '授权凭据须为从真实会话提取的单条用户 JSONL');
  const event = JSON.parse(lines[0]);
  assert(event.type === 'response_item' && event.payload?.role === 'user', '不能用助手总结或工具返回冒充用户授权');
  return event.payload.content?.filter(value => ['input_text', 'text'].includes(value.type)).map(value => value.text).join('\n').trim();
}
export function assertTenAIBusinessesRenderR1({projectRoot, job, jobPath = null, command, pins}) {
  const root = resolve(projectRoot), variant = variantFor(job), formal = variant === 'formal',
    fullCandidate = variant === 'full-candidate', fullDuration = formal || fullCandidate, gate = job.productionGate;
  const expectedJob = jobPathFor(variant), expectedManifest = manifestPathFor(variant);
  assert((formal ? ['direct-remotion-render', 'formal-audio', 'qa', 'release-validation'] : ['direct-remotion-preview']).includes(command), '当前阶段不允许该命令');
  assert(jobPath === null || (isAbsolute(jobPath) ? relative(root, jobPath).split(sep).join('/') : jobPath) === expectedJob, '本期任务路径不匹配');
  assert(same(read(root, expectedJob), job), '调用任务和磁盘任务不一致');
  assert(gate.schema === 'director-production-entry-binding/v2' && gate.route === ROUTE && gate.revisionId === REVISION &&
    gate.state === (formal ? 'scoped-formal-authorized-r1' : 'scoped-preview-authorized-r1'), '本期路由、状态或修订不匹配');
  assert(SHA.test(pins?.[variant] ?? '') && gate.scopedDirectExport?.path === expectedManifest &&
    gate.scopedDirectExport.sha256 === pins[variant], '本期清单尚未真实登记固定摘要');
  assert(job.formal?.enabled === formal && gate.formalEnabled === formal && gate.userPreviewApproved === formal &&
    job.experiment?.userPreviewApproved === formal, '预览／正式开关与真实验收状态不一致');
  assert(job.finalReview?.fullWatchConfirmed === false && job.publishAuthorized === false &&
    !job.inputs?.generatedVideoPlan && ['directorContract', 'freezeReceipt', 'formalAuthorization'].every(key => gate[key] == null),
  '不得伪造全片通过、发布许可、独立签名或生成平台合同');
  const manifest = JSON.parse(bound(root, gate.scopedDirectExport));
  assert(manifest.schema === 'ten-ai-businesses-export-manifest/v1' && manifest.route === ROUTE &&
    manifest.episodeId === EPISODE && manifest.jobId === job.jobId && manifest.jobPath === expectedJob && manifest.variant === variant,
  '清单不属于本期固定任务');
  const current = collectTenAIBusinessesBindings({projectRoot: root, job});
  assert(same(current, manifest.binding), '输入、声轨、字幕、代码或任务漂移，须重新绑定');
  const files = new Map(current.boundFiles.map(value => [value.path, value]));
  const requireBound = value => assert(files.has(value), `关键输入没有进入哈希闭包：${value}`);
  for (const value of [
    ...ORIGINALS, RUNTIME, `${CONTROL}/export-adapter.r1.mjs`, `${CONTROL}/build-export-binding.r1.mjs`,
    ...['transcript', 'bilingualCaptions', 'spokenSourcePolicy'].map(key => job.inputs[key]),
    'workflow/active-production-profile.v1.json', 'workflow/active-director-profile.v1.json',
    `${PUBLIC}/ten-ai-businesses-final-r1/audio/original.wav`,
    `${PUBLIC}/ten-ai-businesses-final-r1/audio/native-mix.r2.wav`,
    `${PUBLIC}/ten-ai-businesses-final-r1/audio/final-mix.r2.wav`,
  ]) requireBound(value);
  assert(manifest.originalMedia?.length === 7 && same(manifest.originalMedia.map(value => value.path), ORIGINALS) &&
    manifest.originalMedia.every(value => files.get(value.path)?.sha256 === value.sha256), '必须逐一绑定本期原片与六纸艺原素材');
  assert(job.inputs.source === SOURCE && job.inputs.visualPlan === RUNTIME, '原片或实际运行计划不是本期输入');
  const originalProbe = probe(root, SOURCE), proxyProbe = probe(root, job.inputs.renderProxy);
  assert(originalProbe.streams?.some(value => value.codec_type === 'audio') &&
    Math.abs(Number(originalProbe.format?.duration) - 8534 / 30) <= 1 / 30, '完整原片必须包含原声，时长对应 8534 帧');
  const proxyVideo = proxyProbe.streams?.find(value => value.codec_type === 'video');
  assert(proxyVideo?.avg_frame_rate === '30/1' && Number(proxyVideo.nb_frames) === 8534,
    '实际渲染代理必须是完整 30fps／8534 帧，不能用 60 秒旧片段冒充');
  const profile = read(root, 'workflow/active-production-profile.v1.json');
  assert(profile.profileVersion === 'V8' && job.productionProfile?.version === 'V8' &&
    job.productionProfile.id === profile.profileId, '必须保留当前 V8 制作基线');
  assert(job.director?.phase === 'post-shoot' && job.director?.skillPackageAccepted === false,
    '只能登记实录重绑，不能声称导演包已整体验收');
  const runtime = read(root, RUNTIME);
  assert(runtime.durationInFrames === 8534 && runtime.previewDurationInFrames === 1350 && same(runtime.originalVoice,
    {continuous: true, startFrame: 0, endFrameExclusive: 8534, speed: 1, deletedRanges: []}), '必须全量保留 8534 帧原声，预览为前 1350 帧');
  assert(same(runtime.mixes, {original: 'audio/original.wav', native: 'audio/native-mix.r2.wav', withSfx: 'audio/final-mix.r2.wav', paperNativePreserved: true}),
    '有／无附加音效预览都必须保留本人口播和原纸艺音轨');
  assert(runtime.paper?.length === 6 && new Set(runtime.paper.map(value => value.id)).size === 6, '纸艺六镜必须完整实录重绑');
  for (const [i, clip] of runtime.paper.entries()) {
    assert(clip.id === `P0${i + 1}` && Number.isInteger(clip.startFrame) && Number.isInteger(clip.endFrameExclusive) &&
      clip.startFrame >= 0 && clip.endFrameExclusive > clip.startFrame && clip.endFrameExclusive <= 8534 &&
      Number.isFinite(clip.sourceInSeconds) && clip.sourceInSeconds >= 0 && clip.playbackRate === 1 &&
      clip.loop === false && clip.freezeLastFrame === false && clip.nativeAudioPreserved === true, '纸艺必须真实入出点、正常单次播放并保留原生音');
    const originalPaper = probe(root, ORIGINALS[i + 1]);
    assert(originalPaper.streams?.some(value => value.codec_type === 'audio') &&
      clip.sourceInSeconds + (clip.endFrameExclusive - clip.startFrame) / 30 <= Number(originalPaper.format?.duration) + 1 / 30,
    `纸艺 ${clip.id} 须有实际原生音轨，且取用窗口不能超过原素材`);
  }
  assert(Array.isArray(runtime.motionEvents) && runtime.motionEvents.length > 0 && Array.isArray(runtime.sfxCues), '缺少实际动效与音效点位');
  const eventIds = runtime.motionEvents.map(value => value.id);
  assert(new Set(eventIds).size === eventIds.length, '动效事件编号重复');
  requireBound(runtime.audioVerification?.mixReceipt?.path);
  requireBound(runtime.audioVerification?.transientReceipt?.path);
  const mixedTransients = JSON.parse(bound(root, runtime.audioVerification.transientReceipt));
  assert(mixedTransients.actualPremixAllPeaksWithinTwoFrames === true &&
    mixedTransients.allAddedSfxNonSilent === true, '必须量测实际混音中的有效主峰，不能只量原音文件');
  for (const event of runtime.motionEvents) {
    assert(Number.isInteger(event.frame) && event.frame >= 0 && event.frame < 8534 && runtime.sfxCues.some(value => value.eventId === event.id),
      `动效缺少对应音效：${event.id}`);
  }
  for (const cue of runtime.sfxCues) {
    const event = runtime.motionEvents.find(value => value.id === cue.eventId);
    const measured = mixedTransients.cues.find(value => value.id === cue.eventId);
    assert(event && measured && Number.isInteger(cue.frame) && cue.frame === measured.frame &&
      cue.effectiveTransientFrame === measured.actualPremixPeakFrame && measured.visualFrame === event.frame &&
      Math.abs(cue.effectiveTransientFrame - event.frame) <= 2 && cue.volume > 0 && cue.volume <= 1,
      '音效必须与实际主动作在 2 帧内对齐，不能只登记轨道');
    requireBound(cue.source);
  }
  const expectedComposition = fullDuration ? 'TenAIBusinessesFinalR1WithSfx' :
    variant === 'with-sfx' ? 'TenAIBusinessesPreviewR1WithSfx' : 'TenAIBusinessesPreviewR1NoSfx';
  assert(job.remotion?.root === 'remotion' && job.remotion.entry === ENTRY && job.remotion.publicDir === PUBLIC &&
    job.remotion.compositionWithSfx === expectedComposition &&
    job.remotion.compositionWithoutSfx === (variant === 'no-sfx' ? expectedComposition : null) &&
    job.remotion.fps === 30 && job.remotion.width === 1920 && job.remotion.height === 1080 &&
    job.remotion.durationSeconds === (fullDuration ? 8534 : 1350) / 30,
  '完整候选／正式必须全量 8534 帧，可选对照预览才是同时间轴前 45 秒');
  const auth = JSON.parse(bound(root, manifest.authorization));
  requireBound(manifest.authorization.path); requireBound(auth.evidence?.path);
  const quote = userQuote(root, auth.evidence);
  assert(auth.schema === 'ten-ai-businesses-render-authorization/v1' && auth.episodeId === EPISODE &&
    auth.revisionId === REVISION && auth.userQuote === quote && auth.independentSignature === false &&
    auth.publishAuthorized === false && auth.fullWatchConfirmed === false && auth.formalEnabled === formal &&
    auth.previewAccepted === formal && auth.previewAuthorized === true, '授权必须来自真实用户消息且不扩大验收范围');
  if (formal) {
    assert(auth.phase === 'formal' && /通过|认可|确认|同意|出正片|出成片/u.test(quote) &&
      !/不通过|未通过|没通过|不认可|不同意|待确认|不要出|别出/u.test(quote) && quote !== PREVIEW_QUOTE,
      '正式阶段须取得本期预览观看后的新用户确认，不能复用开始制作指令');
    assert(auth.reviewedPreview?.path === previewPathFor('with-sfx') &&
      auth.reviewedContentBindingSha256 === current.contentBindingSha256, '正式素材必须和用户认可的本期预览保持同源');
    bound(root, auth.reviewedPreview); requireBound(auth.reviewedPreview.path);
    const receipt = JSON.parse(bound(root, auth.previewRenderReceipt)); requireBound(auth.previewRenderReceipt.path);
    assert(receipt.schema === 'director-controlled-remotion-render-receipt/v2' && receipt.mode === 'preview' &&
      receipt.jobId === '20261006-ten-ai-businesses-v8-r1-with-sfx' && receipt.output?.sha256 === auth.reviewedPreview.sha256 &&
      relative(root, receipt.output.path).split(sep).join('/') === auth.reviewedPreview.path,
    '必须绑定真实受控生成的本期有声预览及其输出摘要');
    assert(job.formal.rawOutput === `${BASE}/08_正式成片/10个AI生意_R1_正式渲染原始.mp4` &&
      job.formal.finalOutput === `${BASE}/08_正式成片/10个AI生意_V8_R1_1080P_正式候选.mp4`, '正式输出限定本期且不得覆盖原始素材');
  } else {
    assert(auth.phase === (fullCandidate ? 'full-candidate' : 'preview') && quote === PREVIEW_QUOTE,
      '完整候选和可选对照预览仅使用本次真实开始制作指令');
    assert(job.preview?.enabled === true && job.preview.output === (fullCandidate ? FULL_CANDIDATE_OUTPUT : previewPathFor(variant)) &&
      job.formal.rawOutput == null && job.formal.finalOutput == null,
    '只能生成本期明确授权的完整候选或可选对照，不得冒充已确认正式片');
  }
  const registry = read(root, 'workflow/director-production-freeze-registry.v2.json');
  assert(!registry.blockedJobFiles.some(value => value.jobId === job.jobId) &&
    current.boundFiles.every(value => !registry.retiredOutputSha256.includes(value.sha256)), '冻结或退役输入不可重用');
  const spoken = spawnSync(process.execPath, [resolve(root, 'tools/check-spoken-source-policy.mjs'),
    ...['transcript', 'bilingualCaptions', 'spokenSourcePolicy'].map(key => resolve(root, job.inputs[key]))], {cwd: root, encoding: 'utf8'});
  assert(spoken.status === 0, `实录字幕校验未通过：${spoken.stderr || spoken.stdout}`);
  assertNoRetiredGeneratedStyle({value: {job, manifest}, operation: ROUTE, projectRoot: root, documentPaths: [expectedJob, expectedManifest]});
  return {ok: true, route: ROUTE, episodeId: EPISODE, jobId: job.jobId, revisionId: REVISION,
    manifestPath: expectedManifest, manifestSha256: pins[variant], ...current,
    userPreviewApproved: formal, fullWatchConfirmed: false, publishAuthorized: false,
    directorBinding: {ok: true, status: formal ? 'formal-entry-director-bound' : 'candidate-entry-director-bound',
      postshootEvidence: 'actual-spoken-timeline', spokenAuthority: 'recorded-audio', skillPackageAccepted: false,
      userPreviewApproved: formal, paperSceneCount: 6}};
}
