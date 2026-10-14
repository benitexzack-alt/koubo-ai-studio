import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {collectProductionBoundFilesV2, computeProductionCompositionBindingV2,
  computeProductionJobSnapshotSha256V2, stableJsonSha256ForProductionGateV2}
  from '../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {assertNoRetiredGeneratedStyle} from '../../../tools/generated-style-policy.mjs';

// 仅绑定本次明确授权的原速一分钟预览；不改变正式 V8 基线和旧片批准状态。
export const BASE = 'edit/20261014_director_motion_upgrade';
export const CONTROL = `${BASE}/control`;
export const ROUTE = 'director-motion-minute-preview-20261014';
export const JOB_ID = 'director-motion-minute-preview-20261014-r1';
export const EPISODE = '20261011_enterprise_ai_organization';
export const REVISION = 'director-motion-upgrade-r1';
export const JOB = `${CONTROL}/preview-job.v1.json`;
export const MANIFEST = `${CONTROL}/export-manifest.v1.json`;
export const RUNTIME = 'remotion/src/enterprise-ai-motion-upgrade-20261014/runtime-plan.v1.json';
export const PUBLIC = `${BASE}/public`;
export const ENTRY = 'src/enterprise-ai-motion-upgrade-20261014/index.tsx';
export const OUTPUT = `${BASE}/outputs/企业全员AI改造_导演升级_一分钟_R1_有音效.mp4`;
export const AUTHORIZATION = `${CONTROL}/真实制作授权.v1.json`;
export const AUTHORIZATION_EVIDENCE = `${CONTROL}/真实制作授权.v1.user.jsonl`;
export const SOURCE = `edit/${EPISODE}/01_素材投放区/01_口播原片/copy_6040572B-1985-4C66-842D-0F3B63C6E29C.MOV`;
export const ORIGINAL_CAPTIONS = `edit/${EPISODE}/07_字幕制作/captions.runtime.v1.json`;
export const ORIGINAL_RUNTIME = 'remotion/src/enterprise-ai-organization/runtime-plan.v1.json';
export const ORIGINALS = [SOURCE, ...['P03', 'P04'].map(id => `edit/${EPISODE}/01_素材投放区/04_纸艺视频/20261011_${id}_待确认生成.mp4`)];
export const SKILL_FILES = ['skills/koubo-remotion-director/SKILL.md',
  'skills/koubo-remotion-director/references/semantic-visual-director.v2.md',
  'skills/koubo-remotion-director/references/motion-upgrade-discovery.v1.md'];
export const SOURCE_SHA = '6547a15055ec44a5765f054816e2f9555ce1524b4f8664dbbeb6bce1fa8712bb';
export const START = 1604, END = 3402, FRAMES = END - START;
const SHA = /^[a-f0-9]{64}$/u;
const hash = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => stableJsonSha256ForProductionGateV2(a) === stableJsonSha256ForProductionGateV2(b);
const assert = (ok, message) => {if (!ok) throw Object.assign(new Error(message), {code: 'DIRECTOR_MINUTE_PREVIEW_BINDING'});};
export const isDirectorMotionMinutePreview = job => job?.productionGate?.route === ROUTE;

function inside(root, value) {
  assert(typeof value === 'string' && value && !isAbsolute(value), '须使用项目内规范相对路径');
  const absolute = resolve(root, value), rel = relative(root, absolute).split(sep).join('/');
  assert(rel === value && !rel.startsWith('../'), '绑定路径不得逃逸项目');
  let cursor = root;
  for (const part of rel.split('/')) {
    cursor = resolve(cursor, part);
    assert(existsSync(cursor) && !lstatSync(cursor).isSymbolicLink(), `缺失文件或符号链接：${value}`);
  }
  assert(lstatSync(absolute).isFile() && realpathSync(absolute) === absolute, '须绑定真实普通文件');
  return absolute;
}
const read = (root, file) => JSON.parse(readFileSync(inside(root, file), 'utf8'));
function bound(root, ref) {
  assert(SHA.test(ref?.sha256 ?? ''), '摘要未绑定');
  const bytes = readFileSync(inside(root, ref.path));
  assert(hash(bytes) === ref.sha256, `输入已改变：${ref.path}`);
  return bytes;
}
function probe(root, file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,avg_frame_rate,nb_frames,duration', '-of', 'json', inside(root, file)], {encoding: 'utf8'});
  assert(result.status === 0, `无法探测：${file}`);
  return JSON.parse(result.stdout);
}
export const sliceMinuteCaptions = captions => captions.filter(c => c.to > START && c.from < END)
  .map(c => ({...c, from: Math.max(c.from, START) - START, to: Math.min(c.to, END) - START}));

// 纯边界函数由实际入口调用；负例直接检验，避免复制一套只为测试通过的规则。
export function assertMinutePreviewBoundary({job, runtime, originalCaptions, sourceSha256, command}) {
  const gate = job?.productionGate;
  assert(command === 'direct-remotion-preview', '只允许一分钟待审预览，正式导出和发布未授权');
  assert(job.jobId === JOB_ID && job.videoId === EPISODE && gate?.route === ROUTE &&
    gate.schema === 'director-production-entry-binding/v2' && gate.revisionId === REVISION &&
    gate.state === 'scoped-preview-authorized-v1', '路由、任务或修订不符');
  assert(job.inputs?.source === SOURCE && sourceSha256 === SOURCE_SHA && job.inputs.visualPlan === RUNTIME,
    '不得更换历史原片或本次视觉计划');
  assert(job.productionEligible === false && job.formal?.enabled === false && gate.formalEnabled === false &&
    gate.userPreviewApproved === false && job.experiment?.userPreviewApproved === false &&
    job.finalReview?.fullWatchConfirmed === false && job.publishAuthorized === false,
    '不得把制作授权登记为人工验收或正式发布');
  assert(['directorContract', 'freezeReceipt', 'formalAuthorization'].every(key => gate[key] == null),
    '不得伪造通用导演合同或监督签名');
  assert(job.preview?.enabled === true && job.preview.output === OUTPUT && job.formal.rawOutput === null &&
    job.formal.finalOutput === null, '只允许本次固定预览输出');
  assert(runtime.sourceStartFrame === START && runtime.sourceEndFrame === END && runtime.durationInFrames === FRAMES &&
    runtime.fps === 30 && runtime.width === 1920 && runtime.height === 1080, '原速连续窗口或预览规格改变');
  assert(same(runtime.captions, sliceMinuteCaptions(originalCaptions)), '字幕必须逐字沿用历史实录，仅切窗平移');
  const clips = runtime.paperClips;
  assert(Array.isArray(clips) && clips.length === 2 && clips.every((clip, i) =>
    clip.id === ['P03', 'P04'][i] && clip.from === [514, 1371][i] && clip.to === [730, 1596][i] &&
    clip.sourceInFrame === 0 && clip.sourceFps === 24), '纸艺窗口或源起点被改写');
  assert(job.remotion?.root === 'remotion' && job.remotion.entry === ENTRY && job.remotion.publicDir === PUBLIC &&
    job.remotion.compositionWithSfx === 'DirectorMotionUpgrade20261014-WithSfx' &&
    [null, 'DirectorMotionUpgrade20261014-NoSfx'].includes(job.remotion.compositionWithoutSfx) &&
    job.remotion.durationSeconds === FRAMES / 30 && job.remotion.fps === 30 &&
    job.remotion.width === 1920 && job.remotion.height === 1080, '渲染身份或时间轴不符');
  return true;
}

export function assertMinutePreviewAuthorization({auth, events}) {
  assert(Array.isArray(events) && events.length === 1, '须绑定单条真实用户授权原文');
  const event = events[0];
  let quote = null, messageId = null;
  if (event.type === 'response_item' && event.payload?.role === 'user') {
    quote = event.payload.content?.filter(v => ['input_text', 'text'].includes(v.type)).map(v => v.text).join('\n').trim();
    messageId = event.payload.id ?? null;
  } else if (event.type === 'event_msg' && event.payload?.type === 'user_message') {
    quote = event.payload.message?.trim();
    messageId = event.payload.id ?? null;
  }
  assert(typeof quote === 'string' && quote.length > 0 && auth.userQuote === quote &&
    (auth.currentMessageId ?? null) === messageId, '用户授权摘录或真实消息标识不匹配');
  assert(auth.schema === 'director-motion-minute-preview-authorization/v1' && auth.episodeId === EPISODE &&
    auth.jobId === JOB_ID && auth.revisionId === REVISION && auth.phase === 'minute-preview' &&
    auth.independentSignature === false && auth.previewAuthorized === true && auth.previewAccepted === false &&
    auth.formalEnabled === false && auth.fullWatchConfirmed === false && auth.publishAuthorized === false,
    '授权范围必须仅为本次待审样片');
  assert(auth.scope?.sourceStartFrame === START && auth.scope.sourceEndFrame === END &&
    auth.scope.originalSpeed === true && auth.scope.providerCallsAllowed === false,
    '授权范围不得扩窗、变速或新增外部生成');
  return true;
}

export function collectDirectorMotionMinuteBindings({projectRoot, job}) {
  // manifest含绑定摘要，注册核心含manifest PIN；排除这两项避免循环哈希。
  // job以去掉productionGate的快照绑定，不能把整个control目录作为输入。
  const excluded = [MANIFEST, JOB, 'tools/scoped-direct-export-core.mjs'];
  const copy = structuredClone(job);
  copy.inputs.fingerprintPaths = copy.inputs.fingerprintPaths.filter(p => !excluded.includes(p));
  const boundFiles = collectProductionBoundFilesV2({projectRoot, job: copy}).filter(item => !excluded.includes(item.path));
  return {jobSnapshotSha256: computeProductionJobSnapshotSha256V2(job), boundFiles,
    compositionBinding: computeProductionCompositionBindingV2(job, {projectRoot})};
}

export function assertDirectorMotionMinutePreview({projectRoot, job, jobPath = null, command, pin}) {
  const root = resolve(projectRoot), gate = job.productionGate;
  assert(command === 'direct-remotion-preview', '本次只允许受控预览');
  assert(jobPath === null || (isAbsolute(jobPath) ? relative(root, jobPath).split(sep).join('/') : jobPath) === JOB,
    '任务路径不是本次一分钟预览');
  assert(same(read(root, JOB), job), '调用对象与磁盘任务不同');
  assert(SHA.test(pin ?? '') && gate.scopedDirectExport?.path === MANIFEST && gate.scopedDirectExport.sha256 === pin,
    '本次清单尚未真实登记');
  const manifest = JSON.parse(bound(root, gate.scopedDirectExport));
  assert(manifest.schema === 'director-motion-minute-export-manifest/v1' && manifest.route === ROUTE &&
    manifest.episodeId === EPISODE && manifest.jobId === JOB_ID && manifest.jobPath === JOB &&
    manifest.variant === 'minute-preview' && manifest.fullWatchConfirmed === false && manifest.publishAuthorized === false,
    '清单身份或待审状态不符');
  const current = collectDirectorMotionMinuteBindings({projectRoot: root, job});
  assert(same(current, manifest.binding), '输入、代码或任务变更后必须重新绑定');
  const files = new Map(current.boundFiles.map(file => [file.path, file]));
  const requireBound = file => assert(typeof file === 'string' && files.has(file), `未进入闭包：${file}`);
  for (const file of [...ORIGINALS, ORIGINAL_CAPTIONS, ORIGINAL_RUNTIME, RUNTIME, ...SKILL_FILES,
    `${CONTROL}/export-adapter.v1.mjs`, `${CONTROL}/build-export-binding.v1.mjs`, `${CONTROL}/test-preview-boundary.v1.mjs`,
    AUTHORIZATION, AUTHORIZATION_EVIDENCE, 'tools/director-production-binding-core.mjs',
    'workflow/active-production-profile.v1.json', job.inputs.renderProxy,
    ...['transcript', 'bilingualCaptions', 'spokenSourcePolicy', 'audioMixReceipt', 'sfxCueSheet',
      'librarySelectionReceipt', 'visualEvents'].map(key => job.inputs[key])]) requireBound(file);
  assert(same(manifest.originalMedia.map(file => file.path), ORIGINALS) &&
    manifest.originalMedia.every(file => files.get(file.path)?.sha256 === file.sha256), '历史原素材未逐一绑定');
  const runtime = read(root, RUNTIME);
  assertMinutePreviewBoundary({job, runtime, originalCaptions: read(root, ORIGINAL_CAPTIONS),
    sourceSha256: files.get(SOURCE)?.sha256, command});
  const auth = JSON.parse(bound(root, manifest.authorization));
  assert(manifest.authorization.path === AUTHORIZATION && auth.evidence?.path === AUTHORIZATION_EVIDENCE,
    '授权须使用本次独立文件');
  assertMinutePreviewAuthorization({auth, events: bound(root, auth.evidence).toString('utf8').trim().split(/\r?\n/u).map(JSON.parse)});
  const profile = read(root, 'workflow/active-production-profile.v1.json');
  assert(profile.profileVersion === 'V8' && job.productionProfile?.version === 'V8' &&
    job.productionProfile.id === profile.profileId, '升级候选不得替换正式 V8 基线');
  const source = probe(root, SOURCE), proxy = probe(root, job.inputs.renderProxy);
  const video = proxy.streams.find(stream => stream.codec_type === 'video');
  assert(source.streams.some(stream => stream.codec_type === 'audio') && Number(source.format.duration) >= END / 30,
    '原片声音不足以覆盖指定窗口');
  assert(video?.avg_frame_rate === '30/1' && Number(video.nb_frames) >= END, '须使用原速完整历史代理并从指定源帧取窗');
  const asset = name => `${PUBLIC}/${runtime.assetPrefix ?? ''}${name}`;
  requireBound(asset(runtime.hostSource));
  assert(files.get(asset(runtime.hostSource)).sha256 === files.get(job.inputs.renderProxy).sha256,
    '播放器口播源必须与只读历史代理相同');
  for (const font of [runtime.fontSource, runtime.captionFontSource].filter(Boolean)) requireBound(asset(font));
  for (const [index, clip] of runtime.paperClips.entries()) {
    requireBound(asset(clip.src));
    assert(files.get(asset(clip.src)).sha256 === files.get(ORIGINALS[index + 1]).sha256, '纸艺副本必须与历史原素材相同');
    const media = probe(root, ORIGINALS[index + 1]);
    assert(media.streams.some(stream => stream.codec_type === 'audio') &&
      (clip.to - clip.from) / 30 <= Number(media.format.duration) + 1 / 30, '纸艺窗口须保留同源可用声音');
  }
  const mix = read(root, job.inputs.audioMixReceipt);
  assert(mix.schema === 'director-motion-minute-audio/v1' && mix.sourceSha256 === SOURCE_SHA &&
    mix.sourceStartFrame === START && mix.sourceEndFrame === END && mix.fps === 30 && mix.durationInFrames === FRAMES &&
    mix.spokenContentChanged === false && mix.originalVoiceSpeedChanged === false && mix.voiceSidechainDucked === false &&
    mix.baseAudioSampleSliceVerified === true && mix.withSfxVoiceUnchanged === true,
    '须证明一分钟底声样本截取和附加音效后原声不变，不冒充全片保留');
  assert(Array.isArray(mix.outputs) && mix.outputs.length >= 2, '缺少有音效及底声对照');
  for (const name of [runtime.audioWithSfx, runtime.audioNoSfx]) {
    const file = asset(name);
    requireBound(file);
    assert(mix.outputs.some(output => output.sha256 === files.get(file).sha256), '播放器声音不属于已核对混音');
    assert(Math.abs(Number(probe(root, file).format.duration) - FRAMES / 30) <= 1 / 30, '音频未覆盖本次窗口');
  }
  for (const output of mix.outputs) {
    const file = isAbsolute(output.path) ? relative(root, output.path).split(sep).join('/') : output.path;
    requireBound(file);
    assert(files.get(file).sha256 === output.sha256, '混音回执产物已漂移');
  }
  const sound = read(root, job.inputs.sfxCueSheet);
  assert(sound.durationInFrames === FRAMES && sound.fps === 30 && sound.sfx?.length > 0, '缺少本次视觉动作音点');
  for (const cue of sound.sfx) {
    const file = isAbsolute(cue.source) ? relative(root, cue.source).split(sep).join('/') : cue.source;
    requireBound(file); requireBound(cue.licenseReference);
    assert(files.get(file).sha256 === cue.sourceSha256 && Number.isInteger(cue.visualFrame) &&
      cue.visualFrame >= 0 && cue.visualFrame < FRAMES, '声音来源或视觉落点不符');
  }
  const registry = read(root, 'workflow/director-production-freeze-registry.v2.json');
  assert(!registry.blockedJobFiles.some(value => value.jobId === job.jobId) &&
    current.boundFiles.every(file => !registry.retiredOutputSha256.includes(file.sha256)), '冻结或退役输入不可复用');
  const spoken = spawnSync(process.execPath, [resolve(root, 'tools/check-spoken-source-policy.mjs'),
    ...['transcript', 'bilingualCaptions', 'spokenSourcePolicy'].map(key => resolve(root, job.inputs[key]))], {cwd: root, encoding: 'utf8'});
  assert(spoken.status === 0, `历史实录字幕未通过：${spoken.stderr || spoken.stdout}`);
  assertNoRetiredGeneratedStyle({value: {job, manifest}, operation: ROUTE, projectRoot: root, documentPaths: [JOB, MANIFEST]});
  return {ok: true, route: ROUTE, episodeId: EPISODE, jobId: JOB_ID, revisionId: REVISION,
    manifestPath: MANIFEST, manifestSha256: pin, ...current, userPreviewApproved: false, fullWatchConfirmed: false,
    publishAuthorized: false, directorBinding: {ok: true, status: 'minute-preview-director-bound',
      postshootEvidence: 'actual-spoken-continuous-minute-window', spokenAuthority: 'recorded-audio',
      skillPackageAccepted: false, userPreviewApproved: false, paperSceneCount: 2}};
}
