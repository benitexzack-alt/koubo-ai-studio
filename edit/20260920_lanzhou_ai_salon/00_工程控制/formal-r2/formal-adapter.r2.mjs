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
export const CONTROL = `${BASE}/00_工程控制/formal-r2`;
export const JOB = 'workflow/jobs/20260920_lanzhou_ai_salon_v8_r2.production.json';
export const MANIFEST = `${CONTROL}/formal-manifest.r2.json`;
export const AUTHORIZATION = `${CONTROL}/formal-authorization.r2.json`;
export const AUTHORIZATION_EVENT = `${CONTROL}/formal-authorization.user.jsonl`;
export const ROUTE = 'lanzhou-ai-salon-scoped-formal-r2';
export const SOURCE = `${BASE}/01_原始素材/copy_63E2AF15-FCCC-4042-A5F1-7616B6D8BA30.MOV`;
export const SOURCE_SHA = '0bfdd6e411bbb6c97aeece55b55d0e68b63528367706cdf58c0f45f5c46617fd';
export const FRAME_COUNT = 18413;
export const FPS = 30;
export const DURATION_SECONDS = FRAME_COUNT / FPS;
export const TASK_ID = 'task-20260922T081153Z-62896994';
export const DIRECTOR_TASK_ID = '20260920_lanzhou_ai_salon_final_source_director_v2_r2';
export const MESSAGE_ID = 'msg_01a0c7f1-1788-7261-8622-7facc1754e90';
export const TURN_ID = '01a0c7f1-0b07-7282-82ea-979740d3bbd8';
export const IDENTITIES = Object.freeze([
  '黄鹏飞｜企业 AI 服务实践者｜需求连接 / 销售与交付',
  '葛永鹏｜西部奥体体育',
  '韩志鑫｜大四学生',
]);

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
    'SALON_R2_PATH',
    '绑定路径必须是项目相对路径',
  );
  const absolute = resolve(root, pathValue);
  const relation = relative(root, absolute).split(sep).join('/');
  requireThat(
    relation === pathValue && !relation.startsWith('../'),
    'SALON_R2_PATH',
    `绑定路径逃逸项目：${pathValue}`,
  );
  let cursor = root;
  for (const part of pathValue.split('/')) {
    cursor = resolve(cursor, part);
    requireThat(
      existsSync(cursor) && !lstatSync(cursor).isSymbolicLink(),
      'SALON_R2_PATH',
      `路径不存在或包含符号链接：${pathValue}`,
    );
  }
  requireThat(
    lstatSync(absolute).isFile() && realpathSync(absolute) === absolute,
    'SALON_R2_PATH',
    `绑定项必须是普通文件：${pathValue}`,
  );
  return absolute;
};

const readJson = (root, pathValue) =>
  JSON.parse(readFileSync(inside(root, pathValue), 'utf8'));

const readBound = (root, reference) => {
  requireThat(SHA.test(reference?.sha256 ?? ''), 'SALON_R2_SHA', '绑定摘要无效');
  const bytes = readFileSync(inside(root, reference.path));
  requireThat(
    hash(bytes) === reference.sha256,
    'SALON_R2_SHA',
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

export const isLanzhouAISalonFormalR2 = (job) =>
  job?.productionGate?.route === ROUTE;

export function collectLanzhouAISalonFormalR2Bindings({projectRoot, job}) {
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

export function assertLanzhouAISalonFormalR2({
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
    'SALON_R2_COMMAND',
    '本期适配只允许正式候选渲染、质检与发布前校验',
  );
  const normalizedJobPath =
    jobPath === null
      ? null
      : (isAbsolute(jobPath) ? relative(root, jobPath) : jobPath).split(sep).join('/');
  requireThat(
    normalizedJobPath === null || normalizedJobPath === JOB,
    'SALON_R2_SCOPE',
    '不是本期固定 R2 任务',
  );
  requireThat(same(readJson(root, JOB), job), 'SALON_R2_JOB_DISK', '任务与磁盘内容不一致');
  requireThat(
    job.jobId === '20260920-lanzhou-ai-salon-v8-r2-formal' &&
      job.videoId === 'LANZHOU_AI_SALON_20260920_FINAL_R2',
    'SALON_R2_IDENTITY',
    '任务身份不一致',
  );
  requireThat(
    gate?.schema === 'director-production-entry-binding/v2' &&
      gate.route === ROUTE &&
      gate.state === 'scoped-formal-authorized-r2' &&
      gate.revisionId === 'lanzhou-ai-salon-v8-r2' &&
      gate.formalEnabled === true &&
      gate.userPreviewApproved === false &&
      job.formal?.enabled === true &&
      job.finalReview?.fullWatchConfirmed === false &&
      job.publishAuthorized === false,
    'SALON_R2_STATE',
    '正式候选、全片观看或发布状态不符合当前授权',
  );
  requireThat(
    gate.scopedDirectExport?.path === MANIFEST &&
      gate.scopedDirectExport?.sha256 === pin &&
      SHA.test(pin ?? ''),
    'SALON_R2_PIN',
    '本期固定清单摘要不一致',
  );

  const manifest = JSON.parse(readBound(root, gate.scopedDirectExport));
  requireThat(
    manifest.schema === 'lanzhou-ai-salon-formal-manifest/v2' &&
      manifest.route === ROUTE &&
      manifest.jobPath === JOB,
    'SALON_R2_MANIFEST',
    '正式清单身份不一致',
  );
  const current = collectLanzhouAISalonFormalR2Bindings({projectRoot: root, job});
  requireThat(
    same(current, manifest.binding),
    'SALON_R2_BINDING_DRIFT',
    '原片、代理、字幕、导演表、动效、音效或运行代码已经漂移，必须重新绑定',
  );
  const boundFiles = new Map(current.boundFiles.map((entry) => [entry.path, entry]));

  const authorization = JSON.parse(readBound(root, manifest.authorization));
  requireThat(
    authorization.schema === 'lanzhou-ai-salon-formal-authorization/v2' &&
      authorization.messageId === MESSAGE_ID &&
      authorization.turnId === TURN_ID &&
      authorization.formalCandidateAuthorized === true &&
      authorization.intermediatePreviewRequired === false &&
      authorization.fullWatchConfirmed === false &&
      authorization.publishAuthorized === false &&
      same(authorization.correctedIdentities, IDENTITIES),
    'SALON_R2_AUTHORIZATION',
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
      IDENTITIES.every((identity) => userText.includes(identity)) &&
      userText.includes('视频最后以这个为最终版本') &&
      userText.includes('所有的语义按照原视频进行文字转换') &&
      userText.includes('抓紧出正片'),
    'SALON_R2_AUTHORIZATION',
    '授权证据必须是指定真实用户消息，并完整包含最终源、实录语义、身份修正和正片指令',
  );
  for (const reference of [manifest.authorization, authorization.evidence]) {
    requireThat(
      boundFiles.get(reference.path)?.sha256 === reference.sha256,
      'SALON_R2_UNBOUND',
      `授权证据未进入正式哈希闭包：${reference.path}`,
    );
  }

  requireThat(
    job.inputs?.source === SOURCE && boundFiles.get(SOURCE)?.sha256 === SOURCE_SHA,
    'SALON_R2_SOURCE',
    '正式原片不是用户指定的最终版本',
  );
  requireThat(
    job.remotion?.entry === 'src/salon-20260920-r2/index.tsx' &&
      job.remotion?.publicDir === 'remotion/public-salon-20260920' &&
      job.remotion?.compositionWithSfx === 'LanzhouAISalon20260920R2-WithSfx' &&
      job.remotion?.compositionWithoutSfx === 'LanzhouAISalon20260920R2-NoSfx' &&
      job.remotion?.durationSeconds === DURATION_SECONDS &&
      job.remotion?.fps === FPS &&
      job.remotion?.width === 1920 &&
      job.remotion?.height === 1080,
    'SALON_R2_COMPOSITION',
    '正式构图必须完整覆盖最终源 18413 帧',
  );
  const proxyReceipt = readJson(root, `${BASE}/06_剪辑工程/final-proxy.receipt.v2.json`);
  requireThat(
    proxyReceipt.ffprobe?.streams?.[0]?.nb_frames === String(FRAME_COUNT) &&
      proxyReceipt.ffprobe?.streams?.[0]?.r_frame_rate === '30/1' &&
      proxyReceipt.output === job.inputs.renderProxy &&
      boundFiles.get(job.inputs.renderProxy)?.sha256 === proxyReceipt.outputSha256,
    'SALON_R2_PROXY',
    '正式代理没有保持最终源的 18413 帧',
  );

  const visualPlan = readJson(root, job.inputs.visualPlan);
  requireThat(
    visualPlan.schemaVersion === 4 &&
      visualPlan.videoId === job.videoId &&
      visualPlan.editPolicy?.includes('18413帧') &&
      same(visualPlan.identityPolicy?.locked, IDENTITIES),
    'SALON_R2_VISUAL_PLAN',
    'V8 视觉计划没有锁定完整帧数或三条最终身份',
  );
  const profile = readJson(root, 'workflow/active-production-profile.v1.json');
  requireThat(
    profile.profileVersion === 'V8' &&
      job.productionProfile?.id === profile.profileId &&
      job.productionProfile?.version === profile.profileVersion,
    'SALON_R2_PROFILE',
    '必须使用当前 V8 生产档案',
  );
  requireThat(
    job.inputs.transcript === `${BASE}/05_实录与字幕/canonical-transcript.final-source.v2.json` &&
      job.inputs.bilingualCaptions === 'remotion/public-salon-20260920/data/captions.final-source.bilingual.v2.json' &&
      job.inputs.spokenSourcePolicy === `${BASE}/05_实录与字幕/spoken-source-policy.v2.json`,
    'SALON_R2_SPOKEN_PATHS',
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
    'SALON_R2_SPOKEN',
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
    'SALON_R2_DIRECTOR',
    'R2 导演四件套没有完整绑定到本任务',
  );
  requireThat(
    job.preview?.enabled === false &&
      job.preview?.output === null &&
      job.preview?.ranges?.length === 0 &&
      job.formal.rawOutput &&
      job.formal.finalOutput &&
      job.formal.rawOutput !== job.formal.finalOutput &&
      job.formal.finalOutput.includes('正式候选'),
    'SALON_R2_OUTPUT',
    '中间预览、原始渲染与正式候选输出边界不正确',
  );
  const registry = readJson(root, 'workflow/director-production-freeze-registry.v2.json');
  requireThat(
    !registry.blockedJobFiles.some((entry) => entry.jobId === job.jobId),
    'SALON_R2_FROZEN',
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
