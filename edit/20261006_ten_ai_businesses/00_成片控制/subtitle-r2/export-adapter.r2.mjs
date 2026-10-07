import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  collectProductionBoundFilesV2, computeProductionCompositionBindingV2,
  computeProductionJobSnapshotSha256V2, stableJsonSha256ForProductionGateV2,
} from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {assertNoRetiredGeneratedStyle} from '../../../../tools/generated-style-policy.mjs';

export const BASE = 'edit/20261006_ten_ai_businesses';
export const CONTROL = `${BASE}/00_成片控制/subtitle-r2`;
export const ROUTE = 'ten-ai-businesses-scoped-render-r2';
export const EPISODE = '20261006_ten_ai_businesses';
export const REVISION = 'ten-ai-businesses-v8-subtitle-r2';
export const PUBLIC = 'remotion/public-ten-ai-businesses-final-r1';
export const RUNTIME = 'remotion/src/ten-ai-businesses-final-r2/runtime-plan.r2.json';
export const BASELINE_RUNTIME = 'remotion/src/ten-ai-businesses-final-r1/runtime-plan.r1.json';
export const EMPHASIS = 'remotion/src/ten-ai-businesses-final-r2/caption-emphasis.r2.json';
export const BASELINE_MANIFEST = Object.freeze({
  path: `${BASE}/00_成片控制/export-manifest.full-candidate.r1.json`,
  sha256: 'c63aae0e428d88097d3cb35e9f4ccfdc0af06c7be50af604caf9edfb48426156',
});
export const ENTRY = 'src/ten-ai-businesses-final-r2/index.tsx';
export const SOURCE = `${BASE}/01_素材投放区/01_口播原片/copy_49E4F13A-70AB-4E11-92B2-545146690784.MOV`;
export const ORIGINALS = Object.freeze([SOURCE, ...Array.from({length: 6}, (_, i) =>
  `${BASE}/01_素材投放区/04_纸艺视频/20261006_P0${i + 1}_待确认生成.mp4`)]);
export const REPAIR_QUOTE = '修正呀，赶紧修正给我。';
const SHA = /^[a-f0-9]{64}$/u;
const SELF_PIN = 'tools/scoped-direct-export-core.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => stableJsonSha256ForProductionGateV2(a) === stableJsonSha256ForProductionGateV2(b);
const assert = (ok, message) => {
  if (!ok) throw Object.assign(new Error(message), {code: 'TABR2_BINDING'});
};
export const isTenAIBusinessesRenderR2 = job => job?.productionGate?.route === ROUTE;
export const jobPathFor = variant => `${CONTROL}/production-${variant}.r2.json`;
export const manifestPathFor = variant => `${CONTROL}/export-manifest.${variant}.r2.json`;
export const FULL_CANDIDATE_OUTPUT = `${BASE}/08_正式成片/10个AI生意_V8_R2_字幕修正版_渲染原始.mp4`;
export function variantFor(job) {
  assert(job?.jobId === '20261006-ten-ai-businesses-v8-r2-full-candidate' && job.videoId === EPISODE,
    '字幕修正版只接受本期完整8534帧候选任务');
  return 'full-candidate';
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
export function collectTenAIBusinessesBindingsR2({projectRoot, job}) {
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
export function assertTenAIBusinessesRenderR2({projectRoot, job, jobPath = null, command, pins}) {
  const root = resolve(projectRoot), variant = variantFor(job), gate = job.productionGate;
  const expectedJob = jobPathFor(variant), expectedManifest = manifestPathFor(variant);
  assert(command === 'direct-remotion-preview', '字幕修正版仅允许受控完整候选渲染，不能伪造已观看正式批准');
  assert(jobPath === null || (isAbsolute(jobPath) ? relative(root, jobPath).split(sep).join('/') : jobPath) === expectedJob, '本期任务路径不匹配');
  assert(same(read(root, expectedJob), job), '调用任务和磁盘任务不一致');
  assert(gate.schema === 'director-production-entry-binding/v2' && gate.route === ROUTE && gate.revisionId === REVISION &&
    gate.state === 'scoped-preview-authorized-r2', '本期路由、状态或修订不匹配');
  assert(SHA.test(pins?.[variant] ?? '') && gate.scopedDirectExport?.path === expectedManifest &&
    gate.scopedDirectExport.sha256 === pins[variant], '本期清单尚未真实登记固定摘要');
  assert(job.formal?.enabled === false && gate.formalEnabled === false && gate.userPreviewApproved === false &&
    job.experiment?.userPreviewApproved === false, '预览／正式开关与真实验收状态不一致');
  assert(job.finalReview?.fullWatchConfirmed === false && job.publishAuthorized === false &&
    !job.inputs?.generatedVideoPlan && ['directorContract', 'freezeReceipt', 'formalAuthorization'].every(key => gate[key] == null),
  '不得伪造全片通过、发布许可、独立签名或生成平台合同');
  const manifest = JSON.parse(bound(root, gate.scopedDirectExport));
  assert(manifest.schema === 'ten-ai-businesses-export-manifest/v1' && manifest.route === ROUTE &&
    manifest.episodeId === EPISODE && manifest.jobId === job.jobId && manifest.jobPath === expectedJob && manifest.variant === variant,
  '清单不属于本期固定任务');
  const current = collectTenAIBusinessesBindingsR2({projectRoot: root, job});
  assert(same(current, manifest.binding), '输入、声轨、字幕、代码或任务漂移，须重新绑定');
  const files = new Map(current.boundFiles.map(value => [value.path, value]));
  const requireBound = value => assert(files.has(value), `关键输入没有进入哈希闭包：${value}`);
  for (const value of [
    ...ORIGINALS, RUNTIME, BASELINE_RUNTIME, BASELINE_MANIFEST.path, EMPHASIS,
    'remotion/src/ten-ai-businesses-final-r2/Composition.tsx',
    'remotion/src/ten-ai-businesses-final-r2/index.tsx', `${CONTROL}/export-adapter.r2.mjs`, `${CONTROL}/build-export-binding.r2.mjs`,
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
  const frozenBaseline = JSON.parse(bound(root, BASELINE_MANIFEST));
  const frozenRuntime = frozenBaseline.binding?.boundFiles?.find(value => value.path === BASELINE_RUNTIME);
  assert(frozenRuntime, '缺少实际受控R1父片所绑定的运行态证据');
  const runtime = read(root, RUNTIME), baselineRuntime = JSON.parse(bound(root, frozenRuntime)), emphasis = read(root, EMPHASIS);
  const withoutHighlights = caption => {
    const copy = structuredClone(caption); delete copy.highlights; return copy;
  };
  const runtimeWithoutHighlights = structuredClone(runtime);
  runtimeWithoutHighlights.captions = runtime.captions.map(withoutHighlights);
  assert(same(runtimeWithoutHighlights, baselineRuntime),
    '本轮仅允许字幕逐页highlights变化；原实录正文、时点、声轨、动效、数字运镜及纸艺必须保持R1');
  assert(same(Object.keys(emphasis).sort(), runtime.captions.map(value => value.id).sort()),
    '重点词表必须完整覆盖本期87页且不包含外来字幕编号');
  for (const caption of runtime.captions) {
    const words = emphasis[caption.id];
    assert(Array.isArray(words) && words.every(word => typeof word === 'string' && word.length > 0 &&
      caption.chinese.includes(word)) && new Set(words).size === words.length &&
      same(caption.highlights, words), `重点词必须来自当前实录原句并绑定实际消费者：${caption.id}`);
  }
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
  const expectedComposition = 'TenAIBusinessesFinalR2WithSfx';
  assert(job.remotion?.root === 'remotion' && job.remotion.entry === ENTRY && job.remotion.publicDir === PUBLIC &&
    job.remotion.compositionWithSfx === expectedComposition && job.remotion.compositionWithoutSfx === null &&
    job.remotion.fps === 30 && job.remotion.width === 1920 && job.remotion.height === 1080 &&
    job.remotion.durationSeconds === 8534 / 30, '字幕修正版必须全量8534帧，画幅、帧率及公用素材目录不变');
  const auth = JSON.parse(bound(root, manifest.authorization));
  requireBound(manifest.authorization.path); requireBound(auth.evidence?.path);
  const quote = userQuote(root, auth.evidence);
  assert(auth.schema === 'ten-ai-businesses-render-authorization/v1' && auth.episodeId === EPISODE &&
    auth.revisionId === REVISION && auth.userQuote === quote && auth.independentSignature === false &&
    auth.publishAuthorized === false && auth.fullWatchConfirmed === false && auth.formalEnabled === false &&
    auth.previewAccepted === false && auth.previewAuthorized === true, '授权必须来自真实用户消息且不扩大验收范围');
  assert(auth.phase === 'full-candidate' && quote === REPAIR_QUOTE,
    '字幕修正版必须绑定本轮真实用户修正指令');
  assert(job.preview?.enabled === true && job.preview.output === FULL_CANDIDATE_OUTPUT &&
    job.formal.rawOutput == null && job.formal.finalOutput == null,
    '仅生成本期字幕修正版完整候选，不覆盖R1或冒充已确认正式片');
  const registry = read(root, 'workflow/director-production-freeze-registry.v2.json');
  assert(!registry.blockedJobFiles.some(value => value.jobId === job.jobId) &&
    current.boundFiles.every(value => !registry.retiredOutputSha256.includes(value.sha256)), '冻结或退役输入不可重用');
  const spoken = spawnSync(process.execPath, [resolve(root, 'tools/check-spoken-source-policy.mjs'),
    ...['transcript', 'bilingualCaptions', 'spokenSourcePolicy'].map(key => resolve(root, job.inputs[key]))], {cwd: root, encoding: 'utf8'});
  assert(spoken.status === 0, `实录字幕校验未通过：${spoken.stderr || spoken.stdout}`);
  assertNoRetiredGeneratedStyle({value: {job, manifest}, operation: ROUTE, projectRoot: root, documentPaths: [expectedJob, expectedManifest]});
  return {ok: true, route: ROUTE, episodeId: EPISODE, jobId: job.jobId, revisionId: REVISION,
    manifestPath: expectedManifest, manifestSha256: pins[variant], ...current,
    userPreviewApproved: false, fullWatchConfirmed: false, publishAuthorized: false,
    directorBinding: {ok: true, status: 'candidate-entry-director-bound',
      postshootEvidence: 'actual-spoken-timeline', spokenAuthority: 'recorded-audio', skillPackageAccepted: false,
      userPreviewApproved: false, paperSceneCount: 6}};
}
