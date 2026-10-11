import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {collectProductionBoundFilesV2, computeProductionCompositionBindingV2,
  computeProductionJobSnapshotSha256V2, stableJsonSha256ForProductionGateV2}
  from '../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {assertNoRetiredGeneratedStyle} from '../../../tools/generated-style-policy.mjs';

// 沿用已有逐期固定输入清单入口，仅接受本期完整候选；不放宽通用门或伪造独立签名。
export const BASE = 'edit/20261011_enterprise_ai_organization';
export const CONTROL = `${BASE}/06_成片控制`;
export const ROUTE = 'enterprise-ai-organization-scoped-render-v1';
export const EPISODE = '20261011_enterprise_ai_organization';
export const REVISION = 'enterprise-ai-organization-v8-r1';
export const JOB = `${CONTROL}/production-full-candidate.v1.json`;
export const MANIFEST = `${CONTROL}/export-manifest.full-candidate.v1.json`;
export const RUNTIME = 'remotion/src/enterprise-ai-organization/runtime-plan.v1.json';
export const PUBLIC = `${BASE}/09_渲染素材/public`;
export const ENTRY = 'src/enterprise-ai-organization/index.tsx';
export const SOURCE = `${BASE}/01_素材投放区/01_口播原片/copy_6040572B-1985-4C66-842D-0F3B63C6E29C.MOV`;
export const ORIGINALS = [SOURCE, ...Array.from({length: 5}, (_, i) =>
  `${BASE}/01_素材投放区/04_纸艺视频/20261011_P0${i + 1}_待确认生成.mp4`)];
export const OUTPUT = `${BASE}/11_成片与发布包/企业全员AI改造_V8_R1_1080P_完整候选.mp4`;
const SHA = /^[a-f0-9]{64}$/u;
const EXPECTED_SOURCE_SHA = '6547a15055ec44a5765f054816e2f9555ce1524b4f8664dbbeb6bce1fa8712bb';
const USER_ID = 'msg_01a12b37-1cb9-7740-8edd-dc2ab591b72d';
const hash = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => stableJsonSha256ForProductionGateV2(a) === stableJsonSha256ForProductionGateV2(b);
const assert = (ok, message) => {if (!ok) throw Object.assign(new Error(message), {code: 'EAO_BINDING'});};
export const isEnterpriseAIOrganizationRenderV1 = job => job?.productionGate?.route === ROUTE;
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
export function collectEnterpriseAIOrganizationBindings({projectRoot, job}) {
  const copy = structuredClone(job);
  copy.inputs.fingerprintPaths = copy.inputs.fingerprintPaths.filter(p => ![MANIFEST, 'tools/scoped-direct-export-core.mjs'].includes(p));
  const boundFiles = collectProductionBoundFilesV2({projectRoot, job: copy})
    .filter(item => ![MANIFEST, 'tools/scoped-direct-export-core.mjs'].includes(item.path));
  return {jobSnapshotSha256: computeProductionJobSnapshotSha256V2(job), boundFiles,
    compositionBinding: computeProductionCompositionBindingV2(job, {projectRoot})};
}
export function assertEnterpriseAIOrganizationRenderV1({projectRoot, job, jobPath = null, command, pin}) {
  const root = resolve(projectRoot), gate = job.productionGate;
  assert(command === 'direct-remotion-preview', '本期只允许完整待审候选，正式验收和发布未授权');
  assert(job.jobId === '20261011-enterprise-ai-organization-v8-r1-full-candidate' && job.videoId === EPISODE, '不属于本期任务');
  assert(jobPath === null || (isAbsolute(jobPath) ? relative(root, jobPath).split(sep).join('/') : jobPath) === JOB, '任务路径不是本期');
  assert(same(read(root, JOB), job), '调用对象与磁盘任务不同');
  assert(gate.schema === 'director-production-entry-binding/v2' && gate.route === ROUTE &&
    gate.revisionId === REVISION && gate.state === 'scoped-preview-authorized-v1', '路由或修订不符');
  assert(SHA.test(pin ?? '') && gate.scopedDirectExport?.path === MANIFEST && gate.scopedDirectExport.sha256 === pin, '真实清单未登记');
  assert(job.productionEligible === false && job.formal?.enabled === false && gate.formalEnabled === false &&
    gate.userPreviewApproved === false && job.experiment?.userPreviewApproved === false &&
    job.finalReview?.fullWatchConfirmed === false && job.publishAuthorized === false, '不能把开始制作登记成验收通过');
  assert(['directorContract', 'freezeReceipt', 'formalAuthorization'].every(key => gate[key] == null), '不得伪造通用导演合同或监督签名');
  assert(job.preview?.enabled === true && job.preview.output === OUTPUT && job.formal.rawOutput === null &&
    job.formal.finalOutput === null, '输出必须是本期完整待审文件');
  const manifest = JSON.parse(bound(root, gate.scopedDirectExport));
  assert(manifest.schema === 'enterprise-ai-organization-export-manifest/v1' && manifest.route === ROUTE &&
    manifest.episodeId === EPISODE && manifest.jobId === job.jobId && manifest.jobPath === JOB, '清单身份不符');
  const current = collectEnterpriseAIOrganizationBindings({projectRoot: root, job});
  assert(same(current, manifest.binding), '输入、代码或任务变更后必须重新绑定');
  const files = new Map(current.boundFiles.map(file => [file.path, file]));
  const requireBound = file => assert(files.has(file), `未进入闭包：${file}`);
  for (const file of [...ORIGINALS, RUNTIME, `${CONTROL}/export-adapter.v1.mjs`, `${CONTROL}/build-export-binding.v1.mjs`,
    `${CONTROL}/真实制作授权.v1.json`, `${CONTROL}/真实制作授权.v1.user.jsonl`,
    ...['transcript','bilingualCaptions','spokenSourcePolicy','sfxCueSheet','audioMixReceipt','audioTransientReceipt'].map(key => job.inputs[key]),
    'workflow/active-production-profile.v1.json', `${BASE}/00_导演方案/director-cues.v2.json`,
    `${BASE}/10_动效匹配/auto-match-receipt.v1.json`]) requireBound(file);
  assert(same(manifest.originalMedia.map(file => file.path), ORIGINALS) &&
    manifest.originalMedia.every(file => files.get(file.path)?.sha256 === file.sha256) &&
    files.get(SOURCE)?.sha256 === EXPECTED_SOURCE_SHA, '本期六份原素材未逐一绑定或原片被替换');
  assert(job.inputs.source === SOURCE && job.inputs.visualPlan === RUNTIME, '不允许使用旧片输入');
  const source = probe(root, SOURCE), proxy = probe(root, job.inputs.renderProxy);
  assert(source.streams.some(stream => stream.codec_type === 'audio') && Math.ceil(Number(source.format.duration) * 30) === 4385,
    '原片完整声音须覆盖本期4385帧窗');
  const video = proxy.streams.find(stream => stream.codec_type === 'video');
  assert(video?.avg_frame_rate === '30/1' && Number(video.nb_frames) === 4384, '须使用本期完整4384视频帧，尾部音轨不得截断');
  const profile = read(root, 'workflow/active-production-profile.v1.json');
  assert(profile.profileVersion === 'V8' && job.productionProfile?.version === 'V8' && job.productionProfile.id === profile.profileId, 'V8基线不得降级');
  const runtime = read(root, RUNTIME);
  assert(runtime.durationInFrames === 4385 && runtime.fps === 30 && runtime.width === 1920 && runtime.height === 1080,
    '本期完整规格不符');
  assert(same(runtime.captions, read(root, job.inputs.captionsRuntime)), '实际字幕消费者未绑定本期实录字幕');
  assert(runtime.paperClips.length === 5 && same(runtime.paperClips.map(clip => clip.id), ['P01','P02','P03','P04','P05']), '纸艺五镜需完整绑定');
  for (const [index, clip] of runtime.paperClips.entries()) {
    const media = probe(root, ORIGINALS[index + 1]);
    assert(Number.isInteger(clip.from) && Number.isInteger(clip.to) && clip.from >= 0 && clip.to > clip.from && clip.to <= 4385 &&
      clip.sourceFps > 0 && clip.sourceInFrame >= 0 && clip.sourceInFrame / clip.sourceFps + (clip.to - clip.from) / 30 <= Number(media.format.duration) + 1/30,
      `纸艺窗口越界：${clip.id}`);
    assert(media.streams.some(stream => stream.codec_type === 'audio'), `未保留有声纸艺源：${clip.id}`);
    requireBound(`${PUBLIC}/${runtime.assetPrefix}${clip.src}`);
    assert(files.get(`${PUBLIC}/${runtime.assetPrefix}${clip.src}`).sha256 === files.get(ORIGINALS[index + 1]).sha256, '纸艺副本必须与交回原素材相同');
  }
  assert(runtime.motions.length > 0 && runtime.cameras.length > 0, '缺少实际语义动效或数字运镜');
  for (const motion of runtime.motions) assert(!runtime.paperClips.some(clip => motion.from < clip.to && motion.to > clip.from), '纸艺内部不得叠加Shotcraft');
  for (const name of [runtime.audioWithSfx, runtime.audioNoSfx]) {
    const path = `${PUBLIC}/${runtime.assetPrefix}${name}`;
    requireBound(path);
    assert(Math.abs(Number(probe(root, path).format.duration) - 4385/30) <= 1/30, '音轨不覆盖完整时间轴');
  }
  const sound = read(root, job.inputs.sfxCueSheet);
  assert(sound.durationInFrames === 4385 && sound.fps === 30 && sound.paper.length === 5 && sound.sfx.length > 0,
    '声音计划须绑定本期五镜和有效音点');
  const mix = read(root, job.inputs.audioMixReceipt), measured = read(root, job.inputs.audioTransientReceipt);
  assert(mix.sourceSha256 === EXPECTED_SOURCE_SHA && mix.spokenContentChanged === false &&
    mix.originalVoiceCut === false && mix.originalVoiceSpeedChanged === false && mix.voiceSidechainDucked === false,
    '完整原声不可被删改、变速或为突出音效而侧链压低');
  assert(measured.allAddedSfxNonSilent === true && measured.actualPremixAllPeaksWithinTwoFrames === true &&
    measured.voicePathCheck?.passesFloatTolerance === true, '实际混音瞬态或原声路径尚未通过数值核对');
  for (const output of mix.outputs) {
    const originalPath = relative(root, output.path).split(sep).join('/');
    requireBound(originalPath);
    assert(files.get(originalPath).sha256 === output.sha256, '混音产物已漂移');
    const name = originalPath.split('/').at(-1);
    const publicPath = `${PUBLIC}/${runtime.assetPrefix}audio/${name}`;
    requireBound(publicPath);
    assert(files.get(publicPath).sha256 === output.sha256, '实际播放器音轨不是已核对混音');
  }
  for (const clip of sound.paper) {
    const visual = runtime.paperClips.find(value => value.id === clip.id);
    assert(visual && clip.startFrame === visual.from && clip.endFrameExclusive === visual.to &&
      clip.sourceStartSeconds === visual.sourceInFrame / visual.sourceFps && clip.speed === 1 && clip.loop === false &&
      clip.retainOriginalNativeAudio === true, '纸艺声音与画面窗口必须同源同速');
  }
  for (const motion of runtime.motions) assert(sound.sfx.some(cue => cue.motionId === motion.id), `动效没有动作声：${motion.id}`);
  for (const cue of sound.sfx) {
    const result = measured.cues.find(value => value.id === cue.id);
    const sourcePath = relative(root, cue.source).split(sep).join('/');
    requireBound(sourcePath); requireBound(cue.licenseReference);
    assert(files.get(sourcePath).sha256 === cue.sourceSha256 && result?.actualPremixPeakWithinTwoFrames === true &&
      result.visualFrame === cue.visualFrame && Math.abs(result.actualPremixPeakFrame - cue.visualFrame) <= 2,
      '附加声音须绑定实际源文件和2帧内主峰');
  }
  const auth = JSON.parse(bound(root, manifest.authorization));
  const events = bound(root, auth.evidence).toString('utf8').trim().split(/\r?\n/u).map(JSON.parse);
  const event = events[0], quote = event?.payload?.content?.filter(v => ['input_text','text'].includes(v.type)).map(v => v.text).join('\n').trim();
  assert(events.length === 1 && event.type === 'response_item' && event.payload?.role === 'user' && event.payload.id === USER_ID &&
    auth.userQuote === quote && auth.episodeId === EPISODE && auth.revisionId === REVISION && auth.phase === 'full-candidate' &&
    auth.independentSignature === false && auth.previewAuthorized === true && auth.previewAccepted === false &&
    auth.formalEnabled === false && auth.fullWatchConfirmed === false && auth.publishAuthorized === false, '授权须为真实本期用户制作消息，不冒充终验');
  assert(job.remotion.root === 'remotion' && job.remotion.entry === ENTRY && job.remotion.publicDir === PUBLIC &&
    job.remotion.compositionWithSfx === 'EnterpriseAIOrganization-WithSfx' &&
    job.remotion.compositionWithoutSfx === null && job.remotion.durationSeconds === 4385/30, '渲染身份或全片时间轴不符');
  const registry = read(root, 'workflow/director-production-freeze-registry.v2.json');
  assert(!registry.blockedJobFiles.some(value => value.jobId === job.jobId) && current.boundFiles.every(file => !registry.retiredOutputSha256.includes(file.sha256)), '冻结或退役输入不可复用');
  const spoken = spawnSync(process.execPath, [resolve(root, 'tools/check-spoken-source-policy.mjs'),
    ...['transcript','bilingualCaptions','spokenSourcePolicy'].map(key => resolve(root, job.inputs[key]))], {cwd: root, encoding: 'utf8'});
  assert(spoken.status === 0, `实录字幕未通过：${spoken.stderr || spoken.stdout}`);
  assertNoRetiredGeneratedStyle({value: {job, manifest}, operation: ROUTE, projectRoot: root, documentPaths: [JOB, MANIFEST]});
  return {ok: true, route: ROUTE, episodeId: EPISODE, jobId: job.jobId, revisionId: REVISION,
    manifestPath: MANIFEST, manifestSha256: pin, ...current, userPreviewApproved: false, fullWatchConfirmed: false, publishAuthorized: false,
    directorBinding: {ok: true, status: 'candidate-entry-director-bound', postshootEvidence: 'actual-spoken-timeline',
      spokenAuthority: 'recorded-audio', skillPackageAccepted: false, userPreviewApproved: false, paperSceneCount: 5}};
}
