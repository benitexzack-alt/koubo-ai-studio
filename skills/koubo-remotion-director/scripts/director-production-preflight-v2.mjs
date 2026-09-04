import {createHash} from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {assertNoRetiredGeneratedStyle} from '../../../tools/generated-style-policy.mjs';
import {validateKnowledgeContextForProductionV2} from '../../../tools/knowledge-context-production-gate.mjs';
import {assertDirectorProductionBinding} from '../../../tools/director-production-binding-core.mjs';
import {
  assertScopedDirectExport,
  isScopedDirectExportJob,
  SCOPED_DIRECT_EXPORT_GATE_FILES,
} from '../../../tools/scoped-direct-export-core.mjs';
import {
  computeHandoffBindingSha256,
  validateDirectorExternalMessageAnchorV2,
  validateDirectorContractV2,
} from './director-contract-v2-core.mjs';

export const DIRECTOR_PRODUCTION_ENTRY_BINDING_SCHEMA = 'director-production-entry-binding/v2';
export const DIRECTOR_PRODUCTION_FREEZE_RECEIPT_SCHEMA = 'director-production-freeze-receipt/v2';
export const DIRECTOR_FORMAL_AUTHORIZATION_SCHEMA = 'director-formal-command-authorization/v2';
export const DIRECTOR_PRODUCTION_FREEZE_REGISTRY_SCHEMA = 'director-production-freeze-registry/v2';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PRODUCTION_PROJECT_ROOT = resolve(HERE, '../../..');
export const DEFAULT_PRODUCTION_FREEZE_REGISTRY = resolve(
  DEFAULT_PRODUCTION_PROJECT_ROOT,
  'workflow/director-production-freeze-registry.v2.json',
);
const SHA256_RE = /^[a-f0-9]{64}$/u;

const GATE_CLOSURE_PATHS = Object.freeze([
  'tools/validate-v8-production-contract.mjs',
  'tools/validate-release.mjs',
  'tools/release-production-gate-v2.mjs',
  'tools/generated-style-policy.mjs',
  'tools/knowledge-context-production-gate.mjs',
  'tools/generated-video-plan-v2-core.mjs',
  'tools/runninghub-generated-video-v2-adapter.mjs',
  'tools/validate-generated-video-plan-v2.mjs',
  'tools/qa-generated-video-v2.mjs',
  'tools/video-quality-metrics-v2.mjs',
  'skills/koubo-remotion-director/scripts/director-contract-v2-core.mjs',
  'skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs',
  'skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs',
  'skills/koubo-remotion-director/scripts/remotion-production-command-v2.mjs',
  'skills/koubo-remotion-director/templates/director-contract-v2.schema.json',
  'skills/koubo-remotion-director/fixtures/incident-regression-manifest.v2.json',
  'workflow/director-production-freeze-registry.v2.json',
  'skills/koubo-remotion-director/fixtures/external-acceptance-anchor-registry.v2.json',
  'skills/koubo-remotion-director/fixtures/runninghub-h3-official-protocol-recording.v1.json',
]);

export const PROHIBITED_RETIRED_V1_PATHS = Object.freeze([
  'tools/runninghub-generated-video-client.mjs',
  'tools/run-runninghub-generated-video.mjs',
]);

export const PROHIBITED_RETIRED_V1_CONTENT_SHA256 = Object.freeze([
  'c2a02be8375a41a89a9f90127350e1b92387c64428ed2820f25c53ce2489bde6',
  '4e399dcf6e58808c72f7b91d035fcc4f8bc28e93d804c4b8375d29d4f3093948',
  '6e2477263b0af85c0bf218225535265454daaa83c3b48bb488cb7d295d8175fc',
  'f6b13def3eb604dc057120dcc3f11a607ca16452e6e24fc79c06cca2037930a8',
]);

export class DirectorProductionPreflightV2Error extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'DirectorProductionPreflightV2Error';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = null) => {
  throw new DirectorProductionPreflightV2Error(code, message, details);
};
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const sha256Bytes = (value) => createHash('sha256').update(value).digest('hex');

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
};
export const stableJsonSha256ForProductionGateV2 = (value) =>
  sha256Bytes(JSON.stringify(stableValue(value)));

const normalizeRelative = (projectRoot, absolutePath) =>
  relative(projectRoot, absolutePath).split(sep).join('/');

const assertInsideProject = (projectRoot, pathValue, label, {mustExist = true} = {}) => {
  if (!isText(pathValue)) fail('DPG2_PROJECT_PATH_REQUIRED', `${label}必须是项目内非空路径。`);
  const absolutePath = isAbsolute(pathValue) ? resolve(pathValue) : resolve(projectRoot, pathValue);
  const relation = relative(projectRoot, absolutePath);
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    fail('DPG2_PROJECT_PATH_OUTSIDE', `${label}逃逸口播项目：${pathValue}`);
  }
  let cursor = projectRoot;
  for (const segment of relation.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      fail('DPG2_PROJECT_PATH_SYMLINK', `${label}不得经过符号链接：${pathValue}`);
    }
  }
  if (mustExist && !existsSync(absolutePath)) fail('DPG2_PROJECT_FILE_MISSING', `${label}不存在：${pathValue}`);
  if (mustExist && realpathSync(absolutePath) !== absolutePath) fail('DPG2_PROJECT_REALPATH_MISMATCH', `${label}真实路径不一致。`);
  return absolutePath;
};

const hashRegularFile = (projectRoot, pathValue, label) => {
  const absolutePath = assertInsideProject(projectRoot, pathValue, label);
  const stat = lstatSync(absolutePath);
  if (!stat.isFile()) fail('DPG2_REGULAR_FILE_REQUIRED', `${label}必须是普通文件。`);
  return {
    path: normalizeRelative(projectRoot, absolutePath),
    sha256: sha256Bytes(readFileSync(absolutePath)),
    bytes: stat.size,
    absolutePath,
  };
};

const walkNegativeScanFiles = (directory, files = []) => {
  for (const entry of readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))) {
    const absolute = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) fail('DPG2_RETIRED_V1_SCAN_SYMLINK', '退役 v1 负向扫描目录中禁止符号链接。', {path: absolute});
    if (entry.isDirectory()) walkNegativeScanFiles(absolute, files);
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
};

export const assertRetiredV1EntrypointsAbsentV2 = ({projectRoot = DEFAULT_PRODUCTION_PROJECT_ROOT} = {}) => {
  for (const pathValue of PROHIBITED_RETIRED_V1_PATHS) {
    const absolute = resolve(projectRoot, pathValue);
    if (existsSync(absolute)) {
      fail('DPG2_RETIRED_V1_ENTRYPOINT_PRESENT', `退役 v1 入口必须从恢复基线删除：${pathValue}`);
    }
  }
  const retired = new Set(PROHIBITED_RETIRED_V1_CONTENT_SHA256);
  for (const rootName of ['tools', 'skills', 'workflow']) {
    const scanRoot = resolve(projectRoot, rootName);
    if (!existsSync(scanRoot)) continue;
    for (const absolute of walkNegativeScanFiles(scanRoot)) {
      const sha256 = sha256Bytes(readFileSync(absolute));
      if (retired.has(sha256)) {
        fail('DPG2_RETIRED_V1_CONTENT_PRESENT', '检测到退役 v1 入口内容被改名复制，恢复基线继续冻结。', {
          path: normalizeRelative(projectRoot, absolute),
          sha256,
        });
      }
    }
  }
  return {ok: true, scannedRoots: ['tools', 'skills', 'workflow'], prohibitedSha256: [...retired].sort()};
};

const readBoundJson = (projectRoot, reference, label) => {
  if (!isRecord(reference) || !isText(reference.path) || !SHA256_RE.test(String(reference.sha256 ?? ''))) {
    fail('DPG2_BOUND_JSON_REFERENCE_INVALID', `${label}必须绑定项目内路径和小写 SHA-256。`);
  }
  const file = hashRegularFile(projectRoot, reference.path, label);
  if (file.sha256 !== reference.sha256) fail('DPG2_BOUND_JSON_SHA_MISMATCH', `${label} SHA-256 与真实文件不一致。`);
  let body;
  try { body = JSON.parse(readFileSync(file.absolutePath, 'utf8')); }
  catch { fail('DPG2_BOUND_JSON_INVALID', `${label}不是有效 JSON。`); }
  return {...file, body};
};

const expandBindingPath = (projectRoot, pathValue, label) => {
  const absolute = assertInsideProject(projectRoot, pathValue, label);
  const stat = lstatSync(absolute);
  if (stat.isFile()) return [hashRegularFile(projectRoot, absolute, label)];
  if (!stat.isDirectory()) fail('DPG2_BINDING_PATH_TYPE_INVALID', `${label}只能是普通文件或目录。`);
  return readdirSync(absolute, {withFileTypes: true})
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .flatMap((entry) => expandBindingPath(projectRoot, resolve(absolute, entry.name), label));
};

const REMOTION_RUNTIME_EXTENSIONS = Object.freeze(['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css']);
const REMOTION_RUNTIME_INDEX_FILES = Object.freeze(['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs', 'index.cjs', 'index.json', 'index.css']);

const localImportSpecifiers = (source) => {
  const found = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
    /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]?.split('?')[0]?.split('#')[0];
      if (specifier?.startsWith('.')) found.add(specifier);
    }
  }
  return [...found].sort();
};

const resolveLocalRuntimeImport = ({projectRoot, importer, specifier, remotionRoot}) => {
  const base = resolve(dirname(importer), specifier);
  const candidates = [
    ...REMOTION_RUNTIME_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...REMOTION_RUNTIME_INDEX_FILES.map((name) => resolve(base, name)),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const stat = lstatSync(candidate);
    if (!stat.isFile()) continue;
    const checked = assertInsideProject(projectRoot, candidate, 'Remotion 本地 import');
    const relation = relative(remotionRoot, checked);
    if (!relation || relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
      fail('DPG2_REMOTION_IMPORT_OUTSIDE_ROOT', `Remotion 本地 import 逃逸 remotion 根目录：${specifier}`);
    }
    return checked;
  }
  fail('DPG2_REMOTION_IMPORT_UNRESOLVED', `无法解析 Remotion 本地 import：${normalizeRelative(projectRoot, importer)} -> ${specifier}`);
};

export const collectRemotionRuntimeGraphV2 = ({projectRoot = DEFAULT_PRODUCTION_PROJECT_ROOT, job}) => {
  if (!isText(job.remotion?.root) || !isText(job.remotion?.entry)) {
    fail('DPG2_REMOTION_ENTRY_REQUIRED', '生产 job 必须绑定 remotion.root 与 remotion.entry。');
  }
  const remotionRoot = assertInsideProject(projectRoot, job.remotion.root, 'Remotion 根目录');
  if (!lstatSync(remotionRoot).isDirectory()) fail('DPG2_REMOTION_ROOT_INVALID', 'remotion.root 必须是目录。');
  const entry = assertInsideProject(projectRoot, resolve(remotionRoot, job.remotion.entry), 'Remotion entry');
  const queue = [entry];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    if (visited.size > 2048) fail('DPG2_REMOTION_IMPORT_GRAPH_TOO_LARGE', 'Remotion import 图超过 2048 文件，拒绝静默截断。');
    const source = readFileSync(current, 'utf8');
    for (const specifier of localImportSpecifiers(source)) {
      const resolvedImport = resolveLocalRuntimeImport({projectRoot, importer: current, specifier, remotionRoot});
      if (!visited.has(resolvedImport)) queue.push(resolvedImport);
    }
  }
  const lockPaths = ['package.json', 'package-lock.json', 'tsconfig.json'].map((name) =>
    assertInsideProject(projectRoot, resolve(remotionRoot, name), `Remotion ${name}`));
  return [...visited, ...lockPaths]
    .map((pathValue) => hashRegularFile(projectRoot, pathValue, 'Remotion import/锁文件运行图'))
    .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));
};

const requiredJobPaths = (job) => {
  const paths = [
    job.inputs?.source,
    job.inputs?.renderProxy,
    job.inputs?.screenRecording,
    job.inputs?.visualPlan,
    job.inputs?.bilingualCaptions ?? job.inputs?.captions,
    job.inputs?.sfxCueSheet,
    job.inputs?.generatedVideoPlan,
    job.remotion?.publicDir,
    ...(Array.isArray(job.inputs?.fingerprintPaths) ? job.inputs.fingerprintPaths : []),
  ];
  if (isText(job.remotion?.root) && isText(job.remotion?.entry)) {
    paths.push(`${job.remotion.root.replace(/\/$/u, '')}/${job.remotion.entry.replace(/^\//u, '')}`);
  }
  return [...new Set(paths.filter(isText))];
};

export const collectProductionBoundFilesV2 = ({projectRoot = DEFAULT_PRODUCTION_PROJECT_ROOT, job}) => {
  const files = [
    ...requiredJobPaths(job).flatMap((pathValue) =>
      expandBindingPath(projectRoot, pathValue, '生产修订绑定文件')),
    ...collectRemotionRuntimeGraphV2({projectRoot, job}),
  ];
  return [...new Map(files.map(({path, sha256, bytes}) => [path, {path, sha256, bytes}])).values()]
    .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));
};

export const computeProductionJobSnapshotSha256V2 = (job) => {
  const snapshot = structuredClone(job);
  delete snapshot.productionGate;
  return stableJsonSha256ForProductionGateV2(snapshot);
};

export const computeProductionGateClosureV2 = ({projectRoot = DEFAULT_PRODUCTION_PROJECT_ROOT} = {}) => {
  const files = GATE_CLOSURE_PATHS.map((pathValue) => hashRegularFile(projectRoot, pathValue, '生产门禁闭包'))
    .map(({path, sha256, bytes}) => ({path, sha256, bytes}));
  return {files, sha256: stableJsonSha256ForProductionGateV2(files)};
};

const readFreezeRegistry = (projectRoot) => {
  const registry = hashRegularFile(projectRoot, DEFAULT_PRODUCTION_FREEZE_REGISTRY, '生产冻结注册表');
  let body;
  try { body = JSON.parse(readFileSync(registry.absolutePath, 'utf8')); }
  catch { fail('DPG2_FREEZE_REGISTRY_JSON_INVALID', '生产冻结注册表不是有效 JSON。'); }
  if (body.schema !== DIRECTOR_PRODUCTION_FREEZE_REGISTRY_SCHEMA) {
    fail('DPG2_FREEZE_REGISTRY_SCHEMA_INVALID', '生产冻结注册表 schema 不正确。');
  }
  if (
    !Array.isArray(body.supportedCommands) ||
    !isRecord(body.entrypointByCommand) ||
    stableJsonSha256ForProductionGateV2([...body.supportedCommands].sort()) !==
      stableJsonSha256ForProductionGateV2(Object.keys(body.entrypointByCommand).sort())
  ) {
    fail('DPG2_FREEZE_REGISTRY_ENTRYPOINT_MAP_INVALID', 'supportedCommands 必须与 command→entrypoint 固定映射一一对应。');
  }
  return {...registry, body};
};

const assertInsideDirectory = (parent, child, code, message) => {
  const relation = relative(parent, child);
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    fail(code, message);
  }
};

const assertPathChainNoSymlink = (root, target, label) => {
  assertInsideDirectory(root, target, 'DPG2_REMOTION_CLI_PATH_OUTSIDE', `${label}必须位于项目内。`);
  const relation = relative(root, target);
  let cursor = root;
  for (const segment of relation.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor)) fail('DPG2_REMOTION_CLI_PATH_MISSING', `${label}路径链缺失：${normalizeRelative(root, cursor)}`);
    if (lstatSync(cursor).isSymbolicLink()) {
      fail('DPG2_REMOTION_CLI_TARGET_CHAIN_SYMLINK', `${label}真实目标路径链不得再次经过符号链接。`);
    }
  }
};

export const validateControlledRemotionCliBindingV2 = ({projectRoot, binding}) => {
  if (
    !isText(projectRoot) ||
    !isRecord(binding) || !isText(binding.linkPath) || !isText(binding.allowedRealpath) ||
    !SHA256_RE.test(String(binding.targetSha256 ?? ''))
  ) {
    fail('DPG2_REMOTION_CLI_REGISTRY_BINDING_INVALID', '冻结注册表必须绑定 Remotion CLI 链接、真实目标与目标 SHA-256。');
  }
  const linkPath = isAbsolute(binding.linkPath) ? resolve(binding.linkPath) : resolve(projectRoot, binding.linkPath);
  const expectedTarget = isAbsolute(binding.allowedRealpath) ? resolve(binding.allowedRealpath) : resolve(projectRoot, binding.allowedRealpath);
  const dependencyRoot = resolve(projectRoot, 'remotion/node_modules');
  assertInsideDirectory(projectRoot, linkPath, 'DPG2_REMOTION_CLI_PATH_OUTSIDE', 'Remotion CLI 链接必须位于项目内。');
  assertInsideDirectory(dependencyRoot, expectedTarget, 'DPG2_REMOTION_CLI_TARGET_OUTSIDE_DEPENDENCIES', 'Remotion CLI 真实目标必须位于项目依赖目录内。');
  assertPathChainNoSymlink(projectRoot, dirname(linkPath), 'Remotion CLI 链接父路径');
  if (!existsSync(linkPath) || !lstatSync(linkPath).isSymbolicLink()) {
    fail('DPG2_REMOTION_CLI_LINK_REQUIRED', 'node_modules/.bin/remotion 必须是受控符号链接。');
  }
  const realTarget = realpathSync(linkPath);
  if (realTarget !== expectedTarget) {
    fail('DPG2_REMOTION_CLI_REALPATH_MISMATCH', 'Remotion CLI 符号链接真实目标与冻结注册表不一致。');
  }
  assertInsideDirectory(dependencyRoot, realTarget, 'DPG2_REMOTION_CLI_TARGET_OUTSIDE_DEPENDENCIES', 'Remotion CLI 真实目标逃逸项目依赖目录。');
  assertPathChainNoSymlink(projectRoot, realTarget, 'Remotion CLI 真实目标');
  const targetStat = lstatSync(realTarget);
  if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
    fail('DPG2_REMOTION_CLI_TARGET_NOT_REGULAR_FILE', 'Remotion CLI 真实目标必须是普通文件。');
  }
  const targetSha256 = sha256Bytes(readFileSync(realTarget));
  if (targetSha256 !== binding.targetSha256) {
    fail('DPG2_REMOTION_CLI_TARGET_SHA_MISMATCH', 'Remotion CLI 真实目标 SHA-256 与冻结注册表不一致。');
  }
  return {
    linkPath,
    realTarget,
    linkPathRelative: normalizeRelative(projectRoot, linkPath),
    realTargetRelative: normalizeRelative(projectRoot, realTarget),
    targetSha256,
    bytes: targetStat.size,
  };
};

export const resolveControlledRemotionCliV2 = ({projectRoot = DEFAULT_PRODUCTION_PROJECT_ROOT} = {}) => {
  const registry = readFreezeRegistry(projectRoot);
  return validateControlledRemotionCliBindingV2({projectRoot, binding: registry.body.controlledRemotionCli});
};

export const computeProductionCompositionBindingV2 = (job, {projectRoot = DEFAULT_PRODUCTION_PROJECT_ROOT} = {}) => {
  const cli = resolveControlledRemotionCliV2({projectRoot});
  return {
    root: job.remotion?.root ?? null,
    entry: job.remotion?.entry ?? null,
    publicDir: job.remotion?.publicDir ?? null,
    compositionWithSfx: job.remotion?.compositionWithSfx ?? null,
    compositionWithoutSfx: job.remotion?.compositionWithoutSfx ?? null,
    durationSeconds: job.remotion?.durationSeconds ?? null,
    fps: job.remotion?.fps ?? null,
    width: job.remotion?.width ?? null,
    height: job.remotion?.height ?? null,
    controlledRemotionCli: {
      linkPath: cli.linkPathRelative,
      realTarget: cli.realTargetRelative,
      targetSha256: cli.targetSha256,
      bytes: cli.bytes,
    },
  };
};

export const assertProductionExternalMessageV2 = ({body, executionGroupId, decision, revisionId, kind, codePrefix}) => {
  if (
    body.evidenceScope !== 'real-e2e' ||
    body.decision !== decision ||
    !isText(body.issuerGroupId) || body.issuerGroupId === executionGroupId ||
    !isText(body.sourceThreadId) || !isText(body.sourceMessageId) ||
    !isText(body.explicitAuthorizationQuote) ||
    body.sourceMessageSha256 !== sha256Bytes(body.explicitAuthorizationQuote) ||
    !isText(body.reviewedAt) || Number.isNaN(Date.parse(body.reviewedAt)) ||
    body.revisionId !== revisionId ||
    !isText(body.expiresAt) || Number.isNaN(Date.parse(body.expiresAt)) ||
    Date.parse(body.expiresAt) <= Date.now()
  ) {
    fail(`${codePrefix}_EXTERNAL_EVIDENCE_INVALID`, '回执必须来自非执行组的独立外部消息，绑定明确原话、消息 SHA、revision 与未过期时间。');
  }
  const anchored = validateDirectorExternalMessageAnchorV2({
    ...body,
    explicitAcceptanceQuote: body.explicitAuthorizationQuote,
  }, kind);
  if (!anchored.ok) {
    fail(`${codePrefix}_EXTERNAL_ANCHOR_INVALID`, '回执未命中不可由执行组自造的独立签名锚点。', {reason: anchored.reason});
  }
  if (
    anchored.entry.decision !== decision ||
    anchored.entry.revisionId !== revisionId ||
    anchored.entry.expiresAt !== body.expiresAt
  ) {
    fail(`${codePrefix}_EXTERNAL_ANCHOR_BINDING_INVALID`, '独立签名锚点未绑定当前 decision、revision 与 expiry。');
  }
};

const assertExactStable = (actual, expected, code, label) => {
  if (stableJsonSha256ForProductionGateV2(actual) !== stableJsonSha256ForProductionGateV2(expected)) {
    fail(code, `${label}未绑定当前真实值。`);
  }
};

export const validateProductionEntryPreflightV2 = ({
  projectRoot = DEFAULT_PRODUCTION_PROJECT_ROOT,
  jobPath,
  job = null,
  command,
  entrypoint,
}) => {
  try {
    const registry = readFreezeRegistry(projectRoot);
    assertRetiredV1EntrypointsAbsentV2({projectRoot});
    if (!registry.body.supportedCommands.includes(command)) {
      fail('DPG2_COMMAND_NOT_SUPPORTED', `未知或未冻结建模的生产命令：${String(command)}`);
    }
    if (!isText(entrypoint)) fail('DPG2_ENTRYPOINT_REQUIRED', '生产门必须声明具体入口。');
    const expectedEntrypoint = registry.body.entrypointByCommand?.[command];
    if (!isText(expectedEntrypoint) || entrypoint !== expectedEntrypoint) {
      fail('DPG2_COMMAND_ENTRYPOINT_MISMATCH', `命令 ${command} 只能由固定入口 ${String(expectedEntrypoint)} 调用。`);
    }
    const jobFile = hashRegularFile(projectRoot, jobPath, '生产 job');
    let parsedJob;
    try { parsedJob = JSON.parse(readFileSync(jobFile.absolutePath, 'utf8')); }
    catch { fail('DPG2_JOB_JSON_INVALID', '生产 job 不是有效 JSON。'); }
    if (job !== null && (!isRecord(job) || stableJsonSha256ForProductionGateV2(job) !== stableJsonSha256ForProductionGateV2(parsedJob))) {
      fail('DPG2_JOB_ARGUMENT_DISK_MISMATCH', '调用方传入 job 对象与磁盘 job 的规范内容不一致。');
    }
    const frozenRevision = registry.body.blockedJobFiles.find((item) =>
      item.jobId === parsedJob.jobId && item.jobFileSha256 === jobFile.sha256);
    if (frozenRevision) {
      fail('DPG2_FROZEN_JOB_REVISION', `当前 job 修订已冻结：${frozenRevision.reason}`, {jobSha256: jobFile.sha256});
    }
    const gate = parsedJob.productionGate;
    if (!isRecord(gate) || gate.schema !== DIRECTOR_PRODUCTION_ENTRY_BINDING_SCHEMA) {
      fail('DPG2_GATE_BINDING_REQUIRED', '所有生产入口必须绑定 director-production-entry-binding/v2。');
    }
    if (!isText(gate.revisionId)) fail('DPG2_REVISION_ID_REQUIRED', '生产门绑定必须有新 revisionId。');
    if (!isText(parsedJob.remotion?.publicDir)) {
      fail('DPG2_REMOTION_PUBLIC_DIR_REQUIRED', '生产 job 必须显式绑定 Remotion publicDir；禁止使用隐式默认目录。');
    }

    // This is a separate, pinned single-episode contract, never a signature fallback.
    if (isScopedDirectExportJob(parsedJob)) {
      const scoped = assertScopedDirectExport({projectRoot, job: parsedJob, jobPath, command});
      const directorBinding = assertDirectorProductionBinding({projectRoot, job: parsedJob, command});
      const closure = computeProductionGateClosureV2({projectRoot});
      const gateClosureFiles = [...new Map([
        ...closure.files,
        ...SCOPED_DIRECT_EXPORT_GATE_FILES.map((pathValue) => {
          const {path, sha256, bytes} = hashRegularFile(projectRoot, pathValue, '本条直出门禁闭包');
          return {path, sha256, bytes};
        }),
      ].map((entry) => [entry.path, entry])).values()].sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));
      const knowledgeContext = validateKnowledgeContextForProductionV2({
        projectRoot, jobPath: jobFile.absolutePath, job: parsedJob, command,
      });
      const evidence = {
        ok: true, code: 'DPG2_SCOPED_DIRECT_EXPORT_OK', route: scoped.route, command, entrypoint,
        jobId: parsedJob.jobId, revisionId: gate.revisionId, jobFileSha256: jobFile.sha256,
        jobSnapshotSha256: scoped.jobSnapshotSha256,
        scopedDirectExportSha256: scoped.manifestSha256,
        directorContractSha256: null, handoffBindingSha256: null, freezeReceiptSha256: null,
        boundFilesSha256: stableJsonSha256ForProductionGateV2(scoped.boundFiles),
        gateClosureSha256: stableJsonSha256ForProductionGateV2(gateClosureFiles), gateClosureFiles,
        compositionBindingSha256: stableJsonSha256ForProductionGateV2(scoped.compositionBinding),
        userPreviewApproved: false, fullWatchConfirmed: false, publishAuthorized: false,
        directorBinding, knowledgeContext,
      };
      return {...evidence, integritySealSha256: stableJsonSha256ForProductionGateV2(evidence)};
    }

    const director = readBoundJson(projectRoot, gate.directorContract, '导演合同');
    const directorResult = validateDirectorContractV2(director.body, {
      rootDir: dirname(director.absolutePath),
      checkFiles: true,
    });
    if (!directorResult.ok || director.body.lifecycle?.state !== 'automation-handoff-eligible' || director.body.productionEligible !== true || director.body.formal?.enabled !== false) {
      fail('DPG2_DIRECTOR_CONTRACT_NOT_ELIGIBLE', '导演合同必须通过真文件校验并处于 automation-handoff-eligible，同时保持 formal=false。', {errors: directorResult.errors});
    }
    const contractHandoff = director.body.lifecycle?.handoff;
    const handoff = readBoundJson(projectRoot, gate.handoffReceipt, '导演交接回执');
    if (
      handoff.sha256 !== contractHandoff?.receipt?.sha256 ||
      gate.handoffBindingSha256 !== contractHandoff?.bindingSha256 ||
      gate.handoffBindingSha256 !== computeHandoffBindingSha256(director.body)
    ) {
      fail('DPG2_DIRECTOR_HANDOFF_BINDING_MISMATCH', '生产门未绑定当前导演交接回执与稳定哈希。');
    }

    const freeze = readBoundJson(projectRoot, gate.freezeReceipt, '生产冻结/解冻回执');
    const freezeBody = freeze.body;
    if (freezeBody.schema !== DIRECTOR_PRODUCTION_FREEZE_RECEIPT_SCHEMA) {
      fail('DPG2_FREEZE_RECEIPT_SCHEMA_INVALID', '生产冻结/解冻回执 schema 不正确。');
    }
    assertProductionExternalMessageV2({
      body: freezeBody,
      executionGroupId: director.body.executionGroupId,
      decision: gate.state === 'candidate-preview-required' ? 'approved-candidate-revision' : 'approved-post-preview-revision',
      revisionId: gate.revisionId,
      kind: 'director-production-freeze-authorization',
      codePrefix: 'DPG2_FREEZE_RECEIPT',
    });
    const boundFiles = collectProductionBoundFilesV2({projectRoot, job: parsedJob});
    const closure = computeProductionGateClosureV2({projectRoot});
    const expectedJobSnapshotSha256 = computeProductionJobSnapshotSha256V2(parsedJob);
    const expectedComposition = computeProductionCompositionBindingV2(parsedJob, {projectRoot});
    if (
      freezeBody.jobId !== parsedJob.jobId ||
      freezeBody.revisionId !== gate.revisionId ||
      freezeBody.jobSnapshotSha256 !== expectedJobSnapshotSha256 ||
      freezeBody.directorContractSha256 !== director.sha256 ||
      freezeBody.handoffReceiptSha256 !== handoff.sha256 ||
      freezeBody.handoffBindingSha256 !== gate.handoffBindingSha256 ||
      freezeBody.boundFilesSha256 !== stableJsonSha256ForProductionGateV2(boundFiles) ||
      freezeBody.gateClosureSha256 !== closure.sha256
    ) {
      fail('DPG2_FREEZE_RECEIPT_BINDING_MISMATCH', '冻结/解冻回执未绑定当前 job、revision、导演合同、交接、媒体全集与门禁闭包。');
    }
    assertExactStable(freezeBody.boundFiles, boundFiles, 'DPG2_BOUND_FILES_MISMATCH', '修订文件全量清单');
    assertExactStable(freezeBody.compositionBinding, expectedComposition, 'DPG2_COMPOSITION_BINDING_MISMATCH', 'Remotion composition');
    assertExactStable(freezeBody.gateClosure, closure.files, 'DPG2_GATE_CLOSURE_MISMATCH', '生产门禁闭包');
    if (!Array.isArray(freezeBody.allowedCommands) || !freezeBody.allowedCommands.includes(command)) {
      fail('DPG2_COMMAND_FROZEN', `当前修订回执未解冻命令：${command}`);
    }
    if (freezeBody.allowedCommands.some((item) => !registry.body.supportedCommands.includes(item))) {
      fail('DPG2_FREEZE_ALLOWED_COMMAND_INVALID', '冻结回执 allowedCommands 包含未建模入口。');
    }

    if (gate.state === 'candidate-preview-required') {
      if (
        parsedJob.experiment?.status !== 'candidate-preview-required' ||
        parsedJob.experiment?.userPreviewApproved !== false ||
        parsedJob.formal?.enabled !== false ||
        gate.userPreviewApproved !== false ||
        gate.formalEnabled !== false
      ) {
        fail('DPG2_CANDIDATE_REVISION_STATE_INVALID', '恢复修订必须保持 candidate-preview-required、userPreviewApproved=false、formal=false。');
      }
      if (!registry.body.candidateRevisionAllowedCommands.includes(command)) {
        fail('DPG2_FORMAL_COMMAND_REQUIRES_SEPARATE_AUTHORIZATION', `命令 ${command} 需要预览后另行正式授权，风格交接不能自动开启。`);
      }
    } else if (gate.state === 'candidate-preview-approved') {
      if (
        parsedJob.experiment?.status !== 'candidate-preview-approved' ||
        parsedJob.experiment?.userPreviewApproved !== true ||
        parsedJob.formal?.enabled !== true ||
        gate.userPreviewApproved !== true || gate.formalEnabled !== true
      ) {
        fail('DPG2_POST_PREVIEW_STATE_INVALID', '预览后修订状态、用户预览结论与 formal 开关不一致。');
      }
      if (registry.body.formalCommandsRequireSeparateAuthorization.includes(command)) {
        const formalAuthorization = readBoundJson(projectRoot, gate.formalAuthorization, '单条正式命令授权');
        const authorization = formalAuthorization.body;
        if (authorization.schema !== DIRECTOR_FORMAL_AUTHORIZATION_SCHEMA) {
          fail('DPG2_FORMAL_AUTHORIZATION_SCHEMA_INVALID', '正式命令授权 schema 不正确。');
        }
        assertProductionExternalMessageV2({
          body: authorization,
          executionGroupId: director.body.executionGroupId,
          decision: 'approved-formal-command',
          revisionId: gate.revisionId,
          kind: 'director-formal-command-authorization',
          codePrefix: 'DPG2_FORMAL_AUTHORIZATION',
        });
        if (
          authorization.jobId !== parsedJob.jobId ||
          authorization.revisionId !== gate.revisionId ||
          authorization.jobSnapshotSha256 !== expectedJobSnapshotSha256 ||
          authorization.freezeReceiptSha256 !== freeze.sha256 ||
          authorization.directorContractSha256 !== director.sha256 ||
          !Array.isArray(authorization.allowedCommands) ||
          !authorization.allowedCommands.includes(command)
        ) {
          fail('DPG2_FORMAL_AUTHORIZATION_BINDING_MISMATCH', '正式授权未绑定当前 job/revision/freeze/director 与具体命令。');
        }
      }
    } else {
      fail('DPG2_GATE_STATE_INVALID', 'productionGate.state 只能是 candidate-preview-required 或 candidate-preview-approved。');
    }

    assertNoRetiredGeneratedStyle({
      value: {job: parsedJob, directorContract: director.body, freezeReceipt: freezeBody},
      operation: `production-entry-${command}`,
      location: '$.productionEntry',
      projectRoot,
      documentPaths: [jobFile.absolutePath, director.absolutePath, freeze.absolutePath],
      additionalStrings: boundFiles.map((item) => item.path),
    });

    const knowledgeContext = validateKnowledgeContextForProductionV2({
      projectRoot,
      jobPath: jobFile.absolutePath,
      job: parsedJob,
      command,
    });

    const evidence = {
      ok: true,
      code: 'DPG2_OK',
      command,
      entrypoint,
      jobId: parsedJob.jobId,
      revisionId: gate.revisionId,
      jobFileSha256: jobFile.sha256,
      jobSnapshotSha256: expectedJobSnapshotSha256,
      directorContractSha256: director.sha256,
      handoffBindingSha256: gate.handoffBindingSha256,
      freezeReceiptSha256: freeze.sha256,
      boundFilesSha256: freezeBody.boundFilesSha256,
      gateClosureSha256: closure.sha256,
      gateClosureFiles: closure.files,
      compositionBindingSha256: stableJsonSha256ForProductionGateV2(expectedComposition),
      knowledgeContext,
    };
    return {...evidence, integritySealSha256: stableJsonSha256ForProductionGateV2(evidence)};
  } catch (error) {
    if (error instanceof DirectorProductionPreflightV2Error) {
      return {ok: false, code: error.code, message: error.message, details: error.details};
    }
    return {ok: false, code: error?.code ?? 'DPG2_UNEXPECTED', message: error instanceof Error ? error.message : String(error)};
  }
};

export const assertProductionEntryPreflightV2 = (options) => {
  const result = validateProductionEntryPreflightV2(options);
  if (!result.ok) fail(result.code, result.message, result.details);
  return result;
};

export const assertProductionPreflightStillCurrentV2 = ({preflight, ...options}) => {
  if (!isRecord(preflight) || preflight.ok !== true || !SHA256_RE.test(String(preflight.integritySealSha256 ?? ''))) {
    fail('DPG2_PREFLIGHT_RECEIPT_INVALID', 'spawn 前复验必须绑定有效 preflight 完整性回执。');
  }
  const current = assertProductionEntryPreflightV2(options);
  if (current.integritySealSha256 !== preflight.integritySealSha256) {
    fail('DPG2_PREFLIGHT_TOCTOU_DRIFT', 'preflight 与 spawn 紧前/渲染后门禁闭包、job、媒体或依赖图发生漂移。');
  }
  return current;
};
