#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {existsSync, lstatSync, readFileSync, realpathSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {assertNoRetiredGeneratedStyle, RETIRED_GENERATED_STYLE_POLICY} from './generated-style-policy.mjs';
import {
  collectProductionBoundFilesV2,
  computeProductionCompositionBindingV2,
  computeProductionJobSnapshotSha256V2,
  stableJsonSha256ForProductionGateV2,
} from '../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';

export const SCOPED_DIRECT_EXPORT_MANIFEST_SHA256 = 'ba74d65e7bd59446718171aa38de6b0799092dbedb2180abd6c385587f28653e';
export const SCOPED_DIRECT_EXPORT = Object.freeze({
  schema: 'koubo-scoped-direct-export/v1',
  route: 'scoped-direct-export',
  state: 'scoped-direct-export-authorized',
  episodeId: '20260904_gpt6_cybercab',
  jobId: '20260904-gpt6-cybercab-v8-r1',
  revisionId: 'gpt6-cybercab-v8-r1',
  directorTaskId: '20260904-gpt6-cybercab-paper-assets',
  jobPath: 'workflow/jobs/20260904_gpt6_cybercab_v80.production.json',
  manifestPath: 'edit/20260904_gpt6_cybercab/00_工程控制/scoped-direct-export.v1.json',
  entry: 'remotion/src/gpt6-cybercab-v8-r1/index.tsx',
  composition: 'GPT6CybercabV8R1WithSfx',
  riskFrameDirectory: 'edit/20260904_gpt6_cybercab/08_预览与质检/formal-r1/frames',
});
export const SCOPED_DIRECT_EXPORT_GATE_FILES = Object.freeze([
  'tools/scoped-direct-export-core.mjs',
  'tools/director-production-binding-core.mjs',
  'tools/director-skill-lock-core.mjs',
  'tools/check-spoken-source-policy.mjs',
  'tools/run-v72-production.mjs',
  'tools/validate-production-command-gate.mjs',
  'tools/validate-active-production-profile.mjs',
  'tools/validate-visual-plan.mjs',
  'skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs',
  'workflow/active-director-profile.v1.json',
  'workflow/active-production-profile.v1.json',
]);
const SELF = 'tools/scoped-direct-export-core.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[a-f0-9]{64}$/u;
const commands = ['doctor', 'fingerprint', 'risk-frames', 'formal', 'formal-audio', 'qa', 'release-validation'];
const object = (properties) => ({type: 'object', additionalProperties: false, required: Object.keys(properties), properties});
const text = {type: 'string', minLength: 1};
const digest = {type: 'string', pattern: SHA.source};
const file = object({path: text, sha256: digest});
const boundFile = object({path: text, sha256: digest, bytes: {type: 'integer', minimum: 1}});
const message = object({line: {type: 'integer', minimum: 1}, quote: text});
export const SCOPED_PRESHOOT_ARTIFACTS = Object.freeze(Object.fromEntries(Object.entries({
  preproductionRequest: 'director-preproduction-request.v1.json',
  preproductionPlan: 'director-preproduction-plan.v1.json',
  routeLock: 'director-route-lock.v1.json',
  preproductionValidation: 'director-validation-receipt.v1.json',
}).map(([key, name]) => [key, `edit/20260904_gpt6_cybercab/04_导演拆解/paper-v3-r2/${name}`])));
export const SCOPED_MANUAL_POSTSHOOT_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...object({
    schema: {const: 'koubo-scoped-manual-postshoot/v1'},
    taskId: {const: SCOPED_DIRECT_EXPORT.directorTaskId},
    episodeId: {const: SCOPED_DIRECT_EXPORT.episodeId},
    jobId: {const: SCOPED_DIRECT_EXPORT.jobId},
    revisionId: {const: SCOPED_DIRECT_EXPORT.revisionId},
    phase: {const: 'post-shoot'}, status: {const: 'manual-import-bound'},
    provenance: {const: 'user-generated-manual-import'},
    skillExecuted: {const: false}, skillPackageAccepted: {const: false}, userPreviewApproved: {const: false},
    spokenAuthority: {const: 'recorded-audio'}, scriptRole: {const: 'comparison-only'},
    bindings: object(Object.fromEntries([
      ...Object.keys(SCOPED_PRESHOOT_ARTIFACTS), 'postshootRequest', 'postshootPlan',
      'source', 'transcript', 'bilingualCaptions', 'spokenSourcePolicy', 'visualPlan', 'compositionEntry',
    ].map((key) => [key, file]))),
    generatedVideos: {type: 'array', minItems: 6, maxItems: 6, items: object({
      path: text, sha256: digest, provenance: {const: 'user-generated-manual-import'},
    })},
  }),
};
export const SCOPED_DIRECT_EXPORT_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  description: '父任务核对真实用户原文后固定清单摘要；仅作本条授权与完整性绑定，不提供独立签名或身份认证。',
  ...object({
    schema: {const: SCOPED_DIRECT_EXPORT.schema},
    route: {const: SCOPED_DIRECT_EXPORT.route},
    episodeId: {const: SCOPED_DIRECT_EXPORT.episodeId},
    jobId: {const: SCOPED_DIRECT_EXPORT.jobId},
    revisionId: {const: SCOPED_DIRECT_EXPORT.revisionId},
    jobPath: {const: SCOPED_DIRECT_EXPORT.jobPath},
    jobSnapshotSha256: digest,
    authorization: object({
      kind: {const: 'verified-user-direct-export'},
      evidence: file,
      format: {const: 'codex-rollout-jsonl'},
      directExportMessage: message,
      skipPreviewMessage: message,
      independentSignature: {const: false},
    }),
    media: object({source: file, renderProxy: file, transcript: file, bilingualCaptions: file, spokenSourcePolicy: file}),
    generatedVideos: {type: 'array', minItems: 6, maxItems: 6, items: object({
      path: text, sha256: digest, provenance: {const: 'user-generated-manual-import'},
    })},
    boundFiles: {type: 'array', minItems: 1, items: boundFile},
    compositionBinding: object({
      root: {const: 'remotion'}, entry: {const: 'src/gpt6-cybercab-v8-r1/index.tsx'},
      publicDir: text, compositionWithSfx: {const: SCOPED_DIRECT_EXPORT.composition},
      compositionWithoutSfx: {enum: [null, 'GPT6CybercabV8R1NoSfx']},
      durationSeconds: {type: 'number', exclusiveMinimum: 0}, fps: {type: 'number', exclusiveMinimum: 0},
      width: {type: 'integer', minimum: 1}, height: {type: 'integer', minimum: 1},
      controlledRemotionCli: object({linkPath: text, realTarget: text, targetSha256: digest, bytes: {type: 'integer', minimum: 1}}),
    }),
    outputs: object({rawOutput: text, finalOutput: text}),
    allowedCommands: {type: 'array', minItems: 1, uniqueItems: true, items: {enum: commands}},
    constraints: object({previewApproved: {const: false}, fullWatchConfirmed: {const: false},
      publishAuthorized: {const: false}, providerCallsAllowed: {const: false}}),
  }),
};

const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
const same = (a, b) => stableJsonSha256ForProductionGateV2(a) === stableJsonSha256ForProductionGateV2(b);
const hash = (value) => createHash('sha256').update(value).digest('hex');

function validateSchema(value, schema, at = '$') {
  if ('const' in schema && value !== schema.const) fail('SDE_SCHEMA', `${at} 必须为 ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail('SDE_SCHEMA', `${at} 不在允许值内`);
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('SDE_SCHEMA', `${at} 必须是对象`);
    for (const key of Object.keys(value)) if (!(key in schema.properties)) fail('SDE_SCHEMA', `${at}.${key} 未建模`);
    for (const key of schema.required) {
      if (!(key in value)) fail('SDE_SCHEMA', `${at}.${key} 缺失`);
      validateSchema(value[key], schema.properties[key], `${at}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail('SDE_SCHEMA', `${at} 数组长度无效`);
    if (schema.uniqueItems && new Set(value).size !== value.length) fail('SDE_SCHEMA', `${at} 存在重复项`);
    value.forEach((item, index) => validateSchema(item, schema.items, `${at}[${index}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || !value.trim() || (schema.pattern && !new RegExp(schema.pattern, 'u').test(value))) fail('SDE_SCHEMA', `${at} 字符串无效`);
  } else if (schema.type === 'number' || schema.type === 'integer') {
    if (!Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value)) || value < (schema.minimum ?? -Infinity) || value <= (schema.exclusiveMinimum ?? -Infinity)) fail('SDE_SCHEMA', `${at} 数值无效`);
  }
}

export const isScopedDirectExportJob = (job) => job?.productionGate?.route === SCOPED_DIRECT_EXPORT.route ||
  job?.productionGate?.state === SCOPED_DIRECT_EXPORT.state || job?.productionGate?.scopedDirectExport != null;

function inside(root, value, mustExist = true) {
  if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\\')) fail('SDE_PATH', '直出合同只接受规范项目相对路径');
  const absolute = resolve(root, value);
  const normalized = relative(root, absolute).split(sep).join('/');
  if (normalized !== value || normalized.startsWith('../') || !normalized) fail('SDE_PATH', `路径不规范或越界：${value}`);
  let cursor = root;
  for (const part of value.split('/')) {
    cursor = resolve(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) fail('SDE_SYMLINK', `不接受符号链接：${value}`);
  }
  if (mustExist && (!existsSync(absolute) || !lstatSync(absolute).isFile() || realpathSync(absolute) !== absolute)) fail('SDE_FILE', `文件不存在或不是普通文件：${value}`);
  return absolute;
}

function readFile(root, reference) {
  const absolute = inside(root, reference.path);
  const bytes = readFileSync(absolute);
  if (hash(bytes) !== reference.sha256) fail('SDE_FILE_SHA', `文件哈希变化：${reference.path}`);
  return bytes;
}

export function assertScopedManualPostshoot({projectRoot, job, manifest, receipt}) {
  validateSchema(receipt, SCOPED_MANUAL_POSTSHOOT_SCHEMA);
  if (job.director?.taskId !== SCOPED_DIRECT_EXPORT.directorTaskId) fail('SDE_DIRECTOR_TASK', '必须沿用本条真实预拍 taskId');
  const expected = {...Object.fromEntries(Object.entries(job.director.artifacts)
    .filter(([key]) => key !== 'postshootValidation').map(([key, ref]) => [key, ref.path])),
    ...Object.fromEntries(['source', 'transcript', 'bilingualCaptions', 'spokenSourcePolicy', 'visualPlan'].map((key) => [key, job.inputs[key]])),
    compositionEntry: SCOPED_DIRECT_EXPORT.entry};
  for (const [key, reference] of Object.entries(receipt.bindings)) {
    if (reference.path !== expected[key] || (key in SCOPED_PRESHOOT_ARTIFACTS && reference.path !== SCOPED_PRESHOOT_ARTIFACTS[key])) fail('SDE_MANUAL_BINDING', `人工导入回执绑定不匹配：${key}`);
    readFile(projectRoot, reference);
    if (!manifest.boundFiles.some((entry) => entry.path === reference.path && entry.sha256 === reference.sha256)) fail('SDE_MANUAL_BINDING', `人工导入凭证未进入本条完整绑定：${key}`);
  }
  if (!same(receipt.generatedVideos, manifest.generatedVideos)) fail('SDE_MANUAL_MEDIA', '拍后回执必须逐项绑定清单中的六段人工素材');
  return {status: 'manual-import-bound', skillExecuted: false, skillPackageAccepted: false, userPreviewApproved: false};
}

export function collectScopedDirectExportBindings({projectRoot = ROOT, job}) {
  const bindingJob = structuredClone(job);
  bindingJob.inputs = {...bindingJob.inputs, fingerprintPaths: (job.inputs?.fingerprintPaths ?? [])
    .filter((entry) => ![SCOPED_DIRECT_EXPORT.manifestPath, SELF].includes(entry))};
  return {
    jobSnapshotSha256: computeProductionJobSnapshotSha256V2(job),
    // The pinned manifest and this pin-bearing module cannot hash themselves.
    // Both remain in the live preflight closure and runner fingerprint.
    boundFiles: collectProductionBoundFilesV2({projectRoot, job: bindingJob})
      .filter((entry) => ![SCOPED_DIRECT_EXPORT.manifestPath, SELF].includes(entry.path)),
    compositionBinding: computeProductionCompositionBindingV2(job, {projectRoot}),
  };
}

function userText(line) {
  const event = JSON.parse(line);
  if (event.type === 'event_msg' && event.payload?.type === 'user_message') return event.payload.message;
  if (event.type === 'response_item' && event.payload?.type === 'message' && event.payload.role === 'user') {
    return event.payload.content.filter((item) => ['input_text', 'text'].includes(item.type)).map((item) => item.text).join('\n');
  }
  fail('SDE_USER_MESSAGE', '授权证据必须定位到真实 user 消息，不接受助手总结或工具输出');
}

export function assertScopedDirectExport({projectRoot = ROOT, job, jobPath = SCOPED_DIRECT_EXPORT.jobPath, command = 'formal'}) {
  const root = resolve(projectRoot);
  const relativeJob = isAbsolute(jobPath) ? relative(root, jobPath).split(sep).join('/') : jobPath;
  if (relativeJob !== SCOPED_DIRECT_EXPORT.jobPath || job?.jobId !== SCOPED_DIRECT_EXPORT.jobId || job?.videoId !== SCOPED_DIRECT_EXPORT.episodeId) fail('SDE_SCOPE', '直出路径只适用于本条固定 job 与 episode');
  if (!same(JSON.parse(readFileSync(inside(root, relativeJob), 'utf8')), job)) fail('SDE_JOB_DISK', '调用 job 与磁盘不一致');
  const gate = job.productionGate;
  if (gate?.schema !== 'director-production-entry-binding/v2' || gate.route !== SCOPED_DIRECT_EXPORT.route || gate.state !== SCOPED_DIRECT_EXPORT.state || gate.revisionId !== SCOPED_DIRECT_EXPORT.revisionId) fail('SDE_GATE', '本条直出合同路由或修订不匹配');
  if (!SHA.test(String(SCOPED_DIRECT_EXPORT_MANIFEST_SHA256 ?? ''))) fail('SDE_PIN_NOT_SET', '本条真实清单尚未审计固定摘要，禁止执行');
  if (gate.scopedDirectExport?.path !== SCOPED_DIRECT_EXPORT.manifestPath || gate.scopedDirectExport?.sha256 !== SCOPED_DIRECT_EXPORT_MANIFEST_SHA256) fail('SDE_PIN_MISMATCH', 'job 必须绑定本条唯一清单与代码固定摘要');
  const manifestBytes = readFile(root, gate.scopedDirectExport);
  const manifest = JSON.parse(manifestBytes);
  validateSchema(manifest, SCOPED_DIRECT_EXPORT_SCHEMA);
  if (job.productionState !== 'ready-for-production' || job.experiment?.id !== 'v8-semantic-continuity-sfx') fail('SDE_PRODUCTION_STATE', '本条必须保持已授权制作状态与 V8 生产合同');
  if (!manifest.allowedCommands.includes(command) || !commands.includes(command)) fail('SDE_COMMAND', `本条未授权命令：${command}`);
  if (command === 'risk-frames') {
    if (job.riskFrames?.outputDirectory !== SCOPED_DIRECT_EXPORT.riskFrameDirectory ||
      job.riskFrames?.enabled !== true || job.riskFrames?.fullResolution !== true) {
      fail('SDE_RISK_FRAME_SCOPE', '本条内部风险静帧必须全分辨率输出至固定 formal-r1/frames 目录');
    }
    const directory = inside(root, job.riskFrames.outputDirectory, false);
    if (existsSync(directory) && !lstatSync(directory).isDirectory()) fail('SDE_RISK_FRAME_SCOPE', '风险帧输出位置必须为目录');
  }
  if (job.formal?.enabled !== true || gate.formalEnabled !== true || gate.userPreviewApproved !== false || job.experiment?.status !== SCOPED_DIRECT_EXPORT.state || job.experiment?.userPreviewApproved !== false || job.experiment?.userPreviewApprovedAt != null || job.preview?.output != null || (job.preview?.ranges?.length ?? 0) !== 0 || job.preview?.renderWithoutSfxComparison === true) fail('SDE_PREVIEW_STATE', '直出必须真实保持无预览、无预览通过记录');
  if (['directorContract', 'handoffReceipt', 'freezeReceipt', 'formalAuthorization'].some((key) => gate[key] != null) || job.director?.currentTaskUserAcceptance != null) fail('SDE_FALSE_ATTESTATION', '直出授权不能伪装独立签名合同或本条预览验收');
  if (job.inputs?.generatedVideoPlan != null) fail('SDE_PROVIDER', '本条人工素材直出不得接入自动生成计划');
  if (job.director?.phase !== 'post-shoot') fail('SDE_POSTSHOOT', '本条仍须真实拍后重绑');
  const fingerprints = new Set(job.inputs?.fingerprintPaths ?? []);
  for (const required of [SCOPED_DIRECT_EXPORT.manifestPath, ...SCOPED_DIRECT_EXPORT_GATE_FILES, manifest.authorization.evidence.path, ...Object.values(job.director?.artifacts ?? {}).map((ref) => ref.path)]) {
    if (!fingerprints.has(required)) fail('SDE_FINGERPRINT', `必须纳入执行前后指纹：${required}`);
  }
  const registry = JSON.parse(readFileSync(inside(root, 'workflow/director-production-freeze-registry.v2.json'), 'utf8'));
  const denied = new Set([...registry.blockedJobFiles.map((entry) => entry.jobFileSha256), ...registry.retiredOutputSha256,
    ...RETIRED_GENERATED_STYLE_POLICY.contentSha256.map((entry) => entry.sha256)]);
  if (registry.blockedJobFiles.some((entry) => entry.jobId === job.jobId)) fail('SDE_FROZEN', '冻结任务不能使用单条直出路径');
  const evidenceLines = readFile(root, manifest.authorization.evidence).toString('utf8').split(/\r?\n/u);
  for (const item of [manifest.authorization.directExportMessage, manifest.authorization.skipPreviewMessage]) {
    const line = evidenceLines[item.line - 1];
    if (!line || userText(line) !== item.quote) fail('SDE_USER_QUOTE', '授权原文必须逐字匹配指定行完整 user 消息');
  }
  for (const [key, reference] of Object.entries(manifest.media)) {
    if (job.inputs?.[key] !== reference.path) fail('SDE_MEDIA_ROUTE', `输入未绑定本条清单：${key}`);
    readFile(root, reference);
    if (!fingerprints.has(reference.path)) fail('SDE_FINGERPRINT', `实录输入未纳入指纹：${reference.path}`);
  }
  if (new Set(manifest.generatedVideos.map((entry) => entry.path)).size !== 6 || new Set(manifest.generatedVideos.map((entry) => entry.sha256)).size !== 6) fail('SDE_MEDIA_COUNT', '必须是六个不同人工导入视频');
  for (const reference of manifest.generatedVideos) readFile(root, reference);
  const current = collectScopedDirectExportBindings({projectRoot: root, job});
  if (!same(manifest.boundFiles, current.boundFiles) || manifest.jobSnapshotSha256 !== current.jobSnapshotSha256 || !same(manifest.compositionBinding, current.compositionBinding)) fail('SDE_BINDING_DRIFT', 'job、媒体全集或 composition 依赖与固定清单不一致');
  const postReference = job.director?.artifacts?.postshootValidation;
  if (!postReference) fail('SDE_MANUAL_RECEIPT', '缺少本条拍后人工导入回执');
  assertScopedManualPostshoot({projectRoot: root, job, manifest, receipt: JSON.parse(readFile(root, postReference))});
  for (const entry of manifest.boundFiles) if (denied.has(entry.sha256)) fail('SDE_RETIRED_HASH', `旧事故或退役内容不得改名复用：${entry.path}`);
  for (const reference of manifest.generatedVideos) {
    if (!manifest.boundFiles.some((entry) => entry.path === reference.path && entry.sha256 === reference.sha256)) fail('SDE_MEDIA_UNBOUND', '人工导入视频不在真实运行文件全集中');
  }
  for (const key of ['rawOutput', 'finalOutput']) {
    const output = manifest.outputs[key];
    inside(root, output, false);
    if (job.formal?.[key] !== output || ![ `edit/${SCOPED_DIRECT_EXPORT.episodeId}/`, `outputs/${SCOPED_DIRECT_EXPORT.episodeId}/` ].some((prefix) => output.startsWith(prefix)) || manifest.boundFiles.some((entry) => entry.path === output)) fail('SDE_OUTPUT', '输出必须固定在本条目录且不得覆盖输入');
  }
  if (manifest.outputs.rawOutput === manifest.outputs.finalOutput) fail('SDE_OUTPUT', '原始输出与响度处理输出必须分开');
  assertNoRetiredGeneratedStyle({value: {job, manifest}, operation: 'scoped-direct-export', projectRoot: root,
    documentPaths: [relativeJob, SCOPED_DIRECT_EXPORT.manifestPath], additionalStrings: manifest.boundFiles.map((entry) => entry.path)});
  const policy = JSON.parse(readFile(root, manifest.media.spokenSourcePolicy));
  for (const [key, minimum] of [['minimumGlobalPrecision', 0.97], ['minimumGlobalCoverage', 0.95]]) {
    const value = policy.verification?.[key] ?? minimum;
    if (!Number.isFinite(value) || value < minimum || value > 1) fail('SDE_SPOKEN_THRESHOLD', '不得降低实录字幕校验阈值');
  }
  const spoken = spawnSync(process.execPath, [resolve(root, 'tools/check-spoken-source-policy.mjs'),
    ...['transcript', 'bilingualCaptions', 'spokenSourcePolicy'].map((key) => resolve(root, manifest.media[key].path))], {cwd: root, encoding: 'utf8'});
  if (spoken.status !== 0) fail('SDE_SPOKEN_SOURCE', `实录字幕校验未通过：${spoken.stderr || spoken.stdout}`);
  return {ok: true, route: SCOPED_DIRECT_EXPORT.route, manifestPath: SCOPED_DIRECT_EXPORT.manifestPath,
    manifestSha256: hash(manifestBytes), authorizationKind: manifest.authorization.kind, manifest,
    userPreviewApproved: false, fullWatchConfirmed: false, publishAuthorized: false, ...current};
}

export function assertScopedDirectExportRelease({release, preflight}) {
  if (preflight.route !== SCOPED_DIRECT_EXPORT.route) return false;
  if (release.videoId !== SCOPED_DIRECT_EXPORT.episodeId || release.productionGate?.scopedDirectExportSha256 !== preflight.scopedDirectExportSha256 ||
    release.userReview?.directFinalAuthorized !== true || release.userReview?.previewApproved !== false || release.userReview?.fullWatchConfirmed !== false ||
    release.production?.previewOutput != null || release.productionGate?.previewOutput != null ||
    release.publish?.status !== 'not-published' || !['incomplete-delivery', 'ready-for-user-review'].includes(release.status)) {
    fail('SDE_RELEASE_STATE', '单条直出交付只能待人工观看、未发布，不能伪造预览或验证通过');
  }
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--schema') console.log(JSON.stringify(SCOPED_DIRECT_EXPORT_SCHEMA, null, 2));
    else if (process.argv[2] === '--postshoot-schema') console.log(JSON.stringify(SCOPED_MANUAL_POSTSHOOT_SCHEMA, null, 2));
    else {
      const jobPath = process.argv[3] ?? SCOPED_DIRECT_EXPORT.jobPath;
      const job = JSON.parse(readFileSync(resolve(ROOT, jobPath), 'utf8'));
      if (process.argv[2] === '--bindings') console.log(JSON.stringify(collectScopedDirectExportBindings({job}), null, 2));
      else if (process.argv[2] === '--validate') console.log(JSON.stringify(assertScopedDirectExport({job, jobPath, command: process.argv[4] ?? 'formal'}), null, 2));
      else fail('SDE_USAGE', '用法：--schema | --postshoot-schema | --bindings [job路径] | --validate [job路径] [命令]');
    }
  } catch (error) {
    console.error(`[${error.code ?? 'SDE_INVALID'}] ${error.message}`);
    process.exitCode = 1;
  }
}
