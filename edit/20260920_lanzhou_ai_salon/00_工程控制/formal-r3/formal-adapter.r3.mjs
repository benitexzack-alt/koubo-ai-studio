import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  collectProductionBoundFilesV2,
  computeProductionCompositionBindingV2,
  computeProductionJobSnapshotSha256V2,
  stableJsonSha256ForProductionGateV2,
} from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {assertNoRetiredGeneratedStyle} from '../../../../tools/generated-style-policy.mjs';

export const BASE = 'edit/20260920_lanzhou_ai_salon';
export const CONTROL = `${BASE}/00_工程控制/formal-r3`;
export const JOB = 'workflow/jobs/20260920_lanzhou_ai_salon_v8_r3.production.json';
export const MANIFEST = `${CONTROL}/formal-manifest.r3.json`;
export const AUTHORIZATION = `${CONTROL}/formal-authorization.r3.json`;
export const AUTHORIZATION_EVENT = `${CONTROL}/formal-authorization.user.jsonl`;
export const ROUTE = 'lanzhou-ai-salon-scoped-formal-r3';
export const SOURCE = `${BASE}/01_原始素材/copy_63E2AF15-FCCC-4042-A5F1-7616B6D8BA30.MOV`;
export const SOURCE_SHA = '0bfdd6e411bbb6c97aeece55b55d0e68b63528367706cdf58c0f45f5c46617fd';
export const FRAME_COUNT = 18413;
export const FPS = 30;
export const DURATION_SECONDS = FRAME_COUNT / FPS;
export const TASK_ID = 'task-20260922T165824Z-925ba930';
export const DIRECTOR_TASK_ID = '20260920_lanzhou_ai_salon_final_source_director_v2_r2';
export const MESSAGE_ID = 'msg_01a0c925-1003-7bf3-9a84-c6a70f0c4931';
export const TURN_ID = '01a0c7f1-0b07-7282-82ea-979740d3bbd8';
export const R2_JOB = 'workflow/jobs/20260920_lanzhou_ai_salon_v8_r2.production.json';
export const R2_VISUAL_PLAN = `${BASE}/06_剪辑工程/visual-plan.v2.json`;
export const R3_VISUAL_PLAN = `${BASE}/06_剪辑工程/visual-plan.r3.json`;
export const R2_SFX_CUES = `${BASE}/06_剪辑工程/sfx-cues.v2.json`;
export const R3_SFX_CUES = `${CONTROL}/sfx-cues.r3.json`;
export const R3_REMOTION_VISUAL_PLAN =
  'remotion/src/salon-20260920-r3/visual-plan.v3.json';
export const R2_CANDIDATE =
  `${BASE}/08_正式成片/兰州AI实践者共创沙龙第一期_V8_R2_1080P_正式候选.mp4`;
export const R2_CANDIDATE_SHA =
  'e90d5326137c739ee6c601b7b1b1c2f31daeb7ee20f34e56f8ef70f08b1e4cca';
export const IDENTITIES = Object.freeze([
  '黄鹏飞｜企业 AI 服务实践者｜需求连接 / 销售与交付',
  '葛永鹏｜西部奥体体育',
  '韩志鑫｜大四学生',
]);
export const AUTHORIZATION_PHRASES = Object.freeze([
  '正片我已经看了',
  '唯一的一个问题',
  '洪岩',
  '全部放在画面的右边',
  '挡他的脸',
]);
export const HONG_LAYOUT_LAYER_IDS = Object.freeze([
  'salon-r2-028-hong-card',
  'salon-r2-029-hong-context',
  'salon-r2-030-hong-sources',
  'salon-r2-031-hong-vertical',
]);
export const REVISION_SCOPE = Object.freeze({
  type: 'layout-only',
  targetSpeaker: '洪岩',
  targetSide: 'right',
  authorizedElements: [
    'speaker-introduction-card',
    'chapter-marker',
    'semantic-overlay:salon-r2-029-hong-context',
    'semantic-overlay:salon-r2-030-hong-sources',
    'semantic-overlay:salon-r2-031-hong-vertical',
  ],
  unchanged: [
    'source-audio',
    'captions',
    'duration',
    'source-assets',
    'sfx',
    'other-speakers',
  ],
});

const SELF = 'tools/scoped-direct-export-core.mjs';
const SHA = /^[a-f0-9]{64}$/u;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) =>
  stableJsonSha256ForProductionGateV2(a) === stableJsonSha256ForProductionGateV2(b);
const fail = (code, message) => {
  throw Object.assign(new Error(message), {code});
};
const requireThat = (condition, code, message) => {
  if (!condition) fail(code, message);
};

const inside = (root, pathValue) => {
  requireThat(
    typeof pathValue === 'string' && pathValue.length > 0 && !isAbsolute(pathValue),
    'SALON_R3_PATH',
    '绑定路径必须是项目相对路径',
  );
  const absolute = resolve(root, pathValue);
  const relation = relative(root, absolute).split(sep).join('/');
  requireThat(
    relation === pathValue && !relation.startsWith('../'),
    'SALON_R3_PATH',
    `绑定路径逃逸项目：${pathValue}`,
  );
  let cursor = root;
  for (const part of pathValue.split('/')) {
    cursor = resolve(cursor, part);
    requireThat(
      existsSync(cursor) && !lstatSync(cursor).isSymbolicLink(),
      'SALON_R3_PATH',
      `路径不存在或包含符号链接：${pathValue}`,
    );
  }
  requireThat(
    lstatSync(absolute).isFile() && realpathSync(absolute) === absolute,
    'SALON_R3_PATH',
    `绑定项必须是普通文件：${pathValue}`,
  );
  return absolute;
};

const readJson = (root, pathValue) =>
  JSON.parse(readFileSync(inside(root, pathValue), 'utf8'));

const readBound = (root, reference) => {
  requireThat(SHA.test(reference?.sha256 ?? ''), 'SALON_R3_SHA', '绑定摘要无效');
  const bytes = readFileSync(inside(root, reference.path));
  requireThat(
    hash(bytes) === reference.sha256,
    'SALON_R3_SHA',
    `绑定文件已经改变：${reference.path}`,
  );
  return bytes;
};

const eventText = (event) =>
  event.payload?.content
    ?.filter((item) => ['input_text', 'text'].includes(item.type))
    .map((item) => item.text)
    .join('\n')
    .trim();

const unchangedProductionContract = (job) => ({
  productionProfile: job.productionProfile,
  baseline: job.baseline,
  inputs: {
    source: job.inputs?.source,
    renderProxy: job.inputs?.renderProxy,
    transcript: job.inputs?.transcript,
    captions: job.inputs?.captions,
    bilingualCaptions: job.inputs?.bilingualCaptions,
    spokenSourcePolicy: job.inputs?.spokenSourcePolicy,
    sfxManifest: job.inputs?.sfxManifest,
    timingRebind: job.inputs?.timingRebind,
  },
  remotion: {
    publicDir: job.remotion?.publicDir,
    durationSeconds: job.remotion?.durationSeconds,
    fps: job.remotion?.fps,
    width: job.remotion?.width,
    height: job.remotion?.height,
    concurrency: job.remotion?.concurrency,
  },
  preview: job.preview,
  riskFrameEntries: job.riskFrames?.entries,
  audioPreflight: job.audioPreflight,
  formalEncoding: {
    composition: job.formal?.composition,
    crf: job.formal?.crf,
    pixelFormat: job.formal?.pixelFormat,
    audioCodec: job.formal?.audioCodec,
    audioBitrate: job.formal?.audioBitrate,
    loudness: job.formal?.loudness,
  },
  director: job.director,
  visualEventCount: job.experiment?.primaryVisualEventCount,
  sfxCueCount: job.experiment?.sfxCueCount,
});

const expectedR3VisualPlan = (r2Plan) => {
  const expected = structuredClone(r2Plan);
  expected.videoId = 'LANZHOU_AI_SALON_20260920_FINAL_R3';
  for (const layerId of HONG_LAYOUT_LAYER_IDS) {
    const layer = expected.layers.find((item) => item.id === layerId);
    requireThat(
      Boolean(layer),
      'SALON_R3_VISUAL_SCOPE',
      `R2 视觉计划缺少洪岩目标图层：${layerId}`,
    );
    layer.zone = 'right-safe';
  }
  expected.layoutRevision = {
    revision: 'R3',
    scope: 'hong-yan-overlay-placement-only',
    targetSide: 'right',
    sourceVersion: 'R2',
  };
  return expected;
};

export const expectedR3SfxCues = (r2Cues) => ({
  ...structuredClone(r2Cues),
  videoId: 'LANZHOU_AI_SALON_20260920_FINAL_R3',
});

export const isLanzhouAISalonFormalR3 = (job) =>
  job?.productionGate?.route === ROUTE;

export function collectLanzhouAISalonFormalR3Bindings({projectRoot, job}) {
  const copy = structuredClone(job);
  copy.inputs.fingerprintPaths = copy.inputs.fingerprintPaths.filter(
    (pathValue) => ![SELF, MANIFEST].includes(pathValue),
  );
  return {
    jobSnapshotSha256: computeProductionJobSnapshotSha256V2(job),
    boundFiles: collectProductionBoundFilesV2({projectRoot, job: copy}).filter(
      (entry) => ![SELF, MANIFEST].includes(entry.path),
    ),
    compositionBinding: computeProductionCompositionBindingV2(job, {projectRoot}),
  };
}

export function assertLanzhouAISalonFormalR3({
  projectRoot,
  job,
  jobPath = null,
  command,
  pin,
}) {
  const root = resolve(projectRoot);
  const gate = job.productionGate;
  requireThat(
    ['direct-remotion-render', 'formal', 'formal-audio', 'qa', 'release-validation'].includes(command),
    'SALON_R3_COMMAND',
    '本期适配只允许正式候选渲染、质检与发布前校验',
  );
  const normalizedJobPath =
    jobPath === null
      ? null
      : (isAbsolute(jobPath) ? relative(root, jobPath) : jobPath).split(sep).join('/');
  requireThat(
    normalizedJobPath === null || normalizedJobPath === JOB,
    'SALON_R3_SCOPE',
    '不是本期固定 R3 任务',
  );
  requireThat(same(readJson(root, JOB), job), 'SALON_R3_JOB_DISK', '任务与磁盘内容不一致');
  requireThat(
    job.jobId === '20260920-lanzhou-ai-salon-v8-r3-formal' &&
      job.videoId === 'LANZHOU_AI_SALON_20260920_FINAL_R3' &&
      same(job.revisionScope, REVISION_SCOPE) &&
      job.revisionBase?.path === R2_CANDIDATE &&
      job.revisionBase?.sha256 === R2_CANDIDATE_SHA,
    'SALON_R3_IDENTITY',
    '任务身份、R2 基准候选或返修范围不一致',
  );
  requireThat(
    gate?.schema === 'director-production-entry-binding/v2' &&
      gate.route === ROUTE &&
      gate.state === 'scoped-formal-authorized-r3' &&
      gate.revisionId === 'lanzhou-ai-salon-v8-r3' &&
      gate.formalEnabled === true &&
      gate.userPreviewApproved === false &&
      job.formal?.enabled === true &&
      job.finalReview?.fullWatchConfirmed === false &&
      job.publishAuthorized === false,
    'SALON_R3_STATE',
    '正式候选、全片观看或发布状态不符合当前授权',
  );
  requireThat(
    gate.scopedDirectExport?.path === MANIFEST &&
      gate.scopedDirectExport?.sha256 === pin &&
      SHA.test(pin ?? ''),
    'SALON_R3_PIN',
    '本期固定清单摘要不一致',
  );

  const manifest = JSON.parse(readBound(root, gate.scopedDirectExport));
  requireThat(
    manifest.schema === 'lanzhou-ai-salon-formal-manifest/v3' &&
      manifest.route === ROUTE &&
      manifest.jobPath === JOB &&
      same(manifest.revisionScope, REVISION_SCOPE) &&
      manifest.baseCandidate?.path === R2_CANDIDATE &&
      manifest.baseCandidate?.sha256 === R2_CANDIDATE_SHA,
    'SALON_R3_MANIFEST',
    '正式清单身份不一致',
  );
  const current = collectLanzhouAISalonFormalR3Bindings({projectRoot: root, job});
  requireThat(
    same(current, manifest.binding),
    'SALON_R3_BINDING_DRIFT',
    '原片、代理、字幕、导演表、动效、音效或运行代码已经漂移，必须重新绑定',
  );
  const boundFiles = new Map(current.boundFiles.map((entry) => [entry.path, entry]));

  const authorization = JSON.parse(readBound(root, manifest.authorization));
  requireThat(
    authorization.schema === 'lanzhou-ai-salon-revision-authorization/v3' &&
      authorization.messageId === MESSAGE_ID &&
      authorization.turnId === TURN_ID &&
      authorization.formalCandidateAuthorized === true &&
      authorization.intermediatePreviewRequired === false &&
      authorization.fullWatchConfirmed === false &&
      authorization.publishAuthorized === false &&
      authorization.baseCandidateReviewedByUser === true &&
      authorization.baseCandidate?.path === R2_CANDIDATE &&
      authorization.baseCandidate?.sha256 === R2_CANDIDATE_SHA &&
      same(authorization.correctedIdentities, IDENTITIES) &&
      same(authorization.revisionScope, REVISION_SCOPE),
    'SALON_R3_AUTHORIZATION',
    '用户授权范围或三条身份修正不一致',
  );
  const eventBytes = readBound(root, authorization.evidence);
  const event = JSON.parse(eventBytes.toString('utf8').trim());
  const userText = eventText(event);
  requireThat(
    event.type === 'response_item' &&
      event.payload?.role === 'user' &&
      event.payload?.id === MESSAGE_ID &&
      event.payload?.internal_chat_message_metadata_passthrough?.turn_id === TURN_ID &&
      hash(userText) === authorization.userTextSha256 &&
      AUTHORIZATION_PHRASES.every((phrase) => userText.includes(phrase)),
    'SALON_R3_AUTHORIZATION',
    '授权证据必须是指定真实用户消息，并完整包含已看正片、唯一问题、洪岩、右移和挡脸五项原话',
  );
  for (const reference of [
    manifest.authorization,
    authorization.evidence,
    authorization.baseCandidate,
  ]) {
    requireThat(
      boundFiles.get(reference.path)?.sha256 === reference.sha256,
      'SALON_R3_UNBOUND',
      `授权证据未进入正式哈希闭包：${reference.path}`,
    );
  }

  requireThat(
    job.inputs?.source === SOURCE && boundFiles.get(SOURCE)?.sha256 === SOURCE_SHA,
    'SALON_R3_SOURCE',
    '正式原片不是用户指定的最终版本',
  );
  requireThat(
    boundFiles.get(R2_CANDIDATE)?.sha256 === R2_CANDIDATE_SHA,
    'SALON_R3_BASE_CANDIDATE',
    'R3 返修没有绑定用户已观看的固定 R2 候选',
  );
  const r2Job = readJson(root, R2_JOB);
  requireThat(
    same(unchangedProductionContract(job), unchangedProductionContract(r2Job)),
    'SALON_R3_UNCHANGED_CONTRACT',
    'R3 的音频、字幕、时长、素材、音效、其他人物或编码合同偏离 R2',
  );
  requireThat(
    job.remotion?.entry === 'src/salon-20260920-r3/index.tsx' &&
      job.remotion?.publicDir === 'remotion/public-salon-20260920' &&
      job.remotion?.compositionWithSfx === 'LanzhouAISalon20260920R3-WithSfx' &&
      job.remotion?.compositionWithoutSfx === 'LanzhouAISalon20260920R3-NoSfx' &&
      job.remotion?.durationSeconds === DURATION_SECONDS &&
      job.remotion?.fps === FPS &&
      job.remotion?.width === 1920 &&
      job.remotion?.height === 1080,
    'SALON_R3_COMPOSITION',
    '正式构图必须完整覆盖最终源 18413 帧',
  );
  const r3CompositionSource = readFileSync(
    inside(root, 'remotion/src/salon-20260920-r3/SalonHighlightR3.tsx'),
    'utf8',
  );
  const r3RootExport = readFileSync(
    inside(root, 'remotion/src/salon-20260920-r3/index.ts'),
    'utf8',
  );
  const r3EntrySource = readFileSync(
    inside(root, 'remotion/src/salon-20260920-r3/index.tsx'),
    'utf8',
  );
  requireThat(
    [
      "guest.name === '洪岩'",
      "chapter.index === '06'",
      'salon-r2-029-hong-context',
      'salon-r2-030-hong-sources',
      'salon-r2-031-hong-vertical',
      'HONG_RIGHT_SIDE_SHIFT_PX = 1130',
    ].every((token) => r3CompositionSource.includes(token)),
    'SALON_R3_LAYOUT_IMPLEMENTATION',
    'R3 构图没有同时锁定洪岩介绍卡、章节标和三段语义动效右移',
  );
  requireThat(
    r3RootExport.includes('export {SalonR3Root}') &&
      !r3RootExport.includes('SalonR2Root') &&
      r3EntrySource.includes('registerRoot(SalonR3Root)'),
    'SALON_R3_ROOT_EXPORT',
    'R3 入口必须完整引用 R3 Root',
  );
  const proxyReceipt = readJson(root, `${BASE}/06_剪辑工程/final-proxy.receipt.v2.json`);
  requireThat(
    proxyReceipt.ffprobe?.streams?.[0]?.nb_frames === String(FRAME_COUNT) &&
      proxyReceipt.ffprobe?.streams?.[0]?.r_frame_rate === '30/1' &&
      proxyReceipt.output === job.inputs.renderProxy &&
      boundFiles.get(job.inputs.renderProxy)?.sha256 === proxyReceipt.outputSha256,
    'SALON_R3_PROXY',
    '正式代理没有保持最终源的 18413 帧',
  );

  const visualPlan = readJson(root, job.inputs.visualPlan);
  requireThat(
    job.inputs.visualPlan === R3_VISUAL_PLAN &&
      visualPlan.schemaVersion === 4 &&
      visualPlan.videoId === job.videoId &&
      visualPlan.editPolicy?.includes('18413帧') &&
      same(visualPlan.identityPolicy?.locked, IDENTITIES) &&
      same(visualPlan, expectedR3VisualPlan(readJson(root, R2_VISUAL_PLAN))) &&
      same(visualPlan, readJson(root, R3_REMOTION_VISUAL_PLAN)),
    'SALON_R3_VISUAL_PLAN',
    'R3 视觉计划必须只改洪岩介绍卡及三段语义层的右侧元数据，并与 Remotion 内嵌计划一致',
  );
  const r2SfxCues = readJson(root, R2_SFX_CUES);
  const r3SfxCues = readJson(root, R3_SFX_CUES);
  requireThat(
    job.inputs.sfxCueSheet === R3_SFX_CUES &&
      r3SfxCues.schemaVersion === r2SfxCues.schemaVersion &&
      r3SfxCues.videoId === job.videoId &&
      same(r3SfxCues, expectedR3SfxCues(r2SfxCues)) &&
      same(r3SfxCues.cues, r2SfxCues.cues),
    'SALON_R3_SFX',
    'R3 音效表只能更新期次标识，所有音效内容必须与 R2 完全一致',
  );
  const profile = readJson(root, 'workflow/active-production-profile.v1.json');
  requireThat(
    profile.profileVersion === 'V8' &&
      job.productionProfile?.id === profile.profileId &&
      job.productionProfile?.version === profile.profileVersion,
    'SALON_R3_PROFILE',
    '必须使用当前 V8 生产档案',
  );
  requireThat(
    job.inputs.transcript === `${BASE}/05_实录与字幕/canonical-transcript.final-source.v2.json` &&
      job.inputs.bilingualCaptions === 'remotion/public-salon-20260920/data/captions.final-source.bilingual.v2.json' &&
      job.inputs.spokenSourcePolicy === `${BASE}/05_实录与字幕/spoken-source-policy.v2.json`,
    'SALON_R3_SPOKEN_PATHS',
    '实录、双语字幕或实录来源策略路径不匹配',
  );
  const spoken = spawnSync(
    process.execPath,
    [
      resolve(root, 'tools/check-spoken-source-policy.mjs'),
      resolve(root, job.inputs.transcript),
      resolve(root, job.inputs.bilingualCaptions),
      resolve(root, job.inputs.spokenSourcePolicy),
    ],
    {cwd: root, encoding: 'utf8'},
  );
  requireThat(
    spoken.status === 0,
    'SALON_R3_SPOKEN',
    `实录字幕校验失败：${spoken.stderr || spoken.stdout}`,
  );

  requireThat(
    job.director?.taskId === DIRECTOR_TASK_ID &&
      job.director?.phase === 'post-shoot' &&
      Object.values(job.director?.artifacts ?? {}).every(
        (reference) =>
          reference?.path &&
          SHA.test(reference?.sha256 ?? '') &&
          boundFiles.get(reference.path)?.sha256 === reference.sha256,
      ),
    'SALON_R3_DIRECTOR',
    'R2 导演四件套没有完整绑定到本任务',
  );
  requireThat(
    job.preview?.enabled === false &&
      job.preview?.output === null &&
      job.preview?.ranges?.length === 0 &&
      job.formal.rawOutput &&
      job.formal.finalOutput &&
      job.formal.rawOutput !== job.formal.finalOutput &&
      job.formal.rawOutput ===
        `${BASE}/08_正式成片/兰州AI实践者共创沙龙第一期_R3_正式渲染原始.mp4` &&
      job.formal.finalOutput ===
        `${BASE}/08_正式成片/兰州AI实践者共创沙龙第一期_V8_R3_1080P_正式候选.mp4` &&
      job.riskFrames?.outputDirectory === `${BASE}/07_预览与质检/正式R3/frames` &&
      job.cache?.directory === 'work/production-cache/lanzhou-ai-salon-v8-r3' &&
      job.reports?.runManifest === `${BASE}/07_预览与质检/正式R3/run-manifest.json` &&
      job.reports?.timingReport === `${BASE}/07_预览与质检/正式R3/timing.json` &&
      job.reports?.regressionReport === `${BASE}/07_预览与质检/正式R3/regression.json`,
    'SALON_R3_OUTPUT',
    'R3 的中间预览、正式输出、风险帧、缓存或报告路径没有与 R2 隔离',
  );
  const registry = readJson(root, 'workflow/director-production-freeze-registry.v2.json');
  requireThat(
    !registry.blockedJobFiles.some((entry) => entry.jobId === job.jobId),
    'SALON_R3_FROZEN',
    '冻结任务不能进入正式候选渲染',
  );
  assertNoRetiredGeneratedStyle({
    value: {job, manifest},
    operation: ROUTE,
    projectRoot: root,
    documentPaths: [JOB, MANIFEST],
  });
  return {
    ok: true,
    status: 'formal-entry-director-bound',
    route: ROUTE,
    manifestPath: MANIFEST,
    manifestSha256: pin,
    episodeId: job.videoId,
    jobId: job.jobId,
    revisionId: gate.revisionId,
    userPreviewApproved: false,
    formalCandidateAuthorized: true,
    fullWatchConfirmed: false,
    publishAuthorized: false,
    ...current,
    directorBinding: {
      ok: true,
      status: 'single-episode-authorized-director-v2-bound',
      postshootEvidence: 'actual-spoken-timeline',
      userPreviewApproved: false,
      formalCandidateAuthorized: true,
      fullWatchConfirmed: false,
      publishAuthorized: false,
    },
  };
}
